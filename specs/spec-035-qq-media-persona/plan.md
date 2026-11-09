# Plan

## 实施顺序
1. Channels.reply 移除自动引用；保留所有原发送与引用输入处理。
2. managed/service onebotConfig 开启 enableLocalFile2Url；QQ 插件 get_image 获取原安全标识的图片。媒体错误按已知安全原因区分获取/格式/识别，不暴露原始错误、凭据或路径；成功图片内容标注已读取，不诱导模型重复称看不到。
3. persona-presets 原创强化 daughter；persona-prompt 允许自然角色情绪，不将事实约束误解为只能客服式表达，后台分支保持。不要对所有自定义人格强加鱼粮人设。
4. 相关夹具按 NapCat 实际开关模拟缺失/存在 base64；检查私聊/群聊不引用与媒体真实 wire，补必要缺失返回/取消回归，保留原授权测试。docs/qq.md、docs/ai-core.md 按需最小同步。
5. 协调 Agent 在验收后应用当前匹配旧 daughter 的配置（仅既有 API，不直接写库）；记录版本、保留字段、是否需要重新启动开发环境。

## 证据与根因
- 2026-11-05 只读当前 Runtime 和数据库：chat 使用 deepseek-v4.1-flash，当前 persona v3 为原 daughter；仅输出媒体标识形状，不输出图片、消息内容或凭据。
- 当前托管 onebot11.json 的 enableLocalFile2Url=false；真实最近图片 get_image 成功却无 base64，大小 1,706,768 字节。该配置与插件只接收 base64 的契约矛盾，是已证实原因。
- 上游固定版本源码：[GetFile.ts](https://github.com/NapNeko/NapCatQQ/blob/9335843246e3b7a17944861f3ac8731a259732c2/packages/napcat-onebot/action/file/GetFile.ts)、[GetImage.ts](https://github.com/NapNeko/NapCatQQ/blob/9335843246e3b7a17944861f3ac8731a259732c2/packages/napcat-onebot/action/file/GetImage.ts)、[GetRecord.ts](https://github.com/NapNeko/NapCatQQ/blob/9335843246e3b7a17944861f3ac8731a259732c2/packages/napcat-onebot/action/file/GetRecord.ts)。已实际获取阅读，未复制源码。
- [百炼 DeepSeek API](https://help.aliyun.com/zh/model-studio/deepseek-api) 列出当前模型支持图片；本次不改模型或通过换模型掩盖获取错误。

## 验证计划
S2，QQ 托管配置→协议→图片识读与聊天提示相关模块交互，未改变安全策略、schema 或公共 API。运行一次 build:node 作为当前插件分发资源与集成夹具准备（相关测试从 dist 读取内置插件），然后运行最相关媒体、QQ回复、人格与必要托管配置定向测试。不默认全量测试/lint/桌面build/打包/UI。独立验收审阅证据不机械重跑；发现具体失败才扩大相关范围。

真实只读 get_image 已完成；不发送测试 QQ 或消耗付费模型来充当验收。当前托管配置生效与人格保存可按本次修复授权处理；保留用户数据，不擅自终止无关进程。

## Git 与交接
dev 基线8754b08，开始干净；root 维护治理文档并应用当前配置，单个实施 Agent 改业务和最小相关测试，之后新独立验收。持续每阶段本地commit授权有效，root验收后提交；不push/PR/merge，远端未刷新。

## Implementation Report

### Summary
QQ 自动回复移除原消息引用，保留文字和可选表情的同次发送。托管 NapCat 配置启用图片 base64 返回，插件改用 get_image；收到图片或语音后，输入中准确区分已读取、内容未取得、格式不支持、超过限制和识别失败，避免把收到但没读成功描述为用户没有发图。

女儿感更新为有情绪变化的小馋鱼，包含护饭盆、被扣鱼粮顶嘴、被夸得意、搞砸后补救等原创例句；token 是鱼粮的表达明确为角色梗，不编造余额。统一聊天提示允许自然情绪，后台仍隔离闲聊角色字段，其他预设与自定义字段保存逻辑不变。

### Files Changed
- `apps/runtime/src/channels/service.ts`：无引用回复、准确媒体上下文、异常后再次检查取消与授权。
- `apps/runtime/src/channels/managed/service.ts`：Mac/Linux/Windows 共用配置开启 enableLocalFile2Url，初始文件与登录后设置共用。
- `plugins/qq/index.mjs`：图片使用 get_image；原 32 位哈希引用、认证账号、generation/guard 和字节约束保持。
- `apps/runtime/src/ai/persona-presets.ts`、`persona-prompt.ts`：女儿感与聊天情绪表达。
- `tests/fixtures/onebot.ts`、`tests/integration/p7-media.test.ts`：NapCat 按开关返回图片字节、真实 DSH 图像 wire、缺失/无效/超限/路径拒绝、获取过程中取消和输入引用元数据回归。
- `tests/integration/qq.test.ts`、`qq-stickers.test.ts`：私聊、群聊和带表情回复无引用；原身份/记忆/去重/撤权/发送未知检查保留。
- `tests/integration/managed-qq.test.ts`：初始配置和登录配置均返回图片字节。
- `docs/qq.md`、`docs/developer.md`、`docs/ai-core.md`：当前回复、媒体条件与人设说明。
- 本 Plan 的实施报告；未改协调 Agent 的其他治理文档和用户真实数据。

### Important Decisions
根因是组件管理层关闭了插件所需的返回字段；修复该层的统一配置可同时覆盖 Docker 与原生启动，不在媒体调用点绕过安全边界读取容器路径或下载 URL。GetImage 在固定原版中继承 GetFileBase，语义改名不会改变底层字节契约。媒体失败仍允许对当前消息给出文字反馈，但取消、停用或撤权在 catch 先复核，不能继续生成或发送。

已有自定义人设不自动迁移，当前用户人格的版本化应用由协调 Agent 完成。本次只改源码与本地分发资源；已安装到用户插件目录的旧插件不会被静默覆盖，旧 get_file 在固定 NapCat 中同样受 base64 配置控制，仍可受益于本次托管修复。

### Validation
- Risk Level: S2。
- `npm run build:node`：退出 0，通过一次；Node 类型与用于集成测试的插件分发资源已更新，未运行全项目或桌面构建。
- 首次定向命令：`npx vitest run tests/integration/p7-media.test.ts tests/integration/qq.test.ts tests/integration/qq-stickers.test.ts tests/integration/managed-qq.test.ts tests/integration/persona.test.ts apps/runtime/src/ai/persona.test.ts -t 'real ASR/TTS|real DSH QQ channel|real DSH sees actual tool image|one-action connection|applies|separates owner|keeps conversational|keeps existing personas|sends current persona'`。
- 首轮 12 项中 10 项通过，2 项失败均为新增测试输入问题：ASR 请求没有 body，图像请求统计需处理 undefined；给原 QQ 私密记忆用例加入引用改变检索输入，故将输入引用验证移到媒体用例，QQ 恢复原检索刺激。没有修改业务实现来掩盖测试失败。
- 仅重跑失败两项：`npx vitest run tests/integration/p7-media.test.ts tests/integration/qq.test.ts -t 'real ASR/TTS|real DSH QQ channel'`，退出 0，2/2 通过（9.30 秒）。累计目标 12 项全部通过，未重跑其余 10 项。
- 媒体用例证实：关闭内联字节时没有 image_url 请求且输入承认收到图片；生产配置开启后真实 DSH 发出一次 image_url，WAV 转写保留；格式/2 MB 超限/不安全路径失败准确，获取中禁用后 CANCELLED 且不再调用模型或发送。私聊/群聊/表情实际协议夹具输出均无 reply 段。
- 人格原 8 项用例通过，涵盖预设保留身份和边界、版本冲突与历史、实际 DSH 原会话续聊切换、好友身份、记忆提取与活动格式隔离。模型是本地 fixture，不能据此声称真实模型口吻体验已经验收。

### Known Limitations
未调用真实 QQ 发消息或付费模型，未改当前用户配置，未进行 UI、Windows 实机或发行打包验证。当前开发会话重启与人格应用由协调 Agent 接续，真实图像字节读取证据另记，不把代码和夹具验证等同真人聊天体验。

### Remaining Questions
无实施阻塞，等待新的独立验收 Agent。未切分支、commit、push 或操作 PR。

## 当前实例应用（协调 Agent）
- 代码经独立 Agent 预审无业务阻断后，通过既有 `/v1/persona` GET/PUT 完成 v3→v4。写入前与本轮保存的旧配置完整对比，避免覆盖用户期间改动；仅应用新 daughter 五字段，name/avatar/boundaries/schedule/autonomy 完全保留；人格历史中完整 v3 仍在。
- 原 Runtime 88854 与 supervisor 88829 经命令、父子关系和仓库工作目录核实，无在途聊天或 QQ 投递后正常 SIGTERM 退出；随后启动标准 `npm run desktop:dev`，当前 owned session54454、Runtime39037，原生程序启动。命令自带 Node 资源准备属于加载修复后的开发程序，没有重复运行测试或额外全量构建。
- 恢复同一保存范围的 QQ component/connect；组件重启后要求重新扫码，原账号快捷登录未成功（只匹配已保存账号，不改账号/权限/凭据）。用户第一次反馈已登录后，当前组件仍实测 waiting_qrcode/isLogin=false/coreReady=false，因此未宣称恢复在线或图像字节已验证。已请用户在新开发窗口确认扫码；后续结果追加。
- 脱敏应用证据位于忽略目录 `build/qq-media-persona/live-evidence.json`，不提交用户配置或凭据。没有通过真实消息发送或付费模型补充测试；既有已安装 QQ 插件保留，固定 NapCat 的旧 get_file 同样使用启用后的 base64 配置，不为语义别名覆盖用户插件。
- 用户随后确认当前二维码及手机登录后，实测 Runtime39037 的 QQ enabled=true、health=online、component.phase=online，恢复原保存范围完成，无需再次确认。托管生成配置 enableLocalFile2Url=true。对重启前那张图片的原标识执行只读 get_image 返回 failed/retcode1200，没有字节；因此本轮不能把真实图片读取或模型识图写成通过。新图片需要用户再次发送验证，此限制不取代已通过的真实 DSH/OneBot 本地契约回归，不扩展为路径/URL读取兜底。
- CUA 为核对扫码状态查询过应用清单，当前 debug executable 无可选 App 绑定，未执行 UI 操作或新建浏览器标签；不声称做过原生 UI 验收。开发会话54454按用户使用目的保持运行。

### 文档同步补充
独立审阅期间发现 docs/developer.md 的发送段还残留旧引用说明，现同步为自动回复直接发送文本、不引用原消息，可按语境附带一张表情。S0，仅审阅这处文案 diff，未改业务或重复运行测试。
