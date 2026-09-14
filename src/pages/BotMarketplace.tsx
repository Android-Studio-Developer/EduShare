import { useEffect, useMemo, useState } from "react";
import { Bot, Check, ChevronLeft, Plus, Search, Server, ShieldCheck, Sparkles } from "lucide-react";
import { Link } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { subscribeToCommunityChatServers, updateCommunityChatServer } from "../lib/communityChatServers";
import { subscribeToDeveloperBots } from "../lib/developers";
import { isStaffRole } from "../lib/moderation";
import type { CommunityChatServer, DeveloperBot } from "../types";

export default function BotMarketplace() {
  const { user, role } = useAuth();
  const [bots, setBots] = useState<DeveloperBot[]>([]);
  const [servers, setServers] = useState<CommunityChatServer[]>([]);
  const [serverId, setServerId] = useState("");
  const [search, setSearch] = useState("");
  const [busy, setBusy] = useState("");
  const [notice, setNotice] = useState("");
  useEffect(() => subscribeToDeveloperBots(setBots), []);
  useEffect(() => subscribeToCommunityChatServers(setServers), []);
  const manageable = useMemo(() => servers.filter((server) => server.ownerId === user?.uid || isStaffRole(role)), [role, servers, user]);
  useEffect(() => { if (!serverId && manageable[0]) setServerId(manageable[0].id); }, [manageable, serverId]);
  const selected = manageable.find((server) => server.id === serverId);
  const listed = bots.filter((bot) => bot.enabled && (!search.trim() || `${bot.name} ${bot.handle} ${bot.description}`.toLowerCase().includes(search.toLowerCase())));

  async function toggle(bot: DeveloperBot) {
    if (!selected || busy) return;
    setBusy(bot.id); setNotice("");
    try {
      const installed = selected.botIds?.includes(bot.id);
      const botIds = installed ? selected.botIds.filter((id) => id !== bot.id) : [...new Set([...(selected.botIds ?? []), bot.id])].slice(0, 12);
      await updateCommunityChatServer(selected.id, { botIds });
      setNotice(installed ? `${bot.name} removed.` : `${bot.name} added. Use /${bot.handle} command in the server.`);
    } catch (error) { setNotice(error instanceof Error ? error.message : "Could not update this server."); }
    finally { setBusy(""); }
  }

  return <div className="fixed inset-0 z-40 flex overflow-hidden bg-[#313338] text-[#dbdee1]">
    <aside className="hidden w-[72px] shrink-0 bg-[#1e1f22] p-3 md:block"><Link to="/chat-servers" className="grid h-12 w-12 place-items-center rounded-2xl bg-[#5865f2] text-white hover:rounded-[18px]"><ChevronLeft/></Link><div className="my-3 h-px bg-white/10"/><div className="grid h-12 w-12 place-items-center rounded-2xl bg-emerald-500 text-white"><Bot/></div></aside>
    <aside className="hidden w-[260px] shrink-0 border-r border-black/30 bg-[#2b2d31] md:block"><div className="border-b border-black/30 p-4 font-bold text-white">App Directory</div><div className="p-3"><p className="px-2 pb-2 text-xs font-bold uppercase tracking-wide text-[#949ba4]">Add to server</p><select value={serverId} onChange={(event) => setServerId(event.target.value)} className="w-full rounded bg-[#1e1f22] px-3 py-2 text-sm text-white outline-none">{manageable.map((server) => <option key={server.id} value={server.id}>{server.name}</option>)}</select>{!manageable.length && <p className="mt-3 text-xs leading-5 text-[#949ba4]">You need to own a server before you can add an app.</p>}<Link to="/chat-servers" className="mt-5 flex items-center gap-2 rounded px-2 py-2 text-sm text-[#b5bac1] hover:bg-white/5 hover:text-white"><Server size={17}/>Back to servers</Link></div></aside>
    <main className="min-w-0 flex-1 overflow-y-auto"><header className="sticky top-0 z-10 flex h-[56px] items-center gap-3 border-b border-black/30 bg-[#313338]/95 px-5 backdrop-blur"><Bot size={21}/><b className="text-white">Bot Marketplace</b><div className="ml-auto flex w-72 max-w-[45vw] items-center gap-2 rounded bg-[#1e1f22] px-3 py-2"><Search size={14} className="text-[#949ba4]"/><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search apps" className="min-w-0 flex-1 bg-transparent text-sm text-white outline-none"/></div></header><div className="mx-auto max-w-6xl p-6"><div className="rounded-2xl bg-gradient-to-r from-[#5865f2] via-violet-600 to-fuchsia-600 p-7"><p className="text-xs font-black uppercase tracking-[.2em] text-white/70">Apps for your server</p><h1 className="mt-2 text-3xl font-black text-white">Make your server do more.</h1><p className="mt-2 max-w-2xl text-sm text-white/75">Add safe EduPy bots, then run them with <b>/botname command</b> in any text channel.</p></div>{notice && <p className="mt-4 rounded-lg bg-emerald-400/10 px-4 py-3 text-sm text-emerald-200">{notice}</p>}<div className="mt-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">{listed.map((bot) => { const installed = !!selected?.botIds?.includes(bot.id); return <article key={bot.id} className="flex min-h-56 flex-col rounded-xl border border-black/30 bg-[#2b2d31] p-5"><div className="flex items-start gap-3">{bot.avatarUrl ? <img src={bot.avatarUrl} alt="" className="h-14 w-14 rounded-2xl object-cover"/> : <span className="grid h-14 w-14 place-items-center rounded-2xl bg-[#5865f2]"><Bot/></span>}<div className="min-w-0"><h2 className="truncate font-bold text-white">{bot.name}</h2><p className="truncate font-mono text-xs text-[#949ba4]">@{bot.handle}</p></div><ShieldCheck size={17} className="ml-auto text-emerald-300"/></div><p className="mt-4 line-clamp-3 flex-1 text-sm leading-5 text-[#b5bac1]">{bot.description || "A community-made EduPy app."}</p><div className="mt-4 flex items-center gap-2 text-xs text-[#949ba4]"><Sparkles size={13}/>{bot.commands.length} commands</div><button type="button" disabled={!selected || !!busy} onClick={() => void toggle(bot)} className={`mt-4 flex items-center justify-center gap-2 rounded px-4 py-2.5 text-sm font-bold text-white disabled:opacity-40 ${installed ? "bg-[#4e5058] hover:bg-[#5d6069]" : "bg-[#5865f2] hover:bg-[#4752c4]"}`}>{installed ? <><Check size={15}/>Installed</> : <><Plus size={15}/>Add to server</>}</button></article>; })}</div>{!listed.length && <p className="py-24 text-center text-[#949ba4]">No live apps match that search.</p>}</div></main>
  </div>;
}
