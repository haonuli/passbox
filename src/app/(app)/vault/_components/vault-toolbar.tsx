/**
 * 密码库工具栏 (T4.4)
 *
 * 包含：筛选标签（全部 / 收藏）+ 新建按钮。
 */
'use client';

import Link from 'next/link';
import { Plus, Star, List } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';

export type FilterType = 'all' | 'favorites';

interface VaultToolbarProps {
  filter: FilterType;
  onFilterChange: (filter: FilterType) => void;
  totalCount: number;
  favoritesCount: number;
}

export function VaultToolbar({
  filter,
  onFilterChange,
  totalCount,
  favoritesCount,
}: VaultToolbarProps) {
  return (
    <div className="flex items-center justify-between border-b border-border px-4 py-2">
      <div className="flex items-center gap-1">
        <button
          onClick={() => onFilterChange('all')}
          className={cn(
            'flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium transition-colors',
            filter === 'all'
              ? 'bg-primary text-primary-foreground'
              : 'text-muted-foreground hover:bg-muted hover:text-foreground',
          )}
        >
          <List className="h-3.5 w-3.5" />
          全部
          <span className="ml-1 text-xs opacity-70">{totalCount}</span>
        </button>
        <button
          onClick={() => onFilterChange('favorites')}
          className={cn(
            'flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium transition-colors',
            filter === 'favorites'
              ? 'bg-primary text-primary-foreground'
              : 'text-muted-foreground hover:bg-muted hover:text-foreground',
          )}
        >
          <Star className="h-3.5 w-3.5" />
          收藏
          <span className="ml-1 text-xs opacity-70">{favoritesCount}</span>
        </button>
      </div>
      <Button size="sm" asChild>
        <Link href="/items/new">
          <Plus className="h-4 w-4" />
          新建
        </Link>
      </Button>
    </div>
  );
}
