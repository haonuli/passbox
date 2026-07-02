import { describe, it, expect, beforeAll, beforeEach, vi } from 'vitest';
import { NextRequest } from 'next/server';

import { SESSION_COOKIE_NAME } from '@/lib/session';

// mock verifySession 以聚焦中间件路由守卫与 CSP 头逻辑
// JWT 验签逻辑在 T2.x / T3.x 单元测试中覆盖
vi.mock('@/lib/session', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/session')>();
  return {
    ...actual,
    SESSION_COOKIE_NAME: actual.SESSION_COOKIE_NAME,
    verifySession: vi.fn(),
  };
});

const { verifySession } = await import('@/lib/session');
const { middleware, config } = await import('@/middleware');

const mockedVerifySession = vi.mocked(verifySession);

/**
 * T1.6 中间件集成测试（TS-1.6）
 *
 * 验收标准：
 * - 未认证访问 (app)/* → 重定向 /login（带 redirect 参数）
 * - 已认证访问 (auth)/* → 重定向 /vault
 * - 响应头包含完整 CSP（script-src 'self' 'wasm-unsafe-eval' 等）
 * - CSP 包含 frame-ancestors 'none'
 * - connect-src 限制为 'self' https://api.pwnedpasswords.com
 */
describe('T1.6 middleware 集成测试', () => {
  const FAKE_SESSION = { sub: '00000000-0000-0000-0000-000000000001', email: 'test@passbox.local' };

  beforeAll(() => {
    // 默认未认证
    mockedVerifySession.mockResolvedValue(null);
  });

  beforeEach(() => {
    mockedVerifySession.mockResolvedValue(null);
  });

  /**
   * 辅助：构造 NextRequest
   */
  function createRequest(pathname: string, options: { cookie?: string } = {}) {
    const url = `http://localhost:3000${pathname}`;
    const req = new NextRequest(url, { method: 'GET' });
    if (options.cookie !== undefined) {
      req.cookies.set(SESSION_COOKIE_NAME, options.cookie);
    }
    return req;
  }

  describe('路由守卫 — 未认证访问受保护路由', () => {
    const protectedPaths = ['/vault', '/unlock', '/security', '/generator', '/settings', '/items/new', '/items/abc-123'];

    for (const path of protectedPaths) {
      it(`未认证访问 ${path} → 307 重定向到 /login?redirect=${encodeURIComponent(path)}`, async () => {
        const req = createRequest(path);
        const res = await middleware(req);

        expect(res.status).toBe(307);
        const location = res.headers.get('location');
        expect(location).not.toBeNull();
        expect(location).toContain('/login');
        expect(location).toContain(`redirect=${encodeURIComponent(path)}`);
      });
    }
  });

  describe('路由守卫 — 已认证访问认证路由', () => {
    const authPaths = ['/login', '/register'];

    for (const path of authPaths) {
      it(`已认证访问 ${path} → 307 重定向到 /vault`, async () => {
        mockedVerifySession.mockResolvedValueOnce(FAKE_SESSION);
        const req = createRequest(path, { cookie: 'fake-token' });
        const res = await middleware(req);

        expect(res.status).toBe(307);
        expect(res.headers.get('location')).toBe('http://localhost:3000/vault');
      });
    }
  });

  describe('路由守卫 — 正常放行', () => {
    it('未认证访问 / → 200（公开页面放行）', async () => {
      const req = createRequest('/');
      const res = await middleware(req);
      expect(res.status).toBe(200);
    });

    it('未认证访问 /login → 200（认证页面放行）', async () => {
      const req = createRequest('/login');
      const res = await middleware(req);
      expect(res.status).toBe(200);
    });

    it('已认证访问 /vault → 200（受保护页面放行）', async () => {
      mockedVerifySession.mockResolvedValueOnce(FAKE_SESSION);
      const req = createRequest('/vault', { cookie: 'fake-token' });
      const res = await middleware(req);
      expect(res.status).toBe(200);
    });

    it('无效 JWT 访问 /vault → 307 重定向到 /login', async () => {
      // verifySession 返回 null 表示验签失败/过期
      mockedVerifySession.mockResolvedValueOnce(null);
      const req = createRequest('/vault', { cookie: 'invalid.jwt.token' });
      const res = await middleware(req);
      expect(res.status).toBe(307);
      expect(res.headers.get('location')).toContain('/login');
    });
  });

  describe('CSP 安全头注入', () => {
    async function getCsp() {
      const req = createRequest('/');
      const res = await middleware(req);
      return res.headers;
    }

    it('Content-Security-Policy 头存在', async () => {
      const headers = await getCsp();
      expect(headers.has('Content-Security-Policy')).toBe(true);
    });

    it("CSP 包含 script-src 'self' 'wasm-unsafe-eval'", async () => {
      const csp = (await getCsp()).get('Content-Security-Policy') ?? '';
      expect(csp).toContain("script-src 'self' 'wasm-unsafe-eval'");
    });

    it("CSP 包含 frame-ancestors 'none'", async () => {
      const csp = (await getCsp()).get('Content-Security-Policy') ?? '';
      expect(csp).toContain("frame-ancestors 'none'");
    });

    it("CSP 包含 connect-src 'self' https://api.pwnedpasswords.com", async () => {
      const csp = (await getCsp()).get('Content-Security-Policy') ?? '';
      expect(csp).toContain("connect-src 'self' https://api.pwnedpasswords.com");
    });

    it("CSP 包含 default-src 'self'", async () => {
      const csp = (await getCsp()).get('Content-Security-Policy') ?? '';
      expect(csp).toContain("default-src 'self'");
    });

    it("CSP 包含 object-src 'none'", async () => {
      const csp = (await getCsp()).get('Content-Security-Policy') ?? '';
      expect(csp).toContain("object-src 'none'");
    });

    it("CSP 包含 base-uri 'self'", async () => {
      const csp = (await getCsp()).get('Content-Security-Policy') ?? '';
      expect(csp).toContain("base-uri 'self'");
    });

    it("CSP 包含 form-action 'self'", async () => {
      const csp = (await getCsp()).get('Content-Security-Policy') ?? '';
      expect(csp).toContain("form-action 'self'");
    });

    it('CSP 包含 upgrade-insecure-requests', async () => {
      const csp = (await getCsp()).get('Content-Security-Policy') ?? '';
      expect(csp).toContain('upgrade-insecure-requests');
    });

    it('X-Frame-Options 设置为 DENY', async () => {
      const headers = await getCsp();
      expect(headers.get('X-Frame-Options')).toBe('DENY');
    });

    it('X-Content-Type-Options 设置为 nosniff', async () => {
      const headers = await getCsp();
      expect(headers.get('X-Content-Type-Options')).toBe('nosniff');
    });

    it('Referrer-Policy 设置为 strict-origin-when-cross-origin', async () => {
      const headers = await getCsp();
      expect(headers.get('Referrer-Policy')).toBe('strict-origin-when-cross-origin');
    });

    it('Permissions-Policy 禁用摄像头/麦克风/定位', async () => {
      const headers = await getCsp();
      const pp = headers.get('Permissions-Policy') ?? '';
      expect(pp).toContain('camera=()');
      expect(pp).toContain('microphone=()');
      expect(pp).toContain('geolocation=()');
    });
  });

  describe('matcher 配置', () => {
    it('config.matcher 已定义且非空', () => {
      expect(config.matcher).toBeDefined();
      expect(Array.isArray(config.matcher)).toBe(true);
      expect(config.matcher.length).toBeGreaterThan(0);
    });
  });
});
