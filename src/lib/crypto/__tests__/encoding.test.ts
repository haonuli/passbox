// @vitest-environment node
import { describe, it, expect } from 'vitest';
import { toBase64, fromBase64, bytesToString, stringToBytes } from '../encoding';

describe('encoding 工具', () => {
  describe('toBase64 / fromBase64', () => {
    it('空 Uint8Array 往返为空字符串', () => {
      const empty = new Uint8Array(0);
      expect(toBase64(empty)).toBe('');
      expect(fromBase64('')).toEqual(empty);
    });

    it('单字节往返', () => {
      const bytes = new Uint8Array([255]);
      const encoded = toBase64(bytes);
      const decoded = fromBase64(encoded);
      expect(decoded).toEqual(bytes);
    });

    it('任意字节序列往返一致（含 0x00 / 0xFF 边界）', () => {
      const bytes = new Uint8Array([0, 1, 127, 128, 255, 0, 255, 127]);
      const round = fromBase64(toBase64(bytes));
      expect(round).toEqual(bytes);
    });

    it('大数组（>32KB）分块编码往返一致', () => {
      // 验证分块逻辑不因 apply/spread 参数上限而截断
      const big = new Uint8Array(50_000);
      for (let i = 0; i < big.length; i++) big[i] = i % 256;
      const round = fromBase64(toBase64(big));
      expect(round).toEqual(big);
    });

    it('输出为合法 base64 字符集（A-Za-z0-9+/=）', () => {
      const bytes = new Uint8Array([0, 0, 0, 0, 0]);
      const encoded = toBase64(bytes);
      expect(encoded).toMatch(/^[A-Za-z0-9+/]+={0,2}$/);
    });

    it('已知向量：[0x48,0x65,0x6c,0x6c,0x6f] → "SGVsbG8="', () => {
      // "Hello" 的 ASCII
      const hello = new Uint8Array([0x48, 0x65, 0x6c, 0x6c, 0x6f]);
      expect(toBase64(hello)).toBe('SGVsbG8=');
    });
  });

  describe('stringToBytes / bytesToString', () => {
    it('ASCII 字符串往返一致', () => {
      const text = 'passbox';
      expect(bytesToString(stringToBytes(text))).toBe(text);
    });

    it('含中文 / emoji 的 UTF-8 字符串往返一致', () => {
      const text = '密码 🔐 Pass123!';
      const bytes = stringToBytes(text);
      expect(bytesToString(bytes)).toBe(text);
    });

    it('UTF-8 编码长度正确（中文每字 3 字节，emoji 4 字节）', () => {
      // "中" → 3 字节
      expect(stringToBytes('中').length).toBe(3);
      // "🔒" → 4 字节
      expect(stringToBytes('🔒').length).toBe(4);
    });

    it('空字符串往返为 0 字节', () => {
      expect(stringToBytes('').length).toBe(0);
      expect(bytesToString(new Uint8Array(0))).toBe('');
    });
  });

  describe('跨函数组合', () => {
    it('stringToBytes → toBase64 → fromBase64 → bytesToString 往返一致', () => {
      const original = '敏感数据：用户密码 Password123!';
      const b64 = toBase64(stringToBytes(original));
      const restored = bytesToString(fromBase64(b64));
      expect(restored).toBe(original);
    });
  });
});
