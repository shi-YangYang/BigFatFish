import { Field, Input, Textarea, Button } from "../../components/Controls";
import { useState } from "react";
import { api } from "../../api/client";
export function Media({ fail }: { fail: (e: unknown) => void }) {
  const [text, setText] = useState(""),
    [voice, setVoice] = useState(""),
    [audio, setAudio] = useState(""),
    [busy, setBusy] = useState(false);
  return (
    <section className="page-section">
      <h2>语音</h2>
      <Field>
        音频转写
        <Input
          type="file"
          accept="audio/wav,audio/mpeg,audio/mp4,audio/webm,audio/ogg"
          disabled={busy}
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (!f) return;
            if (f.size > 2000000) {
              fail("AUDIO_BUDGET_EXCEEDED");
              return;
            }
            setBusy(true);
            void f
              .arrayBuffer()
              .then((b) => {
                let raw = "";
                for (const n of new Uint8Array(b))
                  raw += String.fromCharCode(n);
                return api<{ text: string }>("/v1/media/transcribe", "POST", {
                  mimeType: f.type,
                  data: btoa(raw),
                });
              })
              .then((r) => setText(r.text))
              .catch(fail)
              .finally(() => setBusy(false));
          }}
        />
      </Field>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          setBusy(true);
          void api<{ data: string; mimeType: string }>(
            "/v1/media/synthesize",
            "POST",
            { text, voice },
          )
            .then((r) => setAudio(`data:${r.mimeType};base64,${r.data}`))
            .catch(fail)
            .finally(() => setBusy(false));
        }}
      >
        <Field>
          文字
          <Textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            maxLength={4096}
          />
        </Field>
        <Field>
          声音名称
          <Input
            value={voice}
            onChange={(e) => setVoice(e.target.value)}
            required
          />
        </Field>
        <Button type="submit" variant="primary" disabled={busy || !text}>
          生成 AI 合成语音
        </Button>
      </form>
      {audio && (
        <>
          <p>AI 合成音频</p>
          <audio src={audio} controls />
        </>
      )}
    </section>
  );
}
