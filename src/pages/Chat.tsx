import { useEffect, useState } from "react";
import { Gamepad2, MessageCircle, Shield } from "lucide-react";
import PublicChat from "../components/PublicChat";
import StatusDot from "../components/StatusDot";
import { isOnline, subscribeToAllProfiles } from "../lib/profiles";
import { arcadeLevel } from "../lib/minigames";
import { rankNameClass, RANK_LABEL, STAFF_RANKS } from "../lib/ranks";
import { useNow } from "../hooks/useNow";
import type { UserProfile } from "../types";
import ProfileCard from "../components/ProfileCard";

export default function Chat() {
  const [profiles, setProfiles] = useState<UserProfile[]>([]);
  const [openProfileId, setOpenProfileId] = useState<string | null>(null);
  useNow();

  useEffect(() => subscribeToAllProfiles(setProfiles), []);

  const online = profiles.filter(isOnline).sort((a, b) => b.lastActiveAt - a.lastActiveAt);
  const staff = profiles.filter((p) => STAFF_RANKS.includes(p.rank));
  const arcadeTop = [...profiles].filter((p) => p.botXp > 0).sort((a, b) => b.botXp - a.botXp).slice(0, 5);

  return (
    <div className="mx-auto max-w-6xl px-6 py-14">
      <div className="flex items-center gap-3">
        <MessageCircle size={26} className="text-brand-400" />
        <div>
          <h1 className="font-mono text-2xl font-bold text-white">Global Chat</h1>
          <p className="text-sm text-white/45">Talk with the whole eduShare community.</p>
        </div>
      </div>
      <div className="mt-8 grid grid-cols-1 gap-5 lg:grid-cols-[1fr_260px]">
        <div className="glass-panel min-w-0 rounded-2xl">
          <PublicChat tall />
        </div>

        <div className="space-y-5">
          <div className="rounded-2xl border border-border bg-surface p-4">
            <p className="font-mono text-xs font-semibold uppercase tracking-wide text-white/50">
              Online now — {online.length}
            </p>
            <div className="mt-3 space-y-2.5">
              {online.length === 0 && <p className="text-xs text-white/30">Nobody's online right now.</p>}
              {online.map((p) => (
                <div key={p.id} onClick={() => setOpenProfileId(p.id)} className="cursor-target flex cursor-pointer items-center gap-2">
                  <div className="relative shrink-0">
                    {p.photoUrl ? (
                      <img src={p.photoUrl} alt="" className="h-7 w-7 rounded-full object-cover" />
                    ) : (
                      <div className="flex h-7 w-7 items-center justify-center rounded-full bg-gradient-to-br from-cyan-400 to-fuchsia-500 font-mono text-[10px] font-bold text-white">
                        {p.displayName.slice(0, 1).toUpperCase()}
                      </div>
                    )}
                    <StatusDot online className="absolute -bottom-0.5 -right-0.5" />
                  </div>
                  <span className={`min-w-0 flex-1 truncate text-xs font-medium ${rankNameClass(p.rank)}`}>{p.displayName}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-2xl border border-border bg-surface p-4">
            <p className="flex items-center gap-1.5 font-mono text-xs font-semibold uppercase tracking-wide text-white/50">
              <Gamepad2 size={12} /> Arcade leaderboard
            </p>
            <p className="mt-1 text-[11px] text-white/40">Play !coinflip, !rps, !slots, !trivia in chat.</p>
            <div className="mt-3 space-y-2.5">
              {arcadeTop.length === 0 && <p className="text-xs text-white/30">No XP earned yet — be first!</p>}
              {arcadeTop.map((p, i) => (
                <div key={p.id} className="flex items-center gap-2">
                  <span className="w-4 shrink-0 text-center font-mono text-[10px] text-white/30">{i + 1}</span>
                  {p.photoUrl ? (
                    <img src={p.photoUrl} alt="" className="h-6 w-6 shrink-0 rounded-full object-cover" />
                  ) : (
                    <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-cyan-400 to-fuchsia-500 font-mono text-[9px] font-bold text-white">
                      {p.displayName.slice(0, 1).toUpperCase()}
                    </div>
                  )}
                  <span className="min-w-0 flex-1 truncate text-xs font-medium text-white/80">{p.displayName}</span>
                  <span className="shrink-0 text-[10px] text-white/35">Lv.{arcadeLevel(p.botXp)} · {p.botXp}xp</span>
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-2xl border border-border bg-surface p-4">
            <p className="flex items-center gap-1.5 font-mono text-xs font-semibold uppercase tracking-wide text-white/50">
              <Shield size={12} /> Contact staff
            </p>
            <p className="mt-1 text-[11px] text-white/40">Message any of these in Global Chat.</p>
            <div className="mt-3 space-y-2.5">
              {staff.length === 0 && <p className="text-xs text-white/30">No staff assigned yet.</p>}
              {staff.map((p) => (
                <div key={p.id} onClick={() => setOpenProfileId(p.id)} className="cursor-target flex cursor-pointer items-center gap-2">
                  <div className="relative shrink-0">
                    {p.photoUrl ? (
                      <img src={p.photoUrl} alt="" className="h-7 w-7 rounded-full object-cover" />
                    ) : (
                      <div className="flex h-7 w-7 items-center justify-center rounded-full bg-gradient-to-br from-cyan-400 to-fuchsia-500 font-mono text-[10px] font-bold text-white">
                        {p.displayName.slice(0, 1).toUpperCase()}
                      </div>
                    )}
                    <StatusDot online={isOnline(p)} className="absolute -bottom-0.5 -right-0.5" />
                  </div>
                  <div className="min-w-0">
                    <p className={`truncate text-xs font-medium ${rankNameClass(p.rank)}`}>{p.displayName}</p>
                    <p className="text-[10px] text-white/35">{RANK_LABEL[p.rank ?? "none"]}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
      {openProfileId && <ProfileCard userId={openProfileId} onClose={() => setOpenProfileId(null)} />}
    </div>
  );
}
