/**
 * 注册 API (T3.2)
 *
 * POST /api/auth/register
 *
 * 数据流（零知识架构）：
 * 1. 客户端派生 Master Key（Argon2id）→ Auth Hash（HKDF）→ Symmetric Key（随机）
 * 2. 客户端用 Master Key 加密 Symmetric Key → encryptedKey
 * 3. 客户端生成恢复码 → 派生 Recovery Key（HKDF）→ 加密 Symmetric Key 副本 → recoveryEncryptedKey
 * 4. 客户端用 Symmetric Key 加密默认保险库名称 → defaultVaultNameEncrypted
 * 5. 客户端提交 { email, authHash, encryptedKey, kdfSalt, kdfParams,
 *                recoveryCode, recoveryEncryptedKey, defaultVaultNameEncrypted }
 * 6. 服务端：校验 → bcrypt(authHash) + bcrypt(recoveryCode) → 事务创建 users + vaults → 设置会话 Cookie
 * 7. 返回 { user, recoveryCode, defaultVaultId }（recoveryCode 明文仅返回一次）
 *
 * ⚠️ 实现偏差：恢复码由客户端生成（非服务端生成），详见 types/api.ts RegisterRequest 注释。
 *
 * @see TECHNICAL_DESIGN.md 5.2.1（注册 API 契约）+ 7.1（注册数据流）
 */
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import bcrypt from 'bcrypt';
import { db } from '@/lib/db';
import {
  createSession,
  SESSION_COOKIE_NAME,
  SESSION_COOKIE_OPTIONS,
} from '@/lib/session';
import { isValidRecoveryCodeFormat } from '@/lib/recovery-code';
import { encryptedDataSchema, kdfParamsSchema, kdfSaltSchema } from '@/lib/schemas';
import type { RegisterResponse } from '@/types/api';

/** bcrypt cost factor。authHash 已经过 Argon2id+HKDF 派生，cost=10 足够纵深防御 */
const BCRYPT_COST = 10;

/**
 * 注册请求 zod schema
 *
 * M-7：kdfSalt 强制 base64 + 16 字节校验
 * M-8：kdfParams 强制最低安全阈值（memoryKib ≥ 16384, iterations ≥ 2）
 */
const registerSchema = z.object({
  email: z.string().trim().email('邮箱格式无效'),
  authHash: z.string().min(1, 'authHash 不能为空'),
  encryptedKey: encryptedDataSchema,
  kdfSalt: kdfSaltSchema,
  kdfParams: kdfParamsSchema,
  recoveryCode: z
    .string()
    .min(1)
    .refine(isValidRecoveryCodeFormat, '恢复码格式无效'),
  recoveryEncryptedKey: encryptedDataSchema,
  defaultVaultNameEncrypted: encryptedDataSchema,
});

/**
 * 邮箱归一化：trim + 小写。用于唯一性校验。
 */
function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  // 1. 解析 + zod 校验请求体
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: '请求体不是合法 JSON' }, { status: 400 });
  }

  const parsed = registerSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: '请求参数无效', code: 'INVALID_PARAMS' },
      { status: 400 },
    );
  }

  const {
    email,
    authHash,
    encryptedKey,
    kdfSalt,
    kdfParams,
    recoveryCode,
    recoveryEncryptedKey,
    defaultVaultNameEncrypted,
  } = parsed.data;

  const emailNormalized = normalizeEmail(email);

  // 2. bcrypt 哈希 authHash 与 recoveryCode（在事务外计算，减少事务持有时长）
  const passwordHash = await bcrypt.hash(authHash, BCRYPT_COST);
  const recoveryCodeHash = await bcrypt.hash(recoveryCode, BCRYPT_COST);

  // base64 salt → Buffer（BYTEA 列）
  const kdfSaltBuffer = Buffer.from(kdfSalt, 'base64');

  // 加密数据对象序列化为 JSON 字符串存储（TEXT 列）
  const encryptedKeyJson = JSON.stringify(encryptedKey);
  const recoveryEncryptedKeyJson = JSON.stringify(recoveryEncryptedKey);
  const defaultVaultNameJson = JSON.stringify(defaultVaultNameEncrypted);

  // 3. 事务：检查邮箱唯一 + 创建 users + 创建默认 vaults
  const client = await db.connect();
  try {
    await client.query('BEGIN');

    // 事务内检查唯一性（避免并发注册竞态）
    const existing = await client.query(
      'SELECT id FROM users WHERE email_normalized = $1',
      [emailNormalized],
    );
    if (existing.rows.length > 0) {
      await client.query('ROLLBACK');
      return NextResponse.json(
        { error: '该邮箱已注册', code: 'EMAIL_EXISTS' },
        { status: 409 },
      );
    }

    // 创建用户
    const userResult = await client.query(
      `INSERT INTO users
         (email, email_normalized, kdf_type, kdf_salt,
          kdf_memory_kib, kdf_iterations, kdf_parallelism,
          password_hash, encrypted_key, recovery_encrypted_key, recovery_code_hash)
       VALUES ($1, $2, 'argon2id', $3, $4, $5, $6, $7, $8, $9, $10)
       RETURNING id`,
      [
        email.trim(),
        emailNormalized,
        kdfSaltBuffer,
        kdfParams.memoryKib,
        kdfParams.iterations,
        kdfParams.parallelism,
        passwordHash,
        encryptedKeyJson,
        recoveryEncryptedKeyJson,
        recoveryCodeHash,
      ],
    );
    const userId = userResult.rows[0].id as string;

    // 创建默认保险库
    const vaultResult = await client.query(
      `INSERT INTO vaults (user_id, name_encrypted, display_order)
       VALUES ($1, $2, 0)
       RETURNING id`,
      [userId, defaultVaultNameJson],
    );
    const defaultVaultId = vaultResult.rows[0].id as string;

    await client.query('COMMIT');

    // 4. 签发会话 JWT 并设置 Cookie（新用户 token_version=0，M-9 撤销机制）
    const token = await createSession(userId, email.trim(), 0);
    const response: RegisterResponse = {
      user: { id: userId, email: email.trim() },
      recoveryCode,
      defaultVaultId,
    };
    const res = NextResponse.json(response, { status: 200 });
    res.cookies.set(SESSION_COOKIE_NAME, token, SESSION_COOKIE_OPTIONS);
    return res;
  } catch (err) {
    // 事务出错时回滚
    try {
      await client.query('ROLLBACK');
    } catch {
      // 回滚失败忽略，记录通用错误（不记录敏感信息 SEC-10）
    }
    // 仅记录通用错误信息，不泄露 authHash / recoveryCode 等敏感内容
    console.error('注册失败：', err instanceof Error ? err.message : '未知错误');
    return NextResponse.json(
      { error: '注册失败，请稍后重试', code: 'INTERNAL_ERROR' },
      { status: 500 },
    );
  } finally {
    client.release();
  }
}
