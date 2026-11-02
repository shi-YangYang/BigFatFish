# 技术栈与工程边界

## 已确定的产品方向

依据 [产品基线](../docs/product-design.md)：主 Runtime 为 Node.js + TypeScript，核心服务名 `bigfatfishd`；桌面采用 Tauri 2 + Rust、React + TypeScript；CLI 使用 TypeScript。SQLite 保存结构化数据，Markdown/JSON 保存可读记忆。Python 仅作为独立辅助服务；Playwright 用于浏览器自动化；Linux 部署目标为 Docker 与 systemd。

DSH Harness 是首选引擎，由 `AgentEngine`/`DSHAdapter` 隔离。上述均是架构目标，目前没有可执行代码或已安装依赖。

## 目录与职责

| 位置 | 职责 |
| --- | --- |
| `apps/runtime/src/` | 独立 Runtime 入口及内部业务模块；人格、记忆、模型、调度、权限、存储统一归属此层 |
| `apps/cli/src/` | `bigfatfish` 命令行入口，调用 Runtime，不复制业务规则 |
| `apps/desktop/src/` | React 界面，通过 Runtime 客户端访问核心 |
| `apps/desktop/src-tauri/src/` | Rust 桌面外壳与本机进程连接；窗口关闭与停止 Runtime 分离 |
| `plugins/` | 随项目维护的平台与能力插件源码，不是用户安装插件的数据目录 |
| `services/` | 按需接入的 Python 等独立辅助服务 |
| `infra/docker/`、`infra/systemd/` | 后续部署文件位置，目前仅占位 |
| `scripts/` | 后续工程与维护脚本，目前仅占位 |
| `tests/integration/`、`tests/e2e/` | 跨模块和端到端测试；局部单元测试随模块放置，框架待定 |
| `docs/` | 产品原始基线及面向开发者的详细文档，包括 CONTRIBUTING、CODE_OF_CONDUCT、SECURITY、CHANGELOG；根目录仅保留 README.md 和 Agent 入口 AGENTS.md |
| `constitution/`、`specs/`、`.ai/` | 项目约束、规格与 Agent 协作治理，遵守根 AGENTS.md |

这些目录是按产品边界建立的源码位置；后续可在内部扩展，不能未经用户授权迁移。仅使用 `.gitkeep` 保存空目录，不把空目录声称为已工作的应用、插件或服务。Web Console 属于 P7，当前不提前建立应用。

## 工程惯例依据

- `apps/` 按 Runtime、CLI、Desktop 划分入口源码。用户明确选择普通源码模块封装，不建立独立公共包或多包 workspace；不为复用增加独立 package.json、版本管理和发布流程。
- 桌面前端与 `src-tauri/` 的位置遵循 [Tauri 2 官方目录说明](https://v2.tauri.app/start/project-structure/)。
- 包管理器和版本尚未确定，未建立依赖清单或生成 lockfile；具体构建入口随 P0 工具链落地。

## 模块封装与复用

后端以职责明确的普通源码模块组织，例如服务模块、工具模块和适配器；前端使用组件和 hooks。模块通过明确的导出接口调用，不为拆分而增加包管理层。

AgentEngine 抽象、DSHAdapter、插件管理和相关类型先在 apps/runtime/src 内按实际实现封装。跨入口确实需要共享的纯类型、工具或请求代码，再提取为普通共享源码模块，不预建空 shared 目录。未来插件开发接口按产品阶段实现，也不预建独立 SDK 包。共享模块不承载绕过 Runtime 的数据库或平台控制入口。

## 依赖方向与数据边界

`Desktop / CLI / future Web → Runtime API/IPC → Runtime 内部模块 → engine / plugins / storage`。

入口不得直接访问 SQLite 或控制平台插件。平台 Adapter 转换统一消息；所有平台共享人格、记忆和调度。插件按权限获得能力，不把同进程加载称为安全沙箱。远程管理默认不开放公网，后续必须认证授权并使用 HTTPS/WSS。

安装目录与用户数据目录分离。正式系统数据路径、配置 Schema、迁移方案须在 P0 Spec 明确；本仓库仅预留被忽略的 `.local/bigfatfish/` 作为未来本地开发数据约定，不生成真实配置、数据库、凭据或浏览器会话。

## 待 P0 决定

- Node.js、包管理器及版本，Rust 工具链、React 构建工具与版本锁定。
- API 框架（产品建议 Fastify 或同类）、本地 HTTP/IPC 取舍、客户端契约。
- SQLite 驱动、迁移工具、跨平台数据目录与密钥存储方案。
- 测试、Lint、Format 工具和 CI 构建矩阵。
- DSH Harness 与现有 B站项目的准确仓库；所有集成的来源、版本、接口、许可证、更新方式。

这些问题不阻塞本次目录初始化，但在对应实现开始前必须澄清，不能视作已确认。

## 当前命令与验证

尚无 package.json、Cargo.toml、依赖清单、lockfile 或 CI。Install / Dev / Build / Test / Lint / Typecheck / Format 命令均未定义；README 不提供假启动命令。此轮为 S0 文档及占位结构变更，仅审查新增内容和 Git 状态，不运行测试或构建。
