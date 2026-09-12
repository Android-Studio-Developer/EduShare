import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { useNavigate } from "react-router-dom";
import LiquidGlass from "liquid-glass-react";
import { Bell, CalendarDays, Check, CheckCheck, Coins, ExternalLink, Gamepad2, Gift, Megaphone, MessageCircle, Plus, Shield, Trophy, Users, X } from "lucide-react";
import { useAuth } from "../context/AuthContext";
import { useNow } from "../hooks/useNow";
import { cancelCommunityEvent, claimCommunityEventPayout, createCommunityEvent, finishCommunityEvent, joinCommunityEvent, subscribeToCommunityEvents } from "../lib/communityEvents";
import { markAllNotificationsRead, markNotificationRead, subscribeToNotifications } from "../lib/notifications";
import { subscribeToProfile } from "../lib/profiles";
import { rankTier } from "../lib/ranks";
import { ensureWallet, subscribeToBalance } from "../lib/shop";
import type { CommunityEvent, SiteNotification, UserProfile } from "../types";
import pingSoundUrl from "../pages/discord_ping_sound_effect.mp3";

interface ToastItem {
  id: string;
  title: string;
  message: string;
  link: string;
  kind: "notification" | "event" | "win";
  notificationId?: string;
}

const EVENT_SEEN_PREFIX = "edushare-v4-seen-events:";
const SILENT_KEY = "edushare-notifications-silent";

function LiquidSurface({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <div className={`v4-liquid-surface ${className}`}>
    <div className="v4-liquid-layer" aria-hidden="true">
      <LiquidGlass displacementScale={28} blurAmount={0.09} saturation={140} aberrationIntensity={0.8} elasticity={0.06} cornerRadius={24} padding="0" style={{ width: "100%", height: "100%" }}>
        <span className="v4-liquid-fill"/>
      </LiquidGlass>
    </div>
    <div className="v4-liquid-content">{children}</div>
  </div>;
}

function timeAgo(timestamp: number, now: number) {
  const seconds = Math.max(0, Math.floor((now - timestamp) / 1000));
  if (seconds < 45) return "Now";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

function remaining(timestamp: number, now: number) {
  const minutes = Math.max(0, Math.ceil((timestamp - now) / 60_000));
  if (minutes <= 0) return "Entry closed";
  if (minutes < 60) return `${minutes}m left`;
  const hours = Math.ceil(minutes / 60);
  return `${hours}h left`;
}

function NotificationGlyph({ type }: { type: SiteNotification["type"] }) {
  const Icon = type === "mention" || type === "dm" ? MessageCircle : type === "game" ? Gamepad2 : type === "donation" ? Coins : type === "moderation" || type === "report" ? Shield : Bell;
  return <span className={`v4-notification-glyph is-${type}`}><Icon size={17}/></span>;
}

function openLink(link: string, navigate: ReturnType<typeof useNavigate>) {
  if (/^https?:\/\//i.test(link)) window.open(link, "_blank", "noopener,noreferrer");
  else navigate(link || "/notifications");
}

export default function V4NotificationCenter({ open, onClose, onUnreadChange }: { open: boolean; onClose: () => void; onUnreadChange: (count: number) => void }) {
  const { user } = useAuth();
  const navigate = useNavigate();
  const now = useNow(10_000);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [notifications, setNotifications] = useState<SiteNotification[]>([]);
  const [events, setEvents] = useState<CommunityEvent[]>([]);
  const [balance, setBalance] = useState(0);
  const [seenEventIds, setSeenEventIds] = useState<Set<string>>(() => new Set());
  const [toast, setToast] = useState<ToastItem | null>(null);
  const [composerOpen, setComposerOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [link, setLink] = useState("/fun");
  const [creditPrize, setCreditPrize] = useState(25);
  const [durationMinutes, setDurationMinutes] = useState(60);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const knownNotifications = useRef<Set<string> | null>(null);
  const knownEvents = useRef<Map<string, CommunityEvent["status"]> | null>(null);
  const audio = useRef<HTMLAudioElement | null>(null);

  function playPing() {
    if (localStorage.getItem(SILENT_KEY) === "1") return;
    void audio.current?.play().catch(() => {});
  }

  useEffect(() => {
    audio.current = new Audio(pingSoundUrl);
    audio.current.preload = "auto";
  }, []);

  useEffect(() => {
    knownNotifications.current = null;
    if (!user) return;
    return subscribeToNotifications(user.uid, (items) => {
      if (knownNotifications.current === null) knownNotifications.current = new Set(items.map((item) => item.id));
      else {
        const fresh = items.find((item) => !knownNotifications.current!.has(item.id) && !item.read);
        items.forEach((item) => knownNotifications.current!.add(item.id));
        if (fresh) {
          setToast({ id: fresh.id, title: fresh.title, message: fresh.message, link: fresh.link, kind: "notification", notificationId: fresh.id });
        }
      }
      setNotifications(items);
    });
  }, [user]);

  useEffect(() => {
    knownEvents.current = null;
    return subscribeToCommunityEvents((items) => {
      if (knownEvents.current === null) knownEvents.current = new Map(items.map((item) => [item.id, item.status]));
      else {
        const newEvent = items.find((item) => !knownEvents.current!.has(item.id) && item.status === "active");
        const wonEvent = user ? items.find((item) => knownEvents.current!.get(item.id) === "active" && item.status === "finished" && item.winnerId === user.uid) : undefined;
        items.forEach((item) => knownEvents.current!.set(item.id, item.status));
        if (wonEvent) {
          setToast({ id: `win-${wonEvent.id}`, title: `You won ${wonEvent.creditPrize} credits!`, message: `${wonEvent.hostName} selected you as the winner of ${wonEvent.title}.`, link: wonEvent.link, kind: "win" });
          playPing();
        } else if (newEvent && newEvent.hostId !== user?.uid) {
          setToast({ id: `event-${newEvent.id}`, title: `${newEvent.hostName} is hosting an event`, message: `${newEvent.title} · ${newEvent.creditPrize} credit prize`, link: newEvent.link, kind: "event" });
          playPing();
        }
      }
      setEvents(items);
    });
  }, [user]);

  useEffect(() => {
    if (!user) {
      setProfile(null);
      setBalance(0);
      return;
    }
    try {
      const stored = JSON.parse(localStorage.getItem(`${EVENT_SEEN_PREFIX}${user.uid}`) ?? "[]") as string[];
      setSeenEventIds(new Set(stored));
    } catch {
      setSeenEventIds(new Set());
    }
    void ensureWallet(user.uid);
    const stopProfile = subscribeToProfile(user.uid, setProfile);
    const stopBalance = subscribeToBalance(user.uid, setBalance);
    return () => { stopProfile(); stopBalance(); };
  }, [user]);

  useEffect(() => {
    if (!toast) return;
    const timeout = window.setTimeout(() => setToast(null), 6500);
    return () => window.clearTimeout(timeout);
  }, [toast]);

  const visibleEvents = useMemo(() => events.filter((event) => (event.status === "active" && (event.endsAt > now || event.hostId === user?.uid)) || (event.status === "finished" && now - event.finishedAt < 24 * 60 * 60 * 1000)), [events, now, user?.uid]);
  const visibleEventIds = visibleEvents.map((event) => event.id).join("|");
  const unreadEvents = visibleEvents.filter((event) => !seenEventIds.has(event.id)).length;
  const unread = notifications.filter((item) => !item.read).length + unreadEvents;
  const canHost = rankTier(profile?.rank) >= rankTier("mvp_plus");

  useEffect(() => {
    if (!user) return;
    events.forEach((event) => {
      const canClaim = (event.status === "finished" && event.winnerId === user.uid) || (event.status === "cancelled" && event.hostId === user.uid);
      if (canClaim && !event.payoutClaimed) void claimCommunityEventPayout(event.id, user.uid).catch((cause) => console.error("Could not claim event credits:", cause));
    });
  }, [events, user]);

  useEffect(() => onUnreadChange(unread), [onUnreadChange, unread]);

  useEffect(() => {
    if (!open || !user || !visibleEventIds) return;
    const eventIds = visibleEventIds.split("|");
    setSeenEventIds((current) => {
      const next = new Set(current);
      eventIds.forEach((eventId) => next.add(eventId));
      localStorage.setItem(`${EVENT_SEEN_PREFIX}${user.uid}`, JSON.stringify([...next].slice(-100)));
      return next;
    });
  }, [open, user, visibleEventIds]);

  async function run(action: () => Promise<void>, success = "") {
    setBusy(true);
    setMessage("");
    try {
      await action();
      if (success) setMessage(success);
    } catch (cause) {
      setMessage(cause instanceof Error ? cause.message : "That action did not work.");
    } finally {
      setBusy(false);
    }
  }

  async function hostEvent() {
    if (!user || !profile) return;
    await run(async () => {
      await createCommunityEvent({ hostId: user.uid, hostName: profile.displayName, hostPhotoUrl: profile.photoUrl, title, description, link, creditPrize, durationMinutes });
      setTitle("");
      setDescription("");
      setComposerOpen(false);
    }, "Event announced to SpawnDex.");
  }

  async function openNotification(item: SiteNotification) {
    if (!item.read) await markNotificationRead(item.id).catch(() => {});
    onClose();
    openLink(item.link, navigate);
  }

  async function clearUnread() {
    await run(async () => {
      await markAllNotificationsRead(notifications);
      if (user) {
        const all = new Set(visibleEvents.map((event) => event.id));
        setSeenEventIds(all);
        localStorage.setItem(`${EVENT_SEEN_PREFIX}${user.uid}`, JSON.stringify([...all]));
      }
    });
  }

  return <>
    {toast && <div className="v4-notification-toast" role="status">
      <LiquidSurface className="v4-liquid-toast">
        <div role="button" tabIndex={0} onKeyDown={(event) => { if (event.key === "Enter" || event.key === " ") { if (toast.notificationId) void markNotificationRead(toast.notificationId); setToast(null); openLink(toast.link, navigate); } }} onClick={() => { if (toast.notificationId) void markNotificationRead(toast.notificationId); setToast(null); openLink(toast.link, navigate); }} className="cursor-target v4-notification-toast-inner">
          <span className={`v4-notification-glyph ${toast.kind === "event" ? "is-event" : toast.kind === "win" ? "is-win" : "is-mention"}`}>{toast.kind === "event" ? <Megaphone size={18}/> : toast.kind === "win" ? <Trophy size={18}/> : <MessageCircle size={18}/>}</span>
          <span className="min-w-0 flex-1 text-left"><strong>{toast.title}</strong><small>{toast.message}</small></span>
          <button type="button" onClick={(event) => { event.stopPropagation(); setToast(null); }} className="cursor-target v4-toast-close" aria-label="Dismiss"><X size={13}/></button>
        </div>
      </LiquidSurface>
    </div>}

    {open && <div className="v4-notification-scrim" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
      <aside className="v4-notification-center" aria-label="Notification Center">
        <div className="v4-notification-center-header"><div><p className="text-[10px] font-bold uppercase tracking-[.18em] text-white/35">SpawnDex OS</p><h2>Notification Center</h2></div><div className="flex items-center gap-1"><button type="button" onClick={() => void clearUnread()} disabled={busy || unread === 0} className="cursor-target v4-notification-header-button" title="Mark all read"><CheckCheck size={15}/></button><button type="button" onClick={onClose} className="cursor-target v4-notification-header-button" aria-label="Close"><X size={16}/></button></div></div>
        <div className="v4-notification-summary"><span><Bell size={14}/>{unread ? `${unread} unread` : "You're caught up"}</span>{canHost && <button type="button" onClick={() => { setComposerOpen((value) => !value); setMessage(""); }} className="cursor-target"><Plus size={13}/>Host credit event</button>}</div>

        {composerOpen && <LiquidSurface><form onSubmit={(event) => { event.preventDefault(); void hostEvent(); }} className="v4-event-composer">
          <div className="flex items-center justify-between"><div><h3>New credit event</h3><p>The prize is reserved now; MVP+ hosts draw the winner.</p></div><Gift size={19} className="text-amber-300"/></div>
          <input required maxLength={80} value={title} onChange={(event) => setTitle(event.target.value)} placeholder="Event title"/>
          <textarea required maxLength={240} value={description} onChange={(event) => setDescription(event.target.value)} placeholder="What should interested players do?"/>
          <input required maxLength={500} value={link} onChange={(event) => setLink(event.target.value)} placeholder="/fun or https://event-link.com"/>
          <div className="grid grid-cols-2 gap-2"><label>Prize · no fixed cap<input type="number" min={1} step={1} value={creditPrize} onChange={(event) => setCreditPrize(Number(event.target.value))}/></label><label>Duration<select value={durationMinutes} onChange={(event) => setDurationMinutes(Number(event.target.value))}><option value={30}>30 minutes</option><option value={60}>1 hour</option><option value={180}>3 hours</option><option value={360}>6 hours</option><option value={1440}>24 hours</option></select></label></div>
          <div className="flex items-center justify-between gap-2"><p className="text-[10px] text-white/35">Balance: {balance} credits · prize can use any available amount</p><button type="submit" disabled={busy || !Number.isSafeInteger(creditPrize) || creditPrize < 1 || creditPrize > balance} className="cursor-target">{busy ? "Publishing…" : `Publish · ${creditPrize} credits`}</button></div>
        </form></LiquidSurface>}
        {message && <p className="v4-notification-message">{message}</p>}

        <div className="v4-notification-scroll">
          {visibleEvents.map((event) => {
            const joined = event.participantIds.includes(user?.uid ?? "");
            const isHost = event.hostId === user?.uid;
            const isPending = event.status === "active";
            const entryOpen = isPending && event.endsAt > now;
            return <LiquidSurface key={event.id}><article className="v4-event-card">
              <div className="flex items-start gap-3"><span className="v4-notification-glyph is-event"><Megaphone size={17}/></span><div className="min-w-0 flex-1"><div className="flex items-start justify-between gap-2"><div><p className="v4-notification-app">EVENT · {event.hostName}</p><h3>{event.title}</h3></div><span className="v4-notification-time">{event.status === "finished" ? "Finished" : remaining(event.endsAt, now)}</span></div><p className="v4-notification-body">{event.description}</p><div className="mt-2 flex flex-wrap items-center gap-2 text-[10px] text-white/40"><span className="text-amber-300"><Coins size={11} className="mr-1 inline"/>{event.creditPrize} credits</span><span><Users size={11} className="mr-1 inline"/>{event.participants.length} interested</span>{event.winnerName && <span className="text-emerald-300"><Trophy size={11} className="mr-1 inline"/>{event.winnerName} won</span>}</div>
                <div className="mt-3 flex flex-wrap gap-2">{entryOpen && !isHost && !joined && <button type="button" disabled={busy} onClick={() => user && profile && void run(() => joinCommunityEvent(event.id, user.uid, profile.displayName, profile.photoUrl), "Marked as interested — you're in the prize draw.")} className="cursor-target v4-event-action is-primary">Interested</button>}{joined && entryOpen && <span className="v4-event-entered"><Check size={11}/>Interested</span>}{isHost && isPending && <><button type="button" disabled={busy || event.participants.length === 0} onClick={() => void run(() => finishCommunityEvent(event.id, user!.uid), "Winner selected; payout sent.")} className="cursor-target v4-event-action is-primary">Draw winner</button><button type="button" disabled={busy} onClick={() => void run(() => cancelCommunityEvent(event.id, user!.uid), "Event cancelled; refund sent.")} className="cursor-target v4-event-action">Cancel & refund</button></>}<button type="button" onClick={() => openLink(event.link, navigate)} className="cursor-target v4-event-action"><ExternalLink size={11}/>Open</button></div>
              </div></div>
            </article></LiquidSurface>;
          })}

          {notifications.slice(0, 30).map((item) => <LiquidSurface key={item.id}><button type="button" onClick={() => void openNotification(item)} className={`cursor-target v4-notification-card ${item.read ? "is-read" : ""}`}><NotificationGlyph type={item.type}/><span className="min-w-0 flex-1 text-left"><span className="flex items-start justify-between gap-2"><span><span className="v4-notification-app">{item.type}</span><strong>{item.title}</strong></span><small className="v4-notification-time">{timeAgo(item.createdAt, now)}</small></span><span className="v4-notification-body">{item.message}</span></span>{!item.read && <span className="v4-notification-unread"/>}</button></LiquidSurface>)}
          {visibleEvents.length === 0 && notifications.length === 0 && <div className="v4-notification-empty"><CalendarDays size={25}/><p>No notifications or live events.</p></div>}
        </div>
      </aside>
    </div>}
  </>;
}
