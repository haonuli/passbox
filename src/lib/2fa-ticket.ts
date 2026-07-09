/**
 * 2FA 临时 Ticket 管理 (T6.2)
 *
 * 登录密码验证通过但用户开启了 2FA 时，签发一个短期 ticket 供客户端
 * 完成 TOTP 验证。ticket 本身是 UUID，真正的 userId 映射保存在
 * PostgreSQL two_fa_tickets 表中，5 分钟后自动过期。
 *
 * 设计要点：
 * - ticket = gen_random_uuid()，不可猜测
 * - PostgreSQL 存储替代内存 Map，适配 serverless 多实例部署
 * - verifyTicket 验证后不删除（允许重试），由过期时间兜底
 * - consumeTicket 验证成功后删除（防止重放）
 * - 惰性清理过期 ticket（每次创建时顺便清理）
 *
 * @see TASK_BREAKDOWN T6.2
 */
import { db } from './db';

/** Ticket 有效期（毫秒）：5 分钟 */
const TICKET_TTL_MS = 5 * 60 * 1000;

/**
 * 创建 2FA 验证 ticket。
 *
 * @param userId 已通过密码验证的用户 ID
 * @returns ticket 字符串（UUID），客户端用于后续 2FA 验证请求
 */
export async function createTicket(userId: string): Promise<string> {
  const expiresAt = new Date(Date.now() + TICKET_TTL_MS);

  const result = await db.query(
    `INSERT INTO two_fa_tickets (user_id, expires_at)
     VALUES ($1, $2)
     RETURNING ticket::text`,
    [userId, expiresAt],
  );

  // 惰性清理过期 ticket（不影响主流程，失败可忽略）
  db.query(`DELETE FROM two_fa_tickets WHERE expires_at < NOW()`).catch(() => {});

  return result.rows[0].ticket as string;
}

/**
 * 验证 ticket 并返回关联的 userId。
 *
 * 过期或无效的 ticket 返回 null。验证后不删除 ticket，
 * 允许用户在有效期内多次尝试 TOTP 验证码。
 *
 * @param ticket 客户端提交的 ticket 字符串
 * @returns userId 或 null（过期 / 不存在）
 */
export async function verifyTicket(ticket: string): Promise<string | null> {
  const result = await db.query(
    `SELECT user_id::text FROM two_fa_tickets
     WHERE ticket = $1 AND expires_at > NOW()`,
    [ticket],
  );

  if (result.rows.length === 0) {
    return null;
  }

  return result.rows[0].user_id as string;
}

/**
 * 删除指定 ticket（验证成功后调用，防止 ticket 被重复使用）。
 */
export async function consumeTicket(ticket: string): Promise<void> {
  await db.query(`DELETE FROM two_fa_tickets WHERE ticket = $1`, [ticket]);
}
