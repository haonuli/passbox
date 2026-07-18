/**
 * SSH 密钥解析工具
 *
 * 提供私钥格式检测、公钥提取与格式校验能力，
 * 供 SSH 密钥条目表单自动填充与校验使用。
 */

/** OpenSSH 格式私钥头部标记 */
const OPENSSH_HEADER = '-----BEGIN OPENSSH PRIVATE KEY-----';
/** RSA 格式私钥头部标记 */
const RSA_HEADER = '-----BEGIN RSA PRIVATE KEY-----';
/** ECDSA 格式私钥头部标记 */
const EC_HEADER = '-----BEGIN EC PRIVATE KEY-----';
/** PKCS8 格式私钥头部标记 */
const PKCS8_HEADER = '-----BEGIN PRIVATE KEY-----';

/** 匹配 SSH 公钥行的正则（支持 ed25519 / rsa / ecdsa / dss） */
const PUBLIC_KEY_LINE_REGEX =
  /^(ssh-ed25519|ssh-rsa|ssh-dss|ecdsa-sha2-nistp\d+|sk-ssh-ed25519@openssh\.com|sk-ecdsa-sha2-nistp\d+@openssh\.com)\s+[A-Za-z0-9+/=]+/m;

/**
 * 从私钥内容检测密钥类型。
 *
 * 支持识别 OpenSSH / RSA / ECDSA / PKCS8 四种常见格式，
 * 无法识别时返回 "Unknown"。
 */
export function detectKeyType(privateKey: string): string {
  const trimmed = privateKey.trim();

  if (trimmed.startsWith(OPENSSH_HEADER)) return 'OpenSSH';
  if (trimmed.startsWith(RSA_HEADER)) return 'RSA';
  if (trimmed.startsWith(EC_HEADER)) return 'ECDSA';
  if (trimmed.startsWith(PKCS8_HEADER)) return 'PKCS8';

  return 'Unknown';
}

/**
 * 从私钥内容中尝试提取公钥。
 *
 * OpenSSH 格式的私钥文件中，公钥通常出现在注释行中
 * （格式如 `ssh-ed25519 AAAA... user@host`）。
 * 若私钥中不包含可识别的公钥行，返回 null。
 */
export function extractPublicKey(privateKey: string): string | null {
  const match = privateKey.match(PUBLIC_KEY_LINE_REGEX);
  if (!match) return null;

  // match[0] 是整个匹配行（含类型 + base64 部分），可能还带注释
  const line = match[0].trim();
  // 仅保留 "类型 base64" 两部分，去掉末尾注释
  const parts = line.split(/\s+/);
  if (parts.length < 2) return null;

  return `${parts[0]} ${parts[1]}`;
}

/**
 * 验证私钥格式是否有效。
 *
 * 判定规则：包含 `-----BEGIN` 和 `-----END` 标记，
 * 或为 OpenSSH 格式（以特定头部开头）。
 */
export function isValidPrivateKey(privateKey: string): boolean {
  const trimmed = privateKey.trim();
  if (!trimmed) return false;

  const hasBegin = trimmed.includes('-----BEGIN');
  const hasEnd = trimmed.includes('-----END');

  return hasBegin && hasEnd;
}
