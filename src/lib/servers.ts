import {
  addDoc,
  collection,
  doc,
  getDoc,
  getDocs,
  increment,
  onSnapshot,
  orderBy,
  query,
  updateDoc,
  where,
  setDoc,
} from "firebase/firestore";
import { db } from "./firebase";
import { logActivity } from "./activity";
import { sendPublicMessage } from "./chat";
import { createNotification } from "./notifications";
import type { MinecraftServer, NewServerInput } from "../types";

const serversRef = collection(db, "servers");

export function subscribeToServers(
  callback: (servers: MinecraftServer[]) => void,
) {
  const q = query(serversRef, orderBy("createdAt", "desc"));
  return onSnapshot(q, (snapshot) => {
    callback(
      snapshot.docs.map(
        (d) => ({ id: d.id, ...d.data() }) as MinecraftServer,
      ),
    );
  });
}

export function subscribeToMyServers(
  ownerId: string,
  callback: (servers: MinecraftServer[]) => void,
) {
  const q = query(serversRef, where("ownerId", "==", ownerId));
  return onSnapshot(q, (snapshot) => {
    const servers = snapshot.docs.map(
      (d) => ({ id: d.id, ...d.data() }) as MinecraftServer,
    );
    servers.sort((a, b) => b.createdAt - a.createdAt);
    callback(servers);
  });
}

export async function getServer(id: string): Promise<MinecraftServer | null> {
  const snap = await getDoc(doc(db, "servers", id));
  if (!snap.exists()) return null;
  return { id: snap.id, ...snap.data() } as MinecraftServer;
}

export function subscribeToServer(
  id: string,
  callback: (server: MinecraftServer | null) => void,
) {
  return onSnapshot(doc(db, "servers", id), (snap) => {
    callback(snap.exists() ? ({ id: snap.id, ...snap.data() } as MinecraftServer) : null);
  });
}

export async function createServer(
  input: NewServerInput,
  ownerId: string,
  ownerName: string,
) {
  const docRef = await addDoc(serversRef, {
    ...input,
    ownerId,
    ownerName,
    joinsCount: 0,
    visitsCount: 0,
    isOnline: false,
    isVerified: false,
    isPartner: false,
    partnerPerks: "",
    slowModeSeconds: 0,
    bannedUserIds: [],
    managerIds: [],
    createdAt: Date.now(),
  });
  await logActivity("server_created", docRef.id, input.name, ownerName);
  return docRef;
}

export async function recordJoin(id: string, serverName: string, actorName = "A player", userId?: string) {
  await updateDoc(doc(db, "servers", id), {
    joinsCount: increment(1),
  });
  if (userId) await setDoc(doc(db, "servers", id, "codeUnlocks", userId), { userId, unlockedAt: Date.now() });
  await logActivity("code_unlocked", id, serverName, actorName);
}

export async function recordVisit(id: string) {
  const key = `edushare-visited:${id}`;
  if (sessionStorage.getItem(key)) return;
  sessionStorage.setItem(key, "1");
  await updateDoc(doc(db, "servers", id), { visitsCount: increment(1) });
}

export async function setServerOnline(id: string, serverName: string, wasOnline: boolean, actorId: string) {
  await updateDoc(doc(db, "servers", id), { isOnline: !wasOnline });
  // Host ping — only fires on the offline→online transition, not the reverse.
  if (wasOnline) return;
  void sendPublicMessage(
    actorId,
    "eduBot",
    `@everyone 🟢 ${serverName} just came online — hop in and join!`,
    "none",
    { isBot: true },
  );
  const profilesSnap = await getDocs(collection(db, "profiles"));
  profilesSnap.docs.forEach((profileDoc) => {
    if (profileDoc.id === actorId) return;
    void createNotification({
      recipientId: profileDoc.id,
      type: "mention",
      title: `${serverName} just came online`,
      message: "eduBot pinged @everyone in Global Chat — join now!",
      link: "/chat",
    });
  });
}

export async function updateServerCode(id: string, code: string[]) {
  await updateDoc(doc(db, "servers", id), { code });
}

export async function setServerShopEnabled(id: string, hasShop: boolean) {
  await updateDoc(doc(db, "servers", id), { hasShop });
}

export async function setServerVerified(id: string, isVerified: boolean) {
  await updateDoc(doc(db, "servers", id), { isVerified });
}

export async function updateServerModeration(id:string, slowModeSeconds:number, bannedUserIds:string[], managerIds:string[]){await updateDoc(doc(db,"servers",id),{slowModeSeconds,bannedUserIds,managerIds});}
