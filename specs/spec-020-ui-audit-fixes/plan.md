# Plan

## 范围与顺序
1. 基于巡检证据确认共享Popover的坐标/几何计算，集中增加视口边界避让，保留现有受控/非受控接口与动效；修复运行菜单转审批抽屉的关闭状态。
2. 稳定workspace-main的滚动条占位；仅为B站同组搜索/观看表单建立一致操作列。
3. 清理旧模型用途提示，模型名同值去重；顶栏明确服务状态，聊天保留自身断线提示。
4. 实施报告归入本文件；协调Agent完成实际UI复查，再由新独立Agent验收。

## 预计文件
apps/desktop/src/components/{Surfaces,Models,Bilibili,Memories,Life,Channels,Chat}.tsx、beui/popover相关模块、App.tsx、style.css、api.ts中同根因提示；按实际需要限缩。无目录迁移、新依赖或后端变化。

## 验证
S2的依据是共享Popover几何与菜单/抽屉交互，而非文案/颜色。实施Agent执行一个直接针对定位边界的最小检查，并按需要作相关前端类型检查；不跑全量测试。根Agent以cua_repl复查380/900下的声音浮层、运行菜单转审批、设置长短页、B站两行及模型展示。必要时只构建当前debug app用于原生复查，不打DMG或完整发行包。不重复已通过检查。

## 风险与兼容
Popover动画坐标、屏幕边缘/resize和焦点恢复是直接风险；不以单纯更高z-index替代关闭状态。平台未启用与旧Runtime状态保持，不将fixture/UI验证宣传为真实服务成功。

## Implementation Report

### Summary
实施完成，源码冻结，待root原生UI复查及新的独立验收。7项巡检问题已分别落到负责的共享组件、页面状态与展示层；没有后端、协议、配置或数据变更。

### Files Changed
- `components/beui/popover-position.ts`：增加纯定位计算与可见视口测量，横向避让、上下翻转、限高；测量自然内容高度，避免限高后反复翻转；沿用ResizeObserver/window scroll并补visualViewport resize/scroll。
- `components/beui/popover.tsx`：形变几何使用避让后的面板位置；面板按可用宽高限制并允许内容滚动，保留原触发器坐标、动画和Escape。
- `components/Surfaces.tsx`、`Chat.tsx`：Menu允许选择对齐，声音采用start；聊天提示明确“聊天连接已断开”。
- `App.tsx`：运行菜单受控，开启审批前关闭并把焦点送回稳定的触发器，让Drawer返回焦点有效；顶栏“服务在线/服务离线”及全局断线说明明确服务状态。
- `style.css`：只为非聊天workspace-main稳定滚动条占位，避免overflow:hidden聊天列产生额外空槽；B站两查询行统一100px操作列。
- `Bilibili.tsx`：两查询行使用相同布局class，字段/请求不变。
- `Models.tsx`：label=model时省略第二行，旧配置不同标签仍展示两者。
- `Memories.tsx`、`Life.tsx`、`Channels.tsx`、`api.ts`：文案统一聊天模型与语音输入模型；错误码不改，仅改三个同根因旧用途提示。
- `components/beui/NOTICE.txt`：记录本地Popover边界适配；新增局部`popover-position.test.ts`。

### Important Decisions / Root Cause
浮层缺少视口边界信息，故在共享几何层加入视口约束，业务的start对齐仅表达声音菜单的排列意图，不依靠单个元素偏移修补。超高面板按内容自然高度选择更有空间的一侧，再限制显示高度，保证重测不震荡。运行菜单未关闭属于App组合状态问题；明确关闭并保存合理焦点，比单纯提升Drawer z-index更符合职责。设置跳动由滚动条改变居中容器宽度导致，在滚动容器稳定占位。B站输入宽度由按钮文字宽度反向决定，统一同组操作列即可，不把全产品按钮硬改等宽。既有接口、数据和beUI生命周期保持。

### Validation
- Risk Level: S2，仅共享Popover与多个前端入口的直接影响。
- `npx vitest run apps/desktop/src/components/beui/popover-position.test.ts`：PASS，7项，92ms；涵盖左/右边缘、保留常规对齐、上/下翻转、长内容限高与重测稳定、缩放后的可见视口及超宽限制。
- `npx tsc -p build/chat-experience/tsconfig.json --noEmit`：PASS，apps范围（排除既有tests类型缺口），2.33s。
- diff已审阅；之后只将gutter样式限缩到非聊天滚动容器，无类型/逻辑变化，未重复已通过检查。
- 未操作浏览器/原生UI、未运行全量测试/build/lint、未提交Git。root负责实际原生复查及一次必要debug app构建。

### Known Limitations / Remaining Questions
真实账号与旧Runtime连接边界保持；纯计算测试不能代替实际WebView定位和焦点验证。无待用户决策问题。源码已冻结，后续只处理root/验收报告中明确的相关问题。

## R1：B站操作列容纳完整文案
首轮独立验收FAIL，唯一问题：统一100px列后“观看并理解”在实际系统字体下换两行。root以DOM Range记录文字分成57.125px与14.28125px两段，总宽71.40625px，按钮内边距28px再加边框使100px不足；证据build/ui-audit-fixes/07-web-bilibili-desktop.png。

新的实施Agent只修同组操作列的合理宽度/单行约束，保留两行输入边界和40px按钮。风险S0，查diff即可；root在900/380两宽度定向复查，不重复已通过的Popover测试、类型检查或其他页面。新独立Agent验收R1，保留首轮FAIL历史。

root实际复查受原生系统noWindowsAvailable影响，已请求用户确认解锁。当前有效视觉证据来自同一生产组件的本地内存fixture，不是实际账号；原生debug构建通过且AX显示新提示，但动画/缩放截图不可用于通过结论。B站fixture最初缺少health字段导致一次预览报错，已仅在忽略目录中的fixture补齐，未改生产代码；后续B站页面正常显示。详细最终证据待R1后归并。

### R1 Implementation Report
- Summary / Files Changed：仅修改`apps/desktop/src/style.css`中的B站查询行样式，将两行共用操作列从100px调整为112px，并在该组按钮限定`white-space: nowrap`。既有输入列、间距、40px按钮高度及业务行为保持。
- Root Cause / Decision：实测文字宽71.40625px，加28px内边距和2px边框已超过100px；112px为完整单行文案留出约10.6px余量。先提供足够列宽再限制换行，不通过隐藏/溢出文字掩盖问题；仅影响这两个查询行，不修改全局按钮尺寸或字体。
- Validation：S0。已审阅`git diff -- apps/desktop/src/style.css`，确认本次仅两处局部样式调整，首轮非聊天gutter等改动完整保留。未运行测试、typecheck、build、lint或UI操作。
- Known Limitations：900px/380px实际渲染由root定向复查，尚未把该项记为UI通过；后续交新的独立验收Agent判定。无待确认问题，未执行Git写操作。源码与报告已完成并冻结。

## 最终 UI 复查与产物（root，2026-11-04）

用户随后确认已解锁，原生坐标操作恢复。root以cua_repl完成实际macOS复查，证据统一在build/ui-audit-fixes：

- 10/11原生声音浮层：900×680打开后直接拖至380×500，标签/输入框完整可见、浮层跟随窗口；Escape关闭正常。
- 12原生审批抽屉：运行菜单→审批后无菜单遮挡，Escape关闭，AX焦点回到“运行状态”。
- 13原生模型/14原生声音：有无滚动条时内容左边界均约x259（Retina截图像素），模型同名仅一行。原生顶部“服务在线”与正文“聊天连接已断开”分别说明两种状态。
- 15/16原生B站R1：900×680、380×500下两个输入框右边界一致，操作列112px、按钮40px、完整单行文字，无越界。后续恢复900×680并返回聊天，未保存原生配置或执行平台动作。
- 隔离WebUI补充02–06：声音菜单900/380完整，审批关闭焦点正确，label相同一行、不同两行。长模型页与短声音页DOM左边界均130.5px；R1窄窗口按钮112×40、文字单行71.40625px，两输入框右边界228px。ui-evidence.json为实测记录；保存的示例模型仅存在fixture内存，不含真实凭据。
- 文案路径由root及独立Agent审阅diff核对；没有调用云模型、重启原有Runtime或登录平台，真实服务能力不作为本轮验证结论。

最终 `npx tauri build --debug --bundles app` 退出0，日志native-build.log；当前打开的是含R1的debug app，不是发行DMG。先前构建分别因后续gutter选择器修正与实测R1失败而刷新，旧日志保留为native-build-before-scroll-scope.log / native-build-before-r1.log，不复跑未受影响的测试。01-native-blocked-not-evidence.png为系统受限时的无效视觉证据，07为首轮换行失败历史，都不计最终通过图。

临时WebUI预览服务已停止、视口覆盖已重置、有效预览标签已关闭；原生最终调试窗口保留供用户查看。首轮FAIL的唯一R1已完成实际定向复查，新的独立/root/accept_ui_audit_r1已给PASS，完整报告已读取处理，未发现剩余返工项。root按用户持续授权本地commit；无push/PR/合并或远端刷新，具体hash以git log为准。满足停止条件，不追加验证。
