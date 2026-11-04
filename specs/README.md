# Spec 管理

规格目录统一为 `spec-XXX-short-name/`。先从 [_template](_template) 创建草稿，明确目标、非目标、关键决策及可逐项验收标准；关键不确定性解决后才能实施。

- `spec.md`：定义实现什么及完成标准。
- `plan.md`：记录模块、顺序、接口、验证范围和风险，不扩张 Spec。
- `acceptance.md`：实施结束后记录独立验收，仅使用 `PASS` 或 `FAIL`，标注风险级别和实际证据。

生命周期：Draft → Ready → Implementation → Acceptance → Done。FAIL 进入 Rework：新的实施 Agent 返工，新的验收 Agent 重验；按需添加 `rework.md`，不得把旧验收结论复用为新结果。实施报告优先纳入已有 Plan，避免另建重复过程文档。

| Spec | 范围 | 结果入口 |
| --- | --- | --- |
| [001 仓库初始化](spec-001-repository-initialization/spec.md) | 目录、Git、忽略规则和基础文档；不代表完整 P0 | [验收](spec-001-repository-initialization/acceptance.md) |
| [002 P0 工程基础](spec-002-p0-foundation/spec.md) | Runtime/CLI/SQLite/API、桌面壳、CI及实际运行 | 实施报告与独立验收持续更新 |
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
