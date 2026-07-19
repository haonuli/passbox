/**
 * 预登录 API (T3.3)
 *
 * POST /api/auth/prelogin
 *
 * 客户端在登录/解锁前调用，获取该邮箱对应的 KDF 参数（salt + Argon2id 配置）。
 *
 * 防枚举（SEC-7）：email 不存在时返回随机 salt + 默认 KDF 参数，
 * 使攻击者无法通过响应差异判断邮箱是否注册。客户端照常派生 authHash 并发送到 login，
 * login 阶段统一返回"邮箱或主密码错误"，不区分 email 不存在 vs 密码错误。
 *
 * @see TECHNICAL_DESIGN.md 5.2.2（预登录 API 契约）+ 7.2（登录数据流）
 */
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { db } from '@/lib/db';
import { generateKdfSalt, DEFAULT_KDF_PARAMS } from '@/lib/crypto/kdf';
import { toBase64 } from '@/lib/crypto/encoding';
import { logApiError } from '@/lib/api-log';
import { checkRateLimit, getClientIp } from '@/lib/rate-limit';
import type { PreloginResponse } from '@/types/api';

const preloginSchema = z.object({
  email: z.string().trim().email('邮箱格式无效'),
});

export async function POST(request: NextRequest): Promise<NextResponse> {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: '请求体不是合法 JSON' }, { status: 400 });
  }

  let email: string | undefined;
  try {
    const parsed = preloginSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: '请求参数无效', code: 'INVALID_PARAMS' },
        { status: 400 },
      );
    }

    ({ email } = parsed.data);
    const emailNormalized = email.toLowerCase();

    // L6 速率限制：每 IP+email 每分钟最多 10 次（防枚举/扫描攻击）
    const ip = getClientIp(request);
    const limited = checkRateLimit('prelogin', ip, email, {
      windowMs: 60_000,
      max: 10,
    });
    if (!limited.ok) {
      return NextResponse.json(
        { error: '请求过于频繁，请稍后重试', code: 'RATE_LIMITED' },
        { status: 429, headers: { 'Retry-After': String(limited.retryAfter) } },
      );
    }

    // 查询用户 KDF 参数 + SRP salt
    const result = await db.query(
      'SELECT kdf_salt, kdf_memory_kib, kdf_iterations, kdf_parallelism, srp_salt FROM users WHERE email_normalized = $1',
      [emailNormalized],
    );

    if (result.rows.length === 0) {
      // 防枚举：email 不存在时返回随机 salt + 默认 KDF 参数
      const randomSalt = toBase64(generateKdfSalt());
      const response: PreloginResponse = {
        kdfSalt: randomSalt,
        kdfParams: DEFAULT_KDF_PARAMS,
        srpSalt: '',
      };
      return NextResponse.json(response, { status: 200 });
    }

    const user = result.rows[0];
    const response: PreloginResponse = {
      kdfSalt: (user.kdf_salt as Buffer).toString('base64'),
      kdfParams: {
        type: 'argon2id',
        memoryKib: user.kdf_memory_kib as number,
        iterations: user.kdf_iterations as number,
        parallelism: user.kdf_parallelism as number,
      },
      srpSalt: (user.srp_salt as string | null) ?? '',
    };
    return NextResponse.json(response, { status: 200 });
  } catch (err) {
    // M-6：兜底未预期异常，避免泄漏内部错误细节
    logApiError('prelogin', err, { email });
    return NextResponse.json(
      { error: '服务器内部错误', code: 'INTERNAL_ERROR' },
      { status: 500 },
    );
  }
}
