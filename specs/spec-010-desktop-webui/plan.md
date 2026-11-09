# Plan

## 范围与顺序

1. 协调者核实品牌参考并提供本地大肥鱼娘资源；维护决策、Spec 和交接。
2. 一个实施 Agent 串行修改共享 App、CSS、业务 UI 组件和 Web 入口。先外壳/导航/断连，再聊天/表单/次级分区/审批，接入本地品牌资源与 favicon。保持既有 API 和权限契约。
3. 更新原生 PNG/ICO/ICNS，按现有 Tauri 配置使用；不迁移目录。保留素材来源和复现命令。
4. 定向 UI 类型检查与 Desktop/Web 构建；隔离示例检验主要入口、发送草稿/会话/断连、审批和宽度，保留截图。原生 icon 本地构建/资源检查只覆盖本次受影响部分。
5. 新独立验收 Agent 对照 Spec、diff 和证据检查，必要返工按 AGENTS 闭环；通过后本地 commit。

## 分工和接口

UI 实施 Agent 独占 apps/desktop/src、apps/web/src、两入口 index.html、相关 UI 测试（如必要）。协调者负责品牌资源、图标生成及治理文档。共享品牌资源约定 apps/desktop/src/assets/fish-girl.png；导入给两宿主使用。未生成前可先布置导入但不可提交缺失引用。协调者不改业务组件，实施 Agent 不修改原生 icons/ 或治理文档以免冲突；实施报告通过消息交回并汇入本 Plan。

## 风险与验证边界

UI 状态、导航与多模块共享样式为 S2。图标生成/打包资源只检查变更的原生资源和本机产物；不因此重跑 Runtime/平台/跨系统全套测试。新增有意义的行为验证仅围绕请求隔离、断连、只读和关键入口，不写镜像实现的测试。

不更改 Runtime、数据库、认证或平台协议。真实外部服务与 Windows 继续待验。保留已通过检查的结果，相关源码未变不重复执行。

## Implementation Report

实施 Agent `/root/implement_desktop_webui` 已完成，等待新独立验收。

- App 外壳精简为三个主入口与底部设置；Workspaces 组织次级内容，UI 提供真实共用的头像/图标/抽屉/页签。
- Chat 保持挂载并按会话保存草稿；自动建会话，发送结果与原草稿/选择绑定，未知结果保留 requestId；取消、上传转写、朗读与声音配置接回原 API。
- Models 基础字段与高级配置分离；既有业务控件使用一致 CSS。业务列表失败与 Runtime 连接探测分开，避免误报断连。
- Runtime/API/数据库/平台协议未变；QQ 来源限制已明确记录于 Spec。
- 大肥鱼娘用于侧栏、我的鱼入口、概览、聊天头像、Web 登录与 favicon，关于页折叠内嵌完整素材通知；原生六种图标从同一 PNG 生成。
- README 及直接使用指南仅同步新入口位置，无旧阶段范围扩展。

### Validation

Risk Level: S2（共享 UI 状态与布局）；原生图标只追加本机打包/资源检查。

实施报告确认 UI TypeScript、定向 ESLint、Desktop/Web build、diff 均通过。`tests/integration/desktop-webui.test.ts` 定向测试 PASS（6.49s），覆盖跨页/跨会话草稿、发送期间编辑、断连、未知结果 requestId、QQ 拒绝转只读、自动建会话、审批内容和布局。准确命令：

```sh
npx tsc -p tsconfig.json --noEmit
npx eslint apps/desktop/src/App.tsx apps/desktop/src/components/UI.tsx apps/desktop/src/components/Workspaces.tsx apps/desktop/src/components/Chat.tsx apps/desktop/src/components/Models.tsx tests/integration/desktop-webui.test.ts
npm run build:desktop
npm run build:web
npx vitest run tests/integration/desktop-webui.test.ts
git diff --check -- apps/desktop/src apps/web/src tests/integration/desktop-webui.test.ts tests/integration/douyin-ui.test.ts
```

最终渲染使用既有 `build/desktop-design/current.html/current-entry.tsx` 隔离入口与当前生产 App/CSS；通过临时 Playwright heredoc 设置宽度并等待两个 animation frame 后截图。右下角“当前组件布局核对·示例数据”为 fixture 主动标记，不是生产文案。

旧 `douyin-ui.test.ts` 已同步导航与 desktop_settings fixture，未重跑其 Python/ffmpeg 链路。新增 UI 检查用实际生产前端 + 隔离 IPC 示例，不代表真实平台/模型已验证。

最终截图 `build/desktop-webui/final-chat-{1100,820,640}.png`、`final-settings-1100.png`、`final-connections-1100.png`；1100/820/640×760 无横向溢出，发送按钮底部727/727/731，均为40px高。初始640截图 resize 合成帧未稳定，经双 animation frame 重拍修正；root 已查看修正截图和1100生产界面。

### 本机产物

协调者执行图标生成命令（见 Decision 010），检查32/128/256像素 PNG、ICO 六种尺寸与ICNS格式通过。`node scripts/prepare-release.mjs` 已用本轮 Web 构建重新准备 darwin-arm64 Runtime 资源（源码 Runtime 未变，无重复 Node build）。以已验证的 Desktop dist 打包：`cd apps/desktop && npx --no-install tauri build --config '{"build":{"beforeBuildCommand":""}}'`，已成功生成本机 app（642.46 MiB）与 DMG（200.26 MiB），避免重复已通过的前端构建。


本机包路径：`apps/desktop/src-tauri/target/release/bundle/macos/BigFatFish.app` 与 `bundle/dmg/BigFatFish_0.1.0_aarch64.dmg`。DMG SHA-256 `4b56211584e3161747f6ff5d0d45b023d17d94ec9ac5627acb937a7e38783364`。已核对 app 内 ICNS 与源图标字节一致、随包 Web 的4个文件与本轮 dist/web 完全一致；证据 `build/desktop-webui/package-evidence.json`。本轮未启动原生 app 操作真实数据，也未进行 Windows 实机或真实外部服务验证；本机包保持 ad-hoc 签名、未公证/发布。

交付截图保存在 `docs/design/desktop-webui-chat.png`、`docs/design/desktop-webui-settings.png`，对应最终生产代码与明确标记的隔离示例数据。


## 首轮验收与定向返工

独立 Agent `/root/accept_desktop_webui` 首轮 FAIL；完整报告见 acceptance.md，协调者已读取并处理。只返工两个已复现问题：

- R1：自动创建会话迁移 pending 但未释放 `drafts['']`，已发送新会话草稿可在再次新建时复活。应在正确状态所有权下迁移草稿；发送等待期间编辑和未知请求 ID 不丢失。
- R2：QQ/抖音审批 Drawer 的 fail 传给外部全局错误，模态内不可见。应提供抽屉内局部持续可访问的反馈，保留原批准/拒绝与未知结果语义。

新的实施 Agent 仅修改 App/Chat/必要 UI 样式及最小定向回归；不扩 API/权限。因源码变化，相关 UI 定向检查和 Desktop/Web 产物需更新；再由新的独立验收 Agent 重验。上一轮包仅为首轮产物，最终包哈希以返工后记录为准。


### 返工 Implementation Report

新实施 Agent `/root/rework_desktop_webui` 已修复 R1/R2，源码冻结。仅改 App、Chat、CSS 和现有定向 UI 测试。

R1 根因是新建会话只迁移请求，不迁移草稿所属槽；现在在确认响应仍属于当前临时会话后，将当前文本迁移至真实 ID 并释放临时槽，保留创建/发送期间的编辑，pending ID 契约不变。R2 根因是模态内操作使用模态外全局反馈；现在由审批内容容器持有本地错误并用稳定 fail 回调供 QQ/抖音共用，保持各自审批契约、错误翻译及未知结果提示。无需 Runtime/API 变化或新抽象层。

返工 Risk Level: S2。以下因源码变化而运行，均 PASS；定向用例7.94秒。

```sh
npx tsc -p tsconfig.json --noEmit
npx eslint apps/desktop/src/App.tsx apps/desktop/src/components/Chat.tsx tests/integration/desktop-webui.test.ts
npm run build:desktop
npm run build:web
npx vitest run tests/integration/desktop-webui.test.ts
git diff --check -- apps/desktop/src/App.tsx apps/desktop/src/components/Chat.tsx apps/desktop/src/style.css tests/integration/desktop-webui.test.ts
```

新增回归检查覆盖：新对话草稿切换恢复→成功发送→再次新建为空；新会话发送等待期间编辑保留；QQ CHANNEL_OFFLINE 与抖音 ACTION_UNKNOWN 均在 dialog 内 role=alert 显示。协调者也查看 `build/desktop-webui/approval-error-640.png`，未知结果提示在窄屏抽屉内完整可见。

协调者仅同步本轮 `dist/web` 至 `build/portable/dist/web`，未重复安装未变依赖/重建未变 Runtime；随后用相同 Tauri 命令重新打包受影响的前端资源。返工后 app/DMG 打包成功，DMG 200.30 MiB，SHA-256 `4ca042adfc779099ea405d0d627de811b0926351532cbe1a47831c7c5210fbe1`。app 中 ICNS 与源图标一致，随包 Web 4个文件与最终 dist/web 一致，`build/desktop-webui/package-evidence.json` 已更新。这是本阶段最终本机包，前述首轮哈希仅保留为历史；未重复原生启动或外部服务验证。


## 最终交付

`/root/accept_desktop_webui_rework` 新独立复验 PASS，协调者已完整读取并处理报告。R1/R2 已关闭，没有本轮直接未解决问题；按停止规则不再扩大检查。最终代码、同源图像、使用路径文档、两张截图和 Spec 记录纳入本阶段本地提交；无 push/PR/发布。具体提交以 `git log` 为准，避免把未执行 Git 写成已完成。
