import { useEffect, useState, type FormEvent } from "react";
import { Coins, Gamepad2, Gift, Lock, User } from "lucide-react";
import { useAuth } from "../context/AuthContext";
import { claimDailyCredits, ensureProfile, isOnline, subscribeToProfile, updateProfileData } from "../lib/profiles";
import { checkUsernameAvailable, claimUsername, isValidUsername, normalizeUsername } from "../lib/usernames";
import { ensureWallet, subscribeToBalance } from "../lib/shop";
import { isStealthEnabled, setStealthEnabled } from "../components/StealthMode";
import { useUiVersion } from "../context/UiVersionContext";
import { useBackground } from "../context/BackgroundContext";
import { getTextSize, isHighContrast, isReduceMotion, setHighContrast, setReduceMotion, setTextSize, type TextSize } from "../lib/accessibility";
import { sendPublicMessage } from "../lib/chat";
import { arcadeLevel } from "../lib/minigames";
import {
  BANNER_EFFECTS,
  canUseBannerEffects,
  claimRankByLevel,
  minutesToLevel,
  PURCHASABLE_RANKS,
  purchaseRank,
  RANK_COLOR,
  RANK_CREDIT_COST,
  RANK_LABEL,
  RANK_LEVEL_REQUIRED,
  RANK_PERKS,
  rankNameClass,
  rankTier,
} from "../lib/ranks";
import type { UserProfile } from "../types";
import BannerEffect from "../components/BannerEffect";
import Button from "../components/Button";
import RankBadge from "../components/RankBadge";
import StatusBadge from "../components/StatusBadge";
import StatusDot from "../components/StatusDot";
import UserBadges from "../components/UserBadges";

export default function Profile() { const {user,role,syncDisplayName}=useAuth(); const {uiVersion,setUiVersion:setUiVersionState}=useUiVersion(); const {background,setBackground}=useBackground(); const [profile,setProfile]=useState<UserProfile|null>(null); const [balance,setBalance]=useState(0); const [message,setMessage]=useState(""); const [rankMessage,setRankMessage]=useState(""); const [pendingRank,setPendingRank]=useState(""); const [stealth,setStealth]=useState(isStealthEnabled()); const [reduceMotion,setReduceMotionState]=useState(isReduceMotion()); const [textSize,setTextSizeState]=useState<TextSize>(getTextSize()); const [highContrast,setHighContrastState]=useState(isHighContrast());
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
  function chooseUiVersion(v:"v1"|"v2"){setUiVersionState(v);}
  function toggleReduceMotion(){const next=!reduceMotion;setReduceMotionState(next);setReduceMotion(next);}
  function toggleTextSize(){const next:TextSize=textSize==="large"?"normal":"large";setTextSizeState(next);setTextSize(next);}
  function toggleHighContrast(){const next=!highContrast;setHighContrastState(next);setHighContrast(next);}
  useEffect(()=>{if(!user)return; void ensureProfile(user.uid,user.displayName??"Player"); return subscribeToProfile(user.uid,setProfile);},[user]);
  useEffect(()=>{if(!user)return; void ensureWallet(user.uid); return subscribeToBalance(user.uid,setBalance);},[user]);
  async function save(e:FormEvent){e.preventDefault();if(!user||!profile)return;await updateProfileData(user.uid,{displayName:profile.displayName,photoUrl:profile.photoUrl,bio:profile.bio,bannerUrl:profile.bannerUrl,bannerEffect:canUseBannerEffects(profile.rank)?profile.bannerEffect:"",favoriteGames:profile.favoriteGames});await syncDisplayName(profile.displayName);setMessage("Profile saved.");}
  function pickEffect(id:string){if(!profile||!canUseBannerEffects(profile.rank))return;setProfile({...profile,bannerEffect:profile.bannerEffect===id?"":id});}
  async function claim(){if(!user)return;try{await claimDailyCredits(user.uid);setMessage("You received 15 eduShare Credits!");}catch(e){setMessage(e instanceof Error?e.message:"Could not claim reward.");}}
  async function buyRank(rank:(typeof PURCHASABLE_RANKS)[number]){if(!user||!profile)return;setPendingRank(rank);setRankMessage("");try{await purchaseRank(user.uid,rank);setRankMessage(`Purchased ${RANK_LABEL[rank]}!`);void sendPublicMessage(user.uid,"eduBot",`${profile.displayName} just unlocked ${RANK_LABEL[rank]}!`,"none",{isBot:true});}catch(e){setRankMessage(e instanceof Error?e.message:"Purchase failed.");}finally{setPendingRank("");}}
  async function claimRank(rank:(typeof PURCHASABLE_RANKS)[number]){if(!user||!profile)return;setPendingRank(rank);setRankMessage("");try{await claimRankByLevel(user.uid,rank);setRankMessage(`Claimed ${RANK_LABEL[rank]}!`);void sendPublicMessage(user.uid,"eduBot",`${profile.displayName} just unlocked ${RANK_LABEL[rank]}!`,"none",{isBot:true});}catch(e){setRankMessage(e instanceof Error?e.message:"Could not claim rank.");}finally{setPendingRank("");}}
  if(!profile)return <div className="p-20 text-center text-white/40">Loading profile…</div>;
  const level = minutesToLevel(profile.playMinutes);
  return <div className="mx-auto max-w-2xl px-6 py-14">
    <div className="overflow-hidden rounded-2xl border border-border bg-surface">
      <div
        className="relative h-36 bg-gradient-to-r from-brand-600 to-fuchsia-600 bg-cover bg-center"
        style={profile.bannerUrl ? { backgroundImage: `url(${profile.bannerUrl})` } : undefined}
      >
        <BannerEffect effect={profile.bannerEffect} />
      </div>
      <div className="px-6 pb-6">
        <div className="-mt-10 flex items-end justify-between">
          <div className="relative">
            {profile.photoUrl?<img src={profile.photoUrl} alt="Profile" className="h-20 w-20 rounded-2xl border-4 border-surface object-cover"/>:<div className="flex h-20 w-20 items-center justify-center rounded-2xl border-4 border-surface bg-gradient-to-br from-cyan-400 to-fuchsia-500"><User size={30}/></div>}
            <StatusDot online={isOnline(profile)} className="absolute -bottom-1 -right-1 h-5 w-5" />
          </div>
          <StatusBadge online={isOnline(profile)} />
        </div>
        <div className="mt-3 flex items-center gap-2">
          <h1 className={`font-mono text-2xl font-bold ${rankNameClass(profile.rank)}`}>{profile.displayName}</h1>
          <RankBadge rank={profile.rank}/>
          <UserBadges profile={profile}/>
        </div>
        <p className="text-sm text-brand-300">{role} · Level {level}</p>
        <p className="mt-1 flex items-center gap-1 text-sm text-amber-300"><Coins size={14}/>{balance} credits</p>
        <p className="mt-1 flex items-center gap-1 text-sm text-indigo-300"><Gamepad2 size={14}/>{profile.botXp} arcade XP · Lv.{arcadeLevel(profile.botXp)}</p>
        {profile.favoriteGames && <p className="mt-1 text-sm text-white/50">Plays: {profile.favoriteGames}</p>}
        {user?.email && <p className="mt-1 text-xs text-white/30">{user.email}</p>}
      </div>
    </div>
    <Button onClick={claim} className="mt-6 w-full"><Gift size={16}/>Claim daily +15 credits</Button>
    <p className="v2-card-title mt-8">Profile</p>
    <form onSubmit={save} className="mt-6 space-y-4 rounded-2xl border border-border bg-surface p-6"><input required value={profile.displayName} onChange={e=>setProfile({...profile,displayName:e.target.value})} placeholder="Display name" className="w-full rounded-xl border border-border bg-surface-2 px-4 py-3 text-white"/>
<div>
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
<input type="url" value={profile.photoUrl} onChange={e=>setProfile({...profile,photoUrl:e.target.value})} placeholder="Profile image URL" className="w-full rounded-xl border border-border bg-surface-2 px-4 py-3 text-white"/><input type="url" value={profile.bannerUrl} onChange={e=>setProfile({...profile,bannerUrl:e.target.value})} placeholder="Banner image URL" className="w-full rounded-xl border border-border bg-surface-2 px-4 py-3 text-white"/>
<div>
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
<input value={profile.favoriteGames} maxLength={100} onChange={e=>setProfile({...profile,favoriteGames:e.target.value})} placeholder="Favorite games (e.g. Minecraft, Valorant)" className="w-full rounded-xl border border-border bg-surface-2 px-4 py-3 text-white"/><textarea maxLength={300} rows={5} value={profile.bio} onChange={e=>setProfile({...profile,bio:e.target.value})} placeholder="Tell the community about yourself" className="w-full rounded-xl border border-border bg-surface-2 px-4 py-3 text-white"/>{message&&<p className="text-sm text-cyan-300">{message}</p>}<Button type="submit" className="w-full">Save profile</Button></form>

    <p className="v2-card-title mt-8">Preferences</p>
    <div className="mt-6 flex items-center justify-between gap-3 rounded-2xl border border-border bg-surface p-5">
      <div>
        <p className="font-mono text-sm font-semibold text-white">Stealth mode</p>
        <p className="mt-0.5 text-xs text-white/40">Tab title & icon switch to Google when you switch away.</p>
      </div>
      <button type="button" onClick={toggleStealth} className={`cursor-target relative h-6 w-11 shrink-0 rounded-full transition-colors ${stealth?"bg-brand-500":"bg-white/15"}`}>
        <span className={`absolute top-0.5 h-5 w-5 rounded-full bg-white transition-transform ${stealth?"translate-x-5":"translate-x-0.5"}`} />
      </button>
    </div>

    <div className="mt-4 flex items-center justify-between gap-3 rounded-2xl border border-border bg-surface p-5">
      <div>
        <p className="font-mono text-sm font-semibold text-white">Interface</p>
        <p className="mt-0.5 text-xs text-white/40">V2 switches to a left sidebar layout with grouped navigation, a Plus Jakarta Sans font, and card-based sections.</p>
      </div>
      <div className="flex shrink-0 rounded-full border border-border bg-surface-2 p-1">
        <button type="button" onClick={()=>chooseUiVersion("v1")} className={`cursor-target rounded-full px-3 py-1 text-xs font-semibold transition-colors ${uiVersion==="v1"?"bg-brand-500 text-white":"text-white/50 hover:text-white"}`}>V1</button>
        <button type="button" onClick={()=>chooseUiVersion("v2")} className={`cursor-target rounded-full px-3 py-1 text-xs font-semibold transition-colors ${uiVersion==="v2"?"bg-brand-500 text-white":"text-white/50 hover:text-white"}`}>V2</button>
      </div>
    </div>

    {uiVersion==="v2" && (
      <div className="mt-4 flex items-center justify-between gap-3 rounded-2xl border border-border bg-surface p-5">
        <div>
          <p className="font-mono text-sm font-semibold text-white">Background</p>
          <p className="mt-0.5 text-xs text-white/40">Galaxy is an animated starfield; Dots is the classic V1 background.</p>
        </div>
        <div className="flex shrink-0 rounded-full border border-border bg-surface-2 p-1">
          <button type="button" onClick={()=>setBackground("galaxy")} className={`cursor-target rounded-full px-3 py-1 text-xs font-semibold transition-colors ${background==="galaxy"?"bg-brand-500 text-white":"text-white/50 hover:text-white"}`}>Galaxy</button>
          <button type="button" onClick={()=>setBackground("dots")} className={`cursor-target rounded-full px-3 py-1 text-xs font-semibold transition-colors ${background==="dots"?"bg-brand-500 text-white":"text-white/50 hover:text-white"}`}>Dots</button>
        </div>
      </div>
    )}

    <div className="mt-4 space-y-3 rounded-2xl border border-border bg-surface p-5">
      <p className="font-mono text-sm font-semibold text-white">Accessibility</p>
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-sm text-white/70">Reduce motion</p>
          <p className="text-xs text-white/40">Turns off background animation, click sparks & cursor spin.</p>
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
    </div>

    <p className="v2-card-title mt-8">Progression</p>
    <div className="mt-10">
      <h2 className="font-mono text-xl font-bold text-white">Ranks</h2>
      <p className="mt-1 text-xs text-white/40">Buy with eduShare Credits, or reach the required level to claim free. 5 minutes on site = 1 level.</p>
      <div className="mt-4 space-y-3">
        {PURCHASABLE_RANKS.map((rank)=>{
          const owned = rankTier(profile.rank)>=rankTier(rank);
          const requiredLevel = RANK_LEVEL_REQUIRED[rank]??0;
          const cost = RANK_CREDIT_COST[rank]??0;
          const levelReady = level>=requiredLevel;
          return (
            <article key={rank} className="rounded-2xl border border-border bg-surface p-5">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <span className={`font-mono font-bold ${RANK_COLOR[rank]}`}>{RANK_LABEL[rank]}</span>
                  {owned && <span className="rounded-full border border-border px-2 py-0.5 text-[11px] text-white/40">Owned</span>}
                </div>
                <span className="text-xs text-white/40">{cost} credits · Level {requiredLevel}</span>
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
      {rankMessage && <p className="mt-3 text-sm text-cyan-300">{rankMessage}</p>}
    </div>
  </div>;
}
