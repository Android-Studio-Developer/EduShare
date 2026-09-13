import { useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import { Bell, BellOff, CheckCheck, Clock3, Hash, Reply, Send, Trash2, Wifi, WifiOff, X } from "lucide-react";
import { useAuth } from "../context/AuthContext";
import { checkLocalProfanity, formatBanRemaining, getChatBanRemaining, screenChatMessageRemote } from "../lib/aiModeration";
import { deleteCommunityChatMessage, sendCommunityChatMessage, subscribeToCommunityChatMessages } from "../lib/communityChatServers";
import { isOnline, subscribeToAllProfiles, subscribeToProfile } from "../lib/profiles";
import { subscribeToGuilds } from "../lib/guilds";
import { createNotification } from "../lib/notifications";
import { isStaffRole } from "../lib/moderation";
import { rankNameClass } from "../lib/ranks";
import type { ChatMessage, CommunityChatServer, CustomEmoji, Guild, UserProfile } from "../types";
import Button from "./Button";
import ProfileCard from "./ProfileCard";
import RankBadge from "./RankBadge";
import GuildTag from "./GuildTag";
import MentionInput from "./MentionInput";

function timeAgo(ts: number) {
  const seconds = Math.floor((Date.now() - ts) / 1000);
  if (seconds < 60) return "now";
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h`;
  return `${Math.floor(seconds / 86400)}d`;
}

const EMOJI_RE = /(:[a-z0-9_]{1,20}:)/gi;

function safeText(value: unknown, fallback = "") {
  return typeof value === "string" && value.trim() ? value : fallback;
}

function initial(value: unknown, fallback = "M") {
  return safeText(value, fallback).slice(0, 1).toUpperCase();
}

function publicEmojiPool(profiles: UserProfile[], authorId: string) {
  const byName = new Map<string, CustomEmoji>();
  const author = profiles.find((item) => item.id === authorId);
  [...(author?.customEmojis ?? []), ...profiles.flatMap((item) => item.customEmojis ?? [])].forEach((emoji) => {
    const name = emoji.name?.trim().toLowerCase();
    if (name && emoji.url && !byName.has(name)) byName.set(name, { ...emoji, name });
  });
  return byName;
}

function renderEmojiText(text: string, emojis: Map<string, CustomEmoji>) {
  const safeText = text ?? "";
  const exact = safeText.trim().match(/^:([a-z0-9_]{1,20}):$/i);
  const exactEmoji = exact ? emojis.get(exact[1].toLowerCase()) : undefined;
  if (exactEmoji) return <img src={exactEmoji.url} alt={`:${exactEmoji.name}:`} title={`:${exactEmoji.name}:`} className="my-1 h-24 w-24 object-contain"/>;
  return safeText.split(EMOJI_RE).map((part, index) => {
    const match = part.match(/^:([a-z0-9_]{1,20}):$/i);
    const emoji = match ? emojis.get(match[1].toLowerCase()) : undefined;
    return emoji ? <img key={`${emoji.id}-${index}`} src={emoji.url} alt={`:${emoji.name}:`} title={`:${emoji.name}:`} className="mx-0.5 inline-block h-8 w-8 align-middle object-contain"/> : part;
  });
}

const PING_RE = /(@(?:everyone|here|admins|mods|owner)\b)/gi;
const PING_EXACT_RE = /^@(everyone|here|admins|mods|owner)$/i;

function renderMessageText(text: string, emojis: Map<string, CustomEmoji>) {
  const safeText = text ?? "";
  return safeText.split(PING_RE).map((part, index) => PING_EXACT_RE.test(part)
    ? <span key={`ping-${index}`} className="mx-0.5 rounded bg-brand-500/20 px-1 py-0.5 font-semibold text-brand-200">{part}</span>
    : <span key={`seg-${index}`}>{renderEmojiText(part, emojis)}</span>);
}

function resolvePingRecipients(value: string, server: CommunityChatServer, profiles: UserProfile[], senderId: string) {
  const lower = value.toLowerCase();
  const memberIds = [...new Set([server.ownerId, ...(server.memberIds ?? [])])];
  const roleOf = (id: string) => (id === server.ownerId ? "owner" : server.roles?.[id] ?? "member");
  const ids = new Set<string>();
  const labels: string[] = [];
  if (/@everyone\b/.test(lower)) { memberIds.forEach((id) => ids.add(id)); labels.push("everyone"); }
  if (/@here\b/.test(lower)) { const onlineIds = new Set(profiles.filter(isOnline).map((item) => item.id)); memberIds.filter((id) => onlineIds.has(id)).forEach((id) => ids.add(id)); labels.push("here"); }
  if (/@admins\b/.test(lower)) { memberIds.filter((id) => roleOf(id) === "admin").forEach((id) => ids.add(id)); labels.push("admins"); }
  if (/@mods\b/.test(lower)) { memberIds.filter((id) => roleOf(id) === "mod").forEach((id) => ids.add(id)); labels.push("mods"); }
  if (/@owner\b/.test(lower)) { ids.add(server.ownerId); labels.push("owner"); }
  ids.delete(senderId);
  return { ids: [...ids].slice(0, 50), labels };
}

export default function CommunityServerChat({ server, embedded = false, channelId = "general", channelName = "general" }: { server: CommunityChatServer; embedded?: boolean; channelId?: string; channelName?: string }) {
  const { user, role } = useAuth();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [profiles, setProfiles] = useState<UserProfile[]>([]);
  const [guilds, setGuilds] = useState<Guild[]>([]);
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const [notice, setNotice] = useState("");
  useEffect(() => {
    if (!notice) return;
    const timer = window.setTimeout(() => setNotice(""), 6_000);
    return () => window.clearTimeout(timer);
  }, [notice]);
  const [replyTo, setReplyTo] = useState<ChatMessage | null>(null);
  const [replyPing, setReplyPing] = useState(true);
  const [openProfileId, setOpenProfileId] = useState<string | null>(null);
  const [chatStatus, setChatStatus] = useState<"online" | "reconnecting" | "offline">(navigator.onLine ? "online" : "offline");
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const online = () => setChatStatus("online");
    const offline = () => setChatStatus("offline");
    window.addEventListener("online", online); window.addEventListener("offline", offline);
    const unsubscribe = subscribeToCommunityChatMessages(server.id, (items) => { setMessages(items); setChatStatus(navigator.onLine ? "online" : "offline"); }, () => setChatStatus(navigator.onLine ? "reconnecting" : "offline"), channelId);
    return () => { unsubscribe(); window.removeEventListener("online", online); window.removeEventListener("offline", offline); };
  }, [server.id, channelId]);
  useEffect(() => {
    if (!user) return undefined;
    const unsubscribe = subscribeToProfile(user.uid, setProfile);
    return typeof unsubscribe === "function" ? unsubscribe : undefined;
  }, [user]);
  useEffect(() => {
    const unsubscribe = subscribeToAllProfiles(setProfiles);
    return typeof unsubscribe === "function" ? unsubscribe : undefined;
  }, []);
  useEffect(() => {
    const unsubscribe = subscribeToGuilds(setGuilds);
    return typeof unsubscribe === "function" ? unsubscribe : undefined;
  }, []);
  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages.length]);
  const guildByProfileId = useMemo(() => {
    const guildById = new Map(guilds.map((guild) => [guild.id, guild]));
    return new Map(profiles.map((item) => [item.id, item.guildId ? guildById.get(item.guildId) : undefined]));
  }, [guilds, profiles]);
  const roomName = safeText(embedded ? channelName : server.name, "general");

  async function submit(event: FormEvent) {
    event.preventDefault();
    const value = text.trim().slice(0, 300);
    if (!user || !profile || !value) return;
    setNotice("");
    const profileNames = [profile.displayName, profile.username].filter(Boolean).map((item) => safeText(item).toLowerCase());
    const serverBans = (server.bannedUsernames ?? []).map((item) => item.toLowerCase());
    if ((server.bannedUserIds ?? []).includes(user.uid) || profileNames.some((name) => serverBans.includes(name))) {
      setNotice("You are banned from this server.");
      return;
    }
    const remaining = getChatBanRemaining(user.uid, user.email);
    if (remaining > 0) { setNotice(`AI moderation paused your chat for ${formatBanRemaining(remaining)}.`); return; }
    const localHit = checkLocalProfanity(value);
    if (localHit) { setNotice(`Message blocked: ${localHit.reason}.`); return; }
    setSending(true);
    try {
      const sentReply = replyTo;
      const shouldPingReply = replyPing;
      const pingTargets = resolvePingRecipients(value, server, profiles, user.uid);
      const sendPromise = sendCommunityChatMessage(server.id, user.uid, safeText(profile.displayName, "Member"), profile.rank, profile.photoUrl || "", value, replyTo ? { id: replyTo.id, authorId: replyTo.authorId, author: safeText(replyTo.authorName, "Member"), text: safeText(replyTo.text), ping: replyPing } : undefined, channelId);
      const queuedNotice = window.setTimeout(() => setNotice("Message queued — reconnecting to chat…"), 4_000);
      setText("");
      setReplyTo(null);
      setReplyPing(true);
      void sendPromise.then((sent) => {
        window.clearTimeout(queuedNotice);
        setNotice("");
        if (sentReply && shouldPingReply && sentReply.authorId !== user.uid) {
          void createNotification({ recipientId: sentReply.authorId, type: "mention", title: `${safeText(profile.displayName, "Someone")} replied to you in #${roomName}`, message: value.slice(0, 100), link: `/chat-servers/${server.id}` });
        }
        pingTargets.ids.forEach((recipientId) => {
          void createNotification({ recipientId, type: "mention", title: `${safeText(profile.displayName, "Someone")} pinged @${pingTargets.labels.join(", @")} in #${roomName}`, message: value.slice(0, 100), link: `/chat-servers/${server.id}` });
        });
        void screenChatMessageRemote(user.uid, value, user.email).then((result) => {
          if (result.spam) void deleteCommunityChatMessage(server.id, sent.id, channelId);
        }).catch(() => undefined);
      }).catch((error) => {
        window.clearTimeout(queuedNotice);
        setText((current) => current || value);
        if (sentReply) { setReplyTo(sentReply); setReplyPing(shouldPingReply); }
        setNotice(error instanceof Error ? error.message : "Could not send that message.");
      });
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Could not send that message.");
    } finally {
      setSending(false);
    }
  }

  return (
    <div className={`flex h-full min-h-[700px] flex-col overflow-hidden bg-[#313338] ${embedded ? "rounded-none border-0" : "rounded-2xl border border-black/35"}`}>
      <header className="flex h-[49px] items-center gap-3 border-b border-black/35 bg-[#313338] px-4 shadow-sm shadow-black/20">
        <Hash size={22} className="shrink-0 text-[#80848e]" />
        <div className="min-w-0 flex-1"><h2 className="truncate text-base font-bold text-white">{roomName}</h2></div><span className={`ml-auto flex items-center gap-1 rounded px-2 py-1 text-[10px] ${chatStatus === "online" ? "text-emerald-300/80" : chatStatus === "reconnecting" ? "text-amber-300/80" : "text-red-300/80"}`}>{chatStatus === "online" ? <Wifi size={11}/> : <WifiOff size={11}/>} {chatStatus}</span>
      </header>
      <div ref={scrollRef} className="min-h-0 flex-1 space-y-1 overflow-y-auto px-4 py-3">
        {messages.length === 0 && <div className="grid min-h-80 place-items-center text-center"><div><Hash size={32} className="mx-auto text-white/15"/><p className="mt-3 text-sm font-semibold text-white/55">Start the conversation</p><p className="mt-1 text-xs text-white/30">This is the beginning of #{roomName}.</p></div></div>}
        {messages.map((message) => {
          const authorName = safeText(message.authorName, "Member");
          const messageText = safeText(message.text);
          return (
          <div key={message.id} id={`community-message-${message.id}`} className="group flex items-start gap-3 px-2 py-1.5 hover:bg-black/[.08]">
            <button type="button" onClick={() => setOpenProfileId(message.authorId)} className="cursor-target shrink-0">
              {message.authorPhotoUrl ? <img src={message.authorPhotoUrl} alt="" className="h-9 w-9 rounded-full object-cover"/> : <span className="grid h-9 w-9 place-items-center rounded-full bg-brand-500/15 font-bold text-brand-300">{initial(authorName)}</span>}
            </button>
            <div className="min-w-0 flex-1">{message.replyToId && <button type="button" onClick={() => document.getElementById(`community-message-${message.replyToId}`)?.scrollIntoView({ behavior: "smooth", block: "center" })} className="cursor-target mb-1 flex max-w-full items-center gap-1.5 text-left text-[10px] text-white/35 hover:text-white/55"><Reply size={10}/><span className="shrink-0 font-semibold text-brand-300/70">{safeText(message.replyToAuthor, "Member")}</span><span className="truncate">{safeText(message.replyToText)}</span>{message.replyPing === false && <BellOff size={9}/>}</button>}<div className="flex flex-wrap items-center gap-1.5"><button type="button" onClick={() => setOpenProfileId(message.authorId)} className={`cursor-target truncate text-sm font-semibold ${rankNameClass(message.authorRank)}`}>{authorName}</button><GuildTag tag={guildByProfileId.get(message.authorId)?.tag} icon={guildByProfileId.get(message.authorId)?.tagIcon} font={guildByProfileId.get(message.authorId)?.tagFont} imageUrl={guildByProfileId.get(message.authorId)?.tagImageUrl} color={guildByProfileId.get(message.authorId)?.tagColor}/><RankBadge rank={message.authorRank}/><span className="text-[10px] text-white/25">{timeAgo(message.createdAt)}</span>{message.deliveryState === "sending" ? <Clock3 size={10} className="text-amber-300/60"/> : message.authorId === user?.uid ? <CheckCheck size={10} className="text-emerald-300/45"/> : null}</div><p className="mt-0.5 break-words text-sm text-white/72 [overflow-wrap:anywhere]">{renderMessageText(messageText, publicEmojiPool(profiles, message.authorId))}</p></div>
            <button type="button" onClick={() => { setReplyTo(message); setReplyPing(true); }} aria-label={`Reply to ${authorName}`} className="cursor-target rounded p-1.5 text-white/25 opacity-0 hover:bg-white/10 hover:text-[#dbdee1] group-hover:opacity-100"><Reply size={13}/></button>
            {(user?.uid === message.authorId || user?.uid === server.ownerId || isStaffRole(role)) && <button type="button" onClick={() => void deleteCommunityChatMessage(server.id, message.id, channelId)} aria-label="Delete message" className="cursor-target opacity-0 rounded p-1.5 text-white/25 hover:bg-red-500/10 hover:text-red-300 group-hover:opacity-100"><Trash2 size={13}/></button>}
          </div>
        );})}
      </div>
      <form onSubmit={submit} className="px-4 pb-5 pt-2">
        {replyTo && <div className="mb-2 flex items-center gap-2 rounded-xl border border-brand-400/15 bg-brand-500/[.06] px-3 py-2 text-xs"><Reply size={13} className="text-brand-300"/><span className="min-w-0 flex-1 truncate text-white/55">Replying to <b className="text-white/80">{safeText(replyTo.authorName, "Member")}</b>: {safeText(replyTo.text)}</span><button type="button" role="switch" aria-checked={replyPing} onClick={() => setReplyPing((value) => !value)} className={`cursor-target flex shrink-0 items-center gap-1 rounded-lg border px-2 py-1 font-semibold ${replyPing ? "border-brand-400/35 bg-brand-500/15 text-brand-200" : "border-white/10 text-white/35"}`}>{replyPing ? <Bell size={11}/> : <BellOff size={11}/>} {replyPing ? "Ping on" : "Ping off"}</button><button type="button" onClick={() => { setReplyTo(null); setReplyPing(true); }} aria-label="Cancel reply" className="cursor-target p-1 text-white/35 hover:text-white"><X size={13}/></button></div>}
        <div className="flex gap-2"><MentionInput value={text} onChange={setText} profiles={profiles} disabled={!user} maxLength={300} placeholder={user ? `Message #${roomName}` : "Log in to chat"} includeSpecial roles={[{ handle: "admins", label: "Admins" }, { handle: "mods", label: "Mods" }, { handle: "owner", label: "Owner" }]} className="w-full rounded-lg border-0 bg-[#383a40] px-4 py-3 text-sm text-white placeholder:text-[#949ba4] focus:outline-none"/><Button type="submit" disabled={!user || sending || !text.trim()}><Send size={15}/></Button></div>
        {notice && <p className="chat-system-notice mt-2 text-xs text-amber-300">{notice}</p>}
      </form>
      {openProfileId && <ProfileCard userId={openProfileId} onClose={() => setOpenProfileId(null)}/>} 
    </div>
  );
}
