// ==========================================
// kensei.js - The Kensei's web (CLASS_WEBS.md; talents in talents.js TALENT_WEBS.kensei)
// ==========================================
// The stance split holds: an A evolution changes the handheld form of its key, a B evolution the airborne form; the other
// form stays the base one in skills.js (wrapped here). Q: A Counter Stance (hold to guard, parries answered by a dash-slash) /
// B Chain Surge (the blade darts through enemies in turn, ke.chain). E: A Catch Parry (the catch opens a parry window) /
// B Twin Blades (a smaller second blade, ke.twin). Space: A Ghost Step (untargetable after the step, ke.ghost) / B Echo Swap
// (swap back for free, ke.echo). R: A Vortex (kept, with talents) / B Shard Shield (shards orbit you, ke.shards).

const ke = { chain: null, twin: null, ghost: 0, ghostHit: false, echo: null, shards: null, guard: 0, catchUntil: -99, twister: null };
function resetKensei() { ke.chain = ke.twin = ke.echo = ke.shards = ke.twister = null; ke.ghost = 0; ke.ghostHit = false; ke.guard = 0; ke.catchUntil = -99; }
const keUpg = slot => activeClass.skills[slot].selectedUpg;
const keFull = slot => devNoCooldowns ? 0 : skillBaseCd(slot, activeClass.skills[slot].level) * getCDR();
const keLive = e => !e.dead && !e.pod && !e.prop && !e.submerged && !(e.spawnT > 0);
const K_BASE = {}; // skills.js's own Kensei keys, wrapped below

// ---------- Q ----------

// Counter Stance: Q held in hand guards (main.js charge); every hit is parried (player.parryTimer) and answered
function keGuardCharge(sk) {
    if (player.stance !== 'handheld' || sk.selectedUpg !== 'A') return null;
    ke.guard = 0;
    return { max: hasTalent('ke_counter_long') ? 2.5 : 1.5, slow: 0.5 };
}
function keQ(sk, dmg, k) {
    if (galeReady()) return K_BASE[1](sk, dmg, k); // combos.js Gathering Gale releases first
    if (player.stance === 'handheld' && sk.selectedUpg === 'A') { // the guard ends: Final Draw after 2+ parries
        if (ke.guard >= 2 && hasTalent('ke_counter_draw')) keIaidoLine(dmg * 2);
        ke.guard = 0; return;
    }
    if (player.stance === 'airborne' && sk.selectedUpg === 'B' && !(player.airborneBlade.orbit)) return keChainStart(sk, dmg);
    return K_BASE[1](sk, dmg, k);
}
function keIaidoLine(dmg) {
    const a = Math.atan2(mouseY - player.y, mouseX - player.x), x2 = player.x + Math.cos(a) * 520, y2 = player.y + Math.sin(a) * 520;
    effects.push({ type: 'iai_flash', x1: player.x, y1: player.y, x2, y2, big: true, life: 0.45, maxLife: 0.45 });
    for (const e of enemies) if (!e.dead && distToSegment(e.x, e.y, player.x, player.y, x2, y2) <= e.size / 2 + 40) applyDamage(e, dmg, 'slash', a);
    addShake(3);
}
// combat.js parrySuccess: the guard's answer, Flowing Guard, Arrow Cutter, and the Catch Parry's Perfect Catch
function kenseiOnParry(src) {
    const guarding = player.charge && player.charge.slot === 1 && keUpg(1) === 'A';
    if (guarding) {
        ke.guard++;
        if (hasTalent('ke_counter_flow')) player.flow = Math.min(player.maxFlow, player.flow + 15);
        const p = src && src.proj;
        if (p && hasTalent('ke_counter_arrow')) { // the shot flies back at the shooter
            const o = p.owner && !p.owner.dead ? p.owner : getNearestEnemyFromPoint(player.x, player.y, 700);
            if (o) { const a = Math.atan2(o.y - player.y, o.x - player.x); projectiles.push({ x: player.x, y: player.y, vx: Math.cos(a) * 900, vy: Math.sin(a) * 900, radius: 6, color: '#84ffff', life: 1.2, type: 'basic', shape: 'mirror_shot', damage: calcDmg(activeClass.skills[1].baseDmg, activeClass.skills[1].level), pierce: false, hitList: [], isEnemy: false }); }
        }
        const t = (p && p.owner && !p.owner.dead ? p.owner : null) || getNearestEnemyFromPoint(player.x, player.y, 300);
        if (t && Math.hypot(t.x - player.x, t.y - player.y) < 420) { // an instant dash-slash at the attacker
            const a = Math.atan2(t.y - player.y, t.x - player.x), d = Math.max(0, Math.hypot(t.x - player.x, t.y - player.y) - t.size / 2 - player.radius - 6), x0 = player.x, y0 = player.y;
            player.x += Math.cos(a) * d; player.y += Math.sin(a) * d; clampToBounds(player, player.radius);
            spawnDashGhost('#00e5ff', true, 0.25, a, x0, y0, 0);
            effects.push({ type: 'iai_flash', x1: x0, y1: y0, x2: player.x, y2: player.y, life: 0.3, maxLife: 0.3 });
            applyDamage(t, calcDmg(activeClass.skills[1].baseDmg, activeClass.skills[1].level) * 1.5, 'slash', a);
        }
    }
    if (fxTime < ke.catchUntil && hasTalent('ke_catch_perfect') && player.stance === 'handheld') { // Perfect Catch: Counter Step at once
        ke.catchUntil = -99; cooldowns.s3 = 0; castSkill(3); cooldowns.s3 = 0;
    }
}
// Chain Surge: the blade darts through up to 5 enemies (Hunting Arc: 8) in turn, then returns to steering
function keChainStart(sk, dmg) {
    const ab = player.airborneBlade, n = hasTalent('ke_chain_more') ? 8 : 5, list = [];
    let from = ab;
    for (let i = 0; i < n; i++) { const e = getNearestEnemyFromPoint(from.x, from.y, 450, list); if (!e) break; list.push(e); from = e; }
    if (!list.length) { effects.push({ type: 'text', text: 'No target', x: ab.x, y: ab.y - 30, color: '#84ffff', life: 0.6, maxLife: 0.6 }); return; }
    ke.chain = { list, i: 0, dmg };
    effects.push({ type: 'text', text: 'Chain Surge!', x: ab.x, y: ab.y - 40, color: '#00e5ff', life: 0.6, maxLife: 0.6 });
}
function updateChainSurge(ab, dt) { // main.js airborne blade, in place of steering while it runs
    const C = ke.chain;
    let e = C.list[C.i];
    while (e && e.dead) e = C.list[++C.i];
    if (!e) { ke.chain = null; return; }
    const dx = e.x - ab.x, dy = e.y - ab.y, d = Math.hypot(dx, dy), step = 2200 * dt;
    ab.angle = Math.atan2(dy, dx);
    if (d > step + e.size / 2) { ab.x += dx / d * step; ab.y += dy / d * step; return; }
    ab.x = e.x - dx / (d || 1) * (e.size / 2); ab.y = e.y - dy / (d || 1) * (e.size / 2);
    const last = C.i === C.list.length - 1, coup = last && hasTalent('ke_chain_coup');
    applyDamage(e, C.dmg * 0.8 * (coup ? 3 : 1), 'slash', ab.angle);
    effects.push({ type: 'slash', x: e.x, y: e.y, angle: ab.angle, color: 'rgba(0, 229, 255, 0.9)', life: 0.15, maxLife: 0.15, radius: 70 });
    if (!e.dead) { if (hasTalent('ke_chain_sever')) e.keSeverUntil = fxTime + 4; if (coup) e.stunTimer = Math.max(e.stunTimer || 0, 1); }
    if (hasTalent('ke_chain_flow')) { player.flow = Math.min(player.maxFlow, player.flow + 4); player.flowGainTimer = 0; }
    C.i++;
    if (coup) addShake(2.5);
}

// ---------- E: Deploy / Recall ----------

function keToggle(sk, dmg) {
    if (player.stance === 'handheld') {
        const early = sk.selectedUpg === 'B' && hasTalent('ke_twin_early');
        if (early) { player.flow = player.maxFlow; player.flowGainTimer = 0; } // Early Deploy: launched from 70%, the bar fills (main.js lets it cast)
        if (player.flow >= player.maxFlow) player.empoweredAirborne = true;
        player.stance = 'airborne';
        effects.push({ type: 'blade_launch', x: player.x, y: player.y, flow: early, life: 0.35, maxLife: 0.35 });
        if (sk.selectedUpg === 'B') ke.twin = { x: player.x, y: player.y, angle: 0, atk: 0, ang: 0 }; // Twin Blades
        return;
    }
    const ab = player.airborneBlade;
    effects.push({ type: 'blade_recall', x1: ab.x, y1: ab.y, x2: player.x, y2: player.y, life: 0.3, maxLife: 0.3 });
    effects.push({ type: 'circle_burst', x: player.x, y: player.y, radius: 40, color: 'rgba(0, 229, 255, 0.8)', life: 0.3, maxLife: 0.3 });
    if (ke.twin && hasTalent('ke_twin_reunion')) { // Reunion: both blades come home, crossing
        const dmg2 = calcDmg(activeClass.basicDmg) * RETURN_MULT * 2;
        for (const [x, y] of [[ab.x, ab.y], [ke.twin.x, ke.twin.y]]) for (const e of enemies) if (!e.dead && distToSegment(e.x, e.y, x, y, player.x, player.y) <= e.size / 2 + 30) applyDamage(e, dmg2, 'slash');
        effects.push({ type: 'iai_flash', x1: ke.twin.x, y1: ke.twin.y, x2: player.x, y2: player.y, big: true, life: 0.4, maxLife: 0.4 });
    }
    ke.twin = null;
    const full = sk.selectedUpg === 'A' && hasTalent('ke_catch_full'); // Riposte Recall
    returnCut(ab.x, ab.y, (full ? 1 : player.flow / Math.max(1, player.maxFlow)) * (hasTalent('ke_e_cut') ? 1.25 : 1)); // combos.js Return Cut (Sharper Return)
    player.stance = 'handheld';
    player.flow = sk.selectedUpg === 'A' && hasTalent('ke_catch_keep') ? player.maxFlow * 0.3 : 0; // Refund
    player.flowGainTimer = 0; player.empoweredAirborne = false;
    ab.x = player.x; ab.y = player.y;
    if (sk.selectedUpg === 'A') { // Catch Parry: the catch opens a parry window
        const w = hasTalent('ke_catch_long') ? 1.5 : 1;
        player.parryTimer = Math.max(player.parryTimer || 0, w); ke.catchUntil = fxTime + w;
        effects.push({ type: 'parry_flash', x: player.x, y: player.y, angle: 0, life: 0.3, maxLife: 0.3 });
    }
}
function updateTwin(dt) { // the second, smaller blade: it hunts on its own, or (Guarding Twin) circles you and cuts shots
    const T = ke.twin; if (!T) return;
    if (player.stance !== 'airborne') { ke.twin = null; return; }
    const mult = (hasTalent('ke_twin_sharp') ? 0.8 : 0.6) * 0.5;
    if (hasTalent('ke_twin_guard')) {
        T.ang += 6 * dt;
        T.x = player.x + Math.cos(T.ang) * 70; T.y = player.y + Math.sin(T.ang) * 70; T.angle = T.ang + Math.PI / 2;
        for (let i = projectiles.length - 1; i >= 0; i--) { const p = projectiles[i]; if (p.isEnemy && Math.hypot(p.x - T.x, p.y - T.y) < 34 + p.radius) { effects.push({ type: 'sparkle_poof', x: p.x, y: p.y, color: '#84ffff' }); projectiles.splice(i, 1); } }
    } else {
        if (!T.target || !keLive(T.target)) T.target = getNearestEnemyFromPoint(player.x, player.y, 600);
        const goal = T.target || { x: player.x + 40, y: player.y - 40 }, dx = goal.x - T.x, dy = goal.y - T.y, d = Math.hypot(dx, dy);
        T.angle = Math.atan2(dy, dx);
        if (d > 4) { const s = Math.min(d, 800 * dt); T.x += dx / d * s; T.y += dy / d * s; }
    }
    if ((T.atk -= dt) > 0) return;
    for (const e of enemies) if (!e.dead && !e.submerged && Math.hypot(e.x - T.x, e.y - T.y) < e.size / 2 + 32) {
        applyDamage(e, bladeHitDmg(mult), 'slash', T.angle); T.atk = 0.3;
        effects.push({ type: 'slash', x: e.x, y: e.y, angle: T.angle, color: 'rgba(132, 255, 255, 0.7)', life: 0.12, maxLife: 0.12, radius: 40 });
    }
}

// ---------- Space ----------

function keSpace(sk, dmg) {
    if (player.stance === 'handheld') {
        K_BASE[3](sk, dmg); // Shadow Step (Path of Blades, skills.js, now a Ghost Step talent)
        if (sk.selectedUpg === 'A') { ke.ghost = hasTalent('ke_ghost_long') ? 2.5 : 1.5; ke.ghostHit = true; } // Ghost Step
        return;
    }
    const E = ke.echo, free = sk.selectedUpg === 'B' && E && E.left > 0; // Echo Swap: free swaps back within the window
    const ab = player.airborneBlade, x0 = player.x, y0 = player.y, bx = ab.x, by = ab.y;
    K_BASE[3](sk, dmg); // the swap (Surge Reset is a talent there)
    if (sk.selectedUpg !== 'B') return;
    if (hasTalent('ke_echo_cut')) { // Cutting Swap: the line between you and the blade is cut
        for (const e of enemies) if (!e.dead && distToSegment(e.x, e.y, x0, y0, bx, by) <= e.size / 2 + 26) applyDamage(e, dmg, 'slash', Math.atan2(by - y0, bx - x0));
        effects.push({ type: 'iai_flash', x1: x0, y1: y0, x2: bx, y2: by, life: 0.3, maxLife: 0.3 });
    }
    if (free) E.left--;
    else ke.echo = { t: hasTalent('ke_echo_long') ? 3.5 : 2, left: hasTalent('ke_echo_triple') ? 2 : 1 };
    if (ke.echo.left > 0) cooldowns.s3 = cooldownMax.s3 = devNoCooldowns ? 0 : 0.25; // the next swap is free
    else { ke.echo = null; cooldowns.s3 = cooldownMax.s3 = keFull(3); }
}
const keHidden = () => ke.ghost > 0;                                    // main.js: enemies lose you
const keSilent = () => ke.ghost > 0 && hasTalent('ke_ghost_flow');      // main.js: Silent Flow, no decay
function keDmgMult(e) { // talents.js talentDmgMult: Sever, and Ghost Step's first hit (Death from Nowhere: x2 and Q is ready)
    let m = e.keSeverUntil > fxTime ? 1.15 : 1;
    if (ke.ghostHit && ke.ghost > 0) {
        ke.ghostHit = false; m *= hasTalent('ke_ghost_strike') ? 2 : 1.5;
        if (hasTalent('ke_ghost_strike')) cooldowns.s1 = 0;
        effects.push({ type: 'text', text: 'FROM THE SHADOWS', x: e.x, y: e.y - 40, color: '#84ffff', life: 0.7, maxLife: 0.7 });
    }
    return m;
}

// ---------- R ----------

function keR(sk, dmg, k, opt = {}) {
    if (player.stance === 'handheld' && opt.gather) return K_BASE[4](sk, dmg, k, opt); // combos.js Gathering Gale
    if (player.stance === 'handheld') return keWhirl(sk, dmg);
    if (sk.selectedUpg === 'B') return keShardCast(sk, dmg);
    return K_BASE[4](sk, dmg, k, opt); // Shatter Storm
}
const keVortexR = () => hasTalent('ke_vortex_wide') ? 330 : 250;
function keWhirl(sk, dmg, second = false) { // Blade Whirlwind; Vortex pulls (Eye of the Storm, Second Gust, Undertow, Hurricane Draw)
    const vortex = sk.selectedUpg === 'A', R = vortex ? keVortexR() : 250;
    effects.push({ type: 'katana_tornado', x: player.x, y: player.y, radius: R, vortex, startAngle: Math.atan2(mouseY - player.y, mouseX - player.x), life: 0.8, maxLife: 0.8 });
    addShake(second ? 1.5 : 2.5);
    let n = 0;
    for (const e of enemies) {
        if (e.dead || Math.hypot(player.x - e.x, player.y - e.y) >= R + e.size / 2) continue;
        applyDamage(e, dmg * 1.5 * (second ? 0.6 : 1), 'slash'); n++;
        if (!vortex) continue;
        const [edx, edy, edist] = getVector(e.x, e.y, player.x, player.y), pull = Math.max(0, Math.min(edist - (player.radius + e.size / 2), 150)); // stop at contact range
        if (!e.type.startsWith('boss')) { e.x += (edx / edist) * pull; e.y += (edy / edist) * pull; }
        if (hasTalent('ke_vortex_slow') && !e.dead) { e.slowTimer = Math.max(e.slowTimer || 0, 2); e.slowAmount = Math.max(e.slowAmount || 0, 0.4); }
    }
    if (hasTalent('ke_r_flow') && n) { player.flow = Math.min(player.maxFlow, player.flow + 8 * n); player.flowGainTimer = 0; } // Gathering Wind
    if (second || !vortex) return;
    if (hasTalent('ke_vortex_twice')) after(0.5, () => keWhirl(sk, dmg, true));
    if (hasTalent('ke_vortex_twister')) ke.twister = { x: player.x, y: player.y, t: 2, dmg };
}
// Shard Shield: the shards orbit you, cutting what comes close and shattering enemy shots; Release flings them out
function keShardCast(sk, dmg) {
    if (ke.shards && hasTalent('ke_shards_release')) return keShardRelease();
    const ab = player.airborneBlade;
    effects.push({ type: 'shatter_burst', x: ab.x, y: ab.y, life: 0.4, maxLife: 0.4 });
    ke.shards = { t: 6, n: hasTalent('ke_shards_more') ? 9 : 6, ang: 0, dmg, hit: new Map() };
    if (hasTalent('ke_shards_release')) cooldowns.s4 = cooldownMax.s4 = devNoCooldowns ? 0 : 0.3; // R again releases them
}
const keShardR = () => hasTalent('ke_shards_wide') ? 110 : 80;
function keShardRelease() {
    const S = ke.shards; ke.shards = null; if (!S) return;
    for (let i = 0; i < S.n; i++) { const a = S.ang + i * Math.PI * 2 / S.n; projectiles.push({ x: player.x + Math.cos(a) * keShardR(), y: player.y + Math.sin(a) * keShardR(), vx: Math.cos(a) * 900, vy: Math.sin(a) * 900, radius: 7, color: '#84ffff', life: 0.6, type: 'pierce', shape: 'knife', damage: S.dmg * 0.5, pierce: true, hitList: [], isEnemy: false }); }
    effects.push({ type: 'shatter_burst', x: player.x, y: player.y, life: 0.4, maxLife: 0.4 });
    cooldowns.s4 = cooldownMax.s4 = keFull(4);
}
function updateShards(dt) {
    const S = ke.shards; if (!S) return;
    if ((S.t -= dt) <= 0) { ke.shards = null; if (hasTalent('ke_shards_release')) cooldowns.s4 = cooldownMax.s4 = keFull(4); return; }
    S.ang += 5 * dt;
    const R = keShardR();
    for (let i = 0; i < S.n; i++) {
        const a = S.ang + i * Math.PI * 2 / S.n, x = player.x + Math.cos(a) * R, y = player.y + Math.sin(a) * R;
        for (const e of enemies) {
            if (e.dead || e.submerged || Math.hypot(e.x - x, e.y - y) > e.size / 2 + 12 || fxTime - (S.hit.get(e) || -9) < 0.4) continue;
            S.hit.set(e, fxTime); applyDamage(e, S.dmg * 0.1, 'shatter_storm', a + Math.PI / 2);
        }
        for (let j = projectiles.length - 1; j >= 0; j--) {
            const p = projectiles[j];
            if (!p.isEnemy || Math.hypot(p.x - x, p.y - y) > 18 + p.radius) continue;
            effects.push({ type: 'sparkle_poof', x: p.x, y: p.y, color: '#84ffff' }); projectiles.splice(j, 1);
            if (hasTalent('ke_shards_flow')) { player.flow = Math.min(player.maxFlow, player.flow + 5); player.flowGainTimer = 0; } // Mirror Shards
        }
    }
}

// ---------- every frame ----------

function updateKensei(dt) { // main.js update
    if (activeClass.name !== 'Kensei') return;
    if (player.charge && player.charge.slot === 1 && keUpg(1) === 'A' && player.stance === 'handheld') player.parryTimer = Math.max(player.parryTimer || 0, 0.05); // the guard holds
    if (ke.ghost > 0) ke.ghost -= dt;
    if (ke.echo && (ke.echo.t -= dt) <= 0) { ke.echo = null; cooldowns.s3 = cooldownMax.s3 = keFull(3); } // the window closed: the full cooldown now
    if (ke.chain && player.stance !== 'airborne') ke.chain = null;
    updateTwin(dt); updateShards(dt);
    const T = ke.twister;
    if (T) { // Hurricane Draw: a tornado stays and keeps pulling
        for (const e of enemies) {
            if (e.dead || e.pod || e.prop || e.type.startsWith('boss')) continue;
            const [dx, dy, d] = getVector(e.x, e.y, T.x, T.y);
            if (d > keVortexR() || d < 20) continue;
            e.x += dx / d * Math.min(d - 20, 150 * dt); e.y += dy / d * Math.min(d - 20, 150 * dt);
            applyDamage(e, T.dmg * 0.3 * dt, 'dot');
        }
        if (Math.random() < dt * 20) effects.push({ type: 'katana_tornado', x: T.x, y: T.y, radius: keVortexR() * 0.6, vortex: true, startAngle: Math.random() * 6, life: 0.4, maxLife: 0.4 });
        if ((T.t -= dt) <= 0) ke.twister = null;
    }
}
function drawKensei() { // main.js draw: the twin blade, the orbiting shards, the ghost's shimmer
    if (activeClass.name !== 'Kensei') return;
    const c = ctx;
    const blade = (x, y, a, len, col) => { c.save(); c.translate(x, y); c.rotate(a); c.fillStyle = col; c.beginPath(); c.moveTo(len, 0); c.lineTo(-len * 0.4, -3); c.lineTo(-len * 0.4, 3); c.closePath(); c.fill(); c.restore(); };
    if (ke.twin) blade(ke.twin.x, ke.twin.y, ke.twin.angle, 22, '#84ffff');
    const S = ke.shards;
    if (S) for (let i = 0; i < S.n; i++) { const a = S.ang + i * Math.PI * 2 / S.n; blade(player.x + Math.cos(a) * keShardR(), player.y + Math.sin(a) * keShardR(), a + Math.PI / 2, 12, '#b2ebf2'); }
    if (ke.ghost > 0) { c.save(); c.globalAlpha = 0.25 + 0.15 * Math.sin(fxTime * 12); c.strokeStyle = '#84ffff'; c.lineWidth = 2; c.setLineDash([3, 5]); c.beginPath(); c.arc(player.x, player.y, player.radius + 10, 0, Math.PI * 2); c.stroke(); c.restore(); }
}

for (const i of [1, 2, 3, 4]) K_BASE[i] = window.SkillRegistry.Kensei[i];
Object.assign(window.SkillRegistry.Kensei, { 1: keQ, 2: keToggle, 3: keSpace, 4: keR, charge: { 1: keGuardCharge } });
