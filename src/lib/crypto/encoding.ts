/**
 * 编码工具 (T2.1)
 *
 * 提供 base64 与 Uint8Array / UTF-8 字符串之间的双向转换。
 * 用于 EncryptedData 中 iv / ct 字段的序列化，以及明文 ↔ 字节转换。
 *
 * 注意：本模块在客户端加密链路中使用，依赖浏览器 / Node 18+ 全局
 * `btoa` / `atob` / `TextEncoder` / `TextDecoder`。实际在引用处由
 * 'use client' 组件触发，不在 Server Component 中直接调用。
 */

/**
 * 将 Uint8Array 编码为标准 base64 字符串。
 * 采用分块策略避免 String.fromCharCode.apply 的参数上限。
 */
export function toBase64(bytes: Uint8Array): string {
  if (bytes.length === 0) return '';

  const CHUNK_SIZE = 0x8000; // 32768，安全低于引擎参数上限
  let binary = '';
  for (let i = 0; i < bytes.length; i += CHUNK_SIZE) {
    const chunk = bytes.subarray(i, i + CHUNK_SIZE);
    binary += String.fromCharCode.apply(null, chunk as unknown as number[]);
  }
  return btoa(binary);
}

/**
 * 将标准 base64 字符串解码为 Uint8Array。
 */
export function fromBase64(str: string): Uint8Array {
  if (str.length === 0) return new Uint8Array(0);
  const binary = atob(str);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

/**
 * 将 UTF-8 字符串编码为 Uint8Array。
 */
export function stringToBytes(str: string): Uint8Array {
  return new TextEncoder().encode(str);
}

/**
 * 将 Uint8Array 按 UTF-8 解码为字符串。
 */
export function bytesToString(bytes: Uint8Array): string {
  return new TextDecoder().decode(bytes);
}
