# Plan：大肥鱼人设

## 实施范围与顺序
1. ai 内增加无运行依赖的预设模块，供 Runtime 默认与前端共用。维持 Persona 存储/API 字段，不做数据自动迁移。
2. 在 DSH 边界集中组装人格提示；通过 EngineInput 显式区分聊天与后台任务，由 ChatService 的聊天入口提供可信受众，其他消费者按任务处理。只改必要的调用点，不扩展权限。
3. Personality 用现有 beUI Select/Input/Button/Disclosure 整理主表单与详细编辑。预设应用为显式草稿操作，名字/头像/边界/作息/自主规则/version 保留；保存保护和自定义状态正确。
4. docs/ai-core.md 同步简短选择方式与已有配置不覆盖的规则。

## 验证计划
- S2：纯预设/提示组合的定向检查，配置兼容、身份/任务边界、真实 DSH 本地模型 fixture 验证更新人设后续聊。优先扩展已有相关测试，不跑完整套件。
- Node 构建检查 Runtime/CLI 的编译集成；前端只对 apps 做类型检查（全 tsconfig 已知两个未改测试文件三处错误，不扩范围修复）。
- 协调 Agent 使用隔离前端 fixture 检查桌面/窄屏的选择、编辑、保存与历史，不读取密钥、不对真实 QQ 发消息、不调用云模型。
- 独立验收以 Spec、diff 和已生成证据为主，不重复通过检查。

## 风险与兼容
默认仅影响新用户。旧用户选择预设保存后生效；不在启动时替换自定义设定。提示词能确保内容被传入，不等于证明具体云模型的风格质量。结构化任务需排除闲聊示例，避免格式污染；身份由已有运行时来源确定，不能由角色卡授予权限。

## 实施报告

### Summary
已完成三套原创预设、默认人格、统一提示与简洁设置页。根因是旧默认仅有通用标签和 JSON 注入；在 Runtime ai 层将具体反应/示例与受众、任务边界组合，所有聊天入口通过现有 ChatService 生效，避免各平台各写一份人格。预设是纯源码数据，Desktop 共用，不增加包、依赖、数据库字段或 API。

### Files Changed
- ai/persona-presets.ts：三预设、默认、应用与匹配；只替换五个人设字段。
- ai/persona-prompt.ts、engine.ts、dsh.ts、chat.ts：可信 interaction 指明主人/其他聊天，后台默认 task；任务不携带 role/traits/style 中的闲聊示例，保留喜好、用户边界/自主偏好等。
- Personality.tsx、style.css：beUI 名字/性格与一句示例；详细字段、历史折叠；保存 ref 锁与禁用控件避免重复/旧响应覆盖；修改预设字段后按实际内容显示自定义。
- ai/persona.test.ts、tests/integration/persona.test.ts：预设保留、任务/身份提示、配置兼容版本冲突、真实 DSH 续聊和记忆提取。
- docs/ai-core.md：简短入口与兼容说明。

### Important Decisions
不自动覆盖任何既有设定；只对新数据库初始化提供新默认。当前默认嘴欠黏人，其余可选。后台任务不沿用闲聊台词，避免格式污染；不因人设改变工具或平台授权。没有套用上游 DSH Web preset。

### Validation
- Risk Level: S2。
- npm run build:node：PASS，Runtime/CLI 编译及资源复制。测试直接使用源码 ChatService，因此该构建是服务端编译检查，而非其 dist 前置。
- npx tsc -p build/fish-persona/tsconfig.apps.json：PASS，限定 apps 源码，不包含已知无关测试文件错误；配置位于忽略的 build。
- npx vitest run apps/runtime/src/ai/persona.test.ts tests/integration/persona.test.ts：PASS，7/7；真实 DSH 对本地 fixture 完成首次主人聊天、修改人格后原会话续聊（历史仍在、最新 system 已更新）、好友冒认主人仍为 others、记忆整理仍输出有效 JSON。
- 实施 diff 已审阅；未运行完整 test/lint/build、未改用户数据、未真实云调用/QQ发送。
- root CUA：隔离 fixture 53433，初始自定义 version3 不被覆盖；选择嘴欠后名字/行为边界/作息/自主偏好保留，保存为version4，版本3仍可查看；修改喜欢后显示自定义；模拟409保留名字草稿且没有成功提示；三种选项及示例均可见。1280桌面和380×820窄屏目视正常，窄屏横向溢出0、详细字段均348px，外层主控件40px。截图build/fish-persona/01-desktop.png、02-narrow.png、03-narrow-details.png。fixture进程97444、tab9已关闭，viewport已恢复。全部为假数据，未触碰真实Runtime。

### Known Limitations
本地模型 fixture 验证请求与生命周期，不证明云模型的实际语言风格。已有用户需在设定页选用并保存；运行中的旧 Runtime 需重启才加载提示组装源码。未重新打包或做 Windows 实机验证。

### Remaining Questions
默认偏好询问待用户答复，可随答复调整；不阻塞可选风格实现。独立验收由新 Agent 执行。

### Copy Follow-up
协调 Agent 完成 UI 主流程检查后，要求删除女儿预设 role 中突兀的性关系解释，保留「纯亲情，不使用恋爱或暧昧设定」。本次仅 S0 文案，审阅差异，不重跑已通过的检查；实施已冻结，等待独立验收。
