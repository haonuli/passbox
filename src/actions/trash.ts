/**
 * 回收站 Server Actions (D-11)
 *
 * 软删除机制：条目删除后移入回收站（deleted_at 标记），30 天内可恢复。
 * 超过 30 天的条目通过 lazy purge 机制物理清理（每次访问回收站时触发）。
 *
 * - listTrashItems(): 返回回收站条目（密文），自动触发过期清理
 * - restoreItem(itemId): 恢复条目（清空 deleted_at）
 * - purgeItem(itemId): 物理删除单条
 * - purgeAllItems(): 清空当前用户回收站
 */
'use server';

import { db } from '@/lib/db';
import { getVerifiedSession } from '@/lib/auth-check';
import { TRASH_RETENTION_DAYS } from '@/lib/trash';
import type { ActionResult } from '@/types/api';
import type { ItemRow } from '@/types/db';

/**
 * 清理已过期的回收站条目（deleted_at < NOW() - 30 天）。
 *
 * Lazy purge 机制：不依赖定时任务，在每次访问回收站前调用，
 * 物理删除超过保留期的条目，保持回收站整洁。
 *
 * @param userId 用户 ID
 * @returns 清理的条目数量
 */
export async function purgeExpiredItems(userId: string): Promise<number> {
  const result = await db.query(
    `DELETE FROM items
     WHERE user_id = $1
       AND deleted_at IS NOT NULL
       AND deleted_at < NOW() - INTERVAL '${TRASH_RETENTION_DAYS} days'`,
    [userId],
  );
  return result.rowCount ?? 0;
}

/**
 * 获取回收站条目列表（密文）。
 *
 * 返回当前用户已软删除的条目，按删除时间倒序。
 * 调用前自动触发 lazy purge 清理过期条目。
 *
 * 客户端用 Symmetric Key 解密后展示标题、类型、删除时间、剩余天数。
 */
export async function listTrashItems(): Promise<ActionResult<ItemRow[]>> {
  try {
    const session = await getVerifiedSession();
    if (!session?.sub) {
      return { ok: false, error: '未登录或会话已过期' };
    }
    const userId = session.sub;

    // Lazy purge：先清理过期条目
    await purgeExpiredItems(userId);

    const result = await db.query<ItemRow>(
      `SELECT id, user_id, vault_id, item_type_id, title_encrypted, data_encrypted,
              is_favorite, created_at, updated_at, deleted_at
       FROM items
       WHERE user_id = $1 AND deleted_at IS NOT NULL
       ORDER BY deleted_at DESC`,
      [userId],
    );

    return { ok: true, data: result.rows };
  } catch {
    return { ok: false, error: '获取回收站数据失败，请稍后重试' };
  }
}

/**
 * 恢复条目（从回收站移回原保险库）。
 *
 * 清空 deleted_at 字段，条目重新出现在密码库列表中。
 * 不变更 updated_at（保留原修改时间，仅 updated_at 触发器不会因 deleted_at 变更触发）。
 *
 * @param itemId 条目 ID
 */
export async function restoreItem(itemId: string): Promise<ActionResult<null>> {
  try {
    const session = await getVerifiedSession();
    if (!session?.sub) {
      return { ok: false, error: '未登录或会话已过期' };
    }
    const userId = session.sub;

    // 验证原保险库仍存在（用户可能在删除条目前已删除保险库，此时不允许恢复）
    const item = await db.query<{ vault_id: string }>(
      'SELECT vault_id FROM items WHERE id = $1 AND user_id = $2 AND deleted_at IS NOT NULL',
      [itemId, userId],
    );
    if (item.rows.length === 0) {
      return { ok: false, error: '条目不存在或已恢复' };
    }

    const vaultCheck = await db.query(
      'SELECT id FROM vaults WHERE id = $1 AND user_id = $2',
      [item.rows[0].vault_id, userId],
    );
    if (vaultCheck.rows.length === 0) {
      return { ok: false, error: '原保险库已删除，无法恢复' };
    }

    // 清空 deleted_at（updated_at 触发器会自动更新）
    const result = await db.query(
      `UPDATE items SET deleted_at = NULL
       WHERE id = $1 AND user_id = $2 AND deleted_at IS NOT NULL`,
      [itemId, userId],
    );
    if (result.rowCount === 0) {
      return { ok: false, error: '条目不存在或已恢复' };
    }

    return { ok: true, data: null };
  } catch {
    return { ok: false, error: '恢复条目失败，请稍后重试' };
  }
}

/**
 * 彻底删除单条回收站条目（物理删除，不可恢复）。
 *
 * 级联删除 item_tags / item_history / item_attachments（由外键 ON DELETE CASCADE 保证）。
 *
 * @param itemId 条目 ID
 */
export async function purgeItem(itemId: string): Promise<ActionResult<null>> {
  try {
    const session = await getVerifiedSession();
    if (!session?.sub) {
      return { ok: false, error: '未登录或会话已过期' };
    }
    const userId = session.sub;

    const result = await db.query(
      `DELETE FROM items
       WHERE id = $1 AND user_id = $2 AND deleted_at IS NOT NULL`,
      [itemId, userId],
    );
    if (result.rowCount === 0) {
      return { ok: false, error: '条目不存在或不在回收站' };
    }

    return { ok: true, data: null };
  } catch {
    return { ok: false, error: '彻底删除失败，请稍后重试' };
  }
}

/**
 * 清空回收站（物理删除当前用户所有回收站条目）。
 *
 * 仅清理已软删除（deleted_at IS NOT NULL）的条目，不影响正常条目。
 * 级联删除关联数据由外键约束保证。
 */
export async function purgeAllItems(): Promise<ActionResult<{ deletedCount: number }>> {
  try {
    const session = await getVerifiedSession();
    if (!session?.sub) {
      return { ok: false, error: '未登录或会话已过期' };
    }
    const userId = session.sub;

    const result = await db.query(
      `DELETE FROM items
       WHERE user_id = $1 AND deleted_at IS NOT NULL`,
      [userId],
    );

    return { ok: true, data: { deletedCount: result.rowCount ?? 0 } };
  } catch {
    return { ok: false, error: '清空回收站失败，请稍后重试' };
  }
}
