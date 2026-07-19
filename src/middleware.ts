import { NextResponse, type NextRequest } from 'next/server';
import { SESSION_COOKIE_NAME, verifySession } from '@/lib/session';

/**
 * 认证守卫 + 安全头中间件（M-1 修复）
 *
 * 职责：
 * 1. 路由守卫：
 *    - 未认证访问 (app)/* 受保护路由 → 307 重定向到 /login?redirect=...
 *    - 已认证访问 (auth)/* 认证路由 → 307 重定向到 /vault
 *    - 未认证访问公开页面（/, /login, /register, /recover）→ 放行
 *    - 已认证访问 (app)/* → 放行
 *
 * 2. 安全头注入：
 *    - CSP（含 nonce 用于 Next.js 内联脚本）
 *    - X-Frame-Options: DENY（防点击劫持）
 *    - X-Content-Type-Options: nosniff（防 MIME 嗅探）
 *    - Referrer-Policy: strict-origin-when-cross-origin
 *    - Permissions-Policy: 禁用摄像头/麦克风/定位
 *    - HSTS（仅生产环境）
 *
 * 3. defense in depth：
 *    - 中间件是第一道防线，(app)/layout.tsx 的 getVerifiedSession 是第二道
 *    - 中间件使用 Edge 兼容的 verifySession（仅 JWT 验签，无 DB 查询）
 *    - Server Component 通过 token_version 校验补充撤销机制
 *
 * 设计参考：tests/integration/middleware.test.ts 中的验收标准
 */

/** 受保护的 (app) 路由组前缀，未认证访问需重定向到 /login */
const PROTECTED_PREFIXES = [
  '/vault',
  '/unlock',
  '/security',
  '/generator',
  '/settings',
  '/items',
  '/share',
];

/** 认证路由前缀，已认证访问需重定向到 /vault */
const AUTH_PATHS = new Set(['/login', '/register', '/recover']);

/** 公开页面路径，无需任何认证检查 */
const PUBLIC_PATHS = new Set(['/', '/favicon.ico']);

/** HSTS 头（仅生产环境注入） */
function buildHsts(): string | null {
  if (process.env.NODE_ENV !== 'production') return null;
  return 'max-age=63072000; includeSubDomains; preload';
}

/** 构建 CSP 字符串 */
function buildCsp(nonce: string): string {
  // 开发模式下 React 需要 'unsafe-eval' 来重建调用栈等调试功能
  const isDev = process.env.NODE_ENV === 'development';

  // M6 评估结论：style-src 暂保留 'unsafe-inline'。
  // - 移除 'unsafe-inline' 改用 nonce 需要将所有内联 style={{}} 迁移到 CSS 类或 CSS 变量，
  //   但 shadcn/ui、Radix UI（Dialog/Popover/Tooltip 动画）、Sonner（toast 定位）、
  //   next/image（图片尺寸）均依赖运行时内联样式，迁移成本与回归风险均较高。
  // - 安全收益边际：CSS 无法执行任意代码，仅存在 CSS 注入/数据外泄（如属性选择器泄露）风险，
  //   而本应用不渲染用户可控的原始 HTML，且已对用户输入做 zod 校验，CSS 注入面有限。
  // - 后续若要收紧，可逐步：(1) 审计所有 style={{}} 使用 → 替换为 CSS 变量；
  //   (2) 为第三方库的内联样式包裹 nonce； (3) 切换 style-src 'self' 'nonce-xxx'。
  return [
    "default-src 'self'",
    `script-src 'self' 'nonce-${nonce}' 'wasm-unsafe-eval'${isDev ? " 'unsafe-eval'" : ''}`,
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: https:",
    "connect-src 'self' https://api.pwnedpasswords.com",
    "font-src 'self'",
    "object-src 'none'",
    "base-uri 'self'",
    "frame-ancestors 'none'",
    "form-action 'self'",
    "upgrade-insecure-requests",
  ].join('; ');
}

/** 为响应注入所有安全头（包括重定向响应） */
function applySecurityHeaders(
  response: NextResponse,
  nonce: string,
): void {
  response.headers.set('Content-Security-Policy', buildCsp(nonce));
  response.headers.set('X-Frame-Options', 'DENY');
  response.headers.set('X-Content-Type-Options', 'nosniff');
  response.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');
  response.headers.set(
    'Permissions-Policy',
    'camera=(), microphone=(), geolocation=()',
  );
  const hsts = buildHsts();
  if (hsts) {
    response.headers.set('Strict-Transport-Security', hsts);
  }
}

/** 判断路径是否属于受保护路由 */
function isProtectedPath(pathname: string): boolean {
  return PROTECTED_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`),
  );
}

export async function middleware(request: NextRequest): Promise<NextResponse> {
  const nonce = Buffer.from(crypto.randomUUID()).toString('base64');
  const { pathname, searchParams } = request.nextUrl;

  // 公开页面：直接放行（仍注入安全头）
  if (PUBLIC_PATHS.has(pathname)) {
    const response = NextResponse.next({
      request: { headers: new Headers(request.headers) },
    });
    response.headers.set('x-nonce', nonce);
    applySecurityHeaders(response, nonce);
    return response;
  }

  // 检查会话有效性（Edge 兼容，仅 JWT 验签，无 DB 查询）
  const sessionToken = request.cookies.get(SESSION_COOKIE_NAME)?.value;
  const session = await verifySession(sessionToken);
  const isAuthenticated = session !== null;

  // 防重定向循环：JWT 签名有效但 token_version 已失效（登出/改密后）的场景
  // (app)/layout.tsx 会 redirect 到 /login?session=invalid，此处检测该参数并：
  // 1. 清除已失效的 session cookie
  // 2. 放行到 /login 页面（不再因"已认证访问 (auth) 路由"重定向回 /vault）
  if (searchParams.get('session') === 'invalid' && AUTH_PATHS.has(pathname)) {
    const response = NextResponse.next({
      request: { headers: new Headers(request.headers) },
    });
    response.headers.set('x-nonce', nonce);
    applySecurityHeaders(response, nonce);
    // 清除已失效的 cookie，避免再次进入循环
    response.cookies.delete(SESSION_COOKIE_NAME);
    return response;
  }

  // 已认证用户访问 (auth) 路由 → 重定向到 /vault
  if (isAuthenticated && AUTH_PATHS.has(pathname)) {
    const redirectUrl = request.nextUrl.clone();
    redirectUrl.pathname = '/vault';
    redirectUrl.search = '';
    const response = NextResponse.redirect(redirectUrl, 307);
    applySecurityHeaders(response, nonce);
    return response;
  }

  // 未认证用户访问受保护路由 → 重定向到 /login?redirect=...
  if (!isAuthenticated && isProtectedPath(pathname)) {
    const redirectUrl = request.nextUrl.clone();
    redirectUrl.pathname = '/login';
    redirectUrl.search = `?redirect=${encodeURIComponent(pathname)}`;
    const response = NextResponse.redirect(redirectUrl, 307);
    applySecurityHeaders(response, nonce);
    return response;
  }

  // 默认放行（认证页面、已认证访问受保护路由等）
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set('x-nonce', nonce);

  const response = NextResponse.next({
    request: { headers: requestHeaders },
  });
  applySecurityHeaders(response, nonce);
  return response;
}

export const config = {
  // 排除 API、静态资源、favicon；其余路径都进入中间件
  matcher: ['/((?!api|_next/static|_next/image|favicon.ico).*)'],
};
