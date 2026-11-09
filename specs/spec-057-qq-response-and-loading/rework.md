# Spec057 局部返工 R1

首次独立验收 FAIL，完整结论见 [acceptance.md](acceptance.md)。根协调已读取报告。核心发送、网络恢复与其它反馈无阻塞，不扩大修复范围。

## 范围

风险 S1：`QQConnection.tsx` 当前忙碌状态误复用 `lastAction` 历史操作归属。保存完成后刷新联系人，保存按钮错误显示 Loading。只修真实执行状态与错误归属的区分，保留互斥、防重复、保存错误位置。

## 验收

保存完成 → 联系人刷新挂起时，刷新图标 `aria-busy=true`，保存按钮不显示 busy（允许 disabled）。刷新结束恢复；保存自身忙碌与错误归属保留。最多运行一个相关浏览器场景，不重复 Runtime/网络或完整构建。由新的实施 Agent 返工，再由新的独立 Agent 验收。未获真实实例迁移或 commit 授权。
