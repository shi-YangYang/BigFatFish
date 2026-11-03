# 开发、Web 管理与插件协议 v1

BigFatFish 使用一个根 npm 清单。`apps/runtime/src` 是唯一业务核心；Desktop、CLI 和 Web 只访问该核心。SDK 是普通源码及换行 JSON 协议，不是需要另行发布的 npm workspace。贡献流程见根 CONTRIBUTING，行为准则见 [CODE_OF_CONDUCT](CODE_OF_CONDUCT.md)。

## 本地开发与安装产物

```sh
npm ci
npm run typecheck
npm run lint
npm run build
node dist/cli/src/main.js start --data-dir /absolute/path/fish --json
node dist/cli/src/main.js plugins list --data-dir /absolute/path/fish --json
```

`build` 生成 Node 核心、桌面前端和 `dist/web`。`build:node` 同时生成 `dist/runtime/plugin-catalog` 的 QQ/B站/抖音安装产物、`dist/plugin-sdk` 和 `dist/plugin-examples`。`release:prepare` 将这些资源与固定 Node/生产依赖一起放入独立安装包。安装后的命令是 `bin/bigfatfish`，无需源码目录、全局 Node 或开发工具。桌面打包及签名边界见 [安装与迁移](install-and-migrate.md)。

## 启用 HTTPS 控制台

默认没有 Web 监听器。由服务器本机操作者准备证书和私钥，以标准输入配置独立管理口令；不要在命令参数、URL、日志或共享脚本中写口令。

```sh
# 将 JSON 从受保护的本机文件或管道输入，避免 shell 历史留下口令。
bigfatfish web configure --data-dir /absolute/path/fish < /private/path/web-settings.json
bigfatfish web serve --data-dir /absolute/path/fish
```

输入结构：`{"origin":"https://fish.example:8443","host":"127.0.0.1","cert":"/absolute/path/fullchain.pem","key":"/absolute/path/privkey.pem","password":"至少16字符的独立口令"}`。远程直连时由操作者明确配置监听地址，如 `0.0.0.0`，并配置防火墙；不可用 HTTP 降级。证书和私钥由本机文件提供，不自动申请域名或收费资源。

网关是单独的前台进程，可由服务管理器运行；退出桌面/Runtime 不代表关闭网关。网关只在服务器内部读本地连接凭据，转发同一 Runtime API，浏览器不会得到本机 bearer。登录使用 scrypt 哈希、Secure/HttpOnly/SameSite=Strict cookie、1小时会话、CSRF令牌和严格 Origin/Host；每个来源地址1分钟最多5次登录尝试。过期/退出撤销 WebSocket；浏览器收到明确的会话失效响应后返回登录，重新登录可继续管理。普通断线或业务权限不足保留登录状态。代理头默认拒绝，反向代理必须保留所配置的原始 Host/Origin，且后端连接仍使用 TLS，不允许把未经验证的 X-Forwarded-* 当身份依据。

Web 配置位于受保护的 `runtime/web-config.json`，不进入逻辑备份。正在运行的网关持有独立锁，`web configure` 返回 `WEB_STOP_REQUIRED`，不会假装已换密。先停止 `web serve`（Ctrl+C 或停止所属服务），再配置和启动；所有旧会话随进程退出失效。证书续期后也须重启网关。本地测试证书仅在独立浏览器上下文中信任，不安装全局 CA。

主页、聊天、人格、生活、记忆、模型、渠道、B站、抖音、任务、权限、插件、语音、日志和备份均复用真实 Runtime。语音合成明确标为 AI 合成，不自动发送。浏览器没有修改访问者电脑启动项的能力；桌面设置继续走 Tauri。

备份与恢复由仍在线的网关先排空 Runtime、调用同一离线维护核心及固定实例锁，再启动 Runtime。只有恢复/备份及启动均结束才返回 completed；浏览器上传/下载字节，不指定服务器任意文件路径。恢复替换当前鱼，原始目录在 rollback 目录保留；插件安装代码、旧授权和会话不随逻辑备份恢复。恢复后重新安装/授权。schema 保持6，P6归档可直接导入，未知版本仍拒绝。

更新使用本机已经明确配置的 P6 签名信任源；Web 不提供任意路径执行。检查、安装、回退调用相同更新核心。portable 安装支持范围及 Windows 限制沿用 P6；安装后 Runtime 会重启，网关进程本身须由操作者重启以载入新代码。没有已配置正式发行源时返回明确错误，测试密钥不是默认信任源。

## API 与事件

本机客户端读取受限 `runtime/connection.json`，连接 `http://127.0.0.1:PORT` 并带 bearer；不接受浏览器 Origin。Web 从同源 `/api/v1/*` 访问；登录 `/auth/login`，读取会话 `/auth/session`，退出 `/auth/logout`。写入请求同时要求同源 Origin 和 `X-BFF-CSRF`。模型 API Key 仅写入，查询只返回 hasKey。

| API | 用途 |
| --- | --- |
| `/v1/status`、`/v1/logs` | 实际运行状态、脱敏日志 |
| `/v1/models`、`/v1/model-routes` | 模型配置及 chat/reasoning/vision/memory/asr/tts 路由 |
| `/v1/persona`、`/v1/persona/history` | 版本化人格 |
| `/v1/conversations`、`/:id/messages`、`/:id/tools` | 会话、消息与实际工具活动 |
| `/v1/messages/:id/cancel` | 取消实际模型回合 |
| `/v1/memories`、`/v1/memory-tasks`、`/v1/life` | 长期记忆、整理任务和养成；具体子路由见 ai-core.md |
| `/v1/channels/qq`、`/v1/permissions/approvals` | 账户连接、发送提案及主人审批 |
| `/v1/bilibili`、`/v1/douyin`、`/v1/activities`、`/v1/schedules` | 平台活动及共用队列 |
| `/v1/plugins` | 安装目录、生命周期和工具 |
| `/v1/media/transcribe`、`/v1/media/synthesize` | 有界音频消费者 |

WebSocket：本机 `/v1/events?conversationId=ID` 使用 bearer；Web `/events?conversationId=ID` 使用登录 cookie 和精确 Origin，不把 token 放查询串。消息帧有 conversationId、message；工具帧有 name、state、at、conversationId。初始 ready 不是生成完成。断线后的权威记录从消息 HTTP API 重新读取，发送使用 requestId 防重复。前端会话切换与草稿版本保护不能省略。

ASR 输入 `{data:base64,mimeType}`，最大2MB，支持 WAV/MP3/M4A/WebM/Ogg 类型，按真实 MIME 使用对应文件名；使用所选 OpenAI 兼容模型的 `/audio/transcriptions`。TTS 输入 `{text,voice}`，最多4096字符，调用 `/audio/speech` 请求 WAV，输出最多4MB、校验RIFF/WAVE。模型/voice由用户按服务文档配置，不自动套用过时模型或把不兼容 Realtime 模型放入 Speech 协议。独立CLI：`bigfatfish media transcribe|synthesize < input.json`；Desktop/Web「语音」可显式调用和播放。这里的 OpenAI 指兼容协议，不保证所有服务实现相同；真实服务、计费和音质需用户自己的账号验证。

## 从外部目录开发插件

安装包中复制 `dist/plugin-examples/hello-fish` 到独立目录；源码开发时复制 `examples/hello-fish/{manifest.json,index.mjs}` 及 `plugins/sdk/host.mjs` 到同一个外部目录。

```sh
node /absolute/path/installation/dist/plugin-sdk/pack-plugin.mjs /absolute/path/hello-fish /absolute/path/hello.bff-plugin
bigfatfish plugins inspect /absolute/path/hello.bff-plugin --data-dir /absolute/path/fish
bigfatfish plugins install /absolute/path/hello.bff-plugin --data-dir /absolute/path/fish
printf '%s' '{"granted":["tools.execute","events.emit"],"config":{}}' | bigfatfish plugins enable hello-fish --data-dir /absolute/path/fish
printf '%s' '{"name":"greet","args":{"name":"主人"}}' | bigfatfish plugins call hello-fish --data-dir /absolute/path/fish
bigfatfish plugins disable hello-fish --data-dir /absolute/path/fish
```

安装只校验并保存，不运行安装脚本、不启用代码。`inspect` 展示来源、作者、许可、兼容和权限；安装不代表该来源已由发行者签名认证，用户必须信任代码。授权必须列出全部且仅有清单权限。重新启用、调用、禁用均调用真实进程。主人聊天中的 DSH 会获得已启用工具；QQ主人私聊仍是外部渠道主体，不获得本机管理工具。

升级时修改外部目录 manifest.version 和代码，重新打包，先 inspect 再 `plugins update FILE`。候选写入新唯一目录，旧进程排空后启用；初始化/健康失败恢复旧版本及其配置/存储快照。新增权限导致停用且清空授权，需再次明确授权。`plugins remove ID` 卸载代码并保留作用域存储；重新安装相同ID可继续使用数据。更新、卸载都不清除鱼的人格、历史和长期记忆。

## 产物与 manifest

`.bff-plugin` 是有界 JSON：`{format:"bigfatfish-plugin",manifest,files:[{path,sha256,data}]}`，data为规范base64。最多1000文件、解码总量16MB。路径不得绝对、穿越、重复（不区分大小写）、进入node_modules或包含链接类型；哈希校验后写入唯一受限目录。打包器拒绝文件系统链接。没有 tar 安装脚本、postinstall 或网络下载执行。

manifest 字段以 `examples/hello-fish/manifest.json` 为可执行范例：协议1、ID/版本、名称/作者/许可/来源、Runtime兼容范围 `^0.1.0`、OS数组、entry、dependencies、configSchema、permissions、extensions、tools。v1仅支持固定协议及当前0.1兼容线，不把未知版本当可兼容。依赖只允许产品已管理的 ws/qrcode/playwright-core，通过宿主安装目录解析；不自动npm install。configSchema只接受非敏感配置，支持对象的 string/number/boolean 字段和required；writeOnly、maxLength等未实现约束一律拒绝，不能用配置保存凭据。模型密钥使用统一模型配置，平台凭据使用其专用入口。工具参数支持有界object/array/string/boolean/number/integer、required和enum，未知键拒绝，不支持的高级JSON Schema约束不要声明为有效。

QQ、B站、抖音随安装包提供真实目录产物并进入同一安装/版本/停用管理。首次由产品已信任的随包代码建立默认组件；账户连接仍受各平台显式enabled/凭据/审批控制。升级为其他来源同样必须用户信任。QQ已有in-process接口、B站短命子进程及抖音Chrome/Python组合按真实依赖运行；它们不是全都变成同一种RPC进程。平台停用排空原队列、撤销在途审批并阻断直接平台入口；资源加载来自选中安装目录，抖音包同时携带其Python服务源码，Python环境仍由用户明确准备。

## RPC、权限与扩展方式

`host.mjs` 提供 `servePlugin({initialize,health,dispose,event,tools})`。标准输入/输出专用于一行一个JSON；调试信息写stderr。请求 `{id,method,args}`，结果 `{id,result}` 或 `{id,error}`。宿主调用 initialize/health/tool/event/dispose；工具参数在 `args.args`，工具名在 `args.name`。host调用 `{id,callId,host:true,method,args}` 必须关联仍有效的宿主调用，不能在模块顶层或调用结束后偷偷调用。

单帧最多256KB，双向最多8个并发，调用10秒超时。取消、超时、禁用或崩溃结束真实进程并终止拥有的宿主网络请求；代次变化阻断旧结果。禁用、更新或卸载开始撤权时先同步中止所有 RPC 拥有的宿主操作（含初始化与事件），再有界等待 dispose 和实际退出；清理期间不再接受宿主能力请求。普通SDK插件运行在同一个操作系统用户下，可以自行访问该用户的文件/网络，也可能绕过RPC访问系统；这些限制只约束提供的宿主能力，不是OS安全沙箱。恶意代码须使用额外独立OS用户/容器隔离，当前产品不宣称已提供该隔离。

| 权限 / host方法 | 实际作用 |
| --- | --- |
| tools.execute | 显式手动调用与主人DSH回合可使用声明工具 |
| storage.read / storage.get | 读取本ID作用域键 |
| storage.write / storage.set | 写作用域JSON，单值32KB、总量128KB；不接受文件路径 |
| events.emit / events.emit | 写带插件ID的事件审计，无任意系统事件伪造 |
| events.subscribe | 接收Runtime消息事件；授权前须理解它包含会话内容 |
| memory.search | 使用统一MemoryStore查询，不返回模型密钥 |
| memory.propose | 生成有来源的候选记忆，不自动确认 |
| personality.read | 读取当前版本化人格；修改仍由主人界面执行 |
| channel.propose | 创建QQ发送提案，沿同一账户/目标/审批门，插件不能自批 |
| media.transcribe / media.synthesize | 调用统一ASR/TTS路由，继承调用取消 |
| channel.qq / activity.bilibili / activity.douyin | 对应受信任随包平台组件的加载许可，不等于账号发送授权 |

扩展类型是能力分类，不能仅填写名字就获得宿主权限。Tool/Integration使用声明工具和事件；Memory使用search/propose；Personality读取当前人格并通过工具返回建议，由用户确认修改；Service使用受控媒体调用或自己的明确外部辅助服务；Activity由工具返回活动结果/提案，不能绕过现有调度审批；Channel的受信任平台契约位于 channels/types.ts，第三方RPC渠道只能提出受审批动作，不能把自己声明为主人；Model通过明确的OpenAI兼容HTTP服务接入现有配置/路由，v1不提供任意替换AgentEngine或主模型的RPC方法。扩展不另建人格/记忆数据库，不擅自把会话当长期记忆。

MCP仅由平台/服务适配层拥有。抖音辅助服务严格复用Runtime拥有的CDP实例，工具白名单、实际请求审批和最终提交门不能省略。固定依赖安装步骤见 [抖音](douyin.md)，平台来源与许可见 [上游记录](upstreams.md)。

## QQ 媒体与实际协议

入站仅处理已授权账号/目标/消息结构中的不透明媒体标识，先核对当前账号并重新检查授权。图片通过NapCat get_file，只消费其base64字段；不读取NapCat返回的本机file路径或URL。NapCat需明确开启提供base64的配置，否则用户看到媒体未取得。语音通过get_record(out_format=wav)，可能需要NapCat主机安装ffmpeg。一次最多处理2个媒体，每个最多2MB，接收器每帧最多3MB，发送审批列表单次总量8MB，取消/停用传播到模型和实际连接。

发文件只允许有界base64与干净的TXT/PDF/PNG/JPG/WAV文件名。文件是单独一个审批消息，不混入文本再发送一次。`upload_private_file` / `upload_group_file` 本身就是发送，真实调用紧跟最终同步授权门；返回有效file_id才记为确认，结果未知不自动重发。图片/语音仍走OneBot标准消息段；自动聊天回复仍是文本并引用原消息。真实QQ账号尚未验证，协议夹具成功不代表平台账号可用。

## 验证与诊断

定向用例：`tests/integration/web.test.ts` 使用实际TLS与隔离Chrome；`plugins.test.ts` 从外部目录打包并跑真实DSH工具回合；`plugins/boundaries.test.ts` 覆盖归档、权限、取消、初始化回退；`p7-media.test.ts` 使用实际音频字节和OneBot协议接收器。B站/抖音集成用例设置 BFF_TEST_FFMPEG / BFF_TEST_PYTHON 后通过实际安装资源运行。云模型、真实账号、Windows和正式发布证据必须另列。

常见问题：WEB_LOGIN_REQUIRED重新登录；WEB_ORIGIN_DENIED核对实际origin/Host及代理头；WEB_STOP_REQUIRED先停网关再换口令；PLUGIN_PERMISSION_REQUIRED查看权限清单并明确授权；PLUGIN_DISABLED查看停用/恢复后状态；PLUGIN_STOPPED检查崩溃、超时或取消；PLUGIN_DEPENDENCY_UNSUPPORTED不能自动装未知依赖；MEDIA_BYTES_UNAVAILABLE在NapCat检查所需返回字节配置。不要用关掉权限、忽略签名或扩大网络访问来消除报错。

macOS独立安装新增能力复现：完成`release:prepare`与Tauri bundle后运行`node scripts/smoke-p7.mjs`。它复制.app到外部临时目录，只用随包Node验证SDK/DSH/媒体/Web，并清理自有临时实例；`--native`保留隔离原生窗口供人工操作，Ctrl+C后清理其配置。默认要求原生desktop.json不存在，存在时会拒绝覆盖。无秘密运行证据写入build/p7-evidence。
