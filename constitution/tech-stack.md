# 技术栈与工程边界

BigFatFish 以一个 Node.js Runtime 管理一条鱼的数据和平台连接。桌面、浏览器和 CLI 共用 Runtime 的业务接口。仓库用 npm 单根依赖清单和 lockfile 管理 TypeScript 源码，跨入口复用普通模块。服务边界及请求流程见 [架构](../docs/design/architecture.md)。

## 运行与构建依赖

| 部分 | 选型与约束 |
| --- | --- |
| Runtime、CLI | Node.js `>=24.9.0 <25`、TypeScript 5.9、Fastify 5、WebSocket、内置 `node:sqlite`。命令入口为 `bigfatfishd` 和 `bigfatfish`。 |
| 引擎与模型 | `DSHAdapter` 实现 `AgentEngine`，使用固定的 DSH SDK 与模型适配包 `0.2.2-alpha.2`。Runtime 管理 OpenAI 兼容与 DeepSeek 聊天配置、模型发现和连接诊断。 |
| 共享界面 | React 19、Vite 8、TypeScript。beUI 组件以源码引入，Tailwind 4 和 Motion 用于样式与交互，Desktop/Web 构建均携带 beUI 许可证。 |
| 桌面宿主 | Tauri 2、Rust 1.90+，使用 autostart 与 updater 插件。原生宿主负责本机凭据、IPC、启动和维护。 |
| 平台与外部依赖 | QQ 使用原版 NapCat 和 OneBot；B站复用 whale，抽帧使用 ffmpeg；抖音使用专用 Chromium、Playwright/CDP、独立 Python FastMCP 辅助服务。按平台启用和准备相应依赖。 |
| 构建与检查 | npm scripts、TypeScript、Vitest、ESLint。发行准备与 Dockerfile 固定 Node 24.20.0，便携包携带目标平台的 Node 与生产依赖。 |

具体版本以 [package.json](../package.json)、[package-lock.json](../package-lock.json) 和 [Rust 清单](../apps/desktop/src-tauri/Cargo.toml) 为准。第三方代码来源与许可证见 [上游记录](../docs/upstreams.md)。

## 目录与职责

| 位置 | 职责 |
| --- | --- |
| `apps/runtime/src/` | `server.ts`、`lifecycle.ts` 等负责本机 API、实例与生命周期；`ai/`、`memory/`、`tasks/` 负责引擎、养成和调度。QQ 在 `channels/`，B站与抖音在 `bilibili/`、`douyin/`；存储、维护、插件与 Web 网关有独立模块。 |
| `apps/cli/src/` | `main.ts` 分派命令，`commands/` 处理子命令，`io/input.ts` 读取输入，`runtime/` 负责客户端请求和进程控制。 |
| `apps/desktop/src/` | React 入口和双端业务界面。`features/` 按聊天、连接、我的鱼、设置分区；`components/` 放通用组件和 beUI，`api/` 封装请求及事件传输，`hooks/`、`styles/`、`assets/` 放共享钩子、样式及资源。 |
| `apps/desktop/src-tauri/src/`、`apps/web/src/` | 前者是 Rust 宿主，后者提供浏览器登录及 Web 管理设置，复用桌面业务组件。HTTPS 网关位于 `apps/runtime/src/web/`。 |
| `plugins/`、`services/douyin/` | 随项目维护的平台适配代码、普通源码 SDK 和抖音 Python 辅助服务。第三方插件示例在 `examples/hello-fish/`。 |
| `infra/docker/`、`infra/systemd/`、`scripts/` | Linux 部署配置；构建资源复制、开发进程管理、独立发行及签名归档脚本。 |
| `tests/integration/`、`tests/fixtures/` | Vitest 跨模块检查、协议与界面夹具。模块级测试随源码存放。 |
| `docs/`、`.github/` | 使用与开发指南、设计资料、阶段记录；贡献指南、安全问题报告和 CI 工作流。 |
| `constitution/`、`specs/`、`.ai/` | 长期项目约束、各项规格及验收、决策与协作规则。 |

## 开发、运行与部署

在仓库根目录执行以下命令。源码 CLI 使用编译后的入口；安装包的 CLI 使用随包 Node。

| 目的 | 命令 |
| --- | --- |
| 安装锁定依赖 | `npm ci` |
| 构建 Runtime/CLI 及其资源 | `npm run build:node` |
| 启动或查询后台 | `npm run cli -- start`、`npm run cli -- status`；以前台进程运行用 `npm run runtime` |
| 桌面联调 | `npm run desktop:dev` 编译并托管本仓库的 Runtime、Vite 和 Tauri。退出开发窗口时回收开发进程，后端源码变更后需重新运行。 |
| 构建桌面前端或 Web | `npm run build:desktop`、`npm run build:web`；`npm run build` 构建 Node 和两个前端。 |
| 生成便携目录或原生安装包 | `npm run release:prepare`、`npm run desktop:build` |
| 工程检查 | `npm run typecheck`、`npm run lint`、`npm test`；按变更风险选择相关检查，纯文档改动通常只核对 diff。 |

Linux 可运行便携包里的 `bin/bigfatfishd`，也可使用非 root Docker/Compose 或 systemd 用户服务。管理 API 仅监听回环；浏览器远程管理须单独配置并启动 HTTPS 网关。安装和备份步骤见 [安装与迁移](../docs/install-and-migrate.md)，插件协议和网关设置见 [开发者指南](../docs/developer.md)。

## 数据与协作约束

安装目录与用户数据分离。数据目录按 `--data-dir`、`BIGFATFISH_DATA_DIR`、操作系统默认目录依次选择，包含 `config/`、`data/`、`runtime/`、`logs/`。开发可显式选用 `.local/bigfatfish/`；自动化使用隔离临时目录。Runtime 管理 SQLite 事务、迁移、凭据和账号权限，前端与插件通过其公开能力访问数据。[数据路径实现](../apps/runtime/src/paths.ts)

工程变更按 [项目协作规范](../.ai/AGENTS.md) 和 [当前交接](../.ai/prompts/task-handoff.md) 处理。Git 提交需要用户就相应任务明确授权；旧阶段记录中的持续提交授权已撤销。
