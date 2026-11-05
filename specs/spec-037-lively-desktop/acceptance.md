# Acceptance — B Desktop 易用性

## Result
FAIL

本报告由新的独立验收 Agent 编写，只审查 B。A 维持 `acceptance-a.md` 的独立 PASS；整体 Spec037 尚未完成。原生审计发现的共享选中状态遗漏及两个直接 UI 回归需返工。

## Spec Coverage
- B1：TabsContent 同步可见；TabsTrigger 底色/文字由 active 直接渲染，保留 ARIA、方向键、滚动和隐藏面板；产品 Badge 关闭内容动画，侧栏去除状态色过渡。修复位于共享组件职责层，未用页面延时或强制重载。但 Checkbox 存在相同已实证根因，见 R1；模型焦点线见 R2。
- B2：QQ/B站/抖音合并平台/账号/状态头部，QQ 在线布局收紧且次要连接入口按需展开，未修改连接、扫码、账号/授权和记录请求逻辑。既有 ContentScroll 保持。
- B3：默认模型列表与用途、新建/编辑按需打开、收起继续草稿、保存后回列表符合范围；发现/测试/推理/密钥留空和路由保存链路保持。编辑按钮内侧焦点与原零左内边距冲突需 R2。
- B4：记忆列表优先，编辑/整理按需、草稿保留、选中后批量、需要时才分页；原版本、冲突及分享确认路径未改。
- B5：概览去除完整人格与重复平台状态；日记日期/生成同行、时区按需、经历紧凑；活动计划创建按需。隐藏空态暂停按钮的条件过窄，丢失合法恢复入口，见 R3。
- B6：readOnly 仅从已有非空 principal 推导并序列化为布尔，不暴露主体字符串，不改数据库或服务端发信守卫。UI 优先可写会话、外部对方标签与只读提示/本地入口、草稿及朗读保留。旧 Runtime 缺字段保持兼容；新行为需要正常重启。实际外部会话创建者目前为 QQ，标签与现有来源一致。
- B7：保留 beUI、浅海蓝与主控件尺寸，间距和内容宽度集中调整，无新增包/依赖或目录迁移。900×680 原生审计与隔离窄屏证据由协调 Agent 汇总；未把原生无法缩放称为窄原生实测通过。

## Validation
- Risk Level: B UI 为 S2；Conversation 可选 DTO 元信息为 S3 直接契约边界，未扩大全项目验证。
- 本验收实际执行：读取 AGENTS、constitution、全部有效 `.ai/rules`、Spec/Plan/实施报告/交接；只读相关 diff、源码调用链和测试断言；目视 `build/desktop-ux-audit/after/09-qq-stickers.png` 与 `26-model-edit.png`。未操作原生窗口或真实服务。
- 复用 B 实施报告已有证据：apps 范围类型检查；Conversation 访问元信息定向用例；聊天/记忆及模型 UI 回归；后补暂停 rAF 的 Tabs/导航/Badge 用例。模型旧首请求顺序断言经精确路由定位修正后通过，后续草稿/声音修复重跑相关两项通过，未将首次失败隐去。
- 独立核对测试覆盖：本地 QQ 风格标题仍可写、外部普通标题只读，返回不泄露 principal，服务端阻止外部发信；本地默认与草稿、只读朗读、记忆保存/编辑/批量、模型发现/诊断/推理/过期响应和 380px；rAF 暂停时正文、页签底色矩形、导航和 Badge 最新文字可见。
- 未运行测试、build、lint、typecheck 或重新执行已通过检查；没有暂存、commit、push 或改业务代码。

## Issues
### R1 / P1 — Checkbox 实际选中但仍画成空框
`apps/desktop/src/components/beui/checkbox.tsx:96` 与 `:111`：异步 false→true 时，新挂载勾选图形以 opacity 0 / scale 0.5 和 pathLength 0 开始，等待动画帧才显示；背景颜色也有过渡。协调 Agent 在 QQ 表情页读取到「网络表情」AX Value=1，但截图为空框，Raise 后仍如此；同页初始即 true 的图片启用框正常。这与本轮 Tabs/Badge 的已证实根因相同，可能让用户误判实际启用/授权状态。

须在共享 Checkbox 保证 checked/unchecked/indeterminate 的可见标记和颜色随状态同步，不在 QQ 页面特判。保持 beUI、受控回调、disabled/键盘/ARIA。用暂停 rAF 的一次最小回归覆盖异步三态变化，并由协调 Agent 复看该原生截图。

### R2 / P2 — 模型编辑入口焦点线压住文字
`apps/desktop/src/style.css:107` 与 `:679`：本轮全局 outline 向内 2px，模型名按钮原来 `padding-left:0`；`26-model-edit.png` 中轮廓穿过名称左端和下方用途文字边缘，焦点可见但妨碍阅读。

须只给模型名按钮合理局部内边距/焦点空间，保留明确焦点和主要对齐；无需取消全局焦点或重做按钮。S0 diff 与现有原生焦点截图定向复查即可，无须新增测试。

### R3 / P2 — 无计划时隐藏了仍有意义的恢复/暂停控制
`apps/desktop/src/components/Douyin.tsx:380` 仅按 `schedules.length` 渲染全局控制。`TaskQueue.paused` 持久化且阻止所有任务入队，`Activities.pause` 同时中止 B站/抖音任务，功能并不限于计划。暂停后删除最后一个计划、或导入暂停状态时，可存在 `paused=true` 且 `schedules=[]`；界面不再能恢复活动。无计划但存在运行中的其它活动时，同样丢失全局暂停入口。

须仅在真正空且未暂停、无待执行/运行活动时隐藏；paused 时始终保留「恢复活动」，有计划或活跃任务时保留暂停。保留既有 API/权限。用最小条件边界回归覆盖空闲隐藏、空计划已暂停可恢复、无计划活跃任务可暂停；不需真实平台操作。

## Regression Risks
- 当前后端缺 readOnly，原生兼容显示不代表新版分流已加载；完整行为已有隔离测试，正常启动后生效。
- 暂停动画帧反映已观察的原生环境，不能仅用浏览器正常动画截图代替 R1 的边界验证。
- 云模型主动配图频率、Windows 原生及平台真实登录/发送不在本轮验收实测中。

## Required Rework
由新的实施 Agent 完成 R1–R3，再由新的独立验收 Agent 复验。未变范围沿用已通过证据，不重复全套检查；协调 Agent 汇总最终截图覆盖与限制后才能完成 Spec037。

Git：`dev`，本任务未提交；本验收仅新增本报告。远端未刷新，PR/同步状态不作新断言。
