# CLAUDE.md

A top-down wave-survival ARPG in vanilla JavaScript and Canvas 2D. Nine classes: Dragonknight, Spellweaver, Ranger, Nightblade, Machinist, Swordsaint, Cleric, Druid, Paladin. There are no dependencies, no build step and no test suite.

## Running

- Run `PlayGame.bat`, which serves the folder with `python -m http.server 8000` and opens `http://localhost:8000`.
- The game `fetch`es `data/*.json`, so it must be served over HTTP; opening `index.html` as a file won't work.
- The dev menu can turn off cooldowns (`devNoCooldowns`).

## Code layout

Every script is a plain global script loaded by `<script>` tags in `index.html`. There are no modules: functions and state are shared through globals. Load order only matters for code that runs at load time. Cross-file calls happen at runtime, so they're fine in any order. **A new file needs its own `<script>` tag** before `main.js`.

| File | Role |
|---|---|
| `globals.js` | Shared state: `player`, `buffs`, `enemies`, `projectiles`, `effects`, `drops`, `equipment`, `STATE`, `gameState`. |
| `utils.js` | Map bounds, vectors, `distToSegment`, `getNearestEnemyFromPoint`, game-time timers `after(delay, fn)` / `every(interval, repeats, fn)`. |
| `skills.js` | `SkillRegistry[className][slot]` for every class except the Paladin; `BasicAttackRegistry[weaponType]`; `castBasic`; `spawnTurret`. |
| `paladin.js` | All Paladin logic and its own draw pass (hammer, dome, fault lines). |
| `combat.js` | `applyDamage` (damage multipliers, weak points, hit FX), `takeDamage`, `calcDmg` / `calcUtility` / `getCDR`, enemy death. |
| `ai.js` | Enemy and boss behavior. |
| `ui.js` | HUD, inventory, shop, level-up and evolution screens (`triggerLevelUp`), dev menu. |
| `main.js` | Init and data loading, input, `update(dt)`, and `draw()` (world, then effects, enemies, projectiles, player, particles, overlay). |
| `sprites.js` | Hero sprites drawn in code (`CLASS_SPRITES`, the Druid wolf `sprWolf`), `stampSprite`, `playerPose`, class-select previews. |
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
- **Forced movement:** `player.dash` is timed travel with an optional jump arc; `player.grappleTarget` is speed-based pull/charge. Both bypass WASD movement in `update()`.

## Conventions

- Source files use **CRLF** line endings; keep them that way when editing.
- Match the surrounding style: terse lines, short comments that explain *why*, no external libraries.
- Art direction:
  - Read everything as a strict top-down view. For example, a jaw opens by foreshortening the upper jaw, never by splitting sideways into a V.
  - Hits should feel punchy but stay readable; keep screen shake subtle.
  - No floor-crack decals; the owner doesn't want them. Use glows, scorch marks, sigils or runes instead.
- Git: version branches (currently `v1.6`), commit messages like `v1.6.2 - The paladin added.`

## Known issues / TODO

- **Ultimate unlock level (temporary):** the R skill is meant to unlock only after level 4 (from Lv.5). Normal level-ups already enforce this in `triggerLevelUp` (`ui.js`). However, the "Choose Starting Skill" pick passes a `customTitle`, and `!customTitle` skips the lock, so the ultimate can be picked at Lv.1. This is intentional for now because it makes testing easier. Remove the bypass before release.
- **Iron Bulwark damage reduction:** `takeDamage` checks `buffs.ironBulwark` for 50% damage reduction, but nothing ever sets it, so Iron Bulwark only grants its shield.
- **Ranger Volley:** recently reworked from a forward fan into an arrow rain on the cursor area. Its balance still needs a playtest.
