/**
 * TOTP 展示组件 (T5.4)
 *
 * 显示 6 位验证码 + 30 秒倒计时进度条。
 * 点击验证码可一键复制（复用 T5.3 剪贴板管理）。
 *
 * @see TASK_BREAKDOWN T5.4 验收标准
 */
'use client';

import { Copy } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useTOTP } from '@/hooks/use-totp';
import { useClipboard } from '@/hooks/use-clipboard';

interface TotpDisplayProps {
  /** base32 编码的 TOTP 密钥 */
  base32Secret: string;
}

export function TotpDisplay({ base32Secret }: TotpDisplayProps) {
  const { code, remaining, period } = useTOTP(base32Secret);
  const { copy } = useClipboard();

  if (!code) return null;

  // 倒计时进度：remaining/period 为剩余比例
  const progressPercent = (remaining / period) * 100;
  const isLow = remaining <= 5;

  return (
    <div className="flex items-center gap-3 rounded-md border border-border p-3">
      <div className="flex-1">
        <div className="text-xs text-muted-foreground">一次性验证码</div>
        <button
          onClick={() => copy(code, 10, '验证码')}
          className="mt-0.5 flex items-center gap-1.5 text-2xl font-bold tracking-widest tabular-nums hover:text-primary"
        >
          {code.slice(0, 3)} {code.slice(3)}
          <Copy className="h-3.5 w-3.5 text-muted-foreground" />
        </button>
      </div>
      <div className="relative h-10 w-10 shrink-0">
        <svg className="h-10 w-10 -rotate-90" viewBox="0 0 36 36">
          <circle
            cx="18" cy="18" r="16"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.5"
            className="text-muted"
          />
          <circle
            cx="18" cy="18" r="16"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.5"
            strokeDasharray={`${2 * Math.PI * 16}`}
            strokeDashoffset={`${2 * Math.PI * 16 * (1 - progressPercent / 100)}`}
            className={cn('transition-all duration-1000 ease-linear', isLow ? 'text-red-500' : 'text-primary')}
            strokeLinecap="round"
          />
        </svg>
        <span className={cn(
          'absolute inset-0 flex items-center justify-center text-xs font-medium tabular-nums',
          isLow ? 'text-red-500' : 'text-muted-foreground',
        )}>
          {remaining}
        </span>
      </div>
    </div>
  );
}
