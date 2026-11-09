# Acceptance

## Result

FAIL

本轮为独立代码验收。发现两个与本次新增能力直接相关、已经隔离复现的阻断问题。真实数据仍为 schema 7 / 旧人设；等待批准后应用 schema 8、更新已安装 QQ 插件和保存来源人设，是单独的应用步骤，不因此判定代码失败。

## Spec Coverage

- 两张来源卡以完整正文保存，分别对应「女儿版 · 孺慕」和网站 QQ 群友版；来源、作者、抓取时间和 SHA 保留，版权声明没有把来源正文宣称为原创 MIT 代码。
- 人设预设收敛为女儿版、傲娇版；完整正文、版本保存和旧自定义人设兼容均有实现。后台任务不携带聊天人设卡。
- 已审阅 QQReplyTurn 的文本、图片、戳一戳、静默工具、空 final 收束、失败与撤权、未知发送状态处理，以及当前目标约束。原图收藏基于实际读取 receipt，收藏备注通过独立工具维护。
- 已审阅笔记的会话作用域、原话来源、共享记忆撤销校验，以及 schema 7 → 8 新表和归档对旧版本的兼容。
- 已审阅联网 HTTPS、DNS 固定、私网限制、请求预算与重定向限制。畸形重定向存在 R1。
- QQ 工具输出虽进入投递队列，但没有进入主会话的实际回复正文，存在 R2；因此完整聊天记录、恢复上下文和记忆所见不满足预期。
- 应用计划明确：已有只读备份 `build/persona-cards/before-schema8.sqlite`，权限 0600；真实升级、插件 update 和人设保存须在具体确认后执行。未把未执行的真实应用或真实 QQ 验证写成成功。

## Validation

- Risk Level: S3（schema、网络访问、会话权限及持久化交互）。
- Evidence Reviewed / Checks Performed:
  - 读取 Spec、Plan 内完整 Implementation Report、Decision 020、交接和相关 diff / 测试。
  - 审阅实施报告中 17 个定向用例、Node / apps 类型检查及免费联网搜索的通过证据；没有机械重跑这些检查，也没有运行全量测试或 build。
  - 审阅协调 Agent 的隔离 UI 检查结果：两项预设、完整正文 5006 / 6149 字符和保存；截图为 `build/persona-cards/settings-preview.jpg`。本验收 Agent 没有重复操作真实应用。
  - R1：用当前 `readWeb` 代码和模拟 HTTPS 响应复现，302 的 `Location: https://[` 导致 `uncaughtException`，错误码 `ERR_INVALID_URL`，工具 Promise 未 reject。无真实网络请求。输出为 `{"observed":"uncaughtException","code":"ERR_INVALID_URL","promiseRejected":false}`。
  - R2：执行隔离探针 `npx vitest run --config build/persona-cards/acceptance-vitest.config.ts`，1 个复现用例通过；该用例断言的是缺陷存在：实际 `send_message(['第一句','第二句'])` 后空 final，输出计划包含两条消息，而已完成 assistant 记录的 `content` 仍为空。临时数据库已清理，模型和实际 QQ 外发均未调用。
- 未修改业务代码、真实用户数据库、QQ 状态或 Git 状态。复现用例通过只说明成功复现缺陷，不代表功能通过验收。

## Issues

### R1 — P1：畸形重定向可以使 Runtime 出现未捕获异常

- 位置：`apps/runtime/src/ai/web-tools.ts:15`，`readWeb` 的响应回调重定向分支。
- 触发：任意被允许读取的公开网页返回 301 / 302 / 303 / 307 / 308，`Location` 为无法解析的 URL，例如 `https://[`。
- 原因：`new URL(res.headers.location, url)` 在异步 HTTPS 响应回调中同步抛错，不在 Promise executor 的同步保护范围内，也没有捕获并交给 `reject`。
- 影响：不是一次正常的工具失败；异常可逃逸为进程级未捕获异常，使 Runtime 退出。恶意站点或坏响应均可触发。

### R2 — P1：QQ 工具发送的正文遗漏于主会话记录

- 位置：`apps/runtime/src/ai/chat.ts:125`、`apps/runtime/src/ai/chat.ts:131`；`apps/runtime/src/channels/service.ts:100`、`apps/runtime/src/channels/service.ts:105`；`apps/runtime/src/channels/reply-turn.ts` 的文本队列与 `output`。
- 触发：模型通过 `send_message` 排入一条或多条正文，然后以空 final 结束；或 final 另有一段不会实际外发的总结。
- 原因：ChatService 只把引擎 final 写到 `messages.content`。QQReplyTurn 中真正排队的文本由 ChannelService 另行投递，没有进入主会话的正文；队列已有文本时 `output` 又会舍弃 final。
- 影响：QQ 实际回复与 Desktop 只读会话不一致；空 final 留下空白 assistant，非空 final 则记录未发送的总结。后续恢复上下文、记忆及归档依赖主会话时会丢失或误读回复内容。这是新增工具发送路径带来的直接回归。

## Regression Risks

- R1 修复必须保持重定向次数、同一取消 / 超时预算、私网校验及 DNS 固定，不能以吞掉异常或无限重试代替正常错误传播。
- R2 修复需沿用现有「生成正文」和「实际投递状态」的职责区分：保存排队文本，不将未投递内容谎报为已发送；保留分段、部分失败、unknown 和撤权语义，不重新发送已经由工具排队的重复 final。图片 / 戳一戳 / 静默回合不应伪造文本回复。

## Required Rework

1. 在 `readWeb` 响应处理边界捕获畸形重定向 URL，转换为可控的工具失败并正确结束响应资源。最小回归覆盖：畸形 Location 使 Promise reject，进程仍存活。
2. 让 QQ 排队文本进入主会话的正确 assistant 正文，避免恢复 / 记忆读取未外发 final 总结。修复应落在明确的回合结果接口与持久化职责上，不扩大为全部聊天架构重写。最小回归覆盖工具分段 + 空 final，以及工具分段 + 不参与投递的 final；同时检查现有投递状态语义未变。
3. 按 AGENTS 由新的实施 Agent 返工，再由新的独立验收 Agent 审核上述修改。无需重跑未受修改影响的既有通过项。
