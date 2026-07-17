/**
 * 安全共享链接加解密模块
 *
 * 独立于主加密系统（src/lib/crypto/aes.ts），用于共享链接场景。
 * 使用 WebCrypto API（crypto.subtle）实现 AES-256-GCM 认证加密。
 *
 * 密文格式：base64(iv) + '.' + base64(ciphertext)
 * - IV：12 字节随机数（GCM 标准 nonce 长度）
 * - 密文：含 16 字节 GCM 认证标签
 *
 * 依赖浏览器 / Node 18+ 全局 crypto.subtle。
 *
 * @see docs/SHARE_LINK_DESIGN.md
 */
import { toBase64, fromBase64, stringToBytes, bytesToString } from '@/lib/crypto/encoding';
import { getRandomBytes } from '@/lib/crypto/random';

/** AES-GCM IV / Nonce 长度（字节） */
const SHARE_IV_LENGTH = 12;

/** AES-256 密钥长度（字节） */
const SHARE_KEY_LENGTH = 32;

/**
 * 生成随机 256-bit AES 密钥，返回 base64 编码。
 *
 * @returns base64 编码的 32 字节随机密钥
 */
export async function generateShareKey(): Promise<string> {
  const keyBytes = getRandomBytes(SHARE_KEY_LENGTH);
  return toBase64(keyBytes);
}

/**
 * 用 base64 密钥加密字符串，返回 base64(iv).base64(ciphertext)。
 *
 * @param keyBase64 base64 编码的 AES-256 密钥
 * @param plaintext 明文字符串
 * @returns base64(iv).base64(ciphertext) 格式的密文
 */
export async function encryptShareData(keyBase64: string, plaintext: string): Promise<string> {
  const keyBytes = fromBase64(keyBase64);

  const key = await crypto.subtle.importKey(
    'raw',
    keyBytes.slice(),
    { name: 'AES-GCM' },
    false,
    ['encrypt'],
  );

  const iv = getRandomBytes(SHARE_IV_LENGTH);

  const ciphertext = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv: iv.slice() },
    key,
    stringToBytes(plaintext).slice(),
  );

  return `${toBase64(iv)}.${toBase64(new Uint8Array(ciphertext))}`;
}

/**
 * 用 base64 密钥解密 base64(iv).base64(ciphertext)，返回明文。
 *
 * @param keyBase64 base64 编码的 AES-256 密钥
 * @param encrypted base64(iv).base64(ciphertext) 格式的密文
 * @returns 明文字符串
 * @throws Error 当密钥不匹配、密文被篡改或格式错误时（GCM 认证失败）
 */
export async function decryptShareData(keyBase64: string, encrypted: string): Promise<string> {
  const dotIndex = encrypted.indexOf('.');
  if (dotIndex === -1) {
    throw new Error('密文格式无效：缺少分隔符 "."');
  }

  const ivBase64 = encrypted.slice(0, dotIndex);
  const ctBase64 = encrypted.slice(dotIndex + 1);

  const keyBytes = fromBase64(keyBase64);
  const iv = fromBase64(ivBase64);
  const ct = fromBase64(ctBase64);

  const key = await crypto.subtle.importKey(
    'raw',
    keyBytes.slice(),
    { name: 'AES-GCM' },
    false,
    ['decrypt'],
  );

  const plaintext = await crypto.subtle.decrypt(
    { name: 'AES-GCM', iv: iv.slice() },
    key,
    ct.slice(),
  );

  return bytesToString(new Uint8Array(plaintext));
}
