/**
 * Vault 缓存管理
 *
 * 负责登录、解密 vault 数据、缓存管理、锁定。
 */
import * as api from '../lib/api';
import * as crypto from '../lib/crypto';
import * as storage from '../lib/storage';
import type { VaultItem, Vault } from '../types';

/** item type code 映射（从 item_type_id 到 code） */
const ITEM_TYPE_CODE_MAP: Record<number, string> = {
  1: 'login',
  2: 'secure_note',
  3: 'credit_card',
  4: 'identity',
  5: 'password',
  6: 'software_license',
  7: 'bank_account',
  8: 'wireless_router',
  9: 'server',
  10: 'database',
  11: 'api_credential',
  12: 'crypto_wallet',
  13: 'driver_license',
  14: 'passport',
  15: 'membership',
  16: 'reward_program',
};

/** 从 URL 字符串中提取域名 */
function extractDomain(url: string): string {
  try {
    const normalized = url.startsWith('http') ? url : `https://${url}`;
    return new URL(normalized).hostname;
  } catch {
    return url;
  }
}

/** 解密 vault 数据并缓存 */
async function decryptAndCacheVault(
  symmetricKey: CryptoKey,
  masterKey: Uint8Array,
): Promise<void> {
  const vaultResp = await api.getVault();

  // 构建 item type 映射（优先使用 API 返回的映射）
  const itemTypeMap = new Map<number, string>();
  for (const t of vaultResp.itemTypes) {
    itemTypeMap.set(t.id, t.code);
  }

  // 解密 vaults
  const vaults: Vault[] = [];
  for (const v of vaultResp.vaults) {
    const name = await crypto.decrypt(symmetricKey, v.name_encrypted, 'passbox:vault-name:v1');
    vaults.push({ id: v.id, name });
  }

  // 解密 items
  const items: VaultItem[] = [];
  for (const it of vaultResp.items) {
    const title = await crypto.decrypt(symmetricKey, it.title_encrypted, `item:${it.id}:title`);
    const dataJson = await crypto.decrypt(symmetricKey, it.data_encrypted, `item:${it.id}:data`);
    const data = JSON.parse(dataJson) as VaultItem['data'];
    const itemTypeCode = itemTypeMap.get(it.item_type_id) ?? ITEM_TYPE_CODE_MAP[it.item_type_id] ?? 'unknown';
    items.push({
      id: it.id,
      vaultId: it.vault_id,
      itemTypeId: it.item_type_id,
      itemTypeCode,
      title,
      data,
      isFavorite: it.is_favorite,
      tagIds: [],
    });
  }

  // 导出 symmetric key 为 base64 并缓存
  const symmetricKeyBase64 = await crypto.exportSymmetricKey(symmetricKey);

  await storage.setCache({
    symmetricKeyBase64,
    vaults,
    items,
    lastUnlockAt: Date.now(),
  });

  await storage.setStatus('unlocked');
  crypto.zeroFill(masterKey);
}

/**
 * 登录并缓存 vault 数据
 */
export async function loginAndCache(email: string, masterPassword: string): Promise<void> {
  // 1. prelogin 获取 KDF salt + params
  const preloginResp = await api.prelogin(email);

  // 2. 派生 master key
  const masterKey = await crypto.deriveMasterKey(
    masterPassword,
    preloginResp.kdfSalt,
    preloginResp.kdfParams,
  );

  // 3. 派生 auth hash
  const authHash = await crypto.deriveAuthHash(masterKey, email);

  // 4. 登录获取 encryptedKey
  const loginResp = await api.login(email, authHash);

  // 5. 解密 symmetric key
  const symmetricKey = await crypto.decryptSymmetricKey(masterKey, loginResp.encryptedKey);

  // 6-11. 解密 vault 并缓存
  await decryptAndCacheVault(symmetricKey, masterKey);
}

/**
 * 解锁并缓存 vault 数据（session 仍然有效时）
 */
export async function unlockAndCache(masterPassword: string): Promise<void> {
  // 1. 获取 session 信息
  const session = await api.getSession();

  // 2. session 过期检查
  if (!session) {
    throw new Error('会话已过期，请重新登录');
  }

  // 3. 派生 master key（步骤 2）
  const masterKey = await crypto.deriveMasterKey(
    masterPassword,
    session.kdfSalt,
    session.kdfParams,
  );

  // 4. 解密 symmetric key（步骤 5）
  const symmetricKey = await crypto.decryptSymmetricKey(masterKey, session.encryptedKey);

  // 5-10. 解密 vault 并缓存（步骤 6-11）
  await decryptAndCacheVault(symmetricKey, masterKey);
}

/**
 * 锁定保险库
 */
export async function lock(): Promise<void> {
  await storage.clearCache();
  await storage.setStatus('locked');
}

/**
 * 获取条目列表（可选过滤）
 */
export async function getItems(query?: string): Promise<VaultItem[]> {
  // 1. 检查自动锁定
  await storage.checkAutoLock();

  // 2. 获取缓存
  const cache = await storage.getCache();

  // 3. 无缓存返回空数组
  if (!cache) {
    return [];
  }

  // 4. 过滤
  if (query) {
    const lowerQuery = query.toLowerCase();
    return cache.items.filter((item) => {
      if (item.title.toLowerCase().includes(lowerQuery)) return true;
      if (item.data.username?.toLowerCase().includes(lowerQuery)) return true;
      if (item.data.url?.toLowerCase().includes(lowerQuery)) return true;
      return false;
    });
  }

  // 5. 返回全部
  return cache.items;
}

/**
 * 根据域名查找匹配的条目
 */
export async function findItemsByDomain(domain: string): Promise<VaultItem[]> {
  const cache = await storage.getCache();
  if (!cache) {
    return [];
  }

  return cache.items.filter((item) => {
    // 仅匹配 login 类型
    if (item.itemTypeCode !== 'login') return false;

    // 从 item.data.url 提取域名并比较
    if (!item.data.url) return false;
    const itemDomain = extractDomain(item.data.url);

    // 精确匹配或子域名匹配
    if (itemDomain === domain) return true;
    if (domain.endsWith(`.${itemDomain}`)) return true;

    return false;
  });
}

/** saveItem 操作结果 */
export type SaveItemResult = 'saved' | 'updated' | 'ignored';

/**
 * 保存条目（新增或更新）
 */
export async function saveItem(
  domain: string,
  username: string,
  password: string,
): Promise<SaveItemResult> {
  // 1. 获取缓存
  const cache = await storage.getCache();
  if (!cache) {
    throw new Error('保险库未解锁');
  }

  // 2. 检查该域名下是否已有相同 username 的条目
  const existing = cache.items.find((item) => {
    if (item.itemTypeCode !== 'login') return false;
    if (!item.data.url) return false;
    const itemDomain = extractDomain(item.data.url);
    return (itemDomain === domain || domain.endsWith(`.${itemDomain}`)) &&
      item.data.username === username;
  });

  // 导入 symmetric key 用于加密
  const symmetricKey = await crypto.importSymmetricKey(cache.symmetricKeyBase64);

  if (existing) {
    // 3. 已存在且密码相同 -> 不操作
    if (existing.data.password === password) {
      return 'ignored';
    }

    // 4. 已存在但密码不同 -> 加密更新数据
    const newData = { ...existing.data, url: domain, username, password };
    const titleEncrypted = await crypto.encrypt(symmetricKey, existing.title, `item:${existing.id}:title`);
    const dataEncrypted = await crypto.encrypt(
      symmetricKey,
      JSON.stringify(newData),
      `item:${existing.id}:data`,
    );

    await api.updateItem(existing.id, { titleEncrypted, dataEncrypted });

    // 更新缓存中的 items 列表
    existing.data = newData;
    await storage.setCache(cache);

    return 'updated';
  }

  // 5. 不存在 -> 创建新条目
  const itemId = globalThis.crypto.randomUUID();
  const title = domain;
  const data = { url: domain, username, password };
  const titleEncrypted = await crypto.encrypt(symmetricKey, title, `item:${itemId}:title`);
  const dataEncrypted = await crypto.encrypt(
    symmetricKey,
    JSON.stringify(data),
    `item:${itemId}:data`,
  );

  if (cache.vaults.length === 0) {
    throw new Error('没有可用的保险库');
  }

  await api.createItem({
    itemId,
    vaultId: cache.vaults[0].id,
    itemTypeId: 1,
    titleEncrypted,
    dataEncrypted,
    tagIds: [],
  });

  // 6. 更新缓存中的 items 列表
  cache.items.push({
    id: itemId,
    vaultId: cache.vaults[0].id,
    itemTypeId: 1,
    itemTypeCode: 'login',
    title,
    data,
    isFavorite: false,
    tagIds: [],
  });
  await storage.setCache(cache);

  return 'saved';
}

/**
 * 获取条目的密码（用于复制）
 */
export async function copyPassword(itemId: string): Promise<string | null> {
  const cache = await storage.getCache();
  if (!cache) {
    return null;
  }

  const item = cache.items.find((it) => it.id === itemId);
  if (!item) {
    return null;
  }

  return item.data.password ?? null;
}
