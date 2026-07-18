/**
 * 条目历史版本 Server Actions
 *
 * 在更新条目前保存当前版本快照，支持查看与恢复历史版本。
 * 历史版本存储的是密文快照（title_encrypted / data_encrypted），
 * 解密在客户端进行（使用与条目相同的 AAD）。
 *
 * - saveHistory：保存当前条目版本到 item_history（更新前调用）
 * - listHistory：列出某条目的历史版本
 * - getHistoryVersion：获取某个历史版本的密文
 * - restoreVersion：恢复到指定历史版本（当前版本会先被保存为历史）
 *
 * @see item_history 表定义 src/lib/migrate.ts
 */
'use server';

import { db } from '@/lib/db';
import { getVerifiedSession } from '@/lib/auth-check';
import type { ActionResult } from '@/types/api';
import type { EncryptedData } from '@/types/crypto';

/** 历史版本列表项 */
export interface HistoryListItem {
  id: string;
  createdAt: string;
}

/** 历史版本详情（密文） */
export interface HistoryVersion {
  titleEncrypted: EncryptedData;
  dataEncrypted: EncryptedData;
  itemId: string;
  createdAt: string;
}

/** 每个条目保留的最大历史版本数 */
const MAX_HISTORY_VERSIONS = 50;

/**
 * 保存条目当前版本到历史记录。
 *
 * 读取 items 表中该条目的当前 title_encrypted / data_encrypted，
 * 写入 item_history，并清理超过 MAX_HISTORY_VERSIONS 的旧版本。
 *
 * @param itemId 条目 ID
 */
export async function saveHistory(itemId: string): Promise<ActionResult<null>> {
  try {
    const session = await getVerifiedSession();
    if (!session?.sub) {
      return { ok: false, error: '未登录或会话已过期' };
    }
    const userId = session.sub;

    // 读取当前条目密文（验证归属）
    const current = await db.query(
      'SELECT title_encrypted, data_encrypted FROM items WHERE id = $1 AND user_id = $2',
      [itemId, userId],
    );
    if (current.rows.length === 0) {
      return { ok: false, error: '条目不存在' };
    }

    const row = current.rows[0] as { title_encrypted: string; data_encrypted: string };

    await db.query(
      `INSERT INTO item_history (item_id, user_id, title_encrypted, data_encrypted)
       VALUES ($1, $2, $3, $4)`,
      [itemId, userId, row.title_encrypted, row.data_encrypted],
    );

    // 清理超过上限的旧版本
    await db.query(
      `DELETE FROM item_history
       WHERE item_id = $1 AND id NOT IN (
         SELECT id FROM item_history WHERE item_id = $1 ORDER BY created_at DESC LIMIT $2
       )`,
      [itemId, MAX_HISTORY_VERSIONS],
    );

    return { ok: true, data: null };
  } catch (err) {
    console.error('[saveHistory] 保存历史版本失败:', err instanceof Error ? err.message : '未知错误');
    return { ok: false, error: '保存历史版本失败，请稍后重试' };
  }
}

/**
 * 列出条目的历史版本。
 *
 * @param itemId 条目 ID
 * @returns 历史版本列表（按创建时间倒序，最多 50 条）
 */
export async function listHistory(
  itemId: string,
): Promise<ActionResult<HistoryListItem[]>> {
  try {
    const session = await getVerifiedSession();
    if (!session?.sub) {
      return { ok: false, error: '未登录或会话已过期' };
    }
    const userId = session.sub;

    // 验证条目属于当前用户
    const ownership = await db.query(
      'SELECT id FROM items WHERE id = $1 AND user_id = $2',
      [itemId, userId],
    );
    if (ownership.rows.length === 0) {
      return { ok: false, error: '条目不存在' };
    }

    const result = await db.query<{ id: string; created_at: string }>(
      `SELECT id, created_at FROM item_history
       WHERE item_id = $1 AND user_id = $2
       ORDER BY created_at DESC LIMIT $3`,
      [itemId, userId, MAX_HISTORY_VERSIONS],
    );

    const versions: HistoryListItem[] = result.rows.map((r) => ({
      id: r.id,
      createdAt: r.created_at,
    }));

    return { ok: true, data: versions };
  } catch (err) {
    console.error('[listHistory] 查询历史版本失败:', err instanceof Error ? err.message : '未知错误');
    return { ok: false, error: '查询历史版本失败，请稍后重试' };
  }
}

/**
 * 获取某个历史版本的密文详情。
 *
 * @param historyId 历史版本 ID
 * @returns 密文 + itemId + createdAt（客户端解密）
 */
export async function getHistoryVersion(
  historyId: string,
): Promise<ActionResult<HistoryVersion>> {
  try {
    const session = await getVerifiedSession();
    if (!session?.sub) {
      return { ok: false, error: '未登录或会话已过期' };
    }
    const userId = session.sub;

    const result = await db.query<{
      item_id: string;
      title_encrypted: string;
      data_encrypted: string;
      created_at: string;
    }>(
      `SELECT item_id, title_encrypted, data_encrypted, created_at
       FROM item_history WHERE id = $1 AND user_id = $2`,
      [historyId, userId],
    );
    if (result.rows.length === 0) {
      return { ok: false, error: '历史版本不存在' };
    }

    const row = result.rows[0];
    const version: HistoryVersion = {
      titleEncrypted: JSON.parse(row.title_encrypted) as EncryptedData,
      dataEncrypted: JSON.parse(row.data_encrypted) as EncryptedData,
      itemId: row.item_id,
      createdAt: row.created_at,
    };

    return { ok: true, data: version };
  } catch (err) {
    console.error('[getHistoryVersion] 获取历史版本失败:', err instanceof Error ? err.message : '未知错误');
    return { ok: false, error: '获取历史版本失败，请稍后重试' };
  }
}

/**
 * 恢复条目到指定历史版本。
 *
 * 流程：
 *   1. 读取历史版本密文
 *   2. 先调用 saveHistory 保存当前版本（防止恢复后丢失当前状态）
 *   3. 用历史版本密文覆盖 items 表
 *
 * @param historyId 历史版本 ID
 */
export async function restoreVersion(historyId: string): Promise<ActionResult<null>> {
  try {
    const session = await getVerifiedSession();
    if (!session?.sub) {
      return { ok: false, error: '未登录或会话已过期' };
    }
    const userId = session.sub;

    // 读取历史版本
    const historyResult = await db.query<{
      item_id: string;
      title_encrypted: string;
      data_encrypted: string;
    }>(
      `SELECT item_id, title_encrypted, data_encrypted
       FROM item_history WHERE id = $1 AND user_id = $2`,
      [historyId, userId],
    );
    if (historyResult.rows.length === 0) {
      return { ok: false, error: '历史版本不存在' };
    }
    const history = historyResult.rows[0];

    // 先保存当前版本（独立 try，失败不影响恢复主流程）
    await saveHistory(history.item_id);

    // 用历史版本覆盖当前条目
    await db.query(
      `UPDATE items SET title_encrypted = $1, data_encrypted = $2
       WHERE id = $3 AND user_id = $4`,
      [history.title_encrypted, history.data_encrypted, history.item_id, userId],
    );

    return { ok: true, data: null };
  } catch (err) {
    console.error('[restoreVersion] 恢复历史版本失败:', err instanceof Error ? err.message : '未知错误');
    return { ok: false, error: '恢复历史版本失败，请稍后重试' };
  }
}
