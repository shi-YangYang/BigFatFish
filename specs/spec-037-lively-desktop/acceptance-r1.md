# Acceptance — B 返工独立复验

## Result

PASS

由新的独立验收 Agent `/root/accept_desktop_states` 复验。已读取 Spec、Plan 中完整实施及返工报告、首轮验收、A 验收、Rework、实际返工 diff、相关实现和定向测试断言，并独立查看协调 Agent 提供的最终截图。此次结论关闭 B 首验 R1–R3 及协调 Agent 补充 R4；A 的既有 PASS 保持，未重复其验证。

## Spec Coverage

- R1 已关闭：共享 Checkbox 直接依照 checked/indeterminate 渲染底色与 SVG；半选的 ARIA 和 data-state 一致，不依赖动画帧或退出动画。原标签关联、受控回调、原生 disabled 与键盘语义保留。原生 `after/32-checkbox-fixed.png` 中网络表情蓝底白勾清晰，与图库启用框一致；异步三态及暂停 rAF 边界由已通过的隔离回归覆盖。
- R2 已关闭：`.model-name` 的 6px 局部内边距给既有内侧焦点线留出空间，没有修改全局焦点策略。原生 `after/33-model-focus-fixed.png` 可见内边距；其非活跃窗口未显示焦点线，因此不作为原生键盘焦点证明。隔离浏览器实际键盘 Tab 聚焦的 `after/34-model-keyboard-focus.jpg` 显示四周留白，焦点线未压住文字。
- R3 已关闭：活动控制在全局 paused、有计划、或存在 queued/running/understanding 任务时保留，只有未暂停且无计划、无活动任务时隐藏。该状态集合与现有 TaskQueue/B站任务及 Activities.pause 的处理相符，沿用原 API，不改用户暂停状态、调度或权限。定向回归覆盖空闲隐藏、空计划暂停后恢复、三类活动任务暂停、仅完成历史隐藏。
- R4 已关闭：实际 `Surfaces.Menu → beui/Popover` 显式设置 animated=false，portal 可见性和内容裁切直接由 open 决定，默认 beUI 动画能力保留。定位、视口约束、inert、指针响应、Escape 回焦与外部关闭逻辑保持原职责；同入口聊天声音菜单同步适用。原生 `after/31-runtime-status-fixed.png` 中三项内容完整可见、处于窗口内；协调 Agent 已验证再次点触发按钮可收起。隔离回归另覆盖暂停 rAF 后内容中心可命中，避免仅以 AX 展开判成功。
- B 其余已通过首轮审阅的列表优先、按需表单、平台页收紧、页签/侧栏/徽标同步呈现、本地会话优先和外部会话只读沿用原证据；本轮未更改对应业务边界。A 配图策略、投递守卫与用户保存人格未被此次返工改变。

## Validation

- Risk Level: S2（共享 Checkbox/Menu 呈现及活动状态控制）；R2 为 S0。
- 本验收实际完成：返工 diff 和相关调用边界审阅；完整报告及测试断言审阅；只读查看 `build/desktop-ux-audit/after/31-runtime-status-fixed.png`、`32-checkbox-fixed.png`、`33-model-focus-fixed.png`、`34-model-keyboard-focus.jpg`。
- 复用实施 Agent 已执行成功的 `npx vitest run tests/integration/desktop-usability.test.ts -t 'keeps checkbox, menus and activity controls'`：1 passed、2 skipped，2.82 秒。未重复运行该测试。
- 复用返工相关 `git diff --check` 成功结果和此前 A/B 已通过检查；没有追加全量测试、build、lint 或 typecheck。
- 全页覆盖沿用 Plan：900×680 原生主页面及二级页面，浏览器 380×820 只读聊天、QQ 回复设置和模型页。原生缩窄因 `noWindowsAvailable` 未完成，不将浏览器证据表述为原生缩放验收。
- 验收未操作 CUA、真实服务、收费模型或用户数据；没有切分支、暂存、commit、push。工作保留于 dev，Git 提交授权仍未获得，远端状态未刷新。

## Issues

没有发现本轮返工仍未解决的阻断问题。

## Regression Risks

- 现有 Runtime 未重启，新配图策略和 readOnly 元数据将在下次正常 `npm run desktop:dev` 启动加载；旧后台截图不是新只读行为实测，新行为由既有隔离回归及浏览器证据支持。
- 云模型自然配图频率、真实外发、首次安装/扫码、系统文件选择和 Windows 实机表现本轮未验证；不由本次 PASS 推导其已通过。

## Required Rework

无。必要检查和原生定向复截图已充分，停止继续探索或重复验证。
