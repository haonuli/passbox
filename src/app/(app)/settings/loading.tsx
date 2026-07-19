/**
 * 设置路由 loading 骨架屏 (UX-045)
 */
export default function SettingsLoading() {
  return (
    <div className="flex h-full flex-col">
      <div className="border-b border-border px-4 py-3">
        <div className="h-4 w-16 animate-pulse rounded bg-muted" />
      </div>
      <div className="flex-1 overflow-auto p-4">
        <div className="mx-auto max-w-2xl space-y-2">
          {Array.from({ length: 6 }).map((_, i) => (
            <div
              key={i}
              className="flex items-center gap-3 rounded-md border border-border p-3"
            >
              <div className="h-5 w-5 shrink-0 animate-pulse rounded bg-muted" />
              <div className="flex-1 space-y-1.5">
                <div className="h-3.5 w-32 animate-pulse rounded bg-muted" />
                <div className="h-2.5 w-48 animate-pulse rounded bg-muted" />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
