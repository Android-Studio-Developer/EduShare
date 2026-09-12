import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { Link } from "react-router-dom";
import { CalendarClock, Castle, Coins, Crown, Fingerprint, Globe2, Laptop, Mail, Pencil, Save, ShieldCheck, UserPlus, X } from "lucide-react";
import { useAuth } from "../context/AuthContext";
import { getPresenceStatus, PRESENCE_LABELS, subscribeToProfile, updateProfileData } from "../lib/profiles";
import { isReduceMotion } from "../lib/accessibility";
import { isStaffRole } from "../lib/moderation";
import { sendFriendRequest } from "../lib/friends";
import { subscribeToGuild } from "../lib/guilds";
import { arcadeLevel } from "../lib/minigames";
import { minutesToLevel, rankNameClass } from "../lib/ranks";
import { nameStyle } from "../lib/cosmetics";
import { donateCredits } from "../lib/shop";
import { subscribeToChessDuels } from "../lib/chessDuels";
import { subscribeToAccountIdentityAudit } from "../lib/accountAudit";
import type { ChessDuel, Guild, OwnerLoginAudit, UserProfile } from "../types";
import BannerEffect from "./BannerEffect";
import Button from "./Button";
import RankBadge from "./RankBadge";
import StatusDot from "./StatusDot";
import UserBadges from "./UserBadges";
import EvilEye from "./EvilEye";
import GlowCursor from "./GlowCursor";
import PixelSwap from "./PixelSwap";
import ProfileBannerMedia from "./ProfileBannerMedia";
import ThoughtBubble from "./ThoughtBubble";
import GameActivityCard from "./GameActivityCard";

export default function ProfileCard({ userId, onClose }: { userId: string; onClose: () => void }) {
  const { user, role } = useAuth();
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [guild, setGuild] = useState<Guild | null>(null);
  const [chessRooms, setChessRooms] = useState<ChessDuel[]>([]);
  const [sent, setSent] = useState(false);
  const [donateAmount, setDonateAmount] = useState("");
  const [donateNote, setDonateNote] = useState("");
  const [donateStatus, setDonateStatus] = useState("");
  const [donating, setDonating] = useState(false);
  const [editing, setEditing] = useState(false);
  const [editStatus, setEditStatus] = useState("");
  const [identityAudits, setIdentityAudits] = useState<OwnerLoginAudit[]>([]);

  useEffect(() => subscribeToProfile(userId, setProfile), [userId]);
  useEffect(() => subscribeToChessDuels(setChessRooms), []);
  useEffect(() => {
    if (role !== "owner" && role !== "dabug") { setIdentityAudits([]); return; }
    return subscribeToAccountIdentityAudit(userId, setIdentityAudits);
  }, [role, userId]);
  useEffect(() => {
    if (!profile?.guildId) { setGuild(null); return; }
    return subscribeToGuild(profile.guildId, setGuild);
  }, [profile?.guildId]);
  const chessActivity = chessRooms.find((room) => room.status === "active" && (room.whiteId === userId || room.blackId === userId));
  const chessOpponent = chessActivity ? (chessActivity.whiteId === userId ? chessActivity.blackName : chessActivity.whiteName) : "";
  const latestIdentity = identityAudits[0];

  async function addFriend() {
    if (!user || !profile) return;
    await sendFriendRequest(user.uid, user.displayName ?? "Player", user.photoURL ?? "", userId, profile.displayName, profile.photoUrl);
    setSent(true);
  }

  async function donate() {
    if (!user) return;
    const amount = Math.floor(Number(donateAmount));
    if (!amount || amount <= 0) { setDonateStatus("Enter a valid amount."); return; }
    setDonating(true);
    setDonateStatus("");
    try {
      await donateCredits(user.uid, user.displayName ?? "Player", userId, amount, donateNote);
      setDonateStatus(`Sent ${amount} credits!`);
      setDonateAmount("");
      setDonateNote("");
    } catch (error) {
      setDonateStatus(error instanceof Error ? error.message : "Donation failed.");
    } finally {
      setDonating(false);
    }
  }

  async function saveStaffEdit() {
    if (!profile || !isStaffRole(role)) return;
    setEditStatus("");
    try {
      await updateProfileData(userId, {
        displayName: profile.displayName.trim(),
        photoUrl: profile.photoUrl.trim(),
        bio: profile.bio.trim(),
        bannerUrl: profile.bannerUrl.trim(),
        backgroundUrl: profile.backgroundUrl.trim(),
        bannerEffect: profile.bannerEffect,
        favoriteGames: profile.favoriteGames.trim(),
      });
      setEditStatus("Profile saved.");
      setEditing(false);
    } catch (error) {
      setEditStatus(error instanceof Error ? error.message : "Could not edit this profile.");
    }
  }

  return createPortal(
    <div className="fixed inset-0 z-100 flex items-center justify-center bg-black/70 p-4" onClick={onClose}>
      <div
        onClick={(e) => e.stopPropagation()}
        className={`relative max-h-[92vh] w-full max-w-sm overflow-y-auto rounded-2xl border border-border bg-surface ${profile?.profileEffect ? `profile-effect-${profile.profileEffect}` : ""}`}
      >
        {profile?.profileEffect === "profile-evil-eye" && !isReduceMotion() && (
          <div className="pointer-events-none absolute inset-0 opacity-25">
            <EvilEye scale={0.55} intensity={1.1} glowIntensity={0.3} />
          </div>
        )}
        <GlowCursor secondaryColor="#e879f9" enabled={!!profile && !isReduceMotion()} style={undefined}>
        <div className="profile-card-banner relative h-28 overflow-hidden bg-gradient-to-r from-brand-600 to-fuchsia-600">
          {profile?.bannerUrl && <ProfileBannerMedia value={profile.bannerUrl} />}
          {profile?.bannerEffect && <BannerEffect effect={profile.bannerEffect} />}
        </div>
        <div className="px-5 pb-5">
          <div className="-mt-10 flex items-end justify-between gap-2">
            <div className="flex min-w-0 items-end gap-3">
            <div className={`profile-card-avatar relative shrink-0 ${profile?.pfpEffect ? `pfp-effect-${profile.pfpEffect}` : ""}`}>
              <PixelSwap
                className="h-20 w-20 rounded-2xl border-4 border-surface"
                aspectRatio="1 / 1"
                pixelSize={9}
                trigger="hover"
                style={undefined}
                active={undefined}
                onActiveChange={undefined}
                onComplete={undefined}
                firstContent={
                  profile?.photoUrl ? (
                    <img src={profile.photoUrl} alt="" className="h-full w-full object-cover" />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-cyan-400 to-fuchsia-500 text-2xl font-bold text-white">
                      {(profile?.displayName ?? "?").slice(0, 1).toUpperCase()}
                    </div>
                  )
                }
                secondContent={
                  <div className="flex h-full w-full flex-col items-center justify-center gap-0.5 bg-gradient-to-br from-cyan-400 to-fuchsia-500 text-white">
                    <span className="text-[9px] font-bold uppercase tracking-wider">{profile?.rank ?? ""}</span>
                    <span className="font-mono text-xs">Lv.{minutesToLevel(profile?.playMinutes ?? 0)}</span>
                  </div>
                }
              />
              <StatusDot status={getPresenceStatus(profile)} className="absolute -bottom-1 -right-1 h-4 w-4" />
            </div>
            {profile && <ThoughtBubble text={profile.customStatus} className="mb-1 min-w-0 max-w-44" />}
            </div>
            <button
              type="button"
              onClick={onClose}
              aria-label="Close"
              className="cursor-target mb-1 rounded-lg p-1.5 text-white/40 hover:bg-white/10 hover:text-white"
            >
              <X size={16} />
            </button>
          </div>

          {!profile ? (
            <p className="mt-4 text-sm text-white/40">Loading…</p>
          ) : (
            <>
              <div className="profile-card-nameplate mt-3 flex items-center gap-2">
                <h2
                  className={`truncate font-mono text-lg font-bold ${nameStyle(profile).className || rankNameClass(profile.rank)}`}
                  style={nameStyle(profile).style}
                >
                  {profile.displayName}
                </h2>
                <RankBadge rank={profile.rank} />
                <UserBadges profile={profile} />
              </div>
              {profile.username && <p className="text-xs text-white/35">@{profile.username}</p>}
              {guild && (
                <p className="mt-0.5 flex items-center gap-1 text-xs text-violet-300/80">
                  <Castle size={11} /> I belong in {guild.name}
                </p>
              )}
              <p className="mt-0.5 text-xs text-white/40">
                {PRESENCE_LABELS[getPresenceStatus(profile)]} · Level {minutesToLevel(profile.playMinutes)} · {profile.botXp} arcade XP (Lv.{arcadeLevel(profile.botXp)})
              </p>
              {chessActivity && <Link to={`/fun?chess=${chessActivity.id}`} onClick={onClose} className="cursor-target mt-3 flex items-center gap-2 rounded-xl border border-amber-400/25 bg-amber-400/[.07] p-3 text-xs text-amber-100 transition-colors hover:border-amber-300/50"><Crown size={16} className="text-amber-300"/><span className="min-w-0 flex-1"><strong className="block truncate">Playing Chess with {chessOpponent || "an opponent"}</strong><span className="mt-0.5 block text-[10px] text-amber-100/45">{chessActivity.timeControl === "blitz_5_3" ? "5 | 3 Blitz" : chessActivity.timeControl === "rapid_10" ? "10 min Rapid" : "Live match"}</span></span><span className="text-[10px] font-bold uppercase tracking-wider">Watch →</span></Link>}
              <GameActivityCard game={profile.activityGame} startedAt={profile.activityStartedAt} compact/>
              {profile.favoriteGames && <p className="mt-2 text-xs text-white/50">Plays: {profile.favoriteGames}</p>}
              {profile.bio && <p className="mt-3 rounded-xl border border-border bg-surface-2 p-3 text-sm break-words text-white/70">{profile.bio}</p>}
              {profile.joinedAt > 0 && <p className="mt-3 text-[11px] text-white/30">Joined {new Date(profile.joinedAt).toLocaleDateString()}</p>}
              {/* Email is never stored on the public profile doc — only shown here when it's your own card, sourced from your own auth session. */}
              {user && user.uid === userId && user.email && <p className="text-[11px] text-white/30">{user.email}</p>}
              {(role === "owner" || role === "dabug") && (
                <section className="mt-4 overflow-hidden rounded-xl border border-fuchsia-400/25 bg-fuchsia-400/[.055]">
                  <div className="flex items-center justify-between border-b border-fuchsia-400/15 px-3 py-2.5"><p className="flex items-center gap-2 text-xs font-bold text-fuchsia-200"><ShieldCheck size={14}/>Dabug identity</p><span className="rounded bg-fuchsia-400/10 px-1.5 py-0.5 font-mono text-[8px] font-bold uppercase tracking-wider text-fuchsia-200/70">Restricted</span></div>
                  <dl className="grid gap-2 p-3 text-[10px]">
                    <div className="rounded-lg border border-white/[.06] bg-black/15 p-2.5"><dt className="flex items-center gap-1.5 uppercase tracking-wider text-white/25"><Mail size={11}/>Email address</dt><dd className="mt-1 break-all font-semibold text-white/65">{latestIdentity?.email || "No captured login yet"}</dd></div>
                    <div className="grid grid-cols-2 gap-2"><div className="rounded-lg border border-white/[.06] bg-black/15 p-2.5"><dt className="flex items-center gap-1.5 uppercase tracking-wider text-white/25"><Globe2 size={11}/>Public IP</dt><dd className="mt-1 break-all font-mono font-semibold text-white/65">{latestIdentity?.ipAddress || "Unavailable"}</dd></div><div className="rounded-lg border border-white/[.06] bg-black/15 p-2.5"><dt className="flex items-center gap-1.5 uppercase tracking-wider text-white/25"><Laptop size={11}/>Device</dt><dd className="mt-1 font-semibold text-white/65">{latestIdentity?.device || "No login record"}</dd></div></div>
                    <div className="rounded-lg border border-white/[.06] bg-black/15 p-2.5"><dt className="flex items-center gap-1.5 uppercase tracking-wider text-white/25"><Fingerprint size={11}/>Account ID</dt><dd className="mt-1 break-all font-mono font-semibold text-white/65">{userId}</dd></div>
                    <div className="grid grid-cols-2 gap-2"><div className="rounded-lg border border-white/[.06] bg-black/15 p-2.5"><dt className="flex items-center gap-1.5 uppercase tracking-wider text-white/25"><CalendarClock size={11}/>Registered</dt><dd className="mt-1 font-semibold text-white/65">{profile.joinedAt > 0 ? new Date(profile.joinedAt).toLocaleString() : "Unknown"}</dd></div><div className="rounded-lg border border-white/[.06] bg-black/15 p-2.5"><dt className="flex items-center gap-1.5 uppercase tracking-wider text-white/25"><CalendarClock size={11}/>Latest login</dt><dd className="mt-1 font-semibold text-white/65">{latestIdentity?.createdAt ? new Date(latestIdentity.createdAt).toLocaleString() : "Not recorded"}</dd></div></div>
                  </dl>
                  <p className="border-t border-fuchsia-400/10 px-3 py-2 text-[9px] leading-relaxed text-white/25">IP matches are a review signal, not automatic proof that accounts belong to the same person.</p>
                </section>
              )}
              {isStaffRole(role) && user?.uid !== userId && (
                <div className="mt-4 rounded-xl border border-amber-400/25 bg-amber-400/5 p-3">
                  <button type="button" onClick={() => setEditing((value) => !value)} className="cursor-target flex w-full items-center justify-between text-xs font-semibold text-amber-200"><span className="flex items-center gap-2"><Pencil size={13}/>Staff profile editor</span><span>{editing ? "Close" : "Edit"}</span></button>
                  {editing && <div className="mt-3 space-y-2">
                    <input value={profile.displayName} onChange={(event) => setProfile({ ...profile, displayName: event.target.value })} placeholder="Display name" maxLength={80} className="w-full rounded-lg border border-border bg-surface-2 px-3 py-2 text-xs text-white"/>
                    <input value={profile.photoUrl} onChange={(event) => setProfile({ ...profile, photoUrl: event.target.value })} placeholder="Profile image URL" className="w-full rounded-lg border border-border bg-surface-2 px-3 py-2 text-xs text-white"/>
                    <input value={profile.bannerUrl} onChange={(event) => setProfile({ ...profile, bannerUrl: event.target.value })} placeholder="Banner URL" className="w-full rounded-lg border border-border bg-surface-2 px-3 py-2 text-xs text-white"/>
                    <input value={profile.backgroundUrl} onChange={(event) => setProfile({ ...profile, backgroundUrl: event.target.value })} placeholder="Background URL" className="w-full rounded-lg border border-border bg-surface-2 px-3 py-2 text-xs text-white"/>
                    <input value={profile.favoriteGames} onChange={(event) => setProfile({ ...profile, favoriteGames: event.target.value })} placeholder="Favorite games" maxLength={100} className="w-full rounded-lg border border-border bg-surface-2 px-3 py-2 text-xs text-white"/>
                    <textarea value={profile.bio} onChange={(event) => setProfile({ ...profile, bio: event.target.value })} placeholder="Bio" maxLength={300} rows={3} className="w-full rounded-lg border border-border bg-surface-2 px-3 py-2 text-xs text-white"/>
                    <Button size="sm" className="w-full" onClick={saveStaffEdit}><Save size={13}/>Save player profile</Button>
                  </div>}
                  {editStatus && <p className="mt-2 text-xs text-white/55">{editStatus}</p>}
                </div>
              )}
              {user && user.uid !== userId && (
                <>
                  <Button className="mt-4 w-full" disabled={sent} onClick={addFriend}>
                    <UserPlus size={14} /> {sent ? "Request sent" : "Add friend"}
                  </Button>
                  <div className="mt-3 flex items-center gap-2">
                    <input
                      type="number"
                      min={1}
                      value={donateAmount}
                      onChange={(e) => setDonateAmount(e.target.value)}
                      placeholder="Credits"
                      className="w-full rounded-xl border border-border bg-surface-2 px-3 py-2 text-sm text-white placeholder:text-white/30 focus:border-brand-500/50 focus:outline-none"
                    />
                    <Button variant="secondary" size="sm" disabled={donating || !donateAmount} onClick={donate}>
                      <Coins size={14} /> Donate
                    </Button>
                  </div>
                  <input
                    value={donateNote}
                    onChange={(e) => setDonateNote(e.target.value)}
                    placeholder="Message (optional)"
                    maxLength={150}
                    className="mt-1.5 w-full rounded-xl border border-border bg-surface-2 px-3 py-2 text-sm text-white placeholder:text-white/30 focus:border-brand-500/50 focus:outline-none"
                  />
                  {donateStatus && <p className="mt-1.5 text-xs text-white/50">{donateStatus}</p>}
                </>
              )}
            </>
          )}
        </div>
        </GlowCursor>
      </div>
    </div>,
    document.body,
  );
}
