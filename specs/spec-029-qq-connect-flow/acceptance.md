# Acceptance

## 扫码后连接补修（2026-11-06）：PASS

首次验收发现登录握手和读取联系人时的两次健康检查不一致会停止轮询，已返工。独立复验确认自动连接在「在线 → 离线 → 恢复」时继续核实同一账号，配置只应用一次；手动刷新、账号不符、凭据被拒保留明确错误。S2 定向 Runtime/Chromium 回归 6 项通过；S1 返工仅重跑直接相关用例，通过。使用修复前开发版本在两个不同 QQ 号下真实扫码，连续六分多钟组件与渠道在线；实机未复现之前的报错，新失败路径的验证来自隔离回归。没有中断本次真实登录或发送测试消息。

## Result
PASS

独立验收 Agent：`/root/accept_qq_connect_flow`。实施 Agent：`/root/implement_qq_connect_flow`。验收未修改业务代码。

## Spec Coverage
- 单次连接：`ManagedQQ.connect()` 在同一任务锁和取消信号下串联缺失组件安装与启动；登录轮询由 Runtime 持有，不依赖页面持续打开。已保存同账号以 revision/accountId 绑定恢复，首次未配置不自动创建授权。
- 首次与换账号：设置经现有完整配置校验及真实 OneBot 身份/状态确认后保存并启用；前端账号变化清空不适用的旧范围，保留必要主人选择。已有服务保存时直接启用，没有重复启用勾选。
- 取消与竞争：取消/关闭沿用 generation、AbortSignal 和资源清理；暂停统一清除恢复意图并递增 activationVersion，覆盖尚未有配置的首次异步保存；配置版本、账号或连接方式变化不被迟到登录覆盖。外部已启用连接拒绝被 connect 接管。
- QQ 信息结构：回复设置、表情、消息为同级页签，好友和群直接分组，表情和消息去除嵌套折叠；回复草稿由上层状态持有，刷新序号避免旧响应回写。
- 共用折叠：按压 scale 固定为 1、保持无波纹，移除 layout 投影，改为内容实测高度过渡；内容裁剪、aria-expanded/controls、aria-hidden、inert、键盘按钮和收起焦点返回均保持。共用语义层修复，无逐页面特判。
- 工程与范围：保留目录、beUI、现有 token、旧组件 API 与 CLI start；无依赖或 schema 变更，文档与适配说明同步。未改 QQ 主人/好友/群与主动发送规则。

## Validation
- Risk Level: S3（托管生命周期、持久化启停、新认证 API），UI 部分 S2。
- Evidence Reviewed / Checks Performed:
  - 阅读 Spec、Plan 完整实施报告及协调 Agent UI 证据、Decision018、相关代码差异与调用链。
  - 审阅 `tests/integration/managed-qq.test.ts` 的真实 Runtime/HTTP/OneBot 夹具及断言，包括首次下载失败重试、首次不授权、异步保存中暂停、同账号恢复、扫码等待中暂停、外部配置替换、账号变化、重复请求、安装取消、关闭时清理迟到资源。
  - 审阅实施已通过的 Node 编译、4/4 定向测试、apps-only 类型及 diff 检查记录。未重复运行。
  - 独立查看 `build/qq-connect-flow/01-desktop.png`、`02-narrow-replies.png`、`03-disclosure.png`：页签清楚，桌面/380px 分组与控件对齐，长昵称换行，折叠展开后的文字与表单未变形。
  - 协调 Agent 已完成隔离实际组件交互：草稿跨页签保留、首次保存直接连接、已有服务入口、Enter 收起及隐藏 AX 内容。独立验收未重复操作 UI。

## Issues
无阻断问题。

## Regression Risks
本轮实际组件界面使用隔离假数据；连接状态和资源取消的自动化证据采用真实 Runtime 与协议夹具，平台下载/进程由替身替代。未实测真实 QQ/Docker、Windows 原生或重打安装包，不能将其视为已验证。静态截图不构成逐帧动画证据；取消缩放与裁剪行为同时依据实现审阅。

## Required Rework
无。
