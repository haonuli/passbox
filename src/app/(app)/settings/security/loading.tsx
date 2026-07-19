/**
 * 安全设置路由 loading 骨架屏 (UX-045)
 */
export default function SecuritySettingsLoading() {
  return (
    <div className="flex h-full flex-col">
      <div className="border-b border-border px-4 py-3">
        <div className="h-4 w-24 animate-pulse rounded bg-muted" />
      </div>
      <div className="flex-1 overflow-auto p-4">
        <div className="mx-auto max-w-2xl space-y-4">
          <div className="rounded-md border border-border p-4 space-y-3">
            <div className="h-4 w-20 animate-pulse rounded bg-muted" />
            <div className="flex items-center justify-between">
              <div className="space-y-1.5">
                <div className="h-3.5 w-28 animate-pulse rounded bg-muted" />
                <div className="h-2.5 w-48 animate-pulse rounded bg-muted" />
              </div>
              <div className="h-6 w-11 animate-pulse rounded-full bg-muted" />
            </div>
          </div>
          <div className="rounded-md border border-border p-4 space-y-3">
            <div className="h-4 w-32 animate-pulse rounded bg-muted" />
            <div className="space-y-2">
              {Array.from({ length: 3 }).map((_, i) => (
                <div key={i} className="h-3 w-full animate-pulse rounded bg-muted" />
              ))}
            </div>
            <div className="h-9 w-32 animate-pulse rounded bg-muted" />
          </div>
        </div>
      </div>
    </div>
  );
}
