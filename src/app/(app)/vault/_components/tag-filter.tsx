/**
 * 标签筛选组件 (T6.4)
 *
 * 用于密码库主视图按标签筛选条目。
 *
 * 功能：
 * - 显示所有标签列表（从 vault-store.tags 读取）
 * - 点击标签筛选对应条目
 * - 支持多选筛选
 *
 * @see TASK_BREAKDOWN T6.4 验收标准
 */
'use client';

import { useCallback } from 'react';
import { Tag as TagIcon, X } from 'lucide-react';
import { useVaultStore } from '@/stores/vault-store';
import { cn } from '@/lib/utils';

interface TagFilterProps {
  selectedTagIds: string[];
  onFilterChange: (ids: string[]) => void;
}

export function TagFilter({ selectedTagIds, onFilterChange }: TagFilterProps) {
  const tags = useVaultStore((s) => s.tags);

  /** 切换标签选中状态（多选）。 */
  const toggleTag = useCallback(
    (tagId: string) => {
      if (selectedTagIds.includes(tagId)) {
        onFilterChange(selectedTagIds.filter((id) => id !== tagId));
      } else {
        onFilterChange([...selectedTagIds, tagId]);
      }
    },
    [selectedTagIds, onFilterChange],
  );

  /** 清空所有筛选。 */
  const clearFilter = useCallback(() => {
    onFilterChange([]);
  }, [onFilterChange]);

  if (tags.length === 0) {
    return null;
  }

  return (
    <div className="flex items-center gap-1.5 overflow-x-auto border-b border-border px-4 py-2">
      <span className="shrink-0 text-xs font-medium text-muted-foreground">标签</span>
      {tags.map((tag) => {
        const isActive = selectedTagIds.includes(tag.id);
        return (
          <button
            key={tag.id}
            type="button"
            onClick={() => toggleTag(tag.id)}
            className={cn(
              'inline-flex shrink-0 items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium transition-colors',
              isActive
                ? 'bg-primary text-primary-foreground'
                : 'bg-muted text-muted-foreground hover:bg-muted/80 hover:text-foreground',
            )}
          >
            <TagIcon className="h-3 w-3" />
            {tag.name}
          </button>
        );
      })}
      {selectedTagIds.length > 0 && (
        <button
          type="button"
          onClick={clearFilter}
          className="inline-flex shrink-0 items-center gap-0.5 rounded-full px-2 py-0.5 text-xs text-muted-foreground transition-colors hover:text-foreground"
        >
          <X className="h-3 w-3" />
          清除
        </button>
      )}
    </div>
  );
}
