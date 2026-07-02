import { NextResponse, type NextRequest } from 'next/server';

import { SESSION_COOKIE_NAME, verifySession } from '@/lib/session';

/**
 * Content-Security-Policy 配置（技术方案 8.4 节）。
 *
 * 关键决策：
 * - script-src 'wasm-unsafe-eval'：libsodium WASM 模块需要 wasm-unsafe-eval
 * - style-src 'unsafe-inline'：Tailwind / shadcn 需要 inline style
 * - connect-src：仅允许同源 + HIBP 泄露检测 API
 * - frame-ancestors 'none'：禁止被嵌入 iframe（防点击劫持）
 */
const CSP_HEADER = [
  "default-src 'self'",
  // 开发模式需要 'unsafe-inline'（Next.js HMR + Turbopack 内联脚本）；生产模式应使用 nonce
  process.env.NODE_ENV === 'development'
    ? "script-src 'self' 'wasm-unsafe-eval' 'unsafe-inline'"
    : "script-src 'self' 'wasm-unsafe-eval'",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: https:",
  "connect-src 'self' https://api.pwnedpasswords.com",
  "font-src 'self'",
  "object-src 'none'",
  "base-uri 'self'",
  "frame-ancestors 'none'",
  "form-action 'self'",
  'upgrade-insecure-requests',
].join('; ');

/**
 * 需要认证才能访问的路径前缀（对应 (app) 路由组）。
 */
const PROTECTED_PATHS = ['/vault', '/items', '/security', '/generator', '/settings', '/unlock'];

/**
 * 已认证用户应跳过的路径（对应 (auth) 路由组）。
 * 已认证用户访问这些路径时重定向到 /vault。
 */
const AUTH_PATHS = ['/login', '/register', '/recover'];

function isProtectedPath(pathname: string): boolean {
  return PROTECTED_PATHS.some((p) => pathname === p || pathname.startsWith(`${p}/`));
}

function isAuthPath(pathname: string): boolean {
  return AUTH_PATHS.some((p) => pathname === p || pathname.startsWith(`${p}/`));
}

/**
 * 向任意响应注入安全响应头（M-10 修复）。
 *
 * 之前仅对 NextResponse.next() 注入，重定向响应会跳过安全头；
 * 现统一对重定向与正常响应都注入，避免重定向页面缺失 CSP/X-Frame-Options 等防护。
 *
 * HSTS（M-11）：仅生产环境注入。开发环境为 HTTP，浏览器本会忽略 HSTS，
 * 但部分浏览器会对 localhost 记忆 HSTS 导致开发受阻，故仅生产注入。
 */
function applySecurityHeaders(response: NextResponse): NextResponse {
  response.headers.set('Content-Security-Policy', CSP_HEADER);
  response.headers.set('X-Frame-Options', 'DENY');
  response.headers.set('X-Content-Type-Options', 'nosniff');
  response.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');
  response.headers.set('X-DNS-Prefetch-Control', 'off');
  response.headers.set('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
  if (process.env.NODE_ENV === 'production') {
    // HSTS：2 年 + 包含子域名 + 预加载列表。仅 HTTPS 生效，HTTP 浏览器忽略。
    response.headers.set(
      'Strict-Transport-Security',
      'max-age=63072000; includeSubDomains; preload',
    );
  }
  return response;
}

/**
 * Next.js 中间件：路由守卫 + CSP 头注入。
 *
 * 执行顺序：
 * 1. 路由守卫：未认证访问 (app)/* → 重定向 /login（携带 redirect）
 * 2. 路由守卫：已认证访问 (auth)/* → 重定向 /vault
 * 3. 所有响应（含重定向）注入 CSP 等安全头
 */
export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const sessionToken = request.cookies.get(SESSION_COOKIE_NAME)?.value;
  const session = await verifySession(sessionToken);
  const isAuthenticated = session !== null;

  // 未认证访问受保护路由 → 重定向到登录页
  if (isProtectedPath(pathname) && !isAuthenticated) {
    const loginUrl = new URL('/login', request.url);
    loginUrl.searchParams.set('redirect', pathname);
    return applySecurityHeaders(NextResponse.redirect(loginUrl));
  }

  // 已认证访问认证路由 → 重定向到密码库
  if (isAuthPath(pathname) && isAuthenticated) {
    return applySecurityHeaders(NextResponse.redirect(new URL('/vault', request.url)));
  }

  // 正常响应：注入安全头
  return applySecurityHeaders(NextResponse.next());
}

/**
 * Matcher：排除静态资源与 Next.js 内部路由。
 *
 * middleware 仅对页面路由和 API 路由触发，不对静态文件触发。
 */
export const config = {
  matcher: [
    /*
     * 匹配所有路径，但排除：
     * - _next/static (静态资源)
     * - _next/image (图片优化)
     * - favicon.ico, sitemap.xml, robots.txt (公共元数据)
     * - .*\\..* (任何含扩展名的文件)
     */
    '/((?!_next/static|_next/image|favicon.ico|sitemap.xml|robots.txt|.*\\..*).*)',
  ],
};
