/**
 * 密码库列表骨架屏
 *
 * 数据加载时展示占位骨架，替代单纯 Spinner。
 */
const SKELETON_ROWS = 8;

export function VaultSkeleton() {
  return (
    <div className="flex h-full flex-col">
      {/* 工具栏骨架 */}
      <div className="flex items-center justify-between border-b border-border px-4 py-2">
        <div className="flex items-center gap-2">
          <div className="h-7 w-16 animate-pulse rounded-md bg-muted" />
          <div className="h-7 w-16 animate-pulse rounded-md bg-muted" />
        </div>
        <div className="h-8 w-16 animate-pulse rounded-md bg-muted" />
      </div>

      {/* 列表行骨架 */}
      <div className="flex-1 overflow-hidden">
        {Array.from({ length: SKELETON_ROWS }).map((_, i) => (
          <div
            key={i}
            className="flex items-center gap-3 border-b border-border px-4 py-3"
          >
            <div className="h-4 w-4 shrink-0 animate-pulse rounded bg-muted" />
            <div className="flex flex-1 flex-col gap-1.5">
              <div className="h-3.5 w-2/3 animate-pulse rounded bg-muted" />
              <div className="h-2.5 w-1/3 animate-pulse rounded bg-muted" />
            </div>
            <div className="h-4 w-4 shrink-0 animate-pulse rounded bg-muted" />
          </div>
        ))}
      </div>
    </div>
  );
}
