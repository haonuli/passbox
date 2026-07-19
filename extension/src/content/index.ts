/**
 * Content Script 入口
 *
 * - 页面加载后扫描表单
 * - 对每个 password 字段注入图标（登录凭证填充）
 * - 检测地址表单 / 信用卡表单，注入图标（D-04）
 * - 监听表单 submit 事件，捕获凭证
 * - 图标点击 -> 发消息到 background -> 填充表单或展示选择浮层
 * - 使用 MutationObserver 监听动态表单
 */
import { findPasswordFields, findUsernameField, setupMutationObserver } from './form-detector';
import { detectAddressForm, detectCardForm } from './form-detector-identity';
import type { AddressFormFields, CardFormFields } from './form-detector-identity';
import { fillForm } from './form-filler';
import { fillAddressForm, fillCardForm } from './form-filler-identity';
import { injectIcon, createSelectionOverlay, positionOverlayBelowField } from './field-icon';
import { showFillConfirmation, showSaveConfirmation } from './confirm-overlay';
import type { FillIdentity, FillCard, Message, MessageResponse } from '../types';

/** 填充凭证 */
interface FillCredential {
  username: string;
  password: string;
}

/** 已添加 submit 监听的表单集合 */
const processedForms = new WeakSet<HTMLFormElement>();

/**
 * M3 修复：用户在当前页面已拒绝保存的 (domain, username) 集合。
 * 同一凭证重复 submit 时不重复弹窗，避免骚扰。
 */
const dismissedSaves = new Set<string>();

/** 发送消息到 background */
function sendMessage<T>(message: Message): Promise<MessageResponse<T>> {
  return chrome.runtime.sendMessage(message) as Promise<MessageResponse<T>>;
}

/** 移除页面上所有 PassBox 选择浮层 */
function removeAllOverlays(): void {
  document.querySelectorAll('.passbox-selection-overlay').forEach((el) => el.remove());
}

/** 处理登录图标点击：获取匹配凭证并填充或展示选择浮层 */
async function handleLoginIconClick(passwordField: HTMLInputElement): Promise<void> {
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

  // 单个匹配：M2 修复 — 显示确认卡片，用户点击「填充」后才填充
  if (credentials.length === 1) {
    const cred = credentials[0];
    const usernameField = findUsernameField(passwordField);
    showFillConfirmation(
      {
        title: cred.username || '(无用户名)',
        subtitle: location.hostname,
      },
      passwordField,
      () => {
        fillForm(usernameField, passwordField, cred.username, cred.password);
      },
    );
    return;
  }

  // 多个匹配：展示选择浮层
  const overlay = createSelectionOverlay(
    credentials.map((c) => ({
      title: c.username || '(无用户名)',
    })),
    (index) => {
      const cred = credentials[index];
      const usernameField = findUsernameField(passwordField);
      fillForm(usernameField, passwordField, cred.username, cred.password);
    },
  );

  positionOverlayBelowField(overlay, passwordField);
}

/** 处理身份信息图标点击：获取身份列表并填充或展示选择浮层 */
async function handleIdentityIconClick(
  fields: AddressFormFields,
  anchorField: HTMLInputElement,
): Promise<void> {
  removeAllOverlays();

  const response = await sendMessage<FillIdentity[] | null>({
    type: 'FILL_IDENTITY',
  });

  if (!response.ok) {
    return;
  }

  const identities = response.data;
  if (!identities || identities.length === 0) {
    return;
  }

  // 单个匹配：M2 修复 — 显示确认卡片，用户点击「填充」后才填充
  if (identities.length === 1) {
    const identity = identities[0];
    const fullName = `${identity.firstName} ${identity.lastName}`.trim();
    showFillConfirmation(
      {
        title: fullName || identity.title,
        subtitle: identity.email || identity.phone,
      },
      anchorField,
      () => {
        fillAddressForm(fields, identity);
      },
    );
    return;
  }

  // 多个匹配：展示选择浮层
  const overlay = createSelectionOverlay(
    identities.map((id) => {
      const fullName = `${id.firstName} ${id.lastName}`.trim();
      return {
        title: fullName || id.title,
        subtitle: id.email || id.phone,
      };
    }),
    (index) => {
      fillAddressForm(fields, identities[index]);
    },
  );

  positionOverlayBelowField(overlay, anchorField);
}

/** 处理信用卡图标点击：获取卡列表并填充或展示选择浮层 */
async function handleCardIconClick(
  fields: CardFormFields,
  anchorField: HTMLInputElement,
): Promise<void> {
  removeAllOverlays();

  const response = await sendMessage<FillCard[] | null>({
    type: 'FILL_CARD',
  });

  if (!response.ok) {
    return;
  }

  const cards = response.data;
  if (!cards || cards.length === 0) {
    return;
  }

  // 单个匹配：M2 修复 — 显示确认卡片，用户点击「填充」后才填充
  if (cards.length === 1) {
    const card = cards[0];
    const last4 = card.cardNumber ? card.cardNumber.slice(-4) : '';
    showFillConfirmation(
      {
        title: card.cardholder || card.title,
        subtitle: last4 ? `•••• ${last4}` : undefined,
      },
      anchorField,
      () => {
        fillCardForm(fields, card);
      },
    );
    return;
  }

  // 多个匹配：展示选择浮层
  const overlay = createSelectionOverlay(
    cards.map((c) => {
      const last4 = c.cardNumber ? c.cardNumber.slice(-4) : '';
      return {
        title: c.cardholder || c.title,
        subtitle: last4 ? `•••• ${last4}` : undefined,
      };
    }),
    (index) => {
      fillCardForm(fields, cards[index]);
    },
  );

  positionOverlayBelowField(overlay, anchorField);
}

/** 为 password 字段注入图标 */
function setupPasswordField(passwordField: HTMLInputElement): void {
  injectIcon(passwordField, () => {
    void handleLoginIconClick(passwordField);
  });
}

/** 选取地址表单的锚点字段（图标注入位置） */
function pickAddressAnchor(fields: AddressFormFields): HTMLInputElement | null {
  return (
    fields.firstName ||
    fields.lastName ||
    fields.address ||
    fields.email ||
    fields.phone ||
    fields.zip
  );
}

/** 为地址表单注入图标 */
function setupAddressForm(fields: AddressFormFields): void {
  const anchor = pickAddressAnchor(fields);
  if (!anchor) return;

  injectIcon(anchor, () => {
    void handleIdentityIconClick(fields, anchor);
  });
}

/** 为信用卡表单注入图标 */
function setupCardForm(fields: CardFormFields): void {
  if (!fields.cardNumber) return;
  const anchor = fields.cardNumber;

  injectIcon(anchor, () => {
    void handleCardIconClick(fields, anchor);
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

    if (!username || !password) return;

    // M3 修复：不直接保存，先询问用户。
    // 用户已拒绝过的 (domain, username) 组合不再弹窗。
    const dismissKey = `${location.hostname}::${username}`;
    if (dismissedSaves.has(dismissKey)) return;

    showSaveConfirmation(
      location.hostname,
      username,
      () => {
        sendMessage({
          type: 'SAVE_DETECTED',
          domain: location.hostname,
          username,
          password,
        }).catch(() => {
          // 扩展上下文可能已失效，忽略错误
        });
      },
      () => {
        // 用户拒绝保存：记录到内存集合，本页面会话内不再询问
        dismissedSaves.add(dismissKey);
      },
    );
  });
}

/** 扫描页面并注入图标 + 设置表单监听 */
function scanAndInject(): void {
  // 1. 登录表单（password 字段）
  const passwordFields = findPasswordFields();
  for (const field of passwordFields) {
    setupPasswordField(field);
  }

  // 2. 地址表单（D-04）
  const addressForm = detectAddressForm();
  if (addressForm) {
    setupAddressForm(addressForm);
  }

  // 3. 信用卡表单（D-04）
  const cardForm = detectCardForm();
  if (cardForm) {
    setupCardForm(cardForm);
  }

  // 4. 表单 submit 监听
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
