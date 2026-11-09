# Plan

## 范围与顺序
EXISTING，dev f321344。A：独立调研已完成，单实施 Agent 先改 QQ 回合配图策略与近期用图；协调 Agent 同时只读原生 UI 截图审计。B：审计后补具体改动清单，再实施。最终新的独立 Agent 验收，FAIL 按项目规则用新实施/新验收返工。

## A 调研与实施约定
普通消息已有工具；缺口是负向描述与无跨轮历史。channels/service.ts → ai/chat.ts 可信内部参数进入 EngineInput.context；sticker-turn.ts 正向描述与近期标记；sticker-network.ts 截取前兼顾贴切与新鲜。近期记录放 Channels 所属的有界普通模块，按账号/目标隔离，不持久化、不更改人格。只对真实 sent/unknown 记使用；unknown不伪造成功。保留 receipt、最多一张、预算、来源和最终发送守卫。

S2：围绕普通消息策略注入、非QQ隔离、近期排序/范围/投递状态做必要定向检查；如使用已编译插件夹具需要 build:node 则可一次构建。不运行全项目套件。既有看图/撤权关键回归仅相关用例，不重复已通过检查。

## B 原生审计方式
原始 cargo debug 进程不被 CUA 识别。build/desktop-ux-audit/BigFatFishAudit.app 复制当前已编译 binary，Info.plist 配置托管开发标记与原数据目录，仅额外打开 UI，不重启现有 Runtime/QQ；使用现有 Vite 源码。截图存 before/after，初始900×680。不保存设置或触发外发/模型。

原生后台窗口动画会暂停，AX 已变时截图可能尚无内容；先 Raise 前置，区分未完成动画截图与实际页面，不把其当永久空白。

## 研究依据
- https://aigengtu.com/persona ：社区将表情作为情绪表达，并非等待明确索要；仅借鉴行为，不复制整卡或引入其它框架工具。
- https://www.nngroup.com/articles/progressive-disclosure/ ：常用操作先呈现，低频功能按需打开。
- https://www.nngroup.com/articles/visibility-system-status/ ：交互后及时、就近给出可理解反馈。

## B 实施清单（原生实际截图与AX依据）
- before/01-chat：首次进入自动选中QQ群、对方消息显示「你」、仍有常规发送输入，产品身份与可操作性误导；Chat默认本地、外部只读和准确发言者。
- before/02-fish-overview：整段系统人设展示、多个空卡片和后台词汇挤占首屏；改为姓名/简短状态和实际内容，不制造数据，空兴趣/关系轻量合并或呈现。
- before/03-persona：表单可用，保留自定义和版本；共用间距一致，低频字段不扩张。
- before/04-memories AX：空列表仍有批量合并/导出、分页与完整添加表单；列表为主，添加/整理按需打开，选中才显批量工具，空时隐藏无用分页。
- before/05-life：日记首屏要求时区；重复平台状态、每条经历巨大卡片。日期/生成紧凑，时区按需，经历行简洁内部滚动。
- before/06-activities AX：标题「任务与调度」、创建表单常驻。明确「活动计划」与创建入口，保留实际权限/视频ID要求。
- before/07-connections 和08-qq-reply：返回区、平台标题、巨大账号卡片、页签多层堆叠，默认900×680大部分首屏花在顶部；三平台收紧同类连接头与状态。QQ已连接时「连接已有服务」退为次要设置入口，仍可访问，不擅改连接行为。
- before/09–15：QQ表情/记录、B站记录/设置、抖音记录/互动/设置已通过原生AX进入。多次切页AX有内容但截图opacity空白；tabs.tsx TabsContent初始opacity0，内容可用性不能依赖rAF。共享TabsContent直接呈现，保留语义和键盘，focus ring改为内侧不裁边。
- 设置→模型AX：已有deepseek配置但默认一整张空新建表单。列表优先、编辑/添加显式打开，默认用途清楚，不迁移模型或改API。

B为多页面相关UI S2。先保留全部业务与API，调整展示/局部交互；实施Agent仅Desktop/Web相关源码与必要UI回归，勿改A的Runtime。一次apps范围类型检查；共享页签与模型/记忆流程做必要定向UI检查，协调Agent负责原生全页截图与窄窗。不要全量build或重跑A已通过检查。

B6补充：API当前无来源字段，仅title不能可靠识别外部会话，不能让标题导致本地会话被误锁。允许B在ChatService.conversations/conversation与Conversation类型仅添加只读元信息，基于已有principal==='local-owner'推导；不改A generation/send区域、不暴露主体私密串、不变更权限或schema。新增公共响应元信息按S3契约风险审查兼容和直接定向用例，不因此全量测试。A独立审查限定A范围。旧运行实例没有该字段，原生UI验收限兼容，完整分流用隔离fixture证明，正常重启后生效。

## 限制与 Git
真实模型的自然频率不能由 fixture证明；真实 QQ 新消息与主观口吻由用户日常使用确认。不读出密钥，不发送真实消息、不重启QQ。本任务未经授权commit/push，保持dev未提交。

## A Implementation Report — 自然用图

### Summary
QQ 普通回复通过可信内部回合上下文获得正向配图策略：日常问候、撒娇、吐槽、庆祝和晚安等情境主动寻找贴切图片，不需要用户先说发图；当前人格或对方偏好只用文字、认真讨论、没有合适图片时保留文字回复。工具说明同步，不用固定轮数、随机图片或发送后自动补图。

Channels 持有有界近期记录，最多 64 个账号/目标组合、每个组合八个近期表情 ID。群内不同成员共享该群记录，不同私聊、群、账号隔离；只在现有 deliver 返回 sent/unknown 后记录，unknown 保持未知状态，失败、拒绝、取消及仅选中都不计。工具列表标记 recentlyUsed，本地候选优先未近期使用，网络在截取八项之前以相关度为主、同分时优先未近期使用，不删除唯一可用图。

### Files Changed
- `apps/runtime/src/ai/chat.ts`：把 Runtime 内部第四参数扩为工具和本轮上下文，进入 EngineInput.context；公共请求 JSON 仍只提供用户内容和请求 ID，不能伪造该参数。
- `apps/runtime/src/channels/service.ts`：传入 QQ 策略与近期快照，在实际投递结果后更新记录；既有发送与授权守卫不变。
- `apps/runtime/src/channels/sticker-history.ts`：有界内存近期记录与候选次序，不持久化或引入 schema。
- `apps/runtime/src/channels/sticker-turn.ts`、`sticker-network.ts`：正向说明、近期标记与候选排序；查看 receipt、单张选择、网络来源和所有原预算不变。
- `apps/runtime/src/channels/sticker-history.test.ts`、`tests/integration/qq-sticker-expression.test.ts`：近期容量/范围/投递时机、候选截取/相关度/空库/单图/网络关闭，以及普通本地和后台边界的必要回归。
- `tests/integration/qq-stickers.test.ts`：既有真实 DSH 表情用例改用普通闲聊输入，检查策略在 system 而不进入用户消息。
- `docs/qq.md`：说明日常主动用图、近期避重复和重启/真实模型限制。

### Important Decisions
根因是表达策略偏保守、工具候选缺少近期使用反馈，不是 QQ 权限禁止普通消息发图。修复位于 QQ 回合及候选职责层，没有改人格预设或当前保存人格、公共 HTTP API、主动发送授权、数据库、DSH 图像呈现凭证或平台插件。近期 ID 只是表达偏好，不作为成功投递证据或长期记忆；保留相关度和用户明确重发的选择空间，避免用机械禁重替代语境判断。

### Validation
- Risk Level: S2。
- `npx tsc -p tsconfig.node.json --noEmit`：退出 0，一次通过，检查本次 Runtime 及直接调用方类型。
- `npx vitest run apps/runtime/src/channels/sticker-history.test.ts tests/integration/qq-sticker-expression.test.ts tests/integration/qq-stickers.test.ts -t 'bounds recent stickers|offers unused local|records only sent|does not carry QQ|real DSH sees actual tool image|restricts network sources|blocks a selected image|does not authorize send'`：退出 0，8/8 通过，另外四个无关用例未执行；用时 4.03 秒。
- 回归实际覆盖：普通闲聊的真实 DSH system 提示及 image_url 像素/同条 QQ 图文；未选择不发图；图片呈现失败不授予选择资格；最终健康检查期间删图阻止外发；sent/unknown 使用记录与协议拒绝/取消不计；群不同作者共享、不同群/私聊/账号隔离和容量；网络候选在截取前换图、相关度优先、空库/单图/关闭网络；公开聊天请求伪造 context/tools/turn 不提权，后台活动无 QQ 策略，保存人格未变。
- `git diff --check`：退出 0，业务 diff 与新增文件审阅符合 A 范围。没有重跑已通过检查。
- 未执行 build：所用 Runtime、QQ 插件与 DSH bridge 夹具直接读取现有源码，插件和桥接实现本轮未改，无需准备新的 dist。未运行全量测试、lint、前端构建、发行或 UI 检查。

### Known Limitations
最近记录只在当前 Runtime 内存中，重启后重新积累。Fixture 证明策略、候选和投递边界，不能证明云模型的自然配图频率；未调用真实 QQ、第三方图库或付费模型，没有操作用户数据或重启真实 Runtime。新后端按用户正常启动流程加载；现有实例继续运行。

### Remaining Questions
A 无实施阻塞，交协调 Agent 与 B 范围合并后组织新的独立验收。实施 Agent 未修改 Desktop/UI、未创建子 Agent、未切分支、暂存、commit 或 push；本报告不替代最终验收。

## B Implementation Report — Desktop 易用性

### Summary
- 共享 TabsContent 改为同步可见的普通面板，保持页签语义、键盘与隐藏面板状态；焦点线向内绘制，避免滚动页签条裁切。
- 三个平台将平台名、账号和连接状态合并到紧凑账号卡片，减少返回区与卡片间距；QQ 已登录时“连接已有服务”移到连接选项，所有原连接/断开/扫码和回复授权行为保留。
- 模型默认展示配置及用途和默认用途选择；新建/编辑显式展开，保存后返回列表，收起后可继续草稿。模型发现、连接测试、推理强度、密钥留空与用途路由保持。
- 记忆列表优先，添加/整理按需展开，收起保留草稿；选中后显示批量工具，没有分页需求时隐藏分页。原保存、版本、冲突和分享确认逻辑不变。
- 概览移除人设原文与重复平台状态，兴趣/关系只呈现已有内容；日记日期与生成同行、时区放入日期设置、经历改为紧凑列表；活动计划名称与创建入口一致，创建表单按需展开。
- Chat 优先选择可写本地会话，QQ 会话显示只读说明和“对方”，隐藏发送框，提供本地聊天入口，保留历史、草稿、朗读声音设置。主 Agent 补充授权后，Conversation 新增可选 readOnly 布尔值，由实际 principal 推导，未暴露 principal，未依赖标题猜测身份。

### Files Changed
- `apps/desktop/src/components/beui/tabs.tsx`、`style.css`：共享面板可见性、内侧焦点、内容宽度、表单与账号卡片间距。
- `Models.tsx`、`Memories.tsx`、`Life.tsx`、`Douyin.tsx`：列表优先与按需表单、概览和经历呈现、活动计划入口。
- `Bilibili.tsx`、`QQConnection.tsx`：账号与连接头部合并、次要连接入口收起。
- `Chat.tsx`：明确只读会话与默认本地会话，保留草稿和朗读。
- `apps/runtime/src/ai/types.ts`、`chat.ts`：仅 Conversation DTO 与两个查询序列化补充 readOnly；同文件 A 的生成参数与策略改动未修改。
- `apps/runtime/src/ai/conversation-access.test.ts`、`tests/integration/desktop-usability.test.ts`、对应独立组件 fixture：访问元信息、无动画帧可见性、聊天与记忆交互回归。
- `tests/integration/model-connection-ui.test.ts`：适配显式新建/编辑入口，继续验证原有模型发现、诊断、保存与过期响应；不再假设第一条请求必为模型发现。

### Important Decisions
原生空白根因位于共享 TabsContent：已挂载内容被初始化为 opacity 0，并依赖后台 WebView 可暂停的动画帧恢复显示。修复直接移除内容入场动画，不在各页面补延时或强制刷新；其他 beUI 组件与页签选择交互保留。信息密度问题通过列表优先和表单按需解决，没有拆分新包或改变数据职责。

只读身份原 API 未提供，不能以标题判断。协调 Agent 明确允许只读元信息后，使用现有 principal 计算布尔；数据库、发信权限和请求契约不变，原服务端 EXTERNAL_CONVERSATION_READ_ONLY 检查仍是权限依据。缺少字段的旧 Runtime 保留原兼容行为与拒绝后只读兜底，完整首屏区分需下次正常启动新 Runtime。

### Validation
- Risk Level: UI 为 S2；后补 readOnly 涉及对外 DTO 的兼容性新增，按 S3 边界审阅，仅验证直接影响的序列化与读取/发信权限，不扩大到全项目。
- `npx tsc -p build/fish-persona/tsconfig.apps.json --noEmit`：退出 0，单次 apps 范围检查；之后仅补模型继续草稿入口与共享朗读菜单，这两项实际组件回归重新通过，未重复全部类型检查。
- `npx vitest run apps/runtime/src/ai/conversation-access.test.ts tests/integration/model-connection-ui.test.ts tests/integration/desktop-usability.test.ts`：元信息和 Desktop 流程两项通过；模型旧测试的首请求位置断言失败，原因是用途读取先发起，改为按 `/discover` 定位后仅重跑该模型项，退出 0。
- 审阅发现模型收起后无草稿继续入口，以及隐藏只读输入同时隐藏了朗读声音设置；补齐后执行 `npx vitest run tests/integration/model-connection-ui.test.ts tests/integration/desktop-usability.test.ts`：2/2 通过，退出 0。
- 元信息回归：本地标题叫“QQ 群 12345”仍可写，外部普通标题仍只读；列表、单项、创建返回一致，不泄漏 principal，服务端拒绝外部发送保持。
- UI 回归：默认选择真实可写会话、QQ 对方称呼与隐藏发送、往返草稿保留、只读朗读声音仍可配置；记忆空态无批量/分页、添加草稿收起恢复、保存和编辑/取消、选中批量、整理入口；暂停 requestAnimationFrame 后切页 opacity 仍为 1。
- 模型回归：显式新增、收起继续密钥草稿、发现/选择/测试、推理强度、保存回列表、编辑恢复、鉴权错误及过期诊断抑制，380px 无水平溢出。
- 已审阅 B diff 与共享 chat.ts 中 A/B 边界；`git diff --check` 退出 0。没有运行全量测试、全量 lint、Node/前端构建或发行检查。

### Known Limitations
本实施 Agent 仅运行隔离 headless Chrome/Vite fixture，无真实模型/QQ外发、用户数据写入或真实后台重启。当前运行的旧后台没有 readOnly，完整 B6 需下次正常启动；不把旧后台兼容显示误报为新功能实测。原生 macOS 全页截图、剩余设置页与窄窗由协调 Agent 继续，不由本报告代替。Windows、真实平台登录与云模型本轮未验证。

### Remaining Questions
无实施阻塞，等待协调 Agent 的原生截图审阅与新独立验收。本 Agent 未切分支、暂存、commit、push 或创建子 Agent；dev 上 A/B 改动均保留未提交。

### B 原生审计反馈补充（同轮实施）
协调 Agent 的 after/17–19 证明正文同步后，页签 pill 仍因 layoutId 追帧滞留；after/08 的 Badge 文字也被初始透明/离场动画滞留，侧栏 CSS 颜色过渡在该原生环境未及时完成。已在原职责层修正：TabsTrigger 的底色与图标/文字直接由 active 渲染，移除仅用于追帧移动/遮罩的内部状态和测量，不改变页签滚动、ARIA、方向键、Home/End；产品 `Badge` 给 beUI `AnimatedBadge` 显式设置 `animated=false`，保留 beUI 样式与原组件可选动画，状态文字不再等待帧。主导航与页签的颜色 CSS transition 关闭，未重造导航。

同步完成原生审计的两项局部收紧：QQ 在线账号卡片的账号/状态/断开/连接选项在宽窗同排、窄窗自然换行，未登录二维码和原授权操作保持；无活动计划时隐藏“暂停全部活动”。

新增 `desktop-usability` 独立最小用例，在 requestAnimationFrame 停止后断言选中底色准确跟随目标矩形、仅一个底色、正文与 Badge opacity=1 且显示最新文字、侧栏 data-active 和计算背景跟随状态、设置页不残留聊天选中态。命令 `npx vitest run tests/integration/desktop-usability.test.ts -t 'updates selected navigation'` 退出 0，1/1 通过，旧流程用例未重跑。相关 diff 检查通过；没有追加全量 build/类型/UI/Runtime 检查。新增涉及 `components/Surfaces.tsx` 与 `components/beui/animated-badge.tsx`，其余是本轮既有文件。原生复截图由协调 Agent 继续。

## 协调 Agent 原生与浏览器截图记录

证据目录 `build/desktop-ux-audit/`（忽略，不入库）。900×680 原生窗口、截图1800×1360：before/01 聊天；after/02–06 我的鱼的概览、设定、记忆、经历、活动计划；after/07 连接目录；after/08–10 QQ回复、表情、消息；after/11–12 B站记录/设置；after/13–15 抖音记录/互动/设置；after/16–22 设置的模型、扩展、声音、通用、数据、关于、高级。after/25–26 额外检查展开活动创建与模型编辑。未点真实保存、发送、测试模型、启停平台或备份恢复。

检查过程中发现的页签背景滞留、侧栏旧色、Badge空壳已在共享层修正，after/07–16 与04/06复截图可见真实选中项/状态，正文无需动画即显示；其它早期after截图记录布局，保留其修正前选中态作为过程证据。另发现QQ网络表情AX已选、视觉空框，交独立验收核查共享Checkbox，修复与最终结论见后续验收。

新QQ只读与本地优先无法由旧后台证明：隔离真实App fixture（61203，无外部网络/用户数据）默认选中本地会话，虽标题为「QQ 群 12345」仍保留输入；历史切到外部「QQ 群 30003」显示只读且无输入（after/24）。380×820截图after/27–29覆盖只读聊天、长昵称QQ回复设置、模型列表与默认用途；目视无横向溢出或遮挡，导航自动改抽屉、用途单列。

macOS已解锁，可原生AX点击与截图；尝试窗口拖动缩窄仍返回noWindowsAvailable，因此窄窗只声明浏览器响应布局证据，不冒充原生缩放通过。首次安装向导/扫码/真实导入导出/系统文件选择未执行，以免改变现有状态；Windows未实机检查。保存/诊断/草稿等功能复用实施Agent已有隔离回归，不重复运行。

## B Rework Implementation Report — R1–R4

### Summary
- R1：共享 Checkbox 的颜色、选中及半选标记直接随受控状态渲染，移除标记与颜色的追帧动画；保留 disabled、标签关联、ARIA、空格切换与回调。`data-state` 的半选优先级与 `aria-checked` 一致。
- R2：模型名称编辑按钮增加 6px 局部内边距，给内侧焦点线留出空间。
- R3：活动控制在已暂停、有计划，或存在 queued/running/understanding 任务时保留；仅未暂停且没有计划和活动任务时隐藏。继续使用现有 `/v1/activities/pause`，不改变权限、调度与后端。
- R4：实际运行状态使用 `Surfaces.Menu → beui/Popover`。产品 Menu 显式关闭开闭动画，内容裁切和 portal 可见性直接随 open 呈现；共享定位、受控开闭、Escape 回焦、外部关闭不变。同入口的聊天声音菜单同步生效，未修改未使用的 popover-morph。

### Files Changed
- `apps/desktop/src/components/beui/checkbox.tsx`：同步三态渲染。
- `apps/desktop/src/style.css`：仅本轮新增 `.model-name` 的内边距修正，保留先前 B 样式。
- `apps/desktop/src/components/Douyin.tsx`：活动控制的显示条件。
- `apps/desktop/src/components/beui/popover.tsx`、`Surfaces.tsx`：新增可选 animated 配置，产品 Menu 使用 false；原 beUI 默认动画行为保留，已有 Badge 修复未改。
- `tests/fixtures/desktop-usability.tsx`、`tests/integration/desktop-usability.test.ts`：新增隔离状态入口与一项集中回归，原两项用例保留不动。

### Important Decisions
R1/R4 根因均为核心可见状态依赖可暂停的动画帧，而非 API 或 React 状态未更新；因此在共享呈现层恢复状态与图形同步，没有在 QQ/运行状态各堆延时、刷新或读取内部状态的补丁。Popover 采用与产品 Badge 一致的显式动画开关，继续复用原组件及定位/关闭职责。R3 原条件仅看计划数量，遗漏全局暂停和无计划但仍活动的任务；依据现有 TaskQueue 与 B站任务状态补齐边界，没有把审批记录的 pending/executing 误算为该队列活动。A 的 Runtime 配图代码、用户配置和平台进程均未修改。

### Validation
- Risk Level：R1/R3/R4 合计 S2；R2 为 S0，仅 diff 与协调 Agent 的定向截图。
- `npx vitest run tests/integration/desktop-usability.test.ts -t 'keeps checkbox, menus and activity controls'`：退出 0，1/1 通过，另外 2 项未执行；用时 2.82 秒。
- 用例实际覆盖：暂停 requestAnimationFrame 后异步 off/on/mixed 往返，颜色与 SVG 标记同步、无残留；受控空格切换和禁用状态；实际产品 Menu 的键盘打开、viewport 内定位、内容中心可命中（防止 AX 可见但被 clip 裁掉）、Escape 关闭与回焦、外部 pointerdown 关闭；没有计划的空闲状态隐藏、持久暂停可恢复、queued/running/understanding 可暂停、仅 completed 历史隐藏。API 全部由隔离 fixture 返回，未请求真实 Runtime。
- `git diff --check -- apps/desktop/src/components/Surfaces.tsx apps/desktop/src/components/beui/checkbox.tsx apps/desktop/src/components/beui/popover.tsx apps/desktop/src/components/Douyin.tsx apps/desktop/src/style.css tests/fixtures/desktop-usability.tsx tests/integration/desktop-usability.test.ts`：退出 0，相关 diff 已审阅。
- 没有运行全量测试、build、lint 或 typecheck，没有重复已通过的旧检查。

### Known Limitations
本轮执行的是隔离 headless Chrome 组件回归，原生 macOS 的 R1/R2/R4 定向复截图由协调 Agent 继续；不以 DOM/fixture 代替原生截图结论。未操作 CUA、真实服务、付费模型或用户数据，未做 Windows 实机验证。

### Remaining Questions
无实施阻塞；已通知协调 Agent 可复截图，随后须由新的独立验收 Agent 重验。本 Agent 没有暂存、commit、push、切分支或创建子 Agent；dev 上原有 A/B 改动完整保留。

### 协调 Agent 返工定向复查
after/31-runtime-status-fixed.png：原生运行状态菜单三个入口立即可见、位于窗口内，再点状态按钮可收起。after/32-checkbox-fixed.png：网络表情AX为1且蓝底白勾明确，与三张启用框一致，未操作开关或保存。after/33-model-focus-fixed.png：原生新内边距生效；窗口非活跃未显示focus线，另在隔离浏览器通过键盘Tab真实聚焦模型名，after/34-model-keyboard-focus.jpg确认焦点线四周留白、不压文字。after/35-models-final.png为最终原生模型页。R3沿用返工隔离用例，不更改真实暂停状态。

截图已完成。临时浏览器tab7关闭、viewport已恢复；隔离fixture61203/session29850已结束（exit130），仅关闭BigFatFishAudit审计窗口，未退出原开发会话或停止Runtime/QQ。不追加未改范围验证，等待新的独立复验结果。
