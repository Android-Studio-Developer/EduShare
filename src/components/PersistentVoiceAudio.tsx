import { useEffect, useRef } from "react";
import { useVoiceCall } from "../context/VoiceCallContext";
import { playTtsMessage, stopTtsPlayback } from "../lib/tts";
import { subscribeToVoiceMessages } from "../lib/voice";

function RemoteAudioTag({ stream, deafened }: { stream: MediaStream; deafened: boolean }) {
  const ref = useRef<HTMLAudioElement>(null);
  useEffect(() => {
    const audio = ref.current;
    if (!audio) return;
    audio.srcObject = stream;
    audio.muted = deafened;
    audio.volume = 1;

    const play = () => {
      if (!deafened) void audio.play().catch(() => {});
    };
    play();
    audio.addEventListener("loadedmetadata", play);
    audio.addEventListener("canplay", play);
    // If Chrome blocked the first asynchronous autoplay attempt, the next
    // normal click/key press unlocks the remote audio without a rejoin.
    document.addEventListener("pointerdown", play, { passive: true });
    document.addEventListener("keydown", play);
    return () => {
      audio.removeEventListener("loadedmetadata", play);
      audio.removeEventListener("canplay", play);
      document.removeEventListener("pointerdown", play);
      document.removeEventListener("keydown", play);
      audio.srcObject = null;
    };
  }, [deafened, stream]);
  return <audio ref={ref} autoPlay playsInline />;
}

// Mounted once at the app root — keeps remote voice audio playing no matter
// which page you're on, instead of cutting out whenever Voice.tsx unmounts.
export default function PersistentVoiceAudio() {
  const { remoteStreams, deafened, joinedChannelId, ttsEnabled } = useVoiceCall();
  const seenMessageIdsRef = useRef<Set<string> | null>(null);
  const ttsQueueRef = useRef<Promise<void>>(Promise.resolve());

  useEffect(() => {
    seenMessageIdsRef.current = null;
    if (!joinedChannelId) return;
    return subscribeToVoiceMessages(joinedChannelId, (messages) => {
      if (seenMessageIdsRef.current === null) {
        seenMessageIdsRef.current = new Set(messages.map((message) => message.id));
        return;
      }

      const fresh = messages.filter((message) => !seenMessageIdsRef.current!.has(message.id));
      messages.forEach((message) => seenMessageIdsRef.current!.add(message.id));
      fresh.forEach((message) => {
        if (deafened || !ttsEnabled) return;
        ttsQueueRef.current = ttsQueueRef.current
          .catch(() => {})
          .then(() => playTtsMessage(`${message.authorName} says ${message.text}`))
          .catch((error) => console.warn("Could not play voice-channel TTS.", error));
      });
    });
  }, [deafened, joinedChannelId, ttsEnabled]);

  useEffect(() => () => stopTtsPlayback(), []);
  useEffect(() => {
    if (!joinedChannelId || deafened || !ttsEnabled) stopTtsPlayback();
  }, [deafened, joinedChannelId, ttsEnabled]);

  return (
    <>
      {Object.entries(remoteStreams).map(([uid, stream]) => (
        <RemoteAudioTag key={uid} stream={stream} deafened={deafened} />
      ))}
    </>
  );
}
