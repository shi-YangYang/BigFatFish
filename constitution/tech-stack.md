# 技术栈与工程边界

## 已确定的产品方向

依据 [产品基线](../BigFatFish_产品设计目标.md)：主 Runtime 为 Node.js + TypeScript，核心服务名 `bigfatfishd`；桌面采用 Tauri 2 + Rust、React + TypeScript；CLI 使用 TypeScript。SQLite 保存结构化数据，Markdown/JSON 保存可读记忆。Python 仅作为独立辅助服务；Playwright 用于浏览器自动化；Linux 部署目标为 Docker 与 systemd。

DSH Harness 是首选引擎，由 `AgentEngine`/`DSHAdapter` 隔离。P0/P1已有实际本机与Linux路径，Node最低24.9；具体实现与外部验证状态以根 IMPLEMENTATION_STATUS.md 为准。

## 目录与职责

| 位置 | 职责 |
| --- | --- |
| `apps/runtime/src/` | 独立 Runtime 入口及内部业务模块；人格、记忆、模型、调度、权限、存储统一归属此层 |
| `apps/cli/src/` | `bigfatfish` 命令行入口，调用 Runtime，不复制业务规则 |
| `apps/desktop/src/` | React 界面，通过 Runtime 客户端访问核心 |
| `apps/desktop/src-tauri/src/` | Rust 桌面外壳与本机进程连接；窗口关闭与停止 Runtime 分离 |
| `plugins/` | 随项目维护的平台与能力插件源码，不是用户安装插件的数据目录 |
| `services/` | 按需接入的 Python 等独立辅助服务 |
| `infra/docker/`、`infra/systemd/` | Docker 已有基础运行镜像；systemd 在 P6 实施 |
| `scripts/` | Runtime 构建资源复制与真实 CLI smoke |
| `tests/integration/`、`tests/e2e/` | Vitest 跨模块集成与后续端到端测试；局部单元测试随模块放置 |
| `docs/` | 上游研究、开发者详细文档和 docs/progress 连续记录；最新全阶段任务指定的产品原稿及 ROADMAP/CHANGELOG/ARCHITECTURE/CONTRIBUTING/SECURITY/IMPLEMENTATION_STATUS 位于根目录 |
| `constitution/`、`specs/`、`.ai/` | 项目约束、规格与 Agent 协作治理，遵守根 AGENTS.md |

这些目录是按产品边界建立的源码位置；后续可在内部扩展，不能未经用户授权迁移。仅使用 `.gitkeep` 保存空目录，不把空目录声称为已工作的应用、插件或服务。Web Console 属于 P7，当前不提前建立应用。

## 工程惯例依据

- `apps/` 按 Runtime、CLI、Desktop 划分入口源码。用户明确选择普通源码模块封装，不建立独立公共包或多包 workspace；不为复用增加独立 package.json、版本管理和发布流程。
- 桌面前端与 `src-tauri/` 的位置遵循 [Tauri 2 官方目录说明](https://v2.tauri.app/start/project-structure/)。
- P0 采用 Node 24、npm 单根依赖清单与 package-lock，Fastify、node:sqlite，React/Vite/Tauri2，Vitest/ESLint。依赖实际版本在 registry 核实后锁定，详见 Decision 002。

## 模块封装与复用

后端以职责明确的普通源码模块组织，例如服务模块、工具模块和适配器；前端使用组件和 hooks。模块通过明确的导出接口调用，不为拆分而增加包管理层。

AgentEngine 抽象、DSHAdapter、插件管理和相关类型先在 apps/runtime/src 内按实际实现封装。跨入口确实需要共享的纯类型、工具或请求代码，再提取为普通共享源码模块，不预建空 shared 目录。未来插件开发接口按产品阶段实现，也不预建独立 SDK 包。共享模块不承载绕过 Runtime 的数据库或平台控制入口。

## 依赖方向与数据边界

`Desktop / CLI / future Web → Runtime API/IPC → Runtime 内部模块 → engine / plugins / storage`。

入口不得直接访问 SQLite 或控制平台插件。平台 Adapter 转换统一消息；所有平台共享人格、记忆和调度。插件按权限获得能力，不把同进程加载称为安全沙箱。远程管理默认不开放公网，后续必须认证授权并使用 HTTPS/WSS。

安装目录与用户数据目录分离。P0 已实现系统数据路径、可覆盖 data-dir、SQLite 版本迁移，以及 config/data/runtime/logs 分区，见 README。开发时可使用被忽略的 `.local/bigfatfish/`；测试使用独立临时目录并清理，不写入用户实际数据。

## P0 实施约定与后续边界

- 默认 loopback 管理 API，随机 bearer token 保存在本机权限受限文件；不开放未受保护的远程接口。
- 使用 Node 24 内置 node:sqlite（本机已实际创建内存数据库并查询版本），迁移版本与失败处理必须测试。
- CLI/Runtime 共用普通连接、路径等源码模块；Tauri 以原生宿主连接 Runtime，UI 不直接访问数据库。
- 类型/Lint/单元/集成/运行验证为用户明确要求；本阶段涉及 schema、认证和构建，按 S3 检查。
- DSH 通过官方 @deepseek-ai/dsh-sdk-client 与同版 @deepseek-ai/dsh 接入；P1 固定实际发布的 0.2.2-alpha.2，受控 profile 与桥接插件封装在 Adapter 内。细节见 docs/upstreams.md，master 接口不能替代发布包证据。
- B站主要上游已由用户确认 Alterssss/dsh-bili-whale，另参考 pond/life；所有准确仓库及接口边界见 docs/upstreams.md。QQ、抖音真实账号验证单列，不能假装已经连接。

## 当前命令与验证

运行命令以根 package.json 和 README 为准，模型/人格/会话及记忆/生活用法见docs/ai-core.md，QQ用法见docs/qq.md。P1经真实DSH、CLI、桌面与Linux镜像验证；P2记忆与P3 schema4/channels/内置QQ插件及审批的本机路径和返工已独立PASS。阶段结果见 [实际状态](../IMPLEMENTATION_STATUS.md) 和 [开发记录](../docs/progress/development.md)，未完成验证不得写成通过。
