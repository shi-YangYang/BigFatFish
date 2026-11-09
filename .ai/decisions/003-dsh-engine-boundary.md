# Decision 003: DSH 引擎与统一模型边界

## Context

P1 必须提供真实 DSH 驱动的聊天、人格和会话恢复。已核查官方仓库、npm 发布包及实际类型，证据汇总在 [上游记录](../../docs/upstreams.md)。master 文档和已发布接口存在差异；默认 sdk-minimal 包含本产品不能默认开放的 shell、文件操作和日志贡献插件。

## Decision

- 固定官方 SDK、引擎与必要 provider 插件到已核查的 `0.2.2-alpha.2`。使用普通源码 `AgentEngine` 接口隔离依赖，产品数据模型不依附 DSH Session 格式。
- 使用本产品独立 DSH_HOME 和工作目录，给子进程明确选择的环境变量，不继承其他应用的模型凭据或配置。会话恢复用实际 `resumeSession`，不以读取数据库历史冒充引擎恢复。
- 以受控 profile 关闭默认 shell、文件和工作目录工具，以及会话日志和插件清单贡献。自有桥接插件只负责真实流事件、原生取消和 Runtime 工具分发；业务逻辑、权限及长期记忆仍在 Runtime。
- 不编造 SDK 缺失的取消或流式 API。桥接使用发布版本的 `agent/assistant-stream` 与 `agent.cancel/whenIdle`，经鉴权回环连接传送，不能污染 SDK stdio 协议。桥接不构成操作系统沙箱。
- DeepSeek 使用官方 Messages provider；OpenAI 兼容及本地端点使用官方 pi-ai provider。上下文、输出上限和视觉能力显式配置，不能把 provider 的宽松默认值当真实模型能力。云端默认 HTTPS，本机测试/本地模型允许 loopback HTTP；拒绝 URL 用户信息，凭据单独传递。
- API Key 使用加密存储，独立本机密钥受与连接凭据相同的权限约束；配置查询只返回是否已设置。密钥不能进入 argv、日志、profile、数据库明文字段或前端回读。备份排除本机密钥，迁移时由用户重新提供凭据。
- P1 先用真实 DSH 子进程连接测试专用 HTTP 模型夹具验证流、取消、恢复和工具边界。该夹具不进入生产路径，不代表真实云模型调用已通过。真实凭据不从其他应用查找，也不为验收擅自调用收费服务。

## Reason

实现产品指定引擎，同时保留更换引擎与迁移用户数据的能力；将预发布接口变化和工具权限限制在明确的适配边界。

## Alternatives

未采用直接调用模型 API 替代 DSH、加载默认高权限 profile、复制上游独立人格/记忆系统或创建额外公共 npm 包。

## Consequences

P1 按 S3 验证，必须有真正 SDK/子进程集成证据。固定预发布版本需记录兼容限制；Windows 构建与真实云模型验证继续独立列出，未验证项目不能标为完成。
