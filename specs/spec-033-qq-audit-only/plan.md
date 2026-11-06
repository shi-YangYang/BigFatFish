# Plan

## 跟进：操作记录降噪与上限
当前消息页每次轮询请求最近 100 条原始审计，同一发送的开始、成功以及后台设置同步都会占一行。用户选择只显示需要处理的问题。以只读问题列表先区分有效异常、合并同一轮的结果，再取最近 20 条；保留原诊断接口及底层记录，不做数据库清理。核对大批正常记录后仍能取到较早的异常，并覆盖新旧问题交替、未知结果、部分发送及空态。

实施：QQ 页面改读 `GET /v1/channels/qq/message-issues`，按投递结果生成问题列表，原始审计接口及 CLI 保持不变。S2 定向接口回归与应用类型检查通过。使用只读方式获取本地投递结果，在隔离浏览器的真实 QQ 消息页验证当前呈现 3 条（两次未确认送达、一次历史回复失败），未显示过程状态；空数组轮询后显示「暂无需要处理的问题」。该页面复核未发送消息或重启已登录的 QQ。

首次独立审查发现：若多段回复的第一段已发送、第二段等待回执时后台重启，父投递只记录中断，需要结合已经确认的子投递区分部分送达与整轮未确认。

## 实施
精简Channels.tsx的QQMessages为审计列表与单一请求，保留轮询生命周期和刷新失败提示。Workspaces去掉失效props；删除无用QQDeliveryHistory.tsx、qq-feedback中的投递/发送映射及专属CSS，保留qqAuditText。仅更新qq-message-errors现有测试的失效展示引用，后端断言保留；docs/qq.md不再指向已删除表单或投递记录界面。

## 验证
S1，单个QQ消息页面的功能移除及其直接死代码清理。审阅diff后仅一次 `npx tsc -p build/fish-persona/tsconfig.apps.json --noEmit`；不新增测试、不运行后端集成/全量套件/build/lint/UI/真实服务。独立验收审阅最终组件结构、唯一API读取、轮询离页保护和测试清理，不重复已通过检查。

## Git
dev基线3b922f3、开始干净。按持续阶段本地commit授权验收后root提交，不push。实施报告追加本文，独立验收写acceptance.md。

## Implementation Report

- Summary：QQ 消息页仅保留操作记录卡片，只请求审计；保留中文动作、时间、内部滚动、三秒自动更新、失败重试与空态，初次读取显示加载状态。成功、失败及加载结束均检查存活标志和请求序号，卸载清理轮询并使在途请求失效。
- Files Changed：`Channels.tsx`、`Workspaces.tsx`、`qq-feedback.ts`、`style.css`、`docs/qq.md`、`tests/integration/qq-message-errors.test.ts`；删除 `QQDeliveryHistory.tsx`。报告写入本 Plan。
- Important Decisions：删除消息页发送/附件/投递状态及无用展示帮助函数，保留 `qqAuditText` 与共享 `model-error-text.ts`。既有测试仅移除被删除展示逻辑的断言，使用测试内最小投递响应类型；真实 DSH/Chat/QQ 的失败、未知结果、取消、撤权断言和审计文案断言保留。Runtime/API/持久化、回复设置、B站分享、CLI 与插件未改动。
- Validation：S1；审阅本轮 diff 符合单页功能移除和直接死代码清理范围；唯一检查 `npx tsc -p build/fish-persona/tsconfig.apps.json --noEmit` 退出 0（约 2 秒）。未新增测试，未运行集成测试、全量测试、build、lint、UI 或真实服务验证。
- Known Limitations：本轮为静态代码及类型检查证据，未声称设备或真实账号实测；未打包。独立验收由新的验收 Agent 完成。
- Remaining Questions：无。实施 Agent 未切换分支、提交或推送；当前为 dev，本轮修改待协调 Agent 验收后处理。
