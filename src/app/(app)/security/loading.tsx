/**
 * 安全中心路由 loading 骨架屏 (UX-045)
 */
export default function SecurityLoading() {
  return (
    <div className="flex h-full flex-col">
      <div className="border-b border-border px-4 py-3">
        <div className="h-4 w-32 animate-pulse rounded bg-muted" />
      </div>
      <div className="flex-1 overflow-auto p-4">
        <div className="mx-auto max-w-3xl space-y-4">
          {/* 安全评分骨架 */}
          <div className="h-32 animate-pulse rounded-md border border-border bg-muted/40" />
          {/* 列表卡片骨架 */}
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="rounded-md border border-border p-4">
              <div className="mb-3 h-4 w-40 animate-pulse rounded bg-muted" />
              <div className="space-y-2">
                {Array.from({ length: 3 }).map((_, j) => (
                  <div key={j} className="flex items-center gap-3">
                    <div className="h-4 w-4 shrink-0 animate-pulse rounded bg-muted" />
                    <div className="h-3.5 flex-1 animate-pulse rounded bg-muted" />
                    <div className="h-3.5 w-20 animate-pulse rounded bg-muted" />
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
