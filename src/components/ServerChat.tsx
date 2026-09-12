import { useEffect, useRef, useState, type FormEvent } from "react";
import { motion } from "framer-motion";
import { BarChart3, MessageCircle, Minus, Plus, Send, Trash2, X } from "lucide-react";
import { useAuth } from "../context/AuthContext";
import { deleteMessage, sendMessage, subscribeToMessages, voteServerPoll } from "../lib/chat";
import { flagDeletedMessage, isStaffRole } from "../lib/moderation";
import { subscribeToProfile } from "../lib/profiles";
import { rankNameClass } from "../lib/ranks";
import type { ChatMessage, Rank } from "../types";
import Button from "./Button";
import ProfileCard from "./ProfileCard";
import RankBadge from "./RankBadge";
import { checkLocalProfanity, formatBanRemaining, getChatBanRemaining, screenChatMessageRemote } from "../lib/aiModeration";

function timeAgo(ts: number) {
  const s = Math.floor((Date.now() - ts) / 1000);
  if (s < 60) return "just now";
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

export default function ServerChat({
  serverId,
  serverName,
  slowModeSeconds = 0,
  banned = false,
}: {
  serverId: string;
  serverName: string;
  slowModeSeconds?: number;
  banned?: boolean;
}) {
  const { user, role } = useAuth();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const [filterMessage, setFilterMessage] = useState("");
  useEffect(() => {
    if (!filterMessage) return;
    const timer = window.setTimeout(() => setFilterMessage(""), 6_000);
    return () => window.clearTimeout(timer);
  }, [filterMessage]);
  const [myRank, setMyRank] = useState<Rank>("none");
  const [myProfileName, setMyProfileName] = useState("");
  const [openProfileId, setOpenProfileId] = useState<string | null>(null);
  const [pollOpen, setPollOpen] = useState(false);
  const [pollQuestion, setPollQuestion] = useState("");
  const [pollOptions, setPollOptions] = useState(["", ""]);
  const scrollRef = useRef<HTMLDivElement>(null);
  const lastSentRef = useRef(0);

  // Firebase Auth's displayName is frozen at signup — the live, renameable
  // name lives on the Firestore profile doc.
  const myName = myProfileName || user?.displayName || undefined;

  useEffect(() => {
    const unsub = subscribeToMessages(serverId, setMessages);
    return unsub;
  }, [serverId]);

  useEffect(() => {
    if (!user) return;
    return subscribeToProfile(user.uid, (profile) => {
      setMyRank(profile?.rank ?? "none");
      setMyProfileName(profile?.displayName ?? "");
    });
  }, [user]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages.length]);

  async function handleDelete(m: ChatMessage) {
    const isStaffRemoval = isStaffRole(role) && user?.uid !== m.authorId;
    await deleteMessage(serverId, m.id);
    if (isStaffRemoval && user) {
      await flagDeletedMessage({
        source: "chat",
        serverId,
        serverName,
        text: m.text,
        authorId: m.authorId,
        authorName: m.authorName,
        deletedById: user.uid,
        deletedByName: myName ?? "Moderator",
      });
      setFilterMessage("Message removed and reported to moderators.");
    }
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    const trimmed = text.trim().slice(0, 300);
    if (!trimmed || !user) return;
    if (banned) { setFilterMessage("You are blocked from chatting in this server."); return; }
    const wait = slowModeSeconds * 1000 - (Date.now() - lastSentRef.current);
    if (wait > 0) { setFilterMessage(`Slow mode: wait ${Math.ceil(wait / 1000)} seconds.`); return; }
    setSending(true);
    setFilterMessage("");
    try {
      const remaining = getChatBanRemaining(user.uid, user.email);
      if (remaining > 0) {
        setFilterMessage(`AI moderation paused your chat for ${formatBanRemaining(remaining)}.`);
        return;
      }
      const localHit = checkLocalProfanity(trimmed);
      if (localHit) {
        setFilterMessage(`Message blocked: ${localHit.reason}. Chat is paused for 2 hours.`);
        return;
      }
      const sentRef = await sendMessage(serverId, serverName, user.uid, myName ?? "Anonymous", trimmed, myRank);
      setText("");
      lastSentRef.current = Date.now();

      void screenChatMessageRemote(user.uid, trimmed, user.email).then((screening) => {
        if (screening.spam) {
          void deleteMessage(serverId, sentRef.id);
          setFilterMessage(`Your message was removed by AI moderation: ${screening.reason}. Chat is paused for 2 hours.`);
        }
      });
    } catch (error) {
      setFilterMessage(error instanceof Error ? error.message : "Could not check that message.");
    } finally {
      setSending(false);
    }
  }

  async function handleCreatePoll(e: FormEvent) {
    e.preventDefault();
    if (!user) return;
    if (banned) { setFilterMessage("You are blocked from chatting in this server."); return; }
    const question = pollQuestion.trim().slice(0, 200);
    const options = pollOptions.map((o) => o.trim()).filter(Boolean).slice(0, 4);
    if (!question || options.length < 2) {
      setFilterMessage("Poll needs a question and at least 2 options.");
      return;
    }
    setSending(true);
    setFilterMessage("");
    try {
      await sendMessage(serverId, serverName, user.uid, myName ?? "Anonymous", question, myRank, {
        poll: { question, options, votes: {} },
      });
      setPollQuestion("");
      setPollOptions(["", ""]);
      setPollOpen(false);
      lastSentRef.current = Date.now();
    } catch (error) {
      setFilterMessage(error instanceof Error ? error.message : "Could not create that poll.");
    } finally {
      setSending(false);
    }
  }

  function handleVote(messageId: string, optionIndex: number) {
    if (!user) return;
    void voteServerPoll(serverId, messageId, optionIndex, user.uid);
  }

  return (
    <div className="overflow-hidden rounded-2xl border border-border bg-surface">
      <div className="flex items-center gap-2 border-b border-border bg-surface-2/60 px-6 py-4">
        <MessageCircle size={17} className="text-brand-400" />
        <h3 className="font-mono font-semibold text-white">Chat</h3>
        <span className="ml-auto min-w-0 truncate text-xs text-white/30">{serverName}</span>
      </div>

      <div ref={scrollRef} className="max-h-72 space-y-3 overflow-x-hidden overflow-y-auto p-5">
        {messages.length === 0 ? (
          <p className="py-6 text-center text-sm text-white/30">
            No messages yet — say hi to fellow players.
          </p>
        ) : (
          messages.map((m) => (
            <motion.div
              key={m.id}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              className="flex items-start gap-2"
            >
              <span
                onClick={() => setOpenProfileId(m.authorId)}
                className="cursor-target mt-0.5 flex h-7 w-7 shrink-0 cursor-pointer items-center justify-center rounded-full bg-brand-500/15 font-mono text-[11px] font-bold text-brand-300"
              >
                {m.authorName.slice(0, 1).toUpperCase()}
              </span>
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-baseline gap-1.5">
                  <span
                    onClick={() => setOpenProfileId(m.authorId)}
                    className={`cursor-target cursor-pointer truncate text-sm font-semibold ${m.authorRank && m.authorRank !== "none" ? rankNameClass(m.authorRank) : "text-white"}`}
                  >
                    {m.authorName}
                  </span>
                  <RankBadge rank={m.authorRank} />
                  <span className="shrink-0 text-[11px] text-white/30">{timeAgo(m.createdAt)}</span>
                </div>
                {m.poll ? (
                  <div className="mt-1 max-w-xs rounded-xl border border-border bg-surface-2/60 p-3">
                    <p className="flex items-center gap-1.5 text-sm font-semibold text-white">
                      <BarChart3 size={13} className="shrink-0 text-brand-400" /> {m.poll.question}
                    </p>
                    <div className="mt-2 space-y-1.5">
                      {m.poll.options.map((option, index) => {
                        const votes = m.poll?.votes?.[String(index)] ?? [];
                        const total = m.poll ? Object.values(m.poll.votes ?? {}).reduce((sum, v) => sum + v.length, 0) : 0;
                        const pct = total ? Math.round((votes.length / total) * 100) : 0;
                        const mine = !!user && votes.includes(user.uid);
                        return (
                          <button
                            key={index}
                            type="button"
                            disabled={!user}
                            onClick={() => handleVote(m.id, index)}
                            className={`cursor-target relative w-full overflow-hidden rounded-lg border px-2.5 py-1.5 text-left text-xs transition-colors ${
                              mine ? "border-brand-500/60 text-white" : "border-border text-white/70 hover:border-white/20"
                            }`}
                          >
                            <span
                              className="absolute inset-y-0 left-0 bg-brand-500/20"
                              style={{ width: `${pct}%` }}
                            />
                            <span className="relative flex items-center justify-between gap-2">
                              <span className="truncate">{option}</span>
                              <span className="shrink-0 text-white/40">{pct}% ({votes.length})</span>
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                ) : (
                  <p className="text-sm break-words text-white/70 [overflow-wrap:anywhere]">{m.text}</p>
                )}
              </div>
              {(isStaffRole(role) || user?.uid === m.authorId) && (
                <button
                  type="button"
                  onClick={() => handleDelete(m)}
                  aria-label="Delete message"
                  className="cursor-target ml-auto rounded-lg p-1.5 text-white/25 hover:bg-red-500/10 hover:text-red-400"
                >
                  <Trash2 size={13} />
                </button>
              )}
            </motion.div>
          ))
        )}
      </div>

      {user ? (
        <div className="border-t border-border p-4">
          {pollOpen ? (
            <form onSubmit={handleCreatePoll} className="space-y-2 rounded-xl border border-border bg-surface-2/60 p-3">
              <div className="flex items-center gap-2">
                <BarChart3 size={14} className="shrink-0 text-brand-400" />
                <input
                  value={pollQuestion}
                  onChange={(e) => setPollQuestion(e.target.value)}
                  placeholder="Ask a question..."
                  maxLength={200}
                  className="w-full rounded-lg border border-border bg-surface px-3 py-1.5 text-sm text-white placeholder:text-white/30 focus:border-brand-500/50 focus:outline-none"
                />
                <button type="button" onClick={() => setPollOpen(false)} className="cursor-target shrink-0 rounded-lg p-1.5 text-white/30 hover:bg-white/10 hover:text-white">
                  <X size={14} />
                </button>
              </div>
              {pollOptions.map((option, index) => (
                <input
                  key={index}
                  value={option}
                  onChange={(e) => setPollOptions(pollOptions.map((o, i) => (i === index ? e.target.value : o)))}
                  placeholder={`Option ${index + 1}`}
                  maxLength={80}
                  className="w-full rounded-lg border border-border bg-surface px-3 py-1.5 text-sm text-white placeholder:text-white/30 focus:border-brand-500/50 focus:outline-none"
                />
              ))}
              <div className="flex items-center justify-between">
                <div className="flex gap-2">
                  {pollOptions.length < 4 && (
                    <button type="button" onClick={() => setPollOptions([...pollOptions, ""])} className="cursor-target flex items-center gap-1 rounded-lg px-2 py-1 text-xs text-white/50 hover:bg-white/10 hover:text-white">
                      <Plus size={12} /> Option
                    </button>
                  )}
                  {pollOptions.length > 2 && (
                    <button type="button" onClick={() => setPollOptions(pollOptions.slice(0, -1))} className="cursor-target flex items-center gap-1 rounded-lg px-2 py-1 text-xs text-white/50 hover:bg-white/10 hover:text-white">
                      <Minus size={12} /> Option
                    </button>
                  )}
                </div>
                <Button type="submit" size="sm" disabled={sending}>Create poll</Button>
              </div>
            </form>
          ) : (
            <form onSubmit={handleSubmit} className="flex items-center gap-2">
              <button type="button" onClick={() => setPollOpen(true)} aria-label="Create poll" className="cursor-target shrink-0 rounded-xl border border-border p-2.5 text-white/50 hover:border-brand-500/50 hover:text-white">
                <BarChart3 size={15} />
              </button>
              <input
                value={text}
                onChange={(e) => setText(e.target.value)}
                placeholder="Say something..."
                maxLength={300}
                className="w-full rounded-xl border border-border bg-surface-2 px-4 py-2.5 text-sm text-white placeholder:text-white/30 focus:border-brand-500/50 focus:outline-none"
              />
              <Button type="submit" size="md" disabled={sending || !text.trim()}>
                <Send size={15} /> {sending && <span className="hidden sm:inline">Checking...</span>}
              </Button>
            </form>
          )}
          {filterMessage && <p className="chat-system-notice mt-2 text-xs text-amber-300">{filterMessage}</p>}
        </div>
      ) : (
        <div className="border-t border-border p-4 text-center text-xs text-white/40">
          Log in to join the conversation.
        </div>
      )}
      {openProfileId && <ProfileCard userId={openProfileId} onClose={() => setOpenProfileId(null)} />}
    </div>
  );
}
