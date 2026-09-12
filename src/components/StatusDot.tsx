import type { EffectivePresence } from "../lib/profiles";

const LABELS: Record<EffectivePresence, string> = {
  online: "Online",
  idle: "Idle",
  dnd: "Do Not Disturb",
  invisible: "Invisible",
  offline: "Offline",
};

export default function StatusDot({ online, status, className = "" }: { online?: boolean; status?: EffectivePresence; className?: string }) {
  const current: EffectivePresence = status ?? (online ? "online" : "offline");
  const color = current === "online" ? "bg-emerald-400" : current === "idle" ? "bg-amber-400" : current === "dnd" ? "bg-red-500" : "bg-slate-500";
  return (
    <span
      className={`relative inline-grid h-2.5 w-2.5 shrink-0 place-items-center rounded-full border-2 border-[#0b0d11] ${color} ${className}`}
      title={LABELS[current]}
      aria-label={LABELS[current]}
    >
      {current === "dnd" && <span className="h-[2px] w-1/2 rounded-full bg-white" />}
      {(current === "offline" || current === "invisible") && <span className="h-1/2 w-1/2 rounded-full bg-[#0b0d11]" />}
    </span>
  );
}
