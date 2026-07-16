/**
 * 1Password 1PUX 解析器
 *
 * 1PUX 文件是 ZIP 格式，内部包含 data.json。
 * 遍历 accounts -> vaults -> items 三层嵌套提取条目。
 */
import JSZip from 'jszip';
import type { ImportItem } from '../types';

/** 1PUX 字段定义 */
interface OnepuxField {
  label: string;
  value: string;
}

/** 1PUX 区段定义 */
interface OnepuxSection {
  fields?: OnepuxField[];
}

/** 1PUX 条目定义 */
interface OnepuxItem {
  title?: string;
  category?: string;
  fields?: OnepuxField[];
  sections?: OnepuxSection[];
}

/** 1PUX 保管库定义 */
interface OnepuxVault {
  items?: OnepuxItem[];
}

/** 1PUX 账户定义 */
interface OnepuxAccount {
  vaults?: OnepuxVault[];
}

/** 1PUX 数据根结构 */
interface OnepuxData {
  accounts?: OnepuxAccount[];
}

/** category 映射：1PUX category code -> PassBox item type code */
const CATEGORY_MAP: Record<string, string> = {
  '001': 'login',
  '002': 'credit_card',
  '003': 'secure_note',
  '004': 'identity',
};

/** field label（小写）-> PassBox 字段名 */
const FIELD_LABEL_MAP: Record<string, string> = {
  username: 'username',
  password: 'password',
  url: 'url',
  website: 'url',
  website_url: 'url',
  notes: 'notes',
  note: 'notes',
  totp: 'totpSecret',
  'one-time password': 'totpSecret',
  totp_secret: 'totpSecret',
};

/**
 * 将 1PUX field label 映射为 PassBox 字段名。
 *
 * @param label 1PUX 字段标签
 * @returns 对应的 PassBox 字段名，未匹配返回 undefined
 */
function mapFieldLabel(label: string): string | undefined {
  const normalized = label.toLowerCase().trim();
  return FIELD_LABEL_MAP[normalized];
}

/**
 * 将单个 1PUX item 转换为 ImportItem。
 *
 * @param item 1PUX 条目对象
 * @returns 归一化后的 ImportItem，条目完全无内容时返回 null
 */
function parseItem(item: OnepuxItem): ImportItem | null {
  const title = (item.title ?? '').trim();
  const category = (item.category ?? '').trim();
  const itemType = CATEGORY_MAP[category] ?? 'login';

  const fields: Record<string, string> = {};

  // 遍历 item.fields
  const itemFields = item.fields ?? [];
  for (const field of itemFields) {
    const targetField = mapFieldLabel(field.label);
    if (targetField && field.value) {
      fields[targetField] = field.value;
    }
  }

  // 遍历 item.sections[].fields（不覆盖 item.fields 中已有的值）
  const sections = item.sections ?? [];
  for (const section of sections) {
    const sectionFields = section.fields ?? [];
    for (const field of sectionFields) {
      const targetField = mapFieldLabel(field.label);
      if (targetField && field.value && !fields[targetField]) {
        fields[targetField] = field.value;
      }
    }
  }

  const finalTitle = title || '未命名条目';
  const hasFields = Object.keys(fields).length > 0;

  // 完全无内容的条目跳过
  if (!title && !hasFields) {
    return null;
  }

  return {
    title: finalTitle,
    itemType,
    fields,
    favorite: false,
    tags: [],
  };
}

/**
 * 将 1Password 1PUX 文件解析为 ImportItem[]。
 *
 * @param fileBuffer 1PUX 文件的 ArrayBuffer
 * @returns 归一化后的 ImportItem 数组
 */
export async function parseOnepassword1pux(fileBuffer: ArrayBuffer): Promise<ImportItem[]> {
  const zip = await JSZip.loadAsync(fileBuffer);
  const dataFile = zip.file('data.json');
  if (!dataFile) {
    throw new Error('1PUX 文件中未找到 data.json');
  }

  const jsonContent = await dataFile.async('text');
  const data: OnepuxData = JSON.parse(jsonContent);

  const items: ImportItem[] = [];

  const accounts = data.accounts ?? [];
  for (const account of accounts) {
    const vaults = account.vaults ?? [];
    for (const vault of vaults) {
      const vaultItems = vault.items ?? [];
      for (const item of vaultItems) {
        const importItem = parseItem(item);
        if (importItem) {
          items.push(importItem);
        }
      }
    }
  }

  return items;
}
