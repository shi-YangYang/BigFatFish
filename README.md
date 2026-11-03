# BigFatFish

一条可以长期陪伴、积累记忆与经历的 AI 鱼。

BigFatFish 通过同一个独立 Runtime 提供桌面、命令行和无界面服务入口。人格、记忆、模型配置与权限将由 Runtime 统一管理，通过插件接入 QQ、B站、抖音等平台。

## 当前状态

已具备统一 Runtime、CLI、DSH 聊天、人格、长期记忆、日记和养成主页。QQ、B站及抖音的本机代码路径已通过独立验收；抖音私信、分享、投稿的发送协议尚未完成，当前不可执行。真实平台账号和云模型仍有待验证。

P6 本地代码及三项返工已通过独立验收：已生成内置 Node 的 macOS 安装包和独立 CLI，完成本机安装、向导、后台运行、备份恢复及 Linux Docker/systemd 实跑。原生更新已实际从 0.1.0 安装并重启至 0.1.1，再人工回退旧应用与原数据。安装后的用户不需要开发工具；具体步骤见 [安装、运行与迁移](docs/install-and-migrate.md)。本地 macOS 产物使用 ad-hoc 签名，尚无正式签名、公证或发行；Windows 安装未实测。

P7 的 HTTPS 控制台、可安装插件与 SDK、DSH 工具调用、语音和 QQ 媒体已实现，本地代码及三项返工已通过独立验收，已有安装产物和原生运行证据。控制台默认关闭；插件权限与实际系统权限、远程配置和开发步骤见 [开发者指南](docs/developer.md)。

源码开发需要 Node.js 24.9 或更新的 Node 24；发行准备使用固定 Node 24.20.0，原生编译需要 Rust 1.90+ 与对应系统的 Tauri 构建环境。各平台的证据见 [实现状态](IMPLEMENTATION_STATUS.md)，CI 配置不等于已执行验证。

## 快速开始

```bash
npm ci
npm run build
npm run cli -- start
npm run cli -- status
npm run cli -- logs --lines 30
npm run cli -- stop
```

`start` 等待服务真正就绪后返回；后台进程可脱离终端继续运行。`stop` 通过认证接口优雅关闭，等待实例锁释放后返回，不根据 PID 杀进程。`restart`、`doctor` 分别用于重启和诊断，所有命令支持 `--json`。

退出码：`0` 操作成功，`1` 参数、连接或执行失败，`status` 在尚未启动时返回 `3`。默认监听随机可用的 `127.0.0.1` 端口；`start --port 端口` 可以指定端口，不支持公网监听。

### 配置模型并聊天

桌面与 Web 默认进入「聊天」；侧栏为「聊天」「我的鱼」「连接」，底部进入「设置」。历史对话从聊天顶部的时钟按钮按需打开，选择后自动收起。先在「设置 → 模型」填写服务地址、模型名称和密钥，再开始对话。「我的鱼 → 设定」中的设置会持久保存并保留版本。CLI 也可通过 JSON 标准输入配置和聊天，详见 [模型与聊天指南](docs/ai-core.md)。实际云模型调用需用户自己的配置；本项目测试模型只用于验证协议。

在「我的鱼 → 记忆」中从已完成的聊天提取候选，核对来源后确认、编辑或拒绝；确认后可在后续聊天检索。「我的鱼 → 经历」可生成指定日期的日记、查看真实活动时间线。记忆可导出为 JSON 或 Markdown，具体命令与数据范围见 [记忆与生活](docs/ai-core.md#记忆与生活p2)。

### 数据位置

`--data-dir PATH` 优先于 `BIGFATFISH_DATA_DIR`，否则使用：

| 系统 | 默认数据目录 |
| --- | --- |
| macOS | `~/Library/Application Support/BigFatFish` |
| Windows | `%LOCALAPPDATA%\BigFatFish` |
| Linux | `$XDG_DATA_HOME/bigfatfish`，默认 `~/.local/share/bigfatfish` |

目录分为 `config/`、`data/`、`runtime/`、`logs/`。连接凭据仅保存在受限本机文件中，管理接口需要认证。数据目录应位于本机文件系统，单实例锁依赖 SQLite 文件锁，不支持网络共享目录。

隔离开发数据的例子：

```bash
npm run cli -- start --data-dir .local/bigfatfish
npm run cli -- status --data-dir .local/bigfatfish --json
npm run cli -- stop --data-dir .local/bigfatfish
```

启动失败时可检查对应数据目录的 `logs/bootstrap.log`。`logs` 命令读取运行中服务的结构化日志，每次最多 200 行。

### 桌面开发

准备独立运行资源后启动开发桌面；已有同目录 Runtime 会复用：

```bash
npm run release:prepare
npm run desktop:dev
```

使用自定义数据目录时，桌面与 CLI 必须指向同一位置，例如 macOS/Linux：

```bash
BIGFATFISH_DATA_DIR="$PWD/.local/bigfatfish" npm run desktop:dev
```

Windows PowerShell 可先设置 `$env:BIGFATFISH_DATA_DIR = Join-Path $PWD '.local/bigfatfish'`。`npm run frontend:dev` 仅打开前端预览；真实本机状态通过桌面原生宿主读取，不向普通网页提供连接凭据。

### 验证与 Linux 运行

```bash
npm run typecheck
npm run lint
npm test
npm run build
npm run desktop:build
node scripts/smoke.mjs

docker build -f infra/docker/Dockerfile -t bigfatfish:local .
docker run --rm bigfatfish:local node scripts/smoke.mjs
```

测试和 smoke 使用临时目录并清理自己的后台进程。`desktop:build` 准备独立资源并生成本机安装包；macOS 使用本地 ad-hoc 签名，不执行公证或发布。Docker 默认以非 root 用户运行前台 Runtime，管理接口保留在容器 loopback 内；Compose 持久卷、systemd 用户服务及备份操作见 [安装指南](docs/install-and-migrate.md)。

## 目录

- `apps/runtime/src/`：Runtime API、生命周期、数据和存储模块。
- `apps/cli/src/`：命令行与后台进程连接。
- `apps/desktop/`：React 界面与 `src-tauri/` 原生宿主。
- `apps/web/`：浏览器入口，复用现有界面组件，通过认证网关访问 Runtime。
- `tests/`、`scripts/`：集成验证与实际运行检查。
- `infra/`：Docker/Compose 与 systemd 部署。
- `plugins/`、`services/`：平台插件源码与 Python 等辅助服务。
- `constitution/`、`specs/`、`.ai/`：项目约束、规格与协作治理。

JavaScript 工程使用单根依赖清单和锁文件，源码按职责组织为普通模块，不建立独立公共包。

## 文档与参与

- [产品设计目标](BigFatFish_产品设计目标.md) · [项目使命](constitution/mission.md) · [路线](ROADMAP.md) · [架构](ARCHITECTURE.md)
- [实现状态](IMPLEMENTATION_STATUS.md) · [协作规范](AGENTS.md) · [Spec 管理](specs/README.md)
- [贡献指南](CONTRIBUTING.md) · [行为准则](docs/CODE_OF_CONDUCT.md) · [安全说明](SECURITY.md) · [变更记录](CHANGELOG.md)
- [开发者指南与 SDK](docs/developer.md) · [安装与迁移](docs/install-and-migrate.md)

项目采用 [MIT 许可证](LICENSE)。集成第三方代码前需单独核对其许可证与使用条件。

QQ 渠道的安装、主人/群授权、媒体范围与审批用法见 [QQ 渠道](docs/qq.md)。

B站的登录、观看、证据范围与 QQ 分享审批见 [B站使用说明](docs/bilibili.md)。

抖音专用浏览器、依赖安装、互动审批与统一自主/定时活动见 [抖音与调度使用说明](docs/douyin.md)。
