/**
 * 标签创建/重命名弹窗（共享组件）
 *
 * 标签名称明文存储，无需加解密。
 * 被侧边栏 TagSection 和设置页 TagsView 共用。
 */
'use client';

import { useState } from 'react';
import { Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { createTag, renameTag } from '@/actions/tag';
import { useVaultStore } from '@/stores/vault-store';
import type { DecryptedTag } from '@/types/vault';

/** 标签名称最大长度 — 与 actions/tag.ts 保持一致 */
const MAX_TAG_NAME_LENGTH = 50;

interface TagFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** 'create' 新建 | 'rename' 重命名 */
  mode: 'create' | 'rename';
  /** 重命名时传入的现有标签 */
  tag?: DecryptedTag;
  /** 操作成功后回调（store 已更新） */
  onSaved?: () => void;
}

export function TagFormDialog({
  open,
  onOpenChange,
  mode,
  tag,
  onSaved,
}: TagFormDialogProps) {
  const upsertTag = useVaultStore((s) => s.upsertTag);

  const [name, setName] = useState('');
  const [saving, setSaving] = useState(false);

  // 打开时重置表单（render-time setState，替代 effect）
  // 参考：https://react.dev/learn/you-might-not-need-an-effect#adjusting-some-state-when-a-prop-changes
  const [prevOpen, setPrevOpen] = useState(open);
  if (open !== prevOpen) {
    setPrevOpen(open);
    if (open) {
      setName(mode === 'rename' && tag ? tag.name : '');
    }
  }

  const handleSubmit = async () => {
    const trimmed = name.trim();
    if (!trimmed) {
      toast.error('标签名称不能为空');
      return;
    }

    setSaving(true);
    try {
      if (mode === 'create') {
        const result = await createTag(trimmed);
        if (!result.ok) {
          toast.error(result.error);
          return;
        }
        const row = result.data;
        upsertTag({
          id: row.id,
          name: row.name,
          createdAt: row.created_at,
        });
        toast.success('标签已创建');
      } else if (mode === 'rename' && tag) {
        const result = await renameTag(tag.id, trimmed);
        if (!result.ok) {
          toast.error(result.error);
          return;
        }
        const row = result.data;
        upsertTag({
          id: row.id,
          name: row.name,
          createdAt: row.created_at,
        });
        toast.success('标签已重命名');
      }

      onSaved?.();
      onOpenChange(false);
    } catch {
      toast.error('操作失败，请稍后重试');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{mode === 'create' ? '新建标签' : '重命名标签'}</DialogTitle>
          <DialogDescription>
            {mode === 'create'
              ? '创建一个新标签，用于分类和筛选条目。'
              : '为标签设置一个新的名称。'}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-2 py-2">
          <Label htmlFor="tag-name">名称</Label>
          <Input
            id="tag-name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="例如：工作、银行、订阅"
            maxLength={MAX_TAG_NAME_LENGTH}
            autoFocus
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !saving) {
                e.preventDefault();
                void handleSubmit();
              }
            }}
          />
          <p className="text-xs text-muted-foreground">
            {name.length} / {MAX_TAG_NAME_LENGTH}
          </p>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
            取消
          </Button>
          <Button onClick={handleSubmit} disabled={saving || !name.trim()}>
            {saving && <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />}
            {mode === 'create' ? '创建' : '保存'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
