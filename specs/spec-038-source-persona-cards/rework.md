# Rework — 网站异常与 QQ 输出历史

## 状态
完整 acceptance.md 已读取，首轮 FAIL 两项均隔离复现。新的实施 Agent /root/rework_source_persona_cards 已修 R1/R2，5项定向检查及Node类型通过；新的独立 /root/accept_persona_card_rework 在 acceptance-r1.md PASS，两个问题已关闭。完整报告均已读取，无待返工。

## R1：畸形重定向不能击穿 Runtime
`readWeb` 的 response 回调内解析 Location，格式错误时同步异常逃出 Promise。将 URL 解析及重定向验证失败收束为工具 Promise 的拒绝，保持超时/重定向次数/私网拒绝策略；不要吞错或伪造正文。

定向覆盖：无效 Location 返回明确失败、无 uncaughtException；有效公开跳转仍正常，私网仍拒绝。无需重跑人格或 QQ 套件。

## R2：分条回复进入 canonical 会话记录
当前工具排队文字与模型 finalResponse 分开，ChatService 只保存后者。QQ 成功发出的文字可能没有进入 Desktop 外部对话、后续记忆与迁移历史；未发出的 final 总结反而可能被记录。

在明确的 Runtime 回合结果接口中归一化待交付输出，将实际选定文本写入主会话历史，不通过重复发送 final 或模型补写解释解决。普通无工具聊天不变。静默、仅图片/拍一拍、分条文本、正常 final 回退各自表达准确，不伪称外部已送达；协议交付状态仍由 Channels 管理。保留入站原话与版本、历史/续聊和最终授权。

定向覆盖：send_message 分条后空final的主历史完整；存在未发final总结时主历史只包含选定文本；静默无伪造文本；普通聊天与失败/取消边界不受影响。按共享接口实际修改决定是否需一次 Node 类型检查，不重复无改动 UI / 全项目验证。
