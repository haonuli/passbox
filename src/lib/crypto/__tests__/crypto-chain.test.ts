/**
 * T2.6 加密核心端到端链路集成测试
 *
 * 本文件是 Stage 2（加密核心）的收口测试，验证各加密模块组合后的真实使用场景：
 *   1. 注册流程：KDF → HKDF(Auth Hash) → 生成 Symmetric Key → 双路径包装
 *   2. 日常使用：重新派生 Master Key → 解包 Symmetric Key → 加解密条目数据
 *   3. 数据恢复：用恢复码派生 Recovery Key → 解包 Symmetric Key → 验证数据可解
 *   4. 修改主密码：旧 Master Key 解包 → 新 Master Key 重新包装 → 数据仍可解
 *
 * 各模块的单元测试（kdf/hkdf/aes/keys）已覆盖边界与异常场景；
 * 本文件聚焦「模块组合正确性」与「真实业务流端到端可工作」。
 *
 * 使用 FAST_PARAMS（M-8 最低阈值 16MiB/2）保持测试速度；完整参数 64MiB/3 已在 kdf.test.ts 验证。
 */
// @vitest-environment node
import { describe, it, expect } from 'vitest';
import { deriveMasterKey, generateKdfSalt, buildKdfConfig } from '../kdf';
import { deriveAuthHash, deriveRecoveryKey } from '../hkdf';
import { encrypt, decrypt } from '../aes';
import {
  generateSymmetricKey,
  encryptSymmetricKey,
  decryptSymmetricKey,
  encryptSymmetricKeyWithRecovery,
  decryptSymmetricKeyWithRecovery,
} from '../keys';
import { getRandomBytes } from '../random';
import { toBase64 } from '../encoding';
import type { EncryptedData } from '../types';

// 测试用快速 KDF 参数（M-8 最低阈值：16MiB/2，保持可复现 + 快速）；完整参数 64MiB/3 见 kdf.test.ts
const FAST_PARAMS = {
  type: 'argon2id' as const,
  memoryKib: 16384, // 16 MiB（M-8 最低阈值）
  iterations: 2,
  parallelism: 4,
};

const TEST_EMAIL = 'alice@passbox.local';
const TEST_PASSWORD = 'MyStr0ngP@ssw0rd!2026';

/** 比较两个 CryptoKey 是否等价（通过导出 raw 字节） */
async function keysEqual(a: CryptoKey, b: CryptoKey): Promise<boolean> {
  const ra = await crypto.subtle.exportKey('raw', a);
  const rb = await crypto.subtle.exportKey('raw', b);
  return toBase64(new Uint8Array(ra)) === toBase64(new Uint8Array(rb));
}

/** 模拟一个密码条目的加密数据（对应 items 表字段） */
interface EncryptedItem {
  itemId: string;
  titleEncrypted: EncryptedData; // items.title_encrypted
  dataEncrypted: EncryptedData; // items.data_encrypted
}

describe('加密核心端到端链路', () => {
  describe('场景 1：注册流程（KDF → HKDF → 密钥生成 → 双路径包装）', () => {
    it('应完成完整注册加密链路，产出服务端可存储的密文', async () => {
      // 1. 生成 KDF salt（每用户唯一）
      const kdfSalt = generateKdfSalt();
      expect(kdfSalt.length).toBe(16);

      // 2. 派生 Master Key（Argon2id）
      const masterKey = await deriveMasterKey(
        TEST_PASSWORD,
        buildKdfConfig(kdfSalt, FAST_PARAMS),
      );
      expect(masterKey.length).toBe(32);

      // 3. 派生 Auth Hash（HKDF，上传服务端做 bcrypt）
      const authHash = await deriveAuthHash(masterKey, TEST_EMAIL);
      expect(authHash.length).toBe(32);

      // 4. 生成 Symmetric Key（随机 256-bit，加密所有条目数据）
      const symmetricKey = await generateSymmetricKey();

      // 5. 用 Master Key 包装 Symmetric Key → encrypted_key
      const encryptedKey = await encryptSymmetricKey(masterKey, symmetricKey);
      expect(encryptedKey.v).toBe(1);

      // 6. 生成恢复码（20 字节高熵随机，仅注册时返回一次）
      const recoveryCode = getRandomBytes(20);

      // 7. 派生 Recovery Key（HKDF，与 Auth Hash 域分离）
      const recoveryKey = await deriveRecoveryKey(recoveryCode, TEST_EMAIL);
      expect(recoveryKey.length).toBe(32);

      // 8. 用 Recovery Key 包装 Symmetric Key 副本 → recovery_encrypted_key
      const recoveryEncryptedKey = await encryptSymmetricKeyWithRecovery(
        recoveryKey,
        symmetricKey,
      );
      expect(recoveryEncryptedKey.v).toBe(1);

      // 断言：两份密文不同（不同密钥 + 不同 AAD + 不同 IV）
      expect(encryptedKey.iv).not.toBe(recoveryEncryptedKey.iv);
      expect(encryptedKey.ct).not.toBe(recoveryEncryptedKey.ct);

      // 断言：Master Key 与 Recovery Key 不可互换（域分离）
      expect(toBase64(masterKey)).not.toBe(toBase64(recoveryKey));

      // 断言：Auth Hash 与 Recovery Key 不可互换（域分离）
      expect(toBase64(authHash)).not.toBe(toBase64(recoveryKey));
    });
  });

  describe('场景 2：日常使用（登录 → 解包 Symmetric Key → 加解密条目）', () => {
    it('登录后应能解包 Symmetric Key 并加解密条目数据', async () => {
      // === 注册阶段（产出服务端存储） ===
      const kdfSalt = generateKdfSalt();
      const masterKey = await deriveMasterKey(
        TEST_PASSWORD,
        buildKdfConfig(kdfSalt, FAST_PARAMS),
      );
      const authHash = await deriveAuthHash(masterKey, TEST_EMAIL);
      const symmetricKey = await generateSymmetricKey();
      const encryptedKey = await encryptSymmetricKey(masterKey, symmetricKey);

      // === 登录阶段（客户端重新派生） ===
      // 1. 重新派生 Master Key（用存储的 kdfSalt）
      const masterKeyLogin = await deriveMasterKey(
        TEST_PASSWORD,
        buildKdfConfig(kdfSalt, FAST_PARAMS),
      );
      expect(toBase64(masterKeyLogin)).toBe(toBase64(masterKey));

      // 2. 重新派生 Auth Hash（上传服务端 bcrypt.compare 验证）
      const authHashLogin = await deriveAuthHash(masterKeyLogin, TEST_EMAIL);
      expect(toBase64(authHashLogin)).toBe(toBase64(authHash));

      // 3. 解包 Symmetric Key
      const symmetricKeyLogin = await decryptSymmetricKey(masterKeyLogin, encryptedKey);
      expect(await keysEqual(symmetricKeyLogin, symmetricKey)).toBe(true);

      // === 日常使用：创建条目 ===
      const itemId = crypto.randomUUID();
      const title = 'GitHub 账号';
      const payload = JSON.stringify({
        username: 'alice',
        password: 'p@ssw0rd123',
        url: 'https://github.com',
        notes: '主账号，开启 2FA',
      });

      // 4. 用 Symmetric Key 加密标题（AAD 绑定 itemId + field）
      const titleEncrypted = await encrypt(symmetricKeyLogin, title, `item:${itemId}:title`);
      // 5. 用 Symmetric Key 加密 payload（AAD 绑定 itemId + field）
      const dataEncrypted = await encrypt(symmetricKeyLogin, payload, `item:${itemId}:data`);

      // 断言：两份密文不同（不同明文 + 不同 AAD）
      expect(titleEncrypted.ct).not.toBe(dataEncrypted.ct);

      // === 日常使用：读取条目 ===
      // 6. 解密标题
      const decryptedTitle = await decrypt(symmetricKeyLogin, titleEncrypted, `item:${itemId}:title`);
      expect(decryptedTitle).toBe(title);
      // 7. 解密 payload
      const decryptedPayload = await decrypt(symmetricKeyLogin, dataEncrypted, `item:${itemId}:data`);
      expect(decryptedPayload).toBe(payload);
      expect(JSON.parse(decryptedPayload).password).toBe('p@ssw0rd123');

      // === 安全性：AAD 绑定验证（密文不可移植到其他上下文） ===
      // 8. 用 data 的 AAD 解密 title 应失败
      await expect(
        decrypt(symmetricKeyLogin, titleEncrypted, `item:${itemId}:data`),
      ).rejects.toThrow();
      // 9. 用 title 的 AAD 解密 data 应失败
      await expect(
        decrypt(symmetricKeyLogin, dataEncrypted, `item:${itemId}:title`),
      ).rejects.toThrow();
      // 10. 用其他 itemId 的 AAD 解密应失败
      await expect(
        decrypt(symmetricKeyLogin, titleEncrypted, `item:${crypto.randomUUID()}:title`),
      ).rejects.toThrow();
    });
  });

  describe('场景 3：数据恢复（主密码丢失 → 恢复码解包 → 新主密码重包装）', () => {
    it('主密码丢失后应能用恢复码恢复全部数据', async () => {
      // === 注册阶段 ===
      const kdfSalt = generateKdfSalt();
      const masterKey = await deriveMasterKey(
        TEST_PASSWORD,
        buildKdfConfig(kdfSalt, FAST_PARAMS),
      );
      const symmetricKey = await generateSymmetricKey();
      const encryptedKey = await encryptSymmetricKey(masterKey, symmetricKey);
      const recoveryCode = getRandomBytes(20);
      const recoveryKey = await deriveRecoveryKey(recoveryCode, TEST_EMAIL);
      const recoveryEncryptedKey = await encryptSymmetricKeyWithRecovery(
        recoveryKey,
        symmetricKey,
      );

      // === 注册时加密的条目数据（需在恢复后仍可解密） ===
      const itemId = crypto.randomUUID();
      const title = '备用邮箱密码';
      const payload = JSON.stringify({ password: 'b4ckupP@ss' });
      const titleEncrypted = await encrypt(symmetricKey, title, `item:${itemId}:title`);
      const dataEncrypted = await encrypt(symmetricKey, payload, `item:${itemId}:data`);

      // === 恢复流程：用户忘记主密码，使用恢复码 ===
      // 1. 用恢复码重新派生 Recovery Key（无需主密码）
      const recoveryKeyRecovery = await deriveRecoveryKey(recoveryCode, TEST_EMAIL);
      expect(toBase64(recoveryKeyRecovery)).toBe(toBase64(recoveryKey));

      // 2. 用 Recovery Key 从 recovery_encrypted_key 解包 Symmetric Key
      const symmetricKeyRecovered = await decryptSymmetricKeyWithRecovery(
        recoveryKeyRecovery,
        recoveryEncryptedKey,
      );
      expect(await keysEqual(symmetricKeyRecovered, symmetricKey)).toBe(true);

      // 3. 验证恢复的 Symmetric Key 能解密历史条目数据
      const decryptedTitle = await decrypt(
        symmetricKeyRecovered,
        titleEncrypted,
        `item:${itemId}:title`,
      );
      expect(decryptedTitle).toBe(title);
      const decryptedPayload = await decrypt(
        symmetricKeyRecovered,
        dataEncrypted,
        `item:${itemId}:data`,
      );
      expect(JSON.parse(decryptedPayload).password).toBe('b4ckupP@ss');

      // === 设置新主密码 ===
      const newPassword = 'NewStr0ngP@ssw0rd!2026';
      // 4. 派生新 Master Key（新 salt）
      const newKdfSalt = generateKdfSalt();
      const newMasterKey = await deriveMasterKey(
        newPassword,
        buildKdfConfig(newKdfSalt, FAST_PARAMS),
      );
      expect(toBase64(newMasterKey)).not.toBe(toBase64(masterKey));

      // 5. 派生新 Auth Hash（上传服务端替换旧 password_hash）
      const newAuthHash = await deriveAuthHash(newMasterKey, TEST_EMAIL);

      // 6. 用新 Master Key 重新包装（恢复出的）Symmetric Key → 新 encrypted_key
      const newEncryptedKey = await encryptSymmetricKey(newMasterKey, symmetricKeyRecovered);
      expect(newEncryptedKey.ct).not.toBe(encryptedKey.ct);

      // 7. 验证新密码登录后能解密条目
      const symmetricKeyNewLogin = await decryptSymmetricKey(newMasterKey, newEncryptedKey);
      expect(await keysEqual(symmetricKeyNewLogin, symmetricKey)).toBe(true);
      const verifyTitle = await decrypt(
        symmetricKeyNewLogin,
        titleEncrypted,
        `item:${itemId}:title`,
      );
      expect(verifyTitle).toBe(title);

      // 断言：新 Auth Hash 与旧 Auth Hash 不同（密码已更换）
      const oldAuthHash = await deriveAuthHash(masterKey, TEST_EMAIL);
      expect(toBase64(newAuthHash)).not.toBe(toBase64(oldAuthHash));
    });
  });

  describe('场景 4：修改主密码（旧密钥解包 → 新密钥重包装，数据不动）', () => {
    it('修改主密码后 Symmetric Key 不变，所有历史密文仍可解密', async () => {
      // === 初始注册 ===
      const kdfSalt = generateKdfSalt();
      const masterKey = await deriveMasterKey(
        TEST_PASSWORD,
        buildKdfConfig(kdfSalt, FAST_PARAMS),
      );
      const symmetricKey = await generateSymmetricKey();
      const encryptedKey = await encryptSymmetricKey(masterKey, symmetricKey);

      // === 加密若干条目 ===
      const items: EncryptedItem[] = [];
      for (let i = 0; i < 3; i++) {
        const itemId = crypto.randomUUID();
        items.push({
          itemId,
          titleEncrypted: await encrypt(
            symmetricKey,
            `条目 ${i}`,
            `item:${itemId}:title`,
          ),
          dataEncrypted: await encrypt(
            symmetricKey,
            JSON.stringify({ index: i }),
            `item:${itemId}:data`,
          ),
        });
      }

      // === 修改主密码 ===
      const newPassword = 'ChangedP@ssw0rd!2026';
      const newKdfSalt = generateKdfSalt();
      const newMasterKey = await deriveMasterKey(
        newPassword,
        buildKdfConfig(newKdfSalt, FAST_PARAMS),
      );

      // 1. 用旧 Master Key 解包 Symmetric Key
      const symmetricKeyFromOld = await decryptSymmetricKey(masterKey, encryptedKey);
      // 2. 用新 Master Key 重新包装同一把 Symmetric Key
      const newEncryptedKey = await encryptSymmetricKey(newMasterKey, symmetricKeyFromOld);

      // 断言：Symmetric Key 未变（只是换了包装）
      expect(await keysEqual(symmetricKeyFromOld, symmetricKey)).toBe(true);

      // 3. 验证所有历史条目仍可用同一 Symmetric Key 解密
      for (const item of items) {
        const title = await decrypt(
          symmetricKeyFromOld,
          item.titleEncrypted,
          `item:${item.itemId}:title`,
        );
        expect(title).toMatch(/^条目 \d$/);
        const data = await decrypt(
          symmetricKeyFromOld,
          item.dataEncrypted,
          `item:${item.itemId}:data`,
        );
        expect(JSON.parse(data).index).toBeGreaterThanOrEqual(0);
      }

      // 4. 新密码登录也能解包同一 Symmetric Key
      const symmetricKeyFromNew = await decryptSymmetricKey(newMasterKey, newEncryptedKey);
      expect(await keysEqual(symmetricKeyFromNew, symmetricKey)).toBe(true);

      // 5. 旧密文（encrypted_key）不能用新 Master Key 解密
      await expect(decryptSymmetricKey(newMasterKey, encryptedKey)).rejects.toThrow();
      // 6. 新密文不能用旧 Master Key 解密
      await expect(decryptSymmetricKey(masterKey, newEncryptedKey)).rejects.toThrow();
    });
  });

  describe('场景 5：零知识架构验证（服务端可见数据不含明文）', () => {
    it('服务端存储的字段均不含主密码 / Symmetric Key / 条目明文', async () => {
      const password = 'SecretP@ssw0rd2026';
      const kdfSalt = generateKdfSalt();
      const masterKey = await deriveMasterKey(
        password,
        buildKdfConfig(kdfSalt, FAST_PARAMS),
      );
      const authHash = await deriveAuthHash(masterKey, TEST_EMAIL);
      const symmetricKey = await generateSymmetricKey();
      const encryptedKey = await encryptSymmetricKey(masterKey, symmetricKey);
      const recoveryCode = getRandomBytes(20);
      const recoveryKey = await deriveRecoveryKey(recoveryCode, TEST_EMAIL);
      const recoveryEncryptedKey = await encryptSymmetricKeyWithRecovery(
        recoveryKey,
        symmetricKey,
      );

      // 条目明文
      const itemTitle = '我的银行卡密码';
      const itemPayload = JSON.stringify({ card: '6222xxxx', pin: '123456' });
      const itemId = crypto.randomUUID();
      const titleEncrypted = await encrypt(symmetricKey, itemTitle, `item:${itemId}:title`);
      const dataEncrypted = await encrypt(symmetricKey, itemPayload, `item:${itemId}:data`);

      // 服务端可见的所有数据（模拟数据库泄露场景）
      const serverVisible = {
        kdfSaltBase64: toBase64(kdfSalt),
        authHashBase64: toBase64(authHash),
        encryptedKey: JSON.stringify(encryptedKey),
        recoveryEncryptedKey: JSON.stringify(recoveryEncryptedKey),
        titleEncrypted: JSON.stringify(titleEncrypted),
        dataEncrypted: JSON.stringify(dataEncrypted),
      };
      const serverVisibleStr = JSON.stringify(serverVisible);

      // 断言：服务端可见数据中不含任何明文敏感信息
      expect(serverVisibleStr).not.toContain(password);
      expect(serverVisibleStr).not.toContain(itemTitle);
      expect(serverVisibleStr).not.toContain('123456');
      expect(serverVisibleStr).not.toContain('6222xxxx');
      // Master Key / Symmetric Key 的 raw 字节不应以明文出现
      const masterKeyB64 = toBase64(masterKey);
      expect(serverVisibleStr).not.toContain(masterKeyB64);
      const symKeyRaw = new Uint8Array(await crypto.subtle.exportKey('raw', symmetricKey));
      expect(serverVisibleStr).not.toContain(toBase64(symKeyRaw));
      // 恢复码明文不应出现
      expect(serverVisibleStr).not.toContain(toBase64(recoveryCode));
    });
  });
});
