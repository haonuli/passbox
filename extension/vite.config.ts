import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { crx } from '@crxjs/vite-plugin';
import { resolve } from 'path';
import manifest from './manifest.json';

/**
 * 根据构建模式动态生成 manifest。
 *
 * - dev 模式：host_permissions 仅限 localhost，权限最小化。
 * - production 模式：扩展需要在真实网站注入并跨域调用 web API，
 *   因此 host_permissions 放开为 <all_urls>。
 *
 * 使用：`vite build` 默认为 production；`vite` 默认为 development。
 * 也可通过环境变量 EXT_HOST_PERMISSIONS 显式覆盖（逗号分隔多域名）。
 */
function resolveHostPermissions(mode: string): string[] {
  const override = process.env.EXT_HOST_PERMISSIONS;
  if (override) return override.split(',').map((s) => s.trim()).filter(Boolean);
  return mode === 'production' ? ['<all_urls>'] : ['http://localhost:3000/*'];
}

export default defineConfig(({ mode }) => {
  const finalManifest = {
    ...manifest,
    host_permissions: resolveHostPermissions(mode),
  };

  return {
    plugins: [react(), crx({ manifest: finalManifest })],
    resolve: {
      alias: {
        '@shared': resolve(__dirname, '../src'),
        '@': resolve(__dirname, 'src'),
      },
    },
    build: {
      outDir: 'dist',
      emptyOutDir: true,
    },
  };
});
