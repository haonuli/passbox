/**
 * Bitwarden JSON 解析器
 *
 * 支持的条目类型：login(1) / secure_note(2) / credit_card(3) / identity(4)
 * 仅支持未加密的 Bitwarden JSON 导出文件。
 */
import type { ImportItem } from '../types';

/** Bitwarden type 字段 -> PassBox item type code */
const TYPE_MAP: Record<number, string> = {
  1: 'login',
  2: 'secure_note',
  3: 'credit_card',
  4: 'identity',
};

interface BitwardenUri {
  uri?: string;
}

interface BitwardenLogin {
  username?: string;
  password?: string;
  uris?: BitwardenUri[];
  totp?: string;
}

interface BitwardenCard {
  cardholderName?: string;
  number?: string;
  code?: string;
  expMonth?: string | number;
  expYear?: string | number;
}

interface BitwardenIdentity {
  firstName?: string;
  lastName?: string;
  address1?: string;
  phone?: string;
  email?: string;
}

interface BitwardenField {
  name?: string;
  value?: string;
}

interface BitwardenItem {
  type: number;
  name?: string;
  notes?: string;
  favorite?: boolean;
  folder?: string;
  login?: BitwardenLogin;
  card?: BitwardenCard;
  identity?: BitwardenIdentity;
  fields?: BitwardenField[];
}

interface BitwardenJson {
  encrypted?: boolean;
  items?: BitwardenItem[];
}

/**
 * 将 Bitwarden 导出的 JSON 内容解析为 ImportItem[]。
 *
 * @param jsonContent Bitwarden 导出的 JSON 原文
 * @returns 归一化后的 ImportItem 数组
 * @throws {Error} 如果文件已加密（encrypted=true）
 */
export function parseBitwardenJson(jsonContent: string): ImportItem[] {
  const data = JSON.parse(jsonContent) as BitwardenJson;

  if (data.encrypted === true) {
    throw new Error('不支持加密的 Bitwarden 导出文件，请先解密');
  }

  const items = data.items ?? [];

  return items
    .map((item): ImportItem | null => {
      const itemType = TYPE_MAP[item.type];
      if (!itemType) {
        return null;
      }

      const name = (item.name ?? '').trim();
      const notes = (item.notes ?? '').trim();
      const folder = (item.folder ?? '').trim();
      const favorite = item.favorite === true;

      const fields: Record<string, string> = {};
      let title = name;

      switch (itemType) {
        case 'login': {
          title = name;
          const login = item.login;
          const url = login?.uris?.[0]?.uri?.trim() ?? '';
          const username = (login?.username ?? '').trim();
          const password = (login?.password ?? '').trim();
          const totpSecret = (login?.totp ?? '').trim();
          if (url) fields.url = url;
          if (username) fields.username = username;
          if (password) fields.password = password;
          if (totpSecret) fields.totpSecret = totpSecret;
          if (notes) fields.notes = notes;
          break;
        }
        case 'secure_note': {
          title = name;
          if (notes) fields.noteText = notes;
          break;
        }
        case 'credit_card': {
          title = name;
          const card = item.card;
          const cardholder = (card?.cardholderName ?? '').trim();
          const cardNumber = (card?.number ?? '').trim();
          const expMonth = card?.expMonth !== undefined ? String(card.expMonth).trim() : '';
          const expYear = card?.expYear !== undefined ? String(card.expYear).trim() : '';
          const cvv = (card?.code ?? '').trim();
          if (cardholder) fields.cardholder = cardholder;
          if (cardNumber) fields.cardNumber = cardNumber;
          if (expMonth && expYear) {
            fields.expiry = `${expMonth}/${expYear}`;
          }
          if (cvv) fields.cvv = cvv;
          if (notes) fields.notes = notes;
          break;
        }
        case 'identity': {
          title = name;
          const identity = item.identity;
          const firstName = (identity?.firstName ?? '').trim();
          const lastName = (identity?.lastName ?? '').trim();
          const address = (identity?.address1 ?? '').trim();
          const phone = (identity?.phone ?? '').trim();
          const email = (identity?.email ?? '').trim();
          if (firstName) fields.firstName = firstName;
          if (lastName) fields.lastName = lastName;
          if (address) fields.address = address;
          if (phone) fields.phone = phone;
          if (email) fields.email = email;
          if (notes) fields.notes = notes;
          break;
        }
        default:
          return null;
      }

      // 处理自定义字段
      if (item.fields && item.fields.length > 0) {
        for (const field of item.fields) {
          const fieldName = (field.name ?? '').trim();
          const fieldValue = (field.value ?? '').trim();
          if (fieldName && fieldValue) {
            fields[fieldName] = fieldValue;
          }
        }
      }

      const finalTitle = title || '未命名条目';
      const hasFields = Object.keys(fields).length > 0;
      if (!finalTitle && !hasFields && !folder) {
        return null;
      }

      return {
        title: finalTitle,
        itemType,
        fields,
        favorite,
        tags: folder ? [folder] : [],
      };
    })
    .filter((item): item is ImportItem => item !== null);
}
