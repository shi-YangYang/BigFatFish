# 模型、人格与聊天

P1 使用官方 DSH SDK 和同版引擎 `0.2.2-alpha.2`。Node.js 最低版本为 24.9，当前产品限定 Node 24。这里的会话历史是短期上下文，不是 P2 的长期记忆。

## 桌面使用

先通过 CLI 启动服务，然后打开桌面。进入「模型」，填写配置标识、名称、服务地址、模型名称和 API Key。上下文容量及输出上限应填写模型真实支持的值。首次保存会成为默认聊天模型，也可从列表重新选择默认模型。

DeepSeek 使用 Messages 服务地址，默认 `https://api.deepseek.com/anthropic`。OpenAI 兼容服务填写 Chat Completions 的基础地址，例如本地服务 `http://127.0.0.1:8000/v1`。远程服务要求 HTTPS；地址不得包含用户名、密码或查询参数。尚未配置模型时无法开始聊天，不会返回假回复。

在「人格」中保存名字、头像引用、角色、性格、风格、喜好、厌恶、边界、作息和自主活动偏好。修改保留版本历史，在后续回合开始时生效。头像引用目前作为人格配置保存，养成主页在 P2 展示。设定不是赋予外部操作权限。

「聊天」可新建和切换会话。消息逐段来自实际引擎输出；桌面从 Runtime 读取当前权威消息，CLI 使用认证 WebSocket 接收增量。取消操作会中断相应引擎任务；取消后的部分文字保留并标明状态。同会话请求按顺序执行，不同会话相互隔离。Runtime 重启会标记未完成回复为中断；DSH 历史通过真实 resumeSession 恢复。

## CLI

模型、路由、人格写入和聊天命令从标准输入接受 JSON，API Key 不接受命令行参数。含密钥的输入文件应保存在源码以外或 `.local/`，并限制为本人可读；也可通过桌面密码输入框保存。

```bash
npm run cli -- models list --json
npm run cli -- models set --json < .local/model.json
npm run cli -- routes get --json
npm run cli -- routes set --json < .local/routes.json
npm run cli -- persona get --json
npm run cli -- persona set --json < .local/persona.json
npm run cli -- persona history --json
npm run cli -- sessions list --json
npm run cli -- sessions create --json < .local/session.json
npm run cli -- sessions messages CONVERSATION_ID --json
npm run cli -- chat --json < .local/message.json
npm run cli -- cancel MESSAGE_ID --json
```

模型输入结构（`apiKey` 可选；省略保留原密钥，空字符串清除）：

```json
{"id":"local","label":"本地模型","provider":"openai","baseURL":"http://127.0.0.1:8000/v1","model":"your-model","contextWindow":32768,"maxTokens":4096,"timeoutMs":120000,"vision":false}
```

路由输入如 `{"chat":"local","memory":"local"}`，接受 chat/reasoning/vision/memory/asr/tts 配置。P1 实际使用聊天路由，其他用途由后续对应功能使用，不能把路由配置视为已实现语音或记忆功能。会话输入如 `{"modelId":"local","title":"今天的聊天"}`；聊天输入如 `{"conversationId":"会话ID","content":"你好","requestId":"客户端唯一请求ID"}`。省略 conversationId 时新建会话；省略 requestId 时 CLI 自动生成。相同会话和请求 ID 重试不会重复生成；同 ID 携带不同内容会拒绝。人格写入需携带查询得到的完整字段与 version，旧版本更新会冲突。

使用中的模型配置不能改变地址或模型名；可新增配置并开新会话。密钥可原位更新，下次执行使用新密钥。被会话或路由引用的模型不能删除。此约束避免将既有 DSH 会话默默转移到另一个模型。

## 存储与权限

模型密钥以 AES-256-GCM 加密写入 SQLite，独立随机密钥存于受限的 `config/master.key`。查询不返回 API Key。丢失 master.key 时不会悄悄生成新密钥来替代已有凭据。后续备份默认排除此文件；迁移需要重新配置模型凭据。该方式保护静态存储与误导出，不防御同一操作系统用户控制下的恶意进程。

引擎数据位于 `data/engine/<会话ID>/`，包含持久上下文。受控 profile 禁用默认 shell、文件操作、工作目录工具、会话日志贡献及插件清单上传；P1 不开放任何产品工具。桥接使用随机鉴权的回环连接，转发实际流帧并使用原生取消接口。这不是操作系统沙箱。未来产品工具仍须经过 Runtime 权限与审批。

## 状态与验证边界

`queued/running/completed/cancelled/failed/interrupted` 分别表示排队、执行、完成、取消、失败和服务中断。模型超时、无配置、请求失败均有明确错误码。服务不会将错误堆栈、模型响应错误正文或密钥写入公共错误响应。

测试使用真实 DSH SDK/子进程连接仅用于测试的本地 HTTP 模型，验证协议、真实流、跨进程恢复、取消和错误边界。夹具回复不代表云端模型质量或真实账号可用。真实云模型需要用户配置凭据后另行验证；Windows 原生执行结果仍单列。
