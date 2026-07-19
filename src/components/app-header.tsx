/**
 * 应用顶栏 (T4.3 / T4.7 / UX-001)
 *
 * 包含：
 * - 移动端侧边栏切换按钮（hamburger）
 * - 搜索框（T4.7，连接 vault-store.searchQuery，本地搜索不上传服务端）
 *   支持 ⌘K 快捷键聚焦
 * - 手动锁定按钮
 * - 退出登录
 * - 主题切换
 * - 用户邮箱展示
 * - 全局快捷键（UX-001）：⌘K 搜索 / ⌘N 新建 / ⌘L 锁定 / ⌘/ 速查表
 */
'use client';

import { useCallback, useEffect, useDeferredValue, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Menu, Lock, LogOut, Search, X, BookmarkPlus } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { ThemeToggle } from '@/components/theme-toggle';
import { useLock } from '@/hooks/use-lock';
import { useHotkey } from '@/hooks/use-hotkey';
import { KeyboardShortcutsDialog } from '@/components/keyboard-shortcuts-dialog';
import { useAuthStore } from '@/stores/auth-store';
import { useVaultStore } from '@/stores/vault-store';
import { useSavedSearchStore } from '@/stores/saved-search-store';

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
  const addSearch = useSavedSearchStore((s) => s.addSearch);
  const searchRef = useRef<HTMLInputElement>(null);
  const searchDebounceRef = useRef<number | null>(null);
  const [saveDialogOpen, setSaveDialogOpen] = useState(false);
  const [searchName, setSearchName] = useState('');
  const [shortcutsOpen, setShortcutsOpen] = useState(false);
  // UX-046：本地输入值，立即响应；store 更新防抖
  const [inputValue, setInputValue] = useState(searchQuery);

  const deferredQuery = useDeferredValue(searchQuery);

  // 外部清空搜索时同步本地输入框（render-time setState，替代 effect）
  // 参考：https://react.dev/learn/you-might-not-need-an-effect#adjusting-some-state-when-a-prop-changes
  const [prevSearchQuery, setPrevSearchQuery] = useState(searchQuery);
  if (searchQuery !== prevSearchQuery) {
    setPrevSearchQuery(searchQuery);
    if (searchQuery !== inputValue) {
      setInputValue(searchQuery);
    }
  }

  // UX-046：组件卸载时清理防抖定时器
  useEffect(() => {
    return () => {
      if (searchDebounceRef.current !== null) {
        window.clearTimeout(searchDebounceRef.current);
      }
    };
  }, []);

  // UX-001：全局快捷键
  const focusSearch = useCallback(() => {
    searchRef.current?.focus();
  }, []);

  const handleNew = useCallback(() => {
    if (window.location.pathname !== '/vault') {
      router.push('/vault');
    }
    router.push('/items/new');
  }, [router]);

  const handleLock = useCallback(() => {
    lock();
  }, [lock]);

  const openShortcuts = useCallback(() => {
    setShortcutsOpen(true);
  }, []);

  useHotkey('mod+k', focusSearch);
  useHotkey('mod+n', handleNew);
  useHotkey('mod+l', handleLock);
  useHotkey('mod+/', openShortcuts);

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
      const value = e.target.value;
      // UX-046：本地输入立即响应，store 更新防抖 200ms
      setInputValue(value);
      if (searchDebounceRef.current !== null) {
        window.clearTimeout(searchDebounceRef.current);
      }
      searchDebounceRef.current = window.setTimeout(() => {
        setSearchQuery(value);
      }, 200);
      if (value && window.location.pathname !== '/vault') {
        router.push('/vault');
        // UX-025：跳转后重新聚焦搜索框，避免焦点丢失
        requestAnimationFrame(() => {
          const el = searchRef.current;
          if (el) {
            el.focus();
            // 将光标移到末尾
            const len = el.value.length;
            el.setSelectionRange(len, len);
          }
        });
      }
    },
    [setSearchQuery, router],
  );

  const handleClearSearch = useCallback(() => {
    setSearchQuery('');
    setInputValue('');
    if (searchDebounceRef.current !== null) {
      window.clearTimeout(searchDebounceRef.current);
      searchDebounceRef.current = null;
    }
    searchRef.current?.focus();
  }, [setSearchQuery]);

  const handleOpenSaveDialog = useCallback(() => {
    setSearchName(deferredQuery);
    setSaveDialogOpen(true);
  }, [deferredQuery]);

  const handleSaveSearch = useCallback(() => {
    const name = searchName.trim();
    if (!name || !deferredQuery.trim()) return;
    addSearch(name, deferredQuery.trim());
    setSaveDialogOpen(false);
    setSearchName('');
    toast.success('已保存为智能文件夹');
  }, [searchName, deferredQuery, addSearch]);

  return (
    <header className="flex h-16 items-center gap-3 border-b border-border bg-background/80 px-4 backdrop-blur-md">
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
          value={inputValue}
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
          <kbd className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 hidden select-none items-center gap-0.5 rounded-xs border border-border bg-secondary px-1.5 py-0.5 font-mono text-[10px] text-muted-foreground sm:flex">
            ⌘K
          </kbd>
        )}
      </div>

      {/* 保存搜索为智能文件夹 */}
      {deferredQuery && (
        <Button
          size="sm"
          variant="ghost"
          onClick={handleOpenSaveDialog}
          aria-label="保存搜索"
          className="shrink-0"
        >
          <BookmarkPlus className="h-4 w-4" />
          <span className="ml-1.5 hidden sm:inline">保存搜索</span>
        </Button>
      )}

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

      {/* 保存搜索弹窗 */}
      <Dialog open={saveDialogOpen} onOpenChange={setSaveDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>保存为智能文件夹</DialogTitle>
            <DialogDescription>
              为当前搜索「{deferredQuery}」命名，保存后可在侧边栏快速访问。
            </DialogDescription>
          </DialogHeader>
          <Input
            value={searchName}
            onChange={(e) => setSearchName(e.target.value)}
            placeholder="输入名称"
            onKeyDown={(e) => {
              if (e.key === 'Enter') handleSaveSearch();
            }}
            autoFocus
          />
          <DialogFooter>
            <Button variant="outline" onClick={() => setSaveDialogOpen(false)}>
              取消
            </Button>
            <Button onClick={handleSaveSearch} disabled={!searchName.trim()}>
              保存
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 键盘快捷键速查表（UX-001） */}
      <KeyboardShortcutsDialog open={shortcutsOpen} onOpenChange={setShortcutsOpen} />
    </header>
  );
}
