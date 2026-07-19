/**
 * 带反馈的复制按钮
 *
 * 复制后按钮图标变 Check（2s 后恢复），密码等敏感字段复制时
 * 显示倒计时（N 秒后自动清空剪贴板）。
 */
'use client';

import { useState, useCallback, useRef } from 'react';
import { Copy, Check } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useClipboard } from '@/hooks/use-clipboard';

interface CopyButtonProps {
  /** 要复制的文本 */
  value: string;
  /** 字段标签，用于 toast 提示（如 "密码" / "用户名"） */
  label: string;
  /** 是否为敏感字段（密码等），敏感字段复制后自动清空剪贴板并显示倒计时 */
  sensitive?: boolean;
  /** 自动清空秒数（仅 sensitive=true 时生效），不传则使用 settings 中的值 */
  clearAfterSeconds?: number;
  /** 按钮尺寸类名 */
  className?: string;
  /** 是否显示"已复制"文字（默认显示） */
  showLabel?: boolean;
  /** 禁用 */
  disabled?: boolean;
}

export function CopyButton({
  value,
  label,
  sensitive = false,
  clearAfterSeconds,
  className,
  showLabel = true,
  disabled,
}: CopyButtonProps) {
  const { copy, remaining } = useClipboard();
  const [copied, setCopied] = useState(false);
  const resetTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleClick = useCallback(() => {
    if (disabled) return;
    // 敏感字段：复制后 N 秒自动清空；非敏感字段：clearAfterSeconds=0 不自动清空
    const seconds = sensitive ? (clearAfterSeconds ?? 30) : 0;
    copy(value, seconds, label);

    // 按钮反馈：2s 内显示"已复制"
    setCopied(true);
    if (resetTimerRef.current) {
      clearTimeout(resetTimerRef.current);
    }
    resetTimerRef.current = setTimeout(() => {
      setCopied(false);
      resetTimerRef.current = null;
    }, 2000);
  }, [disabled, sensitive, clearAfterSeconds, value, label, copy]);

  // 敏感字段复制中且倒计时活跃时，按钮持续显示倒计时（不重置为 Copy）
  const showCountdown = sensitive && copied && remaining !== null && remaining > 0;

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={disabled}
      className={cn(
        'inline-flex items-center gap-1 rounded-xs px-1.5 py-0.5 text-xs transition-colors',
        copied
          ? 'text-success'
          : 'text-muted-foreground hover:text-foreground',
        disabled && 'cursor-not-allowed opacity-50',
        className,
      )}
      aria-label={`复制${label}`}
    >
      {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
      {showLabel && (
        <span>
          {showCountdown
            ? `${remaining}s`
            : copied
              ? '已复制'
              : '复制'}
        </span>
      )}
    </button>
  );
}
