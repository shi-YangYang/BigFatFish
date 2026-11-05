# Acceptance

## Result
FAIL

独立验收：`/root/accept_other_connect_flows`。本轮仅审阅、最小隔离复现和记录，未修改业务代码。

## Spec Coverage
- B站单次启用、凭据核验/扫码、取消、匿名入口及旧 API：实际 diff 与定向测试断言符合设计。
- 抖音单次连接、可见浏览器登录、首次稳定身份双证据绑定、已有绑定不覆盖：实际服务及租约/队列边界符合设计。
- 取消、配置替换、停服的信号与版本检查已审阅，既有测试覆盖挂起结果释放；未发现这一范围内新的阻断。
- 两页页签、状态卡片、主要动作及互动页目标输入符合设计；桌面和 380px 截图未发现明显错位。
- 编辑草稿保留未完全满足：抖音配置校验失败后，保存回调提前解除草稿保护，随后轮询覆盖输入，见 R1。
- 原抖音审批、最终账号检查、网络请求门和不支持操作限制保留；B站分享仍走原 QQ 发送服务。无 schema/依赖/目录迁移。

## Validation
- Risk Level: S3（连接认证、配置持久化和新增 API；UI S2）。
- Evidence Reviewed / Checks Performed:
  - 已读取项目约束、Spec/Plan、Decision019、当前交接；独立审阅两平台服务/路由、实际 QrAuth、BrowserManager 租约/账号、前端表单与 diff、新增定向测试和文档。
  - 复用实施报告中的 Node 编译、apps-only 类型检查、6 项连接测试及后续两个单项复查结果；没有重复执行已通过检查，也未把这些命令记为本验收 Agent 执行。
  - 审阅协调 Agent 的实际组件隔离 UI 操作记录；独立查看 `build/platform-connect-flow/02-bili-connected.png`、`04-douyin-narrow-settings.png`、`05-douyin-connected.png`。不将模拟状态当作真实账号验证。
  - 针对 R1，仅执行一个 Node 隔离复现：使用已构建的实际 Douyin/TaskQueue/SQLite，在新临时目录调用 `connect({revision:'',pythonPath:'relative-python',...默认配置})`，等待一个事件循环后读取状态；finally 关闭服务/队列/数据库并删除临时目录。未启动浏览器或请求外部平台。
  - 实际结果：connect 同步返回 `{phase:'connecting',pythonPath:'python3'}`；随后状态为 `{error:'INVALID_PYTHON_PATH',pythonPath:'python3',enabled:false}`。结合前端第 309 行无条件 `editing.current=false` 及第 87 行刷新赋值，可确定未保存输入会被旧配置覆盖；该 UI 失败链路为源码推导，没有声称重新操作浏览器复现。

## Issues
### R1 — 保存失败后覆盖抖音设置草稿（P2）
位置：`apps/runtime/src/douyin/service.ts:33–60`；`apps/desktop/src/components/Douyin.tsx:87,309`。

配置校验/保存放在 connect 的后台 Promise 内，而 connect 立即返回成功响应。用户输入相对 Python 路径、相对浏览器路径或非数字账号 ID 后点「保存并连接」，HTTP 调用被当作成功；前端立即清除编辑标志，随后刷新以旧配置覆盖这次输入。校验错误虽然进入连接错误状态，原草稿已经丢失。根因是“已接受连接任务”与“配置保存成功”的响应语义混用。

## Regression Risks
返工需保留正在连接时取消、配置替换和停服阻止迟到写入的检查；不要为等待配置而恢复页面自己串联登录步骤，也不要复制两套配置校验。连接后真实平台、安装包、Windows、付费模型仍未验证，不影响本轮定位。

## Required Rework
1. 在 Runtime 的配置职责层明确配置验证/保存成功边界：无效配置应让保存请求失败，或提供可由前端可靠识别的保存结果；只有配置确实被接受保存后才能解除草稿保护。
2. 校验失败后保留所有用户填写的字段、保留可编辑状态并展示错误；修正后仍可一次「保存并连接」。覆盖相同职责内的浏览器路径、Python 路径和账号 ID 校验，避免只特判某个字段。
3. 对该失败路径做最小定向验证，并交新的独立验收；已通过且未受修改影响的 UI/平台检查无需重跑。
