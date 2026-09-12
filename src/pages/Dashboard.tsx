import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import { deleteDoc, doc } from "firebase/firestore";
import { BarChart3, Copy, ExternalLink, Handshake, Plus, Radio, ShoppingBag, Trash2, Users } from "lucide-react";
import { useAuth } from "../context/AuthContext";
import { setServerOnline, setServerShopEnabled, subscribeToMyServers } from "../lib/servers";
import { db } from "../lib/firebase";
import type { MinecraftServer } from "../types";
import Button from "../components/Button";
import { getIcon } from "../lib/icons";
import { markShopNotificationRead, subscribeToShopNotifications } from "../lib/shop";
import { submitPartnerRequest, subscribeToMyPartnerRequests } from "../lib/partnerRequests";
import type { PartnerRequest, ShopNotification } from "../types";

export default function Dashboard() {
  const { user } = useAuth();
  const [servers, setServers] = useState<MinecraftServer[]>([]);
  const [loading, setLoading] = useState(true);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [shopNotifications, setShopNotifications] = useState<ShopNotification[]>([]);
  const [partnerRequestFor, setPartnerRequestFor] = useState<MinecraftServer | null>(null);
  const [partnerMessage, setPartnerMessage] = useState("");
  const [partnerContact, setPartnerContact] = useState("");
  const [partnerStatus, setPartnerStatus] = useState("");
  const [partnerSubmitting, setPartnerSubmitting] = useState(false);
  const [partnerRequests, setPartnerRequests] = useState<PartnerRequest[]>([]);

  useEffect(() => {
    if (!user) return;
    const unsub = subscribeToMyServers(user.uid, (s) => {
      setServers(s);
      setLoading(false);
    });
    return unsub;
  }, [user]);

  useEffect(() => {
    if (!user) return;
    return subscribeToShopNotifications(user.uid, setShopNotifications);
  }, [user]);

  useEffect(() => {
    if (!user) return;
    return subscribeToMyPartnerRequests(user.uid, setPartnerRequests);
  }, [user]);

  async function handleCopy(id: string, code: string[]) {
    const readable = code.map((iconId) => getIcon(iconId).label).join(", ");
    await navigator.clipboard.writeText(readable);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 1500);
  }

  async function handleDelete(id: string) {
    if (!confirm("Remove this server permanently?")) return;
    await deleteDoc(doc(db, "servers", id));
  }

  async function handleToggleOnline(server: MinecraftServer) {
    if (!user) return;
    await setServerOnline(server.id, server.name, !!server.isOnline, user.uid);
  }

  async function handleSubmitPartnerRequest() {
    if (!user || !partnerRequestFor) return;
    setPartnerSubmitting(true);
    setPartnerStatus("");
    try {
      await submitPartnerRequest(user.uid, partnerRequestFor.id, partnerRequestFor.name, partnerMessage, partnerContact);
      setPartnerStatus("Sent! The SpawnDex owner will review it.");
      setPartnerMessage("");
      setPartnerContact("");
    } catch (error) {
      setPartnerStatus(error instanceof Error ? error.message : "Could not send that.");
    } finally {
      setPartnerSubmitting(false);
    }
  }

  return (
    <div className="mx-auto max-w-4xl px-6 py-14">
      <div className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="font-mono text-2xl font-bold text-white">Your servers</h1>
          <p className="mt-1 text-sm text-white/45">Manage the servers you've registered.</p>
        </div>
        <Link to="/create">
          <Button>
            <Plus size={16} /> New server
          </Button>
        </Link>
      </div>

      {shopNotifications.some((notification) => !notification.read) && (
        <div className="mb-6 rounded-2xl border border-brand-500/40 bg-brand-500/10 p-5">
          <h2 className="font-mono font-bold text-brand-300">New shop purchases</h2>
          <div className="mt-3 space-y-2">
            {shopNotifications.filter((notification) => !notification.read).map((notification) => (
              <div key={notification.id} className="flex flex-wrap items-center justify-between gap-3 text-sm text-white/70">
                <span><strong>{notification.buyerName}</strong> bought {notification.itemName} from {notification.serverName}.</span>
                <Link to={`/server/${notification.serverId}/shop`} onClick={() => markShopNotificationRead(notification.id)} className="text-brand-300 hover:underline">View order →</Link>
              </div>
            ))}
          </div>
        </div>
      )}

      {loading ? (
        <div className="space-y-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="h-24 animate-pulse rounded-2xl border border-border bg-surface" />
          ))}
        </div>
      ) : servers.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border py-20 text-center text-white/40">
          You haven't registered a server yet.
          <div className="mt-4">
            <Link to="/create" className="cursor-target text-brand-400 hover:underline">
              Register your first one →
            </Link>
          </div>
        </div>
      ) : (
        <div className="space-y-3">
          {servers.map((server, i) => {
            const latestPartnerRequest = partnerRequests
              .filter((request) => request.serverId === server.id)
              .sort((a, b) => b.createdAt - a.createdAt)[0];
            return (
            <motion.div
              key={server.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.04 }}
              className="flex flex-col gap-4 rounded-2xl border border-border bg-surface p-5 sm:flex-row sm:items-center sm:justify-between"
            >
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <span className="rounded-full bg-brand-500/10 px-2 py-0.5 font-mono text-[11px] font-semibold text-brand-300">
                    {server.subject}
                  </span>
                  <h3 className="truncate font-mono font-semibold text-white">{server.name}</h3>
                </div>
                <button
                  type="button"
                  onClick={() => handleToggleOnline(server)}
                  className={`cursor-target mt-2 flex w-fit items-center gap-1.5 rounded-full border px-2.5 py-0.5 font-mono text-[11px] font-semibold transition-colors ${
                    server.isOnline
                      ? "border-brand-500/40 bg-brand-500/10 text-brand-300 hover:border-brand-500/70"
                      : "border-border bg-surface-2 text-white/40 hover:text-white/70"
                  }`}
                >
                  <Radio size={10} className={server.isOnline ? "animate-pulse" : ""} />
                  {server.isOnline ? "Online now" : "Offline"}
                </button>
                <div className="mt-2 flex items-center gap-4 text-xs text-white/45">
                  <span className="flex items-center gap-1">
                    <Users size={12} /> {server.joinsCount} unlocked
                  </span>
                  <span className="flex items-center gap-1">
                    {server.code.map((iconId, idx) => {
                      const icon = getIcon(iconId);
                      return (
                        <img
                          key={idx}
                          src={icon.src}
                          alt={icon.label}
                          className="pixel-icon h-3.5 w-3.5 object-contain"
                        />
                      );
                    })}
                  </span>
                </div>
              </div>

              <div className="flex shrink-0 items-center gap-2">
                <Link to={`/server/${server.id}/stats`}><Button variant="ghost" size="sm" aria-label="Statistics"><BarChart3 size={14}/></Button></Link>
                <Button variant="secondary" size="sm" onClick={() => setServerShopEnabled(server.id, !server.hasShop)}>
                  <ShoppingBag size={14} /> {server.hasShop ? "Disable shop" : "Enable shop"}
                </Button>
                <Button variant="secondary" size="sm" onClick={() => handleCopy(server.id, server.code)}>
                  <Copy size={14} /> {copiedId === server.id ? "Copied" : "Copy code"}
                </Button>
                {!server.isPartner && latestPartnerRequest?.status !== "open" && (
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() => {
                      setPartnerRequestFor(partnerRequestFor?.id === server.id ? null : server);
                      setPartnerStatus("");
                    }}
                  >
                    <Handshake size={14} /> {latestPartnerRequest?.status === "declined" ? "Request again" : "Request Partner"}
                  </Button>
                )}
                {!server.isPartner && latestPartnerRequest?.status === "open" && (
                  <span className="rounded-lg border border-amber-400/25 bg-amber-400/[.07] px-3 py-1.5 text-xs font-semibold text-amber-300">
                    Partner request pending
                  </span>
                )}
                {server.isPartner && (
                  <span className="rounded-lg border border-violet-400/25 bg-violet-400/[.08] px-3 py-1.5 text-xs font-semibold text-violet-300">
                    SpawnDex Partner
                  </span>
                )}
                <Link to={`/server/${server.id}`}>
                  <Button variant="ghost" size="sm">
                    <ExternalLink size={14} />
                  </Button>
                </Link>
                <Button variant="danger" size="sm" onClick={() => handleDelete(server.id)}>
                  <Trash2 size={14} />
                </Button>
              </div>
            </motion.div>
            );
          })}
          {partnerRequestFor && (
            <div className="rounded-2xl border border-brand-500/30 bg-brand-500/5 p-5">
              <h3 className="flex items-center gap-2 font-mono font-bold text-white"><Handshake size={16} className="text-brand-300" /> Request Partner — {partnerRequestFor.name}</h3>
              <p className="mt-1 text-xs text-white/40">Tell the SpawnDex owner why your server should be a partner and what perks you're offering players.</p>
              <textarea
                value={partnerMessage}
                onChange={(e) => setPartnerMessage(e.target.value)}
                maxLength={500}
                rows={4}
                placeholder="What makes your server a good fit, what perks are you offering..."
                className="mt-3 w-full resize-y rounded-xl border border-border bg-surface-2 px-4 py-3 text-sm text-white placeholder:text-white/30 focus:border-brand-500/50 focus:outline-none"
              />
              <input
                value={partnerContact}
                onChange={(e) => setPartnerContact(e.target.value)}
                maxLength={200}
                placeholder="Best way to reach you (optional)"
                className="mt-2 w-full rounded-xl border border-border bg-surface-2 px-4 py-3 text-sm text-white placeholder:text-white/30 focus:border-brand-500/50 focus:outline-none"
              />
              {partnerStatus && <p className="mt-2 text-sm text-brand-300">{partnerStatus}</p>}
              <div className="mt-3 flex gap-2">
                <Button size="sm" disabled={partnerSubmitting || !partnerMessage.trim()} onClick={handleSubmitPartnerRequest}>
                  {partnerSubmitting ? "Sending..." : "Send request"}
                </Button>
                <Button size="sm" variant="ghost" onClick={() => setPartnerRequestFor(null)}>Cancel</Button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
