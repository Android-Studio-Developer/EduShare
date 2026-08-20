import { addDoc, collection, doc, getDoc, onSnapshot, query, updateDoc, where, writeBatch } from "firebase/firestore";
import { db } from "./firebase";
import type { Duel } from "../types";

function duelsRef() {
  return collection(db, "duels");
}

export function createDuel(challengerId: string, challengerName: string, opponentId: string, opponentName: string, game: string, bet: number) {
  return addDoc(duelsRef(), {
    challengerId,
    challengerName,
    opponentId,
    opponentName,
    game,
    bet,
    status: "pending",
    winnerId: "",
    winnerName: "",
    loserId: "",
    loserName: "",
    createdAt: Date.now(),
    resolvedAt: 0,
    challengerHandled: false,
    opponentHandled: false,
  });
}

// The opponent's own bet payout has to land in the SAME write as the
// status transition — Firestore rules only let the opponent touch a duel
// doc once (pending → resolved), and only as this exact combined write. So
// unlike the challenger's separate claimDuelReward step, resolving a duel
// and crediting/debiting the opponent's own wallet must happen atomically here.
export async function resolveDuel(duelId: string, opponentId: string, winnerId: string, winnerName: string, loserId: string, loserName: string, xpDelta: number, creditsDelta: number) {
  const profileRef = doc(db, "profiles", opponentId);
  const walletRef = doc(db, "wallets", opponentId);
  const duelRef = doc(db, "duels", duelId);
  const [profileSnap, walletSnap] = await Promise.all([getDoc(profileRef), getDoc(walletRef)]);
  const currentXp = profileSnap.data()?.botXp ?? 0;
  const currentBalance = walletSnap.data()?.balance ?? 0;
  const clampedXpDelta = Math.max(-25, Math.min(25, xpDelta));
  const nextXp = Math.max(0, currentXp + clampedXpDelta);
  const nextBalance = Math.max(0, currentBalance + creditsDelta);

  const batch = writeBatch(db);
  batch.update(duelRef, {
    status: "resolved",
    winnerId,
    winnerName,
    loserId,
    loserName,
    resolvedAt: Date.now(),
    opponentHandled: true,
  });
  batch.update(profileRef, { botXp: nextXp, lastGameAt: Date.now() });
  if (creditsDelta !== 0) batch.update(walletRef, { balance: nextBalance });
  await batch.commit();
}

export function declineDuel(duelId: string) {
  return updateDoc(doc(db, "duels", duelId), { status: "declined", opponentHandled: true });
}

// Batches the challenger's XP grant, credits payout, and the challengerHandled
// flag flip into one commit — rules require the wallet's balance increase to
// land in the same batch as a profiles.lastGameAt bump, and this keeps the
// whole claim atomic so it can never be replayed for the same duel.
export async function claimDuelReward(duelId: string, userId: string, xpDelta: number, creditsDelta: number) {
  const profileRef = doc(db, "profiles", userId);
  const walletRef = doc(db, "wallets", userId);
  const duelRef = doc(db, "duels", duelId);
  const [profileSnap, walletSnap] = await Promise.all([getDoc(profileRef), getDoc(walletRef)]);
  const currentXp = profileSnap.data()?.botXp ?? 0;
  const currentBalance = walletSnap.data()?.balance ?? 0;
  const clampedXpDelta = Math.max(-25, Math.min(25, xpDelta));
  const nextXp = Math.max(0, currentXp + clampedXpDelta);
  const nextBalance = Math.max(0, currentBalance + creditsDelta);

  const batch = writeBatch(db);
  batch.update(profileRef, { botXp: nextXp, lastGameAt: Date.now() });
  if (creditsDelta !== 0) batch.update(walletRef, { balance: nextBalance });
  batch.update(duelRef, { challengerHandled: true });
  await batch.commit();
}

export function subscribeToMyDuels(myUid: string, callback: (asChallenger: Duel[], asOpponent: Duel[]) => void) {
  let asChallenger: Duel[] = [];
  let asOpponent: Duel[] = [];
  const unsub1 = onSnapshot(query(duelsRef(), where("challengerId", "==", myUid)), (snap) => {
    asChallenger = snap.docs.map((d) => ({ id: d.id, ...d.data() }) as Duel);
    callback(asChallenger, asOpponent);
  });
  const unsub2 = onSnapshot(query(duelsRef(), where("opponentId", "==", myUid)), (snap) => {
    asOpponent = snap.docs.map((d) => ({ id: d.id, ...d.data() }) as Duel);
    callback(asChallenger, asOpponent);
  });
  return () => {
    unsub1();
    unsub2();
  };
}
