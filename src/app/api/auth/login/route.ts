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
import { createTicket } from '@/lib/2fa-ticket';
import { logApiError } from '@/lib/api-log';
import { checkRateLimit, getClientIp } from '@/lib/rate-limit';
import type { LoginResponse, TotpChallengeResponse } from '@/types/api';
import type { EncryptedData } from '@/types/crypto';

/** 连续失败次数上限，达到后锁定账户 */
const MAX_FAILED_ATTEMPTS = 5;

/** 锁定时长（分钟） */
const LOCK_DURATION_MINUTES = 15;

/** 统一错误信息（不区分 email 不存在 vs 密码错误） */
const INVALID_CREDENTIALS_ERROR = '邮箱或主密码错误';

/**
 * 虚拟 bcrypt 哈希，用于 email 不存在时均衡耗时（防枚举 SEC-10）。
 *
 * 模块加载时预计算一次（cost=10，约 100ms），确保 email 不存在的分支
 * 也会执行一次 bcrypt.compare，与密码错误分支耗时接近一致。
 */
const DUMMY_PASSWORD_HASH = bcrypt.hashSync('dummy-password-for-timing', 10);

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

  let parsed: ReturnType<typeof loginSchema.safeParse>;
  let email: string | undefined;
  try {
    parsed = loginSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: '请求参数无效', code: 'INVALID_PARAMS' },
        { status: 400 },
      );
    }

    ({ email } = parsed.data);
    const { authHash } = parsed.data;
    const emailNormalized = email.toLowerCase();

    // L6 速率限制：每 IP+email 每分钟最多 10 次（与账户锁定互补防撞库）
    const ip = getClientIp(request);
    const limited = checkRateLimit('login', ip, email, {
      windowMs: 60_000,
      max: 10,
    });
    if (!limited.ok) {
      return NextResponse.json(
        { error: '请求过于频繁，请稍后重试', code: 'RATE_LIMITED' },
        { status: 429, headers: { 'Retry-After': String(limited.retryAfter) } },
      );
    }

    // 查询用户
    const result = await db.query(
      `SELECT id, email, password_hash, encrypted_key, kdf_salt,
              kdf_memory_kib, kdf_iterations, kdf_parallelism,
              failed_login_attempts, locked_until, two_factor_enabled, token_version
       FROM users WHERE email_normalized = $1`,
      [emailNormalized],
    );

    // 防枚举（SEC-10）：email 不存在时执行一次虚拟 bcrypt.compare，
    // 使该分支耗时与"密码错误"分支接近一致，避免通过响应时间差枚举邮箱。
    if (result.rows.length === 0) {
      await bcrypt.compare(authHash, DUMMY_PASSWORD_HASH);
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
      // 锁定已过期：重置失败计数与锁定标记，避免"过期后一次失败即重新锁定"的 DoS
      await db.query(
        'UPDATE users SET failed_login_attempts = 0, locked_until = NULL WHERE id = $1',
        [user.id],
      );
      user.failed_login_attempts = 0;
      user.locked_until = null;
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
           SET failed_login_attempts = $1, locked_until = NOW() + make_interval(mins => $2)
           WHERE id = $3`,
          [newAttempts, LOCK_DURATION_MINUTES, user.id],
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

    // 2FA 检查（T6.2）：用户开启了 2FA 时，不直接签发会话，
    // 而是返回 202 + ticket，客户端需完成 TOTP 验证才能登录。
    if (user.two_factor_enabled) {
      const ticket = await createTicket(user.id as string);
      const challenge: TotpChallengeResponse = {
        challenge: 'totp_required',
        ticket,
      };
      return NextResponse.json(challenge, { status: 202 });
    }

    // 签发会话 Cookie（携带当前 token_version，M-9 撤销机制）
    const token = await createSession(
      user.id as string,
      user.email as string,
      user.token_version as number,
    );

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
  } catch (err) {
    // 兜底：任何未预期异常统一返回 500，避免泄漏内部错误细节
    logApiError('login', err, { email });
    return NextResponse.json(
      { error: '服务器内部错误', code: 'INTERNAL_ERROR' },
      { status: 500 },
    );
  }
}
