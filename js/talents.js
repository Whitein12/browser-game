// ==========================================
// talents.js - What the skill webs' nodes do: each class's content, the passives, the talent icons, and the hooks
// ==========================================
// The web's shape is in skilltree.js; this file fills it. Per class and skill (1 = Q, 2 = E, 3 = Space, 4 = R):
//   modL / modR - the two twigs off the trunk; pass - the two passives beside them;
//   A / B - under each evolution: three nodes, then the capstone (A[3] / B[3]).
// A class without its own content gets the generic twigs (Quickened: -12% cooldown, Honed: +15% damage) and no nodes
// under its evolutions yet. Effects that live inside a skill check hasTalent(id) in that skill's code (skills.js,
// main.js), like hasItem; the rest run from the hooks at the bottom (combat.js, main.js).

const PASSIVES = { // per node
    vit: { name: 'Vitality', gear: 'armor', text: () => `+${vitHp()} Max HP` },
    might: { name: 'Might', gear: 'weapon', val: 0.06, text: () => '+6 Power' },
    focus: { name: 'Focus', gear: 'amulet', val: 0.04, text: () => '+4% Cooldown Reduction' },
    fleet: { name: 'Fleetness', gear: 'boots', val: 20, text: () => '+20 Move Speed' },
};
const TREE_VIT = 30; // Max HP per Vitality, x armorHpMult so fragile classes stay fragile (as with armor, combat.js)
const vitHp = () => Math.round(TREE_VIT * armorHpMult());
const DEFAULT_PASS = { 1: ['vit', 'might'], 2: ['might', 'focus'], 3: ['fleet', 'vit'], 4: ['focus', 'might'] };
const DEFAULT_BRIDGES = { 12: 'vit', 24: 'might', 43: 'focus', 31: 'fleet' }; // skilltree.js BRIDGES: Q-E, E-R, R-Space, Space-Q

const TALENT_WEBS = {
    dragonknight: {
        1: { // Shield Throw
            modL: { id: 'shield_far', name: 'Long Arm', icon: 'range', desc: 'The shield flies 30% faster, so it reaches farther before it turns back.' },
            modR: { id: 'shield_stun', name: 'Heavy Rim', icon: 'stun', desc: 'On its way out, the shield staggers what it hits for 0.4 s (not bosses).' },
            pass: ['vit', 'vit'],
            A: [ // Molten Aegis: a line of fire you lay down and kite enemies across
                { id: 'molten_slag', name: 'Slag', icon: 'slow', desc: 'The trail is molten slag: enemies in it are slowed by 40%.' },
                { id: 'molten_sear', name: 'Searing Path', icon: 'duration', desc: 'The trail burns for 5 s (was 3) and 50% hotter.' },
                { id: 'molten_flash', name: 'Flashpoint', icon: 'burst', desc: 'Catching the shield sets the whole trail off, from its far end back to you: every stretch of it bursts for the throw\'s damage.' },
                { id: 'molten_wake', name: 'Dragon\'s Wake', icon: 'fire', desc: 'The trail is twice as wide, and whatever crosses it is set burning for 3 s.' },
            ],
            B: [ // Hunting Shield: it stays in its prey until a slam tears it out
                { id: 'hunt_serrated', name: 'Serrated Edge', icon: 'damage', desc: 'The lodged shield grinds twice as often.' },
                { id: 'hunt_mark', name: 'Marked Prey', icon: 'thorns', desc: 'While the shield is lodged in it, the prey takes +25% damage from you.' },
                { id: 'hunt_tear', name: 'Tear Free', icon: 'stun', desc: 'Ripping it free stuns the prey for 1.5 s and gives back half of Shield Throw\'s cooldown.' },
                { id: 'hunt_relentless', name: 'Relentless Hunt', icon: 'range', desc: 'After you rip it free, the shield flies on to the nearest enemy within 350 px and lodges in it too (once per throw).' },
            ],
        },
        2: { // Dragonfire Blade
            modL: { id: 'fire_long', name: 'Slow Burn', icon: 'duration', desc: 'The blade burns for 9 s (was 6).' },
            modR: { id: 'fire_kindling', name: 'Kindling', icon: 'burst', desc: 'Lighting the blade gives 4 Frenzy at once.' },
            pass: ['might', 'might'],
            A: [
                { id: 'inferno_wide', name: 'Firestorm', icon: 'radius', desc: 'The ring of fire reaches 210 px (was 150).' },
                { id: 'inferno_spread', name: 'Wildfire', icon: 'fire', desc: 'A burning enemy that dies passes its fire to the 2 nearest enemies within 180 px.' },
                { id: 'inferno_wave', name: 'Flame Wave', icon: 'range', desc: 'While the blade burns, every light swing also sends a wave of fire 230 px ahead (half the swing\'s damage).' },
                { id: 'inferno_scorch', name: 'Scorched Earth', icon: 'fire', desc: 'The ring leaves the ground burning for 3 s: whatever stands in it takes this skill\'s damage every second.' },
            ],
            B: [
                { id: 'wyrm_heal', name: 'Ember Heart', icon: 'heal', desc: 'Every swing that connects heals 2% Max HP (was 1%).' },
                { id: 'wyrm_scales', name: 'Scaled Hide', icon: 'shield', desc: 'While the blade burns, you take 15% less damage.' },
                { id: 'wyrm_frenzy', name: 'Blood Frenzy', icon: 'duration', desc: 'While the blade burns, Frenzy doesn\'t fade.' },
                { id: 'wyrm_undying', name: 'Undying Flame', icon: 'heal', desc: 'While the blade burns, a blow that would kill you leaves you at 1 HP instead and puts the blade out (once per cast).' },
            ],
        },
        3: { // Thunder Leap
            modL: { id: 'leap_far', name: 'Great Leap', icon: 'range', desc: 'You leap 100 px farther.' },
            modR: { id: 'leap_wide', name: 'Thunderclap', icon: 'radius', desc: 'The landing hits everything within 165 px (was 120).' },
            pass: ['fleet', 'vit'],
            A: [ // Gravity Slam: the leap gathers the pack for your next blows
                { id: 'grav_horizon', name: 'Event Horizon', icon: 'radius', desc: 'The pull reaches 340 px (was 260).' },
                { id: 'grav_implode', name: 'Implosion', icon: 'burst', desc: '0.3 s after the pull, a second thunderclap goes off in the middle of the gathered pack.' },
                { id: 'grav_heavy', name: 'Crushing Weight', icon: 'stun', desc: 'The pulled are stunned for 1.2 s (was a 0.5 s stagger).' },
                { id: 'grav_singularity', name: 'Singularity', icon: 'pull', desc: 'A gravity well lingers where you landed for 3 s, dragging enemies into its centre (not bosses).' },
            ],
            B: [ // Meteor Dive: a timed dodge into a nuke
                { id: 'dive_air', name: 'Thin Air', icon: 'duration', desc: 'You can hang for 2.5 s (was 1.5).' },
                { id: 'dive_comet', name: 'Comet Trail', icon: 'fire', desc: 'The dive sets everything it lands on burning for 3 s.' },
                { id: 'dive_crater', name: 'Impact Crater', icon: 'radius', desc: 'A full dive reaches 260 px (was 200).' },
                { id: 'dive_starfall', name: 'Starfall', icon: 'lightning', desc: 'A full dive calls three more meteors down around the impact.' },
            ],
        },
        4: { // Dragon Breath
            modL: { id: 'breath_long', name: 'Deep Lungs', icon: 'duration', desc: 'The breath lasts 40% longer.' },
            modR: { id: 'breath_far', name: 'Long Breath', icon: 'range', desc: 'The flames fly 30% farther.' },
            pass: ['focus', 'might'],
            A: [
                { id: 'frost_bite', name: 'Frostbite', icon: 'damage', desc: 'Enemies the breath has chilled take +20% damage from you.' },
                { id: 'frost_freeze', name: 'Flash Freeze', icon: 'frost', desc: 'The breath freezes enemies solid for 1 s before the slow sets in.' },
                { id: 'frost_wide', name: 'Rime', icon: 'radius', desc: 'The chill reaches 500 px (was 400) in a wider cone.' },
                { id: 'frost_shatter', name: 'Shatterfrost', icon: 'frost', desc: 'An enemy that dies while chilled bursts into 6 ice shards (a quarter of the breath\'s damage each).' },
            ],
            B: [
                { id: 'sunder_deep', name: 'Deep Wounds', icon: 'damage', desc: 'Sundered enemies take +30% damage from you (was +20%), for 8 s (was 6).' },
                { id: 'sunder_brittle', name: 'Brittle Scales', icon: 'stun', desc: 'A full slam on a Sundered enemy stuns it for 1 s (not bosses).' },
                { id: 'sunder_wide', name: 'Wide Maw', icon: 'radius', desc: 'The flames spread in a wider cone.' },
                { id: 'sunder_roar', name: 'Dragon\'s Roar', icon: 'burst', desc: 'The breath ends in a roar: everything within 300 px is thrown back and stunned for 1 s (bosses are only pushed).' },
            ],
        },
        bridges: { 12: 'might', 24: 'focus', 43: 'vit', 31: 'fleet' },
    },
    nightblade: {
        1: { // Fan of Knives
            modL: { id: 'nb_fan_more', name: 'Seven Blades', icon: 'count', desc: 'Fan of Knives throws 7 knives (Blade Orbit circles 7).' },
            modR: { id: 'nb_fan_bleed', name: 'Serrated Steel', icon: 'thorns', desc: 'Thrown knives make what they hit bleed for 3 s.' },
            pass: ['might', 'fleet'],
            A: [ // Blade Orbit: the knives circle you, cutting what they pass from the side they move toward
                { id: 'nb_orbit_wide', name: 'Wider Circle', icon: 'radius', desc: 'The knives circle at 110 px (was 70).' },
                { id: 'nb_orbit_long', name: 'Whirling Steel', icon: 'duration', desc: 'The orbit lasts 5 s (was 3).' },
                { id: 'nb_orbit_release', name: 'Release', icon: 'range', desc: 'Q again flings the orbiting knives outward as a fan. The cooldown starts then.' },
                { id: 'nb_orbit_ring', name: 'Shadow Ring', icon: 'shield', desc: 'You take 25% less damage while the knives orbit, and every weak point you pop adds a knife (up to 8).' },
            ],
            B: [ // Venom Edge: stacks you burst with Phantom Dash
                { id: 'nb_venom_deep', name: 'Deep Venom', icon: 'thorns', desc: 'Venom stacks tick poison while they last.' },
                { id: 'nb_venom_spread', name: 'Contagion', icon: 'count', desc: 'A venom burst gives 2 stacks to enemies within 120 px.' },
                { id: 'nb_venom_weak', name: 'Exposed Veins', icon: 'damage', desc: 'At 5 stacks the enemy shows a weak point facing you.' },
                { id: 'nb_venom_rupture', name: 'Rupture', icon: 'burst', desc: 'Popping a weak point on a venomed enemy bursts its venom too, and a 5-stack burst stuns for 1 s.' },
            ],
        },
        2: { // Smoke Bomb
            modL: { id: 'nb_smoke_wide', name: 'Billowing', icon: 'radius', desc: 'The cloud is 40% wider.' },
            modR: genericTwig(2, { name: 'Smoke Bomb', maxCd: 8 }, 'quick'),
            pass: ['vit', 'fleet'],
            A: [ // Toxic Fumes
                { id: 'nb_toxic_slow', name: 'Choking Fumes', icon: 'slow', desc: 'Enemies in the fumes are slowed by 30%.' },
                { id: 'nb_toxic_linger', name: 'Lingering Haze', icon: 'duration', desc: 'The poison keeps working for 3 s after an enemy leaves the cloud.' },
                { id: 'nb_toxic_expose', name: 'Gasping', icon: 'damage', desc: '2 s in the fumes gives an enemy a weak point facing you (once per cloud).' },
                { id: 'nb_toxic_plague', name: 'Plague Cloud', icon: 'burst', desc: 'An enemy that dies in the fumes leaves a small poison cloud for 3 s.' },
            ],
            B: [ // Mirage: shadow decoys draw the pack
                { id: 'nb_mirage_three', name: 'Third Shadow', icon: 'count', desc: 'Three shadows run out of the cloud.' },
                { id: 'nb_mirage_burst', name: 'Smoke and Mirrors', icon: 'radius', desc: 'A shadow bursts into a 60 px smoke cloud when it\'s struck or fades.' },
                { id: 'nb_mirage_stab', name: 'Phantom Blades', icon: 'damage', desc: 'Shadows stab enemies next to them for half a basic hit every 0.6 s.' },
                { id: 'nb_mirage_swap', name: 'Switcheroo', icon: 'range', desc: 'A Phantom Dash onto a shadow swaps you with it: you vanish for 1 s, and your next hit is a weak point.' },
            ],
        },
        3: { // Phantom Dash
            modL: { id: 'nb_dash_far', name: 'Long Shadow', icon: 'range', desc: 'Phantom Dash goes 100 px farther.' },
            modR: { id: 'nb_dash_twice', name: 'Shadow Edge', icon: 'damage', desc: 'The path is cut a second time 0.15 s later, at 60%.' },
            pass: ['fleet', 'might'],
            A: [ // Reaper's Chain: a kill soon after the cut resets the dash
                { id: 'nb_reaper_window', name: 'Grim Patience', icon: 'duration', desc: 'A kill within 2 s of the cut resets the dash (was 1 s).' },
                { id: 'nb_reaper_rush', name: 'Bloodrush', icon: 'damage', desc: 'Each reset gives +15 Power for 3 s (stacks 3 times).' },
                { id: 'nb_reaper_heal', name: 'Harvest', icon: 'heal', desc: 'Each reset heals 4% of your Max HP.' },
                { id: 'nb_reaper_storm', name: 'Massacre', icon: 'burst', desc: 'The third chained dash cuts everything within 120 px of its path.' },
            ],
            B: [ // Shadow Return: recast to dash back
                { id: 'nb_return_long', name: 'Lingering Shadow', icon: 'duration', desc: 'You can dash back for 3.5 s (was 2).' },
                { id: 'nb_return_smoke', name: 'Vanishing Act', icon: 'radius', desc: 'Dashing back leaves an 80 px smoke cloud where you were.' },
                { id: 'nb_return_cross', name: 'Crossing Blades', icon: 'damage', desc: 'An enemy cut both ways shows a weak point facing you.' },
                { id: 'nb_return_echo', name: 'Shadow Echo', icon: 'count', desc: 'Dashing back throws 3 knives at the nearest enemies, each 2 basic hits.' },
            ],
        },
        4: { // Mark for Death
            modL: { id: 'nb_mfd_more', name: 'Patient Death', icon: 'count', desc: 'Two more clone strikes.' },
            modR: genericTwig(4, { name: 'Mark for Death', maxCd: 15 }, 'quick'),
            pass: ['focus', 'might'],
            A: [ // Bloodlust
                { id: 'nb_blood_ward', name: 'Crimson Ward', icon: 'shield', desc: 'Bloodlust healing past your Max HP becomes a shield.' },
                { id: 'nb_blood_frenzy', name: 'Frenzy of Shadows', icon: 'damage', desc: 'Each clone strike gives +5 Power for 6 s (stacking).' },
                { id: 'nb_blood_cleanse', name: 'Second Skin', icon: 'heal', desc: 'Casting cleanses slows, roots and weakness, and you evade everything for 1 s.' },
                { id: 'nb_blood_drain', name: 'Exsanguinate', icon: 'burst', desc: 'The last clone strike hits x3.' },
            ],
            B: [ // Chain Reaction
                { id: 'nb_chain_wide', name: 'Wider Blast', icon: 'radius', desc: 'Marked enemies explode in 220 px (was 150).' },
                { id: 'nb_chain_mark', name: 'Marked Pack', icon: 'damage', desc: 'The explosion gives everything it hits a weak point facing you.' },
                { id: 'nb_chain_refresh', name: 'Endless Chain', icon: 'cooldown', desc: 'When the mark jumps, its clone strikes refill.' },
                { id: 'nb_chain_split', name: 'Doom Spiral', icon: 'count', desc: 'When the mark jumps, the clone strikes alternate between its new target and the next nearest enemy.' },
            ],
        },
        bridges: { 12: 'might', 24: 'fleet', 43: 'vit', 31: 'focus' },
    },
    machinist: {
        1: { // Sentry Turret
            modL: { id: 'ma_turret_life', name: 'Reinforced Frame', icon: 'duration', desc: 'Turrets last 40% longer.' },
            modR: { id: 'ma_turret_cap', name: 'Spare Parts', icon: 'count', desc: 'One more turret can stand at once.' },
            pass: ['might', 'vit'],
            A: [ // Flame Turret: a cone of fire that sets enemies burning
                { id: 'ma_flame_wide', name: 'Wide Nozzle', icon: 'radius', desc: 'The flames reach 240 px (was 180) in a wider cone.' },
                { id: 'ma_flame_napalm', name: 'Napalm', icon: 'fire', desc: 'The spray leaves burning ground for 2 s where it lands.' },
                { id: 'ma_flame_heat', name: 'Superheated', icon: 'damage', desc: 'Burning enemies take 15% more from your scattergun.' },
                { id: 'ma_flame_core', name: 'Inferno Core', icon: 'burst', desc: 'When a Flame Turret runs out, it erupts in a 200 px firestorm.' },
            ],
            B: [ // Sniper Turret: the toughest enemy, a beam every 2 s
                { id: 'ma_snipe_mark', name: 'Laser Sight', icon: 'damage', desc: 'The sniper\'s target takes 15% more from you for 2.5 s.' },
                { id: 'ma_snipe_rail', name: 'Rail', icon: 'pierce', desc: 'The beam deals full damage to everything on its line.' },
                { id: 'ma_snipe_load', name: 'Autoloader', icon: 'cooldown', desc: 'The sniper fires every 1.4 s (was 2).' },
                { id: 'ma_snipe_head', name: 'Headshot', icon: 'stun', desc: 'Every 3rd shot hits x3 and stuns non-bosses for 1 s.' },
            ],
        },
        2: { // Tesla Coil
            modL: { id: 'ma_coil_wide', name: 'Wide Field', icon: 'radius', desc: 'The coil\'s field is 30% wider.' },
            modR: { id: 'ma_coil_long', name: 'Capacitor', icon: 'duration', desc: 'The coil lasts 3 s longer.' },
            pass: ['focus', 'might'],
            A: [ // High Voltage
                { id: 'ma_hv_reroot', name: 'Recharge', icon: 'cooldown', desc: 'The field roots an enemy again every 3 s it stays inside.' },
                { id: 'ma_hv_shock', name: 'Overload Arc', icon: 'damage', desc: 'Rooted enemies take x1.5 from the pulses.' },
                { id: 'ma_hv_pull', name: 'Magnetic Field', icon: 'pull', desc: 'The field slowly pulls enemies toward the coil (not bosses).' },
                { id: 'ma_hv_storm', name: 'Static Storm', icon: 'lightning', desc: 'Each pulse also leaps to 3 enemies outside the field.' },
            ],
            B: [ // Arc Network
                { id: 'ma_arc_long', name: 'Long Lines', icon: 'range', desc: 'Lines reach turrets within 600 px (was 400).' },
                { id: 'ma_arc_charge', name: 'Supercharge', icon: 'cooldown', desc: 'Linked turrets fire 25% faster.' },
                { id: 'ma_arc_grid', name: 'Grid', icon: 'count', desc: 'Two coils can stand at once, and they link to each other.' },
                { id: 'ma_arc_web', name: 'Lightning Web', icon: 'lightning', desc: 'The lines root what they hit for 0.5 s (once per 3 s per enemy).' },
            ],
        },
        3: { // Magnetic Grapple
            modL: { id: 'ma_grapple_far', name: 'Long Cable', icon: 'range', desc: 'No extra cooldown for grappling open ground.' },
            modR: genericTwig(3, { name: 'Magnetic Grapple', maxCd: 5 }, 'quick'),
            pass: ['vit', 'fleet'],
            A: [ // Crash Landing
                { id: 'ma_crash_wide', name: 'Heavy Boots', icon: 'radius', desc: 'The landing hits 220 px around you (was 150).' },
                { id: 'ma_crash_scrap', name: 'Salvage Slam', icon: 'count', desc: '1 Scrap for every enemy the landing hits.' },
                { id: 'ma_crash_plate', name: 'Impact Plating', icon: 'shield', desc: 'A 15 shield for every enemy the landing hits.' },
                { id: 'ma_crash_mines', name: 'Shrapnel Mines', icon: 'burst', desc: '4 proximity mines scatter round the landing.' },
            ],
            B: [ // Decoy Projection
                { id: 'ma_decoy_long', name: 'Persistent Signal', icon: 'duration', desc: 'The hologram lasts 4 s (was 2).' },
                { id: 'ma_decoy_armed', name: 'Armed Decoy', icon: 'damage', desc: 'The hologram shoots like a plain turret.' },
                { id: 'ma_decoy_boom', name: 'Booby Trap', icon: 'burst', desc: 'The hologram explodes when it\'s done, for twice a turret blast.' },
                { id: 'ma_decoy_twin', name: 'Double Signal', icon: 'count', desc: 'A second hologram at the landing, and enemies drawn to them take 20% more from you.' },
            ],
        },
        4: { // Overclock Protocol
            modL: { id: 'ma_oc_long', name: 'Coolant', icon: 'duration', desc: 'Overclock lasts 2 s longer.' },
            modR: { id: 'ma_oc_heal', name: 'Field Repair', icon: 'heal', desc: 'Overclocking heals 10% of your Max HP.' },
            pass: ['focus', 'vit'],
            A: [ // Exo-Frame
                { id: 'ma_exo_rockets', name: 'Shoulder Rockets', icon: 'fire', desc: 'The frame fires a rocket every 1 s at the enemy nearest your cursor.' },
                { id: 'ma_exo_stomp', name: 'Servo Stomp', icon: 'range', desc: 'The frame moves 20% faster and shoves small enemies aside.' },
                { id: 'ma_exo_plate', name: 'Reactive Plating', icon: 'shield', desc: 'You take 45% less in the frame (was 30%).' },
                { id: 'ma_exo_eject', name: 'Eject', icon: 'burst', desc: 'The frame self-destructs in a big blast when it ends.' },
            ],
            B: [ // Orbital Strike
                { id: 'ma_orb_wide', name: 'Wide Lens', icon: 'radius', desc: 'The beam is 50% wider.' },
                { id: 'ma_orb_long', name: 'Extended Burn', icon: 'duration', desc: 'The beam burns for 4.5 s (was 3).' },
                { id: 'ma_orb_scorch', name: 'Scorch Line', icon: 'fire', desc: 'The beam leaves burning ground behind it.' },
                { id: 'ma_orb_prism', name: 'Prism Array', icon: 'count', desc: 'For its last second the beam splits into three.' },
            ],
        },
        bridges: { 12: 'might', 24: 'focus', 43: 'vit', 31: 'fleet' },
    },
    paladin: {
        1: { // Judgment Hammer
            modL: { id: 'pa_hammer_far', name: 'Long Throw', icon: 'range', desc: 'The hammer flies 150 px farther.' },
            modR: { id: 'pa_hammer_pulse', name: 'Resonant Head', icon: 'radius', desc: 'The planted hammer\'s pulse hits 50% harder.' },
            pass: ['vit', 'might'],
            A: [ // Handheld Purity
                { id: 'pa_purity_wide', name: 'Seismic Catch', icon: 'radius', desc: 'The catch\'s shockwave reaches 260 px (was 180).' },
                { id: 'pa_purity_heal', name: 'Purifying Wave', icon: 'heal', desc: 'The shockwave heals 1% of your Max HP per enemy it hits.' },
                { id: 'pa_purity_ready', name: 'Ever Ready', icon: 'cooldown', desc: 'The shockwave can come twice as often.' },
                { id: 'pa_purity_quake', name: 'Twin Quake', icon: 'burst', desc: 'A second, wider wave follows 0.4 s later at x1.5.' },
            ],
            B: [ // Conduit Shock
                { id: 'pa_conduit_branch', name: 'Branching', icon: 'count', desc: 'The planted hammer zaps 4 enemies (was 2).' },
                { id: 'pa_conduit_rod', name: 'Lightning Rod', icon: 'range', desc: 'It zaps enemies within 320 px (was 200).' },
                { id: 'pa_conduit_shock', name: 'Shock', icon: 'stun', desc: 'Every 4th zap stuns for 0.5 s (not bosses).' },
                { id: 'pa_conduit_throne', name: 'Thunder Throne', icon: 'lightning', desc: 'Within 150 px of the planted hammer you take 20% less, and your shield bashes chain to 2 more enemies.' },
            ],
        },
        2: { // Divine Tether
            modL: { id: 'pa_tether_long', name: 'Long Chain', icon: 'duration', desc: 'The tether lasts 2 s longer.' },
            modR: { id: 'pa_tether_mend', name: 'Mending Chain', icon: 'heal', desc: 'The chain heals 50% more.' },
            pass: ['vit', 'focus'],
            A: [ // Overflowing Grace
                { id: 'pa_grace_cap', name: 'Abundant', icon: 'shield', desc: 'The overflow shield can reach 70% of your Max HP (was 50%).' },
                { id: 'pa_grace_absolve', name: 'Absolution', icon: 'heal', desc: 'Casting the tether cleanses slows, roots and weakness.' },
                { id: 'pa_grace_lift', name: 'Lifted', icon: 'range', desc: '+15% move speed while you\'re shielded.' },
                { id: 'pa_grace_release', name: 'Radiant Release', icon: 'burst', desc: 'When the chain ends, your shield bursts into a holy wave for its full amount.' },
            ],
            B: [ // Chain of Retribution
                { id: 'pa_retri_wrath', name: 'Wrathful Bolts', icon: 'damage', desc: 'The holy bolts hit twice as hard.' },
                { id: 'pa_retri_heavy', name: 'Heavy Links', icon: 'radius', desc: 'The chain catches shots 40 px wide (was 18).' },
                { id: 'pa_retri_absorb', name: 'Absorb', icon: 'heal', desc: 'Each shot the chain catches heals 1% of your Max HP.' },
                { id: 'pa_retri_judge', name: 'Judgment Chain', icon: 'lightning', desc: 'Every 2 s the chain strikes everything along it for x1.5.' },
            ],
        },
        3: { // Righteous Charge / Iron Pull
            modL: { id: 'pa_charge_far', name: 'Long Charge', icon: 'range', desc: 'The charge goes 60 px farther.' },
            modR: genericTwig(3, { name: 'Righteous Charge', maxCd: 6 }, 'quick'),
            pass: ['vit', 'fleet'],
            A: [ // Bulldozer
                { id: 'pa_dozer_far', name: 'Momentum', icon: 'range', desc: 'The charge goes 50% farther.' },
                { id: 'pa_dozer_guard', name: 'Shield Wall', icon: 'shield', desc: 'You\'re immune to damage while charging.' },
                { id: 'pa_dozer_crush', name: 'Crush', icon: 'damage', desc: 'A slam into a wall hits x2.' },
                { id: 'pa_dozer_quake', name: 'Earthshaker', icon: 'burst', desc: 'The charge ends in a ground smash (160 px, x1.5).' },
            ],
            B: [ // Gravitational Crashing
                { id: 'pa_grav_wide', name: 'Heavy Landing', icon: 'radius', desc: 'The landing grounds enemies within 220 px (was 150).' },
                { id: 'pa_grav_root', name: 'Heavy', icon: 'stun', desc: 'Grounded enemies are rooted for 1 s first.' },
                { id: 'pa_grav_crater', name: 'Crater', icon: 'damage', desc: 'The landing hits x2.' },
                { id: 'pa_grav_anchor', name: 'Gravity Anchor', icon: 'pull', desc: 'For 3 s after you land, the hammer keeps pulling enemies to itself.' },
            ],
        },
        4: { // Consecrated Wrath
            modL: { id: 'pa_wrath_wide', name: 'Broad Wrath', icon: 'radius', desc: 'The consecrated ground is 25% wider.' },
            modR: { id: 'pa_wrath_long', name: 'Long Wrath', icon: 'duration', desc: 'It lasts 2 s longer.' },
            pass: ['focus', 'might'],
            A: [ // Divine Aura
                { id: 'pa_aura_bless', name: 'Blessed Aura', icon: 'heal', desc: 'The aura heals you 1% of your Max HP per second.' },
                { id: 'pa_aura_bulwark', name: 'Bulwark Aura', icon: 'shield', desc: 'You take 15% less while the aura burns.' },
                { id: 'pa_aura_judge', name: 'Judgment Aura', icon: 'slow', desc: 'Enemies in the aura are slowed by 50% (was 25%).' },
                { id: 'pa_aura_flare', name: 'Wrath Flare', icon: 'burst', desc: 'Every 3 s the aura flares for x2 and stuns for 0.5 s.' },
            ],
            B: [ // Hammer of the Gods
                { id: 'pa_gods_wide', name: 'Wide Hurricane', icon: 'radius', desc: 'The hurricane pulls from 380 px (was 280).' },
                { id: 'pa_gods_long', name: 'Endless Storm', icon: 'duration', desc: 'The hurricane lasts 8 s (was 6).' },
                { id: 'pa_gods_gale', name: 'Iron Gale', icon: 'damage', desc: 'Pulled enemies take x0.5 every second.' },
                { id: 'pa_gods_fall', name: 'Fall of Heaven', icon: 'burst', desc: 'When it ends, the hammer slams down for x3 in 250 px and stuns.' },
            ],
        },
        bridges: { 12: 'vit', 24: 'might', 43: 'vit', 31: 'focus' },
    },
    cleric: {
        1: { // Divine Ray
            modL: { id: 'cl_ray_long', name: 'Lingering Light', icon: 'duration', desc: 'The ray channels for 2 s (was 1.5).' },
            modR: { id: 'cl_ray_wide', name: 'Broad Beam', icon: 'radius', desc: 'The ray is 30% wider.' },
            pass: ['might', 'focus'],
            A: [ // Radiant Flash
                { id: 'cl_flash_long', name: 'Searing Light', icon: 'duration', desc: 'The ray blinds for 2 s (was 1).' },
                { id: 'cl_flash_zeal', name: 'Zealous Gaze', icon: 'count', desc: 'Each fresh blind gives 15 Zeal (was 10).' },
                { id: 'cl_flash_judge', name: 'Judgment', icon: 'damage', desc: 'Blinded enemies take 20% more from you.' },
                { id: 'cl_flash_dawn', name: 'Dawnbreak', icon: 'burst', desc: 'A 100-Zeal ray ends in a 150 px nova that stuns for 1 s.' },
            ],
            B: [ // Void Spike
                { id: 'cl_void_hunger', name: 'Hunger', icon: 'damage', desc: 'The low-HP bonus starts below 70% HP (was 50%).' },
                { id: 'cl_void_leech', name: 'Leech', icon: 'heal', desc: 'The ray heals you for 15% of its damage.' },
                { id: 'cl_void_grasp', name: 'Grasping Dark', icon: 'slow', desc: 'Enemies in the ray are slowed by 40%.' },
                { id: 'cl_void_collapse', name: 'Void Collapse', icon: 'burst', desc: 'Kills by the ray burst in shadow (120 px) and give 10 Zeal (or HP under the Reaper).' },
            ],
        },
        2: { // Hallowed Ground
            modL: { id: 'cl_ground_wide', name: 'Broad Ground', icon: 'radius', desc: 'The ground is 25% wider.' },
            modR: { id: 'cl_ground_long', name: 'Lasting Ground', icon: 'duration', desc: 'It lasts 2 s longer.' },
            pass: ['vit', 'vit'],
            A: [ // Sanctuary
                { id: 'cl_sanct_aegis', name: 'Aegis', icon: 'shield', desc: 'Each tick inside gives a shield of 3% of your Max HP (capped).' },
                { id: 'cl_sanct_ward', name: 'Hallowed Ward', icon: 'shield', desc: 'Enemy shots that enter the Sanctuary are destroyed.' },
                { id: 'cl_sanct_haste', name: 'Blessed Steps', icon: 'range', desc: '+20% move and attack speed inside.' },
                { id: 'cl_sanct_pillar', name: 'Holy Pillar', icon: 'burst', desc: 'It ends in a pillar of light that heals 15% and blinds the enemies inside.' },
            ],
            B: [ // Desecration
                { id: 'cl_desec_siphon', name: 'Siphon', icon: 'heal', desc: 'You heal 30% of its damage.' },
                { id: 'cl_desec_creep', name: 'Creeping Dark', icon: 'radius', desc: 'It grows 50% over its time.' },
                { id: 'cl_desec_wither', name: 'Wither', icon: 'damage', desc: 'Enemies inside take 15% more from you.' },
                { id: 'cl_desec_rot', name: 'Rot', icon: 'burst', desc: 'Enemies that die inside leave a 60 px patch of desecration for 2 s.' },
            ],
        },
        3: { // Phase Shift
            modL: { id: 'cl_phase_far', name: 'Far Step', icon: 'range', desc: 'Phase Shift goes 80 px farther.' },
            modR: { id: 'cl_phase_faith', name: 'Faith Step', icon: 'count', desc: '+10 Zeal when you cast it under 50 Zeal.' },
            pass: ['fleet', 'focus'],
            A: [ // Divine Transposition
                { id: 'cl_trans_reach', name: 'Long Reach', icon: 'range', desc: 'It looks for an enemy within 600 px (was 400).' },
                { id: 'cl_trans_heal', name: 'Exchange', icon: 'heal', desc: 'Swapping heals 8% of your Max HP.' },
                { id: 'cl_trans_back', name: 'Second Swap', icon: 'cooldown', desc: 'Cast again within 2 s to swap back with the same enemy.' },
                { id: 'cl_trans_judge', name: 'Righteous Exchange', icon: 'damage', desc: 'The swapped enemy is blinded for 3 s and takes x2 from your next ray.' },
            ],
            B: [ // Raven Flight
                { id: 'cl_raven_cheap', name: 'Feathered', icon: 'cooldown', desc: 'It costs 10 Zeal (was 20), or 5% HP (was 10%).' },
                { id: 'cl_raven_wide', name: 'Murder of Crows', icon: 'radius', desc: 'The flight is 50% wider.' },
                { id: 'cl_raven_dread', name: 'Dread', icon: 'slow', desc: 'Non-bosses on the path flee for 1.5 s.' },
                { id: 'cl_raven_swarm', name: 'Raven Swarm', icon: 'burst', desc: 'Ravens circle the landing for 3 s, pecking and blinding.' },
            ],
        },
        4: { // Ascension
            modL: { id: 'cl_asc_long', name: 'Prolonged', icon: 'duration', desc: 'Ascension lasts 2 s longer.' },
            modR: { id: 'cl_asc_power', name: 'Exaltation', icon: 'damage', desc: '+10 Power while Ascension lasts.' },
            pass: ['focus', 'might'],
            A: [ // Avatar of Renewal
                { id: 'cl_avatar_volley', name: 'Volley', icon: 'count', desc: '9 bolts at the cast (was 6).' },
                { id: 'cl_avatar_heal', name: 'Renewal', icon: 'heal', desc: 'The bolts heal 1% of your Max HP per hit.' },
                { id: 'cl_avatar_halo', name: 'Halo', icon: 'shield', desc: 'A shield of 20% of your Max HP at the cast.' },
                { id: 'cl_avatar_seraph', name: 'Seraph', icon: 'burst', desc: 'It ends in a nova that heals 20% and stuns for 1.5 s.' },
            ],
            B: [ // Aspect of the Reaper
                { id: 'cl_reaper_sated', name: 'Hunger Sated', icon: 'heal', desc: 'The Reaper drains 2.5% per second (was 4%).' },
                { id: 'cl_reaper_harvest', name: 'Harvest', icon: 'duration', desc: 'Kills heal 35% of what\'s missing (was 25%) and add 0.5 s.' },
                { id: 'cl_reaper_scythe', name: 'Scythe', icon: 'damage', desc: 'Every 3rd censer pulse reaps a 160 px arc for x2.' },
                { id: 'cl_reaper_rite', name: 'Last Rite', icon: 'burst', desc: 'When it ends, everything within 300 px takes 20% of the HP it drained.' },
            ],
        },
        bridges: { 12: 'vit', 24: 'focus', 43: 'might', 31: 'fleet' },
    },
    druid: {
        1: { // Bramble Snare
            modL: { id: 'dr_snare_wide', name: 'Wide Snare', icon: 'radius', desc: 'The burst is 30% wider.' },
            modR: { id: 'dr_snare_root', name: 'Deep Roots', icon: 'stun', desc: 'The snare roots for 1.5 s (was 1).' },
            pass: ['might', 'vit'],
            A: [ // Hunting Ground
                { id: 'dr_ground_long', name: 'Old Growth', icon: 'duration', desc: 'The thicket lasts 6 s (was 4).' },
                { id: 'dr_ground_bond', name: 'Blood Trail', icon: 'count', desc: 'The companion\'s bites inside give 50% more Bond.' },
                { id: 'dr_ground_den', name: 'Verdant Den', icon: 'heal', desc: 'Standing inside heals 2% of your Max HP per second.' },
                { id: 'dr_ground_kill', name: 'Killing Field', icon: 'burst', desc: 'The companion\'s first bite inside on a rooted enemy is a free Maul (once per snare).' },
            ],
            B: [ // Grasping Vines
                { id: 'dr_vines_reach', name: 'Long Vines', icon: 'range', desc: 'The vines drag from 220 px.' },
                { id: 'dr_vines_thorn', name: 'Thorns', icon: 'thorns', desc: 'Dragged enemies bleed for 3 s.' },
                { id: 'dr_vines_strangle', name: 'Strangle', icon: 'stun', desc: 'The root lasts 2 s.' },
                { id: 'dr_vines_bloom', name: 'Bloom', icon: 'burst', desc: 'When the root ends, the vines burst (x1) and slow by 50% for 2 s.' },
            ],
        },
        2: { // Feral Surge
            modL: { id: 'dr_surge_long', name: 'Long Surge', icon: 'duration', desc: 'The surge lasts 2 s longer.' },
            modR: { id: 'dr_surge_bark', name: 'Thick Bark', icon: 'shield', desc: 'The bark shell is 50% thicker.' },
            pass: ['vit', 'focus'],
            A: [ // Bloodrage
                { id: 'dr_rage_more', name: 'Feeding Frenzy', icon: 'heal', desc: 'Each surging bite heals 2.5% (was 1.5%).' },
                { id: 'dr_rage_fury', name: 'Primal Fury', icon: 'damage', desc: '+15 Power while surging.' },
                { id: 'dr_rage_bark', name: 'Barkblood', icon: 'shield', desc: 'Healing past your Max HP regrows the bark shell.' },
                { id: 'dr_rage_rampage', name: 'Rampage', icon: 'burst', desc: 'While surging, a Maul comes every 50 Bond (was 100).' },
            ],
            B: [ // Kindred Howl
                { id: 'dr_kin_twin', name: 'Twin Spirits', icon: 'count', desc: 'Two spirit animals answer the howl.' },
                { id: 'dr_kin_long', name: 'Kindred Bond', icon: 'duration', desc: 'They stay 12 s (was 8).' },
                { id: 'dr_kin_fangs', name: 'Spirit Fangs', icon: 'damage', desc: 'Their bites are 30% stronger.' },
                { id: 'dr_kin_leader', name: 'Pack Leader', icon: 'cooldown', desc: 'While spirit animals live, your companion bites 25% faster.' },
            ],
        },
        3: { // Spirit Leap
            modL: { id: 'dr_leap_far', name: 'Far Leap', icon: 'range', desc: 'Spirit Leap goes 80 px farther.' },
            modR: genericTwig(3, { name: 'Spirit Leap', maxCd: 7 }, 'quick'),
            pass: ['fleet', 'might'],
            A: [ // Alpha Leap
                { id: 'dr_alpha_bond', name: 'Bonded', icon: 'count', desc: 'Landing fills 40 Bond (was 25).' },
                { id: 'dr_alpha_shock', name: 'Pounce Shock', icon: 'stun', desc: 'The landing stuns for 0.8 s.' },
                { id: 'dr_alpha_tandem', name: 'Tandem Leap', icon: 'range', desc: 'Your companion bounds to your landing and bites.' },
                { id: 'dr_alpha_apex', name: 'Apex', icon: 'burst', desc: 'A Maul within 3 s of the leap hits x1.5.' },
            ],
            B: [ // Scatter the Herd
                { id: 'dr_scatter_far', name: 'Stampede', icon: 'range', desc: 'The landing throws enemies 140 px (was 80).' },
                { id: 'dr_scatter_whirl', name: 'Frenzied Whirl', icon: 'count', desc: 'The whirl snaps at 12 enemies at x0.75 (was 8 at x0.5).' },
                { id: 'dr_scatter_trample', name: 'Trampled', icon: 'slow', desc: 'Thrown enemies are slowed by 40% for 2 s.' },
                { id: 'dr_scatter_spirits', name: 'Spirit Scatter', icon: 'burst', desc: 'Your spirit animals whirl too.' },
            ],
        },
        4: { // Call of the Wild
            modL: { id: 'dr_call_howl', name: 'Thunderous Howl', icon: 'radius', desc: 'The howl reaches 40% farther.' },
            modR: genericTwig(4, { name: 'Call of the Wild', maxCd: 15 }, 'quick'),
            pass: ['focus', 'might'],
            A: [ // Dire Aspect
                { id: 'dr_dire_long', name: 'Elder Blood', icon: 'duration', desc: 'The great form lasts 11 s (was 8).' },
                { id: 'dr_dire_feast', name: 'Blood Feast', icon: 'heal', desc: 'Its bites heal 1% of your Max HP.' },
                { id: 'dr_dire_terror', name: 'Terror', icon: 'slow', desc: 'Non-bosses within 250 px flee for 1.5 s when it rises.' },
                { id: 'dr_dire_apex', name: 'Apex Predator', icon: 'burst', desc: 'Every 3rd bite in the great form is a Maul (it keeps your Bond).' },
            ],
            B: [ // Wild Hunt
                { id: 'dr_hunt_long', name: 'The Long Hunt', icon: 'duration', desc: 'The spirits stay 16 s (was 12).' },
                { id: 'dr_hunt_bond', name: 'Pack Bond', icon: 'count', desc: 'The spirits\' bites on Scented prey build Bond.' },
                { id: 'dr_hunt_encircle', name: 'Encircle', icon: 'slow', desc: 'The spirits each take different prey and slow it.' },
                { id: 'dr_hunt_stampede', name: 'Spirit Stampede', icon: 'burst', desc: 'As they fade, the spirits charge through the nearest enemies.' },
            ],
        },
        bridges: { 12: 'vit', 24: 'might', 43: 'fleet', 31: 'focus' },
    },
    kensei: {
        1: { // Parry Thrust / Blade Surge
            modL: { id: 'ke_q_flow', name: 'Keen Edge', icon: 'count', desc: 'The sweep gives 40 Flow on a hit (was 30).' },
            modR: genericTwig(1, { name: 'Parry Thrust', maxCd: 4 }, 'quick'),
            pass: ['might', 'might'],
            A: [ // Counter Stance (in hand)
                { id: 'ke_counter_long', name: 'Iron Will', icon: 'duration', desc: 'You can hold the guard for 2.5 s (was 1.5).' },
                { id: 'ke_counter_flow', name: 'Flowing Guard', icon: 'count', desc: '+15 Flow for every parry in the guard.' },
                { id: 'ke_counter_arrow', name: 'Arrow Cutter', icon: 'range', desc: 'Shots that reach the guard fly back at the shooter.' },
                { id: 'ke_counter_draw', name: 'Final Draw', icon: 'burst', desc: 'Letting go after 2 or more parries looses an Iaido line toward the cursor (x2).' },
            ],
            B: [ // Chain Surge (airborne)
                { id: 'ke_chain_more', name: 'Hunting Arc', icon: 'count', desc: 'The blade darts through 8 enemies (was 5).' },
                { id: 'ke_chain_flow', name: 'Feeding Blade', icon: 'count', desc: '+4 Flow per dart.' },
                { id: 'ke_chain_sever', name: 'Sever', icon: 'damage', desc: 'Enemies it darts through take 15% more from you for 4 s.' },
                { id: 'ke_chain_coup', name: 'Coup de Grace', icon: 'burst', desc: 'The last dart hits x3 and stuns.' },
            ],
        },
        2: { // Deploy / Recall
            modL: { id: 'ke_e_drain', name: 'Steady Flight', icon: 'duration', desc: 'The airborne blade drains Flow 15% slower.' },
            modR: { id: 'ke_e_cut', name: 'Sharper Return', icon: 'damage', desc: 'Return Cut hits 25% harder.' },
            pass: ['focus', 'fleet'],
            A: [ // Catch Parry (in hand)
                { id: 'ke_catch_long', name: 'Steady Grip', icon: 'duration', desc: 'The catch\'s parry window lasts 1.5 s (was 1).' },
                { id: 'ke_catch_keep', name: 'Refund', icon: 'count', desc: 'You keep 30% Flow when you recall.' },
                { id: 'ke_catch_full', name: 'Riposte Recall', icon: 'damage', desc: 'The recall cut always lands as if your Flow were full.' },
                { id: 'ke_catch_perfect', name: 'Perfect Catch', icon: 'burst', desc: 'A parry in the window fires Shadow Step (Counter Step) at once and readies it again.' },
            ],
            B: [ // Twin Blades (airborne)
                { id: 'ke_twin_sharp', name: 'Sharpened Twin', icon: 'damage', desc: 'The twin hits at x0.8 of the blade (was x0.6).' },
                { id: 'ke_twin_guard', name: 'Guarding Twin', icon: 'shield', desc: 'The twin circles you instead and cuts enemy shots out of the air.' },
                { id: 'ke_twin_early', name: 'Early Deploy', icon: 'cooldown', desc: 'Deploy from 70% Flow: the bar fills and the blade launches Empowered.' },
                { id: 'ke_twin_reunion', name: 'Reunion', icon: 'burst', desc: 'Recalling with both blades out crosses their paths for a x2 cut.' },
            ],
        },
        3: { // Shadow Step / Spatial Swap
            modL: { id: 'ke_step_far', name: 'Long Step', icon: 'range', desc: 'Shadow Step goes 80 px farther.' },
            modR: genericTwig(3, { name: 'Shadow Step', maxCd: 5 }, 'quick'),
            pass: ['fleet', 'vit'],
            A: [ // Ghost Step (in hand)
                { id: 'ke_ghost_long', name: 'Fading', icon: 'duration', desc: 'You stay a ghost for 2.5 s (was 1.5).' },
                { id: 'ke_ghost_flow', name: 'Silent Flow', icon: 'count', desc: 'Your Flow doesn\'t fade while you\'re a ghost.' },
                { id: 'ke_ghost_blades', name: 'Path of Blades', icon: 'pierce', desc: 'A phantom blade rides along with the step, piercing everything on the way.' },
                { id: 'ke_ghost_strike', name: 'Death from Nowhere', icon: 'burst', desc: 'Your first hit as a ghost is x2 (was +50%) and readies Q.' },
            ],
            B: [ // Echo Swap (airborne)
                { id: 'ke_echo_long', name: 'Long Echo', icon: 'duration', desc: 'You can swap back for 3.5 s (was 2).' },
                { id: 'ke_echo_cut', name: 'Cutting Swap', icon: 'damage', desc: 'Every swap cuts the line between you and the blade.' },
                { id: 'ke_echo_surge', name: 'Surge Reset', icon: 'cooldown', desc: 'Every swap readies Blade Surge (Q).' },
                { id: 'ke_echo_triple', name: 'Triple Echo', icon: 'count', desc: 'A third swap.' },
            ],
        },
        4: { // Blade Whirlwind / Shatter Storm
            modL: { id: 'ke_r_flow', name: 'Gathering Wind', icon: 'count', desc: '+8 Flow for every enemy the whirlwind hits.' },
            modR: genericTwig(4, { name: 'Blade Whirlwind', maxCd: 12 }, 'quick'),
            pass: ['focus', 'might'],
            A: [ // Vortex (in hand)
                { id: 'ke_vortex_wide', name: 'Eye of the Storm', icon: 'radius', desc: 'The vortex reaches 330 px (was 250).' },
                { id: 'ke_vortex_twice', name: 'Second Gust', icon: 'count', desc: 'It strikes again 0.5 s later (x0.6).' },
                { id: 'ke_vortex_slow', name: 'Undertow', icon: 'slow', desc: 'Pulled enemies are slowed by 40% for 2 s.' },
                { id: 'ke_vortex_twister', name: 'Hurricane Draw', icon: 'pull', desc: 'A tornado stays for 2 s and keeps pulling.' },
            ],
            B: [ // Shard Shield (airborne)
                { id: 'ke_shards_more', name: 'More Shards', icon: 'count', desc: '9 shards (was 6).' },
                { id: 'ke_shards_flow', name: 'Mirror Shards', icon: 'count', desc: '+5 Flow for every shot the shards shatter.' },
                { id: 'ke_shards_wide', name: 'Wide Orbit', icon: 'radius', desc: 'The shards circle at 110 px (was 80).' },
                { id: 'ke_shards_release', name: 'Release', icon: 'burst', desc: 'R again flings every shard outward as a nova. The cooldown starts then.' },
            ],
        },
        bridges: { 12: 'might', 24: 'focus', 43: 'fleet', 31: 'vit' },
    },
    monk: { // monk.js "the web"; MONK.md Step 2
        1: { // Chi Wave / Rushing Fist
            modL: { id: 'mk_wave_far', name: 'Long Reach', icon: 'range', desc: 'The chi wave flies 900 px (was 600).' },
            modR: { id: 'mk_wave_chi', name: 'Focused Chi', icon: 'count', desc: 'A chi wave that hits gives 15 Chi.' },
            pass: ['might', 'fleet'],
            A: [ // Seven-Star Rush: chain executions through a weakened pack
                { id: 'mk_star_far', name: 'Shooting Star', icon: 'range', desc: 'The next star can be up to 500 px away (was 350).' },
                { id: 'mk_star_heal', name: 'Star\'s Breath', icon: 'heal', desc: 'A rush that kills heals 3% Max HP.' },
                { id: 'mk_star_splash', name: 'Falling Star', icon: 'radius', desc: 'Every rush also strikes everything within 70 px of its target (x0.4).' },
                { id: 'mk_star_seven', name: 'Seven Stars', icon: 'burst', desc: 'Up to 7 rushes, and a chain of 3 or more ends in a Hundred-Hand Strike where you stand, without spending Chi.' },
            ],
            B: [ // Resonating Mark: the burst for bosses and elites
                { id: 'mk_res_long', name: 'Lingering Echo', icon: 'duration', desc: 'The mark and its window last 5 s (was 3).' },
                { id: 'mk_res_deep', name: 'Deep Resonance', icon: 'damage', desc: 'The mark stores 45% of your damage (was 30%).' },
                { id: 'mk_res_spread', name: 'Sympathetic Echo', icon: 'radius', desc: 'The detonation also hits enemies within 120 px for half the store.' },
                { id: 'mk_res_twice', name: 'Echo of Echoes', icon: 'burst', desc: 'After the detonation the mark comes back once more for 3 s, for a second Rushing Fist.' },
            ],
        },
        2: { // Earth Palm / Crippling Tremor
            modL: { id: 'mk_palm_wide', name: 'Broad Palm', icon: 'radius', desc: 'Earth Palm\'s blast reaches 170 px (was 130).' },
            modR: { id: 'mk_palm_daze', name: 'Stunning Palm', icon: 'stun', desc: 'Earth Palm staggers what it hits for 0.4 s (not bosses).' },
            pass: ['vit', 'might'],
            A: [ // Gathering Palm: heap the pack up for the flurry
                { id: 'mk_gather_far', name: 'Long Arms', icon: 'range', desc: 'The recast pulls marked enemies from 700 px (was 500).' },
                { id: 'mk_gather_slow', name: 'Heavy Earth', icon: 'slow', desc: 'The gathered are slowed as by the Tremor: 60%, fading over 2 s.' },
                { id: 'mk_gather_chi', name: 'Gathering Storm', icon: 'count', desc: '5 Chi for every enemy gathered.' },
                { id: 'mk_gather_quake', name: 'Collapse', icon: 'burst', desc: 'When they land, the heap is struck by an earth slam (the palm\'s hit, 150 px) and stunned for 1 s (not bosses).' },
            ],
            B: [ // Stone Skin: dive in, palm, stand in it
                { id: 'mk_stone_thick', name: 'Granite', icon: 'shield', desc: 'Every mark gives 7% Max HP of stone (was 5%).' },
                { id: 'mk_stone_thorns', name: 'Jagged Stone', icon: 'thorns', desc: 'While the stone is hardened, enemies touching you take a basic every 0.5 s.' },
                { id: 'mk_stone_spring', name: 'Mountain Spring', icon: 'heal', desc: 'If the stone runs out unbroken, what\'s left of it heals you.' },
                { id: 'mk_stone_avalanche', name: 'Avalanche', icon: 'burst', desc: 'The hardened stone\'s burst reaches 200 px (was 140), stuns for 1 s (not bosses) and gives back half of Earth Palm\'s cooldown.' },
            ],
        },
        3: { // Swift Step / Iron Will
            modL: { id: 'mk_step_far', name: 'Long Stride', icon: 'range', desc: 'Swift Step goes 80 px farther.' },
            modR: { id: 'mk_crane_wide', name: 'Crane Wings', icon: 'radius', desc: 'Crane Kick reaches 150 px (was 110) and pushes 120 px (was 80).' },
            pass: ['fleet', 'vit'],
            A: [ // Tiger's Path: a dash that strikes
                { id: 'mk_tiger_mark', name: 'Tiger\'s Mark', icon: 'damage', desc: 'Enemies the step strikes take +15% damage from you for 3 s.' },
                { id: 'mk_tiger_prowl', name: 'Prowl', icon: 'cooldown', desc: 'Each enemy the step strikes takes 0.5 s off Swift Step\'s cooldown (up to 2 s).' },
                { id: 'mk_tiger_blood', name: 'Blood Trail', icon: 'heal', desc: 'Each enemy the step strikes heals you 1.5% Max HP (up to 6%).' },
                { id: 'mk_tiger_frenzy', name: 'Tiger\'s Frenzy', icon: 'burst', desc: 'A step that strikes 3 or more makes your next flurry a Hundred-Hand Strike, without spending Chi.' },
            ],
            B: [ // Karmic Will: take it, then give it back
                { id: 'mk_karma_long', name: 'Long Will', icon: 'duration', desc: 'Iron Will lasts 6 s (was 4).' },
                { id: 'mk_karma_taunt', name: 'Provoke', icon: 'pull', desc: 'Iron Will draws the non-bosses within 250 px to you for 1.5 s: they walk in and hold their attacks.' },
                { id: 'mk_karma_heal', name: 'Balance', icon: 'heal', desc: 'The shockwave heals you for 25% of what was stored.' },
                { id: 'mk_karma_wheel', name: 'Wheel of Karma', icon: 'burst', desc: 'The store hits x3 (was x2) and the shockwave stuns for 1 s (not bosses).' },
            ],
        },
        4: { // Dragon Kick / Dragon's Descent
            modL: { id: 'mk_kick_far', name: 'Long Kick', icon: 'range', desc: 'The kicked body flies 500 px (was 350).' },
            modR: { id: 'mk_kick_chi', name: 'Inner Dragon', icon: 'count', desc: 'Dragon Kick gives 40 Chi.' },
            pass: ['focus', 'might'],
            A: [ // Pinball Kick: chaos in a crowded room
                { id: 'mk_pin_more', name: 'Extra Ball', icon: 'count', desc: 'The body bounces 5 times (was 3).' },
                { id: 'mk_pin_speed', name: 'Gathering Speed', icon: 'damage', desc: 'Every bounce adds +25% to everything the body hits after it.' },
                { id: 'mk_pin_ring', name: 'Ringing Blow', icon: 'stun', desc: 'The body\'s stuns last 1.2 s (was 0.6), the final slam\'s 1.5 s (was 1).' },
                { id: 'mk_pin_multi', name: 'Multiball', icon: 'burst', desc: 'The first enemy the body bounces off is launched too, bouncing on its own (not bosses).' },
            ],
            B: [ // Rising Dragon: lift one out of the fight and take it apart
                { id: 'mk_rise_wings', name: 'Hundred Wings', icon: 'count', desc: '10 blows in the air (was 6).' },
                { id: 'mk_rise_sunder', name: 'Skyward Sunder', icon: 'damage', desc: 'The launched enemy takes +25% damage from you while it\'s up and for 3 s after.' },
                { id: 'mk_rise_meteor', name: 'Meteor Spike', icon: 'radius', desc: 'The spike\'s shockwave reaches 200 px (was 140) and stuns for 1 s (not bosses).' },
                { id: 'mk_rise_endless', name: 'Endless Sky', icon: 'burst', desc: 'The spike bounces it back up once: recast within 1.5 s for a second combo.' },
            ],
        },
        bridges: { 12: 'might', 24: 'vit', 43: 'focus', 31: 'fleet' },
    },
    swordsaint: { // swordsaint.js (the web is inside each skill); SWORDSAINT.md Step 2. No self-healing anywhere, by the user's design
        1: { // Gale Step
            modL: { id: 'ss_step_far', name: 'Long Stride', icon: 'range', desc: 'Gale Step\'s dashes go 170 px (was 130) and the leap 240 px (was 190).' },
            modR: { id: 'ss_spin_wide', name: 'Wide Arc', icon: 'radius', desc: 'The steps\' spin cuts reach 130 px (was 100).' },
            pass: ['might', 'fleet'],
            A: [ // Tempest Dance: the steps gather the pack, the slam throws it
                { id: 'ss_tempest_reach', name: 'Gathering Wind', icon: 'pull', desc: 'The spins draw enemies in from 220 px (was 160).' },
                { id: 'ss_tempest_hang', name: 'Hang Time', icon: 'duration', desc: 'Launched enemies stay up, helpless, for 1 s (was 0.6).' },
                { id: 'ss_tempest_style', name: 'Storm Rhythm', icon: 'count', desc: 'A spin that hits 3 or more enemies gives 25 more Style.' },
                { id: 'ss_tempest_eye', name: 'Eye of the Tempest', icon: 'burst', desc: 'The slam leaves a cyclone for 2 s: it keeps the enemies within 160 px pulled in and cuts each for a basic every 0.4 s.' },
            ],
            B: [ // Duelist's Lunge: three cuts through one enemy, then the plunge
                { id: 'ss_duel_far', name: 'Long Lunge', icon: 'range', desc: 'The steps lock on from 300 px (was 220).' },
                { id: 'ss_duel_mark', name: 'Challenge', icon: 'damage', desc: 'An enemy your lunge cuts takes +20% damage from you for 4 s.' },
                { id: 'ss_duel_precise', name: 'Precise Cuts', icon: 'damage', desc: 'Each lunge through the same enemy hits harder: x1, then x1.3, then x1.6.' },
                { id: 'ss_duel_coup', name: 'Coup de Grâce', icon: 'burst', desc: 'The plunge kills a non-boss under 25% HP outright; on a boss it hits x4 (was x3).' },
            ],
        },
        2: { // Strike Air
            modL: { id: 'ss_air_wide', name: 'Broad Gust', icon: 'radius', desc: 'Strike Air\'s burst reaches 150 px (was 120).' },
            modR: { id: 'ss_air_stun', name: 'Pressure', icon: 'stun', desc: 'Strike Air\'s stuns last 0.9 s (was 0.6).' },
            pass: ['focus', 'might'],
            A: [ // Wind Cannon: control at range
                { id: 'ss_cannon_far', name: 'Long Barrel', icon: 'range', desc: 'The cannon reaches 650 px (was 450).' },
                { id: 'ss_cannon_bowl', name: 'Bowling Wind', icon: 'pierce', desc: 'An enemy hurled into another sends that one flying too, and so on down the line.' },
                { id: 'ss_cannon_called', name: 'Called Shot', icon: 'count', desc: 'Every enemy slammed into rock or another body gives 50 Style (2 a blast at most).' },
                { id: 'ss_cannon_twin', name: 'Second Barrel', icon: 'burst', desc: 'Strike Air can be cast again within 2 s for a second blast.' },
            ],
            B: [ // Eye of the Storm: gather the pack for the spins and Crosscut
                { id: 'ss_eye_far', name: 'Wide Eye', icon: 'pull', desc: 'The pull reaches 320 px (was 240).' },
                { id: 'ss_eye_shear', name: 'Shearing Pull', icon: 'damage', desc: 'Pulled enemies take the hit again when they arrive.' },
                { id: 'ss_eye_center', name: 'Still Center', icon: 'stun', desc: 'Stunned enemies take +20% damage from you while the stun lasts.' },
                { id: 'ss_eye_implode', name: 'Implosion', icon: 'burst', desc: 'Pulling in 5 or more enemies repeats the burst 0.5 s later (150 px, x1.5).' },
            ],
        },
        3: { // Mana Burst
            modL: { id: 'ss_burst_far', name: 'Long Jet', icon: 'range', desc: 'Mana Burst goes 220 px (was 160).' },
            modR: { id: 'ss_cross_wide', name: 'Wide Cross', icon: 'radius', desc: 'Crosscut\'s cuts reach 170 px (was 130).' },
            pass: ['fleet', 'vit'],
            A: [ // Counter Burst: the dodge answers itself
                { id: 'ss_counter_charge', name: 'Flowing Counter', icon: 'cooldown', desc: 'A counter gives a Mana Burst charge back.' },
                { id: 'ss_counter_shot', name: 'Return Fire', icon: 'pierce', desc: 'Shots you dodge are countered too: you flash to the shooter (up to 450 px).' },
                { id: 'ss_counter_stun', name: 'Disarm', icon: 'stun', desc: 'The counter stuns for 1 s (not bosses).' },
                { id: 'ss_counter_time', name: 'Time Stands Still', icon: 'burst', desc: 'A counter during bullet time makes it last 1 s longer.' },
            ],
            B: [ // Overdrive: the burst is a cut
                { id: 'ss_over_far', name: 'Afterburner', icon: 'range', desc: 'Mana Burst goes 240 px.' },
                { id: 'ss_over_wake', name: 'Prana Wake', icon: 'fire', desc: 'The burst leaves a trail of blue fire for 1.5 s that cuts for half a basic every 0.3 s.' },
                { id: 'ss_over_momentum', name: 'Momentum', icon: 'cooldown', desc: 'Cutting 3 or more enemies takes 1 s off the next charge.' },
                { id: 'ss_over_crossfire', name: 'Crossfire', icon: 'burst', desc: 'A Crosscut right after an Overdrive also lands, at half power, on up to 3 of the enemies the burst cut.' },
            ],
        },
        4: { // Unsealed Blade / Excalibur
            modL: { id: 'ss_unseal_long', name: 'Long Unsealing', icon: 'duration', desc: 'Unsealed Blade lasts 15 s (was 12).' },
            modR: { id: 'ss_beam_wide', name: 'Broad Light', icon: 'radius', desc: 'Excalibur\'s beam is 100 px wide (was 70).' },
            pass: ['focus', 'might'],
            A: [ // Endless Seal: a long stance fed by dodges
                { id: 'ss_seal_flow', name: 'Flowing Seal', icon: 'duration', desc: 'While Unsealed, every 50 Style you gain adds 0.5 s to it.' },
                { id: 'ss_seal_crescendo', name: 'Crescendo', icon: 'damage', desc: 'Unsealed\'s Power grows +5 for every 2 s it has lasted, up to +30 more.' },
                { id: 'ss_seal_golden', name: 'Golden Hour', icon: 'cooldown', desc: 'While Unsealed, bullet time lasts 1.5 s and can come every 2 s (was 3).' },
                { id: 'ss_seal_ever', name: 'Everlasting Light', icon: 'burst', desc: 'Excalibur can be fired again every 6 s for as long as the seal lasts.' },
            ],
            B: [ // Twin Moons: quick beams, two angles
                { id: 'ss_moon_cross', name: 'Crossing Moons', icon: 'burst', desc: 'Where two beams cross, the light bursts (90 px, the beam\'s hit x1).' },
                { id: 'ss_moon_rhythm', name: 'Double Rhythm', icon: 'count', desc: 'Every beam counts as a new action for Style, and one fired within 1 s of the last hits +25%.' },
                { id: 'ss_moon_step', name: 'Moonlit Step', icon: 'cooldown', desc: 'Every beam gives a Mana Burst charge.' },
                { id: 'ss_moon_third', name: 'Third Moon', icon: 'burst', desc: 'A third beam.' },
            ],
        },
        bridges: { 12: 'might', 24: 'focus', 43: 'fleet', 31: 'vit' },
    },
    witch: { // witch.js; WITCH.md Step 2
        1: { // Grave Hex
            modL: { id: 'wt_hex_wide', name: 'Wide Circle', icon: 'radius', desc: 'Grave Hex\'s circle reaches 150 px (was 110).' },
            modR: { id: 'wt_hex_long', name: 'Lingering Curse', icon: 'duration', desc: 'The hex lasts 9 s (was 6).' },
            pass: ['might', 'focus'],
            A: [ // Grave Pull: heap the pack up for the spray and the toads
                { id: 'wt_pull_root', name: 'Grasping Hands', icon: 'stun', desc: 'The hands hold what they pull: rooted for 1.5 s (not bosses).' },
                { id: 'wt_pull_miasma', name: 'Choking Miasma', icon: 'count', desc: 'Everything pulled takes 2 poison stacks.' },
                { id: 'wt_pull_crush', name: 'Crushing Grip', icon: 'damage', desc: 'When the pull ends, the heap is crushed: everything pulled takes the hex\'s hit again.' },
                { id: 'wt_pull_grave', name: 'Open Grave', icon: 'burst', desc: 'The centre opens into a grave for 4 s: enemies in it are slowed 50%, and every one that dies there rises at once as your minion, no soul needed.' },
            ],
            B: [ // Soul Leech: hex the pack, stand in it and spray
                { id: 'wt_leech_deep', name: 'Deep Leech', icon: 'heal', desc: 'Soul Leech heals 25% of the poison\'s damage (was 15%).' },
                { id: 'wt_leech_feast', name: 'Shared Feast', icon: 'heal', desc: 'Your minions within 300 px are mended by the same amount.' },
                { id: 'wt_leech_hoard', name: 'Hoarded Life', icon: 'shield', desc: 'Healing past full health becomes a shield (up to 15% Max HP).' },
                { id: 'wt_leech_siphon', name: 'Soul Siphon', icon: 'burst', desc: 'A hexed enemy that dies heals you 5% Max HP and leaves 2 souls.' },
            ],
        },
        2: { // Raise Dead
            modL: { id: 'wt_raise_far', name: 'Far Call', icon: 'range', desc: 'Raise Dead calls souls from 650 px (was 450).' },
            modR: { id: 'wt_raise_tough', name: 'Grave Toughness', icon: 'shield', desc: 'Your minions have 30% more HP.' },
            pass: ['vit', 'might'],
            A: [ // Grave Knights: the front line
                { id: 'wt_knight_cleave', name: 'Cleave', icon: 'radius', desc: 'A knight\'s swing hits everything in the arc in front of it.' },
                { id: 'wt_knight_guard', name: 'Shield Wall', icon: 'shield', desc: 'Knights take 35% less damage.' },
                { id: 'wt_knight_charge', name: 'Charge', icon: 'stun', desc: 'A knight charges the first enemy it sets on, striking and stunning it for 0.8 s (not bosses).' },
                { id: 'wt_knight_undying', name: 'Undying Legion', icon: 'burst', desc: 'A knight that falls gets back up once, with half its HP.' },
            ],
            B: [ // Skeleton Archers: damage from behind her
                { id: 'wt_skel_volley', name: 'Split Shot', icon: 'count', desc: 'Every third shot is three arrows in a fan.' },
                { id: 'wt_skel_venom', name: 'Venom Tips', icon: 'damage', desc: 'Each arrow adds half a poison stack.' },
                { id: 'wt_skel_pierce', name: 'Bodkin', icon: 'pierce', desc: 'Arrows pierce the first enemy they hit.' },
                { id: 'wt_skel_rain', name: 'Bone Rain', icon: 'burst', desc: 'Every 6 s the archers loose together into the sky: a rain of bone falls on their target, 120 px round it, two shots from each archer.' },
            ],
        },
        3: { // Broom Flight
            modL: { id: 'wt_broom_fumes', name: 'Lasting Fumes', icon: 'duration', desc: 'The toxic trail lingers 5 s (was 3) and is 40% wider.' },
            modR: { id: 'wt_broom_after', name: 'Afterglide', icon: 'range', desc: 'For 2 s after you land you move 50% faster.' },
            pass: ['fleet', 'vit'],
            A: [ // Swoop: a dive that crashes into the pack
                { id: 'wt_swoop_wide', name: 'Great Crash', icon: 'radius', desc: 'The crash reaches 180 px (was 130).' },
                { id: 'wt_swoop_stun', name: 'Brutal Landing', icon: 'stun', desc: 'The crash stuns for 0.8 s (not bosses).' },
                { id: 'wt_swoop_saddle', name: 'Back in the Saddle', icon: 'cooldown', desc: 'Each enemy the crash hits takes 0.5 s off Broom Flight\'s cooldown (up to 3 s).' },
                { id: 'wt_swoop_crater', name: 'Toxic Crater', icon: 'burst', desc: 'The crash leaves a poison pool for 4 s (150 px) that adds a poison stack every 0.5 s.' },
            ],
            B: [ // Soul Sweep: harvest the field from the air
                { id: 'wt_sweep_wide', name: 'Wide Sweep', icon: 'radius', desc: 'The broom gathers souls from 120 px (was 60).' },
                { id: 'wt_sweep_warm', name: 'Soul Warmth', icon: 'heal', desc: 'Each soul gathered heals you 2% Max HP.' },
                { id: 'wt_sweep_fresh', name: 'Fresh Recruits', icon: 'heal', desc: 'Landing restores your living minions to full HP.' },
                { id: 'wt_sweep_reap', name: 'Reaper\'s Ride', icon: 'burst', desc: 'Enemies below 15% HP that the broom passes over are reaped at once (not bosses), each leaving a soul.' },
            ],
        },
        4: { // Hex of the Toad
            modL: { id: 'wt_toad_wide', name: 'Wide Hex', icon: 'radius', desc: 'The hex reaches 230 px (was 180).' },
            modR: { id: 'wt_toad_long', name: 'Long Croak', icon: 'duration', desc: 'The toads last 5.5 s (was 4).' },
            pass: ['focus', 'might'],
            A: [ // Toad Plague: every toad a poison bomb
                { id: 'wt_plague_big', name: 'Bloated', icon: 'radius', desc: 'The bursts reach 130 px (was 90).' },
                { id: 'wt_plague_virulent', name: 'Virulent', icon: 'count', desc: 'The bursts add 4 poison stacks (was 2).' },
                { id: 'wt_plague_chain', name: 'Chain Croak', icon: 'stun', desc: 'An enemy caught in a burst turns into a toad for 2 s (once each, not bosses), and bursts in turn.' },
                { id: 'wt_plague_pond', name: 'Plague Pond', icon: 'burst', desc: 'Each burst leaves a poison pond for 4 s (70 px): a poison stack every 0.5 s and a 30% slow.' },
            ],
            B: [ // Familiar Toads: the pack turned on itself
                { id: 'wt_fam_venom', name: 'Venomous Bite', icon: 'damage', desc: 'Their bites add a poison stack.' },
                { id: 'wt_fam_lure', name: 'Croaking Lure', icon: 'pull', desc: 'They draw the non-bosses within 200 px to them.' },
                { id: 'wt_fam_loyal', name: 'Loyal', icon: 'duration', desc: 'Familiars stay toads 2 s longer.' },
                { id: 'wt_fam_forever', name: 'Forever Yours', icon: 'burst', desc: 'When the hex ends, every familiar still alive dies and rises at once as your minion, no soul needed.' },
            ],
        },
        bridges: { 12: 'might', 24: 'vit', 43: 'focus', 31: 'fleet' },
    },
    ranger: {
        1: { // Storm Arrow
            modL: { id: 'storm_steady', name: 'Steady Hands', icon: 'cooldown', desc: 'Storm Arrow draws fully 30% faster.' },
            modR: { id: 'storm_broad', name: 'Broadhead', icon: 'radius', desc: 'The arrow\'s line is 50% wider.' },
            pass: ['might', 'might'],
            A: [ // Ballista Shot: push the pack off you, or pin it to the rock
                { id: 'ballista_far', name: 'Siege Draw', icon: 'range', desc: 'The arrow hurls them 320 px (was 220).' },
                { id: 'ballista_crush', name: 'Crushing Impact', icon: 'damage', desc: 'An enemy slammed into a wall takes the arrow\'s hit again.' },
                { id: 'ballista_pin', name: 'Pinned', icon: 'stun', desc: 'Slammed enemies are stunned for 2.5 s (was 1.5).' },
                { id: 'ballista_domino', name: 'Domino', icon: 'pull', desc: 'Hurled enemies knock whoever they run into along with them, half as far, and stun them for 1 s.' },
            ],
            B: [ // Hunter's Mark: the boss tool
                { id: 'mark_long', name: 'Long Hunt', icon: 'duration', desc: 'The Mark lasts 10 s (was 6).' },
                { id: 'mark_deep', name: 'Open Wound', icon: 'damage', desc: 'Your skills deal +20% to the Marked prey too.' },
                { id: 'mark_spread', name: 'Pack Hunter', icon: 'range', desc: 'When the Marked prey dies, the Mark leaps to the nearest enemy within 400 px.' },
                { id: 'mark_harvest', name: 'Hunter\'s Harvest', icon: 'lightning', desc: 'Every 5th basic arrow on the Marked prey calls lightning down on it (half of Storm Arrow\'s hit).' },
            ],
        },
        2: { // Nature's Stride
            modL: { id: 'stride_herb', name: 'Herbal Lore', icon: 'heal', desc: 'Nature\'s Stride heals 50% more.' },
            modR: { id: 'stride_light', name: 'Light Feet', icon: 'duration', desc: 'The speed boost lasts 1 s longer.' },
            pass: ['vit', 'fleet'],
            A: [ // Windwalk: the answer to archers and bullet hells
                { id: 'ww_long', name: 'Long Breeze', icon: 'duration', desc: 'Windwalk lasts 3.5 s (was 2).' },
                { id: 'ww_dodge', name: 'Slipstream', icon: 'shield', desc: 'While you windwalk, the first melee blow is dodged too.' },
                { id: 'ww_reflect', name: 'Return to Sender', icon: 'range', desc: 'Shots that pass through you fly back as wind blades (a basic and a half each).' },
                { id: 'ww_gale', name: 'Gale Burst', icon: 'burst', desc: 'Windwalk ends in a gust: everything within 220 px is thrown back and slowed for 2 s.' },
            ],
            B: [ // Hunter's Focus: a turret window
                { id: 'focus_long', name: 'Deep Focus', icon: 'duration', desc: 'Focus lasts 6 s (was 4).' },
                { id: 'focus_pierce', name: 'Piercing Gaze', icon: 'pierce', desc: 'Arrows loosed in Focus pierce.' },
                { id: 'focus_haste', name: 'Steady Rhythm', icon: 'cooldown', desc: '+30% attack speed in Focus.' },
                { id: 'focus_triple', name: 'Volley Stance', icon: 'count', desc: 'In Focus every basic looses three arrows.' },
            ],
        },
        3: { // Vault
            modL: { id: 'vault_far', name: 'Long Strides', icon: 'range', desc: 'Vault carries you 80 px farther.' },
            modR: { id: 'vault_nimble', name: 'Nimble', icon: 'cooldown', mod: { cd: 0.85 }, desc: 'Vault\'s cooldown is 15% shorter.' },
            pass: ['fleet', 'vit'],
            A: [ // Disengage: run, turn, shred
                { id: 'dis_bramble', name: 'Bramble Snare', icon: 'slow', desc: 'Brambles grow where you took off for 3 s: enemies in them are slowed by 50% and pricked.' },
                { id: 'dis_spread', name: 'Fan of Arrows', icon: 'count', desc: 'The spread is 7 arrows (was 5), and they pierce.' },
                { id: 'dis_quick', name: 'Quick Escape', icon: 'cooldown', desc: 'Vaulting away from an enemy within 150 px makes the cooldown 40% shorter.' },
                { id: 'dis_hitrun', name: 'Hit and Run', icon: 'damage', desc: 'Your next three basics (not one) loose the spread.' },
            ],
            B: [ // Twin Vault: chain hops through a fight
                { id: 'tv_three', name: 'Third Wind', icon: 'count', desc: 'Three charges.' },
                { id: 'tv_momentum', name: 'Wind Rider', icon: 'range', desc: 'Every Vault fills your Momentum.' },
                { id: 'tv_guard', name: 'Untouchable', icon: 'shield', desc: 'You take 30% less damage for 1.5 s after each Vault.' },
                { id: 'tv_storm', name: 'Storm Hopper', icon: 'lightning', desc: 'Every landing calls lightning down on the nearest enemy within 300 px (twice Vault\'s hit).' },
            ],
        },
        4: { // Volley
            modL: { id: 'volley_wide', name: 'Wide Spread', icon: 'radius', desc: 'The Volley\'s circle is 30% wider.' },
            modR: { id: 'volley_bleed', name: 'Barbed Tips', icon: 'thorns', desc: 'Volley arrows make what they hit bleed for 3 s.' },
            pass: ['focus', 'might'],
            A: [ // Storm Rain: deny an area, fight around it
                { id: 'rain_long', name: 'Monsoon', icon: 'duration', desc: 'The storm lasts 6 s (was 4).' },
                { id: 'rain_follow', name: 'Following Storm', icon: 'pull', desc: 'The cloud drifts onto the nearest enemies.' },
                { id: 'rain_slow', name: 'Downpour', icon: 'slow', desc: 'Enemies under the cloud are slowed by 30%.' },
                { id: 'rain_thunder', name: 'Thunderhead', icon: 'lightning', desc: 'Every 0.8 s, lightning strikes the toughest enemy under the cloud (1.5x an arrow\'s full hit).' },
            ],
            B: [ // Focused Barrage: the boss killer
                { id: 'barrage_more', name: 'Quiver Dump', icon: 'count', desc: '14 arrows (was 10).' },
                { id: 'barrage_pin', name: 'Pinning Shafts', icon: 'stun', desc: 'The target is slowed by 50% while the arrows land, then rooted for 1 s.' },
                { id: 'barrage_split', name: 'Overflow', icon: 'range', desc: 'Arrows still falling when the target dies seek the nearest enemy.' },
                { id: 'barrage_finale', name: 'Final Shaft', icon: 'lightning', desc: 'The last arrow is a storm bolt: 4x the hit and a 1 s stun.' },
            ],
        },
        bridges: { 12: 'focus', 24: 'might', 43: 'vit', 31: 'fleet' },
    },
};

// The generic twigs for a class without its own content: Quickened needs a real cooldown, Honed a hit
function genericTwig(slot, sk, kind) {
    if (kind === 'quick' && sk.maxCd > 1) return { id: `s${slot}_quick`, name: `Quickened ${sk.name}`, icon: 'cooldown', mod: { cd: 0.88 }, desc: `${sk.name}'s cooldown is 12% shorter.` };
    if (kind === 'honed' && sk.baseDmg > 0) return { id: `s${slot}_honed`, name: `Honed ${sk.name}`, icon: 'damage', mod: { dmg: 1.15 }, desc: `${sk.name} hits 15% harder.` };
    return null;
}

// ---------- icons (drawn on the branch's colour, cached by icons.js renderIcon) ----------

const TAU_T = Math.PI * 2;
const TALENT_GLYPHS = {
    range: c => { icLine(c, '#fff', 4, [[12, 32], [46, 32]]); icArrowHead(c, 50, 32, 0, 10, '#fff'); icLine(c, '#fff', 3, [[12, 21], [12, 43]]); },
    radius: c => { icArc(c, '#fff', 3, 32, 32, 20, 0, TAU_T); icArc(c, '#fff', 3, 32, 32, 11, 0, TAU_T); icEll(c, 32, 32, 4, 4, '#fff', 0); },
    stun: c => { icStar(c, 32, 32, 19, '#ffe082'); },
    fire: c => { icPoly(c, [[32, 9], [45, 29], [43, 45], [32, 55], [21, 45], [19, 30], [27, 36]], '#ff8a50'); icPoly(c, [[32, 30], [38, 41], [32, 51], [26, 41]], '#ffe082', 0); },
    frost: c => { for (let i = 0; i < 3; i++) { const a = i * Math.PI / 3, x = Math.cos(a) * 20, y = Math.sin(a) * 20; icLine(c, '#e1f5fe', 4, [[32 - x, 32 - y], [32 + x, 32 + y]]); } icEll(c, 32, 32, 5, 5, '#fff', 0); },
    cooldown: c => { // an hourglass
        icPoly(c, [[20, 13], [44, 13], [32, 32]], '#e1f5fe'); icPoly(c, [[32, 32], [20, 51], [44, 51]], '#81d4fa');
        icLine(c, '#ffd54f', 4, [[15, 11], [49, 11]]); icLine(c, '#ffd54f', 4, [[15, 53], [49, 53]]);
    },
    duration: c => { icEll(c, 32, 33, 20, 20, '#f5f5f5'); icLine(c, '#37474f', 3, [[32, 33], [32, 19]], false); icLine(c, '#37474f', 3, [[32, 33], [42, 38]], false); icLine(c, '#ffd54f', 4, [[26, 9], [38, 9]]); },
    damage: c => { icSword(c, 14, 50, 50, 14, 4); icStar(c, 47, 45, 8, '#fff3e0'); },
    burst: c => { icStar(c, 32, 32, 21, '#ffcc80'); icEll(c, 32, 32, 7, 7, '#fff', 0); },
    thorns: c => { for (let i = 0; i < 8; i++) { const a = i * TAU_T / 8; icPoly(c, [[32 + Math.cos(a - 0.25) * 13, 32 + Math.sin(a - 0.25) * 13], [32 + Math.cos(a) * 25, 32 + Math.sin(a) * 25], [32 + Math.cos(a + 0.25) * 13, 32 + Math.sin(a + 0.25) * 13]], '#cfd8dc'); } icEll(c, 32, 32, 13, 13, '#90a4ae'); },
    heal: c => { icPoly(c, [[27, 12], [37, 12], [37, 27], [52, 27], [52, 37], [37, 37], [37, 52], [27, 52], [27, 37], [12, 37], [12, 27], [27, 27]], '#a5d6a7'); },
    shield: c => { icPoly(c, [[32, 10], [50, 17], [48, 36], [32, 54], [16, 36], [14, 17]], '#cfd8dc'); icPoly(c, [[32, 18], [42, 22], [41, 34], [32, 45]], '#eceff1', 0); },
    count: c => { icEll(c, 22, 38, 9, 9, '#fff'); icEll(c, 38, 38, 9, 9, '#fff'); icLine(c, '#ffd54f', 4, [[44, 14], [44, 28]]); icLine(c, '#ffd54f', 4, [[37, 21], [51, 21]]); },
    pull: c => { for (let i = 0; i < 4; i++) { const a = i * TAU_T / 4 + Math.PI / 4, x = Math.cos(a), y = Math.sin(a); icLine(c, '#fff', 3, [[32 + x * 24, 32 + y * 24], [32 + x * 12, 32 + y * 12]]); icArrowHead(c, 32 + x * 10, 32 + y * 10, a + Math.PI, 6, '#fff'); } },
    pierce: c => { icEll(c, 32, 32, 12, 12, '#90a4ae'); icLine(c, '#fff', 4, [[8, 44], [50, 20]]); icArrowHead(c, 53, 18, -0.52, 9, '#fff'); },
    slow: c => { icPoly(c, [[20, 26], [44, 26], [52, 52], [12, 52]], '#b0bec5'); icArc(c, '#b0bec5', 4, 32, 21, 7, Math.PI, TAU_T); icLine(c, '#37474f', 3, [[26, 40], [38, 40]], false); }, // a weight
    lightning: c => { icPoly(c, [[36, 8], [20, 35], [31, 35], [26, 56], [45, 26], [34, 26]], '#fff59d'); },
};

// The icon for any node: a skill's own icon for its trunk, evolutions and capstones; the gear slot's for a passive
function talentIcon(n) {
    const cid = activeClassId();
    if (n.kind === 'rank' || n.kind === 'evo') return skillIcon(cid, n.slot);
    if (n.kind === 'pass') return itemIcon({ type: PASSIVES[n.passive].gear });
    return renderIcon(`tg:${n.icon}:${n.color}`, n.color, TALENT_GLYPHS[n.icon] || TALENT_GLYPHS.burst);
}

// ---------- hooks ----------

// combat.js applyDamage: the marks that make an enemy take more from you (Frostbite, Marked Prey; Sundering Breath is the evolution's own)
function talentDmgMult(e) {
    let m = 1;
    if (e.chilledUntil > fxTime && hasTalent('frost_bite')) m *= 1.2; // Frostbite
    if (e.lodgedShield && hasTalent('hunt_mark') && e.lodgedShield.lodged) m *= 1.25; // Marked Prey (skills.js Hunting Shield)
    if (e.huntMarkUntil > fxTime && hasTalent('mark_deep')) m *= 1.2; // Open Wound (skills.js Hunter's Mark)
    if (e.sunderUntil > fxTime) m *= e.sunderMult;                     // Sundering Breath (skills.js sunderEnemy)
    if (activeClass.name === 'Machinist') m *= maDmgMult(e);             // machinist.js: Laser Sight, Double Signal
    if (activeClass.name === 'Cleric') m *= clDmgMult(e);                // cleric.js: Judgment, Wither
    if (activeClass.name === 'Kensei') m *= keDmgMult(e);                // kensei.js: Sever, Ghost Step's first hit
    if (activeClass.name === 'Monk') m *= mkDmgMult(e);                  // monk.js: Tiger's Mark, Skyward Sunder
    if (activeClass.name === 'Witch') m *= witchDmgMult(e);               // witch.js: a toad takes +25%
    if (activeClass.name === 'Swordsaint') m *= ssDmgMult(e);             // swordsaint.js: Challenge, Still Center
    return m;
}

// combat.js takeDamage, before armour: what the hero's talents do to a blow (0 = nothing gets through)
function talentsDamageTaken(amount, isContinuous, sourceObj) {
    amount = swDamageTaken(amount, isContinuous, sourceObj); // spellweaver_evo.js: Ice Armor, Close Call, Rune Ward, Retaliation
    if (activeClass.name === 'Nightblade') amount = nbDamageTaken(amount); // nightblade.js: Shadow Ring
    if (activeClass.name === 'Machinist') amount = maExoTaken(amount); // machinist.js: Exo-Frame
    if (buffs.dragonfire > 0 && hasTalent('wyrm_scales')) amount *= 0.85; // Scaled Hide
    if (buffs.tvGuard > 0) amount *= 0.7; // Untouchable (skills.js Twin Vault)
    if (buffs.windwalk > 0 && hasTalent('ww_dodge') && !isContinuous && !(sourceObj && sourceObj.isProjectile) && !player.slipUsed) { // Slipstream
        player.slipUsed = true;
        effects.push({ type: 'text', text: 'Evaded!', x: player.x, y: player.y - 30, color: '#e0f7fa', life: 0.6, maxLife: 0.6 });
        return 0;
    }
    return amount;
}

// combat.js takeDamage: a blow that would kill the hero
function talentsLethal() {
    if (swLethal()) return true; // spellweaver_evo.js: Second Chance, Last Ward
    if (!(buffs.dragonfire > 0 && player.undyingReady && hasTalent('wyrm_undying'))) return false;
    player.hp = 1; player.undyingReady = false; buffs.dragonfire = 0; player.iFrames = Math.max(player.iFrames, 1.0); // Undying Flame
    effects.push({ type: 'text', text: 'UNDYING', x: player.x, y: player.y - 50, color: '#ffab40', life: 1.2, maxLife: 1.2 });
    effects.push({ type: 'inferno_ring', x: player.x, y: player.y, radius: 150, life: 0.5, maxLife: 0.5 });
    addShake(4);
    return true;
}

// combat.js checkEnemyDeath: an enemy just died
function talentsOnKill(e) {
    if (activeClass.name === 'Nightblade') { nbOnKill(e); return; } // nightblade.js: Reaper's Chain, Plague Cloud
    if (activeClass.name === 'Cleric') { clOnKill(e); return; } // cleric.js: Rot
    if (activeClass.name === 'Ranger') { rangerOnKill(e); return; } // skills.js: Pack Hunter, Twin Vault's refund
    if (activeClass.name !== 'Dragonknight') return;
    if (e.burnTimer > 0 && hasTalent('inferno_spread')) { // Wildfire: the fire jumps on
        const near = enemies.filter(o => o !== e && !o.dead && !o.pod && Math.hypot(o.x - e.x, o.y - e.y) <= 180 + o.size / 2)
            .sort((a, b) => Math.hypot(a.x - e.x, a.y - e.y) - Math.hypot(b.x - e.x, b.y - e.y)).slice(0, 2);
        for (const o of near) { igniteEnemy(o, e.burnDps || 1); effects.push({ type: 'lightning', x1: e.x, y1: e.y, x2: o.x, y2: o.y, color: '#ff7043', life: 0.2, maxLife: 0.2 }); }
    }
    if (e.chilledUntil > fxTime && hasTalent('frost_shatter')) { // Shatterfrost
        const R = activeClass.skills[4], dmg = calcDmg(R.baseDmg, R.level) * 0.25;
        for (let i = 0; i < 6; i++) { const a = i * TAU_T / 6 + Math.random() * 0.4; projectiles.push({ x: e.x, y: e.y, vx: Math.cos(a) * 520, vy: Math.sin(a) * 520, radius: 7, color: '#b3e5fc', life: 0.55, type: 'basic', shape: 'shrapnel', damage: dmg, pierce: true, hitList: [e], isEnemy: false }); }
        burst(e.x, e.y, 0, TAU_T, 10, { kind: 'spark', color: '#e1f5fe', size: 2.5, life: 0.35, speed: [140, 340], drag: 5 });
    }
}

function knockFrom(e, x, y, d) { // push an enemy (not a boss) d px away from a point
    if (isBossE(e)) return;
    const a = Math.atan2(e.y - y, e.x - x); e.x += Math.cos(a) * d; e.y += Math.sin(a) * d; clampToBounds(e, e.size / 2);
}
