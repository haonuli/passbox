// @vitest-environment node
import { describe, it, expect, beforeAll, beforeEach, afterAll } from 'vitest';
import { NextRequest } from 'next/server';
import { db } from '@/lib/db';
import { runMigrations } from '@/lib/migrate';
import { generateRecoveryCode } from '@/lib/recovery-code';
import { SESSION_COOKIE_NAME } from '@/lib/session';
import { POST as registerPost } from '@/app/api/auth/register/route';
import { POST as preloginPost } from '@/app/api/auth/prelogin/route';
import { POST as loginPost } from '@/app/api/auth/login/route';
import { POST as logoutPost } from '@/app/api/auth/logout/route';
import { GET as sessionGet } from '@/app/api/auth/session/route';
import type { EncryptedData } from '@/types/crypto';

/**
 * T3.3 预登录/登录/登出/会话查询 API 集成测试（TS-3.3）
 *
 * 验收标准（TASK_BREAKDOWN.md T3.3）：
 * - [x] 预登录：email 不存在时返回随机 salt + 默认 KDF 参数（防枚举）
 * - [x] 登录：bcrypt.compare 验证，成功重置失败计数，失败计数 +1
 * - [x] 登录：连续 5 次失败后锁定 15 分钟，返回 423 + lockedUntil
 * - [x] 登录：锁定期间拒绝登录，返回 423
 * - [x] 登录：成功后返回 encryptedKey + kdfSalt + kdfParams
 * - [x] 登录：错误信息统一为"邮箱或主密码错误"（SEC-10）
 * - [x] 会话查询：Cookie 有效时返回 encryptedKey + kdfParams
 * - [x] 登出：清除会话 Cookie，返回 200
 */
describe('T3.3 认证 API 集成测试', () => {
  beforeAll(async () => {
    await runMigrations();
  });

  beforeEach(async () => {
    // 清理本测试文件创建的用户（使用 @auth.test 域名隔离）
    await db.query("DELETE FROM users WHERE email_normalized LIKE '%@auth.test'");
  });

  afterAll(async () => {
    await db.end();
  });

  // ============================================================
  // 测试辅助函数
  // ============================================================

  const TEST_AUTH_HASH = 'dGhpcy1pcy1hLXNlY3JldC1oYXNo'; // base64(32 bytes)
  const WRONG_AUTH_HASH = 'AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA=';

  function makeEncryptedData(): EncryptedData {
    return { v: 1, iv: 'AAAAAAAAAAAAAAAA', ct: 'AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA=' };
  }

  function makeKdfSalt(): string {
    return 'AAAAAAAAAAAAAAAAAAAAAA=='; // 16 bytes base64
  }

  const DEFAULT_KDF_PARAMS = {
    type: 'argon2id' as const,
    memoryKib: 65536,
    iterations: 3,
    parallelism: 4,
  };

  /** 注册一个测试用户，返回 { email, authHash, userId, vaultId, sessionCookie } */
  async function registerTestUser(
    email = 'user@auth.test',
    authHash = TEST_AUTH_HASH,
  ): Promise<{
    email: string;
    authHash: string;
    userId: string;
    vaultId: string;
    sessionCookie: string;
  }> {
    const { formatted: recoveryCode } = generateRecoveryCode();
    const body = {
      email,
      authHash,
      encryptedKey: makeEncryptedData(),
      kdfSalt: makeKdfSalt(),
      kdfParams: DEFAULT_KDF_PARAMS,
      recoveryCode,
      recoveryEncryptedKey: makeEncryptedData(),
      defaultVaultNameEncrypted: makeEncryptedData(),
    };
    const res = await registerPost(
      new NextRequest('http://localhost/api/auth/register', {
        method: 'POST',
        body: JSON.stringify(body),
        headers: { 'Content-Type': 'application/json' },
      }),
    );
    const json = await res.json();
    return {
      email,
      authHash,
      userId: json.user.id,
      vaultId: json.defaultVaultId,
      sessionCookie: res.cookies.get(SESSION_COOKIE_NAME)?.value ?? '',
    };
  }

  function makeJsonRequest(url: string, body: unknown): NextRequest {
    return new NextRequest(url, {
      method: 'POST',
      body: JSON.stringify(body),
      headers: { 'Content-Type': 'application/json' },
    });
  }

  // ============================================================
  // 预登录（防枚举）
  // ============================================================

  describe('POST /api/auth/prelogin', () => {
    it('已注册邮箱返回用户实际 KDF 参数', async () => {
      await registerTestUser();
      const res = await preloginPost(
        makeJsonRequest('http://localhost/api/auth/prelogin', { email: 'user@auth.test' }),
      );
      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.kdfSalt).toBeTruthy();
      expect(json.kdfParams).toMatchObject(DEFAULT_KDF_PARAMS);
    });

    it('未注册邮箱返回随机 salt + 默认 KDF 参数（防枚举）', async () => {
      const res = await preloginPost(
        makeJsonRequest('http://localhost/api/auth/prelogin', { email: 'nobody@auth.test' }),
      );
      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.kdfSalt).toBeTruthy();
      expect(json.kdfParams).toMatchObject(DEFAULT_KDF_PARAMS);
    });

    it('未注册邮箱两次请求返回不同 salt（随机性）', async () => {
      const res1 = await preloginPost(
        makeJsonRequest('http://localhost/api/auth/prelogin', { email: 'nobody@auth.test' }),
      );
      const res2 = await preloginPost(
        makeJsonRequest('http://localhost/api/auth/prelogin', { email: 'nobody@auth.test' }),
      );
      const json1 = await res1.json();
      const json2 = await res2.json();
      expect(json1.kdfSalt).not.toBe(json2.kdfSalt);
    });

    it('已注册邮箱返回的 salt 与注册时一致', async () => {
      // 注册时 kdfSalt = makeKdfSalt() = 'AAAAAAAAAAAAAAAAAAAAAA=='
      await registerTestUser();
      const res = await preloginPost(
        makeJsonRequest('http://localhost/api/auth/prelogin', { email: 'user@auth.test' }),
      );
      const json = await res.json();
      expect(json.kdfSalt).toBe(makeKdfSalt());
    });

    it('邮箱大小写不敏感', async () => {
      await registerTestUser('User@Auth.Test');
      const res = await preloginPost(
        makeJsonRequest('http://localhost/api/auth/prelogin', { email: 'user@auth.test' }),
      );
      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.kdfParams).toMatchObject(DEFAULT_KDF_PARAMS);
    });

    it('无效邮箱返回 400', async () => {
      const res = await preloginPost(
        makeJsonRequest('http://localhost/api/auth/prelogin', { email: 'not-an-email' }),
      );
      expect(res.status).toBe(400);
    });
  });

  // ============================================================
  // 登录
  // ============================================================

  describe('POST /api/auth/login', () => {
    it('正确 authHash 登录成功 → 200 + LoginResponse + Cookie', async () => {
      const { email, authHash } = await registerTestUser();
      const res = await loginPost(
        makeJsonRequest('http://localhost/api/auth/login', { email, authHash }),
      );
      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json).toHaveProperty('user.id');
      expect(json).toHaveProperty('user.email', email);
      expect(json).toHaveProperty('encryptedKey');
      expect(json.encryptedKey).toMatchObject({ v: 1, iv: expect.any(String), ct: expect.any(String) });
      expect(json).toHaveProperty('kdfSalt');
      expect(json).toHaveProperty('kdfParams');
      // 会话 Cookie 已设置
      const cookie = res.cookies.get(SESSION_COOKIE_NAME);
      expect(cookie?.value).toBeTruthy();
    });

    it('错误 authHash → 401 + 统一错误信息', async () => {
      const { email } = await registerTestUser();
      const res = await loginPost(
        makeJsonRequest('http://localhost/api/auth/login', {
          email,
          authHash: WRONG_AUTH_HASH,
        }),
      );
      expect(res.status).toBe(401);
      const json = await res.json();
      expect(json.error).toBe('邮箱或主密码错误');
    });

    it('不存在的邮箱 → 401 + 相同错误信息（防枚举）', async () => {
      const res = await loginPost(
        makeJsonRequest('http://localhost/api/auth/login', {
          email: 'nobody@auth.test',
          authHash: TEST_AUTH_HASH,
        }),
      );
      expect(res.status).toBe(401);
      const json = await res.json();
      expect(json.error).toBe('邮箱或主密码错误');
    });

    it('失败后 failed_login_attempts 递增', async () => {
      const { email } = await registerTestUser();
      // 失败 3 次
      for (let i = 0; i < 3; i++) {
        await loginPost(
          makeJsonRequest('http://localhost/api/auth/login', {
            email,
            authHash: WRONG_AUTH_HASH,
          }),
        );
      }
      const result = await db.query(
        'SELECT failed_login_attempts FROM users WHERE email_normalized = $1',
        ['user@auth.test'],
      );
      expect(result.rows[0].failed_login_attempts).toBe(3);
    });

    it('连续 5 次失败后锁定账户 → 423 + lockedUntil', async () => {
      const { email } = await registerTestUser();
      for (let i = 0; i < 5; i++) {
        await loginPost(
          makeJsonRequest('http://localhost/api/auth/login', {
            email,
            authHash: WRONG_AUTH_HASH,
          }),
        );
      }
      // 第 5 次应返回 423
      const res = await loginPost(
        makeJsonRequest('http://localhost/api/auth/login', {
          email,
          authHash: WRONG_AUTH_HASH,
        }),
      );
      expect(res.status).toBe(423);
      const json = await res.json();
      expect(json).toHaveProperty('lockedUntil');
      expect(new Date(json.lockedUntil).getTime()).toBeGreaterThan(Date.now());
    });

    it('锁定期间即使密码正确也拒绝登录 → 423', async () => {
      const { email, authHash } = await registerTestUser();
      // 触发锁定
      for (let i = 0; i < 5; i++) {
        await loginPost(
          makeJsonRequest('http://localhost/api/auth/login', {
            email,
            authHash: WRONG_AUTH_HASH,
          }),
        );
      }
      // 用正确密码登录仍应被拒
      const res = await loginPost(
        makeJsonRequest('http://localhost/api/auth/login', { email, authHash }),
      );
      expect(res.status).toBe(423);
    });

    it('锁定过期后重置 failed_login_attempts（M-3：避免过期后一次失败即重新锁定）', async () => {
      const { email } = await registerTestUser();
      // 触发锁定（5 次失败 → failed_login_attempts=5, locked_until=未来）
      for (let i = 0; i < 5; i++) {
        await loginPost(
          makeJsonRequest('http://localhost/api/auth/login', {
            email,
            authHash: WRONG_AUTH_HASH,
          }),
        );
      }
      // 手动将 locked_until 设为过去，模拟锁定过期
      await db.query(
        "UPDATE users SET locked_until = NOW() - INTERVAL '1 minute' WHERE email_normalized = $1",
        ['user@auth.test'],
      );
      // 锁定过期后再失败一次：应返回 401（而非 423），证明 failed_login_attempts 已重置
      const res = await loginPost(
        makeJsonRequest('http://localhost/api/auth/login', {
          email,
          authHash: WRONG_AUTH_HASH,
        }),
      );
      expect(res.status).toBe(401);
      // 验证 failed_login_attempts 仅 +1（从 0 开始），而非从 5 累加到 6 再次锁定
      const result = await db.query(
        'SELECT failed_login_attempts, locked_until FROM users WHERE email_normalized = $1',
        ['user@auth.test'],
      );
      expect(result.rows[0].failed_login_attempts).toBe(1);
      expect(result.rows[0].locked_until).toBeNull();
    });

    it('登录成功后重置 failed_login_attempts', async () => {
      const { email, authHash } = await registerTestUser();
      // 失败 2 次
      for (let i = 0; i < 2; i++) {
        await loginPost(
          makeJsonRequest('http://localhost/api/auth/login', {
            email,
            authHash: WRONG_AUTH_HASH,
          }),
        );
      }
      // 成功登录
      await loginPost(
        makeJsonRequest('http://localhost/api/auth/login', { email, authHash }),
      );
      const result = await db.query(
        'SELECT failed_login_attempts, locked_until, last_login_at FROM users WHERE email_normalized = $1',
        ['user@auth.test'],
      );
      expect(result.rows[0].failed_login_attempts).toBe(0);
      expect(result.rows[0].locked_until).toBeNull();
      expect(result.rows[0].last_login_at).not.toBeNull();
    });

    it('登录响应包含 encryptedKey 与注册时一致', async () => {
      const { email, authHash } = await registerTestUser();
      const res = await loginPost(
        makeJsonRequest('http://localhost/api/auth/login', { email, authHash }),
      );
      const json = await res.json();
      // 注册时 encryptedKey = makeEncryptedData() = {v:1, iv:'AAAA...', ct:'AAAA...'}
      expect(json.encryptedKey).toMatchObject(makeEncryptedData());
    });

    it('无效邮箱返回 400', async () => {
      const res = await loginPost(
        makeJsonRequest('http://localhost/api/auth/login', {
          email: 'not-an-email',
          authHash: TEST_AUTH_HASH,
        }),
      );
      expect(res.status).toBe(400);
    });
  });

  // ============================================================
  // 登出
  // ============================================================

  describe('POST /api/auth/logout', () => {
    it('返回 200 + 清除 Cookie', async () => {
      const res = await logoutPost(
        new NextRequest('http://localhost/api/auth/logout', { method: 'POST' }),
      );
      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json).toHaveProperty('success', true);
      // Cookie 被 maxAge=0 清除
      const cookie = res.cookies.get(SESSION_COOKIE_NAME);
      expect(cookie?.value).toBe('');
      expect(cookie?.maxAge).toBe(0);
    });
  });

  // ============================================================
  // 会话查询
  // ============================================================

  describe('GET /api/auth/session', () => {
    it('有效 Cookie 返回 200 + SessionResponse', async () => {
      const { sessionCookie } = await registerTestUser();
      const req = new NextRequest('http://localhost/api/auth/session', { method: 'GET' });
      req.cookies.set(SESSION_COOKIE_NAME, sessionCookie);
      const res = await sessionGet(req);
      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json).toHaveProperty('user.id');
      expect(json).toHaveProperty('user.email', 'user@auth.test');
      expect(json).toHaveProperty('encryptedKey');
      expect(json.encryptedKey).toMatchObject({ v: 1, iv: expect.any(String), ct: expect.any(String) });
      expect(json).toHaveProperty('kdfSalt');
      expect(json).toHaveProperty('kdfParams');
    });

    it('无 Cookie 返回 401', async () => {
      const req = new NextRequest('http://localhost/api/auth/session', { method: 'GET' });
      const res = await sessionGet(req);
      expect(res.status).toBe(401);
    });

    it('无效 Cookie 返回 401', async () => {
      const req = new NextRequest('http://localhost/api/auth/session', { method: 'GET' });
      req.cookies.set(SESSION_COOKIE_NAME, 'invalid.jwt.token');
      const res = await sessionGet(req);
      expect(res.status).toBe(401);
    });

    it('登录后获取的 Cookie 可用于会话查询', async () => {
      const { email, authHash } = await registerTestUser();
      // 登录获取 Cookie
      const loginRes = await loginPost(
        makeJsonRequest('http://localhost/api/auth/login', { email, authHash }),
      );
      const cookie = loginRes.cookies.get(SESSION_COOKIE_NAME)?.value;
      expect(cookie).toBeTruthy();
      // 用 Cookie 查询会话
      const req = new NextRequest('http://localhost/api/auth/session', { method: 'GET' });
      req.cookies.set(SESSION_COOKIE_NAME, cookie!);
      const res = await sessionGet(req);
      expect(res.status).toBe(200);
    });
  });

  // ============================================================
  // M-9：JWT 服务端撤销（token_version）
  // ============================================================

  describe('M-9 token_version 撤销机制', () => {
    it('登出后旧 JWT 被拒绝 → 401 SESSION_REVOKED', async () => {
      const { email, authHash } = await registerTestUser();
      // 登录获取 Cookie
      const loginRes = await loginPost(
        makeJsonRequest('http://localhost/api/auth/login', { email, authHash }),
      );
      const oldCookie = loginRes.cookies.get(SESSION_COOKIE_NAME)?.value;
      expect(oldCookie).toBeTruthy();

      // 登出前：旧 Cookie 可用
      const req1 = new NextRequest('http://localhost/api/auth/session', { method: 'GET' });
      req1.cookies.set(SESSION_COOKIE_NAME, oldCookie!);
      const res1 = await sessionGet(req1);
      expect(res1.status).toBe(200);

      // 登出：递增 token_version，旧 JWT 失效
      const logoutReq = new NextRequest('http://localhost/api/auth/logout', { method: 'POST' });
      logoutReq.cookies.set(SESSION_COOKIE_NAME, oldCookie!);
      await logoutPost(logoutReq);

      // 登出后：旧 Cookie 应被拒绝（token_version 不匹配）
      const req2 = new NextRequest('http://localhost/api/auth/session', { method: 'GET' });
      req2.cookies.set(SESSION_COOKIE_NAME, oldCookie!);
      const res2 = await sessionGet(req2);
      expect(res2.status).toBe(401);
      const json = await res2.json();
      expect(json.code).toBe('SESSION_REVOKED');
    });

    it('登出后重新登录获得新 JWT，新 JWT 可用', async () => {
      const { email, authHash } = await registerTestUser();
      // 第一次登录
      const loginRes1 = await loginPost(
        makeJsonRequest('http://localhost/api/auth/login', { email, authHash }),
      );
      const oldCookie = loginRes1.cookies.get(SESSION_COOKIE_NAME)?.value;

      // 登出
      const logoutReq = new NextRequest('http://localhost/api/auth/logout', { method: 'POST' });
      logoutReq.cookies.set(SESSION_COOKIE_NAME, oldCookie!);
      await logoutPost(logoutReq);

      // 重新登录获得新 Cookie
      const loginRes2 = await loginPost(
        makeJsonRequest('http://localhost/api/auth/login', { email, authHash }),
      );
      const newCookie = loginRes2.cookies.get(SESSION_COOKIE_NAME)?.value;
      expect(newCookie).toBeTruthy();
      expect(newCookie).not.toBe(oldCookie);

      // 新 Cookie 可用
      const req = new NextRequest('http://localhost/api/auth/session', { method: 'GET' });
      req.cookies.set(SESSION_COOKIE_NAME, newCookie!);
      const res = await sessionGet(req);
      expect(res.status).toBe(200);
    });

    it('改密后旧 JWT 被拒绝（token_version 递增）', async () => {
      const { email, authHash } = await registerTestUser();
      // 登录获取旧 Cookie
      const loginRes = await loginPost(
        makeJsonRequest('http://localhost/api/auth/login', { email, authHash }),
      );
      const oldCookie = loginRes.cookies.get(SESSION_COOKIE_NAME)?.value;

      // 模拟改密 / 恢复码重置：token_version 递增使旧 JWT 失效
      // （recover API 内部执行 token_version = token_version + 1）
      await db.query(
        'UPDATE users SET token_version = token_version + 1 WHERE email_normalized = $1',
        ['user@auth.test'],
      );

      // 旧 Cookie 应被拒绝
      const req = new NextRequest('http://localhost/api/auth/session', { method: 'GET' });
      req.cookies.set(SESSION_COOKIE_NAME, oldCookie!);
      const res = await sessionGet(req);
      expect(res.status).toBe(401);
      const json = await res.json();
      expect(json.code).toBe('SESSION_REVOKED');
    });

    it('无 ver 字段的旧版 JWT 被拒绝（兼容性）', async () => {
      const { sessionCookie } = await registerTestUser();
      // 解码 JWT，移除 ver 字段后重新签发（模拟旧版无 ver 的 token）
      const { SignJWT } = await import('jose');
      const realSecret = new TextEncoder().encode(process.env.JWT_SECRET);
      const forgedToken = await new SignJWT({ email: 'user@auth.test' })
        .setProtectedHeader({ alg: 'HS256' })
        .setSubject('fake-user-id')
        .setIssuedAt()
        .setExpirationTime('30d')
        .sign(realSecret);

      const req = new NextRequest('http://localhost/api/auth/session', { method: 'GET' });
      req.cookies.set(SESSION_COOKIE_NAME, forgedToken);
      const res = await sessionGet(req);
      // 无 ver 字段 → verifyTokenVersion 返回 false → 401
      expect(res.status).toBe(401);
      void sessionCookie; // 仅用于注册用户确保 DB 状态就绪
    });
  });
});
