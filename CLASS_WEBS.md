# Class webs: the design for the remaining six classes

The design agreed with the user on 2026-10-13/14 for the Nightblade, Machinist, Kensei, Cleric, Druid and Paladin webs, to implement class by class (order below). Read CAMPAIGN.md first for the campaign rework's status; this file is its step 1 continued. The Spellweaver is left out on purpose (see the end).

## Context

The skill web (skilltree.js, talents.js) is built and the Dragonknight and the Ranger have full webs. The other classes still have the generic web (Quickened / Honed twigs, nothing under their evolutions). This plan holds the design for six of them, agreed with the user on 2026-10-13/14, to implement next session.

**Rules from the user:**
- **An evolution gives its skill a new form with a new use**, not more numbers.
- **Failing pairs get replacements; the user picked from four options.** Pairs that pass are kept, and only a weak side gets options.
- **The Kensei keeps its stance split:** A evolves the handheld form, B the airborne form.
- **The Cleric's Holy/Shadow pairs all pass**, so they're kept with only nodes added.
- **The Spellweaver is out of this plan.** Its identity needs its own design session (see the end).

**Every web has the same shape:**
- Per skill: two twigs, two passives, the evolution fork, and under each evolution three nodes plus a capstone.
- Four bridges join the branches.
- Costs: evolutions 2 points, capstones 3, everything else 1.

**Talent ids are prefixed per class** (`nb_`, `ma_`, `ke_`, `cl_`, `dr_`, `pa_`). The hooks (`talentDmgMult`, `talentsDamageTaken`, `talentsOnKill`) aren't class-gated, so shared ids would leak between classes (the Ranger already uses `mark_long`).

---

## Nightblade
Fragile assassin built on weak points (combat.js `weakPointDamage`). Sources that can pop a weak point: `melee_basic`, `phantom_dash`, `assassin_skill`, `death_mark`.

**Q Fan of Knives** (5 knives, skills.js Nightblade[1]):
- **Twigs:**
  - `nb_fan_more` Seven Blades: 7 knives.
  - `nb_fan_bleed` Serrated Steel: knives bleed 3 s.
- **A, Blade Orbit** (new): the knives circle you for 3 s at about 70 px. Each cuts an enemy it passes at most once per 0.3 s, with source `assassin_skill` and the angle it strikes from, so it still pops weak points.
  - `nb_orbit_wide` Wider Circle: 110 px.
  - `nb_orbit_long` Whirling Steel: 5 s.
  - `nb_orbit_release` Release: Q again flings the orbit outward as a fan.
  - Cap `nb_orbit_ring` Shadow Ring: you take 25% less while it orbits, and every weak-point pop adds a knife (up to 8).
- **B, Venom Edge** (new): knives stack Venom (up to 5, 6 s). A Phantom Dash through a venomed enemy bursts all its stacks: stacks × basic × 0.8, as true damage.
  - `nb_venom_deep` Deep Venom: stacks tick poison.
  - `nb_venom_spread` Contagion: a burst gives 2 stacks to enemies within 120 px.
  - `nb_venom_weak` Exposed Veins: at 5 stacks the enemy gets a weak point facing you.
  - Cap `nb_venom_rupture` Rupture: a weak-point pop on a venomed enemy also bursts it, and a 5-stack burst stuns 1 s.

**E Smoke Bomb:**
- **Twigs:**
  - `nb_smoke_wide` Billowing: +40% radius.
  - Generic Quickened.
- **A, Toxic Fumes** (kept):
  - `nb_toxic_slow` Choking Fumes: −30% speed.
  - `nb_toxic_linger` Lingering Haze: the poison lasts 3 s after leaving.
  - `nb_toxic_expose` Gasping: 2 s in the fumes gives a weak point.
  - Cap `nb_toxic_plague` Plague Cloud: deaths inside spawn a 60 px, 3 s cloud.
- **B, Mirage** (new, replaces Thick Fog): two shadow decoys run out of the cloud and draw idle non-bosses for 3 s. Reuse the Machinist decoy taunt in main.js (the `phantomDecoy` logic). They take the decoys from Thick Fog.
  - `nb_mirage_three` Third Shadow: three decoys.
  - `nb_mirage_burst` Smoke and Mirrors: decoys burst into 60 px smoke when hit or done.
  - `nb_mirage_stab` Phantom Blades: decoys stab nearby enemies for basic × 0.5 every 0.6 s.
  - Cap `nb_mirage_swap` Switcheroo: a Phantom Dash onto a decoy swaps you with it; you're invisible for 1 s and the next hit counts as a weak point.

**Space Phantom Dash:**
- **Twigs:**
  - `nb_dash_far` Long Shadow: +100 px.
  - `nb_dash_twice` Shadow Edge: the path is cut a second time 0.15 s later.
- **A, Reaper's Chain** (new): a kill within 1 s of the dash's cut resets its cooldown.
  - `nb_reaper_window` Grim Patience: a 2 s window.
  - `nb_reaper_rush` Bloodrush: each reset gives +15% damage for 3 s (stacks 3).
  - `nb_reaper_heal` Harvest: each reset heals 4%.
  - Cap `nb_reaper_storm` Massacre: the third chained dash cuts everything within 120 px of its path.
- **B, Shadow Return** (new): recast within 2 s to dash back to the start, cutting the path again.
  - `nb_return_long` Lingering Shadow: 3.5 s.
  - `nb_return_smoke` Vanishing Act: an 80 px smoke puff where you left.
  - `nb_return_cross` Crossing Blades: an enemy cut both ways gets a weak point facing you.
  - Cap `nb_return_echo` Shadow Echo: the way back throws 3 Shadow Dagger knives at the nearest enemies (combos.js `shadowDaggers`).
- **Removed:** Assassination (×2 range, ×3) and Acrobatics (second charge). combat.js:203 and skills.js:1471/1495 must go.

**R Mark for Death:**
- **Twigs:**
  - `nb_mfd_more` Patient Death: +2 clone strikes.
  - Generic Quickened.
- **A, Bloodlust** (kept):
  - `nb_blood_ward` Crimson Ward: overheal becomes a shield.
  - `nb_blood_frenzy` Frenzy of Shadows: each clone strike gives +5 Power for 6 s (stacking).
  - `nb_blood_cleanse` Second Skin: casting cleanses and gives a 1 s evade.
  - Cap `nb_blood_drain` Exsanguinate: the last clone strike hits ×3.
- **B, Chain Reaction** (kept):
  - `nb_chain_wide` Wider Blast: 220 px.
  - `nb_chain_mark` Marked Pack: the explosion gives a weak point to everything it hits.
  - `nb_chain_refresh` Endless Chain: a jump refills the clone strikes.
  - Cap `nb_chain_split` Doom Spiral: a jump splits the strikes between the two nearest enemies.

**Passives:** Q might/fleet, E vit/fleet, Space fleet/might, R focus/might. **Bridges:** might, fleet, vit, focus.

---

## Machinist
Turret builder with Scrap (Heavy and Siege turrets) and a turret cap (skills.js `spawnTurret`, `turretCap`). Combos: Tesla Turret, Overload, Conductive Net, Lightning Rod.

**Q Sentry Turret:**
- **Twigs:**
  - `ma_turret_life` Reinforced Frame: +40% life.
  - `ma_turret_cap` Spare Parts: +1 turret cap.
- **A, Flame Turret** (new, replaces Laser Optics): sprays a 180 px cone at enemies in reach. Ticks every 0.2 s for 0.35 dmg and ignites (`igniteEnemy`). Heavy/Siege scale it as now.
  - `ma_flame_wide` Wide Nozzle: 240 px and a wider cone.
  - `ma_flame_napalm` Napalm: leaves 2 s burning ground (a cheap strip like `moltenTrail`).
  - `ma_flame_heat` Superheated: burning enemies take +15% from the scattergun.
  - Cap `ma_flame_core` Inferno Core: on expiry it erupts in a 200 px firestorm.
- **B, Sniper Turret** (new, replaces Volatile Casing): 900 px range, targets the toughest enemy, fires a piercing beam for ×4 every 2 s.
  - `ma_snipe_mark` Laser Sight: its target takes +15% from you.
  - `ma_snipe_rail` Rail: full damage to everything on the line.
  - `ma_snipe_load` Autoloader: every 1.4 s.
  - Cap `ma_snipe_head` Headshot: every 3rd shot hits ×3 and stuns non-bosses 1 s.
- **Shared:** Tesla Turret (×1.15, arcs) and Overload (×3 rate) apply to both.

**E Tesla Coil:**
- **Twigs:**
  - `ma_coil_wide` +30% field.
  - `ma_coil_long` +3 s life.
- **A, High Voltage** (kept):
  - `ma_hv_reroot` Recharge: roots again every 3 s.
  - `ma_hv_shock` Overload Arc: rooted enemies take ×1.5 from pulses.
  - `ma_hv_pull` Magnetic Field: slowly pulls enemies inward.
  - Cap `ma_hv_storm` Static Storm: pulses chain to 3 enemies outside the field.
- **B, Arc Network** (kept):
  - `ma_arc_long` Long Lines: 600 px.
  - `ma_arc_charge` Supercharge: linked turrets fire 25% faster.
  - `ma_arc_grid` Grid: allows a second coil, and coils link to each other.
  - Cap `ma_arc_web` Lightning Web: lines root what they hit for 0.5 s (once per 3 s each).

**Space Magnetic Grapple:**
- **Twigs:**
  - `ma_grapple_far` Long Cable: no miss penalty.
  - Generic Quickened.
- **A, Crash Landing** (new, replaces Kinetic Shield): arriving knocks back and stuns enemies within 150 px for 0.6 s.
  - `ma_crash_wide` Heavy Boots: 220 px.
  - `ma_crash_scrap` Salvage Slam: 30% Scrap per enemy hit.
  - `ma_crash_plate` Impact Plating: a shield of 15 per enemy hit.
  - Cap `ma_crash_mines` Shrapnel Mines: 4 proximity mines scatter round the landing.
- **B, Decoy Projection** (kept):
  - `ma_decoy_long` Persistent Signal: 4 s.
  - `ma_decoy_armed` Armed Decoy: it shoots like a plain turret.
  - `ma_decoy_boom` Booby Trap: it explodes when done (×2 the turret blast).
  - Cap `ma_decoy_twin` Double Signal: a second decoy at the landing, and enemies hitting decoys take +20% from you.
- **Combo:** Overload (the grapple finisher) is unchanged.

**R Overclock Protocol:** the base buff stays (turrets fire 1.75× faster, pellets pierce, turrets refreshed). The Lightning Rod combo stays.
- **Twigs:**
  - `ma_oc_long` Coolant: +2 s.
  - `ma_oc_heal` Field Repair: casting heals 10%.
- **A, Exo-Frame** (new, replaces Nuclear Payload): for 8 s you wear a mech frame. The scattergun becomes a forward minigun stream and you take 30% less.
  - `ma_exo_rockets` Shoulder Rockets: a rocket every 1 s.
  - `ma_exo_stomp` Servo Stomp: faster, and you shove small enemies aside.
  - `ma_exo_plate` Reactive Plating: 45% less damage taken.
  - Cap `ma_exo_eject` Eject: the frame self-destructs in a big blast when it ends.
- **B, Orbital Strike** (new, replaces Automated Assembly): a satellite beam burns a line toward the cursor for 3 s, swept with the mouse (like Divine Ray's tracking).
  - `ma_orb_wide` Wide Lens: +50% width.
  - `ma_orb_long` Extended Burn: 4.5 s.
  - `ma_orb_scorch` Scorch Line: burning ground behind it.
  - Cap `ma_orb_prism` Prism Array: it splits into three for its last second.

**Passives:** Q might/vit, E focus/might, Space vit/fleet, R focus/vit. **Bridges:** might, focus, vit, fleet.

---

## Kensei
Stance split: A is the handheld form, B the airborne form. The class runs on Flow, which is lost through Razor's Edge. Its combos are Iaido, Guardian Orbit, Counter Step, Return Cut, Whirling Orbit, Gale Orbit and Gathering Gale; keep them all working.

**Q:**
- **Twigs:**
  - `ke_q_flow` Keen Edge: +10 Flow on hits.
  - Generic Quickened.
- **A, Counter Stance** (new, handheld; replaces Flawless Execution): hold Q (charge system) to guard for up to 1.5 s, slowed. Every non-continuous hit is parried (`parrySuccess`) and answered with an instant dash-slash at the attacker (×1.5).
  - `ke_counter_long` Iron Will: 2.5 s.
  - `ke_counter_flow` Flowing Guard: +15 Flow per parry.
  - `ke_counter_arrow` Arrow Cutter: shots that reach the guard fly back at the shooter.
  - Cap `ke_counter_draw` Final Draw: releasing after 2+ parries looses an Iaido line toward the cursor (×2).
- **B, Chain Surge** (new, airborne; replaces Deflecting Storm): the blade darts through up to 5 enemies in sequence for ×0.8 each, then returns to steering.
  - `ke_chain_more` Hunting Arc: 8 enemies.
  - `ke_chain_flow` Feeding Blade: +4 Flow per hit.
  - `ke_chain_sever` Sever: hit enemies take +15% from the blade for 4 s.
  - Cap `ke_chain_coup` Coup de Grace: the last dart hits ×3 and stuns.

**E (toggle):**
- **Twigs:**
  - `ke_e_drain` Steady Flight: airborne drain −15%.
  - `ke_e_cut` Sharper Return: Return Cut +25%.
- **A, Catch Parry** (new, handheld/recall; replaces Riposte Recall): catching the recalled blade opens a 1 s parry window.
  - `ke_catch_long` Steady Grip: 1.5 s.
  - `ke_catch_keep` Refund: keep 30% Flow on recall.
  - `ke_catch_full` Riposte Recall: the recall cut always lands at full Flow strength (the old A, as a node).
  - Cap `ke_catch_perfect` Perfect Catch: a parry in the window fires Counter Step at once and resets Space.
- **B, Twin Blades** (new, airborne/deploy; replaces Early Deploy): deploying splits off a second, smaller blade (×0.6) that seeks enemies on its own while you steer the main one.
  - `ke_twin_sharp` Sharpened Twin: ×0.8.
  - `ke_twin_guard` Guarding Twin: the twin orbits you and cuts shots instead.
  - `ke_twin_early` Early Deploy: deploy from 70% Flow (the old B).
  - Cap `ke_twin_reunion` Reunion: a recall with both out crosses their paths for a ×2 cut.

**Space:**
- **Twigs:**
  - `ke_step_far` +80 px.
  - Generic Quickened.
- **A, Ghost Step** (new, handheld; replaces Path of Blades): for 1.5 s after the step you're untargetable (enemies lose you, as in smoke), and your first hit is +50%.
  - `ke_ghost_long` Fading: 2.5 s.
  - `ke_ghost_flow` Silent Flow: no Flow decay while a ghost.
  - `ke_ghost_blades` Path of Blades: the old A, as a node.
  - Cap `ke_ghost_strike` Death from Nowhere: the first hit is ×2 and resets Q.
- **B, Echo Swap** (new, airborne; replaces Surge Reset): within 2 s you can swap back for free.
  - `ke_echo_long` 3.5 s.
  - `ke_echo_cut` Cutting Swap: each swap cuts the line between you and the blade.
  - `ke_echo_surge` Surge Reset: each swap resets Q (the old B).
  - Cap `ke_echo_triple` Triple Echo: a third swap.

**R:**
- **Twigs:**
  - `ke_r_flow` +8 Flow per enemy hit.
  - Generic Quickened.
- **A, Vortex** (kept, handheld pull):
  - `ke_vortex_wide` Eye of the Storm: 330 px.
  - `ke_vortex_twice` Second Gust: it strikes again 0.5 s later.
  - `ke_vortex_slow` Undertow: −40% speed for 2 s.
  - Cap `ke_vortex_twister` Hurricane Draw: a 2 s tornado stays and keeps pulling.
- **B, Shard Shield** (new, airborne; replaces Tempest Shards): the shards orbit you for 6 s, cutting what comes close and shattering enemy shots.
  - `ke_shards_more` 9 shards.
  - `ke_shards_flow` Mirror Shards: +5 Flow per shot shattered.
  - `ke_shards_wide` Wide Orbit: 110 px.
  - Cap `ke_shards_release` Release: R again flings every shard outward as a nova.

**Passives:** Q might/might, E focus/fleet, Space fleet/vit, R focus/might. **Bridges:** might, focus, fleet, vit.

---

## Cleric
All evolutions kept. Holy is A, Shadow is B. Keep the Zeal tiers, `zealLocked`, Reaper, the Vestments rare (keyed on the Q evolution) and the combos Prism, Sanctified Arrival and Twilight Eclipse.

**Q Divine Ray:**
- **Twigs:**
  - `cl_ray_long` Lingering Light: a 2 s channel.
  - `cl_ray_wide` Broad Beam: +30% width.
- **A, Radiant Flash:**
  - `cl_flash_long` Searing Light: 2 s blind.
  - `cl_flash_zeal` Zealous Gaze: +15 Zeal per blind.
  - `cl_flash_judge` Judgment: blinded enemies take +20%.
  - Cap `cl_flash_dawn` Dawnbreak: a 100-Zeal ray ends in a 150 px nova that stuns 1 s.
- **B, Void Spike:**
  - `cl_void_hunger` Hunger: the bonus applies below 70% HP.
  - `cl_void_leech` Leech: heals 15% of its damage.
  - `cl_void_grasp` Grasping Dark: −40% speed in the ray.
  - Cap `cl_void_collapse` Void Collapse: ray kills burst in shadow (120 px) and give 10 Zeal (or HP under Reaper).

**E Hallowed Ground:**
- **Twigs:**
  - `cl_ground_wide` +25% radius.
  - `cl_ground_long` +2 s.
- **A, Sanctuary:**
  - `cl_sanct_aegis` Aegis: a 3% shield per tick (capped).
  - `cl_sanct_ward` Hallowed Ward: enemy shots entering are destroyed.
  - `cl_sanct_haste` Blessed Steps: +20% move and attack speed inside.
  - Cap `cl_sanct_pillar` Holy Pillar: it ends in a pillar that heals 15% and blinds.
- **B, Desecration:**
  - `cl_desec_siphon` Siphon: heal 30% of its damage.
  - `cl_desec_creep` Creeping Dark: grows 50% over its time.
  - `cl_desec_wither` Wither: enemies inside take +15%.
  - Cap `cl_desec_rot` Rot: deaths inside leave a 60 px, 2 s desecration.

**Space Phase Shift:**
- **Twigs:**
  - `cl_phase_far` +80 px.
  - `cl_phase_faith` Faith Step: +10 Zeal under 50.
- **A, Divine Transposition:**
  - `cl_trans_reach` 600 px search.
  - `cl_trans_heal` Exchange: heal 8%.
  - `cl_trans_back` Second Swap: swap back within 2 s.
  - Cap `cl_trans_judge` Righteous Exchange: the swapped enemy is blinded 3 s and takes ×2 from your next ray.
- **B, Raven Flight:**
  - `cl_raven_cheap` Feathered: costs 10 Zeal or 5% HP.
  - `cl_raven_wide` Murder of Crows: +50% width.
  - `cl_raven_dread` Dread: non-bosses on the path flee 1.5 s.
  - Cap `cl_raven_swarm` Raven Swarm: ravens circle the landing for 3 s, pecking and blinding.

**R Ascension:**
- **Twigs:**
  - `cl_asc_long` +2 s.
  - `cl_asc_power` Exaltation: +10 Power during.
- **A, Avatar of Renewal:**
  - `cl_avatar_volley` 9 bolts at cast.
  - `cl_avatar_heal` Renewal: bolts heal 1% per hit.
  - `cl_avatar_halo` Halo: a 20% shield at cast.
  - Cap `cl_avatar_seraph` Seraph: it ends in a nova that heals 20% and stuns 1.5 s.
- **B, Aspect of the Reaper:**
  - `cl_reaper_sated` Hunger Sated: drains 2.5%/s.
  - `cl_reaper_harvest` Harvest: kills heal 35% and add 0.5 s.
  - `cl_reaper_scythe` Scythe: every 3rd censer pulse reaps a 160 px arc ×2.
  - Cap `cl_reaper_rite` Last Rite: at the end, everything within 300 px takes 20% of the HP drained.

**Passives:** Q might/focus, E vit/vit, Space fleet/focus, R focus/might. **Bridges:** vit, focus, might, fleet.

---

## Druid
Alpha is A (the companion grows stronger), Pack is B (more beasts, more area).
- **Text:** write talent text as "companion", never "wolf". druid.js `applyCompanionText` rewrites only the evolution texts.
- **Balance:** keep the companion's damage near half the class's (CLAUDE.md).

**Q Bramble Snare:**
- **Twigs:**
  - `dr_snare_wide` +30% burst.
  - `dr_snare_root` Deep Roots: a 1.5 s root.
- **A, Hunting Ground** (new, replaces Feeding Ground): the snare leaves a thicket for 4 s. Inside it the companion bites 50% faster and its bites cleave (reuse the Feral Surge cleave in `wolfBite`).
  - `dr_ground_long` Old Growth: 6 s.
  - `dr_ground_bond` Blood Trail: bites inside give +50% Bond.
  - `dr_ground_den` Verdant Den: heal 2%/s standing inside.
  - Cap `dr_ground_kill` Killing Field: the first bite inside on a rooted enemy is a free Maul (`player.freeMaul`), once per snare.
- **B, Grasping Vines** (kept):
  - `dr_vines_reach` Long Vines: drags from 220 px.
  - `dr_vines_thorn` Thorns: dragged enemies bleed.
  - `dr_vines_strangle` Strangle: a 2 s root.
  - Cap `dr_vines_bloom` Bloom: when the root ends, the vines burst (×1) and slow 50% for 2 s.

**E Feral Surge:**
- **Twigs:**
  - `dr_surge_long` +2 s.
  - `dr_surge_bark` Thick Bark: +50% shell.
- **A, Bloodrage:**
  - `dr_rage_more` Feeding Frenzy: 2.5% heal.
  - `dr_rage_fury` Primal Fury: +15 Power while surging.
  - `dr_rage_bark` Barkblood: overheal regrows the shell.
  - Cap `dr_rage_rampage` Rampage: while surging, a Maul comes every 50 Bond.
- **B, Kindred Howl:**
  - `dr_kin_twin` Twin Spirits.
  - `dr_kin_long` 12 s.
  - `dr_kin_fangs` Spirit Fangs: +30%.
  - Cap `dr_kin_leader` Pack Leader: while spirits live, the companion bites 25% faster.

**Space Spirit Leap:**
- **Twigs:**
  - `dr_leap_far` +80 px.
  - Generic Quickened.
- **A, Alpha Leap:**
  - `dr_alpha_bond` Bonded: 40 Bond.
  - `dr_alpha_shock` Pounce Shock: a 0.8 s stun on landing.
  - `dr_alpha_tandem` Tandem Leap: the companion leaps to your landing and bites.
  - Cap `dr_alpha_apex` Apex: a Maul within 3 s of the leap is ×1.5.
- **B, Scatter the Herd:**
  - `dr_scatter_far` Stampede: 140 px knockback.
  - `dr_scatter_whirl` Frenzied Whirl: 12 enemies at ×0.75.
  - `dr_scatter_trample` Trampled: −40% speed for 2 s.
  - Cap `dr_scatter_spirits` Spirit Scatter: spirits whirl too.

**R Call of the Wild:**
- **Twigs:**
  - `dr_call_howl` Thunderous Howl: +40% radius.
  - Generic Quickened.
- **A, Dire Aspect:**
  - `dr_dire_long` Elder Blood: 11 s.
  - `dr_dire_feast` Blood Feast: dire bites heal 1%.
  - `dr_dire_terror` Terror: non-bosses within 250 px flee 1.5 s.
  - Cap `dr_dire_apex` Apex Predator: every 3rd dire bite is a Maul.
- **B, Wild Hunt:**
  - `dr_hunt_long` 16 s.
  - `dr_hunt_bond` Pack Bond: spirits' bites build Bond.
  - `dr_hunt_encircle` Encircle: spirits take different prey and slow it.
  - Cap `dr_hunt_stampede` Spirit Stampede: expiring spirits charge through the nearest enemies.

**Passives:** Q might/vit, E vit/focus, Space fleet/might, R focus/might. **Bridges:** vit, might, fleet, focus.

---

## Paladin
Hammer equipped vs deployed, Divine Tether, Judgment Smash (all in paladin.js). Keep Flail Sweep, Ring the Hammer, Zealous Charge and the World-Breaker rare working.

**Q Judgment Hammer:**
- **Twigs:**
  - `pa_hammer_far` +150 px throw.
  - `pa_hammer_pulse` Resonant Head: +50% planted pulse.
- **A, Handheld Purity:**
  - `pa_purity_wide` Seismic Catch: 260 px.
  - `pa_purity_heal` Purifying Wave: heals 1% per enemy hit.
  - `pa_purity_ready` Ever Ready: half the internal cooldown.
  - Cap `pa_purity_quake` Twin Quake: a second wave 0.4 s later at ×1.5.
- **B, Conduit Shock:**
  - `pa_conduit_branch` Branching: 4 targets.
  - `pa_conduit_rod` Lightning Rod: 320 px.
  - `pa_conduit_shock` Shock: every 4th zap stuns 0.5 s.
  - Cap `pa_conduit_throne` Thunder Throne: within 150 px of the planted hammer you take 20% less, and your smashes chain to 2 more.

**E Divine Tether:**
- **Twigs:**
  - `pa_tether_long` +2 s.
  - `pa_tether_mend` Mending Chain: +50% heal.
- **A, Overflowing Grace:**
  - `pa_grace_cap` Abundant: shield cap 70%.
  - `pa_grace_absolve` Absolution: casting cleanses.
  - `pa_grace_lift` Lifted: +15% speed while shielded.
  - Cap `pa_grace_release` Radiant Release: when the chain ends, the shield bursts in a holy wave for its amount.
- **B, Chain of Retribution:**
  - `pa_retri_wrath` Wrathful Bolts: ×2.
  - `pa_retri_heavy` Heavy Links: catches shots 40 px wide.
  - `pa_retri_absorb` Absorb: +1% heal per shot caught.
  - Cap `pa_retri_judge` Judgment Chain: the chain strikes everything along it every 2 s (×1.5).

**Space Righteous Charge / Iron Pull:**
- **Twigs:**
  - `pa_charge_far` +60 px charge.
  - Generic Quickened.
- **A, Bulldozer** (new, replaces Unstoppable Juggernaut): the charge carries everything it hits to its end and slams them together, stunned 1 s (2 s into a wall). Reuse the Ranger's `ballistaPush` slam and wall detection: `clipToWalls`, `clampToBounds`.
  - `pa_dozer_far` Momentum: ×1.5 range (from Juggernaut).
  - `pa_dozer_guard` Shield Wall: immune during the charge (from Juggernaut).
  - `pa_dozer_crush` Crush: a wall slam hits ×2.
  - Cap `pa_dozer_quake` Earthshaker: the charge ends in a ground smash (160 px, ×1.5).
- **B, Gravitational Crashing** (kept):
  - `pa_grav_wide` 220 px.
  - `pa_grav_root` Heavy: a 1 s root first.
  - `pa_grav_crater` Crater: the landing ×2.
  - Cap `pa_grav_anchor` Gravity Anchor: the hammer keeps pulling enemies to itself for 3 s.
- **Removed:** Juggernaut's code at paladin.js:209/211/218/220. Its two halves become nodes. skillfx_space.js:686-691 and :730 draw it and must follow.

**R Consecrated Wrath:**
- **Twigs:**
  - `pa_wrath_wide` +25%.
  - `pa_wrath_long` +2 s.
- **A, Divine Aura:**
  - `pa_aura_bless` Blessed Aura: 1%/s heal.
  - `pa_aura_bulwark` Bulwark Aura: 15% less damage taken inside.
  - `pa_aura_judge` Judgment Aura: −50% speed.
  - Cap `pa_aura_flare` Wrath Flare: every 3 s it flares for ×2 and a 0.5 s stun.
- **B, Hammer of the Gods:**
  - `pa_gods_wide` 380 px pull.
  - `pa_gods_long` Endless Storm: 8 s.
  - `pa_gods_gale` Iron Gale: pulled enemies take ×0.5 per second.
  - Cap `pa_gods_fall` Fall of Heaven: when it ends, the hammer slams down for ×3 in 250 px and stuns.

**Passives:** Q vit/might, E vit/focus, Space vit/fleet, R focus/might. **Bridges:** vit, might, vit, focus.

---

## How to build each class (the pattern used for the Dragonknight and the Ranger)

1. **classes.json:** replace the names and descriptions of the replaced evolutions (A/B keep their slot meaning).
2. **talents.js:** add `TALENT_WEBS[classId]` with twigs, `pass`, `A`/`B` (3 + capstone) and `bridges`. Generic twigs use `mod: { cd }` or `{ dmg }`.
3. **Skill code:**
   - Nightblade, Machinist, Kensei, Cleric: skills.js `SkillRegistry`.
   - Druid: druid.js.
   - Paladin: paladin.js.
   - The Kensei's blade and stances: main.js.
   - Remove the replaced evolutions' code wherever it's checked (the agents' reports list each `selectedUpg` check).
   - Put new evolution helpers in a per-class section (as with the Ranger's).
   - Per-frame logic goes in one `update<Class>(dt)`, called from main.js.
4. **Hooks:** extend `talentDmgMult`, `talentsDamageTaken`, `talentsOnKill` (talents.js), each gated by class name.
5. **ui.js RANK_STATS:** fix the lines that read old evolutions, and add lines for new rank-scaled values.
6. **Visuals:**
   - Ground effects go in `drawSpaceGround` / `drawUltGround`.
   - Logic-only effect types return true in `drawSpaceEffect`.
   - Status marks go in skillfx_e.js `drawEnemyStatus`.
   - HUD chips go in hud.js `hudChips`.
   - Keep it cheap: flat fills, one path per line, no per-frame gradients on many objects.
7. **Docs:** CLAUDE.md (`talents.js` row), CAMPAIGN.md (a section per class), memory `campaign-plan.md`.
8. **Line endings:** keep CRLF. Use Python edits with `newline=''` (memory: crlf-checks), and check with `git ls-files --eol`.

**Order of work:** Nightblade, Machinist, Paladin, Cleric, Druid, Kensei. Simplest first; the Kensei's stance and blade code is the most intricate. The user playtests between classes when they like.

## Verification (each class)

- **Syntax:** `node --check` on every js file.
- **Headless:** a harness run in the Training Room. Copy `harness.mjs` from the bot folder (memory: bot-runs) into this session's scratchpad. Wrap each scenario step in an IIFE: top-level `const`s collide across evaluate calls.
  - Set each evolution with `setSkill(slot, undefined, 'A'|'B')`, grant its path's nodes, then cast on dummies and read the results (damage meters, stuns, positions, charges, chips).
  - Use the sparring dummy or a pushed enemy projectile for anything about enemy shots.
- **Screenshots** of each new visual.
- **The web screen** for the class: the nodes, icons and costs.
- **Then the user's playtest** in the Training Room (K opens the web, everything is free there).

## Not in this plan: the Spellweaver

The user wants a class rework, not new evolutions. **Its identity was settled on 2026-10-14: see SPELLWEAVER.md** (a big spellbook in four playstyle schools; the player builds the loadout).

- **Next:** a dedicated design session, run as for the Druid. Settle the identity first, then the kit (skills, possibly the Resonance engine and its rares), then its web.
- **Until then:** it keeps the generic web.
- **What depends on its current kit** (all affected by a rework):
  - Combos: Blink Lance, Frostfire, Ice Wall.
  - Rares: Blinkstep Slippers, Orb of Echoes, Robes of the Magi, Spellthread Gloves.
