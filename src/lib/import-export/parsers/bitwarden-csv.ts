/**
 * Bitwarden CSV 解析器
 *
 * 支持的条目类型：login(1) / secure_note(2) / credit_card(3) / identity(4)
 */
import Papa from 'papaparse';
import type { ImportItem } from '../types';

/** Bitwarden type 字段 -> PassBox item type code */
const TYPE_MAP: Record<string, string> = {
  '1': 'login',
  '2': 'secure_note',
  '3': 'credit_card',
  '4': 'identity',
};

/**
 * 将 Bitwarden 导出的 CSV 内容解析为 ImportItem[]。
 *
 * @param csvContent Bitwarden 导出的 CSV 原文
 * @returns 归一化后的 ImportItem 数组
 */
export function parseBitwardenCsv(csvContent: string): ImportItem[] {
  const result = Papa.parse<Record<string, string>>(csvContent, {
    header: true,
    skipEmptyLines: true,
  });

  const rows = result.data ?? [];

  return rows
    .map((row): ImportItem | null => {
      const typeCode = TYPE_MAP[(row.type ?? '').trim()];
      if (!typeCode) {
        return null;
      }

      const name = (row.name ?? '').trim();
      const notes = (row.notes ?? '').trim();
      const folder = (row.folder ?? '').trim();
      const favorite = (row.favorite ?? '').trim() === '1' || (row.favorite ?? '').trim().toLowerCase() === 'true';

      const fields: Record<string, string> = {};
      let title = name;

      switch (typeCode) {
        case 'login': {
          title = name;
          const url = (row.login_uri ?? '').trim();
          const username = (row.login_username ?? '').trim();
          const password = (row.login_password ?? '').trim();
          const totpSecret = (row.login_totp ?? '').trim();
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
          const cardholder = (row.card_cardholdername ?? '').trim();
          const cardNumber = (row.card_number ?? '').trim();
          const expMonth = (row.card_expmonth ?? '').trim();
          const expYear = (row.card_expyear ?? '').trim();
          const cvv = (row.card_cvv ?? '').trim();
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
          const firstName = (row.identity_firstname ?? '').trim();
          const lastName = (row.identity_lastname ?? '').trim();
          const address = (row.identity_address1 ?? '').trim();
          const phone = (row.identity_phone ?? '').trim();
          const email = (row.identity_email ?? '').trim();
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

      // 空行跳过
      const finalTitle = title || '未命名条目';
      const hasFields = Object.keys(fields).length > 0;
      if (!finalTitle && !hasFields && !folder) {
        return null;
      }

      return {
        title: finalTitle,
        itemType: typeCode,
        fields,
        favorite,
        tags: folder ? [folder] : [],
      };
    })
    .filter(Boolean) as ImportItem[];
}
