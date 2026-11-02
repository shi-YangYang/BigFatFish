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
