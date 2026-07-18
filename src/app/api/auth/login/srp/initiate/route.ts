/**
 * SRP 登录第一步 API (initiate)
 *
 * POST /api/auth/login/srp/initiate
 *
 * 流程：
 *   1. 客户端生成临时密钥对 A，发送 { email, clientPublicEphemeral: A.public }
 *   2. 服务端查找用户的 srp_salt + srp_verifier
 *   3. 生成服务端临时密钥对 B = generateEphemeral(verifier)
 *   4. 存储临时会话 { user_id, clientPublicEphemeral, serverSecretEphemeral }（5 分钟过期）
 *   5. 返回 { srpSalt, serverPublicEphemeral: B.public }
 *
 * 防枚举（SEC-10）：用户不存在时返回随机 salt + 随机 B，使攻击者无法判断邮箱是否注册。
 */
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { db } from '@/lib/db';
import * as srpServer from 'secure-remote-password/server';
import { generateSalt, generateEphemeral as clientGenerateEphemeral } from 'secure-remote-password/client';
import type { SrpInitiateResponse } from '@/types/api';

const initiateSchema = z.object({
  email: z.string().trim().email('邮箱格式无效'),
  clientPublicEphemeral: z.string().min(1, 'clientPublicEphemeral 不能为空'),
});

export async function POST(request: NextRequest): Promise<NextResponse> {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: '请求体不是合法 JSON' }, { status: 400 });
  }

  try {
    const parsed = initiateSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: '请求参数无效', code: 'INVALID_PARAMS' },
        { status: 400 },
      );
    }

    const { email, clientPublicEphemeral } = parsed.data;
    const emailNormalized = email.toLowerCase();

    // 查询用户 SRP 凭据
    const result = await db.query(
      'SELECT id, srp_salt, srp_verifier FROM users WHERE email_normalized = $1',
      [emailNormalized],
    );

    // 防枚举：用户不存在时返回随机 salt + 随机 B
    if (result.rows.length === 0 || !result.rows[0].srp_verifier) {
      const randomSalt = generateSalt();
      const randomEphemeral = clientGenerateEphemeral();
      const response: SrpInitiateResponse = {
        srpSalt: randomSalt,
        serverPublicEphemeral: randomEphemeral.public,
      };
      return NextResponse.json(response, { status: 200 });
    }

    const user = result.rows[0];
    const srpSalt = user.srp_salt as string;
    const srpVerifier = user.srp_verifier as string;

    // 生成服务端临时密钥对
    const serverEphemeral = srpServer.generateEphemeral(srpVerifier);

    // 存储 SRP 临时会话（5 分钟过期，由表定义默认值保证）
    await db.query(
      `INSERT INTO srp_sessions (user_id, client_public_ephemeral, server_secret_ephemeral)
       VALUES ($1, $2, $3)`,
      [user.id as string, clientPublicEphemeral, serverEphemeral.secret],
    );

    // 惰性清理过期会话（不影响主流程）
    db.query('DELETE FROM srp_sessions WHERE expires_at < NOW()').catch(() => {});

    const response: SrpInitiateResponse = {
      srpSalt,
      serverPublicEphemeral: serverEphemeral.public,
    };
    return NextResponse.json(response, { status: 200 });
  } catch (err) {
    console.error('[srp/initiate] 未预期错误:', err instanceof Error ? err.message : '未知错误');
    return NextResponse.json(
      { error: '服务器内部错误', code: 'INTERNAL_ERROR' },
      { status: 500 },
    );
  }
}
