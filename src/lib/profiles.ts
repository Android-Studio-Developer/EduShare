import { collection, deleteDoc, doc, getDoc, increment, onSnapshot, runTransaction, setDoc, updateDoc } from "firebase/firestore";
import { db } from "./firebase";
import { ensureWallet } from "./shop";
import { sendPublicMessage } from "./chat";
import type { UserProfile } from "../types";

export const ONLINE_WINDOW_MS = 90_000;

export function isOnline(profile: Pick<UserProfile, "lastActiveAt"> | null | undefined) {
  return !!profile && Date.now() - (profile.lastActiveAt ?? 0) < ONLINE_WINDOW_MS;
}

export async function ensureProfile(userId: string, displayName: string) {
  const ref = doc(db, "profiles", userId);
  const snapshot = await getDoc(ref);
  const cleanDisplayName = displayName.trim() || "Player";

  if (!snapshot.exists()) {
    await setDoc(ref, {
      displayName: cleanDisplayName,
      username: "",
      usernameLower: "",
      photoUrl: "",
      bannerUrl: "",
      bannerEffect: "",
      bio: "",
      favoriteGames: "",
      joinedAt: Date.now(),
      lastDailyClaim: 0,
      rank: "none",
      playMinutes: 0,
      banned: false,
      lastActiveAt: Date.now(),
      botXp: 0,
      lastGameAt: 0,
      lastActivityReward: 0,
      partyId: "",
      guildId: "",
    });

    void sendPublicMessage(
      userId,
      "eduBot",
      `${cleanDisplayName} just joined eduShare! Say hi`,
      "none",
      { isBot: true },
    );
    return;
  }

  // Repair profiles that were created during signup before Firebase Auth
  // finished saving the user's real display name.
  const currentName =
    typeof snapshot.data().displayName === "string"
      ? snapshot.data().displayName.trim()
      : "";

  if (
    cleanDisplayName &&
    cleanDisplayName.toLowerCase() !== "player" &&
    (!currentName || currentName.toLowerCase() === "player")
  ) {
    await updateDoc(ref, { displayName: cleanDisplayName });
  }
}
const PROFILE_DEFAULTS = { rank:"none" as const, playMinutes:0, banned:false, lastActiveAt:0, botXp:0, lastGameAt:0, bannerUrl:"", bannerEffect:"", favoriteGames:"", username:"", usernameLower:"", lastActivityReward:0, partyId:"", guildId:"" };
export function subscribeToProfile(userId: string, callback:(profile:UserProfile|null)=>void) { return onSnapshot(doc(db,"profiles",userId),(s)=>callback(s.exists()?({id:s.id,...PROFILE_DEFAULTS,...s.data()} as UserProfile):null)); }
export function subscribeToAllProfiles(callback:(profiles:UserProfile[])=>void) {
  return onSnapshot(collection(db,"profiles"),(snapshot)=>{
    callback(snapshot.docs.map((d)=>({id:d.id,...PROFILE_DEFAULTS,...d.data()}) as UserProfile).sort((a,b)=>b.joinedAt-a.joinedAt));
  });
}
export function updateProfileData(userId:string, data:Pick<UserProfile,"displayName"|"photoUrl"|"bio"|"bannerUrl"|"bannerEffect"|"favoriteGames">) { return updateDoc(doc(db,"profiles",userId),data); }
export function incrementPlayMinutes(userId:string) { return updateDoc(doc(db,"profiles",userId),{playMinutes:increment(1)}); }
export function heartbeat(userId:string) { return updateDoc(doc(db,"profiles",userId),{lastActiveAt:Date.now()}); }
export async function awardBotXp(userId:string, xp:number) {
  const ref = doc(db,"profiles",userId);
  return runTransaction(db, async (transaction) => {
    const snap = await transaction.get(ref);
    const current = snap.data()?.botXp ?? 0;
    const delta = Math.max(-25, Math.min(25, xp));
    const next = Math.max(0, current + delta);
    transaction.update(ref, { botXp: next, lastGameAt: Date.now() });
  });
}
export function deletePlayer(userId:string) { return Promise.all([deleteDoc(doc(db,"profiles",userId)),deleteDoc(doc(db,"wallets",userId)),deleteDoc(doc(db,"roles",userId))]); }
export function banPlayer(userId:string) { return updateDoc(doc(db,"profiles",userId),{banned:true}); }
export function unbanPlayer(userId:string) { return updateDoc(doc(db,"profiles",userId),{banned:false}); }
export async function claimDailyCredits(userId:string) {
  await ensureWallet(userId); const profileRef=doc(db,"profiles",userId); const walletRef=doc(db,"wallets",userId);
  return runTransaction(db,async(transaction)=>{ const [profile,wallet]=await Promise.all([transaction.get(profileRef),transaction.get(walletRef)]); const last=profile.data()?.lastDailyClaim??0; if(Date.now()-last<20*60*60*1000) throw new Error("Daily reward is not ready yet."); transaction.update(profileRef,{lastDailyClaim:Date.now()}); transaction.update(walletRef,{balance:(wallet.data()?.balance??0)+15}); return 15; });
}

const ACTIVITY_REWARD_INTERVAL_MS = 5 * 60 * 1000;
export async function awardActivityCredits(userId: string) {
  await ensureWallet(userId);
  const profileRef = doc(db, "profiles", userId);
  const walletRef = doc(db, "wallets", userId);
  return runTransaction(db, async (transaction) => {
    const [profile, wallet] = await Promise.all([transaction.get(profileRef), transaction.get(walletRef)]);
    const last = profile.data()?.lastActivityReward ?? 0;
    if (Date.now() - last < ACTIVITY_REWARD_INTERVAL_MS) return;
    transaction.update(profileRef, { lastActivityReward: Date.now() });
    transaction.update(walletRef, { balance: (wallet.data()?.balance ?? 0) + 8 });
  });
}
