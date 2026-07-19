/**
 * 密码库主视图 (T4.4 / T4.7)
 *
 * 三栏联动布局：
 * - 中栏：条目列表（虚拟滚动 + 筛选 + 搜索）
 * - 右栏：选中条目的详情面板
 *
 * 点击列表项 -> 右侧详情面板同步更新，不跳转页面。
 * 移动端：列表/详情切换显示。
 */
'use client';

import { useEffect, useState, useMemo, useRef, useCallback, useDeferredValue } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { useVirtualizer } from '@tanstack/react-virtual';
import { Plus, Vault as VaultIcon, SearchX } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useAuthStore } from '@/stores/auth-store';
import { useVaultStore } from '@/stores/vault-store';
import { getVaultData } from '@/actions/vault';
import { OnboardingDialog, shouldShowOnboarding } from '@/components/onboarding-dialog';
import { ItemRow } from './item-row';
import { VaultToolbar, type FilterType } from './vault-toolbar';
import { ItemDetailPanel } from './item-detail-panel';
import { VaultSkeleton } from './vault-skeleton';
import { BatchActionBar } from './batch-action-bar';

const ROW_HEIGHT = 56;

export function VaultView() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const symmetricKey = useAuthStore((s) => s.symmetricKey);
  const { items, vaults, tags, loaded, loading, setVaultData, searchQuery } = useVaultStore();

  const [filter, setFilter] = useState<FilterType>('all');
  const [error, setError] = useState<string | null>(null);
  const [selectedItemId, setSelectedItemId] = useState<string | null>(null);
  const [selectionMode, setSelectionMode] = useState(false);
  const [checkedIds, setCheckedIds] = useState<Set<string>>(new Set());
  const scrollRef = useRef<HTMLDivElement>(null);
  // UX-036：首次使用引导（数据加载完成后显示）
  const [onboardingOpen, setOnboardingOpen] = useState(false);
  // 修复 P3：标记是否已自动选中过首项，避免覆盖用户主动取消选中（如按 Escape）
  const hasAutoSelected = useRef(false);

  // 数据加载完成后检查是否需要显示引导
  useEffect(() => {
    if (loaded && shouldShowOnboarding()) {
      setOnboardingOpen(true);
    }
  }, [loaded]);

  // 从 URL 参数读取筛选条件（vaultId / tagId）与选中项（itemId）
  const vaultIdParam = searchParams.get('vaultId');
  const tagIdParam = searchParams.get('tagId');

  // 从 URL 参数恢复选中项（支持深链接）
  useEffect(() => {
    const itemId = searchParams.get('itemId');
    if (itemId && loaded) {
      const exists = items.some((i) => i.id === itemId);
      if (exists) {
        setSelectedItemId(itemId);
        hasAutoSelected.current = true;
      }
    }
  }, [searchParams, items, loaded]);

  // 修复 P3：数据加载完成且无 URL itemId 参数时，自动选中第一个条目
  // 仅在首次加载或组件重新挂载时触发一次，避免覆盖用户主动取消选中
  useEffect(() => {
    if (!loaded || hasAutoSelected.current) return;
    if (items.length === 0) return;
    // URL 已指定 itemId 时由上一个 useEffect 处理
    if (searchParams.get('itemId')) return;
    setSelectedItemId(items[0].id);
    hasAutoSelected.current = true;
  }, [loaded, items, searchParams]);

  // 加载密码库数据
  useEffect(() => {
    if (loaded || loading || !symmetricKey || error) return;

    let cancelled = false;
    (async () => {
      const result = await getVaultData();
      if (cancelled) return;

      if (!result.ok) {
        setError(result.error);
        return;
      }

      try {
        await setVaultData(result.data, symmetricKey);
      } catch {
        setError('解密密码库数据失败');
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [loaded, loading, symmetricKey, setVaultData, error]);

  // 筛选 + 搜索
  const deferredQuery = useDeferredValue(searchQuery);
  const filteredItems = useMemo(() => {
    let result = items;

    // 保险库筛选（URL 参数 vaultId）
    if (vaultIdParam) {
      result = result.filter((i) => i.vaultId === vaultIdParam);
    }

    // 标签筛选（URL 参数 tagId）
    if (tagIdParam) {
      result = result.filter((i) => i.tagIds.includes(tagIdParam));
    }

    if (filter === 'favorites') {
      result = result.filter((i) => i.isFavorite);
    }

    const query = deferredQuery.trim().toLowerCase();
    if (query) {
      result = result.filter(
        (i) =>
          i.title.toLowerCase().includes(query) ||
          i.data.username?.toLowerCase().includes(query) ||
          i.data.url?.toLowerCase().includes(query),
      );
    }

    return result;
  }, [items, filter, deferredQuery, vaultIdParam, tagIdParam]);

  const favoritesCount = useMemo(() => items.filter((i) => i.isFavorite).length, [items]);

  // 当前筛选状态的展示信息（用于工具栏面包屑）
  const activeVault = vaultIdParam ? vaults.find((v) => v.id === vaultIdParam) : null;
  const activeTag = tagIdParam ? tags.find((t) => t.id === tagIdParam) : null;

  // 清除保险库/标签筛选（保留收藏/全部状态）
  const handleClearScopeFilter = () => {
    const next = new URLSearchParams(searchParams.toString());
    next.delete('vaultId');
    next.delete('tagId');
    const qs = next.toString();
    router.replace(qs ? `/vault?${qs}` : '/vault');
  };

  // 切换工具栏筛选时，清除 URL 中的 vaultId/tagId（避免与工具栏筛选冲突）
  const handleFilterChange = (next: FilterType) => {
    if (vaultIdParam || tagIdParam) {
      handleClearScopeFilter();
    }
    setFilter(next);
  };

  // 虚拟滚动（UX-047：overscan 调优为 20，避免快速滚动白屏）
  const virtualizer = useVirtualizer({
    count: filteredItems.length,
    getScrollElement: () => scrollRef.current,
    estimateSize: () => ROW_HEIGHT,
    overscan: 20,
  });

  const handleSelectItem = (itemId: string) => {
    setSelectedItemId(itemId);
  };

  const handleBackToList = () => {
    setSelectedItemId(null);
  };

  // ---- 多选模式 ----
  const handleEnterSelection = useCallback(() => {
    setSelectionMode(true);
    setCheckedIds(new Set());
  }, []);

  const handleExitSelection = useCallback(() => {
    setSelectionMode(false);
    setCheckedIds(new Set());
  }, []);

  const handleToggleCheck = useCallback((itemId: string) => {
    setCheckedIds((prev) => {
      const next = new Set(prev);
      if (next.has(itemId)) {
        next.delete(itemId);
      } else {
        next.add(itemId);
      }
      return next;
    });
  }, []);

  const handleSelectAll = useCallback(() => {
    setCheckedIds((prev) => {
      const visibleIds = filteredItems.map((i) => i.id);
      const allSelected = visibleIds.every((id) => prev.has(id));
      if (allSelected) {
        // 取消全选：移除当前可见的所有
        const next = new Set(prev);
        for (const id of visibleIds) next.delete(id);
        return next;
      }
      // 全选当前可见
      const next = new Set(prev);
      for (const id of visibleIds) next.add(id);
      return next;
    });
  }, [filteredItems]);

  // ---- 左滑手势返回（UX-007 AC3）----
  // 移动端详情面板左滑 ≥50px 返回列表，要求水平位移明显大于垂直避免误触
  const touchStart = useRef<{ x: number; y: number } | null>(null);
  const handleDetailTouchStart = useCallback((e: React.TouchEvent<HTMLDivElement>) => {
    const t = e.touches[0];
    touchStart.current = { x: t.clientX, y: t.clientY };
  }, []);
  const handleDetailTouchEnd = useCallback(
    (e: React.TouchEvent<HTMLDivElement>) => {
      if (!touchStart.current || !selectedItemId) return;
      const t = e.changedTouches[0];
      const dx = t.clientX - touchStart.current.x;
      const dy = t.clientY - touchStart.current.y;
      if (dx <= -50 && Math.abs(dx) > Math.abs(dy) * 1.5) {
        setSelectedItemId(null);
      }
      touchStart.current = null;
    },
    [selectedItemId],
  );

  // ---- 键盘导航（UX-008）----
  // 列表容器可聚焦（tabIndex=0），支持方向键导航、Enter 打开、Esc 取消、Space 多选
  const handleListKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLDivElement>) => {
      if (filteredItems.length === 0) return;

      const currentIndex = selectedItemId
        ? filteredItems.findIndex((i) => i.id === selectedItemId)
        : -1;

      switch (e.key) {
        case 'ArrowDown': {
          e.preventDefault();
          const nextIndex = currentIndex < filteredItems.length - 1
            ? Math.max(currentIndex + 1, 0)
            : 0;
          setSelectedItemId(filteredItems[nextIndex].id);
          virtualizer.scrollToIndex(nextIndex);
          break;
        }
        case 'ArrowUp': {
          e.preventDefault();
          if (currentIndex > 0) {
            const prevIndex = currentIndex - 1;
            setSelectedItemId(filteredItems[prevIndex].id);
            virtualizer.scrollToIndex(prevIndex);
          }
          break;
        }
        case 'Enter': {
          if (currentIndex < 0) {
            e.preventDefault();
            setSelectedItemId(filteredItems[0].id);
          }
          break;
        }
        case 'Escape': {
          if (selectedItemId) {
            e.preventDefault();
            setSelectedItemId(null);
          }
          break;
        }
        case ' ': {
          // Space：多选当前项
          if (selectedItemId) {
            e.preventDefault();
            if (!selectionMode) {
              setSelectionMode(true);
            }
            handleToggleCheck(selectedItemId);
          }
          break;
        }
      }
    },
    [filteredItems, selectedItemId, selectionMode, virtualizer, handleToggleCheck],
  );

  // 加载中（骨架屏）
  if (loading || (!loaded && !error)) {
    return (
      <div className="flex h-full overflow-hidden">
        <div className="flex w-full flex-col md:w-[360px] md:shrink-0 md:border-r md:border-border">
          <VaultSkeleton />
        </div>
        <div className="hidden md:flex flex-1 flex-col" />
      </div>
    );
  }

  // 加载错误
  if (error) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-4 p-8 text-center">
        <p className="text-sm text-destructive">{error}</p>
        <Button size="sm" variant="outline" onClick={() => setError(null)}>
          重试
        </Button>
      </div>
    );
  }

  // 空密码库引导
  if (items.length === 0) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-4 p-8 text-center">
        <VaultIcon className="h-12 w-12 text-muted-foreground" />
        <div>
          <h2 className="text-lg font-semibold">密码库为空</h2>
          <p className="mt-1 text-sm text-muted-foreground">添加你的第一个密码条目</p>
        </div>
        <Button onClick={() => router.push('/items/new')}>
          <Plus className="mr-1.5 h-4 w-4" />
          添加密码
        </Button>
      </div>
    );
  }

  // 三栏布局：列表 + 详情
  return (
    <div className="flex h-full overflow-hidden">
      {/* 中栏：条目列表 */}
      <div
        className={`flex flex-col ${selectedItemId ? 'hidden md:flex' : 'flex'} w-full md:w-[360px] md:shrink-0 md:border-r md:border-border`}
      >
        <VaultToolbar
          filter={filter}
          onFilterChange={handleFilterChange}
          totalCount={items.length}
          favoritesCount={favoritesCount}
          selectionMode={selectionMode}
          onEnterSelection={handleEnterSelection}
        />
        {(activeVault || activeTag) && !selectionMode && (
          <div className="flex items-center gap-2 border-b border-border bg-muted/40 px-4 py-1.5 text-xs text-muted-foreground">
            <span className="truncate">
              {activeVault ? `保险库：${activeVault.name}` : ''}
              {activeVault && activeTag ? ' · ' : ''}
              {activeTag ? `标签：${activeTag.name}` : ''}
            </span>
            <button
              type="button"
              onClick={handleClearScopeFilter}
              className="ml-auto rounded px-1.5 py-0.5 text-xs text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
            >
              清除筛选
            </button>
          </div>
        )}
        {selectionMode && (
          <BatchActionBar
            selectedIds={checkedIds}
            visibleIds={filteredItems.map((i) => i.id)}
            onSelectAll={handleSelectAll}
            onExit={handleExitSelection}
          />
        )}
        <div
          ref={scrollRef}
          className="flex-1 overflow-auto outline-none focus-visible:ring-1 focus-visible:ring-inset focus-visible:ring-ring"
          tabIndex={0}
          onKeyDown={handleListKeyDown}
          role="listbox"
          aria-label="条目列表"
        >
          {filteredItems.length === 0 ? (
            <div className="flex h-full flex-col items-center justify-center gap-2 p-8 text-center">
              <SearchX className="h-8 w-8 text-muted-foreground" />
              <p className="text-sm text-muted-foreground">
                {deferredQuery
                  ? `没有匹配「${deferredQuery}」的条目`
                  : activeVault || activeTag
                    ? '当前筛选下没有条目'
                    : filter === 'favorites'
                      ? '还没有收藏的条目'
                      : '没有匹配的条目'}
              </p>
              {(activeVault || activeTag) && !selectionMode && (
                <Button size="sm" variant="outline" onClick={handleClearScopeFilter}>
                  清除筛选
                </Button>
              )}
            </div>
          ) : (
            <div
              style={{ height: `${virtualizer.getTotalSize()}px`, position: 'relative' }}
            >
              {virtualizer.getVirtualItems().map((virtualItem) => {
                const item = filteredItems[virtualItem.index];
                if (!item) return null;
                return (
                  <div
                    key={item.id}
                    style={{
                      position: 'absolute',
                      top: 0,
                      left: 0,
                      width: '100%',
                      height: `${virtualItem.size}px`,
                      transform: `translateY(${virtualItem.start}px)`,
                    }}
                  >
                    <ItemRow
                      item={item}
                      isSelected={selectedItemId === item.id}
                      onSelect={handleSelectItem}
                      selectionMode={selectionMode}
                      isChecked={checkedIds.has(item.id)}
                      onToggleCheck={handleToggleCheck}
                    />
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* 右栏：详情面板 */}
      <div
        className={`${selectedItemId ? 'flex' : 'hidden md:flex'} flex-1 flex-col`}
        onTouchStart={handleDetailTouchStart}
        onTouchEnd={handleDetailTouchEnd}
      >
        <ItemDetailPanel itemId={selectedItemId} onBack={handleBackToList} />
      </div>

      {/* UX-036：首次使用引导 */}
      <OnboardingDialog open={onboardingOpen} onClose={() => setOnboardingOpen(false)} />
    </div>
  );
}
