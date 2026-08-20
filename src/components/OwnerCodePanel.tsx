import { useState } from "react";
import { Check, Copy, KeyRound, Pencil, Radio, X } from "lucide-react";
import BorderGlow from "./BorderGlow";
import Button from "./Button";
import IconCodePicker from "./IconCodePicker";
import { getIcon, CODE_LENGTH } from "../lib/icons";
import { setServerOnline, updateServerCode } from "../lib/servers";
import { useAuth } from "../context/AuthContext";

interface OwnerCodePanelProps {
  serverId: string;
  serverName: string;
  code: string[];
  isOnline: boolean;
}

export default function OwnerCodePanel({ serverId, serverName, code, isOnline }: OwnerCodePanelProps) {
  const { user } = useAuth();
  const [copied, setCopied] = useState(false);
  const [editing, setEditing] = useState(false);
  const [draftCode, setDraftCode] = useState<string[]>(code);
  const [saving, setSaving] = useState(false);
  const [togglingOnline, setTogglingOnline] = useState(false);

  async function handleCopy() {
    const readable = code.map((id) => getIcon(id).label).join(", ");
    await navigator.clipboard.writeText(readable);
    setCopied(true);
    setTimeout(() => setCopied(false), 1600);
  }

  function startEditing() {
    setDraftCode(code);
    setEditing(true);
  }

  async function handleSave() {
    if (draftCode.some((slot) => !slot) || draftCode.length !== CODE_LENGTH) return;
    setSaving(true);
    try {
      await updateServerCode(serverId, draftCode);
      setEditing(false);
    } finally {
      setSaving(false);
    }
  }

  async function handleToggleOnline() {
    if (!user) return;
    setTogglingOnline(true);
    try {
      await setServerOnline(serverId, serverName, isOnline, user.uid);
    } finally {
      setTogglingOnline(false);
    }
  }

  return (
    <BorderGlow
      backgroundColor="#0f1116"
      borderRadius={20}
      glowRadius={36}
      glowColor="258 90% 76%"
      colors={["#a78bfa", "#8b5cf6", "#38bdf8"]}
    >
      <div className="overflow-hidden rounded-[20px]">
        <div className="flex items-center gap-2 border-b border-border bg-surface-2/60 px-6 py-4">
          <KeyRound size={17} className="text-brand-400" />
          <h3 className="font-mono font-semibold text-white">Your Join Code</h3>
          <button
            type="button"
            onClick={handleToggleOnline}
            disabled={togglingOnline}
            className={`cursor-target ml-auto flex items-center gap-1.5 rounded-full border px-3 py-1 font-mono text-xs font-semibold transition-colors disabled:opacity-50 ${
              isOnline
                ? "border-brand-500/40 bg-brand-500/10 text-brand-300 hover:border-brand-500/70"
                : "border-border bg-surface-2 text-white/40 hover:text-white/70"
            }`}
          >
            <Radio size={12} className={isOnline ? "animate-pulse" : ""} />
            {isOnline ? "Online now" : "Offline"}
          </button>
        </div>

        <div className="flex flex-col items-center gap-4 p-6">
          {!editing && (
            <p className="text-center text-xs text-white/40">
              You own this server, so the code stays visible here — this is the exact icon sequence
              players enter to join. In Minecraft Education the code changes each time you re-host,
              so keep this in sync with your in-game code.
            </p>
          )}

          {editing ? (
            <>
              <IconCodePicker value={draftCode} onChange={setDraftCode} />
              <div className="flex w-full gap-2">
                <Button
                  variant="secondary"
                  className="w-full"
                  onClick={() => setEditing(false)}
                  disabled={saving}
                >
                  <X size={15} /> Cancel
                </Button>
                <Button
                  className="w-full"
                  onClick={handleSave}
                  disabled={saving || draftCode.some((s) => !s)}
                >
                  <Check size={15} /> {saving ? "Saving..." : "Save code"}
                </Button>
              </div>
            </>
          ) : (
            <>
              <div className="flex gap-3">
                {code.map((iconId, i) => {
                  const icon = getIcon(iconId);
                  return (
                    <div
                      key={i}
                      title={icon.label}
                      className="flex h-16 w-16 items-center justify-center rounded-xl border border-border bg-surface-2"
                    >
                      <img src={icon.src} alt={icon.label} className="pixel-icon h-8 w-8 object-contain" />
                    </div>
                  );
                })}
              </div>

              <div className="flex w-full gap-2">
                <Button variant="secondary" className="w-full" onClick={handleCopy}>
                  {copied ? <Check size={16} className="text-brand-400" /> : <Copy size={16} />}
                  {copied ? "Copied!" : "Copy icon names"}
                </Button>
                <Button variant="secondary" className="w-full" onClick={startEditing}>
                  <Pencil size={15} /> Edit code
                </Button>
              </div>
            </>
          )}
        </div>
      </div>
    </BorderGlow>
  );
}
