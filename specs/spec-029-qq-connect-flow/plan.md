# Plan

## 补修：扫码后的就绪检测（2026-11-06）
保留容器、数据与端口隔离；在托管连接层区分扫码、等待消息服务、已核实账号和失败。按一次账号配置对应多次只读探测处理延迟，用 HTTP/WS 测试夹具覆盖重试、超时和真正的凭据错误。S2，限于托管 QQ 及其状态展示。

本机排查：两个 QQ 号不同。保持系统 QQ 运行，用原开发版本在实际 Docker 组件中观测到手机扫码、初始化、组件及渠道均在线；授权账号一致、联系人列表读取成功。容器只映射本机回环端口，三个数据挂载均来自大肥鱼目录。此次真实扫码未复现之前的错误，没有发送测试消息。

实施结果：托管层单独记录账号配置已应用和消息接口已就绪。短暂中断最多自动等候约一分钟，读取同一账号和在线状态后恢复；检测到明确的凭据拒绝或离线时提供对应操作。Docker 隔离、QQ 登录数据及原有授权范围不变。定向 Runtime 与 Chromium 回归（managed-qq、connection-login-feedback）6/6 通过，Node 生产类型检查通过。包含历史测试的全库 TypeScript 配置仍在九个未改动的测试文件报告错误。

首轮独立审查发现：登录握手先返回在线，随后的联系人健康复核暂报离线时，自动流程仍可能停止轮询。返工只调整自动就绪路径；手动刷新、账号与凭据校验保持原语义。

## 实施
1. 共用 Disclosure 调整按钮反馈和 Collapsible 动画，保持 beUI 语义及焦点行为；不改其他业务页结构。
2. ManagedQQ 增加单次 connect 编排，复用安装、启动、登录核验，显式重连仅恢复调用时已保存的同账号范围；版本/取消检查阻止迟到恢复。
3. QQConnection 改清楚的连接卡片与回复/表情/消息页签，独立展示分组。QQStickers、QQMessages 解除重复折叠包装，保持已有业务。
4. docs/qq.md 同步最短流程，实施报告追加本文；协调 Agent 更新交接和索引。

## 预计文件
apps/desktop/src/components/{Surfaces,QQConnection,QQStickers,Channels,Workspaces}.tsx、components/beui/collapsible.tsx、style.css；Runtime channels/managed/service.ts 和相关 routes/types（按实际必要）；tests/integration/managed-qq.test.ts；docs/qq.md。

## 风险与验证
S3：托管组件生命周期、持久化连接启停及认证 API 编排发生变化；界面部分属于 S2。仅相关 managed-qq 测试、Node 编译、apps-only 类型检查及隔离实际组件 UI 检查。不运行全量测试、lint 或全构建，不操作真实用户数据/QQ/付费模型。已有测试通过后不重复运行。独立验收优先审阅差异与证据，只有具体疑点才追加检查。

## 兼容与回滚
无 schema/依赖变化，保留旧组件 API；新 connect 失败只报告本次操作状态，不改其他服务。修正共享组件不得移除键盘或焦点支持。

## Implementation Report

### Summary
实现单次连接编排与 QQ 三页签，修正共用折叠反馈。根因是原快速连接仅为模式切换，准备/启动/配置分散；共用折叠将整行 pressScale 与多层 layout 投影组合，导致按压和展开时内容变形。修复分别位于 ManagedQQ 生命周期和 beUI 折叠职责层，页面只发起操作和显示状态，不在前端拼接安装/启动。

### Files Changed
- Runtime managed/service.ts：新增 connect，串联缺失组件安装、启动、登录；恢复意图绑定调用时的配置 revision/accountId。首次不创建授权配置，换账号不恢复旧范围。
- Runtime channels/routes.ts、lifecycle.ts：增加受原认证保护的 connect 路由；暂停回调总是取消恢复意图，并阻断正在验证的首次保存，无配置时也能取消。
- QQConnection：单个连接/重试操作，首次保存并连接、后续保存设置；已有服务为次级入口，保存启用合并；回复设置/表情/消息页签。好友与群直接分组。轮询采用序号避免旧请求覆盖新状态；编辑草稿保存在页签上层；换账号清空不适用范围。
- QQStickers/Channels/Workspaces：解除表情和消息嵌套折叠，同级展示。
- Surfaces/beui/collapsible/style/NOTICE：折叠行无按压缩放，实际高度过渡替代投影缩放，保留键盘/焦点返回/aria/inert，轻悬浮及窄屏间距；波纹原来已默认关闭，本轮明确保持关闭。
- tests/integration/managed-qq.test.ts、docs/qq.md：更新生命周期证据与最短操作路径。

### Important Decisions
沿用 Decision018。已有 install/start/stop/refresh 和 CLI start 兼容；旧启动仅自动恢复已启用配置，新显式连接可恢复保存但暂停的同账号配置。任务锁防重复，generation/AbortSignal 清理取消的准备与启动，配置 revision 和 activationVersion 防迟到授权。没有 schema/依赖变化，没有改主人/好友/群规则。

### Validation
- Risk Level: S3（连接生命周期、持久化启停及新增认证 API；UI S2）。
- `npm run build:node`：PASS。
- `npx vitest run tests/integration/managed-qq.test.ts`：4/4 PASS，1.78s。真实 Runtime/HTTP/OneBot，本机隔离数据，platform 下载/进程由夹具替代，无真实 QQ 消息。覆盖首次下载失败重试后一次操作到扫码、首次不自动授权、首次保存验证期间暂停、保存连接、已登录暂停一键恢复、扫码等待中暂停阻止迟到恢复、外部配置替换及 active 外部拒绝、账号变化、旧 CLI start、重复任务、安装取消不启动、Runtime 关闭等待迟到资源并清理。
- `npx tsc -p build/fish-persona/tsconfig.apps.json --noEmit`：PASS。只检查 apps，未运行有三个既有测试类型错误的全仓库配置。
- `git diff --check`：PASS。之后只移除 Surfaces 已展开 overflow-visible 属性及更新 NOTICE/本文，属于局部 CSS 展示收尾，未重复编译或后端检查。
- 实际组件 UI 验证由协调 Agent 在隔离 fixture 执行并追加证据，不重复验证。

### Known Limitations
未操作真实 Runtime 数据、Docker/QQ 账号、云模型、原生 Windows，未重打安装包；真实环境需重启 desktop:dev 使用新后端。检查只覆盖本轮直接路径，无全测试、lint 或全构建。

### Remaining Questions
无产品决策待定。协调 Agent UI 检查完成，新独立验收 PASS，完整报告已读取；按持续授权本地提交，不推送。

## 协调 Agent UI 检查

使用 build/qq-connect-flow/serve.mjs 在 127.0.0.1:53435 提供实际 App/组件及隔离假 API；没有真实账号或后台。CUA 1280×720 与 380×820：
- QQ 回复、表情、消息页签直接访问；新增好友草稿在切换表情再返回后保留；消息无嵌套折叠。
- 缺失组件时单击“连接 QQ”请求新 connect API，显示准备状态后进入扫码；模拟首次登录时主人为空，选择夹具主人后“保存并连接”直接变为“已连接/保存设置”。这部分仅证明 UI 流程，真实 Runtime 编排由上述集成测试覆盖。
- 窄屏长昵称正常换行、控件与分组对齐，无目视横向溢出。
- 共用“编辑详细设定”折叠点击展开、浅色鼠标反馈、Enter 收起通过，收起后内容从可访问树移除且焦点留在触发按钮；截图显示文字和表单没有缩放变形。不将静态截图称为逐帧动画证明，动画实现由独立代码审阅验证。
- 已有服务次级入口打开后，地址、账号和范围表单可用，仅有“保存并连接”，没有重复启用勾选；未执行真实外部连接。
- 截图：build/qq-connect-flow/01-desktop.png、02-narrow-replies.png、03-disclosure.png、04-existing-service.png；全部隔离数据。临时浏览器 tab3 已关闭、viewport override 已 reset；临时服务 PID5397 已 SIGTERM 退出，session30955 返回 exit143。
