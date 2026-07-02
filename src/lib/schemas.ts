/**
 * 共享 zod schema 定义（M-7/M-8 修复）
 *
 * register / recover 路由共享的加密数据与 KDF 参数校验 schema，
 * 集中维护以避免校验逻辑漂移。
 *
 * - EncryptedData schema：{ v:1, iv, ct }
 * - KDF salt schema：base64 字符串，解码后必须为 16 字节（crypto_pwhash_SALTBYTES）
 * - KDF params schema：强制最低安全阈值（与 kdf.ts MIN_KDF_* 一致）
 */
import { z } from 'zod';
import { MIN_KDF_MEMORY_KIB, MIN_KDF_ITERATIONS, MIN_KDF_PARALLELISM } from '@/lib/crypto/kdf';

/** KDF salt 期望字节数（crypto_pwhash_SALTBYTES = 16） */
const KDF_SALT_BYTES = 16;

/**
 * 加密数据 zod schema（对应 EncryptedData { v:1, iv, ct }）
 */
export const encryptedDataSchema = z.object({
  v: z.literal(1),
  iv: z.string().min(1),
  ct: z.string().min(1),
});

/**
 * KDF salt zod schema（M-7 修复）。
 *
 * 校验：合法 base64 且解码后为 16 字节。
 * 之前仅 z.string().min(1)，可接受任意字符串，写入 BYTEA 列后客户端无法正确派生。
 */
export const kdfSaltSchema = z
  .string()
  .min(1, 'kdfSalt 不能为空')
  .refine((s) => {
    // 必须为合法 base64
    try {
      const buf = Buffer.from(s, 'base64');
      return buf.length === KDF_SALT_BYTES;
    } catch {
      return false;
    }
  }, `kdfSalt 必须为合法 base64 且解码后为 ${KDF_SALT_BYTES} 字节`);

/**
 * KDF 参数 zod schema（M-8 修复）。
 *
 * 强制最低阈值，防止服务端存储/返回过弱参数导致客户端派生易被暴力破解。
 * 与 kdf.ts deriveMasterKey 运行时校验保持一致。
 */
export const kdfParamsSchema = z.object({
  type: z.literal('argon2id'),
  memoryKib: z.number().int().min(MIN_KDF_MEMORY_KIB, `memoryKib 不得低于 ${MIN_KDF_MEMORY_KIB}`),
  iterations: z.number().int().min(MIN_KDF_ITERATIONS, `iterations 不得低于 ${MIN_KDF_ITERATIONS}`),
  parallelism: z.number().int().min(MIN_KDF_PARALLELISM, `parallelism 不得低于 ${MIN_KDF_PARALLELISM}`),
});
