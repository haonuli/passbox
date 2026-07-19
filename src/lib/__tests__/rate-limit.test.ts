// @vitest-environment node
import { describe, it, expect, beforeEach } from 'vitest';
import {
  rateLimit,
  checkRateLimit,
  getClientIp,
  __resetRateLimitForTests,
} from '../rate-limit';

describe('速率限制器 (rate-limit.ts) - L6 修复', () => {
  beforeEach(() => {
    __resetRateLimitForTests();
  });

  describe('rateLimit - 基本行为', () => {
    it('窗口内未达上限应允许通过', () => {
      const result = rateLimit('test-key-1', { windowMs: 60_000, max: 3 });
      expect(result.ok).toBe(true);
      expect(result.remaining).toBe(2);
      expect(result.retryAfter).toBe(0);
    });

    it('窗口内达到上限应拒绝', () => {
      const key = 'test-key-2';
      rateLimit(key, { windowMs: 60_000, max: 2 });
      rateLimit(key, { windowMs: 60_000, max: 2 });
      const result = rateLimit(key, { windowMs: 60_000, max: 2 });
      expect(result.ok).toBe(false);
      expect(result.remaining).toBe(0);
      expect(result.retryAfter).toBeGreaterThan(0);
    });

    it('不同 key 独立计数', () => {
      rateLimit('key-a', { windowMs: 60_000, max: 1 });
      const aSecond = rateLimit('key-a', { windowMs: 60_000, max: 1 });
      const bFirst = rateLimit('key-b', { windowMs: 60_000, max: 1 });
      expect(aSecond.ok).toBe(false);
      expect(bFirst.ok).toBe(true);
    });
  });

  describe('checkRateLimit - 含 email 的限流', () => {
    it('应按 ip+email 组合限流', () => {
      const r1 = checkRateLimit('login', '1.2.3.4', 'user@example.com', {
        windowMs: 60_000,
        max: 1,
      });
      const r2 = checkRateLimit('login', '1.2.3.4', 'user@example.com', {
        windowMs: 60_000,
        max: 1,
      });
      expect(r1.ok).toBe(true);
      expect(r2.ok).toBe(false);
      if (!r2.ok) {
        expect(r2.retryAfter).toBeGreaterThan(0);
      }
    });

    it('相同 ip 不同 email 应独立计数', () => {
      checkRateLimit('login', '1.2.3.4', 'a@example.com', {
        windowMs: 60_000,
        max: 1,
      });
      const result = checkRateLimit('login', '1.2.3.4', 'b@example.com', {
        windowMs: 60_000,
        max: 1,
      });
      expect(result.ok).toBe(true);
    });

    it('email 应大小写不敏感', () => {
      checkRateLimit('login', '1.2.3.4', 'USER@example.com', {
        windowMs: 60_000,
        max: 1,
      });
      const result = checkRateLimit('login', '1.2.3.4', 'user@example.com', {
        windowMs: 60_000,
        max: 1,
      });
      expect(result.ok).toBe(false);
    });

    it('未提供 email 时仅按 ip 限流', () => {
      checkRateLimit('test', '5.6.7.8', undefined, {
        windowMs: 60_000,
        max: 1,
      });
      const result = checkRateLimit('test', '5.6.7.8', undefined, {
        windowMs: 60_000,
        max: 1,
      });
      expect(result.ok).toBe(false);
    });
  });

  describe('getClientIp', () => {
    it('应优先使用 x-forwarded-for 首个 IP', () => {
      const request = new Request('https://example.com', {
        headers: {
          'x-forwarded-for': '1.2.3.4, 5.6.7.8',
          'x-real-ip': '9.9.9.9',
        },
      });
      expect(getClientIp(request)).toBe('1.2.3.4');
    });

    it('无 x-forwarded-for 时回退到 x-real-ip', () => {
      const request = new Request('https://example.com', {
        headers: { 'x-real-ip': '9.9.9.9' },
      });
      expect(getClientIp(request)).toBe('9.9.9.9');
    });

    it('无任何代理头时返回 unknown', () => {
      const request = new Request('https://example.com');
      expect(getClientIp(request)).toBe('unknown');
    });

    it('应 trim x-real-ip 周围空格', () => {
      const request = new Request('https://example.com', {
        headers: { 'x-real-ip': '  1.2.3.4  ' },
      });
      expect(getClientIp(request)).toBe('1.2.3.4');
    });
  });
});
