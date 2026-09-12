import { collection, deleteDoc, doc, getDocs, onSnapshot, orderBy, query, setDoc, writeBatch } from "firebase/firestore";
import { db } from "./firebase";
import type { MovieSignup } from "../types";

function signupsRef() {
  return collection(db, "movieSignups");
}

export function subscribeToMovieSignups(callback: (signups: MovieSignup[]) => void) {
  return onSnapshot(query(signupsRef(), orderBy("createdAt", "asc")), (snapshot) => {
    callback(snapshot.docs.map((d) => ({ id: d.id, ...d.data() }) as MovieSignup));
  });
}

// One doc per user — signing up again just overwrites your own entry (e.g. to
// change your note) instead of creating duplicates.
export function signUpForNextMovie(uid: string, displayName: string, photoUrl: string, note: string) {
  return setDoc(doc(db, "movieSignups", uid), {
    displayName: displayName.slice(0, 80),
    photoUrl: photoUrl.slice(0, 1000),
    note: note.trim().slice(0, 200),
    createdAt: Date.now(),
  });
}

export function cancelMovieSignup(uid: string) {
  return deleteDoc(doc(db, "movieSignups", uid));
}

// Staff-only: wipe the whole list once cast is picked, to start a fresh round
// for the next movie.
export async function clearMovieSignups() {
  const snap = await getDocs(signupsRef());
  for (let i = 0; i < snap.docs.length; i += 450) {
    const batch = writeBatch(db);
    snap.docs.slice(i, i + 450).forEach((d) => batch.delete(d.ref));
    await batch.commit();
  }
}
