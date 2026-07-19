// @vitest-environment node
import { describe, it, expect } from 'vitest';
import {
  generateTOTP,
  getTOTPRemainingSeconds,
  isValidTOTPSecret,
  TOTP_PERIOD,
  TOTP_DIGITS,
} from '../totp';

describe('TOTP 验证码生成 (totp.ts) - L5 测试补全', () => {
  // RFC 6238 附录 B 测试向量（SHA-1）
  // secret: '12345678901234567890' (ASCII) → base32
  const RFC_SECRET_BASE32 = 'GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ';

  describe('常量', () => {
    it('TOTP_PERIOD 应为 30 秒', () => {
      expect(TOTP_PERIOD).toBe(30);
    });

    it('TOTP_DIGITS 应为 6 位', () => {
      expect(TOTP_DIGITS).toBe(6);
    });
  });

  describe('generateTOTP', () => {
    it('应返回 6 位数字字符串', () => {
      const code = generateTOTP(RFC_SECRET_BASE32);
      expect(code).toMatch(/^\d{6}$/);
    });

    it('相同 secret + 同一时间窗口应生成相同验证码', () => {
      const code1 = generateTOTP(RFC_SECRET_BASE32);
      const code2 = generateTOTP(RFC_SECRET_BASE32);
      expect(code1).toBe(code2);
    });

    it('不同 secret 应生成不同验证码（极大概率）', () => {
      const code1 = generateTOTP(RFC_SECRET_BASE32);
      const code2 = generateTOTP('JBSWY3DPEHPK3PXP'); // 随机另一个 secret
      expect(code1).not.toBe(code2);
    });

    it('SHA-1 应为默认算法', () => {
      const defaultCode = generateTOTP(RFC_SECRET_BASE32);
      const sha1Code = generateTOTP(RFC_SECRET_BASE32, 'SHA1');
      expect(defaultCode).toBe(sha1Code);
    });

    it('SHA-256 应生成与 SHA-1 不同的验证码', () => {
      const sha1Code = generateTOTP(RFC_SECRET_BASE32, 'SHA1');
      const sha256Code = generateTOTP(RFC_SECRET_BASE32, 'SHA256');
      expect(sha256Code).toMatch(/^\d{6}$/);
      expect(sha1Code).not.toBe(sha256Code);
    });

    it('SHA-512 应生成 6 位验证码', () => {
      const sha512Code = generateTOTP(RFC_SECRET_BASE32, 'SHA512');
      expect(sha512Code).toMatch(/^\d{6}$/);
    });
  });

  describe('getTOTPRemainingSeconds', () => {
    it('应返回 0-30 之间的整数', () => {
      const remaining = getTOTPRemainingSeconds();
      expect(remaining).toBeGreaterThanOrEqual(0);
      expect(remaining).toBeLessThanOrEqual(TOTP_PERIOD);
      expect(Number.isInteger(remaining)).toBe(true);
    });
  });

  describe('isValidTOTPSecret', () => {
    it('合法 base32 字符串应返回 true', () => {
      expect(isValidTOTPSecret('JBSWY3DPEHPK3PXP')).toBe(true);
    });

    it('合法但含小写字母的 base32 应返回 true（otpauth 容错）', () => {
      // otpauth 的 Secret.fromBase32 对小写做归一化
      expect(isValidTOTPSecret('jbswy3dpehpk3pxp')).toBe(true);
    });

    it('非 base32 字符应返回 false', () => {
      expect(isValidTOTPSecret('!@#$%^&*')).toBe(false);
    });

    it('包含数字 1 的 base32 应返回 false（1 不在 base32 字母表中）', () => {
      // base32 字母表：A-Z + 2-7，数字 1 非法
      expect(isValidTOTPSecret('1BSWY3DPEHPK3PXP')).toBe(false);
    });

    it('包含数字 8 的 base32 应返回 false（8 不在 base32 字母表中）', () => {
      // base32 字母表：A-Z + 2-7，数字 8 非法
      expect(isValidTOTPSecret('J8SWY3DPEHPK3PXP')).toBe(false);
    });

    it('包含特殊字符 ? 的字符串应返回 false', () => {
      expect(isValidTOTPSecret('JBSWY3DP?EHPK3PXP')).toBe(false);
    });
  });
});
