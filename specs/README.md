# Spec 管理

各条目记录对应阶段的需求和验收。查询现行行为时，可从[取消平台逐条审批](spec-041-remove-platform-approvals/spec.md)、[平台登录提示](spec-043-connection-login-feedback/spec.md)、[本地聊天历史](spec-044-local-chat-history/spec.md)和[源码目录](spec-045-project-layout/spec.md)进入。

规格目录统一为 `spec-XXX-short-name/`。先从 [_template](_template) 创建草稿，明确目标、非目标、关键决策及可逐项验收标准；关键不确定性解决后才能实施。

- `spec.md`：定义实现什么及完成标准。
- `plan.md`：记录模块、顺序、接口、验证范围和风险，不扩张 Spec。
- `acceptance.md`：实施结束后记录独立验收，仅使用 `PASS` 或 `FAIL`，标注风险级别和实际证据。

生命周期：Draft → Ready → Implementation → Acceptance → Done。FAIL 进入 Rework：新的实施 Agent 返工，新的验收 Agent 重验；按需添加 `rework.md`，不得把旧验收结论复用为新结果。实施报告优先纳入已有 Plan，避免另建重复过程文档。

| Spec | 范围 | 结果入口 |
| --- | --- | --- |
| [001 仓库初始化](spec-001-repository-initialization/spec.md) | 目录、Git、忽略规则和基础文档；不代表完整 P0 | [验收](spec-001-repository-initialization/acceptance.md) |
| [002 P0 工程基础](spec-002-p0-foundation/spec.md) | Runtime/CLI/SQLite/API、桌面壳、CI及实际运行 | [返工复验与 Windows 验证缺项](spec-002-p0-foundation/acceptance.md) |
| [003 P1 AI 鱼核心](spec-003-p1-ai-core/spec.md) | 真实DSH、模型、人格、会话与流式聊天 | [代码验收及外部缺口](spec-003-p1-ai-core/acceptance.md) |
| [004 P2 记忆养成](spec-004-p2-memory-life/spec.md) | 有来源的长期记忆、日记、兴趣、经历、关系、心情与主页 | [返工复验PASS](spec-004-p2-memory-life/acceptance.md)，外部缺口单列 |
| [005 P3 QQ](spec-005-p3-qq/spec.md) | OneBot私聊/群聊、主人权限、记忆可见范围、审批与插件管理基础 | [返工复验PASS](spec-005-p3-qq/acceptance.md)，QQ媒体已在P7补齐本机路径，真实账号缺口单列 |
| [006 P4 B站](spec-006-p4-bilibili/spec.md) | 固定上游复用、观看/理解/记忆与经QQ审批分享 | [代码验收PASS](spec-006-p4-bilibili/acceptance.md)，真实账号验证单列 |

- [Spec 007：P5 抖音与统一调度](spec-007-p5-douyin/spec.md)：[本地代码返工PASS](spec-007-p5-douyin/acceptance.md)；原生Mac已验证，未完成协议与外部缺口单列。
- [Spec 008：P6 安装、运行与数据迁移](spec-008-p6-release/spec.md)：[本地代码返工PASS](spec-008-p6-release/acceptance.md)；Mac/Linux产物与迁移路径有证据，Windows和正式签名/发行未完成。
- [Spec 009：P7 Web Console与插件生态](spec-009-p7-web-plugins/spec.md)：[返工复验PASS](spec-009-p7-web-plugins/acceptance.md)；远程认证、可安装插件、真实工具回合、媒体与开发者文档，本地代码与安装证据通过，外部验证单列。
- [Spec 010：Desktop WebUI 与大肥鱼娘形象](spec-010-desktop-webui/spec.md)：[返工复验 PASS](spec-010-desktop-webui/acceptance.md)；精简导航、统一视觉与大肥鱼娘品牌，最终本机包证据见 Plan。

- [Spec 011：DeepSeek 蓝色与统一组件](spec-011-blue-ui-system/spec.md)：[返工复验 PASS](spec-011-blue-ui-system/acceptance.md)；统一蓝色主题与共享控件，复杂表单和确认区对齐，最终产物证据见 Plan。

- [Spec 012：收敛导航与聊天布局](spec-012-compact-chat-layout/spec.md)：[独立验收PASS](spec-012-compact-chat-layout/acceptance.md)；72px窄导航、60px单顶部栏与按需历史对话，最终包见Plan。

- [Spec 013：接入beUI并统一按钮](spec-013-beui-controls/spec.md)：[独立验收PASS](spec-013-beui-controls/acceptance.md)；官方Button源码/依赖与主题接入，修正顶部尺寸混用，原布局保持。

- [Spec 014：全面迁移适用beUI组件](spec-014-beui-interface/spec.md)：[独立验收PASS](spec-014-beui-interface/acceptance.md)；表单/导航交互/浮层/状态和聊天展示实际采用beUI，必要原生边界及最终包见Plan。

- [Spec 015：模型连接诊断与推理强度](spec-015-model-connection/spec.md)：[返工独立验收PASS](spec-015-model-connection/acceptance.md)；测试当前草稿并显示耗时、发现模型、推理参数真实传递，Runtime超时修复及最终Mac包见Plan/Rework。

- [Spec 016：表单间距收紧](spec-016-form-spacing/spec.md)：[独立验收PASS](spec-016-form-spacing/acceptance.md)；统一字段、说明、分组与操作区间距，保持现有beUI与业务行为，本轮源码/预览交付，未重打发行包。

- [Spec 017：大肥鱼蓝色主题去紫](spec-017-pure-blue-theme/spec.md)：[独立验收PASS](spec-017-pure-blue-theme/acceptance.md)；统一纯蓝主色、浅蓝底色及beUI状态配色，本轮源码/预览交付。

- [Spec 018：浅海蓝与轻量选中态](spec-018-soft-blue/spec.md)：[独立验收PASS](spec-018-soft-blue/acceptance.md)；采用用户选择的清透浅海蓝，区分主操作与浅底深字页签。

- [Spec 019：简化模型设置与实时聊天反馈](spec-019-chat-experience/spec.md)：[独立验收PASS](spec-019-chat-experience/acceptance.md)；聊天/语音输入/朗读三类用途、服务端默认、流式回复与统一临时错误提示。

- [Spec 020：修复原生UI巡检问题](spec-020-ui-audit-fixes/spec.md)：[返工独立验收PASS](spec-020-ui-audit-fixes/acceptance.md)；共享浮层避让与菜单关闭、表单对齐、模型及连接状态文案，已完成原生定向复查。

- [Spec 021：统一桌面图标](spec-021-desktop-icon-consistency/spec.md)：[独立验收PASS](spec-021-desktop-icon-consistency/acceptance.md)；macOS 与 Windows 的开发/打包图标统一圆角与透明留白；Windows 已完成资源验收，未实机验证。

- [Spec 022：开发入口统一管理进程](spec-022-managed-desktop-dev/spec.md)：[返工独立验收PASS](spec-022-managed-desktop-dev/acceptance.md)；单命令管理当前后台、前端及桌面，保护进程归属与停服维护边界。

- [Spec 023：内置管理 QQ 组件](spec-023-managed-qq/spec.md)：[独立验收PASS](spec-023-managed-qq/acceptance.md)；原版组件准备、扫码、回复范围与简洁连接页面。

- [Spec 024：收紧 QQ 回复设置](spec-024-qq-reply-layout/spec.md)：[独立验收PASS](spec-024-qq-reply-layout/acceptance.md)；紧凑设置卡片、同排账号操作和记录分组。

- [Spec 025：QQ 多好友、群聊触发与直接发送](spec-025-qq-conversation-policy/spec.md)：[返工独立验收PASS](spec-025-qq-conversation-policy/acceptance.md)；唯一主人、多好友私聊、群普通消息和QQ免审批发送。

- [Spec 026：精简界面解释文案](spec-026-interface-copy/spec.md)：[独立验收PASS](spec-026-interface-copy/acceptance.md)；删除重复解释和内部实现说明。

- [Spec 027：大肥鱼人设](spec-027-fish-persona/spec.md)：[返工独立验收PASS](spec-027-fish-persona/acceptance.md)；三套可编辑口吻、统一提示与简洁设定页。

- [Spec 028：QQ 表情回复](spec-028-qq-stickers/spec.md)：[返工独立验收PASS](spec-028-qq-stickers/acceptance.md)；内置/上传与梗鲸网络表情、受控看图与发送。

- [Spec 029：简化 QQ 连接与折叠交互](spec-029-qq-connect-flow/spec.md)：[独立验收PASS](spec-029-qq-connect-flow/acceptance.md)；单次连接与清楚的设置入口。

- [Spec 030：同步 B站与抖音连接体验](spec-030-other-connect-flows/spec.md)：[独立验收PASS](spec-030-other-connect-flows/acceptance-r2.md)；单次连接、自动核验与功能页签。

- [Spec 031：QQ 消息错误诊断与准确反馈](spec-031-qq-message-errors/spec.md)：[独立验收PASS](spec-031-qq-message-errors/acceptance.md)；安全模型错误分类、准确QQ记录与发送反馈。

- [Spec 032：长内容卡片内部滚动](spec-032-card-content-scroll/spec.md)：[返工独立验收PASS](spec-032-card-content-scroll/acceptance-r1.md)；统一同类记录、长文本及列表的内容边界。

- [Spec 033：QQ 消息页仅保留操作记录](spec-033-qq-audit-only/spec.md)：[独立验收PASS](spec-033-qq-audit-only/acceptance.md)；删除发送表单及投递记录展示。

- [Spec 034：精简视频平台手动观看与记录](spec-034-platform-operation-records/spec.md)：[独立验收PASS](spec-034-platform-operation-records/acceptance.md)；移除手动观看，保留分享互动，统一操作记录。

- [Spec 035：QQ 图片、无引用回复与人设](spec-035-qq-media-persona/spec.md)：[独立验收PASS](spec-035-qq-media-persona/acceptance.md)；修复托管图片内容返回，强化女儿感与鱼粮梗。

- [Spec 036：刷新 QQ 好友与群聊](spec-036-qq-contact-refresh/spec.md)：[PASS](spec-036-qq-contact-refresh/acceptance-r1.md)；显式刷新联系人并保留回复设置草稿，补齐慢请求超时。

- [Spec 037：自然用图与 Desktop 易用性](spec-037-lively-desktop/spec.md)：[返工独立 PASS](spec-037-lively-desktop/acceptance-r1.md)；主动考虑贴切配图与近期避重复，列表优先、共享状态同步及全面原生页面审计。

- [Spec 038：网站完整人设卡与工具适配](spec-038-source-persona-cards/spec.md)：[PASS](spec-038-source-persona-cards/acceptance-r1.md)；两张来源卡及 QQ、记忆、联网工具已接入；当次启用记录保存在该规格的实施与交接资料中。
- [Spec 039：移除设定页版本记录](spec-039-remove-persona-history/spec.md)：[PASS](spec-039-remove-persona-history/acceptance.md)；已移除版本历史界面及加载逻辑，保留当前设定编辑与保存。

- [Spec 040：Desktop 全页面布局修复](spec-040-desktop-layout-audit/spec.md)：[返工独立PASS](spec-040-desktop-layout-audit/acceptance-r1.md)；70状态×4宽度及原生逐页检查，统一页面/卡片/表单/浮层布局，修复停帧可用性、焦点和控件尺寸；原始before证据损失另有说明。
- [Spec 041：取消平台逐条审批](spec-041-remove-platform-approvals/spec.md)：[返工独立PASS](spec-041-remove-platform-approvals/acceptance-r1.md)；抖音互动直接执行，移除全局审批入口；权限、幂等和操作记录保留。
- [Spec 042：移除顶栏服务在线标签](spec-042-remove-online-tag/spec.md) · [验收通过](spec-042-remove-online-tag/acceptance.md)。
- [Spec 043：登录等待与连接错误提示](spec-043-connection-login-feedback/spec.md) · [验收通过](spec-043-connection-login-feedback/acceptance-r1.md)。
- [Spec 044：聊天页只显示本地对话](spec-044-local-chat-history/spec.md) · [验收通过](spec-044-local-chat-history/acceptance.md)。
- [Spec 045：项目目录职责整理](spec-045-project-layout/spec.md) · [验收通过](spec-045-project-layout/acceptance.md)。
- [Spec 046：一条鱼的分层记忆](spec-046-layered-memory/spec.md) · [返工验收通过](spec-046-layered-memory/acceptance-r1.md)：主人绑定与群聊隐私、可纠正的偏好、B 站和抖音观看经历。
- [Spec 047：自然对话记忆与本地语义检索](spec-047-semantic-recall/spec.md) · [验收通过](spec-047-semantic-recall/acceptance.md)。
- [Spec 048：自动记忆与人物归属](spec-048-automatic-personal-memory/spec.md) · [验收通过](spec-048-automatic-personal-memory/acceptance-r1.md)。
- [Spec 049：回复后的记忆整理](spec-049-background-memory/spec.md) · [独立复验通过](spec-049-background-memory/acceptance-r1.md)。
- [Spec 050：能追溯到原话的人物资料](spec-050-memory-layers/spec.md) · [真实模型验证](spec-050-memory-layers/live.md) · [独立复验通过](spec-050-memory-layers/acceptance-r1.md)。
- [Spec 051：四层长期记忆](spec-051-scenario-memory/spec.md) · [真实模型测试](spec-051-scenario-memory/live.md) · [独立复验通过](spec-051-scenario-memory/acceptance-r1.md)。
- [Spec 052：Desktop 清晰度与易用性](spec-052-desktop-clarity/spec.md) · [实施与原生巡查](spec-052-desktop-clarity/plan.md) · [独立复验通过](spec-052-desktop-clarity/acceptance-r1.md)：中性色层次、精简设定、稳定编辑与设置流程。
- [Spec 053：QQ 表情来源分区](spec-053-sticker-sources/spec.md) · [独立验收通过](spec-053-sticker-sources/acceptance.md)：区分网络表情与本地表情，统一添加入口文案。
- [Spec 054：持续心情与自动日记](spec-054-emotional-life/spec.md)：已完成，温和持续情绪、聊天表达与每天自动回顾；[返工独立验收 PASS](spec-054-emotional-life/acceptance-r1.md)。

- [Spec 055：QQ 互动工具与自主账号生活](spec-055-qq-self-tools/spec.md)：已完成，补充聊天互动、自身资料、头像与自主说说；[返工独立验收 PASS](spec-055-qq-self-tools/acceptance-r1.md)。
- [Spec 056：QQ 内置能力](spec-056-builtin-qq/spec.md)：已将自有 QQ 适配并入 Runtime，取消独立插件安装及升级；[独立验收 PASS](spec-056-builtin-qq/acceptance.md)。
- [Spec 057：QQ 回复耗时与连接反馈](spec-057-qq-response-and-loading/spec.md)：[独立复验 PASS](spec-057-qq-response-and-loading/acceptance-r1.md)；减少工具收尾与网络表情等待、修复旧后台反馈并补连接 loading。用户授权后新版后台已启用，QQ 已扫码在线。
