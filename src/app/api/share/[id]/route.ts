/**
 * 共享链接详情 API
 *
 * GET    /api/share/[id] - 获取共享数据（公开访问，无需认证）
 * DELETE /api/share/[id] - 撤销共享链接（需认证）
 *
 * @see docs/SHARE_LINK_DESIGN.md
 */
import { NextRequest, NextResponse } from 'next/server';
import { getVerifiedSession } from '@/lib/auth-check';
import { db } from '@/lib/db';
import type { GetShareResponse } from '@/types/share';

/**
 * GET /api/share/[id] - 获取共享数据
 *
 * 公开访问，不需要认证。每次访问原子自增 view_count。
 * 过期或超出查看次数时返回 410 Gone。
 */
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
): Promise<NextResponse> {
  try {
    const { id } = await params;

    // 先检查记录是否存在
    const existsResult = await db.query(
      `SELECT id, expires_at, max_views, view_count
       FROM shared_items
       WHERE id = $1`,
      [id],
    );

    if (existsResult.rows.length === 0) {
      return NextResponse.json(
        { success: false, error: '共享链接不存在' },
        { status: 404 },
      );
    }

    const row = existsResult.rows[0];
    const expiresAt = row.expires_at as string;
    const maxViews = row.max_views as number | null;
    const viewCount = row.view_count as number;

    // 检查是否过期
    if (new Date(expiresAt).getTime() < Date.now()) {
      return NextResponse.json(
        { success: false, error: '共享链接已过期' },
        { status: 410 },
      );
    }

    // 检查是否超出查看次数
    if (maxViews !== null && viewCount >= maxViews) {
      return NextResponse.json(
        { success: false, error: '共享链接查看次数已用尽' },
        { status: 410 },
      );
    }

    // 原子自增 view_count 并获取加密数据
    // WHERE 条件确保并发安全：仅在未过期且未超次数时才自增
    const updateResult = await db.query(
      `UPDATE shared_items
       SET view_count = view_count + 1
       WHERE id = $1
         AND (max_views IS NULL OR view_count < max_views)
         AND expires_at > NOW()
       RETURNING item_title_encrypted, item_data_encrypted, item_type_code, expires_at`,
      [id],
    );

    if (updateResult.rows.length === 0) {
      return NextResponse.json(
        { success: false, error: '共享链接已过期或查看次数已用尽' },
        { status: 410 },
      );
    }

    const updated = updateResult.rows[0];
    const response: GetShareResponse = {
      encryptedTitle: updated.item_title_encrypted as string,
      encryptedData: updated.item_data_encrypted as string,
      itemTypeCode: updated.item_type_code as string,
      expiresAt: updated.expires_at as string,
    };

    return NextResponse.json(response, { status: 200 });
  } catch (err) {
    console.error('[share/get] 未预期错误:', err instanceof Error ? err.message : '未知错误');
    return NextResponse.json(
      { success: false, error: '服务器内部错误' },
      { status: 500 },
    );
  }
}

/**
 * DELETE /api/share/[id] - 撤销共享链接
 *
 * 需要认证，仅允许链接所有者撤销。
 */
export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
): Promise<NextResponse> {
  try {
    const { id } = await params;

    const session = await getVerifiedSession();
    if (!session || !session.sub) {
      return NextResponse.json(
        { success: false, error: '未登录或会话已过期' },
        { status: 401 },
      );
    }

    const result = await db.query(
      `DELETE FROM shared_items
       WHERE id = $1 AND user_id = $2`,
      [id, session.sub],
    );

    if (result.rowCount === 0) {
      return NextResponse.json(
        { success: false, error: '共享链接不存在或无权操作' },
        { status: 404 },
      );
    }

    return NextResponse.json({ success: true }, { status: 200 });
  } catch (err) {
    console.error('[share/delete] 未预期错误:', err instanceof Error ? err.message : '未知错误');
    return NextResponse.json(
      { success: false, error: '服务器内部错误' },
      { status: 500 },
    );
  }
}
