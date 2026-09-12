import { useEffect, useMemo, useState, type CSSProperties, type ReactNode } from "react";
import { NavLink, useNavigate } from "react-router-dom";
import {
  Bell,
  Bot,
  Blocks,
  BookOpen,
  Calculator,
  Castle,
  Crown,
  Heart,
  LayoutDashboard,
  Laugh,
  LogOut,
  MessageCircle,
  MessageSquare,
  Music,
  Music2,
  PartyPopper,
  Plus,
  Popcorn,
  Server,
  Shield,
  Sparkles,
  Star,
  Swords,
  UserCircle,
  UserPlus,
  Users,
  Volume2,
} from "lucide-react";
import { useAuth } from "../context/AuthContext";
import { formatMusicTime, MUSIC_TRACKS, useMusic } from "../context/MusicContext";
import { subscribeToServers } from "../lib/servers";
import type { MinecraftServer } from "../types";
import Button from "./Button";
import eduShareMark from "../assets/edushare-mark.svg";

function linkClass({ isActive }: { isActive: boolean }) {
  return `cursor-target flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors ${
    isActive ? "bg-white/[.07] text-white" : "text-white/48 hover:bg-white/[.035] hover:text-white/80"
  }`;
}

function Group({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="mt-5 first:mt-0">
      <p className="px-3 pb-1.5 text-[10px] font-semibold tracking-[.14em] text-white/24 uppercase">{label}</p>
      <div className="space-y-0.5">{children}</div>
    </div>
  );
}

export default function Sidebar() {
  const { user, role, logOut } = useAuth();
  const { playing: musicPlaying, toggle: toggleMusic, volume, setVolume, currentTime, duration, seek, track, setTrack } = useMusic();
  const navigate = useNavigate();
  const [servers, setServers] = useState<MinecraftServer[]>([]);

  useEffect(() => subscribeToServers(setServers), []);

  const recommended = useMemo(
    () =>
      [...servers]
        .sort((a, b) => b.joinsCount + b.visitsCount - (a.joinsCount + a.visitsCount))
        .slice(0, 3),
    [servers],
  );

  return (
    <aside className="sticky top-0 flex h-screen w-60 shrink-0 flex-col border-r border-white/[.07] bg-[#0c0f0d]">
      <NavLink to="/" className="cursor-target flex shrink-0 items-center gap-2.5 px-5 py-6">
        <img src={eduShareMark} alt="" className="h-7 w-7" />
        <span className="text-base font-semibold tracking-[-.025em] text-white">
          edu<span className="text-brand-300">Share</span>
        </span>
      </NavLink>

      <nav className="min-h-0 flex-1 overflow-y-auto px-3 pb-4">
        <Group label="Explore">
          <NavLink to="/" end className={linkClass}><Blocks size={15} /> Browse</NavLink>
          <NavLink to="/guide" className={linkClass}><BookOpen size={15} /> Guide</NavLink>
          <NavLink to="/team" className={linkClass}><Crown size={15} /> Team</NavLink>
          <NavLink to="/changelog" className={linkClass}><Sparkles size={15} /> Changelog</NavLink>
        </Group>

        {recommended.length > 0 && (
          <Group label="Recommended">
            {recommended.map((server) => (
              <NavLink key={server.id} to={`/server/${server.id}`} className={linkClass}>
                <Star size={15} className="shrink-0 text-amber-300/70" />
                <span className="truncate">{server.name}</span>
              </NavLink>
            ))}
          </Group>
        )}

        {user && (
          <Group label="Community">
            <NavLink to="/chat" className={linkClass}><MessageCircle size={15} /> Chat</NavLink>
            <NavLink to="/chat-servers" className={linkClass}><Server size={15} /> Servers</NavLink>
            <NavLink to="/messages" className={linkClass}><MessageSquare size={15} /> Messages</NavLink>
            <NavLink to="/friends" className={linkClass}><UserPlus size={15} /> Friends</NavLink>
            <NavLink to="/party" className={linkClass}><Castle size={15} /> Party & Guild</NavLink>
            <NavLink to="/voice" className={linkClass}><Volume2 size={15} /> Voice Chat</NavLink>
            <NavLink to="/players" className={linkClass}><Users size={15} /> Players</NavLink>
          </Group>
        )}

        {user && (
          <Group label="Play">
            <NavLink to="/fun" className={linkClass}><PartyPopper size={15} /> Fun</NavLink>
            <NavLink to="/shares" className={linkClass}><Blocks size={15} /> Worlds & Mods</NavLink>
            <NavLink to="/memes" className={linkClass}><Laugh size={15} /> Meme Dump</NavLink>
            <NavLink to="/movie-drop" className={linkClass}><Popcorn size={15} /> Movie Drop</NavLink>
            <NavLink to="/bedwars" className={linkClass}><Swords size={15} /> Ranked Bedwars</NavLink>
            <NavLink to="/calculator" className={linkClass}><Calculator size={15} /> Calculator</NavLink>
          </Group>
        )}

        {user && (
          <Group label="Account">
            <NavLink to="/dashboard" className={linkClass}><LayoutDashboard size={15} /> Dashboard</NavLink>
            <NavLink to="/develop" className={linkClass}><Bot size={15} /> Developer Portal</NavLink>
            <NavLink to="/profile" className={linkClass}><UserCircle size={15} /> Profile</NavLink>
            <NavLink to="/favorites" className={linkClass}><Heart size={15} /> Favorites</NavLink>
            <NavLink to="/notifications" className={linkClass}><Bell size={15} /> Alerts</NavLink>
          </Group>
        )}

        {user && (
          <Group label="Staff">
            <NavLink to="/moderation" className={linkClass}>
              <Shield size={15} /> {role === "owner" ? "Owner" : role === "moderator" || role === "actor" || role === "headmod" ? "Moderate" : "Apply for Mod"}
            </NavLink>
          </Group>
        )}
      </nav>

      <div className="shrink-0 space-y-2 border-t border-white/[.07] p-4">
        <Button variant="ghost" size="sm" className="w-full" onClick={toggleMusic}>
          {musicPlaying ? <Music size={14} /> : <Music2 size={14} className="text-white/40" />} {musicPlaying ? "Music on" : "Music off"}
        </Button>
        <p className="px-2 text-center font-mono text-[11px] tabular-nums text-white/40">
          {formatMusicTime(currentTime)} / {formatMusicTime(duration)}
        </p>
        <div className="flex gap-1 rounded-lg border border-white/10 bg-black/20 p-0.5">
          {(Object.entries(MUSIC_TRACKS) as [keyof typeof MUSIC_TRACKS, (typeof MUSIC_TRACKS)[keyof typeof MUSIC_TRACKS]][]).map(([id, def]) => (
            <button
              key={id}
              type="button"
              onClick={() => setTrack(id)}
              className={`cursor-target flex-1 rounded-md py-1 font-mono text-[11px] font-semibold transition-colors ${
                track === id ? "bg-brand-500/25 text-brand-300" : "text-white/45 hover:text-white"
              }`}
            >
              {def.label}
            </button>
          ))}
        </div>
        <input
          type="range"
          min={0}
          max={duration || 0}
          step={1}
          value={Math.min(currentTime, duration || 0)}
          onChange={(e) => seek(Number(e.target.value))}
          className="range-slider"
          style={{ "--range-pct": `${duration ? (Math.min(currentTime, duration) / duration) * 100 : 0}%` } as CSSProperties}
        />
        <div className="flex items-center gap-2 px-2">
          <Volume2 size={13} className="shrink-0 text-white/40" />
          <input
            type="range"
            min={0}
            max={1}
            step={0.05}
            value={volume}
            onChange={(e) => setVolume(Number(e.target.value))}
            className="range-slider"
            style={{ "--range-pct": `${volume * 100}%` } as CSSProperties}
          />
        </div>
        {user ? (
          <>
            <Button variant="secondary" size="sm" onClick={() => navigate("/create")} className="w-full">
              <Plus size={14} /> Register Server
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className="w-full"
              onClick={async () => {
                await logOut();
                navigate("/");
              }}
            >
              <LogOut size={14} /> Log out
            </Button>
          </>
        ) : (
          <>
            <Button variant="ghost" size="sm" className="w-full" onClick={() => navigate("/login")}>
              Log in
            </Button>
            <Button size="sm" className="w-full" onClick={() => navigate("/signup")}>
              Sign up
            </Button>
          </>
        )}
      </div>
    </aside>
  );
}
