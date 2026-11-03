# Plan

## 范围与根因
修改App、Chat及style.css；按需要扩展UI.tsx明确的图标/组合布局。App和Chat各自独立绘制顶部框架、会话列表宽屏常驻导致结构重复，需在展示组合层合并，不能靠整体缩放或隐藏必要操作掩盖。

## 顺序
1. 单实施Agent整合单顶栏与窄导航，复用现有Drawer承载历史，不改聊天业务状态。
2. 适配窄屏/长标题和非聊天页；更新既有desktop-webui定向回归的历史入口操作和少量布局断言。
3. 记录代表截图及验证；新独立Agent验收；主Agent更新本机包、文档与本地commit。

## 验证
S2：App/Chat/共享布局交互，限定前端。一次frontend TypeScript检查、相关文件ESLint、既有desktop-webui定向交互测试；查看代表宽度聊天/历史/设置截图。构建Desktop/Web并更新已有本机产物；不运行全项目测试、Runtime/平台/旧60页矩阵。验收者优先读证据、只做必要独立判断，不机械重跑。检查通过即停，失败仅针对具体影响返工。

## 风险与兼容
避免重新挂载Chat导致草稿丢失、回调传递导致请求重复、隐藏的Chat仍保留模态、窄屏操作挤出。API/数据/依赖不变，无迁移。

## Implementation Report
实施完成，新独立验收PASS。

### 首版目视检查
实施者采用App的renderHeader组合回调，Chat保留会话动作/标题状态，App提供全局审批/连接操作；不迁移聊天业务状态。主协调者实际查看 build/compact-chat/chat-1100.png：导航72px、顶部60px、历史不占常驻列，消息/输入以720px阅读列居中。界面方向符合用户反馈，继续窄屏/交互检查。预览旧进程已结束，实施者新建owned Vite exec session94483，同loopback53421/blue.html。

### 最终实施报告

/root/implement_compact_chat 已冻结源码。修改App/Chat/UI/style.css及既有desktop-webui测试：72px窄导航，60px单顶栏；renderHeader保留App全局状态与Chat会话职责，Chat持续挂载。历史改为按需Drawer，选择当前会话也关闭，非活动页面关闭；720px阅读列统一消息/输入左右边缘。无依赖、Runtime/API/数据/权限变更。

S2前端检查：npx tsc -p tsconfig.json --noEmit、App/Chat/UI与定向测试ESLint、两前端构建、npx vitest run tests/integration/desktop-webui.test.ts（1项7.45秒）、git diff --check通过。首次定向测试因为旧用例直接点击默认收起的历史而超时，4处选择改为真实历史入口后重跑通过，原草稿/请求归属/只读/审批错误断言保留，新增单顶栏/窄导航/历史关闭与焦点断言。随后等价缩进与去重复状态未无理由重跑类型/lint。

build/compact-chat/metrics.json、layout.mjs和12张chat/history/settings截图覆盖1100/820/640×760、380×500。可见顶栏均1条60px；宽屏导航72px，窄屏收起；发送底边727/727/731/471；无前端异常和横溢出，消息/输入左右边缘一致。初始度量错误包含关闭details里的未绘制框，已改为直系顶部动作并留measurementNote，不是产品溢出。实施者目视1100/820/380聊天、640历史、1100设置；root另看1100和380聊天、640历史、820设置。均为隔离IPC示例，未调用真实服务。

最终资源Desktop index-03TosSDu.js、Web index-CY9vEUkm.js、CSS index-7QmdWZzq.css。root仅同步新dist/web到既有portable、复用未变Runtime/Node/依赖后进行Tauri打包；首次日志重定向相对路径写错，命令未启动，改绝对日志路径后执行。打包日志build/compact-chat/tauri-build.log，最终产物证据待补。docs/design更新聊天与设置图，新增历史图；Spec011通用/数据截图保留为当时历史，不当作本轮布局。

### 本机产物完成

Tauri打包进程退出0，app/DMG已更新；最终DMG SHA-256 `7e093ea6355f5b085c53154101534eb4c6879d86ff8b5b2b3ddd8c2103142bd7`。包内Web4文件与当前dist逐字节一致，Desktop最终入口/CSS路径存在于app二进制，证据 `build/compact-chat/package-evidence.json`。产物路径仍为 apps/desktop/src-tauri/target/release/bundle/macos/BigFatFish.app 和 bundle/dmg/BigFatFish_0.1.0_aarch64.dmg。本轮未启动原生app，仍为本地ad-hoc签名、未公证。

## 最终闭环

新独立验收 /root/accept_compact_chat 为PASS，实际审查4张代表图、相关源码/测试与度量/产物证据，不重复测试。无剩余直接问题；协调者已完整读取全部实施/验收报告，按用户持续授权本地commit，不push。必要验证完成即停止。
