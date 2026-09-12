export default function ThoughtBubble({ text, className = "" }: { text: string; className?: string }) {
  if (!text.trim()) return null;
  return (
    <div className={`pointer-events-none relative rounded-2xl border border-white/10 bg-[#2b2d33]/95 px-4 py-3 text-sm font-medium leading-snug text-white/90 shadow-[0_12px_30px_rgba(0,0,0,.35)] ${className}`}>
      <span className="absolute -left-3 bottom-2 h-2.5 w-2.5 rounded-full border border-white/10 bg-[#2b2d33]" />
      <span className="absolute -left-6 bottom-0 h-1.5 w-1.5 rounded-full bg-[#2b2d33]" />
      <p className="line-clamp-3 break-words">{text}</p>
    </div>
  );
}
