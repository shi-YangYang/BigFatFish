# Rework R1：好友草稿展示与提交一致

2026-11-04 首轮独立验收FAIL，唯一P2见acceptance.md Issue1。其余QQ身份/发送/撤权/兼容与已执行检查均保持有效。

## 根因与范围
QQConnection里form.friendIds和manualFriends是同一好友草稿的两种表示；checkbox只更新前者，模式切换/联系人丢失直接展示后者。修复应在该组件好友编辑职责层统一同步，不在切页/轮询多个调用点补特判。

## 要求
- 勾选或取消好友后，两种表示一致；切换已有服务和联系人回退时显示值与提交friendIds一致。
- 保留手填期间的逗号/空格等输入体验，不因边输入边解析造成分隔符消失而无法继续输入多个ID。
- 保留revision/dirty/savePending/disabled等保护，不改后端或其他页面。

## 验证
局部单组件返工，按S1范围检查diff，root通过一次定向CUA工作流验证：已保存空好友→勾选→不保存切已有服务→显示及提交一致；已保存好友→取消→同路径为空；好友选择后联系人消失→手填回退保值。纯假数据fixture，真实QQ不操作。后端/Node/Rust/apps等已过检查不重复。新的独立验收审阅返工及证据后决定PASS/FAIL。

## R1实施报告
### Summary / Files Changed
新的实施Agent `/root/rework_qq_friend_draft` 仅修改 `apps/desktop/src/components/QQConnection.tsx`。新增组件内 `changeFriends` 编辑入口，好友复选框、快速连接手填框和已有服务手填框都经此同步 `manualFriends` 与 `form.friendIds`；切换显示方式的按钮只切模式，不再承担补同步职责。源码已冻结。

### Root Cause / Important Decisions
同一好友草稿此前由两个状态表示，但不同编辑控件自行更新部分状态，导致切页或联系人回退时展示过时名单。同步职责现归好友编辑入口：字符串输入原样保留以支持连续输入逗号、空格和中文逗号，同时解析出提交使用的ID数组；复选框输入数组时生成对应文本。初始化/保存后的服务器同步仍沿用原逻辑，dirty/revision/savePending/disabled及请求正文结构均未修改。无需切页或轮询特判，也不引入公共模块或新状态层。

### Validation
- Risk Level: S1，单组件局部草稿一致性修复。
- Checks Performed: 审阅本组件diff，核对三个好友编辑入口和模式切换均使用一致草稿；确认手填原文未被parse/join覆盖。
- 未运行测试、build、typecheck、lint，未重复Spec025已通过的后端检查；root将完成规定的单次CUA定向工作流，再交新的独立验收。

### Known Limitations / Remaining Questions
本实施者未执行UI实测，不声称切页/联系人回退的动态验证已通过。未操作真实QQ、后台或Git写操作。无需求待确认项。

## Root R1 定向验证
2026-11-04，在同一假数据fixture通过CUA执行一次连续工作流，未重复后端检查：
1. 已保存friendIds=[]，勾选小明20004但未保存即切「已有服务」，输入框显示20004；保存后服务端friendIds=["20004"]。
2. 切回快速连接取消20004，未保存即切「已有服务」，输入框为空；保存后服务端friendIds=[]。
3. 切回快速连接勾选20003，再让fixture联系人响应为空。页面轮询自动回退手填并显示20003，没有切换按钮补同步；输入`20003, `保留逗号和空格，继续逐字输入20004得到`20003, 20004`。保存后服务端friendIds=["20003","20004"]，模式managed。
截图：`build/qq-conversation-policy/06-r1-external-selected.png`、`07-r1-external-cleared.png`、`08-r1-contacts-fallback.png`。首轮功能/视觉证据仍有效，R1只改变好友编辑同步。没有真实账号或外发操作。
