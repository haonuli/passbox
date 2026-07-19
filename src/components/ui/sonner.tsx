"use client"

import { useTheme } from "next-themes"
import { Toaster as Sonner } from "sonner"

type ToasterProps = React.ComponentProps<typeof Sonner>

const Toaster = ({ ...props }: ToasterProps) => {
  const { theme = "system" } = useTheme()

  return (
    <Sonner
      theme={theme as ToasterProps["theme"]}
      className="toaster group"
      position="top-center"
      // UX-040：Toast 持续时间分类（成功 3s / 警告 5s / 错误 7s）
      // sonner 默认 hover 暂停倒计时已启用（pauseOnHover）
      toastOptions={{
        duration: 4000,
        classNames: {
          toast:
            "group toast group-[.toaster]:bg-background group-[.toaster]:text-foreground group-[.toaster]:border-border group-[.toaster]:shadow-lg",
          description: "group-[.toast]:text-muted-foreground",
          actionButton:
            "group-[.toast]:bg-primary group-[.toast]:text-primary-foreground",
          cancelButton:
            "group-[.toast]:bg-muted group-[.toast]:text-muted-foreground",
        },
      }}
      {...props}
    />
  )
}

export { Toaster }

/**
 * UX-040：Toast 持续时间分类工具函数。
 *
 * 用法：toast.success('...', { duration: toastDuration.success })
 * 或直接使用便捷封装 toastSuccess/toastWarning/toastError。
 */
export const toastDuration = {
  success: 3000,
  warning: 5000,
  error: 7000,
  info: 4000,
} as const
