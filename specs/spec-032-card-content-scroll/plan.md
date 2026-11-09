# Plan

## 实施
1. 在Surfaces/CSS提供明确、可复用的内容滚动入口（不修改所有Card默认值），保持min(360px,50vh)上限、overflow:auto和overscroll containment，处理长文本/键盘焦点。
2. 只在Spec列出的动态列表/记录/长文本接入，主要控件保留区外；相邻记录组成单个滚动区域，避免每条记录另造滚动条。Sources等共用内容嵌套时不重复限制。
3. QQ记录采用同一规则；240px联系人选择列表保留原高度上限并约束短窗口和链式滚动。

## 范围
apps/desktop/src/components/{Surfaces,QQDeliveryHistory,Channels,QQConnection,QQStickers,Bilibili,Douyin,Life,Memories,Personality,Workspaces}.tsx及style.css中直接必要处。无需所有文件都有改动；只接入有实际长列表/正文的容器，不改其他代码。

## 验证与风险
展示结构跨多个同类页面和共用容器，S2但没有业务/持久化改动。只运行一次现有apps范围类型检查 `npx tsc -p build/fish-persona/tsconfig.apps.json --noEmit` 确认TSX组合，审阅diff及直接布局/交互边界；不新增实现镜像测试，不运行全量测试、build、lint或真实服务。新的独立验收审阅实际差异和检查证据，不重复已通过命令。若只是CSS/文案后续调整仅diff。本轮不把静态审阅称为设备滚动实测。

## Git
dev基线d94065d，开始干净；root检查后本地提交（用户持续阶段授权），不push/PR/merge。实施报告追加本文，验收写同目录acceptance.md，交接更新现有文件。

## Implementation Report

### Summary / Root Cause
同类记录和长正文直接参与页面高度计算，只有QQ记录有局部限制。修复在共享展示层提供显式 `ContentScroll`，由实际长内容入口选择使用；默认Card和外层页面不变。列表整体内部滚动，保留全部记录及行内操作，不修改数据、加载数量、排序或请求。

### Files Changed
- `Surfaces.tsx`、`style.css`：共享内容容器，最大高度 `min(360px,50vh)`、内部滚动与边缘约束；QQ联系人用240px上限。保留换行、滚动条空间和6px焦点留白，滚动区可通过Tab进入并有中文无障碍名称。空子列表不额外渲染区域。
- `Bilibili.tsx`：搜索结果和观看记录整体滚动，搜索/BV操作、QQ分享对象及结果提示在外。
- `Douyin.tsx`：共用ActivityRows整体滚动，覆盖抖音最近任务和任务页历史，不改审批/计划表单。
- `Life.tsx`：概览活动/兴趣/关系/最近经历、最近日记、整理任务、日记和时间线；查看任务按钮及日记创建表单在外。来源记录和原文也接入共用容器。
- `Memories.tsx`：记忆记录整体滚动，筛选、导出、分页和编辑表单在外。
- `Personality.tsx`、`Workspaces.tsx`：版本历史和运行日志，保存/刷新操作不进入滚动区域。
- `QQDeliveryHistory.tsx`、`Channels.tsx`、`QQConnection.tsx`、`QQStickers.tsx`：原QQ记录、好友/群选择和本地表情共用规则，上传及网络表情配置在外。

### Important Decisions
一个持续内容块只由最外层ContentScroll限制高度；组件通过局部React Context识别已在滚动内容内的来源等嵌套入口，内层仅保留布局、不增加滚动条或重复Tab停靠。此Context只管理展示嵌套，不承载业务状态。已有Card列表直接整体包内容容器，不新增外框、不逐条做滚动。没有全局选择器推断哪些Card要滚动，也没有窗口滚动拦截事件。

### Validation
- Risk Level: S2，跨多个页面的同类展示组合，无业务或持久化修改。
- `npx tsc -p build/fish-persona/tsconfig.apps.json --noEmit`：一次，PASS（exit0）。
- 审阅实际差异和直接调用位置，`git diff --check`通过。类型检查后未再修改生产代码，不重复运行。
- 没有新增测试或运行全量测试、build、lint、浏览器/原生UI、真实平台或模型服务。

### Known Limitations
本轮仅类型检查与源码/布局差异审阅，不把CSS语义验收写成设备滚动实测。审批、插件编辑和其它非目标表单卡片未调整；数据接口及后台完全未改。

### Remaining Questions
无；实施完成，交新的独立验收Agent判断。未切换分支、提交或推送。

## R1 返工：折叠区裁切边界
首轮独立验收FAIL，仅发现共用容器横向负margin及外置focus outline会越出Disclosure的overflow-hidden边界。新实施Agent只做S0 CSS修复：滚动容器自身和焦点轮廓保持在父级内容边界内，保留6px内部焦点留白、最大高度和滚动语义；不取消折叠组件原有overflow、不增加新特判。仅diff，不重跑已通过类型检查或追加UI。新的独立验收复核最终差异及首轮报告。

### R1 Implementation Report
- Summary / Root Cause：共用ContentScroll的横向负margin和外置outline越出Disclosure裁切边界；在共享CSS层将margin改为0、outline-offset改为-2px，使滚动视口和自身焦点轮廓留在容器内，覆盖版本记录及独立来源等同根因入口。
- Files Changed：`apps/desktop/src/style.css`两处属性值；本文追加本次报告。
- Important Decisions：保留6px内边距供子控件焦点显示；最大高度、overflow、滚动约束和折叠动画均不变，没有新增依赖、调用点特判或业务逻辑。
- Validation：S0，仅审阅本轮两处CSS差异及报告；未运行测试、typecheck、build、lint或浏览器/原生UI验证，不重复首轮已通过的类型检查。
- Known Limitations：结论基于源码差异与既有裁切规则，未做设备滚动实测；最终验收由新的独立Agent判断。
- Remaining Questions：无；保持dev，未切换分支、提交或推送，既有未提交修改完整保留。
