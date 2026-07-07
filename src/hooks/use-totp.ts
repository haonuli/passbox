/**
 * TOTP 实时更新 Hook (T5.4)
 *
 * 每秒更新验证码与倒计时进度。
 * 组件卸载时自动清理定时器。
 */
'use client';

import { useState, useEffect } from 'react';
import { generateTOTP, getTOTPRemainingSeconds, TOTP_PERIOD } from '@/lib/crypto/totp';

interface UseTOTPReturn {
  /** 当前 6 位验证码 */
  code: string;
  /** 当前周期剩余秒数 */
  remaining: number;
  /** 30 秒周期 */
  period: number;
}

/**
 * @param base32Secret base32 编码的 TOTP 密钥
 * @returns 验证码、剩余秒数、周期
 */
export function useTOTP(base32Secret: string | undefined): UseTOTPReturn {
  const [code, setCode] = useState(() => {
    if (!base32Secret) return '';
    try {
      return generateTOTP(base32Secret);
    } catch {
      return '';
    }
  });
  const [remaining, setRemaining] = useState(() => getTOTPRemainingSeconds());

  useEffect(() => {
    const tick = () => {
      if (!base32Secret) {
        setCode('');
        setRemaining(TOTP_PERIOD);
        return;
      }
      try {
        setCode(generateTOTP(base32Secret));
        setRemaining(getTOTPRemainingSeconds());
      } catch {
        setCode('');
        setRemaining(TOTP_PERIOD);
      }
    };

    const timer = setInterval(tick, 1000);
    return () => clearInterval(timer);
  }, [base32Secret]);

  return { code, remaining, period: TOTP_PERIOD };
}
