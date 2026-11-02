# Plan 004: P2 记忆与养成

## 前置条件与顺序

1. P1代码及本机/Linux路径已独立验收并提交b1f73b3，实际接口已读取；按Decision004开始P2，不并行修改耦合业务文件。
2. 完善来源与状态 Schema，构建 Memory Engine 的候选、确认、管理、索引、导出和上下文检索。
3. 经统一 DSH 执行提取和日记任务，校验模型输出，处理取消、超时、重启与幂等；普通聊天使用有限的已确认检索上下文。
4. 统一事件形成经历、活动、兴趣、关系与心情历史；日记原子写入可读 Markdown 副本，数据库保持权威。
5. 增加认证 API、CLI、Desktop 养成主页、时间线与记忆管理，并同步使用文档。
6. 风险相称检查与实际链路验证后，由新的独立验收 Agent 审阅。

## 数据流

真实消息/活动 → 来源和事件记录 → 提取候选 → 用户确认/编辑 → 已确认记忆索引 → 新回合有限检索 → 同一 AgentEngine。日记引用实际来源；界面从 Runtime 查询，不构造替代数据。

## P1 实际衔接点（已读取）

- schema2由storage/database.ts的事务化迁移创建models/personas/conversations/messages/agent_sessions；消息有conversation_id、request_id、persona_version和状态。P2新增迁移，不重建现有表或丢弃会话。
- ai/configuration.ts统一解密模型、人格版本和用途路由；P1只有chat被实际消费。P2调用memory路由，未专设时可明确回退chat，UI/文档说明所选模型，不读取其他凭据。
- ai/engine.ts的AgentEngine.run接收persona/model/key/signal/真实流回调和session映射，DSHAdapter管理受控进程。提取/日记任务经同一适配边界，不能直接请求模型HTTP。与聊天共用Configuration/Engine可通过明确依赖传递完成，不新建仅转发的多层包装。
- ai/chat.ts在回合开始取得模型/人格快照；检索上下文在这里按预算组装。当前EventEmitter仅发message事件，P2需要统一活动/记忆事件时应扩展明确事件契约，而不是多个互相复制状态的总线。
- lifecycle.ts创建ChatService并在关闭时先停止任务，再关API和DB。新增任务必须参加同一停止/重启恢复，禁止后台写已经关闭的DB。
- P1桌面Chat已修默认模型和异步选择身份/草稿版本；P2扩展导航时保留这些行为，不恢复旧的无条件异步回写。

## 文件范围

apps/runtime/src 内存储、memory/life 等职责明确的普通模块及 API/事件/任务衔接；apps/cli/src、apps/desktop，相关测试和必要使用文档。治理与全局状态由协调者维护。不得创建额外公共包或更改既定目录。

## 验证

S3：持久化 Schema、跨会话上下文和可删除用户数据。单元验证状态、去重/冲突、检索预算和日期边界；集成使用真实 DSH+测试模型验证完整跨会话链路；重启与迁移、文件失败、权限、幂等及实际桌面/CLI按改动范围验证。真实云模型/平台账号与测试夹具证据分开。

## 风险与迁移

模型推测污染事实、检索提示注入、删除后残留索引、重复活动、日期边界和 Markdown 副本不同步。采用显式确认状态、来源关系、查询约束、事务化迁移与可重建副本；不静默覆写或删除用户原始聊天。具体接口与文件清单在 P1 验收后完善。

## Implementation Report

实施者：implement_p2。2026-11-03返回实施报告，未自行验收或操作Git index。

### Summary / Files Changed

新增runtime/memory普通模块（Store、LifeService、files、routes、types及unit）、schema3、聊天有限检索和生命周期衔接；新增CLI life命令与桌面Life/Memories组件，扩展实际模型夹具和P2集成，更新docs/ai-core.md。沿用同一Configuration、AgentEngine与DSH，不新建包或独立平台大脑。

候选须确认；来源精确核对，重复陈述合并来源，同义合并须用户明确选择，冲突不覆盖。每次聊天最多注入8条/4000字，临时系统参考不写入用户消息。日记与导出使用受限原子文件；SQLite权威、副本失败可见并可重建。刷新成功后才记录revision，失败可在相同revision重试，恢复清除局部错误。

### Validation

- Risk Level：S3（schema、持久化、跨会话上下文）。
- 实际通过：npm run typecheck、npm run lint、npm run build:node、npm run desktop:build（含Vite/macOS Rust）。
- 相关四文件批次17项通过：Memory unit、P2真实DSH integration、foundation、P1真实DSH回归；后续新增边界后Memory/P2集成9项通过，最后来源修复定向Memory unit8项通过。不把多批次相加当独立测试总数。
- 真实DSH+本地HTTP测试模型：聊天→提取候选→未确认不注入→确认→新会话请求含来源→删除后同会话resume不含旧检索块。非法JSON、来源错误和取消有实际证据。
- 单元覆盖去重、拒绝、版本冲突、合并、检索预算、来源消失/编辑、集合更新、迁移回滚、重启状态、事件幂等、时区午夜、文件失败和符号链接拒绝。
- 原生macOS界面实际聊天、提取、来源查看、确认、JSON导出、日记和时间线；CLI实际搜索、兴趣/关系创建、Markdown导出和日记第2版。两种导出内容正确、权限0600。
- 一次性500代理实测主页同revision自动恢复：home failed once→home recovery response 200，错误提示消失。diff --check通过。
- 最终UI改动后重新完成typecheck/lint/desktop:build，随后仅改Runtime来源编辑与unit。500恢复使用最终release二进制组成的原生.app；其代理脚本、.app及运行数据已清理，没有独立日志/图片文件留存，原生AX/截图与命令输出在实施Agent工具记录。可复现测试源码保留于仓库。

### Known Limitations / Remaining Questions

Windows原生/ACL、真实云模型密钥未验证；本轮未重跑Linux矩阵，P1证据不代替P2 Linux检查。测试模型不代表云模型提取质量。删除记忆不删除原聊天、历史日记或既有导出；完整备份恢复与平台活动仍属后续阶段。实施者已清理自己的Runtime、模型、代理、桌面进程和临时数据，无实施阻塞；独立验收待完成。

## Rework Implementation Report

2026-11-03，新的rework_p2完成首轮三项返工，待新的独立验收。

- MemoryStore分离字段与单次来源输入校验；合法历史可超过200，编辑/去重/合并不锁死管理，完整来源保留导出。检索按确定顺序选择最近3条有效来源、每段最多500字。
- LifeService在52小时候选窗口稳定分页，每页500+1，最多10000条；未扫描完或目标日超过200条明确SOURCE_BUDGET_EXCEEDED，不生成部分日记。目标日较少但候选窗口超预算也会拒绝，文档如实说明。
- Memories操作期间锁定编辑/输入/取消/选择/分页，ref同步拒绝重复提交；成功清空已锁定草稿，失败保留并恢复操作。修复均在各自职责层，无新依赖/schema/服务。
- 修改store.ts、life.ts、memory.test.ts、Memories.tsx、docs/ai-core.md，新增tests/fixtures/memory-form.html/tsx可复现真实React延迟夹具。
- Risk Level S2。定向`npx vitest run apps/runtime/src/memory/memory.test.ts`17项通过；修改文件strict/noUncheckedIndexedAccess/JSX类型检查及同范围ESLint通过。来源201+、完整导出/最近/失效/长引用；前日501/9999、目标日201、扫描超限、相同时间跨页、上海午夜及洛杉矶DST覆盖。
- Vite加载真实Memories组件+官方Tauri IPC mock，浏览器实际显示PASS：延迟成功/失败、锁定B编辑/输入/取消/分页、重复提交不增请求、成功解锁、失败保留草稿并报错。复现入口为Vite的`/@fs/<仓库绝对路径>/tests/fixtures/memory-form.html`，点击运行按钮。
- diff/whitespace无问题，未重复Rust/DSH/P0/P1矩阵；临时Vite/浏览器页及单元数据已清理，夹具源码保留。不操作index/Git，不自行验收。
