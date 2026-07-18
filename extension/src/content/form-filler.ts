/**
 * 表单填充模块
 */

/**
 * 填充单个字段
 *
 * 使用原生 setter 触发 React/Vue 兼容的 input/change 事件。
 */
export function fillField(field: HTMLInputElement, value: string): void {
  const nativeInputValueSetter = Object.getOwnPropertyDescriptor(
    window.HTMLInputElement.prototype,
    'value',
  )?.set;

  nativeInputValueSetter?.call(field, value);
  field.dispatchEvent(new Event('input', { bubbles: true }));
  field.dispatchEvent(new Event('change', { bubbles: true }));
}

/**
 * 填充表单（用户名 + 密码）
 */
export function fillForm(
  usernameField: HTMLInputElement | null,
  passwordField: HTMLInputElement,
  username: string,
  password: string,
): void {
  if (usernameField) {
    fillField(usernameField, username);
  }
  fillField(passwordField, password);
}
