/**
 * 条目创建 API（浏览器扩展用）
 *
 * POST /api/items - 创建新条目（供扩展自动保存使用）
 *
 * 请求体：{ itemId, vaultId, itemTypeId, titleEncrypted, dataEncrypted, tagIds }
 * 响应：201 { id }
 */
import { NextRequest, NextResponse } from 'next/server';
import { getVerifiedSession } from '@/lib/auth-check';
import { db } from '@/lib/db';
import { createItemSchema } from '@/lib/schemas';
import { logApiError } from '@/lib/api-log';

/**
 * POST /api/items - 创建新条目
 *
 * 验证 vaultId 属于当前用户后插入 items 表。
 * titleEncrypted / dataEncrypted 以 JSON 字符串形式存入数据库。
 * 使用 zod schema 校验请求体（H3 修复：替代裸类型断言）。
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

  // L4 修复：userId 提升到外层作用域，便于 catch 块记录上下文
  let userId: string | undefined;
  try {
    const session = await getVerifiedSession();
    if (!session || !session.sub) {
      return NextResponse.json(
        { success: false, error: '未登录或会话已过期' },
        { status: 401 },
      );
    }
    userId = session.sub;

    const parsed = createItemSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: parsed.error.issues[0]?.message ?? '请求参数无效' },
        { status: 400 },
      );
    }

    const { itemId, vaultId, itemTypeId, titleEncrypted, dataEncrypted, tagIds } = parsed.data;

    // 验证保险库属于当前用户
    const vaultCheck = await db.query(
      'SELECT id FROM vaults WHERE id = $1 AND user_id = $2',
      [vaultId, userId],
    );
    if (vaultCheck.rows.length === 0) {
      return NextResponse.json(
        { success: false, error: '指定的保险库不存在' },
        { status: 403 },
      );
    }

    await db.query(
      `INSERT INTO items (id, user_id, vault_id, item_type_id, title_encrypted, data_encrypted)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [
        itemId,
        userId,
        vaultId,
        itemTypeId,
        JSON.stringify(titleEncrypted),
        JSON.stringify(dataEncrypted),
      ],
    );

    // 关联标签（如有）
    if (tagIds.length > 0) {
      const values = tagIds
        .map((_, i) => `($1, $${i + 2})`)
        .join(', ');
      await db.query(
        `INSERT INTO item_tags (item_id, tag_id) VALUES ${values}`,
        [itemId, ...tagIds],
      );
    }

    return NextResponse.json({ id: itemId }, { status: 201 });
  } catch (err) {
    logApiError('items/create', err, { userId });
    return NextResponse.json(
      { success: false, error: '服务器内部错误' },
      { status: 500 },
    );
  }
}
