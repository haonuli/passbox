/**
 * 集中化输入验证规则库
 *
 * 所有表单验证规则（zod schema + 正则）统一在此定义，
 * 供认证页面、条目表单等场景复用，确保验证规则一致且可维护。
 */
import { z } from 'zod';
import { isValidRecoveryCodeFormat } from './recovery-code';

// ============================================================
// 正则表达式
// ============================================================

/** 邮箱格式（RFC 5322 简化版） */
export const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** 中国大陆手机号 */
export const PHONE_REGEX = /^1[3-9]\d{9}$/;

/** IPv4 地址 */
export const IPV4_REGEX = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/;

/** URL 格式（支持 http/https，可选） */
export const URL_REGEX = /^(https?:\/\/)?([\w-]+(\.[\w-]+)+)([\w.,@?^=%&:/~+#-]*[\w@?^=%&/~+#-])?$/;

/** 信用卡号（13-19 位数字，可含空格） */
export const CREDIT_CARD_REGEX = /^[\d\s]{13,23}$/;

/** 端口号（1-65535） */
export const PORT_REGEX = /^([1-9]\d{0,3}|[1-5]\d{4}|6[0-4]\d{3}|65[0-4]\d{2}|655[0-2]\d|6553[0-5])$/;

/** SWIFT 代码（8 或 11 位字母数字） */
export const SWIFT_REGEX = /^[A-Z]{4}[A-Z]{2}[A-Z0-9]{2}([A-Z0-9]{3})?$/;

/** IBAN（国际银行账号，2 字母国家代码 + 2 位校验码 + 11-30 位字母数字） */
export const IBAN_REGEX = /^[A-Z]{2}\d{2}[A-Z0-9]{11,30}$/;

// ============================================================
// Zod Schema
// ============================================================

/** 邮箱验证 */
export const emailSchema = z
  .string()
  .trim()
  .min(1, '请输入邮箱地址')
  .email('请输入有效的邮箱地址');

/** 主密码验证（注册/恢复时使用，12位+大小写+数字） */
export const passwordSchema = z
  .string()
  .min(12, '主密码至少 12 位')
  .regex(/[a-z]/, '需包含小写字母')
  .regex(/[A-Z]/, '需包含大写字母')
  .regex(/\d/, '需包含数字');

/** 登录密码验证（仅需非空，强度校验在注册阶段完成） */
export const loginPasswordSchema = z.string().min(1, '请输入主密码');

/** 恢复码验证 */
export const recoveryCodeSchema = z
  .string()
  .trim()
  .min(1, '请输入恢复码')
  .refine(isValidRecoveryCodeFormat, '恢复码格式应为 PBOX-XXXX-XXXX-XXXX-XXXX');

/** URL 验证（可选字段，空值通过） */
export const urlSchema = z
  .string()
  .max(500, 'URL 不能超过 500 字符')
  .optional()
  .or(z.literal(''))
  .refine(
    (val) => !val || URL_REGEX.test(val),
    '请输入有效的网址，如 https://example.com',
  );

/** 手机号验证（可选字段，空值通过） */
export const phoneSchema = z
  .string()
  .max(20, '电话号码不能超过 20 字符')
  .optional()
  .or(z.literal(''))
  .refine(
    (val) => !val || PHONE_REGEX.test(val),
    '请输入有效的手机号（如 13800138000）',
  );

/** IPv4 验证（可选字段，空值通过） */
export const ipv4Schema = z
  .string()
  .max(45, 'IP 地址不能超过 45 字符')
  .optional()
  .or(z.literal(''))
  .refine(
    (val) => !val || (IPV4_REGEX.test(val) && val.split('.').every((octet) => Number(octet) <= 255)),
    '请输入有效的 IPv4 地址（如 192.168.1.1）',
  );

/** 端口验证（可选字段，空值通过） */
export const portSchema = z
  .string()
  .max(10, '端口不能超过 10 字符')
  .optional()
  .or(z.literal(''))
  .refine(
    (val) => !val || PORT_REGEX.test(val),
    '请输入有效的端口号（1-65535）',
  );

/** 信用卡号验证（可选字段，空值通过） */
export const creditCardSchema = z
  .string()
  .max(23, '信用卡号不能超过 23 字符')
  .optional()
  .or(z.literal(''))
  .refine(
    (val) => !val || CREDIT_CARD_REGEX.test(val),
    '请输入有效的信用卡号（13-19 位数字）',
  );

/** SWIFT 代码验证（可选字段，空值通过） */
export const swiftSchema = z
  .string()
  .max(11, 'SWIFT 代码不能超过 11 字符')
  .optional()
  .or(z.literal(''))
  .refine(
    (val) => !val || SWIFT_REGEX.test(val.toUpperCase()),
    '请输入有效的 SWIFT 代码（8 或 11 位）',
  );

/** IBAN 验证（可选字段，空值通过） */
export const ibanSchema = z
  .string()
  .max(34, 'IBAN 不能超过 34 字符')
  .optional()
  .or(z.literal(''))
  .refine(
    (val) => !val || IBAN_REGEX.test(val.toUpperCase().replace(/\s/g, '')),
    '请输入有效的 IBAN 号码',
  );

/** 有效期验证（MM/YY 格式） */
export const expirySchema = z
  .string()
  .max(5, '有效期不能超过 5 字符')
  .optional()
  .or(z.literal(''))
  .refine(
    (val) => !val || /^(0[1-9]|1[0-2])\/\d{2}$/.test(val),
    '请输入有效的有效期（MM/YY 格式）',
  );

/** CVV 验证（3-4 位数字） */
export const cvvSchema = z
  .string()
  .max(4, 'CVV 不能超过 4 字符')
  .optional()
  .or(z.literal(''))
  .refine(
    (val) => !val || /^\d{3,4}$/.test(val),
    '请输入有效的安全码（3-4 位数字）',
  );

// ============================================================
// 条目字段名 -> 验证 schema 映射
// ============================================================

/**
 * 根据字段名返回对应的验证 schema。
 * 条目表单 buildSchema() 调用此函数为特定字段附加类型化验证。
 *
 * 未匹配的字段返回 null，由调用方使用默认的字符串验证。
 */
export function getFieldSchema(fieldName: string): z.ZodType<string | undefined> | null {
  const schemaMap: Record<string, z.ZodType<string | undefined>> = {
    url: urlSchema,
    website: urlSchema,
    adminConsoleUrl: urlSchema,
    phone: phoneSchema,
    email: emailSchema.optional().or(z.literal('')),
    ip: ipv4Schema,
    port: portSchema,
    cardNumber: creditCardSchema,
    expiry: expirySchema,
    cvv: cvvSchema,
    swift: swiftSchema,
    iban: ibanSchema,
  };
  return schemaMap[fieldName] ?? null;
}
