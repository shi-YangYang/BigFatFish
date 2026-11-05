# Plan

## 实施
1. 检查已有模型错误分类可复用处，在forwardModel/DSH/Chat相应职责层保留受限诊断，不记录原始响应或凭据。错误产生与消费者之间使用明确接口。
2. 修复Channels.reply失败阶段归类，保持最终权限/交付未知语义；无需迁移已有记录。
3. QQConnection最近回复、Channels主动发送/操作记录共用展示逻辑；补充api.errorText模型错误中文。处理轮询生命周期和错误原因布局，不重做整体设计。
4. 更新docs/qq.md相关行为；实施报告追加本文。

## 范围
apps/runtime/src/ai/{model-forwarder,dsh,chat}.ts及直接必要内部帮助模块、channels/service.ts；apps/desktop/src/components/{QQConnection,Channels}.tsx及语义明确的本地展示组件/帮助函数、api.ts、必要局部CSS。相应局部/集成测试。不改schema/依赖/权限配置/打包。

## 验证
S2：同一错误链跨模型转发、Chat、QQ和显示。安全诊断保持已有不泄露边界，若实现实际改变凭据或传输约束则需明确提高该部分验证。
使用本地HTTP fixture/真实DSH或最小必要服务检查错误从产生到持久化，模型转发错误测试覆盖正文不泄露和取消。QQ定向验证生成失败/权限阻止/发送未知以及旧数据展示；不要全仓库套件。仅必要apps类型检查或Node编译，不默认全构建。根协调Agent在隔离实际App中检查状态分类、原因、轮询及380px布局；不操作真实模型/QQ，不重新发送失败消息。检查通过即停止，不复测未改变范围。

## 调查证据
2026-11-05，root经已运行Runtime只读API得到5sent+1blocked/MODEL_RUN_FAILED。该条createdAt=2026-11-05T01:35:32.457Z；DSH会话日志中异常turn/end为reason.kind=error、error.code=SERVER、error.message=502 {}。模型转发代码分别将上游HTTP非成功状态和捕获的本地fetch异常返回无正文错误，DSH仅保存MODEL_RUN_FAILED。运行日志无更细诊断。故只能确认模型调用链失败，不能认定QQ拒绝或百炼端故障。没有读取输出真实密钥，也没有触发外部请求。

## Git与交付
dev基线06b9c7e，持续每阶段本地commit授权有效；新独立验收PASS后root提交，无push/merge/PR。真实外部故障恢复与Windows/发行包不在本轮验证内。

## Root UI 检查
在 build/qq-error-feedback/serve.mjs 隔离API的实际App中通过CUA检查1280×900和380×820：旧blocked/MODEL_RUN_FAILED显示回复生成失败且不猜来源，新HTTP502/网络错误分别说明原因；权限未发送/取消/协议失败/unknown分类准确，自动回复和主动记录分开，操作记录为中文。模拟generating→sent后页面自行更新；明确403/PERMISSION_REVOKED提交显示未发送，unknown显示去QQ核实，没有真实外发。退出消息页后两次fixture计数均49，间隔超过轮询周期，消息请求已停止。窄屏内容自然换行，无目视横向溢出。

截图：build/qq-error-feedback/01-desktop.png、02-send-feedback.png、03-narrow.png。首次空白是临时fixture未复制preview.tsx入口，补齐后再加载；不是产品回归。根审阅补充主动中断用词后仅S0差异核对，未重复UI。临时tab5已关闭、viewportreset，fixture PID68415终止、session24814确认exit143；真实Runtime/QQ/模型/用户配置未变。实施全部完整报告已读，待新独立验收。

## Implementation Report

### Summary
根因分两层：模型转发为保护敏感正文将所有错误压为空响应，DSH又统一转成MODEL_RUN_FAILED，失去可安全保留的类别；QQ回复的总catch将所有生成异常记为blocked，前端仅显示状态并忽略error。修复在各自职责层完成：转发通过显式受限回调提供观测到的HTTP/网络/流失败，DSH经现有InputError/Chat错误字段传到QQ；QQ按失败阶段记状态，前端统一展示原因并兼容旧记录。历史502来源不可追认，未把应用诊断改进当作外部故障已修复。

### Files Changed
- `apps/runtime/src/ai/model-forwarder.ts`：受限诊断类型与错误码，HTTP实际状态、连接失败、流中断、空响应、超限及重定向区分；仍不回传供应商正文。重定向改为manual后显式拒绝，保持不跟随且不向其它地址传凭据。
- `apps/runtime/src/ai/dsh.ts`：每次模型请求重置诊断，只有最新请求可更新，取消优先；通过现有Chat接受的InputError保存安全码。没有解析任意SDK错误正文或新增持久化表。
- `apps/runtime/src/channels/service.ts`：生成失败记failed，取消/重启中断记interrupted，权限与最终发送前限制仍blocked；交付unknown及最终guard不变。
- `apps/desktop/src/model-error-text.ts`、`api.ts`：统一模型错误中文，同源聊天和QQ共用；MODEL_HTTP_4xx/5xx仅按实际状态解释，未知旧失败不猜来源。
- `components/qq-feedback.ts`、`QQDeliveryHistory.tsx`：共同的状态、原因、目标及中文操作名称，旧blocked+模型错误兼容显示，未知错误不直接展示内部码。
- `components/Channels.tsx`、`QQConnection.tsx`、`style.css`：合并记录读取为消息页单一轮询，自动回复和主动发送分开；序号与卸载保护，刷新失败显示局部提示。明确发送失败保留具体原因；请求中断需核实；发送成功后记录刷新失败不会覆盖已确认发送结果。布局只补行内原因和换行。
- `docs/qq.md`：诊断、记录状态与历史兼容；新增QQ错误定向测试及扩充原模型转发错误测试。

### Important Decisions
保留既有错误字段/JSON接口和schema，不迁移旧记录。HTTP诊断仅针对应用实际受管的OpenAI兼容转发；没有安全元数据的其它SDK失败继续通用说明，不从错误字符串猜HTTP。没有自动重试或主动重发。前端拒绝提示同时支持Web Error与Tauri string，只有明确发生在发送接收前的错误可说“未发送”，未知仍要求核实。QQ实际发送、账号和记忆最终授权保持原服务。

### Validation
- Risk Level: S2，同一错误链跨模型/Chat/QQ与UI，原安全约束保留。
- `npx vitest run apps/runtime/src/ai/model-forwarder.test.ts tests/integration/qq-message-errors.test.ts`：5/5 PASS，2.88s。
  - 原转发真实chunk/取消、重定向不跟随及正文不泄露；新增流中断与取消不误报网络。
  - 实际DSH、Chat、Runtime、临时SQLite和OneBot/HTTP夹具贯通：HTTP502/401/429、断开连接的网络失败持久化为准确错误，QQ生成失败而非阻止；后续成功清除旧错误；协议拒绝与未知保持；生成取消与排队撤权区分且无额外发送。
  - 旧blocked+MODEL_RUN_FAILED、明确权限阻止、发送未知、原始未知码、中文操作记录与Error/string错误一致。
- `npx tsc -p build/fish-persona/tsconfig.apps.json --noEmit`：PASS；仅apps范围。
- 后续审阅补取消媒体时优先CANCELLED，以及排除SEND_UNKNOWN/RUNTIME_RESTARTED误被判为确定未发送，只重跑 `npx vitest run tests/integration/qq-message-errors.test.ts`：2/2 PASS，2.58s。没有重复未修改的转发检查。
- `git diff --check`：PASS。最后仅报告文档追加，未运行全量套件、build、lint、打包或真实服务验证。
- 界面实际操作由root以隔离App检查；本报告不把源码审查当成UI实测。

### Known Limitations
历史故障只确定模型链路502，无法恢复已丢弃的更细原因。新错误分类帮助下次诊断，不保证外部模型永不失败。未操作真实模型/QQ/用户配置，无收费请求；Windows与发行包未验。无独立最终验收结论，由新的验收Agent判断。

### Remaining Questions
无产品决策待定。root UI完成，新的独立/root/accept_qq_error_feedback PASS；root已读取处理全部完整报告，无返工。由root按持续授权本地提交，准确hash见git log，无push。满足停止条件，不追加检查。

### UI 后文案补充
root 已完成隔离 UI 分类/原因/自动更新/明确拒绝与未知/380px检查，指出主动发送历史的 interrupted 不应称为回复。仅按 proactive 将该分支区分为「发送已中断」或「回复已中断」，取消/重启/通用原因使用对应称呼；其它状态和布局不变。S0，仅查看该差异，未追加或重跑测试、build、类型检查。

## 记录卡片滚动补充（2026-11-05）
dev 基线22e2041，工作区干净。原因是 `.qq-history` 只有 grid/gap，无高度限制，记录直接撑开卡片。在这一共享的 QQ 列表样式中设置随视口受限的最大高度、内部纵向滚动和 overscroll containment；不限制整个页面，也不裁掉记录。S0，仅差异审阅；实施与新的独立验收分开，不运行测试/build/lint/typecheck/UI，不操作真实服务。验收后按既有持续授权本地提交，不推送。

### Implementation Report：卡片内部滚动
- Summary / Root Cause：QQ 记录列表缺少高度边界，长列表撑高父卡片和页面。在共用 `.qq-history` 展示层修复，覆盖自动回复、主动发送与操作记录；数据和发送流程不变。
- Files Changed：`apps/desktop/src/style.css` 与本 Plan 的实施记录。
- Important Decisions：最大高度取 `min(360px, 50vh)`，少量记录自然收缩，超出部分由 `overflow-y: auto` 在列表内部滚动；`overscroll-behavior-y: contain` 阻止列表边缘向页面传递滚动，`scrollbar-gutter: stable` 避免传统滚动条出现时内容宽度跳变。标题和表单位于列表外，长原因的原换行样式保留。
- Validation：S0，仅审阅本次 CSS / 报告 diff；未运行测试、build、lint、typecheck 或 UI，未操作实际 QQ / Runtime。独立验收由新的验收 Agent 执行。
- Known Limitations：本轮为静态差异审阅，不声称做过浏览器或桌面交互实测。
- Remaining Questions：无。
