/**
 * 新建条目路由 loading 骨架屏 (UX-045)
 */
export default function NewItemLoading() {
  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center gap-2 border-b border-border px-4 py-3">
        <div className="h-8 w-8 animate-pulse rounded bg-muted" />
        <div className="h-4 w-24 animate-pulse rounded bg-muted" />
      </div>
      <div className="flex-1 space-y-4 overflow-auto p-4">
        <div className="mx-auto max-w-xl space-y-4">
          {/* 表单分组骨架 */}
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="space-y-3 rounded-md border border-border p-4">
              <div className="h-4 w-20 animate-pulse rounded bg-muted" />
              <div className="space-y-2">
                <div className="h-3 w-12 animate-pulse rounded bg-muted" />
                <div className="h-9 w-full animate-pulse rounded bg-muted" />
              </div>
              <div className="space-y-2">
                <div className="h-3 w-12 animate-pulse rounded bg-muted" />
                <div className="h-9 w-full animate-pulse rounded bg-muted" />
              </div>
            </div>
          ))}
          {/* 提交按钮骨架 */}
          <div className="flex justify-end gap-2">
            <div className="h-9 w-16 animate-pulse rounded bg-muted" />
            <div className="h-9 w-20 animate-pulse rounded bg-muted" />
          </div>
        </div>
      </div>
    </div>
  );
}
