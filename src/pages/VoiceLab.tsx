import { useEffect, useRef, useState } from "react";
import { FlaskConical, Mic, Play, Square } from "lucide-react";
import { useAuth } from "../context/AuthContext";
import { subscribeToProfile } from "../lib/profiles";
import { loadPhaseVocoderWorklet, VOICE_EFFECT_BUILDERS, VOICE_EFFECT_OPTIONS, type VoiceEffectId } from "../lib/voiceEffects";
import type { UserProfile } from "../types";
import Button from "../components/Button";

// Renders the exact same effect chains the live voice call uses (shared from
// voiceEffects.ts), against a recording you make once, so you can A/B every
// preset on the identical take instead of re-speaking for each one and
// comparing across takes with different mic distance/room noise.
export default function VoiceLab() {
  const { user } = useAuth();
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [effect, setEffect] = useState<VoiceEffectId>("girl");
  const [recording, setRecording] = useState(false);
  const [recordedBuffer, setRecordedBuffer] = useState<AudioBuffer | null>(null);
  const [playing, setPlaying] = useState(false);
  const [error, setError] = useState("");

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const streamRef = useRef<MediaStream | null>(null);
  const decodeContextRef = useRef<AudioContext | null>(null);
  const playbackContextRef = useRef<AudioContext | null>(null);

  useEffect(() => {
    if (!user) return;
    return subscribeToProfile(user.uid, setProfile);
  }, [user]);

  useEffect(() => {
    return () => {
      streamRef.current?.getTracks().forEach((t) => t.stop());
      void decodeContextRef.current?.close().catch(() => {});
      void playbackContextRef.current?.close().catch(() => {});
    };
  }, []);

  async function startRecording() {
    setError("");
    setRecordedBuffer(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      chunksRef.current = [];
      const recorder = new MediaRecorder(stream);
      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };
      recorder.onstop = () => void handleRecordingStopped();
      mediaRecorderRef.current = recorder;
      recorder.start();
      setRecording(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not access your microphone.");
    }
  }

  function stopRecording() {
    mediaRecorderRef.current?.stop();
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    setRecording(false);
  }

  async function handleRecordingStopped() {
    try {
      const blob = new Blob(chunksRef.current, { type: mediaRecorderRef.current?.mimeType || "audio/webm" });
      const arrayBuffer = await blob.arrayBuffer();
      if (!decodeContextRef.current) decodeContextRef.current = new AudioContext();
      const buffer = await decodeContextRef.current.decodeAudioData(arrayBuffer);
      setRecordedBuffer(buffer);
    } catch {
      setError("Could not process that recording — try again.");
    }
  }

  async function play() {
    if (!recordedBuffer || playing) return;
    setError("");
    setPlaying(true);
    try {
      let outputBuffer = recordedBuffer;
      if (effect !== "none") {
        const offlineCtx = new OfflineAudioContext(
          recordedBuffer.numberOfChannels,
          recordedBuffer.length,
          recordedBuffer.sampleRate,
        );
        await loadPhaseVocoderWorklet(offlineCtx);
        const source = offlineCtx.createBufferSource();
        source.buffer = recordedBuffer;
        const chain = VOICE_EFFECT_BUILDERS[effect](offlineCtx, source);
        chain.output.connect(offlineCtx.destination);
        source.start();
        outputBuffer = await offlineCtx.startRendering();
      }

      if (!playbackContextRef.current) playbackContextRef.current = new AudioContext();
      const playbackCtx = playbackContextRef.current;
      if (playbackCtx.state === "suspended") await playbackCtx.resume();
      const playbackSource = playbackCtx.createBufferSource();
      playbackSource.buffer = outputBuffer;
      playbackSource.connect(playbackCtx.destination);
      playbackSource.onended = () => setPlaying(false);
      playbackSource.start();
    } catch {
      setError("Could not process/play that effect.");
      setPlaying(false);
    }
  }

  if (!profile?.voiceUnlocked) {
    return (
      <div className="mx-auto max-w-2xl px-6 py-24 text-center">
        <p className="text-sm text-white/30">Nothing here.</p>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-2xl px-6 py-14">
      <div className="flex items-center gap-2">
        <FlaskConical size={20} className="text-brand-400" />
        <h1 className="font-mono text-2xl font-bold text-white">Voice Lab</h1>
      </div>
      <p className="mt-1 text-sm text-white/45">
        Record a short line, then play it back through any preset — same take every time, so you can actually compare them.
      </p>

      <div className="mt-8 rounded-2xl border border-border bg-surface p-6">
        <div className="flex items-center gap-3">
          {!recording ? (
            <Button onClick={() => void startRecording()}>
              <Mic size={14} /> Record
            </Button>
          ) : (
            <Button variant="secondary" onClick={stopRecording}>
              <Square size={14} /> Stop
            </Button>
          )}
          <Button variant="secondary" disabled={!recordedBuffer || playing} onClick={() => void play()}>
            <Play size={14} /> {playing ? "Playing…" : "Play"}
          </Button>
          {recording && <span className="text-xs text-red-400">Recording…</span>}
          {!recording && recordedBuffer && <span className="text-xs text-white/40">{recordedBuffer.duration.toFixed(1)}s recorded</span>}
        </div>

        {error && <p className="mt-3 text-xs text-red-400">{error}</p>}

        <div className="mt-6 flex flex-wrap gap-1.5">
          {VOICE_EFFECT_OPTIONS.map((option) => (
            <button
              key={option.id}
              type="button"
              onClick={() => setEffect(option.id)}
              className={`cursor-target rounded-full px-3 py-1.5 text-xs font-semibold transition-colors ${
                effect === option.id ? "bg-brand-500 text-white" : "bg-surface-2 text-white/50 hover:text-white"
              }`}
            >
              {option.label}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
