# Acceptance

## Result

PASS

独立验收Agent：`/root/accept_chat_experience`。依据Spec019、Plan完整Implementation Report、Decision012及冻结的本轮源码作出判断；未参与实施，未修改业务代码或测试。

## Spec Coverage

| 验收项 | 结论与依据 |
| --- | --- |
| 三种模型用途与默认多模态 | PASS。Models仅提供chat/asr/tts及对应默认绑定，删除整个模型高级区，保留推理强度。Configuration统一旧用途；chat、图片/视频理解、活动决策、memory/life直接消费chat；ASR/TTS继续独立音频接口。已有会话使用自身modelId，新会话检查默认chat，不把仅ASR/TTS配置误判为可聊天。 |
| 旧配置兼容与服务端默认 | PASS。读取、保存均去除旧生成覆盖；旧chat优先，缺失时兼容reasoning/vision/memory，保留模型、密钥与历史。实际DSH wire测试证明OpenAI不再发送两个输出上限字段，DeepSeek旧Session不再沿用512且历史保留。协议必需参数与180秒内部取消/恢复预算在文档中明确区分。 |
| 真实流式与生命周期 | PASS。Runtime同步捕获历史并注册监听，逐消息快照期间排队增量；有界字节预算、背压及断开清理。Web沿用认证WS，原生固定NDJSON端点经宿主Bearer认证转为Channel，前端不接触管理token。Chat移除700ms轮询，切换/卸载清理旧订阅，有限退避后可手动重连，终态不被迟到running回退。源码、真实DSH/传输测试及浏览器首片/取消证据互相吻合。 |
| 提示位置、计时与必要状态 | PASS。共享beUI通知固定在桌面右上/窄屏顶部，最多3条、同文本可见时去重、不重置计时，默认5秒自动收起，可手动关闭并支持hover/focus暂停。审批、全局、发送及诊断错误使用同一入口；诊断编辑/重试/卸载失效保护保留。消息失败/取消及真实断线仍有持续状态。四张代表截图确认位置、大小和发送按钮；页面行为见下方实际覆盖边界。 |
| 验证、治理与交付边界 | PASS。相关源码模块分工与既有目录、beUI、浅海蓝保持一致，无schema/依赖变化。修复覆盖配置、引擎、传输与共享反馈的根因层，而非只隐藏字段或模拟打字。Decision012记录固定SDK兼容债。每阶段本地commit由协调Agent在本验收后按用户既有授权完成，本报告不声称已经提交或推送。 |

## Validation

- Risk Level: S3。具体风险为配置持久化兼容及新增认证长连接，不扩大到无关子系统。
- Evidence Reviewed / Checks Performed：阅读AGENTS、constitution、全部有效`.ai/rules`、当前handoff/workflow、Spec/Plan与Decision012；审阅本轮diff及相关完整实现、直接消费者、定向测试源码。只读核实当前为dev、基线8e567fe，本轮工作区尚未提交；未刷新远端，不推断云端同步或PR状态。
- 核对`build/chat-experience/runtime-tests.log`：4文件6测试通过，覆盖配置兼容、真实DSH两协议推理与默认wire、DeepSeek旧Session恢复、长历史流及终态保护。
- 核对`transport-tests.log`：2文件3测试通过，2项因名称选择未运行；覆盖真实SSE首片、输出上限删除、取消、重定向拒绝、错误正文屏蔽，以及真实Runtime/CLI/DSH流式/会话/取消路径。
- 核对`events-final.log`的2项通过、`legacy-deadline-final.log`的1项通过（另2项未匹配选择），确认最后UTF-8预算及旧deadline契约调整有对应定向证据。
- 核对`rust.log`：2项通过，实际本机HTTP跨chunk NDJSON在EOF前进入Channel，检查Bearer且取消释放连接；这是宿主传输测试，不是原生窗口操作。
- 核对apps范围TypeScript及Node/Desktop/Web最终构建日志与实施报告。根tsconfig首次检查仍有既有`tests/integration/model-connection-http.test.ts:91`的Fastify类型缺口；未修无关问题，不能表述为全项目typecheck通过。beUI打包提示未阻断构建。
- 实际用`view_image`查看`models-final.jpg`、`models-error.jpg`、`models-narrow.jpg`、`chat-partial.jpg`：模型高级区已移除，三种默认用途清楚；通知紧凑且未挤动表单；窄屏提示留边；部分回复仍显示正在回复和停止按钮，发送按钮存在。
- 审阅root的`ui-evidence.json`及操作报告：隔离production App/Models/Chat和真实浏览器WS下，确认ASR隐藏聊天测试/推理、通知自动消失、关闭后同错重试、键盘聚焦9446ms暂停；380px视口scrollWidth=380，通知348×52。真实首片“可以呀，”先显示，随后完整；另一次首片后取消保留片段。上述行为是root实际操作证据，验收Agent未另跑浏览器。hover暂停仅源码审查，未声称鼠标实测。
- 独立验收没有重复测试、build、lint或typecheck；已有证据与源码一致，未发现需要补最小复现的具体问题。

## Issues

无本轮阻塞问题。

## Regression Risks

- 固定DSH公开但deprecated的`agent/request`兼容钩子，以及每轮受限OpenAI转发，需要在升级DSH/pi-ai时按Decision012复核；本轮没有修改node_modules或直接重写Session历史。
- 未调用真实百炼或其它云模型/平台账号；服务商图片、音频、推理能力仍待用户配置后验证。
- 未运行原生桌面窗口、Windows、新DMG或完整页面回归矩阵；现有安装包不含本轮。原生本轮证据限于相关编译及实际HTTP→IPC测试。
- 根tsconfig既有测试类型问题保留。以上限制均按授权范围记录，不冒称完整跨平台产品验收。

## Required Rework

无。协调Agent可按既有授权完成本地提交；不push、不恢复旧阶段或追加无关验证。
