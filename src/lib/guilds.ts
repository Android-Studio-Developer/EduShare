import { arrayRemove, arrayUnion, collection, deleteDoc, doc, getDoc, onSnapshot, orderBy, query, updateDoc, writeBatch } from "firebase/firestore";
import { db } from "./firebase";
import type { Guild, GuildTagFont, GuildTagIcon, GroupNameEffect } from "../types";

export const GUILD_MAX_MEMBERS = 100;

function guildsRef() {
  return collection(db, "guilds");
}

export function subscribeToGuilds(callback: (guilds: Guild[]) => void) {
  const q = query(guildsRef(), orderBy("createdAt", "desc"));
  return onSnapshot(q, (snapshot) => callback(snapshot.docs.map((d) => ({ id: d.id, ...d.data() }) as Guild)));
}

export function subscribeToGuild(guildId: string, callback: (guild: Guild | null) => void) {
  return onSnapshot(doc(db, "guilds", guildId), (snapshot) => callback(snapshot.exists() ? ({ id: snapshot.id, ...snapshot.data() } as Guild) : null));
}

export async function createGuild(userId: string, ownerName: string, name: string) {
  const trimmed = name.trim().slice(0, 40);
  if (!trimmed) throw new Error("Give your guild a name.");
  const ref = doc(guildsRef());
  const batch = writeBatch(db);
  batch.set(ref, {
    name: trimmed,
    tag: "",
    tagIcon: "leaf",
    tagFont: "mono",
    tagImageUrl: "",
    tagColor: "#86efac",
    ownerId: userId,
    ownerName,
    coOwnerId: "",
    memberIds: [userId],
    nameColor: "",
    nameEffect: "none" as GroupNameEffect,
    nameGlow: false,
    createdAt: Date.now(),
  });
  batch.update(doc(db, "profiles", userId), { guildId: ref.id });
  await batch.commit();
  return ref.id;
}

export async function joinGuild(guildId: string, userId: string) {
  const batch = writeBatch(db);
  batch.update(doc(db, "guilds", guildId), { memberIds: arrayUnion(userId) });
  batch.update(doc(db, "profiles", userId), { guildId });
  await batch.commit();
}

export async function leaveGuild(guildId: string, userId: string) {
  const guildSnap = await getDoc(doc(db, "guilds", guildId));
  const wasCoOwner = guildSnap.data()?.coOwnerId === userId;
  const batch = writeBatch(db);
  batch.update(doc(db, "guilds", guildId), {
    memberIds: arrayRemove(userId),
    ...(wasCoOwner ? { coOwnerId: "" } : {}),
  });
  batch.update(doc(db, "profiles", userId), { guildId: "" });
  await batch.commit();
}

export function disbandGuild(guildId: string) {
  return deleteDoc(doc(db, "guilds", guildId));
}

export function setGuildCoOwner(guildId: string, coOwnerId: string) {
  return writeBatch(db).update(doc(db, "guilds", guildId), { coOwnerId }).commit();
}

export function styleGuildName(guildId: string, nameColor: string, nameEffect: GroupNameEffect, nameGlow: boolean) {
  return writeBatch(db).update(doc(db, "guilds", guildId), { nameColor, nameEffect, nameGlow }).commit();
}

export function renameGuild(guildId: string, name: string) {
  const trimmed = name.trim().slice(0, 40);
  if (!trimmed) throw new Error("Give your guild a name.");
  return updateDoc(doc(db, "guilds", guildId), { name: trimmed });
}

export function setGuildTag(guildId: string, tag: string, tagIcon: GuildTagIcon, tagFont: GuildTagFont, tagImageUrl = "", tagColor = "#86efac") {
  const normalized = tag.trim().toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 5);
  const rawImageUrl = tagImageUrl.trim().replace(/^embed:/i, "");
  if (rawImageUrl && !/^https?:\/\//i.test(rawImageUrl)) throw new Error("Badge image must use an http(s) URL.");
  const safeColor = /^#[0-9a-f]{6}$/i.test(tagColor) ? tagColor : "#86efac";
  const safeIcon: GuildTagIcon = (["leaf","swords","heart","flame","droplet","skull","moon","zap","sparkles","mushroom"] as string[]).includes(tagIcon) ? tagIcon : "leaf";
  return updateDoc(doc(db, "guilds", guildId), { tag: normalized, tagIcon: safeIcon, tagFont, tagImageUrl: rawImageUrl.slice(0, 1000), tagColor: safeColor });
}

export function clearGuildPointer(userId: string) {
  return writeBatch(db).update(doc(db, "profiles", userId), { guildId: "" }).commit();
}
