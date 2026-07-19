/**
 * 历史版本 Dialog 组件
 *
 * 左侧版本列表 + 右侧只读快照。客户端解密（AAD 与条目一致）。
 * 恢复时当前版本会自动保存为历史。状态与逻辑见 useItemHistory。
 */
'use client';

import { createElement, useState, useMemo } from 'react';
import { History, Loader2, RotateCcw, Clock, GitCompareArrows } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import { getFieldIcon } from '@/lib/item-types';
import { useItemHistory } from '@/hooks/use-item-history';
import { useVaultStore } from '@/stores/vault-store';

interface HistoryDialogProps {
  itemId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const formatTime = (iso: string): string => new Date(iso).toLocaleString('zh-CN');

function Spinner() {
  return (
    <div className="flex items-center justify-center py-8 text-muted-foreground">
      <Loader2 className="h-4 w-4 animate-spin" />
    </div>
  );
}

export function HistoryDialog({ itemId, open, onOpenChange }: HistoryDialogProps) {
  const {
    versions, loading, selectedId, selectedVersion, decrypting,
    decryptedData, restoring, fields, handleSelect, handleRestore,
  } = useItemHistory(itemId, open, onOpenChange);

  // UX-031：差异对比模式
  const [diffMode, setDiffMode] = useState(false);
  const currentItem = useVaultStore((s) => s.items.find((i) => i.id === itemId));

  // 计算字段差异
  const diffs = useMemo(() => {
    if (!decryptedData || !currentItem) return null;
    const oldData = decryptedData.fields;
    const newData = currentItem.data as Record<string, string | undefined>;
    const result: Array<{ key: string; label: string; oldValue?: string; newValue?: string; changed: boolean }> = [];
    for (const field of fields) {
      const oldValue = oldData[field.name];
      const newValue = newData[field.name];
      if (!oldValue && !newValue) continue;
      result.push({
        key: field.name,
        label: field.label,
        oldValue: oldValue || undefined,
        newValue: newValue || undefined,
        changed: oldValue !== newValue,
      });
    }
    // 标题差异单独处理
    return {
      titleDiff: {
        oldValue: decryptedData.title,
        newValue: currentItem.title,
        changed: decryptedData.title !== currentItem.title,
      },
      fields: result,
    };
  }, [decryptedData, currentItem, fields]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <History className="h-4 w-4" />
            历史版本
          </DialogTitle>
          <DialogDescription>
            查看与恢复条目的历史版本。恢复时当前版本会自动保存为历史。
          </DialogDescription>
        </DialogHeader>

        <div className="flex min-h-[280px] gap-4">
          {/* 左侧版本列表 */}
          <div className="w-44 shrink-0 overflow-auto border-r border-border pr-2">
            {loading ? (
              <Spinner />
            ) : versions.length === 0 ? (
              <div className="py-8 text-center text-xs text-muted-foreground">暂无历史版本</div>
            ) : (
              <ul className="space-y-1">
                {versions.map((v) => (
                  <li key={v.id}>
                    <button
                      type="button"
                      onClick={() => handleSelect(v.id)}
                      className={`flex w-full items-start gap-2 rounded-md px-2 py-1.5 text-left text-xs transition-colors ${
                        selectedId === v.id ? 'bg-accent text-accent-foreground' : 'hover:bg-accent/50'
                      }`}
                    >
                      <Clock className="mt-0.5 h-3 w-3 shrink-0 text-muted-foreground" />
                      <span className="break-all">{formatTime(v.createdAt)}</span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>

          {/* 右侧详情 */}
          <div className="flex-1 overflow-auto">
            {/* UX-031：差异对比切换按钮 */}
            {decryptedData && currentItem && (
              <div className="mb-2 flex justify-end">
                <Button
                  type="button"
                  size="sm"
                  variant={diffMode ? 'default' : 'outline'}
                  onClick={() => setDiffMode((v) => !v)}
                  className="h-7 px-2 text-xs"
                >
                  <GitCompareArrows className="mr-1 h-3 w-3" />
                  {diffMode ? '差异视图' : '完整视图'}
                </Button>
              </div>
            )}
            {decrypting ? (
              <Spinner />
            ) : decryptedData && selectedVersion ? (
              <div className="space-y-3">
                <div>
                  <div className="text-xs text-muted-foreground">标题</div>
                  {diffMode && diffs ? (
                    <div className="mt-0.5">
                      {diffs.titleDiff.changed ? (
                        <div className="space-y-0.5">
                          <div className="break-all rounded-sm bg-destructive/10 px-2 py-0.5 text-sm line-through text-destructive">
                            {diffs.titleDiff.oldValue}
                          </div>
                          <div className="break-all rounded-sm bg-success/10 px-2 py-0.5 text-sm text-success">
                            {diffs.titleDiff.newValue}
                          </div>
                        </div>
                      ) : (
                        <div className="mt-0.5 break-all text-sm font-medium">{decryptedData.title}</div>
                      )}
                    </div>
                  ) : (
                    <div className="mt-0.5 break-all text-sm font-medium">{decryptedData.title}</div>
                  )}
                  <div className="mt-1 text-xs text-muted-foreground">
                    {formatTime(selectedVersion.createdAt)}
                  </div>
                </div>
                <div className="border-t border-border pt-2">
                  {fields.length === 0 ? (
                    <div className="text-xs text-muted-foreground">无字段信息</div>
                  ) : (
                    fields.map((field) => {
                      const value = decryptedData.fields[field.name];
                      if (!value && (!diffMode || !diffs)) return null;
                      const diff = diffs?.fields.find((d) => d.key === field.name);
                      const changed = diff?.changed ?? false;
                      return (
                        <div key={field.name} className="flex items-start gap-2 border-b border-border py-2 last:border-0">
                          {createElement(getFieldIcon(field.name), { className: 'mt-0.5 h-3.5 w-3.5 shrink-0 text-muted-foreground' })}
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                              {field.label}
                              {diffMode && changed && (
                                <span className="rounded bg-warning/10 px-1 text-[10px] text-warning">
                                  已变更
                                </span>
                              )}
                            </div>
                            {diffMode && diff && changed ? (
                              <div className="mt-0.5 space-y-0.5">
                                <div className="break-all rounded-sm bg-destructive/10 px-2 py-0.5 text-xs line-through text-destructive">
                                  {field.type === 'password' ? '••••••••（旧）' : `${diff.oldValue ?? '（空）'}`}
                                </div>
                                <div className="break-all rounded-sm bg-success/10 px-2 py-0.5 text-xs text-success">
                                  {field.type === 'password' ? '••••••••（新）' : `${diff.newValue ?? '（空）'}`}
                                </div>
                              </div>
                            ) : (
                              <div className="mt-0.5 break-all text-sm">
                                {field.type === 'password' ? '••••••••' : value}
                              </div>
                            )}
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>
            ) : (
              <div className="flex h-full items-center justify-center py-8 text-xs text-muted-foreground">
                选择左侧版本查看详情
              </div>
            )}
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={restoring}>
            关闭
          </Button>
          <Button onClick={handleRestore} disabled={!selectedId || restoring || decrypting}>
            {restoring ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : <RotateCcw className="mr-1.5 h-4 w-4" />}
            恢复此版本
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
