/**
 * 恢复码重置 API (T3.8 阶段二)
 *
 * POST /api/auth/recover
 *
 * 客户端在阶段一解密 Symmetric Key 后，用新主密码重新加密，提交：
 *   { email, recoveryCode, newAuthHash, newEncryptedKey, newKdfSalt, newKdfParams }
 *
 * 服务端再次 bcrypt.compare 验证恢复码（独立验证，不依赖阶段一状态），
 * 验证通过后更新 password_hash / encrypted_key / kdf_salt / kdf_params，
 * 并签发新会话 Cookie。Symmetric Key 不变，所有历史条目仍可解密。
 *
 * 安全机制：
 * - 防枚举：邮箱不存在时 dummy bcrypt 均衡时间，统一"恢复码无效"
 * - 重置后清空 failed_login_attempts / locked_until
 * - recovery_code_hash / recovery_encrypted_key 不变（恢复码仍可用，轮换为可选增强）
 *
 * @see TECHNICAL_DESIGN.md 3.3.1 恢复码密钥路径
 */
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import bcrypt from 'bcrypt';
import { db } from '@/lib/db';
import { isValidRecoveryCodeFormat } from '@/lib/recovery-code';
import { encryptedDataSchema, kdfParamsSchema, kdfSaltSchema } from '@/lib/schemas';
import {
  createSession,
  SESSION_COOKIE_NAME,
  SESSION_COOKIE_OPTIONS,
} from '@/lib/session';
import type { RecoverResponse } from '@/types/api';

/** 防枚举用的 dummy bcrypt 哈希（模块加载时生成一次） */
const DUMMY_RECOVERY_HASH = bcrypt.hashSync('dummy-recovery-code-for-timing', 10);

/**
 * 恢复重置请求 zod schema
 *
 * M-7：newKdfSalt 强制 base64 + 16 字节校验
 * M-8：newKdfParams 强制最低安全阈值
 */
const recoverSchema = z.object({
  email: z.string().trim().email('邮箱格式无效'),
  recoveryCode: z
    .string()
    .min(1)
    .refine(isValidRecoveryCodeFormat, '恢复码格式无效'),
  newAuthHash: z.string().min(1, 'newAuthHash 不能为空'),
  newEncryptedKey: encryptedDataSchema,
  newKdfSalt: kdfSaltSchema,
  newKdfParams: kdfParamsSchema,
});

/** 统一错误信息（不区分邮箱不存在 vs 恢复码错误） */
const INVALID_RECOVERY_ERROR = '恢复码无效';

export async function POST(request: NextRequest): Promise<NextResponse> {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: '请求体不是合法 JSON' }, { status: 400 });
  }

  try {
    const parsed = recoverSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message ?? '请求参数无效', code: 'INVALID_PARAMS' },
        { status: 400 },
      );
    }

    const { email, recoveryCode, newAuthHash, newEncryptedKey, newKdfSalt, newKdfParams } =
      parsed.data;
    const emailNormalized = email.toLowerCase();

    const result = await db.query(
      'SELECT id, email, recovery_code_hash FROM users WHERE email_normalized = $1',
      [emailNormalized],
    );

    // 防枚举：邮箱不存在时执行 dummy bcrypt 均衡时间
    if (result.rows.length === 0) {
      await bcrypt.compare(recoveryCode, DUMMY_RECOVERY_HASH);
      return NextResponse.json(
        { error: INVALID_RECOVERY_ERROR, code: 'INVALID_RECOVERY_CODE' },
        { status: 401 },
      );
    }

    const user = result.rows[0];

    const isMatch = await bcrypt.compare(recoveryCode, user.recovery_code_hash as string);
    if (!isMatch) {
      return NextResponse.json(
        { error: INVALID_RECOVERY_ERROR, code: 'INVALID_RECOVERY_CODE' },
        { status: 401 },
      );
    }

    // 验证通过：重置主密码相关字段
    const newpasswordHash = await bcrypt.hash(newAuthHash, 10);

    await db.query(
      `UPDATE users
       SET password_hash = $1,
           encrypted_key = $2,
           kdf_salt = $3,
           kdf_memory_kib = $4,
           kdf_iterations = $5,
           kdf_parallelism = $6,
           failed_login_attempts = 0,
           locked_until = NULL,
           updated_at = NOW()
       WHERE id = $7`,
      [
        newpasswordHash,
        JSON.stringify(newEncryptedKey),
        Buffer.from(newKdfSalt, 'base64'),
        newKdfParams.memoryKib,
        newKdfParams.iterations,
        newKdfParams.parallelism,
        user.id,
      ],
    );

    // 签发新会话
    const token = await createSession(user.id as string, user.email as string);

    const response: RecoverResponse = {
      user: { id: user.id as string, email: user.email as string },
    };
    const res = NextResponse.json(response, { status: 200 });
    res.cookies.set(SESSION_COOKIE_NAME, token, SESSION_COOKIE_OPTIONS);
    return res;
  } catch (err) {
    // M-6：兜底未预期异常，避免泄漏内部错误细节
    console.error('[recover] 未预期错误:', err instanceof Error ? err.message : '未知错误');
    return NextResponse.json(
      { error: '服务器内部错误', code: 'INTERNAL_ERROR' },
      { status: 500 },
    );
  }
}
