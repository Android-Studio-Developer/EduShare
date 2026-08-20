import { useEffect, useMemo, useState, type CSSProperties } from "react";
import { Castle, Check, Crown, LogOut, Pencil, Plus, Star, Trash2, Users } from "lucide-react";
import { useAuth } from "../context/AuthContext";
import { clearPartyPointer, createParty, disbandParty, joinParty, leaveParty, PARTY_MAX_MEMBERS, renameParty, setPartyCoLeader, subscribeToParties, subscribeToParty } from "../lib/parties";
import { clearGuildPointer, createGuild, disbandGuild, GUILD_MAX_MEMBERS, joinGuild, leaveGuild, renameGuild, setGuildCoOwner, styleGuildName, subscribeToGuild, subscribeToGuilds } from "../lib/guilds";
import { subscribeToAllProfiles, subscribeToProfile } from "../lib/profiles";
import { canUseBannerEffects } from "../lib/ranks";
import type { Guild, GroupNameEffect, Party, UserProfile } from "../types";
import Button from "../components/Button";

function nameOf(profiles: Map<string, UserProfile>, id: string) {
  return profiles.get(id)?.displayName ?? "Unknown";
}

const GUILD_NAME_COLORS = ["#8FACFF", "#F87171", "#FBBF24", "#4ADE80", "#F472B6", "#38BDF8"];

export default function PartyGuild() {
  const { user, role } = useAuth();
  const [tab, setTab] = useState<"party" | "guild">("party");
  const [profiles, setProfiles] = useState<UserProfile[]>([]);
  const [myProfile, setMyProfile] = useState<UserProfile | null>(null);
  const [parties, setParties] = useState<Party[]>([]);
  const [guilds, setGuilds] = useState<Guild[]>([]);
  const [myParty, setMyParty] = useState<Party | null>(null);
  const [myGuild, setMyGuild] = useState<Guild | null>(null);
  const [createName, setCreateName] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [editingName, setEditingName] = useState(false);
  const [nameDraft, setNameDraft] = useState("");

  useEffect(() => subscribeToAllProfiles(setProfiles), []);
  useEffect(() => {
    if (!user) return;
    return subscribeToProfile(user.uid, setMyProfile);
  }, [user]);
  useEffect(() => subscribeToParties(setParties), []);
  useEffect(() => subscribeToGuilds(setGuilds), []);

  const profileById = useMemo(() => new Map(profiles.map((p) => [p.id, p])), [profiles]);

  useEffect(() => {
    if (!myProfile?.partyId) { setMyParty(null); return; }
    return subscribeToParty(myProfile.partyId, (party) => {
      setMyParty(party);
      if (!party && user) void clearPartyPointer(user.uid);
    });
  }, [myProfile?.partyId, user]);

  useEffect(() => {
    if (!myProfile?.guildId) { setMyGuild(null); return; }
    return subscribeToGuild(myProfile.guildId, (guild) => {
      setMyGuild(guild);
      if (!guild && user) void clearGuildPointer(user.uid);
    });
  }, [myProfile?.guildId, user]);

  async function run(action: () => Promise<unknown>) {
    setBusy(true);
    setMessage("");
    try {
      await action();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Something went wrong.");
    } finally {
      setBusy(false);
    }
  }

  if (!user) {
    return <div className="mx-auto max-w-3xl px-6 py-14 text-center text-white/50">Log in to join a party or guild.</div>;
  }

  const isPartyTab = tab === "party";
  const openParties = parties.filter((p) => p.memberIds.length < PARTY_MAX_MEMBERS && !p.memberIds.includes(user.uid));
  const openGuilds = guilds.filter((g) => g.memberIds.length < GUILD_MAX_MEMBERS && !g.memberIds.includes(user.uid));

  return (
    <div className="mx-auto max-w-3xl px-6 py-14">
      <h1 className="font-mono text-2xl font-bold text-white">Looking For Party / Guild</h1>
      <p className="mt-1 text-sm text-white/40">Team up with other players. Parties are small and temporary, guilds are big and permanent.</p>

      <div className="mt-6 flex gap-2 rounded-xl border border-border bg-surface p-1.5">
        <button type="button" onClick={() => setTab("party")} className={`cursor-target flex-1 rounded-lg py-2 font-mono text-sm font-semibold transition-colors ${isPartyTab ? "bg-brand-500/20 text-brand-300" : "text-white/50 hover:text-white"}`}>
          <Users size={14} className="mr-1.5 inline" /> Party
        </button>
        <button type="button" onClick={() => setTab("guild")} className={`cursor-target flex-1 rounded-lg py-2 font-mono text-sm font-semibold transition-colors ${!isPartyTab ? "bg-brand-500/20 text-brand-300" : "text-white/50 hover:text-white"}`}>
          <Castle size={14} className="mr-1.5 inline" /> Guild
        </button>
      </div>

      {message && <p className="mt-4 rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-2 text-sm text-amber-300">{message}</p>}

      {isPartyTab ? (
        myParty ? (
          <div className="mt-6 rounded-2xl border border-border bg-surface p-6">
            <div className="flex items-center justify-between gap-3">
              {editingName ? (
                <form
                  onSubmit={(e) => { e.preventDefault(); void run(async () => { await renameParty(myParty.id, nameDraft); setEditingName(false); }); }}
                  className="flex min-w-0 flex-1 items-center gap-2"
                >
                  <input value={nameDraft} onChange={(e) => setNameDraft(e.target.value)} maxLength={40} autoFocus className="w-full rounded-lg border border-border bg-surface-2 px-3 py-1.5 text-sm text-white focus:border-brand-500/50 focus:outline-none" />
                  <button type="submit" disabled={busy || !nameDraft.trim()} className="cursor-target shrink-0 rounded-lg p-1.5 text-emerald-300 hover:bg-white/10"><Check size={15} /></button>
                </form>
              ) : (
                <h2 className="flex min-w-0 items-center gap-1.5 font-mono text-lg font-bold text-white">
                  <span className="truncate">{myParty.name}</span>
                  {(user.uid === myParty.leaderId || user.uid === myParty.coLeaderId) && (
                    <button type="button" onClick={() => { setNameDraft(myParty.name); setEditingName(true); }} className="cursor-target shrink-0 rounded-lg p-1 text-white/30 hover:bg-white/10 hover:text-white"><Pencil size={13} /></button>
                  )}
                </h2>
              )}
              <span className="shrink-0 text-xs text-white/30">{myParty.memberIds.length}/{PARTY_MAX_MEMBERS} · disbands in {Math.max(0, Math.round((myParty.expiresAt - Date.now()) / 3_600_000))}h</span>
            </div>
            <ul className="mt-4 space-y-2">
              {myParty.memberIds.map((id) => (
                <li key={id} className="flex items-center justify-between rounded-xl border border-border bg-surface-2/60 px-4 py-2 text-sm text-white">
                  <span className="flex items-center gap-2">
                    {id === myParty.leaderId && <Crown size={13} className="text-yellow-300" />}
                    {id === myParty.coLeaderId && <Star size={13} className="text-cyan-300" />}
                    {nameOf(profileById, id)}
                  </span>
                  {user.uid === myParty.leaderId && id !== myParty.leaderId && (
                    <button
                      type="button"
                      onClick={() => run(() => setPartyCoLeader(myParty.id, id === myParty.coLeaderId ? "" : id))}
                      className="cursor-target text-xs text-white/40 hover:text-white"
                    >
                      {id === myParty.coLeaderId ? "Demote" : "Make co-leader"}
                    </button>
                  )}
                </li>
              ))}
            </ul>
            <Button
              variant="secondary"
              className="mt-5 w-full"
              disabled={busy}
              onClick={() => run(() => (user.uid === myParty.leaderId ? disbandParty(myParty.id) : leaveParty(myParty.id, user.uid)))}
            >
              {user.uid === myParty.leaderId ? <Trash2 size={14} /> : <LogOut size={14} />}
              {user.uid === myParty.leaderId ? "Disband party" : "Leave party"}
            </Button>
          </div>
        ) : (
          <>
            <form
              onSubmit={(e) => { e.preventDefault(); void run(async () => { await createParty(user.uid, myProfile?.displayName ?? "Player", createName); setCreateName(""); }); }}
              className="mt-6 flex gap-2"
            >
              <input value={createName} onChange={(e) => setCreateName(e.target.value)} placeholder="Party name" maxLength={40} className="w-full rounded-xl border border-border bg-surface-2 px-4 py-2.5 text-sm text-white placeholder:text-white/30 focus:border-brand-500/50 focus:outline-none" />
              <Button type="submit" disabled={busy || !createName.trim()}><Plus size={14} /> Create</Button>
            </form>
            <div className="mt-6 space-y-2">
              {openParties.length === 0 ? (
                <p className="py-8 text-center text-sm text-white/30">No open parties right now — start one above.</p>
              ) : (
                openParties.map((p) => (
                  <div key={p.id} className="flex items-center justify-between rounded-xl border border-border bg-surface p-4">
                    <div>
                      <p className="font-mono font-semibold text-white">{p.name}</p>
                      <p className="text-xs text-white/40">Led by {p.leaderName} · {p.memberIds.length}/{PARTY_MAX_MEMBERS}</p>
                    </div>
                    <Button size="sm" disabled={busy} onClick={() => run(() => joinParty(p.id, user.uid))}>Join</Button>
                  </div>
                ))
              )}
            </div>
          </>
        )
      ) : myGuild ? (
        <div className="mt-6 rounded-2xl border border-border bg-surface p-6">
          <div className="flex items-center justify-between gap-3">
            {editingName ? (
              <form
                onSubmit={(e) => { e.preventDefault(); void run(async () => { await renameGuild(myGuild.id, nameDraft); setEditingName(false); }); }}
                className="flex min-w-0 flex-1 items-center gap-2"
              >
                <input value={nameDraft} onChange={(e) => setNameDraft(e.target.value)} maxLength={40} autoFocus className="w-full rounded-lg border border-border bg-surface-2 px-3 py-1.5 text-sm text-white focus:border-brand-500/50 focus:outline-none" />
                <button type="submit" disabled={busy || !nameDraft.trim()} className="cursor-target shrink-0 rounded-lg p-1.5 text-emerald-300 hover:bg-white/10"><Check size={15} /></button>
              </form>
            ) : (
              <h2
                className={`flex min-w-0 items-center gap-1.5 font-mono text-lg font-bold ${myGuild.nameEffect === "chroma" ? "text-chroma" : ""} ${myGuild.nameGlow ? "text-name-glow" : ""}`}
                style={{ ...(myGuild.nameEffect === "none" && myGuild.nameColor ? { color: myGuild.nameColor } : {}), ...(myGuild.nameGlow ? { "--glow-color": myGuild.nameColor || "#8FACFF" } as CSSProperties : {}) }}
              >
                <span className="truncate">{myGuild.name}</span>
                {(user.uid === myGuild.ownerId || user.uid === myGuild.coOwnerId) && (
                  <button type="button" onClick={() => { setNameDraft(myGuild.name); setEditingName(true); }} className="cursor-target shrink-0 rounded-lg p-1 text-white/30 hover:bg-white/10 hover:text-white"><Pencil size={13} /></button>
                )}
              </h2>
            )}
            <span className="shrink-0 text-xs text-white/30">{myGuild.memberIds.length}/{GUILD_MAX_MEMBERS} members</span>
          </div>
          <ul className="mt-4 max-h-72 space-y-2 overflow-y-auto">
            {myGuild.memberIds.map((id) => (
              <li key={id} className="flex items-center justify-between rounded-xl border border-border bg-surface-2/60 px-4 py-2 text-sm text-white">
                <span className="flex items-center gap-2">
                  {id === myGuild.ownerId && <Crown size={13} className="text-yellow-300" />}
                  {id === myGuild.coOwnerId && <Star size={13} className="text-cyan-300" />}
                  {nameOf(profileById, id)}
                </span>
                {user.uid === myGuild.ownerId && id !== myGuild.ownerId && (
                  <button
                    type="button"
                    onClick={() => run(() => setGuildCoOwner(myGuild.id, id === myGuild.coOwnerId ? "" : id))}
                    className="cursor-target text-xs text-white/40 hover:text-white"
                  >
                    {id === myGuild.coOwnerId ? "Demote" : "Make co-owner"}
                  </button>
                )}
              </li>
            ))}
          </ul>

          {(user.uid === myGuild.ownerId || user.uid === myGuild.coOwnerId) && (
            canUseBannerEffects(myProfile?.rank) ? (
              <div className="mt-5 rounded-xl border border-border bg-surface-2/60 p-4">
                <p className="text-xs font-semibold text-white/50">Guild name style (VIP++ perk)</p>
                <p className="mt-1 text-[11px] text-white/30">Pick a color, or go chroma — either can be combined with a glow.</p>
                <div className="mt-2 flex flex-wrap items-center gap-2">
                  {GUILD_NAME_COLORS.map((color) => (
                    <button key={color} type="button" onClick={() => run(() => styleGuildName(myGuild.id, color, "none" as GroupNameEffect, myGuild.nameGlow))} className={`cursor-target h-6 w-6 rounded-full border-2 ${myGuild.nameEffect === "none" && myGuild.nameColor === color ? "border-white" : "border-white/20"}`} style={{ backgroundColor: color }} />
                  ))}
                  <button
                    type="button"
                    onClick={() => run(() => styleGuildName(myGuild.id, myGuild.nameColor || "#8FACFF", myGuild.nameEffect === "chroma" ? "none" as GroupNameEffect : "chroma", myGuild.nameGlow))}
                    className={`cursor-target rounded-lg border px-3 py-1 text-xs text-chroma ${myGuild.nameEffect === "chroma" ? "border-white/60" : "border-border"}`}
                  >
                    Chroma
                  </button>
                  <button
                    type="button"
                    onClick={() => run(() => styleGuildName(myGuild.id, myGuild.nameColor || "#8FACFF", myGuild.nameEffect, !myGuild.nameGlow))}
                    className={`cursor-target rounded-lg border px-3 py-1 text-xs text-white ${myGuild.nameGlow ? "border-white/60" : "border-border"}`}
                  >
                    Glow {myGuild.nameGlow ? "on" : "off"}
                  </button>
                </div>
              </div>
            ) : (
              <p className="mt-5 text-xs text-white/30">Reach VIP++ to unlock chroma, glow, and custom colors for your guild name.</p>
            )
          )}

          <Button
            variant="secondary"
            className="mt-5 w-full"
            disabled={busy}
            onClick={() => run(() => (user.uid === myGuild.ownerId ? disbandGuild(myGuild.id) : leaveGuild(myGuild.id, user.uid)))}
          >
            {user.uid === myGuild.ownerId ? <Trash2 size={14} /> : <LogOut size={14} />}
            {user.uid === myGuild.ownerId ? "Disband guild" : "Leave guild"}
          </Button>
        </div>
      ) : (
        <>
          <form
            onSubmit={(e) => { e.preventDefault(); void run(async () => { await createGuild(user.uid, myProfile?.displayName ?? "Player", createName); setCreateName(""); }); }}
            className="mt-6 flex gap-2"
          >
            <input value={createName} onChange={(e) => setCreateName(e.target.value)} placeholder="Guild name" maxLength={40} className="w-full rounded-xl border border-border bg-surface-2 px-4 py-2.5 text-sm text-white placeholder:text-white/30 focus:border-brand-500/50 focus:outline-none" />
            <Button type="submit" disabled={busy || !createName.trim()}><Plus size={14} /> Create</Button>
          </form>
          <div className="mt-6 space-y-2">
            {openGuilds.length === 0 ? (
              <p className="py-8 text-center text-sm text-white/30">No open guilds right now — start one above.</p>
            ) : (
              openGuilds.map((g) => (
                <div key={g.id} className="flex items-center justify-between rounded-xl border border-border bg-surface p-4">
                  <div>
                    <p className="font-mono font-semibold text-white">{g.name}</p>
                    <p className="text-xs text-white/40">Owned by {g.ownerName} · {g.memberIds.length}/{GUILD_MAX_MEMBERS}</p>
                  </div>
                  <Button size="sm" disabled={busy} onClick={() => run(() => joinGuild(g.id, user.uid))}>Join</Button>
                </div>
              ))
            )}
          </div>
        </>
      )}
      {role === "owner" && <p className="mt-6 text-center text-[11px] text-white/20">Staff can moderate any party or guild.</p>}
    </div>
  );
}
