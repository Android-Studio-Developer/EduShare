import { useEffect, useMemo, useRef, useState } from "react";
import { Crown, Medal, ShieldCheck, Swords, Trophy, Users as UsersIcon } from "lucide-react";
import { useAuth } from "../context/AuthContext";
import { useVoiceCall } from "../context/VoiceCallContext";
import {
  approveBedwarsScore,
  BEDWARS_ROLES,
  BEDWARS_TIERS,
  bedwarsModeLabel,
  bedwarsModeTeamSize,
  bedwarsQueueChannelId,
  cancelBedwarsLobby,
  ensureBedwarsQueueChannel,
  finalizeBedwarsMapVote,
  formatBedwarsRank,
  getBedwarsRank,
  joinBedwarsQueue,
  leaveBedwarsQueue,
  pickBedwarsRole,
  rejectBedwarsScore,
  startBedwarsMatch,
  submitBedwarsScore,
  subscribeToBedwarsQueue,
  subscribeToBedwarsReviewQueue,
  subscribeToMyBedwarsLobby,
  tryFormBedwarsMatch,
  voteBedwarsMap,
} from "../lib/bedwarsRanked";
import { isStaffRole } from "../lib/moderation";
import { subscribeToAllProfiles, subscribeToProfile, updateGameActivity } from "../lib/profiles";
import type { BedwarsLobby, BedwarsMode, BedwarsQueueEntry, BedwarsTeam, UserProfile } from "../types";
import Button from "../components/Button";
import ProfileCard from "../components/ProfileCard";
import LazyYoutubeEmbed from "../components/LazyYoutubeEmbed";
import VoiceControlBar from "../components/VoiceControlBar";

const TIER_COLOR: Record<(typeof BEDWARS_TIERS)[number], string> = {
  Bronze: "border-orange-700/40 bg-orange-900/20 text-orange-300",
  Silver: "border-slate-400/40 bg-slate-500/15 text-slate-200",
  Gold: "border-yellow-500/40 bg-yellow-500/15 text-yellow-300",
  Platinum: "border-cyan-400/40 bg-cyan-500/15 text-cyan-300",
  Diamond: "border-sky-400/40 bg-sky-500/15 text-sky-300",
  Master: "border-fuchsia-400/40 bg-fuchsia-500/15 text-fuchsia-300",
};

const ACTIVE_STATUSES: BedwarsLobby["status"][] = ["voting", "role_select", "in_progress", "awaiting_review"];

function RankBadge({ rating }: { rating: number }) {
  const { tier } = getBedwarsRank(rating);
  return (
    <span className={`rounded-full border px-2.5 py-1 font-mono text-[11px] font-semibold ${TIER_COLOR[tier]}`}>
      {formatBedwarsRank(rating)}
    </span>
  );
}

function TeamRoster({ lobby, team }: { lobby: BedwarsLobby; team: BedwarsTeam }) {
  const players = lobby.players.filter((p) => p.team === team);
  return (
    <div className="flex-1 rounded-xl border border-border bg-surface-2 p-3">
      <p className="text-xs font-semibold uppercase tracking-wide text-white/50">Team {team.toUpperCase()}</p>
      <div className="mt-2 space-y-1.5">
        {players.map((p) => (
          <div key={p.uid} className="flex items-center justify-between gap-2 text-sm text-white/75">
            <span>{p.name}</span>
            <span className="font-mono text-[10px] text-white/35">{lobby.roles[p.uid] ?? "—"}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

export default function BedwarsRanked() {
  const { user, role } = useAuth();
  const { joinedChannelId, join, leave } = useVoiceCall();
  const isStaff = isStaffRole(role);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [profiles, setProfiles] = useState<UserProfile[]>([]);
  const [queueEntries, setQueueEntries] = useState<BedwarsQueueEntry[]>([]);
  const [inQueue, setInQueue] = useState(false);
  const [myLobbyCode, setMyLobbyCode] = useState("");
  const [queueMode, setQueueMode] = useState<BedwarsMode>("4v4");
  const [myQueueMode, setMyQueueMode] = useState<BedwarsMode>("4v4");
  const [lobbyCodeInput, setLobbyCodeInput] = useState("");
  const [lobby, setLobby] = useState<BedwarsLobby | null>(null);
  const [reviewQueue, setReviewQueue] = useState<BedwarsLobby[]>([]);
  const [error, setError] = useState("");

  const [scoreTeam, setScoreTeam] = useState<BedwarsTeam>("a");
  const [screenshotUrl, setScreenshotUrl] = useState("");
  const [topKillerId, setTopKillerId] = useState("");
  const [reviewChoice, setReviewChoice] = useState<Record<string, BedwarsTeam>>({});
  const [reviewKiller, setReviewKiller] = useState<Record<string, string>>({});
  const [openProfileId, setOpenProfileId] = useState<string | null>(null);
  const [tutorialSeen, setTutorialSeen] = useState(() => localStorage.getItem("edushare-bedwars-tutorial-seen") === "1");

  const matchingRef = useRef(false);

  useEffect(() => subscribeToAllProfiles(setProfiles), []);
  useEffect(() => {
    if (!user) return;
    return subscribeToProfile(user.uid, setProfile);
  }, [user]);
  useEffect(() => {
    if (!user) return;
    return subscribeToMyBedwarsLobby(user.uid, (lobbies) => {
      const active = lobbies.find((l) => ACTIVE_STATUSES.includes(l.status)) ?? null;
      setLobby(active);
    });
  }, [user]);

  // Discord-style automatic presence — tied to a real in-progress match, not
  // a manual toggle (that's what the Profile page's "Minecraft" switch is
  // for). Only clears it back off if we're the ones who set it, so this
  // can't stomp a manually-set "Minecraft" activity from that other toggle.
  const wasInLobbyRef = useRef(false);
  useEffect(() => {
    if (!user) return;
    const isActive = !!lobby;
    if (isActive && !wasInLobbyRef.current) {
      void updateGameActivity(user.uid, true, "Ranked Bedwars").catch(() => {});
    } else if (!isActive && wasInLobbyRef.current && profile?.activityGame === "Ranked Bedwars") {
      void updateGameActivity(user.uid, false).catch(() => {});
    }
    wasInLobbyRef.current = isActive;
  }, [lobby, user, profile?.activityGame]);
  useEffect(() => {
    if (!isStaff) return;
    return subscribeToBedwarsReviewQueue(setReviewQueue);
  }, [isStaff]);
  useEffect(() => {
    return subscribeToBedwarsQueue((entries) => {
      setQueueEntries(entries);
      if (!user) return;
      const mine = entries.find((e) => e.uid === user.uid);
      setInQueue(!!mine);
      setMyLobbyCode(mine?.lobbyCode ?? "");
      setMyQueueMode(mine?.mode ?? "4v4");
      if (!lobby && mine && !matchingRef.current) {
        matchingRef.current = true;
        void tryFormBedwarsMatch(mine.lobbyCode, mine.mode ?? "4v4", mine.uid, mine.displayName).finally(() => {
          matchingRef.current = false;
        });
      }
    });
  }, [user, lobby]);

  // Drop players into voice automatically: a shared room while queuing (so
  // everyone waiting can talk), then their own team's room once matched —
  // and back out of both once the match wraps up or they leave the queue.
  useEffect(() => {
    if (!user || !profile) return;
    const myTeam = lobby?.players.find((p) => p.uid === user.uid)?.team;
    const lobbyChannelId = myTeam === "a" ? lobby?.voiceChannelAId : myTeam === "b" ? lobby?.voiceChannelBId : "";
    const queueChannelId = !lobby && inQueue ? bedwarsQueueChannelId(myLobbyCode, myQueueMode) : "";
    const targetChannelId = lobbyChannelId || queueChannelId;
    if (targetChannelId && joinedChannelId !== targetChannelId) {
      void (async () => {
        if (queueChannelId && !lobbyChannelId) await ensureBedwarsQueueChannel(myLobbyCode, myQueueMode, user.uid, profile.displayName);
        await join(targetChannelId, { uid: user.uid, displayName: profile.displayName, photoUrl: profile.photoUrl, rank: profile.rank });
      })();
    } else if (!targetChannelId && joinedChannelId && joinedChannelId.startsWith("bw-")) {
      void leave();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lobby?.voiceChannelAId, lobby?.voiceChannelBId, lobby?.players, inQueue, myLobbyCode, myQueueMode, user, profile]);

  // Once all 8 have voted, resolve the map majority so the lobby moves on
  // without needing anyone to click an extra "finalize" button.
  useEffect(() => {
    if (!lobby || lobby.status !== "voting") return;
    const votes = Object.values(lobby.mapVotes);
    if (votes.length < lobby.players.length) return;
    const tally = new Map<string, number>();
    for (const v of votes) tally.set(v, (tally.get(v) ?? 0) + 1);
    const winner = [...tally.entries()].sort((a, b) => b[1] - a[1])[0][0];
    void finalizeBedwarsMapVote(lobby.id, winner);
  }, [lobby]);

  const myRating = profile?.bedwarsRating ?? 0;
  const myWins = profile?.bedwarsWins ?? 0;
  const myLosses = profile?.bedwarsLosses ?? 0;
  const activeQueueMode = inQueue ? myQueueMode : queueMode;
  const activeMatchSize = bedwarsModeTeamSize(activeQueueMode) * 2;

  const leaderboard = useMemo(
    () => [...profiles].filter((p) => (p.bedwarsWins ?? 0) + (p.bedwarsLosses ?? 0) > 0).sort((a, b) => (b.bedwarsRating ?? 0) - (a.bedwarsRating ?? 0)).slice(0, 20),
    [profiles],
  );

  const visibleQueue = useMemo(
    () => queueEntries.filter((e) => e.lobbyCode === myLobbyCode && (e.mode ?? "4v4") === activeQueueMode),
    [queueEntries, myLobbyCode, activeQueueMode],
  );

  async function handleJoinQueue(code: string) {
    if (!user || !profile) return;
    setError("");
    try {
      await joinBedwarsQueue(user.uid, profile.displayName, myRating, profile.partyId ?? "", code, queueMode);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not join queue.");
    }
  }

  async function handleSubmitScore() {
    if (!user || !lobby) return;
    if (!screenshotUrl.startsWith("https://")) {
      setError("Screenshot link must be a valid https:// URL.");
      return;
    }
    setError("");
    await submitBedwarsScore(lobby, user.uid, screenshotUrl, scoreTeam, topKillerId);
    setScreenshotUrl("");
  }

  async function handleApprove(l: BedwarsLobby) {
    if (!user) return;
    const winningTeam = reviewChoice[l.id] ?? l.winningTeamClaim ?? "a";
    if (winningTeam !== "a" && winningTeam !== "b") return;
    await approveBedwarsScore(l, user.uid, winningTeam, reviewKiller[l.id] ?? "");
  }

  if (lobby) {
    return (
      <div className="mx-auto max-w-4xl px-6 py-14">
        <div className="flex items-center gap-3">
          <Swords size={26} className="text-brand-400" />
          <div>
            <h1 className="text-2xl font-semibold text-white">{bedwarsModeLabel(lobby.mode ?? "4v4")} Match Lobby</h1>
            <p className="text-sm text-white/45">
              {lobby.status === "voting" && "Vote for a map."}
              {lobby.status === "role_select" && "Pick your role, then start the match."}
              {lobby.status === "in_progress" && "Play it out — come back to submit the result."}
              {lobby.status === "awaiting_review" && "Result submitted, waiting on staff review."}
            </p>
          </div>
        </div>

        <div className="mt-6 flex flex-col gap-3 sm:flex-row">
          <TeamRoster lobby={lobby} team="a" />
          <TeamRoster lobby={lobby} team="b" />
        </div>

        <VoiceControlBar />

        {lobby.status === "voting" && (
          <div className="mt-6 rounded-xl border border-border bg-surface p-5">
            <h2 className="text-base font-semibold text-white">Map vote <span className="text-white/40">({Object.keys(lobby.mapVotes).length}/{lobby.players.length})</span></h2>
            <div className="mt-3 flex flex-wrap gap-2">
              {lobby.mapOptions.map((m) => (
                <Button
                  key={m}
                  size="sm"
                  variant={user && lobby.mapVotes[user.uid] === m ? "primary" : "secondary"}
                  onClick={() => user && voteBedwarsMap(lobby.id, user.uid, m)}
                >
                  {m}
                </Button>
              ))}
            </div>
          </div>
        )}

        {lobby.status === "role_select" && (
          <div className="mt-6 rounded-xl border border-border bg-surface p-5">
            <h2 className="text-base font-semibold text-white">Map: {lobby.chosenMap}</h2>
            {lobby.mode === "bedfight" ? (
              <div className="mt-3 rounded-xl border border-cyan-400/20 bg-cyan-400/[.05] p-4">
                <p className="text-sm font-semibold text-cyan-100">Minecraft Education map ready</p>
                <p className="mt-1 text-xs leading-5 text-white/45">Team A uses <code className="text-red-300">/tag @s add bf_red</code>. Team B uses <code className="text-blue-300">/tag @s add bf_blue</code>. The host runs <code className="text-white">/scriptevent edushare:bedfight start</code>.</p>
                <a href="/downloads/EduShare-BedFight.mcworld" download className="cursor-target mt-3 inline-flex rounded-xl bg-cyan-500 px-4 py-2 text-sm font-semibold text-white transition hover:bg-cyan-400">Download SpawnDex Bed Fight world</a>
              </div>
            ) : (
              <><p className="mt-1 text-xs text-white/45">Pick your role for this game.</p><div className="mt-3 flex flex-wrap gap-2">
                {BEDWARS_ROLES.map((r) => (
                  <Button key={r} size="sm" variant={user && lobby.roles[user.uid] === r ? "primary" : "secondary"} onClick={() => user && pickBedwarsRole(lobby.id, user.uid, r)}>{r}</Button>
                ))}
              </div></>
            )}
            <Button className="mt-4" onClick={() => startBedwarsMatch(lobby.id)}>Start Match</Button>
          </div>
        )}

        {lobby.status === "in_progress" && (
          <div className="mt-6 rounded-xl border border-border bg-surface p-5">
            <h2 className="text-base font-semibold text-white">Submit the result</h2>
            <div className="mt-3 flex flex-wrap items-center gap-2">
              <span className="text-xs text-white/45">Winning team:</span>
              <Button size="sm" variant={scoreTeam === "a" ? "primary" : "secondary"} onClick={() => setScoreTeam("a")}>Team A</Button>
              <Button size="sm" variant={scoreTeam === "b" ? "primary" : "secondary"} onClick={() => setScoreTeam("b")}>Team B</Button>
            </div>
            <select value={topKillerId} onChange={(e) => setTopKillerId(e.target.value)} className="mt-3 w-full rounded-xl border border-border bg-surface-2 px-4 py-2.5 text-sm text-white">
              <option value="">Top killer (optional)</option>
              {lobby.players.map((p) => (
                <option key={p.uid} value={p.uid}>{p.name}</option>
              ))}
            </select>
            <input
              value={screenshotUrl}
              onChange={(e) => setScreenshotUrl(e.target.value)}
              placeholder="End-screen screenshot link (https://...)"
              className="mt-3 w-full rounded-xl border border-border bg-surface-2 px-4 py-2.5 text-sm text-white"
            />
            {error && <p className="mt-2 text-sm text-red-400">{error}</p>}
            <div className="mt-4 flex flex-wrap gap-2">
              <Button onClick={handleSubmitScore}>Submit Result</Button>
              <Button
                variant="ghost"
                onClick={() => {
                  if (window.confirm("Void this RBW game? Nobody will gain or lose rating.")) {
                    void cancelBedwarsLobby(lobby);
                  }
                }}
              >
                Void Game
              </Button>
            </div>
          </div>
        )}

        {lobby.status === "awaiting_review" && (
          <div className="mt-6 rounded-xl border border-border bg-surface p-5 text-sm text-white/60">
            Claimed winner: Team {lobby.winningTeamClaim.toUpperCase()} ·{" "}
            <a href={lobby.screenshotUrl} target="_blank" rel="noopener noreferrer" className="text-brand-300 underline">screenshot</a>
          </div>
        )}

        {(lobby.status === "voting" || lobby.status === "role_select") && (
          <Button variant="ghost" size="sm" className="mt-4" onClick={() => cancelBedwarsLobby(lobby)}>Cancel match</Button>
        )}
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-4xl px-6 py-14">
      <div className="flex items-center gap-3">
        <Swords size={26} className="text-brand-400" />
        <div>
          <h1 className="text-2xl font-semibold text-white">Ranked Bedwars</h1>
          <p className="text-sm text-white/45">Queue for RBW or Minecraft Education Bed Fight, get matched by Elo, and submit the result for review.</p>
        </div>
      </div>

      <VoiceControlBar />

      {!tutorialSeen ? (
        <div className="mt-6 border-y border-border py-5">
          <h2 className="text-sm font-medium text-white/70">New here? Watch these first</h2>
          <div className="mt-3 grid gap-4 sm:grid-cols-2">
            <LazyYoutubeEmbed videoId="6yZJDlPE5Ow" label="How to play Ranked Bedwars" />
            <LazyYoutubeEmbed videoId="6AHAqmHkG7U" label="How to defend your bed" />
          </div>
          <Button size="sm" variant="secondary" className="mt-4" onClick={() => { localStorage.setItem("edushare-bedwars-tutorial-seen", "1"); setTutorialSeen(true); }}>
            I watched it — Continue
          </Button>
        </div>
      ) : (
        <button type="button" onClick={() => setTutorialSeen(false)} className="cursor-target mt-4 text-xs text-white/35 hover:text-white/60">
          How to play (watch again)
        </button>
      )}

      <div className="mt-6 flex flex-wrap items-center gap-4 border-y border-border py-5">
        <div className="flex items-center gap-2">
          <Trophy size={18} className="text-amber-300" />
          <span className="font-mono text-lg font-bold text-white">{myRating}</span>
          <RankBadge rating={myRating} />
        </div>
        <span className="font-mono text-xs text-white/45">{myWins}W · {myLosses}L</span>
      </div>

      <div className="mt-6 flex flex-col overflow-hidden rounded-xl border border-border bg-surface md:flex-row">
        <div className="flex-1 p-5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <UsersIcon size={16} className="text-white/50" />
              <h2 className="text-base font-semibold text-white">{bedwarsModeLabel(activeQueueMode)} Queue</h2>
            </div>
            <div className="flex items-center gap-2">
              <div className="flex gap-1">
                {Array.from({ length: activeMatchSize }).map((_, i) => (
                  <span key={i} className={`h-1.5 w-4 rounded-full ${i < visibleQueue.length ? "bg-brand-400" : "bg-white/10"}`} />
                ))}
              </div>
              <span className="text-xs text-white/40">{visibleQueue.length}/{activeMatchSize}</span>
            </div>
          </div>

          {visibleQueue.length > 0 ? (
            <div className="mt-4 flex gap-2 overflow-x-auto pb-1">
              {visibleQueue.map((e) => {
                const p = profiles.find((pr) => pr.id === e.uid);
                return (
                  <button
                    key={e.uid}
                    type="button"
                    onClick={() => setOpenProfileId(e.uid)}
                    className="cursor-target flex shrink-0 items-center gap-2 rounded-full border border-border bg-surface-2 py-1 pl-1 pr-3 hover:border-brand-300/40"
                  >
                    <span className="relative h-6 w-6 shrink-0 overflow-hidden rounded-full bg-brand-500/30">
                      {p?.photoUrl ? (
                        <img src={p.photoUrl} alt="" className="h-full w-full object-cover" />
                      ) : (
                        <span className="flex h-full w-full items-center justify-center text-[10px] font-semibold text-white/70">{e.displayName.slice(0, 1).toUpperCase()}</span>
                      )}
                      <span className="absolute bottom-0 right-0 h-1.5 w-1.5 rounded-full border border-surface-2 bg-emerald-400" />
                    </span>
                    <span className="whitespace-nowrap text-sm text-white/70">{e.displayName} <span className="text-white/35">· {formatBedwarsRank(e.elo)}</span></span>
                  </button>
                );
              })}
            </div>
          ) : (
            <p className="mt-4 text-sm text-white/35">Nobody's queued yet.</p>
          )}
          <p className="mt-4 text-xs text-white/35">Queueing with your party keeps you close in Elo for a same-team match.</p>
        </div>

        <div className="flex w-full shrink-0 flex-col justify-center gap-3 border-t border-border p-5 md:w-64 md:border-l md:border-t-0">
          {inQueue ? (
            <>
              <p className="text-sm text-white/60">
                {myLobbyCode ? <>Private queue <span className="text-white">"{myLobbyCode}"</span></> : "Public queue"}
                <br /><span className="text-brand-300">{bedwarsModeLabel(myQueueMode)}</span> · Waiting for <span className="text-white">{Math.max(0, bedwarsModeTeamSize(myQueueMode) * 2 - visibleQueue.length)}</span> more.
              </p>
              <Button size="sm" variant="ghost" onClick={() => user && leaveBedwarsQueue(user.uid)}>Leave queue</Button>
            </>
          ) : (
            <>
              <div className="grid grid-cols-2 gap-2">
                {(["bedfight", "1v1", "3v3", "4v4"] as BedwarsMode[]).map((mode) => (
                  <button key={mode} type="button" onClick={() => setQueueMode(mode)} className={`cursor-target rounded-lg border px-2 py-2 text-xs font-semibold ${queueMode === mode ? "border-brand-400 bg-brand-500/20 text-brand-200" : "border-border bg-surface-2 text-white/45"}`}>{bedwarsModeLabel(mode)}</button>
                ))}
              </div>
              <Button className="w-full" onClick={() => handleJoinQueue("")}>Join public queue</Button>
              <div className="flex items-center gap-2">
                <input
                  value={lobbyCodeInput}
                  onChange={(e) => setLobbyCodeInput(e.target.value)}
                  placeholder="Private code"
                  className="min-w-0 flex-1 rounded-xl border border-border bg-surface-2 px-3 py-2 text-sm text-white placeholder:text-white/30"
                />
                <Button variant="secondary" disabled={!lobbyCodeInput.trim()} onClick={() => handleJoinQueue(lobbyCodeInput)}>
                  Join
                </Button>
              </div>
            </>
          )}
          {error && <p className="text-sm text-red-400">{error}</p>}
        </div>
      </div>

      {isStaff && reviewQueue.length > 0 && (
        <div className="mt-6 rounded-xl border border-amber-500/30 bg-amber-500/5 p-5">
          <div className="flex items-center gap-2">
            <ShieldCheck size={16} className="text-amber-300" />
            <h2 className="text-base font-semibold text-white">Score review <span className="text-white/40">({reviewQueue.length})</span></h2>
          </div>
          <div className="mt-3 space-y-3">
            {reviewQueue.map((l) => (
              <div key={l.id} className="rounded-xl border border-border bg-surface-2 p-4">
                <a href={l.screenshotUrl} target="_blank" rel="noopener noreferrer" className="text-sm text-brand-300 underline">View screenshot</a>
                <p className="mt-1 text-xs text-white/45">Claimed: Team {l.winningTeamClaim.toUpperCase()} · Map {l.chosenMap}</p>
                <div className="mt-2 flex flex-wrap items-center gap-2">
                  <span className="text-xs text-white/45">Winner:</span>
                  <Button size="sm" variant={(reviewChoice[l.id] ?? l.winningTeamClaim) === "a" ? "primary" : "secondary"} onClick={() => setReviewChoice((s) => ({ ...s, [l.id]: "a" }))}>A</Button>
                  <Button size="sm" variant={(reviewChoice[l.id] ?? l.winningTeamClaim) === "b" ? "primary" : "secondary"} onClick={() => setReviewChoice((s) => ({ ...s, [l.id]: "b" }))}>B</Button>
                  <select value={reviewKiller[l.id] ?? l.topKillerId} onChange={(e) => setReviewKiller((s) => ({ ...s, [l.id]: e.target.value }))} className="rounded-lg border border-border bg-surface px-2 py-1 text-xs text-white">
                    <option value="">No top killer</option>
                    {l.players.map((p) => (
                      <option key={p.uid} value={p.uid}>{p.name}</option>
                    ))}
                  </select>
                  <Button size="sm" onClick={() => handleApprove(l)}>Approve</Button>
                  <Button size="sm" variant="danger" onClick={() => user && rejectBedwarsScore(l.id, user.uid)}>Reject</Button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="mt-6 rounded-xl border border-border bg-surface p-5">
        <div className="flex items-center gap-2">
          <Crown size={16} className="text-amber-300" />
          <h2 className="text-base font-semibold text-white">Leaderboard</h2>
        </div>
        <div className="mt-3 space-y-1.5">
          {leaderboard.map((p, i) => (
            <div key={p.id} className="flex items-center justify-between gap-2 rounded-xl border border-border bg-surface-2 px-4 py-2.5">
              <div className="flex items-center gap-3">
                <span className="w-5 font-mono text-xs text-white/40">{i + 1}</span>
                {i === 0 ? <Medal size={14} className="text-yellow-400" /> : i === 1 ? <Medal size={14} className="text-slate-300" /> : i === 2 ? <Medal size={14} className="text-orange-400" /> : <span className="w-3.5" />}
                <span className="text-sm text-white/80">{p.displayName}</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="font-mono text-xs text-white/40">{p.bedwarsWins ?? 0}W-{p.bedwarsLosses ?? 0}L</span>
                <RankBadge rating={p.bedwarsRating ?? 0} />
              </div>
            </div>
          ))}
          {leaderboard.length === 0 && <p className="py-8 text-center text-sm text-white/40">No ranked matches played yet. Be the first!</p>}
        </div>
      </div>
      {openProfileId && <ProfileCard userId={openProfileId} onClose={() => setOpenProfileId(null)} />}
    </div>
  );
}
