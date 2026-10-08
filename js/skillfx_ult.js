// ==========================================
// skillfx_ult.js - Ultimate (R) abilities
// ==========================================
// Hooks: drawUltProjectile / drawUltGround / drawUltEffect / updateUltEmitters (skillfx.js),
// drawUltOverlay (main.js, after particles: things in the air above everything),
// drawUltAuraBack / drawUltAuraFront / ultFacing / drawDeathMarkSigil (main.js player and enemy drawing),
// drawHammerStorm (paladin.js). Timed visuals use the effect's elapsed game time (maxLife - life).

const ultElapsed = (ef) => ef.maxLife - ef.life;

// ==========================================
// Dragonknight: Dragon Breath
// ==========================================

const BREATH = {
    fire:    { core: '255, 245, 157', mid: '255, 112, 67',  edge: '183, 28, 28',  line: '#ff8a65', ember: '#ffab40' },
    frost:   { core: '255, 255, 255', mid: '129, 212, 250', edge: '13, 71, 161',  line: '#81d4fa', ember: '#e1f5fe' },
    shatter: { core: '255, 255, 255', mid: '255, 236, 179', edge: '255, 111, 0',  line: '#fff59d', ember: '#eceff1' }
};

// A spectral dragon head rearing over the knight, jaws open while it breathes
function drawDragonHead(ef) {
    const el = ultElapsed(ef), c = BREATH[ef.breath];
    const snap = ef.snap ? Math.sin(Math.min(1, el / 0.22) * Math.PI) : 0; // Wyrm Strike: lunge forward and bite
    const fade = ef.snap ? Math.min(1, el / 0.05, ef.life / 0.12) : Math.min(1, el / 0.15, ef.life / 0.25);
    const open = ef.snap ? snap : Math.min(1, el / 0.12) * Math.min(1, ef.life / 0.3);
    const col = c.line;
    ctx.save();
    ctx.translate(player.x, player.y - 6); ctx.rotate(ef.angle); ctx.scale(1.2, 1.2); ctx.translate(snap * 34, 0);
    ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = fade;
    ctx.lineJoin = 'round';
    const fill = withAlpha(col, 0.2), stroke = withAlpha(col, 0.85);
    const shape = (draw) => { ctx.beginPath(); draw(); ctx.fillStyle = fill; ctx.fill(); ctx.strokeStyle = stroke; ctx.lineWidth = 1.5; ctx.stroke(); };
    shape(() => { ctx.moveTo(-40, -13); ctx.quadraticCurveTo(-10, -18, 10, -13); ctx.lineTo(10, 13); ctx.quadraticCurveTo(-10, 18, -40, 13); ctx.closePath(); }); // neck
    for (const x of [-34, -22, -10]) shape(() => { ctx.moveTo(x, -3.5); ctx.lineTo(x - 13, 0); ctx.lineTo(x, 3.5); ctx.closePath(); }); // neck spines
    for (const s of [-1, 1]) shape(() => { ctx.moveTo(6, s * 9); ctx.quadraticCurveTo(-10, s * 30, -36, s * 31); ctx.quadraticCurveTo(-14, s * 22, 0, s * 5); ctx.closePath(); }); // swept-back horns
    shape(() => ctx.ellipse(12, 0, 20, 15, 0, 0, Math.PI * 2)); // skull
    // Jaws, seen from above: the lower jaw stays put underneath while the upper jaw lifts toward the camera,
    // so the snout foreshortens and uncovers the lower teeth and the glowing mouth
    shape(() => { ctx.moveTo(18, -9); ctx.quadraticCurveTo(36, -8, 47, -3); ctx.lineTo(49, 0); ctx.lineTo(47, 3); ctx.quadraticCurveTo(36, 8, 18, 9); ctx.closePath(); }); // lower jaw
    const tip = 48 - 17 * open, w = 12 * (1 + 0.15 * open);
    if (open > 0.05) {
        const mg = ctx.createRadialGradient(tip + 4, 0, 0, tip + 4, 0, 14);
        mg.addColorStop(0, `rgba(${c.core}, ${0.9 * open})`); mg.addColorStop(1, `rgba(${c.mid}, 0)`);
        ctx.fillStyle = mg; ctx.beginPath(); ctx.ellipse(tip + 6, 0, 12, 5.5, 0, 0, Math.PI * 2); ctx.fill(); // the open mouth
        ctx.fillStyle = `rgba(255, 255, 255, ${0.85 * open})`;
        for (const [tx, ty] of [[38, 5.5], [44, 3.5], [38, -5.5], [44, -3.5]]) { // lower teeth along the jaw's rim, pointing up
            ctx.beginPath(); ctx.moveTo(tx - 1.6, ty); ctx.lineTo(tx + 1.6, ty); ctx.lineTo(tx, ty * 0.55); ctx.closePath(); ctx.fill();
        }
    }
    shape(() => { ctx.moveTo(18, -w); ctx.quadraticCurveTo(tip - 14, -w * 0.85, tip, -3.5); ctx.lineTo(tip + 2, 0); ctx.lineTo(tip, 3.5); ctx.quadraticCurveTo(tip - 14, w * 0.85, 18, w); ctx.closePath(); }); // upper jaw
    ctx.fillStyle = `rgba(255, 255, 255, ${0.6 + 0.4 * open})`;
    for (const s of [-1, 1]) { ctx.beginPath(); ctx.moveTo(tip - 3, s * 2.5); ctx.lineTo(tip + 4 * open + 1, s * 3.2); ctx.lineTo(tip - 2, s * 4.8); ctx.closePath(); ctx.fill(); } // fangs hanging off the snout
    ctx.fillStyle = `rgba(${c.core}, 0.9)`;
    for (const s of [-1, 1]) { ctx.beginPath(); ctx.ellipse(tip - 6, s * 3, 1.6, 0.9, 0, 0, Math.PI * 2); ctx.fill(); } // nostrils
    ctx.fillStyle = `rgba(${c.core}, 0.95)`;
    for (const s of [-1, 1]) { ctx.beginPath(); ctx.ellipse(16, s * 8, 3.5, 1.6, s * 0.4, 0, Math.PI * 2); ctx.fill(); } // eyes
    if (!ef.snap && open > 0.1) { // a continuous jet roaring out of the jaws (layered: wide outer flame, hot core)
        const L = 400 * Math.min(1, el / 0.2);
        const layers = [[90, c.edge, 0.3], [60, c.mid, 0.4], [26, c.core, 0.6]];
        layers.forEach(([w1, rgb, al], li) => {
            const g = ctx.createLinearGradient(48, 0, 48 + L, 0);
            g.addColorStop(0, `rgba(${rgb}, ${al * open})`); g.addColorStop(0.6, `rgba(${rgb}, ${al * 0.6 * open})`); g.addColorStop(1, `rgba(${rgb}, 0)`);
            ctx.fillStyle = g;
            ctx.beginPath();
            for (let t = 0; t <= 1.001; t += 0.1) ctx.lineTo(48 + L * t, -lerp(5, w1, Math.sqrt(t)) * (1 + 0.18 * Math.sin(fxTime * 31 + t * 13 + li)));
            for (let t = 1; t >= -0.001; t -= 0.1) ctx.lineTo(48 + L * t, lerp(5, w1, Math.sqrt(t)) * (1 + 0.18 * Math.sin(fxTime * 27 + t * 11 + li * 2)));
            ctx.closePath(); ctx.fill();
        });
    }
    if (open > 0.1) { // fire welling in the throat
        const g = ctx.createRadialGradient(56, 0, 0, 56, 0, 30);
        g.addColorStop(0, `rgba(${c.core}, ${0.9 * open})`); g.addColorStop(0.5, `rgba(${c.mid}, ${0.5 * open})`); g.addColorStop(1, `rgba(${c.edge}, 0)`);
        ctx.fillStyle = g; ctx.beginPath(); ctx.arc(56, 0, 30, 0, Math.PI * 2); ctx.fill();
    }
    ctx.restore();
}

// One rolling puff of the breath stream; overlapping puffs blend into a continuous jet
function drawBreathPuff(p) {
    const c = BREATH[p.breath] || BREATH.fire, age = 0.6 - p.life;
    const R = p.radius * (0.9 + age * 3), a = Math.min(1, p.life / 0.25) * 0.6;
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    const g = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, R);
    g.addColorStop(0, `rgba(${c.core}, ${a * (1 - age)})`); g.addColorStop(0.4, `rgba(${c.mid}, ${a * 0.8})`); g.addColorStop(1, `rgba(${c.edge}, 0)`);
    ctx.fillStyle = g; ctx.beginPath(); ctx.arc(p.x, p.y, R, 0, Math.PI * 2); ctx.fill();
    ctx.restore();
}

// ==========================================
// Spellweaver: Meteor
// ==========================================

// The meteor comes in from the upper right, accelerating
function meteorPos(ef) {
    const q = clamp01(ultElapsed(ef) / ef.maxLife), e = q * q;
    return { x: ef.x + 380 * (1 - e), y: ef.y - 720 * (1 - e), q };
}

function drawMeteorRock(ef) {
    const { x, y, q } = meteorPos(ef);
    if (!ef.rock) ef.rock = Array.from({ length: 9 }, (_, i) => ({ a: i * Math.PI * 2 / 9, r: 0.75 + Math.random() * 0.35 }));
    const size = 22 + 14 * q, back = Math.atan2(-720, 380); // direction the meteor came from
    ctx.save();
    ctx.translate(x, y);
    ctx.globalCompositeOperation = 'lighter';
    ctx.rotate(back);
    const len = 150 + 120 * q;
    const g = ctx.createLinearGradient(0, 0, len, 0);
    g.addColorStop(0, 'rgba(255, 245, 157, 0.95)'); g.addColorStop(0.25, 'rgba(255, 112, 67, 0.7)'); g.addColorStop(1, 'rgba(183, 28, 28, 0)');
    ctx.fillStyle = g;
    ctx.beginPath(); ctx.moveTo(0, -size); ctx.quadraticCurveTo(len * 0.5, -size * 0.6, len, 0); ctx.quadraticCurveTo(len * 0.5, size * 0.6, 0, size); ctx.arc(0, 0, size, Math.PI / 2, -Math.PI / 2); ctx.fill();
    ctx.rotate(-back);
    const halo = ctx.createRadialGradient(0, 0, size * 0.5, 0, 0, size * 1.8);
    halo.addColorStop(0, 'rgba(255, 171, 64, 0.7)'); halo.addColorStop(1, 'rgba(255, 87, 34, 0)');
    ctx.fillStyle = halo; ctx.beginPath(); ctx.arc(0, 0, size * 1.8, 0, Math.PI * 2); ctx.fill();
    ctx.globalCompositeOperation = 'source-over';
    ctx.rotate(fxTime * 3);
    ctx.beginPath();
    ef.rock.forEach((pt, i) => { const px = Math.cos(pt.a) * size * pt.r, py = Math.sin(pt.a) * size * pt.r; i ? ctx.lineTo(px, py) : ctx.moveTo(px, py); });
    ctx.closePath();
    ctx.fillStyle = '#3e2723'; ctx.fill();
    ctx.strokeStyle = '#ff9100'; ctx.lineWidth = 2.5; ctx.stroke();
    ctx.strokeStyle = 'rgba(255, 213, 79, 0.9)'; ctx.lineWidth = 1.5; // molten seams
    ctx.beginPath(); ctx.moveTo(-size * 0.5, -size * 0.1); ctx.lineTo(0, size * 0.15); ctx.lineTo(size * 0.4, -size * 0.3); ctx.moveTo(0, size * 0.15); ctx.lineTo(-size * 0.1, size * 0.55); ctx.stroke();
    ctx.restore();
}

// ==========================================
// Ranger: Volley (arrow rain)
// ==========================================

const RAIN_FALL = 0.14; // seconds an arrow is visible falling before it lands

// Called from the Volley's per-arrow timer at the moment of impact
function arrowImpactFx(x, y, heavy) {
    burst(x, y, -Math.PI / 2, 2.4, heavy ? 6 : 3, { kind: 'debris', color: '#795548', size: heavy ? 3 : 2, life: 0.35, speed: [60, 160], drag: 6 });
    burst(x, y, 0, Math.PI * 2, 3, { kind: 'smoke', color: '#8d8478', size: 3, grow: heavy ? 26 : 14, life: 0.35, speed: [20, 60], drag: 3 });
    if (heavy) {
        burst(x, y, 0, Math.PI * 2, 6, { kind: 'spark', color: '#fff3e0', size: 1.8, life: 0.2, speed: [120, 260], drag: 6 });
        spawnParticle({ kind: 'ring', color: '#cfd8dc', x, y, vx: 0, vy: 0, size: 4, grow: 160, life: 0.18, drag: 0, spin: 0, rot: 0 });
        addShake(1);
    }
}

// An arrow seen from above and slightly behind: shaft, head and fletching
function drawArrowShape(x, y, ang, len, heavy, alpha) {
    ctx.save();
    ctx.translate(x, y); ctx.rotate(ang); ctx.globalAlpha = alpha;
    ctx.strokeStyle = heavy ? '#5d4037' : '#8d6e63'; ctx.lineWidth = heavy ? 3 : 2; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(-len, 0); ctx.lineTo(0, 0); ctx.stroke();
    ctx.fillStyle = heavy ? '#90a4ae' : '#cfd8dc';
    ctx.beginPath(); ctx.moveTo(heavy ? 7 : 5, 0); ctx.lineTo(-2, heavy ? -3.5 : -2.5); ctx.lineTo(-2, heavy ? 3.5 : 2.5); ctx.closePath(); ctx.fill();
    ctx.fillStyle = '#c5e1a5';
    for (const s of [-1, 1]) { ctx.beginPath(); ctx.moveTo(-len, 0); ctx.lineTo(-len - 4, s * 3.5); ctx.lineTo(-len + 5, 0); ctx.closePath(); ctx.fill(); }
    ctx.restore();
}

// ==========================================
// Cleric: Ascension wings, halo and the reaper
// ==========================================

function clericForm() {
    if (selectedClassId !== 'cleric') return null;
    if (buffs.avatarOfRenewal > 0) return { kind: 'holy', a: Math.min(1, buffs.avatarOfRenewal / 0.5, (8 - buffs.avatarOfRenewal) / 0.3) };
    if (buffs.aspectOfReaper > 0) return { kind: 'shadow', a: Math.min(1, buffs.aspectOfReaper / 0.5, (8 - buffs.aspectOfReaper) / 0.3) };
    if (buffs.ascension > 0) return { kind: 'base', a: Math.min(1, buffs.ascension / 0.5, (6 - buffs.ascension) / 0.3) };
    return null;
}

// One wing in the hero's local frame (facing +x): s = side, sweeping out sideways and back from the shoulder
function drawWing(s, span, kind) {
    const tipX = -18, tipY = s * span, rootX = -12, rootY = s * 8, n = 5;
    const edge = [];
    for (let i = 0; i <= n; i++) { const t = i / n; edge.push([lerp(tipX, rootX, t) - 14 * Math.sin(t * Math.PI), lerp(tipY, rootY, t)]); }
    ctx.beginPath();
    ctx.moveTo(-2, s * 7);
    ctx.quadraticCurveTo(-2, s * span * 0.7, tipX, tipY); // leading edge
    for (let i = 1; i <= n; i++) {
        const [x0, y0] = edge[i - 1], [x1, y1] = edge[i], mx = (x0 + x1) / 2 - 9, my = (y0 + y1) / 2;
        if (kind === 'shadow') { ctx.lineTo(mx - 6 - (i % 2) * 6, my); ctx.lineTo(x1, y1); } // tattered
        else ctx.quadraticCurveTo(mx, my, x1, y1); // rounded feather tips
    }
    ctx.closePath();
    if (kind === 'shadow') {
        ctx.fillStyle = 'rgba(26, 11, 46, 0.85)'; ctx.fill();
        ctx.strokeStyle = 'rgba(206, 147, 216, 0.9)'; ctx.lineWidth = 1.2; ctx.stroke();
    } else {
        const g = ctx.createRadialGradient(-4, s * 8, 0, -4, s * 8, span * 1.2);
        g.addColorStop(0, 'rgba(255, 255, 255, 0.85)'); g.addColorStop(0.6, 'rgba(255, 224, 130, 0.55)'); g.addColorStop(1, 'rgba(255, 213, 79, 0.1)');
        ctx.fillStyle = g; ctx.fill();
        ctx.strokeStyle = 'rgba(255, 248, 225, 0.9)'; ctx.lineWidth = 1; ctx.stroke();
    }
    ctx.strokeStyle = kind === 'shadow' ? 'rgba(149, 117, 205, 0.6)' : 'rgba(255, 236, 179, 0.7)'; ctx.lineWidth = 0.8;
    ctx.beginPath();
    for (let i = 1; i < n; i++) { ctx.moveTo(-6, s * 9); ctx.lineTo(edge[i][0] + 4, edge[i][1] * 0.92); } // feather lines
    ctx.stroke();
}

// The Aspect of the Reaper: a hooded spectre with a scythe hovering at the cleric's back
function drawReaperSpectre() {
    const bob = Math.sin(fxTime * 3) * 2;
    ctx.save();
    ctx.translate(-30, bob);
    ctx.fillStyle = 'rgba(56, 22, 82, 0.8)'; ctx.strokeStyle = 'rgba(206, 147, 216, 0.95)'; ctx.lineWidth = 1.5;
    ctx.shadowBlur = 10; ctx.shadowColor = '#9c27b0';
    ctx.beginPath(); ctx.moveTo(2, -13); ctx.quadraticCurveTo(-16, -16, -34 + Math.sin(fxTime * 5) * 3, 0); ctx.quadraticCurveTo(-16, 16, 2, 13); ctx.closePath(); ctx.fill(); ctx.stroke(); // wispy robe
    ctx.beginPath(); ctx.arc(4, 0, 9, 0, Math.PI * 2); ctx.fill(); ctx.stroke(); // hood
    ctx.fillStyle = '#ea80fc'; ctx.shadowBlur = 8; ctx.shadowColor = '#ea80fc';
    for (const s of [-1, 1]) { ctx.beginPath(); ctx.arc(8, s * 3, 1.4, 0, Math.PI * 2); ctx.fill(); }
    ctx.shadowBlur = 0;
    ctx.strokeStyle = '#4e342e'; ctx.lineWidth = 2.2; ctx.lineCap = 'round'; // scythe
    ctx.beginPath(); ctx.moveTo(-14, 18); ctx.lineTo(16, -20); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(16, -20); ctx.quadraticCurveTo(30, -42, 0, -40); ctx.quadraticCurveTo(20, -36, 14, -22); ctx.closePath();
    ctx.fillStyle = 'rgba(207, 216, 220, 0.85)'; ctx.fill();
    ctx.strokeStyle = 'rgba(206, 147, 216, 0.9)'; ctx.lineWidth = 1; ctx.stroke();
    ctx.restore();
}

// Drawn under the hero sprite: Ascension wings / reaper, the Overclock heat haze
function drawUltAuraBack(facing) {
    const f = clericForm();
    if (f) {
        ctx.save();
        ctx.translate(player.x, player.y); ctx.rotate(facing);
        ctx.globalAlpha = f.a;
        const flap = 0.9 + 0.1 * Math.sin(fxTime * 4);
        if (f.kind === 'shadow') drawReaperSpectre();
        if (f.kind !== 'shadow') ctx.globalCompositeOperation = 'lighter';
        const span = (f.kind === 'holy' ? 50 : f.kind === 'shadow' ? 46 : 30) * flap;
        if (f.kind === 'base') ctx.globalAlpha = f.a * 0.6;
        for (const s of [-1, 1]) drawWing(s, span, f.kind);
        ctx.restore();
    }
    if (selectedClassId === 'machinist' && buffs.overclockTimer > 0) {
        ctx.save();
        ctx.globalCompositeOperation = 'lighter';
        const pulse = 0.5 + 0.5 * Math.sin(fxTime * 10);
        const g = ctx.createRadialGradient(player.x, player.y, 10, player.x, player.y, 46);
        g.addColorStop(0, 'rgba(255, 111, 0, 0)'); g.addColorStop(0.7, `rgba(255, 111, 0, ${0.12 + 0.1 * pulse})`); g.addColorStop(1, 'rgba(255, 61, 0, 0)');
        ctx.fillStyle = g; ctx.beginPath(); ctx.arc(player.x, player.y, 46, 0, Math.PI * 2); ctx.fill();
        ctx.restore();
    }
}

// Drawn over the hero sprite: halos and the Overclock gauge
function drawUltAuraFront(facing) {
    const f = clericForm();
    if (f) {
        ctx.save();
        ctx.translate(player.x + Math.cos(facing) * 2, player.y + Math.sin(facing) * 2);
        ctx.globalAlpha = f.a;
        ctx.globalCompositeOperation = 'lighter';
        ctx.lineWidth = 2.5;
        if (f.kind === 'shadow') { ctx.strokeStyle = '#ce93d8'; ctx.setLineDash([4, 3]); ctx.lineDashOffset = -fxTime * 20; }
        else { ctx.strokeStyle = '#ffe082'; ctx.shadowBlur = 10; ctx.shadowColor = '#ffd54f'; }
        ctx.beginPath(); ctx.arc(0, 0, 11 + Math.sin(fxTime * 3), 0, Math.PI * 2); ctx.stroke();
        ctx.restore();
    }
    if (selectedClassId === 'machinist' && buffs.overclockTimer > 0) { // gauge ring: lit segments count down the buff
        const frac = clamp01(buffs.overclockTimer / (buffs.overclockMax || 6)), n = 16;
        ctx.save();
        ctx.translate(player.x, player.y); ctx.rotate(fxTime * 1.5);
        ctx.globalCompositeOperation = 'lighter';
        ctx.lineWidth = 3;
        for (let i = 0; i < n; i++) {
            const lit = i < Math.ceil(frac * n), flick = lit && Math.random() < 0.05 ? 0.3 : 1;
            ctx.strokeStyle = lit ? `rgba(255, ${140 - i * 6}, 0, ${0.85 * flick})` : 'rgba(255, 112, 67, 0.15)';
            ctx.beginPath(); ctx.arc(0, 0, 30, i * Math.PI * 2 / n + 0.05, (i + 1) * Math.PI * 2 / n - 0.05); ctx.stroke();
        }
        ctx.restore();
    }
}

// ==========================================
// Swordsaint: Blade Whirlwind spin
// ==========================================

// While the whirlwind spins, the swordsaint (and their katana) spin with it
function ultFacing() {
    for (const ef of effects) if (ef.type === 'katana_tornado') return ef.startAngle + ultElapsed(ef) * 16;
    return null;
}

function drawKatanaTornado(ef) {
    const el = ultElapsed(ef), q = clamp01(el / ef.maxLife), k = 1 - q, R = ef.radius;
    const r = R * (0.2 + 0.8 * easeOut(q));
    ctx.save();
    ctx.translate(player.x, player.y);
    ctx.globalCompositeOperation = 'lighter';
    for (let j = 0; j < 3; j++) { // wind arcs
        const a0 = el * 12 + j * Math.PI * 2 / 3;
        ctx.strokeStyle = `rgba(132, 255, 255, ${0.45 * k})`; ctx.lineWidth = 6 * k + 1;
        ctx.beginPath(); ctx.arc(0, 0, r * (0.55 + j * 0.2), a0, a0 + 1.6); ctx.stroke();
    }
    if (ef.vortex) { // inward-curling wind streams
        ctx.strokeStyle = `rgba(224, 247, 250, ${0.5 * k})`; ctx.lineWidth = 1.5;
        for (let i = 0; i < 8; i++) {
            const a = i * Math.PI / 4 - el * 6;
            ctx.beginPath();
            for (let t = 0; t <= 1; t += 0.1) { const rr = R * 1.1 * (1 - t * 0.8), aa = a + t * 1.8; ctx.lineTo(Math.cos(aa) * rr, Math.sin(aa) * rr); }
            ctx.stroke();
        }
    }
    for (let i = 0; i < 8; i++) { // ghost katanas flung out in a spiral, each trailed by two fainter copies
        for (let g = 2; g >= 0; g--) {
            const a = i * Math.PI / 4 + el * 14 - g * 0.12;
            ctx.save();
            ctx.rotate(a); ctx.translate(r, 0); ctx.rotate(Math.PI / 2); ctx.scale(1.1, 1.6); ctx.translate(-60, 0);
            drawKatanaGhost(g ? '#00e5ff' : '#e0f7fa', (g ? 0.25 : 0.9) * k);
            ctx.restore();
        }
    }
    ctx.restore();
}

// ==========================================
// Nightblade: Death Mark
// ==========================================

// The weak-point sigil on a marked enemy (brighter and larger while Death Mark is active)
function drawDeathMarkSigil(e) {
    const hunt = buffs.deathMarkActive > 0, pulse = 0.5 + 0.5 * Math.sin(fxTime * 6 + e.x);
    const R = e.size / 2 + (hunt ? 18 : 14), a = e.markAngle;
    ctx.save();
    ctx.translate(e.x, e.y);
    ctx.globalCompositeOperation = 'lighter';
    ctx.strokeStyle = `rgba(206, 147, 216, ${0.35 + 0.25 * pulse})`; ctx.lineWidth = hunt ? 3 : 2;
    ctx.beginPath(); ctx.arc(0, 0, R, a - 0.45, a + 0.45); ctx.stroke(); // weak arc
    ctx.rotate(a); ctx.translate(R + 2, 0);
    const s = hunt ? 1.35 : 1;
    ctx.fillStyle = `rgba(234, 128, 252, ${0.6 + 0.4 * pulse})`;
    ctx.beginPath(); ctx.moveTo(-7 * s, 0); ctx.lineTo(0, -5 * s); ctx.lineTo(7 * s, 0); ctx.lineTo(0, 5 * s); ctx.closePath(); ctx.fill(); // the eye
    ctx.fillStyle = '#1a0b2e'; ctx.beginPath(); ctx.ellipse(0, 0, 1.5 * s, 3.2 * s, 0, 0, Math.PI * 2); ctx.fill(); // slit pupil
    if (hunt) { // chevron pointing in at the weak spot
        ctx.strokeStyle = `rgba(234, 128, 252, ${0.8})`; ctx.lineWidth = 2;
        const off = 12 + 3 * pulse;
        ctx.beginPath(); ctx.moveTo(off + 6, -5); ctx.lineTo(off, 0); ctx.lineTo(off + 6, 5); ctx.stroke();
    }
    ctx.restore();
}

function drawCloneStrike(ef) {
    const el = ultElapsed(ef), q = Math.min(1, el / 0.08), e = easeOut(q);
    const x = lerp(ef.x0, ef.x1, e), y = lerp(ef.y0, ef.y1, e);
    if (!ef.pose) { ef.pose = playerPose(ef.angle); ef.pose.live = false; }
    if (!ef.fadeDone && el > 0.1) { // the clone dissolves into smoke once it has struck
        ef.fadeDone = true;
        burst(ef.x1, ef.y1, 0, Math.PI * 2, 6, { kind: 'smoke', color: '#311b92', size: 5, grow: 26, life: 0.5, speed: [20, 70], drag: 3 });
    }
    drawStreak(ef.x0, ef.y0, x, y, 12 * (1 - el / ef.maxLife), '#9c27b0', 1 - el / ef.maxLife);
    const a = el < 0.1 ? 0.9 : 0.9 * Math.max(0, 1 - (el - 0.1) / 0.2);
    if (a > 0) stampTinted(x, y, ef.angle, ef.pose, '#7c4dff', a, true);
}

// ==========================================
// Druid: Aspect of the Wild
// ==========================================

// Leaving Wild Form: the wolf crumbles into leaves (call before the form ends, so the ghost is still a wolf)
function wildRevertFx() {
    spawnDashGhost('#8bc34a', false, 0.6, Math.atan2(mouseY - player.y, mouseX - player.x));
    burst(player.x, player.y, -Math.PI / 2, Math.PI * 2, 16, { kind: 'leaf', color: '#7cb342', size: 7, life: 0.9, speed: [30, 120], drag: 2 });
    burst(player.x, player.y, 0, Math.PI * 2, 6, { kind: 'leaf', color: '#a1887f', size: 6, life: 0.8, speed: [40, 110], drag: 2 });
}

// Phase one: vines wrap the druid into a cocoon (drawn over the hero)
function drawVineCocoon(ef) {
    const el = ultElapsed(ef);
    if (el > 0.24) return;
    const q = el / 0.24, R = 40 - 16 * easeOut(q);
    ctx.save();
    ctx.translate(player.x, player.y);
    ctx.lineCap = 'round';
    for (let i = 0; i < 6; i++) {
        const a0 = i * Math.PI / 3 + q * 2;
        ctx.strokeStyle = i % 2 ? '#558b2f' : '#6d4c41'; ctx.lineWidth = 5;
        ctx.beginPath();
        for (let t = 0; t <= q; t += 0.05) { const aa = a0 + t * 3.5, rr = R * (1.3 - t * 0.3); ctx.lineTo(Math.cos(aa) * rr, Math.sin(aa) * rr); }
        ctx.stroke();
        const aa = a0 + q * 3.5, rr = R * (1.3 - q * 0.3);
        sprLeaf(ctx, Math.cos(aa) * rr, Math.sin(aa) * rr, aa + 1.5, 9, '#8bc34a');
    }
    const g = ctx.createRadialGradient(0, 0, 0, 0, 0, R);
    g.addColorStop(0, `rgba(204, 255, 144, ${0.6 * q})`); g.addColorStop(1, 'rgba(85, 139, 47, 0)');
    ctx.globalCompositeOperation = 'lighter';
    ctx.fillStyle = g; ctx.beginPath(); ctx.arc(0, 0, R, 0, Math.PI * 2); ctx.fill();
    ctx.restore();
}

// ==========================================
// Paladin: Hammer of the Gods storm (drawn under the colossal mace)
// ==========================================

function drawHammerStorm(h) {
    ctx.save();
    ctx.translate(h.x, h.y);
    ctx.globalCompositeOperation = 'lighter';
    const g = ctx.createRadialGradient(0, 0, 0, 0, 0, 110);
    g.addColorStop(0, 'rgba(255, 213, 79, 0.35)'); g.addColorStop(1, 'rgba(255, 213, 79, 0)');
    ctx.fillStyle = g; ctx.beginPath(); ctx.arc(0, 0, 110, 0, Math.PI * 2); ctx.fill();
    for (let i = 0; i < 5; i++) { // golden gale spiralling in
        const r = 70 + i * 36, a0 = -h.spin * (0.5 - i * 0.05) + i * 1.3;
        ctx.strokeStyle = `rgba(255, 224, 130, ${0.42 - i * 0.06})`; ctx.lineWidth = 4 - i * 0.5;
        ctx.beginPath(); ctx.arc(0, 0, r, a0, a0 + 1.9); ctx.stroke();
        ctx.beginPath(); ctx.arc(0, 0, r, a0 + Math.PI, a0 + Math.PI + 1.4); ctx.stroke();
    }
    ctx.restore();
}

// ==========================================
// Projectiles
// ==========================================

function drawUltProjectile(p) {
    if (p.shape === 'breath') { drawBreathPuff(p); return true; }
    if (p.shape === 'light_spear') { // Cleric Avatar of Renewal: homing lances of light
        const ang = Math.atan2(p.vy, p.vx);
        ctx.save();
        ctx.translate(p.x, p.y); ctx.rotate(ang);
        ctx.globalCompositeOperation = 'lighter';
        const g = ctx.createRadialGradient(0, 0, 0, 0, 0, 18);
        g.addColorStop(0, 'rgba(255, 248, 225, 0.8)'); g.addColorStop(1, 'rgba(255, 213, 79, 0)');
        ctx.fillStyle = g; ctx.beginPath(); ctx.arc(0, 0, 18, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = 'rgba(255, 224, 130, 0.9)';
        ctx.beginPath(); ctx.moveTo(16, 0); ctx.lineTo(-4, -4.5); ctx.lineTo(-18, 0); ctx.lineTo(-4, 4.5); ctx.closePath(); ctx.fill();
        ctx.fillStyle = '#ffffff';
        ctx.beginPath(); ctx.moveTo(13, 0); ctx.lineTo(-2, -1.8); ctx.lineTo(-12, 0); ctx.lineTo(-2, 1.8); ctx.closePath(); ctx.fill();
        ctx.restore();
        return true;
    }
    if (p.type === 'turret' || p.type === 'tesla_coil_trap') {
        if (p.dropIn > 0) { // Automated Assembly: the turret drops in from the sky
            const h = 260 * Math.pow(p.dropIn / 0.35, 2), s = 1 - p.dropIn / 0.35 * 0.6;
            ctx.save();
            ctx.fillStyle = `rgba(0, 0, 0, ${0.4 * s})`;
            ctx.beginPath(); ctx.ellipse(p.x, p.y + 4, 18 * s, 11 * s, 0, 0, Math.PI * 2); ctx.fill();
            ctx.translate(0, -h);
            drawTurret(p);
            ctx.restore();
            return true;
        }
        if (selectedClassId === 'machinist' && buffs.overclockTimer > 0) { // red-hot glow under the overclocked machine
            const heat = 0.5 + 0.5 * Math.sin(fxTime * 12 + p.x);
            ctx.save();
            ctx.globalCompositeOperation = 'lighter';
            const g = ctx.createRadialGradient(p.x, p.y, 4, p.x, p.y, 34);
            g.addColorStop(0, `rgba(255, 82, 0, ${0.35 + 0.2 * heat})`); g.addColorStop(1, 'rgba(255, 61, 0, 0)');
            ctx.fillStyle = g; ctx.beginPath(); ctx.arc(p.x, p.y, 34, 0, Math.PI * 2); ctx.fill();
            // Nuclear Payload: hazard flashes in the last stretch before the turrets blow
            if (p.type === 'turret' && activeClass.skills[4].selectedUpg === 'A' && buffs.overclockTimer < 1.2 && Math.sin(fxTime * 30) > 0) {
                ctx.strokeStyle = 'rgba(255, 235, 59, 0.9)'; ctx.lineWidth = 3; ctx.setLineDash([6, 4]);
                ctx.beginPath(); ctx.arc(p.x, p.y, 28, 0, Math.PI * 2); ctx.stroke();
                ctx.setLineDash([]);
                ctx.fillStyle = 'rgba(255, 82, 82, 0.9)'; ctx.font = 'bold 16px monospace'; ctx.textAlign = 'center'; ctx.fillText('!', p.x, p.y - 30);
            }
            ctx.restore();
        }
        return false; // the turret itself is drawn as usual on top
    }
    return false;
}

// ==========================================
// Ground layer (under enemies)
// ==========================================

function drawUltGround(ef) {
    switch (ef.type) {
        case 'breath_scorch': { // Dragon Breath scorch / frost marks
            const k = clamp01(ef.life / ef.maxLife), frost = ef.breath === 'frost';
            ctx.save();
            const g = ctx.createRadialGradient(ef.x, ef.y, 0, ef.x, ef.y, ef.radius);
            if (frost) { g.addColorStop(0, `rgba(225, 245, 254, ${0.3 * k})`); g.addColorStop(1, 'rgba(129, 212, 250, 0)'); }
            else { g.addColorStop(0, `rgba(25, 12, 6, ${0.4 * k})`); g.addColorStop(1, 'rgba(25, 12, 6, 0)'); }
            ctx.fillStyle = g; ctx.beginPath(); ctx.arc(ef.x, ef.y, ef.radius, 0, Math.PI * 2); ctx.fill();
            if (!frost && k > 0.6) { // still glowing for a moment
                ctx.globalCompositeOperation = 'lighter';
                ctx.fillStyle = `rgba(255, 111, 0, ${(k - 0.6) * 0.6})`;
                ctx.beginPath(); ctx.arc(ef.x, ef.y, ef.radius * 0.4, 0, Math.PI * 2); ctx.fill();
            }
            ctx.restore();
            return true;
        }
        case 'meteor_fall': { // the target zone darkens as the meteor's shadow grows
            const q = clamp01(ultElapsed(ef) / ef.maxLife), R = ef.radius, throb = 0.5 + 0.5 * Math.sin(fxTime * (8 + q * 20));
            ctx.save();
            ctx.translate(ef.x, ef.y);
            ctx.fillStyle = `rgba(255, 87, 34, ${0.06 + 0.12 * q})`;
            ctx.beginPath(); ctx.arc(0, 0, R, 0, Math.PI * 2); ctx.fill();
            ctx.strokeStyle = `rgba(255, 112, 67, ${0.5 + 0.4 * throb})`; ctx.lineWidth = 2.5;
            ctx.setLineDash([14, 8]); ctx.lineDashOffset = -fxTime * 40;
            ctx.beginPath(); ctx.arc(0, 0, R, 0, Math.PI * 2); ctx.stroke();
            ctx.setLineDash([]);
            ctx.fillStyle = `rgba(0, 0, 0, ${0.2 + 0.35 * q})`;
            ctx.beginPath(); ctx.ellipse(0, 0, 10 + 45 * q * q, 7 + 32 * q * q, 0, 0, Math.PI * 2); ctx.fill();
            ctx.restore();
            return true;
        }
        case 'echo_charge': { // Echo Blast: the scorch rekindles before the second blast
            const q = clamp01(ultElapsed(ef) / ef.maxLife), R = ef.radius, throb = 0.5 + 0.5 * Math.sin(fxTime * (6 + q * 30));
            ctx.save();
            ctx.translate(ef.x, ef.y);
            ctx.globalCompositeOperation = 'lighter';
            const g = ctx.createRadialGradient(0, 0, 0, 0, 0, R);
            g.addColorStop(0, `rgba(255, 171, 64, ${0.15 + 0.4 * q * throb})`); g.addColorStop(1, 'rgba(255, 87, 34, 0)');
            ctx.fillStyle = g; ctx.beginPath(); ctx.arc(0, 0, R, 0, Math.PI * 2); ctx.fill();
            ctx.strokeStyle = `rgba(255, 152, 0, ${0.4 + 0.5 * throb})`; ctx.lineWidth = 2;
            ctx.beginPath(); ctx.arc(0, 0, R * (1 - 0.3 * ((fxTime * 1.5) % 1)), 0, Math.PI * 2); ctx.stroke();
            ctx.restore();
            return true;
        }
        case 'molten_scorch': { // Meteor impact: a molten blotch that cools to black
            const k = clamp01(ef.life / ef.maxLife), R = ef.radius;
            if (!ef.blobs) ef.blobs = Array.from({ length: 7 }, () => { const a = Math.random() * Math.PI * 2, r = Math.random() * R * 0.55; return { x: Math.cos(a) * r, y: Math.sin(a) * r, s: R * (0.12 + Math.random() * 0.12) }; });
            ctx.save();
            ctx.translate(ef.x, ef.y);
            const g = ctx.createRadialGradient(0, 0, 0, 0, 0, R);
            g.addColorStop(0, `rgba(20, 10, 6, ${0.6 * Math.min(1, k * 2)})`); g.addColorStop(0.7, `rgba(40, 18, 8, ${0.35 * Math.min(1, k * 2)})`); g.addColorStop(1, 'rgba(40, 18, 8, 0)');
            ctx.fillStyle = g; ctx.beginPath(); ctx.arc(0, 0, R, 0, Math.PI * 2); ctx.fill();
            ctx.globalCompositeOperation = 'lighter';
            const heat = k * k;
            for (const b of ef.blobs) {
                const bg = ctx.createRadialGradient(b.x, b.y, 0, b.x, b.y, b.s);
                bg.addColorStop(0, `rgba(255, 213, 79, ${0.8 * heat})`); bg.addColorStop(0.5, `rgba(255, 87, 34, ${0.5 * heat})`); bg.addColorStop(1, 'rgba(183, 28, 28, 0)');
                ctx.fillStyle = bg; ctx.beginPath(); ctx.arc(b.x, b.y, b.s, 0, Math.PI * 2); ctx.fill();
            }
            ctx.strokeStyle = `rgba(255, 111, 0, ${0.5 * heat})`; ctx.lineWidth = 3;
            ctx.beginPath(); ctx.arc(0, 0, R * 0.75, 0, Math.PI * 2); ctx.stroke();
            ctx.restore();
            return true;
        }
        case 'consecrated_ground': { // Paladin Consecrated Wrath: a field of white-gold holy fire
            const R = ef.radius, a = Math.min(1, ef.life / 0.6, ultElapsed(ef) / 0.3);
            if (!ef.tongues) {
                ef.tongues = [];
                for (let i = 0; i < 30; i++) { const an = Math.random() * Math.PI * 2, r = Math.sqrt(Math.random()) * R * 0.85; ef.tongues.push({ x: Math.cos(an) * r, y: Math.sin(an) * r, s: 0.7 + Math.random() * 0.6, ph: Math.random() * 6 }); }
                for (let i = 0; i < 14; i++) { const an = i * Math.PI * 2 / 14; ef.tongues.push({ x: Math.cos(an) * R * 0.95, y: Math.sin(an) * R * 0.95, s: 0.9, ph: Math.random() * 6 }); }
            }
            ctx.save();
            ctx.translate(ef.x, ef.y);
            const g = ctx.createRadialGradient(0, 0, 0, 0, 0, R);
            g.addColorStop(0, `rgba(255, 236, 179, ${0.12 * a})`); g.addColorStop(0.8, `rgba(255, 179, 0, ${0.2 * a})`); g.addColorStop(1, `rgba(255, 143, 0, ${0.05 * a})`);
            ctx.fillStyle = g; ctx.beginPath(); ctx.arc(0, 0, R, 0, Math.PI * 2); ctx.fill();
            ctx.globalCompositeOperation = 'lighter';
            ctx.strokeStyle = `rgba(255, 213, 79, ${0.7 * a})`; ctx.lineWidth = 2.5;
            ctx.beginPath(); ctx.arc(0, 0, R, 0, Math.PI * 2); ctx.stroke();
            for (const t of ef.tongues) { // flickering flame tongues, licking upward
                const h = (26 + 12 * Math.sin(fxTime * 11 + t.ph)) * t.s, w = 8 * t.s, sway = Math.sin(fxTime * 7 + t.ph) * 4;
                const bg = ctx.createRadialGradient(t.x, t.y, 0, t.x, t.y, w * 2.2); // glow pooled at the flame's base
                bg.addColorStop(0, `rgba(255, 213, 79, ${0.35 * a})`); bg.addColorStop(1, 'rgba(255, 213, 79, 0)');
                ctx.fillStyle = bg; ctx.beginPath(); ctx.arc(t.x, t.y, w * 2.2, 0, Math.PI * 2); ctx.fill();
                const fg = ctx.createLinearGradient(t.x, t.y, t.x, t.y - h);
                fg.addColorStop(0, `rgba(255, 193, 7, ${0.55 * a})`); fg.addColorStop(0.5, `rgba(255, 248, 225, ${0.6 * a})`); fg.addColorStop(1, 'rgba(255, 255, 255, 0)');
                ctx.fillStyle = fg;
                ctx.beginPath(); ctx.moveTo(t.x - w, t.y); ctx.quadraticCurveTo(t.x - w, t.y - h * 0.5, t.x + sway, t.y - h); ctx.quadraticCurveTo(t.x + w, t.y - h * 0.5, t.x + w, t.y); ctx.closePath(); ctx.fill();
            }
            ctx.restore();
            return true;
        }
        case 'spore_cloud': { // Druid Savage Blooms: a glowing meadow of spore flowers
            if (!ef.isFriendly) return false;
            const R = ef.radius, a = Math.min(1, ef.life / 0.8, ultElapsed(ef) / 0.4);
            if (!ef.flowers) ef.flowers = Array.from({ length: 14 }, (_, i) => { const an = Math.random() * Math.PI * 2, r = Math.sqrt(Math.random()) * R * 0.85; return { x: Math.cos(an) * r, y: Math.sin(an) * r, s: 0.7 + Math.random() * 0.6, rot: Math.random() * 6, ph: Math.random() * 6 }; });
            ctx.save();
            ctx.translate(ef.x, ef.y);
            const g = ctx.createRadialGradient(0, 0, 0, 0, 0, R);
            g.addColorStop(0, `rgba(205, 220, 57, ${0.18 * a})`); g.addColorStop(1, 'rgba(139, 195, 74, 0)');
            ctx.fillStyle = g; ctx.beginPath(); ctx.arc(0, 0, R, 0, Math.PI * 2); ctx.fill();
            ctx.globalAlpha = a;
            for (const f of ef.flowers) {
                const grow = Math.min(1, ultElapsed(ef) * 3);
                ctx.save(); ctx.translate(f.x, f.y); ctx.rotate(f.rot); ctx.scale(f.s * grow, f.s * grow);
                for (let i = 0; i < 5; i++) { ctx.rotate(Math.PI * 2 / 5); sprEllipse(ctx, 6, 0, 5.5, 3.2, '#558b2f'); }
                ctx.globalCompositeOperation = 'lighter';
                const glow = 0.6 + 0.4 * Math.sin(fxTime * 3 + f.ph);
                const cg = ctx.createRadialGradient(0, 0, 0, 0, 0, 9);
                cg.addColorStop(0, `rgba(238, 255, 65, ${glow})`); cg.addColorStop(1, 'rgba(205, 220, 57, 0)');
                ctx.fillStyle = cg; ctx.beginPath(); ctx.arc(0, 0, 9, 0, Math.PI * 2); ctx.fill();
                ctx.restore();
            }
            ctx.restore();
            return true;
        }
    }
    return false;
}

// ==========================================
// Effects layer
// ==========================================

function drawUltEffect(ef, p, k) {
    switch (ef.type) {
        // Drawn on the ground layer or in the overlay instead
        case 'breath_scorch': case 'meteor_fall': case 'echo_charge': case 'molten_scorch':
        case 'dragon_head': case 'clone_strike': case 'katana_tornado':
            return true;

        case 'arrow_rain': { // Ranger Volley: launch streaks, the target reticle, then arrows stuck in the ground
            const el = ultElapsed(ef);
            ctx.save();
            if (el < 0.3) { // arrows loosed skyward
                ctx.globalCompositeOperation = 'lighter';
                for (let i = 0; i < 6; i++) {
                    const x = ef.sx + (i - 2.5) * 6, y = ef.sy - 20 - el * 1500 - i * 12;
                    ctx.strokeStyle = `rgba(220, 237, 200, ${1 - el / 0.3})`; ctx.lineWidth = 2;
                    ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x, y + 40); ctx.stroke();
                }
                ctx.globalCompositeOperation = 'source-over';
            }
            const lastLand = Math.max(...ef.arrows.map(a => a.t));
            if (el < lastLand + 0.2) { // reticle over the target area
                const ra = Math.min(1, el / 0.15, (lastLand + 0.2 - el) / 0.2);
                ctx.translate(ef.x, ef.y);
                ctx.strokeStyle = `rgba(197, 225, 165, ${0.75 * ra})`; ctx.lineWidth = 2;
                ctx.setLineDash([10, 7]); ctx.lineDashOffset = fxTime * 30;
                ctx.beginPath(); ctx.arc(0, 0, ef.radius, 0, Math.PI * 2); ctx.stroke();
                ctx.setLineDash([]);
                ctx.fillStyle = `rgba(139, 195, 74, ${0.1 * ra})`; ctx.fill();
                ctx.lineWidth = 1.5;
                for (let i = 0; i < 4; i++) {
                    const an = i * Math.PI / 2, r0 = ef.radius * 0.15, r1 = ef.radius * 0.35;
                    ctx.beginPath(); ctx.moveTo(Math.cos(an) * r0, Math.sin(an) * r0); ctx.lineTo(Math.cos(an) * r1, Math.sin(an) * r1); ctx.stroke();
                }
                ctx.translate(-ef.x, -ef.y);
            }
            for (const a of ef.arrows) { // landed arrows stay stuck in the ground for a moment
                if (el < a.t) continue;
                const fade = Math.min(1, ef.life / 0.6);
                drawArrowShape(a.x, a.y, -Math.PI / 2 + 0.35, ef.heavy ? 13 : 10, ef.heavy, fade);
            }
            ctx.restore();
            return true;
        }

        case 'death_mark_wave': { // Nightblade Death Mark: a ripple of shadow rolls out over everything in range
            const R = ef.radius * easeOut(Math.min(1, p * 1.4));
            if (!ef.burstDone) { ef.burstDone = true; addShake(2); burst(ef.x, ef.y, 0, Math.PI * 2, 12, { kind: 'smoke', color: '#311b92', size: 8, grow: 40, life: 0.6, speed: [80, 200], drag: 3 }); }
            ctx.save();
            ctx.globalAlpha = 1;
            const g = ctx.createRadialGradient(ef.x, ef.y, Math.max(0, R - 60), ef.x, ef.y, Math.max(1, R));
            g.addColorStop(0, 'rgba(49, 27, 146, 0)'); g.addColorStop(1, `rgba(74, 20, 140, ${0.35 * k})`);
            ctx.fillStyle = g; ctx.beginPath(); ctx.arc(ef.x, ef.y, Math.max(1, R), 0, Math.PI * 2); ctx.fill();
            ctx.globalCompositeOperation = 'lighter';
            ctx.strokeStyle = `rgba(206, 147, 216, ${0.8 * k})`; ctx.lineWidth = 2.5;
            ctx.beginPath(); ctx.arc(ef.x, ef.y, Math.max(1, R), 0, Math.PI * 2); ctx.stroke();
            ctx.translate(ef.x, ef.y); // the eye of the mark opening over the nightblade
            const open = Math.sin(Math.min(1, p * 2) * Math.PI);
            ctx.fillStyle = `rgba(234, 128, 252, ${0.7 * k})`;
            ctx.beginPath(); ctx.moveTo(-34, 0); ctx.quadraticCurveTo(0, -22 * open, 34, 0); ctx.quadraticCurveTo(0, 22 * open, -34, 0); ctx.fill();
            ctx.fillStyle = `rgba(26, 11, 46, ${k})`;
            ctx.beginPath(); ctx.ellipse(0, 0, 4, 12 * open, 0, 0, Math.PI * 2); ctx.fill();
            ctx.restore();
            return true;
        }

        case 'overclock_burst': { // Machinist Overclock kicking in
            if (!ef.burstDone) {
                ef.burstDone = true;
                burst(player.x, player.y, 0, Math.PI * 2, 16, { kind: 'spark', color: '#ffab40', size: 2.2, life: 0.35, speed: [200, 450], drag: 5 });
                burst(player.x, player.y, 0, Math.PI * 2, 8, { kind: 'smoke', color: '#cfd8dc', size: 6, grow: 34, life: 0.6, speed: [60, 160], drag: 3 });
                addShake(2.5);
            }
            ctx.save();
            ctx.globalCompositeOperation = 'lighter';
            ctx.strokeStyle = `rgba(255, 145, 0, ${k})`; ctx.lineWidth = 5 * k + 1;
            ctx.beginPath(); ctx.arc(player.x, player.y, 20 + 130 * easeOut(p), 0, Math.PI * 2); ctx.stroke();
            ctx.restore();
            return true;
        }

        case 'shatter_burst': { // Swordsaint Shatter Storm: the airborne blade bursts into shards
            if (!ef.burstDone) {
                ef.burstDone = true;
                burst(ef.x, ef.y, 0, Math.PI * 2, 16, { kind: 'spark', color: '#84ffff', size: 2.5, life: 0.35, speed: [200, 480], drag: 5 });
                addShake(2);
            }
            ctx.save();
            ctx.globalCompositeOperation = 'lighter';
            const g = ctx.createRadialGradient(ef.x, ef.y, 0, ef.x, ef.y, 60);
            g.addColorStop(0, `rgba(255, 255, 255, ${k})`); g.addColorStop(0.4, `rgba(0, 229, 255, ${0.5 * k})`); g.addColorStop(1, 'rgba(0, 96, 100, 0)');
            ctx.fillStyle = g; ctx.beginPath(); ctx.arc(ef.x, ef.y, 60, 0, Math.PI * 2); ctx.fill();
            ctx.strokeStyle = `rgba(132, 255, 255, ${k})`; ctx.lineWidth = 3 * k;
            ctx.beginPath(); ctx.arc(ef.x, ef.y, 15 + 90 * easeOut(p), 0, Math.PI * 2); ctx.stroke();
            ctx.restore();
            return true;
        }

        case 'ascend_burst': { // Cleric Ascension cast: a column of light (or shadow) bursting around the cleric
            const shadow = ef.variant === 'shadow', col = shadow ? '#ce93d8' : '#ffe082';
            if (!ef.burstDone) {
                ef.burstDone = true;
                burst(player.x, player.y, 0, Math.PI * 2, 14, { kind: 'leaf', color: shadow ? '#1a0b2e' : '#fff8e1', size: 7, life: 0.9, speed: [80, 220], drag: 3 });
                burst(player.x, player.y, 0, Math.PI * 2, 14, { kind: 'dot', color: col, size: 2.2, life: 0.6, speed: [100, 300], drag: 3 });
                addShake(2.5);
            }
            ctx.save();
            ctx.globalCompositeOperation = 'lighter';
            ctx.translate(player.x, player.y);
            const R = ef.radius || 120;
            const g = ctx.createRadialGradient(0, 0, 0, 0, 0, R);
            g.addColorStop(0, shadow ? `rgba(234, 128, 252, ${0.7 * k})` : `rgba(255, 255, 255, ${0.9 * k})`); g.addColorStop(0.4, withAlpha(col, 0.4 * k)); g.addColorStop(1, withAlpha(col, 0));
            ctx.fillStyle = g; ctx.beginPath(); ctx.arc(0, 0, R, 0, Math.PI * 2); ctx.fill();
            for (let i = 0; i < 2; i++) {
                ctx.strokeStyle = withAlpha(col, k * (1 - i * 0.4)); ctx.lineWidth = 3 * k + 0.5;
                ctx.beginPath(); ctx.arc(0, 0, R * easeOut(Math.min(1, p * (1.6 - i * 0.4))), 0, Math.PI * 2); ctx.stroke();
            }
            ctx.restore();
            return true;
        }

        case 'wild_shift': { // Druid Aspect of the Wild: the cocoon bursts and the wolf's roar rolls out
            const el = ultElapsed(ef);
            if (el < 0.24) return true; // the cocoon is drawn over the hero (drawUltOverlay)
            if (!ef.burstDone) {
                ef.burstDone = true;
                burst(player.x, player.y, 0, Math.PI * 2, 18, { kind: 'leaf', color: '#7cb342', size: 8, life: 0.8, speed: [150, 360], drag: 3 });
                burst(player.x, player.y, 0, Math.PI * 2, 8, { kind: 'leaf', color: '#6d4c41', size: 6, life: 0.7, speed: [120, 300], drag: 3 });
                burst(player.x, player.y, 0, Math.PI * 2, 10, { kind: 'debris', color: '#5d4037', size: 3, life: 0.5, speed: [100, 260], drag: 5 });
                addShake(3.5);
            }
            const q = (el - 0.24) / (ef.maxLife - 0.24);
            ctx.save();
            ctx.globalCompositeOperation = 'lighter';
            ctx.translate(ef.x, ef.y);
            for (let i = 0; i < 3; i++) { // three broken sound rings
                const qi = clamp01(q * 1.3 - i * 0.15);
                if (qi <= 0 || qi >= 1) continue;
                const R = 30 + (ef.radius - 30) * easeOut(qi);
                ctx.strokeStyle = `rgba(204, 255, 144, ${0.8 * (1 - qi)})`; ctx.lineWidth = 4 * (1 - qi) + 1;
                for (let s = 0; s < 6; s++) { const a0 = s * Math.PI / 3 + i * 0.5; ctx.beginPath(); ctx.arc(0, 0, R, a0, a0 + 0.75); ctx.stroke(); }
            }
            ctx.restore();
            return true;
        }
    }
    return false;
}

// ==========================================
// Overlay (above enemies and particles)
// ==========================================

function drawUltOverlay() {
    for (const ef of effects) {
        if (ef.type === 'dragon_head') drawDragonHead(ef);
        else if (ef.type === 'meteor_fall') drawMeteorRock(ef);
        else if (ef.type === 'clone_strike') drawCloneStrike(ef);
        else if (ef.type === 'katana_tornado') drawKatanaTornado(ef);
        else if (ef.type === 'wild_shift') drawVineCocoon(ef);
        else if (ef.type === 'arrow_rain') { // arrows dropping out of the sky, each over its growing shadow
            const el = ultElapsed(ef);
            for (const a of ef.arrows) {
                const q = (el - (a.t - RAIN_FALL)) / RAIN_FALL;
                if (q < 0 || q >= 1) continue;
                ctx.fillStyle = `rgba(0, 0, 0, ${0.35 * q})`;
                ctx.beginPath(); ctx.ellipse(a.x, a.y, 2 + 4 * q, 1.5 + 2 * q, 0, 0, Math.PI * 2); ctx.fill();
                const x = a.x + 26 * (1 - q), y = a.y - 170 * (1 - q), ang = Math.atan2(170, -26);
                ctx.save();
                ctx.globalCompositeOperation = 'lighter';
                ctx.strokeStyle = 'rgba(220, 237, 200, 0.5)'; ctx.lineWidth = ef.heavy ? 3 : 2;
                ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + 8, y - 50); ctx.stroke();
                ctx.restore();
                drawArrowShape(x, y, ang, ef.heavy ? 22 : 18, ef.heavy, 1);
            }
        }
    }
}

// ==========================================
// Emitters (game time)
// ==========================================

function updateUltEmitters(dt) {
    for (const ef of effects) {
        switch (ef.type) {
            case 'dragon_head': {
                if (ef.snap) break;
                if (ef.tracking) { // swing toward the cursor: fast, but with a little weight
                    const target = Math.atan2(mouseY - player.y, mouseX - player.x);
                    ef.angle += Math.atan2(Math.sin(target - ef.angle), Math.cos(target - ef.angle)) * Math.min(1, dt * 14);
                }
                if (ef.life > 0.25) addShake(1.2);
                ef.scorchT = (ef.scorchT || 0) - dt;
                if (ef.scorchT <= 0) { // the breath leaves marks where it rolls over the ground
                    ef.scorchT = 0.1;
                    const puffs = projectiles.filter(p => p.shape === 'breath');
                    if (puffs.length) { const p = puffs[Math.floor(Math.random() * puffs.length)]; effects.push({ type: 'breath_scorch', x: p.x, y: p.y, radius: 22 + Math.random() * 14, breath: ef.breath, life: 2.0, maxLife: 2.0 }); }
                }
                break;
            }
            case 'meteor_fall': {
                const m = meteorPos(ef);
                emit(80, dt, () => spawnParticle({ kind: 'dot', color: Math.random() < 0.5 ? '#ffab40' : '#ff7043', x: m.x + jitter(24), y: m.y + jitter(24), vx: 140 + jitter(60), vy: -260 + jitter(60), size: 2.2, life: 0.4, drag: 2, grow: 0, spin: 0, rot: 0 }));
                emit(25, dt, () => spawnParticle({ kind: 'smoke', color: '#424242', x: m.x + jitter(16), y: m.y + jitter(16), vx: 60, vy: -120, size: 8, grow: 30, life: 0.6, drag: 2, spin: 0, rot: 0 }));
                break;
            }
            case 'echo_charge':
                emit(20, dt, () => { const a = Math.random() * Math.PI * 2, r = Math.random() * ef.radius; spawnParticle({ kind: 'dot', color: '#ffab40', x: ef.x + Math.cos(a) * r, y: ef.y + Math.sin(a) * r, vx: jitter(10), vy: -50, size: 1.8, life: 0.5, drag: 0.5, grow: 0, spin: 0, rot: 0 }); });
                break;
            case 'molten_scorch':
                if (ef.life / ef.maxLife > 0.3) emit(8, dt, () => { const a = Math.random() * Math.PI * 2, r = Math.random() * ef.radius * 0.6; spawnParticle({ kind: Math.random() < 0.6 ? 'dot' : 'smoke', color: Math.random() < 0.6 ? '#ff9100' : '#424242', x: ef.x + Math.cos(a) * r, y: ef.y + Math.sin(a) * r, vx: jitter(10), vy: -40, size: 2, grow: 6, life: 0.6, drag: 0.5, spin: 0, rot: 0 }); });
                break;
            case 'consecrated_ground':
                emit(ef.radius / 8, dt, () => { const a = Math.random() * Math.PI * 2, r = Math.sqrt(Math.random()) * ef.radius; spawnParticle({ kind: 'dot', color: Math.random() < 0.5 ? '#fff8e1' : '#ffca28', x: ef.x + Math.cos(a) * r, y: ef.y + Math.sin(a) * r, vx: jitter(14), vy: -50 - Math.random() * 40, size: 1.7, life: 0.7, drag: 0.5, grow: 0, spin: 0, rot: 0 }); });
                break;
            case 'spore_cloud':
                if (ef.isFriendly && ef.flowers) emit(12, dt, () => { const f = ef.flowers[Math.floor(Math.random() * ef.flowers.length)]; spawnParticle({ kind: 'dot', color: '#eeff41', x: ef.x + f.x, y: ef.y + f.y, vx: jitter(20), vy: -30, size: 1.6, life: 0.9, drag: 0.5, grow: 0, spin: 0, rot: 0 }); });
                break;
        }
    }

    for (const p of projectiles) {
        if (p.isEnemy) continue;
        if (p.shape === 'breath') {
            const c = BREATH[p.breath] || BREATH.fire;
            emit(14, dt, () => spawnParticle({ kind: p.breath === 'shatter' ? 'spark' : 'dot', color: c.ember, x: p.x + jitter(p.radius), y: p.y + jitter(p.radius), vx: p.vx * 0.3 + jitter(80), vy: p.vy * 0.3 + jitter(80), size: 1.8, life: 0.4, drag: 3, grow: 0, spin: 0, rot: 0 }));
        } else if (p.shape === 'light_spear') {
            emit(40, dt, () => spawnParticle({ kind: 'dot', color: '#ffe082', x: p.x, y: p.y, vx: -p.vx * 0.1 + jitter(30), vy: -p.vy * 0.1 + jitter(30), size: 1.6, life: 0.35, drag: 2, grow: 0, spin: 0, rot: 0 }));
        } else if (p.type === 'turret' || p.type === 'tesla_coil_trap') {
            if (p.dropIn > 0) {
                p.dropIn -= dt;
                if (p.dropIn <= 0) { // landing clank
                    p.dropIn = 0;
                    burst(p.x, p.y, 0, Math.PI * 2, 10, { kind: 'spark', color: '#ffcc80', size: 2, life: 0.25, speed: [150, 330], drag: 6 });
                    burst(p.x, p.y, 0, Math.PI * 2, 6, { kind: 'smoke', color: '#9e9e9e', size: 5, grow: 26, life: 0.5, speed: [60, 140], drag: 4 });
                    addShake(2);
                }
            }
            if (selectedClassId === 'machinist' && buffs.overclockTimer > 0) // overclocked machines vent steam
                emit(5, dt, () => spawnParticle({ kind: 'smoke', color: '#cfd8dc', x: p.x + jitter(10), y: p.y - 8, vx: jitter(20), vy: -60, size: 3, grow: 18, life: 0.5, drag: 1, spin: 0, rot: 0 }));
        }
    }

    // Overclock: steam and sparks off the machinist
    if (selectedClassId === 'machinist' && buffs.overclockTimer > 0) {
        emit(10, dt, () => spawnParticle({ kind: 'smoke', color: '#eceff1', x: player.x + jitter(16), y: player.y + jitter(16), vx: jitter(30), vy: -70, size: 3, grow: 20, life: 0.5, drag: 1, spin: 0, rot: 0 }));
        emit(14, dt, () => spawnParticle({ kind: 'spark', color: '#ffab40', x: player.x + jitter(20), y: player.y + jitter(20), vx: jitter(200), vy: jitter(200), size: 1.4, life: 0.2, drag: 4, grow: 0, spin: 0, rot: 0 }));
    }

    // Ascension: falling feathers of light (or shadow)
    const f = clericForm();
    if (f && f.kind !== 'base') {
        emit(6, dt, () => spawnParticle({ kind: 'leaf', color: f.kind === 'holy' ? '#fff8e1' : '#2a1040', x: player.x + jitter(70), y: player.y + jitter(40), vx: jitter(20), vy: 25, size: 6, life: 1.0, drag: 1, grow: 0, spin: (Math.random() - 0.5) * 4, rot: Math.random() * 6 }));
    }

    // Shatter Storm shards leave cyan wakes
    if (player.miniBlades && player.miniBlades.length) {
        for (const mb of player.miniBlades) emit(20, dt, () => spawnParticle({ kind: 'dot', color: '#84ffff', x: mb.x + jitter(6), y: mb.y + jitter(6), vx: 0, vy: 0, size: 1.4, life: 0.25, drag: 0, grow: 0, spin: 0, rot: 0 }));
    }

    // Hammer of the Gods: dust and light dragged in toward the hurricane
    const h = player.hammer;
    if (selectedClassId === 'paladin' && h && h.hurricaneTimer > 0) {
        emit(30, dt, () => { const a = Math.random() * Math.PI * 2, r = 200 + Math.random() * 80; spawnParticle({ kind: Math.random() < 0.5 ? 'smoke' : 'spark', color: Math.random() < 0.5 ? '#8d8478' : '#ffe082', x: h.x + Math.cos(a) * r, y: h.y + Math.sin(a) * r, vx: -Math.cos(a - 0.6) * 380, vy: -Math.sin(a - 0.6) * 380, size: 3, grow: 10, life: 0.5, drag: 1, spin: 0, rot: 0 }); });
    }
}
