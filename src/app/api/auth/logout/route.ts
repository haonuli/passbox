/**
 * 登出 API (T3.3)
 *
 * POST /api/auth/logout
 *
 * 清除会话 Cookie，并递增 token_version 使所有已签发 JWT 失效（M-9 撤销机制）。
 * 客户端应同时清除内存中的密钥（由 auth-store 处理）。
 *
 * @see TECHNICAL_DESIGN.md 5.2.5 + ADR-008（JWT 撤销）
 */
import { NextRequest, NextResponse } from 'next/server';
import { SESSION_COOKIE_NAME, SESSION_COOKIE_OPTIONS, verifySession } from '@/lib/session';
import { revokeAllUserSessions } from '@/lib/auth-check';

export async function POST(request: NextRequest): Promise<NextResponse> {
  // M-9：递增 token_version，使该用户所有已签发 JWT 立即失效
  // 即使攻击者窃取了旧 JWT，登出后也无法再访问受保护资源
  // 从请求 Cookie 读取 JWT 并验签（不依赖 next/headers，便于测试与显式依赖）
  const token = request.cookies.get(SESSION_COOKIE_NAME)?.value;
  const payload = await verifySession(token);
  if (payload?.sub) {
    try {
      await revokeAllUserSessions(payload.sub);
    } catch (err) {
      // 撤销失败不阻断登出流程（Cookie 仍清除），仅记录
      console.error('[logout] 撤销 token_version 失败:', err instanceof Error ? err.message : '未知错误');
    }
  }

  const res = NextResponse.json({ success: true }, { status: 200 });
  // 通过 maxAge=0 使浏览器立即删除 Cookie
  res.cookies.set(SESSION_COOKIE_NAME, '', {
    ...SESSION_COOKIE_OPTIONS,
    maxAge: 0,
  });
  return res;
}
