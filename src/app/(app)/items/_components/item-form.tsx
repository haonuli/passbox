/**
 * 条目新建/编辑表单 (T4.6)
 *
 * 共享表单组件，支持 create / edit 两种模式。
 *
 * 保存时客户端加密流程：
 * 1. 生成 itemId（UUID，仅 create 模式）
 * 2. 分别加密 title 和 payload
 *    - title AAD = `item:${itemId}:title`
 *    - data AAD = `item:${itemId}:data`
 * 3. 调用 createItem / updateItem Server Action
 * 4. 成功后更新 vault-store 缓存并跳转
 *
 * @see TASK_BREAKDOWN T4.6 验收标准
 */
'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { ArrowLeft, Loader2, Save } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { PasswordInput } from '@/components/password-input';
import { useAuthStore } from '@/stores/auth-store';
import { useVaultStore } from '@/stores/vault-store';
import { createItem, updateItem } from '@/actions/item';
import { encrypt } from '@/lib/crypto/aes';
import type { EncryptedData } from '@/types/crypto';
import type { DecryptedItem, ItemData } from '@/types/vault';

// ---- zod 校验 ----
const itemFormSchema = z.object({
  title: z.string().min(1, '请输入标题').max(200, '标题不能超过 200 字'),
  url: z.string().max(500, '网址不能超过 500 字').optional().or(z.literal('')),
  username: z.string().max(200, '用户名不能超过 200 字').optional().or(z.literal('')),
  password: z.string().max(500, '密码不能超过 500 字').optional().or(z.literal('')),
  notes: z.string().max(5000, '备注不能超过 5000 字').optional().or(z.literal('')),
});

type ItemFormValues = z.infer<typeof itemFormSchema>;

interface ItemFormProps {
  mode: 'create' | 'edit';
  /** 编辑模式时传入 */
  itemId?: string;
}

export function ItemForm({ mode, itemId }: ItemFormProps) {
  const router = useRouter();
  const symmetricKey = useAuthStore((s) => s.symmetricKey);
  const { items, vaults, upsertItem } = useVaultStore();
  const [saving, setSaving] = useState(false);

  const existingItem = mode === 'edit' && itemId
    ? items.find((i) => i.id === itemId)
    : undefined;

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<ItemFormValues>({
    resolver: zodResolver(itemFormSchema),
    defaultValues: {
      title: '',
      url: '',
      username: '',
      password: '',
      notes: '',
    },
  });

  // 编辑模式：预填充已有数据
  useEffect(() => {
    if (mode === 'edit' && existingItem) {
      reset({
        title: existingItem.title,
        url: existingItem.data.url ?? '',
        username: existingItem.data.username ?? '',
        password: existingItem.data.password ?? '',
        notes: existingItem.data.notes ?? '',
      });
    }
  }, [mode, existingItem, reset]);

  const onSubmit = useCallback(
    async (values: ItemFormValues) => {
      if (!symmetricKey) {
        toast.error('密码库未解锁');
        return;
      }

      // 编辑模式但条目不存在
      if (mode === 'edit' && !existingItem) {
        toast.error('条目不存在');
        router.push('/vault');
        return;
      }

      // 确定保险库（使用第一个保险库，T6.5 多保险库管理后完善）
      const vaultId = existingItem?.vaultId ?? vaults[0]?.id;
      if (!vaultId) {
        toast.error('未找到可用保险库');
        return;
      }

      setSaving(true);
      try {
        // 确定 itemId（create 模式生成新 UUID，edit 模式使用已有）
        const targetItemId = existingItem?.id ?? crypto.randomUUID();

        // 构建 payload
        const payload: ItemData = {
          url: values.url || undefined,
          username: values.username || undefined,
          password: values.password || undefined,
          notes: values.notes || undefined,
        };

        // 分别加密 title 和 data，使用 itemId 绑定 AAD
        const titleEncrypted: EncryptedData = await encrypt(
          symmetricKey,
          values.title,
          `item:${targetItemId}:title`,
        );
        const dataEncrypted: EncryptedData = await encrypt(
          symmetricKey,
          JSON.stringify(payload),
          `item:${targetItemId}:data`,
        );

        if (mode === 'create') {
          const result = await createItem({
            vaultId,
            itemTypeId: 1, // login
            titleEncrypted,
            dataEncrypted,
            tagIds: [],
          });

          if (result.ok) {
            // 服务端返回的条目使用服务端生成的 id，需要用返回的 id 构建 DecryptedItem
            const newItem: DecryptedItem = {
              id: result.data.id,
              vaultId: result.data.vault_id,
              itemTypeId: result.data.item_type_id,
              itemTypeCode: 'login',
              title: values.title,
              data: payload,
              isFavorite: false,
              createdAt: result.data.created_at,
              updatedAt: result.data.updated_at,
              tagIds: [],
            };
            upsertItem(newItem);
            toast.success('已保存');
            router.push(`/items/${result.data.id}`);
          } else {
            toast.error(result.error);
          }
        } else {
          const result = await updateItem(targetItemId, {
            titleEncrypted,
            dataEncrypted,
          });

          if (result.ok && existingItem) {
            const updatedItem: DecryptedItem = {
              ...existingItem,
              title: values.title,
              data: payload,
              updatedAt: result.data.updated_at,
            };
            upsertItem(updatedItem);
            toast.success('已保存');
            router.push(`/items/${targetItemId}`);
          } else if (!result.ok) {
            toast.error(result.error);
          }
        }
      } catch {
        toast.error('保存失败，请稍后重试');
      } finally {
        setSaving(false);
      }
    },
    [symmetricKey, mode, existingItem, vaults, upsertItem, router],
  );

  // 编辑模式但条目不存在
  if (mode === 'edit' && !existingItem && items.length > 0) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-4 p-8 text-center">
        <p className="text-sm text-muted-foreground">条目不存在或已被删除</p>
        <Button size="sm" variant="outline" onClick={() => router.push('/vault')}>
          返回密码库
        </Button>
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col">
      {/* 顶部操作栏 */}
      <div className="flex items-center gap-2 border-b border-border px-4 py-3">
        <Button
          size="icon"
          variant="ghost"
          onClick={() => router.back()}
          aria-label="返回"
        >
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <h1 className="flex-1 text-base font-semibold">
          {mode === 'create' ? '新建条目' : '编辑条目'}
        </h1>
      </div>

      {/* 表单 */}
      <form
        onSubmit={handleSubmit(onSubmit)}
        className="flex-1 space-y-4 overflow-auto p-4"
      >
        <div className="space-y-1.5">
          <Label htmlFor="title">标题</Label>
          <Input
            id="title"
            placeholder="例如：Google 账号"
            {...register('title')}
          />
          {errors.title && (
            <p className="text-xs text-destructive">{errors.title.message}</p>
          )}
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="url">网址</Label>
          <Input
            id="url"
            placeholder="https://example.com"
            {...register('url')}
          />
          {errors.url && (
            <p className="text-xs text-destructive">{errors.url.message}</p>
          )}
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="username">用户名</Label>
          <Input
            id="username"
            placeholder="用户名或邮箱"
            {...register('username')}
          />
          {errors.username && (
            <p className="text-xs text-destructive">{errors.username.message}</p>
          )}
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="password">密码</Label>
          <PasswordInput
            id="password"
            placeholder="输入或生成密码"
            {...register('password')}
          />
          {errors.password && (
            <p className="text-xs text-destructive">{errors.password.message}</p>
          )}
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="notes">备注</Label>
          <textarea
            id="notes"
            className="flex min-h-[80px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
            placeholder="可选备注信息"
            {...register('notes')}
          />
          {errors.notes && (
            <p className="text-xs text-destructive">{errors.notes.message}</p>
          )}
        </div>

        {/* 底部操作 */}
        <div className="flex justify-end gap-2 pt-2">
          <Button
            type="button"
            variant="outline"
            onClick={() => router.back()}
            disabled={saving}
          >
            取消
          </Button>
          <Button type="submit" disabled={saving}>
            {saving && <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />}
            <Save className="mr-1.5 h-4 w-4" />
            保存
          </Button>
        </div>
      </form>
    </div>
  );
}
