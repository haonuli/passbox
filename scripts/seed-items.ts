/**
 * 种子数据脚本：为密码库生成真实的加密条目
 *
 * 流程：
 *   1. 从数据库读取用户 KDF 参数 + encrypted_key
 *   2. 用主密码 + Argon2id 派生 Master Key
 *   3. 用 Master Key 解密 encrypted_key -> Symmetric Key
 *   4. 用 Symmetric Key 加密各类条目标题和 payload
 *   5. 写入 items 表
 *
 * 用法：SEED_PASSWORD="你的主密码" npx tsx scripts/seed-items.ts
 */
import { Pool } from 'pg';
import sodium from 'libsodium-wrappers-sumo';

// ============================================================
// 加密工具（与项目 src/lib/crypto 保持一致）
// ============================================================

const MASTER_WRAP_AAD = 'passbox:symmetric-key:master:v1';

function toBase64(bytes: Uint8Array): string {
  if (bytes.length === 0) return '';
  const CHUNK = 0x8000;
  let binary = '';
  for (let i = 0; i < bytes.length; i += CHUNK) {
    const chunk = bytes.subarray(i, i + CHUNK);
    binary += String.fromCharCode.apply(null, chunk as unknown as number[]);
  }
  return Buffer.from(binary, 'binary').toString('base64');
}

function fromBase64(str: string): Uint8Array {
  return new Uint8Array(Buffer.from(str, 'base64'));
}

function stringToBytes(str: string): Uint8Array {
  return new TextEncoder().encode(str);
}

function getRandomBytes(length: number): Uint8Array {
  const bytes = new Uint8Array(length);
  crypto.getRandomValues(bytes);
  return bytes;
}

interface EncryptedData {
  v: 1;
  iv: string;
  ct: string;
}

async function aesEncrypt(
  key: CryptoKey,
  plaintext: Uint8Array,
  aad: string,
): Promise<EncryptedData> {
  const iv = getRandomBytes(12);
  const params: AesGcmParams = {
    name: 'AES-GCM',
    iv: iv.slice(),
    additionalData: stringToBytes(aad).slice(),
  };
  const ciphertext = await crypto.subtle.encrypt(params, key, plaintext.slice());
  return {
    v: 1,
    iv: toBase64(iv),
    ct: toBase64(new Uint8Array(ciphertext)),
  };
}

async function aesEncryptString(
  key: CryptoKey,
  plaintext: string,
  aad: string,
): Promise<EncryptedData> {
  return aesEncrypt(key, stringToBytes(plaintext), aad);
}

async function aesDecryptToBytes(
  key: CryptoKey,
  data: EncryptedData,
  aad: string,
): Promise<Uint8Array> {
  const iv = fromBase64(data.iv);
  const ct = fromBase64(data.ct);
  const params: AesGcmParams = {
    name: 'AES-GCM',
    iv: iv.slice(),
    additionalData: stringToBytes(aad).slice(),
  };
  const plaintext = await crypto.subtle.decrypt(params, key, ct.slice());
  return new Uint8Array(plaintext);
}

// ============================================================
// 真实种子数据定义
// ============================================================

interface SeedItem {
  itemTypeId: number;
  title: string;
  data: Record<string, string>;
  isFavorite?: boolean;
}

/** 生成随机密码字符串（看起来真实） */
function pwd(len: number): string {
  const chars = 'abcdefghijkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789!@#$%^&*';
  const bytes = getRandomBytes(len);
  let result = '';
  for (let i = 0; i < len; i++) {
    result += chars[bytes[i] % chars.length];
  }
  return result;
}

/** 生成随机数字串 */
function digits(len: number): string {
  const bytes = getRandomBytes(len);
  let result = '';
  for (let i = 0; i < len; i++) {
    result += (bytes[i] % 10).toString();
  }
  return result;
}

/** 格式化信用卡号 */
function cardNum(groups: number, groupLen: number): string {
  const parts: string[] = [];
  for (let i = 0; i < groups; i++) {
    parts.push(digits(groupLen));
  }
  return parts.join(' ');
}

const SEED_ITEMS: SeedItem[] = [
  // ===== Login (type 1) =====
  { itemTypeId: 1, title: 'Google 账号', data: { url: 'https://accounts.google.com', username: 'zhangwei.dev@gmail.com', password: pwd(16), notes: '主力邮箱，开启了两步验证' }, isFavorite: true },
  { itemTypeId: 1, title: 'GitHub', data: { url: 'https://github.com', username: 'zhangwei-dev', password: pwd(20), totpSecret: 'JBSWY3DPEHPK3PXP', notes: '开发者账号，绑定了 SSH Key' }, isFavorite: true },
  { itemTypeId: 1, title: 'Twitter / X', data: { url: 'https://twitter.com', username: 'zhangwei_dev', password: pwd(14), notes: '' } },
  { itemTypeId: 1, title: 'Amazon 中国', data: { url: 'https://www.amazon.cn', username: 'zhangwei.dev@gmail.com', password: pwd(15), notes: 'Prime 会员' } },
  { itemTypeId: 1, title: 'Netflix', data: { url: 'https://www.netflix.com', username: 'zhangwei.dev@gmail.com', password: pwd(14), notes: '家庭高级套餐 4K' }, isFavorite: true },
  { itemTypeId: 1, title: 'Spotify', data: { url: 'https://www.spotify.com', username: 'zhangwei.dev@gmail.com', password: pwd(16), notes: 'Premium 个人版' } },
  { itemTypeId: 1, title: 'Apple ID', data: { url: 'https://appleid.apple.com', username: 'zhangwei.dev@icloud.com', password: pwd(18), notes: '绑定了 iPhone 15 Pro 和 MacBook Pro' }, isFavorite: true },
  { itemTypeId: 1, title: 'Microsoft 365', data: { url: 'https://login.microsoftonline.com', username: 'zhangwei@outlook.com', password: pwd(16), notes: 'Office 家庭版' } },
  { itemTypeId: 1, title: 'Slack', data: { url: 'https://slack.com', username: 'zhangwei@company.com', password: pwd(14), notes: '公司工作空间' } },
  { itemTypeId: 1, title: 'Discord', data: { url: 'https://discord.com', username: 'zhangwei#1234', password: pwd(16), notes: '' } },
  { itemTypeId: 1, title: 'Steam', data: { url: 'https://store.steampowered.com', username: 'zhangwei_gamer', password: pwd(18), notes: '库中有 87 个游戏' } },
  { itemTypeId: 1, title: 'Reddit', data: { url: 'https://www.reddit.com', username: 'zhangwei_dev', password: pwd(14), notes: '' } },
  { itemTypeId: 1, title: 'LinkedIn', data: { url: 'https://www.linkedin.com', username: 'zhangwei.dev@gmail.com', password: pwd(16), notes: '职业社交账号' } },
  { itemTypeId: 1, title: 'Dropbox', data: { url: 'https://www.dropbox.com', username: 'zhangwei.dev@gmail.com', password: pwd(15), notes: '2TB 计划' } },
  { itemTypeId: 1, title: 'Adobe Creative Cloud', data: { url: 'https://account.adobe.com', username: 'zhangwei.dev@gmail.com', password: pwd(16), notes: '摄影计划' } },
  { itemTypeId: 1, title: 'Zoom', data: { url: 'https://zoom.us', username: 'zhangwei@company.com', password: pwd(14), notes: '公司视频会议' } },
  { itemTypeId: 1, title: 'Notion', data: { url: 'https://www.notion.so', username: 'zhangwei.dev@gmail.com', password: pwd(16), notes: '个人 Pro 计划' }, isFavorite: true },
  { itemTypeId: 1, title: 'Figma', data: { url: 'https://www.figma.com', username: 'zhangwei.dev@gmail.com', password: pwd(16), notes: '设计协作工具' } },
  { itemTypeId: 1, title: 'Vercel', data: { url: 'https://vercel.com', username: 'zhangwei.dev@gmail.com', password: pwd(20), notes: '个人项目部署' } },
  { itemTypeId: 1, title: 'Cloudflare', data: { url: 'https://dash.cloudflare.com', username: 'zhangwei.dev@gmail.com', password: pwd(18), notes: 'DNS 和 CDN 管理' } },
  { itemTypeId: 1, title: 'AWS Management Console', data: { url: 'https://console.aws.amazon.com', username: 'zhangwei', password: pwd(20), totpSecret: 'GEZDGNBVGY3TQOJQ', notes: 'IAM root 账号，开启了 MFA' }, isFavorite: true },
  { itemTypeId: 1, title: 'GitLab', data: { url: 'https://gitlab.com', username: 'zhangwei-dev', password: pwd(16), notes: '' } },
  { itemTypeId: 1, title: 'Stack Overflow', data: { url: 'https://stackoverflow.com', username: 'zhangwei-dev', password: pwd(14), notes: '' } },
  { itemTypeId: 1, title: '支付宝', data: { url: 'https://www.alipay.com', username: '13800138000', password: pwd(12), notes: '手机号登录' } },
  { itemTypeId: 1, title: '淘宝', data: { url: 'https://www.taobao.com', username: '13800138000', password: pwd(14), notes: '淘宝会员' } },
  { itemTypeId: 1, title: '京东', data: { url: 'https://www.jd.com', username: '13800138000', password: pwd(14), notes: 'Plus 会员' } },
  { itemTypeId: 1, title: 'Bilibili', data: { url: 'https://www.bilibili.com', username: 'zhangwei_dev', password: pwd(14), notes: '大会员' } },
  { itemTypeId: 1, title: '知乎', data: { url: 'https://www.zhihu.com', username: '13800138000', password: pwd(14), notes: '' } },
  { itemTypeId: 1, title: '掘金', data: { url: 'https://juejin.cn', username: 'zhangwei.dev@gmail.com', password: pwd(14), notes: '技术社区' } },

  // ===== Secure Note (type 2) =====
  { itemTypeId: 2, title: '家庭 WiFi 密码备份', data: { noteText: '主路由 WiFi: ZhangWei_Home_5G\n密码: ZhangWei@2024!\n\n客用 WiFi: ZhangWei_Guest\n密码: Welcome#2024\n\n路由器管理地址: 192.168.1.1\n管理员密码: admin@router2024' } },
  { itemTypeId: 2, title: '紧急联系人', data: { noteText: '妻子: 王芳 138-0000-0001\n父亲: 张建国 139-0000-0002\n母亲: 李秀英 139-0000-0003\n家庭医生: 刘医生 021-6000-0000\n保险公司: 95511\n社区派出所: 021-6000-1100' } },
  { itemTypeId: 2, title: '家庭财产清单', data: { noteText: '客厅:\n- 索尼 65寸 A95L 电视 (SN: 1234567890)\n- LG C3 55寸电视 (SN: 0987654321)\n\n书房:\n- MacBook Pro 16寸 2023 (SN: C02XK1234ABCDE)\n- 戴尔 U2723QE 显示器 (SN: DELL-U2723-56789)\n\n保险单号: PA2024-00123456' } },
  { itemTypeId: 2, title: '医疗信息卡', data: { noteText: '姓名: 张伟\n血型: A型 Rh+\n过敏药物: 青霉素\n慢性病: 无\n医保卡号: 310100200001012345\n就诊医院: 上海第一人民医院' } },
  { itemTypeId: 2, title: '车辆信息', data: { noteText: '车型: 特斯拉 Model Y 2024款\n车牌: 沪A·12345\nVIN: 5YJYGDEE1MF123456\n保险到期: 2025-08-15\n保险公司: 平安车险\n保险单号: PA2024-AUTO-789012' } },

  // ===== Credit Card (type 3) =====
  { itemTypeId: 3, title: '招商银行 Visa 信用卡', data: { cardholder: 'ZHANG WEI', cardNumber: cardNum(4, 4), expiry: '08/27', cvv: digits(3), notes: '额度 80000，账单日每月 5 号' } },
  { itemTypeId: 3, title: '工商银行 Mastercard', data: { cardholder: 'ZHANG WEI', cardNumber: cardNum(4, 4), expiry: '03/26', cvv: digits(3), notes: '额度 50000，绑定了 Apple Pay' } },
  { itemTypeId: 3, title: '中信银行 American Express', data: { cardholder: 'ZHANG WEI', cardNumber: cardNum(4, 4), expiry: '11/28', cvv: digits(4), notes: '白金卡，年费已减免' }, isFavorite: true },

  // ===== Identity (type 4) =====
  { itemTypeId: 4, title: '个人身份信息', data: { firstName: '伟', lastName: '张', gender: '男', birthDate: '1990-06-15', address: '浦东新区世纪大道 100 号 18 楼 1801 室', city: '上海', state: '上海', zip: '200120', country: '中国', phone: '13800138000', email: 'zhangwei.dev@gmail.com', website: 'https://zhangwei.dev', notes: '主要身份信息' }, isFavorite: true },
  { itemTypeId: 4, title: '妻子身份信息', data: { firstName: '芳', lastName: '王', gender: '女', birthDate: '1992-03-22', address: '浦东新区世纪大道 100 号 18 楼 1801 室', city: '上海', state: '上海', zip: '200120', country: '中国', phone: '13800138001', email: 'wangfang@gmail.com', website: '', notes: '妻子信息' } },

  // ===== Password (type 5) =====
  { itemTypeId: 5, title: 'MacBook Pro 登录密码', data: { password: pwd(12), notes: 'MacBook Pro 16寸 2023' } },
  { itemTypeId: 5, title: 'iPhone 15 Pro 解锁密码', data: { password: digits(6), notes: '6 位数字密码' } },
  { itemTypeId: 5, title: 'iPad Air 解锁密码', data: { password: digits(6), notes: '' } },
  { itemTypeId: 5, title: '家庭保险箱密码', data: { password: digits(6), notes: '艾谱保险箱，出厂密码已修改' } },

  // ===== Software License (type 6) =====
  { itemTypeId: 6, title: 'JetBrains All Products Pack', data: { softwareName: 'IntelliJ IDEA Ultimate', softwareVersion: '2024.1', licensee: 'Zhang Wei', licenseKey: 'A' + digits(4) + '-' + digits(4) + '-' + digits(4) + '-' + digits(4), publisher: 'JetBrains', website: 'https://www.jetbrains.com', orderNumber: 'JB-2024-' + digits(6), purchaseDate: '2024-01-15', notes: '个人订阅，年付' } },
  { itemTypeId: 6, title: 'Sublime Text 4', data: { softwareName: 'Sublime Text', softwareVersion: '4.0', licensee: 'Zhang Wei', licenseKey: digits(8) + '-' + digits(8) + '-' + digits(8) + '-' + digits(8), publisher: 'Sublime HQ', website: 'https://www.sublimetext.com', orderNumber: 'ST-' + digits(8), purchaseDate: '2023-09-20', notes: '永久许可证' } },
  { itemTypeId: 6, title: '1Password 家庭版', data: { softwareName: '1Password', softwareVersion: '8.0', licensee: 'Zhang Wei', licenseKey: 'OP-' + digits(5) + '-' + digits(5) + '-' + digits(5), publisher: 'AgileBits', website: 'https://1password.com', orderNumber: '1P-2024-' + digits(6), purchaseDate: '2024-03-01', notes: '家庭计划 5 人' } },
  { itemTypeId: 6, title: 'Microsoft Office 2024', data: { softwareName: 'Office 2024 Home & Business', softwareVersion: '2024', licensee: 'Zhang Wei', licenseKey: 'XXXXX-XXXXX-XXXXX-XXXXX-XXXXX', publisher: 'Microsoft', website: 'https://www.microsoft.com', orderNumber: 'MS-' + digits(10), purchaseDate: '2024-06-10', notes: '一次性买断' } },

  // ===== Bank Account (type 7) =====
  { itemTypeId: 7, title: '招商银行储蓄卡', data: { accountHolder: '张伟', accountNumber: '6225 ' + digits(3) + ' ' + digits(4) + ' ' + digits(4), bankName: '招商银行', routingNumber: '', iban: '', swift: 'CMBCCNBS', notes: '工资卡，绑定手机银行' }, isFavorite: true },
  { itemTypeId: 7, title: '工商银行工资卡', data: { accountHolder: '张伟', accountNumber: '6222 ' + digits(3) + ' ' + digits(4) + ' ' + digits(4), bankName: '中国工商银行', routingNumber: '', iban: '', swift: 'ICBKCNBJ', notes: '公司工资发放账户' } },

  // ===== Wireless Router (type 8) =====
  { itemTypeId: 8, title: '家庭主路由器', data: { networkName: 'ZhangWei_Home_5G', password: pwd(16), encryptionType: 'WPA3', baseStationName: 'TP-Link AX73', ip: '192.168.1.1', serialNumber: 'TP-AX73-' + digits(8), notes: 'TP-Link AX5400, 2024年1月购买' } },
  { itemTypeId: 8, title: '客厅 Mesh 节点', data: { networkName: 'ZhangWei_Home_5G', password: pwd(16), encryptionType: 'WPA3', baseStationName: 'TP-Link RE500X', ip: '192.168.1.2', serialNumber: 'TP-RE500-' + digits(8), notes: 'Mesh 扩展节点' } },
  { itemTypeId: 8, title: '公司路由器', data: { networkName: 'Company_Office_5G', password: pwd(16), encryptionType: 'WPA2', baseStationName: 'Huawei AX3 Pro', ip: '10.0.0.1', serialNumber: 'HW-AX3-' + digits(8), notes: '公司办公室 WiFi' } },

  // ===== Server (type 9) =====
  { itemTypeId: 9, title: '生产环境 Web 服务器', data: { hostname: 'web-prod-01.zhangwei.dev', ip: '43.135.71.100', port: '22', username: 'ubuntu', password: pwd(20), adminConsoleUrl: 'https://console.cloud.tencent.com', notes: '腾讯云轻量服务器 2C4G' }, isFavorite: true },
  { itemTypeId: 9, title: '数据库服务器', data: { hostname: 'db-prod-01.zhangwei.dev', ip: '10.0.1.50', port: '22', username: 'admin', password: pwd(18), adminConsoleUrl: 'https://console.cloud.tencent.com', notes: '内网数据库服务器' } },
  { itemTypeId: 9, title: 'CI/CD 构建服务器', data: { hostname: 'ci-runner-01', ip: '10.0.2.30', port: '22', username: 'gitlab-runner', password: pwd(18), adminConsoleUrl: 'https://gitlab.com', notes: 'GitLab Runner' } },
  { itemTypeId: 9, title: 'Redis 缓存服务器', data: { hostname: 'redis-prod-01', ip: '10.0.1.60', port: '22', username: 'redis', password: pwd(16), adminConsoleUrl: '', notes: 'Redis 7.2 集群' } },

  // ===== Database (type 10) =====
  { itemTypeId: 10, title: '生产 PostgreSQL', data: { host: 'db-prod-01.zhangwei.dev', port: '5432', database: 'passbox_prod', type: 'PostgreSQL 16', username: 'pg_admin', password: pwd(20), notes: '主数据库，每日自动备份' } },
  { itemTypeId: 10, title: '测试 MySQL', data: { host: 'db-test-01.zhangwei.dev', port: '3306', database: 'app_test', type: 'MySQL 8.0', username: 'root', password: pwd(16), notes: '测试环境数据库' } },
  { itemTypeId: 10, title: 'Redis 缓存', data: { host: 'redis-prod-01', port: '6379', database: '0', type: 'Redis 7.2', username: 'default', password: pwd(24), notes: '需要密码认证' } },

  // ===== API Credential (type 11) =====
  { itemTypeId: 11, title: 'OpenAI API Key', data: { apiKey: 'sk-proj-' + digits(8) + digits(8) + digits(8), apiSecret: pwd(32), validFrom: '2024-01-01', expiration: '2025-12-31', notes: 'GPT-4 API，月消费上限 $100' }, isFavorite: true },
  { itemTypeId: 11, title: 'AWS IAM Access Key', data: { apiKey: 'AKIA' + digits(16).toUpperCase().substring(0, 16), apiSecret: pwd(40), validFrom: '2024-03-15', expiration: '', notes: 'IAM 用户 deploy 的访问密钥' } },
  { itemTypeId: 11, title: 'Stripe API Key', data: { apiKey: 'sk_live_' + digits(24), apiSecret: pwd(32), validFrom: '2024-02-10', expiration: '', notes: '生产环境支付 API' } },
  { itemTypeId: 11, title: 'GitHub Personal Access Token', data: { apiKey: 'ghp_' + digits(36), apiSecret: '', validFrom: '2024-05-01', expiration: '2025-05-01', notes: 'repo + workflow 权限' } },
  { itemTypeId: 11, title: 'Cloudflare API Token', data: { apiKey: digits(40), apiSecret: '', validFrom: '2024-01-20', expiration: '', notes: 'Zone DNS 编辑权限' } },

  // ===== Crypto Wallet (type 12) =====
  { itemTypeId: 12, title: 'Ethereum 钱包', data: { walletAddress: '0x' + digits(40), privateMnemonic: 'abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about', notes: 'MetaMask 主钱包，请勿泄露助记词' }, isFavorite: true },
  { itemTypeId: 12, title: 'Bitcoin 钱包', data: { walletAddress: 'bc1q' + digits(38), privateMnemonic: 'orbit attempt draft toss wait casual repeat width river energy ride frame', notes: '硬件钱包 Ledger 配套地址' } },

  // ===== Driver License (type 13) =====
  { itemTypeId: 13, title: '中国驾驶证', data: { licenseNumber: '310100199006150012', fullName: '张伟', birthDate: '1990-06-15', issuingAuthority: '上海市公安局交通警察总队', expiryDate: '2030-06-15', notes: 'C1 驾照，初次领证 2012-06-15' } },

  // ===== Passport (type 14) =====
  { itemTypeId: 14, title: '中华人民共和国护照', data: { passportNumber: 'E' + digits(8), fullName: 'ZHANG WEI', country: '中国', issueDate: '2023-01-10', expiryDate: '2033-01-09', notes: '因私普通护照，10 年有效期' }, isFavorite: true },

  // ===== Membership (type 15) =====
  { itemTypeId: 15, title: 'Costco 会员卡', data: { organization: 'Costco 开市客', membershipNumber: 'CST-' + digits(10), memberName: '张伟', phone: '13800138000', website: 'https://www.costco.com', notes: '金星会员，年费 299 元' } },
  { itemTypeId: 15, title: '健身房会员', data: { organization: '威尔仕健身', membershipNumber: 'WLS-' + digits(8), memberName: '张伟', phone: '13800138000', website: 'https://www.willsfitness.com', notes: '上海浦东正大广场店，年卡' } },
  { itemTypeId: 15, title: 'AAA 中国会员', data: { organization: '中国汽车流通协会', membershipNumber: 'CAA-' + digits(9), memberName: '张伟', phone: '13800138000', website: 'https://www.caa.cn', notes: '道路救援服务' } },

  // ===== Reward Program (type 16) =====
  { itemTypeId: 16, title: '国航凤凰知音', data: { programName: '凤凰知音', memberName: 'ZHANG WEI', membershipNumber: 'CA' + digits(9), pointsBalance: '86500', notes: '白金卡会员' }, isFavorite: true },
  { itemTypeId: 16, title: '万豪旅享家', data: { programName: 'Marriott Bonvoy', memberName: 'ZHANG WEI', membershipNumber: digits(9), pointsBalance: '124300', notes: '白金精英会员' } },
  { itemTypeId: 16, title: '星巴克星享卡', data: { programName: 'Starbucks Rewards', memberName: '张伟', membershipNumber: 'SB-' + digits(10), pointsBalance: '2340', notes: '玉星级' } },
  { itemTypeId: 16, title: '京东 Plus 会员', data: { programName: 'JD Plus', memberName: '张伟', membershipNumber: digits(11), pointsBalance: '5680', notes: '京东京豆积分' } },
];

// ============================================================
// 主流程
// ============================================================

async function main() {
  const password = process.env.SEED_PASSWORD;
  if (!password) {
    console.error('请设置 SEED_PASSWORD 环境变量为主密码');
    process.exit(1);
  }

  await sodium.ready;

  const db = new Pool({
    connectionString: process.env.DATABASE_URL,
  });

  // 1. 读取用户信息
  const userResult = await db.query(
    `SELECT id, email, email_normalized, encode(kdf_salt, 'base64') as salt_b64,
            kdf_memory_kib, kdf_iterations, kdf_parallelism, encrypted_key
     FROM users LIMIT 1`,
  );
  if (userResult.rows.length === 0) {
    console.error('数据库中没有用户');
    await db.end();
    process.exit(1);
  }

  const user = userResult.rows[0];
  console.log(`用户: ${user.email} (ID: ${user.id})`);

  // 2. Argon2id 派生 Master Key
  const salt = fromBase64(user.salt_b64);
  const memLimitBytes = user.kdf_memory_kib * 1024;
  const opsLimit = user.kdf_iterations;

  console.log('正在派生 Master Key (Argon2id)...');
  const masterKey = sodium.crypto_pwhash(
    32,
    password,
    salt,
    opsLimit,
    memLimitBytes,
    sodium.crypto_pwhash_ALG_ARGON2ID13,
  );

  // 3. 解密 encrypted_key -> Symmetric Key raw bytes
  const encryptedKey = JSON.parse(user.encrypted_key) as EncryptedData;
  const masterAesKey = await crypto.subtle.importKey(
    'raw',
    masterKey,
    { name: 'AES-GCM' },
    false,
    ['encrypt', 'decrypt'],
  );

  console.log('正在解密 Symmetric Key...');
  const symKeyRaw = await aesDecryptToBytes(masterAesKey, encryptedKey, MASTER_WRAP_AAD);

  // 4. 导入 Symmetric Key 为 AES-GCM CryptoKey
  const symmetricKey = await crypto.subtle.importKey(
    'raw',
    symKeyRaw,
    { name: 'AES-GCM' },
    true,
    ['encrypt', 'decrypt'],
  );

  // 5. 获取保险库 ID
  const vaultResult = await db.query('SELECT id FROM vaults WHERE user_id = $1 ORDER BY display_order LIMIT 1', [user.id]);
  if (vaultResult.rows.length === 0) {
    console.error('未找到保险库');
    await db.end();
    process.exit(1);
  }
  const vaultId = vaultResult.rows[0].id;
  console.log(`保险库 ID: ${vaultId}`);

  // 6. 清除现有条目（如果有）
  await db.query('DELETE FROM items WHERE user_id = $1', [user.id]);
  console.log('已清除旧条目');

  // 7. 加密并插入每个条目
  let inserted = 0;
  for (const item of SEED_ITEMS) {
    const itemId = crypto.randomUUID();

    // 加密标题
    const titleEncrypted = await aesEncryptString(
      symmetricKey,
      item.title,
      `item:${itemId}:title`,
    );

    // 加密数据 payload
    const dataEncrypted = await aesEncryptString(
      symmetricKey,
      JSON.stringify(item.data),
      `item:${itemId}:data`,
    );

    await db.query(
      `INSERT INTO items (id, user_id, vault_id, item_type_id, title_encrypted, data_encrypted, is_favorite)
       VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      [
        itemId,
        user.id,
        vaultId,
        item.itemTypeId,
        JSON.stringify(titleEncrypted),
        JSON.stringify(dataEncrypted),
        item.isFavorite ?? false,
      ],
    );

    inserted++;
    console.log(`  [${inserted}/${SEED_ITEMS.length}] 已插入: ${item.title}`);
  }

  console.log(`\n完成！共插入 ${inserted} 个条目`);
  await db.end();
}

main().catch((e) => {
  console.error('错误:', e);
  process.exit(1);
});
