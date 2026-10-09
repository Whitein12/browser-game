// ==========================================
// enemysprites.js - Enemy sprites: slimes, the Slime King, the Amalgam, their projectiles, splats and puddles
// ==========================================
// drawEnemySprite(e) / drawEnemyProjectile(p) / drawEnemyGround(ef) return true when they handled the object,
// so main.js skips its legacy shapes. Animation is driven by fxTime and by how far the enemy moved since last frame.
// Top-down: a hop lifts the body off its shadow; landing spreads it wide.

const SLIME_TYPES = { slime_melee: 1, slime_ranged: 1, boss_slime: 1, voltaic_ooze: 1, toxic_sludge: 1, amalgam_minion: 1, boss_amalgam: 1,
    spore_slime: 1, crystal_slime: 1, slime_warden: 1, queen_guard: 1, boss_slime_queen: 1, brood_pod: 1 };
const AMALGAM_LUMPS = ['#8bc34a', '#ab47bc', '#03a9f4', '#cddc39']; // the slimes it swallowed, still showing

// Track movement between frames to drive hops and facing
function animMotion(e) {
    if (e.ax === undefined) { e.ax = e.x; e.ay = e.y; e.hop = Math.random() * 6; e.mv = 0; e.face = 0; e.seed = Math.random() * 100; }
    const dx = e.x - e.ax, dy = e.y - e.ay, d = Math.hypot(dx, dy);
    e.ax = e.x; e.ay = e.y;
    if (d > 0.05 && d < 80) { e.hop += d * (e.type.startsWith('boss') ? 0.045 : 0.1); e.face = Math.atan2(dy, dx); }
    e.mv += ((d > 0.2 ? 1 : 0) - e.mv) * 0.15;
}

// Wobbly blob outline, stretched along `dir`; the path is left in screen space for lit fills
function slimePath(c, x, y, r, sx, sy, dir, t, seed) {
    c.save(); c.translate(x, y); c.rotate(dir); c.scale(sx, sy);
    c.beginPath();
    for (let i = 0; i <= 24; i++) {
        const a = i / 24 * Math.PI * 2, rr = r * (1 + 0.045 * Math.sin(3 * a + t * 5 + seed) + 0.03 * Math.sin(5 * a - t * 3.3 + seed));
        i ? c.lineTo(Math.cos(a) * rr, Math.sin(a) * rr) : c.moveTo(Math.cos(a) * rr, Math.sin(a) * rr);
    }
    c.closePath(); c.restore();
}

// The lit body, outline, rim and core are baked once per colour and size into 16 wobble frames, then stretched and
// placed with a transform each frame: far fewer path fills than drawing every slime from scratch.
const SLIME_BODY = new Map();
function slimeBody(col, base, R, frame) {
    const key = col + base + R + '|' + frame;
    let cv = SLIME_BODY.get(key); if (cv) return cv;
    const S = Math.ceil(R * 2.4 + 8), C = S / 2, ph = frame / 16 * Math.PI * 2;
    cv = document.createElement('canvas'); cv.width = cv.height = S;
    const c = cv.getContext('2d');
    const path = rr => { c.beginPath(); for (let i = 0; i <= 24; i++) { const a = i / 24 * Math.PI * 2, k = rr * (1 + 0.045 * Math.sin(3 * a + ph) + 0.03 * Math.sin(5 * a - 2 * ph + 1)); i ? c.lineTo(C + Math.cos(a) * k, C + Math.sin(a) * k) : c.moveTo(C + Math.cos(a) * k, C + Math.sin(a) * k); } c.closePath(); };
    path(R);
    const g = c.createRadialGradient(C - R * 0.35, C - R * 0.4, R * 0.1, C, C, R * 1.15);
    g.addColorStop(0, sprShade(col, 0.45)); g.addColorStop(0.55, col); g.addColorStop(1, sprShade(col, -0.4));
    c.fillStyle = g; c.globalAlpha = 0.93; c.fill(); c.globalAlpha = 1;
    c.strokeStyle = SPRITE_OUTLINE; c.lineWidth = 2.6; c.stroke(); // same dark outline as the heroes, so slimes pop off the ground
    c.strokeStyle = sprShade(base, 0.35); c.globalAlpha = 0.5; c.lineWidth = 1.2; path(R * 0.9); c.stroke(); c.globalAlpha = 1; // inner rim light
    c.fillStyle = 'rgba(0, 0, 0, 0.12)'; c.beginPath(); c.ellipse(C + R * 0.15, C + R * 0.18, R * 0.55, R * 0.48, 0, 0, Math.PI * 2); c.fill(); // darker core
    if (SLIME_BODY.size > 600) SLIME_BODY.clear(); // flash / status colours can add up over a long run
    SLIME_BODY.set(key, cv);
    return cv;
}

function drawSlime(e, opts) {
    animMotion(e);
    const c = ctx, t = fxTime, base = opts.color || e.color, col = e.hitFlash > 0 ? '#ffffff' : (opts.color || e.renderColor || e.color);
    let r = e.size / 2 * (opts.scale || 1.3), x = e.x, y = e.y; // drawn a bit larger than the hitbox so they read at map scale
    const lookA = Math.atan2(player.y - y, player.x - x);

    // Hop: in the air the body lifts and stretches forward; on landing it spreads round
    const air = Math.abs(Math.sin(e.hop)) * e.mv, land = (1 - Math.abs(Math.sin(e.hop))) * e.mv;
    let z = air * r * (opts.hopH || 0.5), sx = 1 + 0.12 * air - 0.05 * land, sy = 1 - 0.08 * air + 0.1 * land, scale = 1;
    const wob = Math.sin(t * 3 + e.seed) * 0.035; sx += wob; sy -= wob;
    if (e.hitFlash > 0) { sx *= 1.14; sy *= 0.86; }
    if (opts.inflate) scale *= 1 + opts.inflate;
    if (opts.extraZ) z += opts.extraZ;
    if (opts.squeeze) { sx *= opts.squeeze[0]; sy *= opts.squeeze[1]; }

    // Bubbling up out of the ground
    let alpha = 1;
    if (e.spawnT > 0) {
        const k = 1 - e.spawnT / e.spawnMax;
        c.fillStyle = sprShade(base, -0.2); c.globalAlpha = Math.min(0.8, k * 2);
        c.beginPath(); c.ellipse(x, y + r * 0.25, r * (0.4 + k * 0.8), r * (0.25 + k * 0.4), 0, 0, Math.PI * 2); c.fill(); c.globalAlpha = 1;
        const g = Math.max(0, (k - 0.3) / 0.7); if (g <= 0) return;
        const back = 1 + 2.7 * Math.pow(g - 1, 3) + 1.7 * Math.pow(g - 1, 2); // ease-out-back
        scale *= back; alpha = Math.min(1, g * 2);
    }
    r *= scale;

    c.save(); c.globalAlpha = alpha;
    c.fillStyle = `rgba(0, 0, 0, ${0.3 * (1 - Math.min(0.6, z / (r * 3)))})`; // shadow
    c.beginPath(); c.ellipse(x + 3, y + r * 0.42, r * (1 - Math.min(0.4, z / (r * 4))), r * 0.42, 0, 0, Math.PI * 2); c.fill();
    const by = y - z;
    if (opts.under) opts.under(c, x, by, r);

    // Body: lit from the top-left, slightly translucent
    const R0 = Math.max(4, Math.round(e.size * (opts.scale || 1.3))) / 2, frame = Math.floor(((t * 5 + e.seed) / (Math.PI * 2) * 16) % 16 + 16) % 16;
    const body = slimeBody(col, base, R0, frame), k = r / R0, C = body.width / 2;
    c.save(); c.translate(x, by); c.rotate(e.face); c.scale(sx * k, sy * k); c.rotate(-e.face); c.drawImage(body, -C, -C); c.restore();
    if (opts.inside) { c.save(); slimePath(c, x, by, r * 0.92, sx, sy, e.face, t, e.seed); c.clip(); opts.inside(c, x, by, r); c.restore(); }
    // Drifting bubbles for depth
    c.fillStyle = 'rgba(255, 255, 255, 0.35)';
    for (let i = 0; i < 3; i++) { const k = (t * 0.3 + i * 0.33 + e.seed) % 1; c.beginPath(); c.arc(x + Math.sin(i * 2.1 + e.seed) * r * 0.45, by + r * 0.5 - k * r, r * (0.05 + i * 0.02), 0, Math.PI * 2); c.fill(); }
    // Specular highlight
    c.fillStyle = 'rgba(255, 255, 255, 0.7)'; c.beginPath(); c.ellipse(x - r * 0.38, by - r * 0.42, r * 0.28, r * 0.15, -0.6, 0, Math.PI * 2); c.fill();
    c.fillStyle = 'rgba(255, 255, 255, 0.9)'; c.beginPath(); c.arc(x - r * 0.12, by - r * 0.56, r * 0.07, 0, Math.PI * 2); c.fill();

    // Eyes looking at the hero, with an occasional blink
    if (opts.eyes === false) { if (opts.over) opts.over(c, x, by, r); c.restore(); return; }
    const ex = x + Math.cos(lookA) * r * 0.32, ey = by + Math.sin(lookA) * r * 0.24 - r * 0.12, px = -Math.sin(lookA), py = Math.cos(lookA);
    const blink = ((t + e.seed) % 3.7) < 0.12 ? 0.15 : 1, es = r * (opts.eyeSize || 0.13);
    for (const s of [-1, 1]) {
        const qx = ex + px * s * r * 0.24, qy = ey + py * s * r * 0.17;
        c.fillStyle = '#10140c'; c.beginPath(); c.ellipse(qx, qy, es * 0.8, es * blink, 0, 0, Math.PI * 2); c.fill();
        if (blink > 0.5) { c.fillStyle = '#fff'; c.beginPath(); c.arc(qx - es * 0.3, qy - es * 0.35, es * 0.32, 0, Math.PI * 2); c.fill(); }
        if (opts.angry) { // brows slanting down toward the middle
            const lx = Math.cos(lookA), ly = Math.sin(lookA) * 0.75;
            c.strokeStyle = '#10140c'; c.lineWidth = Math.max(2, r * 0.07); c.lineCap = 'round'; c.beginPath();
            c.moveTo(qx - px * s * es * 0.7 - lx * es * 1.2, qy - py * s * es * 0.7 - ly * es * 1.2 - es * 0.9);
            c.lineTo(qx + px * s * es * 1.1 - lx * es * 1.9, qy + py * s * es * 1.1 - ly * es * 1.9 - es * 1.5); c.stroke();
        }
    }
    if (opts.mouth) opts.mouth(c, x + Math.cos(lookA) * r * 0.55, by + Math.sin(lookA) * r * 0.42, r, lookA);
    if (opts.over) opts.over(c, x, by, r);
    c.restore();
}

// Slime King's crown, seen from above: a gold band with points standing up around it
function drawCrown(c, x, y, r, tilt) {
    c.save(); c.translate(x, y); c.rotate(tilt);
    const R = r * 0.42;
    for (let i = 0; i < 6; i++) {
        const a = i / 6 * Math.PI * 2 - Math.PI / 2;
        c.beginPath(); c.moveTo(Math.cos(a - 0.42) * R, Math.sin(a - 0.42) * R * 0.75); c.lineTo(Math.cos(a) * R * 1.95, Math.sin(a) * R * 1.5); c.lineTo(Math.cos(a + 0.42) * R, Math.sin(a + 0.42) * R * 0.75); c.closePath();
        c.fillStyle = '#ffca28'; c.fill(); c.strokeStyle = '#5d3a00'; c.lineWidth = 1.6; c.stroke();
        c.fillStyle = i % 2 ? '#e53935' : '#29b6f6'; c.beginPath(); c.arc(Math.cos(a) * R * 1.95, Math.sin(a) * R * 1.5, r * 0.06, 0, Math.PI * 2); c.fill(); c.strokeStyle = '#5d3a00'; c.lineWidth = 1; c.stroke();
    }
    c.beginPath(); c.ellipse(0, 0, R, R * 0.75, 0, 0, Math.PI * 2);
    c.lineWidth = r * 0.14; c.strokeStyle = '#5d3a00'; c.stroke(); c.lineWidth = r * 0.09; c.strokeStyle = '#ffd54f'; c.stroke();
    c.restore();
}

function drawEnemySprite(e) {
    if (!SLIME_TYPES[e.type]) return false;
    if (e.flyUntil > fxTime) return true; // still in the air as a goo_arc (flung minions, the Queen's eggs)
    if (e.type === 'slime_melee') {
        if (e.mv > 0.5 && fxTime - (e.trailAt || 0) > 0.45) { e.trailAt = fxTime; effects.push({ type: 'slime_trail', x: e.x, y: e.y + e.size * 0.2, r: e.size * 0.32, color: e.color, life: 2.2, maxLife: 2.2 }); }
        drawSlime(e, {});
    } else if (e.type === 'slime_ranged') {
        const wind = e.attackTimer > 0 && e.attackTimer < 0.45 ? 1 - e.attackTimer / 0.45 : 0; // swells up before spitting
        drawSlime(e, {
            inflate: wind * 0.16, hopH: 0.3,
            inside: (c, x, y, r) => { ptGlow(c, x + r * 0.1, y + r * 0.1, r * 0.8, '#f48fb1', 0.35 + wind * 0.5); },
            mouth: (c, mx, my, r) => { c.fillStyle = '#2a0f30'; c.beginPath(); c.ellipse(mx, my, r * (0.12 + wind * 0.12), r * (0.09 + wind * 0.14), 0, 0, Math.PI * 2); c.fill(); },
            over: (c, x, y, r) => { // three little spines down its back
                const a = Math.atan2(player.y - y, player.x - x) + Math.PI;
                for (let i = -1; i <= 1; i++) { const q = a + i * 0.5, bx = x + Math.cos(q) * r * 0.62, by = y + Math.sin(q) * r * 0.5; c.fillStyle = '#6a1b9a'; c.beginPath(); c.moveTo(bx + Math.cos(q) * r * 0.32, by + Math.sin(q) * r * 0.32); c.lineTo(bx + Math.cos(q + 1.6) * r * 0.12, by + Math.sin(q + 1.6) * r * 0.12); c.lineTo(bx + Math.cos(q - 1.6) * r * 0.12, by + Math.sin(q - 1.6) * r * 0.12); c.closePath(); c.fill(); }
            },
        });
    } else if (e.type === 'boss_slime') {
        const hurt = e.hp / e.maxHp < 0.5;
        let inflate = 0, extraZ = 0, squeeze = null;
        if (e.state === 'fireball') inflate = 0.14 * (1 - Math.max(0, e.stateTimer) / 0.5);
        if (e.firedAt && fxTime - e.firedAt < 0.25) inflate = -0.1 * (1 - (fxTime - e.firedAt) / 0.25); // recoil
        if (e.state === 'bounce_telegraph' && e.leapK !== undefined) extraZ = Math.sin(Math.PI * e.leapK) * 110;
        if (e.state === 'intro' && e.introK !== undefined) { const k = e.introK; squeeze = k < 0.35 ? [1.25, 0.7] : [1 + Math.sin(k * 14) * 0.12 * (1 - k), 1 - Math.sin(k * 14) * 0.12 * (1 - k)]; }
        // Coming out of the cave it's hidden in the dark of the mouth, then fades in as it crosses the lip
        const fade = e.state === 'intro' ? clamp01((STAGE_MAPS.clearing.mouth.x - 60 - e.x) / 110) : 1;
        if (fade <= 0.01) return true;
        if (fade < 1) ctx.filter = `opacity(${fade}) brightness(${0.35 + 0.65 * fade})`;
        drawSlime(e, {
            scale: 1.35 * (1 + extraZ / 420), hopH: 0.22, eyeSize: 0.12, inflate, extraZ, squeeze,
            inside: (c, x, y, r) => { // things it swallowed, and the fire it's about to spit
                c.globalAlpha = 0.35; c.strokeStyle = '#efebe9'; c.lineWidth = r * 0.08; c.lineCap = 'round';
                c.beginPath(); c.moveTo(x - r * 0.35, y + r * 0.35); c.lineTo(x + r * 0.05, y + r * 0.5); c.stroke();
                c.fillStyle = '#efebe9'; for (const [bx, bY] of [[-0.38, 0.32], [0.08, 0.53]]) { c.beginPath(); c.arc(x + r * bx, y + r * bY, r * 0.07, 0, Math.PI * 2); c.fill(); }
                c.strokeStyle = '#90a4ae'; c.lineWidth = r * 0.06; c.beginPath(); c.moveTo(x + r * 0.25, y + r * 0.05); c.lineTo(x + r * 0.55, y - r * 0.25); c.stroke();
                c.globalAlpha = 1;
                if (e.state === 'fireball') ptGlow(c, x, y, r * 0.9, '#ff6d00', 0.75 * (1 - Math.max(0, e.stateTimer) / 0.5));
            },
            mouth: (c, mx, my, r, a) => {
                const open = e.state === 'fireball' ? 0.13 : 0.05;
                c.fillStyle = '#3a1a00'; c.beginPath(); c.ellipse(mx, my, r * 0.13, r * open, a + Math.PI / 2, 0, Math.PI * 2); c.fill();
            },
            over: (c, x, y, r) => drawCrown(c, x - r * 0.12, y - r * 0.5, r, hurt ? 0.35 + Math.sin(fxTime * 2) * 0.05 : Math.sin(fxTime * 1.5) * 0.06),
        });
        ctx.filter = 'none';
    } else if (e.type === 'voltaic_ooze') {
        const fr = Math.floor(fxTime * 14 + (e.seed || 0) * 7);
        drawSlime(e, {
            hopH: 0.45,
            inside: (c, x, y, r) => { // a crackling core
                ptGlow(c, x, y, r * 0.95, '#b3e5fc', 0.45 + 0.25 * Math.sin(fxTime * 9 + e.seed));
                c.save(); c.globalCompositeOperation = 'lighter';
                for (let k = 0; k < 2; k++) { const a0 = cavHash(fr * 3 + k) * Math.PI * 2, a1 = a0 + 2 + cavHash(fr * 5 + k) * 2.2; zap(c, x + Math.cos(a0) * r * 0.75, y + Math.sin(a0) * r * 0.65, x + Math.cos(a1) * r * 0.75, y + Math.sin(a1) * r * 0.65, fr + k * 9, 5, r * 0.35, 1.3); }
                c.restore();
            },
            over: (c, x, y, r) => { // sparks jumping off its skin
                if (cavHash(fr + 3.3) < 0.45) { const a = cavHash(fr + 1.1) * Math.PI * 2; c.save(); c.globalCompositeOperation = 'lighter'; zap(c, x + Math.cos(a) * r, y + Math.sin(a) * r * 0.85, x + Math.cos(a) * r * 1.6, y + Math.sin(a) * r * 1.4, fr, 3, 8, 1.2); c.restore(); }
            },
        });
        for (const o of enemies) { // arcs between oozes that stand close together (they hurt to walk through)
            if (o === e || o.type !== 'voltaic_ooze' || o.dead || o.spawnT > 0 || e.spawnT > 0 || !(o.seed > e.seed)) continue;
            if (Math.hypot(o.x - e.x, o.y - e.y) < 250) { ctx.save(); ctx.globalCompositeOperation = 'lighter'; zap(ctx, e.x, e.y - 6, o.x, o.y - 6, fr + o.seed, 9, 22, 2.4); ctx.restore(); }
        }
    } else if (e.type === 'toxic_sludge') {
        drawSlime(e, {
            hopH: 0.14, squeeze: [1.1, 0.93],
            inside: (c, x, y, r) => { // murk and something it dissolved
                c.fillStyle = 'rgba(0, 40, 30, 0.35)';
                for (let k = 0; k < 3; k++) { c.beginPath(); c.arc(x + Math.sin(fxTime * 0.7 + k * 2 + e.seed) * r * 0.4, y + Math.cos(fxTime * 0.5 + k * 2.5) * r * 0.35, r * 0.3, 0, Math.PI * 2); c.fill(); }
                c.globalAlpha = 0.35; c.strokeStyle = '#e0f2f1'; c.lineWidth = r * 0.08; c.lineCap = 'round';
                c.beginPath(); c.moveTo(x - r * 0.3, y + r * 0.3); c.lineTo(x + r * 0.15, y + r * 0.42); c.stroke(); c.globalAlpha = 1;
            },
            over: (c, x, y, r) => { // toxic bubbles swelling and popping on its back
                for (let i = 0; i < 3; i++) {
                    const k = (fxTime * 0.9 + i * 0.37 + e.seed) % 1, bx = x + Math.sin(i * 2.4 + e.seed) * r * 0.45, by = y - r * 0.1 + Math.cos(i * 1.7 + e.seed) * r * 0.3;
                    if (k < 0.8) { const br = r * (0.06 + k * 0.12); c.fillStyle = 'rgba(160, 255, 210, 0.4)'; c.strokeStyle = 'rgba(210, 255, 230, 0.7)'; c.lineWidth = 1; c.beginPath(); c.arc(bx, by, br, 0, Math.PI * 2); c.fill(); c.stroke(); }
                    else { const q = (k - 0.8) / 0.2; c.strokeStyle = `rgba(190, 255, 220, ${0.7 * (1 - q)})`; c.lineWidth = 1.2; c.beginPath(); c.arc(bx, by, r * (0.18 + q * 0.2), 0, Math.PI * 2); c.stroke(); }
                }
            },
            mouth: (c, mx, my, r, a) => { c.fillStyle = '#00261f'; c.beginPath(); c.ellipse(mx, my, r * 0.16, r * 0.07, a + Math.PI / 2, 0, Math.PI * 2); c.fill(); c.fillStyle = 'rgba(120, 230, 190, 0.7)'; c.beginPath(); c.ellipse(mx + Math.cos(a) * r * 0.12, my + Math.sin(a) * r * 0.12 + r * 0.08, r * 0.05, r * 0.09, 0, 0, Math.PI * 2); c.fill(); },
        });
    } else if (e.type === 'amalgam_minion') {
        const boss = enemies.find(o => o.type === 'boss_amalgam' && !o.dead);
        if (boss && !(e.spawnT > 0)) { // a string of goo still ties it to the mass that's pulling it back
            const [dx, dy, d] = getVector(e.x, e.y, boss.x, boss.y), L = Math.min(d, 110);
            const g = ctx.createLinearGradient(e.x, e.y, e.x + dx / d * L, e.y + dy / d * L); g.addColorStop(0, 'rgba(77, 182, 172, 0.7)'); g.addColorStop(1, 'rgba(77, 182, 172, 0)');
            ctx.strokeStyle = g; ctx.lineWidth = 6; ctx.lineCap = 'round'; ctx.beginPath(); ctx.moveTo(e.x, e.y); ctx.lineTo(e.x + dx / d * L, e.y + dy / d * L); ctx.stroke();
        }
        drawSlime(e, { scale: 1.25, squeeze: boss && !(e.dazed > 0) ? [1.18, 0.86] : null, eyeSize: 0.16 });
        if (e.dazed > 0 && !(e.spawnT > 0)) { // little stars circling a dazed piece
            ctx.fillStyle = '#fff59d';
            for (let k = 0; k < 3; k++) { const a = fxTime * 6 + k * 2.1; ctx.beginPath(); ctx.arc(e.x + Math.cos(a) * 14, e.y - 22 + Math.sin(a) * 5, 2.2, 0, Math.PI * 2); ctx.fill(); }
        }
    } else if (e.type === 'boss_amalgam') {
        drawAmalgam(e);
    } else if (e.type === 'brood_pod') {
        const grow = e.pod && e.pod.grownAt > 0 ? clamp01((fxTime - e.pod.grownAt) / 0.6) : 1, pulse = 1 + 0.04 * Math.sin(fxTime * 3 + e.seed) + Math.max(0, 1 - (fxTime - hive.pulseAt) / 1.2) * 0.18;
        ctx.fillStyle = '#4a1530'; ctx.strokeStyle = '#1a0410'; ctx.lineWidth = 2; // the wax cup it sits in
        ctx.beginPath(); ctx.ellipse(e.x, e.y + 8, 25 * grow, 15 * grow, 0, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
        drawPodSac(ctx, e.x, e.y, 22 * grow * pulse * (e.hitFlash > 0 ? 1.12 : 1), fxTime, e.seed, e.hitFlash > 0);
    } else if (e.type === 'spore_slime') {
        const wind = e.attackTimer > 0 && e.attackTimer < 0.5 ? 1 - e.attackTimer / 0.5 : 0; // the cap swells before it lobs a spore
        if (wind > 0 && Math.random() < 0.35) spawnParticle({ kind: 'dot', color: '#e6ee9c', x: e.x + (Math.random() - 0.5) * 24, y: e.y - 8, vx: (Math.random() - 0.5) * 30, vy: -30 - Math.random() * 30, size: 2, life: 0.6, drag: 1, grow: 0, spin: 0, rot: 0 });
        drawSlime(e, {
            hopH: 0.3,
            over: (c, x, y, r) => { // a fungal cap growing out of its back
                const la = Math.atan2(player.y - y, player.x - x), cr = r * (0.52 + wind * 0.14), cx = x - Math.cos(la) * r * 0.38, cy = y - Math.sin(la) * r * 0.32 - r * 0.08;
                c.fillStyle = 'rgba(0, 0, 0, 0.25)'; c.beginPath(); c.ellipse(cx + 3, cy + 4, cr, cr * 0.85, 0, 0, Math.PI * 2); c.fill();
                const g = c.createRadialGradient(cx - cr * 0.35, cy - cr * 0.4, cr * 0.1, cx, cy, cr); g.addColorStop(0, '#d7ccc8'); g.addColorStop(0.5, '#a1887f'); g.addColorStop(1, '#5d4037');
                c.fillStyle = g; c.strokeStyle = '#2e1b14'; c.lineWidth = 2; c.beginPath(); c.arc(cx, cy, cr, 0, Math.PI * 2); c.fill(); c.stroke();
                c.fillStyle = '#fff8e1'; for (let k = 0; k < 5; k++) { const a = k * 1.3 + e.seed, d = cr * (0.25 + (k % 3) * 0.2); c.beginPath(); c.arc(cx + Math.cos(a) * d, cy + Math.sin(a) * d, cr * (0.1 + (k % 2) * 0.05), 0, Math.PI * 2); c.fill(); }
            },
        });
    } else if (e.type === 'crystal_slime') {
        const refl = !!e.reflective;
        drawSlime(e, {
            hopH: 0.2,
            over: (c, x, y, r) => { // crystals growing out of its back; they jut out and flare while it reflects damage
                const back = Math.atan2(player.y - y, player.x - x) + Math.PI;
                for (let k = 0; k < 5; k++) {
                    const a = back + (k - 2) * 0.55, L = r * (0.5 + (k % 2) * 0.16) * (refl ? 1.45 : 1), w = r * 0.15;
                    const bx = x + Math.cos(a) * r * 0.22, by = y + Math.sin(a) * r * 0.18, tx = bx + Math.cos(a) * L, ty = by + Math.sin(a) * L, px = -Math.sin(a) * w, py = Math.cos(a) * w;
                    const g = c.createLinearGradient(bx, by, tx, ty); g.addColorStop(0, refl ? '#7b1fa2' : '#9575cd'); g.addColorStop(1, refl ? '#fbeaff' : '#ffffff');
                    c.fillStyle = g; c.strokeStyle = '#2a0b3d'; c.lineWidth = 1.6;
                    c.beginPath(); c.moveTo(bx + px, by + py); c.lineTo(tx, ty); c.lineTo(bx - px, by - py); c.lineTo(bx - Math.cos(a) * w, by - Math.sin(a) * w); c.closePath(); c.fill(); c.stroke();
                    c.strokeStyle = 'rgba(255, 255, 255, 0.55)'; c.lineWidth = 1; c.beginPath(); c.moveTo(bx, by); c.lineTo(tx, ty); c.stroke();
                }
                if (refl) {
                    c.save(); c.globalCompositeOperation = 'lighter'; ptGlow(c, x, y, r * 1.7, '#ce93d8', 0.3);
                    c.strokeStyle = `rgba(230, 200, 255, ${0.6 + 0.3 * Math.sin(fxTime * 8)})`; c.lineWidth = 2; c.beginPath();
                    for (let k = 0; k <= 6; k++) { const a = k * Math.PI / 3 + fxTime * 1.5; c.lineTo(x + Math.cos(a) * r * 1.5, y + Math.sin(a) * r * 1.35); } c.stroke(); c.restore();
                }
            },
        });
    } else if (e.type === 'slime_warden') {
        const stun = e.orbs <= 0 && e.stunTimer > 0;
        if (e.orbs > 0) { ctx.save(); ctx.strokeStyle = 'rgba(255, 213, 79, 0.35)'; ctx.lineWidth = 2; ctx.setLineDash([6, 6]); ctx.lineDashOffset = -fxTime * 20; ctx.beginPath(); ctx.arc(e.x, e.y, 48, 0, Math.PI * 2); ctx.stroke(); ctx.restore(); }
        drawSlime(e, {
            scale: 1.3, hopH: 0.25, angry: !stun,
            over: (c, x, y, r) => { // a golden circlet around the back of its head
                const back = Math.atan2(player.y - y, player.x - x) + Math.PI;
                c.lineCap = 'round'; c.strokeStyle = '#3a2500'; c.lineWidth = r * 0.17; c.beginPath(); c.ellipse(x, y, r * 0.72, r * 0.62, 0, back - 1.1, back + 1.1); c.stroke();
                c.strokeStyle = '#ffca28'; c.lineWidth = r * 0.1; c.stroke();
                c.fillStyle = '#e040fb'; c.beginPath(); c.arc(x + Math.cos(back) * r * 0.72, y + Math.sin(back) * r * 0.62, r * 0.1, 0, Math.PI * 2); c.fill(); c.strokeStyle = '#3a2500'; c.lineWidth = 1.5; c.stroke();
                if (stun) { c.fillStyle = '#fff59d'; for (let k = 0; k < 3; k++) { const a = fxTime * 6 + k * 2.1; c.beginPath(); c.arc(x + Math.cos(a) * r * 0.7, y - r * 0.9 + Math.sin(a) * r * 0.2, 2.5, 0, Math.PI * 2); c.fill(); } }
            },
        });
        for (let k = 0; k < e.orbs; k++) { // its shield orbs: each one soaks a hit
            const a = (e.orbitAngle || 0) + Math.PI * 2 / e.orbs * k, ox = e.x + Math.cos(a) * 48, oy = e.y + Math.sin(a) * 40;
            ctx.save(); ctx.globalCompositeOperation = 'lighter'; ptGlow(ctx, ox, oy, 18, '#ffca28', 0.5); ctx.restore();
            const g = ctx.createRadialGradient(ox - 2, oy - 3, 1, ox, oy, 8); g.addColorStop(0, '#fffde7'); g.addColorStop(0.5, '#ffca28'); g.addColorStop(1, '#a66b00');
            ctx.fillStyle = g; ctx.strokeStyle = '#3a2500'; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.arc(ox, oy, 7, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
        }
    } else if (e.type === 'queen_guard') {
        const q = enemies.find(o => o.type === 'boss_slime_queen' && !o.dead);
        if (q && q.guards && q.guards.includes(e)) { ctx.save(); ctx.globalCompositeOperation = 'lighter'; zap(ctx, e.x, e.y, q.x, q.y, Math.floor(fxTime * 12) + (e.angleOffset || 0) * 7, 10, 26, 2.2, 'rgba(179, 136, 255, 0.35)', 'rgba(240, 225, 255, 0.95)'); ctx.restore(); } // the bond that shields her
        drawSlime(e, {
            scale: 1.3, hopH: 0.15, angry: true,
            over: (c, x, y, r) => {
                const la = Math.atan2(player.y - y, player.x - x), back = la + Math.PI;
                for (let k = -1; k <= 1; k++) { // crystal carapace plates over its back
                    const a = back + k * 0.65, px = x + Math.cos(a) * r * 0.5, py = y + Math.sin(a) * r * 0.42;
                    const g = c.createRadialGradient(px - 3, py - 3, 1, px, py, r * 0.32); g.addColorStop(0, '#e8dcff'); g.addColorStop(1, '#5e35b1');
                    c.fillStyle = g; c.strokeStyle = '#1a0b3d'; c.lineWidth = 1.6; c.beginPath();
                    for (let j = 0; j < 6; j++) { const q2 = j * Math.PI / 3 + a; c.lineTo(px + Math.cos(q2) * r * 0.28, py + Math.sin(q2) * r * 0.24); } c.closePath(); c.fill(); c.stroke();
                }
                const sa = la + 0.9, hx = x + Math.cos(sa) * r * 0.8, hy = y + Math.sin(sa) * r * 0.7, gx = hx + Math.cos(la) * r * 1.3, gy = hy + Math.sin(la) * r * 1.3; // a glaive held toward the hero
                c.strokeStyle = '#3e2723'; c.lineWidth = 3; c.lineCap = 'round'; c.beginPath(); c.moveTo(hx - Math.cos(la) * r * 0.3, hy - Math.sin(la) * r * 0.3); c.lineTo(gx, gy); c.stroke();
                c.fillStyle = '#d1c4e9'; c.strokeStyle = '#1a0b3d'; c.lineWidth = 1.5; c.beginPath();
                c.moveTo(gx + Math.cos(la) * 14, gy + Math.sin(la) * 14); c.quadraticCurveTo(gx + Math.cos(la + 1.4) * 12, gy + Math.sin(la + 1.4) * 12, gx - Math.cos(la) * 4, gy - Math.sin(la) * 4); c.closePath(); c.fill(); c.stroke();
            },
        });
    } else if (e.type === 'boss_slime_queen') {
        drawQueen(e);
    }
    // A small health bar that only shows once the slime is hurt
    if (!e.type.startsWith('boss') && e.hp < e.maxHp && !(e.spawnT > 0)) {
        const w = e.size, x = e.x - w / 2, y = e.y - e.size / 2 - 14;
        ctx.fillStyle = 'rgba(0, 0, 0, 0.6)'; ctx.fillRect(x - 1, y - 1, w + 2, 5);
        ctx.fillStyle = '#8bc34a'; ctx.fillRect(x, y, w * Math.max(0, e.hp / e.maxHp), 3);
    }
    return true;
}

// A jagged electric arc: a wide blue glow under a thin white core
function zap(c, x0, y0, x1, y1, seed, segs, jag, w, glow = 'rgba(41, 182, 246, 0.35)', core = 'rgba(225, 245, 254, 0.95)') {
    const dx = x1 - x0, dy = y1 - y0, d = Math.hypot(dx, dy) || 1, px = -dy / d, py = dx / d, pts = [[x0, y0]];
    for (let i = 1; i < segs; i++) { const k = i / segs, o = (cavHash(seed * 1.7 + i) - 0.5) * jag; pts.push([x0 + dx * k + px * o, y0 + dy * k + py * o]); }
    pts.push([x1, y1]);
    c.lineCap = 'round'; c.lineJoin = 'round';
    for (const [lw, col] of [[w * 3.5, glow], [w, core]]) { c.strokeStyle = col; c.lineWidth = lw; c.beginPath(); pts.forEach(([x, y], i) => (i ? c.lineTo(x, y) : c.moveTo(x, y))); c.stroke(); }
}

// The Amalgam: a dark mass of fused slimes. The ones it swallowed still bulge out of its sides, each with an eye of its own.
function drawAmalgam(e) {
    const t = fxTime, intro = e.introK;
    let inflate = 0, squeeze = null, glow = 0, scale = 1.45, rise = 1;
    if (e.state === 'nova') { const k = clamp01(1 - e.stateTimer); inflate = 0.2 * k; glow = k; }
    if (e.firedAt && t - e.firedAt < 0.3) inflate = -0.12 * (1 - (t - e.firedAt) / 0.3); // recoil after the burst
    if (e.state === 'devastate') { const k = clamp01(1 - e.stateTimer); inflate = 0.12 * k + Math.sin(t * 30) * 0.03 * k; glow = k; }
    if (e.state === 'stampede') squeeze = [1.24, 0.84];
    if (intro !== undefined) {
        animMotion(e);
        if (intro < 0.5) { // the pool it forms from, spreading where the streams meet
            const k = intro / 0.5, r = e.size * 0.85 * k;
            if (r < 1) return;
            ctx.save(); ctx.globalAlpha = 0.9; slimePath(ctx, e.x, e.y, r, 1.2, 0.8, 0, t, 3);
            const g = ctx.createRadialGradient(e.x - r * 0.3, e.y - r * 0.3, 1, e.x, e.y, r * 1.2); g.addColorStop(0, '#4fd18b'); g.addColorStop(1, '#00594d');
            ctx.fillStyle = g; ctx.fill(); ctx.strokeStyle = SPRITE_OUTLINE; ctx.lineWidth = 2; ctx.stroke(); ctx.restore();
            return;
        }
        rise = (intro - 0.5) / 0.5;
        scale *= Math.max(0.3, 1 + 2.7 * Math.pow(rise - 1, 3) + 1.7 * Math.pow(rise - 1, 2)); // ease-out-back
        squeeze = [1 + 0.35 * (1 - rise), 1 - 0.3 * (1 - rise)];
    }
    const summonK = e.state === 'summon' ? clamp01(1 - e.stateTimer) : 0;
    if (e.lastState === 'summon' && e.state !== 'summon') e.lumpAt = t; // lumps flung off as minions grow back
    e.lastState = e.state;
    const regrow = e.lumpAt ? Math.min(1, 0.25 + (t - e.lumpAt) / 2.5) : 1, lookA = Math.atan2(player.y - e.y, player.x - e.x);
    const eye = (c, x, y, s, seed, open) => {
        const blink = ((t * 0.8 + seed) % 4.1) < 0.14 ? 0.15 : 1, lx = Math.cos(lookA) * s * 0.35, ly = Math.sin(lookA) * s * 0.3;
        c.fillStyle = '#f1f8e9'; c.beginPath(); c.ellipse(x, y, s, s * open * blink, 0, 0, Math.PI * 2); c.fill(); c.strokeStyle = '#0d1f1a'; c.lineWidth = 1.5; c.stroke();
        if (open * blink > 0.4) { c.fillStyle = '#10140c'; c.beginPath(); c.arc(x + lx, y + ly, s * 0.5, 0, Math.PI * 2); c.fill(); c.fillStyle = '#fff'; c.beginPath(); c.arc(x + lx - s * 0.2, y + ly - s * 0.22, s * 0.16, 0, Math.PI * 2); c.fill(); }
    };
    drawSlime(e, {
        scale, hopH: 0.12, inflate, squeeze, color: '#00796b', eyes: false,
        under: (c, x, y, r) => { // the swallowed slimes, writhing around its rim
            for (let i = 0; i < 4; i++) {
                const a = i * Math.PI / 2 + 0.6 + Math.sin(t * 0.6 + i * 1.3) * 0.35 + t * 0.15;
                const lr = r * (0.42 + 0.04 * Math.sin(t * 3 + i)) * (summonK ? 1 + summonK * 0.3 : regrow) * Math.min(1, rise * 1.3);
                const d = r * (0.8 + summonK * 0.35), lx = x + Math.cos(a) * d, ly = y + Math.sin(a) * d * 0.9, col = e.hitFlash > 0 ? '#ffffff' : AMALGAM_LUMPS[i];
                slimePath(c, lx, ly, lr, 1, 1, a, t, i * 3);
                const g = c.createRadialGradient(lx - lr * 0.35, ly - lr * 0.4, 1, lx, ly, lr * 1.15); g.addColorStop(0, sprShade(col, 0.45)); g.addColorStop(0.55, col); g.addColorStop(1, sprShade(col, -0.4));
                c.fillStyle = g; c.fill(); c.strokeStyle = SPRITE_OUTLINE; c.lineWidth = 2.4; c.stroke();
                c.fillStyle = 'rgba(255, 255, 255, 0.6)'; c.beginPath(); c.ellipse(lx - lr * 0.35, ly - lr * 0.4, lr * 0.25, lr * 0.13, -0.6, 0, Math.PI * 2); c.fill();
                if (rise > 0.75) eye(c, lx + Math.cos(a) * lr * 0.35, ly + Math.sin(a) * lr * 0.3, lr * 0.22, i * 1.9, Math.min(1, (rise - 0.75) * 4));
            }
        },
        inside: (c, x, y, r) => { // swirls of every colour it has eaten, and bones it hasn't digested yet
            c.lineWidth = r * 0.12; c.lineCap = 'round';
            AMALGAM_LUMPS.forEach((col, i) => { c.strokeStyle = ptRgba(col, 0.28); const a = t * 0.5 + i * 1.57; c.beginPath(); c.arc(x + Math.cos(a) * r * 0.2, y + Math.sin(a) * r * 0.2, r * (0.35 + i * 0.1), a, a + 1.9); c.stroke(); });
            c.globalAlpha = 0.4; c.strokeStyle = '#eceff1'; c.lineWidth = r * 0.06;
            c.beginPath(); c.moveTo(x - r * 0.45, y + r * 0.4); c.lineTo(x - r * 0.1, y + r * 0.55); c.stroke();
            c.fillStyle = '#eceff1'; c.beginPath(); c.arc(x + r * 0.35, y + r * 0.42, r * 0.12, 0, Math.PI * 2); c.fill(); // a skull, face down
            c.fillStyle = '#004d40'; c.beginPath(); c.arc(x + r * 0.31, y + r * 0.41, r * 0.03, 0, Math.PI * 2); c.arc(x + r * 0.39, y + r * 0.41, r * 0.03, 0, Math.PI * 2); c.fill();
            c.globalAlpha = 1;
            if (glow > 0) ptGlow(c, x, y, r * 0.95, '#1de9b6', 0.75 * glow);
        },
        over: (c, x, y, r) => { // a cluster of mismatched eyes and a wide, ragged mouth
            const ox = Math.cos(lookA) * r * 0.18, oy = Math.sin(lookA) * r * 0.14;
            [[-0.3, -0.28, 0.17], [0.24, -0.32, 0.13], [0.0, -0.06, 0.21], [0.4, 0.02, 0.09], [-0.18, 0.18, 0.08]].forEach(([ex, ey, s], i) => {
                const open = intro !== undefined ? clamp01((rise - 0.55 - i * 0.08) * 5) : 1;
                if (open > 0) eye(c, x + ex * r + ox, y + ey * r + oy, r * s, i * 2.7, open);
            });
            const mx = x + Math.cos(lookA) * r * 0.5, my = y + Math.sin(lookA) * r * 0.42, open = e.state === 'nova' || e.state === 'devastate' ? 0.16 + glow * 0.08 : 0.07;
            c.save(); c.translate(mx, my); c.rotate(lookA + Math.PI / 2);
            c.fillStyle = '#00140f'; c.beginPath(); c.ellipse(0, 0, r * 0.3, r * open, 0, 0, Math.PI * 2); c.fill();
            c.fillStyle = '#e0f2f1'; for (let k = -2; k <= 2; k++) { c.beginPath(); c.moveTo(k * r * 0.1 - r * 0.03, -r * open * 0.9); c.lineTo(k * r * 0.1, -r * open * 0.2); c.lineTo(k * r * 0.1 + r * 0.03, -r * open * 0.9); c.fill(); }
            c.restore();
        },
    });
}

// Cave-stage ground decals: stalactite shadows and rubble, toxic puddles, goo flung through the air
function drawCaveGround(ef) {
    const c = ctx;
    if (ef.type === 'bolt_charge') { // the Queen's strike gathering: arcs flicker inside the ring, more and brighter as it nears
        const k = 1 - ef.life / ef.maxLife, fr = Math.floor(fxTime * 18), n = 2 + Math.floor(k * 6);
        c.save(); c.globalCompositeOperation = 'lighter';
        ptGlow(c, ef.x, ef.y, ef.radius * (0.7 + k * 0.8), '#b388ff', 0.2 + 0.45 * k);
        if (Math.random() < 0.2 + k * 0.6) spawnParticle({ kind: 'spark', color: '#e1ccff', x: ef.x + (Math.random() - 0.5) * ef.radius * 1.4, y: ef.y + (Math.random() - 0.5) * ef.radius, vx: (Math.random() - 0.5) * 40, vy: -120 - Math.random() * 120, size: 2, life: 0.3, drag: 2, grow: 0, spin: 0, rot: 0 }); // static crackling upward
        for (let i = 0; i < n; i++) {
            const a0 = cavHash(fr * 3 + i) * Math.PI * 2, a1 = a0 + 1.5 + cavHash(fr * 7 + i) * 2, r0 = ef.radius * (0.3 + cavHash(fr + i * 5) * 0.7);
            zap(c, ef.x + Math.cos(a0) * r0, ef.y + Math.sin(a0) * r0 * 0.8, ef.x + Math.cos(a1) * ef.radius * 0.5, ef.y + Math.sin(a1) * ef.radius * 0.4, fr + i * 9, 5, 16, 1.6 + k * 1.6, 'rgba(179, 136, 255, 0.5)', 'rgba(245, 235, 255, 1)');
        }
        c.restore(); return true;
    }
    if (ef.type === 'bolt_scorch') { // where it struck: a scorch with a violet rune ring cooling off
        const a = Math.min(1, ef.life / 1.5), r = 46;
        c.save();
        const g = c.createRadialGradient(ef.x, ef.y, 0, ef.x, ef.y, r * 1.3); g.addColorStop(0, `rgba(10, 2, 14, ${0.55 * a})`); g.addColorStop(1, 'rgba(10, 2, 14, 0)');
        c.fillStyle = g; c.beginPath(); c.arc(ef.x, ef.y, r * 1.3, 0, Math.PI * 2); c.fill();
        c.globalCompositeOperation = 'lighter'; c.globalAlpha = a * (0.5 + 0.2 * Math.sin(fxTime * 8));
        c.strokeStyle = '#b388ff'; c.lineWidth = 2; c.beginPath(); c.ellipse(ef.x, ef.y, r, r * 0.8, 0, 0, Math.PI * 2); c.stroke();
        c.lineWidth = 1.5; c.beginPath(); c.ellipse(ef.x, ef.y, r * 0.62, r * 0.5, 0, 0, Math.PI * 2); c.stroke();
        for (let k = 0; k < 6; k++) { // rune ticks between the rings
            const q = k / 6 * Math.PI * 2 + ef.seed, x0 = ef.x + Math.cos(q) * r * 0.68, y0 = ef.y + Math.sin(q) * r * 0.55;
            c.beginPath(); c.moveTo(x0, y0); c.lineTo(x0 + Math.cos(q + 1.2) * 8, y0 + Math.sin(q + 1.2) * 6); c.lineTo(ef.x + Math.cos(q) * r * 0.94, ef.y + Math.sin(q) * r * 0.76); c.stroke();
        }
        c.restore(); return true;
    }
    if (ef.type === 'stalactite') {
        const el = ef.maxLife - ef.life;
        if (el < ef.fall) { // its shadow grows and sharpens as it comes down; a warm ring marks the danger
            const k = el / ef.fall, p = 0.5 + 0.5 * Math.sin(fxTime * 16);
            c.save(); c.fillStyle = `rgba(0, 0, 0, ${0.15 + 0.45 * k})`; c.beginPath(); c.ellipse(ef.x, ef.y, ef.r * (0.3 + 0.55 * k), ef.r * (0.3 + 0.55 * k) * 0.8, 0, 0, Math.PI * 2); c.fill();
            if (!ef.harmless) { c.strokeStyle = `rgba(255, 183, 77, ${0.25 + 0.45 * k * p})`; c.lineWidth = 2; c.setLineDash([8, 6]); c.lineDashOffset = -fxTime * 30; c.beginPath(); c.ellipse(ef.x, ef.y, ef.r, ef.r * 0.8, 0, 0, Math.PI * 2); c.stroke(); c.setLineDash([]); }
            c.restore();
        } else { // shattered: a little heap of shards that fades away
            c.save(); c.globalAlpha = Math.min(1, ef.life / 1.5);
            for (let i = 0; i < 6; i++) {
                const a = ef.rot + i * 1.05, d = i ? 10 + ef.pts[i] * 16 : 0, x = ef.x + Math.cos(a) * d, y = ef.y + Math.sin(a) * d * 0.8, s = i ? 4 + ef.pts[i] * 4 : 9;
                c.fillStyle = 'rgba(0, 0, 0, 0.35)'; c.beginPath(); c.ellipse(x + 2, y + 2, s, s * 0.7, 0, 0, Math.PI * 2); c.fill();
                c.fillStyle = i ? '#6e7279' : '#8b9097'; c.strokeStyle = '#141518'; c.lineWidth = 1.2;
                c.beginPath(); c.moveTo(x + Math.cos(a) * s, y + Math.sin(a) * s); c.lineTo(x + Math.cos(a + 2.2) * s * 0.8, y + Math.sin(a + 2.2) * s * 0.8); c.lineTo(x + Math.cos(a + 4.1) * s * 0.7, y + Math.sin(a + 4.1) * s * 0.7); c.closePath(); c.fill(); c.stroke();
            }
            c.restore();
        }
        return true;
    }
    if (ef.type === 'puddle') { // toxic sludge pool: irregular, bubbling, fades at the end
        if (ef.seed === undefined) ef.seed = Math.random() * 10;
        const a = Math.min(1, ef.life / ef.maxLife * 3) * Math.min(1, (ef.maxLife - ef.life) * 8), r = ef.radius;
        c.save(); c.globalAlpha = a * 0.6;
        c.beginPath(); for (let i = 0; i <= 28; i++) { const q = i / 28 * Math.PI * 2, rr = r * (0.88 + 0.1 * Math.sin(q * 3 + ef.seed) + 0.05 * Math.sin(q * 5 + ef.seed * 2)); c.lineTo(ef.x + Math.cos(q) * rr, ef.y + Math.sin(q) * rr * 0.75); } c.closePath();
        const g = c.createRadialGradient(ef.x - r * 0.3, ef.y - r * 0.3, 1, ef.x, ef.y, r); g.addColorStop(0, ef.pink ? '#f48fb1' : '#4db6ac'); g.addColorStop(1, ef.pink ? '#880e4f' : '#00594d');
        c.fillStyle = g; c.fill(); c.strokeStyle = 'rgba(150, 255, 220, 0.5)'; c.lineWidth = 1.5; c.stroke();
        const k = (fxTime * 1.3 + ef.seed) % 1; c.strokeStyle = `rgba(190, 255, 230, ${0.6 * (1 - k)})`; c.beginPath(); c.arc(ef.x + Math.sin(ef.seed) * r * 0.3, ef.y, 2 + k * 6, 0, Math.PI * 2); c.stroke();
        c.restore(); return true;
    }
    if (ef.type === 'spore_cloud' && !ef.isFriendly) { // a drifting haze of spores; standing in it weakens you
        const a = Math.min(1, ef.life / ef.maxLife * 2.5) * Math.min(1, (ef.maxLife - ef.life) * 4), t = fxTime;
        c.save();
        for (let k = 0; k < 9; k++) { const q = k * 0.7 + t * 0.3 * (k % 2 ? 1 : -1), d = ef.radius * (0.25 + (k % 3) * 0.22); const g = c.createRadialGradient(ef.x + Math.cos(q) * d, ef.y + Math.sin(q) * d * 0.8, 0, ef.x + Math.cos(q) * d, ef.y + Math.sin(q) * d * 0.8, ef.radius * 0.45); g.addColorStop(0, `rgba(205, 220, 57, ${0.28 * a})`); g.addColorStop(1, 'rgba(205, 220, 57, 0)'); c.fillStyle = g; c.fillRect(ef.x - ef.radius * 1.5, ef.y - ef.radius * 1.5, ef.radius * 3, ef.radius * 3); }
        c.fillStyle = `rgba(240, 244, 195, ${0.7 * a})`;
        for (let k = 0; k < 16; k++) { const q = cavHash(k + ef.x) * 6.28 + t * 0.5, d = ef.radius * cavHash(k * 3 + ef.y); c.fillRect(ef.x + Math.cos(q) * d, ef.y + Math.sin(q) * d * 0.8 - ((t * 15 + k * 7) % 20), 2, 2); }
        c.restore(); return true;
    }
    if (ef.type === 'goo_arc') { // a blob thrown through the air; lands as a splat if it's a dying piece
        const k = 1 - ef.life / ef.maxLife, x = lerp(ef.x0, ef.x, k), y = lerp(ef.y0, ef.y, k), z = Math.sin(Math.PI * k) * 90, s = ef.size || 10;
        c.fillStyle = 'rgba(0, 0, 0, 0.25)'; c.beginPath(); c.ellipse(x, y + 4, s, s * 0.6, 0, 0, Math.PI * 2); c.fill();
        c.fillStyle = ef.color; c.strokeStyle = SPRITE_OUTLINE; c.lineWidth = 2; c.beginPath(); c.arc(x, y - z, s, 0, Math.PI * 2); c.fill(); c.stroke();
        c.fillStyle = 'rgba(255, 255, 255, 0.6)'; c.beginPath(); c.arc(x - s * 0.3, y - z - s * 0.35, s * 0.28, 0, Math.PI * 2); c.fill();
        if (ef.splat && ef.life < 0.04 && !ef.burstDone) { ef.burstDone = true; effects.push({ type: 'slime_splat', x: ef.x, y: ef.y, r: s * 1.6, color: ef.color, life: 12, maxLife: 12, seed: Math.random() * 10 }); burst(ef.x, ef.y, 0, Math.PI * 2, 8, { kind: 'goo', color: ef.color, size: 4, speed: [60, 180], life: 0.5, drag: 3 }); }
        return true;
    }
    return false;
}

// The Hive Queen's crown: a band set with crystal spikes, seen from above
function drawQueenCrown(c, x, y, R, tilt) {
    c.save(); c.translate(x, y); c.rotate(tilt);
    for (let i = 0; i < 7; i++) {
        const a = i / 7 * Math.PI * 2 - Math.PI / 2, L = R * (i === 0 ? 0.62 : 0.46), w = R * 0.1;
        const bx = Math.cos(a) * R * 0.26, by = Math.sin(a) * R * 0.2, tx = Math.cos(a) * (R * 0.26 + L), ty = Math.sin(a) * (R * 0.2 + L * 0.8), px = -Math.sin(a) * w, py = Math.cos(a) * w;
        const g = c.createLinearGradient(bx, by, tx, ty); g.addColorStop(0, '#ad1457'); g.addColorStop(0.6, '#ff9cc8'); g.addColorStop(1, '#ffffff');
        c.fillStyle = g; c.strokeStyle = '#2a0418'; c.lineWidth = 1.6;
        c.beginPath(); c.moveTo(bx + px, by + py); c.lineTo(tx, ty); c.lineTo(bx - px, by - py); c.closePath(); c.fill(); c.stroke();
    }
    c.beginPath(); c.ellipse(0, 0, R * 0.3, R * 0.23, 0, 0, Math.PI * 2);
    c.lineWidth = R * 0.11; c.strokeStyle = '#2a0418'; c.stroke(); c.lineWidth = R * 0.07; c.strokeStyle = '#ffcc80'; c.stroke();
    c.fillStyle = '#e040fb'; c.beginPath(); c.arc(0, -R * 0.23, R * 0.07, 0, Math.PI * 2); c.fill(); c.strokeStyle = '#2a0418'; c.lineWidth = 1; c.stroke();
    c.restore();
}

// The Hive Queen: a regal pink slime with a long translucent egg sac trailing behind her, a membrane mantle, a crystal crown.
// o.sleep (0..1): dozing on the throne, eyes half-lidded; introK: waking up.
function drawQueen(e, o = {}) {
    const t = fxTime, intro = e.introK, throes = e.state === 'death_throes', asleep = o.sleep !== undefined;
    const wake = asleep ? 0 : intro !== undefined ? intro : 1;
    const lid = asleep ? 0.22 + (1 - o.sleep) * 0.78 : 0.22 + wake * 0.78;
    const lookA = Math.atan2(player.y - e.y, player.x - e.x), abdA = asleep || intro !== undefined || e.onThrone ? -Math.PI / 2 : lookA + Math.PI; // on the throne the sac lies back over the seat
    const lift = e.leapK !== undefined ? Math.sin(Math.PI * e.leapK) * 190 : 0; // leaping: up toward the camera, over her shadow
    let inflate = 0;
    if (asleep) inflate = Math.sin(t * 1.2) * 0.03 + (1 - o.sleep) * 0.07; // slow breathing; a shudder when her brood dies
    else if (intro !== undefined) inflate = -0.1 * (1 - intro) + 0.04 * Math.sin(t * 7) * (1 - intro);
    if (e.firedAt && t - e.firedAt < 0.3) inflate = -0.1 * (1 - (t - e.firedAt) / 0.3);
    if (throes) inflate = 0.06 * Math.sin(t * 30);
    drawSlime(e, {
        scale: 1.45 * (1 + lift / 600), hopH: 0.05, inflate, extraZ: lift, eyes: false,
        under: (c, x, y, r) => {
            // the egg sac: banded, translucent, eggs glowing inside
            c.save(); c.translate(x + Math.cos(abdA) * r * 1.15, y + Math.sin(abdA) * r * 0.95); c.rotate(abdA);
            const L = r * 1.2, Wd = r * 0.78, p = 1 + 0.04 * Math.sin(t * 2.2);
            c.scale(p, p);
            c.fillStyle = 'rgba(0, 0, 0, 0.3)'; c.beginPath(); c.ellipse(8, 10, L, Wd, 0, 0, Math.PI * 2); c.fill();
            const g = c.createLinearGradient(-L, 0, L, 0); g.addColorStop(0, '#f06292'); g.addColorStop(0.5, '#f8bbd0'); g.addColorStop(1, '#ad1457');
            c.fillStyle = g; c.globalAlpha = 0.92; c.beginPath(); c.ellipse(0, 0, L, Wd, 0, 0, Math.PI * 2); c.fill(); c.globalAlpha = 1;
            c.strokeStyle = SPRITE_OUTLINE; c.lineWidth = 2.6; c.stroke();
            c.save(); c.clip();
            for (let k = 0; k < 9; k++) { const ex = (cavHash(k + 3) - 0.5) * L * 1.4, ey = (cavHash(k + 9) - 0.5) * Wd * 1.2, er = r * (0.09 + cavHash(k) * 0.05); c.fillStyle = `rgba(255, 240, 248, ${0.45 + 0.25 * Math.sin(t * 2 + k)})`; c.beginPath(); c.ellipse(ex, ey, er, er * 1.2, 0, 0, Math.PI * 2); c.fill(); }
            c.strokeStyle = 'rgba(120, 0, 50, 0.45)'; c.lineWidth = 2;
            for (let k = 1; k <= 4; k++) { const bx = -L + k * L * 0.4; c.beginPath(); c.ellipse(bx, 0, L * 0.1, Wd, 0, -Math.PI / 2, Math.PI / 2); c.stroke(); }
            c.restore();
            c.fillStyle = 'rgba(255, 255, 255, 0.45)'; c.beginPath(); c.ellipse(-L * 0.2, -Wd * 0.5, L * 0.4, Wd * 0.12, 0, 0, Math.PI * 2); c.fill();
            c.restore();
            // the mantle: membrane lobes fanned out behind her head
            for (let k = 0; k < 8; k++) {
                const a = abdA + (k - 3.5) * 0.36, lx = x + Math.cos(a) * r * 0.88, ly = y + Math.sin(a) * r * 0.78;
                c.fillStyle = '#ad1457'; c.strokeStyle = '#ff80ab'; c.lineWidth = 1.5;
                c.beginPath(); c.ellipse(lx, ly, r * 0.36, r * 0.2, a, 0, Math.PI * 2); c.fill(); c.stroke();
            }
        },
        inside: (c, x, y, r) => { // a heart of light beating in her core
            ptGlow(c, x, y + r * 0.05, r * 0.75, '#ff4081', 0.3 + 0.2 * Math.sin(t * 3) + (throes ? 0.4 : 0));
        },
        over: (c, x, y, r) => {
            const fx = Math.cos(lookA), fy = Math.sin(lookA), px = -fy, py = fx, ex = x + fx * r * 0.3, ey = y + fy * r * 0.22 - r * 0.06;
            const blink = !asleep && ((t + 1.3) % 5.1) < 0.14 ? 0.1 : 1;
            for (const s of [-1, 1]) { // two great almond eyes with slit pupils, two small ones beside them
                const qx = ex + px * s * r * 0.3, qy = ey + py * s * r * 0.22, h = r * 0.12 * lid * blink;
                c.fillStyle = '#2a0418'; c.beginPath(); c.ellipse(qx, qy, r * 0.18, h + 2, lookA, 0, Math.PI * 2); c.fill();
                c.fillStyle = '#ffd54f'; c.beginPath(); c.ellipse(qx, qy, r * 0.15, h, lookA, 0, Math.PI * 2); c.fill();
                if (h > 2) { c.fillStyle = '#1a0010'; c.beginPath(); c.ellipse(qx + fx * r * 0.03, qy + fy * r * 0.03, r * 0.025, h * 0.85, lookA, 0, Math.PI * 2); c.fill(); }
                const sx = qx - fx * r * 0.18 + px * s * r * 0.08, sy = qy - fy * r * 0.16 + py * s * r * 0.06;
                c.fillStyle = '#2a0418'; c.beginPath(); c.arc(sx, sy, r * 0.05, 0, Math.PI * 2); c.fill();
                if (lid > 0.5) { c.fillStyle = '#ffab40'; c.beginPath(); c.arc(sx, sy, r * 0.03, 0, Math.PI * 2); c.fill(); }
            }
            drawQueenCrown(c, x - fx * r * 0.28, y - fy * r * 0.24 - r * 0.12, r * 0.95, Math.sin(t * 0.8) * 0.05);
            if (throes) { // light splitting out of her as she comes apart
                c.save(); c.globalCompositeOperation = 'lighter';
                for (let k = 0; k < 7; k++) { const a = k * 0.9 + t * 0.6, L = r * (1.1 + 0.4 * Math.sin(t * 9 + k)); c.strokeStyle = `rgba(255, 150, 200, ${0.4 + 0.3 * Math.sin(t * 13 + k)})`; c.lineWidth = 3; c.beginPath(); c.moveTo(x, y); c.lineTo(x + Math.cos(a) * L, y + Math.sin(a) * L); c.stroke(); }
                c.restore();
            }
            if (e.invulnerable && !throes) { // her guards' bond: a hexagonal shell of light
                c.save(); c.globalCompositeOperation = 'lighter'; const R = r * 1.6;
                ptGlow(c, x, y, R, '#b388ff', 0.18);
                c.strokeStyle = `rgba(200, 170, 255, ${0.55 + 0.2 * Math.sin(t * 5)})`; c.lineWidth = 2.5; c.beginPath();
                for (let k = 0; k <= 6; k++) { const a = k * Math.PI / 3 + t * 0.4; c.lineTo(x + Math.cos(a) * R, y + Math.sin(a) * R * 0.9); } c.stroke();
                c.lineWidth = 1; c.strokeStyle = 'rgba(200, 170, 255, 0.3)';
                for (let k = 0; k < 6; k++) { const a = k * Math.PI / 3 + t * 0.4; c.beginPath(); c.moveTo(x, y); c.lineTo(x + Math.cos(a) * R, y + Math.sin(a) * R * 0.9); c.stroke(); }
                c.restore();
            }
        },
    });
}

// Drawn above everything in the world: the Queen's lightning coming down out of the dark
function drawEnemyOverlay() {
    const c = ctx;
    for (const ef of effects) {
        if (ef.type !== 'queen_bolt') continue;
        const k = 1 - ef.life / ef.maxLife, a = k < 0.15 ? 1 : Math.max(0, 1 - (k - 0.15) / 0.85), fr = Math.floor(fxTime * 25) + ef.seed;
        c.save(); c.globalCompositeOperation = 'lighter';
        if (k < 0.12) { c.fillStyle = `rgba(200, 170, 255, ${0.18 * (1 - k / 0.12)})`; c.fillRect(camera.x - 50, camera.y - 50, canvas.width + 100, canvas.height + 100); } // the flash lights up the whole hall
        ptGlow(c, ef.x, ef.y, 170, '#d1b3ff', 0.7 * a);
        const pts = [[ef.x + (cavHash(fr) - 0.5) * 80, ef.y - 760]]; // a jagged bolt from far overhead down to the mark
        for (let i = 1; i < 14; i++) { const q = i / 14; pts.push([ef.x + (cavHash(fr + i * 3.1) - 0.5) * 70 * (1 - q * 0.6), ef.y - 760 * (1 - q)]); }
        pts.push([ef.x, ef.y]);
        const stroke = (p, lw, col) => { c.strokeStyle = col; c.lineWidth = lw; c.lineCap = 'round'; c.lineJoin = 'round'; c.beginPath(); p.forEach(([x, y], i) => (i ? c.lineTo(x, y) : c.moveTo(x, y))); c.stroke(); };
        stroke(pts, 20 * a, `rgba(150, 100, 255, ${0.3 * a})`); stroke(pts, 8 * a, `rgba(205, 180, 255, ${0.8 * a})`); stroke(pts, 3, `rgba(255, 255, 255, ${a})`);
        for (const b of [4, 8, 11]) { // forks splitting off it
            const [bx, by] = pts[b], side = cavHash(fr + b) < 0.5 ? -1 : 1, fork = [[bx, by]];
            for (let i = 1; i <= 4; i++) fork.push([bx + side * i * 18 + (cavHash(fr + b * 7 + i) - 0.5) * 20, by + i * 22]);
            stroke(fork, 5 * a, `rgba(205, 180, 255, ${0.6 * a})`); stroke(fork, 1.5, `rgba(255, 255, 255, ${0.9 * a})`);
        }
        c.restore();
    }
}

// Called by the boss AI when the Slime King lands a leap or spits
function slimeKingLand(e) {
    addShake(6);
    burst(e.x, e.y, 0, Math.PI * 2, 20, { kind: 'goo', color: e.color, size: 5, speed: [150, 360], life: 0.7, drag: 3 });
    effects.push({ type: 'slime_shock', x: e.x, y: e.y, radius: 120, color: e.color, life: 0.45, maxLife: 0.45 });
    effects.push({ type: 'slime_splat', x: e.x, y: e.y + 8, r: e.size * 0.9, color: e.color, life: 5, maxLife: 5, seed: Math.random() * 10 });
}

// Death: a splat on the ground and flying droplets; the king drops his crown
function enemyDeathFx(e) {
    if (!SLIME_TYPES[e.type]) return;
    hiveOnKill(e); // map_hive.js: the sleeping Queen stirs
    const boss = e.type.startsWith('boss'), col = e.type === 'boss_amalgam' ? '#00897b' : e.color;
    if (e.type === 'crystal_slime') burst(e.x, e.y, 0, Math.PI * 2, 10, { kind: 'debris', color: '#e1bee7', size: 4, speed: [100, 300], life: 0.5, drag: 3 }); // its crystals shatter
    if (e.type === 'slime_warden' || e.type === 'queen_guard') burst(e.x, e.y, 0, Math.PI * 2, 8, { kind: 'debris', color: e.type === 'slime_warden' ? '#ffca28' : '#b39ddb', size: 3.5, speed: [80, 240], life: 0.5, drag: 3 });
    burst(e.x, e.y, 0, Math.PI * 2, boss ? 30 : 12, { kind: 'goo', color: col, size: boss ? 6 : 4, speed: [80, boss ? 380 : 240], life: 0.6, drag: 3.5 });
    effects.push({ type: 'slime_splat', x: e.x, y: e.y + e.size * 0.15, r: e.size * (boss ? 1.1 : 0.75), color: col, life: boss ? 20 : 7, maxLife: boss ? 20 : 7, seed: Math.random() * 10 });
    if (e.type === 'voltaic_ooze') burst(e.x, e.y, 0, Math.PI * 2, 8, { kind: 'spark', color: '#81d4fa', size: 2.5, speed: [150, 380], life: 0.3, drag: 5 });
    if (e.type === 'boss_slime') { addShake(7); effects.push({ type: 'crown_drop', x: e.x, y: e.y, vx: 160, vy: -60, rot: 0, life: 30, maxLife: 30 }); }
    if (e.type === 'boss_amalgam') { // it comes apart: the swallowed slimes splash away in every direction
        addShake(8);
        AMALGAM_LUMPS.forEach((c, i) => { const a = i * Math.PI / 2 + 0.6 + Math.random() * 0.5, d = 120 + Math.random() * 90; effects.push({ type: 'goo_arc', x0: e.x, y0: e.y, x: e.x + Math.cos(a) * d, y: e.y + Math.sin(a) * d, color: c, size: 16, splat: true, life: 0.55, maxLife: 0.55 }); });
    }
}

// Ground decals (drawn under enemies)
function drawEnemyGround(ef) {
    const c = ctx;
    if (ef.type === 'slime_splat') {
        const a = Math.min(1, ef.life / ef.maxLife * 2.5), r = ef.r;
        c.save(); c.globalAlpha = a * 0.75;
        c.fillStyle = sprShade(ef.color, -0.15); c.beginPath();
        for (let i = 0; i <= 14; i++) { const q = i / 14 * Math.PI * 2, rr = r * (0.75 + 0.35 * Math.abs(Math.sin(q * 2.5 + ef.seed))); i ? c.lineTo(ef.x + Math.cos(q) * rr, ef.y + Math.sin(q) * rr * 0.7) : c.moveTo(ef.x + Math.cos(q) * rr, ef.y + Math.sin(q) * rr * 0.7); }
        c.closePath(); c.fill();
        for (let i = 0; i < 6; i++) { const q = i * 1.05 + ef.seed, d = r * (1.15 + (i % 3) * 0.2); c.beginPath(); c.arc(ef.x + Math.cos(q) * d, ef.y + Math.sin(q) * d * 0.7, r * 0.1, 0, Math.PI * 2); c.fill(); }
        c.fillStyle = 'rgba(255, 255, 255, 0.4)'; c.beginPath(); c.ellipse(ef.x - r * 0.3, ef.y - r * 0.2, r * 0.25, r * 0.08, -0.3, 0, Math.PI * 2); c.fill();
        c.restore(); return true;
    }
    if (ef.type === 'slime_trail') {
        c.save(); c.globalAlpha = ef.life / ef.maxLife * 0.35; c.fillStyle = ef.color;
        c.beginPath(); c.ellipse(ef.x, ef.y, ef.r, ef.r * 0.6, 0, 0, Math.PI * 2); c.fill(); c.restore(); return true;
    }
    if (ef.type === 'slime_shock') {
        const k = 1 - ef.life / ef.maxLife;
        c.save(); c.globalAlpha = (1 - k) * 0.8; c.strokeStyle = sprShade(ef.color, 0.3); c.lineWidth = 8 * (1 - k) + 2;
        c.beginPath(); c.ellipse(ef.x, ef.y, ef.radius * (0.3 + k), ef.radius * (0.3 + k) * 0.8, 0, 0, Math.PI * 2); c.stroke();
        c.globalAlpha = (1 - k) * 0.25; c.fillStyle = ef.color; c.fill(); c.restore(); return true;
    }
    if (ef.type === 'crown_drop') { // the king's crown skids away and stays where it stops
        const dt = Math.min(0.05, Math.max(0, (ef.lastT !== undefined ? fxTime - ef.lastT : 0))); ef.lastT = fxTime;
        ef.x += ef.vx * dt; ef.y += ef.vy * dt; ef.vx *= Math.pow(0.04, dt); ef.vy *= Math.pow(0.04, dt); ef.rot += Math.hypot(ef.vx, ef.vy) * dt * 0.05;
        c.save(); c.globalAlpha = Math.min(1, ef.life / 3);
        c.fillStyle = 'rgba(0, 0, 0, 0.3)'; c.beginPath(); c.ellipse(ef.x + 3, ef.y + 5, 20, 12, 0, 0, Math.PI * 2); c.fill();
        drawCrown(c, ef.x, ef.y, 40, ef.rot); c.restore(); return true;
    }
    if (ef.type === 'slam_warn') { // where the king is about to land: a ring closing in over a soft fill
        if (ef.follow) { ef.x = ef.follow.x; ef.y = ef.follow.y; }
        const k = 1 - ef.life / ef.maxLife, p = 0.5 + 0.5 * Math.sin(fxTime * 18);
        c.save();
        c.fillStyle = ef.color; c.globalAlpha = 0.12 + 0.12 * k; c.beginPath(); c.ellipse(ef.x, ef.y, ef.radius, ef.radius * 0.8, 0, 0, Math.PI * 2); c.fill();
        c.globalAlpha = 0.6 + 0.3 * p; c.strokeStyle = sprShade(ef.color, 0.4); c.lineWidth = 3; c.setLineDash([12, 8]); c.lineDashOffset = -fxTime * 40; c.stroke(); c.setLineDash([]);
        c.globalAlpha = 0.8; c.lineWidth = 2; c.beginPath(); c.ellipse(ef.x, ef.y, ef.radius * (1 - k * 0.9), ef.radius * 0.8 * (1 - k * 0.9), 0, 0, Math.PI * 2); c.stroke();
        c.restore(); return true;
    }
    if (ef.type === 'cave_open_flash') {
        const k = 1 - ef.life / ef.maxLife;
        c.save(); c.globalCompositeOperation = 'lighter'; ptGlow(c, ef.x, ef.y, 80 + k * 260, ef.color || '#b2ff59', 0.6 * (1 - k)); c.restore(); return true;
    }
    return drawCaveGround(ef);
}

// Enemy projectiles: spit globs, the king's molten slime, the Amalgam's toxic balls
function drawEnemyProjectile(p) {
    const c = ctx;
    const queen = p.owner && p.owner.type === 'boss_slime_queen';
    if (p.type === 'spore') { // a fuzzy ball of spores lobbed at where you stood
        const t = fxTime;
        c.save(); c.globalCompositeOperation = 'lighter'; ptGlow(c, p.x, p.y, 22, '#d4e157', 0.35); c.restore();
        for (let k = 0; k < 7; k++) { const a = k * 0.9 + t * 3, d = 4 + (k % 3) * 2; c.fillStyle = k % 2 ? '#e6ee9c' : '#c0ca33'; c.beginPath(); c.arc(p.x + Math.cos(a) * d, p.y + Math.sin(a) * d, 4, 0, Math.PI * 2); c.fill(); }
        c.fillStyle = '#f9fbe7'; c.beginPath(); c.arc(p.x - 1, p.y - 2, 2.5, 0, Math.PI * 2); c.fill();
        return true;
    }
    if (p.owner && p.owner.type === 'crystal_slime') { // shards of its crystal skin
        const a = Math.atan2(p.vy, p.vx);
        c.save(); c.translate(p.x, p.y); c.rotate(a);
        const g = c.createLinearGradient(-10, 0, 12, 0); g.addColorStop(0, '#7b1fa2'); g.addColorStop(1, '#ffffff');
        c.fillStyle = g; c.strokeStyle = '#2a0b3d'; c.lineWidth = 1.4; c.beginPath(); c.moveTo(12, 0); c.lineTo(-4, -5); c.lineTo(-10, 0); c.lineTo(-4, 5); c.closePath(); c.fill(); c.stroke();
        c.restore(); return true;
    }
    if (queen && p.type !== 'boss_slimeball') { // her royal bolts: flat fills only, the bullet hell throws hundreds of them
        const sp = Math.hypot(p.vx, p.vy);
        if (sp > 360) { const k = Math.min(1, (sp - 360) / 280), tx = p.x - p.vx / sp * 34 * k, ty = p.y - p.vy / sp * 34 * k; c.strokeStyle = `rgba(255, 111, 168, ${0.5 * k})`; c.lineWidth = p.radius * 1.4; c.lineCap = 'round'; c.beginPath(); c.moveTo(p.x, p.y); c.lineTo(tx, ty); c.stroke(); } // a streak once it has sped up
        c.fillStyle = 'rgba(255, 79, 154, 0.22)'; c.beginPath(); c.arc(p.x, p.y, p.radius * 2, 0, Math.PI * 2); c.fill();
        c.fillStyle = '#ff6fa8'; c.strokeStyle = '#3a0820'; c.lineWidth = 1.4; c.beginPath(); c.arc(p.x, p.y, p.radius, 0, Math.PI * 2); c.fill(); c.stroke();
        c.fillStyle = '#ffe3ef'; c.beginPath(); c.arc(p.x - p.radius * 0.3, p.y - p.radius * 0.3, p.radius * 0.35, 0, Math.PI * 2); c.fill();
        return true;
    }
    if (p.type === 'boss_slimeball') {
        const a = Math.atan2(p.vy, p.vx), pal = queen ? ['240, 98, 146', '#ffd6e7', '#ec407a', '#880e4f', '#3a0820'] : ['0, 150, 136', '#a7ffeb', '#26a69a', '#00594d', '#002620'];
        for (let i = 1; i <= 2; i++) { c.fillStyle = `rgba(${pal[0]}, ${0.5 - i * 0.15})`; c.beginPath(); c.arc(p.x - Math.cos(a) * i * 11, p.y - Math.sin(a) * i * 11, p.radius * (1 - i * 0.25), 0, Math.PI * 2); c.fill(); }
        const g = c.createRadialGradient(p.x - 3, p.y - 3, 1, p.x, p.y, p.radius * 1.2); g.addColorStop(0, pal[1]); g.addColorStop(0.5, pal[2]); g.addColorStop(1, pal[3]);
        c.fillStyle = g; c.strokeStyle = pal[4]; c.lineWidth = 1.8; c.beginPath(); c.arc(p.x, p.y, p.radius, 0, Math.PI * 2); c.fill(); c.stroke();
        c.fillStyle = 'rgba(255, 255, 255, 0.75)'; c.beginPath(); c.arc(p.x - p.radius * 0.35, p.y - p.radius * 0.35, p.radius * 0.25, 0, Math.PI * 2); c.fill();
        return true;
    }
    if (p.shape === 'slime_blob') {
        const a = Math.atan2(p.vy, p.vx);
        for (let i = 1; i <= 2; i++) { c.fillStyle = `rgba(186, 104, 200, ${0.5 - i * 0.15})`; c.beginPath(); c.arc(p.x - Math.cos(a) * i * 9, p.y - Math.sin(a) * i * 9, p.radius * (1 - i * 0.25), 0, Math.PI * 2); c.fill(); }
        c.save(); c.translate(p.x, p.y); c.rotate(a);
        const g = c.createRadialGradient(-2, -3, 1, 0, 0, p.radius * 1.3); g.addColorStop(0, '#f3c6ff'); g.addColorStop(1, '#8e24aa');
        c.fillStyle = g; c.strokeStyle = '#3d0b4a'; c.lineWidth = 1.5;
        c.beginPath(); c.ellipse(0, 0, p.radius * 1.3, p.radius * 0.95, 0, 0, Math.PI * 2); c.fill(); c.stroke();
        c.fillStyle = 'rgba(255, 255, 255, 0.8)'; c.beginPath(); c.arc(-2, -3, p.radius * 0.28, 0, Math.PI * 2); c.fill();
        c.restore(); return true;
    }
    if (p.owner && p.owner.type === 'boss_slime' && !p.shape) {
        c.save(); c.globalCompositeOperation = 'lighter'; ptGlow(c, p.x, p.y, p.radius * 3, '#ff6d00', 0.5); c.restore();
        const a = Math.atan2(p.vy, p.vx);
        c.fillStyle = 'rgba(255, 112, 67, 0.5)'; c.beginPath(); c.arc(p.x - Math.cos(a) * 12, p.y - Math.sin(a) * 12, p.radius * 0.6, 0, Math.PI * 2); c.fill();
        const g = c.createRadialGradient(p.x - 2, p.y - 2, 1, p.x, p.y, p.radius * 1.2); g.addColorStop(0, '#fff59d'); g.addColorStop(0.5, '#ff9800'); g.addColorStop(1, '#bf360c');
        c.fillStyle = g; c.strokeStyle = '#4e1500'; c.lineWidth = 1.5; c.beginPath(); c.arc(p.x, p.y, p.radius, 0, Math.PI * 2); c.fill(); c.stroke();
        if (Math.random() < 0.3) spawnParticle({ kind: 'dot', color: '#ffab40', x: p.x, y: p.y, vx: (Math.random() - 0.5) * 40, vy: (Math.random() - 0.5) * 40, size: 2.5, life: 0.35, drag: 2, grow: 0, spin: 0, rot: 0 });
        return true;
    }
    return false;
}
