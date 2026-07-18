/**
 * 条目更新 API（浏览器扩展用）
 *
 * PUT /api/items/[id] - 更新条目（供扩展更新密码使用）
 *
 * 请求体：{ titleEncrypted, dataEncrypted }
 * 响应：200 { success: true }
 */
import { NextRequest, NextResponse } from 'next/server';
import { getVerifiedSession } from '@/lib/auth-check';
import { db } from '@/lib/db';
import type { EncryptedData } from '@/types/crypto';

interface UpdateItemBody {
  titleEncrypted: EncryptedData;
  dataEncrypted: EncryptedData;
}

/**
 * PUT /api/items/[id] - 更新条目密文
 *
 * 验证条目属于当前用户后更新 title_encrypted / data_encrypted。
 * 使用 Next.js 16 的 Promise params 模式。
 */
export async function PUT(
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

  try {
    const { id } = await params;

    const session = await getVerifiedSession();
    if (!session || !session.sub) {
      return NextResponse.json(
        { success: false, error: '未登录或会话已过期' },
        { status: 401 },
      );
    }
    const userId = session.sub;

    const { titleEncrypted, dataEncrypted } = body as UpdateItemBody;

    // 验证条目属于当前用户
    const existing = await db.query(
      'SELECT id FROM items WHERE id = $1 AND user_id = $2',
      [id, userId],
    );
    if (existing.rows.length === 0) {
      return NextResponse.json(
        { success: false, error: '条目不存在或无权操作' },
        { status: 404 },
      );
    }

    await db.query(
      'UPDATE items SET title_encrypted = $1, data_encrypted = $2 WHERE id = $3 AND user_id = $4',
      [JSON.stringify(titleEncrypted), JSON.stringify(dataEncrypted), id, userId],
    );

    return NextResponse.json({ success: true }, { status: 200 });
  } catch (err) {
    console.error('[items/update] 未预期错误:', err instanceof Error ? err.message : '未知错误');
    return NextResponse.json(
      { success: false, error: '服务器内部错误' },
      { status: 500 },
    );
  }
}
