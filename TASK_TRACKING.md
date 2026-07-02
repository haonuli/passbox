# 任务状态追踪

> 本文档追踪 passbox 项目主任务及子任务的执行状态，与 CLAUDE.md 七步工作流配合使用。

## 主任务：passbox MVP 产品开发

| 阶段 | 阶段名称 | 状态 | 负责人 | 产出物 | 备注 |
|------|----------|------|--------|--------|------|
| 阶段 1 | 需求定义与验收标准 | ✅ 已完成 | 资深产品经理 | docs/PRD.md | v1.1.0，范围收窄为个人使用 |
| 阶段 2 | 技术方案设计 | ✅ 已完成 | 资深软件架构师 | docs/TECHNICAL_DESIGN.md | v1.1.1，零知识加密架构 + 8 条 ADR + 恢复码数据恢复方案（v1.1.1 修正 salt 16B + libsodium-sumo） |
| 阶段 3 | 任务拆分与开发排期 | ✅ 已完成 | 资深软件架构师 | docs/TASK_BREAKDOWN.md | v1.0.0，6 阶段 / 40 原子任务 / 27.5 人天 |
| 阶段 4 | 测试策略与 Checklist | ✅ 已完成（待评审） | 资深软件架构师 | docs/TEST_STRATEGY.md | v1.0.0，测试金字塔 70/20/10 + 4 个 TDD 骨架 + M0-M6 验收清单 + 43 项安全测试 + 40 任务映射 |
| 阶段 5 | 开发与单元测试 | 🔄 进行中 | 开发工程师 | — | T1.1-T1.4 已完成，按 TASK_BREAKDOWN 顺序执行 |
| 阶段 6 | 集成测试与验收 | ⏳ 未开始 | — | — | |
| 阶段 7 | 评审、合并与状态更新 | ⏳ 未开始 | — | — | |

## 子任务清单（阶段 1 细化）

| 编号 | 子任务 | 状态 | 产出 |
|------|--------|------|------|
| 1.1 | 1Password 核心功能与安全架构研究 | ✅ 完成 | 竞品分析（PRD 第 3 章） |
| 1.2 | 目标用户画像与使用场景定义 | ✅ 完成 | PRD 第 4 章 |
| 1.3 | MVP 功能范围界定（P0/P1/P2/P3 + Out of Scope） | ✅ 完成 | PRD 第 5 章 |
| 1.4 | 详细功能需求与用户故事编写（含 AC） | ✅ 完成 | PRD 第 6 章（18 个用户故事，v1.1.0 移除 3 个团队向故事） |
| 1.5 | 非功能性需求定义（安全/性能/可用性/兼容性） | ✅ 完成 | PRD 第 7 章 |
| 1.6 | 信息架构与核心用户旅程 | ✅ 完成 | PRD 第 8 章 |
| 1.7 | 数据模型概要与关键约束 | ✅ 完成 | PRD 第 9 章 |
| 1.8 | 验收标准总表汇总 | ✅ 完成 | PRD 第 11 章 |
| 1.9 | 风险与依赖梳理 | ✅ 完成 | PRD 第 12 章 |

## 子任务清单（阶段 3 细化）

| 编号 | 子任务 | 状态 | 产出 |
|------|--------|------|------|
| 3.1 | 阶段划分与任务粒度设计（6 阶段 / 40 原子任务） | ✅ 完成 | TASK_BREAKDOWN 第 2 章 |
| 3.2 | P0/P1 覆盖矩阵（14 项 P0 + 6 项 P1 全覆盖） | ✅ 完成 | TASK_BREAKDOWN 2.2 节 |
| 3.3 | 依赖关系图（Mermaid）与关键路径分析 | ✅ 完成 | TASK_BREAKDOWN 2.3 节 |
| 3.4 | 阶段 1 详细任务（T1.1-T1.6，基础设施） | ✅ 完成 | TASK_BREAKDOWN 阶段 1 |
| 3.5 | 阶段 2 详细任务（T2.1-T2.6，加密核心） | ✅ 完成 | TASK_BREAKDOWN 阶段 2 |
| 3.6 | 阶段 3 详细任务（T3.1-T3.8，认证与账户） | ✅ 完成 | TASK_BREAKDOWN 阶段 3 |
| 3.7 | 阶段 4 详细任务（T4.1-T4.7，密码库核心） | ✅ 完成 | TASK_BREAKDOWN 阶段 4 |
| 3.8 | 阶段 5 详细任务（T5.1-T5.6，密码工具） | ✅ 完成 | TASK_BREAKDOWN 阶段 5 |
| 3.9 | 阶段 6 详细任务（T6.1-T6.7，P1 功能） | ✅ 完成 | TASK_BREAKDOWN 阶段 6 |
| 3.10 | 里程碑与排期建议（M0-M7 / 6 周排期） | ✅ 完成 | TASK_BREAKDOWN 第 4 章 |
| 3.11 | 风险任务标注与缓解建议 | ✅ 完成 | TASK_BREAKDOWN 第 5 章 |
| 3.12 | PRD 验收标准覆盖检查（18 个用户故事 AC 全覆盖） | ✅ 完成 | TASK_BREAKDOWN 附录 |

## 子任务清单（阶段 4 细化）

| 编号 | 子任务 | 状态 | 产出 |
|------|--------|------|------|
| 4.1 | 测试策略总览与测试金字塔定义（70% 单元 / 20% 集成 / 10% E2E） | ✅ 完成 | TEST_STRATEGY 第 2 章 |
| 4.2 | 测试工具选型（Vitest vs Jest 十维对比 + Playwright E2E + 测试 DB 隔离方案） | ✅ 完成 | TEST_STRATEGY 第 3 章 |
| 4.3 | 测试分层与覆盖矩阵（18 单元模块 + 9 集成模块 + 8 E2E spec） | ✅ 完成 | TEST_STRATEGY 第 4 章 |
| 4.4 | 里程碑验收 Checklist（M0-M6，71 项检查点，逐条可溯源 PRD AC） | ✅ 完成 | TEST_STRATEGY 第 5 章 |
| 4.5 | TDD 代码骨架（crypto / auth / items 单元 + register-login E2E，4 套可执行骨架） | ✅ 完成 | TEST_STRATEGY 第 6 章 |
| 4.6 | 安全测试矩阵（ZK-1~12 零知识验证 + CR-1~10 加密强度 + AU-1~10 认证安全 + 注入防护，共 43 项） | ✅ 完成 | TEST_STRATEGY 第 7 章 |
| 4.7 | 性能测试方案（Argon2id <2s / 批量解密 1000 条 <1s / 列表渲染 <2s / 搜索 <200ms） | ✅ 完成 | TEST_STRATEGY 第 8 章 |
| 4.8 | 测试数据与 Fixture 策略（敏感数据规则 + DB 初始化脚本 + 测试夹具） | ✅ 完成 | TEST_STRATEGY 第 9 章 |
| 4.9 | CI 集成建议（流水线顺序 + 覆盖率门禁 + 失败阻断策略） | ✅ 完成 | TEST_STRATEGY 第 10 章 |
| 4.10 | 开发任务与测试映射（11 个 TDD-first 任务 + 40 任务全量测试文件映射） | ✅ 完成 | TEST_STRATEGY 第 11 章 |

## 子任务清单（阶段 5 细化 — 按 TASK_BREAKDOWN.md 6 阶段 / 40 原子任务执行）

### 阶段 5 · Stage 1：基础设施（T1.1-T1.6）

| 编号 | 子任务 | 状态 | 产出 |
|------|--------|------|------|
| T1.1 | 项目脚手架初始化与依赖安装 | ✅ 完成 | Next.js 16.2.10 + Tailwind v3 + shadcn/ui（7 组件）+ 全量依赖；tsc/eslint 零错误；dev server HTTP 200 |
| T1.2 | 数据库连接池单例 | ✅ 完成 | src/lib/db.ts (Pool 单例, max:10, globalThis 防重复) + db.test.ts (7 测试全通过) + vitest.config.ts + .env.test |
| T1.3 | 数据库 DDL 迁移脚本 | ✅ 完成 | src/lib/migrate.ts (21 条幂等 DDL: 6 表+9 索引+3 触发器+3 预置数据) + migrate.test.ts (9 集成测试) + scripts/init-test-db.ts + npm run migrate/test:db:setup |
| T1.4 | 全局类型定义 | ✅ 完成 | src/types/db.ts (6 Row 类型) + src/types/crypto.ts (EncryptedData/KdfConfig/KdfParams/StrengthResult) + src/types/api.ts (ActionResult/Register/Login/Prelogin/Session + Server Action 输入类型) |
| T1.5 | 根布局与主题系统 | ✅ 完成 | src/components/theme-provider.tsx (next-themes 封装: attribute=class/defaultTheme=system/enableSystem/disableTransitionOnChange) + src/components/theme-toggle.tsx (DropdownMenu + Sun/Moon 图标, 浅色/深色/跟随系统) + layout.tsx 挂载 ThemeProvider + Toaster (richColors/top-center) + page.tsx passbox 落地页；验收: tsc/eslint 零错误 / dev HTTP 200 / 深色模式 CSS 变量正确 (bodyBg: rgb(9,9,11)) / Toaster 已挂载 |
| T1.6 | 中间件与路由守卫 | ✅ 完成 | src/middleware.ts (路由守卫: 未认证→/login?redirect=xxx, 已认证→/vault + CSP 11 指令 + X-Frame-Options/Permissions-Policy 等安全头) + src/lib/session.ts (SESSION_COOKIE_NAME + verifySession JWT 验签 + getSession) + 路由组目录 ((auth)/login+register, (app)/layout+vault+unlock+items/[id]+items/new+security+generator+settings) + tests/integration/middleware.test.ts (27 测试)；验收: tsc/eslint 零错误 / dev /vault→307 /login?redirect=%2Fvault / /login→200+CSP 完整 / 43 测试全通过 |

### 阶段 5 · Stage 2：加密核心（T2.1-T2.6）— TDD-first

| 编号 | 子任务 | 状态 | 产出 |
|------|--------|------|------|
| T2.1 | 加密类型定义与编码工具 | ✅ 完成 | src/lib/crypto/types.ts (barrel re-export @/types/crypto) + encoding.ts (toBase64/fromBase64 分块 + bytesToString/stringToBytes UTF-8) + random.ts (getRandomBytes 封装 crypto.getRandomValues + 非负整数校验) + __tests__/encoding.test.ts (11 测试) + __tests__/random.test.ts (6 测试)；验收: tsc/eslint 零错误 / 17 测试全通过 / 全量 60 测试无回归 |
| T2.2 | Argon2id 密钥派生模块 | ✅ 完成 | src/lib/crypto/sodium-init.ts (单例 ensureSodiumReady + 失败可重试 + re-export sodium) + kdf.ts (deriveMasterKey 调用 crypto_pwhash ALG_ARGON2ID13 / 32B Master Key / 16B salt 校验 + generateKdfSalt + buildKdfConfig + DEFAULT_KDF_PARAMS 65536/3/4 + MASTER_KEY_LENGTH) + kdf.worker.ts (Web Worker 入口, T3.5 接线) + __tests__/kdf.test.ts (14 测试)；实现偏差已记录至 TECHNICAL_DESIGN 3.2：① libsodium-sumo 为 pure JS(asm.js) 非 WASM ② crypto_pwhash 不暴露 parallelism ③ 必须默认导入非命名空间导入；验收: tsc/eslint 零错误 / 14 测试通过 / 全量 74 测试无回归 / 完整参数 64MiB/3 派生 32B 一致 |
| T2.3 | HKDF 派生模块 | ✅ 完成 | src/lib/crypto/hkdf.ts (hkdfDerive 核心 WebCrypto deriveBits SHA-256 + deriveAuthHash info="passbox:auth:v1" + deriveRecoveryKey info="passbox:recovery:v1" + normalizeEmail 小写trim + AUTH_HASH_INFO/RECOVERY_KEY_INFO 域分离标签 + HKDF_OUTPUT_LENGTH=32) + __tests__/hkdf.test.ts (13 测试)；TS 5.7 Uint8Array<ArrayBufferLike> 与 WebCrypto BufferSource 类型摩擦用 .slice() 拷贝解决；验收: tsc/eslint 零错误 / 13 测试通过 / 全量 87 测试无回归 |
| T2.4 | AES-256-GCM 加解密模块 | ✅ 完成 | src/lib/crypto/aes.ts (encrypt/decrypt 字符串 + encryptBytes/decryptToBytes 字节 + 12B 随机 IV + AAD 绑定 + assertEncryptedData 版本校验 + AES_GCM_IV_LENGTH=12 + FORMAT_VERSION=1) + __tests__/aes.test.ts (16 测试)；验收: tsc/eslint 零错误 / 16 测试通过 / 全量 103 测试无回归 |
| T2.5 | 密钥层级管理（密钥包装） | ✅ 完成 | src/lib/crypto/keys.ts（generateSymmetricKey AES-256 可提取 CryptoKey + importKey 非提取 + encryptSymmetricKey/decryptSymmetricKey Master 路径 + encryptSymmetricKeyWithRecovery/decryptSymmetricKeyWithRecovery Recovery 路径 + 路径专属 AAD MASTER_WRAP_AAD="passbox:symmetric-key:master:v1" / RECOVERY_WRAP_AAD="passbox:symmetric-key:recovery:v1" 域分离 + exportRawKey/importSymmetricKey 内部辅助）+ __tests__/keys.test.ts（11 测试：generateSymmetricKey 类型/可提取/算法/唯一性 + importKey 非提取 + Master 路径往返 + Recovery 路径往返（真实 deriveRecoveryKey）+ 密钥隔离 4 项：Master 不能解 Recovery / Recovery 不能解 Master / 双路径同一 Symmetric Key）；验收：tsc/eslint 零错误 / 11 测试通过 / 全量 114 测试无回归 |
| T2.6 | 加密核心单元测试 | ✅ 完成 | src/lib/crypto/__tests__/crypto-chain.test.ts（5 端到端集成测试：场景 1 注册流程 KDF→HKDF→密钥生成→双路径包装 / 场景 2 日常使用 登录→解包 Symmetric Key→加解密条目+AAD 绑定验证 / 场景 3 数据恢复 恢复码解包→新主密码重包装 / 场景 4 修改主密码 旧密钥解包→新密钥重包装+历史密文仍可解 / 场景 5 零知识架构验证 服务端可见数据不含明文）+ aes.test.ts 补充 iv/ct 非字符串防御测试（17 测试）；覆盖率：核心加密逻辑 6 文件（encoding/random/kdf/hkdf/aes/keys）语句 100% / 分支 100% / 函数 100%，满足 M1-9；基础设施 gap：kdf.worker.ts（Web Worker 入口，T3.5 接线测试）/ sodium-init.ts 错误重试路径（防御性代码）/ types.ts（纯类型 barrel 无运行时代码）；验收：tsc/eslint 零错误 / 5 集成测试通过 / 全量 120 测试无回归 / M1 里程碑 M1-1~M1-9 全部通过 |

### 阶段 5 · Stage 3-6（T3.1-T6.7）

> 详见 [TASK_BREAKDOWN.md](./docs/TASK_BREAKDOWN.md)，按依赖顺序逐步展开追踪。

## 变更日志

| 日期 | 变更内容 | 操作人 |
|------|----------|--------|
| 2026-07-02 | 创建 TASK_TRACKING.md；阶段 1（需求定义）产出 PRD v1.0.0，标记为待评审 | 资深产品经理 |
| 2026-07-02 | PRD 范围调整 v1.0.0 → v1.1.0：收窄为「个人使用」，移除小团队/企业/共享协作/活动日志相关功能（3 个用户故事、3 个数据实体、2 个功能模块章节），内置 TOTP 生成提升至 P0；同步更新竞品分析、数据模型、验收标准、信息架构、风险依赖、术语表 | 资深产品经理 |
| 2026-07-02 | 阶段 1 状态更新为「已完成」；阶段 2（技术方案设计）产出 TECHNICAL_DESIGN.md v1.0.0，标记为「已完成（待评审）」。核心技术决策：简化零知识认证方案、Argon2id KDF（64MiB/3/4）、AES-256-GCM、Master Key → Symmetric Key 两层密钥层级、标题单独加密、Zustand 状态管理、8 条 ADR | 资深软件架构师 |
| 2026-07-02 | 技术方案 v1.0.0 → v1.1.0：解决 Q-1/Q-3 待确认事项，新增恢复码数据恢复方案（Recovery Key 密钥路径 + recovery_encrypted_key 字段 + 恢复流程），Cookie SameSite 策略确认为 Lax | 资深软件架构师 |
| 2026-07-02 | 阶段 2 状态确认为「已完成」；阶段 3（任务拆分与开发排期）产出 TASK_BREAKDOWN.md v1.0.0，标记为「已完成（待用户确认）」。拆分结果：6 阶段 / 40 个原子任务 / 预估 27.5 人天，覆盖 P0 全部 14 项 + P1 全部 6 项，18 个用户故事 AC 全覆盖，7 个里程碑（M0-M7），6 个高风险任务标注 | 资深软件架构师 |
| 2026-07-02 | 阶段 3 状态确认为「已完成」；阶段 4（测试策略与 Checklist）产出 TEST_STRATEGY.md v1.0.0，标记为「已完成（待评审）」。核心产出：测试金字塔（70% 单元 / 20% 集成 / 10% E2E）、Vitest 工具选型（十维对比胜出 Jest）、覆盖率目标（加密层 100%/95%/100%、整体 80%/70%/80%）、4 套 TDD 可执行骨架（crypto/auth/items 单元 + register-login E2E 含网络拦截零知识验证）、M0-M6 共 71 项里程碑验收检查点、43 项安全测试矩阵（ZK/CR/AU/注入防护）、性能基线（Argon2id <2s / 批量解密 1000 条 <1s）、40 任务全量测试文件映射、11 个 TDD-first 任务标注、CI 流水线与覆盖率门禁建议 | 资深软件架构师 |
| 2026-07-02 | 阶段 5（开发与单元测试）启动；技术方案修正 v1.1.0 → v1.1.1（CLAUDE.md 规定开发期发现方案有误须立即回退更新）：① KDF salt 32B → 16B（crypto_pwhash_SALTBYTES）；② libsodium-wrappers → libsodium-wrappers-sumo（精简版无 crypto_pwhash）；③ memLimit 单位说明（字节，65536*1024=67108864）。影响：3.2 参数表 / 3.5 KDF 示例 / DDL / API 契约 / 数据流图 / 10.1 选型表 / ADR-002 / 摘要 | 开发工程师 |
| 2026-07-02 | T1.1 项目脚手架初始化与依赖安装 ✅ 完成。产出：Next.js 16.2.10 (Turbopack) + React 19.2.4 + TypeScript strict + Tailwind CSS v3 + shadcn/ui new-york（button/input/dialog/form/label/dropdown-menu/sonner 7 组件）+ pg/zustand/react-hook-form/zod/libsodium-wrappers-sumo/bcrypt/jose 等全量依赖；Vitest 4 + Playwright + Testing Library 测试工具链；.env.local + .env.example。验收：tsc --noEmit 零错误 / eslint 零错误 / dev server HTTP 200（177ms 启动） | 开发工程师 |
| 2026-07-02 | T1.2 数据库连接池单例 ✅ 完成。产出：src/lib/db.ts（pg.Pool 单例, max:10, globalThis.__db 防热重载重复实例化）；vitest.config.ts（jsdom + React plugin + @ 路径别名 + 覆盖率配置）；tests/setup.ts（dotenv 加载 .env.test + jest-dom matchers）；src/lib/db.test.ts（7 集成测试全通过：max:10 配置 / SELECT 1 / 参数化查询 / 当前数据库验证 / globalThis 单例）；.env.test（passbox_test 数据库）。PostgreSQL 18.4 已运行。验收：M0-3 通过 | 开发工程师 |
| 2026-07-02 | T1.3 数据库 DDL 迁移脚本 ✅ 完成。产出：src/lib/migrate.ts（21 条幂等 SQL：pgcrypto 扩展 + 6 表 CREATE IF NOT EXISTS + 9 索引 + update_updated_at 触发器函数 + 3 触发器 + item_types 预置数据 ON CONFLICT DO NOTHING）；src/lib/migrate.test.ts（9 集成测试全通过：6 表验证 / 3 条预置数据 / field_schema JSONB / 索引验证 / updated_at 触发器验证 / 幂等性验证）；scripts/init-test-db.ts（测试库重置脚本）；npm run migrate / npm run test:db:setup 命令。验收：M0-4 + M0-5 通过 | 开发工程师 |
| 2026-07-02 | T1.4 全局类型定义 ✅ 完成。产出：src/types/db.ts（6 Row 类型: UserRow/VaultRow/ItemRow/ItemTypesRow/TagRow/ItemTagsRow，含 recovery_encrypted_key + kdf_salt: Buffer）；src/types/crypto.ts（EncryptedData v:1 + KdfConfig salt:Uint8Array + KdfParams API 传输 + StrengthResult）；src/types/api.ts（ActionResult 判别联合 + Register/Login/Prelogin/Session + CreateItemInput/UpdateItemInput）。验收：tsc 零错误 | 开发工程师 |
| 2026-07-02 | T1.5 根布局与主题系统 ✅ 完成。产出：src/components/theme-provider.tsx（next-themes 封装: attribute=class / defaultTheme=system / enableSystem / disableTransitionOnChange）；src/components/theme-toggle.tsx（DropdownMenu + Sun/Moon 图标, 浅色/深色/跟随系统三选项）；layout.tsx 挂载 ThemeProvider + Toaster（richColors / position=top-center）；page.tsx 替换为 passbox 落地页（主题切换 + toast 测试入口）。验收：tsc/eslint 零错误 / dev server HTTP 200 / 深色模式 CSS 变量正确应用（--background: 240 10% 3.9%, bodyBg: rgb(9,9,11), bodyColor: rgb(250,250,250)）/ Toaster 已挂载（a11y 树 Notifications region 存在）/ 16 测试全通过 | 开发工程师 |
| 2026-07-02 | T1.6 中间件与路由守卫 ✅ 完成。产出：src/middleware.ts（路由守卫：未认证访问 (app)/* → 307 重定向 /login?redirect=xxx；已认证访问 (auth)/* → 307 重定向 /vault；CSP 11 指令 + X-Frame-Options DENY + X-Content-Type-Options nosniff + Referrer-Policy + Permissions-Policy；matcher 排除静态资源）；src/lib/session.ts（SESSION_COOKIE_NAME='passbox_session' + verifySession JWT 验签 jose + getSession Server Component 辅助）；路由组目录结构（(auth)/login + (auth)/register + (app)/layout 双重保险 redirect + (app)/vault + (app)/unlock + (app)/items/[id] + (app)/items/new + (app)/security + (app)/generator + (app)/settings 共 10 个占位 page.tsx）；tests/integration/middleware.test.ts（27 集成测试：7 受保护路由重定向 + 2 认证路由重定向 + 4 正常放行 + 13 CSP/安全头校验 + 1 matcher 配置）。验收：tsc/eslint 零错误 / dev /vault→307 /login?redirect=%2Fvault / /login→200+CSP 完整 / /register→200 / /settings→307 / 43 测试全通过。M0-7 + M0-8 通过 | 开发工程师 |
| 2026-07-02 | T2.1 加密类型定义与编码工具 ✅ 完成。产出：src/lib/crypto/types.ts（barrel re-export @/types/crypto，保持单一数据源）；src/lib/crypto/encoding.ts（toBase64 分块 0x8000 避免 fromCharCode.apply 参数上限 / fromBase64 / stringToBytes TextEncoder UTF-8 / bytesToString TextDecoder）；src/lib/crypto/random.ts（getRandomBytes 封装 crypto.getRandomValues + 非负整数校验抛 RangeError）；__tests__/encoding.test.ts（11 测试：空数组/单字节/边界 0x00 0xFF/大数组分块/已知向量 "Hello"→SGVsbG8=/UTF-8 中文 emoji 往返/跨函数组合）+ __tests__/random.test.ts（6 测试：长度/空/随机性/负数 RangeError/Uint8Array 实例/分布烟雾）。加密测试用 `// @vitest-environment node` 确保原生 crypto.subtle。验收：tsc/eslint 零错误 / 17 加密测试通过 / 全量 60 测试无回归。同步修正 Stage 2 追踪表任务名与 TASK_BREAKDOWN 对齐 | 开发工程师 |
| 2026-07-02 | T2.2 Argon2id 密钥派生模块 ✅ 完成。产出：sodium-init.ts（ensureSodiumReady 单例 Promise + 失败清空可重试 + re-export sodium 默认导出）；kdf.ts（deriveMasterKey 调用 sodium.crypto_pwhash(32, password, salt, opsLimit=3, memLimit=65536*1024, ALG_ARGON2ID13) + 16B salt 运行时校验 + generateKdfSalt + buildKdfConfig + DEFAULT_KDF_PARAMS + MASTER_KEY_LENGTH）；kdf.worker.ts（Web Worker 入口 postMessage {ok, masterKey|error}，T3.5 接线）；__tests__/kdf.test.ts（14 测试：预加载/32B 完整参数/确定性/不同 salt/不同 password/>50ms 性能/salt 长度 15&17 抛错/空密码/中文 emoji/辅助函数）。⚠️ 关键修正：初次用 `import * as sodium` 导致 crypto_pwhash_SALTBYTES 为 undefined（命名空间 const 在 ready 前已求值），改为默认导入 `import sodium from 'libsodium-wrappers-sumo'`（默认导出是 ready 后动态填充的活对象）。实现偏差已写入 TECHNICAL_DESIGN 3.2：① libsodium-wrappers-sumo@0.8.4 为 pure JS(asm.js) 非 WASM，CSP 无需 wasm-unsafe-eval ② crypto_pwhash 高层 API 不暴露 parallelism，由内部依据 opslimit/memlimit 决定，KdfConfig 保留字段以维持 API 契约 ③ 必须默认导入。验收：tsc/eslint 零错误 / 14 测试通过 / 全量 74 测试无回归 | 开发工程师 |
| 2026-07-02 | T2.3 HKDF 派生模块 ✅ 完成。产出：hkdf.ts（hkdfDerive 核心：crypto.subtle.importKey('raw', ikm) + deriveBits {name:'HKDF', hash:'SHA-256', salt:email_normalized, info} + deriveAuthHash(masterKey, email) info="passbox:auth:v1" + deriveRecoveryKey(recoveryCode, email) info="passbox:recovery:v1" + normalizeEmail 小写+trim + AUTH_HASH_INFO/RECOVERY_KEY_INFO 常量 + HKDF_OUTPUT_LENGTH=32）；__tests__/hkdf.test.ts（13 测试：deriveAuthHash 32B/确定性/不同 masterKey/不同 email + deriveRecoveryKey 32B/确定性/不同 recoveryCode + 域分离 info 不同/相同 ikm 派生不同/非全零退化防护 + normalizeEmail 大小写空格一致）。解决 TS 5.7 类型摩擦：lib:esnext 下 Uint8Array 泛型为 ArrayBufferLike（含 SharedArrayBuffer），WebCrypto BufferSource 仅接受 ArrayBuffer，用 .slice() 在 WebCrypto 边界拷贝解决。验收：tsc/eslint 零错误 / 13 测试通过 / 全量 87 测试无回归 | 开发工程师 |
| 2026-07-02 | T2.4 AES-256-GCM 加解密模块 ✅ 完成。产出：aes.ts（encrypt/decrypt 字符串入口 + encryptBytes/decryptToBytes 字节入口供密钥包装复用 + 12B 随机 IV getRandomBytes(AES_GCM_IV_LENGTH) + AAD additionalData 上下文绑定 + assertEncryptedData 版本号 v:1 校验 + GCM 16B auth tag 自动附加 + FORMAT_VERSION=1 as const 满足字面量类型）；__tests__/aes.test.ts（16 测试：字符串往返/无AAD/空串/UTF-8 中文emoji + 格式 v1 iv12B ct base64 + 每次IV不同 + ct长度=明文+16 + AAD不匹配抛错/有AAD无AAD抛错/密文篡改抛错/IV篡改抛错/版本错误抛错/跨密钥抛错 + 字节往返 + 同密钥多次稳定）。.slice() 模式统一用于 WebCrypto BufferSource 类型边界。验收：tsc/eslint 零错误 / 16 测试通过 / 全量 103 测试无回归 | 开发工程师 |
| 2026-07-02 | T2.5 密钥层级管理（密钥包装）✅ 完成。产出：keys.ts（generateSymmetricKey 256-bit AES-GCM 可提取 CryptoKey / importKey 32B raw → 非提取 CryptoKey 用于 Master/Recovery 路径 / encryptSymmetricKey + decryptSymmetricKey Master 路径 / encryptSymmetricKeyWithRecovery + decryptSymmetricKeyWithRecovery Recovery 路径 / 路径专属 AAD MASTER_WRAP_AAD='passbox:symmetric-key:master:v1' 与 RECOVERY_WRAP_AAD='passbox:symmetric-key:recovery:v1' 实现域分离 / exportRawKey + importSymmetricKey 内部辅助）；__tests__/keys.test.ts（11 测试：generateSymmetricKey 类型=AES-GCM/可提取/length=256/唯一性 + importKey 非提取 + Master 路径往返 + Recovery 路径往返（使用真实 deriveRecoveryKey）+ 密钥隔离 4 项：Master 不能解 Recovery 密文 / Recovery 不能解 Master 密文 / 双路径包装同一 Symmetric Key 解密一致）。关键设计：Master Key 与 Recovery Key 不可交叉解密（路径专属 AAD + 不同密钥），满足 TECHNICAL_DESIGN 3.3.1 恢复码密钥路径安全要求。验收：tsc/eslint 零错误 / 11 测试通过 / 全量 114 测试无回归 | 开发工程师 |
| 2026-07-02 | T2.6 加密核心单元测试 ✅ 完成。产出：crypto-chain.test.ts（5 端到端集成测试：① 注册流程 KDF→HKDF→密钥生成→双路径包装 ② 日常使用 登录→解包 Symmetric Key→加解密条目+AAD 绑定验证（title/data 不可互换 AAD、不同 itemId 不可解密）③ 数据恢复 主密码丢失→恢复码派生 Recovery Key→解包 Symmetric Key→验证历史数据可解→新主密码重包装 ④ 修改主密码 旧密钥解包→新密钥重包装+3 个历史条目仍可解+旧/新密文不可交叉解密 ⑤ 零知识架构验证 模拟数据库泄露场景，断言服务端可见数据不含主密码/Symmetric Key/条目明文/恢复码）；aes.test.ts 补充 iv/ct 非字符串防御测试（17 测试）；覆盖率报告：核心加密逻辑 6 文件（encoding/random/kdf/hkdf/aes/keys）语句 100% / 分支 100% / 函数 100%，满足 M1-9；基础设施文件 gap（已记录）：kdf.worker.ts 0%（Web Worker 入口，T3.5 接线集成测试）/ sodium-init.ts 71.42%（错误重试路径，防御性代码）/ types.ts 0%（纯类型 barrel 无运行时代码）。验收：tsc/eslint 零错误 / 5 集成测试通过 / 全量 120 测试无回归 / M1 里程碑 M1-1~M1-9 全部通过。**Stage 2 加密核心全部完成，M1 里程碑达成** | 开发工程师 |
