import { addDoc, collection, doc, onSnapshot, orderBy, query, updateDoc } from "firebase/firestore";
import { db } from "./firebase";
import type { AccountRecoveryRequest } from "../types";

export function submitRecoveryRequest(input: string, contact: string) {
  const trimmedInput = input.trim().slice(0, 100);
  if (!trimmedInput) throw new Error("Enter the email or username you remember.");
  return addDoc(collection(db, "accountRecoveryRequests"), {
    input: trimmedInput,
    contact: contact.trim().slice(0, 200),
    status: "open",
    createdAt: Date.now(),
  });
}

export function subscribeToRecoveryRequests(callback: (requests: AccountRecoveryRequest[]) => void) {
  const q = query(collection(db, "accountRecoveryRequests"), orderBy("createdAt", "desc"));
  return onSnapshot(q, (snapshot) => callback(snapshot.docs.map((d) => ({ id: d.id, ...d.data() }) as AccountRecoveryRequest)));
}

export function resolveRecoveryRequest(id: string) {
  return updateDoc(doc(db, "accountRecoveryRequests", id), { status: "resolved" });
}
