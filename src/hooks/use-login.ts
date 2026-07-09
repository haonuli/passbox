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

import { useState, useCallback, useRef } from 'react';
import { deriveMasterKeyViaWorker } from '@/lib/crypto/kdf-worker-client';
import { buildKdfConfig } from '@/lib/crypto/kdf';
import { deriveAuthHash } from '@/lib/crypto/hkdf';
import { decryptSymmetricKey } from '@/lib/crypto/keys';
import { fromBase64, toBase64, zeroFill } from '@/lib/crypto/encoding';
import { useAuthStore } from '@/stores/auth-store';
import { useVaultStore } from '@/stores/vault-store';
import type {
  LoginRequest,
  LoginResponse,
  PreloginResponse,
  TotpChallengeResponse,
  ApiErrorResponse,
} from '@/types/api';

/** 登录流程状态 */
export type LoginStatus =
  | 'idle'
  | 'preloging'
  | 'deriving'
  | 'submitting'
  | 'totp_required'
  | 'success'
  | 'error';

export interface UseLoginReturn {
  status: LoginStatus;
  error: string | null;
  /** 账户锁定时的解锁时间（ISO 字符串），用于 UI 展示倒计时 */
  lockedUntil: string | null;
  /** 2FA 挑战信息（login 返回 202 时携带 ticket） */
  totpChallenge: { ticket: string } | null;
  /** 执行登录 */
  login: (email: string, masterPassword: string) => Promise<void>;
  /**
   * 完成 2FA 验证后的登录流程。
   *
   * TOTP 组件调用 /api/auth/2fa/verify 获取 LoginResponse 后，
   * 调用本方法用 login 阶段保留的 masterKey 解密 Symmetric Key，
   * 并更新 auth-store（authenticated → unlocked）。
   */
  completeTotpChallenge: (response: LoginResponse) => Promise<void>;
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
  const [totpChallenge, setTotpChallenge] = useState<{ ticket: string } | null>(null);

  /**
   * 2FA 流程中保留的 Master Key。
   *
   * login 阶段派生 masterKey 后若收到 202（需要 TOTP），
   * 将 masterKey 存入此 ref，completeTotpChallenge 时取出解密。
   * reset / completeTotpChallenge 后零填充清除。
   */
  const masterKeyRef = useRef<Uint8Array | null>(null);

  const login = useCallback(async (email: string, masterPassword: string) => {
    setStatus('preloging');
    setError(null);
    setLockedUntil(null);

    // M-14：敏感密钥材料声明在 try 外，catch 中零填充防止内存遗留
    let masterKey: Uint8Array | null = null;

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
      masterKey = await deriveMasterKeyViaWorker(masterPassword, kdfConfig);

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

      // 2FA 挑战（HTTP 202）：密码已验证，需 TOTP 验证码
      if (loginRes.status === 202) {
        const challenge: TotpChallengeResponse = await loginRes.json();
        // 保留 masterKey 供 completeTotpChallenge 解密使用
        masterKeyRef.current = masterKey;
        masterKey = null; // 所有权转移到 ref，避免 catch 误清
        setTotpChallenge({ ticket: challenge.ticket });
        setStatus('totp_required');
        return;
      }

      // 5. 解密 Symmetric Key
      const data: LoginResponse = await loginRes.json();
      const symmetricKey = await decryptSymmetricKey(masterKey, data.encryptedKey);

      // 6. 更新 auth-store：authenticated -> unlocked
      // masterKey 所有权转移给 store，store 负责 lock/logout 时零填充
      // 清空旧用户的 vault-store 数据，防止跨用户数据残留
      useVaultStore.getState().clear();
      useAuthStore
        .getState()
        .setAuthenticated(data.user, data.encryptedKey, data.kdfSalt, data.kdfParams);
      useAuthStore.getState().unlock(masterKey, symmetricKey);
      masterKey = null; // 所有权已转移，避免 catch 误清

      setStatus('success');
    } catch (e) {
      // M-14：错误路径下零填充敏感密钥材料，防止内存遗留
      zeroFill(masterKey);
      masterKey = null;
      // 网络错误 / Worker 错误 / API 错误统一处理
      setError(e instanceof Error ? e.message : '登录失败，请稍后重试');
      setStatus('error');
    }
  }, []);

  /**
   * 完成 2FA 验证后的登录流程。
   *
   * TOTP 组件调用 /api/auth/2fa/verify 成功后，将 LoginResponse 传入。
   * 使用 login 阶段保留的 masterKey 解密 Symmetric Key，
   * 更新 auth-store（authenticated → unlocked），最后零填充 masterKey。
   */
  const completeTotpChallenge = useCallback(async (response: LoginResponse) => {
    const masterKey = masterKeyRef.current;
    if (!masterKey) {
      setError('登录会话已过期，请重新登录');
      setStatus('error');
      return;
    }

    try {
      // 解密 Symmetric Key
      const symmetricKey = await decryptSymmetricKey(masterKey, response.encryptedKey);

      // 更新 auth-store：authenticated -> unlocked
      // 清空旧用户的 vault-store 数据，防止跨用户数据残留
      useVaultStore.getState().clear();
      useAuthStore
        .getState()
        .setAuthenticated(response.user, response.encryptedKey, response.kdfSalt, response.kdfParams);
      useAuthStore.getState().unlock(masterKey, symmetricKey);

      setStatus('success');
    } catch (e) {
      setError(e instanceof Error ? e.message : '2FA 验证失败，请稍后重试');
      setStatus('error');
    } finally {
      // 无论成功失败，masterKey 已使用完毕（成功时所有权转移给 store），零填充清除
      zeroFill(masterKeyRef.current);
      masterKeyRef.current = null;
      setTotpChallenge(null);
    }
  }, []);

  const reset = useCallback(() => {
    setStatus('idle');
    setError(null);
    setLockedUntil(null);
    setTotpChallenge(null);
    // 清理可能残留的 masterKey
    zeroFill(masterKeyRef.current);
    masterKeyRef.current = null;
  }, []);

  return { status, error, lockedUntil, totpChallenge, login, completeTotpChallenge, reset };
}
