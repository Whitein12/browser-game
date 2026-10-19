// ==========================================
// monk_fx.js - The Monk's visuals: chi marks, auras, the dragon streak, every mk_* effect and the chi wave
// ==========================================
// monk.js (mechanics) owns the state (`mk`, the enemy fields, the effects); this file only draws them.
// Hooks: drawMonkGround (main.js, under enemies), drawMonkWorld (main.js, above enemies, under the hero),
// drawMonkEffect / drawMonkProjectile (skillfx.js drawSkillEffect / drawSkillProjectile chains; true when handled).
// His chi is warm gold and saffron, the Dragon Kick a red-orange dragon streak, Iron Body bronze, Iron Will red-gold.
// Everything is flat fills and the cached `glow` sprite (bandits.js): a flurry stacks a lot of these at once.

const MFXC = {
    gold: '#ffca28', saff: '#ffb300', orange: '#ef6c00', pale: '#fff3c4', white: '#fffde7',
    ember: '#ff7043', red: '#ff3d00', deep: '#d84315', earth: '#d7a85a', dust: '#a08a6a',
    bronze: '#cd8a4a', bronzeD: '#8d5a2b', will: '#ff5252',
};
const MFX_TAU = Math.PI * 2;

function mfxState() { return typeof mk !== 'undefined' && mk ? mk : null; }
// Particles spawned from a draw function: only once per game frame, so a paused game doesn't pile them up
function mfxTick(o) { if (o.mkFxAt === fxTime) return false; o.mkFxAt = fxTime; return true; }

// A white-wrapped fist seen from above, knuckles toward +x of `a`
function mfxFist(c, x, y, r, a, fill = '#eceff1') {
    c.save(); c.translate(x, y); c.rotate(a);
    c.beginPath(); c.ellipse(0, 0, r, r * 0.88, 0, 0, MFX_TAU); c.fillStyle = fill; c.fill();
    c.strokeStyle = 'rgba(12, 10, 18, 0.85)'; c.lineWidth = 1.2; c.stroke();
    c.strokeStyle = '#b0bec5'; c.lineWidth = 0.9; c.beginPath();
    c.moveTo(-r * 0.35, -r * 0.8); c.lineTo(-r * 0.35, r * 0.8); c.moveTo(r * 0.3, -r * 0.7); c.lineTo(r * 0.3, r * 0.7); c.stroke();
    c.restore();
}

// A chi seal: two rings, eight spokes and a diamond, one stroke. No cracks: sigils and rings only.
function mfxSigil(c, x, y, r, rot, color, a, lw = 1.5) {
    if (a <= 0.01 || r <= 1) return;
    c.save(); c.translate(x, y); c.rotate(rot); c.globalAlpha *= Math.min(1, a);
    c.strokeStyle = color; c.lineWidth = lw; c.beginPath();
    c.moveTo(r, 0); c.arc(0, 0, r, 0, MFX_TAU);
    c.moveTo(r * 0.62, 0); c.arc(0, 0, r * 0.62, 0, MFX_TAU);
    for (let i = 0; i < 8; i++) {
        const an = i * Math.PI / 4, r0 = i % 2 ? r * 0.62 : r * 0.38, r1 = i % 2 ? r * 1.1 : r * 1.2;
        c.moveTo(Math.cos(an) * r0, Math.sin(an) * r0); c.lineTo(Math.cos(an) * r1, Math.sin(an) * r1);
    }
    const d = r * 0.3; c.moveTo(d, 0); c.lineTo(0, d); c.lineTo(-d, 0); c.lineTo(0, -d); c.closePath();
    c.stroke();
    c.restore();
}

// A tapered ribbon from (x0, y0) (a point) to (x1, y1) (`w` wide), one flat fill
function mfxTaper(c, x0, y0, x1, y1, w, color) {
    const a = Math.atan2(y1 - y0, x1 - x0), nx = -Math.sin(a) * w / 2, ny = Math.cos(a) * w / 2;
    c.fillStyle = color; c.beginPath();
    c.moveTo(x0, y0); c.lineTo(x1 + nx, y1 + ny);
    c.quadraticCurveTo(x1 + Math.cos(a) * w * 0.7, y1 + Math.sin(a) * w * 0.7, x1 - nx, y1 - ny);
    c.closePath(); c.fill();
}

// A crescent thick in the middle, pointed at both ends, round (x, y)
function mfxCrescent(c, x, y, r, a0, a1, th, color) {
    const N = 14; c.fillStyle = color; c.beginPath();
    for (let i = 0; i <= N; i++) { const a = a0 + (a1 - a0) * i / N; c.lineTo(x + Math.cos(a) * r, y + Math.sin(a) * r); }
    for (let i = N; i >= 0; i--) { const a = a0 + (a1 - a0) * i / N, rr = r - th * Math.sin(Math.PI * i / N); c.lineTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr); }
    c.closePath(); c.fill();
}

function mfxRing(c, x, y, r, color, lw) { if (r <= 0.5 || lw <= 0.05) return; c.strokeStyle = color; c.lineWidth = lw; c.beginPath(); c.arc(x, y, r, 0, MFX_TAU); c.stroke(); }

// ==========================================
// Under the enemies: the Q and E marks
// ==========================================

function drawMonkGround(c = ctx) {
    c.save();
    for (const e of enemies) {
        if (e.dead || e.submerged || (e.flyUntil && e.flyUntil > fxTime)) continue;
        const R = e.size / 2;
        const marked = e.mkMark > fxTime, slow = e.mkSlow > 0; // monk.js: the Tremor spends the mark and slows through e.mkSlow
        if (marked || slow) { // Earth Palm: a chi seal under the enemy; crippled by the Tremor, the seal turns to earth and presses down on it
            const k = slow ? Math.min(1, e.mkSlow / 0.5) : Math.min(1, (e.mkMark - fxTime) / 0.5);
            // saturated colours in a normal blend: additive gold washes out to nothing on pale sand
            mfxSigil(c, e.x, e.y, R + 9, fxTime * (slow ? 0.3 : 0.9), slow ? '#7a4a1e' : MFXC.orange, (slow ? 0.75 : 0.55) * k, slow ? 2.6 : 1.5);
            if (slow) { // four chevrons pinning it, pulsing inward: weighed down
                const pull = (fxTime * 1.6) % 1, rr = R + 22 - pull * 9;
                c.strokeStyle = withAlpha('#8d4a12', 0.9 * k * (1 - pull * 0.5)); c.lineWidth = 2.6; c.beginPath();
                for (let i = 0; i < 4; i++) {
                    const a = i * Math.PI / 2 + Math.PI / 4, cx = e.x + Math.cos(a) * rr, cy = e.y + Math.sin(a) * rr, s = 5;
                    c.moveTo(cx + Math.cos(a + 0.9) * s, cy + Math.sin(a + 0.9) * s); c.lineTo(cx, cy); c.lineTo(cx + Math.cos(a - 0.9) * s, cy + Math.sin(a - 0.9) * s);
                }
                c.stroke();
            }
        }
        if (e.mkLift > 0) { // Rising Dragon: its shadow stays on the ground, smaller the higher it is
            const s = 1 - Math.min(0.45, e.mkLift / 180);
            c.fillStyle = `rgba(0, 0, 0, ${0.38 * s})`; c.beginPath(); c.ellipse(e.x, e.y + R * 0.3, R * 0.95 * s, R * 0.5 * s, 0, 0, MFX_TAU); c.fill();
            mfxRing(c, e.x, e.y + R * 0.3, R * s + 6, withAlpha(MFXC.ember, 0.55), 2);
        }
        if (e.mkWave && e.mkWave > fxTime) { // Chi Wave: a turning dashed gold ring and a reticle (Rushing Fist's target)
            const k = Math.min(1, (e.mkWave - fxTime) / 0.5), rr = R + 7;
            c.setLineDash([7, 5]); c.lineDashOffset = -fxTime * 30;
            mfxRing(c, e.x, e.y, rr, withAlpha(MFXC.saff, 0.9 * k), 2.2);
            c.setLineDash([]);
            if (e.mkRes > 0) { // Resonating Mark: a solid arc fills round it; closed, the detonation would kill it
                const f = Math.min(1, e.mkRes / Math.max(1, e.hp));
                c.strokeStyle = withAlpha(MFXC.gold, 0.95 * k); c.lineWidth = 4;
                c.beginPath(); c.arc(e.x, e.y, rr + 6, -Math.PI / 2, -Math.PI / 2 + f * MFX_TAU); c.stroke();
            }
            c.strokeStyle = withAlpha(MFXC.orange, 0.95 * k); c.lineWidth = 2.4; c.beginPath();
            for (let i = 0; i < 4; i++) { const a = -fxTime * 1.5 + i * Math.PI / 2; c.moveTo(e.x + Math.cos(a) * (rr + 3), e.y + Math.sin(a) * (rr + 3)); c.lineTo(e.x + Math.cos(a) * (rr + 10), e.y + Math.sin(a) * (rr + 10)); }
            c.stroke();
        }
    }
    c.restore();
}

// ==========================================
// Above the enemies and the hero (main.js draws it after him): auras, the kicked enemies' dragon streak, chi and the flurry beads
// ==========================================

function drawMonkWorld(c = ctx) {
    const m = mfxState();
    if (!m) return;
    for (const ef of effects) if (ef.life > 0 && MFX_DRAW[ef.type]) mfxDraw(c, ef, true); // the effects' parts in the air
    c.save();
    // The Q mark also floats over its enemy, so a big body can't hide Rushing Fist's target
    for (const e of enemies) {
        if (e.dead || e.submerged || !(e.mkWave > fxTime)) continue;
        const k = Math.min(1, (e.mkWave - fxTime) / 0.5), x = e.x, y = e.y - e.size / 2 - 14 + Math.sin(fxTime * 4) * 1.5;
        c.globalCompositeOperation = 'lighter'; glow(c, x, y, 13, '#ffca28', 0.55 * k); c.globalCompositeOperation = 'source-over';
        c.globalAlpha = k; mfxFist(c, x, y, 4.2, -Math.PI / 2, MFXC.pale); c.globalAlpha = 1;
    }
    // Dragon Kick: a red-orange dragon streak behind each enemy in flight, whiskers trailing off its head
    if (m.kicked) for (const kk of m.kicked) {
        const e = kk.e;
        if (!e || e.dead) continue;
        const sp = Math.hypot(kk.vx || 0, kk.vy || 0);
        if (sp < 20) continue;
        const ang = Math.atan2(kk.vy, kk.vx), R = e.size / 2, L = Math.min(150, 50 + sp * 0.18), W = R * 1.5 + 8;
        c.save(); c.translate(e.x, e.y); c.rotate(ang);
        const x0 = -R * 0.55, und = (t) => Math.sin(fxTime * 18 - t * 10.8) * 6 * t;
        const body = (wk, col) => { // a serpent ribbon: wide at the head, thin at the tail, undulating
            c.fillStyle = col; c.beginPath();
            const N = 12;
            for (let i = 0; i <= N; i++) { const t = i / N; c.lineTo(x0 - t * L, und(t) - W * wk * (1 - t) / 2); }
            for (let i = N; i >= 0; i--) { const t = i / N; c.lineTo(x0 - t * L, und(t) + W * wk * (1 - t) / 2); }
            c.closePath(); c.fill();
        };
        body(1, 'rgba(191, 54, 12, 0.55)'); body(0.66, 'rgba(255, 87, 34, 0.75)');
        c.globalCompositeOperation = 'lighter'; body(0.3, 'rgba(255, 213, 79, 0.85)'); c.globalCompositeOperation = 'source-over';
        c.strokeStyle = 'rgba(255, 213, 79, 0.9)'; c.lineWidth = 1.4; c.beginPath(); // scales along the spine
        for (let i = 1; i < 6; i++) { const t = i / 7, x = x0 - t * L, w = W * 0.33 * (1 - t), y = und(t); c.moveTo(x + 3, y - w); c.lineTo(x - 2, y); c.lineTo(x + 3, y + w); }
        c.stroke();
        c.strokeStyle = 'rgba(230, 81, 0, 0.9)'; c.lineWidth = 1.8; c.beginPath(); // whiskers
        for (const s of [-1, 1]) { c.moveTo(R * 0.6, s * R * 0.35); c.quadraticCurveTo(-R * 0.4, s * (R + 14), -R - 26, s * (R + 6 + Math.sin(fxTime * 14 + s) * 4)); }
        c.stroke();
        c.restore();
        if (mfxTick(kk)) spawnParticle({ kind: 'dot', color: Math.random() < 0.5 ? MFXC.ember : MFXC.gold, x: e.x - Math.cos(ang) * (R + Math.random() * L * 0.6) + jitter(10), y: e.y - Math.sin(ang) * (R + Math.random() * L * 0.6) + jitter(10),
            vx: jitter(50), vy: jitter(50), size: 1.8, life: 0.4, drag: 2, grow: 0, spin: 0, rot: 0 });
    }
    if (player.hp > 0 && !(player.fadeOut >= 1)) {
        const px = player.x, py = player.y - (player.z || 0), pr = player.radius || 18;
        // Iron Will: a red-gold heartbeat round the hero, motes circling
        if (m.ironWill > 0) {
            const k = Math.min(1, m.ironWill / 0.4), beat = Math.pow(Math.max(0, Math.sin(fxTime * 12.6)), 6);
            c.globalCompositeOperation = 'lighter';
            glow(c, px, py, pr + 24 + beat * 6, '#ff1744', (0.16 + 0.16 * beat) * k);
            c.globalCompositeOperation = 'source-over';
            const rr = pr + 9 + beat * 4;
            mfxRing(c, px, py, rr, `rgba(198, 40, 40, ${0.75 * k})`, 2.5 + beat * 1.5);
            mfxRing(c, px, py, rr + 2 + beat, `rgba(255, 202, 40, ${0.7 * k})`, 1);
            c.fillStyle = `rgba(211, 47, 47, ${0.95 * k})`; c.strokeStyle = `rgba(255, 213, 79, ${0.9 * k})`; c.lineWidth = 1; c.beginPath();
            for (let i = 0; i < 3; i++) { const a = fxTime * 3 + i * MFX_TAU / 3, x = px + Math.cos(a) * (pr + 13), y = py + Math.sin(a) * (pr + 13); c.moveTo(x + 2.4, y); c.arc(x, y, 2.4, 0, MFX_TAU); }
            c.fill(); c.stroke();
        }
        // Iron Body: a bronze bell closed round him (the skin itself turns bronze in sprites.js), rivets turning, a glint sweeping
        if (m.ironBody > 0) {
            const k = Math.min(1, m.ironBody / 0.25), R = pr + 13, rot = fxTime * 0.6;
            c.fillStyle = `rgba(205, 138, 74, ${0.12 * k})`; c.beginPath(); c.arc(px, py, R, 0, MFX_TAU); c.fill();
            mfxRing(c, px, py, R, `rgba(60, 32, 12, ${0.6 * k})`, 5.5);
            mfxRing(c, px, py, R, `rgba(205, 138, 74, ${0.95 * k})`, 3.5);
            mfxRing(c, px, py, R - 4, `rgba(255, 224, 178, ${0.35 * k})`, 1);
            c.fillStyle = `rgba(255, 224, 178, ${0.9 * k})`; c.beginPath();
            for (let i = 0; i < 8; i++) { const a = rot + i * Math.PI / 4, x = px + Math.cos(a) * R, y = py + Math.sin(a) * R; c.moveTo(x + 1.6, y); c.arc(x, y, 1.6, 0, MFX_TAU); }
            c.fill();
            c.globalCompositeOperation = 'lighter'; // the sheen sweeping round the bell
            const g = fxTime * 2.4;
            c.strokeStyle = `rgba(255, 243, 224, ${0.7 * k})`; c.lineWidth = 3; c.beginPath(); c.arc(px, py, R, g, g + 0.7); c.stroke();
            c.globalCompositeOperation = 'source-over';
        }
        // Stone Skin: stone plates circling him; hardened, they close in, bigger, on a ring of earth
        if (m.stone) {
            const s = m.stone, hard = s.hard, k = Math.min(1, s.t / 0.4), R = pr + (hard ? 10 : 14), rot = hard ? 0.2 : fxTime * 0.8, w = hard ? 7 : 5;
            if (hard) mfxRing(c, px, py, R, `rgba(78, 52, 46, ${0.6 * k})`, 6);
            c.fillStyle = hard ? '#8d6e63' : '#a1887f'; c.strokeStyle = '#3e2723'; c.lineWidth = 1.2; c.globalAlpha = k; c.beginPath();
            for (let i = 0; i < 8; i++) {
                const a = rot + i * Math.PI / 4, x = px + Math.cos(a) * R, y = py + Math.sin(a) * R, ca = Math.cos(a), sa = Math.sin(a);
                const pt = (u, v) => [x + ca * u - sa * v, y + sa * u + ca * v]; // a rough plate, its long side along the ring
                c.moveTo(...pt(-w * 0.6, -w)); c.lineTo(...pt(w * 0.7, -w * 0.7)); c.lineTo(...pt(w * 0.6, w * 0.9)); c.lineTo(...pt(-w * 0.7, w * 0.8)); c.closePath();
            }
            c.fill(); c.stroke(); c.globalAlpha = 1;
        }
        // Karmic Will: a violet wheel behind the heartbeat, its rim thickening with what's stored
        if (m.karma && m.ironWill > 0) {
            const f = Math.min(1, m.karma.store / (player.maxHp * 0.4)), R = pr + 19, rot = fxTime * 1.4;
            c.globalCompositeOperation = 'lighter'; glow(c, px, py, R + 12, '#ab47bc', 0.12 + 0.25 * f); c.globalCompositeOperation = 'source-over';
            mfxRing(c, px, py, R, 'rgba(106, 27, 154, 0.75)', 2 + 4 * f);
            c.strokeStyle = 'rgba(225, 190, 231, 0.85)'; c.lineWidth = 1.4; c.beginPath();
            for (let i = 0; i < 8; i++) { const a = rot + i * Math.PI / 4; c.moveTo(px + Math.cos(a) * (R - 4), py + Math.sin(a) * (R - 4)); c.lineTo(px + Math.cos(a) * (R + 5 + 4 * f), py + Math.sin(a) * (R + 5 + 4 * f)); }
            c.stroke();
        }
        // A full Chi gauge (or Tiger's Frenzy): a slow gold seal under him, the Hundred-Hand Strike is ready
        const chi = m.chi || 0;
        if (chi >= 100 || m.frenzy) { // drawn over the hero, so only a ring and its ticks, nothing across him
            c.globalCompositeOperation = 'lighter';
            const pulse = 0.6 + 0.4 * Math.sin(fxTime * 5), R = pr + 12, rot = fxTime * 0.7;
            mfxRing(c, px, py, R, withAlpha(MFXC.gold, 0.55 * pulse), 1.6);
            c.strokeStyle = withAlpha(MFXC.pale, 0.7 * pulse); c.lineWidth = 2; c.beginPath();
            for (let i = 0; i < 8; i++) { const a = rot + i * Math.PI / 4; c.moveTo(px + Math.cos(a) * (R + 2), py + Math.sin(a) * (R + 2)); c.lineTo(px + Math.cos(a) * (R + (i % 2 ? 5 : 8)), py + Math.sin(a) * (R + (i % 2 ? 5 : 8))); }
            c.stroke();
            c.globalCompositeOperation = 'source-over';
        }
        // Flurry charges: lit prayer beads behind his shoulders
        const n = Math.min(2, m.flurry || 0);
        if (n > 0) {
            const aim = player.dash ? player.dash.angle : Math.atan2(mouseY - player.y, mouseX - player.x);
            for (let i = 0; i < n; i++) {
                const a = aim + Math.PI + (i ? 0.55 : -0.55), x = px + Math.cos(a) * (pr + 8), y = py + Math.sin(a) * (pr + 8);
                c.globalCompositeOperation = 'lighter'; glow(c, x, y, 9, '#ffca28', 0.75); c.globalCompositeOperation = 'source-over';
                c.fillStyle = MFXC.pale; c.strokeStyle = 'rgba(80, 40, 10, 0.9)'; c.lineWidth = 1.2;
                c.beginPath(); c.arc(x, y, 3.2, 0, MFX_TAU); c.fill(); c.stroke();
            }
        }
    }
    c.restore();
}

// ==========================================
// Effects (skillfx.js drawSkillEffect chain)
// ==========================================

// The effects pass runs under the enemies, so each effect draws in two layers: the ground part here (rings, seals, dust),
// and the part in the air (fists, impact flashes, life motes) from drawMonkWorld, over the bodies it strikes (over = true)
const MFX_DRAW = {
    mk_jab: (c, ef, p, k, o) => mfxJab(c, ef, p, k, o), mk_flurry: (c, ef, p, k, o) => mfxFlurry(c, ef, p, k, o),
    mk_shockwave: (c, ef, p, k, o) => o || mfxShockwave(c, ef, p, k), mk_palm: (c, ef, p, k, o) => o || mfxPalm(c, ef, p, k),
    mk_tremor: (c, ef, p, k, o) => o || mfxTremor(c, ef, p, k), mk_rush: (c, ef, p, k, o) => mfxRush(c, ef, p, k, o),
    mk_step: (c, ef, p, k, o) => o || mfxStep(c, ef, p, k), mk_kick: (c, ef, p, k, o) => mfxKick(c, ef, p, k, o),
    mk_slam: (c, ef, p, k, o) => mfxSlam(c, ef, p, k, o), mk_stomp: (c, ef, p, k, o) => o || mfxStomp(c, ef, p, k),
    mk_crane: (c, ef, p, k, o) => mfxCrane(c, ef, p, k, o), mk_iron_pulse: (c, ef, p, k, o) => o || mfxIronPulse(c, ef, p, k),
    mk_will_heal: (c, ef, p, k, o) => o && mfxWillHeal(c, ef, p, k),
    // the web (monk.js)
    mk_star: (c, ef, p, k, o) => mfxStar(c, ef, p, k, o), mk_echo: (c, ef, p, k, o) => mfxEcho(c, ef, p, k, o),
    mk_gather: (c, ef, p, k, o) => o || mfxGather(c, ef, p, k), mk_stone_set: (c, ef, p, k, o) => o || mfxStoneSet(c, ef, p, k),
    mk_stone_burst: (c, ef, p, k, o) => mfxStoneBurst(c, ef, p, k, o), mk_claw: (c, ef, p, k, o) => o && mfxClaw(c, ef, p, k),
    mk_provoke: (c, ef, p, k, o) => o || mfxProvoke(c, ef, p, k), mk_karma: (c, ef, p, k, o) => mfxKarma(c, ef, p, k, o),
    mk_rise: (c, ef, p, k, o) => mfxRise(c, ef, p, k, o),
};
function mfxDraw(c, ef, over) {
    const f = MFX_DRAW[ef.type];
    if (!f) return false;
    const k = clamp01(ef.life / ef.maxLife), p = 1 - k;
    c.save(); c.globalAlpha = 1;
    f(c, ef, p, k, over);
    c.restore();
    return true;
}
function drawMonkEffect(c, ef) { return mfxDraw(c, ef, false); }

// A jab landing: a white-gold star along the blow and a small crescent of force
function mfxJab(c, ef, p, k, over) {
    const a = ef.angle || 0;
    if (!over) return;
    if (!ef.burstDone) { ef.burstDone = true; burst(ef.x, ef.y, a, 1.1, 3, { kind: 'spark', color: MFXC.pale, size: 2, life: 0.14, speed: [160, 320], drag: 6 }); }
    c.translate(ef.x, ef.y); c.rotate(a); c.globalCompositeOperation = 'lighter';
    const s = 0.7 + easeOut(Math.min(1, p * 2)) * 0.6;
    c.fillStyle = `rgba(255, 243, 196, ${k})`; c.beginPath();
    c.moveTo(15 * s, 0); c.lineTo(2 * s, 3 * s); c.lineTo(0, 9 * s); c.lineTo(-2 * s, 3 * s); c.lineTo(-8 * s, 0); c.lineTo(-2 * s, -3 * s); c.lineTo(0, -9 * s); c.lineTo(2 * s, -3 * s); c.closePath(); c.fill();
    c.strokeStyle = withAlpha(MFXC.gold, 0.9 * k); c.lineWidth = 3 * k + 0.5;
    c.beginPath(); c.arc(-6, 0, 8 + 16 * easeOut(p), -1, 1); c.stroke();
}

// A flurry: a blur of fists popping out across the cone one after another; the Hundred-Hand Strike, bigger and gold
function mfxFlurry(c, ef, p, k, over) {
    const hund = !!ef.hundred, a = ef.angle || 0, R = hund ? MK_HUNDRED_RANGE : MK_FLURRY_RANGE, cone = hund ? 1.75 : 0.9;
    if (!ef.fists) {
        const n = hund ? 14 : Math.max(4, (ef.blows || 4) * 2);
        ef.fists = Array.from({ length: n }, (_, i) => ({ a: a + (Math.random() - 0.5) * cone, d: R * (0.45 + Math.random() * 0.45), t0: i / n * 0.7, s: i % 2 ? 1 : -1 }));
        if (hund) { burst(ef.x, ef.y, a, cone, 14, { kind: 'spark', color: MFXC.gold, size: 2.4, life: 0.3, speed: [220, 480], drag: 5 }); addShake(1.5); }
    }
    c.translate(ef.x, ef.y); c.globalCompositeOperation = 'lighter';
    if (over) return mfxFlurryFists(c, ef, p, hund);
    if (hund) { // the 100 degree band of the strike
        c.strokeStyle = withAlpha(MFXC.gold, 0.4 * k); c.lineWidth = 10;
        c.beginPath(); c.arc(0, 0, R * 0.8, a - cone / 2, a + cone / 2); c.stroke();
        glow(c, Math.cos(a) * R * 0.5, Math.sin(a) * R * 0.5, R * 0.75, '#ffca28', 0.3 * k);
    }
    c.strokeStyle = withAlpha(MFXC.pale, 0.35 * k); c.lineWidth = 1.5; c.beginPath(); // speed lines through the cone
    for (const o of [-0.3, 0, 0.3]) { const aa = a + o * cone; c.moveTo(Math.cos(aa) * 18, Math.sin(aa) * 18); c.lineTo(Math.cos(aa) * R * 0.95, Math.sin(aa) * R * 0.95); }
    c.stroke();
}
function mfxFlurryFists(c, ef, p, hund) {
    const fr = hund ? 6 : 4.6;
    for (const f of ef.fists) {
        const q = (p - f.t0) / 0.3;
        if (q < 0 || q > 1) continue;
        const d = 14 + (f.d - 14) * easeOut(Math.min(1, q * 2.2)), x = Math.cos(f.a) * d, y = Math.sin(f.a) * d, al = 1 - q;
        c.globalCompositeOperation = 'lighter';
        mfxTaper(c, Math.cos(f.a) * 12, Math.sin(f.a) * 12, x, y, fr * 1.6, withAlpha(hund ? MFXC.gold : MFXC.pale, 0.45 * al));
        c.globalCompositeOperation = 'source-over'; c.globalAlpha = al;
        mfxFist(c, x, y, fr, f.a, hund ? MFXC.pale : '#eceff1');
        c.globalAlpha = 1;
    }
}

// The Hundred-Hand Strike's ending: a gold shockwave with chi rays
function mfxShockwave(c, ef, p, k) {
    const r = ef.r || 120;
    if (!ef.burstDone) {
        ef.burstDone = true;
        burst(ef.x, ef.y, 0, MFX_TAU, 16, { kind: 'spark', color: MFXC.gold, size: 2.6, life: 0.35, speed: [240, 520], drag: 4 });
        dustPuff(ef.x, ef.y, 0, MFX_TAU, 8, MFXC.dust); addShake(2.5);
    }
    const R = r * easeOut(Math.min(1, p * 1.6));
    c.globalCompositeOperation = 'lighter';
    c.fillStyle = `rgba(255, 202, 40, ${0.16 * k})`; c.beginPath(); c.arc(ef.x, ef.y, R, 0, MFX_TAU); c.fill();
    c.globalCompositeOperation = 'source-over'; mfxRing(c, ef.x, ef.y, R, withAlpha(MFXC.saff, k), 7 * k + 1); c.globalCompositeOperation = 'lighter';
    mfxRing(c, ef.x, ef.y, R * 0.85, `rgba(255, 255, 255, ${0.6 * k})`, 2 * k);
    c.strokeStyle = withAlpha(MFXC.pale, 0.8 * k); c.lineWidth = 2; c.beginPath();
    for (let i = 0; i < 8; i++) { const a = i * Math.PI / 4 + p * 0.6; c.moveTo(ef.x + Math.cos(a) * R * 0.5, ef.y + Math.sin(a) * R * 0.5); c.lineTo(ef.x + Math.cos(a) * R * 0.95, ef.y + Math.sin(a) * R * 0.95); }
    c.stroke();
}

// A palm print of chi (the hand flat on the ground), seen from above
function mfxPalmPrint(c, x, y, s, rot, color) {
    c.save(); c.translate(x, y); c.rotate(rot); c.fillStyle = color; c.beginPath();
    c.ellipse(-2 * s, 0, 9 * s, 8 * s, 0, 0, MFX_TAU);
    for (const [fx, fy, l] of [[9, -5.2, 7], [11, -1.8, 8], [11, 1.8, 8], [9, 5.2, 6.5]]) { c.moveTo((fx + l) * s, fy * s); c.ellipse((fx + l / 2) * s, fy * s, l / 2 * s, 1.6 * s, 0, 0, MFX_TAU); }
    c.moveTo(2 * s, -9 * s); c.ellipse(1 * s, -10 * s, 5 * s, 2 * s, -0.7, 0, MFX_TAU); // thumb
    c.fill(); c.restore();
}

// Earth Palm: the palm strikes the ground, a chi seal flashes, a ring of dust rolls out
function mfxPalm(c, ef, p, k) {
    const r = ef.r || 130;
    if (!ef.burstDone) {
        ef.burstDone = true; ef.rot = Math.atan2(ef.y - player.y, ef.x - player.x);
        dustPuff(ef.x, ef.y, 0, MFX_TAU, 12, MFXC.dust);
        burst(ef.x, ef.y, 0, MFX_TAU, 8, { kind: 'debris', color: '#7a6248', size: 3.2, life: 0.45, speed: [100, 260], drag: 5 });
        burst(ef.x, ef.y, 0, MFX_TAU, 10, { kind: 'spark', color: MFXC.saff, size: 2.2, life: 0.25, speed: [200, 420], drag: 5 });
        addShake(2);
    }
    const R = r * easeOut(Math.min(1, p * 1.8));
    c.globalCompositeOperation = 'lighter';
    glow(c, ef.x, ef.y, r * 0.7, '#ff9800', 0.3 * k);
    c.globalCompositeOperation = 'source-over';
    mfxSigil(c, ef.x, ef.y, r * 0.55, ef.rot + p * 0.8, MFXC.orange, 0.6 * k, 1.8);
    mfxRing(c, ef.x, ef.y, R, withAlpha('#ff8f00', 0.85 * k), 4 * k + 1);
    c.globalAlpha = Math.min(1, k * 1.6);
    mfxPalmPrint(c, ef.x, ef.y, (r / 130) * (2.2 + 0.4 * easeOut(Math.min(1, p * 4))), ef.rot, 'rgba(230, 81, 0, 0.7)');
    c.globalAlpha = Math.min(1, k * 2) * 0.8;
    mfxPalmPrint(c, ef.x, ef.y, (r / 130) * 1.5, ef.rot, 'rgba(255, 213, 79, 0.9)');
}

// Crippling Tremor: earth-gold rings rippling out from the hero, dust thrown up
function mfxTremor(c, ef, p, k) {
    const r = ef.r || 500;
    if (!ef.burstDone) {
        ef.burstDone = true;
        for (let i = 0; i < 8; i++) { const a = i * Math.PI / 4; dustPuff(ef.x + Math.cos(a) * 40, ef.y + Math.sin(a) * 40, a, 0.6, 2, MFXC.dust); }
        addShake(2);
    }
    for (let i = 0; i < 3; i++) {
        const q = clamp01(p * 1.4 - i * 0.18);
        if (q <= 0 || q >= 1) continue;
        mfxRing(c, ef.x, ef.y, r * easeOut(q), withAlpha('#8d5a2b', 0.7 * (1 - q)), 6 * (1 - q) + 1);
        mfxRing(c, ef.x, ef.y, r * easeOut(q) - 4, withAlpha(MFXC.saff, 0.5 * (1 - q)), 1.5);
    }
    mfxSigil(c, ef.x, ef.y, 46, -p, '#8d5a2b', 0.8 * k, 2.2);
}

// Rushing Fist: a saffron streak to the marked enemy, ghosts along it, a big fist of chi at the end
function mfxRush(c, ef, p, k, over) {
    const a = Math.atan2(ef.y1 - ef.y0, ef.x1 - ef.x0);
    if (!ef.burstDone) {
        ef.burstDone = true;
        burst(ef.x1, ef.y1, a, 1.4, 12, { kind: 'spark', color: MFXC.gold, size: 2.4, life: 0.25, speed: [200, 460], drag: 5 });
        spawnParticle({ kind: 'ring', color: MFXC.gold, x: ef.x1, y: ef.y1, vx: 0, vy: 0, size: 6, grow: 180, life: 0.2, drag: 0, spin: 0, rot: 0 });
        addShake(1.8);
    }
    c.globalCompositeOperation = 'lighter';
    if (!over) {
        mfxTaper(c, ef.x0, ef.y0, ef.x1, ef.y1, 22, withAlpha(MFXC.orange, 0.45 * k));
        mfxTaper(c, ef.x0, ef.y0, ef.x1, ef.y1, 9, withAlpha(MFXC.pale, 0.8 * k));
        for (const t of [0.3, 0.55, 0.8]) glow(c, lerp(ef.x0, ef.x1, t), lerp(ef.y0, ef.y1, t), 16, '#ffb300', 0.35 * k * t);
        return;
    }
    glow(c, ef.x1, ef.y1, 34, '#ffca28', 0.6 * k);
    c.globalCompositeOperation = 'source-over'; c.globalAlpha = k;
    mfxFist(c, ef.x1 - Math.cos(a) * 6, ef.y1 - Math.sin(a) * 6, 8 + 4 * easeOut(p), a, MFXC.pale);
}

// Swift Step: light footfalls along the dash and two lines of wind
function mfxStep(c, ef, p, k) {
    const a = Math.atan2(ef.y1 - ef.y0, ef.x1 - ef.x0), nx = -Math.sin(a), ny = Math.cos(a);
    if (!ef.burstDone) { ef.burstDone = true; dustPuff(ef.x0, ef.y0, a + Math.PI, 1.2, 5, MFXC.dust); }
    c.globalCompositeOperation = 'lighter';
    for (let i = 1; i <= 4; i++) {
        const t = i / 5, s = i % 2 ? 1 : -1, x = lerp(ef.x0, ef.x1, t) + nx * s * 6, y = lerp(ef.y0, ef.y1, t) + ny * s * 6;
        c.fillStyle = withAlpha(MFXC.orange, 0.45 * k * t); c.beginPath(); c.ellipse(x, y, 7, 4, a, 0, MFX_TAU); c.fill();
    }
    c.strokeStyle = `rgba(255, 248, 225, ${0.5 * k})`; c.lineWidth = 1.5; c.lineCap = 'round'; c.beginPath();
    for (const s of [-1, 1]) { const o = s * 14, t0 = 0.15 + p * 0.3; c.moveTo(lerp(ef.x0, ef.x1, t0) + nx * o, lerp(ef.y0, ef.y1, t0) + ny * o); c.lineTo(lerp(ef.x0, ef.x1, 0.95) + nx * o, lerp(ef.y0, ef.y1, 0.95) + ny * o); }
    c.stroke();
    if (!ef.tiger) return;
    // Tiger's Path: an orange streak with dark stripes across it, widening toward where he landed
    mfxTaper(c, ef.x0, ef.y0, ef.x1, ef.y1, 30, withAlpha('#ff9800', 0.32 * k));
    c.globalCompositeOperation = 'source-over';
    const L = Math.hypot(ef.x1 - ef.x0, ef.y1 - ef.y0), ux = Math.cos(a) * 4, uy = Math.sin(a) * 4;
    c.strokeStyle = `rgba(40, 24, 16, ${0.65 * k})`; c.lineWidth = 3; c.lineCap = 'round'; c.beginPath();
    for (let s = 24; s < L - 8; s += 22) { const t = s / L, w = 13 * t, x = lerp(ef.x0, ef.x1, t), y = lerp(ef.y0, ef.y1, t); c.moveTo(x + nx * w - ux, y + ny * w - uy); c.lineTo(x - nx * w + ux, y - ny * w + uy); }
    c.stroke();
}

// Dragon Kick lands: a fiery crescent bursting along the kick, embers and a gold ring
function mfxKick(c, ef, p, k, over) {
    const a = ef.angle || 0;
    if (!ef.burstDone) {
        ef.burstDone = true;
        burst(ef.x, ef.y, a, 1.3, 14, { kind: 'dot', color: MFXC.ember, size: 2.4, life: 0.45, speed: [140, 360], drag: 3 });
        burst(ef.x, ef.y, a, 0.9, 8, { kind: 'spark', color: MFXC.pale, size: 2.4, life: 0.22, speed: [260, 520], drag: 5 });
        addShake(2.5);
    }
    c.translate(ef.x, ef.y); c.rotate(a); c.globalCompositeOperation = 'lighter';
    const r = 20 + 26 * easeOut(p);
    if (!over) return glow(c, 8, 0, 46, '#ff7043', 0.55 * k);
    mfxCrescent(c, -8, 0, r, -1.15, 1.15, 13 * k + 2, withAlpha(MFXC.deep, 0.8 * k));
    mfxCrescent(c, -8, 0, r - 3, -0.9, 0.9, 7 * k + 1, withAlpha(MFXC.gold, 0.9 * k));
    mfxRing(c, 0, 0, 10 + 40 * easeOut(p), withAlpha(MFXC.pale, 0.7 * k), 2.5 * k);
}

// The kicked enemy hits a wall: a starburst of fire, debris and dust
function mfxSlam(c, ef, p, k, over) {
    if (!ef.burstDone) {
        ef.burstDone = true;
        ef.spikes = Array.from({ length: 10 }, (_, i) => ({ a: i * MFX_TAU / 10 + jitter(0.3), l: 0.6 + Math.random() * 0.4 }));
        burst(ef.x, ef.y, 0, MFX_TAU, 12, { kind: 'debris', color: '#6d5c4d', size: 3.5, life: 0.5, speed: [100, 300], drag: 4 });
        burst(ef.x, ef.y, 0, MFX_TAU, 14, { kind: 'dot', color: MFXC.ember, size: 2.4, life: 0.5, speed: [120, 340], drag: 3 });
        dustPuff(ef.x, ef.y, 0, MFX_TAU, 9, MFXC.dust);
        addShake(3);
    }
    const s = 18 + 34 * easeOut(Math.min(1, p * 2.5));
    c.translate(ef.x, ef.y); c.globalCompositeOperation = 'lighter';
    if (!over) { glow(c, 0, 0, 60, '#ff5722', 0.6 * k); mfxRing(c, 0, 0, 14 + 52 * easeOut(p), withAlpha(MFXC.ember, k), 5 * k + 0.5); return; }
    c.fillStyle = `rgba(255, 213, 79, ${0.9 * k})`; c.beginPath();
    for (const sp of ef.spikes) { const a = sp.a; c.moveTo(Math.cos(a - 0.14) * 6, Math.sin(a - 0.14) * 6); c.lineTo(Math.cos(a) * s * sp.l, Math.sin(a) * s * sp.l); c.lineTo(Math.cos(a + 0.14) * 6, Math.sin(a + 0.14) * 6); }
    c.fill();
}

// Dragon's Descent: an orange shockwave and a dragon coil burning on the ground
function mfxStomp(c, ef, p, k) {
    const r = ef.r || 140;
    if (!ef.burstDone) {
        ef.burstDone = true;
        dustPuff(ef.x, ef.y, 0, MFX_TAU, 14, MFXC.dust);
        burst(ef.x, ef.y, 0, MFX_TAU, 16, { kind: 'dot', color: MFXC.ember, size: 2.4, life: 0.5, speed: [160, 380], drag: 3 });
        burst(ef.x, ef.y, 0, MFX_TAU, 10, { kind: 'debris', color: '#6d5c4d', size: 3, life: 0.45, speed: [100, 260], drag: 4 });
        addShake(3);
    }
    const R = r * easeOut(Math.min(1, p * 1.7));
    c.translate(ef.x, ef.y); c.globalCompositeOperation = 'lighter';
    c.fillStyle = `rgba(255, 112, 67, ${0.15 * k})`; c.beginPath(); c.arc(0, 0, R, 0, MFX_TAU); c.fill();
    c.rotate(p * 1.5); // the coil: a dragon's body spiralling in to its head
    c.strokeStyle = withAlpha(MFXC.deep, 0.85 * k); c.lineWidth = 7 * k + 1; c.lineCap = 'round'; c.beginPath();
    for (let i = 0; i <= 40; i++) { const t = i / 40, a = t * MFX_TAU * 1.6, rr = r * (0.62 - t * 0.48); c.lineTo(Math.cos(a) * rr, Math.sin(a) * rr); }
    c.stroke();
    c.strokeStyle = withAlpha(MFXC.gold, 0.9 * k); c.lineWidth = 2.5 * k; c.stroke();
    c.rotate(-p * 1.5);
    mfxRing(c, 0, 0, R, withAlpha(MFXC.ember, k), 7 * k + 1);
    mfxRing(c, 0, 0, R * 0.88, withAlpha(MFXC.pale, 0.6 * k), 2 * k);
}

// Crane Kick: one full turn of the leg round the hero, a band of wind behind the foot
function mfxCrane(c, ef, p, k, over) {
    const r = ef.r || 110;
    if (!ef.burstDone) {
        ef.burstDone = true; ef.a0 = Math.atan2(mouseY - ef.y, mouseX - ef.x) - Math.PI / 2;
        dustPuff(ef.x, ef.y, 0, MFX_TAU, 10, MFXC.dust);
        addShake(2);
    }
    const lead = ef.a0 + MFX_TAU * easeOut(Math.min(1, p * 1.5));
    c.translate(ef.x, ef.y); c.globalCompositeOperation = 'lighter';
    if (over) { // the foot's arc, bright, over the bodies it sweeps
        c.strokeStyle = withAlpha(MFXC.gold, 0.95 * k); c.lineWidth = 3; c.lineCap = 'round';
        c.beginPath(); c.moveTo(Math.cos(lead) * r * 0.4, Math.sin(lead) * r * 0.4); c.lineTo(Math.cos(lead) * r, Math.sin(lead) * r); c.stroke();
        c.strokeStyle = withAlpha(MFXC.pale, 0.6 * k); c.lineWidth = 4; c.beginPath(); c.arc(0, 0, r * 0.9, lead - 0.6, lead); c.stroke();
        return;
    }
    mfxRing(c, 0, 0, r, withAlpha(MFXC.saff, 0.45 * k), 1.5);
    c.globalCompositeOperation = 'source-over'; c.lineCap = 'butt';
    const N = 8, span = 2.2; // a crescent of wind behind the foot: thin and faint at the back, thick and bright at the foot
    for (let i = 0; i < N; i++) {
        const t = (i + 1) / N;
        c.strokeStyle = withAlpha(i > N - 3 ? MFXC.pale : '#ffe0b2', (0.08 + 0.4 * t * t) * k); c.lineWidth = r * (0.08 + 0.2 * t);
        c.beginPath(); c.arc(0, 0, r * 0.78, lead - span * (1 - i / N), lead - span * (1 - t) + 0.02); c.stroke();
    }
    c.globalCompositeOperation = 'lighter';
    if (mfxTick(ef) && p < 0.7) spawnParticle({ kind: 'dot', color: MFXC.pale, x: ef.x + Math.cos(lead) * r, y: ef.y + Math.sin(lead) * r,
        vx: -Math.sin(lead) * 120, vy: Math.cos(lead) * 120, size: 1.8, life: 0.3, drag: 3, grow: 0, spin: 0, rot: 0 });
}

// Iron Body ends: a bronze pulse with a chi seal, metal sparks
function mfxIronPulse(c, ef, p, k) {
    const r = ef.r || 140;
    if (!ef.burstDone) {
        ef.burstDone = true;
        burst(ef.x, ef.y, 0, MFX_TAU, 18, { kind: 'spark', color: '#ffcc80', size: 2.4, life: 0.3, speed: [220, 480], drag: 5 });
        spawnParticle({ kind: 'ring', color: MFXC.bronze, x: ef.x, y: ef.y, vx: 0, vy: 0, size: 10, grow: 260, life: 0.25, drag: 0, spin: 0, rot: 0 });
        addShake(2);
    }
    const R = r * easeOut(Math.min(1, p * 1.6));
    c.fillStyle = `rgba(184, 115, 51, ${0.14 * k})`; c.beginPath(); c.arc(ef.x, ef.y, R, 0, MFX_TAU); c.fill();
    mfxRing(c, ef.x, ef.y, R, `rgba(60, 32, 12, ${0.5 * k})`, 9 * k + 2);
    mfxRing(c, ef.x, ef.y, R, withAlpha(MFXC.bronze, k), 7 * k + 1);
    c.globalCompositeOperation = 'lighter';
    mfxRing(c, ef.x, ef.y, R - 3, withAlpha('#ffd54f', 0.8 * k), 2);
    mfxSigil(c, ef.x, ef.y, R * 0.5, p, MFXC.bronze, k, 2);
}

// Iron Will: motes of red-gold life drawn into the hero
function mfxWillHeal(c, ef, p, k) {
    if (!ef.motes) ef.motes = Array.from({ length: 4 }, () => ({ a: Math.random() * MFX_TAU, d: 34 + Math.random() * 30, w: (Math.random() - 0.5) * 2 }));
    const tx = player.x, ty = player.y - (player.z || 0), q = p * p;
    c.globalCompositeOperation = 'lighter';
    for (const m of ef.motes) {
        const a = m.a + m.w * p, x = lerp(ef.x + Math.cos(a) * m.d, tx, q), y = lerp(ef.y + Math.sin(a) * m.d, ty, q);
        c.globalCompositeOperation = 'source-over';
        c.fillStyle = withAlpha('#d32f2f', 0.95 * Math.min(1, k * 2)); c.beginPath(); c.arc(x, y, 3, 0, MFX_TAU); c.fill();
        c.fillStyle = withAlpha('#ffe082', Math.min(1, k * 2)); c.beginPath(); c.arc(x, y, 1.3, 0, MFX_TAU); c.fill();
    }
    if (p > 0.75) glow(c, tx, ty, 22, '#ff5252', 0.5 * (1 - p) * 4);
}

// ==========================================
// The web's effects (monk.js "the web")
// ==========================================

function mfxStarShape(c, x, y, r, rot, color) {
    c.fillStyle = color; c.beginPath();
    for (let i = 0; i < 10; i++) { const a = rot + i * Math.PI / 5, rr = i % 2 ? r * 0.42 : r; c.lineTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr); }
    c.closePath(); c.fill();
}

// Seven-Star Rush: a star shoots from the fallen to the next mark, a dotted gold trail behind it
function mfxStar(c, ef, p, k, over) {
    const q = easeOut(Math.min(1, p * 2.2)), x = lerp(ef.x0, ef.x1, q), y = lerp(ef.y0, ef.y1, q);
    c.globalCompositeOperation = 'lighter';
    if (!over) {
        c.strokeStyle = withAlpha(MFXC.gold, 0.6 * k); c.lineWidth = 2.5; c.lineCap = 'round'; c.setLineDash([2, 8]);
        c.beginPath(); c.moveTo(ef.x0, ef.y0); c.lineTo(x, y); c.stroke(); c.setLineDash([]);
        return;
    }
    glow(c, x, y, 20, '#ffca28', 0.7 * k);
    mfxStarShape(c, x, y, 8 + 2 * Math.sin(p * 24), p * 5, withAlpha(MFXC.pale, k));
}

// Resonating Mark goes off: echo rings fold in onto the enemy, then burst out with a seal
function mfxEcho(c, ef, p, k, over) {
    const R = ef.r || 40, big = ef.store > 0;
    if (big && !ef.burstDone && p > 0.3) { ef.burstDone = true; burst(ef.x, ef.y, 0, MFX_TAU, 14, { kind: 'spark', color: MFXC.gold, size: 2.4, life: 0.3, speed: [200, 460], drag: 5 }); }
    c.globalCompositeOperation = 'lighter';
    if (p < 0.3) {
        if (over) return;
        const q = p / 0.3;
        for (let i = 0; i < 3; i++) mfxRing(c, ef.x, ef.y, R * (1.7 - q) * (1 - i * 0.18), withAlpha(MFXC.saff, 0.75 * q), 2);
        return;
    }
    if (!big) return;
    const q = (p - 0.3) / 0.7, rr = R * 0.3 + R * 1.7 * easeOut(q);
    if (!over) return glow(c, ef.x, ef.y, rr, '#ffb300', 0.5 * (1 - q));
    mfxRing(c, ef.x, ef.y, rr, withAlpha(MFXC.pale, 1 - q), 4 * (1 - q) + 1);
    mfxSigil(c, ef.x, ef.y, R * 0.7, q * 2, MFXC.gold, 1 - q, 2);
}

// Gathering Palm: earth streaks drawn in from every mark to the heap, a ring closing on it
function mfxGather(c, ef, p, k) {
    if (!ef.burstDone) { ef.burstDone = true; dustPuff(ef.x, ef.y, 0, MFX_TAU, 8, MFXC.dust); }
    const q = easeOut(Math.min(1, p * 2.4));
    for (const [fx, fy] of ef.from) mfxTaper(c, fx, fy, lerp(fx, ef.x, q), lerp(fy, ef.y, q), 14, `rgba(141, 90, 43, ${0.55 * k})`);
    mfxRing(c, ef.x, ef.y, 26 + 90 * (1 - q), withAlpha('#8d5a2b', 0.8 * k), 4 * k + 1);
    mfxSigil(c, ef.x, ef.y, 30, -p * 2, MFXC.orange, 0.8 * k, 2);
}

// Stone Skin forms (or hardens): a ring of earth closing on the hero
function mfxStoneSet(c, ef, p, k) {
    const x = player.x, y = player.y;
    if (!ef.burstDone) { ef.burstDone = true; dustPuff(x, y, 0, MFX_TAU, ef.hard ? 10 : 5, MFXC.dust); }
    mfxRing(c, x, y, (player.radius || 18) + 12 + 50 * (1 - easeOut(p)), withAlpha(ef.hard ? '#5d4037' : MFXC.earth, k), (ef.hard ? 6 : 3) * k + 1);
}

// The hardened stone breaks: a brown ring and stone shards thrown outward
function mfxStoneBurst(c, ef, p, k, over) {
    const r = ef.r || 140;
    if (!ef.burstDone) {
        ef.burstDone = true; ef.sh = Array.from({ length: 12 }, (_, i) => ({ a: i * MFX_TAU / 12 + jitter(0.2), s: 4 + Math.random() * 4 }));
        burst(ef.x, ef.y, 0, MFX_TAU, 16, { kind: 'debris', color: '#6d4c41', size: 3.5, life: 0.5, speed: [160, 380], drag: 4 });
        dustPuff(ef.x, ef.y, 0, MFX_TAU, 10, MFXC.dust); addShake(3);
    }
    const R = r * easeOut(Math.min(1, p * 1.6));
    if (!over) {
        c.fillStyle = `rgba(121, 85, 72, ${0.18 * k})`; c.beginPath(); c.arc(ef.x, ef.y, R, 0, MFX_TAU); c.fill();
        mfxRing(c, ef.x, ef.y, R, withAlpha('#5d4037', k), 6 * k + 1); mfxRing(c, ef.x, ef.y, R - 4, withAlpha(MFXC.earth, 0.8 * k), 2 * k);
        return;
    }
    c.fillStyle = withAlpha('#a1887f', k); c.strokeStyle = withAlpha('#3e2723', k); c.lineWidth = 1; c.beginPath();
    for (const s of ef.sh) {
        const x = ef.x + Math.cos(s.a) * R * 0.9, y = ef.y + Math.sin(s.a) * R * 0.9;
        c.moveTo(x + Math.cos(s.a) * s.s * 1.6, y + Math.sin(s.a) * s.s * 1.6); c.lineTo(x + Math.cos(s.a + 2.2) * s.s, y + Math.sin(s.a + 2.2) * s.s); c.lineTo(x + Math.cos(s.a - 2.2) * s.s, y + Math.sin(s.a - 2.2) * s.s); c.closePath();
    }
    c.fill(); c.stroke();
}

// Tiger's Path: three claw rakes across each enemy the step passed through
function mfxClaw(c, ef, p, k) {
    if (!ef.burstDone) { ef.burstDone = true; burst(ef.x, ef.y, ef.angle, 1.2, 6, { kind: 'spark', color: '#ffb74d', size: 2.2, life: 0.2, speed: [180, 380], drag: 5 }); }
    const q = easeOut(Math.min(1, p * 3));
    c.translate(ef.x, ef.y); c.rotate((ef.angle || 0) + 0.5); c.lineCap = 'round';
    c.beginPath();
    for (let i = -1; i <= 1; i++) { c.moveTo(-18, i * 7); c.lineTo(-18 + 36 * q, i * 7 + i * 2 * q); }
    c.strokeStyle = `rgba(62, 39, 35, ${0.8 * k})`; c.lineWidth = 4.5; c.stroke();
    c.strokeStyle = withAlpha('#ff9800', k); c.lineWidth = 2.2; c.stroke();
}

// Provoke: red rings drawn in toward the hero
function mfxProvoke(c, ef, p, k) {
    for (let i = 0; i < 3; i++) {
        const q = clamp01(p * 1.5 - i * 0.2);
        if (q <= 0 || q >= 1) continue;
        mfxRing(c, ef.x, ef.y, (ef.r || 250) * (1 - easeOut(q)) + 22, withAlpha('#c62828', 0.7 * (1 - q)), 3);
    }
}

// Karmic Will pays it back: a violet shockwave and the wheel's spokes flung out
function mfxKarma(c, ef, p, k, over) {
    const r = ef.r || 160;
    if (!ef.burstDone) {
        ef.burstDone = true;
        burst(ef.x, ef.y, 0, MFX_TAU, ef.big ? 22 : 14, { kind: 'spark', color: '#e1bee7', size: 2.6, life: 0.35, speed: [240, 520], drag: 4 });
        dustPuff(ef.x, ef.y, 0, MFX_TAU, 8, MFXC.dust); addShake(ef.big ? 4 : 2.5);
    }
    const R = r * easeOut(Math.min(1, p * 1.6));
    c.globalCompositeOperation = 'lighter';
    if (!over) {
        c.fillStyle = `rgba(171, 71, 188, ${0.16 * k})`; c.beginPath(); c.arc(ef.x, ef.y, R, 0, MFX_TAU); c.fill();
        c.globalCompositeOperation = 'source-over'; mfxRing(c, ef.x, ef.y, R, withAlpha('#6a1b9a', k), 7 * k + 1);
        c.globalCompositeOperation = 'lighter'; mfxRing(c, ef.x, ef.y, R * 0.86, withAlpha(MFXC.gold, 0.7 * k), 2 * k);
        return;
    }
    c.strokeStyle = withAlpha('#f3e5f5', 0.85 * k); c.lineWidth = 2.5; c.beginPath();
    for (let i = 0; i < 8; i++) { const a = i * Math.PI / 4 + p * 1.2; c.moveTo(ef.x + Math.cos(a) * R * 0.45, ef.y + Math.sin(a) * R * 0.45); c.lineTo(ef.x + Math.cos(a) * R * 0.95, ef.y + Math.sin(a) * R * 0.95); }
    c.stroke();
}

// Rising Dragon: the kick sends it up a column of fire and chi
function mfxRise(c, ef, p, k, over) {
    if (!ef.burstDone) {
        ef.burstDone = true; dustPuff(ef.x, ef.y, 0, MFX_TAU, 8, MFXC.dust);
        burst(ef.x, ef.y, -Math.PI / 2, 0.6, 12, { kind: 'dot', color: MFXC.ember, size: 2.4, life: 0.45, speed: [200, 420], drag: 3 }); addShake(3);
    }
    c.globalCompositeOperation = 'lighter';
    if (!over) return mfxRing(c, ef.x, ef.y, (ef.r || 16) + 10 + 30 * easeOut(p), withAlpha(MFXC.ember, k), 4 * k + 1);
    const h = 40 + 110 * easeOut(Math.min(1, p * 2));
    mfxTaper(c, ef.x, ef.y, ef.x, ef.y - h, 28 * k + 4, withAlpha(MFXC.deep, 0.5 * k));
    mfxTaper(c, ef.x, ef.y, ef.x, ef.y - h, 11 * k + 2, withAlpha(MFXC.gold, 0.85 * k));
}

// ==========================================
// The chi wave (skillfx.js drawSkillProjectile chain)
// ==========================================

function drawMonkProjectile(c, p) {
    if (!p.mkWave) return false;
    const ang = p.angle !== undefined ? p.angle : Math.atan2(p.vy, p.vx);
    c.save();
    c.translate(p.x, p.y); c.rotate(ang);
    c.globalCompositeOperation = 'lighter';
    glow(c, -4, 0, 30, '#ffb300', 0.5);
    mfxTaper(c, -56, 0, -2, 0, 20, 'rgba(239, 108, 0, 0.45)');
    mfxTaper(c, -40, 0, -2, 0, 9, 'rgba(255, 213, 79, 0.7)');
    mfxCrescent(c, -10, 0, 20, -1.2, 1.2, 8, 'rgba(255, 202, 40, 0.95)');
    mfxCrescent(c, -10, 0, 18, -0.95, 0.95, 3.5, 'rgba(255, 253, 231, 0.95)');
    c.globalCompositeOperation = 'source-over';
    mfxFist(c, 2, 0, 5.5, 0, '#fff8e1');
    c.restore();
    if (mfxTick(p)) spawnParticle({ kind: 'dot', color: Math.random() < 0.5 ? MFXC.gold : MFXC.saff, x: p.x - Math.cos(ang) * 20 + jitter(10), y: p.y - Math.sin(ang) * 20 + jitter(10),
        vx: -Math.cos(ang) * 60 + jitter(40), vy: -Math.sin(ang) * 60 + jitter(40), size: 1.6, life: 0.35, drag: 3, grow: 0, spin: 0, rot: 0 });
    return true;
}
