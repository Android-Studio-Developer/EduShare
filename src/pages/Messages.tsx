import { useEffect, useMemo, useRef, useState, type ChangeEvent, type FormEvent } from "react";
import { useNavigate, useParams } from "react-router-dom";
import {
  CornerUpLeft,
  File as FileIcon,
  LogOut,
  MessageSquare,
  Pin,
  PinOff,
  Phone,
  PhoneOff,
  Plus,
  Search,
  Send,
  SmilePlus,
  Trash2,
  UserRoundX,
  Users,
  UsersRound,
  X,
} from "lucide-react";
import { useAuth } from "../context/AuthContext";
import { useVoiceCall } from "../context/VoiceCallContext";
import botIconUrl from "../assets/icons/boticon.svg";
import { askAi } from "../lib/aiModeration";
import { deleteChatFile, isAppwriteConfigured, uploadChatFile } from "../lib/appwrite";
import {
  clearDmTyping,
  createGroupDm,
  deleteDm,
  deleteDmMessage,
  disbandGroupDm,
  dmIdFor,
  ensureDm,
  endDmCall,
  GROUP_DM_MAX_MEMBERS,
  leaveGroupDm,
  sendDmMessage,
  setGroupIcon,
  setDmTyping,
  startDmCall,
  subscribeToDmMessages,
  subscribeToDmTyping,
  subscribeToMyDms,
  toggleDmPin,
  toggleDmReaction,
  type DmTyper,
} from "../lib/dm";
import { ensureDmVoiceChannel } from "../lib/voice";
import { removeFriendRequest, subscribeToMyFriendRequests } from "../lib/friends";
import { createNotification } from "../lib/notifications";
import { extractEmbedUrl, isEmbedRequest } from "../lib/embed";
import { getPresenceStatus, subscribeToAllProfiles } from "../lib/profiles";
import { rankNameClass } from "../lib/ranks";
import type { DmConversation, DmMessage, FriendRequest, UserProfile } from "../types";
import StatusDot from "../components/StatusDot";
import RankBadge from "../components/RankBadge";
import GameActivityCard from "../components/GameActivityCard";
import ProfileCard from "../components/ProfileCard";

const AI_COOLDOWN_MS = 8000;
const REACTION_EMOJIS = ["👍", "❤️", "😂", "😮", "😢", "🔥"];
const GROUP_WINDOW_MS = 5 * 60_000;

function timeAgo(ts: number) {
  if (!ts) return "";
  const s = Math.floor((Date.now() - ts) / 1000);
  if (s < 60) return "now";
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h`;
  const d = Math.floor(h / 24);
  if (d < 7) return `${d}d`;
  return new Date(ts).toLocaleDateString();
}

function formatDate(ts: number) {
  return new Date(ts).toLocaleDateString(undefined, { year: "numeric", month: "long", day: "numeric" });
}

function Avatar({ photoUrl, name, size = 32 }: { photoUrl: string; name: string; size?: number }) {
  const style = { width: size, height: size };
  return photoUrl ? (
    <img src={photoUrl} alt="" style={style} className="shrink-0 rounded-full object-cover" />
  ) : (
    <div style={style} className="flex shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-cyan-400 to-fuchsia-500 font-bold text-white" >
      {name.slice(0, 1).toUpperCase()}
    </div>
  );
}

// Same embed:/iframe: convention as profile banners — a group can set its
// icon to a live embedded page (sandboxed) instead of a plain image.
function GroupIcon({ iconUrl, size = 32 }: { iconUrl: string; size?: number }) {
  const style = { width: size, height: size };
  const requestedEmbed = isEmbedRequest(iconUrl);
  const embedUrl = extractEmbedUrl(iconUrl);

  if (!iconUrl.trim()) {
    return (
      <span style={style} className="grid shrink-0 place-items-center rounded-full bg-brand-500/20 text-brand-300">
        <UsersRound size={Math.round(size * 0.55)} />
      </span>
    );
  }

  if (requestedEmbed) {
    if (!embedUrl) {
      return (
        <span style={style} className="grid shrink-0 place-items-center rounded-full bg-black/40 text-center text-[7px] font-semibold leading-none text-white/55">
          bad URL
        </span>
      );
    }
    return (
      <span style={style} className="relative shrink-0 overflow-hidden rounded-full bg-black">
        <iframe
          src={embedUrl}
          title="Group icon embed"
          loading="lazy"
          referrerPolicy="no-referrer"
          sandbox="allow-same-origin allow-scripts"
          className="pointer-events-none h-full w-full border-0"
        />
      </span>
    );
  }

  return <img src={iconUrl} alt="" style={style} className="shrink-0 rounded-full object-cover" />;
}

export default function Messages() {
  const { otherId: routeOtherId } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const voice = useVoiceCall();

  const [profiles, setProfiles] = useState<UserProfile[]>([]);
  const [conversations, setConversations] = useState<DmConversation[]>([]);
  const [friendRequests, setFriendRequests] = useState<FriendRequest[]>([]);
  const [search, setSearch] = useState("");
  const [showProfilePanel, setShowProfilePanel] = useState(true);
  const [showPinned, setShowPinned] = useState(false);
  const [openFullProfile, setOpenFullProfile] = useState(false);
  const [showNewGroup, setShowNewGroup] = useState(false);
  const [groupName, setGroupName] = useState("");
  const [groupIconUrl, setGroupIconUrl] = useState("");
  const [editIconUrl, setEditIconUrl] = useState("");
  const [showEditIcon, setShowEditIcon] = useState(false);
  const [groupMemberIds, setGroupMemberIds] = useState<Set<string>>(new Set());
  const [groupError, setGroupError] = useState("");

  const [messages, setMessages] = useState<DmMessage[]>([]);
  const [dmId, setDmId] = useState<string | null>(null);
  const [text, setText] = useState("");
  const [replyTo, setReplyTo] = useState<DmMessage | null>(null);
  const [typers, setTypers] = useState<DmTyper[]>([]);
  const [uploading, setUploading] = useState(false);

  const scrollRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const lastAiCallRef = useRef(0);
  const typingClearRef = useRef<number | null>(null);
  const lastTypingSentRef = useRef(0);

  const myProfile = profiles.find((p) => p.id === user?.uid) ?? null;
  const myName = myProfile?.displayName || user?.displayName || "Player";

  useEffect(() => subscribeToAllProfiles(setProfiles), []);
  useEffect(() => {
    if (!user) return;
    return subscribeToMyDms(user.uid, setConversations);
  }, [user]);
  useEffect(() => {
    if (!user) return;
    return subscribeToMyFriendRequests(user.uid, (sent, received) => setFriendRequests([...sent, ...received].filter((r) => r.status === "accepted")));
  }, [user]);

  const profileById = useMemo(() => new Map(profiles.map((p) => [p.id, p])), [profiles]);

  // Accepted friends only — who you're allowed to start a group chat with.
  const friendProfiles = useMemo(() => {
    if (!user) return [];
    return friendRequests
      .map((r) => profileById.get(r.fromId === user.uid ? r.toId : r.fromId))
      .filter((p): p is UserProfile => !!p);
  }, [friendRequests, profileById, user]);

  const conversationRows = useMemo(() => {
    if (!user) return [];
    return conversations
      .map((c) => {
        if (c.isGroup) {
          return { conversation: c, navTarget: c.id, isGroup: true as const, title: c.name || "Group Chat", otherProfile: null as UserProfile | null };
        }
        const otherId = c.participants.find((id) => id !== user.uid) ?? "";
        const rowProfile = profileById.get(otherId) ?? null;
        return { conversation: c, navTarget: otherId, isGroup: false as const, otherId, title: rowProfile?.displayName ?? "Unknown player", otherProfile: rowProfile };
      })
      .filter((row) => !search.trim() || row.title.toLowerCase().includes(search.trim().toLowerCase()));
  }, [conversations, profileById, search, user]);

  const topConversation = conversations[0] ?? null;
  const selectedGroup = routeOtherId
    ? conversations.find((c) => c.isGroup && c.id === routeOtherId) ?? null
    : (topConversation?.isGroup ? topConversation : null);
  const isGroupSelected = !!selectedGroup;
  const selectedOtherId = !isGroupSelected
    ? (routeOtherId ?? (topConversation ? topConversation.participants.find((id) => id !== user?.uid) ?? null : null))
    : null;
  const selectedNavTarget = isGroupSelected && selectedGroup ? selectedGroup.id : selectedOtherId;
  const otherProfile = selectedOtherId ? (profileById.get(selectedOtherId) ?? null) : null;
  const friendRequest = friendRequests.find((r) => r.fromId === selectedOtherId || r.toId === selectedOtherId) ?? null;
  const groupMemberProfiles = selectedGroup ? selectedGroup.participants.map((id) => profileById.get(id)).filter((p): p is UserProfile => !!p) : [];
  const selectedConversation = dmId ? conversations.find((c) => c.id === dmId) ?? null : selectedGroup;
  const directCallChannelId = dmId ? `dm-${dmId}` : "";
  const inSelectedCall = !!directCallChannelId && voice.joinedChannelId === directCallChannelId;
  const callActive = !!selectedConversation?.callStartedAt;

  // Land on the most recent conversation instead of a blank page.
  useEffect(() => {
    if (routeOtherId || conversations.length === 0 || !user) return;
    const top = conversations[0];
    const target = top.isGroup ? top.id : (top.participants.find((id) => id !== user.uid) ?? top.id);
    navigate(`/messages/${target}`, { replace: true });
  }, [routeOtherId, conversations, navigate, user]);

  useEffect(() => {
    if (!user) {
      setDmId(null);
      setMessages([]);
      return;
    }
    let unsubMessages: (() => void) | undefined;
    let unsubTyping: (() => void) | undefined;
    if (isGroupSelected && selectedGroup) {
      const id = selectedGroup.id;
      setDmId(id);
      unsubMessages = subscribeToDmMessages(id, setMessages);
      unsubTyping = subscribeToDmTyping(id, (list) => setTypers(list.filter((t) => t.id !== user.uid && Date.now() - t.updatedAt < 6000)));
      return () => {
        unsubMessages?.();
        unsubTyping?.();
      };
    }
    if (!selectedOtherId) {
      setDmId(null);
      setMessages([]);
      return;
    }
    void ensureDm(user.uid, selectedOtherId).then((id) => {
      setDmId(id);
      unsubMessages = subscribeToDmMessages(id, setMessages);
      unsubTyping = subscribeToDmTyping(id, (list) => setTypers(list.filter((t) => t.id !== user.uid && Date.now() - t.updatedAt < 6000)));
    });
    return () => {
      unsubMessages?.();
      unsubTyping?.();
      if (user && selectedOtherId) void clearDmTyping(dmIdFor(user.uid, selectedOtherId), user.uid);
    };
  }, [user, selectedOtherId, isGroupSelected, selectedGroup]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages.length]);

  function handleTextChange(e: ChangeEvent<HTMLInputElement>) {
    setText(e.target.value);
    if (!user || !dmId) return;
    const now = Date.now();
    if (now - lastTypingSentRef.current > 2500) {
      lastTypingSentRef.current = now;
      void setDmTyping(dmId, user.uid, myName);
    }
    if (typingClearRef.current) window.clearTimeout(typingClearRef.current);
    typingClearRef.current = window.setTimeout(() => void clearDmTyping(dmId, user.uid), 4000);
  }

  const recipientIds = isGroupSelected && selectedGroup
    ? selectedGroup.participants.filter((id) => id !== user?.uid)
    : selectedOtherId ? [selectedOtherId] : [];

  async function handleFileSelect(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file || !user || !dmId || recipientIds.length === 0) return;
    setUploading(true);
    try {
      const uploaded = await uploadChatFile(file);
      await sendDmMessage(dmId, user.uid, myName, `Shared a file: ${file.name}`, undefined, false, {
        fileId: uploaded.fileId, fileUrl: uploaded.url, fileName: file.name, fileType: file.type, fileSize: file.size,
      });
      recipientIds.forEach((id) => void createNotification({ recipientId: id, type: "dm", title: `New message from ${myName}`, message: `Shared a file: ${file.name}`, link: "/messages" }));
    } finally {
      setUploading(false);
    }
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    const trimmed = text.trim().slice(0, 500);
    if (!trimmed || !user || !dmId || recipientIds.length === 0) return;
    if (typingClearRef.current) window.clearTimeout(typingClearRef.current);
    void clearDmTyping(dmId, user.uid);
    await sendDmMessage(dmId, user.uid, myName, trimmed, replyTo ? { id: replyTo.id, author: replyTo.authorName, text: replyTo.text } : undefined);
    recipientIds.forEach((id) => void createNotification({ recipientId: id, type: "dm", title: `New message from ${myName}`, message: trimmed.slice(0, 100), link: "/messages" }));
    setText("");
    setReplyTo(null);

    if (trimmed.toLowerCase().startsWith("!ai")) {
      const question = trimmed.slice(3).trim();
      if (!question) {
        await sendDmMessage(dmId, user.uid, "eduBot", "Usage: !ai <question>", undefined, true);
        return;
      }
      const waitMs = AI_COOLDOWN_MS - (Date.now() - lastAiCallRef.current);
      if (waitMs > 0) {
        await sendDmMessage(dmId, user.uid, "eduBot", `Slow down — wait ${Math.ceil(waitMs / 1000)}s before asking again.`, undefined, true);
        return;
      }
      lastAiCallRef.current = Date.now();
      const answer = await askAi(question);
      await sendDmMessage(dmId, user.uid, "eduBot", answer, undefined, true);
    }
  }

  function togglePin(m: DmMessage) {
    if (!dmId) return;
    void toggleDmPin(dmId, m.id, !m.pinned);
  }
  function toggleReaction(m: DmMessage, emoji: string) {
    if (!user || !dmId) return;
    const has = (m.reactions?.[emoji] ?? []).includes(user.uid);
    void toggleDmReaction(dmId, m.id, emoji, user.uid, !has);
  }
  function remove(m: DmMessage) {
    if (!dmId) return;
    if (m.fileId) void deleteChatFile(m.fileId);
    void deleteDmMessage(dmId, m.id);
  }
  async function removeFriend() {
    if (!friendRequest) return;
    if (!confirm(`Remove ${otherProfile?.displayName ?? "this friend"}?`)) return;
    await removeFriendRequest(friendRequest.id);
  }

  function toggleGroupMember(id: string) {
    setGroupMemberIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else if (next.size < GROUP_DM_MAX_MEMBERS - 1) next.add(id);
      return next;
    });
  }

  async function handleCreateGroup() {
    if (!user) return;
    setGroupError("");
    try {
      const id = await createGroupDm([user.uid, ...groupMemberIds], user.uid, groupName || "Group Chat", groupIconUrl);
      setShowNewGroup(false);
      setGroupName("");
      setGroupIconUrl("");
      setGroupMemberIds(new Set());
      navigate(`/messages/${id}`);
    } catch (error) {
      setGroupError(error instanceof Error ? error.message : "Could not create the group chat.");
    }
  }

  async function handleUpdateGroupIcon() {
    if (!selectedGroup) return;
    await setGroupIcon(selectedGroup.id, editIconUrl);
    setShowEditIcon(false);
  }

  async function handleLeaveGroup() {
    if (!user || !selectedGroup) return;
    if (!confirm(`Leave "${selectedGroup.name || "this group"}"?`)) return;
    await leaveGroupDm(selectedGroup.id, user.uid);
    navigate("/messages", { replace: true });
  }

  async function handleDisbandGroup() {
    if (!selectedGroup) return;
    if (!confirm(`Disband "${selectedGroup.name || "this group"}"? This deletes it for everyone.`)) return;
    await disbandGroupDm(selectedGroup.id);
    navigate("/messages", { replace: true });
  }

  async function handleDeleteConversation(id: string, label: string) {
    if (!confirm(`Delete the conversation with ${label}?`)) return;
    await deleteDm(id);
    if (id === dmId) navigate("/messages", { replace: true });
  }

  async function startOrJoinCall() {
    if (!user || !dmId) return;
    const channelId = await ensureDmVoiceChannel(dmId, user.uid, myName);
    if (voice.joinedChannelId && voice.joinedChannelId !== channelId) voice.leave();
    await startDmCall(dmId, user.uid);
    await voice.join(channelId, { uid: user.uid, displayName: myName, photoUrl: myProfile?.photoUrl ?? "", rank: myProfile?.rank ?? "none" });
  }

  async function leaveCall() {
    if (!dmId) return;
    if (inSelectedCall) voice.leave();
    await endDmCall(dmId);
  }

  const pinned = messages.filter((m) => m.pinned);
  const groupedMessages = useMemo(
    () =>
      messages.map((m, i) => {
        const prev = messages[i - 1];
        const startsGroup = !prev || prev.authorId !== m.authorId || !!prev.isBot !== !!m.isBot || !!m.replyToId || m.createdAt - prev.createdAt > GROUP_WINDOW_MS;
        return { message: m, startsGroup };
      }),
    [messages],
  );

  return (
    <div className="relative mx-auto flex h-[calc(100vh-4rem)] max-w-[96rem] overflow-hidden rounded-2xl border border-black/40 shadow-2xl shadow-black/30">
      {/* Conversation list */}
      <div className="flex w-72 shrink-0 flex-col border-r border-black/25 bg-[#2b2d31]">
        <div className="flex shrink-0 items-center gap-1.5 border-b border-black/25 p-2.5">
          <div className="flex flex-1 items-center gap-2 rounded-lg bg-[#1e1f22] px-2.5 py-1.5">
            <Search size={14} className="shrink-0 text-white/40" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Find a conversation"
              className="w-full bg-transparent text-sm text-white placeholder:text-white/35 focus:outline-none"
            />
          </div>
          <button type="button" onClick={() => setShowNewGroup(true)} aria-label="New group chat" title="New group chat" className="cursor-target grid h-8 w-8 shrink-0 place-items-center rounded-lg text-white/50 hover:bg-white/10 hover:text-white">
            <UsersRound size={16} />
          </button>
        </div>
        <div className="flex-1 space-y-0.5 overflow-y-auto p-2">
          <p className="px-2 pb-1 pt-2 text-xs font-bold uppercase tracking-wide text-white/35">Direct Messages</p>
          {conversationRows.length === 0 && <p className="px-2 py-6 text-center text-xs text-white/30">No conversations yet — message a friend to start one.</p>}
          {conversationRows.map((row) => {
            const preview = row.conversation.lastMessageAuthorId === user?.uid ? `You: ${row.conversation.lastMessageText}` : row.conversation.lastMessageText;
            const isSelected = row.navTarget === selectedNavTarget;
            return (
              <div
                key={row.conversation.id}
                role="button"
                tabIndex={0}
                onClick={() => navigate(`/messages/${row.navTarget}`)}
                onKeyDown={(e) => { if (e.key === "Enter") navigate(`/messages/${row.navTarget}`); }}
                className={`group cursor-target flex w-full items-center gap-3 rounded-lg px-2 py-2 text-left transition-colors ${
                  isSelected ? "bg-white/10" : "hover:bg-white/[.05]"
                }`}
              >
                {row.isGroup ? (
                  <GroupIcon iconUrl={row.conversation.iconUrl ?? ""} size={32} />
                ) : (
                  <div className="relative shrink-0">
                    <Avatar photoUrl={row.otherProfile?.photoUrl ?? ""} name={row.title} size={32} />
                    <StatusDot status={getPresenceStatus(row.otherProfile)} className="absolute -bottom-0.5 -right-0.5 border-[#2b2d31]" />
                  </div>
                )}
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-white/90">{row.title}</p>
                  <p className="truncate text-xs text-white/40">{preview || "No messages yet"}</p>
                </div>
                {!row.isGroup && (
                  <button
                    type="button"
                    onClick={(e) => { e.stopPropagation(); void handleDeleteConversation(row.conversation.id, row.title); }}
                    aria-label="Delete conversation"
                    title="Delete conversation"
                    className="cursor-target shrink-0 rounded-lg p-1.5 text-white/0 opacity-0 hover:bg-red-500/10 hover:text-red-400 group-hover:text-white/40 group-hover:opacity-100"
                  >
                    <Trash2 size={13} />
                  </button>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Chat */}
      <div className="flex min-w-0 flex-1 flex-col bg-[#313338]">
        {!isGroupSelected && (!selectedOtherId || !otherProfile) ? (
          <div className="flex flex-1 flex-col items-center justify-center gap-2 text-white/30">
            <MessageSquare size={40} />
            <p className="text-sm">Pick a conversation to start chatting.</p>
          </div>
        ) : (
          <>
            <div className="flex shrink-0 items-center gap-2.5 border-b border-black/25 bg-[#313338] px-4 py-3 shadow-[0_1px_0_rgba(0,0,0,.35)]">
              {isGroupSelected && selectedGroup ? (
                <>
                  <GroupIcon iconUrl={selectedGroup.iconUrl ?? ""} size={32} />
                  <div className="min-w-0">
                    <p className="font-bold leading-tight text-white">{selectedGroup.name || "Group Chat"}</p>
                    <p className="truncate text-[11px] leading-tight text-white/35">{selectedGroup.participants.length} members</p>
                  </div>
                </>
              ) : otherProfile ? (
                <>
                  <div className="relative shrink-0">
                    <Avatar photoUrl={otherProfile.photoUrl} name={otherProfile.displayName} size={32} />
                    <StatusDot status={getPresenceStatus(otherProfile)} className="absolute -bottom-0.5 -right-0.5 border-[#313338]" />
                  </div>
                  <div className="min-w-0">
                    <p className={`font-bold leading-tight ${rankNameClass(otherProfile.rank)}`}>{otherProfile.displayName}</p>
                    {otherProfile.activityGame && <p className="truncate text-[11px] leading-tight text-emerald-300/80">Playing {otherProfile.activityGame}</p>}
                  </div>
                </>
              ) : null}
              <div className="ml-auto flex items-center gap-1">
                <button type="button" onClick={() => inSelectedCall ? void leaveCall() : void startOrJoinCall()} aria-label={inSelectedCall ? "Leave call" : callActive ? "Join call" : "Start call"} className={`cursor-target grid h-8 w-8 place-items-center rounded-lg hover:bg-white/10 ${inSelectedCall ? "text-red-300" : callActive ? "text-emerald-300" : "text-white/50"}`}>
                  {inSelectedCall ? <PhoneOff size={17} /> : <Phone size={17} />}
                </button>
                <button type="button" onClick={() => setShowPinned((v) => !v)} aria-label="Pinned messages" className={`cursor-target grid h-8 w-8 place-items-center rounded-lg hover:bg-white/10 ${showPinned ? "text-white" : "text-white/50"}`}>
                  <Pin size={17} />
                </button>
                <button type="button" onClick={() => setShowProfilePanel((v) => !v)} aria-label={isGroupSelected ? "Toggle member list" : "Toggle profile panel"} className={`cursor-target grid h-8 w-8 place-items-center rounded-lg hover:bg-white/10 ${showProfilePanel ? "text-white" : "text-white/50"}`}>
                  <Users size={17} />
                </button>
              </div>
            </div>

            {showPinned && (
              <div className="shrink-0 border-b border-black/25 bg-black/10 px-4 py-2">
                <p className="flex items-center gap-1 text-[10px] font-bold uppercase tracking-wide text-white/40"><Pin size={10} /> Pinned Messages</p>
                {pinned.length === 0 ? (
                  <p className="mt-1 text-xs text-white/30">No pinned messages in this conversation.</p>
                ) : (
                  <div className="mt-1 space-y-1">
                    {pinned.map((m) => <p key={m.id} className="truncate text-xs text-white/60">{m.authorName}: {m.text}</p>)}
                  </div>
                )}
              </div>
            )}

            {callActive && !inSelectedCall && (
              <div className="flex shrink-0 items-center justify-between border-b border-black/25 bg-emerald-500/10 px-4 py-2 text-sm text-emerald-100">
                <span>Voice call is active in this conversation.</span>
                <button type="button" onClick={() => void startOrJoinCall()} className="rounded bg-emerald-500 px-3 py-1 text-xs font-bold text-white hover:bg-emerald-400">Join call</button>
              </div>
            )}

            <div ref={scrollRef} className="flex-1 overflow-y-auto py-3">
              <div className="px-4 pb-5 pt-2 text-center">
                {isGroupSelected && selectedGroup ? (
                  <>
                    <div className="flex justify-center"><GroupIcon iconUrl={selectedGroup.iconUrl ?? ""} size={72} /></div>
                    <p className="mx-auto mt-3 max-w-md text-2xl font-bold text-white">{selectedGroup.name || "Group Chat"}</p>
                    <p className="mx-auto mt-2 max-w-md text-sm text-white/50">This is the beginning of {selectedGroup.name || "the group chat"} — {groupMemberProfiles.map((p) => p.displayName).join(", ")}.</p>
                  </>
                ) : otherProfile ? (
                  <>
                    <Avatar photoUrl={otherProfile.photoUrl} name={otherProfile.displayName} size={72} />
                    <p className="mx-auto mt-3 max-w-md text-2xl font-bold text-white">{otherProfile.displayName}</p>
                    {otherProfile.username && <p className="text-sm text-white/40">{otherProfile.username}</p>}
                    <p className="mx-auto mt-2 max-w-md text-sm text-white/50">This is the beginning of your direct message history with <span className="font-semibold text-white/70">{otherProfile.displayName}</span>.</p>
                  </>
                ) : null}
              </div>

              {!isGroupSelected && friendRequest && otherProfile && (
                <div className="mb-2 flex items-center gap-2 px-4 py-1 text-sm text-white/40">
                  <span className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-emerald-500/15 text-emerald-300"><Users size={13} /></span>
                  You became friends with <span className="font-semibold text-white/60">{otherProfile.displayName}</span>
                  <span className="ml-1 text-xs text-white/25">{formatDate(friendRequest.createdAt)}</span>
                </div>
              )}

              {groupedMessages.map(({ message: m, startsGroup }) => (
                <div key={m.id} className={`group relative px-4 hover:bg-white/[.03] ${startsGroup ? "mt-[17px] py-0.5 first:mt-1" : "py-0"}`}>
                  {m.replyToId && (
                    <p className="mb-0.5 ml-[52px] truncate pl-2 text-[11px] text-white/35 [border-left:2px_solid_rgba(255,255,255,.15)]">
                      ↪ {m.replyToAuthor}: {m.replyToText}
                    </p>
                  )}
                  <div className="flex items-start gap-3">
                    {startsGroup ? (
                      m.isBot ? (
                        <span className="mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-full bg-indigo-500/20">
                          <img src={botIconUrl} alt="" className="h-full w-full object-cover" />
                        </span>
                      ) : (
                        <Avatar photoUrl={(m.authorId === user?.uid ? myProfile?.photoUrl : profileById.get(m.authorId)?.photoUrl) ?? ""} name={m.authorId === user?.uid ? myName : m.authorName} size={40} />
                      )
                    ) : (
                      <span className="w-10 shrink-0 text-center text-[10px] leading-[22px] text-white/0 group-hover:text-white/30">
                        {new Date(m.createdAt).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}
                      </span>
                    )}
                    <div className="min-w-0 flex-1">
                      {startsGroup && (
                        <div className="flex items-baseline gap-1.5">
                          <span className="text-[15px] font-semibold text-white">{m.isBot ? "eduBot" : m.authorId === user?.uid ? "You" : m.authorName}</span>
                          {m.isBot && <span className="rounded-md bg-indigo-500/20 px-1.5 py-0.5 font-mono text-[9px] font-bold text-indigo-300">APP</span>}
                          <span className="text-[11px] text-white/35">{timeAgo(m.createdAt)}</span>
                          {m.pinned && <Pin size={10} className="text-amber-300" />}
                        </div>
                      )}
                      <p className="text-[15px] leading-[1.35] break-words text-white/85 [overflow-wrap:anywhere]">{m.text}</p>
                      {m.fileUrl && (
                        m.fileType?.startsWith("image/") ? (
                          <a href={m.fileUrl} target="_blank" rel="noreferrer" className="cursor-target mt-1.5 block w-fit">
                            <img src={m.fileUrl} alt={m.fileName ?? ""} className="max-h-64 max-w-full rounded-xl border border-black/30 object-cover" />
                          </a>
                        ) : (
                          <a href={m.fileUrl} target="_blank" rel="noreferrer" className="cursor-target mt-1.5 flex w-fit items-center gap-2 rounded-xl border border-black/30 bg-black/20 px-3 py-2 text-xs text-white/70 hover:border-brand-400/40 hover:text-white">
                            <FileIcon size={14} className="shrink-0 text-brand-300" />
                            <span className="truncate">{m.fileName}</span>
                          </a>
                        )
                      )}
                      {m.reactions && Object.entries(m.reactions).some(([, uids]) => uids.length > 0) && (
                        <div className="mt-1 flex flex-wrap gap-1">
                          {Object.entries(m.reactions).filter(([, uids]) => uids.length > 0).map(([emoji, uids]) => (
                            <button key={emoji} type="button" onClick={() => toggleReaction(m, emoji)} className={`cursor-target rounded-full border px-1.5 py-0.5 text-[11px] ${uids.includes(user?.uid ?? "") ? "border-brand-400/60 bg-brand-500/20" : "border-black/30 bg-black/20"}`}>
                              {emoji} {uids.length}
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="absolute -top-3.5 right-4 hidden items-center gap-0.5 rounded-lg border border-black/40 bg-[#313338] p-0.5 shadow-lg group-hover:flex">
                    {REACTION_EMOJIS.slice(0, 3).map((emoji) => (
                      <button key={emoji} type="button" onClick={() => toggleReaction(m, emoji)} aria-label={`React ${emoji}`} className="cursor-target grid h-7 w-7 place-items-center rounded text-sm hover:bg-white/10">{emoji}</button>
                    ))}
                    <button type="button" onClick={() => toggleReaction(m, REACTION_EMOJIS[0])} aria-label="React" className="cursor-target grid h-7 w-7 place-items-center rounded text-white/60 hover:bg-white/10 hover:text-white"><SmilePlus size={15} /></button>
                    <button type="button" onClick={() => setReplyTo(m)} aria-label="Reply" className="cursor-target grid h-7 w-7 place-items-center rounded text-white/60 hover:bg-white/10 hover:text-white"><CornerUpLeft size={15} /></button>
                    <button type="button" onClick={() => togglePin(m)} aria-label="Pin" className="cursor-target grid h-7 w-7 place-items-center rounded text-white/60 hover:bg-white/10 hover:text-white">{m.pinned ? <PinOff size={15} /> : <Pin size={15} />}</button>
                    {m.authorId === user?.uid && (
                      <button type="button" onClick={() => remove(m)} aria-label="Delete" className="cursor-target grid h-7 w-7 place-items-center rounded text-white/60 hover:bg-red-500/10 hover:text-red-400"><Trash2 size={15} /></button>
                    )}
                  </div>
                </div>
              ))}
            </div>

            <div className="shrink-0 px-4">
              {typers.length > 0 && (
                <p className="flex items-center gap-1.5 pb-1 text-[13px] text-white/50">
                  <span className="flex gap-0.5">
                    <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-white/50 [animation-delay:0ms]" />
                    <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-white/50 [animation-delay:150ms]" />
                    <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-white/50 [animation-delay:300ms]" />
                  </span>
                  {typers.length === 1 ? `${typers[0].displayName} is typing…` : `${typers.length} people are typing…`}
                </p>
              )}
            </div>

            <form onSubmit={handleSubmit} className="shrink-0 px-4 pb-4 pt-1">
              {replyTo && (
                <div className="mb-2 flex items-center justify-between gap-2 rounded-lg bg-black/20 px-3 py-1.5 text-xs text-white/50">
                  <span className="truncate">Replying to {replyTo.authorName}: {replyTo.text}</span>
                  <button type="button" onClick={() => setReplyTo(null)} className="cursor-target shrink-0 text-white/40 hover:text-white"><X size={12} /></button>
                </div>
              )}
              <div className="flex items-center gap-2.5 rounded-xl bg-[#383a40] px-3 py-1">
                {isAppwriteConfigured && (
                  <>
                    <input ref={fileInputRef} type="file" onChange={handleFileSelect} className="hidden" />
                    <button type="button" onClick={() => fileInputRef.current?.click()} disabled={uploading} aria-label="Attach file" className="cursor-target grid h-8 w-8 shrink-0 place-items-center rounded-full text-white/60 hover:text-white disabled:opacity-50">
                      <Plus size={20} />
                    </button>
                  </>
                )}
                <input
                  value={text}
                  onChange={handleTextChange}
                  placeholder={`Message ${isGroupSelected && selectedGroup ? (selectedGroup.name || "the group") : otherProfile?.displayName || ""}`}
                  maxLength={500}
                  className="w-full bg-transparent py-2.5 text-[15px] text-white placeholder:text-white/40 focus:outline-none"
                />
                <button type="submit" disabled={!text.trim()} aria-label="Send" className="cursor-target grid h-8 w-8 shrink-0 place-items-center rounded-full text-white/60 enabled:hover:text-brand-300 disabled:opacity-40">
                  <Send size={18} />
                </button>
              </div>
            </form>
          </>
        )}
      </div>

      {/* Profile / member-list panel */}
      {showProfilePanel && isGroupSelected && selectedGroup && (
        <div className="w-72 shrink-0 overflow-y-auto border-l border-black/25 bg-[#2b2d31]">
          <div className="p-4">
            <p className="text-xs font-bold uppercase tracking-wide text-white/40">Members — {selectedGroup.participants.length}</p>
            <div className="mt-3 space-y-1">
              {groupMemberProfiles.map((p) => (
                <div key={p.id} className="flex items-center gap-2.5 rounded-lg px-1.5 py-1.5 hover:bg-white/[.05]">
                  <div className="relative shrink-0">
                    <Avatar photoUrl={p.photoUrl} name={p.displayName} size={32} />
                    <StatusDot status={getPresenceStatus(p)} className="absolute -bottom-0.5 -right-0.5 border-[#2b2d31]" />
                  </div>
                  <p className={`truncate text-sm ${rankNameClass(p.rank)}`}>{p.displayName}{p.id === selectedGroup.ownerId ? " 👑" : ""}</p>
                </div>
              ))}
            </div>
            {user?.uid === selectedGroup.ownerId && (
              <div className="mt-5 border-t border-white/10 pt-4">
                {showEditIcon ? (
                  <div className="space-y-2">
                    <input
                      value={editIconUrl}
                      onChange={(e) => setEditIconUrl(e.target.value.slice(0, 1000))}
                      placeholder="Icon URL — or embed:https://…"
                      className="w-full rounded-lg bg-[#1e1f22] px-3 py-2 text-xs text-white placeholder:text-white/35 focus:outline-none"
                    />
                    <div className="flex gap-2">
                      <button type="button" onClick={() => void handleUpdateGroupIcon()} className="cursor-target flex-1 rounded-lg bg-brand-500 py-1.5 text-xs font-semibold text-white hover:bg-brand-400">Save</button>
                      <button type="button" onClick={() => setShowEditIcon(false)} className="cursor-target flex-1 rounded-lg bg-black/20 py-1.5 text-xs font-semibold text-white/60 hover:bg-white/10">Cancel</button>
                    </div>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => { setEditIconUrl(selectedGroup.iconUrl ?? ""); setShowEditIcon(true); }}
                    className="cursor-target w-full rounded-lg bg-black/20 py-2 text-sm font-semibold text-white/70 hover:bg-white/10"
                  >
                    Change Group Icon
                  </button>
                )}
              </div>
            )}
            {user?.uid === selectedGroup.ownerId ? (
              <button type="button" onClick={() => void handleDisbandGroup()} className="cursor-target mt-3 flex w-full items-center justify-center gap-1.5 rounded-lg bg-black/20 py-2 text-sm font-semibold text-red-300 hover:bg-red-500/10">
                <Trash2 size={14} /> Disband Group
              </button>
            ) : (
              <button type="button" onClick={() => void handleLeaveGroup()} className="cursor-target mt-3 flex w-full items-center justify-center gap-1.5 rounded-lg bg-black/20 py-2 text-sm font-semibold text-red-300 hover:bg-red-500/10">
                <LogOut size={14} /> Leave Group
              </button>
            )}
          </div>
        </div>
      )}
      {showProfilePanel && !isGroupSelected && otherProfile && (
        <div className="w-72 shrink-0 overflow-y-auto border-l border-black/25 bg-[#2b2d31]">
          <div className="h-20 bg-gradient-to-br from-brand-500/40 to-fuchsia-500/30" style={otherProfile.bannerUrl ? { backgroundImage: `url(${otherProfile.bannerUrl})`, backgroundSize: "cover", backgroundPosition: "center" } : undefined} />
          <div className="px-4 pb-4">
            <div className="-mt-8">
              <Avatar photoUrl={otherProfile.photoUrl} name={otherProfile.displayName} size={64} />
            </div>
            <p className={`mt-2 text-lg font-bold ${rankNameClass(otherProfile.rank)}`}>{otherProfile.displayName}</p>
            {otherProfile.username && <p className="text-sm text-white/40">{otherProfile.username}</p>}
            <div className="mt-2"><RankBadge rank={otherProfile.rank} /></div>

            <GameActivityCard game={otherProfile.activityGame} startedAt={otherProfile.activityStartedAt} compact />

            {otherProfile.bio && (
              <div className="mt-4 border-t border-white/10 pt-3">
                <p className="text-xs font-bold uppercase tracking-wide text-white/40">About Me</p>
                <p className="mt-1 whitespace-pre-wrap text-sm text-white/70">{otherProfile.bio}</p>
              </div>
            )}

            <div className="mt-4 border-t border-white/10 pt-3">
              <p className="text-xs font-bold uppercase tracking-wide text-white/40">Member Since</p>
              <p className="mt-1 text-sm text-white/70">{formatDate(otherProfile.joinedAt)}</p>
            </div>

            <div className="mt-5 space-y-2">
              <button type="button" onClick={() => setOpenFullProfile(true)} className="cursor-target w-full rounded-lg bg-brand-500 py-2 text-sm font-semibold text-white hover:bg-brand-400">
                View Full Profile
              </button>
              {friendRequest && (
                <button type="button" onClick={() => void removeFriend()} className="cursor-target flex w-full items-center justify-center gap-1.5 rounded-lg bg-black/20 py-2 text-sm font-semibold text-red-300 hover:bg-red-500/10">
                  <UserRoundX size={14} /> Remove Friend
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {showNewGroup && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4" onClick={() => setShowNewGroup(false)}>
          <div onClick={(e) => e.stopPropagation()} className="w-full max-w-sm rounded-2xl border border-black/40 bg-[#313338] p-5 shadow-2xl">
            <div className="flex items-center justify-between">
              <h2 className="font-bold text-white">New Group Chat</h2>
              <button type="button" onClick={() => setShowNewGroup(false)} className="cursor-target rounded-lg p-1 text-white/50 hover:bg-white/10 hover:text-white"><X size={16} /></button>
            </div>
            <p className="mt-1 text-xs text-white/40">Pick up to {GROUP_DM_MAX_MEMBERS - 1} friends — {GROUP_DM_MAX_MEMBERS} people max including you.</p>
            <input
              value={groupName}
              onChange={(e) => setGroupName(e.target.value.slice(0, 60))}
              placeholder="Group name (optional)"
              className="mt-3 w-full rounded-lg bg-[#1e1f22] px-3 py-2 text-sm text-white placeholder:text-white/35 focus:outline-none"
            />
            <input
              value={groupIconUrl}
              onChange={(e) => setGroupIconUrl(e.target.value.slice(0, 1000))}
              placeholder="Icon URL (optional) — or embed:https://…"
              className="mt-2 w-full rounded-lg bg-[#1e1f22] px-3 py-2 text-sm text-white placeholder:text-white/35 focus:outline-none"
            />
            <div className="mt-3 max-h-56 space-y-1 overflow-y-auto">
              {friendProfiles.length === 0 && <p className="py-4 text-center text-xs text-white/30">Add some friends first.</p>}
              {friendProfiles.map((p) => {
                const checked = groupMemberIds.has(p.id);
                return (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => toggleGroupMember(p.id)}
                    disabled={!checked && groupMemberIds.size >= GROUP_DM_MAX_MEMBERS - 1}
                    className={`cursor-target flex w-full items-center gap-2.5 rounded-lg px-2 py-1.5 text-left disabled:opacity-30 ${checked ? "bg-brand-500/15" : "hover:bg-white/[.05]"}`}
                  >
                    <Avatar photoUrl={p.photoUrl} name={p.displayName} size={28} />
                    <span className="min-w-0 flex-1 truncate text-sm text-white/85">{p.displayName}</span>
                    {checked && <span className="text-brand-300">✓</span>}
                  </button>
                );
              })}
            </div>
            {groupError && <p className="mt-2 text-xs text-red-400">{groupError}</p>}
            <button
              type="button"
              disabled={groupMemberIds.size < 2}
              onClick={() => void handleCreateGroup()}
              className="cursor-target mt-4 w-full rounded-lg bg-brand-500 py-2 text-sm font-semibold text-white enabled:hover:bg-brand-400 disabled:opacity-40"
            >
              Create Group ({groupMemberIds.size + 1}/{GROUP_DM_MAX_MEMBERS})
            </button>
          </div>
        </div>
      )}

      {openFullProfile && selectedOtherId && <ProfileCard userId={selectedOtherId} onClose={() => setOpenFullProfile(false)} />}
    </div>
  );
}
