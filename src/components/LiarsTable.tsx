import { Canvas, useFrame } from "@react-three/fiber";
import { Billboard, ContactShadows, Float, OrbitControls, RoundedBox, Sparkles as DreiSparkles, Text } from "@react-three/drei";
import { useEffect, useRef, useState } from "react";
import type { Group, Mesh, Vector3Tuple } from "three";
import { Bot, Copy, Crosshair, LogOut, Mic, MicOff, PhoneOff, Plus, ShieldQuestion, Sparkles, Users, X } from "lucide-react";
import { useAuth } from "../context/AuthContext";
import { useVoiceCall } from "../context/VoiceCallContext";
import {
  advanceAgnes,
  believeLiarsClaim,
  cancelLiarsRoom,
  challengeLiarsClaim,
  createLiarsRoom,
  joinLiarsRoom,
  playLiarsCards,
  startLiarsRoom,
  subscribeToLiarsRooms,
  type LiarsEffect,
  type LiarsPlayer,
  type LiarsRoom,
} from "../lib/liarsTable";
import Button from "./Button";
import { ensureLiarsVoiceChannel } from "../lib/voice";
import { isLowPowerDevice } from "../lib/accessibility";

const SEAT_POSITIONS: Vector3Tuple[] = [[0, .15, 3.15], [-3.45, .15, 0], [0, .15, -3.15], [3.45, .15, 0]];
const SEAT_ROTATIONS = [Math.PI, -Math.PI / 2, 0, Math.PI / 2];
const LIARS_VOICE_RECONNECT_KEY = "edushare-liars-voice-room";
type RoulettePhase = "idle" | "aim" | "spin" | "trigger" | "result";

function EliminationProp({ effect, target }: { effect: LiarsEffect | null; target: Vector3Tuple }) {
  const group = useRef<Group>(null);
  const chamber = useRef<Mesh>(null);
  const flash = useRef<Mesh>(null);
  const started = useRef(0);
  const seen = useRef(0);

  useFrame(({ clock }) => {
    if (!group.current || !chamber.current || !flash.current) return;
    if (effect && effect.id !== seen.current) { seen.current = effect.id; started.current = clock.elapsedTime; }
    const elapsed = clock.elapsedTime - started.current;
    const active = started.current > 0 && elapsed < 3.45;
    const aim = Math.min(1, Math.max(0, elapsed / .65));
    const spin = elapsed >= .55 && elapsed < 1.65;
    const suspense = elapsed >= 1.65 && elapsed < 2.25;
    const triggerElapsed = elapsed - 2.25;
    const fired = Boolean(effect?.fired && triggerElapsed >= 0 && triggerElapsed < .22);

    group.current.position.y = active ? .68 + (.54 * (1 - Math.pow(1 - aim, 3))) : 1.22;
    group.current.position.x = fired ? -Math.sin(Math.min(1, triggerElapsed * 6) * Math.PI) * .32 : 0;
    group.current.rotation.z = suspense
      ? Math.sin(elapsed * 38) * (.035 + ((2.25 - elapsed) * .018))
      : triggerElapsed >= 0 && triggerElapsed < .3 && !effect?.fired
        ? Math.sin(triggerElapsed * 55) * .022
        : 0;
    if (spin) chamber.current.rotation.x += .36 * Math.max(.16, (1.65 - elapsed) / 1.1);
    flash.current.scale.setScalar(fired && triggerElapsed < .12 ? 1.7 - (triggerElapsed * 7) : .001);
  });

  const aimRotation = Math.atan2(-target[2], target[0]);
  return <group ref={group} position={[0, 1.22, 0]} rotation={[0, aimRotation, 0]}>
    <mesh rotation={[0, 0, Math.PI / 2]}><cylinderGeometry args={[.22, .22, 1.25, 18]}/><meshStandardMaterial color="#242127" metalness={.85} roughness={.22}/></mesh>
    <mesh ref={chamber} position={[.7, 0, 0]} rotation={[0, 0, Math.PI / 2]}><cylinderGeometry args={[.32, .32, .32, 8]}/><meshStandardMaterial color="#48424d" metalness={.9} roughness={.18}/></mesh>
    <RoundedBox args={[.28, .8, .22]} radius={.08} position={[-.42, -.42, 0]} rotation={[0, 0, -.32]}><meshStandardMaterial color="#6f351e" roughness={.55}/></RoundedBox>
    <mesh ref={flash} position={[.92, 0, 0]}><sphereGeometry args={[.32, 12, 12]}/><meshBasicMaterial color="#ffcf55" transparent opacity={.9}/></mesh>
  </group>;
}

function Chair({ rotation }: { rotation: number }) {
  return <group rotation={[0, rotation, 0]} position={[0, -.05, .35]}>
    <RoundedBox castShadow args={[1.15, .18, 1.05]} radius={.12} position={[0, .48, 0]}><meshStandardMaterial color="#351914" roughness={.7}/></RoundedBox>
    <RoundedBox castShadow args={[1.22, 1.35, .16]} radius={.12} position={[0, 1.12, .48]} rotation={[-.12, 0, 0]}><meshStandardMaterial color="#28110f" roughness={.65}/></RoundedBox>
    {[-.42, .42].flatMap((x) => [-.34, .34].map((z) => <mesh castShadow key={`${x}-${z}`} position={[x, .05, z]}><cylinderGeometry args={[.055, .075, .9, 10]}/><meshStandardMaterial color="#171216" metalness={.45} roughness={.45}/></mesh>))}
  </group>;
}

function CardFan({ player, viewer }: { player: LiarsPlayer; viewer: boolean }) {
  const count = Math.min(5, player.hand.length);
  return <group position={[0, .68, -.58]}>{Array.from({ length: count }).map((_, index) => {
    const spread = index - (count - 1) / 2;
    const card = player.hand[index];
    return <group key={card.id} position={[spread * .23, Math.abs(spread) * -.025, Math.abs(spread) * .025]} rotation={[viewer ? -.25 : .1, 0, spread * -.075]}>
      <RoundedBox castShadow args={[.42, .035, .68]} radius={.035}><meshStandardMaterial color={viewer ? "#eee8dd" : "#8e2927"} roughness={.62} metalness={.08}/></RoundedBox>
      {viewer && <Text position={[0, .025, 0]} rotation={[-Math.PI / 2, 0, 0]} fontSize={.16} color="#281914" anchorX="center" anchorY="middle">{card.rank}</Text>}
    </group>;
  })}</group>;
}

type MinecraftPalette = {
  skin: string;
  hair: string;
  shirt: string;
  shirtDark: string;
  pants: string;
  eye: string;
};

const MINECRAFT_SKINS: MinecraftPalette[] = [
  { skin: "#b97a57", hair: "#2f211b", shirt: "#2f8f83", shirtDark: "#1d655f", pants: "#334f8d", eye: "#4154a5" },
  { skin: "#d7a477", hair: "#b96332", shirt: "#6f9f45", shirtDark: "#476d2d", pants: "#4c463e", eye: "#3f7b58" },
  { skin: "#8f5f44", hair: "#171416", shirt: "#9a3838", shirtDark: "#652525", pants: "#242c48", eye: "#6ec8e8" },
  { skin: "#e1b487", hair: "#dbc34e", shirt: "#7554a7", shirtDark: "#4d3771", pants: "#33343d", eye: "#3974a8" },
];

function minecraftPalette(player: LiarsPlayer): MinecraftPalette {
  if (player.isBot) return { skin: "#694171", hair: "#281d35", shirt: "#4d2868", shirtDark: "#301840", pants: "#24162e", eye: "#77f0ff" };
  const seed = [...player.id].reduce((value, letter) => ((value * 31) + letter.charCodeAt(0)) >>> 0, 7);
  return MINECRAFT_SKINS[seed % MINECRAFT_SKINS.length];
}

function MinecraftPlayer({ player, active }: { player: LiarsPlayer; active: boolean }) {
  const skin = minecraftPalette(player);
  const dim = player.alive ? 1 : .23;
  const emissive = active ? "#a05b1a" : "#000000";
  const emissiveIntensity = active ? .42 : 0;
  const material = (color: string) => ({ color, roughness: .82, emissive, emissiveIntensity });

  return <Float speed={active ? 2.2 : .8} rotationIntensity={0} floatIntensity={active ? .055 : .018}>
    <group scale={[1, dim, 1]}>
      {/* Minecraft-style 8 × 8 × 8 head and pixel face. */}
      <mesh castShadow position={[0, 1.72, 0]}><boxGeometry args={[.66, .66, .66]}/><meshStandardMaterial {...material(skin.skin)}/></mesh>
      <mesh castShadow position={[0, 2.005, -.02]}><boxGeometry args={[.69, .12, .69]}/><meshStandardMaterial {...material(skin.hair)}/></mesh>
      <mesh castShadow position={[-.285, 1.82, -.02]}><boxGeometry args={[.12, .3, .69]}/><meshStandardMaterial {...material(skin.hair)}/></mesh>
      <mesh castShadow position={[.285, 1.82, -.02]}><boxGeometry args={[.12, .3, .69]}/><meshStandardMaterial {...material(skin.hair)}/></mesh>
      {[-.17, .17].map((x) => <group key={x}>
        <mesh position={[x, 1.76, .337]}><boxGeometry args={[.12, .095, .018]}/><meshBasicMaterial color={player.isBot ? "#17272e" : "#f5f3df"}/></mesh>
        <mesh position={[x + .025, 1.76, .349]}><boxGeometry args={[.052, .07, .012]}/><meshBasicMaterial color={skin.eye}/></mesh>
      </group>)}
      <mesh position={[0, 1.57, .342]}><boxGeometry args={[.19, .045, .018]}/><meshBasicMaterial color={player.isBot ? "#81eef6" : "#6e4037"}/></mesh>

      {/* Block torso, sleeves, hands, and seated legs follow Minecraft proportions. */}
      <mesh castShadow position={[0, 1.03, .02]}><boxGeometry args={[.7, .76, .38]}/><meshStandardMaterial {...material(skin.shirt)}/></mesh>
      <mesh position={[0, 1.11, .216]}><boxGeometry args={[.42, .13, .018]}/><meshStandardMaterial {...material(skin.shirtDark)}/></mesh>
      {[-.48, .48].map((x) => <group key={x} position={[x, 1.03, .15]} rotation={[-.82, 0, x < 0 ? -.08 : .08]}>
        <mesh castShadow><boxGeometry args={[.24, .66, .24]}/><meshStandardMaterial {...material(skin.shirtDark)}/></mesh>
        <mesh castShadow position={[0, -.4, 0]}><boxGeometry args={[.24, .2, .24]}/><meshStandardMaterial {...material(skin.skin)}/></mesh>
      </group>)}
      {[-.2, .2].map((x) => <group key={x} position={[x, .47, .2]} rotation={[-1.18, 0, 0]}>
        <mesh castShadow><boxGeometry args={[.3, .58, .31]}/><meshStandardMaterial {...material(skin.pants)}/></mesh>
        <mesh castShadow position={[0, -.37, 0]}><boxGeometry args={[.31, .2, .42]}/><meshStandardMaterial {...material("#20242d")}/></mesh>
      </group>)}
    </group>
  </Float>;
}

function PlayerModel({ player, index, active, viewer }: { player: LiarsPlayer; index: number; active: boolean; viewer: boolean }) {
  const position = SEAT_POSITIONS[index];
  return <group position={position} rotation={[0, SEAT_ROTATIONS[index], 0]}>
    <Chair rotation={0}/>
    {!viewer && <MinecraftPlayer player={player} active={active}/>} 
    <CardFan player={player} viewer={viewer}/>
    <Billboard position={[0, viewer ? 1.05 : 2.28, 0]}><Text fontSize={.2} color={active ? "#ffd47c" : player.alive ? "#f3eee6" : "#77727b"} outlineWidth={.012} outlineColor="#09080b" anchorX="center">{viewer ? "YOU" : player.name}</Text></Billboard>
    {active && <pointLight position={[0, 2, 0]} color="#ff9b42" intensity={5} distance={2.8}/>} 
  </group>;
}

function RoomShell({ lowPower }: { lowPower: boolean }) {
  return <group>
    <mesh receiveShadow rotation={[-Math.PI / 2, 0, 0]} position={[0, -.52, 0]}><planeGeometry args={[22, 22]}/><meshStandardMaterial color="#130f12" roughness={.88}/></mesh>
    <mesh receiveShadow position={[0, 4.1, -6]}><boxGeometry args={[14, 9, .35]}/><meshStandardMaterial color="#170e10" roughness={.84}/></mesh>
    <mesh receiveShadow position={[-7, 4.1, 0]}><boxGeometry args={[.35, 9, 12]}/><meshStandardMaterial color="#120d11" roughness={.9}/></mesh>
    <mesh receiveShadow position={[7, 4.1, 0]}><boxGeometry args={[.35, 9, 12]}/><meshStandardMaterial color="#120d11" roughness={.9}/></mesh>
    {[-4.7, 4.7].map((x) => <group key={x} position={[x, 2.6, -5.78]}><RoundedBox args={[2.7, 2.25, .12]} radius={.08}><meshStandardMaterial color="#24161a" roughness={.7}/></RoundedBox><mesh position={[0, 0, .08]}><planeGeometry args={[2.35, 1.9]}/><meshStandardMaterial color="#08070a" emissive="#531917" emissiveIntensity={.22}/></mesh></group>)}
    {[-3.8, 0, 3.8].map((x) => <group key={x} position={[x, 5.1, 0]}><mesh><cylinderGeometry args={[.025, .025, 3.2, 8]}/><meshStandardMaterial color="#151218"/></mesh><mesh position={[0, -1.7, 0]}><cylinderGeometry args={[.72, .28, .42, 24]}/><meshStandardMaterial color="#241b19" metalness={.45} roughness={.4}/></mesh><pointLight castShadow={!lowPower} position={[0, -1.9, 0]} color="#ffbb72" intensity={14} distance={6} shadow-mapSize={[512, 512]}/></group>)}
    {!lowPower && <DreiSparkles count={38} scale={[13, 6, 10]} size={1.5} speed={.08} color="#d58a62" opacity={.18}/>}
  </group>;
}

function TableWorld({ players, currentId, effect, viewerId }: { players: LiarsPlayer[]; currentId: string; effect: LiarsEffect | null; viewerId: string }) {
  const lowPower = isLowPowerDevice();
  const ordered = [...players.filter((player) => player.id === viewerId), ...players.filter((player) => player.id !== viewerId)];
  const targetIndex = Math.max(0, ordered.findIndex((player) => player.id === effect?.targetId));
  return <Canvas shadows={!lowPower} dpr={lowPower ? .75 : [1, 1.4]} camera={{ position: [0, 2.65, 7.2], fov: 47 }} gl={{ antialias: !lowPower, powerPreference: "high-performance" }}>
    <color attach="background" args={["#09070a"]}/><fog attach="fog" args={["#09070a", 8, 18]}/>
    <ambientLight intensity={.18}/><directionalLight castShadow={!lowPower} position={[4, 7, 5]} intensity={1.2} color="#ffc98b" shadow-mapSize={[1024, 1024]}/><pointLight position={[-4, 2, -4]} intensity={8} distance={9} color="#9f2f20"/>
    <RoomShell lowPower={lowPower}/>
    <group rotation={[0, -.08, 0]}>
      <mesh castShadow receiveShadow position={[0, -.2, 0]}><cylinderGeometry args={[3.45, 3.08, .48, 48]}/><meshStandardMaterial color="#2a1210" roughness={.72} metalness={.15}/></mesh>
      <mesh receiveShadow position={[0, .06, 0]}><cylinderGeometry args={[3.18, 3.18, .12, 48]}/><meshStandardMaterial color="#17473c" roughness={.94}/></mesh>
      <mesh receiveShadow rotation={[-Math.PI / 2, 0, 0]} position={[0, .14, 0]}><ringGeometry args={[2.82, 3.08, 48]}/><meshStandardMaterial color="#b97835" metalness={.65} roughness={.3}/></mesh>
      {ordered.map((player, index) => <PlayerModel key={player.id} player={player} index={index} active={currentId === player.id} viewer={player.id === viewerId}/>)}
      <EliminationProp effect={effect} target={SEAT_POSITIONS[targetIndex]}/>
    </group>
    {!lowPower && <ContactShadows position={[0, -.49, 0]} opacity={.55} scale={13} blur={2.4} far={8}/>}
    <OrbitControls makeDefault target={[0, .8, 0]} enablePan={false} minDistance={6.2} maxDistance={8.4} minPolarAngle={.9} maxPolarAngle={1.35} minAzimuthAngle={-.62} maxAzimuthAngle={.62}/>
  </Canvas>;
}

function roomCode(id: string) { return id.slice(-6).toUpperCase(); }

function PlayerChip({ player, current }: { player: LiarsPlayer; current: boolean }) {
  return <div className={`rounded-xl border p-3 ${current ? "border-amber-300/45 bg-amber-300/[.08]" : "border-white/[.07] bg-black/20"} ${!player.alive ? "opacity-35 grayscale" : ""}`}>
    <div className="flex items-center gap-2">{player.photoUrl ? <img src={player.photoUrl} alt="" className="h-8 w-8 rounded-lg object-cover"/> : <span className={`grid h-8 w-8 place-items-center rounded-lg ${player.isBot ? "bg-violet-500/20 text-violet-200" : "bg-emerald-500/20 text-emerald-200"}`}>{player.isBot ? <Bot size={15}/> : player.name[0]}</span>}<div className="min-w-0 flex-1"><p className="truncate text-xs font-bold text-white">{player.name}</p><p className="text-[9px] uppercase tracking-wider text-white/30">{player.isBot ? "Agnes bot" : `${player.hand.length} cards`}</p></div></div>
    <div className="mt-2 flex items-center gap-2" title="Six-chamber Russian roulette">
      <Crosshair size={12} className={player.alive ? "text-amber-300/70" : "text-rose-400"}/>
      <div className="flex gap-1">{Array.from({ length: 6 }).map((_, index) => <span key={index} className={`h-1.5 w-1.5 rounded-full border ${index < player.strikes ? "border-white/10 bg-white/10" : "border-amber-200/35 bg-amber-200/10"}`}/>)}</div>
      <span className="text-[9px] uppercase tracking-wider text-white/30">{player.alive ? `${player.strikes} empty` : "fired"}</span>
    </div>
  </div>;
}

export default function LiarsTable() {
  const { user } = useAuth();
  const voice = useVoiceCall();
  const [rooms, setRooms] = useState<LiarsRoom[]>([]);
  const [selectedId, setSelectedId] = useState("");
  const [selectedCards, setSelectedCards] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [roulettePhase, setRoulettePhase] = useState<RoulettePhase>("idle");
  const [visualPlayers, setVisualPlayers] = useState<LiarsPlayer[]>([]);
  const restoredRoomRef = useRef(false);
  const voiceReconnectAttemptRef = useRef("");
  const previousRoomRef = useRef<LiarsRoom | null>(null);
  const seenRouletteRef = useRef(0);
  const rouletteAnimatingRef = useRef(false);
  const room = rooms.find((item) => item.id === selectedId) ?? null;
  const me = room?.players.find((player) => player.id === user?.uid);
  const current = room?.players.find((player) => player.id === room.currentId);
  const myTurn = room?.status === "playing" && room.currentId === user?.uid && me?.alive;
  const needsDecision = Boolean(myTurn && room?.lastClaim);
  const displayName = user?.displayName || user?.email?.split("@")[0] || "Player";
  const tableVoiceId = room ? `liars-${room.id}` : "";
  const inTableVoice = Boolean(tableVoiceId && voice.joinedChannelId === tableVoiceId);
  const rouletteActive = roulettePhase !== "idle";
  const renderedPlayers = visualPlayers.length ? visualPlayers : room?.players ?? [];
  const rouletteTarget = room?.players.find((player) => player.id === room.lastEffect?.targetId)?.name ?? "Player";

  useEffect(() => subscribeToLiarsRooms(setRooms, setError), []);
  useEffect(() => setSelectedCards([]), [room?.round, room?.currentId]);
  useEffect(() => {
    seenRouletteRef.current = room?.lastEffect?.id ?? 0;
    rouletteAnimatingRef.current = false;
    setRoulettePhase("idle");
    setVisualPlayers(room?.players ?? []);
    previousRoomRef.current = room;
  }, [room?.id]);
  useEffect(() => {
    const effect = room?.lastEffect;
    if (!room || !effect || effect.id === seenRouletteRef.current) return;

    seenRouletteRef.current = effect.id;
    rouletteAnimatingRef.current = true;
    setVisualPlayers(previousRoomRef.current?.players ?? room.players);
    setRoulettePhase("aim");
    const timers = [
      window.setTimeout(() => setRoulettePhase("spin"), 650),
      window.setTimeout(() => setRoulettePhase("trigger"), 1650),
      window.setTimeout(() => {
        setVisualPlayers(room.players);
        setRoulettePhase("result");
      }, 2250),
      window.setTimeout(() => {
        rouletteAnimatingRef.current = false;
        setRoulettePhase("idle");
      }, 3450),
    ];
    return () => timers.forEach((timer) => window.clearTimeout(timer));
  }, [room?.lastEffect?.id]);
  useEffect(() => {
    previousRoomRef.current = room;
    if (!rouletteAnimatingRef.current && room) setVisualPlayers(room.players);
  }, [room]);
  useEffect(() => {
    if (restoredRoomRef.current || !user || rooms.length === 0) return;
    restoredRoomRef.current = true;
    const activeRoom = rooms.find((item) => item.playerIds.includes(user.uid) && (item.status === "playing" || item.status === "waiting"));
    if (activeRoom) setSelectedId(activeRoom.id);
  }, [rooms, user]);
  useEffect(() => {
    if (!room || !user || voice.joinedChannelId || voice.connecting) return;
    if (localStorage.getItem(LIARS_VOICE_RECONNECT_KEY) !== room.id) return;
    if (voiceReconnectAttemptRef.current === room.id) return;
    voiceReconnectAttemptRef.current = room.id;
    void joinTableVoice();
  }, [room?.id, user?.uid, voice.joinedChannelId, voice.connecting]);
  useEffect(() => {
    if (!room || rouletteAnimatingRef.current || rouletteActive || room.status !== "playing" || !current?.isBot || user?.uid !== room.hostId) return;
    const timer = window.setTimeout(() => void run(() => advanceAgnes(room.id), false), 1150);
    return () => window.clearTimeout(timer);
  }, [room?.id, room?.updatedAt, room?.currentId, room?.status, current?.isBot, room?.hostId, user?.uid, rouletteActive]);

  async function run(action: () => Promise<unknown>, showBusy = true) {
    if (showBusy) setBusy(true);
    setError("");
    try { return await action(); }
    catch (cause) { setError(cause instanceof Error ? cause.message : "That table action failed."); }
    finally { if (showBusy) setBusy(false); }
  }

  async function createRoom() {
    if (!user) return;
    const ref = await run(() => createLiarsRoom(user.uid, displayName, user.photoURL || ""));
    if (ref && typeof ref === "object" && "id" in ref) setSelectedId(String(ref.id));
  }

  async function join(roomId: string) {
    if (!user) return;
    await run(() => joinLiarsRoom(roomId, user.uid, displayName, user.photoURL || ""));
    setSelectedId(roomId);
  }

  async function joinTableVoice() {
    if (!room || !user) return;
    setError("");
    try {
      const channelId = await ensureLiarsVoiceChannel(room.id, user.uid, displayName);
      if (voice.joinedChannelId && voice.joinedChannelId !== channelId) voice.leave();
      localStorage.setItem(LIARS_VOICE_RECONNECT_KEY, room.id);
      await voice.join(channelId, { uid: user.uid, displayName, photoUrl: user.photoURL || "", rank: "none" });
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not join table voice.");
    }
  }

  function leaveTableVoice() {
    localStorage.removeItem(LIARS_VOICE_RECONNECT_KEY);
    if (room) voiceReconnectAttemptRef.current = room.id;
    voice.leave();
  }

  const openRooms = rooms.filter((item) => item.status === "waiting");
  const listedRooms = rooms.filter((item) => item.status === "waiting" || (item.status === "playing" && item.playerIds.includes(user?.uid ?? "")));

  if (!room) return <section className="mt-7 overflow-hidden rounded-3xl border border-orange-400/20 bg-[#0d0b10]">
    <header className="border-b border-white/[.07] bg-[radial-gradient(circle_at_15%_10%,rgba(194,65,12,.24),transparent_32%),linear-gradient(115deg,#1c0d0b,#0d0b10_55%,#15101d)] p-6 sm:p-8"><p className="font-mono text-[10px] font-bold uppercase tracking-[.3em] text-orange-300/70">Live bluff rooms</p><h2 className="mt-2 text-3xl font-black text-white">Liar&apos;s Table 3D</h2><p className="mt-2 max-w-xl text-sm text-white/40">Bluff your cards, call out liars, and make the loser pull the trigger in six-chamber Russian roulette. Agnes AI fills empty chairs.</p><Button className="mt-5" onClick={createRoom} disabled={busy || !user}><Plus size={15}/>{busy ? "Opening…" : "Open a table"}</Button></header>
    <div className="p-5 sm:p-7"><div className="mb-4 flex items-center justify-between"><h3 className="flex items-center gap-2 text-sm font-bold text-white"><Users size={16} className="text-orange-300"/>Available tables</h3><span className="text-[10px] text-white/30">{openRooms.length} open</span></div><div className="grid gap-3 md:grid-cols-2">{listedRooms.map((item) => { const alreadySeated = item.playerIds.includes(user?.uid ?? ""); return <article key={item.id} className="flex items-center gap-3 rounded-2xl border border-white/[.07] bg-white/[.025] p-4"><div className="grid h-11 w-11 place-items-center rounded-xl bg-orange-500/10 font-mono text-xs font-black text-orange-200">{roomCode(item.id)}</div><div className="min-w-0 flex-1"><p className="truncate text-sm font-bold text-white">{item.players[0]?.name}&apos;s table</p><p className="text-[10px] text-white/30">{item.status === "playing" ? "Match in progress · your seat is saved" : `${item.playerIds.length}/4 people · Agnes fills the rest`}</p></div><Button onClick={() => alreadySeated ? setSelectedId(item.id) : join(item.id)} disabled={busy}>{item.status === "playing" ? "Resume" : alreadySeated ? "Open" : "Join"}</Button></article>; })}{listedRooms.length === 0 && <div className="col-span-full rounded-2xl border border-dashed border-white/10 py-14 text-center"><ShieldQuestion size={24} className="mx-auto text-white/20"/><p className="mt-3 text-sm text-white/35">No open or active tables yet.</p></div>}</div>{error && <p className="mt-4 rounded-xl border border-red-400/20 bg-red-400/[.06] p-3 text-xs text-red-200">{error}</p>}</div>
  </section>;

  return <section className="mt-7 overflow-hidden rounded-3xl border border-orange-400/20 bg-[#0d0b10] shadow-[0_35px_100px_-60px_rgba(249,115,22,.65)]">
    <header className="flex flex-wrap items-center justify-between gap-3 border-b border-white/[.07] px-5 py-4"><div><p className="text-[10px] uppercase tracking-[.22em] text-white/30">Room <b className="text-orange-200">{roomCode(room.id)}</b></p><h2 className="text-xl font-black text-white">Liar&apos;s Table 3D</h2></div><div className="flex flex-wrap items-center gap-2">{inTableVoice ? <><span className="rounded-xl border border-emerald-400/20 bg-emerald-400/[.07] px-2.5 py-2 text-[10px] text-emerald-200">{voice.participants.length} in voice</span><button type="button" onClick={voice.toggleMute} className={`cursor-target rounded-xl border p-2 ${voice.muted ? "border-red-400/25 bg-red-400/10 text-red-300" : "border-white/10 text-white/60"}`} title={voice.muted ? "Unmute" : "Mute"}>{voice.muted ? <MicOff size={15}/> : <Mic size={15}/>}</button><button type="button" onClick={leaveTableVoice} className="cursor-target rounded-xl border border-red-400/20 p-2 text-red-300" title="Leave voice"><PhoneOff size={15}/></button></> : <button type="button" onClick={joinTableVoice} disabled={voice.connecting} className="cursor-target flex items-center gap-1.5 rounded-xl border border-emerald-400/20 bg-emerald-400/[.07] px-3 py-2 text-xs font-bold text-emerald-200 disabled:opacity-50"><Mic size={14}/>{voice.connecting ? "Connecting…" : localStorage.getItem(LIARS_VOICE_RECONNECT_KEY) === room.id ? "Reconnect VC" : "Join VC"}</button>}<button type="button" onClick={() => void navigator.clipboard.writeText(roomCode(room.id))} className="cursor-target rounded-xl border border-white/10 p-2 text-white/45 hover:text-white" title="Copy room code"><Copy size={15}/></button><button type="button" onClick={() => setSelectedId("")} className="cursor-target rounded-xl border border-white/10 p-2 text-white/45 hover:text-white" title="Back to rooms"><LogOut size={15}/></button></div></header>
    <div className="grid lg:grid-cols-[minmax(0,1fr)_21rem]">
      <div>
        <div className="relative h-[31rem] overflow-hidden border-b border-white/[.07] sm:h-[42rem]"><TableWorld players={renderedPlayers} currentId={room.currentId} effect={room.lastEffect} viewerId={user?.uid ?? ""}/><div className="pointer-events-none absolute inset-x-0 top-4 flex justify-center"><div className="rounded-2xl border border-white/10 bg-black/55 px-5 py-2 text-center shadow-2xl backdrop-blur-md"><p className="font-mono text-[9px] uppercase tracking-[.22em] text-white/35">{room.status === "waiting" ? "Waiting room" : `Round ${room.round} · table rank`}</p><p className="text-xl font-black text-amber-200">{room.status === "waiting" ? `${room.playerIds.length}/4 joined` : room.target}</p><p className="mt-0.5 text-[8px] uppercase tracking-widest text-white/20">Drag to look around</p></div></div>{rouletteActive && room.lastEffect && <div key={room.lastEffect.id} className={`liars-roulette-overlay pointer-events-none absolute inset-0 grid place-items-center ${roulettePhase === "result" && room.lastEffect.fired ? "liars-roulette-fired" : ""}`}><div className="liars-roulette-reticle"/><div className="mt-44 rounded-2xl border border-white/10 bg-black/75 px-6 py-3 text-center shadow-2xl backdrop-blur-md"><p className="font-mono text-[9px] uppercase tracking-[.3em] text-amber-200/55">Russian roulette · {rouletteTarget}</p><p className="mt-1 text-sm font-black uppercase tracking-[.18em] text-white">{roulettePhase === "aim" ? "Aim locked" : roulettePhase === "spin" ? "Spinning chamber…" : roulettePhase === "trigger" ? "Pulling the trigger…" : room.lastEffect.fired ? "Bang — eliminated" : "Click — survived"}</p></div></div>}</div>
        {room.status === "waiting" ? <div className="p-5 text-center"><p className="text-sm text-white/50">Share code <b className="font-mono text-orange-200">{roomCode(room.id)}</b>. Starting now fills empty seats with Agnes AI.</p>{room.hostId === user?.uid ? <div className="mt-4 flex justify-center gap-2"><Button onClick={() => run(() => startLiarsRoom(room.id, user.uid))} disabled={busy}><Bot size={15}/>Start with Agnes</Button><Button variant="danger" onClick={() => run(() => cancelLiarsRoom(room.id, user.uid))} disabled={busy}><X size={15}/>Close</Button></div> : <p className="mt-3 text-xs text-white/30">Waiting for the host to start…</p>}</div> : <div className="p-4 sm:p-6">
          {rouletteActive ? <div className="py-8 text-center"><Crosshair size={22} className="mx-auto animate-pulse text-amber-300"/><p className="mt-2 text-sm font-black uppercase tracking-widest text-white/60">Russian roulette in progress…</p></div> : room.status === "finished" ? <div className="py-5 text-center"><Sparkles size={24} className="mx-auto text-amber-300"/><p className="mt-2 text-2xl font-black text-white">{room.winnerName} wins</p></div> : me?.alive ? <><div className="mb-4 text-center">{room.lastClaim ? <p className="text-sm text-white/60"><b className="text-orange-200">{room.lastClaim.playerName}</b> claims {room.lastClaim.cards.length} × {room.target}</p> : <p className="text-xs text-white/35">{myTurn ? "Your turn—choose one to three cards" : `Waiting for ${current?.name}…`}</p>}</div><div className="flex min-h-24 flex-wrap justify-center gap-2">{me.hand.map((card) => { const chosen = selectedCards.includes(card.id); return <button key={card.id} type="button" disabled={!myTurn || needsDecision} onClick={() => setSelectedCards((value) => chosen ? value.filter((id) => id !== card.id) : value.length < 3 ? [...value, card.id] : value)} className={`cursor-target grid h-24 w-16 place-items-center rounded-xl border text-lg font-black transition-all disabled:cursor-not-allowed disabled:opacity-50 ${chosen ? "-translate-y-3 border-amber-200 bg-amber-100 text-stone-950" : "border-white/15 bg-gradient-to-br from-stone-100 to-stone-400 text-stone-900 hover:-translate-y-1"}`}>{card.rank === "Joker" ? <small>Joker</small> : card.rank}</button>; })}</div><div className="mt-5 flex justify-center gap-2">{needsDecision ? <><Button variant="danger" onClick={() => run(() => challengeLiarsClaim(room.id, user!.uid))} disabled={busy}><ShieldQuestion size={15}/>Call liar</Button><Button onClick={() => run(() => believeLiarsClaim(room.id, user!.uid))} disabled={busy}>Believe</Button></> : <Button onClick={() => run(() => playLiarsCards(room.id, user!.uid, selectedCards))} disabled={busy || !myTurn || selectedCards.length === 0}>Play {selectedCards.length || ""} face down</Button>}</div></> : <p className="py-8 text-center text-sm text-white/35">You were eliminated. The table continues live.</p>}
        </div>}
      </div>
      <aside className="border-t border-white/[.07] bg-black/20 p-5 lg:border-l lg:border-t-0"><h3 className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-white/50"><Users size={14}/>Seats</h3><div className="mt-3 grid grid-cols-2 gap-2 lg:grid-cols-1">{renderedPlayers.map((player) => <PlayerChip key={player.id} player={player} current={room.currentId === player.id}/>)}</div>{inTableVoice && <div className="mt-4 rounded-xl border border-emerald-400/15 bg-emerald-400/[.05] p-3"><p className="flex items-center gap-1.5 text-xs font-bold text-emerald-200"><Mic size={13}/>Table voice connected</p><p className="mt-1 text-[10px] text-white/35">{voice.participants.map((participant) => participant.displayName).join(", ") || "Connecting participants…"}</p></div>}{voice.micError && <p className="mt-3 rounded-xl border border-red-400/20 bg-red-400/[.06] p-3 text-xs text-red-200">{voice.micError}</p>}<h3 className="mt-6 text-xs font-bold uppercase tracking-wider text-white/50">Table log</h3><ol className="mt-3 space-y-2">{room.log.slice(0, 8).map((entry, index) => <li key={`${entry}-${index}`} className={`border-l pl-3 text-[11px] leading-relaxed ${index ? "border-white/10 text-white/30" : "border-orange-300 text-white/65"}`}>{entry}</li>)}</ol>{error && <p className="mt-4 rounded-xl border border-red-400/20 bg-red-400/[.06] p-3 text-xs text-red-200">{error}</p>}</aside>
    </div>
  </section>;
}
