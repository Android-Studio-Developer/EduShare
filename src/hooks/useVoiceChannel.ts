import { useCallback, useEffect, useRef, useState } from "react";
import {
  ICE_SERVERS,
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
import type { Rank, VoiceParticipant, VoiceSignal } from "../types";

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

export function useVoiceChannel() {
  const [joinedChannelId, setJoinedChannelId] = useState<string | null>(null);
  const [connecting, setConnecting] = useState(false);
  const [micError, setMicError] = useState("");
  const [participants, setParticipants] = useState<VoiceParticipant[]>([]);
  const [remoteStreams, setRemoteStreams] = useState<Record<string, MediaStream>>({});
  const [remoteScreenStreams, setRemoteScreenStreams] = useState<Record<string, MediaStream>>({});
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [localScreenStream, setLocalScreenStream] = useState<MediaStream | null>(null);
  const [muted, setMuted] = useState(false);

  const localStreamRef = useRef<MediaStream | null>(null);
  const screenStreamRef = useRef<MediaStream | null>(null);
  const peersRef = useRef<Map<string, RTCPeerConnection>>(new Map());
  const processedSignalsRef = useRef<Set<string>>(new Set());
  const uidRef = useRef<string>("");
  const channelIdRef = useRef<string | null>(null);
  const rawParticipantsRef = useRef<VoiceParticipant[]>([]);

  function getOrCreatePeer(otherUid: string): RTCPeerConnection {
    const existing = peersRef.current.get(otherUid);
    if (existing) return existing;

    const pc = new RTCPeerConnection({ iceServers: ICE_SERVERS });
    peersRef.current.set(otherUid, pc);

    localStreamRef.current?.getTracks().forEach((t) => pc.addTrack(t, localStreamRef.current!));
    if (screenStreamRef.current) {
      const track = screenStreamRef.current.getVideoTracks()[0];
      if (track) pc.addTrack(track, screenStreamRef.current);
    }

    pc.ontrack = (e) => {
      if (e.track.kind === "video") {
        setRemoteScreenStreams((prev) => ({ ...prev, [otherUid]: e.streams[0] }));
        e.track.onended = () => {
          setRemoteScreenStreams((prev) => {
            const next = { ...prev };
            delete next[otherUid];
            return next;
          });
        };
      } else {
        setRemoteStreams((prev) => ({ ...prev, [otherUid]: e.streams[0] }));
      }
    };
    pc.onicecandidate = (e) => {
      if (e.candidate && channelIdRef.current) {
        void sendSignal(channelIdRef.current, uidRef.current, otherUid, "candidate", JSON.stringify(e.candidate));
      }
    };
    pc.onconnectionstatechange = () => {
      if (pc.connectionState === "failed" || pc.connectionState === "closed") {
        peersRef.current.delete(otherUid);
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

    try {
      if (sig.type === "offer") {
        const pc = getOrCreatePeer(sig.fromUid);
        await pc.setRemoteDescription(new RTCSessionDescription(JSON.parse(sig.payload)));
        const answer = await pc.createAnswer();
        await pc.setLocalDescription(answer);
        await sendSignal(channelId, uidRef.current, sig.fromUid, "answer", JSON.stringify(answer));
      } else if (sig.type === "answer") {
        const pc = peersRef.current.get(sig.fromUid);
        if (pc && pc.signalingState !== "stable") {
          await pc.setRemoteDescription(new RTCSessionDescription(JSON.parse(sig.payload)));
        }
      } else if (sig.type === "candidate") {
        const pc = peersRef.current.get(sig.fromUid);
        if (pc) await pc.addIceCandidate(new RTCIceCandidate(JSON.parse(sig.payload))).catch(() => {});
      }
    } catch {
      // best-effort — a dropped signal just means that peer's audio may not connect
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
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      localStreamRef.current = stream;
      setLocalStream(stream);
      uidRef.current = args.uid;
      channelIdRef.current = channelId;
      processedSignalsRef.current = new Set();
      await joinChannel(channelId, args.uid, args.displayName, args.photoUrl, args.rank);
      setMuted(false);
      setJoinedChannelId(channelId);
    } catch (err) {
      setMicError(err instanceof Error ? err.message : "Could not access your microphone.");
    } finally {
      setConnecting(false);
    }
  }, []);

  const leave = useCallback(() => {
    peersRef.current.forEach((pc) => pc.close());
    peersRef.current.clear();
    localStreamRef.current?.getTracks().forEach((t) => t.stop());
    localStreamRef.current = null;
    setLocalStream(null);
    screenStreamRef.current?.getTracks().forEach((t) => t.stop());
    screenStreamRef.current = null;
    setLocalScreenStream(null);
    setRemoteStreams({});
    setRemoteScreenStreams({});
    setParticipants([]);
    if (channelIdRef.current && uidRef.current) void leaveChannel(channelIdRef.current, uidRef.current);
    channelIdRef.current = null;
    setJoinedChannelId(null);
  }, []);

  const startScreenShare = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getDisplayMedia({ video: true });
      const track = stream.getVideoTracks()[0];
      screenStreamRef.current = stream;
      setLocalScreenStream(stream);
      peersRef.current.forEach((pc) => pc.addTrack(track, stream));
      track.onended = () => stopScreenShareInternal();
      await renegotiateAll();
    } catch {
      // user cancelled the share picker — no-op
    }
  }, []);

  function stopScreenShareInternal() {
    const stream = screenStreamRef.current;
    if (!stream) return;
    const track = stream.getVideoTracks()[0];
    peersRef.current.forEach((pc) => {
      const sender = pc.getSenders().find((s) => s.track === track);
      if (sender) pc.removeTrack(sender);
    });
    stream.getTracks().forEach((t) => t.stop());
    screenStreamRef.current = null;
    setLocalScreenStream(null);
    void renegotiateAll();
  }

  const stopScreenShare = useCallback(() => {
    stopScreenShareInternal();
  }, []);

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

  useEffect(() => {
    return () => {
      peersRef.current.forEach((pc) => pc.close());
      localStreamRef.current?.getTracks().forEach((t) => t.stop());
      screenStreamRef.current?.getTracks().forEach((t) => t.stop());
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
    muted,
    join,
    leave,
    toggleMute,
    startScreenShare,
    stopScreenShare,
  };
}
