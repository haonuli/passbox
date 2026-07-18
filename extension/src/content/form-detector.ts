/**
 * 表单检测模块
 */

/** 判断元素是否可见 */
function isVisible(element: HTMLInputElement): boolean {
  if (element.hidden || element.disabled) return false;

  const rect = element.getBoundingClientRect();
  if (rect.width === 0 || rect.height === 0) return false;

  const style = window.getComputedStyle(element);
  if (style.display === 'none' || style.visibility === 'hidden') return false;
  if (style.opacity === '0') return false;

  return true;
}

/**
 * 查找页面所有可见的 input[type="password"]
 */
export function findPasswordFields(): HTMLInputElement[] {
  const fields = Array.from(document.querySelectorAll<HTMLInputElement>('input[type="password"]'));
  return fields.filter(isVisible);
}

/**
 * 查找用户名字段
 *
 * 向上找 form，在 form 内查找 input[type="text/email"] 或 input[name*="user/email/account"]。
 * 优先查找 password 字段之前的最近匹配项。
 */
export function findUsernameField(passwordField: HTMLInputElement): HTMLInputElement | null {
  const form = passwordField.form;
  if (!form) return null;

  const inputs = Array.from(form.querySelectorAll<HTMLInputElement>('input'));
  const passwordIndex = inputs.indexOf(passwordField);

  // 从 password 字段向前查找
  for (let i = passwordIndex - 1; i >= 0; i--) {
    const input = inputs[i];
    if (!isVisible(input)) continue;

    const type = input.type.toLowerCase();
    const name = (input.name || '').toLowerCase();
    const id = (input.id || '').toLowerCase();

    if (type === 'email') return input;
    if (type === 'text') {
      if (
        name.includes('user') || name.includes('email') || name.includes('account') ||
        id.includes('user') || id.includes('email') || id.includes('account')
      ) {
        return input;
      }
    }
  }

  // 如果没找到明确的用户名字段，回退到 form 中第一个 text/email input
  for (const input of inputs) {
    if (input === passwordField) continue;
    if (!isVisible(input)) continue;
    const type = input.type.toLowerCase();
    if (type === 'text' || type === 'email') {
      return input;
    }
  }

  return null;
}

/**
 * 设置 MutationObserver 监听 DOM 变化
 *
 * 检测新添加的表单元素时触发回调。
 */
export function setupMutationObserver(callback: () => void): MutationObserver {
  let debounceTimer: number | undefined;

  const observer = new MutationObserver(() => {
    // 防抖：避免频繁触发
    if (debounceTimer !== undefined) {
      window.clearTimeout(debounceTimer);
    }
    debounceTimer = window.setTimeout(() => {
      callback();
    }, 200);
  });

  observer.observe(document.body, { childList: true, subtree: true });
  return observer;
}
