import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { AnimatePresence, motion } from "framer-motion";
import { KeyRound, MessageCircle, Power, Radio, Server } from "lucide-react";
import { subscribeToActivity } from "../lib/activity";
import type { ActivityEvent } from "../types";

const COPY: Record<ActivityEvent["type"], (e: ActivityEvent) => string> = {
  server_created: (e) => `${e.actorName} registered ${e.serverName}`,
  code_unlocked: (e) => `${e.actorName} unlocked the code for ${e.serverName}`,
  chat_message: (e) => `${e.actorName} said something in ${e.serverName}`,
};

const ICONS: Record<ActivityEvent["type"], typeof Server> = {
  server_created: Server,
  code_unlocked: KeyRound,
  chat_message: MessageCircle,
};

function timeAgo(ts: number) {
  const s = Math.floor((Date.now() - ts) / 1000);
  if (s < 60) return "just now";
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  return `${h}h ago`;
}

export default function ActivityFeed() {
  const [events, setEvents] = useState<ActivityEvent[]>([]);
  const [enabled, setEnabled] = useState(
    () => localStorage.getItem("edushare-live-activity") !== "off",
  );

  useEffect(() => {
    const unsub = subscribeToActivity(setEvents);
    return unsub;
  }, []);

  if (events.length === 0) return null;

  function toggleActivity() {
    setEnabled((current) => {
      const next = !current;
      localStorage.setItem("edushare-live-activity", next ? "on" : "off");
      return next;
    });
  }

  return (
    <div className="mb-8 overflow-hidden rounded-2xl border border-border bg-surface/60">
      <div className="flex items-center gap-2 border-b border-border bg-surface-2/50 px-5 py-3">
        <Radio size={14} className="text-brand-400" />
        <h3 className="font-mono text-xs font-semibold tracking-wide text-white/70 uppercase">
          Live activity
        </h3>
        <button
          type="button"
          onClick={toggleActivity}
          aria-pressed={enabled}
          className={`cursor-target ml-auto flex items-center gap-1.5 rounded-full border px-2.5 py-1 font-mono text-[10px] font-semibold uppercase transition-colors ${
            enabled
              ? "border-brand-500/40 bg-brand-500/10 text-brand-300"
              : "border-border bg-surface text-white/35"
          }`}
        >
          <Power size={11} /> {enabled ? "On" : "Off"}
        </button>
      </div>
      {enabled && <div className="max-h-48 space-y-1 overflow-y-auto p-3">
        <AnimatePresence initial={false}>
          {events.map((e) => {
            const Icon = ICONS[e.type];
            return (
              <motion.div
                key={e.id}
                initial={{ opacity: 0, x: -8 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0 }}
              >
                <Link
                  to={`/server/${e.serverId}`}
                  className="cursor-target flex items-center gap-2.5 rounded-lg px-2 py-1.5 text-sm text-white/60 transition-colors hover:bg-surface-2 hover:text-white"
                >
                  <Icon size={13} className="shrink-0 text-brand-400" />
                  <span className="truncate">{COPY[e.type](e)}</span>
                  <span className="ml-auto shrink-0 text-[11px] text-white/30">
                    {timeAgo(e.createdAt)}
                  </span>
                </Link>
              </motion.div>
            );
          })}
        </AnimatePresence>
      </div>}
    </div>
  );
}
