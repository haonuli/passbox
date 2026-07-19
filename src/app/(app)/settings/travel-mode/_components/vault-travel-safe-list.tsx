/**
 * 旅行安全保险库列表子组件
 *
 * 展示保险库列表及 travel_safe 标记 checkbox。
 * 旅行模式开启时禁用修改。
 */
'use client';

import { Lock } from 'lucide-react';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import type { DecryptedVault } from '@/types/vault';

interface VaultTravelSafeListProps {
  vaults: DecryptedVault[];
  vaultSafeMap: Map<string, boolean>;
  travelMode: boolean;
  onToggle: (vaultId: string, checked: boolean) => void;
}

export function VaultTravelSafeList({
  vaults,
  vaultSafeMap,
  travelMode,
  onToggle,
}: VaultTravelSafeListProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Lock className="h-4 w-4" />
          旅行安全保险库
        </CardTitle>
        <CardDescription>
          标记为旅行安全的保险库在旅行模式下仍可访问。旅行模式开启时无法修改标记，请先关闭。
        </CardDescription>
      </CardHeader>
      <CardContent>
        {vaults.length === 0 ? (
          <p className="text-sm text-muted-foreground">暂无保险库</p>
        ) : (
          <div className="space-y-2">
            {vaults.map((vault) => {
              const checked = vaultSafeMap.get(vault.id) ?? false;
              return (
                <label
                  key={vault.id}
                  className="flex items-center gap-3 rounded-md border border-border p-3 transition-colors hover:bg-muted/50"
                >
                  <Checkbox
                    checked={checked}
                    disabled={travelMode}
                    onCheckedChange={(v) => onToggle(vault.id, v === true)}
                  />
                  <span className="flex-1 text-sm font-medium">{vault.name}</span>
                  {checked && (
                    <span className="text-xs text-success">旅行安全</span>
                  )}
                </label>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
