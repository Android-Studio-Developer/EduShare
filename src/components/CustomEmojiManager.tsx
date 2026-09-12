import { useRef, useState, type ChangeEvent } from "react";
import { ImagePlus, Lock, Trash2 } from "lucide-react";
import { updateCustomEmojis } from "../lib/profiles";
import { rankTier } from "../lib/ranks";
import type { CustomEmoji, UserProfile } from "../types";
import Button from "./Button";

const OUTPUT_SIZE = 96;
const MAX_SOURCE_BYTES = 5 * 1024 * 1024;
const MAX_EMOJIS = 12;

async function resizeEmoji(file: File) {
  const bitmap = await createImageBitmap(file);
  const canvas = document.createElement("canvas");
  canvas.width = OUTPUT_SIZE;
  canvas.height = OUTPUT_SIZE;
  const context = canvas.getContext("2d");
  if (!context) throw new Error("This browser cannot resize images.");
  context.imageSmoothingEnabled = true;
  context.imageSmoothingQuality = "high";
  const scale = Math.max(OUTPUT_SIZE / bitmap.width, OUTPUT_SIZE / bitmap.height);
  const width = bitmap.width * scale;
  const height = bitmap.height * scale;
  context.drawImage(bitmap, (OUTPUT_SIZE - width) / 2, (OUTPUT_SIZE - height) / 2, width, height);
  bitmap.close();
  const blob = await new Promise<Blob>((resolve, reject) => canvas.toBlob((value) => value ? resolve(value) : reject(new Error("Could not process that image.")), "image/webp", 0.9));
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => typeof reader.result === "string" ? resolve(reader.result) : reject(new Error("Could not embed that image."));
    reader.onerror = () => reject(new Error("Could not embed that image."));
    reader.readAsDataURL(blob);
  });
}

export default function CustomEmojiManager({ profile, onNotice }: { profile: UserProfile; onNotice: (message: string) => void }) {
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const unlocked = rankTier(profile.rank) >= rankTier("mvp_plus");

  async function upload(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file || !unlocked || busy) return;
    const cleanName = name.trim().toLowerCase().replace(/[^a-z0-9_]/g, "").slice(0, 20);
    if (!cleanName) { onNotice("Give the emoji a name using letters, numbers, or underscores."); return; }
    if (profile.customEmojis.some((emoji) => emoji.name === cleanName)) { onNotice(`:${cleanName}: already exists.`); return; }
    if (profile.customEmojis.length >= MAX_EMOJIS) { onNotice(`You can save up to ${MAX_EMOJIS} custom emojis.`); return; }
    if (!file.type.startsWith("image/") || file.size > MAX_SOURCE_BYTES) { onNotice("Choose a PNG, JPG, or WebP image under 5MB."); return; }
    setBusy(true);
    try {
      const embeddedUrl = await resizeEmoji(file);
      const emoji: CustomEmoji = { id: crypto.randomUUID(), name: cleanName, url: embeddedUrl, fileId: "" };
      await updateCustomEmojis(profile.id, [...profile.customEmojis, emoji]);
      setName("");
      onNotice(`:${cleanName}: uploaded at 96×96.`);
    } catch (error) {
      onNotice(error instanceof Error ? error.message : "Emoji upload failed.");
    } finally { setBusy(false); }
  }

  async function remove(emoji: CustomEmoji) {
    if (busy) return;
    setBusy(true);
    try {
      await updateCustomEmojis(profile.id, profile.customEmojis.filter((item) => item.id !== emoji.id));
      onNotice(`:${emoji.name}: removed.`);
    } catch (error) { onNotice(error instanceof Error ? error.message : "Could not remove emoji."); }
    finally { setBusy(false); }
  }

  return <div className="mt-4 border-t border-border pt-4">
    <div className="flex items-center justify-between gap-3">
      <div><p className="flex items-center gap-1.5 text-xs font-semibold text-white/60">Custom emojis {!unlocked && <Lock size={11}/>}</p><p className="mt-0.5 text-[10px] text-white/30">MVP+ perk · resized to exactly 96×96 · {profile.customEmojis.length}/{MAX_EMOJIS}</p></div>
    </div>
    {profile.customEmojis.length > 0 && <div className="mt-3 grid grid-cols-4 gap-2 sm:grid-cols-6">{profile.customEmojis.map((emoji) => <div key={emoji.id} className="group relative rounded-xl border border-border bg-surface-2 p-2 text-center"><img src={emoji.url} alt={`:${emoji.name}:`} className="mx-auto h-12 w-12 object-contain"/><p className="mt-1 truncate text-[9px] text-white/45">:{emoji.name}:</p><button type="button" onClick={() => void remove(emoji)} className="cursor-target absolute right-1 top-1 rounded-md bg-black/70 p-1 text-white/45 opacity-0 hover:text-red-300 group-hover:opacity-100" aria-label={`Delete ${emoji.name}`}><Trash2 size={11}/></button></div>)}</div>}
    <div className={`mt-3 flex gap-2 ${!unlocked ? "opacity-45" : ""}`}>
      <input value={name} onChange={(event) => setName(event.target.value)} disabled={!unlocked || busy} maxLength={20} placeholder="emoji_name" className="min-w-0 flex-1 rounded-xl border border-border bg-surface-2 px-3 py-2 text-xs text-white outline-none placeholder:text-white/25 focus:border-brand-400/50"/>
      <input ref={inputRef} type="file" accept="image/png,image/jpeg,image/webp" onChange={upload} className="hidden"/>
      <Button type="button" size="sm" variant="secondary" disabled={!unlocked || busy || !name.trim() || profile.customEmojis.length >= MAX_EMOJIS} onClick={() => inputRef.current?.click()}><ImagePlus size={14}/>{busy ? "Working…" : "Upload"}</Button>
    </div>
  </div>;
}
