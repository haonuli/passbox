// @vitest-environment node
import { describe, it, expect } from 'vitest';
import {
  deriveAuthHash,
  deriveRecoveryKey,
  normalizeEmail,
  AUTH_HASH_INFO,
  RECOVERY_KEY_INFO,
  HKDF_OUTPUT_LENGTH,
} from '../hkdf';
import { getRandomBytes } from '../random';

const TEST_EMAIL = 'test@passbox.local';

describe('HKDF 派生模块', () => {
  describe('deriveAuthHash', () => {
    it('返回 32 字节 Uint8Array', async () => {
      const masterKey = getRandomBytes(32);
      const authHash = await deriveAuthHash(masterKey, TEST_EMAIL);
      expect(authHash).toBeInstanceOf(Uint8Array);
      expect(authHash.length).toBe(HKDF_OUTPUT_LENGTH);
      expect(authHash.length).toBe(32);
    });

    it('相同输入派生结果一致（确定性）', async () => {
      const masterKey = getRandomBytes(32);
      const h1 = await deriveAuthHash(masterKey, TEST_EMAIL);
      const h2 = await deriveAuthHash(masterKey, TEST_EMAIL);
      expect(h1).toEqual(h2);
    });

    it('不同 masterKey 派生结果不同', async () => {
      const h1 = await deriveAuthHash(getRandomBytes(32), TEST_EMAIL);
      const h2 = await deriveAuthHash(getRandomBytes(32), TEST_EMAIL);
      expect(h1).not.toEqual(h2);
    });

    it('不同 email 派生结果不同（salt 影响）', async () => {
      const masterKey = getRandomBytes(32);
      const h1 = await deriveAuthHash(masterKey, 'user1@passbox.local');
      const h2 = await deriveAuthHash(masterKey, 'user2@passbox.local');
      expect(h1).not.toEqual(h2);
    });
  });

  describe('deriveRecoveryKey', () => {
    it('返回 32 字节 Uint8Array', async () => {
      const recoveryCode = getRandomBytes(20);
      const recoveryKey = await deriveRecoveryKey(recoveryCode, TEST_EMAIL);
      expect(recoveryKey).toBeInstanceOf(Uint8Array);
      expect(recoveryKey.length).toBe(32);
    });

    it('相同输入派生结果一致（确定性）', async () => {
      const recoveryCode = getRandomBytes(20);
      const k1 = await deriveRecoveryKey(recoveryCode, TEST_EMAIL);
      const k2 = await deriveRecoveryKey(recoveryCode, TEST_EMAIL);
      expect(k1).toEqual(k2);
    });

    it('不同 recoveryCode 派生结果不同', async () => {
      const k1 = await deriveRecoveryKey(getRandomBytes(20), TEST_EMAIL);
      const k2 = await deriveRecoveryKey(getRandomBytes(20), TEST_EMAIL);
      expect(k1).not.toEqual(k2);
    });
  });

  describe('域分离（Domain Separation）', () => {
    it('Auth Hash 与 Recovery Key 使用不同 info 标签', () => {
      expect(AUTH_HASH_INFO).not.toBe(RECOVERY_KEY_INFO);
      expect(AUTH_HASH_INFO).toBe('passbox:auth:v1');
      expect(RECOVERY_KEY_INFO).toBe('passbox:recovery:v1');
    });

    it('相同 ikm + email，Auth Hash ≠ Recovery Key（域分离）', async () => {
      // 用同一份 32 字节作为 ikm，验证不同 info 产生不同派生结果
      const ikm = getRandomBytes(32);
      const authHash = await deriveAuthHash(ikm, TEST_EMAIL);
      const recoveryKey = await deriveRecoveryKey(ikm, TEST_EMAIL);
      expect(authHash).not.toEqual(recoveryKey);
    });

    it('Auth Hash 与 Recovery Key 派生结果均非全零（防止退化）', async () => {
      const masterKey = getRandomBytes(32);
      const recoveryCode = getRandomBytes(20);
      const authHash = await deriveAuthHash(masterKey, TEST_EMAIL);
      const recoveryKey = await deriveRecoveryKey(recoveryCode, TEST_EMAIL);

      const allZero = (b: Uint8Array) => b.every((x) => x === 0);
      expect(allZero(authHash)).toBe(false);
      expect(allZero(recoveryKey)).toBe(false);
    });
  });

  describe('normalizeEmail', () => {
    it('小写化 + 去首尾空白', () => {
      expect(normalizeEmail('  User@Example.COM  ')).toBe('user@example.com');
    });

    it('email 大小写 / 空格差异不影响 Auth Hash 派生', async () => {
      const masterKey = getRandomBytes(32);
      const h1 = await deriveAuthHash(masterKey, 'User@Example.COM');
      const h2 = await deriveAuthHash(masterKey, '  user@example.com  ');
      expect(h1).toEqual(h2);
    });

    it('email 大小写 / 空格差异不影响 Recovery Key 派生', async () => {
      const recoveryCode = getRandomBytes(20);
      const k1 = await deriveRecoveryKey(recoveryCode, 'User@Example.COM');
      const k2 = await deriveRecoveryKey(recoveryCode, 'user@example.com');
      expect(k1).toEqual(k2);
    });
  });
});
