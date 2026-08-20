import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { Link } from "react-router-dom";
import { Sparkles } from "lucide-react";
import { hasUnseenPatchNotes, LATEST_PATCH_NOTE, markPatchNotesSeen, snoozePatchNotes } from "../lib/patchNotes";
import Button from "./Button";

export default function PatchNotesModal() {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (hasUnseenPatchNotes()) setOpen(true);
  }, []);

  function dismissForever() {
    markPatchNotesSeen();
    setOpen(false);
  }

  function remindTomorrow() {
    snoozePatchNotes();
    setOpen(false);
  }

  if (!open) return null;

  return createPortal(
    <div className="fixed inset-0 z-100 flex items-center justify-center bg-black/60 p-6">
      <div className="w-full max-w-md rounded-2xl border border-border bg-surface p-6">
        <p className="flex items-center gap-2 font-mono text-lg font-bold text-white">
          <Sparkles size={18} className="text-brand-400" /> Patch notes
        </p>
        <div className="mt-4 max-h-80 space-y-1 overflow-y-auto">
          <p className="font-mono text-xs font-semibold text-white/40">{LATEST_PATCH_NOTE.version} · {LATEST_PATCH_NOTE.date}</p>
          <ul className="mt-1.5 space-y-1">
            {LATEST_PATCH_NOTE.items.map((item) => (
              <li key={item} className="text-sm text-white/75">{item}</li>
            ))}
          </ul>
        </div>
        <Link to="/changelog" onClick={dismissForever} className="cursor-target mt-3 inline-block text-xs text-brand-400 hover:text-brand-300">
          View full changelog →
        </Link>
        <div className="mt-5 flex gap-2">
          <Button variant="secondary" className="flex-1" onClick={remindTomorrow}>Remind me in 1 day</Button>
          <Button className="flex-1" onClick={dismissForever}>Don't show again</Button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
