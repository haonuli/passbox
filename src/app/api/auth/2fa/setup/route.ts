/**
 * 2FA 初始化 API (T6.1)
 *
 * POST /api/auth/2fa/setup
 *
 * 已认证用户开启 2FA 的第一步：生成 TOTP 密钥并返回 otpauth:// URI。
 * 密钥此时不写入数据库，仅在 enable 阶段验证通过后才持久化。
 *
 * @see TASK_BREAKDOWN T6.1
 */
import { NextResponse } from 'next/server';
import { Secret, TOTP } from 'otpauth';
import { getVerifiedSession } from '@/lib/auth-check';
import { db } from '@/lib/db';

export async function POST(): Promise<NextResponse> {
  try {
    const session = await getVerifiedSession();
    if (!session || !session.sub) {
      return NextResponse.json(
        { success: false, error: '未登录或会话已过期' },
        { status: 401 },
      );
    }

    const result = await db.query(
      'SELECT email, two_factor_enabled FROM users WHERE id = $1',
      [session.sub],
    );

    if (result.rows.length === 0) {
      return NextResponse.json(
        { success: false, error: '用户不存在' },
        { status: 404 },
      );
    }

    if (result.rows[0].two_factor_enabled as boolean) {
      return NextResponse.json(
        { success: false, error: '2FA 已开启，无需重复设置' },
        { status: 400 },
      );
    }

    const email = result.rows[0].email as string;

    // 生成 32 字节随机 TOTP 密钥
    const secret = new Secret({ size: 32 });

    // 构建 TOTP 对象（issuer: passbox, label: 用户邮箱）
    const totp = new TOTP({
      issuer: 'passbox',
      label: email,
      secret,
      digits: 6,
      period: 30,
      algorithm: 'SHA1',
    });

    return NextResponse.json({
      success: true,
      secret: secret.base32,
      otpauthUrl: totp.toString(),
    });
  } catch (err) {
    console.error('[2fa/setup] 未预期错误:', err instanceof Error ? err.message : '未知错误');
    return NextResponse.json(
      { success: false, error: '服务器内部错误' },
      { status: 500 },
    );
  }
}
