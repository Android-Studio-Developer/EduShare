import { useEffect, useState, type ChangeEvent, type FormEvent } from "react";
import { Link, useParams } from "react-router-dom";
import { Check, Coins, Copy, ImagePlus, Plus, ShoppingBag } from "lucide-react";
import { useAuth } from "../context/AuthContext";
import { isAppwriteConfigured, uploadChatFile } from "../lib/appwrite";
import { subscribeToServer } from "../lib/servers";
import { addShopItem, buyShopItem, ensureWallet, fulfillOrder, subscribeToBalance, subscribeToOrders, subscribeToShopItems } from "../lib/shop";
import type { MinecraftServer, ShopItem, ShopOrder } from "../types";
import Button from "../components/Button";

const MAX_ITEM_IMAGE_BYTES = 20 * 1024 * 1024;

export default function ServerShop() {
  const { id = "" } = useParams();
  const { user, role } = useAuth();
  const [server, setServer] = useState<MinecraftServer | null>(null);
  const [items, setItems] = useState<ShopItem[]>([]);
  const [orders, setOrders] = useState<ShopOrder[]>([]);
  const [balance, setBalance] = useState(0);
  const [minecraftName, setMinecraftName] = useState("");
  const [message, setMessage] = useState("");
  const [draft, setDraft] = useState({ name: "", minecraftItemId: "minecraft:diamond_sword", price: 10, description: "" });
  const [draftImage, setDraftImage] = useState<{ imageId: string; imageUrl: string } | null>(null);
  const [uploadingImage, setUploadingImage] = useState(false);
  const staff = !!server && (server.ownerId === user?.uid || (!!user && (server.managerIds ?? []).includes(user.uid)) || role === "owner" || role === "moderator");

  async function handleImagePick(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    if (file.size > MAX_ITEM_IMAGE_BYTES) { setMessage("Image must be under 20MB."); return; }
    if (!isAppwriteConfigured) { setMessage("File uploads are not configured yet."); return; }
    setUploadingImage(true);
    try {
      const uploaded = await uploadChatFile(file);
      setDraftImage({ imageId: uploaded.fileId, imageUrl: uploaded.url });
    } catch {
      setMessage("Image upload failed.");
    } finally {
      setUploadingImage(false);
    }
  }

  useEffect(() => subscribeToServer(id, setServer), [id]);
  useEffect(() => subscribeToShopItems(id, setItems), [id]);
  useEffect(() => {
    if (!user) return;
    void ensureWallet(user.uid);
    return subscribeToBalance(user.uid, setBalance);
  }, [user]);
  useEffect(() => {
    if (!staff) return;
    return subscribeToOrders(id, setOrders);
  }, [id, staff]);

  async function createItem(event: FormEvent) {
    event.preventDefault();
    await addShopItem(id, { ...draft, ...(draftImage ?? {}) });
    setDraft({ name: "", minecraftItemId: "minecraft:diamond_sword", price: 10, description: "" });
    setDraftImage(null);
  }

  async function buy(item: ShopItem) {
    if (!user || !minecraftName.trim()) {
      setMessage("Enter your exact Minecraft player name first.");
      return;
    }
    try {
      if (!server) return;
      await buyShopItem(id, server.name, server.ownerId, item, user.uid, user.displayName ?? "Anonymous", minecraftName.trim());
      setMessage("Purchase sent to the server owner. They will manually give you the item in Minecraft.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Purchase failed.");
    }
  }

  return (
    <div className="mx-auto max-w-4xl px-6 py-14">
      <Link to={`/server/${id}`} className="text-sm text-brand-400">← Back to server</Link>
      <div className="mt-5 flex items-center justify-between gap-4">
        <div><h1 className="font-mono text-2xl font-bold text-white"><ShoppingBag className="mr-2 inline" />{server?.name ?? "Server"} Shop</h1></div>
        <span className="flex items-center gap-2 rounded-full border border-brand-500/30 bg-brand-500/10 px-4 py-2 font-mono text-sm text-brand-300"><Coins size={15} /> {balance} credits</span>
      </div>
      <input value={minecraftName} onChange={(event) => setMinecraftName(event.target.value)} placeholder="Your exact Minecraft player name" className="mt-8 w-full rounded-xl border border-border bg-surface px-4 py-3 text-white focus:outline-none" />
      {message && <p className="mt-3 text-sm text-brand-300">{message}</p>}
      <div className="mt-6 grid gap-4 sm:grid-cols-2">
        {items.map((item) => <article key={item.id} className="overflow-hidden rounded-2xl border border-border bg-surface">{item.imageUrl && <img src={item.imageUrl} alt="" className="h-36 w-full object-cover" />}<div className="p-5"><h2 className="font-mono font-bold text-white">{item.name}</h2><p className="mt-1 text-sm text-white/50">{item.description}</p><p className="mt-2 text-xs text-white/30">{item.minecraftItemId}</p><Button className="mt-5 w-full" onClick={() => buy(item)}><Coins size={15} /> Buy for {item.price}</Button></div></article>)}
      </div>
      {staff && <form onSubmit={createItem} className="mt-10 grid gap-3 rounded-2xl border border-border bg-surface p-6 sm:grid-cols-2"><h2 className="sm:col-span-2 font-mono font-bold text-white"><Plus className="mr-2 inline" size={16} />Add shop item</h2><input required placeholder="Display name" value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} className="rounded-xl border border-border bg-surface-2 px-4 py-3 text-white"/><input required placeholder="minecraft:diamond_sword" value={draft.minecraftItemId} onChange={(e) => setDraft({ ...draft, minecraftItemId: e.target.value })} className="rounded-xl border border-border bg-surface-2 px-4 py-3 text-white"/><input required min={1} type="number" value={draft.price} onChange={(e) => setDraft({ ...draft, price: Number(e.target.value) })} className="rounded-xl border border-border bg-surface-2 px-4 py-3 text-white"/><input required placeholder="Description" value={draft.description} onChange={(e) => setDraft({ ...draft, description: e.target.value })} className="rounded-xl border border-border bg-surface-2 px-4 py-3 text-white"/>
        <label className="cursor-target sm:col-span-2 flex items-center gap-3 rounded-xl border border-dashed border-border bg-surface-2 px-4 py-3 text-sm text-white/60 hover:border-brand-500/50">
          <ImagePlus size={16} className="shrink-0" />
          {uploadingImage ? "Uploading..." : draftImage ? "Image attached — click to replace" : "Attach item image (under 20MB)"}
          <input type="file" accept="image/*" onChange={handleImagePick} className="hidden" />
        </label>
        {draftImage && <img src={draftImage.imageUrl} alt="" className="sm:col-span-2 h-28 w-full rounded-xl object-cover" />}
        <Button type="submit" className="sm:col-span-2">Add item</Button></form>}
      {staff && <section className="mt-10"><h2 className="font-mono text-xl font-bold text-white">Fulfillment queue</h2><div className="mt-4 space-y-3">{orders.map((order) => { const command = `/give "${order.minecraftName}" ${order.minecraftItemId} 1`; return <div key={order.id} className="rounded-xl border border-border bg-surface p-4"><p className="text-sm text-white"><strong>{order.minecraftName}</strong> bought {order.itemName}</p><code className="mt-2 block break-all text-xs text-brand-300">{command}</code>{order.status === "pending" ? <div className="mt-3 flex gap-2"><Button size="sm" variant="secondary" onClick={() => navigator.clipboard.writeText(command)}><Copy size={13}/>Copy command</Button><Button size="sm" onClick={() => fulfillOrder(id, order.id)}><Check size={13}/>Mark fulfilled</Button></div> : <p className="mt-2 text-xs text-green-400">Fulfilled</p>}</div>; })}</div></section>}
    </div>
  );
}
