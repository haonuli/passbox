/**
 * 新恢复码展示卡片（M-15 恢复码轮换）
 *
 * 恢复码重置成功后展示新恢复码，用户确认保存后方可进入密码库。
 */
'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { Check, Copy, AlertTriangle, ShieldCheck } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';

interface RecoveryCodeDisplayProps {
  recoveryCode: string;
}

export function RecoveryCodeDisplay({ recoveryCode }: RecoveryCodeDisplayProps) {
  const router = useRouter();
  const [confirmed, setConfirmed] = useState(false);
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(recoveryCode);
      setCopied(true);
      toast.success('新恢复码已复制到剪贴板');
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error('复制失败，请手动选择文本复制');
    }
  };

  return (
    <Card className="mx-auto w-full max-w-lg">
      <CardHeader className="space-y-2 text-center">
        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-green-500/10">
          <ShieldCheck className="h-6 w-6 text-green-500" />
        </div>
        <CardTitle className="text-xl">主密码重置成功</CardTitle>
        <CardDescription>
          您的密码库数据已完整保留。以下是新的恢复码，请务必重新保存。
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="space-y-2">
          <label className="text-sm font-medium">新恢复码</label>
          <div className="flex items-center gap-2">
            <code className="flex-1 rounded-md border bg-muted px-4 py-3 text-center font-mono text-lg font-semibold tracking-wider select-all">
              {recoveryCode}
            </code>
            <Button type="button" variant="outline" size="icon" onClick={handleCopy} aria-label="复制恢复码">
              {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
            </Button>
          </div>
        </div>

        <div className="flex gap-3 rounded-md border border-yellow-500/30 bg-yellow-500/5 p-4">
          <AlertTriangle className="h-5 w-5 flex-shrink-0 text-yellow-500" />
          <div className="space-y-1 text-sm">
            <p className="font-medium text-yellow-600 dark:text-yellow-500">重要提示</p>
            <ul className="list-disc space-y-0.5 pl-4 text-muted-foreground">
              <li>旧恢复码已失效，请使用此新恢复码</li>
              <li>新恢复码仅显示一次，关闭后无法再次查看</li>
              <li>建议离线保存：打印纸质副本或记录在安全位置</li>
            </ul>
          </div>
        </div>

        <label className="flex cursor-pointer items-start gap-3">
          <Checkbox checked={confirmed} onCheckedChange={(v) => setConfirmed(v === true)} className="mt-0.5" />
          <span className="text-sm text-muted-foreground">
            我已将新恢复码安全保存到离线位置
          </span>
        </label>

        <Button type="button" className="w-full" disabled={!confirmed} onClick={() => router.replace('/vault')}>
          进入密码库
        </Button>
      </CardContent>
    </Card>
  );
}
