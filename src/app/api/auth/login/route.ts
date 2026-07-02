/**
 * 登录 API (T3.3)
 *
 * POST /api/auth/login
 *
 * 验证客户端派生的 authHash（bcrypt.compare），成功则签发会话 Cookie 并返回
 * encryptedKey + KDF 参数（客户端用 Master Key 解密得到 Symmetric Key）。
 *
 * 安全机制：
 * - 防枚举（SEC-10）：email 不存在与密码错误统一返回"邮箱或主密码错误"
 * - 账户锁定（SEC-7）：连续 5 次失败后锁定 15 分钟，锁定期间拒绝登录
 * - 错误信息不区分 email 不存在 vs 密码错误
 *
 * 2FA（P1）：totpCode 字段已接受但暂不处理，two_factor_enabled 检查与
 * 202 totp_required 响应将在 T6.1 实现。当前所有用户 two_factor_enabled=false。
 *
 * @see TECHNICAL_DESIGN.md 5.2.3（登录 API 契约）+ 7.2（登录数据流）
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
import type { LoginResponse } from '@/types/api';
import type { EncryptedData } from '@/types/crypto';

/** 连续失败次数上限，达到后锁定账户 */
const MAX_FAILED_ATTEMPTS = 5;

/** 锁定时长（分钟） */
const LOCK_DURATION_MINUTES = 15;

/** 统一错误信息（不区分 email 不存在 vs 密码错误） */
const INVALID_CREDENTIALS_ERROR = '邮箱或主密码错误';

const loginSchema = z.object({
  email: z.string().trim().email('邮箱格式无效'),
  authHash: z.string().min(1, 'authHash 不能为空'),
  // P1: 2FA 启用时需传 totpCode，当前暂不处理
  totpCode: z.string().optional(),
});

export async function POST(request: NextRequest): Promise<NextResponse> {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: '请求体不是合法 JSON' }, { status: 400 });
  }

  const parsed = loginSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: '请求参数无效', code: 'INVALID_PARAMS' },
      { status: 400 },
    );
  }

  const { email, authHash } = parsed.data;
  const emailNormalized = email.toLowerCase();

  // 查询用户
  const result = await db.query(
    `SELECT id, email, password_hash, encrypted_key, kdf_salt,
            kdf_memory_kib, kdf_iterations, kdf_parallelism,
            failed_login_attempts, locked_until, two_factor_enabled
     FROM users WHERE email_normalized = $1`,
    [emailNormalized],
  );

  // 防枚举：email 不存在时返回与密码错误相同的错误信息
  if (result.rows.length === 0) {
    return NextResponse.json(
      { error: INVALID_CREDENTIALS_ERROR, code: 'INVALID_CREDENTIALS' },
      { status: 401 },
    );
  }

  const user = result.rows[0];

  // 检查账户锁定状态
  if (user.locked_until) {
    const lockedUntil = new Date(user.locked_until as string);
    if (lockedUntil > new Date()) {
      return NextResponse.json(
        {
          error: '账户已锁定，请稍后重试',
          code: 'ACCOUNT_LOCKED',
          lockedUntil: lockedUntil.toISOString(),
        },
        { status: 423 },
      );
    }
  }

  // bcrypt 验证 authHash
  const isMatch = await bcrypt.compare(authHash, user.password_hash as string);

  if (!isMatch) {
    // 密码错误：失败计数 +1，达到上限则锁定
    const newAttempts = (user.failed_login_attempts as number) + 1;
    const shouldLock = newAttempts >= MAX_FAILED_ATTEMPTS;

    if (shouldLock) {
      await db.query(
        `UPDATE users
         SET failed_login_attempts = $1, locked_until = NOW() + INTERVAL '${LOCK_DURATION_MINUTES} minutes'
         WHERE id = $2`,
        [newAttempts, user.id],
      );
      // 查询更新后的 locked_until
      const lockResult = await db.query(
        'SELECT locked_until FROM users WHERE id = $1',
        [user.id],
      );
      const lockedUntil = new Date(lockResult.rows[0].locked_until as string);
      return NextResponse.json(
        {
          error: '账户已锁定，请稍后重试',
          code: 'ACCOUNT_LOCKED',
          lockedUntil: lockedUntil.toISOString(),
        },
        { status: 423 },
      );
    }

    await db.query(
      'UPDATE users SET failed_login_attempts = $1 WHERE id = $2',
      [newAttempts, user.id],
    );

    return NextResponse.json(
      { error: INVALID_CREDENTIALS_ERROR, code: 'INVALID_CREDENTIALS' },
      { status: 401 },
    );
  }

  // 密码正确：重置失败计数、清除锁定、更新最后登录时间
  await db.query(
    `UPDATE users
     SET failed_login_attempts = 0, locked_until = NULL, last_login_at = NOW()
     WHERE id = $1`,
    [user.id],
  );

  // 签发会话 Cookie
  const token = await createSession(user.id as string, user.email as string);

  // 构造 LoginResponse（encrypted_key 在 DB 中为 JSON 字符串，解析回对象）
  const encryptedKey = JSON.parse(user.encrypted_key as string) as EncryptedData;
  const response: LoginResponse = {
    user: { id: user.id as string, email: user.email as string },
    encryptedKey,
    kdfSalt: (user.kdf_salt as Buffer).toString('base64'),
    kdfParams: {
      type: 'argon2id',
      memoryKib: user.kdf_memory_kib as number,
      iterations: user.kdf_iterations as number,
      parallelism: user.kdf_parallelism as number,
    },
  };

  const res = NextResponse.json(response, { status: 200 });
  res.cookies.set(SESSION_COOKIE_NAME, token, SESSION_COOKIE_OPTIONS);
  return res;
}
