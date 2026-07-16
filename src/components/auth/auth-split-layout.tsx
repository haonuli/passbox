/**
 * 认证页面左右分栏布局
 *
 * 左侧为品牌展示面板（md 以上显示），
 * 右侧为表单区域。
 * 用于登录/注册/恢复页面。
 */
import { AuthBrandPanel } from './auth-brand-panel';

interface AuthSplitLayoutProps {
  children: React.ReactNode;
}

export function AuthSplitLayout({ children }: AuthSplitLayoutProps) {
  return (
    <div className="flex min-h-screen">
      {/* 左侧品牌区（md 以上显示） */}
      <div className="hidden md:flex md:w-2/5 lg:w-2/5">
        <AuthBrandPanel />
      </div>

      {/* 右侧表单区 */}
      <div className="flex flex-1 items-center justify-center px-6 py-12 md:w-3/5 lg:w-3/5">
        {children}
      </div>
    </div>
  );
}
