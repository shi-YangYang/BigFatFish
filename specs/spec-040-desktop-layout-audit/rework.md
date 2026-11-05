# Rework — 首验 R1–R3

## 目标
关闭`acceptance.md`的三项问题；沿用已通过的常规全页布局，禁止扩展业务功能。

## R1 同步可用状态
在共享beUI原语/产品适配层修复Drawer与Collapsible的逻辑open/视觉分离。打开后即使rAF被暂停，面板和内容也完整可见，关闭后立即释放交互；保留焦点陷阱、Escape、回焦、inert、滚动锁和事件契约。所有同根因入口一起生效，不做单页补丁。原生历史在900/1512宽窗失败；normal-motion折叠四宽隔离复现。测试须在模块加载前注入可冻结rAF并在交互前冻结，normal/reduce分别验证，不能只替换加载后的全局函数。

## R2 焦点与 R3 尺寸
恢复模型名称文本与焦点线安全间距；产品控件、Disclosure及模型编辑焦点标题采用一致且可见的焦点呈现。修正普通单行Disclosure border-box为40px，长标签仍可自然增高。以实际计算样式/截图证明，不仅检查token文本。

## 验证与边界
S2共享交互修复；运行最相关的浮层/折叠交互检查，并针对normal/reduce/停帧、焦点、40px以及同根因页面采样。已通过且未影响的280状态和模型请求检查不重跑。root复查原生；新的独立验收Agent复核。真实Runtime/QQ/数据不变，不commit/push。

## Implementation Report — R1–R3 返工

### Summary
三项返工实现完成，业务代码已停止写入，交根协调原生复查和新的独立验收；本报告不是最终验收结论。

### Files Changed
- `apps/desktop/src/components/beui/drawer.tsx`、`collapsible.tsx`：新增可选 `animated` 原语参数，默认保留 beUI 动画路径。
- `apps/desktop/src/components/UI.tsx`、`Surfaces.tsx`：所有产品 Drawer / Disclosure 统一选择同步可用路径。
- `apps/desktop/src/style.css`：焦点颜色及其同步显示、模型名称内边距、可聚焦标题样式、Disclosure 单行高度。
- `apps/desktop/src/components/Models.tsx`：模型编辑标题使用共享焦点目标样式。
- `tests/integration/beui-interface.test.ts`：增加真实预加载 rAF 冻结的产品浮层 / 折叠回归。
- 本目录 `rework.md`：本报告。隔离采集脚本及新截图在忽略目录 `build/desktop-layout-audit/`；保护已有 before / after 证据及首轮所有业务改动。

### Root Cause / Important Decisions
R1 的逻辑 open 已更新，但 Drawer 位置、Disclosure 高度 / 透明度 / 指示箭头由 Motion 帧推进，WebView 暂停帧时会出现可聚焦却不可见的内容。在共享原语增加显式非动画路径，由产品适配层统一启用；Drawer 同步挂载 / 卸载普通 DOM，Disclosure 直接由 React 状态写入高度、透明度和旋转，不测量动画目标。保留原有焦点陷阱、Escape、回焦、滚动锁、关闭内容的 inert / aria-hidden、受控 / 非受控事件及草稿挂载。没有单页补丁、全局关闭动画或改写调用方业务。

R2 有三个直接原因：模型名称零水平 padding 与内嵌焦点线重叠；产品 focus token 与 Tabs 不同，且 `transition-colors` 把 outline-color 从文本色插值；新增可聚焦 h3 没有产品焦点样式。模型名称恢复 6px 水平 padding；统一 focus token 为品牌蓝，并从焦点态 transition-property 排除 outline-color，使焦点同步出现；模型编辑标题使用共享 `.focus-target`，保留原本定位 / 聚焦行为。实际停帧计算样式为 `rgb(34, 120, 159) solid 2px`，不只检查 CSS token。

R3 来自 20px 行高、上下各 10px padding 和 2px border 合计 42px；上下 padding 改为 9px，保留 `min-height: 40px; height: auto`，单行精确 40px，长标签自然增高。

维护取舍：beUI 默认动画仍可复用；产品中属于可用性状态的打开 / 关闭即时完成。开关能力只在共享原语和适配层声明，不引入页面计时器或帧超时兜底。

### Validation
- Risk Level: **S2**。
- `npx vitest run tests/integration/beui-interface.test.ts`：原有表单 / 嵌套 Select、Menu / 焦点回收用例通过。新增用例调试中修正了鼠标状态误当键盘焦点、长标签改名后的定位，以及关闭按钮 tooltip 先处理 Escape 的测试预期；没有为测试改变这些产品行为。
- 最终 `npx vitest run tests/integration/beui-interface.test.ts -t 'product drawers'`：**1 passed，1 skipped**，耗时 2.69s；新增用例覆盖 normal / reduce × 正常帧 / 真预加载冻结帧四组合，包括面板视口、透明度、焦点陷阱、tooltip / Drawer Escape 顺序、背景关闭、回焦、滚动锁、折叠 inert / 内容可见 / 指示箭头、草稿保留、40px / 长标签及即时蓝色焦点。之前已通过的原有用例未再次重跑。
- 前端 TypeScript：通过 TypeScript API 读取根 `tsconfig.json`，将 include 限定 `apps/desktop/**/*.ts`、`apps/desktop/**/*.tsx`、`apps/web/**/*.ts`、`apps/web/**/*.tsx`、`tests/integration/beui-interface.test.ts`，执行 `ts.createProgram` / `ts.getPreEmitDiagnostics`，**0 diagnostics**。初次误用 `apps/**/*` 时纳入两个 Runtime 测试文件，得到 TS2352 mock 签名错误；它们不在本次修改范围，未验证其基线、未修复，也不宣称全 apps 类型检查通过。
- `AUDIT_OUT=rework-r1-r3-20261106 node build/desktop-layout-audit/rework-controls.mjs`：实际 App + mock API，normal / reduce × 900 / 1280 / 640 / 380 共 **8 组通过**。预加载包装 rAF、交互前冻结；每组验证历史 Drawer、详细设定 Disclosure、模型名称 / 编辑标题焦点。**32 张截图、0 pageerror、0 非 GET API 请求**，结果 `build/desktop-layout-audit/rework-r1-r3-20261106/results.json`。采集脚本硬性要求新输出目录并拒绝覆盖；截图没有通过禁用动画制造展开结果。
- 实看新 900 历史抽屉、380 详细设定、900 模型焦点截图，内容完整可见，焦点线与文本有间距。
- `git diff --check` 通过；只保留既有布局和本轮 R1–R3 差异。未重跑 280 状态、未变模型请求测试、全仓库套件或发布构建。

### Known Limitations / Remaining Questions
原生 macOS 补测由根协调独占执行；实施 Agent 没有使用 CUA、真实 QQ、模型请求或配置保存。原生结果及最终 PASS / FAIL 由新的独立验收记录。没有产品决策待确认。当前仍在 dev，未 commit / push。
