# QQ 渠道

BigFatFish 可以在应用内准备原版 NapCat、扫码登录并设置回复范围，也保留连接已有 OneBot 11 服务的方式。NapCat 是独立的第三方组件，遵循其自身的[许可证](https://github.com/NapNeko/NapCatQQ/blob/9335843246e3b7a17944861f3ac8731a259732c2/LICENSE)，不属于大肥鱼的 MIT 授权。请使用专用 QQ 账号，扫码与设备验证由用户完成。

## 快速连接

1. 打开「连接 → QQ → 快速连接」，点击「准备 QQ 组件」。首次需要联网下载固定版本。
2. macOS/Linux 需要本机 Docker 已安装并启动，Docker 必须使用 Linux 容器；Windows x64 使用独立原生组件，不需要 Docker 或系统 QQ。Windows arm64 暂不支持内置组件，可连接已有服务。
3. 点击「启动并登录」，用手机 QQ 扫描大肥鱼显示的二维码并确认登录；过期时点击「刷新二维码」。
4. 登录后显示机器人账号。选择「我的 QQ」或手动填写自己的 QQ 号；展开「群聊回复」选择允许回复的群，默认不授权任何群。好友/群列表不可用时可手填 ID。
5. 点击「启用连接」。默认只回复主人私聊及授权群的真实 @ 消息。「主动消息」默认关闭，开启后每条主动消息仍需要审批。

内部地址、端口和两套随机凭据由 Runtime 管理，无需填写；机器人 QQ 从真实登录信息读取，不推断主人身份。「已登录」表示组件确认账号已在线，页面顶部「已连接」还要求现有 OneBot 插件完成账号与健康检查。

「暂停回复」停用渠道并撤销待审批消息，保留 QQ 组件；「停止组件」同时停用渠道和所属组件。重新启动后可再次启用。开发窗口退出随 Runtime 清理组件；正式安装版关闭窗口到后台时，组件随后台继续运行。Runtime 正常关闭会清理所属容器或原生进程树；强制断电等不可捕获退出不保证实时清理，后续启动仅识别本实例资源。

组件存于当前数据目录的 `data/qq-component/`，QQ 登录数据与日常 QQ 隔离。Mac 不修改 `/Applications/QQ.app`，Windows 不修改系统 QQ/注册表。便携逻辑备份不包含组件程序、QQ 登录态或容器身份；迁移后需重新准备和登录，恢复配置保持停用。

## 连接已有服务

已有 NapCat 的用户在「已有服务」填写地址、连接凭据、机器人 QQ 与主人 QQ。NapCat 需开启 OneBot 11 正向 WebSocket，消息格式为数组；本机允许回环 WS，远端必须使用 WSS。反向 WebSocket 和 HTTP 上报未接入。

凭据留空保留原值，不会在查询接口返回；必须可用于 HTTP Authorization 头，不能包含中文、表情、空白或控制字符。非法值在保存前拒绝，保留原连接。切换到内置组件前请先停用已有服务；组件不会接管其他 NapCat 或 QQ 进程。

已有不合法连接凭据导致初始化失败时，仅 QQ 显示凭据错误；本地 Runtime 和聊天仍可使用，可在渠道设置中填写有效凭据后恢复。主密钥文件缺失仍会安全拒绝启动，不会生成替代密钥。

默认仅回复指定主人私聊；群必须明确列入允许列表，且消息段中真实 @ 机器人。昵称、自称主人、CQ 字符串不授予权限。群中每位作者与私聊会话隔离，账号、主人或授权配置改变后建立新引擎会话。QQ 历史可在桌面聊天页查看，但不能从本机直接续写渠道会话。

## 记忆与审批

本机与主人私聊使用同一人格和已确认记忆。旧记忆默认私有。记忆页的「允许群聊使用」只共享该条内容；原始来源摘录不注入群。撤销共享后，群聊不会恢复包含旧共享上下文的引擎会话。已生成但尚未发出的回复也会在账号健康检查完成后复核本次使用的共享范围；范围变化则阻止发送，记录 `blocked / MEMORY_SCOPE_CHANGED`。群来源记录真实 QQ 作者，提取的候选不会自动归为主人事实，仍需本机确认。

已授权入站回复可自动发送。主动消息须在「连接 → QQ → 主动消息与操作记录」创建审批，核对接收对象、正文或媒体预览后批准；5 分钟有效、仅执行一次。可以发给主人或已授权群。审批批准立即进入「正在发送」，之后查询实际结果。停用、撤权或配置变更会撤销待审批项、取消在途生成；已进入外部发送的消息无法撤回。

`sent` 仅表示协议服务返回成功和消息 ID，不代表对方已读。外发前因权限或健康检查失败被阻止的消息记录为 `blocked`，审批撤权记录为 `revoked`。`unknown` 表示外发请求发生后超时、断线、异步接受或不明确响应；不会自动重试。请在 QQ 人工核实后再决定是否重新创建消息。重复入站消息跨重启去重，重启期间尚未完成的生成标记中断，正在发送的记录标记未知。

## 媒体范围

完整P7接口、NapCat前置条件与运行证据边界见 [开发与协议](developer.md#qq-媒体与实际协议)。

- 入站识别文本、图片、语音、文件、真实提及及引用消息；保留类型与安全元数据，不获取 URL、不读取本机路径。P7通过同账号的get_file/get_record只获取有界base64字节，图片交视觉模型、语音交统一ASR；未取得字节或模型失败时明确标记未理解。文件内容阅读仍不支持。
- 自动回复为文本并引用原消息，单条文本最多 4000 字，不自动拆分长消息。输入最多 64 个段；不支持的消息段和畸形事件不会进入模型。
- 主动图片/语音可以从桌面选择 PNG/JPEG/WAV 文件，单个最多 2 MB，审批抽屉或 QQ 操作记录显示图片/语音预览。CLI JSON 另支持 SILK 语音（桌面无法预听 SILK）。总段数据不超过 2.8 MB。P7支持单独发送最多2MB的TXT/PDF文件审批，upload_private_file/upload_group_file本身即实际发送，不再发送第二条消息。长媒体与视频仍不支持。
- 发送只接受本机认证入口明确提供的媒体字节，经格式和大小校验后转为 OneBot `base64://`；不接受任意 URL、路径或入站缓存文件名。协议服务仍可能因媒体编码或账号状态拒绝请求。

此边界依据固定 NapCat `98d781d19815d1625b24d717ce280ecf0a4f6d0c` 的 `packages/napcat-onebot/api/msg.ts`（`handleOb11FileLikeMessage`、`handleObfuckName`）及 `packages/napcat-common/src/file.ts`：缓存名未命中可回落到本地文件解析，因此不透传缓存名。OneBot 11 标准 `message/segment.md` 明确支持图片/语音 base64 输入。详情和许可见 [上游记录](upstreams.md)。没有复制这些上游实现。

## CLI

沿用 `--data-dir PATH --json`。配置和审批 JSON 通过标准输入传入，避免把 token 放命令行参数或 shell 历史。

```sh
node dist/cli/src/main.js channels status --json
node dist/cli/src/main.js channels configure --json < /private/path/qq-config.json
node dist/cli/src/main.js channels start --json
node dist/cli/src/main.js channels deliveries --json
node dist/cli/src/main.js permissions propose --json < /private/path/message.json
node dist/cli/src/main.js permissions list --json
node dist/cli/src/main.js permissions decide APPROVAL_ID --json < /private/path/decision.json
node dist/cli/src/main.js permissions audit --json
node dist/cli/src/main.js channels stop --json
```

配置示例（`revision` 取当前 `channels status`；首次为空字符串；`token` 省略保持、空字符串清除）：

```json
{"revision":"","url":"ws://127.0.0.1:3001","accountId":"机器人QQ号","ownerId":"主人QQ号","groups":[],"enabled":true,"replyEnabled":true,"proactiveEnabled":false,"token":"自行填写"}
```

审批输入示例（需已开启主动消息权限）：

```json
{"target":{"kind":"private","id":"主人QQ号"},"segments":[{"type":"text","data":{"text":"待批准的消息"}}]}
```

图片段是 `{"type":"image","data":{"file":"base64://文件字节的Base64"}}`；语音使用 `record`，不接受其他附加发送参数。批准/拒绝输入为 `{"decision":"approve","digest":"审批返回的完整digest"}` 或 `reject`。不得修改显示内容后沿用旧审批。

## 实际验证

`npx vitest run apps/runtime/src/channels/protocol.test.ts tests/integration/qq.test.ts` 使用隔离 OneBot 夹具、真实 DSH 和本地 HTTP 测试模型；`node scripts/smoke-qq.mjs` 使用构建后 CLI/Runtime/插件完成配置、审批、发送和停用，临时数据自动清理。`--desktop` 保持夹具运行供原生 UI 验证，Ctrl-C 清理。

`tests/integration/qq-rework.test.ts` 另用确定性模型桩验证生成后健康检查挂起期间撤销共享、未撤销发送对照、主人/独立审批语义，以及非法凭据不改变配置、旧异常凭据重启后的本地聊天和修正恢复。

已执行本机 macOS 原生渠道/审批操作；没有连接真实 QQ 账号或扫码，没有真实 QQ 私聊/群聊/媒体收发证据。Windows 原生与真实云模型验证也未执行。

## 内置组件的固定来源与验证

- NapCat v4.18.42，commit `9335843246e3b7a17944861f3ac8731a259732c2`。
- macOS/Linux：官方 `mlikiowa/napcat-docker`，固定 manifest digest `sha256:696e9574a0f6fb2f86cbecba8a32048f2a5823117dc9b13c6c02637ad890fa8b`，amd64/arm64。仅映射回环端口、挂载本实例数据，不启用 privileged、host network 或 Docker socket 挂载；上游原始日志不转交应用日志。
- Windows x64：[官方原版 Windows.Node 包](https://github.com/NapNeko/NapCatQQ/releases/download/v4.18.42/NapCat.Shell.Windows.Node.zip)，SHA256 `77397ac38d66f46383e48f08f35d5f9d37ec575c22069f62d6c600e73b4521ed`。内含 QQ 运行所需文件与 Node；校验后受限解包，用 Windows Job Object 管理独立进程树，不执行上游系统安装器。
- 内部 WebUI 认证、扫码与配置 API 由 Runtime 封装，不向前端暴露凭据或任意请求代理。好友/群发现仅使用明确的只读 OneBot 操作。
- 本轮协议、权限、取消和 Runtime 生命周期采用隔离夹具验证，实际 Docker/界面证据由 Spec023 Plan 记录。Windows 原生、真实 QQ 扫码与账号收发仍待验证。
