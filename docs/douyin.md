# 抖音、统一活动与调度

## 连接与界面

在「连接」找到抖音卡片，点「管理连接 → 连接抖音」。应用使用已保存的设置打开专用浏览器，并自动检查登录状态。看到「等待浏览器登录」时在该窗口登录；看到「等待验证」或「等待手机确认」时，按提示在平台页面或手机完成操作。首次绑定以本次登录的稳定账号 ID 为准，以后登录的账号必须与绑定 ID 匹配。

默认打开「记录」，展示动作、视频标题或标识、状态、时间及失败原因。可以在卡片内滚动，排队或执行中的任务可点「取消任务」。在「互动」直接发起点赞或评论；手动搜索、推荐、详情、评论读取和观看使用下方 CLI。在「我的鱼 → 活动计划」可看任务详情，管理计划、暂停或恢复活动；观看经历可在「我的鱼 → 经历」查看。

点「连接设置」可调整浏览器路径、Python 路径、绑定账号和无窗口运行选项，再点「保存并连接」。失败时在面板内显示原因并保留输入，成功后返回连接状态与登录提示。登录总是使用可见窗口和独立的浏览器配置，不读取其他浏览器的 Cookie。连接期间可点「取消连接」，已连接时点「断开连接」会关闭专用浏览器，保留登录数据和配置。

连接检查由 Runtime 持有，离开页面后继续，单次等待最多三分钟。真正的连接失败会在账号卡显示原因，可点「重试连接」；仅读取最新状态失败时，点「重试」更新。取消、更改配置或关闭服务会阻止旧操作绑定账号。



## 安装辅助依赖

根目录执行 `npm ci`。安装 Chrome、Chromium 或 Edge，浏览器路径留空时发现当前平台常见位置，也可填写绝对路径。安装 Python 3.12，创建隔离环境：

```sh
python3.12 -m venv .venv
.venv/bin/python -m pip install -r services/douyin/requirements.lock.txt
```

Windows 使用 `py -3.12 -m venv .venv` 和 `.venv\Scripts\python.exe -m pip install -r services/douyin/requirements.lock.txt`。在抖音设置填写该 Python 可执行文件的绝对路径。不必另行安装 Playwright 浏览器：辅助服务严格连接 Runtime 已启动的专用浏览器。缺 Python/依赖或浏览器只使抖音对应任务失败，本地聊天和其他平台仍可运行。本机已运行 Python 3.12.16、真实 FastMCP 1.26、Playwright Python 1.58 / Node 1.58.2 与 macOS Chrome；Windows、Linux 图形登录尚未实机验证。

## 观看与模型

一次观看默认采样 3 秒，允许 0.2–10 秒。LockyBee 原始算法核对视频身份、连续播放、解码推进和截图时间，采集三帧；首尾两帧交给默认聊天模型（`chat`）通过 DSH 理解，所选模型需支持图片，结果记录用于理解的帧索引。通过 CLI/API 观看时可设置 `audio: true` 采样音轨，通过统一 `asr` 路由调用 OpenAI 兼容的 `/audio/transcriptions`，再将转写与画面一起理解；不会加载上游 Whisper 或隐式下载模型。缺音轨/ASR 时保留部分结果和原因。没有可理解证据不生成观看经历。

字幕、音轨转写与模型结论分开记录。经历进入统一时间线和日记，兴趣仅为候选，需要用户确认。已完成/部分完成视频全历史去重；失败/取消后可用新请求 ID 重试。页面变化、登录限制、验证码不绕过。读取失败和未知提交结果不自动重试。

## 互动与提交

连接成功后，在「互动」填写视频 ID 并选择操作。点「点赞」，或填写正文后点「发送评论」，会直接创建任务并切回「记录」。以任务状态和平台收据判断是否成功，结果未知时先在平台核实。Runtime 检查绑定账号、插件权限、配置版本、活动暂停状态和实际提交参数。

`POST /v1/douyin/write` 接受 `tool`、`args`、`requestId`。同一请求 ID 不会重复提交，复用 ID 修改参数会被拒绝。取消使用活动任务接口；旧审批列表、创建、批准和撤销接口均返回 HTTP 410，历史待办不会补执行。

私信、分享和投稿的网络协议尚未验证，在创建任务前拒绝。上传接口仍只接受本机认证入口提交的 MP4 内容（最多 16 MB），不接受任意本机文件路径。

Python 每个最终提交标记重新请求单次授权；Runtime 对实际 HTTP 请求重新核对端点、稳定目标、精确正文与动作参数，提交次数最多一次，再检查账号、版本、附件和取消状态。重定向的每一跳由 Chromium 原生请求门检查；普通读取和登录跳转保留浏览器语义，受限动作不能借跳转超出本次提交的参数范围。普通 Dedicated Worker 的读取与请求继续使用所属页面的权限门；Shared Worker 的读取和安全重定向保留，但其受限 HTTP 写请求当前拒绝（固定 Playwright 版本未提供可绑定操作与收据的请求对象）。Service Worker 继续禁用。 当前所有 Worker（含嵌套）的 WS/WSS 在建立目标连接前统一拒绝，普通 HTTP/HTTPS 读取不因此禁用 Worker；页面原有未知 WebSocket 消息门继续保留。专用浏览器启动时设置本机拒绝代理，WS/WSS 无直连后备，loopback 地址也不旁路；HTTP/HTTPS 显式直连，不继承系统代理。因此必须依赖系统代理才能访问的平台在此专用会话中可能不可达；不修改系统或其他应用的代理设置。匹配请求的成功响应才是完成依据，页面按钮翻转或编辑器正文不能证明发送。导航、寻找按钮期间取消任务也会阻止未提交动作。当前只识别固定上游点赞 `commit/item/digg` 和评论 `comment/publish` 端点下有界表单请求；只允许明确的字段，未知字段或目标/内容/次数偏离提交内容均拒绝。评论收据须具备同视频、精确正文、CID 和明确父评论关系；`reply_id` / `reply_to_reply_id` 缺失、矛盾或与请求不符均返回未知，空值与 0 表示顶层。实际平台字段组合仍需登录后授权验证。私信、分享、投稿的网络 schema（含二进制 WebSocket、媒体上传）尚未可靠核实，因此当前阻止提交，`douyin status` 的 `writeCapabilities` 列出协议能力，互动页也提示这三项限制。保留上游导航/输入与收据识别代码，不把夹具协议冒充实际平台支持。私信/分享的 DOM 收据必须是同一稳定收件人会话内本人发送、精确正文/视频 ID、新的真实消息 ID、sent 状态，连续两次快照一致；提交前基线包含隐藏的既有稳定 ID，旧节点变为可见也不能算新增；既有消息、pending/failed、整页正文、合成 ID 和卡片数量均不能算成功。上游必须提供可核对收据才算完成；未知结果需先人工核对平台，不能直接重发。

同一浏览器 lease 持有到实际操作与清理完成，取消会终止拥有的 Python 操作并关闭拥有的浏览器，不影响其他应用浏览器。Runtime 崩溃时宿主子进程依据 IPC 断连关闭浏览器；重启把读取/观看标记中断、未完成写任务标记未知，不恢复外发。单插件配置变化仅取消自己的任务。QQ 已在允许范围内直接发送，保留原隐私快照与最终 socket 发送门。

## 调度

默认没有启用的计划。计划包含间隔（1–10080 分钟）、启停和模式，统一支持 B站/抖音。

- `Scheduled`：用户指定的视频计划。
- `Autonomous`：用户授权平台与搜索主题，或抖音推荐流；每轮最多两次实际发现、20 个候选，过滤已观看记录，再由同一个 DSH 根据已确认兴趣和当前状态选择观看或休息。发现与决策阶段最多 90 秒、一次模型决策，观看另有单任务 180 秒上限。任务结果保存候选、调用数、决策原因和后续任务 ID。

全局并发队列上限 32，浏览器操作串行。全局暂停停止新活动并取消在途任务。重启跳过错过的计划，推进到下一个间隔，不集中补跑。停止或改动计划后，未作出的决策不能再发起后续任务。自主计划仍仅包含已支持的读取/观看，不因取消审批扩展社交能力。

## CLI

JSON 从标准输入读取，使用相同 Runtime API：

```sh
node dist/cli/src/main.js douyin status --json
node dist/cli/src/main.js douyin browsers --json
node dist/cli/src/main.js douyin configure --json < config.json
node dist/cli/src/main.js douyin read --json < read.json
node dist/cli/src/main.js douyin watch --json < watch.json
node dist/cli/src/main.js douyin upload /absolute/path/video.mp4 --json
node dist/cli/src/main.js douyin write --json < action.json
node dist/cli/src/main.js activities cancel TASK_ID --json
node dist/cli/src/main.js activities status --json
node dist/cli/src/main.js activities audit --json
node dist/cli/src/main.js activities pause --json
node dist/cli/src/main.js activities resume --json
node dist/cli/src/main.js schedules save --json < schedule.json
node dist/cli/src/main.js schedules run SCHEDULE_ID --json
```

配置示例：`{"revision":"当前版本；首次为空","enabled":true,"headless":false,"accountId":"本人账号ID","executablePath":"","pythonPath":"/absolute/path/.venv/bin/python"}`。

读取：`{"tool":"douyin_search","args":{"keyword":"海洋"}}`；观看：`{"videoId":"实际视频ID","seconds":3,"audio":false}`。CLI 自动补请求 ID，API 调用须提供 `requestId`。读工具白名单为 search/feed/video/comments/check_credential/login_qr/login_poll；不开放独立记忆、SMS 或任意透传。

点赞：`{"tool":"douyin_like","args":{"aweme_id":"实际视频ID"}}`；评论：`{"tool":"douyin_comment","args":{"aweme_id":"实际视频ID","text":"评论正文"}}`。CLI 自动补 `requestId`；API 调用方必须提供唯一请求 ID，重试同一请求时复用该 ID。旧 approvals / propose / decide / revoke 命令明确报退役错误，不转成发送。

自主主题：`{"enabled":true,"mode":"Autonomous","intervalMinutes":60,"choices":[{"platform":"douyin","query":"海洋生物"},{"platform":"bilibili","query":"水族箱"}]}`。抖音推荐范围用 `{"platform":"douyin","feed":true}`；定时固定视频用 `{"platform":"bilibili","videoId":"实际BV号"}`。保存已有计划时传其 `id`；设置 `enabled:false` 停用。

## 来源与验证边界

固定版本与完整来源在 `plugins/douyin/SOURCES.json`、NOTICE、两份 LICENSE 和 `bff.patch`。LockyBee 只裁剪宿主无需的独立应用部分，保留原始采样/证明算法；kdcadmin 实际 Python FastMCP 完成 initialize/initialized/list/call。安装包不依赖研究用 `/tmp` 源码。

既有隔离测试使用专用 Chrome、Python、DSH 和 Runtime，以夹具替代抖音页面、账号和 HTTP 模型端点。真实抖音登录、视频理解及点赞或评论收据仍待账号实测。可按以下命令复现隔离测试。

```sh
BFF_TEST_PYTHON=/absolute/path/venv/bin/python BFF_TEST_FFMPEG=/absolute/path/ffmpeg npx vitest run tests/integration/douyin.test.ts tests/integration/douyin-crash.test.ts
npx vitest run apps/runtime/src/douyin/boundaries.test.ts apps/runtime/src/tasks
```

连接编排 API：`POST /v1/douyin/connect` 接受 `{revision,...可选BrowserConfig}`，使用已保存值补齐未传字段；请求成功表示设置已保存，实际登录结果以 connection 状态为准。`POST /v1/douyin/disconnect` 停用并取消、关闭所属浏览器。状态新增 `connection:{phase,error?,loginState?}`。旧 configure/read/close API 保留；读取状态不触发连接。
