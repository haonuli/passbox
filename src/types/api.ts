/**
 * API 请求/响应类型定义 (T1.4)
 *
 * 对应 TECHNICAL_DESIGN.md 第 5 章 API 契约。
 * Server Actions 与 Route Handler 共用这些类型。
 */

import type { EncryptedData, KdfParams } from './crypto';
import type { VaultRow, ItemRow, TagRow } from './db';

/**
 * 统一操作结果（Server Actions 返回类型）
 *
 * 使用联合类型实现可区分联合（discriminated union），
 * 调用方通过 `ok` 字段收窄类型。
 *
 * @example
 * const result = await createUser(input);
 * if (result.ok) {
 *   console.log(result.data);  // T 类型
 * } else {
 *   console.error(result.error);  // string
 * }
 */
export type ActionResult<T = undefined> =
  | { ok: true; data: T }
  | { ok: false; error: string };

// ============================================================
// 认证相关
// ============================================================

/**
 * 注册请求
 * @see TECHNICAL_DESIGN.md 5.2.1
 */
export interface RegisterRequest {
  email: string;
  /** base64(HKDF(MasterKey, email, "passbox:auth:v1")) */
  authHash: string;
  /** Master Key 加密的 Symmetric Key */
  encryptedKey: EncryptedData;
  /** base64(16 bytes salt) */
  kdfSalt: string;
  kdfParams: KdfParams;
}

/**
 * 注册响应
 * @see TECHNICAL_DESIGN.md 5.2.1
 */
export interface RegisterResponse {
  user: { id: string; email: string };
  /** "PBOX-XXXX-XXXX-XXXX-XXXX-XXXX"，仅返回一次 */
  recoveryCode: string;
  defaultVaultId: string;
}

/**
 * 预登录响应（获取 KDF 参数）
 * @see TECHNICAL_DESIGN.md 5.2.2
 */
export interface PreloginResponse {
  /** base64(16 bytes salt) */
  kdfSalt: string;
  kdfParams: KdfParams;
}

/**
 * 登录请求
 * @see TECHNICAL_DESIGN.md 5.2.3
 */
export interface LoginRequest {
  email: string;
  /** base64 */
  authHash: string;
  /** P1: 开启 2FA 时需传 */
  totpCode?: string;
}

/**
 * 登录响应
 * @see TECHNICAL_DESIGN.md 5.2.3
 */
export interface LoginResponse {
  user: { id: string; email: string };
  /** 客户端用 Master Key 解密得到 Symmetric Key */
  encryptedKey: EncryptedData;
  kdfSalt: string;
  kdfParams: KdfParams;
}

/**
 * 2FA 挑战响应（登录需要 TOTP 验证时返回）
 * @see TECHNICAL_DESIGN.md 5.2.3
 */
export interface TotpChallengeResponse {
  challenge: 'totp_required';
  /** ticket 用于后续 2FA 验证 */
  ticket: string;
}

/**
 * 会话查询响应（已登录用户恢复会话）
 * @see TECHNICAL_DESIGN.md 5.2.4
 */
export interface SessionResponse {
  user: { id: string; email: string };
  encryptedKey: EncryptedData;
  kdfSalt: string;
  kdfParams: KdfParams;
}

/**
 * API 错误响应（Route Handler 统一格式）
 * @see TECHNICAL_DESIGN.md 5.4
 */
export interface ApiErrorResponse {
  error: string;
  /** 机器可读错误码，如 'EMAIL_EXISTS' / 'INVALID_CREDENTIALS' */
  code?: string;
  /** 账户锁定时返回（ISO 时间戳） */
  lockedUntil?: string;
}

// ============================================================
// Server Actions 类型签名
// ============================================================

/**
 * 获取当前用户所有保险库 + 条目（密文）
 * @see TECHNICAL_DESIGN.md 5.3
 */
export interface VaultData {
  vaults: VaultRow[];
  items: ItemRow[];
  tags: TagRow[];
}

/**
 * 创建条目输入
 * @see TECHNICAL_DESIGN.md 5.3
 */
export interface CreateItemInput {
  vaultId: string;
  itemTypeId: number;
  titleEncrypted: EncryptedData;
  dataEncrypted: EncryptedData;
  tagIds: string[];
}

/**
 * 更新条目输入（所有字段可选）
 * @see TECHNICAL_DESIGN.md 5.3
 */
export interface UpdateItemInput {
  vaultId?: string;
  titleEncrypted?: EncryptedData;
  dataEncrypted?: EncryptedData;
  tagIds?: string[];
}
