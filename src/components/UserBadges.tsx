import { Castle, Crown, Shield, ShieldCheck, Sparkles, Star, Trophy, Users, type LucideIcon } from "lucide-react";
import { computeBadges } from "../lib/badges";
import type { UserProfile } from "../types";

const BADGE_ICONS: Record<string, { icon: LucideIcon; color: string }> = {
  owner: { icon: Crown, color: "text-yellow-300" },
  admin: { icon: ShieldCheck, color: "text-red-400" },
  mod: { icon: Shield, color: "text-blue-400" },
  mvp: { icon: Sparkles, color: "text-fuchsia-400" },
  founder: { icon: Star, color: "text-amber-300" },
  champion: { icon: Trophy, color: "text-emerald-300" },
  guild: { icon: Castle, color: "text-violet-300" },
  party: { icon: Users, color: "text-teal-300" },
};

export default function UserBadges({ profile, size = 14 }: { profile: Pick<UserProfile, "rank" | "joinedAt" | "botXp" | "partyId" | "guildId">; size?: number }) {
  const badges = computeBadges(profile);
  if (badges.length === 0) return null;
  return (
    <span className="flex items-center gap-1">
      {badges.map((b) => {
        const def = BADGE_ICONS[b.id];
        if (!def) return null;
        const Icon = def.icon;
        return (
          <span key={b.id} title={b.label} className="inline-flex">
            <Icon size={size} className={`shrink-0 ${def.color}`} />
          </span>
        );
      })}
    </span>
  );
}
