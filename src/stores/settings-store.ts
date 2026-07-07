/**
 * 用户偏好设置 Store (T3.7)
 *
 * 存储非敏感的用户偏好配置，使用 zustand persist 中间件持久化到 localStorage。
 *
 * ⚠️ 安全约束（ADR-007）：
 *   - 仅持久化非敏感配置（如锁定时长），绝不持久化密钥、密码、恢复码
 *   - 敏感数据（masterKey/symmetricKey）由 auth-store 管理，仅存内存
 *
 * @see TECHNICAL_DESIGN.md 6.2.3 用户偏好
 */
import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { DEFAULT_CLIPBOARD_CLEAR_SECONDS } from '@/lib/security/clipboard';

/** 自动锁定超时选项（分钟）；0 表示永不自动锁定 */
export type LockTimeoutMinutes = 1 | 5 | 10 | 30 | 0;

/** 可选锁定时长列表（用于设置页 UI） */
export const LOCK_TIMEOUT_OPTIONS: ReadonlyArray<{
  value: LockTimeoutMinutes;
  label: string;
}> = [
  { value: 1, label: '1 分钟' },
  { value: 5, label: '5 分钟' },
  { value: 10, label: '10 分钟' },
  { value: 30, label: '30 分钟' },
  { value: 0, label: '永不' },
];

/** 默认自动锁定时长（分钟） */
export const DEFAULT_LOCK_TIMEOUT: LockTimeoutMinutes = 10;

/** 剪贴板清除时间选项（秒）；0 表示不自动清除 */
export type ClipboardClearSeconds = 0 | 10 | 30 | 60;

/** 可选剪贴板清除时间列表（用于设置页 UI） */
export const CLIPBOARD_CLEAR_SETTING_OPTIONS: ReadonlyArray<{
  value: ClipboardClearSeconds;
  label: string;
}> = [
  { value: 0, label: '不自动清除' },
  { value: 10, label: '10 秒' },
  { value: 30, label: '30 秒' },
  { value: 60, label: '60 秒' },
];

interface SettingsStore {
  /** 自动锁定超时（分钟），0 = 永不 */
  lockTimeoutMinutes: LockTimeoutMinutes;
  /** 设置自动锁定时长 */
  setLockTimeoutMinutes: (minutes: LockTimeoutMinutes) => void;
  /** 剪贴板自动清除时间（秒），0 = 不自动清除 */
  clipboardClearSeconds: ClipboardClearSeconds;
  /** 设置剪贴板清除时间 */
  setClipboardClearSeconds: (seconds: ClipboardClearSeconds) => void;
  /** persist 水合完成标志（客户端从 localStorage 读取后置 true） */
  _hasHydrated: boolean;
}

export const useSettingsStore = create<SettingsStore>()(
  persist(
    (set) => ({
      lockTimeoutMinutes: DEFAULT_LOCK_TIMEOUT,
      setLockTimeoutMinutes: (minutes) => set({ lockTimeoutMinutes: minutes }),
      clipboardClearSeconds: DEFAULT_CLIPBOARD_CLEAR_SECONDS as ClipboardClearSeconds,
      setClipboardClearSeconds: (seconds) => set({ clipboardClearSeconds: seconds }),
      _hasHydrated: false,
    }),
    {
      name: 'passbox-settings',
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({
        lockTimeoutMinutes: state.lockTimeoutMinutes,
        clipboardClearSeconds: state.clipboardClearSeconds,
      }),
      onRehydrateStorage: () => (state) => {
        if (state) {
          state._hasHydrated = true;
        }
      },
    },
  ),
);
