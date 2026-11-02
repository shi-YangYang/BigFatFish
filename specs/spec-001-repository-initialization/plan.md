# Plan 001: 仓库初始化

## 涉及模块与预计文件

- 原始基线：AGENTS.md、docs/product-design.md、.ai/rules/web-design.md。
- 治理：constitution 三文档、specs 索引及模板、本 Spec、.ai 中决策/流程/交接。
- 工程：apps、plugins、services、infra、scripts、tests 的占位目录；用户补充要求已取消 packages 的空包预留。
- 入口与约定：根 README、docs 下的 CONTRIBUTING / CODE_OF_CONDUCT / SECURITY / CHANGELOG，以及 .gitignore、.editorconfig、.gitattributes。

## 修改顺序

1. 协调 Agent 阅读输入、识别 NEW、检查 Git 基线并创建 dev，纳入附件及约束文档。
2. 实施 Agent 按交接创建工程占位目录与根文档，不切换分支、不修改治理文件、不提交。
3. 新的独立验收 Agent 阅读 Spec、Plan、实施报告及新增文件，核对验收条件。
4. 协调 Agent 按实际结果完成验收记录与状态交付。

## 数据流与接口变化

无接口、运行时数据或数据库变化。这里只记录入口 → Runtime → 引擎/插件/存储的责任归属，接口签名在后续 Spec 确认。

## 验证计划

S0：仅文档、占位文件和不影响运行逻辑的小配置。检查新增内容、附件保真、相对链接、占位文件可跟踪、忽略规则及分支状态；这些属于静态差异审阅。没有可运行工程，不运行 Test、Build、Lint、Typecheck，不安装依赖，不新增测试。独立验收以内容审阅为主，不重复已通过检查。

## 风险与迁移策略

忽略规则需避免吞掉源码与治理文件；文档须避免把目标描述为已实现。目录约定建立后按 AGENTS 保护；此时无历史业务目录、数据迁移或运行回归风险。

## Implementation Report

### Summary

协调 Agent 已纳入三份原始附件并建立治理结构。实施 Agent `initialize_structure` 新增 23 个文件：15 个 .gitkeep、三份工程约定和五份根文档。

### Files Changed

源码与部署/测试占位目录按照 tech-stack 创建；根文档为 README、CONTRIBUTING、CODE_OF_CONDUCT、SECURITY、CHANGELOG；配置为 .gitignore、.editorconfig、.gitattributes。

### Important Decisions

仅建立目录和文档，不生成虚假的运行命令。开发数据忽略范围为 .local/bigfatfish，保留插件源码、治理文件、lockfile 与环境示例。安全说明不编造联系渠道和已启用功能。

### Validation

- Risk Level: S0。
- Checks Performed: 实施者审阅新增补丁及范围；协调者阅读根文档与配置，核对产品当前状态的表述。
- Result: 实施完成，未发现范围偏离；新的独立验收 Agent 已返回 [PASS](acceptance.md)。
- 未运行测试、Build、Lint、Typecheck 或验证脚本，未安装依赖。

### Known Limitations

尚无依赖清单、构建配置和可运行产品；不代表完整 P0 完成。许可证和历史保留，未暂存、提交或推送。

### Remaining Questions

本次实施无阻塞问题；后续 P0 技术选择见 tech-stack。

## 用户补充：文档位置整理

用户要求 README 以外的设计/说明 Markdown 归入 .ai 或专门文件夹。将四份根说明文档移至 docs/，同步 README 及文档内部相对链接；AGENTS.md 继续作为根 Agent 入口，constitution、specs、.ai 的既定职责保持。无业务代码、数据或目录迁移风险。

本次仍为 S0：只检查移动与链接差异，不运行测试、构建或重复初始化检查。实施报告和本轮独立验收继续更新现有记录，不新增过程文档。

实施结果：initialize_structure 已将四份文件移入 docs/，更新 README 四条入口链接以及 CONTRIBUTING、SECURITY、CHANGELOG 内部相对链接。正文保留；未运行测试或构建，未暂存、提交、推送或切换分支。本次仅审阅移动及链接补丁，无已知剩余问题。新的独立 Agent accept_doc_locations 已返回 PASS，无需返工。

## 用户补充：采用普通模块封装

用户明确否决独立公共包，希望类似前端组件的源码封装。确认 packages 中仅有 contracts、runtime-client、agent-engine、plugin-sdk 的四个空 .gitkeep；移除这些占位与空目录，更新 README、CHANGELOG 和技术约定。引擎适配等逻辑先放 Runtime 内部，实际共享需求出现后提取普通源码模块，不增加替代空目录、依赖或业务实现。

本次为 S0：只涉及空占位移除和文档差异，没有构建或运行行为变化。删除前确认目标是预期空占位，使用逐个文件删除和 rmdir；遇到未知文件立即保留并报告。独立审阅本次差异后停止，不重复旧验收，不运行测试/Build/Lint/Typecheck。

实施结果：initialize_structure 确认四个占位均为空且无额外文件后逐个删除，以 rmdir 移除空 packages 目录；README 和 CHANGELOG 已同步普通模块封装约定。未建立替代目录、运行测试或执行 Git 写操作。新的独立 Agent accept_plain_modules 只读审阅目录和相关文档，返回 PASS，无需返工。
