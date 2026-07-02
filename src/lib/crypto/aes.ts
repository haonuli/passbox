/**
 * AES-256-GCM 加解密模块 (T2.4)
 *
 * 对应 TECHNICAL_DESIGN.md 3.4 节。
 * 使用 WebCrypto 原生 `crypto.subtle.encrypt/decrypt` 实现 AES-256-GCM 认证加密：
 *   - 每次加密生成 12 字节随机 IV（GCM 标准 nonce 长度）
 *   - 支持 AAD（Additional Authenticated Data）绑定上下文，解密时 AAD 不匹配则失败
 *   - GCM 认证标签（16 字节）自动附加于密文末尾，篡改检测由 decrypt 抛出异常保证
 *   - 输出统一 EncryptedData JSON 格式 { v:1, iv:base64, ct:base64 }
 *
 * 同时提供 string 与 Uint8Array 两种明文入口：
 *   - encrypt/decrypt：用于条目标题、payload 等文本数据
 *   - encryptBytes/decryptToBytes：用于 Symmetric Key 等原始字节包装（见 keys.ts）
 *
 * 客户端使用；依赖浏览器 / Node 18+ 全局 crypto.subtle。
 */
import { getRandomBytes } from './random';
import { toBase64, fromBase64, stringToBytes, bytesToString } from './encoding';
import type { EncryptedData } from './types';

/** AES-GCM IV / Nonce 长度（字节）——GCM 标准推荐 12 字节 */
export const AES_GCM_IV_LENGTH = 12;

/** EncryptedData 格式版本号 */
const FORMAT_VERSION = 1 as const;

/**
 * 校验 EncryptedData 结构完整性。
 * @throws Error 当版本号不符或 iv/ct 缺失时
 */
function assertEncryptedData(data: EncryptedData): void {
  if (data.v !== FORMAT_VERSION) {
    throw new Error(`不支持的 EncryptedData 版本: ${data.v}（当前仅支持 ${FORMAT_VERSION}）`);
  }
  if (typeof data.iv !== 'string' || typeof data.ct !== 'string') {
    throw new Error('EncryptedData 的 iv / ct 必须为 base64 字符串');
  }
}

/**
 * 使用 AES-256-GCM 加密原始字节。
 *
 * @param key AES-GCM CryptoKey（256-bit）
 * @param plaintext 明文字节
 * @param aad 附加认证数据（可选）；解密时必须提供相同的 aad 才能成功
 * @returns EncryptedData { v:1, iv:base64, ct:base64 }
 */
export async function encryptBytes(
  key: CryptoKey,
  plaintext: Uint8Array,
  aad?: string,
): Promise<EncryptedData> {
  const iv = getRandomBytes(AES_GCM_IV_LENGTH);

  const params: AesGcmParams = {
    name: 'AES-GCM',
    iv: iv.slice(), // BufferSource: 拷贝为 ArrayBuffer 支撑
  };
  if (aad !== undefined) {
    params.additionalData = stringToBytes(aad).slice();
  }

  const ciphertext = await crypto.subtle.encrypt(params, key, plaintext.slice());
  return {
    v: FORMAT_VERSION,
    iv: toBase64(iv),
    ct: toBase64(new Uint8Array(ciphertext)),
  };
}

/**
 * 使用 AES-256-GCM 解密为原始字节。
 *
 * @param key AES-GCM CryptoKey（256-bit）
 * @param data EncryptedData { v:1, iv, ct }
 * @param aad 附加认证数据（可选）；必须与加密时一致
 * @returns 明文字节
 * @throws Error 当版本号不符 / AAD 不匹配 / 密文或 IV 被篡改时（GCM 认证失败）
 */
export async function decryptToBytes(
  key: CryptoKey,
  data: EncryptedData,
  aad?: string,
): Promise<Uint8Array> {
  assertEncryptedData(data);

  const iv = fromBase64(data.iv);
  const ct = fromBase64(data.ct);

  const params: AesGcmParams = {
    name: 'AES-GCM',
    iv: iv.slice(),
  };
  if (aad !== undefined) {
    params.additionalData = stringToBytes(aad).slice();
  }

  const plaintext = await crypto.subtle.decrypt(params, key, ct.slice());
  return new Uint8Array(plaintext);
}

/**
 * 使用 AES-256-GCM 加密字符串（UTF-8）。
 * 用于条目标题、payload 等文本数据。
 */
export async function encrypt(
  key: CryptoKey,
  plaintext: string,
  aad?: string,
): Promise<EncryptedData> {
  return encryptBytes(key, stringToBytes(plaintext), aad);
}

/**
 * 使用 AES-256-GCM 解密为字符串（UTF-8）。
 */
export async function decrypt(
  key: CryptoKey,
  data: EncryptedData,
  aad?: string,
): Promise<string> {
  return bytesToString(await decryptToBytes(key, data, aad));
}
