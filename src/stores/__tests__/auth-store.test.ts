// @vitest-environment jsdom
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { useAuthStore } from '../auth-store';
import type { EncryptedData, KdfParams } from '@/types/crypto';

/**
 * T3.4 认证状态管理 Store 单元测试
 *
 * 验收标准（TASK_BREAKDOWN.md T3.4）：
 * - [x] Store 状态包含：status, masterKey, symmetricKey, user
 * - [x] unlock(masterKey, symmetricKey) 设置密钥并更新 status='unlocked'
 * - [x] lock() 将 masterKey 和 symmetricKey 置 null，status='locked'
 * - [x] logout() 清除全部状态，status='unauthenticated'
 * - [x] 密钥不持久化到 localStorage / sessionStorage
 * - [x] Store 使用 TypeScript 类型约束，无 any
 * - [x] selector 订阅模式，避免不必要重渲染
 *
 * 状态流转：unauthenticated → authenticated → unlocked → locked → unlocked → logout
 */

// ============================================================
// 测试夹具
// ============================================================

/** 构造 mock CryptoKey（store 仅持有引用，不调用 WebCrypto API） */
function mockCryptoKey(): CryptoKey {
  return {
    type: 'secret',
    extractable: false,
    algorithm: { name: 'AES-GCM' },
    usages: ['encrypt', 'decrypt'],
  } as unknown as CryptoKey;
}

/** 构造 mock Master Key（32 字节，非零填充以便验证零填充清除） */
function mockMasterKey(): Uint8Array {
  return new Uint8Array(32).fill(0xab);
}

const mockUser = { id: 'user-uuid-1', email: 'test@passbox.dev' };
const mockEncryptedKey: EncryptedData = { v: 1, iv: 'AAAAAAAAAAAAAAAA', ct: 'AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA=' };
const mockKdfSalt = 'AAAAAAAAAAAAAAAAAAAAAA=='; // 16 bytes base64
const mockKdfParams: KdfParams = {
  type: 'argon2id',
  memoryKib: 65536,
  iterations: 3,
  parallelism: 4,
};

// ============================================================
// 测试
// ============================================================

describe('T3.4 认证状态管理 Store', () => {
  beforeEach(() => {
    // 每个测试前重置 store 到初始状态
    useAuthStore.getState().logout();
    localStorage.clear();
    sessionStorage.clear();
  });

  // ----------------------------------------------------------
  // 初始状态
  // ----------------------------------------------------------

  describe('初始状态', () => {
    it('status 为 unauthenticated', () => {
      expect(useAuthStore.getState().status).toBe('unauthenticated');
    });

    it('masterKey 为 null', () => {
      expect(useAuthStore.getState().masterKey).toBeNull();
    });

    it('symmetricKey 为 null', () => {
      expect(useAuthStore.getState().symmetricKey).toBeNull();
    });

    it('user 为 null', () => {
      expect(useAuthStore.getState().user).toBeNull();
    });

    it('会话恢复数据（encryptedKey/kdfSalt/kdfParams）均为 null', () => {
      const state = useAuthStore.getState();
      expect(state.encryptedKey).toBeNull();
      expect(state.kdfSalt).toBeNull();
      expect(state.kdfParams).toBeNull();
    });
  });

  // ----------------------------------------------------------
  // setAuthenticated（会话恢复：session cookie 有效，密钥未加载）
  // ----------------------------------------------------------

  describe('setAuthenticated', () => {
    it('设置 user + 会话恢复数据，status → authenticated', () => {
      useAuthStore
        .getState()
        .setAuthenticated(mockUser, mockEncryptedKey, mockKdfSalt, mockKdfParams);

      const state = useAuthStore.getState();
      expect(state.status).toBe('authenticated');
      expect(state.user).toEqual(mockUser);
      expect(state.encryptedKey).toEqual(mockEncryptedKey);
      expect(state.kdfSalt).toBe(mockKdfSalt);
      expect(state.kdfParams).toEqual(mockKdfParams);
    });

    it('不设置密钥（masterKey / symmetricKey 仍为 null）', () => {
      useAuthStore
        .getState()
        .setAuthenticated(mockUser, mockEncryptedKey, mockKdfSalt, mockKdfParams);

      const state = useAuthStore.getState();
      expect(state.masterKey).toBeNull();
      expect(state.symmetricKey).toBeNull();
    });
  });

  // ----------------------------------------------------------
  // unlock（设置密钥，进入已解锁状态）
  // ----------------------------------------------------------

  describe('unlock', () => {
    it('设置密钥，status → unlocked', () => {
      const masterKey = mockMasterKey();
      const symmetricKey = mockCryptoKey();

      useAuthStore.getState().unlock(masterKey, symmetricKey);

      const state = useAuthStore.getState();
      expect(state.status).toBe('unlocked');
      expect(state.masterKey).toBe(masterKey);
      expect(state.symmetricKey).toBe(symmetricKey);
    });

    it('需要先 setAuthenticated 设置 user（解锁后 user 保留）', () => {
      useAuthStore
        .getState()
        .setAuthenticated(mockUser, mockEncryptedKey, mockKdfSalt, mockKdfParams);

      useAuthStore.getState().unlock(mockMasterKey(), mockCryptoKey());

      expect(useAuthStore.getState().user).toEqual(mockUser);
    });

    it('保留会话恢复数据（不覆盖 encryptedKey/kdfSalt/kdfParams）', () => {
      useAuthStore
        .getState()
        .setAuthenticated(mockUser, mockEncryptedKey, mockKdfSalt, mockKdfParams);

      useAuthStore.getState().unlock(mockMasterKey(), mockCryptoKey());

      const state = useAuthStore.getState();
      expect(state.encryptedKey).toEqual(mockEncryptedKey);
      expect(state.kdfSalt).toBe(mockKdfSalt);
      expect(state.kdfParams).toEqual(mockKdfParams);
    });
  });

  // ----------------------------------------------------------
  // lock（清除密钥，保留会话）
  // ----------------------------------------------------------

  describe('lock', () => {
    it('清除密钥，status → locked', () => {
      useAuthStore
        .getState()
        .setAuthenticated(mockUser, mockEncryptedKey, mockKdfSalt, mockKdfParams);
      useAuthStore.getState().unlock(mockMasterKey(), mockCryptoKey());

      useAuthStore.getState().lock();

      const state = useAuthStore.getState();
      expect(state.status).toBe('locked');
      expect(state.masterKey).toBeNull();
      expect(state.symmetricKey).toBeNull();
    });

    it('保留 user + 会话恢复数据（用于重新解锁）', () => {
      useAuthStore
        .getState()
        .setAuthenticated(mockUser, mockEncryptedKey, mockKdfSalt, mockKdfParams);
      useAuthStore.getState().unlock(mockMasterKey(), mockCryptoKey());

      useAuthStore.getState().lock();

      const state = useAuthStore.getState();
      expect(state.user).toEqual(mockUser);
      expect(state.encryptedKey).toEqual(mockEncryptedKey);
      expect(state.kdfSalt).toBe(mockKdfSalt);
      expect(state.kdfParams).toEqual(mockKdfParams);
    });

    it('masterKey 内存被零填充（best-effort 安全清除）', () => {
      const masterKey = mockMasterKey();
      useAuthStore
        .getState()
        .setAuthenticated(mockUser, mockEncryptedKey, mockKdfSalt, mockKdfParams);
      useAuthStore.getState().unlock(masterKey, mockCryptoKey());

      // 捕获引用，调用 lock 后引用的内容应被零填充
      expect(masterKey[0]).toBe(0xab); // 调用前非零
      useAuthStore.getState().lock();

      // masterKey 引用的缓冲区被 fill(0) 清除
      expect(Array.from(masterKey)).toEqual(Array(32).fill(0));
    });
  });

  // ----------------------------------------------------------
  // logout（清除全部状态）
  // ----------------------------------------------------------

  describe('logout', () => {
    it('清除全部状态，status → unauthenticated', () => {
      useAuthStore
        .getState()
        .setAuthenticated(mockUser, mockEncryptedKey, mockKdfSalt, mockKdfParams);
      useAuthStore.getState().unlock(mockMasterKey(), mockCryptoKey());

      useAuthStore.getState().logout();

      const state = useAuthStore.getState();
      expect(state.status).toBe('unauthenticated');
      expect(state.user).toBeNull();
      expect(state.masterKey).toBeNull();
      expect(state.symmetricKey).toBeNull();
      expect(state.encryptedKey).toBeNull();
      expect(state.kdfSalt).toBeNull();
      expect(state.kdfParams).toBeNull();
    });

    it('masterKey 内存被零填充', () => {
      const masterKey = mockMasterKey();
      useAuthStore.getState().unlock(masterKey, mockCryptoKey());

      useAuthStore.getState().logout();

      expect(Array.from(masterKey)).toEqual(Array(32).fill(0));
    });

    it('从 locked 状态也能正确登出', () => {
      useAuthStore.getState().unlock(mockMasterKey(), mockCryptoKey());
      useAuthStore.getState().lock();

      useAuthStore.getState().logout();

      expect(useAuthStore.getState().status).toBe('unauthenticated');
    });
  });

  // ----------------------------------------------------------
  // 密钥不持久化
  // ----------------------------------------------------------

  describe('密钥不持久化（ADR-007）', () => {
    it('unlock 后 localStorage 无密钥数据', () => {
      useAuthStore.getState().unlock(mockMasterKey(), mockCryptoKey());

      const lsData = JSON.stringify(localStorage);
      expect(lsData).toBe('{}');
    });

    it('unlock 后 sessionStorage 无密钥数据', () => {
      useAuthStore.getState().unlock(mockMasterKey(), mockCryptoKey());

      const ssData = JSON.stringify(sessionStorage);
      expect(ssData).toBe('{}');
    });

    it('store 未使用 persist 中间件（无 zustand-persist 存储 key）', () => {
      // persist 中间件会在 localStorage 中写入以 store name 为 key 的条目
      // 验证 localStorage 中无任何 zustand 相关条目
      useAuthStore.getState().unlock(mockMasterKey(), mockCryptoKey());

      const keys = Object.keys(localStorage);
      expect(keys).toHaveLength(0);
    });
  });

  // ----------------------------------------------------------
  // selector 订阅模式
  // ----------------------------------------------------------

  describe('selector 订阅模式', () => {
    it('subscribe 在状态变化时触发 listener', () => {
      const listener = vi.fn();
      const unsub = useAuthStore.subscribe(listener);

      useAuthStore.getState().setAuthenticated(mockUser, mockEncryptedKey, mockKdfSalt, mockKdfParams);

      expect(listener).toHaveBeenCalledTimes(1);
      unsub();
    });

    it('subscribe 提供新状态与旧状态', () => {
      const listener = vi.fn();
      const unsub = useAuthStore.subscribe(listener);

      useAuthStore.getState().unlock(mockMasterKey(), mockCryptoKey());

      expect(listener).toHaveBeenCalledTimes(1);
      const [newState, prevState] = listener.mock.calls[0];
      expect(prevState.status).toBe('unauthenticated');
      expect(newState.status).toBe('unlocked');
      unsub();
    });

    it('可通过 getState 精确读取单个字段（selector 基础）', () => {
      useAuthStore.getState().setAuthenticated(mockUser, mockEncryptedKey, mockKdfSalt, mockKdfParams);

      // 模拟 React selector：useAuthStore(s => s.status)
      const selector = (s: ReturnType<typeof useAuthStore.getState>) => s.status;
      expect(selector(useAuthStore.getState())).toBe('authenticated');
    });

    it('lock 仅改变 status/masterKey/symmetricKey，不触发不必要的 user 变化', () => {
      useAuthStore
        .getState()
        .setAuthenticated(mockUser, mockEncryptedKey, mockKdfSalt, mockKdfParams);
      useAuthStore.getState().unlock(mockMasterKey(), mockCryptoKey());

      // 订阅 user 字段：lock 不应改变 user 引用
      let userChangeCount = 0;
      let lastUser = useAuthStore.getState().user;
      const unsub = useAuthStore.subscribe((state) => {
        if (state.user !== lastUser) {
          userChangeCount++;
          lastUser = state.user;
        }
      });

      useAuthStore.getState().lock();

      expect(userChangeCount).toBe(0); // user 未变化
      unsub();
    });
  });

  // ----------------------------------------------------------
  // 完整状态流转
  // ----------------------------------------------------------

  describe('完整状态流转', () => {
    it('unauthenticated → authenticated → unlocked → locked → unlocked → logout', () => {
      const store = useAuthStore.getState;

      // 1. 初始
      expect(store().status).toBe('unauthenticated');

      // 2. 会话恢复
      store().setAuthenticated(mockUser, mockEncryptedKey, mockKdfSalt, mockKdfParams);
      expect(store().status).toBe('authenticated');
      expect(store().masterKey).toBeNull();

      // 3. 解锁
      store().unlock(mockMasterKey(), mockCryptoKey());
      expect(store().status).toBe('unlocked');
      expect(store().masterKey).not.toBeNull();
      expect(store().symmetricKey).not.toBeNull();

      // 4. 锁定
      store().lock();
      expect(store().status).toBe('locked');
      expect(store().masterKey).toBeNull();
      expect(store().symmetricKey).toBeNull();
      expect(store().user).toEqual(mockUser); // user 保留

      // 5. 重新解锁
      store().unlock(mockMasterKey(), mockCryptoKey());
      expect(store().status).toBe('unlocked');

      // 6. 登出
      store().logout();
      expect(store().status).toBe('unauthenticated');
      expect(store().user).toBeNull();
    });
  });
});
