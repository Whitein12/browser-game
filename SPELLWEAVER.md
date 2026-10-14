# The Spellweaver rework: the wizard who knows the most spells

Design doc for the Spellweaver's class rework (CAMPAIGN.md step 1; the class was left out of CLASS_WEBS.md for this). Read the decisions first, then the spellbook.

## Identity (the user, 2026-10-14)

Subclasses were considered and dropped: only one class would have them, and they'd make it weird. Instead, like a D&D wizard, the Spellweaver **knows the most spells**. The player builds their own Spellweaver at character creation by choosing a loadout from a big spellbook. The builds the user named:
- a **zoner** who places exploding runes on the ground;
- an **immobile demolitioner**;
- a **zapper** with a movement spell on all four keys.

## Decisions (the user, 2026-10-14)

- **Keys:** any spell goes on any key (Q / E / Space / R are just keys). **Greater spells** (Meteor-class) are limited to one per loadout and unlock at Lv. 5 (the R's gate moves to them). The Space → basic finisher window opens from any movement spell, on any key.
- **The web:** the same shape as every class. Each branch ranks whatever spell sits on that key; its fork is **that spell's own A/B evolution**. Under the evolution: three **school talents** (shared by every spell of that school) and a **spell-specific capstone**, so twenty spells don't need 160 talents. A branch whose spell changes refunds its points.
- **Schools are playstyles**, elements are only flavor: Evocation (the demolitioner), Glyphcraft (the zoner), Translocation (the zapper), Abjuration (control and wards). About five spells each, one of them Greater.
- **Learning spells:** pick 4 at creation from the starting book; rarer spells are learned from **scrolls** (bosses, the merchant), like a wizard copying spells. The loadout is swapped in the hub and on the stage-cleared screens. Until campaign step 2 exists, a loadout screen follows the class carousel (like the Druid's companion choice), and the Training Room opens the whole book.
- **Kept:** Resonance (every spell stores a charge, basics spend it) stays the engine, since it works with any spell. The staff basic stays. Arcane Beam stays the rare weapon's RMB. The combos become spell pairings to discover (Frostfire, Ice Wall, Blink Lance; more to come).

## The spellbook (approved 2026-10-14, built: js/spellweaver.js)

Cooldowns are first guesses. ★ = Greater.

**Evocation: the demolitioner** (raw damage, charge-ups)
- **Fireball** (kept): a fast bolt that explodes. 2 s.
- **Magic Missile**: three homing darts that never miss. A cheap Resonance engine. 1.5 s.
- **Chain Lightning**: a bolt that jumps between up to 4 enemies. 3.5 s.
- **Arcane Cannon**: hold to charge (rooted while charging), release a huge piercing orb; bigger the longer. 6 s.
- ★ **Meteor** (kept): a marked impact after a delay. 10 s.

**Glyphcraft: the zoner** (runes on the ground)
- **Explosive Rune**: a rune at the cursor that arms in 0.5 s and blows when an enemy steps on it. Up to 3 out. 2.5 s.
- **Rune of Binding**: a rune that roots whatever steps on it. 4 s.
- **Storm Glyph**: a circle that zaps everything inside every 0.5 s for 4 s. 6 s.
- **Runic Detonation**: every rune you have out explodes now at x1.5; with none out, it drops one under you. 5 s.
- ★ **Runestorm**: scatters 8 explosive runes across the cursor area at once: a minefield. 12 s.

**Translocation: the zapper** (every spell moves you)
- **Blink** (kept): an instant teleport to the cursor. 4 s.
- **Flicker**: three short blinks on charges, each recharging on its own.
- **Ride the Lightning**: you become a bolt and dash through enemies, hitting everything on the line. 5 s.
- **Arcane Anchor**: drop an anchor; recast within 5 s to snap back to it. 8 s.
- ★ **Time Stop**: time freezes for 2.5 s. Enemies and their shots stand still while you move, and what you cast lands when time resumes. 16 s.

**Abjuration: control and wards**
- **Frost Nova** (kept): chills and slows everything around you. 5 s.
- **Arcane Ward**: a shield that bursts outward when it breaks or runs out. 8 s.
- **Spell Mirror**: a 0.6 s barrier that sends enemy shots back at their shooters. 6 s.
- **Gravity Well**: a zone at the cursor that slows and drags enemies to its centre for 3 s. 8 s.
- ★ **Blizzard**: a storm over the cursor area for 5 s; heavy slow, and enemies inside for 2 s freeze. 14 s.

**Starting book vs scrolls** (proposed): the starting book holds 3 lesser spells per school plus Meteor and Blizzard. The scrolls hold the 4th lesser spell of each school and Runestorm and Time Stop, dropped by bosses across the Caves and the Bastion.

## Evolutions (the user, 2026-10-14)

**Structure:** each school has two themes (A / B); each of its four lesser spells gets its own version of both. The talents under a theme (three and a capstone) are shared by the school: taken under one spell's evolution, they count for every spell of that school on that path. The Greater spells get their own custom pairs and talents. The user reviews one full proposal per school and edits it.

### Evocation (approved): A Artillery (stand far back: delayed bombardments, big areas) / B Point Blank (in the crowd: blasts, cones, knockback)

| Spell | A, Artillery | B, Point Blank |
|---|---|---|
| Fireball | **Fire Mortar**: lobbed onto the cursor (0.6 s fuse), 140 px blast, burning ground for 3 s | **Flame Burst**: a short wide cone of fire that knocks back |
| Magic Missile | **Missile Rain**: the darts come down on the 3 enemies nearest the cursor anywhere within 900 px, over walls | **Arcane Shotgun**: 7 darts in a tight spread, x2 point-blank falling to x0.5 at the end of their range |
| Chain Lightning | **Thunderhead**: mark a circle; 3 sky bolts strike enemies in it over 1.5 s, each arcing to 2 more | **Arc Field**: lightning jumps from you to every enemy within 200 px at once, shocking them |
| Arcane Cannon | **Siege Lance**: a 2 s charge, a beam across the whole screen at x2 | **Repulsor**: the charge goes off as a ring around you, hurling enemies away; a full charge stuns 1 s |

- A talents: Rangefinder (+30% area), Siege Stance (after 1 s standing still, Evocation spells +20%), Bombardier (artillery hits slow 40% for 2 s); cap **Carpet Bombing** (every artillery impact sets off 3 small aftershocks).
- B talents: Recoil (a point-blank spell pushes you back a step), Concussive (knocked into a wall: 1 s stun), Close Call (15% less damage taken for 2 s after a point-blank spell); cap **Overpressure** (a point-blank spell hitting 3+ enemies takes 1 s off every Evocation cooldown).
- **Meteor** A **Meteor Shower**: 5 smaller meteors over 2 s that follow the cursor (Wide Shower, Molten Shards: impacts burn, Steady Gaze: move freely while it rains; cap **Cataclysm**: the last meteor is a full-size one at x3). B **Moonfall**: a 3 s fall, a 300 px impact at x3, its shadow drags enemies to the centre while it falls (Event Horizon: stronger pull, Crater: slowing ground, Tremor: 1.5 s stun; cap **Extinction**: kills from it refund half its cooldown).

### Glyphcraft (approved): A Warden (runes stay as territory: they last, rearm, link) / B Brander (runes carved onto enemies: the zone walks into the pack)

| Spell | A, Warden | B, Brander |
|---|---|---|
| Explosive Rune | **Rearming Rune**: after it blows it rearms in 1.5 s, up to 3 blasts | **Searing Brand**: brands the enemy nearest the cursor; it explodes after 2 s, or at once when a charged bolt hits it |
| Rune of Binding | **Ward Circle**: a 120 px circle enemies can't enter for 3 s (pushed out; shots still fly in) | **Shackle Brand**: chains the branded enemy to the 2 nearest; a hit on one deals 30% to the others |
| Storm Glyph | **Glyph Network**: links to every rune of yours within 300 px with lightning lines that zap enemies crossing them | **Storm Brand**: a walking storm on an enemy, zapping everything within 120 px every 0.5 s for 4 s |
| Runic Detonation | **Sanctum**: runes don't blow; each pulses, shoving enemies away, and gives a 15 shield per rune | **Contagion**: every brand detonates at x1.5 and leaps to the nearest unbranded enemy |

- A talents: Deep Etching (runes last 40 s, one more of each), Rune Ward (within 100 px of your rune: 15% less damage), Quick Scribe (runes arm instantly); cap **Domain** (3+ of your runes within 250 px: spells cool down 30% faster, runes trigger from 50% farther).
- B talents: Branding Iron (brands last 2 s longer), Hex (branded enemies take +15% from you), Contagious (a branded enemy that dies passes its brand on); cap **Mark of Ruin** (an enemy with two different brands erupts for x3).
- **Runestorm** A **Rune Wall**: the 8 runes in a line across the cursor's path (Long Wall: 12 runes, Barbed Line: crossing slows, Rearm: each rearms once; cap **Iron Curtain**: enemy shots can't cross it). B **Hex Storm**: brands the 8 enemies nearest the cursor, all go off together after 2 s (Wider Net: 12, Short Fuse: 1 s, Hexfire: the blasts burn; cap **Doom Sigil**: kills explode for x1 in 100 px).

### Translocation (approved): A Echo (where you were keeps fighting: afterimages that cast, taunt, burst) / B Displacer (your movement moves enemies: drag, send away, yank)

| Spell | A, Echo | B, Displacer |
|---|---|---|
| Blink | **Mirror Image**: an afterimage at the start draws non-bosses for 2 s, then bursts | **Relocation**: everything within 120 px of where you land is flung back to where you left |
| Flicker | **Afterimages**: each flicker leaves an image that fires a dart at the nearest enemy 0.4 s later | **Undertow**: each flicker drags the enemies near your start along; they land around you |
| Ride the Lightning | **Static Trail**: the path stays charged for 3 s, zapping enemies crossing it | **Lightning Tether**: enemies passed through are yanked to your landing 0.3 s later and stunned briefly |
| Arcane Anchor | **Doppelganger**: the anchor is an echo that recasts every spell you cast while it's out, from its spot, at 50% | **Grapple Anchor**: throw it onto an enemy; recast yanks it to you (a boss pulls you to it) |

- A talents: Lasting Echoes (+50% afterimage time), Echo Resonance (an echo's hit stores a Resonance charge), Haunting (every echo draws non-bosses briefly); cap **Legion** (every movement spell leaves one more echo, recasting your last non-movement spell at 40%).
- B talents: Disorient (displaced enemies stunned 0.5 s), Dislocate (displaced enemies take +20% from you for 3 s), Long Reach (+50% displacement radius); cap **Rift Collapse** (enemies displaced into each other collide for x1.5 and are stunned).
- **Time Stop** A **Stasis Field**: time stops only in a 300 px bubble at the cursor for 5 s, hits on its enemies held (Wider Field, Long Stasis: 7 s, Accumulate: held hits +50%; cap **Shatter Point**: everything inside stunned 1.5 s when it ends). B **Rewind**: 3 s later you snap back to where you were with the HP you had, other cooldowns reset (Second Chance: a lethal hit before it triggers the rewind instead, Temporal Blast: your return bursts, Quick Rewind: 2 s; cap **Paradox**: spells cast in between are cast again from the return spot).

### Abjuration (approved): A Aegis (the spells protect you: absorb, block, punish) / B Lockdown (the spells hold enemies: trap, freeze, stun, then cash in)

| Spell | A, Aegis | B, Lockdown |
|---|---|---|
| Frost Nova | **Ice Armor**: the frost coats you for 4 s: 20% less damage taken, melee attackers freeze 1 s | **Shatter Nova**: chilled enemies freeze solid for 1.5 s; your next hit on a frozen one shatters it for x2 |
| Arcane Ward | **Absorption Ward**: every 20 damage absorbed stores a Resonance charge; it heals 30% of what it took | **Ward Prison**: on the enemy nearest the cursor: sealed in a bubble, no moving or attacking for 2 s (bosses 0.75 s), then it bursts |
| Spell Mirror | **Mirror Shield**: a 2.5 s mirror facing the cursor (a 120 degree arc you turn) that sends shots back | **Counterspell**: enemies within 220 px interrupted and stunned 1 s, every enemy shot there erased |
| Gravity Well | **Singularity Shield**: the well sits on you for 3 s; enemy shots within 200 px fall into it | **Crushing Well**: damage grows toward the centre; at the end it collapses, slamming everything together, stunned 1.5 s |

- A talents: Bulwark (Abjuration shields +25%), Retaliation (what breaks your shield freezes 1 s), Resolve (+20% move speed while shielded); cap **Last Ward** (once per 45 s a lethal hit is absorbed, a 2 s ward instead).
- B talents: Deep Cold (your freezes and stuns +30%), Brittle (controlled enemies take +20% from you), Lingering Chill (breaking free: slowed 40% for 2 s); cap **Permafrost** (controlled 3 times in 10 s: frozen 3 s, bosses 1 s, and x2 from the next hit).
- **Blizzard** A **Eye of the Storm**: centred on you and moving with you for 6 s; enemy shots entering it crawl, 20% less damage taken inside (Wider Eye, Long Storm: 8 s, Whiteout: enemies inside lose track of you; cap **Hailstorm**: hail strikes the 3 nearest inside every 0.5 s). B **Absolute Zero**: after 2 s of gathering, everything within 260 px freezes 3 s (bosses 1 s), shattering for x2 when it thaws or a big hit lands (Deeper Freeze: 4 s, Cold Snap: 1 s gathering, Frost Shards: shatters spray shards; cap **Glacier**: a shatter refreezes the enemies near it, once).

Implementation notes: "your next spell" on a Shatter Nova freeze became "your next hit" (basics included; DoTs excluded), since hits don't carry their spell. Absolute Zero's "big hit" is one at least its own damage.

## Knock-on changes

- **Rares:** Blinkstep Slippers become "every movement spell leaves an arcane echo"; the Orb of Echoes, Robes of the Magi and Spellthread Gloves are Resonance-based and work as they are.
- **Combos:** Frostfire (Frost Nova + Meteor) and Ice Wall (Frost Nova + Arcane Beam) stay as pairings; Blink Lance becomes the finisher of any movement spell.

## Status (2026-10-14)

**Built, awaiting playtest** (js/spellweaver.js; CLAUDE.md has the code map):
- All 20 spells at ranks 1-3, with their rank lines in the web's tooltips, icons and visuals. Tested headless in the Training Room: every spell hits, Flicker's charges, the Anchor's snap-back, Time Stop holding hits and enemy shots, Spell Mirror sending a shot back at its shooter, the one-Greater rule in the book.
- The spellbook screen after the class carousel (the last loadout is remembered), and a "Spellbook" button on the Training Room panel to swap spells mid-test.
- The web: each key's branch follows its spell; a Greater spell's Learn is gated at Lv. 5, whichever key it's on. Swapping a spell clears that key's branch (refunded; free in the Training Room).
- The old evolutions (Velocity, Scorched Earth, Deep Freeze, Ice Barrier, Arcane Arrival, Frost Departure, Accelerated Drop, Echo Blast) are gone: they failed the evolution rule. The four kept spells start fresh.
- Blinkstep Slippers: any movement spell. Blink Lance: after any movement spell, on any key. Frostfire and Ice Wall: unchanged (in Frost Nova).

**Evolutions built (2026-10-14, js/spellweaver_evo.js), awaiting playtest:** all 40 and their 64 talents, tested headless in the Training Room (every set cast on dummies with its talents; Stasis holding 21 hits then landing them, Rewind and Second Chance, Absolute Zero shattering, Mirror Shield's arc, school talents shared across branches and dropped on a swap). Rank tooltips still list the base spell's numbers, not the evolved form's.

**Not yet:**
- Scrolls: the six scroll spells are marked in the book but open to everyone until the merchant and the hub exist (campaign steps 2-3).
- Changing the loadout outside the Training Room: the hub and stage-cleared screens come with campaign step 2.
- Flicker's charges show as pips under the hero, not on the skill bar.

## Next

1. The user playtests the book in the Training Room.
2. Evolutions, school by school: an A/B pair per spell (each A/B a new role, per the evolution rule), the three school talents, a capstone per evolution. The user picks from options, as for the other classes.
3. Balance: numbers are first guesses (cooldowns and base damage in `SPELLS`).
