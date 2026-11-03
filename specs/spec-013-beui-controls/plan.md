# Plan

## 模块与顺序
1. 固定官方Button及依赖源，保留LICENSE/notice；在现有源码内引入组件，不新建包。
2. 根依赖清单/lock增量安装，两个Vite接入Tailwind4。最小主题映射保持DS蓝，谨慎控制Preflight和既有未分层CSS。
3. Controls.Button转为beUI适配，清理旧Button CSS，修正顶栏compact。保留业务属性与导航/会话列表布局。
4. 相关前端检查与实际布局截图、定向回归；新独立验收；root同步两前端产物并更新本机包/文档/本地commit。

## 验证与停止
S3（触及共享组件与两前端构建配置/依赖），但验证范围按影响限定前端：TypeScript前端配置、相关ESLint、Desktop/Web production build、desktop-webui定向交互与新增顶部尺寸断言。补1100/820/640/380主要聊天/设置/历史，检查原先40px表单和无横溢出；实际验证按需 reduced-motion/focus/禁用，不全量跑Runtime/平台/数据库套件。已过检查不重复，失败只扩大直接受影响范围；独立验收不机械重跑。

## 取舍与风险
beUI源码分发是实际接入方式，不是安装名为beui的未知npm包。旧Button尺寸/hover CSS和Tailwind层级可能覆盖，需在共用入口消除双重控制；应用既有--accent/--muted与库语义token命名不同，明确映射避免改变非按钮页面。原生表单/键盘/ref语义与数据边界保持。无数据库或数据迁移。

## 来源
- https://beui.dev/components/motion/button
- https://beui.dev/docs/theme
- https://tailwindcss.com/docs/installation/using-vite
- https://github.com/starc007/ui-components/tree/6f153a06d2225ba07a0137f317ce19faf8da69ef

## Implementation Report
实施完成，源码/前端产物已冻结，新独立验收PASS。

### 接入细节确认
实施者已核实registry，计划固定frontend devDependencies：tailwindcss与@tailwindcss/vite 4.3.4、motion14.9.0、clsx2.1.1、tailwind-merge3.7.0。它们在构建时打入前端，不作为Runtime运行时新依赖；最终以实际lock和构建报告为准。共享Vite插件向两前端输出beui-LICENSE.txt。

旧全局button font/color未分层规则会压过Tailwind，且根字号14px使默认h-10仅35px；这两点在入口/主题层处理，用明确px规格而不全站改根字号。保留导航56px与会话多行条目等有语义的布局，不把它们误当普通动作按钮。

### 完成报告

/root/implement_beui 已完成：components/beui下固定官方Button/ease/utils及MIT/NOTICE；Controls为薄适配，App去掉待审批compact；两个Vite接入Tailwind与scripts/beui-vite.ts许可证插件；beui-theme.css明确source和主题/utility，不启用Preflight；删除旧按钮基础变体CSS。所有Button消费者真实经过Motion Button，不改变原Input/Select/Textarea/Checkbox和业务状态。

实际devDependencies为Tailwind/Vite插件4.3.4、Motion14.9.0、clsx2.1.1、tailwind-merge3.7.0；lock原有依赖条目无修改/删除。按钮默认pressScale0.98、无hover几何缩放，reduce禁用按压缩放；px尺寸保护40px高度/8px圆角，桌面新对话和待审批共用100px最小宽度。独立验收核对metrics实测分别100.84375px和100px，属于内容自然增长，不声称精确等宽。

S3限定前端：frontend TypeScript、相关源码/两个Vite/许可证插件/测试ESLint、两前端production build、desktop-webui.test.ts（1项9.47秒）、diff check通过。保留原草稿、请求归属、只读、审批错误和历史回归，新增顶部尺寸/圆角/实际beUI渲染断言。第一次构建通过后仅补许可证插件import的.ts扩展名，再重建两个受影响前端退出0；Motion的use client在纯SPA打包有提示，无RSC语义依赖，未隐藏提示。

build/beui-ui/layout.mjs与metrics.json、12张chat/history/settings的1100/820/640/380截图：无前端异常/横溢出，72px导航、60px单顶栏和阅读列保持。interaction.json记录disabled事件0、键盘focus轮廓3px、Enter历史/Escape焦点恢复；普通按压scale约0.98，reduce时transform none/高40px。实施者和root均实际查看chat1100/380与settings820。全部为隔离IPC示例，不是实际平台/模型验证。

最终Desktop index-Cr9eHNz3.js、Web index-DpaCgel1.js、CSS index-CMLyyJw7.css；两dist的beui-LICENSE.txt逐字节等于源MIT。root同步Web dist及根manifest/lock到现有portable；新依赖均dev且旧生产依赖未变，复用Runtime/Node/生产依赖，不重复全量prepare。随后Tauri重打包，日志build/beui-ui/tauri-build.log，最终证据待补。docs/design更新chat/settings/history截图。

### 最终产物

Tauri本机打包退出0，app642.69MiB、DMG200.41MiB。DMG SHA-256 `48a431704b6ef1bac459f85a649a14eb69af386d91f62823c8a4f954380409ca`。包内Web5文件（含beui-LICENSE）逐字节匹配dist；MIT与源文件相同，随包manifest/lock匹配当前根文件；Desktop最终JS/CSS/许可证路径存在于app二进制。证据 `build/beui-ui/package-evidence.json`。仍为本地ad-hoc，未原生启动、未公证/发布，未将UI检查说成实际外部服务验收。

## 最终闭环

新独立验收/root/accept_beui为PASS，审查实际库调用、上游适配/主题和两端构建、语义及定向验证证据，目视4张代表图；不重复检查。协调者已完整读取全部实施/验收报告，无直接阻塞，按用户持续授权完成本阶段本地commit，无push。当前版本以源分发方式维护beUI Button，固定revision/NOTICE作为后续升级边界。
