/**
 * 旅行模式 API
 *
 * GET  /api/travel-mode - 获取当前用户的旅行模式状态
 * POST /api/travel-mode - 开启/关闭旅行模式（需验证主密码）
 *
 * 旅行模式开启后，仅标记为 travel_safe 的保险库及其条目可访问，
 * 用于过境等场景保护敏感数据。
 *
 * 安全机制：
 * - 开启/关闭均需验证主密码（authHash + bcrypt.compare）
 * - 与登录 API 共用同一套凭据验证逻辑
 */
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import bcrypt from 'bcrypt';
import { getVerifiedSession } from '@/lib/auth-check';
import { db } from '@/lib/db';

const updateSchema = z.object({
  authHash: z.string().min(1, 'authHash 不能为空'),
  enable: z.boolean(),
});

/**
 * GET /api/travel-mode - 获取旅行模式状态
 *
 * 响应：200 { travelMode: boolean }
 */
export async function GET(): Promise<NextResponse> {
  try {
    const session = await getVerifiedSession();
    if (!session || !session.sub) {
      return NextResponse.json(
        { success: false, error: '未登录或会话已过期' },
        { status: 401 },
      );
    }

    const result = await db.query(
      'SELECT travel_mode FROM users WHERE id = $1',
      [session.sub],
    );

    if (result.rows.length === 0) {
      return NextResponse.json(
        { success: false, error: '用户不存在' },
        { status: 404 },
      );
    }

    return NextResponse.json(
      { travelMode: result.rows[0].travel_mode as boolean },
      { status: 200 },
    );
  } catch (err) {
    console.error(
      '[travel-mode/get] 未预期错误:',
      err instanceof Error ? err.message : '未知错误',
    );
    return NextResponse.json(
      { success: false, error: '服务器内部错误' },
      { status: 500 },
    );
  }
}

/**
 * POST /api/travel-mode - 开启/关闭旅行模式
 *
 * 请求体：{ authHash: string, enable: boolean }
 * 响应：200 { success: true, travelMode: boolean }
 *      401 主密码验证失败
 */
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
    const session = await getVerifiedSession();
    if (!session || !session.sub) {
      return NextResponse.json(
        { success: false, error: '未登录或会话已过期' },
        { status: 401 },
      );
    }
    const userId = session.sub;

    const parsed = updateSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: parsed.error.issues[0]?.message ?? '请求参数无效' },
        { status: 400 },
      );
    }

    const { authHash, enable } = parsed.data;

    // 读取用户的 password_hash 用于验证 authHash
    const result = await db.query(
      'SELECT password_hash FROM users WHERE id = $1',
      [userId],
    );

    if (result.rows.length === 0) {
      return NextResponse.json(
        { success: false, error: '用户不存在' },
        { status: 404 },
      );
    }

    const passwordHash = result.rows[0].password_hash as string;

    // bcrypt 验证 authHash（与登录 API 一致）
    const isMatch = await bcrypt.compare(authHash, passwordHash);

    if (!isMatch) {
      return NextResponse.json(
        { success: false, error: '主密码错误' },
        { status: 401 },
      );
    }

    // 验证成功，更新旅行模式状态
    await db.query(
      'UPDATE users SET travel_mode = $1 WHERE id = $2',
      [enable, userId],
    );

    return NextResponse.json(
      { success: true, travelMode: enable },
      { status: 200 },
    );
  } catch (err) {
    console.error(
      '[travel-mode/post] 未预期错误:',
      err instanceof Error ? err.message : '未知错误',
    );
    return NextResponse.json(
      { success: false, error: '服务器内部错误' },
      { status: 500 },
    );
  }
}
