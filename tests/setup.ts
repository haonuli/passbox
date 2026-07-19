import { config } from 'dotenv';
import { beforeEach } from 'vitest';
import '@testing-library/jest-dom/vitest';
import { __resetRateLimitForTests } from '@/lib/rate-limit';

// 加载测试环境变量（.env.test），确保 DATABASE_URL 指向 passbox_test
config({ path: '.env.test' });

// 每个测试前重置内存级速率限制桶，避免 L6 限流导致集成测试连锁失败
beforeEach(() => {
  __resetRateLimitForTests();
});
