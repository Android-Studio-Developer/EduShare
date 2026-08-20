export default function StatusDot({ online, className = "" }: { online: boolean; className?: string }) {
  return (
    <span
      className={`inline-block h-2.5 w-2.5 shrink-0 rounded-full border-2 border-[#0b0d11] ${online ? "bg-emerald-400" : "bg-red-500/70"} ${className}`}
      title={online ? "Online" : "Offline"}
    />
  );
}
