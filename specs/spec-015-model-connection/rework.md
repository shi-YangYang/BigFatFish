# Rework

## R1：诊断路由真实 HTTP 提前断连
首轮独立验收 `/root/accept_model_connection` FAIL，完整报告已读取处理。`createServer` 的 `connectionTimeout: 5000` 导致两个新诊断路由无法实际等待服务层的15/30秒预算；6500ms本地有效响应在5020ms被断开，`UND_ERR_SOCKET`。Tauri35秒仅修复了外层，直接函数与inject测试不能覆盖真实socket。

## 返工范围
- 在Runtime HTTP传输职责层给且仅给两个新诊断路由配置适配预算的socket超时；保留其他请求5秒、服务层15/30秒、Tauri35秒，考虑keep-alive复用时例外不泄漏。
- 新增真实HTTP定向回归：超过5秒且在预算内可成功，两路由生效，服务超时仍返回固定错误而非socket提前断开，其他路由时限保持。
- 不改前端、推理规则或其他业务；新增实施Agent完成，独立新验收Agent重验。此前通过且未受影响的UI/DSH检查不重跑。

## 验证与包
S3仅受影响传输：新真实HTTP回归、必要Node类型/lint/构建。root刷新portable Runtime并重打Mac包，更新package-evidence；旧包证据保留历史身份，最终交付用修复后包。未原生启动、无真实云账号/Windows，持续每阶段本地commit授权，PASS后提交，不push。

## 状态
`/root/rework_model_timeout` 实施完成，源码冻结，root已读取完整报告。修复后的Mac包已更新且Tauri实际退出0，最新package-evidence.json确认119个dist文件与最终构建一致；最终DMG哈希见Plan。新的独立 `/root/accept_model_timeout` 重验PASS，完整报告已读取处理，R1关闭，无进一步返工。

## Implementation Report

### Summary / 根因与职责
根因是 Runtime HTTP socket 的5秒空闲超时先于诊断服务15/30秒业务超时，外层Tauri35秒不能补救。修复在 `ai/routes.ts` 两个诊断路由的传输钩子中：认证及请求体解析完成后，`preHandler` 将socket等待设为共享业务上限30秒+1秒余量；`onSend` 在成功或错误回包前恢复服务器默认连接超时，再交回Node原有响应与keep-alive流程。没有改变全局5秒、请求体接收限制或其他业务路由；没有修改UI/推理设置。

### Files Changed / Important Decisions
- `apps/runtime/src/ai/routes.ts`：两个新路由共用传输钩子；测试注入的假socket没有setTimeout时可安全跳过，真实HTTP始终执行。
- `apps/runtime/src/ai/model-connection.ts`：导出已有30秒业务上限常量供传输层复用，默认值和截断行为不变，避免路由复制一套业务上限。
- `tests/integration/model-connection-http.test.ts`：使用真实Runtime监听、临时数据库、本机延迟模型和真实HTTP客户端；不使用inject模拟socket。

### Validation
- Risk Level: S3，仅R1传输边界。
- `rework-http.log`：新的真实HTTP测试通过，11.77秒。两个路由均在6.5秒本地模型响应后200成功；两个路由6秒服务预算均正常返回409 / MODEL_CONNECTION_TIMEOUT，未被5秒socket提前打断；成功测试后复用同连接访问普通慢路由，仍读取5000ms并在4.5–6秒范围内ECONNRESET。验证全局requestTimeout/connectionTimeout仍为5000。
- `rework-build-node.log`：`npm run build:node`通过，包含Node TypeScript编译和Runtime发行资源同步，无需重复单独typecheck。
- `rework-lint.log`：三个相关源码/测试文件ESLint通过；`git diff --check`通过。
- 首轮同批执行既有 `model-connection.test.ts` 两项通过，未因最终空值回退而机械重跑。首轮新测试仅复用断言失败：Node24客户端默认1秒buffer会丢弃服务端1秒keep-alive连接，fixture将客户端buffer明确设0后真正复用并通过；服务端限制未放宽。首轮编译发现Fastify配置类型允许undefined，恢复时使用其标准默认0解决；初始记录保留 `rework-http-first.log` / `rework-build-node-first.log`，不当作最终通过。

### Known Limitations / Remaining Questions
无新增阻塞或待确认问题。未运行未受影响UI/DSH/全量套件，未访问真实云模型、Windows或启动原生应用。Mac包由root按修复后的dist重新同步；本实施Agent不执行Git写操作、不承担独立验收。
