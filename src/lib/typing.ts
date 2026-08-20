import { collection, deleteDoc, doc, onSnapshot, setDoc } from "firebase/firestore";
import { db } from "./firebase";

export interface Typer {
  id: string;
  displayName: string;
  updatedAt: number;
}

function typingRef() {
  return collection(db, "publicChatTyping");
}

export function setTyping(uid: string, displayName: string) {
  return setDoc(doc(db, "publicChatTyping", uid), { displayName, updatedAt: Date.now() });
}

export function clearTyping(uid: string) {
  return deleteDoc(doc(db, "publicChatTyping", uid)).catch(() => {});
}

export function subscribeToTyping(callback: (typers: Typer[]) => void) {
  return onSnapshot(typingRef(), (snap) => {
    callback(snap.docs.map((d) => ({ id: d.id, ...d.data() }) as Typer));
  });
}
