import { addDoc, arrayRemove, arrayUnion, collection, deleteDoc, doc, getDoc, onSnapshot, orderBy, query, setDoc, updateDoc } from "firebase/firestore";
import { db } from "./firebase";
import type { DmMessage } from "../types";

export interface DmTyper {
  id: string;
  displayName: string;
  updatedAt: number;
}

export function dmIdFor(a: string, b: string) {
  return [a, b].sort().join("_");
}

function messagesRef(dmId: string) {
  return collection(db, "dms", dmId, "messages");
}

function typingRef(dmId: string) {
  return collection(db, "dms", dmId, "typing");
}

export function setDmTyping(dmId: string, uid: string, displayName: string) {
  return setDoc(doc(typingRef(dmId), uid), { displayName, updatedAt: Date.now() });
}

export function clearDmTyping(dmId: string, uid: string) {
  return deleteDoc(doc(typingRef(dmId), uid)).catch(() => {});
}

export function subscribeToDmTyping(dmId: string, callback: (typers: DmTyper[]) => void) {
  return onSnapshot(typingRef(dmId), (snap) => {
    callback(snap.docs.map((d) => ({ id: d.id, ...d.data() }) as DmTyper));
  });
}

export async function ensureDm(a: string, b: string) {
  const dmId = dmIdFor(a, b);
  const ref = doc(db, "dms", dmId);
  const snap = await getDoc(ref);
  if (!snap.exists()) {
    await setDoc(ref, { participants: [a, b], createdAt: Date.now() });
  }
  return dmId;
}

export function subscribeToDmMessages(dmId: string, callback: (messages: DmMessage[]) => void) {
  const q = query(messagesRef(dmId), orderBy("createdAt", "asc"));
  return onSnapshot(q, (snap) => {
    callback(snap.docs.map((d) => ({ id: d.id, ...d.data() }) as DmMessage));
  });
}

export function sendDmMessage(
  dmId: string,
  authorId: string,
  authorName: string,
  text: string,
  replyTo?: { id: string; author: string; text: string },
  isBot?: boolean,
  file?: { fileId: string; fileUrl: string; fileName: string; fileType: string; fileSize: number },
) {
  return addDoc(messagesRef(dmId), {
    text,
    authorId,
    authorName,
    createdAt: Date.now(),
    pinned: false,
    isBot: !!isBot,
    ...(replyTo ? { replyToId: replyTo.id, replyToAuthor: replyTo.author, replyToText: replyTo.text.slice(0, 120) } : {}),
    ...(file ? { fileId: file.fileId, fileUrl: file.fileUrl, fileName: file.fileName, fileType: file.fileType, fileSize: file.fileSize } : {}),
  });
}

export function toggleDmPin(dmId: string, messageId: string, pinned: boolean) {
  return updateDoc(doc(db, "dms", dmId, "messages", messageId), { pinned });
}

export function toggleDmReaction(dmId: string, messageId: string, emoji: string, uid: string, add: boolean) {
  return updateDoc(doc(db, "dms", dmId, "messages", messageId), {
    [`reactions.${emoji}`]: add ? arrayUnion(uid) : arrayRemove(uid),
  });
}

export function deleteDmMessage(dmId: string, messageId: string) {
  return deleteDoc(doc(db, "dms", dmId, "messages", messageId));
}
