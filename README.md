# Passbox

端到端加密的密码管理器，采用零知识架构——服务端永远无法接触用户的明文主密码和加密密钥。

## 功能特性

### 核心密码管理

- **端到端加密**：AES-256-GCM 对称加密，Argon2id 密钥派生，密钥永不离开客户端
- **16 种条目类型**：登录凭证、安全笔记、信用卡、身份信息、密码、软件许可证、银行账户、路由器、服务器、数据库、API 密钥、加密钱包、驾驶证、护照、会员卡、积分计划
- **保险库管理**：多保险库支持，名称客户端 AES-256-GCM 加密（AAD=`passbox:vault-name:v1`）
- **标签分类**：标签管理 + 智能文件夹（保存的搜索条件）
- **批量操作**：批量移动、批量删除、批量打标签
- **条目历史**：版本快照与差异对比，支持回滚
- **文件附件**：条目内附加文件，加密存储
- **回收站**：软删除 30 天保留期，支持一键恢复

### 认证与安全

- **SRP 协议**：Secure Remote Password 完成主密码验证，服务端不存密码
- **双因素认证 (2FA)**：TOTP 动态验证码，支持备用恢复码
- **紧急恢复**：应急密钥 (Emergency Kit) 机制，可通过恢复码重置主密码
- **自动锁定**：空闲超时自动锁定保险库
- **旅行模式**：仅暴露旅行安全的子集保险库，过境时保护敏感数据
- **安全检测**：密码强度评估（zxcvbn）、重复密码检测、数据泄露检查、过期提醒

### 浏览器扩展

- **自动填充**：检测登录表单并自动填充凭证
- **身份信息识别**：自动识别并填充地址、信用卡、身份信息表单
- **字段图标**：识别 PassBox 可填充字段并显示图标
- **自动保存**：检测新提交的凭证并提示保存
- **填充确认覆盖层**：敏感字段填充前需用户确认

### 数据与导入导出

- **密码生成器**：可定制长度和字符集，含内联生成器
- **CSV / JSON 导入导出**：兼容 1Password / Bitwarden / Chrome 等格式
- **SSH 密钥管理**：生成、导入、存储 SSH 密钥
- **PWA 离线支持**：可安装为桌面/移动应用

### 用户体验

- **快捷键**：全局快捷键面板，常用操作一键触达
- **首次引导**：新手引导对话框
- **流式加载**：Next.js Loading 骨架屏，提升感知性能
- **暗色模式**：跟随系统主题

## 技术栈

| 分类 | 技术 |
|------|------|
| 框架 | Next.js 16 (App Router) |
| 语言 | TypeScript (严格模式) |
| 样式 | Tailwind CSS v3 |
| UI 组件 | shadcn/ui + Radix UI |
| 数据库 | PostgreSQL |
| 加密 | libsodium (Argon2id) + Web Crypto API (AES-256-GCM) |
| 状态管理 | Zustand |
| 表单 | React Hook Form + Zod |
| 测试 | Vitest (单元) + Playwright (E2E) |
| 浏览器扩展 | Vite + @crxjs/vite-plugin (Manifest V3) |
| 部署 | Vercel |

## 项目结构

```
passbox/
├── src/
│   ├── app/                        # Next.js App Router
│   │   ├── (app)/                 # 应用页面（需认证）
│   │   │   ├── vault/             # 保险库主界面
│   │   │   ├── trash/              # 回收站（顶级路由）
│   │   │   ├── generator/          # 密码生成器
│   │   │   ├── security/           # 安全中心
│   │   │   ├── unlock/            # 解锁保险库
│   │   │   └── settings/           # 设置
│   │   │       ├── about/          # 关于
│   │   │       ├── data/           # 数据导入导出
│   │   │       ├── help/           # 帮助
│   │   │       ├── preferences/    # 偏好设置
│   │   │       ├── security/       # 安全设置（2FA）
│   │   │       ├── shares/         # 分享管理
│   │   │       ├── ssh-keys/       # SSH 密钥
│   │   │       └── travel-mode/    # 旅行模式
│   │   ├── (auth)/                 # 认证页面
│   │   │   ├── login/              # 登录
│   │   │   ├── register/           # 注册
│   │   │   └── recover/            # 账户恢复
│   │   ├── _components/            # Landing 页面组件
│   │   ├── api/                    # API 路由
│   │   ├── layout.tsx              # 根布局
│   │   └── page.tsx                # 首页
│   ├── actions/                    # Server Actions
│   ├── components/                 # 共享组件
│   │   ├── layout/                 # 应用 Shell（侧边栏、保险库/标签管理）
│   │   ├── ui/                     # shadcn/ui 基础组件（勿手动修改）
│   │   └── ...
│   ├── hooks/                      # 自定义 Hooks
│   ├── lib/                        # 核心库
│   │   ├── crypto/                 # 加密模块（KDF、AES、TOTP 等）
│   │   ├── security/               # 安全检测（泄露、重复、过期）
│   │   ├── import-export/          # CSV/JSON 导入导出
│   │   ├── api-log.ts              # API 审计日志
│   │   ├── rate-limit.ts           # 限流中间件
│   │   ├── trash.ts                # 回收站逻辑
│   │   ├── session.ts              # 会话管理
│   │   └── db.ts                   # PostgreSQL 连接池
│   ├── stores/                     # Zustand 状态管理
│   ├── types/                      # 类型定义
│   └── middleware.ts               # 路由中间件
├── extension/                      # 浏览器扩展（Manifest V3）
│   ├── src/
│   │   ├── background/             # Service Worker
│   │   ├── content/                # Content Scripts
│   │   ├── popup/                  # 弹出窗口 UI
│   │   └── lib/                    # 扩展本地工具
│   ├── manifest.json
│   └── vite.config.ts
├── tests/                          # 集成测试
├── public/                         # 静态资源
├── tailwind.config.ts
└── DESIGN.md                       # 设计系统规范
```

## 快速开始

### 环境要求

- Node.js 20+
- PostgreSQL 14+

### 安装

```bash
# 克隆仓库
git clone https://github.com/haonuli/passbox.git
cd passbox

# 安装依赖
npm install
```

### 环境变量配置

```bash
# 复制环境变量模板
cp .env.example .env.local
```

编辑 `.env.local` 填入真实值：

```env
# PostgreSQL 连接串
DATABASE_URL="postgresql://user:password@localhost:5432/passbox"

# JWT 会话签名密钥（生产环境务必使用高强度随机串）
# 生成方式：openssl rand -base64 32
JWT_SECRET="your-strong-secret-here"
```

### 数据库初始化

```bash
# 执行迁移脚本（建表 + 索引 + 触发器 + 预置数据）
npm run migrate
```

### 启动开发服务器

```bash
npm run dev
```

打开 http://localhost:3000 即可访问。

## 浏览器扩展

### 构建

```bash
cd extension
npm install
npm run build      # 生产构建（host_permissions 放开为 <all_urls>）
# 或
npm run dev        # 开发模式（host_permissions 仅限 localhost:3000）
```

### 安装

1. 运行 `npm run build` 后，扩展产物输出到 `extension/dist/`
2. 打开 Chrome / Edge，访问 `chrome://extensions/`
3. 开启「开发者模式」
4. 点击「加载已解压的扩展程序」，选择 `extension/dist/` 目录
5. 点击扩展图标登录 PassBox 账户即可使用

### 扩展权限说明

| 权限 | 用途 |
|------|------|
| `storage` | 缓存解密后的保险库数据 |
| `activeTab` / `scripting` | 注入 content script 检测表单 |
| `cookies` | 维持与 PassBox 服务的会话 |
| `notifications` | 自动保存提示 |
| `alarms` | 缓存过期清理 |

开发模式 host_permissions 仅限 `http://localhost:3000/*`，生产模式放开为 `<all_urls>` 以支持任意网站自动填充。可通过环境变量 `EXT_HOST_PERMISSIONS` 覆盖。

## 常用脚本

### 主应用

| 命令 | 说明 |
|------|------|
| `npm run dev` | 启动开发服务器 |
| `npm run build` | 生产构建 |
| `npm run start` | 启动生产服务器 |
| `npm run lint` | ESLint 代码检查 |
| `npm run typecheck` | TypeScript 类型检查 |
| `npm run migrate` | 执行数据库迁移 |

### 测试

| 命令 | 说明 |
|------|------|
| `npm run test` | 运行单元测试 |
| `npm run test:watch` | 单元测试（监听模式） |
| `npm run test:coverage` | 单元测试（含覆盖率） |
| `npm run test:crypto` | 仅运行加密模块测试 |
| `npm run test:e2e` | 运行 Playwright E2E 测试 |
| `npm run test:e2e:ui` | E2E 测试 UI 模式 |
| `npm run test:db:setup` | 初始化测试数据库 |

### 浏览器扩展

| 命令 | 说明 |
|------|------|
| `npm run dev` (extension/) | 扩展开发模式 |
| `npm run build` (extension/) | 扩展生产构建 |
| `npm run typecheck` (extension/) | 扩展类型检查 |

## 部署

### Vercel 部署（推荐）

1. **准备数据库**

   在 [Neon](https://neon.tech)、[Supabase](https://supabase.com) 或其他 PostgreSQL 服务商创建数据库实例，获取连接串。

2. **导入项目**

   - 前往 [Vercel](https://vercel.com/new)
   - 选择 Import Git Repository，导入 `haonuli/passbox` 仓库
   - Framework Preset 选择 Next.js

3. **配置环境变量**

   在 Vercel 项目设置中添加：

   | Key | Value |
   |-----|-------|
   | `DATABASE_URL` | 你的 PostgreSQL 连接串 |
   | `JWT_SECRET` | `openssl rand -base64 32` 生成的随机串 |

4. **执行数据库迁移**

   首次部署前，在本地使用生产数据库连接串运行迁移：

   ```bash
   DATABASE_URL="你的生产数据库连接串" npm run migrate
   ```

5. **部署**

   Vercel 会自动构建并部署。后续 push 到 `main` 分支即自动更新。

### 自托管部署

```bash
# 构建生产版本
npm run build

# 配置环境变量
export DATABASE_URL="postgresql://..."
export JWT_SECRET="..."

# 执行数据库迁移
npm run migrate

# 启动服务器
npm run start
```

> 部署时需要使用 Node.js 服务器运行，不支持纯静态导出。

## 安全说明

### 零知识架构

- 主密码在客户端通过 Argon2id 派生 Master Key，再解密 Symmetric Key
- 服务端仅存储加密后的数据，**主密码永远不会离开客户端**
- SRP（Secure Remote Password）协议完成主密码验证，服务端不存密码本身

### 加密算法

| 用途 | 算法 |
|------|------|
| 对称加密 | AES-256-GCM |
| 密钥派生 | Argon2id（内存 64MiB，迭代 3 次，并行度 4） |
| 密钥包装 | HMAC-SHA256 |
| 保险库名称加密 | AES-256-GCM (AAD=`passbox:vault-name:v1`) |

### 服务端防护

- **会话管理**：JWT + httpOnly Cookie，不含敏感信息
- **API 限流**：基于 IP 的请求频率限制
- **审计日志**：关键操作记录到 api_log 表
- **输入校验**：所有用户输入经 Zod schema 验证后入库
- **SQL 注入防护**：所有查询使用 `$1, $2, ...` 参数化占位符

> 生产环境请务必使用强随机的 `JWT_SECRET`，并妥善保管恢复码（Emergency Kit）。

## License

MIT
