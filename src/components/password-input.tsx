/**
 * 密码输入组件 — 带显示/隐藏切换
 *
 * 在 login / unlock / register / recover 表单中复用，
 * 消除重复的 showPassword state + Eye/EyeOff toggle 模式。
 */
'use client';

import { useState, type ComponentPropsWithoutRef } from 'react';
import { Eye, EyeOff } from 'lucide-react';
import { Input } from '@/components/ui/input';

interface PasswordInputProps extends Omit<ComponentPropsWithoutRef<typeof Input>, 'type'> {
  /** 是否显示密码，受控模式（可选）。不传则内部管理状态。 */
  show?: boolean;
  /** 切换显示/隐藏的回调（受控模式） */
  onToggleShow?: () => void;
}

export function PasswordInput({
  show: controlledShow,
  onToggleShow,
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
      <Input type={show ? 'text' : 'password'} className="pr-10" {...props} />
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
