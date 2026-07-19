/**
 * 2FA 启用 API (T6.1)
 *
 * POST /api/auth/2fa/enable
 *
 * 接收 setup 阶段生成的密钥和用户输入的验证码，验证通过后：
 * - 将密钥持久化到 users.two_factor_secret
 * - 生成 10 个备用恢复码（bcrypt 哈希后存入 two_factor_backup_codes）
 * - 设置 two_factor_enabled = true
 * - 返回明文备用码（仅此一次）
 *
 * @see TASK_BREAKDOWN T6.1
 */
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import bcrypt from 'bcrypt';
import { randomBytes } from 'crypto';
import { Secret, TOTP } from 'otpauth';
import { getVerifiedSession } from '@/lib/auth-check';
import { db } from '@/lib/db';
import { logApiError } from '@/lib/api-log';

/** 备用码字符集（大写字母 + 数字） */
const BACKUP_CODE_CHARS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';

/** 备用码数量 */
const BACKUP_CODE_COUNT = 10;

const enableSchema = z.object({
  secret: z.string().min(1, '密钥不能为空'),
  code: z.string().min(1, '验证码不能为空'),
});

/**
 * 生成单个备用恢复码（格式：XXXX-XXXX，8 位大写字母数字）。
 */
function generateBackupCode(): string {
  const bytes = randomBytes(8);
  let code = '';
  for (let i = 0; i < 8; i++) {
    code += BACKUP_CODE_CHARS[bytes[i] % BACKUP_CODE_CHARS.length];
    if (i === 3) code += '-';
  }
  return code;
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { success: false, error: '请求体不是合法 JSON' },
      { status: 400 },
    );
  }

  let userId: string | undefined;
  try {
    const parsed = enableSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: parsed.error.issues[0]?.message ?? '请求参数无效' },
        { status: 400 },
      );
    }

    const { secret, code } = parsed.data;

    const session = await getVerifiedSession();
    if (!session || !session.sub) {
      return NextResponse.json(
        { success: false, error: '未登录或会话已过期' },
        { status: 401 },
      );
    }
    userId = session.sub;

    // 检查是否已开启 2FA
    const userResult = await db.query(
      'SELECT two_factor_enabled FROM users WHERE id = $1',
      [userId],
    );

    if (userResult.rows.length === 0) {
      return NextResponse.json(
        { success: false, error: '用户不存在' },
        { status: 404 },
      );
    }

    if (userResult.rows[0].two_factor_enabled as boolean) {
      return NextResponse.json(
        { success: false, error: '2FA 已开启，无需重复设置' },
        { status: 400 },
      );
    }

    // 构建 TOTP 对象验证验证码（窗口 ±1）
    const totp = new TOTP({
      issuer: 'PassBox',
      label: session.email,
      secret: Secret.fromBase32(secret),
      digits: 6,
      period: 30,
      algorithm: 'SHA1',
    });

    const delta = totp.validate({ token: code, window: 1 });
    if (delta === null) {
      return NextResponse.json(
        { success: false, error: '验证码错误，请重试' },
        { status: 400 },
      );
    }

    // 生成 10 个备用恢复码
    const backupCodes: string[] = [];
    for (let i = 0; i < BACKUP_CODE_COUNT; i++) {
      backupCodes.push(generateBackupCode());
    }

    // bcrypt 哈希每个备用码
    const hashedCodes: string[] = [];
    for (const code of backupCodes) {
      hashedCodes.push(await bcrypt.hash(code, 10));
    }

    // 持久化 2FA 设置
    await db.query(
      `UPDATE users
       SET two_factor_enabled = true,
           two_factor_secret = $1,
           two_factor_backup_codes = $2,
           updated_at = NOW()
       WHERE id = $3`,
      [secret, hashedCodes, userId],
    );

    return NextResponse.json({
      success: true,
      backupCodes,
    });
  } catch (err) {
    logApiError('2fa/enable', err, { userId });
    return NextResponse.json(
      { success: false, error: '服务器内部错误' },
      { status: 500 },
    );
  }
}
