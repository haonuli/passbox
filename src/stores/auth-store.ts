/**
 * 认证状态管理 Store (T3.4)
 *
 * 对应 TECHNICAL_DESIGN.md 6.2.2 节 + ADR-007（密钥只存内存）。
 *
 * 管理认证状态生命周期：
 *   unauthenticated → authenticated → unlocked → locked
 *
 * 状态含义：
 *   - unauthenticated：未登录（无有效会话）
 *   - authenticated：会话有效但密钥未加载（页面刷新后从 session API 恢复）
 *   - unlocked：会话有效 + 密钥在内存中，密码库可访问
 *   - locked：会话有效但密钥已清除（手动锁定/自动锁定），需重新输入主密码解锁
 *
 * 安全约束（ADR-007）：
 *   - masterKey / symmetricKey 仅存内存（模块作用域），不持久化到 localStorage / sessionStorage
 *   - lock() / logout() 时对 masterKey 执行 fill(0) 零填充（best-effort 安全清除）
 *   - 不使用 zustand persist 中间件
 *
 * ⚠️ 实现偏差（相对 TECHNICAL_DESIGN 6.2.2 示例）：
 *   设计示例中 masterKey 类型为 CryptoKey，实际实现为 Uint8Array。
 *   理由：masterKey 需以 Uint8Array 形式传给 HKDF（派生 Auth Hash）与密钥包装函数
 *   （encryptSymmetricKey / decryptSymmetricKey），若存为非提取 CryptoKey 则无法
 *   导出原始字节供 HKDF 使用。symmetricKey 保持 CryptoKey 类型（直接用于 AES-GCM 加解密）。
 *
 * @see TECHNICAL_DESIGN.md 6.2.2, ADR-007
 */
import { create } from 'zustand';
import type { EncryptedData, KdfParams } from '@/types/crypto';
import { zeroFill } from '@/lib/crypto/encoding';

// ============================================================
// 类型定义
// ============================================================

/** 认证状态机 */
export type AuthStatus =
  | 'unauthenticated'
  | 'authenticated'
  | 'unlocked'
  | 'locked';

/** 当前用户信息（非敏感，可从 session API 获取） */
export interface AuthUser {
  id: string;
  email: string;
}

export interface AuthStore {
  // ---- 状态 ----
  status: AuthStatus;
  user: AuthUser | null;
  /** Master Key（Argon2id 派生输出），仅内存，lock/logout 时零填充清除 */
  masterKey: Uint8Array | null;
  /** Symmetric Key（数据加密密钥），仅内存，lock/logout 时置 null */
  symmetricKey: CryptoKey | null;

  // ---- 会话恢复数据（密文 + KDF 参数，非敏感，用于 unlock 流程） ----
  /** 服务端存储的加密 Symmetric Key 密文（从 login/session API 获取） */
  encryptedKey: EncryptedData | null;
  /** base64(16 bytes KDF salt)，用于重新派生 Master Key */
  kdfSalt: string | null;
  /** KDF 参数，用于重新派生 Master Key */
  kdfParams: KdfParams | null;

  // ---- 操作 ----
  /**
   * 会话恢复：session cookie 有效但密钥未加载时调用。
   * 设置 user + 加密密钥密文 + KDF 参数，status → authenticated。
   * 后续由 unlock() 输入主密码派生密钥完成解锁。
   */
  setAuthenticated: (
    user: AuthUser,
    encryptedKey: EncryptedData,
    kdfSalt: string,
    kdfParams: KdfParams,
  ) => void;

  /**
   * 解锁：输入已派生的 Master Key 与解密后的 Symmetric Key，status → unlocked。
   * 保留 user + 会话恢复数据。
   */
  unlock: (masterKey: Uint8Array, symmetricKey: CryptoKey) => void;

  /**
   * 锁定：清除 masterKey（零填充）与 symmetricKey，status → locked。
   * 保留 user + 会话恢复数据（用于重新解锁，无需再次请求 session API）。
   */
  lock: () => void;

  /**
   * 登出：清除全部状态（含密钥零填充），status → unauthenticated。
   */
  logout: () => void;
}

// ============================================================
// Store 实现
// ============================================================

export const useAuthStore = create<AuthStore>((set) => ({
  // 初始状态
  status: 'unauthenticated',
  user: null,
  masterKey: null,
  symmetricKey: null,
  encryptedKey: null,
  kdfSalt: null,
  kdfParams: null,

  setAuthenticated: (user, encryptedKey, kdfSalt, kdfParams) =>
    set((state) => {
      // M-13：从 unlocked/locked 状态调用时，先零填充旧 masterKey 防止内存遗留
      // （否则旧 masterKey 引用断开后缓冲区仍含密钥，GC 前可被 dump）
      zeroFill(state.masterKey);
      return {
        status: 'authenticated',
        user,
        encryptedKey,
        kdfSalt,
        kdfParams,
        masterKey: null,
        symmetricKey: null,
      };
    }),

  unlock: (masterKey, symmetricKey) =>
    set((state) => {
      // M-13：仅允许从 authenticated / locked 状态解锁
      // unauthenticated 时无 user 上下文，解锁会产生不一致状态
      if (state.status !== 'authenticated' && state.status !== 'locked') {
        // 无效转换：零填充传入的密钥后忽略
        zeroFill(masterKey);
        return {};
      }
      return {
        status: 'unlocked',
        masterKey,
        symmetricKey,
      };
    }),

  lock: () =>
    set((state) => {
      // M-13：仅从 unlocked 状态锁定才有意义
      if (state.status !== 'unlocked') {
        return {};
      }
      zeroFill(state.masterKey);
      return {
        status: 'locked',
        masterKey: null,
        symmetricKey: null,
      };
    }),

  logout: () =>
    set((state) => {
      zeroFill(state.masterKey);
      return {
        status: 'unauthenticated',
        user: null,
        masterKey: null,
        symmetricKey: null,
        encryptedKey: null,
        kdfSalt: null,
        kdfParams: null,
      };
    }),
}));
