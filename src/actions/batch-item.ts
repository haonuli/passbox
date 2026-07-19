/**
 * 批量条目 Server Actions
 *
 * 用于导入功能：批量创建/更新已加密的条目。
 * 事务包裹，失败时回滚整批。
 *
 * @see docs/IMPORT_EXPORT_DESIGN.md 7. 新增 Server Action
 */
'use server';

import { db } from '@/lib/db';
import { getVerifiedSession } from '@/lib/auth-check';
import type { ActionResult } from '@/types/api';
import type { BatchCreateItemInput, BatchUpdateItemInput } from '@/lib/import-export/types';

/**
 * 批量创建条目（事务，失败回滚整批）。
 *
 * @param items 已加密的条目数组
 * @returns 成功创建的数量
 */
export async function batchCreateItems(
  items: BatchCreateItemInput[],
): Promise<ActionResult<{ created: number }>> {
  try {
    const session = await getVerifiedSession();
    if (!session?.sub) {
      return { ok: false, error: '未登录或会话已过期' };
    }
    const userId = session.sub;

    if (items.length === 0) {
      return { ok: true, data: { created: 0 } };
    }

    const client = await db.connect();
    try {
      await client.query('BEGIN');

      let created = 0;
      for (const item of items) {
        // 验证保险库属于当前用户
        const vaultCheck = await client.query(
          'SELECT id FROM vaults WHERE id = $1 AND user_id = $2',
          [item.vaultId, userId],
        );
        if (vaultCheck.rows.length === 0) {
          throw new Error(`保险库 ${item.vaultId} 不存在`);
        }

        await client.query(
          `INSERT INTO items (id, user_id, vault_id, item_type_id, title_encrypted, data_encrypted)
           VALUES ($1, $2, $3, $4, $5, $6)`,
          [
            item.itemId,
            userId,
            item.vaultId,
            item.itemTypeId,
            JSON.stringify(item.titleEncrypted),
            JSON.stringify(item.dataEncrypted),
          ],
        );

        // 关联标签
        for (const tagId of item.tagIds) {
          await client.query(
            `INSERT INTO item_tags (item_id, tag_id)
             SELECT $1, $2 WHERE EXISTS (SELECT 1 FROM tags WHERE id = $2 AND user_id = $3)`,
            [item.itemId, tagId, userId],
          );
        }

        created++;
      }

      await client.query('COMMIT');
      return { ok: true, data: { created } };
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  } catch (err) {
    console.error('[batchCreateItems] 批量创建失败:', err instanceof Error ? err.message : '未知错误');
    return { ok: false, error: '批量导入失败，请稍后重试' };
  }
}

/**
 * 批量更新条目（覆盖已有，事务）。
 *
 * @param items 已加密的条目更新数组（需包含 itemId）
 * @returns 成功更新的数量
 */
export async function batchUpdateItems(
  items: BatchUpdateItemInput[],
): Promise<ActionResult<{ updated: number }>> {
  try {
    const session = await getVerifiedSession();
    if (!session?.sub) {
      return { ok: false, error: '未登录或会话已过期' };
    }
    const userId = session.sub;

    if (items.length === 0) {
      return { ok: true, data: { updated: 0 } };
    }

    const client = await db.connect();
    try {
      await client.query('BEGIN');

      let updated = 0;
      for (const item of items) {
        const result = await client.query(
          `UPDATE items SET title_encrypted = $1, data_encrypted = $2
           WHERE id = $3 AND user_id = $4`,
          [
            JSON.stringify(item.titleEncrypted),
            JSON.stringify(item.dataEncrypted),
            item.itemId,
            userId,
          ],
        );
        if (result.rowCount && result.rowCount > 0) {
          updated++;
        }
      }

      await client.query('COMMIT');
      return { ok: true, data: { updated } };
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  } catch (err) {
    console.error('[batchUpdateItems] 批量更新失败:', err instanceof Error ? err.message : '未知错误');
    return { ok: false, error: '批量更新失败，请稍后重试' };
  }
}

/**
 * 批量删除条目（事务，软删除，移入回收站）。
 *
 * 与单条 deleteItem 一致：标记 deleted_at = NOW()，30 天内可恢复。
 * 级联清理仅在 purgeItem/purgeAllItems 物理删除时生效（外键 ON DELETE CASCADE）。
 *
 * @param itemIds 待删除的条目 ID 列表
 * @returns 成功软删除的数量
 */
export async function batchDeleteItems(
  itemIds: string[],
): Promise<ActionResult<{ deleted: number }>> {
  try {
    const session = await getVerifiedSession();
    if (!session?.sub) {
      return { ok: false, error: '未登录或会话已过期' };
    }
    const userId = session.sub;

    if (itemIds.length === 0) {
      return { ok: true, data: { deleted: 0 } };
    }

    const client = await db.connect();
    try {
      await client.query('BEGIN');

      let deleted = 0;
      for (const itemId of itemIds) {
        const result = await client.query(
          `UPDATE items SET deleted_at = NOW()
           WHERE id = $1 AND user_id = $2 AND deleted_at IS NULL`,
          [itemId, userId],
        );
        if (result.rowCount && result.rowCount > 0) {
          deleted++;
        }
      }

      await client.query('COMMIT');
      return { ok: true, data: { deleted } };
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  } catch (err) {
    console.error('[batchDeleteItems] 批量删除失败:', err instanceof Error ? err.message : '未知错误');
    return { ok: false, error: '批量删除失败，请稍后重试' };
  }
}

/**
 * 批量移动条目到目标保险库（事务）。
 *
 * @param itemIds 待移动的条目 ID 列表
 * @param targetVaultId 目标保险库 ID
 * @returns 成功移动的数量
 */
export async function batchMoveItems(
  itemIds: string[],
  targetVaultId: string,
): Promise<ActionResult<{ moved: number }>> {
  try {
    const session = await getVerifiedSession();
    if (!session?.sub) {
      return { ok: false, error: '未登录或会话已过期' };
    }
    const userId = session.sub;

    if (itemIds.length === 0) {
      return { ok: true, data: { moved: 0 } };
    }

    const client = await db.connect();
    try {
      await client.query('BEGIN');

      // 验证目标保险库属于当前用户
      const vaultCheck = await client.query(
        'SELECT id FROM vaults WHERE id = $1 AND user_id = $2',
        [targetVaultId, userId],
      );
      if (vaultCheck.rows.length === 0) {
        await client.query('ROLLBACK');
        return { ok: false, error: '目标保险库不存在' };
      }

      let moved = 0;
      for (const itemId of itemIds) {
        const result = await client.query(
          `UPDATE items SET vault_id = $1, updated_at = NOW()
           WHERE id = $2 AND user_id = $3 AND vault_id != $1`,
          [targetVaultId, itemId, userId],
        );
        if (result.rowCount && result.rowCount > 0) {
          moved++;
        }
      }

      await client.query('COMMIT');
      return { ok: true, data: { moved } };
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  } catch (err) {
    console.error('[batchMoveItems] 批量移动失败:', err instanceof Error ? err.message : '未知错误');
    return { ok: false, error: '批量移动失败，请稍后重试' };
  }
}
