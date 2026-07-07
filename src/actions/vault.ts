/**
 * 密码库 Server Actions (T4.1)
 *
 * 对应 TASK_BREAKDOWN T4.1 验收标准：
 * - getVaultData() 返回当前用户所有 vaults + items + tags（密文）
 * - 所有查询使用参数化占位符，WHERE user_id = $1 确保数据隔离
 * - 返回 ActionResult<T> 格式
 *
 * @see TECHNICAL_DESIGN.md 5.3 Server Actions
 */
'use server';

import { db } from '@/lib/db';
import { getVerifiedSession } from '@/lib/auth-check';
import type { VaultData, ActionResult } from '@/types/api';
import type { VaultRow, ItemRow, TagRow } from '@/types/db';
import type { EncryptedData } from '@/types/crypto';

/**
 * 获取当前用户所有保险库 + 条目 + 标签（密文）。
 *
 * 服务端只返回密文，客户端用 Symmetric Key 解密。
 * 按 updated_at DESC 排序条目。
 */
export async function getVaultData(): Promise<ActionResult<VaultData>> {
  try {
    const session = await getVerifiedSession();
    if (!session?.sub) {
      return { ok: false, error: '未登录或会话已过期' };
    }
    const userId = session.sub;

    const [vaultsResult, itemsResult, tagsResult] = await Promise.all([
      db.query<VaultRow>(
        `SELECT id, user_id, name_encrypted, display_order, created_at, updated_at
         FROM vaults WHERE user_id = $1 ORDER BY display_order ASC, created_at ASC`,
        [userId],
      ),
      db.query<ItemRow>(
        `SELECT id, user_id, vault_id, item_type_id, title_encrypted, data_encrypted,
                is_favorite, created_at, updated_at
         FROM items WHERE user_id = $1 ORDER BY updated_at DESC`,
        [userId],
      ),
      db.query<TagRow>(
        `SELECT id, user_id, name, created_at FROM tags WHERE user_id = $1 ORDER BY name ASC`,
        [userId],
      ),
    ]);

    return {
      ok: true,
      data: {
        vaults: vaultsResult.rows,
        items: itemsResult.rows,
        tags: tagsResult.rows,
      },
    };
  } catch {
    return { ok: false, error: '获取密码库数据失败，请稍后重试' };
  }
}

/**
 * 创建保险库（T6.5）。
 *
 * 零知识架构下，保险库名称由客户端用 Symmetric Key 加密后传入，
 * 服务端只存储密文（JSON string）。
 *
 * @param nameEncrypted 客户端加密后的保险库名称
 * @returns 新创建的保险库记录（密文）
 */
export async function createVaultEncrypted(
  nameEncrypted: EncryptedData,
): Promise<ActionResult<VaultRow>> {
  try {
    const session = await getVerifiedSession();
    if (!session?.sub) {
      return { ok: false, error: '未登录或会话已过期' };
    }
    const userId = session.sub;

    const result = await db.query<VaultRow>(
      `INSERT INTO vaults (user_id, name_encrypted, display_order)
       VALUES ($1, $2, COALESCE((SELECT MAX(display_order) FROM vaults WHERE user_id = $1), -1) + 1)
       RETURNING id, user_id, name_encrypted, display_order, created_at, updated_at`,
      [userId, JSON.stringify(nameEncrypted)],
    );

    return { ok: true, data: result.rows[0] };
  } catch {
    return { ok: false, error: '创建保险库失败，请稍后重试' };
  }
}

/**
 * 重命名保险库（T6.5）。
 *
 * 更新 name_encrypted 字段（客户端加密后的新名称）。
 *
 * @param vaultId 保险库 ID
 * @param nameEncrypted 客户端加密后的新名称
 * @returns 更新后的保险库记录（密文）
 */
export async function renameVault(
  vaultId: string,
  nameEncrypted: EncryptedData,
): Promise<ActionResult<VaultRow>> {
  try {
    const session = await getVerifiedSession();
    if (!session?.sub) {
      return { ok: false, error: '未登录或会话已过期' };
    }
    const userId = session.sub;

    const result = await db.query<VaultRow>(
      `UPDATE vaults SET name_encrypted = $1, updated_at = NOW()
       WHERE id = $2 AND user_id = $3
       RETURNING id, user_id, name_encrypted, display_order, created_at, updated_at`,
      [JSON.stringify(nameEncrypted), vaultId, userId],
    );
    if (result.rows.length === 0) {
      return { ok: false, error: '保险库不存在' };
    }

    return { ok: true, data: result.rows[0] };
  } catch {
    return { ok: false, error: '重命名保险库失败，请稍后重试' };
  }
}

/**
 * 删除保险库（T6.5）。
 *
 * 安全策略：仅允许删除空保险库。若保险库中仍有条目，
 * 返回错误提示用户先转移或删除条目。
 *
 * @param vaultId 保险库 ID
 */
export async function deleteVault(vaultId: string): Promise<ActionResult<null>> {
  try {
    const session = await getVerifiedSession();
    if (!session?.sub) {
      return { ok: false, error: '未登录或会话已过期' };
    }
    const userId = session.sub;

    // 检查保险库是否为空
    const countResult = await db.query(
      'SELECT COUNT(*)::int AS count FROM items WHERE vault_id = $1 AND user_id = $2',
      [vaultId, userId],
    );
    const itemCount = countResult.rows[0].count as number;
    if (itemCount > 0) {
      return { ok: false, error: '请先转移或删除其中的条目' };
    }

    const result = await db.query(
      'DELETE FROM vaults WHERE id = $1 AND user_id = $2',
      [vaultId, userId],
    );
    if (result.rowCount === 0) {
      return { ok: false, error: '保险库不存在' };
    }

    return { ok: true, data: null };
  } catch {
    return { ok: false, error: '删除保险库失败，请稍后重试' };
  }
}
