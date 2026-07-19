/**
 * 共享链接 API
 *
 * POST /api/share - 创建共享链接
 * GET  /api/share - 列出当前用户的共享链接
 *
 * @see docs/SHARE_LINK_DESIGN.md
 */
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { getVerifiedSession } from '@/lib/auth-check';
import { db } from '@/lib/db';
import { logApiError } from '@/lib/api-log';
import type { CreateShareRequest, CreateShareResponse, ShareListItem } from '@/types/share';

const createShareSchema = z.object({
  encryptedTitle: z.string().min(1, '加密标题不能为空'),
  encryptedData: z.string().min(1, '加密数据不能为空'),
  itemTypeCode: z.string().min(1, '条目类型不能为空'),
  expiresInHours: z.number().int().positive('过期时间必须为正整数'),
  maxViews: z.number().int().positive('最大查看次数必须为正整数').nullable().optional(),
});

/**
 * POST /api/share - 创建共享链接
 *
 * 请求体：CreateShareRequest
 * 响应：201 { id }
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

    const parsed = createShareSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: parsed.error.issues[0]?.message ?? '请求参数无效' },
        { status: 400 },
      );
    }

    const { encryptedTitle, encryptedData, itemTypeCode, expiresInHours, maxViews } =
      parsed.data as CreateShareRequest;

    const expiresAt = new Date(Date.now() + expiresInHours * 3600 * 1000);

    const result = await db.query(
      `INSERT INTO shared_items
         (user_id, item_title_encrypted, item_data_encrypted, item_type_code, expires_at, max_views)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING id`,
      [userId, encryptedTitle, encryptedData, itemTypeCode, expiresAt, maxViews ?? null],
    );

    const id = result.rows[0].id as string;
    const response: CreateShareResponse = { id };

    return NextResponse.json(response, { status: 201 });
  } catch (err) {
    logApiError('share/create', err, { userId });
    return NextResponse.json(
      { success: false, error: '服务器内部错误' },
      { status: 500 },
    );
  }
}

/**
 * GET /api/share - 列出当前用户的共享链接
 *
 * 响应：200 ShareListItem[]
 */
export async function GET(): Promise<NextResponse> {
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

    const result = await db.query(
      `SELECT id, item_type_code, created_at, expires_at, max_views, view_count
       FROM shared_items
       WHERE user_id = $1
       ORDER BY created_at DESC`,
      [userId],
    );

    const now = Date.now();
    const items: ShareListItem[] = result.rows.map((row) => {
      const expiresAt = row.expires_at as string;
      return {
        id: row.id as string,
        itemTypeCode: row.item_type_code as string,
        createdAt: row.created_at as string,
        expiresAt,
        maxViews: (row.max_views as number | null) ?? null,
        viewCount: row.view_count as number,
        expired: new Date(expiresAt).getTime() < now,
      };
    });

    return NextResponse.json(items, { status: 200 });
  } catch (err) {
    logApiError('share/list', err, { userId });
    return NextResponse.json(
      { success: false, error: '服务器内部错误' },
      { status: 500 },
    );
  }
}
