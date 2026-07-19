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
  // ⚠️ 初始值必须与 SSR 渲染保持一致（true），避免 hydration mismatch
  // 否则 React 会因客户端初始 state 与 SSR 不一致而放弃 hydrate 该子树，
  // 导致后续 setState 无法反映到 DOM（"幽灵 DOM 节点"问题）。
  // 真实在线状态由下方 useEffect 主动同步。
  const [online, setOnline] = useState(true);

  useEffect(() => {
    // mount 后立即同步真实在线状态
    setOnline(navigator.onLine);

    const handleOnline = () => setOnline(true);
    const handleOffline = () => setOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    // 兜底：定期同步（每 5s）防止某些环境下事件丢失
    const interval = window.setInterval(() => {
      setOnline(navigator.onLine);
    }, 5000);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      window.clearInterval(interval);
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
