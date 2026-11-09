# Plan

## 实施顺序
一名实施Agent串行处理相关模块，先确认DSH固定版本的模型默认参数与真实增量路径，再做配置归一、聊天实时传输、统一反馈及精简表单；语音输入按用户后续确认保留独立ASR，不新增聊天音频协议。root维护规格/重要决策，新的独立Agent验收。

## 相关文件
Runtime ai/{types,configuration,model-options,dsh,chat,media,routes}、memory/life及多模态直接调用方；Desktop Models/Chat/App/useModelConnection/api/共享反馈组件与style；原生宿主流式桥与Web已有events。新增普通模块只在现有目录中按明确职责拆分。

## 根因与技术边界
后台已有onText→事件流，前端只拉取快照；需连通传输并处理订阅/快照竞态，不能只提速轮询。高级参数当前必填且被同时传入DSH配置与Session，需在配置/引擎边界统一移除覆盖。旧记忆/视觉/推理路由不能只藏下拉项后继续被消费者使用；语音输入ASR保留独立路由。共享通知负责临时错误，持久业务状态保留。

## 验证计划
S3，具体风险为配置兼容与长连接跨原生/Web认证边界。一次相关类型检查与必要编译；定向配置/默认wire/路由/实时生命周期/通知时序测试，复用现有fixture与真实DSH。Rust变动进行定向cargo检查或测试，不为此打包DMG。有限宽/窄屏模型页及错误提示视觉检查由root用cua_repl执行，实施Agent可准备隔离预览，禁止真实账号调用。已通过检查不重复；失败后仅重跑受影响范围。旧凭据/个人数据不用于测试。

## 交付
Implementation Report写入本Plan；独立验收进入acceptance.md；重要决策记录.ai/decisions，root汇总后按每阶段授权本地commit，不push。保持旧包边界清楚。

## Implementation Report

### Summary
实现用途chat/asr/tts，删除模型高级表单，聊天承接图片、记忆、日记及活动决策。旧配置从读取和保存边界归一，普通OpenAI生成移除输出上限覆盖，DeepSeek旧Session恢复适配器默认。聊天改为真实事件订阅，临时错误改为共享、固定位置且可暂停的5秒通知。

### Root Cause and Responsibilities
- 原配置把六种用途、手填输出预算和视觉开关同时作为UI和引擎契约；仅删字段会保留隐藏行为。Configuration统一模型字段/旧路由，chat、media和memory直接消费同一chat路由；ASR/TTS继续独立协议。模型编辑只绑定当前选择用途，不改其它默认绑定；共享配置切换到音频用途不清除隐藏的聊天推理强度。
- DSH已有即时text-delta，前端700ms轮询可能在三个50ms夹具片段全部完成后才读一次。Runtime events统一权威快照和实时事件；Web沿用认证WS，原生宿主认证NDJSON后通过IPC递交。每次订阅同步捕获历史并注册监听，异步逐消息发送快照，期间增量排队，避免丢失新会话初始消息或旧快照回退。切会话/卸载清理，断线最多5次有限退避再显示可重试状态，终态不被迟到running覆盖。既有会话继续采用自己的modelId，新会话才要求默认chat。
- 原错误分散在全局、审批、聊天、诊断组件，缺少一致生命周期。Notifications持有临时提示，最多3条、仅可见同文本去重、5秒剩余计时、hover/focus暂停；自动后台重试在调用方按失败状态去重。用户关闭/自动消失后重试同操作能重新提示。模型编辑、重试或卸载让旧诊断提示失效。消息失败、取消与连接中断保留业务状态。

### Files Changed
- Runtime：ai/{types,model-options,configuration,chat,media,dsh,dsh-bridge,routes}、memory/life、web/server；新增ai/events和model-forwarder普通源码模块，分别负责订阅传输与受限上游转发。
- Desktop：App、Chat、Models、useModelConnection、style；新增Notifications、chat-events、chat-messages；原生新增chat_stream.rs并注册两个固定命令。
- 定向测试：新增model-defaults、chat-events、model-forwarder；更新model-reasoning的默认wire契约及ai测试中已废弃的用户deadline/旧事件断言。
- 直接文档：docs/{ai-core,developer,bilibili}、constitution/tech-stack、Decision012及本Plan。未改schema、依赖、目录职责或用户数据。

### Important Decisions and Compatibility
详见[Decision012](../../.ai/decisions/012-chat-model-defaults-and-events.md)。固定pi-ai的streamSimple必塞maxTokens，DSH没有公开onPayload；不修改node_modules，采用DSH Adapter本来拥有的每轮随机认证loopback桥，仅转发固定模型目标的/chat/completions，删除max_tokens/max_completion_tokens。桥保留SSE与背压，有界请求/响应，不跟随redirect；取消关闭上游，错误不透传密钥或上游正文。

DeepSeek Messages的max_tokens是协议必需参数，采用上游适配器默认，不宣称完全省略。旧Session曾持久化显式maxTokens；公开但deprecated的agent/request waterfall只清除此覆盖，保留历史和其它设置。真实DSH旧会话测试证明历史继续存在且wire不再沿用512。升级DSH时需复核该窄兼容钩子，公开替代能力可用后替换。

旧contextWindow/maxTokens/timeoutMs/vision字段仍可输入/从归档读取，但输出归一配置不保留其覆盖。已有chat优先；缺chat时从旧reasoning/vision/memory兼容迁移，ASR/TTS不会变成chat。180秒回合取消、48000字符恢复历史预算属于内部资源防护；媒体独立较短超时，诊断保留短请求预算，均不作为隐藏高级设置。

### Validation
- Risk Level：S3，依据是配置兼容持久化和新增认证长连接；验证只覆盖模型/聊天及直接传输范围。
- `npx vitest run apps/runtime/src/ai/configuration.test.ts tests/integration/model-defaults.test.ts tests/integration/model-reasoning.test.ts tests/integration/chat-events.test.ts`：4文件6测试通过（runtime-tests.log）。覆盖三路由、旧字段、密钥/历史保留、ASR/TTS无chat、实际DSH恢复DeepSeek旧输出覆盖、两协议推理强度与默认wire、认证/事件隔离、超过8MiB历史快照完整及取消清理、终态合并。
- `npx vitest run apps/runtime/src/ai/model-forwarder.test.ts tests/integration/ai.test.ts -t 'forwards real|does not follow|runs real DSH through'`：2文件3测试通过，2个不匹配选择的用例未运行（transport-tests.log）。覆盖实际SSE首片在结束前到达、输出上限删除、上游认证、取消连接、redirect拒绝、错误正文清洗，以及真实Runtime/CLI/DSH流式/会话隔离/取消/失败路径。
- events字节上限从字符数修为UTF-8字节后，只重跑`npx vitest run tests/integration/chat-events.test.ts`：2测试通过（events-final.log）。
- 现有ai deadline用例依赖已删除的timeoutMs=1500，且假设WS只有ready。按新契约更新为旧超时无效、显式取消及空历史快照帧；最新Node构建后`npx vitest run tests/integration/ai.test.ts -t 'ignores legacy deadlines'`：1通过，2个不匹配选择的用例未运行（legacy-deadline-final.log）。
- `cargo test --manifest-path apps/desktop/src-tauri/Cargo.toml chat_stream:: --quiet`：2通过（rust.log）。除ID约束外，真实本机HTTP跨chunk NDJSON经Channel回调在EOF前收到片段，任务取消释放连接，并检查Bearer。初次编译暴露reqwest未启用query feature，改为已验证的受限ID组成固定query；测试局部变量遮蔽随后修正。未启动原生窗口。
- 最终`npx tsc -p build/chat-experience/tsconfig.json --noEmit`仅apps源码范围通过；`npm run build:node`、`npm run build:desktop`、`npm run build:web`通过（*-final.log）。首次根tsconfig检查受既有model-connection-http.test.ts:91的Fastify initialConfig.requestTimeout类型缺口阻挡；没有扩大修复，改用apps范围检查，并单独运行相关测试。beUI的use client打包告警未阻断构建。
- root经cua_repl操作隔离production App+内存fixture+真实浏览器WS：三用途/默认绑定、无高级区、ASR不显示聊天测试/推理；通知自动消失、关闭后同错重试、键盘聚焦9.4秒暂停；380px宽无横向溢出，提示348×52且左右留16px；真实首片“可以呀，”时仍在回复，之后完整文本；另一回复首片后取消保留片段并显示已取消。过程中发现通知双重padding和遗漏发送按钮，均已修正并由root重新实际操作确认。证据`build/chat-experience/ui-evidence.json`及4张JPG。hover暂停只读代码，未另做鼠标操作。
- `git diff --check`通过；没有全套测试、全量lint、生产打包或Git写操作。日志与隔离预览都在忽略的build/chat-experience，不包含真实密钥。

### Known Limitations
真实百炼/其它云服务账号、Windows、原生桌面窗口启动及新DMG均未验证；服务商对图片、语音和推理强度的实际支持需用户配置后确认。Native新增路径的证据限于编译和真实HTTP→IPC测试；Web UI证据来自隔离fixture，不冒称真实模型效果。旧已生成安装包不包含本轮修改。根tsconfig的上述既有测试类型缺口仍保留。

### Remaining Questions
无产品问题；交由新的独立验收Agent检查本次实现。实施Agent没有执行commit或push，root按既有阶段提交授权在独立验收后处理。

## 协调交付记录

独立验收/root/accept_chat_experience已返回PASS，完整实施与验收报告均已读取处理，无返工。root的实际浏览器检查覆盖三用途、通知与真实分片/取消，具体边界见上方记录和acceptance.md。验收后仅同步当前dist至忽略的build/portable/dist，121个文件逐字节一致，随包metadata与源码一致（build/chat-experience/dev-resources.json）；未启动用户Runtime、调用真实服务或重打DMG。开发测试需重启Runtime及桌面开发窗口。按用户持续阶段提交授权完成本地提交，准确hash见git log；未push、PR、合并或刷新远端。满足停止条件，不追加验证。
