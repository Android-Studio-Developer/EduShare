import { doc, getDoc, runTransaction } from "firebase/firestore";
import { db } from "./firebase";

const USERNAME_RE = /^[a-z0-9_]{3,20}$/;

export function normalizeUsername(raw: string) {
  return raw.trim().toLowerCase();
}

export function isValidUsername(raw: string) {
  return USERNAME_RE.test(normalizeUsername(raw));
}

export async function checkUsernameAvailable(raw: string): Promise<boolean> {
  if (!isValidUsername(raw)) return false;
  const snap = await getDoc(doc(db, "usernames", normalizeUsername(raw)));
  return !snap.exists();
}

export type ClaimUsernameResult = { ok: true } | { ok: false; reason: string };

// First-come-first-served, Discord-style: claiming a name reserves it in
// usernames/{lowercased} (create-only by rule, so a race just fails one
// side). Changing your own username releases the old reservation in the
// same transaction so it goes back up for grabs.
export async function claimUsername(uid: string, rawUsername: string, previousLower: string): Promise<ClaimUsernameResult> {
  const trimmed = rawUsername.trim();
  const lower = normalizeUsername(trimmed);
  if (!isValidUsername(trimmed)) {
    return { ok: false, reason: "Usernames must be 3-20 characters: lowercase letters, numbers, underscore." };
  }
  if (lower === previousLower) return { ok: true };

  try {
    await runTransaction(db, async (transaction) => {
      const newRef = doc(db, "usernames", lower);
      const newSnap = await transaction.get(newRef);
      if (newSnap.exists()) throw new Error("taken");
      transaction.set(newRef, { uid, createdAt: Date.now() });
      if (previousLower) transaction.delete(doc(db, "usernames", previousLower));
      transaction.update(doc(db, "profiles", uid), { username: trimmed, usernameLower: lower });
    });
    return { ok: true };
  } catch (error) {
    if (error instanceof Error && error.message === "taken") {
      return { ok: false, reason: "That username is already taken." };
    }
    return { ok: false, reason: "Could not claim that username — try again." };
  }
}
