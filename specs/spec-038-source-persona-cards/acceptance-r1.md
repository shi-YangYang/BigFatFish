# Acceptance — Spec038 R1 / R2

## Result

PASS

新的独立验收 Agent `/root/accept_persona_card_rework` 复验首轮两个阻断问题，均已关闭。此结论为代码返工验收；真实用户数据升级、QQ 插件更新和新女儿版应用仍是待具体确认的应用步骤，不冒充已执行。

## Spec Coverage

- **R1 已关闭。** `readWeb` 在响应回调入口注册 `error` 监听，重定向分支销毁响应，并将畸形 `Location` 的同步 URL 解析异常收束为 `WEB_REDIRECT_INVALID` 拒绝。递归仍经过 `webURL`、公共地址 DNS 检查及固定连接地址；传递原取消信号与已有超时预算，最多 3 跳，不吞错、不伪造网页结果。
- **R2 已关闭。** Runtime 私有 `ChatTurn.responseContent` 在模型正常完成、取消和作用域检查通过后归一化主历史。QQ 复用 `QQReplyTurn.output` 的文本选择，按顺序用换行保存分条正文；已有工具文本时不会把未投递的 final 总结写为最终正文。Channels 继续独立分条发送和记录实际投递状态，不把生成完成视为已送达。
- 静默、仅图片和仅拍一拍保持空文本，不新增伪造说明；普通聊天无归一化回调，保留原 final。生成失败或取消不会执行成功正文归一化；unknown 停止后续动作，已选定生成正文与未知投递状态分别保留。
- 本轮返工没有改变来源卡、两项预设、持久化 schema 或 UI。首轮已通过的原文完整性、工具权限、记忆边界、归档兼容和界面范围沿用首轮证据，不重复证明；原 `acceptance.md` 的 FAIL 保留为首轮记录。

## Validation

- Risk Level: **S2**（本次返工涉及 ChatTurn、主历史与 QQ 输出交互；Spec038 整体仍为 S3）。
- Evidence Reviewed / Checks Performed:
  - 阅读项目约束、Spec、Plan 内首轮及返工完整实施报告、首轮 Acceptance、Rework、Decision 020 和当前交接。
  - 独立审阅 `web-tools.ts` 的异步响应错误边界，以及 `chat.ts`、`reply-turn.ts`、`channels/service.ts` 的归一化、完成状态、最终权限检查和投递路径。
  - 独立审阅 `web-tools.test.ts` 的异步回调断言：畸形 Location 拒绝、响应销毁、迟到流错误不抛出；同进程公共跳转仍成功，私网和超过跳数仍拒绝。
  - 独立审阅 `qq-reply-history.test.ts`：空 final / 已流出总结两个分条用例均断言 canonical 正文及模拟 OneBot 的准确两气泡；恢复上下文读取选定正文；覆盖静默、图片、拍一拍、普通本地聊天、生成失败、unknown 停止及取消。
  - 采用实施 Agent 已完成的 5 项新定向测试 PASS、一次 Node 类型检查 PASS 和 diff 检查 PASS。代码与断言足以关闭原复现问题，未发现需要新增执行的具体风险，因此没有机械重跑测试、类型检查、完整 build 或 UI。

## Issues

无待返工问题。R1 / R2 均在对应职责层修复，没有以重复发送 final、绕过权限或伪造成功掩盖原问题。

## Regression Risks

- 真实云模型口吻、真实 QQ 收发和拍一拍未由本验收执行；隔离测试不替代真实账号验证。
- 当前真实数据仍为 schema 7 / 原人设 v4。升级、插件更新及新女儿版应用由协调 Agent 按项目 §24 在具体确认后执行；不因应用尚未授权而判代码失败。
- Spec037 的既有未提交变更保持；本 Agent 仅新增此报告，没有改业务代码、真实数据、服务或 Git 状态。

## Required Rework

无。满足返工停止条件，不追加无关检查。
