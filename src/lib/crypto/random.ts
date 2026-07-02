/**
 * 密码学安全随机数生成 (T2.1)
 *
 * 封装 crypto.getRandomValues，供加密链路生成 salt / IV / Symmetric Key / 恢复码。
 *
 * 注意：客户端使用，依赖浏览器 / Node 18+ 全局 crypto.getRandomValues。
 * 实际在引用处由 'use client' 组件触发。
 */

/**
 * 生成指定长度的密码学安全随机字节序列。
 *
 * @param length 字节长度，必须为非负整数
 * @returns 长度为 length 的随机 Uint8Array
 * @throws RangeError 当 length 为负数时
 */
export function getRandomBytes(length: number): Uint8Array {
  if (!Number.isInteger(length) || length < 0) {
    throw new RangeError(`length 必须为非负整数，收到: ${length}`);
  }
  const bytes = new Uint8Array(length);
  crypto.getRandomValues(bytes);
  return bytes;
}
