import { addDoc, collection, doc, onSnapshot, runTransaction, type FirestoreError } from "firebase/firestore";
import { db } from "./firebase";

export type LiarsRank = "A" | "K" | "Q" | "J";
export type LiarsCardRank = LiarsRank | "Joker";

export interface LiarsCard { id: string; rank: LiarsCardRank }
export interface LiarsPlayer {
  id: string;
  name: string;
  photoUrl: string;
  hand: LiarsCard[];
  /** Empty trigger pulls already survived. Kept as `strikes` for old room compatibility. */
  strikes: number;
  /** Hidden one-based loaded chamber. Older live rooms derive one on first pull. */
  bulletChamber?: number;
  alive: boolean;
  isBot: boolean;
}
export interface LiarsClaim { playerId: string; playerName: string; cards: LiarsCard[] }
export interface LiarsEffect { id: number; targetId: string; fired: boolean }
export interface LiarsRoom {
  id: string;
  hostId: string;
  playerIds: string[];
  players: LiarsPlayer[];
  status: "waiting" | "playing" | "finished" | "cancelled";
  target: LiarsRank;
  currentId: string;
  lastClaim: LiarsClaim | null;
  lastEffect: LiarsEffect | null;
  round: number;
  winnerId: string;
  winnerName: string;
  log: string[];
  createdAt: number;
  updatedAt: number;
}

const RANKS: LiarsRank[] = ["A", "K", "Q", "J"];
const BOT_NAMES = ["Agnes AI", "Agnes Nova", "Agnes Echo"];

function randomChamber() { return Math.floor(Math.random() * 6) + 1; }
function fallbackChamber(playerId: string) {
  const hash = [...playerId].reduce((value, letter) => ((value * 33) + letter.charCodeAt(0)) >>> 0, 19);
  return (hash % 6) + 1;
}
function loadedChamber(player: LiarsPlayer) {
  return Number.isInteger(player.bulletChamber) && player.bulletChamber! >= 1 && player.bulletChamber! <= 6
    ? player.bulletChamber!
    : fallbackChamber(player.id);
}

function roomsRef() { return collection(db, "liarsRooms"); }
function shuffle<T>(values: T[]) { return [...values].sort(() => Math.random() - 0.5); }
function createDeck() {
  let index = 0;
  return shuffle<LiarsCard>([
    ...RANKS.flatMap((rank) => Array.from({ length: 6 }, () => ({ id: `${rank}-${index++}`, rank }))),
    { id: `joker-${index++}`, rank: "Joker" },
    { id: `joker-${index++}`, rank: "Joker" },
  ]);
}

function nextAlive(players: LiarsPlayer[], currentId: string) {
  const start = Math.max(0, players.findIndex((player) => player.id === currentId));
  for (let offset = 1; offset <= players.length; offset += 1) {
    const candidate = players[(start + offset) % players.length];
    if (candidate.alive) return candidate.id;
  }
  return currentId;
}

function deal(players: LiarsPlayer[], starterId: string, round: number, log: string[]): Pick<LiarsRoom, "players" | "target" | "currentId" | "lastClaim" | "lastEffect" | "round" | "log"> {
  const cards = createDeck();
  let cursor = 0;
  const dealt = players.map((player) => {
    if (!player.alive) return { ...player, hand: [] };
    const hand = cards.slice(cursor, cursor + 5);
    cursor += 5;
    return { ...player, hand };
  });
  return {
    players: dealt,
    target: RANKS[Math.floor(Math.random() * RANKS.length)],
    currentId: dealt.some((player) => player.id === starterId && player.alive) ? starterId : dealt.find((player) => player.alive)?.id ?? "",
    lastClaim: null,
    lastEffect: null,
    round,
    log: log.slice(0, 12),
  };
}

function friendlyPermissionError(error: unknown) {
  const code = (error as FirestoreError)?.code;
  if (code === "permission-denied") return new Error("Multiplayer access is not active in this dev database yet. Run the Firestore emulator or activate the local liarsRooms rule.");
  return error instanceof Error ? error : new Error("The bluff table could not reach Firestore.");
}

export function subscribeToLiarsRooms(onRooms: (rooms: LiarsRoom[]) => void, onError: (message: string) => void) {
  return onSnapshot(roomsRef(), (snapshot) => {
    const rooms = snapshot.docs.map((item) => ({ id: item.id, ...item.data() }) as LiarsRoom)
      .filter((room) => room.status !== "cancelled" && Date.now() - room.updatedAt < 12 * 60 * 60 * 1000)
      .sort((a, b) => b.createdAt - a.createdAt);
    onRooms(rooms);
  }, (error) => onError(friendlyPermissionError(error).message));
}

export async function createLiarsRoom(userId: string, name: string, photoUrl: string) {
  try {
    return await addDoc(roomsRef(), {
      hostId: userId,
      playerIds: [userId],
      players: [{ id: userId, name, photoUrl, hand: [], strikes: 0, bulletChamber: randomChamber(), alive: true, isBot: false }],
      status: "waiting",
      target: "A",
      currentId: userId,
      lastClaim: null,
      lastEffect: null,
      round: 0,
      winnerId: "",
      winnerName: "",
      log: [`${name} opened the table.`],
      createdAt: Date.now(),
      updatedAt: Date.now(),
    });
  } catch (error) { throw friendlyPermissionError(error); }
}

export async function joinLiarsRoom(roomId: string, userId: string, name: string, photoUrl: string) {
  try {
    await runTransaction(db, async (transaction) => {
      const roomRef = doc(db, "liarsRooms", roomId);
      const snapshot = await transaction.get(roomRef);
      if (!snapshot.exists()) throw new Error("That table no longer exists.");
      const room = snapshot.data() as Omit<LiarsRoom, "id">;
      if (room.playerIds.includes(userId)) return;
      if (room.status !== "waiting") throw new Error("That game has already started.");
      if (room.playerIds.length >= 4) throw new Error("That table is full.");
      transaction.update(roomRef, {
        playerIds: [...room.playerIds, userId],
        players: [...room.players, { id: userId, name, photoUrl, hand: [], strikes: 0, bulletChamber: randomChamber(), alive: true, isBot: false }],
        log: [`${name} joined the table.`, ...room.log].slice(0, 12),
        updatedAt: Date.now(),
      });
    });
  } catch (error) { throw friendlyPermissionError(error); }
}

export async function startLiarsRoom(roomId: string, userId: string) {
  try {
    await runTransaction(db, async (transaction) => {
      const roomRef = doc(db, "liarsRooms", roomId);
      const snapshot = await transaction.get(roomRef);
      if (!snapshot.exists()) throw new Error("That table no longer exists.");
      const room = snapshot.data() as Omit<LiarsRoom, "id">;
      if (room.hostId !== userId) throw new Error("Only the host can start this table.");
      if (room.status !== "waiting") return;
      const players = [...room.players];
      while (players.length < 4) {
        const botIndex = players.filter((player) => player.isBot).length;
        players.push({ id: `agnes-${botIndex + 1}`, name: BOT_NAMES[botIndex], photoUrl: "", hand: [], strikes: 0, bulletChamber: randomChamber(), alive: true, isBot: true });
      }
      transaction.update(roomRef, {
        ...deal(players, room.hostId, 1, ["Agnes filled the empty seats. Round 1 begins.", ...room.log]),
        status: "playing",
        updatedAt: Date.now(),
      });
    });
  } catch (error) { throw friendlyPermissionError(error); }
}

export async function cancelLiarsRoom(roomId: string, userId: string) {
  try {
    await runTransaction(db, async (transaction) => {
      const roomRef = doc(db, "liarsRooms", roomId);
      const snapshot = await transaction.get(roomRef);
      if (!snapshot.exists()) return;
      const room = snapshot.data() as Omit<LiarsRoom, "id">;
      if (room.hostId !== userId || room.status !== "waiting") throw new Error("This table cannot be closed now.");
      transaction.update(roomRef, { status: "cancelled", updatedAt: Date.now() });
    });
  } catch (error) { throw friendlyPermissionError(error); }
}

function finishIfLast(room: Omit<LiarsRoom, "id">, players: LiarsPlayer[]) {
  const survivors = players.filter((player) => player.alive);
  if (survivors.length !== 1) return null;
  return { players, status: "finished", winnerId: survivors[0].id, winnerName: survivors[0].name, lastClaim: null, currentId: "", log: [`${survivors[0].name} is the last player standing!`, ...room.log].slice(0, 12) };
}

function challengePatch(room: Omit<LiarsRoom, "id">, challengerId: string) {
  if (!room.lastClaim) throw new Error("There is no claim to challenge.");
  if (room.currentId !== challengerId) throw new Error("It is not your turn.");
  const claim = room.lastClaim;
  const lied = claim.cards.some((card) => card.rank !== room.target && card.rank !== "Joker");
  const loserId = lied ? claim.playerId : challengerId;
  const players = room.players.map((player) => {
    if (player.id !== loserId) return player;
    const bulletChamber = loadedChamber(player);
    const nextPull = (player.strikes ?? 0) + 1;
    return { ...player, strikes: nextPull, bulletChamber, alive: nextPull < bulletChamber };
  });
  const loser = players.find((player) => player.id === loserId)!;
  const reveal = claim.cards.map((card) => card.rank).join(", ");
  const result = lied ? `${claim.playerName} bluffed (${reveal}).` : `${claim.playerName} told the truth (${reveal}).`;
  const effect: LiarsEffect = { id: Date.now(), targetId: loserId, fired: !loser.alive };
  const log = [`${result} ${loser.name} pulls the trigger — ${loser.alive ? "click, empty chamber" : "the revolver fires"}.`, ...room.log].slice(0, 12);
  const finished = finishIfLast({ ...room, log }, players);
  if (finished) return { ...finished, lastEffect: effect, updatedAt: Date.now() };
  if (!lied && players.find((player) => player.id === claim.playerId)?.hand.length === 0) {
    return { players, status: "finished", winnerId: claim.playerId, winnerName: claim.playerName, lastClaim: null, currentId: "", lastEffect: effect, log: [`${claim.playerName} emptied their hand honestly and wins!`, ...log].slice(0, 12), updatedAt: Date.now() };
  }
  return { ...deal(players, loserId, room.round + 1, [`Round ${room.round + 1} begins.`, ...log]), status: "playing", winnerId: "", winnerName: "", lastEffect: effect, updatedAt: Date.now() };
}

function believePatch(room: Omit<LiarsRoom, "id">, userId: string) {
  if (!room.lastClaim || room.currentId !== userId) throw new Error("It is not your turn.");
  const claimant = room.players.find((player) => player.id === room.lastClaim?.playerId);
  if (claimant?.hand.length === 0) return { status: "finished", winnerId: claimant.id, winnerName: claimant.name, currentId: "", lastClaim: null, log: [`${claimant.name}'s final claim was believed. They win!`, ...room.log].slice(0, 12), updatedAt: Date.now() };
  return { lastClaim: null, updatedAt: Date.now() };
}

async function updateRoom(roomId: string, mutate: (room: Omit<LiarsRoom, "id">) => object) {
  try {
    await runTransaction(db, async (transaction) => {
      const roomRef = doc(db, "liarsRooms", roomId);
      const snapshot = await transaction.get(roomRef);
      if (!snapshot.exists()) throw new Error("That table no longer exists.");
      transaction.update(roomRef, mutate(snapshot.data() as Omit<LiarsRoom, "id">));
    });
  } catch (error) { throw friendlyPermissionError(error); }
}

export function playLiarsCards(roomId: string, userId: string, cardIds: string[]) {
  return updateRoom(roomId, (room) => {
    if (room.status !== "playing" || room.currentId !== userId || room.lastClaim) throw new Error("Wait for your turn before playing.");
    if (cardIds.length < 1 || cardIds.length > 3) throw new Error("Choose one to three cards.");
    const player = room.players.find((seat) => seat.id === userId && seat.alive);
    if (!player) throw new Error("You are not an active player at this table.");
    const selected = player.hand.filter((card) => cardIds.includes(card.id));
    if (selected.length !== cardIds.length) throw new Error("Those cards are no longer in your hand.");
    const ids = new Set(cardIds);
    const players = room.players.map((seat) => seat.id === userId ? { ...seat, hand: seat.hand.filter((card) => !ids.has(card.id)) } : seat);
    return { players, currentId: nextAlive(players, userId), lastClaim: { playerId: userId, playerName: player.name, cards: selected }, log: [`${player.name} places ${selected.length} card${selected.length === 1 ? "" : "s"} face down.`, ...room.log].slice(0, 12), updatedAt: Date.now() };
  });
}

export function challengeLiarsClaim(roomId: string, userId: string) { return updateRoom(roomId, (room) => challengePatch(room, userId)); }
export function believeLiarsClaim(roomId: string, userId: string) { return updateRoom(roomId, (room) => believePatch(room, userId)); }

function chooseAgnesCards(player: LiarsPlayer, target: LiarsRank) {
  const truthful = player.hand.filter((card) => card.rank === target || card.rank === "Joker");
  const bluff = Math.random() < 0.4 || truthful.length === 0;
  const source = bluff ? player.hand : truthful;
  return shuffle(source).slice(0, Math.min(source.length, Math.random() < 0.25 ? 2 : 1));
}

export function advanceAgnes(roomId: string) {
  return updateRoom(roomId, (room) => {
    if (room.status !== "playing") return {};
    const bot = room.players.find((player) => player.id === room.currentId);
    if (!bot?.isBot || !bot.alive) return {};
    let working = room;
    if (working.lastClaim) {
      const claimant = working.players.find((player) => player.id === working.lastClaim?.playerId);
      const suspicion = 0.14 + working.lastClaim.cards.length * 0.12 + (claimant?.hand.length === 0 ? 0.34 : 0);
      if (Math.random() < suspicion) return challengePatch(working, bot.id);
      const believed = believePatch(working, bot.id);
      if (believed.status === "finished") return believed;
      working = { ...working, lastClaim: null, updatedAt: Date.now() };
    }
    const freshBot = working.players.find((player) => player.id === bot.id)!;
    const selected = chooseAgnesCards(freshBot, working.target);
    const ids = new Set(selected.map((card) => card.id));
    const players = working.players.map((player) => player.id === bot.id ? { ...player, hand: player.hand.filter((card) => !ids.has(card.id)) } : player);
    return { players, currentId: nextAlive(players, bot.id), lastClaim: { playerId: bot.id, playerName: bot.name, cards: selected }, log: [`${bot.name} places ${selected.length} card${selected.length === 1 ? "" : "s"} face down.`, ...working.log].slice(0, 12), updatedAt: Date.now() };
  });
}
