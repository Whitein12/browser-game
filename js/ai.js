// ==========================================
// ai.js - Enemy and Boss Logic
// ==========================================

var MeleeAI = (e, dt, curSpd, edx, edy, edist, i) => {
    if (edist > 0) { e.x += (edx/edist)*curSpd*dt; e.y += (edy/edist)*curSpd*dt; }
    if (edist < player.radius + e.size / 2 + 5) { 
        if (e.meleeTimer <= 0) { takeDamage(e.dmg); e.meleeTimer = 1.0; }
        if (e.type === 'slime_melee') buffs.slowed = 0.5; 
    }
    if (e.type === 'toxic_sludge') {
        e.puddleTimer -= dt; if (e.puddleTimer <= 0) { effects.push({ type: 'puddle', x: e.x, y: e.y, radius: 25, color: '#009688', life: 1.5, maxLife: 1.5 }); e.puddleTimer = 0.8; }
    }
};

var RangedAI = (e, dt, curSpd, edx, edy, edist, i) => {
    if (edist > 250) { e.x += (edx/edist)*curSpd*dt; e.y += (edy/edist)*curSpd*dt; }
    e.attackTimer -= dt;
    if (e.attackTimer <= 0 && edist <= 400 && e.frozenTimer <= 0 && shotClear(e.x, e.y, player.x, player.y)) {
        let projShape = e.type === 'archer' ? 'arrow' : 'slime_blob';
        const [sx, sy, sd] = getVector(e.x, e.y, player.x, player.y); // the real line, even while walking a detour
        projectiles.push({ x: e.x, y: e.y, vx: (sx/sd)*350, vy: (sy/sd)*350, radius: 6, color: e.type==='archer' ? '#8d6e63' : '#ba68c8', life: 3.0, isEnemy: true, owner: e, damage: e.dmg, shape: projShape });
        if (e.type === 'archer') { e.ammo--; if (e.ammo <= 0) { e.ammo = 3; e.attackTimer = 2.0; } else { e.attackTimer = 0.4; } } 
        else { e.attackTimer = 2.5; }
    }
};

// Bandit melee (the thief and the shieldbearer attack on purpose now instead of hurting on touch). The wind-ups are the
// warning: the thief draws its daggers back, the shieldbearer pulls its shield in while a wedge marks the bash (bandits.js).
const THIEF_WINDUP = 0.3, THIEF_LUNGE = 620, THIEF_THRUST = 1.3;  // the thrust hits for x1.3
const BASH_WINDUP = 0.5, BASH_DMG = 2.0, BASH_KNOCK = 70;         // the bash hits for x2 and shoves you back
const TRAP_THROW = 2, TRAP_CD = 6, TRAP_CAP = 3; // trappers: traps per throw, seconds between throws, most of one trapper's traps down at once
const CHARGE_WINDUP = 0.7, CHARGE_SPEED = 1150, CHARGE_MAX = 560; // the Warchief's Bull Rush
const RIDER_AIM = 0.75, RIDER_LOCK = 0.2, RIDER_SPEED = 640, RIDER_RANGE = 520, RIDER_DMG = 2.0; // the horse rider's lance: aim, lock, ride-by
const RIDER_LOCK_TIME = 0.35; // the horse rider's lane locks this long before the charge (the Beastmaster keeps RIDER_LOCK)
const SLING_CD = 2.6, SLING_WINDUP = 0.6, SLING_SPEED = 420, SLING_NEAR = 260, SLING_FAR = 380; // the slinger: seconds between stones, wind-up, stone speed, the range it keeps
const RALLY_RADIUS = 300, RALLY_SPEED = 1.3, RALLY_DMG = 1.25; // the bannerman's banner: allies within RALLY_RADIUS run faster and hit harder (main.js)
const HOUND_RING = 130, HOUND_DART = 520, HOUND_DART_T = 0.35, HOUND_RETREAT_T = 0.5, HOUND_DRIFT = 0.9, HOUND_SPACING = 0.9; // the pack hound's ring, lunge and spacing

var ThiefAI = (e, dt, curSpd, edx, edy, edist, i) => {
    const [rx, ry, rd] = getVector(e.x, e.y, player.x, player.y);
    e.stateTimer = (e.stateTimer || 0) - dt;
    if (e.frozenTimer > 0) e.state = null;
    if (!e.state || e.state === 'idle') {
        if (rd > 70 && edist > 0 && edist !== Infinity) { e.x += (edx/edist)*curSpd*dt; e.y += (edy/edist)*curSpd*dt; }
        if (rd < 105 && e.stateTimer <= 0 && curSpd > 0 && (!currentMap.grid || walkClear(e.x, e.y, player.x, player.y))) { e.state = 'windup'; e.stateTimer = THIEF_WINDUP; }
    } else if (e.state === 'windup') {
        if (e.stateTimer <= 0) { e.state = 'lunge'; e.stateTimer = 0.14; e.lungeA = Math.atan2(ry, rx); e.hitDone = false; }
    } else if (e.state === 'lunge') { // a quick step through with both daggers
        const sp = curSpd > 0 ? THIEF_LUNGE : 0; e.x += Math.cos(e.lungeA) * sp * dt; e.y += Math.sin(e.lungeA) * sp * dt;
        if (!e.hitDone && rd < player.radius + e.size / 2 + 16) { e.hitDone = true; takeDamage(e.dmg * THIEF_THRUST); }
        if (e.stateTimer <= 0) { e.state = 'recover'; e.stateTimer = 0.35; }
    } else if (e.stateTimer <= 0) { e.state = null; e.stateTimer = 0.6 + Math.random() * 0.5; } // recovering: open to a counter
};

var ShieldAI = (e, dt, curSpd, edx, edy, edist, i) => {
    const [rx, ry, rd] = getVector(e.x, e.y, player.x, player.y);
    e.stateTimer = (e.stateTimer || 0) - dt;
    if (e.frozenTimer > 0) e.state = null;
    if (!e.state || e.state === 'idle') {
        if (rd > 60 && edist > 0 && edist !== Infinity) { e.x += (edx/edist)*curSpd*dt; e.y += (edy/edist)*curSpd*dt; }
        if (rd < 95 && e.stateTimer <= 0 && curSpd > 0 && (!currentMap.grid || walkClear(e.x, e.y, player.x, player.y))) { e.state = 'bash_windup'; e.stateTimer = BASH_WINDUP; }
    } else if (e.state === 'bash_windup') {
        const fa = e.facingAngle !== undefined ? e.facingAngle : Math.atan2(ry, rx); // the shield swings round onto the hero
        let turn = Math.atan2(ry, rx) - fa; while (turn > Math.PI) turn -= Math.PI * 2; while (turn < -Math.PI) turn += Math.PI * 2;
        e.facingAngle = fa + Math.sign(turn) * Math.min(Math.abs(turn), 7 * dt);
        if (e.stateTimer <= 0) { e.state = 'bash'; e.stateTimer = 0.18; e.bashA = e.facingAngle !== undefined ? e.facingAngle : Math.atan2(ry, rx); e.hitDone = false; }
    } else if (e.state === 'bash') { // a lurch forward behind the shield (or the axe, once the shield is gone)
        const sp = curSpd > 0 ? 560 : 0; e.x += Math.cos(e.bashA) * sp * dt; e.y += Math.sin(e.bashA) * sp * dt;
        let off = Math.atan2(ry, rx) - e.bashA; while (off > Math.PI) off -= Math.PI * 2; while (off < -Math.PI) off += Math.PI * 2;
        if (!e.hitDone && rd < player.radius + e.size / 2 + 30 && Math.abs(off) < 1.35) {
            e.hitDone = true;
            takeDamage(e.dmg * BASH_DMG);
            if (!player.dash && !player.grappleTarget) { // shoved back and staggered
                buffs.slowed = Math.max(buffs.slowed, 0.6);
                player.x += Math.cos(e.bashA) * BASH_KNOCK; player.y += Math.sin(e.bashA) * BASH_KNOCK; clampToBounds(player, player.radius);
            }
            addShake(3); burst(player.x, player.y, e.bashA, 1.4, 8, { kind: 'spark', color: '#ffe0b2', size: 2.4, speed: [120, 300], life: 0.25, drag: 5 });
        }
        if (e.stateTimer <= 0) { e.state = 'bash_recover'; e.stateTimer = 0.5; }
    } else if (e.stateTimer <= 0) { e.state = null; e.stateTimer = 1.0 + Math.random() * 0.5; }
};

// The horse rider: it circles the hero at 300 px, then sets its lance on a lane (lance_aim: slowed, turning, the lane
// locked for the last RIDER_LOCK s) and charges down it, hitting once. A horse can't stop on a coin, so after a charge it
// wheels away in a wide turn. The lane is drawn in bandits.js (lance_lane); the horse's pose reads 'charge' and 'wheel'.
const riderTurn = (h, target, max) => { let d = target - h; while (d > Math.PI) d -= Math.PI * 2; while (d < -Math.PI) d += Math.PI * 2; return h + Math.sign(d) * Math.min(Math.abs(d), max); };
const riderBlocked = (e, nx, ny) => (currentMap.grid && solidCell(terrainAt(nx, ny), false)) || (currentMap.obstacles || []).some(o => o.kind !== 'keg' && Math.hypot(nx - o.x, ny - o.y) < o.r + e.size / 2);
var RiderAI = (e, dt, curSpd, edx, edy, edist, i) => {
    const [rx, ry, rd0] = getVector(e.x, e.y, player.x, player.y), rd = rd0 || 1, ux = rx / rd, uy = ry / rd;
    e.stateTimer = (e.stateTimer === undefined ? 1.5 : e.stateTimer) - dt;
    if (e.heading === undefined) e.heading = Math.atan2(ry, rx);
    if (!e.state || e.state === 'idle' || e.state === 'ride') {
        e.state = 'ride';
        if (curSpd > 0) {
            let mx = -uy + ux * 0.25, my = ux + uy * 0.25; // round the hero at its distance, a little pull in
            if (rd > 300 && edist > 0 && edist !== Infinity) { mx = edx / edist; my = edy / edist; } // closing in first
            const ml = Math.hypot(mx, my) || 1; e.x += mx / ml * curSpd * dt; e.y += my / ml * curSpd * dt; e.heading = Math.atan2(my, mx);
        }
        if (rd < player.radius + e.size / 2 + 5 && e.meleeTimer <= 0) { takeDamage(e.dmg); e.meleeTimer = 1.0; }
        if (e.stateTimer <= 0 && curSpd > 0 && rd < 460 && (!currentMap.grid || walkClear(e.x, e.y, player.x, player.y))) {
            e.state = 'lance_aim'; e.stateTimer = RIDER_AIM; e.laneA = Math.atan2(ry, rx);
            effects.push({ type: 'lance_lane', e, w: 26, lockAt: RIDER_AIM - RIDER_LOCK_TIME, life: RIDER_AIM, maxLife: RIDER_AIM }); // bandits.js draws the lane
        }
    } else if (e.state === 'lance_aim') { // slowed to a walk; the lance follows the hero until the lane locks
        if (e.stateTimer > RIDER_LOCK_TIME) e.laneA = Math.atan2(ry, rx);
        e.heading = riderTurn(e.heading, e.laneA, 4 * dt);
        if (curSpd > 0) { e.x += ux * curSpd * 0.2 * dt; e.y += uy * curSpd * 0.2 * dt; }
        if (e.stateTimer <= 0) {
            if (curSpd > 0) { e.state = 'charge'; e.chargeLeft = RIDER_RANGE; e.hitDone = false; }
            else { e.state = 'ride'; e.stateTimer = 1.0; }
        }
    } else if (e.state === 'charge') { // straight down the lane; rock, a building or a rooting ends it early
        const step = RIDER_SPEED * dt, nx = e.x + Math.cos(e.laneA) * step, ny = e.y + Math.sin(e.laneA) * step;
        e.heading = e.laneA;
        if (curSpd <= 0 || riderBlocked(e, nx, ny)) { e.state = 'wheel'; e.stateTimer = 1.0; }
        else {
            e.x = nx; e.y = ny; e.chargeLeft -= step;
            if (!e.hitDone && Math.hypot(e.x - player.x, e.y - player.y) < e.size / 2 + player.radius + 6) { // the lance: once per charge
                e.hitDone = true; takeDamage(e.dmg * RIDER_DMG); buffs.slowed = Math.max(buffs.slowed, 1.0); addShake(3);
                burst(player.x, player.y, e.laneA, 1.4, 8, { kind: 'spark', color: '#ffe0b2', size: 2.4, speed: [120, 300], life: 0.25, drag: 5 });
            }
            if (e.chargeLeft <= 0) { e.state = 'wheel'; e.stateTimer = 1.0; }
        }
    } else if (e.state === 'wheel') { // a wide turn, still moving: swings round toward the hero at 2.6 rad/s
        e.heading = riderTurn(e.heading, Math.atan2(ry, rx), 2.6 * dt);
        const nx = e.x + Math.cos(e.heading) * 300 * dt, ny = e.y + Math.sin(e.heading) * 300 * dt;
        if (curSpd > 0 && !riderBlocked(e, nx, ny)) { e.x = nx; e.y = ny; }
        if (e.stateTimer <= 0) { e.state = 'ride'; e.stateTimer = 2.2 + Math.random() * 0.8; }
    }
    e.facingAngle = e.heading; // a horse faces where it goes (main.js points it at the hero before the AI runs)
};

// The bannerman never fights. It hangs back 120 px behind its nearest bandit ally, on the side away from the hero, or keeps
// 300-380 px off the hero when it has no one to hide behind. Every 3 s it raises the banner: a red ring pulses out and
// bandits near it are rallied (main.js). The banner's pose is bandits.js (p.raise).
// Is the straight line from the bannerman to its target clear of rock? Cached for 0.25 s (walkClear walks the cells)
const bannermanSees = (e, tx, ty) => { if (e.bmLosAt === undefined || fxTime >= e.bmLosAt) { e.bmLos = walkClear(e.x, e.y, tx, ty); e.bmLosAt = fxTime + 0.25; } return e.bmLos; };
var BannermanAI = (e, dt, curSpd, edx, edy, edist, i) => {
    e.allyCd = (e.allyCd || 0) - dt;
    if (e.allyCd <= 0) { // the nearest-ally search only every 0.3 s
        e.allyCd = 0.3; e.allyRef = null; let ad = 600;
        for (const o of enemies) {
            if (o === e || o.dead || o.prop || o.spawnT > 0 || !BANDIT_TYPES[o.type]) continue;
            const d = Math.hypot(o.x - e.x, o.y - e.y); if (d < ad) { ad = d; e.allyRef = o; }
        }
    }
    const ally = e.allyRef && !e.allyRef.dead ? e.allyRef : null;
    if (ally) {
        const [ax, ay, adist] = getVector(ally.x, ally.y, player.x, player.y);
        const tx = ally.x - ax / adist * 120, ty = ally.y - ay / adist * 120;
        const [mx, my, md] = getVector(e.x, e.y, tx, ty);
        if (curSpd > 0 && md > 0) {
            if (currentMap.grid && !bannermanSees(e, tx, ty)) { // a tent or a tree in the way: take the flow field's route round it
                if (edist > 0 && edist !== Infinity) { e.x += edx / edist * curSpd * dt; e.y += edy / edist * curSpd * dt; }
            } else { const s = Math.min(curSpd * dt, md); e.x += mx / md * s; e.y += my / md * s; }
        }
    } else if (curSpd > 0 && edist !== Infinity && edist > 0) {
        if (edist > 380) { e.x += edx / edist * curSpd * dt; e.y += edy / edist * curSpd * dt; }
        else if (edist < 300) { e.x -= edx / edist * curSpd * dt; e.y -= edy / edist * curSpd * dt; }
    }
    e.rallyCd = (e.rallyCd === undefined ? Math.random() * 1.5 : e.rallyCd) - dt;
    if (e.rallyCd <= 0) {
        e.rallyCd = 3; e.rallyAt = fxTime;
        effects.push({ type: 'rally_pulse', x: e.x, y: e.y, radius: RALLY_RADIUS, life: 0.6, maxLife: 0.6 }); // bandits.js: a thin ring, no fill
    }
};

// The slinger: keeps 260-380 px off the hero (the flow field's way round walls), and every SLING_CD s, with a clear shot, winds up
// and lobs one stone at where the hero stood at release; the landing marker shows where. It stands still while winding up.
var SlingerAI = (e, dt, curSpd, edx, edy, edist, i) => {
    e.stateTimer = (e.stateTimer === undefined ? 0.8 + Math.random() * 0.8 : e.stateTimer) - dt;
    const rd = Math.hypot(player.x - e.x, player.y - e.y);
    if (e.frozenTimer > 0 && e.state === 'windup') { e.state = null; e.stateTimer = SLING_CD * 0.5; }
    if (e.state === 'windup') {
        e.facingAngle = Math.atan2(player.y - e.y, player.x - e.x);
        if (e.stateTimer <= 0) {
            const tx = player.x, ty = player.y, flight = Math.max(0.15, Math.hypot(tx - e.x, ty - e.y) / SLING_SPEED);
            projectiles.push({ type: 'sling_stone', x: e.x, y: e.y, ox: e.x, oy: e.y, targetX: tx, targetY: ty, speed: SLING_SPEED, radius: 7, life: flight + 0.1, isEnemy: true, owner: e, damage: 0 });
            effects.push({ type: 'slam_warn', x: tx, y: ty, radius: 26, color: '#bcaaa4', life: flight, maxLife: flight }); // where it lands
            e.state = null; e.stateTimer = SLING_CD;
        }
        return;
    }
    if (curSpd > 0 && edist > 0 && edist !== Infinity) {
        if (rd > SLING_FAR) { e.x += edx / edist * curSpd * dt; e.y += edy / edist * curSpd * dt; }
        else if (rd < SLING_NEAR) { e.x -= edx / edist * curSpd * dt; e.y -= edy / edist * curSpd * dt; }
    }
    if (e.stateTimer <= 0 && curSpd > 0 && e.frozenTimer <= 0 && rd < SLING_FAR + 120 && shotClear(e.x, e.y, player.x, player.y)) { e.state = 'windup'; e.stateTimer = SLING_WINDUP; }
};

// The hound: a pack beast that never just bumps into you. It runs a ring round the hero at its own angle (spread so the
// pack doesn't stack); from the ring it darts in, bites once and runs back out, so the pack takes turns. The sprite is
// bandits.js (BANDIT_SPRITES.hound, a stamped sprWolf), its bite is e.biteAt.
var HoundAI = (e, dt, curSpd, edx, edy, edist, i) => {
    const [rx, ry, rd0] = getVector(e.x, e.y, player.x, player.y), rd = rd0 || 1;
    if (e.master && e.master.dead) { e.xp = 0; e.hp = 0; checkEnemyDeath(e); return; } // the Beastmaster fell: his pack dies with him
    if (e.stateTimer === undefined) e.stateTimer = 0.5 + Math.random();
    if (e.orbitA === undefined) e.orbitA = Math.atan2(e.y - player.y, e.x - player.x); // its place on the ring
    if (e.heading === undefined) e.heading = Math.atan2(ry, rx);
    e.stateTimer -= dt;
    if (e.frozenTimer > 0) e.state = null;
    const ringX = player.x + Math.cos(e.orbitA) * HOUND_RING, ringY = player.y + Math.sin(e.orbitA) * HOUND_RING;
    if (!e.state || e.state === 'idle' || e.state === 'circle') {
        e.state = 'circle';
        e.orbitA += HOUND_DRIFT * dt;
        for (const o of enemies) { // pack mates keep apart round the ring
            if (o === e || o.dead || o.type !== 'hound' || o.orbitA === undefined) continue;
            let d = e.orbitA - o.orbitA; while (d > Math.PI) d -= Math.PI * 2; while (d < -Math.PI) d += Math.PI * 2;
            if (Math.abs(d) < HOUND_SPACING) e.orbitA += (d >= 0 ? 1 : -1) * (HOUND_SPACING - Math.abs(d)) * Math.min(1, 3 * dt);
        }
        const rx2 = player.x + Math.cos(e.orbitA) * HOUND_RING, ry2 = player.y + Math.sin(e.orbitA) * HOUND_RING;
        const far = edist > 400 && edist !== Infinity; // a long way off: straight at the hero (main.js's path round walls)
        const [tx, ty, td] = far ? [edx, edy, edist] : getVector(e.x, e.y, rx2, ry2);
        if (curSpd > 0) { const s = Math.min(curSpd * dt, td); e.x += tx / td * s; e.y += ty / td * s; e.heading = Math.atan2(ty, tx); }
        if (e.stateTimer <= 0 && curSpd > 0 && Math.hypot(e.x - rx2, e.y - ry2) < 40) { // on the ring, its turn: dart
            e.state = 'dart'; e.stateTimer = HOUND_DART_T; e.hitDone = false;
        }
    } else if (e.state === 'dart') { // a quick lunge straight at the hero
        if (curSpd > 0) { const s = Math.min(HOUND_DART * dt, rd); e.x += rx / rd * s; e.y += ry / rd * s; }
        e.heading = Math.atan2(ry, rx);
        if (!e.hitDone && rd < e.size / 2 + player.radius + 6) { // one bite
            e.hitDone = true; takeDamage(e.dmg); e.biteAt = fxTime;
            e.state = 'retreat'; e.stateTimer = HOUND_RETREAT_T;
        } else if (e.stateTimer <= 0) { e.state = 'retreat'; e.stateTimer = HOUND_RETREAT_T; }
    } else if (e.state === 'retreat') { // back out to the ring
        const [mx, my, md] = getVector(e.x, e.y, ringX, ringY);
        if (curSpd > 0) { const s = Math.min(curSpd * dt, md); e.x += mx / md * s; e.y += my / md * s; e.heading = Math.atan2(my, mx); }
        if (e.stateTimer <= 0) { e.state = 'circle'; e.stateTimer = 1.1 + Math.random() * 0.9; }
    }
    e.facingAngle = e.heading; // it faces where it runs (as RiderAI does)
};

// The Beastmaster's hounds: real pack hounds (HoundAI) on the wave's hound stats, `master` set so they die with him
function beastHounds(e, spots, spawnT) {
    const m = (activeDungeon.stage2_minions || []).find(mn => mn.type === 'hound'); if (!m) return;
    for (const [x, y] of spots) {
        const hp = m.baseHp + wave * m.hpScale;
        enemies.push({ x, y, size: m.size, color: m.color, speed: m.baseSpeed + Math.random() * m.speedVar + wave * 2.5, hp, maxHp: hp, type: m.type, dmg: m.baseDmg + wave * m.dmgScale, xp: 0, attackTimer: 0, meleeTimer: 0, ammo: 0, frozenTimer: 0, facingAngle: 0, puddleTimer: 0, bleedTimer: 0, bleedDmg: 0, orbs: 0, maxOrbs: 0, master: e, spawnT, spawnMax: spawnT });
        activeEnemies++;
    }
}
// The Kennel Call: a horn across the reeds, then three hounds break out of the reeds well away from the hero
function beastKennelCall(e) {
    effects.push({ type: 'slime_shock', x: e.x, y: e.y, radius: 260, color: '#c8a060', life: 0.6, maxLife: 0.6 }); addShake(4);
    const spots = [];
    for (let k = 0; k < 3; k++) {
        let sp = randomOpenSpot(380); // stage.js: open ground (null on maps without a grid)
        if (!sp) { const a = Math.random() * Math.PI * 2; sp = [e.x + Math.cos(a) * 150, e.y + Math.sin(a) * 150]; }
        spots.push(sp);
        burst(sp[0], sp[1], 0, Math.PI * 2, 10, { kind: 'dot', color: '#9ad1c8', size: 3, speed: [60, 180], life: 0.5, drag: 3 }); // splashing out of the water
    }
    beastHounds(e, spots, 0.5);
}
// The Beastmaster prowls round the hero at whip's length instead of waiting for him, and never stands idle for long:
//  - Whip Crack (in reach): the lash drawn back while a narrow wedge on the ground shows where it falls; it hits hard
//    and yanks the hero toward him. Enraged (below half) he cracks it twice.
//  - Bolas: three spinning stones that root and drag.
//  - Hounds: two of his pack cracked loose beside him (never more than BEAST_HOUND_CAP of his alive).
//  - Joust: he mounts his warhorse for three runs down marked lanes, drops two traps where the third ends, and comes off it winded.
//  - Kennel Call at 50% and 25%: a horn, and three hounds out of the reeds.
const BEAST_WHIP_WIND = 0.85, BEAST_WHIP_REACH = 250, BEAST_WHIP_ARC = 0.3, BEAST_WHIP_DMG = 1.8, BEAST_WHIP_PULL = 80;
const BEAST_JOUST_PREP = 0.8, BEAST_JOUST_SPEED = 950, BEAST_JOUST_RANGE = 620, BEAST_JOUST_DMG = 2.5, BEAST_HOUND_CAP = 4, BEAST_PROWL = 190;
function beastPrep(e, t) { // a joust's wind-up: the lane follows the hero, then locks RIDER_LOCK s before the charge
    e.state = 'joust_prep'; e.stateTimer = t; e.prepLen = t; e.laneA = Math.atan2(player.y - e.y, player.x - e.x); e.facingAngle = e.laneA;
    effects.push({ type: 'lance_lane', e, w: 50, len: BEAST_JOUST_RANGE, lockAt: t - RIDER_LOCK, life: t, maxLife: t }); // bandits.js
}
function beastWhip(e) { // the lash falls along e.whipA: a narrow wedge out to BEAST_WHIP_REACH
    const [rx, ry, rd] = getVector(e.x, e.y, player.x, player.y);
    let off = Math.atan2(ry, rx) - e.whipA; while (off > Math.PI) off -= Math.PI * 2; while (off < -Math.PI) off += Math.PI * 2;
    e.lashAt = fxTime; addShake(3);
    const tx = e.x + Math.cos(e.whipA) * BEAST_WHIP_REACH, ty = e.y + Math.sin(e.whipA) * BEAST_WHIP_REACH;
    burst(tx, ty, e.whipA, 1.2, 10, { kind: 'spark', color: '#fff3e0', size: 2.2, speed: [120, 320], life: 0.25, drag: 5 }); // the crack at the tip
    if (player.z <= 4 && rd < BEAST_WHIP_REACH + player.radius && Math.abs(off) < BEAST_WHIP_ARC + player.radius / Math.max(rd, 40)) {
        takeDamage(e.dmg * BEAST_WHIP_DMG); addShake(4);
        if (!player.dash && !player.grappleTarget && rd > e.size / 2 + player.radius + 30) { // yanked in toward him
            const pull = Math.min(BEAST_WHIP_PULL, rd - e.size / 2 - player.radius - 30);
            player.x -= rx / rd * pull; player.y -= ry / rd * pull; clampToBounds(player, player.radius);
        }
        buffs.slowed = Math.max(buffs.slowed, 0.5);
    }
}
var BeastmasterAI = (e, dt, curSpd, edx, edy, edist, i) => {
    const [rx, ry, rd] = getVector(e.x, e.y, player.x, player.y), enraged = e.hp < e.maxHp * 0.5, pace = enraged ? 0.7 : 1;
    e.stateTimer -= dt;
    if (!e.kennel1 && e.hp < e.maxHp * 0.5) { e.kennel1 = true; beastKennelCall(e); }
    if (!e.kennel2 && e.hp < e.maxHp * 0.25) { e.kennel2 = true; beastKennelCall(e); }
    if (!e.state || e.state === 'idle') {
        // prowl: close to whip's length, then circle the hero there
        if (curSpd > 0 && edist !== Infinity && edist > 0) {
            let mx = edx / edist, my = edy / edist;
            if (rd < BEAST_PROWL + 60 && (!currentMap.grid || e.los !== false)) { const sd = e.prowlSide || 1; mx = -ry / rd * sd + rx / rd * (rd - BEAST_PROWL) / 120; my = rx / rd * sd + ry / rd * (rd - BEAST_PROWL) / 120; }
            const ml = Math.hypot(mx, my) || 1; e.x += mx / ml * curSpd * dt; e.y += my / ml * curSpd * dt;
        }
        if (rd < player.radius + e.size / 2 + 5 && e.meleeTimer <= 0) { takeDamage(e.dmg * 1.2); e.meleeTimer = 0.9; }
        if (e.stateTimer <= 0 && e.frozenTimer <= 0) {
            const mine = enemies.filter(o => !o.dead && o.master === e).length, near = rd < BEAST_WHIP_REACH + 30;
            const pick = () => { const r = Math.random(); return near ? (r < 0.5 ? 'whip' : r < 0.68 ? 'bolas' : r < 0.82 ? 'hounds' : 'joust') : (r < 0.4 ? 'joust' : r < 0.72 ? 'bolas' : 'hounds'); };
            let next = pick(); if (next === e.lastAtk) next = pick(); // rarely the same move twice
            if (next === 'hounds' && mine >= BEAST_HOUND_CAP) next = near ? 'whip' : 'bolas';
            e.lastAtk = next; e.prowlSide = Math.random() < 0.5 ? -1 : 1;
            if (next === 'whip') { e.state = 'whip'; e.stateTimer = BEAST_WHIP_WIND * pace; e.whipLen = e.stateTimer; e.whipA = Math.atan2(ry, rx); e.cracks = enraged ? 2 : 1;
                effects.push({ type: 'whip_lane', e, life: e.stateTimer, maxLife: e.stateTimer }); }
            else if (next === 'bolas') { e.state = 'bolas'; e.stateTimer = 0.85 * pace; e.bolasLen = e.stateTimer; e.bolasA = Math.atan2(ry, rx); }
            else if (next === 'hounds') { e.state = 'hounds'; e.stateTimer = 0.6 * pace; }
            else { beastPrep(e, BEAST_JOUST_PREP * pace); e.joustCount = 0; }
        }
    } else if (e.state === 'whip') { // the lash drawn back; the wedge follows the hero until the last 0.3 s
        if (e.stateTimer > 0.3) e.whipA = Math.atan2(ry, rx);
        e.facingAngle = e.whipA;
        if (e.stateTimer <= 0) {
            beastWhip(e);
            if (--e.cracks > 0) { e.stateTimer = 0.65; e.whipLen = 0.65; effects.push({ type: 'whip_lane', e, life: 0.65, maxLife: 0.65 }); } // enraged: a second crack
            else { e.state = 'idle'; e.stateTimer = 1.3 * pace; }
        }
    } else if (e.state === 'bolas') {
        e.bolasK = clamp01(1 - e.stateTimer / e.bolasLen); // bandits.js: the cord spins up in his fist
        if (e.stateTimer > 0.25) e.bolasA = Math.atan2(ry, rx); // aim follows the hero, then locks for the last 0.25 s
        e.facingAngle = e.bolasA;
        if (e.stateTimer <= 0) {
            const a0 = e.bolasA;
            for (let r = -1; r <= 1; r++) { const a = a0 + r * 0.2; projectiles.push({ x: e.x, y: e.y, vx: Math.cos(a) * 560, vy: Math.sin(a) * 560, radius: 15, color: '#795548', life: 2.4, isEnemy: true, owner: e, damage: e.dmg, type: 'bolas' }); }
            e.state = 'idle'; e.stateTimer = 1.5 * pace; e.bolasK = 0;
        }
    } else if (e.state === 'hounds') {
        if (e.stateTimer <= 0) { // the whip cracks two of the pack loose beside him
            const a0 = Math.atan2(ry, rx), spots = [-0.6, 0.6].map(d => [e.x + Math.cos(a0 + d) * 55, e.y + Math.sin(a0 + d) * 55]);
            e.lashAt = fxTime; beastHounds(e, spots, 0.35);
            burst(e.x, e.y, a0, 1.0, 6, { kind: 'smoke', color: 'rgba(120, 110, 96, 0.55)', size: 10, speed: [30, 90], life: 0.6, drag: 3, grow: 18 });
            e.state = 'idle'; e.stateTimer = 1.6 * pace;
        }
    } else if (e.state === 'joust_prep') {
        if (e.stateTimer > RIDER_LOCK) e.laneA = Math.atan2(ry, rx); // the lane follows the hero until it locks
        e.facingAngle = e.laneA;
        if (e.stateTimer <= 0) { e.state = 'jousting'; e.runLeft = BEAST_JOUST_RANGE; e.dashHit = false; e.joustCount++; }
    } else if (e.state === 'jousting') {
        e.facingAngle = e.laneA;
        const step = (curSpd > 0 ? BEAST_JOUST_SPEED : 0) * dt, nx = e.x + Math.cos(e.laneA) * step, ny = e.y + Math.sin(e.laneA) * step;
        if (step === 0 || (currentMap.grid && solidCell(terrainAt(nx, ny), false))) e.runLeft = 0; // a wall (or a root) ends the run
        else { e.x = nx; e.y = ny; e.runLeft -= step; }
        if (Math.random() < 0.5) spawnParticle({ kind: 'smoke', color: 'rgba(120, 100, 80, 0.5)', x: e.x - Math.cos(e.laneA) * 40, y: e.y - Math.sin(e.laneA) * 40 + 10, vx: jitter(40), vy: jitter(40), size: 10, grow: 26, life: 0.6, drag: 2, spin: 0, rot: 0 }); // dust behind the warhorse
        if (!e.dashHit && Math.hypot(e.x - player.x, e.y - player.y) < e.size / 2 + player.radius + 8) { // ridden down
            e.dashHit = true; takeDamage(e.dmg * BEAST_JOUST_DMG); addShake(6); buffs.rooted = Math.max(buffs.rooted, 0.4);
            const side = (player.x - e.x) * -Math.sin(e.laneA) + (player.y - e.y) * Math.cos(e.laneA) > 0 ? 1 : -1;
            if (!player.dash && !player.grappleTarget) { player.x += -Math.sin(e.laneA) * side * 70 + Math.cos(e.laneA) * 30; player.y += Math.cos(e.laneA) * side * 70 + Math.sin(e.laneA) * 30; clampToBounds(player, player.radius); }
        }
        if (e.runLeft <= 0) {
            if (e.joustCount < 3) beastPrep(e, 0.5 * pace);
            else {
                for (const s of [-1, 1]) effects.push({ type: 'bear_trap', x: e.x - Math.sin(e.laneA) * s * 40, y: e.y + Math.cos(e.laneA) * s * 40, radius: 15, color: '#795548', life: 7, maxLife: 7, dmg: 0, owner: e }); // two traps where the lane ends, none in the lane
                e.state = 'winded'; e.stateTimer = 0.9; e.dismountAt = fxTime;
            } // off the horse after the third run, winded: a window to punish him
        }
    } else if (e.state === 'winded') {
        if (e.stateTimer <= 0) { e.state = 'idle'; e.stateTimer = 0.6; }
    }
};

const UNDERTOW_WARN = 0.65; // the Amalgam's Undertow: warning ring before it erupts under you (1 s was too easy to walk out of, 0.5 too tight)

var EnemyAI = {
    'slime_melee': MeleeAI, 'thief': ThiefAI, 'shield': ShieldAI, 'voltaic_ooze': MeleeAI, 'toxic_sludge': MeleeAI, 'queen_guard': MeleeAI,
    'slime_ranged': RangedAI, 'archer': RangedAI,
    
    'valerius_archer': (e, dt, curSpd, edx, edy, edist, i) => {
        e.attackTimer -= dt;
        if (e.attackTimer <= 0 && e.frozenTimer <= 0) {
            projectiles.push({ x: e.x, y: e.y, vx: (edx/edist)*400, vy: (edy/edist)*400, radius: 6, color: '#ff5722', life: 5.0, isEnemy: true, owner: e, damage: e.dmg, shape: 'arrow' });
            e.attackTimer = 1.2; 
        }
    },

    // The Warchief: a knife fan, a Bull Rush down a lane marked on the ground, and his torch (it sets the ground alight where it lands). Below half
    // health he also kicks lit powder kegs at you (bandits.js). Hitting him with a keg blast staggers him.
    'boss_warlord': (e, dt, curSpd, edx, edy, edist, i) => {
        if (edist < player.radius + e.size / 2 + 5 && e.meleeTimer <= 0) { takeDamage(e.dmg); e.meleeTimer = 1.0; }
        e.stateTimer -= dt;
        const enraged = e.hp < e.maxHp * 0.5;
        if (e.state === 'idle') {
            if (edist > 80) { e.x += (edx/edist)*curSpd*dt; e.y += (edy/edist)*curSpd*dt; }
            if (e.stateTimer <= 0 && e.frozenTimer <= 0) {
                const r = Math.random();
                if (enraged && r < 0.25) { e.state = 'keg_kick'; e.stateTimer = 0.7; }
                else if (r < (enraged ? 0.5 : 0.35)) { e.state = 'torch_toss'; e.stateTimer = 0.55; }
                else if (r < (enraged ? 0.75 : 0.68)) { e.state = 'knife_volley'; e.stateTimer = 0.5; }
                else {
                    // Bull Rush: he lowers his head and a lane on the ground shows where he'll run, then he charges down it and past you
                    const a = Math.atan2(player.y - e.y, player.x - e.x), L = Math.min(CHARGE_MAX, Math.hypot(player.x - e.x, player.y - e.y) + 200);
                    e.dashTargetX = e.x + Math.cos(a) * L; e.dashTargetY = e.y + Math.sin(a) * L;
                    const cl = clipToWalls(e.x, e.y, e.dashTargetX, e.dashTargetY, e.size / 2, false); if (cl) [e.dashTargetX, e.dashTargetY] = cl; // stage.js: never through a fence or a house
                    e.state = 'dash_telegraph'; e.stateTimer = CHARGE_WINDUP;
                    effects.push({ type: 'charge_lane', x0: e.x, y0: e.y, x1: e.dashTargetX, y1: e.dashTargetY, w: e.size * 1.25, life: CHARGE_WINDUP, maxLife: CHARGE_WINDUP }); // bandits.js
                }
            }
        } else if (e.state === 'knife_volley') {
            if (e.stateTimer <= 0) {
                const baseAngle = Math.atan2(player.y - e.y, player.x - e.x);
                for(let r=-2; r<=2; r++) { projectiles.push({ x: e.x, y: e.y, vx: Math.cos(baseAngle+(r*0.15))*500, vy: Math.sin(baseAngle+(r*0.15))*500, radius: 6, color: '#ff9800', life: 2.0, isEnemy: true, owner: e, damage: e.dmg, shape: 'knife' }); }
                e.state = 'idle'; e.stateTimer = 2.0;
            }
        } else if (e.state === 'torch_toss') { // one torch on where you stand; enraged, a second one beside you
            if (e.stateTimer <= 0) {
                warchiefTorch(e, player.x, player.y);
                if (enraged) { const a = Math.random() * Math.PI * 2; warchiefTorch(e, player.x + Math.cos(a) * 140, player.y + Math.sin(a) * 140); }
                e.state = 'idle'; e.stateTimer = 1.8;
            }
        } else if (e.state === 'keg_kick') {
            if (e.stateTimer <= 0) { warchiefKegKick(e); e.state = 'idle'; e.stateTimer = 1.8; }
        } else if (e.state === 'dash_telegraph') {
            if (e.stateTimer <= 0) {
                const [dx, dy, d] = getVector(e.x, e.y, e.dashTargetX, e.dashTargetY);
                e.state = 'dash_execute'; e.stateTimer = d / CHARGE_SPEED; e.dashSpeedX = dx / d * CHARGE_SPEED; e.dashSpeedY = dy / d * CHARGE_SPEED; e.dashHit = false; addShake(2);
            }
        } else if (e.state === 'dash_execute') {
            if (curSpd <= 0) e.stateTimer = 0; // frozen or rooted: the charge dies
            e.x += e.dashSpeedX * dt; e.y += e.dashSpeedY * dt;
            if (Math.random() < 0.5) spawnParticle({ kind: 'smoke', color: 'rgba(120, 100, 80, 0.5)', x: e.x - e.dashSpeedX * 0.03, y: e.y - e.dashSpeedY * 0.03 + 10, vx: jitter(40), vy: jitter(40), size: 10, grow: 26, life: 0.6, drag: 2, spin: 0, rot: 0 }); // dust kicked up
            if (Math.hypot(e.x - player.x, e.y - player.y) < e.size/2 + player.radius && !e.dashHit) {
                e.dashHit = true; takeDamage(e.dmg * 2); addShake(5);
                const s = Math.hypot(e.dashSpeedX, e.dashSpeedY) || 1, side = (player.x - e.x) * -e.dashSpeedY + (player.y - e.y) * e.dashSpeedX > 0 ? 1 : -1; // bowled aside
                if (!player.dash && !player.grappleTarget) { player.x += -e.dashSpeedY / s * side * 60 + e.dashSpeedX / s * 30; player.y += e.dashSpeedX / s * side * 60 + e.dashSpeedY / s * 30; clampToBounds(player, player.radius); }
            }
            if (e.stateTimer <= 0) { e.state = 'dash_recover'; e.stateTimer = 0.55; }
        } else if (e.state === 'dash_recover') { // winded for a moment after the charge: a window to punish him
            if (e.stateTimer <= 0) { e.state = 'idle'; e.stateTimer = 1.6; }
        }
    },

    'trapper': (e, dt, curSpd, edx, edy, edist, i) => { // keeps its distance and lobs traps round the hero: TRAP_THROW at a time, TRAP_CAP of its own down at most
        if (edist > 300) { e.x += (edx/edist)*curSpd*dt; e.y += (edy/edist)*curSpd*dt; } else if (edist < 200) { e.x -= (edx/edist)*curSpd*dt; e.y -= (edy/edist)*curSpd*dt; }
        e.attackTimer -= dt;
        if (e.attackTimer <= 0 && edist <= 450 && e.frozenTimer <= 0) {
            const down = effects.filter(ef => ef.type === 'bear_trap' && ef.owner === e).length + projectiles.filter(p => p.type === 'trap_throw' && p.owner === e).length;
            for (let r = 0; r < Math.min(TRAP_THROW, TRAP_CAP - down); r++) { const a = Math.random() * Math.PI * 2, d = 40 + Math.random() * 80, tx = player.x + Math.cos(a) * d, ty = player.y + Math.sin(a) * d, flight = Math.hypot(tx - e.x, ty - e.y) / 400; // 400 px/s, as main.js flies it
                projectiles.push({ x: e.x, y: e.y, ox: e.x, oy: e.y, targetX: tx, targetY: ty, vx: 0, vy: 0, radius: 8, color: '#5d4037', life: flight + 0.15, isEnemy: true, owner: e, damage: 0, type: 'trap_throw' });
                effects.push({ type: 'slam_warn', x: tx, y: ty, radius: 22, color: '#bcaaa4', life: flight, maxLife: flight }); } // where it lands
            e.attackTimer = TRAP_CD;
        }
    },
    'horse': RiderAI, 'bannerman': BannermanAI, 'hound': HoundAI, 'slinger': SlingerAI,
    'spore_slime': (e, dt, curSpd, edx, edy, edist, i) => {
        if (edist > 250) { e.x += (edx/edist)*curSpd*dt; e.y += (edy/edist)*curSpd*dt; }
        e.attackTimer -= dt;
        if (e.attackTimer <= 0 && edist <= 400 && e.frozenTimer <= 0) {
            projectiles.push({ x: e.x, y: e.y, targetX: player.x, targetY: player.y, speed: 400, radius: 8, color: '#cddc39', life: 2.0, isEnemy: true, owner: e, damage: e.dmg, type: 'spore' });
            e.attackTimer = 3.0;
        }
    },
    'crystal_slime': (e, dt, curSpd, edx, edy, edist, i) => {
        e.stateTimer -= dt;
        if (e.stateTimer <= 0) {
            e.reflective = !e.reflective; e.stateTimer = e.reflective ? 3.0 : 4.0;
            if (e.reflective) { for(let r=0; r<8; r++) { const angle = (Math.PI*2/8) * r; projectiles.push({ x: e.x, y: e.y, vx: Math.cos(angle)*200, vy: Math.sin(angle)*200, radius: 6, color: '#9c27b0', life: 2.0, isEnemy: true, owner: e, damage: e.dmg }); } }
        }
        if (e.reflective) { e.renderColor = '#9c27b0'; } // enemysprites.js draws the flared crystals and barrier
        else { e.renderColor = e.color; MeleeAI(e, dt, curSpd, edx, edy, edist, i); }
    },
    'slime_warden': (e, dt, curSpd, edx, edy, edist, i) => {
        e.invulnTimer = (e.invulnTimer || 0) - dt;
        if (e.orbs > 0) {
            e.orbitAngle = (e.orbitAngle || 0) + dt * 3; // enemysprites.js draws the orbs circling at this angle
        }
        if (e.stunTimer > 0) { e.stunTimer -= dt; return; }
        if (e.orbs < e.maxOrbs && (e.orbRegrow = (e.orbRegrow || 0) + dt) >= WARDEN_ORB_REGROW) { // lost orbs grow back one at a time
            e.orbs++; e.orbRegrow = 0;
            burst(e.x, e.y, 0, Math.PI * 2, 8, { kind: 'spark', color: '#ffca28', size: 2.5, life: 0.35, speed: [60, 160], drag: 4 });
        }
        MeleeAI(e, dt, curSpd, edx, edy, edist, i);
    },
    'boss_slime': (e, dt, curSpd, edx, edy, edist, i) => {
        if (e.state !== 'bounce_telegraph' && edist < player.radius + e.size / 2 + 5 && e.meleeTimer <= 0) { takeDamage(e.dmg); e.meleeTimer = 1.0; }
        e.stateTimer -= dt;
        if (e.state === 'idle') {
            if (edist > 50) { e.x += (edx/edist)*curSpd*dt; e.y += (edy/edist)*curSpd*dt; }
            if (e.stateTimer <= 0 && e.frozenTimer <= 0) { if (Math.random() < 0.5) { e.state = 'bounce_telegraph'; e.stateTimer = 0.6; e.dashTargetX = player.x; e.dashTargetY = player.y; } else { e.state = 'fireball'; e.stateTimer = 0.5; } }
        } else if (e.state === 'fireball') {
            if (e.stateTimer <= 0) {
                for(let r=0; r<4; r++) { const angle = (Math.PI*2/4) * r + (Math.PI/4); projectiles.push({ x: e.x, y: e.y, vx: Math.cos(angle)*300, vy: Math.sin(angle)*300, radius: 10, color: '#ff3d00', life: 4.0, isEnemy: true, owner: e, damage: e.dmg }); }
                e.state = 'idle'; e.stateTimer = 2.0; e.firedAt = fxTime; // enemysprites.js recoil
            }
        } else if (e.state === 'bounce_telegraph') {
            // Arc through the air to the marked spot (it used to blink there); airborne, so it sails over rocks
            if (e.leapFromX === undefined) { e.leapFromX = e.x; e.leapFromY = e.y; effects.push({ type: 'slam_warn', x: e.dashTargetX, y: e.dashTargetY, radius: 100, color: e.color, life: 0.6, maxLife: 0.6 }); }
            e.leapK = Math.min(1, 1 - e.stateTimer / 0.6); e.airborne = true;
            e.x = e.leapFromX + (e.dashTargetX - e.leapFromX) * e.leapK; e.y = e.leapFromY + (e.dashTargetY - e.leapFromY) * e.leapK;
            if (e.stateTimer <= 0) {
                e.x = e.dashTargetX; e.y = e.dashTargetY; e.leapFromX = undefined; e.leapK = undefined; e.airborne = false;
                slimeKingLand(e); // enemysprites.js
                if (Math.hypot(e.x - player.x, e.y - player.y) <= 100 + player.radius) takeDamage(e.dmg * 2);
                e.state = 'idle'; e.stateTimer = 2.0;
            }
        }
    },
    'boss_slime_queen': (e, dt, curSpd, edx, edy, edist, i) => {
        if (e.state === 'death_throes') { // her last stand: a bullet hell that keeps getting worse until she comes apart
            const D = 14, k = Math.min(1, (e.throesT = (e.throesT || 0) + dt) / D);
            e.size = Math.max(30, e.originalSize * (1 - k * 0.55));
            e.bulletAngle = (e.bulletAngle || 0) + dt * (1.1 + 1.5 * k);
            // past ~420px the bolts speed up (main.js rampFrom), so keeping your distance doesn't make you safe
            const fire = (a, spd, r = 8) => projectiles.push({ x: e.x, y: e.y, ox: e.x, oy: e.y, rampFrom: 420, rampTo: 640, vx: Math.cos(a) * spd, vy: Math.sin(a) * spd, radius: r, color: '#f06292', life: 6.0, isEnemy: true, owner: e, damage: e.dmg * 0.5 });
            if ((e.volleyT = (e.volleyT || 0) - dt) <= 0) {
                e.volleyT = 0.17 - 0.05 * k; // volleys come faster...
                const arms = 3 + Math.floor(k * 2.99), spd = 220 + 120 * k; // ...with more arms, flying faster
                for (let j = 0; j < arms; j++) fire(e.bulletAngle + Math.PI * 2 / arms * j, spd);
                if (k > 0.3 && (e.counter = !e.counter)) for (let j = 0; j < arms - 1; j++) fire(-e.bulletAngle * 1.3 + 0.4 + Math.PI * 2 / (arms - 1) * j, spd * 0.85); // a second spiral turning the other way
            }
            if (k > 0.6 && (e.ringT = (e.ringT === undefined ? 1.2 : e.ringT) - dt) <= 0) { // and in the end, rings pulsing out of her
                e.ringT = 1.9 - 0.7 * k; addShake(2);
                const off = Math.random() * Math.PI; for (let r = 0; r < 20; r++) fire(off + Math.PI * 2 / 20 * r, 170, 10);
            }
            if (k >= 1) { e.invulnerable = false; e.hp = 0; checkEnemyDeath(e); }
            return;
        }
        let hpPercent = e.hp / e.maxHp; e.stateTimer -= dt;
        if (hpPercent > 0.6) {
            if (edist > 150) { e.x += (edx/edist)*curSpd*dt; e.y += (edy/edist)*curSpd*dt; }
            if (e.stateTimer <= 0) {
                if (Math.random() < 0.5) { // she lobs two eggs; they hatch where they land
                    for(let k=0; k<2; k++) {
                        const a = Math.random() * Math.PI * 2, sp = randomOpenSpot(0, { x: e.x + Math.cos(a) * 230, y: e.y + Math.sin(a) * 230, r: 60 }), mx = sp ? sp[0] : e.x + Math.cos(a) * 120, my = sp ? sp[1] : e.y + Math.sin(a) * 120;
                        enemies.push({ x: mx, y: my, size: 28, color: '#8bc34a', speed: 115, hp: 40, maxHp: 40, type: 'slime_melee', dmg: 10, xp: 0, meleeTimer: 0, frozenTimer: 0, facingAngle: 0, spawnT: 0.95, spawnMax: 0.95, flyUntil: fxTime + 0.6 }); activeEnemies++;
                        effects.push({ type: 'goo_arc', x0: e.x, y0: e.y, x: mx, y: my, color: '#f8bbd0', size: 11, life: 0.6, maxLife: 0.6 });
                    }
                } 
                else { const [sx, sy] = getVector(e.x, e.y, player.x, player.y); for(let k=-1; k<=1; k++) { let angle = Math.atan2(sy, sx) + k*0.3; projectiles.push({ x: e.x, y: e.y, vx: Math.cos(angle)*400, vy: Math.sin(angle)*400, radius: 12, color: '#f06292', life: 3.0, isEnemy: true, owner: e, damage: e.dmg, type: 'boss_slimeball' }); } e.firedAt = fxTime; }
                e.stateTimer = 2.5;
            }
        } else if (hpPercent > 0.3) {
            if (!e.guardsSpawned) {
                e.guardsSpawned = true; e.guards = [];
                for(let k=0; k<4; k++) { let guard = { x: e.x, y: e.y, size: 30, color: '#9575cd', speed: 100, spawnT: 0.4, spawnMax: 0.4, frozenTimer: 0, facingAngle: 0, hp: 200 + (wave*10), maxHp: 200 + (wave*10), type: 'queen_guard', dmg: 15, xp: 0, meleeTimer: 0, angleOffset: (Math.PI/2)*k }; enemies.push(guard); activeEnemies++; e.guards.push(guard); }
            }
            let guardsAlive = 0;
            for(let g of e.guards) {
                if (!g.dead && enemies.includes(g)) { guardsAlive++; g.angleOffset += dt * 1.5; g.x = e.x + Math.cos(g.angleOffset)*150; g.y = e.y + Math.sin(g.angleOffset)*150; if (distToSegment(player.x, player.y, e.x, e.y, g.x, g.y) < player.radius + 5) takeDamage(15*dt, true); }
            }
            e.invulnerable = guardsAlive > 0;
            if (e.stateTimer <= 0) { // a strike on where you stand: a clear warning, then time to recover before the next
                effects.push({ type: 'slam_warn', x: player.x, y: player.y, radius: 70, color: '#b388ff', life: 0.85, maxLife: 0.85 }); let tx = player.x, ty = player.y;
                effects.push({ type: 'bolt_charge', x: tx, y: ty, radius: 70, life: 0.85, maxLife: 0.85 }); // enemysprites.js: arcs crackling inside the ring
                after(0.85, () => {
                    effects.push({ type: 'slime_shock', x: tx, y: ty, radius: 110, color: '#b388ff', life: 0.45, maxLife: 0.45 });
                    effects.push({ type: 'queen_bolt', x: tx, y: ty, seed: Math.random() * 100, life: 0.45, maxLife: 0.45 }, { type: 'bolt_scorch', x: tx, y: ty, seed: Math.random() * 10, life: 3.5, maxLife: 3.5 });
                    burst(tx, ty, 0, Math.PI * 2, 18, { kind: 'spark', color: '#e1ccff', size: 3, speed: [180, 460], life: 0.35, drag: 5 }); addShake(5);
                    if (Math.hypot(tx-player.x, ty-player.y) <= 70 + player.radius) { takeDamage(e.dmg * 1.2); buffs.slowed = Math.max(buffs.slowed, 0.35); e.stateTimer = Math.max(e.stateTimer, 2.5); } });
                e.stateTimer = 2.3;
            }
        } else {
            // Last phase: she crawls after you and every few seconds leaps to land close by, splashing a ring of bolts
            e.invulnerable = false;
            if (e.state === 'leap') {
                e.leapK = Math.min(1, e.leapK + dt / 0.9); e.airborne = true;
                e.x = lerp(e.leapFromX, e.leapToX, e.leapK); e.y = lerp(e.leapFromY, e.leapToY, e.leapK);
                if (e.leapK >= 1) {
                    e.state = 'idle'; e.airborne = false; e.leapK = undefined; e.stateTimer = 3.8;
                    effects.push({ type: 'puddle', x: e.x, y: e.y, radius: 150, color: 'rgba(240, 98, 146, 0.5)', pink: true, life: 2.0, maxLife: 2.0 });
                    effects.push({ type: 'slime_shock', x: e.x, y: e.y, radius: 200, color: '#ff4f9a', life: 0.5, maxLife: 0.5 }); addShake(5);
                    burst(e.x, e.y, 0, Math.PI * 2, 16, { kind: 'goo', color: '#f06292', size: 5, speed: [120, 300], life: 0.5, drag: 3 });
                    if (Math.hypot(e.x - player.x, e.y - player.y) <= 110 + player.radius) takeDamage(e.dmg * 1.2);
                    for(let r=0; r<16; r++) { const angle = (Math.PI*2/16) * r; projectiles.push({ x: e.x, y: e.y, vx: Math.cos(angle)*260, vy: Math.sin(angle)*260, radius: 8, color: '#ff4f9a', life: 4.0, isEnemy: true, owner: e, damage: e.dmg }); }
                }
                return;
            }
            if (edist > 140) { e.x += (edx/edist)*curSpd*0.8*dt; e.y += (edy/edist)*curSpd*0.8*dt; }
            if (e.stateTimer <= 0) { // pick a landing spot a short way from you (so melee heroes can reach her) and mark it
                let tx = null, ty = null;
                for (let k = 0; k < 24 && tx === null; k++) { const a = Math.random() * Math.PI * 2, d = 220 + Math.random() * 130, x = player.x + Math.cos(a) * d, y = player.y + Math.sin(a) * d, sp = randomOpenSpot(0, { x, y, r: 1 }, 100); if (sp) [tx, ty] = sp; }
                if (tx === null) { tx = e.x; ty = e.y; }
                e.state = 'leap'; e.leapK = 0; e.leapFromX = e.x; e.leapFromY = e.y; e.leapToX = tx; e.leapToY = ty;
                effects.push({ type: 'slam_warn', x: tx, y: ty, radius: 110, color: '#ff4f9a', life: 0.9, maxLife: 0.9 });
            }
        }
    },
    'boss_amalgam': (e, dt, curSpd, edx, edy, edist, i) => {
        e.stateTimer -= dt;
        if (e.state === 'idle') {
            if (edist > 60) { e.x += (edx/edist)*curSpd*dt; e.y += (edy/edist)*curSpd*dt; }
            if (edist < player.radius + e.size / 2 + 5 && e.meleeTimer <= 0) { takeDamage(e.dmg); e.meleeTimer = 1.0; }
            if (e.stateTimer <= 0 && e.frozenTimer <= 0) { 
                // Stampede, Nova, Assimilate, Stampede, Nova, Undertow: Assimilate only every other round (~25 s)
                e.attackIndex = (e.attackIndex || 0) + 1; const nextAtk = e.attackIndex % 6;
                if (nextAtk === 1 || nextAtk === 4) { e.state = 'stampede'; e.stateTimer = 3.0; e.puddleTimer = 0; effects.push({ type: 'text', text: 'STAMPEDE!', x: e.x, y: e.y - 40, color: '#ff5252', life: 1.0, maxLife: 1.0 }); }
                else if (nextAtk === 2 || nextAtk === 5) { e.state = 'nova'; e.stateTimer = 1.0; effects.push({ type: 'text', text: 'TOXIC NOVA!', x: e.x, y: e.y - 40, color: '#009688', life: 1.0, maxLife: 1.0 });}
                else if (nextAtk === 3) { e.state = 'summon'; e.stateTimer = 1.0; effects.push({ type: 'text', text: 'ASSIMILATE!', x: e.x, y: e.y - 40, color: '#4db6ac', life: 1.0, maxLife: 1.0 });}
                else { e.state = 'undertow_sink'; e.stateTimer = 0.6; effects.push({ type: 'text', text: 'UNDERTOW!', x: e.x, y: e.y - 40, color: '#26a69a', life: 1.0, maxLife: 1.0 }); }
            }
        } else if (e.state === 'stampede') {
            let chaseSpd = curSpd * 2.2;
            if (edist > 0) { e.x += (edx/edist)*chaseSpd*dt; e.y += (edy/edist)*chaseSpd*dt; }
            if (edist < player.radius + e.size / 2 + 5 && e.meleeTimer <= 0) { takeDamage(e.dmg * 1.5); e.meleeTimer = 1.0; }
            e.puddleTimer -= dt; if (e.puddleTimer <= 0) { effects.push({ type: 'puddle', x: e.x, y: e.y, radius: 30, color: '#009688', life: 2.0, maxLife: 2.0 }); e.puddleTimer = 0.3; }
            if (e.stateTimer <= 0) { e.state = 'idle'; e.stateTimer = 1.5; }
        } else if (e.state === 'nova') {
            if (e.stateTimer <= 0) {
                for (let r=0; r<12; r++) { const angle = (Math.PI*2/12) * r; projectiles.push({ x: e.x, y: e.y, vx: Math.cos(angle)*400, vy: Math.sin(angle)*400, radius: 10, color: '#009688', life: 2.5, isEnemy: true, owner: e, damage: e.dmg, type: 'boss_slimeball' }); }
                e.firedAt = fxTime; effects.push({ type: 'slime_shock', x: e.x, y: e.y, radius: 120, color: '#1de9b6', life: 0.4, maxLife: 0.4 }); addShake(3);
                e.state = 'idle'; e.stateTimer = 2.0;
            }
        } else if (e.state === 'summon') {
            if (e.stateTimer <= 0) {
                // Fling the pieces far out onto open ground; they land dazed and crawl back slowly, so there's time to kill them
                for(let k=0; k<3; k++) {
                    const base = (Math.PI*2/3) * k + Math.random(); let mx = e.x, my = e.y, found = false;
                    for (const d of [460, 380, 300, 220, 150]) { // turn a little either way before settling for a shorter throw
                        for (const da of [0, 0.4, -0.4, 0.8, -0.8, 1.2, -1.2]) {
                            const a = base + da, tx = Math.max(currentMap.left + 24, Math.min(currentMap.right - 24, e.x + Math.cos(a) * d)), ty = Math.max(currentMap.top + 24, Math.min(currentMap.bottom - 24, e.y + Math.sin(a) * d));
                            if (shotClear(e.x, e.y, tx, ty) && !solidCell(terrainAt(tx, ty), false)) { mx = tx; my = ty; found = true; break; } // never into rock or a ravine
                        }
                        if (found) break;
                    }
                    enemies.push({ x: mx, y: my, size: 24, color: '#4db6ac', speed: e.speed * 0.75, hp: 60, maxHp: 60, type: 'amalgam_minion', dmg: e.dmg, xp: 0, frozenTimer: 0, facingAngle: 0, meleeTimer: 0, spawnT: 0.95, spawnMax: 0.95, flyUntil: fxTime + 0.6, dazed: 2.0 });
                    effects.push({ type: 'goo_arc', x0: e.x, y0: e.y, x: mx, y: my, color: '#4db6ac', size: 11, life: 0.6, maxLife: 0.6 }); // enemysprites.js
                    activeEnemies++;
                }
                e.state = 'idle'; e.stateTimer = 4.0;
            }
        } else if (e.state === 'undertow_sink') { // Undertow: it melts into the floor (still hittable while it sinks)
            if (e.stateTimer <= 0) {
                e.submerged = true; e.invulnerable = true; e.state = 'undertow'; e.stateTimer = 1.8;
                effects.push({ type: 'puddle', x: e.x, y: e.y, radius: 70, color: '#009688', life: 2.0, maxLife: 2.0 });
            }
        } else if (e.state === 'undertow') { // a ripple racing under the floor toward you; it can't be hit down there
            if (edist > 0) { e.x += (edx/edist)*curSpd*2.6*dt; e.y += (edy/edist)*curSpd*2.6*dt; }
            if (edist < 60 || e.stateTimer <= 0) { // it settles under where you stand: 0.5 s to get out of the ring
                e.state = 'undertow_aim'; e.stateTimer = UNDERTOW_WARN; e.utX = player.x; e.utY = player.y;
                effects.push({ type: 'slam_warn', x: e.utX, y: e.utY, radius: 130, color: '#1de9b6', life: UNDERTOW_WARN, maxLife: UNDERTOW_WARN });
            }
        } else if (e.state === 'undertow_aim') {
            const k = Math.min(1, dt * 8); e.x += (e.utX - e.x) * k; e.y += (e.utY - e.y) * k;
            if (e.stateTimer <= 0) { // it erupts: a heavy hit in the ring and a slow ring of goo
                e.x = e.utX; e.y = e.utY; e.submerged = false; e.invulnerable = false;
                e.state = 'undertow_erupt'; e.stateTimer = 0.4; e.eruptAt = fxTime;
                effects.push({ type: 'slime_shock', x: e.x, y: e.y, radius: 170, color: '#1de9b6', life: 0.5, maxLife: 0.5 }); addShake(5);
                effects.push({ type: 'puddle', x: e.x, y: e.y, radius: 140, color: '#009688', life: 2.5, maxLife: 2.5 });
                burst(e.x, e.y, 0, Math.PI * 2, 22, { kind: 'goo', color: '#26a69a', size: 5, speed: [160, 420], life: 0.6, drag: 3 });
                if (Math.hypot(e.x - player.x, e.y - player.y) <= 130 + player.radius) takeDamage(e.dmg * 2);
                for (let r = 0; r < 10; r++) { const a = (Math.PI * 2 / 10) * r + 0.3; projectiles.push({ x: e.x, y: e.y, vx: Math.cos(a) * 260, vy: Math.sin(a) * 260, radius: 9, color: '#009688', life: 2.5, isEnemy: true, owner: e, damage: e.dmg, type: 'boss_slimeball' }); }
            }
        } else if (e.state === 'undertow_erupt') {
            if (e.stateTimer <= 0) { e.state = 'idle'; e.stateTimer = 2.0; }
        } else if (e.state === 'devastate') {
            if (e.stateTimer <= 0) {
                effects.push({ type: 'slime_shock', x: e.x, y: e.y, radius: 300, color: '#1de9b6', life: 0.6, maxLife: 0.6 }); addShake(7);
                burst(e.x, e.y, 0, Math.PI * 2, 26, { kind: 'goo', color: '#26a69a', size: 6, speed: [200, 480], life: 0.6, drag: 3 });
                if (edist <= 300 + player.radius) takeDamage(e.dmg * 3);
                e.state = 'idle'; e.stateTimer = 2.0;
            }
        }
    },
    // The Beastmaster: bolas, a pack of hounds (they die with him), three jousts down lanes drawn on the ground (bandits.js
    // lance_lane), and a Kennel Call (a horn, a pack out of the reeds) at half health and again at a quarter.
    'boss_beastmaster': BeastmasterAI,
    'boss_valerius': (e, dt, curSpd, edx, edy, edist, i) => {
        let hpPercent = e.hp / e.maxHp;

        if (e.state === 'jump_in') {
            e.stateTimer -= dt;
            e.y += ((e.targetY - e.y) * 10 * dt);
            if (e.stateTimer <= 0) {
                e.y = e.targetY; e.state = 'idle'; e.stateTimer = 2.0;
                effects.push({ type: 'circle', x: e.x, y: e.y, radius: 100, color: '#4e342e', life: 0.5, maxLife: 0.5 });
            }
            return;
        }

        if (e.isStaggered) {
            e.renderColor = '#ffeb3b'; e.staggerTimer -= dt;
            if (e.staggerTimer <= 0) {
                e.isStaggered = false; e.shieldHp = 0;
            }
            return;
        }
        e.renderColor = e.color;

        let phase = 1;
        if (hpPercent <= 0.65 && hpPercent > 0.3) phase = 2;
        if (hpPercent <= 0.3) phase = 3;

        e.stateTimer -= dt;

        if (!e.state || e.state === 'idle') {
            if (phase === 1) {
                if (edist > 100) { e.x += (edx/edist)*curSpd*dt; e.y += (edy/edist)*curSpd*dt; }
                if (e.stateTimer <= 0) {
                    e.state = (edist > 200) ? 'lunge' : (Math.random() < 0.4 ? 'sunder' : 'lunge');
                    e.stateTimer = e.state === 'lunge' ? 0.6 : 1.5;
                    if (e.state === 'lunge') {
                        let px = player.x; let py = player.y;
                        if (player.isMoving) {
                            px += (keys.d ? 1 : (keys.a ? -1 : 0)) * player.speed * 0.4;
                            py += (keys.s ? 1 : (keys.w ? -1 : 0)) * player.speed * 0.4;
                        }
                        let [pdx, pdy, pdist] = getVector(e.x, e.y, px, py);
                        e.dashVx = (pdx/pdist) * curSpd * 14.0;
                        e.dashVy = (pdy/pdist) * curSpd * 14.0;
                    }
                }
            } else if (phase === 2) {
                let cx = (currentMap.left + currentMap.right)/2;
                let cy = (currentMap.top + currentMap.bottom)/2;
                let [cdx, cdy, cdist] = getVector(e.x, e.y, cx, cy);
                if (cdist > 10) { e.x += (cdx/cdist)*curSpd*3*dt; e.y += (cdy/cdist)*curSpd*3*dt; }

                if (!e.archersSpawned) {
                    e.archersSpawned = true; e.shieldHp = 2000; e.facingAngle = Math.PI; 
                    enemies.push({ x: currentMap.left + 50, y: cy - 100, size: 24, color: '#8d6e63', speed: 0, hp: 300, maxHp: 300, type: 'valerius_archer', dmg: e.dmg*0.6, xp: 0, attackTimer: 0.5, ammo: 999, isValeriusMinion: true, frozenTimer: 0 });
                    enemies.push({ x: currentMap.right - 50, y: cy + 100, size: 24, color: '#8d6e63', speed: 0, hp: 300, maxHp: 300, type: 'valerius_archer', dmg: e.dmg*0.6, xp: 0, attackTimer: 0.5, ammo: 999, isValeriusMinion: true, frozenTimer: 0 });
                    activeEnemies += 2;
                }

                if (e.shieldHp <= 0 && !e.phase2Broken) {
                    e.phase2Broken = true; e.isStaggered = true; e.staggerTimer = 3.0; e.state = 'idle'; e.stateTimer = 3.0;
                    for(let j=enemies.length-1; j>=0; j--) {
                        if (enemies[j].isValeriusMinion) { enemies[j].hp = 0; checkEnemyDeath(enemies[j]); }
                    }
                    return;
                }

                if (e.stateTimer <= 0 && !e.isStaggered) {
                    e.state = 'javelin_volley'; e.stateTimer = 2.0; e.volleyAngle = e.facingAngle - 1.0;
                }
            } else if (phase === 3) {
                if (edist > 150) { e.x += (edx/edist)*curSpd*1.5*dt; e.y += (edy/edist)*curSpd*1.5*dt; }
                if (e.stateTimer <= 0) { 
                    let moves = ['chain_hook', 'frenzy_lunge', 'slam'];
                    e.state = moves[Math.floor(Math.random() * moves.length)];
                    if (e.state === 'chain_hook') { e.stateTimer = 1.0; e.hookFired = false; }
                    else if (e.state === 'frenzy_lunge') { 
                        e.stateTimer = 0.8; 
                        e.dashVx = (edx/edist) * curSpd * 8.0; 
                        e.dashVy = (edy/edist) * curSpd * 8.0; 
                    }
                    else if (e.state === 'slam') { e.stateTimer = 1.0; }
                }
            }
        } 
        else if (e.state === 'lunge') {
            if (e.stateTimer > 0.2) {
                effects.push({ type: 'line', x1: e.x, y1: e.y, x2: e.x + e.dashVx*0.4, y2: e.y + e.dashVy*0.4, color: 'rgba(255,0,0,0.5)', life: 0.1, maxLife: 0.1, lineWidth: 24 });
            } else { 
                e.x += e.dashVx * dt; e.y += e.dashVy * dt; 
                if (Math.hypot(player.x - e.x, player.y - e.y) < e.size/2 + player.radius + 15) { takeDamage(e.dmg * 2); e.state = 'idle'; e.stateTimer = 1.5; } 
            }
            if (e.stateTimer <= 0) { e.state = 'idle'; e.stateTimer = 0.8; }
        }
        else if (e.state === 'sunder') {
            if (e.stateTimer > 0.5) { effects.push({ type: 'circle', x: e.x, y: e.y, radius: 100, color: 'rgba(93, 64, 55, 0.3)', life: 0.1, maxLife: 0.1 }); }
            else {
                effects.push({ type: 'puddle', x: e.x, y: e.y, radius: 100, color: '#5d4037', life: 4.0, maxLife: 4.0, dmg: e.dmg });
                e.state = 'idle'; e.stateTimer = 1.5;
            }
        }
        else if (e.state === 'javelin_volley') {
            e.volleyAngle += dt * 1.5; 
            if (e.stateTimer > 0 && e.stateTimer % 0.2 < 0.05) {
                // ADDED shape: 'spear' to the end of this projectile push
                projectiles.push({ x: e.x, y: e.y, vx: Math.cos(e.volleyAngle)*600, vy: Math.sin(e.volleyAngle)*600, radius: 8, color: '#ff9800', life: 3.0, isEnemy: true, owner: e, damage: e.dmg, shape: 'spear' });
            }
            if (e.stateTimer <= 0) { e.state = 'idle'; e.stateTimer = 2.0; e.facingAngle = Math.atan2(player.y - e.y, player.x - e.x); }
        }
        else if (e.state === 'chain_hook') {
            if (e.stateTimer > 0.5) {
                effects.push({ type: 'line', x1: e.x, y1: e.y, x2: player.x, y2: player.y, color: 'rgba(117, 117, 117, 0.5)', life: 0.1, maxLife: 0.1 });
                e.hookTargetX = player.x; e.hookTargetY = player.y;
            } else if (!e.hookFired) {
                e.hookFired = true;
                const [hx, hy, hdist] = getVector(e.x, e.y, e.hookTargetX, e.hookTargetY);
                projectiles.push({ x: e.x, y: e.y, vx: (hx/hdist)*1200, vy: (hy/hdist)*1200, radius: 15, color: '#757575', life: 2.0, isEnemy: true, owner: e, damage: e.dmg, type: 'chain_hook', sourceBoss: e });
            }
            if (e.stateTimer <= 0 && e.hookFired) { e.stateTimer = 0.1; } 
        }
        else if (e.state === 'hook_pull') {
            const [px, py, pdist] = getVector(e.x, e.y, e.pullTargetX, e.pullTargetY);
            if (pdist > 50) { e.x += (px/pdist)*2500*dt; e.y += (py/pdist)*2500*dt; }
            else {
                e.x = e.pullTargetX; e.y = e.pullTargetY;
                effects.push({ type: 'circle', x: e.x, y: e.y, radius: 200, color: '#5d4037', life: 0.3, maxLife: 0.3 });
                if (Math.hypot(player.x - e.x, player.y - e.y) <= 200 + player.radius) { takeDamage(e.dmg * 2); buffs.rooted = 1.0; }
                e.state = 'idle'; e.stateTimer = 2.0;
            }
        }
        else if (e.state === 'frenzy_lunge') {
            if (e.stateTimer > 0.4) {
                effects.push({ type: 'line', x1: e.x, y1: e.y, x2: e.x + e.dashVx*0.3, y2: e.y + e.dashVy*0.3, color: 'rgba(255,87,34,0.6)', life: 0.1, maxLife: 0.1, lineWidth: 10 });
            } else { 
                e.x += e.dashVx * dt; e.y += e.dashVy * dt; 
                if (Math.hypot(player.x - e.x, player.y - e.y) < e.size/2 + player.radius) { takeDamage(e.dmg * 2.5); e.state = 'idle'; e.stateTimer = 1.0; } 
            }
            if (e.stateTimer <= 0) { e.state = 'idle'; e.stateTimer = 0.5; }
        }
        else if (e.state === 'slam') {
            if (e.stateTimer > 0.4) { effects.push({ type: 'circle', x: e.x, y: e.y, radius: 140, color: 'rgba(78, 52, 46, 0.3)', life: 0.1, maxLife: 0.1 }); }
            else {
                effects.push({ type: 'circle', x: e.x, y: e.y, radius: 140, color: '#4e342e', life: 0.3, maxLife: 0.3 });
                if (edist <= 140 + player.radius) takeDamage(e.dmg * 3);
                e.state = 'idle'; e.stateTimer = 1.5;
            }
        }
    },
    'amalgam_minion': (e, dt, curSpd, edx, edy, edist, i) => { 
        if (e.dazed > 0) { e.dazed -= dt; return; } // still seeing stars after the landing
        const boss = enemies.find(en => !en.dead && en.type === 'boss_amalgam');
        if (boss) {
            const [bx, by, bdist] = getVector(e.x, e.y, boss.x, boss.y);
            if (bdist > boss.size/2) { e.x += (bx/bdist)*curSpd*dt; e.y += (by/bdist)*curSpd*dt; }
            else if (String(boss.state).startsWith('undertow')) {} // it can't take them in while it's under the floor
            else { boss.state = 'devastate'; boss.stateTimer = 1.0; effects.push({ type: 'slam_warn', x: boss.x, y: boss.y, radius: 300, color: '#1de9b6', follow: boss, life: 1.0, maxLife: 1.0 }); burst(e.x, e.y, 0, Math.PI * 2, 10, { kind: 'goo', color: e.color, size: 4, speed: [60, 160], life: 0.5, drag: 3 }); boss.hp = Math.min(boss.maxHp, boss.hp + boss.maxHp * 0.05); effects.push({ type: 'text', text: 'ABSORBED!', x: boss.x, y: boss.y - 40, color: '#ff5252', life: 1.0, maxLife: 1.0 }); e.dead = true; activeEnemies--; } // absorbed: removed without XP or loot
        } else {
            if (edist > 0) { e.x += (edx/edist)*curSpd*dt; e.y += (edy/edist)*curSpd*dt; }
            if (edist < player.radius + e.size / 2 + 5 && e.meleeTimer <= 0) { takeDamage(e.dmg); e.meleeTimer = 1.0; }
        }
    }
};