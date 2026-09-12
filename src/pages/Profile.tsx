import { useEffect, useRef, useState, type FormEvent } from "react";
import { Link } from "react-router-dom";
import { AppWindow, Check, CircleMinus, Coins, Crown, Download, EyeOff, Gamepad2, Gift, HardHat, Layers3, Lock, Moon, PackageOpen, Palette, PanelTop, Smartphone, Sparkles, Tag, Trash2, User, X } from "lucide-react";
import { useAuth } from "../context/AuthContext";
import { claimDailyCredits, ensureProfile, getPresenceStatus, PRESENCE_LABELS, subscribeToProfile, updateGameActivity, updatePresenceData, updateProfileData } from "../lib/profiles";
import { claimBuildHelpCredits, ownershipPercent } from "../lib/builders";
import { checkUsernameAvailable, claimUsername, isValidUsername, normalizeUsername } from "../lib/usernames";
import { ensureWallet, subscribeToBalance } from "../lib/shop";
import { isStealthEnabled, setStealthEnabled } from "../components/StealthMode";
import { useUiVersion } from "../context/UiVersionContext";
import { isPlayOnUnlockEnabled, setPlayOnUnlockEnabled } from "../lib/unlockMusic";
import { useTheme } from "../context/ThemeContext";
import { COLOR_THEMES } from "../lib/colorTheme";
import type { UiVersion } from "../lib/uiVersion";
import { getTextSize, isHighContrast, isReduceMotion, setHighContrast, setReduceMotion, setTextSize, type TextSize } from "../lib/accessibility";
import { sendPublicMessage } from "../lib/chat";
import { subscribeToChessDuels } from "../lib/chessDuels";
import { arcadeLevel } from "../lib/minigames";
import {
  BANNER_EFFECTS,
  canUseBannerEffects,
  claimRankByLevel,
  COSMETIC_PACK_COST,
  discountedCost,
  isPromoCode,
  minutesToLevel,
  PROMO_CODE,
  PROMO_DISCOUNT_PERCENT,
  PURCHASABLE_RANKS,
  purchaseCosmeticPack,
  purchaseRank,
  RANK_COLOR,
  RANK_CREDIT_COST,
  RANK_LABEL,
  RANK_LEVEL_REQUIRED,
  RANK_PERKS,
  rankNameClass,
  rankTier,
} from "../lib/ranks";
import type { ChessDuel, PresenceStatus, UserProfile } from "../types";
import BannerEffect from "../components/BannerEffect";
import Button from "../components/Button";
import RankBadge from "../components/RankBadge";
import StatusDot from "../components/StatusDot";
import UserBadges from "../components/UserBadges";
import CosmeticsShop from "../components/CosmeticsShop";
import AdvertiserPanel from "../components/AdvertiserPanel";
import ProfileEffectPicker from "../components/ProfileEffectPicker";
import EvilEye from "../components/EvilEye";
import GlowCursor from "../components/GlowCursor";
import PixelSwap from "../components/PixelSwap";
import ProfileBannerMedia from "../components/ProfileBannerMedia";
import ThoughtBubble from "../components/ThoughtBubble";
import CustomEmojiManager from "../components/CustomEmojiManager";
import GameActivityCard from "../components/GameActivityCard";

export default function Profile() { const {user,role,syncDisplayName,deleteAccount}=useAuth(); const {uiVersion,setUiVersion:setUiVersionState}=useUiVersion(); const {theme,setTheme}=useTheme(); const [playOnUnlock,setPlayOnUnlockState]=useState(isPlayOnUnlockEnabled()); const [profile,setProfile]=useState<UserProfile|null>(null); const [chessRooms,setChessRooms]=useState<ChessDuel[]>([]); const [balance,setBalance]=useState(0); const [message,setMessage]=useState(""); const [rankMessage,setRankMessage]=useState(""); const [pendingRank,setPendingRank]=useState(""); const [pendingAddon,setPendingAddon]=useState(false); const [promoInput,setPromoInput]=useState(""); const [promoApplied,setPromoApplied]=useState(false); const [stealth,setStealth]=useState(isStealthEnabled()); const [reduceMotion,setReduceMotionState]=useState(isReduceMotion()); const [textSize,setTextSizeState]=useState<TextSize>(getTextSize()); const [highContrast,setHighContrastState]=useState(isHighContrast()); const [deleteOpen,setDeleteOpen]=useState(false); const [deleteConfirmation,setDeleteConfirmation]=useState(""); const [deletePassword,setDeletePassword]=useState(""); const [deleting,setDeleting]=useState(false); const [deleteError,setDeleteError]=useState(""); const scrolledToHash=useRef(false);
  const [effectPickerOpen,setEffectPickerOpen]=useState(false);
  const [usernameInput,setUsernameInput]=useState("");
  const [usernameStatus,setUsernameStatus]=useState<"idle"|"checking"|"available"|"taken"|"invalid"|"saving"|"saved"|"error">("idle");
  const [usernameError,setUsernameError]=useState("");
  useEffect(()=>{ if(profile) setUsernameInput(profile.username); },[profile?.id]);
  useEffect(()=>{
    if(!profile) return;
    const trimmed=usernameInput.trim();
    if(!trimmed || normalizeUsername(trimmed)===profile.usernameLower){ setUsernameStatus("idle"); return; }
    if(!isValidUsername(trimmed)){ setUsernameStatus("invalid"); return; }
    setUsernameStatus("checking");
    const timer=window.setTimeout(async ()=>{
      const available=await checkUsernameAvailable(trimmed);
      setUsernameStatus(available?"available":"taken");
    },400);
    return ()=>window.clearTimeout(timer);
  },[usernameInput,profile?.usernameLower]);
  async function saveUsername(){
    if(!user||!profile) return;
    const trimmed=usernameInput.trim();
    if(!trimmed || normalizeUsername(trimmed)===profile.usernameLower) return;
    setUsernameStatus("saving"); setUsernameError("");
    const result=await claimUsername(user.uid,trimmed,profile.usernameLower);
    if(result.ok){ setUsernameStatus("saved"); }
    else { setUsernameStatus("error"); setUsernameError(result.reason); }
  }
  function toggleStealth(){const next=!stealth;setStealth(next);setStealthEnabled(next);}
  function chooseUiVersion(v:UiVersion){setUiVersionState(v);}
  function toggleReduceMotion(){const next=!reduceMotion;setReduceMotionState(next);setReduceMotion(next);}
  function toggleTextSize(){const next:TextSize=textSize==="large"?"normal":"large";setTextSizeState(next);setTextSize(next);}
  function toggleHighContrast(){const next=!highContrast;setHighContrastState(next);setHighContrast(next);}
  useEffect(()=>{if(!user)return; void ensureProfile(user.uid,user.displayName??"Player"); return subscribeToProfile(user.uid,setProfile);},[user]);
  useEffect(()=>subscribeToChessDuels(setChessRooms),[]);
  useEffect(()=>{if(!user)return; void ensureWallet(user.uid); return subscribeToBalance(user.uid,setBalance);},[user]);
  useEffect(()=>{if(!profile||scrolledToHash.current||!window.location.hash)return;const id=window.location.hash.slice(1);scrolledToHash.current=true;window.requestAnimationFrame(()=>document.getElementById(id)?.scrollIntoView({behavior:"smooth",block:"center"}));},[profile]);
  async function save(e:FormEvent){e.preventDefault();if(!user||!profile)return;await updateProfileData(user.uid,{displayName:profile.displayName,photoUrl:profile.photoUrl,bio:profile.bio,bannerUrl:profile.bannerUrl,backgroundUrl:profile.backgroundUrl,bannerEffect:canUseBannerEffects(profile.rank)?profile.bannerEffect:"",favoriteGames:profile.favoriteGames});await syncDisplayName(profile.displayName);setMessage("Profile and wallpaper saved.");}
  async function savePresence(requestedStatus?:PresenceStatus){if(!user||!profile)return;const nextStatus=requestedStatus??profile.presenceStatus;const next={...profile,presenceStatus:nextStatus};setProfile(next);setMessage("");try{await updatePresenceData(user.uid,nextStatus,next.customStatus);setMessage("Availability updated.");}catch(error){setMessage(error instanceof Error?error.message:"Could not update availability.");}}
  async function toggleMinecraftActivity(){if(!user||!profile)return;const active=profile.activityGame!=="Minecraft";try{await updateGameActivity(user.uid,active);setMessage(active?"Minecraft activity is now visible.":"Minecraft activity stopped.");}catch(error){setMessage(error instanceof Error?error.message:"Could not update game activity.");}}
  function togglePlayOnUnlock(){const next=!playOnUnlock;setPlayOnUnlockState(next);setPlayOnUnlockEnabled(next);}
  function pickEffect(id:string){if(!profile||!canUseBannerEffects(profile.rank))return;setProfile({...profile,bannerEffect:profile.bannerEffect===id?"":id});}
  async function claim(){if(!user)return;try{await claimDailyCredits(user.uid);setMessage("You received 15 SpawnDex Credits!");}catch(e){setMessage(e instanceof Error?e.message:"Could not claim reward.");}}
  async function claimBuildHelp(){if(!user)return;try{await claimBuildHelpCredits(user.uid);setMessage("Build Help credits claimed!");}catch(e){setMessage(e instanceof Error?e.message:"Could not claim Build Help credits.");}}
  async function buyRank(rank:(typeof PURCHASABLE_RANKS)[number]){if(!user||!profile)return;setPendingRank(rank);setRankMessage("");try{await purchaseRank(user.uid,rank,promoApplied?PROMO_CODE:"");setRankMessage(`Purchased ${RANK_LABEL[rank]}${promoApplied?` with ${PROMO_CODE} (${PROMO_DISCOUNT_PERCENT}% off)`:""}!`);void sendPublicMessage(user.uid,"eduBot",`${profile.displayName} just unlocked ${RANK_LABEL[rank]}!`,"none",{isBot:true});}catch(e){setRankMessage(e instanceof Error?e.message:"Purchase failed.");}finally{setPendingRank("");}}
  async function buyAddon(){if(!user||!profile)return;setPendingAddon(true);setRankMessage("");try{await purchaseCosmeticPack(user.uid,promoApplied?PROMO_CODE:"");setRankMessage(`Cosmetic add-on unlocked${promoApplied?` with ${PROMO_CODE} (${PROMO_DISCOUNT_PERCENT}% off)`:""}!`);}catch(e){setRankMessage(e instanceof Error?e.message:"Purchase failed.");}finally{setPendingAddon(false);}}
  function applyPromo(){const valid=isPromoCode(promoInput);setPromoApplied(valid);setRankMessage(valid?`${PROMO_CODE} applied — ${PROMO_DISCOUNT_PERCENT}% off purchases.`:"That promo code is not valid.");}
  async function claimRank(rank:(typeof PURCHASABLE_RANKS)[number]){if(!user||!profile)return;setPendingRank(rank);setRankMessage("");try{await claimRankByLevel(user.uid,rank);setRankMessage(`Claimed ${RANK_LABEL[rank]}!`);void sendPublicMessage(user.uid,"eduBot",`${profile.displayName} just unlocked ${RANK_LABEL[rank]}!`,"none",{isBot:true});}catch(e){setRankMessage(e instanceof Error?e.message:"Could not claim rank.");}finally{setPendingRank("");}}
  async function handleDeleteAccount(){if(!user||!profile||deleteConfirmation!=="DELETE"||deleting)return;setDeleting(true);setDeleteError("");try{await deleteAccount(deletePassword,profile.usernameLower);}catch(error){const code=typeof error==="object"&&error&&"code" in error?String(error.code):"";setDeleteError(code==="auth/invalid-credential"?"That password is incorrect.":code==="auth/popup-closed-by-user"?"Google confirmation was cancelled.":code==="auth/requires-recent-login"?"Sign out, sign back in, and try again.":error instanceof Error?error.message:"Could not delete the account.");setDeleting(false);}}
  if(!profile)return <div className="p-20 text-center text-white/40">Loading profile…</div>;
  const level = minutesToLevel(profile.playMinutes);
  const chessActivity=chessRooms.find(room=>room.status==="active"&&(room.whiteId===profile.id||room.blackId===profile.id));
  const chessOpponent=chessActivity?(chessActivity.whiteId===profile.id?chessActivity.blackName:chessActivity.whiteName):"";
  return <div className="profile-settings-page mx-auto max-w-2xl px-6 py-14">
    <aside className="profile-identity-column">
    <div className={`relative overflow-hidden rounded-2xl border border-border bg-surface ${profile.profileEffect ? `profile-effect-${profile.profileEffect}` : ""}`}>
      {profile.profileEffect === "profile-evil-eye" && !reduceMotion && (
        <div className="pointer-events-none absolute inset-0 opacity-25">
          <EvilEye scale={0.55} intensity={1.1} glowIntensity={0.3} />
        </div>
      )}
      <GlowCursor secondaryColor="#e879f9" enabled={!reduceMotion} style={undefined}>
      <div className="profile-card-banner relative h-36 overflow-hidden bg-gradient-to-r from-brand-600 to-fuchsia-600">
        {profile.bannerUrl && <ProfileBannerMedia value={profile.bannerUrl} />}
        <BannerEffect effect={profile.bannerEffect} />
      </div>
      <div className="px-6 pb-6">
        <div className="-mt-10 flex items-end justify-between gap-3">
          <div className="flex min-w-0 items-end gap-4">
          <div className={`profile-card-avatar relative shrink-0 ${profile.pfpEffect ? `pfp-effect-${profile.pfpEffect}` : ""}`}>
            <PixelSwap
              className="h-20 w-20 rounded-2xl border-4 border-surface"
              aspectRatio="1 / 1"
              pixelSize={9}
              trigger="hover"
              style={undefined}
              active={undefined}
              onActiveChange={undefined}
              onComplete={undefined}
              firstContent={profile.photoUrl?<img src={profile.photoUrl} alt="Profile" className="h-full w-full object-cover"/>:<div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-cyan-400 to-fuchsia-500"><User size={30}/></div>}
              secondContent={<div className="flex h-full w-full flex-col items-center justify-center gap-0.5 bg-gradient-to-br from-cyan-400 to-fuchsia-500 text-white"><span className="text-[9px] font-bold uppercase tracking-wider">{profile.rank}</span><span className="font-mono text-xs">Lv.{level}</span></div>}
            />
            <StatusDot status={getPresenceStatus(profile)} className="absolute -bottom-1 -right-1 h-5 w-5" />
          </div>
          <ThoughtBubble text={profile.customStatus} className="mb-1 min-w-0 max-w-xs" />
          </div>
          <span className="inline-flex shrink-0 items-center gap-2 rounded-full border border-white/10 bg-black/20 px-3 py-1.5 text-xs font-semibold text-white/65"><StatusDot status={getPresenceStatus(profile)}/>{profile.presenceStatus==="invisible"?"Invisible":PRESENCE_LABELS[getPresenceStatus(profile)]}</span>
        </div>
        <div className="profile-card-nameplate mt-3 flex items-center gap-2">
          <h1 className={`font-mono text-2xl font-bold ${rankNameClass(profile.rank)}`}>{profile.displayName}</h1>
          <RankBadge rank={profile.rank}/>
          <UserBadges profile={profile}/>
        </div>
        <p className="text-sm text-brand-300">{role} · Level {level}</p>
        <p className="mt-1 flex items-center gap-1 text-sm text-amber-300"><Coins size={14}/>{balance} credits</p>
        <p className="mt-1 flex items-center gap-1 text-sm text-indigo-300"><Gamepad2 size={14}/>{profile.botXp} arcade XP · Lv.{arcadeLevel(profile.botXp)}</p>
        {profile.buildHelpCredits>0 && <p className="mt-1 flex items-center gap-1 text-sm text-orange-300"><HardHat size={14}/>{ownershipPercent(profile.buildHelpCredits)}% honorary site ownership (Builder)</p>}
        {chessActivity&&<Link to={`/fun?chess=${chessActivity.id}`} className="cursor-target mt-3 flex items-center gap-2 rounded-xl border border-amber-400/25 bg-amber-400/[.07] p-3 text-sm text-amber-100 transition-colors hover:border-amber-300/50"><Crown size={17} className="text-amber-300"/><span className="min-w-0 flex-1"><strong className="block truncate">Playing Chess with {chessOpponent||"an opponent"}</strong><span className="block text-[10px] text-amber-100/45">{chessActivity.timeControl==="blitz_5_3"?"5 | 3 Blitz":chessActivity.timeControl==="rapid_10"?"10 min Rapid":"Live match"}</span></span><span className="text-[10px] font-bold uppercase tracking-wider">Open →</span></Link>}
        <GameActivityCard game={profile.activityGame} startedAt={profile.activityStartedAt}/>
        {profile.favoriteGames && <p className="mt-1 text-sm text-white/50">Plays: {profile.favoriteGames}</p>}
        {user?.email && <p className="mt-1 text-xs text-white/30">{user.email}</p>}
      </div>
      </GlowCursor>
    </div>
    <Button onClick={claim} className="mt-6 w-full"><Gift size={16}/>Claim daily +15 credits</Button>
    {profile.buildHelpPending>0 && <Button onClick={claimBuildHelp} className="mt-2 w-full bg-orange-500 hover:bg-orange-400"><HardHat size={16}/>Claim {profile.buildHelpPending} Build Help credits</Button>}
    <Button variant="secondary" onClick={()=>setEffectPickerOpen(true)} className="mt-2 w-full"><Sparkles size={16}/>Change profile effect</Button>
    <ProfileEffectPicker open={effectPickerOpen} onClose={()=>setEffectPickerOpen(false)} />
    </aside>

    <section className="profile-settings-column">
    <p className="v2-card-title mt-8">Profile</p>
    <div className="mt-6 rounded-2xl border border-border bg-surface p-5">
      <div className="flex items-center justify-between gap-3"><div><p className="font-mono text-sm font-semibold text-white">Availability</p><p className="mt-0.5 text-xs text-white/40">Choose how you appear across SpawnDex.</p></div><StatusDot status={profile.presenceStatus==="invisible"?"invisible":getPresenceStatus(profile)} className="h-5 w-5"/></div>
      <div className="mt-4 grid grid-cols-2 gap-2">
        {([
          {id:"online",label:"Online",icon:null,tone:"text-emerald-300"},
          {id:"idle",label:"Idle",icon:Moon,tone:"text-amber-300"},
          {id:"dnd",label:"Do Not Disturb",icon:CircleMinus,tone:"text-red-300"},
          {id:"invisible",label:"Invisible",icon:EyeOff,tone:"text-slate-300"},
        ] as const).map((option)=>{const Icon=option.icon;const active=profile.presenceStatus===option.id;return <button key={option.id} type="button" onClick={()=>void savePresence(option.id)} className={`cursor-target flex min-w-0 items-center gap-2 rounded-xl border px-3 py-2.5 text-left text-xs font-semibold transition-colors ${active?"border-brand-400 bg-brand-500/15 text-white":"border-border bg-surface-2 text-white/55 hover:text-white"}`}>{Icon?<Icon size={15} className={option.tone}/>:<span className="h-3.5 w-3.5 rounded-full bg-emerald-400"/>}<span className="truncate">{option.label}</span>{active&&<Check size={13} className="ml-auto shrink-0 text-brand-300"/>}</button>;})}
      </div>
      <label className="mt-4 block"><span className="text-xs font-semibold text-white/50">Custom status</span><div className="mt-1.5 flex gap-2"><input value={profile.customStatus} onChange={e=>setProfile({...profile,customStatus:e.target.value.slice(0,80)})} onKeyDown={e=>{if(e.key==="Enter"){e.preventDefault();void savePresence();}}} maxLength={80} placeholder="What are you up to?" className="min-w-0 flex-1 rounded-xl border border-border bg-surface-2 px-4 py-2.5 text-sm text-white placeholder:text-white/25"/><Button type="button" size="sm" onClick={()=>void savePresence()}>Save</Button></div><span className="mt-1 block text-right text-[10px] text-white/25">{profile.customStatus.length}/80</span></label>
      <div className="mt-4 flex items-center justify-between gap-4 rounded-xl border border-border bg-surface-2 p-3"><div className="min-w-0"><p className="text-xs font-semibold text-white">Share Minecraft activity</p><p className="mt-0.5 text-[10px] leading-relaxed text-white/35">Shows a Discord-style card and session timer on your profile.</p></div><button type="button" onClick={()=>void toggleMinecraftActivity()} aria-pressed={profile.activityGame==="Minecraft"} className={`cursor-target relative h-6 w-11 shrink-0 rounded-full transition-colors ${profile.activityGame==="Minecraft"?"bg-emerald-500":"bg-white/15"}`}><span className={`absolute top-0.5 h-5 w-5 rounded-full bg-white transition-transform ${profile.activityGame==="Minecraft"?"translate-x-5":"translate-x-0.5"}`}/></button></div>
      <CustomEmojiManager profile={profile} onNotice={setMessage}/>
    </div>
    <form onSubmit={save} className="profile-editor-card mt-6 space-y-4 rounded-2xl border border-border bg-surface p-6"><input required value={profile.displayName} onChange={e=>setProfile({...profile,displayName:e.target.value})} placeholder="Display name" className="w-full rounded-xl border border-border bg-surface-2 px-4 py-3 text-white"/>
<div className="profile-username-field">
  <div className="flex gap-2">
    <div className="relative flex-1">
      <span className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-white/30">@</span>
      <input value={usernameInput} onChange={e=>setUsernameInput(e.target.value.toLowerCase())} placeholder="username" maxLength={20} className="w-full rounded-xl border border-border bg-surface-2 py-3 pl-8 pr-4 text-white"/>
    </div>
    <Button type="button" size="sm" disabled={usernameStatus!=="available"} onClick={saveUsername}>Claim</Button>
  </div>
  <p className={`mt-1.5 text-xs ${usernameStatus==="taken"||usernameStatus==="invalid"||usernameStatus==="error"?"text-red-400":usernameStatus==="available"?"text-emerald-400":usernameStatus==="saved"?"text-emerald-400":"text-white/35"}`}>
    {usernameStatus==="idle" && (profile.username ? `Your PID for pings: @${profile.username}` : "Claim a username — used for @pings, first come first served.")}
    {usernameStatus==="checking" && "Checking availability…"}
    {usernameStatus==="available" && "Available — click Claim to lock it in."}
    {usernameStatus==="taken" && "That username is already taken."}
    {usernameStatus==="invalid" && "3-20 characters: lowercase letters, numbers, underscore."}
    {usernameStatus==="saving" && "Claiming…"}
    {usernameStatus==="saved" && "Username claimed."}
    {usernameStatus==="error" && usernameError}
  </p>
</div>
<input type="url" value={profile.photoUrl} onChange={e=>setProfile({...profile,photoUrl:e.target.value})} placeholder="Profile image URL" className="w-full rounded-xl border border-border bg-surface-2 px-4 py-3 text-white"/>
<div>
  <input value={profile.bannerUrl} onChange={e=>setProfile({...profile,bannerUrl:e.target.value})} placeholder="Banner image URL or embed:https://example.com" className="w-full rounded-xl border border-border bg-surface-2 px-4 py-3 text-white"/>
  <p className="mt-1.5 text-xs text-white/35">For a webpage banner, prefix its URL with <code className="text-brand-300">embed:</code>. Some websites block iframe embedding.</p>
</div>
<input type="url" value={profile.backgroundUrl} onChange={e=>setProfile({...profile,backgroundUrl:e.target.value})} placeholder="Desktop background image URL (clear to use the default background)" className="profile-background-image-input w-full rounded-xl border border-border bg-surface-2 px-4 py-3 text-white"/>
<div className="profile-banner-effects">
  <p className="flex items-center gap-1.5 text-xs font-semibold text-white/50">Banner effect{!canUseBannerEffects(profile.rank) && <span className="flex items-center gap-1 text-white/30"><Lock size={11}/>VIP++ perk</span>}</p>
  <div className="mt-2 grid grid-cols-3 gap-2 sm:grid-cols-4">
    {BANNER_EFFECTS.map((fx)=>{
      const locked = !canUseBannerEffects(profile.rank);
      const active = profile.bannerEffect===fx.id;
      return (
        <button
          key={fx.id}
          type="button"
          disabled={locked}
          onClick={()=>pickEffect(fx.id)}
          className={`cursor-target rounded-xl border px-2 py-2 text-[11px] font-medium transition-colors ${active?"border-brand-400 bg-brand-500/15 text-white":"border-border bg-surface-2 text-white/50 hover:text-white/80"} ${locked?"cursor-not-allowed opacity-40":""}`}
        >
          {fx.label}
        </button>
      );
    })}
  </div>
</div>
<input value={profile.favoriteGames} maxLength={100} onChange={e=>setProfile({...profile,favoriteGames:e.target.value})} placeholder="Favorite games (e.g. Minecraft, Valorant)" className="profile-favorite-input w-full rounded-xl border border-border bg-surface-2 px-4 py-3 text-white"/><textarea maxLength={300} rows={5} value={profile.bio} onChange={e=>setProfile({...profile,bio:e.target.value})} placeholder="Tell the community about yourself" className="profile-bio-input w-full rounded-xl border border-border bg-surface-2 px-4 py-3 text-white"/>{message&&<p className="profile-save-message text-sm text-cyan-300">{message}</p>}<Button type="submit" className="profile-save-button w-full">Save profile</Button></form>

    <p className="v2-card-title mt-8">Preferences</p>
    <div className="profile-preferences-grid">
    <div className="mt-6 flex items-center justify-between gap-3 rounded-2xl border border-border bg-surface p-5">
      <div>
        <p className="font-mono text-sm font-semibold text-white">Stealth mode</p>
        <p className="mt-0.5 text-xs text-white/40">Tab title & icon switch to Google when you switch away.</p>
      </div>
      <button type="button" onClick={toggleStealth} className={`cursor-target relative h-6 w-11 shrink-0 rounded-full transition-colors ${stealth?"bg-brand-500":"bg-white/15"}`}>
        <span className={`absolute top-0.5 h-5 w-5 rounded-full bg-white transition-transform ${stealth?"translate-x-5":"translate-x-0.5"}`} />
      </button>
    </div>

    <div id="interface-settings" className="profile-wide-card profile-interface-card scroll-mt-20 mt-4 rounded-2xl border border-border bg-surface p-5">
      <div>
        <p className="font-mono text-sm font-semibold text-white">Interface</p>
        <p className="mt-0.5 text-xs text-white/40">Choose how SpawnDex is organized. Your selection is saved on this device.</p>
      </div>
      <div className="mt-4 grid grid-cols-1 gap-2 sm:grid-cols-2 xl:grid-cols-3">
        {([
          {id:"v1",label:"Classic",description:"Top navigation",icon:PanelTop},
          {id:"v2",label:"Sidebar",description:"Grouped navigation",icon:Layers3},
          {id:"v3",label:"Workspace",description:"Responsive and focused",icon:Sparkles},
          {id:"v4",label:"Desktop",description:"OS bar and app dock",icon:AppWindow},
          {id:"v5",label:"Glass OS",description:"Lock screen and Island",icon:Smartphone},
        ] as const).map((option)=>{
          const Icon=option.icon;
          const active=uiVersion===option.id;
          return <button key={option.id} type="button" onClick={()=>chooseUiVersion(option.id)} className={`cursor-target relative flex min-w-0 items-center gap-3 rounded-xl border p-3 text-left transition-all ${active?"border-brand-400 bg-brand-500/15 shadow-[0_10px_30px_-20px_var(--color-brand-400)]":"border-border bg-surface-2 hover:border-white/20"}`}>
            <span className={`grid h-9 w-9 shrink-0 place-items-center rounded-lg ${active?"bg-brand-500 text-white":"bg-white/[.05] text-white/45"}`}><Icon size={17}/></span>
            <span className="min-w-0"><strong className="block text-xs text-white">{option.label} <span className="text-white/30">{option.id.toUpperCase()}</span></strong><small className="mt-0.5 block text-[10px] leading-4 text-white/40">{option.description}</small></span>
            {active&&<Check size={14} className="absolute right-2 top-2 text-brand-300"/>}
          </button>;
        })}
      </div>
    </div>

    <div className="profile-wide-card profile-color-card mt-4 rounded-2xl border border-border bg-surface p-5">
      <div className="flex items-start gap-3">
        <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-brand-500/15 text-brand-300"><Palette size={17}/></span>
        <div>
          <p className="font-mono text-sm font-semibold text-white">Color theme</p>
          <p className="mt-0.5 text-xs text-white/40">Pick a palette for navigation, buttons, focus states, and page accents.</p>
        </div>
      </div>
      <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-5">
        {COLOR_THEMES.map((option)=>{
          const active=theme===option.id;
          return <button key={option.id} type="button" onClick={()=>setTheme(option.id)} className={`cursor-target relative rounded-xl border p-2.5 text-left transition-all ${active?"border-brand-400 bg-brand-500/10":"border-border bg-surface-2 hover:border-white/20"}`} aria-pressed={active}>
            <span className="mb-2 flex -space-x-1">{option.colors.map((color)=><span key={color} className="h-5 w-5 rounded-full border-2 border-[#111318]" style={{backgroundColor:color}}/>)}</span>
            <strong className="block text-[11px] text-white">{option.label}</strong>
            <small className="block truncate text-[9px] text-white/35">{option.description}</small>
            {active&&<Check size={13} className="absolute right-2 top-2 text-brand-300"/>}
          </button>;
        })}
      </div>
    </div>

    <div className="profile-accessibility-card mt-4 space-y-3 rounded-2xl border border-border bg-surface p-5">
      <p className="font-mono text-sm font-semibold text-white">Accessibility</p>
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-sm text-white/70">Reduce motion</p>
          <p className="text-xs text-white/40">Turns off background animation, click sparks, cursor spin & heavy profile effects (glow cursor, ripple banners, evil eye) — fixes most lag.</p>
        </div>
        <button type="button" onClick={toggleReduceMotion} className={`cursor-target relative h-6 w-11 shrink-0 rounded-full transition-colors ${reduceMotion?"bg-brand-500":"bg-white/15"}`}>
          <span className={`absolute top-0.5 h-5 w-5 rounded-full bg-white transition-transform ${reduceMotion?"translate-x-5":"translate-x-0.5"}`} />
        </button>
      </div>
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-sm text-white/70">Larger text</p>
          <p className="text-xs text-white/40">Scales up text site-wide.</p>
        </div>
        <button type="button" onClick={toggleTextSize} className={`cursor-target relative h-6 w-11 shrink-0 rounded-full transition-colors ${textSize==="large"?"bg-brand-500":"bg-white/15"}`}>
          <span className={`absolute top-0.5 h-5 w-5 rounded-full bg-white transition-transform ${textSize==="large"?"translate-x-5":"translate-x-0.5"}`} />
        </button>
      </div>
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-sm text-white/70">High contrast</p>
          <p className="text-xs text-white/40">Brightens muted text and borders.</p>
        </div>
        <button type="button" onClick={toggleHighContrast} className={`cursor-target relative h-6 w-11 shrink-0 rounded-full transition-colors ${highContrast?"bg-brand-500":"bg-white/15"}`}>
          <span className={`absolute top-0.5 h-5 w-5 rounded-full bg-white transition-transform ${highContrast?"translate-x-5":"translate-x-0.5"}`} />
        </button>
      </div>
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-sm text-white/70">Play music on unlock</p>
          <p className="text-xs text-white/40">Starts Wii Music the moment you get past the site gate.</p>
        </div>
        <button type="button" onClick={togglePlayOnUnlock} aria-pressed={playOnUnlock} className={`cursor-target relative h-6 w-11 shrink-0 rounded-full transition-colors ${playOnUnlock?"bg-brand-500":"bg-white/15"}`}>
          <span className={`absolute top-0.5 h-5 w-5 rounded-full bg-white transition-transform ${playOnUnlock?"translate-x-5":"translate-x-0.5"}`} />
        </button>
      </div>
    </div>
    </div>
    </section>

    <section className="profile-ranks-section">
    <p className="v2-card-title mt-8">Progression</p>
    <div className="profile-ranks-content mt-10">
      <h2 className="font-mono text-xl font-bold text-white">Ranks</h2>
      <p className="mt-1 text-xs text-white/40">Buy with SpawnDex Credits, or reach the required level to claim free. 5 minutes on site = 1 level.</p>
      <div className="mt-4 flex flex-col gap-3 rounded-2xl border border-brand-400/25 bg-brand-500/[.07] p-4 sm:flex-row sm:items-center">
        <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-brand-500/15 text-brand-300"><Tag size={18}/></span>
        <div className="min-w-0 flex-1"><p className="text-sm font-semibold text-white">Promo code</p><p className="text-xs text-white/40">Use {PROMO_CODE} for {PROMO_DISCOUNT_PERCENT}% off rank and add-on purchases.</p></div>
        <div className="flex gap-2"><input value={promoInput} onChange={(event)=>{setPromoInput(event.target.value.toUpperCase());setPromoApplied(false);}} onKeyDown={(event)=>{if(event.key==="Enter"){event.preventDefault();applyPromo();}}} maxLength={20} placeholder="Enter code" className="min-w-0 rounded-xl border border-border bg-surface-2 px-3 py-2 font-mono text-xs uppercase text-white placeholder:text-white/25"/><Button type="button" size="sm" variant="secondary" onClick={applyPromo}>{promoApplied?<><Check size={13}/>Applied</>:"Apply"}</Button></div>
      </div>
      <div className="profile-rank-grid mt-4 space-y-3">
        {PURCHASABLE_RANKS.map((rank)=>{
          const owned = rankTier(profile.rank)>=rankTier(rank);
          const requiredLevel = RANK_LEVEL_REQUIRED[rank]??0;
          const baseCost = RANK_CREDIT_COST[rank]??0;
          const cost = discountedCost(baseCost,promoApplied?PROMO_CODE:"");
          const levelReady = level>=requiredLevel;
          return (
            <article key={rank} className="rounded-2xl border border-border bg-surface p-5">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <span className={`font-mono font-bold ${RANK_COLOR[rank]}`}>{RANK_LABEL[rank]}</span>
                  {owned && <span className="rounded-full border border-border px-2 py-0.5 text-[11px] text-white/40">Owned</span>}
                </div>
                <span className="text-xs text-white/40">{promoApplied&&<s className="mr-1 text-white/25">{baseCost}</s>}{cost} credits · Level {requiredLevel}</span>
              </div>
              <ul className="mt-2 list-inside list-disc text-xs text-white/50">
                {(RANK_PERKS[rank]??[]).map((perk)=>(<li key={perk}>{perk}</li>))}
              </ul>
              {!owned && (
                <div className="mt-3 flex gap-2">
                  <Button size="sm" disabled={pendingRank===rank||balance<cost} onClick={()=>buyRank(rank)}>Buy for {cost}</Button>
                  <Button size="sm" variant="secondary" disabled={pendingRank===rank||!levelReady} onClick={()=>claimRank(rank)}>Claim (level {requiredLevel})</Button>
                </div>
              )}
            </article>
          );
        })}
      </div>
      <article id="addons" className="scroll-mt-20 mt-4 rounded-2xl border border-fuchsia-400/25 bg-gradient-to-br from-fuchsia-500/[.1] to-cyan-500/[.05] p-5">
        <div className="flex flex-wrap items-start justify-between gap-3"><div className="flex gap-3"><span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-fuchsia-500/15 text-fuchsia-300"><PackageOpen size={19}/></span><div><h3 className="font-mono font-bold text-white">SpawnDex Cosmetic Pack</h3><p className="mt-1 max-w-md text-xs text-white/45">A downloadable Minecraft Education .mcaddon with SpawnDex-themed cosmetics.</p></div></div><span className="text-xs text-white/40">{promoApplied&&<s className="mr-1 text-white/25">{COSMETIC_PACK_COST}</s>}{discountedCost(COSMETIC_PACK_COST,promoApplied?PROMO_CODE:"")} credits</span></div>
        <div className="mt-4">{profile.cosmeticPackOwned?<a href="/downloads/edushare-cosmetic-pack.mcaddon" download className="cursor-target inline-flex items-center gap-2 rounded-xl bg-brand-500 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-400"><Download size={15}/>Download add-on</a>:<Button size="sm" disabled={pendingAddon||balance<discountedCost(COSMETIC_PACK_COST,promoApplied?PROMO_CODE:"")} onClick={buyAddon}>{pendingAddon?"Purchasing…":`Buy add-on for ${discountedCost(COSMETIC_PACK_COST,promoApplied?PROMO_CODE:"")}`}</Button>}</div>
      </article>
      {rankMessage && <p className="mt-3 text-sm text-cyan-300">{rankMessage}</p>}
    </div>
    </section>
    <CosmeticsShop />
    <AdvertiserPanel />
    <section className="profile-ranks-section mt-8">
      <div className="rounded-2xl border border-red-500/20 bg-red-500/[.04] p-5">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div><p className="font-mono text-sm font-semibold text-red-200">Delete account</p><p className="mt-1 text-xs text-white/40">Permanently remove your profile, credits, cosmetics, username, and sign-in.</p></div>
          <button type="button" onClick={()=>{setDeleteOpen(true);setDeleteError("");}} className="cursor-target inline-flex shrink-0 items-center justify-center gap-2 rounded-xl border border-red-400/30 bg-red-500/10 px-4 py-2 text-sm font-semibold text-red-200 transition hover:bg-red-500/20"><Trash2 size={15}/>Delete account</button>
        </div>
      </div>
    </section>
    {deleteOpen&&<div className="fixed inset-0 z-[1000] grid place-items-center bg-black/75 p-4 backdrop-blur-sm" role="dialog" aria-modal="true" aria-labelledby="delete-account-title">
      <div className="w-full max-w-md rounded-2xl border border-red-400/25 bg-[#141619] p-6 shadow-2xl">
        <div className="flex items-start justify-between gap-4"><div><h2 id="delete-account-title" className="font-mono text-lg font-bold text-red-200">Delete your account?</h2><p className="mt-2 text-sm leading-6 text-white/50">This permanently deletes your profile, credits, cosmetics, username, and login. Messages you already sent may remain in chat history.</p></div><button type="button" onClick={()=>setDeleteOpen(false)} className="cursor-target rounded-lg p-1.5 text-white/35 hover:bg-white/10 hover:text-white"><X size={17}/></button></div>
        <label className="mt-5 block text-xs font-semibold text-white/55">Type <span className="font-mono text-red-300">DELETE</span> to confirm</label>
        <input autoFocus value={deleteConfirmation} onChange={event=>setDeleteConfirmation(event.target.value)} placeholder="DELETE" className="mt-2 w-full rounded-xl border border-border bg-black/20 px-4 py-3 font-mono text-sm text-white outline-none focus:border-red-400/50"/>
        {user?.providerData.some(provider=>provider.providerId==="password")&&<><label className="mt-4 block text-xs font-semibold text-white/55">Current password</label><input type="password" value={deletePassword} onChange={event=>setDeletePassword(event.target.value)} placeholder="Enter your password" className="mt-2 w-full rounded-xl border border-border bg-black/20 px-4 py-3 text-sm text-white outline-none focus:border-red-400/50"/></>}
        {deleteError&&<p className="mt-3 text-xs text-red-300">{deleteError}</p>}
        <div className="mt-6 flex justify-end gap-2"><Button type="button" variant="secondary" onClick={()=>setDeleteOpen(false)} disabled={deleting}>Cancel</Button><button type="button" onClick={handleDeleteAccount} disabled={deleteConfirmation!=="DELETE"||deleting||(!!user?.providerData.some(provider=>provider.providerId==="password")&&!deletePassword)} className="cursor-target inline-flex items-center gap-2 rounded-xl bg-red-500 px-4 py-2 text-sm font-semibold text-white transition hover:bg-red-400 disabled:cursor-not-allowed disabled:opacity-35"><Trash2 size={14}/>{deleting?"Deleting…":"Delete permanently"}</button></div>
      </div>
    </div>}
  </div>;
}
