import { addDoc, collection, deleteDoc, doc, getDoc, onSnapshot, orderBy, query, setDoc, updateDoc, where } from "firebase/firestore";
import { db } from "./firebase";
import type { Rank, VoiceChannelDoc, VoiceParticipant, VoiceSignal, VoiceSignalType } from "../types";

// Open Relay Project — free, publicly documented STUN/TURN meant for client-side use.
// https://www.metered.ca/tools/openrelay/
// A participant doc is considered a live presence if it's been touched within
// this window. Heartbeat (see useVoiceChannel) fires well inside it.
export const STALE_MS = 35_000;

export const ICE_SERVERS: RTCIceServer[] = [
  { urls: "stun:stun.relay.metered.ca:80" },
  { urls: "turn:global.relay.metered.ca:80", username: "openrelayproject", credential: "openrelayprojectsecret" },
  { urls: "turn:global.relay.metered.ca:443", username: "openrelayproject", credential: "openrelayprojectsecret" },
  { urls: "turn:global.relay.metered.ca:443?transport=tcp", username: "openrelayproject", credential: "openrelayprojectsecret" },
];

function channelsRef() {
  return collection(db, "voiceChannels");
}
function participantsRef(channelId: string) {
  return collection(db, "voiceChannels", channelId, "participants");
}
function signalsRef(channelId: string) {
  return collection(db, "voiceChannels", channelId, "signals");
}

export async function ensureGeneralChannel() {
  const ref = doc(db, "voiceChannels", "general");
  const snap = await getDoc(ref);
  if (!snap.exists()) {
    await setDoc(ref, { name: "General", createdBy: "system", createdByName: "eduShare", createdAt: Date.now(), isDefault: true });
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

export function deleteVoiceChannel(id: string) {
  return deleteDoc(doc(db, "voiceChannels", id));
}

export function subscribeToParticipants(channelId: string, callback: (participants: VoiceParticipant[]) => void) {
  return onSnapshot(participantsRef(channelId), (snap) => {
    callback(snap.docs.map((d) => ({ id: d.id, lastSeenAt: 0, ...d.data() }) as VoiceParticipant));
  });
}

export function joinChannel(channelId: string, uid: string, displayName: string, photoUrl: string, rank: Rank) {
  return setDoc(doc(db, "voiceChannels", channelId, "participants", uid), {
    displayName,
    photoUrl,
    rank,
    muted: false,
    joinedAt: Date.now(),
    lastSeenAt: Date.now(),
  });
}

export function touchParticipant(channelId: string, uid: string) {
  return updateDoc(doc(db, "voiceChannels", channelId, "participants", uid), { lastSeenAt: Date.now() });
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
