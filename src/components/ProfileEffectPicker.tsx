import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Ban, Check, Eye, Lock, ShoppingBag, Sparkles, Store, X } from "lucide-react";
import { useAuth } from "../context/AuthContext";
import { isReduceMotion } from "../lib/accessibility";
import { subscribeToProfile } from "../lib/profiles";
import { subscribeToBalance } from "../lib/shop";
import { isPromoCode, PROMO_CODE, discountedCost } from "../lib/ranks";
import { PROFILE_EFFECTS, equipCosmetic, purchaseAndEquipProfileEffect, type CosmeticItem } from "../lib/cosmetics";
import type { UserProfile } from "../types";
import BannerEffect from "./BannerEffect";
import EvilEye from "./EvilEye";
import ProfileBannerMedia from "./ProfileBannerMedia";

function EffectArtwork({ item }: { item: CosmeticItem }) {
  if (item.id === "profile-evil-eye") {
    if (isReduceMotion()) return <div className="absolute inset-0 grid place-items-center bg-[#17181c] text-white/40"><Eye size={18} /></div>;
    return <div className="absolute inset-0 overflow-hidden bg-[#17181c]"><EvilEye scale={0.34} intensity={1.15} glowIntensity={0.45} /></div>;
  }

  if (item.id === "profile-basic-cherry-blossom") {
    return (
      <div className={`profile-effect-${item.id} absolute inset-2 overflow-hidden rounded-lg bg-[#202126]`}>
        <div className="cherry-blossom-wreath-preview">
          <span className="cherry-blossom-avatar-preview"><span /><span /></span>
        </div>
      </div>
    );
  }

  if (item.id === "profile-exclusive-developer-nameplate") {
    return (
      <div className={`profile-effect-${item.id} absolute inset-2 overflow-hidden rounded-lg bg-[#202126]`}>
        <div className="developer-nameplate-preview"><span className="developer-flame-preview" /><strong>DEVELOPER</strong></div>
      </div>
    );
  }

  return (
    <div className={`profile-effect-${item.id} absolute inset-2 overflow-hidden rounded-lg bg-[#202126]`}>
      <span className="absolute left-2 top-2 h-5 w-5 rounded-full bg-white/10" />
      <span className="absolute bottom-3 left-2 h-1.5 w-[62%] rounded-full bg-white/15" />
      <span className="absolute bottom-6 left-2 h-1.5 w-[38%] rounded-full bg-white/10" />
    </div>
  );
}

function EffectTile({ item, selected, owned, onSelect }: { item: CosmeticItem; selected: boolean; owned: boolean; onSelect: () => void }) {
  return (
    <button
      type="button"
      onClick={onSelect}
      aria-pressed={selected}
      aria-label={`${item.label}${owned ? "" : `, ${item.cost} credits`}`}
      className={`cursor-target group relative aspect-[1.35] min-h-24 overflow-hidden rounded-lg border-2 bg-[#17181c] text-left transition-all ${selected ? "border-[#5865f2] shadow-[0_0_0_1px_#5865f2]" : "border-transparent hover:border-white/20"}`}
    >
      <EffectArtwork item={item} />
      <span className="absolute inset-x-0 bottom-0 z-20 flex items-center justify-between bg-gradient-to-t from-black/90 to-transparent px-2 pb-1.5 pt-5 text-[10px] font-semibold text-white/85">
        <span className="truncate">{item.label}</span>
        {!owned && <span className="ml-1 shrink-0 text-white/55">{item.cost}cr</span>}
      </span>
      {!owned && <span className="absolute right-1.5 top-1.5 z-30 grid h-5 w-5 place-items-center rounded-full bg-black/80 text-white"><Lock size={11} /></span>}
      {selected && <span className="absolute left-1.5 top-1.5 z-30 grid h-5 w-5 place-items-center rounded-full bg-[#5865f2] text-white"><Check size={11} strokeWidth={3} /></span>}
    </button>
  );
}

function PreviewCard({ profile, selectedId }: { profile: UserProfile; selectedId: string }) {
  const initial = profile.displayName.trim().slice(0, 1).toUpperCase() || "?";

  if (selectedId === "profile-exclusive-developer-nameplate") {
    return (
      <div className="w-full rounded-xl border border-white/10 bg-[#111214] p-5 shadow-2xl">
        <p className="mb-3 font-mono text-xs font-semibold uppercase tracking-wide text-white/50">Online now — 1</p>
        <div className="online-member-row online-member-row--nameplate nameplate-effect-profile-exclusive-developer-nameplate flex items-center gap-2">
          <div className="online-member-avatar relative shrink-0">
            {profile.photoUrl ? <img src={profile.photoUrl} alt="" className="h-7 w-7 rounded-full object-cover" /> : <div className="grid h-7 w-7 place-items-center rounded-full bg-gradient-to-br from-cyan-400 to-fuchsia-500 text-[10px] font-bold text-white">{initial}</div>}
            <span className="absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 rounded-full border-2 border-[#111214] bg-[#23a55a]" />
          </div>
          <span className="developer-row-flame" aria-hidden="true" />
          <span className="min-w-0 flex-1 truncate text-xs font-semibold text-white">{profile.displayName || "SpawnDex member"}</span>
        </div>
      </div>
    );
  }

  return (
    <div className={`relative w-full overflow-hidden rounded-xl border border-white/10 bg-[#111214] shadow-2xl ${selectedId ? `profile-effect-${selectedId}` : ""}`}>
      {selectedId === "profile-evil-eye" && !isReduceMotion() && <div className="pointer-events-none absolute inset-0 z-20 overflow-hidden opacity-25"><EvilEye scale={0.58} intensity={1.1} glowIntensity={0.35} /></div>}
      <div className="profile-card-banner relative h-32 overflow-hidden bg-gradient-to-r from-[#5865f2] via-[#7c4dff] to-[#eb459e] bg-cover bg-center">
        {profile.bannerUrl && <ProfileBannerMedia value={profile.bannerUrl} />}
        {profile.bannerEffect && <BannerEffect effect={profile.bannerEffect} />}
      </div>
      <div className="relative px-5 pb-5 pt-12">
        <div className="profile-card-avatar absolute -top-11 left-5 rounded-full border-[6px] border-[#111214] bg-[#111214]">
          {profile.photoUrl ? <img src={profile.photoUrl} alt="" className="h-20 w-20 rounded-full object-cover" /> : <div className="grid h-20 w-20 place-items-center rounded-full bg-gradient-to-br from-cyan-400 to-fuchsia-500 text-2xl font-bold text-white">{initial}</div>}
          <span className="absolute bottom-0 right-0 h-5 w-5 rounded-full border-4 border-[#111214] bg-[#23a55a]" />
        </div>
        <div className="profile-card-nameplate w-fit"><h3 className="truncate text-xl font-bold text-white">{profile.displayName || "SpawnDex member"}</h3></div>
        <p className="truncate text-sm text-[#b5bac1]">{profile.username ? `@${profile.username}` : "@player"}</p>
        <div className="mt-4 rounded-lg bg-[#232428] p-3.5">
          <p className="text-[11px] font-bold uppercase tracking-wide text-white">About me</p>
          <p className="mt-1 line-clamp-3 min-h-10 text-xs leading-relaxed text-[#dbdee1]">{profile.bio || profile.favoriteGames || "Building, learning, and hanging out on SpawnDex."}</p>
          <button type="button" tabIndex={-1} className="mt-3 w-full rounded-md bg-[#5865f2] px-3 py-2 text-sm font-semibold text-white">View full profile</button>
        </div>
      </div>
    </div>
  );
}

export default function ProfileEffectPicker({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { user } = useAuth();
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [balance, setBalance] = useState(0);
  const [selectedId, setSelectedId] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [promoInput, setPromoInput] = useState("");
  const [promoApplied, setPromoApplied] = useState(false);
  const initializedForOpen = useRef(false);

  useEffect(() => { if (user) return subscribeToProfile(user.uid, setProfile); }, [user]);
  useEffect(() => { if (user) return subscribeToBalance(user.uid, setBalance); }, [user]);
  useEffect(() => {
    if (!open) {
      initializedForOpen.current = false;
      return;
    }
    if (!profile || initializedForOpen.current) return;
    initializedForOpen.current = true;
    setSelectedId(profile.profileEffect === "profile-exclusive-developer-nameplate" ? "" : (profile.profileEffect || ""));
    setError("");
  }, [open, profile]);

  const basicEffects = useMemo(() => PROFILE_EFFECTS.filter((item) => item.tier === "basic"), []);
  const advancedEffects = useMemo(() => PROFILE_EFFECTS.filter((item) => item.tier === "advanced"), []);
  const exclusiveEffects = useMemo(() => PROFILE_EFFECTS.filter((item) => item.tier === "exclusive"), []);

  if (!open || !user || !profile) return null;

  const userId = user.uid;
  const owned = profile.ownedCosmetics ?? [];
  const selectedItem = PROFILE_EFFECTS.find((item) => item.id === selectedId) ?? null;
  const isOwned = !selectedId || owned.includes(selectedId);
  const isEquipped = selectedId === (profile.profileEffect || "");
  const cost = selectedItem ? discountedCost(selectedItem.cost, promoApplied ? PROMO_CODE : "") : 0;
  const firstShopItem = PROFILE_EFFECTS.find((item) => !owned.includes(item.id));
  const shopBasicEffects = basicEffects.filter((item) => !owned.includes(item.id));
  const shopAdvancedEffects = advancedEffects.filter((item) => !owned.includes(item.id));
  const shopExclusiveEffects = exclusiveEffects.filter((item) => !owned.includes(item.id));

  async function handlePrimary() {
    setError("");
    setBusy(true);
    try {
      if (!isOwned && selectedItem) {
        await purchaseAndEquipProfileEffect(userId, selectedItem.id, promoApplied ? PROMO_CODE : "");
      } else {
        await equipCosmetic(userId, selectedId, "profileEffect");
      }
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not update profile effect.");
    } finally {
      setBusy(false);
    }
  }

  return createPortal(
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 p-3 backdrop-blur-[2px] sm:p-6" role="dialog" aria-modal="true" aria-labelledby="profile-effect-title" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
      <div className="grid h-[calc(100dvh-1.5rem)] w-full max-w-[940px] grid-rows-[auto_minmax(0,1fr)_auto] overflow-hidden rounded-xl border border-white/10 bg-[#2b2d31] text-[#dbdee1] shadow-[0_24px_80px_rgba(0,0,0,.65)] sm:h-[min(760px,92dvh)]">
        <header className="flex items-center justify-between border-b border-black/20 px-5 py-4 sm:px-6">
          <div>
            <h2 id="profile-effect-title" className="text-lg font-bold text-white">Change profile effect</h2>
            <p className="mt-0.5 text-xs text-[#949ba4]">Preview an effect before applying it to your profile card.</p>
          </div>
          <button type="button" onClick={onClose} className="cursor-target rounded-md p-2 text-[#b5bac1] hover:bg-white/5 hover:text-white" aria-label="Close"><X size={22} /></button>
        </header>

        <div className="grid min-h-0 grid-cols-1 overflow-y-auto md:grid-cols-[minmax(0,1.05fr)_minmax(310px,.95fr)] md:overflow-hidden">
          <section className="min-h-0 border-b border-black/20 p-5 md:overflow-y-auto md:border-b-0 md:border-r sm:p-6">
            <p className="text-sm font-bold text-white">My effects</p>
            <div className="mt-3 grid grid-cols-2 gap-3">
              <button type="button" onClick={() => setSelectedId("")} className={`cursor-target flex h-20 flex-col items-center justify-center gap-1 rounded-lg border-2 bg-[#1e1f22] text-xs font-semibold transition-colors ${selectedId === "" ? "border-[#5865f2] text-white" : "border-transparent text-[#b5bac1] hover:bg-[#232428]"}`}><Ban size={25} />None</button>
              <button type="button" onClick={() => firstShopItem && setSelectedId(firstShopItem.id)} className="cursor-target flex h-20 flex-col items-center justify-center gap-1 rounded-lg border-2 border-transparent bg-[#1e1f22] text-xs font-semibold text-[#b5bac1] transition-colors hover:bg-[#232428] hover:text-white"><Store size={25} />Shop</button>
            </div>

            {owned.length > 0 && <><p className="mt-6 flex items-center gap-2 text-sm font-bold text-white"><Sparkles size={15} /> Owned</p><div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-3">{PROFILE_EFFECTS.filter((item) => owned.includes(item.id)).map((item) => <EffectTile key={`owned-${item.id}`} item={item} selected={selectedId === item.id} owned onSelect={() => setSelectedId(item.id)} />)}</div></>}

            {firstShopItem ? (
              <>
                <p className="mt-6 flex items-center gap-2 text-sm font-bold text-white"><ShoppingBag size={15} /> Available in the shop</p>
                <p className="mt-1 text-xs text-[#949ba4]">Effects can be previewed before purchase.</p>
                {shopBasicEffects.length > 0 && <><p className="mt-4 text-[11px] font-bold uppercase tracking-wider text-[#949ba4]">Basic</p><div className="mt-2 grid grid-cols-2 gap-3 sm:grid-cols-3">{shopBasicEffects.map((item) => <EffectTile key={item.id} item={item} selected={selectedId === item.id} owned={false} onSelect={() => setSelectedId(item.id)} />)}</div></>}
                {shopAdvancedEffects.length > 0 && <><p className="mt-5 text-[11px] font-bold uppercase tracking-wider text-[#949ba4]">Advanced</p><div className="mt-2 grid grid-cols-2 gap-3 sm:grid-cols-3">{shopAdvancedEffects.map((item) => <EffectTile key={item.id} item={item} selected={selectedId === item.id} owned={false} onSelect={() => setSelectedId(item.id)} />)}</div></>}
                {shopExclusiveEffects.length > 0 && <><p className="mt-5 flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-amber-300"><Sparkles size={12}/> Exclusive bundle</p><div className="mt-2 grid grid-cols-2 gap-3 sm:grid-cols-3">{shopExclusiveEffects.map((item) => <EffectTile key={item.id} item={item} selected={selectedId === item.id} owned={false} onSelect={() => setSelectedId(item.id)} />)}</div></>}
              </>
            ) : (
              <p className="mt-6 rounded-lg bg-[#1e1f22] px-3 py-3 text-xs text-[#b5bac1]">You own every profile effect.</p>
            )}
          </section>

          <aside className="flex min-h-0 flex-col bg-[#242529] p-5 md:overflow-y-auto sm:p-6">
            <PreviewCard profile={profile} selectedId={selectedId} />
            <div className="mt-4 rounded-lg border border-white/10 bg-[#1e1f22] p-3.5">
              <div className="flex items-center justify-between gap-3">
                <div><p className="font-semibold text-white">{selectedItem?.label ?? "No profile effect"}</p><p className="mt-0.5 text-xs text-[#949ba4]">{selectedItem ? (isOwned ? "You own this effect." : `${cost} credits · Balance ${balance}`) : "Use the standard profile card appearance."}</p></div>
                {isOwned && selectedId && <span className="rounded-full bg-[#23a55a]/15 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide text-[#57f287]">Owned</span>}
              </div>
              {selectedItem && !isOwned && <div className="mt-3 flex gap-2"><input value={promoInput} onChange={(event) => { setPromoInput(event.target.value.toUpperCase()); setPromoApplied(false); }} placeholder="Promo code" maxLength={20} className="min-w-0 flex-1 rounded-md border border-black/30 bg-[#111214] px-3 py-2 text-xs uppercase text-white outline-none placeholder:text-[#6d6f78] focus:border-[#5865f2]" /><button type="button" onClick={() => setPromoApplied(isPromoCode(promoInput))} className="cursor-target rounded-md bg-[#4e5058] px-3 text-xs font-semibold text-white hover:bg-[#5d6069]">{promoApplied ? "Applied" : "Apply"}</button></div>}
            </div>
            {error && <p className="mt-3 rounded-md bg-red-500/10 px-3 py-2 text-xs text-red-300">{error}</p>}
          </aside>
        </div>

        <footer className="flex items-center justify-end gap-2 border-t border-black/20 bg-[#202225] px-5 py-4 sm:px-6">
          <button type="button" onClick={onClose} className="cursor-target rounded-md px-4 py-2 text-sm font-semibold text-white hover:underline">Cancel</button>
          <button type="button" disabled={busy || isEquipped || (!isOwned && balance < cost)} onClick={handlePrimary} className="cursor-target min-w-28 rounded-md bg-[#5865f2] px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-[#4752c4] disabled:cursor-not-allowed disabled:opacity-45">{busy ? "Saving…" : isEquipped ? "Applied" : isOwned ? "Apply" : `Buy · ${cost}cr`}</button>
        </footer>
      </div>
    </div>,
    document.body,
  );
}
