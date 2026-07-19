/**
 * 数据管理路由 loading 骨架屏 (UX-045)
 */
export default function DataLoading() {
  return (
    <div className="flex h-full flex-col">
      <div className="border-b border-border px-4 py-3">
        <div className="h-4 w-24 animate-pulse rounded bg-muted" />
      </div>
      <div className="flex-1 overflow-auto p-4">
        <div className="mx-auto max-w-2xl space-y-4">
          {Array.from({ length: 2 }).map((_, i) => (
            <div key={i} className="rounded-md border border-border p-4 space-y-3">
              <div className="h-4 w-32 animate-pulse rounded bg-muted" />
              <div className="h-9 w-full animate-pulse rounded bg-muted" />
              <div className="h-9 w-32 animate-pulse rounded bg-muted" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
