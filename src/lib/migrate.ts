import { db } from './db';
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';

/**
 * 数据库迁移脚本 (T1.3)
 *
 * 创建 6 张表（item_types, users, vaults, items, tags, item_tags）、
 * 索引、updated_at 触发器、预置条目类型数据。
 *
 * 幂等性：所有 CREATE 使用 IF NOT EXISTS，INSERT 使用 ON CONFLICT DO NOTHING，
 * 重复执行不会报错（满足 M0-5 验收项）。
 *
 * 用法：
 * - 脚本执行：npm run migrate (tsx src/lib/migrate.ts)
 * - 模块导入：import { runMigrations } from '@/lib/migrate'
 */

// ============================================================
// DDL：扩展 + 建表 + 索引 + 触发器 + 预置数据
// ============================================================

const DDL_SCRIPTS: string[] = [
  // 启用 UUID 生成扩展
  `CREATE EXTENSION IF NOT EXISTS "pgcrypto";`,

  // 1. item_types（条目类型，系统预置）
  `CREATE TABLE IF NOT EXISTS item_types (
    id          SERIAL PRIMARY KEY,
    code        VARCHAR(32)  NOT NULL UNIQUE,
    name        VARCHAR(64)  NOT NULL,
    icon        VARCHAR(64),
    field_schema JSONB       NOT NULL DEFAULT '{}',
    sort_order  INTEGER      NOT NULL DEFAULT 0,
    created_at  TIMESTAMPTZ  NOT NULL DEFAULT NOW()
  );`,

  // 2. users（用户）
  `CREATE TABLE IF NOT EXISTS users (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email           VARCHAR(255) NOT NULL,
    email_normalized VARCHAR(255) NOT NULL,
    kdf_type        VARCHAR(16)  NOT NULL DEFAULT 'argon2id',
    kdf_salt        BYTEA        NOT NULL,
    kdf_memory_kib  INTEGER      NOT NULL DEFAULT 65536,
    kdf_iterations  INTEGER      NOT NULL DEFAULT 3,
    kdf_parallelism INTEGER      NOT NULL DEFAULT 4,
    password_hash   VARCHAR(255) NOT NULL,
    encrypted_key   TEXT         NOT NULL,
    recovery_encrypted_key TEXT NOT NULL,
    recovery_code_hash VARCHAR(255) NOT NULL,
    two_factor_enabled      BOOLEAN      NOT NULL DEFAULT FALSE,
    two_factor_secret       VARCHAR(64),
    two_factor_backup_codes TEXT[],
    failed_login_attempts INTEGER      NOT NULL DEFAULT 0,
    locked_until          TIMESTAMPTZ,
    last_login_at         TIMESTAMPTZ,
    token_version         INTEGER      NOT NULL DEFAULT 0,
    created_at      TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    CONSTRAINT users_email_normalized_uk UNIQUE (email_normalized)
  );`,

  // M-9：为已存在的 users 表补充 token_version 列（幂等，CREATE TABLE IF NOT EXISTS 不会添加新列）
  `ALTER TABLE users ADD COLUMN IF NOT EXISTS token_version INTEGER NOT NULL DEFAULT 0;`,

  // 3. vaults（保险库，用户私有）
  `CREATE TABLE IF NOT EXISTS vaults (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id         UUID         NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    name_encrypted  TEXT         NOT NULL,
    display_order   INTEGER      NOT NULL DEFAULT 0,
    created_at      TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ  NOT NULL DEFAULT NOW()
  );`,

  // 4. items（密码条目）
  `CREATE TABLE IF NOT EXISTS items (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id         UUID         NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    vault_id        UUID         NOT NULL REFERENCES vaults(id) ON DELETE CASCADE,
    item_type_id    INTEGER      NOT NULL REFERENCES item_types(id),
    title_encrypted TEXT         NOT NULL,
    data_encrypted  TEXT         NOT NULL,
    is_favorite     BOOLEAN      NOT NULL DEFAULT FALSE,
    created_at      TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ  NOT NULL DEFAULT NOW()
  );`,

  // 5. tags（标签）
  `CREATE TABLE IF NOT EXISTS tags (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id         UUID         NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    name            VARCHAR(64)  NOT NULL,
    created_at      TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    CONSTRAINT tags_user_name_uk UNIQUE (user_id, name)
  );`,

  // 6. item_tags（条目-标签关联）
  `CREATE TABLE IF NOT EXISTS item_tags (
    item_id         UUID         NOT NULL REFERENCES items(id) ON DELETE CASCADE,
    tag_id          UUID         NOT NULL REFERENCES tags(id) ON DELETE CASCADE,
    PRIMARY KEY (item_id, tag_id)
  );`,

  // 索引
  `CREATE INDEX IF NOT EXISTS idx_vaults_user_id ON vaults (user_id);`,
  `CREATE INDEX IF NOT EXISTS idx_items_user_id ON items (user_id);`,
  `CREATE INDEX IF NOT EXISTS idx_items_vault_id ON items (vault_id);`,
  `CREATE INDEX IF NOT EXISTS idx_items_user_updated ON items (user_id, updated_at DESC);`,
  `CREATE INDEX IF NOT EXISTS idx_items_user_favorite ON items (user_id, is_favorite, updated_at DESC);`,
  `CREATE INDEX IF NOT EXISTS idx_items_item_type ON items (item_type_id);`,
  `CREATE INDEX IF NOT EXISTS idx_tags_user_id ON tags (user_id);`,
  `CREATE INDEX IF NOT EXISTS idx_item_tags_tag_id ON item_tags (tag_id);`,
  `CREATE INDEX IF NOT EXISTS idx_item_tags_item_id ON item_tags (item_id);`,

  // 触发器：自动更新 updated_at
  `CREATE OR REPLACE FUNCTION update_updated_at()
   RETURNS TRIGGER AS $$
   BEGIN
     NEW.updated_at = NOW();
     RETURN NEW;
   END;
   $$ LANGUAGE plpgsql;`,

  `DROP TRIGGER IF EXISTS trg_users_updated ON users;
   CREATE TRIGGER trg_users_updated BEFORE UPDATE ON users
   FOR EACH ROW EXECUTE FUNCTION update_updated_at();`,

  `DROP TRIGGER IF EXISTS trg_vaults_updated ON vaults;
   CREATE TRIGGER trg_vaults_updated BEFORE UPDATE ON vaults
   FOR EACH ROW EXECUTE FUNCTION update_updated_at();`,

  `DROP TRIGGER IF EXISTS trg_items_updated ON items;
   CREATE TRIGGER trg_items_updated BEFORE UPDATE ON items
   FOR EACH ROW EXECUTE FUNCTION update_updated_at();`,
];

// 预置数据：条目类型（ON CONFLICT 保证幂等）
const SEED_ITEM_TYPES_SQL = `
  INSERT INTO item_types (code, name, icon, field_schema, sort_order) VALUES
    ('login', '登录', 'key-round',
     '{"fields":["title","url","username","password","totp_secret","notes"]}'::jsonb, 1),
    ('secure_note', '安全笔记', 'note',
     '{"fields":["title","note_text"]}'::jsonb, 2),
    ('credit_card', '信用卡', 'credit-card',
     '{"fields":["title","cardholder","card_number","expiry","cvv","notes"]}'::jsonb, 3)
  ON CONFLICT (code) DO NOTHING;
`;

/**
 * 执行全部数据库迁移
 *
 * 使用 Promise 缓存确保并发调用时只执行一次（修复集成测试并发迁移冲突）。
 * @returns 创建/跳过的语句数量
 */
let migrationPromise: Promise<{ scriptsExecuted: number }> | null = null;

export async function runMigrations(): Promise<{ scriptsExecuted: number }> {
  if (migrationPromise) {
    return migrationPromise;
  }

  migrationPromise = (async () => {
    let scriptsExecuted = 0;

    for (const sql of DDL_SCRIPTS) {
      await db.query(sql);
      scriptsExecuted++;
    }

    await db.query(SEED_ITEM_TYPES_SQL);
    scriptsExecuted++;

    return { scriptsExecuted };
  })();

  return migrationPromise;
}

// 脚本直接执行时（npm run migrate）
const __filename = fileURLToPath(import.meta.url);
const isMainModule = process.argv[1] && resolve(process.argv[1]) === __filename;

if (isMainModule) {
  runMigrations()
    .then(({ scriptsExecuted }) => {
      console.log(`✅ 迁移完成：执行了 ${scriptsExecuted} 条 SQL 语句`);
      process.exit(0);
    })
    .catch((err) => {
      console.error('❌ 迁移失败：', err);
      process.exit(1);
    });
}
