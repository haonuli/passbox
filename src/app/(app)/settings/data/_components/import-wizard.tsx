/**
 * 导入向导容器组件
 *
 * 管理导入步骤状态机，协调各子步骤组件的切换与数据传递。
 * 负责最终导入执行：客户端加密 + 批量 Server Action 调用。
 */
'use client';

import { useState, useCallback } from 'react';
import { Loader2, Upload } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { useVaultStore } from '@/stores/vault-store';
import { useAuthStore } from '@/stores/auth-store';
import { encrypt } from '@/lib/crypto/aes';
import { batchCreateItems, batchUpdateItems } from '@/actions/batch-item';
import { detectDuplicates, getItemTypeIdByCode } from '@/lib/import-export/normalize';
import { parseBrowserCsv } from '@/lib/import-export/parsers/browser-csv';
import { parseBitwardenCsv } from '@/lib/import-export/parsers/bitwarden-csv';
import { parseBitwardenJson } from '@/lib/import-export/parsers/bitwarden-json';
import { parseOnepasswordCsv } from '@/lib/import-export/parsers/onepassword-csv';
import { parseOnepassword1pux } from '@/lib/import-export/parsers/onepassword-1pux';
import { parseGenericCsv } from '@/lib/import-export/parsers/generic-csv';
import { toast } from 'sonner';
import type {
  ImportFormat,
  ImportItem,
  DuplicateMatch,
  ImportSummary,
  ColumnMapping,
  BatchCreateItemInput,
  BatchUpdateItemInput,
} from '@/lib/import-export/types';

import { ImportStepFormat } from './import-step-format';
import { ImportStepUpload } from './import-step-upload';
import { ImportStepMapping } from './import-step-mapping';
import { ImportStepPreview } from './import-step-preview';
import { ImportStepResult } from './import-step-result';

type Step = 'format' | 'upload' | 'mapping' | 'preview' | 'importing' | 'result';

const STEP_LABELS = ['选择格式', '上传文件', '列映射', '预览确认', '正在导入', '完成'] as const;
const BATCH_SIZE = 100;

export function ImportWizard() {
  const [step, setStep] = useState<Step>('format');
  const [selectedFormat, setSelectedFormat] = useState<ImportFormat | null>(null);
  const [csvContent, setCsvContent] = useState<string>('');
  const [duplicateMatches, setDuplicateMatches] = useState<DuplicateMatch[]>([]);
  const [importSummary, setImportSummary] = useState<ImportSummary | null>(null);
  // UX-033：导入过程进度反馈
  const [importProgress, setImportProgress] = useState<{ done: number; total: number } | null>(null);

  const items = useVaultStore((s) => s.items);
  const vaults = useVaultStore((s) => s.vaults);
  const symmetricKey = useAuthStore((s) => s.symmetricKey);

  const handleFormatSelect = (format: ImportFormat) => {
    setSelectedFormat(format);
    setStep('upload');
  };

  const parseFile = useCallback(
    async (content: string | ArrayBuffer, format: ImportFormat): Promise<ImportItem[]> => {
      switch (format) {
        case 'browser-csv':
          return parseBrowserCsv(content as string);
        case 'bitwarden-csv':
          return parseBitwardenCsv(content as string);
        case 'bitwarden-json':
          return parseBitwardenJson(content as string);
        case '1password-csv':
          return parseOnepasswordCsv(content as string);
        case '1password-1pux':
          return parseOnepassword1pux(content as ArrayBuffer);
        default:
          return [];
      }
    },
    [],
  );

  const handleFile = useCallback(
    async (content: string | ArrayBuffer) => {
      if (!selectedFormat) return;
      try {
        if (selectedFormat === 'generic-csv') {
          setCsvContent(content as string);
          setStep('mapping');
          return;
        }
        const parsed = await parseFile(content, selectedFormat);
        const matches = detectDuplicates(parsed, items);
        setDuplicateMatches(matches);
        setStep('preview');
      } catch (e) {
        toast.error(e instanceof Error ? e.message : '文件解析失败');
      }
    },
    [selectedFormat, items, parseFile],
  );

  const handleMappingComplete = (mappings: ColumnMapping[], itemType: string) => {
    try {
      const parsed = parseGenericCsv(csvContent, mappings, itemType);
      const matches = detectDuplicates(parsed, items);
      setDuplicateMatches(matches);
      setStep('preview');
    } catch (e) {
      toast.error(e instanceof Error ? e.message : '解析失败');
    }
  };

  const handleConfirmImport = useCallback(
    async (matches: DuplicateMatch[]) => {
      setStep('importing');
      // UX-033：初始化进度
      const totalToProcess = matches.filter((m) => m.action !== 'skip').length;
      setImportProgress({ done: 0, total: totalToProcess });

      const summary: ImportSummary = {
        total: matches.length,
        imported: 0,
        skipped: 0,
        overwritten: 0,
        failed: 0,
        errors: [],
      };

      if (!symmetricKey) {
        summary.errors.push('密码库未解锁，无法导入');
        setImportSummary(summary);
        setStep('result');
        setImportProgress(null);
        return;
      }

      const defaultVault = vaults[0];
      if (!defaultVault) {
        summary.errors.push('未找到可用的保险库');
        setImportSummary(summary);
        setStep('result');
        setImportProgress(null);
        return;
      }

      // 按操作分组
      const toImport: DuplicateMatch[] = [];
      const toOverwrite: DuplicateMatch[] = [];
      for (const match of matches) {
        if (match.action === 'skip') {
          summary.skipped++;
        } else if (match.action === 'import') {
          toImport.push(match);
        } else if (match.action === 'overwrite') {
          toOverwrite.push(match);
        }
      }

      let processed = 0;
      const updateProgress = (delta: number) => {
        processed += delta;
        setImportProgress({ done: processed, total: totalToProcess });
      };

      // 批量创建
      for (let i = 0; i < toImport.length; i += BATCH_SIZE) {
        const batch = toImport.slice(i, i + BATCH_SIZE);
        const inputs: BatchCreateItemInput[] = [];
        for (const match of batch) {
          try {
            const itemId = crypto.randomUUID();
            const itemTypeId = getItemTypeIdByCode(match.importItem.itemType);
            const titleAad = `item:${itemId}:title`;
            const dataAad = `item:${itemId}:data`;
            const titleEncrypted = await encrypt(symmetricKey, match.importItem.title, titleAad);
            const dataEncrypted = await encrypt(
              symmetricKey,
              JSON.stringify(match.importItem.fields),
              dataAad,
            );
            inputs.push({
              itemId,
              vaultId: defaultVault.id,
              itemTypeId,
              titleEncrypted,
              dataEncrypted,
              tagIds: [],
            });
          } catch {
            summary.failed++;
            summary.errors.push(`加密失败: ${match.importItem.title}`);
          }
        }
        if (inputs.length > 0) {
          const result = await batchCreateItems(inputs);
          if (result.ok) {
            summary.imported += result.data.created;
          } else {
            summary.failed += inputs.length;
            summary.errors.push(result.error);
          }
        }
        updateProgress(batch.length);
      }

      // 批量更新（覆盖）
      for (let i = 0; i < toOverwrite.length; i += BATCH_SIZE) {
        const batch = toOverwrite.slice(i, i + BATCH_SIZE);
        const inputs: BatchUpdateItemInput[] = [];
        for (const match of batch) {
          if (!match.existingItem) {
            summary.failed++;
            summary.errors.push(`未找到已有条目: ${match.importItem.title}`);
            continue;
          }
          try {
            const itemId = match.existingItem.id;
            const titleAad = `item:${itemId}:title`;
            const dataAad = `item:${itemId}:data`;
            const titleEncrypted = await encrypt(symmetricKey, match.importItem.title, titleAad);
            const dataEncrypted = await encrypt(
              symmetricKey,
              JSON.stringify(match.importItem.fields),
              dataAad,
            );
            inputs.push({ itemId, titleEncrypted, dataEncrypted });
          } catch {
            summary.failed++;
            summary.errors.push(`加密失败: ${match.importItem.title}`);
          }
        }
        if (inputs.length > 0) {
          const result = await batchUpdateItems(inputs);
          if (result.ok) {
            summary.overwritten += result.data.updated;
          } else {
            summary.failed += inputs.length;
            summary.errors.push(result.error);
          }
        }
        updateProgress(batch.length);
      }

      setImportSummary(summary);
      setStep('result');
      setImportProgress(null);
      toast.success(`导入完成：成功 ${summary.imported} 条，覆盖 ${summary.overwritten} 条`);
    },
    [symmetricKey, vaults],
  );

  const handleDone = () => {
    setStep('format');
    setSelectedFormat(null);
    setCsvContent('');
    setDuplicateMatches([]);
    setImportSummary(null);
    setImportProgress(null);
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Upload className="h-4 w-4" />
          导入数据
        </CardTitle>
        <CardDescription>从其他密码管理器或文件导入密码数据</CardDescription>
      </CardHeader>
      <CardContent>
        {/* 步骤进度指示器 */}
        <div className="mb-6 flex items-center gap-1">
          {STEP_LABELS.map((label, i) => {
            const stepOrder: Step[] = ['format', 'upload', 'mapping', 'preview', 'importing', 'result'];
            const isActive = stepOrder[i] === step;
            const isPast = stepOrder.indexOf(step) > i;
            return (
              <div key={label} className="flex flex-1 items-center gap-1">
                <div
                  className={cn(
                    'flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-medium',
                    isActive && 'bg-primary text-primary-foreground',
                    isPast && 'bg-primary/80 text-primary-foreground',
                    !isActive && !isPast && 'bg-muted text-muted-foreground',
                  )}
                >
                  {i + 1}
                </div>
                <span
                  className={cn(
                    'hidden text-xs sm:inline',
                    isActive ? 'font-medium text-foreground' : 'text-muted-foreground',
                  )}
                >
                  {label}
                </span>
                {i < STEP_LABELS.length - 1 && (
                  <div className={cn('h-px flex-1', isPast ? 'bg-primary/80' : 'bg-border')} />
                )}
              </div>
            );
          })}
        </div>

        {/* 步骤内容 */}
        {step === 'format' && <ImportStepFormat onSelect={handleFormatSelect} />}
        {step === 'upload' && selectedFormat && (
          <ImportStepUpload
            format={selectedFormat}
            onFile={handleFile}
            onBack={() => setStep('format')}
          />
        )}
        {step === 'mapping' && (
          <ImportStepMapping
            csvContent={csvContent}
            onComplete={handleMappingComplete}
            onBack={() => setStep('upload')}
          />
        )}
        {step === 'preview' && (
          <ImportStepPreview
            matches={duplicateMatches}
            onConfirm={handleConfirmImport}
            onBack={() => setStep(selectedFormat === 'generic-csv' ? 'mapping' : 'upload')}
          />
        )}
        {step === 'importing' && (
          <div className="flex flex-col items-center gap-4 py-8">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
            <div className="text-sm text-muted-foreground">
              正在导入数据，请稍候…
            </div>
            {/* UX-033：导入进度显示 */}
            {importProgress && (
              <div className="w-full max-w-sm space-y-1.5">
                <div className="flex items-center justify-between text-xs text-muted-foreground">
                  <span>已处理 {importProgress.done} / {importProgress.total} 条</span>
                  <span className="tabular-nums">
                    {importProgress.total > 0
                      ? `${Math.round((importProgress.done / importProgress.total) * 100)}%`
                      : '0%'}
                  </span>
                </div>
                <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
                  <div
                    className="h-full bg-primary transition-all"
                    style={{
                      width: `${importProgress.total > 0 ? (importProgress.done / importProgress.total) * 100 : 0}%`,
                    }}
                  />
                </div>
              </div>
            )}
          </div>
        )}
        {step === 'result' && importSummary && (
          <ImportStepResult summary={importSummary} onDone={handleDone} />
        )}
      </CardContent>
    </Card>
  );
}
