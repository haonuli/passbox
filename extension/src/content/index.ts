/**
 * Content Script 入口
 *
 * - 页面加载后扫描表单
 * - 对每个 password 字段注入图标
 * - 监听表单 submit 事件，捕获凭证
 * - 图标点击 -> 发消息到 background -> 填充表单或展示选择浮层
 * - 使用 MutationObserver 监听动态表单
 */
import { findPasswordFields, findUsernameField, setupMutationObserver } from './form-detector';
import { fillForm } from './form-filler';
import { injectIcon, createSelectionOverlay } from './field-icon';
import type { Message, MessageResponse } from '../types';

/** 填充凭证 */
interface FillCredential {
  username: string;
  password: string;
}

/** 已添加 submit 监听的表单集合 */
const processedForms = new WeakSet<HTMLFormElement>();

/** 发送消息到 background */
function sendMessage<T>(message: Message): Promise<MessageResponse<T>> {
  return chrome.runtime.sendMessage(message) as Promise<MessageResponse<T>>;
}

/** 移除页面上所有 PassBox 选择浮层 */
function removeAllOverlays(): void {
  document.querySelectorAll('.passbox-selection-overlay').forEach((el) => el.remove());
}

/** 处理图标点击：获取匹配凭证并填充或展示选择浮层 */
async function handleIconClick(passwordField: HTMLInputElement): Promise<void> {
  // 先移除已有浮层
  removeAllOverlays();

  const response = await sendMessage<FillCredential[] | null>({
    type: 'FILL',
    domain: location.hostname,
  });

  if (!response.ok) {
    return;
  }

  const credentials = response.data;
  if (!credentials || credentials.length === 0) {
    return;
  }

  // 单个匹配：直接填充
  if (credentials.length === 1) {
    const { username, password } = credentials[0];
    const usernameField = findUsernameField(passwordField);
    fillForm(usernameField, passwordField, username, password);
    return;
  }

  // 多个匹配：展示选择浮层
  const overlay = createSelectionOverlay(
    credentials.map((c) => ({
      username: c.username,
      title: c.username || '未命名',
    })),
    (index) => {
      const cred = credentials[index];
      const usernameField = findUsernameField(passwordField);
      fillForm(usernameField, passwordField, cred.username, cred.password);
    },
  );

  // 定位浮层到 password 字段下方
  const rect = passwordField.getBoundingClientRect();
  overlay.style.position = 'fixed';
  overlay.style.top = `${rect.bottom + 4}px`;
  overlay.style.left = `${rect.left}px`;

  document.body.appendChild(overlay);

  // 点击页面其他区域时关闭浮层
  setTimeout(() => {
    const onOutsideClick = (e: MouseEvent) => {
      if (!overlay.contains(e.target as Node)) {
        overlay.remove();
        document.removeEventListener('click', onOutsideClick, true);
      }
    };
    document.addEventListener('click', onOutsideClick, true);
  }, 0);
}

/** 为 password 字段注入图标 */
function setupPasswordField(passwordField: HTMLInputElement): void {
  injectIcon(passwordField, () => {
    void handleIconClick(passwordField);
  });
}

/** 为表单添加 submit 监听以捕获凭证 */
function setupFormListener(form: HTMLFormElement): void {
  if (processedForms.has(form)) return;
  processedForms.add(form);

  form.addEventListener('submit', () => {
    const passwordFields = Array.from(
      form.querySelectorAll<HTMLInputElement>('input[type="password"]'),
    );
    const passwordField = passwordFields[0];
    if (!passwordField) return;

    const usernameField = findUsernameField(passwordField);
    const username = usernameField?.value ?? '';
    const password = passwordField.value;

    if (username && password) {
      sendMessage({
        type: 'SAVE_DETECTED',
        domain: location.hostname,
        username,
        password,
      }).catch(() => {
        // 扩展上下文可能已失效，忽略错误
      });
    }
  });
}

/** 扫描页面并注入图标 + 设置表单监听 */
function scanAndInject(): void {
  const passwordFields = findPasswordFields();
  for (const field of passwordFields) {
    setupPasswordField(field);
  }

  const forms = document.querySelectorAll('form');
  for (const form of forms) {
    setupFormListener(form);
  }
}

// 初始扫描
scanAndInject();

// 监听动态表单
setupMutationObserver(() => {
  scanAndInject();
});
