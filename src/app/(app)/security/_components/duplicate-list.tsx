/**
 * 重复密码清单组件 (T5.5)
 *
 * 展示所有重复密码分组，每组显示涉及的条目标题。
 * 点击条目可跳转编辑页修改密码。
 *
 * @see TASK_BREAKDOWN T5.5 验收标准
 */
'use client';

import Link from 'next/link';
import { AlertTriangle, CheckCircle2 } from 'lucide-react';
import type { DuplicateGroup } from '@/lib/security/duplicate-check';

interface DuplicateListProps {
  duplicates: DuplicateGroup[];
  loading: boolean;
}

export function DuplicateList({ duplicates, loading }: DuplicateListProps) {
  if (loading) {
    return (
      <div className="flex items-center gap-2 p-4 text-sm text-muted-foreground">
        <span className="animate-pulse">正在检测重复密码…</span>
      </div>
    );
  }

  if (duplicates.length === 0) {
    return (
      <div className="flex items-center gap-2 p-4">
        <CheckCircle2 className="h-5 w-5 text-green-500" />
        <span className="text-sm">未发现重复密码</span>
      </div>
    );
  }

  const totalDuplicates = duplicates.reduce((sum, g) => sum + g.items.length, 0);

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2 px-1 text-sm text-muted-foreground">
        <AlertTriangle className="h-4 w-4 text-yellow-500" />
        发现 {duplicates.length} 组重复密码（涉及 {totalDuplicates} 个条目）
      </div>
      {duplicates.map((group) => (
        <div
          key={group.hashPrefix}
          className="rounded-md border border-yellow-500/30 bg-yellow-500/5 p-3"
        >
          <div className="mb-2 text-xs font-medium text-muted-foreground">
            重复密码 #{group.hashPrefix}
          </div>
          <div className="space-y-1">
            {group.items.map((item) => (
              <Link
                key={item.id}
                href={`/items/${item.id}/edit`}
                className="flex items-center gap-2 rounded p-1.5 text-sm hover:bg-muted/50"
              >
                <span className="truncate">{item.title}</span>
                {item.data.username && (
                  <span className="truncate text-xs text-muted-foreground">
                    ({item.data.username})
                  </span>
                )}
              </Link>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
