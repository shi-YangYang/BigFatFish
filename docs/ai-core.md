# 模型、人格与聊天

P1 使用官方 DSH SDK 和同版引擎 `0.2.2-alpha.2`。Node.js 最低版本为 24.9，当前产品限定 Node 24。这里的会话历史是短期上下文，不是 P2 的长期记忆。

## 桌面使用

桌面完成首次设置后，进入「设置 → 模型」，填写提供商、服务地址、模型名称和 API Key。选择「聊天模型」「语音输入模型」或「朗读模型」；标识自动生成，显示名称使用模型名，保存后绑定所选用途，也可在「默认模型」中分别调整。聊天默认支持文本与图片，实际能力由所选模型决定；记忆、日记和活动决策复用聊天模型。语音输入与朗读沿用独立的 OpenAI 兼容音频接口。

DeepSeek 使用 Messages 服务地址，默认 `https://api.deepseek.com/anthropic`。OpenAI 兼容服务填写 Chat Completions 的基础地址，例如本地服务 `http://127.0.0.1:8000/v1`。远程服务要求 HTTPS；地址不得包含用户名、密码或查询参数。尚未配置模型时无法开始聊天，不会返回假回复。

填写地址与密钥后，可点击「获取模型列表」并选择模型，也可直接手填模型名称。「测试连接」对当前填写的配置实际发送一次短请求，显示结果与耗时，会消耗少量token；测试与获取列表均不自动保存，不写入聊天和记忆。获取列表成功只说明发现接口可用，生成能力由测试所选模型验证。

「推理强度」默认保持提供商与引擎原有行为。显式等级是否可用取决于服务和模型，OpenAI兼容协议提供关闭、极低、低、中、高、极高、最高，DeepSeek提供关闭、低、高、最高。选择后点击「保存模型」，后续请求采用新设置；切回默认不会继续沿用此前明确等级。推理强度和实际生成测试仅对聊天模型显示，不再单独设置推理用途。

已有配置可在密钥留空时测试；只有提供商和地址与已保存配置一致才复用密钥。若配置已保存密钥，修改地址或提供商后需要重新填写密钥，避免把旧凭据发送到另一服务。无密钥的本地服务仍可测试。临时错误显示在固定提示区，5秒后收起，可手动关闭，悬停或聚焦时暂停；修改配置后，旧请求结果不再作为当前配置状态。

在「我的鱼 → 设定」中保存名字、头像引用、角色、性格、风格、喜好、厌恶、边界、作息和自主活动偏好。修改保留版本历史，在后续回合开始时生效。头像引用作为人格配置保存；「我的鱼 → 概览」展示摘要，应用默认使用大肥鱼娘形象。设定不是赋予外部操作权限。

「聊天」可新建和切换会话。消息逐段来自实际引擎输出；Desktop通过原生宿主认证的增量通道，Web和CLI通过认证WebSocket接收增量。初次连接与重连先分批同步历史，再接实时事件，切会话会取消旧订阅；不通过周期轮询模拟流式。取消操作会中断相应引擎任务；取消后的部分文字保留并标明状态。同会话请求按顺序执行，不同会话相互隔离。Runtime 重启会标记未完成回复为中断；DSH 历史通过真实 resumeSession 恢复。

高级配置已移除，旧配置中的上下文、输出上限、超时和视觉开关不再作为请求覆盖。OpenAI兼容正常生成不发送应用指定的输出上限，由服务端决定；DeepSeek Messages协议要求输出上限，沿用固定适配器默认。Runtime仍有180秒取消边界、恢复历史字符预算及媒体大小保护，它们不等同模型生成参数。连接诊断继续使用独立的短请求预算。

## 人设

在「我的鱼 → 设定」中可选嘴欠黏人、女儿感、乖巧黏人，并展开「编辑详细设定」微调。选择后需保存，下一轮回复即使用新设定，原会话可继续聊。新安装默认嘴欠黏人，已有设定不会自动替换；切换风格保留名字、头像、行为边界、作息与自主活动偏好。版本记录保留历次保存内容。

## CLI

模型、路由、人格写入和聊天命令从标准输入接受 JSON，API Key 不接受命令行参数。含密钥的输入文件应保存在源码以外或 `.local/`，并限制为本人可读；也可通过桌面密码输入框保存。

```bash
npm run cli -- models list --json
npm run cli -- models set --json < .local/model.json
npm run cli -- routes get --json
npm run cli -- routes set --json < .local/routes.json
npm run cli -- persona get --json
npm run cli -- persona set --json < .local/persona.json
npm run cli -- persona history --json
npm run cli -- sessions list --json
npm run cli -- sessions create --json < .local/session.json
npm run cli -- sessions messages CONVERSATION_ID --json
npm run cli -- chat --json < .local/message.json
npm run cli -- cancel MESSAGE_ID --json
```

模型输入结构（`apiKey` 可选；省略保留原密钥，空字符串清除）：

```json
{"id":"local","label":"本地模型","provider":"openai","baseURL":"http://127.0.0.1:8000/v1","model":"your-model"}
```

路由输入如 `{"chat":"local","asr":"speech-input","tts":"speech-output"}`，三个用途独立配置。记忆、日记、图片与视频理解、活动决策都使用chat；asr用于语音输入，tts用于朗读。旧reasoning/vision/memory兼容读取，但不能覆盖已有chat；保存时只保留三种用途。会话输入如 `{"modelId":"local","title":"今天的聊天"}`；聊天输入如 `{"conversationId":"会话ID","content":"你好","requestId":"客户端唯一请求ID"}`。省略conversationId时新建会话；省略requestId时CLI自动生成。同会话和请求ID重试不会重复生成；同ID不同内容会拒绝。人格写入需携带完整字段与version，旧版本会冲突。

使用中的模型配置不能改变地址或模型名；可新增配置并开新会话。密钥可原位更新，下次执行使用新密钥。被会话或路由引用的模型不能删除。此约束避免将既有 DSH 会话默默转移到另一个模型。

`reasoningEffort` 为可选字段：省略表示默认，`none` 表示明确关闭；OpenAI兼容还接受 `minimal/low/medium/high/xhigh/max`，DeepSeek还接受 `low/high/max`。推理字段可在已有会话使用的模型上调整，其余既有修改限制保持。仍在执行的请求使用发起时的配置快照。

## 存储与权限

模型密钥以 AES-256-GCM 加密写入 SQLite，独立随机密钥存于受限的 `config/master.key`。查询不返回 API Key。丢失 master.key 时不会悄悄生成新密钥来替代已有凭据。后续备份默认排除此文件；迁移需要重新配置模型凭据。该方式保护静态存储与误导出，不防御同一操作系统用户控制下的恶意进程。

引擎数据位于 `data/engine/<会话ID>/`，包含持久上下文。受控 profile 禁用默认 shell、文件操作、工作目录工具、会话日志贡献及插件清单上传；P7 仅将主人已授权且启用的产品插件工具注册到DSH。外部渠道主体不获得管理工具。桥接使用随机鉴权的回环连接，转发实际流帧并使用原生取消接口。这不是操作系统沙箱。工具每次执行仍经Runtime主体、代次、权限与取消检查，不能自批社交动作。接口与实际SDK示例见 [开发指南](developer.md)。

## 状态与验证边界

`queued/running/completed/cancelled/failed/interrupted` 分别表示排队、执行、完成、取消、失败和服务中断。模型超时、无配置、请求失败均有明确错误码。服务不会将错误堆栈、模型响应错误正文或密钥写入公共错误响应。

测试使用真实 DSH SDK/子进程连接仅用于测试的本地 HTTP 模型，验证协议、真实流、跨进程恢复、取消和错误边界。夹具回复不代表云端模型质量或真实账号可用。真实云模型需要用户配置凭据后另行验证；Windows 原生执行结果仍单列。

## 记忆与生活（P2）

桌面「我的鱼 → 记忆」选择已完成对话并提取候选。整理统一使用 `chat` 模型路由。每次仅由用户操作启动，不在每条聊天后偷偷调用模型。输入取最近最多 50 个完成回合的用户消息，单条最多 4000 字、合计最多 16000 字；模型输出必须符合结构并精确引用本次输入的来源。助手文字不作为用户事实来源。

候选必须确认后才能跨会话使用。可按类型、状态、文字搜索，打开来源原文，编辑、拒绝和删除。编辑/确认使用版本检查避免覆盖较新的修改。同类型、同主题、去掉标点和空白后相同的内容合并来源；语义相似但文字不同的记录由用户选择两条明确合并，保留第一条的内容和状态。不同内容与同主题已确认记忆存在潜在冲突时拒绝直接确认；可先修改旧记录，或编辑时明确允许并存。兴趣和关系来自相应类型的已确认记忆。单次新增来源最多 200 条；编辑、去重和合并累积的历史来源完整保留，不影响后续编辑、确认或拒绝。保存期间编辑和翻页暂不可用，保存失败会保留草稿供重试。

聊天每回合从最多 1000 条按重要性、更新时间排序的已确认记忆中做中文短词匹配，最多选 8 条、序列化文本最多 4000 字。每条参考记忆最多附带 3 条最近有效来源，每段最多 500 字；完整来源仍可查看和导出，历史增长不会挤掉简短记忆。来源丢失且没有其他有效来源的记录不注入。检索作为当前回合系统参考数据传入真实 DSH，不写进聊天用户消息；它不授予工具权限。删除/拒绝停止后续检索，但不会删除原始聊天、已生成的历史日记或已经导出的文件，过去聊天中用户或助手说过的相同文字仍然存在。

「我的鱼 → 经历」按日期和 IANA 时区（例如 `Asia/Shanghai`）生成日记，只引用该当地日期的实际活动和相关聊天，以及有界的已确认参考记忆。候选时间窗口按页完整检查，最多扫描 10000 条活动；选定日期最多 200 条活动、活动及相关聊天来源合计最多 24000 字。来源或扫描超预算时明确报错，不生成截断的日记。再次生成更新同一日期/时区的版本；失败后可再次发起。任务有独立状态、取消、幂等请求 ID，异常重启标为中断。主页、兴趣、关系、经历和心情从 Runtime 读取；心情是基于实际事件的模拟状态，没有平台连接时不会生成观看或社交活动。

SQLite 是权威数据。日记副本位于 `data/diaries/<日记ID>.md`，使用受限权限和原子替换；写入失败会显示「日记已保存，文件副本失败」，可点击重建。记忆导出仅包含选中的记忆和来源，桌面显示实际保存位置 `data/exports/<随机ID>-bigfatfish-memories.json` 或 `.md`，不包含模型密钥、连接 token 或其他账号数据。JSON/Markdown 是可读导出，完整备份恢复见 [安装与迁移](install-and-migrate.md)。

```bash
npm run cli -- life home --json
npm run cli -- life timeline --json
npm run cli -- life moods --json
npm run cli -- memories list --json
npm run cli -- memories search --json < .local/search.json
npm run cli -- memories create --json < .local/memory.json
npm run cli -- memories edit MEMORY_ID --json < .local/edit.json
npm run cli -- memories merge TARGET_ID --json < .local/merge.json
npm run cli -- memories delete MEMORY_ID --json < .local/version.json
npm run cli -- memories export --json < .local/export.json
npm run cli -- memory-tasks extract --json < .local/extract.json
npm run cli -- memory-tasks diary --json < .local/diary.json
npm run cli -- memory-tasks list --json
npm run cli -- memory-tasks cancel TASK_ID --json
npm run cli -- diaries list --json
npm run cli -- diaries rebuild DIARY_ID --json
```

输入示例：搜索 `{"query":"茶","status":"confirmed","kind":"preference","offset":0}`（每页100条）；直接创建 `{"kind":"interest","subject":"绘画","content":"我喜欢水彩","importance":3}`；确认 `{"version":1,"status":"confirmed"}`；编辑携带当前 `version` 及需修改字段；删除仅需 `{"version":2}`；合并 `{"version":2,"otherId":"另一条ID","otherVersion":1}`；导出 `{"ids":["记忆ID"],"format":"json"}`。提取 `{"conversationId":"会话ID","requestId":"唯一请求ID"}`；日记 `{"day":"2026-11-03","timezone":"Asia/Shanghai","requestId":"唯一请求ID"}`。省略请求 ID 时 CLI 自动生成；同 ID 重试返回原任务，失败后重试执行须使用新 ID。

P7已提供统一ASR/TTS的CLI、桌面和Web消费者，输入与媒体预算、兼容协议及AI合成说明见 [媒体接口](developer.md#api-与事件)。
