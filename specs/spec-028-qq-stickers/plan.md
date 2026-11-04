# Plan — QQ 表情回复

## 实施
一个实施 Agent 串行负责相关源码与定向测试；root 负责 Spec/决策/内置三张素材/隔离 UI 复查。实施与素材文件无重叠。

1. 在 channels 普通源码模块实现有界表情库和认证路由，明确持久化/备份兼容。优先清楚的数据边界，不为避开职责而把库塞进模型配置；可以增加必要的增量 schema，但不在真实用户数据上执行。
2. 内部本轮工具上下文接入 ChatService 与 DSH。保留 plugins.tools 的 local-owner gate；从内部传入名单，不从请求 JSON 读取工具能力。
3. DSH 支持受信任图片工具结果，使用已安装 ctx.attachments.saveImage 与原生 ContentBlock image；工具结果上限按单图有界调整，普通工具仍保留 64KB 上限。验证固定版本确实向模型发送像素。
4. Channels 选择暂存、完成后与文本同一受控发送生命周期提交，最后一刻复核取消/权限/库有效性。复用 existing deliver，不做即刻工具副作用。
5. QQ 表情管理组件，避免加大 QQConnection 单文件；轻量图片网格、添加表单、启停/删除，短文案。由现有 QQ 页面承载。
6. 更新 docs/qq.md、相关 API/数据说明；无需扩展无关文档。

## 已核实证据
- aigengtu.com/persona 社区卡片使用 list_stickers/get_sticker_image/send_sticker 等工具；这些是外部系统能力，提示词本身不能完成发送。
- NapCat v4.18.42 FetchCustomFace 只返回 URL 字符串数组，没有场景/标签；本轮不用 QQ 收藏接口。https://raw.githubusercontent.com/NapNeko/NapCatQQ/v4.18.42/packages/napcat-onebot/action/extends/FetchCustomFace.ts
- 用户回复网络与内置并用后核实梗鲸官方仓库 README：明确公开 CDN 热链，完整 metadata 为 https://aigengtu.com/gallery-index.json；实际读取 1,552,493B JSON，gallery['DeepSeek娘'].images 有 name/alt/story.zh/preview/original/category。固定图片路径 https://img.aigengtu.com/0_preview/meme/NNN.webp。只读调研成功不等于运行集成已通过。站点元数据曾有旧 alt 与新 name 不一致，必须看实际图；所有来源内容为不可信资料。
- DSH 安装包 attachments.saveImage({data:Uint8Array,mediaType,name}) 可返回持久引用；工具 output.render 支持 ContentBlock[]。具体 provider wire 仍需定向验证。
- Channels.deliver 的 guard 位于插件 account health 之后、外部发送之前；保留此边界。

## 验证计划
S3：涉及可信工具、QQ 外发授权和持久化/备份。仅相关子系统：库/非法输入/备份兼容、固定源网络搜索/下载边界、QQ 取消与权限撤回、真实 DSH 图像工具 wire + OneBot 发送；Node build（包含资源复制）与 apps-only 类型检查；root 一次隔离 desktop/narrow UI。测试通过即停止，不全量 test/build/lint，不调用云模型、不启动真实用户后台、不重打安装包。

## 网络来源补充
同一实施 Agent 加固定梗鲸目录搜索工具，候选少量且长度有界；真实图片工具下载 WebP、验证转换 PNG，本轮看过后可暂存选图。配置开关、缓存/下载/每轮次数有界、最终 guard 同时复核网络开关。外部 metadata 不加入系统指令。sharp 0.35.5 是现有安装的传递依赖，可声明同版直接依赖作完整解码和转换，不升级依赖。

## 素材约定
root 将内置 PNG 放在 apps/runtime/src/channels/sticker-assets/，计划 hello.png、praise.png、pout.png。工具生成结果可能需要先做尺寸/体积适配；实施者不得自行重绘或覆盖。若有尺寸限制不匹配先反馈 root。生成来源及提示词在本 Plan 追加。

## Root 素材与界面记录
内置工具 image_gen，参考 apps/desktop/src/assets/fish-girl.png，透明背景；首批 hello/praise 连接失败，重试一次成功，pout 首次成功。实际目视三图角色一致、情绪分别为招呼/求夸/赌气，无文字，未修改原图标。原样复制到 apps/runtime/src/channels/sticker-assets/{hello,praise,pout}.png，分别 1,420,292 / 1,592,510 / 1,470,748 bytes。没有调用外部 API CLI 或对生成图做程序重绘。

提示词共用前缀（内置工具实际执行）：
> Create a single square 512x512 QQ chat sticker illustration using the reference image ONLY for BigFatFish girl's identity: same blue long hair, blue-white maid-like outfit, whale tail, blue bow, soft chibi anime look, wholesome youthful mascot. Simplify to clean readable flat colors, crisp outlines, tiny shading, generous 8% padding, no text/letters/watermark, transparent background. One character only, matching reference proportions. This is a chat expression sticker, NOT an app icon. Output small optimized PNG if possible. Expression:

依次追加：
- hello: bright happy smile, waving hello with one hand, small blue sparkle, friendly energetic greeting.
- praise: hopeful sparkling eyes and rosy cheeks, hands clasped under chin asking for praise, charming wholesome playful expression.
- pout: mildly sulky pout, puffed cheeks, arms folded and head turned slightly, endearing mock annoyance without real anger.

工具实际输出约 1280px，未把提示词中的期望 512px 冒充实得尺寸；体积符合库限制。

Root CUA 使用 build/qq-stickers/serve.mjs 的隔离 API fixture 和实际 App 组件，未访问用户 Runtime。1280×720 桌面与380×820窄屏实际目视通过：表情展开、网络/本地启停、选取自己生成的PNG、名称/场景输入与添加、删除刚添加的fixture副本。窄屏document宽380、三卡宽151、常规动作40高/复选框20，无横向溢出。仅fixture标题/名称/QQ账号为示例，界面与文件读入处理为产品组件。截图：build/qq-stickers/01-desktop.png、02-narrow-add.png、03-narrow-grid.png。检查后关闭tab12、恢复viewport；不扩展其他页面检查。

## Implementation Report — 2026-11-05

### Summary
已实现 QQ 本地/网络表情库及真实图片工具：list_stickers、search_stickers、get_sticker_image、send_sticker。模型看到实际像素后才能选择，本轮仅暂存一张，和文字/引用一起进入现有 QQ deliver；发送前复核取消、账号/目标、实际生成的记忆范围及表情 revision。工具明示 queued_for_reply，不伪称已发出。无图时沿用文字回复。

### Files Changed
- channels/stickers.ts：内置三图初始化、上传/启停/删除、元数据与按需图片读取。PNG/JPEG 单图2 MB、4096边长/16MP、48张/24MB；sharp完整解码检查上传，库写入限额在同步入库处检查，避免并发上传超限。
- channels/sticker-network.ts：梗鲸固定公开目录、DeepSeek娘分类、优先固定CDN预览路径；关键词匹配8条/次，15分钟有界索引缓存。每次下载10秒/4MB，HTTPS禁重定向、DNS解析验证并固定公网IPv4连接；WebP/PNG/JPEG实际解码后转有界PNG。
- channels/sticker-turn.ts：每轮最多3次搜索/24个候选/3张查看/1张选择；查看预算在异步下载前占位，同ID下载中不重复启动；没有本轮查看记录不能选图，网络关闭或修订阻止在途选择。
- ai/chat.ts、engine.ts、dsh.ts、dsh-bridge.mjs：仅内部参数注入QQ工具，受信任图片工具经DSH attachments.saveImage渲染原生image block；普通工具仍64KB，图片工具2.8MB上限。
- plugins/service.ts：工具元数据显式挑选字段，避免插件manifest透传resultKind自称可信图片工具。保留local-owner gate。
- storage/database.ts、maintenance/archive.ts：增量schema7的qq_stickers/qq_sticker_options；plugins逻辑备份包含库与开关，明确兼容原schema6归档。恢复时验证数量、字段、base64/文件头/字节与总量；上传与DSH使用时执行完整解码。没有在真实用户数据上迁移。
- Desktop QQStickers独立组件、QQConnection挂载、样式与错误短文案；原生Tauri已有通用认证/v1路径支持，无需新特权。
- sharp0.35.5由已安装传递依赖提升为同版直接依赖，不升级其它依赖；copy-runtime-assets复制内置图。docs/qq.md更新范围/API/使用方式。
- 新qq-stickers与sticker-network定向测试；model fixture支持真实DSH三步图片工具；插件边界补恶意metadata场景。

### Important Decisions
- 原生QQ回执同时确认一条消息的text+image，沿用sent/failed/unknown/blocked，无独立工具外发、无自动重放。
- 模型需同时生成自然简短文字；空最终回答仍按原有生成错误明确阻止，不把空白占位符当作图片。
- 网络仅固定公开源，不读取任意URL/本机路径，不改NapCat；不收集QQ收藏。网络图片不持久进入本地库。
- 表情描述/图片按外部素材处理；显性不合宜词先过滤，模型看图后再判断场景。此机制不宣称绝对内容过滤保证。

### Validation
Risk Level: S3（可信图片工具、外发权限、增量持久化/归档兼容）。相关检查共20个唯一测试最终通过，按变更点定向执行，没有全项目套件。
- 首轮 qq-stickers 4项 + qq-rework 2项 + plugins/boundaries原5项：10通过/1失败。失败为原归档只允许当前schema；补明确6→7兼容后仅重跑该恢复用例，通过。
- 真实DSH+HTTP模型fixture+OneBot：list→get实际PNG像素→send暂存→自然文字和1张image同条QQ消息。后续扩大同一用例覆盖不选图与发送断线unknown无重试，通过；没有调用云模型或真实QQ。
- 单独网络source传输3项与原backup3项通过：公网DNS固定/私网拒绝、重定向拒绝、声明和流式超限、取消、原备份凭据/恢复等。
- 新恶意插件resultKind透传测试通过；库并发50次上传仅48成功+损坏raster拒绝通过；3张网络图片未完成时第4张及同ID重复下载被拒绝通过。
- 网络fixture验证预览优先、WebP实际转换PNG、来源白名单/元数据过滤、无图先选拒绝、停用网络/本地删除/取消，最终QQ健康检查期间删除阻止send_*。
- npm run build:node 最终通过（含三图分发）。首次类型检查暴露同步restore函数使用await，改为同步归档边界校验；Node RequestOptions不接受autoSelectFamily字段，使用family:4后最终构建通过。apps-only tsc通过；未跑全量typecheck/lint/build或安装包。
- 只读公开源 smoke：固定索引真实搜索「开心」返回8条；Node安全下载器读取 /0_preview/meme/001.webp 成功40470B（curl同URL IPv4直连200）。首次搜索候选603的原图/预览在本轮10秒界限内超时；不把所有候选宣称可用，不放宽限制。root另有603 curl成功证据，说明源站时延波动；工具失败允许模型继续本地表情/文字。
- git diff --check通过。root负责隔离Desktop/380px UI证据；不以代码检查代替UI验收。

### Known Limitations
- 实际云模型是否自然使用工具、真实QQ账号发图由用户后续验证；本次只使用本地协议与模型fixture。
- 第三方图库有可用性与内容差异，可关闭网络表情；未接入泛化网络搜图或QQ收藏。
- 新Runtime需重启开发进程；未启动/改动用户当前实例、未重新打包、未测试Windows硬件、未提交或推送Git。

### Remaining Questions
无实施阻塞，交root独立验收。root生成素材与UI记录所在段落保留，不覆盖。
