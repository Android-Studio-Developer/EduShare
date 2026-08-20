import { useEffect, useRef } from "react";
import { useAuth } from "../context/AuthContext";
import { subscribeToNotifications } from "../lib/notifications";
import pingSoundUrl from "../pages/discord_ping_sound_effect.mp3";

// Plays the Discord-style ping sound app-wide the moment a new notification
// lands — a chat mention, a DM, a donation, a server coming online — no
// matter which page you're on. The per-component ping sound in Global Chat
// only fires while that component is mounted; this covers everywhere else.
export default function NotificationSound() {
  const { user } = useAuth();
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const seenIdsRef = useRef<Set<string> | null>(null);

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
      const isNew = notifications.some((n) => !seenIdsRef.current!.has(n.id));
      notifications.forEach((n) => seenIdsRef.current!.add(n.id));
      if (isNew) void audioRef.current?.play().catch(() => {});
    });
  }, [user]);

  return null;
}
