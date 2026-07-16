/**
 * 导出区域组件
 *
 * 提供两种导出方式：
 *   - CSV 明文导出（需验证主密码）
 *   - 加密 JSON 备份（需主密码加密）
 *
 * 两种方式均通过 Dialog 输入主密码，验证通过后执行导出并下载。
 */
'use client';

import { useState, useCallback } from 'react';
import { FileText, Lock, Loader2, Download } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { PasswordInput } from '@/components/password-input';
import { useVaultStore } from '@/stores/vault-store';
import { useAuthStore } from '@/stores/auth-store';
import { deriveMasterKeyViaWorker } from '@/lib/crypto/kdf-worker-client';
import { buildKdfConfig } from '@/lib/crypto/kdf';
import { decryptSymmetricKey } from '@/lib/crypto/keys';
import { fromBase64, zeroFill } from '@/lib/crypto/encoding';
import { exportToCsv } from '@/lib/import-export/exporter-csv';
import { exportToEncryptedJson } from '@/lib/import-export/exporter-json';
import { toast } from 'sonner';

type ExportType = 'csv' | 'json';

function getDateString(): string {
  return new Date().toISOString().slice(0, 10);
}

function downloadBlob(content: string, filename: string, mimeType: string): void {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export function ExportSection() {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [exportType, setExportType] = useState<ExportType | null>(null);
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  const items = useVaultStore((s) => s.items);
  const encryptedKey = useAuthStore((s) => s.encryptedKey);
  const kdfSalt = useAuthStore((s) => s.kdfSalt);
  const kdfParams = useAuthStore((s) => s.kdfParams);

  const openDialog = (type: ExportType) => {
    setExportType(type);
    setPassword('');
    setDialogOpen(true);
  };

  const handleExport = useCallback(async () => {
    if (!exportType || !password) return;
    if (!encryptedKey || !kdfSalt || !kdfParams) {
      toast.error('加密参数缺失，请重新解锁');
      return;
    }

    setLoading(true);
    let masterKey: Uint8Array | null = null;

    try {
      // 1. 验证主密码
      const salt = fromBase64(kdfSalt);
      const kdfConfig = buildKdfConfig(salt, kdfParams);
      masterKey = await deriveMasterKeyViaWorker(password, kdfConfig);
      try {
        await decryptSymmetricKey(masterKey, encryptedKey);
      } catch {
        toast.error('主密码错误');
        return;
      }

      // 2. 执行导出
      if (exportType === 'csv') {
        const csvContent = exportToCsv(items);
        downloadBlob(csvContent, `passbox-export-${getDateString()}.csv`, 'text/csv;charset=utf-8');
        toast.success('CSV 导出成功');
      } else {
        const jsonContent = await exportToEncryptedJson(items, password, kdfSalt, kdfParams);
        downloadBlob(jsonContent, `passbox-backup-${getDateString()}.json`, 'application/json');
        toast.success('加密备份导出成功');
      }

      setDialogOpen(false);
      setPassword('');
    } catch (e) {
      toast.error(e instanceof Error ? e.message : '导出失败');
    } finally {
      zeroFill(masterKey);
      masterKey = null;
      setLoading(false);
    }
  }, [exportType, password, encryptedKey, kdfSalt, kdfParams, items]);

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle>导出数据</CardTitle>
          <CardDescription>将密码库中的数据导出到本地文件</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <button
              type="button"
              onClick={() => openDialog('csv')}
              className="flex flex-col items-start gap-2 rounded-lg border border-border p-4 text-left transition-colors hover:border-primary hover:bg-muted/50"
            >
              <FileText className="h-6 w-6 text-muted-foreground" />
              <div>
                <div className="text-sm font-medium">导出为 CSV</div>
                <div className="text-xs text-muted-foreground">明文 CSV，适用于数据迁移</div>
              </div>
            </button>

            <button
              type="button"
              onClick={() => openDialog('json')}
              className="flex flex-col items-start gap-2 rounded-lg border border-border p-4 text-left transition-colors hover:border-primary hover:bg-muted/50"
            >
              <Lock className="h-6 w-6 text-muted-foreground" />
              <div>
                <div className="text-sm font-medium">导出为加密备份</div>
                <div className="text-xs text-muted-foreground">加密 JSON，可恢复导入</div>
              </div>
            </button>
          </div>
        </CardContent>
      </Card>

      <Dialog open={dialogOpen} onOpenChange={(open) => !loading && setDialogOpen(open)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {exportType === 'csv' ? '导出为 CSV' : '导出为加密备份'}
            </DialogTitle>
            <DialogDescription>
              请输入主密码以验证身份并完成导出。
              {exportType === 'csv' && ' CSV 文件为明文格式，请妥善保管。'}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <PasswordInput
              placeholder="输入主密码"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && password && !loading) {
                  handleExport();
                }
              }}
            />
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setDialogOpen(false)}
              disabled={loading}
            >
              取消
            </Button>
            <Button onClick={handleExport} disabled={!password || loading}>
              {loading ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  导出中…
                </>
              ) : (
                <>
                  <Download className="h-4 w-4" />
                  确认导出
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
