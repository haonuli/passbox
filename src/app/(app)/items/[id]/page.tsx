/**
 * 条目详情页 (T4.5)
 *
 * Server Component 壳，从路由参数提取 itemId 传给客户端组件。
 */
import { ItemDetail } from './_components/item-detail';

export default async function ItemDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <ItemDetail itemId={id} />;
}
