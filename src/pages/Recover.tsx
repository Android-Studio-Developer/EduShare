import { useState, type FormEvent } from "react";
import { Link } from "react-router-dom";
import { LifeBuoy } from "lucide-react";
import { submitRecoveryRequest } from "../lib/accountRecovery";
import Button from "../components/Button";

export default function Recover() {
  const [input, setInput] = useState("");
  const [contact, setContact] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [sent, setSent] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError("");
    setSubmitting(true);
    try {
      await submitRecoveryRequest(input, contact);
      setSent(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not submit that. Try again.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="mx-auto flex min-h-[70vh] max-w-md flex-col justify-center px-6 py-16">
      <div className="rounded-2xl border border-border bg-surface p-8">
        <div className="mb-6 flex items-center gap-2">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-brand-500/15 text-brand-400">
            <LifeBuoy size={17} />
          </div>
          <h1 className="font-mono text-xl font-bold text-white">Can't log in?</h1>
        </div>

        {sent ? (
          <div className="space-y-4 text-center">
            <p className="text-sm text-white/70">Sent to the SpawnDex owner. If you gave a way to reach you, expect a reply there — this isn't instant.</p>
            <Link to="/login" className="cursor-target block text-sm font-medium text-brand-400 hover:underline">Back to log in</Link>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            <p className="text-sm text-white/50">
              If you remember your password, use{" "}
              <Link to="/login" className="cursor-target font-medium text-brand-400 hover:underline">Forgot password</Link>{" "}
              on the login page instead — it's instant. This is for when you've lost your username too.
            </p>
            <div>
              <label className="mb-1.5 block text-xs font-medium text-white/50">Email or username you remember</label>
              <input
                required
                value={input}
                onChange={(e) => setInput(e.target.value)}
                maxLength={100}
                placeholder="you@example.com or your @username"
                className="w-full rounded-xl border border-border bg-surface-2 px-4 py-2.5 text-sm text-white focus:border-brand-500/50 focus:outline-none"
              />
            </div>
            <div>
              <label className="mb-1.5 block text-xs font-medium text-white/50">How can we reach you? (optional)</label>
              <input
                value={contact}
                onChange={(e) => setContact(e.target.value)}
                maxLength={200}
                placeholder="Discord, alternate email, etc."
                className="w-full rounded-xl border border-border bg-surface-2 px-4 py-2.5 text-sm text-white focus:border-brand-500/50 focus:outline-none"
              />
            </div>
            {error && <p className="text-sm text-red-400">{error}</p>}
            <Button type="submit" className="w-full" size="lg" disabled={submitting}>
              {submitting ? "Sending..." : "Send request"}
            </Button>
          </form>
        )}
      </div>
    </div>
  );
}
