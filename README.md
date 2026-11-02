# BigFatFish

一条可以长期陪伴、积累记忆与经历的 AI 鱼。

BigFatFish 通过同一个独立 Runtime 提供桌面、命令行和无界面服务入口。人格、记忆、模型配置与权限将由 Runtime 统一管理，通过插件接入 QQ、B站、抖音等平台。

## 当前状态

P0 已具备可运行的本地 Runtime、后台进程管理 CLI、SQLite 基础存储，以及读取真实服务状态的 React/Tauri 桌面壳。P1 已加入 DSH 驱动的模型配置、人格、会话和流式聊天；养成、平台连接和正式安装包属于后续阶段。桌面壳目前需要先通过 CLI 启动服务，关闭窗口不会停止服务。

开发运行依赖 Node.js 24.9 或更新的 Node 24；桌面原生编译还需要 Rust 与对应系统的 Tauri 构建环境。尚未提供内置 Node 的独立安装包。各平台的实际验证范围见 [实现状态](IMPLEMENTATION_STATUS.md)，CI 配置不等于已经执行的跨平台验证。

## 快速开始

```bash
npm ci
npm run build
npm run cli -- start
npm run cli -- status
npm run cli -- logs --lines 30
npm run cli -- stop
```

`start` 等待服务真正就绪后返回；后台进程可脱离终端继续运行。`stop` 通过认证接口优雅关闭，不根据 PID 杀进程。`restart`、`doctor` 分别用于重启和诊断，所有命令支持 `--json`。

退出码：`0` 操作成功，`1` 参数、连接或执行失败，`status` 在尚未启动时返回 `3`。默认监听随机可用的 `127.0.0.1` 端口；`start --port 端口` 可以指定端口，不支持公网监听。

### 配置模型并聊天

启动桌面后，在「模型」中填写服务地址、模型名称和密钥，再创建对话。「人格」中的设置会持久保存并保留版本。CLI 也可通过 JSON 标准输入配置和聊天，详见 [模型与聊天指南](docs/ai-core.md)。实际云模型调用需用户自己的配置；本项目测试模型只用于验证协议。

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

先启动 Runtime，然后运行：

```bash
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

测试和 smoke 使用临时目录并清理自己的后台进程。`desktop:build` 生成原生可执行文件，不执行签名或安装包发布。Docker 默认以非 root 用户运行前台 Runtime，管理接口保留在容器的 loopback 内；可通过容器中的 CLI 操作，后续部署与备份方案见路线。

## 目录

- `apps/runtime/src/`：Runtime API、生命周期、数据和存储模块。
- `apps/cli/src/`：命令行与后台进程连接。
- `apps/desktop/`：React 界面与 `src-tauri/` 原生宿主。
- `tests/`、`scripts/`：集成验证与实际运行检查。
- `infra/`：Docker 及后续 systemd 部署。
- `plugins/`、`services/`：后续平台插件与辅助服务。
- `constitution/`、`specs/`、`.ai/`：项目约束、规格与协作治理。

JavaScript 工程使用单根依赖清单和锁文件，源码按职责组织为普通模块，不建立独立公共包。

## 文档与参与

- [产品设计目标](BigFatFish_产品设计目标.md) · [项目使命](constitution/mission.md) · [路线](ROADMAP.md) · [架构](ARCHITECTURE.md)
- [实现状态](IMPLEMENTATION_STATUS.md) · [协作规范](AGENTS.md) · [Spec 管理](specs/README.md)
- [贡献指南](CONTRIBUTING.md) · [行为准则](docs/CODE_OF_CONDUCT.md) · [安全说明](SECURITY.md) · [变更记录](CHANGELOG.md)

项目采用 [MIT 许可证](LICENSE)。集成第三方代码前需单独核对其许可证与使用条件。
