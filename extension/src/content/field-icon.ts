/**
 * 图标注入模块
 */

/** PassBox Logo SVG（内联） */
const PASSBOX_ICON_SVG = `
<svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
  <path d="M12 2L4 5v6c0 5.5 3.8 10.7 8 12 4.2-1.3 8-6.5 8-12V5l-8-3z" fill="#4F46E5"/>
  <path d="M12 8a2 2 0 00-1 3.7V15h2v-2.3A2 2 0 0012 8z" fill="white"/>
</svg>`.trim();

/** 已注入图标的标记属性 */
const ICON_ATTR = 'data-passbox-icon-injected';

/**
 * 在 password 字段右侧注入图标按钮
 *
 * 点击触发 onClick 回调。
 */
export function injectIcon(passwordField: HTMLInputElement, onClick: () => void): void {
  // 避免重复注入
  if (passwordField.hasAttribute(ICON_ATTR)) return;
  passwordField.setAttribute(ICON_ATTR, 'true');

  const wrapper = passwordField.parentElement;
  if (!wrapper) return;

  // 确保 wrapper 是 positioned 元素
  const wrapperStyle = window.getComputedStyle(wrapper);
  if (wrapperStyle.position === 'static') {
    wrapper.style.position = 'relative';
  }

  const btn = document.createElement('button');
  btn.type = 'button';
  btn.title = 'PassBox 自动填充';
  btn.innerHTML = PASSBOX_ICON_SVG;
  btn.style.cssText = [
    'position: absolute',
    'right: 8px',
    'top: 50%',
    'transform: translateY(-50%)',
    'width: 16px',
    'height: 16px',
    'padding: 0',
    'margin: 0',
    'border: none',
    'background: transparent',
    'cursor: pointer',
    'z-index: 9999',
    'display: flex',
    'align-items: center',
    'justify-content: center',
  ].join(';');

  btn.addEventListener('click', (e) => {
    e.preventDefault();
    e.stopPropagation();
    onClick();
  });

  // 鼠标悬停效果
  btn.addEventListener('mouseenter', () => {
    btn.style.opacity = '0.8';
  });
  btn.addEventListener('mouseleave', () => {
    btn.style.opacity = '1';
  });

  wrapper.appendChild(btn);
}

/**
 * 创建选择浮层（多个匹配时展示）
 *
 * 返回浮层元素，由调用者决定插入位置。
 */
export function createSelectionOverlay(
  items: { username: string; title: string }[],
  onSelect: (index: number) => void,
): HTMLElement {
  const overlay = document.createElement('div');
  overlay.className = 'passbox-selection-overlay';
  overlay.style.cssText = [
    'position: absolute',
    'background: white',
    'border: 1px solid #d1d5db',
    'border-radius: 6px',
    'box-shadow: 0 4px 12px rgba(0,0,0,0.15)',
    'z-index: 10000',
    'min-width: 220px',
    'max-height: 280px',
    'overflow-y: auto',
    'font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
  ].join(';');

  items.forEach((item, index) => {
    const option = document.createElement('div');
    option.style.cssText = [
      'padding: 10px 14px',
      'cursor: pointer',
      'border-bottom: 1px solid #f3f4f6',
      'font-size: 13px',
      'color: #1f2937',
    ].join(';');

    const titleEl = document.createElement('div');
    titleEl.textContent = item.username || item.title;
    titleEl.style.fontWeight = '500';

    const subtitleEl = document.createElement('div');
    subtitleEl.textContent = item.title;
    subtitleEl.style.cssText = 'font-size: 11px; color: #6b7280; margin-top: 2px;';

    option.appendChild(titleEl);
    option.appendChild(subtitleEl);

    option.addEventListener('mouseenter', () => {
      option.style.backgroundColor = '#f0f0f0';
    });
    option.addEventListener('mouseleave', () => {
      option.style.backgroundColor = '';
    });
    option.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      onSelect(index);
      overlay.remove();
    });

    overlay.appendChild(option);
  });

  return overlay;
}
