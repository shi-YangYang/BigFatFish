# BigFatFish

一条可以长期陪伴、积累记忆与经历的 AI 鱼。

大肥鱼可以在桌面和 Web 上与你聊天，也可以接入 QQ、B站和抖音。各入口共用人格、模型配置和记忆，桌面和 Web 的聊天历史只显示本地对话。

## 快速开始

从源码打开桌面版，需要 Node.js 24.9 或更高的 24.x、Rust 1.90+ 和本机的 Tauri 构建环境。在仓库根目录执行：

```bash
npm ci
npm run desktop:dev
```

首次设置完成后，到「设置 → 模型 → 新建配置」添加聊天模型。回到「聊天」即可发送第一条消息，回复会逐步显示。「我的鱼 → 设定」可以选择女儿版或傲娇版，也可以编辑完整人设。模型的测试、语音输入与朗读配置见[模型与聊天指南](docs/ai-core.md)。

使用独立 CLI 时，在安装源码依赖后执行：

```bash
npm run build:node
npm run cli -- start
npm run cli -- status
npm run cli -- logs --lines 30
npm run cli -- stop
```

`start` 等待服务真正就绪后返回；后台进程可脱离终端继续运行。`stop` 通过认证接口优雅关闭，等待实例锁释放后返回，不根据 PID 杀进程。`restart`、`doctor` 分别用于重启和诊断，所有命令支持 `--json`。

退出码：`0` 操作成功，`1` 参数、连接或执行失败，`status` 在尚未启动时返回 `3`。默认监听随机可用的 `127.0.0.1` 端口；`start --port 端口` 可以指定端口，不支持公网监听。

### 连接平台

| 入口 | 可以做什么 |
| --- | --- |
| [QQ](docs/qq.md) | 在「连接 → QQ」扫码，在手机上确认，再设置主人、允许私聊的好友和群。私聊和群聊在 QQ 中继续。 |
| [B站](docs/bilibili.md) | 扫码登录，在记录中查看观看结果，并把可分享的结果发给已授权的 QQ 对象。 |
| [抖音](docs/douyin.md) | 在专用浏览器中完成登录和验证，然后按授权范围执行互动。私信、分享和投稿的发送协议尚未接通。 |

大肥鱼先回复，再在后台按发言人和聊天范围整理称呼、偏好和已确定的安排。在「我的鱼 → 记忆」可以查重要事项、接着看上次聊到的场景，也可以查看人物资料。点开来源能看到当时的原话。年龄按本人陈述的日期记录，资料可以纠正或删除。这里也可以启用「按语义回忆」。「经历」可以查看时间线与生成日记。用法见[模型、人格与聊天](docs/ai-core.md)。

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

`npm run desktop:dev` 一起管理后台、前端和桌面窗口，默认沿用桌面已保存的数据目录、模型配置和聊天记录。启动时会核实并接管本仓库的旧后台。关闭开发窗口或按 Ctrl+C 会结束这次开发会话。修改后端源码后重新运行命令；前端和 Rust 支持热重载。

开发窗口保留备份检查、更新检查和离线签名验证；备份导出/恢复需先退出开发会话，再使用独立 CLI，安装更新需使用正常安装版。重启开发请退出后重新运行 `npm run desktop:dev`。

如需指定其他数据目录，显式环境变量优先，例如 macOS/Linux：

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

## 源码导航

| 要修改的内容 | 从这里开始 |
| --- | --- |
| 桌面与 Web 共用的业务页面 | `apps/desktop/src/features/` 下的 [聊天](apps/desktop/src/features/chat/)、[连接](apps/desktop/src/features/connections/)、[我的鱼](apps/desktop/src/features/fish/) 和 [设置](apps/desktop/src/features/settings/) |
| 通用组件和样式 | [组件](apps/desktop/src/components/)、[beUI](apps/desktop/src/components/beui/)、[样式](apps/desktop/src/styles/) |
| 界面如何访问后台 | [前端 API](apps/desktop/src/api/)、[Runtime 服务](apps/runtime/src/) |
| CLI 子命令 | [命令入口](apps/cli/src/main.ts)、[命令处理](apps/cli/src/commands/)、[输入](apps/cli/src/io/input.ts)、[Runtime 请求与进程控制](apps/cli/src/runtime/) |
| 桌面与浏览器各自的入口 | [Tauri 原生宿主](apps/desktop/src-tauri/)、[Web 入口](apps/web/src/) |

插件、辅助服务、部署与测试等目录见 [技术栈与工程边界](constitution/tech-stack.md#目录与职责)。

## 文档与参与

- 当前实现见[架构](docs/design/architecture.md)，立项时的目标见[产品设计原稿](docs/design/product-goals.md)。阶段目标见[开发路线](constitution/roadmap.md)。
- 安装与扩展见 [安装与迁移](docs/install-and-migrate.md) 和 [开发者指南与 SDK](docs/developer.md)。
- 参与开发前阅读 [项目协作规范](.ai/AGENTS.md)、[贡献指南](.github/CONTRIBUTING.md) 和 [当前规格](specs/README.md)。社区约定与安全问题报告见 [行为准则](docs/CODE_OF_CONDUCT.md) 和 [安全说明](.github/SECURITY.md)。

项目采用 [MIT 许可证](LICENSE)。集成第三方代码前需单独核对其许可证与使用条件。

QQ 真实账号已确认扫码登录和文字回复。图片识别、其他平台账号以及 Windows 安装的验证范围各自记录，详见[QQ 验证记录](docs/qq.md)和[开发记录](docs/progress/development.md)。
