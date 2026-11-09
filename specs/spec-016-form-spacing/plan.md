# Plan

## 实施
EXISTING；dev基线8b4bbd8，开始干净。单实施Agent串行完成共享表单样式及必要展示分组，root维护Spec与交接，完成后新独立验收。当前用户要求commit已由前阶段8b4bbd8满足；本阶段沿用持续每阶段本地commit授权，未获push授权。

优先apps/desktop/src/style.css中的Field/FormGrid/ActionRow/Disclosure与表单默认规则；必要时修改Models.tsx、Surfaces.tsx等少量纯展示容器。不要迁移目录、改beUI状态/业务、用全局重置影响聊天或添加层叠特判。把实际采用的间距与例外记录在本Plan，更新已有Decision010的表单间距部分。

## 验证与停止
S0，纯样式与无逻辑展示分组。默认审查diff；本任务以视觉精度为目的，补一轮有限代表视图目视/几何采样：模型含说明/诊断反馈与高级区、通用或数据、人格或平台，桌面与380px，最多6个主要视图。复用生产组件+隔离IPC的Vite预览，不访问真实鱼/云服务；未构建不能称为最终发行包。

不新增测试文件，不运行自动化逻辑测试、build、lint、typecheck或重打Mac包。若出现确有业务/组件逻辑变动的必要性，先报告具体原因，不借收紧样式扩大任务。只在发现本轮直接视觉问题时调整并重看对应视图，不做全页矩阵。独立验收只审diff、实施记录和代表图，原则上不重复采图。满足要求与独立PASS后commit并停止。

## 交付证据
截图与几何记录放忽略的build/form-spacing/；已有docs/design/代表截图按实际需要更新，不新增过程文档。本轮以源码/预览为交付，上一阶段DMG不冒称包含本轮样式。

## Implementation Report

### Summary / 根因与职责
`/root/implement_form_spacing`完成并冻结源码。原表单的父级gap与子级p/form/Disclosure/Card外margin叠加，同一层间距由多处决定。修复集中在共享style.css：父级布局栈统一负责间距，子块清除额外margin；Models只加三个纯展示容器表示字段组、字段说明与操作反馈，不改变事件、状态、请求或DOM内容顺序。Tabs原wrapper28px加窄屏内部24px也属于同类叠加，改为单一24px wrapper。

### Files Changed
- `apps/desktop/src/style.css`：语义间距token、表单/折叠/卡片子块margin、网格与操作行、内容padding；保留导航/聊天规则、字号/颜色/控件尺寸。
- `apps/desktop/src/components/Models.tsx`：`form-section`组织连接字段，`field-with-help`关联推理说明，`form-feedback`关联诊断按钮/说明/结果；纯展示，不修改业务表达式。
- `apps/desktop/src/components/UI.tsx`：Tabs wrapper仅换为共享间距class，保留所有Tabs事件/值/焦点逻辑。
- `docs/design/desktop-webui-settings.png`、`desktop-webui-data.png`更新本轮生产组件的隔离数据截图；Decision010追加此轮间距决策。

### Important Decisions / 实际间距
标签/控件及字段说明6px（`--field-gap`）；普通表单/字段网格16px（`--form-gap`）；模型分组、独立表单/折叠、页签到内容24px（`--section-gap`）；动作按钮、诊断反馈、数据页确认提示到按钮8px（`--action-gap`）。表单卡片padding16px（`--surface-padding`），页面padding24px、≤700px为16px（`--page-padding`）。一般Card内容gap保留12px、checkbox网格纵向4px且每项保留40px点击行；它们分别是文字块/选择列表的既有密度，不强行变成字段间隔。模型保存行直接采用父级24px，没有额外padding叠加。平台fieldset与嵌套表单按相同父级间距规则处理。

### Validation
- Risk Level: S0，纯样式和展示容器。审阅源码diff（Models用忽略缩进diff核对原业务表达式未变）；`git diff --check`通过。没有新增或运行自动化逻辑测试、build、lint、typecheck、原生包。
- 一轮有限生产组件Vite预览，`build/form-spacing/preview.tsx`只提供隔离IPC数据并导入当前App和style.css，未连真实Runtime/账号。owned预览http://127.0.0.1:53427/，exec session74612。
- 六张代表图均实际目视：models/data/personality各1100与380宽。模型高级展开/状态与说明、数据确认警告及按钮、人格双列/单列排列正常；内容没有为收紧而隐藏。窄屏checkbox保留两列且可读，普通字段网格按既有断点单列。
- `build/form-spacing/metrics.json`记录三个380px视图：标签与控件实际6px、常规按钮实际40px、document及content横向溢出均0、pageerror为空；相应stack间距为6/8/16/24px。Desktop三图已采集并目视，不伪称其几何数据也写入此JSON。
- 初始采集脚本误把checkbox自身label当成常规label，修正过滤；随后桌面三图已保存，但窄屏导航名称误写导致采集退出。修正后仅继续三个窄屏视图并成功保存metrics，未重跑桌面采集。最后人格窄屏从1400高重新取景为1600高以拍全底部操作，布局不变；六张最终图均审阅，不把这些脚本问题当产品缺陷或完整业务测试。
- 截图尺寸：模型1100×1360/380×1850，数据1100×900/380×1400，人格1100×900/380×1600；长截图用于展示表单完整间距，未声称单屏无需滚动。图中123ms为fixture值。

### Known Limitations / Remaining Questions
无本轮已知视觉阻塞。未打包，因此上一阶段DMG不包含本轮样式；未原生启动或验证真实服务，不扩大旧外部待验。实施Agent未执行Git写操作。没有剩余需求问题。

## 独立验收与交付
新独立/root/accept_form_spacing验收PASS，完整报告已读取处理。其实际查看模型桌面、数据桌面、人格窄屏三图并审阅diff与窄屏几何证据，无返工；未重复采集或执行检查。root另实际查看模型1100/数据380图，审阅三个源码diff。按持续授权本地commit，具体hash以git log为准；未push/PR/合并，远端未刷新。源码/预览及文档已完成，满足停止条件，不追加验证。
