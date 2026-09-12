import { addDoc, collection, deleteDoc, doc, getDoc, getDocs, limitToLast, onSnapshot, orderBy, query, setDoc, updateDoc, where, writeBatch } from "firebase/firestore";
import { db } from "./firebase";
import type { Rank, VoiceChannelDoc, VoiceChatMessage, VoiceParticipant, VoiceSignal, VoiceSignalType } from "../types";

// A participant doc is considered a live presence if it's been touched within
// this window. Heartbeat (see useVoiceChannel) fires well inside it.
export const STALE_MS = 35_000;
export const STAFF_MEETING_ID = "staff-meeting";
export const STAFF_MEETING_INACTIVE_MS = 5 * 60_000;

// Used only if the live metered.ca fetch below fails — STUN-only, so calls
// between peers that need a TURN relay (most real-world NAT combos) just won't
// connect, but at least peers on a friendly direct path still can.
const FALLBACK_ICE_SERVERS: RTCIceServer[] = [
  { urls: "stun:stun.cloudflare.com:3478" },
  { urls: "stun:stun.l.google.com:19302" },
];

const METERED_APP_NAME = import.meta.env.VITE_METERED_APP_NAME as string | undefined;
const METERED_API_KEY = import.meta.env.VITE_METERED_API_KEY as string | undefined;

// This API key is metered.ca's client-safe credential-issuing key (their docs
// serve it straight to frontend fetch() calls) — not the account secretKey —
// so it's fine to ship in the client bundle same as the Firebase apiKey is.
// It was previously a hardcoded shared public demo credential (Open Relay
// Project) that every copy-pasted tutorial online used; that shared quota is
// now dead/exhausted, which is why voice calls stopped getting audio at all
// (no TURN relay candidates could be gathered). Fetching fresh per-join
// credentials off a personal account avoids sharing that fate.
export async function fetchIceServers(): Promise<RTCIceServer[]> {
  if (!METERED_APP_NAME || !METERED_API_KEY) return FALLBACK_ICE_SERVERS;
  try {
    const res = await fetch(`https://${METERED_APP_NAME}.metered.live/api/v1/turn/credentials?apiKey=${METERED_API_KEY}`);
    if (!res.ok) throw new Error(`metered credentials request failed: ${res.status}`);
    const servers = await res.json();
    if (!Array.isArray(servers) || servers.length === 0) throw new Error("empty ICE server list");
    return servers as RTCIceServer[];
  } catch (error) {
    console.error("Could not fetch TURN credentials, falling back to STUN-only:", error);
    return FALLBACK_ICE_SERVERS;
  }
}

function channelsRef() {
  return collection(db, "voiceChannels");
}
function participantsRef(channelId: string) {
  return collection(db, "voiceChannels", channelId, "participants");
}
function signalsRef(channelId: string) {
  return collection(db, "voiceChannels", channelId, "signals");
}
function messagesRef(channelId: string) {
  return collection(db, "voiceChannels", channelId, "messages");
}

export async function ensureGeneralChannel() {
  const ref = doc(db, "voiceChannels", "general");
  const snap = await getDoc(ref);
  if (!snap.exists()) {
    await setDoc(ref, { name: "General", createdBy: "system", createdByName: "SpawnDex", createdAt: Date.now(), isDefault: true });
  }
}

export function subscribeToVoiceChannels(callback: (channels: VoiceChannelDoc[]) => void) {
  return onSnapshot(query(channelsRef(), orderBy("createdAt", "asc")), (snap) => {
    callback(snap.docs.map((d) => ({ id: d.id, ...d.data() }) as VoiceChannelDoc));
  });
}

export function createVoiceChannel(id: string, name: string, uid: string, displayName: string) {
  return setDoc(doc(db, "voiceChannels", id), { name, createdBy: uid, createdByName: displayName, createdAt: Date.now(), isDefault: false });
}

export async function ensureLiarsVoiceChannel(roomId: string, uid: string, displayName: string) {
  const channelId = `liars-${roomId}`;
  const ref = doc(db, "voiceChannels", channelId);
  if ((await getDoc(ref)).exists()) return channelId;
  try {
    await setDoc(ref, {
      name: `Liar's Table ${roomId.slice(-6).toUpperCase()}`,
      createdBy: uid,
      createdByName: displayName.slice(0, 80),
      createdAt: Date.now(),
      isDefault: false,
      liarsRoomId: roomId,
    });
  } catch (error) {
    // Another player may have created the shared channel during our read.
    if (!(await getDoc(ref)).exists()) throw error;
  }
  return channelId;
}

export async function ensureDmVoiceChannel(dmId: string, uid: string, displayName: string) {
  const channelId = `dm-${dmId}`;
  const ref = doc(db, "voiceChannels", channelId);
  if ((await getDoc(ref)).exists()) return channelId;
  try {
    await setDoc(ref, {
      name: "Direct call",
      createdBy: uid,
      createdByName: displayName.slice(0, 80),
      createdAt: Date.now(),
      isDefault: false,
      dmId,
    });
  } catch (error) {
    if (!(await getDoc(ref)).exists()) throw error;
  }
  return channelId;
}

export async function ensureCommunityVoiceChannel(serverId: string, voiceId: string, name: string, uid: string, displayName: string) {
  const safeVoiceId = voiceId.replace(/[^a-z0-9_-]/gi, "").slice(0, 32) || "lounge";
  const channelId = `server-${serverId}-${safeVoiceId}`;
  const ref = doc(db, "voiceChannels", channelId);
  if ((await getDoc(ref)).exists()) return channelId;
  try {
    await setDoc(ref, {
      name: name.slice(0, 40) || "Lounge",
      createdBy: uid,
      createdByName: displayName.slice(0, 80),
      createdAt: Date.now(),
      isDefault: false,
      communityServerId: serverId,
      communityVoiceId: safeVoiceId,
    });
  } catch (error) {
    if (!(await getDoc(ref)).exists()) throw error;
  }
  return channelId;
}

export function createStaffMeeting(uid: string, displayName: string) {
  const now = Date.now();
  return setDoc(doc(db, "voiceChannels", STAFF_MEETING_ID), {
    name: "Staff Meeting",
    createdBy: uid,
    createdByName: displayName,
    createdAt: now,
    lastActivityAt: now,
    isDefault: false,
    staffOnly: true,
  });
}

export async function cleanupInactiveStaffMeeting() {
  const channelRef = doc(db, "voiceChannels", STAFF_MEETING_ID);
  const channel = await getDoc(channelRef);
  if (!channel.exists() || channel.data().staffOnly !== true) return false;

  const now = Date.now();
  const participantSnapshot = await getDocs(participantsRef(STAFF_MEETING_ID));
  const hasLiveParticipant = participantSnapshot.docs.some((item) => {
    const lastSeenAt = item.data().lastSeenAt;
    return typeof lastSeenAt === "number" && now - lastSeenAt < STALE_MS;
  });
  if (hasLiveParticipant) return false;

  const lastActivityAt = channel.data().lastActivityAt ?? channel.data().createdAt ?? now;
  if (now - lastActivityAt < STAFF_MEETING_INACTIVE_MS) return false;

  const [messages, signals] = await Promise.all([
    getDocs(messagesRef(STAFF_MEETING_ID)),
    getDocs(signalsRef(STAFF_MEETING_ID)),
  ]);
  await Promise.all([
    ...participantSnapshot.docs.map((item) => deleteDoc(item.ref)),
    ...messages.docs.map((item) => deleteDoc(item.ref)),
    ...signals.docs.map((item) => deleteDoc(item.ref)),
  ]);
  await deleteDoc(channelRef);
  return true;
}

export function deleteVoiceChannel(id: string) {
  return deleteDoc(doc(db, "voiceChannels", id));
}

export function subscribeToParticipants(channelId: string, callback: (participants: VoiceParticipant[]) => void) {
  return onSnapshot(participantsRef(channelId), (snap) => {
    callback(snap.docs.map((d) => ({ id: d.id, lastSeenAt: 0, ...d.data() }) as VoiceParticipant));
  });
}

export function subscribeToVoiceMessages(channelId: string, callback: (messages: VoiceChatMessage[]) => void) {
  const messagesQuery = query(messagesRef(channelId), orderBy("createdAt", "asc"), limitToLast(100));
  return onSnapshot(messagesQuery, (snap) => {
    callback(snap.docs.map((item) => ({ id: item.id, ...item.data() }) as VoiceChatMessage));
  });
}

export function sendVoiceMessage(channelId: string, authorId: string, authorName: string, authorPhotoUrl: string, text: string) {
  const cleanText = text.trim().slice(0, 500);
  if (!cleanText) throw new Error("Write a message first.");
  const message = addDoc(messagesRef(channelId), {
    authorId,
    authorName: authorName.slice(0, 80),
    authorPhotoUrl: authorPhotoUrl.slice(0, 1000),
    text: cleanText,
    broadcastTts: true,
    createdAt: Date.now(),
  });
  if (channelId !== STAFF_MEETING_ID) return message;
  return Promise.all([message, updateDoc(doc(db, "voiceChannels", channelId), { lastActivityAt: Date.now() })]);
}

export function joinChannel(channelId: string, uid: string, displayName: string, photoUrl: string, rank: Rank) {
  const participant = setDoc(doc(db, "voiceChannels", channelId, "participants", uid), {
    displayName,
    photoUrl,
    rank,
    muted: false,
    joinedAt: Date.now(),
    lastSeenAt: Date.now(),
  });
  if (channelId !== STAFF_MEETING_ID) return participant;
  return Promise.all([participant, updateDoc(doc(db, "voiceChannels", channelId), { lastActivityAt: Date.now() })]);
}

export function touchParticipant(channelId: string, uid: string) {
  const now = Date.now();
  const participant = updateDoc(doc(db, "voiceChannels", channelId, "participants", uid), { lastSeenAt: now });
  if (channelId !== STAFF_MEETING_ID) return participant;
  return Promise.all([participant, updateDoc(doc(db, "voiceChannels", channelId), { lastActivityAt: now })]);
}

export function leaveChannel(channelId: string, uid: string) {
  return deleteDoc(doc(db, "voiceChannels", channelId, "participants", uid));
}

// Best-effort garbage collection of another participant's doc once it's gone stale
// (their tab closed/crashed without a clean leave). Any live participant may call this.
export function removeStaleParticipant(channelId: string, staleUid: string) {
  return deleteDoc(doc(db, "voiceChannels", channelId, "participants", staleUid));
}

export function setParticipantMuted(channelId: string, uid: string, muted: boolean) {
  return updateDoc(doc(db, "voiceChannels", channelId, "participants", uid), { muted });
}

export function sendSignal(channelId: string, fromUid: string, toUid: string, type: VoiceSignalType, payload: string) {
  return addDoc(signalsRef(channelId), { fromUid, toUid, type, payload, createdAt: Date.now() });
}

export function subscribeToIncomingSignals(channelId: string, myUid: string, callback: (signals: VoiceSignal[]) => void) {
  const q = query(signalsRef(channelId), where("toUid", "==", myUid));
  return onSnapshot(q, (snap) => {
    callback(snap.docs.map((d) => ({ id: d.id, ...d.data() }) as VoiceSignal));
  });
}

export function deleteSignal(channelId: string, signalId: string) {
  return deleteDoc(doc(db, "voiceChannels", channelId, "signals", signalId));
}

export async function clearVoiceMessages(channelId: string) {
  const snap = await getDocs(messagesRef(channelId));
  for (let i = 0; i < snap.docs.length; i += 450) {
    const batch = writeBatch(db);
    snap.docs.slice(i, i + 450).forEach((d) => batch.delete(d.ref));
    await batch.commit();
  }
}
