// @vitest-environment node
import { describe, it, expect } from 'vitest';
import { getRandomBytes } from '../random';

describe('random 工具', () => {
  it('返回指定长度的 Uint8Array', () => {
    expect(getRandomBytes(32).length).toBe(32);
    expect(getRandomBytes(16).length).toBe(16);
    expect(getRandomBytes(1).length).toBe(1);
  });

  it('长度 0 返回空 Uint8Array（不抛错）', () => {
    const bytes = getRandomBytes(0);
    expect(bytes).toBeInstanceOf(Uint8Array);
    expect(bytes.length).toBe(0);
  });

  it('每次调用结果不同（随机性）', () => {
    const a = getRandomBytes(32);
    const b = getRandomBytes(32);
    expect(a).not.toEqual(b);
  });

  it('负数长度抛出 RangeError', () => {
    expect(() => getRandomBytes(-1)).toThrow(RangeError);
  });

  it('返回值是 Uint8Array 实例', () => {
    expect(getRandomBytes(8)).toBeInstanceOf(Uint8Array);
  });

  it('字节分布无明显偏置（粗略检查：1000 字节中 0 与 255 均出现范围合理）', () => {
    // 仅作烟雾测试，不做严格卡方检验
    const bytes = getRandomBytes(1000);
    const set = new Set(bytes);
    expect(set.size).toBeGreaterThan(200); // 1000 字节应覆盖大量不同值
  });
});
