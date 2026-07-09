# Passbox

端到端加密的密码管理器，采用零知识架构——服务端永远无法接触用户的明文主密码和加密密钥。

## 功能特性

- **端到端加密**：AES-256-GCM 对称加密，Argon2id 密钥派生，密钥永不离开客户端
- **16 种条目类型**：登录凭证、安全笔记、信用卡、身份信息、密码、软件许可证、银行账户、路由器、服务器、数据库、API 密钥、加密钱包、驾驶证、护照、会员卡、积分计划
- **双因素认证 (2FA)**：TOTP 动态验证码，支持备用恢复码
- **密码生成器**：可定制长度和字符集的强密码生成
- **安全检测**：密码强度评估（zxcvbn）、重复密码检测、数据泄露检查
- **保险库管理**：多保险库支持，标签分类，收藏标记
- **自动锁定**：空闲超时自动锁定保险库
- **紧急恢复**：应急密钥 (Emergency Kit) 机制

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
| 部署 | Vercel |

## 项目结构

```
src/
├── app/                    # App Router 路由
│   ├── (app)/              # 应用页面（需认证）
│   │   ├── vault/          # 保险库主界面
│   │   ├── generator/      # 密码生成器
│   │   ├── security/       # 安全检测
│   │   ├── settings/       # 设置
│   │   └── unlock/         # 解锁保险库
│   ├── (auth)/             # 认证页面
│   │   ├── login/          # 登录
│   │   ├── register/       # 注册
│   │   └── recover/        # 账户恢复
│   └── api/                # API 路由
├── components/             # 共享组件
├── hooks/                  # 自定义 Hooks
├── lib/                    # 核心库
│   ├── crypto/             # 加密模块（KDF、AES、TOTP 等）
│   ├── security/           # 安全检测（泄露、重复）
│   └── db.ts               # PostgreSQL 连接池
├── stores/                 # Zustand 状态管理
├── types/                  # 类型定义
└── middleware.ts           # 路由中间件
```

## 快速开始

### 环境要求

- Node.js 18+
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

## 常用脚本

| 命令 | 说明 |
|------|------|
| `npm run dev` | 启动开发服务器 |
| `npm run build` | 生产构建 |
| `npm run start` | 启动生产服务器 |
| `npm run lint` | ESLint 代码检查 |
| `npm run typecheck` | TypeScript 类型检查 |
| `npm run test` | 运行单元测试 |
| `npm run test:watch` | 单元测试（监听模式） |
| `npm run test:coverage` | 单元测试（含覆盖率） |
| `npm run test:e2e` | 运行 E2E 测试 |
| `npm run migrate` | 执行数据库迁移 |

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

- **零知识架构**：主密码在客户端通过 Argon2id 派生 Master Key，再解密 Symmetric Key，服务端仅存储加密后的数据
- **加密算法**：AES-256-GCM（对称加密）+ Argon2id（密钥派生）+ HMAC-SHA256（密钥包装）
- **密钥派生参数**：Argon2id，内存 64MiB，迭代 3 次，并行度 4
- **会话管理**：JWT + httpOnly Cookie，不含敏感信息
- 生产环境请务必使用强随机的 `JWT_SECRET`

## License

MIT
