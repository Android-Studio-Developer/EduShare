import { doc, getDoc, writeBatch } from "firebase/firestore";
import { db } from "./firebase";

export async function deleteAccountData(uid: string, usernameLower = "") {
  const batch = writeBatch(db);
  batch.delete(doc(db, "profiles", uid));
  batch.delete(doc(db, "wallets", uid));
  batch.delete(doc(db, "roles", uid));
  batch.delete(doc(db, "publicChatTyping", uid));

  if (usernameLower) {
    const usernameRef = doc(db, "usernames", usernameLower);
    const username = await getDoc(usernameRef);
    if (username.exists() && username.data().uid === uid) batch.delete(usernameRef);
  }

  await batch.commit();
}
