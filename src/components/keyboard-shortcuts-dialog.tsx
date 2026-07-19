/**
 * 键盘快捷键速查表对话框 (UX-001)
 *
 * 通过 `⌘/` 或 `Ctrl+/` 触发，列出 passbox 支持的全部快捷键。
 *
 * @see docs/UX_OPTIMIZATION.md UX-001 AC2
 */
'use client';

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { isMac } from '@/hooks/use-hotkey';

interface ShortcutItem {
  keys: string;
  description: string;
}

interface ShortcutGroup {
  title: string;
  items: ShortcutItem[];
}

function buildShortcutGroups(): ShortcutGroup[] {
  const mod = isMac() ? '⌘' : 'Ctrl';
  return [
    {
      title: '全局',
      items: [
        { keys: `${mod}+K`, description: '搜索条目' },
        { keys: `${mod}+N`, description: '新建条目' },
        { keys: `${mod}+L`, description: '锁定密码库' },
        { keys: `${mod}+/`, description: '显示快捷键速查表' },
      ],
    },
    {
      title: '列表',
      items: [
        { keys: '↑', description: '上移选中项' },
        { keys: '↓', description: '下移选中项' },
        { keys: 'Enter', description: '打开选中条目详情' },
        { keys: 'Esc', description: '取消选中 / 关闭面板' },
        { keys: 'Space', description: '多选当前项' },
      ],
    },
    {
      title: '详情',
      items: [
        { keys: `${mod}+E`, description: '编辑当前条目' },
      ],
    },
  ];
}

interface KeyboardShortcutsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function KeyboardShortcutsDialog({ open, onOpenChange }: KeyboardShortcutsDialogProps) {
  const groups = buildShortcutGroups();

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[80vh] overflow-auto">
        <DialogHeader>
          <DialogTitle>键盘快捷键</DialogTitle>
          <DialogDescription>
            passbox 支持的快捷键列表。macOS 使用 ⌘ 键，Windows/Linux 使用 Ctrl 键。
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-5">
          {groups.map((group) => (
            <div key={group.title}>
              <h3 className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                {group.title}
              </h3>
              <dl className="space-y-1.5">
                {group.items.map((item) => (
                  <div
                    key={item.description}
                    className="flex items-center justify-between text-sm"
                  >
                    <dt className="text-foreground">{item.description}</dt>
                    <dd>
                      <kbd className="rounded border border-border bg-muted px-2 py-0.5 font-mono text-xs text-foreground">
                        {item.keys}
                      </kbd>
                    </dd>
                  </div>
                ))}
              </dl>
            </div>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
}
