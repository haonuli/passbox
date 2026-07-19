/**
 * 密码库状态管理 Store (T4.2)
 *
 * 对应 TASK_BREAKDOWN T4.2 验收标准：
 * - Store 包含：vaults（解密后的保险库）、items（解密后的条目）、tags
 * - setVaultData(cipherData, symmetricKey) 接收密文 + 密钥，批量解密并缓存
 * - upsertItem(item) 新增/更新单条解密后的条目
 * - removeItem(itemId) 从缓存移除条目
 * - clear() 清空所有缓存（锁定时调用）
 * - 解密使用 Promise.all 并发
 * - 密钥从 auth-store 获取，不在 vault-store 中存储密钥
 *
 * M5 修复：按需解密 API。
 * - setVaultData 仍并发解密所有条目（向后兼容，列表视图可立即渲染）
 * - 额外保留 encryptedItemData Map（itemId → 加密 blob），供 lockItemData / decryptItemData 使用
 * - lockItemData(itemId)：清空 item.data 为 {}，减少敏感数据在内存中的暴露窗口
 * - decryptItemData(itemId, symmetricKey)：从 blob 重新解密，恢复 item.data
 * - 推荐组件在 unmount 时调用 lockItemData，mount 时调用 decryptItemData（如果 data 为空）
 *
 * @see TECHNICAL_DESIGN.md 6.2.3 节
 */
import { create } from 'zustand';
import { decrypt } from '@/lib/crypto/aes';
import type { EncryptedData } from '@/types/crypto';
import type { VaultData } from '@/types/api';
import type {
  DecryptedVault,
  DecryptedItem,
  DecryptedTag,
  ItemData,
} from '@/types/vault';

/** AAD 前缀常量 — 与条目表单加密时保持一致 */
const TITLE_AAD_PREFIX = 'item:';
const TITLE_AAD_SUFFIX = ':title';
const DATA_AAD_PREFIX = 'item:';
const DATA_AAD_SUFFIX = ':data';

/** item_type_id -> code 映射（与 migrate.ts 预置数据一致） */
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
  17: 'ssh_key',
};

/** 保险库名称解密 AAD */
const VAULT_NAME_AAD = 'passbox:vault-name:v1';

/**
 * 加密条目数据 blob（M5 修复：按需解密用）。
 *
 * key: itemId
 * value: { dataEncrypted, dataAad } — 用于 lockItemData 后重新解密
 */
interface EncryptedItemBlob {
  dataEncrypted: EncryptedData;
  dataAad: string;
}

export interface VaultStore {
  // ---- 状态 ----
  vaults: DecryptedVault[];
  items: DecryptedItem[];
  tags: DecryptedTag[];
  /**
   * M5 修复：加密条目数据 blob 缓存（itemId → blob）。
   * 供 lockItemData / decryptItemData 使用，不在组件中直接读取。
   */
  encryptedItemData: Map<string, EncryptedItemBlob>;
  /** 是否已加载数据 */
  loaded: boolean;
  /** 是否正在加载/解密 */
  loading: boolean;
  /** 搜索关键词（T4.7，本地搜索，不上传服务端） */
  searchQuery: string;

  // ---- 操作 ----
  /**
   * 接收密文 + Symmetric Key，批量解密并缓存。
   */
  setVaultData: (cipherData: VaultData, symmetricKey: CryptoKey) => Promise<void>;

  /**
   * 新增/更新单条解密后的条目（创建/编辑后调用）。
   */
  upsertItem: (item: DecryptedItem) => void;

  /**
   * 从缓存移除条目（删除后调用）。
   */
  removeItem: (itemId: string) => void;

  /**
   * 批量从缓存移除条目（批量删除后调用）。
   */
  removeItems: (itemIds: string[]) => void;

  /**
   * 批量更新条目所属保险库（批量移动后调用）。
   */
  updateItemsVault: (itemIds: string[], vaultId: string) => void;

  /**
   * 更新条目收藏状态。
   */
  updateFavorite: (itemId: string, isFavorite: boolean) => void;

  /**
   * 设置搜索关键词（T4.7）。
   */
  setSearchQuery: (query: string) => void;

  /**
   * 新增/更新保险库（创建/重命名后调用）。
   */
  upsertVault: (vault: DecryptedVault) => void;

  /**
   * 从缓存移除保险库（删除后调用）。
   */
  removeVault: (vaultId: string) => void;

  /**
   * 新增/更新标签（创建/重命名后调用）。
   */
  upsertTag: (tag: DecryptedTag) => void;

  /**
   * 从缓存移除标签（删除后调用）。
   */
  removeTag: (tagId: string) => void;

  /**
   * 清空所有缓存（锁定时调用）。
   */
  clear: () => void;

  /**
   * 修复 P1：请求重新拉取密码库数据（不清空现有缓存，避免 UI 闪烁）。
   *
   * 用于跨页面操作（如回收站恢复条目）后通知 vault-view 重新拉取数据。
   * vault-view 的数据加载 useEffect 监听 loaded 字段，loaded=false 时会触发重载。
   */
  requestReload: () => void;

  /**
   * M5 修复：清空指定条目的敏感数据（data 字段），减少内存中明文密码暴露窗口。
   *
   * 调用后 item.data 变为 {}，但 title / metadata / encryptedItemData blob 仍保留。
   * 列表视图不依赖 data 字段以外的内容时仍可显示标题。
   *
   * 推荐在 item detail 组件 unmount 时调用。
   */
  lockItemData: (itemId: string) => void;

  /**
   * M5 修复：从 encryptedItemData blob 重新解密 item.data。
   *
   * 在 lockItemData 调用后，组件重新打开条目详情时调用以恢复 data。
   *
   * @param itemId 条目 ID
   * @param symmetricKey 对称密钥（从 auth-store 获取）
   * @returns true 表示成功恢复；false 表示未找到 blob 或解密失败
   */
  decryptItemData: (itemId: string, symmetricKey: CryptoKey) => Promise<boolean>;
}

/**
 * 安全解析 JSON 字符串为 EncryptedData。
 * 数据库中 encrypted 字段以 TEXT 存储（JSON string），需要 parse。
 */
function parseEncrypted(raw: string): EncryptedData {
  return JSON.parse(raw) as EncryptedData;
}

/**
 * 解密保险库名称。
 */
async function decryptVaultName(
  nameEncrypted: string,
  symmetricKey: CryptoKey,
): Promise<string> {
  try {
    return await decrypt(symmetricKey, parseEncrypted(nameEncrypted), VAULT_NAME_AAD);
  } catch {
    return '未知保险库';
  }
}

/**
 * 解密单个条目。
 */
async function decryptItem(
  item: {
    id: string;
    vault_id: string;
    item_type_id: number;
    title_encrypted: string;
    data_encrypted: string;
    is_favorite: boolean;
    created_at: string;
    updated_at: string;
    deleted_at: string | null;
  },
  symmetricKey: CryptoKey,
  tagIds: string[],
): Promise<DecryptedItem> {
  const titleEncrypted = parseEncrypted(item.title_encrypted);
  const dataEncrypted = parseEncrypted(item.data_encrypted);

  const [title, dataStr] = await Promise.all([
    decrypt(symmetricKey, titleEncrypted, `${TITLE_AAD_PREFIX}${item.id}${TITLE_AAD_SUFFIX}`),
    decrypt(symmetricKey, dataEncrypted, `${DATA_AAD_PREFIX}${item.id}${DATA_AAD_SUFFIX}`),
  ]);

  let data: ItemData;
  try {
    data = JSON.parse(dataStr) as ItemData;
  } catch {
    data = {};
  }

  return {
    id: item.id,
    vaultId: item.vault_id,
    itemTypeId: item.item_type_id,
    itemTypeCode: ITEM_TYPE_CODE_MAP[item.item_type_id] ?? 'login',
    title,
    data,
    isFavorite: item.is_favorite,
    createdAt: item.created_at,
    updatedAt: item.updated_at,
    deletedAt: item.deleted_at,
    tagIds,
  };
}

export const useVaultStore = create<VaultStore>((set, get) => ({
  vaults: [],
  items: [],
  tags: [],
  encryptedItemData: new Map(),
  loaded: false,
  loading: false,
  searchQuery: '',

  setVaultData: async (cipherData, symmetricKey) => {
    set({ loading: true });
    try {
      // 并发解密所有保险库名称
      const vaults = await Promise.all(
        cipherData.vaults.map(async (v) => ({
          id: v.id,
          name: await decryptVaultName(v.name_encrypted, symmetricKey),
          displayOrder: v.display_order,
          createdAt: v.created_at,
          updatedAt: v.updated_at,
        })),
      );

      // 构建 itemId → tagIds 映射（基于 getVaultData 返回的 item_tags 关联）
      const itemTagMap = new Map<string, string[]>();
      for (const rel of cipherData.itemTags) {
        const list = itemTagMap.get(rel.itemId);
        if (list) {
          list.push(rel.tagId);
        } else {
          itemTagMap.set(rel.itemId, [rel.tagId]);
        }
      }

      // 并发解密所有条目
      const items = await Promise.all(
        cipherData.items.map((item) =>
          decryptItem(item, symmetricKey, itemTagMap.get(item.id) ?? []),
        ),
      );

      // M5 修复：保留加密 blob 供按需解密使用
      const encryptedItemData = new Map<string, EncryptedItemBlob>();
      for (const item of cipherData.items) {
        encryptedItemData.set(item.id, {
          dataEncrypted: parseEncrypted(item.data_encrypted),
          dataAad: `${DATA_AAD_PREFIX}${item.id}${DATA_AAD_SUFFIX}`,
        });
      }

      // 标签名称明文存储，无需解密
      const tags: DecryptedTag[] = cipherData.tags.map((t) => ({
        id: t.id,
        name: t.name,
        createdAt: t.created_at,
      }));

      set({
        vaults,
        items,
        tags,
        encryptedItemData,
        loaded: true,
        loading: false,
      });
    } catch {
      set({ loading: false });
      throw new Error('解密密码库数据失败');
    }
  },

  upsertItem: (item) =>
    set((state) => {
      const index = state.items.findIndex((i) => i.id === item.id);
      if (index === -1) {
        // 新条目：插入到列表头部（按 updated_at DESC）
        return { items: [item, ...state.items] };
      }
      // 更新：替换并重新排序（移到头部）
      const newItems = [...state.items];
      newItems.splice(index, 1);
      return { items: [item, ...newItems] };
    }),

  removeItem: (itemId) =>
    set((state) => ({
      items: state.items.filter((i) => i.id !== itemId),
    })),

  removeItems: (itemIds) =>
    set((state) => {
      const idSet = new Set(itemIds);
      return {
        items: state.items.filter((i) => !idSet.has(i.id)),
      };
    }),

  updateItemsVault: (itemIds, vaultId) =>
    set((state) => {
      const idSet = new Set(itemIds);
      return {
        items: state.items.map((i) =>
          idSet.has(i.id) ? { ...i, vaultId, updatedAt: new Date().toISOString() } : i,
        ),
      };
    }),

  updateFavorite: (itemId, isFavorite) =>
    set((state) => ({
      items: state.items.map((i) =>
        i.id === itemId ? { ...i, isFavorite } : i,
      ),
    })),

  setSearchQuery: (query) => set({ searchQuery: query }),

  upsertVault: (vault) =>
    set((state) => {
      const index = state.vaults.findIndex((v) => v.id === vault.id);
      if (index === -1) {
        // 新保险库：按 displayOrder 插入合适位置
        const newVaults = [...state.vaults, vault];
        newVaults.sort((a, b) => a.displayOrder - b.displayOrder);
        return { vaults: newVaults };
      }
      // 更新：保持原位置
      const newVaults = [...state.vaults];
      newVaults[index] = vault;
      return { vaults: newVaults };
    }),

  removeVault: (vaultId) =>
    set((state) => ({
      vaults: state.vaults.filter((v) => v.id !== vaultId),
    })),

  upsertTag: (tag) =>
    set((state) => {
      const index = state.tags.findIndex((t) => t.id === tag.id);
      if (index === -1) {
        // 新标签：按 name 字母序插入
        const newTags = [...state.tags, tag];
        newTags.sort((a, b) => a.name.localeCompare(b.name));
        return { tags: newTags };
      }
      const newTags = [...state.tags];
      newTags[index] = tag;
      newTags.sort((a, b) => a.name.localeCompare(b.name));
      return { tags: newTags };
    }),

  removeTag: (tagId) =>
    set((state) => ({
      tags: state.tags.filter((t) => t.id !== tagId),
    })),

  clear: () =>
    set({
      vaults: [],
      items: [],
      tags: [],
      encryptedItemData: new Map(),
      loaded: false,
      loading: false,
      searchQuery: '',
    }),

  requestReload: () =>
    set({
      // 仅重置 loaded 标志，保留现有数据避免 UI 闪烁。
      // vault-view 的 useEffect 监听 loaded，会自动触发 getVaultData() 重新拉取并覆盖。
      loaded: false,
      loading: false,
    }),

  lockItemData: (itemId) =>
    set((state) => ({
      items: state.items.map((i) =>
        i.id === itemId ? { ...i, data: {} } : i,
      ),
    })),

  decryptItemData: async (itemId, symmetricKey) => {
    const blob = get().encryptedItemData.get(itemId);
    if (!blob) return false;

    try {
      const dataStr = await decrypt(symmetricKey, blob.dataEncrypted, blob.dataAad);
      const data = JSON.parse(dataStr) as ItemData;
      set((state) => ({
        items: state.items.map((i) =>
          i.id === itemId ? { ...i, data } : i,
        ),
      }));
      return true;
    } catch {
      return false;
    }
  },
}));
