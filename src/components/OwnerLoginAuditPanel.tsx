import { useEffect, useMemo, useState } from "react";
import { Ban, CheckCircle2, Globe2, Laptop, Search, ShieldAlert } from "lucide-react";
import { subscribeToOwnerLoginAudits } from "../lib/accountAudit";
import { banPlayer, subscribeToAllProfiles, unbanPlayer } from "../lib/profiles";
import type { OwnerLoginAudit, UserProfile } from "../types";
import Button from "./Button";

export default function OwnerLoginAuditPanel({ ownerId }: { ownerId: string }) {
  const [events, setEvents] = useState<OwnerLoginAudit[]>([]);
  const [profiles, setProfiles] = useState<UserProfile[]>([]);
  const [search, setSearch] = useState("");
  const [busyId, setBusyId] = useState("");
  useEffect(() => subscribeToOwnerLoginAudits(setEvents), []);
  useEffect(() => subscribeToAllProfiles(setProfiles), []);
  const profilesById = useMemo(() => new Map(profiles.map((profile) => [profile.id, profile])), [profiles]);
  const visible = useMemo(() => {
    const needle = search.trim().toLowerCase();
    return needle ? events.filter((event) => `${event.email} ${event.ipAddress} ${event.os} ${event.browser} ${profilesById.get(event.userId)?.displayName ?? ""}`.toLowerCase().includes(needle)) : events;
  }, [events, profilesById, search]);

  async function toggleBan(event: OwnerLoginAudit) {
    if (event.userId === ownerId) return;
    const profile = profilesById.get(event.userId);
    if (!profile) return;
    const nextBanned = !profile.banned;
    if (nextBanned && !window.confirm(`Ban ${profile.displayName || event.email}? They will lose access until you unban them.`)) return;
    setBusyId(event.userId);
    try { await (nextBanned ? banPlayer(event.userId) : unbanPlayer(event.userId)); }
    finally { setBusyId(""); }
  }

  return <section className="mt-10 overflow-hidden rounded-2xl border border-red-400/15 bg-surface">
    <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border p-5"><div><h2 className="flex items-center gap-2 font-mono text-xl font-bold text-white"><ShieldAlert size={20} className="text-red-300"/>Owner login security</h2><p className="mt-1 text-xs text-white/40">Private IP and operating-system audit. Matching IPs are evidence to review, not automatic proof of spam.</p></div><label className="flex items-center gap-2 rounded-xl border border-border bg-surface-2 px-3 py-2"><Search size={14} className="text-white/30"/><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Email, IP, OS, name" className="w-48 bg-transparent text-xs text-white outline-none placeholder:text-white/25"/></label></div>
    <div className="max-h-[620px] overflow-auto p-4">{visible.length === 0 ? <p className="py-12 text-center text-sm text-white/30">No server-verified login records yet.</p> : <div className="space-y-2">{visible.map((event) => { const profile = profilesById.get(event.userId); return <article key={event.id} className="grid gap-3 rounded-xl border border-border bg-black/15 p-4 md:grid-cols-[1fr_auto]"><div className="min-w-0"><div className="flex flex-wrap items-center gap-2"><b className="truncate text-sm text-white">{profile?.displayName || event.email || "Unknown account"}</b><span className="rounded bg-white/5 px-1.5 py-0.5 text-[10px] uppercase text-white/35">{event.method}</span>{profile?.banned && <span className="rounded bg-red-500/10 px-1.5 py-0.5 text-[10px] font-bold text-red-300">BANNED</span>}</div><p className="mt-1 break-all text-xs text-white/40">{event.email || "No email"}</p><div className="mt-3 flex flex-wrap gap-x-5 gap-y-1 text-xs text-white/55"><span className="flex items-center gap-1.5"><Globe2 size={13} className="text-cyan-300"/>{event.ipAddress}</span><span className="flex items-center gap-1.5"><Laptop size={13} className="text-violet-300"/>{event.browser || "Browser"} on {event.os || "Unknown OS"}</span><span className="text-white/25">{new Date(event.createdAt).toLocaleString()}</span></div></div><div className="flex items-center">{event.userId === ownerId ? <span className="text-xs text-amber-300/60">Owner</span> : profile ? <Button size="sm" variant={profile.banned ? "secondary" : "danger"} disabled={busyId === event.userId} onClick={() => void toggleBan(event)}>{profile.banned ? <CheckCircle2 size={13}/> : <Ban size={13}/>} {profile.banned ? "Unban" : "Ban account"}</Button> : <span className="text-xs text-white/25">Profile unavailable</span>}</div></article>; })}</div>}</div>
  </section>;
}
