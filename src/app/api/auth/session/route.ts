/**
 * 会话查询 API (T3.3)
 *
 * GET /api/auth/session
 *
 * 已认证用户恢复会话时调用（如页面刷新后解锁）。验证会话 Cookie 有效后，
 * 返回 encryptedKey + KDF 参数，客户端用主密码重新派生 Master Key 解密 Symmetric Key。
 *
 * 与 login 的区别：session 不需要 authHash（用户已登录，只需重新解锁），
 * 仅验证 JWT Cookie 有效性。
 *
 * @see TECHNICAL_DESIGN.md 5.2.4
 */
import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { verifySession, SESSION_COOKIE_NAME } from '@/lib/session';
import { verifyTokenVersion } from '@/lib/auth-check';
import type { SessionResponse } from '@/types/api';
import type { EncryptedData } from '@/types/crypto';

export async function GET(request: NextRequest): Promise<NextResponse> {
  try {
    // 从请求 Cookie 读取 JWT 并验签
    const token = request.cookies.get(SESSION_COOKIE_NAME)?.value;
    const payload = await verifySession(token);

    if (!payload || !payload.sub) {
      return NextResponse.json(
        { error: '未登录或会话已过期', code: 'UNAUTHORIZED' },
        { status: 401 },
      );
    }

    const userId = payload.sub;

    // M-9：校验 token_version，登出 / 改密后旧 JWT 即使签名有效也拒绝
    const tokenValid = await verifyTokenVersion(userId, payload.ver);
    if (!tokenValid) {
      return NextResponse.json(
        { error: '会话已失效，请重新登录', code: 'SESSION_REVOKED' },
        { status: 401 },
      );
    }

    // 查询用户加密参数
    const result = await db.query(
      `SELECT email, encrypted_key, kdf_salt, kdf_memory_kib, kdf_iterations, kdf_parallelism,
              two_factor_enabled
       FROM users WHERE id = $1`,
      [userId],
    );

    if (result.rows.length === 0) {
      // 用户已被删除（但 JWT 仍有效）→ 返回 401
      return NextResponse.json(
        { error: '用户不存在', code: 'USER_NOT_FOUND' },
        { status: 401 },
      );
    }

    const user = result.rows[0];
    const encryptedKey = JSON.parse(user.encrypted_key as string) as EncryptedData;
    const response: SessionResponse = {
      user: { id: userId, email: user.email as string },
      encryptedKey,
      kdfSalt: (user.kdf_salt as Buffer).toString('base64'),
      kdfParams: {
        type: 'argon2id',
        memoryKib: user.kdf_memory_kib as number,
        iterations: user.kdf_iterations as number,
        parallelism: user.kdf_parallelism as number,
      },
      twoFactorEnabled: user.two_factor_enabled as boolean,
    };

    return NextResponse.json(response, { status: 200 });
  } catch (err) {
    // M-6：兜底未预期异常，避免泄漏内部错误细节
    console.error('[session] 未预期错误:', err instanceof Error ? err.message : '未知错误');
    return NextResponse.json(
      { error: '服务器内部错误', code: 'INTERNAL_ERROR' },
      { status: 500 },
    );
  }
}
