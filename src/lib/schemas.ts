/**
 * 共享 zod schema 定义（M-7/M-8 修复）
 *
 * register / recover 路由共享的加密数据与 KDF 参数校验 schema，
 * 集中维护以避免校验逻辑漂移。
 *
 * - EncryptedData schema：{ v:1, iv, ct }
 * - KDF salt schema：base64 字符串，解码后必须为 16 字节（crypto_pwhash_SALTBYTES）
 * - KDF params schema：强制最低安全阈值（与 kdf.ts MIN_KDF_* 一致）
 * - API 通用 schema：UUID、条目创建/更新等，供 Route Handler 复用
 */
import { z } from 'zod';
import { MIN_KDF_MEMORY_KIB, MIN_KDF_ITERATIONS, MIN_KDF_PARALLELISM } from '@/lib/crypto/kdf';

/** KDF salt 期望字节数（crypto_pwhash_SALTBYTES = 16） */
const KDF_SALT_BYTES = 16;

/** UUID v4 校验（小写/大写兼容） */
export const uuidSchema = z
  .string()
  .regex(/^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/, '必须是合法 UUID');

/**
 * 加密数据 zod schema（对应 EncryptedData { v:1, iv, ct }）
 */
export const encryptedDataSchema = z.object({
  v: z.literal(1),
  iv: z.string().min(1),
  ct: z.string().min(1),
});

/**
 * 条目类型 ID 范围（与 migrate.ts 预置 1-16 一致）
 */
export const itemTypeIdSchema = z.number().int().min(1).max(16);

/**
 * 创建条目请求体 schema（POST /api/items）
 */
export const createItemSchema = z.object({
  itemId: uuidSchema,
  vaultId: uuidSchema,
  itemTypeId: itemTypeIdSchema,
  titleEncrypted: encryptedDataSchema,
  dataEncrypted: encryptedDataSchema,
  tagIds: z.array(uuidSchema).max(20, '单条目最多 20 个标签'),
});

/**
 * 更新条目请求体 schema（PUT /api/items/[id]）
 */
export const updateItemSchema = z.object({
  titleEncrypted: encryptedDataSchema,
  dataEncrypted: encryptedDataSchema,
});

/**
 * 创建附件请求体 schema（POST /api/items/[id]/attachments）
 *
 * 文件名/MIME/数据均以 EncryptedData 形式上传，fileSize 由客户端上报
 * 但服务端二次校验上限（防止客户端绕过加密谎报大小）。
 */
export const MAX_FILE_SIZE = 5 * 1024 * 1024;
export const MAX_ATTACHMENTS_PER_ITEM = 10;

export const createAttachmentSchema = z.object({
  filenameEncrypted: encryptedDataSchema,
  mimeTypeEncrypted: encryptedDataSchema,
  fileSize: z.number().int().positive().max(MAX_FILE_SIZE, '文件大小不能超过 5MB'),
  dataEncrypted: encryptedDataSchema,
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
