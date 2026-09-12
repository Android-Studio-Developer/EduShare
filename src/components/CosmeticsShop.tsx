import { useEffect, useState } from "react";
import { Check, Download, Gamepad2, Gift, Lock, Moon, PackageOpen, Sparkles, Tag } from "lucide-react";
import { useAuth } from "../context/AuthContext";
import { subscribeToProfile } from "../lib/profiles";
import { subscribeToBalance } from "../lib/shop";
import { isPromoCode, PROMO_CODE, PROMO_DISCOUNT_PERCENT, discountedCost } from "../lib/ranks";
import {
  ALL_COSMETICS,
  COSMETIC_BUNDLES,
  NAME_COLORS,
  NAME_EFFECTS,
  NAME_FONTS,
  NAMEPLATE_EFFECTS,
  PFP_EFFECTS,
  PROFILE_EFFECTS,
  cosmeticById,
  equipCosmetic,
  equipWolfMoonBundle,
  purchaseCosmetic,
  setNameColor,
  type CosmeticCategory,
} from "../lib/cosmetics";
import type { UserProfile } from "../types";
import Button from "./Button";

function PreviewName({ font, effect, color }: { font?: string; effect?: string; color?: string }) {
  const fontDef = NAME_FONTS.find((f) => f.id === font);
  return (
    <span
      className={effect ? `name-${effect}` : ""}
      style={{ fontFamily: fontDef?.cssFontFamily, color: !effect && color ? color : undefined }}
    >
      SpawnDex
    </span>
  );
}

function WolfMoonBundle({
  profile,
  balance,
  promoApplied,
  buying,
  onBuy,
  onEquip,
}: {
  profile: UserProfile;
  balance: number;
  promoApplied: boolean;
  buying: string;
  onBuy: (id: string) => void;
  onEquip: () => void;
}) {
  const bundle = COSMETIC_BUNDLES[0];
  const owned = profile.ownedCosmetics?.includes(bundle.id) ?? false;
  const equipped = profile.pfpEffect === bundle.id && profile.nameplateEffect === bundle.id && profile.profileEffect === bundle.id;
  const cost = discountedCost(bundle.cost, promoApplied ? PROMO_CODE : "");
  const displayName = profile.displayName || "SpawnDex member";

  return (
    <article className="wolf-moon-bundle">
      <div className="wolf-moon-bundle-copy">
        <p className="wolf-moon-bundle-kicker"><Moon size={13} /> Featured bundle · save 11%</p>
        <h3>Wolf Moon</h3>
        <p>A spectral set that moves together across your avatar, ONLINE NOW nameplate, and full profile card.</p>
        <div className="wolf-moon-bundle-items" aria-label="Three included cosmetics">
          <span><i className="wolf-bundle-avatar-icon" /> Lunar avatar</span>
          <span><i className="wolf-bundle-nameplate-icon" /> Spirit Wolf plate</span>
          <span><i className="wolf-bundle-profile-icon" /> Moonlit Howl</span>
        </div>
        <div className="wolf-moon-bundle-action">
          {owned ? (
            <button type="button" onClick={onEquip} disabled={equipped} className="cursor-target wolf-moon-buy-button">
              {equipped ? <><Check size={16} /> Bundle equipped</> : <><Sparkles size={16} /> Equip all three</>}
            </button>
          ) : (
            <button type="button" onClick={() => onBuy(bundle.id)} disabled={buying === bundle.id || balance < cost} className="cursor-target wolf-moon-buy-button">
              <Gift size={16} /> {buying === bundle.id ? "Unlocking…" : `Unlock bundle · ${cost}cr`}
            </button>
          )}
          {!owned && !promoApplied && <small><s>163cr separately</s> · bundle price</small>}
        </div>
      </div>
      <div className="wolf-moon-bundle-preview" aria-hidden="true">
        <div className="wolf-moon-preview-sky" />
        <div className="wolf-moon-preview-profile">
          <div className="pfp-effect-bundle-wolf-moon wolf-moon-preview-avatar">
            {profile.photoUrl ? <img src={profile.photoUrl} alt="" /> : <span>{displayName.slice(0, 1).toUpperCase()}</span>}
          </div>
          <div><strong>{displayName}</strong><small>Spirit of the pale moon</small></div>
        </div>
        <div className="online-member-row--nameplate nameplate-effect-bundle-wolf-moon wolf-moon-preview-nameplate">
          <span>{displayName}</span>
        </div>
      </div>
    </article>
  );
}

function BedFightDownloadCard() {
  return (
    <article className="bedfight-shop-card">
      <div className="bedfight-shop-art" aria-hidden="true">
        <span className="bedfight-shop-sun" />
        <span className="bedfight-shop-island bedfight-shop-island--red" />
        <span className="bedfight-shop-island bedfight-shop-island--blue" />
        <span className="bedfight-shop-blade" />
      </div>
      <div className="bedfight-shop-copy">
        <p className="bedfight-shop-kicker"><Gamepad2 size={13} /> Minecraft Education · free map</p>
        <h3>SpawnDex Bed Fight</h3>
        <p>Fight across the dojo, break the enemy bed, and protect your final life. Built for fast 1v1 rounds with automatic resets.</p>
        <div className="bedfight-shop-tags" aria-label="Game features">
          <span>1v1</span><span>Red vs Blue</span><span>Auto reset</span><span>Void eliminations</span>
        </div>
        <div className="bedfight-shop-actions">
          <a className="cursor-target bedfight-shop-download bedfight-shop-download--primary" href="/downloads/EduShare-BedFight.mcworld" download>
            <Download size={16} /> Download world
          </a>
          <a className="cursor-target bedfight-shop-download" href="/downloads/edushare-bedfight.mcaddon" download>
            <PackageOpen size={16} /> Add-on only
          </a>
        </div>
        <small>Open the .mcworld file with Minecraft Education. Use the add-on download only if you already have your own map.</small>
      </div>
    </article>
  );
}

function NameplateShelf({
  items,
  owned,
  equipped,
  displayName,
  photoUrl,
  onEquip,
  onBuy,
  balance,
  promoApplied,
  buying,
}: {
  items: typeof NAMEPLATE_EFFECTS;
  owned: string[];
  equipped: string;
  displayName: string;
  photoUrl: string;
  onEquip: (id: string, category: CosmeticCategory) => void;
  onBuy: (id: string) => void;
  balance: number;
  promoApplied: boolean;
  buying: string;
}) {
  return (
    <div className="mt-7 border-t border-border pt-6">
      <div className="flex items-end justify-between gap-3">
        <div>
          <p className="font-mono text-sm font-bold text-white">Name effects</p>
          <p className="mt-1 text-xs text-white/40">Animated plates shown beside your name in ONLINE NOW.</p>
        </div>
        <button type="button" onClick={() => onEquip("", "nameplateEffect")} className={`cursor-target rounded-lg border px-3 py-1.5 text-xs ${equipped === "" ? "border-brand-400/60 bg-brand-500/10 text-white" : "border-border text-white/50"}`}>Default</button>
      </div>
      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        {items.map((item) => {
          const isOwned = owned.includes(item.id);
          const cost = discountedCost(item.cost, promoApplied ? PROMO_CODE : "");
          const isEquipped = equipped === item.id;
          return (
            <div key={item.id} className={`overflow-hidden rounded-xl border bg-[#17181c] p-3 ${isEquipped ? "border-brand-400/60" : "border-border"}`}>
              <div className={`online-member-row online-member-row--nameplate nameplate-effect-${item.id} flex items-center gap-2`}>
                <div className="online-member-avatar relative shrink-0">
                  {photoUrl ? <img src={photoUrl} alt="" className="h-7 w-7 rounded-full object-cover" /> : <div className="grid h-7 w-7 place-items-center rounded-full bg-gradient-to-br from-cyan-400 to-fuchsia-500 text-[10px] font-bold text-white">{displayName.slice(0, 1).toUpperCase() || "?"}</div>}
                  <span className="absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 rounded-full border-2 border-[#111214] bg-[#23a55a]" />
                </div>
                {item.id === "profile-exclusive-developer-nameplate" && <span className="developer-row-flame" aria-hidden="true" />}
                <span className="min-w-0 flex-1 truncate text-xs font-semibold text-white">{displayName || "SpawnDex member"}</span>
              </div>
              <div className="mt-3 flex items-center justify-between gap-2">
                <span className="min-w-0 truncate text-xs font-semibold text-white/80">{item.label}</span>
                {isOwned ? <button type="button" onClick={() => onEquip(item.id, "nameplateEffect")} className="cursor-target shrink-0 text-xs font-semibold text-brand-300">{isEquipped ? "Equipped" : "Equip"}</button> : <button type="button" disabled={buying === item.id || balance < cost} onClick={() => onBuy(item.id)} className="cursor-target shrink-0 text-xs font-semibold text-amber-300 disabled:opacity-40"><Lock size={11} className="mr-1 inline" />{buying === item.id ? "…" : `${cost}cr`}</button>}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function Shelf({
  title,
  items,
  category,
  owned,
  equipped,
  onDemo,
  onEquip,
  onBuy,
  balance,
  promoApplied,
  buying,
}: {
  title: string;
  items: typeof ALL_COSMETICS;
  category: CosmeticCategory;
  owned: string[];
  equipped: string;
  onDemo: (id: string) => void;
  onEquip: (id: string, category: CosmeticCategory) => void;
  onBuy: (id: string) => void;
  balance: number;
  promoApplied: boolean;
  buying: string;
}) {
  return (
    <div className="mt-5">
      <p className="text-xs font-semibold text-white/50">{title}</p>
      <div className="mt-2 flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => onEquip("", category)}
          className={`cursor-target rounded-xl border px-3 py-2 text-xs ${equipped === "" ? "border-brand-400/60 bg-brand-500/10 text-white" : "border-border text-white/50 hover:text-white"}`}
        >
          Default
        </button>
        {items.map((item) => {
          const isOwned = owned.includes(item.id);
          const cost = discountedCost(item.cost, promoApplied ? PROMO_CODE : "");
          return (
            <div
              key={item.id}
              onMouseEnter={() => onDemo(item.id)}
              onMouseLeave={() => onDemo("")}
              className={`cursor-target flex items-center gap-2 rounded-xl border px-3 py-2 text-xs ${equipped === item.id ? "border-brand-400/60 bg-brand-500/10 text-white" : "border-border text-white/60"}`}
            >
              <span>{item.label}</span>
              {isOwned ? (
                <button type="button" onClick={() => onEquip(item.id, category)} className="cursor-target text-brand-300 hover:text-brand-200">
                  {equipped === item.id ? <Check size={13} /> : "Equip"}
                </button>
              ) : (
                <button
                  type="button"
                  disabled={buying === item.id || balance < cost}
                  onClick={() => onBuy(item.id)}
                  className="cursor-target flex items-center gap-1 text-amber-300 hover:text-amber-200 disabled:opacity-40"
                >
                  <Lock size={11} /> {buying === item.id ? "…" : `${cost}cr`}
                </button>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default function CosmeticsShop() {
  const { user } = useAuth();
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [balance, setBalance] = useState(0);
  const [demoId, setDemoId] = useState("");
  const [buying, setBuying] = useState("");
  const [error, setError] = useState("");
  const [promoInput, setPromoInput] = useState("");
  const [promoApplied, setPromoApplied] = useState(false);

  useEffect(() => {
    if (!user) return;
    return subscribeToProfile(user.uid, setProfile);
  }, [user]);
  useEffect(() => {
    if (!user) return;
    return subscribeToBalance(user.uid, setBalance);
  }, [user]);

  if (!user || !profile) return null;

  const owned = profile.ownedCosmetics ?? [];
  const demoItem = demoId ? cosmeticById(demoId) : null;

  async function handleBuy(id: string) {
    if (!user) return;
    setBuying(id);
    setError("");
    try {
      await purchaseCosmetic(user.uid, id, promoApplied ? PROMO_CODE : "");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Purchase failed.");
    } finally {
      setBuying("");
    }
  }

  async function handleEquip(id: string, category: CosmeticCategory) {
    if (!user) return;
    if (category === "font" || category === "nameEffect" || category === "nameplateEffect" || category === "pfpEffect" || category === "profileEffect") {
      try {
        await equipCosmetic(user.uid, id, category);
        setError("");
      } catch (err) {
        setError(err instanceof Error ? err.message : "Could not equip.");
      }
    }
  }

  async function handleEquipWolfMoon() {
    if (!user) return;
    try {
      await equipWolfMoonBundle(user.uid);
      setError("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not equip the bundle.");
    }
  }

  const previewFont = demoItem?.category === "font" ? demoItem.id : profile.nameFont;
  const previewEffect = demoItem?.category === "nameEffect" ? demoItem.id.replace("effect-", "") : profile.nameEffect.replace("effect-", "");

  return (
    <section id="cosmetics" className="mt-10 scroll-mt-20 rounded-2xl border border-border bg-surface p-5">
      <div className="flex items-center gap-2">
        <Sparkles size={18} className="text-brand-300" />
        <h2 className="font-mono text-lg font-bold text-white">Nickname &amp; profile cosmetics</h2>
      </div>
      <p className="mt-1 text-xs text-white/40">Fonts, name effects, avatar animations and profile borders — unlock with SpawnDex Credits, hover any locked item to demo it for free first.</p>

      <div className="mt-4 flex gap-2">
        <input
          value={promoInput}
          onChange={(e) => { setPromoInput(e.target.value.toUpperCase()); setPromoApplied(false); }}
          placeholder="Promo code"
          maxLength={20}
          className="w-40 rounded-xl border border-border bg-surface-2 px-3 py-2 font-mono text-xs uppercase text-white placeholder:text-white/25"
        />
        <Button type="button" size="sm" variant="secondary" onClick={() => setPromoApplied(isPromoCode(promoInput))}>
          <Tag size={13} /> {promoApplied ? "Applied" : `Apply for ${PROMO_DISCOUNT_PERCENT}% off`}
        </Button>
      </div>

      <div className="mt-4 rounded-xl border border-border bg-surface-2 p-4 text-center">
        <p className="text-[10px] uppercase tracking-widest text-white/30">Preview</p>
        <p className="mt-1 text-2xl font-bold">
          <PreviewName font={previewFont} effect={previewEffect} color={profile.nameColor} />
        </p>
      </div>

      <WolfMoonBundle
        profile={profile}
        balance={balance}
        promoApplied={promoApplied}
        buying={buying}
        onBuy={handleBuy}
        onEquip={handleEquipWolfMoon}
      />

      <BedFightDownloadCard />

      <Shelf
        title="Font"
        items={NAME_FONTS}
        category="font"
        owned={owned}
        equipped={profile.nameFont}
        onDemo={setDemoId}
        onEquip={handleEquip}
        onBuy={handleBuy}
        balance={balance}
        promoApplied={promoApplied}
        buying={buying}
      />
      <Shelf
        title="Text effect"
        items={NAME_EFFECTS}
        category="nameEffect"
        owned={owned}
        equipped={profile.nameEffect}
        onDemo={setDemoId}
        onEquip={handleEquip}
        onBuy={handleBuy}
        balance={balance}
        promoApplied={promoApplied}
        buying={buying}
      />

      <NameplateShelf
        items={NAMEPLATE_EFFECTS}
        owned={owned}
        equipped={profile.nameplateEffect || (profile.profileEffect === "profile-exclusive-developer-nameplate" ? profile.profileEffect : "")}
        displayName={profile.displayName}
        photoUrl={profile.photoUrl}
        onEquip={handleEquip}
        onBuy={handleBuy}
        balance={balance}
        promoApplied={promoApplied}
        buying={buying}
      />

      <div className="mt-5">
        <p className="text-xs font-semibold text-white/50">Name color</p>
        <div className="mt-2 flex flex-wrap gap-2">
          {NAME_COLORS.map((c) => (
            <button
              key={c || "none"}
              type="button"
              onClick={() => user && setNameColor(user.uid, c).catch((err) => setError(err instanceof Error ? err.message : "Failed."))}
              className={`cursor-target h-7 w-7 rounded-full border-2 ${profile.nameColor === c ? "border-white" : "border-white/15"}`}
              style={{ background: c || "#94a3b8" }}
              aria-label={c || "Default color"}
            />
          ))}
        </div>
      </div>

      <Shelf
        title="Avatar effect"
        items={PFP_EFFECTS}
        category="pfpEffect"
        owned={owned}
        equipped={profile.pfpEffect}
        onDemo={setDemoId}
        onEquip={handleEquip}
        onBuy={handleBuy}
        balance={balance}
        promoApplied={promoApplied}
        buying={buying}
      />
      <Shelf
        title="Profile effect"
        items={PROFILE_EFFECTS}
        category="profileEffect"
        owned={owned}
        equipped={profile.profileEffect}
        onDemo={setDemoId}
        onEquip={handleEquip}
        onBuy={handleBuy}
        balance={balance}
        promoApplied={promoApplied}
        buying={buying}
      />

      {error && <p className="mt-3 text-sm text-red-400">{error}</p>}
    </section>
  );
}
