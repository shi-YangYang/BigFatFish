# Acceptance

## Result

PASS（返工后代码与已执行路径）。2026-11-03，新的独立accept_p3_rework确认两项阻断闭环，无直接回归或剩余问题。真实QQ/Windows/云与完整媒体等缺口单列；以下保留首轮FAIL和文末复验。

## Spec Coverage

已核对schema4/凭据、manifest/lifecycle/构建复制、OneBot登录/健康/echo/retcode、身份/去重、统一ChatService/DSH和记忆受众、审批绑定/终态、媒体以及Desktop/CLI。多数路径符合Spec；发送隐私边界与渠道故障隔离存在以下问题。

## Validation

- Risk Level S3。
- 阅读规则、Spec/Plan/Decision、P2验收、相关源码/diff/测试/文档；复用实施者类型/Lint/构建、真实DSH/CLI/原生证据，不机械重复。
- 两次隔离复现，当前构建产物已核对源码一致；临时数据和连接清理。第一项真实ChatService/Channels/WebSocket，仅模型换为确定性桩；第二项真实Runtime认证API与重启。未改业务、测试或Git。

## Issues

1. P1：service.ts:70、chat.ts:78、plugins/qq/index.mjs:64。模型完成时只复核一次共享记忆，发送前异步账号检查之后的guard仅检查渠道配置权限。群生成读取共享marker→挂起get_login_info→改记忆为私有→放行，撤销时尚无send_*，随后仍发出marker并标sent。实测modelSawSharedMarker=true、currentVisibility=private、sendCount=1、delivery=sent。原测试未覆盖这一发送窗口。
2. P2：service.ts:28/33与index.mjs:14。validToken允许HTTP头不支持字符，先持久化enabled配置再创建WS，同步异常逃出。认证PUT中文测试token返回INTERNAL_ERROR却保存hasToken/enabled；停止后重启报Invalid character in header content [Authorization]，本地API/聊天也不可用。

## Regression Risks

未发现P0屏障、P1清理、P2来源/日期/表单修复直接回退。真实QQ/Windows/云、完整媒体和动态插件仍单列，不作为本次FAIL替代原因。末次原生构建后的S0文案未复测，报告准确。

## Required Rework

将本次群回复的记忆范围绑定至最终外发检查；覆盖模型完成后/健康等待期间撤销，断言无send_*。保存前验证实际Bearer头，连接初始化错误只进入渠道状态，Runtime与本地聊天可用；覆盖拒绝非法配置和已有异常配置启动恢复。新的实施者与新的独立验收者闭环。

## 返工复验：PASS

- ChatService.run绑定实际模型上下文，Channels等待前获取对应句柄，没有用新快照授权旧回复。QQ异步账号/健康检查后同步guard，到socket.send无异步窗口。
- 共享变更blocked/MEMORY_SCOPE_CHANGED，外发前失败与外发后未知分开，撤权审批revoked；映射/句柄/运行集合随完成失败释放。主人与独立主动审批保留原授权语义。
- Bearer头验证先于加密/revision/DB/连接变更；非法token原子拒绝。旧异常token的WS构造仅转QQ错误，能停用，原样启用拒绝，更正恢复。捕获范围不吞DB/解密错误，MASTER_KEY_MISSING拒绝保留。
- Risk Level S3，定向独立阅读规则/Spec/Plan/首轮验收/Rework/Decision/交接、源码/diff/回归/文档。核对测试确实在生成完成、健康等待、尚无外发时撤销并断言零发送，含群/主人/主动审批对照；非法token比较DB/key/revision/config/socket，覆盖旧配置重启、本地聊天及修正。
- 复用已通过定向测试/Node构建/ESLint/diff，未重复运行或修改文件/Git。无Required Rework；确定性桩、协议夹具、此前真实DSH/原生证据与真实账号缺口各自保持。
