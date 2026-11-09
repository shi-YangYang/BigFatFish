# Decision 001: 初始化范围与目录边界

日期：2026-11-02

## Context

仓库仅有 MIT LICENSE；用户明确要求先初始化目录、Git 忽略规则、分支和 Markdown 文档。产品目标是跨入口的同一 Runtime，而非一次实现全部功能。

## Decision

- 采用 NEW 模式，按用户提供的 AGENTS.md 建立固定治理目录；该规范要求的多份基础文档各司其职，不额外创建重复任务日志。
- 在原 main 初始提交上建立 dev；开发工作不包含提交、推送、合并与同步。
- 源码以 apps、plugins、services 划分，具体职责见 constitution/tech-stack.md；Desktop 内采用 src 与 src-tauri。原先预留的 packages 已按用户补充决定取消，采用普通源码模块封装。
- 本次只落目录和文档，不安装工具链或定义可运行工程。包管理器、版本、API 与上游集成留待相应 Spec。
- 原始附件分别保留在根 AGENTS.md、docs/product-design.md、.ai/rules/web-design.md；项目解读记录在 constitution，不改写产品原稿。

## Reason

满足当前「先初始化」范围，固定产品明确的职责边界，同时避免把目录和文档当作完整 P0 或平台兼容性证据。

## Alternatives

完整生成 Runtime/CLI/Tauri 脚手架需要工具链、版本和通信决策，超出本轮。平铺所有业务无法清晰隔离多个入口与核心 Runtime。提前拆分每个 Runtime 内部服务则缺乏实施依据。

## Consequences

克隆后能阅读并推进 Spec，但不能安装或运行产品。下轮需先完成 P0 技术选择和最小功能 Spec。用户数据与源码分离；占位目录后续在原位落地。

## 用户补充：说明文档归档

2026-11-02 用户明确要求 README 之外的设计/说明 Markdown 放在 .ai 或专门文件夹。贡献指南、行为准则、安全说明和变更记录统一移至 docs/，README 更新导航，移动文档修正相对链接。AGENTS.md 保留为根 Agent 入口；constitution、specs、.ai 已是专门目录，不另行迁移。

## 用户补充：否决独立公共包

2026-11-02 用户明确表示不需要分包，复用应像前端组件一样在源码内部封装。原先的 contracts、runtime-client、agent-engine、plugin-sdk 均仅有空占位，没有代码、依赖或对外使用者；拆包没有实际复用收益，反而提前增加组织和后续工具链成本。

决定移除 packages 空目录，采用职责清晰的模块、服务和适配器，按实际需要导出复用。不为共享代码创建独立包清单、版本和发布流程，不另建空 shared 目录。入口仍通过 Runtime API/IPC 操作核心业务，模块封装不改变进程边界和权限归属。此调整由用户明确的架构纠正授权，影响仅为占位目录和说明文档，无运行或数据迁移。
