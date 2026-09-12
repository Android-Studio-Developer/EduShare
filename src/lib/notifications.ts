import { addDoc, collection, doc, onSnapshot, query, updateDoc, where, writeBatch } from "firebase/firestore";
import { db } from "./firebase";
import type { SiteNotification } from "../types";

export function createNotification(notification: Omit<SiteNotification, "id" | "read" | "createdAt">) {
  return addDoc(collection(db, "notifications"), { ...notification, read: false, createdAt: Date.now() });
}
export function subscribeToNotifications(userId: string, callback: (items: SiteNotification[]) => void) {
  const q = query(collection(db, "notifications"), where("recipientId", "==", userId));
  return onSnapshot(q, (snapshot) => callback(snapshot.docs.map((item) => ({ id: item.id, ...item.data() }) as SiteNotification).sort((a,b)=>b.createdAt-a.createdAt)));
}
export function markNotificationRead(id: string) { return updateDoc(doc(db, "notifications", id), { read: true }); }
export async function markAllNotificationsRead(items: SiteNotification[]) {
  const unread = items.filter((item) => !item.read);
  if (unread.length === 0) return;
  const batch = writeBatch(db);
  unread.forEach((item) => batch.update(doc(db, "notifications", item.id), { read: true }));
  await batch.commit();
}
