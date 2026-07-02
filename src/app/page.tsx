'use client';

import { toast } from 'sonner';

import { ThemeToggle } from '@/components/theme-toggle';
import { Button } from '@/components/ui/button';

export default function Home() {
  return (
    <div className="flex flex-col flex-1 bg-background">
      <header className="flex items-center justify-end px-6 py-4 border-b border-border">
        <ThemeToggle />
      </header>

      <main className="flex flex-1 flex-col items-center justify-center gap-8 px-6 py-16 text-center">
        <div className="flex flex-col items-center gap-4">
          <h1 className="text-4xl font-semibold tracking-tight text-foreground sm:text-5xl">
            passbox
          </h1>
          <p className="max-w-md text-base text-muted-foreground sm:text-lg">
            零知识密码管理器。端到端加密，只有你能解密自己的数据。
          </p>
        </div>

        <div className="flex flex-col gap-3 sm:flex-row">
          <Button asChild size="lg">
            <a href="/login">登录</a>
          </Button>
          <Button asChild size="lg" variant="outline">
            <a href="/register">创建账户</a>
          </Button>
          <Button
            size="lg"
            variant="secondary"
            onClick={() => toast.success('Toaster 已就绪', { description: '主题与通知系统工作正常' })}
          >
            测试通知
          </Button>
        </div>
      </main>
    </div>
  );
}
