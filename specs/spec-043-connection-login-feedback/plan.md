# 实施与验证

沿托管 QQ 登录阶段与渠道健康状态两条来源确定展示优先级；同样核对列表、B站与抖音连接卡及其轮询、报错路径。优先在拥有展示语义的前端修复，保留底层故障诊断。

S2，仅验证平台连接子系统。使用隔离夹具还原截图对应状态，覆盖扫码到确认/在线、实际连接失败和错误恢复；Web 复用相同组件。按实际需要选择最小定向 UI 检查，避免全量构建或对真实账号执行操作。

## 实施报告

- QQ 原先将 OneBot 的 `health.error` 直接渲染在卡片外，同时在卡片标题渲染传输状态和托管阶段。恢复已启用的渠道时，组件尚在登录，独立的 OneBot 已可能报告 `reconnecting/CONNECTION_LOST`。
- 新增前端 `connection-status.ts`，详情与连接列表共用状态判断。托管 QQ 优先显示当前登录或准备阶段，登录成功、模式与账号匹配后使用渠道健康状态。已有服务按自身渠道显示自动重连或真实终止错误。扫码中明确的登录失败、操作失败和账号不符仍分别在 QQ 卡片或设置控件旁显示。已扫码、初始化、登录服务恢复与二维码生成阶段依据固定版 [NapCat v4.18.42 的登录组件](https://github.com/NapNeko/NapCatQQ/blob/v4.18.42/packages/napcat-webui-frontend/src/components/qr_code_login.tsx) 及其运行状态实现。
- B站与抖音优先展示当前连接尝试。B站曾有凭据失效仍可正常进入二维码流程，过期可重新获取，初始化依赖错误和实际验证失败仍展示。抖音依次呈现浏览器登录、手机确认或浏览器验证。状态读取失败在本卡内显示可重试的提示，下一次成功读取会清除。
- Desktop/Web 复用相同组件。仅调整连接入口、列表与展示辅助代码，没有 Runtime、协议、数据和依赖变更。

## 验证记录

- S2。已审阅涉及的前端差异，`git diff --check` 通过。
- `./node_modules/.bin/tsc -p build/connection-login-feedback/tsconfig.json` 退出 0。配置限定连接入口、其依赖与本次浏览器用例。
- `./node_modules/.bin/vitest run tests/integration/connection-login-feedback.test.ts` 通过 1/1，49.76 秒。隔离 Web 入口的 Chrome 用例覆盖 QQ 列表和扫码卡的原始冲突、扫码到手机确认、明确登录失败后刷新、恢复已连接、异步保存失败、外部凭据拒绝和切换模式；覆盖 B站扫码、已扫码、过期、登录失败及重试；覆盖抖音验证、手机确认、账号不符、在线、读状态失败及卡片内重试。操作记录接口使用只读夹具。
- 实际目视 `build/connection-login-feedback/qq-waiting.png`（1040×800）。标题仅显示“等待扫码”，二维码下有手机操作说明，卡片上方无断线告警。图片仅编码本地测试字符串。
- 此轮未使用真实平台账号，未启动或重启用户 Runtime，未打包、提交或推送。实施完成，交独立验收。

## 首轮验收返工报告

- QQ 详情此前将上次异步刷新失败的 `operationError` 再次作为连接错误渲染，而 Runtime 在轮询恢复后仍保留该字段。现由既有 `qqStatus` 决定当前连接故障；刷新失败仍显示在 QQ 卡片，后续扫码、等待手机确认或上线时旧报错随状态消失。保存设置的操作结果仍由回复设置控件展示。
- 修改 `apps/desktop/src/components/QQConnection.tsx` 和 `tests/integration/connection-login-feedback.test.ts`。夹具模拟点击刷新后进入错误状态，后续轮询保留同一操作错误并依次恢复到扫码、手机确认、在线，三步均无红条。保存设置失败后恢复在线的用例则检查控件旁仍有失败原因。
- 本次返工为 S1。已审阅定向差异，执行 `./node_modules/.bin/vitest run tests/integration/connection-login-feedback.test.ts`，1/1 通过，耗时 46.55 秒。验证使用隔离浏览器夹具。未操作真实账号或服务，未打包、提交或推送。返工已冻结，交独立验收。
