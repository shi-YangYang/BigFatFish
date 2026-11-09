# Acceptance 003: P1

## Result

FAIL（完整阶段尚有外部证据缺口）。初轮accept_p1发现的两项桌面缺陷已由rework_p1修复，新独立accept_p1_rework对代码返工和追加Docker配置审阅均给出PASS。P1本机/Linux可执行路径已通过，无已知代码返工；Windows与真实云模型仍未验证。以下保留初轮证据及复验记录。

## Spec Coverage

已审阅真实官方DSH Adapter、安全profile/bridge、认证HTTP/WS、密钥加密、人格版本、迁移、会话队列/幂等、取消/清理、CLI/React/Tauri数据边界。未发现以直连模型冒充DSH或入口绕过Runtime直DB。

## Validation

- Risk Level: S3（P1整体）；桌面返工按实际局部改动范围验证。
- Evidence Reviewed / Checks Performed: 采用Plan记录的类型/Lint/测试/构建/原生UI证据，不重复整套。
- 仅对具体疑点追加一次真实SDK检查：DeepSeek Messages夹具连续两回合，第二轮真正resumeSession；实际请求人格BeforeName→AfterName，max_tokens=512，持久request/context.contextWindow=8192，检查通过并清理临时数据。
- 验收者未修改文件或执行Git写操作。

## Issues

1. P2优先级：Chat.tsx:9未手选模型时传models[0].id，绕过Runtime的model_routes.chat；第二个模型设为默认后Desktop新会话仍选按ID排序首项，CLI与Desktop不一致。应由Runtime在未明确选择时解析默认路由，并使选项文案一致。
2. P2优先级：Chat.tsx:10发送异步请求结束后无条件setText('')/重置pending，并用旧selected加载消息；会话按钮与输入仍可操作。A请求晚到可能清除新草稿、将A消息写入B视图。应按会话/请求身份限定结果，只清理未被用户修改的本次提交草稿。此项是源码明确竞态，未冒称原生UI复现。

## Regression Risks

真实云模型、Windows原生/ACL、Undici代理与全进程网络行为尚未验证。Linux Docker DSH由协调者另行补证，不能用P0结果替代。

## Required Rework

初轮要求新的实施Agent修复两项并由新的独立Agent复验；现已完成，无新增代码返工。无需因此重跑完整DSH、原生构建或依赖审计。

## Rework 1 Acceptance

PASS。2026-11-03，accept_p1_rework独立审阅Chat.tsx、Runtime默认路由、原验收问题及8项受控DOM夹具/结果，采用已执行的严格组件类型检查，未重复验证。

默认body为空时交由Runtime解析chat路由，显式模型仍传modelId；会话选择对象身份覆盖A→B→A；单次在途轮询拒绝旧选择，POST成功只清理当前选择且未编辑的提交草稿；额外GET已移除，失败重试保留requestId。修复在前端状态归属层，没有复制业务规则或限制正常输入/切换。

Risk Level: S1。结果文件中的UNAVAILABLE是失败重试用例预期错误。真实云模型/Windows与Linux正式镜像结果独立记录，代码PASS不替代外部证据。验收者未改文件或Git。

## Linux 增量证据

原Dockerfile两轮npm下载因ECONNRESET失败；registry ping成功。隔离Linux容器使用相同lock、生产npm ci与maxsockets=4后成功安装654包且audit0。使用该Linux原生依赖镜像及只读Node构建产物运行真实CLI/DSH smoke，Linux arm64 Node24.22.2 PASS：启动、模型密钥查询脱敏、真实流、重启后resume包含前轮历史、四条消息持久化，实际fixture HTTP请求2次。测试数据/Runtime自动清理。

初次smoke漏了CLI的routes set，按真实配置流程补齐后通过，没有修改生产代码。该隔离镜像不是正式Dockerfile产物。

随后fix_p1_docker_install仅给Dockerfile两处npm ci增加--maxsockets=4。先target build全依赖771包/212.2s与Node编译通过，再正式镜像生产654包/156.4s通过。正式镜像bigfatfish:p1-check（manifest sha256:82ad467edfc8f8c9a661505949d945393bff23bb293d9f0c71218185849dfae8）内运行同一smoke PASS，未挂载宿主dist/node_modules；真实Linux arm64/Node24.22.2/DSH完成两次fixture模型请求、流、重启恢复和历史。临时容器与数据已清理；正式镜像保留。

独立accept_p1_rework追加只读审阅Dockerfile两行并给PASS：仍使用锁文件安装、生产依赖、原编译/复制及非root结构；限制并发直接对应下载失败，无新增运行风险。构建成功支持连接压力相关推断，不证明它是唯一网络根因或错误永久消除。其报告时smoke尚在运行，以上PASS来自随后实施者实际结果。协调者清理诊断容器/镜像/cache卷，并对末次修改的Chat单文件Lint及diff格式检查通过；未重复完整矩阵。
