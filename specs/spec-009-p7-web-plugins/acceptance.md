# Acceptance

## Result

PASS。新的独立accept_p7_rework完整报告已由root处理。F1/F2/F3已修复，无本轮直接未解决问题；保留首轮其他已审阅结论。仅为P7本地代码与返工验收，不表示完整产品或全部平台交付。历史FAIL保留下方。

## Spec Coverage

- F1：process.revoke同步中止所有pending宿主信号，message拒绝撤权后的host；service在dispose前调用，更新/卸载同路径。事件/初始化/工具均覆盖，正常/错误返回、取消、代次/callId/权限、实际退出与失败回退保持，位于RPC生命周期正确职责层。
- F2：明确401 WEB_LOGIN_REQUIRED触发共享未登录状态，Login订阅，退出catch；代次检查先于响应处理，旧请求不影响新会话；网络/普通403保持登录，Error.message和Desktop字符串错误映射正确，服务端边界未放宽。
- F3：Promise.resolve().then(fn)统一同步解析和异步请求catch/finally，配置/工具参数两个调用点覆盖，简体提示与busy释放正确。
- 唯一Runtime、目录、单根npm及非OS沙箱/即时撤权/会话恢复文档一致。首轮其他Spec项与外部证据限制保持。

## Validation

- Risk Level: S3，限定共用撤销、认证状态及直接表单回归。
- 阅读治理、两轮完整实施报告、首轮FAIL、rework、Decision、直接源码/diff/测试/构建记录。
- 复核既有真实RPC：disable/update/remove在80ms已abort而700ms dispose未结束；初始化、清理拒绝新host、取消/正常/错误返回/失败回退有通过记录。
- 复核真实TLS/Chrome：过期刷新/退出/重登连接、网络/403保持、迟到旧401保护、非法JSON零请求/修正一次成功、pageErrors=[]。工具参数错误仅共用代码审阅，未冒充新增浏览器实测。
- 本验收实际只读核对九个返工文件SHA256与最终记录全部匹配，关键process/service/Web server/index/Node在dist/portable/app匹配。115全文件一致性复用实施证据；未重复测试/build/lint/typecheck或整个app/DMG重算。

## Issues

无阻断问题；root据此更新阶段状态。

## Regression Risks

未重新执行原生、P6/Linux、全媒体、三平台矩阵。Windows/真实账号/云/正式签名公证/发布仍缺实证，抖音私信/分享/投稿wire仍未完成，不能由此PASS覆盖。

## Required Rework

无。本验收未改业务/治理/Git/index或创建子Agent。验收时dev/a0e8f61、P7未提交，由root执行已授权本地commit。

---

# 首轮验收历史

## Result

FAIL。首轮独立accept_p7完整报告已由root读取。主要功能和交付证据成立，但立即撤销、会话恢复及配置错误处理不满足Spec；P7未提交。验收只读，无业务/Git/index改动或子Agent。

## Spec Coverage

- 类型/Lint/相关测试/构建/运行：已审阅实施报告、测试与安装证据，未重复执行。
- Web真实管理与错误恢复：主链成立，会话过期恢复失败（F2）。服务端认证/CSRF/Origin/Host/WS、过期撤销及代理检查有源码与负例；本轮实际过期401，无认证绕过。
- SDK外部目录全生命周期：实现/证据成立，但事件宿主操作撤销不即时（F1）；包验证/新目录/旧状态快照/增权暂停/回退已审阅。
- SDK/API/许可/文档：主要一致，准确披露非OS沙箱；停用终止宿主请求说明需F1支持。
- 模型/ASR-TTS/QQ媒体：实际消费者、格式/预算/超时/信号、安装资源、入站ID关联、base64、审批后单次upload及引用回复已核对；云和真实QQ未验证。
- DSH工具：实际消费结果及local-owner/audience双门、shell/fs拒绝有证据；共用撤销边界受F1影响。
- 全阶段状态：Windows/账号/云/签名发布及抖音未实现协议仍准确保留，无完整产品宣称。

## Validation

- Risk Level: S3。
- Evidence Reviewed: AGENTS/mission/tech-stack/全部rules、Spec/Plan完整报告/Decision/交接/开发文档；Web配置认证代理维护、SDK包/RPC/生命周期、DSH/媒体/QQ/平台加载停用、schema6归档diff、相关测试/构建；build/p7-evidence的installed.json/final-artifacts.json及原生工具/音频AX。未冒充新一轮原生操作或重算整个app。
- 最小复现1：外部临时插件经真实PluginProcess事件RPC发起宿主请求，dispose延迟1.5秒；停用152ms enabled=false但hostRequestAborted=0，1503ms才abort。
- 最小复现2：临时Runtime、实际TLS网关、隔离Chrome，缩短测试会话期限，实际登录/过期/刷新连接/退出。结果loginFieldsAfterLogout=0、logoutButtons=1、alert="操作失败：Error: WEB_LOGIN_REQUIRED"、pageErrors=["WEB_LOGIN_REQUIRED"]。
- 仅上述两项具体疑点运行，未全量test/build/lint/typecheck；临时数据/证书/进程已清理。

## Issues

### F1 [P1] 非工具RPC内宿主能力未立即撤销

service.ts:19事件直接process.call，不登记工具operations；:42 disable改enabled/generation并仅abort工具，再await dispose；process.ts:20 stop才abort所有pending。事件→host media→disable→慢dispose→stop期间宿主请求仍存活。实测152ms未中止、1503ms中止。ASR/TTS使用相同传入signal，故网络请求同样可能延续；并非真实云调用证据。禁用/卸载/更新同路径受影响。先撤销Runtime宿主能力，dispose可以有界清理；不涉及声称OS隔离。

### F2 [P2] Web过期不能从界面重回登录且错误翻译失效

App.tsx:23退出仅logout成功后reload且无catch；api.ts:6抛Error；web/main.tsx:6 ready仅启动和登录设置，401不复位。服务端正确401，退出也401，用户无登录框且未捕获异常，只能手工刷新整页。errorText用String(Error)多出Error前缀，不命中中文映射。修统一认证状态/请求错误提取，兼容Desktop字符串；网络暂断不能直接登出。

### F3 [P2] 插件非法配置JSON使busy永久为true

Plugins.tsx:5 run先setBusy(true)后直接fn()；启用回调JSON.parse同步抛错发生在catch/finally链建立前。配置为“{”后点击授权，fail和busy清理均不执行，按钮持续禁用直到卸载。直接源码证据，未额外复现。同步解析与异步请求应共享错误捕获/清理，失败可编辑重试，非法配置不能发出。

## Regression Risks

F1覆盖事件/初始化等所有非工具RPC，保持代次检查、正常/错误返回取消、实际退出及回退；F2区分401与网络断开，不放宽服务端；F3保持可重试。返工后发行资源需更新，当前哈希不代表新产物。外部门槛独立于上述本地缺陷。

## Required Rework

新实施者按rework.md修三项，做直接必要检查并同步产物，再新独立验收；不重演未影响全矩阵。当前dev/a0e8f61，P7未提交，未push/发布。
