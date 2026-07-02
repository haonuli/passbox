/**
 * 自动锁定 Hook (T3.7)
 *
 * 提供两种锁定触发方式与手动锁定入口：
 *
 * 1. 闲置超时（idle timeout）：
 *    - 监听 mousemove / keydown / touchstart / scroll（节流）重置计时器
 *    - 连续 lockTimeoutMinutes 无操作 → 自动锁定
 *
 * 2. 失焦超时（visibility timeout）：
 *    - visibilitychange 事件，标签页切到后台（document.hidden）后超时 → 自动锁定
 *    - 切回前台时清除失焦计时器并重置闲置计时器
 *
 * 3. 手动锁定：
 *    - lock() → auth-store.lock()（零填充清除密钥）+ 跳转 /unlock?redirect=<当前路径>
 *
 * 锁定时长从 settings-store 读取（持久化到 localStorage）；
 * lockTimeoutMinutes === 0（永不）时禁用闲置与失焦超时。
 *
 * 仅在 auth-store.status === 'unlocked' 时启用计时器，其他状态清理所有定时器。
 *
 * @see TECHNICAL_DESIGN.md 6.3 自动锁定 + ADR-007
 */
'use client';

import { useEffect, useRef, useCallback } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { useAuthStore } from '@/stores/auth-store';
import { useSettingsStore } from '@/stores/settings-store';

/** 闲置事件重置节流间隔（ms），避免高频 mousemove 频繁重置 */
const ACTIVITY_THROTTLE_MS = 10_000;

export function useLock(): { lock: () => void } {
  const router = useRouter();
  const pathname = usePathname();
  const status = useAuthStore((s) => s.status);
  const lockTimeoutMinutes = useSettingsStore((s) => s.lockTimeoutMinutes);

  const idleTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const visibilityTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastActivityRef = useRef<number>(0);

  /** 清理所有定时器 */
  const clearTimers = useCallback(() => {
    if (idleTimerRef.current !== null) {
      clearTimeout(idleTimerRef.current);
      idleTimerRef.current = null;
    }
    if (visibilityTimerRef.current !== null) {
      clearTimeout(visibilityTimerRef.current);
      visibilityTimerRef.current = null;
    }
  }, []);

  /** 执行锁定：清除密钥 + 跳转解锁页（携带 redirect 恢复路径） */
  const lock = useCallback(() => {
    clearTimers();
    useAuthStore.getState().lock();
    const redirect = pathname && pathname !== '/unlock' ? pathname : '/vault';
    router.replace(`/unlock?redirect=${encodeURIComponent(redirect)}`);
  }, [clearTimers, router, pathname]);

  /** 重置闲置计时器（带节流，避免高频事件频繁重建定时器） */
  const resetIdleTimer = useCallback(() => {
    if (lockTimeoutMinutes === 0) return; // 永不锁定
    const now = Date.now();
    if (now - lastActivityRef.current < ACTIVITY_THROTTLE_MS) return;
    lastActivityRef.current = now;

    if (idleTimerRef.current !== null) {
      clearTimeout(idleTimerRef.current);
    }
    idleTimerRef.current = setTimeout(() => {
      lock();
    }, lockTimeoutMinutes * 60 * 1000);
  }, [lockTimeoutMinutes, lock]);

  useEffect(() => {
    // 仅在已解锁状态启用自动锁定
    if (status !== 'unlocked' || lockTimeoutMinutes === 0) {
      clearTimers();
      return;
    }

    // 初始启动闲置计时器
    resetIdleTimer();

    // 闲置活动监听
    const activityEvents: Array<keyof DocumentEventMap> = [
      'mousemove',
      'keydown',
      'touchstart',
      'scroll',
    ];
    activityEvents.forEach((evt) => document.addEventListener(evt, resetIdleTimer, { passive: true }));

    // 失焦超时监听
    const handleVisibility = () => {
      if (document.hidden) {
        // 切到后台：启动失焦计时器
        if (visibilityTimerRef.current !== null) {
          clearTimeout(visibilityTimerRef.current);
        }
        visibilityTimerRef.current = setTimeout(() => {
          lock();
        }, lockTimeoutMinutes * 60 * 1000);
      } else {
        // 切回前台：清除失焦计时器 + 重置闲置计时器
        if (visibilityTimerRef.current !== null) {
          clearTimeout(visibilityTimerRef.current);
          visibilityTimerRef.current = null;
        }
        lastActivityRef.current = 0; // 强制重置节流，立即重建闲置计时器
        resetIdleTimer();
      }
    };
    document.addEventListener('visibilitychange', handleVisibility);

    return () => {
      activityEvents.forEach((evt) =>
        document.removeEventListener(evt, resetIdleTimer),
      );
      document.removeEventListener('visibilitychange', handleVisibility);
      clearTimers();
    };
  }, [status, lockTimeoutMinutes, resetIdleTimer, clearTimers, lock]);

  return { lock };
}
