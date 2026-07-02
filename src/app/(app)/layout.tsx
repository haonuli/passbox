import { redirect } from 'next/navigation';

import { getSession } from '@/lib/session';
import { ThemeToggle } from '@/components/theme-toggle';
import { Button } from '@/components/ui/button';

/**
 * 应用路由组布局（需认证）。
 *
 * Server Component 中验证会话，未登录重定向到 /login。
 * 这是中间件路由守卫的双重保险（defense in depth）。
 *
 * TODO(T3.x): 加入侧边栏 + 顶栏 + 锁定守卫
 */
export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const session = await getSession();
  if (!session) {
    redirect('/login');
  }

  return (
    <div className="flex flex-1 flex-col bg-background">
      <header className="flex items-center justify-between border-b border-border px-6 py-3">
        <span className="text-sm font-medium text-foreground">passbox</span>
        <div className="flex items-center gap-2">
          <Button asChild size="sm" variant="ghost">
            <a href="/api/auth/logout">退出登录</a>
          </Button>
          <ThemeToggle />
        </div>
      </header>
      <div className="flex flex-1">{children}</div>
    </div>
  );
}
