/**
 * 剪贴板安全管理 Hook (T5.3)
 *
 * 封装 copyToClipboard，提供复制状态、倒计时显示。
 * 复制成功后 toast 提示"已复制，将在 N 秒后自动清除"。
 *
 * @see TASK_BREAKDOWN T5.3 验收标准
 */
'use client';

import { useState, useCallback, useEffect, useRef } from 'react';
import { toast } from 'sonner';
import {
  copyToClipboard,
  clearClipboard,
  getClipboardClearRemaining,
  DEFAULT_CLIPBOARD_CLEAR_SECONDS,
} from '@/lib/security/clipboard';

interface UseClipboardReturn {
  /** 是否正在复制 */
  copying: boolean;
  /** 当前倒计时剩余秒数（null 表示无活跃倒计时） */
  remaining: number | null;
  /**
   * 复制文本到剪贴板
   * @param text 要复制的文本
   * @param clearAfterSeconds 自动清除秒数，默认 30
   * @param label toast 中显示的标签（如 "密码" / "用户名"），默认 "内容"
   */
  copy: (text: string, clearAfterSeconds?: number, label?: string) => Promise<void>;
}

export function useClipboard(): UseClipboardReturn {
  const [copying, setCopying] = useState(false);
  const [remaining, setRemaining] = useState<number | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // 倒计时更新 — 通过 interval 轮询，setState 在回调中调用
  useEffect(() => {
    if (remaining === null) {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
      return;
    }

    if (!intervalRef.current) {
      intervalRef.current = setInterval(() => {
        const r = getClipboardClearRemaining();
        if (r === null || r <= 0) {
          setRemaining(null);
          toast.success('剪贴板已清除');
          if (intervalRef.current) {
            clearInterval(intervalRef.current);
            intervalRef.current = null;
          }
        } else {
          setRemaining(r);
        }
      }, 1000);
    }

    return () => {
      if (intervalRef.current && remaining === null) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, [remaining]);

  const copy = useCallback(
    async (
      text: string,
      clearAfterSeconds: number = DEFAULT_CLIPBOARD_CLEAR_SECONDS,
      label: string = '内容',
    ) => {
      setCopying(true);
      try {
        const success = await copyToClipboard(text, clearAfterSeconds);
        if (success) {
          if (clearAfterSeconds > 0) {
            setRemaining(clearAfterSeconds);
            toast.success(`${label}已复制，将在 ${clearAfterSeconds} 秒后自动清除`);
          } else {
            toast.success(`${label}已复制`);
          }
        } else {
          toast.error('复制失败，请手动复制');
        }
      } catch {
        toast.error('复制失败，请稍后重试');
      } finally {
        setCopying(false);
      }
    },
    [],
  );

  // 组件卸载时清除定时器
  useEffect(() => {
    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, []);

  return { copying, remaining, copy };
}

/**
 * 立即清除剪贴板（可在外部调用）。
 */
export { clearClipboard };
