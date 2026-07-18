/**
 * 条目新建/编辑表单 (T4.6 / T6.3)
 *
 * 数据驱动渲染：从 ITEM_TYPE_CONFIGS 读取类型与字段配置，
 * 动态渲染表单字段，新增类型无需修改本组件。
 *
 * 保存时客户端加密流程：
 * 1. 生成 itemId（UUID，仅 create 模式）
 * 2. 分别加密 title 和 payload
 *    - title AAD = `item:${itemId}:title`
 *    - data AAD = `item:${itemId}:data`
 * 3. 调用 createItem / updateItem Server Action
 * 4. 成功后更新 vault-store 缓存并跳转
 */
'use client';

import { useEffect, useState, useCallback, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { useForm, type UseFormRegister } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { ArrowLeft, Loader2, Save } from 'lucide-react';
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
import { saveHistory } from '@/actions/item-history';
import { encrypt } from '@/lib/crypto/aes';
import { ITEM_TYPE_CONFIGS, type FieldConfig, type ItemTypeConfig } from '@/lib/item-types';
import { getFieldSchema } from '@/lib/validations';
import type { EncryptedData } from '@/types/crypto';
import type { DecryptedItem, ItemData } from '@/types/vault';
import { cn } from '@/lib/utils';

/** 所有可能的表单值（title + 所有字段） */
type FormValues = Record<string, string> & { title: string };

/** 从字段配置生成 zod schema（集成类型化验证规则） */
function buildSchema(config: ItemTypeConfig): z.ZodType<FormValues> {
  const shape: Record<string, z.ZodTypeAny> = {
    title: z.string().min(1, '请输入标题').max(200, '标题不能超过 200 字'),
  };
  for (const field of config.fields) {
    // 优先使用字段名匹配的类型化验证规则（URL/邮箱/IP/端口等）
    const fieldSchema = getFieldSchema(field.name);
    if (fieldSchema) {
      shape[field.name] = fieldSchema;
    } else {
      const maxLen = field.maxLength ?? (field.type === 'textarea' ? 10000 : 500);
      shape[field.name] = z.string().max(maxLen).optional().or(z.literal(''));
    }
  }
  return z.object(shape) as unknown as z.ZodType<FormValues>;
}

/** 将字段列表按行分组（col:1 + col:2 配对） */
function groupFieldsByRow(fields: FieldConfig[]): FieldConfig[][] {
  const rows: FieldConfig[][] = [];
  let i = 0;
  while (i < fields.length) {
    if (fields[i].col === 1 && i + 1 < fields.length && fields[i + 1].col === 2) {
      rows.push([fields[i], fields[i + 1]]);
      i += 2;
    } else {
      rows.push([fields[i]]);
      i += 1;
    }
  }
  return rows;
}

/** 渲染单个字段 */
function FieldInput({ field, register, error }: {
  field: FieldConfig;
  register: UseFormRegister<FormValues>;
  error?: string;
}) {
  const fieldId = `field-${field.name}`;
  const errorEl = error ? <p className="text-xs text-destructive">{error}</p> : null;

  if (field.type === 'textarea') {
    const minH = field.name === 'noteText' ? 200 : 80;
    return (
      <div className="space-y-1.5">
        <Label htmlFor={fieldId}>{field.label}</Label>
        <textarea
          id={fieldId}
          className="flex min-h-[var(--min-h)] w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
          style={{ ['--min-h' as string]: `${minH}px` }}
          placeholder={field.placeholder}
          {...register(field.name)}
        />
        {errorEl}
      </div>
    );
  }

  if (field.type === 'password') {
    return (
      <div className="space-y-1.5">
        <Label htmlFor={fieldId}>{field.label}</Label>
        <PasswordInput id={fieldId} placeholder={field.placeholder} {...register(field.name)} />
        {errorEl}
      </div>
    );
  }

  return (
    <div className="space-y-1.5">
      <Label htmlFor={fieldId}>{field.label}</Label>
      <Input
        id={fieldId}
        type={field.type === 'date' ? 'date' : 'text'}
        placeholder={field.placeholder}
        {...register(field.name)}
      />
      {errorEl}
    </div>
  );
}

interface ItemFormProps {
  mode: 'create' | 'edit';
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

  const [itemTypeId, setItemTypeId] = useState(
    existingItem?.itemTypeId ?? 1,
  );
  const [vaultId, setVaultId] = useState(
    existingItem?.vaultId ?? vaults[0]?.id ?? '',
  );

  const currentConfig = useMemo(
    () => ITEM_TYPE_CONFIGS.find((t) => t.id === itemTypeId) ?? ITEM_TYPE_CONFIGS[0],
    [itemTypeId],
  );

  const schema = useMemo(() => buildSchema(currentConfig), [currentConfig]);
  const fieldRows = useMemo(() => groupFieldsByRow(currentConfig.fields), [currentConfig]);

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    mode: 'onBlur',
    defaultValues: useMemo(() => {
      const defaults: Record<string, string> = { title: '' };
      for (const f of currentConfig.fields) {
        defaults[f.name] = '';
      }
      return defaults as FormValues;
    }, [currentConfig]),
  });

  // 编辑模式：预填充已有数据
  useEffect(() => {
    if (mode === 'edit' && existingItem) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setItemTypeId(existingItem.itemTypeId);
      const values: Record<string, string> = { title: existingItem.title };
      for (const f of currentConfig.fields) {
        values[f.name] = (existingItem.data as Record<string, string | undefined>)[f.name] ?? '';
      }
      reset(values as FormValues);
    }
  }, [mode, existingItem, reset, currentConfig]);

  // vaults 异步加载后，若 vaultId 为空或不匹配，自动选中第一个保险库
  useEffect(() => {
    if (vaults.length === 0) return;
    const exists = vaults.some((v) => v.id === vaultId);
    if (!exists) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setVaultId(vaults[0].id);
    }
  }, [vaults, vaultId]);

  /** 根据条目类型构建 payload */
  const buildPayload = useCallback((values: FormValues): ItemData => {
    const payload: Record<string, string> = {};
    for (const field of currentConfig.fields) {
      const value = values[field.name];
      if (value) payload[field.name] = value;
    }
    return payload as ItemData;
  }, [currentConfig]);

  const onSubmit = useCallback(
    async (values: FormValues) => {
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
            itemId: targetItemId,
            vaultId: targetVaultId,
            itemTypeId,
            titleEncrypted,
            dataEncrypted,
            tagIds: selectedTagIds,
          });

          if (result.ok) {
            const newItem: DecryptedItem = {
              id: result.data.id,
              vaultId: result.data.vault_id,
              itemTypeId: result.data.item_type_id,
              itemTypeCode: currentConfig.code,
              title: values.title,
              data: payload,
              isFavorite: false,
              createdAt: result.data.created_at,
              updatedAt: result.data.updated_at,
              tagIds: [],
            };
            upsertItem(newItem);
            toast.success('已保存');
            router.push(`/vault?itemId=${result.data.id}`);
          } else {
            toast.error(result.error);
          }
        } else {
          if (existingItem) {
            await saveHistory(existingItem.id);
          }
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
            router.push(`/vault?itemId=${targetItemId}`);
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
    [symmetricKey, mode, existingItem, vaults, upsertItem, router, itemTypeId, buildPayload, vaultId, selectedTagIds, currentConfig],
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
          <div className="flex flex-wrap gap-2">
            {ITEM_TYPE_CONFIGS.map((opt) => {
              const Icon = opt.icon;
              const isDisabled = mode === 'edit';
              return (
                <button
                  key={opt.id}
                  type="button"
                  disabled={isDisabled}
                  onClick={() => setItemTypeId(opt.id)}
                  className={cn(
                    'flex items-center gap-1.5 rounded-md border px-3 py-2 text-sm font-medium transition-colors',
                    itemTypeId === opt.id
                      ? 'border-primary bg-primary text-primary-foreground'
                      : 'border-border text-muted-foreground hover:bg-muted',
                    isDisabled && 'cursor-not-allowed opacity-60',
                  )}
                >
                  <Icon className="h-4 w-4" />
                  {opt.name}
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
          {errors.title?.message && (
            <p className="text-xs text-destructive">{errors.title.message}</p>
          )}
        </div>

        {/* 保险库选择 */}
        <div className="space-y-1.5">
          <Label>保险库</Label>
          <VaultSelect value={vaultId} onChange={setVaultId} />
        </div>

        {/* 动态字段（按类型从配置渲染） */}
        {fieldRows.map((row, rowIdx) => {
          if (row.length === 1) {
            const field = row[0];
            return (
              <FieldInput
                key={field.name}
                field={field}
                register={register}
                error={errors[field.name]?.message as string | undefined}
              />
            );
          }
          return (
            <div key={rowIdx} className="grid grid-cols-2 gap-3">
              {row.map((field) => (
                <FieldInput
                  key={field.name}
                  field={field}
                  register={register}
                  error={errors[field.name]?.message as string | undefined}
                />
              ))}
            </div>
          );
        })}

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
