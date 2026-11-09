# 修复 CI 类型检查

状态：Done，[独立验收 PASS](acceptance.md)。EXISTING，dev / 1a837de。风险 S2：多个测试与共享夹具类型契约同步，不改变生产运行行为。修复尚未提交/推送。

## 背景与当前行为

用户先要求 local commit，再提供 CI 的 npm run typecheck 失败日志。Spec058 已本地提交 1a837de，未推送。日志包含 HTTPS 测试替身的 overload 类型断言、已移除 ChannelStatus.manifest、准备进程可能未赋值、共享模型 fixture 声明缺少 emotionResponse/replyTools/sticker 及消息/工具类型、Fastify initialConfig.requestTimeout 类型不可见、QQ deliveries 结果类型丢失字段等问题。

## 目标与目标行为

现有 npm run typecheck 命令完整通过。测试声明与实际夹具/生产契约一致，现有行为断言保留；可选值在确有必要时显式收窄。

## 功能需求

1. 同步 model.d.mts 与 model.mjs 的实际可用控制项、请求消息和工具结构。不得将实际可缺字段无条件声明成必有，必要时在使用端收窄。
2. QQ 测试状态使用 builtin；修正 HTTPS 替身的重载边界、异步赋值的运行时保证与相应类型。
3. Fastify 超时检查对应实际公开对象；保持验证超时配置的原意。QQ 记录字段在返回边界或测试读取边界有准确类型。
4. 按最终实际差异选择必要的定向行为检查，不删断言或放宽期望来通过检查。

## 非目标、技术约束与兼容

不关闭 strict、不排除 tests、不新增 ts-ignore/ts-nocheck、不用全局 any 掩盖契约；不修改 CI 命令、依赖或构建链，不处理未报告的其它 CI 阶段，无关历史缺陷不扩修。不操作真实数据/运行实例/收费模型/平台账号。本轮后续修复没有 commit/push 授权。

## 验收

- [x] 用户日志对应错误已合理修复，生产行为无无关变化。
- [x] npm run typecheck 完整通过，未缩小检查范围。
- [x] 必要的相关行为检查通过；纯声明修正不重复跑完整测试/build。
- [x] diff 合规，新独立 Agent 验收通过，区分本地检查与尚未重跑云端 CI。

## 待确认

无；已有日志足够定位，以现有依赖源码和实际测试行为为准。
