/**
 * 密码强度指示器 — 简化版 (T3.5)
 *
 * 基于长度 + 字符多样性评估，显示弱/中/强三档。
 * 完整版（zxcvbn-ts）在 T5.2 实现。
 */
'use client';

import { useMemo } from 'react';
import { cn } from '@/lib/utils';

export type PasswordStrength = 'weak' | 'medium' | 'strong';

/** 评估密码强度（简化版：长度 + 字符多样性） */
export function evaluateStrength(password: string): PasswordStrength {
  if (password.length === 0) return 'weak';

  let score = 0;
  if (password.length >= 12) score++;
  if (password.length >= 16) score++;
  if (/[a-z]/.test(password) && /[A-Z]/.test(password)) score++;
  if (/\d/.test(password)) score++;
  if (/[^a-zA-Z0-9]/.test(password)) score++;

  if (score <= 2) return 'weak';
  if (score <= 3) return 'medium';
  return 'strong';
}

const STRENGTH_CONFIG: Record<
  PasswordStrength,
  { label: string; barClass: string; textClass: string; segments: number }
> = {
  weak: {
    label: '弱',
    barClass: 'bg-red-500',
    textClass: 'text-red-500',
    segments: 1,
  },
  medium: {
    label: '中',
    barClass: 'bg-yellow-500',
    textClass: 'text-yellow-500',
    segments: 2,
  },
  strong: {
    label: '强',
    barClass: 'bg-green-500',
    textClass: 'text-green-500',
    segments: 3,
  },
};

interface StrengthIndicatorProps {
  password: string;
}

export function StrengthIndicator({ password }: StrengthIndicatorProps) {
  const strength = useMemo(() => evaluateStrength(password), [password]);
  const config = STRENGTH_CONFIG[strength];

  // 空密码时不显示
  if (password.length === 0) return null;

  return (
    <div className="space-y-1.5">
      <div className="flex items-center gap-2">
        <div className="flex h-1.5 flex-1 gap-1">
          {[0, 1, 2].map((i) => (
            <div
              key={i}
              className={cn(
                'h-full flex-1 rounded-full transition-colors',
                i < config.segments ? config.barClass : 'bg-muted',
              )}
            />
          ))}
        </div>
        <span className={cn('text-xs font-medium', config.textClass)}>{config.label}</span>
      </div>
      <p className="text-xs text-muted-foreground">
        建议使用 16 位以上密码，包含大小写字母、数字和符号
      </p>
    </div>
  );
}
