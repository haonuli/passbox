/**
 * 密码生成器面板 (T5.1)
 *
 * 可配置长度、字符集、避免易混淆字符。
 * 生成结果实时显示并附带强度评估（T5.2 组件）。
 *
 * @see TASK_BREAKDOWN T5.1 验收标准
 */
'use client';

import { useState, useCallback } from 'react';
import { RefreshCw, Copy, Check } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import {
  generatePassword,
  DEFAULT_OPTIONS,
  MIN_PASSWORD_LENGTH,
  MAX_PASSWORD_LENGTH,
  type PasswordGeneratorOptions,
} from '@/lib/crypto/password-generator';
import { StrengthIndicator } from '@/components/common/strength-indicator';
import { useClipboard } from '@/hooks/use-clipboard';

export function GeneratorPanel() {
  const [options, setOptions] = useState<PasswordGeneratorOptions>(DEFAULT_OPTIONS);
  const [password, setPassword] = useState(() => {
    try {
      return generatePassword(DEFAULT_OPTIONS);
    } catch {
      return '';
    }
  });
  const { copy, copying } = useClipboard();
  const [copied, setCopied] = useState(false);

  const regenerate = useCallback(() => {
    try {
      setPassword(generatePassword(options));
      setCopied(false);
    } catch {
      toast.error('至少选择一种字符集');
    }
  }, [options]);

  // 选项变化时重新生成
  const handleOptionChange = useCallback(
    (key: keyof PasswordGeneratorOptions, value: boolean | number) => {
      setOptions((prev) => {
        const next = { ...prev, [key]: value };
        try {
          setPassword(generatePassword(next));
          setCopied(false);
        } catch {
          // 字符集全部关闭时不生成
        }
        return next;
      });
    },
    [],
  );

  const handleCopy = useCallback(async () => {
    await copy(password, 30, '密码');
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }, [password, copy]);

  const optionChecks: { key: keyof PasswordGeneratorOptions; label: string }[] = [
    { key: 'uppercase', label: '大写字母 (A-Z)' },
    { key: 'lowercase', label: '小写字母 (a-z)' },
    { key: 'digits', label: '数字 (0-9)' },
    { key: 'symbols', label: '符号 (!@#$...)' },
  ];

  return (
    <div className="mx-auto max-w-2xl space-y-6 p-4">
      {/* 密码显示 + 操作 */}
      <div className="space-y-2">
        <div className="flex items-center gap-2 rounded-md border border-input bg-background p-3">
          <code className="flex-1 break-all text-sm font-mono">{password || '—'}</code>
          <Button
            size="icon"
            variant="ghost"
            onClick={regenerate}
            aria-label="重新生成"
          >
            <RefreshCw className="h-4 w-4" />
          </Button>
          <Button
            size="icon"
            variant="ghost"
            onClick={handleCopy}
            disabled={!password || copying}
            aria-label="复制密码"
          >
            {copied ? <Check className="h-4 w-4 text-green-500" /> : <Copy className="h-4 w-4" />}
          </Button>
        </div>
        {password && <StrengthIndicator password={password} showSuggestions={false} />}
      </div>

      {/* 长度滑块 */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <Label>密码长度</Label>
          <span className="text-sm font-medium tabular-nums">{options.length}</span>
        </div>
        <input
          type="range"
          min={MIN_PASSWORD_LENGTH}
          max={MAX_PASSWORD_LENGTH}
          value={options.length}
          onChange={(e) => handleOptionChange('length', Number(e.target.value))}
          className="w-full accent-primary"
        />
        <div className="flex justify-between text-xs text-muted-foreground">
          <span>{MIN_PASSWORD_LENGTH}</span>
          <span>{MAX_PASSWORD_LENGTH}</span>
        </div>
      </div>

      {/* 字符集选项 */}
      <div className="space-y-3">
        <Label>字符集</Label>
        <div className="grid grid-cols-2 gap-3">
          {optionChecks.map(({ key, label }) => (
            <label
              key={key}
              className="flex items-center gap-2 cursor-pointer"
            >
              <Checkbox
                checked={options[key] as boolean}
                onCheckedChange={(v) => handleOptionChange(key, v === true)}
              />
              <span className="text-sm">{label}</span>
            </label>
          ))}
        </div>
      </div>

      {/* 避免易混淆字符 */}
      <label className="flex items-center gap-2 cursor-pointer">
        <Checkbox
          checked={options.avoidAmbiguous}
          onCheckedChange={(v) => handleOptionChange('avoidAmbiguous', v === true)}
        />
        <span className="text-sm">避免易混淆字符 (I/l/O/0/1)</span>
      </label>
    </div>
  );
}
