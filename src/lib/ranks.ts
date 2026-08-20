import { doc, getDoc, runTransaction, updateDoc } from "firebase/firestore";
import { db } from "./firebase";
import type { Rank } from "../types";

export const RANK_ORDER: Rank[] = [
  "none",
  "vip",
  "vip_plus",
  "vip_plus_plus",
  "mvp_plus",
  "mvp_plus_plus",
  "mod",
  "admin",
  "owner",
];

export const RANK_LABEL: Record<Rank, string> = {
  none: "",
  vip: "VIP",
  vip_plus: "VIP+",
  vip_plus_plus: "VIP++",
  mvp_plus: "MVP+",
  mvp_plus_plus: "MVP++",
  mod: "MOD",
  admin: "ADMIN",
  owner: "OWNER",
  partner: "PARTNER",
};

export const RANK_COLOR: Record<Rank, string> = {
  none: "text-white/50",
  vip: "text-emerald-400",
  vip_plus: "text-cyan-400",
  vip_plus_plus: "text-sky-400",
  mvp_plus: "text-amber-300",
  mvp_plus_plus: "text-fuchsia-400",
  mod: "text-blue-400",
  admin: "text-red-400",
  owner: "text-yellow-300",
  partner: "text-violet-400",
};

// Name color for display purposes — same as RANK_COLOR except the top purchasable
// rank (MVP++) gets an animated chroma gradient instead of a flat color.
export function rankNameClass(rank: Rank | undefined | null): string {
  if (rank === "mvp_plus_plus") return "text-chroma";
  return RANK_COLOR[rank ?? "none"];
}

export const PURCHASABLE_RANKS: Rank[] = ["vip", "vip_plus", "vip_plus_plus", "mvp_plus", "mvp_plus_plus"];
export const STAFF_RANKS: Rank[] = ["mod", "admin", "owner"];

export const RANK_CREDIT_COST: Partial<Record<Rank, number>> = {
  vip: 150,
  vip_plus: 400,
  vip_plus_plus: 800,
  mvp_plus: 1500,
  mvp_plus_plus: 3000,
};

// level = floor(playMinutes / 5) — every 5 minutes on site = 1 level.
export const RANK_LEVEL_REQUIRED: Partial<Record<Rank, number>> = {
  vip: 5,
  vip_plus: 15,
  vip_plus_plus: 30,
  mvp_plus: 50,
  mvp_plus_plus: 80,
};

export const RANK_PERKS: Partial<Record<Rank, string[]>> = {
  vip: ["Green name color in chat", "[VIP] chat badge"],
  vip_plus: ["Cyan name color", "[VIP+] chat badge", "Custom chat message color"],
  vip_plus_plus: ["Sky-blue name color", "[VIP++] chat badge", "Animated profile banner effects"],
  mvp_plus: ["Gold name color", "[MVP+] chat badge", "Animated badge glow"],
  mvp_plus_plus: ["Gradient name color", "[MVP++] chat badge", "Exclusive profile frame"],
};

export function rankTier(rank: Rank | undefined | null): number {
  return RANK_ORDER.indexOf(rank ?? "none");
}

export function canUseBannerEffects(rank: Rank | undefined | null): boolean {
  return rankTier(rank) >= rankTier("vip_plus_plus");
}

export interface BannerEffectDef {
  id: string;
  label: string;
}

export const BANNER_EFFECTS: BannerEffectDef[] = [
  { id: "aurora-glow", label: "Aurora Glow" },
  { id: "mesh-gradient", label: "Mesh Gradient" },
  { id: "particle-field", label: "Particle Field" },
  { id: "light-sweep", label: "Glass Sweep" },
  { id: "cyber-grid", label: "Cyber Grid" },
  { id: "liquid-waves", label: "Liquid Waves" },
  { id: "starfield", label: "Starfield" },
  { id: "spotlight", label: "Spotlight" },
  { id: "waveform", label: "Waveform" },
  { id: "holographic", label: "Holographic" },
  { id: "letter-glitch", label: "Letter Glitch" },
  { id: "snow", label: "Snow" },
];

export function minutesToLevel(minutes: number | undefined | null): number {
  return Math.floor((minutes ?? 0) / 5);
}

export function levelForNextRank(currentRank: Rank): { rank: Rank; level: number } | null {
  const currentTier = rankTier(currentRank);
  for (const rank of PURCHASABLE_RANKS) {
    if (rankTier(rank) > currentTier) {
      return { rank, level: RANK_LEVEL_REQUIRED[rank] ?? 0 };
    }
  }
  return null;
}

export async function purchaseRank(userId: string, rank: Rank) {
  const cost = RANK_CREDIT_COST[rank];
  if (!cost) throw new Error("This rank is not purchasable.");
  const walletRef = doc(db, "wallets", userId);
  const profileRef = doc(db, "profiles", userId);
  await runTransaction(db, async (transaction) => {
    const [wallet, profile] = await Promise.all([transaction.get(walletRef), transaction.get(profileRef)]);
    const balance = wallet.data()?.balance ?? 0;
    if (balance < cost) throw new Error("Not enough eduShare Credits.");
    const currentRank = (profile.data()?.rank ?? "none") as Rank;
    if (rankTier(rank) <= rankTier(currentRank)) throw new Error("You already have this rank or higher.");
    transaction.update(walletRef, { balance: balance - cost });
    transaction.update(profileRef, { rank });
  });
}

export async function claimRankByLevel(userId: string, rank: Rank) {
  const required = RANK_LEVEL_REQUIRED[rank];
  if (!required) throw new Error("This rank cannot be claimed by level.");
  const profileRef = doc(db, "profiles", userId);
  const snapshot = await getDoc(profileRef);
  const data = snapshot.data();
  const currentRank = (data?.rank ?? "none") as Rank;
  if (rankTier(rank) <= rankTier(currentRank)) throw new Error("You already have this rank or higher.");
  const level = minutesToLevel(data?.playMinutes ?? 0);
  if (level < required) throw new Error(`Reach level ${required} first (currently level ${level}).`);
  await updateDoc(profileRef, { rank });
}

export function grantRank(userId: string, rank: Rank) {
  return updateDoc(doc(db, "profiles", userId), { rank });
}

export function revokeRank(userId: string) {
  return updateDoc(doc(db, "profiles", userId), { rank: "none" as Rank });
}
