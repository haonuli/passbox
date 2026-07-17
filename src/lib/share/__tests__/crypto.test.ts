// @vitest-environment node
import { describe, it, expect } from 'vitest';
import { generateShareKey, encryptShareData, decryptShareData } from '../crypto';
import { fromBase64 } from '@/lib/crypto/encoding';

describe('共享链接加解密 (share/crypto)', () => {
  describe('generateShareKey', () => {
    it('返回合法的 base64 字符串', async () => {
      const key = await generateShareKey();
      expect(typeof key).toBe('string');
      expect(key).toMatch(/^[A-Za-z0-9+/]+={0,2}$/);
    });

    it('解码后为 32 字节（256-bit）', async () => {
      const key = await generateShareKey();
      const bytes = fromBase64(key);
      expect(bytes.length).toBe(32);
    });

    it('每次生成不同密钥', async () => {
      const key1 = await generateShareKey();
      const key2 = await generateShareKey();
      expect(key1).not.toBe(key2);
    });
  });

  describe('encryptShareData / decryptShareData 往返', () => {
    it('加密然后解密能恢复原始数据', async () => {
      const key = await generateShareKey();
      const plaintext = '敏感数据：用户密码 Password123!';
      const encrypted = await encryptShareData(key, plaintext);
      const decrypted = await decryptShareData(key, encrypted);
      expect(decrypted).toBe(plaintext);
    });

    it('含中文 / emoji 的 UTF-8 字符串往返一致', async () => {
      const key = await generateShareKey();
      const text = '密码库 🔐 中文测试 Unicode ✓';
      const encrypted = await encryptShareData(key, text);
      expect(await decryptShareData(key, encrypted)).toBe(text);
    });

    it('空字符串加密解密', async () => {
      const key = await generateShareKey();
      const encrypted = await encryptShareData(key, '');
      expect(await decryptShareData(key, encrypted)).toBe('');
    });

    it('长文本加密解密', async () => {
      const key = await generateShareKey();
      const longText = 'A'.repeat(10_000) + '中文结尾🔐';
      const encrypted = await encryptShareData(key, longText);
      expect(await decryptShareData(key, encrypted)).toBe(longText);
    });
  });

  describe('密文格式', () => {
    it('密文格式正确（包含 "."）', async () => {
      const key = await generateShareKey();
      const encrypted = await encryptShareData(key, 'test data');
      expect(encrypted).toContain('.');
    });

    it('格式为 base64(iv).base64(ciphertext)，iv 为 12 字节', async () => {
      const key = await generateShareKey();
      const encrypted = await encryptShareData(key, 'test data');
      const [ivBase64, ctBase64] = encrypted.split('.');
      expect(ivBase64).toBeDefined();
      expect(ctBase64).toBeDefined();
      expect(fromBase64(ivBase64).length).toBe(12);
    });

    it('每次加密生成不同 IV（相同明文结果不同）', async () => {
      const key = await generateShareKey();
      const e1 = await encryptShareData(key, 'same plaintext');
      const e2 = await encryptShareData(key, 'same plaintext');
      expect(e1).not.toBe(e2);
    });
  });

  describe('认证与完整性', () => {
    it('不同密钥无法解密', async () => {
      const key1 = await generateShareKey();
      const key2 = await generateShareKey();
      const encrypted = await encryptShareData(key1, 'secret data');
      await expect(decryptShareData(key2, encrypted)).rejects.toThrow();
    });

    it('密文被篡改时解密抛出异常', async () => {
      const key = await generateShareKey();
      const encrypted = await encryptShareData(key, 'secret data');
      const [ivBase64, ctBase64] = encrypted.split('.');
      const tampered = `${ivBase64}.${ctBase64.slice(0, -4)}AAAA`;
      await expect(decryptShareData(key, tampered)).rejects.toThrow();
    });

    it('IV 被篡改时解密抛出异常', async () => {
      const key = await generateShareKey();
      const encrypted = await encryptShareData(key, 'secret data');
      const [, ctBase64] = encrypted.split('.');
      const tampered = `AAAAAAAAAAAA.${ctBase64}`;
      await expect(decryptShareData(key, tampered)).rejects.toThrow();
    });

    it('格式无效（无分隔符）抛出异常', async () => {
      const key = await generateShareKey();
      await expect(decryptShareData(key, 'invalidformat')).rejects.toThrow(/格式无效/);
    });
  });
});
