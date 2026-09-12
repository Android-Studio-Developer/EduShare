import { useEffect, useMemo, useState } from "react";
import { ArrowLeft, Building2, CircleDollarSign, Crown, Dice5, DoorOpen, Eye, Flag, Play, ShoppingBag, Trophy, UserPlus, Users, X } from "lucide-react";
import { useAuth } from "../context/AuthContext";
import { useNow } from "../hooks/useNow";
import {
  PROPERTY_BOARD,
  buyProperty,
  cancelPropertyGame,
  createPropertyGame,
  declarePropertyBankruptcy,
  declineProperty,
  endPropertyTurn,
  joinPropertyGame,
  leavePropertyGame,
  rollPropertyDice,
  startPropertyGame,
  subscribeToPropertyGames,
  type PropertySpace,
} from "../lib/propertyGame";
import { subscribeToProfile } from "../lib/profiles";
import type { PropertyGamePlayer, PropertyGameRoom, UserProfile } from "../types";
import Button from "./Button";

function boardPosition(index: number) {
  if (index === 0) return { gridRow: 7, gridColumn: 1 };
  if (index <= 6) return { gridRow: 7, gridColumn: index + 1 };
  if (index <= 12) return { gridRow: 13 - index, gridColumn: 7 };
  if (index <= 18) return { gridRow: 1, gridColumn: 19 - index };
  return { gridRow: index - 17, gridColumn: 1 };
}

function formatAge(timestamp: number, now: number) {
  const minutes = Math.max(0, Math.floor((now - timestamp) / 60_000));
  if (minutes < 1) return "now";
  if (minutes < 60) return `${minutes}m`;
  return `${Math.floor(minutes / 60)}h`;
}

function Avatar({ player }: { player: PropertyGamePlayer }) {
  return player.photoUrl ? <img src={player.photoUrl} alt="" className="h-9 w-9 rounded-xl object-cover" /> : (
    <span className="grid h-9 w-9 place-items-center rounded-xl font-mono text-xs font-black text-slate-950" style={{ background: player.token }}>{player.name.slice(0, 1).toUpperCase()}</span>
  );
}

function Space({ space, index, players }: { space: PropertySpace; index: number; players: PropertyGamePlayer[] }) {
  const owner = players.find((player) => player.properties.includes(space.id));
  const occupants = players.filter((player) => !player.bankrupt && player.position === index);
  const purchasable = ["property", "transit", "utility"].includes(space.type);
  return (
    <div
      className={`relative flex min-h-[82px] min-w-[82px] flex-col overflow-hidden border border-slate-950/30 bg-[#e8f3dc] p-1.5 text-center text-slate-900 ${[0, 7, 12, 18].includes(index) ? "justify-center bg-[#d7ead2]" : ""}`}
      style={boardPosition(index)}
    >
      {space.color && <span className="absolute inset-x-0 top-0 h-2.5" style={{ backgroundColor: space.color }} />}
      <p className={`mt-2 line-clamp-2 text-[9px] font-black uppercase leading-tight ${!space.color ? "mt-0" : ""}`}>{space.name}</p>
      {space.icon && <span className="mt-1 text-base font-black">{space.icon}</span>}
      {purchasable && <p className="mt-auto font-mono text-[9px] font-bold">${space.price}</p>}
      {space.type === "tax" && <p className="mt-auto font-mono text-[9px] font-bold">Pay ${space.amount}</p>}
      {owner && <span className="absolute bottom-1 left-1 h-2.5 w-2.5 rounded-full ring-2 ring-slate-900/25" title={`Owned by ${owner.name}`} style={{ background: owner.token }} />}
      {occupants.length > 0 && <div className="absolute right-1 top-1 flex max-w-[50px] flex-wrap justify-end gap-0.5">{occupants.map((player) => <span key={player.id} title={player.name} className="h-3.5 w-3.5 rounded-full border-2 border-white shadow" style={{ background: player.token }} />)}</div>}
    </div>
  );
}

function Board({ room, userId, busy, run }: { room: PropertyGameRoom; userId: string; busy: boolean; run: (action: () => Promise<void>) => void }) {
  const current = room.players[room.currentPlayerIndex];
  const isMyTurn = room.status === "active" && current?.id === userId;
  const pending = PROPERTY_BOARD.find((space) => space.id === room.pendingPropertyId);
  const me = room.players.find((player) => player.id === userId);
  const dice = room.lastDice ?? [];
  return (
    <div className="overflow-auto rounded-3xl border border-emerald-300/20 bg-[#07140f] p-2 shadow-[0_30px_100px_-50px_rgba(16,185,129,.8)] sm:p-4">
      <div className="mx-auto grid aspect-square min-w-[680px] max-w-[900px] grid-cols-7 grid-rows-7 overflow-hidden rounded-2xl border-4 border-[#153c2c] bg-[#cfe8c8] shadow-2xl">
        {PROPERTY_BOARD.map((space, index) => <Space key={space.id} space={space} index={index} players={room.players}/>)}
        <div className="relative flex flex-col items-center justify-center overflow-hidden p-8 text-center" style={{ gridArea: "2 / 2 / 7 / 7" }}>
          <div className="pointer-events-none absolute inset-0 opacity-40 [background-image:radial-gradient(circle_at_20%_20%,rgba(16,185,129,.35),transparent_35%),radial-gradient(circle_at_80%_70%,rgba(14,165,233,.25),transparent_38%)]"/>
          <div className="relative w-full max-w-md">
            <p className="text-[10px] font-black uppercase tracking-[.32em] text-emerald-950/55">SpawnDex presents</p>
            <h2 className="mt-2 -rotate-3 text-4xl font-black uppercase tracking-tight text-emerald-950 sm:text-5xl">Campus Capital</h2>
            <p className="mt-2 text-xs font-semibold text-emerald-950/60">Build the smartest block in school.</p>

            {room.status === "active" && <div className="mt-7 rounded-2xl border border-emerald-950/15 bg-white/60 p-4 shadow-xl backdrop-blur-sm">
              <div className="flex items-center justify-center gap-2"><span className="h-3 w-3 rounded-full" style={{ background: current?.token }}/><p className="font-mono text-sm font-black text-emerald-950">{current?.name}'s turn</p></div>
              {dice.length === 2 && <div className="mt-3 flex justify-center gap-2">{dice.map((die, index) => <span key={index} className="grid h-10 w-10 place-items-center rounded-xl bg-emerald-950 font-mono text-lg font-black text-white shadow">{die}</span>)}</div>}
              {room.lastCardTitle && <div className="mt-3 rounded-xl border border-amber-600/25 bg-amber-50 p-3 text-left"><p className="text-xs font-black text-amber-950">{room.lastCardTitle}</p><p className="mt-1 text-[11px] leading-relaxed text-amber-950/70">{room.lastCardText}</p></div>}
              {pending && <div className="mt-3 rounded-xl border border-emerald-900/20 bg-white/70 p-3"><p className="text-xs font-black text-emerald-950">Buy {pending.name}?</p><p className="mt-1 text-[11px] text-emerald-950/65">Price ${pending.price} · Base rent ${pending.rent}</p></div>}
              {isMyTurn ? <div className="mt-4 flex flex-wrap justify-center gap-2">
                {room.phase === "roll" && <Button onClick={() => run(() => rollPropertyDice(room.id, userId))} disabled={busy}><Dice5 size={16}/>{current.detentionTurns > 0 ? "Serve detention turn" : "Roll dice"}</Button>}
                {room.phase === "buy" && <><Button onClick={() => run(() => buyProperty(room.id, userId))} disabled={busy || !pending || current.cash < (pending.price ?? 0)}><ShoppingBag size={15}/>Buy ${pending?.price}</Button><Button variant="secondary" onClick={() => run(() => declineProperty(room.id, userId))} disabled={busy}>Pass</Button></>}
                {room.phase === "end" && <Button onClick={() => run(() => endPropertyTurn(room.id, userId))} disabled={busy}>End turn</Button>}
              </div> : <p className="mt-4 text-[11px] font-bold text-emerald-950/55">Watching live—waiting for {current?.name}.</p>}
            </div>}

            {room.status === "waiting" && <div className="mt-7 rounded-2xl border border-emerald-950/15 bg-white/55 p-5"><Users size={24} className="mx-auto text-emerald-900"/><p className="mt-2 text-sm font-black text-emerald-950">Lobby open</p><p className="mt-1 text-xs text-emerald-950/60">{room.players.length}/{room.maxPlayers} players · ${room.startingCash} each</p></div>}
            {room.status === "finished" && <div className="mt-7 rounded-2xl border border-amber-600/20 bg-amber-50/80 p-5"><Trophy size={28} className="mx-auto text-amber-600"/><p className="mt-2 text-lg font-black text-amber-950">{room.winnerName} wins!</p><p className="text-xs text-amber-900/65">Last player solvent.</p></div>}
            {!me && room.status === "active" && <span className="mt-3 inline-flex items-center gap-1 rounded-full bg-emerald-950/10 px-3 py-1 text-[10px] font-bold text-emerald-950/60"><Eye size={11}/>Spectating</span>}
          </div>
        </div>
      </div>
    </div>
  );
}

function GameRoom({ room, userId, busy, error, onBack, onJoin, run }: { room: PropertyGameRoom; userId: string; busy: boolean; error: string; onBack: () => void; onJoin: () => void; run: (action: () => Promise<void>) => void }) {
  const isHost = room.hostId === userId;
  const joined = room.playerIds.includes(userId);
  const current = room.players[room.currentPlayerIndex];
  return (
    <div className="mt-7">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <button type="button" onClick={onBack} className="cursor-target flex items-center gap-1.5 text-xs font-bold text-white/45 hover:text-white"><ArrowLeft size={14}/>Campus Capital rooms</button>
        <div className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-wider text-white/40"><span className="rounded-full border border-border px-2.5 py-1">Turn {room.turnNumber}</span><span className={`rounded-full px-2.5 py-1 ${room.status === "active" ? "bg-emerald-400/10 text-emerald-300" : "bg-white/5"}`}>{room.status}</span></div>
      </div>
      <div className="grid items-start gap-5 xl:grid-cols-[minmax(0,1fr)_310px]">
        <Board room={room} userId={userId} busy={busy} run={run}/>
        <aside className="space-y-4">
          <section className="rounded-2xl border border-border bg-surface p-4"><div className="flex items-center justify-between"><h3 className="text-xs font-black uppercase tracking-wider text-white/55">Players</h3><span className="text-[10px] text-white/30">{room.players.filter((player) => !player.bankrupt).length} active</span></div><div className="mt-3 space-y-2">{room.players.map((player, index) => <div key={player.id} className={`flex items-center gap-2.5 rounded-xl border p-2.5 ${index === room.currentPlayerIndex && room.status === "active" ? "border-emerald-400/35 bg-emerald-400/[.06]" : "border-border bg-surface-2/40"} ${player.bankrupt ? "opacity-40" : ""}`}><Avatar player={player}/><div className="min-w-0 flex-1"><p className="truncate text-xs font-bold text-white">{player.name}{player.id === userId && <span className="text-white/30"> · You</span>}</p><p className="mt-0.5 flex items-center gap-2 text-[10px] text-white/35"><span className="text-emerald-300">${player.cash}</span><span>{player.properties.length} deeds</span>{player.inDetention && <span className="text-amber-300">Detention</span>}</p></div>{player.id === room.hostId && <Crown size={13} className="text-amber-300"/>}</div>)}</div></section>

          {room.status === "waiting" && <section className="rounded-2xl border border-border bg-surface p-4"><h3 className="text-sm font-bold text-white">Ready to build?</h3><p className="mt-1 text-xs leading-relaxed text-white/40">The host chose {room.maxPlayers} seats and ${room.startingCash} game cash per player.</p><div className="mt-4 grid gap-2">{!joined && room.players.length < room.maxPlayers && <Button onClick={onJoin} disabled={busy}><UserPlus size={15}/>Join lobby</Button>}{isHost ? <><Button onClick={() => run(() => startPropertyGame(room.id, userId))} disabled={busy || room.players.length < 2}><Play size={15}/>Start game</Button><Button variant="danger" onClick={() => run(() => cancelPropertyGame(room.id, userId))} disabled={busy}><X size={15}/>Close lobby</Button></> : joined ? <Button variant="secondary" onClick={() => run(() => leavePropertyGame(room.id, userId))} disabled={busy}><DoorOpen size={15}/>Leave lobby</Button> : null}</div></section>}

          {room.status === "active" && joined && current?.id === userId && <Button variant="danger" className="w-full" onClick={() => run(() => declarePropertyBankruptcy(room.id, userId))} disabled={busy}><Flag size={15}/>Declare bankruptcy</Button>}

          <section className="rounded-2xl border border-border bg-surface p-4"><h3 className="text-xs font-black uppercase tracking-wider text-white/55">Activity</h3><div className="mt-3 max-h-56 space-y-2 overflow-auto pr-1">{room.log.map((item) => <p key={item.id} className="border-l border-white/10 pl-2 text-[10px] leading-relaxed text-white/40">{item.text}</p>)}</div></section>
          {error && <p className="rounded-xl border border-red-500/20 bg-red-500/[.07] p-3 text-xs text-red-300">{error}</p>}
        </aside>
      </div>
    </div>
  );
}

export default function PropertyArena() {
  const { user } = useAuth();
  const now = useNow(10_000);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [rooms, setRooms] = useState<PropertyGameRoom[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [maxPlayers, setMaxPlayers] = useState(4);
  const [startingCash, setStartingCash] = useState(1500);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => subscribeToPropertyGames(setRooms), []);
  useEffect(() => user ? subscribeToProfile(user.uid, setProfile) : undefined, [user]);
  const selected = rooms.find((room) => room.id === selectedId) ?? null;
  const visibleRooms = useMemo(() => rooms.filter((room) => room.status !== "cancelled" && (room.status !== "finished" || now - room.finishedAt < 6 * 60 * 60 * 1000)), [rooms, now]);
  const name = profile?.displayName ?? user?.displayName ?? "Player";
  const photoUrl = profile?.photoUrl ?? user?.photoURL ?? "";

  function run(action: () => Promise<void>) {
    setBusy(true);
    setError("");
    void action().catch((cause) => setError(cause instanceof Error ? cause.message : "That move did not work.")).finally(() => setBusy(false));
  }

  function createRoom() {
    if (!user) return;
    run(async () => {
      const roomRef = await createPropertyGame(user.uid, name, photoUrl, maxPlayers, startingCash);
      setSelectedId(roomRef.id);
    });
  }

  function join(room: PropertyGameRoom) {
    if (!user) return;
    run(async () => {
      await joinPropertyGame(room.id, user.uid, name, photoUrl);
      setSelectedId(room.id);
    });
  }

  if (selected && user) return <GameRoom room={selected} userId={user.uid} busy={busy} error={error} onBack={() => { setSelectedId(null); setError(""); }} onJoin={() => join(selected)} run={run}/>;

  return (
    <div className="mt-7 grid gap-6 lg:grid-cols-[.72fr_1.28fr]">
      <div className="space-y-5">
        <section className="rounded-2xl border border-border bg-surface p-5">
          <div className="flex items-center gap-3"><span className="grid h-11 w-11 place-items-center rounded-xl bg-emerald-400/10 text-emerald-300"><Building2 size={21}/></span><div><h2 className="text-sm font-bold text-white">Host Campus Capital</h2><p className="text-[11px] text-white/35">Create a live property-trading room.</p></div></div>
          <label className="mt-5 block text-[11px] font-bold uppercase tracking-wider text-white/35">Player seats</label>
          <div className="mt-2 grid grid-cols-5 gap-1.5">{[2, 3, 4, 5, 6].map((count) => <button type="button" key={count} onClick={() => setMaxPlayers(count)} className={`cursor-target rounded-lg border py-2 text-xs font-bold ${maxPlayers === count ? "border-emerald-400/45 bg-emerald-400/10 text-emerald-200" : "border-border bg-surface-2 text-white/40"}`}>{count}</button>)}</div>
          <label className="mt-4 block text-[11px] font-bold uppercase tracking-wider text-white/35">Starting money</label>
          <div className="mt-2 grid grid-cols-3 gap-1.5">{[500, 1000, 1500, 2000, 3000, 5000].map((amount) => <button type="button" key={amount} onClick={() => setStartingCash(amount)} className={`cursor-target rounded-lg border py-2 font-mono text-[11px] font-bold ${startingCash === amount ? "border-emerald-400/45 bg-emerald-400/10 text-emerald-200" : "border-border bg-surface-2 text-white/40"}`}>${amount}</button>)}</div>
          <Button className="mt-4 w-full bg-emerald-600 hover:bg-emerald-500" onClick={createRoom} disabled={busy}><UserPlus size={15}/>{busy ? "Opening…" : "Create room"}</Button>
          {error && <p className="mt-3 text-xs text-red-300">{error}</p>}
        </section>
        <section className="rounded-2xl border border-border bg-surface p-5"><h3 className="text-xs font-bold uppercase tracking-wider text-white/45">Core rules</h3><ul className="mt-3 space-y-2 text-xs leading-relaxed text-white/45"><li>Roll, move, buy open deeds, and collect rent.</li><li>Owning a full color set doubles its base rent.</li><li>Transit rent grows when you own both stations.</li><li>Pass Semester Start to collect $200.</li><li>Event cards, taxes, and Detention can change a turn.</li><li>Bankrupt players release their deeds. Last player solvent wins.</li></ul><p className="mt-4 border-t border-border pt-3 text-[10px] leading-relaxed text-white/30">Game money is separate from SpawnDex Credits. Cards are original and built in—nothing to upload.</p></section>
      </div>
      <section className="rounded-2xl border border-border bg-surface p-5 sm:p-6">
        <div className="flex items-center justify-between gap-3"><div><h2 className="text-lg font-bold text-white">Property rooms</h2><p className="mt-0.5 text-xs text-white/35">Join a lobby or spectate a game already underway.</p></div><span className="rounded-full border border-emerald-400/20 bg-emerald-400/[.06] px-2.5 py-1 text-[10px] text-emerald-300">{visibleRooms.filter((room) => room.status === "active").length} live</span></div>
        <div className="mt-5 space-y-3">
          {visibleRooms.length === 0 && <div className="rounded-xl border border-dashed border-border py-16 text-center"><CircleDollarSign size={27} className="mx-auto text-white/20"/><p className="mt-3 text-sm text-white/35">No rooms yet. Open the first campus.</p></div>}
          {visibleRooms.map((room) => {
            const joined = room.playerIds.includes(user?.uid ?? "");
            const canJoin = room.status === "waiting" && !joined && room.players.length < room.maxPlayers;
            return <div key={room.id} className="flex flex-wrap items-center gap-3 rounded-xl border border-border bg-surface-2/50 p-3.5"><div className="flex -space-x-2">{room.players.slice(0, 4).map((player) => <span key={player.id} className="grid h-8 w-8 place-items-center rounded-xl border-2 border-surface font-mono text-[9px] font-black text-slate-950" style={{ background: player.token }}>{player.name.slice(0, 1).toUpperCase()}</span>)}</div><button type="button" onClick={() => setSelectedId(room.id)} className="cursor-target min-w-0 flex-1 text-left"><p className="truncate text-xs font-bold text-white">{room.hostName}'s campus {joined && <span className="text-emerald-300">· Joined</span>}</p><p className="mt-1 flex flex-wrap items-center gap-2 text-[10px] text-white/30"><span>{room.players.length}/{room.maxPlayers} players</span><span>${room.startingCash} start</span><span>{formatAge(room.createdAt, now)}</span></p></button>{canJoin ? <Button size="sm" onClick={() => join(room)} disabled={busy}><UserPlus size={13}/>Join</Button> : <button type="button" onClick={() => setSelectedId(room.id)} className="cursor-target rounded-lg border border-border px-3 py-2 text-[10px] font-bold text-white/45 hover:text-white">{room.status === "active" ? <><Eye size={12} className="mr-1 inline"/>Watch</> : room.status === "finished" ? <><Trophy size={12} className="mr-1 inline"/>Result</> : "Open"}</button>}</div>;
          })}
        </div>
      </section>
    </div>
  );
}
