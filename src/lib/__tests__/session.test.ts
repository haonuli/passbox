/**
 * T3.1 会话管理模块单元测试
 *
 * 覆盖：JWT 签发（createSession）、验签（verifySession）、过期/无效处理、
 * Cookie 属性（SESSION_COOKIE_OPTIONS）、Cookie 设置/清除。
 *
 * 对应 TEST_STRATEGY.md TS-3.1（TDD-first），覆盖率目标 95%/90%/100%。
 */
// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { decodeJwt } from 'jose';

// mock next/headers 的 cookies()，用于测试 setSessionCookie / clearSessionCookie / getSession
type CookieEntry = { name: string; value: string };
const mockCookieSet = vi.fn();
const mockCookieDelete = vi.fn();
const mockCookieGet = vi.fn<(name: string) => CookieEntry | undefined>();
mockCookieGet.mockReturnValue(undefined);
vi.mock('next/headers', () => ({
  cookies: vi.fn(() => Promise.resolve({
    set: mockCookieSet,
    delete: mockCookieDelete,
    get: mockCookieGet,
  })),
}));

import {
  createSession,
  verifySession,
  getSession,
  setSessionCookie,
  clearSessionCookie,
  SESSION_COOKIE_NAME,
  SESSION_COOKIE_OPTIONS,
  SESSION_MAX_AGE_SECONDS,
  type SessionPayload,
} from '../session';

const TEST_USER_ID = '550e8400-e29b-41d4-a716-446655440000';
const TEST_EMAIL = 'alice@passbox.local';

describe('会话管理模块', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockCookieGet.mockReturnValue(undefined);
  });

  describe('createSession — JWT 签发', () => {
    it('应返回非空字符串（JWT 格式：三段 base64 以 . 分隔）', async () => {
      const token = await createSession(TEST_USER_ID, TEST_EMAIL, 0);
      expect(typeof token).toBe('string');
      expect(token.length).toBeGreaterThan(0);
      // JWT 格式：header.payload.signature
      expect(token.split('.')).toHaveLength(3);
    });

    it('JWT payload 应包含 sub=userId 与 email', async () => {
      const token = await createSession(TEST_USER_ID, TEST_EMAIL, 0);
      const payload = decodeJwt(token) as SessionPayload;
      expect(payload.sub).toBe(TEST_USER_ID);
      expect(payload.email).toBe(TEST_EMAIL);
    });

    it('JWT payload 应包含 ver=token_version（M-9 撤销机制）', async () => {
      const token = await createSession(TEST_USER_ID, TEST_EMAIL, 3);
      const payload = decodeJwt(token) as SessionPayload;
      expect(payload.ver).toBe(3);
    });

    it('JWT 过期时间应为 30 天（exp - iat ≈ 30*24*3600）', async () => {
      const token = await createSession(TEST_USER_ID, TEST_EMAIL, 0);
      const payload = decodeJwt(token);
      expect(payload.exp).toBeDefined();
      expect(payload.iat).toBeDefined();
      const delta = (payload.exp as number) - (payload.iat as number);
      expect(delta).toBe(SESSION_MAX_AGE_SECONDS);
      expect(delta).toBe(30 * 24 * 3600);
    });

    it('不同 userId 签发不同 JWT', async () => {
      const token1 = await createSession(TEST_USER_ID, TEST_EMAIL, 0);
      const token2 = await createSession('660e8400-e29b-41d4-a716-446655440999', 'bob@passbox.local', 0);
      expect(token1).not.toBe(token2);
    });
  });

  describe('verifySession — JWT 验签', () => {
    it('有效 token 应返回 payload（含 sub 与 email）', async () => {
      const token = await createSession(TEST_USER_ID, TEST_EMAIL, 0);
      const payload = await verifySession(token);
      expect(payload).not.toBeNull();
      expect(payload?.sub).toBe(TEST_USER_ID);
      expect(payload?.email).toBe(TEST_EMAIL);
    });

    it('undefined token 应返回 null', async () => {
      const payload = await verifySession(undefined);
      expect(payload).toBeNull();
    });

    it('空字符串 token 应返回 null', async () => {
      const payload = await verifySession('');
      expect(payload).toBeNull();
    });

    it('无效 token（非 JWT 格式）应返回 null', async () => {
      const payload = await verifySession('not-a-jwt-token');
      expect(payload).toBeNull();
    });

    it('错误签名的 token 应返回 null', async () => {
      // 用不同密钥签发的 token（模拟伪造）
      const { SignJWT } = await import('jose');
      const fakeSecret = new TextEncoder().encode('wrong-secret');
      const forgedToken = await new SignJWT({ sub: TEST_USER_ID, email: TEST_EMAIL })
        .setProtectedHeader({ alg: 'HS256' })
        .setIssuedAt()
        .setExpirationTime('30d')
        .sign(fakeSecret);
      const payload = await verifySession(forgedToken);
      expect(payload).toBeNull();
    });

    it('过期的 token 应返回 null', async () => {
      const { SignJWT } = await import('jose');
      const realSecret = new TextEncoder().encode(process.env.JWT_SECRET);
      const expiredToken = await new SignJWT({ sub: TEST_USER_ID, email: TEST_EMAIL })
        .setProtectedHeader({ alg: 'HS256' })
        .setIssuedAt(Math.floor(Date.now() / 1000) - 3600) // 1 小时前签发
        .setExpirationTime(Math.floor(Date.now() / 1000) - 60) // 1 分钟前过期
        .sign(realSecret);
      const payload = await verifySession(expiredToken);
      expect(payload).toBeNull();
    });
  });

  describe('createSession + verifySession 往返', () => {
    it('签发后立即验签应返回一致的 payload', async () => {
      const token = await createSession(TEST_USER_ID, TEST_EMAIL, 0);
      const payload = await verifySession(token);
      expect(payload?.sub).toBe(TEST_USER_ID);
      expect(payload?.email).toBe(TEST_EMAIL);
    });
  });

  describe('Cookie 属性', () => {
    it('SESSION_COOKIE_NAME 应为 passbox_session', () => {
      expect(SESSION_COOKIE_NAME).toBe('passbox_session');
    });

    it('SESSION_COOKIE_OPTIONS 应包含安全属性', () => {
      expect(SESSION_COOKIE_OPTIONS.httpOnly).toBe(true);
      expect(SESSION_COOKIE_OPTIONS.secure).toBe(true);
      expect(SESSION_COOKIE_OPTIONS.sameSite).toBe('lax');
      expect(SESSION_COOKIE_OPTIONS.maxAge).toBe(30 * 24 * 3600);
      expect(SESSION_COOKIE_OPTIONS.path).toBe('/');
    });

    it('SESSION_MAX_AGE_SECONDS 应为 30 天秒数', () => {
      expect(SESSION_MAX_AGE_SECONDS).toBe(30 * 24 * 3600);
    });
  });

  describe('setSessionCookie / clearSessionCookie（通过 next/headers cookies）', () => {
    it('setSessionCookie 应调用 cookies().set 并传入正确属性', async () => {
      const token = await createSession(TEST_USER_ID, TEST_EMAIL, 0);
      await setSessionCookie(token);
      expect(mockCookieSet).toHaveBeenCalledTimes(1);
      expect(mockCookieSet).toHaveBeenCalledWith(
        SESSION_COOKIE_NAME,
        token,
        SESSION_COOKIE_OPTIONS,
      );
    });

    it('clearSessionCookie 应调用 cookies().set 过期时间为 0', async () => {
      await clearSessionCookie();
      expect(mockCookieSet).toHaveBeenCalledTimes(1);
      const [name, value, options] = mockCookieSet.mock.calls[0];
      expect(name).toBe(SESSION_COOKIE_NAME);
      expect(options.maxAge).toBe(0);
      expect(options.httpOnly).toBe(true);
      expect(options.secure).toBe(true);
      expect(options.sameSite).toBe('lax');
      expect(options.path).toBe('/');
      // value 应为空字符串
      expect(value).toBe('');
    });
  });

  describe('getSession — 从 Cookie 读取会话', () => {
    it('Cookie 不存在时返回 null', async () => {
      mockCookieGet.mockReturnValue(undefined);
      const session = await getSession();
      expect(session).toBeNull();
      expect(mockCookieGet).toHaveBeenCalledWith(SESSION_COOKIE_NAME);
    });

    it('Cookie 包含有效 JWT 时返回 payload', async () => {
      const token = await createSession(TEST_USER_ID, TEST_EMAIL, 0);
      mockCookieGet.mockReturnValue({ name: SESSION_COOKIE_NAME, value: token });
      const session = await getSession();
      expect(session).not.toBeNull();
      expect(session?.sub).toBe(TEST_USER_ID);
      expect(session?.email).toBe(TEST_EMAIL);
    });

    it('Cookie 包含无效 JWT 时返回 null', async () => {
      mockCookieGet.mockReturnValue({ name: SESSION_COOKIE_NAME, value: 'invalid-jwt' });
      const session = await getSession();
      expect(session).toBeNull();
    });
  });
});
