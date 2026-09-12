import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { AnimatePresence, motion } from "framer-motion";
import { KeyRound, MessageCircle, Radio, Server } from "lucide-react";
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
    <div>
      <div className="flex items-center gap-2 pb-2">
        <Radio size={13} className="text-[#7fb069]" />
        <h3 className="font-mono text-[11px] font-semibold tracking-widest text-white/45 uppercase">
          Live activity
        </h3>
        <button
          type="button"
          onClick={toggleActivity}
          aria-pressed={enabled}
          className={`ml-auto rounded-md px-2 py-1 font-mono text-[10px] tracking-widest uppercase transition-colors ${
            enabled
              ? "text-white/55 hover:text-white"
              : "text-white/30 hover:text-white/55"
          }`}
        >
          {enabled ? "Pause feed" : "Resume feed"}
        </button>
      </div>
      {enabled && <div className="max-h-44 space-y-0.5 overflow-y-auto">
        <AnimatePresence initial={false}>
          {events.map((e) => {
            const Icon = ICONS[e.type];
            return (
              <motion.div
                key={e.id}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
              >
                <Link
                  to={`/server/${e.serverId}`}
                  className="flex items-center gap-2.5 py-1 text-[13px] text-white/60 transition-colors hover:text-white"
                >
                  <Icon size={12} className="shrink-0 text-white/35" />
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
