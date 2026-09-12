export type VoiceEffectId = "none" | "chipmunk" | "deep" | "robot" | "girl" | "softgirl";

export const VOICE_EFFECT_OPTIONS: { id: VoiceEffectId; label: string }[] = [
  { id: "none", label: "Normal" },
  { id: "girl", label: "Girl" },
  { id: "softgirl", label: "Soft Girl" },
  { id: "chipmunk", label: "Chipmunk" },
  { id: "deep", label: "Deep" },
  { id: "robot", label: "Robot" },
];

// Real-time pitch shifting via an AudioWorklet running a phase vocoder (FFT-based
// re-synthesis), not the granular PitchShift Tone.js used before — granular
// shifting has an inherent "warble" (that's what made "girl" sound like a
// minion) that a phase vocoder mostly avoids. Vendored from olvb/phaze
// (public domain) as a single self-contained bundle at public/phase-vocoder-processor.js
// — no npm package exists for it, it's meant to be used straight off the wire.
// Patched from the upstream version to add an independent formantFactor param
// (cepstral-liftering envelope shift) alongside the original pitchFactor.
const PHASE_VOCODER_URL = "/phase-vocoder-processor.js";
const PHASE_VOCODER_NAME = "phase-vocoder-processor";

export function semitonesToRatio(semitones: number) {
  return Math.pow(2, semitones / 12);
}

// BaseAudioContext covers both a live AudioContext and an OfflineAudioContext
// (used by the voice-lab's record-then-preview flow) — the worklet and every
// node type used here works identically on both.
export function loadPhaseVocoderWorklet(ctx: BaseAudioContext): Promise<void> {
  return ctx.audioWorklet.addModule(PHASE_VOCODER_URL);
}

// The phase-vocoder pitch stage moves pitch AND the spectral envelope together.
// targetFormantSemitones describes where the final formants should land, so the
// envelope stage must apply only the difference before pitch shifting. Applying
// the full target here used to stack both moves (3.2 + 2.2 = 5.4 semitones for
// Girl), which is why vowels sounded tiny/cartoonish instead of feminine.
function createPitchNode(ctx: BaseAudioContext, pitchSemitones: number, targetFormantSemitones?: number): AudioWorkletNode {
  const node = new AudioWorkletNode(ctx, PHASE_VOCODER_NAME);
  const pitchParam = node.parameters.get("pitchFactor");
  if (pitchParam) pitchParam.value = semitonesToRatio(pitchSemitones);
  const formantParam = node.parameters.get("formantFactor");
  if (formantParam && targetFormantSemitones !== undefined) {
    formantParam.value = semitonesToRatio(targetFormantSemitones - pitchSemitones);
  }
  return node;
}

export interface EffectChain {
  output: AudioNode;
  dispose: () => void;
}

// Each effect wires its own little node chain between a source node (a live
// mic source in a real call, or a recorded-buffer source in the voice lab)
// and whatever the caller connects the chain's output to. No Reverb anywhere
// — real-time voice can't afford convolution-reverb latency.
export const VOICE_EFFECT_BUILDERS: Record<Exclude<VoiceEffectId, "none">, (ctx: BaseAudioContext, source: AudioNode) => EffectChain> = {
  chipmunk: (ctx, source) => {
    const pitch = createPitchNode(ctx, 7);
    source.connect(pitch);
    return { output: pitch, dispose: () => pitch.disconnect() };
  },
  deep: (ctx, source) => {
    const pitch = createPitchNode(ctx, -7);
    source.connect(pitch);
    return { output: pitch, dispose: () => pitch.disconnect() };
  },
  robot: (ctx, source) => {
    const pitch = createPitchNode(ctx, -4);
    source.connect(pitch);
    return { output: pitch, dispose: () => pitch.disconnect() };
  },
  // A moderate pitch lift plus a smaller final formant lift keeps consonants
  // and vowels adult-sized. More extreme shifts become chipmunk-like quickly.
  girl: (ctx, source) => {
    const pitch = createPitchNode(ctx, 2.6, 1.7);
    const warmth = ctx.createBiquadFilter();
    warmth.type = "lowshelf";
    warmth.frequency.value = 260;
    warmth.gain.value = -2;
    const presence = ctx.createBiquadFilter();
    presence.type = "peaking";
    presence.frequency.value = 3200;
    presence.Q.value = 0.65;
    presence.gain.value = 1.2;
    source.connect(pitch);
    pitch.connect(warmth);
    warmth.connect(presence);
    return { output: presence, dispose: () => { pitch.disconnect(); warmth.disconnect(); presence.disconnect(); } };
  },
  // Soft, warm and breathy — a smaller pitch/formant shift plus gentle
  // filtering and compression. Avoid modulation/chorus here: that warble is
  // what made the old preset sound cartoonish on Chromebook microphones.
  softgirl: (ctx, source) => {
    const pitch = createPitchNode(ctx, 2.1, 1.3);
    const warmth = ctx.createBiquadFilter();
    warmth.type = "lowshelf";
    warmth.frequency.value = 240;
    warmth.gain.value = -1.5;
    const filter = ctx.createBiquadFilter();
    filter.type = "lowpass";
    filter.frequency.value = 7600;
    filter.Q.value = 0.35;
    const compressor = ctx.createDynamicsCompressor();
    compressor.threshold.value = -24;
    compressor.knee.value = 22;
    compressor.ratio.value = 2.2;
    compressor.attack.value = 0.01;
    compressor.release.value = 0.18;
    source.connect(pitch);
    pitch.connect(warmth);
    warmth.connect(filter);
    filter.connect(compressor);
    return {
      output: compressor,
      dispose: () => {
        pitch.disconnect();
        warmth.disconnect();
        filter.disconnect();
        compressor.disconnect();
      },
    };
  },
};
