import { createContext, useContext, useEffect, useRef, useState, type Dispatch, type ReactNode, type SetStateAction } from "react";
import { useVoiceChannel } from "../hooks/useVoiceChannel";
import { useAuth } from "./AuthContext";
import { cleanupInactiveStaffMeeting } from "../lib/voice";
import { isStaffRole } from "../lib/moderation";
import connectSoundUrl from "../pages/connect.mp3";
import disconnectSoundUrl from "../pages/disconnect.mp3";

type VoiceCallValue = ReturnType<typeof useVoiceChannel> & {
  deafened: boolean;
  setDeafened: Dispatch<SetStateAction<boolean>>;
  ttsEnabled: boolean;
  setTtsEnabled: Dispatch<SetStateAction<boolean>>;
};

const VoiceCallContext = createContext<VoiceCallValue | null>(null);

// Mounted once at the app root (outside the router), so the WebRTC
// connection this owns survives page navigation instead of tearing down —
// useVoiceChannel's cleanup effect fires whenever the component that calls
// it unmounts, which used to be Voice.tsx itself on every route change.
export function VoiceCallProvider({ children }: { children: ReactNode }) {
  const voice = useVoiceChannel();
  const { role, user } = useAuth();
  const [deafened, setDeafened] = useState(false);
  const [ttsEnabled, setTtsEnabledState] = useState(() => localStorage.getItem("edushare-voice-tts") !== "off");

  // Keep the staff room lifecycle running anywhere in the signed-in app, not
  // only while somebody happens to have the Voice page open.
  useEffect(() => {
    if (!isStaffRole(role)) return;
    const sweep = () => void cleanupInactiveStaffMeeting().catch(() => {});
    sweep();
    const interval = setInterval(sweep, 15_000);
    return () => clearInterval(interval);
  }, [role]);
  const setTtsEnabled: Dispatch<SetStateAction<boolean>> = (value) => {
    setTtsEnabledState((current) => {
      const next = typeof value === "function" ? value(current) : value;
      localStorage.setItem("edushare-voice-tts", next ? "on" : "off");
      return next;
    });
  };

  // Lives here (not the Voice page) so joining/leaving a channel from
  // anywhere — e.g. Ranked Bedwars auto-joining a team's voice — still
  // plays the connect/disconnect cue, not just when /voice is open.
  const connectAudioRef = useRef<HTMLAudioElement | null>(null);
  const disconnectAudioRef = useRef<HTMLAudioElement | null>(null);
  const prevJoinedRef = useRef<string | null>(null);
  useEffect(() => {
    connectAudioRef.current = new Audio(connectSoundUrl);
    disconnectAudioRef.current = new Audio(disconnectSoundUrl);
    connectAudioRef.current.preload = "auto";
    disconnectAudioRef.current.preload = "auto";
  }, []);
  useEffect(() => {
    const ref = voice.joinedChannelId ? connectAudioRef : prevJoinedRef.current ? disconnectAudioRef : null;
    if (ref?.current) {
      try {
        ref.current.currentTime = 0;
      } catch {
        // element not loaded enough to seek yet — play() below still works
      }
      void ref.current.play().catch(() => {});
    }
    prevJoinedRef.current = voice.joinedChannelId;
  }, [voice.joinedChannelId]);

  // Same cues, but for OTHER people joining/leaving the room you're already in —
  // separate Audio elements from the self join/leave ones above so a chime for
  // someone else can't stomp on the sound already playing for your own action.
  const peerJoinAudioRef = useRef<HTMLAudioElement | null>(null);
  const peerLeaveAudioRef = useRef<HTMLAudioElement | null>(null);
  const prevParticipantIdsRef = useRef<Set<string> | null>(null);
  useEffect(() => {
    peerJoinAudioRef.current = new Audio(connectSoundUrl);
    peerLeaveAudioRef.current = new Audio(disconnectSoundUrl);
    peerJoinAudioRef.current.preload = "auto";
    peerLeaveAudioRef.current.preload = "auto";
  }, []);
  useEffect(() => {
    if (!voice.joinedChannelId) {
      prevParticipantIdsRef.current = null;
      return;
    }
    const currentIds = new Set(voice.participants.filter((p) => p.id !== user?.uid).map((p) => p.id));
    const prevIds = prevParticipantIdsRef.current;
    // Skip the very first snapshot right after joining — otherwise everyone
    // already in the room fires a "someone joined" chime for the joiner.
    if (prevIds) {
      const joined = [...currentIds].some((id) => !prevIds.has(id));
      const left = !joined && [...prevIds].some((id) => !currentIds.has(id));
      const ref = joined ? peerJoinAudioRef : left ? peerLeaveAudioRef : null;
      if (ref?.current) {
        try {
          ref.current.currentTime = 0;
        } catch {
          // element not loaded enough to seek yet — play() below still works
        }
        void ref.current.play().catch(() => {});
      }
    }
    prevParticipantIdsRef.current = currentIds;
  }, [voice.participants, voice.joinedChannelId, user?.uid]);

  return <VoiceCallContext.Provider value={{ ...voice, deafened, setDeafened, ttsEnabled, setTtsEnabled }}>{children}</VoiceCallContext.Provider>;
}

export function useVoiceCall() {
  const ctx = useContext(VoiceCallContext);
  if (!ctx) throw new Error("useVoiceCall must be used within VoiceCallProvider");
  return ctx;
}
