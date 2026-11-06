# 贡献指南

开始前阅读 [AGENTS.md](../.ai/AGENTS.md)、[项目使命](../constitution/mission.md)、[技术边界](../constitution/tech-stack.md) 和当前 [Spec](../specs/README.md)。涉及界面时同时遵循 [网页内容与信息设计规范](../.ai/rules/web-design.md)。

实际 API、HTTPS 控制台、普通模块 SDK、独立插件开发/打包和媒体协议见 [开发者指南](../docs/developer.md)；社区协作遵循 [行为准则](../docs/CODE_OF_CONDUCT.md)。安装包、备份恢复及发布限制见 [安装与迁移](../docs/install-and-migrate.md)。

## 工作方式

1. 说明问题、范围和可观察的完成条件；关键产品或技术决策未确定时，先完善 Spec。
2. 在 `dev` 或明确指定的任务分支开发，保护已有修改。默认 PR 方向为 `dev → main`。
3. 修改限定在 Spec 范围内，保持入口、Runtime、插件和存储边界。不得未经许可复制第三方代码。
4. 按改动风险验证并记录实际结果；文案和占位目录通常只需审阅 diff。相关检查通过后停止，未运行的检查不得写成通过。
5. 同步受影响文档，提交审阅时说明行为变化、验证结果与剩余限制。

提交说明使用 `<type>: <中文说明>`，例如 `docs: 补充运行时边界说明`。Agent 需要用户明确授权才能 commit、push、合并或同步；开发完成不构成这些操作的授权。Git 的完整规则见协作规范第 19 节。

## 当前工程状态

源码使用 Node.js 24.9 至 24.x，在仓库根目录执行 `npm ci`。项目共用一份 npm 依赖清单和锁文件。React 业务页面在 `apps/desktop/src/features/`，Web 复用这些页面；原生宿主在 `apps/desktop/src-tauri/`。CLI 从 `apps/cli/src/main.ts` 分派到 `commands/`。

开发桌面使用 `npm run desktop:dev`，由 supervisor 编译 Node 源码并管理 Runtime、Vite、Tauri。默认读取桌面数据目录，需要隔离时显式指定 `BIGFATFISH_DATA_DIR`。关闭窗口或按 Ctrl+C 会结束本次开发会话；修改 Node 后端后重新运行命令。

`npm run build:node` 构建 Runtime/CLI、随包平台插件、SDK 和示例，`npm run build:web` 单独构建浏览器入口，`npm run build` 同时构建 Node、桌面前端和 Web。生成原生桌面安装包用 `npm run desktop:build`。HTTPS 控制台须在本机配置证书和独立口令后用 `bigfatfish web serve` 启动。插件开发、打包和隔离运行步骤见[开发者指南](../docs/developer.md)。

`npm run typecheck`、`npm run lint` 和 `npm test` 是仓库级检查，按改动风险选择所需范围。历史平台与安装验证见 [P0–P7 验证记录](../docs/progress/development.md#p0p7-验证范围)，后续行为及验证见[规格索引](../specs/README.md)。

不要提交真实 API Key、密码、Cookie、浏览器会话、个人记忆或备份。`.env.example` 和 `.env.*.example` 仅可包含安全的占位值；依赖落地后应跟踪相应 lockfile。
