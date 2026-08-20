import { useState, type FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { GripVertical, ImagePlus, Plus, Server, Trash2, X } from "lucide-react";
import { useAuth } from "../context/AuthContext";
import { createServer } from "../lib/servers";
import { CODE_LENGTH } from "../lib/icons";
import { resizeImageToDataUrl } from "../lib/image";
import { SUBJECTS } from "../types";
import Button from "../components/Button";
import IconCodePicker from "../components/IconCodePicker";
import OptionWheel from "../components/OptionWheel";

const DEFAULT_RULES = [
  "Be respectful to classmates — no griefing or bullying.",
  "Stay in the designated build areas unless told otherwise.",
  "No inappropriate builds, names, or chat messages.",
];

export default function CreateServer() {
  const { user } = useAuth();
  const navigate = useNavigate();

  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [subject, setSubject] = useState<string>(SUBJECTS[0]);
  const [edition, setEdition] = useState("Minecraft Education 1.21.133");
  const [maxPlayers, setMaxPlayers] = useState(30);
  const [hasShop, setHasShop] = useState(false);
  const [code, setCode] = useState<string[]>(Array.from({ length: CODE_LENGTH }, () => ""));
  const [rules, setRules] = useState<string[]>(DEFAULT_RULES);
  const [worldImages, setWorldImages] = useState<string[]>([]);
  const [imageError, setImageError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  function updateRule(i: number, value: string) {
    setRules((r) => r.map((rule, idx) => (idx === i ? value : rule)));
  }
  function addRule() {
    setRules((r) => [...r, ""]);
  }
  function removeRule(i: number) {
    setRules((r) => r.filter((_, idx) => idx !== i));
  }

  async function handleImageSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? []).slice(0, 6 - worldImages.length);
    if (files.length === 0) return;
    setImageError("");
    try {
      const dataUrls = await Promise.all(files.map((file) => resizeImageToDataUrl(file, 720, 0.62)));
      setWorldImages((current) => [...current, ...dataUrls].slice(0, 6));
    } catch {
      setImageError("Couldn't load that image — try a different file.");
    } finally {
      e.target.value = "";
    }
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!user) return;
    setError("");

    const cleanRules = rules.map((r) => r.trim()).filter(Boolean);
    if (cleanRules.length === 0) {
      setError("Add at least one rule for your server.");
      return;
    }
    if (code.some((slot) => !slot) || code.length !== CODE_LENGTH) {
      setError(`Pick all ${CODE_LENGTH} icons for your join code.`);
      return;
    }

    setSubmitting(true);
    try {
      const doc = await createServer(
        {
          name: name.trim(),
          description: description.trim(),
          subject,
          edition,
          code,
          imageUrl: worldImages[0] ?? "",
          imageUrls: worldImages,
          rules: cleanRules,
          maxPlayers,
          hasShop,
        },
        user.uid,
        user.displayName ?? "Anonymous",
      );
      navigate(`/server/${doc.id}`);
    } catch {
      setError("Something went wrong registering your server. Try again.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="mx-auto max-w-2xl px-6 py-14">
      <motion.div initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }}>
        <div className="mb-8 flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-brand-500/15 text-brand-400">
            <Server size={19} />
          </div>
          <div>
            <h1 className="font-mono text-2xl font-bold text-white">Register a server</h1>
            <p className="text-sm text-white/45">Set your rules — the code stays hidden until players agree.</p>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="rounded-2xl border border-border bg-surface p-6">
            <label className="mb-1.5 block text-xs font-medium text-white/50">World showcase images — up to 6</label>
            {worldImages.length > 0 && (
              <div className="mb-3 grid grid-cols-2 gap-3 sm:grid-cols-3">
                {worldImages.map((image, index) => (
                  <div key={`${image.slice(-16)}-${index}`} className="relative overflow-hidden rounded-xl border border-border">
                    <img src={image} alt={`World preview ${index + 1}`} className="aspect-video w-full object-cover" />
                    {index === 0 && <span className="absolute bottom-2 left-2 rounded-full bg-black/60 px-2 py-0.5 font-mono text-[9px] text-white">Cover</span>}
                    <button type="button" onClick={() => setWorldImages((current) => current.filter((_, imageIndex) => imageIndex !== index))} className="cursor-target absolute top-2 right-2 flex h-7 w-7 items-center justify-center rounded-full bg-black/60 text-white backdrop-blur hover:bg-black/80"><X size={13} /></button>
                  </div>
                ))}
              </div>
            )}
            {worldImages.length < 6 && (
              <label className="cursor-target flex aspect-video w-full cursor-pointer flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-border bg-surface-2 text-white/40 transition-colors hover:border-brand-500/40 hover:text-brand-300">
                <ImagePlus size={22} />
                <span className="text-xs">Add screenshots of your world</span>
                <input type="file" accept="image/*" multiple onChange={handleImageSelect} className="hidden" />
              </label>
            )}
            {imageError && <p className="mt-2 text-xs text-red-400">{imageError}</p>}
          </div>

          <label className="cursor-target flex cursor-pointer items-center gap-3 rounded-2xl border border-border bg-surface p-6">
            <input type="checkbox" checked={hasShop} onChange={(event) => setHasShop(event.target.checked)} className="h-4 w-4 accent-brand-500" />
            <span>
              <span className="block text-sm font-semibold text-white">Does this server have a shop system?</span>
              <span className="mt-1 block text-xs text-white/45">Sell in-world items for eduShare Credits and fulfill purchases for your players.</span>
            </span>
          </label>

          <div className="rounded-2xl border border-border bg-surface p-6">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="sm:col-span-2">
                <label className="mb-1.5 block text-xs font-medium text-white/50">Server name</label>
                <input
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Frostpeak SMP"
                  className="w-full rounded-xl border border-border bg-surface-2 px-4 py-2.5 text-sm text-white placeholder:text-white/30 focus:border-brand-500/50 focus:outline-none"
                />
              </div>

              <div className="sm:col-span-2">
                <label className="mb-1.5 block text-xs font-medium text-white/50">Description</label>
                <textarea
                  required
                  rows={3}
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="What will players be doing on this server?"
                  className="w-full resize-none rounded-xl border border-border bg-surface-2 px-4 py-2.5 text-sm text-white placeholder:text-white/30 focus:border-brand-500/50 focus:outline-none"
                />
              </div>

              <div className="sm:col-span-2">
                <label className="mb-1.5 block text-xs font-medium text-white/50">
                  Category — scroll or drag to spin
                </label>
                <div className="relative h-32 overflow-hidden rounded-xl border border-border bg-surface-2">
                  <div className="pointer-events-none absolute inset-x-0 top-1/2 h-9 -translate-y-1/2 border-y border-brand-500/30 bg-brand-500/5" />
                  <OptionWheel
                    items={[...SUBJECTS]}
                    defaultSelected={(SUBJECTS as readonly string[]).indexOf(subject)}
                    onChange={(_, label) => setSubject(label)}
                    textColor="rgba(255,255,255,0.32)"
                    activeColor="#c4b5fd"
                    fontSize={1.1}
                    spacing={1.7}
                    inset={22}
                    tilt={5}
                    curve={0.7}
                    blur={1.4}
                    fade={0.32}
                    className="cursor-target font-mono"
                  />
                </div>
              </div>

              <div>
                <label className="mb-1.5 block text-xs font-medium text-white/50">Edition / version</label>
                <input
                  required
                  value={edition}
                  onChange={(e) => setEdition(e.target.value)}
                  className="w-full rounded-xl border border-border bg-surface-2 px-4 py-2.5 text-sm text-white focus:border-brand-500/50 focus:outline-none"
                />
              </div>

              <div>
                <label className="mb-1.5 block text-xs font-medium text-white/50">Max players</label>
                <input
                  type="number"
                  min={1}
                  required
                  value={maxPlayers}
                  onChange={(e) => setMaxPlayers(Number(e.target.value))}
                  className="w-full rounded-xl border border-border bg-surface-2 px-4 py-2.5 text-sm text-white focus:border-brand-500/50 focus:outline-none"
                />
              </div>
            </div>
          </div>

          <div className="rounded-2xl border border-border bg-surface p-6">
            <label className="mb-1.5 block text-sm font-semibold text-white">Join code</label>
            <IconCodePicker value={code} onChange={setCode} />
          </div>

          <div className="rounded-2xl border border-border bg-surface p-6">
            <div className="mb-4 flex items-center justify-between">
              <label className="text-sm font-semibold text-white">Ruleset</label>
              <button
                type="button"
                onClick={addRule}
                className="cursor-target flex items-center gap-1.5 text-xs font-medium text-brand-400 hover:text-brand-300"
              >
                <Plus size={14} /> Add rule
              </button>
            </div>

            <div className="space-y-2.5">
              {rules.map((rule, i) => (
                <div key={i} className="flex items-center gap-2">
                  <GripVertical size={15} className="shrink-0 text-white/25" />
                  <input
                    value={rule}
                    onChange={(e) => updateRule(i, e.target.value)}
                    placeholder={`Rule ${i + 1}`}
                    className="w-full rounded-xl border border-border bg-surface-2 px-4 py-2.5 text-sm text-white placeholder:text-white/30 focus:border-brand-500/50 focus:outline-none"
                  />
                  <button
                    type="button"
                    onClick={() => removeRule(i)}
                    className="cursor-target shrink-0 rounded-lg p-2 text-white/30 transition-colors hover:bg-red-500/10 hover:text-red-400"
                  >
                    <Trash2 size={15} />
                  </button>
                </div>
              ))}
            </div>
          </div>

          {error && <p className="text-sm text-red-400">{error}</p>}

          <Button type="submit" size="lg" className="w-full" disabled={submitting}>
            {submitting ? "Registering..." : "Register server"}
          </Button>
        </form>
      </motion.div>
    </div>
  );
}
