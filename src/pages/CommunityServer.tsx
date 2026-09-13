import { useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { ArrowLeft, Ban, Copy, Crown, Globe2, Hash, Lock, Mic, MicOff, Plus, Server, Settings, ShieldCheck, UserMinus, Users, Volume2, X } from "lucide-react";
import CommunityServerChat from "../components/CommunityServerChat";
import ProfileCard from "../components/ProfileCard";
import StatusDot from "../components/StatusDot";
import { useAuth } from "../context/AuthContext";
import { useVoiceCall } from "../context/VoiceCallContext";
import { getPresenceStatus, isOnline, subscribeToAllProfiles, subscribeToProfile } from "../lib/profiles";
import { subscribeToCommunityChatServers, updateCommunityChatServer } from "../lib/communityChatServers";
import { subscribeToServers } from "../lib/servers";
import { getIcon } from "../lib/icons";
import { isStaffRole } from "../lib/moderation";
import { ensureCommunityVoiceChannel } from "../lib/voice";
import type { CommunityChatServer, CommunityServerRole, MinecraftServer, UserProfile } from "../types";

const roleOptions: CommunityServerRole[] = ["member", "mod", "admin"];
const FALLBACK_TEXT_CHANNELS = [{ id: "general", name: "general" }, { id: "rules", name: "rules" }];
const FALLBACK_VOICE_CHANNELS = [{ id: "lounge", name: "Lounge" }];

function safeText(value: unknown, fallback = "") {
  return typeof value === "string" && value.trim() ? value : fallback;
}

function initial(value: unknown, fallback = "S") {
  return safeText(value, fallback).slice(0, 1).toUpperCase();
}

function safeChannels(channels: unknown, fallback: { id: string; name: string }[]) {
  if (!Array.isArray(channels)) return fallback;
  const cleaned = channels
    .map((channel) => ({
      id: safeText((channel as { id?: unknown }).id),
      name: safeText((channel as { name?: unknown }).name),
    }))
    .filter((channel) => channel.id && channel.name);
  return cleaned.length ? cleaned : fallback;
}

function channelIdFromName(name: string) {
  const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 28);
  return slug || `channel-${Date.now().toString(36)}`;
}

export default function CommunityServer() {
  const { serverId = "" } = useParams();
  const { user, role } = useAuth();
  const voice = useVoiceCall();
  const [servers, setServers] = useState<CommunityChatServer[]>([]);
  const [minecraftServers, setMinecraftServers] = useState<MinecraftServer[]>([]);
  const [profiles, setProfiles] = useState<UserProfile[]>([]);
  const [myProfile, setMyProfile] = useState<UserProfile | null>(null);
  const [ready, setReady] = useState(false);
  const [channelId, setChannelId] = useState("general");
  const [openProfileId, setOpenProfileId] = useState<string | null>(null);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [bannerUrl, setBannerUrl] = useState("");
  const [iconUrl, setIconUrl] = useState("");
  const [linkedMinecraftServerId, setLinkedMinecraftServerId] = useState("");
  const [newTextChannel, setNewTextChannel] = useState("");
  const [newVoiceChannel, setNewVoiceChannel] = useState("");
  const [memberLookup, setMemberLookup] = useState("");
  const [banLookup, setBanLookup] = useState("");
  const [notice, setNotice] = useState("");

  useEffect(() => {
    const unsubscribe = subscribeToCommunityChatServers((items) => { setServers(items); setReady(true); });
    return typeof unsubscribe === "function" ? unsubscribe : undefined;
  }, []);
  useEffect(() => {
    const unsubscribe = subscribeToServers(setMinecraftServers);
    return typeof unsubscribe === "function" ? unsubscribe : undefined;
  }, []);
  useEffect(() => {
    const unsubscribe = subscribeToAllProfiles(setProfiles);
    return typeof unsubscribe === "function" ? unsubscribe : undefined;
  }, []);
  useEffect(() => {
    if (!user) return undefined;
    const unsubscribe = subscribeToProfile(user.uid, setMyProfile);
    return typeof unsubscribe === "function" ? unsubscribe : undefined;
  }, [user]);

  const server = useMemo(() => servers.find((item) => item.id === serverId) ?? null, [serverId, servers]);
  const isStaff = isStaffRole(role);
  const canManage = !!server && !!user && (server.ownerId === user.uid || isStaff);
  const serverName = safeText(server?.name, "Server");
  const ownerName = safeText(server?.ownerName, "Unknown");
  const serverDescription = safeText(server?.description, "No description yet.");
  const inviteCode = safeText(server?.inviteCode, "NO-CODE");
  const textChannels = useMemo(() => safeChannels(server?.textChannels, FALLBACK_TEXT_CHANNELS), [server?.textChannels]);
  const voiceChannels = useMemo(() => safeChannels(server?.voiceChannels, FALLBACK_VOICE_CHANNELS), [server?.voiceChannels]);
  const serverRules = Array.isArray(server?.rules) ? server.rules.filter((rule): rule is string => typeof rule === "string" && !!rule.trim()) : [];
  const selectedChannel = textChannels.find((item) => item.id === channelId) ?? textChannels[0];
  const bannedUserIds = server?.bannedUserIds ?? [];
  const bannedNames = server?.bannedUsernames ?? [];
  const memberIds = useMemo(() => {
    if (!server) return [];
    return [...new Set([server.ownerId, ...(server.memberIds ?? [])])];
  }, [server]);
  const members = useMemo(() => memberIds.map((id) => profiles.find((profile) => profile.id === id)).filter((item): item is UserProfile => !!item), [memberIds, profiles]);
  const onlineMembers = useMemo(() => members.filter(isOnline).sort((a, b) => b.lastActiveAt - a.lastActiveAt), [members]);
  const isBannedHere = !!user && (!!server?.bannedUserIds?.includes(user.uid) || [myProfile?.displayName, myProfile?.username].filter(Boolean).some((name) => bannedNames.map((item) => item.toLowerCase()).includes(String(name).toLowerCase())));
  const inviteUrl = typeof window === "undefined" || !server ? "" : `${window.location.origin}/invite/${inviteCode}${myProfile ? `?from=${encodeURIComponent(safeText(myProfile.displayName, ""))}` : ""}`;
  const linkedMinecraftServer = useMemo(() => minecraftServers.find((item) => item.id === server?.linkedMinecraftServerId) ?? null, [minecraftServers, server?.linkedMinecraftServerId]);
  const linkedMinecraftCode = useMemo(() => (linkedMinecraftServer?.code ?? []).map(getIcon), [linkedMinecraftServer?.code]);
  const linkedMinecraftCodeText = linkedMinecraftCode.map((icon) => icon.label).join(" • ");

  useEffect(() => {
    if (!server) return;
    setBannerUrl(server.bannerUrl ?? "");
    setIconUrl(server.iconUrl ?? "");
    setLinkedMinecraftServerId(server.linkedMinecraftServerId ?? "");
    if (!textChannels.some((item) => item.id === channelId)) setChannelId(textChannels[0]?.id ?? "general");
  }, [server, channelId, textChannels]);

  function roleFor(profile: UserProfile) {
    if (!server) return "member";
    if (profile.id === server.ownerId) return "owner";
    return server.roles?.[profile.id] ?? "member";
  }

  function findProfile(raw: string) {
    const lookup = raw.trim().replace(/^@/, "").toLowerCase();
    return profiles.find((profile) => safeText(profile.displayName).toLowerCase() === lookup || safeText(profile.username).toLowerCase() === lookup) ?? null;
  }

  async function saveAppearance() {
    if (!server || !canManage) return;
    await updateCommunityChatServer(server.id, { bannerUrl: bannerUrl.trim().slice(0, 1000), iconUrl: iconUrl.trim().slice(0, 1000) });
    setNotice("Server look saved.");
  }

  async function setVisibility(isPublic: boolean) {
    if (!server || !canManage) return;
    await updateCommunityChatServer(server.id, { isPublic });
    setNotice(isPublic ? "Server is now public — listed in Join a server." : "Server is now private — invite link only.");
  }

  async function saveMinecraftLink() {
    if (!server || !canManage) return;
    await updateCommunityChatServer(server.id, { linkedMinecraftServerId });
    setNotice(linkedMinecraftServerId ? "Minecraft server linked." : "Minecraft link removed.");
  }

  async function addTextChannel() {
    if (!server || !canManage) return;
    const name = newTextChannel.trim().replace(/^#/, "").slice(0, 24);
    if (!name) return;
    const next = [...textChannels, { id: channelIdFromName(name), name }];
    await updateCommunityChatServer(server.id, { textChannels: next.slice(0, 12) });
    setNewTextChannel("");
  }

  async function addVoiceChannel() {
    if (!server || !canManage) return;
    const name = newVoiceChannel.trim().slice(0, 24);
    if (!name) return;
    const next = [...voiceChannels, { id: channelIdFromName(name), name }];
    await updateCommunityChatServer(server.id, { voiceChannels: next.slice(0, 12) });
    setNewVoiceChannel("");
  }

  async function inviteMember() {
    if (!server || !canManage) return;
    const profile = findProfile(memberLookup);
    if (!profile) { setNotice("No member found with that username."); return; }
    const nextMemberIds = [...new Set([...memberIds, profile.id])];
    const nextRoles = { ...(server.roles ?? {}), [profile.id]: server.roles?.[profile.id] ?? "member", [server.ownerId]: "owner" as CommunityServerRole };
    await updateCommunityChatServer(server.id, { memberIds: nextMemberIds, roles: nextRoles, bannedUserIds: bannedUserIds.filter((id) => id !== profile.id) });
    setMemberLookup("");
    setNotice(`${profile.displayName} invited.`);
  }

  async function setMemberRole(profile: UserProfile, nextRole: CommunityServerRole) {
    if (!server || !canManage || profile.id === server.ownerId) return;
    await updateCommunityChatServer(server.id, { roles: { ...(server.roles ?? {}), [server.ownerId]: "owner", [profile.id]: nextRole } });
  }

  async function kickMember(profile: UserProfile) {
    if (!server || !canManage || profile.id === server.ownerId) return;
    await updateCommunityChatServer(server.id, { memberIds: memberIds.filter((id) => id !== profile.id), roles: { ...(server.roles ?? {}), [profile.id]: "member" } });
  }

  async function banMember() {
    if (!server || !canManage) return;
    const raw = banLookup.trim().replace(/^@/, "");
    if (!raw) return;
    const profile = findProfile(raw);
    const nextNames = [...new Set([...bannedNames, raw].filter(Boolean))].slice(0, 100);
    const nextIds = profile ? [...new Set([...bannedUserIds, profile.id])].slice(0, 100) : bannedUserIds;
    await updateCommunityChatServer(server.id, { bannedUserIds: nextIds, bannedUsernames: nextNames, memberIds: profile ? memberIds.filter((id) => id !== profile.id) : memberIds });
    setBanLookup("");
    setNotice(profile ? `${profile.displayName} banned.` : `${raw} banned by username.`);
  }

  async function banProfile(profile: UserProfile) {
    if (!server || !canManage || profile.id === server.ownerId) return;
    await updateCommunityChatServer(server.id, {
      bannedUserIds: [...new Set([...bannedUserIds, profile.id])].slice(0, 100),
      bannedUsernames: [...new Set([...bannedNames, profile.username || profile.displayName, profile.displayName])].slice(0, 100),
      memberIds: memberIds.filter((id) => id !== profile.id),
    });
    setNotice(`${profile.displayName} banned.`);
  }

  async function joinVoice(channel: { id: string; name: string }) {
    if (!server || !user || !myProfile || isBannedHere) return;
    const fullId = await ensureCommunityVoiceChannel(server.id, channel.id, `${serverName} / ${channel.name}`, user.uid, safeText(myProfile.displayName, "Member"));
    if (voice.joinedChannelId === fullId) {
      voice.leave();
      return;
    }
    if (voice.joinedChannelId) voice.leave();
    await voice.join(fullId, { uid: user.uid, displayName: myProfile.displayName || "Member", photoUrl: myProfile.photoUrl, rank: myProfile.rank });
  }

  if (!ready) {
    return <div className="grid min-h-[70vh] place-items-center px-4 text-sm text-white/40">Opening server...</div>;
  }

  if (!server) {
    return <div className="mx-auto grid min-h-[70vh] max-w-xl place-items-center px-4 text-center"><div><Server className="mx-auto text-white/20" size={38}/><h1 className="mt-4 text-xl font-bold text-white">Server not found</h1><p className="mt-2 text-sm text-white/40">It may have been deleted or the link is incorrect.</p><Link to="/chat-servers" className="cursor-target mt-5 inline-flex items-center gap-2 rounded-xl bg-brand-500 px-4 py-2.5 text-sm font-bold text-white"><ArrowLeft size={15}/>Browse servers</Link></div></div>;
  }

  return (
    <div className="fixed inset-0 z-40 bg-[#313338] text-white">
      <div className="flex h-screen w-screen overflow-hidden bg-[#313338]">
        <div className="grid h-screen w-full grid-cols-[72px_240px_minmax(0,1fr)] xl:grid-cols-[72px_240px_minmax(0,1fr)_300px]">
          <aside className="hidden overflow-y-auto bg-[#1e1f22] p-3 md:block">
            <Link to="/chat-servers" aria-label="Browse servers" className="cursor-target grid h-12 w-12 place-items-center rounded-2xl bg-[#5865f2] text-white shadow-lg shadow-black/30 transition hover:rounded-[18px]"><ArrowLeft size={20}/></Link>
            <div className="my-3 h-px bg-white/10" />
            <div className="space-y-2">
              {servers.slice(0, 14).map((item) => (
                <Link key={item.id} to={`/chat-servers/${item.id}`} title={safeText(item.name, "Server")} className={`cursor-target group relative grid h-12 w-12 place-items-center overflow-hidden text-sm font-black transition-all duration-200 hover:rounded-2xl ${item.id === server.id ? "rounded-2xl bg-[#5865f2] text-white" : "rounded-full bg-[#313338] text-white/80 hover:rounded-2xl hover:bg-[#5865f2]"}`}><span className={`absolute -left-3 top-1/2 w-2 -translate-y-1/2 rounded-r bg-white transition-all ${item.id === server.id ? "h-10" : "h-0 group-hover:h-5"}`}/>{item.iconUrl ? <img src={item.iconUrl} alt="" className="h-full w-full object-cover"/> : initial(item.name)}</Link>
              ))}
            </div>
          </aside>
          <aside className="flex min-h-0 flex-col border-r border-black/40 bg-[#2b2d31]">
            <div className="relative border-b border-black/40 shadow-sm shadow-black/20">
              <div className="h-[84px] bg-[#1e1f22] bg-cover bg-center" style={{ backgroundImage: server.bannerUrl ? `linear-gradient(rgba(0,0,0,.15), rgba(0,0,0,.45)), url(${JSON.stringify(server.bannerUrl)})` : "linear-gradient(135deg, #5865f2, #1e1f22)" }} />
              <div className="flex items-center gap-3">
                <Link to="/chat-servers" aria-label="Back to servers" className="cursor-target absolute left-2 top-2 grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-black/35 text-white/70 hover:bg-black/60 hover:text-white"><ArrowLeft size={15}/></Link>
                {server.iconUrl ? <img src={server.iconUrl} alt="" className="absolute left-3 top-12 h-14 w-14 rounded-2xl border-4 border-[#2b2d31] object-cover"/> : <span className="absolute left-3 top-12 grid h-14 w-14 shrink-0 place-items-center rounded-2xl border-4 border-[#2b2d31] bg-[#5865f2] font-mono text-xl font-black text-white">{initial(serverName)}</span>}
              </div>
              <div className="px-4 pb-3 pt-8">
                <div className="flex items-center gap-2">
                  <div className="min-w-0"><p className="truncate text-sm font-bold text-white">{serverName}</p><p className="truncate text-[11px] text-white/35">by {ownerName}</p></div>
                {canManage && <button type="button" onClick={() => setSettingsOpen((value) => !value)} className="ml-auto grid h-8 w-8 place-items-center rounded-lg text-white/45 hover:bg-white/10 hover:text-white"><Settings size={15}/></button>}
                </div>
              </div>
            </div>
            <div className="min-h-0 flex-1 overflow-y-auto p-3">
              <p className="px-2 pb-2 text-xs font-bold uppercase tracking-wide text-white/35">Text channels</p>
              {textChannels.map((channel) => (
                <button key={channel.id} type="button" onClick={() => setChannelId(channel.id)} className={`cursor-target flex w-full items-center gap-2 rounded px-2.5 py-1.5 text-left text-[15px] font-medium ${selectedChannel?.id === channel.id ? "bg-white/10 text-white" : "text-[#949ba4] hover:bg-white/[.06] hover:text-[#dbdee1]"}`}><Hash size={17}/>{channel.name}</button>
              ))}
              <div className="my-3 h-px bg-black/30" />
              <p className="px-2 pb-2 text-xs font-bold uppercase tracking-wide text-white/35">Voice channels</p>
              {voiceChannels.map((channel) => {
                const fullId = `server-${server.id}-${channel.id}`;
                const joined = voice.joinedChannelId === fullId;
                return <button key={channel.id} type="button" onClick={() => void joinVoice(channel)} className={`cursor-target flex w-full items-center gap-2 rounded px-2.5 py-1.5 text-left text-[15px] font-medium ${joined ? "bg-emerald-400/10 text-emerald-200" : "text-[#949ba4] hover:bg-white/[.06] hover:text-[#dbdee1]"}`}><Volume2 size={17}/><span className="min-w-0 flex-1 truncate">{channel.name}</span>{joined && (voice.muted ? <MicOff size={14}/> : <Mic size={14}/>)}</button>;
              })}
              {isBannedHere && <p className="mt-3 rounded-xl border border-red-400/20 bg-red-500/10 p-3 text-xs text-red-200">You are banned from chatting in this server.</p>}
            </div>
            <div className="border-t border-black/40 bg-[#232428] p-3">
              <div className="flex items-center gap-2">{myProfile?.photoUrl ? <img src={myProfile.photoUrl} alt="" className="h-8 w-8 rounded-full object-cover"/> : <span className="grid h-8 w-8 place-items-center rounded-full bg-white/10 text-xs font-bold">{initial(myProfile?.displayName || user?.email, "U")}</span>}<div className="min-w-0 flex-1"><p className="truncate text-xs font-bold text-white">{safeText(myProfile?.displayName || user?.displayName, "You")}</p><p className="truncate text-[10px] text-white/35">{voice.joinedChannelId ? "Voice connected" : "Online"}</p></div>{voice.joinedChannelId && (voice.muted ? <MicOff size={14} className="text-red-300"/> : <Mic size={14} className="text-emerald-300"/>)}</div>
            </div>
          </aside>

          <main className="min-h-0 min-w-0 bg-[#313338]">
            {selectedChannel?.id === "rules" ? (
              <div className="flex h-full min-h-0 flex-col">
                <header className="flex h-[49px] items-center gap-2 border-b border-black/35 bg-[#313338] px-5 shadow-sm shadow-black/20"><ShieldCheck size={19} className="text-white/45"/><h2 className="font-bold text-white">rules</h2></header>
                <div className="mx-auto max-w-2xl px-6 py-12"><span className="grid h-16 w-16 place-items-center rounded-full bg-brand-500/15 text-brand-200"><ShieldCheck size={30}/></span><h2 className="mt-5 text-2xl font-black text-white">Welcome to {serverName}</h2><p className="mt-2 text-sm leading-6 text-white/45">{serverDescription}</p><div className="mt-8 space-y-3">{serverRules.length ? serverRules.map((rule, index) => <div key={`${index}-${rule}`} className="flex gap-3 rounded-xl border border-white/[.07] bg-white/[.025] p-4"><span className="grid h-7 w-7 shrink-0 place-items-center rounded-lg bg-brand-500/15 font-mono text-xs font-black text-brand-200">{index + 1}</span><p className="pt-1 text-sm leading-5 text-white/70">{rule}</p></div>) : <p className="rounded-xl border border-white/[.07] bg-white/[.025] p-4 text-sm text-white/45">No rules posted yet.</p>}</div></div>
              </div>
            ) : (
              <CommunityServerChat key={`${server.id}:${selectedChannel?.id}`} server={server} embedded channelId={selectedChannel?.id ?? "general"} channelName={selectedChannel?.name ?? "general"} />
            )}
          </main>

          <aside className="hidden min-h-0 overflow-y-auto border-l border-black/40 bg-[#2b2d31] p-4 xl:block">
            <div><p className="text-xs font-bold uppercase tracking-wide text-white/35">About</p><p className="mt-3 text-sm leading-6 text-[#b5bac1]">{serverDescription}</p></div>
            <div className="mt-5 rounded-xl border border-white/[.07] bg-black/15 p-3"><button type="button" onClick={() => { void navigator.clipboard?.writeText(inviteUrl); setNotice("Invite link copied."); }} className="flex w-full items-center justify-center gap-2 rounded-lg bg-brand-500 px-3 py-2 text-xs font-bold text-white hover:bg-brand-400"><Copy size={13}/>Copy invite</button><p className="mt-2 truncate text-center font-mono text-[10px] text-white/30">{inviteCode}</p></div>
            <div className="mt-5 rounded-xl border border-white/[.07] bg-black/15 p-3">
              <p className="font-mono text-[10px] font-bold uppercase tracking-[.16em] text-white/28">Minecraft Education</p>
              {linkedMinecraftServer ? (
                <div className="mt-3">
                  <div className="flex items-center justify-between gap-3">
                    <div className="min-w-0"><p className="truncate text-sm font-bold text-white">{linkedMinecraftServer.name}</p><p className="mt-0.5 text-[11px] text-white/35">{linkedMinecraftServer.edition || "Minecraft Education"}</p></div>
                    <span className={`rounded-full px-2 py-1 text-[10px] font-bold ${linkedMinecraftServer.isOnline ? "bg-emerald-400/10 text-emerald-300" : "bg-white/[.06] text-white/35"}`}>{linkedMinecraftServer.isOnline ? "ONLINE" : "OFFLINE"}</span>
                  </div>
                  {linkedMinecraftServer.isOnline ? (
                    <>
                      <div className="mt-3 grid grid-cols-4 gap-2">
                        {linkedMinecraftCode.map((icon) => <div key={icon.id} className="grid place-items-center rounded-lg border border-brand-300/20 bg-brand-500/[.08] p-2"><img src={icon.src} alt={icon.label} className="h-8 w-8 object-contain"/><span className="mt-1 text-[9px] font-bold text-white/55">{icon.label}</span></div>)}
                      </div>
                      <button type="button" onClick={() => { void navigator.clipboard?.writeText(linkedMinecraftCodeText); setNotice("MC Edu join code copied."); }} className="mt-3 flex w-full items-center justify-center gap-2 rounded-lg border border-white/10 bg-white/[.04] px-3 py-2 text-xs font-bold text-white/70 hover:bg-white/[.08]"><Copy size={13}/>Copy join code</button>
                    </>
                  ) : <p className="mt-3 rounded-lg border border-white/[.07] bg-white/[.03] p-3 text-xs leading-5 text-white/40">Offline right now. The MC Edu join code appears here automatically when the host turns it online.</p>}
                </div>
              ) : <p className="mt-3 text-xs leading-5 text-white/35">{canManage ? "Link one in settings to show live MC Edu status and join code." : "No Minecraft server linked yet."}</p>}
            </div>
            <div className="mt-6 border-t border-white/[.08] pt-5"><p className="flex items-center gap-2 text-xs font-bold uppercase tracking-wide text-white/35"><Users size={12}/>Members — {members.length}</p><div className="mt-3 space-y-1">{members.map((profile) => { const profileName = safeText(profile.displayName || profile.username, "Member"); return <button key={profile.id} type="button" onClick={() => setOpenProfileId(profile.id)} className="cursor-target flex w-full items-center gap-2.5 rounded px-2 py-1.5 text-left hover:bg-white/[.06]">{profile.photoUrl ? <img src={profile.photoUrl} alt="" className="h-8 w-8 rounded-full object-cover"/> : <span className="grid h-8 w-8 place-items-center rounded-full bg-white/[.07] text-[10px] font-bold text-white/65">{initial(profileName, "M")}</span>}<span className="min-w-0 flex-1"><span className="block truncate text-sm font-medium text-[#dbdee1]">{profileName}</span><span className="block text-[10px] uppercase text-white/30">{roleFor(profile)}</span></span><StatusDot status={getPresenceStatus(profile)}/></button>; })}</div></div>
            <div className="mt-6 border-t border-white/[.08] pt-5"><p className="text-xs font-bold uppercase tracking-wide text-white/35">Online — {onlineMembers.length}</p></div>
          </aside>
        </div>
      </div>

      {settingsOpen && canManage && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/70 p-4" onClick={() => setSettingsOpen(false)}>
          <div className="max-h-[90vh] w-full max-w-3xl overflow-y-auto rounded-2xl border border-white/10 bg-[#11151d] p-5 shadow-2xl" onClick={(event) => event.stopPropagation()}>
            <div className="flex items-center justify-between"><h2 className="text-lg font-bold text-white">Server settings</h2><button type="button" onClick={() => setSettingsOpen(false)} className="rounded-lg p-2 text-white/45 hover:bg-white/10 hover:text-white"><X size={16}/></button></div>
            <div className="mt-5 grid gap-4 md:grid-cols-2">
              <section className="rounded-xl border border-white/8 bg-black/15 p-4">
                <h3 className="font-bold text-white">Look</h3>
                <p className="mt-1 text-xs leading-5 text-white/35">Paste an image or GIF link — it'll animate automatically.</p>
                <div className="mt-3 flex items-center gap-3">
                  <span className="grid h-12 w-12 shrink-0 place-items-center overflow-hidden rounded-full bg-[#1e1f22] text-sm font-black text-white">{iconUrl ? <img src={iconUrl} alt="" className="h-full w-full object-cover"/> : initial(serverName)}</span>
                  <input value={iconUrl} onChange={(event) => setIconUrl(event.target.value)} placeholder="Icon image or GIF URL" className="min-w-0 flex-1 rounded-lg border border-white/10 bg-black/25 px-3 py-2 text-sm text-white outline-none"/>
                </div>
                <div className="mt-3">
                  <div className="aspect-[3/1] w-full overflow-hidden rounded-lg bg-[#1e1f22]">{bannerUrl && <img src={bannerUrl} alt="" className="h-full w-full object-cover"/>}</div>
                  <input value={bannerUrl} onChange={(event) => setBannerUrl(event.target.value)} placeholder="Banner image or GIF URL" className="mt-2 w-full rounded-lg border border-white/10 bg-black/25 px-3 py-2 text-sm text-white outline-none"/>
                </div>
                <button type="button" onClick={() => void saveAppearance()} className="mt-3 rounded-lg bg-brand-500 px-3 py-2 text-xs font-bold text-white">Save look</button>
              </section>
              <section className="rounded-xl border border-white/8 bg-black/15 p-4">
                <h3 className="font-bold text-white">Visibility</h3>
                <p className="mt-1 text-xs leading-5 text-white/35">Public servers show up in Join a server. Private servers only join through an invite link.</p>
                <div className="mt-3 flex gap-2">
                  <button type="button" onClick={() => void setVisibility(true)} className={`flex flex-1 items-center justify-center gap-1.5 rounded-lg px-3 py-2 text-xs font-bold ${server.isPublic !== false ? "bg-brand-500 text-white" : "bg-white/10 text-white/50 hover:bg-white/15"}`}><Globe2 size={13}/>Public</button>
                  <button type="button" onClick={() => void setVisibility(false)} className={`flex flex-1 items-center justify-center gap-1.5 rounded-lg px-3 py-2 text-xs font-bold ${server.isPublic === false ? "bg-brand-500 text-white" : "bg-white/10 text-white/50 hover:bg-white/15"}`}><Lock size={13}/>Private</button>
                </div>
              </section>
              <section className="rounded-xl border border-white/8 bg-black/15 p-4"><h3 className="font-bold text-white">Minecraft link</h3><p className="mt-1 text-xs leading-5 text-white/35">When the linked Minecraft server is online, this chat server shows its MC Edu join-code icons.</p><select value={linkedMinecraftServerId} onChange={(event) => setLinkedMinecraftServerId(event.target.value)} className="mt-3 w-full rounded-lg border border-white/10 bg-[#11151d] px-3 py-2 text-sm text-white outline-none"><option value="">No linked Minecraft server</option>{minecraftServers.map((item) => <option key={item.id} value={item.id}>{item.name} {item.isOnline ? "· online" : "· offline"}</option>)}</select><button type="button" onClick={() => void saveMinecraftLink()} className="mt-3 rounded-lg bg-brand-500 px-3 py-2 text-xs font-bold text-white">Save link</button></section>
              <section className="rounded-xl border border-white/8 bg-black/15 p-4"><h3 className="font-bold text-white">Invite / ban</h3><div className="mt-3 flex gap-2"><input value={memberLookup} onChange={(event) => setMemberLookup(event.target.value)} placeholder="@username to invite" className="min-w-0 flex-1 rounded-lg border border-white/10 bg-black/25 px-3 py-2 text-sm text-white outline-none"/><button type="button" onClick={() => void inviteMember()} className="rounded-lg bg-emerald-500 px-3 py-2 text-xs font-bold text-white">Invite</button></div><div className="mt-2 flex gap-2"><input value={banLookup} onChange={(event) => setBanLookup(event.target.value)} placeholder="@username to ban" className="min-w-0 flex-1 rounded-lg border border-white/10 bg-black/25 px-3 py-2 text-sm text-white outline-none"/><button type="button" onClick={() => void banMember()} className="rounded-lg bg-red-500 px-3 py-2 text-xs font-bold text-white">Ban</button></div></section>
              <section className="rounded-xl border border-white/8 bg-black/15 p-4"><h3 className="font-bold text-white">Channels</h3><div className="mt-3 flex gap-2"><input value={newTextChannel} onChange={(event) => setNewTextChannel(event.target.value)} placeholder="new text channel" className="min-w-0 flex-1 rounded-lg border border-white/10 bg-black/25 px-3 py-2 text-sm text-white outline-none"/><button type="button" onClick={() => void addTextChannel()} className="grid h-10 w-10 place-items-center rounded-lg bg-white/10 text-white"><Plus size={15}/></button></div><div className="mt-2 flex gap-2"><input value={newVoiceChannel} onChange={(event) => setNewVoiceChannel(event.target.value)} placeholder="new voice channel" className="min-w-0 flex-1 rounded-lg border border-white/10 bg-black/25 px-3 py-2 text-sm text-white outline-none"/><button type="button" onClick={() => void addVoiceChannel()} className="grid h-10 w-10 place-items-center rounded-lg bg-white/10 text-white"><Plus size={15}/></button></div></section>
              <section className="rounded-xl border border-white/8 bg-black/15 p-4"><h3 className="font-bold text-white">Roles</h3><div className="mt-3 max-h-64 space-y-2 overflow-y-auto">{members.map((profile) => <div key={profile.id} className="flex items-center gap-2 rounded-lg bg-black/20 p-2"><span className="min-w-0 flex-1 truncate text-sm text-white/70">{profile.displayName}</span>{profile.id === server.ownerId ? <span className="flex items-center gap-1 rounded-md bg-amber-400/10 px-2 py-1 text-[10px] font-bold text-amber-200"><Crown size={11}/>OWNER</span> : <><select value={roleFor(profile)} onChange={(event) => void setMemberRole(profile, event.target.value as CommunityServerRole)} className="rounded-md border border-white/10 bg-[#11151d] px-2 py-1 text-xs text-white">{roleOptions.map((item) => <option key={item} value={item}>{item}</option>)}</select><button type="button" onClick={() => void kickMember(profile)} title="Kick" className="rounded-md p-1.5 text-white/35 hover:bg-red-500/10 hover:text-red-300"><UserMinus size={14}/></button><button type="button" onClick={() => void banProfile(profile)} title="Ban" className="rounded-md p-1.5 text-white/35 hover:bg-red-500/10 hover:text-red-300"><Ban size={14}/></button></>}</div>)}</div></section>
            </div>
            {notice && <p className="mt-4 rounded-xl border border-brand-400/15 bg-brand-500/10 px-3 py-2 text-xs text-brand-200">{notice}</p>}
          </div>
        </div>
      )}
      {openProfileId && <ProfileCard userId={openProfileId} onClose={() => setOpenProfileId(null)}/>}
    </div>
  );
}
