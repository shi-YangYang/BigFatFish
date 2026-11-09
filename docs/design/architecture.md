# 架构

同一个 BigFatFish Runtime 为本地聊天、QQ 对话和平台活动提供人格、模型、记忆、调度及存储。以下按一次操作经过的模块说明当前实现。构建依赖和源码布局见 [技术栈与工程边界](../../constitution/tech-stack.md)。

## 客户端如何访问 Runtime

| 入口 | 请求与生命周期 |
| --- | --- |
| 桌面 | React 通过 Tauri IPC 调用 Rust 宿主，宿主读取本机连接文件并请求 Runtime。聊天事件从认证的 `/v1/events/stream` 以 NDJSON 流入 Tauri Channel。安装版按设置处理窗口关闭及后台常驻；`desktop:dev` 由 supervisor 管理和回收自己的进程。 |
| Web | 与桌面共用业务页面，通过独立 HTTPS 网关访问 `/api/v1/…`。浏览器登录后使用有期限的 HttpOnly Cookie，写操作需 CSRF token；聊天经同源 WebSocket `/events` 转入 Runtime。网关单独启停，维护期间可报告进度并重新启动核心服务。 |
| CLI | `bigfatfish` 使用私有连接文件调用同一本机 API。`start` 等待服务就绪，`stop` 通过认证接口提出停机请求并等待实例锁释放。离线备份、恢复和更新调用 Runtime 的维护模块。 |

本机 Fastify 服务只监听 `127.0.0.1`，校验 Host 和请求来源。`GET /health` 只返回健康标志，`/v1/` 管理接口需要随机 Bearer token，凭据保存在受限的 `runtime/connection.json`。Web 网关默认关闭，由 CLI 的 `web configure` 和 `web serve` 显式启用。[本机认证](../../apps/runtime/src/server.ts) · [网关](../../apps/runtime/src/web/server.ts)

Desktop 与 Web 共用「聊天」「我的鱼」「连接」和「设置」。设置页的「模型」「扩展」「声音」调用同一业务接口。「通用」「数据」在桌面提供本机运行设置与备份，在 Web 展示服务器更新与备份；桌面的软件更新在「关于」，「高级」显示运行日志。托管桌面开发模式限制会打断当前进程的维护操作，离线维护可退出后用独立 CLI 执行。[共享设置页](../../apps/desktop/src/features/settings/Settings.tsx) · [Web 管理设置](../../apps/web/src/Settings.tsx)

## 聊天、模型与会话隔离

1. 双端聊天页通过 `GET /v1/conversations/local` 取历史。Runtime 先按 `principal = 'local-owner'` 过滤，再排序取最近 500 条。旧 Runtime 缺少此路由时，客户端才从全量列表筛选明确可写的会话。`GET /v1/conversations` 仍按原契约返回本地与平台会话，外部会话由所属渠道继续收发。即使同一个人是 QQ 主人，其 QQ 会话也与本机聊天分开。[会话服务](../../apps/runtime/src/ai/chat.ts) · [前端请求](../../apps/desktop/src/api/chat.ts)
2. 创建本地会话时绑定聊天模型，发送时 Runtime 记录消息、请求 ID 和人格版本，再按可信会话身份选择可见记忆与可用工具。模型用途为 `chat`、`asr`、`tts`；聊天、图像理解、记忆提取、日记和活动决策共用聊天模型，音频走各自的转写或合成接口。模型发现与短生成诊断独立于配置保存。默认女儿版和可选傲娇版保留原卡来源，完整卡进入闲聊提示，后台结构化任务使用自己的提示。设定页保存时校验版本，历史仍可经人格 API 查询。[模型与聊天指南](../ai-core.md)
3. `DSHAdapter` 为每轮准备受控 profile 和子进程，按会话恢复引擎上下文，桥接模型流、工具和取消。默认 shell 和通用文件工具被禁用。Runtime 按身份提供有界的公开网页读取、范围记忆和平台回合工具。身份、可见记忆或授权变化会触发上下文隔离和相应检查。完成、取消、失败及重启中断记录在 Runtime，平台投递结果另行保存。[引擎适配](../../apps/runtime/src/ai/dsh.ts) · [人格与工具决策](../../.ai/decisions/020-source-persona-cards.md)

## 哪些数据会留下

SQLite 是人格、配置、会话、消息、记忆、活动、插件状态与平台记录的权威数据源。模型和平台凭据使用受本机文件权限保护的主密钥加密；模型列表只返回密钥是否存在。引擎可以恢复同一 Session，跨会话记忆由以下两套记录控制。

- **长期记忆**按真实发言人及原场合存储。回合完成后将来源加入 SQLite 队列，后台按顺序处理。明确单句走本机规则，复杂表述由聊天模型结合有限前文、原话和当前可见的旧记录整理。主人私聊可读取主人本人在群里的记忆；好友私聊与不同群分别隔离。手动回顾旧对话产生的候选可在管理页确认。关键词与可选的本机向量召回共用同一权限条件。公开回复投递前复核已披露记录，日记按实际活动生成。[记忆存储](../../apps/runtime/src/memory/store.ts)
- **会话自动笔记**保存在独立的 `conversation_notes` 表。追加内容与引用须来自当前消息原文；查询和删除按可信范围执行。本地按会话隔离，QQ 按账号及私聊或群目标隔离。笔记不会覆盖主人确认记忆，逻辑备份可按 memories 范围携带笔记。[笔记工具](../../apps/runtime/src/memory/notes.ts)

当前 `SCHEMA_VERSION = 12`，启动时在事务中应用 SQLite 迁移并写入 `PRAGMA user_version`。第 7 版增加 QQ 表情，第 8 版增加会话自动笔记，第 9 版记录个人角色、身份和范围，第 10 版记录待整理的新回合，第 11 版增加关联已确认记忆的人物资料字段，第 12 版保存场景摘要及其关联事实。原话保存在消息中，场景和人物资料均能追溯到重要事实。逻辑归档写入当前数据库版本，可恢复 schema 6 至 12 的归档。便携发行的 `release.json` 和签名更新清单仍写 `schema: 6`，更新清单同时写 `minSchema: 6`。查询运行库版本可用 `GET /v1/status` 的 `schemaVersion`。[迁移](../../apps/runtime/src/storage/database.ts) · [逻辑归档](../../apps/runtime/src/maintenance/archive.ts) · [发行准备](../../scripts/prepare-release.mjs) · [更新清单](../../scripts/release-archive.mjs)

## 平台如何执行操作

| 模块 | 输入、权限和结果 |
| --- | --- |
| QQ | Runtime 静态持有内置 OneBot 客户端，不经插件安装或装载。可托管固定原版 NapCat（macOS/Linux 用 Docker，Windows x64 使用单独下载的组件），也可连接已有 OneBot 正向 WebSocket。配置一个主人、允许的好友与群及群触发方式。入站交给共享聊天服务，回复分条投递前复核账号、范围、媒体与当前授权。主动发送通过 `POST /v1/channels/qq/send`，记录实际交付状态，结果未知时不自动重发。QQ 消息页展示操作记录；程序化发送入口仍供 CLI、B站分享及已授权插件调用。[QQ 渠道](../qq.md) |
| B站 | `bilibili/` 管理配置、加密账号、视频任务及结果；whale 适配器提供登录、平台数据、字幕和抽帧。统一模型按实际取得的证据总结，记录活动与候选兴趣，分享复用 QQ 的授权发送。[B站指南](../bilibili.md) |
| 抖音 | Runtime 拥有专用浏览器、账号与任务队列；观察适配器和 Python FastMCP 通过 CDP 复用该浏览器。观看使用取得的画面、音轨及统一模型。`POST /v1/douyin/write` 以 `tool`、`args`、`requestId` 直接提交支持的点赞或评论。入队、提交及实际请求核对账号、权限和内容，单次发送，按收据记录结果。私信、分享、投稿的发送协议尚未验证，入队前拒绝。[抖音与调度](../douyin.md) |

活动服务统一处理 B站与抖音的计划、授权范围内的自主发现、暂停和取消。程序按任务记录进度，界面上的平台操作记录只展示该入口可获得的记录。各平台在明确授权范围内直接操作。旧 `/v1/permissions/approvals`、`/v1/douyin/approvals` 及相应决策入口返回 410，历史审批表仅作兼容保留，历史待办不会重放。旧插件 `channel.propose` 权限也不能取得直接发送权。[直接发送决策](../../.ai/decisions/015-qq-direct-messaging.md) · [审批退役决策](../../.ai/decisions/021-remove-platform-approvals.md)

## 扩展、维护与发行

QQ 在 Runtime 中编译和管理，旧 `sdk:qq` 安装记录不再加载或出现在扩展列表；首次内置化沿用旧停用意图，后续由连接设置管理。B站、抖音暂沿用平台插件。普通 SDK 插件在子进程中运行，通过受限 RPC 访问声明并获准的宿主能力；停用、更新及撤权会阻断旧实例调用。子进程持有运行用户的系统权限，RPC 管控只覆盖宿主提供的能力。安装状态记录在 SQLite，代码位于用户数据目录。逻辑恢复后需要重新安装并授权。[插件协议与示例](../developer.md)

备份在一致 SQLite 快照上选择逻辑数据，默认排除凭据、浏览器登录态和引擎缓存，可显式使用独立口令加密导出支持的凭据。恢复和更新在固定实例锁下校验暂存数据，通过 journal 切换并保留原数据。便携更新校验 Ed25519 签名及文件哈希，Tauri 更新校验 Minisign 与版本。macOS 首次启动失败时由用户执行回退。Linux 便携包、非 root Docker/Compose 和 systemd 用户服务共用同一 Runtime。[安装、运行与迁移](../install-and-migrate.md)

## 验证记录如何使用

原 P0–P7 的平台矩阵记录的是当时的版本和环境。macOS 本地 ad-hoc 安装、更新及回退，Linux arm64 容器和 amd64 模拟容器均有历史证据；Windows 原生安装、正式签名发布和原生 x64 VPS 仍缺实测。原发行升级记录是 schema 6→6；后来 Spec038 在获准的本地真实数据上执行过 SQLite 7→8，属于数据库迁移记录。[阶段验证](../progress/development.md#p0p7-验证范围) · [Spec038 应用记录](../../specs/spec-038-source-persona-cards/plan.md)

QQ 已有用户对早期真实回复的确认，Spec038 另记录了扫码后组件、账号与渠道在线。之后的代码验收及协议夹具只覆盖各自列出的路径，真实外发、云模型识图与口吻仍需对应版本的实测。目录整理验证了双端前端和 CLI 的指定入口；原生安装包及外部账号没有在该轮重测。[QQ 用户反馈](../../specs/spec-025-qq-conversation-policy/spec.md) · [Spec045 验证范围](../../specs/spec-045-project-layout/plan.md)
