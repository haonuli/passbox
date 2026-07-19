/**
 * API 错误日志辅助 (L4 修复)
 *
 * 统一 API 路由错误日志格式，补充 userId / path 等上下文，
 * 便于在日志系统中按用户/路由关联排查问题。
 *
 * 使用：
 * ```ts
 * let userId: string | undefined;
 * try {
 *   const session = await getVerifiedSession();
 *   userId = session?.sub;
 *   // ...
 * } catch (err) {
 *   logApiError('items/create', err, { userId });
 *   return NextResponse.json({ success: false, error: '服务器内部错误' }, { status: 500 });
 * }
 * ```
 */

/** 错误日志上下文 */
export interface ApiErrorContext {
  /** 当前用户 ID（如已认证） */
  userId?: string;
  /** 路径参数（如 :id 路由的实际值） */
  pathParam?: string;
  /** 其他自定义字段 */
  [key: string]: string | undefined;
}

/**
 * 记录 API 路由错误，统一格式：`[api:route] message context={...}`
 *
 * context 中的 undefined 字段会被过滤，避免日志噪音。
 *
 * @param route 路由标识，如 'items/create'、'vaults/[id]/patch'
 * @param err 捕获到的错误对象
 * @param context 上下文信息（userId 等）
 */
export function logApiError(route: string, err: unknown, context?: ApiErrorContext): void {
  const message = err instanceof Error ? err.message : '未知错误';

  // 过滤 undefined 值，避免日志噪音
  const filteredCtx: Record<string, string> = {};
  if (context) {
    for (const [key, value] of Object.entries(context)) {
      if (value !== undefined) {
        filteredCtx[key] = value;
      }
    }
  }

  const ctxStr = Object.keys(filteredCtx).length > 0 ? ` ctx=${JSON.stringify(filteredCtx)}` : '';
  console.error(`[api:${route}] 未预期错误:${ctxStr} ${message}`);
}
