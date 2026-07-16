import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

/**
 * CSP nonce 中间件
 *
 * 为每个请求生成随机 nonce，设置到 CSP 头和请求头中，
 * Next.js 会自动将 nonce 添加到内联脚本标签上，
 * 使其在 CSP 策略下合法执行。
 *
 * 替代 'unsafe-inline'，保持安全性同时兼容 Next.js 水合。
 */
export function middleware(request: NextRequest) {
  const nonce = Buffer.from(crypto.randomUUID()).toString('base64')

  // 开发模式下 React 需要 'unsafe-eval' 来重建调用栈等调试功能
  const isDev = process.env.NODE_ENV === 'development'

  const csp = [
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
  ].join('; ')

  const requestHeaders = new Headers(request.headers)
  requestHeaders.set('x-nonce', nonce)

  const response = NextResponse.next({
    request: { headers: requestHeaders },
  })

  response.headers.set('Content-Security-Policy', csp)
  return response
}

export const config = {
  matcher: ['/((?!api|_next/static|_next/image|favicon.ico).*)'],
}
