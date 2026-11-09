import { Field, Input, Textarea, Button } from "../../components/Controls";
import { Card } from "../../components/Surfaces";
import { useEffect, useState } from "react";
import { api } from "../../api/client";
export function Media({ fail, configureModel }: { fail: (e: unknown) => void; configureModel: () => void }) {
  const [text, setText] = useState(""), [transcript, setTranscript] = useState(""),
    [voice, setVoice] = useState(""), [audio, setAudio] = useState(""), [busy, setBusy] = useState(false),
    [routes, setRoutes] = useState<{ asr?: string; tts?: string }>(), [loadError, setLoadError] = useState(false);
  useEffect(() => { let active = true; void api<{ asr?: string; tts?: string }>("/v1/model-routes").then(value => { if (active) setRoutes(value); }, () => { if (active) setLoadError(true); }); return () => { active = false; }; }, []);
  const missing = (kind: "asr" | "tts") => <div className="settings-empty">
    <p>{loadError ? "暂时无法读取模型设置。" : !routes ? "正在读取模型设置…" : `先配置${kind === "asr" ? "语音输入" : "朗读"}模型。`}</p>
    {(routes || loadError) && <Button onClick={configureModel}>设置模型</Button>}
  </div>;
  return <section className="page-section">
    <h2>声音</h2>
    <Card><h3>语音输入</h3>
      {!routes?.asr ? missing("asr") : <>
        <Field>选择音频<Input type="file" accept="audio/wav,audio/mpeg,audio/mp4,audio/webm,audio/ogg" disabled={busy} onChange={event => {
          const file = event.target.files?.[0]; if (!file) return;
          if (file.size > 2000000) { fail("AUDIO_BUDGET_EXCEEDED"); return; }
          setBusy(true);
          void file.arrayBuffer().then(buffer => {
            let raw = ""; for (const byte of new Uint8Array(buffer)) raw += String.fromCharCode(byte);
            return api<{ text: string }>("/v1/media/transcribe", "POST", { mimeType: file.type, data: btoa(raw) });
          }).then(result => setTranscript(result.text)).catch(fail).finally(() => setBusy(false));
        }} /></Field>
        {transcript && <Field>转写结果<Textarea readOnly value={transcript} /></Field>}
      </>}
    </Card>
    <Card><h3>朗读</h3>
      {!routes?.tts ? missing("tts") : <form onSubmit={event => {
        event.preventDefault(); setBusy(true);
        void api<{ data: string; mimeType: string }>("/v1/media/synthesize", "POST", { text, voice }).then(result => setAudio(`data:${result.mimeType};base64,${result.data}`)).catch(fail).finally(() => setBusy(false));
      }}>
        <Field>朗读内容<Textarea value={text} onChange={event => setText(event.target.value)} maxLength={4096} disabled={busy} /></Field>
        <Field>声音名称<Input value={voice} onChange={event => setVoice(event.target.value)} required disabled={busy} /></Field>
        <Button type="submit" variant="primary" disabled={busy || !text}>{busy ? "正在生成…" : "试听朗读"}</Button>
      </form>}
      {audio && <audio src={audio} controls aria-label="合成朗读" />}
    </Card>
  </section>;
}
