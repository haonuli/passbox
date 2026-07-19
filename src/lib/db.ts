import { Pool } from 'pg';

/**
 * PostgreSQL 连接池单例
 *
 * 使用 globalThis 防止 Next.js 开发模式下热重载（HMR）创建多个连接池，
 * 导致连接泄露。生产环境也缓存到 globalThis，使同一 serverless 实例
 * 能复用连接池（Vercel serverless 函数实例在热调用时会复用模块缓存）。
 *
 * Serverless 适配：
 * - max: 默认 10（典型 Node.js 服务可承载并发）；serverless 部署可通过 DB_POOL_MAX 环境变量
 *   调小为 3-5，避免多实例并发耗尽数据库连接。
 * - idleTimeoutMillis: 10000（实例冻结后尽快释放连接）
 * - connectionTimeoutMillis: 5000（连接超时快速失败）
 *
 * 约束（Project Rules）：
 * - 仅限 Server 端使用（Server Component / Server Action / Route Handler / lib/）
 * - 禁止在 Client Component 中引入
 * - 所有查询必须使用参数化占位符（$1, $2, ...），禁止 SQL 拼接
 */
declare global {
  var __db: Pool | undefined;
}

/** 连接池大小：默认 10，可通过 DB_POOL_MAX 环境变量覆盖（serverless 部署建议 3-5） */
const DB_POOL_MAX = (() => {
  const envValue = process.env.DB_POOL_MAX;
  if (!envValue) return 10;
  const parsed = Number.parseInt(envValue, 10);
  if (!Number.isFinite(parsed) || parsed < 1) return 10;
  return parsed;
})();

export const db =
  globalThis.__db ??
  new Pool({
    connectionString: process.env.DATABASE_URL,
    max: DB_POOL_MAX,
    idleTimeoutMillis: 10_000,
    connectionTimeoutMillis: 5_000,
  });

globalThis.__db = db;
