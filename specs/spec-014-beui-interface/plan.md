# Plan

## 范围与实施顺序
单实施Agent统一修改高度耦合的共享控件/页面：先完成beUI源码闭包及主题，再改Input/Select/Checkbox和调用；之后Tabs/Drawer/Popover/Collapsible/状态组件；最后Chat展示/PromptInput与导航。保留Controls/UI薄组合边界，不迁移业务状态到组件库。

## 已知直接风险
上游Tabs将所有非ASCII替换为下划线，会使多个中文标签id相同，须在来源适配中使用稳定唯一编码。PromptInput默认Enter发送、loading/disabled语义与本产品不完全相同，须显式适配；不能伪造FormEvent来调用旧发送函数。Input原事件如保留，必须由真实input change事件传递。Select空值与label，Checkbox包装label与嵌套label问题，Drawer内浮层/焦点/滚动，均须在正确组件层处理。

## 验证
S3：广泛共享控件及用户输入/浮层交互；范围限前端。不运行旧Runtime/平台/数据库全套。一次最终frontend TypeScript和前端相关ESLint，两production builds，原desktop-webui回归保留，并用真实生产组件配隔离IPC验证表单值/验证、选择空项、checkbox、中文Tabs、浮层关闭与焦点、PromptInput草稿/换行/提交/忙碌编辑等直接风险。可扩展既有UI测试，避免逐实现镜像测试。

实际查看所有受影响主要模块的代表视图，宽度1100/820/640及380核心页；检查菜单/选择器打开状态，不能只看默认首屏。已过检查不无理由重复；只针对新代码/具体失败追加。新独立验收读证据并作独立判断，发现FAIL按规则新实施/新验收闭环。通过即停止。

## 产物与回滚
Desktop/Web共用源码，保留现有产品数据与API，无迁移。root在最终前端冻结后同步必要资源/metadata、更新本机包与截图；按持续授权本地commit，不push。源码回滚通过后续用户授权Git操作，不自动重写历史。

## Implementation Report
实施Agent /root/implement_beui_interface 已完成并冻结源码，完整报告已读取处理。新的独立验收Agent /root/accept_beui_interface 已PASS，完整报告已读取处理；无需返工。root随后按持续授权本地commit，不push。

### Summary / Files Changed
Controls、UI、Surfaces将表单Input/Select/Checkbox/Button、导航BounceSidebar/Tabs、Drawer/Popover/Collapsible/Tooltip、Alert/AnimatedBadge/Card/Loader及Message/PromptInput实际接入全部相关Desktop/Web页面。固定来源与本地适配清单见components/beui/NOTICE.txt；两个前端继续携带MIT。保留72px导航、60px单顶栏、720px阅读列和DS蓝。仅新增固定lucide-react1.67.0及@floating-ui/dom1.8.0依赖闭包，无原依赖升级或生产依赖变化。

### Important Decisions / Root Cause
Input回传真实React事件，Select/Checkbox使用string/bool回调；保留空选项和浏览器校验。中文Tab唯一编码与真实TabPanel双向关联、Checkbox独立label、浮层按当前dialog作用域定位及逐层消费Escape，均在组件职责层适配。PromptInput保留换行/IME/忙碌编辑及原始提交文本，Chat继续拥有草稿与请求，隐藏Chat时关闭声音入口。未启用Preflight导致浏览器button默认padding挤窄勾图，已在最小基础样式reset修复；实测复选控件20px、勾图12px。去除被替代的原生控件/details/dialog样式，避免双重样式职责。

### Validation
- Risk Level: S3，限共享前端及其交互。
- build/beui-interface/typecheck.log、lint.log：最终前端类型/相关ESLint通过。
- build-desktop.log、build-web.log：两个production构建通过。Desktop index-BmIT4fXS.js，Web index-N-KjGP6x.js，共用index-BpPE81fh.css。
- desktop-regression.log：原聊天/草稿/请求归属/未知结果/只读/审批回归及Enter/IME通过，12.33秒。
- controls-test.log：输入原生属性/校验/真实事件、Select空值/键盘、Checkbox标签/Space、中文Tabs、嵌套浮层焦点/Escape/滚动恢复与reduced-motion通过。
- overlay.log、overlay-results.json：正常动画下嵌套浮层与380px核心页通过；checkbox-final.json核对最终复选尺寸。
- summary.json、metrics.json与截图：20页×1100/820/640共60视图，零前端异常/横向溢出，采集等待动画稳定。采集结束后browser.close未返回，停止该采集进程；不声称采集进程成功退出。最终通用/数据复选图另按三种宽度刷新。
- frontend-tests.log为首轮Checkbox名称定位失败历史；已由上述两个最终通过测试日志替代。git diff --check通过。
- 实施者实际目视各主要业务页面与380px/浮层代表图；root实际目视聊天、模型、通用、抖音、640px审批和正常动画抽屉内Select。不是逐张独立目视60图，独立审阅范围待Acceptance。

### Known Limitations / Remaining Questions
普通长文/JSON/persona textarea、隐藏file input、audio、品牌图片与语义列表/布局保留原生；没有直接通用beUI等价项，不算迁移完成声明的一部分。构建保留客户端库use-client和主JS超过500kB非阻塞提示（Desktop616.11kB、Web617.18kB），不为消除提示扩大拆包。未运行Runtime/平台全套、真实服务或Windows测试；没有阻塞问题。

### 本地打包
root复用未变化的Runtime/Node/生产依赖，同步最终Web与manifest/lock后执行Tauri打包，实际退出0。Mac app642.90MiB、DMG200.46MiB，路径为apps/desktop/src-tauri/target/release/bundle/macos/BigFatFish.app及bundle/dmg/BigFatFish_0.1.0_aarch64.dmg。DMG SHA-256：b9dd96ec85760aca5e49f143f8d5bfa9ff357eb08b4fa123c3be16cb7ffecd7f。package-evidence.json确认嵌入Desktop资产、随包Web5文件、manifest/lock、MIT与当前源码/构建一致。本轮未原生启动，仍local ad-hoc未公证。

### 覆盖调研完成
/root/audit_beui_coverage 的完整只读报告已读取处理，核心映射与Spec一致：Input/Select/Checkbox/Tabs/Drawer/Collapsible/Popover/Tooltip/Alert/AnimatedBadge/Loader/Card/PromptInput/Message及适用Sidebar组合。通用Textarea、隐藏file input/audio/品牌图和普通语义列表/布局无直接通用对应，明确保留。Switch只在本就符合开关语义时可用，不改变保存后生效流程。

调研核实SelectValue使用labelFor(value)及空值合并逻辑，空字符串应作为实际SelectItem注册；SelectTrigger需补原生属性/ref/label关联。Checkbox根为label，需消除嵌套。Tabs中文id冲突、PromptInput Enter/trim/loading及浮层裁切/键盘/中文辅助文本风险已交实施者。调研未改文件或执行测试，不作为实现验收。

### 独立验收与收尾
新验收者实际审阅10张最终代表图及源码/验证/包证据；仅补查已明确的380×500边界，发送按钮x279/y431/w72/h40，输入322×62，文档和main宽380无横溢出，进程退出0。最终PASS，未重复通过套件。root补采历史截图退出0并实际目视，docs/design的chat/settings/history/general/data五图均为本轮。持续本地commit授权有效，无push/PR/合并操作；远端本轮未刷新。不追加验证或恢复旧P0–P7。
