/**
 * 泄露密码清单组件 (T6.6)
 *
 * 展示已检测到的泄露密码列表，每项显示条目标题及泄露次数。
 * 点击条目跳转编辑页修改密码。
 * 基于 HIBP k-anonymity 协议，仅发送 SHA-1 前缀，不泄露完整密码。
 *
 * @see TASK_BREAKDOWN T6.6 验收标准
 */
'use client';

import Link from 'next/link';
import { AlertTriangle, CheckCircle2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useBreachCheck } from '@/hooks/use-breach-check';

/** 泄露次数格式化：超过 1 万以"万"为单位 */
function formatBreachCount(count: number): string {
  if (count >= 10_000) {
    return `${(count / 10_000).toFixed(1)} 万次`;
  }
  return `${count} 次`;
}

export function BreachList() {
  const { results, loading, error } = useBreachCheck();

  if (loading) {
    return (
      <div className="flex items-center gap-2 p-4 text-sm text-muted-foreground">
        <span className="animate-pulse">正在检测密码泄露情况…</span>
      </div>
    );
  }

  // API 完全不可用
  if (error && results.length === 0) {
    return (
      <div className="flex items-center gap-2 p-4">
        <AlertTriangle className="h-5 w-5 text-muted-foreground" />
        <span className="text-sm text-muted-foreground">{error}</span>
      </div>
    );
  }

  // 无泄露
  if (results.length === 0) {
    return (
      <div className="flex items-center gap-2 p-4">
        <CheckCircle2 className="h-5 w-5 text-success" />
        <span className="text-sm">未发现泄露密码</span>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2 px-1 text-sm text-muted-foreground">
        <AlertTriangle className="h-4 w-4 text-destructive" />
        发现 {results.length} 个泄露密码
      </div>
      {error && (
        <div className="rounded-md border border-warning/30 bg-warning/5 px-3 py-2 text-xs text-muted-foreground">
          {error}
        </div>
      )}
      <div className="space-y-2">
        {results.map((item) => {
          const isHighRisk = item.breachCount >= 100;
          return (
            <Link
              key={item.itemId}
              href={`/items/${item.itemId}/edit`}
              className={cn(
                'flex items-center justify-between gap-2 rounded-md border p-3 transition-colors hover:bg-muted/50',
                isHighRisk
                  ? 'border-destructive/30 bg-destructive/5'
                  : 'border-warning/30 bg-warning/5',
              )}
            >
              <div className="flex min-w-0 items-center gap-2">
                <AlertTriangle
                  className={cn(
                    'h-4 w-4 shrink-0',
                    isHighRisk ? 'text-destructive' : 'text-warning',
                  )}
                />
                <span className="truncate text-sm">{item.title}</span>
              </div>
              <span
                className={cn(
                  'shrink-0 text-xs font-medium',
                  isHighRisk ? 'text-destructive' : 'text-warning',
                )}
              >
                泄露 {formatBreachCount(item.breachCount)}
              </span>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
