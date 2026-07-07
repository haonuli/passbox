// @vitest-environment node
import { describe, it, expect, beforeAll, beforeEach, afterAll } from 'vitest';
import { NextRequest } from 'next/server';
import { db } from '@/lib/db';
import { runMigrations } from '@/lib/migrate';
import { generateRecoveryCode } from '@/lib/recovery-code';
import { SESSION_COOKIE_NAME, verifySession } from '@/lib/session';
import { POST as registerPost } from '@/app/api/auth/register/route';
import { POST as recoverVerifyPost } from '@/app/api/auth/recover/verify/route';
import { POST as recoverPost } from '@/app/api/auth/recover/route';
import { GET as sessionGet } from '@/app/api/auth/session/route';
import type { EncryptedData } from '@/types/crypto';

/**
 * T3.8 恢复码数据恢复 API 集成测试（TS-3.8）
 *
 * 验收标准（TASK_BREAKDOWN.md T3.8）：
 * - [x] 阶段一 verify：正确恢复码 → 200 + recoveryEncryptedKey
 * - [x] 阶段一 verify：错误恢复码 → 401 + "恢复码无效"
 * - [x] 阶段一 verify：邮箱不存在 → 401 + 相同错误信息（防枚举 SEC-10）
 * - [x] 阶段一 verify：无效邮箱 / 恢复码格式 → 400
 * - [x] 阶段二 recover：正确恢复码 + 新参数 → 200 + 新会话 Cookie
 * - [x] 阶段二 recover：password_hash / encrypted_key / kdf_salt 均已更新
 * - [x] 阶段二 recover：failed_login_attempts / locked_until 已清空
 * - [x] M-15：recovery_code_hash 已轮换（旧恢复码失效，新恢复码可用）
 * - [x] 阶段二 recover：错误恢复码 / 邮箱不存在 → 401（防枚举）
 * - [x] 阶段二 recover：重置后新会话 Cookie 可用于 session API
 */
describe('T3.8 恢复码数据恢复 API 集成测试', () => {
  beforeAll(async () => {
    await runMigrations();
  });

  beforeEach(async () => {
    await db.query("DELETE FROM users WHERE email_normalized LIKE '%@recover.test'");
  });

  afterAll(async () => {
    await db.end();
  });

  // ============================================================
  // 测试辅助函数
  // ============================================================

  const TEST_AUTH_HASH = 'dGhpcy1pcy1hLXNlY3JldC1oYXNo';
  const NEW_AUTH_HASH = 'bmV3LWF1dGgtaGFzaC1mb3ItcmVjb3Zlcg==';

  function makeEncryptedData(): EncryptedData {
    return { v: 1, iv: 'AAAAAAAAAAAAAAAA', ct: 'AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA=' };
  }

  function makeNewEncryptedData(): EncryptedData {
    return { v: 1, iv: 'BBBBBBBBBBBBBBBB', ct: 'BBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBB=' };
  }

  function makeKdfSalt(): string {
    return 'AAAAAAAAAAAAAAAAAAAAAA==';
  }

  function makeNewKdfSalt(): string {
    return Buffer.alloc(16, 0x04).toString('base64');
  }

  const DEFAULT_KDF_PARAMS = {
    type: 'argon2id' as const,
    memoryKib: 65536,
    iterations: 3,
    parallelism: 4,
  };

  async function registerTestUser(
    email = 'user@recover.test',
  ): Promise<{
    email: string;
    recoveryCode: string;
    encryptedKey: EncryptedData;
    recoveryEncryptedKey: EncryptedData;
    kdfSalt: string;
    userId: string;
  }> {
    const { formatted: recoveryCode } = generateRecoveryCode();
    const encryptedKey = makeEncryptedData();
    const recoveryEncryptedKey = makeEncryptedData();
    const kdfSalt = makeKdfSalt();
    const body = {
      email,
      authHash: TEST_AUTH_HASH,
      encryptedKey,
      kdfSalt,
      kdfParams: DEFAULT_KDF_PARAMS,
      recoveryCode,
      recoveryEncryptedKey,
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
    return { email, recoveryCode, encryptedKey, recoveryEncryptedKey, kdfSalt, userId: json.user.id };
  }

  /** 构造恢复重置请求体（M-15：含新恢复码轮换字段） */
  function makeRecoverBody(overrides: Record<string, unknown> = {}): Record<string, unknown> {
    const { formatted: newRecoveryCode } = generateRecoveryCode();
    return {
      email: 'user@recover.test',
      recoveryCode: '',
      newAuthHash: NEW_AUTH_HASH,
      newEncryptedKey: makeNewEncryptedData(),
      newKdfSalt: makeNewKdfSalt(),
      newKdfParams: DEFAULT_KDF_PARAMS,
      newRecoveryCode,
      newRecoveryEncryptedKey: makeNewEncryptedData(),
      ...overrides,
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
  // 阶段一：POST /api/auth/recover/verify
  // ============================================================

  describe('POST /api/auth/recover/verify（阶段一：验证恢复码）', () => {
    it('正确恢复码 → 200 + recoveryEncryptedKey', async () => {
      const { email, recoveryCode, recoveryEncryptedKey } = await registerTestUser();
      const res = await recoverVerifyPost(
        makeJsonRequest('http://localhost/api/auth/recover/verify', { email, recoveryCode }),
      );
      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json).toHaveProperty('user.id');
      expect(json).toHaveProperty('user.email', email);
      expect(json.recoveryEncryptedKey).toMatchObject(recoveryEncryptedKey);
    });

    it('错误恢复码 → 401 + "恢复码无效"', async () => {
      const { email } = await registerTestUser();
      const { formatted: wrongCode } = generateRecoveryCode();
      const res = await recoverVerifyPost(
        makeJsonRequest('http://localhost/api/auth/recover/verify', { email, recoveryCode: wrongCode }),
      );
      expect(res.status).toBe(401);
      const json = await res.json();
      expect(json.error).toBe('恢复码无效');
      expect(json.code).toBe('INVALID_RECOVERY_CODE');
    });

    it('邮箱不存在 → 401 + 相同错误信息（防枚举 SEC-10）', async () => {
      const { formatted: recoveryCode } = generateRecoveryCode();
      const res = await recoverVerifyPost(
        makeJsonRequest('http://localhost/api/auth/recover/verify', {
          email: 'nobody@recover.test',
          recoveryCode,
        }),
      );
      expect(res.status).toBe(401);
      expect((await res.json()).error).toBe('恢复码无效');
    });

    it('无效邮箱格式 → 400', async () => {
      const { formatted: recoveryCode } = generateRecoveryCode();
      const res = await recoverVerifyPost(
        makeJsonRequest('http://localhost/api/auth/recover/verify', {
          email: 'not-an-email',
          recoveryCode,
        }),
      );
      expect(res.status).toBe(400);
    });

    it('恢复码格式错误 → 400', async () => {
      const { email } = await registerTestUser();
      const res = await recoverVerifyPost(
        makeJsonRequest('http://localhost/api/auth/recover/verify', { email, recoveryCode: 'INVALID-CODE' }),
      );
      expect(res.status).toBe(400);
    });

    it('邮箱大小写不敏感（归一化匹配）', async () => {
      const { recoveryCode, recoveryEncryptedKey } = await registerTestUser('User@Recover.Test');
      const res = await recoverVerifyPost(
        makeJsonRequest('http://localhost/api/auth/recover/verify', {
          email: 'user@recover.test',
          recoveryCode,
        }),
      );
      expect(res.status).toBe(200);
      expect((await res.json()).recoveryEncryptedKey).toMatchObject(recoveryEncryptedKey);
    });
  });

  // ============================================================
  // 阶段二：POST /api/auth/recover
  // ============================================================

  describe('POST /api/auth/recover（阶段二：重置主密码 + M-15 恢复码轮换）', () => {
    it('正确恢复码 + 新参数 → 200 + 新会话 Cookie + 新恢复码', async () => {
      const { email, recoveryCode } = await registerTestUser();
      const res = await recoverPost(
        makeJsonRequest('http://localhost/api/auth/recover', makeRecoverBody({ email, recoveryCode })),
      );
      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json).toHaveProperty('user.id');
      expect(json).toHaveProperty('user.email', email);
      expect(json).toHaveProperty('recoveryCode'); // M-15：返回新恢复码
      expect(json.recoveryCode).not.toBe(recoveryCode); // 新恢复码与旧不同
      const cookie = res.cookies.get(SESSION_COOKIE_NAME);
      expect(cookie?.value).toBeTruthy();
    });

    it('重置后 password_hash / encrypted_key / kdf_salt 均已更新', async () => {
      const { email, recoveryCode, userId } = await registerTestUser();
      await recoverPost(
        makeJsonRequest('http://localhost/api/auth/recover', makeRecoverBody({ email, recoveryCode })),
      );
      const result = await db.query(
        'SELECT password_hash, encrypted_key, kdf_salt FROM users WHERE id = $1',
        [userId],
      );
      const row = result.rows[0];
      expect(row.password_hash).toMatch(/^\$2[aby]?\$/);
      expect(row.encrypted_key).toBe(JSON.stringify(makeNewEncryptedData()));
      expect((row.kdf_salt as Buffer).toString('base64')).toBe(makeNewKdfSalt());
    });

    it('重置后 failed_login_attempts / locked_until 已清空', async () => {
      const { email, recoveryCode, userId } = await registerTestUser();
      await db.query(
        "UPDATE users SET failed_login_attempts = 5, locked_until = NOW() + INTERVAL '15 minutes' WHERE id = $1",
        [userId],
      );
      await recoverPost(
        makeJsonRequest('http://localhost/api/auth/recover', makeRecoverBody({ email, recoveryCode })),
      );
      const result = await db.query(
        'SELECT failed_login_attempts, locked_until FROM users WHERE id = $1',
        [userId],
      );
      expect(result.rows[0].failed_login_attempts).toBe(0);
      expect(result.rows[0].locked_until).toBeNull();
    });

    it('M-15：重置后 recovery_code_hash 已轮换（旧恢复码失效）', async () => {
      const { email, recoveryCode, userId } = await registerTestUser();
      const before = await db.query('SELECT recovery_code_hash FROM users WHERE id = $1', [userId]);
      const hashBefore = before.rows[0].recovery_code_hash;

      const res = await recoverPost(
        makeJsonRequest('http://localhost/api/auth/recover', makeRecoverBody({ email, recoveryCode })),
      );
      const json = await res.json();

      const after = await db.query('SELECT recovery_code_hash FROM users WHERE id = $1', [userId]);
      expect(after.rows[0].recovery_code_hash).not.toBe(hashBefore); // hash 已轮换

      // 旧恢复码不再可用（verify 返回 401）
      const verifyOldRes = await recoverVerifyPost(
        makeJsonRequest('http://localhost/api/auth/recover/verify', { email, recoveryCode }),
      );
      expect(verifyOldRes.status).toBe(401);

      // 新恢复码可用（verify 返回 200）
      const verifyNewRes = await recoverVerifyPost(
        makeJsonRequest('http://localhost/api/auth/recover/verify', {
          email,
          recoveryCode: json.recoveryCode,
        }),
      );
      expect(verifyNewRes.status).toBe(200);
    });

    it('重置后新会话 Cookie 可用于 session API', async () => {
      const { email, recoveryCode } = await registerTestUser();
      const recoverRes = await recoverPost(
        makeJsonRequest('http://localhost/api/auth/recover', makeRecoverBody({ email, recoveryCode })),
      );
      const cookie = recoverRes.cookies.get(SESSION_COOKIE_NAME)?.value;
      expect(cookie).toBeTruthy();

      const req = new NextRequest('http://localhost/api/auth/session', { method: 'GET' });
      req.cookies.set(SESSION_COOKIE_NAME, cookie!);
      const sessionRes = await sessionGet(req);
      expect(sessionRes.status).toBe(200);
      const json = await sessionRes.json();
      expect(json).toHaveProperty('user.email', email);
      expect(json.encryptedKey).toMatchObject(makeNewEncryptedData());
      expect(json.kdfSalt).toBe(makeNewKdfSalt());
    });

    it('错误恢复码 → 401 + "恢复码无效"', async () => {
      const { email } = await registerTestUser();
      const { formatted: wrongCode } = generateRecoveryCode();
      const res = await recoverPost(
        makeJsonRequest('http://localhost/api/auth/recover', makeRecoverBody({ email, recoveryCode: wrongCode })),
      );
      expect(res.status).toBe(401);
      expect((await res.json()).error).toBe('恢复码无效');
    });

    it('邮箱不存在 → 401 + 相同错误信息（防枚举）', async () => {
      const { formatted: recoveryCode } = generateRecoveryCode();
      const res = await recoverPost(
        makeJsonRequest('http://localhost/api/auth/recover', makeRecoverBody({
          email: 'nobody@recover.test',
          recoveryCode,
        })),
      );
      expect(res.status).toBe(401);
      expect((await res.json()).error).toBe('恢复码无效');
    });

    it('无效邮箱格式 → 400', async () => {
      const { formatted: recoveryCode } = generateRecoveryCode();
      const res = await recoverPost(
        makeJsonRequest('http://localhost/api/auth/recover', makeRecoverBody({
          email: 'not-an-email',
          recoveryCode,
        })),
      );
      expect(res.status).toBe(400);
    });

    it('恢复码格式错误 → 400', async () => {
      const { email } = await registerTestUser();
      const res = await recoverPost(
        makeJsonRequest('http://localhost/api/auth/recover', makeRecoverBody({
          email,
          recoveryCode: 'INVALID-CODE',
        })),
      );
      expect(res.status).toBe(400);
    });

    it('缺少必填字段 newAuthHash → 400', async () => {
      const { email, recoveryCode } = await registerTestUser();
      const body = makeRecoverBody({ email, recoveryCode });
      delete body.newAuthHash;
      const res = await recoverPost(makeJsonRequest('http://localhost/api/auth/recover', body));
      expect(res.status).toBe(400);
    });

    it('M-15：缺少 newRecoveryCode → 400', async () => {
      const { email, recoveryCode } = await registerTestUser();
      const body = makeRecoverBody({ email, recoveryCode });
      delete body.newRecoveryCode;
      const res = await recoverPost(makeJsonRequest('http://localhost/api/auth/recover', body));
      expect(res.status).toBe(400);
    });

    it('encryptedKey 结构无效 → 400', async () => {
      const { email, recoveryCode } = await registerTestUser();
      const res = await recoverPost(
        makeJsonRequest('http://localhost/api/auth/recover', makeRecoverBody({
          email,
          recoveryCode,
          newEncryptedKey: { v: 1 },
        })),
      );
      expect(res.status).toBe(400);
    });
  });

  // ============================================================
  // 端到端：阶段一 + 阶段二完整流程
  // ============================================================

  describe('端到端：阶段一 → 阶段二完整恢复流程', () => {
    it('完整流程：verify 解密 → recover 重置 → 新会话可用', async () => {
      const { email, recoveryCode, recoveryEncryptedKey } = await registerTestUser();

      const verifyRes = await recoverVerifyPost(
        makeJsonRequest('http://localhost/api/auth/recover/verify', { email, recoveryCode }),
      );
      expect(verifyRes.status).toBe(200);
      expect((await verifyRes.json()).recoveryEncryptedKey).toMatchObject(recoveryEncryptedKey);

      const recoverRes = await recoverPost(
        makeJsonRequest('http://localhost/api/auth/recover', makeRecoverBody({ email, recoveryCode })),
      );
      expect(recoverRes.status).toBe(200);

      const cookie = recoverRes.cookies.get(SESSION_COOKIE_NAME)?.value;
      expect(cookie).toBeTruthy();
      const payload = await verifySession(cookie);
      expect(payload?.sub).toBeTruthy();
    });

    it('M-15：重置后旧恢复码不可再次重置（轮换生效）', async () => {
      const { email, recoveryCode } = await registerTestUser();

      // 第一次重置：成功
      const res1 = await recoverPost(
        makeJsonRequest('http://localhost/api/auth/recover', makeRecoverBody({ email, recoveryCode })),
      );
      expect(res1.status).toBe(200);

      // 用旧恢复码再次重置：应失败（401）
      const res2 = await recoverPost(
        makeJsonRequest('http://localhost/api/auth/recover', makeRecoverBody({ email, recoveryCode })),
      );
      expect(res2.status).toBe(401);
    });
  });
});
