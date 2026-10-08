// ==========================================
// skillfx_rmb.js - Unique weapon abilities (right click) and the World-Breaker's rune lines
// ==========================================
// Hooks: drawRmbProjectile / drawRmbEffect / updateRmbEmitters (skillfx.js), drawRmbEnemy (main.js enemy loop),
// drawRuneFault (paladin.js). Timed visuals use the effect's elapsed game time.

// ==========================================
// Projectiles
// ==========================================

function drawRmbProjectile(p) {
    if (p.shape === 'storm_arrow') { // Ranger Lightning Volley: an arrow wrapped in lightning, dragging a jagged bolt
        const ang = Math.atan2(p.vy, p.vx);
        ctx.save();
        ctx.globalCompositeOperation = 'lighter'; ctx.lineJoin = 'round'; ctx.lineCap = 'round';
        if (p.trail && p.trail.length > 1) {
            const pts = [];
            for (let i = 0; i < p.trail.length - 1; i++) { // jitter each segment's midpoint every frame
                const [x0, y0] = p.trail[i], [x1, y1] = p.trail[i + 1];
                pts.push([x0, y0], [(x0 + x1) / 2 + jitter(14), (y0 + y1) / 2 + jitter(14)]);
            }
            pts.push([p.x, p.y]);
            const path = () => { ctx.beginPath(); pts.forEach(([x, y], i) => i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)); };
            ctx.strokeStyle = 'rgba(64, 196, 255, 0.45)'; ctx.lineWidth = 6; path(); ctx.stroke();
            ctx.strokeStyle = 'rgba(255, 255, 255, 0.9)'; ctx.lineWidth = 1.5; path(); ctx.stroke();
        }
        const g = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, 20);
        g.addColorStop(0, 'rgba(225, 245, 254, 0.9)'); g.addColorStop(1, 'rgba(41, 121, 255, 0)');
        ctx.fillStyle = g; ctx.beginPath(); ctx.arc(p.x, p.y, 20, 0, Math.PI * 2); ctx.fill();
        ctx.restore();
        drawArrowShape(p.x, p.y, ang, 22, false, 1);
        ctx.save();
        ctx.translate(p.x, p.y); ctx.rotate(ang);
        ctx.globalCompositeOperation = 'lighter';
        ctx.strokeStyle = '#80d8ff'; ctx.lineWidth = 1.3;
        ctx.beginPath(); ctx.moveTo(-24, 0);
        for (let x = -20; x <= 6; x += 4) ctx.lineTo(x, (Math.random() < 0.5 ? -1 : 1) * (2 + Math.random() * 3)); // crackling around the shaft
        ctx.stroke();
        ctx.restore();
        return true;
    }
    if (p.shape === 'net') { // Machinist Net Shot: a weighted rope net unfurling in flight
        const age = 1.5 - p.life, open = easeOut(Math.min(1, age / 0.18)), S = 8 + 20 * open;
        ctx.save();
        ctx.translate(p.x, p.y); ctx.rotate(Math.atan2(p.vy, p.vx) + Math.PI / 4 + Math.sin(age * 14) * 0.15);
        ctx.scale(1, 1 + 0.12 * Math.sin(age * 20));
        drawNetMesh(S, 1);
        ctx.restore();
        return true;
    }
    return false;
}

// A square rope mesh of half-size S with weights on its corners, in the current frame
function drawNetMesh(S, alpha) {
    ctx.globalAlpha = alpha;
    const lines = () => {
        ctx.beginPath();
        for (let i = -2; i <= 2; i++) { const t = i * S / 2; ctx.moveTo(t, -S); ctx.lineTo(t, S); ctx.moveTo(-S, t); ctx.lineTo(S, t); }
    };
    ctx.strokeStyle = 'rgba(40, 30, 20, 0.8)'; ctx.lineWidth = 3; lines(); ctx.stroke();
    ctx.strokeStyle = '#d7ccc8'; ctx.lineWidth = 1.4; lines(); ctx.stroke();
    for (const [x, y] of [[-S, -S], [S, -S], [S, S], [-S, S]]) sprEllipse(ctx, x, y, 3.2, 3.2, '#546e7a');
    ctx.globalAlpha = 1;
}

// ==========================================
// Enemy overlays
// ==========================================

function drawRmbEnemy(e) {
    if (e.netTimer > 0) { // wrapped in the net until the root ends
        const r = e.size / 2 + 4;
        ctx.save();
        ctx.translate(e.x, e.y); ctx.rotate(Math.PI / 4);
        ctx.save();
        ctx.beginPath(); ctx.arc(0, 0, r + 1, 0, Math.PI * 2); ctx.clip();
        drawNetMesh(r, Math.min(1, e.netTimer / 0.3));
        ctx.restore();
        ctx.globalAlpha = Math.min(1, e.netTimer / 0.3);
        for (let i = 0; i < 4; i++) { const a = i * Math.PI / 2 + Math.PI / 4; sprEllipse(ctx, Math.cos(a) * (r + 2), Math.sin(a) * (r + 2), 3.2, 3.2, '#546e7a'); }
        ctx.restore();
    }
}

// ==========================================
// Paladin World-Breaker: rune lines on the ground
// ==========================================

// Five simple runes, drawn upright and centered, half-height s
function drawGlyph(x, y, idx, s) {
    ctx.beginPath();
    switch (idx) {
        case 0: ctx.moveTo(x, y - s); ctx.lineTo(x, y + s); ctx.moveTo(x, y - s * 0.6); ctx.lineTo(x + s * 0.6, y - s); ctx.moveTo(x, y - s * 0.1); ctx.lineTo(x + s * 0.6, y - s * 0.5); break;
        case 1: ctx.moveTo(x, y - s); ctx.lineTo(x + s * 0.6, y); ctx.lineTo(x, y + s); ctx.lineTo(x - s * 0.6, y); ctx.closePath(); break;
        case 2: ctx.moveTo(x - s * 0.6, y - s); ctx.lineTo(x + s * 0.6, y + s); ctx.moveTo(x + s * 0.6, y - s); ctx.lineTo(x - s * 0.6, y + s); ctx.moveTo(x - s * 0.6, y); ctx.lineTo(x + s * 0.6, y); break;
        case 3: ctx.moveTo(x, y + s); ctx.lineTo(x, y - s); ctx.moveTo(x - s * 0.6, y - s * 0.4); ctx.lineTo(x, y - s); ctx.lineTo(x + s * 0.6, y - s * 0.4); break;
        default: ctx.moveTo(x, y + s); ctx.lineTo(x, y - s); ctx.moveTo(x - s * 0.6, y - s); ctx.lineTo(x, y - s * 0.3); ctx.lineTo(x + s * 0.6, y - s); break;
    }
    ctx.stroke();
}

function drawRuneFault(ef, a) {
    if (!ef.glyphs) { // runes spaced evenly along every segment of the fracture
        ef.glyphs = [];
        for (const [x0, y0, x1, y1] of ef.segments) {
            const len = Math.hypot(x1 - x0, y1 - y0);
            for (let d = 8; d < len; d += 16) ef.glyphs.push({ x: lerp(x0, x1, d / len), y: lerp(y0, y1, d / len), idx: Math.floor(Math.random() * 5), ph: Math.random() * 6 });
        }
    }
    const appear = Math.min(1, (ef.maxLife - ef.life) / 0.15);
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    ctx.strokeStyle = `rgba(255, 213, 79, ${0.25 * a})`; ctx.lineWidth = 1; ctx.setLineDash([3, 5]);
    ctx.beginPath();
    for (const s of ef.segments) { ctx.moveTo(s[0], s[1]); ctx.lineTo(s[2], s[3]); }
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.shadowBlur = 8; ctx.shadowColor = '#ffd54f'; ctx.lineWidth = 1.6; ctx.lineCap = 'round';
    ef.glyphs.forEach((g, i) => {
        if (i / ef.glyphs.length > appear * 1.2) return; // the runes kindle outward from the smash
        const pulse = 0.65 + 0.35 * Math.sin(fxTime * 5 + g.ph);
        ctx.strokeStyle = `rgba(255, 236, 179, ${a * pulse})`;
        drawGlyph(g.x, g.y, g.idx, 5);
    });
    ctx.restore();
}

// ==========================================
// Effects
// ==========================================

function drawRmbEffect(ef, p, k) {
    const el = ef.maxLife - ef.life;
    switch (ef.type) {
        case 'wyrm_rake': { // Dragonknight Wyrm Strike: three burning claw slashes tear across the cone
            if (!ef.burstDone) {
                ef.burstDone = true;
                burst(ef.x + Math.cos(ef.angle) * 70, ef.y + Math.sin(ef.angle) * 70, ef.angle, 2.0, 16, { kind: 'spark', color: '#ffab40', size: 2.5, life: 0.35, speed: [180, 420], drag: 5 });
                addShake(2.5);
            }
            ctx.save();
            ctx.translate(ef.x, ef.y); ctx.rotate(ef.angle);
            ctx.globalCompositeOperation = 'lighter';
            for (let i = 0; i < 3; i++) {
                const q = clamp01((el - i * 0.035) / 0.08);
                if (q <= 0) continue;
                const cx = 62 + (i - 1) * 30, L = 78 * easeOut(q), w = 14 * k, slant = (i - 1) * 6;
                ctx.save(); ctx.translate(cx, 0); ctx.rotate(-0.25);
                ctx.fillStyle = `rgba(255, 112, 67, ${0.75 * k})`;
                ctx.beginPath(); ctx.moveTo(slant - 8, -L); ctx.quadraticCurveTo(26, 0, slant - 8, L); ctx.quadraticCurveTo(26 - w, 0, slant - 8, -L); ctx.fill();
                ctx.fillStyle = `rgba(255, 248, 225, ${k})`;
                ctx.beginPath(); ctx.moveTo(slant - 8, -L * 0.85); ctx.quadraticCurveTo(22, 0, slant - 8, L * 0.85); ctx.quadraticCurveTo(22 - w * 0.35, 0, slant - 8, -L * 0.85); ctx.fill();
                ctx.restore();
            }
            ctx.restore();
            return true;
        }

        case 'arcane_beam': { // Spellweaver Arcane Beam: rune circle, layered laser, spiralling runes and a flare at the end
            const dx = ef.x2 - ef.x1, dy = ef.y2 - ef.y1, len = Math.hypot(dx, dy);
            if (!ef.burstDone) {
                ef.burstDone = true;
                burst(ef.x2, ef.y2, Math.atan2(dy, dx), 1.6, 12, { kind: 'spark', color: '#b388ff', size: 2.2, life: 0.3, speed: [150, 380], drag: 5 });
                addShake(1.5);
            }
            const w = 16 * Math.min(1, el / 0.04) * (0.25 + 0.75 * k);
            ctx.save();
            ctx.globalCompositeOperation = 'lighter';
            drawRuneRing(ef.x1, ef.y1, 14 + 12 * easeOut(p), p * 4, '#b388ff', k, 8);
            ctx.translate(ef.x1, ef.y1); ctx.rotate(Math.atan2(dy, dx));
            const band = (h, color) => { ctx.fillStyle = color; ctx.beginPath(); ctx.moveTo(0, -h * 0.4); ctx.lineTo(len, -h); ctx.arc(len, 0, h, -Math.PI / 2, Math.PI / 2); ctx.lineTo(0, h * 0.4); ctx.closePath(); ctx.fill(); };
            band(w * 1.3, `rgba(124, 77, 255, ${0.35 * k})`);
            band(w * 0.75, `rgba(68, 138, 255, ${0.6 * k})`);
            band(w * 0.28, `rgba(255, 255, 255, ${0.95 * k})`);
            ctx.strokeStyle = `rgba(179, 136, 255, ${0.8 * k})`; ctx.lineWidth = 1.2; // crackling edges
            for (const s of [-1, 1]) {
                ctx.beginPath(); ctx.moveTo(0, 0);
                for (let x = 20; x < len; x += 22) ctx.lineTo(x, s * (w * 0.9 + jitter(w * 0.8)));
                ctx.stroke();
            }
            ctx.fillStyle = `rgba(225, 190, 231, ${k})`; // runes spiralling along the beam
            for (let i = 0; i < 9; i++) {
                const x = (el * 700 + i * len / 9) % len, y = Math.sin(x * 0.04 + el * 14) * w * 0.9, s = 3.5;
                ctx.save(); ctx.translate(x, y); ctx.rotate(el * 8 + i);
                ctx.beginPath(); ctx.moveTo(0, -s); ctx.lineTo(s * 0.6, 0); ctx.lineTo(0, s); ctx.lineTo(-s * 0.6, 0); ctx.closePath(); ctx.fill();
                ctx.restore();
            }
            const fg = ctx.createRadialGradient(len, 0, 0, len, 0, 40); // end flare
            fg.addColorStop(0, `rgba(255, 255, 255, ${k})`); fg.addColorStop(0.4, `rgba(179, 136, 255, ${0.5 * k})`); fg.addColorStop(1, 'rgba(124, 77, 255, 0)');
            ctx.fillStyle = fg; ctx.beginPath(); ctx.arc(len, 0, 40, 0, Math.PI * 2); ctx.fill();
            ctx.restore();
            return true;
        }

        case 'thunderclap': { // Ranger Lightning Volley: a thunderclap flash at the bow
            if (!ef.burstDone) {
                ef.burstDone = true;
                burst(ef.x, ef.y, ef.angle, 1.4, 10, { kind: 'spark', color: '#80d8ff', size: 2, life: 0.25, speed: [200, 450], drag: 5 });
                addShake(1.5);
                ef.forks = Array.from({ length: 5 }, () => { const a = ef.angle + jitter(2.4), pts = [[0, 0]]; for (let r = 0; r < 50;) { r += 10 + Math.random() * 8; const aa = a + jitter(0.6); pts.push([Math.cos(aa) * r, Math.sin(aa) * r]); } return pts; });
            }
            ctx.save();
            ctx.translate(ef.x, ef.y);
            ctx.globalCompositeOperation = 'lighter';
            const g = ctx.createRadialGradient(0, 0, 0, 0, 0, 46);
            g.addColorStop(0, `rgba(255, 255, 255, ${k})`); g.addColorStop(0.4, `rgba(128, 216, 255, ${0.5 * k})`); g.addColorStop(1, 'rgba(41, 121, 255, 0)');
            ctx.fillStyle = g; ctx.beginPath(); ctx.arc(0, 0, 46, 0, Math.PI * 2); ctx.fill();
            ctx.strokeStyle = `rgba(225, 245, 254, ${k})`; ctx.lineWidth = 1.5;
            for (const pts of ef.forks) { ctx.beginPath(); pts.forEach(([x, y], i) => i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)); ctx.stroke(); }
            ctx.restore();
            return true;
        }

        case 'dagger_flash': { // Nightblade Execute: one fast, thin violet streak
            drawStreak(ef.x1, ef.y1, ef.x2, ef.y2, 6 * k, '#ce93d8', k);
            return true;
        }

        case 'gale_crescent': { // Swordsaint Phantom Wind: a huge crescent of wind with ghost katanas riding it
            const R = ef.radius, a0 = ef.angle - Math.PI / 2, a1 = a0 + Math.PI * easeOut(Math.min(1, el / 0.12));
            if (!ef.burstDone) {
                ef.burstDone = true;
                burst(ef.x, ef.y, ef.angle, Math.PI, 24, { kind: 'spark', color: '#e0f7fa', size: 1.8, life: 0.35, speed: [300, 650], drag: 4 });
                addShake(2);
            }
            ctx.save();
            ctx.globalCompositeOperation = 'lighter';
            const g = ctx.createRadialGradient(ef.x, ef.y, R * 0.4, ef.x, ef.y, R);
            g.addColorStop(0, 'rgba(0, 229, 255, 0)'); g.addColorStop(0.8, `rgba(132, 255, 255, ${0.45 * k})`); g.addColorStop(1, `rgba(255, 255, 255, ${0.8 * k})`);
            ctx.fillStyle = g;
            drawCrescent(ef.x, ef.y, R * (0.85 + 0.15 * p), a0, a1, 60 * k + 6); ctx.fill();
            ctx.fillStyle = `rgba(132, 255, 255, ${0.25 * k})`;
            drawCrescent(ef.x, ef.y, R * 0.62, a0, a1, 24 * k + 3); ctx.fill();
            for (const off of [-0.7, 0, 0.7]) { // ghost katanas riding the gust
                const a = ef.angle + off;
                if (a > a1) continue;
                ctx.save();
                ctx.translate(ef.x + Math.cos(a) * R * 0.72, ef.y + Math.sin(a) * R * 0.72); ctx.rotate(a + Math.PI / 2); ctx.translate(-60, 0);
                drawKatanaGhost('#e0f7fa', 0.8 * k);
                ctx.restore();
            }
            ctx.restore();
            return true;
        }

        case 'eclipse_wave': { // Cleric Twilight Repulse: a half-gold, half-violet ring and an eclipse at the cleric
            const R = ef.radius * easeOut(Math.min(1, p * 1.6)), rot = p * 2;
            if (!ef.burstDone) {
                ef.burstDone = true;
                burst(ef.x, ef.y, 0, Math.PI * 2, 10, { kind: 'dot', color: '#ffe082', size: 2, life: 0.45, speed: [200, 380], drag: 3 });
                burst(ef.x, ef.y, 0, Math.PI * 2, 10, { kind: 'dot', color: '#ce93d8', size: 2, life: 0.45, speed: [200, 380], drag: 3 });
                addShake(2);
            }
            ctx.save();
            ctx.translate(ef.x, ef.y);
            ctx.globalCompositeOperation = 'lighter';
            const g = ctx.createRadialGradient(0, 0, R * 0.6, 0, 0, Math.max(1, R));
            g.addColorStop(0, 'rgba(255, 213, 79, 0)'); g.addColorStop(1, `rgba(206, 147, 216, ${0.25 * k})`);
            ctx.fillStyle = g; ctx.beginPath(); ctx.arc(0, 0, Math.max(1, R), 0, Math.PI * 2); ctx.fill();
            ctx.lineWidth = 10 * k + 1;
            ctx.strokeStyle = `rgba(255, 202, 40, ${0.85 * k})`; ctx.beginPath(); ctx.arc(0, 0, Math.max(1, R), rot, rot + Math.PI); ctx.stroke();
            ctx.strokeStyle = `rgba(171, 71, 188, ${0.85 * k})`; ctx.beginPath(); ctx.arc(0, 0, Math.max(1, R), rot + Math.PI, rot + Math.PI * 2); ctx.stroke();
            ctx.strokeStyle = `rgba(255, 255, 255, ${0.6 * k})`; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.arc(0, 0, Math.max(1, R * 0.93), 0, Math.PI * 2); ctx.stroke();
            // Eclipse: the moon slides across the sun, leaving a burning corona
            const sun = ctx.createRadialGradient(0, 0, 0, 0, 0, 34);
            sun.addColorStop(0, `rgba(255, 248, 225, ${k})`); sun.addColorStop(0.5, `rgba(255, 202, 40, ${0.7 * k})`); sun.addColorStop(1, 'rgba(255, 143, 0, 0)');
            ctx.fillStyle = sun; ctx.beginPath(); ctx.arc(0, 0, 34, 0, Math.PI * 2); ctx.fill();
            ctx.globalCompositeOperation = 'source-over';
            ctx.globalAlpha = k;
            ctx.fillStyle = '#1a0b2e'; ctx.beginPath(); ctx.arc(-14 + 14 * easeOut(Math.min(1, p * 2.5)), 0, 15, 0, Math.PI * 2); ctx.fill();
            ctx.strokeStyle = '#ce93d8'; ctx.lineWidth = 1.2; ctx.stroke();
            ctx.restore();
            return true;
        }

        case 'spirit_paw': { // Druid Thistle-Grip Claws: a giant ghostly paw rakes the cone, leaving three furrows
            const a0 = ef.angle - 1.05, q = easeOut(Math.min(1, el / 0.18)), pa = lerp(a0, ef.angle + 1.05, q);
            ctx.save();
            ctx.globalCompositeOperation = 'lighter';
            for (const r of [96, 120, 144]) { // furrows torn behind the paw
                ctx.fillStyle = `rgba(178, 255, 89, ${0.55 * k})`;
                drawCrescent(ef.x, ef.y, r + 4, a0, pa, 8 * k + 1); ctx.fill();
                ctx.fillStyle = `rgba(240, 255, 220, ${0.8 * k})`;
                drawCrescent(ef.x, ef.y, r + 1, a0, pa, 2.5 * k + 0.5); ctx.fill();
            }
            ctx.translate(ef.x + Math.cos(pa) * 118, ef.y + Math.sin(pa) * 118); ctx.rotate(pa);
            ctx.globalAlpha = Math.min(1, k * 1.5);
            const fill = 'rgba(178, 255, 89, 0.22)', line = 'rgba(204, 255, 144, 0.9)';
            const pad = (x, y, rx, ry) => { ctx.beginPath(); ctx.ellipse(x, y, rx, ry, 0, 0, Math.PI * 2); ctx.fillStyle = fill; ctx.fill(); ctx.strokeStyle = line; ctx.lineWidth = 1.5; ctx.stroke(); };
            pad(-6, 0, 20, 26); // palm
            for (const ty of [-27, -9, 9, 27]) {
                pad(20, ty, 8, 7); // toes
                ctx.beginPath(); ctx.moveTo(26, ty - 4); ctx.quadraticCurveTo(40, ty - 2, 44, ty + 2); ctx.quadraticCurveTo(36, ty + 1, 26, ty + 3); ctx.closePath();
                ctx.fillStyle = 'rgba(240, 255, 220, 0.9)'; ctx.fill(); // claws
            }
            ctx.restore();
            return true;
        }

        case 'rune_chain': { // World-Breaker Magnetic Pulse: a chain of runes reels the enemy to the hammer
            const q = easeOut(Math.min(1, el / 0.2));
            const ex = lerp(ef.x1, ef.x2, q), ey = lerp(ef.y1, ef.y2, q);
            drawStreak(ef.x1, ef.y1, ex, ey, 10 * k, '#ffd54f', k);
            const dx = ex - ef.x2, dy = ey - ef.y2, len = Math.hypot(dx, dy);
            if (len < 10) return true;
            ctx.save();
            ctx.translate(ef.x2, ef.y2); ctx.rotate(Math.atan2(dy, dx));
            ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = k;
            let i = 0;
            for (let d = 8; d < len; d += 10, i++) {
                ctx.strokeStyle = '#ffe082'; ctx.lineWidth = 2;
                if (i % 2 === 0) { ctx.beginPath(); ctx.ellipse(d, 0, 6, 3.5, 0, 0, Math.PI * 2); ctx.stroke(); }
                else { ctx.beginPath(); ctx.moveTo(d - 5, 0); ctx.lineTo(d + 5, 0); ctx.stroke(); }
            }
            ctx.restore();
            return true;
        }
    }
    return false;
}

// ==========================================
// Emitters (game time)
// ==========================================

function updateRmbEmitters(dt) {
    for (const p of projectiles) {
        if (p.isEnemy || p.shape !== 'storm_arrow') continue;
        p.trail = p.trail || [];
        p.trail.push([p.x, p.y]);
        if (p.trail.length > 8) p.trail.shift();
        emit(30, dt, () => spawnParticle({ kind: 'spark', color: '#80d8ff', x: p.x, y: p.y, vx: jitter(160), vy: jitter(160), size: 1.3, life: 0.15, drag: 4, grow: 0, spin: 0, rot: 0 }));
        if (p.hitList && p.hitList.length > (p.seenHits || 0)) { // chain sparks jump off each enemy it pierces
            for (const e of p.hitList.slice(p.seenHits || 0)) {
                for (let j = 0; j < 2; j++) { const a = Math.random() * Math.PI * 2, r = 40 + Math.random() * 30; effects.push({ type: 'lightning', x1: e.x, y1: e.y, x2: e.x + Math.cos(a) * r, y2: e.y + Math.sin(a) * r, color: '#80d8ff', life: 0.18, maxLife: 0.18 }); }
            }
            p.seenHits = p.hitList.length;
        }
    }
    for (const e of enemies) if (e.netTimer > 0) e.netTimer -= dt;
}
