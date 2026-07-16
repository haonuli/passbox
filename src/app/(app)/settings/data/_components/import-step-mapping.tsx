/**
 * 导入向导 - 步骤 3：通用 CSV 列映射
 *
 * 仅 generic-csv 格式使用。用户手动将 CSV 列映射到 PassBox 字段。
 */
'use client';

import { useState, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { getCsvColumns } from '@/lib/import-export/parsers/generic-csv';
import { ITEM_TYPE_CONFIGS } from '@/lib/item-types';
import type { ColumnMapping } from '@/lib/import-export/types';
import { cn } from '@/lib/utils';

/** 可映射的目标字段 */
const TARGET_FIELDS = [
  { value: 'title', label: '标题' },
  { value: 'username', label: '用户名' },
  { value: 'password', label: '密码' },
  { value: 'url', label: '网址' },
  { value: 'notes', label: '备注' },
  { value: 'totpSecret', label: 'TOTP 密钥' },
] as const;

const selectClass = cn(
  'flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm',
  'focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring',
);

interface ImportStepMappingProps {
  csvContent: string;
  onComplete: (mappings: ColumnMapping[], itemType: string) => void;
  onBack: () => void;
}

export function ImportStepMapping({ csvContent, onComplete, onBack }: ImportStepMappingProps) {
  const columns = useMemo(() => getCsvColumns(csvContent), [csvContent]);
  const [mappings, setMappings] = useState<Record<string, string>>(() => {
    const initial: Record<string, string> = {};
    for (const col of columns) {
      initial[col] = '';
    }
    return initial;
  });
  const [itemType, setItemType] = useState('login');

  const titleMapped = Object.values(mappings).includes('title');

  const handleMappingChange = (csvColumn: string, targetField: string) => {
    setMappings((prev) => {
      const next = { ...prev };
      // 清除其他列中已映射到同一目标字段的值（避免多列映射到同一字段）
      if (targetField !== '') {
        for (const key of Object.keys(next)) {
          if (next[key] === targetField && key !== csvColumn) {
            next[key] = '';
          }
        }
      }
      next[csvColumn] = targetField;
      return next;
    });
  };

  const handleConfirm = () => {
    const result: ColumnMapping[] = columns.map((col) => ({
      csvColumn: col,
      targetField: mappings[col] || null,
    }));
    onComplete(result, itemType);
  };

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-sm font-semibold">列映射</h2>
        <p className="text-xs text-muted-foreground">将 CSV 列映射到 PassBox 字段，至少需要映射标题列</p>
      </div>

      <div className="space-y-2">
        {columns.map((col) => (
          <div key={col} className="flex items-center gap-3">
            <Label className="w-1/3 truncate text-xs" title={col}>
              {col}
            </Label>
            <select
              className={selectClass}
              value={mappings[col]}
              onChange={(e) => handleMappingChange(col, e.target.value)}
            >
              <option value="">（不映射）</option>
              {TARGET_FIELDS.map((field) => (
                <option key={field.value} value={field.value}>
                  {field.label}
                </option>
              ))}
            </select>
          </div>
        ))}
      </div>

      <div className="flex items-center gap-3">
        <Label className="text-xs">导入为类型</Label>
        <select
          className={cn(selectClass, 'max-w-[200px]')}
          value={itemType}
          onChange={(e) => setItemType(e.target.value)}
        >
          {ITEM_TYPE_CONFIGS.map((config) => (
            <option key={config.code} value={config.code}>
              {config.name}
            </option>
          ))}
        </select>
      </div>

      <div className="flex justify-between">
        <Button variant="outline" size="sm" onClick={onBack}>
          返回
        </Button>
        <Button size="sm" disabled={!titleMapped} onClick={handleConfirm}>
          确认映射
        </Button>
      </div>
    </div>
  );
}
