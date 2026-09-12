import { useEffect, useState, type FormEvent } from "react";
import { Laugh, Lock, Plus, Trash2, Users } from "lucide-react";
import { useAuth } from "../context/AuthContext";
import { createMeme, deleteMeme, isHttpsImageUrl, subscribeToVisibleMemes } from "../lib/memes";
import { isStaffRole } from "../lib/moderation";
import { subscribeToAllProfiles } from "../lib/profiles";
import { extractYoutubeId } from "../lib/chat";
import type { MemePost, MemeVisibility, UserProfile } from "../types";
import Button from "../components/Button";
import LazyYoutubeEmbed from "../components/LazyYoutubeEmbed";

const URL_RE = /(https?:\/\/[^\s]+)/g;

function linkify(text: string) {
  return text.split(URL_RE).map((segment, i) =>
    /^https?:\/\//.test(segment) ? (
      <a key={i} href={segment} target="_blank" rel="noopener noreferrer" className="text-brand-300 underline hover:text-brand-200">
        {segment}
      </a>
    ) : (
      segment
    ),
  );
}

export default function Memes() {
  const { user, role } = useAuth();
  const isStaff = isStaffRole(role);
  const [memes, setMemes] = useState<MemePost[]>([]);
  const [profiles, setProfiles] = useState<UserProfile[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [imageUrl, setImageUrl] = useState("");
  const [caption, setCaption] = useState("");
  const [visibility, setVisibility] = useState<MemeVisibility>("public");
  const [recipientId, setRecipientId] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => subscribeToAllProfiles(setProfiles), []);
  useEffect(() => {
    if (!user) return;
    return subscribeToVisibleMemes(user.uid, setMemes);
  }, [user]);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!user) return;
    setError("");
    if (!isHttpsImageUrl(imageUrl)) {
      setError("Image link must be a valid https:// URL.");
      return;
    }
    const recipient = profiles.find((p) => p.id === recipientId);
    if (visibility === "private" && !recipient) {
      setError("Pick who this private meme is for.");
      return;
    }
    setSubmitting(true);
    try {
      await createMeme({
        authorId: user.uid,
        authorName: user.displayName ?? "Player",
        authorPhotoUrl: user.photoURL ?? "",
        imageUrl: imageUrl.trim(),
        caption,
        visibility,
        recipientId: recipient?.id ?? "",
        recipientName: recipient?.displayName ?? "",
      });
      setImageUrl(""); setCaption(""); setVisibility("public"); setRecipientId(""); setShowForm(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not post.");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleDelete(id: string) {
    if (!confirm("Delete this meme?")) return;
    await deleteMeme(id);
  }

  return (
    <div className="mx-auto max-w-3xl px-6 py-14">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <Laugh size={26} className="text-brand-400" />
          <div>
            <h1 className="text-2xl font-semibold text-white">Meme Dump</h1>
            <p className="text-sm text-white/45">Post a meme publicly, or send one privately to just one person.</p>
          </div>
        </div>
        <Button size="sm" onClick={() => setShowForm((s) => !s)}>
          <Plus size={15} /> Post a meme
        </Button>
      </div>

      {showForm && (
        <form onSubmit={handleSubmit} className="mt-6 space-y-3 rounded-xl border border-border bg-surface p-6">
          <input
            required
            value={imageUrl}
            onChange={(e) => setImageUrl(e.target.value)}
            placeholder="Image link (https://...)"
            className="w-full rounded-xl border border-border bg-surface-2 px-4 py-3 text-white"
          />
          <textarea
            maxLength={300}
            rows={2}
            value={caption}
            onChange={(e) => setCaption(e.target.value)}
            placeholder="Caption (optional)"
            className="w-full rounded-xl border border-border bg-surface-2 px-4 py-3 text-white"
          />
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setVisibility("public")}
              className={`cursor-target flex flex-1 items-center justify-center gap-1.5 rounded-xl border px-3 py-2.5 text-sm font-medium ${visibility === "public" ? "border-brand-400/60 bg-brand-500/10 text-white" : "border-border text-white/50 hover:text-white"}`}
            >
              <Users size={14} /> Public
            </button>
            <button
              type="button"
              onClick={() => setVisibility("private")}
              className={`cursor-target flex flex-1 items-center justify-center gap-1.5 rounded-xl border px-3 py-2.5 text-sm font-medium ${visibility === "private" ? "border-brand-400/60 bg-brand-500/10 text-white" : "border-border text-white/50 hover:text-white"}`}
            >
              <Lock size={14} /> Private
            </button>
          </div>
          {visibility === "private" && (
            <select
              required
              value={recipientId}
              onChange={(e) => setRecipientId(e.target.value)}
              className="w-full rounded-xl border border-border bg-surface-2 px-4 py-3 text-sm text-white"
            >
              <option value="">Send to...</option>
              {profiles.filter((p) => p.id !== user?.uid).map((p) => (
                <option key={p.id} value={p.id}>{p.displayName}</option>
              ))}
            </select>
          )}
          {error && <p className="text-sm text-red-400">{error}</p>}
          <Button type="submit" disabled={submitting} className="w-full">{submitting ? "Posting…" : "Post"}</Button>
        </form>
      )}

      <div className="mt-8 space-y-4">
        {memes.map((meme) => {
          const youtubeId = extractYoutubeId(meme.imageUrl);
          return (
          <article key={meme.id} className="overflow-hidden rounded-xl border border-border bg-surface">
            {youtubeId ? (
              <LazyYoutubeEmbed videoId={youtubeId} label={meme.caption || "YouTube video"} />
            ) : (
              <img src={meme.imageUrl} alt="" className="max-h-96 w-full object-cover" />
            )}
            <div className="flex items-start justify-between gap-3 p-4">
              <div className="min-w-0">
                <p className="text-sm text-white/70">
                  <span className="font-semibold text-white">{meme.authorName}</span>
                  {meme.visibility === "private" && (
                    <span className="ml-2 inline-flex items-center gap-1 rounded-full border border-purple-400/30 bg-purple-500/10 px-2 py-0.5 text-[11px] text-purple-300">
                      <Lock size={10} /> Private to {meme.recipientId === user?.uid ? "you" : meme.recipientName}
                    </span>
                  )}
                </p>
                {meme.caption && <p className="mt-1 text-sm text-white/50 [overflow-wrap:anywhere]">{linkify(meme.caption)}</p>}
              </div>
              {(meme.authorId === user?.uid || isStaff) && (
                <Button size="sm" variant="ghost" onClick={() => handleDelete(meme.id)} aria-label="Delete">
                  <Trash2 size={14} />
                </Button>
              )}
            </div>
          </article>
          );
        })}
        {memes.length === 0 && (
          <div className="rounded-xl border border-dashed border-border py-16 text-center text-white/40">
            No memes yet. Be the first!
          </div>
        )}
      </div>
    </div>
  );
}
