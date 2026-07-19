/**
 * 用户确认浮层模块 (M2/M3 修复)
 *
 * - showFillConfirmation: 自动填充前的确认卡片 (M2)
 *   防止用户误点击图标直接填充错误凭证（如钓鱼网站伪装）。
 * - showSaveConfirmation: 自动保存前的确认横幅 (M3)
 *   form submit 后不直接保存，先询问用户是否保存检测到的凭证。
 */
import { positionOverlayBelowField } from './field-icon';
import type { OverlayItem } from './field-icon';

/** 浮层根 class，便于清理 */
const FILL_CONFIRM_CLASS = 'passbox-fill-confirmation';
const SAVE_BANNER_CLASS = 'passbox-save-confirmation';

/** 通用按钮样式 */
const BUTTON_BASE_STYLE = [
  'padding: 6px 12px',
  'font-size: 13px',
  'border-radius: 4px',
  'cursor: pointer',
  'font-family: inherit',
].join(';');

/**
 * 显示填充确认卡片 (M2)
 *
 * 在指定字段下方显示一张卡片，展示待填充的条目信息。
 * 用户点击「填充」按钮确认，点击「取消」或外部区域取消。
 *
 * @param item 待填充的条目信息
 * @param anchorField 锚点字段（图标所在字段），浮层定位在其下方
 * @param onConfirm 用户点击「填充」时调用
 */
export function showFillConfirmation(
  item: OverlayItem,
  anchorField: HTMLInputElement,
  onConfirm: () => void,
): void {
  // 先清理已有浮层，避免重复
  document.querySelectorAll(`.${FILL_CONFIRM_CLASS}`).forEach((el) => el.remove());

  const card = document.createElement('div');
  card.className = FILL_CONFIRM_CLASS;
  card.style.cssText = [
    'background: white',
    'border: 1px solid #d1d5db',
    'border-radius: 8px',
    'box-shadow: 0 4px 16px rgba(0,0,0,0.2)',
    'min-width: 240px',
    'padding: 12px',
    'font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
  ].join(';');

  // 头部
  const header = document.createElement('div');
  header.textContent = '确认自动填充';
  header.style.cssText = 'font-size: 12px; color: #6b7280; margin-bottom: 8px;';
  card.appendChild(header);

  // 条目信息
  const infoContainer = document.createElement('div');
  infoContainer.style.cssText =
    'padding: 8px 0; border-bottom: 1px solid #f3f4f6; margin-bottom: 8px;';

  const titleEl = document.createElement('div');
  titleEl.textContent = item.title;
  titleEl.style.cssText = 'font-size: 14px; font-weight: 500; color: #1f2937;';
  infoContainer.appendChild(titleEl);

  if (item.subtitle) {
    const subtitleEl = document.createElement('div');
    subtitleEl.textContent = item.subtitle;
    subtitleEl.style.cssText = 'font-size: 12px; color: #6b7280; margin-top: 2px;';
    infoContainer.appendChild(subtitleEl);
  }

  card.appendChild(infoContainer);

  // 按钮区域
  const buttonGroup = document.createElement('div');
  buttonGroup.style.cssText = 'display: flex; gap: 8px; justify-content: flex-end;';

  const cancelButton = document.createElement('button');
  cancelButton.type = 'button';
  cancelButton.textContent = '取消';
  cancelButton.style.cssText = `${BUTTON_BASE_STYLE};border: 1px solid #d1d5db;background: white;color: #4b5563;`;
  cancelButton.addEventListener('mouseenter', () => {
    cancelButton.style.backgroundColor = '#f9fafb';
  });
  cancelButton.addEventListener('mouseleave', () => {
    cancelButton.style.backgroundColor = 'white';
  });

  const confirmButton = document.createElement('button');
  confirmButton.type = 'button';
  confirmButton.textContent = '填充';
  confirmButton.style.cssText = `${BUTTON_BASE_STYLE};border: none;background: #4F46E5;color: white;font-weight: 500;`;
  confirmButton.addEventListener('mouseenter', () => {
    confirmButton.style.backgroundColor = '#4338CA';
  });
  confirmButton.addEventListener('mouseleave', () => {
    confirmButton.style.backgroundColor = '#4F46E5';
  });

  buttonGroup.appendChild(cancelButton);
  buttonGroup.appendChild(confirmButton);
  card.appendChild(buttonGroup);

  // 事件
  cancelButton.addEventListener('click', (e) => {
    e.preventDefault();
    e.stopPropagation();
    card.remove();
  });
  confirmButton.addEventListener('click', (e) => {
    e.preventDefault();
    e.stopPropagation();
    card.remove();
    onConfirm();
  });

  positionOverlayBelowField(card, anchorField);
}

/**
 * 显示保存确认横幅 (M3)
 *
 * 在页面右上角显示一条横幅，询问用户是否保存检测到的凭证。
 * 用户点击「保存」时调用 onSave，点击「不保存」或关闭按钮时调用 onDismiss。
 *
 * @param domain 检测到凭证的域名
 * @param username 检测到的用户名（明文展示，便于用户确认）
 * @param onSave 用户点击「保存」时调用
 * @param onDismiss 用户点击「不保存」或关闭按钮时调用
 */
export function showSaveConfirmation(
  domain: string,
  username: string,
  onSave: () => void,
  onDismiss: () => void,
): void {
  // 同一域名已有横幅则先移除（避免重复）
  document
    .querySelectorAll(`.${SAVE_BANNER_CLASS}[data-domain="${domain}"]`)
    .forEach((el) => el.remove());

  const banner = document.createElement('div');
  banner.className = SAVE_BANNER_CLASS;
  banner.dataset.domain = domain;
  banner.style.cssText = [
    'position: fixed',
    'top: 16px',
    'right: 16px',
    'background: white',
    'border: 1px solid #d1d5db',
    'border-left: 4px solid #4F46E5',
    'border-radius: 8px',
    'box-shadow: 0 4px 16px rgba(0,0,0,0.15)',
    'padding: 12px 16px',
    'min-width: 320px',
    'max-width: 380px',
    'z-index: 10002',
    'font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
  ].join(';');

  // 头部
  const header = document.createElement('div');
  header.style.cssText = 'display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;';

  const titleEl = document.createElement('div');
  titleEl.textContent = 'PassBox 检测到新凭证';
  titleEl.style.cssText = 'font-size: 13px; font-weight: 600; color: #1f2937;';
  header.appendChild(titleEl);

  const closeButton = document.createElement('button');
  closeButton.type = 'button';
  closeButton.textContent = '×';
  closeButton.setAttribute('aria-label', '关闭');
  closeButton.style.cssText = `${BUTTON_BASE_STYLE};padding: 0 8px;border: none;background: transparent;color: #6b7280;font-size: 18px;line-height: 1;`;
  closeButton.addEventListener('click', () => {
    banner.remove();
    onDismiss();
  });
  header.appendChild(closeButton);

  banner.appendChild(header);

  // 凭证信息
  const info = document.createElement('div');
  info.style.cssText = 'font-size: 12px; color: #4b5563; margin-bottom: 10px;';

  const domainEl = document.createElement('div');
  domainEl.textContent = `域名：${domain}`;
  info.appendChild(domainEl);

  const usernameEl = document.createElement('div');
  // 用户名脱敏：仅显示前 2 位 + *** + 末 1 位
  const masked = maskUsername(username);
  usernameEl.textContent = `用户名：${masked}`;
  usernameEl.style.cssText = 'margin-top: 2px;';
  info.appendChild(usernameEl);

  banner.appendChild(info);

  // 按钮区域
  const buttonGroup = document.createElement('div');
  buttonGroup.style.cssText = 'display: flex; gap: 8px; justify-content: flex-end;';

  const dismissButton = document.createElement('button');
  dismissButton.type = 'button';
  dismissButton.textContent = '不保存';
  dismissButton.style.cssText = `${BUTTON_BASE_STYLE};border: 1px solid #d1d5db;background: white;color: #4b5563;`;
  dismissButton.addEventListener('mouseenter', () => {
    dismissButton.style.backgroundColor = '#f9fafb';
  });
  dismissButton.addEventListener('mouseleave', () => {
    dismissButton.style.backgroundColor = 'white';
  });

  const saveButton = document.createElement('button');
  saveButton.type = 'button';
  saveButton.textContent = '保存';
  saveButton.style.cssText = `${BUTTON_BASE_STYLE};border: none;background: #4F46E5;color: white;font-weight: 500;`;
  saveButton.addEventListener('mouseenter', () => {
    saveButton.style.backgroundColor = '#4338CA';
  });
  saveButton.addEventListener('mouseleave', () => {
    saveButton.style.backgroundColor = '#4F46E5';
  });

  buttonGroup.appendChild(dismissButton);
  buttonGroup.appendChild(saveButton);
  banner.appendChild(buttonGroup);

  // 事件
  dismissButton.addEventListener('click', (e) => {
    e.preventDefault();
    e.stopPropagation();
    banner.remove();
    onDismiss();
  });
  saveButton.addEventListener('click', (e) => {
    e.preventDefault();
    e.stopPropagation();
    banner.remove();
    onSave();
  });

  document.body.appendChild(banner);

  // 30 秒后自动消失（视为不保存）
  setTimeout(() => {
    if (banner.parentElement) {
      banner.remove();
      onDismiss();
    }
  }, 30_000);
}

/**
 * 用户名脱敏：前 2 位 + *** + 末 1 位
 * 长度 ≤ 3 时全部脱敏为 ***
 */
function maskUsername(username: string): string {
  if (username.length <= 3) {
    return '***';
  }
  return `${username.slice(0, 2)}***${username.slice(-1)}`;
}
