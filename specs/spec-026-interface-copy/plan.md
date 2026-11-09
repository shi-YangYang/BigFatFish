# Plan：界面文案精简

## 范围
S0。QQConnection删除主人说明、好友记忆说明及两个主动开关旁重复「直接发送」；style.css清理对应未使用qq-owner-hint。Models删除推理强度解释段落；Memories删除模型/预算说明段落；Life删除日记模型/更新说明；Douyin仅将不支持操作提示改为用户措辞。保留按钮、字段、状态、必要失败/风险/步骤提示，不改其他界面设计。

## 验证与停止
仅审阅diff，确认目标文案与无用样式移除、必要提示/JSX/状态回调保持。不开UI、不运行test/build/lint/typecheck、不重跑Spec025后端验证。新的独立验收审阅差异通过即本地commit；无push。

## 实施报告
### Summary
已按指定范围清理界面解释文案；控件、状态、事件回调、API及业务规则保持。

### Files Changed
- `QQConnection.tsx`：删除主人数量、好友记忆两段说明及两个主动开关旁的「直接发送」。
- 收尾删除主人手填输入框重复的 `placeholder="唯一主人的 QQ 号"`，保留标签及全部输入属性与回调；未追加检查。
- `Models.tsx`、`Memories.tsx`、`Life.tsx`：删除推理强度说明、记忆整理模型/预算段落、日记模型/重复更新说明。
- `Douyin.tsx`：限制提示改为「暂不支持私信、分享和投稿。」。
- `style.css`：仅删除随主人说明失效的 `qq-owner-hint` 规则。
- 本 Plan：记录本次实施结果。

### Important Decisions
沿用已确认 Spec，仅删独立展示节点及直接失效样式，不调整其余页面结构。扫码、安装前置、失败、实际结果及操作风险提示均未修改。

### Validation
- Risk Level: S0。
- Checks Performed: 审阅六个源码文件修改前后的 unified diff；全部为指定文案/展示节点及单条失效样式，未改变条件分支、表单关联或回调。
- Result: diff 符合预期；未运行 test/build/lint/typecheck、未打开 UI，未执行 Git 操作。独立验收由新的验收 Agent 完成。

### Known Limitations
本轮仅有源码差异审阅，无运行或真实平台验证；按 S0 规格不重建产物。

### Remaining Questions
无。实施已冻结，交协调 Agent 安排独立验收。
