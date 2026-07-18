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
import type { EncryptedData } from '@/types/crypto';

interface CreateItemBody {
  /** 客户端预生成的 itemId（UUID），用于 AAD 绑定一致性 */
  itemId: string;
  vaultId: string;
  itemTypeId: number;
  titleEncrypted: EncryptedData;
  dataEncrypted: EncryptedData;
  tagIds: string[];
}

/**
 * POST /api/items - 创建新条目
 *
 * 验证 vaultId 属于当前用户后插入 items 表。
 * titleEncrypted / dataEncrypted 以 JSON 字符串形式存入数据库。
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

    const { itemId, vaultId, itemTypeId, titleEncrypted, dataEncrypted } =
      body as CreateItemBody;

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

    return NextResponse.json({ id: itemId }, { status: 201 });
  } catch (err) {
    console.error('[items/create] 未预期错误:', err instanceof Error ? err.message : '未知错误');
    return NextResponse.json(
      { success: false, error: '服务器内部错误' },
      { status: 500 },
    );
  }
}
