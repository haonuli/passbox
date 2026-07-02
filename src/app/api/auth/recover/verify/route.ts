/**
 * 恢复码验证 API (T3.8 阶段一)
 *
 * POST /api/auth/recover/verify
 *
 * 客户端提交邮箱 + 恢复码，服务端 bcrypt.compare 验证恢复码后返回
 * recovery_encrypted_key。客户端用 Recovery Key（从恢复码 HKDF 派生）解密得到
 * Symmetric Key，再用新主密码重新加密。
 *
 * 安全机制：
 * - 防枚举（SEC-10）：邮箱不存在时执行 dummy bcrypt.compare 均衡响应时间，
 *   统一返回"恢复码无效"，不区分"邮箱不存在"与"恢复码错误"
 * - 恢复码仅存 bcrypt 哈希（recovery_code_hash），明文不落库
 *
 * @see TECHNICAL_DESIGN.md 3.3.1 恢复码密钥路径
 */
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import bcrypt from 'bcrypt';
import { db } from '@/lib/db';
import { isValidRecoveryCodeFormat } from '@/lib/recovery-code';
import type { RecoverVerifyResponse } from '@/types/api';
import type { EncryptedData } from '@/types/crypto';

/** 防枚举用的 dummy bcrypt 哈希（模块加载时生成一次，均衡邮箱不存在时的响应时间） */
const DUMMY_RECOVERY_HASH = bcrypt.hashSync('dummy-recovery-code-for-timing', 10);

const verifySchema = z.object({
  email: z.string().trim().email('邮箱格式无效'),
  recoveryCode: z
    .string()
    .min(1)
    .refine(isValidRecoveryCodeFormat, '恢复码格式无效'),
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
    const parsed = verifySchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message ?? '请求参数无效', code: 'INVALID_PARAMS' },
        { status: 400 },
      );
    }

    const { email, recoveryCode } = parsed.data;
    const emailNormalized = email.toLowerCase();

    const result = await db.query(
      'SELECT id, email, recovery_code_hash, recovery_encrypted_key FROM users WHERE email_normalized = $1',
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

    const recoveryEncryptedKey = JSON.parse(
      user.recovery_encrypted_key as string,
    ) as EncryptedData;

    const response: RecoverVerifyResponse = {
      user: { id: user.id as string, email: user.email as string },
      recoveryEncryptedKey,
    };
    return NextResponse.json(response, { status: 200 });
  } catch (err) {
    // M-6：兜底未预期异常，避免泄漏内部错误细节
    console.error('[recover/verify] 未预期错误:', err instanceof Error ? err.message : '未知错误');
    return NextResponse.json(
      { error: '服务器内部错误', code: 'INTERNAL_ERROR' },
      { status: 500 },
    );
  }
}
