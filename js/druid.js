// ==========================================
// druid.js - Druid: Wild Bond (the wolf companion), skills, and visuals
// ==========================================
// The Druid fights at range with the totem while a wolf hunts at their side. You never steer the wolf:
//   - it hunts on its own, close to the Druid (prey within WOLF_LEASH of them);
//   - it goes after what you hit (Scent, SCENT_TIME) and pounces on snared (rooted) enemies, biting them for +50%;
//   - every bite on Scented prey builds Bond; at BOND_MAX its next bite is a Maul.
// player.wolves[0] is your own wolf and never leaves. Call of the Wild and Kindred Howl add spirit wolves with a `life`.
// The companion is picked when the run starts (showCompanionChoice): a wolf, or a black jaguar that pounces from range and
// bites slower but harder (same damage per second). The code calls them all "wolves"; `companion()` holds the differences.
// Wolves are untargetable: enemies and their shots ignore them, so a bullet hell can't kill your damage.

const WOLF_SPEED = 340, WOLF_RADIUS = 14, WOLF_LEASH = 450, WOLF_RECALL = 650;
const WOLF_BITE = 1.25, WOLF_BITE_CD = 0.8, WOLF_REACH = 22, WOLF_BITE_ANIM = 0.28; // x1.25 (was x1.35): Pounce Strike pays for it
// Pounce Strike (combos.js, the Spirit Leap finisher): the bolt after the leap calls the beasts onto what it hits
// The strike is the beast's own bite plus POUNCE_EXTRA wolf bites, so a combo adds the same for the wolf and the jaguar
// (3 of the companion's bites would give the jaguar, whose bite is 1.5x, half again the gain per combo)
const POUNCE_EXTRA = 2, POUNCE_STUN = 0.5, POUNCE_BOND = 20, POUNCE_RANGE = 450, POUNCE_SPREAD = 150;
const SCENT_TIME = 3.0, SNARE_BONUS = 0.5;
const WOLF_CROWD = 600, WOLF_SPACING = 16; // prey another wolf already has counts this much less (per wolf); wolves keep this far apart (× scale)
const BOND_MAX = 100, BOND_PER_BITE = 10, BOND_DECAY_AFTER = 4, BOND_DECAY = 8, MAUL_MULT = 4;
const SURGE_TIME = 5, SURGE_BITE_CD = 0.45, CLEAVE_RADIUS = 90, CLEAVE_MULT = 0.5;
// Bramble Snare is the Druid's crowd control: a wide burst that roots briefly, then slows (it no longer sends the companion)
const SNARE_RADIUS = 140, SNARE_ROOT = 1.0, SNARE_SLOW = 0.4, SNARE_SLOW_TIME = 4.0, LEAP_MIN = 100, LEAP_MAX = 250, LEAP_SLAM = 110, WOLF_SLAM = 90;
const HOWL_RADIUS = 250, DIRE_TIME = 8, DIRE_MULT = 2.5;
// Round-two combos (combos.js lists them; the Druid's own code lives here):
// Pincer (Thistle-Grip Claws on the companion's prey from the far side): x2 claws, a 1 s root (bosses too), a free Maul.
// Thorn Rake (claws on enemies Bramble Snare still roots): x2 claws and a bleed of x1 over 3 s.
// Barkburst (Spirit Leap during Feral Surge): the bark shell bursts into splinters on landing and regrows, once per Surge.
const PINCER_ANGLE = Math.PI * 2 / 3, PINCER_MULT = 2, PINCER_ROOT = 1.0, THORN_RAKE_MULT = 2, THORN_BLEED = 1, THORN_BLEED_TIME = 3;
const BARKBURST_RADIUS = 150, BARKBURST_MULT = 1;
const SPIRIT_TIME = 12, KINDRED_TIME = 8, SPIRIT_DMG = 0.4; // spirit animals (Call of the Wild, Kindred Howl): how long they stay, their bites vs your companion's

// rhythm = bite interval / the wolf's: bite damage, Bond per bite and Bloodrage healing all scale with it
// (and the Maul's bonus shrinks to match),
// so the jaguar's slower, heavier bites keep the same damage and Bond per second
const COMPANIONS = {
    wolf: { name: 'Wolf', rhythm: 1, pounce: null, sprite: 'wolf', color: '#9ccc65', big: 'Dire Wolf', spirits: 'Spirit wolves',
        tag: 'The steady hunter', desc: 'Runs its prey down and bites fast. Every 0.8 s, never lets go.' },
    jaguar: { name: 'Black Jaguar', rhythm: 1.5, pounce: { min: 60, max: 230, cd: 2.0 }, sprite: 'jaguar', color: '#ffca28', big: 'Elder Jaguar', spirits: 'Spirit jaguars',
        tag: 'The ambush hunter', desc: 'Pounces onto prey from range and bites slower but harder. Every 1.2 s, half again the damage.',
        passive: "Wild Bond: A black jaguar hunts at your side. It stalks whatever you hit (Scent, 3s) and favours enemies your snares hold, biting rooted prey for +50% DMG. It leaps onto prey from range and bites slower but harder than a wolf. Every bite on Scented prey builds Bond; at 100 Bond its next bite is a Maul (x3 DMG of its heavier bite, stuns). The jaguar can't be hurt.",
        words: [['a dire wolf', 'an elder jaguar'], ['dire wolf', 'elder jaguar'], ['heals you for 1.5%', 'heals you for 2.25%'], ['Dire Aspect', 'Elder Aspect'], ['Kindred Howl', 'Kindred Roar'], ['howls', 'roars'], ['wolves', 'jaguars'], ['wolf', 'jaguar'], ['Wolf', 'Jaguar']] },
};
function companion() { return COMPANIONS[player.companion] || COMPANIONS.wolf; }

// The web's talents (talents.js TALENT_WEBS.druid): Hunting Ground's thickets, Alpha Leap's clock, Apex Predator's count
const drw = { thickets: [], leapAt: -99, direBites: 0 };
function druidThicket(w) { return drw.thickets.find(t => Math.hypot(w.x - t.x, w.y - t.y) <= t.r) || null; }
function tandemLeap(w) { // Tandem Leap: the companion bounds to your landing and bites what's there
    wolfLeapTo(w, player.x + 26, player.y + 10, 0.28, 30, () => { const t = getNearestEnemyFromPoint(w.x, w.y, 140); if (t && wolfCanHunt(t)) wolfBite(w, t); }, true);
}
function spiritStampede(w) { // an expiring spirit charges through the nearest enemies
    const t = getNearestEnemyFromPoint(w.x, w.y, 400); if (!t) return;
    const a = Math.atan2(t.y - w.y, t.x - w.x), x1 = w.x + Math.cos(a) * 320, y1 = w.y + Math.sin(a) * 320, dmg = calcDmg(activeClass.basicDmg) * WOLF_BITE * 1.5;
    effects.push({ type: 'lightning', x1: w.x, y1: w.y, x2: x1, y2: y1, color: '#b2ff59', lineWidth: 6, life: 0.3, maxLife: 0.3 });
    for (const e of enemies) if (!e.dead && distToSegment(e.x, e.y, w.x, w.y, x1, y1) <= e.size / 2 + 24) applyDamage(e, dmg, 'wolf', a);
}
const drPower = () => isDruid() && buffs.feralSurge > 0 && druidUpg(2) === 'A' && hasTalent('dr_rage_fury') ? 0.15 : 0; // combat.js powerParts: Primal Fury
function isDruid() { return activeClass && activeClass.name === 'Druid'; }
function mainWolf() { return isDruid() && player.wolves ? player.wolves[0] : null; }
function hasHeartwood() { return equipment.weapon && equipment.weapon.name === 'Gnarled Heartwood Totem'; }
const scented = e => e.scentUntil > fxTime;
const snared = e => e.rootedTimer > 0;
const druidUpg = slot => activeClass.skills[slot].selectedUpg;

function makeWolf(x, y, o = {}) {
    return Object.assign({ x, y, angle: 0, vx: 0, vy: 0, target: null, retarget: 0, biteCd: 0.3, biteAnim: 0, walk: 0, move: 0,
        leap: null, z: 0, scale: 1, dmgMult: 1, spirit: false, life: Infinity, maxLife: Infinity, howl: 0, stuck: 0, seed: Math.random() * 10 }, o);
}

// Called on game start (newRun) and at the start of every wave, after the hero is placed: the wolf comes back to heel.
// Bond carries over between waves; it decays on its own when the wolf goes without prey.
function resetDruidState(newRun) {
    drw.thickets.length = 0; drw.leapAt = -99;
    if (newRun) { player.bond = 0; player.bondIdle = 0; player.freeMaul = false; if (isDruid()) applyCompanionText(); }
    player.wolves = null;
    buffs.feralSurge = 0; buffs.direWolf = 0; // (the bark shell keeps its shield; updateDruid ends it with the shield)
    if (!isDruid()) return;
    player.wolves = [makeWolf(player.x - 40, player.y + 24)];
}

// The run's copy of the class data speaks of the chosen beast (classes.json is written for the wolf)
function applyCompanionText() {
    const C = companion();
    if (!C.words) return;
    const swap = s => C.words.reduce((t, [a, b]) => t.split(a).join(b), s || '');
    activeClass.passive = C.passive;
    activeClass.rareWeapon.desc = swap(activeClass.rareWeapon.desc);
    for (let i = 1; i <= 4; i++) for (const u of ['upgA', 'upgB']) { const g = activeClass.skills[i][u]; g.name = swap(g.name); g.desc = swap(g.desc); }
}

// Packbond Bracers (main.js, a seed bolt that hit): a longer Scent, and Bond for feeding your companion's prey
function druidBoltHit(e) {
    if (!hasItem('Packbond Bracers') || e.dead) return;
    e.scentUntil = fxTime + 6;
    const w = mainWolf();
    if (w && w.target === e) addBond(3);
}

// Pounce Strike (main.js, a calling bolt that hit): your companion springs onto the prey from up to 450 px and lands a heavy bite
// (3x a bite, a 0.5 s stun, +20 Bond); spirit animals in range spring onto enemies near it (or the prey itself).
// A bolt that misses calls nothing. One call, not steering: the beast goes back to hunting on its own after.
function pounceCall(e) {
    if (!isDruid() || !player.wolves || e.dead || !wolfCanHunt(e)) return;
    effects.push({ type: 'text', text: 'POUNCE!', x: e.x, y: e.y - e.size / 2 - 20, color: '#ffca28', life: 0.7, maxLife: 0.7 });
    player.wolves.forEach((w, i) => {
        if (Math.hypot(e.x - w.x, e.y - w.y) > POUNCE_RANGE || (currentMap.grid && !walkClear(w.x, w.y, e.x, e.y))) return; // stage.js: not through rock
        let prey = e;
        if (w.spirit) { // spread over the pack around the prey
            const near = enemies.filter(o => o !== e && wolfCanHunt(o) && Math.hypot(o.x - e.x, o.y - e.y) <= POUNCE_SPREAD);
            if (near.length) prey = near[i % near.length];
        }
        const a = Math.atan2(prey.y - w.y, prey.x - w.x), stop = prey.size / 2 + 14;
        w.target = prey; w.retarget = 1.0; w.howl = 0;
        wolfLeapTo(w, prey.x - Math.cos(a) * stop, prey.y - Math.sin(a) * stop, 0.3, 40, () => pounceStrike(w, prey), true);
    });
}
function pounceStrike(w, e) {
    if (e.dead) return;
    const main = w === player.wolves[0], k = companion().rhythm, ang = Math.atan2(e.y - w.y, e.x - w.x);
    // Alpha Leap: a Pounce Strike at full Bond is a Maul too (the Maul's extra is 3 wolf bites for either beast, as in wolfBite)
    const maul = main && druidUpg(3) === 'A' && player.bond >= BOND_MAX;
    const wolfBiteDmg = calcDmg(activeClass.basicDmg) * WOLF_BITE * w.dmgMult * (main && buffs.direWolf > 0 ? DIRE_MULT : 1);
    const dmg = wolfBiteDmg * (k + POUNCE_EXTRA + (maul ? MAUL_MULT - 1 : 0));
    w.angle = ang; w.biteAnim = WOLF_BITE_ANIM; w.biteCd = WOLF_BITE_CD * k / (1 + attackSpeedBonus());
    applyDamage(e, dmg, 'wolf', ang);
    if (!e.dead) e.stunTimer = Math.max(e.stunTimer || 0, maul ? 1.0 : POUNCE_STUN); // bosses shake it off 3x as fast
    effects.push({ type: 'pounce_rake', x: e.x, y: e.y, angle: ang, radius: e.size / 2 + 30, life: 0.4, maxLife: 0.4 }); // skillfx_space.js
    effects.push({ type: 'wolf_bite', x: e.x, y: e.y, angle: ang, radius: Math.max(14, e.size * 0.6) * (maul ? 1.9 : 1.5), life: 0.35, maxLife: 0.35 });
    addShake(maul ? 4 : main ? 3 : 1.5);
    if (maul) {
        player.bond = 0;
        effects.push({ type: 'wolf_maul', x: e.x, y: e.y, radius: e.size / 2 + 40, life: 0.45, maxLife: 0.45 });
        effects.push({ type: 'text', text: 'MAUL!', x: e.x, y: e.y - e.size / 2 - 14, color: '#ff7043', life: 0.8, maxLife: 0.8 });
        if (hasHeartwood()) for (const o of enemies) if (o !== e && wolfCanHunt(o) && Math.hypot(o.x - e.x, o.y - e.y) <= 100 + o.size / 2) applyDamage(o, dmg * 0.5, 'wolf', ang); // the Heartwood Totem
    } else if (main) addBond(POUNCE_BOND);
}

// Called from applyDamage: anything the Druid hits (not the wolves) carries their Scent
function druidOnHit(e, source) { if (source !== 'wolf') e.scentUntil = fxTime + SCENT_TIME; }

function addBond(n) {
    if (player.bond >= BOND_MAX) return;
    player.bond = Math.min(BOND_MAX, player.bond + n); player.bondIdle = 0;
    const w = mainWolf();
    if (player.bond >= BOND_MAX && w) effects.push({ type: 'text', text: 'BLOODLUST', x: w.x, y: w.y - 30, color: '#ffab40', life: 0.8, maxLife: 0.8 });
}

// ---------- Basic attack: a seed bolt from the totem ----------

BasicAttackRegistry['totem'] = (dmg) => {
    const [dx, dy, dist] = getVector(player.x, player.y, mouseX, mouseY);
    projectiles.push({ x: player.x, y: player.y, vx: (dx/dist)*600, vy: (dy/dist)*600, radius: 5, color: '#4caf50', life: 1.5, type: 'druid_spore', shape: 'circle', damage: dmg, pierce: false, hitList: [], isEnemy: false });
};

// ---------- Skills ----------

SkillRegistry['Druid'] = {
    1: (sk, dmg) => { // Bramble Snare: a thorn seed flies to the cursor (or the first enemy) and bursts into snaring brambles
        const [dx, dy, dist] = getVector(player.x, player.y, mouseX, mouseY);
        projectiles.push({ x: player.x, y: player.y, vx: (dx/dist)*700, vy: (dy/dist)*700, radius: 8, color: '#8bc34a', life: Math.max(0.05, Math.min(dist, 500) / 700), type: 'bramble_core', shape: 'circle', damage: dmg, pierce: false, hitList: [], isEnemy: false, sourceSkill: sk });
    },
    2: (sk) => { // Feral Surge: nature magic poured into the wolf; the Druid gets a bark shell
        const surge = calcUtility(SURGE_TIME, sk.level) + (hasTalent('dr_surge_long') ? 2 : 0); // ranks: longer (5 → 8 s) and a thicker shell; Long Surge
        buffs.feralSurge = surge; buffs.barkburstUsed = false;
        player.shield = (100 + sk.level * 20) * (hasTalent('dr_surge_bark') ? 1.5 : 1); player.shieldTimer = surge; // Thick Bark
        buffs.barkskin = true; // the bark shell (skillfx_e.js) and the Mantle of the Living Grove's roots; ends with the shield
        buffs.slowed = 0; buffs.rooted = 0;
        effects.push({ type: 'bark_form', x: player.x, y: player.y, life: 0.35, maxLife: 0.35 });
        const w = mainWolf();
        if (w) effects.push({ type: 'feral_surge', wolf: w, life: 0.6, maxLife: 0.6 });
        if (sk.selectedUpg === 'B') spawnSpiritWolves(hasTalent('dr_kin_twin') ? 2 : 1, hasTalent('dr_kin_long') ? 12 : KINDRED_TIME, w || player, SPIRIT_DMG * (hasTalent('dr_kin_fangs') ? 1.3 : 1)); // Kindred Howl: stays on after the surge (Twin Spirits, Spirit Fangs)
    },
    // Spirit Leap: you leap and land hard; the companion stays on its prey (it no longer leaves a nearly dead enemy to follow
    // you) and answers your landing with a rake where it stands
    3: (sk, dmg) => {
        const ang = Math.atan2(mouseY - player.y, mouseX - player.x);
        const reach = Math.max(LEAP_MIN, Math.min(LEAP_MAX + (hasTalent('dr_leap_far') ? 80 : 0), Math.hypot(mouseX - player.x, mouseY - player.y))); // Far Leap
        dustPuff(player.x, player.y, ang + Math.PI, 1.6, 4, '#6d5d4b');
        startDash({
            x: player.x + Math.cos(ang) * reach, y: player.y + Math.sin(ang) * reach,
            dur: 0.3, arc: 34, ease: 'out', kind: 'spirit_leap',
            ghost: { color: '#9ccc65', glow: false, every: 0.04, life: 0.25 },
            onArrive: () => {
                leapSlam(sk, dmg, ang);
                barkburst(dmg); // Barkburst: leaping during Feral Surge
                const w = mainWolf();
                if (w && !w.leap) wolfSlam(w, sk, dmg, w.target && !w.target.dead ? Math.atan2(w.target.y - w.y, w.target.x - w.x) : w.angle);
                if (w && !w.leap && sk.selectedUpg === 'A' && hasTalent('dr_alpha_tandem')) tandemLeap(w); // Tandem Leap
            }
        });
    },
    4: (sk, dmg) => { // Call of the Wild: the wolf howls (hit + stun around it), then the pack answers
        const w = mainWolf(); if (!w) return;
        w.howl = 0.6;
        const HR = HOWL_RADIUS * (hasTalent('dr_call_howl') ? 1.4 : 1); // Thunderous Howl
        effects.push({ type: 'wolf_howl', x: w.x, y: w.y, radius: HR, life: 0.8, maxLife: 0.8 });
        for (const e of enemies) {
            if (e.dead || e.pod || Math.hypot(e.x - w.x, e.y - w.y) > HR + e.size / 2) continue;
            applyDamage(e, dmg, 'magic');
            if (!e.dead) e.stunTimer = Math.max(e.stunTimer || 0, 1.0);
        }
        if (sk.selectedUpg === 'A') { // Dire Aspect: one huge beast instead of a pack
            buffs.direWolf = hasTalent('dr_dire_long') ? 11 : DIRE_TIME; drw.direBites = 0; // Elder Blood
            if (hasTalent('dr_dire_terror')) for (const e of enemies) { // Terror: the pack scatters before it
                if (e.dead || e.pod || e.prop || isBossE(e) || Math.hypot(e.x - w.x, e.y - w.y) > 250 + e.size / 2) continue;
                const a = Math.atan2(e.y - w.y, e.x - w.x); e.tauntTimer = 1.5; e.tauntX = e.x + Math.cos(a) * 400; e.tauntY = e.y + Math.sin(a) * 400;
            }
            effects.push({ type: 'text', text: companion().big.toUpperCase(), x: w.x, y: w.y - 40, color: '#ffab40', life: 1.0, maxLife: 1.0 });
            burst(w.x, w.y, 0, Math.PI * 2, 14, { kind: 'leaf', color: '#7cb342', size: 8, life: 0.8, speed: [120, 300], drag: 3 });
        } else spawnSpiritWolves(sk.selectedUpg === 'B' ? 4 : 2, sk.selectedUpg === 'B' && hasTalent('dr_hunt_long') ? 16 : SPIRIT_TIME, w, SPIRIT_DMG * calcUtility(1, sk.level)); // Wild Hunt: four (The Long Hunt: 16 s); ranks: harder bites
    },
    'rmb': () => { // Thistle-Grip Claws (Gnarled Heartwood Totem): a giant spirit paw rakes a wide cone and pins what it catches
        const angle = Math.atan2(mouseY - player.y, mouseX - player.x);
        const dmg = calcDmg(40), w = mainWolf();
        effects.push({ type: 'spirit_paw', x: player.x, y: player.y, angle: angle, life: 0.4, maxLife: 0.4 });
        let combo = false;
        for (const e of enemies) {
            if (e.dead || Math.hypot(player.x - e.x, player.y - e.y) > 180 + e.size/2) continue;
            let diff = Math.atan2(e.y - player.y, e.x - player.x) - angle;
            diff = Math.atan2(Math.sin(diff), Math.cos(diff));
            if (Math.abs(diff) > Math.PI/3) continue;
            const thorns = thornRake(e), pincer = isPincer(w, e); // read before the claws' own root lands
            applyDamage(e, dmg * (thorns ? THORN_RAKE_MULT : 1) * (pincer ? PINCER_MULT : 1), 'physical');
            if (thorns) { combo = true; tearThorns(e, dmg); }
            if (pincer) { combo = true; closePincer(w, e); }
            if (!e.dead && !isBossE(e)) e.rootedTimer = Math.max(e.rootedTimer || 0, 0.75);
        }
        if (combo) comboText();
    }
};

// Pincer: the companion's prey, with you on the far side of it from the beast (120°+ apart round the prey)
function isPincer(w, e) {
    if (!w || w.leap || w.target !== e || e.dead) return false;
    const a1 = Math.atan2(player.y - e.y, player.x - e.x), a2 = Math.atan2(w.y - e.y, w.x - e.x);
    return Math.abs(Math.atan2(Math.sin(a1 - a2), Math.cos(a1 - a2))) >= PINCER_ANGLE;
}
function closePincer(w, e) {
    if (!e.dead) e.rootedTimer = Math.max(e.rootedTimer || 0, PINCER_ROOT); // bosses too (they shake it off 3x as fast)
    player.freeMaul = true; // wolfBite: its next bite is a Maul that doesn't spend Bond
    effects.push({ type: 'pounce_rake', x: e.x, y: e.y, angle: Math.atan2(e.y - w.y, e.x - w.x), radius: e.size / 2 + 34, life: 0.45, maxLife: 0.45 }); // skillfx_space.js: the beast's side of the pincer
    effects.push({ type: 'text', text: 'PINCER!', x: e.x, y: e.y - e.size / 2 - 24, color: '#ffab40', life: 0.8, maxLife: 0.8 });
    addShake(3);
}
// Thorn Rake: an enemy Bramble Snare still roots (snareBurst stamps snaredAt)
function thornRake(e) { return e.rootedTimer > 0 && fxTime - (e.snaredAt ?? -99) <= SNARE_ROOT + 0.1; }
function tearThorns(e, dmg) {
    if (!e.dead) { e.bleedTimer = THORN_BLEED_TIME; e.bleedDmg = dmg * THORN_BLEED / THORN_BLEED_TIME; } // main.js bleeds it
    burst(e.x, e.y, 0, Math.PI * 2, 10, { kind: 'leaf', color: '#7cb342', size: 6, life: 0.5, speed: [140, 320], drag: 4 }); // the brambles torn out
    burst(e.x, e.y, 0, Math.PI * 2, 8, { kind: 'dot', color: '#c62828', size: 2.2, life: 0.4, speed: [80, 220], drag: 4 });
    effects.push({ type: 'snare_burst', x: e.x, y: e.y, radius: e.size / 2 + 30, life: 0.35, maxLife: 0.35 });
}
// Barkburst (Spirit Leap during Feral Surge, from the landing): once per Surge, the bark shell bursts into splinters
// around you (x1 the leap in 150 px) and regrows to its full strength
function barkburst(dmg) {
    if (!(buffs.feralSurge > 0) || buffs.barkburstUsed) return;
    buffs.barkburstUsed = true;
    const full = 100 + activeClass.skills[2].level * 20; // Feral Surge's shell
    player.shield = Math.max(player.shield || 0, full); player.shieldTimer = Math.max(player.shieldTimer || 0, buffs.feralSurge); buffs.barkskin = true;
    effects.push({ type: 'bark_form', x: player.x, y: player.y, life: 0.35, maxLife: 0.35 }); // skillfx_e.js: the shell grows back
    effects.push({ type: 'circle_burst', x: player.x, y: player.y, radius: BARKBURST_RADIUS, color: 'rgba(161, 136, 127, 0.6)', life: 0.35, maxLife: 0.35 });
    burst(player.x, player.y, 0, Math.PI * 2, 22, { kind: 'debris', color: '#795548', size: 5, life: 0.6, speed: [200, 480], drag: 4 }); // bark splinters
    burst(player.x, player.y, 0, Math.PI * 2, 10, { kind: 'leaf', color: '#8bc34a', size: 6, life: 0.6, speed: [120, 300], drag: 3 });
    for (const e of enemies) {
        if (e.dead || e.pod || Math.hypot(e.x - player.x, e.y - player.y) > BARKBURST_RADIUS + e.size / 2) continue;
        applyDamage(e, dmg * BARKBURST_MULT, 'physical');
    }
    comboText(); addShake(2.5); updateHUD();
}

// Bramble Snare's burst (main.js calls this where the seed lands or hits)
function snareBurst(x, y, dmg, sk) {
    const vines = sk && sk.selectedUpg === 'B', R = vines && hasTalent('dr_vines_reach') ? 220 : SNARE_RADIUS * (hasTalent('dr_snare_wide') ? 1.3 : 1); // talents: Wide Snare, Long Vines
    const root = vines && hasTalent('dr_vines_strangle') ? 2 : hasTalent('dr_snare_root') ? 1.5 : SNARE_ROOT; // Strangle, Deep Roots
    effects.push({ type: 'snare_burst', x, y, radius: R, life: 0.5, maxLife: 0.5 });
    if (sk && sk.selectedUpg === 'A') drw.thickets.push({ x, y, r: R, t: hasTalent('dr_ground_long') ? 6 : 4, killUsed: false }); // Hunting Ground (Old Growth)
    if (vines && hasTalent('dr_vines_bloom')) after(root, () => { // Bloom: the vines burst when the root ends
        effects.push({ type: 'snare_burst', x, y, radius: R, life: 0.5, maxLife: 0.5 });
        for (const e of enemies) if (!e.dead && Math.hypot(e.x - x, e.y - y) <= R + e.size / 2) { applyDamage(e, dmg, 'magic'); if (!e.dead) { e.slowTimer = Math.max(e.slowTimer || 0, 2); e.slowAmount = Math.max(e.slowAmount || 0, 0.5); } }
    });
    const caught = [];
    for (const e of enemies) {
        if (e.dead || Math.hypot(e.x - x, e.y - y) > R + e.size / 2) continue;
        applyDamage(e, dmg, 'magic');
        if (e.dead || e.pod) continue;
        if (sk && sk.selectedUpg === 'B' && !isBossE(e)) { // Grasping Vines: dragged in to the centre first
            const [dx, dy, d] = getVector(e.x, e.y, x, y), pull = Math.max(0, d - 20 - Math.random() * 20);
            if (pull > 0) {
                burst(e.x, e.y, Math.atan2(dy, dx), 0.5, 4, { kind: 'leaf', color: '#7cb342', size: 5, life: 0.4, speed: [120, 260], drag: 3 });
                effects.push({ type: 'lightning', x1: e.x, y1: e.y, x2: x, y2: y, color: '#7cb342', life: 0.25, maxLife: 0.25 }); // a vine snapping taut
                e.x += (dx / d) * pull; e.y += (dy / d) * pull; clampToBounds(e, e.size / 2);
                if (hasTalent('dr_vines_thorn')) { e.bleedTimer = 3; e.bleedDmg = Math.max(e.bleedDmg || 0, dmg * 0.3); } // Thorns
            }
        }
        e.rootedTimer = Math.max(e.rootedTimer || 0, root); e.snaredAt = fxTime; // bosses shake it off 3x as fast (combat.js BOSS_CC_RATE); Thorn Rake reads snaredAt
        if (!(e.slowTimer > 0) || (e.slowAmount || 0) < SNARE_SLOW) e.slowAmount = SNARE_SLOW; // then the thorns drag at them
        e.slowTimer = Math.max(e.slowTimer || 0, SNARE_SLOW_TIME);
        caught.push(e);
    }
    // The companion isn't sent: snared enemies are simply its favourite prey when it next picks one (pickWolfPrey)
}

// Spirit Leap landings: the Druid's slam, then the wolf's
function leapSlam(sk, dmg, ang) {
    effects.push({ type: 'spirit_slam', x: player.x, y: player.y, radius: LEAP_SLAM, life: 0.45, maxLife: 0.45 });
    for (const e of enemies) {
        if (e.dead || Math.hypot(e.x - player.x, e.y - player.y) > LEAP_SLAM + e.size / 2) continue;
        applyDamage(e, dmg, 'magic');
        if (sk.selectedUpg === 'A' && hasTalent('dr_alpha_shock') && !e.dead) e.stunTimer = Math.max(e.stunTimer || 0, 0.8); // Pounce Shock
        if (sk.selectedUpg === 'B' && !e.dead && !isBossE(e)) { // Scatter the Herd (Stampede: farther; Trampled: slowed)
            const a = Math.atan2(e.y - player.y, e.x - player.x), d = hasTalent('dr_scatter_far') ? 140 : 80;
            e.x += Math.cos(a) * d; e.y += Math.sin(a) * d; clampToBounds(e, e.size / 2);
            if (hasTalent('dr_scatter_trample')) { e.slowTimer = Math.max(e.slowTimer || 0, 2); e.slowAmount = Math.max(e.slowAmount || 0, 0.4); }
        }
    }
    if (sk.selectedUpg === 'A') drw.leapAt = fxTime; // Apex: a Maul soon after hits harder
    if (sk.selectedUpg === 'A' || hasItem('Pathfinder Wraps')) addBond((sk.selectedUpg === 'A' ? (hasTalent('dr_alpha_bond') ? 40 : 25) : 0) + (hasItem('Pathfinder Wraps') ? 15 : 0)); // Alpha Leap (Bonded) / Pathfinder Wraps
}

function wolfSlam(w, sk, dmg, ang) {
    effects.push({ type: 'pounce_rake', x: w.x, y: w.y, angle: ang, radius: WOLF_SLAM, life: 0.4, maxLife: 0.4 }); // skillfx_space.js
    for (const e of enemies) {
        if (e.dead || Math.hypot(e.x - w.x, e.y - w.y) > WOLF_SLAM + e.size / 2) continue;
        applyDamage(e, dmg, 'wolf', ang);
    }
    if (sk.selectedUpg === 'B') { wolfWhirl(w); if (hasTalent('dr_scatter_spirits')) player.wolves.slice(1).forEach(s => wolfWhirl(s, 0.6)); } // Spirit Scatter: the spirits whirl too
}
// Scatter the Herd: the companion whirls where it stands and snaps at everything close to it (Frenzied Whirl: 12 at x0.75)
function wolfWhirl(w, scale = 1) {
    {
        const fr = hasTalent('dr_scatter_whirl'), prey = enemies.filter(e => wolfCanHunt(e) && Math.hypot(e.x - w.x, e.y - w.y) <= 150 + e.size / 2).slice(0, fr ? 12 : 8);
        const bite = calcDmg(activeClass.basicDmg) * WOLF_BITE * (fr ? 0.75 : 0.5) * scale;
        prey.forEach((e, i) => after(0.08 + i * 0.07, () => {
            if (e.dead) return;
            const a = Math.atan2(e.y - w.y, e.x - w.x);
            applyDamage(e, bite, 'wolf', a);
            effects.push({ type: 'wolf_bite', x: e.x, y: e.y, angle: a, radius: Math.max(14, e.size * 0.6), life: 0.35, maxLife: 0.35 });
        }));
    }
}

function spawnSpiritWolves(n, time, from, dmgMult = SPIRIT_DMG) {
    if (hasItem('Elder Grove Seed')) time += 4; // items.js
    for (let i = 0; i < n; i++) {
        const a = Math.random() * Math.PI * 2, x = from.x + Math.cos(a) * 30, y = from.y + Math.sin(a) * 30;
        player.wolves.push(makeWolf(x, y, { spirit: true, life: time, maxLife: time, dmgMult, scale: 0.85, angle: a, biteCd: 0.2 + i * 0.1 }));
        burst(x, y, 0, Math.PI * 2, 8, { kind: 'leaf', color: '#9ccc65', size: 6, life: 0.7, speed: [40, 140], drag: 2.5 });
        burst(x, y, 0, Math.PI * 2, 5, { kind: 'smoke', color: '#b2ff59', size: 6, grow: 26, life: 0.5, speed: [20, 70], drag: 3 });
    }
}

// ---------- The wolves ----------

// A Crystal Slime's raised barrier (reflective) would hurt the Druid, so the wolves wait it out
function wolfCanHunt(e) {
    return !e.dead && !e.pod && !e.invulnerable && !e.reflective && !e.airborne && !(e.spawnT > 0) && !(e.flyUntil > fxTime) && e.state !== 'split';
}

// Snared prey first, then Scented prey, then whatever is closest to the wolf. For a spirit wolf, prey another wolf already
// has counts for less than fresh prey nearby, so the pack spreads around your wolf; a lone target (a boss) still gets them all.
function pickWolfPrey(w) {
    let best = null, bestScore = -Infinity;
    for (const e of enemies) {
        if (!wolfCanHunt(e) || Math.hypot(e.x - player.x, e.y - player.y) > WOLF_LEASH + e.size / 2) continue;
        let score = -Math.hypot(e.x - w.x, e.y - w.y);
        if (snared(e)) score += 450;
        if (scented(e)) score += 300;
        if (e === w.target) score += 80; // don't flip-flop between two equal choices
        if (w.spirit) for (const o of player.wolves) if (o !== w && o.target === e) score -= hasTalent('dr_hunt_encircle') ? 5000 : WOLF_CROWD; // your own wolf never gives way; Encircle: each its own prey
        if (currentMap.grid && !walkClear(w.x, w.y, e.x, e.y)) score -= 400; // stage.js: prey behind rock
        if (score > bestScore) { bestScore = score; best = e; }
    }
    return best;
}

// `pounce`: a spring onto prey (the jaguar stretches out for it); a plain bound back to heel isn't one
function wolfLeapTo(w, x, y, dur, arc, onArrive, pounce = false) {
    [x, y] = clampPointToMap(x, y, WOLF_RADIUS); // paladin.js
    w.leap = { x0: w.x, y0: w.y, x1: x, y1: y, t: 0, dur, arc, onArrive, pounce };
    w.angle = Math.atan2(y - w.y, x - w.x); w.airborne = true; w.biteAnim = 0;
}

function wolfBite(w, e) {
    const main = w === player.wolves[0], dire = main && buffs.direWolf > 0, surge = main && buffs.feralSurge > 0, th = main ? druidThicket(w) : null; // th: Hunting Ground
    if (th && hasTalent('dr_ground_kill') && !th.killUsed && snared(e)) { th.killUsed = true; player.freeMaul = true; } // Killing Field
    const direMaul = dire && hasTalent('dr_dire_apex') && (++drw.direBites % 3 === 0); // Apex Predator: every 3rd dire bite
    const bondMax = surge && druidUpg(2) === 'A' && hasTalent('dr_rage_rampage') ? 50 : BOND_MAX; // Rampage
    const freeMaul = main && player.freeMaul, maul = main && (player.bond >= bondMax || freeMaul || direMaul), wasScented = scented(e), wasSnared = snared(e); // freeMaul: a Pincer's
    const feed = th && hasTalent('dr_ground_bond') ? 1.5 : 1; // Blood Trail
    const k = companion().rhythm;
    let mult = WOLF_BITE * k * w.dmgMult;
    if (dire) mult *= DIRE_MULT;
    if (wasSnared) mult *= 1 + SNARE_BONUS;
    if (maul) mult *= (1 + (MAUL_MULT - 1) / k) * (fxTime - drw.leapAt < 3 && hasTalent('dr_alpha_apex') ? 1.5 : 1); // the same extra damage per Maul as the wolf's x4 (the jaguar's heavier bite: x3); Apex
    const dmg = calcDmg(activeClass.basicDmg) * mult;
    const ang = Math.atan2(e.y - w.y, e.x - w.x);
    w.angle = ang; w.biteAnim = WOLF_BITE_ANIM;
    w.biteCd = (surge ? SURGE_BITE_CD : WOLF_BITE_CD) * k / (1 + attackSpeedBonus()) / (th ? 1.5 : 1) / (main && hasTalent('dr_kin_leader') && player.wolves.length > 1 ? 1.25 : 1); // skills.js: gloves quicken the wolf too; Hunting Ground, Pack Leader

    applyDamage(e, dmg, 'wolf', ang);
    effects.push({ type: 'wolf_bite', x: e.x, y: e.y, angle: ang, radius: Math.max(14, e.size * 0.6) * (maul ? 1.6 : dire ? 1.3 : 1), life: 0.35, maxLife: 0.35 }); // fx.js
    if (surge || dire || th) { // big bites tear into whatever stands next to the prey (and in the Hunting Ground)
        for (const o of enemies) if (o !== e && wolfCanHunt(o) && Math.hypot(o.x - e.x, o.y - e.y) <= CLEAVE_RADIUS + o.size / 2) applyDamage(o, dmg * CLEAVE_MULT, 'wolf', ang);
    }
    if (maul) {
        if (freeMaul) player.freeMaul = false; else if (!direMaul) player.bond = 0; // a Pincer's Maul keeps your Bond (and an Apex Predator's)
        if (!e.dead) e.stunTimer = Math.max(e.stunTimer || 0, 1.0);
        effects.push({ type: 'wolf_maul', x: e.x, y: e.y, radius: e.size / 2 + 40, life: 0.45, maxLife: 0.45 });
        effects.push({ type: 'text', text: 'MAUL!', x: e.x, y: e.y - e.size / 2 - 14, color: '#ff7043', life: 0.8, maxLife: 0.8 });
        addShake(3.5);
        if (hasHeartwood()) { // the Heartwood Totem: the Maul tears into the pack around its prey
            for (const o of enemies) if (o !== e && wolfCanHunt(o) && Math.hypot(o.x - e.x, o.y - e.y) <= 100 + o.size / 2) applyDamage(o, dmg * 0.5, 'wolf', ang);
        }
    } else if (main && wasScented) addBond(BOND_PER_BITE * k * (dire ? 2 : 1) * feed);
    else if (main && dire) addBond(BOND_PER_BITE * k * feed); // the dire wolf bonds over anything it bites

    if (main && surge && druidUpg(2) === 'A') { // Bloodrage (Feeding Frenzy heals more, Barkblood regrows the shell with the overflow)
        const heal = player.maxHp * (hasTalent('dr_rage_more') ? 0.025 : 0.015) * k, over = player.hp + heal - player.maxHp;
        player.hp = Math.min(player.maxHp, player.hp + heal);
        if (over > 0 && hasTalent('dr_rage_bark')) addShield(over, Math.max(1, buffs.feralSurge));
    }
    if (dire && hasTalent('dr_dire_feast')) player.hp = Math.min(player.maxHp, player.hp + player.maxHp * 0.01); // Blood Feast
    if (w.spirit) { // Pack Bond, Encircle
        if (hasTalent('dr_hunt_bond') && wasScented) addBond(BOND_PER_BITE * 0.5);
        if (hasTalent('dr_hunt_encircle') && !e.dead) { e.slowTimer = Math.max(e.slowTimer || 0, 1); e.slowAmount = Math.max(e.slowAmount || 0, 0.3); }
    }
}

function updateWolfLeap(w, dt) {
    const L = w.leap;
    L.t += dt;
    const q = Math.min(1, L.t / L.dur), k = easeOut(q);
    w.x = lerp(L.x0, L.x1, k); w.y = lerp(L.y0, L.y1, k); w.z = L.arc * Math.sin(q * Math.PI);
    if (q >= 1) {
        w.leap = null; w.z = 0; w.airborne = false;
        clampToBounds(w, WOLF_RADIUS);
        dustPuff(w.x, w.y, w.angle, 2.4, 4, '#6d5d4b');
        if (L.onArrive) L.onArrive();
    }
}

// Where an idle wolf waits: behind the Druid, each wolf on its own spot of a half circle
function heelPoint(i) {
    const aim = Math.atan2(mouseY - player.y, mouseX - player.x);
    const a = aim + Math.PI + (i === 0 ? -0.9 : (i % 2 ? 1 : -1) * (0.5 + Math.ceil(i / 2) * 0.45));
    return [player.x + Math.cos(a) * 46, player.y + Math.sin(a) * 46];
}

function updateWolf(w, i, dt) {
    if (w.biteCd > 0) w.biteCd -= dt;
    if (w.biteAnim > 0) w.biteAnim -= dt;
    if (w.pounceCd > 0) w.pounceCd -= dt;
    if (w.howl > 0) w.howl -= dt;
    const px = w.x, py = w.y;
    const main = i === 0;
    w.scale += ((main ? (buffs.direWolf > 0 ? 1.7 : buffs.feralSurge > 0 ? 1.3 : 1) : 0.85) - w.scale) * Math.min(1, dt * 6);

    if (w.leap) updateWolfLeap(w, dt);
    else if (Math.hypot(player.x - w.x, player.y - w.y) > WOLF_RECALL || w.stuck > 1.0) {
        // Left far behind or stuck behind rock: it bounds back to the Druid's side
        const [hx, hy] = heelPoint(i);
        w.target = null; w.stuck = 0;
        wolfLeapTo(w, hx, hy, 0.4, 50);
    } else {
        w.retarget -= dt;
        if (!w.target || !wolfCanHunt(w.target) || w.retarget <= 0) { w.target = pickWolfPrey(w); w.retarget = 0.25; }
        const e = w.target;
        let gx, gy, stop, speed = WOLF_SPEED * (main && (buffs.feralSurge > 0 || buffs.direWolf > 0) ? 1.3 : 1);
        if (e) { gx = e.x; gy = e.y; stop = e.size / 2 + WOLF_REACH * w.scale * 0.8; }
        else { [gx, gy] = heelPoint(i); stop = 6; speed *= Math.min(1, Math.hypot(gx - w.x, gy - w.y) / 120 + 0.25); } // trots in, then settles
        const [dx, dy, d] = getVector(w.x, w.y, gx, gy);
        const P = companion().pounce;
        if (P && e && w.howl <= 0 && !(w.pounceCd > 0) && w.biteCd < 0.35 && d > stop + P.min && d < stop + P.max && (!currentMap.grid || walkClear(w.x, w.y, e.x, e.y))) {
            // The jaguar doesn't run its prey down: it springs onto it and bites as it lands
            const a = Math.atan2(dy, dx);
            w.pounceCd = P.cd;
            wolfLeapTo(w, e.x - Math.cos(a) * stop, e.y - Math.sin(a) * stop, 0.3, 30, () => { w.biteCd = 0; }, true);
        } else if (w.howl <= 0 && d > stop) {
            const step = Math.min(d - stop, speed * dt);
            w.x += dx / d * step; w.y += dy / d * step;
            const want = Math.atan2(dy, dx);
            w.angle += Math.atan2(Math.sin(want - w.angle), Math.cos(want - w.angle)) * Math.min(1, dt * 12);
            clampToBounds(w, WOLF_RADIUS);
            // stuck = out of reach and not getting anywhere (at its prey, an obstacle nudging it back a hair doesn't count)
            if (d > stop + 6 && Math.hypot(w.x - px, w.y - py) < step * 0.25) w.stuck += dt; else w.stuck = Math.max(0, w.stuck - dt);
        } else if (e) w.angle = Math.atan2(dy, dx);
        if (e && d <= stop + 4 && w.biteCd <= 0 && w.howl <= 0) wolfBite(w, e);
    }

    // Animation: smoothed velocity drives the gait and the tail
    if (dt > 0) { const k = Math.min(1, dt * 10); w.vx += ((w.x - px) / dt - w.vx) * k; w.vy += ((w.y - py) / dt - w.vy) * k; }
    w.walk += Math.hypot(w.x - px, w.y - py) * 0.06;
    w.move = Math.min(1, Math.hypot(w.vx, w.vy) / 150);
    if (w.life !== Infinity) w.life -= dt;
}

// Called from update() in main.js
function updateDruid(dt) {
    if (!isDruid() || !player.wolves) return;
    if (buffs.feralSurge > 0) buffs.feralSurge -= dt;
    if (buffs.direWolf > 0) buffs.direWolf -= dt;
    if (buffs.barkskin && player.shield <= 0) buffs.barkskin = false; // Feral Surge's bark shell broke or ran out
    player.bondIdle += dt;
    if (player.bond < BOND_MAX && player.bondIdle > BOND_DECAY_AFTER) player.bond = Math.max(0, player.bond - BOND_DECAY * dt);

    for (let i = drw.thickets.length - 1; i >= 0; i--) { const t = drw.thickets[i]; if ((t.t -= dt) <= 0) drw.thickets.splice(i, 1); else if (hasTalent('dr_ground_den') && Math.hypot(player.x - t.x, player.y - t.y) <= t.r) player.hp = Math.min(player.maxHp, player.hp + player.maxHp * 0.02 * dt); } // Hunting Ground; Verdant Den
    for (let i = 0; i < player.wolves.length; i++) updateWolf(player.wolves[i], i, dt);
    separateWolves();
    for (let i = player.wolves.length - 1; i > 0; i--) {
        const w = player.wolves[i];
        if (w.life > 0) continue;
        if (hasTalent('dr_hunt_stampede') && druidUpg(4) === 'B') spiritStampede(w); // Spirit Stampede: it charges through on its way out
        burst(w.x, w.y, 0, Math.PI * 2, 10, { kind: 'leaf', color: '#9ccc65', size: 6, life: 0.8, speed: [30, 110], drag: 2 }); // the spirit scatters into leaves
        player.wolves.splice(i, 1);
    }
    // A surging wolf sheds glowing motes
    const w = player.wolves[0];
    if (buffs.feralSurge > 0 || buffs.direWolf > 0) emit(18, dt, () => spawnParticle({ kind: 'dot', color: buffs.direWolf > 0 ? '#ffab40' : '#b2ff59', x: w.x + jitter(26 * w.scale), y: w.y + jitter(26 * w.scale), vx: jitter(20), vy: -40 - Math.random() * 30, size: 1.8, life: 0.6, drag: 0.5, grow: 0, spin: 0, rot: 0 }));
}

// Wolves don't pile into one spot: overlapping pairs push apart (your wolf gives way less than a spirit), and leaping ones pass over
function separateWolves() {
    const ws = player.wolves;
    for (let i = 0; i < ws.length; i++) for (let j = i + 1; j < ws.length; j++) {
        const a = ws[i], b = ws[j];
        if (a.leap || b.leap) continue;
        const min = WOLF_SPACING * (a.scale + b.scale);
        let dx = b.x - a.x, dy = b.y - a.y, d = Math.hypot(dx, dy);
        if (d >= min) continue;
        if (d < 0.01) { dx = Math.cos(i * 2.4 + j); dy = Math.sin(i * 2.4 + j); d = 1; } // exactly on top of each other: split any way
        const push = min - d, ka = i === 0 ? 0.25 : 0.5;
        a.x -= dx / d * push * ka; a.y -= dy / d * push * ka;
        b.x += dx / d * push * (1 - ka); b.y += dy / d * push * (1 - ka);
    }
    for (const w of ws) if (!w.leap) clampToBounds(w, WOLF_RADIUS);
}

// ---------- Visuals ----------

// The wolf sprite (sprites.js sprWolf) stamped at any size; spirit wolves are a pale green ghost with a soft glow
function stampWolf(x, y, facing, pose, scale, spirit, alpha) {
    const c = spriteCtx, half = SPRITE_SIZE / 2;
    c.setTransform(1, 0, 0, 1, 0, 0); c.clearRect(0, 0, SPRITE_SIZE, SPRITE_SIZE);
    c.translate(half, half); c.rotate(facing); c.scale(scale, scale);
    drawCharacter(c, 'druid', pose);
    if (spirit) {
        c.setTransform(1, 0, 0, 1, 0, 0);
        c.globalCompositeOperation = 'source-atop'; c.globalAlpha = 0.7;
        c.fillStyle = '#c5e1a5'; c.fillRect(0, 0, SPRITE_SIZE, SPRITE_SIZE);
        c.globalCompositeOperation = 'source-over'; c.globalAlpha = 1;
    } else sprFinish(c, half, half, 30 * scale, 0);
    ctx.save();
    ctx.globalAlpha = alpha * (spirit ? 0.5 : 1);
    ctx.drawImage(spriteCanvas, x - half, y - half);
    if (spirit) { ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = alpha * 0.22; ctx.drawImage(spriteCanvas, x - half, y - half); }
    ctx.restore();
}

function drawWolf(w, i, fade) {
    const cos = Math.cos(w.angle), sin = Math.sin(w.angle);
    let tx = -(w.vx * cos + w.vy * sin) * 0.03, ty = -(-w.vx * sin + w.vy * cos) * 0.03;
    const m = Math.hypot(tx, ty); if (m > 12) { tx *= 12 / m; ty *= 12 / m; }
    const q = w.biteAnim > 0 ? 1 - w.biteAnim / WOLF_BITE_ANIM : null;
    const bite = w.leap ? 0.01 + 0.11 * Math.min(1, w.leap.t / w.leap.dur) : q; // mid-leap the jaws hang open
    const jag = companion().sprite === 'jaguar';
    const pose = { t: fxTime + w.seed, walk: w.walk, move: w.move, trail: { x: tx, y: ty }, live: false, wolf: !jag, jaguar: jag, color: '#5d4037', swipe: null, bite,
        pounce: w.leap && w.leap.pounce ? Math.min(1, w.leap.t / w.leap.dur) : null };
    const lunge = q !== null ? Math.sin(q * Math.PI) * 10 * w.scale : 0;
    let life = w.spirit ? Math.min(1, w.life / 0.5, (w.maxLife - w.life) / 0.3) : 1;
    if (w.spirit && w.life < 2) life *= 0.65 + 0.35 * Math.cos(fxTime * (10 + (2 - w.life) * 6)); // flickers faster as it fades
    const alpha = fade * life;

    // Shadow: shrinks and fades while the wolf is in the air
    const zs = 1 - Math.min(0.45, w.z / 160);
    ctx.save();
    ctx.fillStyle = `rgba(0, 0, 0, ${(w.spirit ? 0.18 : 0.35) * alpha * (1 - Math.min(0.5, w.z / 200))})`;
    ctx.beginPath(); ctx.ellipse(w.x + 3, w.y + 6, 30 * w.scale * zs, 15 * w.scale * zs, w.angle, 0, Math.PI * 2); ctx.fill();
    // Your wolf's aura: green while surging, a hot amber pulse when Bond is full and the next bite is a Maul
    if (i === 0) {
        const full = player.bond >= BOND_MAX, glow = full ? '#ff6d00' : buffs.direWolf > 0 ? '#ffab40' : buffs.feralSurge > 0 ? '#76ff03' : null;
        if (glow) {
            const R = 34 * w.scale, p = full ? 0.5 + 0.5 * Math.sin(fxTime * 8) : 0.6;
            ctx.globalCompositeOperation = 'lighter';
            const g = ctx.createRadialGradient(w.x, w.y, R * 0.2, w.x, w.y, R);
            g.addColorStop(0, withAlpha(glow, 0.32 * p * alpha)); g.addColorStop(1, withAlpha(glow, 0));
            ctx.fillStyle = g; ctx.beginPath(); ctx.arc(w.x, w.y, R, 0, Math.PI * 2); ctx.fill();
        }
    }
    ctx.restore();

    const s = w.scale * (1 + w.z / 300);
    if (w.spirit && w.z < 4) { // how long it stays: a ring on the ground that drains clockwise, amber in the last 2 s
        const R = 26 * w.scale, f = Math.max(0, w.life / w.maxLife), low = w.life < 2, a0 = -Math.PI / 2;
        ctx.save();
        ctx.lineWidth = 2.5; ctx.lineCap = 'round';
        ctx.strokeStyle = `rgba(0, 0, 0, ${0.35 * fade})`; ctx.beginPath(); ctx.arc(w.x, w.y + 4, R, 0, Math.PI * 2); ctx.stroke();
        ctx.strokeStyle = low ? `rgba(255, 183, 77, ${0.9 * fade})` : `rgba(178, 255, 89, ${0.75 * fade})`;
        ctx.beginPath(); ctx.arc(w.x, w.y + 4, R, a0, a0 + Math.PI * 2 * f); ctx.stroke();
        ctx.restore();
    }
    if (w.spirit) { // a soft green glow under the ghost
        ctx.save(); ctx.globalCompositeOperation = 'lighter';
        const g = ctx.createRadialGradient(w.x, w.y - w.z, 4, w.x, w.y - w.z, 32 * w.scale);
        g.addColorStop(0, `rgba(178, 255, 89, ${0.25 * alpha})`); g.addColorStop(1, 'rgba(178, 255, 89, 0)');
        ctx.fillStyle = g; ctx.beginPath(); ctx.arc(w.x, w.y - w.z, 32 * w.scale, 0, Math.PI * 2); ctx.fill(); ctx.restore();
    }
    stampWolf(w.x + cos * lunge, w.y - w.z + sin * lunge, w.angle, pose, s, w.spirit, alpha);
}

// Under the enemies: Scent on your prey, the snare's brambles, the leap slam
function drawDruidGround() {
    if (isDruid()) for (const t of drw.thickets) { // the Hunting Ground: a ring of thorn and a dark green floor
        ctx.save(); ctx.globalAlpha = Math.min(1, t.t / 0.5) * 0.5; ctx.fillStyle = 'rgba(51, 105, 30, 0.35)'; ctx.beginPath(); ctx.arc(t.x, t.y, t.r, 0, Math.PI * 2); ctx.fill();
        ctx.strokeStyle = '#7cb342'; ctx.lineWidth = 3; ctx.setLineDash([4, 9]); ctx.stroke(); ctx.restore();
    }
    if (!isDruid()) return;
    ctx.save();
    ctx.lineWidth = 1.5; ctx.setLineDash([4, 6]);
    for (const e of enemies) { // a faint green ring of scent around everything you've hit
        if (e.dead || !scented(e)) continue;
        const k = Math.min(1, (e.scentUntil - fxTime) / 0.6);
        ctx.strokeStyle = `rgba(178, 255, 89, ${0.45 * k})`;
        ctx.lineDashOffset = -fxTime * 20;
        ctx.beginPath(); ctx.arc(e.x, e.y, e.size / 2 + 7, 0, Math.PI * 2); ctx.stroke();
    }
    ctx.restore();

    for (const ef of effects) {
        const k = clamp01(ef.life / ef.maxLife), p = 1 - k;
        if (ef.type === 'snare_burst') { // thorny vines spike out of the ground and snap tight
            if (!ef.burstDone) {
                ef.burstDone = true;
                ef.spikes = Array.from({ length: 11 }, (_, i) => ({ a: i * Math.PI * 2 / 11 + jitter(0.4), r: 0.55 + Math.random() * 0.45 }));
                burst(ef.x, ef.y, 0, Math.PI * 2, 10, { kind: 'leaf', color: '#7cb342', size: 6, life: 0.6, speed: [80, 220], drag: 3 });
                burst(ef.x, ef.y, 0, Math.PI * 2, 6, { kind: 'debris', color: '#5d4037', size: 2.5, life: 0.4, speed: [60, 180], drag: 4 });
            }
            const grow = easeOut(Math.min(1, p * 4));
            ctx.save();
            ctx.translate(ef.x, ef.y);
            ctx.globalAlpha = k;
            for (const s of ef.spikes) {
                const L = ef.radius * s.r * grow, b = 5;
                const nx = Math.cos(s.a), ny = Math.sin(s.a), ox = -ny * b, oy = nx * b;
                ctx.fillStyle = '#4e342e';
                ctx.beginPath(); ctx.moveTo(ox, oy); ctx.quadraticCurveTo(nx * L * 0.5 + ox * 0.4, ny * L * 0.5 + oy * 0.4 + 3, nx * L, ny * L); ctx.lineTo(-ox, -oy); ctx.closePath(); ctx.fill();
                ctx.fillStyle = '#7cb342';
                ctx.beginPath(); ctx.arc(nx * L * 0.55, ny * L * 0.55, 2.5, 0, Math.PI * 2); ctx.fill();
            }
            ctx.strokeStyle = `rgba(178, 255, 89, ${0.7 * k})`; ctx.lineWidth = 3 * k + 1;
            ctx.beginPath(); ctx.arc(0, 0, ef.radius * easeOut(Math.min(1, p * 2.5)), 0, Math.PI * 2); ctx.stroke();
            ctx.restore();
        } else if (ef.type === 'spirit_slam') { // a ring of leaves and dust where the Druid lands
            if (!ef.burstDone) {
                ef.burstDone = true;
                dustPuff(ef.x, ef.y, 0, Math.PI * 2, 8, '#6d5d4b');
                burst(ef.x, ef.y, 0, Math.PI * 2, 14, { kind: 'leaf', color: '#8bc34a', size: 7, life: 0.7, speed: [140, 320], drag: 3 });
                addShake(2.5);
            }
            ctx.save();
            ctx.globalCompositeOperation = 'lighter';
            const R = ef.radius * easeOut(p);
            const g = ctx.createRadialGradient(ef.x, ef.y, R * 0.3, ef.x, ef.y, R);
            g.addColorStop(0, 'rgba(178, 255, 89, 0)'); g.addColorStop(1, `rgba(178, 255, 89, ${0.3 * k})`);
            ctx.fillStyle = g; ctx.beginPath(); ctx.arc(ef.x, ef.y, R, 0, Math.PI * 2); ctx.fill();
            ctx.strokeStyle = `rgba(204, 255, 144, ${0.8 * k})`; ctx.lineWidth = 4 * k + 1;
            ctx.beginPath(); ctx.arc(ef.x, ef.y, R, 0, Math.PI * 2); ctx.stroke();
            ctx.restore();
        }
    }
}

// Above the enemies, under the hero: the wolves, the howl and the Maul
function drawDruidWorld() {
    if (!isDruid() || !player.wolves) return;
    const fade = 1 - Math.min(1, player.fadeOut || 0); // stage exit: the pack walks into the dark with the hero
    for (let i = player.wolves.length - 1; i >= 0; i--) drawWolf(player.wolves[i], i, fade);

    for (const ef of effects) {
        const k = clamp01(ef.life / ef.maxLife), p = 1 - k;
        if (ef.type === 'wolf_howl') { // broken sound rings rolling out from the wolf
            if (!ef.burstDone) {
                ef.burstDone = true;
                burst(ef.x, ef.y, 0, Math.PI * 2, 16, { kind: 'leaf', color: '#7cb342', size: 7, life: 0.8, speed: [150, 340], drag: 3 });
                addShake(3);
            }
            ctx.save();
            ctx.globalCompositeOperation = 'lighter';
            ctx.translate(ef.x, ef.y);
            for (let j = 0; j < 3; j++) {
                const qj = clamp01(p * 1.3 - j * 0.15);
                if (qj <= 0 || qj >= 1) continue;
                const R = 30 + (ef.radius - 30) * easeOut(qj);
                ctx.strokeStyle = `rgba(204, 255, 144, ${0.8 * (1 - qj)})`; ctx.lineWidth = 4 * (1 - qj) + 1;
                for (let s = 0; s < 6; s++) { const a0 = s * Math.PI / 3 + j * 0.5; ctx.beginPath(); ctx.arc(0, 0, R, a0, a0 + 0.75); ctx.stroke(); }
            }
            ctx.restore();
        } else if (ef.type === 'feral_surge') { // green light floods into the wolf
            const w = ef.wolf;
            if (!ef.burstDone) {
                ef.burstDone = true;
                burst(w.x, w.y, 0, Math.PI * 2, 12, { kind: 'leaf', color: '#9ccc65', size: 6, life: 0.6, speed: [60, 180], drag: 3 });
            }
            ctx.save();
            ctx.globalCompositeOperation = 'lighter';
            const R = 70 * (1 - easeOut(p)) + 20;
            ctx.strokeStyle = `rgba(178, 255, 89, ${0.8 * k})`; ctx.lineWidth = 3;
            ctx.beginPath(); ctx.arc(w.x, w.y - w.z, R, 0, Math.PI * 2); ctx.stroke();
            ctx.restore();
        } else if (ef.type === 'wolf_maul') { // a hot flash and a ring where the Maul lands
            ctx.save();
            ctx.globalCompositeOperation = 'lighter';
            const R = ef.radius * easeOut(p);
            const g = ctx.createRadialGradient(ef.x, ef.y, 0, ef.x, ef.y, ef.radius);
            g.addColorStop(0, `rgba(255, 171, 64, ${0.5 * k})`); g.addColorStop(1, 'rgba(255, 87, 34, 0)');
            ctx.fillStyle = g; ctx.beginPath(); ctx.arc(ef.x, ef.y, ef.radius, 0, Math.PI * 2); ctx.fill();
            ctx.strokeStyle = `rgba(255, 204, 128, ${k})`; ctx.lineWidth = 4 * k + 1;
            ctx.beginPath(); ctx.arc(ef.x, ef.y, R, 0, Math.PI * 2); ctx.stroke();
            ctx.restore();
        }
    }
}

// ---------- Companion choice (after picking the Druid on the class carousel; main.js chooseClass) ----------

let companionOpenedAt = 0, companionPreviewOn = false;
function showCompanionChoice() {
    el('class-selection').classList.add('hidden');
    const box = el('companion-cards'); box.innerHTML = '';
    let last = null; try { last = localStorage.getItem('lastCompanion'); } catch (e) {}
    Object.entries(COMPANIONS).forEach(([id, C], i) => {
        const card = document.createElement('div');
        card.className = 'skill-card companion-card' + (id === last ? ' last' : ''); card.style.setProperty('--cc', C.color); card.dataset.pick = id;
        card.innerHTML = `<kbd class="sc-key">${i + 1}</kbd><canvas class="cc-preview" width="440" height="300"></canvas><div class="sc-name">${C.name}</div><div class="cc-tag">${C.tag}</div><div class="cc-desc">${C.desc}</div>`;
        card.onclick = () => pickCompanion(id);
        box.appendChild(card);
    });
    el('companion-screen').classList.remove('hidden');
    companionOpenedAt = performance.now();
    if (!companionPreviewOn) { companionPreviewOn = true; requestAnimationFrame(drawCompanionPreviews); }
}
function pickCompanion(id) {
    player.companion = id;
    try { localStorage.setItem('lastCompanion', id); } catch (e) {}
    el('companion-screen').classList.add('hidden');
    startGame('druid');
}
function closeCompanionChoice() { el('companion-screen').classList.add('hidden'); showClassSelection(); }

// Each card shows its beast prowling in place; every few seconds it strikes (the jaguar pounces first, then bites)
function drawCompanionPreviews(now) {
    if (el('companion-screen').classList.contains('hidden')) { companionPreviewOn = false; return; }
    const t = now / 1000;
    for (const cv of document.querySelectorAll('#companion-cards .cc-preview')) {
        const jag = COMPANIONS[cv.parentElement.dataset.pick].sprite === 'jaguar', c = cv.getContext('2d');
        const cyc = (t + (jag ? 1.3 : 0)) % 2.6, b0 = jag ? 0.45 : 0;
        const pounce = jag && cyc < b0 ? cyc / b0 : null, bite = cyc >= b0 && cyc < b0 + 0.28 ? (cyc - b0) / 0.28 : null;
        const pose = { t, walk: t * 5, move: pounce === null && bite === null ? 0.55 : 0, trail: { x: 0, y: Math.sin(t * 1.3) * 3 }, live: false, wolf: !jag, jaguar: jag, swipe: null, bite, pounce };
        const lift = pounce !== null ? Math.sin(pounce * Math.PI) * 18 : 0, ls = 1 - lift / 70;
        c.setTransform(1, 0, 0, 1, 0, 0); c.clearRect(0, 0, cv.width, cv.height);
        c.translate(cv.width / 2 - 8, cv.height / 2 + 8);
        c.fillStyle = 'rgba(0, 0, 0, 0.4)'; c.beginPath(); c.ellipse(8, 18, 100 * ls, 44 * ls, 0, 0, Math.PI * 2); c.fill();
        c.translate(jag ? 48 : 10, -lift); c.scale(3.5 * (1 + lift / 300), 3.5 * (1 + lift / 300));
        drawCharacter(c, 'druid', pose); // sprites.js
    }
    requestAnimationFrame(drawCompanionPreviews);
}

window.addEventListener('keydown', e => {
    if (el('companion-screen').classList.contains('hidden') || performance.now() - companionOpenedAt < 300) return;
    const k = e.key.toLowerCase(), ids = Object.keys(COMPANIONS);
    if (k === '1' || k === '2') pickCompanion(ids[+k - 1]);
    else if (k === 'escape' || k === 'backspace') closeCompanionChoice();
    else return;
    e.stopImmediatePropagation(); // menu.js listens too: the same Esc would go on back to the dungeon map
});
