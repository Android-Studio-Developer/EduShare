import { useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import { Chess, type Color, type PieceSymbol, type Square } from "chess.js";
import { ArrowLeft, CircleSlash, Clock3, Coins, Crown, Eye, Flag, MessageCircle, Radio, Send, Swords, Trophy, UserPlus, Users, X } from "lucide-react";
import { useAuth } from "../context/AuthContext";
import { useNow } from "../hooks/useNow";
import {
  cancelChessDuel,
  claimChessPayout,
  createChessDuel,
  enterChessSpectatorRoom,
  expireChessClock,
  joinChessDuel,
  moveChessPiece,
  resignChessDuel,
  sendChessMessage,
  subscribeToChessDuels,
  subscribeToChessMessages,
  subscribeToChessSpectators,
  voidChessDuel,
} from "../lib/chessDuels";
import { createNotification } from "../lib/notifications";
import { isOnline, subscribeToAllProfiles } from "../lib/profiles";
import { ensureWallet, subscribeToBalance } from "../lib/shop";
import type { ChessDuel, ChessRoomMessage, ChessTimeControl, UserProfile, WordleSpectator } from "../types";
import kingWhite from "../assets/icons/king-w.svg";
import kingBlack from "../assets/icons/king-b.svg";
import queenWhite from "../assets/icons/queen-w.svg";
import queenBlack from "../assets/icons/queen-b.svg";
import rookWhite from "../assets/icons/rook-w.svg";
import rookBlack from "../assets/icons/rook-b.svg";
import bishopWhite from "../assets/icons/bishop-w.svg";
import bishopBlack from "../assets/icons/bishop-b.svg";
import knightWhite from "../assets/icons/knight-w.svg";
import knightBlack from "../assets/icons/knight-b.svg";
import pawnWhite from "../assets/icons/pawn-w.svg";
import pawnBlack from "../assets/icons/pawn-b.svg";
import Button from "./Button";

interface ChessPremove {
  from: string;
  to: string;
  promotion: "q" | "r" | "b" | "n";
}

const TIME_CONTROL_LABEL: Record<ChessTimeControl, string> = {
  blitz_5_3: "5 | 3 Blitz",
  rapid_10: "10 min Rapid",
};

function clockRemaining(room: ChessDuel, color: Color, now: number) {
  const stored = color === "w" ? room.whiteTimeMs : room.blackTimeMs;
  if (typeof stored !== "number") return null;
  if (room.status !== "active" || room.turn !== color || !room.turnStartedAt) return stored;
  return Math.max(0, stored - Math.max(0, now - room.turnStartedAt));
}

function clockLabel(milliseconds: number | null) {
  if (milliseconds === null) return "—";
  const seconds = Math.max(0, milliseconds) / 1000;
  const minutes = Math.floor(seconds / 60);
  const remainder = seconds - minutes * 60;
  return seconds < 20 ? `${minutes}:${remainder.toFixed(1).padStart(4, "0")}` : `${minutes}:${Math.floor(remainder).toString().padStart(2, "0")}`;
}

const PIECES: Record<Color, Record<PieceSymbol, string>> = {
  w: { k: kingWhite, q: queenWhite, r: rookWhite, b: bishopWhite, n: knightWhite, p: pawnWhite },
  b: { k: kingBlack, q: queenBlack, r: rookBlack, b: bishopBlack, n: knightBlack, p: pawnBlack },
};

function Avatar({ name, photoUrl }: { name: string; photoUrl: string }) {
  return photoUrl ? <img src={photoUrl} alt="" className="h-9 w-9 rounded-xl object-cover" /> : (
    <span className="grid h-9 w-9 place-items-center rounded-xl bg-gradient-to-br from-amber-400 to-orange-600 font-mono text-xs font-black text-white">{(name[0] ?? "P").toUpperCase()}</span>
  );
}

function age(timestamp: number, now: number) {
  const minutes = Math.max(0, Math.floor((now - timestamp) / 60_000));
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes}m ago`;
  return `${Math.floor(minutes / 60)}h ago`;
}

function ChessBoard({ room, userId, busy, promotion, premoveEnabled, premove, onMove, onQueuePremove, onCancelPremove }: { room: ChessDuel; userId: string; busy: boolean; promotion: "q" | "r" | "b" | "n"; premoveEnabled: boolean; premove: ChessPremove | null; onMove: (from: string, to: string, promotion: "q" | "r" | "b" | "n") => Promise<void>; onQueuePremove: (move: ChessPremove) => void; onCancelPremove: () => void }) {
  const game = useMemo(() => new Chess(room.fen), [room.fen]);
  const [selected, setSelected] = useState<string | null>(null);
  const isWhite = room.whiteId === userId;
  const isBlack = room.blackId === userId;
  const myColor: Color | null = isWhite ? "w" : isBlack ? "b" : null;
  const orientation: Color = isBlack ? "b" : "w";
  const ranks = orientation === "w" ? [8, 7, 6, 5, 4, 3, 2, 1] : [1, 2, 3, 4, 5, 6, 7, 8];
  const files = orientation === "w" ? ["a", "b", "c", "d", "e", "f", "g", "h"] : ["h", "g", "f", "e", "d", "c", "b", "a"];
  const legalTargets = useMemo(() => selected && room.turn === myColor ? game.moves({ square: selected as Square, verbose: true }).map((move) => move.to) : [], [game, myColor, room.turn, selected]);
  const lastMove = room.moves.at(-1);

  useEffect(() => setSelected(null), [room.fen]);

  async function clickSquare(square: string) {
    if (!myColor || room.status !== "active" || busy) return;
    const piece = game.get(square as Square);
    if (room.turn !== myColor) {
      if (!premoveEnabled) return;
      if (!selected) {
        if (premove && (premove.from === square || premove.to === square)) onCancelPremove();
        if (piece?.color === myColor) setSelected(square);
        return;
      }
      if (piece?.color === myColor) {
        setSelected(square);
        return;
      }
      onQueuePremove({ from: selected, to: square, promotion });
      setSelected(null);
      return;
    }
    if (selected && legalTargets.includes(square as Square)) {
      const from = selected;
      setSelected(null);
      await onMove(from, square, promotion);
      return;
    }
    setSelected(piece?.color === myColor ? square : null);
  }

  return (
    <div className="aspect-square w-full overflow-hidden rounded-2xl border-4 border-amber-950/50 bg-amber-950 shadow-[0_28px_80px_-30px_rgba(245,158,11,.45)]">
      <div className="grid h-full grid-cols-8 grid-rows-8">
        {ranks.flatMap((rank) => files.map((file) => {
          const square = `${file}${rank}`;
          const piece = game.get(square as Square);
          const fileNumber = file.charCodeAt(0) - 97;
          const dark = (fileNumber + rank) % 2 === 1;
          const target = legalTargets.includes(square as Square);
          const active = selected === square;
          const recent = lastMove?.from === square || lastMove?.to === square;
          const queued = premove?.from === square || premove?.to === square;
          const checkedKing = room.check && piece?.type === "k" && piece.color === room.turn;
          return (
            <button
              key={square}
              type="button"
              onClick={() => void clickSquare(square)}
              aria-label={`${square}${piece ? ` ${piece.color === "w" ? "white" : "black"} ${piece.type}` : ""}`}
              className={`cursor-target relative grid min-h-0 min-w-0 place-items-center transition-colors ${dark ? "bg-amber-700" : "bg-amber-100"} ${recent ? "after:absolute after:inset-0 after:bg-yellow-300/35" : ""} ${active ? `ring-4 ring-inset ${room.turn === myColor ? "ring-cyan-400" : "ring-violet-400"}` : ""} ${queued ? "ring-4 ring-inset ring-violet-500 after:absolute after:inset-0 after:bg-violet-400/25" : ""} ${checkedKing ? "bg-red-500" : ""}`}
            >
              {target && <span className={`absolute z-20 rounded-full bg-emerald-500/70 ${piece ? "inset-1.5 border-4 border-emerald-400/80 bg-transparent sm:inset-2.5" : "h-3 w-3 sm:h-4 sm:w-4"}`} />}
              {piece && <img src={PIECES[piece.color][piece.type]} alt="" draggable={false} className="relative z-10 h-[88%] w-[88%] select-none object-contain drop-shadow-[0_3px_2px_rgba(0,0,0,.28)]"/>}
              <span className={`absolute bottom-0.5 left-1 z-30 font-mono text-[8px] font-bold sm:text-[10px] ${dark ? "text-amber-100/55" : "text-amber-950/45"}`}>{file === files[0] ? rank : ""}</span>
              <span className={`absolute bottom-0.5 right-1 z-30 font-mono text-[8px] font-bold sm:text-[10px] ${dark ? "text-amber-100/55" : "text-amber-950/45"}`}>{rank === ranks.at(-1) ? file : ""}</span>
            </button>
          );
        }))}
      </div>
    </div>
  );
}

function MatchChat({ roomId, userId, displayName, photoUrl }: { roomId: string; userId: string; displayName: string; photoUrl: string }) {
  const [messages, setMessages] = useState<ChessRoomMessage[]>([]);
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");
  const listRef = useRef<HTMLDivElement>(null);

  useEffect(() => subscribeToChessMessages(roomId, setMessages), [roomId]);
  useEffect(() => {
    const list = listRef.current;
    if (list) list.scrollTo({ top: list.scrollHeight, behavior: "smooth" });
  }, [messages.length]);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!text.trim() || sending) return;
    setSending(true);
    setError("");
    try {
      await sendChessMessage(roomId, userId, displayName, photoUrl, text);
      setText("");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not send that message.");
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="overflow-hidden rounded-2xl border border-border bg-surface-2/45">
      <div className="flex items-center justify-between border-b border-border px-4 py-3">
        <h3 className="flex items-center gap-2 font-mono text-xs font-bold uppercase tracking-wider text-white/55"><MessageCircle size={14}/>Match chat</h3>
        <span className="text-[9px] font-bold uppercase tracking-wider text-white/25">Players + spectators</span>
      </div>
      <div ref={listRef} className="h-56 space-y-3 overflow-y-auto px-3 py-3" aria-live="polite">
        {messages.length === 0 && <div className="grid h-full place-items-center text-center"><div><MessageCircle size={20} className="mx-auto text-white/15"/><p className="mt-2 text-[11px] text-white/30">Start the match conversation.</p></div></div>}
        {messages.map((message) => {
          const mine = message.authorId === userId;
          return (
            <div key={message.id} className={`flex items-start gap-2 ${mine ? "flex-row-reverse" : ""}`}>
              {message.authorPhotoUrl ? <img src={message.authorPhotoUrl} alt="" className="h-7 w-7 shrink-0 rounded-lg object-cover"/> : <span className="grid h-7 w-7 shrink-0 place-items-center rounded-lg bg-white/[.07] text-[9px] font-black text-white/55">{(message.authorName[0] ?? "P").toUpperCase()}</span>}
              <div className={`min-w-0 max-w-[78%] ${mine ? "text-right" : ""}`}>
                <p className="mb-1 truncate text-[9px] font-bold text-white/35">{mine ? "You" : message.authorName}</p>
                <p className={`break-words rounded-xl px-2.5 py-2 text-left text-[11px] leading-relaxed ${mine ? "rounded-tr-sm bg-brand-500 text-white" : "rounded-tl-sm border border-border bg-surface text-white/75"}`}>{message.text}</p>
              </div>
            </div>
          );
        })}
      </div>
      <form onSubmit={submit} className="border-t border-border p-3">
        <div className="flex items-center gap-2">
          <input value={text} onChange={(event) => setText(event.target.value)} maxLength={300} placeholder="Message the match…" aria-label="Match chat message" className="min-w-0 flex-1 rounded-xl border border-border bg-surface px-3 py-2.5 text-xs text-white outline-none placeholder:text-white/25 focus:border-brand-400/50"/>
          <button type="submit" disabled={sending || !text.trim()} aria-label="Send message" className="cursor-target grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-brand-500 text-white transition hover:bg-brand-400 disabled:cursor-not-allowed disabled:opacity-35"><Send size={14}/></button>
        </div>
        {error && <p className="mt-2 text-[10px] text-red-300">{error}</p>}
      </form>
    </div>
  );
}

function Match({ room, profile, balance, spectatorCount, onBack }: { room: ChessDuel; profile: UserProfile | undefined; balance: number; spectatorCount: number; onBack: () => void }) {
  const { user } = useAuth();
  const clockNow = useNow(250);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [promotion, setPromotion] = useState<"q" | "r" | "b" | "n">("q");
  const [premoveEnabled, setPremoveEnabled] = useState(() => window.localStorage.getItem("edushare:chess-premove") === "true");
  const [premove, setPremove] = useState<ChessPremove | null>(null);
  const timeoutAttemptRef = useRef("");
  const userId = user?.uid ?? "";
  const isWhite = room.whiteId === userId;
  const isBlack = room.blackId === userId;
  const isPlayer = isWhite || isBlack;
  const myColor: Color | null = isWhite ? "w" : isBlack ? "b" : null;
  const canJoin = room.status === "waiting" && !isWhite && (!room.invitedId || room.invitedId === userId);
  const canAfford = balance >= room.creditBet;
  const whiteClock = clockRemaining(room, "w", clockNow);
  const blackClock = clockRemaining(room, "b", clockNow);
  const activeClock = room.turn === "w" ? whiteClock : blackClock;

  async function act(action: () => Promise<void>) {
    setBusy(true);
    setError("");
    try { await action(); }
    catch (cause) { setError(cause instanceof Error ? cause.message : "That action did not work."); }
    finally { setBusy(false); }
  }

  useEffect(() => {
    window.localStorage.setItem("edushare:chess-premove", String(premoveEnabled));
    if (!premoveEnabled) setPremove(null);
  }, [premoveEnabled]);

  useEffect(() => setPremove(null), [room.id]);

  useEffect(() => {
    if (!premove || !myColor || busy || room.status !== "active" || room.turn !== myColor) return;
    const queued = premove;
    setPremove(null);
    setBusy(true);
    setError("");
    void moveChessPiece(room.id, userId, queued.from, queued.to, queued.promotion)
      .catch(() => setError("Your premove is no longer legal, so it was cancelled."))
      .finally(() => setBusy(false));
  }, [busy, myColor, premove, room.fen, room.id, room.status, room.turn, userId]);

  useEffect(() => {
    if (room.status !== "active" || !room.timeControl || activeClock === null || activeClock > 0) return;
    const attemptKey = `${room.id}:${room.turn}:${room.turnStartedAt}`;
    if (timeoutAttemptRef.current === attemptKey) return;
    timeoutAttemptRef.current = attemptKey;
    void expireChessClock(room.id).catch(() => { timeoutAttemptRef.current = ""; });
  }, [activeClock, room.id, room.status, room.timeControl, room.turn, room.turnStartedAt]);

  const status = room.status === "finished"
    ? room.result === "draw" ? `${room.endReason} — draw` : `${room.winnerName} wins by ${room.endReason.toLowerCase()}`
    : room.status === "active" ? `${room.turn === "w" ? room.whiteName : room.blackName} to move${room.check ? " — CHECK" : ""}`
    : room.status === "waiting" ? "Waiting for Black" : "Cancelled";

  return (
    <section className="overflow-hidden rounded-3xl border border-border bg-surface">
      <header className="flex flex-wrap items-center justify-between gap-3 border-b border-border bg-surface-2/60 px-4 py-3 sm:px-6">
        <button type="button" onClick={onBack} className="cursor-target flex items-center gap-1.5 text-xs font-semibold text-white/45 hover:text-white"><ArrowLeft size={14}/>Chess lobby</button>
        <div className="flex items-center gap-3 text-[11px] text-white/40">
          {room.timeControl && <span className="flex items-center gap-1 text-cyan-200"><Clock3 size={13}/>{TIME_CONTROL_LABEL[room.timeControl]}</span>}
          <span className={room.creditBet ? "flex items-center gap-1 text-amber-300" : "flex items-center gap-1"}><Coins size={13}/>{room.creditBet ? `${room.creditBet * 2} credit pot` : "Friendly"}</span>
          <span className="flex items-center gap-1"><Eye size={13}/>{spectatorCount} watching</span>
          <span className="flex items-center gap-1"><Radio size={12}/>{room.status}</span>
        </div>
      </header>

      <div className={`border-b px-4 py-3 text-center font-mono text-xs font-bold ${room.check && room.status === "active" ? "border-red-400/30 bg-red-500/10 text-red-200" : "border-border bg-white/[.02] text-white/65"}`}>
        {room.status === "finished" && <Trophy size={15} className="mr-1.5 inline text-amber-300"/>}{status}
        {room.status === "finished" && room.creditBet > 0 && <span className="ml-2 text-amber-300">· {room.result === "draw" ? `${room.creditBet} credits refunded each` : `${room.creditBet * 2} credit prize`}</span>}
      </div>

      <div className="grid gap-6 p-4 sm:p-6 xl:grid-cols-[minmax(0,1fr)_22rem]">
        <div className="mx-auto w-full max-w-[min(54rem,calc(100dvh-7rem))]">
          <div className="mb-3 flex items-center justify-between rounded-xl border border-border bg-surface-2/50 p-3">
            <div className="flex items-center gap-2"><Avatar name={room.blackName || room.invitedName || "Black"} photoUrl={room.blackPhotoUrl}/><div><p className="text-sm font-bold text-white">{room.blackName || room.invitedName || "Waiting…"}</p><p className="text-[10px] uppercase tracking-wider text-white/35">Black {isBlack && "· You"}</p></div></div>
            <div className="flex items-center gap-2">{blackClock !== null && <span className={`min-w-20 rounded-lg px-3 py-1.5 text-right font-mono text-lg font-black tabular-nums ${room.turn === "b" && room.status === "active" ? blackClock < 20_000 ? "bg-red-500 text-white" : "bg-white text-slate-950" : "bg-black/25 text-white/45"}`}>{clockLabel(blackClock)}</span>}{room.turn === "b" && room.status === "active" && <span className="h-2.5 w-2.5 animate-pulse rounded-full bg-emerald-400"/>}</div>
          </div>
          <ChessBoard room={room} userId={userId} busy={busy} promotion={promotion} premoveEnabled={premoveEnabled} premove={premove} onQueuePremove={setPremove} onCancelPremove={() => setPremove(null)} onMove={(from, to, piece) => act(() => moveChessPiece(room.id, userId, from, to, piece))}/>
          <div className="mt-3 flex items-center justify-between rounded-xl border border-border bg-surface-2/50 p-3">
            <div className="flex items-center gap-2"><Avatar name={room.whiteName} photoUrl={room.whitePhotoUrl}/><div><p className="text-sm font-bold text-white">{room.whiteName}</p><p className="text-[10px] uppercase tracking-wider text-white/35">White {isWhite && "· You"}</p></div></div>
            <div className="flex items-center gap-2">{whiteClock !== null && <span className={`min-w-20 rounded-lg px-3 py-1.5 text-right font-mono text-lg font-black tabular-nums ${room.turn === "w" && room.status === "active" ? whiteClock < 20_000 ? "bg-red-500 text-white" : "bg-white text-slate-950" : "bg-black/25 text-white/45"}`}>{clockLabel(whiteClock)}</span>}{room.turn === "w" && room.status === "active" && <span className="h-2.5 w-2.5 animate-pulse rounded-full bg-emerald-400"/>}</div>
          </div>
        </div>

        <aside className="space-y-4">
          <div className="rounded-2xl border border-border bg-surface-2/45 p-4">
            <div className="flex items-center justify-between"><h3 className="font-mono text-xs font-bold uppercase tracking-wider text-white/50">Moves</h3><span className="text-[10px] text-white/30">{room.moves.length} ply</span></div>
            <div className="mt-3 grid max-h-72 grid-cols-[2rem_1fr_1fr] gap-y-1 overflow-y-auto text-xs">
              {room.moves.length === 0 && <p className="col-span-3 py-8 text-center text-white/25">No moves yet.</p>}
              {Array.from({ length: Math.ceil(room.moves.length / 2) }).map((_, index) => <div className="contents" key={index}><span className="font-mono text-white/25">{index + 1}.</span><span className="font-mono text-white/70">{room.moves[index * 2]?.san}</span><span className="font-mono text-white/70">{room.moves[index * 2 + 1]?.san}</span></div>)}
            </div>
          </div>

          <MatchChat roomId={room.id} userId={userId} displayName={profile?.displayName ?? user?.displayName ?? "Player"} photoUrl={profile?.photoUrl ?? user?.photoURL ?? ""}/>

          {room.status === "active" && isPlayer && <div className="rounded-2xl border border-border bg-surface-2/45 p-4"><div className="flex items-center justify-between gap-3"><div><p className="text-xs font-bold text-white/70">Premove</p><p className="mt-0.5 text-[9px] text-white/30">Queue your reply during their turn.</p></div><button type="button" role="switch" aria-checked={premoveEnabled} onClick={() => setPremoveEnabled((current) => !current)} className={`cursor-target relative h-6 w-11 shrink-0 rounded-full border transition-colors ${premoveEnabled ? "border-violet-400/50 bg-violet-500" : "border-border bg-white/10"}`}><span className={`absolute top-0.5 h-4.5 w-4.5 rounded-full bg-white shadow transition-transform ${premoveEnabled ? "translate-x-5" : "translate-x-0.5"}`}/></button></div>{premove && <button type="button" onClick={() => setPremove(null)} className="cursor-target mt-3 flex w-full items-center justify-between rounded-lg border border-violet-400/30 bg-violet-500/10 px-3 py-2 text-[10px] text-violet-200"><span>Premove {premove.from} → {premove.to}</span><span>Cancel</span></button>}<label className="mt-4 block text-[10px] font-bold uppercase tracking-wider text-white/35">Pawn promotion</label><select value={promotion} onChange={(event) => setPromotion(event.target.value as typeof promotion)} className="mt-2 w-full rounded-lg border border-border bg-surface px-3 py-2 text-xs text-white"><option value="q">Queen</option><option value="r">Rook</option><option value="b">Bishop</option><option value="n">Knight</option></select><div className={`mt-3 grid gap-2 ${room.moves.length <= 2 ? "grid-cols-2" : "grid-cols-1"}`}><Button variant="ghost" disabled={busy} onClick={() => act(() => resignChessDuel(room.id, userId))}><Flag size={14}/>Resign</Button>{room.moves.length <= 2 && <Button variant="ghost" disabled={busy} onClick={() => { if (window.confirm("Void this early game? Both credit stakes will be refunded.")) void act(() => voidChessDuel(room.id, userId)); }}><CircleSlash size={14}/>Void game</Button>}</div>{room.creditBet > 0 && room.moves.length <= 2 && <p className="mt-2 text-center text-[9px] text-white/30">Early voids refund both players.</p>}</div>}

          {room.status === "waiting" && <div className="rounded-2xl border border-border bg-surface-2/45 p-4 text-center">{canJoin && <Button className="w-full" disabled={busy || !canAfford} onClick={() => act(() => joinChessDuel(room.id, userId, profile?.displayName ?? user?.displayName ?? "Player", profile?.photoUrl ?? user?.photoURL ?? ""))}><Swords size={14}/>{!canAfford ? `Need ${room.creditBet} credits` : room.creditBet ? `Join for ${room.creditBet} credits` : "Join match"}</Button>}{isWhite && <Button variant="ghost" className="w-full" disabled={busy} onClick={() => act(() => cancelChessDuel(room.id, userId))}><X size={14}/>Cancel{room.creditBet ? " & refund" : ""}</Button>}{!canJoin && !isWhite && <p className="text-xs text-white/35">Reserved for {room.invitedName || "another player"}. You can spectate.</p>}</div>}
          {!isPlayer && room.status === "active" && <div className="rounded-2xl border border-brand-400/20 bg-brand-500/[.06] p-4 text-center text-xs text-brand-200"><Eye size={14} className="mr-1 inline"/>Spectating live</div>}
          {error && <p className="rounded-xl border border-red-400/20 bg-red-500/10 p-3 text-xs text-red-200">{error}</p>}
        </aside>
      </div>
    </section>
  );
}

export default function ChessArena() {
  const { user } = useAuth();
  const now = useNow(10_000);
  const [profiles, setProfiles] = useState<UserProfile[]>([]);
  const [rooms, setRooms] = useState<ChessDuel[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(() => new URLSearchParams(window.location.search).get("chess"));
  const [inviteeId, setInviteeId] = useState("");
  const [creditBet, setCreditBet] = useState(0);
  const [timeControl, setTimeControl] = useState<ChessTimeControl>("blitz_5_3");
  const [balance, setBalance] = useState(0);
  const [spectators, setSpectators] = useState<WordleSpectator[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => subscribeToAllProfiles(setProfiles), []);
  useEffect(() => subscribeToChessDuels(setRooms), []);
  useEffect(() => {
    if (!user) return;
    void ensureWallet(user.uid);
    return subscribeToBalance(user.uid, setBalance);
  }, [user]);
  const profile = profiles.find((item) => item.id === user?.uid);
  const selected = rooms.find((room) => room.id === selectedId) ?? null;

  useEffect(() => {
    if (!selectedId || !user) { setSpectators([]); return; }
    const unsubscribe = subscribeToChessSpectators(selectedId, setSpectators);
    const leave = enterChessSpectatorRoom(selectedId, user.uid, profile?.displayName ?? user.displayName ?? "Player", profile?.photoUrl ?? user.photoURL ?? "");
    return () => { unsubscribe(); leave(); };
  }, [selectedId, user, profile?.displayName, profile?.photoUrl]);

  useEffect(() => {
    if (!user) return;
    rooms.forEach((room) => {
      const isWhite = room.whiteId === user.uid;
      const isBlack = room.blackId === user.uid;
      const unclaimed = (isWhite && !room.whitePayoutClaimed) || (isBlack && !room.blackPayoutClaimed);
      const won = (isWhite && room.result === "white") || (isBlack && room.result === "black");
      const shouldClaim = room.creditBet > 0 && unclaimed && ((room.status === "cancelled" && isWhite) || (room.status === "finished" && (won || room.result === "draw")));
      if (shouldClaim) void claimChessPayout(room.id, user.uid).catch((cause) => console.error("Could not claim chess payout:", cause));
    });
  }, [rooms, user]);

  const availablePlayers = profiles.filter((item) => item.id !== user?.uid && !item.banned).sort((a, b) => Number(isOnline(b)) - Number(isOnline(a)) || a.displayName.localeCompare(b.displayName));
  const visible = rooms.filter((room) => room.status === "waiting" || room.status === "active");
  const spectatorCount = selected ? spectators.filter((item) => item.id !== selected.whiteId && item.id !== selected.blackId && now - item.lastSeenAt < 60_000).length : 0;

  async function createRoom() {
    if (!user) return;
    setBusy(true);
    setError("");
    try {
      const invitee = profiles.find((item) => item.id === inviteeId);
      const ref = await createChessDuel(user.uid, profile?.displayName ?? user.displayName ?? "Player", profile?.photoUrl ?? user.photoURL ?? "", invitee ? { id: invitee.id, name: invitee.displayName } : null, creditBet, timeControl);
      if (invitee) void createNotification({ recipientId: invitee.id, type: "game", title: "Live chess challenge", message: `${profile?.displayName ?? user.displayName ?? "A player"} challenged you to ${TIME_CONTROL_LABEL[timeControl]} chess${creditBet ? ` for ${creditBet} credits` : ""}.`, link: `/fun?chess=${ref.id}` }).catch((cause) => console.error("Could not send chess challenge notification:", cause));
      setSelectedId(ref.id);
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Could not create the chess room."); }
    finally { setBusy(false); }
  }

  if (selected) return <Match room={selected} profile={profile} balance={balance} spectatorCount={spectatorCount} onBack={() => { setSelectedId(null); setError(""); }}/>;

  return (
    <div className="grid gap-6 lg:grid-cols-[.72fr_1.28fr]">
      <div className="space-y-5">
        <section className="rounded-2xl border border-border bg-surface p-5">
          <div className="flex items-center gap-3"><span className="grid h-10 w-10 place-items-center rounded-xl bg-amber-500/15 text-amber-300"><Crown size={19}/></span><div><h2 className="text-sm font-bold text-white">Start a chess match</h2><p className="text-[11px] text-white/35">You play White. Challenge someone or open the table.</p></div></div>
          <label className="mt-5 block text-[11px] font-bold uppercase tracking-wider text-white/35">Opponent</label>
          <select value={inviteeId} onChange={(event) => setInviteeId(event.target.value)} className="mt-2 w-full rounded-xl border border-border bg-surface-2 px-3 py-3 text-sm text-white"><option value="">Open match—anyone can join</option>{availablePlayers.map((item) => <option key={item.id} value={item.id}>{isOnline(item) ? "● " : "○ "}{item.displayName}</option>)}</select>
          <label className="mt-4 block text-[11px] font-bold uppercase tracking-wider text-white/35">Time control</label>
          <div className="mt-2 grid grid-cols-2 gap-2">{(["blitz_5_3", "rapid_10"] as ChessTimeControl[]).map((control) => <button key={control} type="button" onClick={() => setTimeControl(control)} className={`cursor-target rounded-xl border p-3 text-left transition-colors ${timeControl === control ? "border-cyan-400/45 bg-cyan-400/10 text-cyan-100" : "border-border bg-surface-2 text-white/45"}`}><span className="block font-mono text-sm font-black">{control === "blitz_5_3" ? "5 | 3" : "10 min"}</span><span className="mt-0.5 block text-[9px] uppercase tracking-wider">{control === "blitz_5_3" ? "Blitz · +3 sec" : "Rapid · no increment"}</span></button>)}</div>
          <div className="mt-4 flex items-center justify-between"><label className="text-[11px] font-bold uppercase tracking-wider text-white/35">Credit stake</label><span className="flex items-center gap-1 text-[11px] text-amber-300"><Coins size={12}/>{balance} credits</span></div>
          <div className="mt-2 grid grid-cols-5 gap-1.5">{[0, 10, 25, 50, 100].map((amount) => <button key={amount} type="button" disabled={amount > balance} onClick={() => setCreditBet(amount)} className={`cursor-target rounded-lg border px-1 py-2 text-[10px] font-bold disabled:cursor-not-allowed disabled:opacity-30 ${creditBet === amount ? "border-amber-400/50 bg-amber-400/15 text-amber-200" : "border-border bg-surface-2 text-white/45"}`}>{amount || "Free"}</button>)}</div>
          {creditBet > 0 && <p className="mt-2 text-[10px] text-white/35">Both players stake {creditBet} credits. Winner receives the {creditBet * 2} credit pot; draws and voids refund both.</p>}
          <Button onClick={() => void createRoom()} disabled={busy || creditBet > balance} className="mt-3 w-full"><UserPlus size={15}/>{busy ? "Creating…" : inviteeId ? "Send chess challenge" : "Create open table"}</Button>
          {error && <p className="mt-3 text-xs text-red-300">{error}</p>}
        </section>
        <section className="rounded-2xl border border-border bg-surface p-5"><h3 className="text-xs font-bold uppercase tracking-wider text-white/45">Full chess rules</h3><ul className="mt-3 space-y-2 text-xs leading-relaxed text-white/45"><li>Only legal moves are selectable.</li><li>Check and checkmate are detected automatically.</li><li>Castling, en passant, promotion, stalemate, repetition, insufficient material, and the fifty-move rule are supported.</li><li>Open any active match to spectate it live.</li></ul></section>
      </div>

      <section className="rounded-2xl border border-border bg-surface p-5 sm:p-6">
        <div className="flex items-center justify-between gap-3"><div><h2 className="text-lg font-bold text-white">Chess tables</h2><p className="mt-0.5 text-xs text-white/35">Join a waiting match or watch one in progress.</p></div><span className="rounded-full border border-emerald-400/20 bg-emerald-400/[.07] px-2.5 py-1 text-[10px] text-emerald-300">{visible.filter((room) => room.status === "active").length} live</span></div>
        <div className="mt-5 space-y-3">
          {visible.length === 0 && <div className="rounded-xl border border-dashed border-border py-14 text-center"><Users size={24} className="mx-auto text-white/20"/><p className="mt-3 text-sm text-white/35">No chess tables yet.</p></div>}
          {visible.map((room) => <button key={room.id} type="button" onClick={() => { setSelectedId(room.id); setError(""); }} className="cursor-target flex w-full items-center gap-3 rounded-xl border border-border bg-surface-2/55 p-3.5 text-left transition-all hover:-translate-y-0.5 hover:border-amber-400/35"><div className="grid h-9 w-9 place-items-center rounded-xl bg-amber-500/10 p-1"><img src={knightBlack} alt="" className="h-full w-full object-contain"/></div><div className="min-w-0 flex-1"><p className="truncate text-xs font-bold text-white">{room.whiteName} <span className="text-white/25">vs</span> {room.blackName || room.invitedName || "Anyone"}</p><p className="mt-0.5 flex items-center gap-2 text-[10px] text-white/30"><Clock3 size={10}/>{room.timeControl ? TIME_CONTROL_LABEL[room.timeControl] : age(room.createdAt, now)}{room.creditBet > 0 && <span className="text-amber-300">{room.creditBet * 2} credit pot</span>}{room.check && room.status === "active" && <span className="font-bold text-red-300">CHECK</span>}</p></div><span className={`rounded-full px-2 py-1 text-[9px] font-bold uppercase tracking-wider ${room.status === "active" ? "bg-emerald-400/10 text-emerald-300" : "bg-amber-400/10 text-amber-300"}`}>{room.status}</span><Eye size={14} className="text-white/20"/></button>)}
        </div>
      </section>
    </div>
  );
}
