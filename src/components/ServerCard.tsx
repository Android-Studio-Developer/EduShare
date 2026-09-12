import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import { ArrowUpRight, BadgeCheck, Blocks, Users } from "lucide-react";
import type { MinecraftServer } from "../types";

export default function ServerCard({ server, index = 0 }: { server: MinecraftServer; index?: number }) {
  const image = server.imageUrls?.[0] || server.imageUrl;

  return (
    <motion.article
      initial={{ opacity: 0, y: 10 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-30px" }}
      transition={{ duration: 0.35, delay: Math.min(index * 0.035, 0.2) }}
      className="h-full bg-surface"
    >
      <Link to={`/server/${server.id}`} className="cursor-target group flex h-full flex-col p-4 transition-colors hover:bg-white/[.025]">
        <div className="relative overflow-hidden rounded-lg bg-surface-2">
          {image ? (
            <img src={image} alt="" className="aspect-[16/9] w-full object-cover transition-transform duration-500 group-hover:scale-[1.025]" />
          ) : (
            <div className="bg-grid flex aspect-[16/9] items-center justify-center"><Blocks size={25} className="text-white/14" /></div>
          )}
          <span className="absolute left-3 top-3 inline-flex items-center gap-1.5 rounded-md bg-[#0d100e]/85 px-2 py-1 text-[10px] font-semibold text-white/75 backdrop-blur-sm">
            <i className={`h-1.5 w-1.5 rounded-full ${server.isOnline ? "bg-emerald-400" : "bg-white/30"}`} />
            {server.isOnline ? "Online" : "Offline"}
          </span>
        </div>

        <div className="flex flex-1 flex-col px-1 pb-1 pt-5">
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0">
              <p className="text-[10px] font-semibold uppercase tracking-[.13em] text-white/34">{server.subject} · {server.edition}</p>
              <h3 className="mt-2 flex items-center gap-1.5 truncate text-lg font-semibold tracking-[-.025em] text-white">
                {server.name}{server.isVerified && <BadgeCheck size={16} className="shrink-0 text-brand-300" aria-label="Verified server" />}
              </h3>
            </div>
            <ArrowUpRight size={16} className="mt-1 shrink-0 text-white/25 transition-colors group-hover:text-brand-300" />
          </div>
          <p className="mt-2 line-clamp-2 text-sm leading-6 text-white/48">{server.description}</p>
          <div className="mt-auto flex items-center justify-between border-t border-white/[.07] pt-4 text-xs text-white/34">
            <span className="flex items-center gap-1.5"><Users size={13} /> Up to {server.maxPlayers}</span>
            <span className="truncate pl-3">by {server.ownerName}</span>
          </div>
        </div>
      </Link>
    </motion.article>
  );
}
