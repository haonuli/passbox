/**
 * 落地页终端窗口 — 对齐 DESIGN.md code-editor-mockup
 *
 * 增强点（解决"黑窗口太空"问题）：
 * - 行号显示，模拟真实 IDE
 * - 轻量级语法高亮（关键字 / 字符串 / 注释 / 数字 / 函数名）
 * - 状态徽章（verified / encrypted / zero-knowledge）
 * - 可选输出区域（command + result），让终端"动起来"
 * - 光标闪烁，暗示"可交互"
 * - 复制按钮（hover 显示）
 */
'use client';

import { useState } from 'react';
import { Check, Copy } from 'lucide-react';

type TokenType = 'keyword' | 'string' | 'comment' | 'number' | 'fn' | 'punct' | 'plain';

interface Token {
  type: TokenType;
  value: string;
}

const KEYWORDS = new Set([
  'const', 'let', 'var', 'function', 'async', 'await', 'return', 'if', 'else',
  'for', 'while', 'import', 'export', 'from', 'new', 'class', 'typeof',
  'interface', 'type', 'enum', 'extends', 'implements', 'true', 'false', 'null',
  'undefined', 'void', 'this', 'super', 'yield', 'try', 'catch', 'throw',
]);

/** 简易 tokenizer — 处理注释、字符串、数字、标识符、标点 */
function tokenizeLine(line: string): Token[] {
  const tokens: Token[] = [];
  let i = 0;
  while (i < line.length) {
    const ch = line[i];

    // 注释 //...
    if (ch === '/' && line[i + 1] === '/') {
      tokens.push({ type: 'comment', value: line.slice(i) });
      break;
    }

    // 字符串 '...' "..." `...`
    if (ch === "'" || ch === '"' || ch === '`') {
      const quote = ch;
      let j = i + 1;
      while (j < line.length && line[j] !== quote) {
        if (line[j] === '\\') j++;
        j++;
      }
      tokens.push({ type: 'string', value: line.slice(i, Math.min(j + 1, line.length)) });
      i = j + 1;
      continue;
    }

    // 数字
    if (/[0-9]/.test(ch)) {
      let j = i;
      while (j < line.length && /[0-9a-zA-Z_.*]/.test(line[j])) j++;
      tokens.push({ type: 'number', value: line.slice(i, j) });
      i = j;
      continue;
    }

    // 标识符 / 关键字 / 函数名
    if (/[a-zA-Z_$]/.test(ch)) {
      let j = i;
      while (j < line.length && /[a-zA-Z0-9_$]/.test(line[j])) j++;
      const word = line.slice(i, j);
      // 函数名：后面跟 (
      let k = j;
      while (k < line.length && line[k] === ' ') k++;
      if (KEYWORDS.has(word)) {
        tokens.push({ type: 'keyword', value: word });
      } else if (line[k] === '(') {
        tokens.push({ type: 'fn', value: word });
      } else {
        tokens.push({ type: 'plain', value: word });
      }
      i = j;
      continue;
    }

    // 标点
    if (/[{}()[\];,:.<>+\-*/%=!&|?^~]/.test(ch)) {
      tokens.push({ type: 'punct', value: ch });
      i++;
      continue;
    }

    // 其他（空格等）
    let j = i;
    while (j < line.length && /\s/.test(line[j])) j++;
    tokens.push({ type: 'plain', value: line.slice(i, j) });
    i = j;
  }
  return tokens;
}

const TOKEN_CLASS: Record<TokenType, string> = {
  keyword: 'text-[#ff70b6]',     // 粉紫 - 关键字
  string: 'text-[#7ee787]',      // 绿 - 字符串
  comment: 'text-[#8b949e] italic', // 灰 - 注释
  number: 'text-[#f9cb28]',      // 琥珀 - 数字
  fn: 'text-[#79c0ff]',          // 蓝 - 函数名
  punct: 'text-[#c9d1d9]',       // 浅灰 - 标点
  plain: 'text-[#e6edf3]',       // 近白 - 普通
};

interface TerminalProps {
  /** 窗口标题，如 "client / encrypt.ts" */
  label: string;
  /** 代码内容 */
  code: string;
  /** 右上角状态徽章 */
  badge?: {
    text: string;
    color: 'green' | 'blue' | 'amber' | 'pink';
  };
  /** 可选的输出行（命令 + 结果），显示在代码下方 */
  output?: {
    command: string;
    result: string;
    status?: 'ok' | 'warn' | 'info';
  };
}

const BADGE_COLOR = {
  green: 'bg-[#238636]/20 text-[#7ee787] border-[#7ee787]/30',
  blue: 'bg-[#0070f3]/20 text-[#79c0ff] border-[#79c0ff]/30',
  amber: 'bg-[#f9cb28]/20 text-[#f9cb28] border-[#f9cb28]/30',
  pink: 'bg-[#ff0080]/20 text-[#ff70b6] border-[#ff70b6]/30',
};

const STATUS_ICON = {
  ok: '✓',
  warn: '!',
  info: '→',
};

const STATUS_COLOR = {
  ok: 'text-[#7ee787]',
  warn: 'text-[#f9cb28]',
  info: 'text-[#79c0ff]',
};

export function LandingTerminal({ label, code, badge, output }: TerminalProps) {
  const [copied, setCopied] = useState(false);
  const lines = code.split('\n');

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // 剪贴板不可用时静默
    }
  };

  return (
    <div className="terminal-mockup group">
      {/* 标题栏 — 三色点 + 文件名 + 状态徽章 + 复制按钮 */}
      <div className="terminal-mockup-header">
        <div className="terminal-mockup-dot" style={{ background: '#ff5f57' }} />
        <div className="terminal-mockup-dot" style={{ background: '#febc2e' }} />
        <div className="terminal-mockup-dot" style={{ background: '#28c840' }} />
        <span className="ml-2 font-mono text-xs text-muted-foreground">{label}</span>
        <div className="ml-auto flex items-center gap-2">
          {badge && (
            <span
              className={`rounded-xs border px-1.5 py-0.5 font-mono text-[10px] font-medium uppercase tracking-wider ${BADGE_COLOR[badge.color]}`}
            >
              {badge.text}
            </span>
          )}
          <button
            type="button"
            onClick={handleCopy}
            className="rounded-xs p-1 text-muted-foreground opacity-0 transition-opacity hover:bg-white/5 hover:text-foreground group-hover:opacity-100"
            aria-label="复制代码"
          >
            {copied ? (
              <Check className="h-3 w-3 text-[#7ee787]" />
            ) : (
              <Copy className="h-3 w-3" />
            )}
          </button>
        </div>
      </div>

      {/* 代码区 — 带行号 */}
      <div className="overflow-x-auto">
        <pre className="p-5 font-mono text-xs leading-[1.7]">
          <code>
            {lines.map((line, idx) => (
              <div key={idx} className="flex">
                <span
                  className="mr-4 inline-block w-6 select-none text-right text-[#484f58]"
                  aria-hidden
                >
                  {idx + 1}
                </span>
                <span className="flex-1 whitespace-pre">
                  {tokenizeLine(line).map((token, ti) => (
                    <span key={ti} className={TOKEN_CLASS[token.type]}>
                      {token.value}
                    </span>
                  ))}
                  {/* 最后一行加闪烁光标 */}
                  {idx === lines.length - 1 && (
                    <span className="cursor-blink ml-0.5 inline-block" />
                  )}
                </span>
              </div>
            ))}
          </code>
        </pre>
      </div>

      {/* 可选输出区 — 模拟"运行结果" */}
      {output && (
        <div className="border-t border-[#30363d] bg-[#0d1117]/60 p-5 font-mono text-xs leading-relaxed">
          <div className="flex items-center gap-2">
            <span className="text-[#7ee787]">$</span>
            <span className="text-[#e6edf3]">{output.command}</span>
          </div>
          <div className="mt-2 flex items-start gap-2">
            <span className={`${STATUS_COLOR[output.status ?? 'ok']} shrink-0`}>
              {STATUS_ICON[output.status ?? 'ok']}
            </span>
            <span className="text-muted-foreground">{output.result}</span>
          </div>
        </div>
      )}
    </div>
  );
}
