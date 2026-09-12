import { useEffect, useMemo, useState, type FormEvent } from "react";
import { ArrowLeft, Building2, Clock3, Coins, Crown, Eye, Gamepad2, Radio, ShieldQuestion, Sparkles, Swords, Trophy, UserPlus, Users, X } from "lucide-react";
import { useAuth } from "../context/AuthContext";
import { useNow } from "../hooks/useNow";
import { isOnline, subscribeToAllProfiles } from "../lib/profiles";
import { createNotification } from "../lib/notifications";
import {
  cancelWordleDuel,
  claimWordleDuelPayout,
  createWordleDuel,
  enterWordleSpectatorRoom,
  joinWordleDuel,
  submitWordleDuelGuess,
  subscribeToWordleDuels,
  subscribeToWordleSpectators,
} from "../lib/wordleDuels";
import { ensureWallet, subscribeToBalance } from "../lib/shop";
import type { UserProfile, WordleDuel, WordleDuelGuess, WordleSpectator } from "../types";
import Button from "../components/Button";
import Lanyard from "../components/Lanyard";
import ChessArena from "../components/ChessArena";
import PropertyArena from "../components/PropertyArena";
import LiarsTable from "../components/LiarsTable";

const KEYBOARD_ROWS = ["QWERTYUIOP", "ASDFGHJKL", "ZXCVBNM"];
const CELL_STYLES: Record<string, string> = {
  "#": "border-emerald-400/70 bg-emerald-500 text-white shadow-[0_8px_20px_-12px_rgba(16,185,129,.8)]",
  "~": "border-amber-400/70 bg-amber-500 text-white shadow-[0_8px_20px_-12px_rgba(245,158,11,.8)]",
  "-": "border-white/10 bg-white/[.07] text-white/50",
};

function Avatar({ name, photoUrl, size = "md" }: { name: string; photoUrl: string; size?: "sm" | "md" }) {
  const dimensions = size === "sm" ? "h-7 w-7 rounded-lg text-[10px]" : "h-10 w-10 rounded-xl text-sm";
  return photoUrl ? <img src={photoUrl} alt="" className={`${dimensions} shrink-0 object-cover`} /> : (
    <span className={`${dimensions} grid shrink-0 place-items-center bg-gradient-to-br from-brand-400 to-accent-500 font-mono font-bold text-white`}>
      {(name[0] ?? "P").toUpperCase()}
    </span>
  );
}

function formatAge(timestamp: number, now: number) {
  const seconds = Math.max(0, Math.floor((now - timestamp) / 1000));
  if (seconds < 60) return "just now";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  return `${Math.floor(minutes / 60)}h ago`;
}

function WordleBoard({ guesses, revealLetters, emptyLabel }: { guesses: WordleDuelGuess[]; revealLetters: boolean; emptyLabel?: string }) {
  return (
    <div className="relative mx-auto grid w-full max-w-[19rem] grid-rows-6 gap-1.5">
      {Array.from({ length: 6 }).map((_, rowIndex) => {
        const guess = guesses[rowIndex];
        const symbols = guess?.pattern.split(" ") ?? [];
        return (
          <div key={rowIndex} className="grid grid-cols-5 gap-1.5">
            {Array.from({ length: 5 }).map((__, cellIndex) => (
              <div key={cellIndex} className={`grid aspect-square place-items-center rounded-lg border font-mono text-lg font-black transition-all sm:text-xl ${guess ? CELL_STYLES[symbols[cellIndex]] : "border-border bg-surface-2/60 text-white/20"}`}>
                {guess ? (revealLetters ? guess.word[cellIndex] : "•") : ""}
              </div>
            ))}
          </div>
        );
      })}
      {emptyLabel && guesses.length === 0 && <p className="pointer-events-none absolute inset-0 grid place-items-center text-xs text-white/25">{emptyLabel}</p>}
    </div>
  );
}

function Keyboard({ guesses, onKey }: { guesses: WordleDuelGuess[]; onKey: (key: string) => void }) {
  const letterState = useMemo(() => {
    const priority: Record<string, number> = { "-": 1, "~": 2, "#": 3 };
    const result: Record<string, string> = {};
    guesses.forEach((guess) => {
      const states = guess.pattern.split(" ");
      guess.word.split("").forEach((letter, index) => {
        if ((priority[states[index]] ?? 0) >= (priority[result[letter]] ?? 0)) result[letter] = states[index];
      });
    });
    return result;
  }, [guesses]);

  return (
    <div className="mt-4 space-y-1.5">
      {KEYBOARD_ROWS.map((row) => (
        <div key={row} className="flex justify-center gap-1">
          {row.split("").map((letter) => (
            <button key={letter} type="button" onClick={() => onKey(letter)} className={`cursor-target h-9 min-w-0 flex-1 rounded-md border px-1 font-mono text-[11px] font-bold transition-colors sm:h-10 sm:max-w-8 ${letterState[letter] ? CELL_STYLES[letterState[letter]] : "border-border bg-surface-2 text-white/65 hover:border-brand-400/40"}`}>
              {letter}
            </button>
          ))}
        </div>
      ))}
      <div className="flex justify-center gap-1">
        <button type="button" onClick={() => onKey("BACKSPACE")} className="cursor-target rounded-md border border-border bg-surface-2 px-3 py-2 text-[10px] font-bold text-white/60">Delete</button>
        <button type="button" onClick={() => onKey("ENTER")} className="cursor-target rounded-md border border-brand-400/30 bg-brand-500/15 px-5 py-2 text-[10px] font-bold text-brand-200">Enter</button>
      </div>
    </div>
  );
}

interface DuelRoomProps {
  room: WordleDuel;
  userId: string;
  spectatorCount: number;
  balance: number;
  busy: boolean;
  error: string;
  onBack: () => void;
  onJoin: () => void;
  onCancel: () => void;
  onGuess: (guess: string) => Promise<void>;
}

function DuelRoom({ room, userId, spectatorCount, balance, busy, error, onBack, onJoin, onCancel, onGuess }: DuelRoomProps) {
  const [guess, setGuess] = useState("");
  const isHost = room.hostId === userId;
  const isGuest = room.guestId === userId;
  const isPlayer = isHost || isGuest;
  const myGuesses = isHost ? room.hostGuesses : room.guestGuesses;
  const outOfGuesses = isPlayer && myGuesses.length >= 6;
  const wager = room.bet ?? 0;
  const canJoin = room.status === "waiting" && !isHost && (!room.invitedId || room.invitedId === userId);
  const canAfford = balance >= wager;

  async function submit(event?: FormEvent) {
    event?.preventDefault();
    if (guess.length !== 5 || busy) return;
    await onGuess(guess);
    setGuess("");
  }

  function handleKey(key: string) {
    if (key === "ENTER") void submit();
    else if (key === "BACKSPACE") setGuess((current) => current.slice(0, -1));
    else setGuess((current) => `${current}${key}`.slice(0, 5));
  }

  const resultLabel = room.status === "finished" ? (room.winnerId ? `${room.winnerName} wins the duel!` : "Draw—neither player cracked it.") : null;

  return (
    <section className="overflow-hidden rounded-3xl border border-border bg-surface">
      <header className="flex flex-wrap items-center justify-between gap-3 border-b border-border bg-surface-2/60 px-4 py-3 sm:px-6">
        <button type="button" onClick={onBack} className="cursor-target flex items-center gap-1.5 text-xs font-semibold text-white/45 hover:text-white"><ArrowLeft size={14}/> Arena</button>
        <div className="flex items-center gap-3 text-[11px] text-white/40">
          <span className={`flex items-center gap-1 ${wager > 0 ? "text-amber-300" : ""}`}><Coins size={13}/>{wager > 0 ? `${wager * 2} pot` : "Friendly"}</span>
          <span className="flex items-center gap-1"><Eye size={13}/>{spectatorCount} watching</span>
          <span className={`flex items-center gap-1 ${room.status === "active" ? "text-emerald-300" : ""}`}><Radio size={12}/>{room.status}</span>
        </div>
      </header>

      {resultLabel && <div className="border-b border-brand-400/20 bg-gradient-to-r from-brand-500/10 via-accent-500/10 to-brand-500/10 px-5 py-4 text-center"><Trophy size={20} className="mx-auto text-amber-300"/><p className="mt-1 font-mono text-sm font-bold text-white">{resultLabel}</p><p className="mt-1 text-xs text-white/45">The word was <strong className="tracking-[.18em] text-brand-200">{room.answer}</strong>{wager > 0 && <span className="ml-2 text-amber-300">· {room.winnerId ? `${wager * 2} credit prize` : `${wager} credits refunded each`}</span>}</p></div>}
      {!isPlayer && room.status === "active" && <div className="border-b border-border bg-brand-500/[.06] px-5 py-2 text-center text-[11px] font-semibold text-brand-200"><Eye size={12} className="mr-1 inline"/>Spectator mode—both boards update live</div>}

      <div className="grid gap-8 p-4 sm:p-6 lg:grid-cols-2 lg:gap-12">
        <div>
          <div className="mb-4 flex items-center justify-between gap-3"><div className="flex min-w-0 items-center gap-2.5"><Avatar name={room.hostName} photoUrl={room.hostPhotoUrl}/><div className="min-w-0"><p className="truncate text-sm font-bold text-white">{room.hostName}</p><p className="text-[10px] font-semibold uppercase tracking-wider text-brand-300">Host {isHost && "· You"}</p></div></div><span className="rounded-full border border-border px-2 py-1 text-[10px] text-white/35">{room.hostGuesses.length}/6</span></div>
          <WordleBoard guesses={room.hostGuesses} revealLetters={!isGuest || room.status === "finished"}/>
        </div>
        <div>
          <div className="mb-4 flex min-h-10 items-center justify-between gap-3">
            {room.guestId ? <div className="flex min-w-0 items-center gap-2.5"><Avatar name={room.guestName} photoUrl={room.guestPhotoUrl}/><div className="min-w-0"><p className="truncate text-sm font-bold text-white">{room.guestName}</p><p className="text-[10px] font-semibold uppercase tracking-wider text-accent-400">Challenger {isGuest && "· You"}</p></div></div> : <div><p className="text-sm font-bold text-white/55">Waiting for challenger</p><p className="text-[10px] text-white/30">{room.invitedName ? `Invited: ${room.invitedName}` : "Open to everyone"}</p></div>}
            {room.guestId && <span className="rounded-full border border-border px-2 py-1 text-[10px] text-white/35">{room.guestGuesses.length}/6</span>}
          </div>
          <WordleBoard guesses={room.guestGuesses} revealLetters={!isHost || room.status === "finished"} emptyLabel={!room.guestId ? "Waiting…" : undefined}/>
        </div>
      </div>

      {room.status === "waiting" && <div className="border-t border-border p-4 text-center sm:p-5">{canJoin && <><Button onClick={onJoin} disabled={busy || !canAfford}><Swords size={15}/>{busy ? "Joining…" : !canAfford ? `Need ${wager} credits` : wager > 0 ? `Join for ${wager} credits` : "Join duel"}</Button>{wager > 0 && <p className="mt-2 text-[10px] text-white/35">Both stakes are held until the duel ends.</p>}</>}{isHost && <Button variant="ghost" onClick={onCancel} disabled={busy}><X size={15}/>Cancel challenge{wager > 0 ? " & refund" : ""}</Button>}{!canJoin && !isHost && <p className="text-xs text-white/35">This challenge is reserved for {room.invitedName || "another player"}. You can still spectate.</p>}</div>}
      {room.status === "active" && isPlayer && <div className="border-t border-border bg-surface-2/25 p-4 sm:p-6">{outOfGuesses ? <p className="text-center text-sm text-white/45">You’re out of guesses. The other player can still finish.</p> : <div className="mx-auto max-w-md"><form onSubmit={submit} className="flex gap-2"><input value={guess} onChange={(event) => setGuess(event.target.value.toUpperCase().replace(/[^A-Z]/g, "").slice(0, 5))} maxLength={5} autoComplete="off" aria-label="Five-letter guess" placeholder="TYPE WORD" className="min-w-0 flex-1 rounded-xl border border-border bg-surface px-4 py-3 text-center font-mono font-black uppercase tracking-[.28em] text-white placeholder:tracking-[.15em] placeholder:text-white/20"/><Button type="submit" disabled={busy || guess.length !== 5}>{busy ? "Checking…" : "Guess"}</Button></form><Keyboard guesses={myGuesses} onKey={handleKey}/></div>}</div>}
      {error && <p className="border-t border-red-500/20 bg-red-500/[.06] px-5 py-3 text-center text-xs text-red-300">{error}</p>}
    </section>
  );
}

export default function Fun() {
  const { user } = useAuth();
  const now = useNow(10_000);
  const [tab, setTab] = useState<"arena" | "chess" | "property" | "liars" | "lanyard">(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.has("chess")) return "chess";
    if (params.has("property")) return "property";
    if (params.has("liars")) return "liars";
    return "arena";
  });
  const [profiles, setProfiles] = useState<UserProfile[]>([]);
  const [rooms, setRooms] = useState<WordleDuel[]>([]);
  const [selectedRoomId, setSelectedRoomId] = useState<string | null>(() => new URLSearchParams(window.location.search).get("duel"));
  const [inviteeId, setInviteeId] = useState("");
  const [bet, setBet] = useState(0);
  const [balance, setBalance] = useState(0);
  const [spectators, setSpectators] = useState<WordleSpectator[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => subscribeToAllProfiles(setProfiles), []);
  useEffect(() => subscribeToWordleDuels(setRooms), []);
  useEffect(() => {
    if (!user) return;
    void ensureWallet(user.uid);
    return subscribeToBalance(user.uid, setBalance);
  }, [user]);

  const selectedRoom = rooms.find((room) => room.id === selectedRoomId) ?? null;
  const myProfile = profiles.find((profile) => profile.id === user?.uid);
  const availablePlayers = profiles.filter((profile) => profile.id !== user?.uid && !profile.banned).sort((a, b) => Number(isOnline(b)) - Number(isOnline(a)) || a.displayName.localeCompare(b.displayName));

  useEffect(() => {
    if (!selectedRoomId || !user) {
      setSpectators([]);
      return;
    }
    const unsubscribe = subscribeToWordleSpectators(selectedRoomId, setSpectators);
    const leave = enterWordleSpectatorRoom(selectedRoomId, user.uid, myProfile?.displayName ?? user.displayName ?? "Player", myProfile?.photoUrl ?? user.photoURL ?? "");
    return () => { unsubscribe(); leave(); };
  }, [selectedRoomId, user, myProfile?.displayName, myProfile?.photoUrl]);

  useEffect(() => {
    if (!user) return;
    rooms.forEach((room) => {
      const isHost = room.hostId === user.uid;
      const isGuest = room.guestId === user.uid;
      const unclaimed = (isHost && !room.hostPayoutClaimed) || (isGuest && !room.guestPayoutClaimed);
      const shouldClaim = (room.bet ?? 0) > 0 && unclaimed && (
        (room.status === "cancelled" && isHost)
        || (room.status === "finished" && (!room.winnerId || room.winnerId === user.uid))
      );
      if (shouldClaim) void claimWordleDuelPayout(room.id, user.uid).catch((cause) => console.error("Could not claim Wordle payout:", cause));
    });
  }, [rooms, user]);

  const visibleRooms = rooms.filter((room) => room.status !== "cancelled" && (room.status !== "finished" || now - room.finishedAt < 6 * 60 * 60 * 1000));
  const liveRooms = visibleRooms.filter((room) => room.status === "active").length;
  const waitingRooms = visibleRooms.filter((room) => room.status === "waiting").length;
  const spectatorCount = selectedRoom ? spectators.filter((spectator) => spectator.id !== selectedRoom.hostId && spectator.id !== selectedRoom.guestId && now - spectator.lastSeenAt < 60_000).length : 0;

  async function createRoom() {
    if (!user) return;
    setBusy(true);
    setError("");
    try {
      const invitee = profiles.find((profile) => profile.id === inviteeId);
      const ref = await createWordleDuel(user.uid, myProfile?.displayName ?? user.displayName ?? "Player", myProfile?.photoUrl ?? user.photoURL ?? "", invitee ? { id: invitee.id, name: invitee.displayName } : null, bet);
      if (invitee) {
        void createNotification({
          recipientId: invitee.id,
          type: "game",
          title: "Wordle duel challenge",
          message: `${myProfile?.displayName ?? user.displayName ?? "A player"} challenged you to a live Wordle duel.`,
          link: `/fun?duel=${ref.id}`,
        }).catch((cause) => console.error("Could not send Wordle challenge notification:", cause));
      }
      setSelectedRoomId(ref.id);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not create the duel.");
    } finally {
      setBusy(false);
    }
  }

  async function runAction(action: () => Promise<void>) {
    setBusy(true);
    setError("");
    try { await action(); }
    catch (cause) { setError(cause instanceof Error ? cause.message : "That action did not work."); }
    finally { setBusy(false); }
  }

  return (
    <div className={`mx-auto px-4 py-8 transition-[max-width] sm:px-6 sm:py-10 ${tab === "chess" || tab === "property" || tab === "liars" ? "max-w-[100rem]" : "max-w-6xl"}`}>
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
        <div><div className="flex items-center gap-2"><Gamepad2 size={22} className="text-brand-300"/><h1 className="text-3xl font-black text-white">Fun zone</h1></div><p className="mt-2 text-sm text-white/45">Word games, chess, bluffing, and multiplayer property trading.</p></div>
        <div className="flex flex-wrap rounded-xl border border-border bg-surface p-1"><button type="button" onClick={() => setTab("arena")} className={`cursor-target rounded-lg px-3 py-2 text-xs font-bold transition-colors sm:px-4 ${tab === "arena" ? "bg-brand-500 text-white" : "text-white/45 hover:text-white"}`}><Swords size={14} className="mr-1.5 inline"/>Wordle</button><button type="button" onClick={() => setTab("chess")} className={`cursor-target rounded-lg px-3 py-2 text-xs font-bold transition-colors sm:px-4 ${tab === "chess" ? "bg-amber-500 text-white" : "text-white/45 hover:text-white"}`}><Crown size={14} className="mr-1.5 inline"/>Chess</button><button type="button" onClick={() => setTab("property")} className={`cursor-target rounded-lg px-3 py-2 text-xs font-bold transition-colors sm:px-4 ${tab === "property" ? "bg-emerald-600 text-white" : "text-white/45 hover:text-white"}`}><Building2 size={14} className="mr-1.5 inline"/>Campus Capital</button><button type="button" onClick={() => setTab("liars")} className={`cursor-target rounded-lg px-3 py-2 text-xs font-bold transition-colors sm:px-4 ${tab === "liars" ? "bg-orange-700 text-white" : "text-white/45 hover:text-white"}`}><ShieldQuestion size={14} className="mr-1.5 inline"/>Liar&apos;s Table</button><button type="button" onClick={() => setTab("lanyard")} className={`cursor-target rounded-lg px-3 py-2 text-xs font-bold transition-colors sm:px-4 ${tab === "lanyard" ? "bg-brand-500 text-white" : "text-white/45 hover:text-white"}`}><Sparkles size={14} className="mr-1.5 inline"/>Lanyard</button></div>
      </div>

      {tab === "lanyard" ? <div className="mt-6 overflow-hidden rounded-2xl border border-border bg-surface-2/40"><Lanyard frontImage={user?.photoURL ?? null} backImage={user?.photoURL ?? null}/></div> : tab === "liars" ? <LiarsTable/> : tab === "property" ? <PropertyArena/> : tab === "chess" ? <div className="mt-7"><ChessArena/></div> : selectedRoom ? (
        <div className="mt-7"><DuelRoom room={selectedRoom} userId={user?.uid ?? ""} spectatorCount={spectatorCount} balance={balance} busy={busy} error={error} onBack={() => { setSelectedRoomId(null); setError(""); }} onJoin={() => runAction(() => joinWordleDuel(selectedRoom.id, user!.uid, myProfile?.displayName ?? user?.displayName ?? "Player", myProfile?.photoUrl ?? user?.photoURL ?? ""))} onCancel={() => runAction(() => cancelWordleDuel(selectedRoom.id, user!.uid))} onGuess={(word) => runAction(() => submitWordleDuelGuess(selectedRoom.id, user!.uid, word))}/></div>
      ) : (
        <div className="mt-7 grid gap-6 lg:grid-cols-[.72fr_1.28fr]">
          <div className="space-y-5">
            <section className="rounded-2xl border border-border bg-surface p-5">
              <div className="flex items-center gap-3"><span className="grid h-10 w-10 place-items-center rounded-xl bg-brand-500/15 text-brand-300"><Swords size={19}/></span><div><h2 className="text-sm font-bold text-white">Start a duel</h2><p className="text-[11px] text-white/35">First player to solve the shared word wins.</p></div></div>
              <label className="mt-5 block text-[11px] font-bold uppercase tracking-wider text-white/35">Opponent</label>
              <select value={inviteeId} onChange={(event) => setInviteeId(event.target.value)} className="mt-2 w-full rounded-xl border border-border bg-surface-2 px-3 py-3 text-sm text-white"><option value="">Open challenge—anyone can join</option>{availablePlayers.map((player) => <option key={player.id} value={player.id}>{isOnline(player) ? "● " : "○ "}{player.displayName}</option>)}</select>
              <div className="mt-4 flex items-center justify-between"><label className="text-[11px] font-bold uppercase tracking-wider text-white/35">Credit stake</label><span className="flex items-center gap-1 text-[11px] text-amber-300"><Coins size={12}/>{balance} available</span></div>
              <div className="mt-2 grid grid-cols-6 gap-1.5">{[0, 5, 10, 25, 50, 100].map((amount) => <button key={amount} type="button" onClick={() => setBet(amount)} disabled={amount > balance} className={`cursor-target rounded-lg border px-1 py-2 text-[10px] font-bold transition-colors disabled:cursor-not-allowed disabled:opacity-30 ${bet === amount ? "border-amber-400/50 bg-amber-400/15 text-amber-200" : "border-border bg-surface-2 text-white/45 hover:text-white"}`}>{amount === 0 ? "Free" : amount}</button>)}</div>
              {bet > 0 && <p className="mt-2 text-[10px] text-white/35">You stake {bet}; your opponent matches it. Winner receives {bet * 2} credits.</p>}
              <Button onClick={createRoom} disabled={busy || bet > balance} className="mt-3 w-full"><UserPlus size={15}/>{busy ? "Creating…" : `${inviteeId ? "Send challenge" : "Create open room"}${bet > 0 ? ` · ${bet} credits` : ""}`}</Button>
              {error && <p className="mt-3 text-xs text-red-300">{error}</p>}
            </section>
            <section className="rounded-2xl border border-border bg-surface p-5"><h3 className="text-xs font-bold uppercase tracking-wider text-white/45">How it works</h3><ul className="mt-3 space-y-2 text-xs leading-relaxed text-white/45"><li><strong className="text-emerald-300">Green</strong> means the right letter and spot.</li><li><strong className="text-amber-300">Gold</strong> means the right letter, wrong spot.</li><li>Both players get six guesses and play simultaneously.</li><li>Opponent letters stay hidden while playing; spectators see both boards.</li></ul></section>
          </div>
          <section className="rounded-2xl border border-border bg-surface p-5 sm:p-6">
            <div className="flex items-center justify-between gap-3"><div><h2 className="text-lg font-bold text-white">Live rooms</h2><p className="mt-0.5 text-xs text-white/35">Join a challenge or tap any match to spectate.</p></div><div className="flex gap-2"><span className="rounded-full border border-emerald-400/20 bg-emerald-400/[.07] px-2.5 py-1 text-[10px] text-emerald-300">{liveRooms} live</span><span className="rounded-full border border-border px-2.5 py-1 text-[10px] text-white/40">{waitingRooms} waiting</span></div></div>
            <div className="mt-5 space-y-3">
              {visibleRooms.length === 0 && <div className="rounded-xl border border-dashed border-border py-14 text-center"><Users size={24} className="mx-auto text-white/20"/><p className="mt-3 text-sm text-white/35">No rooms yet. Start the first duel.</p></div>}
              {visibleRooms.map((room) => {
                const mine = room.hostId === user?.uid || room.guestId === user?.uid;
                const invited = room.invitedId === user?.uid && room.status === "waiting";
                const roomBet = room.bet ?? 0;
                return <button key={room.id} type="button" onClick={() => { setSelectedRoomId(room.id); setError(""); }} className={`cursor-target group flex w-full items-center gap-3 rounded-xl border p-3.5 text-left transition-all hover:-translate-y-0.5 hover:border-brand-400/35 hover:bg-brand-500/[.04] ${invited ? "border-brand-400/40 bg-brand-500/[.07]" : "border-border bg-surface-2/55"}`}><div className="flex -space-x-2"><Avatar size="sm" name={room.hostName} photoUrl={room.hostPhotoUrl}/>{room.guestId ? <Avatar size="sm" name={room.guestName} photoUrl={room.guestPhotoUrl}/> : <span className="grid h-7 w-7 place-items-center rounded-lg border border-dashed border-white/15 bg-surface text-[10px] text-white/25">?</span>}</div><div className="min-w-0 flex-1"><p className="truncate text-xs font-bold text-white">{room.hostName} <span className="text-white/25">vs</span> {room.guestName || room.invitedName || "Anyone"}</p><p className="mt-0.5 flex items-center gap-2 text-[10px] text-white/30"><Clock3 size={10}/>{formatAge(room.createdAt, now)}{mine && <span className="text-brand-300">Your room</span>}{invited && <span className="text-amber-300">You’re challenged!</span>}{roomBet > 0 && <span className="flex items-center gap-0.5 text-amber-300"><Coins size={9}/>{roomBet * 2} pot</span>}</p></div><span className={`rounded-full px-2 py-1 text-[9px] font-bold uppercase tracking-wider ${room.status === "active" ? "bg-emerald-400/10 text-emerald-300" : room.status === "waiting" ? "bg-amber-400/10 text-amber-300" : "bg-white/[.05] text-white/35"}`}>{room.status}</span><Eye size={15} className="text-white/20 transition-colors group-hover:text-brand-300"/></button>;
              })}
            </div>
          </section>
        </div>
      )}
    </div>
  );
}
