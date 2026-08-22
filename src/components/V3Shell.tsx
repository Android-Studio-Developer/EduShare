import { useEffect, useMemo, useState, type ReactNode } from "react";
import { Link, NavLink, useLocation, useNavigate } from "react-router-dom";
import {
  Bell,
  Blocks,
  BookOpen,
  Castle,
  ChevronLeft,
  ChevronRight,
  CircleUserRound,
  Crown,
  Gamepad2,
  Heart,
  LayoutDashboard,
  LogOut,
  Menu,
  MessageCircle,
  Music,
  Music2,
  Plus,
  Search,
  Shield,
  Sparkles,
  UserPlus,
  Users,
  Volume2,
  X,
  type LucideIcon,
} from "lucide-react";
import { useAuth } from "../context/AuthContext";
import { useMusic } from "../context/MusicContext";
import eduShareMark from "../assets/edushare-mark.svg";
import Footer from "./Footer";

type NavItem = { to: string; label: string; icon: LucideIcon; end?: boolean };

const publicItems: NavItem[] = [
  { to: "/", label: "Discover", icon: Search, end: true },
  { to: "/guide", label: "Guide", icon: BookOpen },
  { to: "/team", label: "Team", icon: Crown },
  { to: "/changelog", label: "What's new", icon: Sparkles },
];

const communityItems: NavItem[] = [
  { to: "/chat", label: "Community chat", icon: MessageCircle },
  { to: "/friends", label: "Friends", icon: UserPlus },
  { to: "/party", label: "Party & guild", icon: Castle },
  { to: "/voice", label: "Voice rooms", icon: Volume2 },
  { to: "/players", label: "Players", icon: Users },
];

const libraryItems: NavItem[] = [
  { to: "/fun", label: "Arcade", icon: Gamepad2 },
  { to: "/shares", label: "Worlds & mods", icon: Blocks },
  { to: "/favorites", label: "Favorites", icon: Heart },
];

const accountItems: NavItem[] = [
  { to: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { to: "/notifications", label: "Notifications", icon: Bell },
  { to: "/profile", label: "Profile & settings", icon: CircleUserRound },
];

const routeTitles: Record<string, string> = {
  "/": "Discover",
  "/guide": "Guide",
  "/team": "Team",
  "/changelog": "What's new",
  "/chat": "Community chat",
  "/friends": "Friends",
  "/party": "Party & guild",
  "/voice": "Voice rooms",
  "/players": "Players",
  "/fun": "Arcade",
  "/shares": "Worlds & mods",
  "/favorites": "Favorites",
  "/dashboard": "Dashboard",
  "/notifications": "Notifications",
  "/profile": "Profile & settings",
  "/moderation": "Moderation",
  "/create": "Register server",
};

function SideLink({ item, collapsed, onClick }: { item: NavItem; collapsed: boolean; onClick?: () => void }) {
  const Icon = item.icon;
  return (
    <NavLink
      to={item.to}
      end={item.end}
      onClick={onClick}
      title={collapsed ? item.label : undefined}
      className={({ isActive }) => `v3-nav-link cursor-target ${isActive ? "is-active" : ""}`}
    >
      <Icon size={18} strokeWidth={1.8} />
      {!collapsed && <span>{item.label}</span>}
    </NavLink>
  );
}

function NavGroup({ label, items, collapsed, onClick }: { label: string; items: NavItem[]; collapsed: boolean; onClick?: () => void }) {
  return (
    <div className="v3-nav-group">
      {!collapsed && <p>{label}</p>}
      <div>{items.map((item) => <SideLink key={item.to} item={item} collapsed={collapsed} onClick={onClick} />)}</div>
    </div>
  );
}

export default function V3Shell({ children }: { children: ReactNode }) {
  const { user, role, logOut } = useAuth();
  const { playing, toggle } = useMusic();
  const navigate = useNavigate();
  const location = useLocation();
  const [collapsed, setCollapsed] = useState(() => localStorage.getItem("edushare-v3-sidebar") === "collapsed");
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => {
    localStorage.setItem("edushare-v3-sidebar", collapsed ? "collapsed" : "expanded");
  }, [collapsed]);

  useEffect(() => setMobileOpen(false), [location.pathname]);

  const title = useMemo(() => {
    if (location.pathname.startsWith("/server/")) return "Server details";
    if (location.pathname.startsWith("/dispute/")) return "Dispute room";
    return routeTitles[location.pathname] ?? "eduShare";
  }, [location.pathname]);

  const staffLabel = role === "owner" ? "Owner tools" : role === "moderator" ? "Moderation" : "Apply for mod";
  const staffItem: NavItem = { to: "/moderation", label: staffLabel, icon: Shield };

  return (
    <div className="v3-shell min-h-screen">
      <a href="#main-content" className="v3-skip-link">Skip to content</a>

      <aside className={`v3-sidebar ${collapsed ? "is-collapsed" : ""}`}>
        <div className="v3-sidebar-brand">
          <Link to="/" className="cursor-target flex min-w-0 items-center gap-3">
            <img src={eduShareMark} alt="" className="h-9 w-9 shrink-0" />
            {!collapsed && <span className="truncate text-base font-extrabold tracking-[-.04em] text-white">edu<span className="text-brand-300">Share</span></span>}
          </Link>
          <button type="button" className="v3-icon-button" onClick={() => setCollapsed((value) => !value)} aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}>
            {collapsed ? <ChevronRight size={17} /> : <ChevronLeft size={17} />}
          </button>
        </div>

        <nav className="v3-sidebar-scroll" aria-label="Primary navigation">
          <NavGroup label="Explore" items={publicItems} collapsed={collapsed} />
          {user && <NavGroup label="Community" items={communityItems} collapsed={collapsed} />}
          {user && <NavGroup label="Library" items={libraryItems} collapsed={collapsed} />}
          {user && <NavGroup label="Workspace" items={[...accountItems, staffItem]} collapsed={collapsed} />}
        </nav>

        <div className="v3-sidebar-footer">
          <button type="button" onClick={toggle} className="v3-nav-link cursor-target" title={collapsed ? (playing ? "Pause music" : "Play music") : undefined}>
            {playing ? <Music size={18} /> : <Music2 size={18} />}
            {!collapsed && <span>{playing ? "Music playing" : "Music paused"}</span>}
          </button>
          {user && (
            <button type="button" className="v3-user-card cursor-target" onClick={() => navigate("/profile")} title={collapsed ? (user.displayName ?? "Profile") : undefined}>
              <span className="v3-avatar">{user.photoURL ? <img src={user.photoURL} alt="" /> : (user.displayName?.[0] ?? "P").toUpperCase()}</span>
              {!collapsed && <span className="min-w-0 flex-1 text-left"><strong>{user.displayName ?? "Player"}</strong><small>{role}</small></span>}
            </button>
          )}
          {user && <button type="button" className="v3-nav-link cursor-target" onClick={async () => { await logOut(); navigate("/"); }} title={collapsed ? "Log out" : undefined}><LogOut size={18} />{!collapsed && <span>Log out</span>}</button>}
        </div>
      </aside>

      <div className="v3-workspace">
        <header className="v3-topbar">
          <div className="flex min-w-0 items-center gap-3">
            <img src={eduShareMark} alt="" className="h-8 w-8 lg:hidden" />
            <div className="min-w-0">
              <p className="truncate text-sm font-bold text-white sm:text-base">{title}</p>
              <p className="hidden text-[11px] text-white/35 sm:block">Minecraft Education community</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <span className="v3-version-pill hidden sm:inline-flex"><Sparkles size={12} /> V3</span>
            {user && <button type="button" onClick={() => navigate("/create")} className="v3-create-button cursor-target"><Plus size={15} /><span className="hidden sm:inline">Register server</span></button>}
            {user && <button type="button" onClick={() => navigate("/notifications")} className="v3-icon-button cursor-target" aria-label="Notifications"><Bell size={18} /></button>}
            <button type="button" onClick={() => setMobileOpen(true)} className="v3-icon-button cursor-target lg:hidden" aria-label="Open menu"><Menu size={19} /></button>
          </div>
        </header>

        <main id="main-content" className="v3-main flex-1">{children}</main>
        <Footer />
      </div>

      <nav className="v3-mobile-nav" aria-label="Mobile navigation">
        <SideLink item={publicItems[0]} collapsed />
        {user && <SideLink item={communityItems[0]} collapsed />}
        {user && <SideLink item={accountItems[0]} collapsed />}
        {user && <SideLink item={accountItems[2]} collapsed />}
        <button type="button" className={`v3-nav-link cursor-target ${mobileOpen ? "is-active" : ""}`} onClick={() => setMobileOpen(true)} aria-label="More navigation"><Menu size={18} /></button>
      </nav>

      {mobileOpen && (
        <div className="v3-mobile-overlay" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setMobileOpen(false); }}>
          <section className="v3-mobile-sheet" role="dialog" aria-modal="true" aria-label="Navigation menu">
            <div className="mb-4 flex items-center justify-between">
              <div className="flex items-center gap-2"><img src={eduShareMark} alt="" className="h-8 w-8" /><strong>Navigate</strong></div>
              <button type="button" className="v3-icon-button" onClick={() => setMobileOpen(false)} aria-label="Close menu"><X size={18} /></button>
            </div>
            <NavGroup label="Explore" items={publicItems} collapsed={false} onClick={() => setMobileOpen(false)} />
            {user && <NavGroup label="Community" items={communityItems} collapsed={false} onClick={() => setMobileOpen(false)} />}
            {user && <NavGroup label="Library" items={libraryItems} collapsed={false} onClick={() => setMobileOpen(false)} />}
            {user && <NavGroup label="Workspace" items={[...accountItems, staffItem]} collapsed={false} onClick={() => setMobileOpen(false)} />}
          </section>
        </div>
      )}
    </div>
  );
}
