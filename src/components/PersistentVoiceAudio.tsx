import { useEffect, useRef } from "react";
import { useVoiceCall } from "../context/VoiceCallContext";

function RemoteAudioTag({ stream, deafened }: { stream: MediaStream; deafened: boolean }) {
  const ref = useRef<HTMLAudioElement>(null);
  useEffect(() => {
    if (ref.current) ref.current.srcObject = stream;
  }, [stream]);
  useEffect(() => {
    if (ref.current) ref.current.muted = deafened;
  }, [deafened]);
  return <audio ref={ref} autoPlay playsInline />;
}

// Mounted once at the app root — keeps remote voice audio playing no matter
// which page you're on, instead of cutting out whenever Voice.tsx unmounts.
export default function PersistentVoiceAudio() {
  const { remoteStreams, deafened } = useVoiceCall();
  return (
    <>
      {Object.entries(remoteStreams).map(([uid, stream]) => (
        <RemoteAudioTag key={uid} stream={stream} deafened={deafened} />
      ))}
    </>
  );
}
