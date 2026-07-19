/**
 * 生成 SSH 密钥弹窗
 *
 * 支持 Ed25519（推荐）与 RSA 4096 两种算法，生成后展示公钥/私钥，
 * 可复制或保存到密码库。
 */
'use client';

import { useState, useCallback } from 'react';
import { Loader2, Check } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { generateEd25519KeyPair, generateRsaKeyPair } from '@/lib/ssh/ssh-utils';
import { cn } from '@/lib/utils';
import { GeneratedKeyResult } from './generated-key-result';
import type { SshKeySavePayload } from './use-save-ssh-key';

type KeyAlgorithm = 'ed25519' | 'rsa';

interface GenerateKeyDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  saving: boolean;
  onSave: (payload: SshKeySavePayload) => Promise<boolean>;
}

const ALGORITHM_OPTIONS: ReadonlyArray<{ value: KeyAlgorithm; label: string }> = [
  { value: 'ed25519', label: 'Ed25519（推荐）' },
  { value: 'rsa', label: 'RSA 4096' },
];

export function GenerateKeyDialog({
  open,
  onOpenChange,
  saving,
  onSave,
}: GenerateKeyDialogProps) {
  const [algorithm, setAlgorithm] = useState<KeyAlgorithm>('ed25519');
  const [comment, setComment] = useState('');
  const [generating, setGenerating] = useState(false);
  const [result, setResult] = useState<{
    publicKey: string;
    privateKey: string;
    keyType: string;
  } | null>(null);

  const handleOpenChange = useCallback(
    (next: boolean) => {
      if (!next) {
        setAlgorithm('ed25519');
        setComment('');
        setResult(null);
        setGenerating(false);
      }
      onOpenChange(next);
    },
    [onOpenChange],
  );

  const handleGenerate = useCallback(async () => {
    setGenerating(true);
    try {
      const c = comment.trim();
      const pair =
        algorithm === 'ed25519'
          ? await generateEd25519KeyPair(c)
          : await generateRsaKeyPair(c, 4096);
      setResult({
        publicKey: pair.publicKey,
        privateKey: pair.privateKey,
        keyType: pair.keyType,
      });
      toast.success('密钥已生成');
    } catch {
      toast.error('密钥生成失败，请稍后重试');
    } finally {
      setGenerating(false);
    }
  }, [algorithm, comment]);

  const handleSave = useCallback(async () => {
    if (!result) return;
    const hostname = comment.trim() || 'SSH Key';
    const payload: SshKeySavePayload = {
      title: hostname,
      data: {
        hostname,
        username: '',
        port: '22',
        keyType: result.keyType,
        publicKey: result.publicKey,
        privateKey: result.privateKey,
        passphrase: '',
        notes: '',
      },
    };
    const ok = await onSave(payload);
    if (ok) handleOpenChange(false);
  }, [result, comment, onSave, handleOpenChange]);

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>生成 SSH 密钥</DialogTitle>
          <DialogDescription>
            生成新的 SSH 密钥对，可选择保存到密码库。
          </DialogDescription>
        </DialogHeader>

        {!result ? (
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label>密钥类型</Label>
              <div className="flex gap-2">
                {ALGORITHM_OPTIONS.map((opt) => (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => setAlgorithm(opt.value)}
                    className={cn(
                      'flex-1 rounded-md border px-3 py-2 text-sm font-medium transition-colors',
                      algorithm === opt.value
                        ? 'border-primary bg-primary text-primary-foreground'
                        : 'border-border text-muted-foreground hover:bg-muted',
                    )}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="ssh-key-comment">注释</Label>
              <Input
                id="ssh-key-comment"
                placeholder="user@hostname（可选）"
                value={comment}
                onChange={(e) => setComment(e.target.value)}
              />
            </div>
          </div>
        ) : (
          <GeneratedKeyResult
            publicKey={result.publicKey}
            privateKey={result.privateKey}
          />
        )}

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => handleOpenChange(false)}
            disabled={generating || saving}
          >
            取消
          </Button>
          {!result ? (
            <Button onClick={handleGenerate} disabled={generating}>
              {generating && <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />}
              生成
            </Button>
          ) : (
            <Button onClick={handleSave} disabled={saving}>
              {saving && <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />}
              <Check className="mr-1.5 h-4 w-4" />
              保存到密码库
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
