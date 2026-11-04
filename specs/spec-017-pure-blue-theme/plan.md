# Plan

## 实施与范围
dev基线cfa2953，开始干净。单实施Agent只改颜色token和直接引用，root维护规格/交接并查看当前预览；新独立Agent验收。更新已有Decision010当前颜色结论，不另建设计体系。先前commit已满足用户第一项，本阶段仍有每阶段本地commit授权，无push授权。

## 验证
S0纯颜色，审阅diff；只作一次主色/白字对比度计算及两个代表视图目视，不运行test/build/lint/typecheck、业务回归、矩阵采图或原生打包。root使用cua_repl现有生产组件隔离预览http://127.0.0.1:53427/验证模型主按钮/页签与数据checkbox，必要查看聊天浅底；保存代表截图。实施Agent不另起浏览器或采集脚本，不重复视觉检查。独立验收读取diff和实际截图，不机械重复操作。当前预览截图为隔离fixture，不代表真实服务验证。

## 交付
源码与同一预览即时更新；旧DMG不包含此次颜色。首阶段cfa2953已提交，最终PASS后root仅提交本轮文件并停止。

## Implementation Report

### Summary / 根因与职责
`/root/implement_pure_blue`实施完成，源码冻结。原主色为靛蓝、浅底和焦点带紫，且beui-theme重复硬编码浅底/焦点，因此单改按钮主色无法统一。现在style.css集中颜色语义token，原生布局与beUI映射引用同源；既有颜色规则原位替换，无新增覆盖层。

### Files Changed
- `apps/desktop/src/style.css`：主色、hover、浅底、侧栏/禁用、焦点、边框、文本选择及历史选中次要字；只有颜色定义与引用变化。
- `apps/desktop/src/beui-theme.css`：primary-hover映射、muted/accent/ring/border-strong引用共享token，清除重复紫色常量。
- `apps/desktop/src/components/beui/button.tsx`：仅主按钮hover颜色class由primary/90改为primary-hover，使其使用同系深蓝；未改按钮逻辑、尺寸或事件。
- Decision010追加本轮选色及替代旧靛蓝决策；没有改依赖、布局、业务或头像。

### Important Decisions
主色#0866E6，hover#0757C4，浅底#EAF4FF，侧栏/禁用#F4F9FF，焦点#8FC7FF，边框#D4E3F2/强调边框#8FB9E4；次要字#61758A与选中次要字#456E99，文本选择底#D4E9FF。颜色均按用户本轮蓝白偏好确定，不继续把历史官方色号当作不可变约束。红/黄/绿状态与平台识别色保留。主按钮hover的单行颜色引用已向root说明并获得本轮范围确认。

### Validation
- Risk Level: S0，纯颜色。
- 审阅三个源码文件diff：仅颜色值、CSS变量引用和一行hover颜色class，Spec016间距及原状态/交互保持。
- 一次本地sRGB相对亮度计算：白色文字对#0866E6对比度5.18:1。
- 未运行test/build/lint/typecheck或原生包，未另起浏览器或采图。root负责既有隔离预览中的代表视图；本实施报告不将待进行的视觉检查写成已通过。

### Known Limitations / Remaining Questions
无实施侧已知阻塞。旧DMG未包含本轮配色。实施Agent未执行Git写操作，无剩余需求问题。

## root视觉记录
完整实施报告已读取处理，源码冻结。root通过cua_repl操作现有隔离预览，HMR后实际看到聊天浅蓝气泡/导航，再查看模型主按钮/页签及数据checkbox/输入焦点，均为同系蓝色。DOM只读读取确认primary #0866e6、hover #0757c4、soft #eaf4ff；没有模拟保存/恢复或调用真实服务。

模型页截图保存docs/design/desktop-webui-blue.jpg，数据焦点/checkbox图保存build/pure-blue/data-blue.jpg；均为浏览器当前883px宽视口，未作响应式矩阵。root已目视两张保存图并审阅三个源码diff，变化仅颜色。预览已回到模型页并保留供用户查看；不把上阶段旧PNG或DMG当本轮配色结果。

## 独立验收与Git
新独立/root/accept_pure_blue验收PASS，完整报告已读取处理；其审阅三个源码diff并实际查看两图，无剩余阻塞，未重复采集或执行检查。root按持续授权本地commit，确切hash以git log为准，未push/PR/合并，远端未刷新。满足停止条件，不追加验证。
