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
| T1.5 | 根布局与主题系统 | ⏳ 待开始 | — |
| T1.6 | 中间件与路由守卫 | ⏳ 待开始 | — |

### 阶段 5 · Stage 2：加密核心（T2.1-T2.6）— TDD-first

| 编号 | 子任务 | 状态 | 产出 |
|------|--------|------|------|
| T2.1 | libsodium 封装与 Argon2id KDF | ⏳ 待开始 | — |
| T2.2 | HKDF 密钥派生 | ⏳ 待开始 | — |
| T2.3 | AES-256-GCM 加解密 | ⏳ 待开始 | — |
| T2.4 | 密钥包装（Master Key 加密 Symmetric Key） | ⏳ 待开始 | — |
| T2.5 | 恢复码密钥路径 | ⏳ 待开始 | — |
| T2.6 | 加密模块集成测试 | ⏳ 待开始 | — |

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
