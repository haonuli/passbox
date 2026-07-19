/**
 * 密码生成器路由 loading 骨架屏 (UX-045)
 */
export default function GeneratorLoading() {
  return (
    <div className="flex h-full flex-col">
      <div className="border-b border-border px-4 py-3">
        <div className="h-4 w-32 animate-pulse rounded bg-muted" />
      </div>
      <div className="flex-1 overflow-auto p-4">
        <div className="mx-auto max-w-xl space-y-4">
          {/* 密码预览骨架 */}
          <div className="h-16 animate-pulse rounded-md border border-border bg-muted/40" />
          {/* 强度指示骨架 */}
          <div className="h-2 w-full animate-pulse rounded bg-muted" />
          {/* 选项卡片骨架 */}
          <div className="space-y-3 rounded-md border border-border p-4">
            <div className="h-4 w-24 animate-pulse rounded bg-muted" />
            <div className="h-9 w-full animate-pulse rounded bg-muted" />
            <div className="h-9 w-full animate-pulse rounded bg-muted" />
            <div className="h-9 w-full animate-pulse rounded bg-muted" />
            <div className="h-9 w-full animate-pulse rounded bg-muted" />
          </div>
        </div>
      </div>
    </div>
  );
}
