# Acceptance

## Result
PASS — 2026-11-04，R1 新独立验收 Agent `/root/accept_fish_persona_r1`。首轮唯一 P2 已关闭，无需继续返工。

## Spec Coverage
- 已审阅最终人格预设、默认配置、提示组装、可信受众、设置页及文档差异；三套风格、旧配置保留、草稿保存与历史行为仍符合 Spec。未改动权限、数据库 schema 或公共 API。
- R1 在 `ChatService.chooseActivity()` 的输入组装层以 `const { persona, ...state } = this.life.overview()` 分离人格；user prompt 只序列化其余状态，persona 仍交给现有引擎统一处理。后台 system prompt 排除 role/traits/style，两个输入通道均不再主动注入预设聊天示例。
- 该解构不修改源对象；`LifeService.overview()` 本身未改，界面仍能读取完整人格。候选和全部其余状态保留；无工具的活动选择约束、取消/超时、index/reason 校验均未改变。
- 新增真实 DSH / 本地模型 fixture 用例检查完整 messages，不仅检查 system：排除人格 role/traits/style 与口吻示例，保留候选、非空兴趣和近期活动、心情与确认数，返回合法结果，并核对调用后 overview 不变。按 `BFF_ACTIVITY_CHOOSE` 定位任务消息，正确避开 DSH 追加的 runtime-context。
- 复用 Plan 和首轮验收中已通过的新会话/续聊、身份、配置兼容和桌面/380px 界面证据；这些路径未因 R1 改动，不重复运行或声称本轮重新目视。

## Validation
- Risk Level: S1（R1 单函数修复；原功能为 S2）。
- Evidence Reviewed / Checks Performed:
  - 审阅 AGENTS、constitution、全部 `.ai/rules`、当前 handoff、Spec/Plan/Decision016、首轮验收和 R1 实施报告。
  - 独立审阅当前最终业务 diff、新增 preset/prompt 模块及测试；沿 `chooseActivity → DSHAdapter → buildPersonaPrompt` 核对数据流，并读取未改的 overview 与本地模型 fixture 响应/请求捕获实现。
  - 审阅 `rework.md` 中唯一目标用例的执行记录：`npx vitest run tests/integration/persona.test.ts -t 'keeps conversational persona out of activity-selection requests'` 最终 1 passed / 2 非目标 skipped。首次失败来自测试错误选择最后一条 user 消息，修正任务定位后通过，未削弱排除和保留断言。
  - 本验收未执行自动化测试、build、typecheck、lint 或 UI；已有相关通过证据足够，无具体新问题需要扩大验证。仅更新本验收文件，未修改业务代码、切换分支或执行 Git 写操作。

## Issues
无未解决项。首轮 P2 已由 R1 在状态组装职责层修复。

## Regression Risks
- 本地 fixture 证明实际请求传递和结果协议，不证明真实云模型的人设口吻；本轮未调用云模型或真实 QQ。
- 既有配置不自动替换、旧 Runtime 需重启加载源码、未重打发行包等既有交付边界保持。

## Required Rework
无。满足本轮停止条件。

---

# 首轮验收历史（FAIL，已由 R1 关闭）

## Result
FAIL — 2026-11-04，独立验收 Agent `/root/accept_fish_persona`。有一项后台任务输入遗漏，需定向返工。

## Spec Coverage
- 三套预设有明确差异、具体互动反应和原创示例；默认仅用于无既有 persona 的数据库，符合要求。
- 预设只覆盖 role/traits/style/likes/dislikes；身份、用户边界、作息、自主偏好和版本保持。匹配按五字段实际值判断，编辑后显示自定义。
- 保存 ref 锁与禁用控件避免重复提交和提交期间草稿覆盖；原版本冲突检测、历史保存沿用。root 的隔离 UI 记录覆盖保存、历史与冲突反馈。
- ChatService 从数据库 audience 提供可信 interaction；好友/群与主人会话提示分开，现有工具权限及记忆范围逻辑未改。DSH 每轮从当前配置组装提示，已提供真实 DSH 续聊请求验证证据。
- 界面主要展示名字、性格、单句示例和保存；详细设定、版本记录折叠。已目视桌面、窄屏及窄屏展开三张截图，未发现错位或横向溢出。
- 后台任务在 system prompt 排除聊天字段，但活动选择通过自己的 user prompt 又带回完整 persona，未满足「后台任务不注入聊天示例」验收项。

## Validation
- Risk Level: S2。
- Evidence Reviewed / Checks Performed:
  - 审阅当前 Spec/Plan/Decision016、相关完整 diff、新增 preset/prompt 模块、定向单元/集成测试，以及 Configuration、DSH、QQ 受众来源和后台调用路径。
  - 实际查看 `build/fish-persona/01-desktop.png`、`02-narrow.png`、`03-narrow-details.png`；结合 root CUA 交互记录（380px 溢出 0、主控件外层 40px、详细字段 348px）。
  - 审阅实施报告中的 Node build、apps-only tsc 和 7/7 定向 Vitest 通过结果与对应测试内容；未重复运行已经通过的检查。
  - 未新增测试、运行应用/构建、调用云模型或操作真实 QQ；未修改业务代码或执行 Git 写操作。

## Issues
### P2：活动选择重新注入了完整聊天人设
`apps/runtime/src/ai/chat.ts:146` 的 `chooseActivity()` 将 `JSON.stringify(this.life.overview())` 直接放入模型 user prompt。`apps/runtime/src/memory/life.ts:134` 的 overview 明确包含 `persona: this.config.persona()`，所以选用任意新预设后，role/traits/style 以及整段「口吻示例」仍然进入活动选择请求。

`persona-prompt.ts:9` 只从 system prompt 排除这些字段，无法覆盖另一个输入通道。这使后台人设过滤只在记忆提取等路径有效，活动选择仍携带本轮设计要排除的闲聊台词。现有集成测试仅检查记忆提取的 system prompt，不能发现这个遗漏。此处是静态数据流证据，并非声称已观察到真实云模型输出错误。

## Regression Risks
- 活动选择可能把示例或聊天口吻混入 JSON 决策内容；需要在其状态组装职责处去掉重复的人设字段，同时保留必要兴趣、心情、活动等决策数据。
- 本地 fixture 证明请求链路和续聊兼容，不证明真实云模型的主观口吻质量；该限制已明确。
- 既有配置不自动替换、旧 Runtime 需重启、未重打发行包均为已记录的交付边界，不是本轮失败项。

## Required Rework
1. 在活动选择的输入组装处排除完整 persona 或使用明确的决策状态投影，避免 persona.style 经 overview 回流；不要通过删除人格、改权限或扩大重构解决。
2. 增加或调整一个最相关定向检查，验证活动选择最终请求不含预设聊天示例，并仍携带必要决策状态且返回合法 index/reason。无需重复完整现有套件或 UI 检查。
3. 按项目流程由新的实施 Agent 返工，再由新的独立验收 Agent 复验。
