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
  "script-src 'self' 'wasm-unsafe-eval'",
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
 * Next.js 中间件：路由守卫 + CSP 头注入。
 *
 * 执行顺序：
 * 1. 所有响应注入 CSP 安全头
 * 2. 路由守卫：未认证访问 (app)/* → 重定向 /login
 * 3. 路由守卫：已认证访问 (auth)/* → 重定向 /vault
 */
export async function middleware(request: NextRequest) {
  // 1. 路由守卫逻辑
  const { pathname } = request.nextUrl;
  const sessionToken = request.cookies.get(SESSION_COOKIE_NAME)?.value;
  const session = await verifySession(sessionToken);
  const isAuthenticated = session !== null;

  // 未认证访问受保护路由 → 重定向到登录页
  if (isProtectedPath(pathname) && !isAuthenticated) {
    const loginUrl = new URL('/login', request.url);
    loginUrl.searchParams.set('redirect', pathname);
    return NextResponse.redirect(loginUrl);
  }

  // 已认证访问认证路由 → 重定向到密码库
  if (isAuthPath(pathname) && isAuthenticated) {
    return NextResponse.redirect(new URL('/vault', request.url));
  }

  // 2. 注入 CSP 安全头
  const response = NextResponse.next();
  response.headers.set('Content-Security-Policy', CSP_HEADER);
  response.headers.set('X-Frame-Options', 'DENY');
  response.headers.set('X-Content-Type-Options', 'nosniff');
  response.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');
  response.headers.set('X-DNS-Prefetch-Control', 'off');
  response.headers.set('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');

  return response;
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
