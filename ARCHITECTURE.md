# 架构

## 运行边界

Desktop、CLI、未来 Web Console → Runtime API/IPC → 同一个 BigFatFish Runtime → 引擎适配、平台插件、存储及辅助服务。

Runtime 统一拥有人格、模型路由、会话、记忆、任务、权限和审计。客户端只调用接口，不能直接操作 SQLite 或平台协议。关闭桌面窗口与停止 Runtime 是不同操作。

## 源码组织

- apps/runtime/src：核心后台及职责明确的普通模块，包括 AgentEngine/DSHAdapter。
- apps/cli/src：本地命令行、后台进程控制和 Runtime 请求。
- apps/desktop/src、src-tauri：React 界面与 Rust 原生外壳。
- plugins：平台/能力插件；services：复用 Python 等辅助服务。
- infra：Docker 与 systemd；scripts：工程脚本；tests：跨模块验收。

只使用一个根 JavaScript 依赖清单和锁文件。复用通过普通源码模块实现，不恢复 packages 目录，不为组件/模块增加独立发布。Tauri 保留生态需要的 Cargo 工程。

## P0 技术选择

Node.js 24、TypeScript、npm，Fastify 管理 API，Node 内置 SQLite；React + Vite + Tauri 2；Vitest 单元/集成测试，ESLint 和 TypeScript 静态检查。依赖实际版本由安装时核实并锁定。

本地 API 默认仅监听 loopback，使用随机 bearer token 和受限文件权限；不得向网页或日志公开凭据。所有管理路由认证，健康检查只返回最低限度信息。非 loopback 监听在具备 TLS/认证部署路径前不得默默开放。

用户数据与安装目录分离，支持显式 data-dir，默认按 Windows/macOS/Linux 选择用户数据位置。SQLite 迁移有版本记录且事务化；Runtime 单实例、崩溃后可恢复、退出释放资源。基础日志必须脱敏。

## P1 引擎与配置

Node最低24.9。Runtime的普通ai模块统一模型/用途路由、版本化人格、会话和消息；SQLite schema2保存产品数据，密钥以AES-256-GCM加密，独立master.key使用受限本机文件权限。客户端查询不回传密钥。

AgentEngine由固定版本DSHAdapter实现。每个回合启动拥有的受控子进程，持久会话用resumeSession恢复；真实流和取消由鉴权回环bridge连接官方引擎事件。profile禁用默认shell/文件操作和日志贡献，P1工具目录为空。它不构成OS沙箱，也不能把会话历史当P2长期记忆。

认证HTTP负责配置/会话/取消，WebSocket提供按会话隔离的消息事件。Desktop通过Rust保护本机凭据，CLI使用同一API。队列、幂等、终态与重启中断由Runtime管理；前端以选择身份和草稿版本防止旧响应覆盖新操作。

## P2 记忆与养成

schema3 在原有数据上增加记忆、来源、活动、经历、心情历史、日记与整理任务。MemoryStore 负责状态、版本、来源、去重/合并、查询及有限检索；LifeService 通过同一 Configuration/AgentEngine 执行显式触发的提取和日记任务，并参加 Runtime 关闭与重启恢复。

模型提取只生成候选，确认后才跨会话检索。检索数据作为每回合临时参考上下文进入 DSH，不写进用户消息；拒绝/删除停止后续检索，不删除原始聊天、历史日记或既有导出。活动按事件标识去重，养成状态由实际事件派生。

SQLite 是权威数据，日记 Markdown 为可重建的私有副本；导出写入受限数据目录，不包含凭据。Desktop/CLI 通过认证 API 管理记忆和任务，入口不直接读写数据库。具体预算和操作格式见 docs/ai-core.md。

## P3 QQ、受众与审批

schema4在既有数据上增加会话主体/受众、消息作者、记忆可见范围，以及插件配置、会话映射、处理/发送状态和审批。旧记忆默认私有；群只检索明确共享内容，原始私人来源摘录不随之注入。身份/授权/共享边界变化会隔离相应旧DSH上下文。

plugins/qq/index.mjs是随产品构建复制的受信任协议模块，通过受限事件/状态/发送接口连接Runtime的channels服务；核心服务拥有人格、记忆、存储和权限，不加载上游独立大脑。NapCat由用户独立运行，不捆绑代码，当前只实现正向WebSocket。

入站授权回复走统一ChatService，发送前再次核对当前账号/许可/状态。主动消息先保存绑定目标和内容的审批，批准返回executing，再查询sent/failed/unknown；未知结果不自动重试。媒体只接受认证入口显式提供的有限字节，拒绝路径、URL和缓存名透传。平台token复用统一加密存储，主密钥缺失检查覆盖所有已实现加密表。详见docs/qq.md与Decision005。

## P4 B站观看与统一理解

schema5增加视频任务与请求ID映射。Runtime的bilibili模块拥有配置、加密账号、观看状态及生命周期；plugins/bilibili保留固定whale实际CLI/QrAuth依赖闭包、许可与补丁，经构建复制随产品使用。上游只处理平台数据和采样，不加载自己的DSH、人格或调度。

执行使用显式工作/缓存目录、受控只读命令和网络；临时明文凭据限制访问并随执行/取消/异常退出清理，重启回收残留。检查实际字幕和画面文件后，由同一个AgentEngine/DSHAdapter传递有界图像完成理解，观察证据与模型总结分开。Runtime记录活动与候选兴趣，可进入同一日记；分享使用P3已有QQ审批和最终发送门。

观看是字幕及九帧采样，缓存/部分结果/缺依赖明确显示。真实上游、ffmpeg、DSH和原生桌面已有本机夹具证据，真实平台账号仍未验证。自主浏览在P5接入统一调度，当前没有第二个B站调度器。

## 上游边界

DSH 与平台适配使用真实、已核对的公开接口。上游代码不未经许可复制；研究结果进入 docs/upstreams.md。平台事件转换为统一事件，不能维护第二套人格、记忆或调度。社交写操作必须经过统一权限和审批门。

## 验证边界

单元/协议测试、真实 Runtime 进程运行、外部账号实测、操作系统构建和安装验证分别记录；任一层通过不能替代其他层。跨平台 CI 配置存在不表示 CI 已执行。
