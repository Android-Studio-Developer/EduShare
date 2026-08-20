import { PartyPopper } from "lucide-react";
import { useAuth } from "../context/AuthContext";
import Lanyard from "../components/Lanyard";

export default function Fun() {
  const { user } = useAuth();

  return (
    <div className="mx-auto max-w-5xl px-6 py-10">
      <div className="flex items-center gap-2">
        <PartyPopper size={20} className="text-brand-300" />
        <h1 className="font-mono text-2xl font-bold text-white">Fun</h1>
      </div>
      <p className="mt-2 text-sm text-white/50">Drag the badge around — it's on a physics-simulated lanyard.</p>

      <div className="mt-4 overflow-hidden rounded-2xl border border-border bg-surface-2/40">
        <Lanyard frontImage={user?.photoURL ?? null} backImage={user?.photoURL ?? null} />
      </div>
    </div>
  );
}
