import { arcadeLevel } from "./minigames";
import type { UserProfile } from "../types";

// Anyone who joined before this feature shipped counts as a founding member.
const FOUNDER_CUTOFF = Date.parse("2026-08-19T00:00:00Z");

export interface Badge {
  id: string;
  label: string;
}

export function computeBadges(profile: Pick<UserProfile, "rank" | "joinedAt" | "botXp" | "partyId" | "guildId">): Badge[] {
  const badges: Badge[] = [];
  if (profile.rank === "owner") badges.push({ id: "owner", label: "Owner" });
  else if (profile.rank === "admin") badges.push({ id: "admin", label: "Admin" });
  else if (profile.rank === "mod") badges.push({ id: "mod", label: "Moderator" });

  if (profile.rank === "mvp_plus_plus") badges.push({ id: "mvp", label: "MVP++" });
  if (profile.joinedAt && profile.joinedAt < FOUNDER_CUTOFF) badges.push({ id: "founder", label: "Founding member" });
  if (arcadeLevel(profile.botXp ?? 0) >= 10) badges.push({ id: "champion", label: "Arcade Champion" });
  if (profile.guildId) badges.push({ id: "guild", label: "Guild member" });
  if (profile.partyId) badges.push({ id: "party", label: "In a party" });
  return badges;
}
