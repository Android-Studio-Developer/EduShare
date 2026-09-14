import { doc, onSnapshot, runTransaction } from "firebase/firestore";
import { db } from "./firebase";
import type { TurboSubscription } from "../types";

export const TURBO_MONTHLY_COST = 200;
export const TURBO_MONTH_MS = 30 * 24 * 60 * 60 * 1000;

export function isTurboActive(subscription: TurboSubscription | null | undefined) {
  return Number(subscription?.expiresAt ?? 0) > Date.now();
}

export function subscribeToTurbo(userId: string, callback: (subscription: TurboSubscription | null) => void) {
  return onSnapshot(doc(db, "turboSubscriptions", userId), (snapshot) => {
    callback(snapshot.exists() ? ({ id: snapshot.id, ...snapshot.data() } as TurboSubscription) : null);
  });
}

export async function purchaseTurbo(userId: string) {
  const walletRef = doc(db, "wallets", userId);
  const turboRef = doc(db, "turboSubscriptions", userId);
  await runTransaction(db, async (transaction) => {
    const [wallet, turbo] = await Promise.all([transaction.get(walletRef), transaction.get(turboRef)]);
    const balance = Number(wallet.data()?.balance ?? 0);
    if (balance < TURBO_MONTHLY_COST) throw new Error(`You need ${TURBO_MONTHLY_COST} credits for Turbo.`);
    const now = Date.now();
    const currentExpiry = Number(turbo.data()?.expiresAt ?? 0);
    transaction.update(walletRef, { balance: balance - TURBO_MONTHLY_COST });
    transaction.set(turboRef, {
      userId,
      purchasedAt: now,
      expiresAt: Math.max(now, currentExpiry) + TURBO_MONTH_MS,
    });
  });
}
