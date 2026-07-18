/**
 * 生成密钥结果展示（公钥 + 私钥，可复制）
 */
'use client';

import { Copy } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { copyToClipboard } from '@/lib/security/clipboard';
import { cn } from '@/lib/utils';

const TEXTAREA_CLASS =
  'flex w-full resize-none rounded-md border border-input bg-background px-3 py-2 text-xs font-mono ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2';

interface GeneratedKeyResultProps {
  publicKey: string;
  privateKey: string;
}

export function GeneratedKeyResult({
  publicKey,
  privateKey,
}: GeneratedKeyResultProps) {
  const handleCopy = async (text: string, label: string) => {
    const ok = await copyToClipboard(text);
    if (ok) toast.success(`${label}已复制`);
    else toast.error('复制失败，请手动复制');
  };

  return (
    <div className="space-y-3 py-2">
      <div className="space-y-1.5">
        <div className="flex items-center justify-between">
          <Label>公钥</Label>
          <Button
            size="sm"
            variant="ghost"
            onClick={() => handleCopy(publicKey, '公钥')}
          >
            <Copy className="mr-1 h-3.5 w-3.5" />
            复制
          </Button>
        </div>
        <textarea
          readOnly
          className={cn(TEXTAREA_CLASS, 'min-h-[80px]')}
          value={publicKey}
        />
      </div>
      <div className="space-y-1.5">
        <div className="flex items-center justify-between">
          <Label>私钥</Label>
          <Button
            size="sm"
            variant="ghost"
            onClick={() => handleCopy(privateKey, '私钥')}
          >
            <Copy className="mr-1 h-3.5 w-3.5" />
            复制
          </Button>
        </div>
        <textarea
          readOnly
          className={cn(TEXTAREA_CLASS, 'min-h-[120px]')}
          value={privateKey}
        />
      </div>
    </div>
  );
}
