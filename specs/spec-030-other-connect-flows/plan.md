# Plan

## 实施顺序
1. Bilibili/Douyin 服务添加职责内的连接编排和取消，复用已有认证、二维码、受管浏览器、租约与队列；状态体现实际连接阶段。保留旧 API。
2. 重组 Bilibili.tsx/Douyin.tsx，状态卡片与少量页签，次级导入/配置入口；草稿由页签上层持有。仅调整本轮直接相关按钮/布局/说明。
3. docs/bilibili.md、docs/douyin.md 同步最短流程；实施报告追加本文。

## 文件范围
apps/desktop/src/components/{Bilibili,Douyin,Workspaces}.tsx、style.css、api.ts（必要错误映射）；apps/runtime/src/{bilibili,douyin}/ 下服务/路由及职责明确的连接帮助模块；相应定向测试。根治理文档由协调 Agent 管理。

## 风险与验证
S3：认证登录生命周期、配置持久化和连接 API 涉及两个子系统。仅本轮连接/取消/配置版本/账号保护相关测试、Node 编译与 apps-only 类型检查；不默认全测试或完整历史视频/模型/审批矩阵。原权限门不改时审阅其调用边界即可。UI 使用隔离假 API 的实际 App，在桌面和380px检查切页草稿、连接状态及布局。已通过检查不无故重复，发现具体失败再追加相关验证。

## 兼容与回滚
无新依赖/迁移，旧 API/CLI 保留，凭据与数据不搬迁。取消和失败保留明确状态，不以假已连接或吞错误补流程。用户持续每阶段本地 commit 授权有效，无 push。

## Implementation Report

### Summary
根因是 B站/抖音页面将内部启用、配置、登录和验证暴露为独立步骤，操作依赖页面轮询，功能表单混在同页。新增各自 Runtime 连接编排持有任务与取消，页面负责发起和呈现。两页使用状态卡片与功能页签，未改变社交请求门、审批或已有 CLI。

### Files Changed
- Runtime `bilibili/service.ts/routes.ts`：connect/disconnect，复用原版 QrAuth 与账号核验，服务端轮询至成功/过期；已有凭据优先验证，手动导入也验证后保存。开始重连先将旧 verified 标为待验证，坏凭据在启用之前拒绝。匿名 configure/read 路径保持。
- Runtime `douyin/service.ts/routes.ts`：connect/disconnect，已有配置可补充后启用，以可见受管浏览器 lease 登录并自动轮询；首次空绑定要求 MCP loggedIn 与受管 cookie 登录态/稳定数字 ID 双证据，已有绑定不同则拒绝。保存前检查取消与 revision，配置替换/停服不会迟到绑定。原 configure/read/close 保留。
- Desktop `Bilibili.tsx`：观看/记录/设置，单次连接、取消/断开、匿名入口、次级凭据导入；父层保存搜索/BV/分享/凭据草稿。分享按钮与原直接发送一致。
- Desktop `Douyin.tsx`：观看/互动/记录/设置，连接卡片及必要验证状态，配置保存并连接，父层保存草稿和 revision。互动只提供已支持的点赞/评论选择，审批保持；原不支持协议和后端代码未扩张。
- `style.css/api.ts`：对应页的卡片/二维码/记录布局和必要错误提示；不修改已经修好的共享折叠。
- `tests/integration/platform-connections.test.ts`、两平台使用文档。

### Important Decisions
按 Decision019，无 schema 或依赖变化。B站保持原认证模块和密文存储，连接意图取消会取消 QR 和在途认证操作。抖音复用浏览器 lease/网络门，登录可见但不改写保存的 headless 选择；初始自动绑定只用于本次用户显式连接且未绑定账号。已有账号不会被新扫码自动替换。断开保留登录数据，B站退出登录仍是独立显式动作。

### Validation
- Risk Level: S3（认证登录生命周期、配置写入、新连接 API；UI S2）。
- `npm run build:node`：初次通过；后续 B站重连待验证状态及坏凭据错误规范改动后再运行一次，通过。
- `npx tsc -p build/fish-persona/tsconfig.apps.json --noEmit`：通过。后续 UI 仅删除尾随空白及在互动表单增加现有 videoId 的必填 Field，交由协调 Agent 实际 UI 定向验证；未重复全量类型检查。
- `npx vitest run tests/integration/platform-connections.test.ts`：6/6 PASS，4.73s。使用隔离 SQLite 和实际服务/租约/任务队列，B站实际原版 QrAuth/验证模块+HTTP fetch fixture；抖音 MCP/浏览器启动由替身代替，无外部网络/账号。
- 初次6项覆盖 B站一次连接至 QR 登录核验、已有凭据直接恢复、匿名路径、验证中取消不写凭据；抖音可见登录/自动轮询/双证据首次绑定、已有账号不匹配、无稳定ID不绑定、取消与停服防迟到写入。
- B站上述收尾改动后只重跑 `-t 'B站 connects'`：1 PASS，2.51s；增加坏凭据不启用及重连即时待验证断言。
- 审阅时发现原“配置替换”断言偏顺序，改为实际 MCP 结果挂起时替换配置再释放，仅重跑 `-t 'configuration replacement'`：1 PASS，294ms；证明新77777绑定不被旧12345结果覆盖。没有重复未变的其余检查。
- `git diff --check` 首次发现一行 JSX 尾随空白，已清除；后续 Node 编译附带 diff check 通过。
- 协调 Agent UI 指出互动页拆分后目标视频输入不在该页，已补同一上层 videoId 的必填输入；根因在原同页布局拆分造成隐式依赖，修复只在互动表单呈现该目标。未改后端，通过后的后端检查未重跑。

### Known Limitations
真实账号、扫码、浏览器/MCP辅助依赖、云模型、Windows/安装包未实测。连接等待限时三分钟，单次平台调用仍有原来的独立超时。抖音登录/验证码由用户在专用浏览器完成，不自动绕过验证。没有增加私信/分享/投稿能力或取消审批。

### Remaining Questions
无产品决策待定。协调 Agent UI 已完成，首验及返工见 acceptance.md、rework.md；最终 acceptance-r2.md 为 PASS，R1、R2关闭。由 root 按持续阶段授权本地提交，不 push。

## 协调 Agent UI 证据

使用 build/platform-connect-flow/serve.mjs 的实际 App/组件与隔离假 API，端口53436；未操作真实 Runtime 或账号。CUA在1280×720和380×820：
- B站点击连接直接显示二维码；模拟扫码成功后自动显示已连接、可搜索观看，没有额外启用步骤。搜索关键词和BV输入切换设置页后保留。凭据导入为设置页直接表单。
- 抖音 Python 路径草稿切换页签及轮询后保留；保存并连接直接显示登录等待，模拟验证阶段显示必要提示，模拟成功后显示已连接并取得账号ID。没有多余检查/验证按钮。
- 两页桌面/窄屏卡片与控件对齐，无目视横向溢出，使用统一页签和控件尺寸。截图01-bili-login、02-bili-connected、03-bili-narrow、04-douyin-narrow-settings、05-douyin-connected均在build/platform-connect-flow下。
- 抖音互动页原缺视频目标（拆页直接依赖），实施补充后仅定向复查：视频ID直接显示；空提交由原生必填校验阻止并聚焦该输入；填写后切换观看页看到相同ID。未创建审批或发送真实内容。
- 热更新导致一次05截图误拍聊天页，已重进抖音并覆盖为正确截图；这不是产品登录流程异常。
- 临时tab4已关闭，viewport override reset；fixture PID25039已SIGTERM终止，session74914返回exit143。全部模拟状态只证明前端交互，真实服务编排由上方定向测试覆盖。
