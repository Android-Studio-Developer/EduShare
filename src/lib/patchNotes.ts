export const PATCH_NOTES_VERSION = "Via Lactea 1.0.4";
const SEEN_KEY = "edushare-patchnotes-seen";
const SNOOZE_KEY = "edushare-patchnotes-snooze-until";
const SNOOZE_MS = 24 * 60 * 60 * 1000;

export interface PatchNote {
  version: string;
  date: string;
  items: string[];
}

// Only the newest release shows in the popup modal. Everything else lives in
// the archive, browsable from /changelog and the footer — same PatchNote[]
// shape, just split by recency instead of dumping the whole history at once.
export const LATEST_PATCH_NOTE: PatchNote = {
  version: "Via Lactea 1.0.4",
  date: "Aug 19, 2026",
  items: [
    "Party & Guild system — Looking For Party/Guild board, 10-person parties (auto-disband after 24h) and 100-person guilds, co-leader/co-owner promotion, VIP++ guild name styling (color, chroma, glow)",
    "Polls — Discord-style polls in Global Chat and every registered server's chat, 2-4 options, live vote bars",
    "Credits economy overhaul — daily claim raised to +15, new passive +8 credits per 5 minutes active, and you can now donate credits directly to another player with an optional message",
    "Shop items can now have a photo attached (under 20MB)",
    "New eduShare logo reflecting the new rank, chat, credits, and PID systems",
    "eduBot now shows its real icon in Global Chat and DMs instead of a placeholder",
    "Display Name vs. Username system — claim a unique @username (first come, first served) used for @pings, separate from your display name",
    "V2 interface — new left sidebar navigation with grouped sections, card-based layout polish, and a switchable animated Galaxy background",
    "Fixed the Team page not showing the real owner/moderator tags",
    "Fixed donating credits failing with a permissions error for players who'd never opened their wallet before",
    "Fixed the snow profile effect not actually falling",
    "Fixed chat showing your old name after a rename",
    "Account recovery — self-service password reset from the login page, plus a request form for players who've lost their username too",
    "Host ping — when a registered server flips from offline to online, eduBot pings @everyone in Global Chat and notifies every player",
    "Fixed !duel bets — the opponent's win/loss never actually moved their credits before, only the challenger's",
    "Profile cards now show which guild you're in",
    "Partnerships — server owners can request to become an eduShare Partner from their Dashboard; accepted partners get an exclusive Partner rank and a spotlight card on the homepage",
    "The Discord-style ping sound now plays app-wide the instant you get a new notification, not just while Global Chat is open",
    "Hypno SMP is eduShare's first official partner!",
    "Fixed Voice Chat disconnecting you the moment you navigated to another page — the call now stays connected (and audible) app-wide",
    "Fixed showing as offline while in a voice call with the tab backgrounded",
  ],
};

export const ARCHIVED_PATCH_NOTES: PatchNote[] = [
  {
    version: "1.0.3",
    date: "Aug 17, 2026",
    items: [
      "RE:vamp — Discord-style profile cards, click any avatar in chat, voice, or friends to open one",
      "MVP++ nicknames now render in an animated chroma gradient everywhere",
      "Profile banners — set a banner image, plus 12 unlockable VIP++ banner effects (Aurora, Mesh Gradient, Particle Field, Glass Sweep, Cyber Grid, Liquid Waves, Starfield, Spotlight, Waveform, Holographic, Letter Glitch, Snow)",
      "Added favorite games field to profiles; your own email now shows on your own card only",
      "Fixed Voice Chat ghost participants — a closed tab no longer lingers forever for everyone else",
      "Fixed Voice Chat visibility — you can now see who's in a channel before joining it, like Discord",
      "Fixed the site's entry gate — swapped a 31MB gif for a 1MB video so it actually loads",
      "Fixed the profile card popup breaking inside Global Chat",
      "Fixed a cursor-tracking bug on resizable/moving hover targets",
    ],
  },
  {
    version: "2026.08.voice",
    date: "Aug 2026",
    items: [
      "Voice Chat — Discord-style channels, join and talk live",
      "MVP+ and staff can create new voice channels",
      "Free TURN relay for better connections on strict networks",
      "OS Dock mode — switch the call controls to a macOS-style dock",
    ],
  },
  {
    version: "2026.08.arcade",
    date: "Aug 2026",
    items: [
      "eduBot arcade — !coinflip, !rps, !slots, !trivia in Global Chat",
      "Earn arcade XP and climb the leaderboard",
      "Friends — send/accept requests, see who's online",
      "Profile pictures now show in chat, plus click-spark effects site-wide",
    ],
  },
];

export const ALL_PATCH_NOTES: PatchNote[] = [LATEST_PATCH_NOTE, ...ARCHIVED_PATCH_NOTES];

export function hasUnseenPatchNotes() {
  if (localStorage.getItem(SEEN_KEY) === PATCH_NOTES_VERSION) return false;
  const snoozeUntil = Number(localStorage.getItem(SNOOZE_KEY) ?? 0);
  return Date.now() >= snoozeUntil;
}

export function markPatchNotesSeen() {
  localStorage.setItem(SEEN_KEY, PATCH_NOTES_VERSION);
  localStorage.removeItem(SNOOZE_KEY);
}

export function snoozePatchNotes() {
  localStorage.setItem(SNOOZE_KEY, String(Date.now() + SNOOZE_MS));
}
