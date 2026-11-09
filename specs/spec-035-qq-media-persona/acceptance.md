# Acceptance

## Result
PASS

独立验收 Agent：`/root/accept_qq_media_persona`。业务改动符合 Spec035，当前人格应用及开发实例恢复证据已核对，无剩余代码阻断。

## Spec Coverage
- QQ 自动回复的公共发送路径不再添加 reply segment；私聊、群聊及带表情回复的协议断言同步。输入引用元数据、去重、身份和最终发送授权保留。
- 托管 NapCat 初始文件和登录后配置共用 onebotConfig，统一开启 enableLocalFile2Url；修复位于原配置契约不一致的职责层，覆盖 Docker 与原生入口。插件图片使用 get_image，仍只消费有界 base64，不读返回路径或 URL。
- 媒体上下文区分已读取、收到但未获取、格式/大小和识别失败；取消或撤权在异常分支重新检查后抛出，不继续生成或发送。原账号核验、generation/revision 和大小限制保持。
- daughter 通过具体情境及原创例句增加情绪、顶嘴和 token 鱼粮梗；真实余额与外部操作事实边界保留。新增情绪提示仅在聊天分支，后台格式、受众身份、自定义人格及历史保存机制未改变。
- 当前原 daughter 经既有版本化 API 从 v3 保存为 v4；协调 Agent 的应用证据记录了写入前完整旧值核对、五个人设字段更新、其余五字段保留及完整 v3 历史。未添加静默全局迁移。
- 直接相关文档已同步。审阅发现的 developer.md 旧引用说明已修正，本轮未新增 UI、API、schema、依赖或越界功能。

## Validation
- Risk Level: S2。
- Evidence Reviewed / Checks Performed: 独立阅读 Spec、Plan/实施报告、Decision016、相关全部业务与测试 diff，并核对媒体识读、发送授权、人格保存及后台提示调用边界。
- 审阅既有检查证据：一次 build:node 通过；六个相关文件筛选的 12 项定向测试累计通过。首轮 2 个新增测试输入问题修正后只重跑失败项，其余已通过检查未重复执行。检查范围与本次改动相称。
- 测试覆盖按 NapCat 开关有无 base64 的真实契约、实际 DSH image_url 请求、语音转写、媒体失败/不安全引用/获取中取消，以及私聊/群聊/表情无引用、续聊人格更新、身份与结构化后台隔离。不是以文字发送成功替代图片识读证据。
- 核对协调 Agent 在 Plan 追加的实际应用记录及忽略目录 `build/qq-media-persona/live-evidence.json`：新 Runtime 39037、人格 v4；用户完成重新登录后 QQ enabled=true、health=online、component=online，恢复原保存范围；托管图片配置开启。
- 验收未重复运行测试、build、lint、typecheck，也未调用真实模型、发送 QQ 或操作用户配置。仅新增本文。

## Issues
无未解决的代码或文档阻断。当前实例重启后的旧图片标识只读请求返回 failed/retcode1200、没有字节，原因未确证；没有将该实际请求写成识图通过。

## Regression Risks
- 真实新图片的字节获取和云模型识图、人设主观口吻仍待用户重新发图/聊天验证。本地协议与模型夹具已覆盖目标行为，但不冒充真实端到端结果。
- 当前用户已安装的旧 QQ 插件未静默覆盖；固定 NapCat 中旧 get_file 与 get_image 共用底层实现，可使用新开启的 base64 配置。
- Windows 实机、发行包和原生 UI 本轮未验证；现有媒体格式/2 MB 限制及外部服务需开启 base64 的约束不变。

## Required Rework
无。
