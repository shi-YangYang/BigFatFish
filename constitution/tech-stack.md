# 技术栈与工程边界

BigFatFish 以一个 Node.js Runtime 管理一条鱼的数据和平台连接。桌面、浏览器和 CLI 共用 Runtime 的业务接口。仓库用 npm 单根依赖清单和 lockfile 管理 TypeScript 源码，跨入口复用普通模块。服务边界及请求流程见 [架构](../docs/design/architecture.md)。

## 运行与构建依赖

| 部分 | 选型与约束 |
| --- | --- |
| Runtime、CLI | Node.js `>=24.9.0 <25`、TypeScript 5.9、Fastify 5、WebSocket、内置 `node:sqlite`。命令入口为 `bigfatfishd` 和 `bigfatfish`。 |
| 引擎与模型 | `DSHAdapter` 实现 `AgentEngine`，使用固定的 DSH SDK 与模型适配包 `0.2.2-alpha.2`。Runtime 管理 OpenAI 兼容与 DeepSeek 聊天配置、模型发现和连接诊断。 |
| 本机语义检索 | 可选的中文 BGE small zh v1.5 INT8 由 Node worker 使用 ONNX Runtime WASM 在本机 CPU 运行。模型按需下载。SQLite 保存可重建的向量索引。 |
| 共享界面 | React 19、Vite 8、TypeScript。beUI 组件以源码引入，Tailwind 4 和 Motion 用于样式与交互，Desktop/Web 构建均携带 beUI 许可证。 |
| 桌面宿主 | Tauri 2、Rust 1.90+，使用 autostart 与 updater 插件。原生宿主负责本机凭据、IPC、启动和维护。 |
| 平台与外部依赖 | QQ 使用仓库内固定 NapCat 源码的本地构建产物和 OneBot；B站复用 whale，抽帧使用 ffmpeg；抖音使用专用 Chromium、Playwright/CDP、独立 Python FastMCP 辅助服务。按平台启用和准备相应依赖。 |
| 构建与检查 | npm scripts、TypeScript、Vitest、ESLint。发行准备与 Dockerfile 固定 Node 24.20.0，便携包携带目标平台的 Node 与生产依赖。 |

具体版本以 [package.json](../package.json)、[package-lock.json](../package-lock.json) 和 [Rust 清单](../apps/desktop/src-tauri/Cargo.toml) 为准。第三方代码来源与许可证见 [上游记录](../docs/upstreams.md)。

## 目录与职责

| 位置 | 职责 |
| --- | --- |
| `apps/runtime/src/` | `main.ts` 是后台入口。`host/` 管本机 HTTP、进程与生命周期，`storage/` 管数据库和数据目录，`permissions/` 管本机文件权限。`tasks/`、`maintenance/`、`plugins/`、`web/` 分别负责调度、维护、第三方扩展和浏览器网关。 |
| `apps/runtime/src/ai/` | `chat/` 处理对话，`models/` 管模型配置和连接，`engine/` 对接推理引擎；人设在 `persona/`，音频输入与朗读在 `media/`。 |
| `apps/runtime/src/memory/` | 从对话学习在 `learning/`，会话笔记在 `notes/`；人物、场景、回忆检索分别在 `identity/`、`scenes/`、`recall/`，心情与日记在 `life/`。 |
| `apps/runtime/src/channels/` | QQ 自动回复、群互动、账号操作和表情分别在 `replies/`、`groups/`、`account/`、`stickers/`；`onebot/` 负责传输，`managed/` 管理本机 QQ 组件。 |
| `apps/cli/src/` | `main.ts` 分派命令，`commands/` 处理子命令，`io/input.ts` 读取输入，`runtime/` 负责客户端请求和进程控制。 |
| `apps/desktop/src/features/` | 桌面和 Web 共用聊天、连接、我的鱼、设置四块业务界面。`connections/` 下按 QQ、B站、抖音分目录，通用连接状态与操作记录在 `connections/shared/`；`fish/` 下按记忆（`memory/`）、经历（`life/`）、活动（`activities/`）归档。 |
| `apps/desktop/src/components/`、`apps/desktop/src/api/` | 前者是跨页面通用控件和 beUI，后者封装请求与事件传输。共享钩子、样式和静态资源分别放在同级的 `hooks/`、`styles/`、`assets/`。 |
| `apps/desktop/src-tauri/src/`、`apps/web/src/` | 前者是 Rust 宿主，后者提供浏览器登录及 Web 管理设置，复用桌面业务组件。HTTPS 网关位于 `apps/runtime/src/web/`。 |
| `apps/runtime/src/bilibili/adapter/`、`apps/runtime/src/douyin/adapter/` | B站和抖音的内置适配脚本、固定上游资源与许可证。抖音独立运行的 Python 辅助服务位于 `services/douyin/`。 |
| `plugins/sdk/`、`examples/hello-fish/` | 第三方扩展的源码 SDK 与示例，不用于安装内置平台。 |
| `third_party/napcat/` | 原样保存的 NapCat 固定源码、许可和预编译资源；独立上游 workspace 仅用于第三方构建，不属于大肥鱼业务分包。自有构建入口为 `scripts/napcat/build-napcat.mjs`。 |
| `scripts/` | `dev/` 管开发进程，`build/` 处理共用构建资源，`napcat/` 构建内置 QQ 组件，`release/` 准备发行与更新，`smoke/` 是专项冒烟检查。常用入口仍通过根 npm 命令运行。 |
| `tests/integration/`、`tests/fixtures/` | 跨模块测试按业务分组；测试用的桌面页面、平台响应和本机进程等夹具另放在 `fixtures/`。模块级测试与实现放在一起。 |
| `infra/docker/`、`infra/systemd/` | Linux 容器、Compose 和用户级 systemd 部署，不放应用业务代码。 |
| `docs/`、`.github/` | 使用与开发指南、设计资料、阶段记录；贡献指南、安全问题报告和 CI 工作流。 |
| `constitution/`、`specs/`、`.ai/` | 长期项目约束、各项规格及验收、决策与协作规则。 |

## 开发、运行与部署

在仓库根目录执行以下命令。源码 CLI 使用编译后的入口；安装包的 CLI 使用随包 Node。

| 目的 | 命令 |
| --- | --- |
| 安装锁定依赖 | `npm ci` |
| 构建 Runtime/CLI 及其资源 | `npm run build:node` |
| 构建内置 NapCat | `npm run build:napcat`；`napcat:verify` 核对1111个原始文件。构建工具和生产依赖独立锁定；`desktop:dev` / `release:prepare` 自动调用，轻量 CI 不调用源码构建，只增加无需下载的组件夹具检查。 |
| 启动或查询后台 | `npm run cli -- start`、`npm run cli -- status`；以前台进程运行用 `npm run runtime` |
| 桌面联调 | `npm run desktop:dev` 编译并托管本仓库的 Runtime、Vite 和 Tauri。退出开发窗口时回收开发进程，后端源码变更后需重新运行。 |
| 构建桌面前端或 Web | `npm run build:desktop`、`npm run build:web`；`npm run build` 构建 Node 和两个前端。 |
| 生成便携目录或原生安装包 | `npm run release:prepare`、`npm run desktop:build` |
| 工程检查 | `npm run typecheck`、`npm run lint`、`npm test`；按变更风险选择相关检查，纯文档改动通常只核对 diff。 |
| CI 平台运行检查 | `npm run test:platform` 编译 Node 并运行进程、CLI、权限及维护边界测试；Linux、macOS、Windows 均执行。 |

CI 只做运行与编译：macOS/Windows 还编译真实桌面前端、以 debug 和 `tauri/custom-protocol` 编译 Rust 宿主并运行原生单元测试；Linux Docker job 编译 Runtime/Web 并运行隔离 smoke。桌面 job 通过仅 CI 的 `TAURI_CONFIG` 关闭资源复制，使用独立 Cargo 缓存；不生成安装器/便携包、不归档上传，也不重复全仓业务测试/typecheck/lint。本地打包命令保持不变。决策见 [CI 边界](../.ai/decisions/029-platform-ci.md)。

Linux 可运行便携包里的 `bin/bigfatfishd`，也可使用非 root Docker/Compose 或 systemd 用户服务。管理 API 仅监听回环；浏览器远程管理须单独配置并启动 HTTPS 网关。安装和备份步骤见 [安装与迁移](../docs/install-and-migrate.md)，插件协议和网关设置见 [开发者指南](../docs/developer.md)。

## 数据与协作约束

安装目录与用户数据分离。数据目录按 `--data-dir`、`BIGFATFISH_DATA_DIR`、操作系统默认目录依次选择，包含 `config/`、`data/`、`runtime/`、`logs/`。开发可显式选用 `.local/bigfatfish/`；自动化使用隔离临时目录。Runtime 管理 SQLite 事务、迁移、凭据和账号权限，前端与插件通过其公开能力访问数据。[数据路径实现](../apps/runtime/src/storage/paths.ts)

工程变更按 [项目协作规范](../.ai/AGENTS.md) 和 [当前交接](../.ai/prompts/task-handoff.md) 处理。Git 提交需要用户就相应任务明确授权；旧阶段记录中的持续提交授权已撤销。
