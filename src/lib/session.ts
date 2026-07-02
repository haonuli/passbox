import { cookies } from 'next/headers';
import { jwtVerify, type JWTPayload } from 'jose';

/**
 * 会话 Cookie 名称。
 *
 * 注意：Cookie 属性（HttpOnly + Secure + SameSite=Lax + 30 天）在 T3.1 注册/登录接口中设置。
 * 此处仅定义名称供中间件与 Server Component 读取。
 */
export const SESSION_COOKIE_NAME = 'passbox_session';

/**
 * JWT 签名密钥（从环境变量读取，运行时为 UTF-8 字符串，jose 需转换为 Uint8Array）。
 */
const JWT_SECRET = new TextEncoder().encode(process.env.JWT_SECRET);

/**
 * 会话 JWT 的 Payload 结构。
 */
export interface SessionPayload extends JWTPayload {
  sub: string; // user_id (UUID)
  email: string;
}

/**
 * 验证 JWT 并返回 Payload。验签失败或过期时返回 null。
 *
 * 用于中间件（Edge Runtime）和 Server Component（Node Runtime）。
 * jose 库兼容 Edge Runtime，无需 Node.js crypto 模块。
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
