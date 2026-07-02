/**
 * 加密相关类型定义 (T1.4)
 *
 * 对应 TECHNICAL_DESIGN.md 第 3.5-3.6 节加密方案。
 * 所有加密字段的统一格式为 EncryptedData JSON。
 */

/**
 * 加密数据统一格式
 *
 * 所有加密字段（标题、payload、保险库名称、Symmetric Key 等）均使用此格式。
 * 存储为 TEXT 列或 JSON string。
 *
 * @see TECHNICAL_DESIGN.md 3.6 节
 */
export interface EncryptedData {
  /** 格式版本号，便于未来算法迁移 */
  v: 1;
  /** base64(12 bytes AES-GCM nonce) */
  iv: string;
  /** base64(ciphertext + 16 bytes GCM auth tag) */
  ct: string;
}

/**
 * KDF 参数（API 传输用，与 KdfConfig 区分）
 *
 * 用于 RegisterRequest / PreloginResponse / LoginResponse / SessionResponse。
 * 不含 salt（salt 单独传输）。
 */
export interface KdfParams {
  type: 'argon2id';
  memoryKib: number;
  iterations: number;
  parallelism: number;
}

/**
 * KDF 配置（内部加密模块用）
 *
 * 用于 crypto 模块调用 libsodium crypto_pwhash。
 * salt 在此对象中，memoryCost/timeCost/parallelism 对应 libsodium 参数。
 *
 * @see TECHNICAL_DESIGN.md 3.2 节
 */
export interface KdfConfig {
  /** 16 bytes (crypto_pwhash_SALTBYTES) */
  salt: Uint8Array;
  /** 65536 (KiB)，调用 sodium API 时需 * 1024 转为字节 */
  memoryCost: number;
  /** 3 (libsodium opsLimit) */
  timeCost: number;
  /** 4 */
  parallelism: number;
}

/**
 * 密码强度评估结果
 *
 * 基于 zxcvbn-ts 评估，用于注册/修改密码时的前端反馈。
 */
export interface StrengthResult {
  /** 0-4 分，0 最弱，4 最强 */
  score: 0 | 1 | 2 | 3 | 4;
  /** 警告信息（空字符串表示无警告） */
  warning: string;
  /** 改进建议列表 */
  suggestions: string[];
  /** 预估破解时间（秒），用于显示 "需 X 年破解" */
  crackTimeSeconds: number;
}
