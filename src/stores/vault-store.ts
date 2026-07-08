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
};

/** 保险库名称解密 AAD */
const VAULT_NAME_AAD = 'passbox:vault-name:v1';

export interface VaultStore {
  // ---- 状态 ----
  vaults: DecryptedVault[];
  items: DecryptedItem[];
  tags: DecryptedTag[];
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
   * 更新条目收藏状态。
   */
  updateFavorite: (itemId: string, isFavorite: boolean) => void;

  /**
   * 设置搜索关键词（T4.7）。
   */
  setSearchQuery: (query: string) => void;

  /**
   * 清空所有缓存（锁定时调用）。
   */
  clear: () => void;
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
    tagIds,
  };
}

export const useVaultStore = create<VaultStore>((set) => ({
  vaults: [],
  items: [],
  tags: [],
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

      // 构建 itemId → tagIds 映射（需要从 item_tags 查询，但当前 VaultData 不含 item_tags）
      // item_tags 关系暂时不返回，标签关联通过条目编辑时维护
      // 后续可在 getVaultData 中补充 item_tags 查询
      const itemTagMap = new Map<string, string[]>();

      // 并发解密所有条目
      const items = await Promise.all(
        cipherData.items.map((item) =>
          decryptItem(item, symmetricKey, itemTagMap.get(item.id) ?? []),
        ),
      );

      // 标签名称明文存储，无需解密
      const tags: DecryptedTag[] = cipherData.tags.map((t) => ({
        id: t.id,
        name: t.name,
        createdAt: t.created_at,
      }));

      set({ vaults, items, tags, loaded: true, loading: false });
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

  updateFavorite: (itemId, isFavorite) =>
    set((state) => ({
      items: state.items.map((i) =>
        i.id === itemId ? { ...i, isFavorite } : i,
      ),
    })),

  setSearchQuery: (query) => set({ searchQuery: query }),

  clear: () =>
    set({
      vaults: [],
      items: [],
      tags: [],
      loaded: false,
      loading: false,
      searchQuery: '',
    }),
}));
