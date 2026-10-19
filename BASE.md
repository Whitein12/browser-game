# The Base: Cinderholt reborn

Handoff doc for the base update, like CAMPAIGN.md and STAGE4.md. **Read the status first**, then the decisions. Nothing is built yet: this is the plan, to be refined with the user before step 1.

## Status

| Step | What | State |
|---|---|---|
| 0 | Design (this doc), the gold numbers from a bot run | **Started 2026-10-15** |
| 1 | A walkable Cinderholt as the hub after the Bastion: arrival scene, the noticeboard / gate, back and forth to the dungeons | **Done 2026-10-17, awaiting playtest** (see "The return and the rebuild" below). The map (2026-10-16, js/map_base.js): the village by day, fires out, the barricade gone and the gate open. Since 2026-10-17 a hero who has cleared the Bastion lives there: the merchant's welcome (once), saving, the noticeboard at the gate for the dungeons |
| 2 | The first NPC (the smith): dialogue into the existing Smith screen, his portrait | Not started |
| 3 | The apothecary and the merchant; the hub's services get better than the dungeon's (the merchant, apothecary and smith are all there from the first arrival) | Not started |
| 4 | Materials (wood, iron, ...) and renovating the houses | **Built 2026-10-17, awaiting playtest:** wood / iron / stone from 21 caches in the two dungeons (js/caches.js), the four buildings of base2.md rebuilt for gold + materials (js/rebuild.js). Numbers are a first proposal |
| 5 | Sidequests (the bandit hiding in the ruins with a stash, ...) | **Built 2026-10-17, awaiting playtest:** the talk menu and eight quests (see "Sidequests" below) |
| 6 | The tavern: the other classes as visiting NPCs | Not started |
| 7 | The garden: vegetables, herbs and flowers for potions | Not started |
| 8 | The trophy room | Not started |
| later | Walking into the houses (an interior popup or small map) | **Started 2026-10-17** (js/interiors.js, small room maps): the town hall in the longhall above the well (the tavern, the rooms upstairs, the trophy room in the attic), the apothecary's house (the one with the north garden), the merchant's shop (the house by the pen), and the smith's smithy, whose door opens once his house is rebuilt (since 2026-10-17 every door waits on its building's rebuild). E at a door, at stairs or by a friend (E is the skill when nothing is in reach). Talking to a friend opens their dialogue, then their screen |

The user playtests each step before the next. Commit only when asked.

## The return and the rebuild (built 2026-10-17, from base2.md)

**The user's decisions (2026-10-17):** the services are **closed until their building is rebuilt** (the dungeon's stage-cleared stops stay as the emergency shops); the hero speaks in dialogues with their class portrait on the right; **gold covers a material shortfall**; caches give their materials **once per hero**; caches are **breakable** (any hit, like a powder keg); the four buildings in **any order**. The merchant stays "The Merchant" until the user names him; the arrival lines are a draft from base2.md (npcs.js `ARRIVAL_LINES`).

- **The flow** (save.js): `baseOpen()` is a saved hero whose `cleared` holds the Bastion. `pickHero` sends them straight into Cinderholt (`selectDungeon('cinderholt')`) instead of the map; the victory screen reads "Return to Cinderholt", death "Back to Cinderholt". The village saves on arrival and whenever a screen closes back into it (`baseSave`); respec is free there. `heroData.base = { seen, built }` sits outside `heroSnapshot`, so a dungeon Retry never undoes a rebuild.
- **The noticeboard** at the gate (`BASE_BOARD`): E opens the parchment map over the paused village (`openBoard` / `closeBoard`); picking a dungeon saves and reloads into it (`heroToDungeon`, the Retry path), so the game never starts twice in one page.
- **The arrival** (once, `heroBase().seen.arrival`): the merchant meets the hero at the gate, tells of the raid, the hero vows to rebuild (dialogue.js lines `{ who: 'hero', text }`).
- **Rebuilding** (rebuild.js `BUILDINGS`): the smith's forge (destroyed; 400 gold, 30 wood, 25 iron, 30 stone), the apothecary's (damaged; 250 / 20 / 5 / 10), the merchant's shop (damaged; 250 / 20 / 10 / 5), the town hall (damaged; 450 / 40 / 15 / 25): 1,350 gold and 235 materials in all; each missing material costs 8 gold (`REBUILD_MAT_GOLD`), so a hero who found nothing pays ~3,230. Until a building is rebuilt its door is shut and its friend stands outside with only a "closed" line (npcs.js `FRIENDS[id].closed`); rebuilt, the house is repainted whole, the door opens, the friend thanks the hero and keeps shop inside. E at a ruin's doorstep opens `#rebuild-screen`.
- **Materials and caches** (caches.js): `mats` and `cacheFound` ride in `heroSnapshot` (a death Retry loses that run's finds, as gold). 21 caches: the Slime Caves 3 per map (mostly stone), the Bastion's village 3, trail 4, bridge 1, castle 4 (wood and iron); ~247 materials in all, a little over what the four buildings need. Only for a saved hero (not Quick Play, the Training Room or Limitless). Dev console: "+50 materials", "Reset Cinderholt".
- **To watch in the playtest:** the costs and the 8-gold rate; whether caches are too hidden or too obvious; skills that skip `e.pod` in their area checks don't break caches (direct hits do), as with kegs.

## The user's decisions (2026-10-15)

1. **After Valerius falls**, the hero returns to Cinderholt, and it becomes the **new hub**. Before that, the parchment map with its hub panel stays the hub (Caves, then the Bastion).
2. The **map becomes a big noticeboard / gate in the village**. It stays the way to pick a dungeon.
3. **Old friends live there**: a smith, an apothecary (and the merchant). They take the role of today's "invisible" shops. The dungeon versions (the stage-cleared screens) stay as the **emergency** stops; the village ones offer **better stuff and the real changes**.
4. **Renovation costs gold and materials** (wood, iron and so on) gathered in the dungeons, plus **sidequests** in Cinderholt (for example a bandit hiding in the ruins with a full stash).
5. The **dialogue system** (dialogue.js, made for Valerius) is reused for the NPCs.
6. It is a lot of work, and that is fine.
7. **Three NPCs from the first arrival:** a merchant, an apothecary and a smith.
8. **Skills stay on in the village**: the dashes are how you get around. They just harm nobody (there are no enemies in the base, and the NPCs are not in enemies, so nothing can be hit).
9. **The noticeboard stands at the gate.**
10. **The arrival scene:** the user writes it.
11. **More buildings** (more below): a **tavern** where the other classes visit as NPCs, a **garden** that feeds the potions, and a **trophy room**.

## Numbers: how much gold the two dungeons pay

One bot run, 2026-10-15 (the campaign bot, a Ranger, Slime Caves then Bandit Bastion, both cleared first try; one seed, so a rough guide, see memory: bot-runs):

| | Caves | Bastion | Both |
|---|---|---|---|
| Gold earned | 1,112 (40 sold) | 2,574 | **3,686** |
| Spent by the bot | 900 | 1,350 | 2,250 |
| Left at the end | 252 | 1,218 | |

- The bot bought only the **rare weapon and armor** and upgraded them (+5 / +4); it never bought the amulet, boots and gloves rares (650 gold), elixirs or flask upgrades.
- **All five rares, no upgrades** (1,150): about **2,500 gold left** after both dungeons.
- Where the Bastion gold comes from: boss purses (8 coins of `20 + 2 x wave`) are most of it. Wave 5 ~395 (with the war chest), wave 10 ~350, the bridge (wave 11) ~340, the Royal Guard (16) ~730, Valerius (17) ~430. Waves 16 and 17 alone are ~1,160.
- The smith is the big sink: `price x 0.3 x (N + 1)` per +1. Rares to **+5 on all five: ~5,175; to +10: ~18,975**. So gold is already scarce; the hub's renovation must not simply eat the smith's gold. This is why materials and quests exist.

**Proposal (to check with the user):** keep gold costs for the whole village around **1,500-2,000** in total (less than the ~2,500 surplus, so the smith still matters), and put the rest of the cost in materials so replays of the dungeons have a purpose. Re-measure with a second class and seed before locking numbers.

## The flow

```
Slime Caves ... Bandit Bastion (waves 1-17) -> Valerius falls -> crown claimed -> Victory
   (parchment map hub, as today)                                      |
                                                                      v
                                          arrival scene (once): the hero walks into Cinderholt,
                                          the smith and the apothecary are there (dialogue)
                                                                      |
                                                                      v
   BASE: walk the village, talk to NPCs, renovate, sidequests, the noticeboard at the gate
                                                                      |
                              noticeboard -> the parchment map (overlay) -> a dungeon -> back to the BASE
```

- **When the base replaces the map:** a hero whose `cleared` list holds `bandit_bastion` (a flag in the save, `base.open`, set at the arrival scene so it plays once). A hero who hasn't cleared it gets today's flow unchanged. Quick Play never has a base.
- **Existing heroes** who already cleared the Bastion see the arrival scene on their next load.
- **Limitless mode** after the victory screen stays as it is; "Back to the Map" on the victory screen becomes "Return to Cinderholt" once the base exists.
- **Retry and return:** `heroToMap` / `heroRestart(false)` currently reload with `dungeon: null`, landing on the map via `openHeroMenu` -> `pickHero` -> `showDungeonMap`. For a hero with the base open the same path lands in the village instead.

## What the base is

A **walkable Cinderholt**, no waves, no enemies:
- Reuses `map_village.js` (`buildVillage`, the cached ground and canopy) as a variant: a new `STAGE_MAPS.base` (or a mode flag on the village map) with the Warchief's longhall, the barricade and the fires gone. Burning houses become burnt; renovation changes a house's state and **repaints the cached layer once** (houses already carry `state: 'intact' | 'burnt' | 'burning'`).
- Skills work (the dashes are how you get around) but nothing can be hurt: the base has no enemies and the NPCs are not in `enemies`. Check that no skill effect can still damage the hero or spawn hazards there (ground fire, traps).
- **Interact with E** near an NPC, a house or the noticeboard: a prompt over the thing, the dialogue, then the service screen.
- **K (skill tree) and I (inventory) already open anywhere**, and the respec is free in the hub (`treeRespecOk`); the base keeps that.
- Each screen returns to the village (a new origin next to the hub's and the stage-cleared screen's: `invFromHub` / `shopFromHub` style flags, `hubReturn` saving the hero).

### The noticeboard / gate

A big board **at the gate** on the east road, where the barricade was, that opens the **parchment map as an overlay** (the existing `#dungeon-selection`). Choosing a dungeon enters it as today; leaving a dungeon returns to the village.

### The NPCs

Dialogue uses `openDialogue({ name, title, portrait, lines, onClose })`; each NPC needs a `BIG_PORTRAITS` entry in portraits.js (new art, in the style of Valerius: a head-to-hips pose with an aura; a calmer colour for friends). Who they are (names, looks, history with the hero) is the user's to decide: "old friends".

**Their looks (the user, 2026-10-16), portraits drawn** (`BIG_PORTRAITS.smith` / `apothecary` / `merchant`, each with its own rim and title colour, `rim` / `tint`; the dev console's "Cinderholt's friends" buttons open a placeholder dialogue with each):
- **Smith:** no reference; "an older, bigger man, around his 60s". Drawn bald with a white fringe, a big white beard braided through an iron ring, rolled sleeves, a scorched apron, a sledge on his shoulder; forge-orange.
- **Apothecary:** after `referencess/apothecar.png`: a young herbalist in a green wrap jacket and a wine-red skirt, dark green hair in a bun with a blue ribbon, beaded braids, freckles; a sprig of herbs; jade.
- **Merchant:** after `referencess/merchant.webp`: a cheerful young trader, silver hair, a green cap with a feather, a capelet trimmed in triangles, a red bow; scratching his head, flipping a coin; gold.
- **Their sprites** (2026-10-16): js/npcs.js `NPC_SPRITES`, top-down like the heroes (the smith a size bigger, the apothecary smaller; the merchant flips a coin when he stands still), with a wander (`addNpc`) ready for the village. The dev console's "Walk here" puts the three round the hero.
- **Where they live** (the user, 2026-10-17): the apothecary in the house with a garden (the north one), behind her counter; the merchant in the house by the pen (my pick, "any of the remaining houses"), behind his; the smith's house burned down completely (the lot south of the square, where he stands): his smithy interior exists but isn't reachable until it's rebuilt. The longhall above the well is the town hall: tavern, rooms, trophy room.
- Still open: their names and their history with the hero.

| NPC | Service (existing screen) | Why they are better than the dungeon stop |
|---|---|---|
| Smith | `openSmith` (`#smith-screen`) | knobs to pick from: a higher upgrade cap than +10, cheaper upgrades, repair, recolouring gear |
| Apothecary | `openApothecary` (`#apothecary-screen`) | more elixirs, a third belt slot, a higher flask tier, better prices |
| Merchant | `openShop` (the fixed catalogue) | a wider stock, for example another class's rares for a hero who wants them |

Every knob raises the economy's pressure (see the smith's numbers above), so each one is a design decision with the user, not a default. Renovating a building is what unlocks or upgrades its NPC.

## Materials and renovation

- **Materials** are new hero currencies next to gold: **wood, iron, stone** to begin with (the user said "wood, iron etc"). They are saved with the hero (`heroSnapshot`, so a failed run loses what it gathered, as gold does) and shown in the village's panel.
- **Where they come from** (proposal): fixed amounts so the budget is computable, not random drops.
  - Slime Caves: stone (and perhaps a resin or slime item for the apothecary).
  - Bandit Bastion: wood (the trail's logjams, the camp's racks), iron (the castle's smithy and forge, the armory, boss crates).
  - Bosses drop a crate; a few pickups sit on each map. A random drop type next to `'flask'` in `checkEnemyDeath` is the alternative if the user wants kills to matter.
- **A renovation** costs gold plus materials. A house goes ruin -> repaired -> (later) improved, and a repaired building brings its NPC's service up a tier or opens a new one. A table of buildings, costs and unlocks is the next thing to draft with the user.
- **Order:** the village starts with the smith and the apothecary standing (they are the friends you find), standing in half-ruins; the rest of the houses come back one by one.

## Sidequests

**Built 2026-10-17** (the user's picks: all four kinds, every reward kind, a HUD tracker). Content in js/quests.js (`QUESTS`, `KEEPSAKES`, `PERKS`, `TALK`: the lead's draft lines), mechanics in js/sidequests.js.
- **The talk menu:** E on a friend opens their greeting and a choice list in the dialogue box: Chat (small talk pools that change with rebuilds and quests), their service (disabled until rebuilt), the quest (New / In progress / Hand in), Deliver (when carrying something for them), Leave. A "!" over a friend offers a quest, a "?" waits for a hand-in.
- **The quests**, one at a time per friend, in order: the merchant: Rats in the Ruins (an ambush on the burnt Harlan lot; the stash; the Lucky Coin), Scattered Wares (6 bundles round the village), The Strongbox (the castle treasury; his favour: 15% off); the apothecary: The Herb Chest (the trail's hunting camp; her favour: elixirs 20 gold), Crystal Cores (12 crystal slimes; the Herb Pouch), A Salve for the Smith (a delivery); the smith: My Father's Hammer (the castle's smithy; his favour: upgrades 15% cheaper), The Hounds (15 hounds; the Hound-Tooth Charm).
- **Keepsakes** (quest-only trinkets, not gear, always carried): Lucky Coin +15% gold from kills, Herb Pouch flask +10% healing, Hound-Tooth Charm +5% move speed. **Favours** are the friends' service perks.
- Quest progress lives in `heroBase().quests` (outside `heroSnapshot`), so a death Retry keeps it: the forgiving choice. Dying in Cinderholt (the ambush) wakes the hero at the gate with nothing lost.
- **To watch:** reward sizes against the rebuild costs (the quests pay 680 gold, 20 wood, 23 iron, 15 stone in all); the ambush's strength (wave-13 bandits, x1.5 HP); whether the tracker crowds the screen.

Small errands that give gold, materials or a one-off item, so Cinderholt has a reason to be walked:
- **The bandit in the ruins** (the user's example): a straggler hides in a burnt house with a stash; find him (a marker or a hint from an NPC), a short fight with existing bandit enemies, the stash is the reward.
- Candidates: goods lost in a burnt house, a cache in the Slime Caves that opens after the Bastion, a bounty on one enemy type in a replayed dungeon.
- Quest state lives in the save (`base.quests`), each one once.

## Expeditions and memories (built 2026-10-17)

The user found it odd to replay the whole story to fetch a hammer once Valerius is dead. Their choice: **expeditions** for the quests, and the full dungeons kept replayable as **memories**.
- **The noticeboard** opens a board of notices: three expeditions and "Memories..." (the parchment map). Content in js/quests.js (`EXPEDITIONS`, `MEMORIES`), mechanics in js/expeditions.js.
- **Expeditions** (repeatable; dungeon ids `exp_<key>`, `activeExpedition`): an existing map as it is now, story scenes off and every part open; three waves of what lives there now, then a named chief (an existing enemy type scaled and tinted, `e.chief`, `e.isBoss`), a purse, the road home at the map's start, an "Expedition complete" panel. The Fallen Bastion (the castle: looters and deserters; Harrow the Deserter rallies his men), The Raiders' Camp (the trail: feral hounds; Old Scar howls up the pack), The Silent Hive (the hive: crystal slimes; The Prism throws shard rings and splits in three). Enemies fight like the castle's wave 13 (`statWave()`), the hive's slimes tuned to match (`EXP_TUNE`).
- **Quests** point at expeditions (`QUESTS[id].exp`): quest items and bounty kills count only there. Caches on those three maps can be found there too.
- **Memories**: a story dungeon started by a hero who lives in Cinderholt opens with a memory card, the plaque reads "A memory", victory reads "The memory fades." Gold, XP and caches as before; no quest progress.
- **To watch:** expedition length (~5 minutes intended) and chief strength (7,000 HP); the Raiders' Camp is mostly hounds.

## More buildings (the user's ideas, 2026-10-15)

### The tavern

The other classes visit Cinderholt as NPCs and can be met inside it (an interior popup: the first use of the house-interior idea, or a plain scene with the tavern's keeper and a row of seats).
- **Eleven visitors**: every class but the hero's own. They arrive over time rather than all at once, so the tavern fills up as the hero progresses and renovates it (proposal: renovation tiers or dungeon clears bring the next visitors, which gives a collection goal).
- **What they do** (options, the user picks): rumours and tips about dungeons and bosses; a class-flavoured sidequest each; a sparring match in the Training Room; short stories. Companions or hirelings are a much bigger job (a second hero in combat) and are not planned.
- **Art and dialogue:** `PORTRAITS[classId]` already gives a front-facing, waist-up pose for all twelve classes, a cheap first version of their dialogue portraits. Fuller `BIG_PORTRAITS` come later. Eleven short dialogue sets is the real work.
- The tavern also fits a walk-in interior with the keeper as a fourth service NPC (rumours, a place to rest).

### The garden

Vegetables, herbs and flowers grown in plots, the apothecary's ingredients.
- **Plots** (a few at first, more from renovation) hold one crop each. Seeds come from the merchant, sidequests and finds in the dungeons.
- **Growth runs on the game, not the clock:** a plot grows by waves cleared or dungeons completed, so the save needs no real-time clock and nothing can be gamed by changing the date (growth is a counter on each plot, ticked in `onWaveCleared` and on clearing a dungeon).
- **The harvest makes rarer elixirs** (the user, 2026-10-15): the garden does not touch the current elixirs (Might, Swiftness, Iron Skin stay a 30-gold purchase); its crops are the ingredients of new, rarer ones that gold alone cannot buy, brewed by the apothecary. Which elixirs, and what each crop is for, is still to design. Flowers can double as decoration or a small perk.
- It also gives the base something to do between dungeons: a short loop of tending and harvesting before the next run.

### The trophy room

A room that shows what the hero has done, built from things the game already knows.
- **Boss trophies**, one shelf each: the Slime King, the Amalgam, the Hive Queen (her crown is already an object in the game), the Warchief (his war chest), the Beastmaster, Valerius (his crown), the Royal Guard's champions.
- **The record:** dungeons cleared, kills, play time, the best Limitless wave, the five rares worn. Heroes keep separate slots, so a view across heroes (the classes cleared) needs one small account-wide key next to the saves.
- **Existing heroes:** only the `cleared` list is known for them, so older trophies show as won without details; new ones record a time and the class from now on.
- It starts as a display. Small perks for a full shelf are a possible later addition, not planned.

## Save data

On the hero (`heroData`), next to `cleared` and `entry`:

```
base: { open: false, houses: { <index>: 'burnt' | 'repaired' | ... }, mats: { wood, iron, stone }, quests: { <id>: state }, seen: { arrival: true },
        tavern: { <classId>: met / arrived }, garden: { plots: [ { crop, growth } ], harvest: { <crop>: n } }, trophies: { <id>: { at, ... } } }
```

`mats` also goes into `heroSnapshot` / `applyHero`, so Retry restores them as it does gold.

## Code touchpoints

| Where | What changes |
|---|---|
| save.js `pickHero`, `openHeroMenu`, `heroToMap`, `heroRestart` | a hero with the base open starts in the village instead of `showDungeonMap` |
| save.js `heroSnapshot`, `applyHero`, `heroCleared` | `mats`; `base.open` when the Bastion is cleared |
| ui.js `showVictory` | the button reads "Return to Cinderholt"; the arrival scene plays once |
| map_village.js | the base variant (no spawns, kegs, longhall or barricade), per-house states from the save, repaint on renovation |
| stage.js | the base mode: free movement and skills, an interact prompt, no wave logic (`onWaveCleared`, `startNextWave` untouched) |
| dialogue.js / portraits.js | NPC dialogue sets and `BIG_PORTRAITS` for the smith, apothecary, merchant |
| ui.js `openSmith`, `openApothecary`, `openShop` | a new origin (the base) and the hub's better stock |
| hub panel (`renderHub`) | stays for heroes before the Bastion; the village shows its own small panel (gold, materials) |
| menu.js | the parchment map opens from the noticeboard as an overlay and returns to the village |
| potions.js | the garden's harvest as ingredients (new elixirs, cheaper brews, flask upgrades) |`n| portraits.js | the tavern's visitors: `PORTRAITS[classId]` already has a front-facing pose per class, a first cut for their dialogue |`n| the campaign bot (`bot5`) | expects the map / hub flow; it needs a change once a cleared hero lands in the village |

## Build order (each step is playtested before the next)

1. **The walkable village.** The arrival after the victory, walking Cinderholt (burnt, no fires), the noticeboard that opens the map, a dungeon and back. No NPCs. This proves the flow and the save.
2. **The smith.** His portrait, his dialogue, E to talk, the Smith screen returning to the village. The first better-than-dungeon knob.
3. **The apothecary and the merchant**, and their hub-only improvements.
4. **Materials and renovation:** the three materials and their sources, the buildings table, house states and the repaint.
5. **Sidequests**, starting with the bandit in the ruins.
6. **The tavern**, with the first two or three visitors.
7. **The garden** and the apothecary's recipes that use it.
8. **The trophy room.**
9. **Later:** house interiors (a popup or a small map; only the three intact houses make sense at first), ambient villagers.

## Open questions for the user

- Who are the old friends (names, how they know the hero)? Their looks are settled and drawn. The merchant, apothecary and smith are all there from the start.
- Which knobs make the hub smith, apothecary and merchant better than the dungeon stops (cap, price, repair, stock)? Each moves the economy.
- The gold / materials split for renovation (proposal above), and the materials list.
- Tavern: what the visitors do (rumours, errands, sparring), and what makes them arrive in order.
- Garden: which rarer elixirs, and which crop makes which?
- Trophy room: display only, or small perks?