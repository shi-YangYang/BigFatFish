# Plan 009: P7 Web 与插件生态

采用 [.ai/decisions/009-web-and-plugin-contract.md](../../.ai/decisions/009-web-and-plugin-contract.md)。P6返工已获新独立PASS并本地提交a0e8f61；当前按完整Goal授权进入P7。

## 实施顺序

1. 前序阶段验收后梳理真实API、前端普通组件、插件生命周期/权限和发布格式；保持唯一Runtime。
2. 完成独立认证会话、TLS/可信代理边界和WebSocket授权，先做负例验证。
   实施梳理后选择薄TLS网关独立进程，服务端代理同一Runtime API并持有受限本机凭据，Web会话单独管理。网关在核心离线维护期间保持在线，协调原CLI/维护核心后报告实际结果；默认关闭并提供明确独立生命周期，不建立第二套业务后端。
3. 真实Web Console页面与API/事件联动，处理断线、错误和敏感操作。
4. 完善SDK/协议、安装产物验证、授权、子进程/RPC、版本更新/回退和卸载。
   初步复用plugin_config和受限插件目录保存安装状态，未出现新增结构化表必要性时保持schema6。语义兼容、P6归档恢复及授权清理仍须实际验证；平台更新排空旧实例并实际加载新资源，不能仅改版本字符串。
   核对QQ/B站/抖音当前构建复制及硬编码加载路径，使实际平台插件也能按统一契约独立安装/启停/更新；不能仅让新示例插件可安装，而三个产品平台仍永远依赖仓库源码路径。保留Runtime拥有的账号/任务/审批/记忆职责，不把插件安装等同另装一套应用。
5. 从独立目录实际开发/打包/安装示例插件，完善真实目录和开发者文档。
   已核对 P1 `AgentEngine` 当前只有 run/close，`dsh-bridge.mjs` 使用 `ctx.tools.guard(() => 'denied')`，尚无产品工具注册路径。按原产品第6/15节补显式工具契约和实际 DSH→Runtime→插件→回合结果链，不让平台插件自建大脑。固定已安装 DSH 源码/接口是依据；新增工具权限按当前会话主体、受众和审批检查，模型不能自批。用实际 SDK 与协议夹具证明模型工具调用及结果继续生成，不把直接 CLI 调用当工具回合证据。
   同时核对Model Router全用途消费者，补足未在前序实现的ASR/TTS服务适配与各入口显式调用；真实媒体/协议和云端证据分别验证。
   按产品开源交付要求核对CONTRIBUTING、CODE_OF_CONDUCT、SECURITY及版本发布说明；只写实际可执行流程，不编造已发布版本或维护者联系方式。
6. Web/TLS/权限/插件端到端检查、文档命令验证及独立验收；逐项核对完整Goal与外部证据缺口。

## 验证

S3：远程认证、权限、动态代码与升级。重点验证未经授权访问和执行被阻止、撤销及时生效、恶意归档无法逃逸、插件失败不会破坏宿主和数据。使用隔离TLS测试环境与真实浏览器；静态截图或HTTP200不能替代完整操作。独立插件必须脱离仓库隐式路径运行。

## 风险

本地token意外外泄、代理头信任过宽、权限方法遗漏、取消/撤销竞态、插件运行权限被夸大、更新数据破坏与文档不可复现。通过统一执行门、明确契约和实际负例处理，不为通过测试删除功能或绕过认证。

## 已核对的实现入口与依据（2026-11-03，规划证据）

- Web沿用当前React组件：`apps/desktop/src/api.ts`直接调用Tauri `runtime_request`，App直接调用`runtime_status`；应在普通入口适配层区分Desktop/Web，业务组件继续调用同一API。当前Chat通过受控轮询获取真实消息，未来工具活动/事件接入须保持其会话切换及草稿归属保护。不要为Web复用搬迁既有源码或增加独立npm包。
- `apps/runtime/src/server.ts`当前明确拒绝所有Origin，并要求精确loopback Host和本机bearer token。这是Desktop/CLI边界，不能为Web取消。远程入口须独立完成TLS/登录/会话/CSRF/WS认证，再进入相同Runtime能力；浏览器不得接收或持久保存本机connection token。实现前核对P6实际新增接口，对恢复/更新等操作保持相同独占和验证语义。
- 已读取Sites技能的local-only路径和local preview规则；采用既有仓库与本地预览，跳过新Site注册、源同步和发布，不建立Cloudflare/Vinext第二套后端。浏览器验证先检查实际服务再打开打印URL，测试后清理自有服务。当前目标未授权外部托管或push。
- 固定安装的`@deepseek-ai/dsh-tools@0.2.2-alpha.2`（README及`lib/types/contracts.d.ts`、`schema.d.ts`、`index.d.ts`）提供`ctx.tools.register(defineTool(...))`、`register(...,{when})`与`ctx.tools.guard`。工具描述进入模型schema，execute接收调用上下文与`exec.signal`；guard是同步拒绝门，不能用异步回调假装执行最终权限校验。Runtime仍须在真实工具执行前重新验证会话主体、插件代次、授权与取消，返回有界结果；DSH默认shell/fs拒绝只对明确注册的产品工具作有限例外。注册/结果/取消必须用真实SDK回合验证，不能把仅有类型声明当运行证据。
- 语音以可配置协议适配，不强制某个云品牌或模型。当前`ai/media.ts`只消费ASR路由，使用multipart模型/文件输入及有界JSON文本输出；固定`capture.webm`命名仅适合当前浏览器来源，新文件入口须匹配实际媒体类型/扩展名。[OpenAI转写接口](https://developers.openai.com/api/reference/resources/audio/subresources/transcriptions/methods/create)要求音频文件对象和可识别格式，响应格式随模型不同，不得把所有兼容服务都假定为任意格式可用。
- [OpenAI语音合成接口](https://developers.openai.com/api/reference/resources/audio/subresources/speech/methods/create)的Speech协议以model/input/voice请求并返回音频，input上限4096字符，可显式选择音频格式；[官方语音指南](https://developers.openai.com/api/docs/guides/text-to-speech)已注明旧TTS模型2027-01-06停用及替代Realtime协议不兼容`/audio/speech`。本项目不自动替换用户模型、不把Realtime模型填入旧接口；界面/文档明确所实现的兼容协议和AI合成音频。若新增另一协议须实际实现适配，不能仅改模型名。账号、计费和云端效果仍未验证，当前先用隔离本地协议夹具证明实际媒体链路。

## Implementation Report

implement_p7完整报告已读取（2026-11-03），实施完成，等待新的独立验收；未动Git/index。以下保留实现、验证顺序、失败原因和限制，不以实施者结论代替验收。

### Summary / Files Changed

真实TLS口令/会话/CSRF/WS控制台复用同一Runtime；普通SDK与外部目录示例、QQ/B站/抖音平台包真实安装授权启停更新排空；真实DSH工具回合和入口活动；统一ASR/TTS及QQ媒体/文件审批；schema6归档兼容和恢复失权；发行资源包含Web/SDK/示例/三平台。

主要文件：runtime web/plugins模块、cli web/plugins/input、apps/web、plugins/sdk、examples/hello-fish；lifecycle及三平台服务加载/排空；ai的工具/媒体接口；channels及审批大小限制；Desktop api/Chat/Channels/Plugins/Media，Rust对应请求超时；构建资源/目录/打包/smoke脚本及相关单元/集成夹具。详细文档docs/developer.md、ai-core.md、qq.md、install-and-migrate.md由实施者维护；根全局状态与治理由root维护。

### Important Decisions / Root Causes

- 薄TLS网关默认关闭、独立前台运行；Secure/HttpOnly/SameSite=Strict会话、CSRF、Host/Origin、限流和有效期。本机bearer仅服务端使用，shutdown按规范化pathname禁止。在线换密由网关锁返回WEB_STOP_REQUIRED，须停服配置后重启，避免旧口令仍有效而报成功。
- Web维护先排空停Runtime，再用P6维护核心并重启；程序更新仍用原签名核心，完成后明确重启控制台进程。
- 每次安装写新随机目录，验证路径/链接/摘要/权限/兼容/schema；旧状态和存储深拷贝，排空后切换，初始化失败回退，增权失去授权并停止。每ID串行，关闭等待管理操作及子进程实际退出。修复旧对象被disable原地改写导致回退分支不可达的问题。
- 正反向RPC有并发/大小/期限，宿主请求绑定活跃callId和代次并在执行前检查。正常/错误result共用controller.abort后resolve/reject分支；stop/cancel同样中止，lifecycle信号到ASR/TTS的AbortSignal.any和fetch。定向实测覆盖取消与提前正常返回；错误result仅共用代码审阅，不冒充另做云中断实验。CLI/RPC均流式UTF-8，防止中文跨Buffer损坏。
- v1配置只收非敏感有限schema，未知约束拒绝，避免writeOnly被接受却明文回传；凭据沿用模型/平台秘密入口。Model扩展用兼容HTTP服务，不以RPC替换统一AgentEngine。普通子进程具有同OS用户权限，不是沙箱。
- plugin_config复用且schema保持6；归档恢复去除安装路径、启用和执行授权。QQ媒体每项2MB，OneBot/Runtime/审批/最终发送同步有界；仅读取关联入站标识的base64，不读NapCat主机路径或盲抓URL。上传本身外发，审批前不得执行，上传后不重复发送，无有效收据保持unknown且不自动重试。

### Validation

Risk Level: S3。实际顺序如下；不是全平台交付结论：

1. 实质业务修改后根typecheck、lint、build通过；最后相关组合8文件14测试通过（Web/插件/媒体/CLI输入/插件边界/QQ协议及返工/维护CLI）。此前相关AI、真实schema6备份恢复检查通过，不重复累计相同用例。
2. B站实际安装/更新资源后的whale/ffmpeg/DSH/CLI通过。抖音实际安装目录Python MCP/Chrome/LockyBee/DSH/媒体流程通过，定向2项通过、1项因筛选排除；不是跳过失败测试。
3. npm构建、portable准备、Mac app/DMG打包通过。复制app到仓库外临时目录，PATH=/usr/bin:/bin、仅随包Node：SDK打包/安装授权调用、真实DSH工具续答、ASR/TTS、HTTPS Web资源成功。
4. 原生CUA点击插件调用/停用、生成并播放5秒音频、查看工具活动。此后仅简体标签/CLI help/smoke清理和文档变化，定向lint、Node/Web构建和native打包完成，未重演已过矩阵。
5. 最终dist的115文件与portable/app资源逐项SHA-256一致，bundled Node一致；diff空白检查通过。

覆盖TLS真实浏览器认证及操作、认证/CSRF/会话撤销、恢复停启、更新失败回退、增权撤销、取消/提前返回宿主终止、中文分块、非主人拒绝工具、约230KB有效PNG/5秒WAV/240KB中文文件、超2MB拒绝和停用断开。

实际失败及处理：无效PNG fixture被DSH正确拒绝，改有效图片后通过；抖音旧unknown断言仅DOM不变却收到同Request有效HTTP成功收据，改名domUnchanged并匹配真实判定，保留真正缺少收据unknown/零重发负例，未放宽生产门。此前一次AUDIO_UNAVAILABLE已在实施进度记录，不冒充首轮全绿。

### Artifacts / Evidence / Cleanup

最终app：apps/desktop/src-tauri/target/release/bundle/macos/BigFatFish.app；DMG：apps/desktop/src-tauri/target/release/bundle/dmg/BigFatFish_0.1.0_aarch64.dmg；portable：build/portable。build/p7-evidence/final-artifacts.json记录完整路径、同步和哈希。DMG SHA256为69b1e8468e40f6eed46fe79d31ae67e682392744b4f5d454999fd45845b0e028；app树e86676fbbbaee65535878b23486bf0a3ec1729a6c3ba9671034c34c943e6133d（精确定义在JSON）。旧P6 build/artifacts归档不是P7最终产物。

build/p7-evidence/installed.json与native-plugin/native-audio/native-tool-chat的PNG及AX文本保留；scripts/smoke-p7.mjs为复现入口。音频是受控HTTP模型fixture返回的有效5秒80044字节WAV，原生实际播放；不是云语音效果证据。截图早于最后文案变化，无后续业务变化。

实施者报告自有临时安装副本、TLS私钥、数据、网关/Runtime/模型fixture、Desktop配置已清理；保留最终产物与无密钥证据。

### Known Limitations / Remaining Questions

Windows、真实平台账号与云Key缺失；未重复P6 Linux/更新全矩阵，Web更新复用已验核心但未做公开在线签名发布。Mac仅ad-hoc，无正式签名公证/发布。抖音DM/分享/发布既有拒绝继续保留，产品仍部分实现。QQ依赖NapCat明确base64，无字节时失败。第三方插件非OS沙箱；Model扩展不提供任意RPC替换大脑。无待用户决定的实施问题；dev未提交，交新独立验收。

## 实施中协调审阅的直接事项

首轮骨架已有typecheck通过，后续业务仍在修改，不构成最终验证。以下来自具体调用关系，已交实施者在阶段内收口，最终报告/验收须核对结果：

- PluginProcess初版pending数量仅限制宿主向插件调用，反向host消息无并发限制和invocation取消绑定。工具取消后不能只丢弃返回值，还须阻止迟到storage/events等宿主动作；与活跃调用/插件代次关联并在执行前检查。
  后续callId/并发/杀进程修订后，lifecycle的media宿主能力仍使用独立60秒timeout；必须将实际调用取消信号传入宿主ASR/TTS fetch并与timeout合并，不能插件退出而宿主请求继续运行。
- install初版向固定version+hash路径写资源后才停旧实例，同包更新可改运行目录；已存在链接可能被writeFileSync跟随。采用真实新暂存验证、排空旧实例后切换，并核对实际文件系统链接边界。
  初版old直接引用states对象，disable会将old.enabled改false，使后续启用更新/失败回退分支不可达；next.config/storage还复用旧对象。更新事务须保留不可变旧状态与数据快照，验证实际启用更新，以及候选初始化先写入再失败时完整回退。
- 工具参数schema要作用于实际调用，不能只验证manifest字段的type。events.subscribe及各extensions名称须有真实扩展契约/消费者，不能枚举即声称已支持。
  支持有限JSON Schema子集时明确拒绝未知约束；非敏感config不能接受writeOnly后又明文回传。实际凭据继续统一模型/平台秘密入口。RPC正常完成/失败也终止所拥有的异步宿主子操作，避免插件提前返回留下脱离调用的请求。
- Web代理的禁止路径按规范化pathname判断；初版exact route匹配会漏掉带query的/v1/shutdown。
- Web正在运行时configure不能报已换密却仍用启动时旧口令/会话；采用独立网关锁拒绝在线配置、停服后配置重启的明确流程，旧会话随退出失效。
- QQ媒体不能仅保留P3的32KB上限而称完成实际媒体收口；以有界但适合普通图片/音频/文件的大小，贯通OneBot、API、审批和最终发送门，验证超过旧上限的有效媒体与超限拒绝。真实账号仍外部门槛，不扩大为无限文件/网络代理。
  P6 CLI readInput默认64KiB，媒体入口须按实际命令传合适有界上限，不能UI可用而CLI先拒绝正常媒体；普通配置保持小上限。RPC stdout及CLI stdin按流式UTF-8解码，避免中文跨Buffer边界损坏，定向切分多字节回归即可。

## P6 完成后的接口衔接

- P6 `apps/cli/src/maintenance.ts` 先 `stop()` 排空 Runtime，再由 `maintenance/archive.ts` 获取固定实例锁；Rust 桌面通过同一 CLI 完成维护。Web 备份/恢复不能在持锁的运行中服务直接调用离线核心造成自锁，也不能停服后把未完成操作当成功。实施须明确维护交接、状态查询和恢复连接的生命周期，沿用同一核心与 journal，实际验证远程操作后的重新登录/连接和数据保持。使用用户上传/下载文件或明确的受限存储，不能将任意服务器文件路径操作暴露为普通浏览器表单。
- `App.tsx` 除 API 外还直接调用 runtime_status/desktop_settings，并在未连接时显示桌面向导；`Setup.tsx` 有仅宿主可用的路径、启动项、原生更新。Web 必须使用浏览器适用的连接/登录/维护入口，保留 Desktop 行为，不能依靠不存在的 Tauri invoke，或假装能更改访问者电脑的开机项。共享业务组件与入口专属控制分开，错误/断线语义一致。
- Runtime 当前在 lifecycle 中直接创建 Channels/Bilibili/Douyin，QQ loadQQ、B站 loadBilibili、抖音 asset() 仍指向内置资源。P7 插件管理需实接这些加载/停止/撤销路径，避免管理页状态和平台实际进程分离。保留此前同 Request 审批门、同步发送权限快照及 Worker WS 拒绝策略；增加管理层不能绕过它们或使卸载后在途调用继续执行。
- 插件协议中的类型枚举不等于扩展已可用；SDK 文档需分别说明真实扩展入口、授权和兼容范围。独立示例走公开协议，不调用测试专用能力。已有平台凭据与权限仍由 Runtime 持有；第三方代码为用户显式信任的本机代码，RPC 权限限制不宣称操作系统隔离。
- 新插件安装元数据/存储与 Web 认证状态需同步考虑 schema、P6 归档选择及恢复策略。选中插件配置不等于授权恢复机器执行第三方代码；源/版本及缺少产物的状态应可见，恢复后仍须显式安装/授权。Web 会话、连接 token 和临时下载不能借新增表进入默认备份；变更后检查受影响的维护路径，不重复不变的原生矩阵。
  P6已交付schema6归档。若P7新增schema，须保留从已知schema6数据库和归档升级的真实路径，不能仅把严格版本比较改成新常量而使用户旧备份无法恢复。通过已知迁移和默认安全状态处理新表，未知/未来schema仍拒绝；至少用P6格式的真实历史/凭据选择归档在新版本恢复并续聊，更新候选的实际数据迁移与原schema回退分别留证。
  P6 Rust updater的在线prepare_online_update/离线路径与发布metadata目前以schema6为基线；新增schema时须同步核对原数据版本、候选minSchema与产物声明，避免Node已升级而原生检查仍固定6。以实际运行/发行元数据为依据，不能仅把多处数字各自递增后宣称兼容。
- 面向开发者的交付保持一个根npm清单：完善现有CONTRIBUTING及docs中的API/事件/SDK/打包与部署说明，CODE_OF_CONDUCT已有docs版本则直接引用，不建立职责重复文档。按实际安装后CLI验证model/plugin及维护入口，不能只展示源码开发命令；完整Goal缺项继续使用IMPLEMENTATION_STATUS，不另设平行状态清单。

## QQ媒体固定上游接口补充（规划证据）

root只读核对现有研究固定commit `98d781d19815d1625b24d717ce280ecf0a4f6d0c`，不复制受限许可上游实现。官方文档当前索引可能变化，实际适配以该源码及声明支持的版本为准：

- [GetFile.ts](https://github.com/NapNeko/NapCatQQ/blob/98d781d19815d1625b24d717ce280ecf0a4f6d0c/packages/napcat-onebot/action/file/GetFile.ts)接受file/file_id；base64取决于NapCat的enableLocalFile2Url，file/url可能都是NapCat主机本地路径，不是BFF可读取的路径或安全URL。未取得可用字节时明确缺项，不能读取任意路径代替。
- [GetRecord.ts](https://github.com/NapNeko/NapCatQQ/blob/98d781d19815d1625b24d717ce280ecf0a4f6d0c/packages/napcat-onebot/action/file/GetRecord.ts)调用GetFileBase后按out_format转换，支持wav/mp3等，转换后返回base64；转换依赖NapCat侧FFmpeg，不假设原始SILK可直接作为任意ASR输入。
- [UploadPrivateFile.ts](https://github.com/NapNeko/NapCatQQ/blob/98d781d19815d1625b24d717ce280ecf0a4f6d0c/packages/napcat-onebot/action/go-cqhttp/UploadPrivateFile.ts)和[UploadGroupFile.ts](https://github.com/NapNeko/NapCatQQ/blob/98d781d19815d1625b24d717ce280ecf0a4f6d0c/packages/napcat-onebot/action/go-cqhttp/UploadGroupFile.ts)经uriToLocalFile创建资源后直接sendMsgWithOb11UniqueId，返回file_id可为null。上传本身是实际外发，须经同一审批/目标/最终发送门，不另发送第二次，也不能用上传成功状态推断独立消息回执。
- [file.ts](https://github.com/NapNeko/NapCatQQ/blob/98d781d19815d1625b24d717ce280ecf0a4f6d0c/packages/napcat-common/src/file.ts)明确支持base64://解码；同时支持本地路径/URL，BFF不能透传后两者来绕过自身权限。[file-uuid.ts](https://github.com/NapNeko/NapCatQQ/blob/98d781d19815d1625b24d717ce280ecf0a4f6d0c/packages/napcat-common/src/file-uuid.ts)将UUID关联peer/msgId/elementId；BFF仍须把获取范围绑定已授权的入站账号、目标和消息，不提供任意文件ID查询代理。

以上仅接口研究，未使用真实QQ账号，也不等于媒体收发已实现或验证。

## Rework Implementation Report（F1/F2/F3）

rework_p7完整报告已由root读取，业务冻结，交新的独立验收；未改governance/Git/index。

### Summary / Files Changed / Root Causes

F1在PluginProcess增加同步revoke门，中止全部pending RPC拥有的宿主操作，再有界dispose和等待实际退出；清理期间拒绝新host，覆盖事件、初始化、工具。service disable调用同一门，保留代次/callId/权限及回退，不只扩工具operations。

F2由共用Web请求层维护认证状态，明确401 WEB_LOGIN_REQUIRED返回登录，退出catch，重新登录恢复；sessionGeneration拒绝旧会话迟到响应，网络/业务403不登出；errorText兼容Error.message与Desktop字符串。服务端认证无变化。

F3局部插件run以Promise链包住同步JSON解析和异步请求，catch/finally统一，非法配置/工具参数显示简体提示并释放busy，零请求且修正后可重试。无全站重构或依赖变化。

修改九文件：runtime/plugins/process.ts、service.ts、boundaries.test.ts；desktop/api.ts、App.tsx、components/Plugins.tsx；web/main.tsx；新增tests/integration/web-recovery.test.ts；docs/developer.md。

### Validation

Risk S3，限定三项直接边界。顺序：

1. 修前两复现按预期失败：事件停用80ms尚未abort；真实TLS/Chrome过期后无登录框。build/p7-evidence/rework-before.log保留。
2. 业务修改后build:web通过。`npx vitest run apps/runtime/src/plugins/boundaries.test.ts tests/integration/web-recovery.test.ts -t 'revokes|rollback preserves|recovers expired'`：三项RPC通过，disable/update/remove立即abort且700ms dispose未结束；初始化中止/清理中新host拒绝；工具取消/正常/错误结果及失败更新回退通过。
3. npm run typecheck、本轮八代码/测试文件定向ESLint通过。浏览器首轮因alert含关闭按钮而精确文本定位失败，修成role=alert内容定位，未改变行为断言；仅重跑`npx vitest run tests/integration/web-recovery.test.ts`通过。实际过期刷新/退出→登录→连接；网络失败/403保留；迟到旧401不影响新会话；非法JSON零请求、修正一次成功，pageErrors=[]。
4. 文档后build:node、Desktop前端及Rust release通过。同步dist后tauri bundle成功；115文件与portable/app资源逐SHA256一致，随包Node一致；diff空白检查通过。
5. 曾误在apps/desktop cwd运行资源复制，被PORTABLE_BASE_MISSING拒绝且未改资源；那次bundle用了旧portable。随后仓库根正确同步，再仅bundle、不重复已过编译。最终哈希属于修正后产物，失误未隐瞒。

### Artifacts / Cleanup / Limitations

build/p7-evidence/rework-final-artifacts.json含源码哈希/顺序/一致性。最终app路径apps/desktop/src-tauri/target/release/bundle/macos/BigFatFish.app，树SHA256 5b9890cdb2ed65f14e1bfa3a1d0e76e5a07e531f6bffb13d8bc83ec59ad5f38c；同bundle/dmg/BigFatFish_0.1.0_aarch64.dmg SHA256 ef637212287c318a6f0c6dacd29d6fbe427825040c2e73c5283a9931ae57d3de；build/portable树4150d7b5e14a2c25aa3a70e291848ca01d68fc072208d23e08670d04f7e0ba25；原生binary 98346e7b2232ac6042a78d91f80c30b7d1e38e9ca59687ece1e1b2354c346070。

rework-web-recovery.json和PNG、rework-*检查/构建日志保留；首轮final-artifacts/installed/native截图均保留为历史，不冒充新原生操作。本轮自有Runtime/网关/Chrome/插件进程及临时数据/证书私钥已清理，未原生启动或改desktop.json。RPC为实际进程和宿主signal，不是真实云中断；未重做P6/Linux/全媒体/三平台/原生矩阵。Windows/真实账号/云/正式签名发布仍无证据，无待用户决策事项。
