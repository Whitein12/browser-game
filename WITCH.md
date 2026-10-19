# The Witch

A necromancer who poisons crowds, hexes her foes into toads and raises the fallen as a horde of zombies (design agreed with the user, 2026-10-15). Step 1, the kit, is built and awaits playtest in the Training Room. Code: `js/witch.js` (mechanics), `js/witch_fx.js` (visuals). Class id `witch`, name `Witch`, weapon `blightstaff`.

## The user's decisions (2026-10-15)
- **From the user's brief:**
  - the basic is a poison spray;
  - E raises souls left by kills as destructible minions that draw enemies in;
  - Space is a broom flight, drawn side-on, following the cursor;
  - the Space finisher is basic attack during the flight, which leaves a toxic trail;
  - R is an AoE polymorph.
- **Picked from options:**
  - Q Grave Hex;
  - the polymorph turns enemies into toads and holds through damage;
  - the broom is airborne for 1.5 s and the recast lands her;
  - the gauge shows Souls;
  - minions last until killed, with a slow decay;
  - RMB Dark Pact;
  - passive Contagion.
- **Minions:** zombies first; the web's evolutions change them into other minions.

## Core rules
- **Poison** (`e.wtPoison = { n, t, per }`):
  - A stack deals one basic over 3 s.
  - Each new stack refreshes the timer.
  - 5 stacks at most (8 with the gloves).
  - Ticks are `'dot'` damage.
- **Contagion** (passive): when a poisoned enemy dies, its stacks jump to the 3 nearest enemies within 120 px, each with a fresh timer.
- **Souls** (`wt.souls`, 15 s on the ground):
  - A kill leaves one 35% of the time.
  - A Hexed or toad enemy always leaves one.
  - A boss sheds one for every 10% of its max HP it loses (my addition, so the E works in boss fights; easy to drop).
  - Training dummies leave them too.
  - The gauge orb shows the souls within 450 px.

## The keys
| Key | What it does | CD / base |
|---|---|---|
| Basic, Poison Spray | A steady stream while LMB is held (a tick every 0.1 s, attack speed shortens it): a 150 px, 50 degree cone. Every 0.45 s of spraying, each enemy in it takes 40% of a basic and a poison stack, dealt a fraction per tick (the stacks build gradually). Its numbers merge like a DoT's | / 12 |
| Q Grave Hex | A 110 px circle at the cursor (500 px reach): a hit, and 6 s of Hex (poison x1.3, a sure soul) | 8 s / 30 |
| E Raise Dead | Every soul within 450 px rises as a zombie, up to 6 alive. It needs at least 2 souls, or it's refused and nothing is spent. Each zombie: 30% of her Max HP (rank-scaled), decays 5% a second (about 20 s), claws for base x rank every 0.9 s, and taunts non-bosses within 180 px every 0.5 s. Bodies touching a zombie bite it for their damage x0.6 once a second (bosses too); enemy shots that cross one stop on it | 10 s / 9 |
| Space Broom Flight | She flies 500 px/s for 1.8 s, and each rank adds 0.2 s and 6% speed (rank 4: 2.4 s at 590 px/s). She turns toward the cursor (8 rad/s at 500 px/s, faster with the speed, so the turning circle stays the same). Airborne (z 22) over ravines, lakes, boulders and traps; walls still stop her. Only shots can hit her. Space again lands her; the full cooldown starts on landing | 8 s (rank scales) |
| Space finisher, Toxic Trail | A fresh LMB press after take-off pours a trail for the rest of the flight. It lingers 3 s, deals 1.2 basics a second to anything on it, and adds a poison stack every 0.5 s. A button held from before the cast does nothing | — |
| R Hex of the Toad | A 180 px circle at the cursor (600 px reach): a hit, and every non-boss becomes a toad for 4 s. A toad has no AI and no attacks, hops about at 40% speed, and takes +25% damage. Bosses shrink and are slowed 40% for 3 s | 18 s / 60, Lv. 5 |
| RMB Dark Pact | The zombie nearest the cursor bursts: 140 px, 3 basics and 2 poison stacks, and she heals for its remaining HP. With no zombie, nothing is spent | 6 s |

The toxic trail breaks combos.js's rule ("nothing happens on the dash itself"): its payoff comes during the flight. This is the user's design, and it still needs a deliberate press after the cast.

## Rares
| Slot | Name | Effect |
|---|---|---|
| Weapon | Gravewood Staff | RMB Dark Pact |
| Armour | Shroud of the Coven | -4% damage taken for each living zombie, up to 20% |
| Amulet | Bone Phylactery | Souls drop 50% more often |
| Boots | Midnight Broom | The flight lasts 0.7 s longer |
| Gloves | Blightweaver Gloves | Poison stacks to 8 |

## Changes after the first look (2026-10-15)
- **The basic is a continuous spray, not bursts.** Its damage per second is unchanged.
- **Broom Flight is faster and longer:** 500 px/s for 1.8 s, was 430 px/s for 1.5 s. Its ranks raise its duration and speed as well as cutting the cooldown.

## Numbers and tests (Training Room, headless, rank 1, no gear)
- **Stats:** 115 HP, armour 2, dmgMult 1.0, basicDmg 12, basicAttackCD 0.3.
- **Hit sizes:**
  - A spray's up-front hit is 2.9 per enemy, and its poison stack 7.2 over 3 s.
  - A zombie's claw is 5.4, every 0.9 s.
- **The test:** 20 s with a greedy rotation (each skill as soon as it's ready, a fresh press on every flight), with the Monk measured in the same harness.

| Setup | Witch | Monk |
|---|---|---|
| One dummy, no souls | 32 DPS | 45 DPS |
| One dummy, a full horde of 6 for the whole run | 66 DPS | — |
| Pack of 5 dummies, no souls | 144 DPS | 103 DPS |
| Pack of 5 dummies, a full horde of 6 | 173 DPS | — |

- **Tuning so far:** the zombie claw started at base 20, which gave 107 DPS with a horde, and was lowered to 9.
- **How she lands:** her strength is crowds (the cone, poison on everything, Contagion, the trail) and her horde. On a single target alone she sits under the Monk.
- **The full-horde numbers flatter her:** the dummy never bites, so the zombies live their whole 20 s.

**Watch in the playtest:**
- How often a real fight keeps the horde up.
- Whether bosses melt the zombies too fast.
- Whether the pack damage is too high.

## Step 2: the web (built 2026-10-15, awaiting playtest)
- **E's pair is the user's:** armed melee zombies and skeleton archers.
- **Q, Space and R:** the user picked each pair from three options.
- **The rest is mine:** the twigs, the nodes and the capstones, designed to fit.
- **Code:** talents in talents.js `TALENT_WEBS.witch` (ids `wt_`), effects in witch.js, visuals in witch_fx.js.
- **One raise path:** every raise goes through `raiseMinion` (E, Soul Sweep, Open Grave, Forever Yours), which honours the horde cap of 6. A minion keeps the kind it rose as.

**Q Grave Hex.** Twigs: `wt_hex_wide` Wide Circle (150 px, was 110), `wt_hex_long` Lingering Curse (9 s, was 6). Passives might / focus.
- **A Grave Pull** (grouping): hands drag everything caught to the circle's centre over 0.3 s (bosses are tugged 40 px).
  - `wt_pull_root` Grasping Hands: rooted 1.5 s (not bosses).
  - `wt_pull_miasma` Choking Miasma: 2 poison stacks each.
  - `wt_pull_crush` Crushing Grip: the heap takes the hex's hit again.
  - Cap `wt_pull_grave` Open Grave: a grave at the centre for 4 s that slows 50%; enemies that die in it rise at once as minions, no soul needed.
- **B Soul Leech** (sustain): poison on hexed enemies heals her 15% of its damage, at most 3% Max HP a second.
  - `wt_leech_deep` Deep Leech: 25%.
  - `wt_leech_feast` Shared Feast: minions within 300 px are mended the same.
  - `wt_leech_hoard` Hoarded Life: overflow becomes a shield, up to 15% Max HP.
  - Cap `wt_leech_siphon` Soul Siphon: a hexed enemy that dies heals 5% Max HP and leaves 2 souls.

**E Raise Dead.** Twigs: `wt_raise_far` Far Call (souls from 650 px, was 450), `wt_raise_tough` Grave Toughness (+30% minion HP). Passives vit / might.
- **A Grave Knights** (the front line): rusted mail, a kettle helm, a split shield and a notched sword. HP x1.5, swing x1.8, and they draw enemies from 260 px (was 180).
  - `wt_knight_cleave` Cleave: the swing hits everything in its arc.
  - `wt_knight_guard` Shield Wall: -35% damage taken.
  - `wt_knight_charge` Charge: a knight charges the first enemy it sets on, 60-260 px away, and stuns it 0.8 s.
  - Cap `wt_knight_undying` Undying Legion: a knight gets back up once at half HP (not when sacrificed to Dark Pact).
- **B Skeleton Archers** (damage from behind her): they keep their own spots 70-100 px round her and shoot the nearest enemy within 450 px every 1.1 s, x1.6 a shot. HP x0.7, and they draw no enemies.
  - `wt_skel_volley` Split Shot: every third shot is three arrows.
  - `wt_skel_venom` Venom Tips: half a poison stack an arrow.
  - `wt_skel_pierce` Bodkin: arrows pierce one enemy.
  - Cap `wt_skel_rain` Bone Rain: every 6 s, a rain on their target, 120 px, two shots from each archer.

**Space Broom Flight.** Twigs: `wt_broom_fumes` Lasting Fumes (the trail lingers 5 s and is 40% wider), `wt_broom_after` Afterglide (+50% move speed for 2 s after landing). Passives fleet / vit.
- **A Swoop** (offense): Space again dives her at the cursor (250 px at most). The crash hits for Broom Flight's base (40) and adds 2 poison stacks within 130 px, with an 80 px shove. She stays side-on through the dive (`player.wtSwoop`).
  - `wt_swoop_wide` Great Crash: 180 px.
  - `wt_swoop_stun` Brutal Landing: 0.8 s stun.
  - `wt_swoop_saddle` Back in the Saddle: 0.5 s off the cooldown per enemy hit, up to 3 s.
  - Cap `wt_swoop_crater` Toxic Crater: a 150 px poison pool for 4 s, a stack every 0.5 s.
- **B Soul Sweep** (economy): the broom gathers souls within 60 px of its path; on landing they rise round her at once. With the horde full they wait on the ground.
  - `wt_sweep_wide` Wide Sweep: 120 px.
  - `wt_sweep_warm` Soul Warmth: 2% Max HP a soul.
  - `wt_sweep_fresh` Fresh Recruits: landing heals every living minion to full.
  - Cap `wt_sweep_reap` Reaper's Ride: non-bosses under 15% HP that she flies over are reaped, each leaving a soul.

**R Hex of the Toad.** Twigs: `wt_toad_wide` Wide Hex (230 px, was 180), `wt_toad_long` Long Croak (5.5 s, was 4). Passives focus / might.
- **A Toad Plague** (damage): when the hex ends or a toad dies, it bursts: half the hex's hit and 2 poison stacks within 90 px. Plague toads are bloated, with pustules.
  - `wt_plague_big` Bloated: 130 px.
  - `wt_plague_virulent` Virulent: 4 stacks.
  - `wt_plague_chain` Chain Croak: an enemy caught in a burst turns into a toad for 2 s, once each and not bosses, and bursts in turn.
  - Cap `wt_plague_pond` Plague Pond: each burst leaves a 70 px pond for 4 s, a stack every 0.5 s and a 30% slow.
- **B Familiar Toads** (charm): the toads hop at the nearest enemy that isn't a toad and lash it with their tongues (30 px past the bodies) for 15% of the hex's hit every 0.8 s. They wear a violet collar.
  - `wt_fam_venom` Venomous Bite: a poison stack a bite.
  - `wt_fam_lure` Croaking Lure: they draw the non-bosses within 200 px.
  - `wt_fam_loyal` Loyal: +2 s.
  - Cap `wt_fam_forever` Forever Yours: when the hex ends, every familiar still alive dies and rises as a minion.

**Bridges:** Q-E might, E-R vit, R-Space focus, Space-Q fleet.

**Tested headless:** every evolution and capstone (scratchpad `wt\scen_web.mjs`).
- With all four nodes, 6 skeleton archers dealt about 90 DPS to each of two dummies 50 px apart.
- 6 Grave Knights with Cleave dealt about 100 DPS to a sparring dummy beside a second one.
- Both are full hordes on dummies that don't bite back. **Watch the archers' damage in the playtest.**

**Fix found on the way:** the minions' hit flash painted a pale box over the ground (a `source-atop` fill on the main canvas). It is now a white wash over the body.
