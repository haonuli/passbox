/**
 * 扩展加密模块（自包含，不依赖 Web App 源码）
 *
 * 使用 libsodium-wrappers-sumo（Argon2id）和 WebCrypto（AES-256-GCM, HKDF）
 * 实现与 Web App 相同的加密逻辑。
 */
import sodium from 'libsodium-wrappers-sumo';
import type { EncryptedData, KdfParams } from '../types';

let sodiumReady = false;

async function ensureSodium(): Promise<void> {
  if (!sodiumReady) {
    await sodium.ready;
    sodiumReady = true;
  }
}

/** Base64 编解码 */
function toBase64(bytes: Uint8Array): string {
  return btoa(String.fromCharCode(...bytes));
}

function fromBase64(str: string): Uint8Array {
  return new Uint8Array(
    atob(str)
      .split('')
      .map((c) => c.charCodeAt(0)),
  );
}

function stringToBytes(str: string): Uint8Array {
  return new TextEncoder().encode(str);
}

function bytesToString(bytes: Uint8Array): string {
  return new TextDecoder().decode(bytes);
}

/** 生成随机字节 */
function getRandomBytes(length: number): Uint8Array {
  return crypto.getRandomValues(new Uint8Array(length));
}

/**
 * 将 Uint8Array 转换为 BufferSource（WebCrypto 兼容）
 *
 * TypeScript 5.7+ 中 Uint8Array 变为泛型 Uint8Array<ArrayBufferLike>，
 * 与 BufferSource（要求 ArrayBuffer）不兼容，此处做安全转换。
 */
function buf(bytes: Uint8Array): BufferSource {
  return bytes as unknown as BufferSource;
}

/**
 * Argon2id 派生 Master Key（32 字节）
 */
export async function deriveMasterKey(
  password: string,
  kdfSaltBase64: string,
  kdfParams: KdfParams,
): Promise<Uint8Array> {
  await ensureSodium();
  const salt = fromBase64(kdfSaltBase64);
  return sodium.crypto_pwhash(
    32,
    password,
    salt,
    kdfParams.iterations,
    kdfParams.memoryKib * 1024,
    sodium.crypto_pwhash_ALG_ARGON2ID13,
  );
}

/**
 * HKDF-SHA256 派生 authHash
 */
export async function deriveAuthHash(
  masterKey: Uint8Array,
  email: string,
): Promise<string> {
  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    buf(masterKey),
    { name: 'HKDF' },
    false,
    ['deriveBits'],
  );

  const info = stringToBytes('passbox:auth:v1');
  const salt = stringToBytes(email);

  const derived = await crypto.subtle.deriveBits(
    { name: 'HKDF', hash: 'SHA-256', salt: buf(salt), info: buf(info) },
    keyMaterial,
    256,
  );

  return toBase64(new Uint8Array(derived));
}

/**
 * 解密 Symmetric Key
 *
 * H1 修复：返回的 CryptoKey 设置 extractable=false，
 * 阻止后续调用 exportKey() 将密钥序列化为可存储字符串。
 * 密钥仅保留在 service worker 内存中，浏览器关闭后随内存释放。
 */
export async function decryptSymmetricKey(
  masterKey: Uint8Array,
  encryptedKey: EncryptedData,
): Promise<CryptoKey> {
  const iv = fromBase64(encryptedKey.iv);
  const ct = fromBase64(encryptedKey.ct);
  const aad = stringToBytes('passbox:symmetric-key:master:v1');

  const rawKey = await crypto.subtle.decrypt(
    { name: 'AES-GCM', iv: buf(iv), additionalData: buf(aad) },
    await crypto.subtle.importKey('raw', buf(masterKey), { name: 'AES-GCM' }, false, [
      'decrypt',
    ]),
    buf(ct),
  );

  return crypto.subtle.importKey(
    'raw',
    rawKey,
    { name: 'AES-GCM' },
    false, // ⚠️ extractable=false，禁止后续 exportKey
    ['encrypt', 'decrypt'],
  );
}

/**
 * AES-256-GCM 加密字符串
 */
export async function encrypt(
  key: CryptoKey,
  plaintext: string,
  aad?: string,
): Promise<EncryptedData> {
  const iv = getRandomBytes(12);
  const params: AesGcmParams = { name: 'AES-GCM', iv: buf(iv) };
  if (aad) params.additionalData = buf(stringToBytes(aad));

  const ct = await crypto.subtle.encrypt(params, key, buf(stringToBytes(plaintext)));
  return { v: 1, iv: toBase64(iv), ct: toBase64(new Uint8Array(ct)) };
}

/**
 * AES-256-GCM 解密为字符串
 */
export async function decrypt(
  key: CryptoKey,
  data: EncryptedData,
  aad?: string,
): Promise<string> {
  const iv = fromBase64(data.iv);
  const ct = fromBase64(data.ct);
  const params: AesGcmParams = { name: 'AES-GCM', iv: buf(iv) };
  if (aad) params.additionalData = buf(stringToBytes(aad));

  const plaintext = await crypto.subtle.decrypt(params, key, buf(ct));
  return bytesToString(new Uint8Array(plaintext));
}

/** 零填充清除敏感数据 */
export function zeroFill(data: Uint8Array | null): void {
  if (data) data.fill(0);
}
