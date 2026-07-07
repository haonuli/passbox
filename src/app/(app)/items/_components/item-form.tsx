/**
 * 条目新建/编辑表单 (T4.6 / T6.3)
 *
 * 共享表单组件，支持 create / edit 两种模式。
 * T6.3: 支持三种条目类型（login / secure_note / credit_card），动态切换字段。
 *
 * 保存时客户端加密流程：
 * 1. 生成 itemId（UUID，仅 create 模式）
 * 2. 分别加密 title 和 payload
 *    - title AAD = `item:${itemId}:title`
 *    - data AAD = `item:${itemId}:data`
 * 3. 调用 createItem / updateItem Server Action
 * 4. 成功后更新 vault-store 缓存并跳转
 *
 * @see TASK_BREAKDOWN T4.6 / T6.3 验收标准
 */
'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { ArrowLeft, Loader2, Save, KeyRound, FileText, CreditCard } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { PasswordInput } from '@/components/password-input';
import { VaultSelect } from '@/app/(app)/items/_components/vault-select';
import { TagInput } from '@/app/(app)/items/_components/tag-input';
import { useAuthStore } from '@/stores/auth-store';
import { useVaultStore } from '@/stores/vault-store';
import { createItem, updateItem } from '@/actions/item';
import { encrypt } from '@/lib/crypto/aes';
import type { EncryptedData } from '@/types/crypto';
import type { DecryptedItem, ItemData } from '@/types/vault';
import { cn } from '@/lib/utils';

/** 条目类型选项 */
type ItemTypeId = 1 | 2 | 3;

const TYPE_OPTIONS: { id: ItemTypeId; label: string; icon: typeof KeyRound }[] = [
  { id: 1, label: '登录', icon: KeyRound },
  { id: 2, label: '安全笔记', icon: FileText },
  { id: 3, label: '信用卡', icon: CreditCard },
];

const TYPE_CODE_MAP: Record<ItemTypeId, string> = {
  1: 'login',
  2: 'secure_note',
  3: 'credit_card',
};

// ---- zod 校验（包含所有类型字段，按类型动态使用） ----
const itemFormSchema = z.object({
  title: z.string().min(1, '请输入标题').max(200, '标题不能超过 200 字'),
  // login 字段
  url: z.string().max(500, '网址不能超过 500 字').optional().or(z.literal('')),
  username: z.string().max(200, '用户名不能超过 200 字').optional().or(z.literal('')),
  password: z.string().max(500, '密码不能超过 500 字').optional().or(z.literal('')),
  totpSecret: z.string().max(200, 'TOTP 密钥不能超过 200 字').optional().or(z.literal('')),
  // secure_note 字段
  noteText: z.string().max(10000, '笔记不能超过 10000 字').optional().or(z.literal('')),
  // credit_card 字段
  cardholder: z.string().max(200, '持卡人不能超过 200 字').optional().or(z.literal('')),
  cardNumber: z.string().max(200, '卡号不能超过 200 字').optional().or(z.literal('')),
  expiry: z.string().max(20, '有效期不能超过 20 字').optional().or(z.literal('')),
  cvv: z.string().max(10, 'CVV 不能超过 10 字').optional().or(z.literal('')),
  // 通用
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
  const [selectedTagIds, setSelectedTagIds] = useState<string[]>([]);

  const existingItem = mode === 'edit' && itemId
    ? items.find((i) => i.id === itemId)
    : undefined;

  // 条目类型（编辑模式时锁定，不可更改）
  const [itemType, setItemType] = useState<ItemTypeId>(
    (existingItem?.itemTypeId as ItemTypeId) ?? 1,
  );

  // 保险库选择
  const [vaultId, setVaultId] = useState(
    existingItem?.vaultId ?? vaults[0]?.id ?? '',
  );

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
      totpSecret: '',
      noteText: '',
      cardholder: '',
      cardNumber: '',
      expiry: '',
      cvv: '',
      notes: '',
    },
  });

  // 编辑模式：预填充已有数据
  useEffect(() => {
    if (mode === 'edit' && existingItem) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setItemType(existingItem.itemTypeId as ItemTypeId);
      reset({
        title: existingItem.title,
        url: existingItem.data.url ?? '',
        username: existingItem.data.username ?? '',
        password: existingItem.data.password ?? '',
        totpSecret: existingItem.data.totpSecret ?? '',
        noteText: existingItem.data.noteText ?? '',
        cardholder: existingItem.data.cardholder ?? '',
        cardNumber: existingItem.data.cardNumber ?? '',
        expiry: existingItem.data.expiry ?? '',
        cvv: existingItem.data.cvv ?? '',
        notes: existingItem.data.notes ?? '',
      });
    }
  }, [mode, existingItem, reset]);

  /** 根据条目类型构建 payload */
  const buildPayload = useCallback((values: ItemFormValues): ItemData => {
    switch (itemType) {
      case 1: // login
        return {
          url: values.url || undefined,
          username: values.username || undefined,
          password: values.password || undefined,
          totpSecret: values.totpSecret || undefined,
          notes: values.notes || undefined,
        };
      case 2: // secure_note
        return {
          noteText: values.noteText || undefined,
        };
      case 3: // credit_card
        return {
          cardholder: values.cardholder || undefined,
          cardNumber: values.cardNumber || undefined,
          expiry: values.expiry || undefined,
          cvv: values.cvv || undefined,
          notes: values.notes || undefined,
        };
      default:
        return {};
    }
  }, [itemType]);

  const onSubmit = useCallback(
    async (values: ItemFormValues) => {
      if (!symmetricKey) {
        toast.error('密码库未解锁');
        return;
      }

      if (mode === 'edit' && !existingItem) {
        toast.error('条目不存在');
        router.push('/vault');
        return;
      }

      const targetVaultId = vaultId || existingItem?.vaultId || vaults[0]?.id;
      if (!targetVaultId) {
        toast.error('未找到可用保险库');
        return;
      }

      setSaving(true);
      try {
        const targetItemId = existingItem?.id ?? crypto.randomUUID();
        const payload = buildPayload(values);

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
            vaultId: targetVaultId,
            itemTypeId: itemType,
            titleEncrypted,
            dataEncrypted,
            tagIds: selectedTagIds,
          });

          if (result.ok) {
            const newItem: DecryptedItem = {
              id: result.data.id,
              vaultId: result.data.vault_id,
              itemTypeId: result.data.item_type_id,
              itemTypeCode: TYPE_CODE_MAP[itemType],
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
            vaultId: targetVaultId !== existingItem?.vaultId ? targetVaultId : undefined,
            titleEncrypted,
            dataEncrypted,
            tagIds: selectedTagIds,
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
    [symmetricKey, mode, existingItem, vaults, upsertItem, router, itemType, buildPayload, vaultId, selectedTagIds],
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
        {/* 类型选择器（仅 create 模式可切换） */}
        <div className="space-y-1.5">
          <Label>条目类型</Label>
          <div className="flex gap-2">
            {TYPE_OPTIONS.map((opt) => {
              const Icon = opt.icon;
              const isDisabled = mode === 'edit';
              return (
                <button
                  key={opt.id}
                  type="button"
                  disabled={isDisabled}
                  onClick={() => setItemType(opt.id)}
                  className={cn(
                    'flex items-center gap-1.5 rounded-md border px-3 py-2 text-sm font-medium transition-colors',
                    itemType === opt.id
                      ? 'border-primary bg-primary text-primary-foreground'
                      : 'border-border text-muted-foreground hover:bg-muted',
                    isDisabled && 'cursor-not-allowed opacity-60',
                  )}
                >
                  <Icon className="h-4 w-4" />
                  {opt.label}
                </button>
              );
            })}
          </div>
        </div>

        {/* 标题（所有类型通用） */}
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

        {/* 保险库选择 */}
        <div className="space-y-1.5">
          <Label>保险库</Label>
          <VaultSelect value={vaultId} onChange={setVaultId} />
        </div>

        {/* Login 类型字段 */}
        {itemType === 1 && (
          <>
            <div className="space-y-1.5">
              <Label htmlFor="url">网址</Label>
              <Input id="url" placeholder="https://example.com" {...register('url')} />
              {errors.url && <p className="text-xs text-destructive">{errors.url.message}</p>}
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="username">用户名</Label>
              <Input id="username" placeholder="用户名或邮箱" {...register('username')} />
              {errors.username && <p className="text-xs text-destructive">{errors.username.message}</p>}
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="password">密码</Label>
              <PasswordInput id="password" placeholder="输入或生成密码" {...register('password')} />
              {errors.password && <p className="text-xs text-destructive">{errors.password.message}</p>}
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="totpSecret">一次性密码（TOTP）</Label>
              <Input id="totpSecret" placeholder="粘贴 base32 密钥（可选）" autoComplete="off" {...register('totpSecret')} />
              {errors.totpSecret && <p className="text-xs text-destructive">{errors.totpSecret.message}</p>}
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="notes">备注</Label>
              <textarea
                id="notes"
                className="flex min-h-[80px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                placeholder="可选备注信息"
                {...register('notes')}
              />
              {errors.notes && <p className="text-xs text-destructive">{errors.notes.message}</p>}
            </div>
          </>
        )}

        {/* Secure Note 类型字段 */}
        {itemType === 2 && (
          <div className="space-y-1.5">
            <Label htmlFor="noteText">笔记内容</Label>
            <textarea
              id="noteText"
              className="flex min-h-[200px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
              placeholder="输入笔记内容…"
              {...register('noteText')}
            />
            {errors.noteText && <p className="text-xs text-destructive">{errors.noteText.message}</p>}
          </div>
        )}

        {/* Credit Card 类型字段 */}
        {itemType === 3 && (
          <>
            <div className="space-y-1.5">
              <Label htmlFor="cardholder">持卡人</Label>
              <Input id="cardholder" placeholder="持卡人姓名" {...register('cardholder')} />
              {errors.cardholder && <p className="text-xs text-destructive">{errors.cardholder.message}</p>}
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="cardNumber">卡号</Label>
              <PasswordInput id="cardNumber" placeholder="信用卡号" {...register('cardNumber')} />
              {errors.cardNumber && <p className="text-xs text-destructive">{errors.cardNumber.message}</p>}
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="expiry">有效期</Label>
                <Input id="expiry" placeholder="MM/YY" {...register('expiry')} />
                {errors.expiry && <p className="text-xs text-destructive">{errors.expiry.message}</p>}
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="cvv">CVV</Label>
                <PasswordInput id="cvv" placeholder="安全码" {...register('cvv')} />
                {errors.cvv && <p className="text-xs text-destructive">{errors.cvv.message}</p>}
              </div>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="notes">备注</Label>
              <textarea
                id="notes"
                className="flex min-h-[80px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                placeholder="可选备注信息"
                {...register('notes')}
              />
              {errors.notes && <p className="text-xs text-destructive">{errors.notes.message}</p>}
            </div>
          </>
        )}

        {/* 标签（所有类型通用） */}
        <div className="space-y-1.5">
          <Label>标签</Label>
          <TagInput selectedTagIds={selectedTagIds} onChange={setSelectedTagIds} />
        </div>

        {/* 底部操作 */}
        <div className="flex justify-end gap-2 pt-2">
          <Button type="button" variant="outline" onClick={() => router.back()} disabled={saving}>
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
