import { redirect } from 'next/navigation';

import { getSession } from '@/lib/session';
import { AuthGate } from '@/components/auth-gate';

/**
 * 应用路由组布局（需认证）。
 *
 * Server Component 中验证会话，未登录重定向到 /login。
 * 这是中间件路由守卫的双重保险（defense in depth）。
 *
 * 客户端状态守卫（auth-store status → /unlock）由 AuthGate 处理。
 */
export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const session = await getSession();
  if (!session) {
    redirect('/login');
  }

  return <AuthGate>{children}</AuthGate>;
}
