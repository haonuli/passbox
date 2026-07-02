// @vitest-environment node
import { describe, it, expect, beforeAll, beforeEach, afterAll } from 'vitest';
import { NextRequest } from 'next/server';
import { db } from '@/lib/db';
import { runMigrations } from '@/lib/migrate';
import { generateRecoveryCode } from '@/lib/recovery-code';
import { SESSION_COOKIE_NAME } from '@/lib/session';
import { POST } from '@/app/api/auth/register/route';
import type { EncryptedData } from '@/types/crypto';

/**
 * T3.2 注册 API 集成测试（TS-3.2）
 *
 * 验收标准（TASK_BREAKDOWN.md T3.2）：
 * - [x] 请求参数经 zod schema 校验，非法参数返回 400
 * - [x] email_normalized（小写 + trim）唯一约束，重复注册返回 409
 * - [x] 恢复码格式校验（PBOX-XXXX-XXXX-XXXX-XXXX）
 * - [x] password_hash 存储 bcrypt(authHash)，recovery_code_hash 存储 bcrypt(recoveryCode)
 * - [x] 注册成功后创建默认保险库
 * - [x] 设置会话 Cookie，返回 recoveryCode 明文（仅此一次）
 * - [x] 使用事务保证 users + vaults 原子创建
 * - [x] 日志不记录 authHash、recoveryCode 等敏感内容（SEC-10）
 */
describe('T3.2 注册 API 集成测试', () => {
  beforeAll(async () => {
    await runMigrations();
  });

  beforeEach(async () => {
    // 仅清理本测试文件创建的用户（使用 @register.test 域名隔离），
    // 避免 TRUNCATE 影响并行执行的 migrate.test.ts 等其他测试文件。
    await db.query("DELETE FROM users WHERE email_normalized LIKE '%@register.test'");
  });

  afterAll(async () => {
    await db.end();
  });

  // ============================================================
  // 测试辅助函数
  // ============================================================

  /** 构造合法的 EncryptedData 占位对象 */
  function makeEncryptedData(): EncryptedData {
    return {
      v: 1,
      iv: 'AAAAAAAAAAAAAAAA', // 12 bytes base64
      ct: 'AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA=', // 32 bytes base64
    };
  }

  /** 构造合法的 base64(16 bytes) salt */
  function makeKdfSalt(): string {
    return 'AAAAAAAAAAAAAAAAAAAAAA=='; // 16 bytes base64
  }

  /** 构造合法的 base64(32 bytes) authHash */
  function makeAuthHash(): string {
    return 'AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA='; // 32 bytes base64
  }

  /** 默认 KDF 参数 */
  const DEFAULT_KDF_PARAMS = {
    type: 'argon2id' as const,
    memoryKib: 65536,
    iterations: 3,
    parallelism: 4,
  };

  /** 构造完整注册请求体 */
  function makeRegisterBody(overrides: Record<string, unknown> = {}): Record<string, unknown> {
    const { formatted: recoveryCode } = generateRecoveryCode();
    return {
      email: 'test@register.test',
      authHash: makeAuthHash(),
      encryptedKey: makeEncryptedData(),
      kdfSalt: makeKdfSalt(),
      kdfParams: DEFAULT_KDF_PARAMS,
      recoveryCode,
      recoveryEncryptedKey: makeEncryptedData(),
      defaultVaultNameEncrypted: makeEncryptedData(),
      ...overrides,
    };
  }

  /** 构造 POST NextRequest */
  function makeRequest(body: unknown): NextRequest {
    return new NextRequest('http://localhost/api/auth/register', {
      method: 'POST',
      body: JSON.stringify(body),
      headers: { 'Content-Type': 'application/json' },
    });
  }

  // ============================================================
  // 正常注册
  // ============================================================

  describe('正常注册', () => {
    it('合法请求返回 200 + RegisterResponse 结构', async () => {
      const body = makeRegisterBody();
      const response = await POST(makeRequest(body));
      const json = await response.json();

      expect(response.status).toBe(200);
      expect(json).toHaveProperty('user.id');
      expect(json).toHaveProperty('user.email', 'test@register.test');
      expect(json).toHaveProperty('recoveryCode');
      expect(json).toHaveProperty('defaultVaultId');
      // recoveryCode 应与请求中的一致（明文原样返回）
      expect(json.recoveryCode).toBe(body.recoveryCode);
    });

    it('返回的 user.id 与 defaultVaultId 为 UUID 格式', async () => {
      const response = await POST(makeRequest(makeRegisterBody()));
      const json = await response.json();
      const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
      expect(json.user.id).toMatch(uuidRegex);
      expect(json.defaultVaultId).toMatch(uuidRegex);
    });

    it('users 表写入正确记录（含 bcrypt 哈希与 KDF 参数）', async () => {
      const body = makeRegisterBody();
      await POST(makeRequest(body));

      const result = await db.query(
        'SELECT email, email_normalized, kdf_type, kdf_memory_kib, kdf_iterations, kdf_parallelism, password_hash, recovery_code_hash, encrypted_key, recovery_encrypted_key FROM users WHERE email_normalized = $1',
        ['test@register.test'],
      );
      expect(result.rows).toHaveLength(1);
      const user = result.rows[0];
      expect(user.email).toBe('test@register.test');
      expect(user.email_normalized).toBe('test@register.test');
      expect(user.kdf_type).toBe('argon2id');
      expect(user.kdf_memory_kib).toBe(65536);
      expect(user.kdf_iterations).toBe(3);
      expect(user.kdf_parallelism).toBe(4);
      // bcrypt 哈希应以 $2b$ 开头
      expect(user.password_hash).toMatch(/^\$2b\$/);
      expect(user.recovery_code_hash).toMatch(/^\$2b\$/);
      // 密文应以 JSON 字符串形式存储
      const encryptedKey = JSON.parse(user.encrypted_key);
      expect(encryptedKey).toMatchObject({ v: 1, iv: expect.any(String), ct: expect.any(String) });
    });

    it('bcrypt 哈希不等于明文（不可逆）', async () => {
      const body = makeRegisterBody();
      await POST(makeRequest(body));

      const result = await db.query(
        'SELECT password_hash, recovery_code_hash FROM users WHERE email_normalized = $1',
        ['test@register.test'],
      );
      const user = result.rows[0];
      // 哈希值不应包含明文 authHash / recoveryCode
      expect(user.password_hash).not.toContain(body.authHash);
      expect(user.recovery_code_hash).not.toContain(body.recoveryCode);
    });

    it('vaults 表创建默认保险库（display_order=0）', async () => {
      const body = makeRegisterBody();
      const response = await POST(makeRequest(body));
      const json = await response.json();

      const result = await db.query(
        'SELECT user_id, name_encrypted, display_order FROM vaults WHERE id = $1',
        [json.defaultVaultId],
      );
      expect(result.rows).toHaveLength(1);
      const vault = result.rows[0];
      expect(vault.user_id).toBe(json.user.id);
      expect(vault.display_order).toBe(0);
      // name_encrypted 应为客户端传入的加密 JSON
      const nameEncrypted = JSON.parse(vault.name_encrypted);
      expect(nameEncrypted).toMatchObject({ v: 1 });
    });

    it('设置会话 Cookie（HttpOnly + Secure + SameSite=Lax）', async () => {
      const response = await POST(makeRequest(makeRegisterBody()));
      const cookie = response.cookies.get(SESSION_COOKIE_NAME);
      expect(cookie).toBeDefined();
      expect(cookie?.value).toBeTruthy();
      expect(cookie?.httpOnly).toBe(true);
      expect(cookie?.secure).toBe(true);
      expect(cookie?.sameSite).toBe('lax');
    });

    it('邮箱自动 trim（前后空格被去除）', async () => {
      const body = makeRegisterBody({ email: '  test@register.test  ' });
      const response = await POST(makeRequest(body));
      const json = await response.json();
      expect(response.status).toBe(200);
      expect(json.user.email).toBe('test@register.test');
    });
  });

  // ============================================================
  // 邮箱重复与归一化
  // ============================================================

  describe('邮箱重复与归一化', () => {
    it('重复注册返回 409 + EMAIL_EXISTS', async () => {
      const body = makeRegisterBody();
      // 第一次注册成功
      const first = await POST(makeRequest(body));
      expect(first.status).toBe(200);
      // 第二次注册同邮箱
      const second = await POST(makeRequest(body));
      expect(second.status).toBe(409);
      const json = await second.json();
      expect(json).toHaveProperty('code', 'EMAIL_EXISTS');
    });

    it('邮箱大小写归一化：User@Register.TEST 与 user@register.test 视为重复', async () => {
      // 第一次用大写邮箱注册
      const first = await POST(makeRequest(makeRegisterBody({ email: 'User@Register.TEST' })));
      expect(first.status).toBe(200);
      // 第二次用小写邮箱注册 → 应识别为重复
      const second = await POST(makeRequest(makeRegisterBody({ email: 'user@register.test' })));
      expect(second.status).toBe(409);
    });

    it('重复注册后不创建额外 vault（事务回滚验证）', async () => {
      const body = makeRegisterBody();
      await POST(makeRequest(body));
      // 第二次注册失败
      await POST(makeRequest(body));
      // 应只有 1 个用户、1 个保险库（限定 @register.test 域名，避免并行测试文件残留数据干扰）
      const userCount = await db.query(
        "SELECT COUNT(*)::int AS c FROM users WHERE email_normalized LIKE '%@register.test'",
      );
      const vaultCount = await db.query(
        `SELECT COUNT(*)::int AS c FROM vaults WHERE user_id IN (
           SELECT id FROM users WHERE email_normalized LIKE '%@register.test'
         )`,
      );
      expect(userCount.rows[0].c).toBe(1);
      expect(vaultCount.rows[0].c).toBe(1);
    });
  });

  // ============================================================
  // 参数校验
  // ============================================================

  describe('参数校验（zod）', () => {
    it('非法 JSON body 返回 400', async () => {
      const req = new NextRequest('http://localhost/api/auth/register', {
        method: 'POST',
        body: 'not-json{',
        headers: { 'Content-Type': 'application/json' },
      });
      const response = await POST(req);
      expect(response.status).toBe(400);
    });

    it('无效邮箱返回 400', async () => {
      const response = await POST(makeRequest(makeRegisterBody({ email: 'not-an-email' })));
      expect(response.status).toBe(400);
    });

    it('缺少 email 字段返回 400', async () => {
      const body = makeRegisterBody();
      delete body.email;
      const response = await POST(makeRequest(body));
      expect(response.status).toBe(400);
    });

    it('缺少 authHash 返回 400', async () => {
      const body = makeRegisterBody();
      delete body.authHash;
      const response = await POST(makeRequest(body));
      expect(response.status).toBe(400);
    });

    it('缺少 recoveryCode 返回 400', async () => {
      const body = makeRegisterBody();
      delete body.recoveryCode;
      const response = await POST(makeRequest(body));
      expect(response.status).toBe(400);
    });

    it('无效恢复码格式（缺少 PBOX- 前缀）返回 400', async () => {
      const response = await POST(
        makeRequest(makeRegisterBody({ recoveryCode: 'ABCD-ABCD-ABCD-ABCD' })),
      );
      expect(response.status).toBe(400);
    });

    it('无效恢复码格式（含非法字符 I）返回 400', async () => {
      const response = await POST(
        makeRequest(makeRegisterBody({ recoveryCode: 'PBOX-ABCD-ABCD-ABCD-ABCI' })),
      );
      expect(response.status).toBe(400);
    });

    it('encryptedKey 缺少 iv 字段返回 400', async () => {
      const badEncrypted = { v: 1, ct: 'AAAA' };
      const response = await POST(
        makeRequest(makeRegisterBody({ encryptedKey: badEncrypted })),
      );
      expect(response.status).toBe(400);
    });

    it('encryptedKey 版本号错误返回 400', async () => {
      const badEncrypted = { v: 2, iv: 'AAAA', ct: 'AAAA' };
      const response = await POST(
        makeRequest(makeRegisterBody({ encryptedKey: badEncrypted })),
      );
      expect(response.status).toBe(400);
    });

    it('kdfParams.type 非 argon2id 返回 400', async () => {
      const response = await POST(
        makeRequest(
          makeRegisterBody({
            kdfParams: { type: 'pbkdf2', memoryKib: 65536, iterations: 3, parallelism: 4 },
          }),
        ),
      );
      expect(response.status).toBe(400);
    });

    it('kdfParams.memoryKib 非正数返回 400', async () => {
      const response = await POST(
        makeRequest(
          makeRegisterBody({
            kdfParams: { type: 'argon2id', memoryKib: 0, iterations: 3, parallelism: 4 },
          }),
        ),
      );
      expect(response.status).toBe(400);
    });

    it('缺少 defaultVaultNameEncrypted 返回 400', async () => {
      const body = makeRegisterBody();
      delete body.defaultVaultNameEncrypted;
      const response = await POST(makeRequest(body));
      expect(response.status).toBe(400);
    });
  });

  // ============================================================
  // 零知识验证（SEC-10）
  // ============================================================

  describe('零知识验证', () => {
    it('服务端存储的数据不含明文主密码相关内容', async () => {
      const body = makeRegisterBody({ authHash: 'dGhpcy1pcy1hLXNlY3JldC1oYXNo' });
      await POST(makeRequest(body));

      const result = await db.query('SELECT * FROM users WHERE email_normalized = $1', [
        'test@register.test',
      ]);
      const user = result.rows[0];
      // password_hash 是 bcrypt 哈希，不含 authHash 明文
      expect(user.password_hash).not.toContain('dGhpcy1pcy1hLXNlY3JldC1oYXNo');
      // 没有任何列存储明文主密码
      const allValues = JSON.stringify(user);
      expect(allValues).not.toContain('dGhpcy1pcy1hLXNlY3JldC1oYXNo');
    });

    it('recoveryCode 明文不出现在数据库中', async () => {
      const { formatted: recoveryCode } = generateRecoveryCode();
      await POST(makeRequest(makeRegisterBody({ recoveryCode })));

      const result = await db.query('SELECT * FROM users WHERE email_normalized = $1', [
        'test@register.test',
      ]);
      const allValues = JSON.stringify(result.rows[0]);
      // 恢复码明文不应出现在任何列
      expect(allValues).not.toContain(recoveryCode);
    });
  });
});
