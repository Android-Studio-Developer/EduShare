import {
  addDoc,
  arrayRemove,
  arrayUnion,
  collection,
  getDocs,
  limit,
  onSnapshot,
  orderBy,
  query,
  deleteDoc,
  doc,
  runTransaction,
  updateDoc,
  writeBatch,
} from "firebase/firestore";
import { db } from "./firebase";
import { logActivity } from "./activity";
import { deleteChatFile } from "./appwrite";
import type { ChatMessage, Rank } from "../types";

export function togglePublicReaction(messageId: string, emoji: string, uid: string, add: boolean) {
  return updateDoc(doc(db, "publicChat", messageId), { [`reactions.${emoji}`]: add ? arrayUnion(uid) : arrayRemove(uid) });
}

export function toggleServerReaction(serverId: string, messageId: string, emoji: string, uid: string, add: boolean) {
  return updateDoc(doc(db, "servers", serverId, "messages", messageId), { [`reactions.${emoji}`]: add ? arrayUnion(uid) : arrayRemove(uid) });
}

export async function votePublicPoll(messageId: string, optionIndex: number, uid: string) {
  const ref = doc(db, "publicChat", messageId);
  await runTransaction(db, async (transaction) => {
    const snap = await transaction.get(ref);
    if (!snap.exists()) return;
    const poll = snap.data().poll as { question: string; options: string[]; votes: Record<string, string[]> } | undefined;
    if (!poll || optionIndex < 0 || optionIndex >= poll.options.length) return;
    const votes: Record<string, string[]> = {};
    poll.options.forEach((_, index) => { votes[String(index)] = (poll.votes?.[String(index)] ?? []).filter((id) => id !== uid); });
    votes[String(optionIndex)] = [...(votes[String(optionIndex)] ?? []), uid];
    transaction.update(ref, { poll: { ...poll, votes } });
  });
}

export function togglePublicPin(messageId: string, pinned: boolean) { return updateDoc(doc(db, "publicChat", messageId), { pinned }); }

export async function voteServerPoll(serverId: string, messageId: string, optionIndex: number, uid: string) {
  const ref = doc(db, "servers", serverId, "messages", messageId);
  await runTransaction(db, async (transaction) => {
    const snap = await transaction.get(ref);
    if (!snap.exists()) return;
    const poll = snap.data().poll as { question: string; options: string[]; votes: Record<string, string[]> } | undefined;
    if (!poll || optionIndex < 0 || optionIndex >= poll.options.length) return;
    const votes: Record<string, string[]> = {};
    poll.options.forEach((_, index) => { votes[String(index)] = (poll.votes?.[String(index)] ?? []).filter((id) => id !== uid); });
    votes[String(optionIndex)] = [...(votes[String(optionIndex)] ?? []), uid];
    transaction.update(ref, { poll: { ...poll, votes } });
  });
}

function messagesRef(serverId: string) { return collection(db, "servers", serverId, "messages"); }
function publicMessagesRef() { return collection(db, "publicChat"); }
export function deletePublicMessage(messageId: string) { return deleteDoc(doc(db, "publicChat", messageId)); }

export async function clearPublicMessages() {
  const snap = await getDocs(publicMessagesRef());
  for (let i = 0; i < snap.docs.length; i += 450) {
    const batch = writeBatch(db); snap.docs.slice(i, i + 450).forEach((d) => batch.delete(d.ref)); await batch.commit();
  }
}

export async function sendPublicMessage(authorId: string, authorName: string, text: string, authorRank: Rank = "none", opts: {
  authorPhotoUrl?: string; isBot?: boolean; fileId?: string; fileUrl?: string; fileName?: string; fileType?: string; fileSize?: number;
  replyTo?: { id: string; author: string; text: string };
  poll?: { question: string; options: string[]; votes: Record<string, string[]> };
} = {}) {
  return addDoc(publicMessagesRef(), {
    text, authorId, authorName, authorRank, authorPhotoUrl: opts.authorPhotoUrl ?? "", isBot: !!opts.isBot, createdAt: Date.now(),
    ...(opts.fileId ? { fileId: opts.fileId, fileUrl: opts.fileUrl, fileName: opts.fileName, fileType: opts.fileType, fileSize: opts.fileSize } : {}),
    ...(opts.replyTo ? { replyToId: opts.replyTo.id, replyToAuthor: opts.replyTo.author, replyToText: opts.replyTo.text.slice(0, 140) } : {}),
    ...(opts.poll ? { poll: opts.poll } : {}),
  });
}

export async function clearPublicChatFiles() {
  const snap = await getDocs(publicMessagesRef());
  const withFiles = snap.docs.filter((d) => d.data().fileId);
  await Promise.all(withFiles.map((d) => deleteChatFile(d.data().fileId as string)));
  for (let i = 0; i < withFiles.length; i += 450) { const batch = writeBatch(db); withFiles.slice(i, i + 450).forEach((d) => batch.delete(d.ref)); await batch.commit(); }
  return withFiles.length;
}

export function subscribeToPublicMessages(callback: (messages: ChatMessage[]) => void, max = 100) {
  const q = query(publicMessagesRef(), orderBy("createdAt", "asc"), limit(max));
  return onSnapshot(q, (snapshot) => callback(snapshot.docs.map((d) => ({ id: d.id, ...d.data() }) as ChatMessage)));
}

export function deleteMessage(serverId: string, messageId: string) { return deleteDoc(doc(db, "servers", serverId, "messages", messageId)); }

export async function sendMessage(serverId: string, serverName: string, authorId: string, authorName: string, text: string, authorRank: Rank = "none", opts: {
  replyTo?: { id: string; author: string; text: string };
  poll?: { question: string; options: string[]; votes: Record<string, string[]> };
} = {}) {
  const ref = await addDoc(messagesRef(serverId), {
    text, authorId, authorName, authorRank, createdAt: Date.now(),
    ...(opts.replyTo ? { replyToId: opts.replyTo.id, replyToAuthor: opts.replyTo.author, replyToText: opts.replyTo.text.slice(0, 140) } : {}),
    ...(opts.poll ? { poll: opts.poll } : {}),
  });
  await logActivity("chat_message", serverId, serverName, authorName);
  return ref;
}

export function subscribeToMessages(serverId: string, callback: (messages: ChatMessage[]) => void, max = 100) {
  const q = query(messagesRef(serverId), orderBy("createdAt", "asc"), limit(max));
  return onSnapshot(q, (snapshot) => callback(snapshot.docs.map((d) => ({ id: d.id, ...d.data() }) as ChatMessage)));
}
