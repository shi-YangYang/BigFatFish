# Spec057 独立验收

## Result

**FAIL**。验收 Agent：`/root/accept_qq_response_feedback`。仅剩 R1：QQ 刷新联系人会把上一次操作的按钮错误标记为 Loading；没有发现必须扩大返工范围的核心发送或网络恢复问题。

## Spec Coverage

- 两卡缺接口反馈：通过代码及既有浏览器证据核对。字符串和 Error 的 404 均给重启指引；未配置状态单独处理。操作记录 allSettled 保留独立成功来源及旧记录，不用空列表伪装成功。
- 减少模型收尾：通过。固定 SDK 的 `concludeTurn()` 标记成功结果，整批工具全部结算后完成回合。只有 QQ 四个最终提交工具带此标记，读图、收藏、记忆和个人资料工具没有被终止。Runtime 的同批最终提交契约位于完整人设之后，网站原卡没有改写。
- 发送边界：通过。Adapter 只在最后 step 存在终止工具时检查同批错误；前一步失败后正常回退仍可成功。现有 service 仍在模型完成后取暂存结果，再逐条进行最终权限、取消、记忆范围和图片资格复核。既有工具已经执行的即时操作没有伪称可回滚。
- 网络恢复：通过。目录/图片预算、失败退避、内存缓存均有界；用户取消不写入失败退避，搜索失败返回本地候选。既有 URL、DNS、公网地址、图片大小与格式约束保留。
- Loading：大部分通过。三平台初读、连接、安装、手机确认、验证与具体异步动作就近反馈；扫码等待保持正常。但 R1 使 QQ 已结束的保存操作重新出现 Loading，不符合真实操作状态要求。

## Validation

- Risk Level：共享 AI 与发送边界 **S3**；连接 UI **S2**，R1 本身为局部状态关联错误。
- 已审阅 Spec、完整 Plan、Decision028、当前交接、项目规则、变更 diff、相应生产源码、测试与固定 DSH 实现。确认 `dsh-tools/lib/pipeline.js` 会结算完整批次，`dsh-agent-loop/lib/index.js` 随后返回 completed；未把取消转换为成功。
- 已核对实施者日志：`runtime-tests.log` 的 18 项通过与首次新断言失败，`terminal-test.log` / `final-targeted.log` 的随后通过；合计 19 项 Runtime 相关用例。`ui-tests.log` 为 4 项浏览器用例通过，`bili-final.log` 为最后按钮修正的定向通过。没有重复运行这些通过的套件。
- 现有真实 SDK / 本机 HTTP / OneBot 测试保留文字和图片实际投递断言，证明纯文本 1 次请求、先看图再混合提交 2 次请求；同批失败、之前失败后回退、图片单发、静默、图片资格撤销和取消均有证据。没有把夹具结果认作云模型实测提速。
- 实际目视 `old-runtime-partial.png`、`qq-installing.png`（继承任务中的图像结果）、本次打开的 `bili-loading-380.png`、`douyin-loading-900.png`；状态布局无明显溢出，扫码不误报。
- 针对新发现 R1，仅执行了一次独立 headless Chromium 探针：启动隔离 Vite fixture，模拟已连接 QQ，完成一次保存，再挂起联系人刷新请求。控制台实际输出 `{"saveBusy":"true","refreshBusy":"true"}`；目视 `build/qq-response-feedback/review-contacts-busy.png` 同时看到保存按钮和刷新图标的 Loader。探针退出时释放请求并关闭 browser/Vite，未访问真实数据或平台。
- 未重跑全仓测试、lint、typecheck、build。全仓历史测试类型债沿用实施报告边界，未扩修。没有真实账号外发、收费模型调用、实例启动/停止或真实数据迁移；没有 stage、commit、push。

## Issues

### R1 — 刷新联系人错误复用上次保存操作的 Loading（P2）

位置：`apps/desktop/src/features/connections/qq/QQConnection.tsx:71`、`:79`、`:139`。

触发顺序：QQ 已连接 → 点击「保存设置」并等待成功 → 点击「刷新好友和群聊」→ 刷新请求尚未返回。

`act()` 将 `lastAction.current` 留为 `/v1/channels/qq/component/settings`，而 `refreshContacts()` 把共享 `busy` 设置为 true，没有改变这个历史操作标记。`actionBusy('/settings')` 因而为 true，保存按钮与刷新图标同时转圈。实际没有新的保存请求，界面却暗示设置正在保存；刷新结束才一起恢复。

## Regression Risks

- `lastAction` 同时用于已有保存错误归位，不应为了清除错误 Loader 而直接丢掉其错误归属职责。
- 本轮成功结束规则要求模型先读/看图，再同批提交；后续批次不能再追加图片。这一契约已明确记录并有协议夹具覆盖，但真实百炼模型的自然遵循率、真实速度与 Windows 原生表现未验证。
- 当前真实实例仍是旧后台；代码验收与实际启用分开。需要由根协调按既有授权边界完成真实更新，不能把 UI 重启提示描述为旧接口已经恢复。

## Required Rework

仅修复 QQ 当前执行状态与历史操作归属的混用：刷新联系人时只有刷新图标显示忙碌，保存按钮可因共享互斥而 disabled，但不能显示正在保存。保留保存请求自己的 Loading、保存错误位置及联系人刷新防重复提交。

补充或调整一个最小浏览器场景，断言「保存完成 → 联系人刷新挂起」时刷新 `aria-busy=true`、保存按钮 `aria-busy` 不为 true，结束后状态恢复。不要重跑已经通过且不受此 UI 局部修复影响的 Runtime/网络套件。按项目规范交新的实施 Agent 和新的独立验收 Agent。
