/**
 * 共享条目查看客户端组件
 *
 * 从 URL hash 提取密钥，拉取加密数据并解密渲染。
 * 支持 loading / 失效 / 解密失败 / 正常 四种状态。
 */
'use client';

import { useEffect, useState, useMemo, createElement } from 'react';
import {
  Loader2,
  Eye,
  EyeOff,
  Copy,
  Link2Off,
  ShieldAlert,
  Lock,
} from 'lucide-react';
import { toast } from 'sonner';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { decryptShareData } from '@/lib/share/crypto';
import {
  getItemTypeConfigByCode,
  getFieldIcon,
  type FieldConfig,
} from '@/lib/item-types';
import type { ItemData } from '@/types/vault';

interface ShareViewClientProps {
  shareId: string;
}

type ViewState =
  | { status: 'loading' }
  | { status: 'expired' }
  | { status: 'invalid' }
  | { status: 'error'; message: string }
  | {
      status: 'ok';
      title: string;
      itemTypeCode: string;
      fields: ItemData;
      favorite: boolean;
    };

/** 从 URL hash 中提取密钥 */
function extractKeyFromHash(): string | null {
  if (typeof window === 'undefined') return null;
  const hash = window.location.hash;
  if (!hash.startsWith('#k=')) return null;
  return hash.slice(3);
}

/** 字段行 */
function ShareFieldRow({ field, value }: { field: FieldConfig; value: string }) {
  const [show, setShow] = useState(false);
  const isPassword = field.type === 'password';
  const Icon = getFieldIcon(field.name);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(value);
      toast.success(`${field.label}已复制`);
    } catch {
      toast.error('复制失败');
    }
  };

  return (
    <div className="flex items-start gap-3 border-b border-border px-4 py-3 last:border-0">
      <Icon className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
      <div className="min-w-0 flex-1">
        <div className="text-xs text-muted-foreground">{field.label}</div>
        <div className="mt-0.5 break-all text-sm font-medium">
          {isPassword && !show ? '••••••••' : value}
        </div>
      </div>
      <div className="flex shrink-0 gap-1">
        {isPassword && (
          <button
            type="button"
            onClick={() => setShow((v) => !v)}
            className="text-muted-foreground hover:text-foreground"
            aria-label={show ? '隐藏' : '显示'}
          >
            {show ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
          </button>
        )}
        <button
          type="button"
          onClick={handleCopy}
          className="text-muted-foreground hover:text-foreground"
          aria-label={`复制${field.label}`}
        >
          <Copy className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}

export function ShareViewClient({ shareId }: ShareViewClientProps) {
  const [state, setState] = useState<ViewState>({ status: 'loading' });

  useEffect(() => {
    let cancelled = false;

    async function load() {
      const key = extractKeyFromHash();
      if (!key) {
        if (!cancelled) setState({ status: 'invalid' });
        return;
      }

      try {
        const res = await fetch(`/api/share/${shareId}`);
        if (res.status === 410) {
          if (!cancelled) setState({ status: 'expired' });
          return;
        }
        if (!res.ok) {
          const body = (await res.json().catch(() => null)) as { error?: string } | null;
          if (!cancelled) setState({ status: 'error', message: body?.error ?? '加载失败' });
          return;
        }

        const data = (await res.json()) as {
          encryptedTitle: string;
          encryptedData: string;
          itemTypeCode: string;
        };

        const title = await decryptShareData(key, data.encryptedTitle);
        const jsonStr = await decryptShareData(key, data.encryptedData);
        const parsed = JSON.parse(jsonStr) as {
          title: string;
          itemType: string;
          fields: ItemData;
          favorite: boolean;
        };

        if (!cancelled) {
          setState({
            status: 'ok',
            title: parsed.title,
            itemTypeCode: parsed.itemType,
            fields: parsed.fields,
            favorite: parsed.favorite,
          });
        }
      } catch {
        if (!cancelled) {
          setState({ status: 'error', message: '解密失败，链接可能已损坏' });
        }
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, [shareId]);

  const typeConfig = useMemo(
    () =>
      state.status === 'ok' ? getItemTypeConfigByCode(state.itemTypeCode) : undefined,
    [state],
  );

  if (state.status === 'loading') {
    return (
      <div className="flex min-h-screen items-center justify-center bg-muted/30">
        <div className="flex flex-col items-center gap-3 text-muted-foreground">
          <Loader2 className="h-8 w-8 animate-spin" />
          <p className="text-sm">正在解密共享内容…</p>
        </div>
      </div>
    );
  }

  if (state.status === 'expired') {
    return (
      <div className="flex min-h-screen items-center justify-center bg-muted/30 p-4">
        <Card className="w-full max-w-md">
          <CardContent className="flex flex-col items-center gap-3 p-8 text-center">
            <Link2Off className="h-10 w-10 text-muted-foreground" />
            <h1 className="text-lg font-semibold">此链接已失效</h1>
            <p className="text-sm text-muted-foreground">
              链接可能已过期或查看次数已用尽。请联系分享者重新生成链接。
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (state.status === 'invalid') {
    return (
      <div className="flex min-h-screen items-center justify-center bg-muted/30 p-4">
        <Card className="w-full max-w-md">
          <CardContent className="flex flex-col items-center gap-3 p-8 text-center">
            <ShieldAlert className="h-10 w-10 text-muted-foreground" />
            <h1 className="text-lg font-semibold">链接无效</h1>
            <p className="text-sm text-muted-foreground">
              链接缺少解密密钥，请确认完整链接已正确复制。
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (state.status === 'error') {
    return (
      <div className="flex min-h-screen items-center justify-center bg-muted/30 p-4">
        <Card className="w-full max-w-md">
          <CardContent className="flex flex-col items-center gap-3 p-8 text-center">
            <ShieldAlert className="h-10 w-10 text-muted-foreground" />
            <h1 className="text-lg font-semibold">无法查看</h1>
            <p className="text-sm text-muted-foreground">{state.message}</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  const TypeIcon = typeConfig?.icon ?? Lock;
  const fields = typeConfig?.fields ?? [];

  return (
    <div className="flex min-h-screen items-center justify-center bg-muted/30 p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="flex-row items-center gap-3 space-y-0">
          <TypeIcon className="h-6 w-6 shrink-0 text-primary" />
          <div className="min-w-0 flex-1">
            <h1 className="truncate text-base font-semibold">{state.title}</h1>
            <p className="text-xs text-muted-foreground">{typeConfig?.name ?? '条目'}</p>
          </div>
        </CardHeader>
        <CardContent className="px-0">
          {fields.map((field) => {
            const value = (state.fields as Record<string, string | undefined>)[field.name];
            if (!value) return null;
            return <ShareFieldRow key={field.name} field={field} value={value} />;
          })}
          <div className="flex items-center justify-center gap-1.5 px-4 py-4 text-xs text-muted-foreground">
            <Lock className="h-3 w-3" />
            <span>由 PassBox 端到端加密共享</span>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
