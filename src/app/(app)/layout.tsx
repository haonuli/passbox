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
 * 客户端状态守卫（auth-store status → /unlock）由 AuthGate 处理。
 */
export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const session = await getVerifiedSession();
  if (!session) {
    redirect('/login');
  }

  return <AuthGate>{children}</AuthGate>;
}
