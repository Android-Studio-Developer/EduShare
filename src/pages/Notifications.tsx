import { useEffect, useState } from "react";
import { Bell, Check, Volume2, VolumeX } from "lucide-react";
import { Link } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { markNotificationRead, subscribeToNotifications } from "../lib/notifications";
import { markShopNotificationRead, subscribeToShopNotifications } from "../lib/shop";
import type { ShopNotification, SiteNotification } from "../types";
import { notificationsAreSilent, setNotificationsSilent } from "../lib/notificationPreferences";

export default function Notifications() {
  const { user } = useAuth();
  const [general, setGeneral] = useState<SiteNotification[]>([]);
  const [shops, setShops] = useState<ShopNotification[]>([]);
  const [silent, setSilent] = useState(notificationsAreSilent);
  const [permission, setPermission] = useState<NotificationPermission>(() => "Notification" in window ? Notification.permission : "denied");
  useEffect(() => user ? subscribeToNotifications(user.uid, setGeneral) : undefined, [user]);
  useEffect(() => user ? subscribeToShopNotifications(user.uid, setShops) : undefined, [user]);
  const entries = [...general.map((n) => ({ id:n.id, title:n.title, message:n.message, link:n.link, read:n.read, createdAt:n.createdAt, mark:() => markNotificationRead(n.id) })), ...shops.map((n) => ({ id:n.id, title:"New shop order", message:`${n.buyerName} bought ${n.itemName} from ${n.serverName}.`, link:`/server/${n.serverId}/shop`, read:n.read, createdAt:n.createdAt, mark:() => markShopNotificationRead(n.id) }))].sort((a,b)=>b.createdAt-a.createdAt);

  function toggleSilent() {
    const next = !silent;
    setSilent(next);
    setNotificationsSilent(next);
  }
  async function enableBrowserNotifications() {
    if (!("Notification" in window)) return;
    const result = await Notification.requestPermission();
    setPermission(result);
  }

  return <div className="mx-auto max-w-3xl px-6 py-14">
    <div className="flex flex-wrap items-center justify-between gap-3">
      <h1 className="font-mono text-2xl font-bold text-white"><Bell className="mr-2 inline text-cyan-300"/>Notifications</h1>
      <div className="flex gap-2">
        <button onClick={toggleSilent} className="rounded-xl border border-border bg-surface px-3 py-2 text-xs text-white/70 hover:text-white">{silent ? <VolumeX size={14} className="mr-1 inline"/> : <Volume2 size={14} className="mr-1 inline"/>}{silent ? "Silent mode" : "Ping sound on"}</button>
        {permission !== "granted" && <button onClick={enableBrowserNotifications} className="rounded-xl border border-cyan-400/30 bg-cyan-400/10 px-3 py-2 text-xs text-cyan-200">Enable Chrome notifications</button>}
        {permission === "granted" && <span className="rounded-xl border border-emerald-400/20 px-3 py-2 text-xs text-emerald-300">Browser notifications on</span>}
      </div>
    </div>
    <p className="mt-2 text-xs text-white/35">Silent mode keeps mention notifications visible but mutes the Discord-style ping sound.</p>
    <div className="mt-8 space-y-3">{entries.length===0&&<p className="rounded-2xl border border-dashed border-border p-16 text-center text-white/35">You are all caught up.</p>}{entries.map((entry)=><Link key={`${entry.id}-${entry.createdAt}`} to={entry.link} onClick={entry.mark} className={`block rounded-2xl border p-5 transition-colors ${entry.read?"border-border bg-surface/60":"border-cyan-300/30 bg-cyan-400/10"}`}><div className="flex justify-between gap-3"><h2 className="font-mono font-bold text-white">{entry.title}</h2>{entry.read&&<Check size={14} className="text-emerald-300"/>}</div><p className="mt-2 text-sm text-white/60">{entry.message}</p><p className="mt-2 text-[11px] text-white/25">{new Date(entry.createdAt).toLocaleString()}</p></Link>)}</div>
  </div>;
}
