/**
 * Vault 缓存管理
 *
 * 负责登录、解密 vault 数据、缓存管理、锁定。
 *
 * H1 修复：symmetricKey 不再导出为 base64 持久化到 chrome.storage.session。
 * 改为保留在 service worker 模块级内存变量中。
 * - 解密后的 items/vaults 仍缓存在 storage.session 中（自动填充需要）
 * - symmetricKey 仅内存保留，SW 休眠或浏览器关闭后即丢失
 * - 自动保存场景需要 symmetricKey；若内存已清空则要求重新解锁
 */
import * as api from '../lib/api';
import * as crypto from '../lib/crypto';
import * as storage from '../lib/storage';
import type { VaultItem, Vault, FillIdentity, FillCard } from '../types';

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

/**
 * Symmetric Key 内存缓存（H1 修复）
 *
 * 仅保留在 service worker 模块作用域，SW 被销毁或浏览器关闭后即丢失。
 * 不再使用 chrome.storage.session 持久化 base64 字符串形式。
 * extractable=false 的 CryptoKey 无法被 exportKey 序列化。
 */
let symmetricKeyInMemory: CryptoKey | null = null;

/** 从 URL 字符串中提取域名 */
function extractDomain(url: string): string {
  try {
    const normalized = url.startsWith('http') ? url : `https://${url}`;
    return new URL(normalized).hostname;
  } catch {
    return url;
  }
}

/** 解密 vault 数据并缓存
 *
 * H1 修复：symmetricKey 仅保留在内存中，不再 export 为 base64。
 * storage.session 只缓存解密后的 vaults/items 元数据（自动填充需要）。
 */
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

  // symmetricKey 仅保留在内存，不再 export 为 base64
  symmetricKeyInMemory = symmetricKey;

  await storage.setCache({
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
 *
 * H1 修复：清空内存中的 symmetricKey + storage.session 缓存。
 */
export async function lock(): Promise<void> {
  symmetricKeyInMemory = null;
  await storage.clearCache();
  await storage.setStatus('locked');
}

/**
 * 检查 symmetricKey 是否仍在内存中（SW 未休眠）。
 *
 * 自动填充仅需 cache.items（已解密），无需 symmetricKey。
 * 自动保存需要 symmetricKey 重新加密，若丢失则要求用户重新解锁。
 */
export function hasSymmetricKey(): boolean {
  return symmetricKeyInMemory !== null;
}

/**
 * 检查自动锁定并在触发时清空内存中的 symmetricKey。
 *
 * 包装 storage.checkAutoLock 以确保自动锁定场景下内存密钥也被清空，
 * 避免 SW 仍存活但用户已 30 分钟未活动时密钥继续驻留内存。
 */
async function checkAutoLockAndClearKey(): Promise<boolean> {
  const triggered = await storage.checkAutoLock();
  if (triggered) {
    symmetricKeyInMemory = null;
  }
  return triggered;
}

/**
 * 获取条目列表（可选过滤）
 */
export async function getItems(query?: string): Promise<VaultItem[]> {
  // 1. 检查自动锁定
  await checkAutoLockAndClearKey();

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

/**
 * 获取所有身份信息条目（用于自动填充）
 *
 * 不与特定网站绑定，返回全部 identity 类型条目。
 */
export async function findAllIdentities(): Promise<FillIdentity[]> {
  await checkAutoLockAndClearKey();
  const cache = await storage.getCache();
  if (!cache) {
    return [];
  }

  return cache.items
    .filter((item) => item.itemTypeCode === 'identity')
    .map((item) => ({
      id: item.id,
      title: item.title,
      firstName: item.data.firstName ?? '',
      lastName: item.data.lastName ?? '',
      address: item.data.address ?? '',
      city: item.data.city ?? '',
      state: item.data.state ?? '',
      zip: item.data.zip ?? '',
      country: item.data.country ?? '',
      phone: item.data.phone ?? '',
      email: item.data.email ?? '',
    }));
}

/**
 * 获取所有信用卡条目（用于自动填充）
 *
 * 不与特定网站绑定，返回全部 credit_card 类型条目。
 */
export async function findAllCards(): Promise<FillCard[]> {
  await checkAutoLockAndClearKey();
  const cache = await storage.getCache();
  if (!cache) {
    return [];
  }

  return cache.items
    .filter((item) => item.itemTypeCode === 'credit_card')
    .map((item) => ({
      id: item.id,
      title: item.title,
      cardholder: item.data.cardholder ?? '',
      cardNumber: item.data.cardNumber ?? '',
      expiry: item.data.expiry ?? '',
      cvv: item.data.cvv ?? '',
    }));
}

/** saveItem 操作结果 */
export type SaveItemResult = 'saved' | 'updated' | 'ignored';

/**
 * 保存条目（新增或更新）
 *
 * H1 修复：使用内存中的 symmetricKey（不再从 storage 读取 base64 重新 import）。
 * 若 SW 休眠导致内存 symmetricKey 丢失，抛出错误要求用户重新解锁。
 */
export async function saveItem(
  domain: string,
  username: string,
  password: string,
): Promise<SaveItemResult> {
  // 1. 检查 symmetricKey 是否仍在内存
  if (!symmetricKeyInMemory) {
    throw new Error('保险库已锁定，请重新解锁后再保存');
  }

  // 2. 获取缓存
  const cache = await storage.getCache();
  if (!cache) {
    throw new Error('保险库未解锁');
  }

  // 3. 检查该域名下是否已有相同 username 的条目
  const existing = cache.items.find((item) => {
    if (item.itemTypeCode !== 'login') return false;
    if (!item.data.url) return false;
    const itemDomain = extractDomain(item.data.url);
    return (itemDomain === domain || domain.endsWith(`.${itemDomain}`)) &&
      item.data.username === username;
  });

  // 使用内存中的 symmetricKey 加密
  const symmetricKey = symmetricKeyInMemory;

  if (existing) {
    // 4. 已存在且密码相同 -> 不操作
    if (existing.data.password === password) {
      return 'ignored';
    }

    // 5. 已存在但密码不同 -> 加密更新数据
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

  // 6. 不存在 -> 创建新条目
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

  // 7. 更新缓存中的 items 列表
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
