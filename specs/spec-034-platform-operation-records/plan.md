# Plan

## 实施
1. 两连接页删除观看tab及相关输入/请求；保持连接/设置和真实后台能力。B站保留target/kind/share，抖音保留互动视频ID/点赞评论与审批。
2. 前端普通组件实现两平台共用的紧凑操作记录卡片/行，来源为现有VideoTask/ActivityTask；必要标题、时间、状态、错误与记录动作。连接页不再复用完整ActivityRows，后者只清理无生产调用的选择视频回调。
3. 记录读取与连接状态读取错误分离，保护序号/卸载和草稿；保留既有在途动作互斥，不新增后台操作。
4. 更新docs/bilibili.md与docs/douyin.md界面入口；旧tests/integration/douyin-ui.test.ts含已删除观看控件，最小调整为由夹具API准备观看任务、页面验证记录/保留互动，不能删除后台行为断言。不要借此重写旧测试体系。

## 验证
S2，两页面结构及记录/分享/互动数据展示相关组合。一次现有apps类型检查 `npx tsc -p build/fish-persona/tsconfig.apps.json --noEmit` 加直接diff审阅。无需新增只镜像实现的测试、全量测试/build/lint、真实平台调用或收费模型。旧依赖Python/ffmpeg的UI集成只同步失效入口，本轮不运行不声称通过。独立验收核对保留分享、审批/任务页消费者及类型证据，不重复检查。若出现具体失败再按因果扩大必要范围。

## Git
dev基线0ae89c3，开始干净；根协调Agent处理docs，实施只改直接范围。持续每阶段本地commit授权有效，验收后提交，不push/PR/merge。报告追加本文，验收写acceptance.md。

## Implementation Report

### Summary
已删除B站/抖音连接页的手动搜索、推荐、详情、评论读取和观看控件及其状态/请求，两页默认进入「记录」。B站保留「记录 / 设置」，抖音保留「记录 / 互动 / 设置」。

新的普通前端组件 OperationRecords 以一个卡片、内部 ContentScroll 列表展示真实任务的动作、标题/标识、状态、创建时间及安全映射后的错误；不展示模型长总结、采样元数据、结果载荷或评论全文。B站保留已理解视频分享到QQ、接收对象与准确结果反馈；抖音保留视频ID、点赞/评论预览、审批与全局审批组件。共享详细 ActivityRows 只清除无消费者的选择视频回调。

### Files Changed
- `apps/desktop/src/components/Bilibili.tsx`
- `apps/desktop/src/components/Douyin.tsx`
- `apps/desktop/src/components/OperationRecords.tsx`（新增普通展示组件）
- `apps/desktop/src/style.css`（紧凑记录行、换行和错误颜色）
- `docs/bilibili.md`、`docs/douyin.md`
- `tests/integration/douyin-ui.test.ts`（当前连接设置入口、通过夹具API准备观看任务、记录页及互动页选择器）
- 本 Plan 的实施报告；未修改协调Agent的其他治理文档。

### Important Decisions
记录来源保持现有 VideoTask / ActivityTask，不新建审计端点或持久化。原连接状态和任务列表使用同一个 Promise.all 成功分支，记录请求失败会阻止连接状态进入页面；现分别处理两类响应和错误，记录失败在记录卡片提示，保留旧列表并随轮询恢复。序号与离页检查覆盖返回结果；B站轮询改为完成后再安排下一次，避免慢请求不断被固定间隔轮询淘汰。抖音设置仍在用户编辑时拒绝轮询覆盖，仅在保存成功后解除编辑标记，动作仍使用在途互斥。

未开放原先不可选且不受支持的抖音私信/分享/投稿；删除这些不可达的连接页表单分支，不改 Runtime 能力或历史审批展示。B站分享按钮依照现有后端契约仅对 completed/partial 且有总结的任务出现，返回 sent、unknown 和失败分别反馈，不把任务完成等同分享成功。

### Validation
- Risk Level: S2。
- 已审阅直接diff、新组件和原后端任务/分享数据契约；确认后端、数据库、调度与历史数据未改。
- `npx tsc -p build/fish-persona/tsconfig.apps.json --noEmit`：退出0，通过（约2.03秒，只运行一次）。
- `git diff --check`：退出0，通过。
- 旧抖音UI集成保留真实任务的完成与模型总结、审批前零提交/批准后一次提交、全局暂停/恢复断言，删除的手动观看按钮改由既有夹具API准备任务。本轮未执行该依赖Python/ffmpeg的集成测试。

### Known Limitations
未运行完整测试、build、lint、浏览器/原生UI或真实平台验证，未重打安装包；以上静态和类型证据不代表真实账号分享/互动已验证。连接页展示既有任务列表，不包含未入库成任务的全部读取或连接事件；详细历史仍通过原任务页/CLI查询。

### Remaining Questions
无实施阻塞，待新的独立验收Agent验收。保持dev，未切分支、commit、push或操作PR；Git提交由协调Agent依授权处理。
