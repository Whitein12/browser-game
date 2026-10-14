// ==========================================
// skills.js - Class Abilities & Attacks
// ==========================================

// Every attack-speed source, as one bonus (+0.3 = 30% faster). The Tab sheet (hud.js) shows the same number.
function attackSpeedBonus() {
    let bonus = equipment.gloves ? equipment.gloves.val : 0;
    if (activeClass.name === 'Kensei' && player.stance === 'airborne') bonus += (player.flow / player.maxFlow) * 0.5; // up to +50% in airborne
    if (activeClass.name === 'Dragonknight') bonus += player.frenzyStacks * 0.02; // Frenzy: +2% per stack
    if (buffs.focus > 0 && hasTalent('focus_haste')) bonus += 0.3; // Ranger Hunter's Focus, Steady Rhythm (talents.js)
    return bonus;
}

// heavy: the Dragonknight's charge (0..1) for a held swing, or null for a light one.
// combo: an open Space finisher window (combos.js), spent by this attack; the Dragonknight passes the one its swing started in.
function castBasic(heavy = null, combo = takeCombo()) {
    const ANIM_LOCK = 0.15;
    cooldowns.basic = devNoCooldowns ? 0 : heavy !== null ? SLAM_RECOVER : ANIM_LOCK + activeClass.basicAttackCD / (1.0 + attackSpeedBonus()); // attack speed comes from gloves and class stacks; CDR is for skills
    cooldownMax.basic = cooldowns.basic;
    let dmg = calcDmg(activeClass.basicDmg, 1);
    
    let isResonance = false;
    if (activeClass.name === 'Spellweaver') {
        const free = spellthreadCharge(); // items.js: every 5th bolt with the Spellthread Gloves
        if (free || player.arcaneResonance > 0) { // spend one stored Resonance charge
            isResonance = true;
            if (!free) player.arcaneResonance--;
            dmg *= RESONANCE_MULT;
        }
    }

    let finisher = combo ? COMBO_FINISHERS[activeClass.name] : null; // combos.js
    if (finisher && !comboPressOk(combo)) { comboOpen = combo; finisher = null; } // a button held since before Space: a plain attack, the window stays open
    const replaced = finisher ? finisher(dmg, heavy, combo, isResonance) : false;
    const fired = finisher && comboOpen !== combo; // a finisher can hand the window back by restoring comboOpen
    if (fired) comboText();
    if (!replaced) window.BasicAttackRegistry[activeClass.weapon](dmg, isResonance, heavy);
    onBasicAttack(heavy, fired); // weapons.js: swing animation and firing effects
    if (typeof updateHUD === "function") updateHUD();
}

// Dragonknight greatsword (main.js update, in place of the auto-repeating basic): tap LMB for a quick light swing,
// hold it to raise the blade for an overhead slam, and let go to strike. The charge fills faster with attack speed and a full
// one waits for the release (it used to fly by itself when full, which made timing Rebound, combos.js, nearly impossible).
// A full slam deals x3.5, shakes the ground and staggers.
const SLAM_TAP = 0.15, SLAM_CHARGE = 0.8, SLAM_FULL = 3.5, SLAM_RECOVER = 0.25, SLAM_SLOW = 0.8;
let lmbClicked = false; // main.js mousedown: a click during the swing cooldown still swings once it ends
function heavyCharge() { return player.heavy ? clamp01((player.heavy.t - SLAM_TAP) / (SLAM_CHARGE - SLAM_TAP)) : 0; }
function updateHeavySwing(dt) {
    const h = player.heavy;
    if (h) {
        h.raw += dt; h.t += dt * (1 + attackSpeedBonus());
        // a combo window counts if the swing started in it, or opened while the blade was up (a leap mid-charge)
        if (!isMouseDown) { player.heavy = null; castBasic(h.raw < SLAM_TAP ? null : clamp01((h.t - SLAM_TAP) / (SLAM_CHARGE - SLAM_TAP)), h.combo || takeCombo()); }
    } else if (cooldowns.basic <= 0 && !player.charge && !comboInFlight() && (isMouseDown || lmbClicked)) { // combos.js: a click mid-leap waits for the landing
        lmbClicked = false;
        if (isMouseDown) player.heavy = { t: 0, raw: 0, combo: takeCombo() }; else castBasic(null); // the click was already let go: a light swing
    }
}

// Dragonknight E, Dragonfire Blade: for 6 s the basics deal +50% (+10% per rank), reach 30 px farther and set what they hit burning
const DRAGONFIRE_TIME = 6.0, DRAGONFIRE_REACH = 30;
function dragonfireBonus() { return calcUtility(0.5, activeClass.skills[2].level); }
function igniteEnemy(e, dps) { // 3 s of burning (main.js); a fresh burn refreshes, the stronger one wins while both burn
    e.burnDps = e.burnTimer > 0 ? Math.max(e.burnDps || 0, dps) : dps; e.burnTimer = 3.0; e.burnColor = '#ff7043';
}

// Spellweaver weave: every spell stores a Resonance charge; each basic spends one as an empowered, exploding bolt,
// and an empowered bolt that hits gives back cooldown on Q, E and Space (main.js), so weaving feeds itself.
const RESONANCE_MAX = 3, RESONANCE_MULT = 1.8, RESONANCE_RADIUS = 80, WEAVE_REFUND = 0.25; // x1.8 (was x2): Blink Lance (combos.js) pays for it
function addResonance(n) { player.arcaneResonance = Math.min(resonanceMax(), (player.arcaneResonance || 0) + n); } // items.js: the Orb of Echoes holds 4
function weaveRefund() { for (let i = 1; i <= 3; i++) cooldowns[`s${i}`] = Math.max(0, cooldowns[`s${i}`] - WEAVE_REFUND); }

const STORM_CHARGE_TIME = 1.2, STORM_RANGE = 1000, STORM_STRIKE_DELAY = 0.4; // Ranger Storm Arrow (Q, below)
const VOLLEY_FALLOFF = 0.4; // Ranger Volley: arrows after the first on the same enemy deal 40%
const RAY_ZEAL_MULT = [0.5, 1, 1.75, 2.5]; // Cleric Divine Ray damage by the Zeal it spends: under 10 / 10 / 50 / 100 (the x2.25 trim for Radiant Burst was undone)
const REAPER_DRAIN = 0.04; // Aspect of the Reaper: max HP drained per second (casting is free)
const MFD_STRIKES = 6, MFD_GAP = 0.5, MFD_MULT = 0.6, MFD_RANGE = 600; // Nightblade Mark for Death (R)
// Mark for Death's target: the enemy nearest the cursor (within 150 px of it), else the one nearest you, within 600 px
function markForDeathTarget() {
    const ok = e => !e.dead && !e.pod && !e.submerged && !e.invulnerable && !(e.spawnT > 0) && !(e.flyUntil > fxTime) && Math.hypot(e.x - player.x, e.y - player.y) <= MFD_RANGE + e.size / 2;
    let best = null, bd = 150;
    for (const e of enemies) { if (!ok(e)) continue; const d = Math.hypot(e.x - mouseX, e.y - mouseY) - e.size / 2; if (d < bd) { bd = d; best = e; } }
    if (best) return best;
    bd = Infinity;
    for (const e of enemies) { if (!ok(e)) continue; const d = Math.hypot(e.x - player.x, e.y - player.y); if (d < bd) { bd = d; best = e; } }
    return best;
}

// Kensei Airborne blade hit (main.js): Flow adds up to +50%, Empowered x1.25. Steered hits land ~12/s, so they hit light
// Razor's Edge (high risk, high reward): Flow adds up to +150% damage (was +50%) to the slashes and the blade, and every hit
// you take costs 25 Flow (10 with the Ronin's Silk Shroud; combat.js takeDamage)
const BLADE_STEER_MULT = 0.4, BLADE_FLOW_BONUS = 1.5, BLADE_EMPOWER = 1.25, EDGE_FLOW_LOSS = 25, EDGE_SHROUD_LOSS = 10;
function bladeAttackSpeed() { return hasItem('Aether Grips') ? 1 + equipment.gloves.val : 1; } // the Aether Grips quicken the airborne blade too
function bladeHitDmg(mult) { return calcDmg(activeClass.basicDmg) * mult * (1 + BLADE_FLOW_BONUS * player.flow / player.maxFlow) * (player.empoweredAirborne ? BLADE_EMPOWER : 1); }

// Ranger aim assist: the enemy nearest the cursor (within 70 px of it) becomes the arrow's target,
// and steerShot curves the arrow toward it a little each frame. Aiming the wrong way still misses.
function aimAssistTarget() {
    let best = null, bestD = Infinity;
    for (const e of enemies) {
        if (e.dead || e.pod || e.spawnT > 0 || (e.flyUntil && fxTime < e.flyUntil)) continue;
        const d = Math.hypot(e.x - mouseX, e.y - mouseY) - e.size / 2;
        if (d < 70 && d < bestD) { bestD = d; best = e; }
    }
    return best;
}
function steerShot(p, dt) {
    const t = p.homeTarget;
    if (t.dead) { p.homeTarget = null; return; }
    const cur = Math.atan2(p.vy, p.vx), want = Math.atan2(t.y - p.y, t.x - p.x);
    const diff = Math.atan2(Math.sin(want - cur), Math.cos(want - cur));
    if (Math.abs(diff) > Math.PI / 2) { p.homeTarget = null; return; } // flew past it: let it go
    const a = cur + Math.max(-5 * dt, Math.min(5 * dt, diff)), spd = Math.hypot(p.vx, p.vy); // turns at most 5 rad/s
    p.vx = Math.cos(a) * spd; p.vy = Math.sin(a) * spd;
}

// Rank effects for skills whose ranks would otherwise do nothing (the level-up cards read these too, ui.js RANK_STATS)
function vaultReach(sk) { return 300 + 40 * (Math.max(1, sk.level) - 1) + (hasTalent('vault_far') ? 80 : 0); } // Ranger Vault: 300 → 420 px (talents.js Long Strides +80)
function shadowStepReach(level) { return 300 + 40 * (level - 1) + (hasItem('Windwalker Steps') ? 100 : 0); } // Kensei Shadow Step: 300 → 420 px
function grappleMissPenalty(level) { return Math.max(0, 2.5 - 0.5 * level); }                  // Machinist: +2 → +0.5 s for grappling open ground
const FLOW_GRACE = 3, FLOW_DECAY = 8; // Kensei in hand (main.js): Flow holds 3 s after the last gain, then fades 8/s (was 1.5 s and 15/s: dodging a crowd drained the bar before the blade could go out)
function airborneDrain(level) { return 1 - 0.1 * (Math.max(1, level) - 1); }                    // Kensei E: the airborne blade drains Flow 10% slower per rank

// Dragonknight Shield Throw: the shield came back to hand (main.js), for a shield. Molten Aegis's Flashpoint sets its trail off.
function catchShield(sk, p) {
    const level = sk ? sk.level : 1;
    addShield(calcUtility(50, level), calcUtility(5.0, level)); // combat.js: capped
    if (p && p.trail && hasTalent('molten_flash')) flashpoint(p.trail, p.damage);
    effects.push({ type: 'circle_burst', x: player.x, y: player.y, radius: 40, color: 'rgba(224, 224, 224, 0.8)', life: 0.25, maxLife: 0.25 });
    burst(player.x, player.y, 0, Math.PI * 2, 8, { kind: 'spark', color: '#e0e0e0', size: 2, life: 0.25, speed: [120, 280], drag: 6 });
    updateHUD();
}

// Shield Throw A, Molten Aegis: the white-hot shield leaves dragonfire along its whole path, out and back. One effect holds the
// whole line (points dropped every 30 px, each burning for its own time), so a long throw costs one effect, not dozens of puddles.
// talents.js: Slag slows, Searing Path burns longer and hotter, Dragon's Wake is twice as wide and sets what crosses it burning.
const MOLTEN_DPS = 0.4, MOLTEN_TIME = 3, MOLTEN_W = 24;
function moltenTrail(p) {
    const sear = hasTalent('molten_sear'), wake = hasTalent('molten_wake');
    const tr = { type: 'molten_trail', pts: [], shield: p, life: 99, maxLife: 99, dur: sear ? 5 : MOLTEN_TIME, w: wake ? MOLTEN_W * 2 : MOLTEN_W,
        dps: p.damage * MOLTEN_DPS * (sear ? 1.5 : 1), slow: hasTalent('molten_slag') ? 0.4 : 0, ignite: wake ? p.damage * 0.3 : 0,
        customUpdate: (dt, ef) => {
            const s = ef.shield, live = s && projectiles.includes(s), last = ef.pts[ef.pts.length - 1];
            if (live && (!last || Math.hypot(s.x - last.x, s.y - last.y) >= 24)) {
                // on its way home it runs back along the line it drew: no second line over the first, only where it strays (brk: a new piece)
                if (s.returning && ef.pts.some(q => Math.hypot(q.x - s.x, q.y - s.y) < ef.w * 0.8)) ef.gap = true;
                else { ef.pts.push({ x: s.x, y: s.y, t: fxTime, brk: !last || !!ef.gap }); ef.gap = false; }
            }
            while (ef.pts.length && fxTime - ef.pts[0].t > ef.dur) ef.pts.shift();
            ef.life = live || ef.pts.length ? 99 : 0;
            if (ef.pts.length < 2) return;
            if (Math.random() < dt * 6) { const q = ef.pts[(Math.random() * ef.pts.length) | 0]; spawnParticle({ kind: 'dot', color: '#ffab40', x: q.x + jitter(ef.w * 0.6), y: q.y + jitter(ef.w * 0.6), vx: jitter(15), vy: -30 - Math.random() * 40, size: 1.6, life: 0.5, drag: 1, grow: 0, spin: 0, rot: 0 }); }
            for (const e of enemies) {
                if (e.dead || e.pod || e.submerged) continue;
                let inside = false;
                for (let i = 1; i < ef.pts.length && !inside; i++) inside = !ef.pts[i].brk && distToSegment(e.x, e.y, ef.pts[i - 1].x, ef.pts[i - 1].y, ef.pts[i].x, ef.pts[i].y) <= ef.w + e.size / 2;
                if (!inside) continue;
                applyDamage(e, ef.dps * dt, 'dot');
                if (ef.slow && !(e.slowTimer > 0 && e.slowAmount > ef.slow)) { e.slowTimer = Math.max(e.slowTimer || 0, 0.4); e.slowAmount = ef.slow; }
                if (ef.ignite && !e.dead) igniteEnemy(e, ef.ignite);
            }
        } };
    p.trail = tr; effects.push(tr);
}
// Flashpoint (talents.js): the catch sets the trail off, from its far end back to the hero
function flashpoint(tr, dmg) {
    const pts = tr.pts.filter((_, i) => i % 3 === 0).sort((a, b) => Math.hypot(b.x - player.x, b.y - player.y) - Math.hypot(a.x - player.x, a.y - player.y));
    tr.pts = []; tr.shield = null; // the line is spent
    pts.forEach((q, i) => after(0.035 * i, () => {
        effects.push({ type: 'fiery_explosion', x: q.x, y: q.y, radius: tr.w + 36, life: 0.35, maxLife: 0.35 });
        for (const e of enemies) if (!e.dead && !e.pod && Math.hypot(e.x - q.x, e.y - q.y) <= tr.w + 36 + e.size / 2) applyDamage(e, dmg, 'magic');
    }));
    if (pts.length) addShake(2.5);
}

// Shield Throw B, Hunting Shield: the shield lodges in the first enemy it hits on the way out and grinds it for 2.5 s, then
// comes home; a full slam on that enemy (the 'sword' basic) rips it free first, for triple damage and a burst around it.
// talents.js: Serrated Edge grinds twice as often, Marked Prey (talentDmgMult), Tear Free stuns and refunds, Relentless Hunt
// sends it on to a second prey (p.lodges counts them).
const LODGE_TIME = 2.5, GRIND_GAP = 0.5, GRIND_MULT = 0.5, RIP_MULT = 3, RIP_R = 100;
function lodgeShield(p, e) {
    p.lodged = { e, t: LODGE_TIME, tick: GRIND_GAP }; p.lodges = (p.lodges || 0) + 1; p.homeTarget = null;
    p.vx = p.vy = 0; e.lodgedShield = p;
    burst(e.x, e.y, 0, Math.PI * 2, 8, { kind: 'spark', color: '#e0e0e0', size: 2.5, life: 0.3, speed: [140, 320], drag: 5 });
    addShake(1.5);
}
function updateLodged(p, dt) { // main.js shield update, while it's lodged
    const L = p.lodged, e = L.e;
    if (e.dead || !enemies.includes(e) || (L.t -= dt) <= 0) { releaseShield(p); return; }
    p.x = e.x; p.y = e.y; p.life = Math.max(p.life, 1.5); // it can't run out (or turn home) while it's in there
    if ((L.tick -= dt) <= 0) {
        L.tick = hasTalent('hunt_serrated') ? GRIND_GAP / 2 : GRIND_GAP;
        applyDamage(e, p.damage * GRIND_MULT, 'melee');
        burst(e.x, e.y, Math.random() * Math.PI * 2, 1.2, 4, { kind: 'spark', color: '#fff3e0', size: 2, life: 0.22, speed: [120, 260], drag: 6 });
    }
}
function releaseShield(p) {
    const e = p.lodged && p.lodged.e;
    if (e && e.lodgedShield === p) e.lodgedShield = null;
    p.lodged = null; p.returning = true; p.hitList = [];
}
function ripShield(p, e) { // the 'sword' basic: a full slam tore it out
    releaseShield(p);
    applyDamage(e, p.damage * RIP_MULT, 'melee');
    effects.push({ type: 'shield_blast', x: e.x, y: e.y, radius: RIP_R, life: 0.35, maxLife: 0.35 });
    for (const o of enemies) if (o !== e && !o.dead && !o.pod && Math.hypot(o.x - e.x, o.y - e.y) <= RIP_R + o.size / 2) applyDamage(o, p.damage, 'melee');
    addShake(3);
    if (hasTalent('hunt_tear')) { if (!e.dead) e.stunTimer = Math.max(e.stunTimer || 0, 1.5); cooldowns.s1 *= 0.5; }
    if (hasTalent('hunt_relentless') && p.lodges < 2) { // on to the next prey, steering after it (main.js steerShot)
        let next = null, bd = 350;
        for (const o of enemies) { if (o === e || o.dead || o.pod || o.submerged) continue; const d = Math.hypot(o.x - p.x, o.y - p.y); if (d < bd) { bd = d; next = o; } }
        if (next) { const a = Math.atan2(next.y - p.y, next.x - p.x); p.returning = false; p.homeTarget = next; p.hitList = [e]; p.vx = Math.cos(a) * 900; p.vy = Math.sin(a) * 900; p.life = 2.0; }
    }
}

// Thunder Leap A, Gravity Slam: the landing pulls everything within 260 px into the impact point (bosses only tugged 60 px) and
// staggers it. talents.js: Event Horizon reaches farther, Implosion claps again in the middle, Crushing Weight stuns, Singularity
// leaves a well that keeps pulling for 3 s.
const GRAV_R = 260, GRAV_WIDE = 340, GRAV_PULL_TIME = 0.2, GRAV_WELL_R = 220;
function gravitySlam(x, y, dmg) {
    const R = hasTalent('grav_horizon') ? GRAV_WIDE : GRAV_R, caught = [];
    for (const e of enemies) {
        if (e.dead || e.pod || e.submerged) continue;
        const d = Math.hypot(e.x - x, e.y - y);
        if (d < 1 || d > R + e.size / 2) continue;
        const boss = e.type.startsWith('boss'), keep = Math.min(d, boss ? Math.max(e.size / 2 + 30, d - 60) : e.size / 2 + 22 + Math.random() * 24); // never pushed outward
        caught.push({ e, x0: e.x, y0: e.y, x1: x + (e.x - x) / d * keep, y1: y + (e.y - y) / d * keep });
        if (!boss) e.stunTimer = Math.max(e.stunTimer || 0, hasTalent('grav_heavy') ? 1.2 : 0.5);
    }
    effects.push({ type: 'gravity_pull', x, y, radius: R, life: 0.45, maxLife: 0.45, customUpdate: (dt, ef) => {
        const q = easeOut(Math.min(1, (ef.maxLife - ef.life) / GRAV_PULL_TIME));
        for (const c of caught) if (!c.e.dead) { c.e.x = lerp(c.x0, c.x1, q); c.e.y = lerp(c.y0, c.y1, q); clampToBounds(c.e, c.e.size / 2); }
    } });
    if (caught.length) addShake(2);
    if (hasTalent('grav_implode')) after(0.3, () => {
        effects.push({ type: 'thunder_slam', x, y, radius: 130, color: '#b388ff', big: true, life: 0.5, maxLife: 0.5 });
        for (const e of enemies) if (!e.dead && !e.pod && Math.hypot(e.x - x, e.y - y) <= 130 + e.size / 2) applyDamage(e, dmg, 'melee');
    });
    if (hasTalent('grav_singularity')) effects.push({ type: 'gravity_well', x, y, radius: GRAV_WELL_R, life: 3, maxLife: 3, customUpdate: dt => {
        for (const e of enemies) {
            if (e.dead || e.pod || e.type.startsWith('boss')) continue;
            const d = Math.hypot(e.x - x, e.y - y);
            if (d > 12 && d <= GRAV_WELL_R + e.size / 2) { const st = Math.min(d - 12, 150 * dt); e.x += (x - e.x) / d * st; e.y += (y - e.y) / d * st; clampToBounds(e, e.size / 2); }
        }
    } });
}

// Thunder Leap B, Meteor Dive: Space held (main.js startCharge) lifts the knight into the air to hang, untouchable, while the
// cursor steers the landing (a reticle on the ground, skillfx_space.js); letting go (or running out of breath) dives. The
// longer the hang, the harder and wider the slam: up to x2.5 and 200 px. talents.js: Thin Air hangs longer, Comet Trail burns,
// Impact Crater widens, Starfall calls three more meteors after a full dive. Dragon Breath pressed while hanging is a Wyrmfall.
const HANG_MAX = 1.5, HANG_AIR = 2.5, HANG_Z = 150, DIVE_MULT = 2.5, DIVE_GROW = 80, DIVE_CRATER = 140;
function startHang() {
    player.hang = { t: 0, max: hasTalent('dive_air') ? HANG_AIR : HANG_MAX };
    dustPuff(player.x, player.y, 0, Math.PI * 2, 8);
    effects.push({ type: 'meteor_mark', life: 1, maxLife: 1, customUpdate: (dt, ef) => { ef.life = player.hang ? 1 : 0; } });
    return { max: player.hang.max, slow: 0 };
}
function updateHang(dt) { // main.js update
    const h = player.hang;
    if (!player.charge || player.charge.slot !== 3) { player.hang = null; player.z = 0; return; } // the hold was lost (a blur, a cutscene)
    h.t += dt;
    player.z = HANG_Z * easeOut(Math.min(1, h.t / 0.35));
    player.iFrames = Math.max(player.iFrames, 0.1);
    if (h.t >= h.max) releaseCharge(3); // out of breath: it dives by itself
}
function leapReach() { return (hasItem('Thunderstride Greaves') ? 500 : 400) + (hasTalent('leap_far') ? 100 : 0); } // items.js; talents.js Great Leap
function meteorTarget() {
    const [dx, dy, d] = getVector(player.x, player.y, mouseX, mouseY), m = Math.min(d, leapReach());
    return d > 0 ? [player.x + dx / d * m, player.y + dy / d * m] : [player.x, player.y];
}
function diveRadius(k) { return (hasTalent('leap_wide') ? 165 : 120) + (hasTalent('dive_crater') ? DIVE_CRATER : DIVE_GROW) * k; }
function starfall(x, y, dmg) { // Starfall: three more meteors round a full dive
    for (let i = 0; i < 3; i++) after(0.22 + 0.13 * i, () => {
        const a = Math.random() * Math.PI * 2, r = 90 + Math.random() * 90, mx = x + Math.cos(a) * r, my = y + Math.sin(a) * r;
        effects.push({ type: 'wyrmfall_pillar', x: mx, y: my, frost: false, life: 0.4, maxLife: 0.4 }); // skillfx_ult.js
        effects.push({ type: 'thunder_slam', x: mx, y: my, radius: 95, color: '#ffab40', life: 0.45, maxLife: 0.45 });
        for (const e of enemies) if (!e.dead && !e.pod && Math.hypot(e.x - mx, e.y - my) <= 95 + e.size / 2) applyDamage(e, dmg, 'melee');
        addShake(2);
    });
}
// Sundering Breath (Dragon Breath B): the flames crack open whatever they touch: +20% damage from you for 6 s (talents.js
// Deep Wounds: +30%, 8 s; talentDmgMult reads it). Bandit shields and Slime Warden orbs still shatter. Wyrmfall's rings Sunder too.
const SUNDER_MULT = 0.2, SUNDER_TIME = 6, SUNDER_DEEP_MULT = 0.3, SUNDER_DEEP_TIME = 8;
function sunderEnemy(e) {
    shatterShields(e); // combat.js
    const deep = hasTalent('sunder_deep');
    e.sunderUntil = fxTime + (deep ? SUNDER_DEEP_TIME : SUNDER_TIME); e.sunderMult = 1 + (deep ? SUNDER_DEEP_MULT : SUNDER_MULT);
}
// Dragon's Roar (talents.js): the Sundering breath ends in a roar that throws everything back
function dragonRoar() {
    effects.push({ type: 'thunder_slam', x: player.x, y: player.y, radius: 300, color: '#ff7043', big: true, life: 0.6, maxLife: 0.6 });
    effects.push({ type: 'text', text: 'ROAR', x: player.x, y: player.y - 60, color: '#ffab40', life: 1.0, maxLife: 1.0 });
    addShake(4);
    for (const e of enemies) {
        if (e.dead || e.pod || Math.hypot(e.x - player.x, e.y - player.y) > 300 + e.size / 2) continue;
        if (e.type.startsWith('boss')) { const a = Math.atan2(e.y - player.y, e.x - player.x); e.x += Math.cos(a) * 40; e.y += Math.sin(a) * 40; clampToBounds(e, e.size / 2); }
        else { knockFrom(e, player.x, player.y, 120); e.stunTimer = Math.max(e.stunTimer || 0, 1.0); }
    }
}

// ---------- Ranger evolutions (talents.js has the nodes under them) ----------

// Storm Arrow A, Ballista Shot: a full draw hurls everything on the line back along it over 0.22 s (bosses only 40 px). Whatever
// is stopped on the way (a wall, a pillar, the map's edge) has been slammed: stunned 1.5 s (Pinned 2.5), hit again (Crushing
// Impact). Domino: a hurled body knocks whoever it runs into along, half as far, and stuns them 1 s.
const BALLISTA_PUSH = 220, BALLISTA_FAR = 320, BALLISTA_STUN = 1.5, BALLISTA_PIN = 2.5, BALLISTA_TIME = 0.22;
function ballistaPush(list, ang, hit) {
    const D = hasTalent('ballista_far') ? BALLISTA_FAR : BALLISTA_PUSH, cx = Math.cos(ang), cy = Math.sin(ang);
    const movers = list.filter(e => !e.dead && !e.pod).map(e => ({ e, x0: e.x, y0: e.y, d: e.type.startsWith('boss') ? 40 : D, t: 0 }));
    const slam = m => {
        m.done = true; const e = m.e;
        e.stunTimer = Math.max(e.stunTimer || 0, hasTalent('ballista_pin') ? BALLISTA_PIN : BALLISTA_STUN);
        if (hasTalent('ballista_crush')) applyDamage(e, hit, 'ranged');
        effects.push({ type: 'circle_burst', x: e.x, y: e.y, radius: e.size / 2 + 26, color: 'rgba(200, 230, 201, 0.85)', life: 0.3, maxLife: 0.3 });
        dustPuff(e.x, e.y, ang + Math.PI, 2.4, 6); addShake(2);
    };
    effects.push({ type: 'ballista_push', life: BALLISTA_TIME + 0.3, maxLife: BALLISTA_TIME + 0.3, customUpdate: dt => {
        for (const m of movers) {
            if (m.done || m.e.dead) continue;
            m.t = Math.min(1, m.t + dt / BALLISTA_TIME);
            const want = m.d * easeOut(m.t), tx = m.x0 + cx * want, ty = m.y0 + cy * want, e = m.e;
            const clip = clipToWalls(e.x, e.y, tx, ty, e.size / 2, false); // stage.js: rock on the way
            if (clip) { e.x = clip[0]; e.y = clip[1]; } else { e.x = tx; e.y = ty; }
            clampToBounds(e, e.size / 2);
            if (clip || Math.hypot(e.x - tx, e.y - ty) > 10) { slam(m); continue; }
            if (hasTalent('ballista_domino') && m.d > 40) for (const o of enemies) { // Domino
                if (o === e || o.dead || o.pod || movers.some(n => n.e === o) || Math.hypot(o.x - e.x, o.y - e.y) > (o.size + e.size) / 2) continue;
                o.stunTimer = Math.max(o.stunTimer || 0, 1.0);
                movers.push({ e: o, x0: o.x, y0: o.y, d: o.type.startsWith('boss') ? 0 : (m.d - want) * 0.5 + 40, t: 0 });
            }
            if (m.t >= 1) m.done = true;
        }
    } });
}

// Storm Arrow B, Hunter's Mark: the prey is Marked for 6 s (Long Hunt 10): basic arrows curve to it (the 'bow' basic) and deal
// x1.4 to it (main.js, preyHit). Open Wound: skills +20% (talentDmgMult). Pack Hunter: the Mark leaps on when it dies.
// Hunter's Harvest: every 5th basic arrow on it calls lightning (half of Storm Arrow's hit).
const MARK_TIME = 6, MARK_LONG = 10, MARK_BASIC = 1.4, HARVEST_EVERY = 5, HARVEST_MULT = 0.5;
function markPrey(e) {
    for (const o of enemies) if (o !== e) o.huntMarkUntil = 0;
    e.huntMarkUntil = fxTime + (hasTalent('mark_long') ? MARK_LONG : MARK_TIME); e.markHits = 0; player.prey = e;
    effects.push({ type: 'circle_burst', x: e.x, y: e.y, radius: e.size / 2 + 18, color: 'rgba(178, 255, 89, 0.8)', life: 0.3, maxLife: 0.3 });
}
function preyTarget() { const e = player.prey; return e && !e.dead && e.huntMarkUntil > fxTime && enemies.includes(e) ? e : null; }
function preyHit(p, e) { // main.js: a basic arrow loosed at the prey reached something; the multiplier for it
    if (p.markOn !== e || !(e.huntMarkUntil > fxTime)) return 1;
    if (hasTalent('mark_harvest') && ++e.markHits % HARVEST_EVERY === 0) after(0.05, () => {
        if (e.dead) return;
        const Q = activeClass.skills[1];
        effects.push({ type: 'lightning', x1: e.x + jitter(40), y1: e.y - 280, x2: e.x, y2: e.y, color: '#b2ff59', life: 0.25, maxLife: 0.25 });
        applyDamage(e, calcDmg(Q.baseDmg, Q.level) * HARVEST_MULT, 'magic');
    });
    return MARK_BASIC;
}
function rangerOnKill(e) { // talents.js talentsOnKill
    if (e === player.prey && hasTalent('mark_spread')) { const n = getNearestEnemyFromPoint(e.x, e.y, 400, [e]); if (n) markPrey(n); } // Pack Hunter
    if (activeClass.skills[3].selectedUpg === 'B' && player.vaultCharges < vaultMax()) { player.vaultCharges++; if (player.vaultCharges >= vaultMax()) player.vaultRecharge = 0; cooldowns.s3 = Math.min(cooldowns.s3, 0); } // Twin Vault
}

// Vault B, Twin Vault: two charges (Third Wind three); each comes back after Vault's cooldown, one at a time, and a kill gives
// one back at once. cooldowns.s3 shows the next charge only when none is left.
const VAULT_GAP = 0.25;
function vaultMax() { return hasTalent('tv_three') ? 3 : 2; }
function vaultRechargeTime() { return skillBaseCd(3, activeClass.skills[3].level) * getCDR(); }
function spendVaultCharge() { // the Space handler, after castSkill set the cooldown
    if (player.vaultCharges === undefined || player.vaultCharges > vaultMax()) player.vaultCharges = vaultMax();
    player.vaultCharges = Math.max(0, player.vaultCharges - 1);
    if (!(player.vaultRecharge > 0)) player.vaultRecharge = vaultRechargeTime();
    cooldowns.s3 = devNoCooldowns ? 0 : player.vaultCharges > 0 ? VAULT_GAP : player.vaultRecharge; cooldownMax.s3 = player.vaultCharges > 0 ? VAULT_GAP : vaultRechargeTime();
}

// Volley A, Storm Rain: the arrows keep falling for 4 s (Monsoon 6) at RAIN_RATE a second, each RAIN_MULT of the hit with no
// falloff. The cloud (skillfx_ult.js drawUltGround) drifts onto enemies (Following Storm), slows under it (Downpour) and throws
// lightning at the toughest enemy below every 0.8 s (Thunderhead).
const RAIN_TIME = 4, RAIN_LONG = 6, RAIN_RATE = 5, RAIN_MULT = 0.45, RAIN_BOLT = 0.8, RAIN_BOLT_MULT = 1.5, BARRAGE_FULL = 6, BARRAGE_FINALE = 4;
function stormCloud(rain, life, dmg) {
    let bolt = RAIN_BOLT;
    effects.push({ type: 'storm_cloud', rain, life, maxLife: life, customUpdate: (dt, ef) => {
        if (hasTalent('rain_follow')) { const e = getNearestEnemyFromPoint(rain.x, rain.y, 450); if (e) { const [vx, vy, d] = getVector(rain.x, rain.y, e.x, e.y); const st = Math.min(d, 90 * dt); if (d > 1) { rain.x += vx / d * st; rain.y += vy / d * st; } } }
        const under = enemies.filter(e => !e.dead && !e.pod && Math.hypot(e.x - rain.x, e.y - rain.y) <= rain.radius + e.size / 2);
        if (hasTalent('rain_slow')) for (const e of under) if (!(e.slowTimer > 0 && e.slowAmount > 0.3)) { e.slowTimer = Math.max(e.slowTimer || 0, 0.3); e.slowAmount = 0.3; }
        if (hasTalent('rain_thunder') && (bolt -= dt) <= 0 && ef.maxLife - ef.life > 0.45) {
            bolt = RAIN_BOLT;
            const e = under.sort((a, b) => b.hp - a.hp)[0];
            if (e) { effects.push({ type: 'lightning', x1: e.x + jitter(30), y1: e.y - 260, x2: e.x, y2: e.y, color: '#80d8ff', life: 0.25, maxLife: 0.25 }); applyDamage(e, dmg * RAIN_BOLT_MULT, 'magic'); }
        }
    } });
}

// Nature's Stride's evolutions and Disengage tick here (main.js update): Windwalk's end (Gale Burst), Focus, the spread's window,
// Twin Vault's recharge, and the wind round a windwalker
function updateRanger(dt) {
    if (buffs.windwalk > 0 && (buffs.windwalk -= dt) <= 0 && hasTalent('ww_gale')) galeBurst();
    if (buffs.windwalk > 0) emit(26, dt, () => { const a = Math.random() * Math.PI * 2; spawnParticle({ kind: 'dot', color: '#e0f7fa', x: player.x + Math.cos(a) * 24, y: player.y + Math.sin(a) * 24, vx: -Math.sin(a) * 120, vy: Math.cos(a) * 120, size: 1.8, life: 0.35, drag: 2, grow: 0, spin: 0, rot: 0 }); });
    if (buffs.focus > 0) buffs.focus -= dt;
    if (buffs.disengage > 0) buffs.disengage -= dt;
    if (buffs.tvGuard > 0) buffs.tvGuard -= dt;
    if (activeClass.skills[3].selectedUpg === 'B' && player.vaultCharges !== undefined) {
        const max = vaultMax();
        if (player.vaultCharges < max && (player.vaultRecharge -= dt) <= 0) { player.vaultCharges++; player.vaultRecharge = player.vaultCharges < max ? vaultRechargeTime() : 0; }
        if (player.vaultCharges > 0 && cooldowns.s3 > VAULT_GAP) cooldowns.s3 = 0; // a charge came back
        if (player.vaultCharges === 0) cooldowns.s3 = Math.max(cooldowns.s3, player.vaultRecharge);
    }
}
function galeBurst() { // Gale Burst (talents.js): Windwalk ends in a gust
    effects.push({ type: 'circle_burst', x: player.x, y: player.y, radius: 220, color: 'rgba(224, 247, 250, 0.7)', life: 0.35, maxLife: 0.35 });
    burst(player.x, player.y, 0, Math.PI * 2, 18, { kind: 'dot', color: '#e0f7fa', size: 2.4, life: 0.5, speed: [200, 420], drag: 3 });
    addShake(2);
    for (const e of enemies) {
        if (e.dead || e.pod || Math.hypot(e.x - player.x, e.y - player.y) > 220 + e.size / 2) continue;
        knockFrom(e, player.x, player.y, 150);
        e.slowTimer = Math.max(e.slowTimer || 0, 2); e.slowAmount = Math.max(e.slowAmount || 0, 0.5);
    }
}
// Windwalk (main.js): an enemy shot that would hit passes through; Return to Sender throws it back as a wind blade
function windwalkShot(p) {
    if (!hasTalent('ww_reflect')) return;
    const sp = Math.hypot(p.vx, p.vy) || 1;
    projectiles.push({ x: p.x, y: p.y, vx: -p.vx / sp * 900, vy: -p.vy / sp * 900, radius: 9, color: '#e0f7fa', life: 1.0, type: 'basic', shape: 'arrow', damage: calcDmg(activeClass.basicDmg) * 1.5, pierce: false, hitList: [], isEnemy: false });
    burst(p.x, p.y, Math.atan2(-p.vy, -p.vx), 0.8, 6, { kind: 'dot', color: '#e0f7fa', size: 2, life: 0.3, speed: [150, 300], drag: 4 });
}

// Machinist Sentry Turret. upg: 'A' = Laser Optics, 'B' = Volatile Casing
// Turret cap: 2 at Q rank 1-2, 3 at rank 3-4 (Automated Assembly's free turrets count too). A new turret packs up the oldest plain one
// (without its Volatile blast); Heavy and Siege turrets are never packed up early, so with only those standing Q waits.
function turretCap() { return 1 + Math.ceil(Math.max(1, activeClass.skills[1].level) / 2); }
function turretRoom() { const t = projectiles.filter(p => p.type === 'turret'); return t.length < turretCap() || t.some(p => !p.tier); }
// Salvage Economy: Scrap is stored (max 20). Holding Q pours it into the turret: hold 0.4 s for a Heavy Turret (5 Scrap),
// the full 0.9 s for a Siege Turret (10). A tap builds a plain one. Assembly's free turrets are always plain.
const SCRAP_MAX = 20, HEAVY_HOLD = 0.4, TURRET_BUILD_TIME = 0.9;
const TURRET_TIERS = [
    { cost: 10, name: 'SIEGE TURRET', mult: 2.0, scale: 1.5, life: 15 },
    { cost: 5, name: 'HEAVY TURRET', mult: 1.5, scale: 1.25, life: 12.5 },
];
function pickUpScrap() {
    player.hp = Math.min(player.maxHp, player.hp + 5);
    player.scrap = Math.min(SCRAP_MAX, (player.scrap || 0) + 1);
}
// The tier a hold of k (0..1 of TURRET_BUILD_TIME) buys with the Scrap on hand; undefined k (no hold) is a plain turret
function turretTierFromHold(k) {
    if (k === undefined) return null;
    const held = k * TURRET_BUILD_TIME, sc = player.scrap || 0;
    if (held >= TURRET_BUILD_TIME - 0.001 && sc >= 10) return TURRET_TIERS[0];
    if (held >= HEAVY_HOLD && sc >= 5) return TURRET_TIERS[1];
    return null;
}
function spawnTurret(x, y, upg, dmg, tier = null) {
    const standing = projectiles.filter(p => p.type === 'turret');
    while (standing.length >= turretCap()) {
        const old = standing.filter(p => !p.tier).sort((a, b) => a.bornAt - b.bornAt)[0];
        if (!old) return false; // only Heavy / Siege turrets standing
        standing.splice(standing.indexOf(old), 1);
        burst(old.x, old.y, 0, Math.PI * 2, 6, { kind: 'smoke', color: '#9e9e9e', size: 4, grow: 16, life: 0.4, speed: [30, 90], drag: 3 });
        projectiles.splice(projectiles.indexOf(old), 1);
    }
    if (tier) { player.scrap -= tier.cost; effects.push({ type: 'text', text: tier.name, x, y: y - 40, color: '#ffb74d', life: 1.0, maxLife: 1.0 }); }
    const life = tier ? tier.life : 10.0;
    projectiles.push({
        x: x, y: y, vx: 0, vy: 0, radius: 12 * (tier ? tier.scale : 1), color: '#ff9800', life, maxLife: life, scale: tier ? tier.scale : 1, type: 'turret', damage: dmg * (tier ? tier.mult : 1), isEnemy: false, volatile: upg === 'B', isLaser: upg === 'A', attackTimer: 0, angle: 0, bornAt: fxTime, tier: tier ? tier.name : null,
        customUpdate: function(dt, p) {
            this.attackTimer -= dt * (buffs.overclockTimer > 0 ? 1.75 : 1.0) * (this.overload > 0 ? OVERLOAD_RATE : 1); // Overclock: 1.75x as fast; Overload (combos.js) 3x
            if (this.overload > 0) this.overload -= dt;
            teslaCrackle(this, dt); // combos.js Tesla Turret
            let target = getNearestEnemyFromPoint(this.x, this.y, 500);
            if (target) {
                this.angle = Math.atan2(target.y - this.y, target.x - this.x);
                if (this.attackTimer <= 0) {
                    if (this.isLaser) {
                        effects.push({ type: 'laser_beam', x1: this.x + Math.cos(this.angle) * 18, y1: this.y + Math.sin(this.angle) * 18, x2: target.x, y2: target.y, life: 0.2, maxLife: 0.2 });
                        applyDamage(target, this.damage * 1.5 * teslaShot(this, target, 0), 'magic'); // combos.js: electrified, it arcs on
                        this.attackTimer = 1.0;
                    } else {
                        projectiles.push({ x: this.x + Math.cos(this.angle)*15, y: this.y + Math.sin(this.angle)*15, vx: Math.cos(this.angle)*800, vy: Math.sin(this.angle)*800, radius: 4, color: '#ffb74d', life: 1.5, type: 'basic', shape: 'bullet', damage: this.damage * teslaShot(this, target, Math.hypot(target.x - this.x, target.y - this.y) / 800), pierce: false, isEnemy: false }); // combos.js Tesla Turret
                        this.attackTimer = 0.8; // 1.25 shots/s; Laser Optics (x1.5 per 1 s) out-damages it on purpose
                    }
                }
            }
        }
    });
    turretPlaced(projectiles[projectiles.length - 1]); // combos.js: next to a Tesla Coil, it's electrified
    return true;
}

var SkillRegistry = {
    'Cleric': {
        1: (sk, dmg) => { // Divine Ray
            const aimAngle = Math.atan2(mouseY - player.y, mouseX - player.x);
            
            // Check available zeal for thresholds
            let availableZeal = buffs.zealLocked && buffs.aspectOfReaper <= 0 ? 100 : player.zeal;
            let zealSpent = 10;
            let width = 20;
            let length = 600;
            let tier = 1; // index into RAY_ZEAL_MULT: the Zeal a ray spends is its damage

            if (availableZeal >= 100) {
                zealSpent = 100; width = 80; length = 2500; tier = 3;
            } else if (availableZeal >= 50) {
                zealSpent = 50; width = 45; length = 600; tier = 2;
            } else if (availableZeal < 10) {
                zealSpent = availableZeal; tier = 0;
            }

            if (!buffs.zealLocked) player.zeal = Math.max(0, player.zeal - zealSpent);

            let isHoly = sk.selectedUpg === 'A';
            let isShadow = sk.selectedUpg === 'B';
            if (tier === 0 && isShadow) { // Void Spike: blood instead of Zeal
                if (buffs.aspectOfReaper > 0) tier = 2; // the Reaper already paid in blood: the 50-Zeal power (it adds +50% and halves cooldowns)
                else { player.hp -= player.hp * 0.05; tier = 3; } // a full-power ray for 5% current HP
            }
            if (tier === 0 && buffs.aspectOfReaper > 0) tier = 1; // the Reaper pays HP for its spells, so no empty-Zeal penalty
            let finalDmg = dmg * RAY_ZEAL_MULT[tier];

            let localDuration = 1.5;
            let localTickRate = 0.1;
            let maxTicks = Math.floor(localDuration / localTickRate);

            if (isShadow) {
                // Void Spike
                let spikeDmg = finalDmg * 2.5;
                if (player.hp < player.maxHp * 0.5) spikeDmg *= 1.4;

                effects.push({ 
                    type: 'divine_ray_channel', x: player.x, y: player.y, angle: aimAngle, 
                    length: length, width: width, color: '#9c27b0', life: localDuration, maxLife: localDuration,
                    customUpdate: function(dt, ef) { ef.x = player.x; ef.y = player.y; ef.angle = Math.atan2(mouseY - player.y, mouseX - player.x); }
                });
                
                let ticks = 0; const ray = {}; // combos.js marks it (Prism, Twilight Eclipse) so "COMBO!" shows once
                every(localTickRate, maxTicks, () => {
                    ticks++;
                    let currentAngle = Math.atan2(mouseY - player.y, mouseX - player.x);
                    prismTick(currentAngle, length, width, spikeDmg * 0.16, '#9c27b0', ray); // combos.js: refracted by your Hallowed Ground
                    for (let e of enemies) {
                        let [dx, dy, dist] = getVector(player.x, player.y, e.x, e.y);
                        if (dist < length) {
                            let diff = Math.atan2(dy, dx) - currentAngle;
                            while(diff < -Math.PI) diff += Math.PI*2; while(diff > Math.PI) diff -= Math.PI*2;
                            let limit = Math.atan2(width, dist);
                            if (Math.abs(diff) < limit || Math.abs(diff) < 0.15) {
                                applyDamage(e, spikeDmg * 0.16 * eclipseMult(e, ray), 'magic'); // 15 ticks: x6.0 total, times the Zeal tier (combos.js: x1.5 on an eclipsed enemy)
                                if (ticks % 2 === 0) effects.push({ type: 'sparkle_poof', x: e.x, y: e.y, color: '#9c27b0' });
                            }
                        }
                    }
                });
                buffs.lastSpellClass = 'shadow';
            } else {
                // Base & Holy
                let rayColor = isHoly ? '#fff59d' : '#fbc02d'; // Holy is whiter
                effects.push({ 
                    type: 'divine_ray_channel', x: player.x, y: player.y, angle: aimAngle, 
                    length: length, width: width, color: rayColor, life: localDuration, maxLife: localDuration,
                    customUpdate: function(dt, ef) { ef.x = player.x; ef.y = player.y; ef.angle = Math.atan2(mouseY - player.y, mouseX - player.x); }
                });
                
                let ticks = 0; const ray = {}; // combos.js marks it (Prism, Twilight Eclipse) so "COMBO!" shows once
                every(localTickRate, maxTicks, () => {
                    ticks++;
                    let currentAngle = Math.atan2(mouseY - player.y, mouseX - player.x);
                    prismTick(currentAngle, length, width, finalDmg * 0.35, rayColor, ray); // combos.js: refracted by your Hallowed Ground
                    for (let e of enemies) {
                        let [dx, dy, dist] = getVector(player.x, player.y, e.x, e.y);
                        if (dist < length) {
                            let diff = Math.atan2(dy, dx) - currentAngle;
                            while(diff < -Math.PI) diff += Math.PI*2; while(diff > Math.PI) diff -= Math.PI*2;
                            let limit = Math.atan2(width, dist) * 1.5; // Slightly forgiving hitbox at close range
                            if (Math.abs(diff) < Math.max(limit, 0.15)) {
                                applyDamage(e, finalDmg * 0.35 * eclipseMult(e, ray), 'magic'); // 15 ticks: x5.25 total, times the Zeal tier (combos.js: x1.5 on an eclipsed enemy)
                                if (isHoly) {
                                    // Radiant Flash: each fresh blind (not a refresh) gives Zeal back, so a ray through a pack refuels the next one
                                    if (!(e.blindTimer > 0) && !e.dead && !buffs.zealLocked) player.zeal = Math.min(player.maxZeal, player.zeal + 10);
                                    e.blindTimer = 1.0;
                                }
                                if (ticks % 2 === 0) effects.push({ type: 'sparkle_poof', x: e.x, y: e.y, color: rayColor });
                            }
                        }
                    }
                });
                if (isHoly) buffs.lastSpellClass = 'holy';
            }
        },
        2: (sk, dmg) => { // Hallowed Ground
            let availableZeal = buffs.zealLocked && buffs.aspectOfReaper <= 0 ? 100 : player.zeal;
            let zealSpent = 30;
            let healMult = 1.0;
            let doDamageAndSlow = false;

            if (availableZeal >= 100) {
                zealSpent = 100;
                healMult = 2.0;
                doDamageAndSlow = true;
            } else if (availableZeal >= 50) {
                zealSpent = 50;
                healMult = 2.0;
            } else if (availableZeal < 30) {
                zealSpent = availableZeal;
                healMult = 0.5;
            }
            
            if (!buffs.zealLocked) player.zeal = Math.max(0, player.zeal - zealSpent);
            
            let radius = healMult > 0.5 ? 160 : 80;
            let isHoly = sk.selectedUpg === 'A';
            let isShadow = sk.selectedUpg === 'B';
            let tX = mouseX; let tY = mouseY;
            let life = 4.0;

            if (isHoly) {
                buffs.lastSpellClass = 'holy';
                projectiles.push({
                    x: tX, y: tY, vx: 0, vy: 0, radius: radius, color: 'rgba(251, 192, 45, 0.3)', life: life,
                    type: 'hallowed_ground', shape: 'aura', damage: 0, zoneDmg: dmg, isHoly: true, pierce: true, hitList: [], isEnemy: false,
                    tickTimer: 0,
                    customUpdate: function(dt, p) {
                        p.tickTimer += dt;
                        if (p.tickTimer >= 0.5) {
                            p.tickTimer = 0;
                            // Heal Player
                            if (Math.hypot(player.x - p.x, player.y - p.y) <= p.radius) {
                                let healAmount = calcUtility(5 + (player.maxHp * 0.05), sk.level) * healMult;
                                player.hp = Math.min(player.maxHp, player.hp + healAmount);
                                effects.push({ type: 'text', x: player.x, y: player.y - 30, text: `+${Math.floor(healAmount)}`, color: '#69f0ae', life: 1.0, maxLife: 1.0 });
                                effects.push({ type: 'sparkle_poof', x: player.x, y: player.y, color: '#ffca28' });
                            }
                            for(let e of enemies) {
                                if (Math.hypot(e.x - p.x, e.y - p.y) > p.radius + e.size/2) continue;
                                if (doDamageAndSlow) {
                                    applyDamage(e, dmg * 0.5, 'magic');
                                    e.slowTimer = 0.6; e.slowAmount = 0.4;
                                }
                                // Sanctuary knocks non-boss enemies back out of the circle
                                if (!e.type.startsWith('boss')) {
                                    let [kx, ky, kd] = getVector(p.x, p.y, e.x, e.y);
                                    if (kd > 0) { e.x += (kx/kd) * 60; e.y += (ky/kd) * 60; clampToBounds(e, e.size/2); }
                                }
                            }
                        }
                    }
                });
            } else if (isShadow) {
                buffs.lastSpellClass = 'shadow';
                projectiles.push({
                    x: tX, y: tY, vx: 0, vy: 0, radius: radius, color: 'rgba(156, 39, 176, 0.3)', life: life,
                    type: 'hallowed_ground', shape: 'aura', damage: 0, zoneDmg: dmg, isShadow: true, pierce: true, hitList: [], isEnemy: false,
                    tickTimer: 0,
                    customUpdate: function(dt, p) {
                        p.tickTimer += dt;
                        if (p.tickTimer >= 0.5) {
                            p.tickTimer = 0;
                            let dtDamage = dmg * 1.4; // Tick damage (x1.2 after the band pass, x1.4 after the boss-fight check)
                            if (doDamageAndSlow) dtDamage *= 1.5;
                            for (let e of enemies) {
                                if (Math.hypot(e.x - p.x, e.y - p.y) <= p.radius + e.size/2) {
                                    shatterShields(e); // combat.js
                                    applyDamage(e, dtDamage, 'magic');
                                    e.slowTimer = 0.6; e.slowAmount = 0.4;
                                }
                            }
                        }
                    }
                });
            } else {
                projectiles.push({
                    x: tX, y: tY, vx: 0, vy: 0, radius: radius, color: 'rgba(255, 235, 59, 0.2)', life: life,
                    type: 'hallowed_ground', shape: 'aura', damage: 0, zoneDmg: dmg, pierce: true, hitList: [], isEnemy: false,
                    tickTimer: 0,
                    customUpdate: function(dt, p) {
                        p.tickTimer += dt;
                        if (p.tickTimer >= 0.5) {
                            p.tickTimer = 0;
                            // Moderate Heal, no damage
                            if (Math.hypot(player.x - p.x, player.y - p.y) <= p.radius) {
                                let healAmount = calcUtility(5 + (player.maxHp * 0.02), sk.level) * healMult;
                                player.hp = Math.min(player.maxHp, player.hp + healAmount);
                                effects.push({ type: 'text', x: player.x, y: player.y - 30, text: `+${Math.floor(healAmount)}`, color: '#69f0ae', life: 1.0, maxLife: 1.0 });
                                effects.push({ type: 'sparkle_poof', x: player.x, y: player.y, color: '#ffca28' });
                            }
                            if (doDamageAndSlow) {
                                for(let e of enemies) {
                                    if (Math.hypot(e.x - p.x, e.y - p.y) <= p.radius + e.size/2) {
                                        applyDamage(e, dmg * 0.5, 'magic');
                                        e.slowTimer = 0.6; e.slowAmount = 0.4;
                                    }
                                }
                            }
                        }
                    }
                });
            }
        },
        3: (sk, dmg) => { // Phase Shift
            let isHoly = sk.selectedUpg === 'A';
            let isShadow = sk.selectedUpg === 'B';
            
            let availableZeal = buffs.zealLocked && buffs.aspectOfReaper <= 0 ? 100 : player.zeal;
            let dashBonusDist = 0;
            let applyAoeStun = false;
            let isUpgradedCast = false;
            
            if (availableZeal >= 100) {
                dashBonusDist = 300;
                applyAoeStun = true;
                isUpgradedCast = true;
            } else if (availableZeal >= 50) {
                dashBonusDist = 150;
                isUpgradedCast = true;
            }

            let resolveZeal = () => {
                let cost = isUpgradedCast ? (applyAoeStun ? 100 : 50) : (isShadow ? 20 : 0);
                if (!buffs.zealLocked) {
                    if (isShadow) {
                        if (player.zeal >= cost) player.zeal -= cost;
                        else player.hp -= player.maxHp * 0.1;
                    } else {
                        if (isUpgradedCast) player.zeal = Math.max(0, player.zeal - cost);
                        else player.zeal = Math.min(player.maxZeal, player.zeal + 20); // Generate if base
                    }
                }
            };

            if (isHoly) { // Divine Transposition
                let nearest = null; let minDist = Infinity;
                for (let e of enemies) {
                    let dist = Math.hypot(player.x - e.x, player.y - e.y);
                    if (dist < 400 + dashBonusDist && dist < minDist) { minDist = dist; nearest = e; }
                }
                if (nearest) {
                    resolveZeal();
                    let px = player.x; let py = player.y;
                    player.x = nearest.x; player.y = nearest.y;
                    nearest.x = px; nearest.y = py;
                    
                    spawnDashGhost('#ffd54f', true, 0.4, Math.atan2(player.y - py, player.x - px), px, py, 0);
                    effects.push({ type: 'transposition', x0: px, y0: py, x1: player.x, y1: player.y, life: 0.45, maxLife: 0.45 });
                    effects.push({ type: 'phase_light', x: px, y: py, radius: 46, life: 0.45, maxLife: 0.45 });
                    effects.push({ type: 'phase_light', x: player.x, y: player.y, radius: 46, life: 0.45, maxLife: 0.45 });
                    if (applyAoeStun) {
                        effects.push({ type: 'holy_nova', x: player.x, y: player.y, radius: 400, life: 0.5, maxLife: 0.5 });
                    }
                    
                    for (let e of enemies) {
                        if (Math.hypot(e.x - player.x, e.y - player.y) < (applyAoeStun ? 400 : 200)) {
                            e.stunTimer = 2.0;
                            burst(e.x, e.y, 0, Math.PI * 2, 5, { kind: 'dot', color: '#ffe082', size: 2, life: 0.4, speed: [40, 120] });
                        }
                    }
                    buffs.lastSpellClass = 'holy';
                }
            } else if (isShadow) { // Raven Flight
                resolveZeal();
                let [dx, dy, dist] = getVector(player.x, player.y, mouseX, mouseY);
                let dashDist = Math.min(dist, 400 + dashBonusDist);
                let tX = player.x + (dx/dist)*dashDist;
                let tY = player.y + (dy/dist)*dashDist;
                
                effects.push({ type: 'raven_flight', x0: player.x, y0: player.y, x1: tX, y1: tY, life: 0.5, maxLife: 0.5 });
                spawnDashGhost('#7b1fa2', true, 0.3, Math.atan2(tY - player.y, tX - player.x));
                if (applyAoeStun) effects.push({ type: 'holy_nova', x: tX, y: tY, radius: 150, color: '#ce93d8', life: 0.5, maxLife: 0.5 });
                
                for (let e of enemies) {
                    if (distToSegment(e.x, e.y, player.x, player.y, tX, tY) < e.size + (applyAoeStun ? 150 : 60)) {
                        e.blindTimer = 2.5; 
                        applyDamage(e, dmg * 2.0, 'magic');
                        player.hp = Math.min(player.maxHp, player.hp + (player.maxHp * 0.05));
                        effects.push({ type: 'text', text: 'SIPHON', x: e.x, y: e.y - 20, color: '#9c27b0', life: 0.8, maxLife: 0.8 });
                        burst(e.x, e.y, Math.atan2(tY - e.y, tX - e.x), 0.8, 6, { kind: 'dot', color: '#ce93d8', size: 2, life: 0.45, speed: [150, 300], drag: 2 }); // life drained toward the cleric
                        if (applyAoeStun) e.stunTimer = 1.0;
                    }
                }
                player.x = tX; player.y = tY;
                buffs.lastSpellClass = 'shadow';
            } else { // Base Phase Shift
                resolveZeal();
                let [dx, dy, dist] = getVector(player.x, player.y, mouseX, mouseY);
                let dashDist = Math.max(50, Math.min(dist, 300 + dashBonusDist));
                let tX = player.x + (dx/dist)*dashDist;
                let tY = player.y + (dy/dist)*dashDist;
                
                spawnDashGhost('#ffd54f', true, 0.4, Math.atan2(tY - player.y, tX - player.x));
                effects.push({ type: 'phase_light', x: player.x, y: player.y, radius: 40, depart: true, life: 0.35, maxLife: 0.35 });
                for (let i = 0; i <= 10; i++) { const t = i / 10; spawnParticle({ kind: 'dot', color: '#ffe082', x: lerp(player.x, tX, t) + jitter(10), y: lerp(player.y, tY, t) + jitter(10), vx: jitter(20), vy: -20 - Math.random() * 20, size: 1.8, life: 0.3 + t * 0.3, drag: 1, grow: 0, spin: 0, rot: 0 }); }
                player.iFrames = applyAoeStun ? 1.0 : 0.5;
                if (applyAoeStun) {
                    effects.push({ type: 'holy_nova', x: player.x, y: player.y, radius: 200, life: 0.5, maxLife: 0.5 });
                    effects.push({ type: 'holy_nova', x: tX, y: tY, radius: 200, life: 0.5, maxLife: 0.5 });
                    for(let e of enemies) {
                        if(Math.hypot(e.x - tX, e.y - tY) < 200) { e.stunTimer = 1.5; applyDamage(e, dmg, 'magic'); }
                        if(Math.hypot(e.x - player.x, e.y - player.y) < 200) { e.stunTimer = 1.5; applyDamage(e, dmg, 'magic'); }
                    }
                }
                player.x = tX; player.y = tY;
                effects.push({ type: 'phase_light', x: player.x, y: player.y, radius: 46, life: 0.45, maxLife: 0.45 });
            }
            sanctifiedArrival(); // combos.js: landing in your own Hallowed Ground makes it erupt
        },
        4: (sk, dmg) => { // Ascension
            let isHoly = sk.selectedUpg === 'A';
            let isShadow = sk.selectedUpg === 'B';
            
            if (isHoly) { // Avatar of Renewal
                buffs.avatarOfRenewal = calcUtility(8.0, sk.level); // ranks: longer
                buffs.lastSpellClass = 'holy';
                effects.push({ type: 'ascend_burst', variant: 'holy', radius: 250, life: 0.7, maxLife: 0.7 });
                
                // Homings light bolts
                let bolts = 6;
                for(let i=0; i<bolts; i++) {
                    let angle = (Math.PI*2 / bolts) * i;
                    projectiles.push({
                        x: player.x, y: player.y, vx: Math.cos(angle)*400, vy: Math.sin(angle)*400,
                        radius: 8, color: '#fff', life: 3.0, type: 'basic', shape: 'light_spear', damage: dmg * 1.5, pierce: false, isEnemy: false,
                        customUpdate: function(dt, p) {
                            let nearest = getNearestEnemyFromPoint(p.x, p.y, 300);
                            if (nearest) {
                                let [dx, dy, dist] = getVector(p.x, p.y, nearest.x, nearest.y);
                                p.vx += (dx/dist)*800 * dt;
                                p.vy += (dy/dist)*800 * dt;
                                // velocity limit
                                let vDist = Math.hypot(p.vx, p.vy);
                                if (vDist > 600) { p.vx = (p.vx/vDist)*600; p.vy = (p.vy/vDist)*600; }
                            }
                        }
                    });
                }
            } else if (isShadow) { // Aspect of the Reaper
                buffs.aspectOfReaper = calcUtility(8.0, sk.level); // ranks: longer
                buffs.lastSpellClass = 'shadow';
                effects.push({ type: 'ascend_burst', variant: 'shadow', radius: 250, life: 0.7, maxLife: 0.7 });
            } else { // Base Ascension
                buffs.ascension = calcUtility(6.0, sk.level); // ranks: longer (6 → 9.6 s)
                effects.push({ type: 'ascend_burst', variant: 'base', radius: 150, life: 0.7, maxLife: 0.7 });
            }
            if (!buffs.zealLocked) player.zeal = player.maxZeal;
        },
        'rmb': () => {
            // Twilight Repulse
            if (equipment.weapon && equipment.weapon.name === 'Censer of the Twilight Horizon') {
                let radius = 180;
                effects.push({ type: 'eclipse_wave', x: player.x, y: player.y, radius: radius, life: 0.5, maxLife: 0.5 });
                
                for(let i=enemies.length-1; i>=0; i--) {
                    const e = enemies[i];
                    if (Math.hypot(player.x - e.x, player.y - e.y) <= radius + e.size/2) {
                        applyDamage(e, calcDmg(30), 'magic');
                        if (e.type.startsWith('boss')) continue; // bosses take the hit but aren't pushed or stunned
                        let [dx, dy, dist] = getVector(player.x, player.y, e.x, e.y);
                        // Repulse distance
                        if (dist > 0) {
                            e.x += (dx/dist) * 120;
                            e.y += (dy/dist) * 120;
                            clampToBounds(e, e.size/2);
                        }
                        e.stunTimer = 1.0; e.eclipseUntil = fxTime + ECLIPSE_TIME; // combos.js Twilight Eclipse: Divine Ray hits it x1.5 for a moment
                    }
                }
            }
        }
    },
    'Kensei': {
        1: (sk, dmg) => { // Blade Sweep / Blade Surge
            if (galeReady()) { releaseHurricane(); return; } // combos.js Gathering Gale: Q releases the gathered blades as a hurricane
            if (player.stance === 'handheld') {
                const attackAngle = Math.atan2(mouseY - player.y, mouseX - player.x);
                effects.push({ type: 'precision_slash', x: player.x, y: player.y, radius: 180, angle: attackAngle, color: '#18ffff', life: 0.25, maxLife: 0.25 }); 
                player.qAnimTimer = 0.25;
                player.parryTimer = 0.3; // Parry window: hits taken at the start of the sweep are parried (see takeDamage)
                
                // Destroy Enemy Projectiles
                let deflected = null;
                for(let i = projectiles.length - 1; i >= 0; i--) {
                    let p = projectiles[i];
                    if (p.isEnemy) {
                        if (Math.hypot(player.x - p.x, player.y - p.y) <= 180) {
                            let diff = Math.atan2(p.y-player.y, p.x-player.x) - attackAngle; 
                            while(diff < -Math.PI) diff += Math.PI*2; while(diff > Math.PI) diff -= Math.PI*2;
                            if (Math.abs(diff) <= Math.PI/3) { // inside slash cone
                                effects.push({ type: 'sparkle_poof', x: p.x, y: p.y, color: '#00e5ff' });
                                p.life = 0; deflected = deflected || p;
                            }
                        }
                    }
                }
                if (deflected) parrySuccess({ proj: deflected }); // combat.js: a shot cut out of the air is a parry too (once per sweep), Flawless Execution included
                
                let hitAnything = false;
                for(let e of enemies) {
                    if (Math.hypot(player.x-e.x, player.y-e.y) <= 180 + e.size/2) {
                        let diff = Math.atan2(e.y-player.y, e.x-player.x) - attackAngle; 
                        while(diff < -Math.PI) diff += Math.PI*2; 
                        while(diff > Math.PI) diff -= Math.PI*2;
                        if (Math.abs(diff) <= (Math.PI/3)) { 
                            applyDamage(e, dmg * 1.5, 'slash');
                            hitAnything = true;
                        }
                    }
                }
                
                if (hitAnything) {
                    player.flow = Math.min(player.maxFlow, player.flow + 30); 
                    player.flowGainTimer = 0;
                }
            } else {
                let ab = player.airborneBlade;
                if (ab.orbit && whirlOrbit(ab)) return; // combos.js Whirling Orbit: Q during Guardian Orbit spins it faster instead
                // Devastating epic spin on current location
                ab.flyTimer = 0.6; // Lock the AI out of flying away while it spins
                
                effects.push({ type: 'text', text: 'Blade Surge!', x: ab.x, y: ab.y - 40, color: '#00e5ff', life: 0.6, maxLife: 0.6 });
                
                let isDeflectingStorm = sk.selectedUpg === 'B';
                let spinRadius = isDeflectingStorm ? 250 : 180;
                let finalRadius = isDeflectingStorm ? 280 : 200;
                
                let spinCount = 0;
                every(0.1, 6, () => {
                    let spinAngle = (Math.PI * 2 / 5) * spinCount + ab.angle;
                    ab.angle += 0.5; // visibly rotate the blade fast
                    
                    effects.push({ type: 'storm_cyclone', x: ab.x, y: ab.y, radius: spinRadius, angle: spinAngle, color: '#00e5ff', life: 0.15, maxLife: 0.15 });
                    
                    if (isDeflectingStorm) {
                        for (let i = projectiles.length - 1; i >= 0; i--) {
                            let p = projectiles[i];
                            if (p.isEnemy && Math.hypot(p.x - ab.x, p.y - ab.y) <= spinRadius + p.radius) {
                                projectiles.splice(i, 1);
                                player.flow = Math.min(player.maxFlow, (player.flow || 0) + (player.maxFlow * 0.05));
                                player.flowGainTimer = 0;
                                effects.push({ type: 'circle', x: p.x, y: p.y, radius: 15, color: '#84ffff', life: 0.2, maxLife: 0.2 });
                            }
                        }
                    }

                    for (let e of enemies) {
                        if (Math.hypot(e.x - ab.x, e.y - ab.y) <= spinRadius + e.size/2) {
                            applyDamage(e, dmg * 0.2, 'slash'); // 6 hits of 0.2, then the 0.6 blast: x1.8 total
                        }
                    }
                    
                    spinCount++;
                    if (spinCount >= 6) {
                        // Final explosion blast
                        effects.push({ type: 'surge_burst', x: ab.x, y: ab.y, radius: finalRadius, life: 0.35, maxLife: 0.35 });
                        for (let e of enemies) {
                            if (Math.hypot(e.x - ab.x, e.y - ab.y) <= finalRadius + e.size/2) {
                                applyDamage(e, dmg * 0.6, 'slash');
                            }
                        }
                    }
                });
            }
        },
        2: (sk, dmg) => { // Deploy / Recall (Toggle)
            if (player.stance === 'handheld') {
                if (sk.selectedUpg === 'B') { player.flow = player.maxFlow; player.flowGainTimer = 0; } // Early Deploy: launched from 70%, the bar fills (main.js lets it cast)
                if (player.flow >= player.maxFlow) player.empoweredAirborne = true;
                player.stance = 'airborne';
                effects.push({ type: 'blade_launch', x: player.x, y: player.y, flow: sk.selectedUpg === 'B', life: 0.35, maxLife: 0.35 });
            } else {
                const ab = player.airborneBlade;
                effects.push({ type: 'blade_recall', x1: ab.x, y1: ab.y, x2: player.x, y2: player.y, life: 0.3, maxLife: 0.3 });
                effects.push({ type: 'circle_burst', x: player.x, y: player.y, radius: 40, color: 'rgba(0, 229, 255, 0.8)', life: 0.3, maxLife: 0.3 });
                returnCut(ab.x, ab.y, sk.selectedUpg === 'A' ? 1 : player.flow / Math.max(1, player.maxFlow)); // combos.js Return Cut (Riposte Recall: as if at full Flow)
                player.stance = 'handheld';
                player.flow = sk.selectedUpg === 'A' ? player.maxFlow * 0.3 : 0;
                player.flowGainTimer = 0;
                player.empoweredAirborne = false;
                ab.x = player.x; ab.y = player.y;
            }
        },
        3: (sk, dmg) => { // Shadow Step / Spatial Swap
            if (player.stance === 'handheld') {
                const [dx, dy, dist] = getVector(player.x, player.y, mouseX, mouseY);
                let moveDist = Math.min(dist, shadowStepReach(sk.level)); // ranks: farther; Windwalker Steps +100
                const dashAngle = Math.atan2(dy, dx), dur = 0.1 + moveDist / 4000;
                const startX = player.x, startY = player.y;
                counterStep(); // combos.js Counter Step: off a parry, its Iaido cuts harder

                if (sk.selectedUpg === 'A') {
                    // Path of Blades - a phantom blade rides along with the dash, piercing everything on the way
                    projectiles.push({
                        x: startX, y: startY,
                        vx: Math.cos(dashAngle) * moveDist / dur, vy: Math.sin(dashAngle) * moveDist / dur,
                        radius: 85, color: '#00e5ff',
                        life: dur, // keeps pace with the kensei for exactly the length of the dash
                        type: 'pierce',
                        shape: 'phantom_blade_proj',
                        damage: dmg * 2.0,
                        pierce: true,
                        hitList: [],
                        isEnemy: false
                    });
                }

                player.iFrames = 0.3;
                const trail = { type: 'dash_trail', x1: startX, y1: startY, x2: startX, y2: startY, color: '#00e5ff', width: 14, life: dur + 0.2, maxLife: dur + 0.2 };
                effects.push(trail);
                startDash({
                    x: startX + (dx/dist)*moveDist, y: startY + (dy/dist)*moveDist, dur, kind: 'shadow_step', trail,
                    ghost: { color: '#00e5ff', glow: true, every: 0.012, life: 0.2 },
                    onArrive: () => {
                        player.iFrames = Math.max(player.iFrames, 0.15);
                        effects.push({ type: 'iai_flash', x1: startX, y1: startY, x2: player.x, y2: player.y, life: 0.35, maxLife: 0.35 });
                    }
                });

            } else {
                // Swap places with Airborne Blade
                let tmpX = player.x; let tmpY = player.y;
                player.x = player.airborneBlade.x; player.y = player.airborneBlade.y;
                player.airborneBlade.x = tmpX; player.airborneBlade.y = tmpY;
                
                // Add a more dramatic spatial swap effect
                effects.push({ type: 'spatial_swap', x0: tmpX, y0: tmpY, x1: player.x, y1: player.y, life: 0.45, maxLife: 0.45 });
                spawnDashGhost('#00e5ff', true, 0.35, Math.atan2(player.y - tmpY, player.x - tmpX), tmpX, tmpY, 0);
                
                if (sk.selectedUpg === 'B') cooldowns.s1 = 0; // Reset Q (Blade Surge)
            }
        },
        4: (sk, dmg, k, opt = {}) => { // Blade Whirlwind / Shatter Storm
            if (player.stance === 'handheld' && opt.gather) { gatherGale(sk, dmg); return; } // combos.js Gathering Gale: right after Shadow Step the blades gather in front
            if (player.stance === 'handheld') {
                // Creates a visually stunning vortex of blades
                effects.push({ type: 'katana_tornado', x: player.x, y: player.y, radius: 250, vortex: sk.selectedUpg === 'A', startAngle: Math.atan2(mouseY - player.y, mouseX - player.x), life: 0.8, maxLife: 0.8 });
                addShake(2.5);
                for(let i=enemies.length-1; i>=0; i--) {
                    let e = enemies[i];
                    if (Math.hypot(player.x - e.x, player.y - e.y) < 250 + e.size/2) {
                        applyDamage(e, dmg * 1.5, 'slash');
                        if (sk.selectedUpg === 'A') {
                            let [edx, edy, edist] = getVector(e.x, e.y, player.x, player.y);
                            let pull = Math.max(0, Math.min(edist - (player.radius + e.size/2), 150)); // stop at contact range, not on top of the player
                            e.x += (edx/edist) * pull; e.y += (edy/edist) * pull;
                        }
                    }
                }
            } else {
                let ab = player.airborneBlade;
                let tempest = sk.selectedUpg === 'B'; // Tempest Shards: faster strikes that cut everything around them
                
                // Visual explosion of the main blade
                effects.push({ type: 'shatter_burst', x: ab.x, y: ab.y, life: 0.4, maxLife: 0.4 });
                
                if (!player.miniBlades) player.miniBlades = [];
                for(let i=0; i<6; i++) {
                    let ang = (Math.PI*2 / 6) * i;
                    player.miniBlades.push({ 
                        x: ab.x, y: ab.y, 
                        angle: ang, 
                        life: 6.0, 
                        maxLife: 6.0,
                        attackTimer: 0,
                        tempest,
                        dmg: dmg * 0.055 // per hit, every 0.5 s (0.3 s with Tempest Shards); scales with R's rank (main.js)
                    });
                }
            }
        },
        'rmb': () => {
            // "Phantom Wind" - Wide sweeping crowd-control slash to generate massive Flow when surrounded
            const slashAngle = Math.atan2(mouseY - player.y, mouseX - player.x);
            galeOrbit(); // combos.js Gale Orbit: during Guardian Orbit, the circle is flung wide
            
            // Dash slightly into the strike
            spawnDashGhost('#84ffff', true, 0.25, slashAngle);
            player.x += Math.cos(slashAngle) * 60; 
            player.y += Math.sin(slashAngle) * 60; 
            clampToBounds(player, player.radius);
            player.iFrames = 0.4; // Safety during the emergency sweep

            effects.push({ type: 'gale_crescent', x: player.x, y: player.y, radius: 250, angle: slashAngle, life: 0.4, maxLife: 0.4 });
            
            let enemiesHit = 0;
            for (let i = enemies.length - 1; i >= 0; i--) {
                let e = enemies[i];
                if (Math.hypot(e.x - player.x, e.y - player.y) < 250 + e.size/2) {
                    let diff = Math.atan2(e.y - player.y, e.x - player.x) - slashAngle;
                    while(diff < -Math.PI) diff += Math.PI*2; while(diff > Math.PI) diff -= Math.PI*2;
                    
                    if (Math.abs(diff) <= Math.PI/2) { // 180 degree cone
                        applyDamage(e, calcDmg(activeClass.basicDmg * 2), 'slash');
                        e.x += Math.cos(slashAngle) * 100; // Strong knockback
                        e.y += Math.sin(slashAngle) * 100;
                        clampToBounds(e, e.size/2);
                        e.stunTimer = 1.0; // Stun to relieve pressure
                        enemiesHit++;
                        for (let m = 0; m < 4; m++) spawnParticle({ kind: 'dot', color: '#84ffff', x: e.x + jitter(16), y: e.y + jitter(16), vx: (player.x - e.x) / 0.45, vy: (player.y - e.y) / 0.45, size: 2, life: 0.45, drag: 0, grow: 0, spin: 0, rot: 0 }); // Flow streams back
                    }
                }
            }
            
            if (enemiesHit > 0) {
                // Restore flow to get them back into the fight
                let flowGained = enemiesHit * 10;
                if (equipment.gloves && equipment.gloves.name === 'Aether Grips') flowGained *= 1.1;
                player.flow = Math.min(player.maxFlow, player.flow + flowGained);
                
                effects.push({ type: 'text', text: '+' + Math.floor(flowGained) + ' FLOW', x: player.x, y: player.y - 40, color: '#00e5ff', life: 1.0, maxLife: 1.0 });
            }
        }
    },
    'Dragonknight': {
        1: (sk, dmg) => {
            const [dx, dy, dist] = getVector(player.x, player.y, mouseX, mouseY);
            if (!(dist > 0)) return;
            const spd = 600 * (hasTalent('shield_far') ? 1.3 : 1), a0 = Math.atan2(dy, dx); // talents.js Long Arm: faster, so farther
            const p = { x: player.x, y: player.y, vx: Math.cos(a0) * spd, vy: Math.sin(a0) * spd, radius: 14, color: sk.selectedUpg === 'A' ? '#ffccbc' : '#e0e0e0', life: 2.0, type: 'shield_throw', shape: 'shield', damage: dmg, pierce: true, hitList: [], isEnemy: false, returning: false, sourceSkill: sk, startX: player.x, startY: player.y };
            projectiles.push(p);
            if (sk.selectedUpg === 'A') moltenTrail(p); // Molten Aegis
        },
        2: (sk) => { // Dragonfire Blade: the greatsword catches dragonfire (the swing itself is the 'sword' basic below)
            buffs.dragonfire = DRAGONFIRE_TIME + (hasTalent('fire_long') ? 3 : 0); // talents.js Slow Burn
            if (hasTalent('fire_kindling')) addFrenzy(4);
            player.undyingReady = hasTalent('wyrm_undying'); // Undying Flame: once per cast (talents.js talentsLethal)
            effects.push({ type: 'dragonfire_ignite', x: player.x, y: player.y, upg: sk.selectedUpg, life: 0.5, maxLife: 0.5 }); // skillfx_e.js
            addShake(1.5);
        },
        3: (sk, dmg, k) => { // Thunder Leap: an arcing jump that comes down with a thunderclap (Meteor Dive: a dive from the hang)
            const hang = player.hang, dive = !!hang; player.hang = null;
            const greaves = hasItem('Thunderstride Greaves'); // items.js: farther, and the landing throws enemies back
            let tx, ty;
            if (dive) [tx, ty] = meteorTarget(); // where the reticle stood
            else {
                const [dx, dy, dist] = getVector(player.x, player.y, mouseX, mouseY), moveDist = Math.min(dist, leapReach());
                tx = dist > 0 ? player.x + (dx / dist) * moveDist : player.x; ty = dist > 0 ? player.y + (dy / dist) * moveDist : player.y;
                dustPuff(player.x, player.y, Math.atan2(dy, dx) + Math.PI, 2.4, 5);
            }
            const moveDist = Math.hypot(tx - player.x, ty - player.y), power = dive ? Math.min(1, k || 0) : 0;
            const leap = startDash({
                x: tx, y: ty,
                dur: dive ? 0.18 : 0.2 + moveDist / 2700, arc: dive ? 0 : 25 + moveDist * 0.12, z0: dive ? player.z : 0, kind: 'thunder_leap',
                shields: projectiles.filter(p => p.type === 'shield_throw'), // combos.js Skyfall Catch: the shields already flying
                ghost: { color: dive ? '#ffab40' : '#ff7043', glow: dive, every: dive ? 0.02 : 0.035 },
                onArrive: () => {
                    if (leap.wyrmfall) leap.wyrmfall(); // combos.js Wyrmfall: Dragon Breath cast mid-leap (or while hanging)
                    const sky = leap.skyfall, mult = sky ? SKYFALL_MULT : 1 + (DIVE_MULT - 1) * power;
                    const R = sky ? SKYFALL_RADIUS : dive ? diveRadius(power) : hasTalent('leap_wide') ? 165 : 120; // combos.js: the shield was caught mid-air, so it comes down as a slam; talents.js Thunderclap
                    effects.push({ type: 'thunder_slam', x: player.x, y: player.y, radius: R, color: sky ? '#ffca28' : dive ? '#ffab40' : '#ff7043', big: sky || power > 0.5, life: sky ? 0.65 : 0.5, maxLife: sky ? 0.65 : 0.5 });
                    if (sky) { effects.push({ type: 'shield_blast', x: player.x, y: player.y, radius: 70, life: 0.35, maxLife: 0.35 }); comboText(); }
                    if (dive) { addShake(2 + 3 * power); if (power > 0.5) effects.push({ type: 'wyrmfall_pillar', x: player.x, y: player.y, frost: false, life: 0.4, maxLife: 0.4 }); }
                    for(let i=enemies.length-1; i>=0; i--) {
                        const e = enemies[i];
                        if (Math.hypot(player.x-e.x, player.y-e.y) > R + e.size/2) continue;
                        applyDamage(e, dmg * mult, 'melee');
                        if (!e.type.startsWith('boss')) e.stunTimer = Math.max(e.stunTimer || 0, sky ? SKYFALL_STUN : 0.5); // the thunderclap staggers
                        if (dive && hasTalent('dive_comet') && !e.dead) igniteEnemy(e, dmg * 0.3); // Comet Trail
                        if (greaves && !e.type.startsWith('boss') && !e.dead) { const ka = Math.atan2(e.y - player.y, e.x - player.x); e.x += Math.cos(ka) * 60; e.y += Math.sin(ka) * 60; clampToBounds(e, e.size / 2); }
                    }
                    if (sk.selectedUpg === 'A') gravitySlam(player.x, player.y, dmg); // after the clap: the pack is drawn in for what comes next
                    if (dive && power >= 0.99 && hasTalent('dive_starfall')) starfall(player.x, player.y, dmg);
                }
            });
            if (hang && hang.wyrmfall) leap.wyrmfall = hang.wyrmfall; // R pressed while hanging
            skyfallHold(leap); // combos.js: an outgoing shield the leap is aimed at waits in the air
        },
        4: (sk, dmg, k, opt = {}) => {
            const attackAngle = Math.atan2(mouseY - player.y, mouseX - player.x);
            let color = sk.selectedUpg === 'A' ? '#2196f3' : '#ff5722';
            const breath = sk.selectedUpg === 'A' ? 'frost' : sk.selectedUpg === 'B' ? 'shatter' : 'fire';
            if (opt.wyrmfall) { (player.dash || player.hang).wyrmfall = () => wyrmfall(sk, dmg, breath, color); return; } // combos.js: cast mid-leap (or hanging in a Meteor Dive), it pours down on landing
            // talents.js: Deep Lungs (longer), Long Breath (farther), Wide Maw (wider)
            const long = hasTalent('breath_long'), speed = 700 * (hasTalent('breath_far') ? 1.3 : 1), spreadW = hasTalent('sunder_wide') ? 1.25 : 0.8, sunder = sk.selectedUpg === 'B';
            const head = { type: 'dragon_head', angle: attackAngle, breath, tracking: true, life: long ? 1.75 : 1.25, maxLife: long ? 1.75 : 1.25 };
            effects.push(head); // skillfx_ult.js: the head turns to follow the cursor, and the flames go where it faces
            every(0.05, long ? 29 : 21, () => {
                let spread = head.angle + (Math.random() - 0.5) * spreadW;
                projectiles.push({ x: player.x + Math.cos(spread)*20, y: player.y + Math.sin(spread)*20, vx: Math.cos(spread)*speed, vy: Math.sin(spread)*speed, radius: 15 + Math.random()*15, color: color, life: 0.6, type: 'pierce', shape: 'breath', breath, damage: dmg * 0.25, pierce: true, hitList: [], isEnemy: false, burn: dmg * 0.2, burnColor: color, sunder }); // burn: x0.2/s for 3 s on whatever it touches (main.js); Sundering Breath: every flame Sunders (main.js)
            });

            // Glacial chills everything in the cone as the breath starts (talents.js: frozen first, farther and wider, marked for Frostbite and Shatterfrost)
            const cone = hasTalent('frost_wide') ? 0.6 : 0.4, reach = hasTalent('frost_wide') ? 500 : 400;
            if (sk.selectedUpg === 'A') for (const e of enemies) {
                if (e.dead || Math.hypot(player.x - e.x, player.y - e.y) > reach + e.size / 2) continue;
                const diff = Math.atan2(e.y - player.y, e.x - player.x) - attackAngle;
                if (Math.abs(Math.atan2(Math.sin(diff), Math.cos(diff))) > cone) continue;
                e.slowTimer = 3.0; e.slowAmount = 0.7; e.chilledUntil = fxTime + 3;
                if (hasTalent('frost_freeze')) e.frozenTimer = Math.max(e.frozenTimer || 0, 1.0);
            }
            if (hasTalent('sunder_roar')) after(head.maxLife, dragonRoar);
        },
        'rmb': () => {
            const attackAngle = Math.atan2(mouseY - player.y, mouseX - player.x);
            effects.push({ type: 'wyrm_rake', x: player.x, y: player.y, angle: attackAngle, life: 0.35, maxLife: 0.35 });
            effects.push({ type: 'dragon_head', angle: attackAngle, breath: 'fire', snap: true, life: 0.35, maxLife: 0.35 }); // the wyrm snaps forward
            for(let i=enemies.length-1; i>=0; i--) {
                const e = enemies[i];
                if (Math.hypot(player.x-e.x, player.y-e.y) <= 150 + e.size/2) {
                    let diff = Math.atan2(e.y-player.y, e.x-player.x) - attackAngle; while(diff < -Math.PI) diff += Math.PI*2; while(diff > Math.PI) diff -= Math.PI*2;
                    if (Math.abs(diff) <= (Math.PI/1.5)/2) applyDamage(e, calcDmg(80), 'melee');
                }
            }
        },
        charge: { 3: sk => sk.selectedUpg === 'B' ? startHang() : null }, // Meteor Dive: the hold is the hang (main.js startCharge)
    },
    'Spellweaver': { // the spells live in spellweaver.js (castSpell replaces 1-4); Arcane Beam stays here
        'rmb': () => {
            const angle = Math.atan2(mouseY - player.y, mouseX - player.x); const endX = player.x + Math.cos(angle) * 500; const endY = player.y + Math.sin(angle) * 500;
            effects.push({ type: 'arcane_beam', x1: player.x + Math.cos(angle) * 45, y1: player.y + Math.sin(angle) * 45, x2: endX, y2: endY, life: 0.45, maxLife: 0.45 });
            beamCast(player.x + Math.cos(angle) * 45, player.y + Math.sin(angle) * 45, endX, endY); // combos.js: a Frost Nova right after freezes this line into an Ice Wall
            const l2 = 500*500;
            for(let i=enemies.length-1; i>=0; i--) {
                const e = enemies[i]; let t = ((e.x - player.x) * (endX - player.x) + (e.y - player.y) * (endY - player.y)) / l2; t = Math.max(0, Math.min(1, t));
                const projX = player.x + t * (endX - player.x); const projY = player.y + t * (endY - player.y);
                if (Math.hypot(e.x - projX, e.y - projY) < e.size/2 + 20) {
                    applyDamage(e, calcDmg(120), 'magic');
                    burst(e.x, e.y, angle, 1.4, 8, { kind: 'spark', color: '#b388ff', size: 2.2, life: 0.25, speed: [150, 350], drag: 5 });
                }
            }
        }
    },
    'Ranger': {
        // Storm Arrow: hold Q to draw (slower while drawing, no basics), release to fire (main.js startCharge / releaseCharge).
        // k (0..1) is how far it was drawn: 40% damage on a tap, 100% fully drawn, and the line widens. The streak it
        // leaves strikes the line again a moment later at half. Ballista Shot: a full draw hurls the line back; Hunter's Mark:
        // the first enemy hit is the prey (talents.js: Steady Hands, Broadhead and the paths under them).
        1: (sk, dmg, k = 1, opt = {}) => { // opt.skyline: loosed from a Vault (combos.js Skyline Shot), drawn and x1.25
            const ang = Math.atan2(mouseY - player.y, mouseX - player.x), full = k >= 1;
            const hit = dmg * (0.4 + 0.6 * k) * (opt.skyline ? SKYLINE_MULT : 1), width = (14 + 16 * k) * (hasTalent('storm_broad') ? 1.5 : 1);
            const x1 = player.x + Math.cos(ang) * 20, y1 = player.y + Math.sin(ang) * 20;
            let x2 = player.x + Math.cos(ang) * STORM_RANGE, y2 = player.y + Math.sin(ang) * STORM_RANGE;
            const wall = clipToWalls(x1, y1, x2, y2, 0, true); if (wall) [x2, y2] = wall; // stage.js: rock stops it
            const onLine = e => !e.dead && distToSegment(e.x, e.y, x1, y1, x2, y2) < e.size / 2 + width / 2;
            const struck = enemies.filter(onLine);
            for (const e of struck) applyDamage(e, hit, 'ranged', ang);
            if (sk.selectedUpg === 'B') { // Hunter's Mark: the first one it reached
                const first = struck.filter(e => !e.dead && !e.pod).sort((a, b) => Math.hypot(a.x - x1, a.y - y1) - Math.hypot(b.x - x1, b.y - y1))[0];
                if (first) markPrey(first);
            }
            if (full && sk.selectedUpg === 'A') ballistaPush(struck, ang, hit);
            if (full) thunderstormVolley(x1, y1, x2, y2); // combos.js: a full draw through a Volley still falling turns its arrows to lightning
            effects.push({ type: 'thunderclap', x: x1, y: y1, angle: ang, life: 0.25, maxLife: 0.25 });
            effects.push({ type: 'storm_shot', x1, y1, x2, y2, width, charge: k, life: 0.55, maxLife: 0.55 });
            addShake(full ? 2.5 : 1);
            if (full && hasItem('Eye of the Storm')) cooldowns.s4 = Math.max(0, cooldowns.s4 - 2); // items.js: a full draw hurries the Volley
            after(STORM_STRIKE_DELAY, () => {
                effects.push({ type: 'storm_strike', x1, y1, x2, y2, width, charge: k, life: 0.35, maxLife: 0.35 });
                for (const e of enemies) if (onLine(e)) applyDamage(e, hit * 0.5, 'magic', ang);
            });
        },
        2: (sk) => { // Nature's Stride: a heal and a burst of speed; Windwalk: shots pass through you; Hunter's Focus: a turret window
            player.hp = Math.min(player.maxHp, player.hp + calcUtility(15, sk.level) * (hasTalent('stride_herb') ? 1.5 : 1));
            buffs.msBoost = calcUtility(2.0, sk.level) + (hasTalent('stride_light') ? 1 : 0);
            if (sk.selectedUpg === 'A') { buffs.windwalk = hasTalent('ww_long') ? 3.5 : 2; player.slipUsed = false; }
            if (sk.selectedUpg === 'B') buffs.focus = hasTalent('focus_long') ? 6 : 4;
            effects.push({ type: 'wind_swirl', x: player.x, y: player.y, radius: 60, color: sk.selectedUpg === 'A' ? '#e0f7fa' : '#4caf50', life: 0.6, maxLife: 0.6 }); updateHUD();
            galeVolley(); // combos.js: a Volley still falling is caught by the gust
        },
        3: (sk, dmg) => { // Vault: a quick hop through the air. Disengage flips you away from the cursor; Twin Vault has charges.
            const away = sk.selectedUpg === 'A';
            let [dx, dy, dist] = getVector(player.x, player.y, mouseX, mouseY);
            if (!(dist > 0)) { dx = 1; dy = 0; dist = 1; }
            if (away) { dx = -dx; dy = -dy; }
            const moveDist = away ? vaultReach(sk) : Math.min(dist, vaultReach(sk)); // ranks: farther; Long Strides
            const ang = Math.atan2(dy, dx);
            dustPuff(player.x, player.y, ang + Math.PI, 1.8, 4);
            burst(player.x, player.y, ang + Math.PI, 1.6, 5, { kind: 'leaf', color: '#81c784', size: 6, life: 0.5, speed: [80, 180], drag: 4 });
            if (away) { // Disengage: the next basic is a spread (talents.js: brambles behind, a quicker escape, three spreads)
                buffs.disengage = 2; player.disengageShots = hasTalent('dis_hitrun') ? 3 : 1;
                if (hasTalent('dis_bramble')) effects.push({ type: 'thorn_patch', x: player.x, y: player.y, radius: 75, life: 3, maxLife: 3, dmg: calcDmg(activeClass.basicDmg) * 0.5, slow: 0.5 });
                if (hasTalent('dis_quick') && getNearestEnemyFromPoint(player.x, player.y, 150)) cooldowns.s3 *= 0.6;
            }
            if (sk.selectedUpg === 'B') spendVaultCharge();
            if (hasTalent('tv_momentum')) player.momentum = 0.20;
            if (hasTalent('tv_guard')) buffs.tvGuard = 1.5;
            startDash({
                x: player.x + (dx / dist) * moveDist, y: player.y + (dy / dist) * moveDist,
                dur: 0.2 + moveDist / 3000, arc: 20 + moveDist * 0.08, kind: 'vault',
                ghost: { color: '#a5d6a7', glow: false, every: 0.04 },
                onArrive: () => {
                    effects.push({ type: 'vault_land', x: player.x, y: player.y, life: 0.35, maxLife: 0.35 });
                    if (hasTalent('tv_storm')) { // Storm Hopper
                        const e = getNearestEnemyFromPoint(player.x, player.y, 300);
                        if (e) { effects.push({ type: 'lightning', x1: e.x + jitter(40), y1: e.y - 260, x2: e.x, y2: e.y, color: '#80d8ff', life: 0.25, maxLife: 0.25 }); applyDamage(e, dmg * 2, 'magic'); }
                    }
                }
            });
        },
        4: (sk, dmg) => { // Volley: arrows loosed into the sky rain down on the target area (Storm Rain: a cloud that keeps raining;
            // Focused Barrage: every arrow on one enemy)
            const storm = sk.selectedUpg === 'A', focus = sk.selectedUpg === 'B';
            const [dx, dy, dist] = getVector(player.x, player.y, mouseX, mouseY);
            const reach = Math.min(dist, 500);
            const [tx, ty] = dist > 0 ? clampPointToMap(player.x + (dx/dist)*reach, player.y + (dy/dist)*reach, 20) : [player.x, player.y];
            const radius = 110 * (hasTalent('volley_wide') ? 1.3 : 1), hitR = 24;
            const T = storm ? (hasTalent('rain_long') ? RAIN_LONG : RAIN_TIME) : 0;
            const count = storm ? Math.round(RAIN_RATE * T) : focus && hasTalent('barrage_more') ? 14 : 10;
            const delay = 0.45, spread = storm ? T : 0.35;
            const arrows = [];
            const inCircle = (e, cx, cy) => !e.dead && !e.pod && !(e.spawnT > 0) && Math.hypot(e.x - cx, e.y - cy) <= radius + e.size / 2;
            // The arrows spread over the enemies inside the circle and follow them until they land; with nobody inside they scatter.
            // Per volley, the first arrow on an enemy deals full damage and every further one VOLLEY_FALLOFF (Barrage: the first 6 full).
            const inside = enemies.filter(e => inCircle(e, tx, ty)).sort(() => Math.random() - 0.5);
            let prey = focus ? enemies.filter(e => inCircle(e, tx, ty)).sort((a, b) => Math.hypot(a.x - mouseX, a.y - mouseY) - Math.hypot(b.x - mouseX, b.y - mouseY))[0] : null;
            const hits = new Map(); let landed = 0;
            // volley: combos.js can still change the arrows that haven't landed (Gale Volley: E, Thunderstorm: a Storm Arrow through it)
            const rainFx = { type: 'arrow_rain', volley: true, castAt: fxTime, x: tx, y: ty, sx: player.x, sy: player.y, radius, arrows, heavy: false, life: delay + spread + 1.6, maxLife: delay + spread + 1.6 };
            // One arrow coming down. prev: a Gale Volley second strike, which reuses what the arrow did to each enemy (falloff included);
            // flat: Storm Rain's arrows, no falloff
            const strike = (ax, ay, mult, thunder, prev, flat) => {
                if (thunder) thunderstormFx(ax, ay); else arrowImpactFx(ax, ay, false); // combos.js / skillfx_ult.js
                const got = new Map();
                for (let k = enemies.length - 1; k >= 0; k--) {
                    const e = enemies[k];
                    if (e.dead || Math.hypot(e.x - ax, e.y - ay) > hitR + e.size / 2) continue;
                    let f;
                    if (prev) f = prev.has(e) ? prev.get(e) : VOLLEY_FALLOFF;
                    else if (flat) f = 1;
                    else { const n = hits.get(e) || 0; hits.set(e, n + 1); f = n < (focus ? BARRAGE_FULL : 1) ? 1 : VOLLEY_FALLOFF; }
                    got.set(e, f);
                    applyDamage(e, dmg * f * mult, thunder ? 'magic' : 'ranged');
                    if (e.dead) continue;
                    if (thunder && !e.type.startsWith('boss')) e.stunTimer = Math.max(e.stunTimer || 0, THUNDERSTORM_STUN);
                    if (hasTalent('volley_bleed')) { e.bleedTimer = 3; e.bleedDmg = Math.max(e.bleedDmg || 0, dmg * 0.15); } // Barbed Tips
                    if (focus && e === prey && hasTalent('barrage_pin')) { if (!(e.slowTimer > 0) || e.slowAmount < 0.5) e.slowAmount = 0.5; e.slowTimer = Math.max(e.slowTimer || 0, 0.6); }
                }
                return got;
            };
            for (let i = 0; i < count; i++) {
                const a = Math.random() * Math.PI * 2, r = Math.sqrt((i + Math.random()) / count) * radius; // even coverage of the circle
                let target = prey || (!storm && inside.length ? inside[i % inside.length] : null);
                const ox = jitter(18), oy = jitter(18);
                const arrow = { x: tx + Math.cos(a) * r, y: ty + Math.sin(a) * r, t: storm ? delay + (i + Math.random()) / count * T : delay + Math.random() * spread };
                arrows.push(arrow);
                after(arrow.t, () => {
                    if (storm) { // a storm arrow picks its mark as it falls: anyone under the cloud now
                        const under = enemies.filter(e => inCircle(e, rainFx.x, rainFx.y));
                        target = under.length ? under[(Math.random() * under.length) | 0] : null;
                        if (!target) { const aa = Math.random() * Math.PI * 2, rr = Math.sqrt(Math.random()) * radius; arrow.x = rainFx.x + Math.cos(aa) * rr; arrow.y = rainFx.y + Math.sin(aa) * rr; }
                    }
                    if (focus && prey && prey.dead && hasTalent('barrage_split')) { prey = getNearestEnemyFromPoint(prey.x, prey.y, 300); target = prey; } // Overflow
                    if (target && !target.dead) { arrow.x = target.x + (storm ? jitter(target.size * 0.4) : ox * 0.5); arrow.y = target.y + (storm ? jitter(target.size * 0.4) : oy * 0.5); } // where it is now (or where it fell)
                    const last = ++landed === count && focus && hasTalent('barrage_finale'), thunder = rainFx.storm || last;
                    const got = strike(arrow.x, arrow.y, (last ? BARRAGE_FINALE : 1) * (rainFx.storm ? THUNDERSTORM_MULT : 1) * (storm ? RAIN_MULT : 1), thunder, null, storm);
                    if (last && target && !target.dead) target.stunTimer = Math.max(target.stunTimer || 0, 1.0); // Final Shaft
                    if (last && focus && prey && !prey.dead && hasTalent('barrage_pin')) prey.rootedTimer = Math.max(prey.rootedTimer || 0, 1.0);
                    if (rainFx.gale) after(GALE_DELAY, () => { // the gust drives it in again
                        const gx = target && !target.dead ? target.x : arrow.x, gy = target && !target.dead ? target.y : arrow.y;
                        galeStrikeFx(gx, gy, rainFx); strike(gx, gy, GALE_MULT * (rainFx.storm ? THUNDERSTORM_MULT : 1) * (storm ? RAIN_MULT : 1), rainFx.storm, got);
                    });
                });
            }
            if (focus && hasTalent('barrage_pin') && !hasTalent('barrage_finale')) after(delay + spread + 0.05, () => { if (prey && !prey.dead) prey.rootedTimer = Math.max(prey.rootedTimer || 0, 1.0); });
            if (storm) stormCloud(rainFx, T + delay, dmg); // the cloud overhead: it drifts, slows, throws lightning (talents.js)
            effects.push(rainFx);
        },
        charge: { 1: (sk) => { // Storm Arrow is held, not tapped
            effects.push({ type: 'storm_charge', life: 1, maxLife: 1, customUpdate: (dt, ef) => { ef.life = player.charge ? 1 : 0; } }); // skillfx_rmb.js: aim line while held
            return { max: STORM_CHARGE_TIME * (hasTalent('storm_steady') ? 0.7 : 1), slow: 0.7 }; // talents.js Steady Hands
        } },
        'rmb': () => { // Chain Lightning (Stormcaller Bow): three lightning bolts in a fan, each jumping between enemies
            const base = Math.atan2(mouseY - player.y, mouseX - player.x), target = aimAssistTarget();
            effects.push({ type: 'thunderclap', x: player.x + Math.cos(base) * 20, y: player.y + Math.sin(base) * 20, angle: base, life: 0.25, maxLife: 0.25 });
            for (let j = -1; j <= 1; j++) {
                const a = base + j * 0.22;
                projectiles.push({ x: player.x, y: player.y, vx: Math.cos(a)*1100, vy: Math.sin(a)*1100, radius: 9, color: '#80d8ff', life: 1.2, type: 'ricochet', shape: 'storm_arrow', damage: calcDmg(40), pierce: false, isEnemy: false, bounces: 3, hitList: [], homeTarget: j === 0 ? target : null });
            }
        }
    },
    'Nightblade': {
        canCast: (i) => { // Mark for Death needs someone to mark; refusing keeps the cooldown
            if (i !== 4 || markForDeathTarget()) return true;
            effects.push({ type: 'text', text: 'No target', x: player.x, y: player.y - 40, color: '#ff5252', life: 0.6, maxLife: 0.6 });
            return false;
        },
        1: (sk, dmg) => {
            const baseAngle = Math.atan2(mouseY - player.y, mouseX - player.x);
            let count = 5; let pierce = sk.selectedUpg === 'A'; let returnDmg = sk.selectedUpg === 'B';
            effects.push({ type: 'knife_fan', x: player.x, y: player.y, angle: baseAngle, life: 0.2, maxLife: 0.2 });
            for(let i=0; i<count; i++) {
                let angle = baseAngle - 0.4 + (i * 0.2);
                projectiles.push({ x: player.x, y: player.y, vx: Math.cos(angle)*800, vy: Math.sin(angle)*800, radius: 5, color: '#e1bee7', life: 1.0, type: pierce?'pierce':'fan_of_knives', shape: 'knife', damage: dmg, pierce: pierce, hitList: [], isEnemy: false, source: 'fan_of_knives', returning: false, returnDmg: returnDmg });
            }
        },
        2: (sk, dmg) => {
            let radius = sk.selectedUpg === 'B' ? 250 : 150; let poison = sk.selectedUpg === 'A';
            let particles = [];
            for (let i = 0; i < 20; i++) {
                particles.push({
                    xOffset: (Math.random() - 0.5) * radius * 0.8,
                    yOffset: (Math.random() - 0.5) * radius * 0.8,
                    r: radius * (0.3 + Math.random() * 0.5),
                    rotSpeed: (Math.random() - 0.5) * 1.5,
                    startAng: Math.random() * Math.PI * 2
                });
            }
            let smokeColor = poison ? 'rgba(76, 175, 80, 0.7)' : 'rgba(80, 80, 80, 0.7)';
            let duration = calcUtility(5.0, sk.level);
            effects.push({ type: 'smoke_bomb', x: player.x, y: player.y, radius: radius, color: smokeColor, life: duration, maxLife: duration, poison: poison, dmg: dmg, particles: particles });
            if (sk.selectedUpg === 'B') { buffs.slowed = 0; buffs.rooted = 0; }
        },
        3: (sk, dmg) => { // Phantom Dash: a blur of shadow that cuts everything it passes through
            const [dx, dy, dist] = getVector(player.x, player.y, mouseX, mouseY);
            let moveDist = sk.selectedUpg === 'A' ? Math.min(dist, 600) : Math.min(dist, 300);
            let pDashAngle = Math.atan2(dy, dx);
            const hitList = [];
            const trail = { type: 'dash_trail', x1: player.x, y1: player.y, x2: player.x, y2: player.y, color: '#9c27b0', width: 18, life: 0.35, maxLife: 0.35 };
            effects.push(trail);
            burst(player.x, player.y, 0, Math.PI * 2, 5, { kind: 'smoke', color: '#311b92', size: 6, grow: 26, life: 0.5, speed: [30, 90], drag: 3 });
            player.iFrames = 0.4;
            const smoke = smokeStepStart(); // combos.js Smoke Step: dashing out of your own Smoke Bomb
            startDash({
                x: player.x + (dx/dist)*moveDist, y: player.y + (dy/dist)*moveDist,
                dur: 0.08 + moveDist / 6000, ease: 'out', kind: 'phantom_dash', trail,
                onArrive: () => smokeStep(smoke),
                ghost: { color: '#b388ff', glow: true, every: 0.012, life: 0.22 },
                onStep: (x0, y0, x1, y1) => { // hits whatever the dash passes through this frame
                    for(let i=enemies.length-1; i>=0; i--) {
                        const e = enemies[i];
                        if (e.dead || hitList.includes(e) || distToSegment(e.x, e.y, x0, y0, x1, y1) >= e.size/2 + 20) continue;
                        hitList.push(e);
                        applyDamage(e, dmg, 'phantom_dash', pDashAngle);
                        effects.push({ type: 'shadow_cut', x: e.x, y: e.y, angle: pDashAngle, radius: e.size * 0.6 + 16, life: 0.3, maxLife: 0.3 });
                        shadowStrike(e, pDashAngle); // combos.js: through the Marked target, an extra clone strike
                    }
                }
            });
            if (sk.selectedUpg === 'B') {
                if (!player.phantomChargeUsed) { player.phantomChargeUsed = true; cooldowns.s3 = 0.5; }
                else { player.phantomChargeUsed = false; }
            }
        },
        // Mark for Death: one target (canCast picks it). Shadow clones strike it MFD_STRIKES times, each from a fresh weak side,
        // so every strike pops a weak point ('death_mark' source, combat.js). An assassin's ult: a boss-killer, not a swarm-clearer.
        // Chain Reaction: if the target dies, the mark and the strikes left jump to the nearest enemy.
        4: (sk, dmg) => {
            let target = markForDeathTarget();
            buffs.deathMarkActive = calcUtility(5.0, sk.level);
            buffs.markTarget = target; buffs.markDmg = dmg; buffs.shadowStrikes = 0; // combos.js Shadow Strike
            effects.push({ type: 'death_mark_wave', x: target.x, y: target.y, radius: target.size / 2 + 90, life: 0.6, maxLife: 0.6 });
            effects.push({ type: 'text', text: 'MARKED FOR DEATH', x: target.x, y: target.y - target.size / 2 - 30, color: '#ce93d8', life: 1.0, maxLife: 1.0 });
            for (let k = 0; k < MFD_STRIKES; k++) after(0.2 + k * MFD_GAP, () => {
                if (target.dead) {
                    if (sk.selectedUpg !== 'B') return;
                    const next = getNearestEnemyFromPoint(target.x, target.y, 300, [target]);
                    if (!next) return;
                    target = next; buffs.markTarget = target;
                    effects.push({ type: 'text', text: 'MARKED', x: target.x, y: target.y - 40, color: '#ce93d8', life: 0.6, maxLife: 0.6 });
                }
                const markAng = Math.random() * Math.PI * 2; // a fresh weak side for every clone
                target.markAngle = markAng;
                const startX = target.x + Math.cos(markAng) * 200, startY = target.y + Math.sin(markAng) * 200;
                const dashAngle = Math.atan2(target.y - startY, target.x - startX);
                // a shadow clone blinks in on the weak side and stabs straight through
                effects.push({ type: 'clone_strike', x0: startX, y0: startY, x1: target.x + Math.cos(dashAngle) * 40, y1: target.y + Math.sin(dashAngle) * 40, angle: dashAngle, life: 0.4, maxLife: 0.4 });
                effects.push({ type: 'shadow_cut', x: target.x, y: target.y, angle: dashAngle, radius: target.size * 0.6 + 18, life: 0.3, maxLife: 0.3 });
                if (sk.selectedUpg === 'A') player.hp = Math.min(player.maxHp, player.hp + player.maxHp * 0.02); // Bloodlust
                applyDamage(target, dmg * MFD_MULT, 'death_mark', dashAngle);
            });
        },
        'rmb': () => { // Expose (Shadowstrike Daggers): every enemy in a cone in front of you shows a weak point on the side facing you
            const ang = Math.atan2(mouseY - player.y, mouseX - player.x), R = 300, half = Math.PI / 3;
            effects.push({ type: 'expose_wave', x: player.x, y: player.y, angle: ang, radius: R, half, life: 0.45, maxLife: 0.45 }); // skillfx_rmb.js
            for (const e of enemies) {
                if (e.dead || e.pod || e.invulnerable || Math.hypot(e.x - player.x, e.y - player.y) > R + e.size / 2) continue;
                const diff = Math.atan2(Math.sin(Math.atan2(e.y - player.y, e.x - player.x) - ang), Math.cos(Math.atan2(e.y - player.y, e.x - player.x) - ang));
                if (Math.abs(diff) > half) continue;
                e.markAngle = Math.atan2(player.y - e.y, player.x - e.x); // the weak side faces the Nightblade
                burst(e.x + Math.cos(e.markAngle) * e.size * 0.5, e.y + Math.sin(e.markAngle) * e.size * 0.5, e.markAngle, 1.2, 5, { kind: 'spark', color: '#ea80fc', size: 2, life: 0.3, speed: [60, 160], drag: 5 });
            }
        }
    },
    'Machinist': {
        // Q: tap for a plain turret; with 5+ Scrap, hold to build a Heavy (0.4 s) or Siege (0.9 s) turret (main.js charge)
        canCast: (i) => {
            if (i !== 1 || turretRoom()) return true;
            effects.push({ type: 'text', text: 'Turret limit: big turrets standing', x: player.x, y: player.y - 40, color: '#ff5252', life: 0.8, maxLife: 0.8 });
            return false;
        },
        charge: { 1: () => {
            if ((player.scrap || 0) < 5) return null; // nothing to pour in: Q places a plain turret at once
            effects.push({ type: 'turret_build', life: 1, maxLife: 1, customUpdate: (dt, ef) => { ef.life = player.charge && player.charge.slot === 1 ? 1 : 0; } }); // skillfx.js
            return { max: TURRET_BUILD_TIME, slow: 0.8 };
        } },
        1: (sk, dmg, k) => {
            let tier = turretTierFromHold(k);
            if (!tier && buffs.overclockTimer > 0 && hasItem('Overclock Regulator')) tier = { ...TURRET_TIERS[1], cost: 0 }; // items.js: a free Heavy Turret while overclocked
            if (!spawnTurret(mouseX, mouseY, sk.selectedUpg, dmg, tier)) cooldowns.s1 = 0; // no room after all: the cooldown isn't spent
        },
        2: (sk, dmg) => {
            const [dx, dy, dist] = getVector(player.x, player.y, mouseX, mouseY);
            let tx = player.x + (dx/dist)*Math.min(dist, 400); let ty = player.y + (dy/dist)*Math.min(dist, 400);
            let isRoot = sk.selectedUpg === 'A'; let isNetwork = sk.selectedUpg === 'B';
            projectiles.push({
                x: tx, y: ty, vx: 0, vy: 0, radius: 15, color: '#00e5ff', life: 8.0, type: 'tesla_coil_trap', damage: dmg, isEnemy: false, tickTimer: 0, rootedList: [], fieldRadius: isRoot ? 200 : 150,
                customUpdate: function(dt, p) {
                    rideCoil(this); // combos.js Conductive Net: latched onto a netted enemy, it goes where it goes
                    this.tickTimer -= dt;
                    if (this.tickTimer <= 0) {
                        effects.push({ type: 'tesla_pulse', x: this.x, y: this.y, radius: isRoot ? 200 : 150, life: 0.3, maxLife: 0.3 });
                        let zaps = 0;
                        for (let i = enemies.length - 1; i >= 0; i--) {
                            let e = enemies[i];
                            if (Math.hypot(e.x - this.x, e.y - this.y) < (isRoot ? 200 : 150) + e.size/2) {
                                if (zaps++ < 5) effects.push({ type: 'lightning', x1: this.x, y1: this.y, x2: e.x, y2: e.y, color: '#00e5ff', life: 0.15, maxLife: 0.15 });
                                applyDamage(e, this.damage, 'magic');
                                e.shockTimer = 0.6;
                                // High Voltage: root each enemy once per coil, when it first enters the field
                                if (isRoot && !this.rootedList.includes(e)) { e.rootedTimer = 1.0; this.rootedList.push(e); }
                            }
                        }
                        if (isNetwork) {
                            for (let t of projectiles) {
                                if (t.type === 'turret' && Math.hypot(t.x - this.x, t.y - this.y) < 400) {
                                    effects.push({ type: 'lightning', x1: this.x, y1: this.y, x2: t.x, y2: t.y, color: '#00e5ff', life: 0.2, maxLife: 0.2 });
                                    for(let i = enemies.length - 1; i >= 0; i--) { 
                                        let e = enemies[i];
                                        if (distToSegment(e.x, e.y, this.x, this.y, t.x, t.y) < e.size/2 + 20) applyDamage(e, this.damage * 0.5, 'magic'); // half a pulse per line 
                                    }
                                }
                            }
                        }
                        this.tickTimer = 0.5;
                    }
                }
            });
            coilPlaced(projectiles[projectiles.length - 1]); // combos.js: onto a netted enemy (Conductive Net) or a turret (Tesla Turret)
        },
        3: (sk, dmg) => {
            let targetX = mouseX; let targetY = mouseY;
            let foundTarget = false, anchor = null; // anchor: the turret or coil it latches onto (combos.js Overload)
            for (let p of projectiles) {
                if ((p.type === 'turret' || p.type === 'tesla_coil_trap') && Math.hypot(p.x - mouseX, p.y - mouseY) < 50) {
                    targetX = p.x; targetY = p.y; foundTarget = true; anchor = p; break;
                }
            }
            if (!foundTarget) cooldowns.s3 += grappleMissPenalty(sk.level); // ranks: a smaller penalty for open ground
            
            if (sk.selectedUpg === 'A') addShield(calcUtility(100, sk.level), calcUtility(4.0, sk.level));
            if (sk.selectedUpg === 'B') {
                // Hologram absorbs one enemy projectile, and nearby non-bosses go after it for its 2 s (the taunt in main.js)
                let decoyX = player.x; let decoyY = player.y;
                player.phantomDecoy = { x: decoyX, y: decoyY, life: 2.0 };
                for(let e of enemies) {
                    if (e.dead || e.type.startsWith('boss') || Math.hypot(e.x - decoyX, e.y - decoyY) >= 300) continue;
                    if (!e.state || e.state === 'idle') { e.tauntTimer = 2.0; e.tauntX = decoyX; e.tauntY = decoyY; } // never cut an attack wind-up short
                }
            }
            
            let [dx, dy, ddist] = getVector(player.x, player.y, targetX, targetY);
            if (ddist > 10) {
                player.grappleTarget = { x: targetX, y: targetY, kind: 'magnet', anchor, onArrive: () => magClank(targetX, targetY) };
                burst(player.x, player.y, Math.atan2(dy, dx), 0.6, 6, { kind: 'spark', color: '#80d8ff', size: 2, life: 0.2, speed: [200, 400], drag: 5 });
            }
        },
        4: (sk, dmg) => {
            const duration = calcUtility(6.0, sk.level) + (hasItem('Overclock Regulator') ? 2 : 0); // items.js
            buffs.overclockTimer = duration; buffs.overclockMax = duration;
            lightningRod(); // combos.js: cast inside your own coil's field, you absorb it
            effects.push({ type: 'overclock_burst', life: 0.6, maxLife: 0.6 });
            for(let p of projectiles) { if (p.type === 'turret' || p.type === 'tesla_coil_trap') p.life = p.type === 'turret' ? (p.maxLife || 10.0) : 8.0; } // a Siege Turret refreshes to its own 15 s
            if (sk.selectedUpg === 'B') {
                const turretSkill = activeClass.skills[1];
                const turretDmg = calcDmg(turretSkill.baseDmg, Math.max(1, turretSkill.level));
                // the two turrets drop in from the sky, one after the other
                spawnTurret(player.x - 30, player.y, turretSkill.selectedUpg, turretDmg); projectiles[projectiles.length - 1].dropIn = 0.35;
                spawnTurret(player.x + 30, player.y, turretSkill.selectedUpg, turretDmg); projectiles[projectiles.length - 1].dropIn = 0.5;
            }
            if (sk.selectedUpg === 'A') {
                // Nuclear Payload: when Overclock ends, every turret detonates (volatile turrets explode for 3x their damage on expiry)
                after(duration, () => {
                    for (let p of projectiles) {
                        if (p.type === 'turret') { p.life = 0; p.volatile = true; }
                    }
                });
            }
        },
        'rmb': () => {
            const angle = Math.atan2(mouseY - player.y, mouseX - player.x);
            projectiles.push({ 
                x: player.x, y: player.y, 
                vx: Math.cos(angle) * 700, vy: Math.sin(angle) * 700, 
                radius: 25, color: '#b0bec5', life: 1.5, 
                type: 'net_throw', shape: 'net', damage: calcDmg(10), 
                pierce: false, hitList: [], isEnemy: false 
            });
        }
    },
};

var BasicAttackRegistry = {
    'phantom_blade': (dmg) => {
        if (player.stance === 'handheld') {
            // Handheld flow damage bonus: up to +50% dmg based on flow
            dmg *= 1.0 + (player.flow / Math.max(1, player.maxFlow)) * BLADE_FLOW_BONUS; // Razor's Edge: up to +150%
            const attackAngle = Math.atan2(mouseY - player.y, mouseX - player.x);

            let step = player.comboStep || 0;
            player.lastAttackStep = step;
            player.comboStep = (step + 1) % 3;
            player.comboTimer = 1.0; // Wait 1s max before resetting back to 1st hit

            let hitRadius = (step === 2) ? 170 : 130; 
            let effectType = (step === 2) ? 'precision_thrust' : 'precision_slash';
            let angleThreshold = (step === 2) ? (Math.PI/6) : (Math.PI/3); 
            
            // On step 1, we flip the rendering visually for alternate swipe in main.js, but here logic is symmetrical
            effects.push({ type: effectType, x: player.x, y: player.y, radius: hitRadius, angle: attackAngle, color: '#00e5ff', life: 0.15, maxLife: 0.15 }); 
            
            let hitAnything = false;
            for(let i=enemies.length-1; i>=0; i--) {
                const e = enemies[i];
                if (Math.hypot(player.x-e.x, player.y-e.y) <= hitRadius + e.size/2) {
                    let diff = Math.atan2(e.y-player.y, e.x-player.x) - attackAngle; 
                    while(diff < -Math.PI) diff += Math.PI*2; while(diff > Math.PI) diff -= Math.PI*2;
                    
                    if (Math.abs(diff) <= angleThreshold) { 
                        let mult = (step === 2) ? 1.5 : 1.0; // 3rd hit deals 50% more dmg
                        applyDamage(e, dmg * mult, 'slash'); 
                        hitAnything = true;
                    }
                }
            }
            if (hitAnything) {
                let flowGain = (step === 2) ? 20 : 10;
                if (equipment.gloves && equipment.gloves.name === 'Aether Grips') flowGain *= 1.1; // +10% more Flow
                player.flow = Math.min(player.maxFlow, player.flow + flowGain);
                player.flowGainTimer = 0;
            }
        } else if (player.stance === 'airborne') {
            // In airborne mode, basic attack doesn't strictly fire a one-off projectile anymore.
            // The AI companion loop handles continuous damage and following mouse smoothly.
        }
    },
    'censer': (dmg) => {
        const attackAngle = Math.atan2(mouseY - player.y, mouseX - player.x);
        projectiles.push({
            x: player.x, y: player.y, vx: Math.cos(attackAngle) * 500, vy: Math.sin(attackAngle) * 500, radius: 12,
            color: buffs.lastSpellClass === 'shadow' ? '#9c27b0' : '#fbc02d', life: 0.8, type: 'censer_pulse', shape: 'circle',
            damage: dmg, pierce: true, hitList: [], isEnemy: false,
            isInSanctuary: buffs.inSanctuary // doubles zeal gained if fired from inside a Sanctuary
        });
    },
    // Dragonknight: heavy is the charge of a held swing (skills.js updateHeavySwing), null for a light one;
    // whirl is the Thunder Leap finisher (combos.js): the same swing spun all the way round, harder
    'sword': (dmg, _, heavy, whirl = false) => {
        const attackAngle = Math.atan2(mouseY - player.y, mouseX - player.x);
        const k = heavy === null ? -1 : heavy, full = k >= 1, fire = buffs.dragonfire > 0, E = activeClass.skills[2];
        if (k >= 0) dmg *= 1 + (SLAM_FULL - 1) * k * k; // the payoff is in a full charge
        if (fire) dmg *= 1 + dragonfireBonus();
        if (whirl) dmg *= WHIRL_MULT;
        const reach = (k < 0 ? 130 : 130 + 40 * k) + (fire ? DRAGONFIRE_REACH : 0) + (whirl ? WHIRL_REACH : 0), half = whirl ? Math.PI : k < 0 ? Math.PI / 3 : Math.PI / 3.6;
        if (whirl) effects.push({ type: 'wyrm_whirl', radius: reach, angle: attackAngle, fire, full, life: 0.4, maxLife: 0.4 }); // skillfx.js
        else effects.push({ type: 'slash', x: player.x, y: player.y, radius: reach, angle: attackAngle, color: fire ? '#ff7043' : '#e0e0e0', life: k < 0 ? 0.15 : 0.22, maxLife: k < 0 ? 0.15 : 0.22 });
        const hitList = [];
        for(let i=enemies.length-1; i>=0; i--) {
            const e = enemies[i];
            if (Math.hypot(player.x-e.x, player.y-e.y) <= reach + e.size/2) {
                let diff = Math.atan2(e.y-player.y, e.x-player.x) - attackAngle; while(diff < -Math.PI) diff += Math.PI*2; while(diff > Math.PI) diff -= Math.PI*2;
                if (Math.abs(diff) <= half) { applyDamage(e, dmg, 'melee_basic'); hitList.push(e); }
            }
        }
        if (full) { // the blade bites into the ground: a shockwave at the impact point catches what the edge missed, and staggers
            // (a whirl has hit everything around already; its shockwave just staggers the whole ring)
            const ix = whirl ? player.x : player.x + Math.cos(attackAngle) * (reach - 45), iy = whirl ? player.y : player.y + Math.sin(attackAngle) * (reach - 45), SR = whirl ? reach : 85;
            if (!whirl) effects.push({ type: 'heavy_slam', x: ix, y: iy, radius: 85, angle: attackAngle, fire, life: 0.45, maxLife: 0.45 }); // skillfx.js
            addShake(whirl ? 4 : 3);
            for (const e of enemies) {
                if (e.dead || Math.hypot(e.x - ix, e.y - iy) > SR + e.size / 2) continue;
                if (!hitList.includes(e)) { applyDamage(e, dmg * 0.5, 'melee'); hitList.push(e); }
                if (!e.type.startsWith('boss')) e.stunTimer = Math.max(e.stunTimer || 0, 0.3);
            }
            if (hitList.length) addFrenzy(1); // a slam stokes an extra stack, so the slower rhythm still builds Frenzy
        }
        if (full) for (const e of hitList) if (e.lodgedShield && e.lodgedShield.lodged) ripShield(e.lodgedShield, e); // Hunting Shield: the slam tears it out
        if (full && hasTalent('sunder_brittle')) for (const e of hitList) if (!e.dead && e.sunderUntil > fxTime && !e.type.startsWith('boss')) e.stunTimer = Math.max(e.stunTimer || 0, 1.0); // talents.js Brittle Scales
        if (fire && hitList.length) {
            const burn = calcDmg(E.baseDmg, E.level) * 0.3; // per second for 3 s; refreshes, doesn't stack (main.js)
            for (const e of hitList) if (!e.dead) igniteEnemy(e, burn);
            if (E.selectedUpg === 'B') { // Wyrmblood: the fire feeds you
                addShield(calcUtility(5, E.level) * Math.min(3, hitList.length), 4.0);
                player.hp = Math.min(player.maxHp, player.hp + player.maxHp * (hasTalent('wyrm_heal') ? 0.02 : 0.01)); // talents.js Ember Heart
            }
        }
        if (fire && full) batShield(attackAngle, reach, half, calcDmg(E.baseDmg, E.level) * 0.3); // combos.js Rebound: a burning full slam bats the returning shield back out
        if (fire && full && E.selectedUpg === 'A') { // Inferno Edge: the slam erupts in a ring of fire around you
            const RR = hasTalent('inferno_wide') ? 210 : 150, ring = calcDmg(E.baseDmg, E.level); // talents.js Firestorm
            effects.push({ type: 'inferno_ring', x: player.x, y: player.y, radius: RR, life: 0.5, maxLife: 0.5 }); // skillfx.js
            for (const e of enemies) if (!e.dead && Math.hypot(e.x - player.x, e.y - player.y) <= RR + e.size / 2) { applyDamage(e, ring, 'magic'); if (!e.dead) igniteEnemy(e, ring * 0.3); }
            if (hasTalent('inferno_scorch')) effects.push({ type: 'fire_puddle', x: player.x, y: player.y, radius: RR, color: 'rgba(255, 87, 34, 0.3)', life: 3, maxLife: 3, dmg: ring }); // Scorched Earth (main.js burns what stands in it)
        }
        if (fire && k < 0 && !whirl && hasTalent('inferno_wave')) // Flame Wave: a light swing sends the fire on ahead
            projectiles.push({ x: player.x + Math.cos(attackAngle) * 40, y: player.y + Math.sin(attackAngle) * 40, vx: Math.cos(attackAngle) * 760, vy: Math.sin(attackAngle) * 760, radius: 22, color: '#ff7043', life: 230 / 760, type: 'pierce', shape: 'breath', breath: 'fire', damage: dmg * 0.5, pierce: true, hitList: [], isEnemy: false });
        if (player.frenzyStacks >= 10 && hasItem('Berserker Gauntlets')) basicHitHeal(hitList.length); // items.js (10+ stacks, so the Wyrmheart Pendant's higher cap doesn't put it out of reach)
    },
    'staff': (dmg, isResonance) => {
        const angle = Math.atan2(mouseY - player.y, mouseX - player.x);
        const staffTipX = player.x + Math.cos(angle) * 45; const staffTipY = player.y + Math.sin(angle) * 45;
        const [dx, dy, dist] = getVector(staffTipX, staffTipY, mouseX, mouseY);
        if (dist > 0) {
            // Only a Resonance-charged bolt explodes (main.js checks p.resonance); plain bolts hit one target
            projectiles.push({ x: staffTipX, y: staffTipY, vx: (dx/dist)*700, vy: (dy/dist)*700, radius: 6, color: isResonance ? '#2196f3' : '#ffca28', life: 1.5, type: 'basic', shape: 'fireball', damage: dmg, pierce: false, hitList: [], isEnemy: false, resonance: isResonance });
        }
    },
    'bow': (dmg) => {
        const [dx, dy, dist] = getVector(player.x, player.y, mouseX, mouseY);
        if (dist > 0) {
            // Hunter's Mark: arrows curve to the prey; Disengage: the next basic is a spread; Hunter's Focus: two (or three) arrows
            const a = Math.atan2(dy, dx), prey = preyTarget(), home = prey && Math.hypot(prey.x - player.x, prey.y - player.y) < 900 ? prey : aimAssistTarget();
            let offs = [0], pierce = false, fan = false;
            if (buffs.disengage > 0 && player.disengageShots > 0) { player.disengageShots--; const n = hasTalent('dis_spread') ? 7 : 5; offs = Array.from({ length: n }, (_, i) => (i - (n - 1) / 2) * 0.12); pierce = hasTalent('dis_spread'); fan = true; }
            else if (buffs.focus > 0) { offs = hasTalent('focus_triple') ? [-0.06, 0, 0.06] : [-0.035, 0.035]; pierce = hasTalent('focus_pierce'); }
            for (const off of offs) projectiles.push({ x: player.x, y: player.y, vx: Math.cos(a + off) * 1000, vy: Math.sin(a + off) * 1000, radius: 9, color: '#e0e0e0', life: 1.05, type: 'basic', shape: 'arrow', damage: dmg, pierce, hitList: [], isEnemy: false, resonance: false, homeTarget: fan ? null : home, markOn: prey });
            if (hasItem("Fletcher's Grips") && (player.fletch = ((player.fletch || 0) + 1) % 4) === 0) { // items.js: every 4th arrow splits
                const a = Math.atan2(dy, dx);
                for (const off of [-0.15, 0.15]) projectiles.push({ x: player.x, y: player.y, vx: Math.cos(a + off) * 1000, vy: Math.sin(a + off) * 1000, radius: 9, color: '#e0e0e0', life: 1.05, type: 'basic', shape: 'arrow', damage: dmg, pierce: false, hitList: [], isEnemy: false, resonance: false });
            }
        }
    },
    'dagger': (dmg, isResonance) => {
        dmg *= 0.5; // two thrusts per attack
        const angle = Math.atan2(mouseY - player.y, mouseX - player.x);
        let closest = getNearestEnemyFromPoint(player.x, player.y, 50);
        let dashDist1 = closest ? 0 : 30;
        player.x += Math.cos(angle) * dashDist1; player.y += Math.sin(angle) * dashDist1; clampToBounds(player, player.radius);
        
        let startX1 = player.x + Math.cos(angle - 0.4)*20; let startY1 = player.y + Math.sin(angle - 0.4)*20;
        let endX1 = startX1 + Math.cos(angle) * 90; let endY1 = startY1 + Math.sin(angle) * 90;
        effects.push({ type: 'thrust_edge', x: startX1, y: startY1, x2: endX1, y2: endY1, angle: angle, color: '#9c27b0', life: 0.15, maxLife: 0.15 });
        
        for(let i=enemies.length-1; i>=0; i--) {
            const e = enemies[i];
            if (distToSegment(e.x, e.y, startX1, startY1, endX1, endY1) <= e.size/2 + 15) applyDamage(e, dmg, 'melee_basic', angle);
        }
        
        after(0.15, () => {
            closest = getNearestEnemyFromPoint(player.x, player.y, 50);
            let dashDist2 = closest ? 0 : 15;
            player.x += Math.cos(angle) * dashDist2; player.y += Math.sin(angle) * dashDist2; clampToBounds(player, player.radius);
            
            let startX2 = player.x + Math.cos(angle + 0.4)*20; let startY2 = player.y + Math.sin(angle + 0.4)*20;
            let endX2 = startX2 + Math.cos(angle) * 90; let endY2 = startY2 + Math.sin(angle) * 90;
            effects.push({ type: 'thrust_edge', x: startX2, y: startY2, x2: endX2, y2: endY2, angle: angle, color: '#e1bee7', life: 0.15, maxLife: 0.15 });
            
            for(let i=enemies.length-1; i>=0; i--) {
                const e = enemies[i];
                if (distToSegment(e.x, e.y, startX2, startY2, endX2, endY2) <= e.size/2 + 15) applyDamage(e, dmg, 'melee_basic', angle);
            }
        });
    },
    'scattergun': (dmg) => {
        const angle = Math.atan2(mouseY - player.y, mouseX - player.x);
        let isPierce = buffs.overclockTimer > 0;
        const count = 9;
        const spread = 0.5;
        for(let i=0; i<count; i++) {
            let offset = (Math.random() * spread) - (spread / 2);
            let speedMod = 800 + Math.random() * 400;
            projectiles.push({ x: player.x, y: player.y, vx: Math.cos(angle + offset)*speedMod, vy: Math.sin(angle + offset)*speedMod, radius: 4, color: '#ffb74d', life: 0.35 + Math.random() * 0.15, type: 'scattergun', shape: 'bullet', damage: dmg * 0.3, pierce: isPierce, hitList: [], isEnemy: false });
        }
        player.x -= Math.cos(angle) * 8; player.y -= Math.sin(angle) * 8; clampToBounds(player, player.radius);
        rodBlast(dmg, angle); // combos.js Lightning Rod: chain lightning with every blast
    }
};