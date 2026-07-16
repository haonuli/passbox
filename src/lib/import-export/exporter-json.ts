/**
 * 加密 JSON 导出器
 *
 * 将解密后的条目导出为加密的 JSON 文件，使用主密码加密。
 * 导出流程：
 *   1. 生成新随机 salt（16 字节）
 *   2. 用 Argon2id 从 masterPassword + 新 salt 派生 masterKey
 *   3. 用 HKDF-SHA256 从 masterKey 派生加密密钥（info="passbox:export:v1"）
 *   4. 将 items 序列化为 JSON 字符串
 *   5. 用 AES-256-GCM 加密
 *   6. 构建 EncryptedExport 结构并返回 JSON.stringify
 *
 * 导入流程为逆向操作：解析 JSON -> 派生密钥 -> 解密 -> 返回 ImportItem[]。
 */
import { encrypt, decrypt } from '@/lib/crypto/aes';
import { getRandomBytes } from '@/lib/crypto/random';
import { toBase64, fromBase64, stringToBytes } from '@/lib/crypto/encoding';
import { deriveMasterKey, buildKdfConfig } from '@/lib/crypto/kdf';
import type { KdfParams } from '@/types/crypto';
import type { DecryptedItem } from '@/types/vault';
import type { EncryptedExport, ImportItem } from './types';

/** HKDF 域分离标签 */
const EXPORT_KEY_INFO = 'passbox:export:v1';

/** HKDF salt（固定常量，确保导出/导入一致） */
const EXPORT_HKDF_SALT = 'passbox-export-v1';

/**
 * 从 Master Key 通过 HKDF-SHA256 派生导出加密密钥。
 *
 * 使用固定 salt + info="passbox:export:v1" 做域分离，
 * 直接 deriveKey 为 AES-GCM CryptoKey。
 */
async function deriveExportKey(masterKey: Uint8Array): Promise<CryptoKey> {
  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    masterKey.slice(),
    { name: 'HKDF' },
    false,
    ['deriveKey'],
  );

  return crypto.subtle.deriveKey(
    {
      name: 'HKDF',
      hash: 'SHA-256',
      salt: stringToBytes(EXPORT_HKDF_SALT).slice(),
      info: stringToBytes(EXPORT_KEY_INFO).slice(),
    },
    keyMaterial,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt'],
  );
}

/**
 * 将 DecryptedItem[] 转换为可序列化的 ImportItem[] 格式。
 *
 * 导出文件中存储的是 ImportItem 中间格式，导入时直接使用。
 */
function itemsToImportItems(items: DecryptedItem[]): ImportItem[] {
  return items.map((item) => ({
    title: item.title,
    itemType: item.itemTypeCode,
    fields: { ...item.data },
    favorite: item.isFavorite,
    tags: [],
  }));
}

/**
 * 将解密后的条目列表导出为加密 JSON 字符串。
 *
 * @param items 解密后的条目列表
 * @param masterPassword 用户主密码
 * @param _kdfSalt 用户当前 KDF salt（base64，未使用--导出时生成新 salt）
 * @param kdfParams KDF 参数（memoryKib / iterations / parallelism）
 * @returns 加密导出文件的 JSON 字符串
 */
export async function exportToEncryptedJson(
  items: DecryptedItem[],
  masterPassword: string,
  _kdfSalt: string,
  kdfParams: KdfParams,
): Promise<string> {
  // 1. 生成新随机 salt（16 字节）
  const newSalt = getRandomBytes(16);

  // 2. 用 Argon2id 从 masterPassword + 新 salt 派生 masterKey
  const kdfConfig = buildKdfConfig(newSalt, kdfParams);
  const masterKey = await deriveMasterKey(masterPassword, kdfConfig);

  // 3. 用 HKDF 从 masterKey 派生加密密钥
  const exportKey = await deriveExportKey(masterKey);

  // 4. 将 items 序列化为 JSON 字符串
  const importItems = itemsToImportItems(items);
  const jsonString = JSON.stringify(importItems);

  // 5. 用 AES-256-GCM 加密
  const encryptedData = await encrypt(exportKey, jsonString, EXPORT_KEY_INFO);

  // 6. 构建 EncryptedExport 结构
  const exportData: EncryptedExport = {
    version: 1,
    format: 'passbox-encrypted-export',
    createdAt: new Date().toISOString(),
    kdf: {
      algorithm: 'argon2id',
      salt: toBase64(newSalt),
      params: {
        memoryCost: kdfParams.memoryKib,
        timeCost: kdfParams.iterations,
        parallelism: kdfParams.parallelism,
      },
    },
    encryptedData,
  };

  return JSON.stringify(exportData, null, 2);
}

/**
 * 从加密导出文件中导入条目。
 *
 * @param jsonContent 加密导出文件的 JSON 字符串
 * @param masterPassword 用户主密码
 * @returns 解密后的 ImportItem 数组
 * @throws Error 当密码错误、文件格式不合法或解密失败时
 */
export async function importFromEncryptedJson(
  jsonContent: string,
  masterPassword: string,
): Promise<ImportItem[]> {
  // 解析 JSON
  const exportData = JSON.parse(jsonContent) as EncryptedExport;

  // 校验基本结构
  if (exportData.format !== 'passbox-encrypted-export') {
    throw new Error('无效的导出文件格式');
  }
  if (exportData.version !== 1) {
    throw new Error(`不支持的导出文件版本: ${exportData.version}`);
  }

  // 提取 kdf.salt 和 kdf.params
  const salt = fromBase64(exportData.kdf.salt);
  const kdfParams: KdfParams = {
    type: 'argon2id',
    memoryKib: exportData.kdf.params.memoryCost,
    iterations: exportData.kdf.params.timeCost,
    parallelism: exportData.kdf.params.parallelism,
  };

  // 用 masterPassword 派生 masterKey
  const kdfConfig = buildKdfConfig(salt, kdfParams);
  const masterKey = await deriveMasterKey(masterPassword, kdfConfig);

  // 用 HKDF 派生解密密钥
  const decryptKey = await deriveExportKey(masterKey);

  // 解密 encryptedData
  const jsonString = await decrypt(decryptKey, exportData.encryptedData, EXPORT_KEY_INFO);

  // 返回 ImportItem[]
  return JSON.parse(jsonString) as ImportItem[];
}
