# 全阶段开发记录

## 2026-11-02：目标接入与仓库审查

- 全目标为 P0–P7，未缩减为演示。当前在 dev，初始基线 f18d3ec，工作区开始时干净；只有目录/文档，无依赖和业务实现。
- 产品原稿原位内容从 docs/product-design.md 移到用户指定的根 BigFatFish_产品设计目标.md。根 ROADMAP、CHANGELOG、ARCHITECTURE、CONTRIBUTING、SECURITY、IMPLEMENTATION_STATUS 按最新任务安排；既有治理结构保留。
- 工程继续按普通源码模块封装，单根依赖清单，不建立独立公共包。
- 实测环境：macOS arm64；Node 24.20.0、npm 11.19.0、Rust/Cargo 1.99.0；Docker 引擎 linux aarch64 可用。当前仅装 aarch64-apple-darwin Rust target。
- 已开始上游 DSH/两个抖音项目，以及 B站/QQ 的只读接口和许可证核查。研究代理不修改工程代码。
- P0 将作为 S3 实施：涉及 SQLite、认证 API、构建和 CI，按用户要求执行类型、Lint、单元、集成与运行检查。

下一步：实施 Spec 002。Windows 构建/安装与各平台账号实测只在取得真实证据后更新状态；普通技术问题自行处理。

## 上游核查与 P0 实施进展

- 用户已明确提供13个上游地址，B站准确来源疑问解除；固定版本、接口、许可和复用边界汇总在 docs/upstreams.md。DSH实际发布包与master API存在差异，P1拟固定alpha.2并使用受控工具profile与自有bridge；尚未把静态分析当运行证明。
- P0实施者已完成第一轮Node类型/Lint及10项unit/integration、macOS真实CLI smoke与React生产构建。随后修正Windows路径测试、dangling symlink边界和开发依赖minimatch漏洞，并重跑受影响检查。
- 最新实施者报告：npm ci零漏洞，typecheck/lint/10测试通过；本机 cargo build --release --locked通过；Docker Linux arm64真实CLI smoke通过。具体报告、独立验收与桌面实际UI验证尚在收尾，当前不标P0全部完成。

## P0 独立验收与返工

- 原生.app已通过AX实际观察：连接Runtime时显示已连接/真实启动时间；CLI停止后刷新显示服务尚未启动，进程与临时数据已清理。
- accept_p0完成独立审阅并返回FAIL：启动中断可遗留HTTP监听；慢数据库初始化时并发start过早失败；Windows既有宽权限DACL未被明确清除/验证。前两项有定向复现，第三项为代码与Microsoft官方语义证据，未冒充Windows实测。
- 新实施者rework_p0正在修复生命周期停止Promise、私有IPC启动握手和共享Windows ACL helper，补根因对应回归。只重跑受影响Node检查及必要Rust检查，不重复无变化的完整验证。
- Windows原生与ACL实机、真实云模型/社交账号、正式发行安装仍未验收。完整目标保持active，当前先消除P0代码缺陷。

## P0 返工复验

- rework_p0报告三项代码修复完成，完整证据进入Spec002 Plan。Node类型/build/lint与macOS Rust check通过；15项本机可执行测试累计有通过结果。首轮综合用例超时，定向复跑及握手调整后的受影响测试通过，超时根因未查明，没有改写为整套测试一次通过。
- 新的独立验收者accept_p0_rework正在复核上述三项根因和回归证据，不重复未变化的完整矩阵。
- P1草稿和Decision003已记录真实DSH版本、受控profile、模型凭据、流/取消/恢复边界；业务代码尚未开始。
- accept_p0_rework已返回PASS（代码返工范围）：三项修复无新增具体缺陷，不需再次返工。P0完整阶段仍因Windows证据不足保持未完成；按照用户允许继续独立工作的指令，下一步进入P1。工作区diff格式检查通过，未创建新commit或push。

## P0 本地提交与 P1 实施

- 用户更新授权：“以后每完成一个阶段，就本地commit一次”。协调者将事先审阅的P0暂存树提交为`52eaaf8 feat: 实现 P0 工程基础与运行验证`，未包含P1工作区；未推送，Windows/远端CI仍无运行证据。后续每阶段实现与代码验收后同样本地提交，范围见Decision002更新。
- P1已安装官方DSH依赖，真实SDK子进程成功请求本地HTTP测试模型；真实流帧按attempt与单调revision接收，正在完成drain、跨进程恢复、取消及API/CLI/桌面链路。该结果不是云模型实测。
- 依赖audit报告大量级联问题，已安排独立只读审查实际advisory根与最小修复版本；不执行force或不相关大范围升级。
- P1执行真实desktop:build发现Tauri CLI因Cargo/npm版本不匹配失败。P0只有直接cargo/本地app成功证据，未覆盖该CLI检查；已在P0验收补记，不改写历史。当前做对应npm API版本局部修复并重跑受影响桌面构建。

## 2026-11-03：P1 代码验收与 Linux 验证

- P1类型/Lint、19通过/2Windows跳过、最终清理改动4项真实SDK/cleanup、正式桌面构建和新版.app原生交互通过。实际OpenAI/DeepSeek协议夹具验证流、跨进程恢复、取消/超时与密钥/人格；未调用真实云Key。
- 独立accept_p1发现Chat默认模型绕过路由、异步旧响应覆盖新会话/草稿。新实施者仅改Chat，受控真实React DOM八项和组件类型检查通过；新独立accept_p1_rework给PASS。末次Chat单文件Lint通过。
- 原Docker构建两次依赖下载ECONNRESET，容器registry ping正常。低并发生产安装先成功，再由新实施者给Dockerfile两处npm ci添加maxsockets=4；target build、正式镜像构建及镜像内DSH smoke均通过。正式镜像未挂载宿主dist/node_modules，Linux arm64/Node24.22.2中两次本地模型请求、流、重启resume及四条历史验证成功。
- Docker两行改动独立审阅PASS；低并发成功支持连接压力相关判断，不证明唯一网络根因或永久解决。诊断容器/镜像/cache及测试Runtime清理，正式镜像保留。
- P1代码无待返工问题，Windows/真实云模型继续开放。按用户授权本地提交阶段结果，接下来实施已准备的P2记忆与养成规格；P2–P7草稿不代表已实现。

- P1已在dev本地提交`b1f73b3 feat: 实现 P1 AI 核心与跨入口聊天`，未push；未来阶段Draft未夹带。开始Spec004/Decision004的P2串行实施，结束后新独立验收及本地commit。

## P2 实施与独立验收

- 已实现schema3与MemoryStore/LifeService、来源精确引用、候选/确认/拒绝、版本化管理/冲突/合并、有界中文检索、导出和实际活动。提取/日记显式使用统一DSH任务，副本文件复用受限权限。
- 真正SDK+本地模型已通过聊天→候选→未确认不注入→确认→新会话带来源记忆→删除后同会话resume不再含旧检索块；原聊天保留。检索采用临时系统上下文，没有伪造长期记忆为会话恢复。
- 4个相关测试文件17项通过，包含P1引擎回归/迁移/认证；原生桌面构建通过。新增合并/导出与原生界面操作继续验证，尚未独立验收。
- 协调发现刷新hook在load失败前提交revision会导致永久跳过重试，已交实施者按直接边界修复，不重复已通过矩阵。
- 实施报告已返回并记录于Plan004：后续新增边界Memory/P2集成9项、末次Memory定向8项通过；原生界面完成聊天/提取/确认/来源/JSON导出/日记/时间线，CLI完成兴趣/关系/Markdown导出与日记第2版，文件权限0600。同revision故障恢复代理观察500后自动恢复200并清除局部错误。实施者清理临时进程与数据。
- 已创建新的独立accept_p2审阅实际diff/源码/证据；当前不将本机通过等同Windows/云模型验证，尚未提交P2。更新README/CHANGELOG/ARCHITECTURE/STATUS与既有使用文档，避免继续声称记忆未实现。
- 首轮accept_p2返回FAIL：内存库复现201来源后拒绝INVALID_MEMORY、前日501活动遮蔽目标日1活动误报NO_DIARY_SOURCES；静态确认保存迟到清新草稿。报告落盘Acceptance，范围记录Rework；已创建新rework_p2串行修复，随后新的独立复验。本轮不重复无关P0/P1矩阵。
- rework_p2完成三项修复，17项Memory/日期定向用例、修改范围类型/Lint、真实React延迟响应夹具通过。新的accept_p2_rework独立审阅源码/diff/用例和执行证据，给PASS，未重复已通过检查。完整来源保留、检索引用有界；日期扫描有明确完整性/预算；保存锁定且失败留草稿。代码验收已闭环，Windows/云/P2 Linux缺口继续单列；按授权准备P2本地提交。
- P2在dev本地提交`86bc867 feat: 实现 P2 长期记忆与养成系统`，39文件，未来Spec005–009未夹带，无push。按已授权Goal继续P3。

## P3 QQ 接入开始

- Spec005与Decision005具备实施条件：外部NapCat/正向OneBot11、主人稳定身份、默认私有记忆/受众隔离、统一聊天、发送审批/撤权和真实插件生命周期。核实P2接口与加密key检查、构建插件路径约束，当前不连接真实账号或发送真实消息。
- 实施者报告主要路径已实现且首轮类型检查通过，S3协议/真实DSH验证进行中。媒体当前为入站真实类型/安全元数据、文本引用回复与受限图片/语音引用；文件发送和理解消费者尚未接入，明确保留到P7已有收口范围，不能当已完整实现。要求核实真实NapCat引用解析并按账号/来源校验。
- 继续核对固定NapCat源码发现handleOb11FileLikeMessage在引用缓存未命中时回落uriToLocalFile，本机路径风险不能靠已收到引用完全消除；实施方案改为认证入口显式有界base64媒体、类型/大小检查、审批绑定，拒绝URL/路径/缓存名透传，记录Decision005。真实QQ媒体仍未验证。
- P3真实DSH+本地OneBot核心链路已覆盖私聊/群聊、私密marker、共享撤销、主人身份变化和撤权取消，协议/审批边界继续验证。Node/前端/macOS原生构建及构建后CLI smoke通过，原生UI操作进行中；尚未独立验收。
- 实测发现Runtime客户端2秒超时短于OneBot5秒未知结果等待，批准接口改为立即返回executing并通过持久状态查询sent/failed/unknown，避免HTTP等待超时被误作审批失败。受影响检查由实施者完成，不无故重复其他矩阵。
- implement_p3完整报告已记Plan，新的accept_p3独立验收FAIL：两次隔离复现确认已生成群回复在发送前健康等待时撤销共享仍泄露marker；中文HTTP头token被保存后导致Runtime重启失败。已记录Acceptance/Rework，创建新的rework_p3修复，之后新的独立复验；本轮不提交未通过代码。
- 新rework_p3完成生成快照到最终发送门、Bearer原子验证和WS初始化错误隔离，旧坏配置可启动/停用/修正；新2项+既有协议健康3项过，最后仅token停用用例复跑通过，Node构建/定向Lint/diff通过。新的accept_p3_rework独立检查源码与断言给PASS，无重复测试；确定性桩、原真实DSH/原生证据及外部/完整媒体缺口分开。准备阶段本地commit。
- P3在dev本地提交`9923a67 feat: 实现 P3 QQ 接入与权限审批`，45文件；未来Spec006–009未夹带，未push。继续P4。

## P4 B站复用开始

- Spec006/Decision006明确固定whale实际CLI/认证、data-dir隔离、真正字幕/画面证据、同一DSH/记忆/活动；观看视频可经现有QQ审批分享，P5统一调度接入自主浏览，不加载上游独立大脑或计划。
- 本地alpha.2 SDK实际类型已核实支持图像content blocks，Adapter尚仅传文本；P4须用真实DSH请求验证，不能把类型声明当能力实测。研究/tmp副本不是运行依赖，需完整许可和实际导入闭包。
- implement_p4已取得固定commit完整源码、抽取20个实际CLI/QrAuth依赖文件，保留LICENSE/NOTICE/原manifest元数据/bff.patch；显式工作/风控目录与网络/命令/输出边界已编码。schema5视频任务、统一DSH图像理解、候选兴趣/活动和QQ审批分享已接入，CLI/Desktop及真正上游+ffmpeg+DSH验证正在进行，未提前判PASS。
- implement_p4完整报告已读取：累计10文件24项不同定向检查、type/lint/build/最终Node构建与macOS release通过；实际CLI/原生桌面搜索/观看/字幕九帧与来源显示通过。新增SIGKILL从实际在途任务验证临时明文自动清理、重启interrupted。实际whale/ffmpeg/DSH，网络和账号为夹具；真实平台/云/Windows仍未验证。报告已入Spec006 Plan，转新独立验收，不重复已通过检查。
- 新的accept_p4独立验收PASS：上游/许可、凭据与数据隔离、真实观看/统一DSH/记忆、任务与QQ审批、入口和文档符合Spec。针对少帧误报的具体疑点，隔离1秒/5秒真实媒体配9秒元数据，whale/ffmpeg抽帧失败无SHEET，未复现误报；没有扩大编解码矩阵，已清理实验。完整报告落盘Acceptance，准备按授权本地阶段提交，真实平台/云/Windows仍未验证。
- P4在dev本地提交`7ceb617 feat: 实现 P4 B站接入与统一观看记忆`，70文件；暂存已逐项检查，未来Spec007–009未夹带，无push。按Goal继续P5。

## P5 抖音与统一调度开始

- Spec007已核对两上游实际BrowserController/Python FastMCP接口、CDP严格接入/目录隔离、独立人格记忆副作用、注册白名单和最终写入审批边界。P4基线7ceb617，普通模块/单根依赖不变；观看和互动由一个Browser Manager/队列持有专用会话，统一调度复用B站与抖音。
- 真实账号、扫码、验证码和社交写操作未授权；以实际浏览器/上游/MCP和隔离页面/模型协议验证，外部平台证据继续单列。单个实施Agent串行实施后新独立验收。
- implement_p5进度：固定来源/许可/patch、LockyBee原始观察/三帧proof/音轨采样切片、Python FastMCP严格CDP/逐提交guard、Browser host父进程退出清理、ApprovalStore与QQ作用域迁移、schema6任务/定时/自主决策、抖音读/观看/附件/审批、统一ASR及CLI/API已编码。Desktop和实际浏览器/MCP/网络最终guard/取消验证进行中，未提前判通过；QQ原有全表撤销已按plugin限定，最终reply guard保留待直接回归。
- 协调源码阅读指出两处具体边界：未启动抖音取消不得等待队列前方无关B站长任务；自主浏览不能只选固定已看ID。实施者已改即时取消未运行项/只drain实际运行项，将加对应定向用例；自主发现按授权主题/平台、最多2次搜索/推荐、最多20候选、一次DSH选择/休息与单轮预算实现，语义补入Spec。
- 实施者报告真实Python凭据读取、LockyBee三帧/音轨→统一ASR/DSH图像→候选兴趣/时间线/日记链已跑通；点赞隔离页面的状态属性与上游语义不符导致unknown，正在修正夹具，保持产品回执验证，不降低断言。最终检查/独立验收尚未完成。
- P5真实综合集成已通过（约52秒，一项大场景）：Chromium/LockyBee/Python FastMCP/ASR/DSH/记忆日记、正常点赞、导航等待撤销、工具guard放行后延迟网络提交再撤销零请求、账号变化、未知不重试、真实搜索候选与DSH自主选择、暂停/CLI。实际SIGKILL Runtime后专用浏览器退出、重启interrupted和未开始任务取消不等待无关前置平台用例已过。type/lint/build/macOS release已过；QQ回归发现已结束审批错误码优先级变化，实施者修回APPROVAL_NOT_PENDING并仅重跑失败用例。原生UI、附件/依赖等窄边界及最终文档检查仍进行中。
- 全历史观看去重已由持久查询替代最近100条列表；新增activity_requests映射/视频索引，先检查requestId参数冲突，再保存去重别名，定向历史边界检查进行中。
- P5原生macOS release已再次构建，隔离真实Runtime已启动；操作窗口时CUA报告Mac锁屏且自动解锁失败，因此本轮原生UI操作未通过、未绕过锁屏。root已异步请用户解锁，尚未答复，继续其余验证；可恢复夹具/tmp/bff-p5-ui.mjs，实施者负责最终清理/交接。此前P4原生证据不替代P5。
- implement_p5完整报告已读取并入Spec007 Plan：累计12文件22不同定向测试、type/lint/Node/macOS release、两份patch dry-run与自有diff通过；无界面React+真实Runtime配置/观看/Home在途/审批/暂停通过，root已查看截图。原生UI锁屏门槛及真实账号/其他系统缺口保持。进程/测试数据已清理，转新的独立验收。
- 用户明确答复：暂无Windows电脑/虚拟机，先继续其他开发验证；Mac已解锁，可继续原生桌面操作。两条输入已处理，不重复询问。
- accept_p5完整FAIL报告已读取并落盘：批准目标外的点赞+额外评论实际穿过网络门且completed；缺稳定ID的同名私信对象仍获准；未发送的编辑框正文被认作成功收据；ASR跨chunk汉字损坏。均隔离复现，非外部账号缺口。创建新实施返工及新独立复验流程，P5不提交；原生UI在返工后用已解锁Mac补证据。
- rework_p5报告ASR分块用例、真实Python/Chrome收据15场景、Runtime/Chrome/Python实际外发11场景通过；点赞/评论正向各仅一次获批外发，错目标/错正文零外发，重复/额外动作及错收据不再completed。评论首轮失败为隔离HTML缺charset导致中文乱码，权限门正确拒绝，修正夹具后受影响矩阵通过。尚待完整报告与新独立验收。DM/分享/上传实际wire schema无法由固定来源确认，当前拒绝外发，保留真实上游DOM流程及准确能力状态；Python DOM正向不等于Runtime或真实平台可发送。新版.app已实际打开并连接隔离Runtime，原生操作继续中。
- rework_p5完整报告已读取并入Plan：追加授权等待后会话切换负例后，Python/Chrome累计16场景；网络11场景、3文件4项窄TS测试、type/lint/Node/macOS build及patch dry-run通过。原生Mac账号验证/点赞审批/观看/Home经历/暂停恢复/计划停用已实际操作，CLI同目录确认3任务completed；隔离进程与数据清理。新独立accept_p5_rework开始；DM/分享/投稿协议未实现与真实账号门槛仍单列，未提交。

- accept_p5_rework完整FAIL已读取并记Acceptance：实际获准POST经307跳其他来源/端点且接收器收到；顶层评论响应带未批准父ID仍completed；隐藏旧消息显示后被DOM识别为新增。已创建新rework_p5_second，仅处理重定向真正外发边界/父目标语义/不依赖可见性的收据基线及直接回归。P5仍不提交，原生Mac既有证据有效。
- rework_p5_second完整报告已读取入Plan：原生CDP重定向补门、父字段一致校验、全ID历史基线完成。本轮3TS文件8项、Python8组，实际生产转发/普通及登录跳转、popup/OOPIF/取消/撤销和14场景网络矩阵通过；正常批准1次、受限后续0。typecheck/Node build/定向lint/patch dry-run通过；进程/临时数据清理。新独立accept_p5_second_rework开始，P5仍未提交，DM/分享/投稿协议缺项保留。

- accept_p5_second_rework完整FAIL已读取入Acceptance：原三项修复与证据一致；新CDP守卫对普通worker误用Fetch.enable，返回-32601后关闭主页面。生产BrowserManager+loopback普通Worker已复现，无写请求。创建新rework_p5_worker仅修target能力/网络归属及直接回归，不重跑无变化模块；P5继续未提交。

- rework_p5_worker完整报告已入Plan：Dedicated/嵌套/Shared HTTP归属、普通读取和受限请求、生命周期/取消共4项直接检查与build/type/lint通过。新accept_p5_worker确认HTTP修复，但用生产BrowserManager+本地WS实证Dedicated/Shared在read无gate时各发1条消息，Page同类0；完整FAIL入Acceptance，创建新rework_p5_worker_ws修同一未知WS拒绝边界，P5不提交。

- rework_p5_worker_ws完整报告及新独立accept_p5_worker_ws PASS已读取并落盘：启动前拒绝代理拦截WS/WSS且无直连后备，Worker16尝试目标TCP/握手/消息0，正常HTTP16次；9项直接检查、Node/type/lint通过，公开官方镜像HTTPS 200/TLS1.3。最终验收核对源码与实际日志未发现疑点，未重复测试。root同步全局状态，准备按授权本地提交P5可验收代码；协议未完成/真实账号/其他系统缺口保留，随后继续P6。

## P5本地提交与P6实施

- P5在dev本地提交e9b080b，75文件，8203新增/98删除；未来Decision008与Spec008/009未夹带，未push。提交后index空，远端/PR未刷新核实。完整本地返工已独立PASS，未完成协议与外部证据仍明确保留。
- Spec008/Decision008已进入实施，新implement_p6串行完成独立安装、备份恢复、后台/托盘、Linux部署与可信更新；用户无Windows、签名/发布条件尚缺，先完成可审阅本机/Linux产物。具体资源解析和数据保护边界已写入Plan/Handoff。
- P6实施进度（尚未独立验收）：实施者报告真实DSH聊天→选择性备份/加密凭据→新目录恢复→续聊包含旧记录；错误口令/路径/过新schema原数据保持。已生成macOS .app/DMG并从安装副本完成原生向导、模型配置、实际DSH聊天；关闭窗口后受限PATH的CLI确认后台Runtime存活。Docker已构建，持久卷/systemd/更新验证继续。协调阅读发现并已交实施者补足模型路由/活动去重迁移及更新中断/数据兼容保护；不能提前将这些进度写成阶段PASS。
- 后续直接证据：Docker非root健康、人格持久卷重启保持；专用PID1容器的systemd用户服务启动/认证访问/重启/停止通过。实际portable内置Node与受限PATH完成0.1.0→0.1.1→回滚0.1.0并保持人格，演练发现tar链接策略冲突后已修正。10003条迁移历史测试取最新100，明确省略数量且当前请求不重复。macOS更新仍在验证：默认Quit路径已修正并实际退出停服；测试LaunchAgent `/Users/yang/Library/LaunchAgents/BigFatFish.plist`已删除。界面等待根因定位为updater启用reqwest/rustls-no-provider后管理API Client构建panic，实施者正在应用入口注册一致ring provider后复验；早先IPC刷新/后台节流只是假设，未据此改CSP或异步模型。未进入独立验收，未提交P6。
- P6实施报告已完整读取并整理入Plan008，业务冻结，进入新独立验收。最终原生Mac实际安装0.1.0→签名候选0.1.1→重启续聊→缺失Node失败保持原库→人工回退0.1.0并恢复4条原消息，失败版本6条保存在failedData。应用内确认替代WebView不可用的confirm，TLS provider和AppleDouble归档根问题已修复并实际复验。产物保留，任务应用/测试信任/临时数据及服务已清理；Windows、正式签名/发行、跨schema和实际注销重启仍未验证。Git仍dev/e9b080b，无P6提交，Spec009草稿不纳入P6。
- 新accept_p6完整FAIL已处理并记录：HTTPS清单内HTTP包地址仍会被底层库下载（签名未绕过）；交互config无条件等待stdin EOF；Windows更新测试与明确拒绝portable安装的生产规则矛盾。创建新实施者按rework.md定向修复并更新受影响产物，再由新的验收者复核；不将外部Windows环境缺失当作这三项代码缺陷的解释，不提交未验收P6。
- rework_p6完整报告已读取入Plan：三项修复完成，Node4过/Windows专用1跳过、Rust2过/HTTP请求0；最终DMG与Mac/Linux portable重建，三处内置CLI stdin保持打开均exit0。实际产物hash和源码/二进制对应证据在build/p6-rework，旧0.1.1候选明确为返工前证据。自有资源已清理，业务重新冻结，交新accept_p6_rework只读独立验收。
- 新accept_p6_rework完整PASS已处理入Acceptance：源码/证据hash对应，三个缺陷均正确层修复且未放宽保护；未重复已过检查。root更新阶段状态并准备按授权本地提交P6，未来Decision009/Spec009排除，随后进入P7；完整跨平台/正式发行仍未完成。
