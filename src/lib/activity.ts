import {
  addDoc,
  collection,
  limit,
  onSnapshot,
  orderBy,
  query,
} from "firebase/firestore";
import { db } from "./firebase";
import type { ActivityEvent, ActivityType } from "../types";

const activityRef = collection(db, "activity");

export async function logActivity(
  type: ActivityType,
  serverId: string,
  serverName: string,
  actorName: string,
) {
  await addDoc(activityRef, {
    type,
    serverId,
    serverName,
    actorName,
    createdAt: Date.now(),
  });
}

export function subscribeToActivity(
  callback: (events: ActivityEvent[]) => void,
  max = 12,
) {
  const q = query(activityRef, orderBy("createdAt", "desc"), limit(max));
  return onSnapshot(q, (snapshot) => {
    callback(
      snapshot.docs.map((d) => ({ id: d.id, ...d.data() }) as ActivityEvent),
    );
  });
}
