/**
 * 2FA 临时 Ticket 管理 (T6.2)
 *
 * 登录密码验证通过但用户开启了 2FA 时，签发一个短期 ticket 供客户端
 * 完成 TOTP 验证。ticket 本身不携带任何身份信息（仅是随机 UUID），
 * 真正的 userId 映射保存在服务端内存 Map 中，5 分钟后自动过期。
 *
 * 设计要点：
 * - ticket = crypto.randomUUID()，不可猜测
 * - 内存 Map 存储 { userId, expiresAt }，过期条目惰性清理
 * - verifyTicket 验证后不删除（允许重试），由过期时间兜底
 * - 进程重启后所有 ticket 失效（可接受，用户重新登录即可）
 *
 * @see TASK_BREAKDOWN T6.2
 */
import crypto from 'crypto';

/** Ticket 有效期（毫秒）：5 分钟 */
const TICKET_TTL_MS = 5 * 60 * 1000;

interface TicketEntry {
  userId: string;
  expiresAt: number;
}

/** 内存存储 ticket → { userId, expiresAt } */
const ticketStore = new Map<string, TicketEntry>();

/**
 * 创建 2FA 验证 ticket。
 *
 * @param userId 已通过密码验证的用户 ID
 * @returns ticket 字符串（UUID），客户端用于后续 2FA 验证请求
 */
export function createTicket(userId: string): string {
  const ticket = crypto.randomUUID();
  ticketStore.set(ticket, {
    userId,
    expiresAt: Date.now() + TICKET_TTL_MS,
  });
  return ticket;
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
export function verifyTicket(ticket: string): string | null {
  const entry = ticketStore.get(ticket);
  if (!entry) {
    return null;
  }

  // 过期检查
  if (Date.now() > entry.expiresAt) {
    ticketStore.delete(ticket);
    return null;
  }

  return entry.userId;
}

/**
 * 删除指定 ticket（验证成功后调用，防止 ticket 被重复使用）。
 */
export function consumeTicket(ticket: string): void {
  ticketStore.delete(ticket);
}
