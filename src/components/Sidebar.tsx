import { type CSSProperties, type ReactNode } from "react";
import { NavLink, useNavigate } from "react-router-dom";
import {
  Bell,
  Blocks,
  BookOpen,
  Castle,
  Crown,
  Heart,
  LayoutDashboard,
  LogOut,
  MessageCircle,
  Music,
  Music2,
  PartyPopper,
  Plus,
  Shield,
  Sparkles,
  UserCircle,
  UserPlus,
  Users,
  Volume2,
} from "lucide-react";
import { useAuth } from "../context/AuthContext";
import { formatMusicTime, useMusic } from "../context/MusicContext";
import Button from "./Button";
import eduShareMark from "../assets/edushare-mark.svg";

function linkClass({ isActive }: { isActive: boolean }) {
  return `cursor-target flex items-center gap-2.5 rounded-lg px-3 py-2 font-mono text-sm font-medium transition-colors ${
    isActive ? "bg-brand-500/15 text-brand-300" : "text-white/60 hover:bg-white/[.05] hover:text-white"
  }`;
}

function Group({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="mt-5 first:mt-0">
      <p className="px-3 pb-1.5 font-mono text-[10px] font-bold tracking-[.15em] text-white/25 uppercase">{label}</p>
      <div className="space-y-0.5">{children}</div>
    </div>
  );
}

export default function Sidebar() {
  const { user, role, logOut } = useAuth();
  const { playing: musicPlaying, toggle: toggleMusic, volume, setVolume, currentTime, duration, seek } = useMusic();
  const navigate = useNavigate();

  return (
    <aside className="sticky top-0 flex h-screen w-60 shrink-0 flex-col border-r border-white/[.07] bg-[#0b0d11]/82 backdrop-blur-2xl">
      <NavLink to="/" className="cursor-target flex shrink-0 items-center gap-2 px-4 py-5">
        <img src={eduShareMark} alt="" className="h-8 w-8" />
        <span className="font-mono text-base font-bold tracking-tight text-white">
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

        {user && (
          <Group label="Community">
            <NavLink to="/chat" className={linkClass}><MessageCircle size={15} /> Chat</NavLink>
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
          </Group>
        )}

        {user && (
          <Group label="Account">
            <NavLink to="/dashboard" className={linkClass}><LayoutDashboard size={15} /> Dashboard</NavLink>
            <NavLink to="/profile" className={linkClass}><UserCircle size={15} /> Profile</NavLink>
            <NavLink to="/favorites" className={linkClass}><Heart size={15} /> Favorites</NavLink>
            <NavLink to="/notifications" className={linkClass}><Bell size={15} /> Alerts</NavLink>
          </Group>
        )}

        {user && (
          <Group label="Staff">
            <NavLink to="/moderation" className={linkClass}>
              <Shield size={15} /> {role === "owner" ? "Owner" : role === "moderator" ? "Moderate" : "Apply for Mod"}
            </NavLink>
          </Group>
        )}
      </nav>

      <div className="shrink-0 space-y-2 border-t border-white/[.07] p-3">
        <Button variant="ghost" size="sm" className="w-full" onClick={toggleMusic}>
          {musicPlaying ? <Music size={14} /> : <Music2 size={14} className="text-white/40" />} {musicPlaying ? "Music on" : "Music off"}
        </Button>
        <p className="px-2 text-center font-mono text-[11px] tabular-nums text-white/40">
          {formatMusicTime(currentTime)} / {formatMusicTime(duration)}
        </p>
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
