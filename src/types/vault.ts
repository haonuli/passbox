/**
 * 密码库解密数据类型定义 (T4.2)
 *
 * 客户端解密后的条目、保险库、标签类型。
 * 服务端只存密文，客户端用 Symmetric Key 解密后缓存到 vault-store。
 */

/**
 * 解密后的保险库
 */
export interface DecryptedVault {
  id: string;
  /** 解密后的保险库名称 */
  name: string;
  displayOrder: number;
  createdAt: string;
  updatedAt: string;
}

/**
 * 登录条目 payload（data_encrypted 解密后的 JSON 结构）
 *
 * 对应 item_types.field_schema: ["title","url","username","password","totp_secret","notes"]
 */
export interface LoginItemData {
  url?: string;
  username?: string;
  password?: string;
  totpSecret?: string;
  notes?: string;
}

/**
 * 安全笔记 payload
 */
export interface SecureNoteItemData {
  noteText?: string;
}

/**
 * 信用卡 payload
 */
export interface CreditCardItemData {
  cardholder?: string;
  cardNumber?: string;
  expiry?: string;
  cvv?: string;
  notes?: string;
}

/** 条目数据 payload 联合类型 */
export type ItemData = LoginItemData & SecureNoteItemData & CreditCardItemData;

/**
 * 解密后的条目
 */
export interface DecryptedItem {
  id: string;
  vaultId: string;
  itemTypeId: number;
  /** 条目类型代码（login / secure_note / credit_card） */
  itemTypeCode: string;
  /** 解密后的标题 */
  title: string;
  /** 解密后的 payload */
  data: ItemData;
  isFavorite: boolean;
  createdAt: string;
  updatedAt: string;
  /** 关联的标签 ID 列表 */
  tagIds: string[];
}

/**
 * 解密后的标签
 */
export interface DecryptedTag {
  id: string;
  name: string;
  createdAt: string;
}

/** 条目类型代码常量 */
export const ITEM_TYPE_CODES = {
  LOGIN: 1,
  SECURE_NOTE: 2,
  CREDIT_CARD: 3,
} as const;

/** 条目类型代码字符串 */
export const ITEM_TYPE_CODE_STRINGS = ['login', 'secure_note', 'credit_card'] as const;
