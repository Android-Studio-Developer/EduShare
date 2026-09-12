import { addDoc, collection, doc, getDocs, onSnapshot, orderBy, query, runTransaction, updateDoc, where, writeBatch } from "firebase/firestore";
import { db } from "./firebase";
import { isPromoCode } from "./ranks";
import type { AdvertiserRequest } from "../types";

export const REFERRALS_REQUIRED = 3;
export const REFERRAL_REWARD = 530;

export async function referredCount(userId: string) {
  const snap = await getDocs(query(collection(db, "profiles"), where("referredBy", "==", userId)));
  return snap.size;
}

export async function submitAdvertiserRequest(userId: string, userName: string, message: string) {
  const count = await referredCount(userId);
  if (count < REFERRALS_REQUIRED) throw new Error(`You need ${REFERRALS_REQUIRED} referred accounts registered first (you have ${count}).`);
  const existing = await getDocs(query(collection(db, "advertiserRequests"), where("userId", "==", userId), where("status", "==", "open")));
  if (!existing.empty) throw new Error("You already have a pending advertiser request.");
  return addDoc(collection(db, "advertiserRequests"), {
    userId,
    userName,
    message: message.trim().slice(0, 500),
    status: "open",
    createdAt: Date.now(),
  });
}

export function subscribeToMyAdvertiserRequests(userId: string, callback: (requests: AdvertiserRequest[]) => void) {
  const q = query(collection(db, "advertiserRequests"), where("userId", "==", userId));
  return onSnapshot(q, (snap) => callback(snap.docs.map((d) => ({ id: d.id, ...d.data() }) as AdvertiserRequest)));
}

export function subscribeToAdvertiserRequests(callback: (requests: AdvertiserRequest[]) => void) {
  const q = query(collection(db, "advertiserRequests"), orderBy("createdAt", "desc"));
  return onSnapshot(q, (snap) => callback(snap.docs.map((d) => ({ id: d.id, ...d.data() }) as AdvertiserRequest)));
}

export function declineAdvertiserRequest(id: string) {
  return updateDoc(doc(db, "advertiserRequests", id), { status: "declined" });
}

// Grants the inviter the Advertiser rank and queues a 530-credit reward on
// their 3 most recently referred accounts — those users see a popup on next
// login and claim it themselves (see claimReferralReward), rather than the
// credits landing silently in their wallet.
export async function acceptAdvertiserRequest(request: AdvertiserRequest) {
  const referredSnap = await getDocs(query(collection(db, "profiles"), where("referredBy", "==", request.userId)));
  const rewardIds = referredSnap.docs.slice(0, REFERRALS_REQUIRED).map((d) => d.id);
  const batch = writeBatch(db);
  batch.update(doc(db, "advertiserRequests", request.id), { status: "accepted" });
  batch.update(doc(db, "profiles", request.userId), { rank: "advertiser" });
  rewardIds.forEach((id) => batch.update(doc(db, "profiles", id), { referralRewardPending: REFERRAL_REWARD }));
  await batch.commit();
}

export async function claimReferralReward(userId: string, code: string) {
  if (!isPromoCode(code)) throw new Error("Type HYPNO to claim it.");
  const profileRef = doc(db, "profiles", userId);
  const walletRef = doc(db, "wallets", userId);
  await runTransaction(db, async (transaction) => {
    const [profile, wallet] = await Promise.all([transaction.get(profileRef), transaction.get(walletRef)]);
    const pending = profile.data()?.referralRewardPending ?? 0;
    if (pending <= 0) throw new Error("Nothing to claim.");
    transaction.update(profileRef, { referralRewardPending: 0 });
    transaction.update(walletRef, { balance: (wallet.data()?.balance ?? 0) + pending });
  });
}

export async function getReferredProfiles(userId: string) {
  const snap = await getDocs(query(collection(db, "profiles"), where("referredBy", "==", userId)));
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}
