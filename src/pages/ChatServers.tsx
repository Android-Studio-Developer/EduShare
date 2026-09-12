import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Compass, Crown, Gamepad2, MessageCircle, Plus, Rocket, Search, ShieldCheck, Sparkles } from "lucide-react";
import { useAuth } from "../context/AuthContext";
import { boostCommunityChatServer, joinCommunityChatServer, subscribeToCommunityChatServers } from "../lib/communityChatServers";
import { subscribeToServers } from "../lib/servers";
import { getIcon } from "../lib/icons";
import { ensureWallet, subscribeToBalance } from "../lib/shop";
import { subscribeToProfile } from "../lib/profiles";
import { isStaffRole } from "../lib/moderation";
import { rankTier } from "../lib/ranks";
import type { CommunityChatServer, MinecraftServer, UserProfile } from "../types";

export default function ChatServers() {
  const { user, role } = useAuth();
  const navigate = useNavigate();
  const [servers, setServers] = useState<CommunityChatServer[]>([]);
  const [minecraftServers, setMinecraftServers] = useState<MinecraftServer[]>([]);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [balance, setBalance] = useState(0);
  const [busyId, setBusyId] = useState("");
  const [notice, setNotice] = useState("");
  const [search, setSearch] = useState("");
  useEffect(() => subscribeToCommunityChatServers(setServers), []);
  useEffect(() => subscribeToServers(setMinecraftServers), []);
  useEffect(() => user ? subscribeToProfile(user.uid, setProfile) : undefined, [user]);
  useEffect(() => { if (!user) return; void ensureWallet(user.uid); return subscribeToBalance(user.uid, setBalance); }, [user]);
  const ranked = useMemo(() => [...servers].filter((server) => !search.trim() || server.name.toLowerCase().includes(search.trim().toLowerCase()) || server.description.toLowerCase().includes(search.trim().toLowerCase())).sort((a, b) => (b.boostCount ?? 0) - (a.boostCount ?? 0) || b.lastBoostedAt - a.lastBoostedAt || a.createdAt - b.createdAt), [search, servers]);
  const minecraftById = useMemo(() => new Map(minecraftServers.map((item) => [item.id, item])), [minecraftServers]);
  const canCreate = isStaffRole(role) || rankTier(profile?.rank) >= rankTier("mvp_plus_plus");
  async function boost(server: CommunityChatServer) { if (!user || busyId) return; setBusyId(server.id); setNotice(""); try { await boostCommunityChatServer(server.id, user.uid); setNotice(`${server.name} boosted!`); } catch (error) { setNotice(error instanceof Error ? error.message : "Could not boost this server."); } finally { setBusyId(""); } }
  async function join(server: CommunityChatServer) {
    if (!user) { navigate("/login"); return; }
    if (busyId) return;
    if (server.bannedUserIds?.includes(user.uid)) { setNotice("You are banned from that server."); return; }
    setBusyId(server.id); setNotice("");
    try {
      if (!server.memberIds?.includes(user.uid)) await joinCommunityChatServer(server.id, user.uid);
      navigate(`/chat-servers/${server.id}`);
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Could not join this server.");
    } finally {
      setBusyId("");
    }
  }
  return <div className="-mx-3 -my-5 min-h-[calc(100vh-4rem)] bg-[#313338] text-white sm:-mx-5 sm:-my-8">
    <div className="grid min-h-[calc(100vh-4rem)] grid-cols-[72px_260px_minmax(0,1fr)_300px]">
      <aside className="hidden bg-[#1e1f22] p-3 md:block">
        <button type="button" onClick={() => navigate("/chat-servers")} className="cursor-target grid h-12 w-12 place-items-center rounded-2xl bg-[#5865f2] text-white shadow-lg shadow-black/30"><Compass size={22}/></button>
        <div className="my-3 h-px bg-white/10" />
        <div className="space-y-2">
          {servers.slice(0, 10).map((server) => <button key={server.id} type="button" onClick={() => navigate(`/chat-servers/${server.id}`)} title={server.name} className="cursor-target grid h-12 w-12 place-items-center overflow-hidden rounded-[24px] bg-[#2b2d31] text-sm font-black text-white/80 transition-all hover:rounded-2xl hover:bg-[#5865f2]">{server.iconUrl ? <img src={server.iconUrl} alt="" className="h-full w-full object-cover"/> : server.name.slice(0,1).toUpperCase()}</button>)}
        </div>
      </aside>
      <aside className="hidden border-r border-black/40 bg-[#2b2d31] md:block">
        <div className="border-b border-black/40 p-3 shadow-sm shadow-black/20">
          <button type="button" disabled={!canCreate} onClick={() => navigate("/chat?create=1")} className="cursor-target flex w-full items-center justify-center gap-2 rounded bg-[#5865f2] px-3 py-2 text-sm font-bold text-white hover:bg-[#4752c4] disabled:cursor-not-allowed disabled:opacity-40"><Plus size={16}/>{canCreate ? "Create server" : "MVP++ required"}</button>
        </div>
        <div className="p-3">
          <p className="px-2 pb-2 text-xs font-bold uppercase tracking-wide text-white/35">Browse</p>
          <button className="flex w-full items-center gap-2 rounded bg-white/10 px-2.5 py-1.5 text-left text-[15px] font-medium text-white"><MessageCircle size={16}/>Community servers</button>
          <button className="mt-1 flex w-full items-center gap-2 rounded px-2.5 py-1.5 text-left text-[15px] font-medium text-[#949ba4] hover:bg-white/[.06] hover:text-[#dbdee1]"><Rocket size={16}/>Boosted servers</button>
          <div className="mt-4 rounded bg-[#1e1f22] px-2.5 py-2">
            <p className="text-[11px] text-white/35">Wallet</p>
            <p className="mt-0.5 text-sm font-bold text-amber-300">{balance} credits</p>
            <p className="text-[11px] text-white/30">Boosts cost 100</p>
          </div>
        </div>
      </aside>
      <main className="col-span-4 min-w-0 bg-[#313338] md:col-span-1">
        <header className="flex h-[49px] items-center gap-3 border-b border-black/35 px-4 shadow-sm shadow-black/20">
          <MessageCircle size={21} className="text-[#80848e]"/><h1 className="text-base font-bold text-white">Community Servers</h1>
          <div className="ml-auto flex w-72 max-w-[45vw] items-center gap-2 rounded bg-[#1e1f22] px-2.5 py-1.5"><Search size={14} className="text-white/35"/><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search servers" className="min-w-0 flex-1 bg-transparent text-sm text-white outline-none placeholder:text-white/30"/></div>
        </header>
        <div className="p-5">
          <div className="mb-4 flex items-end justify-between gap-4"><div><p className="text-xs font-bold uppercase tracking-wide text-brand-300">Community</p><h2 className="mt-1 text-2xl font-black text-white">Join a server</h2><p className="mt-1 text-sm text-[#b5bac1]">Pick a chat server. Global Chat stays separate.</p></div><span className="text-xs text-white/40"><b className="text-white/75">{ranked.length}</b> listed</span></div>
          {notice && <p className="mb-3 rounded bg-[#5865f2]/15 px-3 py-2 text-sm text-brand-100">{notice}</p>}
          <div className="overflow-hidden rounded-lg border border-black/35 bg-[#2b2d31]">{ranked.map((server, index) => {
      const minecraftServer = server.linkedMinecraftServerId ? minecraftById.get(server.linkedMinecraftServerId) : null;
      const joinCode = minecraftServer?.code?.map(getIcon) ?? [];
      return <article key={server.id} className="group flex flex-col gap-4 border-b border-black/30 p-4 last:border-b-0 hover:bg-white/[.025] sm:flex-row sm:items-center"><span className="grid h-12 w-12 shrink-0 place-items-center overflow-hidden rounded-2xl bg-[#1e1f22] font-mono text-lg font-black text-white">{server.iconUrl ? <img src={server.iconUrl} alt="" className="h-full w-full object-cover"/> : server.name.slice(0,1).toUpperCase()}</span><div className="min-w-0 flex-1"><div className="flex items-center gap-2"><h2 className="truncate font-bold text-white">{server.name}</h2>{index===0&&(server.boostCount??0)>0&&<Crown size={14} className="shrink-0 text-amber-300"/>}</div><p className="mt-0.5 truncate text-xs text-white/35">Hosted by {server.ownerName}</p><p className="mt-2 line-clamp-2 text-sm leading-5 text-[#b5bac1]">{server.description}</p><div className="mt-2 flex flex-wrap items-center gap-3 text-[11px] text-white/35"><span className="flex items-center gap-1"><ShieldCheck size={12}/>{server.rules.length} rules</span><span className="flex items-center gap-1 text-amber-300/80"><Sparkles size={12}/>{server.boostCount??0} boosts</span>{minecraftServer && <span className={`flex items-center gap-1 ${minecraftServer.isOnline ? "text-emerald-300/85" : "text-white/30"}`}><Gamepad2 size={12}/>{minecraftServer.isOnline ? "MC online" : "MC offline"}</span>}</div>{minecraftServer?.isOnline && joinCode.length > 0 && <div className="mt-3 flex flex-wrap items-center gap-2 rounded bg-emerald-400/[.055] px-3 py-2"><span className="text-[10px] font-bold uppercase tracking-[.14em] text-emerald-200/70">Join code</span>{joinCode.map((icon) => <span key={icon.id} className="flex items-center gap-1 rounded bg-black/20 px-2 py-1 text-[10px] font-bold text-white/65"><img src={icon.src} alt="" className="h-5 w-5 object-contain"/>{icon.label}</span>)}</div>}</div><div className="flex shrink-0 gap-2"><button type="button" onClick={() => void join(server)} disabled={busyId===server.id} className="cursor-target flex min-w-24 items-center justify-center gap-2 rounded bg-[#5865f2] px-4 py-2.5 text-sm font-bold text-white hover:bg-[#4752c4] disabled:cursor-wait disabled:opacity-70"><MessageCircle size={15}/>{busyId===server.id?"Joining…":"Join"}</button><button type="button" onClick={() => void boost(server)} disabled={balance<100||!!busyId} title="Boost for 100 credits" className="cursor-target grid h-10 w-10 place-items-center rounded border border-amber-300/20 bg-amber-300/[.07] text-amber-300 hover:bg-amber-300/15 disabled:cursor-not-allowed disabled:opacity-30"><Rocket size={15}/></button></div></article>;
    })}</div>
          {ranked.length===0&&<div className="mt-6 rounded-lg border border-dashed border-white/10 py-20 text-center"><MessageCircle className="mx-auto text-white/20"/><p className="mt-3 text-sm text-white/35">No chat servers yet.</p></div>}
        </div>
      </main>
      <aside className="hidden border-l border-black/40 bg-[#2b2d31] p-4 xl:block">
        <p className="text-xs font-bold uppercase tracking-wide text-white/35">Server count — {servers.length}</p>
        <div className="mt-3 space-y-1">{ranked.slice(0, 12).map((server) => <button key={server.id} type="button" onClick={() => navigate(`/chat-servers/${server.id}`)} className="flex w-full items-center gap-2 rounded px-2 py-1.5 text-left hover:bg-white/[.06]"><span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-[#1e1f22] text-xs font-bold">{server.name.slice(0,1).toUpperCase()}</span><span className="min-w-0 flex-1 truncate text-sm text-[#dbdee1]">{server.name}</span></button>)}</div>
      </aside>
    </div>
  </div>;
}
