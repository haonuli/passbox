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
import { RefreshCw, Copy, Check, History } from 'lucide-react';
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
import { useSettingsStore } from '@/stores/settings-store';

const HISTORY_STORAGE_KEY = 'passbox:generator:history';
const MAX_HISTORY = 10;

function loadHistory(): string[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = sessionStorage.getItem(HISTORY_STORAGE_KEY);
    if (!raw) return [];
    const arr = JSON.parse(raw) as unknown;
    return Array.isArray(arr) ? arr.filter((x): x is string => typeof x === 'string') : [];
  } catch {
    return [];
  }
}

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
  const clipboardClearSeconds = useSettingsStore((s) => s.clipboardClearSeconds);
  const [copied, setCopied] = useState(false);
  // UX-035：生成历史记录（仅当前会话）
  const [history, setHistory] = useState<string[]>(() => loadHistory());

  // 将新生成的密码加入历史
  const pushToHistory = useCallback((pwd: string) => {
    if (!pwd) return;
    setHistory((prev) => {
      // 去重：避免连续重复
      if (prev[0] === pwd) return prev;
      const next = [pwd, ...prev].slice(0, MAX_HISTORY);
      try {
        sessionStorage.setItem(HISTORY_STORAGE_KEY, JSON.stringify(next));
      } catch {
        // sessionStorage 不可用时忽略
      }
      return next;
    });
  }, []);

  const regenerate = useCallback(() => {
    try {
      const pwd = generatePassword(options);
      setPassword(pwd);
      setCopied(false);
      pushToHistory(pwd);
    } catch {
      toast.error('至少选择一种字符集');
    }
  }, [options, pushToHistory]);

  // 选项变化时重新生成
  const handleOptionChange = useCallback(
    (key: keyof PasswordGeneratorOptions, value: boolean | number) => {
      setOptions((prev) => {
        const next = { ...prev, [key]: value };
        try {
          const pwd = generatePassword(next);
          setPassword(pwd);
          setCopied(false);
          pushToHistory(pwd);
        } catch {
          // 字符集全部关闭时不生成
        }
        return next;
      });
    },
    [pushToHistory],
  );

  const handleCopy = useCallback(async () => {
    await copy(password, clipboardClearSeconds, '密码');
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }, [password, copy, clipboardClearSeconds]);

  // UX-035：点击历史项重新填入
  const handleHistoryClick = useCallback((pwd: string) => {
    setPassword(pwd);
    setCopied(false);
  }, []);

  // UX-035：清空历史
  const handleClearHistory = useCallback(() => {
    setHistory([]);
    try {
      sessionStorage.removeItem(HISTORY_STORAGE_KEY);
    } catch {
      // ignore
    }
  }, []);

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
        <div className="flex items-center gap-2 rounded-sm border border-input bg-background p-3 shadow-stack-1">
          <code className="flex-1 break-all font-mono text-sm">{password || '—'}</code>
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
            {copied ? <Check className="h-4 w-4 text-success" /> : <Copy className="h-4 w-4" />}
          </Button>
        </div>
        {password && <StrengthIndicator password={password} showSuggestions={false} />}
      </div>

      {/* 长度滑块 */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <Label htmlFor="generator-length">密码长度</Label>
          <span className="text-sm font-medium tabular-nums">{options.length}</span>
        </div>
        <input
          id="generator-length"
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
              htmlFor={`generator-charset-${key}`}
              className="flex items-center gap-2 cursor-pointer"
            >
              <Checkbox
                id={`generator-charset-${key}`}
                checked={options[key] as boolean}
                onCheckedChange={(v) => handleOptionChange(key, v === true)}
              />
              <span className="text-sm">{label}</span>
            </label>
          ))}
        </div>
      </div>

      {/* 避免易混淆字符 */}
      <label htmlFor="generator-avoid-ambiguous" className="flex items-center gap-2 cursor-pointer">
        <Checkbox
          id="generator-avoid-ambiguous"
          checked={options.avoidAmbiguous}
          onCheckedChange={(v) => handleOptionChange('avoidAmbiguous', v === true)}
        />
        <span className="text-sm">避免易混淆字符 (I/l/O/0/1)</span>
      </label>

      {/* UX-035：生成历史记录（仅当前会话，最多 10 条）*/}
      {history.length > 0 && (
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
              <History className="h-3.5 w-3.5" />
              最近生成（{history.length}）
            </div>
            <button
              type="button"
              onClick={handleClearHistory}
              className="text-xs text-muted-foreground hover:text-destructive"
            >
              清空
            </button>
          </div>
          <ul className="space-y-1">
            {history.map((pwd, idx) => (
              <li key={`${pwd}-${idx}`}>
                <button
                  type="button"
                  onClick={() => handleHistoryClick(pwd)}
                  className="flex w-full items-center gap-2 rounded-sm border border-border bg-background px-3 py-2 text-left transition-colors hover:bg-muted"
                  title="点击重新填入"
                >
                  <code className="flex-1 truncate font-mono text-xs">
                    {idx === 0 ? `${pwd.slice(0, 4)}${'•'.repeat(Math.max(0, pwd.length - 8))}${pwd.slice(-4)}` : pwd}
                  </code>
                  {idx === 0 && (
                    <span className="shrink-0 text-[10px] text-muted-foreground">最新</span>
                  )}
                </button>
              </li>
            ))}
          </ul>
          <p className="text-[10px] text-muted-foreground">
            历史仅保存在当前会话，关闭窗口后清除
          </p>
        </div>
      )}
    </div>
  );
}
