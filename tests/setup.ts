import { config } from 'dotenv';
import '@testing-library/jest-dom/vitest';

// 加载测试环境变量（.env.test），确保 DATABASE_URL 指向 passbox_test
config({ path: '.env.test' });
