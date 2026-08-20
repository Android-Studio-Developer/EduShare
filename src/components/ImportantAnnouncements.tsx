import { useEffect, useState } from "react";
import { AlertTriangle, Check, Megaphone, Pencil, Send, Trash2, X } from "lucide-react";
import { useAuth } from "../context/AuthContext";
import {
  deleteImportantAnnouncement,
  postImportantAnnouncement,
  subscribeToImportantAnnouncements,
  updateImportantAnnouncement,
  type ImportantAnnouncement,
} from "../lib/siteAnnouncements";

function formatAnnouncementTime(value: number) {
  if (!value) return "now";
  return new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(value));
}

export default function ImportantAnnouncements() {
  const { user, role } = useAuth();
  const [items, setItems] = useState<ImportantAnnouncement[]>([]);
  const [composerOpen, setComposerOpen] = useState(false);
  const [text, setText] = useState("");
  const [posting, setPosting] = useState(false);
  const [error, setError] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editText, setEditText] = useState("");
  const [saving, setSaving] = useState(false);

  const canManage = role === "owner" || role === "moderator";

  useEffect(() => {
    return subscribeToImportantAnnouncements(setItems);
  }, []);

  async function submitAnnouncement() {
    if (!user || !canManage) return;

    const clean = text.trim();
    if (!clean) return;

    setPosting(true);
    setError("");

    try {
      await postImportantAnnouncement({
        text: clean,
        authorId: user.uid,
        authorName:
          user.displayName?.trim() || (role === "owner" ? "Owner" : "Moderator"),
        authorRole: role,
      });
      setText("");
      setComposerOpen(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not post announcement.");
    } finally {
      setPosting(false);
    }
  }

  async function removeAnnouncement(id: string) {
    if (!canManage) return;

    setError("");
    try {
      await deleteImportantAnnouncement(id);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not delete announcement.");
    }
  }

  function startEditing(item: ImportantAnnouncement) {
    setEditingId(item.id);
    setEditText(item.text);
    setError("");
  }

  async function saveEdit() {
    if (!editingId || !canManage) return;
    setSaving(true);
    setError("");
    try {
      await updateImportantAnnouncement(editingId, editText);
      setEditingId(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save changes.");
    } finally {
      setSaving(false);
    }
  }

  // Normal members don't need to see an empty announcement panel.
  // Staff always see it so they have somewhere to post the first announcement.
  if (items.length === 0 && !canManage) return null;

  return (
    <section className="mx-auto max-w-6xl px-6 pt-6 sm:pt-8">
      <div className="overflow-hidden rounded-2xl border border-amber-300/25 bg-gradient-to-br from-amber-500/[.12] via-orange-500/[.07] to-red-500/[.08] shadow-[0_18px_60px_rgba(245,158,11,.08)]">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-amber-200/10 px-4 py-3 sm:px-5">
          <div className="flex items-center gap-2.5">
            <span className="grid h-9 w-9 place-items-center rounded-xl border border-amber-300/25 bg-amber-400/10 text-amber-300">
              <Megaphone size={18} />
            </span>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="font-mono text-sm font-bold uppercase tracking-[0.08em] text-amber-100">
                  Important Announcement
                </h2>
                <AlertTriangle size={14} className="text-amber-300" />
              </div>
              <p className="text-xs text-amber-100/45">Official eduShare staff updates</p>
            </div>
          </div>

          {canManage && (
            <button
              type="button"
              onClick={() => {
                setError("");
                setComposerOpen((open) => !open);
              }}
              className="cursor-target rounded-lg border border-amber-300/25 bg-amber-400/10 px-3 py-1.5 font-mono text-xs font-semibold text-amber-100 transition hover:bg-amber-400/15"
            >
              {composerOpen ? "Cancel" : "+ New announcement"}
            </button>
          )}
        </div>

        {composerOpen && canManage && (
          <div className="border-b border-amber-200/10 p-4 sm:p-5">
            <div className="flex items-start gap-2">
              <textarea
                value={text}
                onChange={(event) => setText(event.target.value.slice(0, 1200))}
                placeholder="Post an important update for everyone..."
                rows={3}
                autoFocus
                className="min-h-[88px] flex-1 resize-y rounded-xl border border-white/10 bg-black/25 px-3 py-2.5 text-sm text-white outline-none placeholder:text-white/30 focus:border-amber-300/40"
              />
              <button
                type="button"
                title="Close"
                onClick={() => setComposerOpen(false)}
                className="cursor-target rounded-lg p-2 text-white/40 hover:bg-white/5 hover:text-white"
              >
                <X size={17} />
              </button>
            </div>
            <div className="mt-2 flex items-center justify-between gap-3">
              <span className="font-mono text-[11px] text-white/30">{text.length}/1200</span>
              <button
                type="button"
                onClick={submitAnnouncement}
                disabled={posting || !text.trim()}
                className="cursor-target inline-flex items-center gap-2 rounded-lg bg-amber-300 px-3 py-2 font-mono text-xs font-bold text-black transition hover:bg-amber-200 disabled:cursor-not-allowed disabled:opacity-40"
              >
                <Send size={14} /> {posting ? "Posting..." : "Post"}
              </button>
            </div>
          </div>
        )}

        {error && (
          <div className="border-b border-red-400/15 bg-red-500/10 px-5 py-2 text-xs text-red-200">
            {error}
          </div>
        )}

        {items.length === 0 ? (
          <div className="px-5 py-5 text-sm text-white/40">
            No important announcements yet. Staff can post one here.
          </div>
        ) : (
          <div className="divide-y divide-white/[.06]">
            {items.slice(0, 5).map((item) => (
              <article key={item.id} className="group px-4 py-4 sm:px-5">
                {editingId === item.id ? (
                  <div>
                    <textarea
                      value={editText}
                      onChange={(event) => setEditText(event.target.value.slice(0, 1200))}
                      rows={3}
                      autoFocus
                      className="min-h-[88px] w-full resize-y rounded-xl border border-white/10 bg-black/25 px-3 py-2.5 text-sm text-white outline-none placeholder:text-white/30 focus:border-amber-300/40"
                    />
                    <div className="mt-2 flex items-center justify-between gap-3">
                      <span className="font-mono text-[11px] text-white/30">{editText.length}/1200</span>
                      <div className="flex gap-2">
                        <button
                          type="button"
                          onClick={() => setEditingId(null)}
                          className="cursor-target rounded-lg border border-white/10 px-3 py-1.5 font-mono text-xs text-white/60 hover:bg-white/5"
                        >
                          Cancel
                        </button>
                        <button
                          type="button"
                          onClick={() => void saveEdit()}
                          disabled={saving || !editText.trim()}
                          className="cursor-target inline-flex items-center gap-1.5 rounded-lg bg-amber-300 px-3 py-1.5 font-mono text-xs font-bold text-black transition hover:bg-amber-200 disabled:cursor-not-allowed disabled:opacity-40"
                        >
                          <Check size={13} /> {saving ? "Saving..." : "Save"}
                        </button>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="flex items-start justify-between gap-4">
                    <div className="min-w-0">
                      <p className="whitespace-pre-wrap break-words text-sm leading-6 text-white/85 sm:text-[15px]">
                        {item.text}
                      </p>
                      <div className="mt-2 flex flex-wrap items-center gap-2 font-mono text-[11px] text-white/35">
                        <span className={item.authorRole === "owner" ? "text-yellow-300/80" : "text-blue-300/80"}>
                          {item.authorRole === "owner" ? "OWNER" : "MOD"}
                        </span>
                        <span>•</span>
                        <span>{item.authorName}</span>
                        <span>•</span>
                        <span>{formatAnnouncementTime(item.createdAt)}</span>
                      </div>
                    </div>

                    {canManage && (
                      <div className="flex shrink-0 gap-1 opacity-0 transition group-hover:opacity-100 focus-within:opacity-100">
                        <button
                          type="button"
                          title="Edit announcement"
                          onClick={() => startEditing(item)}
                          className="cursor-target rounded-lg p-2 text-white/20 hover:bg-white/10 hover:text-white"
                        >
                          <Pencil size={15} />
                        </button>
                        <button
                          type="button"
                          title="Delete announcement"
                          onClick={() => void removeAnnouncement(item.id)}
                          className="cursor-target rounded-lg p-2 text-white/20 hover:bg-red-500/10 hover:text-red-300"
                        >
                          <Trash2 size={15} />
                        </button>
                      </div>
                    )}
                  </div>
                )}
              </article>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}
