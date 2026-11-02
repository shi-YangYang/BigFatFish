# Task Handoff

## Role / Project Mode

Done（代码与本机验收），EXISTING：implement_p4完成，新的accept_p4已独立PASS，完整报告已读取并落盘Spec006/acceptance.md。外部平台/云/Windows缺口保持。由root按已有授权阶段本地commit后推进P5。

## Goal / Context

用户完整P0–P7 Goal持续active，当前Spec006为B站固定上游复用、账号/健康、搜索/实际观看证据、统一DSH理解/记忆/活动/日记及经QQ审批分享。不能缩减为只生成文件或空插件。

P0本地52eaaf8、P1 b1f73b3、P2 86bc867、P3 9923a67。P3两项隐私/可用性返工已由新独立验收PASS，所有报告已处理。Windows/真实云/真实QQ仍未验证，QQ文件发送/长媒体/理解留P7；真实B站账号未授权，不能借用其他应用登录态。

## Spec / Relevant Files

- AGENTS、constitution/mission/tech-stack、全部.ai/rules、产品设计目标、ARCHITECTURE。
- Spec006 spec/plan，Decision006，既有Decision002–005。
- docs/upstreams.md，docs/ai-core.md，docs/qq.md，Spec005 Plan/Acceptance/Rework。
- 当前schema4、Runtime ChatService/DSHAdapter/Configuration/SecretStore/MemoryStore/LifeService/channels，CLI/Desktop，plugins/qq，copy-runtime-assets。

## Upstream Evidence

用户主来源Alterssss/dsh-bili-whale 0.4.6、8b0009f8ce2ebdc421afcb2e727b19ac18912ec6，MIT。研究选择文件位于/tmp/bff-extra-research-20261102/dsh-bili-whale，research-source.json记录sha；不是完整运行依赖，须核对许可证、补足实际导入闭包并保存固定版本/NOTICE/补丁。必要时取固定Git源码，不依赖/tmp发布。

真实入口node tools/bili.mjs。lib/index.js会加载独立DSH/60秒调度，不装载。只读search、comments --json、subtitles --out、video、watch-video、debrief部分人读输出/部分失败；退出0不代表有字幕或画面。QrAuth.start/poll/cancel/verifyAccount可复用但不是独立服务器。默认凭据/缓存散布硬编码.bili-ai，须最小显式data-dir补丁，不能改HOME/USERPROFILE或读用户现有目录。qrcode1.5.4、ffmpeg等依赖核实后处理；不无关升级。

pond 57765435e33a8697c7f3b3b9f317c6146cd05faa、life 1c61f2a34a2d7bfffab863d71db435be35431a08仅按明确需要复用其Python MCP，并保留共同上游NOTICE，不将各自人格/记忆纳入。

## Scope / Data Flow

固定上游实际CLI/认证库→受控进程/数据目录→校验真实字幕/帧/结果→同一Runtime模型路由/DSH→有来源观察与模型结论→候选记忆/兴趣、实际活动/经历/日记；API/CLI/Desktop展示配置、登录、搜索、观看任务、历史/部分失败/取消与健康。

已观看视频可把准确URL/标题/正文经现有QQ审批分享给主人或允许群；不调用上游独立分享/评论/私信计划、不建第二套发送/审批。未配置QQ不影响观看。自主浏览由P5统一调度复用本阶段任务，不建B站独立调度器。

## Actual Interfaces / Constraints

- Runtime唯一业务入口，普通模块、单根npm/lock，不创建公共包或移动既有目录。plugins源码经构建复制到dist/plugins，CLI路径仍dist/cli/src。
- plugin_config按ID存配置/密文/revision，Configuration统一检查所有已实现加密表的master.key。凭据默认加密；上游必须明文时使用受限目录/明确生命周期，不泄露或导出。
- P3 Channels/permissions目前仍是QQ具体服务，不能假称已完成通用框架。只为实际复用抽取能力；跨插件审批/任务/撤销必须隔离，不把QQ stop的全表处理套到新平台。
- ChatService持有统一DSH，LifeService共享Engine/Configuration与事件。可作必要职责抽取接入活动，不在平台另建大脑。
- 已核实alpha.2 SDK HarnessSession.run支持string或SdkPromptContentBlock[]，SdkEncodedImageBlock(type=image,data=base64,mimeType=PNG/JPEG/WebP/GIF)；现BFF Adapter只传文本，OpenAI兼容profile已有model.vision配置。新增有界图像块通过同一Adapter，必须真实DSH+HTTP模型夹具证明实际发送图像，不能凭类型就称视觉可用。
- 进程使用argv白名单、无shell拼接，环境/输出/路径/文件尺寸/取消受控，cache/stale不当新观看。缺字幕/帧/依赖/登录与部分成功要准确。
- 保留P0生命周期/ACL，P1默认模型/异步UI/DSH清理，P2来源历史/日期完整性/表单锁定，P3生成context绑定最终发送同步guard、SEND_NOT_STARTED分类、header保存前校验/异常渠道隔离和缺master.key拒绝。

## Out of Scope

不提前实现抖音/Web/发布/通用动态插件市场，不复制未知许可证资产，不登录真实账号、借用凭据或发送真实社交消息。匿名公开读取可在任务范围内验证，遇访问限制记录状态，不绕过风控/验证码。所有测试账号/写操作只用隔离夹具，真实扫码由用户处理。

## Acceptance Criteria / Commands

S3：账号凭据、子进程、schema/任务/共享引擎与平台权限。按Spec006执行类型/Lint、相关unit/integration、实际构建/CLI/Desktop。必须真正运行固定上游程序/模块，夹具替代网络/账号而非替代上游实现；字幕/无字幕/缺文件/部分结果/超时/取消/去重/数据隔离与禁用有证据。真实DSH文本/图像请求、活动→记忆→日记和QQ审批分享有证据。现有直接受影响路径按风险回归，不机械重跑所有已过P0–P3或原生矩阵。

未执行Windows、真实B站/QQ/云Key明确单列，不能用协议夹具等同真实平台观看或语义理解质量。实际类型/测试文件数量、末次代码与构建先后如实报告。

## Implementation Evidence

完整实施报告已由root读入Spec006/plan.md，须读取。实际whale CLI/QrAuth与20文件依赖闭包、许可/NOTICE/patch；schema5任务/请求ID；Configuration加密账号与临时目录清理；只读进程/网络限制；统一DSH JPEG输入、活动/候选兴趣/日记；QQ既有审批分享；真实CLI和macOS桌面均已实现。

累计10文件24不同测试：首轮8文件22项含真实whale/ffmpeg/DSH图像与QQ分享/隐私回归/生命周期，后补缺依赖隔离1项、实际SIGKILL临时凭据自动清理和重启interrupted1项。type/lint/build及末次业务修改后的Node构建/macOS release已过。末次仅加崩溃测试，其后相关测试/type/lint/diff通过。无必要不要复跑所有已过检查。原生UI实际观察搜索/选择BV、观看进度、字幕+九帧+来源+总结。网络与账号为夹具；真实B站/QQ/云模型/Windows未验证。

可复现夹具在仓库，临时测试Runtime/桌面/数据已清理；/tmp/bff-whale-p4/bin/ffmpeg仅供需要时BFF_TEST_FFMPEG指定，不是产品依赖。固定原始源码补丁dry-run已过。

## Expected Output

独立Acceptance Report只能PASS或FAIL，逐项检查Spec，报告实际读过的代码/diff/证据与必要检查、问题精确路径/行号/复现和风险边界。只在发现具体疑点时运行最相关检查，不机械复跑实施者验证。特别核实真实上游/许可证完整、路径与凭据隔离、异常/取消/禁用、结果和模型证据准确、任务幂等/活动来源、QQ审批及既有隐私门没有回归。不要把缺少真实账号等已声明外部门槛当作代码虚报；若实现缺需求则明确FAIL。

禁止修改任何业务文件或Git；报告回root，由root写acceptance.md和治理状态。未来Spec007–009只是Draft，本次不验收不纳入提交。

## Git / Pending External Input

当前dev，HEAD9923a67。用户明确每阶段验收后本地commit，由root执行，无需重复确认；无push/PR/合并/发布/历史改写授权。实施者不得git add/restore/reset、动index、切分支、commit或push。保护root治理改动，Spec007–009仅未来Draft，不纳入P4。

已有一次异步问题询问可用Windows电脑/虚拟机，尚未收到答复；这不阻塞P4，不把默认选项或沉默当回答。此前仓库URL和每阶段commit问题已答复，不重复询问。真实云/平台凭据和登录尚未提供，不读取其他应用秘密。
