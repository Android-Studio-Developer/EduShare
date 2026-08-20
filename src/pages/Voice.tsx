import { useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import { Mic, MicOff, Monitor, MonitorOff, Phone, PhoneOff, Plus, Trash2, Volume2, VolumeX } from "lucide-react";
import { useAuth } from "../context/AuthContext";
import { useVoiceCall } from "../context/VoiceCallContext";
import { useSpeakingLevels } from "../hooks/useSpeakingLevels";
import { createVoiceChannel, deleteVoiceChannel, ensureGeneralChannel, STALE_MS, subscribeToParticipants, subscribeToVoiceChannels } from "../lib/voice";
import { subscribeToProfile } from "../lib/profiles";
import { rankNameClass, rankTier } from "../lib/ranks";
import type { Rank, UserProfile, VoiceChannelDoc, VoiceParticipant } from "../types";
import Button from "../components/Button";
import ProfileCard from "../components/ProfileCard";
import LineSidebarRaw from "../components/LineSidebar";
import DockRaw from "../components/Dock";
import connectSoundUrl from "./connect.mp3";
import disconnectSoundUrl from "./disconnect.mp3";
import muteSoundUrl from "./discordmute.mp3";
import streamSoundUrl from "./stream.mp3";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const LineSidebar = LineSidebarRaw as any;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const Dock = DockRaw as any;

function ScreenShareTile({ label, stream, muted }: { label: string; stream: MediaStream; muted: boolean }) {
  const ref = useRef<HTMLVideoElement>(null);
  useEffect(() => {
    if (ref.current) ref.current.srcObject = stream;
  }, [stream]);
  return (
    <div className="overflow-hidden rounded-2xl border border-border bg-black">
      <video ref={ref} autoPlay playsInline muted={muted} className="max-h-[26rem] w-full object-contain" />
      <p className="border-t border-border bg-surface-2 px-3 py-1.5 text-xs font-medium text-white/60">{label}</p>
    </div>
  );
}

function ParticipantTile({
  photoUrl,
  displayName,
  rank,
  muted,
  speaking,
  onClick,
}: {
  photoUrl: string;
  displayName: string;
  rank: Rank;
  muted: boolean;
  speaking: boolean;
  onClick: () => void;
}) {
  return (
    <div
      onClick={onClick}
      className={`cursor-target flex aspect-square cursor-pointer flex-col items-center justify-center gap-2 rounded-2xl border-2 bg-surface-2 p-4 transition-colors duration-100 ${
        speaking ? "border-green-500" : "border-border"
      }`}
    >
      <div className="relative">
        {photoUrl ? (
          <img src={photoUrl} alt="" className="h-14 w-14 rounded-full object-cover" />
        ) : (
          <div className="flex h-14 w-14 items-center justify-center rounded-full bg-gradient-to-br from-cyan-400 to-fuchsia-500 font-mono text-lg font-bold text-white">
            {displayName.slice(0, 1).toUpperCase()}
          </div>
        )}
        {muted && (
          <span className="absolute -bottom-1 -right-1 flex h-5 w-5 items-center justify-center rounded-full bg-red-500 text-white">
            <MicOff size={11} />
          </span>
        )}
      </div>
      <span className={`max-w-full truncate text-xs font-medium ${rankNameClass(rank)}`}>{displayName}</span>
    </div>
  );
}

export default function Voice() {
  const { user, role } = useAuth();
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [channels, setChannels] = useState<VoiceChannelDoc[]>([]);
  const [selectedChannelId, setSelectedChannelId] = useState<string | null>(null);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [newName, setNewName] = useState("");
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState("");

  const {
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
    deafened,
    setDeafened,
  } = useVoiceCall();

  const connectAudioRef = useRef<HTMLAudioElement | null>(null);
  const disconnectAudioRef = useRef<HTMLAudioElement | null>(null);
  const muteAudioRef = useRef<HTMLAudioElement | null>(null);
  const streamAudioRef = useRef<HTMLAudioElement | null>(null);
  useEffect(() => {
    connectAudioRef.current = new Audio(connectSoundUrl);
    disconnectAudioRef.current = new Audio(disconnectSoundUrl);
    muteAudioRef.current = new Audio(muteSoundUrl);
    streamAudioRef.current = new Audio(streamSoundUrl);
    [connectAudioRef, disconnectAudioRef, muteAudioRef, streamAudioRef].forEach((r) => {
      if (r.current) {
        r.current.preload = "auto";
        r.current.volume = 1;
      }
    });
  }, []);

  function playSound(ref: React.RefObject<HTMLAudioElement | null>) {
    const el = ref.current;
    if (!el) return;
    try {
      el.currentTime = 0;
    } catch {
      // element not loaded enough to seek yet — play() below still works
    }
    void el.play().catch((err) => console.warn("Voice sound blocked:", err));
  }

  const prevJoinedRef = useRef<string | null>(null);
  useEffect(() => {
    if (joinedChannelId && !prevJoinedRef.current) {
      playSound(connectAudioRef);
    } else if (!joinedChannelId && prevJoinedRef.current) {
      playSound(disconnectAudioRef);
    }
    prevJoinedRef.current = joinedChannelId;
  }, [joinedChannelId]);

  const prevScreenCountRef = useRef(0);
  useEffect(() => {
    const count = (localScreenStream ? 1 : 0) + Object.keys(remoteScreenStreams).length;
    if (count > prevScreenCountRef.current) playSound(streamAudioRef);
    prevScreenCountRef.current = count;
  }, [localScreenStream, remoteScreenStreams]);

  const [channelsLoaded, setChannelsLoaded] = useState(false);
  const [openProfileId, setOpenProfileId] = useState<string | null>(null);
  useEffect(() => {
    void ensureGeneralChannel();
    return subscribeToVoiceChannels((cs) => {
      setChannels(cs);
      setChannelsLoaded(true);
      setSelectedChannelId((prev) => prev ?? cs[0]?.id ?? null);
    });
  }, []);

  useEffect(() => {
    if (!user) return;
    return subscribeToProfile(user.uid, setProfile);
  }, [user]);

  function handleToggleMute() {
    playSound(muteAudioRef);
    toggleMute();
  }

  const speakingStreams = useMemo(() => {
    const map: Record<string, MediaStream> = { ...remoteStreams };
    if (localStream && user) map[user.uid] = localStream;
    return map;
  }, [remoteStreams, localStream, user]);
  const speaking = useSpeakingLevels(speakingStreams);

  const canCreate = role === "owner" || role === "moderator" || rankTier(profile?.rank) >= rankTier("mvp_plus");
  const isStaff = role === "owner" || role === "moderator";
  const selectedChannel = channels.find((c) => c.id === selectedChannelId) ?? null;
  const isJoinedHere = joinedChannelId === selectedChannelId;
  const joinedChannel = channels.find((c) => c.id === joinedChannelId) ?? null;

  // Read-only view of who's in a channel you haven't joined — Firestore participant
  // docs exist independent of your own join state, so browsing a channel should show
  // its real occupants (Discord does this too), not just "0 connected" until you join.
  const [previewParticipants, setPreviewParticipants] = useState<VoiceParticipant[]>([]);
  useEffect(() => {
    if (!selectedChannelId || isJoinedHere) {
      setPreviewParticipants([]);
      return;
    }
    let raw: VoiceParticipant[] = [];
    function applyFreshness() {
      const now = Date.now();
      setPreviewParticipants(raw.filter((p) => now - p.lastSeenAt < STALE_MS));
    }
    const unsub = subscribeToParticipants(selectedChannelId, (list) => {
      raw = list;
      applyFreshness();
    });
    const interval = setInterval(applyFreshness, 5_000);
    return () => {
      unsub();
      clearInterval(interval);
    };
  }, [selectedChannelId, isJoinedHere]);

  const displayParticipants = isJoinedHere ? participants : previewParticipants;

  const sidebarItems = [...channels.map((c) => c.name), ...(canCreate ? ["+ New channel"] : [])];
  const activeIndex = selectedChannelId ? channels.findIndex((c) => c.id === selectedChannelId) : null;

  function handleSidebarClick(index: number) {
    if (canCreate && index === channels.length) {
      setShowCreateForm(true);
      return;
    }
    setSelectedChannelId(channels[index]?.id ?? null);
  }

  async function handleCreate(e: FormEvent) {
    e.preventDefault();
    if (!user || !newName.trim()) return;
    setCreating(true);
    setCreateError("");
    try {
      const id = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
      await createVoiceChannel(id, newName.trim().slice(0, 40), user.uid, user.displayName ?? "Player");
      setNewName("");
      setShowCreateForm(false);
      setSelectedChannelId(id);
    } catch (err) {
      setCreateError(err instanceof Error ? err.message : "Could not create channel.");
    } finally {
      setCreating(false);
    }
  }

  async function handleDelete(channelId: string) {
    if (!confirm("Delete this voice channel?")) return;
    if (joinedChannelId === channelId) leave();
    await deleteVoiceChannel(channelId);
  }

  async function handleJoin() {
    if (!user || !selectedChannelId) return;
    if (joinedChannelId) leave();
    await join(selectedChannelId, {
      uid: user.uid,
      displayName: user.displayName ?? "Player",
      photoUrl: profile?.photoUrl ?? "",
      rank: profile?.rank ?? "none",
    });
  }

  const dockItems = [
    {
      icon: muted ? <MicOff size={20} /> : <Mic size={20} />,
      label: muted ? "Unmute" : "Mute",
      onClick: handleToggleMute,
    },
    {
      icon: deafened ? <VolumeX size={20} /> : <Volume2 size={20} />,
      label: deafened ? "Undeafen" : "Deafen",
      onClick: () => setDeafened((d) => !d),
    },
    {
      icon: localScreenStream ? <MonitorOff size={20} className="text-red-400" /> : <Monitor size={20} />,
      label: localScreenStream ? "Stop sharing" : "Share screen",
      onClick: () => (localScreenStream ? stopScreenShare() : startScreenShare()),
    },
    {
      icon: <PhoneOff size={20} className="text-red-400" />,
      label: "Leave",
      onClick: leave,
    },
  ];

  return (
    <div className="mx-auto max-w-6xl px-6 py-14">
      <div>
        <h1 className="font-mono text-2xl font-bold text-white">Voice Chat</h1>
        <p className="text-sm text-white/45">Discord-style channels. MVP+ and staff can create new ones.</p>
      </div>

      <div className="mt-8 grid grid-cols-1 gap-6 md:grid-cols-[200px_1fr]">
        <div className="rounded-2xl border border-border bg-surface p-5">
          {!channelsLoaded ? (
            <p className="text-sm text-white/30">Loading channels...</p>
          ) : (
            <LineSidebar
              items={sidebarItems}
              defaultActive={activeIndex}
              accentColor="#6690ff"
              textColor="#9aa0ad"
              markerColor="#3a3f4a"
              fontSize={0.95}
              itemGap={16}
              showIndex={false}
              onItemClick={(index: number) => handleSidebarClick(index)}
            />
          )}
        </div>

        <div className="min-w-0 rounded-2xl border border-border bg-surface p-6">
          {!channelsLoaded ? (
            <p className="text-sm text-white/30">Loading...</p>
          ) : !selectedChannel ? (
            <p className="text-sm text-white/30">Pick a channel from the left.</p>
          ) : (
            <>
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="flex items-center gap-2 font-mono text-lg font-semibold text-white"><Volume2 size={16} className="text-brand-400" /> {selectedChannel.name}</p>
                  <p className="text-xs text-white/40">{displayParticipants.length} connected</p>
                </div>
                <div className="flex items-center gap-2">
                  {!selectedChannel.isDefault && (user?.uid === selectedChannel.createdBy || isStaff) && (
                    <button
                      type="button"
                      onClick={() => handleDelete(selectedChannel.id)}
                      aria-label="Delete channel"
                      className="cursor-target rounded-lg p-1.5 text-white/25 hover:bg-red-500/10 hover:text-red-400"
                    >
                      <Trash2 size={14} />
                    </button>
                  )}
                  {!isJoinedHere && (
                    <Button size="sm" disabled={connecting} onClick={handleJoin}>
                      <Phone size={13} /> Join
                    </Button>
                  )}
                </div>
              </div>

              {micError && <p className="mt-3 text-xs text-red-400">{micError}</p>}

              {(localScreenStream || Object.keys(remoteScreenStreams).length > 0) && (
                <div className="mt-6 grid grid-cols-1 gap-4 md:grid-cols-2">
                  {localScreenStream && <ScreenShareTile label="You (sharing)" stream={localScreenStream} muted />}
                  {Object.entries(remoteScreenStreams).map(([uid, stream]) => (
                    <ScreenShareTile key={uid} label={participants.find((p) => p.id === uid)?.displayName ?? "Someone"} stream={stream} muted={deafened} />
                  ))}
                </div>
              )}

              {displayParticipants.length > 0 ? (
                <div className="mt-6 grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4">
                  {displayParticipants.map((p) => (
                    <ParticipantTile
                      key={p.id}
                      photoUrl={p.photoUrl}
                      displayName={p.displayName}
                      rank={p.rank ?? "none"}
                      muted={p.muted}
                      speaking={isJoinedHere && speaking.has(p.id)}
                      onClick={() => setOpenProfileId(p.id)}
                    />
                  ))}
                </div>
              ) : (
                <div className="mt-10 flex flex-col items-center justify-center gap-2 py-10 text-center">
                  <Volume2 size={28} className="text-white/20" />
                  <p className="text-sm text-white/30">Nobody's connected here yet.</p>
                </div>
              )}
            </>
          )}

          {showCreateForm && canCreate && (
            <form onSubmit={handleCreate} className="mt-6 flex gap-2 border-t border-border pt-4">
              <input
                autoFocus
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                placeholder="New channel name..."
                maxLength={40}
                className="w-full rounded-xl border border-border bg-surface-2 px-4 py-2 text-sm text-white placeholder:text-white/30 focus:border-brand-500/50 focus:outline-none"
              />
              <Button type="submit" size="sm" disabled={creating || !newName.trim()}>
                <Plus size={14} /> Create
              </Button>
            </form>
          )}
          {createError && <p className="mt-2 text-xs text-red-400">{createError}</p>}
        </div>
      </div>

      {joinedChannel && (
        <div className="fixed bottom-6 left-1/2 z-40 -translate-x-1/2">
          <Dock items={dockItems} magnification={64} baseItemSize={44} panelHeight={60} dockHeight={90} />
        </div>
      )}

      {openProfileId && <ProfileCard userId={openProfileId} onClose={() => setOpenProfileId(null)} />}
    </div>
  );
}
