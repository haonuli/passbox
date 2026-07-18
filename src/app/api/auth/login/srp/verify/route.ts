/**
 * SRP 登录第二步 API (verify)
 *
 * POST /api/auth/login/srp/verify
 *
 * 流程：
 *   1. 客户端计算会话证明后发送 { email, clientPublicEphemeral, clientSessionProof }
 *   2. 服务端查找用户 + SRP 临时会话
 *   3. 验证客户端证明：deriveSession(serverSecret, clientPublic, salt, email, verifier, proof)
 *      - 抛异常 -> 密码错误，失败计数 +1
 *   4. 验证成功：删除 SRP 会话、重置失败计数
 *   5. 检查 2FA（与现有 login 逻辑一致）
 *   6. 签发 session cookie，返回 { serverSessionProof, user, encryptedKey, kdfSalt, kdfParams }
 *
 * 安全机制：
 * - 防枚举（SEC-10）：email 不存在与密码错误统一返回"邮箱或主密码错误"
 * - 账户锁定（SEC-7）：连续 5 次失败后锁定 15 分钟
 * - SRP 会话验证后删除（防重放）
 */
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { db } from '@/lib/db';
import * as srpServer from 'secure-remote-password/server';
import {
  createSession,
  SESSION_COOKIE_NAME,
  SESSION_COOKIE_OPTIONS,
} from '@/lib/session';
import { createTicket } from '@/lib/2fa-ticket';
import type {
  SrpVerifyResponse,
  TotpChallengeResponse,
} from '@/types/api';
import type { EncryptedData } from '@/types/crypto';

/** 连续失败次数上限，达到后锁定账户 */
const MAX_FAILED_ATTEMPTS = 5;

/** 锁定时长（分钟） */
const LOCK_DURATION_MINUTES = 15;

/** 统一错误信息（不区分 email 不存在 vs 密码错误） */
const INVALID_CREDENTIALS_ERROR = '邮箱或主密码错误';

const verifySchema = z.object({
  email: z.string().trim().email('邮箱格式无效'),
  clientPublicEphemeral: z.string().min(1, 'clientPublicEphemeral 不能为空'),
  clientSessionProof: z.string().min(1, 'clientSessionProof 不能为空'),
});

export async function POST(request: NextRequest): Promise<NextResponse> {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: '请求体不是合法 JSON' }, { status: 400 });
  }

  try {
    const parsed = verifySchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: '请求参数无效', code: 'INVALID_PARAMS' },
        { status: 400 },
      );
    }

    const { email, clientPublicEphemeral, clientSessionProof } = parsed.data;
    const emailNormalized = email.toLowerCase();

    // 查询用户
    const result = await db.query(
      `SELECT id, email, srp_salt, srp_verifier, encrypted_key, kdf_salt,
              kdf_memory_kib, kdf_iterations, kdf_parallelism,
              failed_login_attempts, locked_until, two_factor_enabled, token_version
       FROM users WHERE email_normalized = $1`,
      [emailNormalized],
    );

    // 防枚举：用户不存在统一返回凭据错误
    if (result.rows.length === 0 || !result.rows[0].srp_verifier) {
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
      // 锁定已过期：重置失败计数与锁定标记
      await db.query(
        'UPDATE users SET failed_login_attempts = 0, locked_until = NULL WHERE id = $1',
        [user.id],
      );
      user.failed_login_attempts = 0;
      user.locked_until = null;
    }

    // 查询 SRP 临时会话（匹配 user_id + clientPublicEphemeral，取最新一条）
    const sessionResult = await db.query(
      `SELECT id, server_secret_ephemeral FROM srp_sessions
       WHERE user_id = $1 AND client_public_ephemeral = $2 AND expires_at > NOW()
       ORDER BY created_at DESC LIMIT 1`,
      [user.id as string, clientPublicEphemeral],
    );

    if (sessionResult.rows.length === 0) {
      // SRP 会话不存在或已过期
      return NextResponse.json(
        { error: INVALID_CREDENTIALS_ERROR, code: 'INVALID_CREDENTIALS' },
        { status: 401 },
      );
    }

    const srpSession = sessionResult.rows[0];
    const serverSecretEphemeral = srpSession.server_secret_ephemeral as string;
    const srpSalt = user.srp_salt as string;
    const srpVerifier = user.srp_verifier as string;
    const userEmail = user.email as string;

    // SRP 验证：deriveSession 验证客户端证明，失败时抛异常
    let serverSession: { key: string; proof: string };
    try {
      serverSession = srpServer.deriveSession(
        serverSecretEphemeral,
        clientPublicEphemeral,
        srpSalt,
        userEmail,
        srpVerifier,
        clientSessionProof,
      );
    } catch {
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

    // 验证成功：删除 SRP 会话（防重放）、重置失败计数、更新最后登录时间
    await db.query('DELETE FROM srp_sessions WHERE id = $1', [
      srpSession.id as string,
    ]);
    await db.query(
      `UPDATE users
       SET failed_login_attempts = 0, locked_until = NULL, last_login_at = NOW()
       WHERE id = $1`,
      [user.id],
    );

    // 2FA 检查：用户开启了 2FA 时，不直接签发会话，返回 ticket
    if (user.two_factor_enabled) {
      const ticket = await createTicket(user.id as string);
      const challenge: TotpChallengeResponse = {
        challenge: 'totp_required',
        ticket,
      };
      return NextResponse.json(challenge, { status: 202 });
    }

    // 签发会话 Cookie
    const token = await createSession(
      user.id as string,
      user.email as string,
      user.token_version as number,
    );

    // 构造响应（encrypted_key 在 DB 中为 JSON 字符串，解析回对象）
    const encryptedKey = JSON.parse(user.encrypted_key as string) as EncryptedData;
    const response: SrpVerifyResponse = {
      serverSessionProof: serverSession.proof,
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
    console.error('[srp/verify] 未预期错误:', err);
    return NextResponse.json(
      { error: '服务器内部错误', code: 'INTERNAL_ERROR' },
      { status: 500 },
    );
  }
}
