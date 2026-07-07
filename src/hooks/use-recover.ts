/**
 * 恢复码数据恢复流程 Hook (T3.8)
 *
 * 主密码丢失时，用户凭邮箱 + 恢复码重置主密码并恢复数据访问。
 * Symmetric Key 不变，所有历史条目仍可解密。
 *
 * 两阶段流程（对应两个 API）：
 *
 * 阶段一 · 验证恢复码并解密 Symmetric Key
 *   1. parseRecoveryCode(recoveryCode) → 10 字节 raw
 *   2. deriveRecoveryKey(raw, email) → 32 字节 Recovery Key（HKDF）
 *   3. POST /api/auth/recover/verify { email, recoveryCode }
 *      → { user, recoveryEncryptedKey }
 *   4. decryptSymmetricKeyWithRecovery(recoveryKey, recoveryEncryptedKey)
 *      → Symmetric Key CryptoKey（恢复码错误或密文损坏时 GCM 认证失败）
 *
 * 阶段二 · 用新主密码重新加密 + 轮换恢复码 + 提交重置
 *   5. generateKdfSalt() → 16 字节新 salt（每次重置换新 salt）
 *   6. deriveMasterKeyViaWorker(newPassword, config) → 32 字节新 Master Key
 *   7. encryptSymmetricKey(newMasterKey, symmetricKey) → newEncryptedKey
 *   8. deriveAuthHash(newMasterKey, email) → 32 字节 newAuthHash
 *   9. M-15：generateRecoveryCode() → 新恢复码 + raw 字节
 *  10. M-15：deriveRecoveryKey(newRaw, email) → 新 Recovery Key
 *  11. M-15：encryptSymmetricKeyWithRecovery(newRecoveryKey, symmetricKey)
 *       → newRecoveryEncryptedKey
 *  12. POST /api/auth/recover { email, recoveryCode, newAuthHash,
 *       newEncryptedKey, newKdfSalt, newKdfParams, newRecoveryCode,
 *       newRecoveryEncryptedKey }
 *       → { user, recoveryCode }（设置新会话 Cookie，返回新恢复码）
 *  13. auth-store setAuthenticated + unlock
 *  14. 返回新恢复码供 UI 展示（用户需重新保存）
 *
 * 安全保证：
 *   - 恢复码明文仅在客户端使用，阶段一/二均由服务端 bcrypt.compare 验证
 *   - 新主密码派生的 Master Key 永不上传，仅上传 newAuthHash（HKDF 双重派生）
 *   - Symmetric Key 不变，历史数据零丢失
 *   - M-15：恢复码轮换 — 旧恢复码使用后立即失效，新恢复码返回给用户
 *
 * @see TECHNICAL_DESIGN.md 3.3.1 恢复码密钥路径, 7.4 恢复数据流
 */
'use client';

import { useState, useCallback } from 'react';
import { parseRecoveryCode, generateRecoveryCode } from '@/lib/recovery-code';
import { deriveRecoveryKey, deriveAuthHash } from '@/lib/crypto/hkdf';
import {
  generateKdfSalt,
  buildKdfConfig,
  DEFAULT_KDF_PARAMS,
} from '@/lib/crypto/kdf';
import { deriveMasterKeyViaWorker } from '@/lib/crypto/kdf-worker-client';
import {
  decryptSymmetricKeyWithRecovery,
  encryptSymmetricKey,
  encryptSymmetricKeyWithRecovery,
} from '@/lib/crypto/keys';
import { toBase64, zeroFill } from '@/lib/crypto/encoding';
import { useAuthStore } from '@/stores/auth-store';
import type {
  RecoverVerifyRequest,
  RecoverVerifyResponse,
  RecoverRequest,
  RecoverResponse,
} from '@/types/api';

/** 恢复流程状态 */
export type RecoverStatus =
  | 'idle'
  | 'verifying'
  | 'deriving'
  | 'submitting'
  | 'success'
  | 'error';

export interface UseRecoverReturn {
  status: RecoverStatus;
  error: string | null;
  /** M-15：恢复成功后的新恢复码，需展示给用户保存 */
  newRecoveryCode: string | null;
  /** 执行恢复码重置主密码 */
  recover: (
    email: string,
    recoveryCode: string,
    newMasterPassword: string,
  ) => Promise<void>;
  /** 重置状态 */
  reset: () => void;
}

/** 解密失败统一提示（不泄露具体原因，与 API 防枚举一致） */
const RECOVER_FAILED_MSG = '恢复码无效，无法恢复账户';

export function useRecover(): UseRecoverReturn {
  const [status, setStatus] = useState<RecoverStatus>('idle');
  const [error, setError] = useState<string | null>(null);
  const [newRecoveryCode, setNewRecoveryCode] = useState<string | null>(null);

  const recover = useCallback(
    async (
      email: string,
      recoveryCode: string,
      newMasterPassword: string,
    ) => {
      setStatus('verifying');
      setError(null);
      setNewRecoveryCode(null);

      // M-14：敏感密钥材料声明在 try 外，catch 中零填充防止内存遗留
      let recoveryCodeRaw: Uint8Array | null = null;
      let recoveryKey: Uint8Array | null = null;
      let newMasterKey: Uint8Array | null = null;
      // M-15：新恢复码相关密钥材料
      let newRecoveryCodeRaw: Uint8Array | null = null;
      let newRecoveryKey: Uint8Array | null = null;

      try {
        // ---- 阶段一：验证恢复码 + 解密 Symmetric Key ----

        // 1. 解析恢复码为 raw 字节
        recoveryCodeRaw = parseRecoveryCode(recoveryCode);

        // 2. HKDF 派生 Recovery Key
        recoveryKey = await deriveRecoveryKey(recoveryCodeRaw, email);

        // 3. 调用 verify API（服务端 bcrypt 验证恢复码）
        const verifyBody: RecoverVerifyRequest = { email, recoveryCode };
        const verifyRes = await fetch('/api/auth/recover/verify', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(verifyBody),
        });

        if (!verifyRes.ok) {
          // 401 统一为"恢复码无效"（防枚举，不区分邮箱不存在 vs 恢复码错误）
          const data = (await verifyRes.json().catch(() => ({}))) as {
            error?: string;
          };
          throw new Error(data.error ?? RECOVER_FAILED_MSG);
        }

        const verifyData: RecoverVerifyResponse = await verifyRes.json();

        // 4. 用 Recovery Key 解密 Symmetric Key（恢复码错误时 GCM 认证失败）
        let symmetricKey: CryptoKey;
        try {
          symmetricKey = await decryptSymmetricKeyWithRecovery(
            recoveryKey,
            verifyData.recoveryEncryptedKey,
          );
        } catch {
          throw new Error(RECOVER_FAILED_MSG);
        }

        // ---- 阶段二：新主密码重新加密 + 轮换恢复码（M-15）+ 提交重置 ----

        setStatus('deriving');

        // 5. 生成新 KDF salt
        const newKdfSalt = generateKdfSalt();
        const kdfConfig = buildKdfConfig(newKdfSalt, DEFAULT_KDF_PARAMS);

        // 6. Argon2id 派生新 Master Key（Web Worker，不阻塞 UI）
        newMasterKey = await deriveMasterKeyViaWorker(
          newMasterPassword,
          kdfConfig,
        );

        // 7. 用新 Master Key 加密 Symmetric Key
        const newEncryptedKey = await encryptSymmetricKey(
          newMasterKey,
          symmetricKey,
        );

        // 8. HKDF 派生新 Auth Hash
        const newAuthHashBytes = await deriveAuthHash(newMasterKey, email);
        const newAuthHash = toBase64(newAuthHashBytes);

        // 9-11. M-15：生成新恢复码并加密 Symmetric Key 副本
        const { raw: newRaw, formatted: newRecoveryCodeFormatted } = generateRecoveryCode();
        newRecoveryCodeRaw = newRaw;
        newRecoveryKey = await deriveRecoveryKey(newRecoveryCodeRaw, email);
        const newRecoveryEncryptedKey = await encryptSymmetricKeyWithRecovery(
          newRecoveryKey,
          symmetricKey,
        );

        // 12. 提交重置请求（含新恢复码密文）
        setStatus('submitting');
        const recoverBody: RecoverRequest = {
          email,
          recoveryCode,
          newAuthHash,
          newEncryptedKey,
          newKdfSalt: toBase64(newKdfSalt),
          newKdfParams: DEFAULT_KDF_PARAMS,
          newRecoveryCode: newRecoveryCodeFormatted,
          newRecoveryEncryptedKey,
        };
        const recoverRes = await fetch('/api/auth/recover', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(recoverBody),
        });

        if (!recoverRes.ok) {
          const data = (await recoverRes.json().catch(() => ({}))) as {
            error?: string;
          };
          throw new Error(data.error ?? '重置失败，请稍后重试');
        }

        const recoverData: RecoverResponse = await recoverRes.json();

        // 13. 更新 auth-store：authenticated → unlocked
        // newMasterKey 所有权转移给 store，store 负责 lock/logout 时零填充
        useAuthStore
          .getState()
          .setAuthenticated(
            recoverData.user,
            newEncryptedKey,
            toBase64(newKdfSalt),
            DEFAULT_KDF_PARAMS,
          );
        useAuthStore.getState().unlock(newMasterKey, symmetricKey);
        newMasterKey = null; // 所有权已转移，避免 catch 误清

        // 14. 返回新恢复码供 UI 展示
        setNewRecoveryCode(newRecoveryCodeFormatted);
        setStatus('success');
      } catch (e) {
        // M-14：错误路径下零填充敏感密钥材料，防止内存遗留
        zeroFill(recoveryCodeRaw);
        zeroFill(recoveryKey);
        zeroFill(newMasterKey);
        zeroFill(newRecoveryCodeRaw);
        zeroFill(newRecoveryKey);
        recoveryCodeRaw = null;
        recoveryKey = null;
        newMasterKey = null;
        newRecoveryCodeRaw = null;
        newRecoveryKey = null;
        setError(e instanceof Error ? e.message : '恢复失败，请稍后重试');
        setStatus('error');
      }
    },
    [],
  );

  const reset = useCallback(() => {
    setStatus('idle');
    setError(null);
    setNewRecoveryCode(null);
  }, []);

  return { status, error, newRecoveryCode, recover, reset };
}
