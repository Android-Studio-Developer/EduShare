import { useEffect, useMemo, useState } from "react";
import { Check, MessageSquare, Search, UserPlus, UserX, Users } from "lucide-react";
import { useAuth } from "../context/AuthContext";
import { acceptFriendRequest, declineFriendRequest, removeFriendRequest, sendFriendRequest, subscribeToMyFriendRequests } from "../lib/friends";
import { isOnline, subscribeToAllProfiles } from "../lib/profiles";
import { rankNameClass } from "../lib/ranks";
import { useNow } from "../hooks/useNow";
import type { FriendRequest, UserProfile } from "../types";
import StatusDot from "../components/StatusDot";
import Button from "../components/Button";
import ProfileCard from "../components/ProfileCard";
import DmThread from "../components/DmThread";

function Row({ photoUrl, name, onClick }: { photoUrl: string; name: string; onClick?: () => void }) {
  return photoUrl ? (
    <img src={photoUrl} alt="" onClick={onClick} className={`h-9 w-9 shrink-0 rounded-xl object-cover ${onClick ? "cursor-target cursor-pointer" : ""}`} />
  ) : (
    <div onClick={onClick} className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-cyan-400 to-fuchsia-500 font-mono text-xs font-bold text-white ${onClick ? "cursor-target cursor-pointer" : ""}`}>
      {name.slice(0, 1).toUpperCase()}
    </div>
  );
}

export default function Friends() {
  useNow();
  const { user } = useAuth();
  const [profiles, setProfiles] = useState<UserProfile[]>([]);
  const [sent, setSent] = useState<FriendRequest[]>([]);
  const [received, setReceived] = useState<FriendRequest[]>([]);
  const [search, setSearch] = useState("");
  const [pending, setPending] = useState<string | null>(null);
  const [openProfileId, setOpenProfileId] = useState<string | null>(null);
  const [dmTarget, setDmTarget] = useState<{ id: string; name: string; photoUrl: string } | null>(null);

  useEffect(() => subscribeToAllProfiles(setProfiles), []);
  useEffect(() => {
    if (!user) return;
    return subscribeToMyFriendRequests(user.uid, (s, r) => {
      setSent(s);
      setReceived(r);
    });
  }, [user]);

  const profileById = useMemo(() => new Map(profiles.map((p) => [p.id, p])), [profiles]);

  const friends = useMemo(
    () => [...sent, ...received].filter((r) => r.status === "accepted"),
    [sent, received],
  );
  const pendingReceived = received.filter((r) => r.status === "pending");
  const pendingSent = sent.filter((r) => r.status === "pending");

  const results = useMemo(() => {
    if (!user || !search.trim()) return [];
    const q = search.trim().toLowerCase();
    return profiles.filter((p) => p.id !== user.uid && p.displayName.toLowerCase().includes(q)).slice(0, 15);
  }, [profiles, search, user]);

  function statusFor(otherId: string): "friends" | "sent" | "received" | "none" {
    if (friends.some((f) => f.fromId === otherId || f.toId === otherId)) return "friends";
    if (pendingSent.some((r) => r.toId === otherId)) return "sent";
    if (pendingReceived.some((r) => r.fromId === otherId)) return "received";
    return "none";
  }

  async function add(target: UserProfile) {
    if (!user) return;
    setPending(target.id);
    try {
      await sendFriendRequest(user.uid, user.displayName ?? "Player", user.photoURL ?? "", target.id, target.displayName, target.photoUrl);
    } finally {
      setPending(null);
    }
  }

  async function respond(id: string, accept: boolean) {
    setPending(id);
    try {
      await (accept ? acceptFriendRequest(id) : declineFriendRequest(id));
    } finally {
      setPending(null);
    }
  }

  async function remove(id: string) {
    setPending(id);
    try {
      await removeFriendRequest(id);
    } finally {
      setPending(null);
    }
  }

  return (
    <div className="mx-auto max-w-2xl px-6 py-14">
      <div className="flex items-center gap-3">
        <Users size={26} className="text-brand-400" />
        <div>
          <h1 className="font-mono text-2xl font-bold text-white">Friends</h1>
          <p className="text-sm text-white/45">{friends.length} friends</p>
        </div>
      </div>

      <div className="mt-6 rounded-2xl border border-border bg-surface p-5">
        <div className="flex items-center gap-2 rounded-xl border border-border bg-surface-2 px-3 py-2">
          <Search size={15} className="text-white/30" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search players by name..."
            className="w-full bg-transparent text-sm text-white placeholder:text-white/30 focus:outline-none"
          />
        </div>
        {results.length > 0 && (
          <div className="mt-3 space-y-2">
            {results.map((p) => {
              const status = statusFor(p.id);
              return (
                <div key={p.id} className="flex items-center gap-3">
                  <Row photoUrl={p.photoUrl} name={p.displayName} onClick={() => setOpenProfileId(p.id)} />
                  <span
                    onClick={() => setOpenProfileId(p.id)}
                    className={`cursor-target min-w-0 flex-1 cursor-pointer truncate text-sm font-medium ${rankNameClass(p.rank)}`}
                  >
                    {p.displayName}
                  </span>
                  {status === "friends" && <span className="text-xs text-white/30">Friends</span>}
                  {status === "sent" && <span className="text-xs text-white/30">Request sent</span>}
                  {status === "received" && <span className="text-xs text-white/30">Check requests below</span>}
                  {status === "none" && (
                    <Button size="sm" disabled={pending === p.id} onClick={() => add(p)}>
                      <UserPlus size={13} /> Add
                    </Button>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {pendingReceived.length > 0 && (
        <div className="mt-6">
          <h2 className="font-mono text-sm font-semibold text-white/60">Requests received</h2>
          <div className="mt-3 space-y-2">
            {pendingReceived.map((r) => (
              <div key={r.id} className="flex items-center gap-3 rounded-2xl border border-border bg-surface p-4">
                <Row photoUrl={r.fromPhotoUrl} name={r.fromName} />
                <span className="min-w-0 flex-1 truncate text-sm font-medium text-white">{r.fromName}</span>
                <Button size="sm" disabled={pending === r.id} onClick={() => respond(r.id, true)}>
                  <Check size={13} /> Accept
                </Button>
                <Button size="sm" variant="ghost" disabled={pending === r.id} onClick={() => respond(r.id, false)}>
                  <UserX size={13} />
                </Button>
              </div>
            ))}
          </div>
        </div>
      )}

      {pendingSent.length > 0 && (
        <div className="mt-6">
          <h2 className="font-mono text-sm font-semibold text-white/60">Requests sent</h2>
          <div className="mt-3 space-y-2">
            {pendingSent.map((r) => (
              <div key={r.id} className="flex items-center gap-3 rounded-2xl border border-border bg-surface p-4">
                <Row photoUrl={r.toPhotoUrl} name={r.toName} />
                <span className="min-w-0 flex-1 truncate text-sm font-medium text-white">{r.toName}</span>
                <Button size="sm" variant="ghost" disabled={pending === r.id} onClick={() => remove(r.id)}>
                  Cancel
                </Button>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="mt-8">
        <h2 className="font-mono text-sm font-semibold text-white/60">Your friends</h2>
        <div className="mt-3 space-y-2">
          {friends.length === 0 && <p className="text-sm text-white/30">No friends yet — search above to add some.</p>}
          {friends.map((f) => {
            const otherId = f.fromId === user?.uid ? f.toId : f.fromId;
            const otherName = f.fromId === user?.uid ? f.toName : f.fromName;
            const otherPhoto = f.fromId === user?.uid ? f.toPhotoUrl : f.fromPhotoUrl;
            const otherProfile = profileById.get(otherId);
            return (
              <div key={f.id} className="flex items-center gap-3 rounded-2xl border border-border bg-surface p-4">
                <div className="relative shrink-0">
                  <Row photoUrl={otherProfile?.photoUrl ?? otherPhoto} name={otherName} onClick={() => setOpenProfileId(otherId)} />
                  <StatusDot online={isOnline(otherProfile)} className="absolute -bottom-0.5 -right-0.5" />
                </div>
                <span
                  onClick={() => setOpenProfileId(otherId)}
                  className={`cursor-target min-w-0 flex-1 cursor-pointer truncate text-sm font-medium ${rankNameClass(otherProfile?.rank)}`}
                >
                  {otherName}
                </span>
                <Button size="sm" variant="secondary" onClick={() => setDmTarget({ id: otherId, name: otherName, photoUrl: otherProfile?.photoUrl ?? otherPhoto })}>
                  <MessageSquare size={13} /> Message
                </Button>
                <Button size="sm" variant="ghost" disabled={pending === f.id} onClick={() => remove(f.id)}>
                  <UserX size={13} /> Remove
                </Button>
              </div>
            );
          })}
        </div>
      </div>
      {openProfileId && <ProfileCard userId={openProfileId} onClose={() => setOpenProfileId(null)} />}
      {dmTarget && <DmThread otherId={dmTarget.id} otherName={dmTarget.name} otherPhotoUrl={dmTarget.photoUrl} onClose={() => setDmTarget(null)} />}
    </div>
  );
}
