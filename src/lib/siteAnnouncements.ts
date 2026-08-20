import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  onSnapshot,
  orderBy,
  query,
  updateDoc,
} from "firebase/firestore";
import { db } from "./firebase";

export interface ImportantAnnouncement {
  id: string;
  text: string;
  authorId: string;
  authorName: string;
  authorRole: "owner" | "moderator";
  createdAt: number;
}

export function subscribeToImportantAnnouncements(
  callback: (items: ImportantAnnouncement[]) => void,
) {
  return onSnapshot(
    query(collection(db, "importantAnnouncements"), orderBy("createdAt", "desc")),
    (snapshot) => {
      callback(
        snapshot.docs.map(
          (item) => ({ id: item.id, ...item.data() }) as ImportantAnnouncement,
        ),
      );
    },
  );
}

export function postImportantAnnouncement(data: {
  text: string;
  authorId: string;
  authorName: string;
  authorRole: "owner" | "moderator";
}) {
  const text = data.text.trim();
  if (!text) throw new Error("Announcement cannot be empty.");
  if (text.length > 1200) throw new Error("Announcement is too long.");

  return addDoc(collection(db, "importantAnnouncements"), {
    ...data,
    text,
    createdAt: Date.now(),
  });
}

export function deleteImportantAnnouncement(announcementId: string) {
  return deleteDoc(doc(db, "importantAnnouncements", announcementId));
}

export function updateImportantAnnouncement(announcementId: string, text: string) {
  const trimmed = text.trim();
  if (!trimmed) throw new Error("Announcement cannot be empty.");
  if (trimmed.length > 1200) throw new Error("Announcement is too long.");
  return updateDoc(doc(db, "importantAnnouncements", announcementId), { text: trimmed });
}
