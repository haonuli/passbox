// @vitest-environment node
import { describe, it, expect, beforeAll } from 'vitest';
import { encrypt, decrypt, encryptBytes, decryptToBytes } from '../aes';
import { fromBase64, toBase64 } from '../encoding';
import { getRandomBytes } from '../random';

/** 生成可提取的 AES-256-GCM 测试密钥 */
async function makeKey(extractable = true): Promise<CryptoKey> {
  return crypto.subtle.generateKey(
    { name: 'AES-GCM', length: 256 },
    extractable,
    ['encrypt', 'decrypt'],
  );
}

describe('AES-256-GCM 加解密', () => {
  describe('字符串加解密（encrypt / decrypt）', () => {
    it('加解密往返：encrypt → decrypt 返回原文', async () => {
      const key = await makeKey();
      const plaintext = '敏感数据：用户密码 Password123!';
      const aad = 'item:test-uuid:data';

      const encrypted = await encrypt(key, plaintext, aad);
      const decrypted = await decrypt(key, encrypted, aad);

      expect(decrypted).toBe(plaintext);
    });

    it('无 AAD 时正常加解密', async () => {
      const key = await makeKey();
      const encrypted = await encrypt(key, 'no aad here');
      expect(await decrypt(key, encrypted)).toBe('no aad here');
    });

    it('空字符串加解密往返', async () => {
      const key = await makeKey();
      const encrypted = await encrypt(key, '');
      expect(await decrypt(key, encrypted)).toBe('');
    });

    it('含中文 / emoji 的 UTF-8 字符串往返', async () => {
      const key = await makeKey();
      const text = '密码库 🔐 中文测试 Unicode ✓';
      expect(await decrypt(key, await encrypt(key, text))).toBe(text);
    });
  });

  describe('输出格式 EncryptedData', () => {
    it('格式为 { v:1, iv:base64, ct:base64 }，iv 解码为 12 字节', async () => {
      const key = await makeKey();
      const encrypted = await encrypt(key, 'test', 'aad');

      expect(encrypted.v).toBe(1);
      expect(typeof encrypted.iv).toBe('string');
      expect(typeof encrypted.ct).toBe('string');
      expect(fromBase64(encrypted.iv).length).toBe(12);
    });

    it('每次加密生成不同 IV（相同明文结果不同）', async () => {
      const key = await makeKey();
      const e1 = await encrypt(key, 'same plaintext', 'aad');
      const e2 = await encrypt(key, 'same plaintext', 'aad');

      expect(e1.iv).not.toBe(e2.iv);
      expect(e1.ct).not.toBe(e2.ct);
    });

    it('ct 末尾含 16 字节 GCM 认证标签（密文长度 = 明文长度 + 16）', async () => {
      const key = await makeKey();
      const plaintext = 'hello'; // 5 字节
      const encrypted = await encrypt(key, plaintext);
      const ctBytes = fromBase64(encrypted.ct);
      expect(ctBytes.length).toBe(5 + 16);
    });
  });

  describe('认证与完整性（GCM Auth Tag）', () => {
    it('AAD 不匹配时解密抛出异常', async () => {
      const key = await makeKey();
      const encrypted = await encrypt(key, 'secret', 'correct-aad');
      await expect(decrypt(key, encrypted, 'wrong-aad')).rejects.toThrow();
    });

    it('加密时有 AAD、解密时无 AAD 抛出异常', async () => {
      const key = await makeKey();
      const encrypted = await encrypt(key, 'secret', 'aad');
      await expect(decrypt(key, encrypted)).rejects.toThrow();
    });

    it('密文被篡改时解密抛出异常（完整性校验）', async () => {
      const key = await makeKey();
      const encrypted = await encrypt(key, 'secret', 'aad');
      const tampered = { ...encrypted, ct: encrypted.ct.slice(0, -4) + 'AAAA' };
      await expect(decrypt(key, tampered, 'aad')).rejects.toThrow();
    });

    it('IV 被篡改时解密抛出异常', async () => {
      const key = await makeKey();
      const encrypted = await encrypt(key, 'secret', 'aad');
      const tampered = { ...encrypted, iv: toBase64(getRandomBytes(12)) };
      await expect(decrypt(key, tampered, 'aad')).rejects.toThrow();
    });

    it('版本号错误抛出异常', async () => {
      const key = await makeKey();
      const encrypted = await encrypt(key, 'secret', 'aad');
      const bad = { ...encrypted, v: 2 as 1 };
      await expect(decrypt(key, bad, 'aad')).rejects.toThrow(/版本/);
    });

    it('不同密钥无法解密对方加密的密文', async () => {
      const key1 = await makeKey();
      const key2 = await makeKey();
      const encrypted = await encrypt(key1, 'secret', 'aad');
      await expect(decrypt(key2, encrypted, 'aad')).rejects.toThrow();
    });
  });

  describe('字节加解密（encryptBytes / decryptToBytes）', () => {
    it('原始字节往返一致', async () => {
      const key = await makeKey();
      const data = getRandomBytes(32);
      const encrypted = await encryptBytes(key, data, 'key-wrap');
      const decrypted = await decryptToBytes(key, encrypted, 'key-wrap');
      expect(decrypted).toEqual(data);
    });

    it('字节与字符串版本格式一致（均为 EncryptedData）', async () => {
      const key = await makeKey();
      const e1 = await encryptBytes(key, getRandomBytes(16));
      const e2 = await encrypt(key, 'text');
      expect(e1.v).toBe(e2.v);
      expect(typeof e1.iv).toBe('string');
      expect(typeof e1.ct).toBe('string');
    });
  });

  describe('跨密钥隔离', () => {
    // 缓存一个密钥用于多个用例
    let sharedKey: CryptoKey;
    beforeAll(async () => {
      sharedKey = await makeKey();
    });

    it('同一密钥多次加解密稳定', async () => {
      const texts = ['a', 'b', 'c', '密码'];
      for (const t of texts) {
        const enc = await encrypt(sharedKey, t, 'ctx');
        expect(await decrypt(sharedKey, enc, 'ctx')).toBe(t);
      }
    });
  });
});
