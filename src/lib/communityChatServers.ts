import { addDoc, arrayRemove, arrayUnion, collection, deleteDoc, doc, getDocs, increment, limit, onSnapshot, orderBy, query, runTransaction, setDoc, updateDoc, where, writeBatch } from "firebase/firestore";
import { db } from "./firebase";
import type { ChatMessage, CommunityChatServer, DeveloperBot, DeveloperBotPanel, Rank } from "../types";
import { COMMUNITY_SERVER_BOOST_COST } from "./communityServerBoosts";

const serversRef = collection(db, "communityChatServers");
const DEFAULT_TEXT_CHANNELS = [{ id: "general", name: "general" }, { id: "rules", name: "rules" }];
const DEFAULT_VOICE_CHANNELS = [{ id: "lounge", name: "Lounge" }];

function inviteCode() {
  return Math.random().toString(36).slice(2, 8).toUpperCase();
}

function legacyInviteCode(id: string) {
  return id.replace(/[^a-z0-9]/gi, "").slice(0, 8).toUpperCase();
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
    inviteCode: typeof data.inviteCode === "string" && data.inviteCode ? data.inviteCode : legacyInviteCode(id),
    memberIds: Array.isArray(data.memberIds) ? data.memberIds.filter((item): item is string => typeof item === "string") : ownerId ? [ownerId] : [],
    bannedUserIds: Array.isArray(data.bannedUserIds) ? data.bannedUserIds.filter((item): item is string => typeof item === "string") : [],
    bannedUsernames: Array.isArray(data.bannedUsernames) ? data.bannedUsernames.filter((item): item is string => typeof item === "string") : [],
    roles: typeof data.roles === "object" && data.roles !== null ? data.roles as CommunityChatServer["roles"] : ownerId ? { [ownerId]: "owner" } : {},
    textChannels: Array.isArray(data.textChannels) && data.textChannels.length ? data.textChannels as CommunityChatServer["textChannels"] : DEFAULT_TEXT_CHANNELS,
    voiceChannels: Array.isArray(data.voiceChannels) && data.voiceChannels.length ? data.voiceChannels as CommunityChatServer["voiceChannels"] : DEFAULT_VOICE_CHANNELS,
    categories: Array.isArray(data.categories) ? data.categories as CommunityChatServer["categories"] : [],
    botIds: Array.isArray(data.botIds) ? data.botIds.filter((item): item is string => typeof item === "string") : [],
    themeColors: Array.isArray(data.themeColors) ? data.themeColors.filter((item): item is string => typeof item === "string").slice(0, 3) : [],
    isPublic: typeof data.isPublic === "boolean" ? data.isPublic : true,
    uploadCount: typeof data.uploadCount === "number" ? data.uploadCount : 0,
    ...data,
  } as CommunityChatServer;
}

export function subscribeToCommunityChatServers(callback: (servers: CommunityChatServer[]) => void) {
  return onSnapshot(query(serversRef, orderBy("createdAt", "asc")), (snapshot) => {
    callback(snapshot.docs.map((item) => withServerDefaults(item.id, item.data())));
  });
}

export function subscribeToCommunityChatServerByInviteCode(code: string, authenticated: boolean, callback: (server: CommunityChatServer | null) => void, onError?: (error: Error) => void) {
  const normalized = code.trim().toUpperCase();
  const inviteQuery = authenticated
    ? query(serversRef, where("inviteCode", "==", normalized), limit(1))
    : query(serversRef, where("inviteCode", "==", normalized), where("isPublic", "==", true), limit(1));
  return onSnapshot(inviteQuery, (snapshot) => {
    const match = snapshot.docs[0];
    callback(match ? withServerDefaults(match.id, match.data()) : null);
  }, onError);
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
    botIds: input.botIds ?? [],
    themeColors: input.themeColors ?? [],
    isPublic: input.isPublic ?? true,
    uploadCount: input.uploadCount ?? 0,
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
    if (balance < COMMUNITY_SERVER_BOOST_COST) throw new Error(`You need ${COMMUNITY_SERVER_BOOST_COST} credits to boost a server.`);
    transaction.update(walletRef, { balance: balance - COMMUNITY_SERVER_BOOST_COST });
    transaction.update(serverRef, {
      boostCount: Number(server.data().boostCount ?? 0) + 1,
      lastBoostedAt: Date.now(),
    });
  });
}

export function updateCommunityChatServer(serverId: string, input: Partial<Pick<CommunityChatServer, "name" | "description" | "rules" | "iconUrl" | "bannerUrl" | "linkedMinecraftServerId" | "memberIds" | "bannedUserIds" | "bannedUsernames" | "roles" | "textChannels" | "voiceChannels" | "categories" | "botIds" | "themeColors" | "isPublic">>) {
  return updateDoc(doc(db, "communityChatServers", serverId), input);
}

export function joinCommunityChatServer(serverId: string, userId: string) {
  // TEMP DIAGNOSTIC — pin down an unexplained auto-rejoin bug. Remove once
  // found. Logs a real stack trace so devtools shows exactly which call
  // site fired, not just "join happened".
  console.warn(`[join-debug] joinCommunityChatServer called: server=${serverId} user=${userId}`, new Error().stack);
  return updateDoc(doc(db, "communityChatServers", serverId), { memberIds: arrayUnion(userId) });
}

export function leaveCommunityChatServer(serverId: string, userId: string) {
  return updateDoc(doc(db, "communityChatServers", serverId), { memberIds: arrayRemove(userId) });
}

const MAX_SERVER_UPLOADS = 3;

export function communityServerUploadsRemaining(server: Pick<CommunityChatServer, "uploadCount">) {
  return Math.max(0, MAX_SERVER_UPLOADS - (server.uploadCount ?? 0));
}

export function recordCommunityServerUpload(serverId: string) {
  return updateDoc(doc(db, "communityChatServers", serverId), { uploadCount: increment(1) });
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
        isBot: data.isBot === true,
        botId: typeof data.botId === "string" ? data.botId : undefined,
        triggeredById: typeof data.triggeredById === "string" ? data.triggeredById : undefined,
        botPanel: data.botPanel && typeof data.botPanel === "object" ? data.botPanel as DeveloperBotPanel : undefined,
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

export function sendCommunityBotMessage(serverId: string, triggeredById: string, bot: DeveloperBot, text: string, channelId = "general", botPanel?: DeveloperBotPanel) {
  return addDoc(messagesRef(serverId, channelId), {
    authorId: bot.id,
    authorName: bot.name,
    authorRank: "none",
    authorPhotoUrl: bot.avatarUrl || "",
    text: text.slice(0, 500),
    isBot: true,
    botId: bot.id,
    triggeredById,
    createdAt: Date.now(),
    ...(botPanel ? { botPanel } : {}),
  });
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

// Typing indicator — one flat "typing" subcollection per server, keyed by
// channelId+userId so it doesn't need a per-channel path like messages does.
// Callers debounce writes client-side; readers ignore anything stale (the
// UI treats > 6s old as "stopped typing" instead of relying on a delete
// always landing, since a closed tab never fires one).
const TYPING_STALE_MS = 6_000;

function typingDocId(channelId: string, userId: string) {
  return `${channelId}__${userId}`;
}

export function setTyping(serverId: string, channelId: string, userId: string, name: string) {
  return setDoc(doc(db, "communityChatServers", serverId, "typing", typingDocId(channelId, userId)), {
    channelId,
    userId,
    name,
    updatedAt: Date.now(),
  });
}

export function clearTyping(serverId: string, channelId: string, userId: string) {
  return deleteDoc(doc(db, "communityChatServers", serverId, "typing", typingDocId(channelId, userId))).catch(() => undefined);
}

export function subscribeToTyping(serverId: string, channelId: string, callback: (typers: { userId: string; name: string }[]) => void) {
  const typingQuery = query(collection(db, "communityChatServers", serverId, "typing"), where("channelId", "==", channelId));
  return onSnapshot(typingQuery, (snapshot) => {
    const now = Date.now();
    callback(
      snapshot.docs
        .map((item) => item.data() as { userId?: string; name?: string; updatedAt?: number })
        .filter((item) => typeof item.updatedAt === "number" && now - item.updatedAt < TYPING_STALE_MS && item.userId && item.name)
        .map((item) => ({ userId: item.userId as string, name: item.name as string })),
    );
  });
}
