import { useEffect, useRef, useState, type ChangeEvent, type FormEvent } from "react";
import { createPortal } from "react-dom";
import { CornerUpLeft, File as FileIcon, Paperclip, Pin, PinOff, Send, Trash2, X } from "lucide-react";
import { useAuth } from "../context/AuthContext";
import botIconUrl from "../assets/icons/boticon.svg";
import { askAi } from "../lib/aiModeration";
import { deleteChatFile, isAppwriteConfigured, uploadChatFile } from "../lib/appwrite";
import { createNotification } from "../lib/notifications";
import { subscribeToProfile } from "../lib/profiles";
import {
  clearDmTyping,
  deleteDmMessage,
  dmIdFor,
  ensureDm,
  sendDmMessage,
  setDmTyping,
  subscribeToDmMessages,
  subscribeToDmTyping,
  toggleDmPin,
  toggleDmReaction,
  type DmTyper,
} from "../lib/dm";
import type { DmMessage } from "../types";
import Button from "./Button";

const AI_COOLDOWN_MS = 8000;
const REACTION_EMOJIS = ["👍", "❤️", "😂", "😮", "😢", "🔥"];

function timeAgo(ts: number) {
  const s = Math.floor((Date.now() - ts) / 1000);
  if (s < 60) return "now";
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h`;
  return `${Math.floor(h / 24)}d`;
}

export default function DmThread({ otherId, otherName, otherPhotoUrl, onClose }: { otherId: string; otherName: string; otherPhotoUrl: string; onClose: () => void }) {
  const { user } = useAuth();
  const [messages, setMessages] = useState<DmMessage[]>([]);
  const [text, setText] = useState("");
  const [replyTo, setReplyTo] = useState<DmMessage | null>(null);
  const [typers, setTypers] = useState<DmTyper[]>([]);
  const [uploading, setUploading] = useState(false);
  const [dmId, setDmId] = useState<string | null>(null);
  const [myProfileName, setMyProfileName] = useState("");
  const scrollRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const lastAiCallRef = useRef(0);
  const typingClearRef = useRef<number | null>(null);
  const lastTypingSentRef = useRef(0);

  // Firebase Auth's displayName is frozen at signup — the live, renameable
  // name lives on the Firestore profile doc.
  const myName = myProfileName || user?.displayName || undefined;

  useEffect(() => {
    if (!user) return;
    return subscribeToProfile(user.uid, (profile) => setMyProfileName(profile?.displayName ?? ""));
  }, [user]);

  useEffect(() => {
    if (!user) return;
    let unsubMessages: (() => void) | undefined;
    let unsubTyping: (() => void) | undefined;
    void ensureDm(user.uid, otherId).then((id) => {
      setDmId(id);
      unsubMessages = subscribeToDmMessages(id, setMessages);
      unsubTyping = subscribeToDmTyping(id, (list) => setTypers(list.filter((t) => t.id !== user.uid && Date.now() - t.updatedAt < 6000)));
    });
    return () => {
      unsubMessages?.();
      unsubTyping?.();
      if (user) void clearDmTyping(dmIdFor(user.uid, otherId), user.uid);
    };
  }, [user, otherId]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages.length]);

  function handleTextChange(e: ChangeEvent<HTMLInputElement>) {
    setText(e.target.value);
    if (!user || !dmId) return;
    const now = Date.now();
    if (now - lastTypingSentRef.current > 2500) {
      lastTypingSentRef.current = now;
      void setDmTyping(dmId, user.uid, myName ?? "Someone");
    }
    if (typingClearRef.current) window.clearTimeout(typingClearRef.current);
    typingClearRef.current = window.setTimeout(() => void clearDmTyping(dmId, user.uid), 4000);
  }

  async function handleFileSelect(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file || !user || !dmId) return;
    setUploading(true);
    try {
      const uploaded = await uploadChatFile(file);
      await sendDmMessage(
        dmId,
        user.uid,
        myName ?? "Player",
        `Shared a file: ${file.name}`,
        undefined,
        false,
        { fileId: uploaded.fileId, fileUrl: uploaded.url, fileName: file.name, fileType: file.type, fileSize: file.size },
      );
      void createNotification({ recipientId: otherId, type: "dm", title: `New message from ${myName ?? "Someone"}`, message: `Shared a file: ${file.name}`, link: "/friends" });
    } finally {
      setUploading(false);
    }
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    const trimmed = text.trim().slice(0, 500);
    if (!trimmed || !user || !dmId) return;
    if (typingClearRef.current) window.clearTimeout(typingClearRef.current);
    void clearDmTyping(dmId, user.uid);
    await sendDmMessage(dmId, user.uid, myName ?? "Player", trimmed, replyTo ? { id: replyTo.id, author: replyTo.authorName, text: replyTo.text } : undefined);
    void createNotification({
      recipientId: otherId,
      type: "dm",
      title: `New message from ${myName ?? "Someone"}`,
      message: trimmed.slice(0, 100),
      link: "/friends",
    });
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

  const pinned = messages.filter((m) => m.pinned);

  return createPortal(
    <div className="fixed inset-0 z-100 flex items-center justify-center bg-black/70 p-4" onClick={onClose}>
      <div onClick={(e) => e.stopPropagation()} className="flex h-[36rem] w-full max-w-lg flex-col overflow-hidden rounded-2xl border border-border bg-surface">
        <div className="flex items-center gap-2 border-b border-border bg-surface-2/60 px-5 py-3">
          {otherPhotoUrl ? (
            <img src={otherPhotoUrl} alt="" className="h-7 w-7 rounded-full object-cover" />
          ) : (
            <div className="flex h-7 w-7 items-center justify-center rounded-full bg-gradient-to-br from-cyan-400 to-fuchsia-500 font-mono text-[10px] font-bold text-white">
              {otherName.slice(0, 1).toUpperCase()}
            </div>
          )}
          <p className="font-mono text-sm font-semibold text-white">{otherName}</p>
          <button type="button" onClick={onClose} aria-label="Close" className="cursor-target ml-auto rounded-lg p-1.5 text-white/40 hover:bg-white/10 hover:text-white">
            <X size={16} />
          </button>
        </div>

        {pinned.length > 0 && (
          <div className="border-b border-border bg-surface-2/40 px-5 py-2">
            <p className="flex items-center gap-1 font-mono text-[10px] font-semibold uppercase tracking-wide text-white/40"><Pin size={10} /> Pinned</p>
            <div className="mt-1 space-y-1">
              {pinned.map((m) => (
                <p key={m.id} className="truncate text-xs text-white/60">{m.authorName}: {m.text}</p>
              ))}
            </div>
          </div>
        )}

        <div ref={scrollRef} className="flex-1 space-y-3 overflow-y-auto p-4">
          {messages.length === 0 ? (
            <p className="py-4 text-center text-sm text-white/30">No messages yet — say hi to {otherName}.</p>
          ) : (
            messages.map((m) => (
              <div key={m.id} className="group">
                {m.replyToId && (
                  <p className="mb-0.5 truncate pl-2 text-[11px] text-white/35 [border-left:2px_solid_rgba(255,255,255,.15)]">
                    ↪ {m.replyToAuthor}: {m.replyToText}
                  </p>
                )}
                <div className="flex items-start gap-2">
                  {m.isBot && (
                    <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center overflow-hidden rounded-full bg-indigo-500/20">
                      <img src={botIconUrl} alt="" className="h-full w-full object-cover" />
                    </span>
                  )}
                  <div className="min-w-0 flex-1">
                    <div className="flex items-baseline gap-1.5">
                      <span className="text-xs font-semibold text-white">{m.isBot ? "eduBot" : m.authorId === user?.uid ? "You" : m.authorName}</span>
                      {m.isBot && <span className="rounded-md bg-indigo-500/20 px-1.5 py-0.5 font-mono text-[9px] font-bold text-indigo-300">APP</span>}
                      <span className="text-[10px] text-white/30">{timeAgo(m.createdAt)}</span>
                      {m.pinned && <Pin size={10} className="text-amber-300" />}
                    </div>
                    <p className="text-sm break-words text-white/80 [overflow-wrap:anywhere]">{m.text}</p>
                    {m.fileUrl && (
                      m.fileType?.startsWith("image/") ? (
                        <a href={m.fileUrl} target="_blank" rel="noreferrer" className="cursor-target mt-1.5 block w-fit">
                          <img src={m.fileUrl} alt={m.fileName ?? ""} className="max-h-64 max-w-full rounded-xl border border-border object-cover" />
                        </a>
                      ) : (
                        <a
                          href={m.fileUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="cursor-target mt-1.5 flex w-fit items-center gap-2 rounded-xl border border-border bg-surface-2 px-3 py-2 text-xs text-white/70 hover:border-brand-400/40 hover:text-white"
                        >
                          <FileIcon size={14} className="shrink-0 text-brand-300" />
                          <span className="truncate">{m.fileName}</span>
                        </a>
                      )
                    )}
                    {m.reactions && Object.entries(m.reactions).some(([, uids]) => uids.length > 0) && (
                      <div className="mt-1 flex flex-wrap gap-1">
                        {Object.entries(m.reactions)
                          .filter(([, uids]) => uids.length > 0)
                          .map(([emoji, uids]) => (
                            <button
                              key={emoji}
                              type="button"
                              onClick={() => toggleReaction(m, emoji)}
                              className={`cursor-target rounded-full border px-1.5 py-0.5 text-[11px] ${uids.includes(user?.uid ?? "") ? "border-brand-400/50 bg-brand-500/15" : "border-border bg-surface-2"}`}
                            >
                              {emoji} {uids.length}
                            </button>
                          ))}
                      </div>
                    )}
                  </div>
                  <div className="flex shrink-0 gap-0.5 opacity-0 group-hover:opacity-100">
                    {REACTION_EMOJIS.map((emoji) => (
                      <button key={emoji} type="button" onClick={() => toggleReaction(m, emoji)} aria-label={`React ${emoji}`} className="cursor-target rounded-lg p-1 text-xs hover:bg-white/10">
                        {emoji}
                      </button>
                    ))}
                    <button type="button" onClick={() => setReplyTo(m)} aria-label="Reply" className="cursor-target rounded-lg p-1 text-white/30 hover:bg-white/10 hover:text-white">
                      <CornerUpLeft size={13} />
                    </button>
                    <button type="button" onClick={() => togglePin(m)} aria-label="Pin" className="cursor-target rounded-lg p-1 text-white/30 hover:bg-white/10 hover:text-white">
                      {m.pinned ? <PinOff size={13} /> : <Pin size={13} />}
                    </button>
                    {m.authorId === user?.uid && (
                      <button type="button" onClick={() => remove(m)} aria-label="Delete" className="cursor-target rounded-lg p-1 text-white/30 hover:bg-red-500/10 hover:text-red-400">
                        <Trash2 size={13} />
                      </button>
                    )}
                  </div>
                </div>
              </div>
            ))
          )}
        </div>

        {typers.length > 0 && (
          <p className="flex items-center gap-1.5 px-4 pb-1 text-[11px] text-white/40">
            {typers.length === 1 ? `${typers[0].displayName} is typing` : `${typers.length} people are typing`}
            <span className="flex gap-0.5">
              <span className="h-1 w-1 animate-bounce rounded-full bg-white/40 [animation-delay:0ms]" />
              <span className="h-1 w-1 animate-bounce rounded-full bg-white/40 [animation-delay:150ms]" />
              <span className="h-1 w-1 animate-bounce rounded-full bg-white/40 [animation-delay:300ms]" />
            </span>
          </p>
        )}

        <form onSubmit={handleSubmit} className="border-t border-border p-3">
          {replyTo && (
            <div className="mb-2 flex items-center justify-between gap-2 rounded-lg bg-surface-2 px-3 py-1.5 text-xs text-white/50">
              <span className="truncate">Replying to {replyTo.authorName}: {replyTo.text}</span>
              <button type="button" onClick={() => setReplyTo(null)} className="cursor-target shrink-0 text-white/40 hover:text-white"><X size={12} /></button>
            </div>
          )}
          <div className="flex items-center gap-2">
            {isAppwriteConfigured && (
              <>
                <input ref={fileInputRef} type="file" onChange={handleFileSelect} className="hidden" />
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={uploading}
                  aria-label="Attach file"
                  className="cursor-target shrink-0 rounded-xl border border-border bg-surface-2 p-2 text-white/50 hover:border-brand-400/40 hover:text-white disabled:opacity-50"
                >
                  <Paperclip size={14} />
                </button>
              </>
            )}
            <input
              value={text}
              onChange={handleTextChange}
              placeholder={`Message ${otherName}, or try !ai <question>...`}
              maxLength={500}
              className="w-full rounded-xl border border-border bg-surface-2 px-4 py-2 text-sm text-white placeholder:text-white/30 focus:border-brand-500/50 focus:outline-none"
            />
            <Button type="submit" size="sm" disabled={!text.trim()}>
              <Send size={14} />
            </Button>
          </div>
        </form>
      </div>
    </div>,
    document.body,
  );
}
