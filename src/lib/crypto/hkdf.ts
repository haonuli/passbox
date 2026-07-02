/**
 * HKDF-SHA256 密钥派生模块 (T2.3)
 *
 * 对应 TECHNICAL_DESIGN.md 3.3 节。
 * 使用 WebCrypto 原生 `crypto.subtle.deriveBits` 实现 HKDF-SHA256，
 * 通过不同的 `info` 标签实现域分离（Domain Separation）：
 *   - Auth Hash 路径：info="passbox:auth:v1"，从 Master Key 派生认证凭证
 *   - Recovery Key 路径：info="passbox:recovery:v1"，从恢复码派生恢复密钥
 *
 * 两条路径的派生结果不可交叉使用（见 keys.ts 密钥隔离测试）。
 * salt 统一使用 email_normalized（小写 + trim），确保大小写/空格不影响派生一致性。
 *
 * 客户端使用；依赖浏览器 / Node 18+ 全局 crypto.subtle。
 */
import { stringToBytes } from './encoding';

/** HKDF 派生输出长度（字节）——Auth Hash 与 Recovery Key 均为 32 字节 */
export const HKDF_OUTPUT_LENGTH = 32;

/** 认证派生域分离标签 */
export const AUTH_HASH_INFO = 'passbox:auth:v1';
/** 恢复码派生域分离标签 */
export const RECOVERY_KEY_INFO = 'passbox:recovery:v1';

/**
 * 规范化 email 作为 HKDF salt。
 * 小写 + 去除首尾空白，确保 "User@Example.COM " 与 "user@example.com" 派生一致。
 */
export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

/**
 * HKDF-SHA256 派生核心。
 *
 * @param ikm 输入密钥材料（Master Key 或恢复码）
 * @param salt 邮箱（将规范化）
 * @param info 域分离标签
 * @param lengthBytes 输出字节数
 * @returns 派生密钥（Uint8Array）
 */
async function hkdfDerive(
  ikm: Uint8Array,
  salt: string,
  info: string,
  lengthBytes: number,
): Promise<Uint8Array> {
  // .slice() 拷贝为 ArrayBuffer 支撑的 Uint8Array，满足 WebCrypto BufferSource 类型
  // （TS 5.7+ Uint8Array 泛型为 ArrayBufferLike，含 SharedArrayBuffer；WebCrypto 仅接受 ArrayBuffer）
  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    ikm.slice(),
    { name: 'HKDF' },
    false,
    ['deriveBits'],
  );

  const derived = await crypto.subtle.deriveBits(
    {
      name: 'HKDF',
      hash: 'SHA-256',
      salt: stringToBytes(normalizeEmail(salt)).slice(),
      info: stringToBytes(info).slice(),
    },
    keyMaterial,
    lengthBytes * 8, // bits
  );

  return new Uint8Array(derived);
}

/**
 * 从 Master Key 派生 Auth Hash（认证凭证）。
 *
 * Auth Hash 上传服务端，经 bcrypt 哈希后存储为 password_hash。
 * 主密码本身永不上传；Auth Hash 经 Argon2id + HKDF 双重派生，离线破解成本极高。
 *
 * @param masterKey 32 字节 Master Key（由 deriveMasterKey 派生）
 * @param email 用户邮箱（作为 HKDF salt）
 * @returns 32 字节 Auth Hash
 */
export async function deriveAuthHash(
  masterKey: Uint8Array,
  email: string,
): Promise<Uint8Array> {
  return hkdfDerive(masterKey, email, AUTH_HASH_INFO, HKDF_OUTPUT_LENGTH);
}

/**
 * 从恢复码派生 Recovery Key（数据恢复密钥）。
 *
 * 恢复码本身是 20 字节高熵随机数，无需慢哈希；HKDF-SHA256 即可派生。
 * Recovery Key 用于加解密 Symmetric Key 的恢复副本（recovery_encrypted_key）。
 * 与 Auth Hash 路径域分离（info 标签不同），密钥不可交叉使用。
 *
 * @param recoveryCode 20 字节恢复码
 * @param email 用户邮箱（作为 HKDF salt）
 * @returns 32 字节 Recovery Key
 */
export async function deriveRecoveryKey(
  recoveryCode: Uint8Array,
  email: string,
): Promise<Uint8Array> {
  return hkdfDerive(recoveryCode, email, RECOVERY_KEY_INFO, HKDF_OUTPUT_LENGTH);
}
