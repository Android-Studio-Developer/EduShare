import { AlertTriangle } from "lucide-react";

export default function FirebaseSetupNotice() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-bg px-6">
      <div className="max-w-lg rounded-2xl border border-amber-500/30 bg-surface p-8">
        <div className="mb-4 flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-500/15 text-amber-400">
            <AlertTriangle size={19} />
          </div>
          <h1 className="font-mono text-lg font-bold text-white">Firebase isn't configured yet</h1>
        </div>
        <p className="text-sm leading-relaxed text-white/60">
          eduShare needs a Firebase project for sign-up, login, and server
          storage. Copy <code className="rounded bg-surface-2 px-1.5 py-0.5 font-mono text-brand-300">.env.example</code> to{" "}
          <code className="rounded bg-surface-2 px-1.5 py-0.5 font-mono text-brand-300">.env</code>, fill in your
          Firebase web app config, then restart <code className="rounded bg-surface-2 px-1.5 py-0.5 font-mono text-brand-300">npm run dev</code>.
        </p>
        <p className="mt-4 text-xs text-white/40">
          See the README for step-by-step setup instructions.
        </p>
      </div>
    </div>
  );
}
