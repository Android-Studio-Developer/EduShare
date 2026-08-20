import { Sparkles } from "lucide-react";
import { ALL_PATCH_NOTES, LATEST_PATCH_NOTE } from "../lib/patchNotes";

export default function Changelog() {
  return (
    <div className="mx-auto max-w-2xl px-6 py-14">
      <div className="flex items-center gap-3">
        <Sparkles size={26} className="text-brand-400" />
        <div>
          <h1 className="font-mono text-2xl font-bold text-white">Changelog</h1>
          <p className="text-sm text-white/45">Every eduShare release, newest first.</p>
        </div>
      </div>

      <div className="mt-8 space-y-8">
        {ALL_PATCH_NOTES.map((note) => (
          <section key={note.version} className="rounded-2xl border border-border bg-surface p-6">
            <div className="flex items-baseline gap-2">
              <h2 className="font-mono text-base font-bold text-white">{note.version}</h2>
              {note.version === LATEST_PATCH_NOTE.version && (
                <span className="rounded-full bg-brand-500/15 px-2 py-0.5 text-[10px] font-semibold text-brand-300">Latest</span>
              )}
              <span className="text-xs text-white/30">{note.date}</span>
            </div>
            <ul className="mt-3 space-y-1.5">
              {note.items.map((item) => (
                <li key={item} className="text-sm text-white/70">{item}</li>
              ))}
            </ul>
          </section>
        ))}
      </div>
    </div>
  );
}
