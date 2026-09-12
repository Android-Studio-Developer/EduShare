import { useEffect, useRef, useState, type CSSProperties } from "react";
import { Link, NavLink, useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { Bell, Blocks, BookOpen, Bot, Castle, ChevronDown, Crown, Heart, LayoutDashboard, LogOut, MessageCircle, Music, Music2, PartyPopper, Plus, Server, Shield, Sparkles, UserCircle, UserPlus, Users, Volume2 } from "lucide-react";
import { useAuth } from "../context/AuthContext";
import { formatMusicTime, MUSIC_TRACKS, useMusic } from "../context/MusicContext";
import { isStaffRole } from "../lib/moderation";
import Button from "./Button";
import eduShareMark from "../assets/edushare-mark.svg";

function navLinkClass({ isActive }: { isActive: boolean }) {
  return `cursor-target shrink-0 whitespace-nowrap font-mono text-sm font-medium transition-colors hover:text-white ${
    isActive ? "text-brand-400" : "text-white/60"
  }`;
}

function moreLinkClass({ isActive }: { isActive: boolean }) {
  return `cursor-target flex items-center gap-2 whitespace-nowrap rounded-lg px-3 py-2 font-mono text-sm font-medium transition-colors hover:bg-white/[.06] hover:text-white ${
    isActive ? "text-brand-400" : "text-white/70"
  }`;
}

export default function Navbar() {
  const { user, role, logOut } = useAuth();
  const { playing: musicPlaying, toggle: toggleMusic, volume, setVolume, currentTime, duration, seek, track, setTrack } = useMusic();
  const navigate = useNavigate();
  const [moreOpen, setMoreOpen] = useState(false);
  const [musicOpen, setMusicOpen] = useState(false);
  const moreRef = useRef<HTMLDivElement>(null);
  const musicRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (moreRef.current && !moreRef.current.contains(e.target as Node)) setMoreOpen(false);
      if (musicRef.current && !musicRef.current.contains(e.target as Node)) setMusicOpen(false);
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  return (
    <header className="sticky top-0 z-50 border-b border-white/[.07] bg-[#0b0d11]/82 shadow-[0_8px_35px_-28px_rgba(65,105,225,.7)] backdrop-blur-2xl">
      <div className="mx-auto flex h-16 max-w-6xl items-center gap-4 px-6">
        <Link to="/" className="cursor-target flex shrink-0 items-center gap-2">
          <motion.div
            whileHover={{ rotate: -8, scale: 1.08 }}
            className="h-10 w-10"
          >
            <img src={eduShareMark} alt="" className="h-full w-full" />
          </motion.div>
          <span className="font-mono text-lg font-bold tracking-tight text-white">
            edu<span className="text-brand-300">Share</span>
          </span>
        </Link>

        <nav className="hidden min-w-0 flex-1 items-center gap-6 md:flex">
          <NavLink to="/" end className={navLinkClass}>
            Browse
          </NavLink>
          <NavLink to="/guide" className={navLinkClass}><BookOpen size={13} className="inline" /> Guide</NavLink>
          <NavLink to="/team" className={navLinkClass}><Users size={13} className="inline" /> Team</NavLink>
          {user && <NavLink to="/chat" className={navLinkClass}><MessageCircle size={13} className="inline" /> Chat</NavLink>}
          {user && <NavLink to="/shares" className={navLinkClass}><Blocks size={13} className="inline" /> Worlds & Mods</NavLink>}
          {user && <NavLink to="/fun" className={navLinkClass}><PartyPopper size={13} className="inline" /> Fun</NavLink>}

          {user && (
          <div ref={moreRef} className="relative shrink-0">
            <button
              type="button"
              onClick={() => setMoreOpen((o) => !o)}
              className={`cursor-target flex shrink-0 items-center gap-1 whitespace-nowrap font-mono text-sm font-medium transition-colors hover:text-white ${
                moreOpen ? "text-white" : "text-white/60"
              }`}
            >
              More <ChevronDown size={13} className={`transition-transform ${moreOpen ? "rotate-180" : ""}`} />
            </button>
            {moreOpen && (
              <div className="absolute top-full left-0 z-50 mt-2 w-48 rounded-xl border border-white/10 bg-[#12151c] p-1.5 shadow-xl shadow-black/40">
                <NavLink to="/dashboard" className={moreLinkClass} onClick={() => setMoreOpen(false)}>
                  <LayoutDashboard size={14} /> Dashboard
                </NavLink>
                <NavLink to="/chat-servers" className={moreLinkClass} onClick={() => setMoreOpen(false)}>
                  <Server size={14} /> Servers
                </NavLink>
                <NavLink to="/develop" className={moreLinkClass} onClick={() => setMoreOpen(false)}>
                  <Bot size={14} /> Developer Portal
                </NavLink>
                <NavLink to="/moderation" className={moreLinkClass} onClick={() => setMoreOpen(false)}>
                  <Shield size={14} /> {role === "owner" ? "Owner" : role === "moderator" || role === "actor" || role === "headmod" ? "Moderate" : "Apply for Mod"}
                </NavLink>
                <NavLink to="/favorites" className={moreLinkClass} onClick={() => setMoreOpen(false)}>
                  <Heart size={14} /> Favorites
                </NavLink>
                <NavLink to="/notifications" className={moreLinkClass} onClick={() => setMoreOpen(false)}>
                  <Bell size={14} /> Alerts
                </NavLink>
                <NavLink to="/profile" className={moreLinkClass} onClick={() => setMoreOpen(false)}>
                  <UserCircle size={14} /> Profile
                </NavLink>
                <NavLink to="/players" className={moreLinkClass} onClick={() => setMoreOpen(false)}>
                  <Users size={14} /> Players
                </NavLink>
                <NavLink to="/staff" className={moreLinkClass} onClick={() => setMoreOpen(false)}>
                  <Crown size={14} /> Staff
                </NavLink>
                <NavLink to="/friends" className={moreLinkClass} onClick={() => setMoreOpen(false)}>
                  <UserPlus size={14} /> Friends
                </NavLink>
                <NavLink to="/party" className={moreLinkClass} onClick={() => setMoreOpen(false)}>
                  <Castle size={14} /> Party & Guild
                </NavLink>
                <NavLink to="/changelog" className={moreLinkClass} onClick={() => setMoreOpen(false)}>
                  <Sparkles size={14} /> Changelog
                </NavLink>
                <NavLink to="/voice" className={moreLinkClass} onClick={() => setMoreOpen(false)}>
                  <Volume2 size={14} /> Voice Chat
                </NavLink>
              </div>
            )}
          </div>
          )}
        </nav>

        <div className="flex shrink-0 items-center gap-3">
          <div ref={musicRef} className="relative shrink-0">
            <Button variant="ghost" size="sm" onClick={() => setMusicOpen((o) => !o)} aria-label="Music controls">
              {musicPlaying ? <Music size={16} /> : <Music2 size={16} className="text-white/40" />}
            </Button>
            {musicOpen && (
              <div className="absolute top-full right-0 z-50 mt-2 w-64 rounded-xl border border-white/10 bg-[#12151c] p-3 shadow-xl shadow-black/40">
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={toggleMusic}
                    aria-label={musicPlaying ? "Pause music" : "Play music"}
                    className="cursor-target flex shrink-0 items-center justify-center rounded-lg p-1.5 text-white/80 hover:bg-white/[.06] hover:text-white"
                  >
                    {musicPlaying ? <Music size={14} /> : <Music2 size={14} />}
                  </button>
                  <span className="font-mono text-[11px] tabular-nums text-white/50">
                    {formatMusicTime(currentTime)} / {formatMusicTime(duration)}
                  </span>
                </div>
                <div className="mt-2 flex gap-1 rounded-lg border border-white/10 bg-black/20 p-0.5">
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
                  className="range-slider mt-2"
                  style={{ "--range-pct": `${duration ? (Math.min(currentTime, duration) / duration) * 100 : 0}%` } as CSSProperties}
                />
                <div className="mt-2 flex items-center gap-2 px-0.5">
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
              </div>
            )}
          </div>
          {user ? (
            <>
              <Button
                variant="secondary"
                size="sm"
                onClick={() => navigate("/create")}
                className="hidden sm:inline-flex"
              >
                <Plus size={15} /> Register Server
              </Button>
              {isStaffRole(role) && (
                <Button variant="ghost" size="sm" onClick={() => navigate("/moderation")} aria-label="Moderation">
                  <Shield size={16} />
                </Button>
              )}
              <Button
                variant="ghost"
                size="sm"
                onClick={() => navigate("/dashboard")}
                className="sm:hidden"
                aria-label="Dashboard"
              >
                <LayoutDashboard size={16} />
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={async () => {
                  await logOut();
                  navigate("/");
                }}
              >
                <LogOut size={15} />
                <span className="hidden sm:inline">Log out</span>
              </Button>
            </>
          ) : (
            <>
              <Button variant="ghost" size="sm" onClick={() => navigate("/login")}>
                Log in
              </Button>
              <Button size="sm" onClick={() => navigate("/signup")}>
                Sign up
              </Button>
            </>
          )}
        </div>
      </div>
    </header>
  );
}
