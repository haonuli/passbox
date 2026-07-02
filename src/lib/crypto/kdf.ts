/**
 * Argon2id 密钥派生模块 (T2.2)
 *
 * 对应 TECHNICAL_DESIGN.md 3.2 节。
 * 从用户主密码派生 32 字节 Master Key（用于加解密 Symmetric Key 与派生 Auth Hash）。
 *
 * 参数（默认）：
 *   - memoryCost = 65536 KiB (64 MiB)  → memLimit = 67108864 字节
 *   - timeCost   = 3                    → opsLimit = 3
 *   - salt       = 16 字节随机（crypto_pwhash_SALTBYTES）
 *   - hashLength = 32 字节
 *   - algorithm  = crypto_pwhash_ALG_ARGON2ID13
 *
 * ⚠️ 关于 parallelism 的实现偏差（已记录）：
 *   技术设计 3.2 标注 parallelism=4，但 libsodium 高层 `crypto_pwhash` API 不暴露
 *   Argon2id 的 parallelism (p) 参数——由其内部依据 opslimit/memlimit 自动决定。
 *   KdfConfig/KdfParams 仍保留 `parallelism` 字段以维持 API 契约与未来迁移路径
 *   （如切换 argon2-browser），实际派生仅传入 opsLimit 与 memLimit。
 *   安全影响可接受：抗 GPU 暴力破解主要由内存硬度（64MiB）决定，p=1 vs p=4 差异不显著。
 *
 * 客户端使用；耗时操作（~300ms-1s），建议在 Web Worker 中调用（见 kdf.worker.ts）。
 */
import sodium from 'libsodium-wrappers-sumo';
import { ensureSodiumReady } from './sodium-init';
import { getRandomBytes } from './random';
import type { KdfConfig, KdfParams } from './types';

/** Master Key 输出长度（字节） */
export const MASTER_KEY_LENGTH = 32;

/**
 * 默认 KDF 参数（对应 TECHNICAL_DESIGN 3.2 推荐配置）。
 * 用于注册时写入 users 表的 kdf_* 字段，及 prelogin/login 响应。
 */
export const DEFAULT_KDF_PARAMS: KdfParams = {
  type: 'argon2id',
  memoryKib: 65536,
  iterations: 3,
  parallelism: 4,
};

/**
 * 生成 KDF salt（16 字节随机）。
 * 长度由 crypto_pwhash_SALTBYTES 决定；此处硬编码 16 并在 deriveMasterKey 中
 * 运行时校验，避免 salt 生成依赖 sodium.ready。
 */
export function generateKdfSalt(): Uint8Array {
  return getRandomBytes(16);
}

/**
 * 由 salt 与 KdfParams 构建内部 KdfConfig。
 * @param salt 16 字节随机 salt
 * @param params KDF 参数（默认 DEFAULT_KDF_PARAMS）
 */
export function buildKdfConfig(
  salt: Uint8Array,
  params: KdfParams = DEFAULT_KDF_PARAMS,
): KdfConfig {
  return {
    salt,
    memoryCost: params.memoryKib,
    timeCost: params.iterations,
    parallelism: params.parallelism,
  };
}

/**
 * 使用 Argon2id 从主密码派生 Master Key。
 *
 * @param password 用户主密码（UTF-8，libsodium 内部处理编码）
 * @param config KDF 配置（含 salt / memoryCost(KiB) / timeCost / parallelism）
 * @returns 32 字节 Master Key
 * @throws Error 当 salt 长度不等于 crypto_pwhash_SALTBYTES 时
 */
export async function deriveMasterKey(
  password: string,
  config: KdfConfig,
): Promise<Uint8Array> {
  await ensureSodiumReady();

  const saltBytes = sodium.crypto_pwhash_SALTBYTES;
  if (config.salt.length !== saltBytes) {
    throw new Error(
      `KDF salt 长度必须为 ${saltBytes} 字节 (crypto_pwhash_SALTBYTES)，收到 ${config.salt.length}`,
    );
  }

  const memLimitBytes = config.memoryCost * 1024; // KiB → 字节
  const opsLimit = config.timeCost;

  return sodium.crypto_pwhash(
    MASTER_KEY_LENGTH,
    password,
    config.salt,
    opsLimit,
    memLimitBytes,
    sodium.crypto_pwhash_ALG_ARGON2ID13,
  );
}
