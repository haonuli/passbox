/**
 * 标签输入组件 (T6.4)
 *
 * 用于条目新建/编辑表单中选择或创建标签。
 *
 * 功能：
 * - 输入标签名称，回车添加
 * - 支持自动补全已有标签（从 vault-store.tags 中匹配）
 * - 输入不存在的标签时自动创建（调用 createTag Server Action）
 * - 已选标签显示为标签卡片，可点击 × 移除
 *
 * @see TASK_BREAKDOWN T6.4 验收标准
 */
'use client';

import { useState, useCallback, useRef, useEffect, useMemo } from 'react';
import { X, Loader2, Tag as TagIcon } from 'lucide-react';
import { toast } from 'sonner';
import { Input } from '@/components/ui/input';
import { useVaultStore } from '@/stores/vault-store';
import { createTag } from '@/actions/tag';
import type { DecryptedTag } from '@/types/vault';
import { cn } from '@/lib/utils';

interface TagInputProps {
  selectedTagIds: string[];
  onChange: (ids: string[]) => void;
}

export function TagInput({ selectedTagIds, onChange }: TagInputProps) {
  const tags = useVaultStore((s) => s.tags);
  const [inputValue, setInputValue] = useState('');
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [creating, setCreating] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  const containerRef = useRef<HTMLDivElement>(null);

  // 已选标签（从 store 中解析 id → DecryptedTag）
  const selectedTags = useMemo<DecryptedTag[]>(() => {
    const tagMap = new Map(tags.map((t) => [t.id, t]));
    return selectedTagIds
      .map((id) => tagMap.get(id))
      .filter((t): t is DecryptedTag => t !== undefined);
  }, [selectedTagIds, tags]);

  // 自动补全建议：匹配输入且未选中的标签
  const suggestions = useMemo<DecryptedTag[]>(() => {
    const query = inputValue.trim().toLowerCase();
    if (!query) return [];
    const selectedSet = new Set(selectedTagIds);
    return tags
      .filter(
        (t) =>
          !selectedSet.has(t.id) && t.name.toLowerCase().includes(query),
      )
      .slice(0, 8);
  }, [inputValue, tags, selectedTagIds]);

  // 点击外部关闭建议下拉
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (
        containerRef.current &&
        !containerRef.current.contains(e.target as Node)
      ) {
        setShowSuggestions(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  /**
   * 添加标签（已存在则直接选中，不存在则创建后选中）。
   */
  const addTag = useCallback(
    async (name: string) => {
      const trimmedName = name.trim();
      if (!trimmedName) return;

      // 检查是否已选中同名标签
      const alreadySelected = selectedTags.some(
        (t) => t.name.toLowerCase() === trimmedName.toLowerCase(),
      );
      if (alreadySelected) {
        setInputValue('');
        setShowSuggestions(false);
        return;
      }

      // 检查 store 中是否已有同名标签
      const existing = tags.find(
        (t) => t.name.toLowerCase() === trimmedName.toLowerCase(),
      );

      if (existing) {
        onChange([...selectedTagIds, existing.id]);
        setInputValue('');
        setShowSuggestions(false);
        return;
      }

      // 不存在则创建
      setCreating(true);
      try {
        const result = await createTag(trimmedName);
        if (result.ok) {
          const newTag: DecryptedTag = {
            id: result.data.id,
            name: result.data.name,
            createdAt: result.data.created_at,
          };
          // 将新标签同步到 vault-store，供后续自动补全使用
          useVaultStore.setState((state) => ({ tags: [...state.tags, newTag] }));
          onChange([...selectedTagIds, newTag.id]);
          setInputValue('');
          setShowSuggestions(false);
        } else {
          toast.error(result.error);
        }
      } catch {
        toast.error('创建标签失败，请稍后重试');
      } finally {
        setCreating(false);
      }
    },
    [selectedTagIds, selectedTags, tags, onChange],
  );

  /** 移除已选标签。 */
  const removeTag = useCallback(
    (tagId: string) => {
      onChange(selectedTagIds.filter((id) => id !== tagId));
    },
    [selectedTagIds, onChange],
  );

  /** 键盘事件：回车添加 / 上下键切换建议 / Escape 关闭。 */
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        if (activeIndex >= 0 && activeIndex < suggestions.length) {
          void addTag(suggestions[activeIndex].name);
        } else if (inputValue.trim()) {
          void addTag(inputValue);
        }
        setActiveIndex(-1);
      } else if (e.key === 'ArrowDown') {
        e.preventDefault();
        if (suggestions.length > 0) {
          setActiveIndex((prev) =>
            prev < suggestions.length - 1 ? prev + 1 : 0,
          );
        }
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        if (suggestions.length > 0) {
          setActiveIndex((prev) =>
            prev > 0 ? prev - 1 : suggestions.length - 1,
          );
        }
      } else if (e.key === 'Escape') {
        setShowSuggestions(false);
        setActiveIndex(-1);
      } else if (e.key === 'Backspace' && !inputValue && selectedTagIds.length > 0) {
        // 输入为空时退格删除最后一个标签
        removeTag(selectedTagIds[selectedTagIds.length - 1]);
      }
    },
    [activeIndex, suggestions, inputValue, selectedTagIds, addTag, removeTag],
  );

  return (
    <div ref={containerRef} className="relative">
      {/* 已选标签 + 输入框 */}
      <div
        className="flex min-h-9 flex-wrap items-center gap-1.5 rounded-md border border-input bg-transparent px-2 py-1 text-sm shadow-sm focus-within:ring-1 focus-within:ring-ring"
        onClick={() => {
          const input = containerRef.current?.querySelector('input');
          input?.focus();
        }}
      >
        {selectedTags.map((tag) => (
          <span
            key={tag.id}
            className="inline-flex items-center gap-1 rounded-full bg-muted px-2 py-0.5 text-xs"
          >
            {tag.name}
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                removeTag(tag.id);
              }}
              className="text-muted-foreground transition-colors hover:text-foreground"
              aria-label={`移除标签 ${tag.name}`}
            >
              <X className="h-3 w-3" />
            </button>
          </span>
        ))}
        <Input
          type="text"
          value={inputValue}
          onChange={(e) => {
            setInputValue(e.target.value);
            setShowSuggestions(true);
            setActiveIndex(-1);
          }}
          onFocus={() => setShowSuggestions(true)}
          onKeyDown={handleKeyDown}
          disabled={creating}
          placeholder={selectedTagIds.length === 0 ? '输入标签名称，回车添加' : ''}
          className="h-7 flex-1 border-0 px-1 shadow-none focus-visible:ring-0"
        />
        {creating && (
          <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground" />
        )}
      </div>

      {/* 自动补全建议 */}
      {showSuggestions && suggestions.length > 0 && (
        <ul
          className="absolute z-10 mt-1 max-h-48 w-full overflow-auto rounded-md border border-border bg-popover py-1 shadow-md"
          role="listbox"
        >
          {suggestions.map((tag, index) => (
            <li key={tag.id} role="option" aria-selected={index === activeIndex}>
              <button
                type="button"
                onClick={() => {
                  void addTag(tag.name);
                  setActiveIndex(-1);
                }}
                className={cn(
                  'flex w-full items-center gap-2 px-3 py-1.5 text-left text-sm transition-colors',
                  index === activeIndex
                    ? 'bg-accent text-accent-foreground'
                    : 'hover:bg-accent hover:text-accent-foreground',
                )}
              >
                <TagIcon className="h-3.5 w-3.5 text-muted-foreground" />
                {tag.name}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
