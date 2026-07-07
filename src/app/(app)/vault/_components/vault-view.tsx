/**
 * 密码库主视图 (T4.4 / T4.7)
 *
 * 客户端组件，负责：
 * 1. 加载密码库密文（getVaultData Server Action）
 * 2. 用 Symmetric Key 解密并缓存到 vault-store
 * 3. 虚拟滚动列表展示条目
 * 4. 支持"全部"和"收藏"筛选视图
 * 5. 本地搜索（T4.7，使用 useDeferredValue 优化）
 * 6. 空密码库引导状态
 *
 * @see TASK_BREAKDOWN T4.4 / T4.7 验收标准
 */
'use client';

import { useEffect, useState, useMemo, useRef, useDeferredValue } from 'react';
import { useRouter } from 'next/navigation';
import { useVirtualizer } from '@tanstack/react-virtual';
import { Loader2, Plus, Vault as VaultIcon, SearchX } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useAuthStore } from '@/stores/auth-store';
import { useVaultStore } from '@/stores/vault-store';
import { getVaultData } from '@/actions/vault';
import { ItemRow } from './item-row';
import { VaultToolbar, type FilterType } from './vault-toolbar';

const ROW_HEIGHT = 56;

export function VaultView() {
  const router = useRouter();
  const symmetricKey = useAuthStore((s) => s.symmetricKey);
  const { items, loaded, loading, setVaultData, searchQuery } = useVaultStore();

  const [filter, setFilter] = useState<FilterType>('all');
  const [error, setError] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  // 加载密码库数据
  useEffect(() => {
    if (loaded || loading || !symmetricKey) return;

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
  }, [loaded, loading, symmetricKey, setVaultData]);

  // 筛选 + 搜索（useDeferredValue 优化搜索性能 — T4.7）
  const deferredQuery = useDeferredValue(searchQuery);
  const filteredItems = useMemo(() => {
    let result = items;

    // 收藏筛选
    if (filter === 'favorites') {
      result = result.filter((i) => i.isFavorite);
    }

    // 搜索筛选（匹配标题、用户名、URL）
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

  // 加载中
  if (loading || (!loaded && !error)) {
    return (
      <div className="flex flex-1 items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  // 加载错误
  if (error) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-4 p-8 text-center">
        <p className="text-sm text-destructive">{error}</p>
        <Button size="sm" variant="outline" onClick={() => window.location.reload()}>
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

  // 正常列表
  return (
    <div className="flex h-full flex-col">
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
                  <ItemRow item={item} />
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
