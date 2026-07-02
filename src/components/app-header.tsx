/**
 * 应用顶栏 (T3.7)
 *
 * 客户端组件，包含：
 * - 手动锁定按钮（useLock().lock，触发 auth-store.lock + 跳转 /unlock）
 * - 自动锁定计时器（useLock 内部启用，仅在 unlocked 状态生效）
 * - 退出登录（POST /api/auth/logout + 清除 store + 跳转 /login）
 * - 主题切换
 *
 * 仅在 AuthGate 判定 status === 'unlocked' 时渲染。
 */
'use client';

import { useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { Lock, LogOut } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ThemeToggle } from '@/components/theme-toggle';
import { useLock } from '@/hooks/use-lock';
import { useAuthStore } from '@/stores/auth-store';

export function AppHeader() {
  const router = useRouter();
  const { lock } = useLock();
  const user = useAuthStore((s) => s.user);

  const handleLogout = useCallback(async () => {
    try {
      await fetch('/api/auth/logout', { method: 'POST' });
    } catch {
      // 即使请求失败也清除本地状态并跳转登录
    }
    useAuthStore.getState().logout();
    router.replace('/login');
  }, [router]);

  return (
    <header className="flex items-center justify-between border-b border-border px-6 py-3">
      <div className="flex items-center gap-2">
        <span className="text-sm font-medium text-foreground">passbox</span>
        {user && (
          <span className="text-xs text-muted-foreground">{user.email}</span>
        )}
      </div>
      <div className="flex items-center gap-2">
        <Button size="sm" variant="ghost" onClick={lock} aria-label="锁定密码库">
          <Lock className="mr-1.5 h-4 w-4" />
          锁定
        </Button>
        <Button size="sm" variant="ghost" onClick={handleLogout} aria-label="退出登录">
          <LogOut className="mr-1.5 h-4 w-4" />
          退出
        </Button>
        <ThemeToggle />
      </div>
    </header>
  );
}
