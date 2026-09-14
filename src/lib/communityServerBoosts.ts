export const COMMUNITY_SERVER_BOOST_COST = 800;

export interface CommunityServerBoostLevel {
  level: 0 | 1 | 2 | 3;
  boosts: number;
  title: string;
  perks: string[];
}

export const COMMUNITY_SERVER_BOOST_LEVELS: CommunityServerBoostLevel[] = [
  {
    level: 1,
    boosts: 2,
    title: "Level 1",
    perks: [
      "100 emoji slots",
      "15 sticker slots",
      "24 soundboard slots",
      "128 Kbps voice audio",
      "720p 60 FPS streams",
      "Custom invite background",
      "Animated server icon",
    ],
  },
  {
    level: 2,
    boosts: 7,
    title: "Level 2",
    perks: [
      "Everything in Level 1",
      "150 emoji slots",
      "30 sticker slots",
      "36 soundboard slots",
      "256 Kbps voice audio",
      "1080p 60 FPS streams",
      "50 MB server uploads",
      "Custom role icons",
      "Static server banner",
      "150-person stage audience",
    ],
  },
  {
    level: 3,
    boosts: 14,
    title: "Level 3",
    perks: [
      "Everything in Levels 1 and 2",
      "250 emoji slots",
      "60 sticker slots",
      "48 soundboard slots",
      "384 Kbps voice audio",
      "100 MB server uploads",
      "Animated server banner",
      "Custom invite link",
      "300-person stage audience",
    ],
  },
];

export const COMMUNITY_SERVER_EXTRA_PERKS = [
  { boosts: 3, title: "Server tag", description: "A short server tag members can show on their profiles." },
  { boosts: 3, title: "Enhanced role styles", description: "Gradient and holographic role colors." },
  { boosts: 3, title: "Game server hosting", description: "A shared hosting perk for supported community games." },
  { boosts: 5, title: "Larger server uploads", description: "Upload server files up to 250 MB." },
];

export function communityServerBoostProgress(boostCount = 0) {
  const current = [...COMMUNITY_SERVER_BOOST_LEVELS].reverse().find((item) => boostCount >= item.boosts) ?? null;
  const next = COMMUNITY_SERVER_BOOST_LEVELS.find((item) => boostCount < item.boosts) ?? null;
  const previousThreshold = current?.boosts ?? 0;
  const nextThreshold = next?.boosts ?? (previousThreshold || 1);
  const progress = next
    ? Math.max(0, Math.min(1, (boostCount - previousThreshold) / (nextThreshold - previousThreshold)))
    : 1;
  return { current, next, progress };
}
