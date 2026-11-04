# B站

在桌面「连接 → B站」启用插件，可搜索公开视频并输入 BV 号观看。未登录时只能访问平台允许匿名读取的内容；AI 字幕和部分视频可能需要登录。扫码、验证与导入均由用户明确操作，不读取其他软件的登录态。扫码状态含等待、待手机确认、成功、过期和取消。重启后账号显示「待验证」，验证成功才显示已验证；网络失败也不会假报已登录。

观看复用 `Alterssss/dsh-bili-whale` 的实际 CLI：先获取官方字幕，再使用 ffmpeg 下载并抽取九帧，交给默认chat聊天模型理解。聊天默认接收图片，不再单独配置视觉用途；模型或服务不支持时明确失败，不能将未理解的画面记为已理解。九帧是采样，不能代表完整逐帧观看。元信息缓存状态、字幕截断和缺失能力均保留在记录中。

安装可执行的 ffmpeg 并加入启动 Runtime 时的 PATH，重启 Runtime 后生效；项目不捆绑 ffmpeg 二进制。缺少 ffmpeg 不影响本地聊天、QQ 或可用字幕阅读。模型凭据在「设置 → 模型」配置。仅有元信息、上游退出码为零或缺少产物都不算完成观看。任务有取消、重启中断和错误状态；同 BV 已完成或部分完成的任务直接返回既有记录，不自动重复观看。失败/中断后可使用新的请求 ID 重试。

观看结果记录官方字幕、采样信息、来源 URL、时间和独立模型总结；候选兴趣需要在「我的鱼 → 记忆」确认才进入长期兴趣。活动可在「我的鱼 → 经历」时间线查看，并作为当天统一日记的来源。分享按钮仅为已理解视频创建 QQ 审批，正文包含原始标题、准确 URL 与总结；从顶栏「待审批」或运行状态菜单「审批与记录」核对内容、对象后批准。QQ 未配置不影响 B站读取。本站内评论、点赞、私信和上游自动调度均未启用。

## CLI

所有写入配置和凭据的命令从标准输入读取 JSON，避免凭据出现在命令历史或进程 argv。

```sh
npm run cli -- bilibili status --json
npm run cli -- bilibili configure --json < .local/bilibili.json
npm run cli -- bilibili login --json
npm run cli -- bilibili poll LOGIN_ID --json
npm run cli -- bilibili cancel-login LOGIN_ID --json
npm run cli -- bilibili import --json < .local/bilibili-credentials.json
npm run cli -- bilibili verify --json
npm run cli -- bilibili logout --json
npm run cli -- bilibili search --json < .local/search.json
npm run cli -- bilibili watch --json < .local/watch.json
npm run cli -- bilibili tasks --json
npm run cli -- bilibili task TASK_ID --json
npm run cli -- bilibili cancel TASK_ID --json
npm run cli -- bilibili share TASK_ID --json < .local/share.json
```

配置为 `{"enabled":true,"revision":"状态接口返回的当前版本；首次为空字符串"}`。凭据为 `{"sessdata":"本人 SESSDATA","bili_jct":"本人 bili_jct","buvid3":"可选"}`。仅实际账号验证通过后才加密替换已有凭据。

搜索输入 `{"query":"海洋生物"}`；观看输入 `{"bvid":"BV1234567890","requestId":"可选唯一请求 ID"}`；分享输入 `{"target":{"kind":"private","id":"已配置主人 QQ"}}` 或 `kind: "group"` 与已授权群号。`bilibili read` 支持 `{"bvid":"BV1234567890","kind":"video"}`，kind 也可为 comments / debrief；这些资料读取结果不记成已观看。

## 来源和数据边界

固定来源为 [whale 0.4.6 / 8b0009f](https://github.com/Alterssss/dsh-bili-whale/tree/8b0009f8ce2ebdc421afcb2e727b19ac18912ec6)。`plugins/bilibili/upstream/` 保存 MIT LICENSE、原 NOTICE、UPSTREAM.json 和 bff.patch。没有独立 package.json 或安装步骤；qrcode 1.5.4 由根依赖管理。未加载其 lib/index.js、大脑、调度器或社交写命令。comments 所需 ai-share 库仅用于上游评论缓存，无模型/分享调用。

补丁明确指定 `BFF_BILI_DATA_DIR` 工作目录和 `BFF_BILI_STATE_DIR` 持久缓存/风控目录，使用当前 Node、不探测其他应用运行时或剪映，字幕语言名验证防止生成越界文件，缓存命中标记对宿主可见。HOME/USERPROFILE 不变，也不读取既有 `.bili-ai`。凭据统一加密存于 plugin_config；仅执行时写入 `runtime/bilibili/run-*/.bili-ai/credentials.json`，目录 0700、文件 0600（Windows 使用既有 ACL），结束/取消清理，重启清理残留。缓存和请求保护位于 `data/bilibili/`，保留上游风控退避，不绕过限制。

产品进程只接受白名单 argv，不拼 shell；只读网络限 HTTPS 的 B站相关域名，拒绝重定向和写方法，响应大小、命令输出、字幕、图片与总执行时间有上限。视频下载最多 128 MiB，单次命令最多 180 秒；超出会失败。帧图片每张最多 4 MiB，模型上下文字幕最多 24000 字。退出、取消会终止本产品子进程组。此模块是随产品发布的受信任代码，不是操作系统安全沙箱。

## 验证边界

本机夹具运行原始 CLI/认证库、真实 ffmpeg 和真实 DSH，替代的仅是网络响应与测试账号，不代表真实 B站账户或模型语义质量。定向测试可复现：

```sh
BFF_TEST_FFMPEG=/absolute/path/to/ffmpeg npx vitest run apps/runtime/src/bilibili tests/integration/bilibili.test.ts
```

未指定测试 ffmpeg 时，实际视频抽样的两项测试跳过；认证检查仍运行。真实 B站扫码、真实 QQ 发送、Windows 和云模型凭据验证须单列，当前未执行。
