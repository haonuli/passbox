/**
 * 关于页路由 loading 骨架屏 (UX-045)
 */
export default function AboutLoading() {
  return (
    <div className="flex h-full flex-col">
      <div className="border-b border-border px-4 py-3">
        <div className="h-4 w-28 animate-pulse rounded bg-muted" />
      </div>
      <div className="flex-1 overflow-auto p-4">
        <div className="mx-auto max-w-2xl space-y-4">
          <div className="rounded-md border border-border p-6 space-y-3">
            <div className="mx-auto h-12 w-12 animate-pulse rounded-full bg-muted" />
            <div className="mx-auto h-5 w-32 animate-pulse rounded bg-muted" />
            <div className="mx-auto h-3 w-20 animate-pulse rounded bg-muted" />
          </div>
          <div className="rounded-md border border-border p-4 space-y-3">
            <div className="h-4 w-24 animate-pulse rounded bg-muted" />
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="flex justify-between">
                <div className="h-3 w-24 animate-pulse rounded bg-muted" />
                <div className="h-3 w-32 animate-pulse rounded bg-muted" />
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
