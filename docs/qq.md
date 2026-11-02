# QQ 渠道

BigFatFish 通过 OneBot 11 正向 WebSocket 连接用户独立运行的 NapCat。请使用专用 QQ 小号；非官方接入可能受到平台限制，不保证账号安全。BigFatFish 不包含 NapCat、不代替扫码登录，也不读取其他应用的账号数据。

## 连接

1. 从 [NapCat 官方项目](https://github.com/NapNeko/NapCatQQ) 自行安装并运行，完成扫码及设备验证。
2. 在 NapCat 开启 OneBot 11 正向 WebSocket，推荐配置访问 token，消息格式选择数组。反向 WebSocket、HTTP 上报目前未接入。
3. 启动 BigFatFish Runtime，配置聊天模型。在桌面「渠道」填写 WebSocket 地址、机器人 QQ 号、主人 QQ 号和允许的群号。连接凭据加密保存，不在查询接口返回；留空保持原值。凭据须可用于 HTTP Authorization 头，不能包含中文、表情、空白或控制字符；无效值会在保存前拒绝，保留原配置和连接。
4. 勾选启用连接与自动回复，保存。回环地址可用 `ws://127.0.0.1:端口`；远端必须使用 `wss://`，不接受地址内嵌凭据、查询参数或重定向。
5. 「已登录并在线」表示 `get_login_info` 账号匹配且 `get_status.online=true`。仅连接成功、`good=true` 或版本探测成功不代表已登录；扫码在 NapCat 完成。

已有不合法连接凭据导致初始化失败时，仅 QQ 显示凭据错误；本地 Runtime 和聊天仍可使用，可在渠道设置中填写有效凭据后恢复。主密钥文件缺失仍会安全拒绝启动，不会生成替代密钥。

默认仅回复指定主人私聊；群必须明确列入允许列表，且消息段中真实 @ 机器人。昵称、自称主人、CQ 字符串不授予权限。群中每位作者与私聊会话隔离，账号、主人或授权配置改变后建立新引擎会话。QQ 历史可在桌面聊天页查看，但不能从本机直接续写渠道会话。

## 记忆与审批

本机与主人私聊使用同一人格和已确认记忆。旧记忆默认私有。记忆页的「允许群聊使用」只共享该条内容；原始来源摘录不注入群。撤销共享后，群聊不会恢复包含旧共享上下文的引擎会话。已生成但尚未发出的回复也会在账号健康检查完成后复核本次使用的共享范围；范围变化则阻止发送，记录 `blocked / MEMORY_SCOPE_CHANGED`。群来源记录真实 QQ 作者，提取的候选不会自动归为主人事实，仍需本机确认。

已授权入站回复可自动发送。主动消息须在「权限」页创建审批，核对接收对象、正文或媒体预览后批准；5 分钟有效、仅执行一次。可以发给主人或已授权群。审批批准立即进入「正在发送」，之后查询实际结果。停用、撤权或配置变更会撤销待审批项、取消在途生成；已进入外部发送的消息无法撤回。

`sent` 仅表示协议服务返回成功和消息 ID，不代表对方已读。外发前因权限或健康检查失败被阻止的消息记录为 `blocked`，审批撤权记录为 `revoked`。`unknown` 表示外发请求发生后超时、断线、异步接受或不明确响应；不会自动重试。请在 QQ 人工核实后再决定是否重新创建消息。重复入站消息跨重启去重，重启期间尚未完成的生成标记中断，正在发送的记录标记未知。

## 媒体范围

- 入站识别文本、图片、语音、文件、真实提及及引用消息；保留类型与安全元数据，不获取 URL、不读取本机路径。图片理解、语音转写和文件阅读尚未接入，模型收到明确的未理解标记，不会获得伪造转写。
- 自动回复为文本并引用原消息，单条文本最多 4000 字，不自动拆分长消息。输入最多 64 个段；不支持的消息段和畸形事件不会进入模型。
- 主动图片/语音可以从桌面选择 PNG/JPEG/WAV 文件，单个最多 32 KB，审批页显示图片/语音预览。CLI JSON 另支持 SILK 语音（桌面无法预听 SILK）。总段数据不超过 48 KB。文件附件发送、长媒体、视频、视觉/ASR 消费者尚未实现，留待后续阶段。
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
