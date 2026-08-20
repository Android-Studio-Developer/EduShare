import { Crown, Shield, Users } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import ProfileCard from "../components/ProfileCard";
import RankBadge from "../components/RankBadge";
import StatusDot from "../components/StatusDot";
import { subscribeToStaffRoles, type StaffMember } from "../lib/moderation";
import { isOnline, subscribeToAllProfiles } from "../lib/profiles";
import { rankNameClass } from "../lib/ranks";
import type { UserProfile } from "../types";

export default function Team() {
  const [profiles, setProfiles] = useState<UserProfile[]>([]);
  const [staff, setStaff] = useState<StaffMember[]>([]);
  const [openProfileId, setOpenProfileId] = useState<string | null>(null);

  useEffect(() => subscribeToAllProfiles(setProfiles), []);
  useEffect(() => subscribeToStaffRoles(setStaff), []);

  const profileById = useMemo(() => new Map(profiles.map((p) => [p.id, p])), [profiles]);

  // Site-wide staff access (owner by email, moderators via the roles
  // collection) is what actually grants permissions — it's independent of
  // the purchasable/cosmetic `profile.rank` field, so we look staff up here
  // instead of filtering profiles by rank.
  const owners = useMemo(
    () => staff.filter((s) => s.role === "owner").map((s) => profileById.get(s.id)).filter((p): p is UserProfile => !!p),
    [staff, profileById],
  );

  const moderators = useMemo(
    () => staff.filter((s) => s.role === "moderator").map((s) => profileById.get(s.id)).filter((p): p is UserProfile => !!p),
    [staff, profileById],
  );

  const MemberCard = ({ member, staffRole }: { member: UserProfile; staffRole: "owner" | "moderator" }) => (
    <button
      type="button"
      onClick={() => setOpenProfileId(member.id)}
      className="cursor-target group flex w-full items-center gap-4 rounded-2xl border border-white/10 bg-white/[.035] p-4 text-left transition hover:border-white/20 hover:bg-white/[.055]"
    >
      <div className="relative shrink-0">
        {member.photoUrl ? (
          <img
            src={member.photoUrl}
            alt=""
            className="h-14 w-14 rounded-2xl object-cover"
          />
        ) : (
          <div className="grid h-14 w-14 place-items-center rounded-2xl bg-gradient-to-br from-brand-400 to-violet-500 font-mono text-xl font-bold text-white">
            {(member.displayName || "?").slice(0, 1).toUpperCase()}
          </div>
        )}
        <StatusDot
          online={isOnline(member)}
          className="absolute -bottom-0.5 -right-0.5"
        />
      </div>

      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <span className={`truncate font-mono text-base font-bold ${rankNameClass(member.rank)}`}>
            {member.displayName || "Unnamed user"}
          </span>
          {staffRole === "owner" ? (
            <Crown size={14} className="shrink-0 text-amber-300" />
          ) : (
            <Shield size={14} className="shrink-0 text-sky-300" />
          )}
          <RankBadge rank={member.rank} />
        </div>
        <p className="mt-1 text-xs text-white/40">
          {isOnline(member) ? "Online now" : "Currently offline"}
        </p>
      </div>
    </button>
  );

  return (
    <div className="mx-auto max-w-5xl px-6 py-14">
      <div className="rounded-3xl border border-white/10 bg-gradient-to-br from-white/[.055] to-white/[.02] p-7 sm:p-9">
        <div className="flex items-start gap-3">
          <div className="rounded-xl border border-brand-400/20 bg-brand-400/10 p-2.5 text-brand-300">
            <Users size={23} />
          </div>
          <div>
            <p className="font-mono text-xs uppercase tracking-[.2em] text-brand-300/80">eduShare Team</p>
            <h1 className="mt-1 font-mono text-3xl font-bold text-white">Who runs this website?</h1>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-white/50">
              These are the current owner and moderators of eduShare. The list updates automatically when staff ranks change.
            </p>
          </div>
        </div>
      </div>

      <section className="mt-9">
        <div className="mb-4 flex items-center gap-2">
          <Crown size={19} className="text-amber-300" />
          <div>
            <h2 className="font-mono text-lg font-bold text-white">Website Owner</h2>
            <p className="text-xs text-white/35">The person responsible for eduShare.</p>
          </div>
        </div>

        {owners.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-white/10 px-5 py-7 text-sm text-white/30">
            No owner profile is currently listed.
          </div>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2">
            {owners.map((member) => <MemberCard key={member.id} member={member} staffRole="owner" />)}
          </div>
        )}
      </section>

      <section className="mt-10">
        <div className="mb-4 flex items-center gap-2">
          <Shield size={19} className="text-sky-300" />
          <div>
            <h2 className="font-mono text-lg font-bold text-white">Moderators</h2>
            <p className="text-xs text-white/35">Community staff who help keep eduShare safe and welcoming.</p>
          </div>
        </div>

        {moderators.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-white/10 px-5 py-7 text-sm text-white/30">
            No moderators are currently listed.
          </div>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2">
            {moderators.map((member) => <MemberCard key={member.id} member={member} staffRole="moderator" />)}
          </div>
        )}
      </section>

      {openProfileId && (
        <ProfileCard userId={openProfileId} onClose={() => setOpenProfileId(null)} />
      )}
    </div>
  );
}
