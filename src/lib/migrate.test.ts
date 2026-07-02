import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { db } from './db';
import { runMigrations } from './migrate';

/**
 * T1.3 数据库 DDL 迁移脚本 — 集成测试
 *
 * 验收标准（TASK_BREAKDOWN.md T1.3）：
 * - [x] 执行迁移后，6 张表均已创建，字段类型与 DDL 一致
 * - [x] item_types 表预置 3 条记录（login / secure_note / credit_card）
 * - [x] 所有索引已创建（idx_items_user_updated 等）
 * - [x] updated_at 触发器在 UPDATE 操作时自动更新时间
 * - [x] 重复执行迁移不会报错（幂等性）
 *
 * M0-4: 6 张表创建成功，item_types 预置 3 条记录
 * M0-5: 迁移脚本幂等（重复执行不报错）
 */
describe('T1.3 数据库 DDL 迁移脚本', () => {
  beforeAll(async () => {
    await runMigrations();
  });

  afterAll(async () => {
    await db.end();
  });

  describe('M0-4：表创建与预置数据', () => {
    it('应创建 6 张表', async () => {
      const result = await db.query(`
        SELECT table_name
        FROM information_schema.tables
        WHERE table_schema = 'public'
          AND table_type = 'BASE TABLE'
        ORDER BY table_name;
      `);
      const tableNames = result.rows.map((r: { table_name: string }) => r.table_name);
      expect(tableNames).toContain('item_types');
      expect(tableNames).toContain('users');
      expect(tableNames).toContain('vaults');
      expect(tableNames).toContain('items');
      expect(tableNames).toContain('tags');
      expect(tableNames).toContain('item_tags');
    });

    it('item_types 应预置 3 条记录（login / secure_note / credit_card）', async () => {
      const result = await db.query(
        'SELECT code, name, icon, sort_order FROM item_types ORDER BY sort_order',
      );
      expect(result.rows).toHaveLength(3);
      expect(result.rows[0]).toMatchObject({
        code: 'login',
        name: '登录',
        icon: 'key-round',
        sort_order: 1,
      });
      expect(result.rows[1]).toMatchObject({
        code: 'secure_note',
        name: '安全笔记',
        sort_order: 2,
      });
      expect(result.rows[2]).toMatchObject({
        code: 'credit_card',
        name: '信用卡',
        sort_order: 3,
      });
    });

    it('item_types 的 field_schema 应为有效 JSONB', async () => {
      const result = await db.query(
        "SELECT code, field_schema->>'fields' AS fields FROM item_types WHERE code = 'login'",
      );
      const fields = JSON.parse(result.rows[0].fields as string);
      expect(fields).toContain('title');
      expect(fields).toContain('url');
      expect(fields).toContain('username');
      expect(fields).toContain('password');
    });
  });

  describe('索引创建', () => {
    it('应创建关键索引 idx_items_user_updated', async () => {
      const result = await db.query(`
        SELECT indexname FROM pg_indexes
        WHERE schemaname = 'public' AND indexname = 'idx_items_user_updated';
      `);
      expect(result.rows).toHaveLength(1);
    });

    it('应创建关键索引 idx_items_user_favorite', async () => {
      const result = await db.query(`
        SELECT indexname FROM pg_indexes
        WHERE schemaname = 'public' AND indexname = 'idx_items_user_favorite';
      `);
      expect(result.rows).toHaveLength(1);
    });

    it('应创建所有 9 个自定义索引', async () => {
      const result = await db.query(`
        SELECT indexname FROM pg_indexes
        WHERE schemaname = 'public'
          AND indexname LIKE 'idx_%'
        ORDER BY indexname;
      `);
      expect(result.rows.length).toBeGreaterThanOrEqual(9);
    });
  });

  describe('updated_at 触发器', () => {
    it('UPDATE 操作应自动更新 updated_at', async () => {
      // 插入测试用户（满足所有 NOT NULL 约束）
      const insertResult = await db.query(`
        INSERT INTO users (
          email, email_normalized,
          kdf_salt, password_hash,
          encrypted_key, recovery_encrypted_key, recovery_code_hash
        ) VALUES (
          'trigger-test@passbox.dev', 'trigger-test@passbox.dev',
          '\\x00112233445566778899001122334455'::bytea,
          '$2b$10$placeholderhashplaceholderhashplaceholderhashplacehold',
          '{"v":1,"iv":"test","ct":"test"}',
          '{"v":1,"iv":"test","ct":"test"}',
          '$2b$10$placeholderhashplaceholderhashplaceholderhashplacehold'
        )
        RETURNING id, updated_at;
      `);
      const userId = insertResult.rows[0].id;
      const originalUpdatedAt = insertResult.rows[0].updated_at;

      // 等待 100ms 确保 updated_at 会不同
      await new Promise((resolve) => setTimeout(resolve, 100));

      // 更新用户
      await db.query('UPDATE users SET email = $1 WHERE id = $2', [
        'trigger-test-updated@passbox.dev',
        userId,
      ]);

      // 验证 updated_at 已自动更新
      const selectResult = await db.query('SELECT updated_at FROM users WHERE id = $1', [userId]);
      const newUpdatedAt = selectResult.rows[0].updated_at;

      expect(newUpdatedAt).not.toEqual(originalUpdatedAt);
      expect(new Date(newUpdatedAt).getTime()).toBeGreaterThan(
        new Date(originalUpdatedAt).getTime(),
      );

      // 清理
      await db.query('DELETE FROM users WHERE id = $1', [userId]);
    });
  });

  describe('M0-5：幂等性', () => {
    it('重复执行迁移不应报错', async () => {
      await expect(runMigrations()).resolves.not.toThrow();
    });

    it('重复执行后 item_types 仍为 3 条', async () => {
      await runMigrations();
      const result = await db.query('SELECT COUNT(*)::int AS count FROM item_types');
      expect(result.rows[0].count).toBe(3);
    });
  });
});
