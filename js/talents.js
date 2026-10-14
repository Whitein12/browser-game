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
    return m;
}

// combat.js takeDamage, before armour: what the hero's talents do to a blow (0 = nothing gets through)
function talentsDamageTaken(amount, isContinuous, sourceObj) {
    amount = swDamageTaken(amount, isContinuous, sourceObj); // spellweaver_evo.js: Ice Armor, Close Call, Rune Ward, Retaliation
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
    if (e.type.startsWith('boss')) return;
    const a = Math.atan2(e.y - y, e.x - x); e.x += Math.cos(a) * d; e.y += Math.sin(a) * d; clampToBounds(e, e.size / 2);
}
