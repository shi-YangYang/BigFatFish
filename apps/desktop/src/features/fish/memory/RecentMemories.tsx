import { useCallback, useState } from "react";
import { api } from "../../../api/client";
import { Button } from "../../../components/Controls";
import { EmptyState, PageStack, SectionHeading } from "../../../components/PageLayout";
import { Alert, Card, Loading } from "../../../components/Surfaces";
import { useLifeRefresh } from "../life/Life";
import { memoryOrigin } from "./memory-origin";
import type { Memory, MemoryScene } from "../../../../../runtime/src/memory/types";

type Summary = { memories: Memory[]; hasOther: boolean };
export function RecentMemories({ browse, onChat }: { browse: () => void; onChat?: () => void }) {
  const [summary, setSummary] = useState<Summary>();
  const load = useCallback(async (isCurrent: () => boolean = () => true) => {
    // The service returns the most recently updated items first. Never present candidates as remembered facts.
    const confirmed = await api<Memory[]>("/v1/memories/search", "POST", { status: "confirmed" });
    const fromConversation = confirmed.filter(m => m.sources.some(s => s.type !== "user"));
    const memories = (fromConversation.length ? fromConversation : confirmed).slice(0, 6);
    let hasOther = false;
    if (!memories.length) {
      // Profiles derive from confirmed facts. Scenes can exist without any such fact.
      const [stored, scenes] = await Promise.all([
        api<Memory[]>("/v1/memories/search", "POST", {}),
        api<MemoryScene[]>("/v1/memory-scenes/search", "POST", { limit: 1 }),
      ]);
      hasOther = stored.length > 0 || scenes.length > 0;
    }
    if (isCurrent()) setSummary({ memories, hasOther });
  }, []);
  const error = useLifeRefresh(load);
  return <PageStack className="fish-memories">
    <SectionHeading title="最近记住的事" actions={<Button variant="ghost" onClick={browse}>浏览全部记忆</Button>} />
    {error && <Alert role="alert">{error}</Alert>}
    {!summary && !error && <Loading>正在读取记忆…</Loading>}
    {!error && summary && !summary.memories.length && <EmptyState title={summary.hasOther ? "还没有已记住的事项" : "还没有记忆"}
      description="聊天中值得记住的事，会慢慢出现在这里。">
      {onChat && <Button variant="primary" onClick={onChat}>和它聊聊</Button>}
    </EmptyState>}
    {summary?.memories.map(m => <Card key={m.id} className="fish-memory-record">
      <SectionHeading level={3} title={m.subject} description={memoryOrigin(m)} />
      <p className="prewrap">{m.content}</p>
    </Card>)}
  </PageStack>;
}
