/**
 * 解锁页路由 loading 骨架屏 (UX-045)
 */
export default function UnlockLoading() {
  return (
    <div className="flex flex-1 items-center justify-center px-6 py-12">
      <div className="w-full max-w-sm space-y-4">
        {/* 图标占位 */}
        <div className="mx-auto h-12 w-12 animate-pulse rounded-full bg-muted" />
        {/* 标题占位 */}
        <div className="mx-auto h-5 w-32 animate-pulse rounded bg-muted" />
        {/* 输入框占位 */}
        <div className="h-9 w-full animate-pulse rounded bg-muted" />
        {/* 按钮占位 */}
        <div className="h-9 w-full animate-pulse rounded bg-muted" />
      </div>
    </div>
  );
}
