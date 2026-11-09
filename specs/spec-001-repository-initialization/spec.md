# Spec 001: 仓库结构与文档初始化

状态：Done；2026-11-02，初始化、文档归档与取消独立公共包的补充要求均独立验收 PASS；工程采用普通源码模块封装。原始要求为「基于 agents.md 和产品设计，先初始化项目目录结构，做好 gitignore、git 分支、md 文档等」。

## 背景

当前仓库是 NEW 项目，仅有 MIT LICENSE，初始提交为 `86b21f5`。用户提供 AGENTS.md、产品设计目标及 web-design.md。

## 目标

为后续逐阶段开发建立可追踪的源码目录、治理结构、文档入口和本地开发分支。

## 非目标

本次不实现完整 P0，不生成业务代码、安装依赖、定义公共 API、建立数据库或 CI，不接入上游项目，不承诺跨平台运行。不执行 commit、push、PR、合并或同步。

## 当前行为

仓库只有许可证，无应用、构建配置或可用运行命令；本地 main 指向初始提交，工作区干净。

## 目标行为

开发者能从 README 找到产品、技术边界、路线和协作规范；Git 能保留必要空目录并忽略本机数据和生成产物。后续实现者能区分已确定目标与尚未验证能力。

## 功能需求

1. 原样纳入用户 AGENTS.md、产品基线和网页设计规则。
2. 建立规定的 constitution、specs 模板及 .ai 子目录，维护初始化 Spec、Plan、Decision 和独立验收。
3. 以 apps、plugins、services 分隔产品入口、插件和辅助服务；建立 docs、tests、scripts、infra。按用户明确要求采用普通源码模块封装，移除 packages 下四个空占位，不建立独立公共包或替代空目录。
4. 创建 .gitignore 以及轻量编辑与换行约定，保留必要 lockfile 和示例配置的跟踪能力。
5. 在已核实初始 main 基线上建立 dev，保留 main、origin 和 MIT LICENSE。
6. 提供简洁中文 README、贡献指南、行为准则、安全说明和后续发布记录入口；实际状态与规划分开。按用户补充要求，根目录仅保留 README.md 和 Agent 入口 AGENTS.md；CONTRIBUTING.md、CODE_OF_CONDUCT.md、SECURITY.md、CHANGELOG.md 归入 docs/，修正入口和文档内部相对链接。

## 边界条件

Git 不记录空目录，使用 .gitkeep。源码插件目录不能被用户数据忽略规则覆盖。不得编造启动命令、已启用 CI、已发布版本、已启用的私密漏洞报告渠道或第三方许可证兼容性。

## 技术约束

遵循 [tech-stack](../../constitution/tech-stack.md) 的目录与依赖边界。无运行配置，包管理器和版本留待 P0；不以初始化为由决定尚未澄清的外部服务/API。

## 兼容性要求

保留原始许可证和历史，不修改全局 Git 配置，不改写已有提交。本次只建立将来面向 Windows/macOS Desktop、三平台 CLI、Linux Headless 的组织方式，不代表支持已验证。

## 验收标准

- [x] 三份附件位于指定位置且内容保留。
- [x] 固定 Agent 结构、Spec 模板与初始化记录齐全。
- [x] 业务目录职责明确、占位目录可由 Git 保存，Desktop 保留 src / src-tauri 边界。
- [x] 忽略规则覆盖依赖、构建缓存、系统文件、环境密钥及本地运行数据；不忽略源码、治理文档、示例和 lockfile。
- [x] README 文档链接有效，P0 与当前初始化状态区分；无假命令或功能支持声明。
- [x] 实际分支为 dev，main 和 MIT LICENSE 保持，未执行提交、推送或合并。
- [x] 独立验收完成，记录 S0 审阅证据，不运行无关测试/构建。
- [x] 文档位置调整完成：四份说明文档位于 docs/，根目录仅保留 README.md 与 AGENTS.md，相对链接按新位置更新并独立审阅。
- [x] 移除 packages 四个空占位及空目录；README、技术文档和当前规范采用普通模块复用，不再安排独立公共包或多包 workspace；既有其他内容保留。

## 待确认问题

本次范围无阻塞问题。P0 工具链、传输和上游来源等问题见 tech-stack；待对应功能 Spec 开始前澄清。
