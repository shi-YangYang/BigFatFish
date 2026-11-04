# Plan

## 范围
单实施Agent改颜色，root维护规格与现有预览目视，新独立Agent验收。当前dev9557f0a，开始干净。用户持续每阶段本地commit授权保留，无push授权。

不仅降低主色饱和度，还将页签indicator/label产品层样式与主按钮分离。源码事实：beUI TabsTrigger支持data-tabs-indicator和data-tabs-label，后者白字覆盖层在选择动画中参与遮罩。优先在现有section-tabs样式规则处理颜色，不改变组件状态/属性协议。

## 验证
S0，仅diff、一次必要配色对比度计算、root现有cua_repl预览目视并保存两张代表图。实施Agent不另起UI采集。独立验收审diff及已有图，不重复采集/检查。不test/build/lint/typecheck/重打包；按实际证据记录，满足条件后commit并停止。

## 偏好
用户已答复选择“浅海蓝，更清透轻盈”，不采用蓝灰候选。最终主色#22789F、hover#1D668A、浅底#ECF8FE、侧栏#F6FBFE、focus#A6D8EF，边框#D4E7F1/强调边框#93BFD3，辅助字#647E8D/选中次要字#4E7F98，文本选择#DAF0FA；实施核对一次主要文字对比度，必要时仅调整亮度到可读范围。上一版截图和DMG均不当作本次结果。

## Implementation Report

### Summary / 根因与职责
`/root/implement_sea_blue`实施完成，源码冻结。此前高饱和实色既用于主要操作又用于页签选中，视觉强调过重；beUI页签独立白字覆盖层使仅改浅底会导致文字低对比。修复集中在产品共享样式：调整浅海蓝token，并在已有section-tabs规则处同时指定indicator浅底与label海蓝字，不改beUI动画/遮罩/状态逻辑。

### Files Changed
- `apps/desktop/src/style.css`：唯一源码变更；替换颜色token并补全产品页签两个颜色slot的样式。无布局、间距、尺寸、事件或业务变化，既有beUI主题映射自动采用新颜色。
- `.ai/decisions/010-desktop-webui-redesign.md`：记录用户明确选择浅海蓝及本轮取代旧配色的决定。
- 本Plan：记录实施与实际证据；未修改root维护的Spec状态、index或handoff。

### Important Decisions
最终主色#22789F、hover#1D668A、浅底#ECF8FE、侧栏/禁用#F6FBFE、focus#A6D8EF；边框#D4E7F1/强调#93BFD3、辅助字#647E8D/选中次要字#4E7F98、文本选择#DAF0FA。主色较建议#247AA3仅降低少量亮度，色相/浅海蓝方向保持。主要操作仍使用实色白字，页签浅底深字形成轻量选中层级；红黄绿状态及平台识别色保持。

### Validation
- Risk Level: S0，纯颜色。
- 审阅唯一源码diff，确认仅颜色值及section-tabs颜色引用变化；没有新增覆盖层、组件状态或业务修改。
- 首次sRGB对比度计算：白字对建议#247AA3为4.79:1，该海蓝字对#ECF8FE为4.43:1。因后者低于4.5，将主色微调为#22789F后仅针对变更颜色重算：白字4.94:1、页签深字4.56:1。没有无理由重复已通过检查。
- 未运行test/build/lint/typecheck或原生打包，未另起浏览器或采图。root负责既有隔离预览目视；此报告不将待进行的视觉检查写为通过。

### Known Limitations / Remaining Questions
无实施侧已知阻塞。旧DMG不包含本轮颜色。实施Agent未执行Git写操作，无剩余需求问题。

## root视觉记录
完整实施报告已读取处理，源码冻结，root审阅唯一源码diff。cua_repl在现有隔离预览读取实际primary #22789f/soft #ecf8fe；实际目视模型浅底深字页签/主要按钮，以及数据checkbox/输入焦点，配色与层级符合方向。没有调用真实服务或执行保存/恢复。模型图更新docs/design/desktop-webui-blue.jpg，数据图build/sea-blue/data-blue.jpg，两张均883×1344当前完整视口；裁剪截图接口首次得到空白，已用正常完整视口截图覆盖，不将空白图作为证据。预览已返回模型页并markDeliverable。新独立验收已完成，不追加检查。

## 独立验收与Git
新独立/root/accept_sea_blue PASS，完整报告已读取处理；实际查看两张最终图并审阅唯一源码diff和相关主题引用，无返工，未重复计算或采集。root按持续每阶段授权完成本地commit，确切hash以git log为准；未push/PR/合并，远端未刷新。Spec018 Done，满足停止条件。
