以真实入站解析、当前回合授权与工具注册、OneBot 协议适配为修改边界。实施者在隔离环境覆盖：普通混合消息、不可充当写授权的外部段、主人/非主人/范围撤销、图片来源及回执、三种只读工具与范围限制。沿用 Spec063 的定向工具链回归；阴性和阳性都必须能从输出区分。协调者保留同输入基线/修改/回退证据，最后独立验收。

## 实施与验证（2026-11-20）

入站解析给不支持的 OneBot 段保留本地类型占位，舍弃原载荷；群消息可照常回复，但混合外部内容不能给账号操作授权。group-intent 按发言人、本条原文和图片位置识别目的；group-command 只接纳本轮字段、原值与图片来源，向群里只返回状态。只有在写入前参数不匹配或图片还没看时才允许纠正；不重复提交无法确认的操作。group-reads 将查询绑定到当前群及消息中的实际 @，对照内置 NapCat 三个接口裁剪非必要字段。用户示例已更新到 docs/qq.md。

按 S3（群聊与账号写权限）做定向验证，没有使用真实 QQ 或收费模型：

- `node node_modules/vitest/vitest.mjs run tests/integration/qq-group-capabilities.test.ts tests/integration/qq-action-reply.test.ts`：2/2 通过。隔离 Runtime、DSH、模型夹具与真实 WebSocket 请求覆盖三种只读、签名回读、先看图再换头像、指定本条图片发说说，以及无回执不重试。
- `node node_modules/vitest/vitest.mjs run tests/integration/qq-group-scope.test.ts tests/integration/qq.test.ts`：6/6 通过。含授权撤销、非主人、未知段、跨群与非 @ 目标、错误图片来源。补充无引号昵称歧义后单独复验 qq-group-scope，4/4 通过。既有 qq-self-tools 用例 4/4 通过。
- `npm run typecheck`、本轮 TS 文件定向 ESLint、`git diff --check` 均通过。测试夹具中曾错误断言 DSH 保留 additionalProperties、用纯 @ 空正文构造入站；分别改为检查实际参数白名单/拒绝行为、使用正常群消息。没有改动投递策略、数据库或真实账号；真实 QQ 客户端显示仍待人工验证。

### R1：群里改签名与昵称的原文边界

未加引号时，只接受没有分隔符的单一值；分句、追加说明、直接连写的撤回或玩笑均转为澄清。需要标点或多个词时，使用完整的「原文」；引号内标点不变，引号外追加说明不授权。简单昵称与签名仍可直接说。

定向验收先复现旧解析器把「开心，别真的改」整体授权为签名（退出 1，工作树外 `../qq-three-steps/r1-boundary-baseline.log`）。修复后仅运行新增的值边界用例与一项隔离 Runtime → DSH → 模拟 OneBot 回合（2/2，通过，`../qq-three-steps/r1-final.log`）。该回合中模型主动构造改签名、改群名片两个未注册调用；协议端两种写请求均为零，旧签名不变，群里实际收到一条要求给出签名原文的澄清。未用真实账号或收费模型。
