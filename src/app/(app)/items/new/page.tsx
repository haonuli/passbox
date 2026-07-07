/**
 * 新建条目页 (T4.6)
 *
 * Server Component 壳，渲染 ItemForm 创建模式。
 */
import { ItemForm } from '../_components/item-form';

export default function NewItemPage() {
  return <ItemForm mode="create" />;
}
