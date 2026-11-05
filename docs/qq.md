# QQ 渠道

BigFatFish 可以在应用内准备原版 NapCat、扫码登录并设置回复范围，也保留连接已有 OneBot 11 服务的方式。NapCat 是独立的第三方组件，遵循其自身的[许可证](https://github.com/NapNeko/NapCatQQ/blob/9335843246e3b7a17944861f3ac8731a259732c2/LICENSE)，不属于大肥鱼的 MIT 授权。请使用专用 QQ 账号，扫码与设备验证由用户完成。

## 快速连接

1. 打开「连接 → QQ」，点击「连接 QQ」。缺少组件时会自动下载并启动，无需分别准备、启动。
2. macOS/Linux 需要本机 Docker 已安装并启动，且使用 Linux 容器；Windows x64 使用独立原生组件。Windows arm64 可连接已有服务。
3. 用手机 QQ 扫描二维码并确认登录；过期时可刷新二维码。相同账号已有保存设置时，登录后自动恢复连接。
4. 首次登录或换账号后，在「回复设置」选择主人 QQ 和允许回复的好友、群，点击「保存并连接」。不会自动猜测主人或授权联系人。之后修改使用「保存设置」。

QQ 页面以「回复设置 / 表情 / 消息」三个页签组织。好友、群直接显示；新增好友或加入群后，点击回复设置右上角的刷新图标更新列表，未保存的选择会保留，新成员需自行勾选。群默认普通消息也可回复，也可选择仅被 @ 时回复。主动消息默认关闭。
内部地址、端口和两套随机凭据由 Runtime 管理，无需填写；机器人 QQ 从真实登录信息读取，不推断主人身份。「已登录」表示组件确认账号已在线，页面顶部「已连接」还要求现有 OneBot 插件完成账号与健康检查。

「断开连接」同时停止渠道及所属组件，设置保留。再次点击「连接 QQ」即可恢复；渠道单独暂停但组件仍在线时显示「重新连接」。准备和启动期间可取消。暂停、取消、配置变化或换账号会阻止之前操作迟到恢复连接。开发窗口退出随 Runtime 清理组件；正式安装版关闭窗口到后台时，组件随后台继续运行。Runtime 正常关闭会清理所属容器或原生进程树；强制断电等不可捕获退出不保证实时清理，后续启动仅识别本实例资源。

组件存于当前数据目录的 `data/qq-component/`，QQ 登录数据与日常 QQ 隔离。Mac 不修改 `/Applications/QQ.app`，Windows 不修改系统 QQ/注册表。便携逻辑备份不包含组件程序、QQ 登录态或容器身份；迁移后需重新准备和登录，恢复配置保持停用。

## 连接已有服务

已有 NapCat 的用户点击「连接已有服务」，填写地址、连接凭据、机器人 QQ 与主人 QQ。NapCat 需开启 OneBot 11 正向 WebSocket，消息格式为数组；本机允许回环 WS，远端必须使用 WSS。填写完成后点击「保存并连接」，无需另勾选启用。反向 WebSocket 和 HTTP 上报未接入。

凭据留空保留原值，不会在查询接口返回；必须可用于 HTTP Authorization 头，不能包含中文、表情、空白或控制字符。非法值在保存前拒绝，保留原连接。切换到内置组件前请先停用已有服务；组件不会接管其他 NapCat 或 QQ 进程。

已有不合法连接凭据导致初始化失败时，仅 QQ 显示凭据错误；本地 Runtime 和聊天仍可使用，可在渠道设置中填写有效凭据后恢复。主密钥文件缺失仍会安全拒绝启动，不会生成替代密钥。

主人只能有一个，其他私聊账号必须明确列入好友允许列表；群必须明确列入允许列表。群触发可选普通消息或真实 @，旧配置缺省为普通消息。昵称、自称主人、CQ 字符串不授予身份。每位作者与私聊/群聊会话隔离，账号、主人或授权配置改变后建立新引擎会话。QQ 历史可在桌面聊天页查看，但不能从本机直接续写渠道会话。

## 记忆与发送

本机与主人私聊使用同一人格和已确认记忆。旧记忆默认私有。记忆页的「允许群聊使用」只共享该条内容；原始来源摘录不注入群。撤销共享后，群聊不会恢复包含旧共享上下文的引擎会话。已生成但尚未发出的回复也会在账号健康检查完成后复核本次使用的共享范围；范围变化则阻止发送，记录 `blocked / MEMORY_SCOPE_CHANGED`。群来源记录真实 QQ 作者，提取的候选不会自动归为主人事实，仍需本机确认。

已授权入站回复可自动发送。开启主动消息权限后，CLI、B站分享和具备 `channel.send` 权限的插件可向授权对象发送消息，使用同一发送服务。停用、撤权或配置变更会取消在途生成并阻止尚未发出的消息；已进入外部发送的消息无法撤回。

旧 QQ 审批接口返回 `QQ_APPROVAL_REMOVED`，历史待审批项不会自动发送。旧插件 `channel.propose` 权限不升级为直接发送，采用 `channel.send` 需要重新授权。其他平台审批保持独立。获准好友仅使用已共享记忆，不能获得主人身份或管理工具。

`sent` 仅表示协议服务返回成功和消息 ID，不代表对方已读。自动回复生成失败记录为 `failed`，与外发前因权限或健康检查被阻止的 `blocked` 分开；取消与重启中断记录为 `interrupted`。`unknown` 表示外发请求发生后超时、断线、异步接受或不明确响应；不会自动重试。请在 QQ 人工核实后再决定是否重新创建消息。重复入站消息跨重启去重，重启期间尚未完成的生成标记中断，正在发送的记录标记未知。投递记录仍可通过 CLI 或 API 查询，历史数据保留。

「连接 → QQ → 消息」仅展示操作记录，包含中文动作和时间，停留页面时自动更新；较长记录在卡片内滚动。读取失败时可点击「刷新」重试；未知事件显示为「历史操作记录」，不展示内部事件码或复合 ID。

OpenAI 兼容模型的新调用会保存受限错误码：`MODEL_HTTP_502` 等表示实际收到的模型 HTTP 状态，`MODEL_NETWORK_ERROR` 表示连接失败，`MODEL_STREAM_INTERRUPTED` 表示响应中途断开。错误正文、密钥和请求内容不写入错误字段。取消优先于网络错误，不自动重试。未取得详细诊断时保留通用模型失败；旧 `MODEL_RUN_FAILED` 不能据此追认具体服务端故障。

## 媒体范围

完整P7接口、NapCat前置条件与运行证据边界见 [开发与协议](developer.md#qq-媒体与实际协议)。

- 入站识别文本、图片、语音、文件、真实提及及引用消息；保留类型与安全元数据，不获取 URL、不读取本机路径。通过同账号的get_image/get_record只获取有界base64字节，图片交聊天模型理解、语音交统一ASR；托管组件自动开启图片字节返回。已有服务需开启NapCat的enableLocalFile2Url，否则只能收到图片信息、无法识图。读取失败时说明图片或语音已收到但本次未读成功。文件内容阅读仍不支持。
- 自动回复直接发送文本，不引用原消息，可按语境附带一张已启用或已查看的网络表情，单条文本最多 4000 字，不自动拆分长消息。输入最多 64 个段；不支持的消息段和畸形事件不会进入模型。
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

已执行本机 macOS 原生渠道/审批操作；用户已报告扫码及回复可用；本轮多好友/群模式/直接发送以隔离测试为准。Windows 原生与真实云模型验证也未执行。

## 内置组件的固定来源与验证

- NapCat v4.18.42，commit `9335843246e3b7a17944861f3ac8731a259732c2`。
- macOS/Linux：官方 `mlikiowa/napcat-docker`，固定 manifest digest `sha256:696e9574a0f6fb2f86cbecba8a32048f2a5823117dc9b13c6c02637ad890fa8b`，amd64/arm64。仅映射回环端口、挂载本实例数据，不启用 privileged、host network 或 Docker socket 挂载；上游原始日志不转交应用日志。
- Windows x64：[官方原版 Windows.Node 包](https://github.com/NapNeko/NapCatQQ/releases/download/v4.18.42/NapCat.Shell.Windows.Node.zip)，SHA256 `77397ac38d66f46383e48f08f35d5f9d37ec575c22069f62d6c600e73b4521ed`。内含 QQ 运行所需文件与 Node；校验后受限解包，用 Windows Job Object 管理独立进程树，不执行上游系统安装器。
- 内部 WebUI 认证、扫码与配置 API 由 Runtime 封装，不向前端暴露凭据或任意请求代理。好友/群发现仅使用明确的只读 OneBot 操作。
- 本轮协议、权限、取消和 Runtime 生命周期采用隔离夹具验证，实际 Docker/界面证据由 Spec023 Plan 记录。Windows 原生、真实 QQ 扫码与账号收发仍待验证。

## 表情回复

连接 → QQ → 表情中可预览三张内置大肥鱼娘图片，启停本地表情，或添加 PNG/JPEG（单张最大 2 MB）。添加时填写名称和适用场景，方便大肥鱼按语境选择；本地库最多 48 张、总计 24 MB。自添加图片可以删除，内置图片可停用。

「网络表情」默认开启，使用[梗鲸公开图库](https://aigengtu.com/)的 DeepSeek 娘目录。大肥鱼可搜索、查看图片，再为当前 QQ 回复选择一张；图库或图片暂时不可用时可继续使用本地表情或文字。不会访问用户或模型给出的任意图片网址。公开图库内容由第三方维护，筛选和模型看图不能保证每次选图都适合；不希望使用外部素材时可关闭网络表情。

每轮最多查看三张、选择一张表情，和简短文字通过同一条 QQ 消息发送。模型工具的选择仅为待发送状态；最终发送仍检查账号、回复范围、取消状态、记忆范围及图片是否被停用/删除。发送结果未知时不会自动重试。此能力仅用于 QQ 自动回复，桌面聊天和其他平台没有因此获得自动发图能力。

本地表情与网络开关保存在 SQLite，并随「插件」范围的逻辑备份导出；schema 6 的旧备份仍可恢复。网络候选仅保留在当前回合，不写入本地库。更新后需重新运行 `npm run desktop:dev` 以使用新 Runtime。

API：`GET/POST /v1/channels/qq/stickers` 获取元数据/上传，`GET /v1/channels/qq/stickers/:id/image` 读取图片，`PUT /v1/channels/qq/stickers/:id` 以 `{revision,enabled}` 修改状态，`DELETE /v1/channels/qq/stickers/:id` 删除自添加表情；`GET/PUT /v1/channels/qq/sticker-options` 读取/保存 `{networkEnabled,revision}`。这些接口沿用 Runtime/网页认证，不在图片 URL 中传递密钥。

托管编排 API：`POST /v1/channels/qq/component/connect`，共用现有认证与组件任务锁；响应表示任务已开始，最终连接状态仍以渠道健康检查为准。原 `install/start/stop/refresh` 入口保留供既有调用方使用。
