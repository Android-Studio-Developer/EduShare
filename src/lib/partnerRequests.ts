import { addDoc, collection, doc, onSnapshot, orderBy, query, updateDoc, where } from "firebase/firestore";
import { db } from "./firebase";
import { grantRank } from "./ranks";
import type { PartnerRequest } from "../types";

export function submitPartnerRequest(userId: string, serverId: string, serverName: string, message: string, contact: string) {
  const trimmedMessage = message.trim().slice(0, 500);
  if (!trimmedMessage) throw new Error("Tell us a bit about your server.");
  return addDoc(collection(db, "partnerRequests"), {
    userId,
    serverId,
    serverName,
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
  await updateDoc(doc(db, "partnerRequests", request.id), { status: "accepted" });
  await updateDoc(doc(db, "servers", request.serverId), { isPartner: true, partnerPerks: perks.trim().slice(0, 500) });
  await grantRank(request.userId, "partner");
}
