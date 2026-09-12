import { collection, deleteDoc, doc, addDoc, onSnapshot, query, where } from "firebase/firestore";
import { db } from "./firebase";
import type { MemePost, MemeVisibility } from "../types";

function memesRef() {
  return collection(db, "memes");
}

export function isHttpsImageUrl(url: string) {
  return url.startsWith("https://");
}

export function createMeme(data: {
  authorId: string;
  authorName: string;
  authorPhotoUrl: string;
  imageUrl: string;
  caption: string;
  visibility: MemeVisibility;
  recipientId: string;
  recipientName: string;
}) {
  if (!isHttpsImageUrl(data.imageUrl)) throw new Error("Image link must be a valid https:// URL.");
  if (data.visibility === "private" && !data.recipientId) throw new Error("Pick who this private meme is for.");
  return addDoc(memesRef(), {
    ...data,
    caption: data.caption.trim().slice(0, 300),
    recipientId: data.visibility === "private" ? data.recipientId : "",
    recipientName: data.visibility === "private" ? data.recipientName : "",
    createdAt: Date.now(),
  });
}

export function deleteMeme(id: string) {
  return deleteDoc(doc(db, "memes", id));
}

// Firestore can't run a single query that mixes an equality filter with an
// OR across different fields, so this fans out into three queries (matching
// three separate rule branches) and merges by id — same pattern as every
// other "public or mine or sent to me" feed in this app.
export function subscribeToVisibleMemes(userId: string, callback: (memes: MemePost[]) => void) {
  const results: Record<string, Record<string, MemePost>> = { pub: {}, mine: {}, toMe: {} };

  function emit() {
    const merged = new Map<string, MemePost>();
    for (const bucket of Object.values(results)) {
      for (const meme of Object.values(bucket)) merged.set(meme.id, meme);
    }
    callback([...merged.values()].sort((a, b) => b.createdAt - a.createdAt));
  }

  function bucketFrom(bucket: keyof typeof results) {
    return (snap: import("firebase/firestore").QuerySnapshot) => {
      results[bucket] = Object.fromEntries(snap.docs.map((d) => [d.id, { id: d.id, ...d.data() } as MemePost]));
      emit();
    };
  }

  const unsub1 = onSnapshot(query(memesRef(), where("visibility", "==", "public")), bucketFrom("pub"));
  const unsub2 = onSnapshot(query(memesRef(), where("authorId", "==", userId)), bucketFrom("mine"));
  const unsub3 = onSnapshot(query(memesRef(), where("recipientId", "==", userId)), bucketFrom("toMe"));

  return () => {
    unsub1();
    unsub2();
    unsub3();
  };
}
