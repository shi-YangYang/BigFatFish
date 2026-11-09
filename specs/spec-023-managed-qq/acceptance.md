# Acceptance

## Result
PASS

2026-11-04，独立验收 Agent `/root/accept_managed_qq`；验收基线为 `dev` / `618d7f8` 上的本次工作区改动，包含未跟踪的 managed QQ 模块、UI、测试及任务文档。未修改业务代码，未执行 Git 写操作。

## Spec Coverage
- 快速连接只展示组件准备、登录账号及回复授权；内部地址、端口、凭据由 Runtime 管理。已有服务入口按需切换，旧配置未带 `mode` 时仍按外部配置处理。
- 固定原版 NapCat 来源、版本、Docker digest 与 Windows ZIP SHA256；下载、解包和平台启动集中在组件模块。保留上游许可说明，不复制或修改上游源码，不修改系统 QQ。
- WebUI 鉴权、一次凭据续期、登录状态、二维码刷新和 OneBot 配置使用固定上游契约。审阅上游 `auth.ts` / `response.ts` 确认 Unauthorized 为 HTTP 200 的业务错误，与客户端及测试一致；`SetConfig` 使用上游要求的 JSON 字符串。
- 主人和群由本机用户明确选择；配置前复核 OneBot 身份/在线，拒绝机器人作为主人及过期 revision。账号变化撤销旧渠道授权；主动消息审批、既有插件健康检查和群权限规则继续由原 Channels 层执行。
- Docker 仅本地 endpoint、回环映射和本实例挂载；删除前核对名称、实例标签、数据根及镜像。Windows 使用独立目录和 Job Object 管理进程树。秘密只写私有组件文件及原有加密配置，不进入状态接口或原始日志。
- 停止取消未完成任务并等待迟到资源清理；Runtime 关闭、插件停用与渠道撤权接入现有生命周期。损坏组件状态不阻断本地 Runtime。已保存管理配置可经旧 start 入口恢复，同账号确认后才复用授权。
- UI 沿用 beUI 和现有主题/间距；草稿 revision 与轮询分离，异步保存失败保留草稿和错误。最终截图中工作区、账号卡和操作区对齐，窄屏无横向溢出，按钮高度一致。
- 变更限定于 QQ 托管、对应 UI、资源复制及文档；没有新增包、依赖、数据库迁移或无关业务重构。

## Validation
- Risk Level: S3。风险来自外部组件安装、私有凭据、账号授权和进程生命周期，检查范围限定上述直接路径。
- Evidence Reviewed / Checks Performed:
  - 阅读 AGENTS、constitution、全部有效 `.ai/rules`、Spec、Plan/Implementation Report、Decision014 和当前 handoff；独立审阅相关 tracked diff 及 untracked 新文件。
  - 审阅既有定向测试及实施报告：managed QQ + protocol 6/6 通过；新增 managed resume 路径的定向测试 1/1 通过。覆盖真实 HTTP/WS 夹具的鉴权续期、二维码、身份/联系人、显式授权、配置冲突、账号变化撤权、取消、损坏状态及关闭期间迟到资源清理。
  - 审阅已通过的 Node 构建、apps 类型检查、Desktop 构建与 diff 检查记录；未机械重复执行。现有证据及静态审查未产生需要新测试复现的具体问题。
  - 独立读取 `build/managed-qq-live/evidence.json`：实际 macOS arm64 Docker 完成 missing → installing → ready → starting → login，取得真实二维码，再停止并关闭 Runtime；证据确认所属容器及 Runtime 连接文件已删除。
  - 实际目视 `build/managed-qq-ui/08-final.png`、`05-narrow-controls.png`、`07-error.png`，结合协调 Agent 的 CUA 操作记录与几何证据：1000px 页面工作区宽 760px；380px 文档宽 380px、工作区/账号卡宽 333px，保存/暂停按钮高 40px。准备、扫码、好友/群选择、保存及外部模式的界面操作使用隔离 fixture。

## Issues
未发现本次范围内需要返工的问题。

## Regression Risks
- Windows x64 原生安装、PowerShell 解包、Job Object 及实际登录未在 Windows 实机执行；Windows arm64 明确不支持内置模式。本次 PASS 不代表 Windows 实机通过。
- 真实 Docker 证据止于二维码获取和资源清理，没有扫描登录、真实好友/群读取或真实消息收发；在线与联系人交互的自动检查和 UI 证据来自隔离 fixture。
- Linux 使用同一 Docker 路径，但未独立执行 Linux 实机验证。首次下载和启动仍依赖网络、可用的本机 Docker 及上游 QQ 服务。
- 不可捕获的宿主退出可能暂留容器；恢复启动只接管经实例身份校验的资源，文档已说明此限制。

## Required Rework
无。
