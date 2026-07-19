/**
 * 恢复码重置 API (T3.8 阶段二)
 *
 * POST /api/auth/recover
 *
 * 客户端在阶段一解密 Symmetric Key 后，用新主密码重新加密，提交：
 *   { email, recoveryCode, newAuthHash, newEncryptedKey, newKdfSalt, newKdfParams,
 *     newRecoveryCode, newRecoveryEncryptedKey }
 *
 * 服务端再次 bcrypt.compare 验证恢复码（独立验证，不依赖阶段一状态），
 * 验证通过后更新 password_hash / encrypted_key / kdf_salt / kdf_params，
 * 并签发新会话 Cookie。Symmetric Key 不变，所有历史条目仍可解密。
 *
 * 安全机制：
 * - 防枚举：邮箱不存在时 dummy bcrypt 均衡时间，统一"恢复码无效"
 * - 重置后清空 failed_login_attempts / locked_until
 * - M-15：恢复码轮换 — 旧 recovery_code_hash / recovery_encrypted_key 被新值替换，
 *   旧恢复码立即失效，防止恢复码被重复利用
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
import { logApiError } from '@/lib/api-log';
import { checkRateLimit, getClientIp } from '@/lib/rate-limit';
import type { RecoverResponse } from '@/types/api';

/** 防枚举用的 dummy bcrypt 哈希（模块加载时生成一次） */
const DUMMY_RECOVERY_HASH = bcrypt.hashSync('dummy-recovery-code-for-timing', 10);

/**
 * 恢复重置请求 zod schema
 *
 * M-7：newKdfSalt 强制 base64 + 16 字节校验
 * M-8：newKdfParams 强制最低安全阈值
 * M-15：newRecoveryCode + newRecoveryEncryptedKey 恢复码轮换
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
  newRecoveryCode: z
    .string()
    .min(1)
    .refine(isValidRecoveryCodeFormat, '新恢复码格式无效'),
  newRecoveryEncryptedKey: encryptedDataSchema,
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

  let email: string | undefined;
  try {
    const parsed = recoverSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message ?? '请求参数无效', code: 'INVALID_PARAMS' },
        { status: 400 },
      );
    }

    const {
      recoveryCode,
      newAuthHash,
      newEncryptedKey,
      newKdfSalt,
      newKdfParams,
      newRecoveryCode,
      newRecoveryEncryptedKey,
    } = parsed.data;
    ({ email } = parsed.data);
    const emailNormalized = email.toLowerCase();

    // L6 速率限制：每 IP+email 每分钟最多 5 次（密码重置敏感度高）
    const ip = getClientIp(request);
    const limited = checkRateLimit('recover', ip, email, {
      windowMs: 60_000,
      max: 5,
    });
    if (!limited.ok) {
      return NextResponse.json(
        { error: '请求过于频繁，请稍后重试', code: 'RATE_LIMITED' },
        { status: 429, headers: { 'Retry-After': String(limited.retryAfter) } },
      );
    }

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

    // 验证通过：重置主密码 + 轮换恢复码（M-15），递增 token_version 撤销旧会话（M-9）
    const newPasswordHash = await bcrypt.hash(newAuthHash, 10);
    const newRecoveryCodeHash = await bcrypt.hash(newRecoveryCode, 10);

    const updateResult = await db.query(
      `UPDATE users
       SET password_hash = $1,
           encrypted_key = $2,
           kdf_salt = $3,
           kdf_memory_kib = $4,
           kdf_iterations = $5,
           kdf_parallelism = $6,
           recovery_code_hash = $7,
           recovery_encrypted_key = $8,
           failed_login_attempts = 0,
           locked_until = NULL,
           token_version = token_version + 1,
           updated_at = NOW()
       WHERE id = $9
       RETURNING token_version`,
      [
        newPasswordHash,
        JSON.stringify(newEncryptedKey),
        Buffer.from(newKdfSalt, 'base64'),
        newKdfParams.memoryKib,
        newKdfParams.iterations,
        newKdfParams.parallelism,
        newRecoveryCodeHash,
        JSON.stringify(newRecoveryEncryptedKey),
        user.id,
      ],
    );
    const newTokenVersion = updateResult.rows[0].token_version as number;

    // 签发新会话（使用递增后的 token_version）
    const token = await createSession(user.id as string, user.email as string, newTokenVersion);

    const response: RecoverResponse = {
      user: { id: user.id as string, email: user.email as string },
      recoveryCode: newRecoveryCode,
    };
    const res = NextResponse.json(response, { status: 200 });
    res.cookies.set(SESSION_COOKIE_NAME, token, SESSION_COOKIE_OPTIONS);
    return res;
  } catch (err) {
    // M-6：兜底未预期异常，避免泄漏内部错误细节
    logApiError('recover', err, { email });
    return NextResponse.json(
      { error: '服务器内部错误', code: 'INTERNAL_ERROR' },
      { status: 500 },
    );
  }
}
