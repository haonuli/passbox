/**
 * 单条目行组件 (T4.4 / T4.7)
 *
 * 显示：类型图标、标题、用户名、收藏星标。
 * 点击选中条目，联动右侧详情面板。
 * 收藏星标可快速切换收藏状态（T4.7）。
 *
 * 多选模式（selectionMode=true）：
 * - 显示复选框
 * - 点击行切换勾选状态而非打开详情
 */
'use client';

import { useCallback, useRef, useState } from 'react';
import { Star, Check } from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { useVaultStore } from '@/stores/vault-store';
import { toggleFavorite } from '@/actions/item';
import { FaviconImage } from '@/components/favicon-image';
import type { DecryptedItem } from '@/types/vault';

interface ItemRowProps {
  item: DecryptedItem;
  isSelected: boolean;
  onSelect: (itemId: string) => void;
  /** 多选模式：显示复选框，点击行切换勾选 */
  selectionMode?: boolean;
  /** 多选模式下是否被勾选 */
  isChecked?: boolean;
  /** 多选模式下切换勾选 */
  onToggleCheck?: (itemId: string) => void;
}

export function ItemRow({
  item,
  isSelected,
  onSelect,
  selectionMode = false,
  isChecked = false,
  onToggleCheck,
}: ItemRowProps) {
  const updateFavorite = useVaultStore((s) => s.updateFavorite);

  // UX-020：提取 URL 域名作为二级信息（失败时静默忽略）
  let domain: string | null = null;
  if (item.data.url) {
    try {
      domain = new URL(item.data.url).hostname.replace(/^www\./, '');
    } catch {
      domain = null;
    }
  }
  const secondary = [item.data.username, domain].filter(Boolean).join(' · ');

  const handleToggleFavorite = useCallback(
    async (e?: React.MouseEvent) => {
      e?.preventDefault();
      e?.stopPropagation();

      const newValue = !item.isFavorite;
      updateFavorite(item.id, newValue);

      try {
        const result = await toggleFavorite(item.id, newValue);
        if (!result.ok) {
          updateFavorite(item.id, !newValue);
          toast.error(result.error);
        } else {
          toast.success(newValue ? '已收藏' : '已取消收藏');
        }
      } catch {
        updateFavorite(item.id, !newValue);
        toast.error('更新收藏状态失败');
      }
    },
    [item.id, item.isFavorite, updateFavorite],
  );

  // UX-021：移动端左滑快速收藏
  const touchStart = useRef<{ x: number; y: number } | null>(null);
  const [swipeHint, setSwipeHint] = useState(false);

  const handleTouchStart = useCallback((e: React.TouchEvent<HTMLButtonElement>) => {
    const t = e.touches[0];
    touchStart.current = { x: t.clientX, y: t.clientY };
  }, []);

  const handleTouchMove = useCallback((e: React.TouchEvent<HTMLButtonElement>) => {
    if (!touchStart.current) return;
    const t = e.touches[0];
    const dx = t.clientX - touchStart.current.x;
    const dy = t.clientY - touchStart.current.y;
    // 左滑且水平占优时显示提示
    if (dx < -30 && Math.abs(dx) > Math.abs(dy) * 1.5) {
      setSwipeHint(true);
    } else {
      setSwipeHint(false);
    }
  }, []);

  const handleTouchEnd = useCallback(
    (e: React.TouchEvent<HTMLButtonElement>) => {
      if (!touchStart.current) return;
      const t = e.changedTouches[0];
      const dx = t.clientX - touchStart.current.x;
      const dy = t.clientY - touchStart.current.y;
      touchStart.current = null;
      setSwipeHint(false);
      // 左滑 ≥ 70px 且水平占优：触发收藏
      if (dx <= -70 && Math.abs(dx) > Math.abs(dy) * 1.5) {
        void handleToggleFavorite();
      }
    },
    [handleToggleFavorite],
  );

  const handleClick = () => {
    if (selectionMode) {
      onToggleCheck?.(item.id);
    } else {
      onSelect(item.id);
    }
  };

  return (
    <button
      type="button"
      onClick={handleClick}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
      className={cn(
        'flex w-full items-center gap-3 border-b border-border px-4 py-3 text-left transition-colors',
        isSelected && !selectionMode ? 'bg-primary/10 border-l-2 border-l-primary' : 'hover:bg-muted/50',
        selectionMode && isChecked && 'bg-primary/10',
        swipeHint && 'bg-warning/10',
      )}
    >
      {selectionMode && (
        <span
          className={cn(
            'flex h-4 w-4 shrink-0 items-center justify-center rounded border',
            isChecked
              ? 'border-primary bg-primary text-primary-foreground'
              : 'border-muted-foreground/40 bg-background',
          )}
        >
          {isChecked && <Check className="h-3 w-3" />}
        </span>
      )}
      <FaviconImage url={item.data.url} itemTypeCode={item.itemTypeCode} className="h-4 w-4 text-muted-foreground" />
      <div className="flex min-w-0 flex-1 flex-col">
        <span className="truncate text-sm font-medium">{item.title}</span>
        {secondary && (
          <span className="truncate text-xs text-muted-foreground">{secondary}</span>
        )}
      </div>
      {!selectionMode && (
        <button
          type="button"
          onClick={handleToggleFavorite}
          className="shrink-0 p-1 text-muted-foreground hover:text-foreground"
          aria-label={item.isFavorite ? '取消收藏' : '添加收藏'}
        >
          <Star
            className={cn(
              'h-4 w-4',
              item.isFavorite && 'fill-warning text-warning',
            )}
          />
        </button>
      )}
    </button>
  );
}
