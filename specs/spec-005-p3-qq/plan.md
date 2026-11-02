# Plan 005: P3 QQ

## 实施顺序

1. P2已独立验收并本地提交86bc867；统一事件、会话、记忆与凭据实际接口已核实，按Decision005建立外部身份/权限边界。
2. 完成最小真实插件 manifest/lifecycle 与 Runtime 管理基础，保持普通模块，不预建独立包。
3. OneBot 正向 WebSocket 客户端、事件校验、echo action 请求、账号健康、重连和持久去重。
4. 主人/群授权、统一会话映射、发送队列/未知结果、权限审批与审计；接入同一 DSH/Memory Engine。
5. Desktop/CLI 实际配置管理、健康与授权页面；编写外部 NapCat 安装登录说明。
6. 协议夹具与真实 Runtime/DSH 验证，具备用户账号授权后进行单列真实 QQ 验收，再交独立验收 Agent。

## 接口与数据

NapCat → 验证后的 OneBot 事件 → Runtime 权限/去重/任务 → 统一 Session 与 Agent → 发送权限/队列 → OneBot action → 根据响应保存实际结果。事件正文视为外部不可信输入，不决定权限。插件状态、账号、会话映射和消息状态由 Runtime 存储。

P2最初仅有本机主人入口；P3增加外部身份时，须为会话和检索携带真实主体/受众，向前迁移默认把已有记忆视为主人私有。统一记忆服务按可见范围过滤，不能把所有既有主人事实直接带入群回复。测试使用敏感标记验证群/非主人请求没有收到未授权记忆，同时主人仍可跨本机与QQ检索。

会话映射须包含身份/受众边界。主人配置变更、授权撤销或会话从主人降为普通对象后，不能继续恢复曾注入主人私密上下文的DSH会话；应按当前权限拒绝处理或建立隔离的新会话。旧记录保留供本机管理，不能因更换角色而把其历史开放给新受众。

### 已核实的P2衔接点

- ChatService统一持有Configuration、LifeService和DSHAdapter，create/send以产品会话ID工作，消息终态通过同一events发送。QQ应调用这些服务并以真实账号/受众建立映射，不自建DSH实例或复制聊天循环。
- 当前create与HTTP入口没有外部身份字段，MemoryStore.context(prompt)只面向本机主人。实施须在Runtime内部的会话建立、每回合检索与发送前校验实际受众；客户端/平台文本不得伪造owner身份。外部发言的来源身份随消息保存，候选提取不把群成员说的“我”归为主人。
- 现有SecretStore可加密账号token，但Configuration当前只以models.secret判断master.key是否必需。增加插件凭据后须将所有加密存储纳入密钥缺失判断，避免无模型密钥但有平台token时悄悄生成新key。复用现有主密钥，不建平行凭据体系。
- P2以唯一事件ID形成真实activity/experience/mood，扩展QQ收发事件复用同一入口；未知发送不写成成功，外部失败不影响本地聊天。插件管理先满足QQ实际生命周期，P7沿同一接口完成动态安装与隔离。
- 当前tsconfig.node以apps为rootDir，产物为dist/runtime/src及dist/cli/src；plugins只有空占位。新增真实插件源码时须明确编译/资源复制与加载路径，保持现有CLI入口和单根依赖清单，不让开发环境直接读TS源码而发行产物缺少插件。构建后的Runtime与CLI测试必须覆盖实际加载。

### 实施边界

默认只授权主人私聊；用户配置允许群及提及触发规则后才启用群回复，群内身份不获得主人管理权限。每次发送重新检查当前授权/插件状态和目标映射；禁用、配置变化或撤销时取消相关生成并拒绝迟到结果。主动消息通过本机认证API/CLI/UI创建审批项；批准只绑定展示的接收对象、内容与一次执行，不因模型文字自行批准。

manifest声明实际权限和外部NapCat依赖；内置QQ作为受信任产品模块，不称同进程为沙箱。产品原文要求的媒体与引用回复需明确适配范围，消费者缺口转入既有P5/P7而非删除。QQ验证仅使用本地OneBot夹具和真实DSH测试模型；没有用户账号授权时不得连接现存QQ或实际发送消息。

## 验证与风险

S3：外部通信、身份权限与持久发送状态。针对伪装主人、跨群泄露、断线重发、撤销后的迟到结果和凭据泄露进行检查；不重复无变化的 P0 完整矩阵。协议模拟只证明适配行为；QQ 真实小号与系统验证单列。平台限制和登录问题不能通过绕过风控解决。

## 上游与许可

以 docs/upstreams.md 中固定 OneBot/NapCat 源码为依据。NapCat 许可不是 MIT，采用外部运行/标准协议接入；QQ Relay 缺完整 LICENSE，不直接复制；QQ Bot 参考其接口时修正已知 get_version 命令不兼容，不能加载其独立 DSH 会话大脑。

## Implementation Report

2026-11-03，implement_p3完成实施，等待新的独立验收。没有Git/index操作或子Agent。

### Summary / Files Changed

新增runtime/channels的types/protocol/plugin/service/routes与单元测试，plugins/qq/index.mjs，CLI channels，Desktop Channels，OneBot夹具/QQ集成，smoke-qq与docs/qq.md。关联修改schema4、Configuration、ChatService、Memory/Life、lifecycle，Desktop记忆共享/来源作者/导航/CSP/文案及构建资源复制。

OneBot正向WS真实登录/账号/状态/echo/retcode/消息ID、退避重连，持久去重/处理发送状态，统一ChatService/DSH。外部会话保存主体/受众，旧记忆默认私有，群仅获得明确共享内容且不带私密来源摘录；配置/角色/共享变更隔离旧会话，撤权与停用拦截迟到结果。审批绑定目标/内容/digest/配置版本、5分钟和一次执行，立即返回executing并查询最终状态，未知发送不重试。仅有QQ密钥时丢失master.key也拒绝新建替代密钥。

出站媒体不透传NapCat缓存引用/路径/URL，认证入口提交有界PNG/JPEG/WAV/SILK，格式/大小和审批校验后使用标准base64。Desktop用文件选择及预览。sent只表示合法消息ID的协议确认，不表示已读或真实QQ已验证。

### Validation

- Risk Level S3。typecheck、lint、build、后续build:node与macOS desktop:build实际通过。
- 相关5文件23项累计定向通过：Memory17、QQ协议2、QQ集成2、Configuration1、P2真实DSH Memory1。不是末次一次全量运行，不累加重复次数。
- 最终真实DSH QQ单项3.86秒：私密marker/群隔离、来源作者、共享撤销/主人身份变化、模型实际请求后撤权、审批篡改/过期/重放、恢复主人身份后跨重启去重。修正先前去重作者未授权、撤权可能发生于模型启动前的测试前置。
- 最终协议健康单项6.48秒：错token/账号/未登录、echo/retcode/畸形消息ID、断线/探测超时重连、超时/async未知不重发、发送前异步检查期间停用、媒体审批准确内容、仅平台密钥丢失。
- 最终插件资源复制后node scripts/smoke-qq.mjs PASS，实际构建CLI/Runtime/插件配置、健康、审批、发送和停用；插件及改动夹具定向ESLint和diff --check通过。
- 原生macOS UI实际查看配置/在线、文本审批/批准/协议确认、停用撤销、重新启用；原生选择PNG，审批呈现目标/图片并批准显示协议确认。仅本地OneBot与HTTP模型，无真实账号。
- 原生构建后仅健康中文映射和来源作者标签，按S0检查diff，未将其称为原生复测。临时进程/数据/.app已清理；smoke与夹具源码保留。

### Known Limitations / Remaining Questions

真实QQ登录/私聊/群聊/媒体、Windows/真实云Key未验证。入站媒体仅类型/安全元数据，无视觉/ASR/文件阅读。自动回复是文本+引用；主动单媒体32KB、总段48KB，文件附件/长媒体/视频仍未实现，已保留到P7收口。SILK只CLI提交，桌面选择PNG/JPEG/WAV且无法预听SILK。内置受信任同进程插件不是OS沙箱，独立安装/隔离/更新在P7。暂无实施阻塞；新的独立验收后由root提交。

## Rework Implementation Report

2026-11-03，新的rework_p3完成两项首轮问题，等待新的独立复验，未操作Git或治理文档。

- ChatService在实际生成时绑定记忆范围，Channels持有相应发送校验句柄；QQ插件完成异步健康检查后、调用send_*前同步复核。变更时blocked/MEMORY_SCOPE_CHANGED且不外发；主人回复/独立主动审批保持原授权语义。
- 保存前用Node HTTP validateHeaderValue校验实际Bearer头，失败不改变旧配置、密钥、revision或连接。WS构造异常留在QQ错误状态，旧异常配置下Runtime/API/本地聊天可用并能停用/修正；缺master.key安全拒绝保持。保留旧非法token而停用不构造Bearer，启用或显式非法新token仍保存前拒绝。
- SEND_NOT_STARTED与实际外发后未知结果区分，未外发投递blocked，撤权审批revoked。修复在生成授权、统一发送与渠道网络初始化层，无引擎接口变化。
- 修改chat、channels/service/types、plugins/qq、Desktop api/Channels错误说明、OneBot夹具、新qq-rework.test.ts及docs/qq.md。
- Risk Level S3，验证定向。新两项回归+既有protocol health三项通过（6.88秒），覆盖已生成marker后挂起健康/撤共享零外发、未撤销/主人/审批对照，以及媒体/未知结果/撤权/master.key。最后仅补旧token可停用，定向token用例1项再通过（275ms），保留密文、未修正启用拒绝、修正恢复在线。
- Node构建（含TypeScript与资源复制）、改动文件ESLint和相关diff检查通过。新用例只替换模型执行为确定性桩，Runtime/API/ChatService/DB/WS真实；未重复真实DSH/CLI/原生或全矩阵，引擎接口未改变。临时Runtime/连接/数据清理，无直接剩余问题；外部与完整媒体限制不变。
