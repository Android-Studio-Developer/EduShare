import { useEffect, useRef } from "react";
import { useAuth } from "../context/AuthContext";
import { useVoiceCall } from "../context/VoiceCallContext";
import { ensureProfile, heartbeat, recordActivity } from "../lib/profiles";
import { ensureOwnerCredits } from "../lib/shop";

export default function PlaytimeTracker() {
  const { user } = useAuth();
  const { joinedChannelId } = useVoiceCall();
  const inCallRef = useRef(false);

  useEffect(() => {
    inCallRef.current = !!joinedChannelId;
  }, [joinedChannelId]);

  useEffect(() => {
    if (!user) return;
    const uid = user.uid;
    const email = user.email;
    void ensureProfile(uid, user.displayName ?? "Player");
    void heartbeat(uid);
    void ensureOwnerCredits(uid, email);

    let lastHeartbeatAt = Date.now();
    const interval = setInterval(() => {
      // Being actively connected to a voice channel counts as online even if
      // the tab is backgrounded (e.g. tabbed into Minecraft while talking).
      if (document.visibilityState !== "visible" && !inCallRef.current) return;
      void recordActivity(uid, 5);
      lastHeartbeatAt = Date.now();
      void ensureOwnerCredits(uid, email);
    }, 5 * 60_000);

    function onVisible() {
      if (document.visibilityState === "visible" && Date.now() - lastHeartbeatAt >= 5 * 60_000) {
        lastHeartbeatAt = Date.now();
        void heartbeat(uid);
      }
    }
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      clearInterval(interval);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [user]);

  return null;
}
