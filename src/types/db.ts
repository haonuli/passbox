/**
 * 数据库行类型定义 (T1.4)
 *
 * 对应 TECHNICAL_DESIGN.md 第 4.3 节 DDL 的 6 张表。
 * 命名规范（Project Rules）：复数蛇形表名 → PascalCase + Row 后缀。
 *
 * 注意：
 * - BYTEA → Buffer（服务端 pg 返回 Node.js Buffer）
 * - TIMESTAMPTZ → string（ISO 8601 时间戳字符串）
 * - JSONB → Record<string, unknown>（使用前需类型收窄）
 * - UUID → string
 */

/**
 * 用户表行类型
 * 对应 DDL: users 表
 */
export interface UserRow {
  id: string;
  email: string;
  email_normalized: string;
  kdf_type: string;
  kdf_salt: Buffer;
  kdf_memory_kib: number;
  kdf_iterations: number;
  kdf_parallelism: number;
  password_hash: string;
  encrypted_key: string;
  recovery_encrypted_key: string;
  recovery_code_hash: string;
  two_factor_enabled: boolean;
  two_factor_secret: string | null;
  two_factor_backup_codes: string[] | null;
  failed_login_attempts: number;
  locked_until: string | null;
  last_login_at: string | null;
  created_at: string;
  updated_at: string;
}

/**
 * 保险库表行类型
 * 对应 DDL: vaults 表
 */
export interface VaultRow {
  id: string;
  user_id: string;
  name_encrypted: string;
  display_order: number;
  created_at: string;
  updated_at: string;
}

/**
 * 密码条目表行类型
 * 对应 DDL: items 表
 */
export interface ItemRow {
  id: string;
  user_id: string;
  vault_id: string;
  item_type_id: number;
  title_encrypted: string;
  data_encrypted: string;
  is_favorite: boolean;
  created_at: string;
  updated_at: string;
  /** 软删除时间戳（NULL=未删除，非 NULL=已移入回收站） */
  deleted_at: string | null;
}

/**
 * 条目类型表行类型（系统预置）
 * 对应 DDL: item_types 表
 */
export interface ItemTypesRow {
  id: number;
  code: string;
  name: string;
  icon: string | null;
  field_schema: Record<string, unknown>;
  sort_order: number;
  created_at: string;
}

/**
 * 标签表行类型
 * 对应 DDL: tags 表
 */
export interface TagRow {
  id: string;
  user_id: string;
  name: string;
  created_at: string;
}

/**
 * 条目-标签关联表行类型（联合主键）
 * 对应 DDL: item_tags 表
 */
export interface ItemTagsRow {
  item_id: string;
  tag_id: string;
}
