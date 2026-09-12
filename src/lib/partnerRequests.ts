import { addDoc, collection, doc, getDoc, getDocs, onSnapshot, orderBy, query, updateDoc, where, writeBatch } from "firebase/firestore";
import { db } from "./firebase";
import type { PartnerRequest } from "../types";

export async function submitPartnerRequest(userId: string, serverId: string, serverName: string, message: string, contact: string) {
  const trimmedMessage = message.trim().slice(0, 500);
  if (!trimmedMessage) throw new Error("Tell us a bit about your server.");

  const [serverSnapshot, myRequests] = await Promise.all([
    getDoc(doc(db, "servers", serverId)),
    getDocs(query(collection(db, "partnerRequests"), where("userId", "==", userId))),
  ]);
  if (!serverSnapshot.exists() || serverSnapshot.data().ownerId !== userId) {
    throw new Error("You can only request partnership for a server you own.");
  }
  if (serverSnapshot.data().isPartner) throw new Error("This server is already an SpawnDex Partner.");
  if (myRequests.docs.some((item) => item.data().serverId === serverId && item.data().status === "open")) {
    throw new Error("This server already has a pending partner request.");
  }

  return addDoc(collection(db, "partnerRequests"), {
    userId,
    serverId,
    serverName: serverSnapshot.data().name || serverName,
    message: trimmedMessage,
    contact: contact.trim().slice(0, 200),
    status: "open",
    createdAt: Date.now(),
  });
}

export function subscribeToMyPartnerRequests(userId: string, callback: (requests: PartnerRequest[]) => void) {
  const q = query(collection(db, "partnerRequests"), where("userId", "==", userId));
  return onSnapshot(q, (snapshot) => callback(snapshot.docs.map((d) => ({ id: d.id, ...d.data() }) as PartnerRequest)));
}

export function subscribeToPartnerRequests(callback: (requests: PartnerRequest[]) => void) {
  const q = query(collection(db, "partnerRequests"), orderBy("createdAt", "desc"));
  return onSnapshot(q, (snapshot) => callback(snapshot.docs.map((d) => ({ id: d.id, ...d.data() }) as PartnerRequest)));
}

export function declinePartnerRequest(id: string) {
  return updateDoc(doc(db, "partnerRequests", id), { status: "declined" });
}

// Accepting does three things at once: mark the request handled, flag the
// server as a partner so it shows in the homepage spotlight, and grant the
// requester the exclusive Partner rank. Not atomic (three separate docs
// across two different rule branches), but each write is independently
// safe to retry/re-run if one fails partway.
export async function acceptPartnerRequest(request: PartnerRequest, perks: string) {
  const batch = writeBatch(db);
  batch.update(doc(db, "partnerRequests", request.id), { status: "accepted" });
  batch.update(doc(db, "servers", request.serverId), { isPartner: true, partnerPerks: perks.trim().slice(0, 500) });
  batch.update(doc(db, "profiles", request.userId), { rank: "partner" });
  await batch.commit();
}
