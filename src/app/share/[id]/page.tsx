/**
 * 共享条目公开查看页
 *
 * 无需认证，任何人通过链接即可访问。
 * 密钥在 URL hash 中，客户端解密后渲染。
 */
import type { Metadata } from 'next';
import { ShareViewClient } from './share-view-client';

export const metadata: Metadata = {
  title: 'PassBox 共享条目',
  description: '查看通过 PassBox 安全共享的条目',
};

interface SharePageProps {
  params: Promise<{ id: string }>;
}

export default async function SharePage({ params }: SharePageProps) {
  const { id } = await params;
  return <ShareViewClient shareId={id} />;
}
