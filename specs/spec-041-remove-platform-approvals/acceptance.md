# Acceptance — 取消平台逐条审批

## Result
FAIL

独立验收 Agent：`/root/accept_remove_approvals`，2026-11-06。产品代码与界面范围符合要求；尚有一处本轮迁移的回归用例生命周期错误需要修复。本 Agent 未修改业务代码、使用真实账号或执行 Git 写入。

## Spec Coverage
- App 已删除审批计数、请求、菜单入口与抽屉；共享 Douyin 页面删除审批列表，点赞/评论一次提交后进入操作记录。活动暂停、恢复和记录内取消保留。
- Runtime `write` 直接进入 TaskQueue，没有创建或自动批准审批；CLI 使用同一入口。旧审批 API 明确返回 410，旧 CLI 操作明确退役。历史 schema 表未删除且无执行消费者，旧待办不会重放。
- 参数经白名单重新构造并绑定账号和 revision；相同请求 ID 复用结果、不同输入冲突。提交前的 guard 仍检查插件、暂停、配置变化、取消和当前登录账号；WriteGate 的精确请求、单次提交与收据规则保持。取消后已提交的未知结果不会被简单标记成已取消。未验证协议在入队前拒绝。
- 新 direct 测试覆盖账号与配置停用；插件权限通过 `lifecycle.ts` 的 assertPlugin 接线、每次 guard 中的 check 和插件停止路径作代码核对，不冒称新增用例实际测了插件授权撤销。
- README、ARCHITECTURE、SECURITY、使用说明与 constitution 的当前平台规则已同步。QQ/B站直接发送未受改动；没有依赖或 migration 变更。

## Validation
- Risk Level: S3，限定本次公共写入口、授权链与直接调用方。
- Evidence Reviewed / Checks Performed:
  - 独立阅读 Spec、Plan 的实施报告、Decision021、规则与交接；检查 Runtime/CLI/App/抖音组件/样式/当前文档和本轮改动测试差异，以及未变的 BrowserManager、TaskQueue、WriteGate、参数校验和插件生命周期接线。
  - 检查新增 `douyin-direct.test.ts` 与 `platform-direct-ui.test.ts` 的真实断言及夹具边界。沿用实施者报告的 9 个相关测试、Node 类型和限定前端/测试类型通过结果，没有机械重跑。
  - 实看最新四张 `build/approval-removal/{desktop,web}-{interaction,records}.png`：无审批入口，具体动作按钮及操作记录可见；「已提交」红色通知已移除，未知结果正常显示。这是共享 App 的隔离截图，非原生或真实平台证据。
  - 针对下述具体疑点执行一个独立最小检查：真实 headless Chrome 创建 BrowserContext，调用 `douyinFixture.attach`，关闭该 context 后调用 `fixture.account('67890')`。实际返回 `browserContext.addCookies: Target page, context or browser has been closed`。该检查不需要 Python、不访问真实平台，浏览器已关闭。
- 未运行完整项目检查、未安装 Python/ffmpeg、未重启用户后台。真实 Python/上游整条链和真实平台外发仍未验证。

## Issues
### R1 — 迁移后的 Python 集成用例在取消后使用已关闭的浏览器上下文
位置：`tests/integration/douyin.test.ts:24–25`，夹具 `tests/fixtures/douyin.ts:8`。

本轮将审批 revoke 改为 `/v1/activities/:id/cancel`。该操作触发 BrowserManager.lease 的 abort 关闭浏览器，并在 finally 等待 close；因此 `final-cancel` 达到 cancelled 后，夹具保存的 context 已关闭。下一行直接 `await fixture.account('67890')` 仍调用此 context 的 addCookies，必然报上述 closed 错误，无法执行后续账号变化、正常收据及调度断言。旧 revoke 只改变审批状态而不关闭浏览器，所以这是本轮迁移引入的测试回归，并非仅「依赖缺失导致未运行」。

## Regression Risks
本轮已通过的隔离 Runtime/UI 验证仍有效，未发现相应产品行为缺陷；但恢复 Python 环境后旧端到端用例会因 R1 失败。正在运行的开发后台未加载新代码，后续需重新运行 `npm run desktop:dev`；不能把源码通过称作真实后台已经切换。

## Required Rework
仅修复 R1 的测试/夹具生命周期：账号变化场景须使用活着且由当前 Runtime 拥有的 context，或调整场景顺序/夹具使期望账号可在下一次 attach 生效；保留账号不符零提交、取消零提交等原断言。不得通过跳过用例、吞掉错误或弱化取消语义解决。用一个不依赖 Python 的定向生命周期检查确认修正即可，不要求重跑已通过产品用例、完整套件或安装环境。完成后由新的独立验收 Agent 重验。
