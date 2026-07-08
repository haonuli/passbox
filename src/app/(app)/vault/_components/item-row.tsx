/**
 * 单条目行组件 (T4.4 / T4.7)
 *
 * 显示：类型图标、标题、用户名、收藏星标。
 * 点击跳转到详情页 /items/[id]。
 * 收藏星标可快速切换收藏状态（T4.7）。
 */
'use client';

import { useCallback } from 'react';
import Link from 'next/link';
import { Star, FileText } from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { useVaultStore } from '@/stores/vault-store';
import { toggleFavorite } from '@/actions/item';
import { getItemTypeConfigByCode } from '@/lib/item-types';
import type { DecryptedItem } from '@/types/vault';

interface ItemRowProps {
  item: DecryptedItem;
}

/** 条目类型图标 */
function ItemTypeIcon({ item }: { item: DecryptedItem }) {
  const config = getItemTypeConfigByCode(item.itemTypeCode);
  const Icon = config?.icon ?? FileText;
  return <Icon className="h-4 w-4 text-muted-foreground" />;
}

export function ItemRow({ item }: ItemRowProps) {
  const updateFavorite = useVaultStore((s) => s.updateFavorite);

  const handleToggleFavorite = useCallback(
    async (e: React.MouseEvent) => {
      e.preventDefault();
      e.stopPropagation();

      const newValue = !item.isFavorite;
      // 乐观更新
      updateFavorite(item.id, newValue);

      try {
        const result = await toggleFavorite(item.id, newValue);
        if (!result.ok) {
          // 回滚
          updateFavorite(item.id, !newValue);
          toast.error(result.error);
        }
      } catch {
        updateFavorite(item.id, !newValue);
        toast.error('更新收藏状态失败');
      }
    },
    [item.id, item.isFavorite, updateFavorite],
  );

  return (
    <Link
      href={`/items/${item.id}`}
      className="flex items-center gap-3 border-b border-border px-4 py-3 transition-colors hover:bg-muted/50"
    >
      <ItemTypeIcon item={item} />
      <div className="flex min-w-0 flex-1 flex-col">
        <span className="truncate text-sm font-medium">{item.title}</span>
        {item.data.username && (
          <span className="truncate text-xs text-muted-foreground">
            {item.data.username}
          </span>
        )}
      </div>
      <button
        type="button"
        onClick={handleToggleFavorite}
        className="shrink-0 p-1 text-muted-foreground hover:text-foreground"
        aria-label={item.isFavorite ? '取消收藏' : '添加收藏'}
      >
        <Star
          className={cn(
            'h-4 w-4',
            item.isFavorite && 'fill-yellow-400 text-yellow-400',
          )}
        />
      </button>
    </Link>
  );
}
