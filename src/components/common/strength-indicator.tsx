/**
 * 通用密码强度指示器 (T5.2)
 *
 * 基于 zxcvbn-ts 评估，显示 0-4 分对应的红/黄/绿进度条 + 文字标签 + 改进建议。
 * 可复用于注册页、生成器、条目编辑表单。
 *
 * @see TASK_BREAKDOWN T5.2 验收标准
 */
'use client';

import { useMemo } from 'react';
import { cn } from '@/lib/utils';
import { assessPassword, type StrengthLabel } from '@/lib/crypto/strength';

const LABEL_CONFIG: Record<StrengthLabel, { text: string; barClass: string; textClass: string; segments: number }> = {
  weak: { text: '弱', barClass: 'bg-red-500', textClass: 'text-red-500', segments: 1 },
  fair: { text: '中', barClass: 'bg-yellow-500', textClass: 'text-yellow-500', segments: 2 },
  strong: { text: '强', barClass: 'bg-green-500', textClass: 'text-green-500', segments: 3 },
};

interface StrengthIndicatorProps {
  password: string;
  /** 是否显示改进建议，默认 true */
  showSuggestions?: boolean;
}

export function StrengthIndicator({ password, showSuggestions = true }: StrengthIndicatorProps) {
  const result = useMemo(() => assessPassword(password), [password]);

  if (password.length === 0) return null;

  const config = LABEL_CONFIG[result.label];

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
        <span className={cn('text-xs font-medium', config.textClass)}>{config.text}</span>
      </div>
      {showSuggestions && result.suggestions.length > 0 && (
        <ul className="space-y-0.5">
          {result.suggestions.map((s, i) => (
            <li key={i} className="text-xs text-muted-foreground">• {s}</li>
          ))}
        </ul>
      )}
    </div>
  );
}
