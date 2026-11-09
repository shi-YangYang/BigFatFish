# Plan 006: P4 B站

## 实施顺序

1. P3已独立PASS并提交9923a67；按下列已读取接口继续P4，外部验证缺口不虚报完成。
2. 固定上游版本并建立可复核的最小 data-dir 适配；保存来源、许可、NOTICE 和补丁说明。
3. 真实上游执行与结果校验、凭据/账号状态、依赖检查、超时取消。
4. 视频任务进入统一活动、理解、兴趣/记忆和日记流程。
5. Desktop/CLI 真正配置与操作，文档和风险相称检查；账号实测单列，独立验收。

## 已知接口边界

whale 实际入口为 node tools/bili.mjs；lib/index.js 是会启动自身调度的 DSH 插件，不直接加载。搜索输出为人读文本；comments --json 为结构化结果；subtitles --out 可能零退出而缺字幕；watch-video 的 SHEET/SUBS 输出必须核验真实文件。凭据与缓存的默认硬编码路径必须显式适配。完整版本与源码证据在 docs/upstreams.md。

### 前序衔接（P3验收后再次核对最终版本）

- P3插件源码在plugins/qq/index.mjs，copy-runtime-assets复制到dist/plugins/qq，Runtime加载并接收事件/健康；保留现有dist/runtime/src和dist/cli/src入口。B站沿用实际构建/加载约定，不只在源码模式可运行。
- plugin_config按插件ID保存配置/加密secret/revision，Configuration统一主密钥与全部已实现加密表检查。新增B站配置复用该边界，不建第二套密钥；上游所需临时明文文件须受限且有清理生命周期。
- 当前channels/service与permissions API仍负责QQ实际行为，不是已完成通用插件平台。扩展B站时只抽取实际复用的生命周期/审批能力，不能复制第二套治理；尤其审批撤销、在途任务和状态必须按插件/账号作用域隔离，不能停用QQ就撤销其他平台审批。
- ChatService统一拥有DSH，LifeService共享Configuration/Engine并调用memories.record形成真实事件。B站理解任务应通过同一Runtime引擎/模型用途入口实现，必要时作职责明确的局部抽取；不能在平台插件启动另一个独立大脑。实际观看证据与模型结论分开保存，候选记忆不自动成为主人事实。
- 已读取本地固定alpha.2 SDK实际类型：HarnessSession.run接受string或SdkPromptContentBlock[]；dsh-sdk-protocol的SdkEncodedImageBlock为type=image、data=规范base64、mimeType支持PNG/JPEG/WebP/GIF，说明会进入受控附件存储。当前BFF Adapter仍只传文本，但OpenAI兼容profile已根据model.vision声明text/image能力。P4可在统一EngineInput/Adapter添加有界图像块并用真实DSH+HTTP模型夹具验证实际请求，不能只凭类型文件就声称视觉已可用，也无需绕过DSH另建模型调用路径。

## 验证与迁移

S3：账号凭据、外部子进程与平台权限。真实上游程序配合受控网络/文件夹具验证协议和结果边界；持久化与活动幂等检查本产品模块；实际账号和访问内容另行验证。权限、路径、失败状态不能靠只测成功返回值替代。安装/更新失败保留旧插件与用户数据，不自动覆盖外部应用目录。

## Implementation Report

implement_p4已完成实施；新的独立accept_p4已审阅并返回PASS，结果见acceptance.md。当前dev基线9923a67，准备按阶段授权本地提交；未来Spec007–009不属于本次提交。

### 实现与来源

- plugins/bilibili保存固定whale 0.4.6 / 8b0009f8ce2ebdc421afcb2e727b19ac18912ec6的20个实际CLI/QrAuth依赖文件、LICENSE、NOTICE、原manifest元数据和bff.patch；补丁对固定原始源码dry-run通过。无独立package.json，qrcode1.5.4由根工程管理。
- 显式工作目录与持久缓存/风控目录、当前Node、只读argv/HTTPS域名/重定向/响应及文件预算；不改HOME，不读其他应用.bili-ai，不加载独立DSH/调度/写命令。comments所需ai-share只用评论缓存。
- Configuration加密账号，受限临时明文在结束、取消、父进程异常退出后清理，重启清理残留；缺依赖仅影响B站。schema5视频任务/请求ID、取消/去重/重启中断、实际字幕及九帧产物检查。
- 同一DSH接受有界图像，事实观察与模型总结分开，候选兴趣/活动和日记共用Runtime。已理解视频经既有QQ审批预览和发送门分享，没有改变QQ的最终授权校验。
- CLI/API/桌面提供配置、登录、搜索、观看、任务历史及分享。真实UI检查发现原上游诊断文本暴露给用户，已改为标题、作者和选择视频。

### Validation

Risk Level：S3（凭据、进程、schema、共享引擎）。实施报告记录：

- npm run typecheck、lint、build、最终build:node和实际macOS Tauri release编译通过；git diff --check与固定源码patch --dry-run通过。
- 上述未暂存diff检查不覆盖当时未跟踪的上游新文件；提交前全量cached检查仅报上游源码/patch格式空白，保留可复核来源，产品自有改动的cached检查通过。详见Acceptance协调检查记录。
- 定向8文件22测试：实际whale CLI、QrAuth、ffmpeg；Runtime→真实DSH→HTTP模型请求实际含JPEG和文本、工具为空；候选兴趣/活动/同日日记；QQ分享准确标题/URL、批准和拒绝；缓存、无字幕、缺ffmpeg、缺产物、超时、取消、禁用、去重，以及直接影响的foundation/DSH cleanup/configuration/QQ隐私返工/lifecycle。
- 之后新增缺依赖隔离1文件1测试、实际SIGKILL恢复1文件1测试，各自通过。后者从在途任务和临时凭据开始，杀Runtime后凭据自动删除，重启任务为interrupted。合计10文件24项不同测试，非一次全量重跑。
- 原生macOS桌面实际搜索、发起观看、处理中状态、字幕+九帧+总结+准确URL显示；最终搜索精简结果及选择BV再实际操作。CLI链路通过。
- 末次业务修改为缺依赖隔离/错误显示，此后type/lint/Node构建/Tauri release均过；最终仅新增崩溃测试，再跑相关测试/type/lint/diff，无后续业务变更。

### 验证边界与清理

真实B站扫码/账号/内容、真实QQ发送、云模型和Windows未验证。网络/账号是隔离夹具，实际运行上游、ffmpeg和DSH，不能等同真实平台或语义理解质量。观看仅字幕与九帧采样；视频128MiB、命令180秒、单图4MiB、字幕24000字。完成/部分完成BV返回已有记录，失败/中断可用新requestId重试。

缺测试ffmpeg时两项采样测试明确跳过。为复现保留/tmp/bff-whale-p4/bin/ffmpeg，可用BFF_TEST_FFMPEG指定，不是产品依赖。测试Runtime/桌面/平台子进程及用户数据已清理，仓库保留夹具；验收不机械重复已过检查。
