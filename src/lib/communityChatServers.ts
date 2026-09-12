import { addDoc, collection, deleteDoc, doc, getDocs, limit, onSnapshot, orderBy, query, runTransaction, updateDoc, writeBatch } from "firebase/firestore";
import { db } from "./firebase";
import type { ChatMessage, CommunityChatServer, Rank } from "../types";

const serversRef = collection(db, "communityChatServers");
const DEFAULT_TEXT_CHANNELS = [{ id: "general", name: "general" }, { id: "rules", name: "rules" }];
const DEFAULT_VOICE_CHANNELS = [{ id: "lounge", name: "Lounge" }];

function inviteCode() {
  return Math.random().toString(36).slice(2, 8).toUpperCase();
}

function withServerDefaults(id: string, data: Record<string, unknown>): CommunityChatServer {
  const ownerId = typeof data.ownerId === "string" ? data.ownerId : "";
  return {
    id,
    boostCount: 0,
    lastBoostedAt: 0,
    iconUrl: "",
    bannerUrl: "",
    linkedMinecraftServerId: "",
    inviteCode: typeof data.inviteCode === "string" ? data.inviteCode : inviteCode(),
    memberIds: Array.isArray(data.memberIds) ? data.memberIds.filter((item): item is string => typeof item === "string") : ownerId ? [ownerId] : [],
    bannedUserIds: Array.isArray(data.bannedUserIds) ? data.bannedUserIds.filter((item): item is string => typeof item === "string") : [],
    bannedUsernames: Array.isArray(data.bannedUsernames) ? data.bannedUsernames.filter((item): item is string => typeof item === "string") : [],
    roles: typeof data.roles === "object" && data.roles !== null ? data.roles as CommunityChatServer["roles"] : ownerId ? { [ownerId]: "owner" } : {},
    textChannels: Array.isArray(data.textChannels) && data.textChannels.length ? data.textChannels as CommunityChatServer["textChannels"] : DEFAULT_TEXT_CHANNELS,
    voiceChannels: Array.isArray(data.voiceChannels) && data.voiceChannels.length ? data.voiceChannels as CommunityChatServer["voiceChannels"] : DEFAULT_VOICE_CHANNELS,
    ...data,
  } as CommunityChatServer;
}

export function subscribeToCommunityChatServers(callback: (servers: CommunityChatServer[]) => void) {
  return onSnapshot(query(serversRef, orderBy("createdAt", "asc")), (snapshot) => {
    callback(snapshot.docs.map((item) => withServerDefaults(item.id, item.data())));
  });
}

export function createCommunityChatServer(input: Pick<CommunityChatServer, "name" | "description" | "rules" | "ownerId" | "ownerName" | "boostCount" | "lastBoostedAt"> & Partial<CommunityChatServer>) {
  return addDoc(serversRef, {
    ...input,
    iconUrl: input.iconUrl ?? "",
    bannerUrl: input.bannerUrl ?? "",
    linkedMinecraftServerId: input.linkedMinecraftServerId ?? "",
    inviteCode: input.inviteCode ?? inviteCode(),
    memberIds: input.memberIds ?? [input.ownerId],
    bannedUserIds: input.bannedUserIds ?? [],
    bannedUsernames: input.bannedUsernames ?? [],
    roles: input.roles ?? { [input.ownerId]: "owner" },
    textChannels: input.textChannels ?? DEFAULT_TEXT_CHANNELS,
    voiceChannels: input.voiceChannels ?? DEFAULT_VOICE_CHANNELS,
    createdAt: Date.now(),
  });
}

export async function boostCommunityChatServer(serverId: string, userId: string) {
  const serverRef = doc(db, "communityChatServers", serverId);
  const walletRef = doc(db, "wallets", userId);
  await runTransaction(db, async (transaction) => {
    const [server, wallet] = await Promise.all([transaction.get(serverRef), transaction.get(walletRef)]);
    if (!server.exists()) throw new Error("That server no longer exists.");
    const balance = Number(wallet.data()?.balance ?? 0);
    if (balance < 100) throw new Error("You need 100 credits to boost a server.");
    transaction.update(walletRef, { balance: balance - 100 });
    transaction.update(serverRef, {
      boostCount: Number(server.data().boostCount ?? 0) + 1,
      lastBoostedAt: Date.now(),
    });
  });
}

export function updateCommunityChatServer(serverId: string, input: Partial<Pick<CommunityChatServer, "name" | "description" | "rules" | "iconUrl" | "bannerUrl" | "linkedMinecraftServerId" | "memberIds" | "bannedUserIds" | "bannedUsernames" | "roles" | "textChannels" | "voiceChannels">>) {
  return updateDoc(doc(db, "communityChatServers", serverId), input);
}

export async function deleteCommunityChatServer(serverId: string) {
  const messages = await getDocs(messagesRef(serverId));
  for (let index = 0; index < messages.docs.length; index += 450) {
    const batch = writeBatch(db);
    messages.docs.slice(index, index + 450).forEach((message) => batch.delete(message.ref));
    await batch.commit();
  }
  await deleteDoc(doc(db, "communityChatServers", serverId));
}

function messagesRef(serverId: string, channelId = "general") {
  if (channelId === "general") return collection(db, "communityChatServers", serverId, "messages");
  return collection(db, "communityChatServers", serverId, "channels", channelId, "messages");
}

export function subscribeToCommunityChatMessages(serverId: string, callback: (messages: ChatMessage[]) => void, onError?: (error: Error) => void, channelId = "general") {
  return onSnapshot(query(messagesRef(serverId, channelId), orderBy("createdAt", "asc"), limit(100)), { includeMetadataChanges: true }, (snapshot) => {
    callback(snapshot.docs.map((item) => {
      const data = item.data();
      return {
        id: item.id,
        text: typeof data.text === "string" ? data.text : "",
        authorId: typeof data.authorId === "string" ? data.authorId : "",
        authorName: typeof data.authorName === "string" && data.authorName ? data.authorName : "Unknown member",
        authorRank: typeof data.authorRank === "string" ? data.authorRank : "none",
        authorPhotoUrl: typeof data.authorPhotoUrl === "string" ? data.authorPhotoUrl : "",
        replyToId: typeof data.replyToId === "string" ? data.replyToId : undefined,
        replyToAuthorId: typeof data.replyToAuthorId === "string" ? data.replyToAuthorId : undefined,
        replyToAuthor: typeof data.replyToAuthor === "string" ? data.replyToAuthor : undefined,
        replyToText: typeof data.replyToText === "string" ? data.replyToText : undefined,
        replyPing: typeof data.replyPing === "boolean" ? data.replyPing : undefined,
        createdAt: typeof data.createdAt === "number" ? data.createdAt : Date.now(),
        deliveryState: item.metadata.hasPendingWrites ? "sending" : "sent",
      } as ChatMessage;
    }));
  }, onError);
}

export function sendCommunityChatMessage(serverId: string, authorId: string, authorName: string, authorRank: Rank, authorPhotoUrl: string, text: string, replyTo?: { id: string; authorId: string; author: string; text: string; ping: boolean }, channelId = "general") {
  return addDoc(messagesRef(serverId, channelId), {
    authorId, authorName, authorRank, authorPhotoUrl, text, createdAt: Date.now(),
    ...(replyTo ? { replyToId: replyTo.id, replyToAuthorId: replyTo.authorId, replyToAuthor: replyTo.author, replyToText: replyTo.text.slice(0, 140), replyPing: replyTo.ping } : {}),
  });
}

export function deleteCommunityChatMessage(serverId: string, messageId: string, channelId = "general") {
  if (channelId === "general") return deleteDoc(doc(db, "communityChatServers", serverId, "messages", messageId));
  return deleteDoc(doc(db, "communityChatServers", serverId, "channels", channelId, "messages", messageId));
}
