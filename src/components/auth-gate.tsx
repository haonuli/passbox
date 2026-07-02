/**
 * 应用路由组客户端守卫 (T3.7)
 *
 * 配合 (app)/layout.tsx 的 Server Component 会话校验，处理客户端 auth-store 状态：
 *
 * - status === 'unlocked'：渲染 AppHeader + 子内容（正常使用密码库）
 * - status === 'locked'：会话有效但密钥已清除 → 跳转 /unlock
 * - status === 'authenticated'：会话有效但密钥未加载（如 setAuthenticated 后）→ 跳转 /unlock
 * - status === 'unauthenticated'：页面刷新后 store 重置，需调用 GET /api/auth/session
 *   判断会话是否有效：
 *     - 200 → setAuthenticated → 跳转 /unlock
 *     - 401 → 跳转 /login（中间件已拦截，此处为双保险）
 *
 * /unlock 页面本身不经过守卫（直接渲染），避免循环跳转。
 *
 * @see TECHNICAL_DESIGN.md 6.2.2 状态机 + 7.3 解锁数据流
 */
'use client';

import { useEffect, useRef } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { Loader2 } from 'lucide-react';
import { useAuthStore } from '@/stores/auth-store';
import { AppHeader } from '@/components/app-header';
import type { SessionResponse } from '@/types/api';

export function AuthGate({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const status = useAuthStore((s) => s.status);
  const checkedRef = useRef(false);

  // 解锁页不经过守卫
  const isUnlockPage = pathname === '/unlock';

  // unauthenticated 时一次性校验会话
  useEffect(() => {
    if (status !== 'unauthenticated' || checkedRef.current || isUnlockPage) {
      return;
    }
    checkedRef.current = true;

    (async () => {
      try {
        const res = await fetch('/api/auth/session', { method: 'GET' });
        if (res.ok) {
          const data: SessionResponse = await res.json();
          useAuthStore
            .getState()
            .setAuthenticated(data.user, data.encryptedKey, data.kdfSalt, data.kdfParams);
          // setAuthenticated → status='authenticated' → 下面的 effect 跳转 /unlock
        } else {
          router.replace('/login');
        }
      } catch {
        router.replace('/login');
      }
    })();
  }, [status, isUnlockPage, router]);

  // authenticated / locked → 跳转解锁页
  useEffect(() => {
    if (isUnlockPage) return;
    if (status === 'authenticated' || status === 'locked') {
      router.replace('/unlock');
    }
  }, [status, isUnlockPage, router]);

  // 解锁页直接渲染（不加顶栏，避免用户在解锁页操作锁定/退出造成混乱）
  if (isUnlockPage) {
    return <>{children}</>;
  }

  // 已解锁：渲染顶栏 + 内容
  if (status === 'unlocked') {
    return (
      <div className="flex flex-1 flex-col bg-background">
        <AppHeader />
        <div className="flex flex-1">{children}</div>
      </div>
    );
  }

  // 会话校验中 / 需跳转解锁页 → 展示加载占位，避免闪烁受保护内容
  return (
    <div className="flex flex-1 items-center justify-center">
      <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
    </div>
  );
}
