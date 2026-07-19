/**
 * 扩展共享类型定义
 */

/** 加密数据结构（与 Web App 一致） */
export interface EncryptedData {
  v: 1;
  iv: string;
  ct: string;
}

/** KDF 参数 */
export interface KdfParams {
  memoryKib: number;
  iterations: number;
  parallelism: number;
}

/** KDF 配置 */
export interface KdfConfig {
  salt: Uint8Array;
  memoryKib: number;
  iterations: number;
  parallelism: number;
}

/** 解密后的条目（简化版） */
export interface VaultItem {
  id: string;
  vaultId: string;
  itemTypeId: number;
  itemTypeCode: string;
  title: string;
  data: {
    url?: string;
    username?: string;
    password?: string;
    totpSecret?: string;
    notes?: string;
    [key: string]: string | undefined;
  };
  isFavorite: boolean;
  tagIds: string[];
}

/** 解密后的保险库 */
export interface Vault {
  id: string;
  name: string;
}

/** 扩展缓存数据
 *
 * H1 修复：symmetricKey 仅保留在 background service worker 内存中，
 * 不再以 base64 形式持久化到 chrome.storage.session。
 * 原因：导出 CryptoKey 为可序列化字符串违反零知识架构，
 * 任何获得 storage 权限的扩展都能读取并还原密钥。
 */
export interface ExtensionCache {
  vaults: Vault[];
  items: VaultItem[];
  lastUnlockAt: number;
}

/**
 * 自动填充用的身份信息（对应 itemTypeCode = 'identity'）
 *
 * 字段名与 Web App src/lib/item-types.ts identity 类型字段保持一致。
 */
export interface FillIdentity {
  id: string;
  title: string;
  firstName: string;
  lastName: string;
  address: string;
  city: string;
  state: string;
  zip: string;
  country: string;
  phone: string;
  email: string;
}

/**
 * 自动填充用的信用卡（对应 itemTypeCode = 'credit_card'）
 *
 * 字段名与 Web App src/lib/item-types.ts credit_card 类型字段保持一致。
 */
export interface FillCard {
  id: string;
  title: string;
  cardholder: string;
  cardNumber: string;
  expiry: string;
  cvv: string;
}

/** 消息类型 */
export type Message =
  | { type: 'GET_STATUS' }
  | { type: 'LOGIN'; email: string; masterPassword: string }
  | { type: 'UNLOCK'; masterPassword: string }
  | { type: 'LOCK' }
  | { type: 'GET_ITEMS'; query?: string }
  | { type: 'FILL'; domain: string }
  | { type: 'FILL_IDENTITY' }
  | { type: 'FILL_CARD' }
  | { type: 'SAVE_DETECTED'; domain: string; username: string; password: string }
  | { type: 'COPY_PASSWORD'; itemId: string };

/** 消息响应 */
export type MessageResponse<T = unknown> =
  | { ok: true; data: T }
  | { ok: false; error: string };

/** 扩展状态 */
export type ExtensionStatus = 'locked' | 'unlocked' | 'logged_out';
