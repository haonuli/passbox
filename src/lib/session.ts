/**
 * 会话管理模块 (T3.1)
 *
 * 使用 jose 库实现 JWT 会话：签发（createSession）、验签（verifySession）、
 * Cookie 设置（setSessionCookie）与清除（clearSessionCookie）。
 *
 * JWT Payload：{ sub: user_id, email, iat, exp }
 * Cookie 属性：HttpOnly + Secure + SameSite=Lax + 24 小时过期 + Path=/
 *
 * 设计要点：
 * - jose 兼容 Edge Runtime（中间件可用），无需 Node.js crypto
 * - JWT_SECRET 从环境变量读取，运行时为 UTF-8 字符串，jose 需转换为 Uint8Array
 * - 会话 Cookie 仅存 JWT 字符串，不存任何加密密钥或明文数据
 * - M-4 修复：会话有效期从 30 天缩短为 24 小时，降低被窃取后的暴露窗口。
 *   滑动续期评估：暂不在 middleware 自动刷新，避免 Edge Runtime 频繁写 cookie 的开销。
 *   后续如需延长活跃会话寿命，可在活跃 Server Action 中调用 refreshSessionIfNeeded()。
 *
 * 对应 TECHNICAL_DESIGN.md 3.4 节（简化零知识认证方案）+ ADR-008（JWT 会话）。
 */
import { cookies } from 'next/headers';
import { SignJWT, jwtVerify, type JWTPayload } from 'jose';

/** 会话 Cookie 名称 */
export const SESSION_COOKIE_NAME = 'passbox_session';

/** 会话最大存活时间（秒）：24 小时（M-4 修复，从 30 天缩短） */
export const SESSION_MAX_AGE_SECONDS = 24 * 60 * 60;

/**
 * 会话 Cookie 属性。
 * - httpOnly: true  — 防止 JS 读取（防 XSS 窃取）
 * - secure: true    — 仅 HTTPS 传输
 * - sameSite: 'lax' — 防 CSRF（允许顶层导航携带）
 * - path: '/'       — 全站有效
 * - maxAge: 24 小时 — 浏览器持久化（非会话级）
 *
 * L3 评估结论：保留 SameSite=Lax。
 * - Strict 会拒绝跨站顶级导航携带 Cookie（如从邮件客户端点击 passbox 链接登录后跳转），
 *   用户体验下降；当前应用所有写操作通过 Server Action（同源 POST）完成，不存在 CSRF 面。
 * - Lax 在防 CSRF 与可用性之间取得平衡：跨站子资源（iframe/img/fetch）不携带 Cookie，
 *   顶级 GET 导航携带 Cookie，足以支持正常的外部跳转场景。
 * - 后续如需更严格隔离，可在确认无跨站跳转需求后升级为 Strict。
 */
export const SESSION_COOKIE_OPTIONS = {
  httpOnly: true,
  secure: true,
  sameSite: 'lax' as const,
  path: '/',
  maxAge: SESSION_MAX_AGE_SECONDS,
};

/**
 * JWT 签名密钥（从环境变量读取，jose 需 Uint8Array）。
 * ⚠️ 生产环境必须设置强随机值（≥32 字节）。
 *
 * M-12 修复：模块加载时校验 JWT_SECRET 存在且足够长。
 * 缺失或过短时立即抛出（fail-fast），避免使用空密钥签发可伪造的 JWT。
 */
const JWT_SECRET_RAW = process.env.JWT_SECRET;
if (!JWT_SECRET_RAW || JWT_SECRET_RAW.length < 32) {
  throw new Error(
    '环境变量 JWT_SECRET 缺失或长度不足 32 字符，请设置强随机密钥（如 `openssl rand -base64 32`）',
  );
}
const JWT_SECRET = new TextEncoder().encode(JWT_SECRET_RAW);

/**
 * 会话 JWT 的 Payload 结构。
 *
 * M-9 修复：新增 `ver`（token_version）字段，用于服务端撤销。
 * 登出 / 改密时递增 users.token_version，旧 JWT 的 ver 与 DB 不匹配即失效。
 */
export interface SessionPayload extends JWTPayload {
  sub: string; // user_id (UUID)
  email: string;
  ver?: number; // 签发时的 token_version（M-9 撤销机制）
}

/**
 * 签发 JWT 会话令牌。
 *
 * @param userId 用户 ID（UUID，存入 sub）
 * @param email 用户邮箱（用于前端展示，不用于鉴权决策）
 * @param ver 签发时的 token_version（M-9 撤销机制，登出/改密递增使旧 token 失效）
 * @returns 签名的 JWT 字符串（HS256，24 小时过期）
 */
export async function createSession(userId: string, email: string, ver: number): Promise<string> {
  return new SignJWT({ email, ver })
    .setProtectedHeader({ alg: 'HS256' })
    .setSubject(userId)
    .setIssuedAt()
    .setExpirationTime(`${SESSION_MAX_AGE_SECONDS}s`)
    .sign(JWT_SECRET);
}

/**
 * 验证 JWT 并返回 Payload。验签失败或过期时返回 null。
 *
 * 用于中间件（Edge Runtime）和 Server Component（Node Runtime）。
 */
export async function verifySession(token: string | undefined): Promise<SessionPayload | null> {
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, JWT_SECRET);
    return payload as SessionPayload;
  } catch {
    return null;
  }
}

/**
 * 在 Server Component / Server Action 中获取当前会话。
 *
 * 返回 null 表示未登录或会话已过期。
 */
export async function getSession(): Promise<SessionPayload | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE_NAME)?.value;
  return verifySession(token);
}

/**
 * 设置会话 Cookie（Server Component / Server Action 用）。
 *
 * Route Handler 请使用 response.cookies.set(SESSION_COOKIE_NAME, token, SESSION_COOKIE_OPTIONS)。
 *
 * @param token createSession 返回的 JWT 字符串
 */
export async function setSessionCookie(token: string): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.set(SESSION_COOKIE_NAME, token, SESSION_COOKIE_OPTIONS);
}

/**
 * 清除会话 Cookie（登出用）。
 *
 * 通过设置 maxAge=0 使浏览器立即删除 Cookie。
 * 保留 httpOnly/secure/sameSite 属性确保清除过程安全。
 */
export async function clearSessionCookie(): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.set(SESSION_COOKIE_NAME, '', {
    ...SESSION_COOKIE_OPTIONS,
    maxAge: 0,
  });
}
