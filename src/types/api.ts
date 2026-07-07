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
 *
 * ⚠️ 实现偏差（相对 TECHNICAL_DESIGN 5.2.1 / 7.1）：
 * 设计文档写"服务端生成恢复码"，但客户端需要在注册请求中同时提交
 * recoveryEncryptedKey（用恢复码派生 Recovery Key 加密的 Symmetric Key 副本）。
 * 若服务端生成恢复码并返回，客户端需第二次请求上传 recoveryEncryptedKey，
 * 存在中途断开导致恢复路径缺失的风险。因此改为客户端生成恢复码，
 * 将 recoveryCode + recoveryEncryptedKey 一并提交，服务端仅做 bcrypt 哈希。
 * 安全等价：服务端仍只存 bcrypt 哈希，明文恢复码仅在注册响应中返回一次。
 *
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
  /**
   * 恢复码明文（PBOX-XXXX-XXXX-XXXX-XXXX），客户端生成。
   * 服务端 bcrypt 哈希后存入 recovery_code_hash，明文不落库。
   */
  recoveryCode: string;
  /**
   * Recovery Key 加密的 Symmetric Key 副本，用于主密码丢失后数据恢复。
   * 客户端用恢复码派生 Recovery Key（HKDF），再加密 Symmetric Key 得到此密文。
   */
  recoveryEncryptedKey: EncryptedData;
  /**
   * 默认保险库名称密文（客户端用 Symmetric Key 加密，如 "个人保险库"）。
   * 零知识架构下服务端无法加密，必须由客户端提供。
   */
  defaultVaultNameEncrypted: EncryptedData;
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
  /** 是否已开启 2FA（T6.1） */
  twoFactorEnabled: boolean;
}

/**
 * 恢复码验证请求（恢复流程第一阶段）
 *
 * 客户端提交邮箱 + 恢复码，服务端 bcrypt.compare 验证后返回
 * recovery_encrypted_key，客户端用 Recovery Key 解密得到 Symmetric Key。
 *
 * ⚠️ 实现偏差（相对 TASK_BREAKDOWN T3.8 API 契约）：
 * 设计文档仅列出单一 POST /api/auth/recover（重置阶段），但客户端需先获取
 * recovery_encrypted_key 才能计算 newEncryptedKey。因此拆分为两阶段：
 *   1. POST /api/auth/recover/verify —— 验证恢复码，返回 recovery_encrypted_key
 *   2. POST /api/auth/recover       —— 验证恢复码 + 重置主密码
 * 两阶段均独立 bcrypt 验证恢复码，安全等价。
 *
 * @see TECHNICAL_DESIGN.md 3.3.1 恢复码密钥路径
 */
export interface RecoverVerifyRequest {
  email: string;
  /** "PBOX-XXXX-XXXX-XXXX-XXXX" */
  recoveryCode: string;
}

/** 恢复码验证响应 */
export interface RecoverVerifyResponse {
  user: { id: string; email: string };
  /** Recovery Key 加密的 Symmetric Key 副本，客户端解密得到 Symmetric Key */
  recoveryEncryptedKey: EncryptedData;
}

/**
 * 恢复码重置请求（恢复流程第二阶段）
 *
 * M-15：恢复码轮换 — 重置主密码同时生成新恢复码，
 * 旧恢复码失效，防止恢复码被重复利用。
 *
 * @see TECHNICAL_DESIGN.md 3.3.1
 */
export interface RecoverRequest {
  email: string;
  /** "PBOX-XXXX-XXXX-XXXX-XXXX"，服务端再次 bcrypt 验证 */
  recoveryCode: string;
  /** base64(HKDF(newMasterKey, email, "passbox:auth:v1")) */
  newAuthHash: string;
  /** 新 Master Key 加密的 Symmetric Key */
  newEncryptedKey: EncryptedData;
  /** base64(16 bytes 新 salt) */
  newKdfSalt: string;
  newKdfParams: KdfParams;
  /** M-15：新恢复码明文，服务端 bcrypt 哈希后替换旧 recovery_code_hash */
  newRecoveryCode: string;
  /** M-15：新 Recovery Key 加密的 Symmetric Key 副本，替换旧 recovery_encrypted_key */
  newRecoveryEncryptedKey: EncryptedData;
}

/** 恢复码重置响应（设置新会话 Cookie） */
export interface RecoverResponse {
  user: { id: string; email: string };
  /** M-15：轮换后的新恢复码，仅返回一次，需展示给用户保存 */
  recoveryCode: string;
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
