import { useEffect, useState, type FormEvent } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { Flag } from "lucide-react";
import { useAuth } from "../context/AuthContext";
import { subscribeToServer } from "../lib/servers";
import { submitServerReport } from "../lib/moderation";
import type { MinecraftServer, ReportReason } from "../types";
import Button from "../components/Button";

const REASONS: [ReportReason, string][] = [["duplicate_map", "Duplicate or stolen map"], ["inappropriate_content", "Inappropriate content"], ["shop_scam", "Shop purchase scam"], ["harassment", "Harassment"], ["other", "Other"]];

export default function ReportServer() {
  const { id = "" } = useParams();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [server, setServer] = useState<MinecraftServer | null>(null);
  const [reason, setReason] = useState<ReportReason>("duplicate_map");
  const [details, setDetails] = useState("");
  const [originalServerId, setOriginalServerId] = useState("");
  const [evidenceUrl, setEvidenceUrl] = useState("");
  const [error, setError] = useState("");

  useEffect(() => subscribeToServer(id, setServer), [id]);

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (!user || !server) return;
    setError("");
    try {
      const result = await submitServerReport({ serverId: server.id, serverName: server.name, serverOwnerId: server.ownerId, reporterId: user.uid, reporterName: user.displayName ?? "Anonymous", reason, details: details.trim(), originalServerId: reason === "duplicate_map" ? originalServerId.trim() : "", evidenceUrl: evidenceUrl.trim() });
      navigate(reason === "duplicate_map" ? `/dispute/${result.id}` : `/server/${server.id}`);
    } catch {
      setError("Could not submit this report.");
    }
  }

  return <div className="mx-auto max-w-2xl px-6 py-14"><Link to={`/server/${id}`} className="text-sm text-brand-400">← Back to server</Link><h1 className="mt-5 font-mono text-2xl font-bold text-white"><Flag className="mr-2 inline" />Report {server?.name}</h1><p className="mt-2 text-sm text-white/45">False or retaliatory reports may result in moderation action.</p><form onSubmit={submit} className="mt-8 space-y-5 rounded-2xl border border-border bg-surface p-6"><div><label className="mb-2 block text-sm font-semibold text-white">Reason</label><select value={reason} onChange={(e) => setReason(e.target.value as ReportReason)} className="w-full rounded-xl border border-border bg-surface-2 px-4 py-3 text-white">{REASONS.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></div>{reason === "duplicate_map" && <div><label className="mb-2 block text-sm font-semibold text-white">Original server ID or link</label><input required value={originalServerId} onChange={(e) => setOriginalServerId(e.target.value)} placeholder="Paste the original SpawnDex server link" className="w-full rounded-xl border border-border bg-surface-2 px-4 py-3 text-white" /></div>}<div><label className="mb-2 block text-sm font-semibold text-white">Evidence link (optional)</label><input type="url" value={evidenceUrl} onChange={(e) => setEvidenceUrl(e.target.value)} placeholder="Screenshot or video URL" className="w-full rounded-xl border border-border bg-surface-2 px-4 py-3 text-white" /></div><div><label className="mb-2 block text-sm font-semibold text-white">Explain what happened</label><textarea required minLength={30} maxLength={1500} rows={6} value={details} onChange={(e) => setDetails(e.target.value)} className="w-full rounded-xl border border-border bg-surface-2 px-4 py-3 text-white" /></div>{error && <p className="text-sm text-red-400">{error}</p>}<Button type="submit" size="lg" className="w-full"><Flag size={16} />Submit report</Button></form></div>;
}
