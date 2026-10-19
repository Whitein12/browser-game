// ==========================================
// machinist.js - The Machinist's web (CLASS_WEBS.md; talents in talents.js TALENT_WEBS.machinist)
// ==========================================
// Q Sentry Turret (skills.js spawnTurret builds it; maTurretTick runs the evolved ones): A Flame Turret (a cone that sets
// enemies burning) / B Sniper Turret (900 px, the toughest enemy, a x4 beam). E Tesla Coil (maCoil): A High Voltage /
// B Arc Network. Space Magnetic Grapple (maGrapple): A Crash Landing / B Decoy Projection. R Overclock Protocol (maOverclock):
// A Exo-Frame (ma.exo: a minigun scattergun, rockets, 30% less damage) / B Orbital Strike (ma.orbital: a beam from the sky
// that follows the cursor). Tesla Turret, Overload, Conductive Net and Lightning Rod (combos.js) work with all of them.

const ma = { exo: null, orbital: null, mines: [], decoy2: null };
function resetMachinist() { ma.exo = ma.orbital = ma.decoy2 = null; ma.mines.length = 0; }
const maLive = e => !e.dead && !e.pod && !e.prop && !e.submerged && !(e.spawnT > 0);

// ---------- Q: the evolved turrets (skills.js spawnTurret's update hands them here) ----------

function maTurretTick(t, dt) {
    if (t.flame) {
        const wide = hasTalent('ma_flame_wide'), R = wide ? 240 : 180, half = wide ? 0.6 : 0.45, target = getNearestEnemyFromPoint(t.x, t.y, R);
        if (!target) return;
        t.angle = Math.atan2(target.y - t.y, target.x - t.x);
        if (t.attackTimer > 0) return;
        t.attackTimer = 0.2;
        const mult = teslaShot(t, target, 0); // combos.js Tesla Turret
        effects.push({ type: 'sw_cone', x: t.x + Math.cos(t.angle) * 14, y: t.y + Math.sin(t.angle) * 14, angle: t.angle, radius: R, half, color: '#ff7043', life: 0.2, maxLife: 0.2 }); // spellweaver_evo.js draws it
        for (const e of enemies) {
            if (e.dead || e.submerged) continue;
            const d = Math.hypot(e.x - t.x, e.y - t.y);
            if (d > R + e.size / 2 || Math.abs(Math.atan2(Math.sin(Math.atan2(e.y - t.y, e.x - t.x) - t.angle), Math.cos(Math.atan2(e.y - t.y, e.x - t.x) - t.angle))) > half + Math.atan2(e.size / 2, Math.max(d, 1))) continue;
            applyDamage(e, t.damage * 0.35 * mult, 'magic');
            if (!e.dead) igniteEnemy(e, t.damage * 0.3);
        }
        if (hasTalent('ma_flame_napalm') && (t.napT = (t.napT || 0) - 0.2) <= 0) { // Napalm: burning ground where it sprays
            t.napT = 0.8;
            effects.push({ type: 'fire_puddle', x: target.x, y: target.y, radius: 45, color: 'rgba(255, 87, 34, 0.3)', life: 2, maxLife: 2, dmg: t.damage * 0.5 });
        }
        return;
    }
    // Sniper: the toughest enemy in reach, a beam every 2 s
    let target = null;
    for (const e of enemies) if (maLive(e) && Math.hypot(e.x - t.x, e.y - t.y) < 900 && (!target || e.hp > target.hp)) target = e;
    if (!target) return;
    t.angle = Math.atan2(target.y - t.y, target.x - t.x);
    if (t.attackTimer > 0) return;
    t.attackTimer = hasTalent('ma_snipe_load') ? 1.4 : 2;
    t.shots = (t.shots || 0) + 1;
    const head = hasTalent('ma_snipe_head') && t.shots % 3 === 0, hit = t.damage * 4 * (head ? 3 : 1) * teslaShot(t, target, 0);
    const x1 = t.x + Math.cos(t.angle) * 18, y1 = t.y + Math.sin(t.angle) * 18;
    let x2 = t.x + Math.cos(t.angle) * 900, y2 = t.y + Math.sin(t.angle) * 900;
    const wall = clipToWalls(x1, y1, x2, y2, 0, true); if (wall) [x2, y2] = wall;
    effects.push({ type: 'laser_beam', x1, y1, x2: hasTalent('ma_snipe_rail') ? x2 : target.x, y2: hasTalent('ma_snipe_rail') ? y2 : target.y, life: 0.25, maxLife: 0.25 });
    const hits = hasTalent('ma_snipe_rail') ? enemies.filter(e => !e.dead && !e.submerged && distToSegment(e.x, e.y, x1, y1, x2, y2) < e.size / 2 + 8) : [target]; // Rail: everything on the line
    for (const e of hits) {
        applyDamage(e, hit, 'magic');
        if (e.dead) continue;
        if (hasTalent('ma_snipe_mark')) e.maSightUntil = fxTime + 2.5; // Laser Sight
        if (head && !isBossE(e)) e.stunTimer = Math.max(e.stunTimer || 0, 1); // Headshot
    }
    if (head) effects.push({ type: 'text', text: 'HEADSHOT', x: target.x, y: target.y - 40, color: '#ff5252', life: 0.7, maxLife: 0.7 });
    addShake(head ? 2 : 0.8);
}
function maInfernoCore(t) { // main.js, a Flame Turret running out: Inferno Core
    effects.push({ type: 'fiery_explosion', x: t.x, y: t.y, radius: 200, life: 0.5, maxLife: 0.5 });
    for (const e of enemies) if (!e.dead && Math.hypot(e.x - t.x, e.y - t.y) < e.size / 2 + 200) { applyDamage(e, t.damage * 3, 'magic'); if (!e.dead) igniteEnemy(e, t.damage * 0.5); }
    addShake(3);
}

// ---------- E: Tesla Coil ----------

function maCoil(sk, dmg) {
    const [dx, dy, dist] = getVector(player.x, player.y, mouseX, mouseY), d = Math.min(dist, 400);
    const A = sk.selectedUpg === 'A', B = sk.selectedUpg === 'B', R = (A ? 200 : 150) * (hasTalent('ma_coil_wide') ? 1.3 : 1);
    const coils = projectiles.filter(p => p.type === 'tesla_coil_trap'), cap = B && hasTalent('ma_arc_grid') ? 2 : 1; // Grid: a second coil
    while (coils.length >= cap) { const old = coils.shift(); projectiles.splice(projectiles.indexOf(old), 1); }
    projectiles.push({
        x: player.x + dx / (dist || 1) * d, y: player.y + dy / (dist || 1) * d, vx: 0, vy: 0, radius: 15, color: '#00e5ff', life: 8 + (hasTalent('ma_coil_long') ? 3 : 0), type: 'tesla_coil_trap',
        damage: dmg, isEnemy: false, tickTimer: 0, rooted: new Map(), fieldRadius: R, bornAt: fxTime, hv: A, net: B,
        customUpdate: function (dt) { rideCoil(this); maCoilTick(this, dt); }, // combos.js Conductive Net: latched onto a netted enemy, it goes where it goes
    });
    coilPlaced(projectiles[projectiles.length - 1]); // combos.js: onto a netted enemy (Conductive Net) or a turret (Tesla Turret)
}
function maCoilTick(c, dt) {
    const R = c.fieldRadius;
    if (c.hv && hasTalent('ma_hv_pull')) for (const e of enemies) { // Magnetic Field
        if (!maLive(e) || isBossE(e)) continue;
        const dx = c.x - e.x, dy = c.y - e.y, d = Math.hypot(dx, dy);
        if (d < R + e.size / 2 && d > 20) { e.x += dx / d * 60 * dt; e.y += dy / d * 60 * dt; clampToBounds(e, e.size / 2); }
    }
    if ((c.tickTimer -= dt) > 0) return;
    c.tickTimer = 0.5;
    effects.push({ type: 'tesla_pulse', x: c.x, y: c.y, radius: R, life: 0.3, maxLife: 0.3 });
    let zaps = 0;
    for (const e of enemies) {
        if (e.dead || Math.hypot(e.x - c.x, e.y - c.y) > R + e.size / 2) continue;
        if (zaps++ < 5) effects.push({ type: 'lightning', x1: c.x, y1: c.y, x2: e.x, y2: e.y, color: '#00e5ff', life: 0.15, maxLife: 0.15 });
        applyDamage(e, c.damage * (c.hv && hasTalent('ma_hv_shock') && e.rootedTimer > 0 ? 1.5 : 1), 'magic'); // Overload Arc
        e.shockTimer = 0.6;
        if (c.hv) { // High Voltage: a root when it first enters; Recharge roots it again every 3 s
            const last = c.rooted.get(e);
            if (last === undefined || (hasTalent('ma_hv_reroot') && fxTime - last >= 3)) { e.rootedTimer = Math.max(e.rootedTimer || 0, 1); c.rooted.set(e, fxTime); }
        }
    }
    if (c.hv && hasTalent('ma_hv_storm')) // Static Storm: the pulse leaps to 3 enemies outside the field
        enemies.filter(e => maLive(e) && Math.hypot(e.x - c.x, e.y - c.y) > R + e.size / 2 && Math.hypot(e.x - c.x, e.y - c.y) < R + 260)
            .sort((a, b) => Math.hypot(a.x - c.x, a.y - c.y) - Math.hypot(b.x - c.x, b.y - c.y)).slice(0, 3)
            .forEach(e => { effects.push({ type: 'lightning', x1: c.x, y1: c.y, x2: e.x, y2: e.y, color: '#80d8ff', life: 0.2, maxLife: 0.2 }); applyDamage(e, c.damage * 0.6, 'magic'); });
    if (!c.net) return;
    const reach = hasTalent('ma_arc_long') ? 600 : 400; // Arc Network: lines to the turrets (and, with Grid, the other coil)
    const links = projectiles.filter(t => (t.type === 'turret' || (t.type === 'tesla_coil_trap' && t !== c && t.bornAt < c.bornAt && hasTalent('ma_arc_grid'))) && Math.hypot(t.x - c.x, t.y - c.y) < reach);
    for (const t of links) {
        effects.push({ type: 'lightning', x1: c.x, y1: c.y, x2: t.x, y2: t.y, color: '#00e5ff', life: 0.2, maxLife: 0.2 });
        if (t.type === 'turret' && hasTalent('ma_arc_charge')) t.linkedUntil = fxTime + 0.6; // Supercharge
        for (const e of enemies) {
            if (e.dead || distToSegment(e.x, e.y, c.x, c.y, t.x, t.y) > e.size / 2 + 20) continue;
            applyDamage(e, c.damage * 0.5, 'magic'); // half a pulse per line
            if (hasTalent('ma_arc_web') && !e.dead && !(e.maWebCd > fxTime)) { e.rootedTimer = Math.max(e.rootedTimer || 0, 0.5); e.maWebCd = fxTime + 3; } // Lightning Web
        }
    }
}

// ---------- Space: Magnetic Grapple ----------

function maGrapple(sk, dmg) {
    let tx = mouseX, ty = mouseY, anchor = null; // anchor: the turret or coil it latches onto (combos.js Overload)
    for (const p of projectiles) if ((p.type === 'turret' || p.type === 'tesla_coil_trap') && Math.hypot(p.x - mouseX, p.y - mouseY) < 50) { tx = p.x; ty = p.y; anchor = p; break; }
    if (!anchor && !hasTalent('ma_grapple_far')) cooldowns.s3 += grappleMissPenalty(sk.level); // ranks: a smaller penalty for open ground; Long Cable: none
    if (sk.selectedUpg === 'B') player.phantomDecoy = maDecoy(player.x, player.y);
    const [dx, dy, d] = getVector(player.x, player.y, tx, ty);
    if (d <= 10) return;
    player.grappleTarget = { x: tx, y: ty, kind: 'magnet', anchor, onArrive: () => {
        magClank(tx, ty);
        if (sk.selectedUpg === 'A') maCrash(sk);
        if (sk.selectedUpg === 'B' && hasTalent('ma_decoy_twin')) ma.decoy2 = maDecoy(player.x, player.y); // Double Signal
    } };
    burst(player.x, player.y, Math.atan2(dy, dx), 0.6, 6, { kind: 'spark', color: '#80d8ff', size: 2, life: 0.2, speed: [200, 400], drag: 5 });
}
// Decoy Projection: a hologram that draws idle non-bosses and soaks one shot (main.js handles player.phantomDecoy's shot and drawing)
function maDecoy(x, y) { return { x, y, life: hasTalent('ma_decoy_long') ? 4 : 2, fire: 0.4 }; }
function maDecoyTick(d, dt, second) {
    if (second) { // the second hologram: main.js only knows the first
        d.life -= dt;
        for (let i = projectiles.length - 1; i >= 0; i--) { const p = projectiles[i]; if (p.isEnemy && Math.hypot(p.x - d.x, p.y - d.y) < player.radius + p.radius) { projectiles.splice(i, 1); d.life = 0; break; } }
    }
    if (d.life <= 0) { // Booby Trap: it blows when it's done
        if (!d.done) { d.done = true; if (hasTalent('ma_decoy_boom')) { const dmg = calcDmg(activeClass.skills[1].baseDmg, Math.max(1, activeClass.skills[1].level)) * 6; effects.push({ type: 'fiery_explosion', x: d.x, y: d.y, radius: 150, life: 0.5, maxLife: 0.5 }); for (const e of enemies) if (!e.dead && Math.hypot(e.x - d.x, e.y - d.y) < e.size / 2 + 150) applyDamage(e, dmg, 'magic'); addShake(2.5); } }
        return false;
    }
    for (const e of enemies) {
        if (!maLive(e) || isBossE(e) || (e.state && e.state !== 'idle') || Math.hypot(e.x - d.x, e.y - d.y) > 300) continue;
        e.tauntTimer = Math.max(e.tauntTimer || 0, 0.3); e.tauntX = d.x; e.tauntY = d.y;
        if (hasTalent('ma_decoy_twin')) e.maHateUntil = fxTime + 3; // Double Signal: they take +20% from you
    }
    if (hasTalent('ma_decoy_armed') && (d.fire -= dt) <= 0) { // Armed Decoy: it shoots like a plain turret
        d.fire = 0.8;
        const t = getNearestEnemyFromPoint(d.x, d.y, 500);
        if (t) { const a = Math.atan2(t.y - d.y, t.x - d.x); projectiles.push({ x: d.x, y: d.y, vx: Math.cos(a) * 800, vy: Math.sin(a) * 800, radius: 4, color: '#80d8ff', life: 1.5, type: 'basic', shape: 'bullet', damage: calcDmg(activeClass.skills[1].baseDmg, Math.max(1, activeClass.skills[1].level)), pierce: false, isEnemy: false }); }
    }
    return true;
}
// Crash Landing: the arrival knocks back and stuns; talents add Scrap, a shield and mines
function maCrash(sk) {
    const R = hasTalent('ma_crash_wide') ? 220 : 150, dmg = calcDmg(30, sk.level); let n = 0;
    effects.push({ type: 'circle_burst', x: player.x, y: player.y, radius: R, color: 'rgba(255, 183, 77, 0.6)', life: 0.35, maxLife: 0.35 });
    burst(player.x, player.y, 0, Math.PI * 2, 14, { kind: 'debris', color: '#757575', size: 4, life: 0.5, speed: [150, 380], drag: 4 });
    for (const e of enemies) {
        if (e.dead || e.submerged || Math.hypot(e.x - player.x, e.y - player.y) > R + e.size / 2) continue;
        applyDamage(e, dmg, 'melee'); n++;
        if (e.dead || isBossE(e) || e.prop) continue;
        const [kx, ky, kd] = getVector(player.x, player.y, e.x, e.y);
        if (kd > 0) { e.x += kx / kd * 80; e.y += ky / kd * 80; clampToBounds(e, e.size / 2); }
        e.stunTimer = Math.max(e.stunTimer || 0, 0.6);
    }
    if (hasTalent('ma_crash_scrap')) player.scrap = Math.min(SCRAP_MAX, (player.scrap || 0) + n); // Salvage Slam
    if (hasTalent('ma_crash_plate') && n) addShield(15 * n, 4); // Impact Plating
    if (hasTalent('ma_crash_mines')) for (let k = 0; k < 4; k++) { // Shrapnel Mines
        const a = k * Math.PI / 2 + Math.PI / 4, [mx, my] = clampPointToMap(player.x + Math.cos(a) * 90, player.y + Math.sin(a) * 90, 10);
        ma.mines.push({ x: mx, y: my, t: 12, arm: fxTime + 0.5, dmg: calcDmg(25, sk.level) });
    }
    addShake(2.5);
}

// ---------- R: Overclock Protocol ----------

function maOverclock(sk, dmg) {
    const duration = calcUtility(6.0, sk.level) + (hasItem('Overclock Regulator') ? 2 : 0) + (hasTalent('ma_oc_long') ? 2 : 0); // items.js; Coolant
    buffs.overclockTimer = duration; buffs.overclockMax = duration;
    lightningRod(); // combos.js: cast inside your own coil's field, you absorb it
    effects.push({ type: 'overclock_burst', life: 0.6, maxLife: 0.6 });
    for (const p of projectiles) if (p.type === 'turret' || p.type === 'tesla_coil_trap') p.life = p.type === 'turret' ? (p.maxLife || 10.0) : 8.0; // a Siege Turret refreshes to its own 15 s
    if (hasTalent('ma_oc_heal')) player.hp = Math.min(player.maxHp, player.hp + player.maxHp * 0.1); // Field Repair
    if (sk.selectedUpg === 'A') ma.exo = { t: 8, rocket: 0.5, lvl: sk.level };
    if (sk.selectedUpg === 'B') { const t = hasTalent('ma_orb_long') ? 4.5 : 3; ma.orbital = { t, max: t, x: mouseX, y: mouseY, tick: 0, scorch: 0, dmg: calcDmg(60, sk.level), dir: 0 }; }
}
// Exo-Frame: the scattergun becomes a forward minigun stream (skills.js 'scattergun' hands its shot here)
function maMinigun(dmg, angle) {
    const off = (Math.random() - 0.5) * 0.12;
    projectiles.push({ x: player.x + Math.cos(angle) * 20, y: player.y + Math.sin(angle) * 20, vx: Math.cos(angle + off) * 1150, vy: Math.sin(angle + off) * 1150, radius: 4, color: '#ffe082', life: 0.55, type: 'scattergun', shape: 'bullet', damage: dmg * 0.55, pierce: buffs.overclockTimer > 0, hitList: [], isEnemy: false, knock: 6 });
    cooldowns.basic = cooldownMax.basic = devNoCooldowns ? 0 : 0.09 / (1 + attackSpeedBonus());
    rodBlast(dmg, angle); // combos.js Lightning Rod
}
const maExoTaken = amount => ma.exo ? amount * (hasTalent('ma_exo_plate') ? 0.55 : 0.7) : amount; // talents.js: Reactive Plating
const maMoveMult = () => ma.exo && hasTalent('ma_exo_stomp') ? 1.2 : 1;                         // main.js movement: Servo Stomp
function maDmgMult(e) { return (e.maSightUntil > fxTime ? 1.15 : 1) * (e.maHateUntil > fxTime ? 1.2 : 1); } // talents.js: Laser Sight, Double Signal
const maScatterMult = e => hasTalent('ma_flame_heat') && e.burnTimer > 0 ? 1.15 : 1;            // main.js scattergun hits: Superheated

// ---------- every frame ----------

function updateMachinist(dt) { // main.js update
    if (activeClass.name !== 'Machinist') return;
    if (player.phantomDecoy && !maDecoyTick(player.phantomDecoy, dt, false)) player.phantomDecoy = null;
    if (ma.decoy2 && !maDecoyTick(ma.decoy2, dt, true)) ma.decoy2 = null;
    for (let i = ma.mines.length - 1; i >= 0; i--) {
        const m = ma.mines[i];
        if ((m.t -= dt) <= 0) { ma.mines.splice(i, 1); continue; }
        if (fxTime < m.arm || !enemies.some(e => maLive(e) && Math.hypot(e.x - m.x, e.y - m.y) < 28 + e.size / 2)) continue;
        ma.mines.splice(i, 1);
        effects.push({ type: 'fiery_explosion', x: m.x, y: m.y, radius: 80, life: 0.4, maxLife: 0.4 });
        for (const e of enemies) if (!e.dead && Math.hypot(e.x - m.x, e.y - m.y) < e.size / 2 + 80) applyDamage(e, m.dmg, 'magic');
    }
    const X = ma.exo;
    if (X) {
        if (hasTalent('ma_exo_rockets') && (X.rocket -= dt) <= 0) { // Shoulder Rockets
            X.rocket = 1;
            const t = getNearestEnemyFromPoint(mouseX, mouseY, 500) || getNearestEnemyFromPoint(player.x, player.y, 600);
            if (t) { const a = Math.atan2(t.y - player.y, t.x - player.x); projectiles.push({ x: player.x, y: player.y, vx: Math.cos(a) * 650, vy: Math.sin(a) * 650, radius: 9, color: '#ff7043', life: 1.4, type: 'fireball', shape: 'fireball', damage: calcDmg(20, X.lvl), pierce: false, isEnemy: false, homeTarget: t }); }
        }
        if (hasTalent('ma_exo_stomp')) for (const e of enemies) { // Servo Stomp: small enemies are shoved aside
            if (!maLive(e) || isBossE(e)) continue;
            const dx = e.x - player.x, dy = e.y - player.y, d = Math.hypot(dx, dy), R = player.radius + e.size / 2 + 6;
            if (d < R && d > 0) { e.x += dx / d * (R - d + 4); e.y += dy / d * (R - d + 4); clampToBounds(e, e.size / 2); }
        }
        if ((X.t -= dt) <= 0) {
            ma.exo = null;
            if (hasTalent('ma_exo_eject')) { // Eject: the frame blows itself up
                effects.push({ type: 'fiery_explosion', x: player.x, y: player.y, radius: 220, life: 0.6, maxLife: 0.6 });
                for (const e of enemies) if (!e.dead && Math.hypot(e.x - player.x, e.y - player.y) < e.size / 2 + 220) applyDamage(e, calcDmg(120, X.lvl), 'magic');
                addShake(4);
            }
        }
    }
    const O = ma.orbital;
    if (O) { // the beam crawls after the cursor
        const [dx, dy, d] = getVector(O.x, O.y, mouseX, mouseY), step = Math.min(d, 320 * dt);
        if (d > 1) { O.x += dx / d * step; O.y += dy / d * step; O.dir = Math.atan2(dy, dx); }
        if ((O.tick -= dt) <= 0) {
            O.tick += 0.1;
            for (const [px, py] of maOrbitalPoints(O)) for (const e of enemies) if (!e.dead && !e.submerged && Math.hypot(e.x - px, e.y - py) < e.size / 2 + maOrbitalW()) applyDamage(e, O.dmg * 0.1, 'magic');
        }
        if (hasTalent('ma_orb_scorch') && (O.scorch -= dt) <= 0) { O.scorch = 0.25; effects.push({ type: 'fire_puddle', x: O.x, y: O.y, radius: 35, color: 'rgba(255, 87, 34, 0.3)', life: 2, maxLife: 2, dmg: O.dmg * 0.3 }); } // Scorch Line
        if ((O.t -= dt) <= 0) ma.orbital = null;
    }
}
const maOrbitalW = () => hasTalent('ma_orb_wide') ? 60 : 40;
function maOrbitalPoints(O) { // Prism Array: three beams for its last second
    if (!(hasTalent('ma_orb_prism') && O.t < 1)) return [[O.x, O.y]];
    const px = -Math.sin(O.dir) * 80, py = Math.cos(O.dir) * 80;
    return [[O.x, O.y], [O.x + px, O.y + py], [O.x - px, O.y - py]];
}
function drawMachinist() { // main.js draw: the orbital beam, the exo-frame, mines, the second hologram
    if (activeClass.name !== 'Machinist') return;
    const c = ctx;
    for (const m of ma.mines) { c.fillStyle = '#424242'; c.beginPath(); c.arc(m.x, m.y, 8, 0, Math.PI * 2); c.fill(); if (fxTime >= m.arm && Math.sin(fxTime * 12) > 0) { c.fillStyle = '#ff5252'; c.beginPath(); c.arc(m.x, m.y, 3, 0, Math.PI * 2); c.fill(); } }
    if (ma.decoy2 && ma.decoy2.life > 0) drawDecoyHologram(ma.decoy2, Math.atan2(mouseY - player.y, mouseX - player.x)); // skillfx_space.js
    if (ma.exo) { // bulky shoulders and a frame round the hero
        const a = Math.atan2(mouseY - player.y, mouseX - player.x), px = -Math.sin(a), py = Math.cos(a);
        c.save(); c.globalAlpha = 0.85; c.fillStyle = '#546e7a'; c.strokeStyle = '#ffb74d'; c.lineWidth = 2;
        for (const s of [-1, 1]) { c.beginPath(); c.arc(player.x + px * 22 * s, player.y + py * 22 * s, 11, 0, Math.PI * 2); c.fill(); c.stroke(); }
        c.beginPath(); c.arc(player.x, player.y, player.radius + 10, 0, Math.PI * 2); c.stroke(); c.restore();
    }
    const O = ma.orbital;
    if (O) {
        const W = maOrbitalW();
        for (const [x, y] of maOrbitalPoints(O)) {
            c.save(); c.globalAlpha = 0.35; c.fillStyle = '#ff6e40'; c.beginPath(); c.arc(x, y, W * 1.4, 0, Math.PI * 2); c.fill();
            c.globalAlpha = 0.8; c.fillStyle = '#ffccbc'; c.fillRect(x - W * 0.35, y - 700, W * 0.7, 700);
            c.fillStyle = '#ffffff'; c.fillRect(x - W * 0.12, y - 700, W * 0.24, 700);
            c.beginPath(); c.arc(x, y, W * 0.6, 0, Math.PI * 2); c.fill(); c.restore();
        }
    }
}

Object.assign(window.SkillRegistry.Machinist, { 2: maCoil, 3: maGrapple, 4: maOverclock });
