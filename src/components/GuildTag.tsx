import type { CSSProperties } from "react";
import type { GuildTagFont, GuildTagIcon } from "../types";

export const GUILD_TAG_ICONS: { id: GuildTagIcon; label: string }[] = [
  { id: "leaf", label: "Leaf" },
  { id: "swords", label: "Sword" },
  { id: "heart", label: "Heart" },
  { id: "flame", label: "Flame" },
  { id: "droplet", label: "Droplet" },
  { id: "skull", label: "Skull" },
  { id: "moon", label: "Moon" },
  { id: "zap", label: "Lightning" },
  { id: "sparkles", label: "Sparkle" },
  { id: "mushroom", label: "Mushroom" },
];

const PIXEL_PATHS: Record<GuildTagIcon, string> = {
  leaf: "M2 9h1V6h2V4h3V2h6v5h-2v2h-2v2H7v2H4v-2H2zm3 1h2V8h2V6h2V4h-2v1H7v2H5z",
  swords: "M2 2h2v2h2v2h2v2h2v2h2v2h2v2h-4v-2h-2v-2H6v2H4v2H2v-4h2v-2h2V8H4V6H2zm10 0h2v4h-2v2h-2V6h2z",
  heart: "M2 4h2V2h4v2h2V2h4v2h2v5h-2v2h-2v2h-2v2H8v-2H6v-2H4V9H2z",
  flame: "M8 1h2v3h2v2h2v2h2v5h-2v2H4v-2H2V9h2V6h2V4h2zm0 7H6v4h2v2h3v-2h1v-2h-2V7H8z",
  droplet: "M7 1h2v2h2v2h2v2h2v5h-2v2H3v-2H1V8h2V6h2V4h2z",
  skull: "M4 2h8v2h2v7h-2v3h-2v-2H8v2H6v-2H4v2H2v-3H1V5h1V4h2zm1 5v3h3V7zm5 0v3h3V7z",
  moon: "M6 1h5v2H8v2H6v5h2v2h3v2H6v-2H4v-2H2V5h2V3h2z",
  zap: "M8 1h6v2h-2v2h-2v2h4v2h-2v2h-2v2H8v2H4v-2h2V9H2V7h2V5h2V3h2z",
  sparkles: "M7 1h2v4h2v2h4v2h-4v2H9v4H7v-4H5V9H1V7h4V5h2zm6 0h1v2h2v1h-2v2h-1V4h-2V3h2z",
  mushroom: "M5 2h6v1h2v2h2v4H1V6h2V4h2zm2 7h4v5h-1v1H6v-1H5v-3h2z",
};

const PIXEL_HIGHLIGHTS: Partial<Record<GuildTagIcon, string>> = {
  leaf: "M5 8h2V6h2V4h3v1h-2v2H8v2H6v2H4V9h1z",
  swords: "M3 3h1v1h1v1H4V4H3zm9 0h1v3h-1V5h-1V4h1z",
  heart: "M4 4h3v2H5v2H3V5h1z",
  flame: "M8 4h2v3h2v2h-2V8H8z",
  droplet: "M7 4h2v2h2v2H9V7H7z",
  skull: "M4 4h5v2H4z",
  moon: "M5 3h2v2H5z",
  zap: "M8 3h3v1H9v2H7z",
  sparkles: "M8 3h1v4h3v1H8z",
  mushroom: "M4 5h3v2H4zm6-1h2v3h-2z",
};

export function PixelGuildIcon({ id, size = 24, className = "" }: { id: GuildTagIcon; size?: number; className?: string }) {
  const highlight=PIXEL_HIGHLIGHTS[id];
  return <svg aria-hidden="true" viewBox="0 0 16 16" width={size} height={size} className={className} shapeRendering="crispEdges" style={{filter:"drop-shadow(1px 2px 0 rgba(0,0,0,.55))"}}><path d={PIXEL_PATHS[id] ?? PIXEL_PATHS.leaf} fill="currentColor"/>{highlight&&<path d={highlight} fill="white" opacity=".58"/>}</svg>;
}

export const GUILD_TAG_FONTS: { id: GuildTagFont; label: string; family: string }[] = [
  { id: "mono", label: "Mono", family: "'JetBrains Mono Variable', monospace" },
  { id: "poppins", label: "Poppins", family: "'Poppins', sans-serif" },
  { id: "playfair", label: "Playfair", family: "'Playfair Display', serif" },
  { id: "comic", label: "Comic", family: "'Comic Neue', cursive" },
  { id: "handwritten", label: "Written", family: "'Caveat', cursive" },
  { id: "bungee", label: "Bungee", family: "'Bungee', cursive" },
  { id: "pixel", label: "Pixel", family: "'Press Start 2P', monospace" },
];

export default function GuildTag({ tag, icon = "leaf", font = "mono", imageUrl = "", color = "#86efac", compact = false }: { tag?: string; icon?: GuildTagIcon; font?: GuildTagFont; imageUrl?: string; color?: string; compact?: boolean }) {
  if (!tag) return null;
  const iconStyle = GUILD_TAG_ICONS.find((item) => item.id === icon) ?? GUILD_TAG_ICONS[0];
  const fontFamily = GUILD_TAG_FONTS.find((item) => item.id === font)?.family ?? GUILD_TAG_FONTS[0].family;
  return (
    <span title={`Guild: ${tag}`} className={`inline-flex min-w-0 shrink-0 items-center rounded-md border font-black tracking-wider shadow-[0_4px_12px_rgba(0,0,0,.3)] ${compact ? "max-w-[76px] gap-0.5 px-1 py-0.5 text-[8px]" : "gap-1 px-1.5 py-0.5 text-[10px]"}`} style={{ fontFamily, color, borderColor:`${color}66`, background:`linear-gradient(135deg,${color}1f,rgba(10,12,16,.94) 62%)` } as CSSProperties}>
      <span className={`grid shrink-0 overflow-hidden place-items-center ${compact ? "h-4 w-4" : "h-5 w-5"}`} style={{color}}>
        {imageUrl ? <img src={imageUrl} alt="" className={`${compact ? "h-4 w-4" : "h-5 w-5"} rounded object-cover`} referrerPolicy="no-referrer"/> : <PixelGuildIcon id={iconStyle.id} size={compact ? 13 : 17}/>} 
      </span>
      <span className="truncate">{tag}</span>
    </span>
  );
}
