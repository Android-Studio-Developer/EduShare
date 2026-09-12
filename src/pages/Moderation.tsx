import { useEffect, useState, type FormEvent } from "react";
import { Check, Shield, X } from "lucide-react";
import { Link } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import {
  reviewModeratorApplication,
  submitModeratorApplication,
  subscribeToApplications,
  subscribeToReports,
  updateReportStatus,
  deleteReportedServer,
  subscribeToFlaggedMessages,
  dismissFlaggedMessage,
  isStaffRole,
} from "../lib/moderation";
import { formatBanRemaining, getApplicationBanRemaining, screenModeratorApplication } from "../lib/aiModeration";
import { resolveRecoveryRequest, subscribeToRecoveryRequests } from "../lib/accountRecovery";
import { acceptPartnerRequest, declinePartnerRequest, subscribeToPartnerRequests } from "../lib/partnerRequests";
import { acceptAdvertiserRequest, declineAdvertiserRequest, subscribeToAdvertiserRequests } from "../lib/advertiser";
import type { AccountRecoveryRequest, AdvertiserRequest, FlaggedMessage, ModeratorApplication, PartnerRequest, ServerReport } from "../types";
import Button from "../components/Button";
import OwnerLoginAuditPanel from "../components/OwnerLoginAuditPanel";

const QUESTIONS = [
  ["experience", "What moderation or community experience do you have?"],
  ["motivation", "Why do you want to moderate SpawnDex?"],
  ["conflictResponse", "How would you handle an argument or inappropriate chat message?"],
  ["duplicateMapResponse", "Two servers appear to use the same map. How would you investigate fairly?"],
  ["availability", "When and how often can you help moderate?"],
] as const;

type Answers = Record<(typeof QUESTIONS)[number][0], string>;
const EMPTY = Object.fromEntries(QUESTIONS.map(([key]) => [key, ""])) as Answers;

export default function Moderation() {
  const { user, role } = useAuth();
  const [answers, setAnswers] = useState<Answers>(EMPTY);
  const [applications, setApplications] = useState<ModeratorApplication[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState("");
  const [reports, setReports] = useState<ServerReport[]>([]);
  const [flags, setFlags] = useState<FlaggedMessage[]>([]);
  const [recoveryRequests, setRecoveryRequests] = useState<AccountRecoveryRequest[]>([]);
  const [partnerRequests, setPartnerRequests] = useState<PartnerRequest[]>([]);
  const [perksDraft, setPerksDraft] = useState<Record<string, string>>({});
  const [advertiserRequests, setAdvertiserRequests] = useState<AdvertiserRequest[]>([]);

  useEffect(() => {
    if (role !== "owner") return;
    return subscribeToApplications(setApplications);
  }, [role]);

  useEffect(() => {
    if (!isStaffRole(role)) return;
    return subscribeToReports(setReports);
  }, [role]);

  useEffect(() => {
    if (!isStaffRole(role)) return;
    return subscribeToFlaggedMessages(setFlags);
  }, [role]);

  useEffect(() => {
    if (role !== "owner") return;
    return subscribeToRecoveryRequests(setRecoveryRequests);
  }, [role]);

  useEffect(() => {
    if (role !== "owner") return;
    return subscribeToPartnerRequests(setPartnerRequests);
  }, [role]);

  useEffect(() => {
    if (!isStaffRole(role)) return;
    return subscribeToAdvertiserRequests(setAdvertiserRequests);
  }, [role]);

  async function acceptPartner(request: PartnerRequest) {
    await acceptPartnerRequest(request, perksDraft[request.id] ?? "");
  }

  async function handleApply(event: FormEvent) {
    event.preventDefault();
    if (!user) return;
    setSubmitting(true);
    setMessage("");
    try {
      const remaining = getApplicationBanRemaining();
      if (remaining > 0) {
        throw new Error(`Application access is paused for ${formatBanRemaining(remaining)}.`);
      }
      const screening = await screenModeratorApplication(answers);
      if (screening.spam) {
        throw new Error(`AI moderation flagged this as spam: ${screening.reason}. Applications are paused for 2 hours.`);
      }
      await submitModeratorApplication({
        userId: user.uid,
        applicantName: user.displayName ?? "Anonymous",
        applicantEmail: user.email ?? "",
        ...answers,
      });
      setAnswers(EMPTY);
      setMessage("Your application was sent to the Owner for review.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Could not submit your application.");
    } finally {
      setSubmitting(false);
    }
  }

  async function review(application: ModeratorApplication, decision: "approved" | "rejected") {
    await reviewModeratorApplication(application, decision);
  }

  const reportPanel = (
    <section className="mt-10">
      <h2 className="font-mono text-xl font-bold text-white">Server reports</h2>
      <div className="mt-4 space-y-3">
        {reports.length === 0 && <p className="rounded-2xl border border-dashed border-border p-10 text-center text-white/35">No reports.</p>}
        {reports.map((report) => (
          <article key={report.id} className="rounded-2xl border border-border bg-surface p-5">
            <div className="flex flex-wrap items-center justify-between gap-2"><div><h3 className="font-mono font-bold text-white">{report.serverName}</h3><p className="text-xs text-white/40">{report.reason.replaceAll("_", " ")} · by {report.reporterName}</p></div><span className="rounded-full border border-border px-3 py-1 text-xs text-white/50">{report.status}</span></div>
            <p className="mt-3 text-sm text-white/65">{report.details}</p>
            <div className="mt-4 flex flex-wrap gap-2">
              {report.reason === "duplicate_map" && <Link to={`/dispute/${report.id}`}><Button size="sm" variant="secondary">Open dispute room</Button></Link>}
              <Button size="sm" variant="secondary" onClick={() => updateReportStatus(report.id, "reviewing")}>Reviewing</Button>
              <Button size="sm" onClick={() => updateReportStatus(report.id, "resolved")}>Resolve</Button>
              <Button size="sm" variant="ghost" onClick={() => updateReportStatus(report.id, "dismissed")}>Dismiss</Button>
              <Button size="sm" variant="danger" onClick={async () => { if (confirm(`Permanently delete ${report.serverName}?`)) { await deleteReportedServer(report.serverId); await updateReportStatus(report.id, "resolved"); } }}>Delete server</Button>
            </div>
          </article>
        ))}
      </div>
    </section>
  );

  const flagPanel = (
    <section className="mt-10">
      <h2 className="font-mono text-xl font-bold text-white">Flagged messages</h2>
      <p className="mt-1 text-xs text-white/40">Messages removed by staff for review.</p>
      <div className="mt-4 space-y-3">
        {flags.length === 0 && <p className="rounded-2xl border border-dashed border-border p-10 text-center text-white/35">No flagged messages.</p>}
        {flags.map((flag) => (
          <article key={flag.id} className="rounded-2xl border border-border bg-surface p-5">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <h3 className="font-mono font-bold text-white">{flag.authorName}</h3>
                <p className="text-xs text-white/40">{flag.serverName} · removed by {flag.deletedByName}</p>
              </div>
              <Button size="sm" variant="ghost" onClick={() => dismissFlaggedMessage(flag.id)}>Dismiss</Button>
            </div>
            <p className="mt-3 text-sm text-white/65">"{flag.text}"</p>
          </article>
        ))}
      </div>
    </section>
  );

  const openPartnerRequests = partnerRequests.filter((r) => r.status === "open");
  const partnerPanel = (
    <section className="mt-10">
      <h2 className="font-mono text-xl font-bold text-white">Partner requests</h2>
      <p className="mt-1 text-xs text-white/40">Accepting grants the requester the exclusive Partner rank and flags their server for the homepage spotlight.</p>
      <div className="mt-4 space-y-3">
        {openPartnerRequests.length === 0 && <p className="rounded-2xl border border-dashed border-border p-10 text-center text-white/35">No open requests.</p>}
        {openPartnerRequests.map((request) => (
          <article key={request.id} className="rounded-2xl border border-border bg-surface p-5">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <p className="font-mono font-bold text-white">{request.serverName}</p>
                {request.contact && <p className="text-xs text-white/40">Reach them: {request.contact}</p>}
              </div>
            </div>
            <p className="mt-3 text-sm text-white/65">{request.message}</p>
            <input
              value={perksDraft[request.id] ?? ""}
              onChange={(e) => setPerksDraft((current) => ({ ...current, [request.id]: e.target.value }))}
              placeholder="Perks blurb for the homepage spotlight (e.g. 20% off with code HYPNO after 5h playtime)"
              maxLength={500}
              className="mt-3 w-full rounded-xl border border-border bg-surface-2 px-3 py-2 text-sm text-white placeholder:text-white/30 focus:border-brand-500/50 focus:outline-none"
            />
            <div className="mt-3 flex gap-2">
              <Button size="sm" onClick={() => void acceptPartner(request)}>Accept & make Partner</Button>
              <Button size="sm" variant="ghost" onClick={() => declinePartnerRequest(request.id)}>Decline</Button>
            </div>
          </article>
        ))}
      </div>
    </section>
  );

  const openAdvertiserRequests = advertiserRequests.filter((r) => r.status === "open");
  const advertiserPanel = (
    <section className="mt-10">
      <h2 className="font-mono text-xl font-bold text-white">Advertiser requests</h2>
      <p className="mt-1 text-xs text-white/40">Accepting grants the requester the Advertiser rank and queues a 530-credit reward on their 3 referred accounts.</p>
      <div className="mt-4 space-y-3">
        {openAdvertiserRequests.length === 0 && <p className="rounded-xl border border-dashed border-border p-10 text-center text-white/35">No open requests.</p>}
        {openAdvertiserRequests.map((request) => (
          <article key={request.id} className="rounded-xl border border-border bg-surface p-5">
            <p className="font-mono font-bold text-white">{request.userName}</p>
            <p className="mt-3 text-sm text-white/65">{request.message}</p>
            <div className="mt-3 flex gap-2">
              <Button size="sm" onClick={() => void acceptAdvertiserRequest(request)}>Accept & make Advertiser</Button>
              <Button size="sm" variant="ghost" onClick={() => declineAdvertiserRequest(request.id)}>Decline</Button>
            </div>
          </article>
        ))}
      </div>
    </section>
  );

  const openRecoveryRequests = recoveryRequests.filter((r) => r.status === "open");
  const recoveryPanel = (
    <section className="mt-10">
      <h2 className="font-mono text-xl font-bold text-white">Account recovery requests</h2>
      <p className="mt-1 text-xs text-white/40">
        Firebase never exposes anyone's password, including to you — look the account up by email in the{" "}
        <a href="https://console.firebase.google.com/" target="_blank" rel="noreferrer" className="cursor-target text-brand-400 hover:underline">Firebase console</a>{" "}
        and send a password reset from there, or point them to the "Forgot password" link on the login page yourself.
      </p>
      <div className="mt-4 space-y-3">
        {openRecoveryRequests.length === 0 && <p className="rounded-2xl border border-dashed border-border p-10 text-center text-white/35">No open requests.</p>}
        {openRecoveryRequests.map((request) => (
          <article key={request.id} className="rounded-2xl border border-border bg-surface p-5">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <p className="font-mono font-bold text-white">{request.input}</p>
                {request.contact && <p className="text-xs text-white/40">Reach them: {request.contact}</p>}
              </div>
              <Button size="sm" variant="ghost" onClick={() => resolveRecoveryRequest(request.id)}>Mark resolved</Button>
            </div>
          </article>
        ))}
      </div>
    </section>
  );

  if (role === "moderator" || role === "actor" || role === "headmod") {
    return (
      <div className="mx-auto max-w-4xl px-6 py-14">
        <div className="text-center">
        <Shield size={36} className="mx-auto text-brand-400" />
        <h1 className="mt-4 font-mono text-2xl font-bold text-white">{role === "actor" ? "Actor access active" : role === "headmod" ? "Head Moderator access active" : "Moderator access active"}</h1>
        <p className="mt-2 text-white/50">You can remove inappropriate chat messages and help review server reports.</p>
        </div>
        {reportPanel}
        {flagPanel}
      </div>
    );
  }

  if (role === "owner") {
    return (
      <div className="mx-auto max-w-4xl px-6 py-14">
        <h1 className="font-mono text-2xl font-bold text-white">Moderator applications</h1>
        <p className="mt-1 mb-8 text-sm text-white/45">Only you can approve or reject applicants.</p>
        <div className="space-y-4">
          {applications.length === 0 && <p className="rounded-2xl border border-dashed border-border p-12 text-center text-white/40">No applications yet.</p>}
          {applications.map((application) => (
            <article key={application.id} className="rounded-2xl border border-border bg-surface p-6">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h2 className="font-mono font-bold text-white">{application.applicantName}</h2>
                  <p className="text-xs text-white/40">{application.applicantEmail}</p>
                </div>
                <span className="rounded-full border border-border px-3 py-1 font-mono text-xs text-white/60">{application.status}</span>
              </div>
              <div className="mt-5 space-y-4">
                {QUESTIONS.map(([key, question]) => (
                  <div key={key}>
                    <p className="text-xs font-semibold text-brand-300">{question}</p>
                    <p className="mt-1 whitespace-pre-wrap text-sm text-white/70">{application[key]}</p>
                  </div>
                ))}
              </div>
              {application.status === "pending" && (
                <div className="mt-6 flex gap-2">
                  <Button onClick={() => review(application, "approved")}><Check size={15} /> Approve</Button>
                  <Button variant="danger" onClick={() => review(application, "rejected")}><X size={15} /> Reject</Button>
                </div>
              )}
            </article>
          ))}
        </div>
        {reportPanel}
        {flagPanel}
        {partnerPanel}
        {advertiserPanel}
        {recoveryPanel}
        {user && <OwnerLoginAuditPanel ownerId={user.uid} />}
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-2xl px-6 py-14">
      <h1 className="font-mono text-2xl font-bold text-white">Apply to be a moderator</h1>
      <p className="mt-2 mb-8 text-sm text-white/50">Answer all five questions thoughtfully. The Owner reviews every application.</p>
      <form onSubmit={handleApply} className="space-y-5 rounded-2xl border border-border bg-surface p-6">
        {QUESTIONS.map(([key, question], index) => (
          <div key={key}>
            <label className="mb-2 block text-sm font-semibold text-white">{index + 1}. {question}</label>
            <textarea
              required
              minLength={20}
              maxLength={800}
              rows={4}
              value={answers[key]}
              onChange={(event) => setAnswers((current) => ({ ...current, [key]: event.target.value }))}
              className="w-full resize-y rounded-xl border border-border bg-surface-2 px-4 py-3 text-sm text-white focus:border-brand-500/50 focus:outline-none"
            />
          </div>
        ))}
        {message && <p className="text-sm text-brand-300">{message}</p>}
        <Button type="submit" size="lg" className="w-full" disabled={submitting}>
          <Shield size={17} /> {submitting ? "AI is reviewing..." : "Submit application"}
        </Button>
      </form>
    </div>
  );
}
