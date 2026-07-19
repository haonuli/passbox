/**
 * 内存级速率限制器 (L6 修复)
 *
 * 用于 auth API 路由（SRP / 登录 / 注册 / 恢复 / 2FA）防暴力破解。
 * 与数据库层账户锁定（5 次失败后锁 15 分钟）互补：
 * - 账户锁定保护单个账户
 * - 速率限制保护单 IP 对多账户的扫描攻击（防枚举 + 防撞库）
 *
 * 实现：滑动窗口 + in-memory Map。仅适用于单实例部署，
 * 多实例部署需替换为 Redis 共享存储（参见注释末尾的扩展指引）。
 *
 * 使用：
 * ```ts
 * import { getClientIp, rateLimit } from '@/lib/rate-limit';
 *
 * const ip = getClientIp(request);
 * const { ok, retryAfter } = rateLimit(`srp-initiate:${ip}:${email}`, {
 *   windowMs: 60_000,
 *   max: 10,
 * });
 * if (!ok) {
 *   return NextResponse.json(
 *     { error: '请求过于频繁，请稍后重试', code: 'RATE_LIMITED' },
 *     { status: 429, headers: { 'Retry-After': String(retryAfter) } },
 *   );
 * }
 * ```
 *
 * 扩展指引（多实例部署）：
 * - 替换为 Redis INCR + EXPIRE 实现：`INCR key` → 若为 1 则 `EXPIRE key windowSec`
 * - 或使用 @upstash/ratelimit（提供 REST 限流，serverless 友好）
 * - key 仍按 `${route}:${ip}:${email}` 设计，跨实例共享
 */

/** 速率限制配置 */
export interface RateLimitOptions {
  /** 窗口大小（毫秒） */
  windowMs: number;
  /** 窗口内最大请求数 */
  max: number;
}

/** 速率限制检查结果 */
export interface RateLimitResult {
  /** 是否允许通过 */
  ok: boolean;
  /** 剩余可用请求数（ok=false 时为 0） */
  remaining: number;
  /** 重试等待秒数（ok=false 时返回，便于设置 Retry-After 头） */
  retryAfter: number;
}

/** key → 时间戳数组（窗口内每次请求的时间） */
const buckets = new Map<string, number[]>();

/** 上次清理时间，定期扫描过期 key 释放内存 */
let lastCleanupAt = 0;
/** 清理间隔（10 分钟） */
const CLEANUP_INTERVAL_MS = 10 * 60 * 1000;

/**
 * 速率限制检查。
 *
 * 滑动窗口算法：保留窗口内每次请求的时间戳，每次检查时移除过期时间戳，
 * 若剩余时间戳数 < max 则允许通过并追加新时间戳，否则拒绝。
 *
 * @param key 限流键，建议格式 `${route}:${ip}:${email}` 或 `${route}:${ip}`
 * @param options 限流配置
 * @returns 检查结果（ok=false 时含 retryAfter）
 */
export function rateLimit(
  key: string,
  options: RateLimitOptions,
): RateLimitResult {
  const now = Date.now();
  const windowStart = now - options.windowMs;

  // 惰性清理：每 10 分钟扫描一次过期 key，避免 Map 无限增长
  if (now - lastCleanupAt > CLEANUP_INTERVAL_MS) {
    for (const [k, timestamps] of buckets) {
      const filtered = timestamps.filter((t) => t > now - options.windowMs);
      if (filtered.length === 0) {
        buckets.delete(k);
      } else {
        buckets.set(k, filtered);
      }
    }
    lastCleanupAt = now;
  }

  const timestamps = buckets.get(key) ?? [];
  // 移除过期时间戳（滑动窗口）
  const valid = timestamps.filter((t) => t > windowStart);

  if (valid.length >= options.max) {
    // 最早的一次请求时间 → 距离窗口过期还需多久
    const oldest = valid[0] ?? now;
    const retryAfterMs = oldest + options.windowMs - now;
    return {
      ok: false,
      remaining: 0,
      retryAfter: Math.max(1, Math.ceil(retryAfterMs / 1000)),
    };
  }

  // 允许通过：追加本次请求时间戳
  valid.push(now);
  buckets.set(key, valid);

  return {
    ok: true,
    remaining: options.max - valid.length,
    retryAfter: 0,
  };
}

/**
 * 从 NextRequest 提取客户端 IP。
 *
 * 优先级：
 * 1. x-forwarded-for 首个 IP（代理转发链）
 * 2. x-real-ip（Nginx / 反向代理常用）
 * 3. fallback 'unknown'（无法识别时仍按共享桶限流，但保护作用减弱）
 *
 * @param request NextRequest 对象
 * @returns 客户端 IP 字符串
 */
export function getClientIp(request: Request): string {
  const xff = request.headers.get('x-forwarded-for');
  if (xff) {
    const firstIp = xff.split(',')[0]?.trim();
    if (firstIp) return firstIp;
  }
  const xRealIp = request.headers.get('x-real-ip');
  if (xRealIp) return xRealIp.trim();
  return 'unknown';
}

/**
 * 速率限制响应构造器（统一返回 429 + Retry-After 头）。
 *
 * 使用：
 * ```ts
 * const limited = checkAuthRateLimit(request, email);
 * if (limited) return limited; // 直接返回 429 响应
 * ```
 *
 * @param route 路由标识（用于限流 key 与日志）
 * @param ip 客户端 IP
 * @param email 用户邮箱（可选，未提供时仅按 IP 限流）
 * @param options 限流配置
 * @returns 429 NextResponse 或 null（允许通过）
 */
export function checkRateLimit(
  route: string,
  ip: string,
  email?: string,
  options: RateLimitOptions = { windowMs: 60_000, max: 10 },
): { ok: true } | { ok: false; retryAfter: number } {
  const key = email ? `${route}:${ip}:${email.toLowerCase()}` : `${route}:${ip}`;
  const result = rateLimit(key, options);
  if (result.ok) {
    return { ok: true };
  }
  return { ok: false, retryAfter: result.retryAfter };
}

/** 仅用于测试：清空所有限流桶 */
export function __resetRateLimitForTests(): void {
  buckets.clear();
  lastCleanupAt = 0;
}
