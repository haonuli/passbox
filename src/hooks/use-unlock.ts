/**
 * 解锁流程 Hook (T3.7)
 *
 * 会话有效但密钥未加载（手动锁定 / 自动锁定 / 页面刷新）时，
 * 用户输入主密码重新派生 Master Key 并解密 Symmetric Key，无需完整登录流程。
 *
 * 流程：
 *   1. GET /api/auth/session 获取加密参数（encryptedKey + KDF salt/params）
 *      - 401 表示会话已过期 → 需跳转 /login 重新登录
 *   2. Argon2id 派生 Master Key（Web Worker，不阻塞 UI）
 *   3. 用 Master Key 解密 encryptedKey 得到 Symmetric Key
 *   4. 更新 auth-store（authenticated → unlocked）
 *
 * 与登录的区别：不需要 authHash（用户已登录，session cookie 已认证），
 * 仅验证 JWT Cookie 有效性后返回加密参数。
 *
 * @see TECHNICAL_DESIGN.md 7.3 解锁数据流
 */
'use client';

import { useState, useCallback } from 'react';
import { deriveMasterKeyViaWorker } from '@/lib/crypto/kdf-worker-client';
import { buildKdfConfig } from '@/lib/crypto/kdf';
import { decryptSymmetricKey } from '@/lib/crypto/keys';
import { fromBase64 } from '@/lib/crypto/encoding';
import { useAuthStore } from '@/stores/auth-store';
import type { SessionResponse } from '@/types/api';

/** 解锁流程状态 */
export type UnlockStatus = 'idle' | 'fetching' | 'deriving' | 'success' | 'error';

export interface UseUnlockReturn {
  status: UnlockStatus;
  error: string | null;
  /** 会话已过期，需跳转登录页 */
  sessionExpired: boolean;
  /** 执行解锁 */
  unlock: (masterPassword: string) => Promise<void>;
  /** 重置状态 */
  reset: () => void;
}

/** 解密失败统一提示（不区分原因） */
const DECRYPT_FAILED_MSG = '主密码错误，无法解锁';

export function useUnlock(): UseUnlockReturn {
  const [status, setStatus] = useState<UnlockStatus>('idle');
  const [error, setError] = useState<string | null>(null);
  const [sessionExpired, setSessionExpired] = useState(false);

  const unlock = useCallback(async (masterPassword: string) => {
    setStatus('fetching');
    setError(null);
    setSessionExpired(false);

    try {
      // 1. 获取会话加密参数
      const res = await fetch('/api/auth/session', { method: 'GET' });

      if (res.status === 401) {
        // 会话过期 / 未登录 → 需重新登录
        setSessionExpired(true);
        throw new Error('会话已过期，请重新登录');
      }

      if (!res.ok) {
        throw new Error('获取解锁参数失败，请稍后重试');
      }

      const data: SessionResponse = await res.json();

      // 2. Argon2id 派生 Master Key（Web Worker）
      setStatus('deriving');
      const kdfSalt = fromBase64(data.kdfSalt);
      const kdfConfig = buildKdfConfig(kdfSalt, data.kdfParams);
      const masterKey = await deriveMasterKeyViaWorker(masterPassword, kdfConfig);

      // 3. 解密 Symmetric Key（主密码错误时 GCM 认证失败抛异常）
      let symmetricKey: CryptoKey;
      try {
        symmetricKey = await decryptSymmetricKey(masterKey, data.encryptedKey);
      } catch {
        throw new Error(DECRYPT_FAILED_MSG);
      }

      // 4. 更新 auth-store：authenticated → unlocked
      useAuthStore
        .getState()
        .setAuthenticated(data.user, data.encryptedKey, data.kdfSalt, data.kdfParams);
      useAuthStore.getState().unlock(masterKey, symmetricKey);

      setStatus('success');
    } catch (e) {
      setError(e instanceof Error ? e.message : '解锁失败，请稍后重试');
      setStatus('error');
    }
  }, []);

  const reset = useCallback(() => {
    setStatus('idle');
    setError(null);
    setSessionExpired(false);
  }, []);

  return { status, error, sessionExpired, unlock, reset };
}
