/**
 * 导入向导 - 步骤 6：结果摘要
 *
 * 展示导入结果统计与错误信息。
 */
'use client';

import { CheckCircle2, XCircle, AlertCircle, RotateCcw } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import type { ImportSummary } from '@/lib/import-export/types';

interface ImportStepResultProps {
  summary: ImportSummary;
  onDone: () => void;
}

export function ImportStepResult({ summary, onDone }: ImportStepResultProps) {
  const stats = [
    { label: '成功导入', value: summary.imported, icon: CheckCircle2, color: 'text-green-600' },
    { label: '跳过', value: summary.skipped, icon: AlertCircle, color: 'text-muted-foreground' },
    { label: '覆盖', value: summary.overwritten, icon: CheckCircle2, color: 'text-blue-600' },
    { label: '失败', value: summary.failed, icon: XCircle, color: 'text-destructive' },
  ];

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-sm font-semibold">导入完成</h2>
        <p className="text-xs text-muted-foreground">共处理 {summary.total} 条数据</p>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {stats.map((stat) => {
          const Icon = stat.icon;
          return (
            <div key={stat.label} className="rounded-lg border border-border p-3">
              <div className="flex items-center gap-1.5">
                <Icon className={cn('h-4 w-4', stat.color)} />
                <span className="text-xs text-muted-foreground">{stat.label}</span>
              </div>
              <div className="mt-1 text-lg font-semibold">{stat.value}</div>
            </div>
          );
        })}
      </div>

      {summary.errors.length > 0 && (
        <div className="space-y-2">
          <div className="text-xs font-medium text-destructive">错误信息（最多显示前 10 条）</div>
          <div className="max-h-[200px] space-y-1 overflow-auto rounded-md border border-border p-2">
            {summary.errors.slice(0, 10).map((err, i) => (
              <div key={i} className="text-xs text-destructive">
                {i + 1}. {err}
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="flex justify-start">
        <Button size="sm" onClick={onDone}>
          <RotateCcw className="h-4 w-4" />
          完成
        </Button>
      </div>
    </div>
  );
}
