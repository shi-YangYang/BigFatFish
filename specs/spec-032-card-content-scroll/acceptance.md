# Acceptance

## Result
FAIL

独立验收：`/root/accept_card_content_scroll`。仅 R1 需要局部样式返工；未修改业务代码。

## Spec Coverage
- 明确接入B站搜索/记录、抖音共用任务、生活/记忆、版本、日志和QQ记录/联系人/表情库。记录作为整体滚动；标题及主要表单、筛选、分页和刷新保持在外。
- 共用最大高度与overscroll containment，QQ联系人保留240px上限；没有全局限制Card或页面，也没有删减数据、按钮或改变业务请求。
- 局部Context使来源等嵌套容器复用最外层滚动，避免重复滚动和Tab入口。空子列表不渲染额外区域，已有空态保留。
- 尚未满足折叠内容内的滚动区域边界和完整焦点显示要求，见R1。

## Validation
- Risk Level: S2，仅共享展示组合。
- Evidence Reviewed / Checks Performed：读取项目规则、Spec/Plan/实施报告和交接，独立审阅全部生产差异及直接布局/调用位置；特别核对ContentScroll、Disclosure/Collapsible、长列表、日志换行和主要控件位置。
- 复用实施报告中的一次apps类型检查与diff检查PASS，没有重跑命令。未执行测试、build、lint、浏览器或原生UI，不把CSS静态分析称为设备实测。

## Issues
### R1：折叠区域会裁切新增滚动容器的边缘（P2）
`apps/desktop/src/style.css:94` 对ContentScroll设置横向负6px margin，`:96`又使用向外的焦点轮廓；`Personality.tsx:116`将其直接放入版本记录的Disclosure。该Disclosure内部容器没有横向留白，且`beui/collapsible.tsx:263`的外层始终overflow-hidden。因此新滚动视口两边各越出裁切边界6px，滚动条的右边缘及focus-visible轮廓不能完整显示；版本内控件位于左边缘时，预留给其焦点的6px也落在祖先裁切范围外。Sources独立使用同一组合时同样受影响。这是已有裁切层与本次新增负margin/外轮廓的直接冲突，不涉及业务。

## Regression Risks
滚动内容没有截断或数量变更；未发现其它本轮阻断问题。未做实际设备滚动验证，正式发行与真实服务不在本轮范围。

## Required Rework
在共享展示层让ContentScroll处于Disclosure等裁切容器的可见边界内，并让新区域及子控件的焦点留白保持可见；可局部调整折叠内容下的横向margin及焦点轮廓位置。保持高度/滚动约束和现有折叠动画，不以全局取消overflow-hidden或锁定页面绕过。属于S0局部CSS返工，必要差异审阅即可，不需重跑已通过的类型检查或扩展UI/测试。
