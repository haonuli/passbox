/**
 * 分享弹窗组件
 *
 * 两步流程：配置（过期时间 + 查看次数）→ 结果（展示链接 + 复制）。
 * 创建链接时在客户端生成 AES-256 密钥并加密标题与数据，
 * 密钥通过 URL hash 传递（不发送到服务端）。
 */
'use client';

import { useState } from 'react';
import { Loader2, Copy, ShieldCheck } from 'lucide-react';
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
import { generateShareKey, encryptShareData } from '@/lib/share/crypto';
import { EXPIRY_OPTIONS, VIEW_LIMIT_OPTIONS } from '@/types/share';
import type { DecryptedItem } from '@/types/vault';
import { cn } from '@/lib/utils';

interface ShareDialogProps {
  item: DecryptedItem;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

type Step = 'config' | 'result';

export function ShareDialog({ item, open, onOpenChange }: ShareDialogProps) {
  const [step, setStep] = useState<Step>('config');
  const [expiresInHours, setExpiresInHours] = useState<number>(24);
  const [maxViews, setMaxViews] = useState<number | null>(null);
  const [creating, setCreating] = useState(false);
  const [shareUrl, setShareUrl] = useState('');
  const [copied, setCopied] = useState(false);

  const handleOpenChange = (next: boolean) => {
    if (!next) {
      setStep('config');
      setShareUrl('');
      setCopied(false);
    }
    onOpenChange(next);
  };

  const handleCreate = async () => {
    setCreating(true);
    try {
      const key = await generateShareKey();
      const jsonData = JSON.stringify({
        title: item.title,
        itemType: item.itemTypeCode,
        fields: item.data,
        favorite: item.isFavorite,
      });
      const encryptedTitle = await encryptShareData(key, item.title);
      const encryptedData = await encryptShareData(key, jsonData);

      const res = await fetch('/api/share', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          encryptedTitle,
          encryptedData,
          itemTypeCode: item.itemTypeCode,
          expiresInHours,
          maxViews,
        }),
      });

      if (!res.ok) {
        const body = (await res.json().catch(() => null)) as { error?: string } | null;
        toast.error(body?.error ?? '创建链接失败');
        return;
      }

      const data = (await res.json()) as { id: string };
      const url = `${window.location.origin}/share/${data.id}#k=${key}`;
      setShareUrl(url);
      setStep('result');
      toast.success('共享链接已创建');
    } catch {
      toast.error('创建链接失败，请稍后重试');
    } finally {
      setCreating(false);
    }
  };

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(shareUrl);
      setCopied(true);
      toast.success('链接已复制到剪贴板');
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error('复制失败，请手动复制');
    }
  };

  const optionBtnBase =
    'rounded-md border px-3 py-1.5 text-xs font-medium transition-colors';
  const optionBtnActive = 'border-primary bg-primary text-primary-foreground';
  const optionBtnIdle = 'border-input bg-background hover:bg-accent';

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent>
        {step === 'config' ? (
          <>
            <DialogHeader>
              <DialogTitle>创建共享链接</DialogTitle>
              <DialogDescription>
                为「{item.title}」生成一个安全共享链接，密钥仅保留在链接 URL 中。
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4 py-2">
              <div className="space-y-2">
                <Label>过期时间</Label>
                <div className="flex flex-wrap gap-2">
                  {EXPIRY_OPTIONS.map((opt) => (
                    <button
                      key={opt.hours}
                      type="button"
                      onClick={() => setExpiresInHours(opt.hours)}
                      className={cn(
                        optionBtnBase,
                        expiresInHours === opt.hours ? optionBtnActive : optionBtnIdle,
                      )}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>

              <div className="space-y-2">
                <Label>查看次数限制</Label>
                <div className="flex flex-wrap gap-2">
                  {VIEW_LIMIT_OPTIONS.map((opt) => (
                    <button
                      key={String(opt.value)}
                      type="button"
                      onClick={() => setMaxViews(opt.value)}
                      className={cn(
                        optionBtnBase,
                        maxViews === opt.value ? optionBtnActive : optionBtnIdle,
                      )}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={() => handleOpenChange(false)} disabled={creating}>
                取消
              </Button>
              <Button onClick={handleCreate} disabled={creating}>
                {creating && <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />}
                创建链接
              </Button>
            </DialogFooter>
          </>
        ) : (
          <>
            <DialogHeader>
              <DialogTitle>共享链接已创建</DialogTitle>
              <DialogDescription>将以下链接通过安全渠道发送给信任的人。</DialogDescription>
            </DialogHeader>

            <div className="space-y-2 py-2">
              <Label>链接地址</Label>
              <Input readOnly value={shareUrl} onFocus={(e) => e.target.select()} />
              <div className="flex items-start gap-2 rounded-md bg-muted/50 p-3 text-xs text-muted-foreground">
                <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                <span>链接包含解密密钥，请通过安全渠道发送给信任的人。任何人获得此链接即可查看条目内容。</span>
              </div>
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={() => handleOpenChange(false)}>
                关闭
              </Button>
              <Button onClick={handleCopy}>
                <Copy className="h-4 w-4" />
                {copied ? '已复制' : '复制链接'}
              </Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
