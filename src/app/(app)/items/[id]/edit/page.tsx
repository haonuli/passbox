/**
 * 编辑条目页 (T4.6)
 *
 * Server Component 壳，从路由参数提取 itemId 传给 ItemForm 编辑模式。
 */
import { ItemForm } from '../../_components/item-form';

export default async function EditItemPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <ItemForm mode="edit" itemId={id} />;
}
