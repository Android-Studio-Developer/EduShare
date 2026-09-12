import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties, type ReactNode } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import {
  AppWindow, BatteryFull, Bell, Bot, Calculator, Camera, ChevronLeft, Compass, Delete as DeleteKey, Flashlight, Gamepad2, Home, LayoutDashboard,
  LockKeyhole, LogOut, MessageCircle, MessageSquare, Mic2, Music2, Pause, Play, Power,
  ScanFace, Search, Server, Settings, ShieldCheck, Users, Volume2, VolumeX, Wifi, X,
} from "lucide-react";
import { useAuth } from "../context/AuthContext";
import { useMusic } from "../context/MusicContext";
import { useVoiceCall } from "../context/VoiceCallContext";
import { subscribeToProfile } from "../lib/profiles";
import { isLowPowerDevice, isReduceMotion } from "../lib/accessibility";
import type { UserProfile } from "../types";
import eduShareIcon from "../assets/edushare-os.svg";
import V4NotificationCenter from "./V4NotificationCenter";

const LOCK_KEY = "edushare-v5-session-unlocked";
const PIN_KEY = "edushare-v5-device-pin";
const CLOCK_KEY = "edushare-v5-lock-clock";
type PinMode = "setup" | "confirm" | "unlock";
type ClockStyle = "classic" | "split" | "compact";
type ClockPreferences = { style: ClockStyle; color: string; hour12: boolean };

const DEFAULT_CLOCK: ClockPreferences = { style: "classic", color: "#ffffff", hour12: true };
const CLOCK_COLORS = ["#ffffff", "#bde8ff", "#d8c4ff", "#ffc7d9", "#ffe09a"];

function readClockPreferences(): ClockPreferences {
  try { return { ...DEFAULT_CLOCK, ...JSON.parse(localStorage.getItem(CLOCK_KEY) || "{}") }; }
  catch { return DEFAULT_CLOCK; }
}

function formatClock(date: Date, hour12: boolean) {
  const parts = new Intl.DateTimeFormat([], { hour: "numeric", minute: "2-digit", hour12 }).formatToParts(date);
  return {
    time: parts.filter((part) => part.type !== "dayPeriod").map((part) => part.value).join("").trim(),
    period: parts.find((part) => part.type === "dayPeriod")?.value ?? "",
  };
}

function LockCustomizer({ preferences, onChange, onClose }: { preferences: ClockPreferences; onChange: (next: ClockPreferences) => void; onClose: () => void }) {
  return <div className="v5-customize-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
    <section className="v5-customize-sheet" role="dialog" aria-modal="true" aria-label="Customize lock screen clock">
      <header><div><small>V5 LOCK SCREEN</small><h2>Customize clock</h2></div><button type="button" onClick={onClose}>Done</button></header>
      <p>Style</p><div className="v5-clock-style-grid">{(["classic", "split", "compact"] as ClockStyle[]).map((style) => <button type="button" key={style} className={preferences.style === style ? "is-active" : ""} onClick={() => onChange({ ...preferences, style })}><span className={`v5-clock-style-preview is-${style}`}>9:41</span><b>{style}</b></button>)}</div>
      <p>Color</p><div className="v5-clock-color-grid">{CLOCK_COLORS.map((color) => <button type="button" key={color} className={preferences.color === color ? "is-active" : ""} style={{ backgroundColor: color }} onClick={() => onChange({ ...preferences, color })} aria-label={`Use ${color} clock color`}/>)}</div>
      <label className="v5-clock-format"><span><b>24-hour time</b><small>Show 19:32 instead of 7:32 PM</small></span><button type="button" className={!preferences.hour12 ? "is-on" : ""} onClick={() => onChange({ ...preferences, hour12: !preferences.hour12 })}><i/></button></label>
    </section>
  </div>;
}

async function digestPin(pin: string) {
  const bytes = new TextEncoder().encode(`edushare-v5:${pin}`);
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
}

const TITLES: Record<string, string> = {
  "/": "Discover", "/chat": "Chat", "/messages": "Messages", "/chat-servers": "Servers", "/voice": "Voice", "/fun": "Arcade",
  "/dashboard": "Dashboard", "/profile": "Settings", "/players": "People",
  "/friends": "Friends", "/party": "Groups", "/shares": "Worlds & Mods",
  "/bedwars": "Ranked Bedwars", "/develop": "Developer", "/moderation": "Moderation",
  "/team": "Team", "/notifications": "Notifications", "/calculator": "Calculator",
};

interface V5App {
  label: string;
  path: string;
  icon: ReactNode;
  tone: string;
}

export default function V5Shell({ children }: { children: ReactNode }) {
  const { user, role, logOut } = useAuth();
  const { playing, toggle, volume, setVolume, track } = useMusic();
  const { joinedChannelId, participants, muted } = useVoiceCall();
  const navigate = useNavigate();
  const location = useLocation();
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [now, setNow] = useState(() => new Date());
  const [locked, setLocked] = useState(() => sessionStorage.getItem(LOCK_KEY) !== "1");
  const [islandOpen, setIslandOpen] = useState(false);
  const [windowOpen, setWindowOpen] = useState(true);
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [unread, setUnread] = useState(0);
  const [pin, setPin] = useState("");
  const [pendingPin, setPendingPin] = useState("");
  const [pinMode, setPinMode] = useState<PinMode>(() => localStorage.getItem(PIN_KEY) ? "unlock" : "setup");
  const [pinError, setPinError] = useState("");
  const [pinBusy, setPinBusy] = useState(false);
  const [unlocking, setUnlocking] = useState(false);
  const [lockStage, setLockStage] = useState<"wallpaper" | "pin">("wallpaper");
  const [customizerOpen, setCustomizerOpen] = useState(false);
  const [clockPreferences, setClockPreferences] = useState<ClockPreferences>(readClockPreferences);
  const swipeStartRef = useRef<number | null>(null);
  const lockScreenRef = useRef<HTMLElement | null>(null);
  const reduced = isReduceMotion() || isLowPowerDevice();

  useEffect(() => {
    let interval = 0;
    const timeout = window.setTimeout(() => {
      setNow(new Date());
      interval = window.setInterval(() => setNow(new Date()), 60_000);
    }, 60_050 - (Date.now() % 60_000));
    const syncWhenVisible = () => { if (document.visibilityState === "visible") setNow(new Date()); };
    document.addEventListener("visibilitychange", syncWhenVisible);
    return () => {
      window.clearTimeout(timeout);
      window.clearInterval(interval);
      document.removeEventListener("visibilitychange", syncWhenVisible);
    };
  }, []);
  useEffect(() => user ? subscribeToProfile(user.uid, setProfile) : setProfile(null), [user]);
  useEffect(() => { setWindowOpen(true); setIslandOpen(false); }, [location.pathname, location.search]);
  useEffect(() => localStorage.setItem(CLOCK_KEY, JSON.stringify(clockPreferences)), [clockPreferences]);

  const staffMode = role === "owner" || role === "moderator" || role === "actor" || role === "headmod" || role === "dabug" || profile?.rank === "partner";
  const staffLabel = role === "owner" ? "OWNER" : role === "moderator" ? "MOD" : role === "headmod" ? "HEAD MOD" : role === "actor" ? "ACTOR" : role === "dabug" ? "DABUG" : profile?.rank === "partner" ? "PARTNER" : "";

  const apps = useMemo<V5App[]>(() => {
    const list: V5App[] = [
      { label: "Discover", path: "/", icon: <Compass/>, tone: "blue" },
      { label: "Chat", path: "/chat", icon: <MessageCircle/>, tone: "green" },
      { label: "Messages", path: "/messages", icon: <MessageSquare/>, tone: "blue" },
      { label: "Servers", path: "/chat-servers", icon: <Server/>, tone: "violet" },
      { label: "Voice", path: "/voice", icon: <Mic2/>, tone: "violet" },
      { label: "Arcade", path: "/fun", icon: <Gamepad2/>, tone: "orange" },
      { label: "Dashboard", path: "/dashboard", icon: <LayoutDashboard/>, tone: "indigo" },
      { label: "People", path: "/players", icon: <Users/>, tone: "cyan" },
      { label: "Developer", path: "/develop", icon: <Bot/>, tone: "purple" },
      { label: "Calculator", path: "/calculator", icon: <Calculator/>, tone: "slate" },
      { label: "Settings", path: "/profile", icon: <Settings/>, tone: "gray" },
    ];
    if (staffMode) list.push({
      label: role === "moderator" || role === "owner" || role === "actor" || role === "headmod" ? "Moderation" : role === "dabug" ? "Debugger" : "Partner Hub",
      path: role === "moderator" || role === "owner" || role === "actor" || role === "headmod" ? "/moderation" : role === "dabug" ? "/develop" : "/team",
      icon: <ShieldCheck/>, tone: "gold",
    });
    return list;
  }, [role, staffMode]);

  function openApp(path: string) {
    setWindowOpen(true);
    if (location.pathname !== path) navigate(path);
  }

  function finishUnlock() {
    setUnlocking(true);
    sessionStorage.setItem(LOCK_KEY, "1");
    window.setTimeout(() => {
      setLocked(false);
      setUnlocking(false);
      setPin("");
      setLockStage("wallpaper");
    }, reduced ? 20 : 460);
  }

  async function submitPin(value: string) {
    if (value.length !== 4 || pinBusy || !user) return;
    setPinBusy(true);
    setPinError("");
    try {
      if (pinMode === "setup") {
        setPendingPin(value);
        setPin("");
        setPinMode("confirm");
        return;
      }
      if (pinMode === "confirm") {
        if (value !== pendingPin) {
          setPin("");
          setPendingPin("");
          setPinMode("setup");
          setPinError("PINs didn’t match. Create it again.");
          return;
        }
        localStorage.setItem(PIN_KEY, await digestPin(value));
        finishUnlock();
        return;
      }
      const savedPin = localStorage.getItem(PIN_KEY);
      if (savedPin && await digestPin(value) === savedPin) finishUnlock();
      else {
        setPin("");
        setPinError("Incorrect PIN. Try again.");
      }
    } finally {
      setPinBusy(false);
    }
  }

  function pressPin(value: string) {
    if (pinBusy || unlocking) return;
    setPinError("");
    setPin((current) => {
      if (current.length >= 4) return current;
      const next = current + value;
      if (next.length === 4) window.setTimeout(() => void submitPin(next), 90);
      return next;
    });
  }

  function lockDevice() {
    sessionStorage.removeItem(LOCK_KEY);
    setPin("");
    setPendingPin("");
    setPinError("");
    setPinMode(localStorage.getItem(PIN_KEY) ? "unlock" : "setup");
    setLockStage("wallpaper");
    setLocked(true);
    setIslandOpen(false);
  }

  async function powerOff() {
    sessionStorage.removeItem(LOCK_KEY);
    await logOut();
    navigate("/login");
  }

  async function resetPin() {
    localStorage.removeItem(PIN_KEY);
    await powerOff();
  }

  function showPin() {
    lockScreenRef.current?.style.setProperty("--v5-swipe-offset", "0px");
    setLockStage("pin");
    setCustomizerOpen(false);
  }

  function handleSwipeStart(clientY: number) {
    if (lockStage === "wallpaper" && !customizerOpen) {
      swipeStartRef.current = clientY;
      lockScreenRef.current?.classList.add("is-swiping");
    }
  }

  function handleSwipeMove(clientY: number) {
    if (swipeStartRef.current === null) return;
    const offset = Math.max(-180, Math.min(0, clientY - swipeStartRef.current));
    lockScreenRef.current?.style.setProperty("--v5-swipe-offset", `${offset}px`);
  }

  function handleSwipeEnd(clientY: number) {
    if (swipeStartRef.current === null) return;
    const distance = clientY - swipeStartRef.current;
    swipeStartRef.current = null;
    lockScreenRef.current?.classList.remove("is-swiping");
    if (distance < -64) showPin();
    else lockScreenRef.current?.style.setProperty("--v5-swipe-offset", "0px");
  }

  function beginPinChange() {
    sessionStorage.removeItem(LOCK_KEY);
    setPin("");
    setPendingPin("");
    setPinError("");
    setPinMode("setup");
    setLockStage("pin");
    setLocked(true);
  }

  const title = location.pathname.startsWith("/server/") ? "Server" : TITLES[location.pathname] ?? "SpawnDex";
  const unreadChanged = useCallback((count: number) => setUnread(count), []);
  const clock = formatClock(now, clockPreferences.hour12);

  if (locked) {
    const pinTitle = pinMode === "setup" ? "Create a 4-digit PIN" : pinMode === "confirm" ? "Confirm your new PIN" : "Enter PIN";
    return <main
      className={`v5-lock-screen ${lockStage === "pin" ? "is-pin-visible" : ""} ${unlocking ? "is-unlocking" : ""}`}
      aria-label="SpawnDex OS lock screen"
      tabIndex={0}
      ref={lockScreenRef}
      style={{ "--v5-swipe-offset": "0px", "--v5-clock-color": clockPreferences.color } as CSSProperties}
      onPointerDown={(event) => handleSwipeStart(event.clientY)}
      onPointerMove={(event) => handleSwipeMove(event.clientY)}
      onPointerUp={(event) => handleSwipeEnd(event.clientY)}
      onPointerCancel={() => { swipeStartRef.current = null; lockScreenRef.current?.classList.remove("is-swiping"); lockScreenRef.current?.style.setProperty("--v5-swipe-offset", "0px"); }}
      onWheel={(event) => { if (lockStage === "wallpaper" && event.deltaY > 42) showPin(); }}
      onKeyDown={(event) => {
        if (customizerOpen) return;
        if (lockStage === "wallpaper" && (event.key === "ArrowUp" || event.key === "Enter")) showPin();
        else if (lockStage === "pin" && /^\d$/.test(event.key)) pressPin(event.key);
        else if (lockStage === "pin" && event.key === "Backspace") setPin((value) => value.slice(0, -1));
        else if (lockStage === "pin" && event.key === "Escape") setLockStage("wallpaper");
      }}
    >
      <div className="v5-lock-status"><b>{now.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}</b><span><Wifi size={15}/><BatteryFull size={17}/></span></div>
      <section className={`v5-lock-clock is-${clockPreferences.style}`}>
        <LockKeyhole size={15}/>
        <p>{now.toLocaleDateString([], { weekday: "long", month: "long", day: "numeric" })}</p>
        <h1>{clock.period && <small>{clock.period}</small>}<span>{clock.time}</span></h1>
        {lockStage === "wallpaper" && <button type="button" className="v5-clock-customize" onClick={() => setCustomizerOpen(true)}><Settings size={13}/>Customize</button>}
      </section>
      {lockStage === "pin" && <section className="v5-pin-sheet" aria-live="polite">
        <button type="button" className="v5-pin-back" onClick={() => { setLockStage("wallpaper"); setPin(""); setPinError(""); }}><ChevronLeft size={16}/>Lock Screen</button>
        <div className="v5-lock-avatar">{profile?.photoUrl ? <img src={profile.photoUrl} alt=""/> : <img src={eduShareIcon} alt=""/>}</div>
        <h2>{user ? pinTitle : "Sign in to SpawnDex"}</h2>
        {user ? <>
          <p className="v5-pin-user"><ScanFace size={15}/>{profile?.displayName || user.displayName || user.email || "SpawnDex member"}</p>
          <div className={`v5-pin-dots ${pinError ? "has-error" : ""}`} aria-label={`${pin.length} of 4 PIN digits entered`}>{Array.from({ length: 4 }, (_, index) => <i key={index} className={index < pin.length ? "is-filled" : ""}/>)}</div>
          <p className="v5-pin-message">{pinError || (pinMode === "setup" ? "Used only to unlock V5 on this device." : pinMode === "confirm" ? "Enter the same PIN one more time." : "PIN required after locking SpawnDex OS.")}</p>
          <div className="v5-pin-pad">{["1","2","3","4","5","6","7","8","9"].map((digit) => <button type="button" key={digit} onClick={() => pressPin(digit)} disabled={pinBusy}>{digit}</button>)}<button type="button" className="is-text" onClick={() => void (pinMode === "unlock" ? resetPin() : powerOff())}>{pinMode === "unlock" ? "Forgot PIN?" : "Cancel"}</button><button type="button" onClick={() => pressPin("0")} disabled={pinBusy}>0</button><button type="button" className="is-icon" onClick={() => setPin((value) => value.slice(0, -1))} disabled={!pin.length || pinBusy} aria-label="Delete digit"><DeleteKey/></button></div>
        </> : <button type="button" onClick={() => navigate("/login")} className="v5-lock-enter">Continue to sign in</button>}
      </section>}
      {lockStage === "wallpaper" && <div className="v5-lock-shortcuts"><button type="button" onClick={() => navigate("/guide")} aria-label="Accessibility and flashlight"><Flashlight/></button><button type="button" className="v5-swipe-prompt" onClick={showPin}><i/><span>Swipe up to unlock</span></button><button type="button" onClick={() => setCustomizerOpen(true)} aria-label="Customize lock screen"><Camera/></button></div>}
      <button type="button" onClick={() => void powerOff()} className="v5-lock-power" aria-label="Power off"><Power size={16}/></button>
      {customizerOpen && <LockCustomizer preferences={clockPreferences} onChange={setClockPreferences} onClose={() => setCustomizerOpen(false)}/>} 
    </main>;
  }

  return <div className="v5-shell">
    <header className="v5-status-bar">
      <button type="button" onClick={() => setWindowOpen(false)} className="v5-status-brand"><img src={eduShareIcon} alt=""/>SpawnDex</button>
      <span className="v5-status-clock">{now.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}</span>
      <div className="v5-status-right"><Wifi size={14}/><button type="button" onClick={() => setVolume(volume ? 0 : .35)}>{volume ? <Volume2 size={14}/> : <VolumeX size={14}/>}</button><b>{Math.round(volume * 100)}%</b></div>
    </header>

    <div className={`v5-island-wrap ${islandOpen ? "is-open" : ""}`}>
      <button type="button" className="v5-island" onClick={() => setIslandOpen((value) => !value)} aria-expanded={islandOpen}>
        {!islandOpen ? <><span className={`v5-island-dot ${joinedChannelId ? "is-live" : ""}`}/><strong>{joinedChannelId ? `Voice · ${participants.length}` : playing ? "Now playing" : unread ? `${unread} new` : "SpawnDex"}</strong><span>{staffLabel || now.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}</span></> : <div className="v5-island-expanded">
          <div className="v5-island-heading"><img src={eduShareIcon} alt=""/><div><strong>{profile?.displayName || "SpawnDex"}</strong><small>{staffLabel ? `${staffLabel} workspace` : "Connected across the stars"}</small></div><X size={16}/></div>
          <div className="v5-island-grid">
            <span><Music2 size={18}/><b>{playing ? "Playing" : "Paused"}</b><small>{track}</small></span>
            <span><Mic2 size={18}/><b>{joinedChannelId ? `${participants.length} in voice` : "Voice ready"}</b><small>{muted ? "Muted" : "Mic available"}</small></span>
          </div>
        </div>}
      </button>
      {islandOpen && <div className="v5-island-actions">
        <button type="button" onClick={toggle}>{playing ? <Pause size={16}/> : <Play size={16}/>}<span>{playing ? "Pause" : "Play"}</span></button>
        <button type="button" onClick={() => openApp("/voice")}><Mic2 size={16}/><span>Voice</span></button>
        <button type="button" onClick={() => { setIslandOpen(false); setNotificationsOpen(true); }}><Bell size={16}/><span>Alerts</span></button>
        <button type="button" onClick={lockDevice}><LockKeyhole size={16}/><span>Lock</span></button>
      </div>}
    </div>

    {!windowOpen ? <main className="v5-home-screen">
      <section className="v5-hero-widget">
        <span>{now.toLocaleDateString([], { weekday: "long", month: "long", day: "numeric" })}</span>
        <strong>{clock.time}</strong>
        <p>{staffMode ? `${staffLabel} tools are ready.` : "Your people. One orbit."}</p>
        <div className="v5-hero-actions"><button type="button" onClick={() => setCustomizerOpen(true)}><Settings size={14}/>Customize clock</button><button type="button" onClick={beginPinChange}><LockKeyhole size={14}/>{localStorage.getItem(PIN_KEY) ? "Change PIN" : "Set PIN"}</button></div>
      </section>
      <section className="v5-app-grid" aria-label="Apps">{apps.map((app) => <button type="button" key={`${app.label}-${app.path}`} onClick={() => openApp(app.path)} className="v5-app"><span className={`v5-app-icon is-${app.tone}`}>{app.icon}<i/></span><b>{app.label}</b></button>)}</section>
    </main> : <section className="v5-app-window">
      <header><button type="button" onClick={() => setWindowOpen(false)} className="v5-window-back" aria-label="Back to Home"><ChevronLeft size={19}/><span>Home</span></button><p>{title}</p><button type="button" onClick={() => setNotificationsOpen(true)} className="v5-window-alert"><Bell size={15}/>{unread > 0 && <i>{unread > 9 ? "9+" : unread}</i>}</button></header>
      <main id="main-content" className="v5-window-content">{children}</main>
    </section>}

    <nav className="v5-dock" aria-label="Dock">
      <button type="button" onClick={() => setWindowOpen(false)} className={!windowOpen ? "is-active" : ""}><Home/><span>Home</span></button>
      <button type="button" onClick={() => openApp("/")}><Search/><span>Discover</span></button>
      <button type="button" onClick={() => openApp("/chat")}><MessageCircle/><span>Chat</span></button>
      <button type="button" onClick={() => openApp("/fun")}><Gamepad2/><span>Play</span></button>
      <button type="button" onClick={() => openApp("/profile")}><AppWindow/><span>Settings</span></button>
      <button type="button" onClick={() => void powerOff()}><LogOut/><span>Log out</span></button>
    </nav>
    {user && <V4NotificationCenter open={notificationsOpen} onClose={() => setNotificationsOpen(false)} onUnreadChange={unreadChanged}/>} 
    {customizerOpen && <LockCustomizer preferences={clockPreferences} onChange={setClockPreferences} onClose={() => setCustomizerOpen(false)}/>} 
    {!reduced && <div className="v5-ambient-glow"/>}
  </div>;
}
