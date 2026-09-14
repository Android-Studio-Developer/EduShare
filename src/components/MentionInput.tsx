import { useMemo, useState, type KeyboardEvent } from "react";
import { AtSign, Command, Radio, Shield } from "lucide-react";
import { isOnline } from "../lib/profiles";
import type { ChatSlashCommand } from "../lib/chatCommands";
import type { UserProfile } from "../types";

type MentionChoice = { id: string; handle: string; label: string; photoUrl: string; online: boolean; special?: boolean; role?: boolean };
export type RolePingChoice = { handle: string; label: string };

function activeMention(value: string) {
  return value.match(/(?:^|\s)@([\w.]*)$/)?.[1].toLowerCase() ?? null;
}

export default function MentionInput({
  value,
  onChange,
  profiles,
  placeholder,
  maxLength,
  disabled,
  className,
  includeSpecial = false,
  roles = [],
  slashCommands = [],
}: {
  value: string;
  onChange: (value: string) => void;
  profiles: UserProfile[];
  placeholder: string;
  maxLength: number;
  disabled?: boolean;
  className?: string;
  includeSpecial?: boolean;
  roles?: RolePingChoice[];
  slashCommands?: ChatSlashCommand[];
}) {
  const [activeIndex, setActiveIndex] = useState(0);
  const [dismissed, setDismissed] = useState(false);
  const query = activeMention(value);
  const slashQuery = value.startsWith("/") ? value.slice(1).toLowerCase() : null;
  const choices = useMemo(() => {
    const members: MentionChoice[] = profiles.map((profile) => ({
      id: profile.id,
      handle: profile.usernameLower || profile.username || profile.displayName.replace(/\s+/g, ""),
      label: profile.displayName,
      photoUrl: profile.photoUrl,
      online: isOnline(profile),
    }));
    const specials: MentionChoice[] = includeSpecial ? [
      { id: "everyone", handle: "everyone", label: "Everyone", photoUrl: "", online: true, special: true },
      { id: "here", handle: "here", label: "Online members", photoUrl: "", online: true, special: true },
    ] : [];
    const rolePings: MentionChoice[] = roles.map((r) => ({ id: `role-${r.handle}`, handle: r.handle, label: r.label, photoUrl: "", online: true, special: true, role: true }));
    return [...specials, ...rolePings, ...members]
      .filter((choice) => !query || choice.handle.toLowerCase().includes(query) || choice.label.toLowerCase().includes(query))
      .sort((a, b) => Number(b.special) - Number(a.special) || Number(b.online) - Number(a.online) || a.label.localeCompare(b.label))
      .slice(0, 12);
  }, [includeSpecial, profiles, query, roles]);
  const commandChoices = useMemo(() => slashQuery === null ? [] : slashCommands
    .filter((command) => `${command.name} ${command.description} ${command.category}`.toLowerCase().includes(slashQuery))
    .slice(0, 12), [slashCommands, slashQuery]);
  const mentionOpen = query !== null && choices.length > 0;
  const commandOpen = slashQuery !== null && commandChoices.length > 0;
  const open = !dismissed && (mentionOpen || commandOpen);

  function select(choice: MentionChoice) {
    onChange(value.replace(/@([\w.]*)$/, `@${choice.handle} `));
    setDismissed(true);
    setActiveIndex(0);
  }

  function selectCommand(command: ChatSlashCommand) {
    onChange(command.insertText);
    setDismissed(true);
    setActiveIndex(0);
  }

  function keyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (!open) return;
    if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      event.preventDefault();
      const choiceCount = commandOpen ? commandChoices.length : choices.length;
      setActiveIndex((index) => (index + (event.key === "ArrowDown" ? 1 : choiceCount - 1)) % choiceCount);
    } else if (event.key === "Enter" || event.key === "Tab") {
      event.preventDefault();
      if (commandOpen) selectCommand(commandChoices[Math.min(activeIndex, commandChoices.length - 1)]);
      else select(choices[Math.min(activeIndex, choices.length - 1)]);
    } else if (event.key === "Escape") {
      event.preventDefault();
      setDismissed(true);
    }
  }

  return (
    <div className="relative min-w-0 flex-1">
      {open && (
        <div className="absolute bottom-[calc(100%+.55rem)] left-0 right-0 z-50 max-h-80 overflow-y-auto rounded-xl border border-white/10 bg-[#17191f] p-1.5 shadow-2xl">
          <p className="px-2 pb-1 pt-1 text-[10px] font-bold uppercase tracking-[.18em] text-white/35">{commandOpen ? "Commands" : "Members · online and offline"}</p>
          {commandOpen ? commandChoices.map((command, index) => (
            <button key={command.name} type="button" onMouseDown={(event) => event.preventDefault()} onClick={() => selectCommand(command)} className={`flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-left ${index === activeIndex ? "bg-[#5865f2] text-white" : "hover:bg-white/5"}`}>
              <span className="grid h-8 w-8 place-items-center rounded-lg bg-white/10"><Command size={15}/></span>
              <span className="min-w-0 flex-1"><span className="block truncate text-sm font-bold">/{command.name}</span><span className={`block truncate text-[11px] ${index === activeIndex ? "text-white/70" : "text-white/35"}`}>{command.description}</span></span>
              <span className={`text-[10px] ${index === activeIndex ? "text-white/65" : "text-white/25"}`}>{command.category}</span>
            </button>
          )) : choices.map((choice, index) => (
            <button key={choice.id} type="button" onMouseDown={(event) => event.preventDefault()} onClick={() => select(choice)} className={`flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-left ${index === activeIndex ? "bg-brand-500/20" : "hover:bg-white/5"}`}>
              {choice.role ? <span className="grid h-8 w-8 place-items-center rounded-full bg-amber-400/15 text-amber-300"><Shield size={15}/></span> : choice.special ? <span className="grid h-8 w-8 place-items-center rounded-full bg-brand-500/15 text-brand-300"><AtSign size={16}/></span> : choice.photoUrl ? <img src={choice.photoUrl} alt="" className="h-8 w-8 rounded-full object-cover"/> : <span className="grid h-8 w-8 place-items-center rounded-full bg-white/8 text-xs font-bold text-white/65">{choice.label.slice(0, 1).toUpperCase()}</span>}
              <span className="min-w-0 flex-1"><span className="block truncate text-sm font-semibold text-white/90">{choice.label}</span><span className="block truncate text-[11px] text-white/35">@{choice.handle}</span></span>
              {!choice.special && <span className={`flex items-center gap-1 text-[10px] ${choice.online ? "text-emerald-300" : "text-white/30"}`}><Radio size={9}/>{choice.online ? "Online" : "Offline"}</span>}
            </button>
          ))}
        </div>
      )}
      <input value={value} onChange={(event) => { setDismissed(false); setActiveIndex(0); onChange(event.target.value); }} onKeyDown={keyDown} disabled={disabled} maxLength={maxLength} placeholder={placeholder} className={className}/>
    </div>
  );
}
