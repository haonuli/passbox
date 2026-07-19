/**
 * 地址 / 信用卡表单检测模块（D-04）
 *
 * 检测策略：
 * 1. 优先匹配 autocomplete 属性（HTML 标准，最可靠）
 * 2. 回退到 name/id 正则匹配
 *
 * 字段名约定与 Web App src/lib/item-types.ts 中 identity / credit_card 类型保持一致。
 */
import { isVisible } from './form-detector';

/** 地址表单字段映射 */
export interface AddressFormFields {
  firstName: HTMLInputElement | null;
  lastName: HTMLInputElement | null;
  address: HTMLInputElement | null;
  city: HTMLInputElement | null;
  state: HTMLInputElement | null;
  zip: HTMLInputElement | null;
  country: HTMLInputElement | null;
  phone: HTMLInputElement | null;
  email: HTMLInputElement | null;
}

/** 信用卡表单字段映射 */
export interface CardFormFields {
  cardholder: HTMLInputElement | null;
  cardNumber: HTMLInputElement | null;
  expiry: HTMLInputElement | null;
  cvv: HTMLInputElement | null;
}

/** 单字段匹配规则 */
interface FieldMatchRule {
  /** autocomplete 属性匹配值（小写） */
  autocomplete: string[];
  /** name/id 正则匹配（不区分大小写） */
  patterns: RegExp[];
}

/** 地址字段匹配规则表 */
const ADDRESS_FIELD_RULES: Record<keyof AddressFormFields, FieldMatchRule> = {
  firstName: {
    autocomplete: ['given-name', 'firstname', 'first-name'],
    patterns: [/first_?name/, /\bfname\b/, /\bgiven_?name\b/],
  },
  lastName: {
    autocomplete: ['family-name', 'lastname', 'last-name'],
    patterns: [/last_?name/, /\blname\b/, /\bfamily_?name\b/, /\bsurname\b/],
  },
  address: {
    autocomplete: ['address-line1', 'street-address', 'address1', 'address'],
    patterns: [/^address/, /street/, /\baddr1\b/, /\baddress_?line_?1\b/],
  },
  city: {
    autocomplete: ['address-level2', 'city', 'locality'],
    patterns: [/^city/, /\blocality\b/, /\btown\b/],
  },
  state: {
    autocomplete: ['address-level1', 'state', 'province', 'region'],
    patterns: [/^state/, /\bprovince\b/, /\bregion\b/],
  },
  zip: {
    autocomplete: ['postal-code', 'postal', 'zip'],
    patterns: [/^zip/, /^postal/, /\bzipcode\b/],
  },
  country: {
    autocomplete: ['country-name', 'country'],
    patterns: [/^country/],
  },
  phone: {
    autocomplete: ['tel', 'tel-national', 'phone'],
    patterns: [/^phone/, /^tel/, /^mobile/, /\bcell_?phone\b/],
  },
  email: {
    autocomplete: ['email', 'email-work'],
    patterns: [/^email/, /^e_?mail/],
  },
};

/** 信用卡字段匹配规则表 */
const CARD_FIELD_RULES: Record<keyof CardFormFields, FieldMatchRule> = {
  cardholder: {
    autocomplete: ['cc-name', 'cc-name-full', 'cardholder'],
    patterns: [/card_?holder/, /name_?on_?card/, /^cc_?name$/],
  },
  cardNumber: {
    autocomplete: ['cc-number', 'cc-number-full', 'card-number'],
    patterns: [/card_?number/, /cc_?number/, /\bpan\b/, /^cc$/],
  },
  expiry: {
    autocomplete: ['cc-exp', 'cc-exp-month', 'cc-exp-year'],
    patterns: [/expir/, /exp_?date/, /exp_?month/, /exp_?year/],
  },
  cvv: {
    autocomplete: ['cc-csc', 'cc-cvc', 'cc-cvv'],
    patterns: [/^cvv/, /^cvc/, /^csc/, /security_?code/, /card_?code/],
  },
};

/** 判断字段是否符合规则 */
function matchField(input: HTMLInputElement, rule: FieldMatchRule): boolean {
  const autocomplete = (input.autocomplete || '').toLowerCase().trim();
  if (autocomplete && rule.autocomplete.includes(autocomplete)) {
    return true;
  }

  const nameId = `${input.name || ''} ${input.id || ''}`.toLowerCase();
  if (rule.patterns.some((p) => p.test(nameId))) {
    return true;
  }

  return false;
}

/** 计算映射中非空字段数量 */
function countMatched<T>(fields: T): number {
  return Object.values(fields as Record<string, unknown>).filter(
    (v): v is HTMLInputElement => v !== null,
  ).length;
}

/**
 * 检测页面上的地址表单
 *
 * 判定条件：至少 3 个字段命中（如 firstName + lastName + address，或 address + city + zip）。
 * 返回第一个满足条件的字段映射；无匹配返回 null。
 */
export function detectAddressForm(): AddressFormFields | null {
  const inputs = Array.from(document.querySelectorAll<HTMLInputElement>('input'));
  const visibleInputs = inputs.filter(isVisible);

  // 处理 select 元素（state/country 常用下拉框）
  const selects = Array.from(document.querySelectorAll<HTMLSelectElement>('select')).filter(
    (s) => {
      if (s.hidden || s.disabled) return false;
      const rect = s.getBoundingClientRect();
      return rect.width > 0 && rect.height > 0;
    },
  );

  const fields: AddressFormFields = {
    firstName: null,
    lastName: null,
    address: null,
    city: null,
    state: null,
    zip: null,
    country: null,
    phone: null,
    email: null,
  };

  // input 匹配
  for (const input of visibleInputs) {
    (Object.keys(ADDRESS_FIELD_RULES) as (keyof AddressFormFields)[]).forEach((key) => {
      if (fields[key] !== null) return;
      if (matchField(input, ADDRESS_FIELD_RULES[key])) {
        fields[key] = input;
      }
    });
  }

  // select 匹配（仅 state / country，回退到 input 之前不覆盖）
  for (const select of selects) {
    (['state', 'country'] as (keyof AddressFormFields)[]).forEach((key) => {
      if (fields[key] !== null) return;
      if (matchField(select as unknown as HTMLInputElement, ADDRESS_FIELD_RULES[key])) {
        // 保留 select 元素的引用，填充器需要特殊处理（select 用 .value 直接赋值）
        fields[key] = select as unknown as HTMLInputElement;
      }
    });
  }

  return countMatched(fields) >= 3 ? fields : null;
}

/**
 * 检测页面上的信用卡表单
 *
 * 判定条件：cardNumber 必须命中，且至少有 1 个其他字段（cvv / expiry / cardholder）命中。
 * 返回第一个满足条件的字段映射；无匹配返回 null。
 */
export function detectCardForm(): CardFormFields | null {
  const inputs = Array.from(document.querySelectorAll<HTMLInputElement>('input')).filter(isVisible);

  const fields: CardFormFields = {
    cardholder: null,
    cardNumber: null,
    expiry: null,
    cvv: null,
  };

  for (const input of inputs) {
    (Object.keys(CARD_FIELD_RULES) as (keyof CardFormFields)[]).forEach((key) => {
      if (fields[key] !== null) return;
      if (matchField(input, CARD_FIELD_RULES[key])) {
        fields[key] = input;
      }
    });
  }

  // cardNumber 必须命中，且至少 1 个其他字段命中
  if (!fields.cardNumber) return null;
  const others = (['cardholder', 'expiry', 'cvv'] as const).filter((k) => fields[k] !== null).length;
  return others >= 1 ? fields : null;
}
