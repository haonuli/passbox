import { redirect } from 'next/navigation';

import { getVerifiedSession } from '@/lib/auth-check';
import { AuthGate } from '@/components/auth-gate';

/**
 * 应用路由组布局（需认证）。
 *
 * Server Component 中验证会话，未登录重定向到 /login。
 * 这是中间件路由守卫的双重保险（defense in depth）。
 *
 * M-9：使用 getVerifiedSession 校验 token_version，登出 / 改密后
 * 旧 JWT 即使签名有效也会被拒绝，重定向到 /login 强制重新登录。
 *
 * 防重定向循环：当 JWT 签名有效但 DB 校验失败（如用户已删除、token_version 不匹配），
 * 中间件认为已认证 → 允许访问 (app) 路由；但本 layout 检测到会话无效 → 重定向 /login；
 * 中间件又认为已认证 → 重定向 /vault → 死循环。
 * 修复：重定向时携带 ?session=invalid 参数，中间件检测到该参数时
 * 清除无效 cookie 并放行到 /login，而非再次重定向到 /vault。
 * （Server Component 中无法修改 cookie，只能依赖中间件处理）
 *
 * 客户端状态守卫（auth-store status → /unlock）由 AuthGate 处理。
 */
export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const session = await getVerifiedSession();
  if (!session) {
    // 携带 session=invalid 参数，通知中间件清除无效 cookie（防止重定向循环）
    redirect('/login?session=invalid');
  }

  return <AuthGate>{children}</AuthGate>;
}
