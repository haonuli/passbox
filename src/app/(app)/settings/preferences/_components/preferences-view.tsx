/**
 * 偏好设置组件
 *
 * 客户端组件，提供非敏感偏好的配置：
 *   - 自动锁定时长（闲置/失焦超时）
 *   - 剪贴板自动清除时间
 *
 * 配置通过 zustand persist 持久化到 localStorage（ADR-007）。
 *
 * UX-012：所有设置项变更即时保存 + toast 反馈；保存失败时回滚 UI 状态。
 */
'use client';

import { Palette, Clock, Clipboard } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import {
  useSettingsStore,
  LOCK_TIMEOUT_OPTIONS,
  CLIPBOARD_CLEAR_SETTING_OPTIONS,
  type LockTimeoutMinutes,
  type ClipboardClearSeconds,
} from '@/stores/settings-store';

export function PreferencesView() {
  const lockTimeoutMinutes = useSettingsStore((s) => s.lockTimeoutMinutes);
  const setLockTimeoutMinutes = useSettingsStore((s) => s.setLockTimeoutMinutes);
  const clipboardClearSeconds = useSettingsStore((s) => s.clipboardClearSeconds);
  const setClipboardClearSeconds = useSettingsStore((s) => s.setClipboardClearSeconds);
  const hasHydrated = useSettingsStore((s) => s._hasHydrated);

  // UX-012：变更即时保存 + toast 反馈；localStorage 异常时回滚状态
  const handleLockTimeoutChange = (minutes: LockTimeoutMinutes) => {
    const prev = lockTimeoutMinutes;
    try {
      setLockTimeoutMinutes(minutes);
      toast.success('设置已保存', {
        description: minutes === 0 ? '已设置为永不自动锁定' : `已设置为 ${minutes} 分钟后自动锁定`,
      });
    } catch {
      setLockTimeoutMinutes(prev);
      toast.error('保存失败，请重试');
    }
  };

  const handleClipboardClearChange = (seconds: ClipboardClearSeconds) => {
    const prev = clipboardClearSeconds;
    try {
      setClipboardClearSeconds(seconds);
      toast.success('设置已保存', {
        description: seconds === 0 ? '已设置为不自动清除' : `已设置为 ${seconds} 秒后自动清除`,
      });
    } catch {
      setClipboardClearSeconds(prev);
      toast.error('保存失败，请重试');
    }
  };

  return (
    <div className="flex h-full flex-col">
      <div className="border-b border-border px-4 py-3">
        <h1 className="flex items-center gap-2 text-base font-semibold">
          <Palette className="h-4 w-4" />
          偏好设置
        </h1>
      </div>
      <div className="flex-1 overflow-auto p-4">
        <div className="mx-auto max-w-2xl space-y-6">
          {/* 自动锁定时长 */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Clock className="h-4 w-4" />
                自动锁定时长
              </CardTitle>
              <CardDescription>
                闲置或窗口失焦超过设定时间后自动锁定密码库，需要重新输入主密码解锁。
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex flex-wrap gap-2">
                {LOCK_TIMEOUT_OPTIONS.map((option) => {
                  const isActive = hasHydrated && lockTimeoutMinutes === option.value;
                  return (
                    <Button
                      key={option.value}
                      variant={isActive ? 'default' : 'outline'}
                      size="sm"
                      disabled={!hasHydrated}
                      onClick={() => handleLockTimeoutChange(option.value)}
                    >
                      {option.label}
                    </Button>
                  );
                })}
              </div>
            </CardContent>
          </Card>

          {/* 剪贴板自动清除 */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Clipboard className="h-4 w-4" />
                剪贴板自动清除
              </CardTitle>
              <CardDescription>
                复制密码等敏感内容后，在设定时间后自动清除剪贴板，防止意外泄露。
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex flex-wrap gap-2">
                {CLIPBOARD_CLEAR_SETTING_OPTIONS.map((option) => {
                  const isActive = hasHydrated && clipboardClearSeconds === option.value;
                  return (
                    <Button
                      key={option.value}
                      variant={isActive ? 'default' : 'outline'}
                      size="sm"
                      disabled={!hasHydrated}
                      onClick={() => handleClipboardClearChange(option.value)}
                    >
                      {option.label}
                    </Button>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
