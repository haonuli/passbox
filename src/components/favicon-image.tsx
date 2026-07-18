/**
 * Favicon 图片组件
 *
 * 根据条目 URL 显示网站 favicon，失败时回退到条目类型图标。
 * 使用 DuckDuckGo favicon 服务获取图标。
 */
'use client';

import { useState, createElement } from 'react';
import Image from 'next/image';
import { FileText, type LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';
import { getItemTypeConfigByCode } from '@/lib/item-types';

interface FaviconImageProps {
  /** 条目的 URL 字段 */
  url?: string;
  /** 条目类型代码（回退图标） */
  itemTypeCode: string;
  className?: string;
}

/** 从 URL 中提取域名，解析失败返回 null */
function extractDomain(url: string): string | null {
  try {
    const normalized =
      url.startsWith('http://') || url.startsWith('https://')
        ? url
        : `https://${url}`;
    return new URL(normalized).hostname;
  } catch {
    return null;
  }
}

export function FaviconImage({ url, itemTypeCode, className }: FaviconImageProps) {
  const [hasError, setHasError] = useState(false);

  const domain = url ? extractDomain(url) : null;
  const shouldShowFavicon = Boolean(domain) && !hasError;

  if (shouldShowFavicon && domain) {
    return (
      <Image
        src={`https://icons.duckduckgo.com/ip3/${domain}.ico`}
        alt=""
        width={16}
        height={16}
        unoptimized
        onError={() => setHasError(true)}
        className={cn('rounded object-cover', className)}
      />
    );
  }

  const Icon: LucideIcon = getItemTypeConfigByCode(itemTypeCode)?.icon ?? FileText;
  return createElement(Icon, { className });
}
