import { CheckCircle2, ExternalLink, ShieldCheck } from "lucide-react";
import { useState } from "react";
import type { DeveloperBotPanel } from "../types";

export default function BotMessagePanel({ panel, onVerify }: { panel: DeveloperBotPanel; onVerify?: () => Promise<void> }) {
  const [state, setState] = useState<"idle" | "busy" | "done" | "error">("idle");
  const color = /^#[0-9a-f]{6}$/i.test(panel.color ?? "") ? panel.color! : "#5865f2";

  async function verify() {
    if (!onVerify || state === "busy" || state === "done") return;
    setState("busy");
    try { await onVerify(); setState("done"); }
    catch { setState("error"); }
  }

  return <section className="mt-2 max-w-xl overflow-hidden rounded-md border border-white/10 bg-[#2b2d31] shadow-lg" style={{ borderLeft: `4px solid ${color}` }}>
    <div className="p-4">
      <div className="flex items-center gap-2"><ShieldCheck size={17} style={{ color }}/><h4 className="font-bold text-white">{panel.title}</h4></div>
      {panel.description && <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-[#dbdee1]">{panel.description}</p>}
      {!!panel.fields?.length && <div className="mt-3 grid gap-3 sm:grid-cols-2">{panel.fields.map((field, index) => <div key={`${field.name}-${index}`} className={field.inline ? "" : "sm:col-span-2"}><p className="text-xs font-bold text-white">{field.name}</p><p className="mt-0.5 whitespace-pre-wrap text-sm text-[#b5bac1]">{field.value}</p></div>)}</div>}
      {panel.button?.action === "link" && panel.button.url && <a href={panel.button.url} target="_blank" rel="noopener noreferrer" className="mt-4 inline-flex items-center gap-2 rounded bg-[#5865f2] px-4 py-2 text-sm font-bold text-white hover:bg-[#4752c4]">{panel.button.label}<ExternalLink size={14}/></a>}
      {panel.button?.action === "verify" && <button type="button" onClick={() => void verify()} disabled={!onVerify || state === "busy" || state === "done"} className="mt-4 inline-flex items-center gap-2 rounded bg-[#5865f2] px-4 py-2 text-sm font-bold text-white hover:bg-[#4752c4] disabled:opacity-60">{state === "done" ? <CheckCircle2 size={14}/> : <ShieldCheck size={14}/>} {state === "done" ? "Verified" : state === "busy" ? "Verifying…" : state === "error" ? "Try again" : panel.button.label}</button>}
    </div>
  </section>;
}
