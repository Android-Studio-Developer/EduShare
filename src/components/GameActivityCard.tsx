import { useEffect, useState } from "react";
import { Gamepad2 } from "lucide-react";

function elapsedLabel(startedAt: number, now: number) {
  const total = Math.max(0, Math.floor((now - startedAt) / 1000));
  const hours = Math.floor(total / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  const seconds = total % 60;
  return hours > 0
    ? `${hours}:${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`
    : `${minutes}:${String(seconds).padStart(2, "0")}`;
}

function MinecraftBlock() {
  return (
    <svg viewBox="0 0 64 64" aria-hidden="true" className="h-14 w-14 drop-shadow-lg">
      <path fill="#70a83b" d="M32 3 59 17 32 31 5 17Z" />
      <path fill="#97653e" d="M5 17 32 31v30L5 47Z" />
      <path fill="#75462e" d="m32 31 27-14v30L32 61Z" />
      <path fill="#527d2d" d="m5 17 27 14v8L5 25Zm27 14 27-14v8L32 39Z" />
      <path fill="#b1845b" d="m10 31 7 4v7l-7-4Zm10 13 7 4v7l-7-4Zm19-8 8-4v7l-8 4Zm10 10 6-3v6l-6 3Z" />
    </svg>
  );
}

export default function GameActivityCard({ game, startedAt, compact = false }: { game: string; startedAt: number; compact?: boolean }) {
  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, []);

  if (!game || startedAt <= 0) return null;

  return (
    <section className={`rounded-2xl border border-white/[.07] bg-white/[.045] ${compact ? "mt-3 p-3" : "mt-4 p-4"}`}>
      <p className="mb-2 flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-[.16em] text-white/45">
        <Gamepad2 size={12} /> Playing
      </p>
      <div className="flex items-center gap-3">
        <div className={`${compact ? "grid h-14 w-14" : "grid h-16 w-16"} shrink-0 place-items-center rounded-xl bg-black/25`}><MinecraftBlock /></div>
        <div className="min-w-0">
          <strong className={`${compact ? "text-sm" : "text-base"} block truncate text-white`}>{game}</strong>
          <span className="mt-1 flex items-center gap-1.5 font-mono text-xs font-semibold text-emerald-300">
            <Gamepad2 size={13} /> {elapsedLabel(startedAt, now)}
          </span>
        </div>
      </div>
    </section>
  );
}
