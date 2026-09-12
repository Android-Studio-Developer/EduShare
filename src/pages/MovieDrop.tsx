import { useEffect, useState, type FormEvent } from "react";
import { Popcorn, Trash2, UserPlus, Users, X } from "lucide-react";
import { useAuth } from "../context/AuthContext";
import { isStaffRole } from "../lib/moderation";
import { cancelMovieSignup, clearMovieSignups, signUpForNextMovie, subscribeToMovieSignups } from "../lib/movieDrop";
import { subscribeToProfile } from "../lib/profiles";
import type { MovieSignup, UserProfile } from "../types";
import Button from "../components/Button";

const MOVIE_URL = encodeURI("/Chloe.A Film.mp4");

export default function MovieDrop() {
  const { user, role } = useAuth();
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [signups, setSignups] = useState<MovieSignup[]>([]);
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!user) return;
    return subscribeToProfile(user.uid, setProfile);
  }, [user]);

  useEffect(() => subscribeToMovieSignups(setSignups), []);

  const mySignup = signups.find((s) => s.id === user?.uid) ?? null;

  async function handleSignUp(e: FormEvent) {
    e.preventDefault();
    if (!user || !profile) return;
    setSaving(true);
    setError("");
    try {
      await signUpForNextMovie(user.uid, profile.displayName, profile.photoUrl, note);
      setNote("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not sign up.");
    } finally {
      setSaving(false);
    }
  }

  async function handleCancel() {
    if (!user) return;
    setSaving(true);
    try {
      await cancelMovieSignup(user.uid);
    } finally {
      setSaving(false);
    }
  }

  async function handleClearAll() {
    if (!confirm("Clear the entire signup list?")) return;
    await clearMovieSignups();
  }

  return (
    <div className="mx-auto max-w-4xl px-6 py-14">
      <div className="flex items-center gap-2">
        <Popcorn size={22} className="text-brand-400" />
        <h1 className="font-mono text-2xl font-bold text-white">Movie Drop</h1>
      </div>
      <p className="mt-1 text-sm text-white/45">Chloe: A Film</p>

      <div className="mt-8 overflow-hidden rounded-2xl border border-border bg-black">
        <video controls preload="metadata" className="w-full max-h-[70vh]" src={MOVIE_URL}>
          Your browser can't play this video.
        </video>
      </div>

      <section className="mt-8 rounded-2xl border border-border bg-surface p-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <Users size={17} className="text-brand-300" />
            <div>
              <h2 className="font-mono text-lg font-bold text-white">Sign up for the next movie</h2>
              <p className="text-xs text-white/40">Want to be in the next Movie Drop production? Add your name to the list.</p>
            </div>
          </div>
          {isStaffRole(role) && signups.length > 0 && (
            <Button size="sm" variant="ghost" onClick={() => void handleClearAll()}>
              <Trash2 size={13} /> Clear list
            </Button>
          )}
        </div>

        {user && (
          <div className="mt-4">
            {mySignup ? (
              <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-emerald-400/25 bg-emerald-400/5 px-4 py-3">
                <p className="text-sm text-emerald-200">You're signed up{mySignup.note ? ` — "${mySignup.note}"` : ""}.</p>
                <Button size="sm" variant="ghost" disabled={saving} onClick={() => void handleCancel()}>
                  <X size={13} /> Cancel signup
                </Button>
              </div>
            ) : (
              <form onSubmit={handleSignUp} className="flex flex-wrap gap-2">
                <input
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  maxLength={200}
                  placeholder="Optional note — a role you'd want, availability, etc."
                  className="min-w-0 flex-1 rounded-xl border border-border bg-surface-2 px-3 py-2 text-sm text-white placeholder:text-white/25"
                />
                <Button type="submit" size="sm" disabled={saving}>
                  <UserPlus size={13} /> Sign up
                </Button>
              </form>
            )}
            {error && <p className="mt-2 text-xs text-red-400">{error}</p>}
          </div>
        )}

        <div className="mt-5 space-y-2">
          {signups.length === 0 ? (
            <p className="py-6 text-center text-xs text-white/25">No one's signed up yet — be the first.</p>
          ) : (
            signups.map((s) => (
              <div key={s.id} className="flex items-center gap-3 rounded-xl border border-border bg-surface-2/50 px-3 py-2">
                {s.photoUrl ? (
                  <img src={s.photoUrl} alt="" className="h-8 w-8 rounded-full object-cover" />
                ) : (
                  <span className="grid h-8 w-8 place-items-center rounded-full bg-brand-500/20 text-xs font-bold text-brand-200">{s.displayName.slice(0, 1).toUpperCase()}</span>
                )}
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-white">{s.displayName}</p>
                  {s.note && <p className="truncate text-xs text-white/40">{s.note}</p>}
                </div>
              </div>
            ))
          )}
        </div>
      </section>
    </div>
  );
}
