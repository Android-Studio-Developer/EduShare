import { Dices, X } from "lucide-react";
import { CODE_LENGTH, getIcon, ICON_PALETTE } from "../lib/icons";
import { randomIconCode } from "../lib/code";

interface IconCodePickerProps {
  value: string[];
  onChange: (code: string[]) => void;
}

export default function IconCodePicker({ value, onChange }: IconCodePickerProps) {
  function handlePick(iconId: string) {
    const nextEmpty = value.findIndex((slot) => !slot);
    if (nextEmpty !== -1) {
      const next = [...value];
      next[nextEmpty] = iconId;
      onChange(next);
      return;
    }
    // All slots full — shift left and append, like re-typing a PIN.
    onChange([...value.slice(1), iconId]);
  }

  function clearSlot(i: number) {
    const next = [...value];
    next[i] = "";
    onChange(next);
  }

  function clearAll() {
    onChange(Array.from({ length: CODE_LENGTH }, () => ""));
  }

  return (
    <div>
      <div className="mb-4 flex items-center justify-between">
        <p className="text-xs text-white/45">
          Pick {CODE_LENGTH} icons in order — this is the join code players enter, just like real
          Minecraft Education.
        </p>
        <div className="flex shrink-0 gap-2">
          <button
            type="button"
            onClick={() => onChange(randomIconCode())}
            className="cursor-target flex items-center gap-1.5 text-xs font-medium text-brand-400 hover:text-brand-300"
          >
            <Dices size={13} /> Randomize
          </button>
          <button
            type="button"
            onClick={clearAll}
            className="cursor-target text-xs font-medium text-white/40 hover:text-white/70"
          >
            Clear
          </button>
        </div>
      </div>

      <div className="mb-5 flex justify-center gap-3">
        {value.map((iconId, i) => {
          const icon = iconId ? getIcon(iconId) : null;
          return (
            <button
              type="button"
              key={i}
              onClick={() => clearSlot(i)}
              disabled={!iconId}
              className={`cursor-target group relative flex h-16 w-16 items-center justify-center rounded-xl border-2 transition-colors ${
                icon
                  ? "border-brand-500/60 bg-brand-500/10"
                  : "border-dashed border-border bg-surface-2"
              }`}
            >
              {icon ? (
                <>
                  <img src={icon.src} alt={icon.label} className="pixel-icon h-8 w-8 object-contain" />
                  <span className="absolute -top-1.5 -right-1.5 hidden h-5 w-5 items-center justify-center rounded-full bg-surface border border-border text-white/60 group-hover:flex">
                    <X size={12} />
                  </span>
                </>
              ) : (
                <span className="text-xs text-white/25">{i + 1}</span>
              )}
            </button>
          );
        })}
      </div>

      <div className="grid grid-cols-4 gap-2 sm:grid-cols-8">
        {ICON_PALETTE.map(({ id, label, src }) => (
          <button
            type="button"
            key={id}
            onClick={() => handlePick(id)}
            title={label}
            className="cursor-target flex aspect-square items-center justify-center rounded-lg border border-border bg-surface-2 p-2 transition-colors hover:border-brand-500/50"
          >
            <img src={src} alt={label} className="pixel-icon h-full w-full object-contain" />
          </button>
        ))}
      </div>
    </div>
  );
}
