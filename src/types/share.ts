/**
 * 安全共享链接类型定义
 *
 * @see docs/SHARE_LINK_DESIGN.md
 */

/** 创建共享链接请求 */
export interface CreateShareRequest {
  /** base64(iv).base64(ciphertext) 格式的加密标题 */
  encryptedTitle: string;
  /** base64(iv).base64(ciphertext) 格式的加密数据 */
  encryptedData: string;
  /** 条目类型代码（明文，用于渲染图标） */
  itemTypeCode: string;
  /** 过期时间（小时）：1 | 24 | 168 | 720 */
  expiresInHours: number;
  /** 最大查看次数（null = 不限） */
  maxViews?: number | null;
}

/** 创建共享链接响应 */
export interface CreateShareResponse {
  id: string;
}

/** 获取共享数据响应 */
export interface GetShareResponse {
  encryptedTitle: string;
  encryptedData: string;
  itemTypeCode: string;
  expiresAt: string;
}

/** 共享链接列表项 */
export interface ShareListItem {
  id: string;
  itemTypeCode: string;
  createdAt: string;
  expiresAt: string;
  maxViews: number | null;
  viewCount: number;
  expired: boolean;
}

/** 共享链接的过期时间选项 */
export const EXPIRY_OPTIONS = [
  { label: '1 小时', hours: 1 },
  { label: '1 天', hours: 24 },
  { label: '7 天', hours: 168 },
  { label: '30 天', hours: 720 },
] as const;

/** 共享链接的查看次数选项 */
export const VIEW_LIMIT_OPTIONS = [
  { label: '不限', value: null },
  { label: '1 次', value: 1 },
  { label: '5 次', value: 5 },
  { label: '10 次', value: 10 },
] as const;

/** 数据库行类型 */
export interface SharedItemRow {
  id: string;
  user_id: string;
  item_title_encrypted: string;
  item_data_encrypted: string;
  item_type_code: string;
  expires_at: string;
  max_views: number | null;
  view_count: number;
  created_at: string;
}
