/**
 * 注册流程 Hook (T3.5)
 *
 * 封装完整的客户端注册加密流程：
 *   1. 生成 KDF salt（16 字节随机）
 *   2. Argon2id 派生 Master Key（Web Worker，不阻塞 UI）
 *   3. 生成 Symmetric Key（256-bit 随机）
 *   4. 用 Master Key 加密 Symmetric Key → encryptedKey
 *   5. HKDF 从 Master Key 派生 Auth Hash
 *   6. 生成恢复码（10 字节随机 → PBOX-XXXX-XXXX-XXXX-XXXX）
 *   7. HKDF 从恢复码派生 Recovery Key
 *   8. 用 Recovery Key 加密 Symmetric Key 副本 → recoveryEncryptedKey
 *   9. 用 Symmetric Key 加密默认保险库名称 → defaultVaultNameEncrypted
 *  10. POST /api/auth/register（仅传密文 + authHash + 恢复码）
 *  11. 成功后更新 auth-store（authenticated → unlocked）
 *
 * 零知识保证：主密码明文永不上传，服务端仅收到 authHash（已双重派生）+ 密文。
 *
 * @see TECHNICAL_DESIGN.md 7.1 注册数据流
 */
'use client';

import { useState, useCallback } from 'react';
import { deriveMasterKeyViaWorker } from '@/lib/crypto/kdf-worker-client';
import { generateKdfSalt, buildKdfConfig, DEFAULT_KDF_PARAMS } from '@/lib/crypto/kdf';
import { deriveAuthHash, deriveRecoveryKey } from '@/lib/crypto/hkdf';
import { generateSymmetricKey, encryptSymmetricKey, encryptSymmetricKeyWithRecovery } from '@/lib/crypto/keys';
import { encrypt } from '@/lib/crypto/aes';
import { toBase64, zeroFill } from '@/lib/crypto/encoding';
import { generateRecoveryCode } from '@/lib/recovery-code';
import { useAuthStore } from '@/stores/auth-store';
import { useVaultStore } from '@/stores/vault-store';
import type { RegisterRequest, RegisterResponse } from '@/types/api';

/** 注册流程状态（UX-013：derive/encrypt/submit 三阶段细化文案） */
export type RegisterStatus = 'idle' | 'deriving' | 'encrypting' | 'submitting' | 'success' | 'error';

/**
 * 默认保险库名称（明文，注册时由客户端加密后上传）。
 *
 * 修复 P2：使用"主保险库"而非"个人保险库"，避免与用户在 UI 上创建保险库时
 * 习惯性输入"个人保险库"造成重名混淆。
 */
const DEFAULT_VAULT_NAME = '主保险库';

export interface UseRegisterReturn {
  status: RegisterStatus;
  error: string | null;
  /** 注册成功后的恢复码（用于 Emergency Kit 展示） */
  recoveryCode: string | null;
  /** 注册成功后的用户信息 */
  user: { id: string; email: string } | null;
  /** 执行注册 */
  register: (email: string, masterPassword: string) => Promise<void>;
  /** 重置状态 */
  reset: () => void;
}

export function useRegister(): UseRegisterReturn {
  const [status, setStatus] = useState<RegisterStatus>('idle');
  const [error, setError] = useState<string | null>(null);
  const [recoveryCode, setRecoveryCode] = useState<string | null>(null);
  const [user, setUser] = useState<{ id: string; email: string } | null>(null);

  const register = useCallback(async (email: string, masterPassword: string) => {
    setStatus('deriving');
    setError(null);

    // M-14：敏感密钥材料声明在 try 外，catch 中零填充防止内存遗留
    let masterKey: Uint8Array | null = null;
    let recoveryCodeRaw: Uint8Array | null = null;
    let recoveryKey: Uint8Array | null = null;

    try {
      // 1. 生成 KDF salt
      const kdfSalt = generateKdfSalt();
      const kdfConfig = buildKdfConfig(kdfSalt, DEFAULT_KDF_PARAMS);

      // 2. Argon2id 派生 Master Key（Web Worker）
      masterKey = await deriveMasterKeyViaWorker(masterPassword, kdfConfig);

      // 3. 生成 Symmetric Key（进入加密阶段）
      setStatus('encrypting');
      const symmetricKey = await generateSymmetricKey();

      // 4. 用 Master Key 加密 Symmetric Key
      const encryptedKey = await encryptSymmetricKey(masterKey, symmetricKey);

      // 5. HKDF 派生 Auth Hash
      const authHashBytes = await deriveAuthHash(masterKey, email);
      const authHash = toBase64(authHashBytes);

      // 6. 生成恢复码
      const { raw: recoveryCodeRawInner, formatted: recoveryCodeFormatted } = generateRecoveryCode();
      recoveryCodeRaw = recoveryCodeRawInner;

      // 7. HKDF 从恢复码派生 Recovery Key
      recoveryKey = await deriveRecoveryKey(recoveryCodeRaw, email);

      // 8. 用 Recovery Key 加密 Symmetric Key 副本
      const recoveryEncryptedKey = await encryptSymmetricKeyWithRecovery(recoveryKey, symmetricKey);

      // 9. 用 Symmetric Key 加密默认保险库名称
      const defaultVaultNameEncrypted = await encrypt(symmetricKey, DEFAULT_VAULT_NAME, 'passbox:vault-name:v1');

      // 10. 构造注册请求（全部为密文 / 哈希，无明文密码）
      const requestBody: RegisterRequest = {
        email,
        authHash,
        encryptedKey,
        kdfSalt: toBase64(kdfSalt),
        kdfParams: DEFAULT_KDF_PARAMS,
        recoveryCode: recoveryCodeFormatted,
        recoveryEncryptedKey,
        defaultVaultNameEncrypted,
      };

      // 11. 发送注册请求
      setStatus('submitting');
      const response = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestBody),
      });

      const data: RegisterResponse & { error?: string; code?: string } = await response.json();

      if (!response.ok) {
        // 邮箱已注册 / 参数校验失败等
        throw new Error(data.error ?? '注册失败，请稍后重试');
      }

      // 12. 更新 auth-store：authenticated -> unlocked
      // masterKey 所有权转移给 store，store 负责 lock/logout 时零填充
      const kdfSaltBase64 = toBase64(kdfSalt);
      // 清空旧用户的 vault-store 数据，防止跨用户数据残留
      useVaultStore.getState().clear();
      useAuthStore
        .getState()
        .setAuthenticated(data.user, encryptedKey, kdfSaltBase64, DEFAULT_KDF_PARAMS);
      useAuthStore.getState().unlock(masterKey, symmetricKey);
      masterKey = null; // 所有权已转移，避免 catch 误清

      setRecoveryCode(recoveryCodeFormatted);
      setUser(data.user);
      setStatus('success');
    } catch (e) {
      // M-14：错误路径下零填充敏感密钥材料，防止内存遗留
      zeroFill(masterKey);
      zeroFill(recoveryCodeRaw);
      zeroFill(recoveryKey);
      masterKey = null;
      recoveryCodeRaw = null;
      recoveryKey = null;
      setError(e instanceof Error ? e.message : '注册失败，请稍后重试');
      setStatus('error');
    }
  }, []);

  const reset = useCallback(() => {
    setStatus('idle');
    setError(null);
    setRecoveryCode(null);
    setUser(null);
  }, []);

  return { status, error, recoveryCode, user, register, reset };
}
