# Acceptance

最新结果：accept_p5_worker_ws **PASS（本地代码返工范围）**。没有待返工的本地缺陷；协议未实现与真实平台/其他系统缺项保留，不表示整个P5完成。历史报告保留供追踪。

## Final Independent Code Acceptance — accept_p5_worker_ws

### Result / Spec Coverage

PASS。拒绝策略在Chrome启动前安装，不依赖未覆盖Worker的PW WS路由；websocket-policy只拒绝、不连上游/不存内容，代理列表只有拒绝器、无DIRECT后备，<-loopback>移除旁路，符合Chromium官方说明。browser-host先装策略再启动并退出清理，IPC仅拒绝状态。Manager启动握手忽略其他通知，close识别signal退出host避免永久等待。HTTP/HTTPS/Worker生命周期/原审批与重定向门保持，专用Chrome不继承系统代理的取舍已公开。

### Validation

Risk Level：S3。独立读取规则/Spec/Plan/历次报告/Decision007/相关代码/测试/使用文档并核对实际日志。没有发现需复现的具体疑点，未重跑测试、build或typecheck。

8Worker×WS/WSS目标TCP/握手/消息0，HTTP读16次、页面活；原复现Page/Dedicated/Shared均denied=true/submitted=false、upgrades/messages空。拒绝器独立关闭后浏览器活、目标TCP0、无直连回退；取消清理和已退出host清理有证据。/tmp/bff-ws-tests.log、bff-ws-regression.log、bff-ws-exit.log分别2/6/1通过，已核对Node build日志，type/lint及末次变动顺序复用报告。HTTPS官方镜像200/TLS1.3/拒绝计数0，googlesource超时未假报成功。

### Issues / Required Rework / Risks

无本轮阻塞项，无业务返工。全局旧状态由root更新。Worker WS/WSS均拒绝，依赖它们的平台功能可能不可用；专用ChromeHTTP/HTTPS直连，依赖系统代理可能失败；私信/分享/上传发布wire仍未完成而拒绝。真实账号/社交写/云/Windows/Linux图形未验证。本结论不是全产品阶段完成。

验收只读，无仓库/Git/index修改或新运行资源；当次dev HEAD7ceb617、P5未提交/index空。完整报告已由root读取处理，按既有授权本地提交可验收代码并继续P6。

协调提交审阅：显式暂存75个P5相关文件，未包含Decision008或Spec008/009。完整cached空白检查仅两份bff.patch的33个单空格上下文行告警（实际行均为一个空格，属统一diff语法）；保留可复现补丁。排除这两份补丁后其余全部暂存内容空白检查通过，不虚报完整检查零告警，不改业务或追加测试。

## Fourth Independent Acceptance — accept_p5_worker

### Result / Coverage

FAIL。普通Worker误关页面已修，HTTP读取/重定向/受限请求与已有证据一致；未知WebSocket在恢复Worker后可绕过既有门。iframe专用附着、Shared HTTP根守卫、归属复核/关闭和原页面/OOPIF/单次审批/取消证据有效。原评论/隐藏ID/ASR无新反证，但Spec未经批准不外发未满足。

### Validation / Issue

Risk Level：S3。只读审阅规则、交接、Spec/Plan/历次报告、Decision与代码/测试/docs；复用HTTP矩阵/build/type/lint，不重复。仅追加一次生产BrowserManager+真实Chrome+loopback WS接收器，脚本/tmp/bff-accept-worker-ws.mjs；无真实账号/其他凭据/社交写，自有Chrome/HTTP/WS/数据清理。

**P1：Dedicated和Shared Worker未知WebSocket绕过。** browser.ts:27的context.routeWebSocket在固定PW下不覆盖这两个Worker，redirects.ts:39的HTTP Fetch门不能阻止WS消息。read模式、无WriteGate：Page消息0/socket closed/denied=true/submitted=false；Dedicated与Shared各实际发送1条UNAPPROVED-WORKER-PAYLOAD并收到receiver-ack，denied=false/submitted=false，主页面保持打开。这是真实网络外发，不是状态误报。

### Risks / Required Rework

新实施者修复同一未知WS拒绝边界，覆盖Dedicated/Shared及直接嵌套路径，正常读取/生命周期保持。以本地接收器证明未授权消息0，保留Page既有拒绝，再新独立验收。不把HTTP证据当所有协议。DM/分享/上传wire及真实平台/云/Windows/Linux图形缺口不变，不用于解释本地缺陷。dev/P5未提交，验收无仓库/Git/index修改。

## Third Independent Acceptance — accept_p5_second_rework

### Result / Spec Coverage

FAIL。原重定向绕过、评论父目标、隐藏旧消息三项修复与已有证据一致，没有发现残留；新增RedirectGuard对普通Worker错误关闭主页面，未保持正常读取能力。

### Validation

Risk Level：S3。只读审阅规则、交接、Spec/Plan/Acceptance/Rework、Decision003–007与相关源码/测试/使用文档；复用既有TS/Python、真实Chrome/Runtime与构建/类型/lint/patch证据，不重复运行。仅对Worker疑点用生产BrowserManager+真实Chrome+loopback页面复现，等待异步关闭并采集CDP错误定位。无真实账号/凭据/社交写，无仓库/Git/index修改；自有浏览器/HTTP服务/数据清理，保留/tmp/bff-accept-worker.mjs。

### Issues

**P1：Worker不支持Fetch，却按页面target注册导致主页面关闭。** redirects.ts:49/68的Target.setAutoAttach未限制类型，attachedToTarget一律register→Fetch.enable，Worker返回-32601、'Fetch.enable' wasn't found，catch执行denied及page.close。最小页面仅new Worker('/worker.js')，脚本只postMessage，无写请求；实际outcome=normal-read-worker-ready、pageClosed=true、denied=true，received=[/,/worker.js]，targetType=worker。属于本地直接回归，不是平台账号门槛。

### Regression Risks / Required Rework

新实施者区分target能力与网络归属，正常Worker不能关闭主页面，受限Worker请求仍不能绕过权限；不能简单吞异常后放开网络。保留页面/递归OOPIF重定向、单次授权/撤销/取消。仅补此直接回归和必要检查，再新独立验收。原三项证据保留；DM/分享/上传发布wire部分实现与真实账号/云/Windows/Linux图形缺口不变。

## Second Independent Acceptance — accept_p5_rework

### Result / Spec Coverage

FAIL。实际端点/目标/正文与并发单次消费已实现，但重定向后请求未受保护。稳定peer_id及授权等待后会话检查已修，未发现缺ID退回昵称仍存在。body文本后备已去掉，但父目标字段遗漏和隐藏旧消息产生假收据。ASR字节累计与测试相符。QQ作用域/最终隐私门、lease/取消未发现本轮具体回退。

私信/分享/投稿协议未实现且拒绝提交，API/界面/使用说明准确显示，属于产品未完成项，不能记完整支持。

### Validation

Risk Level：S3。审阅规则、交接、Spec/Plan两轮报告、首次FAIL/Rework、Decision003–007、相关代码/diff/测试；复用已过type/lint/build/矩阵/原生证据。仅追加3个具体疑点隔离复现。未用真实账号/凭据/社交写，不改仓库/Git/index；临时Runtime/Chrome/Python及数据清理，脚本保留。

### Issues

1. **P1：307重定向绕过外发门。** browser.ts:26/33只通过context.route校验初始请求，route.fallback允许浏览器自动跟随，固定Playwright类型文档注明只路由首个URL。`/tmp/bff-accept-redirect.mjs`实际BrowserManager+Chrome中，批准like(1234567890123456789)，夹具307到本地其他来源/UNAPPROVED-ACTION；接收器实际1次POST，正文aweme_id=1234567890123456789&type=1，check仅arm+初始authorize共2次，submitted=true/denied=false。实证跨来源/端点；同域改操作未另测。只改unknown不能撤销已发生外发。
2. **P1：评论父目标别名遗漏。** write-gate.ts:49只检查reply_id，不检查Python mcp_server.py:2227已有的reply_to_reply_id；service.ts:39用gate.receipt覆盖Python较严判断。`/tmp/bff-accept-receipt.mjs`真实Runtime/Chrome/Python：顶层评论reply_cid空，实际1次正确提交，响应同视频/正文/CID但reply_to_reply_id=UNAPPROVED-PARENT，最终completed/verified=true。
3. **P2：隐藏旧消息误判新增。** mcp_server.py:3898提交前快照过滤隐藏节点，:3990用可见ID减基线。`/tmp/bff-accept-old-message.py`真实Python/Chrome预置本人/正确会话/正文/sent的already-existing-id，初始display:none；Enter只preventDefault并显示旧节点，无发送，仍verified=true。分享共用同逻辑受影响。仅证明Python DOM假成功；Runtime拒绝私信协议，未据此发生实际私信外发。

### Regression Risks / Required Rework

新实施者处理所有实际外发前的重定向边界，含读/登录跳转受限操作；保留单次消费、异步撤销/账号、取消/lease、unknown不重试。统一评论父目标语义/别名，矛盾/缺失/无法确认不得completed。收据基线与可见展示分离，隐藏既有ID排除，无新增证据返回unknown。仅补这些复现和直接回归，再新独立验收。真实页面字段兼容、DM/分享/投稿协议及账号/云/Windows/Linux图形证据继续单列。

---

## First Independent Acceptance — accept_p5

## Result

FAIL。新的独立accept_p5确认4项实现问题，不能视为真实账号验证门槛。

## Spec Coverage

双上游真实接入、固定来源/许可/补丁、专用浏览器、MCP白名单、统一模型/记忆、持久任务和自主发现有实现及已有运行证据。共用ApprovalStore按插件隔离、QQ最终隐私门未发现本次明确回退。但实际审批动作绑定、收件人验证、准确收据和中文转写存在下述缺陷。

## Validation

- Risk Level: S3
- Evidence Reviewed / Checks Performed: 独立读取Spec/Plan完整实施报告、Decision、源码/diff、相关测试/文档；复用12文件22项既有测试和构建，不机械重跑。
- 仅对具体疑点运行隔离真实Runtime/Chrome/Python及ASR复现。首次实验因Node --input-type被fork继承而未启动，修正实验调用后复现成立。
- 未修改仓库文件、Git/index或分支；临时进程/数据已清理，所有外发仅由隔离夹具接收。

## Issues

1. **[P1] 实际网络请求没有绑定审批动作，且没有单次消费。** apps/runtime/src/douyin/browser.ts:25、32及service.ts:38。HTTP/WS门仅调用无参数gate，重查原审批但不核对请求URL/body/message的工具、目标、正文或次数；Python granted仅限制_submitted。真实Runtime/专用Chrome/Python中批准给1234567890123456789点赞，页面实际给9999999999999999999点赞并额外发表UNAPPROVED评论，两条POST均通过网络门，任务completed。
2. **[P1] 私信稳定ID缺失时仍按昵称放行。** services/douyin/mcp_server.py:3880、3897的if(peer && pid && peer !== pid)只拒绝已知不匹配。真实DOM唯一“相同昵称”行没有稳定ID，_open_conversation(...peer_id="EXPECTED-STABLE-ID")仍返回编辑器。分享路径只接收昵称，同根因边界需一起处理。
3. **[P1] 编辑器中未发出的文字被当作成功收据。** services/douyin/mcp_server.py:4215及Runtime service.ts:38。_send_chat_part以整页正文为成功后备，整页包含编辑器；真实contenteditable拦截Enter、完全无发送，仍返回ok:true/verified:true/messageId:"body-text"/evidence:"body-text-appears"。评论整页文本后备、分享卡片/数量后备同样需按获批动作关联收据审查，不能把无关DOM变化当完成。
4. **[P2] ASR逐chunk独立UTF-8解码损坏中文。** apps/runtime/src/ai/media.ts:7。实际transcribe接收JSON“海洋生物”，在“海”的首字节后分块，返回“���洋生物”；JSON仍解析成功。需有界累计字节后统一解码或增量解码。

## Regression Risks

保留撤销/取消/账号/附件/未知不重试与QQ隐私边界。真实平台账号/写操作、云模型、Windows/Linux图形登录仍未验证。验收发生时Mac锁屏，原生操作缺口存在；用户随后明确已解锁，可在返工后重新进行本阶段原生验证。用户明确暂无Windows环境，先继续其他工作。

## Required Rework

由新的实施Agent修复实际请求绑定/单次提交、稳定收件人身份、可靠收据及UTF-8；对每类开放写能力提供匹配正向收据与错目标/错内容/重复请求/缺身份/未提交负例，再由新的独立验收Agent复验。不能删除产品要求的互动能力或放宽断言掩盖问题。
