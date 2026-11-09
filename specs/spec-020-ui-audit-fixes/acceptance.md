# Acceptance

## Result
PASS（R1 新独立验收，2026-11-04；验收 Agent：`/root/accept_ui_audit_r1`）。

## Spec Coverage
- UI-01：共享 Popover 在定位层统一处理视口边界、上下翻转、可用高度及尺寸变化；声音 Menu 显式使用起始对齐。独立目视原生 `10-native-voice-desktop.png`、`11-native-voice-narrow.png`，900/380 逻辑像素宽度下标签和输入框完整可见。协调 Agent 记录的打开状态下拖动缩放及 Escape 操作与定位测量逻辑一致。
- UI-02：App 在打开审批抽屉前关闭受控运行菜单，并将焦点交回稳定触发器，修复位于菜单动作状态层。独立目视 `12-native-approvals-narrow.png`，正文无残留运行菜单覆盖；已有原生操作记录及 `ui-evidence.json` 记录 Escape 后焦点回到“运行状态”。
- UI-03：经历、记忆、QQ 提示及三个相关错误提示已采用聊天模型/语音输入模型分类。独立核对 diff，错误码、服务协议和模型调用逻辑未改变。
- UI-04：`scrollbar-gutter: stable` 限定在非聊天滚动容器，覆盖长短内容及展开后同一滚动容器。独立目视 `13-native-models.png`、`14-native-sound.png`，两页内容左边界均约为 Retina 截图 x259；既有 WebUI 几何记录长短页左边界均为 130.5 逻辑像素。没有以聊天页额外留白换取稳定性。
- UI-05 / R1：B站两行仍使用同组操作列，最终列宽 112px 并禁止按钮文字换行。独立目视 `15-native-bilibili-desktop-r1.png`、`16-native-bilibili-narrow-r1.png`，两行输入右边界相同、两个按钮完整单行、未越出窗口。既有 R1 窄窗口几何记录按钮均为 112×40px，输入框保有可用宽度；首轮 100px 列导致的“解”换行已消除。
- UI-06：模型 label 与 model 相同时省略第二行，不同时保留。独立目视原生模型截图及 `05-web-models.png`，确认同名只一行、旧自定义名称和模型名仍分两行显示。
- UI-07：顶部“服务在线”和正文“聊天连接已断开”分别描述对应连接状态；原生声音截图可同时看到两者，语义已区分，未将旧 Runtime 的聊天流断开包装为连接成功。

## Validation
- Risk Level: S2（完整 Spec 的共享 Popover 与跨组件交互）；R1 为 S0（局部操作列样式调整）。
- Evidence Reviewed / Checks Performed: 阅读 AGENTS、constitution、有效网页规则、当前 handoff、Spec、Plan、首轮 FAIL 和原始巡检报告；独立审阅相关业务 diff、定位测试源码、最终 UI 几何记录及 debug app 构建日志。
- 已阅实施证据：定位测试 7/7 通过；apps 范围 TypeScript 检查通过；最终纳入 R1 的 `tauri build --debug --bundles app` 成功。上述为已存在证据，本验收未重复运行测试、build、lint 或 typecheck。
- 实际目视截图：`build/ui-audit-fixes/05-web-models.png` 及 `10-native-voice-desktop.png` 至 `16-native-bilibili-narrow-r1.png`。`01-native-blocked-not-evidence.png` 不作为证据；`07-web-bilibili-desktop.png` 仅保留首轮失败历史，不计最终通过。
- 本验收未控制 UI、修改业务代码、创建子 Agent 或执行 Git 写操作；只更新本验收文档。用户解锁后原生操作限制已由协调 Agent 的实际操作解除。

## Issues
无本 Spec 范围内未解决问题。首轮 R1 已关闭。

## Regression Risks
- Popover 是共享组件；已通过边界几何用例、源码审查及常规/窄窗口声音与审批路径核对，未发现新增状态或定位回归。
- 本轮不声称真实模型调用、平台登录/发送、Windows 环境、流式对话端到端或 DMG 安装验证通过；旧 Runtime 保持运行，未触发真实服务操作。这些不属于本次 UI 修复的通过依据。

## Required Rework
无。达到本轮所需验证范围，停止追加检查。

---

# 首轮独立验收（历史，原结论保留）

## Result
FAIL（首轮独立验收，2026-11-04）。

## Spec Coverage
- 共享Popover在几何层加入可见视口约束、横向避让、上下翻转和限高，Menu对齐配置保留；源码未发现职责错位。
- 运行菜单转审批由App关闭受控菜单并把焦点交回稳定触发器，Popover正确合并ref，Drawer返回焦点链路成立；没有靠提升层级掩盖状态问题。
- gutter仅应用非聊天滚动容器；同名模型去重保留label不同的旧配置；模型用途与服务/聊天状态文案改变符合范围；API仅改变3项提示文字，错误码不变。
- B站两行输入边界虽由统一操作列解决，但操作按钮出现文字换行回归，未满足常规/窄窗口均整齐的验收要求。
- 原生系统坐标操作再次受限，root转用同一生产组件的隔离浏览器预览复查；不能把锁屏时的原生截图当作布局通过证据。

## Validation
- Risk Level: S2（共享Popover及相关前端交互）。
- Evidence Reviewed / Checks Performed: 独立审阅当前Spec、Plan实施报告、全部相关业务diff、Popover测量/几何/portal、触发器ref组合、Drawer焦点恢复、B站样式和定位测试源码。
- 已阅实施者报告：定位边界7项通过、apps范围TypeScript通过；已阅root最终debug app构建成功日志。未重复执行测试、build、lint或typecheck，未控制UI或修改业务代码。
- 实际目视 `build/ui-audit-fixes/07-web-bilibili-desktop.png`，清楚看到900px宽窗口中“观看并理解”的最后一个“解”换到第二行。本轮这一直接失败足以判FAIL；其余root已采集的视觉证据留给返工后的新独立验收一并确认，不声称本Agent已逐图目视全部截图。

## Issues
### R1 · P2 · B站统一操作列过窄，按钮文案变成两行
位置：`apps/desktop/src/style.css:206`（`.video-query-row`）。100px固定列与现有按钮内边距、边框及实际文字宽度不相容，使“观看并理解”在常规900px窗口也变成两行。原先的右边界问题被替换为按钮内容排版问题，直接违反本轮统一、精致且可读的表单要求。

## Regression Risks
只调整单组布局即可；不得扩为全局按钮宽度/字号调整。保留两行操作列与输入右边界相同，并核对380px窗口下字段仍有可用宽度。仅设置nowrap而让文字溢出，不能算修复。

## Required Rework
新实施Agent修正B站同组操作列尺寸或排列，使完整按钮文案单行容纳、控件保持40px高，常规/窄窗口均无溢出。只需定向复查该两行的900px/380px布局，不重复未改动的定位、类型或全部页面检查。随后由新的独立验收Agent重验并保留本轮FAIL历史。
