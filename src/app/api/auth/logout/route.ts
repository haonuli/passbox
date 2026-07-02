/**
 * 登出 API (T3.3)
 *
 * POST /api/auth/logout
 *
 * 清除会话 Cookie，返回 200。客户端应同时清除内存中的密钥（由 auth-store 处理）。
 *
 * @see TECHNICAL_DESIGN.md 5.2.5
 */
import { NextRequest, NextResponse } from 'next/server';
import { SESSION_COOKIE_NAME, SESSION_COOKIE_OPTIONS } from '@/lib/session';

export async function POST(_request: NextRequest): Promise<NextResponse> {
  const res = NextResponse.json({ success: true }, { status: 200 });
  // 通过 maxAge=0 使浏览器立即删除 Cookie
  res.cookies.set(SESSION_COOKIE_NAME, '', {
    ...SESSION_COOKIE_OPTIONS,
    maxAge: 0,
  });
  return res;
}
