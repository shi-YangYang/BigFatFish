# QQ 渠道

BigFatFish 可以在应用内准备原版 NapCat、扫码登录并设置回复范围，也保留连接已有 OneBot 11 服务的方式。NapCat 是独立的第三方组件，遵循其自身的[许可证](https://github.com/NapNeko/NapCatQQ/blob/9335843246e3b7a17944861f3ac8731a259732c2/LICENSE)，不属于大肥鱼的 MIT 授权。请使用专用 QQ 账号，扫码与设备验证由用户完成。

## 快速连接

1. 打开「连接」，在 QQ 卡片点「管理连接」，再点「连接 QQ」。缺少组件时会自动下载并启动，无需分别准备、启动。
2. macOS/Linux 需要本机 Docker 已安装并启动，且使用 Linux 容器；Windows x64 使用独立原生组件。Windows arm64 可连接已有服务。
3. 出现「等待扫码」后用手机 QQ 扫码，看到「等待手机确认」时在手机上确认。过期时点「刷新二维码」。相同账号已有保存设置时，登录后自动恢复连接。
4. 首次登录或换账号后，在「回复设置」选择主人 QQ 和允许回复的好友、群，点击「保存并连接」。不会自动猜测主人或授权联系人。之后修改使用「保存设置」。

QQ 页面以「回复设置 / 表情 / 消息」三个页签组织。托管组件登录后，「回复设置」列出好友和群。主人可从好友中选择，也可手动输入 QQ 号。列表不可用时可手填好友或群号。新增好友或加入群后，点右上角的「刷新好友和群聊」图标。已有草稿保留，新联系人需自行勾选并保存。群默认普通消息也可回复，也可选择仅被 @ 时回复。主动消息默认关闭。
内部地址、端口和两套随机凭据由 Runtime 管理，无需填写；机器人 QQ 从真实登录信息读取，不推断主人身份。「已登录」表示组件确认账号已在线，页面顶部「已连接」还要求现有 OneBot 插件完成账号与健康检查。

手机确认后，账号卡会先确认登录，再连接消息服务。这时不用重复扫码或退出 Mac 上的 QQ。短暂中断会自动重试；持续约一分钟仍未就绪时，可以点「重试连接」。如果显示「QQ 已离线」，请重新连接并登录。凭据被拒、账号不符或组件出错时，卡片显示具体原因。状态暂时读不到时，可点「重试」更新。保存回复设置出错时，提示显示在设置表单内。

「断开连接」同时停止渠道及所属组件，设置保留。再次点击「连接 QQ」即可恢复；渠道单独暂停但组件仍在线时显示「重新连接」。准备和启动期间可取消。暂停、取消、配置变化或换账号会阻止之前操作迟到恢复连接。开发窗口退出随 Runtime 清理组件；正式安装版关闭窗口到后台时，组件随后台继续运行。Runtime 正常关闭会清理所属容器或原生进程树；强制断电等不可捕获退出不保证实时清理，后续启动仅识别本实例资源。

组件存于当前数据目录的 `data/qq-component/`，QQ 登录数据与日常 QQ 隔离。Mac 不修改 `/Applications/QQ.app`，Windows 不修改系统 QQ/注册表。便携逻辑备份不包含组件程序、QQ 登录态或容器身份；迁移后需重新准备和登录，恢复配置保持停用。

## 连接已有服务

已有 NapCat 的用户点击「连接已有服务」（托管组件已登录时从「连接选项」进入），填写地址、连接凭据、机器人 QQ 与主人 QQ。NapCat 需开启 OneBot 11 正向 WebSocket，消息格式为数组；本机允许回环 WS，远端必须使用 WSS。填写完成后点击「保存并连接」，无需另勾选启用。反向 WebSocket 和 HTTP 上报未接入。

凭据留空保留原值，不会在查询接口返回；必须可用于 HTTP Authorization 头，不能包含中文、表情、空白或控制字符。非法值在保存前拒绝，保留原连接。切换到内置组件前请先停用已有服务；组件不会接管其他 NapCat 或 QQ 进程。

已有不合法连接凭据导致初始化失败时，仅 QQ 显示凭据错误；本地 Runtime 和聊天仍可使用，可在渠道设置中填写有效凭据后恢复。主密钥文件缺失仍会安全拒绝启动，不会生成替代密钥。

主人只能有一个，其他私聊账号必须明确列入好友允许列表；群必须明确列入允许列表。群触发可选普通消息或真实 @，旧配置缺省为普通消息。昵称、自称主人、CQ 字符串不授予身份。每位作者与私聊/群聊会话隔离，账号、主人或授权配置改变后建立新引擎会话。QQ 消息保存在各自的渠道会话中。桌面和 Web 的聊天页只显示本地对话。

## 记忆与发送

本机与主人私聊使用同一人格和已确认记忆。旧记忆默认私有。记忆页的「允许群聊使用」只共享该条内容；原始来源摘录不注入群。撤销共享后，群聊不会恢复包含旧共享上下文的引擎会话。已生成但尚未发出的回复也会在账号健康检查完成后复核本次使用的共享范围；范围变化则阻止发送，记录 `blocked / MEMORY_SCOPE_CHANGED`。群来源记录真实 QQ 作者，提取的候选不会自动归为主人事实，仍需本机确认。

已授权入站回复可自动发送。开启主动消息权限后，CLI、B站分享和具备 `channel.send` 权限的插件可向授权对象发送消息，使用同一发送服务。停用、撤权或配置变更会取消在途生成并阻止尚未发出的消息；已进入外部发送的消息无法撤回。

旧 QQ 审批接口返回 `QQ_APPROVAL_REMOVED`，历史待审批项不会自动发送。旧插件 `channel.propose` 权限不升级为直接发送，采用 `channel.send` 需要重新授权。B站分享到 QQ 也检查同一发送权限。抖音已支持的互动按其账号授权直接提交。获准好友仅使用已共享记忆，不能获得主人身份或管理工具。

`sent` 仅表示协议服务返回成功和消息 ID，不代表对方已读。自动回复生成失败记录为 `failed`，与外发前因权限或健康检查被阻止的 `blocked` 分开；取消与重启中断记录为 `interrupted`。`unknown` 表示外发请求发生后超时、断线、异步接受或不明确响应；不会自动重试。请在 QQ 人工核实后再决定是否重新创建消息。重复入站消息跨重启去重，重启期间尚未完成的生成标记中断，正在发送的记录标记未知。投递记录仍可通过 CLI 或 API 查询，历史数据保留。

「连接 → QQ → 消息」的操作记录按时间显示最近 20 条需要处理的问题，包括回复生成失败、消息未发送、部分发送和发送结果待核实。同一轮回复只占一条；遇到部分发送或结果待核实，请先到对应的 QQ 私聊或群聊核对。停留在页面时列表自动更新，较长记录在卡片内滚动。完整审计保存在本机，可用 `channels audit` 查看近期原始事件，用 `channels deliveries` 查看投递状态和错误码。

OpenAI 兼容模型的新调用会保存受限错误码：`MODEL_HTTP_502` 等表示实际收到的模型 HTTP 状态，`MODEL_NETWORK_ERROR` 表示连接失败，`MODEL_STREAM_INTERRUPTED` 表示响应中途断开。错误正文、密钥和请求内容不写入错误字段。取消优先于网络错误，不自动重试。未取得详细诊断时保留通用模型失败；旧 `MODEL_RUN_FAILED` 不能据此追认具体服务端故障。

## 媒体范围

完整P7接口、NapCat前置条件与运行证据边界见 [开发与协议](developer.md#qq-媒体与实际协议)。

- 入站识别文本、图片、语音、文件、真实提及及引用消息。只通过同账号的 `get_image` / `get_record` 获取有大小限制的媒体字节，不跟随消息里的 URL 或本机路径。聊天模型可用 `get_message_images` 查看本条图片，语音由 `asr` 转写。托管组件自动开启图片字节返回；已有服务需开启 NapCat 的 `enableLocalFile2Url` 才能取得图片内容。文件只保留安全元数据。
- 自动回复不引用原消息，支持最多3条短消息（合计4000字）和一张独立气泡表情，模型通过工具明确分条，普通最终文本不按标点机械拆分。输入最多 64 个段；不支持的消息段和畸形事件不会进入模型。
- 主动媒体可通过 CLI JSON 发送 PNG/JPEG 图片、WAV/SILK 语音，单个最多 2 MB，总段数据不超过 2.8 MB。P7支持单独发送最多2MB的TXT/PDF文件，upload_private_file/upload_group_file本身即实际发送，不再发送第二条消息。长媒体与视频仍不支持。
- 手动发送只接受本机认证入口明确提供的媒体字节，经格式和大小校验后转为 OneBot `base64://`；不接受任意 URL、路径或入站缓存文件名。协议服务仍可能因媒体编码或账号状态拒绝请求。

此边界依据固定 NapCat `98d781d19815d1625b24d717ce280ecf0a4f6d0c` 的 `packages/napcat-onebot/api/msg.ts`（`handleOb11FileLikeMessage`、`handleObfuckName`）及 `packages/napcat-common/src/file.ts`：缓存名未命中可回落到本地文件解析，因此不透传缓存名。OneBot 11 标准 `message/segment.md` 明确支持图片/语音 base64 输入。详情和许可见 [上游记录](upstreams.md)。没有复制这些上游实现。

## CLI

沿用 `--data-dir PATH --json`。配置和发送 JSON 通过标准输入传入，避免把 token 放命令行参数或 shell 历史。

```sh
node dist/cli/src/main.js channels status --json
node dist/cli/src/main.js channels configure --json < /private/path/qq-config.json
node dist/cli/src/main.js channels start --json
node dist/cli/src/main.js channels deliveries --json
node dist/cli/src/main.js channels send --json < /private/path/message.json
node dist/cli/src/main.js channels audit --json
node dist/cli/src/main.js channels stop --json
```

配置示例（`revision` 取当前 `channels status`；首次为空字符串；`token` 省略保持、空字符串清除）：

```json
{"revision":"","url":"ws://127.0.0.1:3001","accountId":"机器人QQ号","ownerId":"主人QQ号","friendIds":["好友QQ号"],"groupReplyMode":"all","groups":[],"enabled":true,"replyEnabled":true,"proactiveEnabled":false,"token":"自行填写"}
```

发送输入示例（需已开启主动消息权限）：

```json
{"target":{"kind":"private","id":"主人QQ号"},"segments":[{"type":"text","data":{"text":"要发送的消息"}}]}
```

图片段是 `{"type":"image","data":{"file":"base64://文件字节的Base64"}}`；语音使用 `record`，不接受其他附加发送参数。发送 API 为 `POST /v1/channels/qq/send`，正文同上，返回 `{id,status}`；仅 `sent` 表示协议确认。HTTP中断时先查询发送记录或真实 QQ，不自动重试。

## 实际验证

`npx vitest run apps/runtime/src/channels/protocol.test.ts tests/integration/qq.test.ts` 使用隔离 OneBot 夹具、真实 DSH 和本地 HTTP 测试模型；`node scripts/smoke-qq.mjs` 使用构建后 CLI/Runtime/插件完成配置、直接发送和停用，临时数据自动清理。`--desktop` 保持夹具运行供原生 UI 验证，Ctrl-C 清理。

`tests/integration/qq-rework.test.ts` 另用确定性模型桩验证生成后健康检查挂起期间撤销共享、未撤销发送对照、主人/直接发送语义，以及非法凭据不改变配置、旧异常凭据重启后的本地聊天和修正恢复。

用户已在真实 QQ 上确认扫码登录和文字回复。多好友与群触发策略、主动发送、图片与语音处理、文件和表情投递的验证依据是隔离夹具。真实账号的媒体效果、Windows 原生运行和云模型表现仍需分别验证。

## 内置组件的固定来源与验证

- NapCat v4.18.42，commit `9335843246e3b7a17944861f3ac8731a259732c2`。
- macOS/Linux：官方 `mlikiowa/napcat-docker`，固定 manifest digest `sha256:696e9574a0f6fb2f86cbecba8a32048f2a5823117dc9b13c6c02637ad890fa8b`，amd64/arm64。仅映射回环端口、挂载本实例数据，不启用 privileged、host network 或 Docker socket 挂载；上游原始日志不转交应用日志。
- Windows x64：[官方原版 Windows.Node 包](https://github.com/NapNeko/NapCatQQ/releases/download/v4.18.42/NapCat.Shell.Windows.Node.zip)，SHA256 `77397ac38d66f46383e48f08f35d5f9d37ec575c22069f62d6c600e73b4521ed`。内含 QQ 运行所需文件与 Node；校验后受限解包，用 Windows Job Object 管理独立进程树，不执行上游系统安装器。
- 内部 WebUI 认证、扫码与配置 API 由 Runtime 封装，不向前端暴露凭据或任意请求代理。好友/群发现仅使用明确的只读 OneBot 操作。
- 组件安装、Docker 与界面的早期验证记录见 [Spec 023 实施计划](../specs/spec-023-managed-qq/plan.md)。

## 表情回复

连接 → QQ → 表情中可预览三张内置大肥鱼娘图片，启停本地表情，或添加 PNG/JPEG（单张最大 2 MB）。添加时填写名称和适用场景，方便大肥鱼按语境选择；本地库最多 48 张、总计 24 MB。自添加图片可以删除，内置图片可停用。

「网络表情」默认开启，使用[梗鲸公开图库](https://aigengtu.com/)的 DeepSeek 娘目录。大肥鱼可搜索、查看图片，再为当前 QQ 回复选择一张；图库或图片暂时不可用时可继续使用本地表情或文字。不会访问用户或模型给出的任意图片网址。公开图库内容由第三方维护，筛选和模型看图不能保证每次选图都适合；不希望使用外部素材时可关闭网络表情。

每轮最多查看三张、选择一张表情；文字和图片分开气泡，也可只发表情。模型工具的选择仅为待发送状态；最终发送仍检查账号、回复范围、取消状态、记忆范围及图片是否被停用/删除。发送结果未知时不会自动重试。此能力仅用于 QQ 自动回复，桌面聊天和其他平台没有因此获得自动发图能力。

日常问候、撒娇、庆祝、接梗和晚安等情境会鼓励大肥鱼主动配图，不用先说“发个表情”；认真讨论、当前人格或对方偏好只用文字、没有合适图片时仍用文字。它会优先选同样贴切的新图，不强制每几轮配图。每个 QQ 账号下的私聊和群聊分别记住最近八张表情，同群不同成员共享记录；已确认或可能已投递的图片用于避重复，失败或取消的不计入。记录仅存在当前 Runtime 内存中，重启后重新积累；未知投递仍是未知结果。真实模型的自然使用频率会有差异。

本地表情与网络开关保存在 SQLite，并随「插件」范围的逻辑备份导出；schema 6/7 的旧备份仍可恢复。网络候选仅保留在当前回合，不写入本地库。

API：`GET/POST /v1/channels/qq/stickers` 获取元数据/上传，`GET /v1/channels/qq/stickers/:id/image` 读取图片，`PUT /v1/channels/qq/stickers/:id` 以 `{revision,enabled}` 修改状态，`DELETE /v1/channels/qq/stickers/:id` 删除自添加表情；`GET/PUT /v1/channels/qq/sticker-options` 读取/保存 `{networkEnabled,revision}`。这些接口沿用 Runtime/网页认证，不在图片 URL 中传递密钥。

托管编排 API：`POST /v1/channels/qq/component/connect`，共用现有认证与组件任务锁；响应表示任务已开始，最终连接状态仍以渠道健康检查为准。原 `install/start/stop/refresh` 入口保留供既有调用方使用。


## 人设卡工具

原卡的 `send_message`、`send_sticker`、`send_poke` 先暂存本轮动作，生成成功后按顺序投递，只作用于当前获准聊天。明确静默使用 `skip_reply`，不记为生成失败。拍一拍每轮最多一次，只拍当前发言人；仅机器人收到拍一拍时产生入站回合，不产生自我循环。NapCat依据[官方 send_poke 文档](https://napneko.github.io/develop/api/doc)，不可用或拒绝时如实记录失败。旧安装的QQ插件需通过插件更新加载新内置包，不会擅自覆盖第三方版本。

每条消息真正发送前重新核验账号、范围、取消、记忆与图片资格；失败或结果未知后停止后续动作，不自动重发。部分发送在操作记录标明。工具已排入的文字不会再用模型最终总结重复发一遍；没有新消息时不会因人设要求自行启动定时外发。

`get_message_images` 直接给聊天模型查看本条消息最多两张PNG/JPEG，不靠文字占位符猜图。`collect_sticker` 仅收藏本轮实际查看成功的入站图片；`sticker_note` 为看过的本地表情更新描述。原卡QQ收藏库在本应用对应大肥鱼本地库，保留网络图库搜索；不是读取手机QQ收藏夹。
