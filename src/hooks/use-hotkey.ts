/**
 * 集中式键盘快捷键 Hook (UX-001)
 *
 * 自实现轻量快捷键管理（避免引入 react-hotkeys-hook 依赖）。
 *
 * 支持：
 *   - `mod` 修饰键：macOS = ⌘，Windows/Linux = Ctrl
 *   - `shift` / `alt` / `ctrl` / `meta` 显式修饰键
 *   - 方向键（up/down/left/right）、Enter、Esc、Space、Delete、/
 *   - 输入框聚焦时默认忽略非 mod 组合键（可通过 ignoreInput=false 关闭）
 *
 * 用法：
 *   useHotkey('mod+k', () => focusSearch());
 *   useHotkey('mod+n', () => createItem());
 *   useHotkey('ArrowDown', () => moveDown(), { ignoreInput: true });
 *
 * @see docs/UX_OPTIMIZATION.md UX-001
 */
'use client';

import { useEffect } from 'react';

export interface UseHotkeyOptions {
  /** 是否启用，默认 true */
  enabled?: boolean;
  /** 输入框聚焦时是否忽略，默认 true。mod 组合键不受此限制 */
  ignoreInput?: boolean;
  /** 是否阻止默认行为，默认 true */
  preventDefault?: boolean;
}

const INPUT_TAGS = new Set(['INPUT', 'TEXTAREA', 'SELECT']);

function isInputFocused(): boolean {
  if (typeof document === 'undefined') return false;
  const el = document.activeElement;
  if (!el) return false;
  if (el instanceof HTMLElement && el.isContentEditable) return true;
  return INPUT_TAGS.has(el.tagName);
}

export function isMac(): boolean {
  if (typeof navigator === 'undefined') return false;
  return /Mac|iPod|iPhone|iPad/.test(navigator.platform);
}

interface ParsedCombo {
  needMeta: boolean;
  needCtrl: boolean;
  needShift: boolean;
  needAlt: boolean;
  key: string;
}

/** 解析快捷键字符串，主键统一小写 */
function parseCombo(combo: string): ParsedCombo {
  const parts = combo.toLowerCase().split('+').map((s) => s.trim());
  let needMeta = false;
  let needCtrl = false;
  let needShift = false;
  let needAlt = false;
  let key = '';

  for (const p of parts) {
    if (p === 'mod') {
      if (isMac()) needMeta = true;
      else needCtrl = true;
    } else if (p === 'cmd' || p === 'meta' || p === 'command') {
      needMeta = true;
    } else if (p === 'ctrl' || p === 'control') {
      needCtrl = true;
    } else if (p === 'shift') {
      needShift = true;
    } else if (p === 'alt' || p === 'option' || p === 'opt') {
      needAlt = true;
    } else if (p === 'space') {
      key = ' ';
    } else if (p === 'esc' || p === 'escape') {
      key = 'escape';
    } else if (p === 'del' || p === 'delete') {
      key = 'delete';
    } else if (p === 'up') {
      key = 'arrowup';
    } else if (p === 'down') {
      key = 'arrowdown';
    } else if (p === 'left') {
      key = 'arrowleft';
    } else if (p === 'right') {
      key = 'arrowright';
    } else if (p === 'enter' || p === 'return') {
      key = 'enter';
    } else if (p === '/' || p === '?' || p === '.') {
      key = p;
    } else if (p.length === 1) {
      key = p;
    } else {
      key = p;
    }
  }

  return { needMeta, needCtrl, needShift, needAlt, key };
}

export function useHotkey(
  combo: string,
  handler: (e: KeyboardEvent) => void,
  options: UseHotkeyOptions = {},
): void {
  const { enabled = true, ignoreInput = true, preventDefault = true } = options;

  useEffect(() => {
    if (!enabled) return;
    const parsed = parseCombo(combo);

    const onKeyDown = (e: KeyboardEvent) => {
      // 输入框聚焦时：mod 组合键仍允许，其他键忽略
      if (ignoreInput && isInputFocused()) {
        const isModCombo = parsed.needMeta || parsed.needCtrl;
        if (!isModCombo) return;
      }

      const key = e.key.toLowerCase();
      if (key !== parsed.key) return;

      // 修饰键正向匹配
      if (parsed.needMeta && !e.metaKey) return;
      if (parsed.needCtrl && !e.ctrlKey) return;
      if (parsed.needShift && !e.shiftKey) return;
      if (parsed.needAlt && !e.altKey) return;

      // 反向匹配：单字符主键时，多余的 shift/alt 不触发（避免快捷键冲突）
      if (parsed.key.length === 1) {
        if (!parsed.needShift && e.shiftKey) return;
        if (!parsed.needAlt && e.altKey) return;
      }

      if (preventDefault) e.preventDefault();
      handler(e);
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [combo, enabled, ignoreInput, preventDefault, handler]);
}
