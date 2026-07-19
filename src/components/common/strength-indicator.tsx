/**
 * 通用密码强度指示器 (T5.2)
 *
 * 基于 zxcvbn-ts 评估，显示 0-4 分对应的红/黄/绿进度条 + 文字标签 + 改进建议。
 * 可复用于注册页、生成器、条目编辑表单。
 *
 * assessPassword 为异步函数（zxcvbn-ts 懒加载，避免 SSR 时 node:fs 崩溃），
 * 因此使用 useState + useEffect 代替 useMemo。
 *
 * @see TASK_BREAKDOWN T5.2 验收标准
 */
'use client';

import { useState, useEffect } from 'react';
import { cn } from '@/lib/utils';
import { assessPassword, type StrengthLabel } from '@/lib/crypto/strength';

// DESIGN.md 语义色：weak=error #ee0000 / fair=warning #f5a623 / strong=success #0070f3
const LABEL_CONFIG: Record<StrengthLabel, { text: string; barClass: string; textClass: string; segments: number }> = {
  weak: { text: '弱', barClass: 'bg-destructive', textClass: 'text-destructive', segments: 1 },
  fair: { text: '中', barClass: 'bg-warning', textClass: 'text-warning', segments: 2 },
  strong: { text: '强', barClass: 'bg-success', textClass: 'text-success', segments: 3 },
};

interface StrengthIndicatorProps {
  password: string;
  /** 是否显示改进建议，默认 true */
  showSuggestions?: boolean;
}

export function StrengthIndicator({ password, showSuggestions = true }: StrengthIndicatorProps) {
  const [result, setResult] = useState<Awaited<ReturnType<typeof assessPassword>> | null>(null);

  useEffect(() => {
    if (password.length === 0) {
      return;
    }
    let cancelled = false;
    assessPassword(password).then((r) => {
      if (!cancelled) setResult(r);
    }).catch(() => {
      // zxcvbn-ts 加载或评估失败时静默处理，不影响表单提交
    });
    return () => { cancelled = true; };
  }, [password]);

  if (password.length === 0 || !result) return null;

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
