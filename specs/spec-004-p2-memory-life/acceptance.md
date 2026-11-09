# Acceptance

## Result

PASS（返工后代码与已执行路径）。2026-11-03，新的独立验收者accept_p2_rework确认三项返工闭环，无本轮阻断问题。Windows原生/ACL、真实云模型及P2 Linux实跑仍未验证。以下保留首轮FAIL证据，文末记录复验。

## Spec Coverage

已审阅schema3、迁移事务、候选/来源/版本/冲突/合并/查询/删除/导出与集合维护；同一Configuration/AgentEngine/DSH、临时检索上下文、任务取消/停止/重启；真实事件、时区日记、副本失败/受限原子文件、认证API与Desktop/CLI。P1 Chat和DSH清理未回退。长期管理、日期完整性及UI可靠操作仍有下述缺口。

## Validation

- Risk Level：S3。
- 阅读Spec、Plan实施报告、Decision、规则、源码/diff与保留测试；复用实际typecheck/lint/构建、真实DSH、原生UI/CLI证据，未机械重跑。
- 单次定向内存数据库复现（构建产物已核对实现一致、不调用模型/不写用户数据）：`sources=201, status=confirmed, rejectError=INVALID_MEMORY`；`selectedDayEvents=1, diaryError=NO_DIARY_SOURCES, engineCalls=0`。
- UI问题基于明确异步顺序与控件状态判断，未声称原生复现。未改业务、测试或Git。

## Issues

1. P2：store.ts:21的sources<=200同时限制新输入和历史记录；updateInside:61重新验证历史，但编辑/去重/合并可累积超过200。创建后200次内容编辑得201来源，最新版本拒绝/编辑/确认均报INVALID_MEMORY。须分离单次输入与历史管理限制，检索另有预算。
2. P2：life.ts:43在52小时UTC候选窗口LIMIT501后才按指定时区日期过滤。前日501条+目标日1条会误报NO_DIARY_SOURCES，截断落在目标日也可静默遗漏。须保证日期筛选完整性，预算不足如实报错。
3. P2：Memories.tsx:14保存返回无条件清空编辑/表单；busy时仍可编辑另一条或修改/取消草稿。A保存→编辑B或继续输入→A返回会清除新草稿。须按身份/版本归属回写，或完整禁用相关操作。

## Regression Risks

Windows原生/ACL、真实云Key未验证，本轮无P2 Linux矩阵；外部缺口独立记录，不替代上述FAIL理由。

## Required Rework

修复三项并给出来源累积、日期窗口截断、延迟保存边界定向证据；新实施者与新的独立验收者闭环，不重跑无关P0/P1矩阵。

## 返工复验：PASS

- 历史来源：字段/输入来源校验分离，更新不受历史200条限制，编辑/去重/合并保留完整来源；检索确定选择最近3条有效来源、每段500字，管理/导出仍完整。用例覆盖三种累积路径、201条后状态/编辑、导出/失效/长引用。
- 日记日期：时间+ID稳定分页，多读一条判完整性；恰好10000可完成，仍有记录或目标日>200在模型前明确失败，不生成部分日记。前日501/9999、同时间跨页、超限、上海午夜/洛杉矶DST已有覆盖。
- UI：同步ref防重复，busy禁用编辑/输入/取消/选择/分页；成功只清空锁定草稿，失败保留并解锁。真实React夹具对慢成功/失败、B编辑/取消/分页/重复提交有明确断言。
- Risk Level S2。独立阅读规则/Spec/Plan/首轮验收/Rework/Decision、实际源码/diff、测试与夹具；复用17项定向测试、范围类型/Lint和浏览器执行证据。无具体疑点，不重复检查或构建。
- 修复在各自职责层，无依赖/schema/目录调整。扫描窗口超预算可能拒绝活动较少的目标日，文档已说明。外部缺口未扩大为通过；无额外返工要求，未改业务或Git。
