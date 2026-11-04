# Decision：简化模型与真实流式体验

## Context
用户要求聊天与朗读用途收敛，随后明确“语音输入单独拿出来吧”，最终为chat/asr/tts。要求删除高级设置、使用服务端默认，修正错误提示与一次性显示回复。固定DSH0.2.2-alpha.2和pi-ai1.5.0已有真实增量，但UI仅700ms轮询。

## Decision
- 聊天承担文字、图片、记忆、日记和活动决策；asr/tts沿用独立音频接口。旧六用途归一化，已有chat优先，缺chat时才从旧reasoning/vision/memory中确定兼容默认；历史、模型与密钥保留。
- 删除高级表单和旧持久化覆盖，标识自动生成。180秒取消、恢复历史48000字符等为集中内部资源保护，不是生成参数；媒体和诊断保持各自较短预算。
- pi-ai的公开streamSimple会无条件经buildBaseOptions写出maxTokens；DSH封装未暴露onPayload。OpenAI每轮通过Adapter拥有的随机认证loopback桥，仅转发固定/chat/completions到配置目标，移除两个输出上限字段。禁止任意URL/重定向，请求24MB、响应32MB有界，流传输遵守背压，调用方取消关闭上游，错误正文不转发。
- DeepSeek Messages必需max_tokens，仍由上游适配器默认提供。旧Session持久化的显式maxTokens不会因SDK构造参数省略自动消失：用公开agent/request waterfall仅删除此字段，让适配器重新解析并记录默认，保留历史和其他配置。
- Runtime统一snapshot-start/message/end快照批次与message/tool实时事件，保留ready兼容事件。订阅和快照捕获同一事件循环时序，异步背压发送快照期间排队实时事件，队列8MiB有界。Desktop用认证NDJSON→Tauri Channel，不把管理token放进前端；Web沿用认证WS。
- 临时错误通过共享beUI Alert/Button固定提示区，5秒收起、悬停/聚焦暂停、可见相同错误去重但不抑制用户重试；消息失败与断线业务状态保留。

## Alternatives
仅隐藏字段会继续携带旧覆盖；只省略DSH构造字段仍被pi-ai和旧Session补上。修改node_modules或直接编辑引擎Session会破坏升级/历史边界。提高轮询频率或打字动画不能提供真实流式传输。

## Consequences
无schema、框架或依赖变更。agent/request为公开但已deprecated的钩子，是固定版本兼容债：升级DSH时必须复核，公开支持清除旧输出覆盖后替换该钩子。OpenAI模型默认输出预算交服务端，因此仍需Runtime资源保护。内部预算及DeepSeek必需参数不能声称完全由远端省略。
