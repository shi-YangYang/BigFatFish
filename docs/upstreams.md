# 上游来源与适配依据

本文记录项目核查的上游版本、协议及选型依据。当前应用的配置、支持范围和操作步骤分别见[模型与聊天](ai-core.md)、[QQ](qq.md)、[B站](bilibili.md)和[抖音](douyin.md)。

## 中文记忆检索

使用智源 BGE small zh v1.5（MIT）的 INT8 量化权重和配套分词器。首次启用时按固定版本下载并逐文件校验 SHA-256。在本机对检索问题加中文检索指令，取 CLS 并归一化。文件版本、大小与摘要见[下载清单](../apps/runtime/src/memory/bge-assets.ts)。[原始模型卡](https://huggingface.co/BAAI/bge-small-zh-v1.5) · [固定的 ONNX 转换版本](https://huggingface.co/Xenova/bge-small-zh-v1.5/tree/75c43b069aac4d136ba6bc1122f995fedcfd2781)

## DSH Harness

- 官方仓库：[deepseek-ai/deepseek-harness](https://github.com/deepseek-ai/deepseek-harness)，已核源码 commit `ce7073d51254c26cd63b22a60835b8f948deb447`，MIT，源码根要求 Node >=24.9。
- 实际 TypeScript SDK 为 `@deepseek-ai/dsh-sdk-client`，并非 dsh-sdk；已直接读取 npm `0.2.1-rc.5` 与 `0.2.2-alpha.2` 发布包。SDK 管理同版 Node CLI 子进程和 stdio JSON-RPC。
- 核查时，master 文档包含发布包尚未提供的接口。项目在根 package.json 和锁文件中固定了 `0.2.2-alpha.2`。
- 真实生命周期为 DeepSeekHarness.start/session/resumeSession/run/close。恢复持久会话使用 resumeSession；session(id) 仅产生句柄。
- 两版 RunResult 都只有 sessionId/finalResponse/events/notifications，无 finishReason；结束原因从根会话 turn/end 的 data.reason.kind 获取。
- alpha.2 有 approvalRequests/client.onRequest、onUserQuestion；rc.5 没有。审批 outcome 支持 allowed-once/rejected/cancelled；alpha.2 用户问题只支持 answers 数组，不支持 master 的 cancelled:true。
- 两版均无 session cancel RPC、run AbortSignal 或 session/query。Bridge 必须按发布包实际接口实现。

### 流式与取消

官方 Agent 插件接口有 `agent/assistant-stream`，payload 为 agent+frame，按 agent.session.id 关联；帧包括 start/chunk/end 与 attempt/revision，text-delta 来自真实流。SDK标准通知本身不转发 token delta，不能切片完整响应冒充流。

通过项目自己的 Cordis bridge 转发流帧到受认证回环通道，不污染 SDK stdout。单会话中断使用 agents.get(sessionId).cancel({kind:'user'}) 并等待 whenIdle；未知会话拒绝，无法静止时关闭其引擎子进程。普通 llm/stream 还可能包含压缩辅助调用，不能直接当用户回复。

### 工具与数据边界

sdk-minimal 默认包含持久 shell、文件和工作目录工具，sandbox-policy 为 danger-full-access，并启用 session-log-deepseek。受控 profile 必须显式关闭 persistent-bash、persistent-pwsh、tool-fs、tool-working-directory、session-log-deepseek、plugin-package-inventory-deepseek；sandbox-policy 设 read-only，不能将此描述成 OS 沙箱。

Bridge 只注册 BigFatFish 允许的工具，执行入口检查权限和会话范围。上述 approvalRequests 是上游 SDK 接口。BigFatFish 的平台写操作遵循[账号和操作授权规则](../.ai/decisions/021-remove-platform-approvals.md)。

### 模型路由

alpha.2 的 deepseek-official 使用 Messages 协议，默认 `https://api.deepseek.com/anthropic`，不可当作任意 OpenAI Chat Completions 端点。OpenAI兼容路由使用官方 dsh-llm-pi-ai 的 providers 配置，api 为 openai-completions，显式 baseURL/apiKeyEnv/models，SDK选择该 provider/model。SDK构造器没有直接 apiKey/baseURL 参数。密钥只通过受控子进程环境传递，不写明文profile或日志。

SDK发布JS的resolveDshLaunch已复核：显式传env对象会完整替换父环境，再叠加SDK需要的启动环境和DSH_HOME；不传才继承process.env。因此应提供明确环境白名单、dshHome和processCwd，而不是把整个父环境复制过去。DSH_HOME是其专用状态目录，不能改写HOME来隔离其他上游。

被核查版本的 pi-ai 会为未声明模型填入上下文和输出容量（1,000,000/128,000），这两个数字不能证明端点的实际能力。当前产品的请求默认值、旧配置处理和协议差异见[聊天模型与流式事件决策](../.ai/decisions/012-chat-model-defaults-and-events.md)。SDK manifest 还声明了同版 llm/sdk-protocol/session 和 Cordis peer 依赖。

证据：[npm SDK alpha.2](https://registry.npmjs.org/@deepseek-ai/dsh-sdk-client/0.2.2-alpha.2)、[协议发布包](https://registry.npmjs.org/@deepseek-ai/dsh-sdk-protocol/0.2.2-alpha.2)、[官方 profile](https://github.com/deepseek-ai/deepseek-harness/blob/ce7073d51254c26cd63b22a60835b8f948deb447/packages/bundle/sdk-minimal/cordis.patch.yml)。研究临时副本位于 /tmp/bff-dsh-alpha、/tmp/bff-dsh-npm；最终实现必须依赖锁定版本，不能依赖这些临时路径。

## B站

| 来源 | 核对版本/commit | 接口与边界 |
| --- | --- | --- |
| [Alterssss/dsh-bili-whale](https://github.com/Alterssss/dsh-bili-whale)（用户指定主要项目） | 0.4.6，`8b0009f8ce2ebdc421afcb2e727b19ac18912ec6`，MIT | 实际为 node tools/bili.mjs CLI，未提供现成 MCP/独立 SDK。凭据固定于 ~/.bili-ai/credentials.json，不能假称支持 BFF 数据目录 |
| [YOYOLnFu/dsh-bili-pond](https://github.com/YOYOLnFu/dsh-bili-pond) | 1.3.14，`57765435e33a8697c7f3b3b9f317c6146cd05faa`，MIT，Node>=22 | Python MCP stdio，搜索/字幕/视频/评论等工具；自带记忆日记不替代 BFF Memory |
| [minedalang/dsh-dafeiyu-life](https://github.com/minedalang/dsh-dafeiyu-life) | 2.6.0，`1c61f2a34a2d7bfffab863d71db435be35431a08`，MIT，Node>=22 | Python MCP，另有预览/观看记录/转写；自带调度和人格不得成为第二套核心 |

whale 依赖 qrcode 1.5.4，抽帧需 ffmpeg。可直接包装的只读 CLI 包括 search、comments --json、subtitles --out、video、watch-video、debrief --no-frames；只有部分提供结构化输出。无字幕可 exit 0，debrief 可部分失败，适配器必须检查实际产物/完整性而非只看退出码。缓存结果带 _cached/_stale 时保留时效，不记成刚完成的真实观看。

项目复用 whale 的 QrAuth 和账号校验，Runtime 提供登录入口，并为凭据和缓存指定数据目录。分享观看结果走 BigFatFish 的 QQ 发送路径，由 QQ 的授权范围决定发送对象。适配范围见[B站指南](bilibili.md)。

pond/life 的 NOTICE 指向共同上游 c1overzz/dsh-bili-scroll。其 MCP 客户端采用 initialize → notifications/initialized → tools/call，不能假设存在 HTTP 服务。Python依赖包括 bilibili-api-python >=17.4.1,<18、aiohttp、mcp 1.x、qrcode。该工具清单属于上游参考，BigFatFish 实际接入的是上表中的 whale。

## 抖音

| 来源 | 核对版本/commit | 实际复用面 |
| --- | --- | --- |
| [LockyBee/dsh-douyin-agent](https://github.com/LockyBee/dsh-douyin-agent) | `7989640e340f0fd79e2de9874880d5197546e755`；dsh-douyin-browser-local 1.4.6，MIT | DSH工具及 node app.mjs 本机HTTP服务；BrowserController.execute，Windows有窗口Edge；manifest os=win32，不可当跨平台服务 |
| [kdcadmin/dsh_douyin_tools](https://github.com/kdcadmin/dsh_douyin_tools) | `aaf9f9a862afafd45a15acf32789da97688de695`；manifest 0.2.9，MIT | vendor/douyin-mcp/mcp_server.py 的 FastMCP stdio。npm dsh-douyin-life@0.2.9 返回404，须固定源码安装/调用 |

kdcadmin 的 manifest repository 仍指向旧名称，来源记录必须使用实际核查 URL+commit。Python依赖 mcp>=1.9,<2、Playwright>=1.45、numpy、faster-whisper、httpx、Pillow；浏览器路径有 Windows 假设，需要单独适配并验证 Linux/macOS。

读取工具包括 douyin_check_credential/feed/search/video/comments/watch/inbox。宿主通过 DOUYIN_MCP_TOOLS 指定允许的工具，上游空值会暴露 memory_*。写工具使用 DOUYIN_ALLOW_WRITES；实际互动还要经过 Runtime 的账号、任务、目标和请求内容校验，执行边界见[抖音指南](douyin.md)。

DOUYIN_PROXY_URL/TOKEN 提供可鉴权的宿主回环代理；LockyBee 的 bootstrap 返回会话token，其他API校验 x-session-token/Host/Origin。两路必须由统一浏览器队列协调，不能争抢用户会话。登录和验证码由用户完成，不绕过风控。上游 --selftest 会真实打开浏览器搜索，不当成离线测试执行。

## QQ 与 NapCat

- [NapNeko/NapCatQQ](https://github.com/NapNeko/NapCatQQ)：发布 v4.18.42 指向 commit `9335843246e3b7a17944861f3ac8731a259732c2`；本轮接口源码检查 `98d781d19815d1625b24d717ce280ecf0a4f6d0c`。
- NapCat LICENSE 为自定义 Limited Redistribution License，含非商业及修改发布限制。Spec023 经用户确认管理未修改原版组件：Mac/Linux 固定官方 Docker digest，Windows x64 按需下载校验原版 Windows.Node 包；大肥鱼自实现界面和进程管理，不复制其受限源码。既有独立服务对接保留。固定版本、哈希和数据隔离见 docs/qq.md。
- [NapNeko/NapCatQQ-Desktop](https://github.com/NapNeko/NapCatQQ-Desktop)：3.5.17，`08cb0fb5e669624a9fd6265a869803da7ea6b746`，GPL-3.0；Windows/Linux x64。Tauri2/React18；可独立使用管理QQ，默认关闭的Streamable HTTP MCP有限媒体支持，不能代替完整消息通道。
- [FablerTan/dsh-qq-relay](https://github.com/FablerTan/dsh-qq-relay)：0.25.6，`26c00fa5aa4c1faa53aead87e15e0d67a6d90d37`，package标MIT但研究树缺LICENSE/GitHub license=null；代码复制前需要许可证来源。createOneBotClient/API可以研究协议，实际业务只处理群消息等，不能当作已完成私聊实现。
- [leliln52/dsh-qqbot](https://github.com/leliln52/dsh-qqbot)：0.2.0，`2a4b8c19762ad3b9cdc13e2074a9b86445bd60fb`，MIT，Node>=22.19。心跳调用 get_version，与所查NapCat get_version_info 不同；图片语音有占位转换，不能未经适配宣称完整多模态。

OneBot11请求使用 action/params/echo，响应必须检查 status/retcode，HTTP200或async结果不能等同实际发送成功。私聊send_private_msg传user_id，群聊send_group_msg传group_id，统一字符串ID与消息段数组。主人身份由配置平台ID确认，不依赖昵称。

正向WebSocket由BFF连接NapCat，Bearer token认证；反向WebSocket由NapCat连接BFF，必须验证token与X-Self-ID。HTTP事件校验原始body的X-Signature HMAC-SHA1。登录状态需get_login_info核账号和get_status.online；当前good字段固定true，连接/心跳不等于登录。断线重连、事件去重及发送结果不明状态必须由BFF处理，超时不盲目重发。

证据：[OneBot11标准](https://github.com/botuniverse/onebot-11/tree/d4456ee706f9ada9c2dfde56a2bcfc69752600e4)、[NapCat配置源码](https://github.com/NapNeko/NapCatQQ/blob/98d781d19815d1625b24d717ce280ecf0a4f6d0c/packages/napcat-onebot/config/config.ts)、[NapCat许可证](https://github.com/NapNeko/NapCatQQ/blob/98d781d19815d1625b24d717ce280ecf0a4f6d0c/LICENSE)。该次核查只检查协议。后续已确认的扫码登录、文字回复及媒体待验项见[QQ 指南](qq.md)。

## 桌面伴侣参考

用户指定 [QCYTSN/dsh-dafeiyu](https://github.com/QCYTSN/dsh-dafeiyu)、[youxin484/dsh-dafeiyu-enhanced](https://github.com/youxin484/dsh-dafeiyu-enhanced)、[DawnVerge/dsh-whale](https://github.com/DawnVerge/dsh-whale)。BigFatFish 仍采用产品指定 Tauri 2，不因参考项目使用其他外壳而更换技术栈。

DawnVerge 固定 `140a7b9379fe6ca4c6e7d98998853aa930d656f3`，0.3.0，代码MIT、Node>=22、Electron独立桌面；DSH插件注入webServer，使用本机宿主API。THIRD_PARTY_NOTICES区分sprites上游和新增立绘来源，部分立绘没有独立授权说明；不把整套图片直接当作MIT素材复制。也不复用读取其他应用模型凭据的路径。

QCYTSN 固定 `084323845ab82b68d5388d5c638bec09d8544a8a`，0.1.23；enhanced 固定 `e4006c754b40570ddaa8bb5d2d1ed16cdd2e8af2`，0.1.18。两者 Node>=22.19、Python PySide6>=6.7,<7，并有Swift原生macOS实现；实际导出 protocol/reducer，DSH插件驱动桌宠状态。源码MIT，但 manifest明确指向ASSET_LICENSE：当前pet帧沿用dsh-pet的MIT素材，legacy大肥鱼帧受限制，光标来自Chromium BSD3。enhanced修改了输入框和界面交互，其manifest仍指向原项目，因此须按本次准确commit记录来源。

证据：[QCYTSN素材声明](https://github.com/QCYTSN/dsh-dafeiyu/blob/084323845ab82b68d5388d5c638bec09d8544a8a/ASSET_LICENSE.md)、[enhanced包清单](https://github.com/youxin484/dsh-dafeiyu-enhanced/blob/e4006c754b40570ddaa8bb5d2d1ed16cdd2e8af2/package.json)、[DawnVerge第三方通知](https://github.com/DawnVerge/dsh-whale/blob/140a7b9379fe6ca4c6e7d98998853aa930d656f3/THIRD_PARTY_NOTICES.md)。目前未从上述项目复制素材、代码或二进制到BigFatFish。

## 集成记录要求

后续每个实际复用组件记录：固定来源和commit、原许可证/NOTICE、采用文件或调用入口、必要修改和补丁、依赖安装方式、数据/凭据位置、更新方式和实际验证。编写Adapter与复制源码分别审查；所有未运行项目明确标未运行。
