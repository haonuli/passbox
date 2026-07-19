/**
 * 地址 / 信用卡表单填充模块（D-04）
 *
 * - input 字段复用 form-filler.ts 的 fillField（native setter 触发 input/change 事件）
 * - select 字段（state/country 常用下拉框）使用 fillSelectField，按 value / 文本匹配
 */
import { fillField } from './form-filler';
import type { AddressFormFields, CardFormFields } from './form-detector-identity';
import type { FillIdentity, FillCard } from '../types';

/** 判断元素是否为 select（form-detector-identity 中将 select 强转为 input 存储） */
function isSelect(el: HTMLInputElement): boolean {
  return el.tagName.toLowerCase() === 'select';
}

/**
 * 填充 select 字段
 *
 * 优先匹配 option.value，回退到 option.text 包含匹配。
 */
function fillSelectField(select: HTMLInputElement, value: string): void {
  const selectEl = select as unknown as HTMLSelectElement;
  const lowerValue = value.toLowerCase();
  const options = Array.from(selectEl.options);

  const matchByValue = options.find((o) => o.value.toLowerCase() === lowerValue);
  if (matchByValue) {
    selectEl.value = matchByValue.value;
  } else {
    const matchByText = options.find((o) => o.text.toLowerCase().includes(lowerValue));
    if (matchByText) {
      selectEl.value = matchByText.value;
    } else {
      selectEl.value = value;
    }
  }

  selectEl.dispatchEvent(new Event('change', { bubbles: true }));
}

/**
 * 填充地址表单
 *
 * 跳过未识别（null）字段和 identity 中空值字段。
 */
export function fillAddressForm(fields: AddressFormFields, identity: FillIdentity): void {
  const entries: ReadonlyArray<readonly [keyof AddressFormFields, string]> = [
    ['firstName', identity.firstName],
    ['lastName', identity.lastName],
    ['address', identity.address],
    ['city', identity.city],
    ['state', identity.state],
    ['zip', identity.zip],
    ['country', identity.country],
    ['phone', identity.phone],
    ['email', identity.email],
  ];

  for (const [key, value] of entries) {
    const field = fields[key];
    if (!field || !value) continue;
    if (isSelect(field)) {
      fillSelectField(field, value);
    } else {
      fillField(field, value);
    }
  }
}

/**
 * 填充信用卡表单
 *
 * 跳过未识别（null）字段和 card 中空值字段。
 * 信用卡字段通常为 input，不处理 select。
 */
export function fillCardForm(fields: CardFormFields, card: FillCard): void {
  const entries: ReadonlyArray<readonly [keyof CardFormFields, string]> = [
    ['cardholder', card.cardholder],
    ['cardNumber', card.cardNumber],
    ['expiry', card.expiry],
    ['cvv', card.cvv],
  ];

  for (const [key, value] of entries) {
    const field = fields[key];
    if (!field || !value) continue;
    fillField(field, value);
  }
}
