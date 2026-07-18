/**
 * 单个附件 API
 *
 * GET    /api/attachments/[id] - 获取附件加密数据（客户端解密）
 * DELETE /api/attachments/[id] - 删除附件
 *
 * 附件内容（文件名、MIME、数据）以 EncryptedData JSON 存储在数据库，
 * 服务端不解密，仅返回密文由客户端使用 symmetricKey 解密。
 */
import { NextRequest, NextResponse } from 'next/server';
import { getVerifiedSession } from '@/lib/auth-check';
import { db } from '@/lib/db';
import type { EncryptedData } from '@/types/crypto';

interface GetAttachmentResponse {
  id: string;
  itemId: string;
  filenameEncrypted: EncryptedData;
  mimeTypeEncrypted: EncryptedData;
  fileSize: number;
  dataEncrypted: EncryptedData;
  createdAt: string;
}

/**
 * GET /api/attachments/[id] - 获取附件加密数据
 *
 * 响应：200 { id, itemId, filenameEncrypted, mimeTypeEncrypted, fileSize, dataEncrypted, createdAt }
 */
export async function GET(
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
    const userId = session.sub;

    const result = await db.query(
      `SELECT id, item_id, filename_encrypted, mime_type_encrypted, file_size, data_encrypted, created_at
       FROM item_attachments
       WHERE id = $1 AND user_id = $2`,
      [id, userId],
    );

    if (result.rows.length === 0) {
      return NextResponse.json(
        { success: false, error: '附件不存在或无权操作' },
        { status: 404 },
      );
    }

    const row = result.rows[0];
    const response: GetAttachmentResponse = {
      id: row.id as string,
      itemId: row.item_id as string,
      filenameEncrypted: JSON.parse(row.filename_encrypted as string) as EncryptedData,
      mimeTypeEncrypted: JSON.parse(row.mime_type_encrypted as string) as EncryptedData,
      fileSize: row.file_size as number,
      dataEncrypted: JSON.parse(row.data_encrypted as string) as EncryptedData,
      createdAt: row.created_at as string,
    };

    return NextResponse.json(response, { status: 200 });
  } catch (err) {
    console.error('[attachments/get] 未预期错误:', err instanceof Error ? err.message : '未知错误');
    return NextResponse.json(
      { success: false, error: '服务器内部错误' },
      { status: 500 },
    );
  }
}

/**
 * DELETE /api/attachments/[id] - 删除附件
 *
 * 响应：200 { success: true }
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
    const userId = session.sub;

    const result = await db.query(
      `DELETE FROM item_attachments WHERE id = $1 AND user_id = $2`,
      [id, userId],
    );

    if (result.rowCount === 0) {
      return NextResponse.json(
        { success: false, error: '附件不存在或无权操作' },
        { status: 404 },
      );
    }

    return NextResponse.json({ success: true }, { status: 200 });
  } catch (err) {
    console.error('[attachments/delete] 未预期错误:', err instanceof Error ? err.message : '未知错误');
    return NextResponse.json(
      { success: false, error: '服务器内部错误' },
      { status: 500 },
    );
  }
}
