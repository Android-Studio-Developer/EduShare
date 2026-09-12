import { doc, getDoc, runTransaction, updateDoc } from "firebase/firestore";
import type { CSSProperties } from "react";
import { db } from "./firebase";
import { discountedCost } from "./ranks";

export type CosmeticCategory = "font" | "nameEffect" | "nameplateEffect" | "pfpEffect" | "profileEffect";

export interface CosmeticItem {
  id: string;
  label: string;
  category: CosmeticCategory;
  cost: number;
  cssFontFamily?: string;
  tier?: "basic" | "advanced" | "exclusive";
}

export const NAME_FONTS: CosmeticItem[] = [
  { id: "font-poppins", label: "Poppins", category: "font", cost: 15, cssFontFamily: "'Poppins', sans-serif" },
  { id: "font-playfair", label: "Playfair", category: "font", cost: 15, cssFontFamily: "'Playfair Display', serif" },
  { id: "font-comic", label: "Comic", category: "font", cost: 15, cssFontFamily: "'Comic Neue', cursive" },
  { id: "font-caveat", label: "Handwritten", category: "font", cost: 20, cssFontFamily: "'Caveat', cursive" },
  { id: "font-bungee", label: "Bungee", category: "font", cost: 25, cssFontFamily: "'Bungee', cursive" },
  { id: "font-pixel", label: "Pixel", category: "font", cost: 30, cssFontFamily: "'Press Start 2P', monospace" },
];

export const NAME_EFFECTS: CosmeticItem[] = [
  { id: "effect-gradient", label: "Gradient", category: "nameEffect", cost: 20 },
  { id: "effect-neon", label: "Neon", category: "nameEffect", cost: 25 },
  { id: "effect-comic", label: "Comic", category: "nameEffect", cost: 20 },
  { id: "effect-pop", label: "Pop", category: "nameEffect", cost: 15 },
  { id: "effect-jelly", label: "Jelly", category: "nameEffect", cost: 20 },
  { id: "effect-prism", label: "Prism", category: "nameEffect", cost: 30 },
];

export const PFP_EFFECTS: CosmeticItem[] = [
  { id: "pfp-glow", label: "Glow Ring", category: "pfpEffect", cost: 20 },
  { id: "pfp-pulse", label: "Pulse Ring", category: "pfpEffect", cost: 20 },
  { id: "pfp-spin", label: "Spin Ring", category: "pfpEffect", cost: 25 },
  { id: "pfp-rotate", label: "Rotating PFP", category: "pfpEffect", cost: 30 },
];

export const NAMEPLATE_EFFECTS: CosmeticItem[] = [
  { id: "profile-exclusive-developer-nameplate", label: "Watching Eyes", category: "nameplateEffect", cost: 95, tier: "exclusive" },
  { id: "nameplate-brave-soul", label: "Brave Soul", category: "nameplateEffect", cost: 55 },
  { id: "nameplate-nevermore", label: "Nevermore", category: "nameplateEffect", cost: 55 },
  { id: "nameplate-white-roses", label: "Dark Rose · White", category: "nameplateEffect", cost: 55 },
  { id: "nameplate-crimson-curse", label: "Eternal Curse · Red", category: "nameplateEffect", cost: 60 },
  { id: "nameplate-black-roses", label: "Dark Rose · Black", category: "nameplateEffect", cost: 55 },
  { id: "nameplate-forest-whispers", label: "Forest Whispers", category: "nameplateEffect", cost: 55 },
  { id: "nameplate-azure-curse", label: "Eternal Curse · Blue", category: "nameplateEffect", cost: 60 },
  { id: "nameplate-nature-spark", label: "Nature's Spark", category: "nameplateEffect", cost: 55 },
  { id: "nameplate-crimson-vines", label: "Crimson Vines", category: "nameplateEffect", cost: 65 },
  { id: "nameplate-hellhound", label: "Hellhound", category: "nameplateEffect", cost: 60 },
  { id: "nameplate-starry-night", label: "Starry Night", category: "nameplateEffect", cost: 55 },
  { id: "nameplate-blooming-branch", label: "Blooming Branch", category: "nameplateEffect", cost: 55 },
  { id: "nameplate-spectral-array", label: "Spectral Array", category: "nameplateEffect", cost: 55 },
  { id: "nameplate-warm-summer", label: "Warm Summer", category: "nameplateEffect", cost: 55 },
  { id: "nameplate-water-spirit", label: "Water Spirit", category: "nameplateEffect", cost: 55 },
];

export const PROFILE_EFFECTS: CosmeticItem[] = [
  { id: "profile-basic-shimmer", label: "Shimmer", category: "profileEffect", cost: 20, tier: "basic" },
  { id: "profile-basic-glow", label: "Soft Glow", category: "profileEffect", cost: 18, tier: "basic" },
  { id: "profile-basic-scanline", label: "Scanline", category: "profileEffect", cost: 22, tier: "basic" },
  { id: "profile-basic-starlight", label: "Starlight", category: "profileEffect", cost: 24, tier: "basic" },
  { id: "profile-basic-frost", label: "Frost", category: "profileEffect", cost: 25, tier: "basic" },
  { id: "profile-basic-radar", label: "Radar", category: "profileEffect", cost: 23, tier: "basic" },
  { id: "profile-basic-sunset", label: "Sunset", category: "profileEffect", cost: 26, tier: "basic" },
  { id: "profile-basic-cherry-blossom", label: "Cherry Blossom", category: "profileEffect", cost: 28, tier: "basic" },
  { id: "profile-basic-northern-snow", label: "Northern Snow", category: "profileEffect", cost: 27, tier: "basic" },
  { id: "profile-advanced-aurora", label: "Aurora", category: "profileEffect", cost: 45, tier: "advanced" },
  { id: "profile-advanced-embers", label: "Embers", category: "profileEffect", cost: 48, tier: "advanced" },
  { id: "profile-advanced-cyber-grid", label: "Cyber Grid", category: "profileEffect", cost: 44, tier: "advanced" },
  { id: "profile-advanced-deep-space", label: "Deep Space", category: "profileEffect", cost: 52, tier: "advanced" },
  { id: "profile-advanced-lightning", label: "Lightning", category: "profileEffect", cost: 54, tier: "advanced" },
  { id: "profile-advanced-ocean", label: "Ocean Pulse", category: "profileEffect", cost: 46, tier: "advanced" },
  { id: "profile-advanced-hologram", label: "Hologram", category: "profileEffect", cost: 50, tier: "advanced" },
  { id: "profile-advanced-confetti", label: "Confetti", category: "profileEffect", cost: 42, tier: "advanced" },
  { id: "profile-advanced-void", label: "Void Rift", category: "profileEffect", cost: 56, tier: "advanced" },
  { id: "profile-advanced-thunderstorm", label: "Thunderstorm", category: "profileEffect", cost: 58, tier: "advanced" },
  { id: "profile-advanced-bed-fight", label: "Bed Fight", category: "profileEffect", cost: 58, tier: "advanced" },
  { id: "profile-advanced-black-hole", label: "Black Hole", category: "profileEffect", cost: 60, tier: "advanced" },
  { id: "profile-advanced-retro-glitch", label: "Retro Glitch", category: "profileEffect", cost: 49, tier: "advanced" },
  { id: "profile-advanced-music-visualizer", label: "Music Visualizer", category: "profileEffect", cost: 55, tier: "advanced" },
  { id: "profile-advanced-meteor-shower", label: "Meteor Shower", category: "profileEffect", cost: 53, tier: "advanced" },
  { id: "profile-advanced-moonlit-howl", label: "Moonlit Howl", category: "profileEffect", cost: 65, tier: "advanced" },
  { id: "profile-advanced-dream-orbit", label: "Dream Orbit", category: "profileEffect", cost: 68, tier: "advanced" },
  { id: "profile-advanced-silent-gaze", label: "Silent Gaze", category: "profileEffect", cost: 70, tier: "advanced" },
  { id: "profile-advanced-midnight-celebration", label: "Midnight Celebration", category: "profileEffect", cost: 62, tier: "advanced" },
  { id: "profile-advanced-infernal-rite", label: "Infernal Rite", category: "profileEffect", cost: 72, tier: "advanced" },
  { id: "profile-epic", label: "Epic", category: "profileEffect", cost: 51, tier: "advanced" },
  { id: "profile-evil-eye", label: "Evil Eye", category: "profileEffect", cost: 50, tier: "advanced" },
  { id: "profile-exclusive-bundle", label: "Exclusive Bundle", category: "profileEffect", cost: 120, tier: "exclusive" },
];

export const COSMETIC_BUNDLES: CosmeticItem[] = [
  { id: "bundle-wolf-moon", label: "Wolf Moon Bundle", category: "profileEffect", cost: 145, tier: "exclusive" },
];

export const ALL_COSMETICS: CosmeticItem[] = [...NAME_FONTS, ...NAME_EFFECTS, ...NAMEPLATE_EFFECTS, ...PFP_EFFECTS, ...PROFILE_EFFECTS, ...COSMETIC_BUNDLES];

export function cosmeticById(id: string): CosmeticItem | undefined {
  return ALL_COSMETICS.find((c) => c.id === id);
}

export async function purchaseCosmetic(userId: string, itemId: string, promoCode = "") {
  const item = cosmeticById(itemId);
  if (!item) throw new Error("Unknown item.");
  const cost = discountedCost(item.cost, promoCode);
  const walletRef = doc(db, "wallets", userId);
  const profileRef = doc(db, "profiles", userId);
  await runTransaction(db, async (transaction) => {
    const [wallet, profile] = await Promise.all([transaction.get(walletRef), transaction.get(profileRef)]);
    const owned: string[] = profile.data()?.ownedCosmetics ?? [];
    if (owned.includes(itemId)) throw new Error("You already own this.");
    const balance = wallet.data()?.balance ?? 0;
    if (balance < cost) throw new Error("Not enough SpawnDex Credits.");
    transaction.update(walletRef, { balance: balance - cost });
    transaction.update(profileRef, { ownedCosmetics: [...owned, itemId] });
  });
}

export async function purchaseAndEquipProfileEffect(userId: string, itemId: string, promoCode = "") {
  const item = cosmeticById(itemId);
  if (!item || item.category !== "profileEffect") throw new Error("Unknown profile effect.");
  const cost = discountedCost(item.cost, promoCode);
  const walletRef = doc(db, "wallets", userId);
  const profileRef = doc(db, "profiles", userId);
  await runTransaction(db, async (transaction) => {
    const [wallet, profile] = await Promise.all([transaction.get(walletRef), transaction.get(profileRef)]);
    const owned: string[] = profile.data()?.ownedCosmetics ?? [];
    if (owned.includes(itemId)) throw new Error("You already own this effect.");
    const balance = wallet.data()?.balance ?? 0;
    if (balance < cost) throw new Error("Not enough SpawnDex Credits.");
    transaction.update(walletRef, { balance: balance - cost });
    transaction.update(profileRef, { ownedCosmetics: [...owned, itemId], profileEffect: itemId });
  });
}

const CATEGORY_FIELD: Record<CosmeticCategory, "nameFont" | "nameEffect" | "nameplateEffect" | "pfpEffect" | "profileEffect"> = {
  font: "nameFont",
  nameEffect: "nameEffect",
  nameplateEffect: "nameplateEffect",
  pfpEffect: "pfpEffect",
  profileEffect: "profileEffect",
};

export async function equipCosmetic(userId: string, itemIdOrEmpty: string, category: CosmeticCategory) {
  const field = CATEGORY_FIELD[category];
  return updateDoc(doc(db, "profiles", userId), { [field]: itemIdOrEmpty });
}

export function equipWolfMoonBundle(userId: string) {
  return updateDoc(doc(db, "profiles", userId), {
    pfpEffect: "bundle-wolf-moon",
    nameplateEffect: "bundle-wolf-moon",
    profileEffect: "bundle-wolf-moon",
  });
}

const NAME_COLORS = ["", "#f472b6", "#818cf8", "#34d399", "#38bdf8", "#facc15", "#fb7185"];

export function setNameColor(userId: string, color: string) {
  if (!NAME_COLORS.includes(color)) throw new Error("Invalid color.");
  return updateDoc(doc(db, "profiles", userId), { nameColor: color });
}

export { NAME_COLORS };

export function nameStyle(profile: { nameFont?: string; nameEffect?: string; nameColor?: string } | null | undefined): { className: string; style: CSSProperties } {
  const font = NAME_FONTS.find((f) => f.id === profile?.nameFont);
  const effectClass = profile?.nameEffect ? `name-${profile.nameEffect}` : "";
  return {
    className: effectClass,
    style: {
      fontFamily: font?.cssFontFamily,
      color: !profile?.nameEffect && profile?.nameColor ? profile.nameColor : undefined,
    },
  };
}

export async function ownsCosmetic(userId: string, itemId: string) {
  const snap = await getDoc(doc(db, "profiles", userId));
  const owned: string[] = snap.data()?.ownedCosmetics ?? [];
  return owned.includes(itemId);
}
