/**
 * 标签 Server Actions (T6.4)
 *
 * 对应 TASK_BREAKDOWN T6.4 验收标准：
 * - createTag / renameTag / deleteTag / getItemTags
 * - 所有操作验证当前用户身份（userId from session）
 * - WHERE user_id = $1 确保数据隔离
 * - 返回 ActionResult<T> 格式
 * - tags 表 (user_id, name) UNIQUE 约束由数据库保证
 * - item_tags 通过 ON DELETE CASCADE 级联删除
 *
 * @see TECHNICAL_DESIGN.md 5.3 Server Actions
 */
'use server';

import { db } from '@/lib/db';
import { getVerifiedSession } from '@/lib/auth-check';
import type { ActionResult } from '@/types/api';
import type { TagRow } from '@/types/db';

/** 标签名称最大长度 */
const MAX_TAG_NAME_LENGTH = 50;

/** 标签查询返回的列 */
const TAG_COLUMNS = 'id, user_id, name, created_at';

/**
 * 创建标签。
 *
 * 验证 user_id + name 唯一约束（数据库 UNIQUE 约束兜底）。
 *
 * @param name 标签名称
 * @returns 创建的标签记录
 */
export async function createTag(name: string): Promise<ActionResult<TagRow>> {
  try {
    const session = await getVerifiedSession();
    if (!session?.sub) {
      return { ok: false, error: '未登录或会话已过期' };
    }
    const userId = session.sub;

    const trimmedName = name.trim();
    if (!trimmedName) {
      return { ok: false, error: '标签名称不能为空' };
    }
    if (trimmedName.length > MAX_TAG_NAME_LENGTH) {
      return { ok: false, error: `标签名称不能超过 ${MAX_TAG_NAME_LENGTH} 个字符` };
    }

    const result = await db.query<TagRow>(
      `INSERT INTO tags (user_id, name)
       VALUES ($1, $2)
       RETURNING ${TAG_COLUMNS}`,
      [userId, trimmedName],
    );

    return { ok: true, data: result.rows[0] };
  } catch (err) {
    // 23505: unique_violation — (user_id, name) 已存在
    if (err && typeof err === 'object' && 'code' in err && err.code === '23505') {
      return { ok: false, error: '该标签已存在' };
    }
    return { ok: false, error: '创建标签失败，请稍后重试' };
  }
}

/**
 * 重命名标签。
 *
 * 验证标签属于当前用户，新名称需满足 (user_id, name) 唯一约束。
 *
 * @param tagId 标签 ID
 * @param name 新标签名称
 * @returns 更新后的标签记录
 */
export async function renameTag(
  tagId: string,
  name: string,
): Promise<ActionResult<TagRow>> {
  try {
    const session = await getVerifiedSession();
    if (!session?.sub) {
      return { ok: false, error: '未登录或会话已过期' };
    }
    const userId = session.sub;

    const trimmedName = name.trim();
    if (!trimmedName) {
      return { ok: false, error: '标签名称不能为空' };
    }
    if (trimmedName.length > MAX_TAG_NAME_LENGTH) {
      return { ok: false, error: `标签名称不能超过 ${MAX_TAG_NAME_LENGTH} 个字符` };
    }

    const result = await db.query<TagRow>(
      `UPDATE tags SET name = $1
       WHERE id = $2 AND user_id = $3
       RETURNING ${TAG_COLUMNS}`,
      [trimmedName, tagId, userId],
    );
    if (result.rows.length === 0) {
      return { ok: false, error: '标签不存在' };
    }

    return { ok: true, data: result.rows[0] };
  } catch (err) {
    if (err && typeof err === 'object' && 'code' in err && err.code === '23505') {
      return { ok: false, error: '该标签名称已存在' };
    }
    return { ok: false, error: '重命名标签失败，请稍后重试' };
  }
}

/**
 * 删除标签。
 *
 * item_tags 通过 ON DELETE CASCADE 自动级联删除关联记录。
 *
 * @param tagId 标签 ID
 */
export async function deleteTag(tagId: string): Promise<ActionResult<null>> {
  try {
    const session = await getVerifiedSession();
    if (!session?.sub) {
      return { ok: false, error: '未登录或会话已过期' };
    }
    const userId = session.sub;

    const result = await db.query(
      'DELETE FROM tags WHERE id = $1 AND user_id = $2',
      [tagId, userId],
    );
    if (result.rowCount === 0) {
      return { ok: false, error: '标签不存在或已删除' };
    }

    return { ok: true, data: null };
  } catch {
    return { ok: false, error: '删除标签失败，请稍后重试' };
  }
}

/**
 * 获取条目的标签列表。
 *
 * 通过 item_tags JOIN tags 查询，仅返回属于当前用户的标签。
 *
 * @param itemId 条目 ID
 * @returns 标签记录列表
 */
export async function getItemTags(itemId: string): Promise<ActionResult<TagRow[]>> {
  try {
    const session = await getVerifiedSession();
    if (!session?.sub) {
      return { ok: false, error: '未登录或会话已过期' };
    }
    const userId = session.sub;

    const result = await db.query<TagRow>(
      `SELECT t.${TAG_COLUMNS}
       FROM tags t
       INNER JOIN item_tags it ON it.tag_id = t.id
       WHERE it.item_id = $1 AND t.user_id = $2
       ORDER BY t.name ASC`,
      [itemId, userId],
    );

    return { ok: true, data: result.rows };
  } catch {
    return { ok: false, error: '获取标签列表失败，请稍后重试' };
  }
}
