# 实施与验证

在服务端按已有会话主体筛选后取最近的本地历史。聊天界面以此次读取为唯一的历史、选择和订阅来源。保持原有完整列表接口供其他使用方使用，更新受影响的用例及 QQ 指南中直接相关的描述。

S2，核对 Runtime 读取范围与共享聊天组件；用隔离数据检查真实来源、旧消息、本地同名对话、仅有外部会话时的初始界面。复用现有定向测试，不连接真实平台。

## 实施报告

- 原聊天页请求所有来源的会话，只在首次选中时跳过只读项，历史抽屉仍可打开并订阅 QQ 消息。
- Runtime 新增 `GET /v1/conversations/local`。SQLite 先按 `principal = 'local-owner'` 选出本地会话，再按时间取最近 500 条。原完整列表继续供 CLI 和记忆等入口使用。两条路径共用查询与返回格式。
- Desktop 和 Web 共用的 Chat 从本地列表选择会话、显示历史并订阅消息。只有本地入口创建的新会话会追加到列表。移除聊天页的 QQ 只读浏览控件和专用样式，更新 QQ 指南及现有 UI 测试夹具。
- 新前端连接旧 Runtime 时仅在缺少新路由（Fastify 返回 `Not Found`）时读取旧列表，且只接受明确标记 `readOnly: false` 的会话。这种组合最多能找回旧列表最近 500 条中的本地会话；使用新 Runtime 后可读取最近 500 条本地历史。
- QQ 私聊与群聊保留自己的会话和引擎上下文，主人私聊也用 QQ 主体。B站与抖音任务不创建聊天会话。本次无需数据迁移。
- S2 定向验证一次：`./node_modules/.bin/vitest run apps/runtime/src/ai/conversation-access.test.ts tests/integration/desktop-usability.test.ts -t 'reports actual conversation access|shows tabs without animation frames'`。选中 2 项、通过 2 项。真实临时 SQLite 与 Fastify 路由验证 500 个较新的主人 QQ 会话不挤掉本地同名风格对话，原全量读取及外部写入保护有效。隔离 Chromium 验证旧接口混合列表只订阅本地、新接口仅有外部会话时显示空历史并可输入、没有订阅。
- 未运行全套测试或打包，未操作真实平台、发送真实消息或重启用户后台。
