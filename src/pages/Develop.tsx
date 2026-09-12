import { useEffect, useMemo, useState, type FormEvent } from "react";
import { Bot, Braces, Check, ChevronRight, Code2, KeyRound, Plus, Save, ShieldCheck, Sparkles, Trash2, X } from "lucide-react";
import { useAuth } from "../context/AuthContext";
import {
  createDeveloperBot,
  deleteDeveloperBot,
  reviewDeveloperApplication,
  submitDeveloperApplication,
  subscribeToDeveloperApplication,
  subscribeToDeveloperApplications,
  subscribeToMyDeveloperBots,
  updateDeveloperBot,
} from "../lib/developers";
import { isStaffRole } from "../lib/moderation";
import type { DeveloperApplication, DeveloperBot, DeveloperBotCommand } from "../types";
import Button from "../components/Button";
import DeveloperDebugger from "../components/DeveloperDebugger";
import AccountSecurityPanel from "../components/AccountSecurityPanel";
import { OWNER_EMAIL } from "../lib/moderation";
import { commandsToEduScript, compileEduScript } from "../lib/eduScript";

const emptyApplication = { experience: "", motivation: "", botIdea: "", safetyPlan: "", dataPlan: "" };

function Field({ label, value, onChange, placeholder, rows = 3 }: { label: string; value: string; onChange: (value: string) => void; placeholder: string; rows?: number }) {
  return <label className="block"><span className="mb-1.5 block text-xs font-semibold text-white/60">{label}</span><textarea value={value} onChange={(event) => onChange(event.target.value)} rows={rows} maxLength={600} required placeholder={placeholder} className="w-full resize-none rounded-xl border border-white/10 bg-black/20 px-4 py-3 text-sm text-white outline-none placeholder:text-white/22 focus:border-brand-400/60"/></label>;
}

function BotEditor({ bot, onSaved, onDeleted }: { bot: DeveloperBot; onSaved: (bot: DeveloperBot) => void; onDeleted: () => void }) {
  const [draft, setDraft] = useState(bot);
  const [editorMode, setEditorMode] = useState<"easy" | "form">("easy");
  const [easyCode, setEasyCode] = useState(() => commandsToEduScript(bot.commands));
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState("");
  useEffect(() => {
    try {
      const saved = localStorage.getItem(`edushare-bot-draft:${bot.id}`);
      const stored = saved ? JSON.parse(saved) : null;
      const restored = stored ? { ...bot, ...stored, id: bot.id, ownerId: bot.ownerId } : bot;
      setDraft(restored);
      setEasyCode(typeof stored?.easyCode === "string" && stored.easyCode.includes("def ") ? stored.easyCode : commandsToEduScript(restored.commands));
      if (saved) setNotice("Local draft restored.");
    } catch { setDraft(bot); }
  }, [bot]);
  useEffect(() => {
    const timeout = window.setTimeout(() => localStorage.setItem(`edushare-bot-draft:${bot.id}`, JSON.stringify({ name: draft.name, handle: draft.handle, description: draft.description, avatarUrl: draft.avatarUrl, enabled: draft.enabled, verificationEnabled: draft.verificationEnabled, prefix: draft.prefix, commands: draft.commands, easyCode })), 350);
    return () => window.clearTimeout(timeout);
  }, [bot.id, draft, easyCode]);
  const set = <K extends keyof DeveloperBot>(key: K, value: DeveloperBot[K]) => setDraft((current) => ({ ...current, [key]: value }));
  const setCommand = (index: number, key: keyof DeveloperBotCommand, value: string) => set("commands", draft.commands.map((command, itemIndex) => itemIndex === index ? { ...command, [key]: value } : command));

  async function save() {
    const compiled = editorMode === "easy" ? compileEduScript(easyCode) : null;
    if (compiled?.errors.length) return setNotice(compiled.errors[0]);
    const prepared = compiled
      ? { ...draft, commands: compiled.commands, verificationEnabled: compiled.commands.some((command) => command.action === "verify") }
      : { ...draft, verificationEnabled: draft.commands.some((command) => command.action === "verify") };
    if (!prepared.name.trim() || !prepared.handle.trim()) return setNotice("Bot name and handle are required.");
    if (!prepared.commands.some((command) => command.name.trim() && command.response.trim())) return setNotice("Add at least one complete command.");
    setSaving(true); setNotice("");
    try { await updateDeveloperBot(bot, prepared); setDraft(prepared); localStorage.removeItem(`edushare-bot-draft:${bot.id}`); onSaved(prepared); setNotice("Changes saved."); }
    catch (error) { setNotice(error instanceof Error ? error.message : "Could not save the bot."); }
    finally { setSaving(false); }
  }

  async function remove() {
    if (!window.confirm(`Delete ${bot.name}? This cannot be undone.`)) return;
    await deleteDeveloperBot(bot); localStorage.removeItem(`edushare-bot-draft:${bot.id}`); onDeleted();
  }

  return <section className="overflow-hidden rounded-2xl border border-white/10 bg-[#11151d]/90">
    <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/8 px-5 py-4">
      <div className="flex items-center gap-3">{draft.avatarUrl ? <img src={draft.avatarUrl} alt="" className="h-11 w-11 rounded-xl object-cover"/> : <span className="grid h-11 w-11 place-items-center rounded-xl bg-brand-500/15 text-brand-300"><Bot/></span>}<div><h2 className="font-bold text-white">{draft.name || "Untitled bot"}</h2><p className="font-mono text-xs text-white/35">@{draft.handle || "handle"} · App ID {bot.id}</p></div></div>
      <label className="flex cursor-pointer items-center gap-2 text-xs font-semibold text-white/55"><span>{draft.enabled ? "Live" : "Disabled"}</span><input type="checkbox" checked={draft.enabled} onChange={(event) => set("enabled", event.target.checked)} className="h-4 w-4 accent-indigo-500"/></label>
    </div>
    <div className="grid gap-5 p-5 lg:grid-cols-[1fr_.85fr]">
      <div className="space-y-4">
        <div className="grid gap-3 sm:grid-cols-2"><label className="text-xs font-semibold text-white/55">Bot name<input value={draft.name} onChange={(event) => set("name", event.target.value)} maxLength={32} className="mt-1.5 w-full rounded-xl border border-white/10 bg-black/20 px-3 py-2.5 text-sm text-white outline-none focus:border-brand-400/60"/></label><label className="text-xs font-semibold text-white/55">Mention handle<input value={draft.handle} onChange={(event) => set("handle", event.target.value.toLowerCase().replace(/[^a-z0-9_]/g, ""))} maxLength={24} className="mt-1.5 w-full rounded-xl border border-white/10 bg-black/20 px-3 py-2.5 font-mono text-sm text-white outline-none focus:border-brand-400/60"/></label></div>
        <label className="block text-xs font-semibold text-white/55">Description<textarea value={draft.description} onChange={(event) => set("description", event.target.value)} maxLength={160} rows={2} className="mt-1.5 w-full resize-none rounded-xl border border-white/10 bg-black/20 px-3 py-2.5 text-sm text-white outline-none focus:border-brand-400/60"/></label>
        <label className="block text-xs font-semibold text-white/55">Avatar image URL<input value={draft.avatarUrl} onChange={(event) => set("avatarUrl", event.target.value)} maxLength={500} placeholder="https://…" className="mt-1.5 w-full rounded-xl border border-white/10 bg-black/20 px-3 py-2.5 text-sm text-white outline-none placeholder:text-white/20 focus:border-brand-400/60"/></label>
        <div className="rounded-xl border border-brand-400/15 bg-brand-500/5 p-4"><div className="flex items-center gap-2 text-sm font-semibold text-brand-200"><KeyRound size={15}/>How people invoke it</div><p className="mt-2 text-xs leading-5 text-white/45">Type <code className="rounded bg-black/30 px-1.5 py-0.5 text-white/70">@{draft.handle || "bot"} hello</code> or <code className="rounded bg-black/30 px-1.5 py-0.5 text-white/70">/{draft.handle || "bot"} hello</code> in Global Chat. Responses may use <code className="text-brand-200">{'{user}'}</code> and <code className="text-brand-200">{'{args}'}</code>.</p><div className="mt-3 rounded-lg border border-white/[.07] bg-black/20 p-3 text-xs leading-5 text-white/50"><p className="font-semibold text-white/75">What does <code className="text-brand-200">{'{args}'}</code> mean?</p><p className="mt-1">It inserts everything the person types after the command. If they type <code className="text-white/75">/{draft.handle || "bot"} hello Steve</code>, a response template of <code className="text-white/75">Hello {'{args}'}!</code> becomes <code className="text-emerald-300">Hello Steve!</code></p><p className="mt-1"><code className="text-brand-200">{'{user}'}</code> inserts the name of the person using the command.</p></div><select value={draft.prefix} onChange={(event) => set("prefix", event.target.value)} className="mt-3 rounded-lg border border-white/10 bg-[#11151d] px-3 py-2 text-sm text-white"><option>?</option><option>.</option><option>$</option><option>/</option></select><p className="mt-2 text-[10px] text-white/25">Draft changes autosave locally on this device.</p></div>
      </div>
      <div>
        <div className="mb-3 flex items-center justify-between gap-2"><h3 className="flex items-center gap-2 text-sm font-bold text-white"><Braces size={15} className="text-brand-300"/>Bot logic</h3><div className="flex rounded-lg border border-white/10 bg-black/20 p-1"><button type="button" onClick={() => { setEditorMode("easy"); setEasyCode(commandsToEduScript(draft.commands)); }} className={`rounded-md px-2.5 py-1 text-[11px] font-bold ${editorMode === "easy" ? "bg-brand-500 text-white" : "text-white/35"}`}>EduPy</button><button type="button" onClick={() => { const compiled = compileEduScript(easyCode); if (!compiled.errors.length) set("commands", compiled.commands); setEditorMode("form"); }} className={`rounded-md px-2.5 py-1 text-[11px] font-bold ${editorMode === "form" ? "bg-brand-500 text-white" : "text-white/35"}`}>Form</button></div></div>
        {editorMode === "easy" ? <div><div className="rounded-xl border border-emerald-400/15 bg-emerald-400/[.04] p-3"><p className="text-xs font-bold text-emerald-200">EduPy — safe Python-style commands</p><p className="mt-1 text-[11px] leading-5 text-white/40"><code className="text-violet-200">def</code> creates a command. You can assign simple string variables, then <code className="text-cyan-200">return</code> a string or variable. Use <code className="text-brand-200">{'{user}'}</code> and <code className="text-brand-200">{'{args}'}</code> inside replies.</p><button type="button" onClick={() => { if (!easyCode.includes("@verify")) setEasyCode((code) => `${code.trim()}\n\n@verify\ndef verify(user, args):\n    reply = f\"Verified {user}!\"\n    return reply`.trim()); }} className="mt-3 rounded-lg border border-emerald-300/20 bg-emerald-400/10 px-3 py-1.5 text-[11px] font-bold text-emerald-200 hover:bg-emerald-400/15">+ Add verification command</button></div><textarea value={easyCode} onChange={(event) => setEasyCode(event.target.value)} spellCheck={false} aria-label="EduPy code" className="mt-3 min-h-[310px] w-full resize-y rounded-xl border border-white/10 bg-[#080b10] p-4 font-mono text-xs leading-6 text-white/80 outline-none focus:border-brand-400/55" placeholder={'def hello(user, args):\n    reply = f"Hey {user}, you said {args}"\n    return reply\n\n@verify\ndef verify(user, args):\n    return f"Verified {user}!"'}/>{(() => { const result = compileEduScript(easyCode); const verifies = result.commands.some((command) => command.action === "verify"); return <div className={`mt-2 rounded-lg px-3 py-2 text-[11px] ${result.errors.length ? "bg-red-500/10 text-red-200" : "bg-emerald-500/10 text-emerald-200"}`}>{result.errors[0] ?? `${result.commands.length} command${result.commands.length === 1 ? "" : "s"} ready to save${verifies ? " · verification enabled" : ""}.`}</div>; })()}</div> : <><div className="mb-2 flex justify-end"><button type="button" disabled={draft.commands.length >= 12} onClick={() => set("commands", [...draft.commands, { name: "", response: "", action: "reply" }])} className="cursor-target flex items-center gap-1 rounded-lg px-2 py-1 text-xs text-brand-300 hover:bg-brand-500/10 disabled:opacity-30"><Plus size={12}/>Add command</button></div><div className="max-h-[390px] space-y-2 overflow-y-auto pr-1">{draft.commands.map((command, index) => <div key={index} className="rounded-xl border border-white/8 bg-black/20 p-3"><div className="flex gap-2"><input value={command.name} onChange={(event) => setCommand(index, "name", event.target.value.toLowerCase().replace(/[^a-z0-9_-]/g, ""))} placeholder="command" maxLength={24} className="min-w-0 flex-1 rounded-lg border border-white/8 bg-black/20 px-2.5 py-2 font-mono text-xs text-white outline-none focus:border-brand-400/50"/><select value={command.action ?? "reply"} onChange={(event) => set("commands", draft.commands.map((item, itemIndex) => itemIndex === index ? { ...item, action: event.target.value === "verify" ? "verify" : "reply" } : item))} className="rounded-lg border border-white/8 bg-[#11151d] px-2 text-[11px] text-white"><option value="reply">Reply</option><option value="verify">Verify</option></select><button type="button" aria-label="Remove command" onClick={() => set("commands", draft.commands.filter((_, itemIndex) => itemIndex !== index))} className="rounded-lg p-2 text-white/25 hover:bg-red-500/10 hover:text-red-300"><X size={14}/></button></div><textarea value={command.response} onChange={(event) => setCommand(index, "response", event.target.value)} placeholder="Response text" maxLength={300} rows={2} className="mt-2 w-full resize-none rounded-lg border border-white/8 bg-black/20 px-2.5 py-2 text-xs text-white outline-none focus:border-brand-400/50"/></div>)}</div></>}
      </div>
    </div>
    <div className="flex flex-wrap items-center justify-between gap-3 border-t border-white/8 px-5 py-4"><button type="button" onClick={remove} className="flex items-center gap-2 text-xs font-semibold text-red-300/70 hover:text-red-300"><Trash2 size={14}/>Delete bot</button><div className="flex items-center gap-3">{notice && <span className={`text-xs ${notice === "Changes saved." ? "text-emerald-300" : "text-amber-300"}`}>{notice}</span>}<Button onClick={save} disabled={saving}><Save size={14}/>{saving ? "Saving…" : "Save changes"}</Button></div></div>
  </section>;
}

export default function Develop() {
  const { user, role } = useAuth();
  const ownerDebugAccess = user?.email?.trim().toLowerCase() === OWNER_EMAIL;
  const isStaff = ownerDebugAccess || isStaffRole(role);
  const [application, setApplication] = useState<DeveloperApplication | null>(null);
  const [applications, setApplications] = useState<DeveloperApplication[]>([]);
  const [bots, setBots] = useState<DeveloperBot[]>([]);
  const [selectedId, setSelectedId] = useState("");
  const [form, setForm] = useState(emptyApplication);
  const [newBotName, setNewBotName] = useState("");
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);
  useEffect(() => user ? subscribeToDeveloperApplication(user.uid, setApplication) : undefined, [user]);
  useEffect(() => user ? subscribeToMyDeveloperBots(user.uid, setBots, () => setNotice("Could not load your bots. Check your connection and refresh.")) : undefined, [user]);
  useEffect(() => isStaff ? subscribeToDeveloperApplications(setApplications) : undefined, [isStaff]);
  useEffect(() => { if (!selectedId && bots[0]) setSelectedId(bots[0].id); if (selectedId && !bots.some((bot) => bot.id === selectedId)) setSelectedId(bots[0]?.id ?? ""); }, [bots, selectedId]);
  const selected = bots.find((bot) => bot.id === selectedId) ?? null;
  const approved = isStaff || role === "dabug" || application?.status === "approved";
  const pending = useMemo(() => applications.filter((item) => item.status === "pending"), [applications]);

  async function apply(event: FormEvent) {
    event.preventDefault(); if (!user) return; setBusy(true); setNotice("");
    try { await submitDeveloperApplication({ userId: user.uid, applicantName: user.displayName || "Member", applicantEmail: user.email || "", ...form }); setNotice("Application sent to the staff review queue."); }
    catch (error) { setNotice(error instanceof Error ? error.message : "Could not submit your application."); }
    finally { setBusy(false); }
  }
  async function createBot(event: FormEvent) {
    event.preventDefault(); if (!user || bots.length >= 5 || !newBotName.trim()) return; setBusy(true); setNotice("");
    try { const ref = await createDeveloperBot(user.uid, user.displayName || "Developer", newBotName); setSelectedId(ref.id); setNewBotName(""); }
    catch (error) { setNotice(error instanceof Error ? error.message : "Could not create the bot."); }
    finally { setBusy(false); }
  }

  return <div className="mx-auto w-full max-w-7xl px-4 py-8 sm:px-6 lg:py-12">
    <section className="relative overflow-hidden rounded-3xl border border-brand-400/20 bg-[#0b1020]/90 px-6 py-10 sm:px-10">
      <div className="absolute -right-24 -top-36 h-80 w-80 rounded-full bg-violet-500/20 blur-3xl"/><div className="absolute bottom-0 left-1/3 h-40 w-72 rounded-full bg-cyan-500/10 blur-3xl"/>
      <div className="relative max-w-3xl"><span className="inline-flex items-center gap-2 rounded-full border border-brand-300/20 bg-brand-500/10 px-3 py-1 font-mono text-[11px] uppercase tracking-[.18em] text-brand-200"><Sparkles size={12}/>SpawnDex Developer Platform</span><h1 className="mt-5 text-3xl font-black tracking-tight text-white sm:text-5xl">Build the next helpful bot.</h1><p className="mt-4 max-w-2xl text-sm leading-7 text-white/55 sm:text-base">Apply for developer access, create bot identities, and ship interactive commands to Global Chat—without exposing member data or impersonating users.</p><div className="mt-6 flex flex-wrap gap-3 text-xs text-white/45"><span className="flex items-center gap-1.5"><ShieldCheck size={14} className="text-emerald-300"/>Staff-reviewed developers</span><span className="flex items-center gap-1.5"><Code2 size={14} className="text-violet-300"/>Up to 12 commands per bot</span><span className="flex items-center gap-1.5"><Bot size={14} className="text-cyan-300"/>Distinct APP identity</span>{ownerDebugAccess && <span className="flex items-center gap-1.5 rounded-full border border-amber-300/20 bg-amber-400/10 px-2 py-0.5 font-bold text-amber-200"><KeyRound size={13}/>Owner debugging mode</span>}</div></div>
    </section>

    {user && <AccountSecurityPanel user={user} bots={bots}/>} 

    {isStaff && <section className="mt-6 rounded-2xl border border-white/10 bg-[#11151d]/90 p-5"><div className="mb-4 flex items-center justify-between"><div><h2 className="font-bold text-white">Developer review queue</h2><p className="mt-1 text-xs text-white/35">Approve only applications with a clear safety and data plan.</p></div><span className="rounded-full bg-amber-500/10 px-2.5 py-1 text-xs font-bold text-amber-200">{pending.length} pending</span></div>{pending.length === 0 ? <p className="rounded-xl border border-dashed border-white/10 py-8 text-center text-sm text-white/30">Queue clear.</p> : <div className="space-y-3">{pending.map((item) => <details key={item.id} className="rounded-xl border border-white/8 bg-black/15 p-4"><summary className="cursor-pointer list-none"><div className="flex items-center justify-between gap-4"><div><p className="font-semibold text-white">{item.applicantName}</p><p className="text-xs text-white/35">{item.applicantEmail}</p></div><ChevronRight size={16} className="text-white/30"/></div></summary><div className="mt-4 grid gap-3 text-xs text-white/55 sm:grid-cols-2"><p><b className="block text-white/75">Bot idea</b>{item.botIdea}</p><p><b className="block text-white/75">Experience</b>{item.experience}</p><p><b className="block text-white/75">Safety</b>{item.safetyPlan}</p><p><b className="block text-white/75">Data handling</b>{item.dataPlan}</p></div><div className="mt-4 flex gap-2"><Button size="sm" onClick={() => user && reviewDeveloperApplication(item, "approved", user.uid)}><Check size={13}/>Approve</Button><Button size="sm" variant="secondary" onClick={() => user && reviewDeveloperApplication(item, "rejected", user.uid)}><X size={13}/>Reject</Button></div></details>)}</div>}</section>}

    {!approved && application?.status === "pending" && <section className="mx-auto mt-8 max-w-2xl rounded-2xl border border-amber-300/20 bg-amber-400/5 p-8 text-center"><ShieldCheck className="mx-auto text-amber-200" size={34}/><h2 className="mt-4 text-xl font-bold text-white">Application under review</h2><p className="mt-2 text-sm leading-6 text-white/45">Staff will review your bot idea, safety plan, and data handling. You’ll get a notification when a decision is made.</p></section>}

    {!approved && application?.status !== "pending" && <form onSubmit={apply} className="mx-auto mt-8 max-w-3xl rounded-2xl border border-white/10 bg-[#11151d]/90 p-6 sm:p-8"><div className="mb-6"><h2 className="text-xl font-bold text-white">Apply to become a developer</h2><p className="mt-2 text-sm text-white/40">Tell staff what you want to build. Thoughtful answers make approval easier.</p>{application?.status === "rejected" && <p className="mt-3 rounded-lg bg-red-500/10 px-3 py-2 text-xs text-red-200">Your last application was not approved. You can revise and reapply.</p>}</div><div className="space-y-4"><Field label="Your development experience" value={form.experience} onChange={(value) => setForm({ ...form, experience: value })} placeholder="What have you built before? Beginners are welcome."/><Field label="Why do you want developer access?" value={form.motivation} onChange={(value) => setForm({ ...form, motivation: value })} placeholder="How will your bot help the community?"/><Field label="Your first bot idea" value={form.botIdea} onChange={(value) => setForm({ ...form, botIdea: value })} placeholder="Describe its commands and behavior."/><Field label="Safety and moderation plan" value={form.safetyPlan} onChange={(value) => setForm({ ...form, safetyPlan: value })} placeholder="How will you prevent spam, abuse, and unsafe output?"/><Field label="Member data plan" value={form.dataPlan} onChange={(value) => setForm({ ...form, dataPlan: value })} placeholder="What data does it need, and what will you never collect?"/></div><div className="mt-6 flex items-center justify-between gap-4"><p className="text-[11px] leading-5 text-white/30">Developer access can be revoked for spam, impersonation, or misuse of member data.</p><Button type="submit" disabled={busy}>{busy ? "Sending…" : "Submit application"}</Button></div>{notice && <p className="mt-3 text-xs text-amber-200">{notice}</p>}</form>}

    {approved && <div className="mt-8 grid gap-6 lg:grid-cols-[260px_1fr]"><aside className="h-fit rounded-2xl border border-white/10 bg-[#11151d]/90 p-3 lg:sticky lg:top-24"><div className="flex items-center justify-between px-2 py-2"><span className="text-xs font-bold uppercase tracking-[.16em] text-white/35">My bots</span><span className="text-[10px] text-white/25">{bots.length}/5</span></div><div className="space-y-1">{bots.map((bot) => <button key={bot.id} type="button" onClick={() => setSelectedId(bot.id)} className={`flex w-full items-center gap-2.5 rounded-xl px-3 py-2.5 text-left ${bot.id === selectedId ? "bg-brand-500/18 text-white" : "text-white/50 hover:bg-white/5 hover:text-white"}`}>{bot.avatarUrl ? <img src={bot.avatarUrl} alt="" className="h-8 w-8 rounded-lg object-cover"/> : <span className="grid h-8 w-8 place-items-center rounded-lg bg-white/5"><Bot size={15}/></span>}<span className="min-w-0 flex-1"><span className="block truncate text-sm font-semibold">{bot.name}</span><span className="block truncate font-mono text-[10px] opacity-50">@{bot.handle}</span></span><span className={`h-2 w-2 rounded-full ${bot.enabled ? "bg-emerald-400" : "bg-white/20"}`}/></button>)}</div><form onSubmit={createBot} className="mt-3 border-t border-white/8 px-1 pt-3"><input value={newBotName} onChange={(event) => setNewBotName(event.target.value)} disabled={busy || bots.length >= 5} maxLength={32} placeholder={bots.length >= 5 ? "Bot limit reached" : "New bot name"} className="w-full rounded-lg border border-white/10 bg-black/20 px-3 py-2 text-xs text-white outline-none placeholder:text-white/25 focus:border-brand-400/50"/><Button type="submit" size="sm" className="mt-2 w-full" disabled={busy || bots.length >= 5 || !newBotName.trim()}><Plus size={13}/>{busy ? "Creating…" : "Create bot"}</Button>{notice && <p role="alert" className="mt-2 px-1 text-xs leading-5 text-amber-200">{notice}</p>}</form></aside><main>{selected ? <><BotEditor bot={selected} onSaved={() => undefined} onDeleted={() => setSelectedId("")}/><DeveloperDebugger bot={selected} userName={user?.displayName || "Developer"}/></> : <div className="grid min-h-96 place-items-center rounded-2xl border border-dashed border-white/10 bg-[#11151d]/60 p-8 text-center"><div><Bot size={40} className="mx-auto text-white/15"/><h2 className="mt-4 font-bold text-white/70">Create your first bot</h2><p className="mt-2 max-w-sm text-sm text-white/35">Name it on the left and choose Create bot. Then add commands, test it in Global Chat, and switch it live.</p></div></div>}<p className="mt-4 rounded-xl border border-cyan-400/10 bg-cyan-500/5 px-4 py-3 text-xs leading-5 text-white/40"><b className="text-cyan-200">Platform note:</b> this release supports safe, built-in SpawnDex command bots. External webhooks and HTTP bot tokens are intentionally not enabled yet.</p></main></div>}
  </div>;
}
