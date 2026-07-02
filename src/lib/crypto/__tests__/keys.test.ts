// @vitest-environment node
import { describe, it, expect } from 'vitest';
import {
  generateSymmetricKey,
  importKey,
  encryptSymmetricKey,
  decryptSymmetricKey,
  encryptSymmetricKeyWithRecovery,
  decryptSymmetricKeyWithRecovery,
} from '../keys';
import { deriveRecoveryKey } from '../hkdf';
import { getRandomBytes } from '../random';

const TEST_EMAIL = 'test@passbox.local';

/** 比较两个 CryptoKey 的 raw 字节是否相等 */
async function keysEqual(a: CryptoKey, b: CryptoKey): Promise<boolean> {
  const ra = await crypto.subtle.exportKey('raw', a);
  const rb = await crypto.subtle.exportKey('raw', b);
  return new Uint8Array(ra).every((v, i) => v === new Uint8Array(rb)[i]);
}

describe('密钥层级管理（密钥包装）', () => {
  describe('generateSymmetricKey', () => {
    it('返回 AES-GCM 256-bit CryptoKey（可提取）', async () => {
      const key = await generateSymmetricKey();
      expect(key.type).toBe('secret');
      // 可提取（用于包装）
      expect(key.extractable).toBe(true);
      // 算法为 AES-GCM 256
      const alg = key.algorithm as AesKeyAlgorithm;
      expect(alg.name).toBe('AES-GCM');
      expect(alg.length).toBe(256);
    });

    it('每次返回不同密钥', async () => {
      const k1 = await generateSymmetricKey();
      const k2 = await generateSymmetricKey();
      expect(await keysEqual(k1, k2)).toBe(false);
    });
  });

  describe('importKey', () => {
    it('返回非提取的 AES-GCM CryptoKey', async () => {
      const key = await importKey(getRandomBytes(32));
      expect(key.extractable).toBe(false);
      const alg = key.algorithm as AesKeyAlgorithm;
      expect(alg.name).toBe('AES-GCM');
      expect(alg.length).toBe(256);
    });
  });

  describe('Master Key 路径（加解密往返）', () => {
    it('encryptSymmetricKey → decryptSymmetricKey 往返一致', async () => {
      const masterKey = getRandomBytes(32); // 模拟 deriveMasterKey 输出
      const symmetricKey = await generateSymmetricKey();

      const encrypted = await encryptSymmetricKey(masterKey, symmetricKey);
      const decrypted = await decryptSymmetricKey(masterKey, encrypted);

      expect(await keysEqual(symmetricKey, decrypted)).toBe(true);
    });

    it('输出为合法 EncryptedData 格式', async () => {
      const encrypted = await encryptSymmetricKey(
        getRandomBytes(32),
        await generateSymmetricKey(),
      );
      expect(encrypted.v).toBe(1);
      expect(typeof encrypted.iv).toBe('string');
      expect(typeof encrypted.ct).toBe('string');
    });

    it('不同 Master Key 无法解密（密钥隔离）', async () => {
      const masterKey1 = getRandomBytes(32);
      const masterKey2 = getRandomBytes(32);
      const symmetricKey = await generateSymmetricKey();

      const encrypted = await encryptSymmetricKey(masterKey1, symmetricKey);
      await expect(decryptSymmetricKey(masterKey2, encrypted)).rejects.toThrow();
    });
  });

  describe('Recovery Key 路径（加解密往返）', () => {
    it('encryptSymmetricKeyWithRecovery → decryptSymmetricKeyWithRecovery 往返一致', async () => {
      const recoveryCode = getRandomBytes(20);
      const recoveryKey = await deriveRecoveryKey(recoveryCode, TEST_EMAIL);
      const symmetricKey = await generateSymmetricKey();

      const encrypted = await encryptSymmetricKeyWithRecovery(recoveryKey, symmetricKey);
      const decrypted = await decryptSymmetricKeyWithRecovery(recoveryKey, encrypted);

      expect(await keysEqual(symmetricKey, decrypted)).toBe(true);
    });

    it('使用真实 deriveRecoveryKey 派生的 Recovery Key', async () => {
      // 验证 HKDF 派生的 32B Recovery Key 可正常用于包装
      const recoveryKey = await deriveRecoveryKey(getRandomBytes(20), TEST_EMAIL);
      const enc = await encryptSymmetricKeyWithRecovery(
        recoveryKey,
        await generateSymmetricKey(),
      );
      expect(enc.v).toBe(1);
    });
  });

  describe('密钥隔离（Master ↔ Recovery 不可交叉使用）', () => {
    it('Master Key 无法解密 Recovery Key 加密的密文', async () => {
      const masterKey = getRandomBytes(32);
      const recoveryKey = await deriveRecoveryKey(getRandomBytes(20), TEST_EMAIL);
      const symmetricKey = await generateSymmetricKey();

      const recoveryEncrypted = await encryptSymmetricKeyWithRecovery(recoveryKey, symmetricKey);
      await expect(decryptSymmetricKey(masterKey, recoveryEncrypted)).rejects.toThrow();
    });

    it('Recovery Key 无法解密 Master Key 加密的密文', async () => {
      const masterKey = getRandomBytes(32);
      const recoveryKey = await deriveRecoveryKey(getRandomBytes(20), TEST_EMAIL);
      const symmetricKey = await generateSymmetricKey();

      const masterEncrypted = await encryptSymmetricKey(masterKey, symmetricKey);
      await expect(decryptSymmetricKeyWithRecovery(recoveryKey, masterEncrypted)).rejects.toThrow();
    });

    it('同一 Symmetric Key 经两条路径包装后均可独立解密回同一密钥', async () => {
      const masterKey = getRandomBytes(32);
      const recoveryKey = await deriveRecoveryKey(getRandomBytes(20), TEST_EMAIL);
      const symmetricKey = await generateSymmetricKey();

      const masterEnc = await encryptSymmetricKey(masterKey, symmetricKey);
      const recoveryEnc = await encryptSymmetricKeyWithRecovery(recoveryKey, symmetricKey);

      const fromMaster = await decryptSymmetricKey(masterKey, masterEnc);
      const fromRecovery = await decryptSymmetricKeyWithRecovery(recoveryKey, recoveryEnc);

      expect(await keysEqual(symmetricKey, fromMaster)).toBe(true);
      expect(await keysEqual(symmetricKey, fromRecovery)).toBe(true);
      expect(await keysEqual(fromMaster, fromRecovery)).toBe(true);
    });
  });
});
