'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { Paperclip, Download, Trash2, Loader2, FileIcon } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
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

const formatFileSize = (b: number): string =>
  b < 1024 ? `${b} B` : b < 1048576 ? `${(b / 1024).toFixed(1)} KB` : `${(b / 1048576).toFixed(1)} MB`;

export function AttachmentSection({ itemId }: { itemId: string }) {
  const symmetricKey = useAuthStore((s) => s.symmetricKey);
  const [attachments, setAttachments] = useState<AttachmentListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [downloadingId, setDownloadingId] = useState<string | null>(null);
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

  const handleFileSelect = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file || !symmetricKey) return;
      if (file.size > MAX_FILE_SIZE) {
        toast.error('文件大小不能超过 5MB');
        e.target.value = '';
        return;
      }
      if (attachments.length >= MAX_ATTACHMENTS) {
        toast.error(`每个条目最多 ${MAX_ATTACHMENTS} 个附件`);
        e.target.value = '';
        return;
      }
      setUploading(true);
      try {
        const aad = `item:${itemId}:attachment`;
        const arrayBuffer = await file.arrayBuffer();
        const [filenameEncrypted, mimeTypeEncrypted, dataEncrypted] = await Promise.all([
          encrypt(symmetricKey, file.name, aad),
          encrypt(symmetricKey, file.type || 'application/octet-stream', aad),
          encryptBytes(symmetricKey, new Uint8Array(arrayBuffer), aad),
        ]);
        const res = await fetch(`/api/items/${itemId}/attachments`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ filenameEncrypted, mimeTypeEncrypted, fileSize: file.size, dataEncrypted }),
        });
        if (!res.ok) throw new Error(((await res.json()) as { error?: string }).error ?? '上传失败');
        toast.success('附件上传成功');
        await refreshList();
      } catch (err) {
        toast.error(err instanceof Error ? err.message : '上传失败');
      } finally {
        setUploading(false);
        e.target.value = '';
      }
    },
    [symmetricKey, itemId, attachments.length, refreshList],
  );

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

  return (
    <div className="border-t border-border px-4 py-3">
      <div className="mb-2 flex items-center justify-between">
        <span className="text-xs font-medium text-muted-foreground">附件</span>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          onClick={() => fileInputRef.current?.click()}
          disabled={uploading || !symmetricKey}
          className="h-7 w-7"
          aria-label="上传附件"
        >
          {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Paperclip className="h-4 w-4" />}
        </Button>
        <input ref={fileInputRef} type="file" className="hidden" onChange={handleFileSelect} />
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-2">
          <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
        </div>
      ) : attachments.length === 0 ? (
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
                <button type="button" onClick={() => handleDownload(att.id)} disabled={downloadingId === att.id}
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
    </div>
  );
}
