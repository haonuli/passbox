'use client';

import { ThemeProvider as NextThemesProvider } from 'next-themes';
import type { ComponentPropsWithoutRef } from 'react';

/**
 * 主题 Provider 包装器，封装 next-themes。
 *
 * 配置：
 * - attribute="class"：通过 <html class="dark"> 切换暗色模式，与 shadcn/ui 的 .dark 选择器对齐
 * - defaultTheme="system"：默认跟随系统偏好
 * - enableSystem：允许读取 prefers-color-scheme
 * - disableTransitionOnChange：切换主题时禁用过渡动画，避免色块闪烁
 */
export function ThemeProvider({
  children,
  ...props
}: ComponentPropsWithoutRef<typeof NextThemesProvider>) {
  return <NextThemesProvider {...props}>{children}</NextThemesProvider>;
}
