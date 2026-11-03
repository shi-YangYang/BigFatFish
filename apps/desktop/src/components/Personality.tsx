import { Field, Textarea, Button, FormGrid, ActionRow } from "./Controls";
import { useEffect, useState } from "react";
import type { Persona } from "../../../runtime/src/ai/types";
import { api } from "../api";
export function Personality({ fail }: { fail: (e: unknown) => void }) {
  const [persona, setPersona] = useState<Persona>(),
    [history, setHistory] = useState<Persona[]>([]),
    [saved, setSaved] = useState(false);
  useEffect(() => {
    void api<Persona>("/v1/persona").then(setPersona).catch(fail);
  }, [fail]);
  if (!persona) return <p>正在加载人格…</p>;
  const labels = {
    name: "名字",
    avatar: "头像地址",
    role: "角色设定",
    traits: "基础性格",
    style: "说话风格",
    likes: "喜欢",
    dislikes: "不喜欢",
    boundaries: "行为边界",
    schedule: "作息偏好",
    autonomy: "自主活动偏好",
  };
  return (
    <section>
      <h2>鱼的设定</h2>
      <form
        className="settings"
        onSubmit={(e) => {
          e.preventDefault();
          void api<Persona>("/v1/persona", "PUT", persona)
            .then((value) => {
              setPersona(value);
              setSaved(true);
            })
            .catch(fail);
        }}
      >
        <FormGrid>
          {(Object.keys(labels) as (keyof typeof labels)[]).map((key) => (
            <Field key={key}>
              {labels[key]}
              <Textarea
                aria-label={labels[key]}
                value={persona[key]}
                rows={key === "name" || key === "avatar" ? 1 : 2}
                onChange={(e) => {
                  setPersona({ ...persona, [key]: e.target.value });
                  setSaved(false);
                }}
              />
            </Field>
          ))}
        </FormGrid>
        <ActionRow>
          <Button variant="primary" type="submit">
            保存设定
          </Button>
          <span role="status">
            {saved ? "已保存，下次回复生效" : `版本 ${persona.version}`}
          </span>
        </ActionRow>
      </form>
      <Button
        type="button"
        onClick={() =>
          void api<Persona[]>("/v1/persona/history")
            .then(setHistory)
            .catch(fail)
        }
      >
        查看版本记录
      </Button>
      {history.map((item) => (
        <details key={item.version}>
          <summary>
            版本 {item.version} · {item.name}
          </summary>
          <p>
            {item.role} · {item.traits} · {item.style}
          </p>
          <p>边界：{item.boundaries}</p>
        </details>
      ))}
    </section>
  );
}
