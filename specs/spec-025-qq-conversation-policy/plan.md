# Plan：QQ 对话与发送规则

## 风险与范围
S3：改变身份/受众、外发权限、持久配置及公共 API。仅验证受影响的QQ及直接调用链，不运行全项目测试/完整发行构建。

## 实施顺序
1. types/protocol 统一配置解析：唯一 ownerId、多好友允许列表、groupReplyMode；旧字段缺省兼容。入站按目标允许范围和群触发方式处理，owner判定必须同时核对真实作者和私聊，不能再把所有私聊标owner。
2. channels/service 使用现有交付/审计设施实现直接发送，保持最终范围/代次/健康/媒体/记忆检查；QQ ApprovalStore调用移除，历史不执行。需要时以普通模块/明确回调复用目标规则，避免多处复制。
3. 新QQ发送API/CLI/B站分享/插件channel.send走同一服务；废弃旧审批写操作，不能兼容映射为直接发送。插件声明/授权/最终发送期间取消要一致。
4. managed.configure 转交完整配置；QQConnection紧凑分组主人/好友/群触发，手填、多选及草稿保护保持。Channels组件改为直接发送与记录，App/Life仅移除QQ审批依赖，B站提示与真实返回状态一致。
5. 更新面向用户的QQ和开发接口文档、直接受影响的测试/smoke；不改无关平台逻辑。

## 检查计划
- 实施者统一执行一次 Node构建（相关集成测试使用dist），一次 apps类型检查。
- 更新并执行QQ协议、QQ集成/撤权与记忆、托管QQ设置、QQ媒体、B站分享、插件能力及受影响前端定向用例。按实际修改选文件/用例，不默认跑全仓。
- 特别证明普通群消息、好友与主人记忆隔离、撤权时最终不发送、直接消息结果未知不重试，以及旧审批入口不产生发送。
- root使用隔离fixture进行主人/好友/群模式/直接发送UI的有限桌面与380px目视，保存截图；不接真实QQ。
- 新独立验收审阅diff/既有检查与截图，不机械重复通过项。通过即停止并本地提交，无push。

## 决策与当前限制
见 Decision015。本轮用户已明确取消QQ审批，优先于旧Spec/constitution中的默认审批原则；仍保留其他平台审批及QQ目标/身份/媒体权限。用户报告的真实QQ回复是旧版本实测，本轮隔离验证不可写成真实账号验证。

## 实施报告
### Summary
已完成唯一主人、多好友私聊、群触发方式与QQ直接发送。QQ审批执行链及界面全部移除，旧接口明确返回410；抖音共用审批模块保持。业务源码已冻结，待新的独立验收。

### Files Changed
- `channels/types/protocol/service/routes`、`channels/managed/service`：friendIds（旧配置[]）、groupReplyMode（旧配置all）、统一目标范围、真实主人身份、直接发送与持久交付。
- `bilibili/service/routes`、`cli/channels`、`plugins/package/service/process`、`lifecycle`、`plugins/sdk/host.mjs`：共享发送服务、新channel.send授权、旧channel.propose废弃错误、最后外发时插件代次/取消复核。
- `connection.ts`与Tauri `main.rs`：QQ发送及直接调用链支持有界较长等待，最长健康检查10秒+文件30秒；发送/分享/插件call的Runtime socket为45秒并在回包恢复默认，CLI/Tauri直发50秒。插件拥有channel.send时tool/event调用45秒，其余沿用10秒。
- `QQConnection/Channels/Workspaces/App/Life/Bilibili/api`及局部CSS：主人/好友/群分组，手填与多选，模式选择，直接发送和实际结果、记录；QQ从全局审批轮询/抽屉移除。记录`proactive`返回布尔值。保留原草稿和revision保护。
- QQ/B站/开发指南、README/SECURITY/ARCHITECTURE直接相关说明、CLI smoke及受影响测试同步。

### Important Decisions / Root Cause
旧ownerId兼任身份和接收白名单，且`private`直接被判断为主人；新增好友后必须在Runtime按真实作者重新判定owner，否则会泄露主人记忆。好友与群沿用外部受众及共享撤销guard，所有入口复用allowsTarget。QQ审批同时被B站/插件/CLI调用，故从服务层替换成直接发送，再迁移调用方，不能只删除界面。保留最终状态/权限/健康/媒体检查与未知结果不自动重试；旧审批数据保持但无执行入口，旧插件提案许可不升级为外发许可。没有schema或依赖变化。

### Validation
- Risk Level: S3，限QQ身份/外发及直接调用链。
- `npm run build:node`通过；因后续插件event时限及RPC废弃错误传递变动重建，最终版本通过。
- `npx tsc -p build/qq-conversation-policy/tsconfig.apps.json`通过（忽略目录临时配置，仅apps）。常规`npx tsc -p tsconfig.json`只报两个未修改测试文件的三处既有问题：`desktop-dev.test.ts:132`两处build可能undefined，`model-connection-http.test.ts:91`initialConfig.requestTimeout类型不存在；未扩修。
- `cargo check --manifest-path apps/desktop/src-tauri/Cargo.toml`通过，无安装包构建。
- 定向QQ/protocol/managed/media批次：12通过；包括主人私密记忆、好友仅共享、群普通消息、仅@、拒绝未选对象、自身/重复事件、撤权竞态、旧审批不执行、媒体和失败/未知不重试。旧完整B站观看用例因未配置ffmpeg跳过。
- 插件新增直接发送用例1通过：旧提案明确失败、旧权限不能send、升级必须重授权、直接发送成功、最终健康检查期间插件停用阻止外发；废弃错误RPC变更后仅重跑该相关用例并通过。
- B站新增直接分享用例1通过：模拟已理解任务结果，真实Runtime API→QQ协议发送给允许好友，未授权群拒绝、不创建审批。未冒充完整视频观看验证。
- `node scripts/smoke-qq.mjs`通过：构建后CLI/Runtime/插件真实隔离配置、在线、直接发送、记录与停用。
- `git diff --check`通过。没有全量测试、全量lint、发行构建或真实QQ外发。
- root已提供CUA视觉结果：桌面/380px多好友保存、手填保值、群模式保存、sent/unknown显示及不自动重发；证据`build/qq-conversation-policy/01-direct-send.png`、`02-send-unknown.png`、`03-narrow-friends.png`、`04-narrow-manual-group.png`。实施者未重复采图。

### Known Limitations / Remaining Questions
真实QQ新行为、Windows实机与安装包未验证；当前用户后台未重启。全项目类型检查的既有测试错误仍在。`desktop-webui.test.ts`已移除QQ审批断言、保留抖音审批检查，本轮使用root的CUA定向验证而未跑该完整浏览器测试。无Git写操作；没有创建子Agent。无需求待确认项。

## Root 视觉验收记录
CUA使用当前源码与隔离假账号fixture，检查1000px桌面和380×820窄屏。主人20002、多好友20003/20004和groupReplyMode=mention经表单提交后从fixture服务端读取，均符合输入；结束前展示普通消息模式。窄屏document.scrollWidth=380；设置/记录Card的scrollWidth与clientWidth均331；账号与动作控件高40px，长昵称换行无溢出。手填/好友选择切换保值。

两次不同的假消息分别返回sent和unknown；界面/记录分别呈现已发送与未知提示，没有审批动作，fixture始终只有2条记录。未连接真实QQ。最终完整设置图为`build/qq-conversation-policy/05-desktop-final.png`，01–04为直接发送/未知反馈/窄屏好友/手填群模式证据。UI冻结后未修改对应源码，不重复已通过验证。临时服务8504与tab7已关闭，viewport恢复。
