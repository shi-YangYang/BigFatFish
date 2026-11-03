# 贡献指南

开始前阅读 [AGENTS.md](AGENTS.md)、[项目使命](constitution/mission.md)、[技术边界](constitution/tech-stack.md) 和当前 [Spec](specs/README.md)。涉及界面时同时遵循 [网页内容与信息设计规范](.ai/rules/web-design.md)。

实际 API、HTTPS 控制台、普通模块 SDK、独立插件开发/打包和媒体协议见 [开发者指南](docs/developer.md)；社区协作遵循 [行为准则](docs/CODE_OF_CONDUCT.md)。安装包、备份恢复及发布限制见 [安装与迁移](docs/install-and-migrate.md)。

## 工作方式

1. 说明问题、范围和可观察的完成条件；关键产品或技术决策未确定时，先完善 Spec。
2. 在 `dev` 或明确指定的任务分支开发，保护已有修改。默认 PR 方向为 `dev → main`。
3. 修改限定在 Spec 范围内，保持入口、Runtime、插件和存储边界。不得未经许可复制第三方代码。
4. 按改动风险验证并记录实际结果；文案和占位目录通常只需审阅 diff。相关检查通过后停止，未运行的检查不得写成通过。
5. 同步受影响文档，提交审阅时说明行为变化、验证结果与剩余限制。

提交说明使用 `<type>: <中文说明>`，例如 `docs: 补充运行时边界说明`。Agent 需要用户明确授权才能 commit、push、合并或同步；开发完成不构成这些操作的授权。Git 的完整规则见 AGENTS.md 第 19 节。

## 当前工程状态

使用 Node.js 24，在根目录执行 npm ci。源码按普通模块组织，只有一个根依赖清单与锁文件；Tauri 的 Rust 工程位于 apps/desktop/src-tauri。

本次工程检查命令为 npm run typecheck、npm run lint、npm test；构建为 npm run build，桌面原生构建为 npm run desktop:build。CLI、桌面和 Docker 使用方式见 README。各阶段按实际影响执行检查，不将命令存在等同已通过。

`npm run build` 同时构建 Runtime/CLI、桌面前端和 Web 资源；`build:node` 生成随包平台插件目录、SDK 与示例，`build:web` 单独构建浏览器入口。Web 仅在显式配置 TLS 与独立口令后通过 `bigfatfish web serve` 运行，不将开发服务或本机 bearer 作为公网访问方式。插件示例须在独立目录按指南打包、安装、授权和运行，不能依赖源码仓库的隐式路径。P7 本地代码及返工已通过独立验收；操作系统、账号和正式发行证据仍以实现状态为准。

全阶段开发的每个阶段必须有实现、类型/Lint、单元及必要集成、基本运行与独立验收；文档小改仍按 S0 只审阅差异。操作系统和平台账号实测结果分别记录在 IMPLEMENTATION_STATUS.md 与 docs/progress/development.md。

不要提交真实 API Key、密码、Cookie、浏览器会话、个人记忆或备份。`.env.example` 和 `.env.*.example` 仅可包含安全的占位值；依赖落地后应跟踪相应 lockfile。
