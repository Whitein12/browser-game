# The Campaign: save slots, a skill tree, gear upgrades and potions

Handoff doc for the campaign rework, like STAGE4.md. **Read the status first**, then the plan below it (the plan the user approved on 2026-10-13, unchanged).

## Status

| Step | What | State |
|---|---|---|
| 1 | The skill web replaces the level-up cards | Engine and screen done. **Dragonknight** done (playtested). **Ranger** done, awaiting playtest. **Nightblade, Machinist, Kensei, Cleric, Druid, Paladin** designed (CLASS_WEBS.md), to implement. **Spellweaver**: reworked into a spellbook class (20 spells, any key, one Greater) with 40 evolutions and 64 talents, built and awaiting playtest: **SPELLWEAVER.md** |
| 2 | Save slots, the hub (the start map as Cinderholt), dungeon retries | Not started |
| 3 | Gear bought and upgraded at a smith (no gear drops) | Not started |
| 4 | Potions: the flask (F) and elixirs (1 / 2) | Not started |
| 5 | Balance across the campaign (XP curve, the Bastion rebased for a Lv. 10 hero, bot runs) | Not started |

The user playtests each step before the next. Commit only when asked.

### Step 1, round 2: the constellation (what the user asked for)

The first version (five columns: ranks, an evolution fork, two side talents, a class column) was rejected: "an expansion of the current system instead of a real skill tree". The reference is Echoes of Mystralia's Lotus mind-node screen (`referencess/echoes-of-mystralia-lotus-mind-node.webp`): the hero in the middle, a coloured branch per ability that forks again and again, small modifier nodes, branches that meet.

The user's decisions for round 2: overlaps between branches are **shared passives** (the skill combos stay always on, not nodes); each ability gets a **deep** tree (12+ nodes, new mechanics); the general passives sit **inside every branch**; **one class first** (the Dragonknight), then the others.

What was built:
- `js/skilltree.js` (rewritten): the web's shape, adjacency rules, `applyTree`, and the constellation screen on a canvas (drag, zoom, the hero's portrait in the middle, an info panel, the evolution confirm in it).
- `js/talents.js` (new): `TALENT_WEBS` (the Dragonknight's 40 talents: 2 twigs and 8 nodes under the evolutions per skill), passives, icons and hooks. Per branch 19 nodes, 4 bridges: 80 nodes for the Dragonknight; a class without content has ~40 (generic twigs, no nodes under its evolutions).
- Kept from round 1: points banked and spent any time (K, pauses), the level-up banner and the HUD points badge, the first-skill opening, the Training Room's free web and its panel writing into the web, the stage-cleared screen's button.

Choices made (tell the user / revisit):
- **Two points a level** (`TREE_PTS_PER_LEVEL`), since the web is deep; it makes the Dragonknight stronger than before and stronger than the classes still on the shallow web. Balance comes in step 5.
- The XP curve is still the old one (Caves end around Lv. 13).
- Respec only in the Training Room until the hub exists (step 2).
- Node layout is shared by every class; per-class content only fills it.

**Design rule for evolutions** (the user, 2026-10-13): an evolution turns the ability into a new form with a new use, not the same skill with bigger numbers. Example: Dragon Breath's Glacial makes it crowd control (a heavy slow), Sundering makes it the setup for your next big attacks. Check every A/B pair against this before building the nodes under it.

The Dragonknight's 40 talents (ids as `hasTalent` sees them):
- Q Shield Throw: Long Arm `shield_far`, Heavy Rim `shield_stun`; **Molten Aegis** (a line of fire; was Explosive Impact): Slag, Searing Path, Flashpoint, cap Dragon's Wake; **Hunting Shield** (lodges in its prey, a full slam rips it out; was Aegis Catch): Serrated Edge, Marked Prey, Tear Free, cap Relentless Hunt.
- E Dragonfire Blade: Slow Burn, Kindling; Inferno Edge: Firestorm, Wildfire, Flame Wave, cap Scorched Earth; Wyrmblood: Ember Heart, Scaled Hide, Blood Frenzy, cap Undying Flame.
- Space Thunder Leap: Great Leap, Thunderclap; **Gravity Slam** (gathers the pack; was Aftershock): Event Horizon, Implosion, Crushing Weight, cap Singularity; **Meteor Dive** (hold to hang untouchable and steer, release to dive, bigger the longer; was Shrapnel Landing): Thin Air, Comet Trail, Impact Crater, cap Starfall.
- The user found the old Q and Space evolutions boring ("a simple +shield evo is boring for the main damage ability"; Space's both just hit harder) and picked these four from options on 2026-10-13. The E's pair stays: E is a buff skill, sustain vs area is enough there.
- R Dragon Breath: Deep Lungs, Long Breath; Glacial: Frostbite, Flash Freeze, Rime, cap Shatterfrost; Sundering Breath (was Shatter Breath, reworked after the first look: shields alone were too rare to build a path on): Deep Wounds, Brittle Scales, Wide Maw, cap Dragon's Roar.

### Step 1, round 3 (after the playtest of the web: "feels very nice")

- The stage-cleared screen lost its Inventory and Skill Tree buttons (I and K open them anywhere; a hint line says so and shows unspent points). Only the shop and the next wave remain.
- Big nodes cost more: evolutions 2 points, capstones 3, the rest 1, so saving up is a choice.
- Damage numbers over enemies (fx.js), merged per enemy so they stay light.
- Molten Aegis's trail redrawn ("looks really cheap"): one clean line per throw (a gradient glow, band and core, no additive blobs), the return trip only drawn where it strays, few embers.

### The Ranger's web (2026-10-13)

Audit: all four of the old evolution pairs failed the rule (numbers only). The user picked replacements from four options per skill:
- Q Storm Arrow: twigs Steady Hands, Broadhead; **Ballista Shot** (a full draw hurls the line back, wall slams stun): Siege Draw, Crushing Impact, Pinned, cap Domino; **Hunter's Mark** (the first enemy hit is the prey: basics curve to it, +40%): Long Hunt, Open Wound, Pack Hunter, cap Hunter's Harvest.
- E Nature's Stride: twigs Herbal Lore, Light Feet; **Windwalk** (enemy shots pass through you): Long Breeze, Slipstream, Return to Sender, cap Gale Burst; **Hunter's Focus** (Momentum held standing still, two arrows a basic): Deep Focus, Piercing Gaze, Steady Rhythm, cap Volley Stance.
- Space Vault: twigs Long Strides, Nimble; **Disengage** (flip away, the next basic is a 5-arrow spread): Bramble Snare, Fan of Arrows, Quick Escape, cap Hit and Run; **Twin Vault** (two charges, a kill refunds one): Third Wind, Wind Rider, Untouchable, cap Storm Hopper.
- R Volley: twigs Wide Spread, Barbed Tips; **Storm Rain** (a cloud raining for 4 s): Monsoon, Following Storm, Downpour, cap Thunderhead; **Focused Barrage** (every arrow on the enemy nearest the cursor, first 6 full): Quiver Dump, Pinning Shafts, Overflow, cap Final Shaft.
- The combos still work: Skyline Shot, Arrow Trail, Gale Volley and Thunderstorm (both act on Storm Rain's arrows over its whole duration).

### Next up (as of 2026-10-14)

1. The user playtests the Ranger.
2. Implement the six designed webs from **CLASS_WEBS.md**, in its order: Nightblade, Machinist, Paladin, Cleric, Druid, Kensei. Each class: classes.json evolutions, talents.js content, skill code, hooks, RANK_STATS, visuals, docs, a headless test in the Training Room, then the user's playtest.
3. The **Spellweaver** rework: identity and structure settled on 2026-10-14 (the wizard who knows the most spells: four playstyle schools, any spell on any key, one Greater spell, a loadout picked at creation and grown with scrolls). The design is in **SPELLWEAVER.md**. The spellbook and all its evolutions are built (js/spellweaver.js, js/spellweaver_evo.js) and await the user's playtest (with friends, after the user commits).
4. Then campaign steps 2-5 (saves and the hub, gear and the smith, potions, balance), as planned below.

**State of the repo:** everything from step 1 is uncommitted (last commit `5d4396a v1.10.3`). Commit only when the user asks.

**Testing tools:** the headless harness (`harness.mjs` + `scen_*.mjs`) of this session lived in the session's temp scratchpad (`C:\Users\balin\AppData\Local\Temp\claude\c--Roleplay-nistrax-browsergame-browser-game\a80f0b69-854a-477a-b456-867c84610625\scratchpad\`); copy `harness.mjs` from the bot folder (memory: bot-runs) if it's gone. Run `node harness.mjs <outDir> <scenario.mjs>`; wrap each evaluate step in an IIFE (top-level consts collide between calls). In the Training Room, `setSkill(slot, undefined, 'A'|'B')` sets an evolution; grant a path's nodes with `Object.assign(player.tree, ...)` then `applyTree()`.

---

## Context

Every dungeon starts a fresh Lv. 1 hero with no gear (`startGame` in [main.js:9](js/main.js#L9) resets level, gold, equipment). That suited a lore-free roguelike, but the game now tells one story: the novice clears the Slime Caves, comes home to a razed Cinderholt and follows Valerius's letter into the Bandit Bastion. The hero who walks into the Bastion should be the seasoned warrior who came out of the Caves.

Today's leveling is MOBA-style: each level-up pauses the fight with four cards (Q/E/Space/R), each skill has ranks 1-3 and an A/B evolution at rank 4, the R unlocks at Lv. 5, and a full run ends around Lv. 13 ([ui.js:269](js/ui.js#L269) `triggerLevelUp`, [combat.js:334](js/combat.js#L334) `gainXP`, XP ×1.5 per level).

**The user's decisions:**
- **RPG save slots:** named heroes of any class, saved on the start menu (continue, new, delete).
- **Death retries the whole dungeon:** the hero comes back exactly as they entered it.
- **A skill tree:** one branch per skill (learn, ranks, the A/B evolution fork) plus a class branch of passives and keystones. There are more nodes than points.
- **Points bank up:** they're spent on a tree screen that opens with a key and pauses the game. A level-up is a banner, not a card picker. Respec is free between dungeons.
- **No gear drops:** you buy gear and upgrade it with gold at a smith.
- **Potions:** a healing flask on a key, plus elixirs bought for the belt.
- **Merchant and smith after each stage** (the stage-cleared screen) and in a hub between dungeons (the start map, as Cinderholt).

This is a big change, so it's built in **five steps the user playtests one at a time**, the way the Bandit Bastion was. Each step leaves the game playable.

---

## Step 1: the skill tree (it replaces the level-up cards)

**New file `js/skilltree.js`** (with its own `<script>` tag before `main.js`): the tree definitions, `applyTree()`, spending, respec and the tree screen.

**Tree layout per class:** five columns.
- **Four skill branches (Q, E, Space, R).** Each runs Learn (rank 1) → Rank 2 → Rank 3 → **Evolution fork** (A or B, one only: rank 4). Two side nodes hang off Rank 2:
  - **Quickened:** −12% cooldown for that skill.
  - **Honed:** +15% damage for that skill. A skill without damage gets a class-specific side node in its place, decided in the per-class pass.
  - Gates: the R's Learn needs Lv. 5, as now. Evolutions need Lv. 6, so a first skill can't evolve on wave 3.
- **The class branch:**
  - Vitality I-III: +Max HP, scaled by `armorHpMult()` so fragile classes stay fragile.
  - Might I-III: +Power, as one "Talents" line in `powerParts()`.
  - Focus I-II: CDR, under `MAX_CDR`.
  - Fleetness: move speed.
  - A gauge node: faster gain of the class gauge.
  - At the bottom, **two keystones, pick one** (Lv. 15). These are new class effects, nine pairs to design. **They get designed per class with the user after the step 1 playtest**; until then the keystone row shows as sealed.
- **Totals:** about 35 nodes, against about 20 points by the end of the Bastion. Mastering all four skills takes 16 points, so every build gives up something.

**Wiring it in without touching the skill code:**
- `applyTree()` mutates `activeClass.skills[i]` in place:
  - `level` and `selectedUpg` come from the tree. Every skill already reads these (66 `.level` and 144 `selectedUpg` uses), so no skill code changes.
  - `baseDmg` is reset from `classDataConfig` × Honed.
- Passives feed the existing stat paths:
  - `recalcStats()` ([main.js:110](js/main.js#L110)) for Max HP and speed.
  - `powerParts()` ([combat.js:18](js/combat.js#L18)) for Power.
  - `getCDR()` ([combat.js:77](js/combat.js#L77)) for CDR.
  - `skillBaseCd()` ([combat.js:72](js/combat.js#L72)) for Quickened, per slot.
- The "Blessings" (`player.bonusDmg`, the all-mastered card) are retired; the class branch replaces them.

**Tree screen:**
- A new `#tree-screen` in `index.html`, styled in `ui.css` in the same dark-fantasy panel style.
- It opens with **K** and pauses the game like the inventory (`STATE.TREE`, Esc closes it).
- Node tooltips reuse `skillStats(slot, sk, from, to)` and `RANK_STATS` ([ui.js:198](js/ui.js#L198)), so they show real before → after numbers. Evolution nodes show `upgA` / `upgB` from `classes.json`.
- Taking an evolution asks for a confirmation (it's locked until a respec).

**Level-ups no longer pause the fight:**
- `gainXP` adds a point, shows a banner ("Level 7 · 1 point · K") and the XP strip pulses (`hud.js`).
- `triggerLevelUp`, `triggerEvolution`, `selectUpgrade`, `finishLevelUp`, `#levelup-screen` and `#upgrade-screen` go. So does the auto-open in `startNextWave` ([main.js:81](js/main.js#L81)).
- **First skill:** a new run opens the tree titled "Choose your first skill". Wave 1 starts once one skill is learned (this replaces "Choose Starting Skill").

**Elsewhere:**
- **Training Room** (`training.js`): the panel's rank buttons write into the tree. The room grants enough points for everything and respec is free there.
- **Tab sheet** (`renderTabSheet`, `hud.js`): it lists the talents taken.

**XP curve:** `XP_TABLE[level]` in `combat.js` replaces `maxXp × 1.5`. In step 1 it's tuned so a Caves run still ends around Lv. 10-11; step 5 retunes it.

## Step 2: save slots, the hub and dungeon retries

**New file `js/save.js`:** `localStorage` key `ep_saves_v1` with 3 slots, every access in try/catch.
- **A hero holds:** `name`, `classId`, `companion`, `level`, `xp`, `tree`, `equipment`, `inventory`, `gold`, `flask`, `belt`, `cleared` (dungeon ids), `entry` (the snapshot from entering the current dungeon), `resume` (`{ dungeon, wave }` at the last stage start), and play time.
- `heroSnapshot()` / `loadHero(slot)` / `saveHero()`. A loaded hero sets `selectedClassId`, rebuilds `activeClass` from `classDataConfig` and calls `applyTree()` and `recalcStats()`.

**Start menu flow** (`menu.js`, `index.html`):
1. The title leads to the **hero slots** screen: Continue, New Hero or Delete (with a confirm) per slot. Each slot shows the class portrait, name, level and dungeons cleared.
2. **New Hero** opens the class carousel (the Druid's companion screen comes next, as now), then a name field, then the hub.
3. **The hub is the parchment map** with a hero panel: portrait, level, gold, and buttons for Skill Tree (free respec here), Inventory, Merchant, Smith and Apothecary (the last two arrive in steps 3 and 4). Clicking a dungeon enters it directly; there's no carousel any more.
4. **Bandit Bastion is locked** for a hero until they've cleared the Slime Caves (the story order).
   - When the slot screen creates a hero after any hero has cleared the Caves, it offers a **seasoned start** (Lv. 10, the points to spend, starter gold) for players who don't want to replay the Caves.
   - The dev console gets set level, add gold and unlock dungeons, for testing.

**`startGame` split:** `enterDungeon(dungeonId)` takes the loaded hero instead of resetting level, gold and gear. Run-local state still resets per dungeon: power orbs (`orbDmg`), the gauges, Scrap, buffs.

**Save points:**
- **Entering a dungeon** saves `entry`, the retry point.
- **A stage exit** (the stage-cleared screen, [stage.js:403](js/stage.js#L403)) saves `resume`. "Save & Quit" there returns to the slots, and Continue resumes at that stage's start. This reuses the dev console's wave-jump path (`trailEnter`, `castleEnter`, `setStageMap`).
- **Death** (`showDeathScreen`, [combat.js:332](js/combat.js#L332)) offers two buttons:
  - **Retry the dungeon:** restores `entry` and restarts at wave 1.
  - **Return to Cinderholt:** restores `entry` and goes to the hub.

  A resume never protects you from death, which always goes back to the dungeon's entry.
- **Victory** (`showVictory`, [ui.js:374](js/ui.js#L374)): marks the dungeon cleared, saves, and offers "Return to Cinderholt" or Limitless mode. Limitless keeps the XP and gold it earns, saved when it ends.
- **Training Room:** from the hub it uses a copy of the hero as a sandbox and never saves.

**Menu labels** (`MAP_SITES`): Slime Caves Lv. 1-10, Bandit Bastion Lv. 10-20.

## Step 3: gear bought and upgraded at the smith

**No gear drops:**
- `dropChances.item` goes to 0 in `items.json`.
- The boss item drop goes ([combat.js:376](js/combat.js#L376)); bosses drop a bigger purse instead.
- `generateItem`'s random tiers are retired.

**Item model:** `{ id, base, type, rarity, up, val, desc, price }` with an upgrade level `up`. `itemVal(item)` and `itemDesc(item)` compute the stat from the slot's base plus `up` × step (per slot, per rarity).
- **Commons:** one plain piece per slot, cheap, with a modest stat that grows per `+1`.
- **Class rares:** they start stronger, keep their effects and grow faster. The rare weapon's **awakening is retired**: its +50 → +90 Power range becomes its upgrade path, the same for every item.
- **Cap by story progress:** `+5` until the Caves are cleared, `+10` after. Future dungeons raise it, so gear can't outrun the content.
- Upgrade cost grows per level. Selling refunds 50% of what was spent (`SELL_RATE` was 0.2 only to stop players selling every drop).

**Merchant:** `generateShop` ([ui.js:155](js/ui.js#L155)) becomes a fixed catalogue: the five commons, the class rares and (step 4) potions. It no longer rerolls.

**Smith screen** (`#smith-screen`): the equipped items and the backpack. Clicking one shows its stat now → after, and the cost.

**Where:**
- The stage-cleared screen (`showWaveCleared`) gets Merchant, Smith and (step 4) Apothecary buttons. Every stage exit is already a boss screen.
- The hub has the same buttons.
- `openShop` / `closeShop` generalize the existing `shopFromFight` return into "return to wherever it opened" (fight, stage-cleared or hub).

**UI:** item cells and tooltips show `+N` (`itemCell`, `itemTooltip`).

## Step 4: potions (flask and elixirs)

**Healing flask on F:**
- It heals 40% of Max HP over 1.5 s (not instant, so dodging still matters), with a short lockout between drinks.
- It starts with 3 charges and refills each wave. Kills can drop a flask charge (it takes half of today's HP-orb share).
- The Apothecary upgrades charges (3 → 5) and potency.
- The 30% heal at each wave start is reviewed in step 5, since the flask now covers sustain.

**Elixirs on keys 1 and 2** (the belt): bought in stacks of up to 3 and used up.
- **Might:** +30 Power for 20 s, in `powerParts`.
- **Swiftness:** move speed and attack speed for 20 s.
- **Iron Skin:** −35% damage taken for 12 s, in `takeDamage`.

The effects live in `buffs` and show as buff chips. In the Training Room, keys 1 and 2 stay as the dummy keys.

**Code:**
- Logic goes in a new `js/potions.js`: `drinkFlask`, `useElixir`, ticking from `update()`.
- `hud.js`: the flask (charges and refill fill) and the belt sit next to the health orb.
- The drink visual is a green swirl via `spawnParticle`.

## Step 5: balance across the campaign

- **XP:**
  - `XP_TABLE` is set so the Caves end around Lv. 10 and the Bastion around Lv. 20.
  - Bandit XP (`baseXp`, `xpScale` in `enemies.json`) is raised to fit.
- **Bastion enemies:** HP and damage are rebased for a Lv. 10 hero arriving with Caves gear (about +5 items, 10 points spent, a flask), with the trail's and castle's waves scaled to match.
- **Slime Caves:** retuned for the new XP curve, no drops and gold income against smith costs.
- **The bot** (memory: bot-runs) learns to spend tree points, buy and upgrade at the stage-cleared screens and drink the flask. Then it runs the Caves and the Bastion back to back per class.
- **Logging:** the numbers go to BALANCE.md, following the balance workflow (model the DPS first, recommended option first).

## Docs

- **CLAUDE.md:**
  - New rows for `skilltree.js`, `save.js` and `potions.js`.
  - Rewrite the `ui.js` row: level-up cards are gone; `RANK_STATS` stays and now feeds the tree's tooltips.
  - Add "How things work" entries for the tree, saves and the economy.
  - Replace the "Ultimate unlock level" note.
- **New memory:** campaign/progression status.

## Not in this plan (story follow-ups the user hinted at)

- Slime Caves clues that the slimes only defend themselves: they swarm but don't attack until hit.
- The Queen's victory feeling empty.
- A return-to-Cinderholt scene before the Bastion (via `dialogue.js`).

These fit well once the campaign flow exists. They're worth their own plan.

## Critical files

- **New:** `js/skilltree.js`, `js/save.js`, `js/potions.js`.
- **Changed:** `index.html` (screens, script tags), `ui.css`, `js/main.js` (`startGame` → `enterDungeon`, `startNextWave`, `recalcStats`, keys K / F / 1 / 2), `js/ui.js` (level-up removal, shop/smith, death/victory, stage-cleared buttons), `js/combat.js` (`gainXP`, `XP_TABLE`, `powerParts`, `getCDR`, `skillBaseCd`, drops, `takeDamage`), `js/hud.js` (XP strip, flask/belt, Tab sheet), `js/menu.js` (slots, hub, locks), `js/items.js` (awakening → upgrades), `js/training.js`, `data/items.json`, `data/enemies.json`.
- Keep CRLF: check with `git ls-files --eol`; never `sed -i`.

## Verification (per step, in the real game via `PlayGame.bat`)

1. **Tree:**
   - A new run opens the tree for the first skill.
   - Level-ups show a banner and don't pause.
   - K opens the tree mid-fight and pauses it.
   - Ranks, evolutions and side nodes change the numbers shown on the Tab sheet and the skill cards.
   - In the Training Room, the DPS meter confirms Honed / Might, and the cooldown display confirms Quickened.
   - The R stays locked before Lv. 5.
2. **Saves:**
   - Create a hero, clear stage 1, Save & Quit, reload the page, Continue: you resume at stage 2.
   - Die: Retry restores the entry level, gold and gear.
   - Clear the Caves: the Bastion unlocks in the hub with the same hero.
   - Deleting a slot works.
   - Private window / blocked storage: the game still runs (no saves).
3. **Gear:**
   - No item drops.
   - Buy, upgrade and sell from the stage-cleared screen and the hub.
   - Upgrade caps hold.
   - The rare weapon's `+N` replaces the awakening.
4. **Potions:**
   - F heals over time and the charges refill per wave.
   - Elixirs show as buff chips and their effects show on the Tab sheet / in the damage taken.
5. **Balance:** bot runs of Caves → Bastion for all 9 classes, with the results logged in BALANCE.md. Then the user playtests.

Commit only when the user asks (`v1.11.x - …`).
