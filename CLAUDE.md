# CLAUDE.md

A top-down wave-survival ARPG in vanilla JavaScript and Canvas 2D. Nine classes: Dragonknight, Spellweaver, Ranger, Nightblade, Machinist, Swordsaint, Cleric, Druid, Paladin. There are no dependencies, no build step and no test suite.

## Running

- Run `PlayGame.bat`, which serves the folder with `python -m http.server 8000` and opens `http://localhost:8000`.
- The game `fetch`es `data/*.json`, so it must be served over HTTP; opening `index.html` as a file won't work.
- The dev menu can turn off cooldowns (`devNoCooldowns`).

## Code layout

Styles for the in-game UI are in `ui.css` (dark-fantasy panels, HUD, screens); the start menu's styles are inline in `index.html`. Every script is a plain global script loaded by `<script>` tags in `index.html`. There are no modules: functions and state are shared through globals. Load order only matters for code that runs at load time. Cross-file calls happen at runtime, so they're fine in any order. **A new file needs its own `<script>` tag** before `main.js`.

| File | Role |
|---|---|
| `globals.js` | Shared state: `player`, `buffs`, `enemies`, `projectiles`, `effects`, `drops`, `equipment`, `STATE`, `gameState`. |
| `utils.js` | Map bounds, vectors, `distToSegment`, `getNearestEnemyFromPoint`, game-time timers `after(delay, fn)` / `every(interval, repeats, fn)`. |
| `skills.js` | `SkillRegistry[className][slot]` for every class except the Paladin; `BasicAttackRegistry[weaponType]`; `castBasic`; `spawnTurret`. |
| `paladin.js` | All Paladin logic and its own draw pass (hammer, dome, fault lines). |
| `combat.js` | `applyDamage` (damage multipliers, weak points, hit FX), `takeDamage`, `calcDmg` / `calcUtility` / `getCDR`, enemy death. |
| `ai.js` | Enemy and boss behavior. |
| `ui.js` | Level-up and evolution cards (`triggerLevelUp`), wave-cleared / victory screens (`showWaveCleared`, `showVictory`), paper-doll inventory, shop (it returns to wherever it was opened from: the wave-cleared screen, or the fight when the dev console opened it), item tooltips and comparison, screen hotkeys, dev console. |
| `hud.js` | HUD: health orb and class gauge orb (`GAUGES[className]`: Flow, Zeal, Frenzy, Momentum...; painted by `drawHudOrbs` once per frame from `draw()`), skill bar, XP strip, buff chips, wave plaque, boss bar, wave banner (`showWaveBanner`), the hold-Tab character sheet (`renderTabSheet`) and fading HUD pieces that have something behind them (`updateHudCover`). `updateHUD()` lives here. |
| `icons.js` | Skill icons (`SKILL_GLYPHS[classId][slot]`, `skillIcon`) and item icons (`itemIcon`), drawn in code and cached as data URLs. |
| `portraits.js` | Class-select portraits: front-facing, waist-up action poses (`PORTRAITS[classId]` with `bg` / `draw` / `fx`), a deliberate exception to the top-down rule. |
| `stage.js` | Stage maps bigger than the screen (`STAGE_MAPS`, each with its start, exit and prompt; `randomOpenSpot` finds walkable ground), the camera (`camera`, `updateCamera`), solid obstacles and the cave terrain grid (`terrainAt`, `pushOutOfObstacles`, `shotHitsWall`, `clipToWalls`), enemy pathing (`updateNav` flow field, `navSteer`), spawn points, stage flow (`onWaveCleared`, `openStageExit`) and scripted events (`stageEvent`: boss intros, cave exit). |
| `map_clearing.js` | Slime Caves stage 1 art: cached ground and canopy layers of the forest clearing, plus live touches (cave glow, drips, fireflies). |
| `map_cavern.js` | Slime Caves stage 2, the Sunken Grotto: generates the terrain grid from hand-placed shapes plus noise (`buildCavern`), paints the cached ground, and draws lakes, darkness and lights live. Also wading, wall rams and stalactites (`updateCavern`, `wallImpact`), the Amalgam forming from the lakes (`startAmalgamIntro`) and the sealed wall breaking (`startSealBreak`). Also owns the shared half-resolution lighting layer (`drawDarkLayer`). |
| `map_hive.js` | Slime Caves stage 3, the Hive Queen's throne hall: generation and painting (`buildHive`), the royal jelly pool, brood pods (`makePod`, `openPod`, `hiveSpawnPoint`), the Queen asleep on her throne and waking at wave 15 (`startQueenWake`), her leap back to the throne for the death-throes bullet hell (`startQueenThroes`; the pattern itself is in `ai.js`), and the ending: her brood dies with her, her crown drops, claiming it shows Victory (`queenDefeated`, `startTrophyClaim`). |
| `enemysprites.js` | Enemy sprites (every Slime Caves slime, the Slime King, the Amalgam, the Hive Queen and her guards, brood pods), enemy projectiles, splat/shockwave/puddle/stalactite decals. Slime bodies are baked once per colour and size into 16 wobble frames (`slimeBody`) and stretched with a transform each frame; draw only the live details on top. Hooks: `drawEnemySprite`, `drawEnemyProjectile`, `drawEnemyGround` (chains into `drawCaveGround`), `drawEnemyOverlay` (above everything: the Queen's lightning), `enemyDeathFx`. |
| `menu.js` | Start menu: the parchment dungeon map (`MAP_SITES`, drawn in code and cached per resize) and the class carousel. Flow: map → `selectDungeon` → carousel → `chooseClass` → `startGame`. |
| `main.js` | Init and data loading, input, `update(dt)`, and `draw()` (world, then effects, enemies, projectiles, player, particles, overlay). |
| `sprites.js` | Hero sprites drawn in code (`CLASS_SPRITES`, the Druid wolf `sprWolf`), `stampSprite`, `playerPose`. |
| `weapons.js` | Weapon models and basic-attack animations (`WEAPON_DRAW`), swing trails, rare-weapon glow and runes, player projectile drawing. |
| `fx.js` | Particle system (`spawnParticle`, `burst`), screen shake (`addShake`), hit sparks (`spawnHitFx`), shared `fxTime` clock. |
| `skillfx.js` | Q visuals, plus the draw hooks that every other skill-visual file plugs into. |
| `skillfx_e.js` | E visuals, shields, enemy status overlays (frozen, shocked, rooted, stunned). |
| `skillfx_space.js` | Space visuals and the **dash/leap travel system** (`startDash`, `player.dash`, `player.z` lift, afterimages). |
| `skillfx_ult.js` | R visuals (dragon head, meteor, arrow rain, wings, …) and the overlay layer drawn above everything. |
| `skillfx_rmb.js` | Rare-weapon right-click abilities and the World-Breaker rune lines. |

Data lives in `data/`. In `classes.json`, each class has:
- `skills` 1 to 4 (Q, E, Space, R), each with `upgA` / `upgB`, the evolutions chosen at rank 4;
- `weapon`, the basic-attack type;
- `rareWeapon`, whose `rmbSkill` is the right-click ability (handler `SkillRegistry[class].rmb`).

`enemies.json` and `items.json` hold enemies, dungeons and loot.

## How things work

- **Skill slots:** 1 = Q, 2 = E, 3 = Space, 4 = R, `rmb` = rare-weapon ability. A class can define `canCast(slot)` to refuse a cast without spending the cooldown; the Paladin uses this.
- **Effects:** plain objects pushed to `effects` with `life` / `maxLife`, which `update()` counts down. Gameplay that ticks over time lives in `update()`, matched by `type`. Visuals are drawn by type.
- **Game time vs. real time:** `update(dt)` drives everything that should pause with the game: `fxTime`, particles, timers, effect lives. Animate with `fxTime` or an effect's elapsed time (`maxLife - life`), not `performance.now()`. The exception is idle sprite animation.
- **Draw hooks:** each returns `true` when it handled the object, so legacy drawing is skipped.
  - `drawPlayerProjectile` → `drawSkillProjectile`
  - `drawSkillGround` (under enemies)
  - `drawSkillEffect` (effect layer)
  - `drawUltOverlay` (above everything)
  - Each hook in `skillfx.js` chains into the E, Space, R and weapon-ability files. Add new visuals there instead of growing `main.js`.
- **One-shot bursts inside a draw function:** guard them with an `ef.burstDone` flag.
- **Sprite frame:** characters and weapons are drawn in a local frame where **+x is the facing direction** and +y is the character's right side.
- **Camera and world coordinates:** maps in `STAGE_MAPS` (the three Slime Caves stages: the clearing, waves 1-5; the cavern, 6-10; the hive, 11-15) are bigger than the screen and scroll; every other map is still exactly the window with the camera at 0,0. `draw()` translates by the camera, so anything drawn in screen space (overlays, vignettes) must come after the world's `ctx.restore()`. `mouseX` / `mouseY` are **world** coordinates (screen mouse + camera); use them for aiming as before.
- **Obstacles:** `clampToBounds` also pushes things out of the map's solid obstacles, so every movement path respects them. Anything with `airborne = true` (or the player with `player.z > 4`) passes over.
- **Cave terrain:** on maps with a `grid` (`currentMap.grid`), each 25 px cell is floor, wall, lake, ravine or seal.
  - Walls and the seal block everything, including leaps.
  - Ravines block walking but not airborne things or shots.
  - Lakes can be walked through, but they slow and poison the player (`player.wading`; the Hazard Suit ignores this).
  - Shots that fly into rock end there (`shotHitsWall`); orbiting, returning and stationary ones are exempt.
  - `startDash` clips a dash at the first wall. A dash or charge that rams a wall, or the Amalgam's stampede into one, drops stalactites that hurt the player and enemies.
  - Brood pods (hive) are enemies of type `brood_pod` with `e.pod` set, so every attack can pop them. They never count toward the wave (`checkEnemyDeath` hands them to `podPopped`), the enemy loop skips them, and the HUD cover check ignores them.
  - Enemies walk straight at the player when the line is clear; otherwise they follow the flow field (`navSteer` in the enemy loop). Ranged AI aims along the real line and holds fire without a clear shot.
- **Stage events:** while a blocking `stageEvent` runs, `update()` only advances the scene, particles and effect lifetimes, and skill input is ignored. Events: `boss_intro` (Slime King leaves the cave), `amalgam_form`, `seal_break`, `queen_wake`, `queen_throes`, `trophy_claim`, `cave_exit` (the hero fades out with `player.fadeOut`, then the screen with `player.exitFade`). The camera follows `camera.tx/ty` while they're set; in the hive it also leans toward the Queen while she sits on her throne.
- **Stage endings:** after each stage boss, `onWaveCleared` opens the exit instead of showing the wave-cleared screen. Clearing: the cave lights up. Cavern: the seal breaks. Hive: the Queen's death never reaches `showVictory` directly; `queenDefeated` drops her crown, and `startTrophyClaim` shows Victory once you walk onto it.
- **Hive Queen fight (`ai.js`):**
  - Above 60% HP she lobs eggs (they hatch where they land) and spits pink balls.
  - Between 60% and 30% her guards shield her. Strikes on the hero's spot: 0.85 s warning, 2.3 s apart, a breather after a hit.
  - Below 30% she leaps (`state: 'leap'`) to land 220-350 px from the hero, about every 4 s.
  - At 0 HP: `death_throes`, a 14 s escalating bullet hell from the throne. More spiral arms, faster volleys, a counter-spiral, then rings.
- **Enemy flags:** `flyUntil` hides an enemy while it's still a `goo_arc` in the air (flung minions, eggs); `spawnT` / `spawnMax` is the bubble-up while it can't act; `dazed` (Amalgam minions) pauses its AI.
- **Projectiles:** `rampFrom` / `rampTo` (with `ox`, `oy`) make a shot speed up once it is that far from where it was fired; the Queen's bullet hell uses it so distance isn't safety.
- **Performance:**
  - Big static art is painted once into cached canvases (map ground, lake and pool surfaces, slime bodies).
  - Darkness is drawn at half resolution and lights only the first 40 projectiles.
  - HUD orbs repaint at 30 Hz.
  - Keep per-bullet drawing to flat fills (no gradients), since bullet hells put hundreds on screen.
- **Forced movement:** `player.dash` is timed travel with an optional jump arc; `player.grappleTarget` is speed-based pull/charge. Both bypass WASD movement in `update()`.

## Conventions

- Source files use **CRLF** line endings; keep them that way when editing.
- Match the surrounding style: terse lines, short comments that explain *why*, no external libraries.
- Art direction:
  - Read everything as a strict top-down view. For example, a jaw opens by foreshortening the upper jaw, never by splitting sideways into a V.
  - Hits should feel punchy but stay readable; keep screen shake subtle.
  - No floor-crack decals; the owner doesn't want them. Use glows, scorch marks, sigils or runes instead.
- Git: version branches up to `v1.6`; since v1.7 the work is committed to `master`. Commit messages like `v1.6.2 - The paladin added.`

## Known issues / TODO

- **Bandit Bastion** still uses the old plain arena and circle/square enemies; only the Slime Caves has real maps and sprites so far.
- **Balance patch pending:** the newer classes deal too much damage, so bosses (Slime King, Amalgam) die too fast. The Queen's bullet hell is fresh and needs a playtest.
- **Class gauges that don't work yet:**
  - Spellweaver: reads Power Surge, which only items grant; its passive (Arcane Resonance) is an on/off.
  - Druid: reads Pounce stacks, which only the Gnarled Heartwood Totem grants.
  - Paladin: the hammer states don't read right in play.
  - Fix them in the balance patch.

- **Ultimate unlock level (temporary):** the R skill is meant to unlock only after level 4 (from Lv.5). Normal level-ups already enforce this in `triggerLevelUp` (`ui.js`). However, the "Choose Starting Skill" pick passes a `customTitle`, and `!customTitle` skips the lock, so the ultimate can be picked at Lv.1. This is intentional for now because it makes testing easier. Remove the bypass before release.
- **Iron Bulwark damage reduction:** `takeDamage` checks `buffs.ironBulwark` for 50% damage reduction, but nothing ever sets it, so Iron Bulwark only grants its shield.
- **Ranger Volley:** recently reworked from a forward fan into an arrow rain on the cursor area. Its balance still needs a playtest.
