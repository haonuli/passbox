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

import { useEffect, useState, useMemo, useRef, useDeferredValue } from 'react';
import { useSearchParams } from 'next/navigation';
import { useVirtualizer } from '@tanstack/react-virtual';
import { Plus, Vault as VaultIcon, SearchX } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useAuthStore } from '@/stores/auth-store';
import { useVaultStore } from '@/stores/vault-store';
import { getVaultData } from '@/actions/vault';
import { ItemRow } from './item-row';
import { VaultToolbar, type FilterType } from './vault-toolbar';
import { ItemDetailPanel } from './item-detail-panel';
import { VaultSkeleton } from './vault-skeleton';

const ROW_HEIGHT = 56;

export function VaultView() {
  const searchParams = useSearchParams();
  const symmetricKey = useAuthStore((s) => s.symmetricKey);
  const { items, loaded, loading, setVaultData, searchQuery } = useVaultStore();

  const [filter, setFilter] = useState<FilterType>('all');
  const [error, setError] = useState<string | null>(null);
  const [selectedItemId, setSelectedItemId] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  // 从 URL 参数恢复选中项（支持深链接）
  useEffect(() => {
    const itemId = searchParams.get('itemId');
    if (itemId && loaded) {
      const exists = items.some((i) => i.id === itemId);
      if (exists) {
        setSelectedItemId(itemId);
      }
    }
  }, [searchParams, items, loaded]);

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
  }, [items, filter, deferredQuery]);

  const favoritesCount = useMemo(() => items.filter((i) => i.isFavorite).length, [items]);

  // 虚拟滚动
  const virtualizer = useVirtualizer({
    count: filteredItems.length,
    getScrollElement: () => scrollRef.current,
    estimateSize: () => ROW_HEIGHT,
    overscan: 10,
  });

  const handleSelectItem = (itemId: string) => {
    setSelectedItemId(itemId);
  };

  const handleBackToList = () => {
    setSelectedItemId(null);
  };

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
        <Button onClick={() => (window.location.href = '/items/new')}>
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
          onFilterChange={setFilter}
          totalCount={items.length}
          favoritesCount={favoritesCount}
        />
        <div ref={scrollRef} className="flex-1 overflow-auto">
          {filteredItems.length === 0 ? (
            <div className="flex h-full flex-col items-center justify-center gap-2 p-8 text-center">
              <SearchX className="h-8 w-8 text-muted-foreground" />
              <p className="text-sm text-muted-foreground">
                {deferredQuery
                  ? `没有匹配「${deferredQuery}」的条目`
                  : filter === 'favorites'
                    ? '还没有收藏的条目'
                    : '没有匹配的条目'}
              </p>
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
      >
        <ItemDetailPanel itemId={selectedItemId} onBack={handleBackToList} />
      </div>
    </div>
  );
}
