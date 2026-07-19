/**
 * 密码输入组件 — 带显示/隐藏切换
 *
 * 在 login / unlock / register / recover 表单中复用，
 * 消除重复的 showPassword state + Eye/EyeOff toggle 模式。
 *
 * UX-002：支持 extraActions 在 Eye 按钮左侧插入额外操作（如密码生成器）。
 */
'use client';

import { useState, type ComponentPropsWithoutRef, type ReactNode } from 'react';
import { Eye, EyeOff } from 'lucide-react';
import { Input } from '@/components/ui/input';

interface PasswordInputProps extends Omit<ComponentPropsWithoutRef<typeof Input>, 'type'> {
  /** 是否显示密码，受控模式（可选）。不传则内部管理状态。 */
  show?: boolean;
  /** 切换显示/隐藏的回调（受控模式） */
  onToggleShow?: () => void;
  /** Eye 按钮左侧的额外操作节点（如密码生成器） */
  extraActions?: ReactNode;
}

export function PasswordInput({
  show: controlledShow,
  onToggleShow,
  extraActions,
  ...props
}: PasswordInputProps) {
  const [internalShow, setInternalShow] = useState(false);
  const isControlled = controlledShow !== undefined;
  const show = isControlled ? controlledShow : internalShow;

  const toggle = () => {
    if (isControlled) {
      onToggleShow?.();
    } else {
      setInternalShow((v) => !v);
    }
  };

  return (
    <div className="relative">
      <Input
        type={show ? 'text' : 'password'}
        className={extraActions ? 'pr-20' : 'pr-10'}
        {...props}
      />
      {extraActions && (
        <div className="absolute right-8 top-1/2 -translate-y-1/2 flex items-center">
          {extraActions}
        </div>
      )}
      <button
        type="button"
        onClick={toggle}
        className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
        tabIndex={-1}
        aria-label={show ? '隐藏密码' : '显示密码'}
      >
        {show ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
      </button>
    </div>
  );
}
