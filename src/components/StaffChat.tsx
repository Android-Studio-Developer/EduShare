import { useEffect, useRef, useState, type FormEvent } from "react";
import { LockKeyhole, Send, Trash2 } from "lucide-react";
import { useAuth } from "../context/AuthContext";
import { deleteStaffMessage, sendStaffMessage, subscribeToStaffMessages } from "../lib/chat";
import { isStaffRole } from "../lib/moderation";
import { subscribeToProfile } from "../lib/profiles";
import { rankNameClass } from "../lib/ranks";
import type { ChatMessage, UserProfile } from "../types";

function timeAgo(timestamp: number) {
  const seconds = Math.floor((Date.now() - timestamp) / 1000);
  if (seconds < 60) return "now";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h`;
  return `${Math.floor(hours / 24)}d`;
}

export default function StaffChat() {
  const { user, role } = useAuth();
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");
  const scrollRef = useRef<HTMLDivElement>(null);
  const isStaff = isStaffRole(role);

  useEffect(() => {
    if (!user || !isStaff) return;
    return subscribeToProfile(user.uid, setProfile);
  }, [isStaff, user]);

  useEffect(() => {
    if (!isStaff) return;
    return subscribeToStaffMessages(setMessages);
  }, [isStaff]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages.length]);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    const message = text.trim();
    if (!user || !isStaff || !message || sending) return;
    setSending(true);
    setError("");
    try {
      await sendStaffMessage(
        user.uid,
        profile?.displayName || user.displayName || "Staff",
        message.slice(0, 500),
        profile?.rank ?? "none",
        profile?.photoUrl || user.photoURL || "",
      );
      setText("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not send the message.");
    } finally {
      setSending(false);
    }
  }

  if (!isStaff) return null;

  return (
    <div className="overflow-hidden rounded-2xl border border-amber-300/20 bg-surface">
      <div className="flex items-center gap-2 border-b border-border bg-amber-300/[0.04] px-6 py-3">
        <LockKeyhole size={16} className="text-amber-300" />
        <div>
          <h3 className="font-mono text-sm font-semibold text-white">Staff Meeting</h3>
          <p className="text-[10px] text-white/35">Private text room · owner and moderators only</p>
        </div>
        <span className="ml-auto rounded-full border border-amber-300/20 bg-amber-300/10 px-2 py-1 font-mono text-[9px] font-semibold uppercase tracking-wider text-amber-200">Staff only</span>
      </div>

      <div ref={scrollRef} className="h-[34rem] min-h-[34rem] space-y-3 overflow-y-auto p-4 sm:p-5 lg:h-[calc(100vh-15rem)] lg:max-h-[52rem]">
        {messages.length === 0 ? (
          <div className="flex h-full flex-col items-center justify-center text-center">
            <LockKeyhole size={28} className="text-amber-300/50" />
            <p className="mt-3 text-sm font-medium text-white/60">The staff meeting is ready.</p>
            <p className="mt-1 text-xs text-white/30">Messages here are only visible to the owner and moderators.</p>
          </div>
        ) : messages.map((message) => (
          <div key={message.id} className="group flex items-start gap-2.5">
            {message.authorPhotoUrl ? (
              <img src={message.authorPhotoUrl} alt="" className="mt-0.5 h-7 w-7 shrink-0 rounded-full object-cover" />
            ) : (
              <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-amber-300/10 font-mono text-[10px] font-bold text-amber-200">
                {message.authorName.slice(0, 1).toUpperCase()}
              </span>
            )}
            <div className="min-w-0 flex-1">
              <div className="flex items-baseline gap-2">
                <span className={`truncate text-xs font-semibold ${rankNameClass(message.authorRank)}`}>{message.authorName}</span>
                <span className="text-[10px] text-white/25">{timeAgo(message.createdAt)}</span>
              </div>
              <p className="mt-0.5 break-words text-sm text-white/70 [overflow-wrap:anywhere]">{message.text}</p>
            </div>
            <button type="button" onClick={() => void deleteStaffMessage(message.id)} aria-label="Delete message" className="cursor-target rounded-lg p-1.5 text-white/20 opacity-0 hover:bg-red-500/10 hover:text-red-400 group-hover:opacity-100">
              <Trash2 size={13} />
            </button>
          </div>
        ))}
      </div>

      <form onSubmit={handleSubmit} className="border-t border-border p-3">
        {error && <p className="mb-2 text-xs text-red-400">{error}</p>}
        <div className="flex items-center gap-2 rounded-xl border border-border bg-surface-2 px-3 py-2 focus-within:border-amber-300/30">
          <input value={text} onChange={(event) => setText(event.target.value)} maxLength={500} placeholder="Message the staff team..." className="min-w-0 flex-1 bg-transparent text-sm text-white outline-none placeholder:text-white/25" />
          <button type="submit" disabled={!text.trim() || sending} aria-label="Send message" className="cursor-target rounded-lg bg-amber-300/10 p-2 text-amber-200 transition hover:bg-amber-300/20 disabled:cursor-not-allowed disabled:opacity-30">
            <Send size={15} />
          </button>
        </div>
      </form>
    </div>
  );
}
