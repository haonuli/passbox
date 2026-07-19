/**
 * 过期条目清单组件
 *
 * 按三组分类展示即将过期的条目：
 * - 已过期（红色 + AlertTriangle）
 * - 30 天内（黄色 + Clock）
 * - 90 天内（蓝色 + Calendar）
 *
 * 点击条目跳转编辑页。无过期条目时显示正向反馈。
 */
'use client';

import { useMemo } from 'react';
import Link from 'next/link';
import { AlertTriangle, Clock, Calendar, CheckCircle2 } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';
import { checkExpiry, type ExpiryCheckResult } from '@/lib/security/expiry-check';
import { getItemTypeConfigByCode } from '@/lib/item-types';
import { useVaultStore } from '@/stores/vault-store';
import type { DecryptedItem } from '@/types/vault';

interface ExpiryListProps {
  /** 条目列表；未传时从 useVaultStore 获取 */
  items?: DecryptedItem[];
}

/** 格式化日期为 YYYY-MM-DD */
function formatDate(date: Date): string {
  return date.toLocaleDateString('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });
}

/** 格式化剩余天数 */
function formatDaysRemaining(days: number): string {
  if (days < 0) return `已过期 ${Math.abs(days)} 天`;
  if (days === 0) return '今天过期';
  return `剩余 ${days} 天`;
}

/** 渲染一组过期条目 */
function ExpiryGroup({
  title,
  results,
  icon: Icon,
  iconColor,
}: {
  title: string;
  results: ExpiryCheckResult[];
  icon: LucideIcon;
  iconColor: string;
}) {
  return (
    <div className="space-y-1">
      <div className={cn('flex items-center gap-2 px-1 text-sm font-medium', iconColor)}>
        <Icon className="h-4 w-4" />
        {title}
        <span className="text-xs text-muted-foreground">({results.length})</span>
      </div>
      {results.map((result) => {
        const TypeIcon = getItemTypeConfigByCode(result.item.itemTypeCode)?.icon ?? AlertTriangle;
        return (
          <Link
            key={result.item.id}
            href={`/items/${result.item.id}/edit`}
            className="flex items-center justify-between gap-2 rounded-md border border-border p-3 transition-colors hover:bg-muted/50"
          >
            <div className="flex min-w-0 items-center gap-2">
              <TypeIcon className="h-4 w-4 shrink-0 text-muted-foreground" />
              <span className="truncate text-sm">{result.item.title}</span>
            </div>
            <div className="shrink-0 text-right">
              <div className="text-xs text-muted-foreground">{formatDate(result.expiryDate)}</div>
              <div className={cn('text-xs font-medium', iconColor)}>
                {formatDaysRemaining(result.daysRemaining)}
              </div>
            </div>
          </Link>
        );
      })}
    </div>
  );
}

export function ExpiryList({ items: propItems }: ExpiryListProps) {
  const storeItems = useVaultStore((s) => s.items);
  const items = propItems ?? storeItems;

  const results = useMemo(() => checkExpiry(items), [items]);

  if (results.length === 0) {
    return (
      <div className="flex items-center gap-2 p-4">
        <CheckCircle2 className="h-5 w-5 text-success" />
        <span className="text-sm">未发现即将过期的条目</span>
      </div>
    );
  }

  const expired = results.filter((r) => r.status === 'expired');
  const soon = results.filter((r) => r.status === 'soon');
  const upcoming = results.filter((r) => r.status === 'upcoming');

  return (
    <div className="space-y-3">
      {expired.length > 0 && (
        <ExpiryGroup title="已过期" results={expired} icon={AlertTriangle} iconColor="text-destructive" />
      )}
      {soon.length > 0 && (
        <ExpiryGroup title="30 天内过期" results={soon} icon={Clock} iconColor="text-warning" />
      )}
      {upcoming.length > 0 && (
        <ExpiryGroup title="90 天内过期" results={upcoming} icon={Calendar} iconColor="text-success" />
      )}
    </div>
  );
}
