/**
 * 回收站相关常量（D-11）
 *
 * 单独抽取到非 'use server' 文件，便于 Server Actions 与客户端组件共享。
 * Next.js 要求 'use server' 文件只能 export async 函数。
 */

/** 回收站保留期（天） */
export const TRASH_RETENTION_DAYS = 30;
