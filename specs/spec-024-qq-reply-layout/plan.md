# Plan：QQ 回复设置布局

## 范围与实施
S0：局部 JSX 展示分组、文字和 CSS；不改业务状态、接口或后台。根因是设置控件直接堆在 fieldset 下，单个开关也用整行折叠，记录入口与表单共用外层间距。

预计修改 `QQConnection.tsx`、`Workspaces.tsx` 与局部 QQ CSS；如记录分组需要展示 slot，保持 Permissions/RecentMessages 的逻辑归属和回调不变。

1. 回复设置使用一块边界清楚的 Card；取消标题/段落/Disclosure 默认 margin 的局部叠加。
2. 账号字段与手动输入操作同排；自动回复与标题/设置行对齐；群聊使用紧凑折叠，主动消息权限直接作为设置行。
3. 保存/暂停置于卡片底部操作区；记录入口组合到独立区域，避免与权限开关混淆。
4. 只用隔离 fixture 验证图形，不读取或修改真实 QQ 配置。

## 验证与停止
默认只检查 diff，不运行测试、build、lint、typecheck。由 root 用已有 Vite fixture、CUA 实际目视桌面与380px，并操作手填/群折叠等代表交互。仅发现具体布局问题时修正后复查对应画面；不重跑已通过的 NapCat/Runtime 验证。新的独立验收审阅 diff 与视觉证据，通过即停止。

## 实施报告
### Summary
回复设置收进同一 beUI Card：标题与自动回复同行，QQ 字段和手动输入按钮同行且均为 40px；群聊范围保留紧凑折叠并显示已选数量，主动消息改为直接可见的权限行及「逐条审批」提示。保存/暂停收在有分隔的底部操作区。「最近消息」和「主动发送与操作记录」组合成表单外的独立 Card。

### Files Changed
- `apps/desktop/src/components/QQConnection.tsx`：展示分组、标题文案，以及供现有记录组件组合的可选 children；已有服务的同类单开关折叠也改为权限行。
- `apps/desktop/src/components/Workspaces.tsx`：把原 Permissions 折叠作为 children 传给 Channels，逻辑组件保持原样。
- `apps/desktop/src/style.css`：只添加 QQ 专属布局规则，不调整全局表单或 beUI 组件。

### Important Decisions / Root Cause
原问题发生在展示组合层：标题默认 margin、字段栈 gap、单开关 Disclosure 与分散的记录入口共同拉长页面且模糊层级。修复留在 QQ 页面组合层，使用一个设置容器管理垂直节奏、薄分隔区分设置项和操作区；复用既有 Field 的直接子控件关联及 Card/Disclosure，不新增业务抽象。既有服务入口共享同一主动权限行样式，避免保留同根因冗余折叠。

### Validation
- Risk Level: S0。
- Checks Performed: 审阅上述三个业务文件 diff，并执行这些文件范围的 `git diff --check`，退出 0。
- Result: 所有状态、请求正文、回调、轮询、草稿与 pending/disabled 保护均保持；Permissions 与 RecentMessages 内部未改动。局部选择器按实际 beUI Collapsible 内层结构匹配，使用既有主题 token。
- 未运行测试、build、lint、typecheck，未新增测试；符合本任务 S0 验证范围。代码已冻结，由 root 在隔离 fixture 保存桌面和 380px 视觉证据，随后独立验收。

### Known Limitations / Remaining Questions
本实施者未进行视觉实测，不声称窄屏验收已通过。没有操作真实 QQ、进程或用户数据，没有 Git 写操作。无需求待确认项。

## Root 视觉验证
2026-11-04 使用既有隔离 Vite fixture（假账号/联系人）与 CUA 完成展示检查；没有修改或重启用户真实 QQ。
- 桌面 1000×760：设置与记录各自成组，账号字段与切换按钮同行，群范围展开、手填切换可用。
- 窄屏 380×820：手填、长昵称选择及长群名均无重叠；页宽与 scrollWidth 均为380px，两张 Card 的 scrollWidth/clientWidth 均为331px；账号选择、切换与底部按钮高均为40px。
- 在隔离页面选择长昵称后保存，控件值保持；主动发送与操作记录展开后原有审批表单可达，未发送消息。
- 目视证据：`build/qq-reply-layout/01-desktop.png`、`02-desktop-expanded-manual.png`、`03-narrow-manual.png`、`04-narrow-long-name.png`。均为假数据截图。
- 未运行测试、build、lint、typecheck；没有扩大至 Runtime/NapCat 验证。
