/**
 * 服务端会话校验（Node Runtime 专用，M-9 撤销机制）
 *
 * session.ts 的 verifySession 仅做 JWT 签名 + 过期校验（Edge 兼容，无 DB），
 * 无法检测服务端撤销。本模块补充 token_version 校验：
 *
 * - verifyTokenVersion(userId, ver)：查 users.token_version，与 JWT 中的 ver 比对
 * - getVerifiedSession()：Server Component 用，读 Cookie → 验签 → 校验 token_version
 *
 * ⚠️ 仅在 Node Runtime（Server Component / Route Handler）使用，禁止在 middleware（Edge）引入。
 *
 * @see TECHNICAL_DESIGN.md ADR-008（JWT 会话）+ M-9 撤销设计
 */
import { db } from '@/lib/db';
import { getSession, type SessionPayload } from '@/lib/session';

/**
 * 校验 JWT 中的 token_version 是否与数据库当前值一致。
 *
 * @param userId 用户 ID（JWT sub）
 * @param ver JWT 签发时记录的 token_version
 * @returns true 表示 token 仍有效；false 表示已被撤销（登出/改密后递增）
 */
export async function verifyTokenVersion(userId: string, ver: number | undefined): Promise<boolean> {
  if (ver === undefined) {
    // 兼容旧 JWT（无 ver 字段）：视为已撤销，强制重新登录后获得带 ver 的新 token
    return false;
  }
  const result = await db.query(
    'SELECT token_version FROM users WHERE id = $1',
    [userId],
  );
  if (result.rows.length === 0) {
    // 用户已被删除
    return false;
  }
  return (result.rows[0].token_version as number) === ver;
}

/**
 * 获取已验证的会话（Server Component 用）。
 *
 * 流程：读 Cookie → JWT 验签 → token_version DB 校验。
 * 任一环节失败返回 null（调用方应重定向到 /login）。
 *
 * 与 session.ts getSession 的区别：本函数额外校验 token_version，
 * 登出 / 改密后旧 JWT 即使签名有效也会被拒绝。
 */
export async function getVerifiedSession(): Promise<SessionPayload | null> {
  const session = await getSession();
  if (!session || !session.sub) {
    return null;
  }
  const valid = await verifyTokenVersion(session.sub, session.ver);
  if (!valid) {
    return null;
  }
  return session;
}

/**
 * 递增用户的 token_version，使所有已签发的 JWT 失效（登出 / 改密用）。
 *
 * @param userId 用户 ID
 * @returns 递增后的新 token_version
 */
export async function revokeAllUserSessions(userId: string): Promise<number> {
  const result = await db.query(
    'UPDATE users SET token_version = token_version + 1 WHERE id = $1 RETURNING token_version',
    [userId],
  );
  return result.rows[0].token_version as number;
}
