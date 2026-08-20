import { collection, deleteDoc, doc, onSnapshot, query, setDoc, updateDoc, where } from "firebase/firestore";
import { db } from "./firebase";
import type { FriendRequest } from "../types";

function requestId(fromId: string, toId: string) {
  return `${fromId}_${toId}`;
}

export function sendFriendRequest(
  fromId: string,
  fromName: string,
  fromPhotoUrl: string,
  toId: string,
  toName: string,
  toPhotoUrl: string,
) {
  return setDoc(doc(db, "friendRequests", requestId(fromId, toId)), {
    fromId,
    fromName,
    fromPhotoUrl,
    toId,
    toName,
    toPhotoUrl,
    status: "pending",
    createdAt: Date.now(),
  });
}

export function acceptFriendRequest(id: string) {
  return updateDoc(doc(db, "friendRequests", id), { status: "accepted" });
}

export function declineFriendRequest(id: string) {
  return updateDoc(doc(db, "friendRequests", id), { status: "declined" });
}

export function removeFriendRequest(id: string) {
  return deleteDoc(doc(db, "friendRequests", id));
}

export function subscribeToMyFriendRequests(
  userId: string,
  callback: (sent: FriendRequest[], received: FriendRequest[]) => void,
) {
  let sent: FriendRequest[] = [];
  let received: FriendRequest[] = [];
  let ready = 0;
  function emit() {
    ready += 1;
    if (ready >= 2) callback(sent, received);
  }
  const unsubSent = onSnapshot(query(collection(db, "friendRequests"), where("fromId", "==", userId)), (snap) => {
    sent = snap.docs.map((d) => ({ id: d.id, ...d.data() }) as FriendRequest);
    if (ready < 2) emit();
    else callback(sent, received);
  });
  const unsubReceived = onSnapshot(query(collection(db, "friendRequests"), where("toId", "==", userId)), (snap) => {
    received = snap.docs.map((d) => ({ id: d.id, ...d.data() }) as FriendRequest);
    if (ready < 2) emit();
    else callback(sent, received);
  });
  return () => {
    unsubSent();
    unsubReceived();
  };
}
