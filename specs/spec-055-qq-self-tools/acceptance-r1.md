# Acceptance R1 — 自主说说素材隔离

## Result

**PASS** — 2026-11-07，新的独立验收 Agent `accept_qq_self_privacy_r1`。基线 `dev / 655d75e`，仅复验首轮 `acceptance.md` 的唯一阻塞 R1。R1 已关闭；首轮已确认且本次未改动的范围沿用原有效证据。未修改业务代码。

## Spec Coverage

- `self-tools.ts:9,25–28` 将 `owner | autonomous` 设为必填的工具构造参数，仅 `owner` 注册 `get_qzone_posts`；角色不是模型参数。自主任务不能通过该工具查询或接收任何旧说说正文，不依赖提示词或不充分的 `is_private` 筛选。
- `service.ts:38` 的生产自主回调显式传 `autonomous`；第 83、114 行由真实入站身份与私聊类型判定主人，再传 `owner`。普通好友及群聊没有因此获得历史动态或全局资料工具。`dsh.ts` 的工具请求只分发到 `input.tools` 已注册项，没有另行注册历史动态的入口。
- `chat.ts:37–39` 保持新的临时自主会话、人设与心情标签，去掉读取已有动态的引导。主人私聊的最近动态查询保留；发布仍使用设置固定的可见范围，持久发布指纹与限额未因 R1 改动。
- Spec 目标行为 4、Decision026、`docs/qq.md` 及 Plan 的 R1 报告均明确自主任务不读取历史正文、主人私聊仍可查询，与代码一致。

## Validation

- Risk Level: **S3**（公开自主行为的隐私输入边界）；本次验证限定在 R1 相关工具注册、生产调用点、模型输入和已有定向证据。
- 已阅读 `.ai/AGENTS.md`、mission/tech-stack、全部有效规则、Spec055、完整 Plan（原实施报告及 R1 报告）、完整首轮 FAIL、Decision026 与当前任务交接；审阅相关最终 diff、完整 `self-tools.ts`、实际调用点和 `qq-self-tools.test.ts`。
- 复用实施者已执行并由协调转交的定向结果：`npx vitest run tests/integration/qq-self-tools.test.ts -t 'runs real DSH autonomous tools'`，2026-11-07 22:01，**1 passed / 3 skipped，1.18s**，session 63531。本验收未再次运行该命令。
- 独立核对第 32、58–71 行用例：OneBot 夹具同时含 `is_private:true` 的 `PRIVATE_OLD_POST` 和 `is_private:false`、范围未知的 `UNKNOWN_SCOPE_OLD_POST`；生产自主工具经 `ChatService.liveQQ`、真实 DSH 和本地 HTTP 模型完成资料读取及发布。每个模型请求均无 `get_qzone_posts`，自主期间历史协议查询为 0，两个正文标记及私人日记/评论/额外资料均不进入模型；发布仍为 `ugc_right=4`。随后主人工具实际读取两条正文，查询固定账号和最近 10 条，并裁剪评论。
- 未改变的协议/身份、30 秒后台触发、持久账本、恢复和 UI 证据沿用首轮验收与 Plan。没有重复定时器、UI、类型检查、完整测试或构建；未将局部通过称为一次全量通过。

## Issues

无剩余 R1 阻塞。修复位于工具注册边界，覆盖两种可信调用上下文，未以文案约束替代输入隔离，也未删除主人的既有读取能力。

## Regression Risks

- 本地真实 DSH/HTTP/OneBot 调用链证明本次输入隔离与工具能力，不代表真实 QQ 账号头像、资料或说说已生效；原真实平台验证边界保持。
- 主人私聊查询旧动态是保留能力，其上下文不复用到临时自主会话。后续新增自主资料工具仍需遵守有限公开素材边界。
- 本次未触及用户数据库、真实账号或收费模型，未启动桌面、执行外发或 Git 写操作。工作区实现仍未提交。

## Required Rework

无。R1 修正及必要证据充分，停止追加检查；由协调 Agent 完成规格与交接收尾。
