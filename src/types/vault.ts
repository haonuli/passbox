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
 * 条目数据 payload（data_encrypted 解密后的 JSON 结构）
 *
 * 包含所有条目类型的所有可能字段，按类型使用子集。
 * 字段定义参考 src/lib/item-types.ts 中的 ITEM_TYPE_CONFIGS。
 */
export interface ItemData {
  // ---- login / password / server / database / wireless_router ----
  url?: string;
  username?: string;
  password?: string;
  totpSecret?: string;

  // ---- secure_note ----
  noteText?: string;

  // ---- credit_card ----
  cardholder?: string;
  cardNumber?: string;
  expiry?: string;
  cvv?: string;

  // ---- identity ----
  firstName?: string;
  lastName?: string;
  gender?: string;
  birthDate?: string;
  address?: string;
  city?: string;
  state?: string;
  zip?: string;
  country?: string;
  phone?: string;
  email?: string;
  website?: string;

  // ---- software_license ----
  licensee?: string;
  licenseKey?: string;
  softwareName?: string;
  softwareVersion?: string;
  publisher?: string;
  orderNumber?: string;
  purchaseDate?: string;

  // ---- bank_account ----
  accountHolder?: string;
  accountNumber?: string;
  bankName?: string;
  routingNumber?: string;
  iban?: string;
  swift?: string;

  // ---- wireless_router ----
  networkName?: string;
  encryptionType?: string;
  baseStationName?: string;
  ip?: string;
  port?: string;
  serialNumber?: string;

  // ---- server ----
  hostname?: string;
  adminConsoleUrl?: string;

  // ---- database ----
  database?: string;
  type?: string;

  // ---- api_credential ----
  apiKey?: string;
  apiSecret?: string;
  validFrom?: string;
  expiration?: string;

  // ---- crypto_wallet ----
  walletAddress?: string;
  privateMnemonic?: string;

  // ---- driver_license / passport ----
  licenseNumber?: string;
  fullName?: string;
  issuingAuthority?: string;
  expiryDate?: string;
  passportNumber?: string;
  issueDate?: string;

  // ---- membership / reward_program ----
  organization?: string;
  membershipNumber?: string;
  memberName?: string;
  programName?: string;
  pointsBalance?: string;

  // ---- common ----
  notes?: string;
}

/**
 * 解密后的条目
 */
export interface DecryptedItem {
  id: string;
  vaultId: string;
  itemTypeId: number;
  /** 条目类型代码（login / secure_note / credit_card / ...） */
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

/** 条目类型代码常量（id 与数据库 item_types 表一致） */
export const ITEM_TYPE_CODES = {
  LOGIN: 1,
  SECURE_NOTE: 2,
  CREDIT_CARD: 3,
  IDENTITY: 4,
  PASSWORD: 5,
  SOFTWARE_LICENSE: 6,
  BANK_ACCOUNT: 7,
  WIRELESS_ROUTER: 8,
  SERVER: 9,
  DATABASE: 10,
  API_CREDENTIAL: 11,
  CRYPTO_WALLET: 12,
  DRIVER_LICENSE: 13,
  PASSPORT: 14,
  MEMBERSHIP: 15,
  REWARD_PROGRAM: 16,
} as const;

/** 条目类型代码字符串列表 */
export const ITEM_TYPE_CODE_STRINGS = [
  'login',
  'secure_note',
  'credit_card',
  'identity',
  'password',
  'software_license',
  'bank_account',
  'wireless_router',
  'server',
  'database',
  'api_credential',
  'crypto_wallet',
  'driver_license',
  'passport',
  'membership',
  'reward_program',
] as const;
