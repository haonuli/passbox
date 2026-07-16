/**
 * 条目详情页 (T4.5)
 *
 * 重定向到密码库三栏布局，通过 itemId 参数选中对应条目。
 */
import { redirect } from 'next/navigation';

export default async function ItemDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  redirect(`/vault?itemId=${id}`);
}
