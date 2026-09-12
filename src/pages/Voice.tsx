import { useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import { FlaskConical, LockKeyhole, Maximize2, MessageSquare, Mic, MicOff, Monitor, MonitorOff, Phone, PhoneOff, Plus, Send, Trash2, Volume2, VolumeX, X } from "lucide-react";
import { Link } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { useVoiceCall } from "../context/VoiceCallContext";
import { useSpeakingLevels } from "../hooks/useSpeakingLevels";
import { clearVoiceMessages, createVoiceChannel, deleteVoiceChannel, ensureGeneralChannel, sendVoiceMessage, STAFF_MEETING_ID, STALE_MS, subscribeToParticipants, subscribeToVoiceChannels, subscribeToVoiceMessages } from "../lib/voice";
import { isStaffRole } from "../lib/moderation";
import { subscribeToProfile } from "../lib/profiles";
import { rankNameClass, rankTier } from "../lib/ranks";
import { VOICE_EFFECT_OPTIONS } from "../lib/voiceEffects";
import type { Rank, UserProfile, VoiceChannelDoc, VoiceChatMessage, VoiceParticipant } from "../types";
import Button from "../components/Button";
import ProfileCard from "../components/ProfileCard";
import muteSoundUrl from "./discordmute.mp3";
import streamSoundUrl from "./stream.mp3";
import carlBotIcon from "../assets/icons/boticon.svg";

function ScreenShareTile({ label, stream, muted, onFocus, focused = false }: { label: string; stream: MediaStream; muted: boolean; onFocus?: () => void; focused?: boolean }) {
  const ref = useRef<HTMLVideoElement>(null);
  useEffect(() => {
    const video = ref.current;
    if (!video) return;
    video.srcObject = stream;
    const play = () => void video.play().catch(() => {});
    play();
    video.addEventListener("loadedmetadata", play);
    video.addEventListener("canplay", play);
    return () => {
      video.removeEventListener("loadedmetadata", play);
      video.removeEventListener("canplay", play);
      video.srcObject = null;
    };
  }, [stream]);
  return (
    <div onClick={onFocus} onKeyDown={(event) => { if (onFocus && (event.key === "Enter" || event.key === " ")) onFocus(); }} role={onFocus ? "button" : undefined} tabIndex={onFocus ? 0 : undefined} title={onFocus ? "Focus screen share" : undefined} className={`overflow-hidden rounded-2xl border border-border bg-black ${onFocus ? "cursor-target cursor-zoom-in outline-none focus:border-brand-400" : ""}`}>
      <video ref={ref} autoPlay playsInline muted={muted} className={`${focused ? "max-h-[80vh]" : "max-h-[26rem]"} w-full object-contain`} />
      <p className="flex items-center justify-between border-t border-border bg-surface-2 px-3 py-1.5 text-xs font-medium text-white/60"><span>{label}</span>{onFocus && <Maximize2 size={12}/>}</p>
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
  onClick?: () => void;
}) {
  return (
    <div
      onClick={onClick}
      className={`flex min-h-36 flex-col items-center justify-center gap-3 rounded-2xl border-2 bg-surface-2 p-4 transition-colors duration-100 ${onClick ? "cursor-target cursor-pointer" : ""} ${
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
  const isStaff = isStaffRole(role);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [channels, setChannels] = useState<VoiceChannelDoc[]>([]);
  const [selectedChannelId, setSelectedChannelId] = useState<string | null>(null);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [newName, setNewName] = useState("");
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState("");
  const [voiceMessages, setVoiceMessages] = useState<VoiceChatMessage[]>([]);
  const [voiceText, setVoiceText] = useState("");
  const [voiceSending, setVoiceSending] = useState(false);
  const [voiceMessageError, setVoiceMessageError] = useState("");
  const [focusedScreenId, setFocusedScreenId] = useState<string | null>(null);
  const voiceMessagesEndRef = useRef<HTMLDivElement>(null);

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
    ttsEnabled,
    setTtsEnabled,
    voiceEffect,
    setVoiceEffect,
  } = useVoiceCall();

  const muteAudioRef = useRef<HTMLAudioElement | null>(null);
  const streamAudioRef = useRef<HTMLAudioElement | null>(null);
  useEffect(() => {
    muteAudioRef.current = new Audio(muteSoundUrl);
    streamAudioRef.current = new Audio(streamSoundUrl);
    [muteAudioRef, streamAudioRef].forEach((r) => {
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
      const visibleChannels = cs.filter((channel) => channel.id !== STAFF_MEETING_ID && (!channel.staffOnly || isStaff));
      setChannels(visibleChannels);
      setChannelsLoaded(true);
      setSelectedChannelId((prev) => visibleChannels.some((channel) => channel.id === prev) ? prev : visibleChannels[0]?.id ?? null);
    });
  }, [isStaff]);

  useEffect(() => {
    if (!user) return;
    return subscribeToProfile(user.uid, setProfile);
  }, [user]);

  useEffect(() => {
    setVoiceMessages([]);
    setVoiceMessageError("");
    if (!selectedChannelId) return;
    return subscribeToVoiceMessages(selectedChannelId, setVoiceMessages);
  }, [selectedChannelId]);

  useEffect(() => {
    voiceMessagesEndRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }, [voiceMessages.length]);

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

  const canCreate = isStaffRole(role) || rankTier(profile?.rank) >= rankTier("mvp_plus");
  const selectedChannel = channels.find((c) => c.id === selectedChannelId) ?? null;
  const isJoinedHere = joinedChannelId === selectedChannelId;
  const joinedChannel = channels.find((c) => c.id === joinedChannelId) ?? null;

  useEffect(() => {
    if (channelsLoaded && joinedChannelId && !channels.some((channel) => channel.id === joinedChannelId)) leave();
  }, [channels, channelsLoaded, joinedChannelId, leave]);

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

  async function sendVoiceText() {
    if (!user || !profile || !selectedChannelId || !isJoinedHere || !voiceText.trim()) return;
    const trimmed = voiceText.trim();
    if (trimmed.toLowerCase() === "!chatre") {
      if (!isStaff) {
        setVoiceMessageError("Only staff can reset this channel's chat.");
        return;
      }
      setVoiceSending(true);
      setVoiceMessageError("");
      try {
        await clearVoiceMessages(selectedChannelId);
        setVoiceText("");
      } catch (error) {
        setVoiceMessageError(error instanceof Error ? error.message : "Could not reset this channel's chat.");
      } finally {
        setVoiceSending(false);
      }
      return;
    }
    setVoiceSending(true);
    setVoiceMessageError("");
    try {
      await sendVoiceMessage(selectedChannelId, user.uid, profile.displayName, profile.photoUrl, voiceText);
      setVoiceText("");
    } catch (error) {
      setVoiceMessageError(error instanceof Error ? error.message : "Could not send that message.");
    } finally {
      setVoiceSending(false);
    }
  }

  function handleVoiceMessage(e: FormEvent) {
    e.preventDefault();
    void sendVoiceText();
  }

  const screenShares = useMemo(() => [
    ...(localScreenStream ? [{ id: "local", label: "You (sharing)", stream: localScreenStream, muted: true }] : []),
    ...Object.entries(remoteScreenStreams).map(([uid, stream]) => ({ id: uid, label: participants.find((p) => p.id === uid)?.displayName ?? "Someone", stream, muted: deafened })),
  ], [localScreenStream, remoteScreenStreams, participants, deafened]);
  const focusedScreen = screenShares.find((share) => share.id === focusedScreenId) ?? null;

  useEffect(() => {
    if (focusedScreenId && !screenShares.some((share) => share.id === focusedScreenId)) setFocusedScreenId(null);
  }, [focusedScreenId, screenShares]);

  return (
    <div className="mx-auto max-w-[96rem] px-3 py-5 sm:px-5 sm:py-8">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="font-mono text-[10px] font-bold uppercase tracking-[.2em] text-brand-300">Live communications</p>
          <h1 className="mt-1 text-2xl font-bold text-white">Voice Chat</h1>
          <p className="text-sm text-white/45">Join a room, talk, message, or share your screen.</p>
        </div>
        {profile?.voiceUnlocked && (
          <Link to="/voice-lab" className="cursor-target flex items-center gap-1.5 rounded-xl border border-border bg-surface px-3 py-2 text-xs font-semibold text-white/60 hover:text-white">
            <FlaskConical size={13} /> Voice Lab
          </Link>
        )}
      </div>

      <div className="mt-5 grid grid-cols-1 overflow-hidden rounded-2xl border border-white/[.09] bg-[#0b0e12]/95 shadow-2xl shadow-black/25 md:grid-cols-[240px_minmax(0,1fr)]">
        <div className="border-b border-white/[.08] bg-[#10141a] md:border-b-0 md:border-r">
          <div className="flex items-center justify-between border-b border-white/[.08] px-4 py-4"><div><p className="text-sm font-bold text-white">Voice channels</p><p className="text-[10px] text-white/30">{channels.length} available</p></div>{canCreate&&<button type="button" onClick={()=>setShowCreateForm(true)} aria-label="New channel" className="cursor-target grid h-8 w-8 place-items-center rounded-lg text-white/45 hover:bg-white/[.07] hover:text-white"><Plus size={16}/></button>}</div>
          {!channelsLoaded ? (
            <p className="px-4 py-6 text-sm text-white/30">Loading channels...</p>
          ) : (
            <nav className="max-h-64 space-y-1 overflow-y-auto p-2 md:max-h-[650px]">{channels.map((channel)=><button key={channel.id} type="button" onClick={()=>setSelectedChannelId(channel.id)} className={`cursor-target flex w-full items-center gap-2.5 rounded-xl px-3 py-2.5 text-left text-sm font-semibold ${selectedChannelId===channel.id?"bg-brand-500/15 text-white":"text-white/45 hover:bg-white/[.05] hover:text-white/75"}`}>{channel.staffOnly?<LockKeyhole size={16} className="shrink-0 text-amber-300"/>:<Volume2 size={16} className="shrink-0"/>}<span className="min-w-0 flex-1 truncate">{channel.name}</span>{joinedChannelId===channel.id&&<span className="h-2 w-2 shrink-0 rounded-full bg-emerald-400"/>}</button>)}</nav>
          )}
          {joinedChannel&&<div className="border-t border-white/[.08] bg-emerald-400/[.04] px-4 py-3"><p className="flex items-center gap-2 text-xs font-semibold text-emerald-300"><span className="h-2 w-2 rounded-full bg-emerald-400"/>Voice connected</p><p className="mt-1 truncate text-[10px] text-white/35">{joinedChannel.name}</p></div>}
        </div>

        <div className="min-w-0 bg-[#0c0f14] p-4 sm:p-6">
          {!channelsLoaded ? (
            <p className="text-sm text-white/30">Loading...</p>
          ) : !selectedChannel ? (
            <p className="text-sm text-white/30">Pick a channel from the left.</p>
          ) : (
            <>
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="flex items-center gap-2 font-mono text-lg font-semibold text-white">{selectedChannel.staffOnly ? <LockKeyhole size={16} className="text-amber-300" /> : <Volume2 size={16} className="text-brand-400" />} {selectedChannel.name}</p>
                  <p className="text-xs text-white/40">{displayParticipants.length + (selectedChannel.staffOnly ? 1 : 0)} connected{selectedChannel.staffOnly ? " · Staff only · closes after 5 min inactive" : ""}</p>
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

              {screenShares.length > 0 && (
                <div className="mt-6 grid grid-cols-1 gap-4 md:grid-cols-2">
                  {screenShares.map((share) => <ScreenShareTile key={share.id} label={share.label} stream={share.stream} muted={share.muted} onFocus={() => setFocusedScreenId(share.id)}/>)}
                </div>
              )}

              {displayParticipants.length > 0 || selectedChannel.staffOnly ? (
                <div className="mt-6 grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
                  {selectedChannel.staffOnly && (
                    <ParticipantTile photoUrl={carlBotIcon} displayName="Carl-bot" rank="none" muted={false} speaking={false} />
                  )}
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
                <div className="mt-6 flex min-h-72 flex-col items-center justify-center gap-2 rounded-2xl border border-dashed border-white/[.08] bg-white/[.015] text-center">
                  <span className="grid h-16 w-16 place-items-center rounded-full bg-white/[.04]"><Volume2 size={28} className="text-white/20" /></span>
                  <p className="mt-2 text-sm font-semibold text-white/45">This room is quiet</p>
                  <p className="text-xs text-white/25">Join the channel and invite someone.</p>
                  {!isJoinedHere&&<Button size="sm" disabled={connecting} onClick={handleJoin}><Phone size={13}/>Join channel</Button>}
                </div>
              )}

              <section className="mt-6 overflow-hidden rounded-2xl border border-border bg-surface-2/35">
                <div className="flex items-center justify-between gap-3 border-b border-border px-4 py-3"><div className="flex items-center gap-2"><MessageSquare size={15} className="text-brand-300"/><div><h2 className="text-sm font-semibold text-white">Channel chat</h2><p className="text-[10px] text-white/35">Read new messages aloud in American English.</p></div></div><button type="button" onClick={() => setTtsEnabled((value) => !value)} className={`cursor-target flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-[11px] font-semibold ${ttsEnabled ? "border-brand-400/40 bg-brand-500/15 text-brand-200" : "border-border bg-white/5 text-white/40"}`}>{ttsEnabled ? <Volume2 size={12}/> : <VolumeX size={12}/>}TTS {ttsEnabled ? "on" : "off"}</button></div>
                <div className="max-h-80 min-h-44 space-y-3 overflow-y-auto p-4" role="log" aria-live="polite">{voiceMessages.length===0?<p className="py-12 text-center text-xs text-white/25">No channel messages yet.</p>:voiceMessages.map((item)=><div key={item.id} className="flex items-start gap-2.5">{item.authorPhotoUrl?<img src={item.authorPhotoUrl} alt="" className="h-7 w-7 shrink-0 rounded-lg object-cover"/>:<span className="grid h-7 w-7 shrink-0 place-items-center rounded-lg bg-brand-500/20 text-[10px] font-bold text-brand-200">{item.authorName.slice(0,1).toUpperCase()}</span>}<div className="min-w-0"><p className="flex items-center gap-1.5 text-[11px] font-semibold text-white/65">{item.authorName}{item.broadcastTts&&<span className="rounded bg-brand-500/15 px-1 py-0.5 text-[8px] uppercase tracking-wider text-brand-200">TTS</span>}</p><p className="break-words text-sm text-white/80">{item.text}</p></div></div>)}<div ref={voiceMessagesEndRef}/></div>
                <form onSubmit={handleVoiceMessage} className="flex flex-wrap gap-2 border-t border-border p-3"><input value={voiceText} onChange={(event)=>setVoiceText(event.target.value)} disabled={!isJoinedHere} maxLength={500} placeholder={isJoinedHere?"Message this voice channel…":"Join the channel to chat"} className="min-w-0 flex-1 rounded-xl border border-border bg-surface px-3 py-2 text-sm text-white placeholder:text-white/25 disabled:cursor-not-allowed disabled:opacity-50"/><Button type="submit" size="sm" disabled={!isJoinedHere||voiceSending||!voiceText.trim()} aria-label="Send channel message as text to speech"><Volume2 size={14}/><Send size={14}/></Button></form>
                {voiceMessageError&&<p className="px-4 pb-3 text-xs text-red-400">{voiceMessageError}</p>}
              </section>
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

      {joinedChannel && profile?.voiceUnlocked && (
        <div className="mt-3 flex max-w-full gap-1 overflow-x-auto rounded-xl border border-border bg-surface/90 p-1.5">
          {VOICE_EFFECT_OPTIONS.map((option) => (
            <button
              key={option.id}
              type="button"
              onClick={() => void setVoiceEffect(option.id)}
              className={`cursor-target rounded-full px-3 py-1.5 text-xs font-semibold transition-colors ${
                voiceEffect === option.id ? "bg-brand-500 text-white" : "text-white/50 hover:text-white"
              }`}
            >
              {option.label}
            </button>
          ))}
        </div>
      )}

      {joinedChannel && (
        <div className="sticky bottom-3 z-40 mx-auto mt-3 flex w-fit items-center gap-2 rounded-2xl border border-white/10 bg-[#10141a]/95 p-2 shadow-2xl backdrop-blur-xl">
          <button type="button" onClick={handleToggleMute} aria-label={muted?"Unmute":"Mute"} className={`cursor-target grid h-11 w-11 place-items-center rounded-xl ${muted?"bg-red-500/20 text-red-300":"bg-white/[.07] text-white/75 hover:bg-white/10"}`}>{muted?<MicOff size={19}/>:<Mic size={19}/>}</button>
          <button type="button" onClick={()=>setDeafened((value)=>!value)} aria-label={deafened?"Undeafen":"Deafen"} className={`cursor-target grid h-11 w-11 place-items-center rounded-xl ${deafened?"bg-red-500/20 text-red-300":"bg-white/[.07] text-white/75 hover:bg-white/10"}`}>{deafened?<VolumeX size={19}/>:<Volume2 size={19}/>}</button>
          <button type="button" onClick={()=>localScreenStream?stopScreenShare():startScreenShare()} aria-label={localScreenStream?"Stop sharing":"Share screen"} className={`cursor-target grid h-11 w-11 place-items-center rounded-xl ${localScreenStream?"bg-brand-500/25 text-brand-200":"bg-white/[.07] text-white/75 hover:bg-white/10"}`}>{localScreenStream?<MonitorOff size={19}/>:<Monitor size={19}/>}</button>
          <span className="mx-1 h-7 w-px bg-white/10"/>
          <button type="button" onClick={leave} aria-label="Disconnect" className="cursor-target grid h-11 w-14 place-items-center rounded-xl bg-red-500 text-white hover:bg-red-400"><PhoneOff size={20}/></button>
        </div>
      )}

      {focusedScreen && <div className="fixed inset-0 z-[80] grid place-items-center bg-black/85 p-3 backdrop-blur-sm sm:p-8" role="dialog" aria-modal="true" aria-label={`${focusedScreen.label} focused screen share`} onMouseDown={(event)=>{if(event.target===event.currentTarget)setFocusedScreenId(null);}}><div className="relative w-full max-w-7xl"><button type="button" onClick={()=>setFocusedScreenId(null)} className="cursor-target absolute -right-2 -top-10 grid h-8 w-8 place-items-center rounded-full bg-white/10 text-white hover:bg-white/20" aria-label="Close focused screen share"><X size={17}/></button><ScreenShareTile label={`${focusedScreen.label} · focused`} stream={focusedScreen.stream} muted={focusedScreen.muted} focused/></div></div>}

      {openProfileId && <ProfileCard userId={openProfileId} onClose={() => setOpenProfileId(null)} />}
    </div>
  );
}
