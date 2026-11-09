# Acceptance R1

## Result
FAIL

独立验收：`/root/accept_platform_config_ack`。原 R1 已修复；发现由保存确认等待直接影响的原生客户端超时边界 R2。

## Spec Coverage
- R1 关闭：配置校验仍集中在原 `configure`，连接请求只在配置落库后成功。校验失败等待连接意图清理后拒绝，前端 `await api` 不执行后续 `editing=false`，轮询继续保留全部字段草稿；错误有中文提示。
- 配置保存和浏览器登录仍由同一 Runtime 连接意图管理；返回保存确认不等待扫码结束。控制器在配置开始前注册，取消、关闭和版本检查保持。
- 首轮无阻断的 B站连接、两页组织/窄屏布局、账号匹配及原审批边界未被 R1 改动，沿用首轮证据。
- 原生 Desktop 的新连接请求未同步原配置请求的等待预算，慢速关闭旧浏览器时会先报失败、后台后保存，见 R2。

## Validation
- Risk Level: S2（本次 R1 的前后端响应边界复验；阶段整体仍为 S3）。
- Evidence Reviewed / Checks Performed:
  - 读取项目约束、Spec/Plan、首轮 Acceptance、Rework 报告、Decision019 和当前交接；检查当前 dev 工作区归属。
  - 独立审阅 `Douyin.connect/configure/disconnect/stop`、Fastify 路由和统一错误处理、Web `api`、Tauri `runtime_request`、Douyin 表单 await/编辑保护及轮询链、三个中文错误映射和 API 文档。
  - 阅读新增 Fastify/SQLite 测试的实际断言，复用实施报告中的 `configuration acknowledgement` 3/3 PASS（415ms）；覆盖三类校验失败、保存落库确认及配置等待期间 disconnect/close。没有重复执行测试、build、lint、typecheck 或 UI。
  - 因请求现在等待配置，沿调用链检查 TaskQueue.abort 和 BrowserManager.close；R2 依据实际超时分支、关闭期限与保存响应顺序作出，不声称已在真实原生窗口或浏览器复现。

## Issues
### R2 — 原生连接请求仍按 5 秒超时，可能在配置已接受前先报失败（P2）

位置：`apps/desktop/src-tauri/src/main.rs:69`；`apps/runtime/src/douyin/service.ts:31,38,63,65`；`apps/runtime/src/douyin/browser.ts:50`。

原生 `runtime_request` 仅对原 `/v1/douyin`、`/v1/douyin/close` 等路由使用 30 秒；新增 `/v1/douyin/connect` 和 `/v1/douyin/disconnect` 落入默认 5 秒。R1 后 connect 必须等待 configure，后者先等待队列取消及旧浏览器关闭再保存。BrowserManager.close 对尚未退出的子进程在发出 SIGTERM 后等待 5 秒才 SIGKILL，且此前还等待浏览器连接关闭，因此该合法清理路径可超过原生请求的整个 5 秒期限。

具体触发：已有浏览器时从设置页「保存并连接」，旧浏览器未及时响应退出。Desktop 先返回 `UNAVAILABLE`，服务端没有随 HTTP 超时取消已接受的配置任务，稍后仍可保存新 revision 并继续登录。页面保留旧草稿 revision，用户看到失败后再次保存会遇到版本冲突。断开连接同样等待清理，可能报失败但实际随后断开。该问题只涉及新路由的原生请求预算，不要求调整账号/审批或登录轮询时限。

## Regression Risks
应对新连接/断开 API 使用与原配置及关闭操作一致的原生等待语义；不要把全部 API 超时扩大，也不要为规避超时退回“配置尚未保存就返回成功”。真实账号、Windows/安装包和云模型未实测，边界保持不变。

## Required Rework
1. 修正新增 connect/disconnect 的原生请求等待预算，使其覆盖它们复用的配置/关闭清理流程，并保留 R1 的保存确认语义。
2. 对超时路由选择做最小检查；无需重跑未受影响的 Runtime、表单布局或外部平台验证。
3. 由新的实施 Agent 返工和新的独立验收 Agent 复验。本 Agent 未修改业务代码、未提交。
