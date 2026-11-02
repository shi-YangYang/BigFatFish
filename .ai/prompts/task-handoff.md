# Task Handoff

## Role

P3代码与已执行路径验收已完成，root按授权提交本地阶段快照，随后进入P4。

## Goal / Project Mode

EXISTING。用户完整P0–P7 Goal持续active，当前Spec005：QQ个人小号、私聊/群聊、主人与受众隔离、统一人格/记忆/会话、发送权限/审批，以及实际插件生命周期和Desktop/CLI管理。不可缩减为协议空壳。

## Context

P0本地52eaaf8、P1本地b1f73b3、P2本地86bc867。P2真实DSH/原生macOS/CLI与三项返工已独立验收PASS，见Spec004。Windows原生/ACL、真实云模型未验证，本轮P2没有Linux重跑；P1正式Linux镜像有真实DSH证据，不代替后续阶段。P2所有Agent报告已处理，无运行中实施任务。

P3实施者implement_p3已返回完整报告，记录在Plan005：23项相关累计定向通过，最终QQ真实DSH/协议两项、构建后CLI、原生macOS UI和媒体审批有证据，等待独立验收。最终原生构建后的两个文案/作者标签S0仅diff检查，未假称原生复测。真实QQ、Windows/云、完整媒体/动态插件缺口保持。

首轮accept_p3已返回FAIL：已生成群回复在发送前异步健康检查期间撤销共享仍外发；非法HTTP头token被持久化并阻塞整个Runtime后续启动。两个隔离复现详见Acceptance/Rework。新的实施者修复根因与直接路径，不重复无关矩阵。

新的rework_p3已完成：生成快照绑定最终同步发送检查、SEND_NOT_STARTED分类，Bearer保存前验证和WS构造异常隔离；旧坏配置可启动/停用/修正，缺master.key仍安全拒绝。新2项+既有协议健康3项通过，最后停用边界仅token用例再过；Node构建/定向Lint/diff通过，详细报告在Plan。新测试模型为确定性桩，其余Runtime/DB/API/WS真实，未重复原生/DSH。

新的accept_p3_rework逐项独立审查后PASS，无直接剩余问题，报告已处理并追加Acceptance。尚未提交前，HEAD仍86bc867；此快照提交后再进入P4，外部/完整媒体缺口保留。

## Spec / Relevant Files

- 根AGENTS、constitution/mission/tech-stack、全部.ai/rules、产品设计目标、ARCHITECTURE。
- specs/spec-005-p3-qq/spec.md/plan.md、.ai/decisions/005-qq-identity-permissions.md，既有Decision002/003/004。
- docs/upstreams.md的固定OneBot/NapCat/QQ上游与许可；docs/ai-core.md及Spec004 Plan/Acceptance。
- 实际Runtime ChatService/Configuration/SecretStore/LifeService/MemoryStore、schema3、认证路由/lifecycle；现有CLI、Desktop Chat/Life/Memories。

## Scope

OneBot11正向WebSocket协议客户端与QQ插件，稳定ID/登录状态/健康/重连，持久消息去重/发送结果，主人和群授权、可信会话受众、记忆私有/明确共享范围、普通回复与主动审批，manifest/initialize/start/stop/health/dispose、统一管理与审计，Desktop Channels/Permissions和CLI实际操作，直接测试和使用文档。产品要求的文本/媒体类型及引用回复明确适配，未接入视觉/ASR不假装理解。

## Out of Scope

不提前实现B站/抖音/Web/发布。不连接本机既有QQ、不借用Cookie或凭据、不真实发送消息；授权账号/扫码由用户操作，当前使用本地夹具。NapCat独立安装，不复制或捆绑受限制许可源码。不创建公共包、不迁移现有目录、不加载上游第二个DSH大脑。

## Constraints / Actual Interfaces

Runtime唯一业务入口，同一Configuration/AgentEngine/Memory/Event体系。ChatService已持有LifeService和DSHAdapter；QQ调用统一会话/消息能力。当前MemoryStore只面向本机主人，外部身份须新增可信主体/受众并默认迁移旧记忆为私有；不能只靠提示词隔离。身份/授权变化不能恢复越权旧DSH历史。平台文本/模型不得授予owner。

SecretStore复用master.key；Configuration当前只检查models.secret，新增平台token须统一全部加密记录的缺key判断。每次发送再检查许可/账号/插件状态，撤销/停止取消任务并拒绝迟到结果。审批绑定准确不可变参数、到期及一次执行；未知发送不得自动重发。

plugins已有源码预留，tsconfig.node当前rootDir=apps，产物dist/runtime/src、dist/cli/src。新增真实插件需明确构建/资源复制/加载路径并保持现有入口，不能只在开发时可用。单根npm依赖与普通模块，不用独立package.json包装共享逻辑。

P0启动屏障/ACL、P1默认模型/选择草稿/SDK清理、P2来源历史/日期完整性/表单锁定修复必须保留。

## Acceptance Criteria / Commands

S3：新持久化、外部通信、认证授权/审批、插件构建。按Spec005执行类型/Lint、相关unit/协议集成、实际构建与Runtime/CLI/Desktop；真正DSH+本地模型连接OneBot夹具覆盖私聊/群聊和跨入口记忆。检查echo/retcode、未登录/错误token/账号、去重/重连/未知结果、伪装主人/非授权群/自身消息、撤权/停用/配置变更竞态、私密标记不入群模型请求、角色变更会话、审批篡改/过期/重放、缺失master.key。

按改动范围运行，不机械重跑P0/P1全部矩阵；失败定位后只补受影响检查。未执行Windows/真实QQ/云Key明确单列，不能用夹具当外部成功。

## Expected Output

PASS/FAIL Acceptance Report：逐项对照Spec和实际源码/diff/测试证据，重点审查身份/受众/旧会话隔离、撤权竞态、审批精确绑定与未知结果、媒体/凭据/来源、插件生命周期/构建产物、UI异步及直接回归。不机械重跑已过检查，有具体疑点才定向复现；不修改业务或Git。外部/媒体待收口限制与代码判定分开，失败交新的实施/新的验收闭环。

## Git 状态与授权

当前dev，HEAD 86bc867。用户明确每完成阶段本地commit，由root验收后执行，无需再次确认；无push/PR/merge/发布/历史改写授权。

实施者不得git add/restore/reset、改index、切分支、commit或push。保护root治理改动，Spec006–009是未来Draft，不属本阶段提交。P3对应Spec005/Decision005/当前handoff和状态更新。远端/PR未刷新核实，未推送远端CI。
