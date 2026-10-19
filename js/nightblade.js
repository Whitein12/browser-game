// ==========================================
// nightblade.js - The Nightblade's skills and its web (CLASS_WEBS.md; talents in talents.js TALENT_WEBS.nightblade)
// ==========================================
// A fragile assassin built on weak points (combat.js weakPointDamage: 'melee_basic', 'phantom_dash', 'assassin_skill',
// 'death_mark' can pop one). SkillRegistry.Nightblade's keys live here; Expose (RMB) and canCast stay in skills.js.
// Q Fan of Knives: A Blade Orbit (the knives circle you, nb.orbit) / B Venom Edge (stacks on enemies, e.venom; a Phantom
// Dash through one bursts them). E Smoke Bomb: A Toxic Fumes / B Mirage (shadow decoys, nb.decoys). Space Phantom Dash:
// A Reaper's Chain (a kill soon after the cut resets it) / B Shadow Return (recast to dash back, nb.ret). R Mark for Death:
// A Bloodlust / B Chain Reaction (mfdStrike runs the clone strikes one at a time, so a jump can refill or split them).

const NB_ORBIT_TIME = 3, NB_ORBIT_R = 70, NB_ORBIT_SPIN = 7, NB_ORBIT_GAP = 0.3, NB_KNIFE_MAX = 8;
const VENOM_MAX = 5, VENOM_TIME = 6, VENOM_MULT = 0.8, DASH_REACH = 300, NB_RETURN_TIME = 2;
const MIRAGE_TIME = 3, MIRAGE_STAB = 0.6;
const nb = { orbit: null, ret: null, decoys: [], venomed: [], chain: 0, lastReset: -99, dashId: 0, resetFor: -1, rush: [], frenzy: [], vanish: 0, ambush: false };
function resetNightblade() {
    nb.orbit = nb.ret = null; nb.decoys.length = 0; nb.venomed.length = 0; nb.chain = 0; nb.lastReset = -99; nb.rush.length = 0; nb.frenzy.length = 0; nb.vanish = 0; nb.ambush = false;
}
const nbAim = () => Math.atan2(mouseY - player.y, mouseX - player.x);
const nbFull = slot => devNoCooldowns ? 0 : skillBaseCd(slot, activeClass.skills[slot].level) * getCDR();

// ---------- Q: Fan of Knives ----------

function nbKnife(x, y, a, dmg, o = {}) {
    projectiles.push({ x, y, vx: Math.cos(a) * 800, vy: Math.sin(a) * 800, radius: 5, color: '#e1bee7', life: 1.0, type: 'fan_of_knives', shape: 'knife', damage: dmg,
        pierce: false, hitList: [], isEnemy: false, source: 'fan_of_knives', venom: o.venom, bleed: hasTalent('nb_fan_bleed'), spellHit: nbKnifeHit });
}
function nbKnifeHit(p, e) { // main.js: a knife's own hit (Serrated Steel's bleed, Venom Edge's stack)
    applyDamage(e, p.damage, 'assassin_skill', Math.atan2(p.vy, p.vx));
    if (e.dead) return;
    if (p.bleed) { e.bleedTimer = 3; e.bleedDmg = Math.max(e.bleedDmg || 0, p.damage * 0.3); }
    if (p.venom) addVenom(e, 1);
}
function nbFan(sk, dmg) {
    if (sk.selectedUpg === 'A') return nbOrbitCast(sk, dmg);
    const base = nbAim(), n = hasTalent('nb_fan_more') ? 7 : 5;
    effects.push({ type: 'knife_fan', x: player.x, y: player.y, angle: base, life: 0.2, maxLife: 0.2 });
    for (let i = 0; i < n; i++) nbKnife(player.x, player.y, base + (i - (n - 1) / 2) * 0.2, dmg, { venom: sk.selectedUpg === 'B' });
}
// Blade Orbit: the knives circle you; each cuts what it passes (once per 0.3 s per enemy) from the side it's moving to
function nbOrbitCast(sk, dmg) {
    if (nb.orbit && hasTalent('nb_orbit_release')) return nbRelease(); // Release: Q again flings them out
    nb.orbit = { t: hasTalent('nb_orbit_long') ? 5 : NB_ORBIT_TIME, n: hasTalent('nb_fan_more') ? 7 : 5, dmg, ang: nbAim(), hit: new Map() };
    if (hasTalent('nb_orbit_release')) cooldowns.s1 = cooldownMax.s1 = devNoCooldowns ? 0 : 0.3; // the cooldown waits for the release or the end
}
const nbOrbitR = () => hasTalent('nb_orbit_wide') ? 110 : NB_ORBIT_R;
function nbRelease() {
    const o = nb.orbit; nb.orbit = null; if (!o) return;
    for (let k = 0; k < o.n; k++) { const a = o.ang + k * Math.PI * 2 / o.n; nbKnife(player.x + Math.cos(a) * nbOrbitR(), player.y + Math.sin(a) * nbOrbitR(), a, o.dmg); }
    effects.push({ type: 'knife_fan', x: player.x, y: player.y, angle: o.ang, life: 0.2, maxLife: 0.2 });
    cooldowns.s1 = cooldownMax.s1 = nbFull(1);
}
function updateBladeOrbit(dt) {
    const o = nb.orbit; if (!o) return;
    if ((o.t -= dt) <= 0) { nb.orbit = null; if (hasTalent('nb_orbit_release')) cooldowns.s1 = cooldownMax.s1 = nbFull(1); return; }
    o.ang += NB_ORBIT_SPIN * dt;
    const R = nbOrbitR();
    for (let k = 0; k < o.n; k++) {
        const a = o.ang + k * Math.PI * 2 / o.n, kx = player.x + Math.cos(a) * R, ky = player.y + Math.sin(a) * R;
        for (const e of enemies) {
            if (e.dead || e.submerged || Math.hypot(e.x - kx, e.y - ky) > e.size / 2 + 10) continue;
            if (fxTime - (o.hit.get(e) || -9) < NB_ORBIT_GAP) continue;
            o.hit.set(e, fxTime);
            applyDamage(e, o.dmg, 'assassin_skill', a + Math.PI / 2); // struck from the side the knife moves toward
        }
    }
}
// Venom Edge: stacks on enemies; a Phantom Dash through one (or Rupture's weak point) bursts them as true damage
function addVenom(e, n) {
    if (!e.venom) e.venom = { n: 0, t: 0 };
    e.venom.n = Math.min(VENOM_MAX, e.venom.n + n); e.venom.t = VENOM_TIME;
    if (!nb.venomed.includes(e)) nb.venomed.push(e);
    if (e.venom.n >= VENOM_MAX && hasTalent('nb_venom_weak')) e.markAngle = Math.atan2(player.y - e.y, player.x - e.x); // Exposed Veins
}
function burstVenom(e) {
    const v = e.venom; if (!v || v.n <= 0) return;
    e.venom = null;
    applyDamage(e, v.n * calcDmg(activeClass.basicDmg) * VENOM_MULT / HIT_SCALE, 'venom'); // true damage: past the x0.6
    burst(e.x, e.y, 0, Math.PI * 2, 6 + v.n * 2, { kind: 'spark', color: '#76ff03', size: 2.5, life: 0.35, speed: [100, 300], drag: 5 });
    effects.push({ type: 'text', text: `VENOM x${v.n}`, x: e.x, y: e.y - 36, color: '#b2ff59', life: 0.7, maxLife: 0.7 });
    if (v.n >= VENOM_MAX && hasTalent('nb_venom_rupture') && !e.dead) e.stunTimer = Math.max(e.stunTimer || 0, 1);
    if (hasTalent('nb_venom_spread')) for (const o of enemies) if (o !== e && !o.dead && !o.pod && Math.hypot(o.x - e.x, o.y - e.y) < 120 + o.size / 2) addVenom(o, 2); // Contagion
}

// ---------- E: Smoke Bomb ----------

function nbSmoke(sk, dmg) {
    const radius = 150 * (hasTalent('nb_smoke_wide') ? 1.4 : 1), poison = sk.selectedUpg === 'A', particles = [];
    for (let i = 0; i < 20; i++) particles.push({ xOffset: (Math.random() - 0.5) * radius * 0.8, yOffset: (Math.random() - 0.5) * radius * 0.8, r: radius * (0.3 + Math.random() * 0.5), rotSpeed: (Math.random() - 0.5) * 1.5, startAng: Math.random() * Math.PI * 2 });
    const duration = calcUtility(5.0, sk.level);
    effects.push({ type: 'smoke_bomb', x: player.x, y: player.y, radius, color: poison ? 'rgba(76, 175, 80, 0.7)' : 'rgba(80, 80, 80, 0.7)', life: duration, maxLife: duration, poison, dmg, particles });
    if (sk.selectedUpg === 'B') nbMirage(player.x, player.y, radius);
}
function nbPuff(x, y, r, t) { // a small plain cloud (Smoke and Mirrors, Vanishing Act)
    const particles = Array.from({ length: 8 }, () => ({ xOffset: (Math.random() - 0.5) * r, yOffset: (Math.random() - 0.5) * r, r: r * (0.4 + Math.random() * 0.4), rotSpeed: (Math.random() - 0.5) * 1.5, startAng: Math.random() * Math.PI * 2 }));
    effects.push({ type: 'smoke_bomb', x, y, radius: r, color: 'rgba(80, 80, 80, 0.7)', life: t, maxLife: t, poison: false, dmg: 0, particles });
}
// main.js, for each enemy in a poisoned cloud each frame: Choking Fumes, Lingering Haze, Gasping, and Plague Cloud's record
function nbFumes(ef, e, dt) {
    e.inFumes = fxTime; e.fumeDmg = ef.dmg;
    if (hasTalent('nb_toxic_slow') && (!(e.slowTimer > 0) || e.slowAmount <= 0.3)) { e.slowTimer = Math.max(e.slowTimer || 0, 0.3); e.slowAmount = 0.3; }
    if (hasTalent('nb_toxic_linger')) e.toxicLinger = { t: 3, dmg: ef.dmg };
    if (hasTalent('nb_toxic_expose') && e.fumeCloud !== ef) {
        e.fumeT = (e.fumeT || 0) + dt;
        if (e.fumeT >= 2) { e.fumeT = 0; e.fumeCloud = ef; e.markAngle = Math.atan2(player.y - e.y, player.x - e.x); } // once per cloud
    }
}
// Mirage: shadows run out of the cloud and draw idle non-bosses for 3 s (each a dash ghost standing there)
function nbMirage(x, y, radius) {
    const n = hasTalent('nb_mirage_three') ? 3 : 2, a0 = Math.random() * Math.PI * 2;
    for (let k = 0; k < n; k++) {
        const a = a0 + k * Math.PI * 2 / n, [tx, ty] = clampPointToMap(x + Math.cos(a) * (radius + 70), y + Math.sin(a) * (radius + 70), 20);
        for (let s = 1; s <= 3; s++) spawnDashGhost('#4a148c', false, 0.2 + s * 0.08, a, lerp(x, tx, s / 4), lerp(y, ty, s / 4), 0);
        spawnDashGhost('#311b92', false, MIRAGE_TIME, a, tx, ty, 0);
        nb.decoys.push({ x: tx, y: ty, t: MIRAGE_TIME, stab: MIRAGE_STAB, ghost: dashGhosts[dashGhosts.length - 1] });
    }
}
function nbDecoyEnd(d) { // it fades, or is struck: Smoke and Mirrors leaves a puff
    if (d.ghost) d.ghost.life = 0;
    if (hasTalent('nb_mirage_burst')) nbPuff(d.x, d.y, 60, 2);
}
function updateDecoys(dt) {
    for (let i = nb.decoys.length - 1; i >= 0; i--) {
        const d = nb.decoys[i];
        let struck = false;
        for (let j = projectiles.length - 1; j >= 0; j--) { const p = projectiles[j]; if (p.isEnemy && Math.hypot(p.x - d.x, p.y - d.y) < 22 + p.radius) { projectiles.splice(j, 1); struck = true; break; } }
        if (struck || (d.t -= dt) <= 0) { nb.decoys.splice(i, 1); nbDecoyEnd(d); continue; }
        for (const e of enemies) { // idle non-bosses go for the nearest shadow (never cut an attack wind-up short)
            if (e.dead || e.pod || e.prop || isBossE(e) || (e.state && e.state !== 'idle') || Math.hypot(e.x - d.x, e.y - d.y) > 400) continue;
            if (e.tauntTimer > 0 && e.tauntX !== d.x && Math.hypot(e.x - e.tauntX, e.y - e.tauntY) < Math.hypot(e.x - d.x, e.y - d.y)) continue;
            e.tauntTimer = 0.3; e.tauntX = d.x; e.tauntY = d.y;
        }
        if (hasTalent('nb_mirage_stab') && (d.stab -= dt) <= 0) { // Phantom Blades
            d.stab += MIRAGE_STAB;
            for (const e of enemies) if (!e.dead && !e.pod && Math.hypot(e.x - d.x, e.y - d.y) < 60 + e.size / 2) { applyDamage(e, calcDmg(activeClass.basicDmg) * 0.5, 'melee'); effects.push({ type: 'shadow_cut', x: e.x, y: e.y, angle: Math.atan2(e.y - d.y, e.x - d.x), radius: e.size * 0.5 + 12, life: 0.25, maxLife: 0.25 }); }
        }
    }
}
// Switcheroo: a Phantom Dash that lands on a shadow swaps you with it; you vanish for 1 s and your next hit is a weak point
function nbSwap(x0, y0) {
    if (!hasTalent('nb_mirage_swap')) return;
    const d = nb.decoys.find(d => Math.hypot(d.x - player.x, d.y - player.y) < 80); if (!d) return;
    d.x = x0; d.y = y0; if (d.ghost) { d.ghost.x = x0; d.ghost.y = y0; }
    nb.vanish = 1; nb.ambush = true; nbPuff(player.x, player.y, 70, 1.2);
    effects.push({ type: 'text', text: 'SWITCHEROO', x: player.x, y: player.y - 40, color: '#b388ff', life: 0.8, maxLife: 0.8 });
}
const nbHidden = () => nb.vanish > 0; // main.js: enemies lose you
function nbAmbushHit(source) { // combat.js weakPointDamage: Switcheroo's free weak point
    if (!nb.ambush || activeClass.name !== 'Nightblade' || !['melee_basic', 'phantom_dash', 'assassin_skill', 'death_mark'].includes(source)) return false;
    nb.ambush = false; return true;
}

// ---------- Space: Phantom Dash ----------

function nbDash(sk, dmg) {
    if (sk.selectedUpg === 'B' && nb.ret) return nbDashTo(sk, dmg, nb.ret.x0, nb.ret.y0, true); // Shadow Return: back the way you came
    const [dx, dy, dist] = getVector(player.x, player.y, mouseX, mouseY), reach = DASH_REACH + (hasTalent('nb_dash_far') ? 100 : 0), d = Math.min(dist, reach);
    if (sk.selectedUpg === 'A' && fxTime - nb.lastReset > 3) nb.chain = 0; // the chain broke
    nbDashTo(sk, dmg, player.x + dx / (dist || 1) * d, player.y + dy / (dist || 1) * d, false);
}
function nbDashTo(sk, dmg, tx, ty, back) {
    const x0 = player.x, y0 = player.y, ang = Math.atan2(ty - y0, tx - x0), moveDist = Math.hypot(tx - x0, ty - y0), hitList = [], id = ++nb.dashId;
    const massacre = sk.selectedUpg === 'A' && nb.chain >= 2 && hasTalent('nb_reaper_storm');
    const trail = { type: 'dash_trail', x1: x0, y1: y0, x2: x0, y2: y0, color: '#9c27b0', width: 18, life: 0.35, maxLife: 0.35 };
    effects.push(trail);
    burst(x0, y0, 0, Math.PI * 2, 5, { kind: 'smoke', color: '#311b92', size: 6, grow: 26, life: 0.5, speed: [30, 90], drag: 3 });
    player.iFrames = 0.4;
    if (back) { // Shadow Return: Vanishing Act, Shadow Echo
        nb.ret = null;
        if (hasTalent('nb_return_smoke')) nbPuff(x0, y0, 80, 2);
        if (hasTalent('nb_return_echo')) enemies.filter(e => !e.dead && !e.pod && !e.submerged && Math.hypot(e.x - x0, e.y - y0) < 600)
            .sort((a, b) => Math.hypot(a.x - x0, a.y - y0) - Math.hypot(b.x - x0, b.y - y0)).slice(0, 3)
            .forEach(e => nbKnife(x0, y0, Math.atan2(e.y - y0, e.x - x0), calcDmg(activeClass.basicDmg) * 2));
    } else if (sk.selectedUpg === 'B') { // the way back stays open for a moment
        nb.ret = { x0, y0, t: hasTalent('nb_return_long') ? 3.5 : NB_RETURN_TIME, id };
        cooldowns.s3 = cooldownMax.s3 = devNoCooldowns ? 0 : 0.3;
    }
    const cut = (e, a, mult = 1) => {
        e.nbCutAt = fxTime; e.nbCutId = id; // before the hit: a cut that kills counts for Reaper's Chain
        applyDamage(e, dmg * mult, 'phantom_dash', a);
        effects.push({ type: 'shadow_cut', x: e.x, y: e.y, angle: a, radius: e.size * 0.6 + 16, life: 0.3, maxLife: 0.3 });
        if (e.dead) return;
        if (e.venom) burstVenom(e); // Venom Edge (Q B)
        if (back && hasTalent('nb_return_cross') && e.nbOutId === nb.lastOut) e.markAngle = Math.atan2(player.y - e.y, player.x - e.x); // Crossing Blades
        if (!back && sk.selectedUpg === 'B') e.nbOutId = id;
    };
    if (!back && sk.selectedUpg === 'B') nb.lastOut = id;
    const smoke = smokeStepStart(); // combos.js Smoke Step: dashing out of your own Smoke Bomb
    startDash({
        x: tx, y: ty, dur: 0.08 + moveDist / 6000, ease: 'out', kind: 'phantom_dash', trail,
        ghost: { color: '#b388ff', glow: true, every: 0.012, life: 0.22 },
        onStep: (ax, ay, bx, by) => {
            for (const e of enemies) {
                if (e.dead || hitList.includes(e) || distToSegment(e.x, e.y, ax, ay, bx, by) >= e.size / 2 + 20) continue;
                hitList.push(e); cut(e, ang);
                shadowStrike(e, ang); // combos.js: through the Marked target, an extra clone strike
            }
        },
        onArrive: () => {
            smokeStep(smoke); nbSwap(x0, y0);
            const x1 = player.x, y1 = player.y;
            if (hasTalent('nb_dash_twice')) after(0.15, () => { // Shadow Edge: the path is cut again
                for (const e of enemies) if (!e.dead && distToSegment(e.x, e.y, x0, y0, x1, y1) < e.size / 2 + 20) cut(e, ang, 0.6);
                effects.push({ type: 'dash_trail', x1: x0, y1: y0, x2: x1, y2: y1, color: '#ea80fc', width: 10, life: 0.25, maxLife: 0.25 });
            });
            if (massacre) { // Massacre: the third chained dash cuts everything near its path
                nb.chain = 0;
                for (const e of enemies) if (!e.dead && !hitList.includes(e) && distToSegment(e.x, e.y, x0, y0, x1, y1) < e.size / 2 + 120) cut(e, Math.atan2(e.y - y0, e.x - x0));
                effects.push({ type: 'holy_nova', x: x1, y: y1, radius: 140, color: '#ce93d8', life: 0.35, maxLife: 0.35 }); addShake(3);
            }
        },
    });
}

// ---------- R: Mark for Death ----------

function nbMark(sk, dmg) {
    const target = markForDeathTarget(), strikes = MFD_STRIKES + (hasTalent('nb_mfd_more') ? 2 : 0);
    buffs.deathMarkActive = calcUtility(5.0, sk.level) + (strikes - MFD_STRIKES) * MFD_GAP;
    buffs.markTarget = target; buffs.markDmg = dmg; buffs.shadowStrikes = 0; // combos.js Shadow Strike
    if (sk.selectedUpg === 'A' && hasTalent('nb_blood_cleanse')) { buffs.slowed = 0; buffs.rooted = 0; buffs.weakened = 0; buffs.evade100 = Math.max(buffs.evade100 || 0, 1); } // Second Skin
    effects.push({ type: 'death_mark_wave', x: target.x, y: target.y, radius: target.size / 2 + 90, life: 0.6, maxLife: 0.6 });
    effects.push({ type: 'text', text: 'MARKED FOR DEATH', x: target.x, y: target.y - target.size / 2 - 30, color: '#ce93d8', life: 1.0, maxLife: 1.0 });
    const st = { target, alt: null, left: strikes, total: strikes, n: 0 };
    after(0.2, () => mfdStrike(sk, dmg, st));
}
function mfdStrike(sk, dmg, st) {
    if (st.left <= 0) return;
    if (st.alt && st.alt.dead) st.alt = null;
    if (st.target.dead) {
        if (sk.selectedUpg !== 'B') return;
        const next = getNearestEnemyFromPoint(st.target.x, st.target.y, 300, [st.target]); // Chain Reaction: the mark jumps
        if (!next) return;
        st.target = next; buffs.markTarget = next;
        if (hasTalent('nb_chain_refresh')) st.left = st.total; // Endless Chain
        if (hasTalent('nb_chain_split')) st.alt = getNearestEnemyFromPoint(next.x, next.y, 300, [next]); // Doom Spiral
        effects.push({ type: 'text', text: 'MARKED', x: next.x, y: next.y - 40, color: '#ce93d8', life: 0.6, maxLife: 0.6 });
    }
    const t = st.alt && st.n % 2 ? st.alt : st.target;
    st.left--; st.n++;
    const markAng = Math.random() * Math.PI * 2; // a fresh weak side for every clone
    t.markAngle = markAng;
    const sx = t.x + Math.cos(markAng) * 200, sy = t.y + Math.sin(markAng) * 200, a = Math.atan2(t.y - sy, t.x - sx);
    effects.push({ type: 'clone_strike', x0: sx, y0: sy, x1: t.x + Math.cos(a) * 40, y1: t.y + Math.sin(a) * 40, angle: a, life: 0.4, maxLife: 0.4 });
    effects.push({ type: 'shadow_cut', x: t.x, y: t.y, angle: a, radius: t.size * 0.6 + 18, life: 0.3, maxLife: 0.3 });
    if (sk.selectedUpg === 'A') { nbHeal(0.02); if (hasTalent('nb_blood_frenzy')) nb.frenzy.push(fxTime + 6); } // Bloodlust, Frenzy of Shadows
    applyDamage(t, dmg * MFD_MULT * (st.left === 0 && sk.selectedUpg === 'A' && hasTalent('nb_blood_drain') ? 3 : 1), 'death_mark', a); // Exsanguinate
    after(MFD_GAP, () => mfdStrike(sk, dmg, st));
}
function nbHeal(frac) { // Bloodlust's heals; Crimson Ward keeps the overflow as a shield
    const amt = player.maxHp * frac, over = player.hp + amt - player.maxHp;
    player.hp = Math.min(player.maxHp, player.hp + amt);
    if (over > 0 && hasTalent('nb_blood_ward')) addShield(over, 4);
}
// combat.js checkEnemyDeath, Chain Reaction: a marked enemy explodes when it dies (Wider Blast, Marked Pack)
function nbChainBlast(e) {
    const R = hasTalent('nb_chain_wide') ? 220 : 150;
    effects.push({ type: 'circle', x: e.x, y: e.y, radius: R, color: 'rgba(156, 39, 176, 0.3)', life: 0.3, maxLife: 0.3 });
    for (const o of enemies) {
        if (o.dead || Math.hypot(e.x - o.x, e.y - o.y) > R + o.size / 2) continue;
        applyDamage(o, calcDmg(50, activeClass.skills[4].level), 'magic');
        if (hasTalent('nb_chain_mark') && !o.dead && o !== e) o.markAngle = Math.atan2(player.y - o.y, player.x - o.x);
    }
    const nearest = getNearestEnemyFromPoint(e.x, e.y, 300, [e]);
    if (nearest && nearest.markAngle === undefined) nearest.markAngle = Math.random() * Math.PI * 2;
}

// ---------- hooks ----------

window.SkillRegistry.Nightblade = Object.assign(window.SkillRegistry.Nightblade, { 1: nbFan, 2: nbSmoke, 3: nbDash, 4: nbMark });

function nbOnWeakPop(e) { // combat.js weakPointDamage
    if (nb.orbit && hasTalent('nb_orbit_ring')) nb.orbit.n = Math.min(NB_KNIFE_MAX, nb.orbit.n + 1); // Shadow Ring: a knife more
    if (e.venom && hasTalent('nb_venom_rupture')) burstVenom(e); // Rupture
}
function nbOnKill(e) { // talents.js talentsOnKill
    if (hasTalent('nb_toxic_plague') && e.inFumes > fxTime - 0.1) { // Plague Cloud
        const particles = Array.from({ length: 6 }, () => ({ xOffset: (Math.random() - 0.5) * 50, yOffset: (Math.random() - 0.5) * 50, r: 25 + Math.random() * 20, rotSpeed: (Math.random() - 0.5) * 1.5, startAng: Math.random() * Math.PI * 2 }));
        effects.push({ type: 'smoke_bomb', x: e.x, y: e.y, radius: 60, color: 'rgba(76, 175, 80, 0.7)', life: 3, maxLife: 3, poison: true, dmg: e.fumeDmg || 0, particles });
    }
    const sk = activeClass.skills[3];
    if (sk.selectedUpg === 'A' && e.nbCutAt && fxTime - e.nbCutAt <= (hasTalent('nb_reaper_window') ? 2 : 1) && nb.resetFor !== e.nbCutId) { // Reaper's Chain
        nb.resetFor = e.nbCutId; cooldowns.s3 = 0; nb.chain++; nb.lastReset = fxTime;
        if (hasTalent('nb_reaper_rush')) { nb.rush.push(fxTime + 3); if (nb.rush.length > 3) nb.rush.shift(); } // Bloodrush
        if (hasTalent('nb_reaper_heal')) player.hp = Math.min(player.maxHp, player.hp + player.maxHp * 0.04); // Harvest
        effects.push({ type: 'text', text: 'RESET', x: player.x, y: player.y - 44, color: '#ea80fc', life: 0.6, maxLife: 0.6 });
    }
}
function nbPower() { // combat.js powerParts: Bloodrush (+15 each) and Frenzy of Shadows (+5 each)
    nb.rush = nb.rush.filter(t => t > fxTime); nb.frenzy = nb.frenzy.filter(t => t > fxTime);
    return [nb.rush.length * 0.15, nb.frenzy.length * 0.05];
}
function nbDamageTaken(amount) { return nb.orbit && hasTalent('nb_orbit_ring') ? amount * 0.75 : amount; } // talents.js: Shadow Ring

function updateNightblade(dt) { // main.js update
    if (activeClass.name !== 'Nightblade') return;
    updateBladeOrbit(dt); updateDecoys(dt);
    if (nb.vanish > 0) nb.vanish -= dt;
    if (nb.ret && (nb.ret.t -= dt) <= 0) { nb.ret = null; cooldowns.s3 = cooldownMax.s3 = nbFull(3); } // never came back: the full cooldown now
    for (let i = nb.venomed.length - 1; i >= 0; i--) {
        const e = nb.venomed[i], v = e.venom;
        if (!v || e.dead || (v.t -= dt) <= 0) { e.venom = null; nb.venomed.splice(i, 1); continue; }
        if (hasTalent('nb_venom_deep')) applyDamage(e, v.n * calcDmg(activeClass.basicDmg) * 0.1 * dt, 'dot'); // Deep Venom
    }
    for (const e of enemies) if (e.toxicLinger && !e.dead && e.inFumes < fxTime - 0.05) { // Lingering Haze, out of the cloud
        applyDamage(e, e.toxicLinger.dmg * dt, 'dot');
        if ((e.toxicLinger.t -= dt) <= 0) e.toxicLinger = null;
    }
}
function drawNightblade() { // main.js draw: the orbiting knives, venom pips
    if (activeClass.name !== 'Nightblade') return;
    const o = nb.orbit, c = ctx;
    if (o) {
        const R = nbOrbitR();
        c.fillStyle = '#e1bee7';
        for (let k = 0; k < o.n; k++) {
            const a = o.ang + k * Math.PI * 2 / o.n, x = player.x + Math.cos(a) * R, y = player.y + Math.sin(a) * R;
            c.save(); c.translate(x, y); c.rotate(a + Math.PI / 2);
            c.beginPath(); c.moveTo(12, 0); c.lineTo(-6, -3); c.lineTo(-6, 3); c.closePath(); c.fill(); c.restore();
        }
        c.save(); c.globalAlpha = 0.25; c.strokeStyle = '#b388ff'; c.lineWidth = 2; c.beginPath(); c.arc(player.x, player.y, R, 0, Math.PI * 2); c.stroke(); c.restore();
    }
    for (const e of nb.venomed) {
        if (!e.venom || e.dead) continue;
        for (let k = 0; k < e.venom.n; k++) { c.fillStyle = '#76ff03'; c.beginPath(); c.arc(e.x - (e.venom.n - 1) * 5 + k * 10, e.y - e.size / 2 - 14, 3.5, 0, Math.PI * 2); c.fill(); }
    }
    if (nb.ret) { c.save(); c.globalAlpha = 0.5; c.strokeStyle = '#b388ff'; c.lineWidth = 2; c.setLineDash([6, 6]); c.beginPath(); c.moveTo(player.x, player.y); c.lineTo(nb.ret.x0, nb.ret.y0); c.stroke(); c.restore(); }
}
