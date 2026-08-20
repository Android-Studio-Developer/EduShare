import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { Blocks, Handshake, Search, Server, Sparkles } from "lucide-react";
import { subscribeToServers } from "../lib/servers";
import { LATEST_PATCH_NOTE } from "../lib/patchNotes";
import type { MinecraftServer } from "../types";
import { SUBJECTS } from "../types";
import ServerCard from "../components/ServerCard";
import Button from "../components/Button";
import ActivityFeed from "../components/ActivityFeed";
import SeasonEvents from "../components/SeasonEvents";
import ImportantAnnouncements from "../components/ImportantAnnouncements";

export default function Home() {
  const navigate = useNavigate();
  const [servers, setServers] = useState<MinecraftServer[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [subject, setSubject] = useState<string | "All">("All");

  useEffect(() => {
    const unsub = subscribeToServers((s) => {
      setServers(s);
      setLoading(false);
    });
    return unsub;
  }, []);

  const filtered = useMemo(() => {
    return servers.filter((s) => {
      const matchesSubject = subject === "All" || s.subject === subject;
      const matchesSearch =
        s.name.toLowerCase().includes(search.toLowerCase()) ||
        s.description.toLowerCase().includes(search.toLowerCase());
      return matchesSubject && matchesSearch;
    });
  }, [servers, search, subject]);

  const partners = useMemo(() => servers.filter((s) => s.isPartner), [servers]);

  return (
    <div>
      <ImportantAnnouncements />

      <section className="relative mx-auto max-w-6xl px-6 pt-20 pb-16 text-center sm:pt-28">
        <div className="color-orb top-12 left-[8%] h-12 w-12 bg-brand-500/70 shadow-[0_0_55px_rgba(65,105,225,.35)]" />
        <div className="color-orb top-36 right-[9%] h-7 w-7 bg-lime-300/70 shadow-[0_0_35px_rgba(163,230,53,.2)] [animation-delay:-2s]" />
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="rainbow-border mb-6 inline-flex items-center gap-2 rounded-full bg-[#131831]/90 px-4 py-2 font-mono text-xs font-medium text-white/70 shadow-lg shadow-fuchsia-500/10"
        >
          <Sparkles size={13} className="text-brand-300" />
          Built for Minecraft Education classrooms
        </motion.div>

        <motion.h1
          initial={{ opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.05 }}
          className="font-mono text-4xl font-extrabold tracking-[-0.05em] text-white drop-shadow-[0_8px_35px_rgba(217,70,239,.2)] sm:text-6xl"
        >
          Share your <span className="font-editorial text-shimmer italic">Minecraft Edu</span> world.
          <br className="hidden sm:block" /> Safely.
        </motion.h1>

        <motion.p initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.08 }} className="mx-auto mt-5 max-w-2xl text-base leading-relaxed text-indigo-100/55 sm:text-lg">
          Discover colorful classroom worlds, meet creative builders, and jump into your next Minecraft Education adventure.
        </motion.p>

        <motion.div
          initial={{ opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="mt-8 flex flex-wrap items-center justify-center gap-3"
        >
          <Button size="lg" onClick={() => navigate("/create")}>
            <Server size={17} /> Register a Server
          </Button>
          <Button
            size="lg"
            variant="secondary"
            onClick={() =>
              document.getElementById("browse")?.scrollIntoView({ behavior: "smooth" })
            }
          >
            <Blocks size={17} /> Browse Servers
          </Button>
        </motion.div>
      </section>

      <section id="browse" className="mx-auto max-w-6xl px-6 pb-24">
        <div className="glass-panel mb-8 rounded-2xl"><ActivityFeed /></div>

        {partners.length > 0 && (
          <div className="mb-8 space-y-3">
            {partners.map((partner) => (
              <Link
                key={partner.id}
                to={`/server/${partner.id}`}
                className="cursor-target block overflow-hidden rounded-2xl border border-violet-400/30 bg-gradient-to-br from-violet-500/[.12] via-fuchsia-500/[.06] to-brand-500/[.08] p-6 transition hover:border-violet-400/50"
              >
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="flex items-center gap-2.5">
                    <span className="grid h-9 w-9 place-items-center rounded-xl border border-violet-300/25 bg-violet-400/10 text-violet-300">
                      <Handshake size={18} />
                    </span>
                    <div>
                      <p className="font-mono text-xs font-bold tracking-[.1em] text-violet-300/80 uppercase">eduShare Partner</p>
                      <h2 className="font-mono text-lg font-bold text-white">{partner.name}</h2>
                    </div>
                  </div>
                </div>
                {partner.partnerPerks && <p className="mt-3 text-sm text-white/70">{partner.partnerPerks}</p>}
              </Link>
            ))}
          </div>
        )}

        <div className="mb-8 rounded-2xl border border-border bg-surface p-6">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="flex items-center gap-2 font-mono text-sm font-bold text-white">
              <Sparkles size={15} className="text-brand-400" /> What's new — {LATEST_PATCH_NOTE.version}
            </p>
            <Link to="/changelog" className="cursor-target text-xs text-brand-400 hover:underline">Full changelog →</Link>
          </div>
          <ul className="mt-3 space-y-1">
            {LATEST_PATCH_NOTE.items.slice(0, 5).map((item) => (
              <li key={item} className="text-sm text-white/65">{item}</li>
            ))}
          </ul>
        </div>

        <SeasonEvents />

        <div className="mb-8 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="relative w-full sm:max-w-xs">
            <Search size={16} className="absolute top-1/2 left-3.5 -translate-y-1/2 text-white/35" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search servers..."
              className="glass-panel w-full rounded-xl border border-white/10 py-2.5 pr-4 pl-10 text-sm text-white placeholder:text-white/35 focus:border-cyan-300/50 focus:outline-none"
            />
          </div>
          <div className="flex flex-wrap gap-2">
            {(["All", ...SUBJECTS] as const).map((s) => (
              <button
                key={s}
                onClick={() => setSubject(s)}
                className={`cursor-target rounded-full border px-3.5 py-1.5 font-mono text-xs font-medium transition-colors ${
                  subject === s
                    ? "border-brand-300/45 bg-brand-500/15 text-blue-100 shadow-lg shadow-blue-500/10"
                    : "border-white/10 bg-white/[.035] text-white/50 hover:border-brand-300/25 hover:bg-brand-500/[.08] hover:text-white"
                }`}
              >
                {s}
              </button>
            ))}
          </div>
        </div>

        {loading ? (
          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="h-44 animate-pulse rounded-2xl border border-border bg-surface" />
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-border py-20 text-center text-white/40">
            No servers found yet. Be the first to{" "}
            <Link to="/create" className="cursor-target text-brand-400 hover:underline">
              register one
            </Link>
            .
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {filtered.map((server, i) => (
              <ServerCard key={server.id} server={server} index={i} />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
