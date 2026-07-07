/**
 * 密码生成器核心模块 (T5.1)
 *
 * 使用 crypto.getRandomValues 生成密码学安全随机数。
 * 支持可配置长度（8-64）、字符集（大写/小写/数字/符号）、避免易混淆字符。
 *
 * @see TASK_BREAKDOWN T5.1 验收标准
 */

/** 默认密码长度 */
export const DEFAULT_PASSWORD_LENGTH = 20;

/** 最小/最大密码长度 */
export const MIN_PASSWORD_LENGTH = 8;
export const MAX_PASSWORD_LENGTH = 64;

/** 字符集定义 */
const CHAR_SETS = {
  uppercase: 'ABCDEFGHIJKLMNOPQRSTUVWXYZ',
  lowercase: 'abcdefghijklmnopqrstuvwxyz',
  digits: '0123456789',
  symbols: '!@#$%^&*()_+-=[]{}|;:,.<>?',
};

/** 易混淆字符（avoidAmbiguous 时排除） */
const AMBIGUOUS_CHARS = new Set(['I', 'l', 'O', '0', '1']);

/** 密码生成选项 */
export interface PasswordGeneratorOptions {
  /** 密码长度，范围 8-64，默认 20 */
  length: number;
  /** 包含大写字母，默认 true */
  uppercase: boolean;
  /** 包含小写字母，默认 true */
  lowercase: boolean;
  /** 包含数字，默认 true */
  digits: boolean;
  /** 包含符号，默认 true */
  symbols: boolean;
  /** 避免易混淆字符（I/l/O/0/1），默认 false */
  avoidAmbiguous: boolean;
}

/** 默认生成选项 */
export const DEFAULT_OPTIONS: PasswordGeneratorOptions = {
  length: DEFAULT_PASSWORD_LENGTH,
  uppercase: true,
  lowercase: true,
  digits: true,
  symbols: true,
  avoidAmbiguous: false,
};

/**
 * 从可用字符集中移除易混淆字符。
 */
function filterAmbiguous(chars: string): string {
  return Array.from(chars)
    .filter((c) => !AMBIGUOUS_CHARS.has(c))
    .join('');
}

/**
 * 获取密码学安全随机整数 [0, max)。
 *
 * 使用 rejection sampling 避免模偏移（modulo bias）。
 */
function secureRandomInt(max: number): number {
  if (max <= 0) throw new RangeError('max 必须为正整数');
  const maxUint32 = 0xffffffff;
  const limit = maxUint32 - (maxUint32 % max);
  const buf = new Uint32Array(1);
  let val: number;
  do {
    crypto.getRandomValues(buf);
    val = buf[0];
  } while (val > limit);
  return val % max;
}

/**
 * 生成密码。
 *
 * @param options 生成选项
 * @returns 生成的密码字符串
 * @throws Error 当没有选择任何字符集时
 */
export function generatePassword(options: PasswordGeneratorOptions): string {
  const length = Math.max(MIN_PASSWORD_LENGTH, Math.min(MAX_PASSWORD_LENGTH, options.length));

  // 构建可用字符集
  let pool = '';
  const required: string[] = [];

  if (options.uppercase) {
    let chars = CHAR_SETS.uppercase;
    if (options.avoidAmbiguous) chars = filterAmbiguous(chars);
    pool += chars;
    required.push(chars[secureRandomInt(chars.length)]);
  }
  if (options.lowercase) {
    let chars = CHAR_SETS.lowercase;
    if (options.avoidAmbiguous) chars = filterAmbiguous(chars);
    pool += chars;
    required.push(chars[secureRandomInt(chars.length)]);
  }
  if (options.digits) {
    let chars = CHAR_SETS.digits;
    if (options.avoidAmbiguous) chars = filterAmbiguous(chars);
    pool += chars;
    required.push(chars[secureRandomInt(chars.length)]);
  }
  if (options.symbols) {
    const chars = CHAR_SETS.symbols;
    pool += chars;
    required.push(chars[secureRandomInt(chars.length)]);
  }

  if (pool.length === 0) {
    throw new Error('至少选择一种字符集');
  }

  // 生成剩余字符
  const remaining = length - required.length;
  const chars: string[] = [...required];

  for (let i = 0; i < Math.max(0, remaining); i++) {
    chars.push(pool[secureRandomInt(pool.length)]);
  }

  // Fisher-Yates 洗牌，确保必需字符位置随机
  for (let i = chars.length - 1; i > 0; i--) {
    const j = secureRandomInt(i + 1);
    [chars[i], chars[j]] = [chars[j], chars[i]];
  }

  return chars.slice(0, length).join('');
}
