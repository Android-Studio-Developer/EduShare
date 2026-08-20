import { useEffect, useRef, useState } from "react";

// Margin above each stream's self-calibrated noise floor before we call it "speaking".
const SPEAKING_MARGIN = 14;
// Consecutive frames needed above/below the threshold before flipping state — kills flicker.
const ON_FRAMES = 2;
const OFF_FRAMES = 18;

interface Tracker {
  analyser: AnalyserNode;
  floor: number;
  aboveStreak: number;
  belowStreak: number;
  speaking: boolean;
}

export function useSpeakingLevels(streams: Record<string, MediaStream>) {
  const [speaking, setSpeaking] = useState<Set<string>>(new Set());
  const audioCtxRef = useRef<AudioContext | null>(null);
  const trackersRef = useRef<Map<string, Tracker>>(new Map());
  const rafRef = useRef<number | null>(null);

  useEffect(() => {
    if (!audioCtxRef.current) audioCtxRef.current = new AudioContext();
    const ctx = audioCtxRef.current;
    const ids = Object.keys(streams);

    trackersRef.current.forEach((_t, uid) => {
      if (!ids.includes(uid)) trackersRef.current.delete(uid);
    });

    ids.forEach((uid) => {
      if (trackersRef.current.has(uid)) return;
      const stream = streams[uid];
      if (!stream || stream.getAudioTracks().length === 0) return;
      try {
        const source = ctx.createMediaStreamSource(stream);
        const analyser = ctx.createAnalyser();
        analyser.fftSize = 512;
        source.connect(analyser);
        trackersRef.current.set(uid, { analyser, floor: 20, aboveStreak: 0, belowStreak: 0, speaking: false });
      } catch {
        // stream not ready for analysis yet — skip this pass
      }
    });
  }, [streams]);

  useEffect(() => {
    const data = new Uint8Array(512);
    function tick() {
      let changed = false;
      trackersRef.current.forEach((t) => {
        t.analyser.getByteTimeDomainData(data);
        let sumSquares = 0;
        for (let i = 0; i < data.length; i++) {
          const dev = data[i] - 128;
          sumSquares += dev * dev;
        }
        const rms = Math.sqrt(sumSquares / data.length);

        // Track the quiet baseline: snap down fast on quieter samples, drift up slowly
        // so a sustained talker doesn't drag their own floor up mid-sentence.
        t.floor = rms < t.floor ? rms : t.floor + (rms - t.floor) * 0.005;

        const isAbove = rms > t.floor + SPEAKING_MARGIN;
        if (isAbove) {
          t.aboveStreak += 1;
          t.belowStreak = 0;
        } else {
          t.belowStreak += 1;
          t.aboveStreak = 0;
        }

        if (!t.speaking && t.aboveStreak >= ON_FRAMES) {
          t.speaking = true;
          changed = true;
        } else if (t.speaking && t.belowStreak >= OFF_FRAMES) {
          t.speaking = false;
          changed = true;
        }
      });

      if (changed) {
        const next = new Set<string>();
        trackersRef.current.forEach((t, uid) => {
          if (t.speaking) next.add(uid);
        });
        setSpeaking(next);
      }

      rafRef.current = requestAnimationFrame(tick);
    }
    rafRef.current = requestAnimationFrame(tick);
    return () => {
      if (rafRef.current != null) cancelAnimationFrame(rafRef.current);
    };
  }, []);

  useEffect(() => {
    return () => {
      audioCtxRef.current?.close().catch(() => {});
    };
  }, []);

  return speaking;
}
