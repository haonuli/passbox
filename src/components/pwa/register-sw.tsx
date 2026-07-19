/**
 * Service Worker 注册 + 在线状态 Hook
 *
 * 'use client' 组件，在根布局中渲染。
 * 负责注册 SW、监听在线/离线状态变化。
 */
'use client';

import { useEffect, useState, useCallback } from 'react';

/** 在线状态 Hook */
export function useOnlineStatus(): boolean {
  // lazy initializer 避免 effect 内 setState（SSR 安全：服务器上 navigator 不存在时默认 true）
  const [online, setOnline] = useState(() =>
    typeof navigator !== 'undefined' ? navigator.onLine : true,
  );

  useEffect(() => {
    const handleOnline = () => setOnline(true);
    const handleOffline = () => setOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  return online;
}

/** SW 注册组件（不渲染任何 UI） */
export function ServiceWorkerRegister() {
  useEffect(() => {
    if ('serviceWorker' in navigator && process.env.NODE_ENV === 'production') {
      navigator.serviceWorker
        .register('/sw.js')
        .catch((err) => console.error('SW 注册失败:', err));
    }
  }, []);

  return null;
}

/** 离线指示器组件 */
export function OfflineIndicator() {
  const online = useOnlineStatus();
  const [dismissed, setDismissed] = useState(false);

  const handleDismiss = useCallback(() => setDismissed(true), []);

  // 从 online 切换到 offline 时重置 dismissed（render-time setState，替代 effect）
  // 参考：https://react.dev/learn/you-might-not-need-an-effect#adjusting-some-state-when-a-prop-changes
  const [prevOnline, setPrevOnline] = useState(online);
  if (online !== prevOnline) {
    setPrevOnline(online);
    if (!online) setDismissed(false);
  }

  // dev 模式下不显示离线提示，避免 DevTools Offline 调试或扩展干扰造成误报
  if (process.env.NODE_ENV !== 'production') return null;

  if (online || dismissed) return null;

  return (
    <div className="fixed bottom-0 left-0 right-0 z-50 bg-warning px-4 py-2 text-center text-sm font-medium text-warning-foreground">
      <span>当前处于离线模式，部分功能不可用</span>
      <button
        onClick={handleDismiss}
        className="ml-3 text-xs underline"
        aria-label="关闭提示"
      >
        忽略
      </button>
    </div>
  );
}
