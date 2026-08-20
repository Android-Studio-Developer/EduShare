import { useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { BarChart3, Eye, KeyRound, ShoppingBag } from "lucide-react";
import { useAuth } from "../context/AuthContext";
import { subscribeToServer } from "../lib/servers";
import { subscribeToOrders } from "../lib/shop";
import type { MinecraftServer, ShopOrder } from "../types";

function Bar({ label, value, max }: { label: string; value: number; max: number }) {
  const width = max === 0 ? 0 : Math.max(value > 0 ? 4 : 0, (value / max) * 100);
  return <div><div className="mb-1.5 flex justify-between text-xs"><span className="truncate text-white/60">{label}</span><span className="font-mono text-white">{value}</span></div><div className="h-2.5 overflow-hidden rounded-full bg-surface-2"><div className="h-full rounded-full bg-brand-500 transition-[width] duration-700" style={{ width: `${width}%` }}/></div></div>;
}

export default function ServerStats() {
  const { id = "" } = useParams();
  const { user, role } = useAuth();
  const [server, setServer] = useState<MinecraftServer | null>(null);
  const [orders, setOrders] = useState<ShopOrder[]>([]);
  useEffect(() => subscribeToServer(id, setServer), [id]);
  const allowed = !!server && (server.ownerId === user?.uid || (!!user && (server.managerIds ?? []).includes(user.uid)) || role === "owner" || role === "moderator");
  useEffect(() => allowed ? subscribeToOrders(id, setOrders) : undefined, [allowed, id]);
  const products = useMemo(() => { const counts = new Map<string, number>(); for (const order of orders) counts.set(order.itemName, (counts.get(order.itemName) ?? 0) + 1); return [...counts].sort((a, b) => b[1] - a[1]).slice(0, 6); }, [orders]);
  if (!server) return <div className="p-20 text-center text-white/40">Loading statistics…</div>;
  if (!allowed) return <div className="p-20 text-center text-white/40">Only the server owner and moderation staff can view these statistics.</div>;
  const metrics = [{ label: "World visits", value: server.visitsCount ?? 0, icon: Eye }, { label: "Code unlocks", value: server.joinsCount ?? 0, icon: KeyRound }, { label: "Shop orders", value: orders.length, icon: ShoppingBag }];
  const metricMax = Math.max(1, ...metrics.map((metric) => metric.value));
  return <div className="mx-auto max-w-4xl px-6 py-14"><Link to={`/server/${id}`} className="text-sm text-brand-400">← Back to server</Link><h1 className="mt-5 font-mono text-2xl font-bold text-white"><BarChart3 className="mr-2 inline"/>Server statistics</h1><p className="mt-2 text-sm text-white/45">Current lifetime activity for {server.name}.</p><div className="mt-8 grid gap-4 sm:grid-cols-3">{metrics.map(({ label, value, icon: Icon }) => <div key={label} className="rounded-2xl border border-border bg-surface p-5"><Icon size={18} className="text-brand-400"/><p className="mt-3 font-mono text-3xl font-bold text-white">{value}</p><p className="mt-1 text-xs text-white/40">{label}</p></div>)}</div><section className="mt-6 rounded-2xl border border-border bg-surface p-6"><h2 className="font-mono font-bold text-white">Engagement comparison</h2><p className="mt-1 mb-6 text-xs text-white/35">Lifetime totals; bars use the largest metric as the baseline.</p><div className="space-y-5">{metrics.map((metric) => <Bar key={metric.label} label={metric.label} value={metric.value} max={metricMax}/>)}</div></section><section className="mt-6 rounded-2xl border border-border bg-surface p-6"><h2 className="font-mono font-bold text-white">Popular shop items</h2><p className="mt-1 mb-6 text-xs text-white/35">Top products ranked by completed and pending orders.</p>{products.length === 0 ? <p className="py-8 text-center text-sm text-white/30">No shop orders yet.</p> : <div className="space-y-5">{products.map(([name, count]) => <Bar key={name} label={name} value={count} max={products[0][1]}/>)}</div>}</section></div>;
}
