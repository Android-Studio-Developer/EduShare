import { useEffect, useState, type FormEvent, type ReactNode } from "react";
import { Blocks, Coins, Download, Globe2, Plus, Puzzle, Tag, Trash2, Wrench } from "lucide-react";
import { useAuth } from "../context/AuthContext";
import { isStaffRole } from "../lib/moderation";
import { createShare, deleteShare, isHttpsUrl, priceWithCode, purchaseShare, recordDownload, SHARE_DISCOUNT_CODE, SHARE_PRICE, subscribeToShares } from "../lib/shares";
import { ensureWallet, subscribeToBalance } from "../lib/shop";
import type { SharedFile, ShareType } from "../types";
import Button from "../components/Button";

const TYPE_LABEL: Record<ShareType, string> = { world: "World", mod: "Mod", addon: "Addon" };
const TYPE_ICON: Record<ShareType, ReactNode> = {
  world: <Globe2 size={13} className="inline" />,
  mod: <Wrench size={13} className="inline" />,
  addon: <Puzzle size={13} className="inline" />,
};

export default function Shares() {
  const { user, role } = useAuth();
  const isStaff = isStaffRole(role);
  const [shares, setShares] = useState<SharedFile[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [type, setType] = useState<ShareType>("world");
  const [downloadUrl, setDownloadUrl] = useState("");
  const [imageUrl, setImageUrl] = useState("");
  const [price, setPrice] = useState(String(SHARE_PRICE));
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [balance, setBalance] = useState(0);
  const [promoCode, setPromoCode] = useState("");
  const [purchasedIds, setPurchasedIds] = useState<Set<string>>(new Set());
  const [purchasingId, setPurchasingId] = useState<string | null>(null);
  const [buyMessage, setBuyMessage] = useState("");

  useEffect(() => subscribeToShares(setShares), []);
  useEffect(() => {
    if (!user) return;
    void ensureWallet(user.uid);
    return subscribeToBalance(user.uid, setBalance);
  }, [user]);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!user) return;
    setError("");
    if (!isHttpsUrl(downloadUrl)) {
      setError("Download link must be a valid https:// URL.");
      return;
    }
    setSubmitting(true);
    try {
      await createShare({
        name: name.trim(),
        description: description.trim(),
        type,
        downloadUrl: downloadUrl.trim(),
        imageUrl: imageUrl.trim(),
        authorId: user.uid,
        authorName: user.displayName ?? "Player",
        price: Number(price) || 0,
      });
      setName(""); setDescription(""); setDownloadUrl(""); setImageUrl(""); setType("world"); setPrice(String(SHARE_PRICE)); setShowForm(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not submit.");
    } finally {
      setSubmitting(false);
    }
  }

  function openDownload(share: SharedFile) {
    void recordDownload(share.id);
    window.open(share.downloadUrl, "_blank", "noopener,noreferrer");
  }

  async function handleBuy(share: SharedFile) {
    if (!user) return;
    const charged = priceWithCode(share.price ?? 150, promoCode);
    setPurchasingId(share.id);
    setBuyMessage("");
    try {
      await purchaseShare(user.uid, charged);
      setPurchasedIds((prev) => new Set(prev).add(share.id));
      openDownload(share);
    } catch (err) {
      setBuyMessage(err instanceof Error ? err.message : "Purchase failed.");
    } finally {
      setPurchasingId(null);
    }
  }

  async function handleDelete(id: string) {
    if (!confirm("Delete this share permanently?")) return;
    await deleteShare(id);
  }

  return (
    <div className="mx-auto max-w-4xl px-6 py-14">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <Blocks size={26} className="text-brand-400" />
          <div>
            <h1 className="font-mono text-2xl font-bold text-white">Worlds & Mods</h1>
            <p className="text-sm text-white/45">Share worlds, mods and addons with a download link.</p>
          </div>
        </div>
        <Button size="sm" onClick={() => setShowForm((s) => !s)}>
          <Plus size={15} /> Share a file
        </Button>
      </div>

      {user && (
        <div className="mt-4 flex flex-wrap items-center gap-3">
          <span className="flex items-center gap-1.5 rounded-full border border-brand-500/30 bg-brand-500/10 px-4 py-2 font-mono text-sm text-brand-300">
            <Coins size={15} /> {balance} credits
          </span>
          <div className="relative">
            <Tag size={13} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-white/30" />
            <input
              value={promoCode}
              onChange={(e) => { setPromoCode(e.target.value); setBuyMessage(""); }}
              placeholder="Promo code"
              className="w-40 rounded-full border border-border bg-surface-2 py-2 pl-8 pr-3 text-xs text-white placeholder:text-white/30 focus:border-brand-500/50 focus:outline-none"
            />
          </div>
          {promoCode.trim().toUpperCase() === SHARE_DISCOUNT_CODE && (
            <span className="font-mono text-xs text-emerald-400">30% off applied!</span>
          )}
        </div>
      )}
      {buyMessage && <p className="mt-2 text-sm text-red-400">{buyMessage}</p>}

      {showForm && (
        <form onSubmit={handleSubmit} className="mt-6 space-y-3 rounded-2xl border border-border bg-surface p-6">
          <div className="grid gap-3 sm:grid-cols-2">
            <input required value={name} onChange={(e) => setName(e.target.value)} placeholder="Name" className="w-full rounded-xl border border-border bg-surface-2 px-4 py-3 text-white" />
            <div className="flex gap-2">
              {(Object.keys(TYPE_LABEL) as ShareType[]).map((t) => (
                <button
                  key={t}
                  type="button"
                  onClick={() => setType(t)}
                  className={`cursor-target flex flex-1 items-center justify-center gap-1.5 rounded-xl border px-3 py-3 font-mono text-xs font-medium transition-colors ${
                    type === t
                      ? "border-brand-300/45 bg-brand-500/15 text-blue-100"
                      : "border-border bg-surface-2 text-white/50 hover:text-white"
                  }`}
                >
                  {TYPE_ICON[t]} {TYPE_LABEL[t]}
                </button>
              ))}
            </div>
          </div>
          <textarea required maxLength={500} rows={3} value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Description" className="w-full rounded-xl border border-border bg-surface-2 px-4 py-3 text-white" />
          <input required value={downloadUrl} onChange={(e) => setDownloadUrl(e.target.value)} placeholder="Download link (https://...)" className="w-full rounded-xl border border-border bg-surface-2 px-4 py-3 text-white" />
          <input type="url" value={imageUrl} onChange={(e) => setImageUrl(e.target.value)} placeholder="Preview image URL (optional)" className="w-full rounded-xl border border-border bg-surface-2 px-4 py-3 text-white" />
          <div className="relative">
            <Coins size={15} className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-amber-300" />
            <input required type="number" min={0} max={100000} step={1} value={price} onChange={(e) => setPrice(e.target.value)} placeholder="Price in credits" className="w-full rounded-xl border border-border bg-surface-2 py-3 pl-11 pr-4 text-white" />
          </div>
          {error && <p className="text-sm text-red-400">{error}</p>}
          <Button type="submit" disabled={submitting} className="w-full">Submit</Button>
        </form>
      )}

      <div className="mt-8 grid grid-cols-1 gap-4 sm:grid-cols-2">
        {shares.map((share) => (
          <article key={share.id} className="flex flex-col rounded-2xl border border-border bg-surface p-5">
            {share.imageUrl && <img src={share.imageUrl} alt="" className="mb-3 h-32 w-full rounded-xl object-cover" />}
            <div className="flex items-center justify-between gap-2">
              <span className="font-mono font-semibold text-white">{share.name}</span>
              <span className="flex shrink-0 items-center gap-1 rounded-full border border-border px-2 py-0.5 text-[11px] text-white/45">{TYPE_ICON[share.type]} {TYPE_LABEL[share.type]}</span>
            </div>
            <p className="mt-1 flex-1 text-sm text-white/50">{share.description}</p>
            <p className="mt-2 text-xs text-white/35">by {share.authorName} · {share.downloadCount ?? 0} downloads</p>
            {(() => {
              const price = share.price ?? 150;
              const charged = priceWithCode(price, promoCode);
              const discounted = charged < price;
              const owned = purchasedIds.has(share.id);
              return (
                <>
                  <p className="mt-2 flex items-center gap-1.5 font-mono text-xs text-amber-300">
                    <Coins size={13} />
                    {owned ? "Purchased" : discounted ? (
                      <span><span className="text-white/30 line-through">{price}</span> {charged} credits</span>
                    ) : (
                      <span>{price} credits</span>
                    )}
                  </p>
                  <div className="mt-3 flex items-center gap-2">
                    <Button
                      size="sm"
                      onClick={() => (owned ? openDownload(share) : handleBuy(share))}
                      disabled={purchasingId === share.id || (!owned && balance < charged)}
                      className="flex-1"
                    >
                      <Download size={14} /> {owned ? "Download" : purchasingId === share.id ? "Buying..." : `Buy for ${charged}`}
                    </Button>
                    {(isStaff || share.authorId === user?.uid) && (
                      <Button size="sm" variant="ghost" onClick={() => handleDelete(share.id)} aria-label="Delete">
                        <Trash2 size={14} />
                      </Button>
                    )}
                  </div>
                </>
              );
            })()}
          </article>
        ))}
        {shares.length === 0 && (
          <div className="col-span-full rounded-2xl border border-dashed border-border py-16 text-center text-white/40">
            No worlds or mods shared yet. Be the first!
          </div>
        )}
      </div>
    </div>
  );
}
