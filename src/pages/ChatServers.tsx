import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { BadgeCheck, Compass, Crown, Gamepad2, MessageCircle, Plus, Rocket, Search, Sparkles, Users } from "lucide-react";
import CommunityServerBoostModal from "../components/CommunityServerBoostModal";
import { useAuth } from "../context/AuthContext";
import { boostCommunityChatServer, joinCommunityChatServer, subscribeToCommunityChatServers } from "../lib/communityChatServers";
import { subscribeToServers } from "../lib/servers";
import { getIcon } from "../lib/icons";
import { ensureWallet, subscribeToBalance } from "../lib/shop";
import { isOnline, subscribeToAllProfiles, subscribeToProfile } from "../lib/profiles";
import { isStaffRole } from "../lib/moderation";
import { rankTier } from "../lib/ranks";
import { COMMUNITY_SERVER_BOOST_COST } from "../lib/communityServerBoosts";
import type { CommunityChatServer, MinecraftServer, UserProfile } from "../types";

function safeText(value: unknown, fallback = "") {
  return typeof value === "string" && value.trim() ? value : fallback;
}

function initial(value: unknown, fallback = "S") {
  return safeText(value, fallback).slice(0, 1).toUpperCase();
}

export default function ChatServers() {
  const { user, role } = useAuth();
  const navigate = useNavigate();
  const [servers, setServers] = useState<CommunityChatServer[]>([]);
  const [minecraftServers, setMinecraftServers] = useState<MinecraftServer[]>([]);
  const [allProfiles, setAllProfiles] = useState<UserProfile[]>([]);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [balance, setBalance] = useState(0);
  const [busyId, setBusyId] = useState("");
  const [notice, setNotice] = useState("");
  const [search, setSearch] = useState("");
  const [boostServerId, setBoostServerId] = useState("");
  useEffect(() => subscribeToCommunityChatServers(setServers), []);
  useEffect(() => subscribeToServers(setMinecraftServers), []);
  useEffect(() => subscribeToAllProfiles(setAllProfiles), []);
  useEffect(() => user ? subscribeToProfile(user.uid, setProfile) : undefined, [user]);
  useEffect(() => { if (!user) return; void ensureWallet(user.uid); return subscribeToBalance(user.uid, setBalance); }, [user]);

  const myServers = useMemo(() => user ? servers.filter((server) => server.ownerId === user.uid || server.memberIds?.includes(user.uid)) : [], [servers, user]);
  const publicServers = useMemo(() => servers.filter((server) => server.isPublic !== false), [servers]);
  const ranked = useMemo(() => [...publicServers].filter((server) => !search.trim() || safeText(server.name).toLowerCase().includes(search.trim().toLowerCase()) || safeText(server.description).toLowerCase().includes(search.trim().toLowerCase())).sort((a, b) => (b.boostCount ?? 0) - (a.boostCount ?? 0) || b.lastBoostedAt - a.lastBoostedAt || a.createdAt - b.createdAt), [search, publicServers]);
  const minecraftById = useMemo(() => new Map(minecraftServers.map((item) => [item.id, item])), [minecraftServers]);
  const boostServer = useMemo(() => servers.find((server) => server.id === boostServerId) ?? null, [boostServerId, servers]);
  const onlineProfileIds = useMemo(() => new Set(allProfiles.filter(isOnline).map((item) => item.id)), [allProfiles]);
  const canCreate = isStaffRole(role) || rankTier(profile?.rank) >= rankTier("mvp_plus_plus");

  function memberCount(server: CommunityChatServer) {
    return new Set([server.ownerId, ...(server.memberIds ?? [])]).size;
  }
  function onlineCount(server: CommunityChatServer) {
    const ids = new Set([server.ownerId, ...(server.memberIds ?? [])]);
    let count = 0;
    ids.forEach((id) => { if (onlineProfileIds.has(id)) count += 1; });
    return count;
  }

  async function boost(server: CommunityChatServer) { if (!user || busyId) return; setBusyId(server.id); setNotice(""); try { await boostCommunityChatServer(server.id, user.uid); setNotice(`${safeText(server.name, "Server")} boosted!`); } catch (error) { setNotice(error instanceof Error ? error.message : "Could not boost this server."); } finally { setBusyId(""); } }
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
    <div className="grid min-h-[calc(100vh-4rem)] grid-cols-1 md:grid-cols-[72px_260px_minmax(0,1fr)]">
      <aside className="hidden bg-[#1e1f22] p-3 md:block">
        <button type="button" onClick={() => navigate("/chat-servers")} className="cursor-target grid h-12 w-12 place-items-center rounded-2xl bg-[#5865f2] text-white shadow-lg shadow-black/30"><Compass size={22}/></button>
        <div className="my-3 h-px bg-white/10" />
        <div className="space-y-2">
          {myServers.slice(0, 10).map((server) => <button key={server.id} type="button" onClick={() => navigate(`/chat-servers/${server.id}`)} title={safeText(server.name, "Server")} className="cursor-target grid h-12 w-12 place-items-center overflow-hidden rounded-full bg-[#2b2d31] text-sm font-black text-white/80 transition-all duration-200 hover:rounded-2xl hover:bg-[#5865f2]">{server.iconUrl ? <img src={server.iconUrl} alt="" className="h-full w-full object-cover"/> : initial(server.name)}</button>)}
        </div>
      </aside>
      <aside className="hidden border-r border-black/40 bg-[#2b2d31] md:block">
        <div className="border-b border-black/40 p-3 shadow-sm shadow-black/20">
          <button type="button" disabled={!canCreate} onClick={() => navigate("/chat?create=1")} className="cursor-target flex w-full items-center justify-center gap-2 rounded bg-[#5865f2] px-3 py-2 text-sm font-bold text-white hover:bg-[#4752c4] disabled:cursor-not-allowed disabled:opacity-40"><Plus size={16}/>{canCreate ? "Create server" : "MVP++ required"}</button>
        </div>
        <div className="p-3">
          <p className="px-2 pb-2 text-xs font-bold uppercase tracking-wide text-white/35">Your servers — {myServers.length}</p>
          {myServers.slice(0, 8).map((server) => <button key={server.id} type="button" onClick={() => navigate(`/chat-servers/${server.id}`)} className="flex w-full items-center gap-2 rounded px-2.5 py-1.5 text-left text-[15px] font-medium text-[#949ba4] hover:bg-white/[.06] hover:text-[#dbdee1]"><span className="grid h-6 w-6 shrink-0 place-items-center overflow-hidden rounded-full bg-[#1e1f22] text-[10px] font-bold">{server.iconUrl ? <img src={server.iconUrl} alt="" className="h-full w-full object-cover"/> : initial(server.name)}</span><span className="min-w-0 flex-1 truncate">{safeText(server.name, "Server")}</span></button>)}
          {myServers.length === 0 && <p className="px-2 text-xs leading-5 text-white/25">Join a server from the list to see it here.</p>}
          <p className="mt-4 px-2 pb-2 text-xs font-bold uppercase tracking-wide text-white/35">Browse</p>
          <button className="flex w-full items-center gap-2 rounded bg-white/10 px-2.5 py-1.5 text-left text-[15px] font-medium text-white"><MessageCircle size={16}/>Community servers</button>
          <button className="mt-1 flex w-full items-center gap-2 rounded px-2.5 py-1.5 text-left text-[15px] font-medium text-[#949ba4] hover:bg-white/[.06] hover:text-[#dbdee1]"><Rocket size={16}/>Boosted servers</button>
          <div className="mt-4 rounded bg-[#1e1f22] px-2.5 py-2">
            <p className="text-[11px] text-white/35">Wallet</p>
            <p className="mt-0.5 text-sm font-bold text-amber-300">{balance} credits</p>
            <p className="text-[11px] text-white/30">Boosts cost {COMMUNITY_SERVER_BOOST_COST}</p>
          </div>
        </div>
      </aside>
      <main className="min-w-0 bg-[#313338]">
        <header className="flex h-[49px] items-center gap-3 border-b border-black/35 px-4 shadow-sm shadow-black/20">
          <MessageCircle size={21} className="text-[#80848e]"/><h1 className="text-base font-bold text-white">Community Servers</h1>
          <div className="ml-auto flex w-72 max-w-[45vw] items-center gap-2 rounded bg-[#1e1f22] px-2.5 py-1.5"><Search size={14} className="text-white/35"/><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search servers" className="min-w-0 flex-1 bg-transparent text-sm text-white outline-none placeholder:text-white/30"/></div>
        </header>
        <div className="p-5">
          <div className="mb-5 flex items-end justify-between gap-4"><div><p className="text-xs font-bold uppercase tracking-wide text-brand-300">Community</p><h2 className="mt-1 text-2xl font-black text-white">Join a server</h2><p className="mt-1 text-sm text-[#b5bac1]">Pick a chat server. Global Chat stays separate.</p></div><span className="text-xs text-white/40"><b className="text-white/75">{ranked.length}</b> listed</span></div>
          {notice && <p className="mb-4 rounded bg-[#5865f2]/15 px-3 py-2 text-sm text-brand-100">{notice}</p>}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">{ranked.map((server, index) => {
            const minecraftServer = server.linkedMinecraftServerId ? minecraftById.get(server.linkedMinecraftServerId) : null;
            const joinCode = minecraftServer?.code?.map(getIcon) ?? [];
            const boosted = index === 0 && (server.boostCount ?? 0) > 0;
            return <article key={server.id} className="group flex flex-col overflow-hidden rounded-xl border border-black/35 bg-[#2b2d31] transition-colors hover:border-white/15">
              <div className="relative aspect-[2/1] w-full overflow-hidden bg-[#1e1f22]">
                {server.bannerUrl ? <img src={server.bannerUrl} alt="" className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-[1.03]"/> : <div className="grid h-full w-full place-items-center bg-gradient-to-br from-[#5865f2]/25 to-[#1e1f22] text-white/15"><MessageCircle size={28}/></div>}
                {boosted && <span className="absolute left-2 top-2 flex items-center gap-1 rounded-full bg-black/60 px-2 py-1 text-[10px] font-bold text-amber-300 backdrop-blur-sm"><Crown size={11}/>Boosted</span>}
              </div>
              <div className="flex flex-1 flex-col p-4 pt-0">
                <span className="-mt-7 grid h-14 w-14 shrink-0 place-items-center overflow-hidden rounded-2xl border-4 border-[#2b2d31] bg-[#1e1f22] font-mono text-lg font-black text-white">{server.iconUrl ? <img src={server.iconUrl} alt="" className="h-full w-full object-cover"/> : initial(server.name)}</span>
                <div className="mt-2 flex items-center gap-1.5"><h2 className="truncate font-bold text-white">{safeText(server.name, "Server")}</h2>{(server.boostCount ?? 0) >= 5 && <BadgeCheck size={14} className="shrink-0 text-brand-300" aria-label="Well-established server"/>}</div>
                <p className="mt-0.5 truncate text-xs text-white/35">Hosted by {safeText(server.ownerName, "Unknown")}</p>
                <p className="mt-2 line-clamp-2 flex-1 text-sm leading-5 text-[#b5bac1]">{safeText(server.description, "No description yet.")}</p>
                {minecraftServer?.isOnline && joinCode.length > 0 && <div className="mt-3 flex flex-wrap items-center gap-1.5 rounded bg-emerald-400/[.08] px-2.5 py-2"><span className="text-[9px] font-bold uppercase tracking-[.14em] text-emerald-200/70">Join code</span>{joinCode.map((icon) => <span key={icon.id} className="flex items-center gap-1 rounded bg-black/20 px-1.5 py-0.5 text-[10px] font-bold text-white/65"><img src={icon.src} alt="" className="h-4 w-4 object-contain"/>{icon.label}</span>)}</div>}
                <div className="mt-3 flex items-center gap-3 border-t border-white/[.06] pt-3 text-[11px] text-white/40">
                  <span className="flex items-center gap-1.5"><i className="h-2 w-2 rounded-full bg-emerald-400"/>{onlineCount(server).toLocaleString()} online</span>
                  <span className="flex items-center gap-1.5"><Users size={12}/>{memberCount(server).toLocaleString()} members</span>
                  {(server.boostCount ?? 0) > 0 && <span className="ml-auto flex items-center gap-1 text-amber-300/75"><Sparkles size={11}/>{server.boostCount}</span>}
                  {minecraftServer && <span className={`flex items-center gap-1 ${minecraftServer.isOnline ? "text-emerald-300/75" : "text-white/25"}`}><Gamepad2 size={12}/>{minecraftServer.isOnline ? "MC on" : "MC off"}</span>}
                </div>
                <div className="mt-3 flex gap-2">
                  <button type="button" onClick={() => void join(server)} disabled={busyId === server.id} className="cursor-target flex flex-1 items-center justify-center gap-2 rounded bg-[#5865f2] px-4 py-2 text-sm font-bold text-white hover:bg-[#4752c4] disabled:cursor-wait disabled:opacity-70"><MessageCircle size={14}/>{busyId === server.id ? "Joining…" : "Join"}</button>
                  <button type="button" onClick={() => setBoostServerId(server.id)} disabled={!!busyId} title={`View boost perks · ${COMMUNITY_SERVER_BOOST_COST} credits`} className="cursor-target grid h-9 w-9 shrink-0 place-items-center rounded border border-fuchsia-300/20 bg-fuchsia-300/[.07] text-fuchsia-300 hover:bg-fuchsia-300/15 disabled:cursor-not-allowed disabled:opacity-30"><Rocket size={14}/></button>
                </div>
              </div>
            </article>;
          })}</div>
          {ranked.length === 0 && <div className="mt-6 rounded-lg border border-dashed border-white/10 py-20 text-center"><MessageCircle className="mx-auto text-white/20"/><p className="mt-3 text-sm text-white/35">No chat servers yet.</p></div>}
        </div>
      </main>
    </div>
    {boostServer && (
      <CommunityServerBoostModal server={boostServer} balance={balance} busy={busyId === boostServer.id} onClose={() => setBoostServerId("")} onBoost={() => void boost(boostServer)}/>
    )}
  </div>;
}
