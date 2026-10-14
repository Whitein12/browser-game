// ==========================================
// spellweaver.js - The Spellweaver's spellbook: the wizard who knows the most spells (SPELLWEAVER.md)
// ==========================================
// The player builds the class: four spells from the book (SPELLS) on any key, at most one Greater spell (Lv. 5).
// player.spells[slot] is the spell on that key; applyLoadout() writes each one into activeClass.skills[slot] (name,
// maxCd, baseDmg, spell), so the web (skilltree.js treeSkill) ranks whatever sits on a key and the rest of the game
// reads a skill as before. SkillRegistry.Spellweaver hands each key to its spell's cast. Every spell stores a
// Resonance charge (skills.js). Spells that move you open the Space finisher window (Blink Lance) from any key.
// Schools are playstyles: Evocation (the demolitioner), Glyphcraft (the zoner), Translocation (the zapper),
// Abjuration (control and wards). The evolutions and school talents are in spellweaver_evo.js.
// Logic lives in `sw` (runes, zones, the anchor, Time Stop...), ticked by updateSpellweaver and drawn by
// drawSpellweaverGround (under enemies) and drawSpellweaverWorld (over the hero).

const SCHOOLS = {
    evocation: { name: 'Evocation', color: '#ff8a50', tag: 'The demolitioner: raw damage' },
    glyph: { name: 'Glyphcraft', color: '#ffd54f', tag: 'The zoner: runes on the ground' },
    trans: { name: 'Translocation', color: '#80d8ff', tag: 'The zapper: every spell moves you' },
    abjur: { name: 'Abjuration', color: '#b388ff', tag: 'Control and wards' },
};
const DEFAULT_SPELLS = { 1: 'fireball', 2: 'frost_nova', 3: 'blink', 4: 'meteor' };

const RUNE_ARM = 0.5, RUNE_LIFE = 20, RUNE_RANGE = 520, RUNE_TRIGGER = 26, RUNE_BLAST = 90, RUNE_CAP = { blast: 3, bind: 2 };
const MISSILES = 3, MISSILE_SPEED = 560, CHAIN_JUMPS = 4, CHAIN_JUMP_R = 230, CHAIN_FALLOFF = 0.85;
const CANNON_CHARGE = 1.2, STORM_R = 110, STORM_TIME = 4, STORM_TICK = 0.5, RUNESTORM_RUNES = 8, RUNESTORM_R = 220;
const FLICKER_CHARGES = 3, ANCHOR_TIME = 5, TIMESTOP_BONUS = 1.25, MIRROR_R = 62;
const WARD_TIME = 4, WARD_BURST_R = 150, WELL_R = 160, WELL_TIME = 3, WELL_PULL = 130, BLIZZ_R = 210, BLIZZ_TIME = 5, BLIZZ_FREEZE = 2;

// stats(r, sk): what the skill web's tooltips show per rank (ui.js RANK_STATS); RH / RU / RS / RP are ui.js helpers
const SPELLS = {
    // ---- Evocation ----
    fireball: { name: 'Fireball', school: 'evocation', cd: 2, dmg: 25, desc: 'A fast bolt that explodes on the first enemy it hits.',
        stats: (r, sk) => [['Explosion', RH(sk.baseDmg, r)]] },
    magic_missile: { name: 'Magic Missile', school: 'evocation', cd: 1.6, dmg: 9, desc: 'Three homing darts that seek the enemies nearest your cursor. Never misses, and cheap: a steady Resonance engine.',
        stats: (r, sk) => [['Per dart', RH(sk.baseDmg, r)], ['Darts', MISSILES]] },
    chain_lightning: { name: 'Chain Lightning', school: 'evocation', cd: 3.5, dmg: 30, desc: 'A bolt at the enemy nearest your cursor that jumps to 4 more, 15% weaker each jump. Shocked enemies move at half speed for 1 s.',
        stats: (r, sk) => [['First hit', RH(sk.baseDmg, r)], ['Targets', 1 + CHAIN_JUMPS]] },
    arcane_cannon: { name: 'Arcane Cannon', school: 'evocation', cd: 6, dmg: 70, scroll: true, desc: 'Hold to charge (you can\'t move), release a huge piercing orb. A full charge (1.2 s) hits everything on the line for full damage; a tap for 30%.',
        stats: (r, sk) => [['Full charge', RH(sk.baseDmg, r)]] },
    meteor: { name: 'Meteor', school: 'evocation', greater: true, cd: 10, dmg: 120, desc: 'A meteor crashes onto the marked spot after 1 s, hitting everything within 150 px.',
        stats: (r, sk) => [['Impact', RH(sk.baseDmg, r)]] },
    // ---- Glyphcraft ----
    explosive_rune: { name: 'Explosive Rune', school: 'glyph', cd: 2.5, dmg: 35, desc: 'Inscribe a rune at the cursor. It arms in 0.5 s and blows up when an enemy steps on it. Up to 3 at once; runes last 20 s.',
        stats: (r, sk) => [['Blast', RH(sk.baseDmg, r)]] },
    rune_of_binding: { name: 'Rune of Binding', school: 'glyph', cd: 4, dmg: 15, desc: 'A rune that roots everything near it when an enemy steps on it. Up to 2 at once.',
        stats: (r, sk) => [['Hit', RH(sk.baseDmg, r)], ['Root', RS(RU(1.2, r))]] },
    storm_glyph: { name: 'Storm Glyph', school: 'glyph', cd: 6, dmg: 10, desc: 'A circle at the cursor that zaps everything inside it every 0.5 s for 4 s.',
        stats: (r, sk) => [['Per zap', RH(sk.baseDmg, r)]] },
    runic_detonation: { name: 'Runic Detonation', school: 'glyph', cd: 5, dmg: 35, scroll: true, desc: 'Every rune you have out goes off at once, stronger, and Storm Glyphs discharge. With nothing out, it lays an Explosive Rune at your feet.',
        stats: (r, sk) => [['Rune power', `x${detonateMult(r).toFixed(2)}`], ['Rune laid', RH(sk.baseDmg, r)]] },
    runestorm: { name: 'Runestorm', school: 'glyph', greater: true, scroll: true, cd: 12, dmg: 45, desc: 'Scatter 8 Explosive Runes across the cursor area at once: a minefield. They don\'t count toward your rune limit and last 12 s.',
        stats: (r, sk) => [['Per rune', RH(sk.baseDmg, r)]] },
    // ---- Translocation ----
    blink: { name: 'Blink', school: 'trans', move: true, cd: 4, dmg: 0, desc: 'Teleport toward the cursor.',
        stats: r => [['Range', RP(blinkReach(r))]] },
    flicker: { name: 'Flicker', school: 'trans', move: true, cd: 3, dmg: 0, desc: 'A short blink with 3 charges. Each charge comes back on its own (the cooldown).',
        stats: r => [['Range', RP(flickerReach(r))], ['Charges', FLICKER_CHARGES]] },
    ride_lightning: { name: 'Ride the Lightning', school: 'trans', move: true, cd: 5, dmg: 30, desc: 'Become a bolt and streak toward the cursor, striking and shocking everything you pass through.',
        stats: (r, sk) => [['Hit', RH(sk.baseDmg, r)], ['Distance', RP(rideReach(r))]] },
    arcane_anchor: { name: 'Arcane Anchor', school: 'trans', move: true, scroll: true, cd: 8, dmg: 25, desc: 'Drop an anchor where you stand. Cast again within 5 s to snap back to it, striking everything on the way.',
        stats: (r, sk) => [['Snap-back hit', RH(sk.baseDmg, r)]] },
    time_stop: { name: 'Time Stop', school: 'trans', greater: true, scroll: true, cd: 16, dmg: 0, desc: 'Time freezes: enemies and their shots stand still while you move. Every hit you land waits, then all of them land at once (+25%) when time resumes.',
        stats: r => [['Duration', RS(timeStopLen(r))]] },
    // ---- Abjuration ----
    frost_nova: { name: 'Frost Nova', school: 'abjur', cd: 5, dmg: 20, desc: 'A burst of frost around you that hits and slows everything within 180 px by 60% for 3 s.',
        stats: (r, sk) => [['Hit', RH(sk.baseDmg, r)]] },
    arcane_ward: { name: 'Arcane Ward', school: 'abjur', cd: 8, dmg: 30, desc: 'A shield for 4 s. When it breaks or runs out it bursts outward, hitting and shoving back everything near you.',
        stats: (r, sk) => [['Shield', Math.round(RU(60, r))], ['Burst', RH(sk.baseDmg, r)]] },
    spell_mirror: { name: 'Spell Mirror', school: 'abjur', cd: 6, dmg: 30, desc: 'For a moment a mirror surrounds you: enemy shots that reach it fly back at their shooters.',
        stats: (r, sk) => [['Mirror time', RS(mirrorTime(r))], ['Reflected shot', RH(sk.baseDmg, r)]] },
    gravity_well: { name: 'Gravity Well', school: 'abjur', cd: 8, dmg: 10, scroll: true, desc: 'A well at the cursor for 3 s: it slows everything in it by 40% and drags them to its centre (bosses are only slowed).',
        stats: (r, sk) => [['Per second', RH(sk.baseDmg, r)]] },
    blizzard: { name: 'Blizzard', school: 'abjur', greater: true, cd: 14, dmg: 25, desc: 'A storm over the cursor area for 5 s: it hits everything inside, slows it by 50%, and freezes what stays in it for 2 s.',
        stats: (r, sk) => [['Per second', RH(sk.baseDmg, r)]] },
};

// Rank effects (RANK_STATS reads them too)
function blinkReach(level) { return calcUtility(350, level); }          // 350 → 560 px
function flickerReach(level) { return 160 + 20 * (Math.max(1, level) - 1); }
function rideReach(level) { return 300 + 40 * (Math.max(1, level) - 1); }
function timeStopLen(level) { return 2.5 + 0.25 * (Math.max(1, level) - 1); }
function mirrorTime(level) { return 0.6 + 0.1 * (Math.max(1, level) - 1); }
function detonateMult(level) { return 1.5 + 0.25 * (Math.max(1, level) - 1); }

const sw = { runes: [], zones: [], anchor: null, timeStop: null, mirror: null, ward: null, flicker: FLICKER_CHARGES, flickerT: 0 };
function resetSpellweaverState() {
    sw.runes.length = 0; sw.zones.length = 0; sw.anchor = sw.timeStop = sw.mirror = sw.ward = null; sw.flicker = FLICKER_CHARGES; sw.flickerT = 0;
    resetSpellEvos(); // spellweaver_evo.js
}

// ---------- the loadout ----------

const isSpellbook = () => !!(activeClass && activeClass.name === 'Spellweaver');
function spellOf(slot) { const sk = activeClass && activeClass.skills[slot]; return sk && SPELLS[sk.spell]; }
function spellKey() { return isSpellbook() && player.spells ? ':' + [1, 2, 3, 4].map(i => player.spells[i]).join(',') : ''; }
// What the web (skilltree.js) builds a key's branch from: the spell on it
function spellBase(slot) { const id = player.spells[slot], S = SPELLS[id]; return { name: S.name, maxCd: S.cd, baseDmg: S.dmg, greater: !!S.greater, spell: id, upgA: S.upgA, upgB: S.upgB }; }
function lastLoadout() {
    let L = null; try { L = JSON.parse(localStorage.getItem('swLoadout')); } catch (e) {}
    return L && [1, 2, 3, 4].every(i => SPELLS[L[i]]) && [1, 2, 3, 4].filter(i => SPELLS[L[i]].greater).length <= 1 ? L : { ...DEFAULT_SPELLS };
}

// Put the loadout on the keys. A key whose spell changed loses its branch of the web (points refunded outside the
// Training Room, where the web is free and the new spell starts learned).
function applyLoadout(spells, fresh) {
    const old = player.spells || {}, oldNodes = !fresh && player.tree && player.spells ? treeNodes() : []; // the web as it was: a changed key's old talents go
    player.spells = { ...spells };
    for (let i = 1; i <= 4; i++) {
        const S = SPELLS[player.spells[i]], sk = activeClass.skills[i];
        sk.name = S.name; sk.maxCd = S.cd; sk.baseDmg = S.dmg; sk.spell = player.spells[i]; sk.greater = !!S.greater; sk.desc = S.desc;
        sk.upgA = S.upgA; sk.upgB = S.upgB; // spellweaver_evo.js
        if (fresh || old[i] === player.spells[i] || !player.tree) continue;
        const was = player.tree[`s${i}_learn`];
        for (const n of oldNodes) if (n.slot === i && hasTalent(n.id)) { if (!treeFree() && player.tree[n.id] === true) player.skillPoints += nodeCost(n); delete player.tree[n.id]; } // a free copy of a school talent cost nothing
        if (was && treeFree()) player.tree[`s${i}_learn`] = true;
        if (sw.anchor && sw.anchor.slot === i) sw.anchor = null;
        cooldowns[`s${i}`] = 0;
    }
    try { localStorage.setItem('swLoadout', JSON.stringify(player.spells)); } catch (e) {}
    if (fresh) return;
    tree.nodes = null; treePrune(); applyTree(); hud.sig = null; updateHUD();
}

// ---------- casting ----------

const SW_RMB = window.SkillRegistry.Spellweaver.rmb; // Arcane Beam stays the Archmagus Staff's (skills.js)
function castSpell(slot, sk, dmg, k) {
    const S = SPELLS[sk.spell]; if (!S) return;
    addResonance(1); // skills.js: every spell weaves a charge
    ((sk.selectedUpg && S['cast' + sk.selectedUpg]) || S.cast)(sk, dmg, k, slot); // spellweaver_evo.js: the evolved form
    swAfterCast(slot, sk, dmg, k); // spellweaver_evo.js: Doppelganger, Legion, Paradox
}
window.SkillRegistry.Spellweaver = {
    1: (sk, dmg, k) => castSpell(1, sk, dmg, k), 2: (sk, dmg, k) => castSpell(2, sk, dmg, k),
    3: (sk, dmg, k) => castSpell(3, sk, dmg, k), 4: (sk, dmg, k) => castSpell(4, sk, dmg, k),
    rmb: SW_RMB,
    canCast: slot => { const S = spellOf(slot); return !S || !S.canCast || S.canCast(activeClass.skills[slot]); },
    charge: { 1: sk => spellCharge(sk), 2: sk => spellCharge(sk), 3: sk => spellCharge(sk), 4: sk => spellCharge(sk) },
};
function spellCharge(sk) { const S = SPELLS[sk.spell], ch = S && ((sk.selectedUpg && S['charge' + sk.selectedUpg]) || S.charge); return ch ? ch(sk) : null; }

// A movement spell landed (or started its dash): the Space finisher window, on any key (main.js castSkill does it for slot 3
// on every other class), and the Blinkstep Slippers' echo where you were
function swMoved(sk, x0, y0) {
    comboCastAt = fxTime;
    if (player.dash) player.dash.combo = true; else openCombo({ x0, y0, x1: player.x, y1: player.y });
    if (hasItem('Blinkstep Slippers')) blinkEcho(x0, y0, calcDmg(25, sk.level)); // items.js
    swLegion(x0, y0); // spellweaver_evo.js
}

const swAim = () => Math.atan2(mouseY - player.y, mouseX - player.x);
const swOk = e => !e.dead && !e.pod && !e.submerged && !e.prop && !(e.spawnT > 0) && !(e.flyUntil > fxTime);
const swHittable = e => !e.dead && !e.submerged;
function swPoint(range) { // the cursor, held within range of the hero and inside the map
    const dx = mouseX - player.x, dy = mouseY - player.y, d = Math.hypot(dx, dy), k = d > range ? range / d : 1;
    return clampPointToMap(player.x + dx * k, player.y + dy * k, 10);
}
function swNearest(x, y, maxD, skip) {
    let best = null, bd = maxD;
    for (const e of enemies) { if (!swOk(e) || (skip && skip.includes(e))) continue; const d = Math.hypot(e.x - x, e.y - y) - e.size / 2; if (d < bd) { bd = d; best = e; } }
    return best;
}
function swHitCircle(x, y, r, dmg, src = 'magic') { let n = 0; for (const e of enemies) if (swHittable(e) && Math.hypot(e.x - x, e.y - y) <= r + e.size / 2) { applyDamage(e, dmg, src); n++; } return n; }
function swShove(x, y, r, dist) {
    for (const e of enemies) {
        if (!swOk(e) || e.type.startsWith('boss')) continue;
        const dx = e.x - x, dy = e.y - y, d = Math.hypot(dx, dy);
        if (d > r + e.size / 2 || d < 1) continue;
        e.x += dx / d * dist; e.y += dy / d * dist; clampToBounds(e, e.size / 2);
    }
}

// ---- Evocation ----
SPELLS.fireball.cast = (sk, dmg) => {
    const a = swAim(), tx = player.x + Math.cos(a) * 45, ty = player.y + Math.sin(a) * 45;
    const [dx, dy, dist] = getVector(tx, ty, mouseX, mouseY), ux = dist > 0 ? dx / dist : Math.cos(a), uy = dist > 0 ? dy / dist : Math.sin(a);
    projectiles.push({ x: tx, y: ty, vx: ux * 500, vy: uy * 500, radius: 12, color: '#ff5722', life: 2.0, type: 'fireball', shape: 'fireball', damage: dmg, pierce: false, isEnemy: false, sourceSkill: sk });
};

SPELLS.magic_missile.cast = (sk, dmg) => {
    const pool = enemies.filter(e => swOk(e) && Math.hypot(e.x - player.x, e.y - player.y) < 750)
        .sort((a, b) => Math.hypot(a.x - mouseX, a.y - mouseY) - Math.hypot(b.x - mouseX, b.y - mouseY)).slice(0, MISSILES);
    const a0 = swAim();
    for (let n = 0; n < MISSILES; n++) {
        const a = a0 + (n - 1) * 0.7;
        projectiles.push({ x: player.x + Math.cos(a) * 28, y: player.y + Math.sin(a) * 28, vx: Math.cos(a) * MISSILE_SPEED, vy: Math.sin(a) * MISSILE_SPEED, radius: 7, color: '#e040fb',
            life: 2.2, type: 'basic', shape: 'arcane_missile', damage: dmg, pierce: false, hitList: [], isEnemy: false, seek: pool.length ? pool[n % pool.length] : null, customUpdate: missileSeek });
    }
};
function missileSeek(dt, p) { // turns hard onto its target, and finds another if it died
    if (!p.seek || !swOk(p.seek)) p.seek = swNearest(p.x, p.y, 500);
    const t = p.seek; if (!t) return;
    const [dx, dy, d] = getVector(p.x, p.y, t.x, t.y); if (d < 1) return;
    const f = Math.min(1, 7 * dt), spd = MISSILE_SPEED + 250;
    p.vx += (dx / d * spd - p.vx) * f; p.vy += (dy / d * spd - p.vy) * f;
}

SPELLS.chain_lightning.cast = (sk, dmg) => {
    const a = swAim(), sx = player.x + Math.cos(a) * 40, sy = player.y + Math.sin(a) * 40;
    let cur = null, bd = 160;
    for (const e of enemies) { if (!swOk(e) || Math.hypot(e.x - player.x, e.y - player.y) > 650) continue; const d = Math.hypot(e.x - mouseX, e.y - mouseY) - e.size / 2; if (d < bd) { bd = d; cur = e; } }
    if (!cur) cur = swNearest(player.x, player.y, 420);
    if (!cur) { const [ex, ey] = swPoint(300); effects.push({ type: 'lightning', x1: sx, y1: sy, x2: ex, y2: ey, color: '#80d8ff', life: 0.2, maxLife: 0.2 }); return; } // a bolt into the air
    const hit = []; let fx = sx, fy = sy, mult = 1;
    for (let j = 0; j <= CHAIN_JUMPS && cur; j++) {
        effects.push({ type: 'lightning', x1: fx, y1: fy, x2: cur.x, y2: cur.y, color: '#80d8ff', life: 0.25, maxLife: 0.25 }); // skillfx.js
        burst(cur.x, cur.y, 0, Math.PI * 2, 5, { kind: 'spark', color: '#b3e5fc', size: 2, life: 0.25, speed: [100, 260], drag: 5 });
        applyDamage(cur, dmg * mult, 'magic');
        if (!cur.dead) cur.shockTimer = Math.max(cur.shockTimer || 0, 1.0); // main.js: half speed
        hit.push(cur); fx = cur.x; fy = cur.y; mult *= CHAIN_FALLOFF;
        cur = swNearest(fx, fy, CHAIN_JUMP_R, hit);
    }
    addShake(1.5);
};

SPELLS.arcane_cannon.charge = () => ({ max: CANNON_CHARGE, slow: 0 }); // planted while it gathers
SPELLS.arcane_cannon.cast = (sk, dmg, k = 1) => {
    const a = swAim(), q = k === undefined ? 1 : k;
    projectiles.push({ x: player.x + Math.cos(a) * 44, y: player.y + Math.sin(a) * 44, vx: Math.cos(a) * 640, vy: Math.sin(a) * 640, radius: 12 + 20 * q, color: '#b388ff',
        life: 1.5, type: 'basic', shape: 'sw_orb', charge: q, damage: dmg * (0.3 + 0.7 * q), pierce: true, hitList: [], isEnemy: false });
    burst(player.x + Math.cos(a) * 44, player.y + Math.sin(a) * 44, a, 1.2, 6 + 10 * q, { kind: 'spark', color: '#d1c4e9', size: 2.5, life: 0.3, speed: [120, 380], drag: 5 });
    addShake(1 + 2.5 * q);
};

SPELLS.meteor.cast = (sk, dmg) => {
    const tx = Math.max(currentMap.left, Math.min(currentMap.right, mouseX)), ty = Math.max(currentMap.top, Math.min(currentMap.bottom, mouseY)), delay = 1.0;
    effects.push({ type: 'meteor_fall', x: tx, y: ty, radius: 150, life: delay, maxLife: delay }); // skillfx_ult.js
    const meteor = trackMeteor(tx, ty, fxTime + delay, 150, dmg); // combos.js Frostfire
    after(delay, () => {
        effects.push({ type: 'fiery_explosion', x: tx, y: ty, radius: 150, life: 0.5, maxLife: 0.5 });
        effects.push({ type: 'molten_scorch', x: tx, y: ty, radius: 120, life: 3.0, maxLife: 3.0 });
        burst(tx, ty, 0, Math.PI * 2, 14, { kind: 'debris', color: '#4e342e', size: 5, life: 0.7, speed: [150, 380], drag: 4 });
        swHitCircle(tx, ty, 150, dmg);
        meteorLanded(meteor); // combos.js: a Frost Nova cast just before turns it to frostfire
    });
};

// ---- Glyphcraft ----
// A rune: { kind: 'blast' | 'bind', x, y, dmg, root, armAt, life, extra } (extra: Runestorm's, outside the limit)
function placeRune(kind, x, y, dmg, o = {}) {
    if (!o.extra) {
        const mine = sw.runes.filter(r => r.kind === kind && !r.extra);
        if (mine.length >= runeCap(kind)) sw.runes.splice(sw.runes.indexOf(mine[0]), 1); // the oldest fades (spellweaver_evo.js: Deep Etching fits one more)
    }
    sw.runes.push({ kind, x, y, dmg, armAt: fxTime + RUNE_ARM, life: runeLife(), born: fxTime, ...o });
    if (swT('sw_scribe')) sw.runes[sw.runes.length - 1].armAt = fxTime; // Quick Scribe
}
function fireRune(r, mult = 1) {
    if (r.kind === 'bind') {
        effects.push({ type: 'sw_bind', x: r.x, y: r.y, radius: RUNE_BLAST, life: 0.5, maxLife: 0.5 });
        for (const e of enemies) {
            if (!swHittable(e) || Math.hypot(e.x - r.x, e.y - r.y) > RUNE_BLAST + e.size / 2) continue;
            applyDamage(e, r.dmg * mult, 'magic');
            if (!e.dead && !e.prop) e.rootedTimer = Math.max(e.rootedTimer || 0, r.root * mult);
        }
    } else {
        effects.push({ type: 'fiery_explosion', x: r.x, y: r.y, radius: RUNE_BLAST * (mult > 1 ? 1.2 : 1), life: 0.4, maxLife: 0.4 });
        swHitCircle(r.x, r.y, RUNE_BLAST * (mult > 1 ? 1.2 : 1), r.dmg * mult);
        addShake(1.2);
    }
}
SPELLS.explosive_rune.cast = (sk, dmg) => { const [x, y] = swPoint(RUNE_RANGE); placeRune('blast', x, y, dmg); runeDrop(x, y, '#ff7043'); };
SPELLS.rune_of_binding.cast = (sk, dmg) => { const [x, y] = swPoint(RUNE_RANGE); placeRune('bind', x, y, dmg, { root: calcUtility(1.2, sk.level) }); runeDrop(x, y, '#ffd54f'); };
function runeDrop(x, y, color) { burst(x, y, 0, Math.PI * 2, 6, { kind: 'spark', color, size: 2, life: 0.3, speed: [40, 120], drag: 5 }); }

SPELLS.storm_glyph.cast = (sk, dmg) => {
    const [x, y] = swPoint(RUNE_RANGE);
    sw.zones.push({ kind: 'storm', x, y, r: STORM_R, t: STORM_TIME, max: STORM_TIME, tick: 0.15, dmg });
};

SPELLS.runic_detonation.cast = (sk, dmg) => {
    const mult = detonateMult(sk.level), storms = sw.zones.filter(z => z.kind === 'storm');
    if (!sw.runes.length && !storms.length) { placeRune('blast', player.x, player.y, dmg, { armAt: fxTime + 0.3 }); runeDrop(player.x, player.y, '#ff7043'); return; }
    const list = sw.runes.splice(0).sort((a, b) => Math.hypot(a.x - player.x, a.y - player.y) - Math.hypot(b.x - player.x, b.y - player.y));
    list.forEach((r, n) => after(n * 0.07, () => fireRune(r, mult))); // a ripple outward from you
    for (const z of storms) { // the glyph spends what it had left in one strike
        const left = Math.ceil(z.t / STORM_TICK);
        effects.push({ type: 'circle_burst', x: z.x, y: z.y, radius: z.r * 1.2, color: 'rgba(128, 216, 255, 0.7)', life: 0.35, maxLife: 0.35 });
        for (const e of enemies) if (swHittable(e) && Math.hypot(e.x - z.x, e.y - z.y) <= z.r + e.size / 2) {
            applyDamage(e, z.dmg * left * 0.6 * mult, 'magic');
            effects.push({ type: 'lightning', x1: z.x, y1: z.y - 30, x2: e.x, y2: e.y, color: '#80d8ff', life: 0.25, maxLife: 0.25 });
        }
        z.t = 0;
    }
    effects.push({ type: 'text', text: 'DETONATE', x: player.x, y: player.y - 44, color: '#ffd54f', life: 0.6, maxLife: 0.6 });
};

SPELLS.runestorm.cast = (sk, dmg) => {
    const [cx, cy] = swPoint(650);
    for (let n = 0; n < RUNESTORM_RUNES; n++) {
        const a = n / RUNESTORM_RUNES * Math.PI * 2 + Math.random() * 0.5, d = n === 0 ? 0 : 60 + Math.random() * (RUNESTORM_R - 60);
        const [x, y] = clampPointToMap(cx + Math.cos(a) * d, cy + Math.sin(a) * d, 10);
        after(n * 0.05, () => { placeRune('blast', x, y, dmg, { extra: true, life: 12, armAt: fxTime + 0.6 }); runeDrop(x, y, '#ff7043'); });
    }
    effects.push({ type: 'circle_burst', x: cx, y: cy, radius: RUNESTORM_R, color: 'rgba(255, 213, 79, 0.35)', life: 0.5, maxLife: 0.5 });
};

// ---- Translocation ----
function swTeleport(sk, reach, ghost = true) {
    const [dx, dy, dist] = getVector(player.x, player.y, mouseX, mouseY); if (dist < 1) return;
    const d = Math.min(dist, reach), x0 = player.x, y0 = player.y;
    if (ghost) spawnDashGhost('#82b1ff', true, 0.4, Math.atan2(dy, dx));
    player.x += dx / dist * d; player.y += dy / dist * d; clampToBounds(player, player.radius);
    effects.push({ type: 'blink', x0, y0, x1: player.x, y1: player.y, life: 0.45, maxLife: 0.45 }); // skillfx_space.js
    swMoved(sk, x0, y0);
}
SPELLS.blink.cast = sk => swTeleport(sk, blinkReach(sk.level));

SPELLS.flicker.canCast = () => sw.flicker > 0;
SPELLS.flicker.cast = (sk, dmg, k, slot) => {
    if (sw.flicker >= FLICKER_CHARGES) sw.flickerT = skillBaseCd(slot, sk.level) * getCDR();
    sw.flicker--;
    swTeleport(sk, flickerReach(sk.level), false);
    spawnDashGhost('#80d8ff', true, 0.3, swAim());
    cooldowns[`s${slot}`] = cooldownMax[`s${slot}`] = devNoCooldowns ? 0 : sw.flicker > 0 ? 0.2 : sw.flickerT; // empty: the key shows the next charge
};

SPELLS.ride_lightning.cast = (sk, dmg) => rideLightning(sk, dmg);
function rideLightning(sk, dmg, land) { // land(hits, x0, y0): spellweaver_evo.js Static Trail / Lightning Tether
    const a = swAim(), d = Math.max(120, Math.min(Math.hypot(mouseX - player.x, mouseY - player.y), rideReach(sk.level))), x0 = player.x, y0 = player.y, hitList = [];
    startDash({ x: x0 + Math.cos(a) * d, y: y0 + Math.sin(a) * d, dur: 0.16, ghost: { color: '#80d8ff', glow: true, every: 0.02, life: 0.22 },
        onStep: (px, py, nx, ny) => {
            for (const e of enemies) {
                if (!swHittable(e) || hitList.includes(e) || distToSegment(e.x, e.y, px, py, nx, ny) > e.size / 2 + 28) continue;
                hitList.push(e); applyDamage(e, dmg, 'magic');
                if (!e.dead) e.shockTimer = Math.max(e.shockTimer || 0, 1.0);
            }
        },
        onArrive: () => {
            effects.push({ type: 'lightning', x1: x0, y1: y0, x2: player.x, y2: player.y, color: '#80d8ff', lineWidth: 5, life: 0.3, maxLife: 0.3 });
            burst(player.x, player.y, 0, Math.PI * 2, 10, { kind: 'spark', color: '#b3e5fc', size: 2.2, life: 0.3, speed: [120, 320], drag: 5 });
            if (hitList.length) addShake(1.5);
            if (land) land(hitList, x0, y0);
        } });
    swMoved(sk, x0, y0); // skillfx_space.js updateDash opens the finisher on arrival
}

SPELLS.arcane_anchor.cast = (sk, dmg, k, slot) => {
    if (!sw.anchor) { // drop it; the key is ready again at once for the snap-back
        sw.anchor = { x: player.x, y: player.y, t: ANCHOR_TIME, slot, born: fxTime };
        cooldowns[`s${slot}`] = cooldownMax[`s${slot}`] = devNoCooldowns ? 0 : 0.4;
        burst(player.x, player.y, 0, Math.PI * 2, 8, { kind: 'spark', color: '#80d8ff', size: 2, life: 0.35, speed: [60, 160], drag: 5 });
        return;
    }
    const A = sw.anchor, x0 = player.x, y0 = player.y; sw.anchor = null;
    spawnDashGhost('#82b1ff', true, 0.4, Math.atan2(A.y - y0, A.x - x0));
    player.x = A.x; player.y = A.y; clampToBounds(player, player.radius);
    effects.push({ type: 'blink', x0, y0, x1: player.x, y1: player.y, life: 0.45, maxLife: 0.45 });
    effects.push({ type: 'lightning', x1: x0, y1: y0, x2: player.x, y2: player.y, color: '#b388ff', life: 0.25, maxLife: 0.25 });
    for (const e of enemies) if (swHittable(e) && distToSegment(e.x, e.y, x0, y0, player.x, player.y) <= e.size / 2 + 30) applyDamage(e, dmg, 'magic');
    swMoved(sk, x0, y0);
};

// Time Stop: the enemy loop and enemy shots stand still (main.js swStill / swShotStill), and applyDamage (combat.js swOnDamage)
// holds every hit on the enemy it struck until time resumes, then lands them all at +25%
const timeStopped = () => !!sw.timeStop;
SPELLS.time_stop.cast = sk => {
    const T = timeStopLen(sk.level);
    sw.timeStop = { t: T, max: T };
    effects.push({ type: 'circle_burst', x: player.x, y: player.y, radius: 600, color: 'rgba(176, 190, 197, 0.25)', life: 0.6, maxLife: 0.6 });
    addShake(2);
};
function releaseTimeStop() {
    sw.timeStop = null;
    for (const e of enemies) {
        if (!e.tsHeld) continue;
        const held = e.tsHeld; e.tsHeld = null;
        if (e.dead) continue;
        for (const [a, s, ang] of held) applyDamage(e, a * TIMESTOP_BONUS, s, ang);
        burst(e.x, e.y, 0, Math.PI * 2, Math.min(14, 4 + held.length), { kind: 'spark', color: '#eceff1', size: 2.2, life: 0.35, speed: [100, 300], drag: 5 });
    }
    addShake(2.5);
}

// ---- Abjuration ----
SPELLS.frost_nova.cast = (sk, dmg) => frostNova(sk, dmg, e => { e.slowTimer = 3.0; e.slowAmount = 0.6; });
function frostNova(sk, dmg, onHit) { // onHit: the chill, or Shatter Nova's freeze (spellweaver_evo.js)
    const spikes = [];
    for (let k = 0; k < 15; k++) { const d = Math.random() * 180, a = Math.random() * Math.PI * 2; spikes.push({ xOffset: Math.cos(a) * d, yOffset: Math.sin(a) * d, size: 10 + Math.random() * 15 }); }
    effects.push({ type: 'random_ice_spikes', x: player.x, y: player.y, radius: 180, color: '#81d4fa', life: 0.6, maxLife: 0.6, spikes }); // skillfx_e.js
    for (const e of enemies) {
        if (!swHittable(e) || Math.hypot(player.x - e.x, player.y - e.y) > 180 + e.size / 2) continue;
        applyDamage(e, dmg, 'magic'); if (!e.dead) onHit(e);
    }
    frostfireNova(); // combos.js: cast as your Meteor lands, it turns the impact to frostfire
    iceWallNova(); // combos.js: cast right after Arcane Beam, the beam's line freezes into a wall
}

SPELLS.arcane_ward.cast = (sk, dmg) => {
    swShield(calcUtility(60, sk.level), WARD_TIME); // spellweaver_evo.js: Bulwark; combat.js caps it
    sw.ward = { t: WARD_TIME, dmg };
    effects.push({ type: 'circle_burst', x: player.x, y: player.y, radius: 50, color: 'rgba(179, 136, 255, 0.7)', life: 0.3, maxLife: 0.3 });
};
function wardBurst() {
    const w = sw.ward; sw.ward = null;
    if (w.absorb) { player.hp = Math.min(player.maxHp, player.hp + w.absorb * 0.3); swText(`+${Math.round(w.absorb * 0.3)}`, player.x, player.y - 10, '#69f0ae'); } // Absorption Ward
    effects.push({ type: 'circle_burst', x: player.x, y: player.y, radius: WARD_BURST_R, color: 'rgba(179, 136, 255, 0.75)', life: 0.4, maxLife: 0.4 });
    burst(player.x, player.y, 0, Math.PI * 2, 14, { kind: 'spark', color: '#d1c4e9', size: 2.5, life: 0.35, speed: [180, 420], drag: 5 });
    swHitCircle(player.x, player.y, WARD_BURST_R, w.dmg);
    swShove(player.x, player.y, WARD_BURST_R, 80);
    addShake(2);
}

SPELLS.spell_mirror.cast = (sk, dmg) => { sw.mirror = { t: mirrorTime(sk.level), max: mirrorTime(sk.level), dmg }; };
const UNMIRRORED = ['trap_throw', 'spore', 'sling_stone', 'firepot']; // lobbed, not flying at you
function mirrorShot(p) { // turned around and sent home: back at its shooter if it's alive, else straight back
    const o = p.owner && !p.owner.dead ? p.owner : null, spd = Math.max(450, Math.hypot(p.vx, p.vy));
    const a = o ? Math.atan2(o.y - p.y, o.x - p.x) : Math.atan2(-p.vy, -p.vx);
    Object.assign(p, { isEnemy: false, type: 'basic', shape: 'mirror_shot', color: '#e1bee7', vx: Math.cos(a) * spd, vy: Math.sin(a) * spd, damage: sw.mirror.dmg,
        pierce: false, hitList: [], life: 1.6, customUpdate: null, homeTarget: null, rampFrom: undefined, resonance: false });
    burst(p.x, p.y, a, 1, 5, { kind: 'spark', color: '#f3e5f5', size: 2, life: 0.25, speed: [100, 260], drag: 5 });
}

SPELLS.gravity_well.cast = (sk, dmg) => { const [x, y] = swPoint(600); sw.zones.push({ kind: 'well', x, y, r: WELL_R, t: WELL_TIME, max: WELL_TIME, dmg }); };
SPELLS.blizzard.cast = (sk, dmg) => { const [x, y] = swPoint(650); sw.zones.push({ kind: 'blizzard', x, y, r: BLIZZ_R, t: BLIZZ_TIME, max: BLIZZ_TIME, dmg, chill: new Map() }); };

// ---------- every frame (main.js update) ----------

function updateSpellweaver(dt) {
    if (!isSpellbook()) return;
    updateSpellEvos(dt); // spellweaver_evo.js
    if (sw.timeStop && (sw.timeStop.t -= dt) <= 0) releaseTimeStop();
    if (sw.flicker < FLICKER_CHARGES && (sw.flickerT -= dt) <= 0) { // a charge comes back
        sw.flicker++;
        const slot = [1, 2, 3, 4].find(i => activeClass.skills[i].spell === 'flicker');
        sw.flickerT = sw.flicker < FLICKER_CHARGES && slot ? skillBaseCd(slot, activeClass.skills[slot].level) * getCDR() : 0;
    }
    if (sw.anchor && (sw.anchor.t -= dt) <= 0) { // never recalled: the full cooldown starts now
        const s = sw.anchor.slot; sw.anchor = null;
        cooldowns[`s${s}`] = cooldownMax[`s${s}`] = devNoCooldowns ? 0 : skillBaseCd(s, activeClass.skills[s].level) * getCDR();
    }
    if (sw.ward && ((sw.ward.t -= dt) <= 0 || player.shield <= 0.5)) wardBurst();
    if (sw.mirror) {
        const arc = sw.mirror.arc, aim = swAim(), R = arc ? 78 : MIRROR_R; // Mirror Shield: a 120 degree arc facing the cursor
        for (const p of projectiles) if (p.isEnemy && !UNMIRRORED.includes(p.type) && (p.vx || p.vy) && Math.hypot(p.x - player.x, p.y - player.y) < R + p.radius
            && (!arc || Math.abs(swAngDiff(Math.atan2(p.y - player.y, p.x - player.x), aim)) < Math.PI / 3)) mirrorShot(p);
        if ((sw.mirror.t -= dt) <= 0) sw.mirror = null;
    }
    if (timeStopped()) return; // the runes and zones wait with the world
    const domain = swDomain(); // spellweaver_evo.js
    for (let i = sw.runes.length - 1; i >= 0; i--) {
        const r = sw.runes[i];
        if ((r.life -= dt) <= 0) { sw.runes.splice(i, 1); continue; }
        if (fxTime < r.armAt) continue;
        const reach = RUNE_TRIGGER * (domain ? 1.5 : 1);
        if (!enemies.some(e => swOk(e) && Math.hypot(e.x - r.x, e.y - r.y) < reach + e.size / 2)) continue;
        if (r.charges > 1) { r.charges--; r.armAt = fxTime + 1.5; } else sw.runes.splice(i, 1); // Rearming Rune
        fireRune(r);
    }
    for (let i = sw.zones.length - 1; i >= 0; i--) {
        const z = sw.zones[i];
        if ((z.t -= dt) <= 0) { sw.zones.splice(i, 1); zoneEnd(z); continue; }
        if (zoneTick(z, dt)) continue; // spellweaver_evo.js: the evolutions' zones
        if (z.kind === 'storm' && (z.tick -= dt) <= 0) {
            z.tick += STORM_TICK; let shown = 0;
            for (const e of enemies) {
                if (!swHittable(e) || Math.hypot(e.x - z.x, e.y - z.y) > z.r + e.size / 2) continue;
                applyDamage(e, z.dmg, 'magic');
                if (shown++ < 4) effects.push({ type: 'lightning', x1: z.x + jitter(z.r * 0.5), y1: z.y - 40, x2: e.x, y2: e.y, color: '#80d8ff', lineWidth: 2.5, life: 0.15, maxLife: 0.15 });
            }
            if (z.net) for (const r of sw.runes) { // Glyph Network: lines to your runes zap what crosses them
                if (Math.hypot(r.x - z.x, r.y - z.y) > 300) continue;
                for (const e of enemies) if (swHittable(e) && Math.hypot(e.x - z.x, e.y - z.y) > z.r + e.size / 2 && distToSegment(e.x, e.y, z.x, z.y, r.x, r.y) < e.size / 2 + 18) applyDamage(e, z.dmg, 'magic');
            }
        } else if (z.kind === 'well' || z.kind === 'blizzard') {
            const well = z.kind === 'well';
            for (const e of enemies) {
                if (!swHittable(e)) continue;
                const dx = z.x - e.x, dy = z.y - e.y, d = Math.hypot(dx, dy);
                if (d > z.r + e.size / 2) continue;
                applyDamage(e, z.dmg * dt, 'dot');
                const slow = well ? 0.4 : 0.5;
                if (!(e.slowTimer > 0) || e.slowAmount <= slow) { e.slowTimer = Math.max(e.slowTimer || 0, 0.3); e.slowAmount = slow; }
                if (well && d > 12 && swOk(e) && !e.type.startsWith('boss')) { const s = Math.min(d - 10, WELL_PULL * dt); e.x += dx / d * s; e.y += dy / d * s; clampToBounds(e, e.size / 2); }
                if (!well && !e.prop) { // two seconds in the storm freeze it (once per Blizzard)
                    const c = (z.chill.get(e) || 0) + dt; z.chill.set(e, c);
                    if (c >= BLIZZ_FREEZE && c - dt < BLIZZ_FREEZE) { e.frozenTimer = Math.max(e.frozenTimer || 0, 1.5); effects.push({ type: 'text', text: 'FROZEN', x: e.x, y: e.y - 24, color: '#b3e5fc', life: 0.6, maxLife: 0.6 }); }
                }
            }
            if (!well && Math.random() < dt * 40) spawnParticle({ kind: 'dot', color: '#e1f5fe', x: z.x + jitter(z.r), y: z.y + jitter(z.r) - 20, vx: 60 + jitter(20), vy: 50, size: 2, life: 0.7, drag: 0, grow: 0, spin: 0, rot: 0 });
        }
    }
}

// ---------- drawing ----------

function swRuneGlyph(c, x, y, R, color, armed, spin) { // a ring, a turning triangle and a dot: cheap flat strokes
    c.save(); c.translate(x, y);
    c.globalAlpha = armed ? 0.95 : 0.45;
    c.strokeStyle = color; c.lineWidth = 2;
    c.beginPath(); c.arc(0, 0, R, 0, Math.PI * 2); c.stroke();
    c.rotate(spin);
    c.beginPath(); for (let k = 0; k < 3; k++) { const a = k * Math.PI * 2 / 3; c[k ? 'lineTo' : 'moveTo'](Math.cos(a) * R * 0.75, Math.sin(a) * R * 0.75); } c.closePath(); c.stroke();
    c.fillStyle = color; c.beginPath(); c.arc(0, 0, R * 0.18, 0, Math.PI * 2); c.fill();
    c.restore();
}
function drawSpellweaverGround() { // main.js draw, under the enemies
    if (!isSpellbook()) return;
    const c = ctx;
    for (const z of sw.zones) {
        const fade = Math.min(1, (z.max - z.t) / 0.25, z.t / 0.4);
        c.save(); c.globalAlpha = fade;
        if (z.kind === 'storm') {
            c.fillStyle = 'rgba(41, 121, 255, 0.12)'; c.beginPath(); c.arc(z.x, z.y, z.r, 0, Math.PI * 2); c.fill();
            swRuneGlyph(c, z.x, z.y, z.r, '#80d8ff', true, fxTime * 0.8);
            c.strokeStyle = 'rgba(179, 229, 252, 0.5)'; c.lineWidth = 1.5; c.beginPath(); c.arc(z.x, z.y, z.r * 0.5, 0, Math.PI * 2); c.stroke();
        } else if (z.kind === 'well') {
            c.fillStyle = 'rgba(49, 27, 146, 0.22)'; c.beginPath(); c.arc(z.x, z.y, z.r, 0, Math.PI * 2); c.fill();
            c.strokeStyle = '#b388ff'; c.lineWidth = 2;
            for (let k = 0; k < 3; k++) { const q = 1 - ((fxTime * 0.9 + k / 3) % 1); c.globalAlpha = fade * (1 - q * 0.6); c.beginPath(); c.arc(z.x, z.y, z.r * q, 0, Math.PI * 2); c.stroke(); }
            c.globalAlpha = fade; c.fillStyle = '#1a0033'; c.beginPath(); c.arc(z.x, z.y, 10, 0, Math.PI * 2); c.fill();
        } else if (z.kind === 'blizzard') {
            c.fillStyle = 'rgba(225, 245, 254, 0.16)'; c.beginPath(); c.arc(z.x, z.y, z.r, 0, Math.PI * 2); c.fill();
            c.strokeStyle = 'rgba(225, 245, 254, 0.6)'; c.lineWidth = 2; c.setLineDash([10, 8]); c.lineDashOffset = -fxTime * 30;
            c.beginPath(); c.arc(z.x, z.y, z.r, 0, Math.PI * 2); c.stroke(); c.setLineDash([]);
        }
        c.restore();
    }
    for (const r of sw.runes) {
        const armed = fxTime >= r.armAt, grow = Math.min(1, (fxTime - r.born) / 0.25), blink = r.life < 2 ? 0.5 + 0.5 * Math.sin(fxTime * 18) : 1;
        c.save(); c.globalAlpha = blink;
        swRuneGlyph(c, r.x, r.y, 18 * grow, r.kind === 'bind' ? '#ffd54f' : '#ff7043', armed, (r.kind === 'bind' ? -1 : 1) * fxTime * 1.5);
        c.restore();
    }
    if (sw.anchor) {
        const A = sw.anchor;
        if (A.e) { A.x = A.e.x; A.y = A.e.y; } // Grapple Anchor rides its enemy
        swRuneGlyph(c, A.x, A.y, 16, '#80d8ff', true, fxTime * 2);
        c.save(); c.strokeStyle = 'rgba(128, 216, 255, 0.35)'; c.lineWidth = 1.5; c.setLineDash([6, 6]);
        c.beginPath(); c.moveTo(A.x, A.y); c.lineTo(player.x, player.y); c.stroke(); c.restore();
    }
    drawSpellEvosGround(); // spellweaver_evo.js
}
function drawSpellweaverWorld() { // main.js draw, over the hero
    if (!isSpellbook()) return;
    const c = ctx;
    drawSpellEvosWorld(); // spellweaver_evo.js
    if (sw.mirror) {
        const k = sw.mirror.t / sw.mirror.max;
        c.save(); c.globalAlpha = 0.4 + 0.5 * k; c.strokeStyle = '#f3e5f5'; c.lineWidth = 3;
        if (sw.mirror.arc) { const a = swAim(); c.lineWidth = 5; c.beginPath(); c.arc(player.x, player.y, 78, a - Math.PI / 3, a + Math.PI / 3); c.stroke(); }
        else { c.beginPath(); for (let n = 0; n <= 6; n++) { const a = n * Math.PI / 3 + fxTime; c[n ? 'lineTo' : 'moveTo'](player.x + Math.cos(a) * MIRROR_R, player.y + Math.sin(a) * MIRROR_R); } c.stroke();
            c.fillStyle = 'rgba(225, 190, 231, 0.12)'; c.fill(); }
        c.restore();
    }
    if (sw.ward && player.shield > 0) {
        c.save(); c.globalAlpha = 0.6; c.strokeStyle = '#b388ff'; c.lineWidth = 2; c.setLineDash([4, 5]); c.lineDashOffset = fxTime * 20;
        c.beginPath(); c.arc(player.x, player.y, player.radius + 16, 0, Math.PI * 2); c.stroke(); c.restore();
    }
    const ch = player.charge && spellOf(player.charge.slot);
    if (ch && ch === SPELLS.arcane_cannon) { // the orb gathering at the staff
        const q = Math.min(1, player.charge.t / player.charge.max), a = swAim(), x = player.x + Math.cos(a) * 44, y = player.y + Math.sin(a) * 44;
        c.save(); c.fillStyle = q >= 1 ? '#ede7f6' : '#b388ff'; c.globalAlpha = 0.85;
        c.beginPath(); c.arc(x, y, 5 + 15 * q + (q >= 1 ? Math.sin(fxTime * 20) * 2 : 0), 0, Math.PI * 2); c.fill();
        c.fillStyle = '#ffffff'; c.beginPath(); c.arc(x, y, 2 + 5 * q, 0, Math.PI * 2); c.fill(); c.restore();
    }
    if (sw.flicker < FLICKER_CHARGES && [1, 2, 3, 4].some(i => activeClass.skills[i].spell === 'flicker')) { // the charges left, under the hero
        for (let n = 0; n < FLICKER_CHARGES; n++) {
            c.fillStyle = n < sw.flicker ? '#80d8ff' : 'rgba(128, 216, 255, 0.25)';
            c.beginPath(); c.arc(player.x + (n - 1) * 10, player.y + player.radius + 12, 3, 0, Math.PI * 2); c.fill();
        }
    }
    if (sw.timeStop) { // the world drained of colour, a clock hand sweeping round the hero
        const T = sw.timeStop, k = 1 - T.t / T.max;
        c.save(); c.fillStyle = 'rgba(55, 71, 79, 0.28)'; c.fillRect(camera.x, camera.y, viewW(), viewH());
        c.strokeStyle = 'rgba(236, 239, 241, 0.7)'; c.lineWidth = 2;
        c.beginPath(); c.arc(player.x, player.y, 44, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * (1 - k)); c.stroke();
        const a = -Math.PI / 2 + Math.PI * 2 * k; c.beginPath(); c.moveTo(player.x, player.y); c.lineTo(player.x + Math.cos(a) * 40, player.y + Math.sin(a) * 40); c.stroke();
        c.restore();
    }
}
function drawSpellProjectile(p) { // skillfx.js drawSkillProjectile chain
    if (p.shape === 'sw_orb') {
        ctx.save(); ctx.globalAlpha = 0.35; ctx.fillStyle = '#7c4dff'; ctx.beginPath(); ctx.arc(p.x, p.y, p.radius * 1.4, 0, Math.PI * 2); ctx.fill();
        ctx.globalAlpha = 1; ctx.fillStyle = '#b388ff'; ctx.beginPath(); ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = '#ede7f6'; ctx.beginPath(); ctx.arc(p.x, p.y, p.radius * 0.45, 0, Math.PI * 2); ctx.fill(); ctx.restore();
        return true;
    }
    if (p.shape === 'mirror_shot') {
        ctx.fillStyle = '#e1bee7'; ctx.beginPath(); ctx.arc(p.x, p.y, Math.max(5, p.radius), 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = '#ffffff'; ctx.beginPath(); ctx.arc(p.x, p.y, Math.max(2, p.radius * 0.4), 0, Math.PI * 2); ctx.fill();
        return true;
    }
    return false;
}
function drawSpellEffect(ef, p, k) { // skillfx.js drawSkillEffect chain
    if (drawEvoEffect(ef, p, k)) return true; // spellweaver_evo.js
    if (ef.type !== 'sw_bind') return false;
    ctx.save(); ctx.globalAlpha = k; ctx.strokeStyle = '#ffd54f'; ctx.lineWidth = 3;
    for (let n = 0; n < 6; n++) { // golden chains snapping out to the rim
        const a = n * Math.PI / 3 + 0.3, r = ef.radius * (0.3 + 0.7 * p);
        ctx.beginPath(); ctx.moveTo(ef.x + Math.cos(a) * 10, ef.y + Math.sin(a) * 10); ctx.lineTo(ef.x + Math.cos(a) * r, ef.y + Math.sin(a) * r); ctx.stroke();
    }
    ctx.beginPath(); ctx.arc(ef.x, ef.y, ef.radius * (0.3 + 0.7 * p), 0, Math.PI * 2); ctx.stroke(); ctx.restore();
    return true;
}

// ---------- icons (icons.js skillIcon asks here for a Spellweaver's key) ----------

const SPELL_GLYPHS = {
    fireball: c => SKILL_GLYPHS.spellweaver[1](c), frost_nova: c => SKILL_GLYPHS.spellweaver[2](c),
    blink: c => SKILL_GLYPHS.spellweaver[3](c), meteor: c => SKILL_GLYPHS.spellweaver[4](c),
    magic_missile(c) { for (const [x, y, s] of [[18, 46, 0.8], [32, 30, 1], [46, 16, 0.8]]) { icGlow(c, x, y, 12 * s, '#e040fb', 0.6); icStar(c, x, y, 7 * s, '#f3e5f5'); } icSpeed(c, [[8, 54, 10], [22, 40, 8]], 'rgba(234, 128, 252, 0.8)'); },
    chain_lightning(c) { icBolt(c, 22, 22, 1.1, '#80d8ff'); icBolt(c, 42, 40, 0.9, '#b3e5fc'); icEll(c, 12, 12, 4, 4, '#e1f5fe', 1); icEll(c, 52, 54, 4, 4, '#e1f5fe', 1); },
    arcane_cannon(c) { icGlow(c, 36, 30, 24, '#7c4dff', 0.7); icEll(c, 36, 30, 15, 15, '#b388ff', 2); icEll(c, 33, 27, 6, 6, '#ede7f6', 0); icSpeed(c, [[6, 26, 12], [8, 36, 10], [10, 46, 8]], 'rgba(209, 196, 233, 0.8)'); },
    explosive_rune(c) { icFlame(c, 32, 30, 12, 22); swRuneGlyph(c, 32, 40, 18, '#ff7043', true, 0); },
    rune_of_binding(c) { swRuneGlyph(c, 32, 32, 22, '#ffd54f', true, 0.5); for (let n = 0; n < 4; n++) { const a = n * Math.PI / 2 + 0.78; icLine(c, '#ffecb3', 2.5, [[32 + Math.cos(a) * 8, 32 + Math.sin(a) * 8], [32 + Math.cos(a) * 26, 32 + Math.sin(a) * 26]]); } },
    storm_glyph(c) { swRuneGlyph(c, 32, 40, 22, '#80d8ff', true, 0); icBolt(c, 32, 26, 1.1, '#e1f5fe'); },
    runic_detonation(c) { for (const [x, y] of [[16, 46], [48, 46], [32, 18]]) { icGlow(c, x, y, 14, '#ff7043', 0.6); swRuneGlyph(c, x, y, 10, '#ffd54f', true, 0); } icLine(c, '#ffcc80', 2, [[16, 46], [32, 18], [48, 46], [16, 46]]); },
    runestorm(c) { for (const [x, y, r] of [[18, 20, 8], [44, 16, 7], [30, 34, 10], [14, 48, 7], [48, 44, 9]]) swRuneGlyph(c, x, y, r, '#ff7043', true, x); },
    flicker(c) { for (const [x, y, a] of [[14, 48, 0.3], [30, 34, 0.55], [48, 18, 1]]) { c.globalAlpha = a; icStar(c, x, y, 8, '#e1f5fe'); } c.globalAlpha = 1; icGlow(c, 48, 18, 14, '#4fc3f7', 0.7); },
    ride_lightning(c) { icSpeed(c, [[6, 30, 16], [10, 40, 12], [8, 20, 10]], 'rgba(128, 216, 255, 0.8)'); icBolt(c, 40, 30, 1.5, '#80d8ff'); },
    arcane_anchor(c) { icLine(c, '#b3e5fc', 4, [[32, 10], [32, 50]]); icArc(c, '#b3e5fc', 4, 32, 36, 16, 0.2, Math.PI - 0.2, false); icLine(c, '#b3e5fc', 4, [[22, 18], [42, 18]]); icGlow(c, 32, 10, 8, '#4fc3f7', 0.7); },
    time_stop(c) { icEll(c, 32, 32, 22, 22, '#37474f', 2.5); icEll(c, 32, 32, 17, 17, '#eceff1', 0); icLine(c, '#263238', 3, [[32, 32], [32, 18]], false); icLine(c, '#263238', 3, [[32, 32], [42, 36]], false); icEll(c, 32, 32, 2.5, 2.5, '#263238', 0); },
    arcane_ward(c) { icShieldPath(c, 32, 34, 18, 36); icFill(c, '#7e57c2', 2.2); icStar(c, 32, 30, 8, '#ede7f6'); icArc(c, 'rgba(179, 136, 255, 0.7)', 2, 32, 32, 28, -0.6, 0.6, false); icArc(c, 'rgba(179, 136, 255, 0.7)', 2, 32, 32, 28, Math.PI - 0.6, Math.PI + 0.6, false); },
    spell_mirror(c) { c.beginPath(); for (let n = 0; n < 6; n++) { const a = n * Math.PI / 3; c[n ? 'lineTo' : 'moveTo'](32 + Math.cos(a) * 22, 32 + Math.sin(a) * 22); } c.closePath(); icFill(c, 'rgba(225, 190, 231, 0.5)', 2.2); icArrowHead(c, 20, 32, Math.PI, 9, '#ff5252'); icLine(c, '#ff5252', 3, [[22, 32], [44, 32]], false); },
    gravity_well(c) { for (const [r, a] of [[24, 0.4], [16, 0.65], [8, 1]]) { c.globalAlpha = a; icArc(c, '#b388ff', 2.5, 32, 32, r, 0, Math.PI * 1.6, false); } c.globalAlpha = 1; icEll(c, 32, 32, 4, 4, '#1a0033', 1.5); },
    blizzard(c) { icEll(c, 32, 20, 18, 9, '#90a4ae', 2); for (const [x, y] of [[18, 38], [32, 44], [46, 38], [24, 54], [40, 54]]) icStar(c, x, y, 4.5, '#e1f5fe'); },
};
function spellIcon(id) { return renderIcon(`sp:${id}`, SCHOOLS[SPELLS[id].school].color, SPELL_GLYPHS[id] || (c => icStar(c, 32, 32, 16, '#fff'))); }

// ---------- the spellbook screen (after the carousel, and from the Training Room panel) ----------

const book = { pick: null, sel: 1, onDone: null, fromFight: false };
function showSpellbook(onDone, fromFight = false) {
    book.pick = { ...(fromFight && player.spells ? player.spells : lastLoadout()) }; book.sel = 1; book.onDone = onDone; book.fromFight = fromFight;
    el('class-selection').classList.add('hidden');
    if (fromFight) { book.prevState = gameState; gameState = STATE.SPELLBOOK; }
    el('spellbook-screen').classList.remove('hidden');
    renderSpellbook();
}
function closeSpellbook(cancel) {
    el('spellbook-screen').classList.add('hidden');
    if (book.fromFight) { gameState = STATE.PLAYING; lastTime = performance.now(); if (!cancel) { applyLoadout(book.pick, false); if (typeof renderTrainingPanel === 'function') renderTrainingPanel(); } return; }
    if (cancel) { el('class-selection').classList.remove('hidden'); return; }
    player.spells = { ...book.pick };
    try { localStorage.setItem('swLoadout', JSON.stringify(player.spells)); } catch (e) {}
    if (book.onDone) book.onDone();
}
function bookTake(id) {
    const P = book.pick, S = SPELLS[id];
    const on = [1, 2, 3, 4].find(i => P[i] === id);
    if (on) { [P[on], P[book.sel]] = [P[book.sel], P[on]]; renderSpellbook(); return; } // already on a key: swap the two keys
    const greaterOn = [1, 2, 3, 4].find(i => SPELLS[P[i]].greater);
    if (S.greater && greaterOn && greaterOn !== book.sel) { P[greaterOn] = P[book.sel]; } // one Greater: it moves here, and this key's spell takes its place
    P[book.sel] = id;
    book.sel = book.sel % 4 + 1;
    renderSpellbook();
}
function renderSpellbook() {
    const P = book.pick, keys = { 1: 'Q', 2: 'E', 3: 'Space', 4: 'R' };
    el('sb-keys').innerHTML = [1, 2, 3, 4].map(i => { const S = SPELLS[P[i]];
        return `<div class="sb-key ${book.sel === i ? 'sel' : ''}" data-key="${i}" style="--sc:${SCHOOLS[S.school].color}"><kbd>${keys[i]}</kbd><img src="${spellIcon(P[i])}"><div class="sb-kname">${S.name}</div>${S.greater ? '<div class="sb-tag">Greater</div>' : ''}</div>`; }).join('');
    el('sb-schools').innerHTML = Object.entries(SCHOOLS).map(([sid, sc]) => `<div class="sb-school" style="--sc:${sc.color}"><div class="sb-sname">${sc.name}</div><div class="sb-stag">${sc.tag}</div>`
        + Object.entries(SPELLS).filter(([, S]) => S.school === sid).map(([id, S]) => {
            const on = [1, 2, 3, 4].find(i => P[i] === id);
            return `<div class="sb-spell ${on ? 'on' : ''} ${S.greater ? 'greater' : ''}" data-spell="${id}"><img src="${spellIcon(id)}"><div class="sb-sp"><div class="sb-spname">${S.name}${on ? ` <kbd>${keys[on]}</kbd>` : ''}</div>`
                + `<div class="sb-spmeta">${S.greater ? '<b>Greater</b> &middot; Lv. 5 &middot; ' : ''}${S.cd}s${S.scroll ? ' &middot; <i>scroll</i>' : ''}</div><div class="sb-spdesc">${S.desc}</div></div></div>`;
        }).join('') + '</div>').join('');
}
window.addEventListener('click', e => {
    const k = e.target.closest('#sb-keys .sb-key'); if (k) { book.sel = +k.dataset.key; renderSpellbook(); return; }
    const s = e.target.closest('#sb-schools .sb-spell'); if (s) bookTake(s.dataset.spell);
});
window.addEventListener('keydown', e => {
    if (el('spellbook-screen').classList.contains('hidden')) return;
    const k = e.key.toLowerCase();
    if (k === 'enter') { e.preventDefault(); closeSpellbook(false); }
    else if (k === 'escape') closeSpellbook(true);
    e.stopImmediatePropagation(); // no casting or panel keys while choosing
}, true);
