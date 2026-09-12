import { useCallback, useEffect, useRef, useState, type PointerEvent as ReactPointerEvent, type ReactNode } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { Bell, Bot, Compass, FolderKanban, Gamepad2, LayoutDashboard, LogOut, MessageCircle, MessageSquare, Mic2, Music, Music2, Palette, Pause, Play, Plus, Search, Server, UserRound, Volume2, VolumeX, X } from "lucide-react";
import { useAuth } from "../context/AuthContext";
import { formatMusicTime, MUSIC_TRACKS, useMusic } from "../context/MusicContext";
import { useVoiceCall } from "../context/VoiceCallContext";
import { subscribeToProfile, updateProfileBackground } from "../lib/profiles";
import eduShareOsIcon from "../assets/edushare-os.svg";
import Dock from "./Dock";
import ElasticSlider from "./ElasticSlider";
import Footer from "./Footer";
import V4NotificationCenter from "./V4NotificationCenter";
import {
  IconArcade,
  IconBrowse,
  IconChangelog,
  IconChat,
  IconDashboard,
  IconDiscover,
  IconFriends,
  IconGroups,
  IconGuide,
  IconCalculator,
  IconMemes,
  IconNotifications,
  IconPlayers,
  IconProfile,
  IconShares,
  IconTeam,
  IconVoice,
  IconWallpaper,
} from "./V4AppIcons";

interface DesktopPosition { x: number; y: number }
interface DragState { id: string; startX: number; startY: number; originX: number; originY: number; moved: boolean }

const APP_POSITION_PREFIX = "edushare-v4-app-positions:";

const TITLES: Record<string, string> = {
  "/": "Discover",
  "/chat": "Community Chat",
  "/messages": "Messages",
  "/chat-servers": "Servers",
  "/fun": "Arcade",
  "/dashboard": "Dashboard",
  "/develop": "Developer Portal",
  "/notifications": "Notifications",
  "/profile": "Profile & Settings",
  "/players": "Players",
  "/team": "Team & Partners",
  "/changelog": "Changelog",
  "/shares": "Worlds & Mods",
  "/bedwars": "Ranked Bedwars",
  "/memes": "Meme Dump",
  "/calculator": "Calculator",
};

export default function V4Shell({ children }: { children: ReactNode }) {
  const { user, logOut } = useAuth();
  const { playing, toggle, volume, setVolume, currentTime, duration, seek, track, setTrack } = useMusic();
  const { joinedChannelId, participants: voiceParticipants, muted: voiceMuted } = useVoiceCall();
  const navigate = useNavigate();
  const location = useLocation();
  const [now, setNow] = useState(() => new Date());
  const [soundOpen, setSoundOpen] = useState(false);
  const [windowOpen, setWindowOpen] = useState(true);
  const [wallpaperOpen, setWallpaperOpen] = useState(false);
  const [wallpaperDraft, setWallpaperDraft] = useState("");
  const [wallpaperSaving, setWallpaperSaving] = useState(false);
  const [wallpaperMessage, setWallpaperMessage] = useState("");
  const [notificationOpen, setNotificationOpen] = useState(false);
  const [notificationCount, setNotificationCount] = useState(0);
  const [appPositions, setAppPositions] = useState<Record<string, DesktopPosition>>({});
  const desktopRef = useRef<HTMLElement | null>(null);
  const dragRef = useRef<DragState | null>(null);
  const positionsRef = useRef<Record<string, DesktopPosition>>({});
  const suppressOpenRef = useRef("");

  useEffect(() => {
    const interval = window.setInterval(() => setNow(new Date()), 1_000);
    return () => window.clearInterval(interval);
  }, []);

  useEffect(() => { setSoundOpen(false); setNotificationOpen(false); }, [location.pathname]);
  useEffect(() => setWindowOpen(true), [location.pathname, location.search]);
  useEffect(() => {
    if (!user) {
      setWallpaperDraft("");
      return;
    }
    return subscribeToProfile(user.uid, (profile) => setWallpaperDraft(profile?.backgroundUrl ?? ""));
  }, [user]);

  const positionStorageKey = `${APP_POSITION_PREFIX}${user?.uid ?? "guest"}`;

  useEffect(() => {
    try {
      const saved = JSON.parse(localStorage.getItem(positionStorageKey) ?? "{}") as Record<string, DesktopPosition>;
      positionsRef.current = saved;
      setAppPositions(saved);
    } catch {
      positionsRef.current = {};
      setAppPositions({});
    }
  }, [positionStorageKey]);

  function openApp(path: string) {
    setWindowOpen(true);
    setNotificationOpen(false);
    if (`${location.pathname}${location.search}` !== path) navigate(path);
  }

  function defaultAppPosition(index: number): DesktopPosition {
    const width = desktopRef.current?.clientWidth ?? window.innerWidth;
    const columns = width < 900 ? 2 : 3;
    const column = index % columns;
    const row = Math.floor(index / columns);
    return { x: Math.max(16, width - (columns * 124) - 28 + column * 124), y: 34 + row * 126 };
  }

  function startAppDrag(event: ReactPointerEvent<HTMLButtonElement>, id: string, index: number) {
    if (event.button !== 0 || window.matchMedia("(max-width: 640px)").matches) return;
    const origin = positionsRef.current[id] ?? defaultAppPosition(index);
    dragRef.current = { id, startX: event.clientX, startY: event.clientY, originX: origin.x, originY: origin.y, moved: false };
    event.currentTarget.setPointerCapture(event.pointerId);
  }

  function moveApp(event: ReactPointerEvent<HTMLButtonElement>) {
    const drag = dragRef.current;
    if (!drag) return;
    const dx = event.clientX - drag.startX;
    const dy = event.clientY - drag.startY;
    if (Math.abs(dx) + Math.abs(dy) > 5) drag.moved = true;
    if (!drag.moved) return;
    const bounds = desktopRef.current?.getBoundingClientRect();
    const x = Math.max(8, Math.min((bounds?.width ?? window.innerWidth) - 112, drag.originX + dx));
    const y = Math.max(8, Math.min((bounds?.height ?? window.innerHeight) - 120, drag.originY + dy));
    const next = { ...positionsRef.current, [drag.id]: { x, y } };
    positionsRef.current = next;
    setAppPositions(next);
  }

  function stopAppDrag(event: ReactPointerEvent<HTMLButtonElement>) {
    const drag = dragRef.current;
    if (!drag) return;
    if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
    if (drag.moved && event.type !== "pointercancel") {
      suppressOpenRef.current = drag.id;
      localStorage.setItem(positionStorageKey, JSON.stringify(positionsRef.current));
    }
    dragRef.current = null;
  }

  function resetAppPositions() {
    positionsRef.current = {};
    setAppPositions({});
    localStorage.removeItem(positionStorageKey);
    setWallpaperMessage("App layout reset.");
  }

  async function saveWallpaper(value = wallpaperDraft) {
    if (!user) return;
    setWallpaperSaving(true);
    setWallpaperMessage("");
    try {
      await updateProfileBackground(user.uid, value);
      setWallpaperDraft(value.trim());
      setWallpaperMessage(value.trim() ? "Wallpaper saved to your profile." : "Custom wallpaper cleared.");
    } catch (cause) {
      setWallpaperMessage(cause instanceof Error ? cause.message : "Could not save wallpaper.");
    } finally {
      setWallpaperSaving(false);
    }
  }

  const title = location.pathname.startsWith("/server/") ? "Server Details" : TITLES[location.pathname] ?? "SpawnDex";
  const dockItems = [
    { icon: <Compass size={21}/>, label: "Discover", onClick: () => openApp("/") },
    { icon: <Search size={21}/>, label: "Browse", onClick: () => openApp("/#browse") },
  ];
  if (user) dockItems.push(
      { icon: <MessageCircle size={21}/>, label: "Chat", onClick: () => openApp("/chat") },
      { icon: <MessageSquare size={21}/>, label: "Messages", onClick: () => openApp("/messages") },
      { icon: <Server size={21}/>, label: "Servers", onClick: () => openApp("/chat-servers") },
      { icon: <Mic2 size={21}/>, label: "Voice", onClick: () => openApp("/voice") },
      { icon: <Gamepad2 size={21}/>, label: "Arcade", onClick: () => openApp("/fun") },
      { icon: <LayoutDashboard size={21}/>, label: "Dashboard", onClick: () => openApp("/dashboard") },
      { icon: <Bot size={21}/>, label: "Developer", onClick: () => openApp("/develop") },
      { icon: <Bell size={21}/>, label: "Notifications", onClick: () => { setSoundOpen(false); setNotificationOpen(true); } },
      { icon: <UserRound size={21}/>, label: "Profile", onClick: () => openApp("/profile") },
  );

  const desktopApps = [
    { id: "discover", label: "Discover", icon: <IconDiscover/>, tone: "from-blue-300 via-blue-500 to-indigo-800", badge: "D", action: () => openApp("/") },
    { id: "browse", label: "Browse", icon: <IconBrowse/>, tone: "from-cyan-300 via-sky-500 to-blue-800", badge: "WEB", action: () => openApp("/#browse") },
    ...(user ? [
      { id: "chat", label: "Global Chat", icon: <IconChat/>, tone: "from-emerald-300 via-emerald-500 to-teal-800", badge: "#", action: () => openApp("/chat") },
      { id: "messages", label: "Messages", icon: <MessageSquare size={30}/>, tone: "from-sky-300 via-blue-500 to-indigo-800", badge: "DM", action: () => openApp("/messages") },
      { id: "chat-servers", label: "Servers", icon: <Server size={30}/>, tone: "from-violet-300 via-purple-500 to-indigo-900", badge: "LIVE", action: () => openApp("/chat-servers") },
      { id: "friends", label: "Friends", icon: <IconFriends/>, tone: "from-pink-300 via-rose-500 to-red-800", badge: "+", action: () => openApp("/friends") },
      { id: "voice", label: "Voice", icon: <IconVoice/>, tone: "from-violet-300 via-violet-500 to-purple-900", badge: "LIVE", action: () => openApp("/voice") },
      { id: "arcade", label: "Fun Zone", icon: <IconArcade/>, tone: "from-orange-300 via-orange-500 to-red-700", badge: "PLAY", action: () => openApp("/fun") },
      { id: "dashboard", label: "Dashboard", icon: <IconDashboard/>, tone: "from-indigo-300 via-indigo-500 to-blue-900", badge: "PRO", action: () => openApp("/dashboard") },
      { id: "developer", label: "Developer Portal", icon: <Bot size={30}/>, tone: "from-violet-300 via-indigo-500 to-blue-900", badge: "API", action: () => openApp("/develop") },
      { id: "notifications", label: "Notifications", icon: <IconNotifications/>, tone: "from-rose-300 via-pink-500 to-fuchsia-800", badge: notificationCount ? String(Math.min(99, notificationCount)) : "", action: () => setNotificationOpen(true) },
      { id: "profile", label: "Profile", icon: <IconProfile/>, tone: "from-sky-300 via-cyan-500 to-blue-800", badge: "ME", action: () => openApp("/profile") },
      { id: "players", label: "Players", icon: <IconPlayers/>, tone: "from-lime-300 via-emerald-500 to-green-800", badge: "ALL", action: () => openApp("/players") },
      { id: "groups", label: "Parties & Guilds", icon: <IconGroups/>, tone: "from-teal-300 via-cyan-600 to-slate-800", badge: "10+", action: () => openApp("/party") },
      { id: "shares", label: "Worlds & Mods", icon: <IconShares/>, tone: "from-yellow-300 via-amber-500 to-orange-800", badge: "SHOP", action: () => openApp("/shares") },
      { id: "bedwars", label: "Ranked Bedwars", icon: <img src="https://avatars.githubusercontent.com/u/147872336?s=200&v=4" alt="" className="h-8 w-8 rounded-xl object-cover" />, tone: "from-red-400 via-rose-500 to-red-800", badge: "NEW", action: () => openApp("/bedwars") },
      { id: "memes", label: "Meme Dump", icon: <IconMemes/>, tone: "from-yellow-200 via-lime-400 to-emerald-700", badge: "LOL", action: () => openApp("/memes") },
      { id: "calculator", label: "Calculator", icon: <IconCalculator/>, tone: "from-slate-300 via-slate-500 to-slate-800", badge: "MATH", action: () => openApp("/calculator") },
    ] : []),
    { id: "team", label: "Team", icon: <IconTeam/>, tone: "from-amber-200 via-amber-500 to-orange-700", badge: "STAFF", action: () => openApp("/team") },
    { id: "guide", label: "Guide", icon: <IconGuide/>, tone: "from-slate-200 via-slate-500 to-slate-800", badge: "?", action: () => openApp("/guide") },
    { id: "changelog", label: "Changelog", icon: <IconChangelog/>, tone: "from-fuchsia-300 via-purple-500 to-indigo-800", badge: "NEW", action: () => openApp("/changelog") },
    ...(user ? [{ id: "wallpaper", label: "Wallpaper", icon: <IconWallpaper/>, tone: "from-pink-300 via-violet-500 to-indigo-800", badge: "FX", action: () => { setWallpaperMessage(""); setWallpaperOpen(true); } }] : []),
  ];

  const setUnread = useCallback((count: number) => setNotificationCount(count), []);

  return (
    <div className="v4-shell min-h-screen">
      <header className="v4-os-bar">
        <div className="flex min-w-0 items-center gap-2.5">
          <button type="button" onClick={() => windowOpen ? openApp("/") : undefined} className="cursor-target flex items-center gap-2 font-bold text-white"><img src={eduShareOsIcon} alt="" className="h-5 w-5"/><span className="hidden sm:inline">SpawnDex OS</span></button>
          <span className="v4-os-divider"/>
          <button type="button" onClick={() => openApp("/")} className="cursor-target hidden text-[11px] text-white/55 hover:text-white md:block">Discover</button>
          <button type="button" onClick={() => openApp("/team")} className="cursor-target hidden text-[11px] text-white/55 hover:text-white md:block">Team</button>
          {user && <button type="button" onClick={() => openApp("/players")} className="cursor-target hidden text-[11px] text-white/55 hover:text-white md:block">Community</button>}
        </div>
        <div className="flex items-center gap-2 text-[10px] text-white/45">
          <button type="button" onClick={toggle} className="cursor-target rounded-md p-1 hover:bg-white/10 hover:text-white" aria-label={playing ? "Pause music" : "Play music"}>{playing ? <Music size={14}/> : <Music2 size={14}/>}</button>
          <span className="hidden font-mono text-[9px] tabular-nums text-white/40 lg:inline">{formatMusicTime(currentTime)} / {formatMusicTime(duration)}</span>
          <button type="button" onClick={() => { setNotificationOpen(false); setSoundOpen((open) => !open); }} className="cursor-target rounded-md p-1 hover:bg-white/10 hover:text-white" aria-label="Sound controls" aria-expanded={soundOpen}>{volume === 0 ? <VolumeX size={14}/> : <Volume2 size={14}/>}</button>
          {user && <button type="button" onClick={() => { setSoundOpen(false); setNotificationOpen((value) => !value); }} className="cursor-target v4-os-notification-button" aria-label="Notification Center" aria-expanded={notificationOpen}><Bell size={14}/>{notificationCount > 0 && <span>{notificationCount > 99 ? "99+" : notificationCount}</span>}</button>}
          <span className="hidden sm:inline">{now.toLocaleDateString([], { month: "short", day: "numeric" })}</span>
          <span className="font-mono text-white/65">{now.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}</span>
          {user && <button type="button" onClick={async () => { await logOut(); navigate("/"); }} className="cursor-target rounded-md p-1 hover:bg-white/10 hover:text-white" aria-label="Log out"><LogOut size={14}/></button>}
        </div>
        {soundOpen && <div className="v4-sound-panel">
          <div className="flex items-center justify-between gap-3">
            <div><p className="text-[10px] font-bold text-white/75">Sound</p><p className="mt-0.5 text-[9px] text-white/35">{MUSIC_TRACKS[track].label} playlist</p></div>
            <button type="button" onClick={toggle} className="cursor-target grid h-8 w-8 place-items-center rounded-lg bg-white/[.07] text-white/70 hover:bg-white/10 hover:text-white" aria-label={playing ? "Pause" : "Play"}>{playing ? <Pause size={14}/> : <Play size={14}/>}</button>
          </div>
          <div className="mt-3 flex gap-1 rounded-lg border border-white/10 bg-black/20 p-0.5">
            {(Object.entries(MUSIC_TRACKS) as [keyof typeof MUSIC_TRACKS, (typeof MUSIC_TRACKS)[keyof typeof MUSIC_TRACKS]][]).map(([id, def]) => (
              <button key={id} type="button" onClick={() => setTrack(id)} className={`cursor-target flex-1 rounded-md py-1 font-mono text-[10px] font-semibold transition-colors ${track === id ? "bg-white/15 text-white" : "text-white/45 hover:text-white"}`}>
                {def.label}
              </button>
            ))}
          </div>
          <label className="mt-3 block text-[9px] text-white/35" htmlFor="v4-music-progress">Duration</label>
          <ElasticSlider
            className="v4-elastic-slider mt-1"
            value={Math.min(currentTime, Math.max(duration, 1))}
            startingValue={0}
            maxValue={Math.max(duration, 1)}
            isStepped
            stepSize={1}
            showValue={false}
            ariaLabel="Music position"
            leftIcon={<Music2 size={13} />}
            rightIcon={<Music size={13} />}
            onChange={seek}
          />
          <div className="mt-1 flex justify-between font-mono text-[9px] tabular-nums text-white/40"><span>{formatMusicTime(currentTime)}</span><span>{formatMusicTime(duration)}</span></div>
          <div className="mt-3 flex items-center gap-2">
            <button type="button" onClick={() => setVolume(volume === 0 ? .35 : 0)} className="cursor-target text-white/50 hover:text-white" aria-label={volume === 0 ? "Unmute" : "Mute"}>{volume === 0 ? <VolumeX size={14}/> : <Volume2 size={14}/>}</button>
            <ElasticSlider
              className="v4-elastic-slider min-w-0 flex-1"
              value={volume * 100}
              startingValue={0}
              maxValue={100}
              isStepped
              stepSize={1}
              showValue={false}
              ariaLabel="Volume"
              leftIcon={null}
              rightIcon={null}
              onChange={(nextVolume) => setVolume(nextVolume / 100)}
            />
            <span className="w-7 text-right font-mono text-[9px] text-white/35">{Math.round(volume * 100)}</span>
          </div>
        </div>}
      </header>

      <div className={`v4-stage ${windowOpen ? "" : "is-desktop"}`}>
        {windowOpen ? <section className="v4-window">
          <header className="v4-window-bar">
            <div className="v4-window-controls flex gap-1.5"><button type="button" onClick={() => setWindowOpen(false)} className="v4-window-close bg-[#ff5f57]" aria-label="Close app and show desktop" title="Close app"/><span className="bg-[#febc2e]"/><span className="bg-[#28c840]"/></div>
            <p>{title}</p>
            {user ? <button type="button" onClick={() => navigate("/create")} className="v4-window-action cursor-target"><Plus size={13}/>Register server</button> : <span/>}
          </header>
          <main id="main-content" className="v4-main">{children}</main>
          <Footer/>
        </section> : <main id="main-content" className="v4-desktop" ref={desktopRef}>
          <section className="v4-desktop-widgets" aria-label="Desktop widgets">
            <article className="v4-desktop-clock-card">
              <div className="v4-desktop-clock-layout">
                <div><p>{now.toLocaleDateString([], { weekday: "long", month: "long", day: "numeric" })}</p><strong>{now.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}</strong></div>
                <div className="v4-analog-clock" role="img" aria-label={`Analog clock showing ${now.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}`}>
                  <span className="v4-clock-mark is-12">12</span><span className="v4-clock-mark is-3">3</span><span className="v4-clock-mark is-6">6</span><span className="v4-clock-mark is-9">9</span>
                  <i className="v4-clock-hand is-hour" style={{ transform: `translateX(-50%) rotate(${((now.getHours() % 12) + now.getMinutes() / 60) * 30}deg)` }}/>
                  <i className="v4-clock-hand is-minute" style={{ transform: `translateX(-50%) rotate(${(now.getMinutes() + now.getSeconds() / 60) * 6}deg)` }}/>
                  <i className="v4-clock-hand is-second" style={{ transform: `translateX(-50%) rotate(${now.getSeconds() * 6}deg)` }}/>
                  <b/>
                </div>
              </div>
              <span>SpawnDex OS is ready.</span>
            </article>
            {user && <article className="v4-desktop-status-card">
              <header><span>Live status</span><i>{notificationCount > 0 ? `${notificationCount} new` : "All clear"}</i></header>
              <div className="v4-desktop-status-row">
                <button type="button" onClick={toggle} className="cursor-target v4-desktop-status-icon is-music" aria-label={playing ? "Pause music" : "Play music"}>{playing ? <Pause size={15}/> : <Play size={15}/>}</button>
                <div className="min-w-0"><strong>{playing ? "Soundtrack playing" : "Music paused"}</strong><small>{formatMusicTime(currentTime)} / {formatMusicTime(duration)}</small><ElasticSlider className="v4-desktop-music-slider" value={Math.min(currentTime, Math.max(duration, 1))} startingValue={0} maxValue={Math.max(duration, 1)} isStepped stepSize={1} showValue={false} ariaLabel="Music position" leftIcon={null} rightIcon={null} onChange={seek}/></div>
                <em>{playing ? "ON" : "OFF"}</em>
              </div>
              <button type="button" onClick={() => openApp("/voice")} className="cursor-target v4-desktop-status-row">
                <span className="v4-desktop-status-icon is-voice"><Mic2 size={15}/></span>
                <span><strong>{joinedChannelId ? `Voice · ${joinedChannelId}` : "Voice Chat"}</strong><small>{joinedChannelId ? `${voiceParticipants.length} connected · ${voiceMuted ? "muted" : "mic live"}` : "Open rooms and join friends"}</small></span>
                <em className={joinedChannelId ? "is-live" : ""}>{joinedChannelId ? "LIVE" : "OPEN"}</em>
              </button>
              <button type="button" onClick={() => setNotificationOpen(true)} className="cursor-target v4-desktop-status-row">
                <span className="v4-desktop-status-icon is-alert"><Bell size={15}/></span>
                <span><strong>Notification Center</strong><small>{notificationCount ? `${notificationCount} items need attention` : "No unread activity"}</small></span>
                <em>{notificationCount || "OK"}</em>
              </button>
            </article>}
          </section>
          <div className="v4-desktop-welcome"><img src={eduShareOsIcon} alt="" className="h-10 w-10"/><div><strong>SpawnDex Desktop</strong><p>Choose an app to open a new window.</p></div></div>
          <div className="v4-desktop-app-grid">
            {desktopApps.map((app, index) => {
              const position = appPositions[app.id] ?? defaultAppPosition(index);
              return <button key={app.id} type="button" onPointerDown={(event) => startAppDrag(event, app.id, index)} onPointerMove={moveApp} onPointerUp={stopAppDrag} onPointerCancel={stopAppDrag} onClick={() => { if (suppressOpenRef.current === app.id) { suppressOpenRef.current = ""; return; } app.action(); }} className={`cursor-target v4-desktop-app is-${app.id}`} style={{ left: position.x, top: position.y }}><span className={`v4-desktop-app-icon bg-gradient-to-br ${app.tone}`}><span className="v4-desktop-icon-shine"/><span className="v4-desktop-icon-glyph">{app.icon}</span>{app.badge && <em>{app.badge}</em>}</span><strong>{app.label}</strong></button>;
            })}
          </div>
          {wallpaperOpen && <div className="v4-wallpaper-backdrop" onMouseDown={() => setWallpaperOpen(false)}><section className="v4-wallpaper-dialog" onMouseDown={(event) => event.stopPropagation()}>
            <button type="button" onClick={() => setWallpaperOpen(false)} className="cursor-target v4-wallpaper-close" aria-label="Close wallpaper settings"><X size={15}/></button>
            <span className="grid h-10 w-10 place-items-center rounded-xl bg-brand-500/15 text-brand-200"><Palette size={19}/></span>
            <h2 className="mt-3 font-mono text-base font-bold text-white">Desktop wallpaper</h2>
            <p className="mt-1 text-xs leading-relaxed text-white/45">Paste any direct image link. It saves to your profile and follows your account.</p>
            {wallpaperDraft && <div className="mt-4 h-28 rounded-xl border border-white/10 bg-cover bg-center" style={{backgroundImage:`url(${JSON.stringify(wallpaperDraft)})`}}/>}
            <input type="url" value={wallpaperDraft} onChange={(event) => setWallpaperDraft(event.target.value)} placeholder="https://example.com/wallpaper.jpg" className="mt-4 w-full rounded-xl border border-border bg-surface-2 px-4 py-3 text-sm text-white outline-none focus:border-brand-400"/>
            {wallpaperMessage && <p className="mt-2 text-xs text-brand-200">{wallpaperMessage}</p>}
            <div className="mt-4 flex gap-2"><button type="button" disabled={wallpaperSaving} onClick={() => void saveWallpaper()} className="cursor-target flex-1 rounded-xl bg-brand-500 px-4 py-2.5 text-xs font-bold text-white disabled:opacity-50">{wallpaperSaving ? "Saving…" : "Save wallpaper"}</button><button type="button" disabled={wallpaperSaving} onClick={() => void saveWallpaper("")} className="cursor-target rounded-xl border border-border px-4 py-2.5 text-xs text-white/55 hover:text-white disabled:opacity-50">Clear</button></div>
            <button type="button" onClick={resetAppPositions} className="cursor-target mt-2 flex w-full items-center justify-center gap-2 rounded-xl border border-border px-4 py-2.5 text-xs text-white/45 hover:bg-white/[.04] hover:text-white"><FolderKanban size={14}/>Reset desktop icon positions</button>
          </section></div>}
        </main>}
      </div>

      {windowOpen && <div className="v4-dock-wrap"><Dock items={dockItems} baseItemSize={46} magnification={64} panelHeight={62} dockHeight={86}/></div>}
      {user && <V4NotificationCenter open={notificationOpen} onClose={() => setNotificationOpen(false)} onUnreadChange={setUnread}/>} 
    </div>
  );
}
