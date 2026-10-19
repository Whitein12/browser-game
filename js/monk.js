// ==========================================
// monk.js - The Monk: a mobile bruiser with fists (design and numbers in MONK.md)
// ==========================================
// Every cast and recast stores a Flurry charge (mk.flurry, 2 at most); the next basic spends one and becomes 4 quick blows, each
// blow that lands builds Chi, and at 100 Chi the flurry is a Hundred-Hand Strike. Every key has a recast window: the cast sets only a
// 0.3 s gap on the cooldown and the full cooldown starts when the recast is used or the window lapses (as nightblade.js nb.ret).
// Q Chi Wave / Rushing Fist (mark, dash to it). E Earth Palm / Crippling Tremor (mark an area, slow the marked). Space Swift Step /
// Iron Will (dash, then lifesteal). R Dragon Kick / Dragon's Descent (boot an enemy 350 px, then leap and stomp where it landed).
// RMB Iron Body. Space finisher: Crane Kick (combos.js). Drawn by monk_fx.js (the state below is its contract, see MONK.md).

const MK_CHI_MAX = 100, MK_CHI_PER_BLOW = 6, MK_CHI_IDLE = 6, MK_CHI_DRAIN = 10, MK_FLURRY_MAX = 2;
const MK_JAB_RANGE = 90, MK_JAB_HALF = 0.5, MK_FLURRY_RANGE = 95, MK_FLURRY_HALF = 0.7, MK_FLURRY_BLOWS = 4, MK_FLURRY_TIME = 0.3;
const MK_HUNDRED_RANGE = 110, MK_HUNDRED_HALF = Math.PI * 100 / 360, MK_HUNDRED_BLOWS = 8, MK_HUNDRED_TIME = 0.5, MK_SHOCK_R = 120, MK_SHOCK_MULT = 2.5;
const MK_CRANE_R = 110, MK_CRANE_MULT = 2.5, MK_CRANE_KNOCK = 80;
const MK_GAP = 0.3, MK_WINDOW = 3, MK_WINDOW_BOOTS = 4.5, MK_MARK_TIME = 3;
const MK_WAVE_SPEED = 1400, MK_WAVE_REACH = 600, MK_RUSH_MAX = 2; // Rushing Fist: up to x2 on a nearly dead enemy
const MK_PALM_R = 130, MK_PALM_AHEAD = 70, MK_TREMOR_R = 500, MK_TREMOR_SLOW = 0.6, MK_TREMOR_TIME = 2;
const MK_STEP_REACH = 220, MK_WILL_TIME = 4;
const MK_KICK_REACH = 100, MK_KICK_DIST = 350, MK_KICK_SPEED = 1100, MK_KICK_MULT = 0.6, MK_SLAM_MULT = 0.9, MK_BOSS_KNOCK = 40, MK_STOMP_R = 140, MK_STOMP_MULT = 0.8, MK_STOMP_WINDOW = 2;
const MK_BODY_TIME = 1.5, MK_BODY_CD = 10, MK_BODY_R = 140;

const mk = { flurry: 0, chi: 0, recast: { 1: null, 2: null, 3: null, 4: null }, ironBody: 0, ironWill: 0, kicked: [], anim: null,
    shoves: [], side: 1, hundred: false, combatT: -99, skipCombo: false, willFx: -99,
    stone: null, karma: null, prowl: 0, frenzy: false, risen: [], thornT: 0, air: false }; // the web's (the end of this file)
function resetMonk() {
    mk.flurry = 0; mk.chi = 0; mk.recast = { 1: null, 2: null, 3: null, 4: null }; mk.ironBody = mk.ironWill = 0; mk.kicked = []; mk.anim = null;
    mk.shoves = []; mk.hundred = false; mk.combatT = -99; mk.skipCombo = false; mk.willFx = -99;
    mk.stone = mk.karma = null; mk.prowl = mk.thornT = 0; mk.frenzy = mk.air = false; mk.risen = [];
}
const mkFull = slot => devNoCooldowns ? 0 : skillBaseCd(slot, activeClass.skills[slot].level) * getCDR();
const mkAim = () => Math.atan2(mouseY - player.y, mouseX - player.x);
const mkTargetable = e => !e.dead && !e.submerged && !(e.spawnT > 0) && !(e.flyUntil > fxTime);
const mkMarkable = e => mkTargetable(e) && !e.pod && !e.prop;
const mkIsBoss = e => isBossE(e);
const monkWillPct = level => 0.12 + 0.03 * level; // 15% at rank 1, +3% a rank
function mkAnim(kind, dur, angle) { mk.anim = { kind, t0: fxTime, dur, side: mk.side, angle }; }
function mkCharge() { mk.flurry = Math.min(MK_FLURRY_MAX, mk.flurry + 1); } // every cast and recast, the RMB too
function mkChi(n) { if (mk.hundred) return; mk.chi = Math.min(MK_CHI_MAX, mk.chi + n * (hasItem('Hundred-Bead Rosary') ? 1.5 : 1)); mk.combatT = fxTime; }
function mkText(text, x, y, color) { effects.push({ type: 'text', text, x, y, color, life: 0.8, maxLife: 0.8 }); }
// A recast window: the cast leaves only a short gap on the cooldown; the full one starts when the window ends
function mkOpen(slot, time, extra) {
    mk.recast[slot] = Object.assign({ t: time, max: time }, extra);
    cooldowns[`s${slot}`] = cooldownMax[`s${slot}`] = devNoCooldowns ? 0 : MK_GAP;
}
function mkClose(slot) { mk.recast[slot] = null; cooldowns[`s${slot}`] = cooldownMax[`s${slot}`] = mkFull(slot); if (slot === 3) mkProwl(); }

// Is e inside a cone from the hero? The cone is widened by the body's own angular size, so big enemies are easy to hit
function mkInCone(e, ang, range, half) {
    const dx = e.x - player.x, dy = e.y - player.y, d = Math.hypot(dx, dy), r = e.size / 2;
    if (d > range + r) return false;
    if (d <= r + player.radius) return true;
    let diff = Math.atan2(dy, dx) - ang; diff = Math.atan2(Math.sin(diff), Math.cos(diff));
    return Math.abs(diff) <= half + Math.asin(Math.min(1, r / d));
}

// ---------- walls and shoves ----------

// Rock, the seal, a boulder or the map's edge: what stops a body in flight (ravines don't, it is flying)
function mkBlocked(x, y, r) {
    const m = currentMap;
    if (x < m.left + r || x > m.right - r || y < m.top + r || y > m.bottom - r) return true;
    if (m.grid) for (const [ox, oy] of [[0, 0], [r * 0.6, 0], [-r * 0.6, 0], [0, r * 0.6], [0, -r * 0.6]]) { const v = terrainAt(x + ox, y + oy); if (v === T_WALL || v === T_SEAL) return true; }
    if (m.obstacles) for (const o of m.obstacles) if (Math.hypot(x - o.x, y - o.y) < o.r + r * 0.8) return true;
    return false;
}
function mkMoveE(e, dx, dy) { // false when something solid is in the way
    if (mkBlocked(e.x + dx, e.y + dy, e.size / 2)) return false;
    e.x += dx; e.y += dy; return true;
}
function mkKnock(e, ang, dist) { // a short shove; bosses barely move, pods and kegs not at all
    if (e.dead || e.pod || e.prop || e.airborne) return;
    if (mkIsBoss(e)) dist *= 0.25; else e.stunTimer = Math.max(e.stunTimer || 0, 0.2);
    mk.shoves.push({ e, ang, left: dist });
}

// ---------- the basic: fists ----------

BasicAttackRegistry['fists'] = (dmg) => monkBasic(dmg);
function monkBasic(dmg) {
    const ang = mkAim();
    if (mk.flurry > 0) { mk.flurry--; return monkFlurry(dmg, ang); }
    mk.side = -mk.side; // the jab alternates hands
    mkAnim('jab', 0.15, ang);
    let best = null, bd = 1e9;
    for (const e of enemies) if (mkTargetable(e) && mkInCone(e, ang, MK_JAB_RANGE, MK_JAB_HALF)) { const d = Math.hypot(e.x - player.x, e.y - player.y); if (d < bd) { bd = d; best = e; } }
    effects.push({ type: 'mk_jab', x: best ? best.x : player.x + Math.cos(ang) * MK_JAB_RANGE * 0.7, y: best ? best.y : player.y + Math.sin(ang) * MK_JAB_RANGE * 0.7, angle: ang, side: mk.side, life: 0.18, maxLife: 0.18 });
    if (best) applyDamage(best, dmg, 'melee_basic', ang);
}
function monkFlurry(dmg, ang, free) { // free: a Hundred-Hand Strike that spends no Chi (Seven Stars, Tiger's Frenzy)
    if (!free && mk.frenzy) { mk.frenzy = false; free = true; }
    const hundred = free || mk.chi >= MK_CHI_MAX, n = hundred ? MK_HUNDRED_BLOWS : MK_FLURRY_BLOWS + (hasItem('Tiger Claw Wraps') ? 2 : 0), time = hundred ? MK_HUNDRED_TIME : MK_FLURRY_TIME;
    const range = hundred ? MK_HUNDRED_RANGE : MK_FLURRY_RANGE, half = hundred ? MK_HUNDRED_HALF : MK_FLURRY_HALF;
    if (hundred) { if (!free) mk.chi = 0; mk.hundred = true; cooldowns.basic = Math.max(cooldowns.basic, time + 0.15); } // no Chi from its own blows; the swing is not cut short
    mkAnim(hundred ? 'hundred' : 'flurry', time, ang);
    effects.push({ type: 'mk_flurry', x: player.x, y: player.y, angle: ang, blows: n, hundred, life: time + 0.1, maxLife: time + 0.1 });
    for (let i = 0; i < n; i++) after(i * time / n, () => {
        const a = mkAim(); let landed = false; mk.side = -mk.side;
        for (const e of enemies.slice()) if (mkTargetable(e) && mkInCone(e, a, range, half)) { applyDamage(e, dmg * 0.5, i === n - 1 ? 'melee_basic' : 'melee', a); landed = true; } // one hit-stop at the end, not eight
        if (landed) mkChi(MK_CHI_PER_BLOW);
    });
    if (hundred) after(time + 0.05, () => { // the shockwave
        const a = mkAim();
        effects.push({ type: 'mk_shockwave', x: player.x, y: player.y, r: MK_SHOCK_R, life: 0.4, maxLife: 0.4 });
        for (const e of enemies.slice()) if (mkTargetable(e) && Math.hypot(e.x - player.x, e.y - player.y) <= MK_SHOCK_R + e.size / 2) {
            applyDamage(e, dmg * MK_SHOCK_MULT, 'melee_basic', a); mkKnock(e, Math.atan2(e.y - player.y, e.x - player.x), 120);
        }
        addShake(4); mk.hundred = false; mk.combatT = fxTime;
    });
}

// Space finisher (combos.js): a spinning kick all round. It keeps the flurry charge and builds no Chi: the crowd tool
function craneKick(dmg) {
    const ang = mkAim(), wings = hasTalent('mk_crane_wide'), R = wings ? 150 : MK_CRANE_R; // Crane Wings
    mkAnim('crane', 0.35, ang);
    effects.push({ type: 'mk_crane', x: player.x, y: player.y, r: R, life: 0.35, maxLife: 0.35 });
    for (const e of enemies.slice()) if (mkTargetable(e) && Math.hypot(e.x - player.x, e.y - player.y) <= R + e.size / 2) {
        applyDamage(e, dmg * MK_CRANE_MULT, 'melee_basic', Math.atan2(e.y - player.y, e.x - player.x)); mkKnock(e, Math.atan2(e.y - player.y, e.x - player.x), wings ? 120 : MK_CRANE_KNOCK);
    }
    addShake(3);
    return true;
}

// ---------- Q: Chi Wave / Rushing Fist ----------

function monkQ(sk, dmg) {
    if (mk.recast[1]) return rushingFist(dmg);
    mkCharge();
    const a = mkAim(), reach = hasTalent('mk_wave_far') ? 900 : MK_WAVE_REACH; // Long Reach
    mkAnim('palm', 0.25, a);
    projectiles.push({ x: player.x, y: player.y, vx: Math.cos(a) * MK_WAVE_SPEED, vy: Math.sin(a) * MK_WAVE_SPEED, radius: 14, color: '#ffb74d', life: reach / MK_WAVE_SPEED,
        type: 'chi_wave', shape: 'circle', mkWave: true, angle: a, damage: dmg, pierce: false, hitList: [], isEnemy: false, sourceSkill: sk, spellHit: chiWaveHit });
}
function chiWaveHit(p, e) { // the first enemy it meets is marked; a miss just lets the full cooldown run
    applyDamage(e, p.damage, 'melee', p.angle);
    if (hasTalent('mk_wave_chi')) mkChi(15); // Focused Chi
    if (e.dead || !mkMarkable(e)) return;
    const res = mkUpg(1) === 'B', time = mkMarkTime();
    e.mkWave = fxTime + time; if (res) e.mkRes = 0; // Resonating Mark: the store starts empty
    mkOpen(1, time, { target: e, n: 1, res });
}
function rushingFist(dmg) {
    const w = mk.recast[1], t = w.target; mk.recast[1] = null;
    mkCharge();
    if (!t || t.dead) return;
    t.mkWave = 0;
    const store = w.res ? t.mkRes || 0 : 0; t.mkRes = 0; // Resonating Mark: what it holds now goes off with the strike
    const x0 = player.x, y0 = player.y, [dx, dy, d] = getVector(x0, y0, t.x, t.y), ang = Math.atan2(dy, dx), stop = t.size / 2 + player.radius + 4, go = Math.max(0, d - stop);
    mkAnim('rush', 0.3, ang);
    effects.push({ type: 'mk_rush', x0, y0, x1: x0 + dx / d * go, y1: y0 + dy / d * go, life: 0.3, maxLife: 0.3 });
    const star = mkUpg(1) === 'A';
    const strike = () => {
        if (t.dead || Math.hypot(t.x - player.x, t.y - player.y) > t.size / 2 + player.radius + 70) { if (star) starEnd(w.n || 1); return; } // a wall stopped the dash short
        const mult = 1 + (MK_RUSH_MAX - 1) * Math.max(0, Math.min(1, 1 - t.hp / (t.maxHp || t.hp)));
        applyDamage(t, dmg * mult, 'melee', ang); addShake(3);
        effects.push({ type: 'mk_jab', x: t.x, y: t.y, angle: ang, side: mk.side, life: 0.18, maxLife: 0.18 });
        if (w.res) resonate(t, w, store, ang);
        if (star) sevenStar(t, w, dmg, ang);
    };
    if (go < 4) return strike();
    startDash({ x: x0 + dx / d * go, y: y0 + dy / d * go, dur: 0.08 + go / 5000, ease: 'out', kind: 'rushing_fist', ghost: { color: '#ffb74d', glow: true, every: 0.02, life: 0.2 }, onArrive: strike });
}

// ---------- E: Earth Palm / Crippling Tremor ----------

function monkE(sk, dmg) {
    if (mk.recast[2]) return mkUpg(2) === 'A' ? gatherPalm(dmg) : mkUpg(2) === 'B' ? hardenStone() : tremor();
    mkCharge();
    const a = mkAim(), cx = player.x + Math.cos(a) * MK_PALM_AHEAD, cy = player.y + Math.sin(a) * MK_PALM_AHEAD, R = hasTalent('mk_palm_wide') ? 170 : MK_PALM_R; // Broad Palm
    mkAnim('palm', 0.3, a);
    effects.push({ type: 'mk_palm', x: cx, y: cy, r: R, life: 0.4, maxLife: 0.4 });
    let marked = 0;
    for (const e of enemies.slice()) if (mkTargetable(e) && Math.hypot(e.x - cx, e.y - cy) <= R + e.size / 2) {
        applyDamage(e, dmg, 'melee', Math.atan2(e.y - cy, e.x - cx));
        if (!e.dead && mkMarkable(e)) {
            e.mkMark = fxTime + MK_MARK_TIME; marked++;
            if (hasTalent('mk_palm_daze') && !mkIsBoss(e)) e.stunTimer = Math.max(e.stunTimer || 0, 0.4); // Stunning Palm
        }
    }
    addShake(3);
    if (marked && mkUpg(2) === 'B') stoneSkin(marked);
    if (marked) mkOpen(2, MK_MARK_TIME);
}
function tremor() {
    mk.recast[2] = null; mkCharge();
    effects.push({ type: 'mk_tremor', x: player.x, y: player.y, r: MK_TREMOR_R, life: 0.6, maxLife: 0.6 });
    for (const e of enemies) if (!e.dead && e.mkMark > fxTime && Math.hypot(e.x - player.x, e.y - player.y) <= MK_TREMOR_R) { e.mkSlow = MK_TREMOR_TIME; e.mkMark = 0; }
    addShake(2);
}

// ---------- Space: Swift Step / Iron Will ----------

function monkSpace(sk) {
    if (mk.recast[3]) { // Iron Will: not a dash, so no finisher window (main.js castSkill)
        mk.recast[3] = null; mk.skipCombo = true; mkCharge();
        const karma = mkUpg(3) === 'B';
        mk.ironWill = karma && hasTalent('mk_karma_long') ? 6 : MK_WILL_TIME; // Long Will
        mkProwl(); // castSkill has just set the full cooldown
        if (karma) { mk.karma = { store: 0 }; if (hasTalent('mk_karma_taunt')) provoke(); }
        mkText(karma ? 'KARMIC WILL' : 'IRON WILL', player.x, player.y - 40, karma ? '#ce93d8' : '#ffb74d');
        return;
    }
    mkCharge(); mk.prowl = 0;
    const boots = hasItem('Cloudstep Sandals'), a = mkAim(), reach = (MK_STEP_REACH + (hasTalent('mk_step_far') ? 80 : 0)) * (boots ? 1.3 : 1); // Long Stride
    const [dx, dy, dist] = getVector(player.x, player.y, mouseX, mouseY), ux = dist > 6 ? dx / dist : Math.cos(a), uy = dist > 6 ? dy / dist : Math.sin(a);
    const x0 = player.x, y0 = player.y, tiger = mkUpg(3) === 'A';
    mkAnim('rush', 0.2, Math.atan2(uy, ux));
    const dsh = startDash({ x: x0 + ux * reach, y: y0 + uy * reach, dur: 0.16, ease: 'out', kind: 'swift_step', ghost: { color: '#ffb74d', glow: true, every: 0.02, life: 0.2 },
        onArrive: tiger ? () => tigerPath(x0, y0, player.x, player.y) : undefined }); // through the enemies
    effects.push({ type: 'mk_step', x0, y0, x1: dsh.x1, y1: dsh.y1, tiger, life: tiger ? 0.45 : 0.3, maxLife: tiger ? 0.45 : 0.3 });
    mkOpen(3, boots ? MK_WINDOW_BOOTS : MK_WINDOW);
}
function monkSkipCombo() { const s = mk.skipCombo; mk.skipCombo = false; return s; } // main.js castSkill: the Iron Will recast opens no finisher window

// Called from combat.js applyDamage with what the hit really dealt, and to whom
function monkOnDamage(amount, e) {
    mk.combatT = fxTime;
    if (e && e.mkWave > fxTime && mkUpg(1) === 'B') e.mkRes = (e.mkRes || 0) + amount * (hasTalent('mk_res_deep') ? MK_RES_DEEP : MK_RES_PCT); // Resonating Mark
    if (!(mk.ironWill > 0) || player.hp <= 0) return;
    const heal = amount * monkWillPct(activeClass.skills[3].level), over = player.hp + heal - player.maxHp;
    player.hp = Math.min(player.maxHp, player.hp + heal);
    if (over > 0 && hasItem('Robes of the Still Mountain')) addShield(over, 4); // combat.js: capped
    if (fxTime - mk.willFx > 0.2) { mk.willFx = fxTime; effects.push({ type: 'mk_will_heal', x: player.x, y: player.y, life: 0.4, maxLife: 0.4 }); }
}
function monkDamageTaken(amount) { // combat.js takeDamage: Iron Body halves it; Karmic Will takes a quarter off and stores the rest
    if (mk.ironBody > 0) amount *= 0.5;
    if (mk.karma && mk.ironWill > 0) { amount *= 1 - MK_KARMA_CUT; mk.karma.store += amount; }
    return amount;
}

// ---------- R: Dragon Kick / Dragon's Descent ----------

function mkKickTarget() { // within reach of the hero, the one nearest the cursor
    let best = null, bd = 1e9;
    for (const e of enemies) {
        if (!mkMarkable(e) || e.mkLift > 0 || Math.hypot(e.x - player.x, e.y - player.y) > MK_KICK_REACH + e.size / 2) continue;
        const d = Math.hypot(e.x - mouseX, e.y - mouseY); if (d < bd) { bd = d; best = e; }
    }
    return best;
}
function monkR(sk, dmg) {
    if (mk.recast[4]) return mk.recast[4].rise ? risingCombo(dmg) : dragonsDescent(dmg);
    const t = mkKickTarget(); if (!t) return;
    mkCharge();
    if (hasTalent('mk_kick_chi')) mkChi(40); // Inner Dragon
    const rise = mkUpg(4) === 'B';
    const [mx, my, md] = getVector(player.x, player.y, mouseX, mouseY), ang = md > 12 ? Math.atan2(my, mx) : Math.atan2(t.y - player.y, t.x - player.x);
    mkAnim('kick', 0.4, ang);
    effects.push({ type: 'mk_kick', x: t.x, y: t.y, angle: ang, life: 0.3, maxLife: 0.3 });
    addShake(4); hitStopTimer = 0.05;
    if (mkIsBoss(t)) { // a boss isn't launched: it takes the slam and steps back
        applyDamage(t, dmg * MK_SLAM_MULT, 'melee', ang); mkKnock(t, ang, MK_BOSS_KNOCK * 4);
        effects.push({ type: 'mk_slam', x: t.x, y: t.y, angle: ang, life: 0.3, maxLife: 0.3 });
        mkOpen(4, MK_STOMP_WINDOW, { e: t, x: t.x, y: t.y, rise }); // Rising Dragon: on a boss, the combo on the ground
        return;
    }
    applyDamage(t, dmg * MK_KICK_MULT, 'melee', ang);
    if (t.dead) { if (!rise) mkOpen(4, MK_STOMP_WINDOW, { x: t.x, y: t.y }); return; }
    if (rise) return riseLaunch(t, dmg);
    t.mkKick = true; t.stunTimer = Math.max(t.stunTimer || 0, 0.3);
    const pin = mkUpg(4) === 'A' ? (hasTalent('mk_pin_more') ? 5 : MK_PIN_BOUNCES) : 0; // Pinball Kick (Extra Ball)
    mk.kicked.push({ e: t, vx: Math.cos(ang) * MK_KICK_SPEED, vy: Math.sin(ang) * MK_KICK_SPEED, t: 0, left: hasTalent('mk_kick_far') ? 500 : MK_KICK_DIST, ang, dmg, hit: [t], bounces: pin, mult: 1 }); // Long Kick
}
const mkRinging = () => mkUpg(4) === 'A' && hasTalent('mk_pin_ring'); // Ringing Blow
function kickLand(k, slammed) {
    const e = k.e;
    e.mkKick = false;
    if (!e.dead) e.stunTimer = Math.max(e.stunTimer || 0, slammed ? (mkRinging() ? 1.5 : 1) : (mkRinging() ? 1.2 : 0.6));
    if (!k.child) mkOpen(4, MK_STOMP_WINDOW, { e, x: e.x, y: e.y }); // a Multiball's second body opens nothing
}
function updateKicks(dt) {
    for (let i = mk.kicked.length - 1; i >= 0; i--) {
        const k = mk.kicked[i], e = k.e;
        if (e.dead) { e.mkKick = false; mk.kicked.splice(i, 1); if (!k.child) mkOpen(4, MK_STOMP_WINDOW, { x: e.x, y: e.y }); continue; }
        k.t += dt; e.stunTimer = Math.max(e.stunTimer || 0, 0.15); // its AI stays off while it flies
        let step = Math.min(k.left, MK_KICK_SPEED * dt), slam = false;
        for (let n = Math.ceil(step / 10), s = step / n, j = 0; j < n && !e.dead; j++) {
            if (!mkMoveE(e, Math.cos(k.ang) * s, Math.sin(k.ang) * s)) {
                if (k.bounces > 0) { pinWall(k); continue; } // Pinball Kick: off the rock and on
                slam = true; break;
            }
            k.left -= s;
            for (const o of enemies) { // it bowls through whatever it meets
                if (o === e || k.hit.includes(o) || !mkMarkable(o) || o.mkLift > 0 || Math.hypot(o.x - e.x, o.y - e.y) > (o.size + e.size) / 2) continue;
                k.hit.push(o); applyDamage(o, k.dmg * MK_KICK_MULT * k.mult, 'melee', k.ang);
                if (!o.dead && !mkIsBoss(o)) o.stunTimer = Math.max(o.stunTimer || 0, mkRinging() ? 1.2 : 0.6);
                effects.push({ type: 'mk_kick', x: o.x, y: o.y, angle: k.ang, life: 0.25, maxLife: 0.25 });
                if (k.bounces > 0) { pinBounce(k, o); break; } // Pinball Kick: off the body and on
            }
        }
        if (e.dead) continue; // a bounce finished it: the next frame lets it go
        if (slam) {
            effects.push({ type: 'mk_slam', x: e.x + Math.cos(k.ang) * e.size / 2, y: e.y + Math.sin(k.ang) * e.size / 2, angle: k.ang, life: 0.35, maxLife: 0.35 });
            applyDamage(e, k.dmg * MK_SLAM_MULT * k.mult, 'melee', k.ang); addShake(6); hitStopTimer = 0.06;
            mk.kicked.splice(i, 1); kickLand(k, true);
        } else if (k.left <= 0.5) { mk.kicked.splice(i, 1); kickLand(k, false); }
    }
}
function dragonsDescent(dmg) { // leap to where it landed and stomp
    const w = mk.recast[4]; mk.recast[4] = null; mkCharge();
    const live = w.e && !w.e.dead, tx = live ? w.e.x : w.x, ty = live ? w.e.y : w.y, a = Math.atan2(ty - player.y, tx - player.x);
    mkAnim('kick', 0.5, a);
    const land = () => {
        effects.push({ type: 'mk_stomp', x: player.x, y: player.y, r: MK_STOMP_R, life: 0.45, maxLife: 0.45 });
        for (const e of enemies.slice()) if (mkTargetable(e) && Math.hypot(e.x - player.x, e.y - player.y) <= MK_STOMP_R + e.size / 2) applyDamage(e, dmg * MK_STOMP_MULT, 'melee', Math.atan2(e.y - player.y, e.x - player.x));
        addShake(6);
    };
    if (Math.hypot(tx - player.x, ty - player.y) < 12) return land();
    startDash({ x: tx, y: ty, dur: 0.45, arc: 90, ease: 'out', kind: 'dragon_descent', ghost: { color: '#ff8a65', glow: true, every: 0.03, life: 0.25 }, onArrive: land });
}

// ---------- RMB: Iron Body ----------

function monkRmb() {
    cooldowns.rmb = cooldownMax.rmb = devNoCooldowns ? 0 : MK_BODY_CD * getCDR();
    mkCharge();
    mk.ironBody = MK_BODY_TIME;
    player.trapImmuneUntil = Math.max(player.trapImmuneUntil || 0, fxTime + MK_BODY_TIME);
    mkText('IRON BODY', player.x, player.y - 40, '#ffcc80');
}
function ironBodyEnd() {
    effects.push({ type: 'mk_iron_pulse', x: player.x, y: player.y, r: MK_BODY_R, life: 0.4, maxLife: 0.4 });
    const dmg = calcDmg(activeClass.basicDmg) * 2;
    for (const e of enemies.slice()) if (mkTargetable(e) && Math.hypot(e.x - player.x, e.y - player.y) <= MK_BODY_R + e.size / 2) {
        applyDamage(e, dmg, 'melee', Math.atan2(e.y - player.y, e.x - player.x)); mkKnock(e, Math.atan2(e.y - player.y, e.x - player.x), 110);
    }
    addShake(3);
}

// ---------- every frame (main.js update) ----------

function updateMonk(dt) {
    if (activeClass.name !== 'Monk') return;
    for (const slot of [1, 2, 3, 4]) { // windows: the full cooldown starts when one lapses
        const w = mk.recast[slot]; if (!w) continue;
        if (slot === 1 && (!w.target || w.target.dead)) { mkClose(1); continue; } // the mark died
        if ((w.t -= dt) <= 0) {
            if (slot === 1 && w.target) w.target.mkWave = 0;
            mkClose(slot);
        } else if (slot === 4 && w.e && !w.e.dead) { w.x = w.e.x; w.y = w.e.y; }
    }
    if (mk.ironWill > 0 && (mk.ironWill = Math.max(0, mk.ironWill - dt)) === 0 && mk.karma) karmaRelease(); // Karmic Will pays it back
    updateStone(dt); updateRisen(dt);
    if (mk.air && !player.dash) { mk.air = false; player.z = 0; } // Rising Dragon: never left hanging if a scene cut the combo
    if (mk.ironBody > 0) {
        buffs.rooted = 0; player.trapImmuneUntil = Math.max(player.trapImmuneUntil || 0, fxTime + 0.1); // roots and traps can't hold you
        if ((mk.ironBody -= dt) <= 0) { mk.ironBody = 0; ironBodyEnd(); }
    }
    if (mk.chi > 0 && !mk.hundred && fxTime - mk.combatT > MK_CHI_IDLE) mk.chi = Math.max(0, mk.chi - MK_CHI_DRAIN * dt);
    for (const e of enemies) if (e.mkSlow > 0) { // Crippling Tremor: 60% slow, fading out
        const amt = MK_TREMOR_SLOW * Math.min(1, e.mkSlow / MK_TREMOR_TIME);
        if (!(e.slowTimer > 0) || (e.slowAmount || 0) <= amt) { e.slowAmount = amt; e.slowTimer = Math.max(e.slowTimer || 0, dt * 2 + 0.02); }
        if ((e.mkSlow -= dt) <= 0 || e.dead) e.mkSlow = 0;
    }
    updateKicks(dt);
    for (let i = mk.shoves.length - 1; i >= 0; i--) { // short knockbacks
        const s = mk.shoves[i], step = Math.min(s.left, (s.sp || 600) * dt); // sp: Gathering Palm's pull is faster
        if (s.e.dead || step <= 0 || !mkMoveE(s.e, Math.cos(s.ang) * step, Math.sin(s.ang) * step)) { mk.shoves.splice(i, 1); continue; }
        if ((s.left -= step) <= 0) mk.shoves.splice(i, 1);
    }
}

// ==========================================
// The web (talents.js TALENT_WEBS.monk; MONK.md Step 2)
// ==========================================
// Q: A Seven-Star Rush (a kill on the rush marks the next star) / B Resonating Mark (the mark stores your damage, the rush sets it
// off). E: A Gathering Palm (the recast heaps the marked up) / B Stone Skin (marks become a shield the recast hardens).
// Space: A Tiger's Path (the step strikes what it passes) / B Karmic Will (Iron Will stores what you take and throws it back).
// R: A Pinball Kick (the body bounces) / B Rising Dragon (kicked straight up; the recast is an air combo and a spike).

const MK_STAR_R = 350, MK_STAR_FAR = 500, MK_STAR_MAX = 6, MK_STAR_SPLASH = 70;
const MK_RES_PCT = 0.3, MK_RES_DEEP = 0.45, MK_RES_LONG = 5, MK_RES_SPLASH = 120;
const MK_GATHER_R = 500, MK_GATHER_FAR = 700, MK_GATHER_SPEED = 1300, MK_COLLAPSE_R = 150;
const MK_STONE_PCT = 0.05, MK_STONE_GRANITE = 0.07, MK_STONE_MAX = 5, MK_STONE_TIME = 6, MK_STONE_R = 140, MK_STONE_AVALANCHE = 200;
const MK_TIGER_W = 30, MK_TIGER_MULT = 1.5;
const MK_KARMA_CUT = 0.25, MK_KARMA_MULT = 2, MK_KARMA_R = 160;
const MK_PIN_BOUNCES = 3, MK_PIN_LEG = 220, MK_PIN_WALL = 0.5;
const MK_RISE_TIME = 1.5, MK_RISE_Z = 80, MK_RISE_BLOWS = 6, MK_RISE_BLOW = 0.15, MK_RISE_COMBO = 0.5, MK_RISE_R = 140, MK_RISE_SHOCK = 0.6, MK_RISE_FALL = 0.3;

const mkUpg = slot => activeClass.skills[slot].selectedUpg;
const mkMarkTime = () => mkUpg(1) === 'B' && hasTalent('mk_res_long') ? MK_RES_LONG : MK_MARK_TIME; // Lingering Echo
const mkBasicDmg = () => calcDmg(activeClass.basicDmg, 1) * basicLevelMult(); // combat.js: the flurries grow with the level like the jab
const mkStunnable = e => !e.dead && !mkIsBoss(e) && !e.pod && !e.prop;
function mkHeal(hp) {
    if (!(hp > 0) || player.hp <= 0) return;
    player.hp = Math.min(player.maxHp, player.hp + hp);
    effects.push({ type: 'mk_will_heal', x: player.x, y: player.y, life: 0.4, maxLife: 0.4 });
}
function mkRing(x, y, R, dmg, push, stun, skip) { // everything within R of a point: hit, pushed off it, maybe stunned
    for (const e of enemies.slice()) {
        if (e === skip || !mkTargetable(e) || Math.hypot(e.x - x, e.y - y) > R + e.size / 2) continue;
        const a = Math.atan2(e.y - y, e.x - x);
        applyDamage(e, dmg, 'melee', a);
        if (push) mkKnock(e, a, push);
        if (stun && mkStunnable(e)) e.stunTimer = Math.max(e.stunTimer || 0, stun);
    }
}
function mkDmgMult(e) { // talents.js talentDmgMult
    let m = 1;
    if (e.mkTiger > fxTime) m *= 1.15;  // Tiger's Mark
    if (e.mkSunder > fxTime) m *= 1.25; // Skyward Sunder
    return m;
}

// ---------- Q ----------

// Seven-Star Rush: a rush that kills marks the nearest enemy to its target and reopens the window
function sevenStar(t, w, dmg, ang) {
    if (hasTalent('mk_star_splash')) mkRing(t.x, t.y, MK_STAR_SPLASH + t.size / 2, dmg * 0.4, 0, 0, t); // Falling Star
    const n = w.n || 1, max = hasTalent('mk_star_seven') ? 7 : MK_STAR_MAX;
    if (!t.dead) return starEnd(n);
    if (hasTalent('mk_star_heal')) mkHeal(player.maxHp * 0.03); // Star's Breath
    const R = hasTalent('mk_star_far') ? MK_STAR_FAR : MK_STAR_R; // Shooting Star
    let next = null, bd = 1e9;
    if (n < max) for (const o of enemies) {
        if (!mkMarkable(o) || o.mkLift > 0) continue;
        const d = Math.hypot(o.x - t.x, o.y - t.y);
        if (d <= R + o.size / 2 && d < bd) { bd = d; next = o; }
    }
    if (!next) return starEnd(n);
    next.mkWave = fxTime + MK_MARK_TIME;
    mkOpen(1, MK_MARK_TIME, { target: next, n: n + 1 });
    effects.push({ type: 'mk_star', x0: t.x, y0: t.y, x1: next.x, y1: next.y, life: 0.45, maxLife: 0.45 });
    mkText(`${n + 1}`, next.x, next.y - next.size / 2 - 24, '#ffca28');
}
function starEnd(n) { // Seven Stars: a chain of 3 or more ends in a Hundred-Hand Strike that spends no Chi
    if (n >= 3 && hasTalent('mk_star_seven')) after(0.12, () => { if (player.hp > 0) monkFlurry(mkBasicDmg(), mkAim(), true); });
}

// Resonating Mark: the store goes off on top of the strike
function resonate(t, w, store, ang) {
    effects.push({ type: 'mk_echo', x: t.x, y: t.y, r: t.size / 2 + 34, store, life: 0.5, maxLife: 0.5 });
    if (store > 0 && !t.dead) applyDamage(t, store / HIT_SCALE, 'melee', ang); // the store is real damage dealt: past the x0.6
    if (store > 0 && hasTalent('mk_res_spread')) mkRing(t.x, t.y, MK_RES_SPLASH, store * 0.5 / HIT_SCALE, 0, 0, t); // Sympathetic Echo
    if (store > 0) addShake(Math.min(5, 2 + store / 60));
    if (!t.dead && !w.again && hasTalent('mk_res_twice')) { // Echo of Echoes: once more
        t.mkWave = fxTime + MK_MARK_TIME; t.mkRes = 0;
        mkOpen(1, MK_MARK_TIME, { target: t, res: true, again: true });
    }
}

// ---------- E ----------

// Gathering Palm: every mark is dragged into a heap in front of you
function gatherPalm(dmg) {
    mk.recast[2] = null; mkCharge();
    const a = mkAim(), cx = player.x + Math.cos(a) * 60, cy = player.y + Math.sin(a) * 60, R = hasTalent('mk_gather_far') ? MK_GATHER_FAR : MK_GATHER_R; // Long Arms
    const heap = enemies.filter(e => !e.dead && e.mkMark > fxTime && Math.hypot(e.x - player.x, e.y - player.y) <= R);
    mkAnim('palm', 0.3, a);
    effects.push({ type: 'mk_gather', x: cx, y: cy, from: heap.map(e => [e.x, e.y]), life: 0.5, maxLife: 0.5 });
    heap.forEach((e, i) => {
        e.mkMark = 0;
        const ra = i * 2.4, rr = i ? 12 + 11 * Math.sqrt(i) : 0, [dx, dy, d] = getVector(e.x, e.y, cx + Math.cos(ra) * rr, cy + Math.sin(ra) * rr); // a sunflower heap, not one point
        if (d > 4) mk.shoves.push({ e, ang: Math.atan2(dy, dx), left: mkIsBoss(e) ? Math.min(d, 60) : d, sp: MK_GATHER_SPEED });
        if (mkStunnable(e)) e.stunTimer = Math.max(e.stunTimer || 0, 0.5);
        if (hasTalent('mk_gather_slow')) e.mkSlow = MK_TREMOR_TIME; // Heavy Earth
    });
    addShake(2);
    if (!heap.length) return;
    if (hasTalent('mk_gather_chi')) mkChi(5 * heap.length); // Gathering Storm
    if (hasTalent('mk_gather_quake')) after(0.35, () => { // Collapse
        effects.push({ type: 'mk_palm', x: cx, y: cy, r: MK_COLLAPSE_R, life: 0.45, maxLife: 0.45 });
        mkRing(cx, cy, MK_COLLAPSE_R, dmg, 0, 1); addShake(4);
    });
}

// Stone Skin: the palm's marks harden into a shield; the recast makes it immovable, and a hardened stone bursts when it breaks
function stoneSkin(marked) {
    const amt = Math.min(marked, MK_STONE_MAX) * (hasTalent('mk_stone_thick') ? MK_STONE_GRANITE : MK_STONE_PCT) * player.maxHp; // Granite
    addShield(amt, MK_STONE_TIME); // combat.js: capped at half the Max HP
    mk.stone = { t: MK_STONE_TIME, amt: Math.min(player.shield, (mk.stone ? mk.stone.amt : 0) + amt), hard: !!(mk.stone && mk.stone.hard) };
    effects.push({ type: 'mk_stone_set', x: player.x, y: player.y, life: 0.35, maxLife: 0.35 });
}
function hardenStone() {
    mk.recast[2] = null; mkCharge();
    if (!mk.stone || player.shield <= 0.5) return;
    mk.stone.hard = true;
    mkText('STONE SKIN', player.x, player.y - 40, '#d7a85a');
    effects.push({ type: 'mk_stone_set', x: player.x, y: player.y, hard: true, life: 0.35, maxLife: 0.35 });
    addShake(2);
}
function stoneBurst() {
    const big = hasTalent('mk_stone_avalanche'), R = big ? MK_STONE_AVALANCHE : MK_STONE_R, E = activeClass.skills[2]; // Avalanche
    effects.push({ type: 'mk_stone_burst', x: player.x, y: player.y, r: R, life: 0.5, maxLife: 0.5 });
    mkRing(player.x, player.y, R, calcDmg(E.baseDmg, E.level) * 0.6, 100, big ? 1 : 0);
    if (big && !mk.recast[2] && cooldowns.s2 > 0) cooldowns.s2 *= 0.5;
    addShake(4);
}
function updateStone(dt) {
    const s = mk.stone; if (!s) return;
    if (player.shield <= 0.5) { if (s.hard) stoneBurst(); mk.stone = null; return; } // broken
    if ((s.t -= dt) <= 0) { // ran out unbroken: Mountain Spring
        if (hasTalent('mk_stone_spring')) { const left = Math.min(player.shield, s.amt); player.shield -= left; mkHeal(left); }
        mk.stone = null; return;
    }
    if (!s.hard) return;
    buffs.rooted = 0; player.trapImmuneUntil = Math.max(player.trapImmuneUntil || 0, fxTime + 0.1); // roots and traps can't hold you
    if (hasTalent('mk_stone_thorns') && (mk.thornT -= dt) <= 0) { // Jagged Stone
        mk.thornT = 0.5;
        for (const e of enemies.slice()) if (mkTargetable(e) && !e.pod && !e.prop && Math.hypot(e.x - player.x, e.y - player.y) <= player.radius + e.size / 2 + 12) {
            applyDamage(e, mkBasicDmg(), 'melee', Math.atan2(e.y - player.y, e.x - player.x));
            effects.push({ type: 'mk_jab', x: e.x, y: e.y, angle: Math.atan2(e.y - player.y, e.x - player.x), side: 1, life: 0.18, maxLife: 0.18 });
        }
    }
}
// main.js: a hardened stone holds the hero where they stand through the enemies' knockbacks
const monkAnchored = () => activeClass.name === 'Monk' && !!(mk.stone && mk.stone.hard && player.shield > 0.5);

// ---------- Space ----------

// Tiger's Path: the step rakes everything it passed through
function tigerPath(x0, y0, x1, y1) {
    const a = Math.atan2(y1 - y0, x1 - x0), dmg = mkBasicDmg() * MK_TIGER_MULT;
    let n = 0;
    for (const e of enemies.slice()) {
        if (!mkTargetable(e) || distToSegment(e.x, e.y, x0, y0, x1, y1) > e.size / 2 + MK_TIGER_W) continue;
        applyDamage(e, dmg, 'melee', a);
        effects.push({ type: 'mk_claw', x: e.x, y: e.y, angle: a, life: 0.3, maxLife: 0.3 });
        if (e.pod || e.prop) continue;
        n++; mkChi(MK_CHI_PER_BLOW);
        if (!e.dead && hasTalent('mk_tiger_mark')) e.mkTiger = fxTime + 3; // Tiger's Mark
    }
    if (!n) return;
    addShake(2);
    if (n >= 3) {
        mkCharge();
        if (hasTalent('mk_tiger_frenzy')) { mk.frenzy = true; mkText('TIGER\'S FRENZY', player.x, player.y - 40, '#ff9800'); } // Tiger's Frenzy
    }
    if (hasTalent('mk_tiger_prowl')) mk.prowl = Math.min(2, n * 0.5); // Prowl: taken off when the cooldown starts
    if (hasTalent('mk_tiger_blood')) mkHeal(player.maxHp * 0.015 * Math.min(4, n)); // Blood Trail
}
function mkProwl() { if (mk.prowl > 0) { cooldowns.s3 = Math.max(0, cooldowns.s3 - mk.prowl); mk.prowl = 0; } }

// Karmic Will: Provoke draws the crowd in, the end throws back what was stored
function provoke() {
    for (const e of enemies) if (mkMarkable(e) && !mkIsBoss(e) && Math.hypot(e.x - player.x, e.y - player.y) <= 250 + e.size / 2) {
        e.tauntTimer = Math.max(e.tauntTimer || 0, 1.5); e.tauntX = player.x; e.tauntY = player.y; // main.js: taunted enemies walk to the point
    }
    effects.push({ type: 'mk_provoke', x: player.x, y: player.y, r: 250, life: 0.5, maxLife: 0.5 });
}
function karmaRelease() {
    const k = mk.karma; mk.karma = null;
    if (!k || player.hp <= 0) return;
    const wheel = hasTalent('mk_karma_wheel'), dmg = Math.max(k.store * (wheel ? 3 : MK_KARMA_MULT) / HIT_SCALE, mkBasicDmg() * 2); // Wheel of Karma; the store is real damage taken: past the x0.6
    effects.push({ type: 'mk_karma', x: player.x, y: player.y, r: MK_KARMA_R, big: k.store > player.maxHp * 0.15, life: 0.55, maxLife: 0.55 });
    mkRing(player.x, player.y, MK_KARMA_R, dmg, 100, wheel ? 1 : 0);
    if (hasTalent('mk_karma_heal')) mkHeal(k.store * 0.25); // Balance
    addShake(4); hitStopTimer = 0.05;
}

// ---------- R ----------

// Pinball Kick: off a wall (the side it hit tells which way it turns) or off a body
function pinTurn(k, ang, hit) {
    k.ang = ang; k.vx = Math.cos(ang) * MK_KICK_SPEED; k.vy = Math.sin(ang) * MK_KICK_SPEED;
    k.bounces--; k.left = Math.max(k.left, MK_PIN_LEG); k.hit = hit; // a fresh leg bowls through everyone again
    if (hasTalent('mk_pin_speed')) k.mult += 0.25; // Gathering Speed
}
function pinWall(k) {
    const e = k.e, r = e.size / 2, bx = mkBlocked(e.x + Math.cos(k.ang) * 10, e.y, r), by = mkBlocked(e.x, e.y + Math.sin(k.ang) * 10, r);
    effects.push({ type: 'mk_slam', x: e.x + Math.cos(k.ang) * r, y: e.y + Math.sin(k.ang) * r, angle: k.ang, life: 0.3, maxLife: 0.3 });
    applyDamage(e, k.dmg * MK_PIN_WALL * k.mult, 'melee', k.ang); addShake(3);
    pinTurn(k, bx && !by ? Math.PI - k.ang : by && !bx ? -k.ang : k.ang + Math.PI, [e]);
}
function pinBounce(k, o) {
    const e = k.e, d = Math.hypot(e.x - o.x, e.y - o.y) || 1, ux = (e.x - o.x) / d, uy = (e.y - o.y) / d, vx = Math.cos(k.ang), vy = Math.sin(k.ang), dot = vx * ux + vy * uy;
    if (hasTalent('mk_pin_multi') && !k.child && !k.multi && !o.dead && mkStunnable(o) && !o.mkKick) { // Multiball: it goes flying too
        k.multi = true; o.mkKick = true;
        const a = Math.atan2(-uy, -ux);
        mk.kicked.push({ e: o, vx: Math.cos(a) * MK_KICK_SPEED, vy: Math.sin(a) * MK_KICK_SPEED, t: 0, left: MK_PIN_LEG + 80, ang: a, dmg: k.dmg, hit: [o, e], bounces: k.bounces - 1, mult: k.mult, child: true });
    } else if (!o.dead) mkKnock(o, Math.atan2(-uy, -ux), 30);
    pinTurn(k, dot < 0 ? Math.atan2(vy - 2 * dot * uy, vx - 2 * dot * ux) : k.ang, [e, o]);
}

// Rising Dragon: the kick sends it straight up, out of the fight; left alone it falls
function riseLaunch(t, dmg, again) {
    t.mkRise = { t: 0, up: MK_RISE_TIME, dmg }; if (!mk.risen.includes(t)) mk.risen.push(t);
    t.stunTimer = Math.max(t.stunTimer || 0, 0.3);
    if (hasTalent('mk_rise_sunder')) t.mkSunder = fxTime + MK_RISE_TIME + 3; // Skyward Sunder
    effects.push({ type: 'mk_rise', x: t.x, y: t.y, r: t.size / 2, life: 0.5, maxLife: 0.5 });
    mkOpen(4, MK_RISE_TIME, { e: t, rise: true, again });
}
function updateRisen(dt) {
    for (let i = mk.risen.length - 1; i >= 0; i--) {
        const e = mk.risen[i], r = e.mkRise;
        if (!r || e.dead) { e.mkLift = 0; e.mkRise = null; mk.risen.splice(i, 1); continue; }
        r.t += dt; e.stunTimer = Math.max(e.stunTimer || 0, 0.15); // its AI stays off while it's up
        if (r.down) { // the spike drives it down, or it falls
            if ((e.mkLift = Math.max(0, (e.mkLift || 0) - 900 * dt)) <= 0) { e.mkRise = null; mk.risen.splice(i, 1); }
            continue;
        }
        e.mkLift = MK_RISE_Z * easeOut(Math.min(1, r.t / 0.3)) + (r.held ? 0 : Math.sin(r.t * 5) * 3);
        if (r.t >= r.up && !r.held) { // left alone: it falls
            r.down = true; e.stunTimer = Math.max(e.stunTimer || 0, 0.5);
            if (e.mkSunder > fxTime) e.mkSunder = fxTime + 3;
            after(0.09, () => { if (!e.dead) { applyDamage(e, r.dmg * MK_RISE_FALL, 'melee', 0); effects.push({ type: 'mk_slam', x: e.x, y: e.y, angle: Math.PI / 2, life: 0.3, maxLife: 0.3 }); } });
        }
    }
}
// The recast: leap up after it, a combo in the air, then spike it down. On a boss the same, on the ground.
function risingCombo(dmg) {
    const w = mk.recast[4]; mk.recast[4] = null; mkCharge();
    const e = w.e;
    if (!e || e.dead) return;
    const r = e.mkRise && !e.mkRise.down ? e.mkRise : null, Z = r ? MK_RISE_Z : 0, n = hasTalent('mk_rise_wings') ? 10 : MK_RISE_BLOWS, meteor = hasTalent('mk_rise_meteor'); // Hundred Wings, Meteor Spike
    if (r) r.held = true; // it hangs there for the combo
    const a0 = Math.atan2(e.y - player.y, e.x - player.x);
    mk.air = Z > 0;
    const land = () => {
        mk.air = false;
        const a = Math.atan2(e.y - player.y, e.x - player.x), R = meteor ? 200 : MK_RISE_R, x = e.x, y = e.y;
        if (!e.dead) {
            applyDamage(e, dmg, 'melee_basic', a);
            if (meteor && mkStunnable(e)) e.stunTimer = Math.max(e.stunTimer || 0, 1);
            if (e.mkSunder > fxTime) e.mkSunder = fxTime + 3;
        }
        effects.push({ type: 'mk_stomp', x, y, r: R, life: 0.45, maxLife: 0.45 });
        effects.push({ type: 'mk_slam', x, y, angle: Math.PI / 2, life: 0.35, maxLife: 0.35 });
        mkRing(x, y, R, dmg * MK_RISE_SHOCK, 80, meteor ? 1 : 0, e);
        addShake(6); hitStopTimer = 0.07;
        if (!w.again && !e.dead && hasTalent('mk_rise_endless')) { // Endless Sky: it bounces back up for a second combo
            if (e.mkRise) e.mkRise = null;
            if (mkIsBoss(e)) mkOpen(4, MK_RISE_TIME, { e, rise: true, again: true });
            else riseLaunch(e, dmg, true);
        }
    };
    const spike = () => {
        if (e.mkRise) e.mkRise.down = true;
        mkAnim('kick', 0.3, Math.atan2(e.y - player.y, e.x - player.x));
        if (Z > 0) { const d = startDash({ x: player.x, y: player.y, dur: 0.12, z0: Z, z1: 0, kind: 'rising_spike', onArrive: land }); d.angle = a0; }
        else land();
    };
    const combo = () => {
        if (e.dead) return spike();
        const a = Math.atan2(e.y - player.y, e.x - player.x);
        mkAnim('flurry', MK_RISE_COMBO, a);
        const d = startDash({ x: player.x, y: player.y, dur: MK_RISE_COMBO + 0.08, z0: Z, z1: Z, kind: 'rising_hold', onArrive: spike }); d.angle = a; // hold the hero up there
        for (let i = 0; i < n; i++) after(i * MK_RISE_COMBO / n, () => {
            if (e.dead) return;
            const ba = Math.atan2(e.y - player.y, e.x - player.x); mk.side = -mk.side;
            applyDamage(e, dmg * MK_RISE_BLOW, i === n - 1 ? 'melee_basic' : 'melee', ba);
            effects.push({ type: 'mk_jab', x: e.x, y: e.y - (e.mkLift || 0), angle: ba, side: mk.side, life: 0.18, maxLife: 0.18 });
        });
    };
    const off = e.size / 2 + player.radius + 4, tx = e.x - Math.cos(a0) * off, ty = e.y - Math.sin(a0) * off; // clear of its body: an arc's landing would slide on
    mkAnim('kick', 0.3, a0);
    if (Math.hypot(tx - player.x, ty - player.y) < 10) { if (Z > 0) player.z = Z; return combo(); }
    startDash({ x: tx, y: ty, dur: 0.22, z1: Z, arc: Z ? 0 : 30, ease: 'out', kind: 'rising_dragon', ghost: { color: '#ff8a65', glow: true, every: 0.03, life: 0.25 }, onArrive: combo }); // up there a straight rise (z1): no landing slide
}

window.SkillRegistry.Monk = { 1: monkQ, 2: monkE, 3: monkSpace, 4: monkR, rmb: monkRmb,
    canCast: slot => { // Dragon Kick needs someone in reach (the cooldown stays unspent); a recast is always allowed
        if (slot !== 4 || mk.recast[4]) return true;
        if (mkKickTarget()) return true;
        mkText('No target', player.x, player.y - 40, '#ff5252'); return false;
    } };
