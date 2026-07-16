/**
 * 导入向导 - 步骤 1：选择格式
 *
 * 提供 6 种导入格式卡片供用户选择。
 */
'use client';

import { Globe, Shield, FileJson, KeyRound, Archive, FileText, type LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { ImportFormat } from '@/lib/import-export/types';

interface FormatOption {
  value: ImportFormat;
  name: string;
  description: string;
  icon: LucideIcon;
}

const FORMAT_OPTIONS: FormatOption[] = [
  { value: 'browser-csv', name: '浏览器 CSV', description: 'Chrome / Edge / Firefox 导出', icon: Globe },
  { value: 'bitwarden-csv', name: 'Bitwarden CSV', description: 'Bitwarden CSV 格式导出', icon: Shield },
  { value: 'bitwarden-json', name: 'Bitwarden JSON', description: 'Bitwarden JSON 格式导出', icon: FileJson },
  { value: '1password-csv', name: '1Password CSV', description: '1Password CSV 格式导出', icon: KeyRound },
  { value: '1password-1pux', name: '1Password 1PUX', description: '1Password 1PUX 格式导出', icon: Archive },
  { value: 'generic-csv', name: '通用 CSV', description: '自定义列映射导入', icon: FileText },
];

interface ImportStepFormatProps {
  onSelect: (format: ImportFormat) => void;
}

export function ImportStepFormat({ onSelect }: ImportStepFormatProps) {
  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-sm font-semibold">选择导入来源</h2>
        <p className="text-xs text-muted-foreground">选择你的密码数据来源格式</p>
      </div>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        {FORMAT_OPTIONS.map((option) => {
          const Icon = option.icon;
          return (
            <button
              key={option.value}
              type="button"
              onClick={() => onSelect(option.value)}
              className={cn(
                'flex flex-col items-start gap-2 rounded-lg border border-border p-4 text-left transition-colors',
                'hover:border-primary hover:bg-muted/50',
              )}
            >
              <Icon className="h-6 w-6 text-muted-foreground" />
              <div className="space-y-0.5">
                <div className="text-sm font-medium">{option.name}</div>
                <div className="text-xs text-muted-foreground">{option.description}</div>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
