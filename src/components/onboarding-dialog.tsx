/**
 * 首次使用引导对话框 (UX-036)
 *
 * 首次登录后显示 3 步引导：
 *   1) 添加密码
 *   2) 使用生成器
 *   3) 查看安全中心
 *
 * 可跳过；完成后 localStorage 标记不再重复显示。
 */
'use client';

import { useState, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import {
  Check,
  ChevronRight,
  ChevronLeft,
  KeyRound,
  Wand2,
  ShieldCheck,
  Sparkles,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { cn } from '@/lib/utils';

const STORAGE_KEY = 'passbox:onboarding:completed';

/** 检查是否需要显示引导（仅客户端调用） */
export function shouldShowOnboarding(): boolean {
  if (typeof window === 'undefined') return false;
  return localStorage.getItem(STORAGE_KEY) !== '1';
}

/** 标记引导已完成（跳过或走完所有步骤） */
export function markOnboardingCompleted(): void {
  if (typeof window === 'undefined') return;
  localStorage.setItem(STORAGE_KEY, '1');
}

interface Step {
  icon: typeof KeyRound;
  title: string;
  description: string;
  cta: string;
  href: string;
}

const STEPS: Step[] = [
  {
    icon: KeyRound,
    title: '添加你的第一条密码',
    description: '点击侧边栏「+」或使用 ⌘N 快捷键新建条目。所有数据在本地加密后上传，服务器无法解密。',
    cta: '去添加密码',
    href: '/items/new',
  },
  {
    icon: Wand2,
    title: '使用密码生成器',
    description: '生成强随机密码，避免重复使用。在密码字段点击生成器图标，或访问生成器页面单独生成。',
    cta: '打开生成器',
    href: '/generator',
  },
  {
    icon: ShieldCheck,
    title: '查看安全中心',
    description: '安全中心会扫描弱密码、重复密码、过期密码及数据泄露记录，帮助你提升整体安全评分。',
    cta: '查看安全中心',
    href: '/security',
  },
];

interface OnboardingDialogProps {
  open: boolean;
  onClose: () => void;
}

export function OnboardingDialog({ open, onClose }: OnboardingDialogProps) {
  const router = useRouter();
  const [stepIndex, setStepIndex] = useState(0);

  const isLast = useMemo(() => stepIndex === STEPS.length - 1, [stepIndex]);
  const current = STEPS[stepIndex];
  const Icon = current.icon;

  const handleClose = () => {
    markOnboardingCompleted();
    onClose();
  };

  const handleSkip = () => {
    handleClose();
  };

  const handleNext = () => {
    if (isLast) {
      handleClose();
    } else {
      setStepIndex((i) => i + 1);
    }
  };

  const handlePrev = () => {
    if (stepIndex > 0) setStepIndex((i) => i - 1);
  };

  const handleCta = () => {
    handleClose();
    router.push(current.href);
  };

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) handleClose(); }}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-primary" />
            欢迎使用 Passbox
          </DialogTitle>
          <DialogDescription>
            快速上手 3 步，开始安全管理你的密码。
          </DialogDescription>
        </DialogHeader>

        {/* 步骤指示器 */}
        <div className="flex items-center gap-1.5">
          {STEPS.map((_, i) => (
            <div
              key={i}
              className={cn(
                'h-1.5 flex-1 rounded-full transition-colors',
                i <= stepIndex ? 'bg-primary' : 'bg-muted',
              )}
            />
          ))}
        </div>

        {/* 当前步骤内容 */}
        <div className="space-y-3 py-2">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
              <Icon className="h-5 w-5" />
            </div>
            <div className="flex-1">
              <div className="text-xs text-muted-foreground">步骤 {stepIndex + 1} / {STEPS.length}</div>
              <h3 className="text-sm font-semibold">{current.title}</h3>
            </div>
          </div>
          <p className="text-sm text-muted-foreground">{current.description}</p>
        </div>

        <DialogFooter className="flex-row items-center justify-between gap-2 sm:justify-between">
          <Button variant="ghost" size="sm" onClick={handleSkip} className="text-muted-foreground">
            跳过引导
          </Button>
          <div className="flex items-center gap-1.5">
            {stepIndex > 0 && (
              <Button variant="outline" size="sm" onClick={handlePrev}>
                <ChevronLeft className="mr-1 h-3.5 w-3.5" />
                上一步
              </Button>
            )}
            <Button variant="outline" size="sm" onClick={handleCta}>
              {current.cta}
            </Button>
            <Button size="sm" onClick={handleNext}>
              {isLast ? (
                <>
                  <Check className="mr-1 h-3.5 w-3.5" />
                  完成
                </>
              ) : (
                <>
                  下一步
                  <ChevronRight className="ml-1 h-3.5 w-3.5" />
                </>
              )}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
