# Acceptance

## Result
PASS

R1 新独立验收 Agent：`/root/accept_qq_policy_r1`；2026-11-04，分支 `dev`。首轮唯一 P2 已修复；结合首轮未受返工影响的有效审阅与验证结论，Spec025 开发验收通过。本地提交仍由协调 Agent 按既有授权完成，不将尚未提交表述为已完成。

## Spec Coverage
- 好友草稿一致性：`QQConnection.tsx:29` 的 `changeFriends` 统一复选框、快速连接手填和已有服务手填三个编辑入口；两种表示同时更新，连接方式切换与联系人回退直接使用同一份最新草稿，Issue 1 已关闭。
- 手填体验：字符串输入原样写入 `manualFriends`，仅提交数组执行分隔解析，逗号、中文逗号和空白不会在输入过程中被重新拼接掉；复选框数组则同步生成文本。显示方式按钮只切换模式，没有新增切页或轮询补丁。
- 草稿和保存保护：编辑入口继续调用原 `change` 标记 `editing`；初始化/保存后的同步、revision、pending/savePending、busy/fieldset disabled 及两个提交请求的取值方式保持。
- 唯一主人、好友共享记忆边界、群触发、直接发送及旧审批废弃、撤权/取消/媒体/未知结果保护、抖音审批、桌面与窄屏布局均沿用首轮有效结论；R1 未改动这些路径。

## Validation
- Risk Level: 本次 R1 为 S1 单组件局部修复；Spec025 整体 S3 的既有检查继续有效。
- Evidence Reviewed / Checks Performed:
  - 阅读项目规则、当前交接、Spec/Plan、Decision015、首轮 Acceptance 及 R1 实施和 root 定向验证记录；审阅 `QQConnection.tsx` 当前源码及 diff，核对 helper、三个编辑入口、显示回退和状态保护。
  - 实际查看 `build/qq-conversation-policy/06-r1-external-selected.png`、`07-r1-external-cleared.png`、`08-r1-contacts-fallback.png`：已有服务分别显示 `20004` 和空名单，联系人回退后的手填框显示已保存的两个好友，未见界面错位。
  - 审阅 root 一次连续 CUA 工作流记录：勾选/取消后不先保存即切换已有服务，显示及服务端分别为 `["20004"]`/`[]`；联系人消失后保留 `20003`，连续输入 `20003, 20004` 并保存后服务端为 `["20003","20004"]`。中间输入及服务端读回结果依据 root 记录，截图不单独代替这部分证据。
  - 本验收未运行 test/build/typecheck/lint/Rust/CLI smoke，未重跑 CUA，未修改业务代码或操作真实 QQ；没有扩大检查范围。

## Issues
无未解决问题。首轮 Issue 1 已关闭，完整 FAIL 历史保留如下。

## Regression Risks
本次将同步职责收敛至组件好友编辑入口，未引入新的公共状态、跨层依赖或 API 变化。真实 QQ 新行为、Windows 实机、安装包、全项目类型检查既有错误及旧 B站 ffmpeg 用例的限制仍按 Plan 和首轮记录保留，不把隔离 fixture 验证当作真实账号验收。

## Required Rework
无。停止追加验证，交协调 Agent 完成本地提交与收尾。

---

# 首轮独立验收记录（历史）

## Result
FAIL

独立验收 Agent：`/root/accept_qq_conversation_policy`；2026-11-04。基线 `1408455`，分支 `dev`。存在一处新增好友配置的界面草稿一致性缺陷；其他已审阅路径未发现阻断。

## Spec Coverage
- 唯一主人与多个好友的 Runtime 校验、托管/外部接口、旧配置缺省兼容：符合；UI 在切换连接方式或联系人回退时与提交数据不一致，见 Issue 1。
- 主人身份按真实作者与私聊共同判断；好友使用外部受众、仅共享记忆，目标过滤及共享撤销守卫保持：符合。
- 选定群支持普通消息与仅被 @ 两种触发方式；默认普通消息，自身/未选群/重复事件保护保持：符合。
- QQ 直接发送统一覆盖 UI、API、CLI、B站和插件；旧审批入口返回废弃错误，旧待审批项不执行，旧 `channel.propose` 授权不升级：符合。
- 主动开关、目标范围、配置代次、插件撤权/取消、媒体及最终外发检查保持；未知结果不重试，真实状态与记录可查，抖音审批保留：符合。
- 桌面与窄屏已提供的界面场景视觉通过，但未覆盖 Issue 1 的切换路径；独立验收与本地提交条件尚未满足。

## Validation
- Risk Level: S3；范围限 QQ 身份/记忆/权限、持久配置、直接发送及直接调用链。
- Evidence Reviewed / Checks Performed:
  - 阅读项目规则、当前交接、Spec025、Plan 与实施报告、Decision015；审阅 Runtime、托管设置、CLI、B站、插件/SDK、桌面及相关测试和文档 diff。
  - 追踪入站身份、共享记忆、发送状态、最终权限与插件取消链；核对旧接口废弃语义以及 Runtime、CLI、插件和原生调用等待契约。
  - 审阅已记录的 14 个定向测试通过证据（QQ/protocol/managed/media 12、插件 1、B站分享 1），以及 Node 构建、apps 类型检查、Rust 检查、CLI 隔离 smoke 与 diff 检查结果；本验收未重复执行。
  - 实际查看 `build/qq-conversation-policy/05-desktop-final.png`、`03-narrow-friends.png`、`02-send-unknown.png`。截图内主人/好友/群分组、窄屏长昵称、直接发送结果未见明显错位或审批残留。另审阅 root 的有界 CUA 操作记录；未操作真实 QQ。
  - 静态追踪 `QQConnection.tsx` 的复选框、连接方式切换、联系人回退、手填输入与提交数据，确认 Issue 1。

## Issues
### 1. [P2] 好友授权草稿的展示和提交值会分离
位置：`apps/desktop/src/components/QQConnection.tsx:66`，关联第 15、28、35、67、79、83 行。

`form.friendIds` 与 `manualFriends` 同时持有好友草稿，但快速连接的好友复选框只更新前者。切换「已有服务」只调用 `setMode`，该页输入框显示旧的 `manualFriends`，提交时却使用 `...form` 中的 `friendIds`。联系人列表变空而回退手填时也直接读取旧字符串。

可复现步骤：以已保存空好友列表打开快速连接，勾选一个好友但先不保存，再切换「已有服务」。好友输入框仍为空，保存时却会提交刚才勾选的好友。反向从已保存的好友列表取消勾选后切换，会显示旧好友但实际提交移除。因这是私聊授权范围，用户看到的配置与实际持久化权限不能分离。当前手填切换按钮会显式同步，因此已通过的该按钮保值场景不能覆盖此问题。

## Regression Risks
- 本问题属于新增好友配置的 UI 草稿状态归属，后端权限校验本身正确；无需扩大为 Runtime 重构或重跑已通过的发送/记忆检查。
- 本轮未重启真实用户后台，也未验证真实 QQ 新行为、Windows 实机或安装包。
- 全项目 TypeScript 检查已报告两个未修改测试文件的三处既有类型错误；旧完整 B站观看用例缺少 ffmpeg 而跳过；完整桌面浏览器测试未执行。上述限制有明确记录，不作为本轮返工理由。

## Required Rework
1. 在 QQ 好友草稿的责任层统一或可靠同步复选框与手填表示，覆盖连接方式切换及联系人列表不可用的回退路径；保留手填过程和现有草稿/revision 保护。
2. 定向确认「勾选/取消好友 → 切换已有服务 → 显示及提交一致」与「联系人列表消失 → 手填回退保值」；不要求重跑本轮已通过的后端检查。
3. 由新的独立验收 Agent 审阅返工 diff 与上述最小验证结果。验收通过前不交付为已完成、不提交此阶段。
