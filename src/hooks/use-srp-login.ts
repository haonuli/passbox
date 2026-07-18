/**
 * SRP 登录流程 Hook
 *
 * 使用 SRP（Secure Remote Password）协议替代 authHash 直接传输：
 *   1. POST /api/auth/prelogin 获取 KDF 参数 + srpSalt
 *   2. Argon2id 派生 Master Key -> HKDF 派生 Auth Hash
 *   3. 生成客户端临时密钥 A = srpClient.generateEphemeral()
 *   4. POST /api/auth/login/srp/initiate { email, clientPublicEphemeral: A.public }
 *      -> 返回 { srpSalt, serverPublicEphemeral: B.public }
 *   5. 客户端计算 privateKey = derivePrivateKey(srpSalt, email, authHash)
 *   6. 客户端计算 session = deriveSession(A.secret, B.public, srpSalt, email, privateKey)
 *   7. POST /api/auth/login/srp/verify { email, clientPublicEphemeral: A.public, clientSessionProof: session.proof }
 *      -> 返回 { serverSessionProof, user, encryptedKey, kdfSalt, kdfParams }
 *   8. 客户端验证服务端证明：verifySession(A.public, session, serverSessionProof)
 *   9. 用 Master Key 解密 encryptedKey 得到 Symmetric Key
 *  10. 更新 auth-store（authenticated -> unlocked）
 *
 * 零知识保证：authHash 永不上传，服务端仅收到 SRP 证明，无法离线破解。
 *
 * 接口与 use-login.ts 一致，可作为 drop-in 替换。
 */
'use client';

import { useState, useCallback, useRef } from 'react';
import * as srpClient from 'secure-remote-password/client';
import { deriveMasterKeyViaWorker } from '@/lib/crypto/kdf-worker-client';
import { buildKdfConfig } from '@/lib/crypto/kdf';
import { deriveAuthHash } from '@/lib/crypto/hkdf';
import { decryptSymmetricKey } from '@/lib/crypto/keys';
import { fromBase64, toBase64, zeroFill } from '@/lib/crypto/encoding';
import { useAuthStore } from '@/stores/auth-store';
import { useVaultStore } from '@/stores/vault-store';
import type {
  LoginResponse,
  PreloginResponse,
  SrpInitiateResponse,
  SrpVerifyResponse,
  TotpChallengeResponse,
  ApiErrorResponse,
} from '@/types/api';

/** 登录流程状态（与 use-login.ts 保持一致） */
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
   * 并更新 auth-store（authenticated -> unlocked）。
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

export function useSrpLogin(): UseLoginReturn {
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
      // 1. 预登录：获取 KDF 参数 + srpSalt（防枚举，未注册邮箱也返回随机参数）
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

      // 3. HKDF 派生 Auth Hash（用于 SRP 私钥派生，不上传）
      const authHashBytes = await deriveAuthHash(masterKey, email);
      const authHash = toBase64(authHashBytes);

      // 4. 生成客户端临时密钥 A
      const clientEphemeral = srpClient.generateEphemeral();

      // 5. SRP initiate：发送 A.public，获取 B.public + srpSalt
      setStatus('submitting');
      const initiateRes = await fetch('/api/auth/login/srp/initiate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email,
          clientPublicEphemeral: clientEphemeral.public,
        }),
      });

      if (!initiateRes.ok) {
        throw new Error(INVALID_CREDENTIALS_MSG);
      }

      const initiateData: SrpInitiateResponse = await initiateRes.json();

      // 6. 客户端派生 SRP 私钥（基于 srpSalt + email + authHash）
      const srpPrivateKey = srpClient.derivePrivateKey(
        initiateData.srpSalt,
        email,
        authHash,
      );

      // 7. 客户端派生会话 + 证明
      const clientSession = srpClient.deriveSession(
        clientEphemeral.secret,
        initiateData.serverPublicEphemeral,
        initiateData.srpSalt,
        email,
        srpPrivateKey,
      );

      // 8. SRP verify：发送 clientSessionProof，服务端验证
      const verifyRes = await fetch('/api/auth/login/srp/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email,
          clientPublicEphemeral: clientEphemeral.public,
          clientSessionProof: clientSession.proof,
        }),
      });

      if (!verifyRes.ok) {
        const err: ApiErrorResponse = await verifyRes.json();
        // 账户锁定：展示解锁时间
        if (err.code === 'ACCOUNT_LOCKED' && err.lockedUntil) {
          setLockedUntil(err.lockedUntil);
          throw new Error(`账户已锁定，请在 ${formatLocalTime(err.lockedUntil)} 后重试`);
        }
        // 凭据错误（含 email 不存在，防枚举统一提示）
        throw new Error(err.error ?? INVALID_CREDENTIALS_MSG);
      }

      // 2FA 挑战（HTTP 202）：SRP 密码验证已通过，需 TOTP 验证码
      if (verifyRes.status === 202) {
        const challenge: TotpChallengeResponse = await verifyRes.json();
        // 保留 masterKey 供 completeTotpChallenge 解密使用
        masterKeyRef.current = masterKey;
        masterKey = null; // 所有权转移到 ref，避免 catch 误清
        setTotpChallenge({ ticket: challenge.ticket });
        setStatus('totp_required');
        return;
      }

      // 9. 验证服务端会话证明（确认服务端身份）
      const data: SrpVerifyResponse = await verifyRes.json();
      srpClient.verifySession(
        clientEphemeral.public,
        clientSession,
        data.serverSessionProof,
      );

      // 10. 解密 Symmetric Key
      const symmetricKey = await decryptSymmetricKey(masterKey, data.encryptedKey);

      // 11. 更新 auth-store：authenticated -> unlocked
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
      // 网络错误 / Worker 错误 / API 错误 / SRP 验证错误统一处理
      setError(e instanceof Error ? e.message : '登录失败，请稍后重试');
      setStatus('error');
    }
  }, []);

  /**
   * 完成 2FA 验证后的登录流程。
   *
   * TOTP 组件调用 /api/auth/2fa/verify 成功后，将 LoginResponse 传入。
   * 使用 login 阶段保留的 masterKey 解密 Symmetric Key，
   * 更新 auth-store（authenticated -> unlocked），最后零填充 masterKey。
   *
   * 注意：2FA 完成时无需验证 serverSessionProof，SRP 验证已在 verify 步骤完成。
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
