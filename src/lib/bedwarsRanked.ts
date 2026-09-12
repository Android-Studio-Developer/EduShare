import { collection, deleteDoc, doc, getDoc, getDocs, onSnapshot, query, runTransaction, setDoc, updateDoc, where, writeBatch } from "firebase/firestore";
import { db } from "./firebase";
import { deleteVoiceChannel } from "./voice";
import type { BedwarsLobby, BedwarsMode, BedwarsQueueEntry, BedwarsTeam, UserProfile } from "../types";

export const BEDWARS_TIERS = ["Bronze", "Silver", "Gold", "Platinum", "Diamond", "Master"] as const;
export type BedwarsTier = (typeof BEDWARS_TIERS)[number];

export const BEDWARS_ROLES = ["Bridger", "2nd Rusher", "3rd Rusher", "Defender"] as const;

export const BEDWARS_MAPS = ["Lectus", "Invasion", "Aquarium", "Waterfall", "Sandstorm", "Steampunk", "Deadwood", "Ruby"];

export function bedwarsModeLabel(mode: BedwarsMode) {
  return mode === "bedfight" ? "Bed Fight 1v1" : mode === "1v1" ? "RBW 1v1" : mode;
}

export function bedwarsModeTeamSize(mode: BedwarsMode) {
  return mode === "bedfight" ? 1 : Number(mode[0]);
}

export interface BedwarsRank {
  tier: BedwarsTier;
  star: number;
}

// Everyone starts at 0. Bronze has no stars. Silver–Diamond each span 200
// rating and split into 5 stars of 40 each. Master is uncapped, gaining a
// star every 100 rating.
export function getBedwarsRank(rating: number): BedwarsRank {
  if (rating < 200) return { tier: "Bronze", star: 0 };
  if (rating < 1000) {
    const bands: { tier: BedwarsTier; start: number }[] = [
      { tier: "Silver", start: 200 },
      { tier: "Gold", start: 400 },
      { tier: "Platinum", start: 600 },
      { tier: "Diamond", start: 800 },
    ];
    const band = [...bands].reverse().find((b) => rating >= b.start)!;
    const star = Math.min(5, Math.floor((rating - band.start) / 40) + 1);
    return { tier: band.tier, star };
  }
  return { tier: "Master", star: Math.floor((rating - 1000) / 100) + 1 };
}

export function formatBedwarsRank(rating: number): string {
  const { tier, star } = getBedwarsRank(rating);
  return star > 0 ? `${tier} ${star}` : tier;
}

const WIN_GAIN = 35;
const LOSS_PENALTY = 15;
const TOP_KILLER_BONUS = 5;

export function computeEloChange(won: boolean, isTopKiller: boolean) {
  return (won ? WIN_GAIN : -LOSS_PENALTY) + (isTopKiller ? TOP_KILLER_BONUS : 0);
}

export function randomMapOptions(): string[] {
  const pool = [...BEDWARS_MAPS];
  const picked: string[] = [];
  while (picked.length < 3 && pool.length > 0) {
    const i = Math.floor(Math.random() * pool.length);
    picked.push(pool.splice(i, 1)[0]);
  }
  return picked;
}

// --- Queue ---

export function joinBedwarsQueue(uid: string, displayName: string, elo: number, partyId: string, lobbyCode: string, mode: BedwarsMode) {
  return setDoc(doc(db, "bedwarsQueue", uid), {
    uid,
    displayName,
    elo: Math.round(elo),
    partyId,
    lobbyCode: lobbyCode.trim().toUpperCase(),
    mode,
    queuedAt: Date.now(),
  });
}

export function leaveBedwarsQueue(uid: string) {
  return deleteDoc(doc(db, "bedwarsQueue", uid));
}

export function subscribeToBedwarsQueue(callback: (entries: BedwarsQueueEntry[]) => void) {
  return onSnapshot(collection(db, "bedwarsQueue"), (snap) => callback(snap.docs.map((d) => d.data() as BedwarsQueueEntry)));
}

export function bedwarsQueueChannelId(lobbyCode: string, mode: BedwarsMode) {
  return `bw-queue-${mode}-${lobbyCode || "public"}`;
}

// Everyone waiting in the same queue (public, or a shared private code) gets
// dropped into one shared voice room so they can talk while they wait —
// same idea as the per-match team channels, just one shared room instead
// of two, and it persists instead of getting cleaned up after each match.
export async function ensureBedwarsQueueChannel(lobbyCode: string, mode: BedwarsMode, callerUid: string, callerName: string) {
  const id = bedwarsQueueChannelId(lobbyCode, mode);
  const ref = doc(db, "voiceChannels", id);
  const snap = await getDoc(ref);
  if (!snap.exists()) {
    await setDoc(ref, {
      name: lobbyCode ? `${bedwarsModeLabel(mode)} Queue · ${lobbyCode}` : `${bedwarsModeLabel(mode)} Queue`,
      createdBy: callerUid,
      createdByName: callerName,
      createdAt: Date.now(),
      isDefault: false,
    });
  }
  return id;
}

// Only windows containing the calling player are considered — rules require
// the lobby's creator to be one of the players, so a group that doesn't include
// them would just get rejected on write.
function pickBestGroup(entries: BedwarsQueueEntry[], mustIncludeUid: string, teamSize: number): BedwarsQueueEntry[] | null {
  const matchSize = teamSize * 2;
  if (entries.length < matchSize) return null;
  const sorted = [...entries].sort((a, b) => a.elo - b.elo);
  let best: BedwarsQueueEntry[] | null = null;
  let bestSpread = Infinity;
  for (let i = 0; i <= sorted.length - matchSize; i++) {
    const window = sorted.slice(i, i + matchSize);
    if (!window.some((e) => e.uid === mustIncludeUid)) continue;
    const spread = window[matchSize - 1].elo - window[0].elo;
    if (spread < bestSpread) {
      bestSpread = spread;
      best = window;
    }
  }
  return best && bestSpread <= 400 ? best : null;
}

function assignTeams(group: BedwarsQueueEntry[], teamSize: number): BedwarsLobby["players"] {
  const sorted = [...group].sort((a, b) => b.elo - a.elo);
  const teamA: BedwarsQueueEntry[] = [];
  const teamB: BedwarsQueueEntry[] = [];
  let sumA = 0;
  let sumB = 0;
  for (const e of sorted) {
    if (teamA.length >= teamSize) {
      teamB.push(e);
      sumB += e.elo;
    } else if (teamB.length >= teamSize) {
      teamA.push(e);
      sumA += e.elo;
    } else if (sumA <= sumB) {
      teamA.push(e);
      sumA += e.elo;
    } else {
      teamB.push(e);
      sumB += e.elo;
    }
  }
  return [
    ...teamA.map((e) => ({ uid: e.uid, name: e.displayName, elo: e.elo, team: "a" as BedwarsTeam })),
    ...teamB.map((e) => ({ uid: e.uid, name: e.displayName, elo: e.elo, team: "b" as BedwarsTeam })),
  ];
}

// Runs client-side (this app has no server functions) — whoever is sitting
// in the queue page attempts to form a match every few seconds. The
// transaction re-checks all selected queue docs still exist before claiming them,
// so two clients racing to form a match can't double-book the same players.
// The caller is guaranteed to be in the match (see pickBestGroup), so once
// the lobby exists they immediately spin up both team voice channels too.
export async function tryFormBedwarsMatch(lobbyCode: string, mode: BedwarsMode, callerUid: string, callerName: string): Promise<string | null> {
  // A lobbyCode + queuedAt compound query requires a manually provisioned
  // Firestore index. Matching sorts by Elo below, so querying only by the
  // shared queue code keeps matchmaking index-free and works immediately.
  const q = query(collection(db, "bedwarsQueue"), where("lobbyCode", "==", lobbyCode));
  const snap = await getDocs(q);
  const entries = snap.docs.map((d) => d.data() as BedwarsQueueEntry).filter((entry) => (entry.mode ?? "4v4") === mode);
  const teamSize = bedwarsModeTeamSize(mode);
  const group = pickBestGroup(entries, callerUid, teamSize);
  if (!group) return null;

  const players = assignTeams(group, teamSize);
  const playerIds = players.map((p) => p.uid);
  const lobbyRef = doc(collection(db, "bedwarsLobbies"));

  try {
    await runTransaction(db, async (transaction) => {
      const queueRefs = group.map((e) => doc(db, "bedwarsQueue", e.uid));
      const snaps = await Promise.all(queueRefs.map((r) => transaction.get(r)));
      if (snaps.some((s) => !s.exists())) throw new Error("stale queue entries");
      const isBedFight = mode === "bedfight";
      transaction.set(lobbyRef, {
        playerIds,
        players,
        mode,
        status: isBedFight ? "role_select" : "voting",
        mapOptions: isBedFight ? ["SpawnDex Dojo"] : randomMapOptions(),
        mapVotes: {},
        chosenMap: isBedFight ? "SpawnDex Dojo" : "",
        roles: {},
        voiceChannelAId: "",
        voiceChannelBId: "",
        screenshotUrl: "",
        winningTeamClaim: "",
        topKillerId: "",
        submittedBy: "",
        reviewedBy: "",
        reviewedAt: 0,
        createdAt: Date.now(),
      });
      queueRefs.forEach((r) => transaction.delete(r));
    });
    await createBedwarsVoiceChannels(lobbyRef.id, callerUid, callerName);
    return lobbyRef.id;
  } catch {
    return null;
  }
}

async function createBedwarsVoiceChannels(lobbyId: string, callerUid: string, callerName: string) {
  const aId = `bw-${lobbyId}-a`;
  const bId = `bw-${lobbyId}-b`;
  await Promise.all([
    setDoc(doc(db, "voiceChannels", aId), {
      name: "Ranked Bedwars · Team A",
      createdBy: callerUid,
      createdByName: callerName,
      createdAt: Date.now(),
      isDefault: false,
      bedwarsLobbyId: lobbyId,
      bedwarsTeam: "a",
    }),
    setDoc(doc(db, "voiceChannels", bId), {
      name: "Ranked Bedwars · Team B",
      createdBy: callerUid,
      createdByName: callerName,
      createdAt: Date.now(),
      isDefault: false,
      bedwarsLobbyId: lobbyId,
      bedwarsTeam: "b",
    }),
  ]);
  await updateDoc(doc(db, "bedwarsLobbies", lobbyId), { voiceChannelAId: aId, voiceChannelBId: bId });
}

export function subscribeToMyBedwarsLobby(uid: string, callback: (lobbies: BedwarsLobby[]) => void) {
  const q = query(collection(db, "bedwarsLobbies"), where("playerIds", "array-contains", uid));
  return onSnapshot(q, (snap) => callback(snap.docs.map((d) => ({ id: d.id, ...d.data() }) as BedwarsLobby)));
}

// --- In-lobby actions ---

export function voteBedwarsMap(lobbyId: string, uid: string, map: string) {
  return updateDoc(doc(db, "bedwarsLobbies", lobbyId), { [`mapVotes.${uid}`]: map });
}

export function finalizeBedwarsMapVote(lobbyId: string, chosenMap: string) {
  return updateDoc(doc(db, "bedwarsLobbies", lobbyId), { status: "role_select", chosenMap });
}

export function pickBedwarsRole(lobbyId: string, uid: string, role: string) {
  return updateDoc(doc(db, "bedwarsLobbies", lobbyId), { [`roles.${uid}`]: role });
}

export function startBedwarsMatch(lobbyId: string) {
  return updateDoc(doc(db, "bedwarsLobbies", lobbyId), { status: "in_progress" });
}

export async function submitBedwarsScore(lobby: BedwarsLobby, uid: string, screenshotUrl: string, winningTeamClaim: BedwarsTeam, topKillerId: string) {
  await updateDoc(doc(db, "bedwarsLobbies", lobby.id), {
    status: "awaiting_review",
    screenshotUrl: screenshotUrl.trim(),
    winningTeamClaim,
    topKillerId,
    submittedBy: uid,
  });
  await cleanupBedwarsVoiceChannels(lobby);
}

export async function cancelBedwarsLobby(lobby: BedwarsLobby) {
  await updateDoc(doc(db, "bedwarsLobbies", lobby.id), { status: "cancelled" });
  await cleanupBedwarsVoiceChannels(lobby);
}

async function cleanupBedwarsVoiceChannels(lobby: BedwarsLobby) {
  await Promise.all(
    [lobby.voiceChannelAId, lobby.voiceChannelBId]
      .filter((id) => id)
      .map((id) => deleteVoiceChannel(id).catch(() => {})),
  );
}

export function subscribeToBedwarsReviewQueue(callback: (lobbies: BedwarsLobby[]) => void) {
  const q = query(collection(db, "bedwarsLobbies"), where("status", "==", "awaiting_review"));
  return onSnapshot(q, (snap) => callback(snap.docs.map((d) => ({ id: d.id, ...d.data() }) as BedwarsLobby)));
}

// Staff-only: applies the Elo change to all 8 players' own profiles in one
// batch alongside marking the lobby scored. Trusted the same way rank grants
// and bans already are in this app — isStaff() can freely touch these
// fields on any profile.
export async function approveBedwarsScore(lobby: BedwarsLobby, staffUid: string, winningTeam: BedwarsTeam, topKillerId: string) {
  const profileSnaps = await Promise.all(lobby.players.map((p) => getDoc(doc(db, "profiles", p.uid))));
  const batch = writeBatch(db);
  lobby.players.forEach((p, i) => {
    const data = profileSnaps[i].data() as Partial<UserProfile> | undefined;
    const current = data?.bedwarsRating ?? 0;
    const won = p.team === winningTeam;
    const delta = computeEloChange(won, p.uid === topKillerId);
    batch.update(doc(db, "profiles", p.uid), {
      bedwarsRating: Math.max(0, Math.min(5000, current + delta)),
      bedwarsWins: (data?.bedwarsWins ?? 0) + (won ? 1 : 0),
      bedwarsLosses: (data?.bedwarsLosses ?? 0) + (won ? 0 : 1),
    });
  });
  batch.update(doc(db, "bedwarsLobbies", lobby.id), { status: "scored", reviewedBy: staffUid, reviewedAt: Date.now() });
  await batch.commit();
}

export function rejectBedwarsScore(lobbyId: string, staffUid: string) {
  return updateDoc(doc(db, "bedwarsLobbies", lobbyId), { status: "rejected", reviewedBy: staffUid, reviewedAt: Date.now() });
}
