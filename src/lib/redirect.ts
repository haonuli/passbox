/**
 * 重定向路径安全校验（M-2 修复）
 *
 * login-form / unlock-form / AuthGate 接收 `?redirect=` 查询参数后跳转，
 * 若直接 router.replace(redirect) 会形成开放重定向漏洞：
 * 攻击者构造 `?redirect=https://evil.com` 或 `?redirect=//evil.com`
 * 可在登录后将用户引向钓鱼站点。
 *
 * 本工具仅允许"同源相对路径"，规则：
 *   1. 必须以 `/` 开头（排除 http(s):、data:、javascript: 等绝对 URL）
 *   2. 不得以 `//` 或 `/\` 开头（协议相对 URL，部分浏览器会当作跨站）
 *   3. 解码后不得包含换行符（防 CRLF 头注入，理论上 router 不会透传但兜底）
 *
 * 不满足时回退到 fallback（默认 /vault）。
 */

/** 默认回退路径 */
const DEFAULT_FALLBACK = '/vault';

/**
 * 校验 redirect 参数，返回安全相对路径或 fallback。
 *
 * @param redirect 查询参数原始值（已由 URLSearchParams 解码）
 * @param fallback 校验失败时的回退路径（默认 /vault）
 * @returns 安全的同源相对路径
 */
export function getSafeRedirect(
  redirect: string | null | undefined,
  fallback: string = DEFAULT_FALLBACK,
): string {
  if (!redirect) {
    return fallback;
  }

  // 必须以单个 / 开头
  if (!redirect.startsWith('/')) {
    return fallback;
  }

  // 排除协议相对 URL：//evil.com 或 /\evil.com
  if (redirect.startsWith('//') || redirect.startsWith('/\\')) {
    return fallback;
  }

  // 排除换行符（CRLF 兜底）
  if (/[\r\n]/.test(redirect)) {
    return fallback;
  }

  return redirect;
}
