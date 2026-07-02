// @vitest-environment node
import { describe, it, expect } from 'vitest';
import {
  generateRecoveryCode,
  parseRecoveryCode,
  isValidRecoveryCodeFormat,
  RECOVERY_CODE_PREFIX,
  RECOVERY_CODE_RAW_LENGTH,
  RECOVERY_CODE_ENCODED_LENGTH,
} from '../recovery-code';

describe('恢复码生成与格式化 (recovery-code.ts)', () => {
  describe('generateRecoveryCode', () => {
    it('返回包含 raw 与 formatted 的对象', () => {
      const result = generateRecoveryCode();
      expect(result).toHaveProperty('raw');
      expect(result).toHaveProperty('formatted');
    });

    it('raw 为 10 字节的 Uint8Array（80 bit 熵）', () => {
      const { raw } = generateRecoveryCode();
      expect(raw).toBeInstanceOf(Uint8Array);
      expect(raw.length).toBe(RECOVERY_CODE_RAW_LENGTH);
      expect(raw.length).toBe(10);
    });

    it('formatted 以 "PBOX-" 前缀开头', () => {
      const { formatted } = generateRecoveryCode();
      expect(formatted.startsWith(RECOVERY_CODE_PREFIX + '-')).toBe(true);
    });

    it('formatted 格式为 PBOX-XXXX-XXXX-XXXX-XXXX（4 组 4 字符）', () => {
      const { formatted } = generateRecoveryCode();
      // 去除 "PBOX-" 前缀后应为 4 组 4 字符，用 - 分隔
      const dataPart = formatted.slice(RECOVERY_CODE_PREFIX.length + 1);
      const groups = dataPart.split('-');
      expect(groups).toHaveLength(4);
      for (const g of groups) {
        expect(g).toHaveLength(4);
      }
      // 总长度：PBOX(4) + -(1) + 4*4(16) + 3 个分隔符(3) = 24
      expect(formatted.length).toBe(4 + 1 + 16 + 3);
    });

    it('formatted 数据部分仅含 Crockford Base32 字符（去除 I/L/O/U）', () => {
      const allowed = '0123456789ABCDEFGHJKMNPQRSTVWXYZ';
      // 多次生成确保覆盖面
      for (let i = 0; i < 50; i++) {
        const { formatted } = generateRecoveryCode();
        const dataPart = formatted.slice(RECOVERY_CODE_PREFIX.length + 1).replace(/-/g, '');
        expect(dataPart.length).toBe(RECOVERY_CODE_ENCODED_LENGTH);
        for (const ch of dataPart) {
          expect(allowed).toContain(ch);
        }
        // 显式断言不包含易混淆字符
        expect(dataPart).not.toMatch(/[ILOU]/);
      }
    });

    it('多次生成结果不同（随机性）', () => {
      const codes = new Set<string>();
      for (let i = 0; i < 100; i++) {
        codes.add(generateRecoveryCode().formatted);
      }
      // 100 次生成应至少有 95 个不同值（允许极小概率碰撞）
      expect(codes.size).toBeGreaterThanOrEqual(95);
    });
  });

  describe('parseRecoveryCode', () => {
    it('生成 → 解析往返：返回与 raw 一致的字节', () => {
      const { raw, formatted } = generateRecoveryCode();
      const parsed = parseRecoveryCode(formatted);
      expect(parsed).toBeInstanceOf(Uint8Array);
      expect(parsed.length).toBe(RECOVERY_CODE_RAW_LENGTH);
      // 逐字节比对
      for (let i = 0; i < raw.length; i++) {
        expect(parsed[i]).toBe(raw[i]);
      }
    });

    it('大小写不敏感：小写输入可解析', () => {
      const { raw, formatted } = generateRecoveryCode();
      const parsed = parseRecoveryCode(formatted.toLowerCase());
      expect(Array.from(parsed)).toEqual(Array.from(raw));
    });

    it('自动去除首尾空白', () => {
      const { raw, formatted } = generateRecoveryCode();
      const parsed = parseRecoveryCode('  ' + formatted + '  ');
      expect(Array.from(parsed)).toEqual(Array.from(raw));
    });

    it('自动去除内部空格', () => {
      const { raw, formatted } = generateRecoveryCode();
      // 在分隔符位置插入额外空格
      const spaced = formatted.replace(/-/g, ' - ');
      const parsed = parseRecoveryCode(spaced);
      expect(Array.from(parsed)).toEqual(Array.from(raw));
    });

    it('已知向量：全零字节 → PBOX-0000-0000-0000-0000', () => {
      // 构造一个 raw 为全零的恢复码格式，解析后应为 10 个 0x00
      const formatted = 'PBOX-0000-0000-0000-0000';
      const parsed = parseRecoveryCode(formatted);
      expect(parsed.length).toBe(10);
      for (let i = 0; i < 10; i++) {
        expect(parsed[i]).toBe(0);
      }
    });

    it('抛错：缺少 PBOX- 前缀', () => {
      expect(() => parseRecoveryCode('ABCD-ABCD-ABCD-ABCD')).toThrow(/PBOX/);
    });

    it('抛错：错误的前缀', () => {
      expect(() => parseRecoveryCode('PASS-ABCD-ABCD-ABCD-ABCD')).toThrow(/PBOX/);
    });

    it('抛错：分组数不足（3 组）', () => {
      expect(() => parseRecoveryCode('PBOX-ABCD-ABCD-ABCD')).toThrow(/格式/);
    });

    it('抛错：分组数过多（5 组）', () => {
      expect(() => parseRecoveryCode('PBOX-ABCD-ABCD-ABCD-ABCD-ABCD')).toThrow(/格式/);
    });

    it('抛错：分组长度不符（某组 3 字符）', () => {
      expect(() => parseRecoveryCode('PBOX-ABC-ABCD-ABCD-ABCD')).toThrow(/格式/);
    });

    it('抛错：包含非法字符 I（Crockford 去除）', () => {
      expect(() => parseRecoveryCode('PBOX-ABCD-ABCD-ABCD-ABCI')).toThrow(/非法字符/);
    });

    it('抛错：包含非法字符 L', () => {
      expect(() => parseRecoveryCode('PBOX-ABCD-ABCD-ABCD-ABCL')).toThrow(/非法字符/);
    });

    it('抛错：包含非法字符 O', () => {
      expect(() => parseRecoveryCode('PBOX-ABCD-ABCD-ABCD-ABCO')).toThrow(/非法字符/);
    });

    it('抛错：包含非法字符 U', () => {
      expect(() => parseRecoveryCode('PBOX-ABCD-ABCD-ABCD-ABCU')).toThrow(/非法字符/);
    });

    it('抛错：包含小写非法字符（转大写后仍非法）', () => {
      expect(() => parseRecoveryCode('PBOX-abcd-abcd-abcd-abcu')).toThrow(/非法字符/);
    });

    it('抛错：空字符串', () => {
      expect(() => parseRecoveryCode('')).toThrow();
    });

    it('抛错：仅前缀', () => {
      expect(() => parseRecoveryCode('PBOX-')).toThrow();
    });
  });

  describe('isValidRecoveryCodeFormat', () => {
    it('合法恢复码返回 true', () => {
      const { formatted } = generateRecoveryCode();
      expect(isValidRecoveryCodeFormat(formatted)).toBe(true);
    });

    it('合法恢复码（小写）返回 true', () => {
      const { formatted } = generateRecoveryCode();
      expect(isValidRecoveryCodeFormat(formatted.toLowerCase())).toBe(true);
    });

    it('缺少前缀返回 false', () => {
      expect(isValidRecoveryCodeFormat('ABCD-ABCD-ABCD-ABCD')).toBe(false);
    });

    it('非法字符返回 false', () => {
      expect(isValidRecoveryCodeFormat('PBOX-ABCD-ABCD-ABCD-ABCI')).toBe(false);
    });

    it('分组错误返回 false', () => {
      expect(isValidRecoveryCodeFormat('PBOX-ABCD-ABCD-ABCD')).toBe(false);
    });

    it('空字符串返回 false', () => {
      expect(isValidRecoveryCodeFormat('')).toBe(false);
    });
  });
});
