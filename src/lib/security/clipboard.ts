/**
 * 剪贴板安全管理模块 (T5.3)
 *
 * 复制密码后启动倒计时，超时自动清除剪贴板。
 * 默认 30 秒后自动清除，可配置 10/30/60 秒。
 *
 * @see TASK_BREAKDOWN T5.3 验收标准
 */

/** 剪贴板清除时间选项（秒） */
export const CLIPBOARD_CLEAR_OPTIONS = [
  { value: 10, label: '10 秒' },
  { value: 30, label: '30 秒' },
  { value: 60, label: '60 秒' },
] as const;

/** 默认清除时间（秒） */
export const DEFAULT_CLIPBOARD_CLEAR_SECONDS = 30;

/** 当前活跃的清除定时器 */
let activeTimer: ReturnType<typeof setTimeout> | null = null;

/** 当前倒计时结束时间戳（ms），用于显示剩余秒数 */
let activeClearAt: number | null = null;

/**
 * 获取当前剪贴板清除倒计时的剩余秒数。
 * 返回 null 表示没有活跃的倒计时。
 */
export function getClipboardClearRemaining(): number | null {
  if (activeClearAt === null) return null;
  const remaining = Math.ceil((activeClearAt - Date.now()) / 1000);
  return remaining > 0 ? remaining : 0;
}

/**
 * 复制文本到剪贴板，并在指定秒数后自动清除。
 *
 * @param text 要复制的文本
 * @param clearAfterSeconds 清除时间（秒），默认 30
 * @returns 成功返回 true，失败返回 false
 */
export async function copyToClipboard(
  text: string,
  clearAfterSeconds: number = DEFAULT_CLIPBOARD_CLEAR_SECONDS,
): Promise<boolean> {
  // 清除之前的定时器
  clearClipboardTimer();

  try {
    if (navigator.clipboard && window.isSecureContext) {
      // 优先使用 Clipboard API（需 HTTPS 或 localhost）
      await navigator.clipboard.writeText(text);
    } else {
      // 降级方案：使用 execCommand
      const textarea = document.createElement('textarea');
      textarea.value = text;
      textarea.style.position = 'fixed';
      textarea.style.opacity = '0';
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand('copy');
      document.body.removeChild(textarea);
    }
  } catch {
    return false;
  }

  // 启动自动清除定时器
  activeClearAt = Date.now() + clearAfterSeconds * 1000;
  activeTimer = setTimeout(async () => {
    await clearClipboard();
    activeTimer = null;
    activeClearAt = null;
  }, clearAfterSeconds * 1000);

  return true;
}

/**
 * 立即清除剪贴板（写入空字符串）。
 */
export async function clearClipboard(): Promise<void> {
  clearClipboardTimer();
  try {
    if (navigator.clipboard && window.isSecureContext) {
      await navigator.clipboard.writeText('');
    }
  } catch {
    // 清除失败静默处理（可能浏览器不支持）
  }
}

/**
 * 清除剪贴板定时器（不清除剪贴板内容）。
 */
export function clearClipboardTimer(): void {
  if (activeTimer !== null) {
    clearTimeout(activeTimer);
    activeTimer = null;
  }
  activeClearAt = null;
}
