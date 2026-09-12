import { useEffect, useRef } from "react";
import { Mic, MicOff, Monitor, MonitorOff, Video, VideoOff, Volume2, VolumeX } from "lucide-react";
import { useVoiceCall } from "../context/VoiceCallContext";

function CameraPreview({ stream }: { stream: MediaStream }) {
  const ref = useRef<HTMLVideoElement | null>(null);
  useEffect(() => {
    if (ref.current) ref.current.srcObject = stream;
  }, [stream]);
  return <video ref={ref} autoPlay muted playsInline className="h-14 w-20 rounded-lg border border-border object-cover" />;
}

// A compact always-visible strip of the same controls the full Voice Chat
// page offers, so players don't have to tab away mid-queue or mid-match.
export default function VoiceControlBar() {
  const {
    joinedChannelId,
    muted,
    toggleMute,
    localScreenStream,
    startScreenShare,
    stopScreenShare,
    localCameraStream,
    toggleCamera,
    deafened,
    setDeafened,
  } = useVoiceCall();

  if (!joinedChannelId || !joinedChannelId.startsWith("bw-")) return null;

  return (
    <div className="mt-3 flex items-center gap-2 rounded-xl border border-border bg-surface-2 px-3 py-2">
      <button
        type="button"
        onClick={toggleMute}
        className={`cursor-target flex h-8 w-8 items-center justify-center rounded-lg ${muted ? "bg-red-500/15 text-red-400" : "text-white/60 hover:bg-white/10 hover:text-white"}`}
        aria-label={muted ? "Unmute" : "Mute"}
      >
        {muted ? <MicOff size={15} /> : <Mic size={15} />}
      </button>
      <button
        type="button"
        onClick={() => (localScreenStream ? stopScreenShare() : startScreenShare())}
        className={`cursor-target flex h-8 w-8 items-center justify-center rounded-lg ${localScreenStream ? "bg-brand-500/15 text-brand-300" : "text-white/60 hover:bg-white/10 hover:text-white"}`}
        aria-label={localScreenStream ? "Stop screen share" : "Share screen"}
      >
        {localScreenStream ? <MonitorOff size={15} /> : <Monitor size={15} />}
      </button>
      <button
        type="button"
        onClick={toggleCamera}
        className={`cursor-target flex h-8 w-8 items-center justify-center rounded-lg ${localCameraStream ? "bg-brand-500/15 text-brand-300" : "text-white/60 hover:bg-white/10 hover:text-white"}`}
        aria-label={localCameraStream ? "Turn camera off" : "Turn camera on"}
      >
        {localCameraStream ? <Video size={15} /> : <VideoOff size={15} />}
      </button>
      <button
        type="button"
        onClick={() => setDeafened((d) => !d)}
        className={`cursor-target flex h-8 w-8 items-center justify-center rounded-lg ${deafened ? "bg-red-500/15 text-red-400" : "text-white/60 hover:bg-white/10 hover:text-white"}`}
        aria-label={deafened ? "Undeafen" : "Deafen"}
      >
        {deafened ? <VolumeX size={15} /> : <Volume2 size={15} />}
      </button>
      <span className="text-xs text-white/40">In voice</span>
      {localCameraStream && <CameraPreview stream={localCameraStream} />}
    </div>
  );
}
