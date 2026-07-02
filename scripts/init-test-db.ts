/**
 * 测试数据库初始化脚本
 *
 * 用法：npm run test:db:setup
 *
 * 功能：
 * 1. 删除测试库（passbox_test）中的所有表（CASCADE）
 * 2. 重新执行迁移（建表 + 索引 + 触发器 + 预置数据）
 *
 * 环境变量通过 --env-file=.env.test 加载（见 package.json）
 */
import { db } from '../src/lib/db';
import { runMigrations } from '../src/lib/migrate';

async function initTestDb(): Promise<void> {
  console.log('🗑️  清理测试数据库（DROP TABLE CASCADE）...');

  // 按依赖逆序删除（先删关联表，再删主表）
  await db.query(`
    DROP TABLE IF EXISTS item_tags CASCADE;
    DROP TABLE IF EXISTS tags CASCADE;
    DROP TABLE IF EXISTS items CASCADE;
    DROP TABLE IF EXISTS vaults CASCADE;
    DROP TABLE IF EXISTS users CASCADE;
    DROP TABLE IF EXISTS item_types CASCADE;
    DROP FUNCTION IF EXISTS update_updated_at() CASCADE;
  `);

  console.log('📦 执行迁移...');
  const { scriptsExecuted } = await runMigrations();
  console.log(`✅ 测试数据库初始化完成：执行了 ${scriptsExecuted} 条 SQL 语句`);

  await db.end();
  process.exit(0);
}

initTestDb().catch((err) => {
  console.error('❌ 测试数据库初始化失败：', err);
  process.exit(1);
});
