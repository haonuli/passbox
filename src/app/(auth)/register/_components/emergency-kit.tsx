/**
 * Emergency Kit 展示组件 (T3.5)
 *
 * 注册成功后展示恢复码 + 账户信息 + 风险提示，
 * 引导用户离线保存恢复码，确认后方可进入密码库。
 *
 * @see TECHNICAL_DESIGN.md 3.7 Emergency Kit
 */
'use client';

import { useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { Check, Copy, Download, AlertTriangle, ShieldCheck } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';

interface EmergencyKitProps {
  email: string;
  recoveryCode: string;
  registeredAt: string;
}

export function EmergencyKit({ email, recoveryCode, registeredAt }: EmergencyKitProps) {
  const router = useRouter();
  const [copied, setCopied] = useState(false);
  const [confirmed, setConfirmed] = useState(false);

  const handleCopy = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(recoveryCode);
      setCopied(true);
      toast.success('恢复码已复制到剪贴板');
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error('复制失败，请手动选择文本复制');
    }
  }, [recoveryCode]);

  const handleDownload = useCallback(() => {
    const date = new Date(registeredAt).toLocaleDateString('zh-CN');
    const html = generateEmergencyKitHtml(email, recoveryCode, date);
    const blob = new Blob([html], { type: 'text/html;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `passbox-emergency-kit-${new Date().toISOString().slice(0, 10)}.html`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    toast.success('Emergency Kit 已下载，请离线保存');
  }, [email, recoveryCode, registeredAt]);

  const handleEnterVault = useCallback(() => {
    router.push('/vault');
  }, [router]);

  return (
    <Card className="mx-auto w-full max-w-lg">
      <CardHeader className="space-y-2 text-center">
        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-green-500/10">
          <ShieldCheck className="h-6 w-6 text-green-500" />
        </div>
        <CardTitle className="text-xl">账户创建成功</CardTitle>
        <p className="text-sm text-muted-foreground">
          请妥善保存以下恢复码，它是您忘记主密码后找回数据的唯一途径。
        </p>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* 恢复码展示 */}
        <div className="space-y-2">
          <label className="text-sm font-medium">恢复码</label>
          <div className="flex items-center gap-2">
            <code
              className="flex-1 rounded-md border bg-muted px-4 py-3 text-center font-mono text-lg font-semibold tracking-wider select-all"
            >
              {recoveryCode}
            </code>
            <Button
              type="button"
              variant="outline"
              size="icon"
              onClick={handleCopy}
              aria-label="复制恢复码"
            >
              {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
            </Button>
          </div>
        </div>

        {/* 账户信息 */}
        <div className="space-y-1 rounded-md border bg-muted/50 p-4 text-sm">
          <div className="flex justify-between">
            <span className="text-muted-foreground">账户邮箱</span>
            <span className="font-medium">{email}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">注册日期</span>
            <span className="font-medium">
              {new Date(registeredAt).toLocaleDateString('zh-CN')}
            </span>
          </div>
        </div>

        {/* 风险提示 */}
        <div className="flex gap-3 rounded-md border border-yellow-500/30 bg-yellow-500/5 p-4">
          <AlertTriangle className="h-5 w-5 flex-shrink-0 text-yellow-500" />
          <div className="space-y-1 text-sm">
            <p className="font-medium text-yellow-600 dark:text-yellow-500">重要安全提示</p>
            <ul className="list-disc space-y-0.5 pl-4 text-muted-foreground">
              <li>恢复码仅显示一次，关闭此页面后将无法再次查看</li>
              <li>不要将恢复码存储在邮箱、云笔记等在线服务中</li>
              <li>建议离线保存：打印纸质副本或下载文件到本地</li>
              <li>恢复码泄露等同于数据泄露，请务必妥善保管</li>
            </ul>
          </div>
        </div>

        {/* 操作按钮 */}
        <div className="flex gap-3">
          <Button
            type="button"
            variant="outline"
            className="flex-1"
            onClick={handleDownload}
          >
            <Download className="mr-2 h-4 w-4" />
            下载 Emergency Kit
          </Button>
        </div>

        {/* 确认勾选 */}
        <div className="space-y-4">
          <label className="flex cursor-pointer items-start gap-3">
            <Checkbox
              checked={confirmed}
              onCheckedChange={(v) => setConfirmed(v === true)}
              className="mt-0.5"
            />
            <span className="text-sm text-muted-foreground">
              我已将恢复码安全保存到离线位置，了解丢失恢复码将无法找回数据
            </span>
          </label>

          <Button
            type="button"
            className="w-full"
            disabled={!confirmed}
            onClick={handleEnterVault}
          >
            进入密码库
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

/**
 * 生成 Emergency Kit 可打印 HTML 文件。
 * 用户下载后可用浏览器打开并打印为 PDF。
 */
function generateEmergencyKitHtml(email: string, recoveryCode: string, date: string): string {
  return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>passbox Emergency Kit</title>
<style>
  body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; max-width: 600px; margin: 40px auto; padding: 0 20px; color: #1a1a1a; }
  h1 { color: #6366f1; border-bottom: 2px solid #6366f1; padding-bottom: 10px; }
  .code { font-family: "SF Mono", Monaco, monospace; font-size: 28px; font-weight: bold; text-align: center; letter-spacing: 4px; padding: 24px; background: #f4f4f5; border-radius: 8px; margin: 20px 0; word-break: break-all; }
  .info { background: #f4f4f5; padding: 16px; border-radius: 8px; margin: 16px 0; }
  .info div { display: flex; justify-content: space-between; padding: 4px 0; }
  .warning { background: #fefce8; border: 1px solid #facc15; padding: 16px; border-radius: 8px; margin: 16px 0; }
  .warning h2 { color: #ca8a04; margin: 0 0 8px 0; font-size: 16px; }
  .warning ul { margin: 0; padding-left: 20px; color: #555; }
  .warning li { margin: 4px 0; font-size: 14px; }
  .footer { margin-top: 40px; padding-top: 16px; border-top: 1px solid #e4e4e7; color: #888; font-size: 12px; text-align: center; }
</style>
</head>
<body>
<h1>passbox Emergency Kit</h1>
<p>请妥善保管此文件。它是您忘记主密码后找回数据的唯一途径。</p>
<div class="code">${recoveryCode}</div>
<div class="info">
  <div><span>账户邮箱</span><strong>${email}</strong></div>
  <div><span>注册日期</span><strong>${date}</strong></div>
</div>
<div class="warning">
  <h2>⚠️ 重要安全提示</h2>
  <ul>
    <li>恢复码仅显示一次，丢失后无法重新生成</li>
    <li>不要将此文件存储在邮箱、云笔记等在线服务中</li>
    <li>建议打印纸质副本并保存在安全位置</li>
    <li>恢复码泄露等同于数据泄露</li>
  </ul>
</div>
<div class="footer">
  passbox · 零知识密码管理器 · ${date}
</div>
</body>
</html>`;
}
