# Plan

## 实施顺序
单实施Agent处理高度耦合的共享ModelConfig/Configuration、Runtime连接服务/路由、DSH传参、Models表单和原生请求超时。root先完成官方规范及固定依赖调研，更新Ready规格；不得仅添UI字段。普通源码模块封装，保持原目录。

## 官方依据（2026-11-04已实际联网读取）
- [OpenAI模型列表](https://developers.openai.com/api/reference/resources/models/methods/list)：GET /models返回data与id等基础元数据，不保证推理能力信息。
- [OpenAI Chat Completions](https://developers.openai.com/api/reference/resources/chat/subresources/completions/methods/create)：reasoning_effort为模型相关枚举，不能认为任一模型均支持所有值。
- [DeepSeek模型列表](https://api-docs.deepseek.com/api/list-models/)：GET /models，可附模型能力元数据。
- [DeepSeek Anthropic兼容](https://api-docs.deepseek.com/guides/anthropic_api/)及[思考模式](https://api-docs.deepseek.com/guides/thinking_mode/)：当前Messages模式的thinking与output_config.effort；支持关闭及low/high/max。保持原有Messages接入。

## 验证计划
S3，涉及出站密钥、受保护API、持久化配置与真实引擎参数，范围仅模型子系统及受影响入口。运行相关TS/lint、Node/Desktop/Web构建；配置兼容及新的连接服务测试覆盖URL/旧密钥隔离/错误/响应限制；使用真实固定DSH与本地协议fixture观测OpenAI/DeepSeek推理wire与resume，保留既有AI回归。前端定向检查列表选择/手填/状态/错误/不保存草稿/陈旧返回；代表视图1100与380。不跑无关平台/维护完整套件，不索要账号；新增字段必要的备份兼容检查可定向验证。

通过的检查不重复，后续只因相关代码变化或明确失败重跑。独立新验收不机械重跑实施检查。root最终同步必要Runtime与双前端产物、Mac本地包及文档，已授权commit，不push。

## Implementation Report
实施/root/implement_model_connection已完成，完整实施报告已读取处理。只读固定依赖调研/root/audit_model_connection已完成，完整报告已读取处理；调研未改文件或执行测试。首轮新独立验收/root/accept_model_connection确认R1超时问题并FAIL，完整报告已读取；新实施/root/rework_model_timeout已完成传输层返工，完整报告已读取，细节见rework.md。新独立/root/accept_model_timeout重验PASS，完整报告已读取处理，无剩余阻塞。root按持续授权本地commit，确切hash以Git记录为准；未push或操作PR/合并，远端未刷新。已满足停止条件，不追加验证。

### Summary / Files Changed
Runtime新增model-options与model-connection普通模块，Configuration/type/DSH/routes接入可选reasoningEffort、发现和真实短请求诊断；Models/useModelConnection提供beUI操作与绑定草稿的异步状态。api.ts集中中文错误，Tauri只对新两路由设置35秒超时。相关测试与fixture声明补充真实wire和前端交互；无依赖/schema变更。

### Implementation Decisions
测试最高256输出token、30秒；发现15秒；响应1MiB/列表最多2000条，不自动重试。HTTP错误分类，不回传原文/密钥；测试与发现均无落库、会话或路由副作用。显式OpenAI推理采用standard reasoning_effort，并设置compat.thinkingFormat=openai/supportsReasoningEffort，避免URL特例默默丢弃用户选择；默认态保留原有协议兼容行为。token参数与DSH使用共享固定版本映射。旧配置多尾斜杠身份按相同URL规则正规化，避免仅调整推理误报占用。只有推理字段从使用中配置比较中排除，原模型身份及其他限制保持。

### Validation
- Risk Level: S3，限模型子系统/受影响前端。
- build/model-connection/typecheck.log、lint.log、regression-lint.log：相关Node/前端类型及lint通过。
- build-node.log、build-desktop.log、build-web.log：三个构建通过；Desktop index-C2-kzQL2.js、Web index-D3GHIQkJ.js、CSS index-BpPE81fh.css。
- model-tests.log：模型服务/配置/真实DSH共4项通过，5.54秒；两个协议在同会话高→低→默认→关闭→最高实际wire匹配，历史恢复保持。
- ai-regression.log：最终连接服务与既有真实AI回归5项通过，12.96秒。
- ui-test.log：模型UI定向1项通过，2.42秒；列表选择/手填/当前草稿诊断/保存推理/局部错误/陈旧结果与窄屏。
- desktop-regression.log：既有UI回归1项通过，12.58秒。原严格40px等值实际得到39.99998474121094，仅改为0.01px容差；未弱化业务断言。旧测试的历史截图输出路径仍保留，本轮交付截图以下列路径为准。
- 初始fixture类型未含reasoning字段、UI名称空白定位、control-character正则lint已修正；最终对应检查通过。summary.json汇总，未将失败历史当成功。
- 完整App生产组件+隔离IPC：models/effort在1100和380共四张稳定图，等待450ms动画结束；实施者目视，root另目视effort1100/models380。图中123ms是fixture数据，不代表真实云服务结果。预览http://127.0.0.1:53425/、owned session70573。

### Known Limitations
真实云账号、原生app启动、Windows和无关平台/维护全套未运行。测试成功只证明当前短文本请求；具体模型支持的参数以服务为准。既有use-client和chunk size构建提示保留，不为消除提示扩展拆包。root已完成最终Mac打包及新独立验收闭环。

### 本地包
root确认根manifest/lock及既有portable一致，无依赖变化，复用现有Node/生产依赖并替换完整dist。首轮包含R1，仅保留package-evidence-before-rework.json历史证据。返工后再次同步Runtime并打包，Tauri实际退出0，rework-tauri-build.log记录两个bundle成功。最新package-evidence.json核对119个Runtime/CLI/Web/资源文件全部与当前dist逐字节一致，Desktop资产、MIT、metadata匹配；最终DMG SHA-256 ed46374dc692b70658612b8729c68d106340acf846686dbbdd1e731356038b9c。Mac app/DMG沿用apps/desktop/src-tauri/target/release/bundle/{macos,dmg}。未原生启动，local ad-hoc未公证；docs/design/desktop-webui-settings.png已更新为本轮隔离数据代表图。

### 固定依赖实施依据
DSH0.2.2-alpha.2/pi-ai1.5.0实际支持max。OpenAI自定义模型默认reasoning:false，仅在显式设置时声明reasoningEfforts映射off→none、其他等级同名，并设置providers.bff.reasoning（none→off）；默认态两者均省略以保持现行为。DeepSeek使用llm-deepseek.config.reasoningEffort：off/low/high/max；默认省略，保持既有thinking.enabled与high。均不传SDK reasoningEffort：sdk-jsonrpc-server保留同路由历史显式值，而adapterDefaults.reasoningEffort会被dsh-agent持久化省略，可让每次profile重新生效。

相关实际来源：node_modules/@deepseek-ai/dsh-llm-pi-ai/lib/index.js（298/587/1802/1980）、dsh-sdk-jsonrpc-server/lib/index.js:475、dsh-llm/lib/index.js:2241、dsh-agent/lib/index.js:129。测试须在同会话实际高→低→默认，另覆盖none/max，不能仅检查生成profile的对象。

OpenAI请求根后追加/chat/completions，Bearer；输出上限默认max_completion_tokens，pi-ai的URL兼容规则部分服务采用max_tokens（@earendil-works/pi-ai/dist/api/openai-completions.js:578/1230）。轻诊断和DSH须共享明确的兼容选择，必要时显式设置DSH model.compat.maxTokensField，不能双方不同。DeepSeek根去尾斜线、未以/v1结束时追加/v1，再/messages；x-api-key与anthropic-version:2023-06-01，max_tokens。发现为配置同origin根/models，与固定DeepSeek插件相同，不保留/anthropic；OpenAI发现为baseURL/models。无需新增bridge或依赖升级。

诊断使用POST /v1/models/discover与POST /v1/models/test，采用小的模型连接协议服务，不写数据库、不创建DSH会话。响应错误不返回原文，服务列表归一化有限id/name；模型名仍手填可用。测试短提示要求简单回答，输出/响应体/耗时有界，不自动重试。实际生成仍经原DSH。仅为上述两个路由延长Tauri超时；实际限额见上方实施报告。
