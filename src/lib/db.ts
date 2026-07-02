import { Pool } from 'pg';

/**
 * PostgreSQL 连接池单例
 *
 * 使用 globalThis 防止 Next.js 开发模式下热重载（HMR）创建多个连接池，
 * 导致连接泄露。生产环境不缓存到 globalThis。
 *
 * 约束（Project Rules）：
 * - 仅限 Server 端使用（Server Component / Server Action / Route Handler / lib/）
 * - 禁止在 Client Component 中引入
 * - 所有查询必须使用参数化占位符（$1, $2, ...），禁止 SQL 拼接
 */
declare global {
  var __db: Pool | undefined;
}

export const db =
  globalThis.__db ??
  new Pool({
    connectionString: process.env.DATABASE_URL,
    max: 10,
  });

if (process.env.NODE_ENV !== 'production') {
  globalThis.__db = db;
}
