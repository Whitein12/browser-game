// ==========================================
// skillfx_space.js - Mobility (Space) abilities: dash/leap travel, afterimages and their visuals
// ==========================================
// Hooks: updateDash (main.js update), drawDashGhosts / drawGrappleCable / drawDecoyHologram (main.js draw),
// drawSpaceEffect / drawSpaceGround / drawSpaceProjectile (skillfx.js), updateSpaceEmitters (skillfx.js).

// ==========================================
// Travel
// ==========================================

// player.dash moves the player to a point over a fixed time instead of teleporting.
// Leaps set `arc` (peak height in px), which lifts the sprite over its shadow; lunges are short and flat.
// Options: dur, arc, ease ('linear' | 'out'), iFrames (default true), kind, trail (an effect whose end follows the player),
// ghost { color, glow, every, life }, onStep(x0, y0, x1, y1), onApex(), onArrive().
function startDash(o) {
    let [tx, ty] = clampPointToMap(o.x, o.y, player.radius);
    player.grappleTarget = null;
    const d = Object.assign({ arc: 0, ease: 'linear', iFrames: true, ghostT: 0 }, o);
    const clip = clipToWalls(player.x, player.y, tx, ty, player.radius, d.arc > 0); // stage.js: cave walls stop a dash
    if (clip) { [tx, ty] = clip; d.intoWall = true; }
    Object.assign(d, { x0: player.x, y0: player.y, x1: tx, y1: ty, t: 0, angle: Math.atan2(ty - player.y, tx - player.x) });
    player.dash = d;
    return d;
}

function dashProgress() { return player.dash ? Math.min(1, player.dash.t / player.dash.dur) : 0; }

// Called from update() in place of normal movement while a dash is running
function updateDash(dt) {
    const d = player.dash;
    d.t += dt;
    const q = Math.min(1, d.t / d.dur), e = d.ease === 'out' ? easeOut(q) : q;
    const px = player.x, py = player.y;
    player.x = lerp(d.x0, d.x1, e); player.y = lerp(d.y0, d.y1, e);
    clampToBounds(player, player.radius);
    player.z = d.arc * Math.sin(q * Math.PI);
    if (d.iFrames) player.iFrames = Math.max(player.iFrames, 0.05);
    if (d.trail) { d.trail.x2 = player.x; d.trail.y2 = player.y; }
    if (d.onStep) d.onStep(px, py, player.x, player.y);
    if (d.ghost) {
        d.ghostT -= dt;
        if (d.ghostT <= 0) { d.ghostT = d.ghost.every || 0.03; spawnDashGhost(d.ghost.color, d.ghost.glow, d.ghost.life || 0.25, d.angle); }
    }
    if (!d.apexDone && q >= 0.5) { d.apexDone = true; if (d.onApex) d.onApex(); }
    if (q >= 1) {
        player.dash = null; player.z = 0;
        if (d.onArrive) d.onArrive();
    }
}

// ==========================================
// Afterimages
// ==========================================

const dashGhosts = [];

// A tinted, frozen copy of the player that fades out where it was left
function spawnDashGhost(color, glow, life, facing, x = player.x, y = player.y, z = player.z || 0) {
    const pose = playerPose(facing);
    pose.live = false;
    dashGhosts.push({ x, y, z, facing, pose, color, glow, life, maxLife: life });
    if (dashGhosts.length > 24) dashGhosts.shift();
}

// Render the player's sprite flat-tinted in `color`. Glowing copies blend additively; `scan` cuts hologram scanlines.
function stampTinted(x, y, facing, pose, color, alpha, glow, scale = 1, scan = false) {
    const c = spriteCtx, half = SPRITE_SIZE / 2;
    c.setTransform(1, 0, 0, 1, 0, 0); c.clearRect(0, 0, SPRITE_SIZE, SPRITE_SIZE);
    c.translate(half, half); c.rotate(facing); c.scale(scale, scale);
    drawCharacter(c, selectedClassId, pose);
    c.setTransform(1, 0, 0, 1, 0, 0);
    c.globalCompositeOperation = 'source-atop'; c.globalAlpha = glow ? 0.85 : 0.6;
    c.fillStyle = color; c.fillRect(0, 0, SPRITE_SIZE, SPRITE_SIZE);
    if (scan) {
        c.globalCompositeOperation = 'destination-out'; c.globalAlpha = 0.7; c.fillStyle = '#000';
        const off = Math.floor(fxTime * 30) % 4;
        for (let yy = off; yy < SPRITE_SIZE; yy += 4) c.fillRect(0, yy, SPRITE_SIZE, 1.5);
    }
    c.globalCompositeOperation = 'source-over'; c.globalAlpha = 1;
    ctx.save();
    ctx.globalAlpha = alpha;
    if (glow) ctx.globalCompositeOperation = 'lighter';
    ctx.drawImage(spriteCanvas, x - half, y - half);
    ctx.restore();
}

function drawDashGhosts() {
    for (const g of dashGhosts) {
        const a = clamp01(g.life / g.maxLife);
        stampTinted(g.x, g.y - g.z, g.facing, g.pose, g.color, (g.glow ? 0.7 : 0.4) * a, g.glow, 1 + g.z / 300);
    }
}

// Machinist Decoy Projection: a flickering hologram of the player on a projector disc
function drawDecoyHologram(d, facing) {
    const a = clamp01(d.life / 2);
    const flicker = Math.random() < 0.06 ? 0.3 : 1;
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    ctx.strokeStyle = `rgba(100, 255, 218, ${0.6 * a})`; ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.ellipse(d.x, d.y + 8, 20, 9, 0, 0, Math.PI * 2); ctx.stroke();
    const pulse = (fxTime * 1.5) % 1;
    ctx.strokeStyle = `rgba(100, 255, 218, ${0.35 * a * (1 - pulse)})`;
    ctx.beginPath(); ctx.arc(d.x, d.y, 24 + pulse * 60, 0, Math.PI * 2); ctx.stroke(); // the lure signal
    ctx.restore();
    stampTinted(d.x + (flicker < 1 ? jitter(4) : 0), d.y, facing, { t: 0, walk: 0, move: 0, trail: { x: 0, y: 0 }, live: false, wolf: false, color: player.color }, '#64ffda', 0.75 * a * flicker, true, 1, true);
}

// ==========================================
// Helpers
// ==========================================

function dustPuff(x, y, angle, spread, count, color = '#8d8478') {
    burst(x, y, angle, spread, count, { kind: 'smoke', color, size: 5, grow: 26, life: 0.45, speed: [60, 170], drag: 4 });
}

// Machinist grapple latching on: metal sparks, a magnetic pulse and a little kick
function magClank(x, y) {
    burst(x, y, 0, Math.PI * 2, 12, { kind: 'spark', color: '#ffcc80', size: 2, life: 0.25, speed: [160, 360], drag: 6 });
    spawnParticle({ kind: 'ring', color: '#40c4ff', x, y, vx: 0, vy: 0, size: 6, grow: 220, life: 0.22, drag: 0, spin: 0, rot: 0 });
    addShake(1.5);
}

// Cleric Raven Flight: where raven `i` is at progress `p` of the effect (they fan out mid-flight and regroup)
const RAVEN_COUNT = 6;
function ravenPos(ef, i, p) {
    const q = clamp01((p - i * 0.06) / 0.65);
    const dx = ef.x1 - ef.x0, dy = ef.y1 - ef.y0, len = Math.hypot(dx, dy) || 1;
    const nx = -dy / len, ny = dx / len, e = easeOut(q);
    const off = (i - (RAVEN_COUNT - 1) / 2) * 16 * Math.sin(q * Math.PI) + Math.sin(q * 9 + i) * 5;
    return { x: lerp(ef.x0, ef.x1, e) + nx * off, y: lerp(ef.y0, ef.y1, e) + ny * off, q, ang: Math.atan2(dy, dx) };
}

function drawRaven(x, y, ang, flap, s, alpha) {
    ctx.save();
    ctx.translate(x, y); ctx.rotate(ang); ctx.scale(s, s);
    ctx.globalAlpha = alpha;
    ctx.fillStyle = '#14081f'; ctx.strokeStyle = 'rgba(186, 104, 200, 0.85)'; ctx.lineWidth = 0.8; ctx.lineJoin = 'round';
    const w = 0.3 + 0.7 * Math.abs(Math.sin(flap));
    for (const sd of [-1, 1]) {
        ctx.beginPath(); ctx.moveTo(3, sd * 1.5); ctx.quadraticCurveTo(-1, sd * 11 * w, -9, sd * 16 * w); ctx.lineTo(-5, sd * 3); ctx.closePath();
        ctx.fill(); ctx.stroke();
    }
    ctx.beginPath(); ctx.moveTo(-6, 0); ctx.lineTo(-13, -3.5); ctx.lineTo(-12, 0); ctx.lineTo(-13, 3.5); ctx.closePath(); ctx.fill(); ctx.stroke();
    ctx.beginPath(); ctx.ellipse(0, 0, 7, 3, 0, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
    ctx.beginPath(); ctx.arc(6.5, 0, 2.6, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#5d5d5d'; ctx.beginPath(); ctx.moveTo(8.5, -1); ctx.lineTo(12.5, 0); ctx.lineTo(8.5, 1); ctx.closePath(); ctx.fill();
    ctx.fillStyle = '#ea80fc'; ctx.beginPath(); ctx.arc(7, -1.1, 0.8, 0, Math.PI * 2); ctx.fill();
    ctx.restore();
}

// A fading, tapered light streak (thin at the start, round and bright at the end)
function drawStreak(x1, y1, x2, y2, width, color, alpha) {
    const dx = x2 - x1, dy = y2 - y1, len = Math.hypot(dx, dy);
    if (len < 2 || width <= 0) return;
    ctx.save();
    ctx.translate(x1, y1); ctx.rotate(Math.atan2(dy, dx));
    ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = alpha;
    const g = ctx.createLinearGradient(0, 0, len, 0);
    g.addColorStop(0, 'rgba(0, 0, 0, 0)'); g.addColorStop(1, color);
    ctx.fillStyle = g;
    ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(len, -width / 2); ctx.arc(len, 0, width / 2, -Math.PI / 2, Math.PI / 2); ctx.closePath(); ctx.fill();
    const cg = ctx.createLinearGradient(len * 0.3, 0, len, 0);
    cg.addColorStop(0, 'rgba(0, 0, 0, 0)'); cg.addColorStop(1, 'rgba(255, 255, 255, 0.9)');
    ctx.fillStyle = cg;
    ctx.beginPath(); ctx.moveTo(len * 0.3, 0); ctx.lineTo(len, -width * 0.15); ctx.arc(len, 0, width * 0.15, -Math.PI / 2, Math.PI / 2); ctx.closePath(); ctx.fill();
    ctx.restore();
}

// Tick-marked rune ring used by the arcane / holy teleports
function drawRuneRing(x, y, R, rot, color, alpha, ticks = 12) {
    ctx.save();
    ctx.translate(x, y); ctx.rotate(rot);
    ctx.strokeStyle = color; ctx.globalAlpha = alpha;
    ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(0, 0, R, 0, Math.PI * 2); ctx.stroke();
    ctx.lineWidth = 1; ctx.beginPath(); ctx.arc(0, 0, R * 0.78, 0, Math.PI * 2); ctx.stroke();
    ctx.lineWidth = 1.5;
    for (let i = 0; i < ticks; i++) {
        const a = i * Math.PI * 2 / ticks, r0 = R * 0.8, r1 = i % 3 === 0 ? R * 1.18 : R * 0.98;
        ctx.beginPath(); ctx.moveTo(Math.cos(a) * r0, Math.sin(a) * r0); ctx.lineTo(Math.cos(a) * r1, Math.sin(a) * r1); ctx.stroke();
    }
    ctx.restore();
}

// ==========================================
// Ground layer (under enemies)
// ==========================================

function drawSpaceGround(ef) {
    if (ef.type !== 'aftershock_zone') return false;
    // Dragonknight Aftershock: the landing zone charges up, chevrons closing in, until it detonates
    const p = 1 - clamp01(ef.life / ef.maxLife), R = ef.radius;
    const throb = 0.5 + 0.5 * Math.sin(fxTime * (10 + p * 25));
    ctx.save();
    ctx.translate(ef.x, ef.y);
    const g = ctx.createRadialGradient(0, 0, 0, 0, 0, R);
    g.addColorStop(0, `rgba(229, 57, 53, ${0.08 + 0.25 * p})`); g.addColorStop(1, `rgba(229, 57, 53, ${0.15 + 0.2 * p})`);
    ctx.fillStyle = g; ctx.beginPath(); ctx.arc(0, 0, R, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = `rgba(255, 112, 67, ${0.18 + 0.12 * throb})`;
    ctx.beginPath(); ctx.arc(0, 0, R * p, 0, Math.PI * 2); ctx.fill(); // fills up as the timer runs out
    ctx.strokeStyle = `rgba(255, 82, 82, ${0.5 + 0.5 * throb})`; ctx.lineWidth = 2.5;
    ctx.beginPath(); ctx.arc(0, 0, R, 0, Math.PI * 2); ctx.stroke();
    ctx.fillStyle = `rgba(255, 138, 101, ${0.5 + 0.4 * throb})`;
    for (let i = 0; i < 8; i++) {
        const a = i * Math.PI / 4 + 0.2, r = R * (0.92 - 0.35 * ((fxTime * 1.6 + i * 0.125) % 1));
        ctx.save(); ctx.rotate(a); ctx.translate(r, 0);
        ctx.beginPath(); ctx.moveTo(-6, 0); ctx.lineTo(3, -6); ctx.lineTo(1, 0); ctx.lineTo(3, 6); ctx.closePath(); ctx.fill();
        ctx.restore();
    }
    ctx.restore();
    return true;
}

// ==========================================
// Projectiles
// ==========================================

function drawSpaceProjectile(p) {
    if (p.shape === 'shrapnel') { // Dragonknight Shrapnel Landing: tumbling, red-hot metal shards
        ctx.save();
        ctx.translate(p.x, p.y); ctx.rotate(fxAge(p) * 25);
        ctx.globalCompositeOperation = 'lighter';
        ctx.fillStyle = 'rgba(255, 112, 67, 0.35)'; ctx.beginPath(); ctx.arc(0, 0, 13, 0, Math.PI * 2); ctx.fill();
        ctx.globalCompositeOperation = 'source-over';
        ctx.beginPath(); ctx.moveTo(9, 0); ctx.lineTo(2, -4); ctx.lineTo(-3, -8); ctx.lineTo(-5, -2); ctx.lineTo(-9, 3); ctx.lineTo(0, 5); ctx.closePath();
        sprFill(ctx, '#b0bec5');
        ctx.fillStyle = '#ffab40'; ctx.beginPath(); ctx.moveTo(9, 0); ctx.lineTo(2, -4); ctx.lineTo(0, 5); ctx.closePath(); ctx.fill();
        ctx.restore();
        return true;
    }
    if (p.shape === 'arcane_missile') { // Spellweaver Arcane Arrival: a violet comet with a turning star core
        const ang = Math.atan2(p.vy, p.vx);
        ctx.save();
        ctx.globalCompositeOperation = 'lighter';
        ctx.translate(p.x, p.y);
        const g = ctx.createRadialGradient(0, 0, 0, 0, 0, 16);
        g.addColorStop(0, 'rgba(255, 255, 255, 0.9)'); g.addColorStop(0.35, 'rgba(224, 64, 251, 0.7)'); g.addColorStop(1, 'rgba(124, 77, 255, 0)');
        ctx.fillStyle = g; ctx.beginPath(); ctx.arc(0, 0, 16, 0, Math.PI * 2); ctx.fill();
        ctx.rotate(ang);
        ctx.fillStyle = 'rgba(179, 136, 255, 0.5)';
        ctx.beginPath(); ctx.moveTo(6, -5); ctx.lineTo(-26, 0); ctx.lineTo(6, 5); ctx.closePath(); ctx.fill();
        ctx.rotate(fxAge(p) * 10 - ang);
        ctx.fillStyle = '#ffffff';
        ctx.beginPath();
        for (let i = 0; i < 8; i++) { const a = i * Math.PI / 4, r = i % 2 ? 2 : 7; ctx.lineTo(Math.cos(a) * r, Math.sin(a) * r); }
        ctx.closePath(); ctx.fill();
        ctx.restore();
        return true;
    }
    return false;
}

// ==========================================
// Effects
// ==========================================

function drawSpaceEffect(ef, p, k) {
    switch (ef.type) {
        case 'dash_trail': { // generic dash streak (Nightblade / Swordsaint dashes keep its end on the player)
            drawStreak(ef.x1, ef.y1, ef.x2, ef.y2, (ef.width || 16) * (0.4 + 0.6 * k), ef.color, k);
            return true;
        }
        case 'aftershock_zone': return true; // drawn on the ground layer

        case 'thunder_slam': { // Dragonknight Thunder Leap landing / Aftershock detonation
            const col = ef.color || '#ff7043', R = ef.radius;
            if (!ef.burstDone) {
                ef.burstDone = true;
                ef.bolts = Array.from({ length: 7 }, (_, i) => {
                    const a = i * Math.PI * 2 / 7 + Math.random() * 0.5, pts = [[0, 0]];
                    for (let r = 0; r < R * 1.1;) { r += 12 + Math.random() * 14; const aa = a + (Math.random() - 0.5) * 0.5; pts.push([Math.cos(aa) * r, Math.sin(aa) * r]); }
                    return pts;
                });
                burst(ef.x, ef.y, 0, Math.PI * 2, 14, { kind: 'debris', color: '#6d4c41', size: 4, life: 0.5, speed: [120, 320], drag: 5 });
                burst(ef.x, ef.y, 0, Math.PI * 2, 14, { kind: 'spark', color: '#ffe082', size: 2.5, life: 0.3, speed: [220, 520], drag: 5 });
                dustPuff(ef.x, ef.y, 0, Math.PI * 2, 8);
                addShake(ef.big ? 5 : 4);
            }
            ctx.save();
            ctx.translate(ef.x, ef.y);
            ctx.globalAlpha = 1;
            const sc = ctx.createRadialGradient(0, 0, 0, 0, 0, R * 0.8);
            sc.addColorStop(0, `rgba(30, 12, 6, ${0.45 * k})`); sc.addColorStop(1, 'rgba(30, 12, 6, 0)');
            ctx.fillStyle = sc; ctx.beginPath(); ctx.arc(0, 0, R * 0.8, 0, Math.PI * 2); ctx.fill();
            ctx.globalCompositeOperation = 'lighter';
            const fl = Math.max(0, 1 - p * 3);
            if (fl > 0) {
                const g = ctx.createRadialGradient(0, 0, 0, 0, 0, R * 0.75);
                g.addColorStop(0, `rgba(255, 255, 255, ${fl})`); g.addColorStop(0.4, withAlpha(col, 0.7 * fl)); g.addColorStop(1, withAlpha(col, 0));
                ctx.fillStyle = g; ctx.beginPath(); ctx.arc(0, 0, R * 0.75, 0, Math.PI * 2); ctx.fill();
            }
            const SR = R * 1.15 * easeOut(Math.min(1, p * 1.6));
            ctx.strokeStyle = withAlpha(col, k); ctx.lineWidth = 7 * k + 1;
            ctx.beginPath(); ctx.arc(0, 0, SR, 0, Math.PI * 2); ctx.stroke();
            ctx.strokeStyle = `rgba(255, 255, 255, ${0.8 * k})`; ctx.lineWidth = 2 * k;
            ctx.beginPath(); ctx.arc(0, 0, SR * 0.92, 0, Math.PI * 2); ctx.stroke();
            if (p < 0.5) { // lightning forks crawl out along the ground
                const bk = 1 - p / 0.5;
                ctx.lineJoin = 'round'; ctx.lineCap = 'round';
                for (const pts of ef.bolts) {
                    if (Math.random() < 0.12) continue; // flicker
                    const n = Math.max(2, Math.ceil(pts.length * Math.min(1, p * 5)));
                    const path = () => { ctx.beginPath(); for (let i = 0; i < n; i++) ctx.lineTo(pts[i][0], pts[i][1]); };
                    ctx.strokeStyle = `rgba(255, 236, 179, ${0.5 * bk})`; ctx.lineWidth = 5; path(); ctx.stroke();
                    ctx.strokeStyle = `rgba(255, 255, 255, ${bk})`; ctx.lineWidth = 1.5; path(); ctx.stroke();
                }
            }
            ctx.restore();
            return true;
        }

        case 'blink': { // Spellweaver Blink: the mage folds away into a collapsing ring and unfolds inside a rune circle
            if (!ef.burstDone) {
                ef.burstDone = true;
                for (let i = 0; i <= 14; i++) {
                    const t = i / 14;
                    spawnParticle({ kind: 'dot', color: i % 2 ? '#b388ff' : '#80d8ff', x: lerp(ef.x0, ef.x1, t) + jitter(14), y: lerp(ef.y0, ef.y1, t) + jitter(14), vx: jitter(40), vy: jitter(40), size: 2, life: 0.25 + t * 0.3, drag: 2, grow: 0, spin: 0, rot: 0 });
                }
                for (let i = 0; i < 12; i++) { // motes sucked into the departure point
                    const a = i * Math.PI / 6;
                    spawnParticle({ kind: 'dot', color: '#b388ff', x: ef.x0 + Math.cos(a) * 34, y: ef.y0 + Math.sin(a) * 34, vx: -Math.cos(a) * 150, vy: -Math.sin(a) * 150, size: 2, life: 0.22, drag: 1, grow: 0, spin: 0, rot: 0 });
                }
                burst(ef.x1, ef.y1, 0, Math.PI * 2, 12, { kind: 'spark', color: '#e1bee7', size: 2, life: 0.3, speed: [120, 300], drag: 5 });
            }
            ctx.save();
            ctx.globalCompositeOperation = 'lighter';
            const q0 = Math.min(1, p * 2.2);
            if (q0 < 1) {
                ctx.strokeStyle = `rgba(179, 136, 255, ${1 - q0})`; ctx.lineWidth = 3 * (1 - q0) + 0.5;
                ctx.beginPath(); ctx.arc(ef.x0, ef.y0, 34 * (1 - easeOut(q0)) + 2, 0, Math.PI * 2); ctx.stroke();
            }
            const fl = Math.max(0, 1 - p * 2.5);
            if (fl > 0) {
                const g = ctx.createRadialGradient(ef.x1, ef.y1, 0, ef.x1, ef.y1, 40);
                g.addColorStop(0, `rgba(255, 255, 255, ${fl})`); g.addColorStop(0.5, `rgba(128, 216, 255, ${0.5 * fl})`); g.addColorStop(1, 'rgba(124, 77, 255, 0)');
                ctx.fillStyle = g; ctx.beginPath(); ctx.arc(ef.x1, ef.y1, 40, 0, Math.PI * 2); ctx.fill();
            }
            drawRuneRing(ef.x1, ef.y1, 20 + 22 * easeOut(p), p * 2.5, '#80d8ff', k);
            ctx.restore();
            return true;
        }

        case 'vault_land': { // Ranger Vault landing: a light ring of dust and kicked-up leaves
            if (!ef.burstDone) {
                ef.burstDone = true;
                dustPuff(ef.x, ef.y, 0, Math.PI * 2, 6);
                burst(ef.x, ef.y, 0, Math.PI * 2, 7, { kind: 'leaf', color: '#81c784', size: 6, life: 0.6, speed: [80, 200], drag: 4 });
            }
            ctx.save();
            ctx.globalCompositeOperation = 'lighter';
            ctx.strokeStyle = `rgba(197, 225, 165, ${k})`; ctx.lineWidth = 2.5 * k + 0.5;
            ctx.beginPath(); ctx.arc(ef.x, ef.y, 10 + 40 * easeOut(p), 0, Math.PI * 2); ctx.stroke();
            ctx.restore();
            return true;
        }

        case 'shadow_cut': { // Nightblade Phantom Dash: a razor slash across each enemy it passed through
            const len = ef.radius || 34, w = 5 * Math.sin(Math.min(1, p * 4) * Math.PI / 2) * k;
            ctx.save();
            ctx.translate(ef.x, ef.y); ctx.rotate(ef.angle + 0.7);
            ctx.globalCompositeOperation = 'lighter';
            ctx.fillStyle = `rgba(234, 128, 252, ${0.8 * k})`;
            ctx.beginPath(); ctx.moveTo(-len, 0); ctx.quadraticCurveTo(0, -w * 2, len, 0); ctx.quadraticCurveTo(0, w * 0.6, -len, 0); ctx.fill();
            ctx.fillStyle = `rgba(255, 255, 255, ${k})`;
            ctx.beginPath(); ctx.moveTo(-len * 0.8, 0); ctx.quadraticCurveTo(0, -w * 0.8, len * 0.8, 0); ctx.quadraticCurveTo(0, w * 0.2, -len * 0.8, 0); ctx.fill();
            ctx.restore();
            return true;
        }

        case 'iai_flash': { // Swordsaint Shadow Step: the cut appears along the path a beat after the dash
            if (p < 0.12) return true;
            const q = (p - 0.12) / 0.88;
            if (!ef.burstDone) {
                ef.burstDone = true;
                for (let i = 0; i < 10; i++) { const t = Math.random(); burst(lerp(ef.x1, ef.x2, t), lerp(ef.y1, ef.y2, t), Math.random() * Math.PI * 2, 0.5, 1, { kind: 'spark', color: '#84ffff', size: 2, life: 0.25, speed: [60, 180], drag: 5 }); }
                spawnParticle({ kind: 'ring', color: '#e0f7fa', x: ef.x2, y: ef.y2, vx: 0, vy: 0, size: 4, grow: 140, life: 0.2, drag: 0, spin: 0, rot: 0 });
            }
            const dx = ef.x2 - ef.x1, dy = ef.y2 - ef.y1, len = Math.hypot(dx, dy);
            if (len < 4) return true;
            const w = 7 * (1 - q) * Math.min(1, q * 8);
            ctx.save();
            ctx.translate(ef.x1, ef.y1); ctx.rotate(Math.atan2(dy, dx));
            ctx.globalCompositeOperation = 'lighter';
            ctx.fillStyle = `rgba(0, 229, 255, ${0.6 * (1 - q)})`;
            ctx.beginPath(); ctx.moveTo(-10, 0); ctx.quadraticCurveTo(len / 2, -w * 1.6, len + 10, 0); ctx.quadraticCurveTo(len / 2, w * 1.6, -10, 0); ctx.fill();
            ctx.fillStyle = `rgba(255, 255, 255, ${1 - q})`;
            ctx.beginPath(); ctx.moveTo(-10, 0); ctx.quadraticCurveTo(len / 2, -w * 0.4, len + 10, 0); ctx.quadraticCurveTo(len / 2, w * 0.4, -10, 0); ctx.fill();
            ctx.restore();
            return true;
        }

        case 'spatial_swap': { // Swordsaint Spatial Swap: two rifts linked by a twisting helix of light
            if (!ef.burstDone) {
                ef.burstDone = true;
                for (const [x, y] of [[ef.x0, ef.y0], [ef.x1, ef.y1]]) burst(x, y, 0, Math.PI * 2, 10, { kind: 'spark', color: '#84ffff', size: 2, life: 0.3, speed: [120, 300], drag: 5 });
                addShake(1.5);
            }
            const dx = ef.x1 - ef.x0, dy = ef.y1 - ef.y0, len = Math.hypot(dx, dy);
            ctx.save();
            ctx.globalCompositeOperation = 'lighter';
            for (const [x, y, s] of [[ef.x0, ef.y0, 1], [ef.x1, ef.y1, -1]]) { // rifts
                const R = 30 * (0.4 + 0.6 * k);
                const g = ctx.createRadialGradient(x, y, 0, x, y, R);
                g.addColorStop(0, `rgba(255, 255, 255, ${0.8 * k})`); g.addColorStop(0.4, `rgba(0, 229, 255, ${0.4 * k})`); g.addColorStop(1, 'rgba(0, 96, 100, 0)');
                ctx.fillStyle = g; ctx.beginPath(); ctx.arc(x, y, R, 0, Math.PI * 2); ctx.fill();
                ctx.strokeStyle = `rgba(132, 255, 255, ${k})`; ctx.lineWidth = 2;
                ctx.setLineDash([8, 6]); ctx.lineDashOffset = s * fxTime * 60;
                ctx.beginPath(); ctx.arc(x, y, R + 6, 0, Math.PI * 2); ctx.stroke();
                ctx.setLineDash([]);
            }
            if (len > 10) {
                ctx.translate(ef.x0, ef.y0); ctx.rotate(Math.atan2(dy, dx));
                const n = Math.max(8, Math.round(len / 10)), amp = 9 * k;
                for (const ph of [0, Math.PI]) {
                    ctx.strokeStyle = ph ? `rgba(255, 255, 255, ${0.8 * k})` : `rgba(0, 229, 255, ${k})`; ctx.lineWidth = ph ? 1.5 : 3;
                    ctx.beginPath();
                    for (let i = 0; i <= n; i++) { const t = i / n; ctx.lineTo(t * len, Math.sin(t * Math.PI * 4 + ph + fxTime * 25) * amp * Math.sin(t * Math.PI)); }
                    ctx.stroke();
                }
            }
            ctx.restore();
            return true;
        }

        case 'phase_light': { // Cleric Phase Shift: a halo of light (collapsing where you left, blooming where you land)
            const col = ef.color || '#ffd54f', R = ef.radius || 40;
            if (!ef.burstDone) {
                ef.burstDone = true;
                if (!ef.depart) burst(ef.x, ef.y, 0, Math.PI * 2, 10, { kind: 'dot', color: '#fff8e1', size: 2, life: 0.45, speed: [60, 180], drag: 3 });
            }
            const q = ef.depart ? 1 - easeOut(p) : easeOut(p);
            ctx.save();
            ctx.globalCompositeOperation = 'lighter';
            ctx.translate(ef.x, ef.y);
            const g = ctx.createRadialGradient(0, 0, 0, 0, 0, R);
            g.addColorStop(0, `rgba(255, 255, 255, ${0.8 * k})`); g.addColorStop(0.35, withAlpha(col, 0.45 * k)); g.addColorStop(1, withAlpha(col, 0));
            ctx.fillStyle = g; ctx.beginPath(); ctx.arc(0, 0, R, 0, Math.PI * 2); ctx.fill();
            ctx.rotate(p * 0.8);
            ctx.fillStyle = withAlpha(col, 0.7 * k);
            for (let i = 0; i < 8; i++) {
                const a = i * Math.PI / 4, l = R * (i % 2 ? 0.9 : 1.4) * (0.4 + 0.6 * q);
                ctx.beginPath(); ctx.moveTo(Math.cos(a - 0.1) * 6, Math.sin(a - 0.1) * 6); ctx.lineTo(Math.cos(a) * l, Math.sin(a) * l); ctx.lineTo(Math.cos(a + 0.1) * 6, Math.sin(a + 0.1) * 6); ctx.fill();
            }
            ctx.strokeStyle = withAlpha(col, k); ctx.lineWidth = 2.5 * k + 0.5;
            ctx.beginPath(); ctx.arc(0, 0, R * (0.3 + 0.7 * q), 0, Math.PI * 2); ctx.stroke();
            ctx.restore();
            return true;
        }

        case 'holy_nova': { // Cleric empowered Phase Shift: a stunning wave of light
            const col = ef.color || '#ffd54f';
            if (!ef.burstDone) {
                ef.burstDone = true;
                burst(ef.x, ef.y, 0, Math.PI * 2, 18, { kind: 'dot', color: '#fff8e1', size: 2.2, life: 0.4, speed: [ef.radius * 1.5, ef.radius * 2.5], drag: 4 });
                addShake(2);
            }
            const R = ef.radius * easeOut(Math.min(1, p * 1.5));
            ctx.save();
            ctx.globalCompositeOperation = 'lighter';
            const g = ctx.createRadialGradient(ef.x, ef.y, R * 0.5, ef.x, ef.y, Math.max(1, R));
            g.addColorStop(0, withAlpha(col, 0)); g.addColorStop(1, withAlpha(col, 0.3 * k));
            ctx.fillStyle = g; ctx.beginPath(); ctx.arc(ef.x, ef.y, Math.max(1, R), 0, Math.PI * 2); ctx.fill();
            ctx.strokeStyle = withAlpha(col, k); ctx.lineWidth = 5 * k + 0.5;
            ctx.beginPath(); ctx.arc(ef.x, ef.y, Math.max(1, R), 0, Math.PI * 2); ctx.stroke();
            ctx.strokeStyle = `rgba(255, 255, 255, ${0.7 * k})`; ctx.lineWidth = 1.5;
            ctx.beginPath(); ctx.arc(ef.x, ef.y, Math.max(1, R * 0.94), 0, Math.PI * 2); ctx.stroke();
            ctx.restore();
            return true;
        }

        case 'transposition': { // Cleric Divine Transposition: two golden arcs trading places
            const dx = ef.x1 - ef.x0, dy = ef.y1 - ef.y0, len = Math.hypot(dx, dy);
            if (len < 4) return true;
            ctx.save();
            ctx.translate(ef.x0, ef.y0); ctx.rotate(Math.atan2(dy, dx));
            ctx.globalCompositeOperation = 'lighter';
            const t = easeOut(Math.min(1, p * 1.6));
            for (const s of [-1, 1]) {
                const h = s * Math.min(70, len * 0.3);
                ctx.strokeStyle = s < 0 ? `rgba(255, 213, 79, ${0.8 * k})` : `rgba(255, 138, 101, ${0.6 * k})`; ctx.lineWidth = 3 * k + 0.5;
                ctx.beginPath(); ctx.moveTo(0, 0); ctx.quadraticCurveTo(len / 2, h * 2, len, 0); ctx.stroke();
                // a mote rides each arc: the cleric's one way, the enemy's the other
                const u = s < 0 ? t : 1 - t, mx = 2 * (1 - u) * u * (len / 2) + u * u * len, my = 2 * (1 - u) * u * h * 2;
                ctx.fillStyle = `rgba(255, 255, 255, ${k})`;
                ctx.beginPath(); ctx.arc(mx, my, 5, 0, Math.PI * 2); ctx.fill();
            }
            ctx.restore();
            return true;
        }

        case 'raven_flight': { // Cleric Raven Flight: a flock tears along the path and the cleric re-forms from it
            if (!ef.burstDone) {
                ef.burstDone = true;
                burst(ef.x0, ef.y0, 0, Math.PI * 2, 10, { kind: 'leaf', color: '#1a0f2e', size: 7, life: 0.7, speed: [60, 200], drag: 4 });
                burst(ef.x0, ef.y0, 0, Math.PI * 2, 6, { kind: 'smoke', color: '#4a148c', size: 6, grow: 30, life: 0.5, speed: [30, 90], drag: 3 });
            }
            if (!ef.arriveDone && p > 0.7) {
                ef.arriveDone = true;
                burst(ef.x1, ef.y1, 0, Math.PI * 2, 10, { kind: 'leaf', color: '#311b92', size: 7, life: 0.7, speed: [60, 200], drag: 4 });
                spawnParticle({ kind: 'ring', color: '#ce93d8', x: ef.x1, y: ef.y1, vx: 0, vy: 0, size: 8, grow: 160, life: 0.25, drag: 0, spin: 0, rot: 0 });
            }
            for (let i = 0; i < RAVEN_COUNT; i++) {
                const r = ravenPos(ef, i, p);
                if (r.q <= 0 || r.q >= 1) continue;
                drawRaven(r.x, r.y, r.ang, fxTime * 28 + i * 1.3, 1.25, Math.min(1, (1 - r.q) * 4));
            }
            return true;
        }

        case 'pounce_rake': { // Druid Feral Pounce landing: three claw marks torn across the landing spot
            if (!ef.burstDone) {
                ef.burstDone = true;
                dustPuff(ef.x, ef.y, 0, Math.PI * 2, 7, '#6d5d4b');
                burst(ef.x, ef.y, ef.angle, 1.4, 10, { kind: 'spark', color: '#ff7043', size: 2.5, life: 0.25, speed: [200, 420], drag: 6 });
                addShake(2.5);
            }
            ctx.save();
            ctx.translate(ef.x, ef.y); ctx.rotate(ef.angle);
            ctx.globalCompositeOperation = 'lighter';
            ctx.strokeStyle = `rgba(255, 171, 145, ${0.4 * k})`; ctx.lineWidth = 2;
            ctx.beginPath(); ctx.arc(0, 0, ef.radius * easeOut(p), 0, Math.PI * 2); ctx.stroke();
            for (let i = -1; i <= 1; i++) {
                const q = clamp01((p - (i + 1) * 0.05) * 5), L = 46 * easeOut(q), w = 4.5 * (1 - p * 0.6);
                if (q <= 0) continue;
                ctx.save(); ctx.translate(0, i * 13); ctx.rotate(-0.5);
                ctx.fillStyle = `rgba(255, 82, 82, ${0.7 * k})`;
                ctx.beginPath(); ctx.moveTo(-L / 2, 0); ctx.quadraticCurveTo(0, -w * 1.8, L / 2, 0); ctx.quadraticCurveTo(0, w * 0.4, -L / 2, 0); ctx.fill();
                ctx.fillStyle = `rgba(255, 255, 255, ${k})`;
                ctx.beginPath(); ctx.moveTo(-L * 0.4, 0); ctx.quadraticCurveTo(0, -w * 0.7, L * 0.4, 0); ctx.quadraticCurveTo(0, w * 0.1, -L * 0.4, 0); ctx.fill();
                ctx.restore();
            }
            ctx.restore();
            return true;
        }

        case 'spore_burst': { // Druid Spore Burst: a ring of spore puffs blasting outward
            const R = ef.radius;
            if (!ef.burstDone) {
                ef.burstDone = true;
                ef.puffs = Array.from({ length: 14 }, (_, i) => ({ a: i * Math.PI * 2 / 14 + jitter(0.3), r: 0.75 + Math.random() * 0.3, s: 0.7 + Math.random() * 0.6 }));
                burst(ef.x, ef.y, 0, Math.PI * 2, 18, { kind: 'dot', color: '#eeff41', size: 2, life: 0.6, speed: [R * 1.2, R * 2.4], drag: 3 });
                burst(ef.x, ef.y, 0, Math.PI * 2, 8, { kind: 'smoke', color: '#9ccc65', size: 8, grow: 40, life: 0.6, speed: [R * 0.8, R * 1.5], drag: 3 });
                addShake(1.5);
            }
            const q = easeOut(Math.min(1, p * 1.7));
            ctx.save();
            ctx.translate(ef.x, ef.y);
            ctx.globalCompositeOperation = 'lighter';
            const fl = Math.max(0, 1 - p * 3);
            if (fl > 0) {
                const g = ctx.createRadialGradient(0, 0, 0, 0, 0, R * 0.6);
                g.addColorStop(0, `rgba(238, 255, 65, ${0.7 * fl})`); g.addColorStop(1, 'rgba(139, 195, 74, 0)');
                ctx.fillStyle = g; ctx.beginPath(); ctx.arc(0, 0, R * 0.6, 0, Math.PI * 2); ctx.fill();
            }
            ctx.strokeStyle = `rgba(204, 255, 144, ${0.8 * k})`; ctx.lineWidth = 3 * k;
            ctx.beginPath(); ctx.arc(0, 0, R * q, 0, Math.PI * 2); ctx.stroke();
            ctx.globalCompositeOperation = 'source-over';
            for (const f of ef.puffs) { // soft spore clouds with a pale, sunlit top
                const r = R * q * f.r, s = (10 + 14 * q) * f.s, px = Math.cos(f.a) * r, py = Math.sin(f.a) * r;
                const pg = ctx.createRadialGradient(px - s * 0.3, py - s * 0.3, 0, px, py, s);
                pg.addColorStop(0, `rgba(230, 238, 156, ${0.6 * k})`); pg.addColorStop(0.5, `rgba(156, 204, 101, ${0.4 * k})`); pg.addColorStop(1, 'rgba(104, 159, 56, 0)');
                ctx.fillStyle = pg; ctx.beginPath(); ctx.arc(px, py, s, 0, Math.PI * 2); ctx.fill();
            }
            ctx.restore();
            return true;
        }

        case 'gravity_crush': { // Paladin Gravitational Crashing: rings of force collapsing onto the landing point
            ctx.save();
            ctx.globalCompositeOperation = 'lighter';
            for (let i = 0; i < 3; i++) {
                const q = clamp01(p * 1.6 - i * 0.2);
                if (q <= 0 || q >= 1) continue;
                ctx.strokeStyle = `rgba(255, 202, 40, ${(1 - q) * 0.9})`; ctx.lineWidth = 3;
                ctx.beginPath(); ctx.arc(ef.x, ef.y, ef.radius * (1 - easeOut(q)) + 4, 0, Math.PI * 2); ctx.stroke();
            }
            ctx.restore();
            return true;
        }
    }
    return false;
}

// ==========================================
// Grapples, chains and the charge
// ==========================================

// Draws whatever links the player to a grappleTarget: the Machinist's magnet cable, the Paladin's Iron Pull chain,
// or the wedge of light in front of a Righteous Charge
function drawGrappleCable(gt) {
    if (gt.kind === 'charge') { drawChargeRam(gt); return; }
    if (gt.noLine) return;
    const dx = gt.x - player.x, dy = gt.y - player.y, len = Math.hypot(dx, dy);
    if (len < 16) return;
    const ang = Math.atan2(dy, dx);
    ctx.save();
    ctx.translate(player.x, player.y); ctx.rotate(ang);
    if (gt.kind === 'chain') { // Paladin Iron Pull: a golden chain reeling the paladin to the hammer
        ctx.globalCompositeOperation = 'lighter';
        ctx.strokeStyle = 'rgba(255, 213, 79, 0.3)'; ctx.lineWidth = 9;
        ctx.beginPath(); ctx.moveTo(14, 0); ctx.lineTo(len, 0); ctx.stroke();
        ctx.globalCompositeOperation = 'source-over';
        let i = 0;
        for (let d = len - 6; d > 14; d -= 9, i++) { // links counted from the hammer, so they slide toward it as you reel in
            if (i % 2 === 0) {
                ctx.strokeStyle = '#4e342e'; ctx.lineWidth = 4.5; ctx.beginPath(); ctx.ellipse(d, 0, 6, 3.5, 0, 0, Math.PI * 2); ctx.stroke();
                ctx.strokeStyle = '#ffca28'; ctx.lineWidth = 2.2; ctx.beginPath(); ctx.ellipse(d, 0, 6, 3.5, 0, 0, Math.PI * 2); ctx.stroke();
            } else {
                ctx.fillStyle = '#4e342e'; ctx.fillRect(d - 6, -1.8, 12, 3.6);
                ctx.fillStyle = '#ffe082'; ctx.fillRect(d - 5, -0.9, 10, 1.8);
            }
        }
        ctx.restore();
        return;
    }
    // Machinist Magnetic Grapple: a steel cable with current crackling along it, ending in a magnet head
    const sx = 12;
    ctx.lineCap = 'round';
    ctx.strokeStyle = '#263238'; ctx.lineWidth = 4.5; ctx.beginPath(); ctx.moveTo(sx, 0); ctx.lineTo(len - 8, 0); ctx.stroke();
    ctx.strokeStyle = '#90a4ae'; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.moveTo(sx, -0.5); ctx.lineTo(len - 8, -0.5); ctx.stroke();
    ctx.globalCompositeOperation = 'lighter';
    ctx.strokeStyle = 'rgba(64, 196, 255, 0.85)'; ctx.lineWidth = 1.2;
    ctx.beginPath(); ctx.moveTo(sx, 0);
    for (let d = sx + 12; d < len - 8; d += 12) ctx.lineTo(d, jitter(9));
    ctx.lineTo(len - 8, 0); ctx.stroke();
    for (let i = 0; i < 3; i++) { // magnetic field pulses at the head
        const q = (fxTime * 2.5 + i / 3) % 1;
        ctx.strokeStyle = `rgba(64, 196, 255, ${0.7 * (1 - q)})`; ctx.lineWidth = 2;
        ctx.beginPath(); ctx.arc(len, 0, 8 + q * 22, -1.1, 1.1); ctx.stroke();
    }
    ctx.globalCompositeOperation = 'source-over';
    ctx.translate(len - 8, 0);
    ctx.beginPath(); ctx.rect(-7, -6, 8, 12); sprFill(ctx, '#455a64');
    for (const s of [-1, 1]) {
        ctx.beginPath(); ctx.rect(0, s * 6 - (s > 0 ? 4 : 0), 9, 4); sprFill(ctx, '#d32f2f');
        ctx.beginPath(); ctx.rect(7, s * 6 - (s > 0 ? 4 : 0), 3, 4); sprFill(ctx, '#eceff1');
    }
    ctx.restore();
}

// Paladin Righteous Charge: a wedge of holy light shoves ahead of the paladin (Juggernaut wraps them in it)
function drawChargeRam(gt) {
    ctx.save();
    ctx.translate(player.x, player.y); ctx.rotate(gt.angle);
    ctx.globalCompositeOperation = 'lighter';
    if (gt.juggernaut) {
        const g = ctx.createRadialGradient(0, 0, 10, 0, 0, 34);
        g.addColorStop(0, 'rgba(255, 213, 79, 0)'); g.addColorStop(1, 'rgba(255, 213, 79, 0.45)');
        ctx.fillStyle = g; ctx.beginPath(); ctx.arc(0, 0, 34, 0, Math.PI * 2); ctx.fill();
        ctx.strokeStyle = 'rgba(255, 248, 225, 0.8)'; ctx.lineWidth = 1.5;
        ctx.beginPath(); ctx.arc(0, 0, 34, 0, Math.PI * 2); ctx.stroke();
    }
    const flick = 0.85 + Math.random() * 0.15;
    const g = ctx.createLinearGradient(14, 0, 50, 0);
    g.addColorStop(0, 'rgba(255, 213, 79, 0)'); g.addColorStop(1, `rgba(255, 248, 225, ${0.85 * flick})`);
    ctx.fillStyle = g;
    ctx.beginPath(); ctx.moveTo(14, -30); ctx.quadraticCurveTo(58, 0, 14, 30); ctx.quadraticCurveTo(36, 0, 14, -30); ctx.fill();
    ctx.strokeStyle = `rgba(255, 255, 255, ${0.9 * flick})`; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(18, -24); ctx.quadraticCurveTo(52, 0, 18, 24); ctx.stroke();
    ctx.restore();
}

// ==========================================
// Emitters (game time)
// ==========================================

function updateSpaceEmitters(dt) {
    for (let i = dashGhosts.length - 1; i >= 0; i--) { dashGhosts[i].life -= dt; if (dashGhosts[i].life <= 0) dashGhosts.splice(i, 1); }

    const d = player.dash;
    if (d && d.kind === 'thunder_leap') { // embers stream off the airborne knight
        emit(70, dt, () => spawnParticle({ kind: 'dot', color: Math.random() < 0.5 ? '#ff7043' : '#ffca28', x: player.x + jitter(16), y: player.y - player.z + jitter(16), vx: -Math.cos(d.angle) * 120 + jitter(40), vy: -Math.sin(d.angle) * 120 + jitter(40), size: 1.8, life: 0.35, drag: 3, grow: 0, spin: 0, rot: 0 }));
    } else if (d && d.kind === 'vault') { // wind rushing past the ranger
        emit(60, dt, () => spawnParticle({ kind: 'spark', color: '#dcedc8', x: player.x + jitter(26), y: player.y - player.z + jitter(26), vx: -Math.cos(d.angle) * 500, vy: -Math.sin(d.angle) * 500, size: 1.4, life: 0.18, drag: 5, grow: 0, spin: 0, rot: 0 }));
    } else if (d && d.kind === 'phantom_dash') {
        emit(90, dt, () => spawnParticle({ kind: 'smoke', color: '#311b92', x: player.x + jitter(14), y: player.y + jitter(14), vx: jitter(30), vy: jitter(30), size: 6, grow: 22, life: 0.45, drag: 2, spin: 0, rot: 0 }));
    } else if (d && d.kind === 'shadow_step') {
        emit(90, dt, () => spawnParticle({ kind: 'dot', color: '#84ffff', x: player.x + jitter(18), y: player.y + jitter(18), vx: jitter(40), vy: jitter(40), size: 1.6, life: 0.3, drag: 2, grow: 0, spin: 0, rot: 0 }));
    } else if (d && d.kind === 'pounce') {
        emit(50, dt, () => spawnParticle({ kind: 'smoke', color: '#8d8478', x: player.x + jitter(16), y: player.y + jitter(16), vx: jitter(30), vy: jitter(30), size: 4, grow: 18, life: 0.35, drag: 3, spin: 0, rot: 0 }));
    }

    const gt = player.grappleTarget;
    if (gt && gt.kind === 'charge') { // Righteous Charge: dust kicked up behind, gilded afterimages
        if (gt.trail) { gt.trail.x2 = player.x; gt.trail.y2 = player.y; }
        emit(45, dt, () => spawnParticle({ kind: 'smoke', color: '#8d8478', x: player.x - Math.cos(gt.angle) * 14 + jitter(20), y: player.y - Math.sin(gt.angle) * 14 + jitter(20), vx: -Math.cos(gt.angle) * 60 + jitter(40), vy: -Math.sin(gt.angle) * 60 + jitter(40), size: 5, grow: 24, life: 0.45, drag: 3, spin: 0, rot: 0 }));
        emit(40, dt, () => spawnParticle({ kind: 'spark', color: '#ffe082', x: player.x + Math.cos(gt.angle) * 30 + jitter(30), y: player.y + Math.sin(gt.angle) * 30 + jitter(30), vx: -Math.cos(gt.angle) * 300, vy: -Math.sin(gt.angle) * 300, size: 1.6, life: 0.2, drag: 4, grow: 0, spin: 0, rot: 0 }));
        gt.ghostT = (gt.ghostT || 0) - dt;
        if (gt.ghostT <= 0) { gt.ghostT = 0.035; spawnDashGhost('#ffd54f', gt.juggernaut, 0.22, gt.angle); }
    } else if (gt && gt.kind === 'chain') {
        emit(30, dt, () => spawnParticle({ kind: 'dot', color: '#ffe082', x: player.x + jitter(20), y: player.y + jitter(20), vx: jitter(30), vy: jitter(30), size: 1.6, life: 0.3, drag: 2, grow: 0, spin: 0, rot: 0 }));
        gt.ghostT = (gt.ghostT || 0) - dt;
        if (gt.ghostT <= 0) { gt.ghostT = 0.04; spawnDashGhost('#ffd54f', true, 0.18, Math.atan2(gt.y - player.y, gt.x - player.x)); }
    } else if (gt && gt.kind === 'magnet') {
        gt.ghostT = (gt.ghostT || 0) - dt;
        if (gt.ghostT <= 0) { gt.ghostT = 0.04; spawnDashGhost('#40c4ff', true, 0.18, Math.atan2(gt.y - player.y, gt.x - player.x)); }
        emit(40, dt, () => spawnParticle({ kind: 'spark', color: '#80d8ff', x: player.x + jitter(20), y: player.y + jitter(20), vx: jitter(80), vy: jitter(80), size: 1.3, life: 0.15, drag: 3, grow: 0, spin: 0, rot: 0 }));
    }

    for (const p of projectiles) {
        if (p.isEnemy) continue;
        if (p.shape === 'arcane_missile') {
            emit(70, dt, () => spawnParticle({ kind: 'dot', color: Math.random() < 0.5 ? '#e040fb' : '#b388ff', x: p.x + jitter(8), y: p.y + jitter(8), vx: -p.vx * 0.1 + jitter(40), vy: -p.vy * 0.1 + jitter(40), size: 1.8, life: 0.35, drag: 3, grow: 0, spin: 0, rot: 0 }));
        } else if (p.shape === 'shrapnel') {
            emit(50, dt, () => spawnParticle({ kind: 'spark', color: '#ffab40', x: p.x, y: p.y, vx: -p.vx * 0.2 + jitter(60), vy: -p.vy * 0.2 + jitter(60), size: 1.5, life: 0.2, drag: 4, grow: 0, spin: 0, rot: 0 }));
        }
    }

    for (const ef of effects) {
        if (ef.type === 'raven_flight') { // dark wisps trail the flock
            const p = 1 - clamp01(ef.life / ef.maxLife);
            for (let i = 0; i < RAVEN_COUNT; i += 2) {
                const r = ravenPos(ef, i, p);
                if (r.q > 0 && r.q < 1) emit(30, dt, () => spawnParticle({ kind: 'smoke', color: '#4a148c', x: r.x, y: r.y, vx: 0, vy: 0, size: 3, grow: 14, life: 0.35, drag: 1, spin: 0, rot: 0 }));
            }
        } else if (ef.type === 'aftershock_zone') {
            emit(14, dt, () => { const a = Math.random() * Math.PI * 2, r = Math.random() * ef.radius; spawnParticle({ kind: 'dot', color: '#ff8a65', x: ef.x + Math.cos(a) * r, y: ef.y + Math.sin(a) * r, vx: jitter(10), vy: -40, size: 1.6, life: 0.5, drag: 0.5, grow: 0, spin: 0, rot: 0 }); });
        }
    }
}
