import { useEffect, useRef, useState } from "react";
import { useMemo } from "react";
import { Link, useNavigate, useParams, useSearchParams } from "react-router-dom";
import { Gamepad2, Globe2, Hash, LockKeyhole, MessageCircle, Pencil, Plus, Server, Shield, Trash2, X } from "lucide-react";
import PublicChat from "../components/PublicChat";
import StaffChat from "../components/StaffChat";
import CommunityServerChat from "../components/CommunityServerChat";
import { useAuth } from "../context/AuthContext";
import StatusDot from "../components/StatusDot";
import { getPresenceStatus, isOnline, subscribeToAllProfiles } from "../lib/profiles";
import { isStaffRole } from "../lib/moderation";
import { arcadeLevel } from "../lib/minigames";
import { rankNameClass, rankTier, RANK_LABEL, STAFF_RANKS } from "../lib/ranks";
import { createCommunityChatServer, deleteCommunityChatServer, subscribeToCommunityChatServers, updateCommunityChatServer } from "../lib/communityChatServers";
import { useNow } from "../hooks/useNow";
import type { CommunityChatServer, UserProfile } from "../types";
import ProfileCard from "../components/ProfileCard";
import GuildTag from "../components/GuildTag";
import ChatRoomBoundary from "../components/ChatRoomBoundary";
import { subscribeToGuilds } from "../lib/guilds";
import type { Guild } from "../types";

export default function Chat() {
  const [searchParams, setSearchParams] = useSearchParams();
  const { serverId: routeServerId = "" } = useParams();
  const navigate = useNavigate();
  const handledQuery = useRef("");
  const { user, role } = useAuth();
  const [profiles, setProfiles] = useState<UserProfile[]>([]);
  const [openProfileId, setOpenProfileId] = useState<string | null>(null);
  const [room, setRoom] = useState<"global" | "staff" | "community">("global");
  const [chatServers, setChatServers] = useState<CommunityChatServer[]>([]);
  const [guilds, setGuilds] = useState<Guild[]>([]);
  const [selectedServerId, setSelectedServerId] = useState("");
  const [editingServer, setEditingServer] = useState<CommunityChatServer | null>(null);
  const [serverFormOpen, setServerFormOpen] = useState(false);
  const [serverName, setServerName] = useState("");
  const [serverDescription, setServerDescription] = useState("");
  const [serverRules, setServerRules] = useState("");
  const [serverError, setServerError] = useState("");
  const [savingServer, setSavingServer] = useState(false);
  const [serversReady, setServersReady] = useState(false);
  const isStaff = isStaffRole(role);
  useNow();

  useEffect(() => subscribeToAllProfiles(setProfiles), []);
  useEffect(() => subscribeToGuilds(setGuilds), []);
  useEffect(() => {
    if (!user) return;
    return subscribeToCommunityChatServers((servers) => { setChatServers(servers); setServersReady(true); });
  }, [user]);

  const online = profiles.filter(isOnline).sort((a, b) => b.lastActiveAt - a.lastActiveAt);
  const staff = profiles.filter((p) => STAFF_RANKS.includes(p.rank));
  const arcadeTop = [...profiles].filter((p) => p.botXp > 0).sort((a, b) => b.botXp - a.botXp).slice(0, 5);
  const myProfile = profiles.find((profile) => profile.id === user?.uid);
  const canCreateServer = isStaff || rankTier(myProfile?.rank) >= rankTier("mvp_plus_plus");
  const selectedServer = useMemo(() => chatServers.find((server) => server.id === selectedServerId) ?? null, [chatServers, selectedServerId]);
  const canManageSelected = !!selectedServer && (isStaff || selectedServer.ownerId === user?.uid);
  const guildById = useMemo(() => new Map(guilds.map((guild) => [guild.id, guild])), [guilds]);

  useEffect(() => {
    if (!routeServerId) return;
    setSelectedServerId(routeServerId);
    setRoom("community");
  }, [routeServerId]);

  useEffect(() => {
    const key = searchParams.toString();
    if (!key || handledQuery.current === key) return;
    if (searchParams.get("create") === "1" && !canCreateServer && profiles.length === 0 && !isStaff) return;
    handledQuery.current = key;
    const serverId = searchParams.get("server");
    if (serverId) {
      navigate(`/chat-servers/${serverId}`, { replace: true });
      return;
    }
    if (searchParams.get("create") === "1" && canCreateServer) openCreateServer();
    setSearchParams({}, { replace: true });
  }, [searchParams, setSearchParams, canCreateServer, profiles.length, isStaff, navigate]);

  function openCreateServer() {
    setEditingServer(null); setServerName(""); setServerDescription(""); setServerRules(""); setServerError(""); setServerFormOpen(true);
  }
  function openEditServer(server: CommunityChatServer) {
    setEditingServer(server); setServerName(server.name); setServerDescription(server.description); setServerRules(server.rules.join("\n")); setServerError(""); setServerFormOpen(true);
  }
  async function saveServer() {
    if (!user || !myProfile) return;
    const name = serverName.trim().slice(0, 40);
    const description = serverDescription.trim().slice(0, 160);
    const rules = serverRules.split("\n").map((rule) => rule.trim()).filter(Boolean).slice(0, 8);
    if (name.length < 3) { setServerError("Server name must be at least 3 characters."); return; }
    if (!description) { setServerError("Add a short description."); return; }
    if (rules.length === 0) { setServerError("Add at least one rule, one per line."); return; }
    setSavingServer(true); setServerError("");
    try {
      if (editingServer) await updateCommunityChatServer(editingServer.id, { name, description, rules });
      else {
        const created = await createCommunityChatServer({ name, description, rules, ownerId: user.uid, ownerName: myProfile.displayName || "Member", boostCount: 0, lastBoostedAt: 0 });
        setSelectedServerId(created.id); setRoom("community"); navigate(`/chat-servers/${created.id}`);
      }
      setServerFormOpen(false);
    } catch (error) { setServerError(error instanceof Error ? error.message : "Could not save the server."); }
    finally { setSavingServer(false); }
  }

  async function removeSelectedServer() {
    if (!selectedServer || !canManageSelected || !window.confirm(`Delete ${selectedServer.name}? Its chat will no longer be accessible.`)) return;
    await deleteCommunityChatServer(selectedServer.id);
    setSelectedServerId(""); setRoom("global"); navigate("/chat");
  }

  function openRoom(nextRoom: "global" | "staff") {
    setSelectedServerId("");
    setRoom(nextRoom);
    navigate(nextRoom === "global" ? "/chat" : "/chat?room=staff");
  }

  function openCommunityServer(serverId: string) {
    setSelectedServerId(serverId);
    setRoom("community");
    navigate(`/chat-servers/${serverId}`);
  }

  const pageTitle = room === "community" ? (selectedServer?.name ?? "Community server") : room === "staff" ? "Staff Meeting" : "Global Chat";
  const pageSubtitle = room === "community" ? (selectedServer?.description ?? "Loading this community server…") : room === "staff" ? "Private staff text channel." : "Talk with the whole SpawnDex community.";

  return (
    <div className="mx-auto max-w-[90rem] px-4 py-10 sm:px-6 sm:py-14">
      <div className="flex items-center gap-3">
        <MessageCircle size={26} className="text-brand-400" />
        <div>
          <h1 className="font-mono text-2xl font-bold text-white">{pageTitle}</h1>
          <p className="text-sm text-white/45">{pageSubtitle}</p>
        </div>
        <Link to="/chat-servers" className="cursor-target ml-auto inline-flex items-center gap-2 rounded-xl border border-border bg-surface px-3 py-2 text-xs font-semibold text-white/65 hover:border-brand-400/35 hover:text-white"><Server size={14}/>Browse Servers</Link>
      </div>
      <div className="mt-8 grid grid-cols-1 gap-5 lg:grid-cols-[230px_minmax(0,1fr)_280px]">
        <aside className="h-fit overflow-hidden rounded-2xl border border-border bg-surface lg:sticky lg:top-24">
          <div className="flex items-center justify-between border-b border-border px-4 py-3.5"><p className="font-mono text-xs font-bold uppercase tracking-wider text-white/45">Chat panel</p>{canCreateServer && <button type="button" onClick={openCreateServer} title="Create chat server" className="cursor-target rounded-lg p-1.5 text-brand-300 hover:bg-brand-500/10"><Plus size={16}/></button>}</div>
          <nav className="space-y-1 p-2">
            <button type="button" onClick={() => openRoom("global")} className={`cursor-target flex w-full items-center gap-2.5 rounded-xl px-3 py-2.5 text-left text-sm font-semibold ${room === "global" ? "bg-brand-500/15 text-white" : "text-white/50 hover:bg-white/5 hover:text-white/80"}`}><Globe2 size={16} className="text-emerald-300"/>Global Chat</button>
            {isStaff && <button type="button" onClick={() => openRoom("staff")} className={`cursor-target flex w-full items-center gap-2.5 rounded-xl px-3 py-2.5 text-left text-sm font-semibold ${room === "staff" ? "bg-amber-300/10 text-white" : "text-white/50 hover:bg-white/5 hover:text-white/80"}`}><LockKeyhole size={16} className="text-amber-300"/>Staff Meeting</button>}
          </nav>
          <div className="border-t border-border px-4 pb-2 pt-3"><div className="flex items-center justify-between"><p className="font-mono text-[10px] font-bold uppercase tracking-wider text-white/30">Community servers</p><span className="text-[10px] text-white/20">{chatServers.length}</span></div></div>
          <div className="max-h-72 space-y-1 overflow-y-auto px-2 pb-3">
            {chatServers.length === 0 && <p className="px-2 py-4 text-center text-xs text-white/25">No servers yet.</p>}
            {chatServers.map((server) => <button key={server.id} type="button" onClick={() => openCommunityServer(server.id)} className={`cursor-target flex w-full items-center gap-2 rounded-xl px-3 py-2.5 text-left ${room === "community" && selectedServerId === server.id ? "bg-brand-500/15 text-white" : "text-white/48 hover:bg-white/5 hover:text-white/80"}`}><Hash size={15} className="shrink-0"/><span className="truncate text-sm font-medium">{server.name}</span></button>)}
          </div>
          {canCreateServer && <button type="button" onClick={openCreateServer} className="cursor-target flex w-full items-center justify-center gap-2 border-t border-border px-3 py-3 text-xs font-semibold text-brand-300 hover:bg-brand-500/5"><Plus size={13}/>New server</button>}
          {!canCreateServer && <p className="border-t border-border px-4 py-3 text-[10px] leading-relaxed text-white/25">MVP++ can create community chat servers.</p>}
        </aside>

        <div className="glass-panel min-w-0 self-start rounded-2xl">
          <ChatRoomBoundary key={`${room}:${selectedServerId}`} roomName={pageTitle}>
            {room === "staff" && isStaff ? <StaffChat /> : room === "community" ? selectedServer ? <CommunityServerChat server={selectedServer}/> : <div className="grid min-h-[610px] place-items-center rounded-2xl border border-border bg-surface p-6 text-center"><div><Hash size={28} className="mx-auto text-white/20"/><p className="mt-3 text-sm font-semibold text-white/60">{serversReady ? "Server not found" : "Opening server…"}</p>{serversReady && <Link to="/chat-servers" className="mt-3 inline-block text-xs font-semibold text-brand-300 hover:text-brand-200">Browse servers</Link>}</div></div> : <PublicChat tall />}
          </ChatRoomBoundary>
        </div>

        <div className="space-y-5">
          {room === "community" && selectedServer && <div className="rounded-2xl border border-border bg-surface p-4"><div className="flex items-start justify-between gap-3"><div><p className="flex items-center gap-1.5 font-mono text-xs font-semibold uppercase tracking-wide text-white/50"><Server size={13}/>Server rules</p><p className="mt-2 text-sm font-semibold text-white">{selectedServer.name}</p></div>{canManageSelected && <button type="button" onClick={() => openEditServer(selectedServer)} className="cursor-target rounded-lg p-2 text-white/35 hover:bg-white/5 hover:text-white"><Pencil size={14}/></button>}</div><p className="mt-1 text-xs leading-relaxed text-white/40">{selectedServer.description}</p><ol className="mt-4 space-y-2">{selectedServer.rules.map((rule, index) => <li key={index} className="flex gap-2 text-xs leading-relaxed text-white/62"><span className="font-mono text-brand-300">{index + 1}.</span><span>{rule}</span></li>)}</ol>{canManageSelected && <button type="button" onClick={() => void removeSelectedServer()} className="cursor-target mt-4 flex items-center gap-1.5 text-[11px] text-red-300/65 hover:text-red-300"><Trash2 size={12}/>Delete server</button>}</div>}
          <div className="rounded-2xl border border-border bg-surface p-4">
            <p className="font-mono text-xs font-semibold uppercase tracking-wide text-white/50">
              Online now — {online.length}
            </p>
            <div className="mt-3 space-y-2.5">
              {online.length === 0 && <p className="text-xs text-white/30">Nobody's online right now.</p>}
              {online.map((p) => {
                const nameplateId = p.nameplateEffect || (p.profileEffect === "profile-exclusive-developer-nameplate" ? p.profileEffect : "");
                return (
                <div key={p.id} onClick={() => setOpenProfileId(p.id)} className={`online-member-row cursor-target flex min-h-[48px] cursor-pointer items-center gap-2 rounded-xl border border-white/[.06] bg-white/[.025] px-2.5 py-2 transition-colors hover:border-white/10 hover:bg-white/[.05] ${nameplateId ? `online-member-row--nameplate nameplate-effect-${nameplateId}` : ""}`}>
                  <div className={`online-member-avatar relative shrink-0 ${p.pfpEffect ? `pfp-effect-${p.pfpEffect}` : ""}`}>
                    {p.photoUrl ? (
                      <img src={p.photoUrl} alt="" className="h-7 w-7 rounded-full object-cover" />
                    ) : (
                      <div className="flex h-7 w-7 items-center justify-center rounded-full bg-gradient-to-br from-cyan-400 to-fuchsia-500 font-mono text-[10px] font-bold text-white">
                        {p.displayName.slice(0, 1).toUpperCase()}
                      </div>
                    )}
                    <StatusDot status={getPresenceStatus(p)} className="absolute -bottom-0.5 -right-0.5" />
                  </div>
                  {nameplateId === "profile-exclusive-developer-nameplate" && <span className="developer-row-flame" aria-hidden="true" />}
                  <span className={`min-w-0 flex-1 truncate text-xs font-medium ${rankNameClass(p.rank)}`}>{p.displayName}</span>
                  <GuildTag compact tag={p.guildId ? guildById.get(p.guildId)?.tag : ""} icon={p.guildId ? guildById.get(p.guildId)?.tagIcon : undefined} font={p.guildId ? guildById.get(p.guildId)?.tagFont : undefined} imageUrl={p.guildId ? guildById.get(p.guildId)?.tagImageUrl : undefined} color={p.guildId ? guildById.get(p.guildId)?.tagColor : undefined}/>
                </div>
              );})}
            </div>
          </div>

          <div className="rounded-2xl border border-border bg-surface p-4">
            <p className="flex items-center gap-1.5 font-mono text-xs font-semibold uppercase tracking-wide text-white/50">
              <Gamepad2 size={12} /> Arcade leaderboard
            </p>
            <p className="mt-1 text-[11px] text-white/40">Play !coinflip, !rps, !slots, !trivia in chat.</p>
            <div className="mt-3 space-y-2.5">
              {arcadeTop.length === 0 && <p className="text-xs text-white/30">No XP earned yet — be first!</p>}
              {arcadeTop.map((p, i) => (
                <div key={p.id} className="flex items-center gap-2">
                  <span className="w-4 shrink-0 text-center font-mono text-[10px] text-white/30">{i + 1}</span>
                  {p.photoUrl ? (
                    <img src={p.photoUrl} alt="" className="h-6 w-6 shrink-0 rounded-full object-cover" />
                  ) : (
                    <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-cyan-400 to-fuchsia-500 font-mono text-[9px] font-bold text-white">
                      {p.displayName.slice(0, 1).toUpperCase()}
                    </div>
                  )}
                  <span className="min-w-0 flex-1 truncate text-xs font-medium text-white/80">{p.displayName}</span>
                  <span className="shrink-0 text-[10px] text-white/35">Lv.{arcadeLevel(p.botXp)} · {p.botXp}xp</span>
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-2xl border border-border bg-surface p-4">
            <p className="flex items-center gap-1.5 font-mono text-xs font-semibold uppercase tracking-wide text-white/50">
              <Shield size={12} /> Contact staff
            </p>
            <p className="mt-1 text-[11px] text-white/40">Message any of these in Global Chat.</p>
            <div className="mt-3 space-y-2.5">
              {staff.length === 0 && <p className="text-xs text-white/30">No staff assigned yet.</p>}
              {staff.map((p) => (
                <div key={p.id} onClick={() => setOpenProfileId(p.id)} className="cursor-target flex cursor-pointer items-center gap-2">
                  <div className="relative shrink-0">
                    {p.photoUrl ? (
                      <img src={p.photoUrl} alt="" className="h-7 w-7 rounded-full object-cover" />
                    ) : (
                      <div className="flex h-7 w-7 items-center justify-center rounded-full bg-gradient-to-br from-cyan-400 to-fuchsia-500 font-mono text-[10px] font-bold text-white">
                        {p.displayName.slice(0, 1).toUpperCase()}
                      </div>
                    )}
                    <StatusDot status={getPresenceStatus(p)} className="absolute -bottom-0.5 -right-0.5" />
                  </div>
                  <div className="min-w-0">
                    <p className={`truncate text-xs font-medium ${rankNameClass(p.rank)}`}>{p.displayName}</p>
                    <p className="text-[10px] text-white/35">{RANK_LABEL[p.rank ?? "none"]}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
      {serverFormOpen && <div className="fixed inset-0 z-[100] grid place-items-center bg-black/70 p-4 backdrop-blur-sm" onMouseDown={(event) => { if (event.target === event.currentTarget) setServerFormOpen(false); }}><div className="w-full max-w-lg rounded-2xl border border-border bg-[#141719] p-5 shadow-2xl"><div className="flex items-center justify-between"><div><p className="font-mono text-sm font-bold text-white">{editingServer ? "Manage chat server" : "Create chat server"}</p><p className="mt-1 text-xs text-white/35">MVP++ community space</p></div><button type="button" onClick={() => setServerFormOpen(false)} className="cursor-target rounded-lg p-2 text-white/35 hover:bg-white/5 hover:text-white"><X size={16}/></button></div><div className="mt-5 space-y-4"><label className="block"><span className="text-xs font-semibold text-white/55">Server name</span><input value={serverName} onChange={(event) => setServerName(event.target.value)} maxLength={40} placeholder="Study squad" className="mt-1.5 w-full rounded-xl border border-border bg-surface-2 px-4 py-2.5 text-sm text-white placeholder:text-white/20 focus:border-brand-500/50 focus:outline-none"/></label><label className="block"><span className="text-xs font-semibold text-white/55">Description</span><input value={serverDescription} onChange={(event) => setServerDescription(event.target.value)} maxLength={160} placeholder="What is this server for?" className="mt-1.5 w-full rounded-xl border border-border bg-surface-2 px-4 py-2.5 text-sm text-white placeholder:text-white/20 focus:border-brand-500/50 focus:outline-none"/></label><label className="block"><span className="text-xs font-semibold text-white/55">Rules</span><textarea value={serverRules} onChange={(event) => setServerRules(event.target.value)} rows={6} maxLength={800} placeholder={"Be respectful\nNo spam\nKeep it school-friendly"} className="mt-1.5 w-full resize-none rounded-xl border border-border bg-surface-2 px-4 py-3 text-sm text-white placeholder:text-white/20 focus:border-brand-500/50 focus:outline-none"/><span className="mt-1 block text-[10px] text-white/25">One rule per line · maximum 8</span></label></div>{serverError && <p className="mt-3 text-xs text-red-300">{serverError}</p>}<div className="mt-5 flex justify-end gap-2"><button type="button" onClick={() => setServerFormOpen(false)} className="cursor-target rounded-xl px-4 py-2 text-sm text-white/45 hover:bg-white/5">Cancel</button><button type="button" disabled={savingServer} onClick={() => void saveServer()} className="cursor-target rounded-xl bg-brand-500 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-400 disabled:opacity-50">{savingServer ? "Saving…" : editingServer ? "Save changes" : "Create server"}</button></div></div></div>}
      {openProfileId && <ProfileCard userId={openProfileId} onClose={() => setOpenProfileId(null)} />}
    </div>
  );
}
