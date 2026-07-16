/**
 * 导入向导 - 步骤 2：文件上传
 *
 * 拖拽区 + 文件选择器，支持文本与 ArrayBuffer（1PUX）两种读取模式。
 */
'use client';

import { useState, useRef, useCallback, type DragEvent } from 'react';
import { Upload, FileText } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import type { ImportFormat } from '@/lib/import-export/types';

/** 文件大小上限：10 MB */
const MAX_FILE_SIZE = 10 * 1024 * 1024;

const FORMAT_LABELS: Record<ImportFormat, string> = {
  'browser-csv': '浏览器 CSV',
  'bitwarden-csv': 'Bitwarden CSV',
  'bitwarden-json': 'Bitwarden JSON',
  '1password-csv': '1Password CSV',
  '1password-1pux': '1Password 1PUX',
  'generic-csv': '通用 CSV',
};

interface ImportStepUploadProps {
  format: ImportFormat;
  onFile: (content: string | ArrayBuffer, fileName: string) => void;
  onBack: () => void;
}

export function ImportStepUpload({ format, onFile, onBack }: ImportStepUploadProps) {
  const [isDragging, setIsDragging] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const readFile = useCallback(
    (file: File) => {
      setError(null);
      if (file.size > MAX_FILE_SIZE) {
        setError('文件大小不能超过 10MB');
        return;
      }
      const reader = new FileReader();
      reader.onload = () => {
        const result = reader.result;
        if (result !== null) {
          onFile(result, file.name);
        } else {
          setError('文件读取失败，请重试');
        }
      };
      reader.onerror = () => {
        setError('文件读取失败，请重试');
      };
      if (format === '1password-1pux') {
        reader.readAsArrayBuffer(file);
      } else {
        reader.readAsText(file);
      }
    },
    [format, onFile],
  );

  const handleDrop = useCallback(
    (e: DragEvent<HTMLDivElement>) => {
      e.preventDefault();
      setIsDragging(false);
      const file = e.dataTransfer.files[0];
      if (file) readFile(file);
    },
    [readFile],
  );

  const handleDragOver = useCallback((e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(false);
  }, []);

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-sm font-semibold">上传文件</h2>
        <p className="text-xs text-muted-foreground">
          当前格式：{FORMAT_LABELS[format]}
          {format === '1password-1pux' ? '（.1pux 文件）' : '（文本文件）'}
        </p>
      </div>

      <div
        onDrop={handleDrop}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onClick={() => inputRef.current?.click()}
        className={cn(
          'flex cursor-pointer flex-col items-center gap-2 rounded-lg border-2 border-dashed p-8 transition-colors',
          isDragging ? 'border-primary bg-muted/50' : 'border-border hover:border-primary/50',
        )}
      >
        <Upload className="h-8 w-8 text-muted-foreground" />
        <div className="text-sm font-medium">拖拽文件到此处或点击选择</div>
        <div className="text-xs text-muted-foreground">最大 10MB</div>
        <input
          ref={inputRef}
          type="file"
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) readFile(file);
          }}
        />
      </div>

      {error && (
        <div className="flex items-center gap-2 text-sm text-destructive">
          <FileText className="h-4 w-4" />
          {error}
        </div>
      )}

      <div className="flex justify-start">
        <Button variant="outline" size="sm" onClick={onBack}>
          返回
        </Button>
      </div>
    </div>
  );
}
