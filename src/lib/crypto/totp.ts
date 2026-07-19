/**
 * TOTP 验证码生成模块 (T5.4)
 *
 * 基于 RFC 6238 实现 TOTP（Time-based One-Time Password）。
 * 给定 base32 密钥，每 30 秒生成 6 位验证码。
 * 使用 otpauth 库实现。
 *
 * M7 评估结论：默认保留 SHA-1 算法。
 * - RFC 6238 默认即 SHA-1，Google Authenticator 仅支持 SHA-1；
 *   Microsoft Authenticator / Authy / 1Password 等支持 SHA-256，但兼容性参差。
 * - 用户从其他应用导入的 TOTP secret 默认使用 SHA-1，若强行升级为 SHA-256，
 *   生成的验证码将与原应用不一致，导致用户登录第三方站点失败。
 * - SHA-1 在 TOTP 场景下的碰撞攻击风险可忽略（HOTP 输入为时间戳，非攻击者可控）。
 * - 提供 algorithm 参数支持未来按条目配置 SHA-256，默认仍为 SHA-1 以保证兼容。
 *
 * @see TASK_BREAKDOWN T5.4 验收标准
 */

import { Secret, TOTP } from 'otpauth';

/** TOTP 周期（秒） */
export const TOTP_PERIOD = 30;

/** TOTP 位数 */
export const TOTP_DIGITS = 6;

/** TOTP 支持的哈希算法 */
export type TotpAlgorithm = 'SHA1' | 'SHA256' | 'SHA512';

/**
 * 生成当前 TOTP 验证码。
 *
 * @param base32Secret base32 编码的密钥
 * @param algorithm 哈希算法，默认 SHA-1（最大兼容性，详见模块注释 M7 评估）
 * @returns 6 位验证码字符串
 */
export function generateTOTP(
  base32Secret: string,
  algorithm: TotpAlgorithm = 'SHA1',
): string {
  const secret = Secret.fromBase32(base32Secret);
  const totp = new TOTP({
    secret,
    digits: TOTP_DIGITS,
    period: TOTP_PERIOD,
    algorithm,
  });
  return totp.generate();
}

/**
 * 获取当前 TOTP 周期剩余秒数。
 *
 * @returns 0-30 之间的整数
 */
export function getTOTPRemainingSeconds(): number {
  return TOTP_PERIOD - (Math.floor(Date.now() / 1000) % TOTP_PERIOD);
}

/**
 * 验证 base32 密钥格式是否有效。
 *
 * @param secret 待验证的密钥
 * @returns true 表示有效
 */
export function isValidTOTPSecret(secret: string): boolean {
  try {
    Secret.fromBase32(secret);
    return true;
  } catch {
    return false;
  }
}
