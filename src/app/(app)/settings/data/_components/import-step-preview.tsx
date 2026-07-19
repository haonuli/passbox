/**
 * 导入向导 - 步骤 4：预览与选择
 *
 * 展示查重结果表格，用户可选择导入策略（新条目/覆盖/跳过）。
 */
'use client';

import { useState, useMemo } from 'react';
import { AlertTriangle, CheckCircle2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import type { DuplicateMatch } from '@/lib/import-export/types';

const selectClass = cn(
  'flex h-8 w-full rounded-md border border-input bg-transparent px-2 py-1 text-xs shadow-sm',
  'focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring',
);

const ACTION_LABELS: Record<DuplicateMatch['action'], string> = {
  import: '导入为新条目',
  overwrite: '覆盖已有',
  skip: '跳过',
};

interface ImportStepPreviewProps {
  matches: DuplicateMatch[];
  onConfirm: (matches: DuplicateMatch[]) => void;
  onBack: () => void;
}

export function ImportStepPreview({ matches, onConfirm, onBack }: ImportStepPreviewProps) {
  const [selected, setSelected] = useState<Set<number>>(() => {
    // 默认选中所有非跳过的条目
    const initial = new Set<number>();
    matches.forEach((m, i) => {
      if (m.action !== 'skip') initial.add(i);
    });
    return initial;
  });
  const [actions, setActions] = useState<Record<number, DuplicateMatch['action']>>(() => {
    const initial: Record<number, DuplicateMatch['action']> = {};
    matches.forEach((m, i) => {
      initial[i] = m.action;
    });
    return initial;
  });

  const duplicateCount = useMemo(() => matches.filter((m) => m.isDuplicate).length, [matches]);
  const newCount = matches.length - duplicateCount;

  const toggleSelect = (index: number) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(index)) {
        next.delete(index);
      } else {
        next.add(index);
      }
      return next;
    });
  };

  const toggleAll = () => {
    if (selected.size === matches.length) {
      setSelected(new Set());
    } else {
      setSelected(new Set(matches.map((_, i) => i)));
    }
  };

  const handleActionChange = (index: number, action: DuplicateMatch['action']) => {
    setActions((prev) => ({ ...prev, [index]: action }));
  };

  const handleConfirm = () => {
    const result: DuplicateMatch[] = [];
    for (const index of selected) {
      const match = matches[index];
      result.push({ ...match, action: actions[index] });
    }
    onConfirm(result);
  };

  const allSelected = selected.size === matches.length;

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-sm font-semibold">预览与确认</h2>
        <div className="flex gap-4 text-xs text-muted-foreground">
          <span>共 {matches.length} 条</span>
          <span>新条目 {newCount} 条</span>
          <span className="text-warning">重复 {duplicateCount} 条</span>
          <span>已选 {selected.size} 条</span>
        </div>
      </div>

      <div className="overflow-x-auto rounded-md border border-border">
        <table className="w-full text-xs">
          <thead className="bg-muted/50">
            <tr className="border-b border-border">
              <th className="p-2 text-left">
                <Checkbox checked={allSelected} onCheckedChange={toggleAll} />
              </th>
              <th className="p-2 text-left font-medium">标题</th>
              <th className="p-2 text-left font-medium">类型</th>
              <th className="p-2 text-left font-medium">用户名</th>
              <th className="p-2 text-left font-medium">URL</th>
              <th className="p-2 text-left font-medium">状态</th>
              <th className="p-2 text-left font-medium">操作</th>
            </tr>
          </thead>
          <tbody>
            {matches.map((match, index) => (
              <tr
                key={index}
                className={cn(
                  'border-b border-border last:border-0',
                  match.isDuplicate && 'bg-warning/5',
                )}
              >
                <td className="p-2">
                  <Checkbox
                    checked={selected.has(index)}
                    onCheckedChange={() => toggleSelect(index)}
                  />
                </td>
                <td className="max-w-[160px] truncate p-2" title={match.importItem.title}>
                  {match.importItem.title}
                </td>
                <td className="p-2 text-muted-foreground">{match.importItem.itemType}</td>
                <td className="max-w-[120px] truncate p-2 text-muted-foreground">
                  {match.importItem.fields.username ?? '-'}
                </td>
                <td className="max-w-[120px] truncate p-2 text-muted-foreground">
                  {match.importItem.fields.url ?? '-'}
                </td>
                <td className="p-2">
                  {match.isDuplicate ? (
                    <span className="flex items-center gap-1 text-warning">
                      <AlertTriangle className="h-3 w-3" />
                      重复
                    </span>
                  ) : (
                    <span className="flex items-center gap-1 text-success">
                      <CheckCircle2 className="h-3 w-3" />
                      新条目
                    </span>
                  )}
                </td>
                <td className="p-2">
                  <select
                    className={selectClass}
                    value={actions[index]}
                    onChange={(e) =>
                      handleActionChange(index, e.target.value as DuplicateMatch['action'])
                    }
                  >
                    <option value="import">{ACTION_LABELS.import}</option>
                    {match.isDuplicate && <option value="overwrite">{ACTION_LABELS.overwrite}</option>}
                    <option value="skip">{ACTION_LABELS.skip}</option>
                  </select>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="flex justify-between">
        <Button variant="outline" size="sm" onClick={onBack}>
          返回
        </Button>
        <Button size="sm" disabled={selected.size === 0} onClick={handleConfirm}>
          确认导入（{selected.size} 条）
        </Button>
      </div>
    </div>
  );
}
