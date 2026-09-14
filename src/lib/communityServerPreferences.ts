import { collection, doc, getDocs, onSnapshot, setDoc } from "firebase/firestore";
import { db } from "./firebase";
import type { CommunityNotificationLevel } from "../types";

export function subscribeToCommunityNotificationLevel(serverId: string, userId: string, callback: (level: CommunityNotificationLevel) => void) {
  return onSnapshot(doc(db, "communityChatServers", serverId, "notificationPreferences", userId), (snapshot) => {
    const level = snapshot.data()?.level;
    callback(level === "all" || level === "none" ? level : "mentions");
  });
}

export function setCommunityNotificationLevel(serverId: string, userId: string, level: CommunityNotificationLevel) {
  return setDoc(doc(db, "communityChatServers", serverId, "notificationPreferences", userId), { userId, level, updatedAt: Date.now() });
}

export async function getCommunityNotificationLevels(serverId: string) {
  const snapshot = await getDocs(collection(db, "communityChatServers", serverId, "notificationPreferences"));
  return new Map(snapshot.docs.map((item) => {
    const level = item.data().level;
    return [item.id, level === "all" || level === "none" ? level : "mentions"] as const;
  }));
}
