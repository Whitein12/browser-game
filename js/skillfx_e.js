// ==========================================
// skillfx_e.js - Visuals for the class E abilities
// ==========================================
// Dispatched from skillfx.js (drawSkillProjectile / drawSkillEffect / drawSkillGround / updateSkillEmitters),
// plus drawPlayerShield, drawGroundProjectiles and drawEnemyStatus called from main.js draw.

// Hexagon lattice clipped to a circle (shields). Caller sets strokeStyle/lineWidth.
function strokeHoneycomb(cx, cy, R, size, rot) {
    ctx.save();
    ctx.beginPath(); ctx.arc(cx, cy, R, 0, Math.PI * 2); ctx.clip();
    ctx.translate(cx, cy); ctx.rotate(rot);
    const w = size * Math.sqrt(3), h = size * 1.5, rows = Math.ceil(R / h) + 1, cols = Math.ceil(R / w) + 1;
    ctx.beginPath();
    for (let row = -rows; row <= rows; row++) {
        for (let col = -cols; col <= cols; col++) {
            const x = col * w + (row % 2 ? w / 2 : 0), y = row * h;
            if (x * x + y * y > (R + size) * (R + size)) continue;
            for (let i = 0; i <= 6; i++) {
                const a = Math.PI / 6 + i * Math.PI / 3;
                if (i) ctx.lineTo(x + Math.cos(a) * size, y + Math.sin(a) * size); else ctx.moveTo(x + Math.cos(a) * size, y + Math.sin(a) * size);
            }
        }
    }
    ctx.stroke();
    ctx.restore();
}

// ==========================================
// Player shield
// ==========================================

// A bubble whose look depends on where the shield came from: steel lattice for the Dragonknight, ice shards for the
// Spellweaver's Ice Barrier, bark plates for the Druid's Barkskin, plain light otherwise. It flashes when hit.
function drawPlayerShield() {
    if (!(player.shield > 0)) return;
    const strength = Math.min(1, player.shield / 100), flash = player.hurtFlash > 0 ? Math.min(1, player.hurtFlash / 0.2) : 0;
    const x = player.x, y = player.y, R = player.radius + 14;
    if (selectedClassId === 'druid' && buffs.barkskin) { drawBarkShell(x, y, R, strength); return; }
    const steel = selectedClassId === 'dragonknight', ice = selectedClassId === 'spellweaver';
    const rgb = steel ? '176, 190, 197' : '129, 212, 250';
    ctx.save();
    const g = ctx.createRadialGradient(x, y, R * 0.5, x, y, R);
    g.addColorStop(0, `rgba(${rgb}, 0)`); g.addColorStop(1, `rgba(${rgb}, ${0.16 + 0.14 * strength + 0.3 * flash})`);
    ctx.fillStyle = g; ctx.beginPath(); ctx.arc(x, y, R, 0, Math.PI * 2); ctx.fill();
    if (steel) { ctx.strokeStyle = `rgba(${rgb}, ${0.25 + 0.2 * strength})`; ctx.lineWidth = 1; strokeHoneycomb(x, y, R, 6, fxTime * 0.3); }
    ctx.strokeStyle = flash > 0 ? `rgba(255, 255, 255, ${0.6 + 0.4 * flash})` : (steel ? `rgba(207, 216, 220, ${0.5 + 0.4 * strength})` : `rgba(179, 229, 252, ${0.5 + 0.4 * strength})`);
    ctx.lineWidth = 2;
    ctx.beginPath(); ctx.arc(x, y, R, 0, Math.PI * 2); ctx.stroke();
    if (ice) { // crystal shards set into the rim
        for (let i = 0; i < 6; i++) {
            const a = i * Math.PI / 3 + fxTime * 0.5;
            ctx.save(); ctx.translate(x + Math.cos(a) * R, y + Math.sin(a) * R); ctx.rotate(a);
            ctx.beginPath(); ctx.moveTo(6, 0); ctx.lineTo(0, -2.5); ctx.lineTo(-3, 0); ctx.lineTo(0, 2.5); ctx.closePath();
            ctx.fillStyle = 'rgba(225, 245, 254, 0.85)'; ctx.fill();
            ctx.restore();
        }
    }
    // World-lit highlight on the upper left of the bubble
    ctx.strokeStyle = `rgba(255, 255, 255, ${0.35 + 0.2 * strength})`; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.arc(x, y, R - 3, Math.PI * 1.1, Math.PI * 1.45); ctx.stroke();
    ctx.restore();
}

// Druid Barkskin: overlapping bark plates around the Druid; plates fall away as the shield is worn down
function drawBarkShell(x, y, R, strength) {
    const plates = Math.max(1, Math.ceil(8 * strength));
    ctx.save();
    ctx.translate(x, y); ctx.rotate(fxTime * 0.25);
    for (let i = 0; i < plates; i++) {
        ctx.save(); ctx.rotate(i * Math.PI / 4);
        ctx.beginPath(); ctx.arc(0, 0, R + 2, -0.42, 0.42); ctx.arc(0, 0, R - 5, 0.38, -0.38, true); ctx.closePath();
        sprFill(ctx, i % 2 ? '#6d4c41' : '#795548');
        ctx.strokeStyle = '#3e2723'; ctx.lineWidth = 0.8; // bark grooves
        ctx.beginPath();
        for (const t of [-0.2, 0.05, 0.25]) { ctx.moveTo(Math.cos(t) * (R - 4), Math.sin(t) * (R - 4)); ctx.lineTo(Math.cos(t + 0.05) * (R + 1), Math.sin(t + 0.05) * (R + 1)); }
        ctx.stroke();
        if (i % 3 === 0) sprLeaf(ctx, R + 1, 0, 0.6, 5, '#7cb342');
        ctx.restore();
    }
    ctx.restore();
}

// A ring of armor plates closing in from fromR to toR as q goes 0 → 1 (Barkskin bark)
function drawConvergingPlates(cx, cy, fromR, toR, q, count, color, alpha) {
    const r = lerp(fromR, toR, easeOut(q)), span = Math.PI / count * 0.85;
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.translate(cx, cy);
    for (let i = 0; i < count; i++) {
        ctx.save(); ctx.rotate(i * Math.PI * 2 / count + 0.3);
        ctx.beginPath(); ctx.arc(0, 0, r + 3, -span, span); ctx.arc(0, 0, r - 4, span, -span, true); ctx.closePath();
        sprFill(ctx, color);
        ctx.restore();
    }
    ctx.restore();
}

// ==========================================
// Effects (returns true when drawn)
// ==========================================

function drawESkillEffect(ef, p, k) {
    switch (ef.type) {
        case 'dragonfire_ignite': { // Dragonknight Dragonfire Blade: fire roars up the greatsword and flares around the knight
            const x = player.x, y = player.y, R = player.radius + 10 + 50 * easeOut(p);
            if (!ef.burstDone) {
                ef.burstDone = true;
                burst(x, y, 0, Math.PI * 2, 18, { kind: 'dot', color: '#ff7043', size: 2.5, life: 0.5, speed: [120, 300], drag: 4 });
                burst(x, y, 0, Math.PI * 2, 10, { kind: 'spark', color: '#ffca28', size: 2, life: 0.3, speed: [200, 400], drag: 5 });
            }
            ctx.save(); ctx.globalCompositeOperation = 'lighter';
            const g = ctx.createRadialGradient(x, y, 0, x, y, R);
            g.addColorStop(0, `rgba(255, 236, 179, ${0.6 * k})`); g.addColorStop(0.5, `rgba(255, 112, 67, ${0.45 * k})`); g.addColorStop(1, 'rgba(255, 87, 34, 0)');
            ctx.fillStyle = g; ctx.beginPath(); ctx.arc(x, y, R, 0, Math.PI * 2); ctx.fill();
            ctx.strokeStyle = `rgba(255, 202, 40, ${k})`; ctx.lineWidth = 3 * k + 0.5; ctx.beginPath(); ctx.arc(x, y, R, 0, Math.PI * 2); ctx.stroke();
            ctx.restore();
            return true;
        }
        case 'ice_wall': { // Spellweaver Ice Wall (combos.js): faceted crystals along the beam's line, grown out from the staff
            const el = ef.maxLife - ef.life, reach = Math.min(1, el / ICE_WALL_GROW), crack = ef.life < 0.3 ? ef.life / 0.3 : 1;
            if (ef.life < 0.3 && !ef.burstDone) { // cracking apart
                ef.burstDone = true;
                for (const c of ef.crystals) if (Math.random() < 0.5) burst(lerp(ef.x1, ef.x2, c.t), lerp(ef.y1, ef.y2, c.t), 0, Math.PI * 2, 2, { kind: 'spark', color: '#e1f5fe', size: 2.5, life: 0.4, speed: [60, 180], drag: 4 });
            }
            const ang = Math.atan2(ef.y2 - ef.y1, ef.x2 - ef.x1), nx = -Math.sin(ang), ny = Math.cos(ang);
            ctx.save();
            ctx.globalCompositeOperation = 'lighter'; ctx.lineCap = 'round'; // a cold glow under it
            ctx.strokeStyle = `rgba(129, 212, 250, ${0.3 * crack})`; ctx.lineWidth = ICE_WALL_THICK + 12;
            ctx.beginPath(); ctx.moveTo(ef.x1, ef.y1); ctx.lineTo(lerp(ef.x1, ef.x2, reach), lerp(ef.y1, ef.y2, reach)); ctx.stroke();
            ctx.globalCompositeOperation = 'source-over';
            for (const c of ef.crystals) {
                if (c.t > reach) continue;
                const grow = Math.min(1, (reach - c.t) * 6 + 0.3) * (0.4 + 0.6 * crack), R = c.size * grow;
                const cx = lerp(ef.x1, ef.x2, c.t) + nx * c.off, cy = lerp(ef.y1, ef.y2, c.t) + ny * c.off;
                ctx.beginPath();
                for (let i = 0; i < c.sides; i++) { const a = c.rot + i * Math.PI * 2 / c.sides, r = R * (i % 2 ? 0.8 : 1); if (i) ctx.lineTo(cx + Math.cos(a) * r, cy + Math.sin(a) * r); else ctx.moveTo(cx + Math.cos(a) * r, cy + Math.sin(a) * r); }
                ctx.closePath();
                ctx.fillStyle = `rgba(179, 229, 252, ${0.85 * crack})`; ctx.fill();
                ctx.strokeStyle = `rgba(255, 255, 255, ${0.9 * crack})`; ctx.lineWidth = 1.5; ctx.stroke();
                ctx.strokeStyle = `rgba(2, 136, 209, ${0.5 * crack})`; ctx.lineWidth = 1; // a facet line
                ctx.beginPath(); ctx.moveTo(cx, cy); ctx.lineTo(cx + Math.cos(c.rot) * R, cy + Math.sin(c.rot) * R); ctx.stroke();
            }
            ctx.restore();
            return true;
        }
        case 'random_ice_spikes': { // Spellweaver Frost Nova / Frost Departure: frost wave and faceted ice crystals
            if (!ef.burstDone) {
                ef.burstDone = true;
                burst(ef.x, ef.y, 0, Math.PI * 2, Math.round(ef.radius / 10), { kind: 'dot', color: '#e1f5fe', size: 2, life: 0.6, speed: [ef.radius, ef.radius * 2], drag: 4 });
                if (ef.radius >= 150) addShake(1.5);
            }
            ctx.save(); ctx.globalAlpha = 1;
            const wave = easeOut(Math.min(1, p * 2.2)), wr = ef.radius * wave + 1;
            const g = ctx.createRadialGradient(ef.x, ef.y, 0, ef.x, ef.y, wr);
            g.addColorStop(0, `rgba(225, 245, 254, ${0.15 * k})`); g.addColorStop(0.8, `rgba(129, 212, 250, ${0.3 * k})`); g.addColorStop(1, 'rgba(129, 212, 250, 0)');
            ctx.fillStyle = g; ctx.beginPath(); ctx.arc(ef.x, ef.y, wr, 0, Math.PI * 2); ctx.fill();
            ctx.strokeStyle = `rgba(255, 255, 255, ${k})`; ctx.lineWidth = 4 * k + 0.5;
            ctx.beginPath(); ctx.arc(ef.x, ef.y, ef.radius * wave, 0, Math.PI * 2); ctx.stroke();
            const grow = p < 0.25 ? easeOut(p / 0.25) : 1 - clamp01((p - 0.6) / 0.4);
            for (const s of ef.spikes) {
                const a = s.xOffset || s.yOffset ? Math.atan2(s.yOffset, s.xOffset) : -Math.PI / 2; // shards point away from the center
                const h = s.size * 1.6 * grow, w = s.size * 0.35 * grow;
                if (h < 1) continue;
                ctx.save(); ctx.translate(ef.x + s.xOffset, ef.y + s.yOffset); ctx.rotate(a);
                const cg = ctx.createLinearGradient(0, 0, h, 0);
                cg.addColorStop(0, 'rgba(2, 136, 209, 0.85)'); cg.addColorStop(0.6, 'rgba(129, 212, 250, 0.9)'); cg.addColorStop(1, '#ffffff');
                ctx.beginPath(); ctx.moveTo(-w * 0.6, 0); ctx.lineTo(0, -w); ctx.lineTo(h, 0); ctx.lineTo(0, w); ctx.closePath();
                ctx.fillStyle = cg; ctx.fill();
                ctx.strokeStyle = 'rgba(255, 255, 255, 0.9)'; ctx.lineWidth = 1; ctx.stroke();
                ctx.strokeStyle = 'rgba(255, 255, 255, 0.5)'; // facet
                ctx.beginPath(); ctx.moveTo(-w * 0.6, 0); ctx.lineTo(h, 0); ctx.stroke();
                ctx.restore();
            }
            ctx.restore();
            return true;
        }
        case 'wind_swirl': { // Ranger Nature's Stride: a leafy whirlwind around the ranger
            if (!ef.burstDone) {
                ef.burstDone = true;
                for (let i = 0; i < 8; i++) {
                    const a = i * Math.PI / 4;
                    spawnParticle({ kind: 'leaf', color: i % 2 ? '#8bc34a' : '#66bb6a', x: player.x + Math.cos(a) * 20, y: player.y + Math.sin(a) * 20,
                        vx: Math.cos(a + 1.2) * 160, vy: Math.sin(a + 1.2) * 160, size: 6, life: 0.7, drag: 3, grow: 0, spin: 8, rot: a });
                }
                burst(player.x, player.y, -Math.PI / 2, 1.2, 8, { kind: 'dot', color: '#69f0ae', size: 2, life: 0.7, speed: [40, 110], drag: 1 }); // healing motes
            }
            ctx.save();
            ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = k; ctx.lineCap = 'round';
            for (let i = 0; i < 3; i++) {
                const a0 = fxTime * 9 + i * Math.PI * 2 / 3, r = ef.radius * (0.6 + 0.6 * p);
                ctx.strokeStyle = i === 1 ? '#c5e1a5' : '#81c784'; ctx.lineWidth = 3 * k + 1;
                ctx.beginPath(); ctx.arc(player.x, player.y, r, a0, a0 + 1.6); ctx.stroke();
                ctx.lineWidth = 1.2;
                ctx.beginPath(); ctx.arc(player.x, player.y, r * 0.7, a0 + 0.8, a0 + 2.0); ctx.stroke();
            }
            ctx.restore();
            return true;
        }
        case 'tesla_pulse': { // Machinist Tesla Coil tick: an electric ring rippling across the field
            ctx.save();
            ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = 1;
            const R = ef.radius * easeOut(p);
            ctx.strokeStyle = `rgba(0, 229, 255, ${0.8 * k})`; ctx.lineWidth = 2;
            ctx.beginPath();
            for (let i = 0; i <= 40; i++) { const a = i * Math.PI / 20, r = R + (Math.random() - 0.5) * 8; ctx.lineTo(ef.x + Math.cos(a) * r, ef.y + Math.sin(a) * r); }
            ctx.stroke();
            ctx.fillStyle = `rgba(0, 229, 255, ${0.08 * k})`; ctx.beginPath(); ctx.arc(ef.x, ef.y, R, 0, Math.PI * 2); ctx.fill();
            ctx.restore();
            return true;
        }
        case 'blade_launch': { // Kensei Deploy: the blade leaps from the hand
            if (!ef.burstDone) {
                ef.burstDone = true;
                burst(ef.x, ef.y, 0, Math.PI * 2, 10, { kind: 'spark', color: '#84ffff', size: 2, life: 0.3, speed: [150, 320], drag: 6 });
                if (ef.flow) for (let i = 0; i < 12; i++) { // Early Deploy: motes rush inward
                    const a = i * Math.PI / 6;
                    spawnParticle({ kind: 'dot', color: '#00e5ff', x: ef.x + Math.cos(a) * 60, y: ef.y + Math.sin(a) * 60, vx: -Math.cos(a) * 200, vy: -Math.sin(a) * 200, size: 2, life: 0.3, drag: 0, grow: 0, spin: 0, rot: 0 });
                }
            }
            ctx.save();
            ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = 1;
            ctx.strokeStyle = `rgba(132, 255, 255, ${k})`; ctx.lineWidth = 3 * k + 0.5;
            ctx.beginPath(); ctx.arc(ef.x, ef.y, 15 + 40 * easeOut(p), 0, Math.PI * 2); ctx.stroke();
            ctx.restore();
            return true;
        }
        case 'blade_recall': { // Kensei Recall: the katana streaks back to the hand, trailing ghosts
            const ang = Math.atan2(ef.y2 - ef.y1, ef.x2 - ef.x1);
            ctx.save();
            ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = 1;
            const g = ctx.createLinearGradient(ef.x1, ef.y1, ef.x2, ef.y2);
            g.addColorStop(0, 'rgba(0, 229, 255, 0)'); g.addColorStop(1, `rgba(224, 255, 255, ${k})`);
            ctx.strokeStyle = g; ctx.lineWidth = 5 * k + 1; ctx.lineCap = 'round';
            ctx.beginPath(); ctx.moveTo(ef.x1, ef.y1); ctx.lineTo(ef.x2, ef.y2); ctx.stroke();
            for (let i = 1; i <= 4; i++) {
                const f = i / 5;
                ctx.save(); ctx.translate(lerp(ef.x1, ef.x2, f), lerp(ef.y1, ef.y2, f)); ctx.rotate(ang + Math.PI); ctx.translate(-60, 0);
                drawKatanaGhost('#84ffff', 0.35 * k * f);
                ctx.restore();
            }
            ctx.restore();
            return true;
        }
        case 'bark_form': { // Druid Feral Surge: bark plates close in around the druid
            if (!ef.burstDone) {
                ef.burstDone = true;
                burst(player.x, player.y, 0, Math.PI * 2, 6, { kind: 'leaf', color: '#7cb342', size: 6, life: 0.6, speed: [80, 160], drag: 3 });
            }
            ctx.save(); ctx.globalAlpha = 1;
            drawConvergingPlates(player.x, player.y, 70, player.radius + 12, p, 8, '#795548', Math.min(1, k * 3));
            ctx.restore();
            return true;
        }
        case 'dome_ripple': { // Paladin Chain of Retribution: a projectile breaking on the chain
            const r = 10 + 22 * easeOut(p);
            ctx.save();
            ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = 1;
            ctx.strokeStyle = `rgba(255, 213, 79, ${k})`; ctx.lineWidth = 1.5;
            strokeHoneycomb(ef.x, ef.y, r, 6, 0);
            ctx.strokeStyle = `rgba(255, 255, 255, ${k})`; ctx.lineWidth = 2;
            ctx.beginPath(); ctx.arc(ef.x, ef.y, r, 0, Math.PI * 2); ctx.stroke();
            ctx.restore();
            return true;
        }
    }
    return false;
}

// ==========================================
// Ground layer (drawn under enemies)
// ==========================================

// Nightblade Smoke Bomb: soft billowing puffs (green and bubbling with Toxic Fumes), with a faint edge marking the cover
function drawSmokeBomb(ef) {
    const age = ef.maxLife - ef.life, k = clamp01(ef.life / ef.maxLife);
    if (!ef.burstDone) {
        ef.burstDone = true;
        burst(ef.x, ef.y, 0, Math.PI * 2, 12, { kind: 'smoke', color: ef.poison ? '#689f38' : '#757575', size: 8, grow: 40, life: 0.7, speed: [100, 260], drag: 4 });
        burst(ef.x, ef.y, 0, Math.PI * 2, 8, { kind: 'spark', color: '#ffe082', size: 2, life: 0.2, speed: [200, 400], drag: 6 });
        addShake(1);
    }
    const alphaBase = Math.min(1, k * 1.5), pop = easeOut(Math.min(1, age * 4));
    const rgb = ef.poison ? '76, 175, 80' : '70, 70, 82';
    ctx.save();
    for (const pt of ef.particles || []) {
        const cx = ef.x + pt.xOffset * Math.cos(age * pt.rotSpeed * 0.5), cy = ef.y + pt.yOffset * Math.sin(age * pt.rotSpeed * 0.5);
        const r = Math.max(2, pt.r * pop + Math.sin(age * 2 + pt.startAng) * pt.r * 0.1);
        const g = ctx.createRadialGradient(cx, cy, 0, cx, cy, r);
        g.addColorStop(0, `rgba(${rgb}, ${0.5 * alphaBase})`); g.addColorStop(1, `rgba(${rgb}, 0)`);
        ctx.fillStyle = g; ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2); ctx.fill();
    }
    ctx.strokeStyle = `rgba(255, 255, 255, ${0.12 * alphaBase})`; ctx.lineWidth = 1.5; ctx.setLineDash([6, 8]);
    ctx.beginPath(); ctx.arc(ef.x, ef.y, ef.radius * pop, 0, Math.PI * 2); ctx.stroke();
    ctx.restore();
}

// Hallowed Ground and the Tesla Coil's field boundary (both are projectiles, but belong on the ground)
function drawGroundProjectiles() {
    for (const p of projectiles) {
        if (p.type === 'hallowed_ground') drawHallowedGround(p);
        else if (p.type === 'tesla_coil_trap') {
            ctx.save();
            ctx.strokeStyle = 'rgba(0, 229, 255, 0.28)'; ctx.lineWidth = 1.5;
            ctx.setLineDash([8, 10]); ctx.lineDashOffset = -fxTime * 30;
            ctx.beginPath(); ctx.arc(p.x, p.y, p.fieldRadius || 150, 0, Math.PI * 2); ctx.stroke();
            ctx.fillStyle = 'rgba(0, 229, 255, 0.04)'; ctx.fill();
            ctx.restore();
        }
    }
}

// Cleric Hallowed Ground: a consecrated circle of runes that pulses on every tick
// (holy: white-gold light; shadow: a dark violet desecration with writhing tendrils)
function drawHallowedGround(p) {
    const shadow = p.isShadow, holy = p.isHoly;
    const grow = easeOut(fxAge(p) / 0.35), fade = clamp01(p.life / 0.4), R = p.radius * grow;
    if (R < 1) return;
    const col = shadow ? '#9c27b0' : (holy ? '#fff59d' : '#fbc02d');
    ctx.save();
    ctx.globalAlpha = fade;
    ctx.translate(p.x, p.y);
    const g = ctx.createRadialGradient(0, 0, 0, 0, 0, R);
    if (shadow) { g.addColorStop(0, 'rgba(26, 0, 51, 0.45)'); g.addColorStop(1, 'rgba(156, 39, 176, 0.3)'); }
    else { g.addColorStop(0, withAlpha(col, 0.06)); g.addColorStop(1, withAlpha(col, 0.26)); }
    ctx.fillStyle = g; ctx.beginPath(); ctx.arc(0, 0, R, 0, Math.PI * 2); ctx.fill();
    // Tick pulse: a wave rolling out from the center every half second
    const tq = clamp01((p.tickTimer || 0) / 0.5);
    ctx.strokeStyle = withAlpha(shadow ? '#ce93d8' : '#ffffff', 0.5 * (1 - tq)); ctx.lineWidth = 3 * (1 - tq) + 0.5;
    ctx.beginPath(); ctx.arc(0, 0, R * tq, 0, Math.PI * 2); ctx.stroke();
    if (!shadow) ctx.globalCompositeOperation = 'lighter';
    ctx.shadowBlur = 8; ctx.shadowColor = col;
    ctx.strokeStyle = withAlpha(col, 0.85); ctx.lineWidth = 2.5;
    ctx.beginPath(); ctx.arc(0, 0, R, 0, Math.PI * 2); ctx.stroke();
    ctx.lineWidth = 1; ctx.beginPath(); ctx.arc(0, 0, R * 0.9, 0, Math.PI * 2); ctx.stroke();
    ctx.shadowBlur = 0;
    // Rune band
    ctx.save();
    ctx.rotate((shadow ? -1 : 1) * fxTime * 0.4);
    ctx.strokeStyle = withAlpha(shadow ? '#e1bee7' : '#fffde7', 0.75); ctx.lineWidth = 1.2;
    ctx.beginPath();
    const n = Math.max(6, Math.round(R / 14)), s = 3.5;
    for (let i = 0; i < n; i++) {
        const a = i * Math.PI * 2 / n, c = Math.cos(a), sn = Math.sin(a), x = c * R * 0.78, y = sn * R * 0.78;
        const pt = (u, v) => [x + c * u - sn * v, y + sn * u + c * v]; // rune-local → circle space
        if (i % 2) { ctx.moveTo(...pt(-s, 0)); ctx.lineTo(...pt(s, 0)); ctx.moveTo(...pt(0, -s)); ctx.lineTo(...pt(0, s)); }
        else { ctx.moveTo(...pt(-s, s)); ctx.lineTo(...pt(0, -s)); ctx.lineTo(...pt(s, s)); }
    }
    ctx.stroke();
    ctx.restore();
    // Center: a cross of light, or a void eye for the Desecration
    if (shadow) {
        ctx.fillStyle = 'rgba(13, 0, 26, 0.8)'; ctx.beginPath(); ctx.ellipse(0, 0, R * 0.18, R * 0.08, 0, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = '#ce93d8'; ctx.beginPath(); ctx.arc(0, 0, R * 0.04 + 1, 0, Math.PI * 2); ctx.fill();
        ctx.strokeStyle = 'rgba(74, 20, 140, 0.8)'; ctx.lineWidth = 2;
        for (let i = 0; i < 6; i++) { // tendrils curling in from the rim
            const a = i * Math.PI / 3 + Math.sin(fxTime * 2 + i) * 0.2;
            ctx.beginPath();
            for (let t = 0; t <= 1; t += 0.1) { const r = R * (0.95 - t * 0.6), w = Math.sin(t * 8 - fxTime * 6 + i) * 0.15; ctx.lineTo(Math.cos(a + w) * r, Math.sin(a + w) * r); }
            ctx.stroke();
        }
    } else {
        const c = R * 0.13;
        ctx.fillStyle = withAlpha(col, 0.7);
        ctx.fillRect(-c * 0.12, -c, c * 0.24, c * 2); ctx.fillRect(-c * 0.7, -c * 0.35, c * 1.4, c * 0.24);
    }
    ctx.restore();
}

// ==========================================
// Projectiles
// ==========================================

// Machinist Tesla Coil: a copper coil tower whose crown orb charges between discharges
function drawTeslaCoil(p) {
    const deploy = easeOut(fxAge(p) / 0.3), charge = clamp01(1 - (p.tickTimer || 0) / 0.5);
    ctx.save();
    ctx.translate(p.x, p.y);
    ctx.fillStyle = 'rgba(0, 0, 0, 0.35)'; ctx.beginPath(); ctx.ellipse(2, 5, 15, 9, 0, 0, Math.PI * 2); ctx.fill();
    ctx.scale(0.5 + 0.5 * deploy, 0.5 + 0.5 * deploy);
    ctx.beginPath(); for (let i = 0; i < 6; i++) { const a = i * Math.PI / 3; ctx.lineTo(Math.cos(a) * 11, Math.sin(a) * 11); } ctx.closePath();
    sprFill(ctx, '#263238');
    for (const [r, c] of [[8.5, '#bf6c2b'], [6.5, '#d4843c'], [4.5, '#e09a50']]) { // stacked copper windings
        ctx.beginPath(); ctx.arc(0, 0, r, 0, Math.PI * 2);
        ctx.strokeStyle = SPRITE_OUTLINE; ctx.lineWidth = 3; ctx.stroke();
        ctx.strokeStyle = c; ctx.lineWidth = 2; ctx.stroke();
    }
    ctx.shadowBlur = 8 + 14 * charge; ctx.shadowColor = '#00e5ff';
    sprEllipse(ctx, 0, 0, 2.6 + charge * 1.6, 2.6 + charge * 1.6, charge > 0.85 ? '#e0ffff' : '#00e5ff', false);
    ctx.shadowBlur = 0;
    ctx.strokeStyle = 'rgba(255, 152, 0, 0.6)'; ctx.lineWidth = 1.2; // remaining lifetime
    ctx.beginPath(); ctx.arc(0, 0, 14, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * Math.max(0, p.life / 8)); ctx.stroke();
    ctx.restore();
    if (Math.random() < 0.5) { // idle crackle off the crown
        const a = Math.random() * Math.PI * 2, r = 14 + Math.random() * 16;
        ctx.save();
        ctx.globalCompositeOperation = 'lighter'; ctx.strokeStyle = 'rgba(132, 255, 255, 0.8)'; ctx.lineWidth = 1;
        ctx.beginPath(); ctx.moveTo(p.x, p.y);
        ctx.lineTo(p.x + Math.cos(a + 0.4) * r * 0.5 + jitter(6), p.y + Math.sin(a + 0.4) * r * 0.5 + jitter(6));
        ctx.lineTo(p.x + Math.cos(a) * r, p.y + Math.sin(a) * r);
        ctx.stroke();
        ctx.restore();
    }
}

// Paladin Retribution Barrier bolt: a homing lance of light
function drawRetributionBolt(p) {
    ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(Math.atan2(p.vy, p.vx));
    ctx.globalCompositeOperation = 'lighter';
    const g = ctx.createLinearGradient(-30, 0, 0, 0);
    g.addColorStop(0, 'rgba(255, 213, 79, 0)'); g.addColorStop(1, 'rgba(255, 236, 179, 0.8)');
    ctx.strokeStyle = g; ctx.lineWidth = 4; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(-30, 0); ctx.lineTo(0, 0); ctx.stroke();
    ctx.shadowBlur = 12; ctx.shadowColor = '#ffd54f';
    ctx.fillStyle = '#fffde7';
    ctx.beginPath(); ctx.moveTo(12, 0); ctx.lineTo(0, -3.5); ctx.lineTo(-8, 0); ctx.lineTo(0, 3.5); ctx.closePath(); ctx.fill();
    ctx.restore();
}

// ==========================================
// Enemy status overlays
// ==========================================

// Ice casing (frozen), crackling arcs (shocked), a shackle ring (rooted), circling stars (stunned), a cracked amber ring (Sundered)
function drawEnemyStatus(e) {
    const r = e.size / 2;
    if (e.frozenTimer > 0) {
        ctx.save();
        ctx.beginPath(); for (let i = 0; i < 6; i++) { const a = i * Math.PI / 3 + 0.3; ctx.lineTo(e.x + Math.cos(a) * (r + 5), e.y + Math.sin(a) * (r + 5)); } ctx.closePath();
        ctx.fillStyle = 'rgba(179, 229, 252, 0.4)'; ctx.fill();
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.85)'; ctx.lineWidth = 1.5; ctx.stroke();
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.5)'; ctx.lineWidth = 1;
        ctx.beginPath(); ctx.moveTo(e.x - r * 0.6, e.y - r * 0.2); ctx.lineTo(e.x - r * 0.1, e.y - r * 0.7); ctx.moveTo(e.x + r * 0.2, e.y + r * 0.6); ctx.lineTo(e.x + r * 0.7, e.y + r * 0.1); ctx.stroke();
        ctx.restore();
    }
    if (e.shockTimer > 0 && Math.random() < 0.7) {
        ctx.save();
        ctx.globalCompositeOperation = 'lighter'; ctx.strokeStyle = 'rgba(132, 255, 255, 0.9)'; ctx.lineWidth = 1.2;
        for (let i = 0; i < 2; i++) {
            const a = Math.random() * Math.PI * 2;
            ctx.beginPath(); ctx.moveTo(e.x + Math.cos(a) * r * 0.3, e.y + Math.sin(a) * r * 0.3);
            ctx.lineTo(e.x + Math.cos(a + 0.5) * r * 0.8 + jitter(6), e.y + Math.sin(a + 0.5) * r * 0.8 + jitter(6));
            ctx.lineTo(e.x + Math.cos(a + 0.2) * (r + 6), e.y + Math.sin(a + 0.2) * (r + 6));
            ctx.stroke();
        }
        ctx.restore();
    }
    if (e.rootedTimer > 0 && !(e.netTimer > 0)) { // (a netted enemy shows the net instead)
        ctx.save();
        ctx.strokeStyle = 'rgba(176, 190, 197, 0.9)'; ctx.lineWidth = 2; ctx.setLineDash([4, 3]);
        ctx.beginPath(); ctx.ellipse(e.x, e.y + r * 0.6, r + 6, (r + 6) * 0.45, 0, 0, Math.PI * 2); ctx.stroke();
        ctx.restore();
    }
    if (e.huntMarkUntil > fxTime) { // skills.js Hunter's Mark: a green reticle over the prey, its ticks closing in as the Mark runs out
        const left = clamp01((e.huntMarkUntil - fxTime) / MARK_TIME), R = r + 9 + 6 * left, y = e.y - r - 14;
        ctx.save(); ctx.strokeStyle = 'rgba(178, 255, 89, 0.9)'; ctx.lineWidth = 2;
        ctx.beginPath(); ctx.arc(e.x, e.y, R, 0, Math.PI * 2); ctx.stroke();
        for (let i = 0; i < 4; i++) { const a = i * Math.PI / 2 + fxTime * 0.6; ctx.beginPath(); ctx.moveTo(e.x + Math.cos(a) * (R - 5), e.y + Math.sin(a) * (R - 5)); ctx.lineTo(e.x + Math.cos(a) * (R + 6), e.y + Math.sin(a) * (R + 6)); ctx.stroke(); }
        ctx.fillStyle = '#b2ff59'; ctx.beginPath(); ctx.moveTo(e.x, y + 6); ctx.lineTo(e.x - 5, y - 2); ctx.lineTo(e.x + 5, y - 2); ctx.closePath(); ctx.fill(); // a marker over its head
        ctx.restore();
    }
    if (e.sunderUntil > fxTime) { // skills.js Sundering Breath: a ring of amber shards with gaps, slowly turning, fading as it runs out
        ctx.save();
        ctx.globalAlpha = Math.min(1, (e.sunderUntil - fxTime) / 1.5) * 0.85; ctx.strokeStyle = '#ffab40'; ctx.lineWidth = 2.5; ctx.lineCap = 'round';
        for (let i = 0; i < 4; i++) { const a = fxTime * 0.8 + i * Math.PI / 2; ctx.beginPath(); ctx.arc(e.x, e.y, r + 7, a, a + 1.05); ctx.stroke(); }
        ctx.restore();
    }
    if (e.stunTimer > 0 && !e.type.startsWith('boss')) {
        for (let i = 0; i < 3; i++) {
            const a = fxTime * 5 + i * Math.PI * 2 / 3;
            sprStar(ctx, e.x + Math.cos(a) * (r + 4), e.y - r - 6 + Math.sin(a) * 4, 3.5, '#ffeb3b');
        }
    }
}

// ==========================================
// Continuous emitters (game time)
// ==========================================

function updateESkillEmitters(dt) {
    // Speed boosts (Nature's Stride, Adrenaline Surge, ...) leave wind streaks behind the moving player
    if (buffs.msBoost > 0 && Math.hypot(spriteAnim.vx, spriteAnim.vy) > 60) {
        const col = selectedClassId === 'ranger' ? '#c5e1a5' : selectedClassId === 'dragonknight' ? '#ff8a65' : '#e0f7fa';
        emit(30, dt, () => spawnParticle({ kind: 'spark', color: col, x: player.x + jitter(24), y: player.y + jitter(24), vx: -spriteAnim.vx * 0.9, vy: -spriteAnim.vy * 0.9, size: 1.5, life: 0.25, drag: 4, grow: 0, spin: 0, rot: 0 }));
    }
    for (const ef of effects) {
        if (ef.type === 'smoke_bomb' && ef.poison) { // Toxic Fumes: bubbles rising out of the cloud
            emit(10, dt, () => { const a = Math.random() * Math.PI * 2, r = Math.random() * ef.radius * 0.8; spawnParticle({ kind: 'ring', color: '#9ccc65', x: ef.x + Math.cos(a) * r, y: ef.y + Math.sin(a) * r, vx: 0, vy: -20, size: 2, grow: 4, life: 0.6, drag: 0, spin: 0, rot: 0 }); });
        }
    }
    for (const p of projectiles) {
        if (p.type !== 'hallowed_ground') continue;
        const shadow = p.isShadow;
        emit(p.radius / 12, dt, () => { const a = Math.random() * Math.PI * 2, r = Math.random() * p.radius; spawnParticle({ kind: shadow ? 'smoke' : 'dot', color: shadow ? '#7b1fa2' : '#fff9c4', x: p.x + Math.cos(a) * r, y: p.y + Math.sin(a) * r, vx: jitter(10), vy: -25, size: shadow ? 3 : 1.5, grow: shadow ? 6 : 0, life: 0.8, drag: 0.5, spin: 0, rot: 0 }); });
    }
    // Paladin Divine Tether: healing light rising around the Paladin while the chain holds something
    if (player.tether && player.tether.healing) {
        emit(6, dt, () => spawnParticle({ kind: 'dot', color: '#c8e6c9', x: player.x + jitter(30), y: player.y + jitter(20), vx: 0, vy: -40, size: 1.6, life: 0.6, drag: 0.5, grow: 0, spin: 0, rot: 0 }));
    }
}
