# The Monk

A melee bruiser with fast fists, a lot of mobility and lifesteal for sustain (design agreed with the user, 2026-10-14). Step 1, the kit, is built and awaits playtest in the Training Room. Code: `js/monk.js` (mechanics), `js/monk_fx.js` (visuals). Class id `monk`, name `Monk`, weapon `fists`.

## Core rules
- **Every key has a recast within a short window.** The cast sets only a 0.3 s gap on the cooldown (`mkOpen`); the full cooldown starts when the recast is used or the window lapses (`mkClose`, `updateMonk`), as the Nightblade's Shadow Return. The skill bar shows an open window as a gold draining ring.
- **Flurry of Blows** (passive): every cast or recast, the RMB included, stores a charge (`mk.flurry`, 2 at most). The next basic spends one and becomes 4 blows over 0.3 s, each half a basic, in a 95 px, 80 degree cone (all enemies in it). Each blow that lands adds 6 Chi.
- **Chi** (`mk.chi`, 0-100, drains 10/s after 6 s without hitting or being hit): at 100 the next flurry is a **Hundred-Hand Strike**: 8 blows over 0.5 s in a 110 px, 100 degree cone, then a 120 px shockwave (basic x2.5, 120 px knockback). It spends all Chi and builds none. One strike on one target is 6.5 basics, a plain flurry 2.
- **Basic** (`fists`): an alternating jab, one target in a 90 px cone. Source `melee_basic` (hit-stop); flurry blows use `melee` except the last, so a flurry has one hit-stop.

## The keys
| Key | Cast | Recast (window) | CD / base |
|---|---|---|---|
| Q Chi Wave / Rushing Fist | A chi bolt (1400 px/s, 600 px) that marks the first enemy it hits for 3 s; a miss runs the full cooldown | (3 s) Dash to the mark and strike: x1 to x2 by its missing HP | 6 s / 40 |
| E Earth Palm / Crippling Tremor | 130 px blast 70 px ahead of you, marks everything it hits (3 s); no hit, no window | (3 s) Marked enemies within 500 px are slowed 60%, fading over 2 s | 8 s / 45 |
| Space Swift Step / Iron Will | Dash 220 px toward the cursor through enemies (opens the Crane Kick window) | (3 s) 4 s of lifesteal: 12% + 3% a rank (15 / 18 / 21%); no finisher window | 6 s (rank scales) / 0 |
| R Dragon Kick / Dragon's Descent | Kick the enemy within 100 px nearest the cursor 350 px along the aim: x0.6 on it and on everything it bowls through (they are stunned 0.6 s); into rock, a boulder or the map's edge x0.9 and 1 s stun. A boss isn't launched: it takes x0.9 and a 40 px shove. No target: refused, nothing spent. Pods and kegs aren't targets | (2 s, from the landing) Leap there (arc dash) and stomp 140 px for x0.8 | 14 s / 120, Lv. 5 |

Space finisher **Crane Kick** (`craneKick`, combos.js): 110 px all round, basic x2.5, 80 px knockback. It keeps the flurry charge. RMB **Iron Body** (rare weapon, 10 s): 1.5 s of -50% damage taken, roots and traps can't hold you, and a 140 px pulse at the end (basic x2, 110 px knockback).

## Rares
Weapon Dragon Fang Wraps (RMB Iron Body). Armour Robes of the Still Mountain: lifesteal past full health becomes a shield. Amulet Hundred-Bead Rosary: Chi fills 50% faster. Boots Cloudstep Sandals: Swift Step 30% farther, its window 4.5 s. Gloves Tiger Claw Wraps: a flurry throws 2 more blows.

## Numbers and tests (Training Room, headless, rank 1, no gear)
Stats: 130 HP, armour 3, dmgMult 1.1, basicDmg 10, basicAttackCD 0.25 (0.4 s a jab). A jab is 6.6 damage, a flurry 13.2, a Hundred-Hand Strike 42.9 (26.4 in blows, 16.5 in the shockwave). 20 s on one dummy with a greedy rotation (every skill and recast as soon as ready, a fresh click after each Space for the finisher): Monk 49.6 DPS, Dragonknight 54.6-57.1, Kensei 66.3-68. Skill bases started at 30 / 35 / 90 (Q / E / R) and were raised to 40 / 45 / 120 after the first run gave 42.7. The Monk's strength is meant to be crowds (flurry cone, Palm, Crane Kick, bowling) and sustain, so single-target DPS sits a little under the Dragonknight's.

## Step 2: the web (built 2026-10-15, awaiting playtest)
The user picked the four evolution pairs from three options each (2026-10-15); the twigs, nodes and capstones were designed to fit them. Talents in talents.js `TALENT_WEBS.monk` (ids `mk_`), effects in monk.js ("the web" section), visuals in monk_fx.js. Chi has no separate second use: the web feeds it (Focused Chi, Inner Dragon, Gathering Storm) and hands out free Hundred-Hand Strikes (Seven Stars, Tiger's Frenzy). Iron Body stays the rare weapon's and is not in the web. Crane Kick scales with Crane Wings.

**Q Chi Wave / Rushing Fist.** Twigs: `mk_wave_far` Long Reach (the wave flies 900 px, was 600), `mk_wave_chi` Focused Chi (a wave that hits gives 15 Chi). Passives might / fleet.
- **A Seven-Star Rush** (chain execution, mobility): a Rushing Fist that kills marks the nearest enemy within 350 px of it and reopens the window, up to 6 rushes a cast.
  - `mk_star_far` Shooting Star: the next star can be 500 px away.
  - `mk_star_heal` Star's Breath: a rush that kills heals 3% Max HP.
  - `mk_star_splash` Falling Star: every rush also strikes everything within 70 px of its target (x0.4).
  - Cap `mk_star_seven` Seven Stars: up to 7 rushes, and a chain of 3 or more ends in a Hundred-Hand Strike where you stand, without spending Chi.
- **B Resonating Mark** (single-target setup): while the mark lasts it stores 30% of all the damage you deal its enemy; Rushing Fist detonates the store on top of its strike.
  - `mk_res_long` Lingering Echo: the mark and its window last 5 s (was 3).
  - `mk_res_deep` Deep Resonance: it stores 45%.
  - `mk_res_spread` Sympathetic Echo: the detonation also hits enemies within 120 px for half the store.
  - Cap `mk_res_twice` Echo of Echoes: after the detonation the mark comes back once more for 3 s, for a second recast.

**E Earth Palm / Crippling Tremor.** Twigs: `mk_palm_wide` Broad Palm (170 px, was 130), `mk_palm_daze` Stunning Palm (the palm staggers 0.4 s, not bosses). Passives vit / might.
- **A Gathering Palm** (grouping): the recast pulls every marked enemy within 500 px into a heap 60 px in front of you, staggered 0.5 s (bosses are only tugged 60 px).
  - `mk_gather_far` Long Arms: from 700 px.
  - `mk_gather_slow` Heavy Earth: the gathered are slowed as by the Tremor (60%, fading over 2 s).
  - `mk_gather_chi` Gathering Storm: 5 Chi per enemy gathered.
  - Cap `mk_gather_quake` Collapse: when they land, the heap is struck by an earth slam (the palm's hit, 150 px) and stunned 1 s (not bosses).
- **B Stone Skin** (defence): every enemy the palm marks gives a shield of 5% Max HP (up to 5) for 6 s. The recast hardens it: while it holds, roots, traps and knockbacks can't move you, and when it breaks it bursts outward (140 px, the palm's hit x0.6, a 100 px push).
  - `mk_stone_thick` Granite: 7% a mark.
  - `mk_stone_thorns` Jagged Stone: while hardened, enemies touching you take a basic every 0.5 s.
  - `mk_stone_spring` Mountain Spring: if the stone runs out unbroken, what's left of it heals you.
  - Cap `mk_stone_avalanche` Avalanche: the burst reaches 200 px, stuns 1 s (not bosses) and gives back half of Earth Palm's cooldown.

**Space Swift Step / Iron Will.** Twigs: `mk_step_far` Long Stride (+80 px), `mk_crane_wide` Crane Wings (Crane Kick reaches 150 px, was 110, and pushes 120, was 80). Passives fleet / vit.
- **A Tiger's Path** (offensive dash): the step strikes everything it passes (basic x1.5 each, 6 Chi each); 3 or more struck give an extra flurry charge. Iron Will stays.
  - `mk_tiger_mark` Tiger's Mark: enemies struck take +15% damage from you for 3 s.
  - `mk_tiger_prowl` Prowl: each enemy struck takes 0.5 s off Swift Step's cooldown (up to 2 s).
  - `mk_tiger_blood` Blood Trail: each enemy struck heals 1.5% Max HP (up to 6%).
  - Cap `mk_tiger_frenzy` Tiger's Frenzy: a step that strikes 3 or more makes your next flurry a Hundred-Hand Strike, without spending Chi.
- **B Karmic Will** (tank, counterpunch): Iron Will keeps its lifesteal; for its 4 s you take 25% less and everything you take is stored. When it ends, a shockwave round you deals the store x2 (at least two basics), 160 px, a 100 px push.
  - `mk_karma_long` Long Will: Iron Will lasts 6 s.
  - `mk_karma_taunt` Provoke: Iron Will draws the non-bosses within 250 px to you for 1.5 s (they walk in and hold their attacks).
  - `mk_karma_heal` Balance: the shockwave heals you for 25% of the store.
  - Cap `mk_karma_wheel` Wheel of Karma: the store hits x3 and the shockwave stuns 1 s (not bosses).

**R Dragon Kick / Dragon's Descent.** Twigs: `mk_kick_far` Long Kick (the body flies 500 px, was 350), `mk_kick_chi` Inner Dragon (the kick gives 40 Chi). Passives focus / might.
- **A Pinball Kick** (crowd chaos): the kicked body bounces off rock, boulders, the map's edge and enemies up to 3 times (each bounce gives it at least 220 px more flight). A wall bounce hits it for x0.5; an enemy it bounces off takes the kick's x0.6 and the 0.6 s stun. Descent still follows it.
  - `mk_pin_more` Extra Ball: 5 bounces.
  - `mk_pin_speed` Gathering Speed: each bounce +25% to everything after it.
  - `mk_pin_ring` Ringing Blow: its stuns last 1.2 s (was 0.6) and the final slam's 1.5 s (was 1).
  - Cap `mk_pin_multi` Multiball: the first enemy it bounces off is launched too, bouncing on its own (not bosses).
- **B Rising Dragon** (single-target burst): the kick launches the enemy straight up for 1.5 s, out of the fight (not bosses). The recast leaps up after it: 6 blows in the air (x0.15 each, 0.5 s), then you spike it down (x1 on it, a 140 px shockwave x0.6 round it). Left alone it falls for x0.3. A boss isn't launched (the kick's x0.9 and the shove as before): the recast is the same combo on the ground.
  - `mk_rise_wings` Hundred Wings: 10 blows in the air.
  - `mk_rise_sunder` Skyward Sunder: the launched enemy takes +25% damage from you while it's up and 3 s after.
  - `mk_rise_meteor` Meteor Spike: the shockwave reaches 200 px and stuns 1 s (not bosses).
  - Cap `mk_rise_endless` Endless Sky: the spike bounces it back up once, for a second recast within 1.5 s.

**Bridges:** Q-E might, E-R vit, R-Space focus, Space-Q fleet.
