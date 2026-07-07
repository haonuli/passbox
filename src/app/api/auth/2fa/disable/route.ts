/**
 * 2FA 关闭 API (T6.1)
 *
 * POST /api/auth/2fa/disable
 *
 * 接收主密码（authHash），验证通过后清除 2FA 相关字段：
 * - two_factor_enabled = false
 * - two_factor_secret = NULL
 * - two_factor_backup_codes = NULL
 *
 * @see TASK_BREAKDOWN T6.1
 */
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import bcrypt from 'bcrypt';
import { getVerifiedSession } from '@/lib/auth-check';
import { db } from '@/lib/db';

const disableSchema = z.object({
  password: z.string().min(1, '主密码不能为空'),
});

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

  try {
    const parsed = disableSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: parsed.error.issues[0]?.message ?? '请求参数无效' },
        { status: 400 },
      );
    }

    const { password } = parsed.data;

    const session = await getVerifiedSession();
    if (!session || !session.sub) {
      return NextResponse.json(
        { success: false, error: '未登录或会话已过期' },
        { status: 401 },
      );
    }

    // 获取用户 password_hash
    const result = await db.query(
      'SELECT password_hash, two_factor_enabled FROM users WHERE id = $1',
      [session.sub],
    );

    if (result.rows.length === 0) {
      return NextResponse.json(
        { success: false, error: '用户不存在' },
        { status: 404 },
      );
    }

    const passwordHash = result.rows[0].password_hash as string;

    // 验证主密码
    const isMatch = await bcrypt.compare(password, passwordHash);
    if (!isMatch) {
      return NextResponse.json(
        { success: false, error: '主密码错误' },
        { status: 401 },
      );
    }

    // 清除 2FA 设置
    await db.query(
      `UPDATE users
       SET two_factor_enabled = false,
           two_factor_secret = NULL,
           two_factor_backup_codes = NULL,
           updated_at = NOW()
       WHERE id = $1`,
      [session.sub],
    );

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error('[2fa/disable] 未预期错误:', err instanceof Error ? err.message : '未知错误');
    return NextResponse.json(
      { success: false, error: '服务器内部错误' },
      { status: 500 },
    );
  }
}
