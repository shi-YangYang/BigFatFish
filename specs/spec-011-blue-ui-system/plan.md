# Plan

## Scope / Ownership

一个新的实施 Agent 串行负责共享前端组件、CSS、所有相关业务页与Web登录；协调者维护规格/来源/交接和最终产物。实施前先用隔离数据检查当前页面，记录具体错位原因；不得访问真实鱼/外部账号。独立验收由新的 Agent 执行。

## 顺序

1. 检查实际页面布局；以 Button/Field 等稳定语义建立基础组件和蓝色 tokens。
2. 迁移实际使用点并整理冲突CSS，按现有handlers保留提交、disabled和状态。
3. 补齐现有UI fixture用于次级表单展示，测量代表控件尺寸/行内底部/字段边缘，查看各页和窄屏截图。
4. 定向UI类型、两个前端构建、已有 desktop-webui 回归；必要只增加能捕获已观察布局问题的少量几何断言，不逐组件镜像测试。
5. 新独立验收后更新本机包（复用未变Runtime/依赖），最终本地commit。

## 风险与停止

S2：公共控件和样式影响多个业务页；重点检查表单语义、ref/受控值/可访问标签与布局。无 Runtime/认证/schema 变更，不全量跑旧平台测试，不重复已通过且源码未变的检查。所有直接问题解决且验收PASS后停止。

## 来源与选型

- DeepSeek官网 https://www.deepseek.com/ 的 `/_next/static/css/ddd6172044536759.css` 实际包含 `--ds-color-brand:#4d6bfe`（2026-11-03核实）。
- beUI https://beui.dev/docs/theme 要求 Tailwind CSS4；https://beui.dev/components/motion/button 的组件使用 Motion、语义 tokens，源码分发。仓库 https://github.com/starc007/ui-components ，查询版本6f153a06d2225ba07a0137f317ce19faf8da69ef。当前缺少其样式/动画依赖，本轮采用用户允许的手动封装，不引入另一UI库或把参考当成已接入。

## Implementation Report

实施初期记录：协调者已查看 `build/blue-ui/before-general.png` 与 `before-data.png`：通用设置把数据目录/后台复选/启动复选/保存混排成两列；备份路径仅半列，口令/包含凭据复选与操作继续错位。实施者同时定位记忆筛选区 align-items:center 与审批/插件 article button 外边距造成的不一致。修复落在组件与表单/操作行结构层。

旧53421预览进程已结束；本轮实施者在相同loopback端口启动隔离Vite（exec session91721），用于当前生产界面布局检查，未访问真实数据。最终截图/度量及检查结果见下方完成报告。


### 实施完成报告

实施 Agent `/root/implement_blue_ui_system` 已冻结源码。新增普通源码 `Controls.tsx`，提供 Button/Input/Select/Textarea/Checkbox/Field/ActionRow/FormGrid，并迁移 Desktop/Web 业务页。品牌 #4D6BFE，主按钮/链接 #3959E4，选中背景 #EEF2FF。修复混排网格、筛选底边、文章按钮外边距、图标尺寸与双入口审批详情缩进；清理替代的全局控件样式。未修改依赖/Runtime API/业务逻辑。

S2 验证通过：

```sh
npx tsc -p tsconfig.json --noEmit
npx eslint apps/desktop/src apps/web/src tests/integration/desktop-webui.test.ts
npm run build:desktop
npm run build:web
npx vitest run tests/integration/desktop-webui.test.ts
git diff --check
```

定向UI测试1项6.89秒，新增通用设置左边缘、备份操作行、记忆筛选底边断言，既有草稿/请求所有权/审批错误回归保留。实施者对迁移事件/ref/value/checked/disabled/required作AST对比，结果一致。最后仅调整审批详情共享class/CSS，定向重查6张视图并重建两前端，没有无理由重复其他检查。

实际生产前端配隔离IPC，20页×1100/820/640共60视图，零前端异常/横向溢出；证据 `build/blue-ui/summary.json`、`metrics.json`。普通控件40px、显式紧凑动作32px；历史会话多行内容列表66px例外。通用字段左边缘320/212/20px，备份按钮底边一致；聊天发送底部727/727/731px。协调者已实际查看1100通用/记忆/聊天和640备份图，布局符合预期；新独立验收仍需检查其他代表图及代码。

重点图：general-1100、data-1100、memories-1100、persona-820、qq-640、bilibili-1100-bottom、douyin-820-bottom、approvals-640、login-640（均在build/blue-ui，png格式）。预览为 loopback `http://127.0.0.1:53421/blue.html`，exec session91721；旧current fixture不用于本轮复杂页验收。未访问真实账号或鱼。

### 首轮产物（历史，已由返工后产物替代）

最终前端：Desktop `index-vWkV13sb.js`、Web `index-Bo2-h8PY.js`，共享 `index-CCiPVpYC.css`。协调者同步本轮 dist/web 至既有 build/portable/dist/web，复用未变 Runtime/Node/依赖；以 `cd apps/desktop && npx --no-install tauri build --config '{"build":{"beforeBuildCommand":""}}'` 打本机包，不重复已通过前端构建。本机 app/DMG 已成功（app642.46 MiB、DMG200.29 MiB）。DMG SHA-256 `53b7dcd71409b50c1268f8d4d916ff99e2ba61f4aedaf27ca22bb02df2d11371`；app中随包Web4个文件与本轮dist一致，证据 `build/blue-ui/package-evidence.json`。未启动原生app、未访问真实鱼；签名仍为本地ad-hoc，未公证/发布。

交付截图：docs/design/desktop-webui-chat.png、desktop-webui-settings.png 已更新为蓝色版本；新增 desktop-webui-general.png、desktop-webui-data.png 展示本轮复杂表单修复（隔离示例数据）。


## 首轮验收与局部返工

新独立 Agent `/root/accept_blue_ui_system` 首验 FAIL，仅一个P2：Setup.tsx 的共享 ConfirmAction 未迁入 ActionRow，确认/取消相邻边缘相等、间距0；同时影响备份恢复与在线/离线更新确认。其余12张复杂页截图、基础控件与提交/草稿/审批语义无阻塞。

新实施者仅用已有 ActionRow 包裹两按钮，保持事件/type/文案；风险 S1，只做一项对应的隔离布局核对，不加镜像测试，不重跑全量类型/lint/UI矩阵。为交付修复后的可用包，需要重建两个前端及本机包，这属于受影响产物更新，不是扩大业务验证。再由新的独立验收 Agent 只读复验此共享根因和已有证据。


### 局部返工完成

新实施 Agent `/root/rework_blue_confirmation` 仅在 Setup.tsx 的 ConfirmAction 用既有 ActionRow 包住确认/取消按钮；type、事件和文案全部保留，调用方不改，三个入口同时生效。

S1，仅一次640×760隔离布局核对：确认right=107.125，取消x=117.125，gap=10px，两按钮40px高、bottom同为760.1875。此为可滚动页面中的确认区域，不要求全页内容固定一屏；只展开确认区，未执行恢复/更新。截图 `build/blue-ui/confirmation-fixed-640.png`。未新增测试/重复typecheck或完整矩阵。

作为交付产物更新，执行 `npm run build:desktop` 和 `npm run build:web` 成功；最终 Desktop `index-DzqUVpyB.js`、Web `index-D436vfjL.js`，CSS仍为`index-CCiPVpYC.css`。协调者同步新Web dist到已有portable并重新打包本机app/DMG，最终证据见下节。前述hash与入口文件属于首轮产物历史。

### 返工后最终产物

本机 app/DMG 已重新生成（DMG 约200.29 MiB）；DMG SHA-256 `4c4ec9610e73d38aab7659ec5deabbbeadeeb2d919bb7a64ca6a5b81b4a31c4c`。包内 Web4个文件与最新 dist/web 逐字节一致，Desktop入口为 `index-DzqUVpyB.js`；证据 `build/blue-ui/package-evidence.json`。此记录替代首轮产物hash，最终打包日志在工具输出截断后未取回，不据此虚报进程退出码；已核实新app/DMG时间与实际资源。未启动原生app，仍为本地ad-hoc签名。

## 最终闭环

新独立验收 Agent `/root/accept_blue_confirmation` 对共享修复、三个调用方、局部截图和最终产物证据完成 S1 复验，结论 PASS；首轮唯一 R1 已关闭，历史保留在 acceptance.md。全部实施/验收报告已由协调者读取处理。无直接未解决问题，不再追加测试。按用户持续授权完成本阶段本地 commit，不 push/PR/发布。
