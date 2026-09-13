import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import { Radio, Server, Users } from "lucide-react";
import { useAuth } from "../context/AuthContext";
import { subscribeToCommunityChatServerByInviteCode, joinCommunityChatServer } from "../lib/communityChatServers";
import { subscribeToAllProfiles, isOnline } from "../lib/profiles";
import type { CommunityChatServer, UserProfile } from "../types";

function safeText(value: unknown, fallback = "") {
  return typeof value === "string" && value.trim() ? value : fallback;
}

function initial(value: unknown, fallback = "S") {
  return safeText(value, fallback).slice(0, 1).toUpperCase();
}

export default function InviteLanding() {
  const { code = "" } = useParams();
  const [searchParams] = useSearchParams();
  const from = searchParams.get("from") ?? "";
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();
  const [server, setServer] = useState<CommunityChatServer | null>(null);
  const [profiles, setProfiles] = useState<UserProfile[]>([]);
  const [ready, setReady] = useState(false);
  const [joining, setJoining] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (authLoading || !code.trim()) return undefined;
    setReady(false);
    setError("");
    const unsubscribe = subscribeToCommunityChatServerByInviteCode(code, !!user, (item) => {
      setServer(item);
      setReady(true);
    }, (cause) => {
      console.error("Could not open server invite:", cause);
      setServer(null);
      setReady(true);
      setError("This invite could not be opened. Please ask for a new link.");
    });
    return typeof unsubscribe === "function" ? unsubscribe : undefined;
  }, [authLoading, code, user]);
  useEffect(() => {
    const unsubscribe = subscribeToAllProfiles(setProfiles);
    return typeof unsubscribe === "function" ? unsubscribe : undefined;
  }, []);

  const memberIds = useMemo(() => (server ? [...new Set([server.ownerId, ...(server.memberIds ?? [])])] : []), [server]);
  const onlineCount = useMemo(() => profiles.filter((profile) => memberIds.includes(profile.id) && isOnline(profile)).length, [profiles, memberIds]);

  async function handleJoin() {
    if (!server || !user) return;
    setJoining(true);
    setError("");
    try {
      if (server.bannedUserIds?.includes(user.uid)) { setError("You are banned from that server."); return; }
      if (!server.memberIds?.includes(user.uid)) await joinCommunityChatServer(server.id, user.uid);
      navigate(`/chat-servers/${server.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not join this server.");
    } finally {
      setJoining(false);
    }
  }

  return (
    <div className="fixed inset-0 z-40 grid place-items-center overflow-hidden bg-[#050810] p-4">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_30%_20%,rgba(88,101,242,.35),transparent_55%),radial-gradient(circle_at_75%_75%,rgba(88,101,242,.18),transparent_45%)]" />
      <div className="relative w-full max-w-sm rounded-2xl border border-white/10 bg-[#17191f] p-6 text-center shadow-2xl">
        {!ready ? (
          <p className="py-10 text-sm text-white/40">Loading invite…</p>
        ) : !server ? (
          <>
            <span className="mx-auto grid h-16 w-16 place-items-center rounded-full bg-white/[.06] text-white/25"><Server size={28}/></span>
            <h1 className="mt-4 text-lg font-bold text-white">Invite invalid</h1>
            <p className="mt-2 text-sm text-white/40">{error || "This invite link doesn't lead anywhere, or the server was deleted."}</p>
            <button type="button" onClick={() => navigate("/chat-servers")} className="cursor-target mt-5 w-full rounded-lg bg-[#5865f2] px-4 py-2.5 text-sm font-bold text-white hover:bg-[#4752c4]">Browse servers</button>
          </>
        ) : (
          <>
            <p className="text-xs text-white/40">{from ? <>{from} invited you to:</> : "You've been invited to:"}</p>
            <span className="mx-auto mt-3 grid h-20 w-20 place-items-center overflow-hidden rounded-2xl bg-[#1e1f22] text-2xl font-black text-white shadow-lg">
              {server.iconUrl ? <img src={server.iconUrl} alt="" className="h-full w-full object-cover"/> : initial(server.name)}
            </span>
            <h1 className="mt-4 text-xl font-black text-white">{safeText(server.name, "Server")}</h1>
            <p className="mt-1 line-clamp-2 text-xs leading-5 text-white/40">{safeText(server.description, "No description yet.")}</p>
            <div className="mt-3 flex items-center justify-center gap-4 text-xs text-white/45">
              <span className="flex items-center gap-1.5"><i className="h-2 w-2 rounded-full bg-emerald-400"/><Radio size={11} className="text-emerald-300"/>{onlineCount.toLocaleString()} online</span>
              <span className="flex items-center gap-1.5"><Users size={12}/>{memberIds.length.toLocaleString()} members</span>
            </div>
            {error && <p className="mt-3 rounded-lg bg-red-500/10 px-3 py-2 text-xs text-red-300">{error}</p>}
            <button
              type="button"
              onClick={() => (user ? void handleJoin() : navigate("/login", { state: { from: { pathname: `/invite/${code}${from ? `?from=${encodeURIComponent(from)}` : ""}` } } }))}
              disabled={joining}
              className="cursor-target mt-5 w-full rounded-lg bg-[#5865f2] px-4 py-2.5 text-sm font-bold text-white hover:bg-[#4752c4] disabled:cursor-wait disabled:opacity-70"
            >
              {joining ? "Joining…" : user ? "Join server" : "Log in to join"}
            </button>
            <button type="button" onClick={() => navigate("/")} className="cursor-target mt-2 w-full rounded-lg px-4 py-2.5 text-xs font-semibold text-white/35 hover:text-white/60">Maybe later</button>
          </>
        )}
      </div>
    </div>
  );
}
