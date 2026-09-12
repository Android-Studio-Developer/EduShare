import { collection, doc, onSnapshot, query, where, writeBatch } from "firebase/firestore";
import { auth, db } from "./firebase";
import type { LoginEvent, OwnerLoginAudit } from "../types";

async function publicIpAddress() {
  const controller = new AbortController();
  const timeout = window.setTimeout(() => controller.abort(), 2500);
  try {
    const response = await fetch("https://api.ipify.org?format=json", { signal: controller.signal, cache: "no-store" });
    if (!response.ok) return "Unavailable";
    const value = String((await response.json())?.ip || "Unavailable").trim();
    return value.slice(0, 64) || "Unavailable";
  } catch { return "Unavailable"; }
  finally { window.clearTimeout(timeout); }
}

export async function recordLoginEvent(userId: string, method: LoginEvent["method"]) {
  const agent = navigator.userAgent;
  const browser = agent.includes("Edg/") ? "Edge" : agent.includes("Chrome/") ? "Chrome" : agent.includes("Firefox/") ? "Firefox" : agent.includes("Safari/") ? "Safari" : "Browser";
  const os = agent.includes("Windows") ? "Windows" : agent.includes("Mac OS") ? "macOS" : agent.includes("Android") ? "Android" : /iPhone|iPad/.test(agent) ? "iOS" : agent.includes("Linux") ? "Linux" : "Unknown OS";
  const createdAt = Date.now();
  const eventRef = doc(collection(db, "loginEvents"));
  const auditRef = doc(db, "ownerLoginAudits", eventRef.id);
  const shared = { userId, method, browser, os, device: `${browser} on ${os}`, createdAt };
  const batch = writeBatch(db);
  batch.set(eventRef, shared);
  batch.set(auditRef, { ...shared, email: auth.currentUser?.email || "", ipAddress: await publicIpAddress() });
  return batch.commit();
}

export function subscribeToLoginEvents(userId: string, callback: (events: LoginEvent[]) => void) {
  const eventsQuery = query(collection(db, "loginEvents"), where("userId", "==", userId));
  return onSnapshot(eventsQuery, (snapshot) => callback(snapshot.docs.map((item) => ({ id: item.id, ...item.data() }) as LoginEvent).sort((a, b) => b.createdAt - a.createdAt).slice(0, 25)));
}

export function subscribeToOwnerLoginAudits(callback: (events: OwnerLoginAudit[]) => void) {
  return onSnapshot(collection(db, "ownerLoginAudits"), (snapshot) => callback(snapshot.docs
    .map((item) => ({ id: item.id, ...item.data() }) as OwnerLoginAudit)
    .sort((a, b) => b.createdAt - a.createdAt)
    .slice(0, 250)), () => callback([]));
}

export function subscribeToAccountIdentityAudit(userId: string, callback: (events: OwnerLoginAudit[]) => void) {
  const auditQuery = query(collection(db, "ownerLoginAudits"), where("userId", "==", userId));
  return onSnapshot(auditQuery, (snapshot) => callback(snapshot.docs
    .map((item) => ({ id: item.id, ...item.data() }) as OwnerLoginAudit)
    .sort((a, b) => b.createdAt - a.createdAt)
    .slice(0, 10)), () => callback([]));
}
