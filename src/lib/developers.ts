import {
  addDoc,
  arrayUnion,
  collection,
  doc,
  onSnapshot,
  query,
  runTransaction,
  setDoc,
  updateDoc,
  where,
} from "firebase/firestore";
import { db } from "./firebase";
import { createNotification } from "./notifications";
import type { DeveloperApplication, DeveloperAuditEvent, DeveloperBot, DeveloperBotCommand, DeveloperBotEvent } from "../types";

const cleanCommands = (commands: DeveloperBotCommand[]) => commands
  .map((command) => ({
    name: command.name.trim().toLowerCase().replace(/[^a-z0-9_-]/g, "").slice(0, 24),
    response: command.response.trim().slice(0, 300),
    action: command.action === "verify" ? "verify" as const : "reply" as const,
  }))
  .filter((command, index, items) => command.name && command.response && items.findIndex((item) => item.name === command.name) === index)
  .slice(0, 12);

const BOT_WRITE_TIMEOUT_MS = 15_000;

function withBotWriteTimeout<T>(operation: Promise<T>) {
  let timeoutId = 0;
  const timeout = new Promise<never>((_, reject) => {
    timeoutId = window.setTimeout(() => reject(new Error("SpawnDex could not reach Firebase. Check your connection, then try again.")), BOT_WRITE_TIMEOUT_MS);
  });
  return Promise.race([operation, timeout]).finally(() => window.clearTimeout(timeoutId));
}

export function subscribeToDeveloperApplication(userId: string, callback: (application: DeveloperApplication | null) => void) {
  return onSnapshot(doc(db, "developerApplications", userId), (snapshot) => {
    callback(snapshot.exists() ? ({ id: snapshot.id, ...snapshot.data() } as DeveloperApplication) : null);
  });
}

export function subscribeToDeveloperApplications(callback: (applications: DeveloperApplication[]) => void) {
  return onSnapshot(collection(db, "developerApplications"), (snapshot) => {
    callback(snapshot.docs.map((item) => ({ id: item.id, ...item.data() }) as DeveloperApplication).sort((a, b) => b.createdAt - a.createdAt));
  });
}

export function submitDeveloperApplication(data: Omit<DeveloperApplication, "id" | "status" | "createdAt" | "reviewedAt" | "reviewedBy">) {
  return setDoc(doc(db, "developerApplications", data.userId), {
    ...data,
    status: "pending",
    createdAt: Date.now(),
  });
}

export async function reviewDeveloperApplication(application: DeveloperApplication, decision: "approved" | "rejected", reviewerId: string) {
  await updateDoc(doc(db, "developerApplications", application.id), {
    status: decision,
    reviewedAt: Date.now(),
    reviewedBy: reviewerId,
  });
  await createNotification({
    recipientId: application.userId,
    type: "moderation",
    title: `Developer application ${decision}`,
    message: decision === "approved" ? "Your SpawnDex bot studio is ready." : "Your developer application was not approved this time.",
    link: "/develop",
  });
  void logDeveloperAudit({ actorId: reviewerId, actorName: "Staff", botOwnerId: application.userId, botId: "", botName: application.botIdea.slice(0, 50), action: decision === "approved" ? "application_approved" : "application_rejected" }).catch(() => undefined);
}

export function subscribeToDeveloperBots(callback: (bots: DeveloperBot[]) => void) {
  return onSnapshot(collection(db, "developerBots"), (snapshot) => {
    callback(snapshot.docs.map((item) => ({ id: item.id, verificationEnabled: false, ...item.data() }) as DeveloperBot).sort((a, b) => b.updatedAt - a.updatedAt));
  });
}

export function subscribeToMyDeveloperBots(userId: string, callback: (bots: DeveloperBot[]) => void, onError?: (error: Error) => void) {
  return onSnapshot(query(collection(db, "developerBots"), where("ownerId", "==", userId)), (snapshot) => {
    callback(snapshot.docs.map((item) => ({ id: item.id, verificationEnabled: false, ...item.data() }) as DeveloperBot).sort((a, b) => b.updatedAt - a.updatedAt));
  }, (error) => onError?.(error));
}

export async function createDeveloperBot(ownerId: string, ownerName: string, name: string) {
  const cleanName = name.trim().slice(0, 32);
  const baseHandle = cleanName.toLowerCase().replace(/[^a-z0-9_]/g, "").slice(0, 19) || "newbot";
  const handle = `${baseHandle}_${Math.random().toString(36).slice(2, 6)}`;
  const now = Date.now();
  const botRef = doc(collection(db, "developerBots"));
  await withBotWriteTimeout(runTransaction(db, async (transaction) => {
    const handleRef = doc(db, "botHandles", handle);
    if ((await transaction.get(handleRef)).exists()) throw new Error("That bot handle is already taken.");
    transaction.set(botRef, {
      ownerId,
      ownerName: ownerName.trim().slice(0, 50),
      name: cleanName,
      handle,
      description: "",
      avatarUrl: "",
      enabled: false,
      verificationEnabled: false,
      prefix: "?",
      commands: [{ name: "hello", response: "Hey {user}!" }],
      createdAt: now,
      updatedAt: now,
    });
    transaction.set(handleRef, { botId: botRef.id, ownerId, createdAt: now });
  }));
  void logDeveloperAudit({ actorId: ownerId, actorName: ownerName, botOwnerId: ownerId, botId: botRef.id, botName: cleanName, action: "bot_created" }).catch(() => undefined);
  return botRef;
}

export async function updateDeveloperBot(bot: DeveloperBot, data: Pick<DeveloperBot, "name" | "handle" | "description" | "avatarUrl" | "enabled" | "verificationEnabled" | "prefix" | "commands">) {
  const handle = data.handle.trim().toLowerCase().replace(/[^a-z0-9_]/g, "").slice(0, 24);
  await runTransaction(db, async (transaction) => {
    const oldHandleRef = doc(db, "botHandles", bot.handle);
    const handleRef = doc(db, "botHandles", handle);
    const handleSnapshot = await transaction.get(handleRef);
    if (handle !== bot.handle) {
      if (handleSnapshot.exists()) throw new Error("That bot handle is already taken.");
      transaction.delete(oldHandleRef);
      transaction.set(handleRef, { botId: bot.id, ownerId: bot.ownerId, createdAt: Date.now() });
    } else if (!handleSnapshot.exists()) {
      // Backfill reservations for bots created before handles became unique.
      transaction.set(handleRef, { botId: bot.id, ownerId: bot.ownerId, createdAt: Date.now() });
    } else if (handleSnapshot.data().botId !== bot.id) {
      throw new Error("That bot handle is already taken.");
    }
    transaction.update(doc(db, "developerBots", bot.id), {
      name: data.name.trim().slice(0, 32),
      handle,
      description: data.description.trim().slice(0, 160),
      avatarUrl: data.avatarUrl.trim().slice(0, 500),
      enabled: data.enabled,
      verificationEnabled: data.verificationEnabled,
      prefix: ["?", ".", "$", "/"].includes(data.prefix) ? data.prefix : "?",
      commands: cleanCommands(data.commands),
      updatedAt: Date.now(),
    });
  });
  void logDeveloperAudit({ actorId: bot.ownerId, actorName: bot.ownerName, botOwnerId: bot.ownerId, botId: bot.id, botName: data.name, action: "bot_updated" }).catch(() => undefined);
}

export function verifyWithDeveloperBot(botId: string, userId: string) {
  return updateDoc(doc(db, "profiles", userId), { verifiedBotIds: arrayUnion(botId), lastVerifiedBotId: botId });
}

export async function deleteDeveloperBot(bot: DeveloperBot) {
  await runTransaction(db, async (transaction) => {
    transaction.delete(doc(db, "developerBots", bot.id));
    transaction.delete(doc(db, "botHandles", bot.handle));
  });
  void logDeveloperAudit({ actorId: bot.ownerId, actorName: bot.ownerName, botOwnerId: bot.ownerId, botId: bot.id, botName: bot.name, action: "bot_deleted" }).catch(() => undefined);
}

export function recordDeveloperBotEvent(botId: string, event: Omit<DeveloperBotEvent, "id" | "botId" | "createdAt">) {
  return addDoc(collection(db, "developerBots", botId, "events"), { ...event, botId, createdAt: Date.now() });
}

export function subscribeToDeveloperBotEvents(botId: string, callback: (events: DeveloperBotEvent[]) => void) {
  return onSnapshot(collection(db, "developerBots", botId, "events"), (snapshot) => callback(snapshot.docs.map((item) => ({ id: item.id, ...item.data() }) as DeveloperBotEvent).sort((a, b) => b.createdAt - a.createdAt).slice(0, 100)));
}

export function logDeveloperAudit(event: Omit<DeveloperAuditEvent, "id" | "createdAt">) {
  return addDoc(collection(db, "developerAudit"), { ...event, createdAt: Date.now() });
}

export function subscribeToDeveloperAudit(userId: string, callback: (events: DeveloperAuditEvent[]) => void) {
  return onSnapshot(query(collection(db, "developerAudit"), where("botOwnerId", "==", userId)), (snapshot) => callback(snapshot.docs.map((item) => ({ id: item.id, ...item.data() }) as DeveloperAuditEvent).sort((a, b) => b.createdAt - a.createdAt).slice(0, 50)));
}
