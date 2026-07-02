import { describe, it, expect, afterAll } from 'vitest';
import { db } from './db';

/**
 * T1.2 数据库连接池单例 — 集成测试
 *
 * 验收标准（TASK_BREAKDOWN.md T1.2）：
 * - [x] 连接池 max: 10，使用 DATABASE_URL 环境变量
 * - [x] 开发环境通过 globalThis.__db 防重复实例化
 * - [x] db.query() 可正常执行 SELECT 1 并返回结果
 *
 * M0-3 验收项：数据库连接池 max:10，SELECT 1 返回正常
 */
describe('T1.2 数据库连接池单例', () => {
  afterAll(async () => {
    await db.end();
  });

  describe('连接池配置', () => {
    it('应配置 max: 10 连接数', () => {
      expect(db.options.max).toBe(10);
    });

    it('应使用 DATABASE_URL 环境变量作为连接串', () => {
      expect(process.env.DATABASE_URL).toBeDefined();
      expect(process.env.DATABASE_URL).toContain('passbox_test');
    });
  });

  describe('连接与查询', () => {
    it('SELECT 1 应返回 { "?column?": 1 }', async () => {
      const result = await db.query('SELECT 1');
      expect(result.rows[0]).toEqual({ '?column?': 1 });
    });

    it('参数化查询应正常工作', async () => {
      const result = await db.query('SELECT $1::int AS num, $2::text AS label', [42, 'hello']);
      expect(result.rows[0]).toEqual({ num: 42, label: 'hello' });
    });

    it('当前数据库名应为 passbox_test', async () => {
      const result = await db.query('SELECT current_database() AS db_name');
      expect(result.rows[0].db_name).toBe('passbox_test');
    });
  });

  describe('单例模式', () => {
    it('globalThis.__db 应在非生产环境下被设置', () => {
      expect(globalThis.__db).toBeDefined();
    });

    it('globalThis.__db 应与导出的 db 为同一实例', () => {
      expect(globalThis.__db).toBe(db);
    });
  });
});
