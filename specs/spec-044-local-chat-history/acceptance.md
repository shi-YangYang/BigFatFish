# Acceptance

## Result

PASS

## Spec Coverage

- Runtime 根据已有会话的 `principal` 筛选本地历史，再按时间取最近 500 条。本机创建的会话使用 `local-owner`，QQ 主人私聊使用 `qq-owner:…`，其他 QQ 会话使用 `qq-user:…`。标题不参与判断，历史记录无需迁移。
- Desktop 与 Web 共用 Chat 的选择、抽屉和订阅逻辑。初始选中项、可点击的历史项都来自本地列表。新建会话经原 POST 路由创建，只有选中具体会话才订阅对应 ID。仅有渠道会话时，初始界面可直接开始本地对话。
- 核对了 Tauri 的路径校验、错误字符串和订阅参数，以及 Web 网关的 HTTP 转发、错误响应和 WebSocket 参数。新前端遇到旧 Runtime 的缺路由响应后，只接收旧列表中明确标记可写的本地记录。
- CLI 和记忆整理仍请求原列表。QQ 的独立会话与引擎映射继续用于回复，外部会话仍受 Runtime 写入保护。B站与抖音的任务使用各自的活动记录。

## Validation

- 风险级别 S2。审查了运行时路由、SQLite 查询、平台会话创建、共享聊天组件、双端传输、记忆与 CLI 调用方、相关测试和 QQ 文档的改动。
- 复用实施报告中通过的 2 项定向测试。临时 SQLite 和 Fastify 验证 500 个较新的 QQ 会话不会挤掉已有本地会话。Chromium 使用当前源码，验证混合历史、带 QQ 字样的本地对话和订阅、仅有外部历史时的空态与输入。
- 对发现使用旧原生桥夹具的 `tests/integration/desktop-webui.test.ts` 单独执行一次，使用仓库已有的桌面构建。该用例在等待首条样例消息时超时，未到达本次调整的本地会话切换断言。基线 `603f8a1` 中该夹具已经仅模拟 `invoke` 和 HTTP 消息读取，而同一基线的 Chat 通过 Tauri Channel 接收快照，需要 `transformCallback`。此用例不能作为当前原生窗口运行通过的证据。

## Issues

本次聊天来源隔离无阻断项。上述桌面测试夹具的历史问题单独记录。

## Regression Risks

旧 Runtime 回退只能筛选其返回的最近 500 个会话，缺少可写标识的旧记录也会被排除。使用新 Runtime 后，最近 500 条按本地会话单独计算。本轮没有启动原生窗口、操作真实平台或重打包。

## Required Rework

无。
