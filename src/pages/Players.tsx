import { useEffect, useState } from "react";
import { HardHat, Mic, ShieldOff, UserPlus, Users } from "lucide-react";
import { useAuth } from "../context/AuthContext";
import { banPlayer, deletePlayer, getPresenceStatus, subscribeToAllProfiles, unbanPlayer } from "../lib/profiles";
import { sendPublicMessage } from "../lib/chat";
import { sendFriendRequest, subscribeToMyFriendRequests } from "../lib/friends";
import { isStaffRole, setSiteRole, setVoiceUnlocked, subscribeToStaffRoles } from "../lib/moderation";
import { grantRank, minutesToLevel, rankNameClass, RANK_LABEL, RANK_ORDER, revokeRank } from "../lib/ranks";
import { grantBuildHelp } from "../lib/builders";
import { useNow } from "../hooks/useNow";
import type { FriendRequest, Rank, SiteRole, UserProfile } from "../types";
import RankBadge from "../components/RankBadge";
import StatusDot from "../components/StatusDot";
import Button from "../components/Button";
import ProfileCard from "../components/ProfileCard";

export default function Players() {
  useNow();
  const { user, role } = useAuth();
  const [players, setPlayers] = useState<UserProfile[]>([]);
  const [pending, setPending] = useState<string | null>(null);
  const [openProfileId, setOpenProfileId] = useState<string | null>(null);
  const [sent, setSent] = useState<FriendRequest[]>([]);
  const [received, setReceived] = useState<FriendRequest[]>([]);
  const [ownerUid, setOwnerUid] = useState<string | null>(null);
  const [siteRoles, setSiteRoles] = useState<Map<string, SiteRole>>(new Map());
  const isStaff = isStaffRole(role);
  const isOwner = role === "owner";

  useEffect(() => subscribeToAllProfiles(setPlayers), []);
  useEffect(() => subscribeToStaffRoles((staff) => {
    setOwnerUid(staff.find((item) => item.role === "owner")?.id ?? null);
    setSiteRoles(new Map(staff.map((item) => [item.id, item.role])));
  }), []);
  useEffect(() => {
    if (!user) return;
    return subscribeToMyFriendRequests(user.uid, (s, r) => {
      setSent(s);
      setReceived(r);
    });
  }, [user]);

  function friendStatus(otherId: string) {
    if (sent.some((r) => r.toId === otherId && r.status === "accepted")) return "friends";
    if (received.some((r) => r.fromId === otherId && r.status === "accepted")) return "friends";
    if (sent.some((r) => r.toId === otherId && r.status === "pending")) return "sent";
    if (received.some((r) => r.fromId === otherId && r.status === "pending")) return "received";
    return "none";
  }

  async function addFriend(target: UserProfile) {
    if (!user) return;
    setPending(target.id);
    try {
      await sendFriendRequest(user.uid, user.displayName ?? "Player", user.photoURL ?? "", target.id, target.displayName, target.photoUrl);
    } finally {
      setPending(null);
    }
  }

  async function handleGrant(userId: string, rank: Rank) {
    setPending(userId);
    try {
      await grantRank(userId, rank);
    } finally {
      setPending(null);
    }
  }

  async function handleRevoke(userId: string) {
    setPending(userId);
    try {
      await revokeRank(userId);
    } finally {
      setPending(null);
    }
  }

  async function handleBuildHelp(userId: string) {
    setPending(userId);
    try {
      await grantBuildHelp(userId, 500);
    } finally {
      setPending(null);
    }
  }

  async function handleSiteRole(userId: string, displayName: string, nextRole: Exclude<SiteRole, "owner">) {
    setPending(userId);
    try {
      await setSiteRole(userId, nextRole);
      // Head Mod is a promotion for a mod doing a good job — worth a public
      // shout-out, unlike the other (silent) role changes here. Firestore
      // rules require a bot message's authorId to match whoever's actually
      // calling this (the owner), not the promoted player.
      if (nextRole === "headmod" && user) {
        void sendPublicMessage(user.uid, "eduBot", `🎉 ${displayName} has been promoted to Head Moderator! Give them a shout out.`, "none", { isBot: true }).catch(() => {});
      }
    } finally {
      setPending(null);
    }
  }

  async function handleVoiceUnlock(userId: string, value: boolean) {
    setPending(userId);
    try {
      await setVoiceUnlocked(userId, value);
    } finally {
      setPending(null);
    }
  }

  async function handleDelete(userId: string, displayName: string) {
    if (userId === user?.uid) return;
    if (!confirm(`Permanently delete ${displayName}'s profile, rank, level and credits? This cannot be undone.`)) return;
    setPending(userId);
    try {
      await deletePlayer(userId);
    } finally {
      setPending(null);
    }
  }

  async function handleBanToggle(userId: string, banned: boolean) {
    if (userId === user?.uid) return;
    setPending(userId);
    try {
      await (banned ? unbanPlayer(userId) : banPlayer(userId));
    } finally {
      setPending(null);
    }
  }

  return (
    <div className="mx-auto max-w-4xl px-6 py-14">
      <div className="flex items-center gap-3">
        <Users size={26} className="text-brand-400" />
        <div>
          <h1 className="font-mono text-2xl font-bold text-white">Players</h1>
          <p className="text-sm text-white/45">{players.length} registered players</p>
        </div>
      </div>

      <div className="mt-8 space-y-3">
        {players.map((player) => (
          <article key={player.id} className={`rounded-2xl border p-5 ${player.banned ? "border-red-500/30 bg-red-500/[.04]" : "border-border bg-surface"}`}>
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <div onClick={() => setOpenProfileId(player.id)} className="cursor-target relative shrink-0 cursor-pointer">
                  {player.photoUrl ? (
                    <img src={player.photoUrl} alt="" className="h-10 w-10 rounded-xl object-cover" />
                  ) : (
                    <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-cyan-400 to-fuchsia-500 font-mono text-sm font-bold text-white">
                      {player.displayName.slice(0, 1).toUpperCase()}
                    </div>
                  )}
                  <StatusDot status={getPresenceStatus(player)} className="absolute -bottom-0.5 -right-0.5" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span
                      onClick={() => setOpenProfileId(player.id)}
                      className={`cursor-target cursor-pointer font-mono font-semibold ${rankNameClass(player.rank)}`}
                    >
                      {player.displayName}
                    </span>
                    <RankBadge rank={player.rank} />
                    {siteRoles.get(player.id) === "dabug" && <span className="rounded-full border border-fuchsia-400/35 bg-fuchsia-400/10 px-2 py-0.5 font-mono text-[10px] font-bold text-fuchsia-200">DABUG</span>}
                    {siteRoles.get(player.id) === "headmod" && <span className="headmod-card-glow rounded-full border border-white/20 bg-black/20 px-2 py-0.5 font-mono text-[10px] font-bold"><span className="text-chroma">HEAD MOD</span></span>}
                    {siteRoles.get(player.id) === "moderator" && <span className="rounded-full border border-sky-400/35 bg-sky-400/10 px-2 py-0.5 font-mono text-[10px] font-bold text-sky-200">MOD</span>}
                    {siteRoles.get(player.id) === "actor" && <span className="rounded-full border border-orange-400/35 bg-orange-400/10 px-2 py-0.5 font-mono text-[10px] font-bold text-orange-200">ACTOR</span>}
                    {player.banned && <span className="rounded-full border border-red-500/40 px-2 py-0.5 text-[11px] text-red-300">Banned</span>}
                  </div>
                  <p className="text-xs text-white/40">Level {minutesToLevel(player.playMinutes)} · joined {new Date(player.joinedAt).toLocaleDateString()}</p>
                  {player.activityGame && <p className="text-xs text-emerald-300/80">Playing {player.activityGame}</p>}
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                {user && player.id !== user.uid && friendStatus(player.id) === "none" && (
                  <Button size="sm" variant="secondary" disabled={pending === player.id} onClick={() => addFriend(player)}>
                    <UserPlus size={13} /> Add friend
                  </Button>
                )}
                {user && player.id !== user.uid && friendStatus(player.id) === "sent" && (
                  <span className="text-xs text-white/30">Friend request sent</span>
                )}
                {user && player.id !== user.uid && friendStatus(player.id) === "friends" && (
                  <span className="text-xs text-emerald-300">Friends</span>
                )}
              </div>

              {isStaff && (
                <div className="flex flex-wrap items-center gap-2">
                  <select
                    disabled={pending === player.id}
                    defaultValue=""
                    onChange={(e) => {
                      if (e.target.value) void handleGrant(player.id, e.target.value as Rank);
                      e.target.value = "";
                    }}
                    className="cursor-target rounded-lg border border-border bg-surface-2 px-2 py-1.5 text-xs text-white"
                  >
                    <option value="" disabled>Give rank...</option>
                    {RANK_ORDER.filter((r) => r !== "none").map((r) => (
                      <option key={r} value={r}>{RANK_LABEL[r]}</option>
                    ))}
                  </select>
                  <Button size="sm" variant="ghost" disabled={pending === player.id || (player.rank ?? "none") === "none"} onClick={() => handleRevoke(player.id)}>
                    Revoke rank
                  </Button>
                  <Button size="sm" variant="secondary" disabled={pending === player.id} onClick={() => handleBuildHelp(player.id)}>
                    <HardHat size={13} /> +500 Build Help
                  </Button>
                  {player.id !== ownerUid && (
                    <Button
                      size="sm"
                      variant={player.banned ? "secondary" : "danger"}
                      disabled={pending === player.id || player.id === user?.uid}
                      onClick={() => handleBanToggle(player.id, !!player.banned)}
                    >
                      <ShieldOff size={13} /> {player.banned ? "Unban" : "Ban"}
                    </Button>
                  )}
                  {isOwner && (
                    <>
                      {player.id !== ownerUid && <select
                        value={siteRoles.get(player.id) ?? "member"}
                        disabled={pending === player.id}
                        onChange={(event) => void handleSiteRole(player.id, player.displayName, event.target.value as Exclude<SiteRole, "owner">)}
                        aria-label={`Site role for ${player.displayName}`}
                        className="cursor-target rounded-lg border border-fuchsia-400/20 bg-surface-2 px-2 py-1.5 font-mono text-xs text-white"
                      >
                        <option value="member">Member</option>
                        <option value="dabug">Dabug</option>
                        <option value="moderator">Moderator</option>
                        <option value="headmod">Head Mod</option>
                        <option value="actor">Actor</option>
                      </select>}
                      <Button
                        size="sm"
                        variant={player.voiceUnlocked ? "secondary" : "ghost"}
                        disabled={pending === player.id}
                        onClick={() => handleVoiceUnlock(player.id, !player.voiceUnlocked)}
                        title="Invisible — only you can see or toggle this"
                      >
                        <Mic size={13} /> {player.voiceUnlocked ? "Voice changer: on" : "Voice changer: off"}
                      </Button>
                      <Button size="sm" variant="danger" disabled={pending === player.id || player.id === user?.uid} onClick={() => handleDelete(player.id, player.displayName)}>
                        Delete
                      </Button>
                    </>
                  )}
                </div>
              )}
            </div>
          </article>
        ))}
      </div>
      {openProfileId && <ProfileCard userId={openProfileId} onClose={() => setOpenProfileId(null)} />}
    </div>
  );
}
