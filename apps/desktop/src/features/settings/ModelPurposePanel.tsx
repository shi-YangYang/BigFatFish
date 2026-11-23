import { ChevronRight } from "lucide-react";
import type { ModelConfig, ModelPurpose } from "../../../../runtime/src/ai/types";
import { type ModelRoutes, modelPurposes, purposeLabels } from "../../api/model-purposes";
import { ActionRow, Button } from "../../components/Controls";
import { BackButton } from "../../components/BackButton";
import { EmptyState, PageStack, SectionHeading } from "../../components/PageLayout";
import { Media } from "./Media";

export function ModelPurposeMenu({ models, routes, open }: {
  models: ModelConfig[]; routes: ModelRoutes; open: (purpose: ModelPurpose) => void;
}) {
  return <div className="model-purpose-menu" aria-label="模型用途">
    {modelPurposes.map(p => {
      const current = models.find(m => m.id === routes[p]);
      return <Button key={p} variant="ghost" className="model-purpose-link" aria-label={purposeLabels[p]} aria-describedby={`model-current-${p}`} onClick={() => open(p)}>
        <strong>{purposeLabels[p]}</strong><span id={`model-current-${p}`}>{current?.label ?? "未设置"}</span><ChevronRight size={16} aria-hidden="true" />
      </Button>;
    })}
  </div>;
}

export function ModelPurposePanel({ purpose, candidates, currentId, waiting, draft, saved, back, edit, use, fail }: {
  purpose: ModelPurpose; candidates: (ModelConfig & {hasKey:boolean})[]; currentId?: string;
  waiting: boolean; draft?: () => void; saved: string; back: () => void; edit: (model?: ModelConfig) => void;
  use: (id?: string) => void; fail: (e: unknown) => void;
}) {
  return <PageStack className="settings-models">
    <BackButton onClick={back}>模型与声音</BackButton>
    <SectionHeading title={purposeLabels[purpose]} actions={<ActionRow>
      {draft && <Button disabled={waiting} onClick={draft}>继续编辑</Button>}
      <Button variant="primary" disabled={waiting} onClick={() => edit()}>添加模型</Button>
    </ActionRow>} />
    {candidates.length ? <div className="model-list">
      {candidates.map(m => {
        const active = m.id === currentId;
        return <div key={m.id} className="model-row">
          <div className="model-summary"><h3 className="model-name">{m.label}</h3>
            {m.label !== m.model && <small>{m.model}</small>}
            {active && <span className="model-active">使用中</span>}
          </div>
          <ActionRow>
            <Button disabled={waiting} aria-label={active ? `停用 ${m.label}` : `使用 ${m.label}`} onClick={() => use(active ? undefined : m.id)}>{active ? "停用" : "使用"}</Button>
            <Button disabled={waiting} aria-label={`编辑 ${m.label}`} onClick={() => edit(m)}>编辑</Button>
          </ActionRow>
        </div>;
      })}
    </div> : <EmptyState title="尚未添加模型" />}
    {saved && <p role="status">{saved}</p>}
    {purpose !== "chat" && candidates.some(m => m.id === currentId) && <Media key={currentId} purpose={purpose} fail={fail} />}
  </PageStack>;
}
