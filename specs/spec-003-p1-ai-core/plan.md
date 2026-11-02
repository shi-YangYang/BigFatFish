# Plan 003: P1

## 模块与顺序

1. P0独立验收的代码缺陷先修复；仅外部OS验证未闭环时，按用户允许继续独立能力的要求推进。
2. 复核锁定DSH alpha.2发布类型，安装SDK及必要provider依赖；原生引擎profile和bridge使用同版接口。
3. 数据迁移、模型/凭据、人设/会话普通模块与认证API。
4. AgentEngine/DSHAdapter、安全profile、bridge流/取消及任务状态机。
5. WebSocket事件、CLI与Desktop真实交互。
6. 真实DSH+本地HTTP模型夹具验证，再做UI/CLI实跑和独立验收。

## 实施证据入口

docs/upstreams.md汇总准确仓库/版本及关键接口。研究阶段解包副本在/tmp/bff-dsh-alpha（sdk-client、protocol、agent、agent-loop、llm-pi-ai等），供核对但不得作为运行依赖。主分支源码和旧rc.5不能替代alpha.2的接口证据。

## 数据流

Desktop/CLI → Runtime认证API →持久化用户消息/任务 → AgentEngine → DSH官方SDK与受控子进程 → 真实流frame → Runtime事件与消息状态 → 客户端。人格与模型配置归Runtime，DSH仅执行；返回终态前保存实际结果。

## 安全边界

不给DSH子进程继承其他应用秘密；明确dshHome、cwd、模型环境。禁用内置shell/fs及遥测相关插件，bridge工具默认拒绝。桥接鉴权随机token、loopback、会话/任务绑定，不能接受未知进程/会话事件。模型密钥加密并只在请求时解密到进程环境；对外响应与日志不包含秘密。

具体决定见 [Decision 003](../../.ai/decisions/003-dsh-engine-boundary.md)。P0 Windows ACL helper 的敏感文件范围须随新增本机密钥扩展；不能仅保护原 connection.json。用户输入的模型 URL 不接受用户信息，远端采用 HTTPS，本地端点可用 loopback HTTP。人格版本在回合开始时固定，正在执行的回合不被中途修改；修改后的配置由下一回合使用。

## 验证

S3：schema、凭据、公共API和Agent执行边界。单元覆盖状态机/配置/加密/路由；集成通过实际SDK进程与测试专用模型HTTP服务器检查请求、SSE流、取消、resume、工具限制与超时。测试输出明确mock provider，仅证明引擎/协议，真实API需要用户自己的配置。执行类型/Lint/相关tests、构建和真实桌面/CLI链路；无理由不重复P0全量平台检查。

## 风险

DSH预发布API、Cordis补丁选择器、子进程生命周期、晚到流帧、取消竞态、凭据泄露、会话映射不一致。以真实已发布代码验证，不能通过吞错、移除断言或绕过DSH解决。

## 依赖审查

research_dsh_audit读取实际npm audit JSON、lock和发布包核实：213项包级告警来自4个叶依赖、11条advisory，不是213个独立漏洞。保留DSH alpha.2，实施者定向覆盖以下版本：

| 依赖 | 原实际版本 | 修复版本与证据 |
| --- | --- | --- |
| zod | 4.4.3 | 4.6.6；[官方集合校验修复](https://github.com/colinhacks/zod/pull/6652) |
| undici | 8.11.2 | 8.12.2；[官方8条网络问题修复发布](https://github.com/nodejs/undici/releases/tag/v8.12.2) |
| dsh-mcp-client所依赖的@modelcontextprotocol/client | 2.2.0 | 2.3.0，自动带core2.3.0；[官方跨源重定向公告](https://github.com/modelcontextprotocol/typescript-sdk/security/advisories/GHSA-6prh-2h8m-c8cw) |
| libreoffice-kit0.1.5所依赖的fflate | 0.8.2 | 0.8.3；[官方修复发布](https://github.com/101arrowz/fflate/releases/tag/v0.8.3)；根副本原已为0.8.3 |

研究者只读查询registry并检查实际tarball的所用导出，未安装或运行检查。Zod在Agent核心可达，当前树只有Zod4；集合仍需应用层长度限制。Undici在配置代理或切换已有策略时加载，无代理首轮fixture不能当作已验证该路径。MCP/Office未被minimal加载，但仍随依赖分发，不能因此忽略漏洞。所用导出静态兼容不等于运行验证；实施后核对lock、一次audit及已计划的类型/真实DSH流、取消、跨进程恢复检查，不进行无关大范围升级或重复原生UI矩阵。

## Implementation Report

implement_p1已返回完整报告，当前等待新的独立验收。实现实际官方DSH alpha.2、受控profile/bridge、模型及用途路由、AES-256-GCM凭据、人格版本、schema2会话消息/排队/幂等、认证API/WebSocket、CLI models/routes/persona/sessions/chat/cancel，以及Desktop模型/人格/聊天/历史。使用文档见docs/ai-core.md。

主要改动为apps/runtime/src/ai与Runtime database/lifecycle/server/paths/connection，CLI ai/main，Desktop App/components/api/style/Rust桥，相关unit/integration/模型夹具，package/lock、资源复制和README。未分公共包。

决策：每回合拥有一个DSH子进程，后续实际resumeSession；模型已被会话引用时禁止原位改变地址/模型名称，避免静默切换上下文，凭据可更新；P1工具目录为空且guard拒绝。最低Node>=24.9.0<25。DSH资源获取/停止统一处理，清理失败仍尝试所有步骤并聚合错误。

S3实际通过：npm run typecheck、lint、npm test（19 passed/2 Windows skipped，25.88秒）；随后资源清理修改后Node build、lint及cleanup/真实DSH集成4项通过，20.94秒。新增POSIX只读目录失败用例确认无新增TCP监听或残留profile。前端tsc/React生产构建、macOS cargo check、正式npm run desktop:build通过；本轮重新bundle的.app通过真实AX新会话/DSH测试回复、切页历史、人格版本2/1、模型保存、流中取消状态。git diff --check通过；实际npm audit 0，lock修复版本已核对。

真实集成包括OpenAI兼容SSE与DeepSeek Messages官方provider的本地HTTP夹具，关闭重建Runtime/DSH后的上下文恢复、真实增量、幂等/会话隔离、流中/排队取消与继续、超时/错误、WS鉴权隔离、schema1→2、加密/脱敏与人格版本、请求工具目录为空。临时进程与数据已清理。

限制：未使用真实云Key；Windows原生/ACL/Rust分支未跑；P1未新增Linux Docker DSH实跑证据，P0证据不能替代。关闭日志贡献有实际profile/代码依据，没有全进程网络抓包/OS网络隔离证明。MCP/LibreOffice修复路径未实跑；Undici代理路径亦不能因无代理fixture成功声称运行通过（见上述研究限定）。部分shell/原生依赖install scripts未运行，当前受控profile实测不依赖其能力；不得冒称这些工具可用。P2与平台功能未实现。

Git：dev、P0本地提交52eaaf8，P1未暂存/未提交，未push。用户已授权后续每阶段实现与代码验收后本地commit，由协调者处理。

### 实施中已核实的接口与修正

- 真正SDK探针请求本地/v1/chat/completions成功。实际stream revision按帧递增，不能假定同一attempt固定revision；采用attempt关联与单调revision，并在回合完成后等待bridge drain，避免关闭时截断帧。不是把最终回复拆成假流。
- 真实Runtime/CLI/SDK链路已检查重建SDK与Runtime后的resume、流中取消后继续、错误响应、消息幂等及模型查询脱敏。DeepSeek Messages本地协议夹具也已通过实际官方provider；未使用真实云Key。
- 四叶依赖定向覆盖后实际npm audit为0，原始/修复后JSON在本任务临时文件/tmp/bff-p1-audit.json和/tmp/bff-p1-audit-fixed.json。该证据不宣称软件不存在未知漏洞。
- Tauri npm API对齐2.12.4后正式desktop:build通过，重新bundle新版.app已完成原生AX聊天/历史/人格版本/模型设置/流中取消检查；本轮临时应用、Runtime、HTTP模型与数据已清理。P0原CLI版本不匹配问题的修复随P1提交，不改写P0历史。
- 协调审查发现profile写失败发生于原try/finally之外可能泄漏bridge。实施者已将整个获取过程纳入清理，并保证取消/SDK关闭拒绝仍尝试各项释放。新增实际POSIX只读目录失败检查，无新增TCP监听和残留profile；仅重跑受影响Node与DSH检查，未无故重复前端/原生UI。

## Rework 1

accept_p1返回FAIL，完整证据见acceptance.md。新的实施者只修桌面默认模型与异步会话/草稿隔离：未明确选模型时省略modelId由Runtime解析默认路由；请求结果按当前会话/请求身份更新，保护用户在等待期间输入的新草稿，避免旧消息覆盖其他会话。按局部风险做有意义的定向验证，不重复已通过的完整引擎/依赖/原生矩阵。协调者并行补Linux Docker CLI/DSH证据，不改业务文件。

### Rework 1 Implementation Report

rework_p1仅修改Chat.tsx：默认创建省略modelId，文案为使用默认聊天模型；以会话选择对象身份、草稿版本和requestId限制异步回写。删除POST后的第二条独立GET，轮询只允许单次在途并丢弃旧选择响应，保留会话切换与输入能力；失败重试保持幂等ID。未改后端或公共接口。

S1检查：审阅本次差异，严格单组件TypeScript通过；真实Headless Chrome/Vite挂载Chat和真实api.ts，仅替换Tauri invoke的受控DOM夹具8项PASS。覆盖默认/显式模型、慢轮询不重叠、A的迟到POST/GET不覆盖B、草稿修改后恢复同文字仍保留、A→B→A、正常清草稿、失败重试ID。初次夹具在React挂载前读取空DOM失败，修正夹具后通过，未因此修改生产逻辑。

结果/tmp/bff-chat-check-result.html，夹具/tmp/bff-chat-rework-check（已移出仓库），临时Vite和Chrome配置清理。不是原生UI/DSH重跑，不重复完整构建/测试/audit。Git index未动，交新的独立验收者。

### 返工复验与 Docker 收尾

accept_p1_rework独立复验Chat给PASS。协调者对末次Chat修改执行单文件ESLint和diff check通过。Linux原Dockerfile两次下载ECONNRESET后，独立容器maxsockets=4安装与实际CLI/DSH流/重启恢复先通过；随后新的实施者fix_p1_docker_install只在两处npm ci添加该参数。target build与正式生产镜像构建、正式镜像内smoke均通过，精确证据见acceptance.md；新的独立Docker配置审阅PASS。正式镜像未挂载宿主dist/node_modules。

无已知代码返工。Windows/真实云Key仍开放，Undici代理功能及OS网络隔离没有额外运行证明。诊断容器、镜像、cache卷与所有测试Runtime清理，正式bigfatfish:p1-check保留。用户已授权按阶段本地提交，协调者提交P1后按顺序进入P2，不能因此把外部缺口写成已验证。

安装脚本证据更正：npm的allowScripts清单提示不能等同所有脚本未执行。独立Linux安装日志实际记录node-pty、koffi、dsh-subprocess-local和protobufjs等安装脚本返回0；当前安全profile未开放对应shell/原生工具，也未专项验收其功能。不对所有平台安装脚本行为作超出日志的断言。
