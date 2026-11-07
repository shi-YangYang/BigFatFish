# QQ 内置化实施计划

## 方案与顺序
1. 将自有 QQ 协议客户端移入 channels 的普通 TypeScript 模块（建议 onebot/），保持现有守卫、回执、媒体与取消语义；删除动态插件加载器和插件元数据依赖。
2. Runtime 直接拥有 QQ 生命周期，Plugins 排除并保留 qq 标识。幂等兼容旧 sdk:qq 状态，尊重旧停用/卸载意图但不持续覆盖新设置。历史数据及用户目录保留；不使用旧目录中可执行代码。
3. 同步构建复制/目录生成、发行资源和测试调用入口。清理旧生成包而非用户数据。更新当前指南与架构说明，保留第三方扩展、B站与抖音。
4. 在隔离数据上验证新旧状态、API 边界、实际协议和构建产物；记录测试命令及结果。由新的独立 Agent 验收。

## 重点风险及证据
- 生命周期或保留标识漏改会重新加载旧代码：用故意不可执行/有哨兵的旧安装目录和 QQ 插件安装 API 验证；既有记录不能继续影响客户端。
- 旧停用状态不能变成自动上线，也不能永久压制用户新启用：覆盖一次兼容、再启用、再次启动、恢复备份默认暂停。
- 移动客户端必须保持动作协议与撤权边界：复用最相关 QQ 协议/媒体/自主工具检查，不机械重跑全部历史套件。
- 构建布局改变：执行 Node 构建与构建后 QQ smoke，预置旧生成包验证增量清理。其它平台资源仍在。
- 共用 Plugins 改动：验证普通插件安装和 channel.send 撤权，不扩大到完整 UI/模型/发行全量测试。扩展列表无 QQ 以 API 证据为主；若 UI 有实际逻辑改动再定向检查。

## 实施报告
2026-11-07，实施完成并冻结，待独立验收。风险 S3；仅使用临时数据和本地模型/OneBot 夹具，未启动用户实例、收费调用或真实外发，未暂存/提交。

### 修改与决定
- `channels/onebot/transport.ts` 和 `client.ts` 从项目自有 `plugins/qq/index.mjs` 迁入 TypeScript，分别管理 WebSocket/健康/重连/请求与有界平台动作。发送前账号检查、最后 I/O 守卫、未知回执、媒体字节及取消语义保留。没有下载或改造 NapCat 代码。
- `channels/service.ts` 静态创建 `QQClient`；删除动态 `channels/plugin.ts`、`reload/suspend` 插件生命周期和 `assertPlugin`。QQ 工具类型/参数改为 `QQConnection/client`，状态 API 以 `builtin:true` 替代插件 manifest。前端没有使用原 manifest。
- `channels/builtin.ts` 事务内一次性转移旧 `sdk:qq` 的停用、卸载、撤权或损坏状态为连接停用，保持原密文与其余配置；用 settings 标记防止后续启动覆盖用户新启用。没有 schema 升级或表更名，不删除旧行/目录，不执行旧磁盘代码。
- Runtime 直接管理 QQ，只为 B站/抖音挂接平台插件回调和安装目录。`Plugins` 在 JSON 解析前忽略 `sdk:qq`，安装/检查/管理边界拒绝保留 ID（`QQ_BUILTIN`），不改变通用归档的旧 manifest 校验；普通扩展和 `channel.send` 仍沿原授权路径。前端为旧插件操作增加就近可读错误文案。
- 构建复制和插件目录脚本不再生成 QQ 包，并清理旧 `dist/plugins/qq`、`dist/runtime/plugin-catalog/qq.bff-plugin`、旧动态 loader 生成文件；只动构建输出。B站/抖音资源保留。
- 当前 QQ、开发、安装、架构、上游指南及 mission/tech-stack 同步内置化；源码导航仍从 channels 进入。旧历史规格未改。测试改为直接客户端或连接 API；扩展 UI 旧夹具改用仍为插件的 B站，没有改其测试目标。

### 实际检查
1. `npm run build:node` 最终通过（session 26891）。此前 TS 转换有三处可空结果访问，已改为可选访问；没有改协议行为。该构建同时确认 Runtime/CLI 编译与资源准备。
2. `npx vitest run tests/integration/qq-builtin.test.ts`：**6 passed，1.76s**（session 38188）。实际 Runtime/API/OneBot：没有旧插件、旧启用、停用、卸载、撤权、损坏 JSON 六种状态；URL 期望按已有正规化规则修正后通过。检查旧目录执行哨兵始终不存在、保留文件与密文、QQ 不列于扩展、旧安装/管理请求拒绝、连接可主动开启并实际发送、重启不再次强制停用。旧启用状态还通过逻辑归档恢复暂停验证。
3. 首批 `npx vitest run tests/integration/qq-builtin.test.ts tests/integration/qq-self-tools.test.ts tests/integration/p7-media.test.ts apps/runtime/src/channels/protocol.test.ts`（session 43684）中 **QQ 自主工具 4 项及 protocol 3 项通过**，包括真实本地 DSH/HTTP/OneBot、主人与群边界、公开自主素材隔离、固定发布范围、未知写不重试、备份暂停，以及生产30秒定时器无人发消息触发。该批有下述夹具断言失败，不宣称整批通过；通过的7项未重跑。
4. `npx vitest run tests/integration/plugins.test.ts -t 'QQ plugin direct send'`：**1 passed / 1 skipped，571ms**（session 51853）。独立扩展实际安装、channel.send 新授权、发送以及最终异步检查期间撤权均有效。随后 `node scripts/smoke-qq.mjs` **PASS**，构建后的 CLI/Runtime 内置 QQ 完成配置、健康、直接发送、停止，无独立 QQ 插件包。
5. 因旧媒体用例提前退出，补直接受影响的内置媒体链路：`npx vitest run tests/integration/qq-builtin.test.ts tests/integration/qq.test.ts -t 'reads media bytes|protocol health'`：**2 passed / 7 skipped，6.77s**（session 35436）。实际客户端获取图片/语音字节、WAV 参数、拒绝路径、异步读期间撤权；现有协议健康测试覆盖登录、认证、账号不符、错误/未知回执、断线重连不重发、图片发送和发送前停用。
6. 构建后检查确认内置 client.js 存在、三个旧 QQ 产物不存在，B站/抖音包仍在。另在旧输出位置放置哨兵文件，再只运行资源准备脚本，**PASS** 清理全部退休产物；无需重复已通过的 TypeScript 编译。
7. `git diff --check` 通过。前端只增加一个错误文案，扩展列表由已经验证的 API 结果决定；没有运行 UI 截图、全量前端类型、全仓测试、安装包或原生/Windows检查。

### 已有失败与边界
- 原 `p7-media.test.ts` 仍期望入站图片自动识别并追加失败文本；当前流程是模型通过图片工具读取，所以实际原话为 `[引用消息 99，未读取原文][图片]`。本轮只改其插件安装/停用入口，未修改图片业务或旧断言。用 `git archive 6fd50d2` 创建隔离临时源码，生成原版平台包后执行该单用例，在第35行**同样失败**（854ms，session 64805）；本轮第32行同样失败（965ms）。基线副本已清理，没有扩修无关旧媒体测试。
- 新兼容用例首次仅因 URL 已正规化增加末尾 `/` 断言不符，修正夹具保存输入后6项通过；并非生产 URL 行为回归。
- 实际 QQ 账号扫码/头像/资料/说说没有本轮实测；协议证据不代表平台风控或真实外发成功。用户下次启动新版时才应用内置化兼容，不需要再更新 QQ 插件。
- 本轮未启动用户 Runtime/desktop、修改真实库或插件目录、调用收费模型、commit/push。新实现无已知直接阻塞，最终结论由独立验收给出。

### 冻结前协调审阅：停止时立即撤销 QQ
协调指出移除 `assertPlugin` 后，原 shutdown 顺序会先等待扩展及其它平台关闭，期间 QQ 不再借助 `plugins.closing` 阻止新写，属于本次生命周期改动的直接风险。已在 Runtime 停止开始、初始化完成后立即调用 `channels.close()`：其同步部分设置 closing、取消自主/媒体/聊天任务并停止客户端；Promise 立即附上错误处理，在原先位置等待排空，保留统一错误汇总，避免未处理拒绝。不等待其它扩展才能撤销 QQ。

新增定向用例 `npx vitest run tests/integration/qq-builtin.test.ts -t 'revokes built-in QQ immediately'`：**1 passed / 7 skipped，473ms**，2026-11-07 22:49。真实隔离 Runtime/OneBot 中挂住其它扩展的 close，同时挂住正在发送前的登录核验；停止开始后 QQ 已 stopped、新发送被撤权、新启动报 RUNTIME_STOPPING，释放挂起回执仍无 send 请求，最后释放扩展正常排空。未重复其它已通过检查或构建；Node 构建与构建后 smoke 是此局部生命周期修复前的证据。`git diff --check` 通过，实现再次冻结。

## 最终交付
2026-11-07，新的独立 Agent `accept_builtin_qq` 完成[验收](acceptance.md)，结果 PASS。协调已完整读取实施与验收报告，无待返工；旧媒体断言的基线失败与真实账号/Windows边界保持如实记录。Spec 标记 Done，停止追加验证。前序功能已提交 6fd50d2，本轮内置化不提交、不推送；下次运行 desktop:dev 加载新版及一次兼容，无须安装或更新 QQ 插件。
