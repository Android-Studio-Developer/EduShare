import { addDoc, collection, deleteDoc, doc, increment, onSnapshot, orderBy, query, runTransaction, updateDoc } from "firebase/firestore";
import { db } from "./firebase";
import type { SharedFile, ShareType } from "../types";

export const SHARE_PRICE = 150;
export const SHARE_DISCOUNT_CODE = "HYPNO";
export const SHARE_DISCOUNT_RATE = 0.3;

export function isHttpsUrl(url: string) {
  return url.startsWith("https://");
}

export function priceWithCode(price: number, code: string) {
  return code.trim().toUpperCase() === SHARE_DISCOUNT_CODE ? Math.round(price * (1 - SHARE_DISCOUNT_RATE)) : price;
}

export function subscribeToShares(callback: (shares: SharedFile[]) => void) {
  const q = query(collection(db, "shares"), orderBy("createdAt", "desc"));
  return onSnapshot(q, (snapshot) => {
    callback(snapshot.docs.map((d) => ({ id: d.id, ...d.data() }) as SharedFile));
  });
}

export function createShare(data: {
  name: string;
  description: string;
  type: ShareType;
  downloadUrl: string;
  imageUrl: string;
  authorId: string;
  authorName: string;
  price: number;
}) {
  if (!isHttpsUrl(data.downloadUrl)) throw new Error("Download link must be a valid https:// URL.");
  const price = Math.round(Math.min(100000, Math.max(0, data.price)));
  return addDoc(collection(db, "shares"), { ...data, price, downloadCount: 0, createdAt: Date.now() });
}

export function recordDownload(shareId: string) {
  return updateDoc(doc(db, "shares", shareId), { downloadCount: increment(1) });
}

export async function purchaseShare(userId: string, chargedAmount: number) {
  const walletRef = doc(db, "wallets", userId);
  await runTransaction(db, async (transaction) => {
    const wallet = await transaction.get(walletRef);
    const balance = wallet.data()?.balance ?? 0;
    if (balance < chargedAmount) throw new Error("You do not have enough SpawnDex Credits.");
    transaction.update(walletRef, { balance: balance - chargedAmount });
  });
}

export function deleteShare(shareId: string) {
  return deleteDoc(doc(db, "shares", shareId));
}
