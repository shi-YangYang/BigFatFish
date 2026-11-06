# Spec045 项目目录职责整理验收

## Result

PASS

## Spec Coverage

- 根目录 Markdown 仅有 README.md。README 链接到设计、路线、阶段记录、参与和安全资料、协作规则及源码入口。项目级 Codex 配置将 README.md 纳入规则发现；已信任仓库的新会话能据此找到 .ai/AGENTS.md。
- Desktop 与 Web 复用同一 App、功能页面、通用组件、请求模块和样式。聊天、连接、我的鱼、设置分别有目录；beUI 及许可证归属通用组件。CLI 的命令分派、命令处理、输入、Runtime 客户端和进程控制各有入口，沿用单根依赖清单。
- 源码和编译后的直接消费者均已迁移，构建命令、CLI 入口、平台接口和持久化格式保持兼容。

## Validation

- 风险级别为 S3，依据是开发 supervisor 与便携更新代码依赖编译产物的精确相对位置。
- 独立审阅了当前工作树与 dev 基线的源码差异、入口、测试夹具和维护文档。核对了 Web 会话与原生 IPC 分支，以及旧 Runtime 缺少本地会话路由时的回退过滤。两个入口加载共用样式，Tailwind 扫描覆盖迁移后的 features、通用组件、App 和 Web 源码。
- 核对了 supervisor 在 Node 构建后导入的 `dist/cli/src/runtime/process.js`、该模块定位的 Runtime 入口，以及 `dist/cli/src/commands/update.js` 向上四层定位的便携安装根目录。原生宿主、候选版本健康检查及 smoke 脚本均沿用 `dist/cli/src/main.js`。
- 复用实施报告中的验证结果：11 份文档的 70 条本地链接与 Codex 规则入口检查通过；Desktop、Web 生产构建和许可证输出、前端源码类型检查及聊天与记忆 Chromium 用例通过；移走旧 CLI 产物后 Node 构建、隔离 JSON 输入检查及启动、状态、诊断、日志、重启、停止六项 CLI smoke 通过。独立验收未重复运行这些检查。

## Issues

未发现本次迁移造成的阻断问题。

## Regression Risks

本次验收中，便携安装根定位和原生宿主接线依据源码与构建布局核对。验证范围未包括安装包构建、实际升级、Windows 实机或真实账号操作。

## Required Rework

无。

## 文档跟进验收

FAIL（S0，独立文档审阅）

- 源码启动和 CLI 构建步骤与根 npm 脚本一致。模型与人格入口、QQ 消息记录、B站观看和分享、抖音互动及 CLI 手动操作与现行页面和命令相符。QQ 文字回复有早期用户反馈，扫码后渠道在线有后续记录；现行指南分别说明了真实媒体和其他平台账号的验证缺项。
- 数据库与新逻辑归档的 schema 为 8，归档读取接受 6、7、8；便携发行 metadata 和签名清单的 schema 仍为 6。上述说明与迁移、归档及发行脚本相符。引用有效性沿用实施阶段的检查，本轮未运行产品或操作账号。
- **需返工：模型凭据迁移。** [模型指南「存储与权限」](../../docs/ai-core.md#存储与权限) 将迁移后重新配置模型凭据描述为必需。实际导出选择模型范围、开启 `credentials: true` 并设置口令时，凭据可随加密归档迁移，恢复时用目标本机密钥重新加密。请区分默认不携带凭据和显式携带凭据两种情况，与[安装与迁移](../../docs/install-and-migrate.md#备份恢复与凭据)及[归档实现](../../apps/runtime/src/maintenance/archive.ts)保持一致。

## 文档跟进复验

PASS（S0）。已将[模型指南「存储与权限」](../../docs/ai-core.md#存储与权限)与[迁移指南](../../docs/install-and-migrate.md#备份恢复与凭据)及[归档实现](../../apps/runtime/src/maintenance/archive.ts)对照。逻辑归档始终排除 `config/master.key`，默认也排除模型密钥；导出范围包含 `models`、启用 `credentials: true` 并设置归档口令时，可随归档迁移模型密钥。恢复时由目标机新生成的主密钥重新加密。上轮唯一返工项已关闭，其余验收证据沿用。
