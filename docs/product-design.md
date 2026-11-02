# BigFatFish 产品设计目标

> 版本：v1.0 \| 项目立项基线 \| 面向 Codex 与项目开发者

## 1. 项目定位

BigFatFish 是一个开源、跨平台、插件化的 AI
养成型智能体软件。用户创建并长期运行一条属于自己的 AI
鱼。它拥有独立人格、长期记忆、兴趣偏好、社交平台身份和自主活动能力，能够与主人聊天、浏览内容、记录经历，并在授权范围内主动行动。

它不是单纯聊天客户端、QQ 机器人、Agent
开发框架，也不是只能运行在桌面上的应用。

核心原则： 1. 一个 Runtime，多种入口：Desktop、CLI、Headless Server
共用同一核心。 2. 开箱即用：普通用户不应手动安装复杂依赖或修改源码。 3.
养成体验与专业控制台并存。 4. 插件化、模块化，不绑定单一 Agent
引擎或模型。 5. 数据归用户所有，支持备份、导出、恢复和迁移。 6.
安全优先，保护账号凭据、浏览器会话、插件权限和平台写操作。

## 2. 目标用户与场景

目标用户：希望拥有长期陪伴型 AI 的普通用户；希望接入
QQ、B站、抖音的进阶用户；希望在 Linux VPS 运行 Agent
的用户；插件开发者。

典型场景： - Windows/macOS 用户下载安装桌面版，完成引导后创建 AI 鱼。 -
用户通过 QQ 聊天，AI 鱼基于统一记忆回答过去发生的事情。 - AI 鱼通过
B站插件浏览视频、理解内容并记录兴趣。 - AI
鱼通过抖音插件观看内容，并在授权后执行互动。 - 关闭桌面窗口后，后台
Runtime 可以继续运行。 - Linux 用户通过 CLI 在 VPS 安装并以 Headless
模式运行。 - 用户可以将本机的鱼迁移到云服务器。

## 3. 产品形态

### Desktop

正式支持 Windows 和 macOS。使用 Tauri 2 + React +
TypeScript。提供首次启动向导、养成主页、聊天、插件管理、模型配置、记忆管理、日志、托盘、开机启动和自动更新。关闭窗口不应默认停止
Runtime；退出应用和停止 Runtime 必须是两个明确操作。

### CLI

支持 Linux、macOS、Windows。建议命令：

``` bash
bigfatfish install
bigfatfish onboard
bigfatfish start
bigfatfish status
bigfatfish logs
bigfatfish plugin list
bigfatfish plugin install <plugin-id>
bigfatfish backup
bigfatfish update
bigfatfish stop
```

命令可调整，但必须简单、一致、可脚本化。

### Headless Server

正式支持 Linux VPS。无需桌面环境；支持 systemd 和 Docker；SSH
断开后继续运行；提供健康检查、日志轮转、异常恢复、备份和升级。浏览器自动化依赖应有明确安装流程。

### Web Console

作为后续扩展，不是 Runtime
前置依赖。支持远程查看状态、聊天、管理插件、记忆、日志和审批。远程管理必须认证、授权并加密传输，默认不向公网开放管理端口。

## 4. 总体架构与技术栈

``` text
Desktop (Tauri + React)       CLI       Web Console (future)
             \                |              /
              \               |             /
               ---- Runtime API / IPC ----
                          |
                 BigFatFish Runtime
                          |
  -------------------------------------------------------
  | Agent Engine | Memory | Personality | Model Router |
  | Scheduler | Event Bus | Task Manager                |
  | Plugin Manager | Permission Engine | State Manager  |
  -------------------------------------------------------
                          |
                Plugin / Integration Layer
                          |
             QQ | B站 | 抖音 | MCP | Browser
                          |
                SQLite + Files + Backups
```

  层级           技术                   职责
  -------------- ---------------------- ---------------------------------
  Desktop        Tauri 2 + Rust         跨平台桌面外壳
  UI             React + TypeScript     养成界面和控制台
  Runtime        Node.js + TypeScript   核心业务运行时
  Agent          DSH Harness Adapter    Agent Loop、工具调用
  CLI            TypeScript             命令行管理
  API            Fastify 或同类框架     管理 API
  实时通信       WebSocket              聊天、状态和事件
  Python         独立辅助服务           复用 Python 工具、视频/语音处理
  数据库         SQLite                 结构化数据
  记忆文件       Markdown/JSON          可读、可迁移的记忆
  浏览器自动化   Playwright             B站、抖音
  云端部署       Docker + systemd       Linux 运行

Node.js/TypeScript 是主 Runtime，Python
是辅助服务。不要为了统一语言而重写现有成熟项目。

## 5. Runtime 设计

核心服务命名为 `bigfatfishd`。它必须脱离 Desktop、CLI 和 Web 独立运行。

Runtime 负责：Agent
生命周期和会话；人格、记忆、关系和状态；模型路由；事件总线和任务队列；定时调度和自主活动；插件生命周期和健康检查；权限、审批和审计；日志、备份、恢复；向
Desktop、CLI、Web 暴露统一 API。

所有入口通过 Runtime API 操作。UI
不得直接读写数据库，也不得直接控制平台插件。

通信建议： - HTTP REST：配置、管理、查询。 -
WebSocket：聊天、状态和实时事件。 - 本地 IPC：Desktop 与本机
Runtime，可使用 Unix Socket 或 Windows Named Pipe。 -
远程管理：HTTPS/WSS，必须认证授权。

Runtime 应支持单实例锁、优雅关闭、崩溃恢复、健康检查和任务恢复。


## 6. Agent Engine 与 DSH Harness

使用 DSH Harness 作为首选底层 Agent 执行引擎，但 BigFatFish 不得与 DSH 内部实现强耦合。

建立统一 `AgentEngine` 抽象，由 `DSHAdapter` 实现。能力包括启动/停止/健康检查、创建和管理 Session、流式发送消息、注册工具、获取状态、中断任务、处理超时，以及将引擎事件转换为 BigFatFish 统一事件。

DSH 负责底层 Agent Loop、模型调用和工具执行；BigFatFish 负责人格、记忆、平台、权限、调度和产品体验。不得把全部业务逻辑写成 DSH 专属插件。未来替换 Agent 引擎时，用户数据、平台适配器和 UI 不应重写。

Agent 行为分为：
- Conversation：与主人聊天。
- Activity：主动浏览和观看内容。
- Autonomous：根据兴趣和状态决定行动。
- Scheduled：定时日常活动。

## 7. Model Router

模型由 Runtime 统一管理，插件不得各自硬编码密钥或模型名称。目标支持 DeepSeek API、OpenAI 兼容 API、其他云模型、本地模型服务、视觉模型、ASR 和 TTS。

允许按任务选择模型：日常聊天、复杂决策、视频画面理解、语音识别、语音合成和记忆整理。用户通过统一设置填写 API Key、Base URL 和模型名称。

## 8. Personality 与养成系统

人格是持久配置，不是每轮聊天临时扮演。支持名称、头像、角色设定、基础性格、说话风格、喜好、厌恶、行为边界、作息偏好、自主活动偏好、主人及其他用户关系、心情状态和人格版本记录。

养成主页展示鱼的形象、当前状态、当前活动、最近经历、日记摘要、兴趣变化、平台连接状态和待审批行动。

心情和成长属于产品状态及行为模拟，不应宣称 AI 具有真实意识或真实情感。

## 9. Memory Engine

Memory Engine 由 BigFatFish 自己管理。Agent Session 和模型上下文不等于长期记忆。

记忆类型：
1. 短期记忆：当前会话、任务和临时上下文。
2. 长期记忆：主人偏好、重要事实和关系。
3. 情景记忆：某天发生的事件、对话和活动。
4. 兴趣记忆：视频、话题、创作者和内容偏好。
5. 人格记忆：角色设定、习惯和关系变化。

建议 SQLite 保存结构化数据，Markdown 保存可读日记和记忆摘要。初期实体至少包括 conversations、messages、memories、memory_links、daily_diaries、interests、experiences、relationships、mood_history、agent_sessions、activity_records、plugin_states、scheduled_tasks、audit_logs。

记忆写入经过提取、重要性判断、去重和来源标记。模型推测不得写成确定的用户事实。必须支持查看来源、修改、删除、导出、备份、恢复和迁移。

## 10. 平台接入

所有平台共用同一 Agent、人格和记忆；平台 Adapter 负责协议、账号会话和消息格式。

### QQ 个人小号机器人
首选研究 NapCat / OneBot 11，使用专门 QQ 小号，不依赖功能受限的简化 QQ Bot。QQ Adapter 负责私聊/群聊、文本/图片/文件/语音适配、引用回复、用户识别、主人权限、主动消息及统一事件转换。

个人 QQ 非官方协议接入存在平台规则、账号限制和安全风险。必须使用专门小号、隔离凭据并明确告知用户，不承诺账号绝对安全。

### B站
复用现有大肥鱼 B站项目，不重写成熟能力。集成自主浏览、视频信息获取、字幕/内容分析、兴趣记录、观看经历，以及经授权的分享或互动。

集成前检查原项目许可证、运行方式、数据格式、依赖、定时任务和模型调用方式。通过 Adapter 接入统一 Runtime，避免独立维护第二套人格、记忆和调度器。

### 抖音
整合两个现有项目：
- `LockyBee/dsh-douyin-agent`：主要参考自主观看、视频理解、兴趣和观看记录。
- `kdcadmin/dsh_douyin_tools`：主要参考点赞、评论、私信、分享、发布等操作工具。

不允许粗暴复制合并仓库。建议结构：

```text
Douyin Plugin
├── Browser Manager
├── Watch Module
│   ├── Recommendation Feed
│   ├── Video Capture
│   ├── Video Understanding
│   └── Watch History
├── Interaction Module
│   ├── Comment Reader
│   ├── Like
│   ├── Comment
│   ├── Share
│   └── Message
├── Decision Adapter
├── Permission Gate
└── Memory Adapter
```

统一管理浏览器会话；观看和互动使用任务队列；视频去重；理解结果写入统一兴趣记忆；点赞、评论、私信、发布默认人工审批；处理登录失效、验证码、页面变化和工具失败。不得绕过平台风控、验证码或访问限制。

统一消息结构：

```typescript
interface UnifiedMessage {
  id: string;
  platform: "qq" | "bilibili" | "douyin";
  accountId: string;
  userId?: string;
  conversationId: string;
  messageType: "private" | "group" | "comment" | "system";
  content: MessageContent[];
  timestamp: number;
  metadata?: Record<string, unknown>;
}
```

Agent 不直接处理各个平台原始 JSON。

## 11. 插件系统

建立正式 Plugin SDK。插件类型：
- Channel：QQ、B站等消息入口。
- Activity：自主观看、浏览等活动。
- Tool：浏览器、搜索、文件等工具。
- Model：模型提供商。
- Memory：记忆扩展。
- Personality：人格扩展。
- Service：语音、视觉等服务。
- Integration：MCP 和外部系统。

插件必须声明 ID、版本、作者、许可证、兼容 Runtime 版本、操作系统、依赖、权限、配置 Schema、启停和健康检查能力。

生命周期建议：

```typescript
interface BigFatFishPlugin {
  id: string;
  name: string;
  version: string;
  initialize(context: PluginContext): Promise<void>;
  start(): Promise<void>;
  stop(): Promise<void>;
  healthCheck(): Promise<PluginHealth>;
  dispose(): Promise<void>;
}
```

第三方插件不能默认获得 Runtime 全部权限。优先使用独立子进程和受限 RPC 隔离。不能把同进程加载的插件称为安全沙箱。

## 12. 权限与安全

权限至少包括：
- `message.read`、`message.send`
- `memory.read`、`memory.write`
- `browser.read`、`browser.control`
- `social.like`、`social.comment`、`social.message`、`social.publish`
- `account.manage`
- `filesystem.read`、`filesystem.write`

默认策略：
- 阅读消息、普通聊天和视频观看：用户授权后可自动执行。
- 记忆写入：遵循用户设置和记忆策略。
- 点赞、评论、私信：默认需要审批。
- 发布、删除、账号设置修改：必须审批。

API Key 和账号凭据不得写入普通日志；密钥使用系统密钥库或加密存储；Web 管理接口默认仅监听 localhost；远程管理必须认证授权并使用 HTTPS/WSS；插件安装展示来源、许可证和权限；关键操作写入审计日志；用户可立即暂停 Agent、停止插件和撤销授权。

## 13. 数据目录与迁移

应用安装目录与用户数据目录必须分离。允许用户自定义数据目录。

```text
BigFatFish/
├── config/
│   ├── config.yaml
│   ├── models.yaml
│   └── permissions.yaml
├── data/
│   ├── bigfatfish.db
│   ├── memory/
│   │   ├── profile.md
│   │   ├── personality.md
│   │   ├── owner.md
│   │   ├── interests/
│   │   ├── relationships/
│   │   └── diaries/
│   ├── conversations/
│   ├── browser/
│   ├── backups/
│   └── logs/
├── plugins/
└── runtime/
```

数据迁移必须有版本化 Schema、迁移脚本、备份校验和失败回滚。导出包包含用户选择的数据、配置和记忆；密钥和浏览器 Cookie 默认不导出，除非用户明确选择并经过加密保护。

## 14. CLI 与服务管理

CLI 至少提供：

```bash
bigfatfish onboard
bigfatfish start
bigfatfish stop
bigfatfish restart
bigfatfish status
bigfatfish logs
bigfatfish doctor
bigfatfish config
bigfatfish model list
bigfatfish plugin list
bigfatfish plugin install <id>
bigfatfish plugin enable <id>
bigfatfish plugin disable <id>
bigfatfish backup
bigfatfish restore <backup>
bigfatfish update
```

Linux 部署提供安装脚本或软件包、systemd unit、Dockerfile 和 Compose 示例、环境变量与数据卷说明、健康检查、升级和回滚指南。CLI 调用 Runtime API，不复制独立业务逻辑。

## 15. UI 页面结构

采用“养成体验 + 专业控制台”双模式。

主要页面：
1. Home：角色形象、心情、当前活动、最近经历。
2. Chat：聊天、流式回复和工具活动展示。
3. Life：时间线、日记、观看经历和自主活动。
4. Memory：查看、搜索、修改、删除记忆。
5. Channels：QQ、B站、抖音账号和连接状态。
6. Plugins：插件发现、安装、启停、配置和权限。
7. Models：模型提供商、API Key、模型路由。
8. Tasks：定时任务、队列和运行历史。
9. Permissions：授权、审批和审计记录。
10. Logs：Runtime、Agent 和插件日志。
11. Settings：通用设置、数据目录、备份和更新。

首次启动使用向导，提供默认配置和推荐选项。高级配置放在专业控制台，不强迫普通用户理解底层技术。

## 16. 开发路线与验收标准

### P0：工程骨架
- Monorepo、代码规范、CI、基础文档。
- Runtime 可启动、停止、健康检查。
- CLI 能管理 Runtime。
- SQLite 初始化和数据目录。
- 验收：Linux CLI 可启动一个空 Runtime；Windows/macOS 构建桌面壳。

### P1：最小可用 AI 鱼
- DSH Adapter。
- 模型配置。
- 基础聊天。
- 人格配置。
- 基础会话存储。
- 验收：用户配置模型后可以稳定聊天，重启后会话仍在。

### P2：记忆和养成
- Memory Engine。
- 日记、兴趣和经历。
- 养成主页和活动时间线。
- 验收：聊天中产生的经确认记忆可以跨会话检索。

### P3：QQ
- NapCat / OneBot Adapter。
- 私聊、主人识别、消息收发。
- 权限和审计。
- 验收：专用测试小号能够稳定收发消息，Runtime 重启后可恢复连接。

### P4：B站
- 复用项目适配。
- 视频观看记录和统一记忆。
- 插件配置和健康检查。
- 验收：B站活动记录可在统一日记中查看。

### P5：抖音
- 两个项目能力审查和适配。
- 统一浏览器管理器。
- 观看模块、互动模块和审批。
- 验收：观看与互动任务不争抢浏览器；写操作未经批准不会执行。

### P6：多形态发布
- Tauri Desktop。
- Linux systemd 和 Docker。
- 安装、更新、备份和恢复。
- 验收：Windows/macOS 桌面用户可安装；Linux 用户可纯 CLI 部署和长期运行。

### P7：Web Console 与插件生态
- 远程管理界面。
- 插件 SDK 文档和示例。
- 插件仓库或目录。
- 验收：第三方开发者可按 SDK 开发独立插件。

## 17. 开源与工程治理

- 采用清晰的开源许可证；在确定前检查所有依赖项目的许可证兼容性。
- 不得未经许可直接复制第三方项目代码。
- 为每个集成项目记录上游仓库、版本、许可证、改动和更新方式。
- 提供 CONTRIBUTING、CODE_OF_CONDUCT、SECURITY 和版本发布说明。
- CI 至少覆盖 TypeScript 类型检查、Lint、单元测试和跨平台构建。
- 插件和 Runtime 使用语义化版本及兼容性声明。
- 用户数据格式必须有版本迁移机制。

## 18. 明确不做的事情

第一阶段不做：
- 自研大模型。
- 从零重写 DSH Harness。
- 从零重写 B站和抖音现有成熟自动化能力。
- 同时支持大量社交平台。
- 复杂的多人、多鱼云端托管 SaaS。
- 默认无人审批的社交账号写操作。
- 依赖公网服务才能运行的核心功能。

## 19. 给 Codex 的执行要求

请先阅读本文件，将其视为产品目标和架构约束，而不是要求一次性实现所有功能。

开始编码前：
1. 检查现有仓库和已有代码，不要假设仓库为空。
2. 核对 DSH Harness、B站项目、两个抖音项目的最新接口、依赖和许可证。
3. 输出实施计划、Monorepo 目录结构、关键接口和风险清单。
4. 将工作拆成可验证的小阶段，先完成 P0，再推进 P1。
5. 不要在没有验证的情况下声称某个平台或操作系统已经支持。
6. 对外部平台自动化遵守平台规则，优先人工审批高风险写操作。
7. 任何架构变更都应说明原因，并更新文档和测试。

**最终目标：普通用户可以在 Windows/macOS 下载桌面软件开箱即用；进阶用户可以在 Linux VPS 通过 CLI 或 Docker 部署；所有形态运行的是同一个 BigFatFish Runtime，同一条鱼的人格、记忆和经历可以持续存在并迁移。**
