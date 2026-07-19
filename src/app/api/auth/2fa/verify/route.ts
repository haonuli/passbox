/**
 * 2FA 验证 API (T6.2)
 *
 * POST /api/auth/2fa/verify
 *
 * 登录密码验证通过后，若用户开启了 2FA，login API 返回 202 + ticket。
 * 客户端携带 ticket + TOTP 验证码（或备用恢复码）调用本接口完成登录。
 *
 * 验证流程：
 * 1. verifyTicket(ticket) → 获取 userId（过期/无效返回 401）
 * 2a. TOTP 模式：otpauth.validate 验证 6 位码，窗口 ±1（±30s）
 * 2b. 备用码模式：遍历 two_factor_backup_codes，bcrypt.compare 匹配后移除
 * 3. 验证成功 → setSessionCookie + 返回 LoginResponse（encryptedKey 等）
 * 4. 验证失败 → 401
 *
 * 安全要点：
 * - ticket 5 分钟过期，验证成功后 consume 防止重放
 * - 备用码使用后立即从数组移除（一次性）
 * - 不区分"ticket 无效"与"验证码错误"的错误信息（防信息泄漏）
 *
 * @see TASK_BREAKDOWN T6.2
 */
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import bcrypt from 'bcrypt';
import { Secret, TOTP } from 'otpauth';
import { db } from '@/lib/db';
import {
  createSession,
  SESSION_COOKIE_NAME,
  SESSION_COOKIE_OPTIONS,
} from '@/lib/session';
import { verifyTicket, consumeTicket } from '@/lib/2fa-ticket';
import { TOTP_PERIOD, TOTP_DIGITS } from '@/lib/crypto/totp';
import { logApiError } from '@/lib/api-log';
import type { LoginResponse } from '@/types/api';
import type { EncryptedData } from '@/types/crypto';

/** TOTP 验证窗口（±1 个周期 = ±30 秒） */
const TOTP_WINDOW = 1;

const verifySchema = z.object({
  ticket: z.string().min(1, 'ticket 不能为空'),
  code: z.string().min(1, '验证码不能为空'),
  useBackupCode: z.boolean().optional(),
});

export async function POST(request: NextRequest): Promise<NextResponse> {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: '请求体不是合法 JSON' }, { status: 400 });
  }

  let parsed: ReturnType<typeof verifySchema.safeParse>;
  let userId: string | undefined;
  try {
    parsed = verifySchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: '请求参数无效', code: 'INVALID_PARAMS' },
        { status: 400 },
      );
    }

    const { ticket, code, useBackupCode } = parsed.data;

    // 1. 验证 ticket，获取 userId
    const verifiedUserId = await verifyTicket(ticket);
    if (!verifiedUserId) {
      return NextResponse.json(
        { error: '验证会话已过期，请重新登录', code: 'TICKET_EXPIRED' },
        { status: 401 },
      );
    }
    userId = verifiedUserId;

    // 2. 查询用户的 2FA 密钥、备用码及登录所需数据
    const result = await db.query(
      `SELECT id, email, two_factor_secret, two_factor_backup_codes,
              encrypted_key, kdf_salt, kdf_memory_kib, kdf_iterations,
              kdf_parallelism, token_version
       FROM users WHERE id = $1`,
      [userId],
    );

    if (result.rows.length === 0) {
      // ticket 有效但用户不存在（边缘情况，理论不会发生）
      await consumeTicket(ticket);
      return NextResponse.json(
        { error: '验证码错误', code: 'INVALID_CODE' },
        { status: 401 },
      );
    }

    const user = result.rows[0];

    // 3. 验证 TOTP 或备用码
    if (useBackupCode) {
      // —— 备用恢复码模式 ——
      const backupCodes = user.two_factor_backup_codes as string[] | null;
      if (!backupCodes || backupCodes.length === 0) {
        return NextResponse.json(
          { error: '验证码错误', code: 'INVALID_CODE' },
          { status: 401 },
        );
      }

      let matchedIndex = -1;
      for (let i = 0; i < backupCodes.length; i++) {
        if (await bcrypt.compare(code, backupCodes[i])) {
          matchedIndex = i;
          break;
        }
      }

      if (matchedIndex === -1) {
        return NextResponse.json(
          { error: '验证码错误', code: 'INVALID_CODE' },
          { status: 401 },
        );
      }

      // 匹配成功：从数组中移除已使用的备用码（一次性）
      await db.query(
        `UPDATE users
         SET two_factor_backup_codes = array_remove(two_factor_backup_codes, $1)
         WHERE id = $2`,
        [backupCodes[matchedIndex], userId],
      );
    } else {
      // —— TOTP 模式 ——
      const secret = user.two_factor_secret as string | null;
      if (!secret) {
        return NextResponse.json(
          { error: '验证码错误', code: 'INVALID_CODE' },
          { status: 401 },
        );
      }

      const totp = new TOTP({
        secret: Secret.fromBase32(secret),
        digits: TOTP_DIGITS,
        period: TOTP_PERIOD,
        algorithm: 'SHA1',
      });

      // validate 返回 delta（整数）表示匹配的时间窗口偏移，null 表示不匹配
      const delta = totp.validate({
        token: code,
        window: TOTP_WINDOW,
      });

      if (delta === null) {
        return NextResponse.json(
          { error: '验证码错误', code: 'INVALID_CODE' },
          { status: 401 },
        );
      }
    }

    // 4. 验证成功：消耗 ticket（防止重放）+ 签发会话
    await consumeTicket(ticket);

    const token = await createSession(
      user.id as string,
      user.email as string,
      user.token_version as number,
    );

    // 构造 LoginResponse（与 login API 成功响应结构一致，
    // 客户端需 encryptedKey + kdfSalt + kdfParams 完成零知识解密）
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
    logApiError('2fa/verify', err, { userId });
    return NextResponse.json(
      { error: '服务器内部错误', code: 'INTERNAL_ERROR' },
      { status: 500 },
    );
  }
}
