/**
 * 密钥层级管理（密钥包装）(T2.5)
 *
 * 对应 TECHNICAL_DESIGN.md 3.3 节。
 * 实现 Master Key → Symmetric Key 的两层密钥层级：
 *
 *   Master Key（从主密码 Argon2id 派生，32B）
 *     │ AES-256-GCM 加密
 *     ▼
 *   Symmetric Key（随机 256-bit，加密所有条目数据）
 *
 *   Recovery Key（从恢复码 HKDF 派生，32B）
 *     │ AES-256-GCM 加密（另一份 Symmetric Key 副本）
 *     ▼
 *   Symmetric Key 副本（存储于 recovery_encrypted_key，用于主密码丢失恢复）
 *
 * 两条路径使用不同的 AAD 上下文标签，进一步绑定密文用途（域分离）。
 * Master Key 与 Recovery Key 不可交叉解密（密钥隔离，见 keys.test.ts）。
 *
 * 客户端使用；依赖 aes.ts / WebCrypto。
 */
import { encryptBytes, decryptToBytes } from './aes';
import type { EncryptedData } from './types';

/** Symmetric Key 长度（字节）——AES-256 */
export const SYMMETRIC_KEY_LENGTH = 32;

/** Master 路径密钥包装的 AAD 上下文标签 */
const MASTER_WRAP_AAD = 'passbox:symmetric-key:master:v1';
/** Recovery 路径密钥包装的 AAD 上下文标签 */
const RECOVERY_WRAP_AAD = 'passbox:symmetric-key:recovery:v1';

/**
 * 生成随机 Symmetric Key（256-bit AES-GCM CryptoKey）。
 *
 * 该密钥加密用户所有条目数据；注册时生成，仅以加密形式（encrypted_key）存储于服务端。
 * extractable=true：允许导出 raw 字节以便包装（注册 / 修改主密码时重新加密）。
 *
 * ⚠️ MVP 取舍：Symmetric Key 在浏览器内存中可提取。鉴于密钥仅存于受信同源 JS 上下文、
 * 且永不上传服务端，此选择可接受。未来可改为非提取 + 通过 decryptToBytes 直接获取 raw 重包装。
 */
export async function generateSymmetricKey(): Promise<CryptoKey> {
  return crypto.subtle.generateKey(
    { name: 'AES-GCM', length: 256 },
    true, // extractable
    ['encrypt', 'decrypt'],
  );
}

/**
 * 将原始字节导入为 AES-GCM CryptoKey（非提取）。
 * 用于 Master Key / Recovery Key——这两把密钥仅用于加解密 Symmetric Key，不可导出。
 *
 * @param rawKey 32 字节原始密钥
 */
export async function importKey(rawKey: Uint8Array): Promise<CryptoKey> {
  return crypto.subtle.importKey(
    'raw',
    rawKey.slice(), // BufferSource
    { name: 'AES-GCM' },
    false, // 非提取
    ['encrypt', 'decrypt'],
  );
}

/** 导出 CryptoKey 为 raw 字节（内部使用，用于包装 Symmetric Key） */
async function exportRawKey(key: CryptoKey): Promise<Uint8Array> {
  const raw = await crypto.subtle.exportKey('raw', key);
  return new Uint8Array(raw);
}

/** 将 raw 字节导入为可提取的 Symmetric Key CryptoKey（解包后使用） */
async function importSymmetricKey(rawKey: Uint8Array): Promise<CryptoKey> {
  return crypto.subtle.importKey(
    'raw',
    rawKey.slice(),
    { name: 'AES-GCM' },
    true, // 可提取：允许后续修改主密码时重新包装
    ['encrypt', 'decrypt'],
  );
}

/**
 * 用 Master Key 加密 Symmetric Key（注册 / 修改主密码时）。
 *
 * @param masterKey 32 字节 Master Key（由 deriveMasterKey 派生）
 * @param symmetricKey 待包装的 Symmetric Key（CryptoKey，可提取）
 * @returns EncryptedData（存储为 users.encrypted_key）
 */
export async function encryptSymmetricKey(
  masterKey: Uint8Array,
  symmetricKey: CryptoKey,
): Promise<EncryptedData> {
  const aesKey = await importKey(masterKey);
  const rawSymKey = await exportRawKey(symmetricKey);
  return encryptBytes(aesKey, rawSymKey, MASTER_WRAP_AAD);
}

/**
 * 用 Master Key 解密 Symmetric Key（登录 / 解锁时）。
 *
 * @param masterKey 32 字节 Master Key
 * @param data EncryptedData（users.encrypted_key）
 * @returns Symmetric Key CryptoKey（可提取）
 */
export async function decryptSymmetricKey(
  masterKey: Uint8Array,
  data: EncryptedData,
): Promise<CryptoKey> {
  const aesKey = await importKey(masterKey);
  const rawSymKey = await decryptToBytes(aesKey, data, MASTER_WRAP_AAD);
  return importSymmetricKey(rawSymKey);
}

/**
 * 用 Recovery Key 加密 Symmetric Key 的恢复副本（注册时）。
 *
 * @param recoveryKey 32 字节 Recovery Key（由 deriveRecoveryKey 派生）
 * @param symmetricKey 待包装的 Symmetric Key
 * @returns EncryptedData（存储为 users.recovery_encrypted_key）
 */
export async function encryptSymmetricKeyWithRecovery(
  recoveryKey: Uint8Array,
  symmetricKey: CryptoKey,
): Promise<EncryptedData> {
  const aesKey = await importKey(recoveryKey);
  const rawSymKey = await exportRawKey(symmetricKey);
  return encryptBytes(aesKey, rawSymKey, RECOVERY_WRAP_AAD);
}

/**
 * 用 Recovery Key 解密 Symmetric Key 的恢复副本（数据恢复流程）。
 *
 * @param recoveryKey 32 字节 Recovery Key
 * @param data EncryptedData（users.recovery_encrypted_key）
 * @returns Symmetric Key CryptoKey
 */
export async function decryptSymmetricKeyWithRecovery(
  recoveryKey: Uint8Array,
  data: EncryptedData,
): Promise<CryptoKey> {
  const aesKey = await importKey(recoveryKey);
  const rawSymKey = await decryptToBytes(aesKey, data, RECOVERY_WRAP_AAD);
  return importSymmetricKey(rawSymKey);
}
