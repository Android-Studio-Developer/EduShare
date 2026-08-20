import { collection, deleteDoc, doc, onSnapshot, setDoc } from "firebase/firestore";
import { db } from "./firebase";

export function subscribeToFavorites(userId: string, callback: (serverIds: string[]) => void) {
  return onSnapshot(collection(db, "users", userId, "favorites"), (snapshot) => callback(snapshot.docs.map((item) => item.id)));
}

export function addFavorite(userId: string, serverId: string) {
  return setDoc(doc(db, "users", userId, "favorites", serverId), { serverId, createdAt: Date.now() });
}

export function removeFavorite(userId: string, serverId: string) {
  return deleteDoc(doc(db, "users", userId, "favorites", serverId));
}
