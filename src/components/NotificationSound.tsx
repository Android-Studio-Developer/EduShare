import { useEffect, useRef, useState } from "react";
import { Bell, MessageCircle, X } from "lucide-react";
import { useAuth } from "../context/AuthContext";
import { subscribeToNotifications } from "../lib/notifications";
import type { SiteNotification } from "../types";
import pingSoundUrl from "../pages/discord_ping_sound_effect.mp3";
import { notificationsAreSilent } from "../lib/notificationPreferences";

// Plays the Discord-style ping sound app-wide the moment a new notification
// lands — a chat mention, a DM, a donation, a server coming online — no
// matter which page you're on. The per-component ping sound in Global Chat
// only fires while that component is mounted; this covers everywhere else.
export default function NotificationSound() {
  const { user } = useAuth();
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const seenIdsRef = useRef<Set<string> | null>(null);
  const [alert, setAlert] = useState<SiteNotification | null>(null);

  useEffect(() => {
    audioRef.current = new Audio(pingSoundUrl);
    audioRef.current.preload = "auto";
  }, []);

  useEffect(() => {
    seenIdsRef.current = null;
    if (!user) return;
    return subscribeToNotifications(user.uid, (notifications) => {
      if (seenIdsRef.current === null) {
        seenIdsRef.current = new Set(notifications.map((n) => n.id));
        return;
      }
      const fresh = notifications.find((n) => !seenIdsRef.current!.has(n.id) && !n.read);
      notifications.forEach((n) => seenIdsRef.current!.add(n.id));
      if (!fresh) return;
      if (!notificationsAreSilent()) void audioRef.current?.play().catch(() => {});
      if ("Notification" in window && Notification.permission === "granted" && document.hidden) {
        const notification = new Notification(fresh.title, {
          body: fresh.message,
          icon: "/favicon.ico",
          tag: fresh.id,
        });
        notification.onclick = () => {
          window.focus();
          window.location.assign(fresh.link || "/notifications");
          notification.close();
        };
      } else {
        setAlert(fresh);
      }
    });
  }, [user]);

  useEffect(() => {
    if (!alert) return;
    const timer = window.setTimeout(() => setAlert(null), 7_000);
    return () => window.clearTimeout(timer);
  }, [alert]);

  if (!alert) return null;
  return (
    <div className="fixed right-4 top-4 z-[1000] w-[min(390px,calc(100vw-2rem))] animate-in slide-in-from-top-3 fade-in duration-200" role="alert">
      <button type="button" onClick={() => window.location.assign(alert.link || "/notifications")} className="cursor-target flex w-full items-center gap-3 rounded-2xl border border-white/15 bg-[#24252b]/95 p-3 text-left text-white shadow-2xl shadow-black/50 backdrop-blur-xl">
        <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-[#5865f2] shadow-lg shadow-[#5865f2]/25">{alert.type === "mention" || alert.type === "dm" ? <MessageCircle size={21}/> : <Bell size={21}/>}</span>
        <span className="min-w-0 flex-1"><span className="block truncate text-sm font-bold">{alert.title}</span><span className="mt-0.5 block line-clamp-2 text-xs leading-5 text-white/60">{alert.message}</span></span>
        <span className="self-start rounded px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide text-white/30">eduShare</span>
      </button>
      <button type="button" aria-label="Dismiss alert" onClick={() => setAlert(null)} className="cursor-target absolute -left-2 -top-2 grid h-7 w-7 place-items-center rounded-full border border-white/10 bg-[#18191d] text-white/55 shadow-lg hover:text-white"><X size={14}/></button>
    </div>
  );
}
