import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { motion } from "framer-motion";
import { ArrowLeft, BadgeCheck, Flag, Gamepad2, ScrollText, ShoppingBag, User, Users } from "lucide-react";
import { isStaffRole } from "../lib/moderation";
import { recordJoin, recordVisit, setServerVerified, subscribeToServer } from "../lib/servers";
import type { MinecraftServer } from "../types";
import { useAuth } from "../context/AuthContext";
import RulesGate from "../components/RulesGate";
import OwnerCodePanel from "../components/OwnerCodePanel";
import ServerChat from "../components/ServerChat";
import StatusBadge from "../components/StatusBadge";
import WorldShowcase from "../components/WorldShowcase";
import FavoriteButton from "../components/FavoriteButton";
import ServerReviews from "../components/ServerReviews";
import ServerOperations from "../components/ServerOperations";

export default function ServerDetail() {
  const { id } = useParams<{ id: string }>();
  const { user, role } = useAuth();
  const [server, setServer] = useState<MinecraftServer | null | undefined>(undefined);

  useEffect(() => {
    if (!id) return;
    const unsub = subscribeToServer(id, setServer);
    return unsub;
  }, [id]);

  useEffect(() => { if (id) void recordVisit(id).catch(() => undefined); }, [id]);

  if (server === undefined) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-brand-500/30 border-t-brand-400" />
      </div>
    );
  }

  if (server === null) {
    return (
      <div className="mx-auto max-w-xl px-6 py-24 text-center">
        <h1 className="text-xl font-bold text-white">Server not found</h1>
        <p className="mt-2 text-sm text-white/50">It may have been removed by its owner.</p>
        <Link to="/" className="cursor-target mt-6 inline-block text-sm font-medium text-brand-400 hover:underline">
          ← Back to browse
        </Link>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-2xl px-6 py-14">
      <Link
        to="/"
        className="cursor-target mb-6 inline-flex items-center gap-1.5 text-sm text-white/45 hover:text-white"
      >
        <ArrowLeft size={14} /> Back to browse
      </Link>

      <motion.div initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }}>
        <div className="mb-6 overflow-hidden rounded-2xl border border-border bg-surface">
          <WorldShowcase images={server.imageUrls?.length ? server.imageUrls : server.imageUrl ? [server.imageUrl] : []} name={server.name} />
          <div className="p-6">
            <div className="flex flex-wrap items-center gap-2">
              <span className="rounded-full bg-brand-500/10 px-2.5 py-1 font-mono text-xs font-semibold text-brand-300">
                {server.subject}
              </span>
              <StatusBadge online={!!server.isOnline} />
              <FavoriteButton serverId={server.id} />
            </div>
            <h1 className="mt-3 flex items-center gap-2 font-mono text-2xl font-bold text-white">{server.name}{server.isVerified && <BadgeCheck size={21} className="text-sky-400" aria-label="Verified server" />}</h1>
            {isStaffRole(role) && <button type="button" onClick={() => setServerVerified(server.id, !server.isVerified)} className="cursor-target mt-2 text-xs text-sky-400 hover:underline">{server.isVerified ? "Remove verification" : "Verify ownership/original map"}</button>}
            <p className="mt-2 text-sm text-white/60">{server.description}</p>
          </div>
        </div>

        <div className="mb-6 grid grid-cols-3 gap-3 text-center">
          <div className="rounded-xl border border-border bg-surface p-4">
            <Gamepad2 size={16} className="mx-auto mb-1.5 text-brand-400" />
            <p className="text-xs text-white/40">Edition</p>
            <p className="mt-0.5 truncate font-mono text-sm font-semibold text-white">{server.edition}</p>
          </div>
          <div className="rounded-xl border border-border bg-surface p-4">
            <Users size={16} className="mx-auto mb-1.5 text-brand-400" />
            <p className="text-xs text-white/40">Capacity</p>
            <p className="mt-0.5 font-mono text-sm font-semibold text-white">{server.maxPlayers} players</p>
          </div>
          <div className="rounded-xl border border-border bg-surface p-4">
            <User size={16} className="mx-auto mb-1.5 text-brand-400" />
            <p className="text-xs text-white/40">Host</p>
            <p className="mt-0.5 truncate font-mono text-sm font-semibold text-white">{server.ownerName}</p>
          </div>
        </div>

        <ServerOperations server={server} canManage={user?.uid === server.ownerId || (!!user && (server.managerIds ?? []).includes(user.uid)) || isStaffRole(role)} />

        {user?.uid === server.ownerId ? (
          <OwnerCodePanel serverId={server.id} serverName={server.name} code={server.code} isOnline={!!server.isOnline} />
        ) : (
          <RulesGate
            rules={server.rules}
            code={server.code}
            onReveal={() => recordJoin(server.id, server.name, user?.displayName ?? undefined, user?.uid)}
          />
        )}

        <p className="mt-4 mb-6 flex items-center justify-center gap-1.5 text-xs text-white/30">
          <ScrollText size={12} /> {server.joinsCount} player{server.joinsCount === 1 ? "" : "s"} have unlocked this code
        </p>

        <ServerChat serverId={server.id} serverName={server.name} slowModeSeconds={server.slowModeSeconds ?? 0} banned={!!user && (server.bannedUserIds ?? []).includes(user.uid)} />
        <ServerReviews serverId={server.id} />
        {server.hasShop && (
          <Link to={`/server/${server.id}/shop`} className="cursor-target mt-5 flex items-center justify-center gap-2 rounded-xl border border-brand-500/40 bg-brand-500/10 px-5 py-4 font-mono font-semibold text-brand-300 hover:border-brand-500/70">
            <ShoppingBag size={17} /> Open server shop
          </Link>
        )}
        {user?.uid !== server.ownerId && <Link to={`/server/${server.id}/report`} className="cursor-target mt-4 flex items-center justify-center gap-2 text-xs text-white/35 hover:text-red-400"><Flag size={12}/> Report this server</Link>}
      </motion.div>
    </div>
  );
}
