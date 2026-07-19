/**
 * 条目附件 API
 *
 * POST /api/items/[id]/attachments - 上传附件（加密后存储）
 * GET  /api/items/[id]/attachments - 列出条目的附件
 *
 * 限制：
 * - 每个条目最多 10 个附件
 * - 单个文件不超过 5MB
 * - 文件名、MIME 类型、文件数据均在客户端加密后上传
 */
import { NextRequest, NextResponse } from 'next/server';
import { getVerifiedSession } from '@/lib/auth-check';
import { db } from '@/lib/db';
import { logApiError } from '@/lib/api-log';
import {
  createAttachmentSchema,
  MAX_ATTACHMENTS_PER_ITEM,
  uuidSchema,
} from '@/lib/schemas';

interface CreateAttachmentResponse {
  id: string;
}

interface AttachmentListItem {
  id: string;
  fileSize: number;
  createdAt: string;
}

/**
 * POST /api/items/[id]/attachments - 上传附件
 *
 * 请求体：{ filenameEncrypted, mimeTypeEncrypted, fileSize, dataEncrypted }
 * 响应：201 { id }
 */
export async function POST(
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
  let itemId: string | undefined;
  try {
    const { id } = await params;
    itemId = id;

    // 校验路径 itemId 为合法 UUID
    const idResult = uuidSchema.safeParse(itemId);
    if (!idResult.success) {
      return NextResponse.json(
        { success: false, error: '条目 ID 格式无效' },
        { status: 400 },
      );
    }

    const session = await getVerifiedSession();
    if (!session || !session.sub) {
      return NextResponse.json(
        { success: false, error: '未登录或会话已过期' },
        { status: 401 },
      );
    }
    userId = session.sub;

    const parsed = createAttachmentSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: parsed.error.issues[0]?.message ?? '请求参数无效' },
        { status: 400 },
      );
    }

    const { filenameEncrypted, mimeTypeEncrypted, fileSize, dataEncrypted } = parsed.data;

    // 验证条目属于当前用户
    const existing = await db.query(
      'SELECT id FROM items WHERE id = $1 AND user_id = $2',
      [itemId, userId],
    );
    if (existing.rows.length === 0) {
      return NextResponse.json(
        { success: false, error: '条目不存在或无权操作' },
        { status: 404 },
      );
    }

    // 检查附件数量限制
    const countResult = await db.query(
      'SELECT COUNT(*)::int AS count FROM item_attachments WHERE item_id = $1',
      [itemId],
    );
    const currentCount = countResult.rows[0].count as number;
    if (currentCount >= MAX_ATTACHMENTS_PER_ITEM) {
      return NextResponse.json(
        { success: false, error: `每个条目最多 ${MAX_ATTACHMENTS_PER_ITEM} 个附件` },
        { status: 400 },
      );
    }

    const result = await db.query(
      `INSERT INTO item_attachments
         (item_id, user_id, filename_encrypted, mime_type_encrypted, file_size, data_encrypted)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING id`,
      [
        itemId,
        userId,
        JSON.stringify(filenameEncrypted),
        JSON.stringify(mimeTypeEncrypted),
        fileSize,
        JSON.stringify(dataEncrypted),
      ],
    );

    const response: CreateAttachmentResponse = {
      id: result.rows[0].id as string,
    };

    return NextResponse.json(response, { status: 201 });
  } catch (err) {
    logApiError('attachments/create', err, { userId, pathParam: itemId });
    return NextResponse.json(
      { success: false, error: '服务器内部错误' },
      { status: 500 },
    );
  }
}

/**
 * GET /api/items/[id]/attachments - 列出条目的附件
 *
 * 响应：200 [{ id, fileSize, createdAt }]
 */
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
): Promise<NextResponse> {
  let userId: string | undefined;
  let itemId: string | undefined;
  try {
    const { id } = await params;
    itemId = id;

    const session = await getVerifiedSession();
    if (!session || !session.sub) {
      return NextResponse.json(
        { success: false, error: '未登录或会话已过期' },
        { status: 401 },
      );
    }
    userId = session.sub;

    const result = await db.query(
      `SELECT id, file_size, created_at
       FROM item_attachments
       WHERE item_id = $1 AND user_id = $2
       ORDER BY created_at DESC`,
      [itemId, userId],
    );

    const items: AttachmentListItem[] = result.rows.map((row) => ({
      id: row.id as string,
      fileSize: row.file_size as number,
      createdAt: row.created_at as string,
    }));

    return NextResponse.json(items, { status: 200 });
  } catch (err) {
    logApiError('attachments/list', err, { userId, pathParam: itemId });
    return NextResponse.json(
      { success: false, error: '服务器内部错误' },
      { status: 500 },
    );
  }
}
