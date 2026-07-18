/**
 * SSH 密钥解析工具单元测试
 *
 * 验证 detectKeyType / extractPublicKey / isValidPrivateKey 的
 * 格式识别、公钥提取与有效性校验逻辑。
 * 测试数据均为示例密钥片段，不含真实凭据。
 */
import { describe, it, expect } from 'vitest';
import { detectKeyType, extractPublicKey, isValidPrivateKey } from '../../ssh-key-parser';

/** 示例 OpenSSH 格式私钥（含注释行中的公钥） */
const OPENSSH_KEY = `-----BEGIN OPENSSH PRIVATE KEY-----
b3BlbnNzaC1rZXktdjEAAAAAABG5vbmUAAAAEbm9uZQAAAAAAAAABAAAAMwAAAAtzc2gtZW
QyNTUxAAAAIBdXxP2WVzR5l3QkQy5Q5Q5Q5Q5Q5Q5Q5Q5Q5Q5Q5Q5Q5Q5Q5Q5Q5Q5Q5Q5
AAAAJdGVzdEBleGFtcGxlLmNvbQAAAAY4NzQ1NjMyAQIDBAU=
-----END OPENSSH PRIVATE KEY-----
ssh-ed25519 AAAAC3NzaC1lZDI1NTE5AAAAIBdXxP2WVzR5l3QkQy5Q test@example.com`;

/** 示例 RSA 格式私钥 */
const RSA_KEY = `-----BEGIN RSA PRIVATE KEY-----
MIIEpAIBAAKCAQEA0Q5Q5Q5Q5Q5Q5Q5Q5Q5Q5Q5Q5Q5Q5Q5Q5Q5Q5Q5Q5Q5Q5Q5Q5Q5Q5
-----END RSA PRIVATE KEY-----`;

/** 示例 ECDSA 格式私钥 */
const EC_KEY = `-----BEGIN EC PRIVATE KEY-----
MHcCAQEEIBdXxP2WVzR5l3QkQy5Q5Q5Q5Q5Q5Q5Q5Q5Q5Q5Q5Q5Q5Q5Q5Q5Q5Q
-----END EC PRIVATE KEY-----`;

/** 示例 PKCS8 格式私钥 */
const PKCS8_KEY = `-----BEGIN PRIVATE KEY-----
MIIEvQIBADANBgkqhkiG9w0BAQEFAASCBKcwggSjAgEAAoIBAQDQ5Q5Q5Q5Q5Q
-----END PRIVATE KEY-----`;

/** 无注释公钥的 OpenSSH 私钥 */
const OPENSSH_KEY_NO_PUBKEY = `-----BEGIN OPENSSH PRIVATE KEY-----
b3BlbnNzaC1rZXktdjEAAAAAABG5vbmUAAAAEbm9uZQAAAAAAAAABAAAAMwAAAAtzc2gtZW
QyNTUxAAAAIBdXxP2WVzR5l3QkQy5Q5Q5Q5Q5Q5Q5Q5Q5Q5Q5Q5Q5Q5Q5Q5Q5Q5Q5Q5Q5
-----END OPENSSH PRIVATE KEY-----`;

describe('detectKeyType', () => {
  it('识别 OpenSSH 格式', () => {
    expect(detectKeyType(OPENSSH_KEY)).toBe('OpenSSH');
  });

  it('识别 RSA 格式', () => {
    expect(detectKeyType(RSA_KEY)).toBe('RSA');
  });

  it('识别 ECDSA 格式', () => {
    expect(detectKeyType(EC_KEY)).toBe('ECDSA');
  });

  it('识别 PKCS8 格式', () => {
    expect(detectKeyType(PKCS8_KEY)).toBe('PKCS8');
  });

  it('未知格式返回 "Unknown"', () => {
    expect(detectKeyType('not a key')).toBe('Unknown');
  });

  it('空字符串返回 "Unknown"', () => {
    expect(detectKeyType('')).toBe('Unknown');
  });

  it('带前导空格的 OpenSSH 密钥仍可识别', () => {
    expect(detectKeyType(`  \n${OPENSSH_KEY}`)).toBe('OpenSSH');
  });
});

describe('extractPublicKey', () => {
  it('从 OpenSSH 私钥注释中提取 ed25519 公钥', () => {
    const pubKey = extractPublicKey(OPENSSH_KEY);
    expect(pubKey).not.toBeNull();
    expect(pubKey).toBe('ssh-ed25519 AAAAC3NzaC1lZDI1NTE5AAAAIBdXxP2WVzR5l3QkQy5Q');
  });

  it('提取的公钥不包含注释中的邮箱', () => {
    const pubKey = extractPublicKey(OPENSSH_KEY);
    expect(pubKey).not.toContain('test@example.com');
  });

  it('无私钥注释时返回 null', () => {
    expect(extractPublicKey(OPENSSH_KEY_NO_PUBKEY)).toBeNull();
  });

  it('空字符串返回 null', () => {
    expect(extractPublicKey('')).toBeNull();
  });

  it('识别 ssh-rsa 格式公钥', () => {
    const key = `-----BEGIN OPENSSH PRIVATE KEY-----
b3BlbnNzaC1rZXktdjEA
-----END OPENSSH PRIVATE KEY-----
ssh-rsa AAAAB3NzaC1yc2EAAAADAQABAAACAQ user@host`;
    const pubKey = extractPublicKey(key);
    expect(pubKey).toBe('ssh-rsa AAAAB3NzaC1yc2EAAAADAQABAAACAQ');
  });

  it('识别 ecdsa-sha2 格式公钥', () => {
    const key = `-----BEGIN OPENSSH PRIVATE KEY-----
b3BlbnNzaC1rZXktdjEA
-----END OPENSSH PRIVATE KEY-----
ecdsa-sha2-nistp256 AAAAE2VjZHNhLXNoYTItbmlzdHAyNTY user@host`;
    const pubKey = extractPublicKey(key);
    expect(pubKey).toBe('ecdsa-sha2-nistp256 AAAAE2VjZHNhLXNoYTItbmlzdHAyNTY');
  });
});

describe('isValidPrivateKey', () => {
  it('OpenSSH 格式有效', () => {
    expect(isValidPrivateKey(OPENSSH_KEY)).toBe(true);
  });

  it('RSA 格式有效', () => {
    expect(isValidPrivateKey(RSA_KEY)).toBe(true);
  });

  it('ECDSA 格式有效', () => {
    expect(isValidPrivateKey(EC_KEY)).toBe(true);
  });

  it('PKCS8 格式有效', () => {
    expect(isValidPrivateKey(PKCS8_KEY)).toBe(true);
  });

  it('缺少 END 标记无效', () => {
    expect(isValidPrivateKey('-----BEGIN OPENSSH PRIVATE KEY-----\nsomedata')).toBe(false);
  });

  it('缺少 BEGIN 标记无效', () => {
    expect(isValidPrivateKey('somedata\n-----END OPENSSH PRIVATE KEY-----')).toBe(false);
  });

  it('普通文本无效', () => {
    expect(isValidPrivateKey('not a key at all')).toBe(false);
  });

  it('空字符串无效', () => {
    expect(isValidPrivateKey('')).toBe(false);
  });

  it('带前导空格的密钥仍有效', () => {
    expect(isValidPrivateKey(`  \n${OPENSSH_KEY}`)).toBe(true);
  });
});
