/**
 * 恢复码生成与格式化工具 (T3.2)
 *
 * 恢复码格式：PBOX-XXXX-XXXX-XXXX-XXXX
 * - PBOX 为固定前缀（标识 passbox 恢复码）
 * - XXXX 为 4 组 Crockford Base32 编码（去除易混淆字符 I/L/O/U）
 * - 底层 10 字节随机（80 bit 熵），编码为 16 个 Base32 字符
 *
 * 恢复码用途：
 * 1. 账户身份验证：服务端 bcrypt(recoveryCode) 存储，恢复时 bcrypt.compare
 * 2. 数据恢复密钥派生：客户端 parseRecoveryCode → raw bytes → HKDF → Recovery Key
 *
 * ⚠️ 实现偏差（相对 TECHNICAL_DESIGN 3.7）：
 * 设计文档写"服务端生成恢复码"，但客户端需要在注册请求中同时提交
 * recoveryEncryptedKey（用恢复码派生 Recovery Key 加密的 Symmetric Key 副本）。
 * 若服务端生成恢复码并返回，客户端需第二次请求上传 recoveryEncryptedKey，
 * 存在中途断开导致恢复路径缺失的风险。因此改为客户端生成恢复码，
 * 将 recoveryCode + recoveryEncryptedKey 一并提交，服务端仅做 bcrypt 哈希。
 * 安全等价：服务端仍只存 bcrypt 哈希，明文恢复码仅在注册响应中返回一次。
 */
import { getRandomBytes } from './crypto/random';

/** Crockford Base32 字母表（去除 I / L / O / U 易混淆字符） */
const CROCKFORD_ALPHABET = '0123456789ABCDEFGHJKMNPQRSTVWXYZ';

/** 恢复码前缀 */
export const RECOVERY_CODE_PREFIX = 'PBOX';

/** 恢复码原始随机字节数（80 bit 熵） */
export const RECOVERY_CODE_RAW_LENGTH = 10;

/** 恢复码 Base32 编码后字符数（80 bit / 5 bit per char = 16） */
export const RECOVERY_CODE_ENCODED_LENGTH = 16;

/** 恢复码数据部分分组数 */
const RECOVERY_CODE_GROUPS = 4;

/** 每组字符数 */
const CHARS_PER_GROUP = 4;

/**
 * 生成恢复码。
 *
 * @returns { raw: 10 字节随机, formatted: "PBOX-XXXX-XXXX-XXXX-XXXX" }
 */
export function generateRecoveryCode(): { raw: Uint8Array; formatted: string } {
  const raw = getRandomBytes(RECOVERY_CODE_RAW_LENGTH);
  const encoded = base32Encode(raw);
  return { raw, formatted: formatCode(encoded) };
}

/**
 * 将格式化恢复码解析为原始字节（用于 HKDF 派生 Recovery Key）。
 *
 * @param formatted "PBOX-XXXX-XXXX-XXXX-XXXX"（大小写不敏感，自动去除空格）
 * @returns 10 字节原始随机数据
 * @throws Error 格式不符或包含非法字符时
 */
export function parseRecoveryCode(formatted: string): Uint8Array {
  const normalized = formatted.trim().toUpperCase().replace(/\s/g, '');
  if (!normalized.startsWith(RECOVERY_CODE_PREFIX + '-')) {
    throw new Error(
      `恢复码必须以 ${RECOVERY_CODE_PREFIX}- 开头`,
    );
  }
  const dataPart = normalized.slice(RECOVERY_CODE_PREFIX.length + 1); // 去除 "PBOX-"
  const groups = dataPart.split('-');
  if (groups.length !== RECOVERY_CODE_GROUPS || groups.some((g) => g.length !== CHARS_PER_GROUP)) {
    throw new Error(
      `恢复码格式应为 ${RECOVERY_CODE_PREFIX}-XXXX-XXXX-XXXX-XXXX（4 组 4 字符）`,
    );
  }
  const encoded = groups.join('');
  if (encoded.length !== RECOVERY_CODE_ENCODED_LENGTH) {
    throw new Error(`恢复码数据部分长度必须为 ${RECOVERY_CODE_ENCODED_LENGTH} 字符`);
  }
  return base32Decode(encoded);
}

/**
 * 校验恢复码格式是否合法（不抛异常，返回 boolean）。
 * 用于 API 输入校验。
 */
export function isValidRecoveryCodeFormat(formatted: string): boolean {
  try {
    parseRecoveryCode(formatted);
    return true;
  } catch {
    return false;
  }
}

// ============================================================
// 内部工具：Base32 编解码（Crockford 字母表）
// ============================================================

/** 将字节编码为 Crockford Base32 字符串 */
function base32Encode(bytes: Uint8Array): string {
  let result = '';
  let buffer = 0;
  let bits = 0;
  for (const byte of bytes) {
    buffer = (buffer << 8) | byte;
    bits += 8;
    while (bits >= 5) {
      bits -= 5;
      result += CROCKFORD_ALPHABET[(buffer >> bits) & 0x1f];
    }
  }
  // 剩余 bit（10 字节 = 80 bit = 16 chars，整除无剩余）
  if (bits > 0) {
    result += CROCKFORD_ALPHABET[(buffer << (5 - bits)) & 0x1f];
  }
  return result;
}

/** 将 Crockford Base32 字符串解码为字节 */
function base32Decode(encoded: string): Uint8Array {
  const bytes: number[] = [];
  let buffer = 0;
  let bits = 0;
  for (const char of encoded) {
    const index = CROCKFORD_ALPHABET.indexOf(char);
    if (index === -1) {
      throw new Error(`恢复码包含非法字符: "${char}"（仅允许 ${CROCKFORD_ALPHABET}）`);
    }
    buffer = (buffer << 5) | index;
    bits += 5;
    if (bits >= 8) {
      bits -= 8;
      bytes.push((buffer >> bits) & 0xff);
    }
  }
  return new Uint8Array(bytes);
}

/** 将 16 字符 Base32 编码格式化为 PBOX-XXXX-XXXX-XXXX-XXXX */
function formatCode(encoded: string): string {
  const groups: string[] = [];
  for (let i = 0; i < RECOVERY_CODE_GROUPS; i++) {
    groups.push(encoded.slice(i * CHARS_PER_GROUP, (i + 1) * CHARS_PER_GROUP));
  }
  return `${RECOVERY_CODE_PREFIX}-${groups.join('-')}`;
}
