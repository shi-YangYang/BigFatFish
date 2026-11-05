# Acceptance — Desktop 布局 R1–R3 重验

## Result
PASS

独立验收 Agent：`/root/accept_desktop_layout_r1`，2026-11-06。首验 R1–R3 全部关闭；沿用首验已通过且未受返工影响的常规页面结论。本 Agent 未修改业务代码、运行真实服务操作或执行 Git 写入。

## Spec Coverage
- **R1：关闭。** beUI Drawer / Collapsible 增加默认保留动画的可选参数，由产品 `UI.Drawer` / `Surfaces.Disclosure` 统一采用同步路径。Drawer 直接挂载可见 DOM；折叠高度、透明度和箭头直接随 React 状态更新。未用页面特判、延时兜底或隐藏功能消除症状。
- 沿调用链核对历史、审批与窄屏导航均使用同一 Drawer；设定、日期、扩展、来源、工具活动、关于和更新均使用同一 Disclosure。实际 App 四宽采集脚本在冻结 rAF 后通过窄屏导航进入后续页面，未绕过该入口。产品层没有仍直接依赖动画原语的旁路。
- 焦点陷阱和 Escape 仍由原共享 hook 处理；卸载时回焦并恢复 body 滚动，背景按钮保留关闭契约。折叠关闭内容保留挂载，设置 inert / aria-hidden 并收回内部焦点，因此草稿和受控 / 非受控事件契约保持。
- **R2：关闭。** 模型名称恢复 6px 文本安全间距；品牌蓝焦点排除 outline-color 过渡，编辑标题使用共享焦点目标样式。四宽 normal / reduce 的实际计算结果一致为 `rgb(34, 120, 159) solid 2px`；原生模型名称与编辑标题截图也可见蓝色轮廓，未压住文字。
- **R3：关闭。** 共享单行 Disclosure 为 40px；保留 height:auto / min-height 与长标签换行能力。针对用例验证长标签自然增高，没有固定高度裁切。
- 根协调已完成原生定向复查，并返回实际结果：900 与 1512 宽窗历史完整可见，Escape 关闭；审批抽屉完整；设定、许可、更新、日期同步展开，长表单可滚动。未通过浏览器结果替代原生结果。

## Validation
- Risk Level: **S2**。
- Evidence Reviewed / Checks Performed:
  - 独立读取 Spec / Plan、首验、返工实施报告、规则和当前交接；审阅本轮 Drawer、Collapsible、UI / Surfaces、焦点样式、模型标题与新增回归用例差异，以及未变的 focus trap 实现和所有产品调用链。
  - 读取真实预加载 rAF 包装与冻结的测试、采集脚本及 `build/desktop-layout-audit/rework-r1-r3-20261106/results.json`。8 组覆盖 normal / reduce × 900 / 1280 / 640 / 380，均无 pageerror 或非 GET API 请求；面板在视口内、无 transform、opacity 为 1，Disclosure 非 inert 且可见，焦点色 / 间距 / 40px 均符合预期。返工定向高度为 900×680，其余宽度×820；首验原指定四尺寸常规矩阵继续有效，不将两者混称。
  - 独立实看本轮六张浏览器原图：normal 900 历史、380 设定、1280 模型焦点；reduce 380 历史、640 模型焦点、900 编辑标题。
  - 独立实看 `native-after/r1-sheets/sheet-{0..2}.png` 全部三张联系表，覆盖本轮 14 张原生图；另查看 `r1-11-model-name-focus.png` 原尺寸确认文字安全间距。08 / 09 准确视为新建按钮 / 新建标题，不冒充模型名称证据。
  - 沿用已通过的最相关回归：`beui-interface.test.ts -t 'product drawers'` 1 passed / 1 skipped，覆盖 normal / reduce × 正常 / 冻结帧四组合，包括 Tab 陷阱、tooltip / Drawer Escape 顺序、背景关闭、回焦、滚动锁、折叠 inert、草稿保持、长标签和即时焦点色。既有表单与嵌套浮层用例此前已通过，不重复执行。
  - 沿用 desktop / web 与该测试范围 TypeScript 0 diagnostics、实施者 diff 检查。未宣称包含 Runtime 测试的全 apps 类型检查通过；未运行全仓库测试、构建或重复 280 状态。

## Issues
无与本次修改直接相关的未解决问题。

## Regression Risks
- beUI 默认动画路径保持；产品仅将可用性相关开闭切换为即时完成。未发现 API、数据、账号、保存或外发行为变更。
- 常规全页覆盖采用首验已独立审阅的 70 状态 × 4 宽度 after 证据，不声称本次再次人工审阅全部 741 个截图阶段。
- 原始 before 中 95 张单图和完整 before-matrix 的损失仍按 Plan / `before-integrity.json` 保留说明；没有恢复、补造或宣称完整前图保存。该证据限制不影响本次返工后的实际可用性结论。
- 当前 dev 保留未提交修改；没有本轮 commit / push 授权。

## Required Rework
无。达到当前范围的必要验证后停止。
