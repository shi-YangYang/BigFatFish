# Plan 007: P5 抖音

最新结果：完整实施及四轮具体返工报告已读取，最终新独立accept_p5_worker_ws本地代码验收PASS，无待返工缺陷。各次检查范围与真实账号/未实现协议缺口按下文保留，不将局部代码通过称为整个P5完成。

提交审阅：75个明确P5文件已暂存，未来Decision008/Spec008/009排除。cached检查的33处告警仅两份上游bff.patch必要的单空格上下文；其余暂存内容空白检查通过，补丁原样保留。未追加已通过测试。

## 实施顺序

1. 前序阶段验收后核实插件/任务/审批/记忆接口，复查固定上游实际浏览器接入方式。
2. Browser Manager、独立profile、共享使用权与取消/异常恢复；用真实本机浏览器和受控页面验证互斥。
3. 两上游固定安装、必要路径/平台适配与真实调用，显式工具白名单及协议结果校验。
4. 观看采样/视频去重、统一视觉/ASR和记忆活动；按证据区分完整、部分和失败。
5. 不可变审批与执行前校验、写结果/未知状态审计、统一调度与全局暂停。
6. Desktop/CLI、文档、真实浏览器/MCP/Runtime测试；有授权才做平台账号实测，随后独立验收。

## 数据与安全

用户授权任务 → 权限/审批 → 统一队列 → 取得账号浏览器使用权 → 上游实际能力 → 收据/结果校验 → 统一经历与记忆。上游不能直接开放全部权限或独立写记忆；输入内容不是权限来源，执行参数不得偏离审批记录。

浏览器lease持续到实际上游操作结束；AbortSignal或HTTP超时不代表Python/浏览器操作已经停止，不能提早释放队列让后续动作重叠。取消、插件停用、全局暂停、Runtime退出必须停住拥有的执行资源并处理迟到结果。不能为了清理杀其他用户浏览器。

审批绑定稳定账号/配置revision、实际工具、目标、正文/附件内容摘要；最终执行点仍需核对有效性，不能只在排队或发MCP请求前检查。尤其导航/登录检查/找元素的异步等待期间可能撤销或换账号：在真正点击/提交前拒绝失效动作。有必要时对固定上游添加明确、可复核的执行前guard/收据补丁；Runtime持有的单次授权不能变成通用浏览器写权限。测试应直接观察平台提交边界零调用，而非仅检查审批状态。

发布素材只接受用户明确提供的受控文件内容/摘要，禁止模型任意本机路径；审批后内容变化失效。账号/profile/debug连接只留受限数据目录，UI只显示必要状态。固定端口探测、外部浏览器Cookie导入、旧全局密钥读取不作为自动后备。真实写动作仅用隔离页面/协议夹具，未获具体授权不得在平台发送。

## 上游依据

docs/upstreams.md记录固定commit、真实Python入口和MCP工具。LockyBee发布包os为win32，kdcadmin未发布对应npm包且默认浏览器路径偏Windows；必须实证适配，不能从语言可运行推断平台可用。两上游插件默认配置不等于本产品安全配置。

### 已读取的具体接入边界（2026-11-03，规划证据）

- 固定研究源码位于/tmp/bff-upstream-lockybee（7989640e340f0fd79e2de9874880d5197546e755）与/tmp/bff-upstream-kdcadmin（aaf9f9a862afafd45a15acf32789da97688de695）；发布产物必须保存实际依赖闭包、原许可/NOTICE/来源与可复核补丁，不运行依赖/tmp。
- LockyBee/core.mjs导出BrowserController、readPageState、verifySharedVideoFrameProof。构造函数可传memory/personaMemory/videoLimits/controlDirectory，但默认store()/getPersonaMemory()会自行创建记忆；导入时runtime-paths也会读取旧位置记录。必须显式数据路径和关闭独立记忆/人格副作用，不能仅传一个profile就认为隔离完成。capture/captureSharedFrames保留实际帧/视频ID/时间证据；execute中的读工具和实际采样可复用，独立autonomous/chat/发送服务不能加载。
- LockyBee/playwright-runtime.mjs优先使用playwright-core，后备探测其MCP依赖；本项目只保留根管理的明确依赖，不安装整套独立产品或恢复workspaces。browser-host原来只探测Edge/PowerShell，宿主Browser Manager负责跨平台发现与启动；必要接入改动记录补丁。
- kdcadmin/vendor/douyin-mcp/mcp_server.py的BrowserManager支持DOUYIN_CDP_URL与DOUYIN_CDP_STRICT=1；未严格配置会探测固定9333并退回自有profile。只能接入当前Runtime确实拥有的专用浏览器，禁止连接任意已存在端口或静默退回用户会话。DSH_DOUYIN_HOME可以显式隔离其数据；不改系统HOME/USERPROFILE。
- Python restricted_tool在DOUYIN_MCP_TOOLS为空时暴露所有工具，包括memory_*；WRITE_TOOL_NAMES受DOUYIN_ALLOW_WRITES约束，但这只是注册开关。必须显式白名单和单次审批执行门。DOUYIN_PROXY_URL/TOKEN代理本身只核查回环/action；若采用它，需绑定请求/审批/浏览器lease，不因持有token就获得全部写权限。
- 实际读工具含search/feed/video/comments/check_credential/login_qr/login_poll，写工具含like/comment/chat_send/share_video/publish。上游发布支持draft与ai_declare等字段，审批必须展示实际语义和文件内容摘要，不能用可变路径或默认参数在批准后替换内容。写结果要根据真实收据检查，未知不重试。
- 上游watch实现还调用video-understanding-lab/Whisper；本项目统一视觉/ASR模型路由，避免其默认下载/自有密钥/记忆成为隐式依赖。Python依赖与浏览器安装提供可执行、隔离、明确的设置方式；缺少依赖不阻塞其他Runtime模块。

### 前序衔接

P4已由新独立验收PASS并本地提交7ceb617，以该commit为基线。统一AgentEngine已接受有界图像；ChatService提供视频理解入口，视频任务/经历已有可复用模式，但目前BV专用表不能假称通用任务系统。P3 Channels仍是QQ专用配置/审批/发送服务；提取真正共用的审批/任务边界时保留QQ受众和最后同步guard、配置revision/密钥策略。停用某插件只撤销自己的任务/审批；全局暂停另有明确语义。

P5调度统一复用B站观看与抖音观看；显式启用后依据已确认兴趣/状态经同一Agent选择允许的只读活动，保留决策/执行/结果，设置时间/调用预算。社交写操作不会因自主模式免审批。

实现中的具体覆盖提醒：未启动任务的取消应及时终态，不因全局tail排在另一平台长任务后而令本插件停用等待无关操作；实际已开始操作仍必须drain后释放lease。自主浏览从授权平台/主题的真实搜索/推荐流发现有界候选，不能仅让Agent从已去重的固定ID清单反复挑选。上述边界由实施者纳入当前相关验证，root不重复运行测试。

## 验证与风险

S3：浏览器账号、外部进程、社交写操作与持久调度。检验并发使用权、所有执行入口的审批约束、撤销/停止、重启和未知结果；模型、协议与受控页面测试分别标注。真实平台账号与写操作只有明确授权才运行，缺项继续记录，不将成功点击或零退出等同实际完成。

## Implementation Report

implement_p5已完成，完整报告已由root读取。基线dev 7ceb617，待新独立验收，未暂存/提交P5；未来Spec008/009不纳入。

### 实现

- Runtime douyin/browser/mcp/input/routes，tasks持久队列/调度，permissions/ApprovalStore，ai/media统一视频证据与ASR；Desktop Douyin/Tasks/Home/Life、CLI activities、构建复制资源和docs/douyin.md。
- 固定LockyBee 7989640e340f0fd79e2de9874880d5197546e755与kdcadmin aaf9f9a862afafd45a15acf32789da97688de695，保留LICENSE/NOTICE/SOURCES/可应用patch。LockyBee原始观察/身份时间proof/三帧/音轨算法切片，移除独立记忆/人格/启动/大脑；Python实际FastMCP和平台实现，移除浏览器回退，加逐提交guard。根npm管理playwright-core，Python有固定清单/完整锁定版本。
- 专用profile/CDP/唯一browser lease，正常取消与父Runtime崩溃清理；schema6活动任务/调度/请求映射及审批plugin/approved_by。QQ共用ApprovalStore但作用域隔离，保留最终隐私snapshot/socket guard。
- 读工具、观看与统一ASR/DSH/候选兴趣/活动/日记；ASR使用统一配置的OpenAI兼容转写接口，不加载另一套Whisper或密钥。
- 审批绑定账号/revision/参数/附件摘要/有效期；Python每个提交标记仅一次授权，真实HTTP/WS外发门复核账号/撤销，未知不自动重发。
- 未开始任务立即取消，只drain实际运行资源；全历史SQL视频去重+请求别名先检查参数冲突。自主活动按授权主题搜索/推荐、最多2次调用/20候选/1次DSH选择或休息，发现决策90秒、单任务180秒；固定视频定时选项保留，B站同样全历史过滤已看。

### Validation

Risk Level：S3。累计12定向文件22项不同测试通过，非一次全量重跑：

- 真实Chromium→LockyBee三帧/音轨→统一ASR/DSH图像→兴趣候选/时间线/日记；真实Python FastMCP initialize/initialized/list/call。
- 点赞正向、导航期间撤销、Python guard放行后页面延迟网络提交再撤销，外发次数零增量；账号变化、审批篡改/过期、附件变化、未知不重试。
- lease互斥/取消/缺Python隔离、未启动取消不等待无关前置平台；实际SIGKILL Runtime后专用浏览器退出、重启interrupted且不重放。
- 超过100历史后的去重/请求别名/冲突；真实B站CLI搜索→DSH选择→观看、过滤已看后休息；停用排队计划不再发现或调用模型。
- QQ隐私/审批与基础schema直接回归。抽取时发现已结束审批错误码顺序改变，恢复APPROVAL_NOT_PENDING契约，仅重跑失败用例通过。
- 无界面React经测试IPC调用真实Runtime完成配置/观看/主页在途/批准点赞/暂停，截图/tmp/bff-p5-react.png。此证据不等于原生窗口操作。
- 最终type/lint/Node构建及macOS Tauri release编译通过；两份固定源码patch dry-run通过；自有tracked与29个新增文件空白检查无问题。最后B站全历史过滤调整后Node构建再次通过。

### 外部边界与清理

CUA报告Mac锁定且自动解锁失败，P5原生窗口操作未验证；root已异步请用户解锁，尚未回答。真实抖音/B站/QQ账号/写动作、云效果、Windows/Linux图形登录未验证。正向社交写夹具覆盖点赞，评论/私信/分享/发布外部收据仍需授权账号；WebSocket门保守，页面/协议变化可能导致不可用。

测试Runtime/Chrome/Python/原生夹具及测试用户数据已清理。保留/tmp/bff-p5-python/bin/python、/tmp/bff-whale-p4/bin/ffmpeg和/tmp/bff-p5-ui.mjs供必要复现；后者解锁后重启隔离Runtime/原生桌面并生成新临时数据，不是产品运行依赖。无新增产品决策问题，交新独立验收。

## First Independent Acceptance / Rework

accept_p5完整FAIL报告已读取，4项已复现：实际网络动作不绑定且可多次外发；指定私信ID但缺身份仍按昵称放行；编辑器文字被当私信成功收据；ASR分块解码损坏汉字。不是外部账号门槛，见Acceptance/Rework，由新的实施Agent返工，再新独立复验。尚不提交P5。用户已确认Mac解锁，可补真实原生操作；暂无Windows环境，继续其他开发/验证。

## Rework Implementation Report

rework_p5完整报告已读取，等待新的独立验收，尚未提交。私信/分享/投稿仍部分实现：真实网络协议未可靠核实，当前阻止提交，不能标完整支持。

### 修复与职责

- 新增Runtime douyin/write-gate.ts，匹配实际端点、稳定目标、精确正文和动作参数；异步权限检查后原子消费一次提交。拒绝重复字段、查询覆盖、未知编码/端点、额外动作和重复请求。成功只依据同一获准Request对应的响应，不接受Python自报verified。Browser不再把旧审批当通用HTTP/WS通行证，非登录未知POST拒绝，不可识别WS关闭。
- Python保留真实上游导航/操作流程；私信/分享稳定peer_id同时约束行和当前会话，私信授权等待后再次核对。删除整页正文、卡片/出站数量后备；收据须本人、正确会话、精确正文/视频、新真实ID、sent与两次一致快照。评论核对实际请求/响应；投稿缺媒体关联时只返回未验证候选。
- ASR按字节限制累计后统一UTF-8解码。分享API/桌面补peer_id；writeCapabilities及界面/文档准确显示三项不可执行能力。更新NOTICE/SOURCES/Python patch；未加入新上游或依赖。

### 验证

Risk Level：S3。未机械重复已通过且未变化的观看/记忆/QQ/B站矩阵。

- Runtime+实际Chrome+Python MCP：11隔离场景，点赞/评论匹配各1次外发，错目标/正文0次；重复/额外仅原批准1次且不completed，未提交/错误响应不completed。
- Python+实际Chrome DOM：16不同场景，私信/分享严格收据正向；未提交、错正文/视频/会话/发送人、pending、旧ID、合成/缺ID、缺稳定对象、授权等待换会话负例。此层不等于Runtime外发成功。
- ASR/请求门窄检查：中文第1/2字节边界、正常/超预算；未知协议、重复字段、查询覆盖、异步撤销、并发单次消费。累计3个TS文件4项测试通过。
- 最后相关修改后typecheck、lint、Node build通过；macOS Tauri release及.app打包通过，Python patch dry-run及自有空白检查通过。
- 原生Mac CUA实际操作隔离.app：账号已验证、生成/批准绑定账号与视频的点赞并completed、暂停/恢复、观看完成/主页经历、创建60分钟计划并停用。CLI同目录确认read/write/watch均completed。平台页面/模型仍是隔离夹具，不是平台账号成功。
- 首轮评论矩阵因夹具HTML缺UTF-8声明产生乱码，权限门正确拒绝；修正夹具后通过。原生旧夹具标题同样补charset，不混称ASR或真实平台问题。
- 末次顺序：请求门编码收紧及窄测试/type/lint/build → Python最终身份复核 → 该竞态定向通过 → 重生成并dry-run Python patch/复制运行资源。没有之后未覆盖的业务修改。

### 限制与清理

bounded-http只代表固定上游点赞commit/item/digg、评论comment/publish的明确有界表单契约；真实页面完整字段/查询参数兼容仍需账号证据。DM/分享/上传发布wire schema未实现，不能用夹具JSON或DOM收据声称真实平台支持。真实账号/外发/云模型/Windows/Linux图形登录仍未验证。

测试Runtime/Python/Chrome/原生进程与临时数据已清理，复现代码保留tests/integration/douyin-write.test.ts、tests/fixtures/douyin-receipts.py等，日志/tmp/bff-rework-*。dev/index为空，无Git操作；未来Spec008/009仍Draft，不能夹入P5。

## Second Rework Implementation Report

rework_p5_second完整报告已读取，3项修复完成，待新独立验收，无Git/index操作。

### 修复

- browser.ts新增redirects.ts配合Chromium CDP Fetch请求阶段检查后续跳转；Playwright/WriteGate只授权初始操作与收据，不重复消费授权。每Page首请求释放前安装一次独立CDP会话，递归跨进程iframe；安装失败关闭页面。保留浏览器原生跳转、URL/Cookie/方法转换，未采用meta-refresh或新测试transport。修正重复attach/detach暂停target造成等待的初始方案。
- Runtime write-gate与Python同时核对reply_id/reply_to_reply_id，至少一个明确字段，出现字段全部一致且匹配批准；空值/字符串0/数字0为顶层。视频/正文/CID/父关系缺失或冲突不verified。
- Python私信/分享使用独立_known_message_ids基线，包含隐藏节点的data-message-id/data-msg-id；展示可见性不再决定既有集合，旧节点显现不能当新增。
- 更新相应3个TS测试文件、Python receipts夹具、Python patch、NOTICE/SOURCES与使用文档；service.ts无残留行为变化。

### Validation

Risk Level：S3。本轮累计3个TS文件8项测试通过、Python8组通过，未重复未变化ASR/QQ/B站/原生Mac矩阵。

- 原307脚本实际observed=[]、checks=2、submitted=true、denied=true。
- 真实生产route.fallback→本地接收器，无注入transport：302→307读取保留最终URL/Cookie；已有页/新页/popup/跨进程iframe跳digg均0请求，iframe用Target.getTargetInfo实测type=iframe。
- 登录POST→302最终GET/空正文/无原平台Cookie；登录POST→307跨来源后续0请求。正常批准POST1次且verified；等待授权撤销0次。取消held307关闭拥有浏览器，后续0请求。
- 真实Runtime+Chrome+Python重定向写任务unknown，初始1/额外0；14场景评论/点赞矩阵通过，错父别名/冲突/缺字段unknown，正常评论completed。
- 真实Python+Chrome本轮8组：两种隐藏旧私信ID和隐藏旧分享非verified/unknown，新真实ID正向仍verified；父别名、授权时换会话和缺稳定ID拒绝。
- npm run build:node、npm run typecheck、改动TS定向ESLint、patch --dry-run -p1 -d /tmp/bff-upstream-kdcadmin < services/douyin/bff.patch、自有diff检查及运行资源复制通过。测试命令为vitest的douyin-redirect.test.ts、write-gate.test.ts、douyin-write.test.ts；部分新增/受影响场景用-t定向执行，Python使用BFF_RECEIPT_SECOND_ONLY=1执行douyin-receipts.py。
- 首次网络测试因阻断后迟到错误导航干扰下次goto失败，改用独立新页后通过，未改变产品逻辑掩盖。最后顺序：业务修复→Node build→缺陷回归→NOTICE/docs/patch→patch dry-run/typecheck→追加实际iframe target/登录POST/撤销证据→定向lint/资源复制/diff；之后无业务修改。

### 限制与清理

私信/分享/上传发布wire仍未实现并拒绝，真实账号/外发/云/Windows/Linux图形未验证；DOM正向不等于平台发送。Runtime/Python/Chrome/接收器与临时数据已清理，CDP临时探针删除，独立验收复现脚本保留。没有待用户决策的实现问题，交新的独立Acceptance。

## Third Rework Implementation Report

rework_p5_worker完整报告已读取，待新独立验收。只改browser.ts、redirects.ts、douyin-redirect.test.ts与docs/douyin.md，无Git/index/治理修改。

根因：不支持Fetch的Dedicated Worker被按页面注册，-32601后关闭页面。固定PW1.58.2/Chrome156.0.8078.76实测Dedicated及嵌套Dedicated网络经过父页Fetch/PW route，request.frame有效；SharedWorker脚本经页面，运行fetch不经过页面，浏览器根Fetch可捕获且frameId为Shared targetId。探针/tmp/bff-worker-probe.mjs与/tmp/bff-worker-capability.mjs保留。

修复：页面递归autoAttach仅iframe，Dedicated沿原权限门。专用浏览器根Fetch在初始化返回前安装；发现Shared target，暂停受限请求后再用Target.getTargets确认归属，不只靠事件顺序；ID保留到关闭防止已终止Worker暂停请求失去归属。Shared正常HTTP读取/安全跳转保留，没有PW Request/Response可绑定审批收据，因此read/write/login模式的受限HTTP都拒绝，不新增授权传输；根守卫异常关闭拥有浏览器。ServiceWorker仍禁用，WriteGate/评论/Python/lease业务未变。

Risk Level：S3。本轮累计4项直接测试通过：三种Worker每类直接读和302→307读成功（/read-final共6），URL/Cookie保留、页面不关/不误denied；每类直接digg、POST、读跳digg受限目标0，Shared write/login及初始化立即fetch也0；ServiceWorker无脚本/target。取消Shared held307后browser关闭/endpoint空/后续0。Dedicated批准1次verified/check2，重复拒绝，异步撤销新增0；直接受iframe过滤影响的原生页面/popup/OOPIF测试通过。

命令：vitest douyin-redirect.test.ts按workers preserve/shared worker redirect/native redirect guard/dedicated worker writes定向运行；build:node、改动3TS定向eslint、tsconfig.json --noEmit及改动空白审阅通过。最初夹具将禁止ServiceWorker的undefined当承诺、清理重复writeHead导致失败，修断言/幂等release后通过；Dedicated用例过早terminate Worker导致无法读响应体，延后到浏览器清理后通过，没有改产品收据掩盖。最后顺序：业务→Worker矩阵/夹具修正→页面/OOPIF/Dedicated测试→Node build→Dedicated测试生命周期修正并通过→lint/type→仅注释/docs HTTP措辞，无后续业务变化。

限制：本轮Shared守卫证据为HTTP fetch/redirect，Shared受限HTTP不支持；未扩大其他协议。DM/分享/发布wire与账号/云/Windows/Linux图形限制不变。所有测试浏览器/接收器/临时数据finally清理，复现脚本保留；无剩余实施决策问题。

## Fourth Rework Implementation Report

rework_p5_worker_ws完整报告已读取，等待新独立验收，无Git/index/治理修改。

### 修复与取舍

固定PW的Worker WS不走routeWebSocket；实际探针确认Fetch、Network.setBlockedURLs和URL网络仿真均不能阻断，命令成功不算保护。新增plugins/douyin/websocket-policy.mjs及.d.mts，在browser-host启动Chrome前建立本机拒绝器，Chrome手动代理规则将WS/WSS指向唯一拒绝器，无DIRECT后备且减去loopback隐式旁路。拒绝器从不连上游、不记录请求内容；host退出清理、IPC只通知拒绝状态。browser.ts启动握手忽略其他通知，close只等待仍未退出的host，修正signalCode非空而exitCode仍null时永久等待exit的问题。

仅专用Chrome的HTTP/HTTPS设direct://，不继承系统代理；系统/其他应用不改。依赖系统代理的平台可能不可达，使用文档如实说明。官方依据为[Chrome代理说明](https://chromium.googlesource.com/chromium/src/+/HEAD/net/docs/proxy.md)的other代理选择与后备规则。未改HTTP RedirectGuard/WriteGate/Python/评论/ASR/其他平台。

### Validation

Risk Level：S3，本轮累计9项直接测试通过（3项WS/生命周期及既有HTTP直接回归6项）。8种真实Worker（Dedicated/嵌套/Shared/两种Module/两种初始化立即执行/Blob）各WS/WSS，共16次尝试，目标TCP/握手/消息均0，HTTP读16次、页面存活、拒绝状态准确，write/login不放行。Page门保留。原/tmp/bff-accept-worker-ws.mjs三类来源均denied=true/submitted=false、upgrades=[]/messages=[]，页面不关闭。

生产策略模块+真实Chrome中拒绝器收到1次CONNECT；独立关闭监听器后WS/WSS仍失败、目标TCP0，无直连回退。取消/监听清理/重启和已signal退出host清理通过。原douyin-redirect.test.ts的6项普通HTTP/redirect、page/popup/OOPIF、批准/撤销/取消通过。

生产BrowserManager实际读https://raw.githubusercontent.com/chromium/chromium/main/net/docs/proxy.md：200/TLS1.3/正文匹配、拒绝通知0，未忽略证书。原googlesource直连超时，未记成功，也未继续扩站。

命令：build:node；vitest douyin-websocket.test.ts及追加的already exited host定向；vitest douyin-redirect.test.ts；tsconfig.json --noEmit；browser.ts/browser-host.mjs/websocket-policy.mjs/新测试定向eslint；原独立复现；自有空白审阅。最后顺序为业务策略/生命周期→WS矩阵/生产策略失效→Node build→6HTTP回归/原复现/type/lint→官方HTTPS→追加异常退出测试定向通过/测试type/lint/清理，无后续业务修改。

初次Shared→Dedicated夹具因SharedWorker没有Worker构造器而不成立，移除假组合，真实Dedicated嵌套仍覆盖；杀host同时关闭Chrome不能稳定证明代理消失，改为生产策略+Chrome独立关监听器验证。没有降低产品断言。

### 限制与清理

真实平台账号/外发/云/Windows/Linux图形与DM/分享/上传发布wire限制不变；HTTPS证据只为官方公开文档。自有Chrome/服务/监听器/临时profile及失败遗留清理，保留复现脚本和/tmp/bff-ws-*.log。没有需用户决策的本地实现问题。
