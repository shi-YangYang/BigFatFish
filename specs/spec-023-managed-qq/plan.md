# Plan：内置管理 QQ 组件

## 实施范围与顺序
风险 S3：涉及安装外部执行组件、凭据、平台身份/授权、进程生命周期和跨入口认证接口。沿现有目录扩展 channels 普通模块，不拆包。

1. 固定原版组件来源、版本、哈希与平台启动要求；以官方源码核实登录、配置接口，不执行未经审阅的上游安装脚本。
2. Runtime channels 内实现组件安装/状态/启停与上游 WebUI 客户端。安装是可轮询的任务，长下载不得依赖短请求阻塞。平台操作使用结构化参数，不拼接用户输入的 shell。
3. 接入 Runtime 生命周期：仅创建/接管本 data-dir 标识的组件；先撤销渠道行为再停止组件。开发窗口退出时随 Runtime 停止，正式后台常驻时继续运行。失败不阻止本地聊天启动。
4. 图形登录：展示真实二维码、刷新和登录状态，登录后自动读取账号、创建仅回环且带随机凭据的 OneBot 连接。身份切换须撤销旧授权、阻止旧生成和发送；保持原插件在线检查。
5. 好友/群只读发现、明确主人和群授权；管理模式保存由 Runtime 填写内部参数，拒绝前端伪造账号/内部地址。外部模式兼容旧配置。
6. UI 从 Channels 中按职责提取登录/设置组件，Permissions 保持审批语义。账号状态与主操作在上方，回复设置在下方；已有服务和操作记录按需展开。beUI、浅海蓝、既有间距 token 与窄屏适配保持。
7. 更新 QQ 文档、上游记录、技术栈中本次相关边界；独立验收后本地 commit。

## 关键边界
- 用户已确认 Mac/Linux Docker、Windows 独立原生组件。使用本机 Docker，不连接任意远程 daemon；只暴露回环端口、挂载本实例目录，不使用 privileged/host network/docker socket 挂载。
- 安装 QQ/NapCat 原版到隔离组件位置，保留许可证/来源，不把受限组件代码或账号数据并入 MIT 源码。Windows 不修改系统 QQ 或依赖用户已有登录。
- 原生进程/容器识别不能仅凭模糊进程名或 PID。并发启停、失败和 Runtime 重启可恢复；不得误停别的 QQ 或 Docker 资源。
- 本地组件配置秘密以受限权限保存，数据库凭据沿用现有加密模块，查询和日志不输出秘密或二维码登录链接。前端获取二维码的认证链与其他管理接口一致；不开放任意 WebUI/OneBot 透传。
- 好友/群选择不默认全选，主人和群的授权保持明确。检查连接不发送真实消息。
- 备份和恢复不迁移登录态、宿主二进制或容器标识，已有恢复停用语义保持。
- 下载校验、解包路径/大小、符号链接、已有目标替换和运行环境检查须在正确安装职责层实现。

## 上游证据
研究 Agent `/root/research_managed_napcat` 只读核查，具体接口证据暂存 `build/research/napcat-api/`；最终固定值由实施报告补充。

- 原版 NapCat v4.18.42，commit `9335843246e3b7a17944861f3ac8731a259732c2`。
- 官方 Shell.zip SHA256 `02e5ff0f79916c1e04c81c1b4590056406fb4293f1f1300c955e71fd08b2829d`；Windows.Node.zip SHA256 `77397ac38d66f46383e48f08f35d5f9d37ec575c22069f62d6c600e73b4521ed`。
- [NapCat 许可](https://github.com/NapNeko/NapCatQQ/blob/9335843246e3b7a17944861f3ac8731a259732c2/LICENSE)：采用未修改原版组件，独立标示来源与条款。
- 官方 macOS 安装器修改 `/Applications/QQ.app` 并共用 `~/Library/Containers/com.tencent.qq/Data`，不用于本项目。

## 验证计划与停止条件
- 定向测试覆盖组件所有权、启停/失败、校验和隔离、登录配置/凭据/账号变更及外部模式兼容。现有 QQ 权限回归只执行与本次改动直接相关用例。
- Node 与 apps 类型/构建验证接口闭合；不默认完整项目测试。若不改 Rust，无需机械运行 Rust 构建。
- 当前 Mac 以隔离数据目录实际安装并启动原版 Docker 组件，验证认证 WebUI 与二维码获取，随后停止本次资源；不登录真实账号、不发消息。
- UI 使用实际页面和隔离 fixture 目视未安装、扫码、已登录配置、已有服务及 380px 窄屏。不得把 fixture 在线状态当真实 QQ 验证。
- 新的独立验收 Agent 审阅 Spec、diff 与证据，不重复已通过检查。Windows 无实机，明确记录限制。
- 目标满足、diff 正确、必要检查通过后停止，不扩大到无关平台、模型或旧阶段待验项。

## 实施报告
待实施 Agent 补充实际修改、验证结果和限制。

## Implementation Report（2026-11-04）

### Summary / 根因与职责层
原有渠道只有 OneBot 客户端，页面被迫要求用户准备外部服务并手填连接与身份。新增 Runtime `channels/managed` 负责原版组件准备、隔离进程、真实登录接口和内部参数；现有 Channels/QQ 插件继续负责消息、身份、记忆和审批。Desktop 不直接控制系统进程或绕过核心权限。状态轮询与表单草稿分离，保存使用表单加载时的 revision，异步失败保留草稿。

### Files Changed
- `apps/runtime/src/channels/managed/{types,client,platform,service}.ts`：固定上游下载、组件所有权、异步任务、WebUI 认证、二维码、只读 OneBot 联系人发现与明确授权。
- `unzip.ps1`：Windows 固定 SHA256 包校验之后，限制路径、符号链接、条目数和解压大小；`windows-job.ps1` 复用本项目已有 Job Object 方案，原版 Node/QQ 子树受管，父输入关闭时退出并清理。
- 渠道 types/protocol/routes：兼容旧外部配置，新增 `mode`；普通配置接口拒绝伪装管理模式；已有 start 入口可恢复受管组件并核对账号，账号变化不恢复旧授权。
- Runtime lifecycle / copy-runtime-assets：组件进入同一关闭链，插件停用也停用受管组件；程序资源包含两份 PowerShell 辅助脚本。
- `QQConnection.tsx`、Channels、Workspaces、style、api：beUI 图形化登录和回复配置；同宽 QQ 工作区包含消息/审批折叠；已配置的外部服务保留。内部地址/token/机器人账号不出现在快速连接表单。
- `tests/integration/managed-qq.test.ts`、QQ/上游文档、README 与技术栈。

### Important Decisions
- 上游原版 NapCat v4.18.42 / commit `9335843246e3b7a17944861f3ac8731a259732c2`；不复制上游源码，无新 npm 依赖或数据库 migration。
- Mac/Linux 固定 `mlikiowa/napcat-docker@sha256:696e9574a0f6fb2f86cbecba8a32048f2a5823117dc9b13c6c02637ad890fa8b`。官方 manifest 提供 amd64/arm64；Docker 本机 endpoint 显式绑定，非本机 context 拒绝；只管理名称+实例标签+数据根标签+image 均匹配的容器。
- 容器使用用户 UID/GID、仅回环端口、实例目录挂载、no-new-privileges 和禁用 Docker 原始日志。原版 entrypoint 已由 root 从固定镜像提取审阅；不启用 privileged、host network 或 socket 挂载。
- Windows x64 使用原版 Windows.Node 包（固定 SHA256 见上文），隔离 `NAPCAT_QQ_DATA_DIR` / `NAPCAT_WORKDIR`；不改系统 QQ/注册表，不 repurpose HOME。Windows arm64 明确不支持内置模式。
- 内置秘密在受限组件文件中保存，OneBot 渠道凭据沿用数据库加密。API 仅返回二维码图和必要状态，不返回 token/credential/扫码 URL；无任意 WebUI/OneBot action 透传。
- 安装/启动/刷新/停止/保存为短请求启动的可轮询任务。停止取消未完成启动，Runtime 关闭等待迟到创建后的清理；不靠模糊进程名杀进程。损坏或不安全的组件状态仅禁用组件，不阻断本地 Runtime。
- 用户主动「暂停回复」保留组件；停用组件及插件同时撤销渠道。便携逻辑备份不包含登录态/程序；同机更新回滚仍遵循既有私有快照策略。

### Validation
- Risk Level: S3，仅针对组件安装、身份、隔离、进程和跨入口风险。
- `npx vitest run tests/integration/managed-qq.test.ts apps/runtime/src/channels/protocol.test.ts`：6/6 PASS（6.73s）。涵盖真实 HTTP WebUI 鉴权与一次续期、HTTP200 业务错误、真实 WebSocket 身份/联系人、未授权不启用、账号改变撤权、无发送 action、安装取消、损坏组件状态不影响 Runtime，以及关闭期间迟到创建资源的清理。
- 为新增兼容的 CLI/旧 API managed start 恢复路径，定向重跑 `npx vitest run tests/integration/managed-qq.test.ts -t 'managed preparation'`：1/1 PASS（其他三项按命令筛选，6.62s）。原 owner/groups 在同账号确认后恢复，跨账号不复用。
- `npm run build:node`、`npx tsc --noEmit --project build/chat-experience/tsconfig.json` PASS。初次 apps 类型检查发现 DOM ReadableStream 异步迭代类型不兼容，改为有界 reader 后通过；随后只因相关生命周期/状态代码变化重跑必要检查。
- `npm run build:desktop` PASS（164ms）；既有 beUI/依赖 `use client` 与 chunk 大小警告保留。后续仅工作区宽度、状态去重与错误草稿保护变动已通过 apps 类型检查，未为文案/样式重跑构建。
- `git diff --check` PASS。
- Root 已实际验证隔离 macOS arm64 Docker 链：missing → installing → ready → starting → login（真实二维码）→ stopping → ready → Runtime close；确认所属容器、Runtime 连接文件均清理。证据 `build/managed-qq-live/evidence.json`，二维码为私有本地产物；未登录或发送。
- Root 已通过 CUA 操作实际 React/beUI 页面，隔离 fixture 验证准备→启动→二维码、好友选择、明确群选择、保存、已有服务及组件错误。1000px 工作区与表单均为 760px；380px 页面无横向溢出，工作区/表单/账号卡均为 333px，保存/暂停按钮均为 40px。初次发现底部操作记录宽度不同，已统一 QQ 工作区并复查。截图 `build/managed-qq-ui/02-login.png`、`03-online.png`、`05-narrow-controls.png`、`06-external-narrow.png`、`07-error.png`、`08-final.png`；01 为修正前历史，最终以 08 和 05 为准。界面账号/联系人/二维码均为 fixture，不替代上条真实组件二维码证据。未执行原生 Windows 或真实账号操作。实施 Agent 不冒称独立验收。

### Known Limitations / Remaining Questions
Windows 原生 Job Object/解包/登录未实机验证；无真实 QQ 扫码、好友/群获取或收发消息证据。真实二维码验证不等同账号在线。首次 Docker 镜像下载约 600MB，受网络与 Docker 环境影响。无产品决策遗留；新的独立验收 `/root/accept_managed_qq` 已 PASS，完整报告见 acceptance.md。隔离 UI 服务/标签页、真实组件和 Runtime 均已停止；用户真实数据/QQ/Runtime 未改变。root 按持续阶段授权本地 commit，不 push 或切分支；具体提交以 git log 为准。
