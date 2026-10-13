# Bandit Bastion, Stage 4: The Bastion (waves 12-17)

The working plan and handoff notes for the castle stage. Read this first when you pick the work up again. CLAUDE.md
describes the code as it is now; this file is the plan for what's still to come, the decisions behind it, and what the
earlier steps taught.

## Status

| Step | What | State |
|---|---|---|
| 1 | The bridge's gate opens after Valerius's escape; his death taunt; helmless Valerius (sprite and portrait) | **Done, playtested** |
| 2 | The castle map (`js/map_castle.js`): three parts, the door scenes, spawns, torchlight, reused minions | **Done, playtested** |
| 3 | Four new garrison minions | **Next** |
| 4 | Wave 16: Valerius seated on his throne, the audience scene, his barks, three Royal Guard champions | To do |
| 5 | Wave 17: Valerius, King of Thieves: the last fight, hazards, the twin-blade phase, his death and crown | To do |
| 6 | Docs: CLAUDE.md (file row, stage endings, events, Known issues), BALANCE.md numbers | Ongoing; update as each step lands |

The user playtests after each step, so deliver one step and wait for feedback before the next. They asked for the time
cost up front. Steps 1+2 took about an hour; step 3 is estimated at 45-75 minutes (less if the crossbowman and halberdier
go first and the other two after a playtest). Steps 4 and 5 are each bigger than step 3; step 5 is the biggest.

Nothing has been committed yet (commit only when the user asks; since v1.7 the work goes on `master`, messages like
`v1.10.3 - Bandit Bastion - Stage 4`).

### Stand-ins until steps 4 and 5

- Walking into the throne room on wave 16 shows Victory (`updateCastle` in map_castle.js: the `wave >= 16 ... showVictory()` line). Replace it with the throne audience trigger in step 4.
- `valeriusFall(e)` (map_castle.js) just calls `showVictory()`. Step 5 replaces it with his last words and the crown.
- main.js `startNextWave` already sets waves 16 and 17 to `isBossWave = true; enemiesToSpawn = 0`: their scenes spawn the champions and Valerius, like wave 11's intro does.

## The user's decisions

- **Layout:** one long map in sections, like the Raiders' Trail. Bailey (12-13), keep (14-15: great hall then treasury), throne room (16-17).
- **Wave 16:** named champions, 2-3 Royal Guard captains with their own small kits, fought together while Valerius watches from the throne and taunts.
- **Wave 17, "Valerius, King of Thieves":** keep his spear kit, add throne-room hazards, and give him a true last phase (he drops the chain and fights with two stolen blades). Not chosen: thief-king buff/gold stealing tricks (the cutpurse minion carries that theme instead).
- **Death taunt:** whenever Valerius is on the field when the hero dies (waves 11, 16 while seated, 17). Done.
- **Bosses keep their movesets and gain moves tied to their map** (standing rule for the rework).

## Playtest feedback so far

- The visuals, the dialogue boxes and helmless Valerius landed well ("a menace").
- Bandits and arrows blended into the night ground. Fixed: a pale halo under every enemy and a light pool in the darkness, light pools round enemy shots, brighter streaks on arrows and sling stones (castle only). **Apply the same to every new enemy and shot** (the halo loop in `drawCastleGround` and the pools in `drawCastleDark` already cover all enemies and enemy projectiles; give new shot sprites a castle-bright streak like `drawBanditProjectile`'s arrow).
- Hounds were too fast to kite (they matched the hero's 250 by wave 12). Fixed: base speed 210 → 180 on the trail and in the castle (BALANCE.md hound row).

## Step 3: the new garrison minions

Sprites in `js/bandits.js` (`BANDIT_SPRITES`, poses in `banditPose`, extents in `BANDIT_EXTENT`), AI in `js/ai.js` with
timings at the top (`CR_*` or per-type prefixes, like `THIEF_*`), roster entries in `data/enemies.json`
`bandit_bastion.stage4_minions`, and their weights per section in map_castle.js `CS_MIX` (plus `CS_CAP` caps). Each
telegraph is drawn exactly as wide as its hit (the stage 2-3 rule). Add new effect types' drawing to the bandit draw
hooks (bandits.js `drawBanditGround` / overlay), not to main.js. Check how the existing enemies are dispatched in
ai.js and enemysprites.js (`BANDIT_TYPES`) before adding types.

- **Crossbowman** (`crossbow`): kneels and shows a bolt lane that locks before the shot; a heavy, piercing bolt; a long
  reload. Bailey and keep. Reuse the lane telegraph pattern (`lance_lane`, `val_lane`).
- **Halberdier** (`halberd`): armoured and slow; alternates a wide sweep (wedge telegraph, like the shieldbearer's bash
  wedge) and a thrust (lane); holds at pole's length. Bailey and keep.
- **Firepot grenadier** (`grenadier`): lobs a firepot at the hero's spot with a landing marker (like the slinger's
  `sling_stone`), leaving `ground_fire` (bandits.js `igniteGround`; it also lights nearby kegs). Bailey only.
- **Cutpurse** (`cutpurse`): the King of Thieves' signature minion. Dashes in; a hit steals a capped amount of gold
  (floating text, a jingling pouch on its back), then it flees for a door (`cst.spawns` points of the open section).
  Killed: it drops the stolen gold ×1.5. Escapes: the gold is lost. Keep only. Careful: never let the stolen gold
  vanish by accident (a wave change, a map change, a stage event). Cap it so a bad wave can't empty the purse before a
  shop.

Then update `CS_MIX` (bailey: shield, archer, slinger, hound, bannerman, thief + crossbow, halberd, grenadier;
keep: thief, shield, archer, bannerman + crossbow, halberd, cutpurse) and BALANCE.md's enemy table.

## Step 4: wave 16, the Royal Guard

- After `throne_doors` (wave 15 cleared), set `cst.seated = true` and draw Valerius seated on the throne
  (`CS_SEAT`, facing west) from map_castle.js with the bandit sprite pipeline:
  `stampBandit(null, x, y, face, scale, pose, 0, 1, 0, 'boss_valerius')` with a pose
  `{ t, walk: 0, move: 0, trail: { x: 0, y: 0 }, helmless: true, seated: true }`. Add a `p.seated` pose to
  `drawValeriusBody` (bandits.js). He is **not** an enemy on wave 16: untouchable, not in the wave count. The death
  taunt already reads `cst.seated` (dialogue.js `valeriusTaunt`, the `throne` lines).
- Replace the Victory stand-in in `updateCastle` with a trigger (the hero crossing into the nave on wave 16, like the
  bridge's `BR_TRIGGER`) that starts `throne_audience`: camera to the throne, a dialogue (`valerius_bare`), a finger
  snap, the three champions step out of the alcoves (`CS_ALCOVES` at x 5150 and 5670, both walls), then a boss card
  "The Royal Guard" (`showBossCard`).
- **Champions** (stats in a new `stage4_champions` array in enemies.json; type `boss_champ_*` so boss rules apply;
  set `e.champion = true` and `cst.guardMax` to their summed max HP: hud.js already shows one "The Royal Guard" bar
  for all living champions). Their AI in ai.js with a shared skeleton:
  - **Gorran, the Iron Warden** (halberd and tower shield): Halberd Sweep (wide wedge), Shield Charge (lane, knockback),
    Bulwark (frontal block, hits from the front reduced).
  - **Sable, the Royal Blade** (twin daggers): Shadow Step behind the hero (an exit ring telegraph), Fan of Knives (a
    cone), Smoke Bomb (vanishes and reappears).
  - **Corvin, the Crossbow Captain**: Piercing Bolt (a long locked lane), Bolt Rain (landing marks like the bridge's
    `brgVolley`), Firepot; backpedals to keep his distance.
  - When one falls, the survivors rally (faster, shorter gaps).
- Valerius barks from the throne: a new non-pausing speech-bubble effect (`bark(x, y, text)`) for the opening, each
  champion's death, and when the hero takes a big hit. Full dialogues pause the game; barks must not.
- When the last champion dies, `onWaveCleared` (stage.js) on wave 16 starts `valerius_rises` (step 5) instead of the
  boss-exit flow. Make sure the generic boss-wave branch in `onWaveCleared` doesn't open an exit there.

## Step 5: wave 17, Valerius, King of Thieves

- **`valerius_rises`:** he stands, an angry dialogue line, pulls his spear from behind the throne; then
  `pushBoss(activeDungeon.stage4_boss, 17, ...)` (add `stage4_boss` to enemies.json: `type: "boss_valerius"`, its own
  HP and damage), set `e.king = true` (sprite helmless, boss bar "Valerius, King of Thieves", taunts use the `king`
  set), `cst.seated = false`, boss card "Valerius, King of Thieves", and `startNextWave()` at once (no breather), the
  way `trailGuardCheck` starts wave 10.
- **ValeriusAI with `e.king`** (ai.js; add king versions of `VAL_GAP` / `VAL_DODGE_CD`):
  - Phase 1 (100-65%): the bridge's phase 1 and 2 moves (arc, lunge, hook, lasso, toss, plus vault and v_step),
    tighter gaps.
  - Phase 2 (65-30%): the bridge's phase 3 moves (cyclone, skewer leap, double hook) plus hazards, taking over the
    archers' role:
    - **Chandelier Drop:** his spear toss severs a chandelier's chain (`CS_CHAND`, drawn in `drawCastleAbove` by
      `drawChandelier`); a circle telegraph under it, then a crash for damage and `ground_fire`. Each falls once; draw
      the fallen ones on the floor and stop drawing them above; `drawCastleDark` lights them, so remove their light too.
    - **Brazier Kick:** he kicks a brazier down a lane, leaving a strip of fire.
  - The bridge's archers are tied to the bridge (`brg`, guarded by `typeof brg`); make sure nothing bridge-only fires
    in the castle (`valeriusLastStand` already checks `currentMap.type === 'bridge'`).
  - Phase 3 (<30%), **Unchained:** a short beat (he snaps the chain, hurls the spear into a pillar, draws two stolen
    blades: `p.blades` in `drawValeriusBody`), the room dims as the chandeliers are gone. New moves: **Twin Flurry**
    (3 dashing slashes, each with a short lane), **Cross Cut** (an X of two lanes), **Cutthroat Step** (vanishes in
    afterimages, reappears behind the hero with a ring telegraph), **Blade Storm** (a short spinning ring). Faster,
    more dodges, afterimages always on (`e.ghosting`).
- **Death:** combat.js `checkEnemyDeath` already sends his castle death to `valeriusFall(e)`. Make it a
  `valerius_fall` event: he kneels, his last words (`valerius_bare`), he collapses; his remaining effects, shots and
  minions are cleared (like map_hive.js `queenDefeated`); his crown drops; walking onto it shows Victory (a castle
  version of map_hive.js `startTrophyClaim` / `updateTrophyClaim`, hooked in stage.js `updateStage` the way the hive's
  is).
- Update menu.js only if the boss list changes (it already says "Valerius, King of Thieves").

## Where things live (built in steps 1-2)

- `js/map_castle.js`: layout constants (`CS`, `CS_HALF`, `CS_TOWERS`, `CS_BUILD`, `CS_TABLES`, `CS_ALCOVES`, `CS_PROPS`,
  `CS_KEGS`, `CS_TRAIL`, `CS_DAIS`, `CS_THRONE`, `CS_SEAT`, `CS_CHAND`, `CS_BANNERS`), state `cst`, `buildCastle` /
  `resetCastle` / `castleEnter`, generation (`csFloor`, `csGenerate`, `csSpawns`, `csTorches`), the cached paint
  (`csPaint` and its painters), spawns (`CS_MIX`, `CS_CAP`, `castleMinions`, `castleRoom`, `castleSpawnPoint`,
  `castleOnSpawn`), `updateCastle`, `castleWaveCleared`, the scenes (`keep_breach`, `throne_doors`), and drawing
  (`drawCastleGround`, `drawCastleDark`, `drawCastleAbove`, doors, portcullis, powder cart, chandeliers).
- Hooks elsewhere: stage.js (`mapTypeForWave`, `setStageMap`, `pickSpawnPoint`, `onEnemySpawned`, `onWaveCleared`,
  `updateStageEvent`, `updateStage`, the vignette), main.js (`startNextWave`'s castle block, the roster index
  `wave > 11 ? 4`, `castleMinions`, the hound pack cap, the ground and above draw calls, the fallen-hero draw),
  combat.js (`playerDied`, `showDeathScreen`, `valeriusFall`), dialogue.js (`VALERIUS_TAUNTS`, `valeriusTaunt`),
  bandits.js (`valBareHead`, `p.helmless`, the castle arrow and stone streaks), portraits.js (`valerius_bare`,
  `valeriusBareFace`), hud.js (King of Thieves name, the Royal Guard group bar), map_bridge.js (`bridge_gate`,
  `drawBridgePortcullis`, its `cleared` screen), index.html (the script tag), data/enemies.json (`stage4_minions`).

## Lessons from steps 1-2

- **CRLF:** the Write tool creates LF files. Convert every new file to CRLF and check the bytes with Python
  (`d.count(b'\r\n')` vs `d.count(b'\n')`); `grep -c $'\r$'` in Git Bash can't tell the difference. Edit keeps CRLF.
- **XP inside a cutscene** opens a level-up card over the scene. Grant XP after the scene ends (the bridge gate does
  this).
- **Valerius dodges for real** (`valDodge`), so a scripted `applyDamage` can miss; tests should call
  `valeriusLastStand` or set HP directly.
- **The dark layer is drawn under the fighters**, so the night never darkens enemies; readability problems are about
  contrast with the ground, fixed with halos and pools rather than by lightening the sprites.
- **Unknown effect types draw nothing** in main.js's effect chain, so scene-only effects (`castle_door`) can be drawn
  by the map file without registering anywhere.
- Blocking `stageEvent`s pause `waveBreak`, so a door scene after a wave clear doesn't eat the breather.
- `openDialogue` sets PLAYING before `onClose`; that's harmless for the death taunt because `update` is skipped while
  `player.hp <= 0`.

## Testing without the user

There's no test suite. Serve the folder and drive headless Chrome over the DevTools protocol (Node 24 has `fetch` and
`WebSocket` built in; no Playwright here):

1. `python -m http.server 8000` in the repo (run in the background).
2. `"/c/Program Files/Google/Chrome/Application/chrome.exe" --headless=new --remote-debugging-port=9222 --window-size=1600,900 --user-data-dir=<scratchpad>/chrome --no-first-run --mute-audio about:blank` (background).
3. A small driver (`cdp.mjs`, kept in the scratchpad) that reads a JSON list of steps
   (`{nav}`, `{wait}`, `{eval}`, `{shot}`), connects to the page from `http://127.0.0.1:9222/json`, runs
   `Runtime.evaluate` / `Page.captureScreenshot`, and prints page exceptions. Wrap evals in
   `(() => { ... })()`: top-level `const` collides between evals.
4. Useful evals: `selectDungeon('bandit_bastion'); chooseClass('dragonknight')`, then a keydown `'1'` for the
   starting skill; `el('dev-wave-input').value = 14; devJumpWave()`; clear blocking cards with
   `player.skillPoints = 0`, hide `levelup-screen` / `upgrade-screen` / `intermission-screen`,
   `gameState = STATE.PLAYING; lastTime = performance.now()`; god mode by hand (`player.maxHp = player.hp = 99999`);
   stop spawns with `enemySpawnTimer = 1e9`; start scenes directly (`castleWaveCleared()` on wave 13 or 15).
   Read every screenshot. Stop Chrome and the server afterwards.

The user also plays the Training Room (`training.js`) to try things; point them there for a new enemy's or champion's
telegraphs.
