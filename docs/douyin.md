# 抖音、统一活动与调度

## 连接与界面

在「连接 → 抖音」点击「连接抖音」，应用使用已保存设置启用并打开专用浏览器；登录后自动检查状态，无需重复检查登录、验证账号或再次启用。首次账号 ID 从本次受控登录的稳定身份识别；已有绑定必须匹配，不会随扫码换号自动覆盖。需要验证码或手机确认时，在平台页面自行完成。

页面按「记录 / 互动 / 设置」组织，默认显示操作记录。记录展示动作、视频标题或标识、状态、时间和必要失败原因，在卡片内滚动；详细任务结果仍在「我的鱼 → 活动计划」。浏览器、Python 路径与绑定账号在设置页修改，点击「保存并连接」。登录始终使用可见窗口，保存的无窗口运行选项仍供后续运行使用。准备及登录期间可以取消；「断开连接」关闭本产品浏览器并停用，保留登录数据和配置。重新连接才会恢复，不在后台自行重连。

连接检查由 Runtime 持有，页面离开后继续；单次等待最多三分钟，网络调用另有原有超时，失败可重试。取消、配置变化和关闭阻止迟到绑定账号。平台自动登录只建立连接，不授予互动权限；原审批与最终提交检查保持。


桌面「连接 → 抖音」管理连接、操作记录以及需审批的点赞和评论。手动搜索、推荐、详情、评论读取和观看入口已移除，后台与 CLI 能力保持；「我的鱼 → 活动计划」管理队列与计划，顶栏「待审批」或运行状态菜单「审批与记录」核对审批。「我的鱼 → 概览/经历」显示实际活动，运行状态菜单可暂停活动。浏览器仅使用 BigFatFish 的独立 profile，不导入其他浏览器 Cookie，不探测已有调试端口。使用本页连接流程在专用浏览器登录；写操作必须与已绑定的稳定账号 ID 一致。无图形环境不能完成登录，验证码由本人处理。

## 安装辅助依赖

根目录执行 `npm ci`。安装 Chrome、Chromium 或 Edge，浏览器路径留空时发现当前平台常见位置，也可填写绝对路径。安装 Python 3.12，创建隔离环境：

```sh
python3.12 -m venv .venv
.venv/bin/python -m pip install -r services/douyin/requirements.lock.txt
```

Windows 使用 `py -3.12 -m venv .venv` 和 `.venv\Scripts\python.exe -m pip install -r services/douyin/requirements.lock.txt`。在抖音设置填写该 Python 可执行文件的绝对路径。不必另行安装 Playwright 浏览器：辅助服务严格连接 Runtime 已启动的专用浏览器。缺 Python/依赖或浏览器只使抖音对应任务失败，本地聊天和其他平台仍可运行。本机已运行 Python 3.12.16、真实 FastMCP 1.26、Playwright Python 1.58 / Node 1.58.2 与 macOS Chrome；Windows、Linux 图形登录尚未实机验证。

## 观看与模型

一次观看默认采样 3 秒，允许 0.2–10 秒。LockyBee 原始算法核对视频身份、连续播放、解码推进和截图时间，采集三帧；首尾两帧通过同一 DSH 的视觉模型理解，记录准确证据索引，不代表逐帧看完整条。通过 CLI/API 观看时可设置 `audio: true` 采样音轨，通过统一 `asr` 路由调用 OpenAI 兼容的 `/audio/transcriptions`，再将转写与画面一起理解；不会加载上游 Whisper 或隐式下载模型。缺音轨/ASR 时保留部分结果和原因。没有可理解证据不生成观看经历。

字幕、音轨转写与模型结论分开记录。经历进入统一时间线和日记，兴趣仅为候选，需要用户确认。已完成/部分完成视频全历史去重；失败/取消后可用新请求 ID 重试。页面变化、登录限制、验证码不绕过。读取失败和未知提交结果不自动重试。

## 审批与提交

点赞、评论、私信、分享、投稿一律先创建预览，再明确批准。预览绑定工具、稳定账号、配置版本、目标、正文、附件内容摘要和五分钟到期时间；批准人保存为本机主人。投稿必须明确“仅草稿”和“AI 声明”，只接受本机认证入口上传的 MP4 内容（最多 16 MB），不能传给模型任意本机文件路径。

Python 每个最终提交标记重新请求单次授权；Runtime 对实际 HTTP 请求重新核对端点、稳定目标、精确正文与动作参数，提交次数最多一次，再检查账号、审批、版本、附件和取消状态。重定向的每一跳由 Chromium 原生请求门检查；普通读取和登录跳转保留浏览器语义，受限动作不能借跳转扩展批准范围。普通 Dedicated Worker 的读取与请求继续使用所属页面的权限门；Shared Worker 的读取和安全重定向保留，但其受限 HTTP 写请求当前拒绝（固定 Playwright 版本未提供可绑定审批与收据的请求对象）。Service Worker 继续禁用。 当前所有 Worker（含嵌套）的 WS/WSS 在建立目标连接前统一拒绝，普通 HTTP/HTTPS 读取不因此禁用 Worker；页面原有未知 WebSocket 消息门继续保留。专用浏览器启动时设置本机拒绝代理，WS/WSS 无直连后备，loopback 地址也不旁路；HTTP/HTTPS 显式直连，不继承系统代理。因此必须依赖系统代理才能访问的平台在此专用会话中可能不可达；不修改系统或其他应用的代理设置。匹配请求的成功响应才是完成依据，页面按钮翻转或编辑器正文不能证明发送。导航、寻找按钮期间撤销也会阻止未提交动作。当前只识别固定上游点赞 `commit/item/digg` 和评论 `comment/publish` 端点下有界表单请求；只允许明确的字段，未知字段或目标/内容/次数偏离审批均拒绝。评论收据须具备同视频、精确正文、CID 和明确父评论关系；`reply_id` / `reply_to_reply_id` 缺失、矛盾或与审批不符均返回未知，空值与 0 表示顶层。实际平台字段组合仍需登录后授权验证。私信、分享、投稿的网络 schema（含二进制 WebSocket、媒体上传）尚未可靠核实，因此当前阻止提交，设置诊断的 `writeCapabilities` 和界面会明确显示限制。保留上游导航/输入与收据识别代码，不把夹具协议冒充实际平台支持。私信/分享的 DOM 收据必须是同一稳定收件人会话内本人发送、精确正文/视频 ID、新的真实消息 ID、sent 状态，连续两次快照一致；提交前基线包含隐藏的既有稳定 ID，旧节点变为可见也不能算新增；既有消息、pending/failed、整页正文、合成 ID 和卡片数量均不能算成功。上游必须提供可核对收据才算完成；未知结果需先人工核对平台，不能直接重发。

同一浏览器 lease 持有到实际操作与清理完成，取消会终止拥有的 Python 操作并关闭拥有的浏览器，不影响其他应用浏览器。Runtime 崩溃时宿主子进程依据 IPC 断连关闭浏览器；重启把读取/观看标记中断、未完成写任务标记未知，不恢复外发。单插件配置变化只撤销自己的审批。QQ 仍使用同一 ApprovalStore，并保留原隐私快照与最终 socket 发送门。

## 调度

默认没有启用的计划。计划包含间隔（1–10080 分钟）、启停和模式，统一支持 B站/抖音。

- `Scheduled`：用户指定的视频计划。
- `Autonomous`：用户授权平台与搜索主题，或抖音推荐流；每轮最多两次实际发现、20 个候选，过滤已观看记录，再由同一个 DSH 根据已确认兴趣和当前状态选择观看或休息。发现与决策阶段最多 90 秒、一次模型决策，观看另有单任务 180 秒上限。任务结果保存候选、调用数、决策原因和后续任务 ID。

全局并发队列上限 32，浏览器操作串行。全局暂停停止新活动并取消在途任务。重启跳过错过的计划，推进到下一个间隔，不集中补跑。停止或改动计划后，未作出的决策不能再发起后续任务。社交写不会因自主模式免审批。

## CLI

JSON 从标准输入读取，使用相同 Runtime API：

```sh
node dist/cli/src/main.js douyin status --json
node dist/cli/src/main.js douyin browsers --json
node dist/cli/src/main.js douyin configure --json < config.json
node dist/cli/src/main.js douyin read --json < read.json
node dist/cli/src/main.js douyin watch --json < watch.json
node dist/cli/src/main.js douyin upload /absolute/path/video.mp4 --json
node dist/cli/src/main.js douyin propose --json < proposal.json
node dist/cli/src/main.js douyin approvals --json
node dist/cli/src/main.js douyin decide APPROVAL_ID --json < decision.json
node dist/cli/src/main.js douyin revoke APPROVAL_ID --json
node dist/cli/src/main.js activities status --json
node dist/cli/src/main.js activities audit --json
node dist/cli/src/main.js activities pause --json
node dist/cli/src/main.js activities resume --json
node dist/cli/src/main.js schedules save --json < schedule.json
node dist/cli/src/main.js schedules run SCHEDULE_ID --json
```

配置示例：`{"revision":"当前版本；首次为空","enabled":true,"headless":false,"accountId":"本人账号ID","executablePath":"","pythonPath":"/absolute/path/.venv/bin/python"}`。

读取：`{"tool":"douyin_search","args":{"keyword":"海洋"}}`；观看：`{"videoId":"实际视频ID","seconds":3,"audio":false}`。CLI 自动补请求 ID，API 调用须提供 `requestId`。读工具白名单为 search/feed/video/comments/check_credential/login_qr/login_poll；不开放独立记忆、SMS 或任意透传。

点赞预览：`{"tool":"douyin_like","args":{"aweme_id":"实际视频ID"}}`；审批：`{"digest":"预览返回的摘要","decision":"approve"}`，也可 `reject`。私信须给 `nickname`、`peer_id` 和 `text`；分享须给 `aweme_id`、`nickname` 和 `peer_id`。昵称只用于定位，稳定 ID 缺失或当前会话不匹配会拒绝；投稿须给 `attachmentId`、`title`、`tags`、`draft`、`ai_declare`。

自主主题：`{"enabled":true,"mode":"Autonomous","intervalMinutes":60,"choices":[{"platform":"douyin","query":"海洋生物"},{"platform":"bilibili","query":"水族箱"}]}`。抖音推荐范围用 `{"platform":"douyin","feed":true}`；定时固定视频用 `{"platform":"bilibili","videoId":"实际BV号"}`。保存已有计划时传其 `id`；设置 `enabled:false` 停用。

## 来源与验证边界

固定版本与完整来源在 `plugins/douyin/SOURCES.json`、NOTICE、两份 LICENSE 和 `bff.patch`。LockyBee 只裁剪宿主无需的独立应用部分，保留原始采样/证明算法；kdcadmin 实际 Python FastMCP 完成 initialize/initialized/list/call。安装包不依赖研究用 `/tmp` 源码。

测试使用真实上游、专用 Chrome、Python、DSH 和 Runtime，替换的是平台页面、账号与 HTTP 模型端点；不等同真实抖音、B站、QQ账号或云模型效果。未获得真实登录或社交写授权，不在真实平台执行。复现：

```sh
BFF_TEST_PYTHON=/absolute/path/venv/bin/python BFF_TEST_FFMPEG=/absolute/path/ffmpeg npx vitest run tests/integration/douyin.test.ts tests/integration/douyin-crash.test.ts
npx vitest run apps/runtime/src/douyin/boundaries.test.ts apps/runtime/src/tasks
```

连接编排 API：`POST /v1/douyin/connect` 接受 `{revision,...可选BrowserConfig}`，使用已保存值补齐未传字段；请求成功表示设置已保存，实际登录结果以 connection 状态为准。`POST /v1/douyin/disconnect` 停用并取消、关闭所属浏览器。状态新增 `connection:{phase,error?,loginState?}`。旧 configure/read/close API 保留；读取状态不触发连接。
