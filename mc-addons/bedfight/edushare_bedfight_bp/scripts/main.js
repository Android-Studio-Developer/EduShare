import { BlockPermutation, DisplaySlotId, GameMode, system, world } from "@minecraft/server";

const PREFIX = "§8[§bEdu§dShare §cBed Fight§8]§r";
const SETUP_KEY = "edushare:bedfight_setup";
const PLACED_BLOCKS_KEY = "edushare:bedfight_placed_blocks";
const TEAM_TAGS = { red: "bf_red", blue: "bf_blue" };
const TEAM_COLORS = { red: "§c", blue: "§9" };
const WOOL = { red: "minecraft:red_wool", blue: "minecraft:blue_wool" };
const state = { active: false, redBed: true, blueBed: true, winnerPending: false, activeMapId: null };
const placedBlocks = new Map();
const KILLS_OBJECTIVE = "bf_kills";

// The currently-live map's saved red/blue/lobby data — cached at match start
// so the hot paths (block-break checks, the void-kill interval) don't have to
// re-parse the whole map registry off a dynamic property every time.
let activeMap = null;

function ensureKillsObjective() {
  let objective = world.scoreboard.getObjective(KILLS_OBJECTIVE);
  if (!objective) objective = world.scoreboard.addObjective(KILLS_OBJECTIVE, "Kills");
  try {
    world.scoreboard.setObjectiveAtDisplaySlot(DisplaySlotId.Sidebar, { objective });
  } catch { /* Older Education builds may not support the sidebar display slot. */ }
  return objective;
}

function resetKills(player) {
  try { ensureKillsObjective().setScore(player, 0); } catch { /* Best-effort — the match still works without the scoreboard. */ }
}

function addKill(player) {
  try {
    const objective = ensureKillsObjective();
    const current = objective.hasParticipant(player) ? (objective.getScore(player) ?? 0) : 0;
    const next = current + 1;
    objective.setScore(player, next);
    return next;
  } catch {
    return null;
  }
}

function killsOf(player) {
  try {
    return world.scoreboard.getObjective(KILLS_OBJECTIVE)?.getScore(player) ?? 0;
  } catch {
    return 0;
  }
}

function tell(message) {
  world.sendMessage(`${PREFIX} ${message}`);
}

function tellPlayer(player, message) {
  player.sendMessage(`${PREFIX} ${message}`);
}

function safeRun(entity, command) {
  try { entity.runCommand(command); } catch { /* An old Education build may not support one cosmetic command. */ }
}

function locationKey(dimensionId, location) {
  return `${dimensionId}|${Math.floor(location.x)},${Math.floor(location.y)},${Math.floor(location.z)}`;
}

// setup shape: { maps: { [mapId]: { name, red, blue, lobby } } }
// Old single-map saves (top-level .red/.blue/.lobby) are wrapped into a
// "default" map the first time they're loaded, so nobody loses their setup.
function loadSetup() {
  let setup;
  try {
    const value = world.getDynamicProperty(SETUP_KEY);
    setup = typeof value === "string" ? JSON.parse(value) : {};
  } catch {
    setup = {};
  }
  if (!setup.maps) {
    setup.maps = setup.red || setup.blue || setup.lobby
      ? { default: { name: "Default", red: setup.red, blue: setup.blue, lobby: setup.lobby } }
      : {};
  }
  return setup;
}

function saveSetup(setup) {
  world.setDynamicProperty(SETUP_KEY, JSON.stringify({ maps: setup.maps }));
}

function normalizeMapId(rawMapId) {
  return (rawMapId ?? "").trim().toLowerCase().replace(/[^a-z0-9_]+/g, "_").replace(/^_+|_+$/g, "");
}

function mapComplete(map) {
  return !!(map && map.red && map.blue && map.lobby);
}

function completeMapIds(setup) {
  return Object.keys(setup.maps ?? {}).filter((id) => mapComplete(setup.maps[id]));
}

function loadPlacedBlocks() {
  try {
    const value = world.getDynamicProperty(PLACED_BLOCKS_KEY);
    const saved = typeof value === "string" ? JSON.parse(value) : [];
    return Array.isArray(saved) ? saved : [];
  } catch {
    return [];
  }
}

function savePlacedBlocks() {
  try {
    world.setDynamicProperty(PLACED_BLOCKS_KEY, JSON.stringify([...placedBlocks.values()]));
  } catch { /* The in-memory tracker still works if an old Education build cannot persist it. */ }
}

function trackPlacedBlock(player, block) {
  if (!state.active || !teamOf(player) || !block) return;
  const location = { x: block.x, y: block.y, z: block.z };
  const key = locationKey(block.dimension.id, location);
  placedBlocks.set(key, { dimensionId: block.dimension.id, location, placerId: player.id });
  savePlacedBlocks();
}

// Lets a player clear away just the blocks THEY placed — a redo button for a
// bad bed defense build — without ending the match.
function clearOwnDefense(player) {
  if (!state.active) {
    tellPlayer(player, "§cNo match is active.");
    return;
  }
  const allPlaced = new Map(placedBlocks);
  for (const data of loadPlacedBlocks()) {
    if (!data?.dimensionId || !data?.location) continue;
    allPlaced.set(locationKey(data.dimensionId, data.location), data);
  }
  let cleared = 0;
  for (const [key, data] of allPlaced) {
    if (data.placerId !== player.id) continue;
    try {
      const block = world.getDimension(data.dimensionId).getBlock(data.location);
      if (block) block.setType("minecraft:air");
    } catch { /* Ignore unloaded edge blocks. */ }
    placedBlocks.delete(key);
    cleared += 1;
  }
  savePlacedBlocks();
  tellPlayer(player, cleared > 0 ? `§aCleared §f${cleared}§a block(s) of your bed defense.` : "§7You haven't placed any blocks yet.");
}

function repairSword(player) {
  try {
    const container = player.getComponent("minecraft:inventory")?.container;
    if (!container) return;
    for (let slot = 0; slot < container.size; slot += 1) {
      const item = container.getItem(slot);
      if (item?.typeId !== "minecraft:iron_sword") continue;
      const durability = item.getComponent("minecraft:durability");
      if (!durability || durability.damage === 0) continue;
      durability.damage = 0;
      container.setItem(slot, item);
    }
  } catch { /* Older Education builds still receive Unbreaking III below. */ }
}

function isBedBlock(block) {
  if (!block) return false;
  // Current Bedrock uses color-specific IDs such as minecraft:white_bed,
  // while several Minecraft Education builds still expose every color as the
  // legacy minecraft:bed block. Explicitly support both without mistaking
  // minecraft:bedrock for a bed.
  return block.typeId === "minecraft:bed" || /^minecraft:[a-z0-9_]+_bed$/.test(block.typeId);
}

function findNearbyBed(player) {
  const origin = player.location;
  const blocks = [];
  for (let x = -5; x <= 5; x += 1) {
    for (let y = -3; y <= 2; y += 1) {
      for (let z = -5; z <= 5; z += 1) {
        const block = player.dimension.getBlock({ x: Math.floor(origin.x) + x, y: Math.floor(origin.y) + y, z: Math.floor(origin.z) + z });
        if (isBedBlock(block)) {
          blocks.push({
            x: block.x,
            y: block.y,
            z: block.z,
            typeId: block.typeId,
            states: block.permutation.getAllStates(),
          });
        }
      }
    }
  }
  return blocks;
}

function setupBase(team, player, rawMapId) {
  const mapId = normalizeMapId(rawMapId);
  if (!mapId) {
    tellPlayer(player, `§cUsage: §e/scriptevent edushare:bedfight set_${team} <mapName>`);
    return;
  }
  const beds = findNearbyBed(player);
  if (!beds.length) {
    tellPlayer(player, "§cNo bed found within 5 blocks. Stand beside your team's bed and try again.");
    return;
  }
  const setup = loadSetup();
  const map = setup.maps[mapId] ?? { name: rawMapId.trim() };
  map[team] = {
    dimensionId: player.dimension.id,
    spawn: { x: player.location.x, y: player.location.y, z: player.location.z },
    rotation: player.getRotation(),
    beds,
  };
  setup.maps[mapId] = map;
  saveSetup(setup);
  tellPlayer(player, `${TEAM_COLORS[team]}${team.toUpperCase()} base saved§r for §f${map.name}§r (${beds.length} bed blocks).`);
}

// Manually override just the starting (spawn) position for a team on a map,
// independent of where the bed itself is — set_red/set_blue already save the
// player's standing spot as a default spawn, this is for fine-tuning it after.
function setSpawn(team, player, rawMapId) {
  const mapId = normalizeMapId(rawMapId);
  if (!mapId) {
    tellPlayer(player, `§cUsage: §e/scriptevent edushare:bedfight set_spawn_${team} <mapName>`);
    return;
  }
  const setup = loadSetup();
  const map = setup.maps[mapId];
  if (!map?.[team]) {
    tellPlayer(player, `§cSet the ${team.toUpperCase()} bed for §f${rawMapId.trim()}§c first: §e/scriptevent edushare:bedfight set_${team} <mapName>`);
    return;
  }
  map[team].spawn = { x: player.location.x, y: player.location.y, z: player.location.z };
  map[team].rotation = player.getRotation();
  saveSetup(setup);
  tellPlayer(player, `${TEAM_COLORS[team]}${team.toUpperCase()}§r starting position updated for §f${map.name}§r.`);
}

function setupLobby(player, rawMapId) {
  const mapId = normalizeMapId(rawMapId);
  if (!mapId) {
    tellPlayer(player, "§cUsage: §e/scriptevent edushare:bedfight set_lobby <mapName>");
    return;
  }
  const setup = loadSetup();
  const map = setup.maps[mapId] ?? { name: rawMapId.trim() };
  map.lobby = {
    dimensionId: player.dimension.id,
    spawn: { x: player.location.x, y: player.location.y, z: player.location.z },
    rotation: player.getRotation(),
  };
  setup.maps[mapId] = map;
  saveSetup(setup);
  tellPlayer(player, `§aLobby saved§r for §f${map.name}§r.`);
}

function listMaps(player) {
  const setup = loadSetup();
  const ids = Object.keys(setup.maps);
  if (!ids.length) {
    tellPlayer(player, "§7No maps registered yet. See §f/scriptevent edushare:bedfight help§7.");
    return;
  }
  tellPlayer(player, "§b--- Registered maps ---");
  for (const id of ids) {
    const map = setup.maps[id];
    const ready = mapComplete(map);
    const missing = ["red", "blue", "lobby"].filter((piece) => !map[piece]);
    tellPlayer(player, `${ready ? "§a✓" : "§c✗"} §f${map.name} §7(${id})${ready ? "" : ` — missing: ${missing.join(", ")}`}`);
  }
}

function removeMap(player, rawMapId) {
  const mapId = normalizeMapId(rawMapId);
  const setup = loadSetup();
  if (!setup.maps[mapId]) {
    tellPlayer(player, "§cNo map registered with that name.");
    return;
  }
  const name = setup.maps[mapId].name;
  delete setup.maps[mapId];
  saveSetup(setup);
  tellPlayer(player, `§aRemoved map §f${name}§a.`);
}

function teamOf(player) {
  if (player.hasTag(TEAM_TAGS.red)) return "red";
  if (player.hasTag(TEAM_TAGS.blue)) return "blue";
  return null;
}

function teamPlayer(team) {
  return world.getAllPlayers().find((player) => player.hasTag(TEAM_TAGS[team]));
}

function teleportTo(entry, player) {
  const dimension = world.getDimension(entry.dimensionId || "minecraft:overworld");
  player.teleport(entry.spawn, { dimension, rotation: entry.rotation ?? { x: 0, y: 0 } });
}

function equip(player, team) {
  safeRun(player, "clear @s");
  safeRun(player, "replaceitem entity @s slot.armor.head 0 leather_helmet 1 0");
  safeRun(player, "replaceitem entity @s slot.armor.chest 0 leather_chestplate 1 0");
  safeRun(player, "replaceitem entity @s slot.armor.legs 0 leather_leggings 1 0");
  safeRun(player, "replaceitem entity @s slot.armor.feet 0 leather_boots 1 0");
  safeRun(player, "give @s iron_sword 1");
  safeRun(player, "enchant @s unbreaking 3");
  safeRun(player, "give @s wooden_pickaxe 1");
  safeRun(player, "give @s wooden_axe 1");
  safeRun(player, "give @s shears 1");
  safeRun(player, `give @s ${WOOL[team].replace("minecraft:", "")} 128`);
  player.addEffect("minecraft:resistance", 60, { amplifier: 4, showParticles: false });
  player.addEffect("minecraft:saturation", 40, { amplifier: 5, showParticles: false });
}

function clearPlacedBlocks() {
  const blocksToClear = new Map(placedBlocks);
  for (const data of loadPlacedBlocks()) {
    if (!data?.dimensionId || !data?.location) continue;
    blocksToClear.set(locationKey(data.dimensionId, data.location), data);
  }
  for (const data of blocksToClear.values()) {
    try {
      const block = world.getDimension(data.dimensionId).getBlock(data.location);
      if (block) block.setType("minecraft:air");
    } catch { /* Ignore unloaded edge blocks. */ }
  }
  placedBlocks.clear();
  try { world.setDynamicProperty(PLACED_BLOCKS_KEY, undefined); } catch { /* Old Education fallback. */ }
}

function restoreBeds(map) {
  for (const team of ["red", "blue"]) {
    const base = map?.[team];
    if (!base) continue;
    const dimension = world.getDimension(base.dimensionId);
    for (const saved of base.beds) {
      try {
        const block = dimension.getBlock(saved);
        if (block) block.setPermutation(BlockPermutation.resolve(saved.typeId, saved.states));
      } catch {
        const block = dimension.getBlock(saved);
        if (block) block.setType(saved.typeId);
      }
    }
  }
}

function prepareWorld() {
  const overworld = world.getDimension("minecraft:overworld");
  for (const command of [
    "gamerule doimmediaterespawn true",
    "gamerule keepinventory false",
    "gamerule dofiretick false",
    "gamerule mobgriefing false",
    "difficulty normal",
  ]) safeRun(overworld, command);
}

// Personal "4...3...2...1... START!" countdown for the two fighters, ending
// in a boom playsound heard by everyone (spectators included).
function runStartCountdown(red, blue) {
  let count = 4;
  const step = () => {
    if (!state.active) return;
    const fighters = [red, blue].filter((p) => p?.isValid());
    if (count > 0) {
      for (const p of fighters) {
        p.onScreenDisplay.setTitle(`§e${count}`, { fadeInDuration: 0, stayDuration: 18, fadeOutDuration: 2 });
      }
      count -= 1;
      system.runTimeout(step, 20);
      return;
    }
    for (const p of fighters) {
      p.onScreenDisplay.setTitle("§aSTART!", { fadeInDuration: 0, stayDuration: 20, fadeOutDuration: 6 });
    }
    for (const p of world.getAllPlayers()) p.playSound("random.explode");
  };
  step();
}

function startMatch(forcedMapId) {
  const setup = loadSetup();
  const ids = completeMapIds(setup);
  if (!ids.length) {
    tell("§cNo complete maps registered. Save red, blue, and lobby for at least one map first. Run §f/scriptevent edushare:bedfight help§c.");
    return;
  }
  const red = teamPlayer("red");
  const blue = teamPlayer("blue");
  if (!red || !blue || red.id === blue.id) {
    tell("§cExactly one online player needs §fbf_red§c and one needs §fbf_blue§c.");
    return;
  }

  let mapId = forcedMapId ? normalizeMapId(forcedMapId) : null;
  if (mapId && !ids.includes(mapId)) {
    tell(`§cMap §f${forcedMapId}§c isn't registered (or isn't complete yet). Run §f/scriptevent edushare:bedfight list_maps§c.`);
    return;
  }
  if (!mapId) {
    // Randomize, but avoid repeating the map that just played when another is available.
    const pool = ids.length > 1 ? ids.filter((id) => id !== state.activeMapId) : ids;
    mapId = pool[Math.floor(Math.random() * pool.length)];
  }
  const map = setup.maps[mapId];
  state.activeMapId = mapId;
  activeMap = map;

  prepareWorld();
  clearPlacedBlocks();
  restoreBeds(map);
  state.active = true;
  state.redBed = true;
  state.blueBed = true;
  state.winnerPending = false;
  ensureKillsObjective();
  resetKills(red);
  resetKills(blue);

  red.setGameMode(GameMode.survival);
  teleportTo(map.red, red);
  equip(red, "red");
  red.onScreenDisplay.setTitle("§cRED TEAM", { subtitle: "§fProtect your bed. Break theirs.", fadeInDuration: 5, stayDuration: 35, fadeOutDuration: 10 });
  blue.setGameMode(GameMode.survival);
  teleportTo(map.blue, blue);
  equip(blue, "blue");
  blue.onScreenDisplay.setTitle("§9BLUE TEAM", { subtitle: "§fProtect your bed. Break theirs.", fadeInDuration: 5, stayDuration: 35, fadeOutDuration: 10 });
  tell(`§c${red.name} §7vs §9${blue.name}§7 on §f${map.name}§7!`);
  system.runTimeout(() => runStartCountdown(red, blue), 30);
}

function finishMatch(winner, reason = "won the Bed Fight") {
  if (!state.active || state.winnerPending) return;
  state.winnerPending = true;
  state.active = false;
  winner.onScreenDisplay.setTitle("§6VICTORY!", { subtitle: `§f${reason}`, fadeInDuration: 5, stayDuration: 60, fadeOutDuration: 15 });
  tell(`§6${winner.name} §f${reason}!`);
  const red = teamPlayer("red");
  const blue = teamPlayer("blue");
  if (red && blue) tell(`§7Kills — §c${red.name}: ${killsOf(red)} §7· §9${blue.name}: ${killsOf(blue)}`);
  system.runTimeout(() => resetMatch(false), 80);
}

function resetMatch(announce = true) {
  const map = activeMap;
  state.active = false;
  state.redBed = true;
  state.blueBed = true;
  state.winnerPending = false;
  clearPlacedBlocks();
  if (map) restoreBeds(map);
  for (const player of world.getAllPlayers()) {
    if (!teamOf(player)) continue;
    safeRun(player, "clear @s");
    player.setGameMode(GameMode.adventure);
    if (map?.lobby) teleportTo(map.lobby, player);
  }
  activeMap = null;
  if (announce) tell("Match reset. Run §f/scriptevent edushare:bedfight start§r when ready.");
}

function nearestCommandPlayer(event) {
  const source = event.sourceEntity ?? event.initiator;
  if (source?.typeId === "minecraft:player") return source;
  return world.getAllPlayers()[0];
}

function showHelp(player) {
  const lines = [
    "§b--- eduShare Bed Fight setup ---",
    "§f1. Stand beside RED bed: §e/scriptevent edushare:bedfight set_red <mapName>",
    "§f2. Stand beside BLUE bed: §e/scriptevent edushare:bedfight set_blue <mapName>",
    "§f3. Stand at spectator lobby: §e/scriptevent edushare:bedfight set_lobby <mapName>",
    "§f4. Repeat 1-3 for every map you want in rotation.",
    "§f   Fine-tune a starting position without moving the bed: §e/scriptevent edushare:bedfight set_spawn_red <mapName>§f (or set_spawn_blue)",
    "§f5. Red player: §e/tag @s add bf_red",
    "§f6. Blue player: §e/tag @s add bf_blue",
    "§f7. Start (random map): §e/scriptevent edushare:bedfight start",
    "§f   Start a specific map: §e/scriptevent edushare:bedfight start <mapName>",
    "§fList maps: §e/scriptevent edushare:bedfight list_maps",
    "§fRemove a map: §e/scriptevent edushare:bedfight remove_map <mapName>",
    "§fDuring a match, clear only YOUR placed blocks: §e/scriptevent edushare:bedfight clear_defense",
    "§fReset: §e/scriptevent edushare:bedfight reset",
  ];
  for (const line of lines) player.sendMessage(line);
}

system.afterEvents.scriptEventReceive.subscribe((event) => {
  if (event.id !== "edushare:bedfight") return;
  const raw = event.message.trim();
  const spaceIndex = raw.indexOf(" ");
  const command = (spaceIndex === -1 ? raw : raw.slice(0, spaceIndex)).toLowerCase();
  const arg = spaceIndex === -1 ? "" : raw.slice(spaceIndex + 1).trim();
  const player = nearestCommandPlayer(event);
  if (!player) return;
  if (command === "set_red") setupBase("red", player, arg);
  else if (command === "set_blue") setupBase("blue", player, arg);
  else if (command === "set_lobby") setupLobby(player, arg);
  else if (command === "set_spawn_red") setSpawn("red", player, arg);
  else if (command === "set_spawn_blue") setSpawn("blue", player, arg);
  else if (command === "list_maps") listMaps(player);
  else if (command === "remove_map") removeMap(player, arg);
  else if (command === "start") startMatch(arg || undefined);
  else if (command === "reset") resetMatch();
  else if (command === "clear_defense") clearOwnDefense(player);
  else showHelp(player);
});

// Map protection removed by request — only enemy beds are special-cased now;
// every other block breaks with default survival rules, placed or not.
world.beforeEvents.playerBreakBlock.subscribe((event) => {
  if (!state.active || !activeMap) return;
  const bedTeam = ["red", "blue"].find((team) => activeMap[team]?.beds?.some((bed) => bed.x === event.block.x && bed.y === event.block.y && bed.z === event.block.z));
  if (!bedTeam) return;
  event.cancel = true;
  if (teamOf(event.player) === bedTeam) {
    system.run(() => tellPlayer(event.player, "§cYou cannot break your own bed."));
    return;
  }
  system.run(() => {
    if (!state.active || !state[`${bedTeam}Bed`] || !activeMap) return;
    state[`${bedTeam}Bed`] = false;
    const dimension = world.getDimension(activeMap[bedTeam].dimensionId);
    for (const bed of activeMap[bedTeam].beds) dimension.getBlock(bed)?.setType("minecraft:air");
    tell(`${TEAM_COLORS[bedTeam]}${bedTeam.toUpperCase()} BED §fwas destroyed by §e${event.player.name}§f! Final death enabled.`);
    for (const player of world.getAllPlayers()) player.playSound("random.anvil_land");
  });
});

// Record the coordinate before protection can evaluate a fast break. Keep the
// after-event fallback for Education builds that do not expose the before event.
world.beforeEvents.playerPlaceBlock?.subscribe((event) => trackPlacedBlock(event.player, event.block));
world.afterEvents.playerPlaceBlock.subscribe((event) => trackPlacedBlock(event.player, event.block));

// Intrusion alert — an enemy breaking into your bed defense (any block you
// placed, tracked above) gets you a dragon-growl warning, not just silence.
world.afterEvents.playerBreakBlock.subscribe((event) => {
  if (!state.active) return;
  const key = locationKey(event.block.dimension.id, event.block.location);
  const placed = placedBlocks.get(key);
  if (!placed) return;
  placedBlocks.delete(key);
  savePlacedBlocks();
  if (placed.placerId === event.player.id) return;
  const placer = world.getAllPlayers().find((p) => p.id === placed.placerId);
  if (!placer) return;
  const breakerTeam = teamOf(event.player);
  const placerTeam = teamOf(placer);
  if (!breakerTeam || !placerTeam || breakerTeam === placerTeam) return;
  placer.playSound("mob.enderdragon.growl");
  tellPlayer(placer, `§c⚠ ${event.player.name} §7is breaking into your defense!`);
});

world.afterEvents.entityDie.subscribe((event) => {
  if (!state.active || event.deadEntity.typeId !== "minecraft:player") return;
  const player = event.deadEntity;
  const team = teamOf(player);
  if (!team) return;

  const killer = event.damageSource?.damagingEntity;
  if (killer?.typeId === "minecraft:player" && killer.id !== player.id && teamOf(killer)) {
    const total = addKill(killer);
    if (total !== null) tell(`${TEAM_COLORS[teamOf(killer)]}${killer.name} §7got a kill (${total}).`);
  }

  if (!state[`${team}Bed`]) {
    const opponent = teamPlayer(team === "red" ? "blue" : "red");
    if (opponent) finishMatch(opponent, "won by final elimination");
  } else {
    tell(`${TEAM_COLORS[team]}${player.nameTag} §7died and will respawn — their bed is still alive.`);
  }
});

// "YOU DIED!" title with a live 3...2...1 respawn countdown. The player is
// held in spectator (native instant-respawn already moved them somewhere in
// the world) until the countdown ends, then dropped back into their base.
world.afterEvents.playerSpawn.subscribe((event) => {
  if (!state.active || event.initialSpawn || !activeMap) return;
  const player = event.player;
  const team = teamOf(player);
  if (!team || !activeMap[team]) return;
  if (!state[`${team}Bed`]) return;

  player.setGameMode(GameMode.spectator);
  let count = 3;
  const tick = () => {
    if (!state.active || !player.isValid()) return;
    if (!state[`${team}Bed`]) return; // bed died mid-countdown — stay eliminated
    if (count > 0) {
      player.onScreenDisplay.setTitle("§cYOU DIED!", { subtitle: `§fRespawning in §e${count}§f...`, fadeInDuration: 0, stayDuration: 24, fadeOutDuration: 0 });
      count -= 1;
      system.runTimeout(tick, 20);
      return;
    }
    player.setGameMode(GameMode.survival);
    teleportTo(activeMap[team], player);
    equip(player, team);
    player.onScreenDisplay.setTitle("§aRESPAWNED", { subtitle: "§f3 seconds of spawn protection", fadeInDuration: 0, stayDuration: 25, fadeOutDuration: 8 });
  };
  tick();
});

system.runInterval(() => {
  if (!state.active || !activeMap) return;
  const voidY = Math.min(activeMap.red?.spawn?.y ?? 0, activeMap.blue?.spawn?.y ?? 0) - 18;
  for (const player of world.getAllPlayers()) {
    if (!teamOf(player)) continue;
    repairSword(player);
    if (player.location.y < voidY) player.kill();
  }
}, 5);

system.runTimeout(() => {
  const player = world.getAllPlayers()[0];
  if (player) tellPlayer(player, "§aBed Fight loaded. Run §f/scriptevent edushare:bedfight help§a for setup.");
}, 40);
