import { addDoc, collection, deleteDoc, doc, increment, onSnapshot, orderBy, query, updateDoc } from "firebase/firestore";
import { db } from "./firebase";
import type { SharedFile, ShareType } from "../types";

export function isHttpsUrl(url: string) {
  return url.startsWith("https://");
}

export function subscribeToShares(callback: (shares: SharedFile[]) => void) {
  const q = query(collection(db, "shares"), orderBy("createdAt", "desc"));
  return onSnapshot(q, (snapshot) => {
    callback(snapshot.docs.map((d) => ({ id: d.id, ...d.data() }) as SharedFile));
  });
}

export function createShare(data: {
  name: string;
  description: string;
  type: ShareType;
  downloadUrl: string;
  imageUrl: string;
  authorId: string;
  authorName: string;
}) {
  if (!isHttpsUrl(data.downloadUrl)) throw new Error("Download link must be a valid https:// URL.");
  return addDoc(collection(db, "shares"), { ...data, downloadCount: 0, createdAt: Date.now() });
}

export function recordDownload(shareId: string) {
  return updateDoc(doc(db, "shares", shareId), { downloadCount: increment(1) });
}

export function deleteShare(shareId: string) {
  return deleteDoc(doc(db, "shares", shareId));
}
