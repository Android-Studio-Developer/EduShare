import { Check, Coins, Rocket, Sparkles, X } from "lucide-react";
import type { CommunityChatServer } from "../types";
import {
  COMMUNITY_SERVER_BOOST_COST,
  COMMUNITY_SERVER_BOOST_LEVELS,
  COMMUNITY_SERVER_EXTRA_PERKS,
  communityServerBoostProgress,
} from "../lib/communityServerBoosts";

export default function CommunityServerBoostModal({
  server,
  balance,
  busy,
  onClose,
  onBoost,
}: {
  server: CommunityChatServer;
  balance: number;
  busy: boolean;
  onClose: () => void;
  onBoost: () => void;
}) {
  const boosts = server.boostCount ?? 0;
  const { current, next, progress } = communityServerBoostProgress(boosts);
  const canAfford = balance >= COMMUNITY_SERVER_BOOST_COST;

  return (
    <div className="fixed inset-0 z-[100] grid place-items-center bg-black/75 p-4 backdrop-blur-sm" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
      <section className="max-h-[92vh] w-full max-w-3xl overflow-y-auto rounded-2xl border border-white/10 bg-[#1e1f22] text-white shadow-2xl shadow-black/60">
        <header className="sticky top-0 z-10 flex items-center gap-3 border-b border-black/35 bg-[#1e1f22]/95 px-5 py-4 backdrop-blur-xl">
          <span className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-gradient-to-br from-fuchsia-500 to-[#5865f2] shadow-lg shadow-fuchsia-500/15"><Rocket size={21}/></span>
          <div className="min-w-0 flex-1"><h2 className="truncate text-lg font-black">Boost {server.name}</h2><p className="text-xs text-[#b5bac1]">Unlock better cosmetics, uploads, voice, and streams for everyone.</p></div>
          <button type="button" onClick={onClose} className="cursor-target grid h-9 w-9 place-items-center rounded-full text-[#b5bac1] hover:bg-white/10 hover:text-white" aria-label="Close"><X size={18}/></button>
        </header>

        <div className="p-5">
          <div className="rounded-xl bg-gradient-to-br from-[#5865f2]/25 via-fuchsia-500/10 to-transparent p-4 ring-1 ring-white/10">
            <div className="flex items-end justify-between gap-3"><div><p className="text-xs font-bold uppercase tracking-[.16em] text-fuchsia-200/70">{current ? current.title : "No boost level yet"}</p><p className="mt-1 text-2xl font-black">{boosts} boost{boosts === 1 ? "" : "s"}</p></div><p className="text-right text-xs text-white/45">{next ? `${next.boosts - boosts} more to ${next.title}` : "Maximum level reached"}</p></div>
            <div className="mt-4 h-2 overflow-hidden rounded-full bg-black/30"><div className="h-full rounded-full bg-gradient-to-r from-[#5865f2] to-fuchsia-400 transition-[width] duration-500" style={{ width: `${progress * 100}%` }}/></div>
          </div>

          <div className="mt-5 grid gap-3 md:grid-cols-3">
            {COMMUNITY_SERVER_BOOST_LEVELS.map((level) => {
              const unlocked = boosts >= level.boosts;
              return <article key={level.level} className={`rounded-xl border p-4 ${unlocked ? "border-fuchsia-400/30 bg-fuchsia-400/[.07]" : "border-white/[.08] bg-[#2b2d31]"}`}>
                <div className="flex items-center justify-between gap-2"><h3 className="font-black">{level.title}</h3><span className={`rounded-full px-2 py-1 text-[10px] font-bold ${unlocked ? "bg-fuchsia-400/15 text-fuchsia-200" : "bg-black/20 text-white/40"}`}>{unlocked ? "UNLOCKED" : `${level.boosts} BOOSTS`}</span></div>
                <ul className="mt-3 space-y-2">{level.perks.map((perk) => <li key={perk} className="flex gap-2 text-xs leading-4 text-[#b5bac1]"><Check size={12} className={`mt-0.5 shrink-0 ${unlocked ? "text-fuchsia-300" : "text-white/25"}`}/><span>{perk}</span></li>)}</ul>
              </article>;
            })}
          </div>

          <div className="mt-4 rounded-xl border border-white/[.08] bg-[#2b2d31] p-4"><div className="flex items-center gap-2"><Sparkles size={16} className="text-fuchsia-300"/><h3 className="font-bold">Extra perks</h3><span className="text-[10px] text-white/35">3 boosts each</span></div><div className="mt-3 grid gap-2 sm:grid-cols-2">{COMMUNITY_SERVER_EXTRA_PERKS.map((perk) => <div key={perk.title} className="rounded-lg bg-black/15 p-3"><p className="text-sm font-bold text-white/85">{perk.title}</p><p className="mt-1 text-xs leading-5 text-white/40">{perk.description}</p></div>)}</div></div>

          <div className="mt-5 flex flex-col gap-3 rounded-xl border border-white/10 bg-[#111214] p-4 sm:flex-row sm:items-center"><div className="min-w-0 flex-1"><p className="flex items-center gap-2 font-bold"><Coins size={16} className="text-amber-300"/>{COMMUNITY_SERVER_BOOST_COST} credits per boost</p><p className="mt-1 text-xs text-white/40">Your balance: {balance.toLocaleString()} credits</p></div><button type="button" onClick={onBoost} disabled={busy || !canAfford} className="cursor-target inline-flex min-w-44 items-center justify-center gap-2 rounded-lg bg-gradient-to-r from-[#5865f2] to-fuchsia-500 px-5 py-3 text-sm font-black text-white shadow-lg shadow-[#5865f2]/20 hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-40"><Rocket size={16}/>{busy ? "Boosting…" : `Boost · ${COMMUNITY_SERVER_BOOST_COST}`}</button></div>
          {!canAfford && <p className="mt-2 text-center text-xs text-red-300">You need {(COMMUNITY_SERVER_BOOST_COST - balance).toLocaleString()} more credits.</p>}
        </div>
      </section>
    </div>
  );
}
