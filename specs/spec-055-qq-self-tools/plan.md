# 实施与验证记录

## 范围与顺序
基线 dev / 655d75e，开始工作区干净。用户本轮未授权 commit 或真实 QQ 写入。S3，关联模块交一个实施 Agent 串行完成，再由新的独立验收 Agent 验收。

1. 核对固定 NapCat 4.18.42 协议，扩展最小命名适配方法与返回校验，保持现有托管组件/凭据隔离。
2. 抽出当前聊天互动和自身账号工具，绑定目标与真实主人身份；复用已查看图片和本地素材，不开放任意路径/URL供协议端代读。
3. 实现有界的写操作持久账本、去重/限额/未知结果/取消与恢复，接入后台自主判断。重启、撤权和全局活动暂停必须停下后续 I/O。
4. 增加简洁自主设置与异常记录，兼容原托管/外部配置及备份恢复，更新使用文档。
5. 仅运行相关协议/身份/自主任务/持久化/前端检查，隔离实际调用链；独立验收复用有效检查。

## 上游依据
官方接口概览 https://napneko.github.io/onebot/api 。固定版本 https://github.com/NapNeko/NapCatQQ/releases/tag/v4.18.42 ，对应 revision `9335843246e3b7a17944861f3ac8731a259732c2`。主分支已另查，但实施以固定版为准。只参考公开接口，不修改或复制发行 NapCat 源码。

已读取的固定版17类接口源码缓存在忽略目录 `build/qq-tools-research/napcat-4.18.42.json`（含精确URL和源码，仅供调研）。覆盖 SendQzoneMsg/GetQzoneMsgList/GetQzoneProfile/SetQzoneProfile、SetQQAvatar/SetQQProfile/SetLongNick/GetStrangerInfo、历史/消息/撤回/点赞/群名片/消息回应等。

`send_qzone_msg` 接收 content、images 和 ugc_right，1=公开、4=好友、64=仅自己；返回 tid/time。图片使用验证后base64避免容器路径问题及任意协议端读取。`set_qq_profile` 的 nickname 必填，partial更新应先读当前资料保留其它字段。`set_qq_avatar` 返回null，不能仅凭null宣称头像视觉回读已核验。

## 风险与计划检查
定向覆盖：跨聊天历史/撤回拒绝、他人消息不可撤回、主人身份伪造拒绝、资料回读失败与发布无tid、图片来源及大小、并发/重启去重、网络未知不重试、关闭/暂停/账号切换阻止后续请求、私人上下文不进入自主发布、恢复默认暂停。UI用隔离夹具核对控件/错误/内部滚动与窄屏；不以浏览器夹具声称真实账号已发布。

## 实施报告
实施完成，待新的独立验收。业务修改未提交，未启动用户数据目录、未重启真实 QQ、未调用收费云模型或真实账号写接口。

### 最终实现
- 新增 `channels/interaction-tools.ts`：当前聊天历史、引用原文、自身撤回、自己群名片、当前发言人点赞和消息回应。读取结果裁剪为文本和必要身份；历史固定当前目标；任意消息ID不能跨聊天查询，私聊自身发送者不能独自证明目标。撤回须再查实际发送者。
- 新增 `channels/self-tools.ts`：QQ 昵称/签名、头像、空间资料及发布。主人私聊和独立后台任务才得到全局资料工具；最近动态正文只在主人私聊提供，普通好友和所有群聊不开放。图片必须实际展示成功，协议只传已验证字节；后台仅内置素材，主人回合可用本轮实际看过的入站图片或表情。
- 新增 `channels/action-state.ts`、`autonomy.ts`：账号级开关/revision、定时判断和写操作账本。在线且有聊天模型后每小时判断一次，日最多6次；说说最多2条，QQ资料/头像/空间资料各1次。写前占位，未知结果不重放；关闭、暂停、退出、账号/配置变化中止后续 I/O。重启把未完成写标为未知。可变资料允许 A→B→A，不把过去成功当现在状态；同一回合相邻重复调用复用结果，改变后恢复旧值会真正执行。
- `ChatService.liveQQ` 使用原人设、新的临时 DSH 会话和当前心情标签；没有私人聊天/记忆/日记的加载器，不持久化为桌面对话。全局活动暂停同步取消正在等待模型的自主任务。模型可不做动作并结束，工具执行完成后的空最终文本不被判为模型失败。
- 原版 QQ 插件只增加命名动作白名单；调用前验证在线和真实账号，guard 在最后网络写入前再检查。匹配固定4.18.42接口；内层 result=false/非零错误码不误报成功，发说说必须有 tid，资料回读不一致为结果待核实，头像只说明服务确认。
- Schema 14 新增 `qq_self_options`、`qq_self_clock`、`qq_operations`。备份包含开关与操作账本，不带待执行时钟；支持旧 schema13（仍兼容6–12），恢复/回滚默认关闭自主写，旧备份也通过恢复标记保持关闭。
- QQ 新增紧凑「自主活动」页；两个开关和说说可见范围（默认好友）。消息页合并动作失败/未知记录，仅最近20条，继续内部滚动。正常未配置显示就地状态，不制造顶部错误。使用指南同步能力、额度和验证边界。

### 实际验证证据
风险 S3（持久化、身份权限、平台写入和后台执行），仅运行相关链路。各用例在修复后分别通过，不宣称一次全量套件通过。

1. `npx vitest run tests/integration/qq-self-tools.test.ts -t 'binds real'`：最终 1 passed / 3 skipped（2026-11-07 21:40，299ms）。真实本地 OneBot WebSocket + 原 QQPlugin + 生产工具模块；覆盖当前目标、未知/跨范围引用拒绝、非自身撤回拒绝、自身撤回幂等、当前人点赞、消息回应内层false、资料保留原签名、私密扩展字段裁剪、未看图拒绝/已看图base64、好友可见、无tid未知且不重试、写前撤权，以及同回合群名片 A/A/B/A 实际仅发 A/B/A。
2. `npx vitest run tests/integration/qq-self-tools.test.ts` 中「persists unknown writes…」用例通过：持久未知结果在新 state 实例仍阻止重发，可变值 A→B→A，日额度，真实持久时钟日6次，暂停与等待中取消阻止写。该次另一条测试曾因未定义空最终文本成功语义失败；已修复 `liveQQ.acceptEmpty`，相关用例随后通过，不以那次整文件运行作整体成功证据。
3. 同文件「runs real DSH autonomous tools…」用例在修复后通过（session 17866）：真实本地模型 HTTP 夹具 + DSH + OneBot；模型协议真实调用 profile/posts/post；请求不包含种入的私有日记、个人扩展资料和动态评论；新备份及无新增表的 schema13 备份恢复后自主开关关闭。该次另一个用例的重复错误文案断言不匹配已经修正，并在第1条最终通过。
4. `npx vitest run tests/integration/qq-self-tools.test.ts -t 'binds real|registers global'`：2 passed / 2 skipped，30.91s（session 48633）。运行真实 Runtime、认证API、QQ WebSocket和 DSH 本地模型；主人私聊/好友私聊/主人在群里三种工具集合验证；将持久到期时间提前但保留生产30秒定时器，不再发消息时实际触发说说动作；真实API保存关闭开关。随后只更改了回执校验和回合缓存，分别由第1条覆盖，无须重复等待定时器。
5. `npx vitest run tests/integration/qq-self-ui.test.ts`：最终 1 passed，1.52s（session 68356）。真实浏览器+隔离API、900/380宽度；设置保存和可见范围、仅20条问题、无横向溢出、内部滚动及 overscroll containment。最终截图 `build/qq-self-tools/ui-900.png`、`ui-380.png` 已由实施与根协调实际目视，控件对齐，窄屏无裁切。夹具只修正自身宽度与截图时机；未宣称原生/Windows验证。
6. `npx tsc -p tsconfig.node.json --noEmit`、`npx tsc -p build/tsconfig.qq-ui.json` 通过（session 31872）。后者限定 desktop/web 生产源码。之后仅回合缓存去重局部修复（第1条覆盖）、删除未使用的重复计算/Map、夹具截图与文档修改，未重复已通过的类型检查。
7. 最终 `git diff --check` 通过。没有运行全仓测试、全量 lint、完整安装包构建，也没有再调用真实收费模型或外发。

### 发现并修复
- DSH 工具完成但没有最终文本时原先报 MODEL_RUN_FAILED；自主回合现在允许空文本结束。
- 外层OneBot OK、内层表情回应 false 原先可能被当成功；已按固定协议识别拒绝。
- 成功历史曾会阻止可变资料恢复旧值；持久账本和同回合缓存都按实际可变动作修复，A→B→A有协议证据。
- UI夹具最初自身收缩且整页截图产生拼接观感；改为实际内容宽度、900/380视口截图，重新目视，不修改生产布局去迎合夹具。

### 边界与待验
- 不代表真实 QQ 头像、资料、说说已生效。当前托管4.18.42有对应协议，但账号风控/真实上游表现仍需用户后续实际使用核验；旧外部服务缺接口返回明确不可用。
- 头像无可靠视觉回读，只报告服务接受；超时、断线或缺tid的操作不会自动重试。未提供“强制重发未知操作”的入口。
- 自主判断失败不会立即重试，等待下一有界时段；模型没有产生写动作不会塞入操作记录。说说内容重复由持久哈希阻止；只有主人私聊能读自己的最近10条动态，自主任务没有历史正文读取工具。
- 自主任务没有私人会话素材；主人明确要求的资料写入发生在主人私聊回合，仍受开关、限额、图片验证和固定可见范围约束。群里主人也拿不到全局账号写工具。
- 首轮独立验收因旧说说正文来源隔离判 FAIL（R1）；返工见下，Spec验收框保持未勾选，等待新的独立验收。


## R1 返工实施报告

2026-11-07，新的实施 Agent `rework_qq_self_privacy` 仅处理首轮验收 R1；实现和定向验证完成，代码冻结，待新的独立验收。没有修改原 `acceptance.md`。

根因是主人私聊与可公开发布的自主任务共用同一个工具集合，历史说说裁剪保留正文但无法证明可见范围。修复位于工具构造/注册层：`selfTools` 必须由可信调用点传入 `owner` 或 `autonomous`，只有前者注册 `get_qzone_posts`。`Channels` 的自主回调显式传 `autonomous`，已验证主人私聊分支显式传 `owner`；角色不来自模型参数。自主任务既拿不到工具，也不向上游请求历史正文，不依赖提示词或 `is_private` 筛选。主人私聊的读取能力保留；既有持久发布指纹、限额与可见范围不变。

本次修改仅六个文件：`apps/runtime/src/channels/self-tools.ts`、`apps/runtime/src/channels/service.ts`、`apps/runtime/src/ai/chat.ts`、`tests/integration/qq-self-tools.test.ts`、`docs/qq.md` 和本 Plan。自主提示词删去读取已有动态的引导；使用指南明确只有主人私聊可读最近10条动态。没有改 UI、调度器、账本、Schema、恢复或其它互动工具。

风险仍为 S3 的隐私输入边界，验证缩至直接受影响的一条既有链路：

- `npx vitest run tests/integration/qq-self-tools.test.ts -t 'runs real DSH autonomous tools'`：2026-11-07 22:01，**1 passed / 3 skipped，1.18s**，session 63531。
- 上游 OneBot 夹具同时包含 `is_private:true` 的私密正文和 `is_private:false`、实际范围未知的正文标记；生产 `selfTools('autonomous', …)` 经 `ChatService.liveQQ`、真实 DSH 和本地 HTTP 模型完成资料读取与发帖。模型各次工具列表均无旧动态读取能力，OneBot 历史正文查询为0，两个正文标记及私人日记/额外资料均未进入模型请求；发布协议仍为设置固定的好友可见 `ugc_right=4`。随后生产 `selfTools('owner', …)` 注册并实际读取两条正文，查询固定当前账号，评论仍被裁剪。
- 保留此既有用例原本的备份恢复断言，没有另跑备份、30秒定时器、UI、全量类型或其它已通过的用例。首轮的其余有效证据继续复用。

本地协议夹具不代表真实 QQ 发布/资料生效；未调用收费模型，未触及用户数据目录，未重启真实 QQ，未 commit/push。实现层没有 R1 未决问题，最终结论由新的独立验收给出。

## 最终交付

2026-11-07，新的独立验收 Agent `accept_qq_self_privacy_r1` 在 [acceptance-r1.md](acceptance-r1.md) 判 **PASS**。协调 Agent 完整读取并处理报告，唯一 R1 已关闭，原未变范围复用有效证据，无待返工。Spec 更新为 Done，停止追加检查；本轮代码未提交。

现有安装的启用步骤已补入 QQ 指南：重新运行 `npm run desktop:dev` 生成新内置包，在「设置 → 扩展」选择 `dist/runtime/plugin-catalog/qq.bff-plugin` 并「安装或更新」，再检查 QQ 连接。当前 Runtime 仅自动安装缺失插件，不自动覆盖已安装版本。没有为了启用而修改真实数据、重启会话或执行真实写操作。
