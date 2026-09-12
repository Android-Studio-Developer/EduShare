import { collection, doc, limit, onSnapshot, orderBy, query, runTransaction } from "firebase/firestore";
import { db } from "./firebase";
import { ensureWallet } from "./shop";
import type { CommunityEvent } from "../types";

function eventsRef() {
  return collection(db, "communityEvents");
}

export function subscribeToCommunityEvents(callback: (events: CommunityEvent[]) => void) {
  return onSnapshot(query(eventsRef(), orderBy("createdAt", "desc"), limit(30)), (snapshot) => {
    callback(snapshot.docs.map((item) => ({ id: item.id, ...item.data() }) as CommunityEvent));
  });
}

export async function createCommunityEvent(input: {
  hostId: string;
  hostName: string;
  hostPhotoUrl: string;
  title: string;
  description: string;
  link: string;
  creditPrize: number;
  durationMinutes: number;
}) {
  const title = input.title.trim().slice(0, 80);
  const description = input.description.trim().slice(0, 240);
  const link = input.link.trim().slice(0, 500) || "/fun";
  if (!Number.isSafeInteger(input.creditPrize) || input.creditPrize < 1) throw new Error("Enter a positive whole-number credit prize.");
  const creditPrize = input.creditPrize;
  const durationMinutes = Math.max(15, Math.min(1440, Math.floor(input.durationMinutes)));
  if (!title || !description) throw new Error("Add an event title and description.");
  if (!(link.startsWith("/") || /^https:\/\//i.test(link))) throw new Error("Use an SpawnDex path or an https:// event link.");
  await ensureWallet(input.hostId);
  const walletRef = doc(db, "wallets", input.hostId);
  const eventRef = doc(eventsRef());
  await runTransaction(db, async (transaction) => {
    const wallet = await transaction.get(walletRef);
    const balance = wallet.data()?.balance ?? 0;
    if (balance < creditPrize) throw new Error(`You need at least ${creditPrize} credits available for the prize.`);
    const createdAt = Date.now();
    transaction.set(eventRef, {
      hostId: input.hostId,
      hostName: input.hostName,
      hostPhotoUrl: input.hostPhotoUrl,
      title,
      description,
      link,
      creditPrize,
      participantIds: [],
      participants: [],
      status: "active",
      winnerId: "",
      winnerName: "",
      payoutClaimed: false,
      createdAt,
      endsAt: createdAt + durationMinutes * 60_000,
      finishedAt: 0,
    });
    transaction.update(walletRef, { balance: balance - creditPrize });
  });
  return eventRef;
}

export async function joinCommunityEvent(eventId: string, userId: string, name: string, photoUrl: string) {
  await runTransaction(db, async (transaction) => {
    const eventRef = doc(db, "communityEvents", eventId);
    const snapshot = await transaction.get(eventRef);
    if (!snapshot.exists()) throw new Error("That event no longer exists.");
    const event = snapshot.data() as Omit<CommunityEvent, "id">;
    if (event.status !== "active" || event.endsAt <= Date.now()) throw new Error("That event has ended.");
    if (event.hostId === userId) throw new Error("The host cannot enter their own prize draw.");
    if (event.participantIds.includes(userId)) return;
    if (event.participantIds.length >= 200) throw new Error("That event is full.");
    transaction.update(eventRef, {
      participantIds: [...event.participantIds, userId],
      participants: [...event.participants, { id: userId, name: name.slice(0, 80), photoUrl: photoUrl.slice(0, 1000) }],
    });
  });
}

export async function cancelCommunityEvent(eventId: string, hostId: string) {
  await runTransaction(db, async (transaction) => {
    const eventRef = doc(db, "communityEvents", eventId);
    const snapshot = await transaction.get(eventRef);
    if (!snapshot.exists()) return;
    const event = snapshot.data() as Omit<CommunityEvent, "id">;
    if (event.hostId !== hostId || event.status !== "active") throw new Error("Only the host can cancel this event.");
    transaction.update(eventRef, { status: "cancelled", finishedAt: Date.now() });
  });
}

export async function finishCommunityEvent(eventId: string, hostId: string) {
  await runTransaction(db, async (transaction) => {
    const eventRef = doc(db, "communityEvents", eventId);
    const eventSnapshot = await transaction.get(eventRef);
    if (!eventSnapshot.exists()) throw new Error("That event no longer exists.");
    const event = eventSnapshot.data() as Omit<CommunityEvent, "id">;
    if (event.hostId !== hostId || event.status !== "active") throw new Error("Only the host can finish this event.");
    if (event.participants.length === 0) throw new Error("No one has marked themselves interested yet.");
    const winner = event.participants[Math.floor(Math.random() * event.participants.length)];
    transaction.update(eventRef, { status: "finished", winnerId: winner.id, winnerName: winner.name, finishedAt: Date.now() });
  });
}

export async function claimCommunityEventPayout(eventId: string, userId: string) {
  await ensureWallet(userId);
  await runTransaction(db, async (transaction) => {
    const eventRef = doc(db, "communityEvents", eventId);
    const walletRef = doc(db, "wallets", userId);
    const [eventSnapshot, walletSnapshot] = await Promise.all([transaction.get(eventRef), transaction.get(walletRef)]);
    if (!eventSnapshot.exists() || !walletSnapshot.exists()) return;
    const event = eventSnapshot.data() as Omit<CommunityEvent, "id">;
    const canClaim = (event.status === "finished" && event.winnerId === userId) || (event.status === "cancelled" && event.hostId === userId);
    if (!canClaim || event.payoutClaimed) return;
    transaction.update(eventRef, { payoutClaimed: true });
    transaction.update(walletRef, { balance: (walletSnapshot.data()?.balance ?? 0) + event.creditPrize, lastCommunityEventPayoutId: eventId });
  });
}
