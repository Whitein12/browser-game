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
            effects.push({ type: 'lance_lane', e, w: e.size + 12, lockAt: RIDER_AIM - RIDER_LOCK_TIME, life: RIDER_AIM, maxLife: RIDER_AIM }); // bandits.js draws the lane, as wide as the hit (size / 2 + 6 past your edge): clear of it is safe
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
    if (e.state === 'rest') { e.facingAngle = e.restFace; return; } // lying at his feet at the bridgehead (map_trail.js) until he rises
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

// ---------- the Bastion's garrison (stage 4, map_castle.js) ----------
// Every wind-up is a gar_tell effect drawn from the bandit's own state (bandits.js drawBanditGround): a lane or a wedge
// along e.aimA, dashed while it follows the hero, solid for its last `lock` seconds, exactly as wide as the hit.
const CROSS_AIM = 1.0, CROSS_LOCK = 0.35, CROSS_RELOAD = 3.2, CROSS_SPEED = 1100, CROSS_RANGE = 900, CROSS_DMG = 1.6, CROSS_W = 14, CROSS_NEAR = 300, CROSS_FAR = 520; // the crossbowman: kneel and aim, lock, one armour-piercing bolt, a long crank to reload
const HAL_HOLD = 115, HAL_LOCK = 0.2, HAL_GAP = 1.1, HAL_REC = 0.7; // the halberdier keeps HAL_HOLD px off the hero (pole's length)
const HAL_SWEEP_T = 0.75, HAL_SWEEP_R = 105, HAL_SWEEP_HALF = 1.05, HAL_SWEEP_DMG = 1.6; // the sweep: wind-up, reach past its body, half-angle, hit
const HAL_THRUST_T = 0.6, HAL_THRUST_L = 150, HAL_THRUST_W = 26, HAL_THRUST_DMG = 2.0;   // the thrust down a lane
const GREN_CD = 4.2, GREN_WINDUP = 0.7, GREN_SPEED = 380, GREN_FIRE_R = 60, GREN_FIRE_LIFE = 4, GREN_NEAR = 240, GREN_FAR = 400; // the firepot grenadier
const CUT_WINDUP = 0.4, CUT_LOCK = 0.15, CUT_DASH = 240, CUT_DASH_SPEED = 820, CUT_REACH = 4, CUT_FLEE = 1.25, CUT_SLIP = 0.45, CUT_FLEE_MAX = 9; // the cutpurse: its dash, how much faster it flees, slipping out, the longest it runs before melting into the dark
const CUT_STEAL = w => 10 + Math.round(w * 1.5), CUT_WAVE_CAP = 0.25, CUT_REFUND = 1.5; // gold per theft; never more than a quarter of the gold held at the wave's start; killed, it drops x1.5

function garPrep(e, state, len, tell) {
    e.state = state; e.stateTimer = e.prepLen = len; e.aimA = Math.atan2(player.y - e.y, player.x - e.x);
    if (tell) effects.push({ type: 'gar_tell', e, state, ...tell, life: len + 0.05, maxLife: len + 0.05 });
}
function garCheck(e) { // stunned (its AI didn't run) or frozen in a wind-up: the attack is lost, so nothing lands after its telegraph ran out
    const gap = e.aiAt !== undefined && fxTime - e.aiAt > 0.15; e.aiAt = fxTime;
    if (e.prepLen && (gap || e.frozenTimer > 0)) { e.state = null; e.prepLen = 0; e.stateTimer = 0.6; }
}
function garAim(e, lock) { if (e.stateTimer > lock) e.aimA = Math.atan2(player.y - e.y, player.x - e.x); e.facingAngle = e.aimA; }
function garKeep(e, dt, curSpd, edx, edy, edist, near, far, k = 1) { // stays near..far off the hero (the flow field's way round walls)
    if (curSpd <= 0 || !(edist > 0) || edist === Infinity) return;
    const rd = Math.hypot(player.x - e.x, player.y - e.y), s = curSpd * k * dt;
    if (rd > far) { e.x += edx / edist * s; e.y += edy / edist * s; } else if (rd < near) { e.x -= edx / edist * s; e.y -= edy / edist * s; }
}
function garShove(e, d) { // knocked back, away from it
    if (!player.dash && !player.grappleTarget) { const [x, y, l] = getVector(e.x, e.y, player.x, player.y); player.x += x / (l || 1) * d; player.y += y / (l || 1) * d; clampToBounds(player, player.radius); }
    burst(player.x, player.y, Math.atan2(player.y - e.y, player.x - e.x), 1.4, 8, { kind: 'spark', color: '#ffe0b2', size: 2.4, speed: [120, 300], life: 0.25, drag: 5 });
}

// The crossbowman keeps 300-520 px off, kneels, and lays a long lane on the hero that locks before the bolt flies.
// The bolt is heavy and armour-piercing (combat.js takeDamage); then it cranks the string back for CROSS_RELOAD s, walking slower.
var CrossbowAI = (e, dt, curSpd, edx, edy, edist, i) => {
    e.stateTimer = (e.stateTimer === undefined ? 0.8 + Math.random() : e.stateTimer) - dt;
    garCheck(e);
    e.kneelK = (e.kneelK || 0) + ((e.state === 'aim' ? 1 : 0) - (e.kneelK || 0)) * Math.min(1, 12 * dt);
    if (e.state === 'aim') {
        garAim(e, CROSS_LOCK);
        if (e.stateTimer <= 0) {
            const ux = Math.cos(e.aimA), uy = Math.sin(e.aimA), o = e.size / 2 + 4;
            projectiles.push({ x: e.x + ux * o, y: e.y + uy * o, vx: ux * CROSS_SPEED, vy: uy * CROSS_SPEED, radius: CROSS_W / 2, life: (CROSS_RANGE - o) / CROSS_SPEED, isEnemy: true, owner: e, damage: e.dmg * CROSS_DMG, shape: 'bolt', pierceArmor: true });
            e.state = null; e.prepLen = 0; e.stateTimer = CROSS_RELOAD; e.shotAt = fxTime; addShake(1);
            burst(e.x + ux * o, e.y + uy * o, e.aimA, 0.5, 4, { kind: 'spark', color: '#ffe0b2', size: 1.8, speed: [120, 260], life: 0.2, drag: 5 });
        }
        return;
    }
    const reloading = e.shotAt !== undefined && fxTime - e.shotAt < CROSS_RELOAD;
    garKeep(e, dt, curSpd, edx, edy, edist, CROSS_NEAR, CROSS_FAR, reloading ? 0.6 : 1);
    const rd = Math.hypot(player.x - e.x, player.y - e.y);
    if (e.stateTimer <= 0 && curSpd > 0 && e.frozenTimer <= 0 && rd < CROSS_FAR + 150 && shotClear(e.x, e.y, player.x, player.y))
        garPrep(e, 'aim', CROSS_AIM, { kind: 'lane', len: CROSS_RANGE, w: CROSS_W, lock: CROSS_LOCK, air: true });
};

// Is the hero's body in a lane from e along a, len long and w wide?
function garInLane(e, a, len, w) {
    const dx = player.x - e.x, dy = player.y - e.y, along = dx * Math.cos(a) + dy * Math.sin(a), perp = Math.abs(-dx * Math.sin(a) + dy * Math.cos(a));
    return along > 0 && along < len + player.radius && perp < w / 2 + player.radius;
}

// The halberdier: armoured and slow, it closes to pole's length and holds there, alternating a wide sweep (a wedge)
// and a thrust (a lane; the only one that reaches past the sweep). Winded for HAL_REC s after each.
var HalberdAI = (e, dt, curSpd, edx, edy, edist, i) => {
    const rd = Math.hypot(player.x - e.x, player.y - e.y), sweepR = e.size / 2 + HAL_SWEEP_R, thrustL = e.size / 2 + HAL_THRUST_L;
    e.stateTimer = (e.stateTimer === undefined ? 0.6 + Math.random() * 0.6 : e.stateTimer) - dt;
    garCheck(e);
    if (e.state === 'sweep_prep' || e.state === 'thrust_prep') {
        garAim(e, HAL_LOCK);
        if (e.stateTimer > 0) return;
        const a = e.aimA, R = player.radius, air = player.z > 4;
        e.prepLen = 0; e.swingAt = fxTime; e.lastMove = e.state === 'sweep_prep' ? 'sweep' : 'thrust';
        if (e.lastMove === 'sweep') { // the blade swings across the wedge
            e.state = 'sweep'; e.stateTimer = 0.2; addShake(2);
            effects.push({ type: 'val_slash', e, a, R: sweepR, half: HAL_SWEEP_HALF, life: 0.24, maxLife: 0.24 }); // bandits.js: the crescent
            let off = Math.atan2(player.y - e.y, player.x - e.x) - a; while (off > Math.PI) off -= Math.PI * 2; while (off < -Math.PI) off += Math.PI * 2;
            if (!air && rd < sweepR + R && Math.abs(off) < HAL_SWEEP_HALF + R / Math.max(rd, 20)) { takeDamage(e.dmg * HAL_SWEEP_DMG); garShove(e, 60); }
        } else { // the spike drives down the lane
            e.state = 'thrust'; e.stateTimer = 0.16; addShake(1.5);
            if (!air && garInLane(e, a, thrustL, HAL_THRUST_W)) { takeDamage(e.dmg * HAL_THRUST_DMG); garShove(e, 40); }
        }
        return;
    }
    if (e.state === 'sweep' || e.state === 'thrust') {
        e.facingAngle = e.aimA;
        if (e.state === 'thrust' && curSpd > 0) { e.x += Math.cos(e.aimA) * 250 * dt; e.y += Math.sin(e.aimA) * 250 * dt; } // a step into it
        if (e.stateTimer <= 0) { e.state = 'recover'; e.stateTimer = HAL_REC; }
        return;
    }
    if (e.state === 'recover') { e.facingAngle = e.aimA; if (e.stateTimer <= 0) { e.state = null; e.stateTimer = HAL_GAP * (0.8 + Math.random() * 0.4); } return; } // open to a counter
    if (curSpd > 0 && edist > 0 && edist !== Infinity) {
        if (rd > HAL_HOLD) { e.x += edx / edist * curSpd * dt; e.y += edy / edist * curSpd * dt; }
        else if (rd < HAL_HOLD - 50) { e.x -= edx / edist * curSpd * 0.6 * dt; e.y -= edy / edist * curSpd * 0.6 * dt; } // too close for the pole: a step back
    }
    if (e.stateTimer <= 0 && curSpd > 0 && e.frozenTimer <= 0 && rd < HAL_HOLD + 60 && (!currentMap.grid || walkClear(e.x, e.y, player.x, player.y))) {
        if (rd < sweepR && (e.lastMove !== 'sweep' || Math.random() < 0.35)) garPrep(e, 'sweep_prep', HAL_SWEEP_T, { kind: 'wedge', R: sweepR, half: HAL_SWEEP_HALF, lock: HAL_LOCK });
        else garPrep(e, 'thrust_prep', HAL_THRUST_T, { kind: 'lane', len: thrustL, w: HAL_THRUST_W, lock: HAL_LOCK });
    }
};

// The firepot grenadier keeps 240-400 px off; it lights a clay pot (GREN_WINDUP) and lobs it at where the hero stands.
// The marker is the fire's size; it bursts into ground fire there (bandits.js firepotLand), which burns bandits too.
var GrenadierAI = (e, dt, curSpd, edx, edy, edist, i) => {
    e.stateTimer = (e.stateTimer === undefined ? 1 + Math.random() : e.stateTimer) - dt;
    garCheck(e);
    if (e.state === 'windup') {
        e.facingAngle = Math.atan2(player.y - e.y, player.x - e.x);
        if (e.stateTimer <= 0) { grenadierThrow(e); e.state = null; e.prepLen = 0; e.stateTimer = GREN_CD; e.thrownAt = fxTime; }
        return;
    }
    garKeep(e, dt, curSpd, edx, edy, edist, GREN_NEAR, GREN_FAR);
    const rd = Math.hypot(player.x - e.x, player.y - e.y);
    if (e.stateTimer <= 0 && curSpd > 0 && e.frozenTimer <= 0 && rd < GREN_FAR + 100 && shotClear(e.x, e.y, player.x, player.y)) garPrep(e, 'windup', GREN_WINDUP, null);
};
function grenadierThrow(e) {
    let tx = player.x, ty = player.y;
    if (currentMap.grid) { const cl = clipToWalls(e.x, e.y, tx, ty, 10, true); if (cl) [tx, ty] = cl; }
    const d = Math.hypot(tx - e.x, ty - e.y), flight = Math.max(0.35, d / GREN_SPEED);
    projectiles.push({ type: 'firepot', x: e.x, y: e.y, ox: e.x, oy: e.y, targetX: tx, targetY: ty, speed: Math.max(1, d) / flight, radius: 7, life: flight + 0.1, isEnemy: true, owner: e, damage: 0, hitDmg: e.dmg, spin: Math.random() * 6 });
    effects.push({ type: 'slam_warn', x: tx, y: ty, radius: GREN_FIRE_R, color: '#ff7043', life: flight, maxLife: flight }); // where it bursts, as wide as the fire
}

// The cutpurse, the King of Thieves' own: it darts in down a short lane; a hit that lands steals gold (capped per wave),
// then it runs for a doorway of the open part of the castle with the purse on its back and slips out. Killed, it drops
// the gold x1.5 (combat.js checkEnemyDeath); if it gets away, the gold is gone. Nothing else ever removes it quietly:
// it's a wave enemy, so the wave can't end while it holds your gold, and escaping is the only exit without a kill.
var CutpurseAI = (e, dt, curSpd, edx, edy, edist, i) => {
    const rd = Math.hypot(player.x - e.x, player.y - e.y);
    e.stateTimer = (e.stateTimer === undefined ? 0.5 + Math.random() * 0.6 : e.stateTimer) - dt;
    e.ghosting = e.state === 'dash';
    if (e.state === 'slip') { // out through the doorway (bandits.js draws it stepping in and fading)
        e.fadeK = Math.min(1, (e.fadeK || 0) + dt / CUT_SLIP);
        if (e.fadeK >= 1) cutpurseEscaped(e);
        return;
    }
    if (e.state === 'flee') {
        e.fleeT += dt; e.doorCd -= dt;
        if (e.doorCd <= 0) { e.doorCd = 0.5; e.door = cutpurseDoor(e); }
        let mx, my;
        if (e.door && (!currentMap.grid || walkClear(e.x, e.y, e.door.x, e.door.y))) { mx = e.door.x - e.x; my = e.door.y - e.y; }
        else if (edist > 0 && edist !== Infinity) { mx = -edx; my = -edy; } else { mx = e.x - player.x; my = e.y - player.y; } // no clear way to a door: away from the hero
        const ml = Math.hypot(mx, my) || 1, sp = curSpd * CUT_FLEE;
        if (sp > 0) { e.x += mx / ml * sp * dt; e.y += my / ml * sp * dt; e.facingAngle = Math.atan2(my, mx); }
        if (Math.random() < 0.12) spawnParticle({ kind: 'dot', color: '#ffd54f', x: e.x + jitter(6), y: e.y + jitter(6), vx: jitter(30), vy: jitter(30), size: 1.8, life: 0.5, drag: 2, grow: 0, spin: 0, rot: 0 }); // a coin's glint as it runs
        const atDoor = e.door && Math.hypot(e.door.x - e.x, e.door.y - e.y) < 26;
        if (atDoor || (!e.door && rd > 700) || e.fleeT > CUT_FLEE_MAX) { e.state = 'slip'; e.fadeK = 0; e.slipTo = atDoor ? { x: e.door.ox, y: e.door.oy } : null; }
        return;
    }
    garCheck(e);
    if (e.state === 'dash_prep') { // crouched, the lane on the hero until it locks
        garAim(e, CUT_LOCK);
        if (e.stateTimer <= 0) { e.state = 'dash'; e.prepLen = 0; e.dashLeft = CUT_DASH; e.hitDone = false; }
        return;
    }
    if (e.state === 'dash') { // a dart down the lane, a hand at the purse
        const step = Math.min(e.dashLeft, CUT_DASH_SPEED * dt), nx = e.x + Math.cos(e.aimA) * step, ny = e.y + Math.sin(e.aimA) * step;
        e.facingAngle = e.aimA;
        if (curSpd <= 0 || (currentMap.grid && solidCell(terrainAt(nx, ny), false))) e.dashLeft = 0;
        else { e.x = nx; e.y = ny; e.dashLeft -= step; }
        if (!e.hitDone && player.z <= 4 && Math.hypot(player.x - e.x, player.y - e.y) < player.radius + e.size / 2 + CUT_REACH) {
            e.hitDone = true;
            const hp0 = player.hp, sh0 = player.shield || 0;
            takeDamage(e.dmg);
            if ((player.hp < hp0 || (player.shield || 0) < sh0) && cutpurseSteal(e)) { e.state = 'flee'; e.fleeT = 0; e.doorCd = 0; e.ghosting = false; return; } // a dodge or a parry keeps the purse
        }
        if (e.dashLeft <= 0) { e.state = 'recover'; e.stateTimer = 0.45; }
        return;
    }
    if (e.state === 'recover') { if (e.stateTimer <= 0) { e.state = null; e.stateTimer = 0.7 + Math.random() * 0.5; } return; }
    if (curSpd > 0 && rd > 90 && edist > 0 && edist !== Infinity) { e.x += edx / edist * curSpd * dt; e.y += edy / edist * curSpd * dt; }
    if (e.stateTimer <= 0 && curSpd > 0 && e.frozenTimer <= 0 && rd < CUT_DASH - 20 && (!currentMap.grid || walkClear(e.x, e.y, player.x, player.y)))
        garPrep(e, 'dash_prep', CUT_WINDUP, { kind: 'lane', len: CUT_DASH + e.size / 2 + CUT_REACH, w: e.size + CUT_REACH * 2, lock: CUT_LOCK });
};
function cutpurseSteal(e) {
    const room = Math.floor((waveStats.gold0 || 0) * CUT_WAVE_CAP) - (waveStats.stolen || 0), n = Math.max(0, Math.min(player.gold, CUT_STEAL(wave), room));
    if (n <= 0) return false; // nothing left it may take: it keeps fighting instead
    player.gold -= n; e.loot = (e.loot || 0) + n; waveStats.stolen = (waveStats.stolen || 0) + n;
    effects.push({ type: 'text', text: `-${n} gold`, x: player.x, y: player.y - 40, color: '#ffd54f', life: 1.2, maxLife: 1.2 });
    burst(player.x, player.y, Math.atan2(e.y - player.y, e.x - player.x), 1.2, 8, { kind: 'spark', color: '#ffd54f', size: 2.2, speed: [80, 220], life: 0.4, drag: 3 }); // coins flicked toward it
    updateHUD(); return true;
}
function cutpurseDoor(e) { // map_castle.js: the open part's doorways and tapestries; the one it's nearest to, the hero furthest from
    if (currentMap.type !== 'castle' || !cst.spawns.length) return null;
    let pool = cst.spawns.filter(p => p.sec === cst.open); if (!pool.length) pool = cst.spawns;
    let best = null, bs = Infinity;
    for (const p of pool) { const s = Math.hypot(p.x - e.x, p.y - e.y) - 0.8 * Math.hypot(p.x - player.x, p.y - player.y); if (s < bs) { bs = s; best = p; } }
    return best;
}
function cutpurseEscaped(e) { // gone with the gold: no kill and no XP, but it no longer holds the wave open
    if (e.dead) return;
    e.dead = true; activeEnemies--;
    if (e.loot > 0) effects.push({ type: 'text', text: `A cutpurse got away with ${e.loot} gold`, x: player.x, y: player.y - 56, color: '#ffb74d', life: 2.0, maxLife: 2.0 });
    e.loot = 0;
    if (enemiesToSpawn <= 0 && activeEnemies <= 0) { collectAllDrops(); if (gameState === STATE.PLAYING) onWaveCleared(); } // stage.js
    updateHUD();
}
function cutpurseLoot(e) { // combat.js checkEnemyDeath: killed with the purse, the gold spills out x1.5
    const total = Math.round(e.loot * CUT_REFUND), n = Math.min(4, Math.max(1, Math.ceil(total / 15)));
    for (let k = 0; k < n; k++) {
        const a = k / n * Math.PI * 2 + Math.random(), d = 16 + Math.random() * 20;
        let x = e.x + Math.cos(a) * d, y = e.y + Math.sin(a) * d;
        if (currentMap.grid && solidCell(terrainAt(x, y), false)) { x = e.x; y = e.y; } // never into a wall or under a table
        drops.push({ x, y, type: 'gold', val: Math.floor(total / n) + (k < total % n ? 1 : 0), radius: 8, life: 30 });
    }
    effects.push({ type: 'text', text: `+${total} gold back`, x: e.x, y: e.y - 36, color: '#ffd54f', life: 1.4, maxLife: 1.4 });
    e.loot = 0;
}

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
    effects.push({ type: 'lance_lane', e, w: e.size + 16, len: BEAST_JOUST_RANGE, lockAt: t - RIDER_LOCK, life: t, maxLife: t }); // bandits.js; as wide as the hit (size / 2 + 8 past your edge)
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
    if (e.state === 'guard') { e.facingAngle = BEAST_GUARD.face; return; } // crouched with his hounds until the hero comes (map_trail.js)
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

// Valerius the Vanguard (Bandit Bastion stage 3, map_bridge.js): a duel with a war spear on a chain. Every lane, wedge and
// ring he telegraphs is drawn exactly as wide as its hit (bandits.js val_* effects): if your body is clear of it, you're safe.
// He's fast and never still for long: he stalks you at a run and sprints in from afar, vaults over on his spear from middle
// distance, and between moves he reads your blows: when his dodge is ready, the next hit is evaded with a blurred side-step
// (valDodge, from combat.js applyDamage; a Nightblade weak-point hit still goes through).
//  Phase 1 (to 65%): Spear Lunge down a lane; Hook & Haul (the spear thrown on its chain: a hit drags you to him and he kicks
//    you off; a miss leaves it stuck in the deck while he tugs it free, a window to punish him); Sweeping Arc up close.
//  Phase 2 (to 30%): the castle's archers loose volleys (map_bridge.js); Spear Toss (out and reeled back: it hits both ways);
//    Chain Lasso (a ring at the chain's length: step inside it or stay out); the lunge.
//  Phase 3: Chain Cyclone (two turns of the spear swung on the full chain: keep out of reach, or leap or dash through it);
//    Skewer Leap onto a marked spot (then he wrenches the spear free); Hook & Haul twice running; everything a little faster.
//  At 0 HP on the bridge he escapes instead of dying (combat.js valeriusLastStand, map_bridge.js startValeriusEscape).
const VAL_LUNGE_PREP = 0.6, VAL_LUNGE_LOCK = 0.25, VAL_LUNGE_RUN = 420, VAL_LUNGE_SPEED = 1400, VAL_LUNGE_REACH = 40, VAL_LUNGE_DMG = 1.6;
const VAL_HOOK_PREP = 0.55, VAL_HOOK_LOCK = 0.2, VAL_HOOK_RANGE = 520, VAL_HOOK_SPEED = 1500, VAL_HOOK_W = 10, VAL_HOOK_DMG = 0.8, VAL_KICK_DMG = 0.6, VAL_HOOK_STUCK = 1.0;
const VAL_ARC_PREP = 0.5, VAL_ARC_LOCK = 0.15, VAL_ARC_HALF = 1.4, VAL_ARC_REACH = 95, VAL_ARC_DMG = 1.3;
const VAL_TOSS_PREP = 0.55, VAL_TOSS_LOCK = 0.2, VAL_TOSS_RANGE = 600, VAL_TOSS_OUT = 1300, VAL_TOSS_BACK = 1000, VAL_TOSS_W = 12, VAL_TOSS_DMG = 1.0;
const VAL_LASSO_PREP = 0.9, VAL_LASSO_R = 225, VAL_LASSO_W = 25, VAL_LASSO_DMG = 1.4;
const VAL_CYC_PREP = 0.8, VAL_CYC_TURNS = 2, VAL_CYC_TURN = 1.1, VAL_CYC_R = 270, VAL_CYC_W = 10, VAL_CYC_DMG = 1.3, VAL_CYC_DRIFT = 90;
const VAL_LEAP_PREP = 0.35, VAL_LEAP_FLIGHT = 0.85, VAL_LEAP_R = 100, VAL_LEAP_DMG = 1.8, VAL_LEAP_STUCK = 0.7, VAL_LEAP_Z = 220;
const VAL_STEP_SPEED = 720, VAL_STEP_T = 0.22, VAL_VAULT_FAR = 430, VAL_VAULT_MAX = 650, VAL_VAULT_CD = 4, VAL_VAULT_FLIGHT = 0.55, VAL_VAULT_Z = 80, VAL_VAULT_DMG = 0.8;
const VAL_SPRINT = 600, VAL_SPRINT_K = 2.2, VAL_DODGE_CD = [0, 2.6, 2.2, 1.7]; // sprints when further than VAL_SPRINT; dodge cooldown by phase
const VAL_TOUCH_DMG = 0.7, VAL_PHASE2 = 0.65, VAL_PHASE3 = 0.3, VAL_GAP = [0, 0.55, 0.5, 0.35];
const VAL_BLUR = { lunge: 1, v_step: 1, vault: 1, leap: 1, flurry: 1, kick_run: 1 }; // states drawn with afterimages (bandits.js)
// Valerius, King of Thieves (wave 17, the castle: e.king). Phase 1 is the bridge's phases 1 and 2 with shorter gaps; phase 2
// (65%) the bridge's phase 3 moves plus his hall (map_castle.js): a spear toss that cuts a chandelier down onto you, and a
// brazier kicked down a lane, leaving a strip of fire. Phase 3 (30%), Unchained: he snaps the chain, drives the spear into a
// pillar and draws two stolen blades: Twin Flurry (three dashes, a short lane each), Cross Cut (an X of two lanes on you),
// Cutthroat Step (gone in afterimages, a ring behind you), Blade Storm (a spinning ring). At 0 HP: map_castle.js valerius_fall.
const VAL_GAP_K = [0, 0.45, 0.4, 0.45], VAL_DODGE_K = [0, 2.3, 1.9, 1.3], VAL_PREF_K = [0, 200, 170, 140];
const VK_HAZ_CD = 5.5, VK_CHAND_PREP = 0.45, VK_CHAND_FALL = 0.55, VK_CHAND_R = 95, VK_CHAND_DMG = 1.6; // the chandelier: its whole drop is marked on the floor
const VK_KICK_PREP = 0.75, VK_KICK_L = 520, VK_KICK_W = 56, VK_KICK_SPEED = 760, VK_KICK_DMG = 1.4;    // the brazier: a lane from it, locked from the start
const VK_UNCHAIN = 1.8;
const VK_FLURRY_PREP = 0.5, VK_FLURRY_NEXT = 0.42, VK_FLURRY_LOCK = 0.2, VK_FLURRY_RUN = 230, VK_FLURRY_SPEED = 1100, VK_FLURRY_REACH = 30, VK_FLURRY_DMG = 0.8, VK_FLURRY_CD = 5, VK_FLURRY_REC = 0.7; // bot runs: 0.32 s / 0.14 s follow-ups were 21% of all damage taken; playtest: still too frequent and fast for the fragile classes
const VK_CROSS_PREP = 0.85, VK_CROSS_LOCK = 0.3, VK_CROSS_L = 440, VK_CROSS_W = 44, VK_CROSS_DMG = 1.5;
const VK_STEP_PREP = 0.8, VK_STEP_LOCK = 0.32, VK_STEP_BEHIND = 60, VK_STEP_R = 85, VK_STEP_DMG = 1.6;
const VK_STORM_PREP = 0.6, VK_STORM_T = 1.3, VK_STORM_R = 125, VK_STORM_DMG = 0.8, VK_STORM_DRIFT = 150;
const valPace = e => (e.phase === 3 || (e.king && e.phase === 2) ? 0.8 : 1);
function valHit(e, mult) { // a blow leaps, dashes, i-frames and parries can beat; true only if it really landed (HP or shield lost)
    if (player.z > 4) return false;
    const hp0 = player.hp, sh0 = player.shield || 0;
    takeDamage(e.dmg * mult);
    const landed = player.hp < hp0 || (player.shield || 0) < sh0;
    if (landed) { // it connects: a beat of hit-stop and a jolt, scaled by the blow
        hitStopTimer = Math.max(hitStopTimer, 0.03 + mult * 0.03); addShake(2 + mult * 2.5);
        burst(player.x, player.y, Math.atan2(player.y - e.y, player.x - e.x), 1.6, 8 + Math.round(mult * 4), { kind: 'spark', color: '#ffe0b2', size: 2.4, speed: [160, 380], life: 0.3, drag: 5 });
    }
    return landed;
}
function valImpact(x, y, power) { // the weight of a blow landing, hit or miss: a jolt, stone chips off the slabs, a puff of dust
    addShake(power);
    burst(x, y, 0, Math.PI * 2, 5 + Math.round(power * 2), { kind: 'debris', color: '#8d8579', size: 2.4 + power * 0.25, speed: [60, 120 + power * 35], life: 0.5, drag: 3 });
    for (let k = 0; k < Math.round(power * 1.5); k++) spawnParticle({ kind: 'smoke', color: 'rgba(150, 140, 125, 0.45)', x: x + jitter(30), y: y + jitter(30), vx: jitter(140), vy: jitter(140), size: 12 + power * 2.5, grow: 30, life: 0.8, drag: 2.5, spin: 0, rot: 0 });
}
function valShove(e, d) { // knocked back, away from him
    if (player.dash || player.grappleTarget) return;
    const [x, y, l] = getVector(e.x, e.y, player.x, player.y);
    player.x += x / l * d; player.y += y / l * d; clampToBounds(player, player.radius);
}
const valTip = (e, d, a) => ({ x: e.x + Math.cos(a) * (e.size / 2 + d), y: e.y + Math.sin(a) * (e.size / 2 + d), a }); // the spearhead d px past his body along a
const valWall = (x, y) => !!currentMap.grid && (terrainAt(x, y) === T_WALL || terrainAt(x, y) === T_SEAL);
function valDone(e, gap) { e.state = 'idle'; e.stateTimer = gap !== undefined ? gap : (e.king ? VAL_GAP_K : VAL_GAP)[e.phase]; e.spear = null; e.airborne = false; e.liftZ = 0; }
function valReset(e) { // a phase change cuts the current move short
    for (let i = effects.length - 1; i >= 0; i--) if (effects[i].e === e && String(effects[i].type).startsWith('val_')) effects.splice(i, 1);
    if (e.pull && player.grappleTarget === e.pull) player.grappleTarget = null;
    if (e.tossChand !== undefined) { chandelierCut(e.tossChand, e.dmg * VK_CHAND_DMG); e.tossChand = e.tossMax = undefined; } // map_castle.js: its drop was already marked, so it comes down
    e.spear = null; e.airborne = false; e.liftZ = 0; e.pull = null; e.fadeK = 0;
}
function valPrep(e, state, len, fx) { // a move's wind-up: e.aimA follows the hero until the move locks
    e.state = state; e.prepLen = e.stateTimer = len; e.aimA = Math.atan2(player.y - e.y, player.x - e.x);
    if (fx) effects.push(Object.assign({ e, life: len, maxLife: len }, fx)); // bandits.js draws it
}
const valHookLane = (e, len) => ({ type: 'val_lane', chain: true, w: VAL_HOOK_W * 2, len: VAL_HOOK_RANGE + e.size / 2, lockAt: len - VAL_HOOK_LOCK });
// He reads the blow and steps aside: the hit is evaded, he blurs out sideways and away. Only between moves (stalking, or in
// a side-step's blur), only when his dodge is ready (VAL_DODGE_CD, shorter each phase), never while held by crowd control
function valDodge(e) {
    if ((e.state !== 'idle' && e.state !== 'v_step') || e.dodgeCd > 0 || e.escaping || e.frozenTimer > 0 || e.stunTimer > 0 || e.rootedTimer > 0) return false;
    const away = Math.atan2(e.y - player.y, e.x - player.x);
    e.state = 'v_step'; e.stepT = VAL_STEP_T; e.stepA = away + (Math.random() < 0.5 ? 1 : -1) * 1.15; e.dodgeCd = (e.king ? VAL_DODGE_K : VAL_DODGE_CD)[e.phase || 1]; e.stepCd = Math.max(e.stepCd || 0, 0.8);
    burst(e.x, e.y, e.stepA + Math.PI, 1.2, 8, { kind: 'smoke', color: 'rgba(150, 140, 125, 0.55)', size: 10, speed: [60, 160], life: 0.45, drag: 3, grow: 18 });
    effects.push({ type: 'text', text: 'Evaded!', x: e.x, y: e.y - e.size / 2 - 14, color: '#ffccbc', life: 0.6, maxLife: 0.6 });
    return true;
}
function valChoose(e, rd) {
    const near = rd < 170, inHook = rd < VAL_HOOK_RANGE - 20, pace = e.phase === 3 ? 0.8 : 1;
    if (rd > VAL_VAULT_FAR && rd < VAL_VAULT_MAX && !(e.vaultCd > 0) && Math.random() < 0.5) { // middle distance: over he goes on his spear, now and then
        e.state = 'vault_prep'; e.prepLen = e.stateTimer = 0.28; e.aimA = Math.atan2(player.y - e.y, player.x - e.x); e.vaultCd = VAL_VAULT_CD; return;
    }
    const pick = () => { const r = Math.random();
        if (e.phase === 1) return near ? (r < 0.6 ? 'arc' : 'lunge') : inHook ? (r < 0.45 ? 'lunge' : 'hook') : null;
        if (e.phase === 2) return near ? (r < 0.45 ? 'arc' : 'lasso') : rd < 330 ? (r < 0.5 ? 'lasso' : r < 0.75 ? 'toss' : 'lunge') : rd < VAL_TOSS_RANGE ? (r < 0.6 ? 'toss' : 'lunge') : null;
        return near ? (r < 0.5 ? 'cyclone' : r < 0.75 ? 'arc' : 'leap') : inHook ? (r < 0.35 ? 'cyclone' : r < 0.65 ? 'hook' : 'leap') : 'leap'; };
    let m = pick(); if (m && m === e.lastMove) m = pick() || m; // rarely the same move twice
    valStart(e, m);
}
function valStart(e, m) {
    if (!m) { e.stateTimer = 0.15; return; } // out of reach: keep closing in
    const pace = valPace(e);
    e.lastMove = m;
    if (m === 'lunge') valPrep(e, 'lunge_prep', VAL_LUNGE_PREP * pace, { type: 'val_lane', w: e.size + 16, len: VAL_LUNGE_RUN + e.size / 2 + VAL_LUNGE_REACH, lockAt: VAL_LUNGE_PREP * pace - VAL_LUNGE_LOCK });
    else if (m === 'hook') { e.hooks = pace < 1 ? 2 : 1; valPrep(e, 'hook_prep', VAL_HOOK_PREP * pace, valHookLane(e, VAL_HOOK_PREP * pace)); }
    else if (m === 'arc') valPrep(e, 'arc_prep', VAL_ARC_PREP * pace, { type: 'val_wedge', R: e.size / 2 + VAL_ARC_REACH, half: VAL_ARC_HALF, lockAt: VAL_ARC_PREP * pace - VAL_ARC_LOCK });
    else if (m === 'toss') valPrep(e, 'toss_prep', VAL_TOSS_PREP, { type: 'val_lane', chain: true, w: VAL_TOSS_W * 2, len: VAL_TOSS_RANGE + e.size / 2, lockAt: VAL_TOSS_PREP - VAL_TOSS_LOCK });
    else if (m === 'lasso') valPrep(e, 'lasso_prep', VAL_LASSO_PREP, { type: 'val_ring', R: VAL_LASSO_R, w: VAL_LASSO_W });
    else if (m === 'cyclone') { e.cycDir = Math.random() < 0.5 ? -1 : 1; valPrep(e, 'cyc_prep', VAL_CYC_PREP, { type: 'val_cyclone', R: VAL_CYC_R, dir: e.cycDir }); }
    else if (m === 'leap') valPrep(e, 'leap_prep', VAL_LEAP_PREP);
    else if (m === 'flurry') { e.flurryN = 3; e.flurryCd = VK_FLURRY_CD; valPrep(e, 'flurry_prep', VK_FLURRY_PREP, valFlurryLane(e, VK_FLURRY_PREP)); }
    else if (m === 'cross') { e.crossX = player.x; e.crossY = player.y; valPrep(e, 'cross_prep', VK_CROSS_PREP, { type: 'val_cross', L: VK_CROSS_L, w: VK_CROSS_W, lockAt: VK_CROSS_PREP - VK_CROSS_LOCK }); }
    else if (m === 'kstep') { valPrep(e, 'k_step_prep', VK_STEP_PREP); valStepMark(e); effects.push({ type: 'gar_tell', e, state: 'k_step_prep', kind: 'ring', R: VK_STEP_R, lock: VK_STEP_LOCK, life: VK_STEP_PREP + 0.05, maxLife: VK_STEP_PREP + 0.05 }); } // bandits.js: Sable's ring
    else if (m === 'storm') valPrep(e, 'storm_prep', VK_STORM_PREP, { type: 'val_storm', R: VK_STORM_R });
}
const valFlurryLane = (e, len) => ({ type: 'val_lane', w: e.size + 16, len: VK_FLURRY_RUN + e.size / 2 + VK_FLURRY_REACH, lockAt: len - VK_FLURRY_LOCK });
function valStepMark(e) { // Cutthroat Step: behind you as he sees you, never inside a wall
    const a = Math.atan2(player.y - e.y, player.x - e.x); e.stepX = player.x + Math.cos(a) * VK_STEP_BEHIND; e.stepY = player.y + Math.sin(a) * VK_STEP_BEHIND;
    if (currentMap.grid) { const cl = clipToWalls(player.x, player.y, e.stepX, e.stepY, e.size / 2, false); if (cl) [e.stepX, e.stepY] = cl; }
}
// The King of Thieves picks from his own lists (phases above); in phase 2 his hall now and then (map_castle.js)
function valChooseKing(e, rd) {
    const near = rd < 170, inHook = rd < VAL_HOOK_RANGE - 20;
    if (e.phase < 3 && rd > VAL_VAULT_FAR && rd < VAL_VAULT_MAX && !(e.vaultCd > 0) && Math.random() < 0.4) {
        e.state = 'vault_prep'; e.prepLen = e.stateTimer = 0.28; e.aimA = Math.atan2(player.y - e.y, player.x - e.x); e.vaultCd = VAL_VAULT_CD; return;
    }
    if (e.phase === 2 && !(e.hazCd > 0) && Math.random() < 0.55) {
        const ci = kingChandelier(e), B = ci < 0 ? kingBrazier(e) : null; // map_castle.js
        if (ci >= 0 && (!B || Math.random() < 0.6)) { // the toss goes up at the chain, the chandelier comes down on you
            const [cx, cy] = CS_CHAND[ci], d = Math.hypot(cx - e.x, cy - e.y);
            valPrep(e, 'chand_prep', VK_CHAND_PREP, { type: 'val_lane', chain: true, w: VAL_TOSS_W * 2, len: d, lockAt: 0 });
            e.aimA = Math.atan2(cy - e.y, cx - e.x); e.tossChand = ci; e.tossMax = d - e.size / 2; e.hazCd = VK_HAZ_CD; e.lastMove = 'hazard';
            const fall = VK_CHAND_PREP + d / VAL_TOSS_OUT + VK_CHAND_FALL;
            effects.push({ type: 'slam_warn', x: cx, y: cy, radius: VK_CHAND_R, color: '#ff7043', life: fall, maxLife: fall });
            return;
        }
        if (B) { e.state = 'kick_run'; e.kickB = B; e.stateTimer = 1.6; e.hazCd = VK_HAZ_CD; e.lastMove = 'hazard'; return; }
    }
    const pick = () => { const r = Math.random();
        if (e.phase === 1) return near ? (r < 0.4 ? 'arc' : r < 0.7 ? 'lunge' : 'lasso') : rd < 330 ? (r < 0.35 ? 'lasso' : r < 0.6 ? 'hook' : r < 0.8 ? 'toss' : 'lunge') : inHook ? (r < 0.4 ? 'hook' : r < 0.7 ? 'toss' : 'lunge') : rd < VAL_TOSS_RANGE ? 'toss' : null;
        if (e.phase === 2) return near ? (r < 0.3 ? 'cyclone' : r < 0.7 ? 'arc' : 'leap') : inHook ? (r < 0.2 ? 'cyclone' : r < 0.55 ? 'hook' : r < 0.8 ? 'leap' : 'lunge') : 'leap';
        const fl = e.flurryCd > 0 ? 0 : 1; // Twin Flurry at most every VK_FLURRY_CD s
        return near ? (r < 0.45 ? 'storm' : r < 0.45 + 0.2 * fl ? 'flurry' : 'cross') : rd < 380 ? (r < 0.3 * fl ? 'flurry' : r < 0.65 ? 'cross' : 'kstep') : rd < 650 ? (r < 0.75 || !fl ? 'kstep' : 'flurry') : 'kstep'; };
    let m = pick(); if (m && m === e.lastMove) m = pick() || m;
    valStart(e, m);
}
function valLeapTo(e, state, x, y, flight) { // shared by the vault and the Skewer Leap: an arc to (x, y), marked where he'll come down
    e.state = state; e.leapK = 0; e.lx0 = e.x; e.ly0 = e.y; e.lx1 = x; e.ly1 = y; e.leapT = flight; e.airborne = true;
    valImpact(e.x, e.y, 2); // pushing off
}
var ValeriusAI = (e, dt, curSpd, edx, edy, edist, i) => {
    if (e.state === 'escape' || e.state === 'escape_throw' || e.state === 'v_intro' || e.state === 'intro_throw' || e.state === 'v_wall' || e.state === 'king_fall') return; // map_bridge.js / map_castle.js move him
    const [rx, ry, rd0] = getVector(e.x, e.y, player.x, player.y), rd = rd0 || 1, toHero = Math.atan2(ry, rx), hpK = e.hp / e.maxHp;
    if (!e.phase) e.phase = 1;
    if (e.king && e.phase === 1 && hpK < VAL_PHASE2) { // Let it burn: his hall joins the fight (map_castle.js)
        e.phase = 2; valReset(e); e.state = 'rally'; e.stateTimer = 1.1; e.hazCd = 1.5; valImpact(e.x, e.y, 5); hitStopTimer = Math.max(hitStopTimer, 0.08);
        effects.push({ type: 'slime_shock', x: e.x, y: e.y, radius: 220, color: '#ff7043', life: 0.6, maxLife: 0.6 }, { type: 'slime_shock', x: e.x, y: e.y, radius: 360, color: '#ff7043', life: 0.9, maxLife: 0.9 });
        kingBark(e, 'Let the whole hall burn, then!');
    }
    if (e.king && e.phase === 2 && hpK < VAL_PHASE3) { // Unchained: the chain snaps, the spear goes into a pillar, out come two stolen blades
        e.phase = 3; valReset(e); e.state = 'unchain'; e.stateTimer = VK_UNCHAIN; e.invulnerable = true; e.aimA = toHero;
        let best = null, bd = Infinity; // the nearest of the hall's great pillars takes the spear
        for (const o of currentMap.obstacles || []) if (o.kind === 'pillar_t') { const dd = Math.hypot(o.x - e.x, o.y - e.y); if (dd < bd) { bd = dd; best = o; } }
        if (best) { const a = Math.atan2(best.y - e.y, best.x - e.x); e.pillar = { x: best.x + Math.cos(a) * best.r * 0.4, y: best.y + Math.sin(a) * best.r * 0.4, a, px: best.x, py: best.y, pr: best.r }; } // the blade buried in the stone else e.pillar = null;
    }
    if (!e.king && e.phase === 1 && hpK < VAL_PHASE2) { // Hold the Bridge: he raises the spear with a roar and the castle answers with its archers (map_bridge.js)
        e.phase = 2; valReset(e); e.state = 'rally'; e.stateTimer = 1.1; valImpact(e.x, e.y, 5); hitStopTimer = Math.max(hitStopTimer, 0.08);
        effects.push({ type: 'slime_shock', x: e.x, y: e.y, radius: 220, color: '#c9a227', life: 0.6, maxLife: 0.6 }, { type: 'slime_shock', x: e.x, y: e.y, radius: 360, color: '#c9a227', life: 0.9, maxLife: 0.9 });
        if (typeof brg !== 'undefined') brg.flare = 1;
    }
    if (!e.king && e.phase === 2 && hpK < VAL_PHASE3) { // Last Stand: a roar that shakes the bridge, the archers pull back, and he stops holding back
        e.phase = 3; valReset(e); e.state = 'rage'; e.stateTimer = 0.9; valImpact(e.x, e.y, 7); hitStopTimer = Math.max(hitStopTimer, 0.12);
        effects.push({ type: 'slime_shock', x: e.x, y: e.y, radius: 300, color: '#ff5252', life: 0.7, maxLife: 0.7 }, { type: 'slime_shock', x: e.x, y: e.y, radius: 460, color: '#ff1744', life: 1.0, maxLife: 1.0 });
        burst(e.x, e.y, 0, Math.PI * 2, 24, { kind: 'spark', color: '#ff8a65', size: 2.6, speed: [120, 420], life: 0.6, drag: 3 });
        if (typeof brg !== 'undefined') brg.flare = 1;
    }
    const pace = valPace(e), R = player.radius;
    e.stateTimer -= dt; e.ghosting = !!VAL_BLUR[e.state] || (e.king && e.phase === 3); // unchained, he's a blur
    if (e.hazCd > 0) e.hazCd -= dt;
    if (e.cycHitCd > 0) e.cycHitCd -= dt;
    if (e.stepCd > 0) e.stepCd -= dt;
    if (e.vaultCd > 0) e.vaultCd -= dt;
    if (e.flurryCd > 0) e.flurryCd -= dt;
    if (e.dodgeCd > 0) e.dodgeCd -= dt;
    if (!e.airborne && rd < e.size / 2 + R + 4 && e.meleeTimer <= 0) { takeDamage(e.dmg * VAL_TOUCH_DMG); e.meleeTimer = 1.0; }
    const aimTrack = lock => { if (e.stateTimer > lock) e.aimA = toHero; e.facingAngle = e.aimA; };

    if (!e.state || e.state === 'idle') { // stalking: at a run round the hero at his phase's distance, closing in along the path when far
        const pref = e.king ? VAL_PREF_K[e.phase] : e.phase === 2 ? 280 : e.phase === 3 ? 160 : 150;
        if (curSpd > 0 && edist !== Infinity && edist > 0) {
            let mx = edx / edist, my = edy / edist;
            if (rd < pref + 70 && (!currentMap.grid || e.los !== false)) { const sd = e.circle || 1, pull = (rd - pref) / 120; mx = -ry / rd * sd + rx / rd * pull; my = rx / rd * sd + ry / rd * pull; }
            const sprint = rd > VAL_SPRINT, sp = curSpd * (sprint ? VAL_SPRINT_K : 1), ml = Math.hypot(mx, my) || 1; // far off: a flat-out sprint, not hops
            e.x += mx / ml * sp * dt; e.y += my / ml * sp * dt;
            if (sprint) { e.ghosting = true; if (Math.random() < 0.5) spawnParticle({ kind: 'smoke', color: 'rgba(150, 140, 125, 0.45)', x: e.x - mx / ml * 22 + jitter(12), y: e.y - my / ml * 22 + jitter(12), vx: jitter(40), vy: jitter(40), size: 10, grow: 24, life: 0.5, drag: 2, spin: 0, rot: 0 }); }
        }
        e.facingAngle = toHero;
        if (!(e.stepCd > 0) && rd < 420 && e.stateTimer > 0.25 && curSpd > 0 && e.frozenTimer <= 0) { // a side-step in a blur, to keep you guessing
            e.state = 'v_step'; e.stepT = VAL_STEP_T; e.stepA = toHero + (Math.random() < 0.5 ? 1 : -1) * (Math.PI / 2 - 0.25); e.stepCd = 1.6 + Math.random() * 1.2; e.circle = -(e.circle || 1); // fewer of these now that he dodges for real (valDodge)
            burst(e.x, e.y, e.stepA + Math.PI, 1.2, 6, { kind: 'smoke', color: 'rgba(150, 140, 125, 0.5)', size: 9, speed: [40, 120], life: 0.45, drag: 3, grow: 16 });
        } else if (e.stateTimer <= 0 && e.frozenTimer <= 0) { e.circle = Math.random() < 0.5 ? -1 : 1; if (e.king) valChooseKing(e, rd); else valChoose(e, rd); }
    } else if (e.state === 'v_step') {
        e.stepT -= dt; e.facingAngle = toHero;
        const nx = e.x + Math.cos(e.stepA) * VAL_STEP_SPEED * dt, ny = e.y + Math.sin(e.stepA) * VAL_STEP_SPEED * dt;
        if (curSpd > 0 && !(currentMap.grid && solidCell(terrainAt(nx, ny), false))) { e.x = nx; e.y = ny; } else e.stepT = 0;
        if (e.stepT <= 0) e.state = 'idle';
    } else if (e.state === 'rally' || e.state === 'rage') {
        e.facingAngle = toHero;
        if (e.stateTimer <= 0) valDone(e, 0.2);
    // ---- the vault: the spear planted, and over he goes ----
    } else if (e.state === 'vault_prep') {
        e.facingAngle = e.aimA = toHero;
        if (e.stateTimer <= 0) {
            const land = Math.max(140, rd - 170), x = e.x + rx / rd * Math.min(land, 520), y = e.y + ry / rd * Math.min(land, 520);
            valLeapTo(e, 'vault', x, y, VAL_VAULT_FLIGHT);
            effects.push({ type: 'slam_warn', x, y, radius: e.size / 2 + 12, color: '#ff7043', life: VAL_VAULT_FLIGHT, maxLife: VAL_VAULT_FLIGHT });
        }
    } else if (e.state === 'vault' || e.state === 'leap') { // in the air: an arc to the marked spot, bigger as he rises
        const vault = e.state === 'vault';
        e.leapK = Math.min(1, e.leapK + dt / e.leapT); const k = e.leapK;
        e.x = lerp(e.lx0, e.lx1, k); e.y = lerp(e.ly0, e.ly1, k); e.liftZ = Math.sin(Math.PI * k) * (vault ? VAL_VAULT_Z : VAL_LEAP_Z); e.facingAngle = e.aimA;
        if (k >= 1) {
            e.airborne = false; e.liftZ = 0;
            if (vault) {
                valImpact(e.x, e.y, 4);
                if (Math.hypot(player.x - e.x, player.y - e.y) < e.size / 2 + 12 + R && valHit(e, VAL_VAULT_DMG)) valShove(e, 60);
                e.state = 'skewer'; e.stateTimer = 0.22; e.afterVault = true;
            } else { // the Skewer Leap comes down spear-first
                valImpact(e.x, e.y, 8); hitStopTimer = Math.max(hitStopTimer, 0.1);
                effects.push({ type: 'slime_shock', x: e.x, y: e.y, radius: VAL_LEAP_R + 30, color: '#c9a227', life: 0.45, maxLife: 0.45 }, { type: 'slime_shock', x: e.x, y: e.y, radius: VAL_LEAP_R + 150, color: '#8d8579', life: 0.7, maxLife: 0.7 });
                effects.push({ type: 'scorch', x: e.x, y: e.y, r: 70, life: 5, maxLife: 5 });
                if (Math.hypot(player.x - e.x, player.y - e.y) < VAL_LEAP_R + R && valHit(e, VAL_LEAP_DMG)) valShove(e, 90);
                e.state = 'skewer'; e.stateTimer = VAL_LEAP_STUCK * pace; e.afterVault = false;
            }
        }
    // ---- Spear Lunge ----
    } else if (e.state === 'lunge_prep') {
        aimTrack(VAL_LUNGE_LOCK);
        if (e.stateTimer <= 0) { e.state = 'lunge'; e.runLeft = VAL_LUNGE_RUN; e.hitDone = false; valImpact(e.x, e.y, 2.5); }
    } else if (e.state === 'lunge') {
        e.facingAngle = e.aimA;
        const step = (curSpd > 0 ? VAL_LUNGE_SPEED : 0) * dt, nx = e.x + Math.cos(e.aimA) * step, ny = e.y + Math.sin(e.aimA) * step;
        if (step === 0 || (currentMap.grid && solidCell(terrainAt(nx, ny), false))) e.runLeft = 0; else { e.x = nx; e.y = ny; e.runLeft -= step; }
        if (Math.random() < 0.7) spawnParticle({ kind: 'smoke', color: 'rgba(150, 140, 125, 0.45)', x: e.x - Math.cos(e.aimA) * 24 + jitter(14), y: e.y - Math.sin(e.aimA) * 24 + jitter(14), vx: jitter(50), vy: jitter(50), size: 10, grow: 26, life: 0.55, drag: 2, spin: 0, rot: 0 });
        const tip = valTip(e, VAL_LUNGE_REACH, e.aimA);
        if (!e.hitDone && (Math.hypot(player.x - e.x, player.y - e.y) < e.size / 2 + R + 8 || Math.hypot(player.x - tip.x, player.y - tip.y) < R + 8)) { e.hitDone = true; if (valHit(e, VAL_LUNGE_DMG)) valShove(e, 70); }
        if (e.runLeft <= 0) { e.state = 'lunge_rec'; e.stateTimer = 0.3 * pace; valImpact(tip.x, tip.y, 1.5); } // a skid at the end of it
    } else if (e.state === 'lunge_rec') {
        e.facingAngle = e.aimA;
        if (e.stateTimer <= 0) valDone(e);
    // ---- Hook & Haul ----
    } else if (e.state === 'hook_prep') {
        aimTrack(VAL_HOOK_LOCK);
        if (e.stateTimer <= 0) { e.state = 'hook_fly'; e.spearD = 0; addShake(1.5); }
    } else if (e.state === 'hook_fly') {
        e.facingAngle = e.aimA; e.spearD += VAL_HOOK_SPEED * dt;
        const tip = e.spear = valTip(e, e.spearD, e.aimA);
        if (player.z <= 4 && Math.hypot(player.x - tip.x, player.y - tip.y) < R + VAL_HOOK_W) {
            const parried = player.parryTimer > 0;
            if (valHit(e, VAL_HOOK_DMG)) { // it bites: dragged in to his feet
                e.state = 'haul'; e.stateTimer = 1.2; const a = Math.atan2(player.y - e.y, player.x - e.x);
                player.dash = null; player.charge = null;
                e.pull = player.grappleTarget = { x: e.x + Math.cos(a) * (e.size / 2 + R + 14), y: e.y + Math.sin(a) * (e.size / 2 + R + 14), speed: 1700, iFrames: false, noLine: true };
            } else if (parried) { e.state = 'hook_reel'; burst(tip.x, tip.y, e.aimA + Math.PI, 1.4, 10, { kind: 'spark', color: '#ffe0b2', size: 2.2, speed: [120, 300], life: 0.3, drag: 5 }); } // knocked aside
        }
        if (e.state === 'hook_fly' && (e.spearD >= VAL_HOOK_RANGE || valWall(tip.x, tip.y))) { e.state = 'hook_stuck'; e.stateTimer = VAL_HOOK_STUCK * pace; valImpact(tip.x, tip.y, 3); }
    } else if (e.state === 'hook_stuck') { // the spear bit the deck: he leans on the chain to tug it free
        e.facingAngle = e.aimA; e.spear = valTip(e, e.spearD, e.aimA);
        if (Math.random() < 0.15) burst(e.spear.x, e.spear.y, e.aimA + Math.PI, 1, 2, { kind: 'debris', color: '#8d8579', size: 2, speed: [30, 90], life: 0.35, drag: 3 });
        if (e.stateTimer <= 0) { e.state = 'hook_reel'; burst(e.spear.x, e.spear.y, e.aimA + Math.PI, 1.4, 8, { kind: 'debris', color: '#8d8579', size: 3, speed: [80, 200], life: 0.45, drag: 3 }); }
    } else if (e.state === 'hook_reel') {
        e.facingAngle = e.aimA; e.spearD -= 1800 * dt; e.spear = valTip(e, Math.max(0, e.spearD), e.aimA);
        if (e.spearD <= 0) { e.spear = null; if (--e.hooks > 0) valPrep(e, 'hook_prep', 0.4, valHookLane(e, 0.4)); else valDone(e); }
    } else if (e.state === 'haul') { // reeling the hero in on the chain; at his feet, the kick
        const a = Math.atan2(player.y - e.y, player.x - e.x); e.facingAngle = a; e.aimA = a;
        e.spear = { x: player.x, y: player.y, a };
        if (Math.random() < 0.5) spawnParticle({ kind: 'smoke', color: 'rgba(150, 140, 125, 0.45)', x: player.x + jitter(10), y: player.y + jitter(10), vx: jitter(40), vy: jitter(40), size: 9, grow: 18, life: 0.45, drag: 2, spin: 0, rot: 0 }); // dragged along the slabs
        if (player.grappleTarget !== e.pull || e.stateTimer <= 0) { // arrived (or broke free with a dash)
            if (player.grappleTarget === e.pull) player.grappleTarget = null;
            e.pull = null; e.spear = null;
            if (rd < e.size / 2 + R + 40) { e.kickAt = fxTime; if (valHit(e, VAL_KICK_DMG)) { valImpact(player.x, player.y, 3); startDash({ x: e.x + Math.cos(a) * 280, y: e.y + Math.sin(a) * 280, dur: 0.3, arc: 22, iFrames: false }); } } // skillfx_space.js: off his boot
            if (--e.hooks > 0) valPrep(e, 'hook_prep', 0.45, valHookLane(e, 0.45));
            else { e.state = 'lunge_rec'; e.stateTimer = 0.3; }
        }
    // ---- Sweeping Arc ----
    } else if (e.state === 'arc_prep') {
        aimTrack(VAL_ARC_LOCK);
        if (e.stateTimer <= 0) {
            e.state = 'arc_strike'; e.stateTimer = 0.18; e.sweepAt = fxTime; addShake(3);
            effects.push({ type: 'val_slash', e, a: e.aimA, R: e.size / 2 + VAL_ARC_REACH, half: VAL_ARC_HALF, life: 0.24, maxLife: 0.24 }); // bandits.js: the crescent
            let off = toHero - e.aimA; while (off > Math.PI) off -= Math.PI * 2; while (off < -Math.PI) off += Math.PI * 2;
            if (rd < e.size / 2 + VAL_ARC_REACH + R && Math.abs(off) < VAL_ARC_HALF + R / Math.max(rd, 20) && valHit(e, VAL_ARC_DMG)) valShove(e, 80);
        }
    } else if (e.state === 'arc_strike') {
        e.facingAngle = e.aimA;
        if (e.stateTimer <= 0) { e.state = 'lunge_rec'; e.stateTimer = 0.25 * pace; }
    // ---- Spear Toss ----
    } else if (e.state === 'toss_prep') {
        aimTrack(VAL_TOSS_LOCK);
        if (e.stateTimer <= 0) { e.state = 'toss_out'; e.spearD = 0; e.hitOut = e.hitBack = false; addShake(1.5); }
    } else if (e.state === 'toss_out' || e.state === 'toss_back') {
        e.facingAngle = e.aimA; const out = e.state === 'toss_out';
        e.spearD += (out ? VAL_TOSS_OUT : -VAL_TOSS_BACK) * dt;
        const tip = e.spear = valTip(e, Math.max(0, e.spearD), e.aimA);
        if (!(out ? e.hitOut : e.hitBack) && player.z <= 4 && Math.hypot(player.x - tip.x, player.y - tip.y) < R + VAL_TOSS_W) { if (out) e.hitOut = true; else e.hitBack = true; valHit(e, VAL_TOSS_DMG); }
        if (out && (e.spearD >= (e.tossMax || VAL_TOSS_RANGE) || valWall(tip.x, tip.y))) {
            e.state = 'toss_hold'; e.stateTimer = 0.12;
            if (e.tossChand !== undefined) { chandelierCut(e.tossChand, e.dmg * VK_CHAND_DMG); e.tossChand = e.tossMax = undefined; } // map_castle.js: the chain parts
            else valImpact(tip.x, tip.y, 2.5);
        }
        if (!out && e.spearD <= 0) valDone(e);
    } else if (e.state === 'toss_hold') {
        e.facingAngle = e.aimA;
        if (e.stateTimer <= 0) e.state = 'toss_back';
    // ---- Chain Lasso ----
    } else if (e.state === 'lasso_prep') {
        e.facingAngle = toHero;
        if (e.stateTimer <= 0) {
            effects.push({ type: 'val_lash', e, x: e.x, y: e.y, R: VAL_LASSO_R, life: 0.3, maxLife: 0.3 }); addShake(4);
            for (let k = 0; k < 20; k++) { const a = k / 20 * Math.PI * 2; burst(e.x + Math.cos(a) * VAL_LASSO_R, e.y + Math.sin(a) * VAL_LASSO_R, a, 0.8, 1, { kind: 'spark', color: '#ffe0b2', size: 2, speed: [80, 220], life: 0.3, drag: 5 }); }
            if (Math.abs(rd - VAL_LASSO_R) < VAL_LASSO_W + R) valHit(e, VAL_LASSO_DMG);
            e.state = 'lunge_rec'; e.aimA = toHero; e.stateTimer = 0.3 * pace;
        }
    // ---- Chain Cyclone ----
    } else if (e.state === 'cyc_prep') {
        e.facingAngle = toHero; e.cycA = toHero + Math.PI; // the arm starts on the far side and comes round
        if (e.stateTimer <= 0) { e.state = 'cyclone'; e.cycLeft = VAL_CYC_TURNS * Math.PI * 2; e.cycHitCd = 0; e.cycHalf = 0; effects.push({ type: 'val_cyclone', e, R: VAL_CYC_R, dir: e.cycDir, spin: true, life: 9, maxLife: 9 }); }
    } else if (e.state === 'cyclone') {
        const da = e.cycDir * Math.PI * 2 / (VAL_CYC_TURN * pace) * dt; e.cycA += da; e.cycLeft -= Math.abs(da); e.facingAngle = e.cycA;
        if (curSpd > 0) { e.x += rx / rd * VAL_CYC_DRIFT * dt; e.y += ry / rd * VAL_CYC_DRIFT * dt; }
        const tip = e.spear = valTip(e, VAL_CYC_R - e.size / 2, e.cycA);
        if (Math.random() < 0.5) burst(tip.x, tip.y, e.cycA + e.cycDir * Math.PI / 2 + Math.PI, 0.8, 1, { kind: 'spark', color: '#ffcc80', size: 2, speed: [80, 200], life: 0.25, drag: 5 }); // the blade scoring the deck
        if (Math.random() < 0.35) spawnParticle({ kind: 'smoke', color: 'rgba(150, 140, 125, 0.4)', x: tip.x, y: tip.y, vx: jitter(60), vy: jitter(60), size: 12, grow: 26, life: 0.6, drag: 2, spin: 0, rot: 0 });
        if ((e.cycHalf += Math.abs(da)) >= Math.PI) { e.cycHalf = 0; addShake(1.5); }
        if (!(e.cycHitCd > 0) && distToSegment(player.x, player.y, e.x, e.y, tip.x, tip.y) < R + VAL_CYC_W && valHit(e, VAL_CYC_DMG)) e.cycHitCd = 0.6;
        if (e.cycLeft <= 0) { for (const f of effects) if (f.e === e && f.type === 'val_cyclone') f.life = 0; e.state = 'lunge_rec'; e.aimA = e.cycA; e.stateTimer = 0.5; e.spear = null; } // winded after the spin
    // ---- Skewer Leap ----
    } else if (e.state === 'leap_prep') {
        e.facingAngle = e.aimA = toHero;
        if (e.stateTimer <= 0) {
            valLeapTo(e, 'leap', player.x, player.y, VAL_LEAP_FLIGHT);
            effects.push({ type: 'slam_warn', x: e.lx1, y: e.ly1, radius: VAL_LEAP_R, color: '#ff5252', life: VAL_LEAP_FLIGHT, maxLife: VAL_LEAP_FLIGHT });
        }
    } else if (e.state === 'skewer') { // the spear driven into the deck: he wrenches it free
        e.facingAngle = e.aimA;
        if (e.stateTimer <= 0) valDone(e, e.afterVault ? 0.15 : undefined); // straight into the next move after a vault
    // ---- the King of Thieves: his hall ----
    } else if (e.state === 'chand_prep') { // turned on the chandelier's chain; then the toss (toss_out, cut at e.tossMax)
        e.facingAngle = e.aimA;
        if (e.stateTimer <= 0) { e.state = 'toss_out'; e.spearD = 0; e.hitOut = e.hitBack = false; addShake(1.5); }
    } else if (e.state === 'kick_run') { // a sprint to the far side of a brazier from you
        const B = e.kickB, a = Math.atan2(player.y - B.y, player.x - B.x), sx = B.x - Math.cos(a) * (B.r + e.size / 2 + 6), sy = B.y - Math.sin(a) * (B.r + e.size / 2 + 6);
        const [mx, my, md] = getVector(e.x, e.y, sx, sy), sp = curSpd * VAL_SPRINT_K * dt;
        if (!currentMap.obstacles.includes(B) || e.stateTimer <= 0) { valDone(e); return; } // kicked already, or he couldn't get there
        e.facingAngle = Math.atan2(my, mx);
        if (md > sp) { e.x += mx / md * sp; e.y += my / md * sp; }
        else {
            e.x = sx; e.y = sy; e.kickA = a; valPrep(e, 'kick_prep', VK_KICK_PREP); e.aimA = a;
            const L = kickLane(B, a); // map_castle.js: clipped to the walls
            effects.push({ type: 'charge_lane', x0: B.x, y0: B.y, x1: B.x + Math.cos(a) * L, y1: B.y + Math.sin(a) * L, w: VK_KICK_W, life: VK_KICK_PREP, maxLife: VK_KICK_PREP }); // bandits.js draws the lane
        }
    } else if (e.state === 'kick_prep') { // the boot drawn back; the lane was locked from the start
        e.facingAngle = e.kickA;
        if (e.stateTimer <= 0) { e.kickAt = fxTime; brazierKick(e, e.kickB, e.kickA); e.state = 'lunge_rec'; e.aimA = e.kickA; e.stateTimer = 0.4; } // map_castle.js
    // ---- Unchained ----
    } else if (e.state === 'unchain') {
        const t = VK_UNCHAIN - e.stateTimer, f = valFist(e), P = e.pillar; e.facingAngle = e.aimA;
        if (t > 0.35 && !e.unchained) { e.unchained = true; addShake(4); hitStopTimer = Math.max(hitStopTimer, 0.06); burst(f.x, f.y, 0, Math.PI * 2, 14, { kind: 'spark', color: '#ffe0b2', size: 2.4, speed: [120, 340], life: 0.4, drag: 4 }); } // the chain snaps
        if (P && t > 0.45 && t < 0.85) { const k = (t - 0.45) / 0.4; e.facingAngle = P.a; e.spear = { x: lerp(f.x, P.x, k), y: lerp(f.y, P.y, k), a: P.a }; } // hurled at the pillar
        if (P && t >= 0.85 && !e.stuck) { e.stuck = true; e.spear = null; pillarSpear(P); valImpact(P.x, P.y, 4); } // map_castle.js: it stays there
        if (t > 1.0 && !e.blades) { e.blades = true; e.spear = null; for (const s of [-1, 1]) burst(e.x + Math.cos(e.aimA + s * 1.2) * 20, e.y + Math.sin(e.aimA + s * 1.2) * 20, e.aimA + s * 1.2, 1, 6, { kind: 'spark', color: '#eceff1', size: 2, speed: [80, 220], life: 0.3, drag: 5 }); } // two stolen blades
        if (t > 1.3 && !e.roared) {
            e.roared = true; valImpact(e.x, e.y, 7); hitStopTimer = Math.max(hitStopTimer, 0.1); kingUnchained(); // map_castle.js: the candles gutter
            effects.push({ type: 'slime_shock', x: e.x, y: e.y, radius: 300, color: '#ff5252', life: 0.7, maxLife: 0.7 }, { type: 'slime_shock', x: e.x, y: e.y, radius: 460, color: '#ff1744', life: 1.0, maxLife: 1.0 });
            kingBark(e, 'No more chains. No more games.');
        }
        if (e.stateTimer <= 0) { e.invulnerable = false; valDone(e, 0.3); }
    // ---- Twin Flurry: three dashes, each down its own short lane ----
    } else if (e.state === 'flurry_prep') {
        aimTrack(VK_FLURRY_LOCK);
        if (e.stateTimer <= 0) { e.state = 'flurry'; e.runLeft = VK_FLURRY_RUN; e.hitDone = false; e.sweepAt = fxTime; e.slashSide = -(e.slashSide || 1); effects.push({ type: 'val_slash', e, a: e.aimA, R: e.size / 2 + VK_FLURRY_REACH + 14, half: 0.9, life: 0.2, maxLife: 0.2 }); addShake(1.5); }
    } else if (e.state === 'flurry') {
        e.facingAngle = e.aimA;
        const step = (curSpd > 0 ? VK_FLURRY_SPEED : 0) * dt, nx = e.x + Math.cos(e.aimA) * step, ny = e.y + Math.sin(e.aimA) * step;
        if (step === 0 || (currentMap.grid && solidCell(terrainAt(nx, ny), false))) e.runLeft = 0; else { e.x = nx; e.y = ny; e.runLeft -= step; }
        const tip = valTip(e, VK_FLURRY_REACH, e.aimA);
        if (!e.hitDone && (rd < e.size / 2 + R + 8 || Math.hypot(player.x - tip.x, player.y - tip.y) < R + 8)) { e.hitDone = true; if (valHit(e, VK_FLURRY_DMG)) valShove(e, 40); }
        if (e.runLeft <= 0) {
            if (--e.flurryN > 0) valPrep(e, 'flurry_prep', VK_FLURRY_NEXT, valFlurryLane(e, VK_FLURRY_NEXT));
            else { e.state = 'lunge_rec'; e.stateTimer = VK_FLURRY_REC; } // winded after the third: your opening
        }
    // ---- Cross Cut: an X of two lanes laid on you; both blades cut it at once ----
    } else if (e.state === 'cross_prep') {
        aimTrack(VK_CROSS_LOCK);
        if (e.stateTimer > VK_CROSS_LOCK) { e.crossX = player.x; e.crossY = player.y; }
        if (e.stateTimer <= 0) {
            e.state = 'cross'; e.stateTimer = 0.25; e.sweepAt = fxTime; addShake(4); hitStopTimer = Math.max(hitStopTimer, 0.05);
            effects.push({ type: 'val_cross_flash', x: e.crossX, y: e.crossY, a: e.aimA, L: VK_CROSS_L, w: VK_CROSS_W, life: 0.35, maxLife: 0.35 }); // bandits.js
            let hit = false;
            for (const s of [-1, 1]) { const a = e.aimA + s * Math.PI / 4, dx = player.x - e.crossX, dy = player.y - e.crossY, along = dx * Math.cos(a) + dy * Math.sin(a), perp = -dx * Math.sin(a) + dy * Math.cos(a); if (Math.abs(along) < VK_CROSS_L / 2 + R && Math.abs(perp) < VK_CROSS_W / 2 + R) hit = true; }
            if (hit) valHit(e, VK_CROSS_DMG);
        }
    } else if (e.state === 'cross') {
        e.facingAngle = e.aimA;
        if (e.stateTimer <= 0) { e.state = 'lunge_rec'; e.stateTimer = 0.35; }
    // ---- Cutthroat Step: gone in afterimages, out of the ring behind you ----
    } else if (e.state === 'k_step_prep') {
        if (e.stateTimer > VK_STEP_LOCK) valStepMark(e);
        e.facingAngle = toHero; e.fadeK = clamp01(1 - e.stateTimer / e.prepLen) * 0.85;
        if (e.stateTimer <= 0) {
            burst(e.x, e.y, 0, Math.PI * 2, 10, { kind: 'smoke', color: 'rgba(80, 30, 30, 0.55)', size: 12, speed: [40, 130], life: 0.5, drag: 2, grow: 20 });
            e.x = e.stepX; e.y = e.stepY; clampToBounds(e, e.size / 2); e.fadeK = 0; e.prepLen = 0;
            e.state = 'k_step_in'; e.stateTimer = 0.3; e.sweepAt = fxTime; addShake(3);
            effects.push({ type: 'blade_ring', x: e.stepX, y: e.stepY, R: VK_STEP_R, life: 0.3, maxLife: 0.3 }); // bandits.js
            if (Math.hypot(player.x - e.stepX, player.y - e.stepY) < VK_STEP_R + R) valHit(e, VK_STEP_DMG);
        }
    } else if (e.state === 'k_step_in') {
        e.facingAngle = toHero;
        if (e.stateTimer <= 0) { e.state = 'lunge_rec'; e.stateTimer = 0.35; }
    // ---- Blade Storm: a spinning ring of steel drifting after you ----
    } else if (e.state === 'storm_prep') {
        e.facingAngle = toHero; e.spinA = toHero;
        if (e.stateTimer <= 0) { e.state = 'storm'; e.stateTimer = VK_STORM_T; e.stormHitCd = 0; effects.push({ type: 'val_storm', e, R: VK_STORM_R, spin: true, life: VK_STORM_T, maxLife: VK_STORM_T }); }
    } else if (e.state === 'storm') {
        e.spinA += 15 * dt; e.facingAngle = e.spinA;
        if (curSpd > 0) { e.x += rx / rd * VK_STORM_DRIFT * dt; e.y += ry / rd * VK_STORM_DRIFT * dt; }
        if ((e.stormHitCd -= dt) <= 0 && rd < VK_STORM_R + R && valHit(e, VK_STORM_DMG)) e.stormHitCd = 0.45;
        if (Math.random() < 0.5) burst(e.x + Math.cos(e.spinA) * VK_STORM_R * 0.8, e.y + Math.sin(e.spinA) * VK_STORM_R * 0.8, e.spinA + Math.PI / 2, 0.6, 1, { kind: 'spark', color: '#eceff1', size: 2, speed: [80, 200], life: 0.25, drag: 5 });
        if (e.stateTimer <= 0) { for (const f of effects) if (f.e === e && f.type === 'val_storm') f.life = 0; e.state = 'lunge_rec'; e.aimA = toHero; e.stateTimer = 0.5; } // dizzy for a moment
    }
};

// ---------- The Royal Guard (wave 16, map_castle.js): three champions fought together while Valerius watches ----------
// Boss types (boss_champ_*), so boss rules apply; they share one HUD bar (e.champion, cst.guardMax). Every wind-up is the
// garrison's (garPrep / gar_tell: exactly as wide as the hit). When one falls the others rally (map_castle.js
// championFell sets e.rally): they move faster and wait less between moves; the telegraphs keep their length.
//  Gorran, the Iron Warden: a tower shield (Bulwark: blows from the front glance off while it's up, combat.js) and a
//    halberd: Halberd Sweep (a wide wedge), Shield Charge (a lane; rams a wall and he's dazed).
//  Sable, the Royal Blade: twin daggers. Shadow Step (a ring behind you: she's there when it locks), Fan of Knives
//    (five lanes), a quick cut up close, and Smoke Bomb (gone in smoke, out of reach, back somewhere else).
//  Corvin, the Crossbow Captain: keeps his distance. Piercing Bolt (a long lane that locks), Bolt Rain (marks round you,
//    bolts coming down a second later), a firepot when you crowd him.
const CH_SPD = [1, 1.15, 1.3], CH_GAP = [1, 0.75, 0.55], CH_TOUCH = 0.6; // by how many of the guard have fallen
const WARDEN_HOLD = 95, WARDEN_TURN = 2.0, WARDEN_GUARD = 0.3, WARDEN_ARC = 1.05, WARDEN_GAP = 1.2, WARDEN_LOCK = 0.22; // Bulwark: hits within WARDEN_ARC of his shield deal x WARDEN_GUARD
const WARDEN_SWEEP_T = 0.8, WARDEN_SWEEP_R = 125, WARDEN_SWEEP_HALF = 1.1, WARDEN_SWEEP_DMG = 1.6;
const WARDEN_CHARGE_T = 0.95, WARDEN_CHARGE_LOCK = 0.3, WARDEN_CHARGE_L = 420, WARDEN_CHARGE_SPEED = 950, WARDEN_CHARGE_DMG = 1.8, WARDEN_DAZE = 1.2, WARDEN_CHARGE_CD = 5;
const BLADE_STEP_T = 0.85, BLADE_STEP_LOCK = 0.35, BLADE_STEP_BEHIND = 55, BLADE_STEP_R = 70, BLADE_STEP_DMG = 1.5, BLADE_STEP_CD = 4.5;
const BLADE_FAN_T = 0.6, BLADE_FAN_LOCK = 0.2, BLADE_FAN_N = 5, BLADE_FAN_HALF = 0.4, BLADE_FAN_SPEED = 720, BLADE_FAN_L = 480, BLADE_FAN_W = 12, BLADE_FAN_DMG = 0.7;
const BLADE_CUT_T = 0.4, BLADE_CUT_R = 58, BLADE_CUT_HALF = 0.95, BLADE_CUT_DMG = 1.0, BLADE_SMOKE_T = 1.3, BLADE_SMOKE_CD = 10, BLADE_NEAR = 150, BLADE_FAR = 270, BLADE_GAP = 0.8;
const CAPT_AIM = 1.1, CAPT_LOCK = 0.35, CAPT_SPEED = 1300, CAPT_RANGE = 1100, CAPT_W = 16, CAPT_DMG = 1.8, CAPT_RELOAD = 1.4;
const CAPT_RAIN_T = 0.8, CAPT_RAIN_N = 6, CAPT_RAIN_SPREAD = 170, CAPT_RAIN_R = 36, CAPT_RAIN_WARN = 1.0, CAPT_RAIN_DMG = 0.6, CAPT_RAIN_CD = 7;
const CAPT_POT_T = 0.6, CAPT_POT_CD = 6, CAPT_NEAR = 320, CAPT_FAR = 540, CAPT_GAP = 1.0;

// Shared by all three: timers, contact, a wind-up lost to a stun or a freeze. Returns false while held fast.
function champTick(e, dt, rd) {
    e.stateTimer -= dt;
    for (const k in e.cd) if (e.cd[k] > 0) e.cd[k] -= dt;
    const held = e.frozenTimer > 0 || e.stunTimer > 0;
    if (held && e.prepLen) { e.state = null; e.prepLen = 0; e.stateTimer = 0.5; e.fadeK = 0; } // the attack is lost: nothing lands after its telegraph ran out
    if (!e.submerged && rd < e.size / 2 + player.radius + 4 && e.meleeTimer <= 0) { takeDamage(e.dmg * CH_TOUCH); e.meleeTimer = 1.0; }
    return !held;
}
const champGap = (e, base) => base * CH_GAP[e.rally || 0] * (0.8 + Math.random() * 0.4);
const champWalk = (e, dt, sp, edx, edy, edist, sign = 1) => { if (sp > 0 && edist > 0 && edist !== Infinity) { e.x += edx / edist * sp * dt * sign; e.y += edy / edist * sp * dt * sign; } };
const champHit = (e, mult) => { if (player.z > 4) return false; const hp0 = player.hp, sh0 = player.shield || 0; takeDamage(e.dmg * mult); return player.hp < hp0 || (player.shield || 0) < sh0; };

// Gorran: slow, the shield always toward you; it turns slower than you can circle, so flank him or wait for a swing
var WardenAI = (e, dt, curSpd, edx, edy, edist, i) => {
    const rd = Math.hypot(player.x - e.x, player.y - e.y), toHero = Math.atan2(player.y - e.y, player.x - e.x), R = player.radius;
    e.cd = e.cd || { charge: 2 };
    const free = champTick(e, dt, rd), sp = curSpd * CH_SPD[e.rally || 0];
    if (e.guardA === undefined) e.guardA = toHero;
    const sweepR = e.size / 2 + WARDEN_SWEEP_R;
    e.guarding = !e.state || e.state === 'charge_prep' || e.state === 'charge' || e.state === 'sweep_prep';
    if (e.state === 'sweep_prep' || e.state === 'charge_prep') {
        garAim(e, e.state === 'sweep_prep' ? WARDEN_LOCK : WARDEN_CHARGE_LOCK); e.guardA = e.aimA;
        if (e.stateTimer > 0) return;
        e.prepLen = 0;
        if (e.state === 'sweep_prep') { // the halberd comes round across the wedge
            e.state = 'sweep'; e.stateTimer = 0.22; e.swingAt = fxTime; addShake(2.5);
            effects.push({ type: 'val_slash', e, a: e.aimA, R: sweepR, half: WARDEN_SWEEP_HALF, life: 0.26, maxLife: 0.26 }); // bandits.js: the crescent
            let off = toHero - e.aimA; while (off > Math.PI) off -= Math.PI * 2; while (off < -Math.PI) off += Math.PI * 2;
            if (rd < sweepR + R && Math.abs(off) < WARDEN_SWEEP_HALF + R / Math.max(rd, 20) && champHit(e, WARDEN_SWEEP_DMG)) garShove(e, 70);
        } else { e.state = 'charge'; e.runLeft = WARDEN_CHARGE_L; e.hitDone = false; valImpact(e.x, e.y, 2.5); }
        return;
    }
    if (e.state === 'charge') { // behind the shield down the lane; a wall stops him dead and rings his helm
        e.facingAngle = e.guardA = e.aimA;
        const step = Math.min(e.runLeft, (curSpd > 0 ? WARDEN_CHARGE_SPEED : 0) * dt), nx = e.x + Math.cos(e.aimA) * step, ny = e.y + Math.sin(e.aimA) * step;
        const wall = currentMap.grid && solidCell(terrainAt(nx + Math.cos(e.aimA) * e.size / 2, ny + Math.sin(e.aimA) * e.size / 2), false);
        if (step === 0 || wall || (currentMap.obstacles || []).some(o => o.kind !== 'keg' && Math.hypot(nx - o.x, ny - o.y) < o.r + e.size / 2)) {
            e.runLeft = 0;
            if (wall || step > 0) { e.state = 'dazed'; e.stateTimer = WARDEN_DAZE; valImpact(e.x + Math.cos(e.aimA) * e.size / 2, e.y + Math.sin(e.aimA) * e.size / 2, 5); effects.push({ type: 'text', text: 'Dazed!', x: e.x, y: e.y - e.size / 2 - 16, color: '#ffeb3b', life: 0.9, maxLife: 0.9 }); return; }
        } else { e.x = nx; e.y = ny; e.runLeft -= step; }
        if (Math.random() < 0.6) spawnParticle({ kind: 'smoke', color: 'rgba(150, 140, 125, 0.45)', x: e.x - Math.cos(e.aimA) * 24 + jitter(14), y: e.y - Math.sin(e.aimA) * 24 + jitter(14), vx: jitter(50), vy: jitter(50), size: 11, grow: 26, life: 0.55, drag: 2, spin: 0, rot: 0 });
        if (!e.hitDone && rd < e.size / 2 + 8 + R) { // his body and shield: the lane's width (e.size + 16)
            e.hitDone = true; if (champHit(e, WARDEN_CHARGE_DMG)) { valImpact(player.x, player.y, 4); garShove(e, 120); }
        }
        if (e.runLeft <= 0) { e.state = 'recover'; e.stateTimer = 0.5; }
        return;
    }
    if (e.state === 'sweep') { e.facingAngle = e.aimA; if (e.stateTimer <= 0) { e.state = 'recover'; e.stateTimer = 0.6; } return; }
    if (e.state === 'recover' || e.state === 'dazed') { // the shield's down: his opening
        e.facingAngle = e.guardA = e.aimA;
        if (e.state === 'dazed' && Math.random() < 0.08) spawnParticle({ kind: 'spark', color: '#fff59d', x: e.x + jitter(12), y: e.y - e.size / 2 - 6 + jitter(4), vx: jitter(30), vy: -20, size: 2, life: 0.4, drag: 2, grow: 0, spin: 0, rot: 0 });
        if (e.stateTimer <= 0) { e.state = null; e.stateTimer = champGap(e, WARDEN_GAP); }
        return;
    }
    // stalking: the shield turns after you at WARDEN_TURN rad/s
    let d = toHero - e.guardA; while (d > Math.PI) d -= Math.PI * 2; while (d < -Math.PI) d += Math.PI * 2;
    e.guardA += Math.sign(d) * Math.min(Math.abs(d), WARDEN_TURN * dt); e.facingAngle = e.guardA;
    if (rd > WARDEN_HOLD) champWalk(e, dt, sp, edx, edy, edist); else if (rd < WARDEN_HOLD - 40) champWalk(e, dt, sp * 0.5, edx, edy, edist, -1);
    if (!free || e.stateTimer > 0 || curSpd <= 0) return;
    const clear = !currentMap.grid || walkClear(e.x, e.y, player.x, player.y);
    if (rd < sweepR + 10 && clear) garPrep(e, 'sweep_prep', WARDEN_SWEEP_T, { kind: 'wedge', R: sweepR, half: WARDEN_SWEEP_HALF, lock: WARDEN_LOCK });
    else if (rd > 180 && rd < WARDEN_CHARGE_L && !(e.cd.charge > 0) && clear) { e.cd.charge = WARDEN_CHARGE_CD; garPrep(e, 'charge_prep', WARDEN_CHARGE_T, { kind: 'lane', len: WARDEN_CHARGE_L + e.size / 2, w: e.size + 16, lock: WARDEN_CHARGE_LOCK }); }
};
// combat.js applyDamage: Bulwark. A blow from in front of the raised shield glances off (x WARDEN_GUARD)
function wardenBulwark(e, amount) {
    if (!e.guarding) return amount;
    let d = Math.atan2(player.y - e.y, player.x - e.x) - e.guardA; while (d > Math.PI) d -= Math.PI * 2; while (d < -Math.PI) d += Math.PI * 2;
    if (Math.abs(d) > WARDEN_ARC) return amount;
    if (!(e.blockFxAt > fxTime - 0.25)) { // the shield rings; not for every tick of a multi-hit
        e.blockFxAt = fxTime;
        const sx = e.x + Math.cos(e.guardA) * e.size * 0.5, sy = e.y + Math.sin(e.guardA) * e.size * 0.5;
        burst(sx, sy, e.guardA + d, 1.4, 6, { kind: 'spark', color: '#ffe0b2', size: 2.2, speed: [120, 280], life: 0.25, drag: 5 });
        effects.push({ type: 'text', text: 'Blocked', x: e.x, y: e.y - e.size / 2 - 14, color: '#b0bec5', life: 0.6, maxLife: 0.6 });
    }
    return amount * WARDEN_GUARD;
}

// Sable: never still, a knife's throw off you; she steps behind you, throws fans, and vanishes in smoke when cornered
var BladeAI = (e, dt, curSpd, edx, edy, edist, i) => {
    const rd = Math.hypot(player.x - e.x, player.y - e.y), toHero = Math.atan2(player.y - e.y, player.x - e.x), R = player.radius;
    e.cd = e.cd || { step: 2, smoke: 5 };
    const free = champTick(e, dt, rd), sp = curSpd * CH_SPD[e.rally || 0];
    e.ghosting = e.state === 'step_in';
    if (e.state === 'smoke') { // gone: out of reach until she's back
        e.fadeK = Math.min(1, (e.fadeK || 0) + dt / 0.2);
        if (e.stateTimer <= 0) {
            const a = Math.random() * Math.PI * 2, d = 230 + Math.random() * 90;
            let x = player.x + Math.cos(a) * d, y = player.y + Math.sin(a) * d;
            if (currentMap.grid) { const cl = clipToWalls(player.x, player.y, x, y, e.size, false); if (cl) [x, y] = cl; }
            e.x = x; e.y = y; clampToBounds(e, e.size / 2); e.submerged = false; e.fadeK = 0; e.state = null; e.stateTimer = 0.25;
            burst(e.x, e.y, 0, Math.PI * 2, 12, { kind: 'smoke', color: 'rgba(60, 50, 64, 0.65)', size: 14, speed: [40, 140], life: 0.7, drag: 2, grow: 26 });
        }
        return;
    }
    if (e.state === 'step_prep') { // the ring behind you follows until it locks; she melts into the dark
        if (e.stateTimer > BLADE_STEP_LOCK) { // never inside a wall: the mark stops short of it
            const a = Math.atan2(player.y - e.y, player.x - e.x); e.stepX = player.x + Math.cos(a) * BLADE_STEP_BEHIND; e.stepY = player.y + Math.sin(a) * BLADE_STEP_BEHIND;
            if (currentMap.grid) { const cl = clipToWalls(player.x, player.y, e.stepX, e.stepY, e.size / 2, false); if (cl) [e.stepX, e.stepY] = cl; }
        }
        e.facingAngle = toHero; e.fadeK = clamp01(1 - e.stateTimer / e.prepLen) * 0.7;
        if (e.stateTimer <= 0) {
            burst(e.x, e.y, 0, Math.PI * 2, 8, { kind: 'smoke', color: 'rgba(60, 50, 64, 0.6)', size: 11, speed: [40, 120], life: 0.5, drag: 2, grow: 20 });
            e.x = e.stepX; e.y = e.stepY; clampToBounds(e, e.size / 2); e.fadeK = 0; e.prepLen = 0;
            e.state = 'step_in'; e.stateTimer = 0.25; e.swingAt = fxTime; addShake(2.5);
            effects.push({ type: 'blade_ring', x: e.stepX, y: e.stepY, R: BLADE_STEP_R, life: 0.3, maxLife: 0.3 }); // bandits.js: the cut round her
            if (Math.hypot(player.x - e.stepX, player.y - e.stepY) < BLADE_STEP_R + R && champHit(e, BLADE_STEP_DMG)) burst(player.x, player.y, 0, Math.PI * 2, 10, { kind: 'spark', color: '#ffcdd2', size: 2.2, speed: [120, 300], life: 0.3, drag: 5 });
        }
        return;
    }
    if (e.state === 'fan_prep') {
        garAim(e, BLADE_FAN_LOCK);
        if (e.stateTimer > 0) return;
        for (let k = 0; k < BLADE_FAN_N; k++) {
            const a = e.aimA + (k / (BLADE_FAN_N - 1) - 0.5) * 2 * BLADE_FAN_HALF, ox = e.x + Math.cos(a) * e.size / 2, oy = e.y + Math.sin(a) * e.size / 2;
            projectiles.push({ x: ox, y: oy, vx: Math.cos(a) * BLADE_FAN_SPEED, vy: Math.sin(a) * BLADE_FAN_SPEED, radius: BLADE_FAN_W / 2, life: BLADE_FAN_L / BLADE_FAN_SPEED, isEnemy: true, owner: e, damage: e.dmg * BLADE_FAN_DMG, shape: 'knife' });
        }
        e.state = 'recover'; e.prepLen = 0; e.stateTimer = 0.35; e.threwAt = fxTime;
        return;
    }
    if (e.state === 'cut_prep') {
        garAim(e, 0.12);
        if (e.stateTimer > 0) return;
        e.state = 'cut'; e.prepLen = 0; e.stateTimer = 0.2; e.swingAt = fxTime; addShake(1.5);
        const cutR = e.size / 2 + BLADE_CUT_R;
        effects.push({ type: 'val_slash', e, a: e.aimA, R: cutR, half: BLADE_CUT_HALF, life: 0.2, maxLife: 0.2 });
        let off = toHero - e.aimA; while (off > Math.PI) off -= Math.PI * 2; while (off < -Math.PI) off += Math.PI * 2;
        if (rd < cutR + R && Math.abs(off) < BLADE_CUT_HALF + R / Math.max(rd, 20)) champHit(e, BLADE_CUT_DMG);
        return;
    }
    if (e.state === 'step_in' || e.state === 'cut' || e.state === 'recover') {
        e.facingAngle = toHero;
        if (e.stateTimer <= 0) { e.state = null; e.stateTimer = champGap(e, BLADE_GAP); }
        return;
    }
    // circling at a knife's throw, the way round changing now and then
    e.facingAngle = toHero;
    if (!e.circle || Math.random() < dt * 0.4) e.circle = Math.random() < 0.5 ? -1 : 1;
    if (sp > 0 && edist > 0 && edist !== Infinity) {
        let mx = edx / edist, my = edy / edist;
        if (rd < BLADE_FAR + 60 && (!currentMap.grid || walkClear(e.x, e.y, player.x, player.y))) { const pull = rd < BLADE_NEAR ? -0.8 : rd > BLADE_FAR ? 0.6 : 0, rx = (player.x - e.x) / (rd || 1), ry = (player.y - e.y) / (rd || 1); mx = -ry * e.circle + rx * pull; my = rx * e.circle + ry * pull; }
        const ml = Math.hypot(mx, my) || 1, nx = e.x + mx / ml * sp * dt, ny = e.y + my / ml * sp * dt;
        if (!(currentMap.grid && solidCell(terrainAt(nx, ny), false))) { e.x = nx; e.y = ny; } else e.circle = -e.circle;
    }
    if (!free || e.stateTimer > 0 || curSpd <= 0) return;
    if (e.hpAt === undefined) e.hpAt = e.hp; // her HP when her last move began
    if (e.cd.smoke <= 0 && (e.hpAt - e.hp > e.maxHp * 0.08 || rd < 90)) { // pressed hard, or cornered: smoke
        e.cd.smoke = BLADE_SMOKE_CD; e.hpAt = e.hp; e.state = 'smoke'; e.stateTimer = BLADE_SMOKE_T; e.submerged = true; e.fadeK = 0;
        effects.push({ type: 'smoke_bomb', x: e.x, y: e.y, life: 1.6, maxLife: 1.6 }); // bandits.js
        burst(e.x, e.y, 0, Math.PI * 2, 18, { kind: 'smoke', color: 'rgba(60, 50, 64, 0.7)', size: 18, speed: [40, 180], life: 1.0, drag: 2, grow: 34 });
        return;
    }
    const clear = !currentMap.grid || walkClear(e.x, e.y, player.x, player.y), hp0 = e.hp;
    if (rd < e.size / 2 + BLADE_CUT_R + 10 && clear) garPrep(e, 'cut_prep', BLADE_CUT_T, { kind: 'wedge', R: e.size / 2 + BLADE_CUT_R, half: BLADE_CUT_HALF, lock: 0.12 });
    else if (e.cd.step <= 0 && rd < 420) { e.cd.step = BLADE_STEP_CD; e.stepX = player.x + Math.cos(toHero) * BLADE_STEP_BEHIND; e.stepY = player.y + Math.sin(toHero) * BLADE_STEP_BEHIND; garPrep(e, 'step_prep', BLADE_STEP_T, { kind: 'ring', R: BLADE_STEP_R, lock: BLADE_STEP_LOCK }); }
    else if (rd < BLADE_FAN_L - 60 && shotClear(e.x, e.y, player.x, player.y)) garPrep(e, 'fan_prep', BLADE_FAN_T, { kind: 'fan', len: BLADE_FAN_L, w: BLADE_FAN_W, n: BLADE_FAN_N, half: BLADE_FAN_HALF, lock: BLADE_FAN_LOCK, air: true });
    if (e.state) e.hpAt = hp0;
};

// Corvin: backs off to a crossbow's range; a bolt down a long lane, a rain of bolts round you, a firepot if you close in
var CaptainAI = (e, dt, curSpd, edx, edy, edist, i) => {
    const rd = Math.hypot(player.x - e.x, player.y - e.y), toHero = Math.atan2(player.y - e.y, player.x - e.x);
    e.cd = e.cd || { rain: 3, pot: 2 };
    const free = champTick(e, dt, rd), sp = curSpd * CH_SPD[e.rally || 0];
    e.kneelK = (e.kneelK || 0) + ((e.state === 'aim' ? 1 : 0) - (e.kneelK || 0)) * Math.min(1, 12 * dt);
    if (e.state === 'aim') {
        garAim(e, CAPT_LOCK);
        if (e.stateTimer > 0) return;
        const ux = Math.cos(e.aimA), uy = Math.sin(e.aimA), o = e.size / 2 + 4;
        projectiles.push({ x: e.x + ux * o, y: e.y + uy * o, vx: ux * CAPT_SPEED, vy: uy * CAPT_SPEED, radius: CAPT_W / 2, life: (CAPT_RANGE - o) / CAPT_SPEED, isEnemy: true, owner: e, damage: e.dmg * CAPT_DMG, shape: 'bolt', pierceArmor: true });
        burst(e.x + ux * o, e.y + uy * o, e.aimA, 0.5, 5, { kind: 'spark', color: '#ffe0b2', size: 2, speed: [120, 280], life: 0.2, drag: 5 }); addShake(1.5);
        e.state = null; e.prepLen = 0; e.shotAt = fxTime; e.stateTimer = champGap(e, CAPT_GAP) + CAPT_RELOAD;
        return;
    }
    if (e.state === 'rain_prep') { // the bow raised high: a bolt loosed skyward, and five more after it
        e.facingAngle = toHero;
        if (e.stateTimer > 0) return;
        e.prepLen = 0; e.state = null; e.stateTimer = champGap(e, CAPT_GAP); e.shotAt = fxTime;
        const ang = Math.random() * Math.PI * 2;
        for (let k = 0; k < CAPT_RAIN_N; k++) {
            const a = ang + k / (CAPT_RAIN_N - 1) * Math.PI * 2, d = k ? CAPT_RAIN_SPREAD * (0.45 + 0.55 * Math.random()) : 0;
            let x = player.x + Math.cos(a) * d, y = player.y + Math.sin(a) * d;
            if (currentMap.grid && solidCell(terrainAt(x, y), true)) { x = player.x; y = player.y; }
            effects.push({ type: 'bolt_rain', x, y, r: CAPT_RAIN_R, warn: CAPT_RAIN_WARN, dmg: e.dmg * CAPT_RAIN_DMG, seed: Math.random() * 10, life: CAPT_RAIN_WARN + 1.6, maxLife: CAPT_RAIN_WARN + 1.6 }); // map_castle.js lands them
            effects.push({ type: 'slam_warn', x, y, radius: CAPT_RAIN_R, color: '#ff7043', life: CAPT_RAIN_WARN, maxLife: CAPT_RAIN_WARN });
        }
        return;
    }
    if (e.state === 'windup') { // a firepot lit and lobbed at your feet (the grenadier's, ai.js grenadierThrow)
        e.facingAngle = toHero;
        if (e.stateTimer <= 0) { grenadierThrow(e); e.state = null; e.prepLen = 0; e.stateTimer = champGap(e, CAPT_GAP) * 0.7; e.thrownAt = fxTime; }
        return;
    }
    e.facingAngle = toHero;
    const reloading = e.shotAt !== undefined && fxTime - e.shotAt < CAPT_RELOAD;
    garKeep(e, dt, sp, edx, edy, edist, CAPT_NEAR, CAPT_FAR, reloading ? 0.7 : 1);
    if (!free || e.stateTimer > 0 || curSpd <= 0) return;
    if (rd < CAPT_NEAR - 60 && e.cd.pot <= 0 && shotClear(e.x, e.y, player.x, player.y)) { e.cd.pot = CAPT_POT_CD; garPrep(e, 'windup', CAPT_POT_T, null); }
    else if (e.cd.rain <= 0 && rd < 800) { e.cd.rain = CAPT_RAIN_CD; garPrep(e, 'rain_prep', CAPT_RAIN_T, null); }
    else if (rd < CAPT_RANGE - 100 && shotClear(e.x, e.y, player.x, player.y)) garPrep(e, 'aim', CAPT_AIM, { kind: 'lane', len: CAPT_RANGE, w: CAPT_W, lock: CAPT_LOCK, air: true });
};

const UNDERTOW_WARN = 0.65; // the Amalgam's Undertow: warning ring before it erupts under you (1 s was too easy to walk out of, 0.5 too tight)

var EnemyAI = {
    'slime_melee': MeleeAI, 'thief': ThiefAI, 'shield': ShieldAI, 'voltaic_ooze': MeleeAI, 'toxic_sludge': MeleeAI, 'queen_guard': MeleeAI,
    'slime_ranged': RangedAI, 'archer': RangedAI,
    
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
    'crossbow': CrossbowAI, 'halberd': HalberdAI, 'grenadier': GrenadierAI, 'cutpurse': CutpurseAI, // the Bastion's garrison (above)
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
    'boss_valerius': ValeriusAI, // the duel on the bridge (above)
    'boss_champ_warden': WardenAI, 'boss_champ_blade': BladeAI, 'boss_champ_captain': CaptainAI, // the Royal Guard (above)
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