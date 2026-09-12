import { useEffect, useMemo, useState, type FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import { Check, MessageSquare, Search, UserPlus, UserX, Users } from "lucide-react";
import { useAuth } from "../context/AuthContext";
import { acceptFriendRequest, declineFriendRequest, removeFriendRequest, sendFriendRequest, subscribeToMyFriendRequests } from "../lib/friends";
import { getPresenceStatus, subscribeToAllProfiles, type EffectivePresence } from "../lib/profiles";
import { rankNameClass } from "../lib/ranks";
import { useNow } from "../hooks/useNow";
import type { FriendRequest, UserProfile } from "../types";
import StatusDot from "../components/StatusDot";
import Button from "../components/Button";
import ProfileCard from "../components/ProfileCard";

const PRESENCE_LABEL: Record<EffectivePresence, string> = {
  online: "Online",
  idle: "Idle",
  dnd: "Do Not Disturb",
  invisible: "Offline",
  offline: "Offline",
};

type Tab = "online" | "all" | "pending" | "add";

function Avatar({ photoUrl, name, size = 32 }: { photoUrl: string; name: string; size?: number }) {
  const style = { width: size, height: size };
  return photoUrl ? (
    <img src={photoUrl} alt="" style={style} className="shrink-0 rounded-full object-cover" />
  ) : (
    <div style={style} className="flex shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-cyan-400 to-fuchsia-500 font-mono text-xs font-bold text-white">
      {name.slice(0, 1).toUpperCase()}
    </div>
  );
}

function ActionButton({ title, onClick, disabled, danger, children }: { title: string; onClick: () => void; disabled?: boolean; danger?: boolean; children: React.ReactNode }) {
  return (
    <button
      type="button"
      title={title}
      aria-label={title}
      onClick={onClick}
      disabled={disabled}
      className={`cursor-target grid h-9 w-9 shrink-0 place-items-center rounded-full bg-white/[.06] text-white/60 transition-colors hover:text-white disabled:opacity-40 ${danger ? "hover:bg-red-500/20 hover:text-red-300" : "hover:bg-white/[.12]"}`}
    >
      {children}
    </button>
  );
}

export default function Friends() {
  useNow();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [profiles, setProfiles] = useState<UserProfile[]>([]);
  const [sent, setSent] = useState<FriendRequest[]>([]);
  const [received, setReceived] = useState<FriendRequest[]>([]);
  const [search, setSearch] = useState("");
  const [tab, setTab] = useState<Tab>("online");
  const [pending, setPending] = useState<string | null>(null);
  const [openProfileId, setOpenProfileId] = useState<string | null>(null);

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
  const pendingCount = pendingReceived.length + pendingSent.length;

  const friendRows = useMemo(() => {
    return friends
      .map((f) => {
        const otherId = f.fromId === user?.uid ? f.toId : f.fromId;
        const otherName = f.fromId === user?.uid ? f.toName : f.fromName;
        const otherPhoto = f.fromId === user?.uid ? f.toPhotoUrl : f.fromPhotoUrl;
        const otherProfile = profileById.get(otherId);
        const status = getPresenceStatus(otherProfile);
        return { requestId: f.id, otherId, otherName, otherPhoto: otherProfile?.photoUrl ?? otherPhoto, otherProfile, status };
      })
      .sort((a, b) => a.otherName.localeCompare(b.otherName));
  }, [friends, profileById, user]);

  const onlineRows = friendRows.filter((r) => r.status === "online" || r.status === "idle" || r.status === "dnd");
  const offlineRows = friendRows.filter((r) => r.status === "offline" || r.status === "invisible");

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

  function handleAddSubmit(e: FormEvent) {
    e.preventDefault();
    const match = results.find((p) => statusFor(p.id) === "none");
    if (match) void add(match);
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

  function FriendRow({ row }: { row: (typeof friendRows)[number] }) {
    return (
      <div className="group flex items-center gap-3 rounded-lg px-3 py-2.5 hover:bg-white/[.04]">
        <div className="relative shrink-0">
          <Avatar photoUrl={row.otherPhoto} name={row.otherName} />
          <StatusDot status={row.status} className="absolute -bottom-0.5 -right-0.5" />
        </div>
        <button type="button" onClick={() => setOpenProfileId(row.otherId)} className="cursor-target min-w-0 flex-1 text-left">
          <p className={`truncate text-sm font-semibold ${rankNameClass(row.otherProfile?.rank)}`}>{row.otherName}</p>
          <p className="truncate text-xs text-white/35">
            {row.otherProfile?.activityGame ? <span className="text-emerald-300/80">Playing {row.otherProfile.activityGame}</span> : PRESENCE_LABEL[row.status]}
          </p>
        </button>
        <div className="flex shrink-0 items-center gap-2 opacity-0 transition-opacity group-hover:opacity-100">
          <ActionButton title="Message" onClick={() => navigate(`/messages/${row.otherId}`)}>
            <MessageSquare size={16} />
          </ActionButton>
          <ActionButton title="Remove friend" danger disabled={pending === row.requestId} onClick={() => void remove(row.requestId)}>
            <UserX size={16} />
          </ActionButton>
        </div>
      </div>
    );
  }

  const tabs: { id: Tab; label: string; count?: number }[] = [
    { id: "online", label: "Online" },
    { id: "all", label: "All" },
    { id: "pending", label: "Pending", count: pendingCount },
    { id: "add", label: "Add Friend" },
  ];

  return (
    <div className="mx-auto max-w-3xl px-6 py-14">
      <div className="flex items-center gap-3">
        <Users size={22} className="text-brand-400" />
        <h1 className="font-mono text-xl font-bold text-white">Friends</h1>
      </div>

      <div className="mt-5 flex flex-wrap items-center gap-1.5 border-b border-border pb-4">
        {tabs.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setTab(t.id)}
            className={`cursor-target flex items-center gap-1.5 rounded-full px-3.5 py-1.5 text-sm font-medium transition-colors ${
              tab === t.id ? "bg-brand-500/15 text-brand-200" : "text-white/55 hover:bg-white/[.06] hover:text-white"
            } ${t.id === "add" ? "ml-auto bg-emerald-500 !text-white hover:bg-emerald-400" : ""}`}
          >
            {t.label}
            {!!t.count && <span className="rounded-full bg-red-500 px-1.5 py-0.5 text-[10px] font-bold leading-none text-white">{t.count}</span>}
          </button>
        ))}
      </div>

      {tab === "add" && (
        <div className="mt-5 rounded-2xl border border-border bg-surface p-5">
          <h2 className="font-mono text-sm font-bold uppercase tracking-wide text-white">Add Friend</h2>
          <p className="mt-1 text-xs text-white/40">You can add a player by their display name.</p>
          <form onSubmit={handleAddSubmit} className="mt-3 flex items-center gap-2 rounded-xl border border-border bg-surface-2 px-3 py-2 focus-within:border-brand-400/50">
            <Search size={15} className="shrink-0 text-white/30" />
            <input
              autoFocus
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by display name…"
              className="w-full bg-transparent text-sm text-white placeholder:text-white/30 focus:outline-none"
            />
          </form>

          <div className="mt-4 space-y-1">
            {search.trim() && results.length === 0 && <p className="py-6 text-center text-xs text-white/25">No players match "{search.trim()}".</p>}
            {results.map((p) => {
              const status = statusFor(p.id);
              return (
                <div key={p.id} className="flex items-center gap-3 rounded-lg px-2 py-2 hover:bg-white/[.04]">
                  <Avatar photoUrl={p.photoUrl} name={p.displayName} />
                  <button type="button" onClick={() => setOpenProfileId(p.id)} className={`cursor-target min-w-0 flex-1 truncate text-left text-sm font-medium ${rankNameClass(p.rank)}`}>
                    {p.displayName}
                  </button>
                  {status === "friends" && <span className="text-xs text-white/30">Already friends</span>}
                  {status === "sent" && <span className="text-xs text-white/30">Request sent</span>}
                  {status === "received" && <span className="text-xs text-white/30">Check Pending tab</span>}
                  {status === "none" && (
                    <Button size="sm" disabled={pending === p.id} onClick={() => add(p)}>
                      <UserPlus size={13} /> Send Friend Request
                    </Button>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {tab === "pending" && (
        <div className="mt-4">
          {pendingCount === 0 && <p className="py-16 text-center text-sm text-white/30">No pending requests.</p>}
          {pendingReceived.map((r) => (
            <div key={r.id} className="flex items-center gap-3 rounded-lg px-3 py-2.5 hover:bg-white/[.04]">
              <Avatar photoUrl={r.fromPhotoUrl} name={r.fromName} />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold text-white">{r.fromName}</p>
                <p className="text-xs text-white/35">Incoming Friend Request</p>
              </div>
              <ActionButton title="Accept" disabled={pending === r.id} onClick={() => void respond(r.id, true)}>
                <Check size={17} />
              </ActionButton>
              <ActionButton title="Decline" danger disabled={pending === r.id} onClick={() => void respond(r.id, false)}>
                <UserX size={17} />
              </ActionButton>
            </div>
          ))}
          {pendingSent.map((r) => (
            <div key={r.id} className="flex items-center gap-3 rounded-lg px-3 py-2.5 hover:bg-white/[.04]">
              <Avatar photoUrl={r.toPhotoUrl} name={r.toName} />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold text-white">{r.toName}</p>
                <p className="text-xs text-white/35">Outgoing Friend Request</p>
              </div>
              <ActionButton title="Cancel" danger disabled={pending === r.id} onClick={() => void remove(r.id)}>
                <UserX size={17} />
              </ActionButton>
            </div>
          ))}
        </div>
      )}

      {(tab === "online" || tab === "all") && (
        <div className="mt-4">
          <p className="mb-1.5 px-3 text-xs font-bold uppercase tracking-wide text-white/35">
            {tab === "online" ? `Online — ${onlineRows.length}` : `All Friends — ${friendRows.length}`}
          </p>
          {(tab === "online" ? onlineRows : friendRows).length === 0 && tab === "online" && (
            <p className="py-16 text-center text-sm text-white/30">No one's online right now.</p>
          )}
          {tab === "online" && onlineRows.map((row) => <FriendRow key={row.requestId} row={row} />)}

          {tab === "all" && (
            <>
              {friendRows.length === 0 && <p className="py-16 text-center text-sm text-white/30">No friends yet — use Add Friend above.</p>}
              {onlineRows.map((row) => <FriendRow key={row.requestId} row={row} />)}
              {offlineRows.length > 0 && (
                <>
                  <p className="mb-1.5 mt-4 px-3 text-xs font-bold uppercase tracking-wide text-white/35">Offline — {offlineRows.length}</p>
                  {offlineRows.map((row) => <FriendRow key={row.requestId} row={row} />)}
                </>
              )}
            </>
          )}
        </div>
      )}

      {openProfileId && <ProfileCard userId={openProfileId} onClose={() => setOpenProfileId(null)} />}
    </div>
  );
}
