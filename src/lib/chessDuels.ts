import { Chess, type Square } from "chess.js";
import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  limit,
  onSnapshot,
  orderBy,
  query,
  runTransaction,
  setDoc,
} from "firebase/firestore";
import { db } from "./firebase";
import { ensureWallet } from "./shop";
import type { ChessDuel, ChessDuelMove, ChessResult, ChessRoomMessage, ChessTimeControl, WordleSpectator } from "../types";

const STARTING_FEN = new Chess().fen();

function roomsRef() {
  return collection(db, "chessDuels");
}

export function subscribeToChessDuels(callback: (rooms: ChessDuel[]) => void) {
  return onSnapshot(query(roomsRef(), orderBy("createdAt", "desc"), limit(40)), (snapshot) => {
    callback(snapshot.docs.map((item) => ({ id: item.id, ...item.data() }) as ChessDuel));
  });
}

export async function createChessDuel(
  whiteId: string,
  whiteName: string,
  whitePhotoUrl: string,
  invitee?: { id: string; name: string } | null,
  creditBet = 0,
  timeControl: ChessTimeControl = "blitz_5_3",
) {
  const stake = Math.max(0, Math.min(100, Math.floor(creditBet)));
  const initialTimeMs = timeControl === "rapid_10" ? 10 * 60_000 : 5 * 60_000;
  const incrementMs = timeControl === "blitz_5_3" ? 3_000 : 0;
  const roomRef = doc(roomsRef());
  await ensureWallet(whiteId);
  const walletRef = doc(db, "wallets", whiteId);

  await runTransaction(db, async (transaction) => {
    const wallet = await transaction.get(walletRef);
    if (!wallet.exists()) throw new Error("Your wallet is not ready yet.");
    const balance = wallet.data().balance ?? 0;
    if (balance < stake) throw new Error(`You need ${stake} credits to fund this match.`);

    transaction.set(roomRef, {
      whiteId,
      whiteName,
      whitePhotoUrl,
      blackId: "",
      blackName: "",
      blackPhotoUrl: "",
      invitedId: invitee?.id ?? "",
      invitedName: invitee?.name ?? "",
      fen: STARTING_FEN,
      moves: [],
      turn: "w",
      check: false,
      status: "waiting",
      result: "",
      winnerId: "",
      winnerName: "",
      endReason: "",
      creditBet: stake,
      timeControl,
      initialTimeMs,
      incrementMs,
      whiteTimeMs: initialTimeMs,
      blackTimeMs: initialTimeMs,
      turnStartedAt: 0,
      whitePayoutClaimed: false,
      blackPayoutClaimed: false,
      createdAt: Date.now(),
      startedAt: 0,
      finishedAt: 0,
    });
    if (stake > 0) transaction.update(walletRef, { balance: balance - stake });
  });

  return roomRef;
}

export async function joinChessDuel(roomId: string, userId: string, displayName: string, photoUrl: string) {
  await ensureWallet(userId);
  await runTransaction(db, async (transaction) => {
    const roomRef = doc(db, "chessDuels", roomId);
    const walletRef = doc(db, "wallets", userId);
    const [roomSnapshot, wallet] = await Promise.all([transaction.get(roomRef), transaction.get(walletRef)]);
    if (!roomSnapshot.exists()) throw new Error("That chess room no longer exists.");
    if (!wallet.exists()) throw new Error("Your wallet is not ready yet.");
    const room = roomSnapshot.data() as Omit<ChessDuel, "id">;
    if (room.status !== "waiting" || room.blackId) throw new Error("Someone already joined this match.");
    if (room.whiteId === userId) throw new Error("You cannot play against yourself.");
    if (room.invitedId && room.invitedId !== userId) throw new Error("This challenge is reserved for another player.");
    const balance = wallet.data().balance ?? 0;
    if (balance < room.creditBet) throw new Error(`You need ${room.creditBet} credits to join this match.`);

    transaction.update(roomRef, {
      blackId: userId,
      blackName: displayName,
      blackPhotoUrl: photoUrl,
      status: "active",
      startedAt: Date.now(),
      turnStartedAt: Date.now(),
    });
    if (room.creditBet > 0) transaction.update(walletRef, { balance: balance - room.creditBet });
  });
}

export async function cancelChessDuel(roomId: string, whiteId: string) {
  await runTransaction(db, async (transaction) => {
    const roomRef = doc(db, "chessDuels", roomId);
    const snapshot = await transaction.get(roomRef);
    if (!snapshot.exists()) return;
    const room = snapshot.data() as Omit<ChessDuel, "id">;
    if (room.whiteId !== whiteId || room.status !== "waiting") throw new Error("This match can no longer be cancelled.");
    transaction.update(roomRef, { status: "cancelled", endReason: "Cancelled", finishedAt: Date.now() });
  });
}

function drawReason(game: Chess) {
  if (game.isStalemate()) return "Stalemate";
  if (game.isInsufficientMaterial()) return "Insufficient material";
  if (game.isThreefoldRepetition()) return "Threefold repetition";
  if (game.isDrawByFiftyMoves()) return "Fifty-move rule";
  return "Draw";
}

export async function moveChessPiece(
  roomId: string,
  userId: string,
  from: string,
  to: string,
  promotion: "q" | "r" | "b" | "n" = "q",
) {
  await runTransaction(db, async (transaction) => {
    const roomRef = doc(db, "chessDuels", roomId);
    const snapshot = await transaction.get(roomRef);
    if (!snapshot.exists()) throw new Error("That chess room no longer exists.");
    const room = snapshot.data() as Omit<ChessDuel, "id">;
    if (room.status !== "active") throw new Error("This match is not active.");
    const myColor = room.whiteId === userId ? "w" : room.blackId === userId ? "b" : null;
    if (!myColor) throw new Error("Spectators cannot move pieces.");
    if (room.turn !== myColor) throw new Error("Wait for your opponent's move.");

    const movedAt = Date.now();
    const clockEnabled = !!room.timeControl && typeof room.whiteTimeMs === "number" && typeof room.blackTimeMs === "number";
    const activeTime = myColor === "w" ? room.whiteTimeMs : room.blackTimeMs;
    const elapsed = clockEnabled ? Math.max(0, movedAt - (room.turnStartedAt || movedAt)) : 0;
    const timeBeforeIncrement = clockEnabled ? Math.max(0, (activeTime ?? 0) - elapsed) : 0;
    if (clockEnabled && timeBeforeIncrement <= 0) {
      const whiteWon = myColor === "b";
      transaction.update(roomRef, {
        [myColor === "w" ? "whiteTimeMs" : "blackTimeMs"]: 0,
        status: "finished",
        result: whiteWon ? "white" : "black",
        winnerId: whiteWon ? room.whiteId : room.blackId,
        winnerName: whiteWon ? room.whiteName : room.blackName,
        endReason: "Timeout",
        finishedAt: movedAt,
      });
      return;
    }

    const game = new Chess(room.fen);
    let move;
    try {
      move = game.move({ from: from as Square, to: to as Square, promotion });
    } catch {
      throw new Error("That move is not legal.");
    }
    if (!move) throw new Error("That move is not legal.");

    const entry: ChessDuelMove = { from, to, promotion, san: move.san, byId: userId, createdAt: Date.now() };
    const update: Record<string, unknown> = {
      fen: game.fen(),
      moves: [...room.moves, entry],
      turn: game.turn(),
      check: game.isCheck(),
    };
    if (clockEnabled) {
      update[myColor === "w" ? "whiteTimeMs" : "blackTimeMs"] = timeBeforeIncrement + (room.incrementMs ?? 0);
      update.turnStartedAt = movedAt;
    }

    if (game.isCheckmate()) {
      const whiteWon = myColor === "w";
      update.status = "finished";
      update.result = whiteWon ? "white" : "black";
      update.winnerId = userId;
      update.winnerName = whiteWon ? room.whiteName : room.blackName;
      update.endReason = "Checkmate";
      update.finishedAt = Date.now();
    } else if (game.isDraw()) {
      update.status = "finished";
      update.result = "draw";
      update.winnerId = "";
      update.winnerName = "";
      update.endReason = drawReason(game);
      update.finishedAt = Date.now();
    }

    transaction.update(roomRef, update);
  });
}

export async function expireChessClock(roomId: string) {
  return runTransaction(db, async (transaction) => {
    const roomRef = doc(db, "chessDuels", roomId);
    const snapshot = await transaction.get(roomRef);
    if (!snapshot.exists()) return false;
    const room = snapshot.data() as Omit<ChessDuel, "id">;
    if (room.status !== "active" || !room.timeControl || !room.turnStartedAt) return false;
    const now = Date.now();
    const activeTime = room.turn === "w" ? room.whiteTimeMs : room.blackTimeMs;
    if (typeof activeTime !== "number" || now - room.turnStartedAt < activeTime) return false;
    const whiteWon = room.turn === "b";
    transaction.update(roomRef, {
      [room.turn === "w" ? "whiteTimeMs" : "blackTimeMs"]: 0,
      status: "finished",
      result: whiteWon ? "white" : "black",
      winnerId: whiteWon ? room.whiteId : room.blackId,
      winnerName: whiteWon ? room.whiteName : room.blackName,
      endReason: "Timeout",
      finishedAt: now,
    });
    return true;
  });
}

export async function resignChessDuel(roomId: string, userId: string) {
  await runTransaction(db, async (transaction) => {
    const roomRef = doc(db, "chessDuels", roomId);
    const snapshot = await transaction.get(roomRef);
    if (!snapshot.exists()) return;
    const room = snapshot.data() as Omit<ChessDuel, "id">;
    if (room.status !== "active") throw new Error("This match is no longer active.");
    const isWhite = room.whiteId === userId;
    const isBlack = room.blackId === userId;
    if (!isWhite && !isBlack) throw new Error("Spectators cannot resign a match.");
    transaction.update(roomRef, {
      status: "finished",
      result: isWhite ? "black" : "white",
      winnerId: isWhite ? room.blackId : room.whiteId,
      winnerName: isWhite ? room.blackName : room.whiteName,
      endReason: `${isWhite ? room.whiteName : room.blackName} resigned`,
      finishedAt: Date.now(),
    });
  });
}

export async function voidChessDuel(roomId: string, userId: string) {
  await runTransaction(db, async (transaction) => {
    const roomRef = doc(db, "chessDuels", roomId);
    const snapshot = await transaction.get(roomRef);
    if (!snapshot.exists()) return;
    const room = snapshot.data() as Omit<ChessDuel, "id">;
    if (room.status !== "active") throw new Error("This match is no longer active.");
    if (room.whiteId !== userId && room.blackId !== userId) throw new Error("Only a player can void this match.");
    if (room.moves.length > 2) throw new Error("A match can only be voided before move two is complete.");
    transaction.update(roomRef, {
      status: "finished",
      result: "draw",
      winnerId: "",
      winnerName: "",
      endReason: "Game voided",
      finishedAt: Date.now(),
    });
  });
}

export async function claimChessPayout(roomId: string, userId: string) {
  await ensureWallet(userId);
  return runTransaction(db, async (transaction) => {
    const roomRef = doc(db, "chessDuels", roomId);
    const walletRef = doc(db, "wallets", userId);
    const [roomSnapshot, walletSnapshot] = await Promise.all([transaction.get(roomRef), transaction.get(walletRef)]);
    if (!roomSnapshot.exists() || !walletSnapshot.exists()) return 0;
    const room = roomSnapshot.data() as Omit<ChessDuel, "id">;
    if (room.creditBet <= 0 || (room.status !== "finished" && room.status !== "cancelled")) return 0;

    const isWhite = room.whiteId === userId;
    const isBlack = room.blackId === userId;
    if (!isWhite && !isBlack) return 0;
    if ((isWhite && room.whitePayoutClaimed) || (isBlack && room.blackPayoutClaimed)) return 0;
    const myResult: ChessResult = isWhite ? "white" : "black";
    const refund = (room.status === "cancelled" && isWhite) || room.result === "draw";
    const amount = refund ? room.creditBet : room.result === myResult ? room.creditBet * 2 : 0;
    if (amount <= 0) return 0;

    transaction.update(walletRef, {
      balance: (walletSnapshot.data().balance ?? 0) + amount,
      lastChessPayoutId: roomId,
    });
    transaction.update(roomRef, { [isWhite ? "whitePayoutClaimed" : "blackPayoutClaimed"]: true });
    return amount;
  });
}

export function subscribeToChessSpectators(roomId: string, callback: (spectators: WordleSpectator[]) => void) {
  return onSnapshot(collection(db, "chessDuels", roomId, "spectators"), (snapshot) => {
    callback(snapshot.docs.map((item) => ({ id: item.id, ...item.data() }) as WordleSpectator));
  });
}

export function enterChessSpectatorRoom(roomId: string, userId: string, displayName: string, photoUrl: string) {
  const ref = doc(db, "chessDuels", roomId, "spectators", userId);
  const touch = () => setDoc(ref, { displayName, photoUrl, lastSeenAt: Date.now() });
  void touch();
  const interval = window.setInterval(() => void touch(), 25_000);
  return () => {
    window.clearInterval(interval);
    void deleteDoc(ref);
  };
}

export function subscribeToChessMessages(roomId: string, callback: (messages: ChessRoomMessage[]) => void) {
  const messagesQuery = query(collection(db, "chessDuels", roomId, "messages"), orderBy("createdAt", "asc"), limit(80));
  return onSnapshot(messagesQuery, (snapshot) => {
    callback(snapshot.docs.map((item) => ({ id: item.id, ...item.data() }) as ChessRoomMessage));
  });
}

export function sendChessMessage(roomId: string, authorId: string, authorName: string, authorPhotoUrl: string, rawText: string) {
  const text = rawText.trim().slice(0, 300);
  if (!text) throw new Error("Write a message first.");
  return addDoc(collection(db, "chessDuels", roomId, "messages"), {
    authorId,
    authorName,
    authorPhotoUrl,
    text,
    createdAt: Date.now(),
  });
}
