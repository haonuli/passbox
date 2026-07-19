/**
 * 保险库旅行安全标记 API
 *
 * PATCH /api/vaults/[id] - 更新保险库的 travel_safe 标记
 *
 * 请求体：{ travelSafe: boolean }
 * 响应：200 { success: true }
 */
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { getVerifiedSession } from '@/lib/auth-check';
import { db } from '@/lib/db';
import { logApiError } from '@/lib/api-log';

const updateSchema = z.object({
  travelSafe: z.boolean(),
});

/**
 * PATCH /api/vaults/[id] - 更新保险库的 travel_safe 标记
 *
 * 验证保险库属于当前用户后更新 travel_safe 字段。
 * 使用 Next.js 16 的 Promise params 模式。
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
): Promise<NextResponse> {
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
  let vaultId: string | undefined;
  try {
    const { id } = await params;
    vaultId = id;

    const session = await getVerifiedSession();
    if (!session || !session.sub) {
      return NextResponse.json(
        { success: false, error: '未登录或会话已过期' },
        { status: 401 },
      );
    }
    userId = session.sub;

    const parsed = updateSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: parsed.error.issues[0]?.message ?? '请求参数无效' },
        { status: 400 },
      );
    }

    const { travelSafe } = parsed.data;

    // 验证保险库属于当前用户并更新
    const result = await db.query(
      'UPDATE vaults SET travel_safe = $1 WHERE id = $2 AND user_id = $3 RETURNING id',
      [travelSafe, vaultId, userId],
    );

    if (result.rows.length === 0) {
      return NextResponse.json(
        { success: false, error: '保险库不存在或无权操作' },
        { status: 404 },
      );
    }

    return NextResponse.json({ success: true }, { status: 200 });
  } catch (err) {
    logApiError('vaults/update-travel-safe', err, { userId, pathParam: vaultId });
    return NextResponse.json(
      { success: false, error: '服务器内部错误' },
      { status: 500 },
    );
  }
}
