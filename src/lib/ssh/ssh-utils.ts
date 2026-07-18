/**
 * SSH 密钥工具函数
 *
 * 提供密钥类型检测、公钥提取、指纹计算、密钥生成等功能。
 */

/** SSH 密钥类型 */
export type SshKeyType = 'ed25519' | 'rsa' | 'ecdsa' | 'unknown';

/** 检测结果 */
export interface SshKeyDetectResult {
  keyType: SshKeyType;
  hasPassphrase: boolean;
  publicKey?: string;
  fingerprint?: string;
}

/**
 * 从私钥文本检测密钥类型
 */
export function detectKeyType(privateKey: string): SshKeyType {
  const trimmed = privateKey.trim();

  if (trimmed.includes('BEGIN OPENSSH PRIVATE KEY')) {
    // OpenSSH 格式，需要进一步检测具体类型
    // OpenSSH Ed25519 密钥的 base64 内容中包含 "ssh-ed25519"
    // OpenSSH RSA 密钥的 base64 内容中包含 "ssh-rsa"
    // OpenSSH ECDSA 密钥的 base64 内容中包含 "ecdsa-"
    const body = trimmed
      .split('\n')
      .filter((l) => !l.startsWith('-') && l.length > 0)
      .join('');

    // 简单检测：解码 base64 后搜索密钥类型标识
    try {
      const decoded = atob(body);
      if (decoded.includes('ssh-ed25519')) return 'ed25519';
      if (decoded.includes('ssh-rsa')) return 'rsa';
      if (decoded.includes('ecdsa-')) return 'ecdsa';
    } catch {
      // base64 解码失败，尝试从注释行检测
    }

    // 检查最后一行注释（OpenSSH 格式密钥末尾可能有注释）
    const lastLine = trimmed.split('\n').pop() ?? '';
    if (lastLine.includes('ed25519')) return 'ed25519';
    if (lastLine.includes('rsa')) return 'rsa';
    if (lastLine.includes('ecdsa')) return 'ecdsa';

    return 'unknown';
  }

  if (trimmed.includes('BEGIN RSA PRIVATE KEY')) return 'rsa';
  if (trimmed.includes('BEGIN EC PRIVATE KEY')) return 'ecdsa';

  // 直接是公钥格式
  if (trimmed.startsWith('ssh-ed25519')) return 'ed25519';
  if (trimmed.startsWith('ssh-rsa')) return 'rsa';
  if (trimmed.startsWith('ecdsa-')) return 'ecdsa';

  return 'unknown';
}

/**
 * 检测私钥是否加密（有口令保护）
 */
export function isEncrypted(privateKey: string): boolean {
  return privateKey.includes('Proc-Type: 4,ENCRYPTED') ||
         (privateKey.includes('BEGIN OPENSSH PRIVATE KEY') &&
          !privateKey.includes('none'));
}

/**
 * 从公钥字符串计算指纹（SHA256）
 *
 * 格式: SHA256:base64(sha256(public_key_bytes))
 */
export async function computeFingerprint(publicKey: string): Promise<string> {
  // 解析公钥: "ssh-ed25519 AAAA... comment"
  const parts = publicKey.trim().split(/\s+/);
  if (parts.length < 2) return '';

  try {
    const keyBlob = atob(parts[1]);
    const bytes = new Uint8Array(keyBlob.length);
    for (let i = 0; i < keyBlob.length; i++) {
      bytes[i] = keyBlob.charCodeAt(i);
    }

    const hash = await crypto.subtle.digest('SHA-256', bytes);
    const hashBytes = new Uint8Array(hash);
    let binary = '';
    for (let i = 0; i < hashBytes.length; i++) {
      binary += String.fromCharCode(hashBytes[i]);
    }
    return `SHA256:${btoa(binary)}`;
  } catch {
    return '';
  }
}

/**
 * 综合检测私钥信息
 */
export async function detectKeyInfo(privateKey: string): Promise<SshKeyDetectResult> {
  const keyType = detectKeyType(privateKey);
  const hasPassphrase = isEncrypted(privateKey);

  return {
    keyType,
    hasPassphrase,
  };
}

/**
 * 生成 Ed25519 SSH 密钥对
 *
 * 使用 WebCrypto API 生成密钥对，格式化为 OpenSSH 格式。
 */
export async function generateEd25519KeyPair(
  comment: string = '',
): Promise<{ privateKey: string; publicKey: string; keyType: SshKeyType }> {
  // WebCrypto Ed25519 支持（Chrome/Edge）
  const keyPair = await crypto.subtle.generateKey(
    'Ed25519',
    true,
    ['sign', 'verify'],
  );

  // 导出公钥（raw 格式，32 字节）
  const publicKeyRaw = new Uint8Array(
    await crypto.subtle.exportKey('raw', keyPair.publicKey),
  );

  // 导出私钥（PKCS8 格式）
  const privateKeyPkcs8 = new Uint8Array(
    await crypto.subtle.exportKey('pkcs8', keyPair.publicKey),
  );

  // 构建 OpenSSH 公钥字符串
  const publicKeyBase64 = arrayBufferToBase64(
    buildSshPublicKey('ssh-ed25519', publicKeyRaw, comment),
  );

  const publicKey = `ssh-ed25519 ${publicKeyBase64}${comment ? ' ' + comment : ''}`;

  // 构建 OpenSSH 私钥（简化版：使用 PKCS8 格式，加上 PEM 头尾）
  // 注意：这不是标准 OpenSSH 格式，但可以存储和导出
  // 完整的 OpenSSH 格式转换需要更多工作
  const privateKeyBase64 = arrayBufferToBase64(privateKeyPkcs8);
  const privateKey = formatPem(privateKeyBase64, 'OPENSSH PRIVATE KEY');

  return { privateKey, publicKey, keyType: 'ed25519' };
}

/**
 * 生成 RSA SSH 密钥对（4096 位）
 */
export async function generateRsaKeyPair(
  comment: string = '',
  bits: number = 4096,
): Promise<{ privateKey: string; publicKey: string; keyType: SshKeyType }> {
  const keyPair = await crypto.subtle.generateKey(
    { name: 'RSASSA-PKCS1-v1_5', modulusLength: bits, publicExponent: new Uint8Array([1, 0, 1]), hash: 'SHA-256' },
    true,
    ['sign', 'verify'],
  );

  // 导出公钥
  const publicKeySpki = new Uint8Array(
    await crypto.subtle.exportKey('spki', keyPair.publicKey),
  );
  const privateKeyPkcs8 = new Uint8Array(
    await crypto.subtle.exportKey('pkcs8', keyPair.privateKey),
  );

  // RSA 公钥的 SSH 格式更复杂，这里返回 PEM 格式作为公钥
  const publicKeyBase64 = arrayBufferToBase64(publicKeySpki);
  const publicKey = `ssh-rsa ${publicKeyBase64}${comment ? ' ' + comment : ''}`;

  const privateKeyBase64 = arrayBufferToBase64(privateKeyPkcs8);
  const privateKey = formatPem(privateKeyBase64, 'RSA PRIVATE KEY');

  return { privateKey, publicKey, keyType: 'rsa' };
}

// ============================================================
// 辅助函数
// ============================================================

function arrayBufferToBase64(bytes: Uint8Array): string {
  let binary = '';
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

function formatPem(base64: string, type: string): string {
  const lines: string[] = [`-----BEGIN ${type}-----`];
  for (let i = 0; i < base64.length; i += 64) {
    lines.push(base64.slice(i, i + 64));
  }
  lines.push(`-----END ${type}-----`);
  return lines.join('\n');
}

/**
 * 构建 SSH 公钥二进制格式
 *
 * SSH 公钥格式: string(key_type) + string(key_data)
 * 每个 string 前缀 4 字节大端长度
 */
function buildSshPublicKey(
  keyType: string,
  keyData: Uint8Array,
  comment: string,
): Uint8Array {
  const encoder = new TextEncoder();
  const typeBytes = encoder.encode(keyType);
  const commentBytes = comment ? encoder.encode(comment) : new Uint8Array(0);

  // 总长度: 4 + typeBytes + 4 + keyData + (comment ? 4 + commentBytes : 0)
  const totalLength = 4 + typeBytes.length + 4 + keyData.length +
    (comment ? 4 + commentBytes.length : 0);
  const result = new Uint8Array(totalLength);
  let offset = 0;

  // 写入 key type
  const dv = new DataView(result.buffer);
  dv.setUint32(offset, typeBytes.length);
  offset += 4;
  result.set(typeBytes, offset);
  offset += typeBytes.length;

  // 写入 key data
  dv.setUint32(offset, keyData.length);
  offset += 4;
  result.set(keyData, offset);
  offset += keyData.length;

  // 写入 comment（如果有）
  if (comment) {
    dv.setUint32(offset, commentBytes.length);
    offset += 4;
    result.set(commentBytes, offset);
  }

  return result;
}
