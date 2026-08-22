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
import { evaluateWordleGuess, pickWordleWord, WORDLE_MAX_GUESSES } from "./minigames";
import type { WordleDuel, WordleDuelGuess, WordleSpectator } from "../types";

function roomsRef() {
  return collection(db, "wordleDuels");
}

export function subscribeToWordleDuels(callback: (rooms: WordleDuel[]) => void) {
  return onSnapshot(query(roomsRef(), orderBy("createdAt", "desc"), limit(40)), (snapshot) => {
    callback(snapshot.docs.map((item) => ({ id: item.id, ...item.data() }) as WordleDuel));
  });
}

export function createWordleDuel(
  hostId: string,
  hostName: string,
  hostPhotoUrl: string,
  invitee?: { id: string; name: string } | null,
) {
  return addDoc(roomsRef(), {
    hostId,
    hostName,
    hostPhotoUrl,
    guestId: "",
    guestName: "",
    guestPhotoUrl: "",
    invitedId: invitee?.id ?? "",
    invitedName: invitee?.name ?? "",
    answer: pickWordleWord(),
    hostGuesses: [],
    guestGuesses: [],
    status: "waiting",
    winnerId: "",
    winnerName: "",
    createdAt: Date.now(),
    startedAt: 0,
    finishedAt: 0,
  });
}

export async function joinWordleDuel(roomId: string, userId: string, displayName: string, photoUrl: string) {
  await runTransaction(db, async (transaction) => {
    const ref = doc(db, "wordleDuels", roomId);
    const snapshot = await transaction.get(ref);
    if (!snapshot.exists()) throw new Error("That duel no longer exists.");
    const room = snapshot.data() as Omit<WordleDuel, "id">;
    if (room.status !== "waiting" || room.guestId) throw new Error("Someone already joined this duel.");
    if (room.hostId === userId) throw new Error("You cannot duel yourself.");
    if (room.invitedId && room.invitedId !== userId) throw new Error("This challenge is for another player.");
    transaction.update(ref, {
      guestId: userId,
      guestName: displayName,
      guestPhotoUrl: photoUrl,
      status: "active",
      startedAt: Date.now(),
    });
  });
}

export async function cancelWordleDuel(roomId: string, hostId: string) {
  await runTransaction(db, async (transaction) => {
    const ref = doc(db, "wordleDuels", roomId);
    const snapshot = await transaction.get(ref);
    if (!snapshot.exists()) return;
    const room = snapshot.data() as Omit<WordleDuel, "id">;
    if (room.hostId !== hostId || room.status !== "waiting") throw new Error("This challenge can no longer be cancelled.");
    transaction.update(ref, { status: "cancelled", finishedAt: Date.now() });
  });
}

export async function submitWordleDuelGuess(roomId: string, userId: string, rawGuess: string) {
  const guess = rawGuess.trim().toUpperCase();
  if (!/^[A-Z]{5}$/.test(guess)) throw new Error("Enter exactly five letters.");

  await runTransaction(db, async (transaction) => {
    const ref = doc(db, "wordleDuels", roomId);
    const snapshot = await transaction.get(ref);
    if (!snapshot.exists()) throw new Error("That duel no longer exists.");
    const room = snapshot.data() as Omit<WordleDuel, "id">;
    if (room.status !== "active") throw new Error("This duel is not active.");

    const isHost = room.hostId === userId;
    const isGuest = room.guestId === userId;
    if (!isHost && !isGuest) throw new Error("Spectators cannot submit guesses.");

    const myGuesses = isHost ? room.hostGuesses : room.guestGuesses;
    const otherGuesses = isHost ? room.guestGuesses : room.hostGuesses;
    if (myGuesses.length >= WORDLE_MAX_GUESSES) throw new Error("You are out of guesses—watch the other player finish.");

    const evaluation = evaluateWordleGuess(guess, room.answer);
    const entry: WordleDuelGuess = { word: guess, pattern: evaluation.pattern, createdAt: Date.now() };
    const nextGuesses = [...myGuesses, entry];
    const update: Record<string, unknown> = {
      [isHost ? "hostGuesses" : "guestGuesses"]: nextGuesses,
    };

    if (evaluation.exact) {
      update.status = "finished";
      update.winnerId = userId;
      update.winnerName = isHost ? room.hostName : room.guestName;
      update.finishedAt = Date.now();
    } else if (nextGuesses.length >= WORDLE_MAX_GUESSES && otherGuesses.length >= WORDLE_MAX_GUESSES) {
      update.status = "finished";
      update.winnerId = "";
      update.winnerName = "";
      update.finishedAt = Date.now();
    }

    transaction.update(ref, update);
  });
}

export function subscribeToWordleSpectators(roomId: string, callback: (spectators: WordleSpectator[]) => void) {
  return onSnapshot(collection(db, "wordleDuels", roomId, "spectators"), (snapshot) => {
    callback(snapshot.docs.map((item) => ({ id: item.id, ...item.data() }) as WordleSpectator));
  });
}

export function enterWordleSpectatorRoom(roomId: string, userId: string, displayName: string, photoUrl: string) {
  const ref = doc(db, "wordleDuels", roomId, "spectators", userId);
  const touch = () => setDoc(ref, { displayName, photoUrl, lastSeenAt: Date.now() });
  void touch();
  const interval = window.setInterval(() => void touch(), 25_000);
  return () => {
    window.clearInterval(interval);
    void deleteDoc(ref);
  };
}
