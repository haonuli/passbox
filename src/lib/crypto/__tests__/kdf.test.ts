// @vitest-environment node
import { describe, it, expect } from 'vitest';
import {
  deriveMasterKey,
  generateKdfSalt,
  buildKdfConfig,
  DEFAULT_KDF_PARAMS,
  MASTER_KEY_LENGTH,
} from '../kdf';
import { ensureSodiumReady } from '../sodium-init';
import { getRandomBytes } from '../random';

// 完整参数（对应 TECHNICAL_DESIGN 3.2 推荐：64MiB / 3 / 4）——仅用于必须验证真实参数的用例
const FULL_SALT = generateKdfSalt();
const FULL_CONFIG = buildKdfConfig(FULL_SALT);

// 加速参数（8MiB / 1）——用于确定性 / 唯一性等不依赖具体强度的用例，保持测试快速
const FAST_PARAMS = { type: 'argon2id' as const, memoryKib: 8192, iterations: 1, parallelism: 1 };
const FAST_SALT = generateKdfSalt();
const FAST_CONFIG = buildKdfConfig(FAST_SALT, FAST_PARAMS);

describe('Argon2id 密钥派生 (deriveMasterKey)', () => {
  // 预加载 libsodium，避免首个用例承担初始化耗时
  it('libsodium 预加载完成', async () => {
    await expect(ensureSodiumReady()).resolves.toBeUndefined();
  });

  it('返回 32 字节 Master Key（完整参数 65536/3）', async () => {
    const mk = await deriveMasterKey('MyStr0ngP@ssw0rd!', FULL_CONFIG);
    expect(mk).toBeInstanceOf(Uint8Array);
    expect(mk.length).toBe(MASTER_KEY_LENGTH);
    expect(mk.length).toBe(32);
  });

  it('相同 password + salt 派生结果一致（确定性）', async () => {
    const k1 = await deriveMasterKey('test123', FAST_CONFIG);
    const k2 = await deriveMasterKey('test123', FAST_CONFIG);
    expect(k1).toEqual(k2);
  });

  it('不同 salt 派生结果不同', async () => {
    const otherConfig = buildKdfConfig(getRandomBytes(16), FAST_PARAMS);
    const k1 = await deriveMasterKey('test123', FAST_CONFIG);
    const k2 = await deriveMasterKey('test123', otherConfig);
    expect(k1).not.toEqual(k2);
  });

  it('不同 password 派生结果不同', async () => {
    const k1 = await deriveMasterKey('test123', FAST_CONFIG);
    const k2 = await deriveMasterKey('DifferentP@ss1', FAST_CONFIG);
    expect(k1).not.toEqual(k2);
  });

  it('完整参数 Argon2id 内存硬度耗时 > 50ms', async () => {
    const start = Date.now();
    await deriveMasterKey('MyStr0ngP@ssw0rd!', FULL_CONFIG);
    const elapsed = Date.now() - start;
    // 64MiB 内存硬度 + 3 轮迭代，至少几十毫秒（间接验证参数已传入）
    expect(elapsed).toBeGreaterThan(50);
  });

  it('salt 长度错误抛出异常（15 字节）', async () => {
    const badConfig = buildKdfConfig(getRandomBytes(15));
    await expect(deriveMasterKey('test', badConfig)).rejects.toThrow(/salt/);
  });

  it('salt 长度错误抛出异常（17 字节）', async () => {
    const badConfig = buildKdfConfig(getRandomBytes(17));
    await expect(deriveMasterKey('test', badConfig)).rejects.toThrow(/salt/);
  });

  it('空密码仍可派生（不抛错，返回 32 字节）', async () => {
    const mk = await deriveMasterKey('', FAST_CONFIG);
    expect(mk.length).toBe(32);
  });

  it('含中文 / emoji 的密码可正确派生（UTF-8）', async () => {
    const mk = await deriveMasterKey('密码 🔐 Pass123!', FAST_CONFIG);
    expect(mk.length).toBe(32);
  });
});

describe('KDF 辅助函数', () => {
  it('generateKdfSalt 返回 16 字节', () => {
    const salt = generateKdfSalt();
    expect(salt).toBeInstanceOf(Uint8Array);
    expect(salt.length).toBe(16);
  });

  it('generateKdfSalt 每次结果不同', () => {
    expect(generateKdfSalt()).not.toEqual(generateKdfSalt());
  });

  it('DEFAULT_KDF_PARAMS 符合设计（65536 / 3 / 4）', () => {
    expect(DEFAULT_KDF_PARAMS).toEqual({
      type: 'argon2id',
      memoryKib: 65536,
      iterations: 3,
      parallelism: 4,
    });
  });

  it('buildKdfConfig 正确映射 KdfParams → KdfConfig', () => {
    const salt = generateKdfSalt();
    const config = buildKdfConfig(salt);
    expect(config.salt).toBe(salt);
    expect(config.memoryCost).toBe(65536);
    expect(config.timeCost).toBe(3);
    expect(config.parallelism).toBe(4);
  });
});
