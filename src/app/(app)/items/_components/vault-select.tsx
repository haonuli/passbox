/**
 * 保险库选择器组件 (T6.5)
 *
 * 用于条目表单中选择目标保险库。
 * 从 vault-store 读取解密后的保险库列表，渲染为下拉选择器。
 * 使用原生 <select> 元素，样式与 shadcn Input 保持一致。
 */
'use client';

import { ChevronDown } from 'lucide-react';
import { useVaultStore } from '@/stores/vault-store';
import { cn } from '@/lib/utils';

interface VaultSelectProps {
  /** 当前选中的保险库 ID */
  value: string;
  /** 选中变更回调 */
  onChange: (vaultId: string) => void;
  /** 是否禁用 */
  disabled?: boolean;
}

export function VaultSelect({ value, onChange, disabled }: VaultSelectProps) {
  const vaults = useVaultStore((s) => s.vaults);

  return (
    <div className="relative">
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        disabled={disabled || vaults.length === 0}
        className={cn(
          'flex h-9 w-full appearance-none rounded-md border border-input bg-transparent px-3 py-1 pr-8 text-sm shadow-sm transition-colors',
          'focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring',
          'disabled:cursor-not-allowed disabled:opacity-50',
        )}
      >
        {vaults.length === 0 ? (
          <option value="">无可用保险库</option>
        ) : (
          vaults.map((vault) => (
            <option key={vault.id} value={vault.id}>
              {vault.name}
            </option>
          ))
        )}
      </select>
      <ChevronDown className="pointer-events-none absolute right-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
    </div>
  );
}
