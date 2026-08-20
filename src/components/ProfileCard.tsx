import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { Castle, Coins, UserPlus, X } from "lucide-react";
import { useAuth } from "../context/AuthContext";
import { isOnline, subscribeToProfile } from "../lib/profiles";
import { sendFriendRequest } from "../lib/friends";
import { subscribeToGuild } from "../lib/guilds";
import { arcadeLevel } from "../lib/minigames";
import { minutesToLevel, rankNameClass } from "../lib/ranks";
import { donateCredits } from "../lib/shop";
import type { Guild, UserProfile } from "../types";
import BannerEffect from "./BannerEffect";
import Button from "./Button";
import RankBadge from "./RankBadge";
import StatusDot from "./StatusDot";
import UserBadges from "./UserBadges";

export default function ProfileCard({ userId, onClose }: { userId: string; onClose: () => void }) {
  const { user } = useAuth();
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [guild, setGuild] = useState<Guild | null>(null);
  const [sent, setSent] = useState(false);
  const [donateAmount, setDonateAmount] = useState("");
  const [donateNote, setDonateNote] = useState("");
  const [donateStatus, setDonateStatus] = useState("");
  const [donating, setDonating] = useState(false);

  useEffect(() => subscribeToProfile(userId, setProfile), [userId]);
  useEffect(() => {
    if (!profile?.guildId) { setGuild(null); return; }
    return subscribeToGuild(profile.guildId, setGuild);
  }, [profile?.guildId]);

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

  return createPortal(
    <div className="fixed inset-0 z-100 flex items-center justify-center bg-black/70 p-4" onClick={onClose}>
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-sm overflow-hidden rounded-2xl border border-border bg-surface"
      >
        <div
          className="relative h-28 bg-gradient-to-r from-brand-600 to-fuchsia-600 bg-cover bg-center"
          style={profile?.bannerUrl ? { backgroundImage: `url(${profile.bannerUrl})` } : undefined}
        >
          {profile?.bannerEffect && <BannerEffect effect={profile.bannerEffect} />}
        </div>
        <div className="px-5 pb-5">
          <div className="-mt-10 flex items-end justify-between">
            <div className="relative">
              {profile?.photoUrl ? (
                <img src={profile.photoUrl} alt="" className="h-20 w-20 rounded-2xl border-4 border-surface object-cover" />
              ) : (
                <div className="flex h-20 w-20 items-center justify-center rounded-2xl border-4 border-surface bg-gradient-to-br from-cyan-400 to-fuchsia-500 text-2xl font-bold text-white">
                  {(profile?.displayName ?? "?").slice(0, 1).toUpperCase()}
                </div>
              )}
              <StatusDot online={isOnline(profile)} className="absolute -bottom-1 -right-1 h-4 w-4" />
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
              <div className="mt-3 flex items-center gap-2">
                <h2 className={`truncate font-mono text-lg font-bold ${rankNameClass(profile.rank)}`}>{profile.displayName}</h2>
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
                {isOnline(profile) ? "Online now" : "Offline"} · Level {minutesToLevel(profile.playMinutes)} · {profile.botXp} arcade XP (Lv.{arcadeLevel(profile.botXp)})
              </p>
              {profile.favoriteGames && <p className="mt-2 text-xs text-white/50">Plays: {profile.favoriteGames}</p>}
              {profile.bio && <p className="mt-3 rounded-xl border border-border bg-surface-2 p-3 text-sm break-words text-white/70">{profile.bio}</p>}
              {profile.joinedAt > 0 && <p className="mt-3 text-[11px] text-white/30">Joined {new Date(profile.joinedAt).toLocaleDateString()}</p>}
              {/* Email is never stored on the public profile doc — only shown here when it's your own card, sourced from your own auth session. */}
              {user && user.uid === userId && user.email && <p className="text-[11px] text-white/30">{user.email}</p>}
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
      </div>
    </div>,
    document.body,
  );
}
