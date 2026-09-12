# eduShare Bed Fight 1.0.8

A Minecraft Education/Bedrock 1v1 Bed Fight controller bundled with `bedfightbedrock.mcworld`.

## Install

Open `EduShare-BedFight.mcworld`. Minecraft Education imports the world with the behavior pack already attached.

The standalone `edushare-bedfight.mcaddon` is also included if you want to attach the controller to another map.

## Map setup (repeat per map)

Enable cheats and Beta APIs. Run these as the host, once per map you want in rotation:

1. Stand safely beside the red bed: `/scriptevent edushare:bedfight set_red <mapName>`
2. Stand safely beside the blue bed: `/scriptevent edushare:bedfight set_blue <mapName>`
3. Stand at that map's spectator lobby: `/scriptevent edushare:bedfight set_lobby <mapName>`

Fine-tune a team's exact starting position afterward without moving the bed:
`/scriptevent edushare:bedfight set_spawn_red <mapName>` (or `set_spawn_blue`) —
stand wherever you want that team to spawn and run it.

`<mapName>` is any name you pick (e.g. `icyislands`) — use the same name for all
three steps on a given map. Add as many maps as you like; `start` picks one at
random each time (and tries not to repeat the map that just played).

- List registered maps and see which are complete: `/scriptevent edushare:bedfight list_maps`
- Remove a map: `/scriptevent edushare:bedfight remove_map <mapName>`

Setup is saved in the world. Old single-map worlds upgrade automatically —
your existing red/blue/lobby becomes a map named `default`.

Player-placed block locations are saved with the world, so reset removes them
even if Minecraft reloads the behavior pack between rounds.

## Mid-match

Clear away only the blocks YOU placed (redo a bad bed defense) without ending
the round: `/scriptevent edushare:bedfight clear_defense`

## Start a match

Red player: `/tag @s add bf_red`

Blue player: `/tag @s add bf_blue`

Host — random map: `/scriptevent edushare:bedfight start`

Host — a specific map: `/scriptevent edushare:bedfight start <mapName>`

Reset at any time: `/scriptevent edushare:bedfight reset`

## Included gameplay

- 1v1 red vs blue teams, map picked at random from your registered maps
- 4...3...2...1... START! countdown with a boom sound when the match begins
- Self-serve "redo my defense" — clear just your own placed blocks mid-match
- Dragon-growl intrusion alert when an enemy breaks into your bed defense
- Defenses are cleared and beds restored automatically when a match ends
- Automatic Bed Fight kit and team wool
- Iron swords with infinite durability
- Kill count — sidebar scoreboard, announced in chat, tallied at match end
- Bed destruction announcements
- "YOU DIED!" title with a live 3...2...1 respawn countdown while your bed lives
- Final elimination after your bed is gone
- Void kills
- Three seconds of spawn protection
- Enemy beds are the only special-cased blocks — everything else breaks with normal survival rules
- Player-placed blocks are removed and beds restored after every match
