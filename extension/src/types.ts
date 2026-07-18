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

/** 扩展缓存数据 */
export interface ExtensionCache {
  symmetricKeyBase64: string;
  vaults: Vault[];
  items: VaultItem[];
  lastUnlockAt: number;
}

/** 消息类型 */
export type Message =
  | { type: 'GET_STATUS' }
  | { type: 'LOGIN'; email: string; masterPassword: string }
  | { type: 'UNLOCK'; masterPassword: string }
  | { type: 'LOCK' }
  | { type: 'GET_ITEMS'; query?: string }
  | { type: 'FILL'; domain: string }
  | { type: 'SAVE_DETECTED'; domain: string; username: string; password: string }
  | { type: 'COPY_PASSWORD'; itemId: string };

/** 消息响应 */
export type MessageResponse<T = unknown> =
  | { ok: true; data: T }
  | { ok: false; error: string };

/** 扩展状态 */
export type ExtensionStatus = 'locked' | 'unlocked' | 'logged_out';
