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
