export const PATCH_NOTES_VERSION = "2.0.2 — Massive Profile Update";
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
  version: "2.0.2 — Massive Profile Update",
  date: "Aug 27, 2026",
  items: [
    "Discord-inspired profile effect picker — a polished two-pane layout with an owned collection, organized shop tiers, live profile preview, prices, promo codes, and clear Apply or Buy actions",
    "Profile effect picker reliability — the modal now stays inside the viewport, keeps its footer controls visible, scrolls correctly on smaller screens, and no longer duplicates owned effects in the shop",
    "24 new profile effects, bringing the collection to 30 total — Scanline, Starlight, Frost, Radar, Sunset, Cyber Grid, Deep Space, Lightning, Ocean Pulse, Hologram, Confetti, Void Rift, Thunderstorm, Cherry Blossom, Black Hole, Northern Snow, Retro Glitch, Music Visualizer, Meteor Shower, Moonlit Howl, Dream Orbit, Silent Gaze, Midnight Celebration, and Infernal Rite",
    "Lightning rebuilt with real jagged blue-white bolts, branching strikes, bloom, synchronized card illumination, and a slower nine-second storm cycle",
    "Cherry Blossom upgraded with original transparent flowering-branch artwork, gentle branch movement, and seven independently drifting petal layers",
    "Premium illustrated effects — Moonlit Howl adds a glowing moon and white wolf, Dream Orbit adds a pastel ringed planet and nebula, and Silent Gaze adds luminous cyan eyes with cosmic ink and a hush gesture",
    "Cinematic effect sequences — Moonlit Howl now rises, holds, and dissolves on a 6.4-second loop, while Silent Gaze transforms from a giant flashing iris into its full eyes-and-hand scene before sliding away on an 11-second loop",
    "Midnight Celebration — a metallic gold festival frame with stepped geometric corners, subtle red accents, rising sparks, and a warm animated border glow",
    "Infernal Rite — an 11.3-second cinematic sequence with a ritual hand sign, an erupting flame vortex, a quiet reset, and a second wave of edge fire, sparks, cracks, and slash energy",
    "Every new effect works across shop thumbnails, the live effect preview, personal profiles, and public profile cards; reduced-motion preferences pause the animations",
    "Profile banners can now embed compatible webpages with an embed: or iframe: URL prefix, while normal image banners and existing audio references continue to work unchanged",
    "Embedded banners now include a visible fallback link when a website blocks iframe rendering, plus a clear invalid-URL state",
    "Site gate redesigned as a Graphing Calculator disguise — type bruh in the calculator expression area to enter, with a matching calculator tab title and favicon",
    "Login restored on justsaying-hi.web.app by adding the deployed site to Firebase Authentication's authorized domains",
  ],
};

export const ARCHIVED_PATCH_NOTES: PatchNote[] = [
  {
    version: "Zenith 2.0.1 — UI Update",
    date: "Aug 20, 2026",
    items: [
    "V4 Desktop interface — an OS-style top bar, framed app windows, magnifying dock, and a real desktop where closing the red window control hides the dock and turns every SpawnDex section into an app icon",
    "V4 desktop upgrades — every SpawnDex section now has its own app artwork, desktop icons can be dragged anywhere and remember their positions, and the Wallpaper app accepts profile-synced image links",
    "Liquid Glass Notification Center — macOS-style ping cards, an unread badge, live notification history, and MVP+ credit events with reserved prizes, player entry, random winner draws, and automatic payouts or cancellation refunds",
    "V4 Sound Center — live elapsed/total track duration, seeking, play/pause, mute, and saved volume controls directly in the OS bar",
    "Personal wallpapers — save a background image URL from Profile and use it across SpawnDex; clear it anytime to return to Galaxy or Dots",
    "Profile V4 dashboard — replaced the narrow scroll-heavy settings feed with a wide two-column workspace, sticky identity card, grouped preferences, and a compact rank grid",
    "V3 Workspace interface and five switchable color themes — Royal, Emerald, Sunset, Rose, and Frost",
    "Login appearance prompt — returning users get a polished V3/V4 preview with a direct jump to the Interface chooser in Profile",
    "React Bits Galaxy background restored across modern interface modes, with a Dots fallback and reduced-motion support",
    "Live Wordle Duels — public and direct challenges, real-time boards, spectators, and optional credit stakes with winner payouts",
    "Live Chess — full legal chess rules, SVG pieces, correct board orientation/pattern, check and checkmate detection, castling, en passant, promotion, draws, and finished-game cleanup",
    "Chess match upgrades — 5|3 Blitz and 10-minute Rapid clocks, premoves, player/spectator match chat without eduBot, live spectating, profile activity, credit betting, resigning, and refundable early voids",
    "Campus Capital — an original live property-trading game with 2–6 player rooms, host-selected starting money, dice and turns, purchasable deeds, color-set rent bonuses, built-in event cards, taxes, Detention, bankruptcy, spectating, and winner detection",
    "Partnership workflow — server owners can submit requests, owners can accept or decline them, accepted partners receive the Partner rank and appear in the Team partner section",
    "Community polish — Partner badges now match staff badge quality, Global Chat is roomier, announcements can be collapsed, and empty V3 sidebar space has a useful quick-help card",
    "eduBot and !ai reliability — chat-aware responses plus a same-origin local API route for networks that block the upstream AI domain",
    ],
  },
  {
    version: "Via Lactea 1.0.4",
    date: "Aug 19, 2026",
    items: [
    "Party & Guild system — Looking For Party/Guild board, 10-person parties (auto-disband after 24h) and 100-person guilds, co-leader/co-owner promotion, VIP++ guild name styling (color, chroma, glow)",
    "Polls — Discord-style polls in Global Chat and every registered server's chat, 2-4 options, live vote bars",
    "Credits economy overhaul — daily claim raised to +15, new passive +8 credits per 5 minutes active, and you can now donate credits directly to another player with an optional message",
    "Shop items can now have a photo attached (under 20MB)",
    "New SpawnDex logo reflecting the new rank, chat, credits, and PID systems",
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
    "Partnerships — server owners can request to become an SpawnDex Partner from their Dashboard; accepted partners get an exclusive Partner rank and a spotlight card on the homepage",
    "The Discord-style ping sound now plays app-wide the instant you get a new notification, not just while Global Chat is open",
    "Hypno SMP is SpawnDex's first official partner!",
    "Fixed Voice Chat disconnecting you the moment you navigated to another page — the call now stays connected (and audible) app-wide",
    "Fixed showing as offline while in a voice call with the tab backgrounded",
    ],
  },
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
