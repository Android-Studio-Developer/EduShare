export default function StatusBadge({ online }: { online: boolean }) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 font-mono text-xs font-semibold ${
        online
          ? "border-emerald-300/30 bg-gradient-to-r from-emerald-400/20 to-cyan-400/15 text-emerald-200 shadow-[0_0_18px_rgba(52,211,153,.12)]"
          : "border-white/10 bg-white/5 text-white/40"
      }`}
    >
      <span className={`h-1.5 w-1.5 rounded-full ${online ? "animate-pulse bg-emerald-300" : "bg-white/30"}`} />
      {online ? "Online now" : "Offline"}
    </span>
  );
}
