import { doc, getDoc, runTransaction, updateDoc } from "firebase/firestore";
import { db } from "./firebase";

// Every 100 accumulated Build Help credits = 0.50% — a purely honorary,
// cosmetic stat shown on a Builder's profile. Not real equity or a legal
// ownership claim of any kind.
export function ownershipPercent(buildHelpCredits: number): number {
  return Math.round((buildHelpCredits / 100) * 0.5 * 100) / 100;
}

// Staff-only: queue a Build Help grant on someone's profile. The recipient
// claims it themselves (mirrors the advertiser referral-reward pattern) so
// the wallet write always comes from the account it's crediting.
export async function grantBuildHelp(userId: string, amount = 500) {
  const profileRef = doc(db, "profiles", userId);
  const snapshot = await getDoc(profileRef);
  const existingPending = snapshot.data()?.buildHelpPending ?? 0;
  await updateDoc(profileRef, { buildHelpPending: Math.min(5000, existingPending + amount) });
}

export async function claimBuildHelpCredits(userId: string) {
  const profileRef = doc(db, "profiles", userId);
  const walletRef = doc(db, "wallets", userId);
  await runTransaction(db, async (transaction) => {
    const [profile, wallet] = await Promise.all([transaction.get(profileRef), transaction.get(walletRef)]);
    const pending = profile.data()?.buildHelpPending ?? 0;
    if (pending <= 0) throw new Error("No Build Help credits pending.");
    const credits = profile.data()?.buildHelpCredits ?? 0;
    const balance = wallet.data()?.balance ?? 0;
    transaction.update(profileRef, { buildHelpPending: 0, buildHelpCredits: credits + pending });
    transaction.update(walletRef, { balance: balance + pending });
  });
}
