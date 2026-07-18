/**
 * Vault 数据 API（浏览器扩展用）
 *
 * GET /api/vault - 返回当前用户的所有加密 vault 数据
 *
 * 响应：200 { vaults, items, tags, itemTypes }
 */
import { NextResponse } from 'next/server';
import { getVerifiedSession } from '@/lib/auth-check';
import { db } from '@/lib/db';
import type { EncryptedData } from '@/types/crypto';

interface VaultResponse {
  vaults: Array<{ id: string; nameEncrypted: EncryptedData }>;
  items: Array<{
    id: string;
    vaultId: string;
    itemTypeId: number;
    titleEncrypted: EncryptedData;
    dataEncrypted: EncryptedData;
    isFavorite: boolean;
    createdAt: string;
    updatedAt: string;
  }>;
  tags: Array<{ id: string; nameEncrypted: EncryptedData }>;
  itemTypes: Array<{ id: number; code: string; name: string }>;
}

/**
 * GET /api/vault - 获取当前用户的全部 vault 数据（密文）
 *
 * 并行查询 vaults / items / tags / item_types 四张表，
 * 加密字段（name_encrypted / title_encrypted / data_encrypted）
 * 在数据库中以 JSON 字符串形式存储，此处 JSON.parse 后返回。
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
    const userId = session.sub;

    const [vaultsResult, itemsResult, tagsResult, itemTypesResult] = await Promise.all([
      db.query('SELECT id, name_encrypted FROM vaults WHERE user_id = $1', [userId]),
      db.query(
        `SELECT id, vault_id, item_type_id, title_encrypted, data_encrypted,
                is_favorite, created_at, updated_at
         FROM items
         WHERE user_id = $1
         ORDER BY updated_at DESC`,
        [userId],
      ),
      db.query('SELECT id, name_encrypted FROM tags WHERE user_id = $1', [userId]),
      db.query('SELECT id, code, name FROM item_types ORDER BY id'),
    ]);

    const vaults = vaultsResult.rows.map((row) => ({
      id: row.id as string,
      nameEncrypted: JSON.parse(row.name_encrypted as string) as EncryptedData,
    }));

    const items = itemsResult.rows.map((row) => ({
      id: row.id as string,
      vaultId: row.vault_id as string,
      itemTypeId: row.item_type_id as number,
      titleEncrypted: JSON.parse(row.title_encrypted as string) as EncryptedData,
      dataEncrypted: JSON.parse(row.data_encrypted as string) as EncryptedData,
      isFavorite: row.is_favorite as boolean,
      createdAt: row.created_at as string,
      updatedAt: row.updated_at as string,
    }));

    const tags = tagsResult.rows.map((row) => ({
      id: row.id as string,
      nameEncrypted: JSON.parse(row.name_encrypted as string) as EncryptedData,
    }));

    const itemTypes = itemTypesResult.rows.map((row) => ({
      id: row.id as number,
      code: row.code as string,
      name: row.name as string,
    }));

    const response: VaultResponse = { vaults, items, tags, itemTypes };
    return NextResponse.json(response, { status: 200 });
  } catch (err) {
    console.error('[vault/list] 未预期错误:', err instanceof Error ? err.message : '未知错误');
    return NextResponse.json(
      { success: false, error: '服务器内部错误' },
      { status: 500 },
    );
  }
}
