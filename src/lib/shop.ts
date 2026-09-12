import {
  addDoc,
  collection,
  doc,
  getDoc,
  increment,
  onSnapshot,
  runTransaction,
  setDoc,
  updateDoc,
  query,
  where,
  writeBatch,
} from "firebase/firestore";
import { db } from "./firebase";
import { OWNER_EMAIL } from "./moderation";
import { createNotification } from "./notifications";
import type { ShopItem, ShopNotification, ShopOrder } from "../types";

const OWNER_INFINITE_CREDITS = 999_999_999;

export function subscribeToShopItems(serverId: string, callback: (items: ShopItem[]) => void) {
  return onSnapshot(collection(db, "servers", serverId, "shopItems"), (snapshot) => {
    callback(snapshot.docs.map((item) => ({ id: item.id, ...item.data() }) as ShopItem).filter((item) => item.enabled));
  });
}

export function subscribeToOrders(serverId: string, callback: (orders: ShopOrder[]) => void) {
  return onSnapshot(collection(db, "servers", serverId, "orders"), (snapshot) => {
    const orders = snapshot.docs.map((item) => ({ id: item.id, ...item.data() }) as ShopOrder);
    callback(orders.sort((a, b) => b.createdAt - a.createdAt));
  });
}

export async function ensureWallet(userId: string) {
  const wallet = doc(db, "wallets", userId);
  const snapshot = await getDoc(wallet);
  if (!snapshot.exists()) await setDoc(wallet, { balance: 100, createdAt: Date.now() });
}

export function subscribeToBalance(userId: string, callback: (balance: number) => void) {
  return onSnapshot(doc(db, "wallets", userId), (snapshot) => callback(snapshot.data()?.balance ?? 0));
}

export async function ensureOwnerCredits(userId: string, email: string | null) {
  if (email?.toLowerCase() !== OWNER_EMAIL) return;
  await ensureWallet(userId);
  const snapshot = await getDoc(doc(db, "wallets", userId));
  if ((snapshot.data()?.balance ?? 0) < OWNER_INFINITE_CREDITS) {
    await updateDoc(doc(db, "wallets", userId), { balance: OWNER_INFINITE_CREDITS }).catch(() => {});
  }
}

export async function donateCredits(fromUserId: string, fromName: string, toUserId: string, amount: number, message = "") {
  if (amount <= 0 || !Number.isInteger(amount)) throw new Error("Enter a whole number of credits.");
  if (fromUserId === toUserId) throw new Error("You can't donate to yourself.");
  await ensureWallet(fromUserId);
  const fromRef = doc(db, "wallets", fromUserId);
  const fromSnap = await getDoc(fromRef);
  if ((fromSnap.data()?.balance ?? 0) < amount) throw new Error("You do not have enough SpawnDex Credits.");
  const batch = writeBatch(db);
  batch.update(fromRef, { balance: increment(-amount) });
  // set(..., merge) instead of update() — the sender can't read the
  // recipient's wallet to know whether it exists yet, and this form creates
  // it if missing or merges the balance increment if it already does, without
  // ever needing that read. Only `balance` is written either way, matching
  // both the create-donation and update-donation rule branches.
  batch.set(doc(db, "wallets", toUserId), { balance: increment(amount) }, { merge: true });
  await batch.commit();
  const trimmedNote = message.trim().slice(0, 150);
  void createNotification({
    recipientId: toUserId,
    type: "donation",
    title: `${fromName} sent you ${amount} SpawnDex Credits`,
    message: trimmedNote || `${amount} credits, no message attached.`,
    link: "/profile",
  });
}

export function addShopItem(serverId: string, item: Omit<ShopItem, "id" | "enabled">) {
  return addDoc(collection(db, "servers", serverId, "shopItems"), { ...item, enabled: true });
}

export async function buyShopItem(
  serverId: string,
  serverName: string,
  serverOwnerId: string,
  item: ShopItem,
  buyerId: string,
  buyerName: string,
  minecraftName: string,
) {
  const walletRef = doc(db, "wallets", buyerId);
  const orderRef = doc(collection(db, "servers", serverId, "orders"));
  const notificationRef = doc(collection(db, "shopNotifications"));
  await runTransaction(db, async (transaction) => {
    const wallet = await transaction.get(walletRef);
    const balance = wallet.data()?.balance ?? 0;
    if (balance < item.price) throw new Error("You do not have enough SpawnDex Credits.");
    transaction.update(walletRef, { balance: balance - item.price });
    transaction.set(orderRef, {
      buyerId,
      buyerName,
      minecraftName,
      itemId: item.id,
      itemName: item.name,
      minecraftItemId: item.minecraftItemId,
      price: item.price,
      status: "pending",
      createdAt: Date.now(),
    });
    transaction.set(notificationRef, {
      recipientId: serverOwnerId,
      serverId,
      serverName,
      buyerName,
      itemName: item.name,
      read: false,
      createdAt: Date.now(),
    });
  });
}

export function fulfillOrder(serverId: string, orderId: string) {
  return updateDoc(doc(db, "servers", serverId, "orders", orderId), { status: "fulfilled", fulfilledAt: Date.now() });
}

export function subscribeToShopNotifications(
  ownerId: string,
  callback: (notifications: ShopNotification[]) => void,
) {
  const notificationsQuery = query(
    collection(db, "shopNotifications"),
    where("recipientId", "==", ownerId),
  );
  return onSnapshot(notificationsQuery, (snapshot) => {
    const notifications = snapshot.docs
      .map((item) => ({ id: item.id, ...item.data() }) as ShopNotification)
      .sort((a, b) => b.createdAt - a.createdAt);
    callback(notifications);
  });
}

export function markShopNotificationRead(notificationId: string) {
  return updateDoc(doc(db, "shopNotifications", notificationId), { read: true });
}
