import { useState } from "react";
import { SectionCard } from "../../components/PageLayout";
import { Field, Input, Textarea, Button } from "../../components/Controls";
import { api } from "../../api/client";

export function Media({ purpose, fail }: { purpose: "asr" | "tts"; fail: (e: unknown) => void }) {
  const [text, setText] = useState(""), [transcript, setTranscript] = useState(""),
    [voice, setVoice] = useState(""), [audio, setAudio] = useState(""), [busy, setBusy] = useState(false);
  if (purpose === "asr") return <SectionCard level={3} title="试试转写" className="model-preview">
    <Field>选择音频<Input type="file" accept="audio/wav,audio/mpeg,audio/mp4,audio/webm,audio/ogg" disabled={busy} onChange={event => {
      const file = event.target.files?.[0]; if (!file) return;
      if (file.size > 2000000) { fail("AUDIO_BUDGET_EXCEEDED"); return; }
      setBusy(true); setTranscript("");
      void file.arrayBuffer().then(buffer => {
        let raw = ""; for (const byte of new Uint8Array(buffer)) raw += String.fromCharCode(byte);
        return api<{ text: string }>("/v1/media/transcribe", "POST", { mimeType: file.type, data: btoa(raw) });
      }).then(result => setTranscript(result.text)).catch(fail).finally(() => setBusy(false));
    }} /></Field>
    {busy && <p role="status">正在转写…</p>}
    {transcript && <Field>转写结果<Textarea readOnly value={transcript} /></Field>}
  </SectionCard>;
  return <SectionCard level={3} title="试试朗读" className="model-preview">
    <form onSubmit={event => {
      event.preventDefault(); setBusy(true); setAudio("");
      void api<{ data: string; mimeType: string }>("/v1/media/synthesize", "POST", { text, voice }).then(result => setAudio(`data:${result.mimeType};base64,${result.data}`)).catch(fail).finally(() => setBusy(false));
    }}>
      <Field>朗读内容<Textarea value={text} onChange={event => setText(event.target.value)} maxLength={4096} disabled={busy} /></Field>
      <Field>声音名称<Input value={voice} onChange={event => setVoice(event.target.value)} required disabled={busy} /></Field>
      <Button type="submit" busy={busy} disabled={!text || !voice.trim()}>{busy ? "正在生成…" : "试听朗读"}</Button>
    </form>
    {audio && <audio src={audio} controls aria-label="合成朗读" />}
  </SectionCard>;
}
