import { useEffect, useState } from "react";
import { Megaphone } from "lucide-react";
import { useAuth } from "../context/AuthContext";
import { REFERRALS_REQUIRED, referredCount, submitAdvertiserRequest, subscribeToMyAdvertiserRequests } from "../lib/advertiser";
import type { AdvertiserRequest } from "../types";
import Button from "./Button";

export default function AdvertiserPanel() {
  const { user } = useAuth();
  const [count, setCount] = useState(0);
  const [requests, setRequests] = useState<AdvertiserRequest[]>([]);
  const [message, setMessage] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [status, setStatus] = useState("");

  useEffect(() => {
    if (!user) return;
    void referredCount(user.uid).then(setCount);
    return subscribeToMyAdvertiserRequests(user.uid, setRequests);
  }, [user]);

  if (!user) return null;

  const openRequest = requests.find((r) => r.status === "open");
  const accepted = requests.some((r) => r.status === "accepted");
  const referralLink = `${window.location.origin}/?ref=${user.uid}`;

  async function handleSubmit() {
    if (!user) return;
    setSubmitting(true);
    setStatus("");
    try {
      await submitAdvertiserRequest(user.uid, user.displayName ?? "Player", message);
      setStatus("Request sent — a staff member will review it.");
    } catch (err) {
      setStatus(err instanceof Error ? err.message : "Could not submit.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <section className="mt-10 rounded-2xl border border-purple-400/25 bg-purple-500/5 p-5">
      <div className="flex items-center gap-2">
        <Megaphone size={18} className="text-purple-300" />
        <h2 className="font-mono text-lg font-bold text-white">Advertiser rank</h2>
      </div>
      <p className="mt-1 text-xs text-white/45">
        Invite {REFERRALS_REQUIRED} friends with your link below. Once they register, request the Advertiser rank — each of them gets 530 credits when it's accepted.
      </p>
      <div className="mt-3 flex flex-wrap items-center gap-2">
        <code className="min-w-0 flex-1 break-all rounded-lg border border-border bg-surface-2 px-3 py-1.5 text-xs text-white/70">{referralLink}</code>
        <Button size="sm" variant="secondary" onClick={() => navigator.clipboard.writeText(referralLink)}>Copy</Button>
      </div>
      <p className="mt-2 text-xs text-white/50">Referred so far: <strong className="text-white">{count}</strong> / {REFERRALS_REQUIRED}</p>

      {accepted ? (
        <p className="mt-4 text-sm text-purple-300">You're an Advertiser! Thanks for growing the community.</p>
      ) : openRequest ? (
        <p className="mt-4 text-sm text-white/50">Request pending staff review.</p>
      ) : (
        <div className="mt-4">
          <textarea
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            placeholder="Anything staff should know? (optional)"
            maxLength={500}
            rows={2}
            className="w-full rounded-xl border border-border bg-surface-2 px-3 py-2 text-sm text-white placeholder:text-white/30"
          />
          <Button size="sm" className="mt-2" disabled={count < REFERRALS_REQUIRED || submitting} onClick={handleSubmit}>
            {submitting ? "Sending…" : "Request Advertiser rank"}
          </Button>
          {status && <p className="mt-2 text-xs text-white/50">{status}</p>}
        </div>
      )}
    </section>
  );
}
