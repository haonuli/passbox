/**
 * 内联密码生成器（UX-002）
 *
 * 用于表单密码字段右侧的生成按钮，点击展开下拉面板：
 *   - 实时预览生成的密码
 *   - 可调整长度和字符集
 *   - 点击"使用此密码"填入字段
 *
 * 复用 password-generator.ts 的 generatePassword 逻辑。
 *
 * @see docs/UX_OPTIMIZATION.md UX-002
 */
'use client';

import { useState, useCallback, useRef, useEffect } from 'react';
import { Wand2, RefreshCw, Check } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import {
  generatePassword,
  DEFAULT_OPTIONS,
  MIN_PASSWORD_LENGTH,
  MAX_PASSWORD_LENGTH,
  type PasswordGeneratorOptions,
} from '@/lib/crypto/password-generator';
import { StrengthIndicator } from '@/components/common/strength-indicator';
import { cn } from '@/lib/utils';

interface PasswordGeneratorInlineProps {
  /** 用户点击"使用此密码"时回调，传入生成的密码 */
  onUse: (password: string) => void;
  /** 触发按钮的额外类名 */
  className?: string;
}

const OPTION_LABELS: { key: keyof PasswordGeneratorOptions; label: string }[] = [
  { key: 'uppercase', label: 'A-Z' },
  { key: 'lowercase', label: 'a-z' },
  { key: 'digits', label: '0-9' },
  { key: 'symbols', label: '!@#' },
];

export function PasswordGeneratorInline({ onUse, className }: PasswordGeneratorInlineProps) {
  const [open, setOpen] = useState(false);
  const [options, setOptions] = useState<PasswordGeneratorOptions>(DEFAULT_OPTIONS);
  const [password, setPassword] = useState(() => {
    try {
      return generatePassword(DEFAULT_OPTIONS);
    } catch {
      return '';
    }
  });
  const containerRef = useRef<HTMLDivElement>(null);

  // 点击外部关闭
  useEffect(() => {
    if (!open) return;
    const handlePointerDown = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handlePointerDown);
    return () => document.removeEventListener('mousedown', handlePointerDown);
  }, [open]);

  const regenerate = useCallback(() => {
    try {
      setPassword(generatePassword(options));
    } catch {
      toast.error('至少选择一种字符集');
    }
  }, [options]);

  const handleOptionChange = useCallback(
    (key: keyof PasswordGeneratorOptions, value: boolean | number) => {
      setOptions((prev) => {
        const next = { ...prev, [key]: value };
        try {
          setPassword(generatePassword(next));
        } catch {
          // 字符集全关时不生成
        }
        return next;
      });
    },
    [],
  );

  const handleUse = useCallback(() => {
    if (!password) return;
    onUse(password);
    setOpen(false);
  }, [password, onUse]);

  // 打开时重新生成一次（避免展示旧密码）
  const handleToggle = useCallback(() => {
    setOpen((prev) => {
      if (!prev) {
        try {
          setPassword(generatePassword(options));
        } catch {
          // 忽略
        }
      }
      return !prev;
    });
  }, [options]);

  return (
    <div className="relative" ref={containerRef}>
      <button
        type="button"
        onClick={handleToggle}
        className={cn(
          'inline-flex h-4 w-4 items-center justify-center text-muted-foreground hover:text-primary',
          open && 'text-primary',
          className,
        )}
        aria-label="生成密码"
        aria-expanded={open}
      >
        <Wand2 className="h-4 w-4" />
      </button>
      {open && (
        <div className="absolute right-0 top-full z-50 mt-1 w-80 rounded-md border border-border bg-popover p-3 shadow-md">
          {/* 密码预览 + 重新生成 */}
          <div className="mb-2 flex items-center gap-2 rounded-md border border-input bg-background p-2">
            <code className="flex-1 break-all text-xs font-mono">{password || '—'}</code>
            <Button
              size="icon"
              variant="ghost"
              onClick={regenerate}
              aria-label="重新生成"
              className="h-6 w-6 shrink-0"
            >
              <RefreshCw className="h-3 w-3" />
            </Button>
          </div>

          {password && <StrengthIndicator password={password} showSuggestions={false} />}

          {/* 长度滑块 */}
          <div className="mt-3 space-y-1">
            <div className="flex items-center justify-between">
              <span className="text-xs text-muted-foreground">长度</span>
              <span className="text-xs font-medium tabular-nums">{options.length}</span>
            </div>
            <input
              type="range"
              min={MIN_PASSWORD_LENGTH}
              max={MAX_PASSWORD_LENGTH}
              value={options.length}
              onChange={(e) => handleOptionChange('length', Number(e.target.value))}
              className="h-1 w-full accent-primary"
            />
          </div>

          {/* 字符集 */}
          <div className="mt-3 grid grid-cols-2 gap-2">
            {OPTION_LABELS.map(({ key, label }) => (
              <label key={key} className="flex cursor-pointer items-center gap-1.5">
                <Checkbox
                  checked={options[key] as boolean}
                  onCheckedChange={(v) => handleOptionChange(key, v === true)}
                  className="h-3.5 w-3.5"
                />
                <span className="text-xs">{label}</span>
              </label>
            ))}
          </div>

          {/* 避免易混淆 */}
          <label className="mt-2 flex cursor-pointer items-center gap-1.5">
            <Checkbox
              checked={options.avoidAmbiguous}
              onCheckedChange={(v) => handleOptionChange('avoidAmbiguous', v === true)}
              className="h-3.5 w-3.5"
            />
            <span className="text-xs">避免易混淆字符 (I/l/O/0)</span>
          </label>

          <Button
            onClick={handleUse}
            className="mt-3 w-full"
            size="sm"
            disabled={!password}
          >
            <Check className="mr-1 h-3 w-3" />
            使用此密码
          </Button>
        </div>
      )}
    </div>
  );
}
