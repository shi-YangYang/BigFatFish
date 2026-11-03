# Spec：接入 beUI 并统一按钮

## 背景
用户认可Spec012布局，但指出“新对话”“待审批”按钮大小不同，并明确要求换成beUI。本轮Done，独立验收PASS，取代此前继续手封Button的选择。

## 目标
实际接入beUI基础Button与依赖，所有现有Button消费者使用同一库组件；消除顶部相邻按钮不同高度、圆角和内边距的不一致。

## 非目标
不重做用户认可的72px导航、60px单顶栏/历史抽屉，不重做品牌或业务页，不改变聊天/审批/API/数据，不迁移无关输入、选择器与checkbox的事件协议，不引入独立包。

## 当前行为
Controls.tsx自写原生Button，调用方可传compact（32px）或regular（40px）；App待审批使用compact，与Chat新对话40px直接并排，属于尺寸选择不一致。安装库本身不会纠正调用方的尺寸混用。

## 目标行为
- 使用beui.dev官方开源Button源码、Motion及Tailwind4集成。官方采用源码分发，不凭名字安装无关npm包；保留上游MIT/来源/固定revision与本地适配说明。
- 当前全部Button调用点实际经过beUI基础Button；Controls保持轻量兼容入口，明确尺寸/变体映射，不能保留完整旧实现覆盖库所有视觉而仅增加空依赖。
- 顶栏历史/新对话/待审批（以及窄屏导航）统一40px高度与8px圆角，文字按钮同一字体、垂直/水平内边距，图标40×40；顶部不再使用compact。桌面新对话与待审批共用100px最小宽度，让常见文案等宽；长审批数字可自然增长。窄屏新对话缩为40px图标、待审批可按文字宽度，保持操作可达。
- 保留DS蓝主题，审批使用明确状态色。同类普通按钮仍40px；可显式32px的小型文字动作不混入同一主要操作行；导航和多行会话列表按语义保留组合高度。
- 清理被替代的旧Button尺寸/变体CSS，由库和单一主题/适配层负责基础控件视觉；避免Tailwind默认reset、语义变量与既有CSS互相覆盖。

## 功能需求
保留原生button、type=submit/button、disabled、事件/aria/ref与键盘语义；遵循prefers-reduced-motion，保持focus可见，克制按钮hover/press动画。不得伪造事件或迁移业务状态。Desktop/Web都实际构建并使用同一库组件。

## 边界条件
窄屏380×500、长标题/审批数字、禁用/提交/加载态、历史模态/审批错误、导航与会话多行按钮；CSS工具类的生成路径必须覆盖共享Desktop源码供Web构建使用。

## 技术约束
固定上游 https://github.com/starc007/ui-components revision 6f153a06d2225ba07a0137f317ce19faf8da69ef（本轮重新核实）；MIT，来源文件已只读下载至/tmp/bff-beui-013。允许新增Tailwind4 Vite插件、Motion、clsx/tailwind-merge必要依赖；保留根单manifest和lockfile，不能全量重建或升级无关依赖。只引入基础Button所需源码，不导入无关动效/Pro内容。

## 兼容性要求
普通源码适配，不分包；原Input/Select/Textarea/Checkbox与业务状态保持，不声称这些已换成beUI。本轮是全部按钮库基础与构建/主题接入，后续按实际需求扩展库组件。

## 验收标准
- [x] 有可追溯的beUI Button源码及MIT声明，必要依赖/双Vite集成与主题有效，所有Button消费者实际使用。
- [x] 顶部相邻按钮40px、圆角/内边距统一，1100/820/640/380截图中明显不再大小混用；原布局/阅读列保留。
- [x] 提交、disabled、focus、历史/导航、草稿/请求归属/审批错误保持，reduced-motion有正确处理。
- [x] 前端类型/相关lint/两前端构建、既有定向UI交互及必要尺寸断言通过；独立验收实际看图并审查接入真实性。

## 待确认问题
无阻塞。用户明确指定beUI并授权必要接入；本阶段完成按持续授权本地commit，无push或发布。
