# Balance Reference

A snapshot of every number that matters for the balance patch: classes, skills, items, dungeons, enemies, bosses and how they scale. Read from the code on 2026-10-09 (after the v1.8 Slime Caves update) and kept up to date as the patch goes in. File and line references point to where each number lives.

## Patch log

### Status: v1.9, the Balance Patch (finished 2026-10-11)

Everything in this log is the v1.9 Balance Patch, on top of v1.8 (the Slime Caves). In short:

- **Numbers:** core formulas (armor %, Power as one additive stat, rank +20%, CDR cap 60%), enemy and boss scaling, every class brought into one damage band around the Ranger, then boss HP set from in-engine bot fights (King 1600 + 400/wave, Amalgam 4650 + 700, Queen 12 600 + 1400; Bandit Bastion bosses by the same factors). The economy: fewer drops, 20% resale, dearer rares.
- **Class reworks:** the Druid became the Wildcaller (an autonomous wolf or black jaguar), the Dragonknight's heavy greatsword (hold to charge, release to slam) and Dragonfire Blade, the Paladin's Divine Tether, the Nightblade as the boss-killer (Mark for Death), the Kensei's Razor's Edge (+150% at full Flow, hits cost Flow), the Cleric and Kensei band-pass reworks, armor HP scaled by class.
- **Items:** every class has its own five rares; the rare weapon awakens a little each wave.
- **Combos** ([combos.js](js/combos.js), all nine classes, 3 to 6 each): round one, a Space → LMB finisher per class; round two, skill-into-skill combos chosen class by class with the user (listed under "Second combos" and each class's "round two" below), each needing a deliberate press, aim, timing or risk.
- **Ranks** all do something now, and the level-up cards list every value a rank changes (ui.js `RANK_STATS`). The ultimate can no longer be the starting pick (the Lv.1 testing bypass is gone; the Training Room covers testing).
- **Training Room** (training.js): dummies, a DPS meter and a panel for ranks, evolutions, the late-game kit and cheats.
- **Enemies and maps:** the Amalgam's Undertow, brood pods counting toward the wave, leaps that never land inside a body.

In-engine DPS on a boss dummy with every round-one finisher (late gear, see "DPS comparison with every finisher"): Nightblade ~494, Ranger ~502 (bot-inflated), Spellweaver ~491, Kensei ~476, Dragonknight ~453, Druid ~411, Cleric ~360, Paladin ~309, Machinist ~304; in real boss fights the Cleric, Machinist and Paladin land at 84-100% of the Ranger. The round-two combos come on top only when played well (most add ~+4-8% when kept up; the top classes got choices or utility instead), so the bot numbers above don't include them.

**Open after v1.9** (worth watching in play, not blocking):
- The Cleric is weak against the Slime King early (~80 DPS against ~130 for the others with an early build); Prism (Divine Ray through Hallowed Ground) may help.
- The Paladin bot stalls in the Queen's guard phase in some fights (chasing the orbiting guards); a player cuts across.
- Boss fight lengths with real play (targets King ~40 s, Amalgam ~65 s, Queen ~120 s), now that skilled players also have the round-two combos.

### Bandit Bastion bot runs (2026-10-12)

After the Swordsaint became the **Kensei** (its rare armor is now the Ronin's Silk Shroud) and the Bandit Bastion maps went back to zoom 1. A bot played waves 1-10 four times per class from a fresh start: it levels by the v1.9 "mid" builds, buys at the shop, takes the letter, walks the exits, kites (casters) or closes in (melee), steps out of lanes, wedges, landing marks and shots, and is revived when it dies (deaths are counted). It's a steady but mechanical player: compare the classes with each other, not with real play.

| Class | Run (s) | Warchief (s) | Beastmaster (s) | Deaths S1 / S2 |
|---|---|---|---|---|
| Kensei | 347 | 30 | 53 | 2.2 / 4.0 |
| Cleric | 372 | 41 | 65 | 1.0 / 3.5 |
| Nightblade | 373 | 18 | 45 | 4.0 / 7.8 |
| Paladin | 378 | 27 | 48 | 0.5 / 2.8 |
| Dragonknight | 380 | 34 | 52 | 0.0 / 0.5 |
| Druid | 386 | 36 | 60 | 0.0 / 1.8 |
| Spellweaver | 402 | 40 | 73 | 3.2 / 10.0 |
| Ranger | 414 | 41 | 60 | 0.5 / 1.2 |
| Machinist | 472 | 50 | 85 | 0.2 / 2.5 |

- Regular waves take 16-45 s; every class reaches Lv. 10 by the Beastmaster and buys its rare weapon at the first shop.
- **The Beastmaster deals ~52% of all damage taken over both stages**, 55% of it from the joust, 27% the whip, 18% contact. The joust lane is drawn 50 px wide but rides down anything within 56 px of his centre (his 30 + the hero's 18 + 8), so a hero standing visibly clear of the lane still gets hit; the horse rider's lane is drawn 26 px wide against a 42 px reach. His second and third runs lock 0.2 s before a 950 px/s charge. **Fixed:** both lanes are now drawn as wide as the hit (`e.size + 16` = 76 px for the joust, `e.size + 12` = 48 px for the rider).
- **Forest visibility** (share of on-screen enemies under the canopy, outside the hero's see-through hole): forest road 37% (22% within 350 px of the hero), 21% of enemy shots and 28% of landing marks and traps; the camp clearing 5%, the riverbank 5% (landing marks 18%), the village 3%. **Fixed:** on the trail the leaves turn see-through round every bandit, enemy shot and landing mark near the trees, as they do round the hero (`trailCanopyHoles`); in a software-rendered test it cost no more than the hero's own hole.
- **Moving around** (how much of the intended speed the hero actually gets, and pin-ups against something for 0.6 s+ per 10 minutes of walking): the camp clearing 92% / 19, the riverbank 87% / 36, the forest road 84% / 42 (mostly the tree line), the village 79% / 68 (house walls and garden fences). No pocket on either map is walled off from the start. One near-miss in the village: the garden at x 790-1010, y 260-430 has a gap between its fence and the house corner that looks open but is one 25 px cell (the hero needs 36).

**Fixes after the bot runs** (2026-10-12): the Kensei's Parry Thrust counts shots its sweep cuts out of the air as a parry (once per sweep: +20 Flow, Counter Step, and Flawless Execution's full Flow and Q reset; before, the sweep destroyed them before they could land in the 0.3 s window, so parrying a shot never counted; combat.js `parrySuccess`). The Kensei's Flow in hand holds 3 s after the last gain and then fades 8/s (was 1.5 s and 15/s: dodging a crowd drained the bar before the blade could go out; skills.js `FLOW_GRACE` / `FLOW_DECAY`). The Beastmaster is placed at the bridgehead when the second logjam opens instead of after the breather.

### Bandit Bastion stage 3: the duel with Valerius (2026-10-12)

Wave 11 on its own bridge map (map_bridge.js); his moves are ai.js `ValeriusAI` (`VAL_*`). Damage multipliers on his hit (25 + 5/wave, so 80 at wave 11, then the global ×0.6): Spear Lunge ×1.6, Hook & Haul ×0.8 plus the kick ×0.6, Sweeping Arc ×1.3, Spear Toss ×1.0 each way, Chain Lasso ×1.4, Chain Cyclone ×1.3 (at most once per 0.6 s), Skewer Leap ×1.8, contact ×0.7; the archers' volley marks ×0.55. The intro's kick takes a quarter of max HP, never the last of it.

- **HP:** 5600 + 670/wave became **7000 + 840/wave** (12 970 → 16 240 at wave 11, ×1.25). Bot duels before it averaged 64 s (46-78 by class), below the bot target of 70-90 s (real 90-120 s).
- **Bot check after it** (full runs from wave 1, so each class has the gear it would have; 3 runs each): duel 80 s on average. Nightblade 59 s, Cleric 57, Paladin 75, Druid 79, Machinist 84, Ranger 87, Kensei 87, Spellweaver 93, Dragonknight 94. Deaths per duel: Spellweaver 5.0, Nightblade 4.0, Kensei 3.3, Cleric 2.0, Ranger 1.3, Paladin 1.3, Machinist 1.0, Druid 0.3, Dragonknight 0.
- **What hurts:** Chain Cyclone 19% of the HP lost, contact while he circles 18%, Sweeping Arc 12%, the lunge 11%, Hook & Haul 14% (the hook and the haul's kick). The archers' volleys are pressure more than damage (1%).
- **After the first look (2026-10-13): faster and heavier.** Size 44 → 52, speed 90 → 165 (+2/wave: 187 at wave 11), the gaps between moves 1.0 / 0.9 / 0.6 s → 0.55 / 0.5 / 0.35 s by phase, quick side-steps between moves and a pole-vault on his spear from more than 430 px away (×0.8 if he lands on you), the lunge faster (1100 → 1400 px/s, 380 → 420 px). The wind-ups and locks are unchanged, so every telegraph gives the same warning. Bot duels after it: 83 s on average; Cleric 57, Nightblade 59, Paladin 78, Ranger 79, Druid 80, Kensei 81, Dragonknight 97, Spellweaver 106 (7 deaths per duel), Machinist 113. The kiting and turret classes suffer most from a boss who closes in fast.
- **Then (2026-10-13): he dodges.** Between moves, when his dodge is ready (every 2.6 / 2.2 / 1.7 s by phase), the next hit is evaded with a blurred side-step (not DoTs, not Nightblade weak points); his random side-steps between moves are rarer (every 1.6-2.8 s, was 0.9-1.8). From far off he sprints (×2.2 speed) instead of vaulting again and again: the vault is now only at 430-650 px, at most every 4 s, and flatter (80 px high, was 130). Test: ~10% of a steady stream of hits evaded (9 of 90 in 30 s). Bot duels not rerun yet: expect them a little longer.

### Playtest checklist

- **Cinderholt (Bandit Bastion stage 1, new):** do the bandits read at a glance (thief, archer, shieldbearer)? Do fences and houses make good cover without trapping you? Kegs: worth luring bandits to, or just a hazard? The Warchief's Torch Toss and Keg Kick (does the warning give enough time?), the intro out of the longhall, and the barricade burning down.

- **The Raiders' Trail (Bandit Bastion stage 2, new):** do the riders' lanes give enough warning? Are the traps fair? Do bannermen read as priority targets? Do hound packs feel like the Druid's wolf? The Beastmaster's arrival (crouched with his hounds at the bridgehead, rising when you come close or strike), his mount and Kennel Call; does advancing section by section feel like a journey?

- **The bridge (Bandit Bastion stage 3, new):** the walk across and the intro (the drop, the hook, the kick: does losing a quarter of your HP feel fair?); can you read each of Valerius's moves in time (lunge and hook lanes, the arc, the lasso ring, the cyclone, the leap)? Is the Hook & Haul's punish window worth taking? The archers in phase 2; his escape and the dialogue box.
- **Bosses:** do the fights land near the targets (Slime King ~40 s, Amalgam ~65 s, Hive Queen ~120 s) with combos? Does the Queen's 60-30% guard phase still get skipped by strong AoE? The Queen's bullet hell.
- **Amalgam:** the Undertow with its 0.65 s warning. Is the fight winnable for single-target classes?
- **Economy:** shop 2 with ~1000 gold: does choosing what to skip feel good or stingy? Is shop 1 a real choice with the rare weapon starting at +50%?
- **Dragonknight:** the held slam (release to strike) and tapping as the quick option; Dragonfire Blade uptime; Skyfall Catch, Rebound, Wyrmfall.
- **Ranger:** Storm Arrow's draw; Skyline Shot, Gale Volley and Thunderstorm (the 0.3-0.8 s Volley window).
- **Spellweaver:** Blink Lance on a single boss; Frostfire's 0.25 s window; whether the Ice Wall holds too much or too little.
- **Nightblade:** bosses fast enough to feel like its specialty, swarms hard but fair; Shadow Daggers, Shadow Strike and Smoke Step.
- **Machinist:** grapple-to-turret as the core loop; Tesla Turret, Conductive Net and Lightning Rod.
- **Kensei:** Razor's Edge (+150% at full Flow vs −25 Flow per hit); Iaido, Guardian Orbit, Counter Step, Return Cut, Whirling and Gale Orbit, Gathering Gale; the blade glow (in hand at 100 Flow, the whole Airborne flight).
- **Cleric:** the Zeal-scaled ray vs Hallowed Ground's Zeal cost; Radiant Burst into Divine Ray; Prism, Sanctified Arrival, Twilight Eclipse; the early game.
- **Druid:** the companion hunting with you (prey choice, Scent, Bond pace); Pounce Strike, Pincer (the 120° angle with a beast that moves on its own), Thorn Rake, Barkburst.
- **Paladin:** Divine Tether in both modes; Judgment Smash, Flail Sweep, Ring the Hammer, Zealous Charge.
- **Class rare sets:** does each feel worth buying? Watch the Orb of Echoes' 4th charge, the Spellthread's free bolts and the Overclock Regulator's free Heavy Turrets.
- **Ranks and cards:** do the new rank effects (Blink / Vault / Shadow Step reach, Guardian Orbit, the grapple penalty, Ascension, the airborne flight, spirit bites, Feral Surge) feel worth a point, and do the cards say enough?

**Pass 1: core formulas and basic stats** (the knobs are constants at the top of [combat.js](js/combat.js)):
- Armor is a percentage: `armor / (armor + 20)` of each hit, instead of a flat subtraction.
- Damage orbs: +2% each, capped at +40% (`player.orbDmg`), instead of +5% uncapped. Blessings (`player.bonusDmg`) stay +5% and don't count toward the cap.
- Skill ranks: +20% per rank (×1.6 at rank 4) instead of +30%. This also covers rank-scaled shields, heals and durations (`calcUtility`).
- Common items: `valBase + tier × valMult`, so T8 matches the rare's stat and the rare keeps its unique effect on top.
- Amulet of Power: +5% damage per stack (max +25%) instead of +10%.
- Cooldown reduction caps at 60% (was 80%) and no longer speeds up basic attacks.
- Machinist pellets ×0.25 (was ×0.7). Nightblade thrusts ×0.5 each. Spellweaver basics only explode with Resonance.

**Pass 2: enemy and boss scaling** ([enemies.json](data/enemies.json), knobs in [combat.js](js/combat.js)):
- Boss HP: Slime King 1000 → **1800** (800 + 200/wave), Amalgam 3200 → **5000** (2000 + 300/wave), Hive Queen 13 500 → **12 000** (4500 + 500/wave). Targets: ~40 s / ~65 s / ~120 s fights, estimated, to be confirmed in play.
- Stage-3 minion HP (wave 11 → 15): Spore Slime 248 → 320 became **166 → 190**, Crystal Slime 450 → 570 became **281 → 325**, Slime Warden 750 → 950 became **413 → 465**. Stages 1-2 unchanged.
- Slime Warden orbs: at most one pops per 0.25 s (hits in between are still shielded), and a lost orb regrows every 6 s while it isn't stunned.
- Bosses count down stun, root, freeze and blind 3× as fast (`BOSS_CC_RATE`): Deep Freeze holds a boss 1 s, Net Shot 0.67 s, Handheld Purity 0.5 s.

**Pass 3: skills that didn't scale, and class outliers:**
- Base damage for skills that had 0: Smoke Bomb 12 (Toxic Fumes now deals ×1/s), Hallowed Ground 15, Phase Shift 20, Ascension 30 (Avatar of Renewal's bolts now hit).
- Now scaled through `calcDmg`:
  - Nightblade weak points: `calcDmg(3 × basicDmg)` true damage (~54 at the start, ~140 late) instead of a flat 60.
  - Death Mark Chain Reaction: `calcDmg(50, R rank)` instead of a flat 50.
  - Kensei: the Airborne blade and Phantom Wind use `calcDmg(basicDmg)`; Shatter Storm mini-blades hit for 5% of R's damage.
  - Cleric: Desecration, Raven Flight and the 100-Zeal Hallowed Ground damage use the skill's real damage. Hallowed Ground heals scale with rank. Twilight Repulse is `calcDmg(30)`.
  - Druid Savage Blooms: 0.4× the transform's damage per second instead of a flat 50.
  - Spellweaver Arcane Arrival: 1.2× Blink's damage (was unranked `calcDmg(30)`).
- Removed the hidden ×1.2 that Barbed Tips gave most Ranger hits (the slow and bleed stay).
- Outlier nerfs: Divine Ray ×12 → ×5.25 total (Void Spike ×15 → ×6.75), Sentry Turret fires every 0.8 s instead of 0.4 s, Parry Thrust ×2.5 → ×1.5, a clean Paladin catch leaves Q at 1.5 s instead of 0.
- Druid Aspect of the Wild: transforming costs 8 s, reverting 1 s (was 2 s both ways).

**Pass 4: leftover bugs:**
- Iron Bulwark now braces you: 50% less damage for 2 s after the cast (`buffs.ironBulwark`), with a HUD chip. The shield is unchanged.
- Level-up cards and the Tab sheet only show a cooldown change for skills whose cooldown actually shrinks with rank (Space, Kensei E), via `skillBaseCd` in combat.js.
- Dragonknight Frenzy now also gives +2% attack speed per stack. All attack-speed sources go through `attackSpeedBonus()` in skills.js.
- Rare items match their text: the Cleric's censer says +100% DMG, Ronin's Silk Shroud says +240 HP, and a class rare can set its own `val` in classes.json (Windwalker Steps +60, Aether Grips +30%).

### Class passes

**Dragonknight** (older classes felt too weak):
- Damage mult 0.8 → 1.0 (+25% to everything).
- Basic slash reach 110 → 130 px.
- Shield Throw flies back to the Dragonknight and is caught on contact (shield granted on the spot), instead of landing at the throw point.
- Thunder Leap: landing ring 80 → 120 px, plus a 0.5 s stun on non-bosses.
- Dragon Breath: every enemy the flames touch burns for ×0.2/s for 3 s (refreshes, doesn't stack).
- Frenzy: after 3 s without a melee hit, stacks drain one every 0.5 s instead of all at once.

**Spellweaver** (make the spell/basic weave the core of the class):
- Resonance is now charges: each spell stores one (max 3), each basic spends one. Empowered bolt ×1.5 → ×2.0, explosion 70 → 80 px.
- An empowered bolt that hits cuts 0.25 s off Q, E and Space (once per bolt), so weaving brings spells back faster. (Started at 0.4 s; the loop saturated, with ~90% of basics empowered and the Spellweaver ~10-25% above the other older classes, so it was trimmed after the damage comparison.)
- The class gauge shows Resonance charges instead of Power Surge (one of the known broken gauges).
- Velocity (Q-A): each Fireball stores 2 charges. Accelerated Drop (R-A): the impact fills Resonance to 3. Ice Barrier (E-B): shield 40 → 60.
- HP 80 → 100.
- Watch in playtest: with a fast Blink (rank 4 + CDR) most basics end up empowered; Blink spam could become the main charge source.

**Ranger** (support the always-moving, fast-shooting fantasy):
- Basic arrows: hitbox 4 → 9 px, speed 700 → 1000 (same ~1000 px range), damage 8 → 10 (20 → 25 dps, 30 with full Momentum).
- Soft aim assist: an arrow targets the enemy nearest the cursor (within 70 px of it) and curves toward it at up to 5 rad/s. It lets go once it has flown past. Rock still stops it (it isn't a `customUpdate`).
- Fleetfoot: full +20% in 2 s of moving (was 4). Standing still keeps it 1 s, then it drains over 2 s (was: gone instantly). Momentum now also gives the same % as move speed.
- Ricochet Shot → Split Shot (3-arrow ricochet fan) → after the damage comparison, **swapped with the rare weapon skill**: Storm Arrow is now the Q, and the bouncing arrows became the bow's Chain Lightning.
- Fixed: a ricochet arrow could hit the enemy it had just bounced off again (ricochets weren't in the already-hit skip list).
- **Q = Storm Arrow** (hold to draw, release to fire; ranked, base 100 at full draw, 3 s cooldown from release). Evolutions: Quickdraw (half the draw time, no slow) / Thunderhead (follow-up strike at full damage + 0.5 s stun on non-bosses).
- **Stormcaller Bow RMB = Chain Lightning**: three lightning bolts in a fan (`calcDmg(40)` each), each jumping to 3 more enemies, with an arc drawn at every jump.
- Any skill slot or right-click can be hold-to-charge: give the class a `charge: { slot: sk => ({ max, slow }) }` entry in its SkillRegistry. main.js (`startCharge` / `releaseCharge` / `castSkill`) handles press, release and cancelling; the cooldown starts on release.
- Damage model after the swap (boss, early / mid / late): 44 / 142 / 164 → ~68 / 160 / 194. Still the lowest, but it's the safe ranged class.
- Volley was weak on a single target (~2.4 of 10 arrows landed on a boss): the arrows now home onto the enemies inside the circle, and every arrow after the first on the same enemy deals 40%. A lone target takes ×4.6 per volley instead of ~×2.4; packs take about the same as before.

**Machinist** (playtest: melted bosses; turrets all focus the boss and keep firing while you dodge):
- Damage model, late single target: 243 with no evolutions, 315 with Automated Assembly, 452 with Assembly + Arc Network. About 70% of it is hands-free (turrets, coil), so it keeps all of it through boss mechanics; on a "realistic uptime" measure (melee hits 65% of the time, ranged 80%, turrets 100%) that was 225-434 against 120-178 for the other older classes.
- Turret cap: 2 standing at once, 3 with Automated Assembly. A new turret packs up the oldest (with a puff of smoke, no Volatile blast).
- Sentry Turret damage 15 → 10.
- Arc Network: each coil→turret line deals ×0.5 of a pulse instead of ×2.
- Realistic-uptime result: ~179 with no evolutions, ~224 with Assembly, ~257 with Assembly + Arc Network.
- New Salvage Economy passive: Scrap (25% of kills) is stored, max 20, shown in the gauge orb (Overclock moved to a HUD chip). Pickup still heals 5 HP; the -0.5 s cooldown cut is gone. Placing a turret with Q spends it automatically: 10 Scrap → Siege Turret (×2 damage, 1.5× size, 15 s), 5 → Heavy Turret (×1.5, 1.25× size, 12.5 s). Big turrets still count toward the cap; Automated Assembly's free turrets are always plain. Overclock refreshes a turret to its own lifetime. Income is roughly 4-5 Scrap per wave early and 8-9 late, so expect a Heavy Turret most waves and a Siege Turret saved up for bosses; not in the damage numbers above yet.
- Scrap is now spent by **holding Q** (main.js charge system) instead of automatically: a tap builds a plain turret, holding 0.4 s spends 5 for a Heavy Turret, the full 0.9 s spends 10 for a Siege Turret (you move at 80% while building; a ring and label at the cursor show the tier). With under 5 Scrap, Q places a plain turret at once.
- Heavy and Siege turrets are never packed up by a new turret; only plain ones are. If only big turrets fill the cap, Q refuses ("Turret limit") without spending the cooldown.
- Turret cap now grows with Q's rank: 2 at ranks 1-2, 3 at ranks 3-4, +1 with Automated Assembly (max 4). A HUD chip shows standing turrets / cap.

**Nightblade** (less glass cannon; weak points should feel like weak points):
- HP 60 → 80 (tried 100; 80 keeps it high-risk, high-reward with its damage).
- A weak-point hit now goes through blocks: Slime Warden orbs, Bandit frontal shields and thief dodges. Immune phases (the Queen's guards, her last stand) still stop it, and the mark isn't consumed on an immune target.
- Fixed: weak-point true damage was subtracted outside the Hive Queen's death check, so a weak point that finished her skipped her last stand. Weak-point damage (and Death Mark's splash) now goes through `queenLastStand` like everything else; the splash also no longer hits immune enemies.
- Shadowstrike Daggers RMB: Execute (a teleport stab, the same job as Phantom Dash and Death Mark) → **Expose**: every enemy in a 300 px, 120° cone in front of you gets a weak point on the side facing you. Watch in playtest: Expose followed by Fan of Knives can pop several weak points at once.

**Newer classes, damage comparison** (same model: target always in range, everything on cooldown, no amulet, no evolutions; final damage per second, early / mid / late, single target):
- Kensei 359 / 678 / 796 (pack 1709 late). The steered blade alone was 467 late, Shatter Storm 228; the blade was out 80% of the time.
- Paladin 65 / 124 / 156 (Handheld Purity 170). Druid 42 / 111 / 131 in wolf form, 114 in caster form. Cleric 46 / 86 / 102 (Void Spike 118, plus Desecration 177).
- For reference, the older classes late: Dragonknight 225, Spellweaver 223, Ranger 194, Nightblade 185.

**Kensei** (3.5× everyone else; pass 3 making the blade scale with gear and orbs made it worse):
- Airborne blade: Flow adds up to +50% (was +100%), Empowered ×1.25 (was ×1.5). A steered hit is ×0.4 of the basic (was ×1.2): it still lands ~12 times a second, so the blender feel stays and each hit is lighter. Tuning lives in `BLADE_STEER_MULT` / `BLADE_FLOW_BONUS` / `BLADE_EMPOWER` and `bladeHitDmg` in skills.js.
- Flow drains 15/s in Airborne (was 10/s): a full bar keeps the blade out ~6.7 s instead of 10.
- Shatter Storm shards hit every 0.5 s (was 0.25 s) for a flat 5% of R's damage (no more Flow and Empowered multipliers).
- Blade Surge ×1.8 total (6 × 0.2 + 0.6; was 6 × 0.3 + 0.8 = ×2.6). Q base damage 50 → 40 (Parry Thrust too).
- Model after: steered ≈ 98 / 182 / 215, blade on autopilot ≈ 78 / 147 / 176.

**Paladin** (a small boost; it's the tank, so it stays a bit under the damage dealers):
- Basic 12 → 14, Judgment Hammer base 30 → 35, so the throw-recall-catch loop carries the buff.
- Model: 65 / 124 / 156 → 73 / 140 / 175 (192 with Handheld Purity; planted with Conduit Shock 187).
- Hammer gauge redone (it was a known issue): In Hand "Q: throw"; Flying fills along the throw; Planted fills toward the next threat pulse and flashes on it; Returning fills as it nears you, then glows "Catch!" once it commits to its straight line; Missed warns that Q won't be cut. The Light Shield chip now shows whenever the hammer is away, which is when the +15% armor actually applies (it used to show only while planted).
- Passive text: a catch cuts Q to 1.5 s (it still said "reset").

**Cleric** (furthest behind; Zeal only changed the ray's size, never its damage):
- Divine Ray damage now scales with the Zeal it spends: ×0.5 under 10, ×1 at 10, ×1.75 at 50, ×2.5 at 100 (`RAY_ZEAL_MULT` in skills.js). Width and length tiers unchanged. Building Zeal with the censer and then releasing a full beam is the rotation, and Hallowed Ground competes for the same Zeal.
- Void Spike at <10 Zeal: the 5% current HP cost used to only cancel the ×0.5 penalty (the "×13.5" in this doc was never true). It now fires at the 100-Zeal tier: blood instead of Zeal. Under Aspect of the Reaper (Zeal locked at 0, spells cost HP) the ray no longer takes the empty-Zeal penalty.
- Twilight Repulse now damages bosses (still no push or stun on them). Basic 12 → 14.
- The Zeal orb's small line shows the next ray's multiplier ("ray x2.5") and glows at 100.
- Model: 42 / 77 / 92 → 72 / 147 / 179 single (pack 298 → 563); Void Spike late 214. Watch Desecration: with Void Spike it models ~278 once E reaches rank 4.
- Radiant Flash (Q-A): each enemy newly blinded gives +10 Zeal (the description promised Zeal; the code never gave any).

**Description sweep** (every passive, skill, evolution and rare checked against the code):
- Fixed, didn't work: Bramble Core+ (the bolt never carried its evolution, so the patch was always 50 px with no slow; it now also flies to the cursor, 500 px at most, instead of always 500 px). Decoy Projection (only ate one projectile; non-bosses within 300 px now go after it for its 2 s, using the hammer taunt). Shatter Breath and Desecration only broke Bandit shields, so they did nothing in the Slime Caves; `shatterShields` in combat.js now also pops every Slime Warden orb (stunned as if the last orb popped; they regrow as usual).
- Text now matches the code: Avatar of Renewal (8 s, not permanent), Raven Flight (instant siphon, no mark), Savage Blooms (10 s cloud), Velocity (+60% speed, not +100%), Robes of the Magi (pierces every enemy), Vestments (+240 HP; Holy is −15% projectile damage plus a bolt back), Hazard Suit (also ignores hits under 5), Bloodlust (also 5% per clone strike), Vine Whip (a cone).
- Not in any text, left as is: a Phantom Dash that pops a weak point refunds half its cooldown.

**Druid** (superseded by the rework below; rethought as a shapeshift weave; it was 42 / 111 / 131 and the forms didn't feed each other):
- Aspect of the Wild: 3 s cooldown both ways (was 8 s to transform, 1 s to revert). Shifting is the rotation: seed as caster, transform, claw, revert.
- The Roar (transforming): R's hit and 1 s stun in 200 px as before, and it now detonates every spore in range. The Shed (reverting): every enemy in 200 px gets a spore stack.
- Spores: each stack deals 0.6 × your basic damage per second (was 0.25 × whatever hit applied it, so a basic after Bramble Core lowered the DoT). A pop deals ×2 of what's left (was ×1.5). Expired stacks now reset (they used to carry over, so the next seed jumped straight to 3 stacks). Helpers `seedSpores` / `popSpores` and the constants are in skills.js.
- Savage Blooms keeps one cloud at a time (shifting every 3 s would stack them). Apex Predator heals on roar pops too.
- Gauge: the orb now shows how many spored enemies the next roar would catch and fills as R comes back (it glows when the roar is ready and has targets). The Totem's Pounce stacks moved to a chip.
- Model: 42 / 111 / 131 → 78 / 168 / 196. Watch packs: the Shed and the roar both work on everything in 200 px.

**Druid rework: the Wildcaller** (2026-10-10, after the playtest; it replaces the shapeshift weave above):
- Why: the weave played as a chore (seed, shift, claw, revert every 3 s, with no real decisions), each form was half a kit, the wolf's 100 px melee put the Druid in the worst spot against spitters and the Queen, and the spore pops were hard to see.
- New identity: a nature caster with a wolf that hunts at their side. You don't steer it (that's the Kensei's blade); you influence it. It goes after what you hit (Scent), pounces on what you snare, and you pour magic into it. Details in section 4.
- Evolutions fork into **Alpha** (one stronger wolf, single target, Bond) and **Pack** (more wolves, area), like the Cleric's Holy/Shadow.
- Gone: the forms, Spores, and every old skill and evolution (Bramble Core, Vine Whip, Barkskin Shift, Spore Burst, Feral Pounce, Aspect of the Wild...), plus the visuals nothing uses any more.
- Reused: the wolf sprite (now the companion; spirit wolves are a pale green ghost of it), the Bite fang FX, the pounce claw marks, the bark shell, thorn patches, the spirit paw, the totem wand and its seed bolt.
- No free starting rank any more: the wolf is the class's core, so R unlocks at Lv. 5 like everyone else's.
- Gauge: Bond (shows "Maul / next bite" and glows amber when full; the wolf pulses amber too). Chips: Feral Surge, Dire Wolf, spirit wolves.
- All the Druid's code (wolf AI, skills, basic, visuals) is in `js/druid.js`, loaded after paladin.js.
- Model (same checkpoints): **72 / 152 / 182** single target, pack 144 / 334 / 424, about 47% of it from the wolf. Headless boss sim (standing still, everything on cooldown, the same gear and ranks): Slime King 10.2 s against the Ranger's 9.7 s, Amalgam 12-17 s against 11.2 s.
- After the first playtest (feels much better; Q works as a soft way to point the wolf): wolves no longer pile onto each other (they push apart), and spirit wolves spread over a pack instead of all biting one enemy. Headless test with Wild Hunt (5 wolves): 4.3-4.6 different prey when enough enemies are in range (was 1.4-2.6, then 3.3 with a smaller penalty); on a boss wave the spirits take the adds and your wolf stays on the boss.
- Black jaguar companion (asked for after the playtest): a choice screen after picking the Druid, wolf or black jaguar. Same damage per second, its own rhythm: slower, heavier bites and pounces from range (table in section 4). New top-down sprite (`sprJaguar` in sprites.js) with a rim light so it reads on dark cave floors; spirit jaguars are pale green ghosts like the spirit wolves.
- Fixed while testing it: the wolf's stuck check fired while it stood at its prey with an obstacle nudging it back a hair, so it bounded back to the Druid about once a second (lost ~15% of the wolf's bites near trees and boulders, ~40% of the jaguar's). It now only counts as stuck when it's out of reach and not moving.
- Spirit animals stay longer (playtest: they left too soon): Call of the Wild's spirits 8 → 12 s and Kindred Howl's 5 → 8 s, paid for with lighter bites (×0.5 → ×0.4). Dire Aspect stays 8 s. Model 72 / 152 / 182 → **74 / 154 / 185**; Wild Hunt late 196 → 202. Each spirit gets a draining timer ring and the chip shows the time left.
- Watch: the hands-free share (~47%; the Machinist's ~70% melted bosses), Bond cadence (about one Maul per 10 Scented bites, one or two per boss), and the Maul and howl stuns on bosses (1 s, shaken off 3× faster).

**Class rare sets** (2026-10-10, after the playtest): every class now has its own five rares instead of three shared ones; the full table is in section 5.
- Gone: Amulet of Power (+5% damage per cast, ×5), Ethereal Treads (half damage while moving, no collision) and Vampiric Grips (2% lifesteal). Treads were the best item for every class.
- 24 new items: an amulet (gauge or spell), boots (the Space skill) and gloves (the basics) for eight classes; the Kensei already had its set.
- Reworked armors: Dragon Scale Plate (was 5 HP per kill), Robes of the Magi (was piercing basics, which switched off charged explosions), Windrunner Tunic (was a plain +30% move speed).
- Every amulet's `val` is now its CDR (getCDR no longer checks names); rare amulets compare with commons in the tooltip.
- Headless test: every class fought 15 s with its full set, and each new effect was checked on its own and behaved as described.
- Watch: the game is harder without Treads and lifesteal. Healing from items is now only the Dragonknight's and Paladin's gloves, the Cleric's sandals and the Druid's Bloodrage.

**Wave flow** (2026-10-10, playtest decision): no more wave-cleared screen between regular waves. The next wave starts by itself after a 4 s breather (the wave plaque counts down), with the usual 30% heal. Bosses still stop the run: the stage exit, then the stage-cleared screen with the shop. The inventory opens any time with I and pauses the fight.

**Band pass** (2026-10-11). A new model counted the rare sets, evolutions, amulet CDR and Space ranks, and tried every way to spend 13 skill points. With those, the late spread was 236-500 plus the Machinist at 652, and the rare weapon was the only sensible shop-1 buy (+35-77% at wave 10, mostly from its +100% stat). Goal: damage dealers within about ±10% of the Ranger late, the Paladin at ~85% as the tank, boss HP raised to match.

- **Awakening rare weapon** (`rareWeaponItem` / `awakenWeapon` in [items.js](js/items.js)): bought at **+50% DMG**, +4% for every wave cleared after it was bought, up to **+90%**. A T4 common is +45%, so shop 1 is a real choice; the rare still ends above the T8 common (+85%). The tooltip shows the current % and a floating text announces each step. The class texts no longer start with "+100% DMG"; the shop adds the line.
- **Kensei reworks** (the old E and R-B evolutions did nothing):
  - E-A **Riposte Recall** (was Aegis Return): recalling sends the blade back through everything between it and you for 2× basic damage, and you keep 30% Flow.
  - E-B **Early Deploy** (was Instant Flow, whose +30% Flow on deploy was always capped away since Deploy needs a full bar): deploy from 70% Flow; the bar fills and the blade launches Empowered.
  - R-B **Tempest Shards** (was Piercing Shrapnel, which only kept a shard on its target): shards strike every 0.3 s (was 0.5) and cut every enemy within 60 px of the strike.
  - **Prismatic Core:** 20% CDR and airborne Flow drains 30% slower (was 15% CDR and +25% max Flow, which made Deploy slower to reach).
  - Shatter Storm shards 5% → 5.5% of R. **Aether Grips:** the +30% attack speed now also speeds the airborne blade (`bladeAttackSpeed`).
- **Cleric:**
  - Fix: under Aspect of the Reaper, Void Spike fired at ×1 instead of its blood power, because the empty-Zeal tier was converted first. It now fires at the 50-Zeal power (×1.75), not ×2.5, since the Reaper already gives +50% and cuts cooldowns. Without the Reaper it's unchanged (5% current HP, ×2.5).
  - **Aspect of the Reaper:** casting is free; instead it drains **4% max HP per second** (32% over 8 s, never below 1 HP; `REAPER_DRAIN`). Kills still heal 25% of missing HP.
  - Trims: Desecration ×1.5 → **×1.2** per tick, Void Spike ×6.75 → **×6.0** total.
  - The Zeal gauge's "next ray" line now shows the blood ray (and its Reaper power) instead of "empty: half power".
- **Machinist** (most of its damage was hands-free): Overclock makes turrets fire **1.5×** as fast (was 2×), Automated Assembly no longer raises the turret cap (its two free turrets count toward it), Sentry Turret 10 → **9**, scattergun pellets ×0.25 → **×0.3**.
- **Dragonknight:** Shield Throw 30 → **35**. **Wyrmheart Pendant:** Frenzy stacks up to **15** (`frenzyMax` / `addFrenzy` in items.js); the Berserker Gauntlets heal from 10+ stacks.
- **Nightblade:** Fan of Knives 5 → **6**. **Serrated Grips:** the bleed deals a basic's damage per second (was ×0.3). **Sigil of the Hunt:** weak points deal **+25%**.
- **Spellweaver:** Arcane Arrival ×1.2 → **×1.0** of Blink's damage.
- **Druid:** wolf bites ×1.25 → **×1.35**, basic 12 → **13**, Bramble Snare 30 → **40**, Spirit Leap 35 → **45**.
- **Paladin:** Judgment Hammer 35 → **42**, a clean catch leaves Q at **1.2 s** (was 1.5), Righteous Charge 30 → **35**, Consecrated Wrath 25 → **40**. **Gauntlets of Devotion:** smashes with the hammer in hand deal **+30%**. **Seal of Judgment:** the charge a catch readies hits **+50%**.
- **Boss HP** (raised by the modelled damage gain at each stage: ×1.26 / ×1.51 / ×2.06): Slime King 800 + 200w → **1000 + 250w** (2250 at wave 5), Amalgam 2000 + 300w → **2900 + 435w** (7250 at wave 10), Hive Queen 4500 + 500w → **9000 + 1000w** (24 000 at wave 15). Bandit Bastion bosses by the same ratios: Warlord **750 + 150w**, Beastmaster **2175 + 320w**, Valerius **4000 + 480w**.
- Fix: the projectile loop crashed when the Queen's last stand or death cleared her shots mid-loop (`if (!p) continue` in main.js).

Modelled single-target damage per second after the band pass (target always in range, best build, early / mid with the rare weapon / late with the full set; the Ranger is the anchor):

| Class | Early | Mid | Late | Pack (late) |
|---|---|---|---|---|
| Dragonknight | 99 | 239 | 363 | 1242 |
| Spellweaver | 87 | 253 | 425 | 1586 |
| Ranger | 88 | 227 | **393** | 915 |
| Nightblade | 94 | 233 | 394 | 1161 |
| Machinist | 98 | 223 | 409 (was 606-652) | 955 |
| Kensei | 123 | 251 | 378 | 1166 |
| Cleric | 84 | 338 (254 without the Reaper) | 550 (423 without) | 2004 |
| Druid | 105 | 236 | 393 | 1072 |
| Paladin | 97 | 206 | 323 (82%) | 1177 |

The Cleric's Reaper numbers are a burst window paid for in HP. In-engine check (a bot that never dies and casts everything on cooldown, full set, wave 15): the Queen went down in 77-108 s (Ranger 77, Machinist 87, Kensei 89, Spellweaver 91, Nightblade 97, Dragonknight 102, Cleric 108), against the ~120 s target; a real fight with dodging should land near it.

**Dragonknight playtest** (2026-10-11, played after the band pass). Feedback: the shield had no cap (2000+ against the Queen); most of the damage came from Q and R, while the fantasy should be big, heavy basic attacks; Iron Bulwark only gave a shield. Also: "x% damage" isn't clear, the Amalgam's Assimilate decides the fight for slow-clearing classes, popping the Queen's-room eggs didn't count toward the wave, and selling drops after wave 10 bought the whole shop.

- **Shield cap** (`addShield` in combat.js, every class): stacked shields stop at 50% of max HP; a single shield bigger than that still lands whole. The Q catch, Ice Barrier, Kinetic Shield, Mag-Lock Boots and Wyrmblood go through it (Feral Surge sets its bark shell directly and doesn't stack).
- **Dragonknight greatsword:** tap for a light swing (unchanged, 15), hold for an overhead slam: 0.8 s charge (faster with attack speed), ×3.5 at full, 170 px reach, a shockwave at the impact point, a 0.3 s stagger and +1 extra Frenzy. A full charge lets fly by itself, so holding LMB chains slams (later changed: the slam strikes on release, see Rebound). 20% slower movement while the blade is raised. Visual: the blade goes up over the shoulder (foreshortened, strictly top-down), a charge ring at the feet flashes white when ready, and the chop comes over the head and lands in front.
- **Dragonfire Blade** replaces Iron Bulwark (and its 2 s brace): 12 s cooldown, 6 s of +50% basic damage (+10% per rank), +30 px reach, and hits set enemies burning. A: **Inferno Edge** (full slams erupt in a 150 px ring of fire). B: **Wyrmblood** (a small capped shield per enemy hit and 1% max HP per connecting swing).
- **Dragonknight skills down** so the basics carry the class: Shield Throw 35 → 18, Thunder Leap 35 → 20, Dragon Breath 70 → 38.
- Model (always in reach, best build, full slams): **115 / 234 / 363** (was 99 / 239 / 363); basics are **75% / 54% / 52%** of the damage (was 34% / 20% / 18%). In-engine with the bot walking up to the boss: Amalgam 290 DPS (Ranger 310), Queen 242 (Ranger 314; she leaps away and fights from the throne, which costs melee the most).
- **Power** (combat.js `powerParts` / `powerMult` / `playerPower`, `hitDmg`): every damage source adds into one number; see section 1. Orbs doubled to +4 Power each (cap +80) to keep the totals. Items, blessings, the Frenzy gauge, the Momentum and Reaper texts say Power; the Tab sheet lists Power and its parts and real per-hit numbers (it used to show hits without the ×0.6); level-up cards show the real hit ("Hit 84 → 101").
- **Amalgam:** Assimilate every other round, 3 minions, 5% heal each, dazed 2 s. New **Undertow** attack in the freed slot (section 6).
- **Brood pods** (hive): popping a pod during a wave kills the slime waiting inside: one fewer to spawn, it counts as a kill, and it can end the wave. A boss wave keeps its last spawn, since that one brings the boss.
- **Economy:** item drops 18% → 8% of kills, items sell for 20% of their price (was 50%), armor and amulet 200 → 250, boots and gloves 150 → 200 (weapon stays 250). Modelled gold: ~295 at shop 1, ~1000 by shop 2 (was ~460 / ~1900), against 1150 for the whole set.

**Combos** (2026-10-11, the user's idea; [combos.js](js/combos.js)): Space, then a basic attack within 0.75 s of landing, turns that attack into a class finisher. The user chose a real payoff (~+10-15% damage when used on every dash). The Dragonknight and Ranger have theirs; the others come after each class's playtest.
- **Dragonknight, Wyrm Whirl:** the swing after Thunder Leap spins all the way round you, ×2.2 and 20 px farther. It's the same swing, so a held slam spins too (×3.5 × 2.2, and its shockwave staggers the whole ring); the window counts from when you start the swing, so a 0.8 s charge still makes it. Late: a full-slam whirl adds ~52 base per leap, about +12% (early ~+9%).
- **Ranger, Arrow Trail:** after Vault, the next shot also rains 8 arrows down along the path you just vaulted, each ×2 a basic arrow in 45 px. Vaulting away from a boss puts it near the start of the path: ~3 arrows land, about +12% late. Through a pack it hits everything you jumped over.
- Once every class has a finisher, the whole band moves up ~12%, so boss HP needs another look then.
- **Ideas for later** (after every class has its Space finisher, so each class gets one solid combo first):
  - Skill into Space: Dragonknight Shield Throw, then Thunder Leap onto the flying shield to catch it mid-air and come down with a slam.
  - Space into skill: Ranger Vault, then Storm Arrow fires fully drawn from the top of the jump.
  - Ult during a dash: Dragon Breath cast mid-leap rains fire in a circle below instead of a cone.
  - Status combos: Spellweaver Fireball shatters enemies frozen by Frost Nova for bonus damage; Nightblade Smoke Bomb then Phantom Dash out, so enemies lose you and the next thrust is a guaranteed backstab.

**Paladin, E and finisher** (2026-10-11, playtest: "E is clunky. It can only be activated if the hammer is down and doesn't really do anything"):
- **Divine Tether** replaces Bastion Dome. It works in both hammer states: chained to the planted hammer (5 s, sweep it like a flail), or shackling an enemy to you (4 s, +20% damage taken from you, non-bosses reeled within 150 px). The chain burns (×0.4 of 15 every 0.25 s) and slows 40% whatever touches it. New evolutions: Mending Links (heals per enemy on the chain) and Chain of Retribution (the old Retribution Barrier, on the chain). After the next playtest the heal became part of the base skill (0.5% max HP per enemy per pulse, max 1.5%), and E-A became **Overflowing Grace** (overhealing turns into a shield). Holding the chain on a boss for a whole cast adds roughly +10% damage.
- **Judgment Smash**, the Space finisher: ×3 and a 1.5 s stun around the impact. Iron Pull's version rips the planted hammer out of the ground into the smash. Using it after every Space adds ~+6% (the Paladin stays below the band as the tank).
- Pulls (Righteous Charge, Iron Pull, the Machinist's grapple) now open the combo window when they arrive, like dashes do.

**Nightblade combo** (2026-10-11; it sits at the low end, so this comes on top with no trim): first **Exposing Path** (the dash marked everything it passed through for the next thrust to pop). Dropped after one try: "it takes away from the skill expression that makes the Nightblade a master assassin; you can just swish through everything with the dash." Then **Vanish** (every dash landed in 1 s of shadow, the next thrust an ambush), dropped too: "Vanish is not a combo. It just happens after every dash." The rule since: nothing happens on the dash itself; the payoff is only in what you do with the basic after it. Final: **Shadow Daggers**, the thrust after Phantom Dash becomes three daggers thrown in a tight fan toward the cursor, each a full basic (3× the whole attack). They're Fan of Knives daggers, so they pop a weak point only if they hit its marked side: dash out to the right angle, then throw back. It keeps your distance, which is how the user already plays Phantom Dash. Tested at 200 px on a small slime: 32.4 (3 × 10.8) unmarked, 86.4 with the weak side facing you (popped), 32.4 with it facing away (the mark stays).

**Kensei finishers** (2026-10-11), one per stance. Handheld, **Iaido**: the slash after Shadow Step is a draw-cut; a beat later everything you dashed through is split for 2× a slash, +20 Flow each. Airborne, first **Blade Rush** (the blade rushing through the cursor), now **Impale** (below). On top, no trim: the Kensei sits ~4% under the Ranger (378 vs 393 late), and the Ranger got its finisher on top too. Tested: two enemies on a 300 px Shadow Step each took 17.3 (2 × 8.6) and Flow went 0 → 40. **Every class now has its Space finisher**, so the band has moved up ~10-12% overall: boss HP needs a look before release.
- Fix after the playtest ("Iaido sometimes acts like it wants you to hit something"): a click during the dash itself (Shadow Step is 0.18 s) fired a plain slash before the window opened and lost the combo. Now, for every class, a basic pressed while a combo-opening dash or pull is still moving waits for the landing and fires as the finisher (`comboQueued` in combos.js; the Dragonknight's swing too). And Iaido's cut is drawn twice as wide as Shadow Step's own flash, with a ring and a small shake, so it reads as triggered even when it cuts nothing. Tested: a click 2 frames into the dash fired Iaido; a Dragonknight tap mid-leap fired the whirl.
- Blade Rush didn't land: first it fired by itself (LMB is held to steer), and with a fresh-click requirement it still didn't feel right. Replaced by **Impale**: a click after Spatial Swap drives the blade into the enemy nearest the cursor (within 150 px of it); it sticks there for 1.2 s, cutting it 5 times for 0.6× an Empowered hit each (~3× in total), then pulls free and you steer again. Pure single target, unlike the airborne Q's spin (Thousand Cuts was turned down for that reason). With nobody near the cursor the click is a plain press and the window stays open. Tested: held through a swap, no impale; a fresh click, 5 cuts of 9.5, then free. Then Impale was dropped too: the dummy test showed it cut slower than plain steering (the combo cost ~12%). Final: **Guardian Orbit**, the click after the swap whirls the blade round you for 1.2 s at the steering rate (1.5× a steered hit on everything within reach), nudging non-bosses away and shredding enemy shots: a defensive buzzsaw after swapping into danger.
- **Every combo needs a press after Space** (playtest: "if you simply hold down LMB while pressing Space that activates the combo without any user skill, in any class"): a finisher only counts if LMB was pressed after the Space cast (`comboPressOk`: the last mousedown vs `comboCastAt`). A button held through the dash gives a plain attack; a click during the dash still counts. Tested on the Dragonknight and the Ranger: held through Space, no finisher; a fresh click after it, one.

**DPS comparison with every finisher** (2026-10-11, in-engine): a boss-sized training dummy that doesn't move or attack, late-game gear (all five rares, weapon fully awakened, +80 orb Power), band-pass builds, every skill on cooldown (held skills drawn fully), Space dashed across the dummy, and (combo runs) a fresh click after each landing. The dummy never attacks, so nobody loses time dodging; that flatters everyone but the Machinist, whose turrets keep firing in real fights.

| Class | Without combo | With combo | Combo adds |
|---|---|---|---|
| Nightblade | 465 | 494 | +6% |
| Ranger | 397 | 502 | +26% (the bot vaults across the dummy, so all 8 trail arrows land; vaulting away from a real boss ~3 do, ~+10%) |
| Spellweaver | 438 | 491 | +12% |
| Dragonknight | 390 | 453 | +16% |
| Druid | 386 | 411 | +6% |
| Kensei | 336 | 393 | +17% (Guardian Orbit; 398 / 476 after Razor's Edge, below) |
| Cleric | ~353 | ~360 | ~+3% (this build has Phase Shift at rank 1: 9 combos in 40 s; runs vary ±15) |
| Paladin | 286 | 309 | +8% |
| Machinist (Scrap kept full) | 259 | 304 | +17% |

Changes from it: **Sentry Turret 8 → 10** (it measured ~60% of the Ranger; earlier, in a real Queen fight, ~89%); **Radiant Burst ×2.5 → ×5**, and the violet (Shadow) ring now siphons 2% max HP per enemy (up to 3) instead of giving Zeal, since Void Spike fires its blood ray at empty Zeal; **Guardian Orbit** replaces Impale (which cut slower than steering, so the combo cost ~12%), at 1.5× a steered hit.

**Kensei, Razor's Edge** (2026-10-11; "the Kensei's damage seems low; I want it to be a high-risk, high-reward class"): Flow now adds up to **+150%** damage (was +50%) to the handheld slashes, the blade, Iaido and Guardian Orbit, and **every hit you take costs 25 Flow** (continuous damage doesn't; in Airborne an empty bar drops the blade back to your hand). The Ronin's Silk Shroud softens it: hits cost 10, and Airborne it dodges 10%. On the dummy (never hit, so the reward without the risk): 367 / 434 at +100%, **398 / 476 at +150%** (without / with combos), near the top. A sloppy Kensei bleeds Flow and falls well behind.

**Boss-fight check for the trailing classes** (2026-10-11). The dummy can't show what the Machinist's hands-free turrets are worth while others dodge, or how the Paladin's hammer copes with a moving boss, so: real Amalgam (wave 10) and Hive Queen (wave 15) fights, full late gear, an immortal bot that chases its target, uses everything on cooldown and combos after each Space. First pass (one fight each): Amalgam Ranger 423, Dragonknight 391, Machinist 329, Cleric 310, Paladin 269; Queen Ranger 377, Machinist 365, Dragonknight 346, Paladin 326, Cleric 326. Changes: **Cleric** Divine Ray at 100 Zeal back to ×2.5 (Radiant Burst turned out too small to pay for the trim) and **Desecration ×1.2 → ×1.4** per tick; **Paladin** Judgment Hammer **42 → 50** and Divine Tether pulses **×0.4 → ×0.5**; **Machinist** Overclock **×1.5 → ×1.75** fire rate. After (three fights each, averaged):

| Class | Amalgam | vs Ranger | Queen | vs Ranger |
|---|---|---|---|---|
| Ranger | 406 | 100% | 379 | 100% |
| Cleric | 365 | 90% | 339 | 89% |
| Machinist | 343 | 84% | 379 | 100% |
| Paladin | 341 | 84% | ~335 (288 with a bot outlier) | ~88% |

Fights vary a lot run to run (one Paladin Amalgam fight went 269 → 409 with no change). The Paladin's outlier: in 2 of 5 Queen fights the guard phase took ~34 s instead of ~9 s, the melee bot chasing guards round their orbit; a player cuts across. Worth watching for melee classes in that phase. Kill times with a perfect, immortal bot: Amalgam 17-25 s (target ~65), Queen 60-95 s (target ~120): boss HP still needs raising once the classes settle.

**Boss HP pass** (2026-10-11, after every class got its finisher). Measured in-engine: each class fights each Slime Caves boss twice with the gear a player has by then (Slime King, wave 5: commons, T3, +16 orb Power, early builds; Amalgam, wave 10: the awakening rare weapon at +66 plus T5 commons, +52 orbs, mid builds; Hive Queen, wave 15: the full rare set, +80 orbs, late builds). The bot never dies, never misses and combos after every Space, so the bot targets are the real targets ÷ 1.3 (the ratio the band pass used for the Queen): King 31 s, Amalgam 50 s, Queen 92 s.

| Boss | Bot average before | HP factor | New HP | At its wave |
|---|---|---|---|---|
| Slime King | 19.3 s | ×1.6 | 1600 + 400/wave | 3600 (was 2250) |
| Amalgam | 30.6 s | ×1.6 | 4650 + 700/wave | 11 650 (was 7250) |
| Hive Queen | 69 s (her ~9 s guard phase doesn't scale with her HP) | ×1.4 | 12 600 + 1400/wave | 33 600 (was 24 000) |

Bandit Bastion's bosses by the same factors: Warlord 1200 + 240w, Beastmaster 3500 + 510w, Valerius 5600 + 670w. Check after the change (bot): King 26-29 s (Ranger, Dragonknight), Amalgam 40-48 s, Queen 83-98 s. Two findings: the **Cleric is weak at the Slime King** (~80 DPS against ~130 for the others, 43 s against the King; its early build leans on Divine Ray with little Zeal) and the **Paladin bot stalls in the Queen's guard phase** in some fights (chasing the orbiting guards).

**Druid finisher** (2026-10-11): **Pounce Strike**. The seed bolt after Spirit Leap is a calling bolt; whatever it hits, the companion springs onto it (up to 450 px) for ×3 a bite, a 0.5 s stun and +20 Bond, and spirit animals spring onto enemies around it. One call, not steering, so the companion stays "influenced, never commanded". Paid for by **bites ×1.35 → ×1.25**: a Druid who doesn't combo drops ~4%, one who does ends a bit above where it was. First version: ×3 the companion's own bite, which gave the jaguar (1.5× bites, 1.5× slower) half again the gain per combo (+29 vs +20). Now the strike is the beast's own bite plus 2 wolf bites. Tested from 400 px away: the wolf's pounce hit 29.3 (its 9.8 bite + 19.5), the jaguar's 34.1 (its 14.6 bite + 19.5), +20 Bond each; a calling bolt that missed called nothing.

**Druid, leap and snare** (2026-10-11, playtest): "the animal is fighting, almost kills an enemy, but then it has to retreat because you need to keep distance", and "Q basically does the same thing as the combo". **Spirit Leap** no longer pulls the companion to your side: it stays on its prey and rakes where it stands when you land (Scatter the Herd's snaps are around the companion too). **Bramble Snare** is now crowd control: a 140 px burst (was 80) that roots for 1 s (was 1.5) and then slows 40% for 3 s, and it no longer sends the companion; snared enemies stay its favourite prey when it next picks one (the passive now says "favours"). Tested: through a leap the wolf moved 0 px and kept its prey; a snare 300 px away rooted and slowed two enemies while the wolf stayed on its own. Then the evolutions that leaned on the old behavior: Q-A **Feeding Ground** (double Bond on snared or slowed prey) replaces Hamstring, Q-B **Grasping Vines** (the burst drags non-bosses to its centre before rooting) replaces Thicket, Space-A **Alpha Leap** (+25 Bond, and a Pounce Strike at full Bond is a Maul) replaces Bond Leap; Scatter the Herd stays. Tested: 10 → 20 Bond per bite on slowed prey; two enemies ~105 px out dragged to 20-29 px and rooted; a full-Bond pounce hit 58.5 (29.3 + the Maul's 29.3), stunned 1 s and emptied Bond.

**Nightblade as the boss-killer** (2026-10-11, playtest: "if the Nightblade survives long enough they can just press R to decimate every swarm, but the bosses take just as long. The Nightblade is an assassin: bosses should be their specialty; they struggle with swarm waves instead"):
- **R: Mark for Death** replaces Death Mark: one target, six clone strikes (×0.6 each), each popping a weak point. Bloodlust heals 2% per strike (the old 5% plus 10% per weak point would have been ~60% a cast); Chain Reaction carries the strikes to the next enemy if the target dies.
- **Expose marks the biggest enemy first**, so a boss always has a weak point to hunt.
- **Weak points ×1.5 on bosses.**
- **Fan of Knives 6 → 5**, the main swarm tool.
- Estimate (late): ~+30-35% boss damage, swarm clearing well down (R no longer hits a pack).
- **Armor HP scales with the class** (playtest: "the Nightblade gets +240 HP from the rare armor, and from T1+ armors as well"): every armor's HP is × (class base HP / 130), capped at ×1 so the tanks' 240 is the most (the user's call: scaling up would make the shielded Dragonknight unkillable). Rare armor: Nightblade 148 (base 80 → 228 max HP, was 320), Spellweaver and Kensei 185, Ranger, Cleric and Druid 222, Machinist, Paladin and Dragonknight 240. Commons scale the same way (T8: 135 for the Nightblade). The item's own value and text are scaled when it's made, so tooltips and comparisons show the real number. Tested at rank 1: one R put 583 into its target with six weak points (745 on a boss), and the enemy beside it only took the usual weak-point splash (66).

**Cleric finisher** (2026-10-11): **Radiant Burst**. The censer pulse after Phase Shift becomes a ring of light around you, ×2.5 to everything within 160 px and double Zeal per enemy (gold after a Holy spell, violet after a Shadow one), so Space → basic → Divine Ray is the Cleric's chain. Paid for by **Divine Ray at 100 Zeal ×2.5 → ×2.25** (Void Spike's blood ray too) (undone later, after the boss-fight check: the finisher turned out too small to pay for it): a Cleric who doesn't combo drops ~5%, one who does ends about where it was. Tested: enemies in front and behind each took 21.0 (2.5 × an 8.4 pulse), and Zeal went 0 → 60 from two enemies.

**Spellweaver finisher** (2026-10-11): **Blink Lance**, the user's pick over a charge-dump finisher and a two-bolt echo. The bolt after Blink becomes an instant arcane lance along the blink line, ×3 the bolt to everything you passed through; it rewards blinking through or past enemies. Blink stores a Resonance charge, so it's nearly always charged: ×5.4 a plain bolt. Paid for by **Resonance ×2.0 → ×1.8**: a Spellweaver who doesn't combo lands mid-band, one who blinks through its target gets back to the top. Tested: two enemies on a 350 px blink each took 38.9 (3 × a 13.0 charged bolt), and the charge and cooldown refund worked as for a bolt. Fire/frost reactions (Shatter) stay on the ideas list.

**Machinist finisher** (2026-10-11; "it was on top for damage, and its abilities aren't really comboable"): the grapple already latched onto your own turrets and coils, so the finisher builds on that. **Overload:** the shot after Magnetic Grapple overloads what you grappled onto. A turret fires 3× as fast for 2 s, a Tesla Coil dumps a 250 px nova (3× a pulse, 0.5 s stun), and open ground gives Point Blank (tight, double-damage pellets with knockback). Paid for by the turrets: **Sentry Turret 9 → 8** (~−7% for a Machinist that only drops turrets). Overloading a turret on every grapple (~4 s late) gives back about +6.5%, so an active Machinist lands where it was, a passive one below. Tested: a turret did 33.6 in 2 s overloaded against 9.6 plain; the coil nova hit exactly 3× a pulse; Point Blank 18 against a normal shot's 7.2 at 80 px.

**Leaping over enemies** (2026-10-11, playtest): a Vault over a boss used to land on top of it. The body push that keeps the hero and enemies apart ran mid-leap, so the hero carried the boss along the whole jump. Tested over each Slime Caves boss: 300 px vaults ended 48-78 px from its centre, inside the Queen every time. Now enemies aren't pushed during a dash, and a leap that still comes down inside a body slides on along the leap until clear (up to 160 px; walls stop it). The same vaults now land 130-220 px from the centre. Dash i-frames also start the instant the dash does (a puddle could tick in the first frame).

**Ranks that did nothing, and the level-up cards** (2026-10-11). A review of what each rank changes (damage ×1.2 per rank past 1, `calcUtility` values ×1.2, cooldowns only on Space and the Kensei's E) found ranks that did almost nothing; the user chose utility for the Space skills and a longer Ascension:
- **Blink** range 350 → 420 / 490 / 560 px. **Vault** 300 → 340 / 380 / 420 px (Acrobatics stays 500). **Shadow Step** 300 → 340 / 380 / 420 px (+100 with the Windwalker Steps) and **Guardian Orbit** 1.2 → 1.44 / 1.68 / 1.92 s. **Magnetic Grapple**'s open-ground penalty +2 → +1.5 / +1 / +0.5 s. All keep the shorter cooldown.
- **Ascension** 6 → 7.2 / 8.4 / 9.6 s (Avatar of Renewal and Aspect of the Reaper 8 → 12.8 s). **Kensei E**: the airborne blade drains Flow 10% slower per rank (a full flight 6.7 → 9.5 s). **Call of the Wild**: spirit animals bite ×0.4 → ×0.48 / 0.56 / 0.64 of your companion. **Feral Surge** lasts 5 → 6 / 7 / 8 s (the shell already grew 120 → 180).
- Tested: Blink 350 / 560, Vault 300 / 420, Shadow Step 300 / 420, Orbit 1.2 / 1.93 s, flight 6.7 / 9.5 s, grapple miss 7 / 3.25 s, Ascension 6 / 9.6 s, Surge 5 / 8 s, spirit bites 0.40 / 0.64.
- **Level-up cards** ("most of the levelling-up tooltips don't really say much: the Dragonknight's Q rank-up only shows the damage, not the shield"): every skill now lists each value its rank sets (ui.js `RANK_STATS`), and a rank-up shows each one that changes as before → after, with real numbers at your current Power: shields and their time, heals, durations, distances, turret cap, per-flame / per-arrow / per-tick hits, Dragonfire's bonus. Skills whose base damage only an evolution uses (Blink, Vault, Shadow Step) no longer show a misleading "Hit". The Evolve card adds what rank 4 brings under the two names. Small hits keep a decimal so the change shows.

**Training Room** (2026-10-11, the user's request: "a test room... place down (possibly immortal) target dummies to practice combos and to bugfix"): a card in the top-left sea of the dungeon map leads to a sand yard with no waves, loot or XP (training.js). Straw dummies at the cursor (1 target, 2 boss, 3 sparring: a telegraphed swing in reach every 2.4 s, a slow bolt from further), each showing its damage over the last 5 s and in total; immortal by default (they refill below half), mortal ones die and come back after 2 s. A panel (T) sets each skill's rank and evolution, the late-game kit of the DPS tests (rare set, +80 Power), god mode (on), no cooldowns and a gauge fill (G).

**Cosmetic fixes** (2026-10-11): the Kensei's blade is plain steel and only glows at 100 Flow (it glowed all the time). Second pass (playtest: "it still has an afterglow when they attack, move, but at full Flow + Airborne it doesn't glow"): the cyan afterimages behind a moving blade now only show while it glows, the swing trail below full Flow is steel-white (the rare weapon's was cyan at any Flow), and Airborne the blade glows for its whole flight (only a full bar deploys it, and it drains from the first frame, so "exactly 100" never glowed there and a fade from 100 to 50 was gone in ~3 s; playtest: "it still doesn't glow"). Then "it's coloured blue now, but still misses the glow outwards": the glow was only a canvas shadow on a 5 px blade, which barely shows, so a lit blade now has an additive cyan aura round it (three soft widths, slowly pulsing). Class-select difficulty tags on one scale: Easy (Dragonknight, Ranger), Easy / Medium (Paladin), Medium (Machinist, Spellweaver, Cleric, Druid; they used two colours), Hard (Nightblade), Expert (Kensei; Hard and Expert shared one red). The arrows that land in Arrow Trail and Volley were drawn head-up; they now stick head-down, leaning the way they fell.

**Second combos, skill into skill** (2026-10-11; "they make the game way more fun and challenging"). Every class has its Space finisher, so each now gets a second pair, built from the "Ideas for later" list above. Same rules: nothing fires by itself, and each needs aim, timing, placement or risk. Trailing classes get real damage from theirs; the top ones (Nightblade, Ranger, Spellweaver) get a choice or utility. The Dragonknight and the Ranger come first (the user's pick); the other seven are proposed: Shatter (Spellweaver, E → Q), Smoke Step (Nightblade, E → Space), Arc Link (Machinist, turret + coil), Riposte Step (Kensei, parry → Space), Prism (Cleric, E → Q), Thorn Leap (Druid, Q → Space), Chain Recall (Paladin, tether → Q recall).
- **Dragonknight, Skyfall Catch** (Q → Space): a Thunder Leap that meets its own flying Shield Throw (within 30 px of the hero, out or coming back) catches it in mid-air, and the landing becomes a slam: ×2.5 in 160 px (not ×1 in 120) and a 1 s stun on non-bosses, plus the catch shield. Only shields already flying when you leapt count, so a Q pressed mid-leap can't catch itself. The landing still opens Wyrm Whirl: Q → Space → LMB. Model: +30 base per leap, ~+7% late if every leap catches (Q's 4 s cooldown allows it), ~+3-4% in real play. Tested: leaping after the outgoing shield, or into the returning one, 30.6 at 60 and at 150 px (a plain landing 12.2, nothing at 150), stun 1 s, +50 shield; a Q thrown mid-leap or a leap away from the shield, a plain landing.
  - Playtest: "I jump to catch the shield but the jump finishes without a slam." On its way out the shield runs from the leap at 600 px/s, so a leap aimed at it always landed 70-200 px short; only the returning shield (which homes onto you) could be caught. Now a leap aimed at an outgoing shield (cursor within 100 px of it, landing within 220 px) stops it in mid-air and it drifts to where you land. Tested: leaping at the shield's position 0.1-1.5 s after the throw, out or back, gives a Skyfall every time.
- **Dragonknight, Rebound** (Q → E → held LMB; the user's design, kept alongside Skyfall, with strict timing by the user's choice): a full Dragonfire slam whose reach and arc (200 px, ±50° plus a little) take in the returning shield bats it back out along the swing, burning and faster (1100 px/s). It ricochets between enemies for 4 hits of a Shield Throw each and sets them burning (off a lone boss it glances away and comes back), then flies home and is caught as usual. First the slam fired itself when full, so the hold had to start about 0.8 s before the shield arrived (a ~0.2 s window to start the hold); playtest: "really almost impossible to pull off". Now the slam strikes on release and a full charge waits, so you charge early and release as the shield comes into reach (~0.2 s while it crosses 200 px, but you can watch it come). Tested: 4 batted hits of 18-19 (one Shield Throw hit each) bouncing between two slimes, or all 4 on a lone one; no Dragonfire, no bat. Model: +4 Shield Throw hits per Dragonfire (12 s), ~+5% when you land it.
  - Then the slam was changed to strike on release (a full charge waits), which made it feasible. Playtest: "very hard to pull off, insanely satisfying to do so. Perfect."
- **Dragonknight, Wyrmfall** (Space → R, mid-leap only, both the user's picks; a 4th combo per class is the new goal, "some less, some more"): Dragon Breath cast during Thunder Leap is breathed straight down when you land: a column of fire slams onto the knight, then 3 rings of fire roll out over the ground 0.35 s apart (300 px; each hits an enemy once as it passes, ×0.45 and the breath's burn), and the ground under you burns 140 px wide for 3 s (×0.3/s, drawn as breath scorch marks). Frost breath slows everything the rings pass instead of burning; Shatter breaks shields. It doesn't spend the landing window, so Wyrm Whirl still follows. R on the ground, even in the landing window, is the normal cone. Measured (total damage, rank 1): one big target 68 (cone 138), a pack of 6 all round you 409 (cone 138, it only reaches one), a pack of 6 in front 327 (cone 434). A swarm tool that costs boss damage: a choice, not a gain. The first version had the head turn 2 circles breathing a spiral of flame (playtest: "it looks a bit goofy"); the user picked the rings.
- **Ranger, Volley combos** (the user's picks: "their E could be integrated as well"). Volley's arrows go skyward for 0.3 s, then fall, each landing 0.45-0.8 s after the cast; a combo changes only the arrows still coming down, so the earlier in that window, the more it catches (too early does nothing). Volley measured at **23% of the Ranger's damage** (dummy, late: 507 DPS, 390 without Volley), so the multipliers are kept small for the top class: ~+5% each used on every Volley, ~+11% both.
  - **Gale Volley** (R → E): Nature's Stride cast while the arrows fall: the gust drives each one in again 0.3 s after it lands, for a quarter of what it dealt (half was proposed; trimmed for the Ranger's place at the top). Playtest: "should be more noticeable", so now bold white-and-green wind ribbons whirl round it until the last arrow is driven in, and each second strike is a white streak down with a ring of wind and a second arrow left stuck in the ground.
  - **Thunderstorm** (R → Q): a **fully drawn** Storm Arrow (playtest: "charging it, pressing R, releasing at the right moment takes skill; shooting a blank Q into the R not so much"; a Skyline Shot counts) whose line crosses the Volley circle while the arrows fall turns every arrow still coming down into a lightning bolt: ×1.2, a 0.5 s stun on non-bosses, and the reticle turns electric blue. Hold Q, cast R, release in the window (or Skyline from a Vault).
  - Tested on a boss dummy (rank 1): Volley 82.8; Gale at 0.35 s 103.5 (+25%), at 0.1 s nothing, at 0.7 s 86.4 (the last arrows only); Thunderstorm 99.4 (×1.2) plus the Storm Arrow's own 90; a Storm Arrow missing the circle nothing, a half-drawn one through it nothing; both 124 (×1.5). Small enemies were stunned.
- **Ranger, Gale line cut** (playtest: "lose the line between R and the player and it's perfect"): the gust no longer draws a line from the Ranger to the circle.
- **Spellweaver, Frostfire** (R → E; the user picked only this one of three: Stoked Meteor, a Fireball fed into the falling Meteor, and Shatter, Fireball on Nova-chilled enemies, were passed over): Frost Nova cast within 0.25 s of your Meteor landing, before or after, with the impact inside the Nova's 180 px, turns the impact to frostfire: ×0.3 more of the Meteor's damage to everything in the blast and a 1 s freeze (bosses shake it off 3× as fast, ~0.33 s). Ice crystals burst out of the impact with steam. Timing plus risk: you stand at your own impact. Small gain on purpose (the Spellweaver is at the top); the freeze is the prize. Tested (rank 1): Meteor 86.4; Nova 0.2 s before, at, or 0.2 s after the impact 126.7 and frozen (Meteor + Nova + 25.9 frostfire); 0.4 s off either way 100.8, no freeze; from 300 px away nothing.
- **Spellweaver, Ice Wall** (RMB → E; "I still want some utility for the Spellweaver". Blink → Nova was proposed; the user moved it to the rare weapon's Arcane Beam "so it's available after the rare weapon"): Frost Nova cast within 0.75 s of Arcane Beam freezes the beam's 500 px line into a wall of ice for 3 s, grown out from the staff. Enemies can't walk through it (the hero can) and touching it chills them 60%; enemy shots shatter on it, but 12 break it (a bullet hell gets a moment's cover, not 3 s); a boss smashes through and ends it. No damage, pure zoning. Tested: a chasing pack was held on the far side (closest at x 825 against a wall at 800) and slowed, then crossed once it melted; a Nova 1 s after the beam made no wall; 5 shots stopped, 13 broke it; a boss touching it broke it.
  - Playtest: "Simple enough, I like it. The Spellweaver already has enough ways to deal damage."
- **Machinist, round two** ("still hard: not really comboable skills"; the user picked three of four: Tesla Turret, Lightning Rod, Conductive Net; Turret Toss, grappling onto a turret and throwing it with Q, was passed over). The Machinist trails, so these may add damage. Base numbers: a scattergun blast ~27 with every pellet in, a coil ~20/s on a target in its field, a turret 12.5/s.
  - **Tesla Turret** (Q + E, either order): a Tesla Coil placed within 60 px of a turret electrifies it while the coil lasts: its shots hit ×1.15 and arc on to one more enemy within 250 px for half a shot; small arcs crackle between the two. About +4-5% when kept up. Tested: the turret's target 30.0 → 34.5, a neighbour 0 → 15.0, both orders.
  - **Conductive Net** (RMB → E, the rare weapon's Net Shot): a coil thrown within 80 px of an enemy the net hit in the last 1.5 s latches onto the net and rides on that enemy for the rest of its life (bosses too), pulsing round it; if it dies, the coil stays where it fell. The window counts from the net's hit, not the net's own timer, because bosses shake the net off 3× as fast (~0.67 s). A coil that follows a boss. Tested: no latch on an un-netted enemy; latched, and still on the enemy after the net ran out and it moved 450 px, pulsing.
  - **Lightning Rod** (E → R): Overclock cast standing inside your own coil's field absorbs the coil (it's gone): until Overclock ends, every scattergun blast also throws chain lightning at the nearest enemy ahead (350 px, ±0.6 rad), ×0.6 a basic, jumping to 2 more within 200 px. Roughly even with the coil's lost pulses on a lone boss (~80 lost against ~85 gained), clearly better on a pack. Tested: each blast added 3.6 to each of three slimes; it ended with Overclock; Overclock away from the coil did nothing.
- **Paladin, round two** (the user picked three of four: Flail Sweep, Ring the Hammer, Zealous Charge; Chain Recall, the hammer recalled down a shackle chain, was passed over). The Paladin trails (~84-88% of the Ranger), so these may add damage. The code is in paladin.js with the rest of the Paladin.
  - **Flail Sweep** (Q recall while Divine Tether chains you to the planted hammer): the hammer tears out and whips round you on the chain **twice in 0.8 s**, at the chain's length (120-300 px). Each pass the head hits ×1.75 the hammer (×3.5 over both) and throws non-bosses 110 px outward with a 0.6 s stun; the chain hits everything inside the circle for ×0.5 a pass; then it's reeled into your hand as a clean catch (Q at 1.2 s). A bigger hammer, a wide golden arc sweeping behind it and the swept circle faintly lit. First version: one pass at ×1.5 that only hit a thin ring at the chain's end, with no visual of its own (playtest: "too weak and doesn't really do anything; the idea is cool but the implementation lacks"). Tested: a boss on the circle 115.5 (both passes), a slime on the circle 57.8 and flung to 340 px, enemies inside the circle 33-38 from the chain; hammer in hand afterwards.
  - **Ring the Hammer** (a shield bash that strikes your own planted hammer): it rings like a bell and fires its pulse at once, ×3 a pulse (×0.75 the hammer) in 200 px with a 0.5 s stun on non-bosses, at most every 3 s (×4 every 2 s modelled at ~+25% for the class, too much; this is ~+8-10% fighting beside the hammer). Tested: three enemies by the hammer 24.8 each and stunned; again 0.5 s later nothing; a bash facing away nothing.
  - **Zealous Charge** (R → Space): Righteous Charge or Iron Pull starting inside your Consecrated Wrath drags holy fire along its path: a 3 s burning strip, 45 px each side, ×0.5 the Wrath's damage per second. Tested: a 260 px strip after a charge out of Wrath; none without Wrath. Playtest: "needs better visuals" (it was a flat glowing band), so it now wears Consecrated Wrath's own look: soft gold ground, the same white-gold flame tongues and rising motes, holy sigils down the middle, catching fire from the start of the charge to the end.
- **Druid, round two** ("I feel like the RMB could be utilized here as well"; the user picked Barkburst, Pincer and Thorn Rake; Primal Roar, spirits mirroring the claws, was passed over). The code is in druid.js.
  - **Pincer** (Thistle-Grip Claws on the companion's prey from the far side: you and the beast 120°+ apart round it): the claws hit ×2 and root it 1 s (bosses too, shaken off 3× as fast), and the companion's next bite is a free Maul that doesn't spend Bond. Positioning with the companion. Tested: 48.0 against 24.0 from the beast's side, root 1 s, the next bite a Maul and Bond kept at 30.
  - **Thorn Rake** (Q → RMB: claws on enemies Bramble Snare still roots; the snare stamps `snaredAt`): ×2 claws and a bleed of ×1 the claws over 3 s, with the brambles torn out in a burst of leaves. Tested: 48.0 each on two snared enemies (24.0 unsnared), bleeding after; 1.5 s after the snare (root over) a plain 24.0.
  - **Barkburst** (E → Space: Spirit Leap during Feral Surge): on landing the bark shell bursts into splinters (×1 the leap in 150 px) and regrows to full, once per Surge. Survival for the caster, no rare weapon needed. Tested: a leap in Surge added the splinters' 27 and regrew the shell from 10 to 120; a second leap in the same Surge didn't.
- **Cleric, round two** (reviewed before the hardest classes; the user picked Prism, Sanctified Arrival and Twilight Eclipse; Ascendant Descent, a Phase Shift during Ascension landing as a pillar of light, was passed over).
  - **Prism** (E → Q): Divine Ray crossing your own Hallowed Ground refracts where it leaves the zone: two smaller rays (the ray's own look, 60% as wide) fan out from that point ±30°, 450 px, at half a tick each; Holy ones blind, Shadow ones slow. They start at the zone's far edge, not its centre, so a boss standing in the zone doesn't simply take double. Available from the first levels, which helps the Cleric's weak start. Tested: an enemy on a side beam 41.3 (half the main ray's 82.7), nothing without the zone; an enemy at the zone's centre 82.7 either way.
  - **Sanctified Arrival** (E → Space): Phase Shift landing inside your own Hallowed Ground makes it erupt, once per zone. Holy and the plain zone: heals 10% max HP and throws non-bosses out of it. Shadow (Desecration): a nova for ×2 a Desecration tick that blinds for 1 s. Tested: healed 12 (10%) and the enemy thrown to 192 px from the centre; Shadow 25.2 and blinded; a second arrival in the same zone nothing.
  - **Twilight Eclipse** (RMB → Q): enemies Twilight Repulse stunned take ×1.5 from Divine Ray for 1.6 s, so a ray cast right after is eclipsed for its whole channel (the 1 s stun alone covered two thirds of it, ~+19%). Bosses aren't stunned by the Repulse, so they don't count. Tested: a ray alone 124, right after the Repulse 186 (the Repulse's own hit included).
- **Nightblade and Kensei, round two** ("really hard to design even more: they already got very heavy skill expression"): these deepen what the classes already ask for instead of adding a layer.
  - **Nightblade, Shadow Strike** (R + Space): while Mark for Death runs, a Phantom Dash straight through the marked target is an extra clone strike: ×0.6 the Mark from a fresh weak side facing where you came in, so it always pops; up to twice per Mark (Bloodlust heals 2% for it, like a clone's). You weave your strikes between the clones' and pass through the boss to do it. Tested on a boss dummy: the Mark alone 745, with three dashes through 1007 (two counted).
  - **Nightblade, Smoke Step** (E → Space): a Phantom Dash that starts inside your Smoke Bomb carries the cloud to where you land (it glides after you). Swarm survival, no damage. Tested: the cloud ended on the hero after the dash; a dash from outside it left it in place.
  - **Kensei, Counter Step** (parry → Space → LMB; it was going to be Riposte Step, renamed because the E evolution is Riposte Recall): a successful parry readies Shadow Step at once, and a Shadow Step within 1.5 s makes its Iaido cut ×1.5. Tested: Shadow Step's cooldown 4 → 0 on the parry, Iaido 17.3 → 25.9.
  - **Kensei, Return Cut** (Airborne E, the recall): every recall now cuts back through everything between the blade and you, for ×3 a basic times the Flow it spends (nothing at empty). **Riposte Recall** (E-A), which used to be the only recall that cut (a flat ×2 basic), now cuts as if your Flow were full and still keeps 30%; its text says so. Tested: 25.9 at 100 Flow, 13.0 at 50, nothing at 0.
  - **Kensei, Whirling Orbit** (Guardian Orbit → Q, the user's idea): Q during the orbit spins it twice as fast for the rest of it and 0.3 s longer, instead of Blade Surge, so press it early. Measured on a boss dummy at full Flow: a plain orbit 344, whirled 664 (+320), a Blade Surge 264. (+0.6 s made it +458, ~70% over a Surge; no extension +183, less than a Surge.)
  - **Kensei, Gale Orbit** (Guardian Orbit → RMB, the user's pick over Hammer & Anvil and Wind Step): Phantom Wind during the orbit flings it wide: the circle grows to 250 px for the rest of the orbit and cuts a ring rather than the whole disc; shots entering the circle are still cut down. Tested: radius 250, an enemy 220 px out cut for 115.
  - **Kensei, Gathering Gale** (Shadow Step → R → Q, in hand; the user's design and pick of the three readings): R cast in Shadow Step's window doesn't storm round you, the blades gather in front of you (ghost katanas wheeling); Q within 1 s releases them: you dash forward 260 px and a hurricane flies on ahead down that line for 650 px, cutting what it passes every 0.15 s for ×0.5 the R, carrying non-bosses along, +10 Flow per enemy it catches, and bursting at the end (×0.8 in 160 px). No Q in time: the storm breaks round you as a plain Blade Whirlwind. Tested in the Training Room: a target dummy on the line took 143 and was carried 408 px; a boss dummy at the end 99 (a plain whirlwind on it: 65); no Q: the plain storm; R outside the window: the plain storm.
- **Ranger, Skyline Shot** (Space → Q): Q pressed during Vault or in the window after it looses Storm Arrow fully drawn at once, ×1.25 (its follow-up strike too), skipping the 1.2 s slowed draw. It spends the window, so it's Arrow Trail or Skyline, never both: ~+37 base on the arrow plus ~30 of basics in the saved draw, against Arrow Trail's ~60 on a boss you vault away from (3 arrows) and much more on a pack you jump over. Single target from the air, or the pack. `COMBO_SKILLS` in combos.js (main.js keydown, before the hold-to-draw starts). Tested: 125 + 62.5 raw against 100 + 50 for a normal full draw, no window after a mid-air one, no trail after a Q in the window, and a Q with no window still starts the normal draw.

Sections:
1. [Core formulas](#1-core-formulas)
2. [Progression: XP, waves, loot, shop](#2-progression-xp-waves-loot-shop)
3. [Classes overview](#3-classes-overview)
4. [Class details (skills, upgrades, rares)](#4-class-details)
5. [Class rare items](#5-class-rare-items)
6. [Slime Caves: stages, hazards, enemies, bosses](#6-slime-caves)
7. [Bandit Bastion](#7-bandit-bastion)
8. [Balance observations](#8-balance-observations)
9. [Bugs and mismatches found while reading](#9-bugs-and-mismatches-found-while-reading)

---

## 1. Core formulas

### Player damage: Power (`calcDmg`, `powerParts` in [combat.js](js/combat.js))

Since the Dragonknight playtest every damage source adds into one number, **Power** (100 = ×1). The Tab sheet lists its parts, the inventory shows it, items say "+50 Power", and level-up cards and the Tab sheet show the real hit (`hitDmg`, after the ×0.6).

```
scaledBase = baseDmg × (1 + 0.2 × (rank − 1))          rank 1/2/3/4 = ×1.0 / 1.2 / 1.4 / 1.6
Power      = class dmgMult                              (100 for most classes; Spellweaver/Kensei 120, Paladin 110, Nightblade 150)
           + weapon.val                                 common weapon = 0.05 + tier × 0.10, rare weapon = 0.50 → 0.90 (awakening)
           + Dragonknight: 0.02 × Frenzy stacks         (max +0.20, +0.30 with the Wyrmheart Pendant)
           + Ranger: momentum                           (max +0.20)
           + Cleric: +0.50 Aspect of the Reaper, +0.25 base Ascension
           + orbDmg                                     +0.04 per power orb, max +0.80
           + bonusDmg                                   +0.05 per blessing (level-ups after every skill is mastered), no cap
damage     = scaledBase × Power
           × 0.7 if the player is Weakened (standing in an enemy spore cloud)
```

Before, orbs and blessings multiplied everything else (`× (1 + bonusDmg + orbDmg)`). Adding them instead would have cut late damage by ~16%, so the orbs were doubled (+2% → +4, cap +40% → +80): early, mid and late damage stay within ~3% of the band pass.

Then `applyDamage` ([combat.js](js/combat.js)) applies:
- **×0.6 global player-damage reduction** on everything (`HIT_SCALE`).
- ×2.0 if the enemy `isStaggered` (only Valerius uses this).
- ~~Ranger with Barbed Tips: non-magic, non-DoT hits deal ×1.2~~ (removed in pass 3).

Basic attacks use `calcDmg(basicDmg, 1)`: basics never scale with rank, only with Power.

Since pass 3, every damaging skill goes through `calcDmg`. Right-click abilities use `calcDmg(base)` with no rank (they have none). Weak-point true damage goes through `calcDmg` but skips the ×0.6.

### Damage taken (`takeDamage`, [combat.js:151](js/combat.js#L151))

Order of operations:
1. **×0.6 global enemy-damage reduction.**
2. Kensei parry window: blocks the hit completely.
3. i-frames, Evade (Nightblade's Cowl), Smoke Bomb (50% evade while inside).
4. Class armors (`itemsDamageTaken`): Dragon Scale Plate ×0.85 while shielded, Robes of the Magi ×0.75 while holding Resonance, Windrunner Tunic dodges a hit at full Momentum.
5. Hazard Suit: ignores continuous damage and any hit below 5.
6. Cleric Vestments (Holy): ×0.85 on projectiles and reflects them.
7. Paladin: ×0.8 inside Bastion Dome, Gilded Plate up to −25%, armor ×1.15 while the hammer is away.
8. **Armor: `max(1, amount × (1 − armor / (armor + 20)))`, hits only.** Continuous damage (puddles, wading, links, tethers) ignores armor. By class: Paladin 6 = 23% (6.9 = 26% with the hammer away), Dragonknight 5 = 20%, Machinist/Druid 3 = 13%, Ranger/Cleric 2 = 9%, Nightblade/Kensei 1 = 5%, Spellweaver 0%.
9. Shield absorbs, then HP. Every shield goes through `addShield` ([combat.js](js/combat.js)): stacked shields stop at **50% of max HP**, but a single shield bigger than that still lands whole (Feral Surge, Ice Barrier on a low-HP class). It refreshes the timer to the longer of the two.

### Cooldowns

- Skill cooldown = `maxCd × getCDR()`.
- **Only slot 3 (Space) and the Kensei's E** also get rank scaling: `maxCd × max(0.4, 1 − 0.15 × (rank − 1))` → rank 2/3/4 = ×0.85 / 0.70 / 0.55 (`skillBaseCd` in [combat.js](js/combat.js)).
- `getCDR()` = 1 − the amulet's val (commons 6-20%, class rares 20%) − 0.50 (Cleric Aspect of the Reaper), **floored at 0.4** (60% max CDR).
- **Basic attack cooldown** = `0.15 + basicAttackCD / (1 + gloves.val [+ Kensei airborne Flow bonus up to 0.5])`. CDR doesn't affect it.
- Right-click (rare weapon) cooldown: **4 s × getCDR()** for every class.

### Healing sources (all classes)

| Source | Amount |
|---|---|
| Start of each wave | +30% max HP |
| HP orb (10% of non-boss kills) | +25% max HP |
| Berserker Gauntlets / Gauntlets of Devotion | 1% max HP per enemy hit by a basic, max 3% (Dragonknight at 10+ Frenzy / Paladin hammer in hand) |
| Class-specific | see each class |

---

## 2. Progression: XP, waves, loot, shop

### Waves ([main.js:47](js/main.js#L47))

- Normal wave: `3 + floor(2.5 × wave)` enemies. Boss wave (every 5th): 4 minions, then the boss.
- Spawn interval: `max(0.5, 2.0 − 0.1 × wave)` seconds.
- Minion stats: `hp = baseHp + wave × hpScale`, `dmg = baseDmg + wave × dmgScale`, `xp = baseXp + wave × xpScale`, `speed = baseSpeed + rand × speedVar + wave × 2.5`.
- Boss stats: `hp = baseHp + wave × hpScale`, `dmg = baseDmg + wave × dmgScale`, `speed = baseSpeed + wave × 2`, `xp = baseXp`.
- Stage by wave: 1-5 = stage 1, 6-10 = stage 2, 11-15 = stage 3.
- Enemy contact hits land at most once per 1.0 s per enemy.

### XP and levels ([combat.js:247](js/combat.js#L247))

- Level 2 needs 50 XP, and each next level needs ×1.5 (floored): 50, 75, 112, 168, 252, 378, 567, 850, 1275, 1912, 2868, 4302, 6453…
- One skill point per level, plus 1 at the start (the starting-skill pick).
- R unlocks at Lv. 5 for normal level-ups. The starting pick bypasses this (known, intentional for testing).
- With all skills at rank 4, a level-up offers a **blessing: +20 max HP, +5 Power**.
- The Paladin starts with Judgment Hammer at rank 1 (one free point). The Druid no longer does (its wolf is the passive).

### Expected run in the Slime Caves (computed from the spawn formula, regular kills only)

Extra XP from eggs, guards, Amalgam minions (all 0 XP) and brood pods (4 + wave each) is not included.

| Wave | Enemies | Wave XP | Level after | Kills so far | Drop tier | Shop tier |
|---|---|---|---|---|---|---|
| 1 | 5 | 63 | 2 | 5 | T1 | – |
| 2 | 8 | 117 | 3 | 13 | T1 | – |
| 3 | 10 | 166 | 4 | 23 | T2 | – |
| 4 | 13 | 242 | 5 | 36 | T2 | – |
| 5 (King) | 4 + boss | 282 | 6 | 41 | T3 | **T4 (shop opens)** |
| 6 | 18 | 605 | 7 | 59 | T3 | – |
| 7 | 20 | 732 | 8 | 79 | T4 | – |
| 8 | 23 | 911 | 9 | 102 | T4 | – |
| 9 | 25 | 1065 | 10 | 127 | T5 | – |
| 10 (Amalgam) | 4 + boss | 582 | 10 | 132 | T5 | **T6 (shop opens)** |
| 11 | 30 | 2292 | 11 | 162 | T6 | – |
| 12 | 33 | 2675 | 12 | 195 | T6 | – |
| 13 | 35 | 2999 | 12 | 230 | T7 | – |
| 14 | 38 | 3433 | 13 | 268 | T7 | – |
| 15 (Queen) | 4 + boss | 1380 | 13 | 273 | T8 | – |

So a full run ends around **Lv. 13 with 13 skill points**: 16 ranks are needed to master all four skills (15 for the Paladin), so players finish with most skills evolved but not all.

### Drops ([combat.js:285](js/combat.js#L285), [items.json](data/items.json))

Per non-boss kill, one roll:

| Roll | Chance | Effect |
|---|---|---|
| Item | 8% (was 18%) | `generateItem(wave)`: tier = `ceil(wave / 2)` |
| Orb | 20% | half HP orb (+25% max HP), half **power orb (+4 Power, permanent, max +80)** |
| Gold | 30% | `5 + wave` gold |
| Nothing | 32% | |

- Bosses: 1 item of `generateItem(wave + 2)` and 5 gold piles of `20 + 2 × wave`.
- Machinist: separate 25% Scrap roll on every kill.
- **Every drop on the floor is auto-collected when the wave ends**, so orbs and items are never missed.
- Expected power orbs: ~10% of kills → about **+16 Power by wave 5, +52 by wave 10**, and the +80 cap (20 orbs) around wave 12-13. This is multiplicative with everything else.

### Common items

`val = valBase + tier × valMult`. T8 (the last drop tier of a normal run) matches the class rare's stat; the rare adds its unique effect on top.

| Slot | Formula | T1 | T4 | T6 | T8 | Rare |
|---|---|---|---|---|---|---|
| Weapon (added to dmgMult) | 5% + 10%/tier | +15% | +45% | +65% | +85% | +100% |
| Armor (× class factor, below) | 20 + 25/tier | 45 | 120 | 170 | 220 | 240 |
| Amulet | 4% + 2%/tier CDR | 6% | 12% | 16% | 20% | 20% |
| Boots | 10 + 5/tier move speed | 15 | 30 | 40 | 50 | 50 |
| Gloves | 5% + 2.5%/tier attack speed | 7.5% | 15% | 20% | 25% | 25% |

Price `tier × 25`, sells for a fifth (`SELL_RATE` in ui.js; was half). Base move speed 250 for everyone. In Limitless mode tiers keep climbing past T8, so commons eventually pass the rares there.

### Shop ([ui.js:154](js/ui.js#L154))

- Opens only after a boss wave: **after wave 5 and after wave 10** in a normal run.
- Stock: 3 common items at `generateItem(wave + 2)` (T4 at wave 5, T6 at wave 10), plus all 5 of the class's rares every visit.
- Rare prices: weapon 250, armor 250, amulet 250, boots 200, gloves 200 (1150 for the set; was 950).
- Gold model (Slime Caves, regular kills + boss gold + selling every drop): ~295 at shop 1 and ~1000 in total by shop 2, so a run buys the weapon and about three more rares and has to choose what to skip. Before: ~460 and ~1900 (≈1100 from selling ~25 drops), enough for the whole set.
- Shop rares carry fixed `val`s: weapon 0.5 (+50% damage, awakening +4% per wave cleared after purchase, up to +90%), armor 240 HP, amulet 0.20, boots 50, gloves 0.25. Boots and gloves can be overridden per class with `val` in classes.json (the Kensei's are).

---

## 3. Classes overview

Basic DPS = `basicDmg × dmgMult × hits per attack / (basicAttackCD + 0.15)`, single target, no gear, before the ×0.6.

| Class | HP | Armor | dmgMult | Basic dmg | Basic CD | Basic DPS | Basic attack |
|---|---|---|---|---|---|---|---|
| Dragonknight | 200 | 5 | 1.0 | 15 | 0.40 | 27.3 (37.3 at 10 Frenzy) | 130 px slash, 120° cone |
| Spellweaver | 100 | 0 | 1.2 | 10 | 0.30 | 26.7 (×2 + 80 px AoE per Resonance charge) | bolt; explodes only with Resonance |
| Ranger | 120 | 2 | 1.0 | 10 | 0.25 | 25.0 (30.0 with Momentum) | arrow, 1000 speed, 9 px, aim assist |
| Nightblade | 80 | 1 | 1.5 | 12 | 0.30 | 40.0 (2 thrusts × 0.5) | double thrust, 90 px |
| Machinist | 140 | 3 | 1.0 | 10 | 0.40 | 40.9 point-blank (9 pellets × 0.25) | scattergun, short range |
| Kensei | 100 | 1 | 1.2 | 12 | 0.30 | 37.3 (56 at full Flow) | 3-hit combo, cone |
| Cleric | 120 | 2 | 1.0 | 14 | 0.40 | 25.5, pierces | censer pulse, ~400 px |
| Druid | 120 | 3 | 1.0 | 12 | 0.35 | 24, plus the wolf's 18.75 (15 per bite every 0.8 s) | seed bolt; the wolf bites on its own |
| Paladin | 170 | 6 | 1.1 | 14 | 0.35 | 30.8, cone + stagger | 140 px 120° smash |

Passives at a glance:
- **Dragonknight, Greatsword and Frenzy:** tap LMB for a light swing, hold it for an overhead slam (×3.5 at full charge, 0.8 s, faster with attack speed). Melee hits give +2 Power and +2% attack speed per stack (max 10). After 3 s without a melee hit, stacks drain one every 0.5 s.
- **Spellweaver, Arcane Resonance:** each spell stores a charge (max 3). Each basic spends one: ×1.8 damage (×2 before Blink Lance), an 80 px explosion, and a hit cuts 0.25 s off Q, E and Space.
- **Ranger, Fleetfoot:** +10% damage and move speed per second of movement, max +20%. Standing still keeps it 1 s, then it drains over 2 s.
- **Nightblade, Expose Weakness:** every 3 s, marks 1-3 unmarked enemies within 400 px with a weak-point side, the biggest first (a boss always gets one). Weak points on a boss deal ×1.5 (`BOSS_WEAK_MULT`).
- **Machinist, Salvage Economy:** 25% Scrap per kill; Scrap heals 5 HP and is stored (max 20). Holding Q spends it: 0.4 s → Heavy Turret (5, ×1.5), 0.9 s → Siege Turret (10, ×2).
- **Kensei, Flow & Stance:** Handheld builds Flow, Airborne spends it.
- **Cleric, Zeal:** basics build Zeal, spells spend it and get stronger at 50 and 100 (Divine Ray ×1.75 / ×2.5 damage).
- **Druid, Wild Bond:** a wolf hunts at your side, going after what you hit (Scent) and pouncing on what you snare. Its bites on Scented prey build Bond; at 100 the next bite is a Maul (×4, stun).
- **Paladin, Celestial Anchor:** the hammer is either in hand or planted, and the skills change with it.

---

## 4. Class details

Skill damage numbers below are `baseDmg` before `calcDmg` (so ×1.6 at rank 4, × Power / 100, × 0.6). "×N" means N times the skill's computed damage.

### Dragonknight (`skills.js` → `'Dragonknight'`)

| Slot | Skill | CD | Base | What it does |
|---|---|---|---|---|
| LMB | Greatsword | 0.4 / hold | 15 | **Tap:** light swing, 130 px 120° arc, cooldown `0.15 + 0.4 / (1 + attack speed)`. **Hold:** the blade goes up over the shoulder (20% slower movement) and charges for 0.8 s (÷ (1 + attack speed)); release to strike; a full charge waits for the release (it used to fly by itself when full, which made Rebound nearly impossible to time). Damage `×(1 + 2.5 × k²)` for charge k, reach 130 → 170 px, ±50°; 0.25 s recovery. **Full slam:** ×3.5, a shockwave at the impact point (85 px, ×0.5 to what the edge missed), 0.3 s stagger on non-bosses, +1 extra Frenzy. A click during the cooldown is buffered. (`updateHeavySwing`, skills.js) |
| Q | Shield Throw | 4 | 18 | Piercing shield, 600 speed. After ~1 s (or at a wall/map edge) it homes back to you at 900 speed, hitting again on the way, and is caught on contact: a shield of 50 (×1.2/rank) for 5 s (×1.2/rank). |
| E | Dragonfire Blade | 12 | 12 | For 6 s: basics deal +50% (+10% per rank, +80% at rank 4), reach 30 px farther, and set what they hit burning (×0.3 of this skill per second for 3 s, refreshes). |
| Space | Thunder Leap | 6 | 20 | Leap up to 400 px, ×1 in 120 px on landing and a 0.5 s stun on non-bosses. |
| R | Dragon Breath | 12 | 38 | 21 piercing flames over ~1 s, ×0.25 each, following the cursor. Everything touched burns for ×0.2/s for 3 s (refreshes, doesn't stack). A boss that eats every flame takes ×5.25 + ×0.6 burn. |
| RMB | Wyrm Strike | 4 | 80 (unranked) | 150 px 120° cone. |

Upgrades:
- Q-A **Explosive Impact:** each hit also splashes ×0.5 in 60 px.
- Q-B **Aegis Catch:** the catch shield goes from 50 to 100 base.
- E-A **Inferno Edge:** while the blade burns, every full slam erupts in a 150 px ring of fire around you for ×1 that sets everything in it burning.
- E-B **Wyrmblood:** while the blade burns, each enemy a basic hits gives a shield of 5 (×1.2/rank, up to 3 enemies per swing, capped like every shield), and a swing that connects heals 1% max HP.
- Space-A **Aftershock:** a zone that detonates for ×1.5 in 100 px after 1 s.
- Space-B **Shrapnel Landing:** 4 shards of ×1 each.
- R-A **Glacial Breath:** 70% slow for 3 s on enemies in a 400 px, ±0.4 rad cone.
- R-B **Shatter Breath:** breaks shields in that cone (`shatterShields`): Bandit shields, Valerius, and every Slime Warden orb.

Rares:
- **Wyrmbane Greatsword:** +50→90% damage, Wyrm Strike.
- **Dragon Scale Plate:** +240 HP; while a shield holds, hits are ×0.85 and each gives +1 Frenzy.

### Spellweaver

| Slot | Skill | CD | Base | What it does |
|---|---|---|---|---|
| Q | Fireball | 2 | 25 | 500 speed, explodes for ×1 in 70 px. |
| E | Frost Nova | 5 | 20 | ×1 in 180 px, 60% slow for 3 s. |
| Space | Blink | 4 | 25 | Instant teleport up to 350 px. Deals no damage without an upgrade. **Finisher (combos.js): Blink Lance**, the bolt after Blink becomes an instant lance along the line you blinked (30 px wide), ×3 the bolt to everything you passed through. Blink stores a Resonance charge, so it's nearly always a charged lance (×1.8 × 3), and a hit gives the usual cooldown refund. |
| R | Meteor | 10 | 120 | Lands after 1.0 s, ×1 in 150 px, leaves a scorch (visual). |
| RMB | Arcane Beam | 4 | 120 (unranked) | 500 px line, 20 px wide, hits everything on it. |

- **Basic bolts hit one target. Each spell stores a Resonance charge (max 3; constants at the top of the weave helpers in [skills.js](js/skills.js)). A charged bolt deals ×2 and explodes for full damage in 80 px, and its first hit cuts 0.25 s off Q, E and Space.** Robes of the Magi makes every bolt pierce (charged bolts explode on each enemy they pass, but refund only once).

Upgrades:
- Q-A **Velocity:** 800 speed, and each Fireball stores 2 Resonance charges.
- Q-B **Scorched Earth:** explosion grows to 100 px and leaves fire for 0.75 s at ×0.5 per second.
- E-A **Deep Freeze:** frozen solid for 3 s, bosses included.
- E-B **Ice Barrier:** shield 60 (×1.2/rank) for 5 s.
- Space-A **Arcane Arrival:** missile at the nearest enemy for ×1.2.
- Space-B **Frost Departure:** ×1 in 100 px at the start point, 60% slow for 2 s.
- R-A **Accelerated Drop:** 0.75 s delay, and the impact fills Resonance to 3.
- R-B **Echo Blast:** second blast for ×0.5 in 80 px after 1.5 s.

Rares:
- **Archmagus Staff:** +50→90%, Arcane Beam.
- **Robes of the Magi:** +240 HP; a mana ward: while you hold Resonance, hits are ×0.75, and one over 15 damage (before armor) spends a charge. (It used to make basics pierce, which switched off charged explosions.)

### Ranger

| Slot | Skill | CD | Base | What it does |
|---|---|---|---|---|
| Q | Storm Arrow | 3 (starts on release) | 100 | **Hold** to draw for up to 1.2 s (you move at 70% speed and can't fire basics), **release** to fire. Instantly hits everything on a 1000 px line (rock stops it): 40% damage on a tap, 100% fully drawn, 14 → 30 px wide. 0.4 s later the streak strikes the same line again for half damage. The charge is lost on pause, cutscenes, map changes or losing window focus. |
| E | Nature's Stride | 8 | 0 | Heal 15 (×1.2/rank) and +50% move speed for 2 s (×1.2/rank). |
| Space | Vault | 5 | 30 | Hop up to 300 px. The base version deals no damage. |
| R | Volley | 10 | 30 | 10 arrows rain over 110 px around the cursor (max 500 px away), landing 0.45-0.8 s later. The arrows are shared out over the enemies inside the circle at cast (not pods or slimes still forming) and follow them until they land; with nobody inside they scatter evenly. Each arrow deals ×1 to everything within 24 px + half the enemy's size, but per volley only the first arrow on an enemy deals full damage, later ones ×0.4 (`VOLLEY_FALLOFF`). A lone target takes ×4.6 (×7.8 with Rain of Arrows). |
| RMB | Chain Lightning | 4 | 40 (unranked) | Three lightning bolts in a ±0.22 rad fan, 1100 speed. Each jumps to the nearest enemy within 400 px it hasn't hit, 3 times (up to 12 hits). The middle bolt uses the aim assist. |

Upgrades:
- Q-A **Quickdraw:** full draw in 0.6 s, and no slow while drawing.
- Q-B **Thunderhead:** the follow-up strike deals 100% instead of 50%, and stuns non-bosses on the line for 0.5 s.
- E-A **Mending Winds:** heal 30 base.
- E-B **Tailwind:** 4 s of speed.
- Space-A **Parting Shot:** ×1 arrow at the nearest enemy from the top of the jump.
- Space-B **Acrobatics:** 500 px.
- R-A **Heavy Shafts:** 36 px impacts and a 50% slow for 1 s.
- R-B **Rain of Arrows:** 18 arrows over 150 px.

Rares:
- **Stormcaller Bow:** +50→90%, Chain Lightning.
- **Windrunner Tunic:** +240 HP; at full Momentum the next hit is dodged (4 s cooldown).

### Nightblade

| Slot | Skill | CD | Base | What it does |
|---|---|---|---|---|
| Q | Fan of Knives | 3 | 5 (was 6 after the band pass, cut back as the Nightblade became a single-target class) | 5 knives in a ±0.4 rad fan, 800 speed. |
| E | Smoke Bomb | 8 | 12 | 150 px smoke for 5 s (×1.2/rank). 50% evade inside. Enemies lose track of you while you're in it. |
| Space | Phantom Dash | 4 | 5 | Dash up to 300 px, ×1 to everything passed, 0.4 s i-frames. **Finisher (combos.js): Shadow Daggers**, the thrust after the dash becomes three daggers thrown in a tight fan (±0.08 rad) toward the cursor, each a full basic (2 thrusts' worth). They're Fan of Knives daggers: they pop a weak point only if they hit its marked side. |
| R | Mark for Death | 15 | 80 | **One target**: the enemy nearest the cursor (within 150 px of it), else the nearest within 600 px; with no one in range the cast is refused. Six shadow clones strike it 0.5 s apart, each ×0.6 from a fresh weak side, so every strike pops a weak point (`death_mark` source). The mark state lasts 5 s (×1.2/rank). Was Death Mark: every enemy within 600 px, a ×3 stab each, which wiped swarms but barely touched a boss. |
| RMB | Expose | 4 | 0 | Every enemy in a 300 px, 120° cone in front of you (not pods or immune enemies) gets a weak point on the side facing you, replacing any mark it had. |

**Weak point** (`weakPointDamage` in [combat.js](js/combat.js)): a melee basic, Phantom Dash, Fan of Knives or Death Mark hit within ±60° of the mark side deals **`calcDmg(basicDmg × 3)` true damage** on top of the hit (54 at the start, ~140 late game). It skips the ×0.6, and that hit ignores blocks (Warden orbs, frontal shields, dodges) but not immunity. It also gives +50% move speed for 1 s.
- Phantom Dash-A hitting a weak point: ×3 (180).
- Phantom Dash at rank ≥ 1 hitting a weak point: refunds 50% of the dash cooldown.
- During Death Mark, each weak point pops a 100 px splash of 30 that shrinks with repeated hits (AoE resist stacks).

Upgrades:
- Q-A **Surgical Steel:** knives pierce.
- Q-B **Returning Blades:** knives come back and hit again.
- E-A **Toxic Fumes:** enemies inside take ×1/s (12/s at rank 1).
- E-B **Thick Fog:** 250 px, cleanses slow/root on cast.
- Space-A **Assassination:** 600 px dash, ×3 weak-point true damage.
- Space-B **Acrobatics:** a second charge (0.5 s recast).
- R-A **Bloodlust:** each clone strike heals 2% max HP, and weak points you pop yourself while the mark lasts heal 10% (the clones' own pops don't).
- R-B **Chain Reaction:** if the target dies, the mark and its remaining strikes jump to the nearest enemy within 300 px. A marked enemy that dies still deals `calcDmg(50, rank)` in 150 px and marks the nearest enemy.

Rares:
- **Shadowstrike Daggers:** +50→90%, Expose.
- **Nightblade's Cowl:** +240 HP; dropping below 30% HP gives 2 s of 100% evade (15 s cooldown).

### Machinist

| Slot | Skill | CD | Base | What it does |
|---|---|---|---|---|
| Q | Sentry Turret | 6 | 10 | Turret at the cursor for 10 s, range 500, shoots ×1 every 0.8 s (1.25/s). Tap for a plain turret; with Scrap, hold 0.4 s for a Heavy Turret (5 Scrap) or 0.9 s for a Siege Turret (10). Cap: 2 at ranks 1-2, 3 at ranks 3-4 (Automated Assembly's free turrets count toward it); a new turret replaces the oldest plain one, never a Heavy/Siege one. Damage is fixed at cast. |
| E | Tesla Coil | 8 | 10 | Field at up to 400 px for 8 s. Every 0.5 s: ×1 in 150 px and a 50% slow (shock) for 0.6 s. |
| Space | Magnetic Grapple | 5 | 0 | **Finisher (combos.js): Overload**, set by what you grappled onto. A turret: it fires 3× as fast for 2 s (stacks with Overclock). A Tesla Coil: it discharges a 250 px nova for 3× a pulse and a 0.5 s stun. Open ground: Point Blank, 9 tightly bunched pellets at double damage that throw enemies back 45 px. Pulls you to the cursor. +2 s cooldown unless you grapple onto a turret or coil. |
| R | Overclock Protocol | 20 | 0 | 6 s (×1.2/rank): turrets fire 1.75× as fast (2× before the band pass, 1.5× after it), scattergun pellets pierce, refreshes turret/coil lifetimes. |
| RMB | Net Shot | 4 | 10 (unranked) | Net that **roots for 2 s, bosses included**. |

- **Scattergun basic:** 9 pellets × 0.3 damage, 0.35-0.5 s life (~300-500 px), each pellet pushes non-bosses back 15 px. Against a big target at close range all 9 hit: ×2.7 per shot.
- **Scrap:** +5 HP and +1 stored Scrap (max 20), 25% per kill. Holding Q spends it: 0.9 s and 10 Scrap → Siege Turret (×2 damage, 1.5× size, 15 s), 0.4 s and 5 → Heavy Turret (×1.5, 1.25× size, 12.5 s).

Upgrades:
- Q-A **Laser Optics:** instant hit for ×1.5 every 1.0 s (1.5/s, a bit more than the base turret's 1.25/s; it doesn't pierce despite the description).
- Q-B **Volatile Casing:** ×3 in 150 px when it expires.
- E-A **High Voltage:** 200 px field, roots 1 s on entry (once per enemy per coil).
- E-B **Arc Network:** every pulse also arcs to turrets within 400 px for ×0.5 along each line.
- Space-A **Kinetic Shield:** 100-point shield (×1.2/rank) for 4 s (×1.2/rank).
- Space-B **Decoy Projection:** a 2 s decoy that eats one projectile; non-bosses within 300 px (not mid-attack) walk to it for 2 s instead of fighting.
- R-A **Nuclear Payload:** every turret detonates (Volatile ×3, 150 px) when Overclock ends.
- R-B **Automated Assembly:** 2 free turrets on cast (always plain); they count toward the cap.

Rares:
- **Underbarrel Net Gun:** +50→90%, Net Shot.
- **Hazard Suit:** +240 HP; immune to slows, continuous damage and hits under 5, and keeps you dry in the lakes.

### Kensei

The stance decides which half of each skill you get.

| Slot | Handheld | Airborne |
|---|---|---|
| Q (4 s, 40) | **Parry Thrust:** ×1.5 in a 180 px 120° cone, destroys enemy projectiles in the cone. Parry window 0.3 s; a parried hit does nothing and gives 20% Flow. A hit with the sweep gives +30 Flow. | **Blade Surge:** the blade spins 6 × 0.1 s for ×0.2 per tick in 180 px, then ×0.6 in 200 px (×1.8 total). |
| E (1 s, rank-scaled) | **Deploy:** needs **full Flow** (70% with Early Deploy); at full Flow the blade is Empowered (×1.25, faster). | **Recall:** Flow goes to 0. |
| Space (5 s, 40) | **Shadow Step:** dash up to 300 px (400 with Windwalker), 0.3 s i-frames. **Finisher (combos.js): Iaido**, the slash after the dash is a draw-cut: 0.15 s later a line of light splits everything you dashed through for 2× a slash (with the Flow bonus), +20 Flow per enemy cut. | **Spatial Swap:** trade places with the blade. **Finisher: Guardian Orbit**, a click after the swap pulls the blade into a 70 px circle around you for 1.2 s: it cuts everything within 115 px at the steering rate for 1.5× a steered hit, nudges non-bosses away and shreds enemy shots entering the circle. |
| R (12 s, 60) | **Blade Whirlwind:** ×1.5 in 250 px. | **Shatter Storm:** 6 homing mini-blades for 6 s, each hitting for a flat 5.5% of R's damage every 0.5 s. |
| RMB | **Phantom Wind:** 60 px lunge, 180° sweep in 250 px for `calcDmg(basicDmg × 2)`, 100 px knockback, 1 s stun, +10 Flow per enemy. | same |

- **Handheld basics:** combo of 130 px 120° / 130 px 120° / 170 px 60° thrust (×1.5). Damage ×(1 + 1.5 × Flow%). Flow +10/+10/+20 per hit that connects. Flow decays 15/s after 1.5 s without gaining any.
- **Airborne blade** ([main.js:385](js/main.js#L385)): the blade fights on its own, flying through the nearest enemy within 600 px for `calcDmg(basicDmg) × (1 + 0.5 × Flow%)` (×1.25 Empowered). Hold LMB to steer it: much faster hits (every 0.1 s Empowered, 0.2 s otherwise, quicker with Flow) at ×0.4 each. Flow drains 15/s; at 0 you drop back to Handheld. Basic attack speed gets up to +50% from Flow.
- Since pass 3, the airborne blade, Shatter Storm and Phantom Wind scale with gear and orbs (Shatter Storm also with R's rank).

Upgrades:
- Q-A **Flawless Execution:** a parry fills Flow and resets Q.
- Q-B **Deflecting Storm:** Surge in 250/280 px, eats projectiles for +5% Flow each.
- E-A **Riposte Recall:** the recalled blade cuts everything between it and you (30 px) for `calcDmg(basicDmg) × 2`; you keep 30% Flow.
- E-B **Early Deploy:** Deploy from 70% Flow; the bar fills and the blade launches Empowered.
- Space-A **Path of Blades:** a phantom blade rides the dash for ×2, piercing.
- Space-B **Surge Reset:** swapping resets Q.
- R-A **Vortex:** pulls enemies up to 150 px toward you.
- R-B **Tempest Shards:** shards strike every 0.3 s and also cut every enemy within 60 px of the strike.

Rares (all different from the shared set):
- **Shattered Reality:** +50→90%, Phantom Wind.
- **Ronin's Silk Shroud:** +185 HP (the class's armor factor). Hits cost only 10 Flow instead of 25 (Razor's Edge), and in Airborne you dodge 10% of hits. (It used to give Flow when you were hit, the opposite of Razor's Edge.)
- **Prismatic Core:** 20% CDR, airborne Flow drains 30% slower (a full bar lasts ~9.5 s).
- **Windwalker Steps:** +60 move speed, Shadow Step 400 px.
- **Aether Grips:** +30% attack speed (the airborne blade too), +10% Flow from basics.

### Cleric

Zeal: each enemy hit by a censer pulse gives +15 (×2 inside a Sanctuary). Max 100. Spells check Zeal thresholds:

| Slot | Skill | CD | Base | Zeal | What it does |
|---|---|---|---|---|---|
| Q | Divine Ray | 4 | 15 | <10: ×0.5 damage; 10: ×1, 20 px × 600 px; 50: ×1.75, 45 px; 100: ×2.5, 80 px × 2500 px | Channel that follows the cursor for 1.5 s, 15 ticks of ×0.35 = **×5.25 total**, times the Zeal multiplier. |
| E | Hallowed Ground | 8 | 15 | <30: 80 px, half heal; 30/50: 160 px (50 doubles heal); 100: also damages | Zone at the cursor for 4 s, ticking every 0.5 s. Heals `(5 + 2% max HP) × rank scaling × healMult` per tick. At 100 Zeal it also deals ×0.5 with a 40% slow. |
| Space | Phase Shift | 6 | 20 | 50: +150 px; 100: +300 px plus stun | Blink 300 px with 0.5 s i-frames. At 100 Zeal: ×1 and a 1.5 s stun in 200 px at both ends. Below 50 Zeal it **gives** +20 Zeal. **Finisher (combos.js): Radiant Burst**, the censer pulse after Phase Shift becomes a 160 px ring around you, ×5 to everything in it (was ×2.5). Gold (after a Holy spell): double Zeal per enemy (30, 40 with the Thurible Chains). Violet (after a Shadow spell): no Zeal, it siphons 2% max HP per enemy (up to 3) instead, so Void Spike's empty-Zeal blood ray isn't spoiled. |
| R | Ascension | 20 | 30 | refills Zeal | Base: +25% damage for 6 s. |
| RMB | Twilight Repulse | 4 | 30 (unranked) | | 180 px: damage to everything; knockback 120 and stun 1 s on non-bosses. |

Upgrades (A = Holy, B = Shadow):
- Q-A **Radiant Flash:** every tick blinds for 1 s; each enemy newly blinded gives +10 Zeal (the description promised Zeal, the code never gave any).
- Q-B **Void Spike:** ticks at ×2.5 × 0.16 = **×6.0 total**; ×1.4 below 50% HP; at <10 Zeal it costs 5% current HP and fires at the 100-Zeal multiplier (×2.5, so **×15**). Under Aspect of the Reaper it fires at the 50-Zeal multiplier (×1.75) with no HP cost.
- E-A **Sanctuary:** heal `(5 + 5% max HP)` per tick, knocks non-bosses out, double Zeal from basics fired inside.
- E-B **Desecration:** ×1.4 per tick (×2.1 at 100 Zeal), 40% slow, breaks shields and Slime Warden orbs.
- Space-A **Divine Transposition:** swap with the nearest enemy within 400 px, 2 s stun in 200 px (400 at 100 Zeal).
- Space-B **Raven Flight:** dash 400 px. Each enemy passed: ×2, 2.5 s blind, heal 5% max HP. Costs 20 Zeal, or 10% max HP without it.
- R-A **Avatar of Renewal:** 8 s of locked 100 Zeal, 6 homing bolts of ×1.5 on cast; while it lasts, each Q/E/Space cast fires 3 more of ×1.
- R-B **Aspect of the Reaper:** 8 s of +50% damage, −50% cooldowns (on top of other CDR, floor 80%), drains 4% max HP per second (never below 1; casting is free), each kill heals 25% of missing HP.

Rares:
- **Censer of the Twilight Horizon:** +50→90% damage, Twilight Repulse.
- **Vestments of the Fractured Soul:** +240 HP. Holy: −15% projectile damage and a reflect bolt for 75% of the reduced hit. Shadow: a free Desecration (flat) under 25% HP, every 2 s.

### Druid ([druid.js](js/druid.js))

**Wild Bond.** The wolf (`player.wolves[0]`) is always out and can't be hurt or targeted. You never steer it:
- **Prey:** enemies within 450 px of the Druid. Snared (rooted) enemies come first, then Scented ones (anything the Druid hit in the last 3 s), then whatever is closest. Spirit wolves count prey another wolf already has for 600 less (`WOLF_CROWD`), so they spread over the pack and only double up when there's no fresh prey within the leash; your own wolf never gives way. Wolves keep 16 px × their scale apart (`separateWolves`).
- **Movement:** 340 px/s (×1.3 while surging or dire). It bounds back to the Druid's side when it's over 650 px away or stuck on rock for 1 s. It waits out a Crystal Slime's raised barrier, so reflect damage only comes from your own hits.
- **Bite:** `calcDmg(basicDmg) × 1.25` every 0.8 s (gloves' attack speed applies), +50% on rooted prey. Damage source `'wolf'`. (×1.35 after the band pass, back to ×1.25 to pay for Pounce Strike.)
- **Bond:** +10 per bite on Scented prey, max 100. It decays 8/s after 4 s without a gain and carries over between waves. At 100 the next bite is a **Maul**: ×4, a 1 s stun, and Bond goes back to 0.
- **Basic:** a seed bolt, 600 speed, ×1. Like every hit of the Druid's own, it Scents its target.

| Slot | Skill | CD | Base |
|---|---|---|---|
| Q | **Bramble Snare:** a 700-speed seed to the cursor (500 px max) or the first enemy. It bursts in **140 px** (was 80): ×1, a **1 s root, then a 40% slow for 3 s**. The Druid's crowd control. It no longer sends the companion (that was the same job as Pounce Strike); snared enemies are simply its favourite prey when it next picks one. | 6 | 40 |
| E | **Feral Surge:** for 5 s the wolf grows (×1.3), bites every 0.45 s, runs 30% faster, and its bites cleave for ×0.5 in 90 px around the prey. The Druid gets a bark shield of `100 + 20 × rank` for 5 s and is cleansed of slow and root. | 12 | 0 |
| Space | **Spirit Leap:** a leap to the cursor (100-250 px, 0.3 s, i-frames). The companion **stays on its prey** (it used to bound to your side, leaving a nearly dead enemy behind) and rakes where it stands when you land. Landings: ×1 in 110 px around you, ×1 in 90 px around the companion. **Finisher (combos.js): Pounce Strike**, the seed bolt after the leap is a calling bolt (amber): whatever it hits, the companion springs onto it from up to 450 px (not through rock) and lands a heavy bite: its own bite plus 2 wolf bites (the wolf ×3; the jaguar 1.5 + 2 = ×3.5 a wolf bite, so both gain the same per combo), a 0.5 s stun and +20 Bond. Spirit animals in range spring onto enemies within 150 px of it. A miss calls nothing. | 7 (rank-scaled) | 45 |
| R | **Call of the Wild:** the wolf howls (×1 in 250 px around it, 1 s stun), and 2 spirit wolves join for 12 s (bites at ×0.4 of your companion's). A ring under each spirit drains as its time runs out (amber, flickering, in the last 2 s); the chip shows the time left. | 15 | 60 |
| RMB | **Thistle-Grip Claws:** `calcDmg(40)` in a 180 px 120° cone, 0.75 s root on non-bosses. | 4 | |

Upgrades (A = Alpha, the one wolf; B = Pack, more wolves and area):
- Q-A **Feeding Ground** (was Hamstring): the companion's bites on snared or slowed prey give double Bond, so Mauls come faster.
- Q-B **Grasping Vines** (was Thicket): the burst first drags every non-boss within 140 px to 20-40 px from its centre, then roots and slows them, packing them up for AoE.
- E-A **Bloodrage:** during the surge, each bite of your wolf heals 1.5% max HP.
- E-B **Kindred Howl:** a spirit wolf for 8 s (it stays on after the surge).
- Space-A **Alpha Leap** (was Bond Leap): landing gives +25 Bond, and a Pounce Strike made at full Bond is a Maul (its strike + 3 wolf bites, a 1 s stun, Bond back to 0; the Heartwood Totem's splash too).
- Space-B **Scatter the Herd:** landing knocks non-bosses 80 px back; the companion whirls where it stands and bites up to 8 enemies within 150 px of itself for ×0.5 each.
- R-A **Dire Aspect:** no spirit wolves; your wolf is a dire wolf for 8 s: ×1.7 size, bites ×2.5, cleave, +20 Bond per Scented bite (+10 on any other).
- R-B **Wild Hunt:** 4 spirit wolves instead of 2.

**Companions** (picked on a screen right after the Druid on the class carousel; `COMPANIONS` in druid.js). Same kit and damage per second, different rhythm:

| | Wolf | Black Jaguar |
|---|---|---|
| Bite | ×1.25 every 0.8 s | ×1.875 every 1.2 s (the `rhythm` ×1.5) |
| Surging bite | every 0.45 s | every 0.675 s |
| Bond per Scented bite | 10 | 15 |
| Maul | ×4 | ×3 (same extra damage per Maul) |
| Bloodrage heal per bite | 1.5% | 2.25% |
| Getting to prey | runs it down | pounces when its prey is 60-230 px past biting range (2 s cooldown, needs a clear line), bites on landing |

- Headless dummy test, 40 s: bare bites 11 / 11 dps; with Scent and Mauls 14 / 14; with Snare and Surge 24 / 24; eight weak prey spread around you cleared by the companion alone in 18.7 s / 18.4 s.
- With the jaguar, the run's texts swap wolf → jaguar, dire wolf → elder jaguar (Dire Aspect → Elder Aspect), Kindred Howl → Kindred Roar; the E and R icons and the chips follow.

Rares:
- **Gnarled Heartwood Totem:** +50→90%, Thistle-Grip Claws. A Maul also hits every enemy within 100 px of its prey for half.
- **Mantle of the Living Grove:** +240 HP; enemies that touch you while Feral Surge's bark shield holds are rooted for 1.5 s (once per 3 s each).

### Paladin ([paladin.js](js/paladin.js))

Hammer states: equipped → outbound → deployed → returning → equipped.

| Slot | Skill | CD | Base | What it does |
|---|---|---|---|---|
| Q | Judgment Hammer | 6 | 50 | Throw up to 500 px at 1100 speed, ×1 to everything it passes. It plants and pulses every 1 s for ×0.25 in 200 px, taunting non-bosses for 0.5 s. Recast to recall: homes at 1400 speed, ×1 again and drags non-bosses. **A clean catch leaves Q at 1.2 s.** The throw only costs a 0.4 s lockout. A missed catch keeps the full cooldown. |
| E | Divine Tether | 12 | 15 | A chain of light from you to an anchor; every 0.25 s whatever touches it (18 px) takes ×0.5 and is slowed 40%. **Hammer planted:** the anchor is the hammer, 5 s (walk around it to sweep the chain). **Hammer in hand or flying:** shackles the enemy nearest the cursor (within 120 px of it, 500 px of you; else the one nearest you) for 4 s: it takes +20% from all your damage, and a non-boss can't get more than 150 px away (reeled in at 500 px/s). With no one in range the cast is refused and the cooldown isn't spent. Breaks if the hammer leaves the ground, the target dies, or the chain stretches past 700 px. |
| Space | Righteous Charge / Iron Pull | 6 (rank-scaled) | 35 | In hand: 260 px charge at 1300 speed, ×1, shoves, 0.3 s stun on non-bosses. Planted: chain yourself to the hammer, ×1.2 in 150 px on arrival. **Finisher (combos.js): Judgment Smash** (below). |
| R | Consecrated Wrath | 18 | 40 | 220 px zone for 6 s at ×1/s (**×6 total**) with a 25% slow, on the hammer if it's planted, otherwise on you. |

- **Basic, hammer in hand:** 140 px 120° smash, 0.15 s stagger and a 12 px shove on non-bosses.
- **Basic, hammer away:** 95 px 90° bash for ×0.85, but armor ×1.15.

Upgrades:
- Q-A **Handheld Purity:** catching the hammer deals ×1 in 180 px and **stuns for 1.5 s, bosses included**. Once per Q cooldown.
- Q-B **Conduit Shock:** a planted hammer zaps the 2 nearest within 200 px for ×0.4 every 0.5 s.
- Built into Divine Tether (playtest: the melee Paladin had no sustain): each pulse heals 0.5% max HP per enemy the chain touches, max 1.5% per pulse. On one boss that's 2%/s (~10% per cast); against a pack up to 6%/s.
- E-A **Overflowing Grace:** healing from the chain past full HP becomes a shield (3 s, capped at half max HP like every shield).
- E-B **Chain of Retribution:** enemy projectiles that cross the chain break on it, and each fires a homing bolt back for `calcDmg(15, rank)`.
- **Judgment Smash** (Space finisher): the basic within 0.75 s after Righteous Charge or Iron Pull lands is an overhead smash 60 px ahead: ×3 (×1.3 more with the Gauntlets of Devotion) to everything within 160 px of the impact and a 1.5 s stun (bosses shake it off in ~0.5 s). After Iron Pull you stand on the planted hammer and rip it out of the ground into the smash: it's back in hand and Q is left at 1.2 s, as after a clean catch.
- Space-A **Unstoppable Juggernaut:** 390 px and immune during the charge.
- Space-B **Gravitational Crashing:** Iron Pull slows by 50% for 3 s.
- R-A **Divine Aura:** the zone follows you.
- R-B **Hammer of the Gods:** a planted hammer becomes a 6 s hurricane pulling non-bosses within 280 px.

Rares:
- **World-Breaker Grand Mace:** +50→90%. No RMB; smashes leave fault lines for 2 s, and a hammer throw that crosses or lands on one pulls every non-boss on the fracture to it.
- **Plate of the Gilded Bastion:** +240 HP; while the hammer is planted, 1% damage reduction per 15 px from it (max 25%).

---

## 5. Class rare items

Every class has its own five rares ([classes.json](data/classes.json); the effects that aren't inside one skill's code live in [items.js](js/items.js)). Shop prices: weapon 250, armor 200, amulet 200, boots 150, gloves 150, all five every visit.
- **Base stats by slot:** weapon +50% damage, awakening +4% per wave cleared up to +90%, armor +240 HP × the class factor (`armorHpMult`: base HP / 130, at most 1, so Nightblade 148, Spellweaver/Kensei 185, Ranger/Cleric/Druid 222, the rest 240), amulet `val` as CDR (20%), boots +50 move speed, gloves +25% attack speed. A class rare can override the stat with `val` (the Kensei's boots and gloves).
- **The pattern:** the weapon brings the RMB ability, the armor a defensive effect, the amulet feeds the class gauge or a spell, the boots upgrade the Space skill, and the gloves upgrade the basics.
- The old shared trio (Amulet of Power, Ethereal Treads, Vampiric Grips) is gone.

| Class | Amulet | Boots | Gloves |
|---|---|---|---|
| Dragonknight | **Wyrmheart Pendant:** each skill cast +2 Frenzy, Frenzy stacks up to 15 | **Thunderstride Greaves:** Thunder Leap 500 px, landing knocks non-bosses back 60 px | **Berserker Gauntlets:** at 10+ Frenzy, basics heal 1% max HP per enemy hit (max 3%) |
| Spellweaver | **Orb of Echoes:** 4 Resonance charges, charged bolts explode in 120 px (was 80) | **Blinkstep Slippers:** an echo where you blinked from bursts after 0.5 s for Blink's damage (×1) in 100 px | **Spellthread Gloves:** every 5th bolt is charged without spending Resonance |
| Ranger | **Eye of the Storm:** a full-draw Storm Arrow cuts 2 s off Volley | **Trailblazer Boots:** Momentum builds ×2 as fast, Vault fills it | **Fletcher's Grips:** every 4th arrow splits into three (±0.15 rad, the side arrows don't home) |
| Nightblade | **Sigil of the Hunt:** Expose Weakness marks 2-4 per pulse (was 1-3), weak points +25% | **Shadowstep Boots:** Phantom Dash leaves an 80 px smoke for 1.5 s at its start (50% evade, enemies lose you) | **Serrated Grips:** basic thrusts bleed for `calcDmg(basicDmg)`/s for 3 s (refreshes) |
| Machinist | **Overclock Regulator:** Overclock +2 s; a tapped turret during it is a free Heavy Turret | **Mag-Lock Boots:** grappling onto a turret or coil refreshes its lifetime and gives +40 shield (3 s) | **Salvager's Gauntlets:** every 25 pellet hits give 1 Scrap (no heal) |
| Kensei | **Prismatic Core:** 20% CDR, airborne Flow drains 30% slower | **Windwalker Steps:** +60 move speed, Shadow Step 400 px | **Aether Grips:** +30% attack speed (the airborne blade too), +10% Flow from basics |
| Cleric | **Reliquary of Dawn and Dusk:** a spell cast at 100 Zeal leaves you at 25 Zeal (not while Zeal is locked) | **Pilgrim's Sandals:** Phase Shift leaves an 80 px Hallowed Ground for 2 s at its start, healing `5 + 2% max HP` (E-rank scaled) per 0.5 s | **Thurible Chains:** 20 Zeal per censer hit (was 15) |
| Druid | **Elder Grove Seed:** spirit animals stay 4 s longer | **Pathfinder Wraps:** Spirit Leap's landing +15 Bond (stacks with Alpha Leap: 40) | **Packbond Bracers:** seed bolts Scent for 6 s; one that hits your companion's prey gives +3 Bond |
| Paladin | **Seal of Judgment:** a clean catch resets Righteous Charge / Iron Pull, and that charge hits +50% | **Crusader Sabatons:** Righteous Charge stuns 0.8 s (was 0.3); Iron Pull stuns 0.5 s | **Gauntlets of Devotion:** hammer-in-hand smashes deal +30% and heal 1% max HP per enemy hit (max 3%) |

Weapons and armors are listed under each class in section 4.

---|---|---|
| Amulet of Power | amulet | 20% CDR. Every skill cast (not basics or RMB) gives +5% damage for 3 s, stacking to 5 (+25%, additive to `mult`). |
| Ethereal Treads | boots | +50 move speed. **50% less damage taken while moving.** No collision with enemies (they can overlap you). |
| Vampiric Grips | gloves | +25% attack speed, heal 2% of damage dealt. |

---

## 6. Slime Caves

### Stage flow

| Stage | Map | Waves | Boss | After the boss |
|---|---|---|---|---|
| 1 | Forest clearing ([map_clearing.js](js/map_clearing.js)) | 1-5 | Slime King | The cave lights up; walk in → wave-cleared screen + **shop** |
| 2 | Sunken Grotto ([map_cavern.js](js/map_cavern.js)) | 6-10 | Amalgam | The seal breaks; walk through → wave-cleared screen + **shop** |
| 3 | Hive throne hall ([map_hive.js](js/map_hive.js)) | 11-15 | Hive Queen | The crown drops; claim it → Victory → optional Limitless mode |

**Limitless (endless) mode:** plain `open` arena, minions from all three stages mixed, a random Slime Caves boss every 5th wave, same scaling formulas (no cap).

### Environmental hazards

| Hazard | Where | Effect on the player | Effect on enemies |
|---|---|---|---|
| Wading (lakes, royal jelly) | cavern, hive | 50% slow, `(2.5% max HP + 0.6 × wave)/s` × 0.6, continuous (armor doesn't apply). Hazard Suit: immune. | none |
| Stalactites | cavern | Triggered by dashing or ramming into a wall (1.4 s cooldown), 4-6 fall around the impact point. `12 + 2.5 × wave` (× 0.6 − armor). | `40 + 10 × wave` (× 0.6) |
| Brood pods | hive | none | Enemy-type `brood_pod`, `30 + 8 × wave` HP. Popping one gives `4 + wave` XP; it regrows after 22-28 s. Slimes hatch from intact pods away from the hero, then from burrows when none are left. |

### Minions

Raw `dmg` is before the ×0.6; the "Hit" column is after the ×0.6, **before armor**.

**Stage 1** (waves 1-5)

| Enemy | Weight | HP | Hit | Speed | XP | Behavior |
|---|---|---|---|---|---|---|
| Slime (`slime_melee`) | 70% | 20 + 8w (28 → 60) | 5.7 → 9.3 | 117-158 | 12 → 20 | Chases. On contact: a hit every 1 s and a **50% slow on you** while touching. |
| Spitter (`slime_ranged`) | 30% | 15 + 5w (20 → 40) | 5.7 → 9.3 | 88-98 | 14 → 22 | Keeps 250 px. Fires a 350-speed blob every 2.5 s within 400 px when it has a clear shot. |

**Stage 2** (waves 6-10)

| Enemy | Weight | HP | Hit | Speed | XP | Behavior |
|---|---|---|---|---|---|---|
| Voltaic Ooze | 40% | 35 + 12w (107 → 155) | 14.4 → 19.2 | 135-165 | 33 → 45 | Melee. **Any two oozes within 250 px form a link**: crossing it deals 15/s × 0.6 (continuous) and slows you. |
| Toxic Sludge | 60% | 45 + 15w (135 → 195) | 12.5 → 16.8 | 105-125 | 34 → 46 | Melee. Drops a 25 px puddle every 0.8 s that lasts 1.5 s, 15/s × 0.6 continuous. |

**Stage 3** (waves 11-15)

| Enemy | Weight | HP | Hit | Speed | XP | Behavior |
|---|---|---|---|---|---|---|
| Spore Slime | 50% | 100 + 6w (166 → 190) | 23.5 → 28.8 | 113-133 | 62 → 78 | Keeps 250 px. Every 3 s lobs a spore at your position (400 px range) that bursts into a 100 px cloud for 3 s: **−30% damage (Weakened)** while you stand in it. Leaves the same cloud when it dies. |
| Crystal Slime | 35% | 160 + 11w (281 → 325) | 34.8 → 42.0 | 98-118 | 80 → 100 | Melee for 4 s, then **reflective** for 3 s: stops, fires 8 bolts at 200 speed, and **every hit on it bounces 50% of the damage back at you** (reduced again by the ×0.6 and armor). |
| Slime Warden | 15% | 270 + 13w (413 → 465) | 41.1 → 49.5 | 128-153 | 116 → 140 | Melee. **3 orbs: a hit of any size pops one orb instead of dealing damage**, at most one per 0.25 s (hits in between are blocked too). At 0 orbs it is stunned for 2 s. A lost orb regrows every 6 s while it isn't stunned. |

### Bosses

| Boss | Wave | HP | Hit (× 0.6) | Speed | XP |
|---|---|---|---|---|---|
| Slime King | 5 | 3600 (1600 + 400w) | 15 | 75 | 200 |
| Amalgam | 10 | 11 650 (4650 + 700w) | 30 | 90 | 400 |
| Hive Queen | 15 | 33 600 (12 600 + 1400w) | 57 | 80 | 1000 |

Boss item drop: T4 (King), T6 (Amalgam). The Queen's drop doesn't matter, since the run ends.

All bosses (including Bandit Bastion's) count down stun, root, freeze and blind 3× as fast as other enemies. A stunned boss stops moving but still runs its attack AI; a frozen one also can't start most attacks.

**Slime King** ([ai.js:121](js/ai.js#L121)):
- Leaves the cave in an intro cutscene. Contact damage once per 1 s.
- Every 2 s, a coin flip between:
  - **Leap slam:** 0.6 s arc with a warning ring, lands for ×2 (30) in 100 px.
  - **Fireballs:** 4 diagonal shots, 300 speed, ×1.

**Amalgam** ([ai.js:225](js/ai.js#L225)):
- Forms out of the lakes in a cutscene. Contact ×1. Its rotation is Stampede, Nova, Assimilate, Stampede, Nova, Undertow:
  1. **Stampede:** 3 s at ×2.2 speed, contact ×1.5 (45), a puddle every 0.3 s. Ramming a wall drops stalactites.
  2. **Toxic Nova:** 1 s windup, then 12 slimeballs at 400 speed, ×1 each, leaving puddles.
  3. **Assimilate** (every other round, ~25 s apart; was every ~12.5 s): flings **3** minions (was 4; flat 60 HP, the boss's damage, 0 XP) up to 460 px away; they're dazed for **2 s** (was 1.1 s), then crawl back. **A minion that reaches the boss heals it 5% max HP (~360 at wave 10; was 10%)** and triggers **Devastate**: 1 s warning, then ×3 (90) in 300 px. At most 15% per Assimilate (was 40%). Minions wait while it's under the floor.
  4. **Undertow** (new, in the slot Assimilate gave up): 0.6 s melting into the floor (still hittable), then up to 1.8 s as a ripple racing toward you at 2.6× its speed. Under the floor it can't be hit or targeted and shots pass over it. Within 60 px (or when time runs out) it settles under your spot: a 0.65 s warning ring of 130 px (`UNDERTOW_WARN`; 1 s was too easy to walk out of in the playtest, 0.65 felt right), then it erupts for ×2 plus a slow ring of 10 slimeballs (×1) and a puddle.
- 1.5-4 s pauses between attacks.

**Hive Queen** ([ai.js:145](js/ai.js#L145)):
- Asleep on her throne until wave 15's boss spawns.
- **Above 60% HP:** walks to 150 px. Every 2.5 s, either:
  - lobs 2 eggs that hatch into slimes (flat 40 HP, 10 damage, 0 XP, but they do roll drops), or
  - spits 3 pink balls at 400 speed, ×1 each, leaving puddles.
- **60-30%:** spawns 4 guards (`200 + 10w` = 350 HP, flat 15 damage) orbiting at 150 px. **She is immune while any guard lives.** The tether from her to each guard deals 15/s × 0.6 if you touch it. Every 2.3 s, a lightning strike on your position: 0.85 s warning, ×1.2 (68) in 70 px, plus a brief slow. After a hit, there's at least 2.5 s before the next strike.
- **Below 30%:** crawls after you at 0.8 speed. About every 4 s she leaps (0.9 s, with a warning ring) to a spot 220-350 px from you. The landing deals ×1.2 in 110 px and fires a ring of 16 bolts (×1, 260 speed), leaving a pink puddle.
- **At 0 HP, Death Throes:** she becomes immune and leaps back onto the throne, followed by a **14 s bullet hell**:
  - Spiral volleys every 0.17 → 0.12 s, 3 → 5 arms, 220 → 340 speed.
  - A counter-spiral from 30% of the way through.
  - Rings of 20 bolts every 1.9 → 1.2 s from 60%.
  - Every bolt does ×0.5 (28.5 before armor) and speeds up to 640 once it's 420 px from her.
  - She dies when the timer ends, whatever you do. Her brood dies with her.

---

## 7. Bandit Bastion

Being reworked stage by stage like the Slime Caves (see CLAUDE.md, Known issues). Stage 1, Cinderholt (waves 1-5), is a real map with sprites and is playtested; stage 2, The Raiders' Trail (waves 6-10), is a real scrolling map ending in the Beastmaster; Valerius is still on the old bridge map at wave 11.

**Cinderholt: fire and powder** ([bandits.js](js/bandits.js); raw numbers, before the global ×0.6 on damage taken and `HIT_SCALE` on damage dealt):
- **Gold and the war chest:** a regular kill drops gold 30% of the time, worth 5 + w; the Warchief's own drop is 5 piles of 20 + 2w = 150. Waves 1-4 have 5, 8, 10 and 13 enemies, wave 5 has 3 plus him, so an average run collects 9 + 16.8 + 24 + 35.1 + 9 + 150 = **~244 gold** (std dev ~23) against the rare weapon's 250. To leave real slack the Warchief now also drops his **war chest** (village only, not Endless): 4 piles of 20 = **80 gold**, so ~324 on average, ~300 even a standard deviation unlucky, and everything is auto-collected when the wave clears.
- **Fire on the ground** (`ground_fire`): the hero takes 10 + 1.5w per second standing in it; bandits take 20 + 5w per second. The Warchief walks through it.
- **Powder keg** (8 spots in the village, each restocked 28 s after it blows, once the hero is 520 px away): any hit sets it off. 115 px blast: 14 + 3w to the hero, 50 + 12w to enemies (it kills a thief or archer outright early on), staggers the Warchief (his wind-up is lost, 1.4 s before his next move), and leaves fire (70 px, 3.5 s). Kegs within 150 px catch and go off one after another.

| Enemy | Stage | Weight | HP | Raw dmg | Notes |
|---|---|---|---|---|---|
| Thief | 1 | 40% | 18 + 7w | 10 + 1.8w | Fast (155), **20% evade**. No touch damage: a knife thrust (0.3 s wind-up with a faint blade glint, a quick lunge) for ×1.3, then 0.35 s open |
| Archer | 1 | 30% | 15 + 6w | 12 + 2w | 3-shot bursts |
| Shield | 1 | 30% | 30 + 15w | 8 + 1.2w | A 35 HP frontal shield blocks hits within ±72°. No touch damage: a shield bash (0.5 s wind-up, while it turns to track you at 7 rad/s; a wedge marks its reach) lurches forward at 560 px/s, reaching 30 px past its edge over a ±1.35 rad arc, for ×2, shoving you 70 px back and slowing you; with the shield gone, the same move as an axe chop |
| Horse rider | 2 | 30% (default) | 40 + 15w | 15 + 2.5w | Circles at 300 px, then sets its lance (a lane on the ground, locked for the last 0.35 s, was 0.2) and charges at 640 px/s for up to 520 px: ×2 and a slow, then wheels round in a wide turn |
| Trapper | 2 | 22% (default) | 25 + 8w | 10 + 1.5w | Lobs 2 bear traps every 6 s (was 3 every 4 s), never more than 3 of its own down at once; each has a landing marker; a trap snaps shut on you for a **0.8 s** root (was 1.5 s), and any player shot springs it harmlessly. Traps never snap while you dash, leap or have i-frames, and after one snaps you can't be rooted by another for 2.5 s (the others stay armed) |
| Bannerman | 2 | 12% (default) | 45 + 12w | 6 + 1w | Never attacks. Hangs back behind its allies; bandits within 300 px are Rallied: ×1.3 speed and ×1.25 damage |
| Hound | 2 | 16% (default) | 14 + 6w | 6 + 1.2w | Packs of up to 3 (on the trail: 2). Circle at 130 px, spread out, dart in at 520 px/s for one bite, then retreat |
| Slinger | 2 | 20% (default) | 22 + 7w | 9 + 1.4w | 90 speed. Keeps 260-380 px off you (backs off when you close in). Every 2.6 s, with a clear shot, it winds up for 0.6 s and lobs one stone at where you stood when it let go: a 26 px marker shows the landing, the stone flies at 420 px/s and hurts only if you are still in the marker when it lands. The less oppressive ranged enemy: one telegraphed hit, no area denial |
| **Warchief** (boss) | 5 | 1200 + 240w | 18 + 2.5w | Knife fan; **Bull Rush**: a lane on the ground through a 0.7 s wind-up, then he charges down it (1150 px/s, up to 560 px) for ×2, knocking you aside, and stands winded for 0.55 s; **Torch Toss**: a torch on your spot (0.75 s warning ring), ×0.8 on a direct hit, then 75 px of fire for 5 s. Below 50%: a second torch beside you, and **Keg Kick**: a lit keg rolls at you (340 px/s, 2.2 s fuse) and goes off on whatever it touches first, his own men included, for ×1.5 |
| **Beastmaster** (boss) | 10 | 3500 + 510w | 22 + 3w | Prowls at whip's length (190 px). **Whip Crack** in reach: a wedge on the ground for 0.85 s (locks 0.3 s before; was 0.55 / 0.15, too fast in the playtest), 250 px, ×1.8, yanks you 80 px in and slows; twice when enraged (0.65 s between cracks, was 0.42). Bolas (root + pull): a 0.85 s wind-up (was 0.5) with three aim lanes on the ground that lock for the last 0.25 s, thrown at 560 px/s (was 700). Hounds: 2 at a time, never more than 4 of his. **Joust**: mounted, 3 runs down lance lanes (0.8 s / 0.5 s prep), 950 px/s up to 620 px, ×2.5 and knocked aside, winded 0.9 s after; no traps during the runs, he drops 2 at the end of the third run's lane. Touch ×1.2. Kennel Call at 50% and 25%: 3 hounds out of the reeds (his hounds die with him). Bolas root 0.6 s (was 1.0 s). Below 50% everything comes 30% faster. Riders never spawn on the forest road |
| **Valerius** (final) | 11 | 5600 + 670w | 25 + 5w | P1: lunges/sunder. P2 (65%): 2000 shield + 2 archers, javelin spiral, breaking the shield staggers him (×2 damage taken). P3 (30%): chain hook, frenzy lunge, slam ×3 |

**The Raiders' Trail** (stage 2, waves 6-10; [map_trail.js](js/map_trail.js)):
- **Sections:** the trail opens one section at a time: the forest road (waves 6-7), the bandits' hunting camp in a clearing (waves 8-9), the riverbank (wave 10). A logjam closes each next section until the wave before it is cleared (the camp's until wave 7, the riverbank's until wave 9). Spawns come only from the newest open section, ahead of you.
- **The river:** a ravine across the map that you can't walk through; the stone bridge crosses it. A chained gate at the bridgehead holds until the Beastmaster dies, and the exit is on the bridge.
- **Section mix** (`trailMinions`, [map_trail.js](js/map_trail.js); the weights in enemies.json stay the defaults for Endless): forest road: slinger 40%, trapper 25%, hound 20%, bannerman 15%, no riders. Clearing and riverbank: slinger 30%, rider 22%, trapper 20%, hound 15%, bannerman 13%.
- **Caps on what's alive at once:** 2 horse riders, 4 hounds (the Beastmaster's count); a capped type drops out of the pick. Hound packs are 2 at most on the trail, never past the cap.
- **Dash-friendly traps:** bear trap root 0.8 s (was 1.5), bolas root 0.6 s (was 1.0); traps ignore a hero who is dashing, leaping or has i-frames, and a snap grants 2.5 s of trap immunity (`player.trapImmuneUntil`). The rider's lance lane locks 0.35 s before the charge (`RIDER_LOCK_TIME`).
- **Dev jump:** starting wave 8 opens logjam 1 and places you at the clearing (x 2150); wave 10 opens both and places you on the riverbank (x 4000) (`trailEnter`).
- **Rally:** bandits within 300 px of a bannerman run ×1.3 speed and hit ×1.25 damage.
- **Wave 10:** the Beastmaster alone. His intro is a horn, then he leaps the gate from the bridge.

---

## 8. Balance observations

The stated problem is that the newer classes do too much damage and the bosses (Slime King, Amalgam) die too fast. From the numbers above, these are the main levers. They're observations, not decisions.

### Damage inflation that affects every class

All five were addressed in pass 1 (see the patch log); the old numbers are kept here for comparison.

1. ~~Common weapons out-scale the rare weapon.~~ Was +20%/tier (T8 = +160%); now 5% + 10%/tier (T8 = +85%).
2. ~~Damage orbs stack without limit.~~ Was +5% uncapped (+135% by the Queen); then +2%, max +40%; now +4 Power, max +80 (Power adds up instead of multiplying).
3. ~~Rank scaling is generous.~~ Was ×1.9 at rank 4; now ×1.6.
4. ~~Amulet of Power adds up to +50%.~~ Now +25%.
5. ~~CDR also speeds up basics, commons reach 40% CDR.~~ CDR no longer touches basics; commons top out at 20%; the cap is 60%.

Rough example, Spellweaver at the Amalgam (wave 10), rank-4 Meteor:
- Before: `120 × 1.9 × (1.2 + 1.0 weapon + 0.5 Surge) × 1.65 orbs × 0.6` ≈ **610 per hit**.
- After: `120 × 1.6 × (1.2 + 1.0 weapon + 0.25 Surge) × 1.26 orbs × 0.6` ≈ **355 per hit** (≈ 290 with a T5 common weapon instead of the rare). That's about 9 Meteors for the Amalgam's 3200 HP instead of 5, before boss HP is touched.

### Bosses scale too slowly

- Boss HP grows by `wave × hpScale`, linearly. Player damage grows multiplicatively (tier × orbs × rank × Surge). **Pass 2:** HP raised to King 1800 / Amalgam 5000, Queen lowered to 12 000, after pass 1 cut player damage. **Band pass:** King 2250 / Amalgam 7250 / Queen 24 000, after the rare sets and evolutions were modelled. **Boss HP pass:** King 3600 / Amalgam 11 650 / Queen 33 600, measured in-engine with every class's finisher.
- Several hard CC effects skip the boss check: Net Shot root 2 s, Deep Freeze 3 s, Handheld Purity 1.5 s stun, Divine Transposition 2 s stun, and the Druid's Call of the Wild howl and Maul (1 s stun each). On a boss these set its speed to 0. Stunned bosses still run their attack AI, but **frozen** bosses can't start most attacks (their AI checks `frozenTimer`). Spellweaver's Deep Freeze on a 5 s CD (4 s with the amulet) could keep a boss frozen most of the time. **Pass 2:** bosses shake CC off 3× as fast, so Deep Freeze holds a boss for 1 s.

### Class outliers

- **Machinist scattergun:** ~~~115 basic DPS point-blank~~ now ~41 (pass 1). Turrets still have no cap.
- **Nightblade:** basic DPS ~~80~~ now 40 (pass 1). Weak points are still flat 60 true damage every few seconds: strong early (stage 1 slimes have 28-60 HP), weaker later. HP raised from 60 to 80 in its class pass.
- **Spellweaver:** ~~every basic is an AoE explosion~~ now only Resonance shots explode (pass 1).
- **Multi-hit skills against big bosses:** Dragon Breath (21 × 0.25), Volley/Rain of Arrows (10-18 arrows; each arrow hits within 24 px + half the boss's size), Void Spike (×6.75 over 1.5 s, up to ×16.9 at full Zeal), Consecrated Wrath (×6), Blade Surge (×1.8). The bigger the boss, the more of these hits connect: the Queen is 120 px across.
- ~~Paladin hammer loop: clean catches reset Q to 0~~ (a throw every ~1.2 s). **Pass 3:** a catch leaves 1.5 s, so the loop runs every ~2.5 s.

### Classes that fall off or don't scale

All fixed in pass 3: the Kensei's Airborne blade, Shatter Storm and Phantom Wind; the Cleric's Desecration, Raven Flight, Avatar bolts and Twilight Repulse; the Druid's Savage Blooms; the Nightblade's weak points and Chain Reaction now all scale.

### Survivability

- ~~Flat armor after the ×0.6 trivializes stage 1 for tanks~~ (a wave-1 slime did 1 damage to the Paladin). Armor is now a percentage (pass 1): that slime hits the Paladin for 4.4 and the Spellweaver for 5.7.
- Squishies take full damage: at wave 15 a Slime Warden deals ~47 per hit to a Nightblade (now 80 base HP, was 60).
- ~~**Ethereal Treads** halve all hit damage while moving. In practice that's almost always.~~ Gone with the shared rares.
- The 30% heal at the start of each wave and HP orbs (25%) are generous.

### Things that might feel wrong in play

- ~~Slime Warden orbs come off all at once to a multi-hit~~ (a scattergun shot or Fan of Knives stripped all 3). **Pass 2:** one orb per 0.25 s, and they regrow.
- **Crystal Slime reflect** hurts melee and AoE classes most (every AoE tick reflects).
- **The Amalgam's heal** (10% per absorbed minion, plus Devastate) is its only answer to burst. It rarely fires when the boss dies in seconds.
- **The Queen's immune phase** is gated by guards with only 350 HP. With strong AoE, the 60-30% phase is skipped almost instantly.

---

## 9. Bugs and mismatches found while reading

None of these are fixed. Each one changes balance numbers, so it's worth deciding on them as part of the patch.

| # | Where | Problem |
|---|---|---|
| 1 | [combat.js:182](js/combat.js#L182) | **Fixed in pass 4** (50% less damage for 2 s). Iron Bulwark's 50% damage reduction is never set (`buffs.ironBulwark` is never written). Already in CLAUDE.md. |
| 2 | [combat.js:138](js/combat.js#L138) | **Fixed in pass 3.** `activeClass.skills[1].selectedUpg === 'B'` for the Ranger is **Barbed Tips** (Q). It gives a hidden ×1.2 to every non-magic, non-DoT Ranger hit, basics included. It was probably meant to be the bleed and nothing more, or it was meant for another skill. |
| 3 | [ui.js:192](js/ui.js#L192) | **Fixed in pass 4.** The level-up card shows a cooldown reduction for every skill, but only Space (and the Kensei's E) actually get rank-based cooldown scaling. |
| 4 | [skills.js:374](js/skills.js#L374) | **Fixed in pass 3.** Avatar of Renewal's 6 cast bolts deal `dmg × 1.5`, but Ascension has base 0, so they deal **0**. |
| 5 | [skills.js:351](js/skills.js#L351) | **Fixed in pass 3.** Base Phase Shift at 100 Zeal deals `dmg` = **0** to stunned enemies (base 0). Raven Flight falls back to a flat 20 and Desecration to a flat 15 via `dmg ‖ X`. |
| 6 | [skills.js:903](js/skills.js#L903) | **Fixed in pass 3.** Toxic Fumes poison uses Smoke Bomb's `dmg` = `calcDmg(0)` = **0**, so the "heavy continuous poison damage" does nothing. |
| 7 | [ui.js:156](js/ui.js#L156) | **Fixed in pass 4.** Every rare weapon gets `val: 1.0` (+100%), including the Cleric's censer, whose description doesn't promise it. Rare armor is always +240 HP (Ronin's Silk Shroud doesn't mention HP). Windwalker Steps gives +50, not the +60 it describes. |
| 8 | [skills.js:5](js/skills.js#L5) | **Fixed in pass 4.** Dragonknight Frenzy promises +2% attack speed per stack; only the damage part exists. |
| 9 | [skills.js:39](js/skills.js#L39) | **Fixed in pass 3.** Laser Optics is described as "piercing" but hits a single target, and its 1.5/s rate gives less DPS than the base turret (2.5/s). |
| 10 | [combat.js:76](js/combat.js#L76) | **Fixed in pass 2.** The Slime Warden's `invulnTimer` was set on every orb hit but never checked, so orbs could be stripped in a single frame. |
| 11 | [skills.js:1296](js/skills.js#L1296) | **Fixed in pass 1.** Spellweaver basics were always AoE (`type: 'fireball'`), so Arcane Resonance only added ×1.5 and Robes of the Magi was a downgrade. |
| 12 | [skills.js:635](js/skills.js#L635) | **Fixed in pass 3.** Phantom Wind deals `basicDmg × 2 + bonusDmg`: it adds the orb fraction (e.g. 0.65) as flat damage instead of multiplying. |
