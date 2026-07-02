/**
 * 登录流程 Hook (T3.6)
 *
 * 封装完整的客户端登录加密流程：
 *   1. POST /api/auth/prelogin 获取该邮箱的 KDF 参数（salt + Argon2id 配置）
 *      - 防枚举：未注册邮箱也返回随机 salt + 默认参数，客户端照常派生
 *   2. Argon2id 派生 Master Key（Web Worker，不阻塞 UI）
 *   3. HKDF 从 Master Key 派生 Auth Hash
 *   4. POST /api/auth/login 提交 { email, authHash }
 *      - 成功 200：返回 encryptedKey + KDF 参数
 *      - 失败 401 INVALID_CREDENTIALS：邮箱或主密码错误（不区分原因）
 *      - 失败 423 ACCOUNT_LOCKED：账户锁定 + lockedUntil 时间戳
 *   5. 用 Master Key 解密 encryptedKey 得到 Symmetric Key
 *   6. 更新 auth-store（authenticated → unlocked）
 *
 * 零知识保证：主密码明文永不上传，服务端仅收到 authHash（已双重派生）。
 *
 * @see TECHNICAL_DESIGN.md 7.2 登录数据流
 */
'use client';

import { useState, useCallback } from 'react';
import { deriveMasterKeyViaWorker } from '@/lib/crypto/kdf-worker-client';
import { buildKdfConfig } from '@/lib/crypto/kdf';
import { deriveAuthHash } from '@/lib/crypto/hkdf';
import { decryptSymmetricKey } from '@/lib/crypto/keys';
import { fromBase64, toBase64 } from '@/lib/crypto/encoding';
import { useAuthStore } from '@/stores/auth-store';
import type {
  LoginRequest,
  LoginResponse,
  PreloginResponse,
  ApiErrorResponse,
} from '@/types/api';

/** 登录流程状态 */
export type LoginStatus =
  | 'idle'
  | 'preloging'
  | 'deriving'
  | 'submitting'
  | 'success'
  | 'error';

export interface UseLoginReturn {
  status: LoginStatus;
  error: string | null;
  /** 账户锁定时的解锁时间（ISO 字符串），用于 UI 展示倒计时 */
  lockedUntil: string | null;
  /** 执行登录 */
  login: (email: string, masterPassword: string) => Promise<void>;
  /** 重置状态 */
  reset: () => void;
}

/** 凭据错误统一提示（不区分 email 不存在 vs 密码错误） */
const INVALID_CREDENTIALS_MSG = '邮箱或主密码错误';

/**
 * 将 ISO 时间戳格式化为本地 HH:MM，用于锁定提示。
 */
function formatLocalTime(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleTimeString(undefined, {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });
}

export function useLogin(): UseLoginReturn {
  const [status, setStatus] = useState<LoginStatus>('idle');
  const [error, setError] = useState<string | null>(null);
  const [lockedUntil, setLockedUntil] = useState<string | null>(null);

  const login = useCallback(async (email: string, masterPassword: string) => {
    setStatus('preloging');
    setError(null);
    setLockedUntil(null);

    try {
      // 1. 预登录：获取 KDF 参数（防枚举，未注册邮箱也返回随机参数）
      const preloginRes = await fetch('/api/auth/prelogin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      });

      if (!preloginRes.ok) {
        throw new Error('获取登录参数失败，请稍后重试');
      }

      const preloginData: PreloginResponse = await preloginRes.json();

      // 2. Argon2id 派生 Master Key（Web Worker，不阻塞 UI）
      setStatus('deriving');
      const kdfSalt = fromBase64(preloginData.kdfSalt);
      const kdfConfig = buildKdfConfig(kdfSalt, preloginData.kdfParams);
      const masterKey = await deriveMasterKeyViaWorker(masterPassword, kdfConfig);

      // 3. HKDF 派生 Auth Hash
      const authHashBytes = await deriveAuthHash(masterKey, email);
      const authHash = toBase64(authHashBytes);

      // 4. 提交登录
      setStatus('submitting');
      const requestBody: LoginRequest = { email, authHash };
      const loginRes = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestBody),
      });

      if (!loginRes.ok) {
        const err: ApiErrorResponse = await loginRes.json();
        // 账户锁定：展示解锁时间
        if (err.code === 'ACCOUNT_LOCKED' && err.lockedUntil) {
          setLockedUntil(err.lockedUntil);
          throw new Error(`账户已锁定，请在 ${formatLocalTime(err.lockedUntil)} 后重试`);
        }
        // 凭据错误（含 email 不存在，防枚举统一提示）
        throw new Error(err.error ?? INVALID_CREDENTIALS_MSG);
      }

      // 5. 解密 Symmetric Key
      const data: LoginResponse = await loginRes.json();
      const symmetricKey = await decryptSymmetricKey(masterKey, data.encryptedKey);

      // 6. 更新 auth-store：authenticated → unlocked
      useAuthStore
        .getState()
        .setAuthenticated(data.user, data.encryptedKey, data.kdfSalt, data.kdfParams);
      useAuthStore.getState().unlock(masterKey, symmetricKey);

      setStatus('success');
    } catch (e) {
      // 网络错误 / Worker 错误 / API 错误统一处理
      setError(e instanceof Error ? e.message : '登录失败，请稍后重试');
      setStatus('error');
    }
  }, []);

  const reset = useCallback(() => {
    setStatus('idle');
    setError(null);
    setLockedUntil(null);
  }, []);

  return { status, error, lockedUntil, login, reset };
}
