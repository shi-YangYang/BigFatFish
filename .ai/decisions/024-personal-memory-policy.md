# 个人记忆的归属和写入

主人选择让自动记忆直接生效。好友私聊分别记，群按群记。主人在群里的亲口陈述可以在主人私聊回忆，私聊资料对群和其他好友隔离。延续本机 small 检索，人物身份和范围由 Runtime 生成。

腾讯 Agent Memory 分开处理来源、个人归属和团队共享。微软的参考架构区分明确意图、稳定偏好、承诺与偶然提及。LongMemEval 将信息更新、时间和证据不足时放弃回答作为独立评测维度。[腾讯 Agent Memory](https://cloud.tencent.com/document/product/1813/132100) · [微软参考架构](https://github.com/microsoft/multi-agent-reference-architecture/blob/main/docs/memory/Long-Term-Memory.md) · [LongMemEval](https://arxiv.org/abs/2410.10813)

大肥鱼据此优先保留有本人原话的明示、稳定自述和已确定的安排。一次提到某样东西不足以推断喜好，模型给出的重要性不足以写入长期记忆。具体实现与验收见[自动记忆规格](../../specs/spec-048-automatic-personal-memory/spec.md)。

用户进一步选择先完成回复，再通过持久队列在后台比较新原话和旧记忆。同一时刻从另一入口提问，可能暂时得到旧答案。明确单句由本机规则处理，复杂表达才使用当前聊天模型。模型可以提出候选和更正，来源、身份、受众以及能否覆盖旧值由程序核实。[回复后的记忆整理](../../specs/spec-049-background-memory/spec.md)

人物资料单独保存可追溯的结构化字段。原话、重要事实和人物摘要分别回答「当时说了什么」「以后值得记住什么」「目前对这个人知道什么」。年龄记录本人当时声称的值与日期，不从人设、外貌或猜测生成。已确认记忆及其来源决定摘要的更新与删除。[分层存储规格](../../specs/spec-050-memory-layers/spec.md)
