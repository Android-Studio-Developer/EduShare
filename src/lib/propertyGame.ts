import { collection, doc, limit, onSnapshot, orderBy, query, runTransaction } from "firebase/firestore";
import { db } from "./firebase";
import type { PropertyGamePlayer, PropertyGameRoom } from "../types";

export type PropertySpaceType = "start" | "property" | "event" | "tax" | "transit" | "utility" | "detention" | "free" | "goToDetention";

export interface PropertySpace {
  id: string;
  name: string;
  type: PropertySpaceType;
  price?: number;
  rent?: number;
  amount?: number;
  group?: string;
  color?: string;
  icon?: string;
}

export const PROPERTY_BOARD: PropertySpace[] = [
  { id: "start", name: "Semester Start", type: "start", icon: "START" },
  { id: "pixel-plaza", name: "Pixel Plaza", type: "property", price: 60, rent: 8, group: "copper", color: "#a16207" },
  { id: "campus-mail-1", name: "Campus Mail", type: "event", icon: "✉" },
  { id: "redstone-road", name: "Redstone Road", type: "property", price: 80, rent: 10, group: "copper", color: "#a16207" },
  { id: "study-tax", name: "Study Tax", type: "tax", amount: 100, icon: "−$" },
  { id: "minecart-station", name: "Minecart Station", type: "transit", price: 200, rent: 25, group: "transit", color: "#64748b" },
  { id: "birch-boulevard", name: "Birch Boulevard", type: "property", price: 100, rent: 12, group: "sky", color: "#38bdf8" },
  { id: "detention", name: "Detention / Visiting", type: "detention", icon: "⌛" },
  { id: "coral-court", name: "Coral Court", type: "property", price: 120, rent: 14, group: "sky", color: "#38bdf8" },
  { id: "pop-quiz-1", name: "Pop Quiz", type: "event", icon: "?" },
  { id: "library-lane", name: "Library Lane", type: "property", price: 140, rent: 16, group: "orchid", color: "#d946ef" },
  { id: "science-square", name: "Science Square", type: "property", price: 160, rent: 18, group: "orchid", color: "#d946ef" },
  { id: "free-period", name: "Free Period", type: "free", icon: "☕" },
  { id: "nether-avenue", name: "Nether Avenue", type: "property", price: 180, rent: 20, group: "sunset", color: "#f97316" },
  { id: "campus-mail-2", name: "Campus Mail", type: "event", icon: "✉" },
  { id: "beacon-boulevard", name: "Beacon Boulevard", type: "property", price: 200, rent: 22, group: "sunset", color: "#f97316" },
  { id: "portal-station", name: "Portal Station", type: "transit", price: 200, rent: 25, group: "transit", color: "#64748b" },
  { id: "emerald-exchange", name: "Emerald Exchange", type: "property", price: 220, rent: 24, group: "ruby", color: "#ef4444" },
  { id: "go-to-detention", name: "Go to Detention", type: "goToDetention", icon: "→⌛" },
  { id: "ocean-observatory", name: "Ocean Observatory", type: "property", price: 240, rent: 26, group: "ruby", color: "#ef4444" },
  { id: "pop-quiz-2", name: "Pop Quiz", type: "event", icon: "?" },
  { id: "ender-estate", name: "Ender Estate", type: "property", price: 280, rent: 30, group: "midnight", color: "#6366f1" },
  { id: "server-utility", name: "Server Utility", type: "utility", price: 150, rent: 20, group: "utility", color: "#14b8a6" },
  { id: "creators-corner", name: "Creator's Corner", type: "property", price: 320, rent: 36, group: "midnight", color: "#6366f1" },
];

const EVENT_CARDS = [
  { title: "Study Grant", text: "Your project impressed the judges. Collect $100.", amount: 100 },
  { title: "Creeper Cleanup", text: "The lab needs repairs. Pay $50.", amount: -50 },
  { title: "Perfect Attendance", text: "Collect a $75 attendance bonus.", amount: 75 },
  { title: "Late Assignment", text: "Pay a $30 late fee.", amount: -30 },
  { title: "Club Fundraiser", text: "Your club had a great week. Collect $60.", amount: 60 },
  { title: "Device Repair", text: "A keyboard needs replacing. Pay $80.", amount: -80 },
  { title: "Principal's Pass", text: "Head to Semester Start and collect $200.", moveToStart: true },
  { title: "Hallway Trouble", text: "Go directly to Detention and miss one turn.", detention: true },
  { title: "Tutoring Session", text: "Collect $40 for helping another student.", amount: 40 },
  { title: "Field Trip", text: "Pay $60 for your ticket.", amount: -60 },
];

const TOKENS = ["#22d3ee", "#f472b6", "#fbbf24", "#34d399", "#a78bfa", "#fb7185"];
const START_REWARD = 200;

function roomsRef() {
  return collection(db, "propertyGames");
}

function entry(text: string) {
  const createdAt = Date.now();
  return { id: `${createdAt}-${Math.random().toString(36).slice(2, 7)}`, text, createdAt };
}

function withLog(room: Omit<PropertyGameRoom, "id">, text: string) {
  return [entry(text), ...(room.log ?? [])].slice(0, 60);
}

function nextPlayerIndex(players: PropertyGamePlayer[], current: number) {
  for (let offset = 1; offset <= players.length; offset += 1) {
    const candidate = (current + offset) % players.length;
    if (!players[candidate]?.bankrupt) return candidate;
  }
  return current;
}

function winningPlayer(players: PropertyGamePlayer[]) {
  const active = players.filter((player) => !player.bankrupt);
  return active.length === 1 ? active[0] : null;
}

function ownerOf(players: PropertyGamePlayer[], propertyId: string) {
  return players.findIndex((player) => !player.bankrupt && player.properties.includes(propertyId));
}

function rentFor(space: PropertySpace, owner: PropertyGamePlayer) {
  if (space.type === "transit") {
    const count = PROPERTY_BOARD.filter((item) => item.type === "transit" && owner.properties.includes(item.id)).length;
    return 25 * (2 ** Math.max(0, count - 1));
  }
  if (space.type === "utility") return 30;
  const group = PROPERTY_BOARD.filter((item) => item.group === space.group && item.type === "property");
  const ownsGroup = group.length > 0 && group.every((item) => owner.properties.includes(item.id));
  return (space.rent ?? 0) * (ownsGroup ? 2 : 1);
}

function charge(players: PropertyGamePlayer[], payerIndex: number, amount: number, receiverIndex = -1) {
  const payer = players[payerIndex];
  const paid = Math.min(payer.cash, amount);
  payer.cash -= paid;
  if (receiverIndex >= 0) players[receiverIndex].cash += paid;
  if (paid < amount) {
    payer.bankrupt = true;
    payer.properties = [];
    payer.cash = 0;
  }
  return { paid, bankrupt: payer.bankrupt };
}

export function subscribeToPropertyGames(callback: (rooms: PropertyGameRoom[]) => void) {
  return onSnapshot(query(roomsRef(), orderBy("createdAt", "desc"), limit(30)), (snapshot) => {
    callback(snapshot.docs.map((item) => ({ id: item.id, ...item.data() }) as PropertyGameRoom));
  });
}

export async function createPropertyGame(hostId: string, hostName: string, photoUrl: string, maxPlayers: number, startingCash: number) {
  const playerLimit = Math.max(2, Math.min(6, Math.floor(maxPlayers)));
  const cash = Math.max(500, Math.min(5000, Math.floor(startingCash)));
  const roomRef = doc(roomsRef());
  await runTransaction(db, async (transaction) => {
    transaction.set(roomRef, {
      hostId,
      hostName,
      maxPlayers: playerLimit,
      startingCash: cash,
      playerIds: [hostId],
      players: [{ id: hostId, name: hostName, photoUrl, token: TOKENS[0], position: 0, cash, properties: [], inDetention: false, detentionTurns: 0, bankrupt: false }],
      status: "waiting",
      currentPlayerIndex: 0,
      phase: "roll",
      pendingPropertyId: "",
      lastDice: [],
      lastCardTitle: "",
      lastCardText: "",
      winnerId: "",
      winnerName: "",
      deckIndex: Math.floor(Math.random() * EVENT_CARDS.length),
      turnNumber: 1,
      log: [entry(`${hostName} opened the room.`)],
      createdAt: Date.now(),
      startedAt: 0,
      finishedAt: 0,
    });
  });
  return roomRef;
}

export async function joinPropertyGame(roomId: string, userId: string, name: string, photoUrl: string) {
  await runTransaction(db, async (transaction) => {
    const roomRef = doc(db, "propertyGames", roomId);
    const snapshot = await transaction.get(roomRef);
    if (!snapshot.exists()) throw new Error("That room no longer exists.");
    const room = snapshot.data() as Omit<PropertyGameRoom, "id">;
    if (room.status !== "waiting") throw new Error("That game has already started.");
    if (room.playerIds.includes(userId)) return;
    if (room.players.length >= room.maxPlayers) throw new Error("That room is full.");
    const players = [...room.players, { id: userId, name, photoUrl, token: TOKENS[room.players.length], position: 0, cash: room.startingCash, properties: [], inDetention: false, detentionTurns: 0, bankrupt: false }];
    transaction.update(roomRef, { players, playerIds: [...room.playerIds, userId], log: withLog(room, `${name} joined the room.`) });
  });
}

export async function leavePropertyGame(roomId: string, userId: string) {
  await runTransaction(db, async (transaction) => {
    const roomRef = doc(db, "propertyGames", roomId);
    const snapshot = await transaction.get(roomRef);
    if (!snapshot.exists()) return;
    const room = snapshot.data() as Omit<PropertyGameRoom, "id">;
    if (room.status !== "waiting") throw new Error("You can only leave before the game starts.");
    if (room.hostId === userId) throw new Error("The host can cancel the room instead.");
    const leaving = room.players.find((player) => player.id === userId);
    const players = room.players.filter((player) => player.id !== userId).map((player, index) => ({ ...player, token: TOKENS[index] }));
    transaction.update(roomRef, { players, playerIds: players.map((player) => player.id), log: withLog(room, `${leaving?.name ?? "A player"} left the room.`) });
  });
}

export async function cancelPropertyGame(roomId: string, userId: string) {
  await runTransaction(db, async (transaction) => {
    const roomRef = doc(db, "propertyGames", roomId);
    const snapshot = await transaction.get(roomRef);
    if (!snapshot.exists()) return;
    const room = snapshot.data() as Omit<PropertyGameRoom, "id">;
    if (room.hostId !== userId || room.status !== "waiting") throw new Error("Only the host can cancel this lobby.");
    transaction.update(roomRef, { status: "cancelled", finishedAt: Date.now(), log: withLog(room, "The host closed the room.") });
  });
}

export async function startPropertyGame(roomId: string, userId: string) {
  await runTransaction(db, async (transaction) => {
    const roomRef = doc(db, "propertyGames", roomId);
    const snapshot = await transaction.get(roomRef);
    if (!snapshot.exists()) throw new Error("That room no longer exists.");
    const room = snapshot.data() as Omit<PropertyGameRoom, "id">;
    if (room.hostId !== userId || room.status !== "waiting") throw new Error("Only the host can start this game.");
    if (room.players.length < 2) throw new Error("At least two players are required.");
    transaction.update(roomRef, { status: "active", startedAt: Date.now(), currentPlayerIndex: 0, phase: "roll", log: withLog(room, `${room.players[0].name} takes the first turn.`) });
  });
}

export async function rollPropertyDice(roomId: string, userId: string) {
  const dice = [1 + Math.floor(Math.random() * 6), 1 + Math.floor(Math.random() * 6)];
  await runTransaction(db, async (transaction) => {
    const roomRef = doc(db, "propertyGames", roomId);
    const snapshot = await transaction.get(roomRef);
    if (!snapshot.exists()) throw new Error("That game no longer exists.");
    const room = snapshot.data() as Omit<PropertyGameRoom, "id">;
    if (room.status !== "active" || room.phase !== "roll") throw new Error("The dice cannot be rolled right now.");
    const players = room.players.map((player) => ({ ...player, properties: [...player.properties] }));
    const currentIndex = room.currentPlayerIndex;
    const player = players[currentIndex];
    if (!player || player.id !== userId) throw new Error("It is not your turn.");
    let log = room.log ?? [];
    const addLog = (text: string) => { log = [entry(text), ...log].slice(0, 60); };

    if (player.detentionTurns > 0) {
      player.detentionTurns = 0;
      player.inDetention = false;
      const next = nextPlayerIndex(players, currentIndex);
      addLog(`${player.name} served a turn in Detention.`);
      transaction.update(roomRef, { players, currentPlayerIndex: next, phase: "roll", pendingPropertyId: "", lastDice: [], turnNumber: room.turnNumber + 1, log });
      return;
    }

    const total = dice[0] + dice[1];
    const oldPosition = player.position;
    player.position = (oldPosition + total) % PROPERTY_BOARD.length;
    if (oldPosition + total >= PROPERTY_BOARD.length) {
      player.cash += START_REWARD;
      addLog(`${player.name} passed Semester Start and collected $${START_REWARD}.`);
    }
    const space = PROPERTY_BOARD[player.position];
    addLog(`${player.name} rolled ${dice[0]} + ${dice[1]} and landed on ${space.name}.`);
    let phase: PropertyGameRoom["phase"] = "end";
    let pendingPropertyId = "";
    let lastCardTitle = "";
    let lastCardText = "";

    if (["property", "transit", "utility"].includes(space.type)) {
      const ownerIndex = ownerOf(players, space.id);
      if (ownerIndex < 0) {
        phase = "buy";
        pendingPropertyId = space.id;
      } else if (ownerIndex !== currentIndex) {
        const rent = rentFor(space, players[ownerIndex]);
        const payment = charge(players, currentIndex, rent, ownerIndex);
        addLog(`${player.name} paid ${players[ownerIndex].name} $${payment.paid} rent${payment.bankrupt ? " and went bankrupt" : ""}.`);
      }
    } else if (space.type === "tax") {
      const payment = charge(players, currentIndex, space.amount ?? 0);
      addLog(`${player.name} paid $${payment.paid} in Study Tax${payment.bankrupt ? " and went bankrupt" : ""}.`);
    } else if (space.type === "event") {
      const card = EVENT_CARDS[room.deckIndex % EVENT_CARDS.length];
      lastCardTitle = card.title;
      lastCardText = card.text;
      if (card.moveToStart) {
        player.position = 0;
        player.cash += START_REWARD;
      } else if (card.detention) {
        player.position = PROPERTY_BOARD.findIndex((item) => item.type === "detention");
        player.inDetention = true;
        player.detentionTurns = 1;
      } else if ((card.amount ?? 0) >= 0) {
        player.cash += card.amount ?? 0;
      } else {
        charge(players, currentIndex, Math.abs(card.amount ?? 0));
      }
      addLog(`${card.title}: ${card.text}`);
    } else if (space.type === "goToDetention") {
      player.position = PROPERTY_BOARD.findIndex((item) => item.type === "detention");
      player.inDetention = true;
      player.detentionTurns = 1;
      addLog(`${player.name} was sent to Detention.`);
    }

    const winner = winningPlayer(players);
    const update: Record<string, unknown> = {
      players,
      phase,
      pendingPropertyId,
      lastDice: dice,
      lastCardTitle,
      lastCardText,
      deckIndex: room.deckIndex + (space.type === "event" ? 1 : 0),
      log,
    };
    if (winner && room.players.filter((item) => !item.bankrupt).length > 1) {
      update.status = "finished";
      update.winnerId = winner.id;
      update.winnerName = winner.name;
      update.finishedAt = Date.now();
      addLog(`${winner.name} wins Campus Capital!`);
      update.log = log;
    } else if (player.bankrupt) {
      update.currentPlayerIndex = nextPlayerIndex(players, currentIndex);
      update.phase = "roll";
      update.pendingPropertyId = "";
      update.turnNumber = room.turnNumber + 1;
    }
    transaction.update(roomRef, update);
  });
}

export async function buyProperty(roomId: string, userId: string) {
  await runTransaction(db, async (transaction) => {
    const roomRef = doc(db, "propertyGames", roomId);
    const snapshot = await transaction.get(roomRef);
    if (!snapshot.exists()) throw new Error("That game no longer exists.");
    const room = snapshot.data() as Omit<PropertyGameRoom, "id">;
    const players = room.players.map((player) => ({ ...player, properties: [...player.properties] }));
    const player = players[room.currentPlayerIndex];
    const space = PROPERTY_BOARD.find((item) => item.id === room.pendingPropertyId);
    if (room.status !== "active" || room.phase !== "buy" || player?.id !== userId || !space?.price) throw new Error("That property is not available.");
    if (ownerOf(players, space.id) >= 0) throw new Error("Someone already owns that property.");
    if (player.cash < space.price) throw new Error("You do not have enough game cash.");
    player.cash -= space.price;
    player.properties.push(space.id);
    transaction.update(roomRef, { players, phase: "end", pendingPropertyId: "", log: withLog(room, `${player.name} bought ${space.name} for $${space.price}.`) });
  });
}

export async function declineProperty(roomId: string, userId: string) {
  await runTransaction(db, async (transaction) => {
    const roomRef = doc(db, "propertyGames", roomId);
    const snapshot = await transaction.get(roomRef);
    if (!snapshot.exists()) return;
    const room = snapshot.data() as Omit<PropertyGameRoom, "id">;
    const player = room.players[room.currentPlayerIndex];
    if (room.status !== "active" || room.phase !== "buy" || player?.id !== userId) throw new Error("You cannot skip that purchase.");
    transaction.update(roomRef, { phase: "end", pendingPropertyId: "", log: withLog(room, `${player.name} passed on the property.`) });
  });
}

export async function endPropertyTurn(roomId: string, userId: string) {
  await runTransaction(db, async (transaction) => {
    const roomRef = doc(db, "propertyGames", roomId);
    const snapshot = await transaction.get(roomRef);
    if (!snapshot.exists()) return;
    const room = snapshot.data() as Omit<PropertyGameRoom, "id">;
    const player = room.players[room.currentPlayerIndex];
    if (room.status !== "active" || room.phase !== "end" || player?.id !== userId) throw new Error("You cannot end this turn.");
    const next = nextPlayerIndex(room.players, room.currentPlayerIndex);
    transaction.update(roomRef, { currentPlayerIndex: next, phase: "roll", pendingPropertyId: "", lastCardTitle: "", lastCardText: "", turnNumber: room.turnNumber + 1, log: withLog(room, `${room.players[next].name}'s turn.`) });
  });
}

export async function declarePropertyBankruptcy(roomId: string, userId: string) {
  await runTransaction(db, async (transaction) => {
    const roomRef = doc(db, "propertyGames", roomId);
    const snapshot = await transaction.get(roomRef);
    if (!snapshot.exists()) return;
    const room = snapshot.data() as Omit<PropertyGameRoom, "id">;
    const players = room.players.map((player) => ({ ...player, properties: [...player.properties] }));
    const index = room.currentPlayerIndex;
    if (room.status !== "active" || players[index]?.id !== userId) throw new Error("You can only declare bankruptcy on your turn.");
    players[index].bankrupt = true;
    players[index].cash = 0;
    players[index].properties = [];
    const winner = winningPlayer(players);
    if (winner) {
      transaction.update(roomRef, { players, status: "finished", winnerId: winner.id, winnerName: winner.name, finishedAt: Date.now(), log: withLog(room, `${players[index].name} went bankrupt. ${winner.name} wins!`) });
    } else {
      const next = nextPlayerIndex(players, index);
      transaction.update(roomRef, { players, currentPlayerIndex: next, phase: "roll", pendingPropertyId: "", turnNumber: room.turnNumber + 1, log: withLog(room, `${players[index].name} declared bankruptcy.`) });
    }
  });
}
