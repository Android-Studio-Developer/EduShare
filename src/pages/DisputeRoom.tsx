import { useEffect, useState, type FormEvent } from "react";
import { Link, useParams } from "react-router-dom";
import { MessageCircle, Send, ShieldAlert } from "lucide-react";
import { useAuth } from "../context/AuthContext";
import { isStaffRole, sendDisputeMessage, subscribeToDisputeMessages, subscribeToReport } from "../lib/moderation";
import type { DisputeMessage, ServerReport } from "../types";
import Button from "../components/Button";

export default function DisputeRoom() {
  const { id = "" } = useParams();
  const { user, role } = useAuth();
  const [report, setReport] = useState<ServerReport | null>(null);
  const [messages, setMessages] = useState<DisputeMessage[]>([]);
  const [text, setText] = useState("");
  useEffect(() => subscribeToReport(id, setReport), [id]);
  useEffect(() => subscribeToDisputeMessages(id, setMessages), [id]);
  async function submit(event: FormEvent) { event.preventDefault(); if (!user || !text.trim()) return; await sendDisputeMessage(id, user.uid, user.displayName ?? "Anonymous", text.trim().slice(0, 1000)); setText(""); }
  if (!report) return <div className="p-20 text-center text-white/50">Loading dispute…</div>;
  const participant = isStaffRole(role) || user?.uid === report.reporterId || user?.uid === report.serverOwnerId;
  if (!participant) return <div className="p-20 text-center text-white/50">This dispute room is private.</div>;
  return <div className="mx-auto max-w-3xl px-6 py-14"><Link to={`/server/${report.serverId}`} className="text-sm text-brand-400">← View reported server</Link><div className="mt-5 rounded-2xl border border-amber-500/30 bg-amber-500/5 p-6"><h1 className="font-mono text-xl font-bold text-white"><ShieldAlert className="mr-2 inline text-amber-300" />Duplicate-map dispute</h1><p className="mt-3 text-sm text-white/70">{report.details}</p><div className="mt-4 flex flex-wrap gap-4 text-xs text-white/40"><span>Reported: {report.serverName}</span><span>Original reference: {report.originalServerId}</span><span>Status: {report.status}</span></div>{report.evidenceUrl && <a href={report.evidenceUrl} target="_blank" rel="noreferrer" className="mt-3 inline-block text-sm text-brand-300 hover:underline">View submitted evidence ↗</a>}</div><section className="mt-6 overflow-hidden rounded-2xl border border-border bg-surface"><h2 className="flex items-center gap-2 border-b border-border p-4 font-mono font-bold text-white"><MessageCircle size={16} />Private discussion</h2><div className="max-h-[28rem] space-y-4 overflow-y-auto p-5">{messages.length === 0 && <p className="py-8 text-center text-sm text-white/30">No discussion yet. Share evidence and keep the conversation respectful.</p>}{messages.map((message) => <div key={message.id}><div className="flex gap-2 text-xs"><strong className="text-brand-300">{message.authorName}</strong><span className="text-white/25">{new Date(message.createdAt).toLocaleString()}</span></div><p className="mt-1 whitespace-pre-wrap text-sm text-white/70">{message.text}</p></div>)}</div><form onSubmit={submit} className="flex gap-2 border-t border-border p-4"><input required maxLength={1000} value={text} onChange={(e) => setText(e.target.value)} placeholder="Add evidence or explain your side…" className="w-full rounded-xl border border-border bg-surface-2 px-4 py-3 text-white"/><Button type="submit"><Send size={15}/></Button></form></section></div>;
}
