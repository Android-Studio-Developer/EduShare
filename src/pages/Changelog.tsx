import { Sparkles } from "lucide-react";
import { ALL_PATCH_NOTES, LATEST_PATCH_NOTE } from "../lib/patchNotes";

export default function Changelog() {
  return (
    <div className="mx-auto max-w-5xl px-6 py-14">
      <div className="flex items-center gap-3">
        <Sparkles size={26} className="text-brand-400" />
        <div>
          <h1 className="font-mono text-2xl font-bold text-white">Changelog</h1>
          <p className="text-sm text-white/45">Every SpawnDex release, newest first.</p>
        </div>
      </div>

      <div className="mt-8 space-y-8">
        {ALL_PATCH_NOTES.map((note) => (
          <section key={note.version} className={`rounded-2xl border bg-surface p-6 ${note.version === LATEST_PATCH_NOTE.version ? "border-brand-400/35 shadow-[0_24px_70px_-50px_var(--theme-glow-strong)]" : "border-border"}`}>
            <div className="flex items-baseline gap-2">
              <h2 className="font-mono text-base font-bold text-white">{note.version}</h2>
              {note.version === LATEST_PATCH_NOTE.version && (
                <span className="rounded-full bg-brand-500/15 px-2 py-0.5 text-[10px] font-semibold text-brand-300">Latest</span>
              )}
              <span className="text-xs text-white/30">{note.date}</span>
            </div>
            <ul className={`mt-4 grid gap-2.5 ${note.version === LATEST_PATCH_NOTE.version ? "md:grid-cols-2" : ""}`}>
              {note.items.map((item) => (
                <li key={item} className="flex gap-2 rounded-xl bg-white/[.025] p-3 text-sm leading-relaxed text-white/70"><span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-brand-400"/><span>{item}</span></li>
              ))}
            </ul>
          </section>
        ))}
      </div>
    </div>
  );
}
