# 模型、人格与聊天

Runtime 使用官方 DSH SDK 和同版引擎 `0.2.2-alpha.2`，需要 Node.js 24.9 或更高的 24.x 版本。会话历史供原对话续聊，确认过的长期记忆可在其他获准会话中检索。

## 桌面使用

完成首次设置后，进入「设置 → 模型」，点「新建配置」，或点已有模型的名称进入编辑。先选用途（聊天模型、语音输入模型、朗读模型），再填写提供商、服务地址、模型名称和所需的 API Key。点「保存模型」后，配置以模型名显示并绑定所选用途，也可在「默认用途」分别调整。记忆整理、日记、图片与视频理解、活动决策复用聊天模型。需要看图时请选择支持图片的模型。语音输入与朗读各用独立的 OpenAI 兼容音频接口。

DeepSeek 使用 Messages 服务地址，默认 `https://api.deepseek.com/anthropic`。OpenAI 兼容服务填写 Chat Completions 的基础地址，例如本地服务 `http://127.0.0.1:8000/v1`。远程服务要求 HTTPS；地址不得包含用户名、密码或查询参数。尚未配置模型时无法开始聊天，不会返回假回复。

填写地址与密钥后，可点击「获取模型列表」并选择模型，也可直接手填模型名称。「测试连接」对当前填写的配置实际发送一次短请求，显示结果与耗时，会消耗少量token；测试与获取列表均不自动保存，不写入聊天和记忆。获取列表成功只说明发现接口可用，生成能力由测试所选模型验证。

「推理强度」默认保持提供商与引擎原有行为。显式等级是否可用取决于服务和模型，OpenAI兼容协议提供关闭、极低、低、中、高、极高、最高，DeepSeek提供关闭、低、高、最高。选择后点击「保存模型」，后续请求采用新设置；切回默认不会继续沿用此前明确等级。推理强度和实际生成测试仅对聊天模型显示，不再单独设置推理用途。

已有配置可在密钥留空时测试；只有提供商和地址与已保存配置一致才复用密钥。若配置已保存密钥，修改地址或提供商后需要重新填写密钥，避免把旧凭据发送到另一服务。无密钥的本地服务仍可测试。临时错误显示在固定提示区，5秒后收起，可手动关闭，悬停或聚焦时暂停；修改配置后，旧请求结果不再作为当前配置状态。


聊天可使用 `web_search`（Bing 公开 RSS）及 `web_fetch` 读取公共 HTTPS 资料，每轮合计最多5次、单次10秒、响应1MB、正文12000字；禁止本机/内网、凭据URL和危险端口，重定向重新核验地址。搜索不可用时返回失败，不编造结果。不会传递模型密钥。

`memory_query/append/remove` 维护当前聊天的自动笔记，只保存当前消息原文摘录，不保存从网页或其他记忆推导的概述，不当成主人确认事实。QQ按账号与私聊/群聊范围隔离，本地按会话隔离；删除只作用于该范围自动笔记，不能删除主人确认记忆。每轮最多两次写入，每范围100条、合计10000条。自动笔记随「记忆」备份；schema8新增独立表，schema6/7旧逻辑归档仍可恢复。好友和群聊可检索本范围内的记忆及已共享的记忆，撤销共享会使在途回复停止，后续使用新的引擎上下文。


## 聊天与历史

在 Desktop 或 Web 的「聊天」点「新对话」，首次发送时创建会话。「历史对话」只列出从本地聊天入口发起的对话。即使是主人发来的 QQ 私聊，也保存在独立的渠道会话中。CLI 的 `sessions list` 和记忆整理仍使用包含各来源的会话列表。

Desktop 通过认证的原生宿主通道接收回复，Web 通过认证 WebSocket 接收。初次连接与重连会先分批同步历史，再接收实时消息和工具活动。切换对话会取消旧订阅。CLI 也通过 WebSocket 接收增量，并查询消息的最终状态。点「停止回复」可以中断生成，已经收到的文字和取消状态会保留。同会话请求按顺序执行，不同会话相互隔离。Runtime 重启会将未完成的回复标为中断，续聊时通过 DSH 的 `resumeSession` 恢复引擎上下文。

高级配置已移除，旧配置中的上下文、输出上限、超时和视觉开关不再作为请求覆盖。OpenAI兼容正常生成不发送应用指定的输出上限，由服务端决定；DeepSeek Messages协议要求输出上限，沿用固定适配器默认。Runtime仍有180秒取消边界、恢复历史字符预算及媒体大小保护，它们不等同模型生成参数。连接诊断继续使用独立的短请求预算。

## 人设

在「我的鱼 → 设定」可选女儿版或傲娇版，分别基于梗鲸的「女儿版 · 孺慕」和「QQ 群友版（官方默认人设）」。工具契约、身份和称呼由 Runtime 适配。完整原文、作者、日期及 SHA256 见[人设卡源码](../apps/runtime/src/ai/persona-cards.ts)，版权归原作者。[梗鲸人设页](https://aigengtu.com/persona)

新安装默认女儿版，旧自定义设定可继续使用。展开「编辑完整人设」可修改所选卡的全文，在「编辑详细设定」可调整行为边界等偏好。切换预设保留名字、头像、行为边界、作息和自主活动偏好。点「保存设定」后，原会话下一轮即使用新设定。后台整理只使用任务所需信息。设定页只编辑当前版本；CLI 的 `persona history` 和 Runtime 的 `GET /v1/persona/history` 可查看最近 100 个版本。

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

已有会话引用的模型配置不能更换提供商、地址或模型名；可新增配置并开新会话。密钥可原位更新，下次执行使用新密钥。被会话或路由引用的模型不能删除。此约束避免将既有 DSH 会话默默转移到另一个模型。

`reasoningEffort` 为可选字段：省略表示默认，`none` 表示明确关闭；OpenAI兼容还接受 `minimal/low/medium/high/xhigh/max`，DeepSeek还接受 `low/high/max`。推理字段可在已有会话使用的模型上调整，其余既有修改限制保持。仍在执行的请求使用发起时的配置快照。

## 存储与权限

模型密钥以 AES-256-GCM 加密写入 SQLite，独立随机密钥存于受限的 `config/master.key`。查询不返回 API Key。丢失 master.key 时不会悄悄生成新密钥来替代已有凭据。该方式保护静态存储与误导出，不防御同一操作系统用户控制下的恶意进程。

逻辑备份不包含 `config/master.key`。默认备份也不包含模型密钥，恢复后需为依赖密钥的模型服务重新填写 API Key。要随备份迁移模型密钥，请在导出时将 `models` 纳入备份范围，启用 `credentials: true` 并设置归档口令。恢复时，Runtime 会用目标机新生成的主密钥重新加密模型密钥。详见[备份、恢复与凭据](install-and-migrate.md#备份恢复与凭据)。

引擎数据位于 `data/engine/<会话ID>/`，包含持久上下文。受控 profile 禁用默认 shell、文件操作、工作目录工具、会话日志贡献及插件清单上传；仅将主人已授权且启用的产品插件工具注册到DSH。外部渠道主体不获得管理工具。桥接使用随机鉴权的回环连接，转发实际流帧并使用原生取消接口。这不是操作系统沙箱。每次调用工具都由 Runtime 核对主体、授权版本、权限和取消状态，社交操作还要通过对应渠道的发送检查。接口与实际SDK示例见 [开发指南](developer.md)。

## 状态与验证边界

`queued/running/completed/cancelled/failed/interrupted` 分别表示排队、执行、完成、取消、失败和服务中断。模型超时、无配置、请求失败均有明确错误码。服务不会将错误堆栈、模型响应错误正文或密钥写入公共错误响应。

测试使用真实 DSH SDK/子进程连接仅用于测试的本地 HTTP 模型，验证协议、真实流、跨进程恢复、取消和错误边界。夹具回复不代表云端模型质量或真实账号可用。真实云模型需要用户配置凭据后另行验证；Windows 原生执行结果仍单列。

## 记忆与生活（P2）

桌面或 QQ 聊天时，大肥鱼先回复，再在后台整理这轮你说过的话。像「以后叫我阿洋」这样的明确要求由本机处理。遇到一段话夹杂多件事、或「改到周三了」这样的省略表达，会调用已配置的聊天模型，结合有限前文和相关旧记忆判断。这个步骤会消耗聊天模型额度。找得到对应的原话和事项才会记下或更正，拿不准就跳过。整理完成前，从另一入口追问可能仍会得到旧答案。

记忆分三层。原始消息保留谁在何时说了什么。重要记忆记录值得以后提起的事，例如已经约好的体检。人物资料从有出处、已确认的事实中整理当前称呼、姓名、性别、当时自述的年龄等。例如「我是男生，今年 23 岁，周六约好了体检」可以产生两项人物资料和一项安排。年龄附带自述日期，下次生日需有新的信息才能更新。资料会随相应记忆的纠正、忽略和删除而更新。

「我的鱼 → 记忆」可按归属筛选、查看原话、纠正或删除。桌面和已绑定的主人 QQ 私聊可以回忆主人在不同场合亲口说过的事。每个好友有各自的私聊记忆；群只能使用本群公开说过的内容，以及主人明确共享的记忆。比如主人在 A 群说好周一复诊，可在主人私聊或 A 群回忆，B 群看不到。更换联系人、群或绑定不会把私聊记录带进其他场合。

「从对话整理」用于手动回顾旧对话，会调用聊天模型提取附有原话的候选，可自行确认或忽略。已有候选保留原状态。不能核实归属的旧记录只在管理页存档。手动编辑和合并会检查记录版本，禁止跨人物或聊天范围合并。

聊天按当前话题检索全部符合可见范围的确认记忆，再按相关度和预算选取；新增加的大量无关条目不会挤掉以前的精确匹配。还会按发言人合并当前聊天的相关笔记。在主人私聊或桌面问「最近在抖音看了什么」或「之前看过哪些鲸鱼视频」，大肥鱼可从实际观看记录回想。视频理解和自主选片可以参考相关的过往观看，但它们不是本次画面的证据，不能证明主人也喜欢。群与好友不会获得主人私聊的画像和鱼私下的观看经历。编辑、拒绝和删除影响后续检索；原始聊天、过去的日记与已导出的文件仍然保留。

在「我的鱼 → 记忆」启用「按语义回忆」后，首次下载约 24 MB 中文模型，由本机 Runtime 为记忆计算向量。即使提问换了说法，聊天也可以找到相近的已确认记忆、当前聊天笔记和鱼的观看记录。模型准备期间仍可按关键词回忆。

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

CLI、Desktop 和 Web 共用 ASR/TTS，输入与媒体预算、兼容协议及AI合成说明见 [媒体接口](developer.md#api-与事件)。
