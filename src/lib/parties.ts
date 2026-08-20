import { arrayRemove, arrayUnion, collection, deleteDoc, doc, getDoc, onSnapshot, orderBy, query, updateDoc, writeBatch } from "firebase/firestore";
import { db } from "./firebase";
import type { Party } from "../types";

export const PARTY_MAX_MEMBERS = 10;
const PARTY_LIFESPAN_MS = 24 * 60 * 60 * 1000;

function partiesRef() {
  return collection(db, "parties");
}

export function subscribeToParties(callback: (parties: Party[]) => void) {
  const q = query(partiesRef(), orderBy("createdAt", "desc"));
  return onSnapshot(q, (snapshot) => {
    const parties = snapshot.docs.map((d) => ({ id: d.id, ...d.data() }) as Party);
    const expired = parties.filter((p) => p.expiresAt <= Date.now());
    for (const party of expired) void deleteDoc(doc(db, "parties", party.id)).catch(() => {});
    callback(parties.filter((p) => p.expiresAt > Date.now()));
  });
}

export function subscribeToParty(partyId: string, callback: (party: Party | null) => void) {
  return onSnapshot(doc(db, "parties", partyId), (snapshot) => callback(snapshot.exists() ? ({ id: snapshot.id, ...snapshot.data() } as Party) : null));
}

export async function createParty(userId: string, leaderName: string, name: string) {
  const trimmed = name.trim().slice(0, 40);
  if (!trimmed) throw new Error("Give your party a name.");
  const ref = doc(partiesRef());
  const now = Date.now();
  const batch = writeBatch(db);
  batch.set(ref, {
    name: trimmed,
    leaderId: userId,
    leaderName,
    coLeaderId: "",
    memberIds: [userId],
    createdAt: now,
    expiresAt: now + PARTY_LIFESPAN_MS,
  });
  batch.update(doc(db, "profiles", userId), { partyId: ref.id });
  await batch.commit();
  return ref.id;
}

export async function joinParty(partyId: string, userId: string) {
  const batch = writeBatch(db);
  batch.update(doc(db, "parties", partyId), { memberIds: arrayUnion(userId) });
  batch.update(doc(db, "profiles", userId), { partyId });
  await batch.commit();
}

export async function leaveParty(partyId: string, userId: string) {
  const partySnap = await getDoc(doc(db, "parties", partyId));
  const wasCoLeader = partySnap.data()?.coLeaderId === userId;
  const batch = writeBatch(db);
  batch.update(doc(db, "parties", partyId), {
    memberIds: arrayRemove(userId),
    ...(wasCoLeader ? { coLeaderId: "" } : {}),
  });
  batch.update(doc(db, "profiles", userId), { partyId: "" });
  await batch.commit();
}

export function disbandParty(partyId: string) {
  return deleteDoc(doc(db, "parties", partyId));
}

export function renameParty(partyId: string, name: string) {
  const trimmed = name.trim().slice(0, 40);
  if (!trimmed) throw new Error("Give your party a name.");
  return updateDoc(doc(db, "parties", partyId), { name: trimmed });
}

export function setPartyCoLeader(partyId: string, coLeaderId: string) {
  const batch = writeBatch(db);
  batch.update(doc(db, "parties", partyId), { coLeaderId });
  return batch.commit();
}

export function clearPartyPointer(userId: string) {
  return writeBatch(db).update(doc(db, "profiles", userId), { partyId: "" }).commit();
}
