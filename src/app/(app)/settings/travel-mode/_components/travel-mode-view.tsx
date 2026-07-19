/**
 * 旅行模式设置组件
 *
 * 客户端组件，提供旅行模式的开启/关闭及保险库 travel_safe 标记管理。
 *
 * 流程：
 *   1. GET /api/travel-mode 获取旅行模式状态
 *   2. GET /api/vault 获取保险库列表（含 travel_safe 标记）
 *   3. 切换旅行模式 -> Dialog 输入主密码 -> 客户端派生 authHash -> POST /api/travel-mode
 *   4. 切换保险库 travel_safe -> PATCH /api/vaults/[id]
 */
'use client';

import { useEffect, useState } from 'react';
import { Plane, Shield } from 'lucide-react';
import { toast } from 'sonner';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useVaultStore } from '@/stores/vault-store';
import { VaultTravelSafeList } from './vault-travel-safe-list';
import { VerifyPasswordDialog } from './verify-password-dialog';

interface VaultTravelSafe {
  id: string;
  travelSafe: boolean;
}

export function TravelModeView() {
  const [travelMode, setTravelMode] = useState(false);
  const [loading, setLoading] = useState(true);
  const [vaultSafeMap, setVaultSafeMap] = useState<Map<string, boolean>>(new Map());
  const [dialogOpen, setDialogOpen] = useState(false);
  const [pendingEnable, setPendingEnable] = useState(false);

  const vaults = useVaultStore((s) => s.vaults);

  /** 拉取旅行模式状态 + 保险库 travel_safe 标记 */
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [modeRes, vaultRes] = await Promise.all([
          fetch('/api/travel-mode'),
          fetch('/api/vault'),
        ]);
        if (cancelled) return;
        if (modeRes.ok) {
          const data = await modeRes.json();
          if (!cancelled) setTravelMode(data.travelMode as boolean);
        }
        if (vaultRes.ok) {
          const data = await vaultRes.json();
          if (cancelled) return;
          const map = new Map<string, boolean>();
          for (const v of data.vaults as VaultTravelSafe[]) {
            map.set(v.id, v.travelSafe);
          }
          if (!cancelled) setVaultSafeMap(map);
        }
      } catch {
        if (!cancelled) toast.error('加载旅行模式数据失败');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  /** 打开主密码验证 Dialog */
  const handleToggleTravelMode = (enable: boolean) => {
    setPendingEnable(enable);
    setDialogOpen(true);
  };

  /** 切换保险库 travel_safe 标记 */
  const handleToggleVaultSafe = async (vaultId: string, checked: boolean) => {
    try {
      const res = await fetch(`/api/vaults/${vaultId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ travelSafe: checked }),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error ?? '更新失败');
      }
      setVaultSafeMap((prev) => {
        const next = new Map(prev);
        next.set(vaultId, checked);
        return next;
      });
      toast.success(checked ? '已标记为旅行安全' : '已取消旅行安全标记');
    } catch (e) {
      toast.error(e instanceof Error ? e.message : '更新失败，请稍后重试');
    }
  };

  return (
    <div className="flex h-full flex-col">
      <div className="border-b border-border px-4 py-3">
        <h1 className="flex items-center gap-2 text-base font-semibold">
          <Plane className="h-4 w-4" />
          旅行模式
        </h1>
      </div>
      <div className="flex-1 overflow-auto p-4">
        <div className="mx-auto max-w-2xl space-y-6">
          {/* 旅行模式开关 */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Shield className="h-4 w-4" />
                旅行模式
              </CardTitle>
              <CardDescription>
                开启旅行模式后，仅旅行安全的保险库可访问。过境时保护敏感数据。
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-sm">
                  <span className={travelMode ? 'font-medium text-success' : 'text-muted-foreground'}>
                    {loading ? '加载中...' : travelMode ? '已开启' : '已关闭'}
                  </span>
                  {travelMode && (
                    <span className="flex items-center gap-1 rounded-full bg-success/10 px-2 py-0.5 text-xs font-medium text-success">
                      <Plane className="h-3 w-3" />
                      旅行中
                    </span>
                  )}
                </div>
                <Button
                  variant={travelMode ? 'destructive' : 'default'}
                  size="sm"
                  disabled={loading}
                  onClick={() => handleToggleTravelMode(!travelMode)}
                >
                  {travelMode ? '关闭旅行模式' : '开启旅行模式'}
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* 保险库 travel_safe 标记 */}
          <VaultTravelSafeList
            vaults={vaults}
            vaultSafeMap={vaultSafeMap}
            travelMode={travelMode}
            onToggle={handleToggleVaultSafe}
          />
        </div>
      </div>

      {/* 主密码验证 Dialog */}
      <VerifyPasswordDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        pendingEnable={pendingEnable}
        onSuccess={() => setTravelMode(pendingEnable)}
      />
    </div>
  );
}
