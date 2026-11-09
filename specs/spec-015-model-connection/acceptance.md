# Acceptance

## Result
PASS

新独立验收：`/root/accept_model_timeout`，2026-11-04。已审阅首轮 FAIL、独立返工报告、最终相关源码与证据；R1 已在 Runtime HTTP 传输职责层修复。未发现本次规格范围内的剩余阻塞。root 后续按持续授权完成本地 commit，本验收未执行 Git 写操作。

## Spec Coverage
- Desktop/Web 共用模型页可对当前草稿获取模型列表、选择或手填模型、发起真实短生成测试并展示耗时；不自动保存。界面使用既有 beUI，保留保存、默认用途、密钥不回显及局部状态；hook 的草稿戳与请求序号隔离陈旧结果。
- 可选推理字段经配置校验和持久化接入真实 DSH；OpenAI 标准 `reasoning_effort`、DeepSeek Messages 的 `thinking/output_config`、默认/关闭及恢复会话重新解析均有实现与真实 wire 测试依据。已用模型仅允许额外修改推理字段，身份与其他原有限制保持。
- 新接口复用 Runtime 认证，同目标才复用已存密钥；URL、重定向、响应大小/数量、服务预算与错误脱敏边界成立，不写配置、会话或记忆。R1 修复使服务层 15/30 秒预算能够在真实 HTTP 中生效。
- 两诊断路由在 `preHandler`、完整请求体与认证之后设置 31 秒 socket 等待，在 `onSend` 成功或错误回包前恢复初始连接时限。共享业务上限常量，无全局放宽；原 `requestTimeout/connectionTimeout` 保持 5000ms，Tauri 外层 35 秒，Web 代理已有 195 秒预算。
- 相关源码、类型、lint、Node/Desktop/Web 构建、模型/AI/UI定向回归与真实 HTTP 返工回归已有通过证据。Mac 包已刷新为修复后 Runtime；代表图符合 beUI 一致性和窄屏可用性要求。

## Validation
- Risk Level: S3，限模型诊断、推理配置、凭据与受影响传输链路。
- Evidence Reviewed / Checks Performed:
  - 读取 AGENTS、使命/技术栈、全部有效 `.ai/rules`、Spec/Plan、首轮 Acceptance、Rework、Decision011 与当前 handoff；核对 dev 工作区和任务改动范围。
  - 审阅 `routes.ts`、`model-connection.ts`、`model-options.ts`、配置/DSH/type 改动、Models/hook、Tauri 局部超时及相关文档；沿直接链路核对 Runtime 认证/错误处理及 Web 代理等待预算。
  - 审阅 `model-connection-http.test.ts` 的真实监听 Runtime、loopback 上游、真实 Node HTTP 请求和断言。两个路由 6500ms 成功，两个路由 6000ms 服务预算返回 409 / `MODEL_CONNECTION_TIMEOUT`，成功后同 socket 复用普通慢路由仍记录 5000ms 并约 5 秒 `ECONNRESET`；测试明确断言 `reusedSocket=true`，没有用 inject 替代传输证据。
  - `rework-http.log`：1 项通过，11.77 秒；`rework-build-node.log`：Node TypeScript 编译与 Runtime 资源生成通过；`rework-lint.log` 与实施报告记录三个相关文件 lint 通过。首轮客户端 keep-alive buffer 与可选配置类型问题已修正，初始日志不当作最终成功。
  - 审阅原模型安全/配置和真实 DSH 恢复测试代码及 `model-tests.log`（4 项）、`ai-regression.log`（5 项）、`ui-test.log`（1 项）、`desktop-regression.log`（1 项）的最终通过结果，结合首轮独立全功能审查；本轮没有重跑未受影响检查。
  - 实际目视 `build/model-connection/effort-1100.png` 与 `models-380.png`：下拉、表单与动作对齐，380px 窄屏操作可读。图中 123ms 为隔离 IPC fixture，不是云模型实测。
  - 审阅 `rework-tauri-build.log` 两个 bundle 完成及最新 `package-evidence.json`：Tauri exit0（root 收取）、119 个 Runtime/CLI/Web/资源文件与最终 dist 一致，Desktop 资产、MIT 与 manifest/lock 匹配。最终 DMG SHA-256：`ed46374dc692b70658612b8729c68d106340acf846686dbbdd1e731356038b9c`。未重复打包或启动原生应用。
  - 本轮独立验收只读审查现有证据并更新此报告；未新增执行测试/build/lint，不把审阅冒充本人重跑。

## Issues
无剩余阻塞；R1 已关闭。

## Regression Risks
- 修改限两个新诊断路由的 handler 等待，认证前与请求体接收限制未放宽；成功/错误回包统一恢复，真实 keep-alive 回归防止例外泄漏到普通请求。
- 真实云账号、Windows、原生应用交互和正式签名公证未验证；当前包为本地 ad-hoc。参数支持取决于具体模型，列表发现与一次短文本测试不等于所有生成能力验证。保持已有边界，不扩展无关平台或维护套件。

## Required Rework
无。root 完成规格状态、Git 提交与交付记录后停止，不追加无明确风险的检查。

## 首轮 FAIL 历史
`/root/accept_model_connection` 首轮发现唯一阻塞 R1 / P1：`server.ts` 的 `connectionTimeout: 5000` 早于诊断服务预算，`routes.ts` 新路由未延长 Runtime socket。真实 HTTP 请求允许 10000ms、上游 6500ms 返回有效文本，却在 5020ms 得到 `fetch failed / UND_ERR_SOCKET`；Tauri 35 秒不能补救。首轮未修改业务代码，其余安全、推理、UI及文档审查未发现阻塞。

root 读取完整 FAIL 后委派新的 `/root/rework_model_timeout` 返工，再由本新 Agent 独立验收。返工将修复放在两个诊断路由的传输钩子，并新增真实 HTTP 慢响应/服务超时/连接复用回归；最终包已同步。首轮包证据保留为 `package-evidence-before-rework.json`，不能作为最终交付包依据。详细根因和实施历史见 `rework.md`。
