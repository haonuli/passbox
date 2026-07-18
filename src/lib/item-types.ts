/**
 * 条目类型集中配置
 *
 * 参考 1Password 的条目类型，定义 16 种类型及其字段。
 * 表单、详情页、列表图标均从本配置驱动渲染，新增类型只需在此扩展。
 */
import {
  KeyRound,
  FileText,
  CreditCard,
  User,
  Lock,
  Award,
  Landmark,
  Wifi,
  Server,
  Database,
  Code,
  Wallet,
  Car,
  BookOpen,
  BadgeCheck,
  Gift,
  TerminalSquare,
  Globe,
  Phone,
  Mail,
  Calendar,
  MapPin,
  Hash,
  type LucideIcon,
} from 'lucide-react';

/** 字段渲染类型 */
export type FieldType = 'text' | 'password' | 'textarea' | 'date';

/** 字段配置 */
export interface FieldConfig {
  name: string;
  label: string;
  type: FieldType;
  placeholder?: string;
  /** 在双列网格中的位置；不设置则占满整行 */
  col?: 1 | 2;
  /** 最大长度（zod 校验），默认 text=500 / textarea=10000 */
  maxLength?: number;
  /** 详情页是否可复制 */
  copyable?: boolean;
  /** 是否可掩码显示（如私钥等敏感长文本） */
  maskable?: boolean;
}

/** 条目类型配置 */
export interface ItemTypeConfig {
  id: number;
  code: string;
  name: string;
  icon: LucideIcon;
  fields: FieldConfig[];
}

/** 通用备注字段 */
const NOTES_FIELD: FieldConfig = {
  name: 'notes',
  label: '备注',
  type: 'textarea',
  placeholder: '可选备注信息',
  maxLength: 5000,
};

/** 所有条目类型配置（id 与数据库 item_types 表一致） */
export const ITEM_TYPE_CONFIGS: ItemTypeConfig[] = [
  {
    id: 1,
    code: 'login',
    name: '登录',
    icon: KeyRound,
    fields: [
      { name: 'url', label: '网址', type: 'text', placeholder: 'https://example.com', copyable: true },
      { name: 'username', label: '用户名', type: 'text', placeholder: '用户名或邮箱', copyable: true },
      { name: 'password', label: '密码', type: 'password', placeholder: '输入或生成密码', copyable: true },
      { name: 'totpSecret', label: '一次性密码（TOTP）', type: 'text', placeholder: '粘贴 base32 密钥（可选）' },
      NOTES_FIELD,
    ],
  },
  {
    id: 2,
    code: 'secure_note',
    name: '安全笔记',
    icon: FileText,
    fields: [
      { name: 'noteText', label: '笔记内容', type: 'textarea', placeholder: '输入笔记内容…', maxLength: 10000 },
    ],
  },
  {
    id: 3,
    code: 'credit_card',
    name: '信用卡',
    icon: CreditCard,
    fields: [
      { name: 'cardholder', label: '持卡人', type: 'text', placeholder: '持卡人姓名' },
      { name: 'cardNumber', label: '卡号', type: 'password', placeholder: '信用卡号', copyable: true },
      { name: 'expiry', label: '有效期', type: 'text', placeholder: 'MM/YY', col: 1 },
      { name: 'cvv', label: 'CVV', type: 'password', placeholder: '安全码', col: 2 },
      NOTES_FIELD,
    ],
  },
  {
    id: 4,
    code: 'identity',
    name: '身份信息',
    icon: User,
    fields: [
      { name: 'firstName', label: '名', type: 'text', placeholder: '名', col: 1 },
      { name: 'lastName', label: '姓', type: 'text', placeholder: '姓', col: 2 },
      { name: 'gender', label: '性别', type: 'text', placeholder: '性别', col: 1 },
      { name: 'birthDate', label: '出生日期', type: 'date', col: 2 },
      { name: 'address', label: '地址', type: 'text', placeholder: '街道地址' },
      { name: 'city', label: '城市', type: 'text', placeholder: '城市', col: 1 },
      { name: 'state', label: '省/州', type: 'text', placeholder: '省/州', col: 2 },
      { name: 'zip', label: '邮编', type: 'text', placeholder: '邮编', col: 1 },
      { name: 'country', label: '国家', type: 'text', placeholder: '国家', col: 2 },
      { name: 'phone', label: '电话', type: 'text', placeholder: '电话号码', copyable: true },
      { name: 'email', label: '邮箱', type: 'text', placeholder: '电子邮箱', copyable: true },
      { name: 'website', label: '网站', type: 'text', placeholder: 'https://...' },
      NOTES_FIELD,
    ],
  },
  {
    id: 5,
    code: 'password',
    name: '密码',
    icon: Lock,
    fields: [
      { name: 'password', label: '密码', type: 'password', placeholder: '输入或生成密码', copyable: true },
      NOTES_FIELD,
    ],
  },
  {
    id: 6,
    code: 'software_license',
    name: '软件许可证',
    icon: Award,
    fields: [
      { name: 'softwareName', label: '软件名称', type: 'text', placeholder: '软件名称', col: 1 },
      { name: 'softwareVersion', label: '版本', type: 'text', placeholder: '版本号', col: 2 },
      { name: 'licensee', label: '授权人', type: 'text', placeholder: '被授权人/组织' },
      { name: 'licenseKey', label: '许可证密钥', type: 'password', placeholder: '许可证密钥', copyable: true },
      { name: 'publisher', label: '发行商', type: 'text', placeholder: '发行商', col: 1 },
      { name: 'website', label: '网站', type: 'text', placeholder: 'https://...', col: 2 },
      { name: 'orderNumber', label: '订单号', type: 'text', placeholder: '订单号', col: 1 },
      { name: 'purchaseDate', label: '购买日期', type: 'date', col: 2 },
      NOTES_FIELD,
    ],
  },
  {
    id: 7,
    code: 'bank_account',
    name: '银行账户',
    icon: Landmark,
    fields: [
      { name: 'accountHolder', label: '账户持有人', type: 'text', placeholder: '持有人姓名' },
      { name: 'accountNumber', label: '账号', type: 'password', placeholder: '银行账号', copyable: true },
      { name: 'bankName', label: '银行名称', type: 'text', placeholder: '银行名称', col: 1 },
      { name: 'routingNumber', label: '路由号', type: 'text', placeholder: '路由号码', col: 2 },
      { name: 'iban', label: 'IBAN', type: 'text', placeholder: '国际银行账号', col: 1 },
      { name: 'swift', label: 'SWIFT', type: 'text', placeholder: 'SWIFT 代码', col: 2 },
      NOTES_FIELD,
    ],
  },
  {
    id: 8,
    code: 'wireless_router',
    name: '无线路由器',
    icon: Wifi,
    fields: [
      { name: 'networkName', label: '网络名称', type: 'text', placeholder: 'SSID', col: 1 },
      { name: 'password', label: '密码', type: 'password', placeholder: 'Wi-Fi 密码', copyable: true, col: 2 },
      { name: 'encryptionType', label: '加密类型', type: 'text', placeholder: 'WPA2/WPA3', col: 1 },
      { name: 'baseStationName', label: '基站名称', type: 'text', placeholder: '路由器名称', col: 2 },
      { name: 'ip', label: 'IP 地址', type: 'text', placeholder: '192.168.1.1', col: 1 },
      { name: 'serialNumber', label: '序列号', type: 'text', placeholder: '序列号', col: 2 },
      NOTES_FIELD,
    ],
  },
  {
    id: 9,
    code: 'server',
    name: '服务器',
    icon: Server,
    fields: [
      { name: 'hostname', label: '主机名', type: 'text', placeholder: '服务器主机名或域名' },
      { name: 'ip', label: 'IP 地址', type: 'text', placeholder: '192.168.1.1', col: 1 },
      { name: 'port', label: '端口', type: 'text', placeholder: '22', col: 2 },
      { name: 'username', label: '用户名', type: 'text', placeholder: '登录用户名', copyable: true },
      { name: 'password', label: '密码', type: 'password', placeholder: '登录密码', copyable: true },
      { name: 'adminConsoleUrl', label: '管理控制台', type: 'text', placeholder: 'https://...' },
      NOTES_FIELD,
    ],
  },
  {
    id: 10,
    code: 'database',
    name: '数据库',
    icon: Database,
    fields: [
      { name: 'host', label: '主机', type: 'text', placeholder: '数据库主机', col: 1 },
      { name: 'port', label: '端口', type: 'text', placeholder: '5432', col: 2 },
      { name: 'database', label: '数据库名', type: 'text', placeholder: '数据库名称', col: 1 },
      { name: 'type', label: '类型', type: 'text', placeholder: 'PostgreSQL', col: 2 },
      { name: 'username', label: '用户名', type: 'text', placeholder: '数据库用户名', copyable: true },
      { name: 'password', label: '密码', type: 'password', placeholder: '数据库密码', copyable: true },
      NOTES_FIELD,
    ],
  },
  {
    id: 11,
    code: 'api_credential',
    name: 'API 凭证',
    icon: Code,
    fields: [
      { name: 'apiKey', label: 'API Key', type: 'text', placeholder: 'API 密钥', copyable: true },
      { name: 'apiSecret', label: 'API Secret', type: 'password', placeholder: 'API 密钥', copyable: true },
      { name: 'validFrom', label: '生效日期', type: 'date', col: 1 },
      { name: 'expiration', label: '过期日期', type: 'date', col: 2 },
      NOTES_FIELD,
    ],
  },
  {
    id: 12,
    code: 'crypto_wallet',
    name: '加密钱包',
    icon: Wallet,
    fields: [
      { name: 'walletAddress', label: '钱包地址', type: 'textarea', placeholder: '钱包地址', copyable: true },
      { name: 'privateMnemonic', label: '私钥/助记词', type: 'password', placeholder: '私钥或助记词', copyable: true },
      NOTES_FIELD,
    ],
  },
  {
    id: 13,
    code: 'driver_license',
    name: '驾驶证',
    icon: Car,
    fields: [
      { name: 'licenseNumber', label: '驾驶证号', type: 'text', placeholder: '驾驶证号', copyable: true },
      { name: 'fullName', label: '姓名', type: 'text', placeholder: '全名' },
      { name: 'birthDate', label: '出生日期', type: 'date', col: 1 },
      { name: 'issuingAuthority', label: '发证机关', type: 'text', placeholder: '发证机关', col: 2 },
      { name: 'expiryDate', label: '有效期至', type: 'date' },
      NOTES_FIELD,
    ],
  },
  {
    id: 14,
    code: 'passport',
    name: '护照',
    icon: BookOpen,
    fields: [
      { name: 'passportNumber', label: '护照号', type: 'text', placeholder: '护照号码', copyable: true },
      { name: 'fullName', label: '姓名', type: 'text', placeholder: '全名' },
      { name: 'country', label: '国家', type: 'text', placeholder: '发照国', col: 1 },
      { name: 'issueDate', label: '签发日期', type: 'date', col: 2 },
      { name: 'expiryDate', label: '有效期至', type: 'date' },
      NOTES_FIELD,
    ],
  },
  {
    id: 15,
    code: 'membership',
    name: '会员',
    icon: BadgeCheck,
    fields: [
      { name: 'organization', label: '组织', type: 'text', placeholder: '组织名称' },
      { name: 'membershipNumber', label: '会员号', type: 'text', placeholder: '会员号码', copyable: true },
      { name: 'memberName', label: '会员姓名', type: 'text', placeholder: '会员姓名', col: 1 },
      { name: 'phone', label: '电话', type: 'text', placeholder: '联系电话', col: 2 },
      { name: 'website', label: '网站', type: 'text', placeholder: 'https://...' },
      NOTES_FIELD,
    ],
  },
  {
    id: 16,
    code: 'reward_program',
    name: '奖励计划',
    icon: Gift,
    fields: [
      { name: 'programName', label: '计划名称', type: 'text', placeholder: '奖励计划名称' },
      { name: 'memberName', label: '会员姓名', type: 'text', placeholder: '会员姓名', col: 1 },
      { name: 'membershipNumber', label: '会员号', type: 'text', placeholder: '会员号码', copyable: true, col: 2 },
      { name: 'pointsBalance', label: '积分余额', type: 'text', placeholder: '当前积分' },
      NOTES_FIELD,
    ],
  },
  {
    id: 17,
    code: 'ssh_key',
    name: 'SSH 密钥',
    icon: TerminalSquare,
    fields: [
      { name: 'hostname', label: '主机名', type: 'text', placeholder: 'example.com', col: 1 },
      { name: 'username', label: '用户名', type: 'text', placeholder: 'root', col: 2 },
      { name: 'port', label: '端口', type: 'text', placeholder: '22', col: 1 },
      { name: 'keyType', label: '密钥类型', type: 'text', placeholder: 'Ed25519 / RSA / ECDSA', col: 2 },
      { name: 'publicKey', label: '公钥', type: 'textarea', placeholder: 'ssh-ed25519 AAAA...', copyable: true },
      { name: 'privateKey', label: '私钥', type: 'textarea', placeholder: '-----BEGIN OPENSSH PRIVATE KEY-----', copyable: true, maskable: true },
      { name: 'passphrase', label: '密钥口令', type: 'password', placeholder: '（可选）密钥口令', copyable: true },
      NOTES_FIELD,
    ],
  },
];

/** 按 id 查找类型配置 */
export function getItemTypeConfig(id: number): ItemTypeConfig | undefined {
  return ITEM_TYPE_CONFIGS.find((t) => t.id === id);
}

/** 按 code 查找类型配置 */
export function getItemTypeConfigByCode(code: string): ItemTypeConfig | undefined {
  return ITEM_TYPE_CONFIGS.find((t) => t.code === code);
}

/** 获取所有字段名（去重，用于 zod schema 与 ItemData 类型） */
export const ALL_FIELD_NAMES: string[] = [
  ...new Set(ITEM_TYPE_CONFIGS.flatMap((t) => t.fields.map((f) => f.name))),
];

/** 获取字段图标（用于详情页） */
export function getFieldIcon(fieldName: string): LucideIcon {
  const iconMap: Record<string, LucideIcon> = {
    url: Globe,
    website: Globe,
    adminConsoleUrl: Globe,
    username: User,
    password: KeyRound,
    cardNumber: Hash,
    accountNumber: Hash,
    licenseKey: KeyRound,
    apiKey: Hash,
    apiSecret: KeyRound,
    privateMnemonic: KeyRound,
    phone: Phone,
    email: Mail,
    birthDate: Calendar,
    expiryDate: Calendar,
    issueDate: Calendar,
    purchaseDate: Calendar,
    validFrom: Calendar,
    expiration: Calendar,
    address: MapPin,
    city: MapPin,
    state: MapPin,
    zip: MapPin,
    country: MapPin,
  };
  return iconMap[fieldName] ?? FileText;
}
