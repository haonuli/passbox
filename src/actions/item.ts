/**
 * 条目 Server Actions (T4.1)
 *
 * 对应 TASK_BREAKDOWN T4.1 验收标准：
 * - createItem / updateItem / deleteItem / toggleFavorite
 * - 所有操作验证当前用户身份（userId from session）
 * - WHERE user_id = $1 确保数据隔离
 * - 返回 ActionResult<T> 格式
 * - 删除操作使用事务保证原子性
 * - createItem/updateItem 支持传入预生成的 itemId（UUID）用于 AAD 绑定
 *
 * @see TECHNICAL_DESIGN.md 5.3 Server Actions
 */
'use server';

import { db } from '@/lib/db';
import { getVerifiedSession } from '@/lib/auth-check';
import type { ActionResult, CreateItemInput, UpdateItemInput } from '@/types/api';
import type { ItemRow } from '@/types/db';

/**
 * 创建条目。
 *
 * @param input 包含 vaultId / itemTypeId / titleEncrypted / dataEncrypted / tagIds
 * @returns 创建的条目记录（密文）
 */
export async function createItem(input: CreateItemInput): Promise<ActionResult<ItemRow>> {
  try {
    const session = await getVerifiedSession();
    if (!session?.sub) {
      return { ok: false, error: '未登录或会话已过期' };
    }
    const userId = session.sub;

    // 验证保险库属于当前用户
    const vaultCheck = await db.query(
      'SELECT id FROM vaults WHERE id = $1 AND user_id = $2',
      [input.vaultId, userId],
    );
    if (vaultCheck.rows.length === 0) {
      return { ok: false, error: '指定的保险库不存在' };
    }

    const client = await db.connect();
    try {
      await client.query('BEGIN');

      const result = await client.query<ItemRow>(
        `INSERT INTO items (id, user_id, vault_id, item_type_id, title_encrypted, data_encrypted)
         VALUES ($1, $2, $3, $4, $5, $6)
         RETURNING id, user_id, vault_id, item_type_id, title_encrypted, data_encrypted,
                   is_favorite, created_at, updated_at`,
        [
          input.itemId,
          userId,
          input.vaultId,
          input.itemTypeId,
          JSON.stringify(input.titleEncrypted),
          JSON.stringify(input.dataEncrypted),
        ],
      );

      const item = result.rows[0];

      // 关联标签
      if (input.tagIds.length > 0) {
        for (const tagId of input.tagIds) {
          // 验证标签属于当前用户
          await client.query(
            `INSERT INTO item_tags (item_id, tag_id)
             SELECT $1, $2 WHERE EXISTS (SELECT 1 FROM tags WHERE id = $2 AND user_id = $3)`,
            [item.id, tagId, userId],
          );
        }
      }

      await client.query('COMMIT');
      return { ok: true, data: item };
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  } catch (err) {
    console.error('[createItem] 创建失败:', err instanceof Error ? err.message : '未知错误');
    return { ok: false, error: '创建条目失败，请稍后重试' };
  }
}

/**
 * 更新条目。
 *
 * @param itemId 条目 ID
 * @param input 可更新字段：vaultId / titleEncrypted / dataEncrypted / tagIds
 * @returns 更新后的条目记录（密文）
 */
export async function updateItem(
  itemId: string,
  input: UpdateItemInput,
): Promise<ActionResult<ItemRow>> {
  try {
    const session = await getVerifiedSession();
    if (!session?.sub) {
      return { ok: false, error: '未登录或会话已过期' };
    }
    const userId = session.sub;

    const client = await db.connect();
    try {
      await client.query('BEGIN');

      // 验证条目属于当前用户
      const existing = await client.query(
        'SELECT id FROM items WHERE id = $1 AND user_id = $2 FOR UPDATE',
        [itemId, userId],
      );
      if (existing.rows.length === 0) {
        await client.query('ROLLBACK');
        return { ok: false, error: '条目不存在' };
      }

      // 构建动态更新
      const setClauses: string[] = [];
      const params: unknown[] = [];
      let paramIdx = 1;

      if (input.vaultId !== undefined) {
        // 验证新保险库属于当前用户
        const vaultCheck = await client.query(
          'SELECT id FROM vaults WHERE id = $1 AND user_id = $2',
          [input.vaultId, userId],
        );
        if (vaultCheck.rows.length === 0) {
          await client.query('ROLLBACK');
          return { ok: false, error: '指定的保险库不存在' };
        }
        setClauses.push(`vault_id = $${paramIdx++}`);
        params.push(input.vaultId);
      }
      if (input.titleEncrypted !== undefined) {
        setClauses.push(`title_encrypted = $${paramIdx++}`);
        params.push(JSON.stringify(input.titleEncrypted));
      }
      if (input.dataEncrypted !== undefined) {
        setClauses.push(`data_encrypted = $${paramIdx++}`);
        params.push(JSON.stringify(input.dataEncrypted));
      }

      if (setClauses.length > 0) {
        params.push(itemId);
        await client.query(
          `UPDATE items SET ${setClauses.join(', ')} WHERE id = $${paramIdx}`,
          params,
        );
      }

      // 更新标签关联
      if (input.tagIds !== undefined) {
        await client.query('DELETE FROM item_tags WHERE item_id = $1', [itemId]);
        for (const tagId of input.tagIds) {
          await client.query(
            `INSERT INTO item_tags (item_id, tag_id)
             SELECT $1, $2 WHERE EXISTS (SELECT 1 FROM tags WHERE id = $2 AND user_id = $3)`,
            [itemId, tagId, userId],
          );
        }
      }

      const result = await client.query<ItemRow>(
        `SELECT id, user_id, vault_id, item_type_id, title_encrypted, data_encrypted,
                is_favorite, created_at, updated_at
         FROM items WHERE id = $1`,
        [itemId],
      );

      await client.query('COMMIT');
      return { ok: true, data: result.rows[0] };
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  } catch {
    return { ok: false, error: '更新条目失败，请稍后重试' };
  }
}

/**
 * 删除条目（级联删除 item_tags）。
 *
 * @param itemId 条目 ID
 */
export async function deleteItem(itemId: string): Promise<ActionResult<null>> {
  try {
    const session = await getVerifiedSession();
    if (!session?.sub) {
      return { ok: false, error: '未登录或会话已过期' };
    }
    const userId = session.sub;

    const result = await db.query(
      'DELETE FROM items WHERE id = $1 AND user_id = $2',
      [itemId, userId],
    );
    if (result.rowCount === 0) {
      return { ok: false, error: '条目不存在或已删除' };
    }

    return { ok: true, data: null };
  } catch {
    return { ok: false, error: '删除条目失败，请稍后重试' };
  }
}

/**
 * 切换收藏标记。
 *
 * @param itemId 条目 ID
 * @param isFavorite 目标收藏状态
 * @returns 更新后的条目记录（密文）
 */
export async function toggleFavorite(
  itemId: string,
  isFavorite: boolean,
): Promise<ActionResult<ItemRow>> {
  try {
    const session = await getVerifiedSession();
    if (!session?.sub) {
      return { ok: false, error: '未登录或会话已过期' };
    }
    const userId = session.sub;

    const result = await db.query<ItemRow>(
      `UPDATE items SET is_favorite = $1
       WHERE id = $2 AND user_id = $3
       RETURNING id, user_id, vault_id, item_type_id, title_encrypted, data_encrypted,
                 is_favorite, created_at, updated_at`,
      [isFavorite, itemId, userId],
    );
    if (result.rows.length === 0) {
      return { ok: false, error: '条目不存在' };
    }

    return { ok: true, data: result.rows[0] };
  } catch {
    return { ok: false, error: '更新收藏状态失败，请稍后重试' };
  }
}
