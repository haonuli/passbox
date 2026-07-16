/**
 * 导入/导出功能类型定义
 *
 * @see docs/IMPORT_EXPORT_DESIGN.md
 */
import type { EncryptedData } from '@/types/crypto';
import type { DecryptedItem } from '@/types/vault';

/** 支持的导入格式 */
export type ImportFormat =
  | 'browser-csv'
  | 'bitwarden-csv'
  | 'bitwarden-json'
  | '1password-csv'
  | '1password-1pux'
  | 'generic-csv';

/** 归一化中间格式（所有导入来源统一转为这个） */
export interface ImportItem {
  title: string;
  /** PassBox item type code（如 'login', 'secure_note', 'credit_card', 'identity'） */
  itemType: string;
  /** 字段名 -> 值（对应 item-types.ts 中定义的字段名） */
  fields: Record<string, string>;
  favorite: boolean;
  tags: string[];
}

/** 查重结果 */
export interface DuplicateMatch {
  importItem: ImportItem;
  /** 匹配到的已有条目（如果重复） */
  existingItem?: DecryptedItem;
  isDuplicate: boolean;
  /** 用户选择的操作 */
  action: 'import' | 'overwrite' | 'skip';
}

/** 加密导出文件结构 */
export interface EncryptedExport {
  version: 1;
  format: 'passbox-encrypted-export';
  createdAt: string;
  kdf: {
    algorithm: 'argon2id';
    salt: string;
    params: { memoryCost: number; timeCost: number; parallelism: number };
  };
  encryptedData: EncryptedData;
}

/** 通用 CSV 列映射 */
export interface ColumnMapping {
  csvColumn: string;
  targetField: string | null;
}

/** 导入结果摘要 */
export interface ImportSummary {
  total: number;
  imported: number;
  skipped: number;
  overwritten: number;
  failed: number;
  errors: string[];
}

/** 批量创建条目的输入（已加密） */
export interface BatchCreateItemInput {
  itemId: string;
  vaultId: string;
  itemTypeId: number;
  titleEncrypted: EncryptedData;
  dataEncrypted: EncryptedData;
  tagIds: string[];
}

/** 批量更新条目的输入（已加密） */
export interface BatchUpdateItemInput {
  itemId: string;
  titleEncrypted: EncryptedData;
  dataEncrypted: EncryptedData;
}
