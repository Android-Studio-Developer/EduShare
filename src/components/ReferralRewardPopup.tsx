import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { Coins, X } from "lucide-react";
import { useAuth } from "../context/AuthContext";
import { subscribeToProfile } from "../lib/profiles";
import { claimReferralReward } from "../lib/advertiser";
import Button from "./Button";

export default function ReferralRewardPopup() {
  const { user } = useAuth();
  const [pending, setPending] = useState(0);
  const [dismissed, setDismissed] = useState(false);
  const [claiming, setClaiming] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!user) return;
    return subscribeToProfile(user.uid, (profile) => setPending(profile?.referralRewardPending ?? 0));
  }, [user]);

  if (!user || pending <= 0 || dismissed) return null;

  async function handleClaim() {
    if (!user) return;
    setClaiming(true);
    setError("");
    try {
      await claimReferralReward(user.uid, "HYPNO");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not claim reward.");
    } finally {
      setClaiming(false);
    }
  }

  return createPortal(
    <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/60 p-4" role="dialog" aria-modal="true">
      <div className="relative w-full max-w-sm rounded-2xl border border-amber-400/30 bg-surface p-6 text-center shadow-2xl">
        <button type="button" onClick={() => setDismissed(true)} className="cursor-target absolute right-3 top-3 text-white/40 hover:text-white" aria-label="Dismiss">
          <X size={16} />
        </button>
        <Coins size={32} className="mx-auto text-amber-300" />
        <h2 className="mt-3 font-mono text-lg font-bold text-white">Thank you so much!!!</h2>
        <p className="mt-2 text-sm text-white/60">
          Someone you invited to SpawnDex joined and it just pushed their inviter to Advertiser rank. Here's <strong className="text-amber-300">530 credits</strong> for helping the community grow!
        </p>
        {error && <p className="mt-2 text-xs text-red-400">{error}</p>}
        <Button className="mt-4 w-full" disabled={claiming} onClick={handleClaim}>
          {claiming ? "Claiming…" : "Press HYPNO to claim it!"}
        </Button>
      </div>
    </div>,
    document.body,
  );
}
