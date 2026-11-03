# Acceptance

## Result

PASS — 返工后的新独立验收，2026-11-03，验收 Agent `/root/accept_desktop_webui_rework`。首轮 R1/R2 已在正确的状态归属与交互容器内修复；相关回归和更新后的产物证据足以支持本阶段交付。首轮 FAIL 原始记录保留于本文件历史段。

## Spec Coverage

- 复核 Spec 010、两轮实施报告及首轮验收，确认本次返工只涉及 Chat 临时会话草稿、App 审批容器、局部错误样式和现有定向测试；未改变 Runtime/API/权限、数据与原有宿主边界。
- R1：Chat 在确认创建响应仍属于当前临时会话后，将 `textRef.current` 迁入真实会话 ID 并删除临时槽，再更新选择；pending 仍迁移至同一 ID。成功发送按原选择对象和 draftVersion 判定清空，发送期间新编辑保持，后续新对话不会恢复已消费的临时草稿。
- R2：审批 Drawer 内的 `ApprovalContents` 独立持有错误；稳定 fail 回调同时提供给 QQ 与抖音审批。`role="alert"` 在当前 modal 内持续展示，局部样式令其在窄屏完整可见；保留原错误翻译、单次审批和未知结果先核对的提示。
- 首轮已检查的导航、次级能力、断连保留、同源品牌和两宿主边界未被上述返工改变。已查看最终1100/640聊天及640审批错误截图：发送区可见，鲸鱼娘标识一致，错误现在处于用户当前操作区域。820宽度及其他工作区沿用首轮验收与实施证据，不重复渲染。
- 最终本机 app/DMG 已重新包含返工前端；包内 icon 与源文件、随包 Web 与最终 dist 的一致性由协调者记录。截图和交互证据均是实际生产前端配隔离 IPC 示例，不是外部平台成功证据。

## Validation

- Risk Level: S2。
- 本验收者实际执行：只读核对当前 Git 状态、治理与实施/验收文档、Chat 的草稿/选择/发送/请求生命周期、App 审批容器、相关 CSS、定向回归 fixture 和断言；实际查看 `approval-error-640.png`、`final-chat-1100.png`、`final-chat-640.png`；阅读最终 `package-evidence.json`。
- 复用返工者已通过的 `npx tsc -p tsconfig.json --noEmit`、定向 ESLint、Desktop/Web 构建、`npx vitest run tests/integration/desktop-webui.test.ts`（7.94秒）及 scoped diff check。没有再次执行这些检查，也没有追加浏览器复现：代码因果关系、回归断言、已报告成功结果和实际截图对两条首轮问题提供一致且充分的证据。
- 已核对回归断言实际覆盖：临时草稿切换恢复→发送成功→再次新建为空；新会话发送期间编辑保留并可切回恢复；QQ `CHANNEL_OFFLINE` 与抖音 `ACTION_UNKNOWN` 在同一审批 dialog 内可见，窄屏 alert 位于视口内。
- 最终本机包证据：`build/desktop-webui/package-evidence.json` 的 phase 为 `R1/R2 rework`，DMG SHA-256 为 `4ca042adfc779099ea405d0d627de811b0926351532cbe1a47831c7c5210fbe1`，ICNS 匹配，随包 Web 的4个文件匹配最终构建。未重复执行哈希/资源比较或打包。

## Issues

无与本轮改版及返工直接相关的未解决阻塞问题。首轮 R1、R2 均已关闭。

## Regression Risks

原有会话 API 不暴露 QQ 来源，只有收到明确只读拒绝后才能呈现只读，这是 Spec 中已接受的现有边界。真实模型/平台账号、Windows、本轮原生 app 启动仍未验证；本机包为 ad-hoc 签名，未公证/发布。本次 PASS 仅覆盖已授权界面改版及其风险相称的本机代码/产物证据，不改变这些限制。

## Required Rework

无。已达到本轮充分验证与停止条件；本地提交由协调者按既有用户授权完成。

## History — 首轮独立验收原始记录

以下保留返工前的 FAIL 和复现证据，当前结论以上方 Result 为准。

### Result

FAIL — 首轮独立验收，2026-11-03，验收 Agent `/root/accept_desktop_webui`。导航、布局和品牌改版基本符合规格，但新增草稿迁移与模态审批错误呈现存在两处已复现问题，需要返工后由新的验收 Agent 重验。

### Spec Coverage

- 已检查三个主入口和底部设置，既有我的鱼、连接、模型/扩展/媒体/维护/诊断入口均可通过 Workspaces 到达；Desktop/Web 沿用原适配和宿主边界，无 Runtime/API/数据目录变更。
- 已检查 Chat 保持挂载、断连发送禁用、分会话草稿、未知结果 requestId、取消、转写和朗读路径；基本流程有定向测试证据，但新对话草稿迁移未满足完整状态保护，见 R1。
- 已检查待审批上下文和逐项 approve/reject 契约仍在；审批失败的说明未在当前模态交互中呈现，见 R2。
- 已查看最终1100/820/640聊天、模型设置、平台连接截图及审批截图。布局统一、输入区可见，640截图无旧的重复顶栏；截图为生产组件配隔离示例数据，不是实际平台响应。
- 品牌/聊天头像/我的鱼入口/Web登录/favicon使用本地同源大肥鱼娘，关于页内嵌素材通知。原生图标与本机包证据已核对；不代表 Windows 实机或真实外部服务验证。

### Validation

- Risk Level: S2。
- 审阅 Spec、Plan、Decision 010、交接、生产 diff、UI/Workspaces/Chat/Models/相关组件与 API 契约、CSS、定向 UI 测试及六张已有截图。
- 复用实施者已通过的 UI TypeScript、定向 ESLint、两前端构建、`desktop-webui.test.ts` 与 scoped diff check 报告，没有重复运行。
- 阅读协调者的 `build/desktop-webui/package-evidence.json`：本机 Tauri app/DMG 成功；ICNS 与输入文件一致，随包 Web 的4个文件与当前构建一致。未启动原生 app、未触碰真实鱼。
- 针对静态审阅发现的两条遗漏路径，仅执行一次 `node --input-type=module` Playwright heredoc：打开现有 `http://127.0.0.1:53421/current.html` 的当前生产 App，用页面内独立 IPC 替换限定的会话创建/发送/审批返回值。未写生产源码或调用真实 Runtime。
- 实际结果：新对话发送成功后再次新建仍恢复 `已经发送的草稿 A`；审批 POST 返回 `CHANNEL_OFFLINE` 后 `dialogAlerts=0`，抽屉内只有原待审批内容/按钮，错误仅在外部 `.app-error`，`dialog:modal` 仍打开。

### Issues

#### R1（P2）：新对话转成持久会话后，空会话槽的旧草稿复活

位置：`apps/desktop/src/components/Chat.tsx` 的 `selectSession`（约55行）及 `send` 创建会话后的状态迁移（约153行）。

复现：新对话输入A → 切换已有会话 → 返回新对话（A从草稿Map恢复）→ 发送成功（输入框已清空）→ 再点新对话，A重新出现在输入区。

根因：自动创建真实会话仅将 `pending['']` 迁移到新ID，并直接替换 `currentSelection`，没有同步迁移/释放 `drafts['']`。确认已发出的内容仍被保存为下一条新会话的未发送草稿，容易被再次提交。

#### R2（P2）：审批错误被渲染到模态抽屉外

位置：`apps/desktop/src/App.tsx` 的全局错误区及审批 Drawer 中传入的 `fail`，涉及共用 QQ/抖音审批调用。

复现：打开审批抽屉 → 批准一条消息 → 后端明确返回 `CHANNEL_OFFLINE`。错误文本只在抽屉外 App.error，当前模态抽屉内没有错误说明，待审批按钮仍显示。模态使外部内容不可交互，读屏焦点也停留在抽屉；在窄窗口下抽屉完全覆盖外部错误。

原页面错误在同一操作上下文可见，迁入 Drawer 后应让失败/未知结果在抽屉内持续可读，不能要求用户先关掉当前审批才能知道失败原因。

### Regression Risks

修复 R1 时不能清掉发送等待期间新增的草稿，或丢失未知结果的 requestId；应核对同一草稿Map生命周期下的切换/返回。修复 R2 应同时覆盖抽屉内 QQ 和抖音审批，保留拒绝/批准单次及原权限校验，不扩大到 Runtime/API。

现有 API 不含会话来源，QQ 仅在明确只读拒绝后展示只读状态，是本轮已记录并接受的限制，不作为失败项。真实模型/平台账号、Windows 与本轮原生启动未验证。

### Required Rework

1. 在草稿所属的新会话转为真实会话时，一致处理 pending、draft与选择状态；已发送的新会话草稿不能复活，期间新编辑保留。
2. 为审批模态提供局部、持续、可访问的错误反馈，QQ/抖音两条路径都使用该反馈；未知结果仍提示核对，不盲目重试。
3. 针对两条遗漏路径补最小回归证据；按改动更新相关前端产物后，由新的独立验收 Agent 重验。无需重跑旧平台完整测试矩阵。
