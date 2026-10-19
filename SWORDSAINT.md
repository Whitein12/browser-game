# The Swordsaint

A flashy, high-skill duelist: very high damage, but only when she weaves her cuts and skills and uses her dashes to dodge enemy blows (design agreed with the user, 2026-10-15). The kit takes Riven's rhythm and Saber's look, not Riven's kit. Step 1, the kit, is built and playtested; step 2, the web, is built and awaits playtest. Code: `js/swordsaint.js` (mechanics), `js/swordsaint_fx.js` (visuals). Class id `swordsaint`, name `Swordsaint`, weapon `saint_sword`. Her sprite and portrait were drawn earlier (sprites.js, portraits.js).

## The user's decisions (2026-10-15)
- **From the user's brief:**
  - Q is recastable: each cast is a dash forward with a spin, and the last is a bigger dash-jump that hits harder.
  - R releases the sword's full potential (more damage), and a recast unleashes a powerful attack.
- **Picked from options:**
  - passive Style rank ("let's try it; worst case we change it");
  - a perfect dodge gives bullet time;
  - E Strike Air;
  - Space Mana Burst;
  - Crosscut as the Space finisher;
  - a held golden beam as the R recast;
  - Hammer of the Wind King on the RMB.
- **Rejected:** Riven's Runic Edge as the passive ("I don't want literally Riven's kit").
- **First playtest (2026-10-15):** "Damn it is fun." The Style rank stays: it plays well and fits her. No survivability, on purpose: "if you aren't good you'll die. This ain't your granny's class." That means no self-healing; Max HP is fine.
- **The web (step 2):** see the section at the end.

## Core rules
- **Style rank** (`ss.style`, 0-500; the gauge orb shows the letter):
  - Ranks D / C / B / A / S, 100 points each, named Dull / Keen / Bright / Radiant / Sovereign.
  - An action that lands a hit adds +25 if it differs from the last action that landed, +3 if it repeats it. The actions are basic, Q step, E, Crosscut, beam and RMB. One action counts once, however many it hits.
  - A perfect dodge adds +100 (a full rank).
  - A hit taken (not DoTs or ground) takes 200 off: two ranks.
  - It ebbs 6 a second, and 40 a second after 2.5 s without landing a hit. Cuts alone can't hold it up: basics only stay at D.
  - Each rank adds Power, as a `powerParts` line: D 0, C +10, B +25, A +40, S +60.
  - Each rank also adds attack speed (`ssSpeed` in skills.js `attackSpeedBonus`): +5% a rank, +20% at S. The user asked for it after the playtest; it adds about 4% to her damage (woven, one dummy, rank 1: 70.9 to 73.8; pack 270 to 281) and 1-3% with a full web.
  - While Unsealed, Style gains are x1.5.
- **Perfect dodge:**
  - It happens when an enemy hit (not continuous damage) reaches `takeDamage` while her own Gale Step or Mana Burst window is up (`ss.dodgeUntil`).
  - She takes nothing and gets "Perfect!" and +100 Style.
  - It starts 1 s of bullet time, at most once every 3 s: enemies and their shots run at 30% speed (bosses at 50%) while she moves at full speed. main.js shadows `dt` in the enemy loop and the projectile loop (`ssTimeScale`, `ssShotScale`). The screen gets a sepia and gold tint.
- **The weave:** every skill cancels the sword's recovery (`ssWeave`: the basic cooldown goes to 0), so the rhythm is basic, skill, basic, skill.

## The keys
| Key | What it does | CD / base |
|---|---|---|
| Basic, Saint Sword | A three-cut chain that resets after 1 s: two sweeping cuts (120 px, 100° cone, everything in it), then a thrust (180 px line, x1.5). Raised from 110 / 150 after the first playtest (too short to kite with; 130 was then too much). The blade is drawn 108 px long so it matches the slash | / 11, 0.3 s |
| Q Gale Step | Up to 3 steps; each opens a 3 s window with a 0.25 s gap. Steps 1-2: a 130 px dash toward the cursor (a dodge window) ending in a 100 px spin cut. Step 3: a 190 px dash-jump landing in a 140 px slam, x1.6 and a 0.4 s stagger (not bosses). The full cooldown starts after step 3 or when a window lapses | 8 s / 22 |
| E Strike Air | The wind seal bursts round her: 120 px, a hit, a 0.6 s stun and a 40 px push (bosses: the hit only). It can be cast during a Q step without breaking the dash | 7 s / 30 |
| Space Mana Burst | A 160 px prana dash in 0.12 s with 0.3 s of i-frames from the cast (the dodge window), 2 charges. Opens the Crosscut window | 5 s a charge (rank scales) |
| Space finisher, Crosscut | Two golden diagonal cuts in an X, centred 105 px ahead, at the tip of the longer blade (it was at 70, mid-blade, which the user found misleading), the second 0.15 s after the first, each a basic x1.2. An enemy struck by both takes a burst of one more basic | — |
| R Unsealed Blade / Excalibur | 12 s: +30 Power (its own `powerParts` line) and Style gains x1.5. Recast **Excalibur**: hold R (up to 1 s, rooted, the sword raised, the beam's lane shown on the ground), and on release a 700 × 70 px golden beam, x1 to x2 by the charge. A hit while charging releases it at once. One beam per Unsealed; the seal runs its full time after it (the user's call after the first playtest: the beam used to end it). The 40 s cooldown starts when the seal closes | 40 s / 150, Lv. 5 |
| RMB Hammer of the Wind King | A tornado fired forward (450 px at 500 px/s) that carries enemies along and into its eye (not bosses) and hits each one every 0.15 s for a third of a basic (about 2 basics over the flight). Rock stops it | 10 s |

## Rares
- **Weapon, Caliburn:** the RMB.
- **Armour, Mail of Avalon:** once every 30 s, a blow that would kill her is a perfect dodge instead (`ssAvalon`).
- **Amulet, Seal of the Round:** a hit drops one rank, not two.
- **Boots, Prana Greaves:** Mana Burst holds 3 charges.
- **Gloves, Lionheart Gauntlets:** the thrust also sends a 250 px wave of sword-light, one basic, piercing.

## Numbers and tests (Training Room, headless, rank 1, no gear)
- **Stats:** 120 HP, armour 4, dmgMult 1.0, basicDmg 11, basicAttackCD 0.3.
- **Harness:** `SDPS` in this session's scratchpad (`44e7e316...\scratchpad\ss\`), 20 s on immortal target dummies.
  - "Mashed" casts every skill as soon as it's ready.
  - "Woven" puts a landed cut between every two skills and holds the beam a full second.

| Run | One dummy | Pack of 5 |
|---|---|---|
| Swordsaint, mashed | 48.2 | 180 |
| Swordsaint, woven | 70.6 | 259 |
| Swordsaint, mashed, Style held at D | 36.9 | — |
| Swordsaint, woven, Style held at D | 50.2 | — |
| Basics only | Style stays at D after 40 s | — |
| Dragonknight (same harness) | 54.6 | 181 |
| Monk (same harness) | 49.6 | 110 |
| Kensei (same harness) | 66.3 | 310 |
| Paladin (same harness) | — | 292 |

- **Reading the numbers:** sloppy play sits well under the Dragonknight, and woven play reaching S is the best melee single target.
- **The dummies never hit back,** so the real game will sit lower: every hit taken costs two ranks. Watch that in the playtest.

## Step 2: the web (built 2026-10-15, awaiting playtest)
The user picked the four evolution pairs from three options each (2026-10-15): the recommended one for Q, E and Space, and for R Endless Seal / Twin Moons. I designed the twigs, nodes and capstones, and the user approved the draft.

**Rules for the web:**
- **No self-healing** of any kind (no lifesteal, heals or regeneration). Max HP is fine, so Vitality stays in the passives and bridges. The user corrected me on that when I had dropped it.
- **Code:** talents in talents.js `TALENT_WEBS.swordsaint` (ids `ss_`). The effects sit inside each skill in swordsaint.js, and the visuals are in swordsaint_fx.js.
- **Twin Moons** was offered as "two half-power beams". It was given its own job (quick beams, two angles, crossed for a burst) so it isn't only Excalibur cut in two.

**Q Gale Step.** Twigs: `ss_step_far` Long Stride (dashes 170 px, leap 240), `ss_spin_wide` Wide Arc (spin 130 px). Passives might / fleet.
- **A Tempest Dance** (crowd): each spin draws enemies within 160 px in to her (`tempestPull`, `ss.shoves`). The slam launches the heap for 0.6 s: helpless and lifted (`ss.launched`, drawn through `e.mkLift`, not bosses).
  - `ss_tempest_reach` Gathering Wind: the pull reaches 220 px.
  - `ss_tempest_hang` Hang Time: launched enemies stay up 1 s.
  - `ss_tempest_style` Storm Rhythm: a spin that hits 3 or more gives +25 Style.
  - Cap `ss_tempest_eye` Eye of the Tempest: the slam leaves a cyclone for 2 s (`ss.cyclones`). It pulls enemies within 160 px and cuts each for a basic every 0.4 s.
- **B Duelist's Lunge** (single target): each step lunges through the enemy nearest the cursor within 220 px (`duelLunge`), cutting everything on the way. Two lunges through the same enemy (`ss.duel`) make the third step a plunge onto it, x3 (`duelPlunge`). A step with no one in reach is a normal step and breaks the chain.
  - `ss_duel_far` Long Lunge: lock-on from 300 px.
  - `ss_duel_mark` Challenge: a lunged enemy takes +20% from her for 4 s (`ssDmgMult`).
  - `ss_duel_precise` Precise Cuts: the lunges hit x1, then x1.3, then x1.6.
  - Cap `ss_duel_coup` Coup de Grâce: the plunge kills a non-boss under 25% HP outright, and hits a boss x4.

**E Strike Air.** Twigs: `ss_air_wide` Broad Gust (150 px), `ss_air_stun` Pressure (stun 0.9 s). Passives focus / might.
- **A Wind Cannon** (ranged control): a 450 px blast, 45 px each side (`windCannon`). It hurls enemies 150 px back; one that hits rock or another body is stunned 1.2 s (`cannonKnock`). The blast itself doesn't stun.
  - `ss_cannon_far` Long Barrel: 650 px.
  - `ss_cannon_bowl` Bowling Wind: the body it hits flies on too (70% of the distance).
  - `ss_cannon_called` Called Shot: +50 Style per slam, 2 per blast.
  - Cap `ss_cannon_twin` Second Barrel: a recast within 2 s (`ss.recast[2]`).
- **B Eye of the Storm** (gathering): everything within 240 px takes the hit and is hauled in to her, then stunned (`eyeOfStorm`; bosses only take the hit).
  - `ss_eye_far` Wide Eye: 320 px.
  - `ss_eye_shear` Shearing Pull: they take the hit again on arrival.
  - `ss_eye_center` Still Center: +20% from her while stunned (`e.ssStill`).
  - Cap `ss_eye_implode` Implosion: 5 or more pulled repeats the burst 0.5 s later (150 px, x1.5).

**Space Mana Burst.** Twigs: `ss_burst_far` Long Jet (220 px), `ss_cross_wide` Wide Cross (Crosscut 170 px). Passives fleet / vit.
- **A Counter Burst** (dodge payoff): a perfect dodge with Mana Burst (`ss.dodgeKind`) marks the attacker (`counterBurst`, `ss.counter`). When the burst lands she flashes back through them for 3 basics (`counterFlash`), once per burst. The blow lands as the burst starts, beside the attacker, so a counter at that instant had no distance to cover and looked like nothing (the user's bug report). The sparring dummy passes `{ enemy }`; other melee blows carry no source, so the attacker is then the nearest enemy within 250 px. Without Return Fire, a dodged shot (the sparring dummy's bolt too) gets no counter.
  - `ss_counter_charge` Flowing Counter: the charge comes back.
  - `ss_counter_shot` Return Fire: dodged shots count too. She flashes to the shot's `owner`, or to whoever stands back along its line, up to 450 px.
  - `ss_counter_stun` Disarm: a 1 s stun.
  - Cap `ss_counter_time` Time Stands Still: a counter in bullet time adds 1 s to it.
- **B Overdrive** (an aggressive line): the burst cuts everything it passed through for a basic (`overdrive`), plus 15 Style per enemy, 3 at most.
  - `ss_over_far` Afterburner: 240 px.
  - `ss_over_wake` Prana Wake: blue fire for 1.5 s, half a basic every 0.3 s. One tick at a time per enemy however many wakes it stands in (`e.ssWakeAt`).
  - `ss_over_momentum` Momentum: cutting 3 or more takes 1 s off the next charge.
  - Cap `ss_over_crossfire` Crossfire: a Crosscut right after an Overdrive also lands, at half power, on up to 3 of the enemies it cut, each X striking only its own enemy.

**R Unsealed Blade / Excalibur.** Twigs: `ss_unseal_long` Long Unsealing (15 s), `ss_beam_wide` Broad Light (beam 100 px wide). Passives focus / might.
- **A Endless Seal** (a sustained stance): each perfect dodge while Unsealed adds 2 s (`ssExtendSeal`).
  - `ss_seal_flow` Flowing Seal: every 50 Style gained while Unsealed adds 0.5 s.
  - `ss_seal_crescendo` Crescendo: +5 Power per 2 s Unsealed, +30 at most (`ssUnsealPower`).
  - `ss_seal_golden` Golden Hour: while Unsealed, bullet time lasts 1.5 s and can come every 2 s.
  - Cap `ss_seal_ever` Everlasting Light: Excalibur can be fired again every 6 s while the seal lasts.
- **B Twin Moons** (quick beams, two angles): the recast fires twice (`ss.moons`), charges in 0.5 s, each beam x0.6 to x1.2; the seal runs on after the last.
  - `ss_moon_cross` Crossing Moons: where two beams cross (`ssCrossPoint`), a 90 px burst for the beam's hit.
  - `ss_moon_rhythm` Double Rhythm: each beam is a new Style action, and +25% within 1 s of the last.
  - `ss_moon_step` Moonlit Step: each beam gives a Mana Burst charge.
  - Cap `ss_moon_third` Third Moon: a third beam.

**Bridges:** Q-E might, E-R focus, R-Space fleet, Space-Q vit.

**Tests (headless, woven rotation, every skill rank 3, each evolution with all its nodes; DPS on one dummy / on a pack of 5):**

| Setup | One dummy | Pack of 5 |
|---|---|---|
| No evolution | 85 | 315 |
| Q-B, E-A, Space-A, R-B | 160 | 421 |
| Q-A, E-B, Space-B, R-A (the gather build) | 162 | 827 |
| Monk, everything A / everything B | 92 / 170 | 235 / 319 |
| Dragonknight, everything A / everything B | 101 / 101 | 503 / 299 |
| Paladin, everything A / everything B | 193 / 152 | 501 / 421 |

- The other classes were run with the mashed rotation.
- Overdrive was the outlier at first (pack 1475 in the gather build). Three fixes brought it down:
  - Momentum gave the charge back on every pack burst; it now takes 1 s off instead.
  - Crossfire's X's hit their neighbours too; they now strike only their own enemy, half power, 3 at most.
  - Prana Wakes stacked; an enemy now takes one tick at a time.
- **Watch:** the gather build on real packs. The dummies stand still in a clump and never hit back, which is its best case.
