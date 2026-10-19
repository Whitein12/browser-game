// ==========================================
// swordsaint.js - The Swordsaint: a flashy duelist who wins by weaving and dodging (design and numbers in SWORDSAINT.md)
// ==========================================
// Style rank (ss.style 0-500, D C B A S): an action that lands a hit raises it, more when it differs from the last one that
// landed; a perfect dodge (an enemy hit into her own Gale Step or Mana Burst) jumps a full rank and slows the enemies (bullet
// time); a hit taken drops two ranks. Each rank is Power (combat.js powerParts). Every skill cancels the sword's recovery, so
// basic, skill, basic, skill is the rhythm. She has no self-healing of any kind, by the user's design.
// Q Gale Step (3 recasts: two dashes ending in a spin cut, then a dash-jump and a slam). E Strike Air (a stunning wind burst).
// Space Mana Burst (a quick dash, 2 charges, long i-frames). R Unsealed Blade (+Power for 12 s; the recast, held, is Excalibur's
// beam; the seal runs its full time after it). RMB Hammer of the Wind King (a tornado that carries enemies). Space finisher: Crosscut (combos.js).
// The web (talents.js TALENT_WEBS.swordsaint, ids ss_; SWORDSAINT.md Step 2) lives inside each skill below, marked "web".
// Drawn by swordsaint_fx.js; the state below is its contract.

const SS_MAX = 500, SS_RANK = 100, SS_NEW = 25, SS_SAME = 3, SS_DECAY = 6, SS_DODGE = 100, SS_HURT = 200, SS_HURT_SEAL = 100, SS_IDLE = 2.5, SS_DRAIN = 40, SS_UNSEAL_GAIN = 1.5;
const SS_RANK_POWER = [0, 0.10, 0.25, 0.40, 0.60], SS_RANK_SPEED = [0, 0.05, 0.10, 0.15, 0.20], SS_RANK_NAME = ['Dull', 'Keen', 'Bright', 'Radiant', 'Sovereign'], SS_RANK_LETTER = ['D', 'C', 'B', 'A', 'S'];
const SS_BT_TIME = 1, SS_BT_CD = 3, SS_BT_SCALE = 0.3, SS_BT_BOSS = 0.5;
// Two swords to compare (the user, 2026-10-15; the Training Room panel switches them, ssBlade): the original (cuts 110 px, thrust 150,
// the first sword art; Crosscut's X at its tip, 84 px, with a lunge) and the long one (cuts 120, thrust 180, a broad longsword in her hand, X at 105)
const SS_BLADES = { og: { cut: 110, thrust: 150, cross: 84 }, long: { cut: 120, thrust: 180, cross: 105 } };
let ssBlade = 'og';
const ssB = () => SS_BLADES[ssBlade];
const SS_CHAIN_RESET = 1, SS_CUT_HALF = Math.PI * 50 / 180, SS_THRUST_W = 22, SS_THRUST_MULT = 1.5, SS_WAVE_REACH = 250, SS_WAVE_SPEED = 900;
const SS_GAP = 0.25, SS_Q_WINDOW = 3, SS_STEP = 130, SS_STEP_DUR = 0.14, SS_SPIN_R = 100, SS_LEAP = 190, SS_LEAP_DUR = 0.3, SS_SLAM_R = 140, SS_SLAM_MULT = 1.6, SS_SLAM_STAGGER = 0.4;
const SS_AIR_R = 120, SS_AIR_STUN = 0.6, SS_AIR_PUSH = 40;
const SS_BURST = 160, SS_BURST_DUR = 0.12, SS_BURST_IFRAMES = 0.3, SS_BURST_CHARGES = 2;
const SS_CROSS_REACH = 130, SS_CROSS_W = 18, SS_CROSS_MULT = 1.2, SS_CROSS_GAP = 0.15, SS_CROSS_BURST = 1.0;
const SS_UNSEAL_TIME = 12, SS_UNSEAL_POWER = 0.30, SS_BEAM_LEN = 700, SS_BEAM_W = 35, SS_BEAM_CHARGE = 1;
const SS_WIND_CD = 10, SS_WIND_SPEED = 500, SS_WIND_REACH = 450, SS_WIND_R = 45, SS_WIND_TICK = 0.15, SS_WIND_MULT = 0.33, SS_WIND_PULL = 260;
const SS_AVALON_CD = 30;
// the web
const SS_TEMPEST_R = 160, SS_TEMPEST_FAR = 220, SS_LAUNCH = 0.6, SS_LAUNCH_LONG = 1.0, SS_EYE_TIME = 2, SS_EYE_R = 160, SS_EYE_TICK = 0.4;
const SS_DUEL_R = 220, SS_DUEL_FAR = 300, SS_DUEL_PLUNGE = 3, SS_DUEL_COUP = 4, SS_DUEL_EXEC = 0.25, SS_CHALLENGE = 0.2, SS_CHALLENGE_T = 4, SS_PRECISE = [1, 1.3, 1.6];
const SS_CANNON = 450, SS_CANNON_FAR = 650, SS_CANNON_W = 45, SS_CANNON_KNOCK = 150, SS_CANNON_STUN = 1.2, SS_CANNON_TWIN = 2, SS_CALLED = 50;
const SS_PULL_R = 240, SS_PULL_FAR = 320, SS_PULL_SPEED = 1100, SS_CENTER = 0.2, SS_IMPLODE_N = 5, SS_IMPLODE_MULT = 1.5;
const SS_COUNTER_MULT = 3, SS_COUNTER_R = 250, SS_COUNTER_SHOT = 450;
const SS_OVER_STYLE = 15, SS_MOMENTUM = 1, SS_WAKE_T = 1.5, SS_WAKE_TICK = 0.3, SS_WAKE_W = 22;
const SS_SEAL_DODGE = 2, SS_SEAL_FLOW = 0.5, SS_CRESCENDO = 0.05, SS_EVER_CD = 6, SS_MOON_CHARGE = 0.5;

const ss = { style: 0, last: null, hitT: -99, recast: { 1: null, 2: null, 4: null }, unsealed: 0, bullet: 0, bulletReady: 0, dodgeUntil: -99, dodgeAt: -99,
    charges: SS_BURST_CHARGES, rechT: 0, chain: 0, chainT: -99, anim: null, side: 1, winds: [], avalonReady: 0, pop: null,
    dodgeKind: null, counter: null, shoves: [], launched: [], cyclones: [], duel: null, countered: false, overCut: null, wakes: [], unsealT: 0, sealGain: 0, moons: 0, lastBeam: null };
function resetSwordsaint() {
    ss.style = 0; ss.last = null; ss.hitT = -99; ss.recast = { 1: null, 2: null, 4: null }; ss.unsealed = 0; ss.bullet = 0; ss.bulletReady = 0;
    ss.dodgeUntil = ss.dodgeAt = -99; ss.charges = ssMaxCharges(); ss.rechT = 0; ss.chain = 0; ss.chainT = -99; ss.anim = null; ss.winds = []; ss.avalonReady = 0; ss.pop = null;
    for (const l of ss.launched) if (l.e) l.e.mkLift = 0;
    ss.dodgeKind = null; ss.counter = null; ss.shoves = []; ss.launched = []; ss.cyclones = []; ss.duel = null; ss.countered = false; ss.overCut = null; ss.wakes = []; ss.unsealT = ss.sealGain = ss.moons = 0; ss.lastBeam = null;
}
const isSwordsaint = () => activeClass && activeClass.name === 'Swordsaint';
const ssAim = () => Math.atan2(mouseY - player.y, mouseX - player.x);
const ssUpg = slot => activeClass.skills[slot].selectedUpg;
const ssFull = slot => devNoCooldowns ? 0 : skillBaseCd(slot, activeClass.skills[slot].level) * getCDR();
const ssTargetable = e => !e.dead && !e.submerged && !(e.spawnT > 0) && !(e.flyUntil > fxTime);
const ssReal = e => !e.pod && !e.prop; // pods and kegs pop, but they aren't style
const ssIsBoss = e => isBossE(e);
const ssMovable = e => !e.dead && !ssIsBoss(e) && ssReal(e) && !e.airborne;
const ssMaxCharges = () => SS_BURST_CHARGES + (typeof hasItem === 'function' && equipment && hasItem('Prana Greaves') ? 1 : 0);
function ssAnim(kind, dur, angle, extra) { ss.anim = Object.assign({ kind, t0: fxTime, dur, angle, side: ss.side }, extra); }
const ssRank = () => Math.min(4, Math.floor(ss.style / SS_RANK));
const ssPower = () => isSwordsaint() ? SS_RANK_POWER[ssRank()] : 0; // combat.js powerParts
const ssSpeed = () => isSwordsaint() ? SS_RANK_SPEED[ssRank()] : 0; // skills.js attackSpeedBonus: each rank is a little attack speed too
const ssUnsealPower = () => isSwordsaint() && ss.unsealed > 0 ? SS_UNSEAL_POWER + (ssUpg(4) === 'A' && hasTalent('ss_seal_crescendo') ? Math.min(0.3, Math.floor(ss.unsealT / 2) * SS_CRESCENDO) : 0) : 0; // web: Crescendo
// A skill cancels the sword's recovery: the next cut comes at once
function ssWeave() { cooldowns.basic = Math.min(cooldowns.basic, 0); }
function ssOpen(slot, time) { ss.recast[slot] = { t: time, max: time, n: 1 }; cooldowns[`s${slot}`] = cooldownMax[`s${slot}`] = devNoCooldowns ? 0 : SS_GAP; }
function ssClose(slot) { ss.recast[slot] = null; cooldowns[`s${slot}`] = cooldownMax[`s${slot}`] = ssFull(slot); }
function ssText(text, color, dy = 44) { effects.push({ type: 'text', text, x: player.x, y: player.y - dy, color, life: 0.8, maxLife: 0.8 }); }

// ---------- Style ----------

function ssAdd(n) {
    const r0 = ssRank(), s0 = ss.style;
    ss.style = Math.max(0, Math.min(SS_MAX, ss.style + n));
    if (n > 0 && ss.unsealed > 0 && ssUpg(4) === 'A' && hasTalent('ss_seal_flow')) { // web, Flowing Seal: every 50 gained while unsealed is half a second more
        ss.sealGain += ss.style - s0;
        while (ss.sealGain >= 50) { ss.sealGain -= 50; ssExtendSeal(SS_SEAL_FLOW); }
    }
    const r1 = ssRank();
    if (r1 !== r0) ss.pop = { rank: r1, up: r1 > r0, t0: fxTime }; // swordsaint_fx.js: the letter springs up beside her
}
// An action that landed: a new one in the chain is worth five of a repeat
function ssStyle(tag) {
    ssAdd((tag === ss.last ? SS_SAME : SS_NEW) * (ss.unsealed > 0 ? SS_UNSEAL_GAIN : 1));
    ss.last = tag; ss.hitT = fxTime;
}
// combat.js takeDamage, before the i-frames check: an enemy hit into her own dash is a perfect dodge
function ssDodge(isContinuous, src) {
    if (!isSwordsaint() || isContinuous || fxTime > ss.dodgeUntil) return false;
    ssPerfect(src);
    return true;
}
const ssGolden = () => ss.unsealed > 0 && ssUpg(4) === 'A' && hasTalent('ss_seal_golden'); // web: Golden Hour
function ssPerfect(src) {
    const fresh = fxTime - ss.dodgeAt > 0.5; // a volley of shots into one dodge counts once
    if (fresh) { ssAdd(SS_DODGE); ss.hitT = fxTime; ss.last = 'dodge'; }
    ss.dodgeAt = fxTime;
    const bt = fxTime >= ss.bulletReady;
    if (bt) { ss.bullet = ssGolden() ? 1.5 : SS_BT_TIME; ss.bulletReady = fxTime + (ssGolden() ? 2 : SS_BT_CD); }
    effects.push({ type: 'ss_perfect', x: player.x, y: player.y, bt, life: 0.7, maxLife: 0.7 });
    ssText('Perfect!', '#ffe082');
    if (fresh && ss.unsealed > 0 && ssUpg(4) === 'A') ssExtendSeal(SS_SEAL_DODGE); // web: Endless Seal
    if (ss.dodgeKind === 'burst' && ssUpg(3) === 'A' && !ss.countered) counterBurst(src); // web: Counter Burst
}
// combat.js takeDamage, once a blow gets past every dodge: two ranks off (one with the Seal of the Round); it spoils a beam's charge
function ssHurt(isContinuous) {
    if (!isSwordsaint() || isContinuous) return;
    ssAdd(-(hasItem('Seal of the Round') ? SS_HURT_SEAL : SS_HURT)); ss.last = null;
    if (player.charge && player.charge.slot === 4) releaseCharge(4); // main.js: the beam goes off now, at what it had
}
// combat.js takeDamage, just before the HP comes off: the Mail of Avalon turns a killing blow into a perfect dodge
function ssAvalon(amount) {
    if (!isSwordsaint() || player.hp - amount > 0 || !hasItem('Mail of Avalon') || fxTime < ss.avalonReady) return false;
    ss.avalonReady = fxTime + SS_AVALON_CD;
    ssPerfect(null);
    ssText('AVALON', '#fff59d', 62);
    return true;
}
// main.js: bullet time slows the enemies and their shots, not her
const ssTimeScale = e => ss.bullet > 0 ? (ssIsBoss(e) ? SS_BT_BOSS : SS_BT_SCALE) : 1;
const ssShotScale = () => ss.bullet > 0 ? SS_BT_SCALE : 1;
// talents.js talentDmgMult: Challenge (Duelist's Lunge) and Still Center (Eye of the Storm)
function ssDmgMult(e) {
    let m = 1;
    if (e.ssChallenge > fxTime) m *= 1 + SS_CHALLENGE;
    if (e.ssStill > fxTime) m *= 1 + SS_CENTER;
    return m;
}

// ---------- hit shapes and shoves ----------

function ssInCone(e, ang, range, half) {
    const dx = e.x - player.x, dy = e.y - player.y, d = Math.hypot(dx, dy), r = e.size / 2;
    if (d > range + r) return false;
    if (d <= r + player.radius) return true;
    let diff = Math.atan2(dy, dx) - ang; diff = Math.atan2(Math.sin(diff), Math.cos(diff));
    return Math.abs(diff) <= half + Math.asin(Math.min(1, r / d));
}
// Each returns how many real enemies it hit (pods and kegs pop but don't count)
function ssRing(x, y, R, dmg, src, each) {
    let n = 0;
    for (const e of enemies.slice()) if (ssTargetable(e) && Math.hypot(e.x - x, e.y - y) <= R + e.size / 2) {
        applyDamage(e, dmg, src, Math.atan2(e.y - y, e.x - x)); if (ssReal(e)) n++;
        if (each && !e.dead) each(e);
    }
    return n;
}
function ssSeg(x0, y0, x1, y1, w, dmg, src, skip) {
    let n = 0; const hit = [];
    for (const e of enemies.slice()) if (ssTargetable(e) && !(skip && skip.includes(e)) && distToSegment(e.x, e.y, x0, y0, x1, y1) <= w + e.size / 2) {
        applyDamage(e, dmg, src, Math.atan2(y1 - y0, x1 - x0)); hit.push(e); if (ssReal(e)) n++;
    }
    return { n, hit };
}
function ssStagger(e, t) { if (!e.dead && !ssIsBoss(e) && ssReal(e)) e.stunTimer = Math.max(e.stunTimer || 0, t); }
// A push or pull toward a point (to) or along an angle (ang, dist); rock stops it (monk.js mkBlocked). onStop(e, blocked) when it ends
function ssShove(e, o) { if (!ssMovable(e)) return; ss.shoves = ss.shoves.filter(s => s.e !== e); ss.shoves.push(Object.assign({ e, sp: 900 }, o)); e.stunTimer = Math.max(e.stunTimer || 0, 0.15); }
function updateShoves(dt) {
    for (let i = ss.shoves.length - 1; i >= 0; i--) {
        const s = ss.shoves[i], e = s.e;
        if (e.dead) { ss.shoves.splice(i, 1); continue; }
        let ux, uy, left;
        if (s.to) { const [dx, dy, d] = getVector(e.x, e.y, s.to.x, s.to.y); left = d - (s.stopAt || 0); ux = dx / (d || 1); uy = dy / (d || 1); }
        else { left = s.left; ux = Math.cos(s.ang); uy = Math.sin(s.ang); }
        const step = Math.min(Math.max(0, left), s.sp * dt);
        e.stunTimer = Math.max(e.stunTimer || 0, 0.1);
        let blocked = step > 0 && mkBlocked(e.x + ux * step, e.y + uy * step, e.size / 2), bump = null;
        if (!blocked && s.bump) bump = enemies.find(o => o !== e && !o.dead && ssReal(o) && !(s.hitList || []).includes(o) && Math.hypot(o.x - e.x - ux * step, o.y - e.y - uy * step) < (o.size + e.size) / 2);
        if (!blocked && !bump) { e.x += ux * step; e.y += uy * step; if (!s.to) s.left -= step; }
        if (blocked || bump || left - step <= 0.5) { ss.shoves.splice(i, 1); if (s.onStop) s.onStop(e, blocked, bump); }
    }
}

// ---------- the basic: a three-cut longsword chain ----------

BasicAttackRegistry['saint_sword'] = (dmg) => ssBasic(dmg);
function ssBasic(dmg) {
    if (fxTime - ss.chainT > SS_CHAIN_RESET) ss.chain = 0;
    const step = ss.chain, ang = ssAim();
    ss.chain = (ss.chain + 1) % 3; ss.chainT = fxTime;
    let n = 0;
    if (step < 2) { // two sweeping cuts, one each way
        ss.side = step === 0 ? 1 : -1;
        ssAnim('cut', 0.2, ang);
        for (const e of enemies.slice()) if (ssTargetable(e) && ssInCone(e, ang, ssB().cut, SS_CUT_HALF)) { applyDamage(e, dmg, 'melee_basic', ang); if (ssReal(e)) n++; }
    } else { // the thrust
        ssAnim('thrust', 0.2, ang);
        const x1 = player.x + Math.cos(ang) * ssB().thrust, y1 = player.y + Math.sin(ang) * ssB().thrust;
        n = ssSeg(player.x, player.y, x1, y1, SS_THRUST_W, dmg * SS_THRUST_MULT, 'melee_basic').n;
        effects.push({ type: 'ss_thrust', x: player.x, y: player.y, angle: ang, len: ssB().thrust, life: 0.2, maxLife: 0.2 });
        if (hasItem('Lionheart Gauntlets')) projectiles.push({ x: player.x + Math.cos(ang) * 30, y: player.y + Math.sin(ang) * 30, vx: Math.cos(ang) * SS_WAVE_SPEED, vy: Math.sin(ang) * SS_WAVE_SPEED,
            radius: 20, color: '#ffe082', life: SS_WAVE_REACH / SS_WAVE_SPEED, type: 'ss_wave', ssWave: true, angle: ang, damage: dmg, pierce: true, hitList: [], isEnemy: false });
    }
    if (n) ssStyle('basic');
}

// Space finisher (combos.js): an X of two golden cuts in front of her; what stands where they cross takes both, and a burst.
// web, Crossfire: right after an Overdrive, an X also lands on every enemy the burst cut
function crosscut(dmg) {
    const ang = ssAim(), half = (hasTalent('ss_cross_wide') ? 170 : SS_CROSS_REACH) * 0.55; // web: Wide Cross
    const centers = [[player.x + Math.cos(ang) * ssB().cross, player.y + Math.sin(ang) * ssB().cross, null]];
    if (ss.overCut && fxTime - ss.overCut.t < 1.5 && hasTalent('ss_over_crossfire')) for (const e of ss.overCut.list.filter(o => !o.dead).slice(0, 3)) centers.push([e.x, e.y, e]); // three at most, each striking only its own enemy at half power
    ss.overCut = null;
    ssAnim('cross', SS_CROSS_GAP + 0.18, ang);
    let scored = false;
    for (const [cx, cy, only] of centers) {
        const cut = (s) => { // a diagonal through the crossing point
            if (only) { if (only.dead) return { n: 0, hit: [] }; applyDamage(only, dmg * SS_CROSS_MULT * 0.5, 'melee', ang); return { n: ssReal(only) ? 1 : 0, hit: [only] }; }
            const a = ang + s * Math.PI / 4, dx = Math.cos(a) * half, dy = Math.sin(a) * half;
            return ssSeg(cx - dx, cy - dy, cx + dx, cy + dy, SS_CROSS_W, dmg * SS_CROSS_MULT, 'melee');
        };
        effects.push({ type: 'ss_cross', x: cx, y: cy, angle: ang, half, life: 0.45, maxLife: 0.45 });
        const first = cut(1);
        if (first.n && !scored) { scored = true; ssStyle('cross'); }
        after(SS_CROSS_GAP, () => {
            const second = cut(-1);
            if (second.n && !scored) { scored = true; ssStyle('cross'); }
            const both = second.hit.filter(e => first.hit.includes(e) && !e.dead);
            for (const e of both) { applyDamage(e, dmg * SS_CROSS_BURST * (only ? 0.5 : 1), 'melee_basic', ang); effects.push({ type: 'ss_cross_burst', x: e.x, y: e.y, life: 0.35, maxLife: 0.35 }); }
            if (both.length) addShake(3);
        });
    }
    return true;
}

// ---------- Q: Gale Step (web A Tempest Dance, B Duelist's Lunge) ----------

const ssStepLen = () => hasTalent('ss_step_far') ? 170 : SS_STEP; // web: Long Stride
const ssLeapLen = () => hasTalent('ss_step_far') ? 240 : SS_LEAP;
const ssSpinR = () => hasTalent('ss_spin_wide') ? 130 : SS_SPIN_R; // web: Wide Arc
function ssDuelTarget() { // Duelist's Lunge: the enemy nearest the cursor within reach
    const R = hasTalent('ss_duel_far') ? SS_DUEL_FAR : SS_DUEL_R;
    let best = null, bd = 1e9;
    for (const e of enemies) {
        if (!ssTargetable(e) || !ssReal(e) || Math.hypot(e.x - player.x, e.y - player.y) > R + e.size / 2) continue;
        const d = Math.hypot(e.x - mouseX, e.y - mouseY); if (d < bd) { bd = d; best = e; }
    }
    return best;
}
function ssQ(sk, dmg) {
    const w = ss.recast[1], n = w ? w.n + 1 : 1;
    ssWeave();
    if (n === 1) ss.duel = null;
    const a = Math.hypot(mouseX - player.x, mouseY - player.y) > 8 ? ssAim() : (player.dash ? player.dash.angle : ssAim());
    const duel = ssUpg(1) === 'B' ? ssDuelTarget() : null;
    if (n < 3) {
        ssOpen(1, SS_Q_WINDOW); ss.recast[1].n = n;
        if (duel) return duelLunge(duel, dmg);
        ss.duel = null; // a step with no one to duel breaks the chain
        ssAnim('dash', SS_STEP_DUR, a);
        const d = startDash({ x: player.x + Math.cos(a) * ssStepLen(), y: player.y + Math.sin(a) * ssStepLen(), dur: SS_STEP_DUR, ease: 'out', kind: 'gale_step', ghost: { color: '#fff59d', glow: true, every: 0.02, life: 0.22 },
            onArrive: () => {
                ssAnim('spin', 0.22, a);
                effects.push({ type: 'ss_spin', x: player.x, y: player.y, r: ssSpinR(), angle: a, step: n, life: 0.3, maxLife: 0.3 });
                const hits = ssRing(player.x, player.y, ssSpinR(), dmg, 'melee');
                if (hits) ssStyle('q');
                if (ssUpg(1) === 'A') tempestPull(hits);
            } });
        ss.dodgeUntil = fxTime + d.dur + 0.05; ss.dodgeKind = 'step';
        return;
    }
    ssClose(1); // the third step: the full cooldown starts now
    const dueled = ss.duel && ss.duel.hits >= 2 && ssTargetable(ss.duel.e) ? ss.duel.e : null; // two lunges landed on it: the third step is the plunge, wherever the cursor is
    const plunge = ssUpg(1) === 'B' && dueled && Math.hypot(dueled.x - player.x, dueled.y - player.y) <= (hasTalent('ss_duel_far') ? SS_DUEL_FAR : SS_DUEL_R) + 80 + dueled.size / 2;
    const tx = plunge ? dueled.x : player.x + Math.cos(a) * ssLeapLen(), ty = plunge ? dueled.y : player.y + Math.sin(a) * ssLeapLen();
    const la = Math.atan2(ty - player.y, tx - player.x);
    ssAnim('leap', SS_LEAP_DUR, la);
    const d = startDash({ x: tx, y: ty, dur: SS_LEAP_DUR, arc: 45, ease: 'out', kind: 'gale_leap', ghost: { color: '#ffd54f', glow: true, every: 0.025, life: 0.28 },
        onArrive: () => {
            ssAnim('slam', 0.25, la);
            effects.push({ type: 'ss_slam', x: player.x, y: player.y, r: SS_SLAM_R, angle: la, life: 0.45, maxLife: 0.45 });
            if (plunge && !dueled.dead) duelPlunge(dueled, dmg);
            const launch = ssUpg(1) === 'A';
            if (ssRing(player.x, player.y, SS_SLAM_R, dmg * SS_SLAM_MULT, 'melee', e => launch ? tempestLaunch(e) : ssStagger(e, SS_SLAM_STAGGER))) ssStyle('q');
            if (launch && hasTalent('ss_tempest_eye')) ss.cyclones.push({ x: player.x, y: player.y, t: SS_EYE_TIME, ticks: new Map(), dmg: calcDmg(activeClass.basicDmg) }); // Eye of the Tempest
            addShake(5); hitStopTimer = Math.max(hitStopTimer, 0.05);
        } });
    ss.dodgeUntil = fxTime + d.dur + 0.05; ss.dodgeKind = 'step';
}
// A Tempest Dance: each spin draws the enemies round her in; the slam throws the heap into the air
function tempestPull(hits) {
    const R = hasTalent('ss_tempest_reach') ? SS_TEMPEST_FAR : SS_TEMPEST_R;
    for (const e of enemies) if (ssTargetable(e) && ssMovable(e) && Math.hypot(e.x - player.x, e.y - player.y) <= R + e.size / 2)
        ssShove(e, { to: { x: player.x, y: player.y }, stopAt: player.radius + e.size / 2 + 6, sp: 1000 });
    effects.push({ type: 'ss_pull', x: player.x, y: player.y, r: R, life: 0.35, maxLife: 0.35 });
    if (hits >= 3 && hasTalent('ss_tempest_style')) ssAdd(25); // Storm Rhythm
}
function tempestLaunch(e) {
    if (!ssMovable(e)) return ssStagger(e, SS_SLAM_STAGGER);
    const t = hasTalent('ss_tempest_hang') ? SS_LAUNCH_LONG : SS_LAUNCH; // Hang Time
    e.stunTimer = Math.max(e.stunTimer || 0, t);
    ss.launched = ss.launched.filter(l => l.e !== e); ss.launched.push({ e, t, max: t });
}
// B Duelist's Lunge: the step goes through the enemy nearest the cursor; three on the same one end in a plunge
function duelLunge(t, dmg) {
    const [dx, dy, d] = getVector(player.x, player.y, t.x, t.y), ux = dx / (d || 1), uy = dy / (d || 1), go = d + t.size / 2 + 34;
    const x0 = player.x, y0 = player.y, a = Math.atan2(uy, ux);
    ssAnim('dash', SS_STEP_DUR, a);
    const dsh = startDash({ x: x0 + ux * go, y: y0 + uy * go, dur: SS_STEP_DUR, ease: 'out', kind: 'duel_lunge', ghost: { color: '#fff59d', glow: true, every: 0.02, life: 0.22 },
        onArrive: () => {
            const same = ss.duel && ss.duel.e === t, k = same ? ss.duel.hits : 0;
            const mult = hasTalent('ss_duel_precise') ? SS_PRECISE[Math.min(2, k)] : 1; // Precise Cuts
            effects.push({ type: 'ss_lunge', x0, y0, x1: player.x, y1: player.y, life: 0.3, maxLife: 0.3 });
            const hit = ssSeg(x0, y0, player.x, player.y, 26, dmg * mult, 'melee').hit; // through everything on the way, the duelled hardest
            if (hit.length) ssStyle('q');
            if (hit.includes(t) && !t.dead) {
                ss.duel = { e: t, hits: k + 1 };
                if (hasTalent('ss_duel_mark')) t.ssChallenge = fxTime + SS_CHALLENGE_T; // Challenge
            } else ss.duel = null;
        } });
    ss.dodgeUntil = fxTime + dsh.dur + 0.05; ss.dodgeKind = 'step';
}
function duelPlunge(t, dmg) {
    const boss = ssIsBoss(t), coup = hasTalent('ss_duel_coup');
    applyDamage(t, dmg * (coup && boss ? SS_DUEL_COUP : SS_DUEL_PLUNGE), 'melee', ssAim());
    effects.push({ type: 'ss_cross_burst', x: t.x, y: t.y, big: true, life: 0.5, maxLife: 0.5 });
    if (coup && !boss && !t.dead && ssReal(t) && t.hp <= (t.maxHp || t.hp) * SS_DUEL_EXEC) { // Coup de Grace
        applyDamage(t, t.hp / HIT_SCALE * 2 + 10, 'melee', ssAim());
        ssText('Coup de grâce', '#fff59d', 58);
    }
    ss.duel = null; hitStopTimer = Math.max(hitStopTimer, 0.08);
}

// ---------- E: Strike Air (web A Wind Cannon, B Eye of the Storm) ----------

const ssAirStun = () => hasTalent('ss_air_stun') ? 0.9 : SS_AIR_STUN; // web: Pressure
function ssE(sk, dmg) {
    ssWeave();
    const a = ssAim(), up = ssUpg(2);
    ssAnim('air', 0.25, a);
    if (up === 'A') return windCannon(dmg, a);
    if (up === 'B') return eyeOfStorm(dmg);
    const R = hasTalent('ss_air_wide') ? 150 : SS_AIR_R; // web: Broad Gust
    effects.push({ type: 'ss_air', x: player.x, y: player.y, r: R, life: 0.45, maxLife: 0.45 });
    const n = ssRing(player.x, player.y, R, dmg, 'melee', e => {
        if (!ssMovable(e)) return;
        e.stunTimer = Math.max(e.stunTimer || 0, ssAirStun());
        const pa = Math.atan2(e.y - player.y, e.x - player.x);
        if (!mkBlocked(e.x + Math.cos(pa) * SS_AIR_PUSH, e.y + Math.sin(pa) * SS_AIR_PUSH, e.size / 2)) { e.x += Math.cos(pa) * SS_AIR_PUSH; e.y += Math.sin(pa) * SS_AIR_PUSH; } // monk.js: rock stops it
    });
    if (n) ssStyle('e');
    addShake(2);
}
// A Wind Cannon: a blast down a line that hurls enemies back; one that hits rock or another body is stunned
function windCannon(dmg, a) {
    const twin = hasTalent('ss_cannon_twin');
    if (twin && !ss.recast[2]) ssOpen(2, SS_CANNON_TWIN); else if (ss.recast[2]) ssClose(2); // Second Barrel: one more within 2 s
    const L = hasTalent('ss_cannon_far') ? SS_CANNON_FAR : SS_CANNON, x1 = player.x + Math.cos(a) * L, y1 = player.y + Math.sin(a) * L;
    effects.push({ type: 'ss_cannon', x: player.x, y: player.y, angle: a, len: L, w: SS_CANNON_W, life: 0.45, maxLife: 0.45 });
    const res = ssSeg(player.x, player.y, x1, y1, SS_CANNON_W, dmg, 'melee');
    if (res.n) ssStyle('e');
    const cast = { called: 0 };
    for (const e of res.hit) cannonKnock(e, a, SS_CANNON_KNOCK, cast, [e]);
    addShake(3);
}
function cannonKnock(e, a, dist, cast, hitList) {
    if (!ssMovable(e)) return;
    ssShove(e, { ang: a, left: dist, sp: 1000, bump: true, hitList,
        onStop: (o, blocked, bump) => {
            if (!blocked && !bump) return;
            o.stunTimer = Math.max(o.stunTimer || 0, SS_CANNON_STUN);
            effects.push({ type: 'ss_wall', x: o.x + Math.cos(a) * o.size / 2, y: o.y + Math.sin(a) * o.size / 2, angle: a, life: 0.35, maxLife: 0.35 });
            addShake(2);
            if (hasTalent('ss_cannon_called') && cast.called < 2) { cast.called++; ssAdd(SS_CALLED); } // Called Shot
            if (bump) {
                if (hasTalent('ss_cannon_bowl')) { hitList.push(bump); cannonKnock(bump, a, dist * 0.7, cast, hitList); } // Bowling Wind
                else bump.stunTimer = Math.max(bump.stunTimer || 0, SS_CANNON_STUN * 0.5);
            }
        } });
}
// B Eye of the Storm: everything round her is hauled in, then stunned
function eyeOfStorm(dmg) {
    const R = hasTalent('ss_eye_far') ? SS_PULL_FAR : SS_PULL_R, stun = ssAirStun();
    effects.push({ type: 'ss_eye', x: player.x, y: player.y, r: R, life: 0.5, maxLife: 0.5 });
    let pulled = 0;
    const n = ssRing(player.x, player.y, R, dmg, 'melee', e => {
        if (!ssMovable(e)) return; // bosses only take the hit
        pulled++;
        ssShove(e, { to: { x: player.x, y: player.y }, stopAt: player.radius + e.size / 2 + 6, sp: SS_PULL_SPEED,
            onStop: o => {
                o.stunTimer = Math.max(o.stunTimer || 0, stun);
                if (hasTalent('ss_eye_center')) o.ssStill = fxTime + stun; // Still Center
                if (hasTalent('ss_eye_shear')) applyDamage(o, dmg, 'melee'); // Shearing Pull
            } });
    });
    if (n) ssStyle('e');
    if (pulled >= SS_IMPLODE_N && hasTalent('ss_eye_implode')) after(0.5, () => { // Implosion
        effects.push({ type: 'ss_air', x: player.x, y: player.y, r: 150, life: 0.45, maxLife: 0.45 });
        ssRing(player.x, player.y, 150, dmg * SS_IMPLODE_MULT, 'melee'); addShake(4);
    });
    addShake(2);
}

// ---------- Space: Mana Burst (web A Counter Burst, B Overdrive) ----------

function ssSpace(sk) {
    ssWeave();
    ss.charges = Math.max(0, ss.charges - 1);
    if (ss.charges === ssMaxCharges() - 1) ss.rechT = ssFull(3); // the first one spent starts the clock
    ssBurstCd();
    const [dx, dy, dist] = getVector(player.x, player.y, mouseX, mouseY), a = dist > 6 ? Math.atan2(dy, dx) : ssAim();
    const over = ssUpg(3) === 'B', reach = over && hasTalent('ss_over_far') ? 240 : hasTalent('ss_burst_far') ? 220 : SS_BURST; // web: Afterburner, Long Jet
    ssAnim('burst', SS_BURST_DUR + 0.1, a);
    const x0 = player.x, y0 = player.y;
    const d = startDash({ x: x0 + Math.cos(a) * reach, y: y0 + Math.sin(a) * reach, dur: SS_BURST_DUR, ease: 'out', kind: 'mana_burst', ghost: { color: '#82b1ff', glow: true, every: 0.02, life: 0.2 },
        onArrive: over ? () => overdrive(x0, y0, player.x, player.y) : undefined });
    effects.push({ type: 'ss_burst', x0, y0, x1: d.x1, y1: d.y1, angle: a, over, life: 0.35, maxLife: 0.35 });
    player.iFrames = Math.max(player.iFrames, SS_BURST_IFRAMES);
    ss.dodgeUntil = fxTime + SS_BURST_IFRAMES; ss.dodgeKind = 'burst'; ss.countered = false;
}
function ssBurstCd() { cooldowns.s3 = devNoCooldowns ? 0 : ss.charges > 0 ? SS_GAP : ss.rechT; cooldownMax.s3 = ss.charges > 0 ? SS_GAP : ssFull(3); }
function ssGiveCharge() { if (ss.charges < ssMaxCharges()) { ss.charges++; if (ss.charges >= ssMaxCharges()) ss.rechT = 0; if (cooldowns.s3 > SS_GAP) cooldowns.s3 = 0; } }
// A Counter Burst: the dodge she dashed through answers itself. The blow lands as the burst starts, beside the attacker, so the
// counter waits for the burst to land (ss.counter, updateSwordsaint) and then she flashes back through whoever struck, cutting
function counterBurst(src) {
    let t = src && src.enemy && ssTargetable(src.enemy) ? src.enemy : null; // training.js: the sparring dummy says who swung
    const shot = src && src.proj;
    if (shot) { // Return Fire: the shooter (or whoever stands back along the shot's line)
        if (!hasTalent('ss_counter_shot')) return;
        const o = shot.owner && !shot.owner.dead && ssTargetable(shot.owner) ? shot.owner : null;
        if (o && Math.hypot(o.x - player.x, o.y - player.y) <= SS_COUNTER_SHOT) t = o;
        else { const sp = Math.hypot(shot.vx || 0, shot.vy || 0) || 1, bx = player.x - (shot.vx || 0) / sp * SS_COUNTER_SHOT, by = player.y - (shot.vy || 0) / sp * SS_COUNTER_SHOT; let bd = 60;
            for (const e of enemies) if (ssTargetable(e) && ssReal(e)) { const d = distToSegment(e.x, e.y, player.x, player.y, bx, by) - e.size / 2; if (d < bd) { bd = d; t = e; } } }
    } else if (!t) { let bd = SS_COUNTER_R; for (const e of enemies) if (ssTargetable(e) && ssReal(e)) { const d = Math.hypot(e.x - player.x, e.y - player.y) - e.size / 2; if (d < bd) { bd = d; t = e; } } } // melee blows carry no source: the nearest is the one
    if (!t) return;
    ss.countered = true; ss.counter = { e: t, at: fxTime };
    effects.push({ type: 'ss_counter_mark', e: t, life: 0.4, maxLife: 0.4 }); // swordsaint_fx.js: the attacker is marked at once
}
function counterFlash() {
    const t = ss.counter.e; ss.counter = null;
    if (!ssTargetable(t)) return;
    const [dx, dy, d] = getVector(player.x, player.y, t.x, t.y), ux = dx / (d || 1), uy = dy / (d || 1), a = Math.atan2(uy, ux);
    const go = d + t.size / 2 + player.radius + 18, x0 = player.x, y0 = player.y; // through them, to their far side
    const strike = () => {
        effects.push({ type: 'ss_lunge', x0, y0, x1: player.x, y1: player.y, blue: true, life: 0.3, maxLife: 0.3 });
        if (t.dead) return;
        effects.push({ type: 'ss_counter', x: t.x, y: t.y, angle: a, life: 0.4, maxLife: 0.4 });
        applyDamage(t, calcDmg(activeClass.basicDmg) * SS_COUNTER_MULT, 'melee_basic', a);
        if (ssReal(t)) ssStyle('counter');
        if (hasTalent('ss_counter_stun')) ssStagger(t, 1); // Disarm
        if (hasTalent('ss_counter_charge')) ssGiveCharge(); // Flowing Counter
        if (hasTalent('ss_counter_time') && ss.bullet > 0) ss.bullet += 1; // Time Stands Still
        ssText('Counter!', '#82b1ff', 58);
    };
    ssAnim('burst', 0.16, a);
    startDash({ x: x0 + ux * go, y: y0 + uy * go, dur: 0.1, ease: 'out', kind: 'counter_burst', ghost: { color: '#82b1ff', glow: true, every: 0.012, life: 0.25 }, onArrive: strike });
}
// B Overdrive: the burst cuts everything it passed through
function overdrive(x0, y0, x1, y1) {
    const res = ssSeg(x0, y0, x1, y1, 28, calcDmg(activeClass.basicDmg), 'melee');
    for (const e of res.hit) if (ssReal(e)) effects.push({ type: 'ss_cross_burst', x: e.x, y: e.y, life: 0.3, maxLife: 0.3 });
    if (res.n) { ssStyle('burst'); ssAdd(SS_OVER_STYLE * Math.min(3, res.n) * (ss.unsealed > 0 ? SS_UNSEAL_GAIN : 1)); } // three enemies' worth at most
    if (res.n >= 3 && hasTalent('ss_over_momentum') && ss.charges < ssMaxCharges()) { ss.rechT = Math.max(0, ss.rechT - SS_MOMENTUM); if (ss.charges === 0) cooldowns.s3 = ss.rechT; } // Momentum: the next charge comes sooner
    if (hasTalent('ss_over_wake')) ss.wakes.push({ x0, y0, x1, y1, t: SS_WAKE_T, dmg: calcDmg(activeClass.basicDmg) * 0.5 }); // Prana Wake
    ss.overCut = { t: fxTime, list: res.hit.filter(e => ssReal(e)) }; // Crossfire
}

// ---------- R: Unsealed Blade / Excalibur (web A Endless Seal, B Twin Moons) ----------

const ssBeamW = () => hasTalent('ss_beam_wide') ? 50 : SS_BEAM_W; // web: Broad Light
const ssMoonMax = () => hasTalent('ss_moon_third') ? 3 : 2;
function ssExtendSeal(t) { ss.unsealed += t; if (ss.recast[4]) ss.recast[4].max = Math.max(ss.recast[4].max, ss.unsealed); }
function ssR(sk, dmg, k) {
    ssWeave();
    if (ss.recast[4]) return excalibur(dmg, k || 0);
    ss.unsealed = hasTalent('ss_unseal_long') ? 15 : SS_UNSEAL_TIME; // web: Long Unsealing
    ss.unsealT = 0; ss.sealGain = 0; ss.moons = 0; ss.lastBeam = null;
    ssOpen(4, ss.unsealed);
    ssAnim('unseal', 0.5, ssAim());
    effects.push({ type: 'ss_unseal', x: player.x, y: player.y, life: 0.9, maxLife: 0.9 });
    ssText('UNSEALED', '#ffe082', 46);
    addShake(3);
}
// The recast, held (main.js startCharge / releaseCharge): up to 1 s with the sword raised, rooted; x1 to x2 by the charge
function excalibur(dmg, k) {
    const up = ssUpg(4), a = ssAim(), L = SS_BEAM_LEN, w = ssBeamW(), x0 = player.x, y0 = player.y, x1 = x0 + Math.cos(a) * L, y1 = y0 + Math.sin(a) * L;
    let mult = 1 + k, tag = 'beam';
    if (up === 'B') { // Twin Moons: two quick beams (three with Third Moon), each x0.6 to x1.2
        ss.moons++; mult = 0.6 + 0.6 * k;
        const prev = ss.lastBeam;
        if (prev && hasTalent('ss_moon_rhythm')) { tag = 'beam' + ss.moons; if (fxTime - prev.t <= 1) mult *= 1.25; } // Double Rhythm
        if (prev && hasTalent('ss_moon_cross')) { const p = ssCrossPoint(prev, { x0, y0, x1, y1 }); if (p) after(0.1, () => { // Crossing Moons
            effects.push({ type: 'ss_cross_burst', x: p[0], y: p[1], big: true, life: 0.6, maxLife: 0.6 }); effects.push({ type: 'ss_slam', x: p[0], y: p[1], r: 90, angle: a, life: 0.45, maxLife: 0.45 });
            ssRing(p[0], p[1], 90, dmg, 'magic'); addShake(4); }); }
        if (hasTalent('ss_moon_step')) ssGiveCharge(); // Moonlit Step
        ss.lastBeam = { x0, y0, x1, y1, t: fxTime };
        if (ss.moons < ssMoonMax()) cooldowns.s4 = cooldownMax.s4 = devNoCooldowns ? 0 : SS_GAP; // castSkill set the full one: not yet
        else ss.recast[4] = null; // the last moon: the seal runs on, the R is spent
    } else if (up === 'A' && hasTalent('ss_seal_ever')) { // Everlasting Light: the seal holds, a beam every 6 s
        cooldowns.s4 = devNoCooldowns ? 0 : Math.min(SS_EVER_CD, ss.unsealed); cooldownMax.s4 = SS_EVER_CD;
    } else ss.recast[4] = null; // the beam is spent, but the seal runs its time; the full cooldown waits for it (updateSwordsaint)
    ssAnim('beam', 0.45, a);
    effects.push({ type: 'ss_beam', x: x0, y: y0, angle: a, len: L, w, k: up === 'B' ? k * 0.6 : k, life: 0.9, maxLife: 0.9 });
    if (ssSeg(x0, y0, x1, y1, w, dmg * mult, 'magic').n) ssStyle(tag);
    addShake(4 + 3 * k); hitStopTimer = Math.max(hitStopTimer, 0.04 + 0.05 * k);
}
function ssCrossPoint(a, b) { // where two beams cross, if they do
    const rx = a.x1 - a.x0, ry = a.y1 - a.y0, sx = b.x1 - b.x0, sy = b.y1 - b.y0, den = rx * sy - ry * sx;
    if (Math.abs(den) < 1e-6) return null;
    const t = ((b.x0 - a.x0) * sy - (b.y0 - a.y0) * sx) / den, u = ((b.x0 - a.x0) * ry - (b.y0 - a.y0) * rx) / den;
    return t >= 0 && t <= 1 && u >= 0 && u <= 1 ? [a.x0 + rx * t, a.y0 + ry * t] : null;
}

// ---------- RMB: Hammer of the Wind King ----------

function ssRmb() {
    cooldowns.rmb = cooldownMax.rmb = devNoCooldowns ? 0 : SS_WIND_CD * getCDR();
    ssWeave();
    const a = ssAim();
    ssAnim('air', 0.3, a);
    ss.winds.push({ x: player.x + Math.cos(a) * 30, y: player.y + Math.sin(a) * 30, ang: a, left: SS_WIND_REACH, t: 0, dmg: calcDmg(activeClass.basicDmg) * SS_WIND_MULT, ticks: new Map(), scored: false });
    addShake(2);
}
function updateWinds(dt) {
    for (let i = ss.winds.length - 1; i >= 0; i--) {
        const w = ss.winds[i], step = Math.min(w.left, SS_WIND_SPEED * dt), vx = Math.cos(w.ang), vy = Math.sin(w.ang);
        w.t += dt;
        if (step <= 0 || mkBlocked(w.x + vx * step, w.y + vy * step, 12)) { ss.winds.splice(i, 1); effects.push({ type: 'ss_wind_end', x: w.x, y: w.y, life: 0.35, maxLife: 0.35 }); continue; } // monk.js: rock ends it
        w.x += vx * step; w.y += vy * step; w.left -= step;
        for (const e of enemies.slice()) {
            if (!ssTargetable(e) || Math.hypot(e.x - w.x, e.y - w.y) > SS_WIND_R + e.size / 2) continue;
            if (ssMovable(e)) { // carried along and drawn into its eye
                const [px, py, pd] = getVector(e.x, e.y, w.x, w.y), pull = Math.min(pd, SS_WIND_PULL * dt);
                const mx = vx * step + (pd > 1 ? px / pd * pull : 0), my = vy * step + (pd > 1 ? py / pd * pull : 0);
                if (!mkBlocked(e.x + mx, e.y + my, e.size / 2)) { e.x += mx; e.y += my; }
                e.stunTimer = Math.max(e.stunTimer || 0, 0.1);
            }
            if (w.t >= (w.ticks.get(e) || 0)) {
                w.ticks.set(e, w.t + SS_WIND_TICK);
                applyDamage(e, w.dmg, 'melee', w.ang);
                if (!w.scored && ssReal(e)) { w.scored = true; ssStyle('rmb'); }
            }
        }
    }
}

// ---------- the web's lingering pieces: launched enemies, the cyclone, the prana wake ----------

function updateSsWeb(dt) {
    for (let i = ss.launched.length - 1; i >= 0; i--) { // Tempest Dance: up, helpless, and down again (main.js draws e.mkLift)
        const l = ss.launched[i], e = l.e;
        if (e.dead || (l.t -= dt) <= 0) { e.mkLift = 0; ss.launched.splice(i, 1); continue; }
        e.mkLift = 46 * Math.sin(Math.PI * (1 - l.t / l.max));
        e.stunTimer = Math.max(e.stunTimer || 0, 0.1);
    }
    for (let i = ss.cyclones.length - 1; i >= 0; i--) { // Eye of the Tempest: it keeps the heap pulled in and cut
        const c = ss.cyclones[i]; c.t -= dt;
        if (c.t <= 0) { ss.cyclones.splice(i, 1); effects.push({ type: 'ss_wind_end', x: c.x, y: c.y, life: 0.35, maxLife: 0.35 }); continue; }
        for (const e of enemies.slice()) {
            if (!ssTargetable(e)) continue;
            const [dx, dy, d] = getVector(e.x, e.y, c.x, c.y);
            if (d > SS_EYE_R + e.size / 2) continue;
            if (ssMovable(e) && d > 12) { const s = Math.min(d - 10, 220 * dt); if (!mkBlocked(e.x + dx / d * s, e.y + dy / d * s, e.size / 2)) { e.x += dx / d * s; e.y += dy / d * s; } }
            const life = SS_EYE_TIME - c.t;
            if (life >= (c.ticks.get(e) || 0)) { c.ticks.set(e, life + SS_EYE_TICK); applyDamage(e, c.dmg, 'melee'); }
        }
    }
    for (let i = ss.wakes.length - 1; i >= 0; i--) { // Prana Wake: blue fire along the burst
        const w = ss.wakes[i]; w.t -= dt;
        if (w.t <= 0) { ss.wakes.splice(i, 1); continue; }
        for (const e of enemies.slice()) if (ssTargetable(e) && fxTime >= (e.ssWakeAt || 0) && distToSegment(e.x, e.y, w.x0, w.y0, w.x1, w.y1) <= SS_WAKE_W + e.size / 2) {
            e.ssWakeAt = fxTime + SS_WAKE_TICK; applyDamage(e, w.dmg, 'dot'); // one tick at a time however many wakes it stands in
        }
    }
}

// ---------- every frame (main.js update) ----------

function updateSwordsaint(dt) {
    if (!isSwordsaint()) return;
    if (ss.bullet > 0) ss.bullet = Math.max(0, ss.bullet - dt);
    const q = ss.recast[1];
    if (q && (q.t -= dt) <= 0) { ssClose(1); ss.duel = null; }
    const e2 = ss.recast[2];
    if (e2 && (e2.t -= dt) <= 0) ssClose(2); // Second Barrel lapsed
    if (ss.unsealed > 0) {
        const charging = player.charge && player.charge.slot === 4;
        if (!charging) { ss.unsealed -= dt; ss.unsealT += dt; }
        if (ss.unsealed <= 0) { ss.unsealed = 0; ss.recast[4] = null; ssClose(4); } // the seal closes again: the full cooldown starts
        else if (ss.recast[4]) ss.recast[4].t = ss.unsealed;
        else cooldowns.s4 = cooldownMax.s4 = ssFull(4); // the beam is spent: the cooldown holds until the seal closes
    }
    const max = ssMaxCharges();
    if (ss.charges > max) ss.charges = max;
    if (ss.charges < max) { // Mana Burst's charges come back one at a time
        ss.rechT -= dt;
        if (ss.rechT <= 0 || devNoCooldowns) { ss.charges++; ss.rechT = ss.charges < max ? ssFull(3) : 0; if (cooldowns.s3 > SS_GAP) cooldowns.s3 = 0; }
        else if (ss.charges === 0) cooldowns.s3 = ss.rechT;
    }
    if (ss.style > 0) ssAdd(-(fxTime - ss.hitT > SS_IDLE ? SS_DRAIN : SS_DECAY) * dt); // it always ebbs a little: cuts alone can't hold it up
    if (ss.counter && (!player.dash || fxTime - ss.counter.at > 0.5)) counterFlash(); // Counter Burst: once Mana Burst has landed
    updateShoves(dt); updateSsWeb(dt); updateWinds(dt);
}

window.SkillRegistry.Swordsaint = { 1: ssQ, 2: ssE, 3: ssSpace, 4: ssR, rmb: ssRmb,
    charge: { 4: () => ss.recast[4] ? { max: ssUpg(4) === 'B' ? SS_MOON_CHARGE : SS_BEAM_CHARGE, slow: 0 } : null } }; // the first R unseals at once; the recast is held (Twin Moons: faster)
