import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from "react";

const KEY = "edushare-music-playing";
const VOLUME_KEY = "edushare-music-volume";
const DEFAULT_VOLUME = 0.35;

interface MusicContextValue {
  playing: boolean;
  toggle: () => void;
  volume: number;
  setVolume: (v: number) => void;
  currentTime: number;
  duration: number;
  seek: (time: number) => void;
}

const MusicContext = createContext<MusicContextValue | null>(null);

export function formatMusicTime(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds < 0) return "0:00";
  const totalSeconds = Math.floor(seconds);
  const h = Math.floor(totalSeconds / 3600);
  const m = Math.floor((totalSeconds % 3600) / 60);
  const s = totalSeconds % 60;
  const mm = h > 0 ? String(m).padStart(2, "0") : String(m);
  const ss = String(s).padStart(2, "0");
  return h > 0 ? `${h}:${mm}:${ss}` : `${mm}:${ss}`;
}

// Mounted once at the app root — the <audio> element here never unmounts on
// navigation, so playback (and the on/off state) is consistent everywhere,
// not reset per page.
export function MusicProvider({ children }: { children: ReactNode }) {
  const [playing, setPlaying] = useState(false);
  const [volume, setVolumeState] = useState(() => {
    const stored = Number(localStorage.getItem(VOLUME_KEY));
    return stored > 0 && stored <= 1 ? stored : DEFAULT_VOLUME;
  });
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    const audio = new Audio("/playlist.mp3");
    audio.loop = true;
    audio.volume = volume;
    audioRef.current = audio;

    function onTimeUpdate() {
      setCurrentTime(audio.currentTime);
    }
    function onLoadedMetadata() {
      setDuration(audio.duration || 0);
    }
    audio.addEventListener("timeupdate", onTimeUpdate);
    audio.addEventListener("loadedmetadata", onLoadedMetadata);

    // Browsers block autoplay with sound until a real user gesture, so this
    // never auto-resumes on load even if it was on last visit — toggle() is
    // the only thing that starts playback, and that only fires from a click.
    return () => {
      audio.removeEventListener("timeupdate", onTimeUpdate);
      audio.removeEventListener("loadedmetadata", onLoadedMetadata);
      audio.pause();
      audioRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function toggle() {
    setPlaying((prev) => {
      const next = !prev;
      if (next) void audioRef.current?.play().catch(() => {});
      else audioRef.current?.pause();
      localStorage.setItem(KEY, next ? "1" : "0");
      return next;
    });
  }

  function setVolume(v: number) {
    const clamped = Math.min(1, Math.max(0, v));
    setVolumeState(clamped);
    if (audioRef.current) audioRef.current.volume = clamped;
    localStorage.setItem(VOLUME_KEY, String(clamped));
  }

  function seek(time: number) {
    if (!audioRef.current) return;
    audioRef.current.currentTime = time;
    setCurrentTime(time);
  }

  return (
    <MusicContext.Provider value={{ playing, toggle, volume, setVolume, currentTime, duration, seek }}>
      {children}
    </MusicContext.Provider>
  );
}

export function useMusic() {
  const ctx = useContext(MusicContext);
  if (!ctx) throw new Error("useMusic must be used within MusicProvider");
  return ctx;
}
