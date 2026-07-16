/**
 * 应用顶栏 (T4.3 / T4.7)
 *
 * 包含：
 * - 移动端侧边栏切换按钮（hamburger）
 * - 搜索框（T4.7，连接 vault-store.searchQuery，本地搜索不上传服务端）
 *   支持 ⌘K 快捷键聚焦
 * - 手动锁定按钮
 * - 退出登录
 * - 主题切换
 * - 用户邮箱展示
 */
'use client';

import { useCallback, useDeferredValue, useRef, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Menu, Lock, LogOut, Search, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ThemeToggle } from '@/components/theme-toggle';
import { useLock } from '@/hooks/use-lock';
import { useAuthStore } from '@/stores/auth-store';
import { useVaultStore } from '@/stores/vault-store';

interface AppHeaderProps {
  onOpenSidebar: () => void;
}

export function AppHeader({ onOpenSidebar }: AppHeaderProps) {
  const router = useRouter();
  const { lock } = useLock();
  const user = useAuthStore((s) => s.user);
  const searchQuery = useVaultStore((s) => s.searchQuery);
  const setSearchQuery = useVaultStore((s) => s.setSearchQuery);
  const loaded = useVaultStore((s) => s.loaded);
  const searchRef = useRef<HTMLInputElement>(null);

  const deferredQuery = useDeferredValue(searchQuery);

  // ⌘K 快捷键聚焦搜索框
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        searchRef.current?.focus();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  const handleLogout = useCallback(async () => {
    try {
      await fetch('/api/auth/logout', { method: 'POST' });
    } catch {
      // 即使请求失败也清除本地状态并跳转登录
    }
    useAuthStore.getState().logout();
    router.replace('/login');
  }, [router]);

  const handleSearchChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      setSearchQuery(e.target.value);
      if (e.target.value && window.location.pathname !== '/vault') {
        router.push('/vault');
      }
    },
    [setSearchQuery, router],
  );

  const handleClearSearch = useCallback(() => {
    setSearchQuery('');
    searchRef.current?.focus();
  }, [setSearchQuery]);

  return (
    <header className="flex h-14 items-center gap-3 border-b border-border px-4">
      {/* 移动端菜单按钮 */}
      <Button
        size="icon"
        variant="ghost"
        className="md:hidden"
        onClick={onOpenSidebar}
        aria-label="打开菜单"
      >
        <Menu className="h-5 w-5" />
      </Button>

      {/* 搜索框 - 本地搜索，支持 ⌘K 快捷键 */}
      <div className="relative flex-1 max-w-md">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          ref={searchRef}
          type="search"
          placeholder="搜索条目…"
          className="pl-9 pr-16"
          value={deferredQuery}
          onChange={handleSearchChange}
          disabled={!loaded}
        />
        {searchQuery ? (
          <button
            type="button"
            onClick={handleClearSearch}
            className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
            aria-label="清除搜索"
          >
            <X className="h-4 w-4" />
          </button>
        ) : (
          <kbd className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 hidden select-none items-center gap-0.5 rounded border border-border bg-muted px-1.5 py-0.5 font-mono text-[10px] text-muted-foreground sm:flex">
            ⌘K
          </kbd>
        )}
      </div>

      <div className="ml-auto flex items-center gap-2">
        {user && (
          <span className="hidden text-xs text-muted-foreground sm:inline">{user.email}</span>
        )}
        <Button size="sm" variant="ghost" onClick={lock} aria-label="锁定密码库">
          <Lock className="h-4 w-4" />
          <span className="ml-1.5 hidden sm:inline">锁定</span>
        </Button>
        <Button size="sm" variant="ghost" onClick={handleLogout} aria-label="退出登录">
          <LogOut className="h-4 w-4" />
          <span className="ml-1.5 hidden sm:inline">退出</span>
        </Button>
        <ThemeToggle />
      </div>
    </header>
  );
}
