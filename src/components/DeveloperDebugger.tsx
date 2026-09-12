import { useEffect, useMemo, useState } from "react";
import { Activity, AlertTriangle, BarChart3, Bug, CheckCircle2, FlaskConical, Gauge, History, ShieldCheck } from "lucide-react";
import { subscribeToDeveloperBotEvents } from "../lib/developers";
import type { DeveloperBot, DeveloperBotEvent } from "../types";

function formatTime(value: number) {
  return new Date(value).toLocaleString([], { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
}

export default function DeveloperDebugger({ bot, userName }: { bot: DeveloperBot; userName: string }) {
  const [events, setEvents] = useState<DeveloperBotEvent[]>([]);
  const [testCommand, setTestCommand] = useState(bot.commands[0]?.name ?? "");
  const [testArgs, setTestArgs] = useState("");
  const [preview, setPreview] = useState("");
  useEffect(() => subscribeToDeveloperBotEvents(bot.id, setEvents), [bot.id]);
  useEffect(() => { setTestCommand(bot.commands[0]?.name ?? ""); setPreview(""); }, [bot.id, bot.commands]);
  const stats = useMemo(() => {
    const successes = events.filter((event) => event.status === "success");
    return {
      runs: events.length,
      successRate: events.length ? Math.round((successes.length / events.length) * 100) : 100,
      averageLatency: successes.length ? Math.round(successes.reduce((sum, event) => sum + event.latencyMs, 0) / successes.length) : 0,
      failures: events.filter((event) => event.status === "failed" || event.status === "unknown_command").length,
    };
  }, [events]);
  const checks = [
    { label: "Bot is enabled", ok: bot.enabled },
    { label: "Unique mention handle", ok: /^[a-z0-9_]{1,24}$/.test(bot.handle) },
    { label: "Avatar configured", ok: /^https:\/\//.test(bot.avatarUrl) },
    { label: "Description explains its purpose", ok: bot.description.length >= 20 },
    { label: "Every command has a response", ok: bot.commands.length > 0 && bot.commands.every((command) => command.name && command.response) },
  ];

  function runSandbox() {
    const command = bot.commands.find((item) => item.name === testCommand);
    setPreview(command ? command.response.replace(/\{user\}/gi, userName).replace(/\{args\}/gi, testArgs) : "Unknown command.");
  }

  return <section className="mt-5 overflow-hidden rounded-2xl border border-violet-400/15 bg-[#11151d]/90">
    <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/8 px-5 py-4"><div><h2 className="flex items-center gap-2 font-bold text-white"><Bug size={17} className="text-violet-300"/>Application debugger</h2><p className="mt-1 text-xs text-white/35">Sandbox, health checks, telemetry, and execution history for @{bot.handle}.</p></div><span className={`rounded-full px-2.5 py-1 text-[10px] font-bold uppercase ${checks.every((check) => check.ok) ? "bg-emerald-500/10 text-emerald-300" : "bg-amber-500/10 text-amber-200"}`}>{checks.every((check) => check.ok) ? "Healthy" : "Needs attention"}</span></div>
    <div className="grid gap-5 p-5 xl:grid-cols-2">
      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">{[{ icon: Activity, label: "Runs", value: stats.runs }, { icon: Gauge, label: "Success", value: `${stats.successRate}%` }, { icon: BarChart3, label: "Avg latency", value: `${stats.averageLatency}ms` }, { icon: AlertTriangle, label: "Errors", value: stats.failures }].map((item) => <div key={item.label} className="rounded-xl border border-white/8 bg-black/20 p-3"><item.icon size={14} className="text-brand-300"/><p className="mt-2 text-lg font-black text-white">{item.value}</p><p className="text-[10px] text-white/35">{item.label}</p></div>)}</div>
        <div className="rounded-xl border border-white/8 bg-black/15 p-4"><h3 className="flex items-center gap-2 text-sm font-bold text-white"><ShieldCheck size={15} className="text-emerald-300"/>Preflight checks</h3><div className="mt-3 space-y-2">{checks.map((check) => <div key={check.label} className="flex items-center gap-2 text-xs"><span className={check.ok ? "text-emerald-300" : "text-amber-300"}>{check.ok ? <CheckCircle2 size={14}/> : <AlertTriangle size={14}/>}</span><span className={check.ok ? "text-white/55" : "text-amber-100/75"}>{check.label}</span></div>)}</div></div>
        <div className="rounded-xl border border-brand-400/15 bg-brand-500/5 p-4"><h3 className="flex items-center gap-2 text-sm font-bold text-white"><FlaskConical size={15} className="text-brand-300"/>Command sandbox</h3><div className="mt-3 flex gap-2"><select value={testCommand} onChange={(event) => setTestCommand(event.target.value)} className="rounded-lg border border-white/10 bg-[#11151d] px-3 py-2 text-xs text-white">{bot.commands.map((command) => <option key={command.name}>{command.name}</option>)}</select><input value={testArgs} onChange={(event) => setTestArgs(event.target.value)} placeholder="Test arguments" className="min-w-0 flex-1 rounded-lg border border-white/10 bg-black/20 px-3 py-2 text-xs text-white outline-none"/><button type="button" onClick={runSandbox} className="rounded-lg bg-brand-500 px-3 py-2 text-xs font-bold text-white">Run</button></div>{preview && <div className="mt-3 rounded-lg border border-white/8 bg-black/25 p-3 text-sm text-white/70"><span className="mr-2 rounded bg-indigo-500/20 px-1.5 py-0.5 font-mono text-[9px] font-bold text-indigo-300">APP</span>{preview}</div>}</div>
      </div>
      <div className="rounded-xl border border-white/8 bg-black/15 p-4"><h3 className="flex items-center gap-2 text-sm font-bold text-white"><History size={15} className="text-cyan-300"/>Recent executions</h3>{events.length === 0 ? <p className="py-12 text-center text-xs text-white/25">No live commands yet. Sandbox tests stay local and do not affect analytics.</p> : <div className="mt-3 max-h-[440px] space-y-2 overflow-y-auto">{events.slice(0, 30).map((event) => <div key={event.id} className="flex items-center gap-3 rounded-lg border border-white/5 bg-black/20 px-3 py-2"><span className={`h-2 w-2 rounded-full ${event.status === "success" ? "bg-emerald-400" : event.status === "rate_limited" ? "bg-amber-400" : "bg-red-400"}`}/><div className="min-w-0 flex-1"><p className="truncate font-mono text-xs text-white/70">/{event.command} <span className="font-sans text-white/30">by {event.invokedByName}</span></p><p className="text-[10px] text-white/25">{formatTime(event.createdAt)}</p></div><span className="text-[10px] text-white/30">{event.latencyMs}ms</span></div>)}</div>}</div>
    </div>
  </section>;
}
