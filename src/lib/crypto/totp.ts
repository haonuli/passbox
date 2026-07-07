/**
 * TOTP 验证码生成模块 (T5.4)
 *
 * 基于 RFC 6238 实现 TOTP（Time-based One-Time Password）。
 * 给定 base32 密钥，每 30 秒生成 6 位验证码。
 * 使用 otpauth 库实现。
 *
 * @see TASK_BREAKDOWN T5.4 验收标准
 */

import { Secret, TOTP } from 'otpauth';

/** TOTP 周期（秒） */
export const TOTP_PERIOD = 30;

/** TOTP 位数 */
export const TOTP_DIGITS = 6;

/**
 * 生成当前 TOTP 验证码。
 *
 * @param base32Secret base32 编码的密钥
 * @returns 6 位验证码字符串
 */
export function generateTOTP(base32Secret: string): string {
  const secret = Secret.fromBase32(base32Secret);
  const totp = new TOTP({
    secret,
    digits: TOTP_DIGITS,
    period: TOTP_PERIOD,
    algorithm: 'SHA1',
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
