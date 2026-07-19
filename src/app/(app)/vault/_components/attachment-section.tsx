'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { Paperclip, Download, Trash2, Loader2, FileIcon, X, RotateCw, Eye } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { encrypt, decrypt, encryptBytes, decryptToBytes } from '@/lib/crypto/aes';
import { useAuthStore } from '@/stores/auth-store';
import type { EncryptedData } from '@/types/crypto';

const MAX_FILE_SIZE = 5 * 1024 * 1024;
const MAX_ATTACHMENTS = 10;

interface AttachmentListItem { id: string; fileSize: number; createdAt: string }

interface AttachmentDetail {
  filenameEncrypted: EncryptedData;
  mimeTypeEncrypted: EncryptedData;
  dataEncrypted: EncryptedData;
}

/** 上传任务状态（UX-010）：支持进度、取消、重试 */
interface UploadTask {
  status: 'encrypting' | 'uploading' | 'error';
  progress: number; // 0-100，仅 uploading 阶段有效
  error?: string;
  file: File;
  xhr: XMLHttpRequest | null;
}

const formatFileSize = (b: number): string =>
  b < 1024 ? `${b} B` : b < 1048576 ? `${(b / 1024).toFixed(1)} KB` : `${(b / 1048576).toFixed(1)} MB`;

export function AttachmentSection({ itemId }: { itemId: string }) {
  const symmetricKey = useAuthStore((s) => s.symmetricKey);
  const [attachments, setAttachments] = useState<AttachmentListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploadTask, setUploadTask] = useState<UploadTask | null>(null);
  const [downloadingId, setDownloadingId] = useState<string | null>(null);
  // UX-027：图片预览
  const [previewingId, setPreviewingId] = useState<string | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [previewName, setPreviewName] = useState<string>('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  const refreshList = useCallback(async () => {
    try {
      const res = await fetch(`/api/items/${itemId}/attachments`);
      if (!res.ok) throw new Error();
      setAttachments((await res.json()) as AttachmentListItem[]);
    } catch {
      toast.error('获取附件列表失败');
    } finally {
      setLoading(false);
    }
  }, [itemId]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`/api/items/${itemId}/attachments`);
        if (!res.ok) return;
        const data = (await res.json()) as AttachmentListItem[];
        if (!cancelled) { setAttachments(data); setLoading(false); }
      } catch {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [itemId]);

  // UX-010：基于 XHR 的上传，支持进度、取消、重试
  const uploadFile = useCallback(
    async (file: File) => {
      if (!symmetricKey) return;
      if (file.size > MAX_FILE_SIZE) {
        toast.error('文件大小不能超过 5MB');
        return;
      }
      if (attachments.length >= MAX_ATTACHMENTS) {
        toast.error(`每个条目最多 ${MAX_ATTACHMENTS} 个附件`);
        return;
      }
      setUploadTask({ status: 'encrypting', progress: 0, file, xhr: null });
      try {
        const aad = `item:${itemId}:attachment`;
        const arrayBuffer = await file.arrayBuffer();
        const [filenameEncrypted, mimeTypeEncrypted, dataEncrypted] = await Promise.all([
          encrypt(symmetricKey, file.name, aad),
          encrypt(symmetricKey, file.type || 'application/octet-stream', aad),
          encryptBytes(symmetricKey, new Uint8Array(arrayBuffer), aad),
        ]);
        const body = JSON.stringify({ filenameEncrypted, mimeTypeEncrypted, fileSize: file.size, dataEncrypted });

        const xhr = new XMLHttpRequest();
        xhr.open('POST', `/api/items/${itemId}/attachments`);
        xhr.setRequestHeader('Content-Type', 'application/json');

        setUploadTask({ status: 'uploading', progress: 0, file, xhr });

        xhr.upload.onprogress = (e) => {
          if (e.lengthComputable) {
            const pct = Math.round((e.loaded / e.total) * 100);
            setUploadTask((prev) => (prev ? { ...prev, progress: pct } : null));
          }
        };

        const cleanup = () => {
          xhr.upload.onprogress = null;
          xhr.onload = null;
          xhr.onerror = null;
          xhr.onabort = null;
        };

        xhr.onload = () => {
          cleanup();
          if (xhr.status >= 200 && xhr.status < 300) {
            toast.success('附件上传成功');
            setUploadTask(null);
            refreshList();
          } else {
            let msg = '上传失败';
            try { msg = ((JSON.parse(xhr.responseText) as { error?: string }).error) ?? msg; } catch { /* noop */ }
            setUploadTask((prev) => (prev ? { ...prev, status: 'error', error: msg, xhr: null } : null));
          }
        };
        xhr.onerror = () => {
          cleanup();
          setUploadTask((prev) => (prev ? { ...prev, status: 'error', error: '网络错误，请重试', xhr: null } : null));
        };
        xhr.onabort = () => {
          cleanup();
          setUploadTask(null);
        };

        xhr.send(body);
      } catch (err) {
        setUploadTask({
          status: 'error',
          progress: 0,
          error: err instanceof Error ? err.message : '加密失败',
          file,
          xhr: null,
        });
      }
    },
    [symmetricKey, itemId, attachments.length, refreshList],
  );

  const handleFileSelect = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      e.target.value = '';
      if (file) uploadFile(file);
    },
    [uploadFile],
  );

  // UX-010 AC4：取消上传
  const handleCancelUpload = useCallback(() => {
    uploadTask?.xhr?.abort();
    setUploadTask(null);
  }, [uploadTask]);

  // UX-010 AC2/AC3：重试上传（复用保留的文件引用）
  const handleRetryUpload = useCallback(() => {
    if (uploadTask?.file) uploadFile(uploadTask.file);
  }, [uploadTask, uploadFile]);

  const handleDownload = useCallback(
    async (attachmentId: string) => {
      if (!symmetricKey) return;
      setDownloadingId(attachmentId);
      try {
        const res = await fetch(`/api/attachments/${attachmentId}`);
        if (!res.ok) throw new Error('获取附件失败');
        const data = (await res.json()) as AttachmentDetail;
        const aad = `item:${itemId}:attachment`;
        const [filename, mimeType, bytes] = await Promise.all([
          decrypt(symmetricKey, data.filenameEncrypted, aad),
          decrypt(symmetricKey, data.mimeTypeEncrypted, aad),
          decryptToBytes(symmetricKey, data.dataEncrypted, aad),
        ]);
        // 拷贝到独立 ArrayBuffer，满足 BlobPart 类型约束（TS 5.7+ Uint8Array 含 SharedArrayBuffer）
        const buffer = new ArrayBuffer(bytes.byteLength);
        new Uint8Array(buffer).set(bytes);
        const blob = new Blob([buffer], { type: mimeType });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
      } catch {
        toast.error('下载附件失败');
      } finally {
        setDownloadingId(null);
      }
    },
    [symmetricKey, itemId],
  );

  // UX-027：图片预览（非图片类型回退为下载）
  const handlePreview = useCallback(
    async (attachmentId: string) => {
      if (!symmetricKey) return;
      setPreviewingId(attachmentId);
      try {
        const res = await fetch(`/api/attachments/${attachmentId}`);
        if (!res.ok) throw new Error('获取附件失败');
        const data = (await res.json()) as AttachmentDetail;
        const aad = `item:${itemId}:attachment`;
        const [filename, mimeType, bytes] = await Promise.all([
          decrypt(symmetricKey, data.filenameEncrypted, aad),
          decrypt(symmetricKey, data.mimeTypeEncrypted, aad),
          decryptToBytes(symmetricKey, data.dataEncrypted, aad),
        ]);
        if (!mimeType.startsWith('image/')) {
          // 非图片回退为下载
          toast.info('该附件类型不支持预览，已开始下载');
          const buffer = new ArrayBuffer(bytes.byteLength);
          new Uint8Array(buffer).set(bytes);
          const blob = new Blob([buffer], { type: mimeType });
          const url = URL.createObjectURL(blob);
          const a = document.createElement('a');
          a.href = url;
          a.download = filename;
          document.body.appendChild(a);
          a.click();
          document.body.removeChild(a);
          URL.revokeObjectURL(url);
          setPreviewingId(null);
          return;
        }
        const buffer = new ArrayBuffer(bytes.byteLength);
        new Uint8Array(buffer).set(bytes);
        const blob = new Blob([buffer], { type: mimeType });
        const url = URL.createObjectURL(blob);
        setPreviewUrl(url);
        setPreviewName(filename);
      } catch {
        toast.error('预览附件失败');
        setPreviewingId(null);
      }
    },
    [symmetricKey, itemId],
  );

  // 关闭预览并释放 object URL
  const handleClosePreview = useCallback(() => {
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setPreviewUrl(null);
    setPreviewName('');
    setPreviewingId(null);
  }, [previewUrl]);

  // 组件卸载时清理
  useEffect(() => {
    return () => {
      if (previewUrl) URL.revokeObjectURL(previewUrl);
    };
  }, [previewUrl]);

  const handleDelete = useCallback(
    async (attachmentId: string) => {
      try {
        const res = await fetch(`/api/attachments/${attachmentId}`, { method: 'DELETE' });
        if (!res.ok) throw new Error(((await res.json()) as { error?: string }).error ?? '删除失败');
        toast.success('附件已删除');
        await refreshList();
      } catch (err) {
        toast.error(err instanceof Error ? err.message : '删除失败');
      }
    },
    [refreshList],
  );

  const isUploading = uploadTask?.status === 'uploading' || uploadTask?.status === 'encrypting';

  return (
    <div className="border-t border-border px-4 py-3">
      <div className="mb-2 flex items-center justify-between">
        <span className="text-xs font-medium text-muted-foreground">附件</span>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          onClick={() => fileInputRef.current?.click()}
          disabled={isUploading || !symmetricKey}
          className="h-7 w-7"
          aria-label="上传附件"
        >
          {isUploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Paperclip className="h-4 w-4" />}
        </Button>
        <input ref={fileInputRef} type="file" className="hidden" onChange={handleFileSelect} />
      </div>

      {/* 上传进度 / 错误反馈（UX-010）*/}
      {uploadTask && (
        <div className="mb-2 rounded-md border border-border bg-muted/30 p-2">
          <div className="mb-1 flex items-center gap-2 text-xs">
            <span className="truncate text-muted-foreground">{uploadTask.file.name}</span>
            <span className="shrink-0 text-muted-foreground">{formatFileSize(uploadTask.file.size)}</span>
          </div>
          {uploadTask.status === 'encrypting' && (
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <Loader2 className="h-3 w-3 animate-spin" />
              正在加密…
            </div>
          )}
          {uploadTask.status === 'uploading' && (
            <div className="flex items-center gap-2">
              <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-muted">
                <div
                  className="h-full bg-primary transition-all"
                  style={{ width: `${uploadTask.progress}%` }}
                />
              </div>
              <span className="shrink-0 text-xs tabular-nums text-muted-foreground">{uploadTask.progress}%</span>
              <button
                type="button"
                onClick={handleCancelUpload}
                className="shrink-0 rounded p-1 text-muted-foreground hover:text-destructive"
                aria-label="取消上传"
              >
                <X className="h-3 w-3" />
              </button>
            </div>
          )}
          {uploadTask.status === 'error' && (
            <div className="flex items-center gap-2">
              <span className="flex-1 truncate text-xs text-destructive">{uploadTask.error}</span>
              <button
                type="button"
                onClick={handleRetryUpload}
                className="shrink-0 rounded p-1 text-muted-foreground hover:text-foreground"
                aria-label="重试上传"
              >
                <RotateCw className="h-3 w-3" />
              </button>
              <button
                type="button"
                onClick={handleCancelUpload}
                className="shrink-0 rounded p-1 text-muted-foreground hover:text-destructive"
                aria-label="取消上传"
              >
                <X className="h-3 w-3" />
              </button>
            </div>
          )}
        </div>
      )}

      {loading ? (
        <div className="flex items-center justify-center py-2">
          <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
        </div>
      ) : attachments.length === 0 && !uploadTask ? (
        <p className="text-xs text-muted-foreground">暂无附件</p>
      ) : (
        <ul className="space-y-1">
          {attachments.map((att) => (
            <li key={att.id} className="flex items-center gap-2 rounded-md px-2 py-1.5 hover:bg-muted/50">
              <FileIcon className="h-4 w-4 shrink-0 text-muted-foreground" />
              <div className="min-w-0 flex-1 text-xs text-muted-foreground">
                {formatFileSize(att.fileSize)} · {new Date(att.createdAt).toLocaleString('zh-CN')}
              </div>
              <div className="flex shrink-0 gap-1">
                <button type="button" onClick={() => handlePreview(att.id)} disabled={previewingId === att.id || downloadingId === att.id}
                  className="text-muted-foreground hover:text-foreground disabled:opacity-50" aria-label="预览">
                  {previewingId === att.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Eye className="h-4 w-4" />}
                </button>
                <button type="button" onClick={() => handleDownload(att.id)} disabled={downloadingId === att.id || previewingId === att.id}
                  className="text-muted-foreground hover:text-foreground disabled:opacity-50" aria-label="下载">
                  {downloadingId === att.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
                </button>
                <button type="button" onClick={() => handleDelete(att.id)}
                  className="text-muted-foreground hover:text-destructive" aria-label="删除">
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}

      {/* UX-027：图片预览弹窗 */}
      <Dialog open={previewUrl !== null} onOpenChange={(open) => { if (!open) handleClosePreview(); }}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle className="truncate">{previewName}</DialogTitle>
          </DialogHeader>
          {previewUrl && (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={previewUrl}
              alt={previewName}
              className="mx-auto max-h-[70vh] w-auto max-w-full object-contain"
            />
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
