import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import { BadgeCheck, Blocks, Gamepad2, ScrollText, Users } from "lucide-react";
import type { MinecraftServer } from "../types";
import BorderGlow from "./BorderGlow";
import StatusBadge from "./StatusBadge";

export default function ServerCard({ server, index = 0 }: { server: MinecraftServer; index?: number }) {
  const categoryColors: Record<string, string> = {
    SMP: "from-emerald-400/25 to-cyan-400/15 text-emerald-200 border-emerald-300/25",
    Bedwars: "from-red-400/25 to-orange-400/15 text-orange-200 border-orange-300/25",
    PvP: "from-rose-400/25 to-fuchsia-400/15 text-rose-200 border-rose-300/25",
    Skyblock: "from-sky-400/25 to-violet-400/15 text-sky-200 border-sky-300/25",
    "Creative Build": "from-fuchsia-400/25 to-pink-400/15 text-fuchsia-200 border-fuchsia-300/25",
    Survival: "from-lime-400/25 to-emerald-400/15 text-lime-200 border-lime-300/25",
    Minigames: "from-amber-400/25 to-pink-400/15 text-amber-200 border-amber-300/25",
    "Redstone & Coding": "from-orange-400/25 to-red-400/15 text-orange-200 border-orange-300/25",
  };
  return (
    <motion.div
      initial={{ opacity: 0, y: 18 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-40px" }}
      transition={{ duration: 0.4, delay: Math.min(index * 0.05, 0.4) }}
      whileHover={{ y: -4 }}
      className="h-full"
    >
      <BorderGlow
        backgroundColor="#11152d"
        borderRadius={16}
        glowRadius={28}
        glowColor="258 90% 76%"
        colors={["#6690ff", "#94a3b8", "#a3e635"]}
        className="h-full"
      >
        <Link to={`/server/${server.id}`} className="cursor-target flex h-full flex-col">
          <div className="relative">
            {(server.imageUrls?.[0] || server.imageUrl) ? (
              <img
                src={server.imageUrls?.[0] || server.imageUrl}
                alt={server.name}
                className="aspect-video w-full rounded-t-[16px] object-cover"
              />
            ) : (
              <div className="bg-grid flex aspect-video w-full items-center justify-center rounded-t-[16px] bg-surface-2">
                <Blocks size={28} className="text-white/15" />
              </div>
            )}
            <div className="absolute top-2.5 right-2.5">
              <StatusBadge online={!!server.isOnline} />
            </div>
          </div>

          <div className="flex flex-1 flex-col justify-between p-5">
            <div>
              <div className="mb-3 flex items-center justify-between">
                <span className={`rounded-full border bg-gradient-to-r px-2.5 py-1 font-mono text-xs font-semibold ${categoryColors[server.subject] ?? "from-violet-400/25 to-cyan-400/15 text-violet-200 border-violet-300/25"}`}>
                  {server.subject}
                </span>
                <span className="flex items-center gap-1 text-xs text-white/40">
                  <Gamepad2 size={13} /> {server.edition}
                </span>
              </div>
              <h3 className="flex items-center gap-1.5 font-mono text-lg font-bold text-white">{server.name}{server.isVerified && <BadgeCheck size={17} className="shrink-0 text-sky-400" aria-label="Verified server" />}</h3>
              <p className="mt-1.5 line-clamp-2 text-sm text-white/55">{server.description}</p>
            </div>

            <div className="mt-5 flex items-center justify-between border-t border-border pt-4 text-xs text-white/45">
              <span className="flex items-center gap-1.5">
                <Users size={13} /> up to {server.maxPlayers}
              </span>
              <span className="flex items-center gap-1.5">
                <ScrollText size={13} /> {server.rules.length} rules
              </span>
              <span>by {server.ownerName}</span>
            </div>
          </div>
        </Link>
      </BorderGlow>
    </motion.div>
  );
}
