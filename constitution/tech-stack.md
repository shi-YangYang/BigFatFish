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
| `apps/web/` | React 浏览器入口与 Web 设置，复用桌面业务组件；TLS 网关在 Runtime 的 web 模块 |
| `apps/desktop/src-tauri/src/` | Rust 桌面外壳与本机进程连接；窗口关闭与停止 Runtime 分离 |
| `plugins/` | 随项目维护的平台与能力插件源码，不是用户安装插件的数据目录 |
| `services/` | 按需接入的 Python 等独立辅助服务 |
| `infra/docker/`、`infra/systemd/` | 非 root Docker/Compose 与 systemd 用户服务；P6 已有隔离 Linux 实例运行证据，本地代码返工独立PASS |
| `scripts/` | Runtime 资源复制、CLI smoke、独立发行包与桌面更新归档生成 |
| `tests/integration/`、`tests/e2e/` | Vitest 跨模块集成与后续端到端测试；局部单元测试随模块放置 |
| `docs/` | 上游研究、开发者详细文档和 docs/progress 连续记录；最新全阶段任务指定的产品原稿及 ROADMAP/CHANGELOG/ARCHITECTURE/CONTRIBUTING/SECURITY/IMPLEMENTATION_STATUS 位于根目录 |
| `constitution/`、`specs/`、`.ai/` | 项目约束、规格与 Agent 协作治理，遵守根 AGENTS.md |

这些目录是按产品边界建立的源码位置；后续可在内部扩展，不能未经用户授权迁移。仅使用 `.gitkeep` 保存空目录，不把空目录声称为已工作的应用、插件或服务。P7 Web 新增入口源码，保持单根依赖清单与既有业务目录。

## 工程惯例依据

- `apps/` 按 Runtime、CLI、Desktop 划分入口源码。用户明确选择普通源码模块封装，不建立独立公共包或多包 workspace；不为复用增加独立 package.json、版本管理和发布流程。
- 桌面前端与 `src-tauri/` 的位置遵循 [Tauri 2 官方目录说明](https://v2.tauri.app/start/project-structure/)。
- P0 采用 Node 24、npm 单根依赖清单与 package-lock，Fastify、node:sqlite，React/Vite/Tauri2，Vitest/ESLint。依赖实际版本在 registry 核实后锁定，详见 Decision 002。

## 模块封装与复用

后端以职责明确的普通源码模块组织，例如服务模块、工具模块和适配器；前端使用组件和 hooks。模块通过明确的导出接口调用，不为拆分而增加包管理层。

AgentEngine 抽象、DSHAdapter、插件管理和相关类型先在 apps/runtime/src 内按实际实现封装。跨入口确实需要共享的纯类型、工具或请求代码，再提取为普通共享源码模块，不预建空 shared 目录。P7插件SDK已在plugins/sdk以普通源码模块提供，不建立独立npm包。共享模块不承载绕过 Runtime 的数据库或平台控制入口。

## 依赖方向与数据边界

`Desktop / CLI / Web → Runtime API/IPC → Runtime 内部模块 → engine / plugins / storage`。

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

运行命令以根 package.json 和 README 为准，模型/人格/会话及记忆/生活用法见docs/ai-core.md，QQ用法见docs/qq.md，B站用法见docs/bilibili.md，抖音/活动/调度见docs/douyin.md。P1经真实DSH、CLI、桌面与Linux镜像验证；P2记忆与P3 schema4/channels/内置QQ插件及审批的本机路径和返工已独立PASS。P4新增schema5视频任务、Runtime bilibili模块及固定whale插件依赖闭包；qrcode1.5.4由根管理，ffmpeg为明确外部依赖，统一DSH接受有界图像，本机检查与独立代码验收通过。

P5新增schema6活动/请求映射/计划、共用permissions审批、douyin浏览器/MCP与ai/media。根管理playwright-core1.58.2，Python辅助服务在services/douyin，固定依赖/完整锁定清单与独立venv步骤见使用文档；实际浏览器由Runtime拥有，Python严格CDP复用。ASR用统一配置的OpenAI兼容转写接口，P7补统一TTS消费者。核心本机链路、headless React和原生Mac操作已有证据；本地代码返工已独立PASS。HTTP重定向/Worker按实际target归属检查，未知WS/WSS由启动前本机拒绝代理拦截；专用浏览器HTTP/HTTPS直连、不继承系统代理。DM/分享/上传发布wire未确认而拒绝，部分实现。阶段结果见 [实际状态](../IMPLEMENTATION_STATUS.md) 和 [开发记录](../docs/progress/development.md)，未完成验证不得写成通过。

P6 实施完成，本地代码返工独立PASS。`maintenance/` 统一一致快照、选择性逻辑归档、凭据加密、恢复与更新 journal；CLI 和桌面调用同一核心。固定锁在 runtime 分区，更新保留旧程序与数据；macOS 首次启动失败后使用显式人工回退。安装与迁移说明见 [docs/install-and-migrate.md](../docs/install-and-migrate.md)。

发行包固定官方 Node 24.20.0，按目标系统校验并安装生产依赖；构建暂存 manifest 不构成源码分包。`npm run release:prepare` 生成 portable 资源，`npm run desktop:build` 准备资源后执行 Tauri 真实 bundle；`desktop:dev` 前也须准备资源。Rust 最低 1.90，autostart 2.7.0、updater 2.14.1；桌面采用官方 Minisign 与签名版本绑定，portable 使用 Ed25519 签名清单，均无默认测试信任源。根 tar 7.5.22 用于受限解包。

Mac 已有 ad-hoc app/DMG 安装与实际升级/人工回退，Linux arm64 portable、Docker/Compose/systemd 已有运行证据；Windows 构建及实机、正式签名公证与发布、跨 schema 升级、实际注销/重启仍未验证。现有 schema 仍为 6，本地代码验收不等同完整跨平台交付。

P7 本地代码及三项返工已通过新的独立验收，最终Mac app/DMG/portable资源一致。web 模块使用独立 TLS 网关/登录会话代理同一 Runtime；维护期间网关存活，调用原核心停服、维护和重启。`web configure/serve` 显式启用；网关锁阻止在线换密，停止后配置重启撤销旧会话。schema 保持 6，SDK 状态复用 plugin_config；逻辑备份去除插件安装路径、安装状态和授权，不迁移 Web 会话。

SDK 源码在 `plugins/sdk/`，示例在 `examples/hello-fish/`，无独立 npm 包。build:node 生成随包平台目录、SDK 和示例，build:web 生成 dist/web，根 build 构建各入口，release:prepare 包含 Web。动态插件以受限 RPC 访问宿主能力，真实系统权限仍属于运行用户；平台适配沿用各自可信执行方式。详细协议、有限 schema、模型/媒体消费者及开发命令以 [开发者指南](../docs/developer.md) 为准。

P7 Linux发行补充：Docker构建同时运行build:node/build:web；Linux/arm64镜像和独立归档的SDK/真实DSH工具/TLS入口已在非root隔离容器实跑并获新独立PASS，未重新覆盖裸机/x64或P6完整维护矩阵。该轮证据见Spec009 Plan与本机build/p7-evidence。

后续Mac↔Linux arm64迁移发现并修复共用CLI stop提前成功：连接消失不足以证明停机，现等待实例锁释放并在锁内复核身份；维护操作仍独立取锁。新产物完成无绕行的直接备份/恢复、DSH续聊和记忆/凭据/恢复失权验证，经新的独立验收PASS。当前Mac portable/app/DMG及Linux归档/镜像均已同步，最终路径与哈希见Spec008 Plan和本机build/p6-stop-rework/evidence.json；之前产物哈希保留为历史，Windows/真实云账号/跨schema限制不变。
