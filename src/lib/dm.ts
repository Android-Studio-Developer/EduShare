import { addDoc, arrayRemove, arrayUnion, collection, deleteDoc, doc, getDoc, onSnapshot, orderBy, query, setDoc, updateDoc, where } from "firebase/firestore";
import { db } from "./firebase";
import type { DmConversation, DmMessage } from "../types";

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

export const GROUP_DM_MAX_MEMBERS = 6;

// participantIds must include the creator themselves. Group chats get a
// random doc id (unlike 1:1 DMs, which use a deterministic sorted-pair id)
// since there's no fixed pair to derive one from.
export async function createGroupDm(participantIds: string[], ownerId: string, name: string, iconUrl = "") {
  const unique = [...new Set(participantIds)];
  if (unique.length < 3) throw new Error("Pick at least 2 other people for a group chat.");
  if (unique.length > GROUP_DM_MAX_MEMBERS) throw new Error(`Group chats are capped at ${GROUP_DM_MAX_MEMBERS} people.`);
  const ref = doc(collection(db, "dms"));
  await setDoc(ref, {
    participants: unique,
    isGroup: true,
    name: name.trim().slice(0, 60),
    ownerId,
    iconUrl: iconUrl.trim().slice(0, 1000),
    createdAt: Date.now(),
  });
  return ref.id;
}

// Removing yourself from a group — the only membership change this app
// supports post-creation (no invite/kick flow yet).
export function leaveGroupDm(dmId: string, uid: string) {
  return updateDoc(doc(db, "dms", dmId), { participants: arrayRemove(uid) });
}

// Owner-only (enforced in rules) — deletes the whole group. Only removes the
// parent doc, not the messages/typing subcollections (this app has no Cloud
// Functions to cascade-delete them) — those become permanently unreadable
// garbage anyway, since every read of them checks the parent doc still
// exists, so leaving them behind is harmless.
export function disbandGroupDm(dmId: string) {
  return deleteDoc(doc(db, "dms", dmId));
}

// Either participant of a 1:1 DM can delete it outright — mainly for
// clearing out a stale "Unknown player" conversation (e.g. the other
// account was deleted) that would otherwise sit in the list forever with no
// way to get rid of it. Same orphaned-subcollection tradeoff as above.
export function deleteDm(dmId: string) {
  return deleteDoc(doc(db, "dms", dmId));
}

// Owner-only (enforced in rules) — accepts a plain https(s) image URL, or an
// embed:/iframe: prefixed URL to render a sandboxed iframe instead, same
// convention as profile banners.
export function setGroupIcon(dmId: string, iconUrl: string) {
  return updateDoc(doc(db, "dms", dmId), { iconUrl: iconUrl.trim().slice(0, 1000) });
}

export function startDmCall(dmId: string, uid: string) {
  return updateDoc(doc(db, "dms", dmId), { callStartedAt: Date.now(), callStartedBy: uid });
}

export function endDmCall(dmId: string) {
  return updateDoc(doc(db, "dms", dmId), { callStartedAt: 0, callStartedBy: "" });
}

export function subscribeToDmMessages(dmId: string, callback: (messages: DmMessage[]) => void) {
  const q = query(messagesRef(dmId), orderBy("createdAt", "asc"));
  return onSnapshot(q, (snap) => {
    callback(snap.docs.map((d) => ({ id: d.id, ...d.data() }) as DmMessage));
  });
}

// Sorted client-side (not via orderBy in the query) so this doesn't need a
// composite index for the participants array-contains filter.
export function subscribeToMyDms(uid: string, callback: (conversations: DmConversation[]) => void) {
  const q = query(collection(db, "dms"), where("participants", "array-contains", uid));
  return onSnapshot(q, (snap) => {
    callback(
      snap.docs
        .map((d) => ({ id: d.id, lastMessageAt: 0, lastMessageText: "", lastMessageAuthorId: "", ...d.data() }) as DmConversation)
        .sort((a, b) => (b.lastMessageAt || b.createdAt) - (a.lastMessageAt || a.createdAt)),
    );
  });
}

export async function sendDmMessage(
  dmId: string,
  authorId: string,
  authorName: string,
  text: string,
  replyTo?: { id: string; author: string; text: string },
  isBot?: boolean,
  file?: { fileId: string; fileUrl: string; fileName: string; fileType: string; fileSize: number },
) {
  const createdAt = Date.now();
  const message = await addDoc(messagesRef(dmId), {
    text,
    authorId,
    authorName,
    createdAt,
    pinned: false,
    isBot: !!isBot,
    ...(replyTo ? { replyToId: replyTo.id, replyToAuthor: replyTo.author, replyToText: replyTo.text.slice(0, 120) } : {}),
    ...(file ? { fileId: file.fileId, fileUrl: file.fileUrl, fileName: file.fileName, fileType: file.fileType, fileSize: file.fileSize } : {}),
  });
  // Best-effort — a failed preview update shouldn't fail the actual send.
  // Bot messages (e.g. !ai replies) keep authorId as the human requester, so
  // the conversation-list preview still attributes to whoever's chatting.
  void updateDoc(doc(db, "dms", dmId), {
    lastMessageAt: createdAt,
    lastMessageText: (isBot ? `${authorName}: ` : "") + text.slice(0, 200),
    lastMessageAuthorId: authorId,
  }).catch(() => {});
  return message;
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
