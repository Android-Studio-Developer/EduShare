import { useCallback, useEffect, useRef, useState } from "react";
import {
  deleteSignal,
  fetchIceServers,
  joinChannel,
  leaveChannel,
  removeStaleParticipant,
  sendSignal,
  setParticipantMuted,
  STALE_MS,
  subscribeToIncomingSignals,
  subscribeToParticipants,
  touchParticipant,
} from "../lib/voice";
import { loadPhaseVocoderWorklet, VOICE_EFFECT_BUILDERS, type VoiceEffectId } from "../lib/voiceEffects";
import type { Rank, VoiceParticipant, VoiceSignal } from "../types";

export type { VoiceEffectId } from "../lib/voiceEffects";

interface JoinArgs {
  uid: string;
  displayName: string;
  photoUrl: string;
  rank: Rank;
}

// Heartbeat fires well inside STALE_MS so normal ticks never flap.
const HEARTBEAT_MS = 15_000;
// Rules only allow another live participant to delete a doc once it's been
// silent this long — keeps a brief refresh/reconnect from getting GC'd by a peer.
const SWEEP_MS = 60_000;

function isMissingDeviceError(error: unknown) {
  return error instanceof DOMException
    && (error.name === "NotFoundError" || error.name === "OverconstrainedError");
}

function microphoneErrorMessage(error: unknown) {
  if (!(error instanceof DOMException)) return error instanceof Error ? error.message : "Could not access your microphone.";
  if (error.name === "NotAllowedError" || error.name === "SecurityError") {
    return "Microphone access is blocked. Allow microphone permission in your browser's site settings, then join again.";
  }
  if (error.name === "NotReadableError" || error.name === "AbortError") {
    return "Your microphone is busy or unavailable. Close other apps using it, then join again.";
  }
  return error.message || "Could not access your microphone.";
}

async function acquireMicrophone() {
  try {
    return { stream: await navigator.mediaDevices.getUserMedia({ audio: true }), listenOnly: false };
  } catch (defaultError) {
    if (!isMissingDeviceError(defaultError)) throw defaultError;

    // Chrome can retain a disconnected Bluetooth/headset mic as its default.
    // Retry every microphone that is actually present before falling back to
    // listen-only mode, so a stale browser device choice cannot block joining.
    const devices = await navigator.mediaDevices.enumerateDevices().catch(() => [] as MediaDeviceInfo[]);
    const microphones = devices.filter((device) => device.kind === "audioinput" && device.deviceId && device.deviceId !== "default" && device.deviceId !== "communications");
    for (const microphone of microphones) {
      try {
        return {
          stream: await navigator.mediaDevices.getUserMedia({ audio: { deviceId: { exact: microphone.deviceId } } }),
          listenOnly: false,
        };
      } catch (error) {
        if (!isMissingDeviceError(error)) throw error;
      }
    }

    return { stream: new MediaStream(), listenOnly: true };
  }
}

export function useVoiceChannel() {
  const [joinedChannelId, setJoinedChannelId] = useState<string | null>(null);
  const [connecting, setConnecting] = useState(false);
  const [micError, setMicError] = useState("");
  const [participants, setParticipants] = useState<VoiceParticipant[]>([]);
  const [remoteStreams, setRemoteStreams] = useState<Record<string, MediaStream>>({});
  const [remoteScreenStreams, setRemoteScreenStreams] = useState<Record<string, MediaStream>>({});
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [localScreenStream, setLocalScreenStream] = useState<MediaStream | null>(null);
  const [localCameraStream, setLocalCameraStream] = useState<MediaStream | null>(null);
  const [muted, setMuted] = useState(false);
  const [voiceEffect, setVoiceEffectState] = useState<VoiceEffectId>("none");

  const rawStreamRef = useRef<MediaStream | null>(null);
  const effectAudioContextRef = useRef<AudioContext | null>(null);
  const effectWorkletReadyRef = useRef<Promise<void> | null>(null);
  const effectSourceRef = useRef<MediaStreamAudioSourceNode | null>(null);
  const effectSourceStreamRef = useRef<MediaStream | null>(null);
  const effectDestinationRef = useRef<MediaStreamAudioDestinationNode | null>(null);
  const effectChainRef = useRef<{ dispose: () => void } | null>(null);
  const localStreamRef = useRef<MediaStream | null>(null);
  const screenStreamRef = useRef<MediaStream | null>(null);
  const cameraStreamRef = useRef<MediaStream | null>(null);
  const remoteAudioStreamsRef = useRef<Map<string, MediaStream>>(new Map());
  const peersRef = useRef<Map<string, RTCPeerConnection>>(new Map());
  const pendingCandidatesRef = useRef<Map<string, RTCIceCandidateInit[]>>(new Map());
  const disconnectTimersRef = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());
  const iceServersRef = useRef<RTCIceServer[]>([]);
  const processedSignalsRef = useRef<Set<string>>(new Set());
  const joinedAtRef = useRef(0);
  const uidRef = useRef<string>("");
  const channelIdRef = useRef<string | null>(null);
  const rawParticipantsRef = useRef<VoiceParticipant[]>([]);

  function getOrCreatePeer(otherUid: string): RTCPeerConnection {
    const existing = peersRef.current.get(otherUid);
    if (existing) return existing;

    const pc = new RTCPeerConnection({ iceServers: iceServersRef.current });
    peersRef.current.set(otherUid, pc);

    localStreamRef.current?.getTracks().forEach((t) => pc.addTrack(t, localStreamRef.current!));
    if (screenStreamRef.current) {
      screenStreamRef.current.getTracks().forEach((track) => pc.addTrack(track, screenStreamRef.current!));
    }
    if (cameraStreamRef.current) {
      const track = cameraStreamRef.current.getVideoTracks()[0];
      if (track) pc.addTrack(track, cameraStreamRef.current);
    }

    pc.ontrack = (e) => {
      const incomingStream = e.streams[0] ?? new MediaStream([e.track]);
      if (e.track.kind === "video") {
        setRemoteScreenStreams((prev) => ({ ...prev, [otherUid]: incomingStream }));
        e.track.onended = () => {
          setRemoteScreenStreams((prev) => {
            const next = { ...prev };
            delete next[otherUid];
            return next;
          });
        };
      } else {
        // A peer can send microphone audio and screen-share audio at the same
        // time. Keep both tracks in one playback stream instead of allowing the
        // later screen track to replace the microphone stream.
        const audioStream = remoteAudioStreamsRef.current.get(otherUid) ?? new MediaStream();
        remoteAudioStreamsRef.current.set(otherUid, audioStream);
        if (!audioStream.getTracks().some((track) => track.id === e.track.id)) audioStream.addTrack(e.track);
        setRemoteStreams((prev) => ({ ...prev, [otherUid]: audioStream }));
        e.track.onended = () => {
          audioStream.removeTrack(e.track);
          if (audioStream.getAudioTracks().length === 0) {
            remoteAudioStreamsRef.current.delete(otherUid);
            setRemoteStreams((prev) => {
              const next = { ...prev };
              delete next[otherUid];
              return next;
            });
          }
        };
      }
    };
    pc.onicecandidate = (e) => {
      if (e.candidate && channelIdRef.current) {
        void sendSignal(channelIdRef.current, uidRef.current, otherUid, "candidate", JSON.stringify(e.candidate));
      }
    };
    function clearDisconnectTimer() {
      const timer = disconnectTimersRef.current.get(otherUid);
      if (timer) {
        clearTimeout(timer);
        disconnectTimersRef.current.delete(otherUid);
      }
    }

    // Flaky TURN relay under load (the free relay's allocations can silently
    // die well before the browser ever reports "failed") — try to heal the path.
    function recoverPeer() {
      clearDisconnectTimer();
      pc.restartIce();
      if (uidRef.current < otherUid) {
        void (async () => {
          try {
            const offer = await pc.createOffer({ iceRestart: true });
            await pc.setLocalDescription(offer);
            if (channelIdRef.current) {
              await sendSignal(channelIdRef.current, uidRef.current, otherUid, "offer", JSON.stringify(offer));
            }
          } catch {
            // best-effort — connectionstatechange will fire again if this doesn't help
          }
        })();
      }
    }

    pc.onconnectionstatechange = () => {
      if (pc.connectionState === "failed") {
        recoverPeer();
        return;
      }
      if (pc.connectionState === "disconnected") {
        // "disconnected" can also just be a brief packet blip, but it can also
        // sit forever without ever escalating to "failed" while audio has
        // already gone silent — so force a restart if it hasn't self-healed
        // within a few seconds instead of waiting on "failed" that may never come.
        if (!disconnectTimersRef.current.has(otherUid)) {
          disconnectTimersRef.current.set(
            otherUid,
            setTimeout(() => {
              disconnectTimersRef.current.delete(otherUid);
              if (peersRef.current.get(otherUid) === pc && pc.connectionState === "disconnected") recoverPeer();
            }, 3000),
          );
        }
        return;
      }
      if (pc.connectionState === "connected") {
        clearDisconnectTimer();
        return;
      }
      if (pc.connectionState === "closed") {
        clearDisconnectTimer();
        peersRef.current.delete(otherUid);
        remoteAudioStreamsRef.current.delete(otherUid);
        setRemoteStreams((prev) => {
          const next = { ...prev };
          delete next[otherUid];
          return next;
        });
        setRemoteScreenStreams((prev) => {
          const next = { ...prev };
          delete next[otherUid];
          return next;
        });
      }
    };
    return pc;
  }

  function closePeer(otherUid: string) {
    const pc = peersRef.current.get(otherUid);
    if (pc) pc.close();
    peersRef.current.delete(otherUid);
    pendingCandidatesRef.current.delete(otherUid);
    remoteAudioStreamsRef.current.delete(otherUid);
    const timer = disconnectTimersRef.current.get(otherUid);
    if (timer) {
      clearTimeout(timer);
      disconnectTimersRef.current.delete(otherUid);
    }
    setRemoteStreams((prev) => {
      const next = { ...prev };
      delete next[otherUid];
      return next;
    });
    setRemoteScreenStreams((prev) => {
      const next = { ...prev };
      delete next[otherUid];
      return next;
    });
  }

  async function flushPendingCandidates(otherUid: string, pc: RTCPeerConnection) {
    const pending = pendingCandidatesRef.current.get(otherUid) ?? [];
    pendingCandidatesRef.current.delete(otherUid);
    for (const candidate of pending) {
      await pc.addIceCandidate(new RTCIceCandidate(candidate)).catch(() => {});
    }
  }

  async function renegotiateAll() {
    const uid = uidRef.current;
    const channelId = channelIdRef.current;
    if (!channelId) return;
    for (const [otherUid, pc] of peersRef.current) {
      try {
        const offer = await pc.createOffer();
        await pc.setLocalDescription(offer);
        await sendSignal(channelId, uid, otherUid, "offer", JSON.stringify(offer));
      } catch {
        // best-effort — that peer just won't see the updated tracks
      }
    }
  }

  const handleSignal = useCallback(async (sig: VoiceSignal) => {
    if (processedSignalsRef.current.has(sig.id)) return;
    processedSignalsRef.current.add(sig.id);
    const channelId = channelIdRef.current;
    if (!channelId) return;

    // Firestore retains signaling documents until the recipient consumes them.
    // Never replay offers/candidates left over from an earlier call session.
    if (sig.createdAt < joinedAtRef.current) {
      void deleteSignal(channelId, sig.id).catch(() => {});
      return;
    }

    try {
      if (sig.type === "offer") {
        const pc = getOrCreatePeer(sig.fromUid);
        await pc.setRemoteDescription(new RTCSessionDescription(JSON.parse(sig.payload)));
        await flushPendingCandidates(sig.fromUid, pc);
        const answer = await pc.createAnswer();
        await pc.setLocalDescription(answer);
        await sendSignal(channelId, uidRef.current, sig.fromUid, "answer", JSON.stringify(answer));
      } else if (sig.type === "answer") {
        const pc = peersRef.current.get(sig.fromUid);
        if (pc && pc.signalingState !== "stable") {
          await pc.setRemoteDescription(new RTCSessionDescription(JSON.parse(sig.payload)));
          await flushPendingCandidates(sig.fromUid, pc);
        }
      } else if (sig.type === "candidate") {
        const pc = peersRef.current.get(sig.fromUid);
        const candidate = JSON.parse(sig.payload) as RTCIceCandidateInit;
        if (pc?.remoteDescription) {
          await pc.addIceCandidate(new RTCIceCandidate(candidate)).catch(() => {});
        } else {
          const pending = pendingCandidatesRef.current.get(sig.fromUid) ?? [];
          pending.push(candidate);
          pendingCandidatesRef.current.set(sig.fromUid, pending);
        }
      }
    } catch {
      // best-effort — a dropped signal just means that peer's audio may not connect
    } finally {
      // Consumed signals must not poison a later leave/rejoin cycle.
      void deleteSignal(channelId, sig.id).catch(() => {});
    }
  }, []);

  useEffect(() => {
    if (!joinedChannelId) return;
    const channelId = joinedChannelId;

    // onSnapshot only refires on a remote write — it does NOT refire just because
    // time passed. So re-apply the freshness filter on an interval too, otherwise
    // a participant that goes silent (crash/closed tab) stays visible forever until
    // some unrelated write happens to touch the collection.
    function applyFreshness() {
      const now = Date.now();
      const list = rawParticipantsRef.current;
      const fresh = list.filter((p) => p.id === uidRef.current || now - p.lastSeenAt < STALE_MS);
      setParticipants(fresh);

      // Garbage-collect long-dead docs (closed tab, crash) so they don't pile up.
      list
        .filter((p) => p.id !== uidRef.current && now - p.lastSeenAt >= SWEEP_MS)
        .forEach((p) => void removeStaleParticipant(channelId, p.id).catch(() => {}));
    }

    const unsubParticipants = subscribeToParticipants(joinedChannelId, (list) => {
      rawParticipantsRef.current = list;
      applyFreshness();
    });
    const unsubSignals = subscribeToIncomingSignals(joinedChannelId, uidRef.current, (signals) => {
      signals.forEach((s) => void handleSignal(s));
    });
    const freshnessInterval = setInterval(applyFreshness, 5_000);
    return () => {
      unsubParticipants();
      unsubSignals();
      clearInterval(freshnessInterval);
    };
  }, [joinedChannelId, handleSignal]);

  useEffect(() => {
    if (!joinedChannelId) return;
    const uid = uidRef.current;
    const interval = setInterval(() => void touchParticipant(joinedChannelId, uid).catch(() => {}), HEARTBEAT_MS);
    return () => clearInterval(interval);
  }, [joinedChannelId]);

  useEffect(() => {
    if (!joinedChannelId) return;
    const myUid = uidRef.current;
    const otherIds = new Set(participants.filter((p) => p.id !== myUid).map((p) => p.id));

    otherIds.forEach((otherUid) => {
      if (peersRef.current.has(otherUid)) return;
      const iAmInitiator = myUid < otherUid;
      const pc = getOrCreatePeer(otherUid);
      if (iAmInitiator) {
        void (async () => {
          const offer = await pc.createOffer();
          await pc.setLocalDescription(offer);
          await sendSignal(joinedChannelId, myUid, otherUid, "offer", JSON.stringify(offer));
        })();
      }
    });

    peersRef.current.forEach((_pc, otherUid) => {
      if (!otherIds.has(otherUid)) closePeer(otherUid);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [participants, joinedChannelId]);

  const join = useCallback(async (channelId: string, args: JoinArgs) => {
    setMicError("");
    setConnecting(true);
    try {
      const [{ stream, listenOnly }, iceServers] = await Promise.all([acquireMicrophone(), fetchIceServers()]);
      iceServersRef.current = iceServers;
      rawStreamRef.current = stream;
      localStreamRef.current = stream;
      setLocalStream(stream);
      setVoiceEffectState("none");
      uidRef.current = args.uid;
      channelIdRef.current = channelId;
      joinedAtRef.current = Date.now();
      processedSignalsRef.current = new Set();
      pendingCandidatesRef.current.clear();
      await joinChannel(channelId, args.uid, args.displayName, args.photoUrl, args.rank);
      if (listenOnly) await setParticipantMuted(channelId, args.uid, true);
      setMuted(listenOnly);
      setJoinedChannelId(channelId);
      if (listenOnly) setMicError("No microphone was found. You joined in listen-only mode; connect a microphone and rejoin to speak.");
    } catch (err) {
      setMicError(microphoneErrorMessage(err));
    } finally {
      setConnecting(false);
    }
  }, []);

  const leave = useCallback(() => {
    peersRef.current.forEach((pc) => pc.close());
    peersRef.current.clear();
    pendingCandidatesRef.current.clear();
    remoteAudioStreamsRef.current.clear();
    disconnectTimersRef.current.forEach((timer) => clearTimeout(timer));
    disconnectTimersRef.current.clear();
    teardownEffectAudio();
    rawStreamRef.current?.getTracks().forEach((t) => t.stop());
    rawStreamRef.current = null;
    localStreamRef.current?.getTracks().forEach((t) => t.stop());
    localStreamRef.current = null;
    setLocalStream(null);
    setVoiceEffectState("none");
    screenStreamRef.current?.getTracks().forEach((t) => t.stop());
    screenStreamRef.current = null;
    setLocalScreenStream(null);
    cameraStreamRef.current?.getTracks().forEach((t) => t.stop());
    cameraStreamRef.current = null;
    setLocalCameraStream(null);
    setRemoteStreams({});
    setRemoteScreenStreams({});
    setParticipants([]);
    if (channelIdRef.current && uidRef.current) void leaveChannel(channelIdRef.current, uidRef.current);
    channelIdRef.current = null;
    setJoinedChannelId(null);
  }, []);

  const startScreenShare = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getDisplayMedia({ video: true, audio: true });
      const videoTrack = stream.getVideoTracks()[0];
      if (!videoTrack) {
        stream.getTracks().forEach((track) => track.stop());
        return;
      }
      stopCameraInternal(); // only one outgoing video track at a time
      screenStreamRef.current = stream;
      setLocalScreenStream(stream);
      peersRef.current.forEach((pc) => stream.getTracks().forEach((track) => pc.addTrack(track, stream)));
      videoTrack.onended = () => stopScreenShareInternal();
      await renegotiateAll();
    } catch {
      // user cancelled the share picker — no-op
    }
  }, []);

  function stopScreenShareInternal() {
    const stream = screenStreamRef.current;
    if (!stream) return;
    const tracks = new Set(stream.getTracks());
    peersRef.current.forEach((pc) => {
      pc.getSenders().forEach((sender) => {
        if (sender.track && tracks.has(sender.track)) pc.removeTrack(sender);
      });
    });
    stream.getTracks().forEach((t) => t.stop());
    screenStreamRef.current = null;
    setLocalScreenStream(null);
    void renegotiateAll();
  }

  const stopScreenShare = useCallback(() => {
    stopScreenShareInternal();
  }, []);

  // Camera shares the same outgoing video slot as screen share — this app's
  // signaling doesn't distinguish "screen" vs "camera" video on the wire, so
  // only one can be active at a time (starting one stops the other).
  const startCamera = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true });
      const track = stream.getVideoTracks()[0];
      stopScreenShareInternal();
      cameraStreamRef.current = stream;
      setLocalCameraStream(stream);
      peersRef.current.forEach((pc) => pc.addTrack(track, stream));
      track.onended = () => stopCameraInternal();
      await renegotiateAll();
    } catch {
      // permission denied or no camera — no-op
    }
  }, []);

  function stopCameraInternal() {
    const stream = cameraStreamRef.current;
    if (!stream) return;
    const track = stream.getVideoTracks()[0];
    peersRef.current.forEach((pc) => {
      const sender = pc.getSenders().find((s) => s.track === track);
      if (sender) pc.removeTrack(sender);
    });
    stream.getTracks().forEach((t) => t.stop());
    cameraStreamRef.current = null;
    setLocalCameraStream(null);
    void renegotiateAll();
  }

  const stopCamera = useCallback(() => {
    stopCameraInternal();
  }, []);

  const toggleCamera = useCallback(() => {
    if (cameraStreamRef.current) stopCameraInternal();
    else void startCamera();
  }, [startCamera]);

  const toggleMute = useCallback(() => {
    setMuted((prev) => {
      const next = !prev;
      localStreamRef.current?.getAudioTracks().forEach((t) => {
        t.enabled = !next;
      });
      if (channelIdRef.current && uidRef.current) void setParticipantMuted(channelIdRef.current, uidRef.current, next);
      return next;
    });
  }, []);

  function disposeVoiceEffectChain() {
    effectChainRef.current?.dispose();
    effectChainRef.current = null;
  }

  // Full teardown, including the shared AudioContext/mic-source/destination —
  // used on leave()/unmount, since the raw mic stream those are built from is
  // itself being torn down at the same time and would need rebuilding anyway.
  function teardownEffectAudio() {
    disposeVoiceEffectChain();
    effectSourceRef.current?.disconnect();
    effectSourceRef.current = null;
    effectSourceStreamRef.current = null;
    effectDestinationRef.current = null;
    if (effectAudioContextRef.current) {
      void effectAudioContextRef.current.close().catch(() => {});
      effectAudioContextRef.current = null;
    }
    effectWorkletReadyRef.current = null;
  }

  async function getEffectAudioContext(): Promise<AudioContext> {
    if (!effectAudioContextRef.current) effectAudioContextRef.current = new AudioContext();
    const ctx = effectAudioContextRef.current;
    if (!effectWorkletReadyRef.current) effectWorkletReadyRef.current = loadPhaseVocoderWorklet(ctx);
    await effectWorkletReadyRef.current;
    return ctx;
  }

  // Swaps the outgoing audio track live — an AudioWorklet phase-vocoder chain
  // fed by a MediaStreamSource pulled off the SAME raw mic stream (no second
  // getUserMedia capture needed) — via RTCRtpSender.replaceTrack, so no
  // renegotiation/SDP round-trip is needed for an effect change mid-call.
  const setVoiceEffect = useCallback(async (effect: VoiceEffectId) => {
    const rawTrack = rawStreamRef.current?.getAudioTracks()[0];
    if (!rawTrack) {
      setVoiceEffectState(effect);
      return;
    }

    disposeVoiceEffectChain();

    let outgoingTrack: MediaStreamTrack;
    if (effect === "none") {
      outgoingTrack = rawTrack;
    } else {
      try {
        const ctx = await getEffectAudioContext();
        if (ctx.state === "suspended") await ctx.resume();
        if (effectSourceStreamRef.current !== rawStreamRef.current) {
          effectSourceRef.current?.disconnect();
          effectSourceRef.current = ctx.createMediaStreamSource(rawStreamRef.current!);
          effectSourceStreamRef.current = rawStreamRef.current;
        }
        if (!effectDestinationRef.current) effectDestinationRef.current = ctx.createMediaStreamDestination();
        const destination = effectDestinationRef.current;
        const chain = VOICE_EFFECT_BUILDERS[effect](ctx, effectSourceRef.current!);
        chain.output.connect(destination);
        effectChainRef.current = {
          dispose: () => {
            chain.output.disconnect(destination);
            chain.dispose();
          },
        };
        outgoingTrack = destination.stream.getAudioTracks()[0];
      } catch {
        // Couldn't stand up the AudioWorklet chain — stay on the raw track.
        outgoingTrack = rawTrack;
        effect = "none";
      }
    }

    outgoingTrack.enabled = !muted;
    const newStream = new MediaStream([outgoingTrack]);
    localStreamRef.current = newStream;
    setLocalStream(newStream);

    peersRef.current.forEach((pc) => {
      const sender = pc.getSenders().find((s) => s.track?.kind === "audio");
      if (sender) void sender.replaceTrack(outgoingTrack);
      else pc.addTrack(outgoingTrack, newStream);
    });

    setVoiceEffectState(effect);
  }, [muted]);

  useEffect(() => {
    return () => {
      peersRef.current.forEach((pc) => pc.close());
      teardownEffectAudio();
      rawStreamRef.current?.getTracks().forEach((t) => t.stop());
      localStreamRef.current?.getTracks().forEach((t) => t.stop());
      screenStreamRef.current?.getTracks().forEach((t) => t.stop());
      cameraStreamRef.current?.getTracks().forEach((t) => t.stop());
      if (channelIdRef.current && uidRef.current) void leaveChannel(channelIdRef.current, uidRef.current);
    };
  }, []);

  return {
    joinedChannelId,
    connecting,
    micError,
    participants,
    remoteStreams,
    remoteScreenStreams,
    localStream,
    localScreenStream,
    localCameraStream,
    muted,
    voiceEffect,
    setVoiceEffect,
    join,
    leave,
    toggleMute,
    startScreenShare,
    stopScreenShare,
    startCamera,
    stopCamera,
    toggleCamera,
  };
}
