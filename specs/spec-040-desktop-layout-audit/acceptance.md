# Acceptance — Desktop 全页面布局首验

## Result
FAIL

独立验收 Agent：`/root/accept_all_desktop_layout`，2026-11-05。首轮布局已明显改善，但下列 R1–R3 尚未关闭。未修改业务代码、真实数据或 Git 历史。

## Spec Coverage
- 共享页面宽度、卡片内边距、表单短字段分组、模型编辑前置、QQ 账号摘要、卡片动作、概览元信息、窄窗标题、Tabs 独立箭头区域和 Popover 边界均有实际 after 证据。
- 独立目视 `after-sheets/all-{900,380}-{0..8}.png` 全部 18 张联系表，覆盖 70 状态在两种宽度的 140 个视图；包括聊天、我的鱼、三平台连接、所有设置页、Web 差异、空态、长文本、错误及展开状态。未声称逐张人工审阅全部四尺寸的 741 个截图阶段。
- 另独立目视 `native-after/sheets/sheet-{0..5}.png` 的 35 张原生视图，以及历史抽屉原尺寸稳定截图；普通页面未发现新增明显交叠，原生抽屉/折叠存在阻断。
- 审阅四尺寸 `after-index.json`、`after-candidates.json` 和 audit 报告：280 有效记录，无 pageerror/body overflow；候选包含有意的导航、历史及多行模型条目高度，另有普通 Disclosure 42px。零几何交叠候选不能替代动画与焦点验证。
- 修复前证据损失按 `before-integrity.json` 和最新 audit 报告界定：95 张原单图被错误覆盖，原完整 before-matrix 几何未保留；部分联系表、extra/native 图仍存。没有将覆盖图当作原图或宣称完整前图保留。该损失不是当前业务失败原因。

## Validation
- Risk Level: S2
- Evidence Reviewed / Checks Performed:
  - 独立审阅全部 18 个前端文件 diff、相关共享组件实现、Spec/Plan、设计稿与实施报告；未发现 API、存储或真实平台行为的越界修改。
  - 沿用实施者已通过的 apps-only TypeScript、3 个相关集成测试文件共 5 项测试及 diff 检查；未重复执行。
  - 对新的模型键盘焦点疑点执行一次隔离页面截图/几何检查；随后只补充同一具体问题的焦点色与 Disclosure 高度诊断。使用 mock preview，无真实 API 写入。
  - `acceptance-focus/model-name-900.png`、`metrics.json`、`disclosure-900.png`、`styles.json` 保存在 `build/desktop-layout-audit/`。
  - 正常动画停帧证据采用 audit 在导航前注入可冻结 rAF 的补测。旧的加载后替换 rAF / reduced-only 结果不作为正常动画可靠性证明。

## Issues

### R1 — 抽屉与折叠的可用状态仍依赖动画帧

- 位置：`apps/desktop/src/components/beui/drawer.tsx` 第 72–99 行；`apps/desktop/src/components/beui/collapsible.tsx` 第 259–300 行。
- 原生历史抽屉在 `native-after/02-history.png`、`02-history-stable.png` 相隔约 10 秒仍只露出右侧一段，关闭按钮和多数内容位于窗口外。root 在宽窗 Raise、Tab 后的 `33-history-wide-raised.png` 仍观察到同一问题。Chromium 正常/reduced 的补测未复现抽屉，因此不把浏览器结果当原生通过。
- 折叠在原生 `07-persona-details.png`、`29-license.png`、`30-updates.png` 中 AX 已展开，但视觉字段仍隐藏。audit 的 `after-motion-normal/no-frames-disclosure-{900,1280,640,380}-focused.png` 用预加载 rAF 冻结在四宽复现，排除了仅截图抓到第一帧的解释。
- 源码将 Drawer 的初始 x/opacity 和 Collapsible 的 height/opacity/indicator 交给 motion 更新；停帧时逻辑 open 与视觉可用性分离。
- 要求：在共享原语/产品适配层恢复同步可用的打开与关闭状态，保持焦点陷阱、Esc、回焦、inert、滚动锁及已有公共行为。覆盖同根因的历史/审批/窄导航抽屉、设定/日期/扩展/关于等折叠。不得只对一页加 CSS 特判或隐藏功能。

### R2 — 模型名称焦点线重新压住文字，焦点样式未统一

- 位置：`apps/desktop/src/style.css` 的 `.model-name`（约第 678–686 行）、共享 `:focus-visible`（第 107–114 行）与 Disclosure 焦点规则；`Models.tsx` 新增可聚焦的编辑标题。
- 本次将模型名称横向 padding 从 6px 改为 0；全局 outline-offset 为 -2px。独立实测 `focusVisible=true`，button.x 与首段文字 x 均为 96，2px 轮廓压住左侧首字与下方模型信息。见 `acceptance-focus/model-name-900.png` / `metrics.json`。
- `styles.json` 还证实模型名称和 Disclosure 实际 outline 为 `rgb(32,43,51)`，Tabs 为品牌蓝 `rgb(34,120,159)`；root 原生设定/关于的黑框及编辑标题浏览器默认蓝矩形与之对应。不能仅从 CSS 写了 token 就声称实际渲染一致。
- 要求：恢复文本与焦点边界的安全间距，并让产品交互控件和新增焦点交接目标使用一致、可见的焦点呈现；不以移除焦点指示解决。

### R3 — 普通折叠触发器为 42px，未满足已定的 40px 控件契约

- 位置：`apps/desktop/src/style.css` 第 66 行 `.ui-disclosure .disclosure-trigger`。
- 当前单行 line-height 20px、上下 padding 各 10px，加继承的 1px 边框，实际高度为 42px。四尺寸元素报告与独立 `styles.json` 一致；这是普通折叠按钮，不是有意的多行导航/模型条目。
- 要求：共享触发器单行 border-box 与普通按钮统一为 40px，保留长标签自然增高的能力，不裁切多行文本。该项是局部尺寸修正，无需重复全项目测试。

## Regression Risks
- R1 需要修改共享浮层/折叠实现；重点验证正常与减少动画、停帧、开闭焦点/可访问状态，及原生实际打开。既有通过的其他表单请求测试不应机械全量重跑。
- R2/R3 是共享样式与模型名称局部回归；用针对性的焦点截图、边界/高度检查即可。
- 保持内部列表滚动、原数据/事件处理和浅海蓝/beUI，不以本次返工扩展后端或真实服务测试。

## Required Rework
由新的实施 Agent 串行关闭 R1–R3，再交新的独立验收 Agent。当前普通页面的有效 after 可沿用；只有受返工影响的浮层、折叠、焦点和控件尺寸需要重新采样，不要求无理由重拍所有已通过状态。
