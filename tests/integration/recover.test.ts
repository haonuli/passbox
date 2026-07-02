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
 * - [x] 阶段二 recover：recovery_code_hash 不变（恢复码仍可复用）
 * - [x] 阶段二 recover：错误恢复码 / 邮箱不存在 → 401（防枚举）
 * - [x] 阶段二 recover：重置后新会话 Cookie 可用于 session API
 */
describe('T3.8 恢复码数据恢复 API 集成测试', () => {
  beforeAll(async () => {
    await runMigrations();
  });

  beforeEach(async () => {
    // 清理本测试文件创建的用户（使用 @recover.test 域名隔离）
    await db.query("DELETE FROM users WHERE email_normalized LIKE '%@recover.test'");
  });

  afterAll(async () => {
    await db.end();
  });

  // ============================================================
  // 测试辅助函数
  // ============================================================

  const TEST_AUTH_HASH = 'dGhpcy1pcy1hLXNlY3JldC1oYXNo'; // base64(32 bytes)
  const NEW_AUTH_HASH = 'bmV3LWF1dGgtaGFzaC1mb3ItcmVjb3Zlcg=='; // base64(32 bytes)

  function makeEncryptedData(): EncryptedData {
    return {
      v: 1,
      iv: 'AAAAAAAAAAAAAAAA',
      ct: 'AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA=',
    };
  }

  /** 与注册时不同的加密数据，用于验证重置后 encrypted_key 已更新 */
  function makeNewEncryptedData(): EncryptedData {
    return {
      v: 1,
      iv: 'BBBBBBBBBBBBBBBB',
      ct: 'BBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBB=',
    };
  }

  function makeKdfSalt(): string {
    return 'AAAAAAAAAAAAAAAAAAAAAA=='; // 16 bytes base64
  }

  /**
   * 新 KDF salt，与注册时不同。
   * 使用 Buffer 生成确保 base64 为规范形式（尾部 padding bits 为 0），
   * 避免 decode → store → read → encode 往返后字符串不一致。
   */
  function makeNewKdfSalt(): string {
    return Buffer.alloc(16, 0x04).toString('base64'); // 16 bytes of 0x04
  }

  const DEFAULT_KDF_PARAMS = {
    type: 'argon2id' as const,
    memoryKib: 65536,
    iterations: 3,
    parallelism: 4,
  };

  /**
   * 注册一个测试用户，返回邮箱、明文恢复码与注册时存储的加密数据。
   * 注意：恢复码明文仅在注册时返回一次，此处通过 generateRecoveryCode 生成后传入。
   */
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
    return {
      email,
      recoveryCode,
      encryptedKey,
      recoveryEncryptedKey,
      kdfSalt,
      userId: json.user.id,
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
        makeJsonRequest('http://localhost/api/auth/recover/verify', {
          email,
          recoveryCode,
        }),
      );
      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json).toHaveProperty('user.id');
      expect(json).toHaveProperty('user.email', email);
      // recoveryEncryptedKey 与注册时存储一致
      expect(json.recoveryEncryptedKey).toMatchObject(recoveryEncryptedKey);
    });

    it('错误恢复码 → 401 + "恢复码无效"', async () => {
      const { email } = await registerTestUser();
      // 生成另一个恢复码（与注册时不同）
      const { formatted: wrongCode } = generateRecoveryCode();
      const res = await recoverVerifyPost(
        makeJsonRequest('http://localhost/api/auth/recover/verify', {
          email,
          recoveryCode: wrongCode,
        }),
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
      const json = await res.json();
      // 错误信息与恢复码错误时一致（不泄露邮箱是否存在）
      expect(json.error).toBe('恢复码无效');
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
        makeJsonRequest('http://localhost/api/auth/recover/verify', {
          email,
          recoveryCode: 'INVALID-CODE',
        }),
      );
      expect(res.status).toBe(400);
    });

    it('请求体非 JSON → 400', async () => {
      const res = await recoverVerifyPost(
        new NextRequest('http://localhost/api/auth/recover/verify', {
          method: 'POST',
          body: 'not-json',
          headers: { 'Content-Type': 'application/json' },
        }),
      );
      expect(res.status).toBe(400);
    });

    it('邮箱大小写不敏感（归一化匹配）', async () => {
      const { recoveryCode, recoveryEncryptedKey } = await registerTestUser(
        'User@Recover.Test',
      );
      const res = await recoverVerifyPost(
        makeJsonRequest('http://localhost/api/auth/recover/verify', {
          email: 'user@recover.test',
          recoveryCode,
        }),
      );
      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.recoveryEncryptedKey).toMatchObject(recoveryEncryptedKey);
    });
  });

  // ============================================================
  // 阶段二：POST /api/auth/recover
  // ============================================================

  describe('POST /api/auth/recover（阶段二：重置主密码）', () => {
    it('正确恢复码 + 新参数 → 200 + 新会话 Cookie', async () => {
      const { email, recoveryCode } = await registerTestUser();
      const res = await recoverPost(
        makeJsonRequest('http://localhost/api/auth/recover', {
          email,
          recoveryCode,
          newAuthHash: NEW_AUTH_HASH,
          newEncryptedKey: makeNewEncryptedData(),
          newKdfSalt: makeNewKdfSalt(),
          newKdfParams: DEFAULT_KDF_PARAMS,
        }),
      );
      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json).toHaveProperty('user.id');
      expect(json).toHaveProperty('user.email', email);
      // 新会话 Cookie 已设置
      const cookie = res.cookies.get(SESSION_COOKIE_NAME);
      expect(cookie?.value).toBeTruthy();
    });

    it('重置后 password_hash / encrypted_key / kdf_salt 均已更新', async () => {
      const { email, recoveryCode, userId } = await registerTestUser();
      await recoverPost(
        makeJsonRequest('http://localhost/api/auth/recover', {
          email,
          recoveryCode,
          newAuthHash: NEW_AUTH_HASH,
          newEncryptedKey: makeNewEncryptedData(),
          newKdfSalt: makeNewKdfSalt(),
          newKdfParams: DEFAULT_KDF_PARAMS,
        }),
      );
      const result = await db.query(
        'SELECT password_hash, encrypted_key, kdf_salt FROM users WHERE id = $1',
        [userId],
      );
      const row = result.rows[0];
      // password_hash 已更新为新 authHash 的 bcrypt 哈希（不等于原值，且是 bcrypt 格式）
      expect(row.password_hash).toMatch(/^\$2[aby]?\$/);
      // encrypted_key 已更新为新值
      expect(row.encrypted_key).toBe(JSON.stringify(makeNewEncryptedData()));
      // kdf_salt 已更新为新值
      expect((row.kdf_salt as Buffer).toString('base64')).toBe(makeNewKdfSalt());
    });

    it('重置后 failed_login_attempts / locked_until 已清空', async () => {
      const { email, recoveryCode, userId } = await registerTestUser();
      // 制造锁定状态：直接更新数据库模拟失败次数
      await db.query(
        'UPDATE users SET failed_login_attempts = 5, locked_until = NOW() + INTERVAL \'15 minutes\' WHERE id = $1',
        [userId],
      );
      await recoverPost(
        makeJsonRequest('http://localhost/api/auth/recover', {
          email,
          recoveryCode,
          newAuthHash: NEW_AUTH_HASH,
          newEncryptedKey: makeNewEncryptedData(),
          newKdfSalt: makeNewKdfSalt(),
          newKdfParams: DEFAULT_KDF_PARAMS,
        }),
      );
      const result = await db.query(
        'SELECT failed_login_attempts, locked_until FROM users WHERE id = $1',
        [userId],
      );
      expect(result.rows[0].failed_login_attempts).toBe(0);
      expect(result.rows[0].locked_until).toBeNull();
    });

    it('重置后 recovery_code_hash 不变（恢复码仍可复用）', async () => {
      const { email, recoveryCode, userId } = await registerTestUser();
      // 重置前的 recovery_code_hash
      const before = await db.query(
        'SELECT recovery_code_hash FROM users WHERE id = $1',
        [userId],
      );
      const hashBefore = before.rows[0].recovery_code_hash;
      // 执行重置
      await recoverPost(
        makeJsonRequest('http://localhost/api/auth/recover', {
          email,
          recoveryCode,
          newAuthHash: NEW_AUTH_HASH,
          newEncryptedKey: makeNewEncryptedData(),
          newKdfSalt: makeNewKdfSalt(),
          newKdfParams: DEFAULT_KDF_PARAMS,
        }),
      );
      // 重置后的 recovery_code_hash 应保持不变
      const after = await db.query(
        'SELECT recovery_code_hash FROM users WHERE id = $1',
        [userId],
      );
      expect(after.rows[0].recovery_code_hash).toBe(hashBefore);
    });

    it('重置后新会话 Cookie 可用于 session API', async () => {
      const { email, recoveryCode } = await registerTestUser();
      const recoverRes = await recoverPost(
        makeJsonRequest('http://localhost/api/auth/recover', {
          email,
          recoveryCode,
          newAuthHash: NEW_AUTH_HASH,
          newEncryptedKey: makeNewEncryptedData(),
          newKdfSalt: makeNewKdfSalt(),
          newKdfParams: DEFAULT_KDF_PARAMS,
        }),
      );
      const cookie = recoverRes.cookies.get(SESSION_COOKIE_NAME)?.value;
      expect(cookie).toBeTruthy();

      // 用新 Cookie 调用 session API
      const req = new NextRequest('http://localhost/api/auth/session', {
        method: 'GET',
      });
      req.cookies.set(SESSION_COOKIE_NAME, cookie!);
      const sessionRes = await sessionGet(req);
      expect(sessionRes.status).toBe(200);
      const json = await sessionRes.json();
      expect(json).toHaveProperty('user.email', email);
      // session 返回的 encryptedKey 应为重置后的新值
      expect(json.encryptedKey).toMatchObject(makeNewEncryptedData());
      // session 返回的 kdfSalt 应为重置后的新值
      expect(json.kdfSalt).toBe(makeNewKdfSalt());
    });

    it('错误恢复码 → 401 + "恢复码无效"', async () => {
      const { email } = await registerTestUser();
      const { formatted: wrongCode } = generateRecoveryCode();
      const res = await recoverPost(
        makeJsonRequest('http://localhost/api/auth/recover', {
          email,
          recoveryCode: wrongCode,
          newAuthHash: NEW_AUTH_HASH,
          newEncryptedKey: makeNewEncryptedData(),
          newKdfSalt: makeNewKdfSalt(),
          newKdfParams: DEFAULT_KDF_PARAMS,
        }),
      );
      expect(res.status).toBe(401);
      const json = await res.json();
      expect(json.error).toBe('恢复码无效');
    });

    it('邮箱不存在 → 401 + 相同错误信息（防枚举）', async () => {
      const { formatted: recoveryCode } = generateRecoveryCode();
      const res = await recoverPost(
        makeJsonRequest('http://localhost/api/auth/recover', {
          email: 'nobody@recover.test',
          recoveryCode,
          newAuthHash: NEW_AUTH_HASH,
          newEncryptedKey: makeNewEncryptedData(),
          newKdfSalt: makeNewKdfSalt(),
          newKdfParams: DEFAULT_KDF_PARAMS,
        }),
      );
      expect(res.status).toBe(401);
      const json = await res.json();
      expect(json.error).toBe('恢复码无效');
    });

    it('无效邮箱格式 → 400', async () => {
      const { formatted: recoveryCode } = generateRecoveryCode();
      const res = await recoverPost(
        makeJsonRequest('http://localhost/api/auth/recover', {
          email: 'not-an-email',
          recoveryCode,
          newAuthHash: NEW_AUTH_HASH,
          newEncryptedKey: makeNewEncryptedData(),
          newKdfSalt: makeNewKdfSalt(),
          newKdfParams: DEFAULT_KDF_PARAMS,
        }),
      );
      expect(res.status).toBe(400);
    });

    it('恢复码格式错误 → 400', async () => {
      const { email } = await registerTestUser();
      const res = await recoverPost(
        makeJsonRequest('http://localhost/api/auth/recover', {
          email,
          recoveryCode: 'INVALID-CODE',
          newAuthHash: NEW_AUTH_HASH,
          newEncryptedKey: makeNewEncryptedData(),
          newKdfSalt: makeNewKdfSalt(),
          newKdfParams: DEFAULT_KDF_PARAMS,
        }),
      );
      expect(res.status).toBe(400);
    });

    it('缺少必填字段 newAuthHash → 400', async () => {
      const { email, recoveryCode } = await registerTestUser();
      const res = await recoverPost(
        makeJsonRequest('http://localhost/api/auth/recover', {
          email,
          recoveryCode,
          // 缺少 newAuthHash
          newEncryptedKey: makeNewEncryptedData(),
          newKdfSalt: makeNewKdfSalt(),
          newKdfParams: DEFAULT_KDF_PARAMS,
        }),
      );
      expect(res.status).toBe(400);
    });

    it('encryptedKey 结构无效 → 400', async () => {
      const { email, recoveryCode } = await registerTestUser();
      const res = await recoverPost(
        makeJsonRequest('http://localhost/api/auth/recover', {
          email,
          recoveryCode,
          newAuthHash: NEW_AUTH_HASH,
          // 缺少 iv / ct
          newEncryptedKey: { v: 1 },
          newKdfSalt: makeNewKdfSalt(),
          newKdfParams: DEFAULT_KDF_PARAMS,
        }),
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

      // 阶段一：verify 返回 recoveryEncryptedKey
      const verifyRes = await recoverVerifyPost(
        makeJsonRequest('http://localhost/api/auth/recover/verify', {
          email,
          recoveryCode,
        }),
      );
      expect(verifyRes.status).toBe(200);
      const verifyJson = await verifyRes.json();
      expect(verifyJson.recoveryEncryptedKey).toMatchObject(recoveryEncryptedKey);

      // 阶段二：用同一恢复码重置主密码
      const recoverRes = await recoverPost(
        makeJsonRequest('http://localhost/api/auth/recover', {
          email,
          recoveryCode,
          newAuthHash: NEW_AUTH_HASH,
          newEncryptedKey: makeNewEncryptedData(),
          newKdfSalt: makeNewKdfSalt(),
          newKdfParams: DEFAULT_KDF_PARAMS,
        }),
      );
      expect(recoverRes.status).toBe(200);

      // 验证新会话 Cookie 有效
      const cookie = recoverRes.cookies.get(SESSION_COOKIE_NAME)?.value;
      expect(cookie).toBeTruthy();
      const payload = await verifySession(cookie);
      expect(payload?.sub).toBeTruthy();
    });

    it('阶段一用错误恢复码失败后，阶段二仍可用正确恢复码重置', async () => {
      const { email, recoveryCode } = await registerTestUser();
      const { formatted: wrongCode } = generateRecoveryCode();

      // 阶段一用错误恢复码 → 401
      const failRes = await recoverVerifyPost(
        makeJsonRequest('http://localhost/api/auth/recover/verify', {
          email,
          recoveryCode: wrongCode,
        }),
      );
      expect(failRes.status).toBe(401);

      // 阶段一再用正确恢复码 → 200
      const okRes = await recoverVerifyPost(
        makeJsonRequest('http://localhost/api/auth/recover/verify', {
          email,
          recoveryCode,
        }),
      );
      expect(okRes.status).toBe(200);

      // 阶段二重置 → 200
      const recoverRes = await recoverPost(
        makeJsonRequest('http://localhost/api/auth/recover', {
          email,
          recoveryCode,
          newAuthHash: NEW_AUTH_HASH,
          newEncryptedKey: makeNewEncryptedData(),
          newKdfSalt: makeNewKdfSalt(),
          newKdfParams: DEFAULT_KDF_PARAMS,
        }),
      );
      expect(recoverRes.status).toBe(200);
    });
  });
});
