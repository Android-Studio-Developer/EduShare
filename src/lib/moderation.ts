import {
  addDoc,
  collection,
  doc,
  getDocs,
  onSnapshot,
  orderBy,
  query,
  setDoc,
  updateDoc,
  where,
  deleteDoc,
  getDoc,
} from "firebase/firestore";
import { db } from "./firebase";
import type { DisputeMessage, FlaggedMessage, ModeratorApplication, ServerReport, SiteRole } from "../types";
import { createNotification } from "./notifications";

export const OWNER_EMAIL = "josephum@outlook.kr";

export function subscribeToRole(
  uid: string,
  email: string | null,
  callback: (role: SiteRole) => void,
) {
  if (email?.toLowerCase() === OWNER_EMAIL) {
    callback("owner");
    // Self-heal a roles/{uid} doc for the owner so public pages (like Team)
    // can list staff without needing to know the owner's email.
    void setDoc(doc(db, "roles", uid), { role: "owner" }, { merge: true }).catch(() => {});
    return () => {};
  }
  return onSnapshot(doc(db, "roles", uid), (snapshot) => {
    const role = snapshot.data()?.role;
    callback(role === "moderator" || role === "actor" || role === "headmod" || role === "dabug" ? role : "member");
  });
}

// "actor"/"headmod" carry the exact same permissions as "moderator" everywhere
// (Firestore rules' isModerator() treats them identically) — they're distinct
// roles purely so movie-cast members and senior mods get their own badge/label
// instead of showing up as a regular moderator.
export function isStaffRole(role: SiteRole): boolean {
  return role === "owner" || role === "moderator" || role === "actor" || role === "headmod";
}

export interface StaffMember {
  id: string;
  role: "owner" | "moderator" | "actor" | "headmod" | "dabug";
}

export function subscribeToStaffRoles(callback: (staff: StaffMember[]) => void) {
  return onSnapshot(collection(db, "roles"), (snapshot) => {
    callback(
      snapshot.docs
        .map((d) => ({ id: d.id, role: d.data().role as string }))
        .filter((r): r is StaffMember => r.role === "owner" || r.role === "moderator" || r.role === "actor" || r.role === "headmod" || r.role === "dabug"),
    );
  });
}

export function setSiteRole(userId: string, role: Exclude<SiteRole, "owner">) {
  return setDoc(doc(db, "roles", userId), { role, grantedAt: Date.now() }, { merge: true });
}

// Invisible voice-changer flag. Firestore rules restrict this write to the
// owner account specifically — not isStaff(), so moderators can't grant it.
export function setVoiceUnlocked(userId: string, value: boolean) {
  return updateDoc(doc(db, "profiles", userId), { voiceUnlocked: value });
}

export async function submitModeratorApplication(
  data: Omit<ModeratorApplication, "id" | "status" | "createdAt">,
) {
  const existing = await getDocs(
    query(collection(db, "moderatorApplications"), where("userId", "==", data.userId)),
  );
  const pending = existing.docs.find((item) => item.data().status === "pending");
  if (pending) throw new Error("You already have a pending application.");
  return addDoc(collection(db, "moderatorApplications"), {
    ...data,
    status: "pending",
    createdAt: Date.now(),
  });
}

export function subscribeToApplications(callback: (items: ModeratorApplication[]) => void) {
  const q = query(collection(db, "moderatorApplications"), orderBy("createdAt", "desc"));
  return onSnapshot(q, (snapshot) => {
    callback(snapshot.docs.map((item) => ({ id: item.id, ...item.data() }) as ModeratorApplication));
  });
}

export async function reviewModeratorApplication(
  application: ModeratorApplication,
  decision: "approved" | "rejected",
) {
  await updateDoc(doc(db, "moderatorApplications", application.id), {
    status: decision,
    reviewedAt: Date.now(),
  });
  if (decision === "approved") {
    await setDoc(doc(db, "roles", application.userId), {
      role: "moderator",
      email: application.applicantEmail,
      displayName: application.applicantName,
      grantedAt: Date.now(),
    });
  }
  await createNotification({ recipientId: application.userId, type: "moderation", title: `Moderator application ${decision}`, message: decision === "approved" ? "You now have SpawnDex moderator access." : "Your moderator application was not approved this time.", link: "/moderation" });
}

export function submitServerReport(data: Omit<ServerReport, "id" | "status" | "createdAt">) {
  return addDoc(collection(db, "serverReports"), { ...data, status: "open", createdAt: Date.now() });
}

export function subscribeToReports(callback: (reports: ServerReport[]) => void) {
  const reportsQuery = query(collection(db, "serverReports"), orderBy("createdAt", "desc"));
  return onSnapshot(reportsQuery, (snapshot) => callback(snapshot.docs.map((item) => ({ id: item.id, ...item.data() }) as ServerReport)));
}

export function subscribeToReport(reportId: string, callback: (report: ServerReport | null) => void) {
  return onSnapshot(doc(db, "serverReports", reportId), (snapshot) => callback(snapshot.exists() ? ({ id: snapshot.id, ...snapshot.data() } as ServerReport) : null));
}

export async function updateReportStatus(reportId: string, status: ServerReport["status"]) {
  const ref = doc(db, "serverReports", reportId);
  const snapshot = await getDoc(ref);
  await updateDoc(ref, { status });
  const report = snapshot.data() as ServerReport | undefined;
  if (report) await createNotification({ recipientId: report.reporterId, type: "report", title: `Report ${status}`, message: `Your report about ${report.serverName} is now ${status}.`, link: report.reason === "duplicate_map" ? `/dispute/${reportId}` : `/server/${report.serverId}` });
}

export function subscribeToDisputeMessages(reportId: string, callback: (messages: DisputeMessage[]) => void) {
  const messagesQuery = query(collection(db, "serverReports", reportId, "messages"), orderBy("createdAt", "asc"));
  return onSnapshot(messagesQuery, (snapshot) => callback(snapshot.docs.map((item) => ({ id: item.id, ...item.data() }) as DisputeMessage)));
}

export function sendDisputeMessage(reportId: string, authorId: string, authorName: string, text: string) {
  return addDoc(collection(db, "serverReports", reportId, "messages"), { authorId, authorName, text, createdAt: Date.now() });
}

export function deleteReportedServer(serverId: string) {
  return deleteDoc(doc(db, "servers", serverId));
}

export function flagDeletedMessage(data: Omit<FlaggedMessage, "id" | "createdAt">) {
  return addDoc(collection(db, "flaggedMessages"), { ...data, createdAt: Date.now() });
}

export function subscribeToFlaggedMessages(callback: (items: FlaggedMessage[]) => void) {
  const q = query(collection(db, "flaggedMessages"), orderBy("createdAt", "desc"));
  return onSnapshot(q, (snapshot) => {
    callback(snapshot.docs.map((item) => ({ id: item.id, ...item.data() }) as FlaggedMessage));
  });
}

export function dismissFlaggedMessage(id: string) {
  return deleteDoc(doc(db, "flaggedMessages", id));
}
