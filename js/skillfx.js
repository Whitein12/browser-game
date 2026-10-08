// ==========================================
// skillfx.js - Visuals for the class Q abilities (E abilities: skillfx_e.js)
// ==========================================
// Hooks: drawSkillProjectile (weapons.js), drawSkillEffect / drawSkillGround / drawShieldCatch (main.js draw),
// (each also consults skillfx_e.js (E), skillfx_space.js (Space), skillfx_ult.js (R) and skillfx_rmb.js (weapon abilities))
// updateSkillEmitters (fx.js), onParry (combat.js). Each draw hook returns true when it handled the object.

// Age of a projectile/effect in game time, stamped the first time it is seen
function fxAge(o) { if (o.bornAt === undefined) o.bornAt = fxTime; return fxTime - o.bornAt; }

function withAlpha(hex, a) {
    const n = parseInt(hex.slice(1), 16);
    return `rgba(${n >> 16}, ${(n >> 8) & 255}, ${n & 255}, ${a})`;
}

// ==========================================
// Projectiles
// ==========================================

function drawSkillProjectile(p) {
    if (drawSpaceProjectile(p) || drawUltProjectile(p) || drawRmbProjectile(p)) return true; // skillfx_space.js, skillfx_ult.js, skillfx_rmb.js
    if (p.type === 'hallowed_ground') return true; // drawn on the ground layer (drawGroundProjectiles)
    if (p.type === 'tesla_coil_trap') { drawTeslaCoil(p); return true; }
    if (p.isRetribution) { drawRetributionBolt(p); return true; }
    const ang = Math.atan2(p.vy, p.vx);
    const upg = p.sourceSkill && p.sourceSkill.selectedUpg;

    // Dragonknight: Shield Throw
    if (p.type === 'shield_throw') {
        const glow = upg === 'A' ? '#ff6d00' : upg === 'B' ? '#4fc3f7' : (p.returning ? '#ffffff' : null);
        const spin = fxTime * 22;
        ctx.save();
        ctx.globalCompositeOperation = 'lighter';
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.35)'; ctx.lineWidth = 2;
        for (let k = 0; k < 2; k++) { ctx.beginPath(); ctx.arc(p.x, p.y, 19, spin + k * Math.PI, spin + k * Math.PI + 1.2); ctx.stroke(); }
        ctx.restore();
        drawDragonShield(p.x, p.y, spin, 1, glow);
        return true;
    }

    // Spellweaver: Fireball (the Q version carries its skill; basic attack fireballs don't)
    if (p.type === 'fireball' && p.sourceSkill && selectedClassId === 'spellweaver') {
        const r = p.radius;
        ctx.save(); ctx.translate(p.x, p.y);
        const halo = ctx.createRadialGradient(0, 0, r * 0.5, 0, 0, r * 2.8);
        halo.addColorStop(0, 'rgba(255, 112, 67, 0.45)'); halo.addColorStop(1, 'rgba(255, 87, 34, 0)');
        ctx.fillStyle = halo; ctx.beginPath(); ctx.arc(0, 0, r * 2.8, 0, Math.PI * 2); ctx.fill();
        ctx.rotate(ang);
        if (upg === 'A') { // Velocity: speed lines
            ctx.strokeStyle = 'rgba(255, 255, 255, 0.45)'; ctx.lineWidth = 1.5;
            ctx.beginPath(); for (const y of [-r * 0.9, 0, r * 0.9]) { ctx.moveTo(-r * 2, y); ctx.lineTo(-r * 4.5, y); } ctx.stroke();
        }
        ['#bf360c', '#ff7043', '#ffca28'].forEach((col, i) => {
            const w = r * (1 - i * 0.22), len = r * (3.2 - i * 0.8) + Math.sin(fxTime * 30 + i) * r * 0.3;
            ctx.fillStyle = col;
            ctx.beginPath(); ctx.arc(0, 0, w, -Math.PI / 2, Math.PI / 2);
            ctx.quadraticCurveTo(-len * 0.5, w, -len, Math.sin(fxTime * 20 + i * 2) * r * 0.35);
            ctx.quadraticCurveTo(-len * 0.5, -w, 0, -w);
            ctx.fill();
        });
        ctx.shadowBlur = 16; ctx.shadowColor = '#ffeb3b';
        sprEllipse(ctx, r * 0.15, 0, r * 0.45, r * 0.45, '#fffde7', false);
        ctx.restore();
        return true;
    }

    // Ranger: Ricochet Shot (its trail traces the bounce path)
    if (p.type === 'ricochet') {
        const trailColor = upg === 'B' ? '#ff5252' : '#ffee58';
        p.trail = p.trail || [];
        p.trail.push({ x: p.x, y: p.y });
        if (p.trail.length > 14) p.trail.shift();
        if (p.lastAng !== undefined && Math.abs(Math.atan2(Math.sin(ang - p.lastAng), Math.cos(ang - p.lastAng))) > 0.3) { // bounced
            spawnParticle({ kind: 'ring', color: trailColor, x: p.x, y: p.y, vx: 0, vy: 0, size: 4, grow: 120, life: 0.2, drag: 0, spin: 0, rot: 0 });
            burst(p.x, p.y, ang, 1.6, 6, { kind: 'spark', color: trailColor, size: 2, life: 0.2, speed: [150, 320] });
        }
        p.lastAng = ang;
        ctx.save();
        ctx.globalCompositeOperation = 'lighter'; ctx.lineCap = 'round'; ctx.strokeStyle = trailColor;
        for (let i = 1; i < p.trail.length; i++) {
            ctx.globalAlpha = (i / p.trail.length) * 0.85; ctx.lineWidth = 1.5 + 3 * (i / p.trail.length);
            ctx.beginPath(); ctx.moveTo(p.trail[i - 1].x, p.trail[i - 1].y); ctx.lineTo(p.trail[i].x, p.trail[i].y); ctx.stroke();
        }
        ctx.restore();
        ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(ang);
        ctx.strokeStyle = '#a1887f'; ctx.lineWidth = 1.8;
        ctx.beginPath(); ctx.moveTo(-13, 0); ctx.lineTo(8, 0); ctx.stroke();
        ctx.shadowBlur = 12; ctx.shadowColor = trailColor;
        ctx.fillStyle = upg === 'B' ? '#ff8a80' : '#fff59d';
        ctx.beginPath(); ctx.moveTo(15, 0); ctx.lineTo(6, -3.6); ctx.lineTo(6, 3.6); ctx.closePath(); ctx.fill();
        if (upg === 'B') { ctx.beginPath(); for (const s of [-1, 1]) { ctx.moveTo(6, s * 1.5); ctx.lineTo(1, s * 4.5); ctx.lineTo(4, s * 1); } ctx.fill(); } // barbs
        ctx.shadowBlur = 0;
        ctx.fillStyle = '#ffca28';
        ctx.beginPath(); ctx.moveTo(-7, 0); ctx.lineTo(-12, -3.5); ctx.lineTo(-15, -3.5); ctx.lineTo(-11, 0); ctx.lineTo(-15, 3.5); ctx.lineTo(-12, 3.5); ctx.closePath(); ctx.fill();
        ctx.restore();
        return true;
    }

    // Nightblade: Fan of Knives (returning blades spin on the way back)
    if (p.source === 'fan_of_knives') {
        const back = p.returning, glow = back ? '#ea80fc' : (p.pierce ? '#f3e5f5' : '#ab47bc');
        ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(ang);
        ctx.globalCompositeOperation = 'lighter';
        const streak = ctx.createLinearGradient(-28, 0, 0, 0);
        streak.addColorStop(0, withAlpha('#9c27b0', 0)); streak.addColorStop(1, glow);
        ctx.strokeStyle = streak; ctx.lineWidth = 2.5;
        ctx.beginPath(); ctx.moveTo(-28, 0); ctx.lineTo(0, 0); ctx.stroke();
        ctx.globalCompositeOperation = 'source-over';
        if (back) ctx.rotate(fxTime * 25);
        const s = p.pierce ? 1.25 : 1;
        ctx.scale(s, s);
        ctx.shadowBlur = 8; ctx.shadowColor = glow;
        const steel = ctx.createLinearGradient(0, -2.6, 0, 2.6);
        steel.addColorStop(0, '#ffffff'); steel.addColorStop(1, '#78909c');
        ctx.beginPath(); ctx.moveTo(10, 0); ctx.lineTo(2, -2.6); ctx.lineTo(-1, 0); ctx.lineTo(2, 2.6); ctx.closePath();
        sprFill(ctx, steel);
        ctx.shadowBlur = 0;
        ctx.strokeStyle = '#4a148c'; ctx.lineWidth = 2;
        ctx.beginPath(); ctx.moveTo(-1, 0); ctx.lineTo(-7, 0); ctx.stroke();
        ctx.strokeStyle = '#ce93d8'; ctx.lineWidth = 1;
        ctx.beginPath(); ctx.arc(-9, 0, 2, 0, Math.PI * 2); ctx.stroke();
        ctx.restore();
        return true;
    }

    // Machinist: Sentry Turret
    if (p.type === 'turret') { drawTurret(p); return true; }

    // Druid: Bramble Core (a thorny seed)
    if (p.type === 'bramble_core') {
        ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(fxTime * 6);
        ctx.fillStyle = '#33691e';
        for (let i = 0; i < 8; i++) {
            const a = i * Math.PI / 4;
            ctx.beginPath();
            ctx.moveTo(Math.cos(a - 0.25) * 7, Math.sin(a - 0.25) * 7); ctx.lineTo(Math.cos(a) * 13, Math.sin(a) * 13); ctx.lineTo(Math.cos(a + 0.25) * 7, Math.sin(a + 0.25) * 7);
            ctx.closePath(); ctx.fill();
        }
        const g = ctx.createRadialGradient(-2, -2, 1, 0, 0, 8);
        g.addColorStop(0, '#c5e1a5'); g.addColorStop(0.6, '#7cb342'); g.addColorStop(1, '#33691e');
        sprEllipse(ctx, 0, 0, 8, 8, g);
        sprLeaf(ctx, 4, -4, -0.8, 7, '#8bc34a');
        sprLeaf(ctx, -4, 4, 2.3, 6, '#689f38');
        ctx.restore();
        return true;
    }
    return false;
}

function drawDragonShield(x, y, rot, scale, glow) {
    ctx.save();
    ctx.translate(x, y); ctx.rotate(rot); ctx.scale(scale, scale);
    if (glow) { ctx.shadowBlur = 14; ctx.shadowColor = glow; }
    sprEllipse(ctx, 0, 0, 14, 14, '#9e9e9e');
    ctx.shadowBlur = 0;
    sprEllipse(ctx, 0, 0, 11, 11, '#c62828', false);
    ctx.fillStyle = '#ffca28'; // dragon-wing chevron
    ctx.beginPath(); ctx.moveTo(-7.5, -4); ctx.lineTo(0, 2); ctx.lineTo(7.5, -4); ctx.lineTo(7.5, 0.5); ctx.lineTo(0, 7); ctx.lineTo(-7.5, 0.5); ctx.closePath(); ctx.fill();
    sprEllipse(ctx, 0, -5.5, 2, 2, '#ffe082', false);
    ctx.fillStyle = '#eeeeee';
    for (let i = 0; i < 8; i++) { const a = i * Math.PI / 4; ctx.beginPath(); ctx.arc(Math.cos(a) * 12.5, Math.sin(a) * 12.5, 0.9, 0, Math.PI * 2); ctx.fill(); }
    ctx.restore();
}

// The Shield Throw lands where it returned to: a shield on the ground, pulsing to be picked up
function drawShieldCatch(d) {
    const aegis = d.skill && d.skill.selectedUpg === 'B';
    const color = aegis ? '#4fc3f7' : '#cfd8dc';
    const blink = d.life < 1.5 && Math.sin(fxTime * 20) < 0;
    const pulse = 0.5 + 0.5 * Math.sin(fxTime * 5);
    ctx.save();
    ctx.globalAlpha = blink ? 0.35 : 1;
    ctx.strokeStyle = color; ctx.lineWidth = 2;
    ctx.globalAlpha *= 0.4 + 0.4 * pulse;
    ctx.beginPath(); ctx.arc(d.x, d.y, 20 + pulse * 4, 0, Math.PI * 2); ctx.stroke();
    ctx.globalAlpha = blink ? 0.35 : 1;
    drawDragonShield(d.x, d.y + Math.sin(fxTime * 3) * 1.5, 0.3, 0.85, color);
    ctx.restore();
}

// Machinist Sentry Turret: unfolds on deploy, tracks targets, flashes when it fires
function drawTurret(p) {
    const age = fxAge(p), deploy = easeOut(age / 0.35);
    if (!p.deployFx) {
        p.deployFx = true;
        burst(p.x, p.y, 0, Math.PI * 2, 6, { kind: 'smoke', color: '#9e9e9e', size: 4, grow: 20, life: 0.5, speed: [30, 90], drag: 3 });
        spawnParticle({ kind: 'ring', color: '#ffb74d', x: p.x, y: p.y, vx: 0, vy: 0, size: 6, grow: 80, life: 0.25, drag: 0, spin: 0, rot: 0 });
    }
    if (p.prevAtk !== undefined && p.attackTimer > p.prevAtk + 0.05) p.flashAt = fxTime; // the timer resets when it fires
    p.prevAtk = p.attackTimer;
    const sinceShot = fxTime - (p.flashAt === undefined ? -10 : p.flashAt);
    const oc = buffs.overclockTimer > 0;

    ctx.save();
    ctx.translate(p.x, p.y);
    ctx.fillStyle = 'rgba(0, 0, 0, 0.35)';
    ctx.beginPath(); ctx.ellipse(2, 5, 17, 11, 0, 0, Math.PI * 2); ctx.fill();
    // Tripod legs
    for (let i = 0; i < 3; i++) {
        const a = Math.PI / 6 + i * Math.PI * 2 / 3, len = 17 * deploy;
        sprStroke(ctx, '#37474f', 2.5, () => { ctx.moveTo(0, 0); ctx.lineTo(Math.cos(a) * len, Math.sin(a) * len); });
        sprEllipse(ctx, Math.cos(a) * len, Math.sin(a) * len, 2.5, 2.5, '#263238');
    }
    ctx.scale(0.6 + 0.4 * deploy, 0.6 + 0.4 * deploy);
    // Base plate (hazard striped when Volatile)
    ctx.beginPath(); for (let i = 0; i < 6; i++) { const a = i * Math.PI / 3; ctx.lineTo(Math.cos(a) * 10, Math.sin(a) * 10); } ctx.closePath();
    sprFill(ctx, p.volatile ? '#fbc02d' : '#546e7a');
    if (p.volatile) {
        ctx.save(); ctx.clip();
        ctx.strokeStyle = '#212121'; ctx.lineWidth = 2.5;
        ctx.beginPath(); for (let x = -14; x < 14; x += 6) { ctx.moveTo(x, -12); ctx.lineTo(x + 12, 12); } ctx.stroke();
        ctx.restore();
    }
    // Remaining lifetime
    ctx.strokeStyle = 'rgba(255, 152, 0, 0.7)'; ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.arc(0, 0, 13, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * Math.max(0, p.life / 10)); ctx.stroke();
    // Rotating head
    ctx.rotate(p.angle);
    const recoil = sinceShot < 0.08 ? -3 * (1 - sinceShot / 0.08) : 0;
    if (p.isLaser) {
        ctx.beginPath(); ctx.rect(2 + recoil, -2, 16, 4); sprFill(ctx, '#455a64');
        const charge = clamp01(1 - p.attackTimer / 1.0);
        ctx.shadowBlur = 6 + 12 * charge; ctx.shadowColor = '#ff3d00';
        sprEllipse(ctx, 18 + recoil, 0, 2.2 + charge, 2.2 + charge, charge > 0.9 ? '#ffe0b2' : '#ff6d00', false);
        ctx.shadowBlur = 0;
    } else {
        ctx.beginPath(); ctx.rect(4 + recoil, -3.2, 14, 2.4); sprFill(ctx, '#78909c');
        ctx.beginPath(); ctx.rect(4 + recoil, 0.8, 14, 2.4); sprFill(ctx, '#78909c');
    }
    if (oc) { ctx.shadowBlur = 12; ctx.shadowColor = '#ff9800'; }
    ctx.beginPath(); ctx.rect(-6, -6, 12, 12); sprFill(ctx, '#ff9800');
    ctx.shadowBlur = 0;
    ctx.fillStyle = '#263238'; ctx.fillRect(1, -4.5, 3, 9); // visor
    ctx.fillStyle = '#80deea'; ctx.fillRect(2, -3.5, 1.2, 2);
    if (!p.isLaser && sinceShot < 0.06) {
        ctx.globalCompositeOperation = 'lighter';
        sprStar(ctx, 21, 0, 8 * (1 - sinceShot / 0.06), '#ffca28');
        ctx.globalCompositeOperation = 'source-over';
    }
    ctx.restore();
    // Volatile: warning light that blinks faster as the fuse runs down
    if (p.volatile && Math.sin(fxTime * (6 + (10 - p.life) * 2.5)) > 0) {
        ctx.save();
        ctx.shadowBlur = 12; ctx.shadowColor = '#ff1744';
        sprEllipse(ctx, p.x, p.y - 2, 2.2, 2.2, '#ff5252', false);
        ctx.restore();
    }
}

// ==========================================
// Ground effects (drawn under everything)
// ==========================================

function drawSkillGround(ef) {
    if (drawSpaceGround(ef) || drawUltGround(ef)) return true; // skillfx_space.js, skillfx_ult.js
    if (ef.type === 'smoke_bomb') { drawSmokeBomb(ef); return true; }
    if (ef.type === 'fire_puddle') { // Scorched Earth: flickering flame tongues over a glowing patch
        const k = clamp01(ef.life / ef.maxLife);
        if (!ef.tongues) ef.tongues = Array.from({ length: 10 }, () => { const a = Math.random() * Math.PI * 2, r = Math.sqrt(Math.random()) * ef.radius * 0.8; return { x: Math.cos(a) * r, y: Math.sin(a) * r, s: 0.7 + Math.random() * 0.6 }; });
        ctx.save();
        const g = ctx.createRadialGradient(ef.x, ef.y, 0, ef.x, ef.y, ef.radius);
        g.addColorStop(0, `rgba(255, 112, 67, ${0.5 * k})`); g.addColorStop(1, 'rgba(191, 54, 12, 0)');
        ctx.fillStyle = g; ctx.beginPath(); ctx.arc(ef.x, ef.y, ef.radius, 0, Math.PI * 2); ctx.fill();
        ctx.globalCompositeOperation = 'lighter';
        ef.tongues.forEach((t, i) => {
            const h = (16 + Math.sin(fxTime * 20 + i * 1.7) * 6) * t.s * (0.4 + 0.6 * k), w = 6 * t.s;
            ctx.fillStyle = i % 2 ? `rgba(255, 152, 0, ${0.8 * k})` : `rgba(255, 202, 40, ${0.8 * k})`;
            ctx.beginPath(); ctx.moveTo(ef.x + t.x - w, ef.y + t.y);
            ctx.quadraticCurveTo(ef.x + t.x - w * 0.5, ef.y + t.y - h * 0.6, ef.x + t.x + Math.sin(fxTime * 9 + i) * 2, ef.y + t.y - h);
            ctx.quadraticCurveTo(ef.x + t.x + w * 0.5, ef.y + t.y - h * 0.6, ef.x + t.x + w, ef.y + t.y);
            ctx.closePath(); ctx.fill();
        });
        ctx.restore();
        return true;
    }
    if (ef.type === 'thorn_patch') { // Bramble Core: thorny vines that grow in, then wither
        if (!ef.vines) {
            ef.vines = Array.from({ length: ef.radius > 60 ? 7 : 5 }, () => {
                const a0 = Math.random() * Math.PI * 2, a1 = a0 + (Math.random() < 0.5 ? -1 : 1) * (1 + Math.random() * 1.5);
                const r0 = Math.random() * ef.radius * 0.3, r1 = ef.radius * (0.75 + Math.random() * 0.25);
                return { x0: Math.cos(a0) * r0, y0: Math.sin(a0) * r0, x1: Math.cos(a1) * r1, y1: Math.sin(a1) * r1,
                         cx: Math.cos((a0 + a1) / 2) * ef.radius * 0.9, cy: Math.sin((a0 + a1) / 2) * ef.radius * 0.9 };
            });
        }
        const grow = easeOut((ef.maxLife - ef.life) / 0.35), fade = clamp01(ef.life / 0.5), flowers = ef.slow > 0;
        ctx.save();
        ctx.translate(ef.x, ef.y);
        ctx.globalAlpha = fade;
        const g = ctx.createRadialGradient(0, 0, 0, 0, 0, ef.radius);
        g.addColorStop(0, 'rgba(51, 105, 30, 0.4)'); g.addColorStop(1, 'rgba(51, 105, 30, 0.05)');
        ctx.fillStyle = g; ctx.beginPath(); ctx.arc(0, 0, ef.radius * grow, 0, Math.PI * 2); ctx.fill();
        ctx.strokeStyle = 'rgba(139, 195, 74, 0.35)'; ctx.lineWidth = 1; ctx.setLineDash([4, 6]);
        ctx.beginPath(); ctx.arc(0, 0, ef.radius, 0, Math.PI * 2); ctx.stroke(); ctx.setLineDash([]);
        const qp = (v, t) => { const u = 1 - t; return [u * u * v.x0 + 2 * u * t * v.cx + t * t * v.x1, u * u * v.y0 + 2 * u * t * v.cy + t * t * v.y1]; };
        for (const v of ef.vines) {
            const N = 14, end = Math.max(1, Math.round(N * grow));
            sprStroke(ctx, '#558b2f', 2.5, () => { for (let i = 0; i <= end; i++) ctx.lineTo(...qp(v, i / N)); });
            ctx.fillStyle = '#c5e1a5';
            for (let i = 1; i < end; i++) { // thorns on alternating sides
                const [x, y] = qp(v, i / N), [nx, ny] = qp(v, (i + 1) / N), a = Math.atan2(ny - y, nx - x) + (i % 2 ? 1 : -1) * Math.PI / 2;
                ctx.beginPath(); ctx.moveTo(x + Math.cos(a + 1.3) * 1.5, y + Math.sin(a + 1.3) * 1.5); ctx.lineTo(x + Math.cos(a) * 4.5, y + Math.sin(a) * 4.5); ctx.lineTo(x + Math.cos(a - 1.3) * 1.5, y + Math.sin(a - 1.3) * 1.5); ctx.fill();
            }
            if (grow >= 1) {
                const [ex, ey] = qp(v, 1);
                if (flowers) sprStar(ctx, ex, ey, 3.5, '#f48fb1');
                else sprLeaf(ctx, ex, ey, Math.atan2(ey, ex), 6, '#7cb342');
            }
        }
        ctx.restore();
        return true;
    }
    return false;
}

// ==========================================
// Effects (main effects pass; returns true when drawn)
// ==========================================

function drawSkillEffect(ef) {
    const k = clamp01(ef.life / ef.maxLife), p = 1 - k;
    if (drawESkillEffect(ef, p, k) || drawSpaceEffect(ef, p, k) || drawUltEffect(ef, p, k) || drawRmbEffect(ef, p, k)) return true;
    switch (ef.type) {
        case 'fiery_explosion': { // fireballs, Meteor, volatile turrets
            if (!ef.burstDone) {
                ef.burstDone = true;
                burst(ef.x, ef.y, 0, Math.PI * 2, Math.round(8 + ef.radius / 10), { kind: 'spark', color: '#ffab40', size: 2.5, life: 0.35, speed: [ef.radius * 2, ef.radius * 4], drag: 5 });
                burst(ef.x, ef.y, 0, Math.PI * 2, 5, { kind: 'smoke', color: '#424242', size: ef.radius * 0.12, grow: ef.radius * 0.3, life: 0.6, speed: [20, 80], drag: 3 });
                addShake(ef.radius >= 120 ? 4 : 1.5);
            }
            ctx.save();
            ctx.globalAlpha = 1;
            const R = ef.radius * easeOut(Math.min(1, p * 1.8));
            const g = ctx.createRadialGradient(ef.x, ef.y, 0, ef.x, ef.y, Math.max(1, R));
            g.addColorStop(0, `rgba(255, 255, 255, ${k})`); g.addColorStop(0.25, `rgba(255, 235, 59, ${k})`);
            g.addColorStop(0.6, `rgba(255, 111, 0, ${0.9 * k})`); g.addColorStop(1, 'rgba(183, 28, 28, 0)');
            ctx.fillStyle = g; ctx.beginPath(); ctx.arc(ef.x, ef.y, Math.max(1, R), 0, Math.PI * 2); ctx.fill();
            ctx.strokeStyle = `rgba(255, 204, 128, ${k})`; ctx.lineWidth = 3 * k + 0.5;
            ctx.beginPath(); ctx.arc(ef.x, ef.y, ef.radius * easeOut(p) * 1.1, 0, Math.PI * 2); ctx.stroke();
            ctx.restore();
            return true;
        }
        case 'sparkle_poof': { // generic magical hit puff: a turning 4-point star and expanding motes
            const r = ef.radius || 14;
            ctx.save();
            ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = k;
            ctx.translate(ef.x, ef.y); ctx.rotate(p * 2);
            ctx.fillStyle = ef.color || '#ffffff';
            ctx.beginPath();
            for (let i = 0; i < 8; i++) { const a = i * Math.PI / 4, rr = i % 2 ? 2.5 : 11 * (1 - p * 0.5); ctx.lineTo(Math.cos(a) * rr, Math.sin(a) * rr); }
            ctx.closePath(); ctx.fill();
            for (let i = 0; i < 6; i++) { const a = i * Math.PI / 3; ctx.beginPath(); ctx.arc(Math.cos(a) * r * (0.4 + p), Math.sin(a) * r * (0.4 + p), 2.5 * k + 0.5, 0, Math.PI * 2); ctx.fill(); }
            ctx.fillStyle = '#ffffff'; ctx.beginPath(); ctx.arc(0, 0, 2.5 * k, 0, Math.PI * 2); ctx.fill();
            ctx.restore();
            return true;
        }
        case 'shield_blast': { // Dragonknight Explosive Impact
            if (!ef.burstDone) {
                ef.burstDone = true;
                burst(ef.x, ef.y, 0, Math.PI * 2, 12, { kind: 'spark', color: '#ff9e40', size: 2.5, life: 0.3, speed: [160, 380], drag: 5 });
                addShake(2);
            }
            ctx.save();
            ctx.globalAlpha = 1;
            const g = ctx.createRadialGradient(ef.x, ef.y, 0, ef.x, ef.y, ef.radius);
            g.addColorStop(0, `rgba(255, 245, 230, ${0.8 * k})`); g.addColorStop(0.5, `rgba(255, 109, 0, ${0.5 * k})`); g.addColorStop(1, 'rgba(255, 61, 0, 0)');
            ctx.fillStyle = g; ctx.beginPath(); ctx.arc(ef.x, ef.y, ef.radius * easeOut(p * 1.5), 0, Math.PI * 2); ctx.fill();
            ctx.strokeStyle = `rgba(255, 204, 128, ${k})`; ctx.lineWidth = 4 * k;
            ctx.beginPath(); ctx.arc(ef.x, ef.y, ef.radius * easeOut(p), 0, Math.PI * 2); ctx.stroke();
            ctx.restore();
            return true;
        }
        case 'knife_fan': { // Nightblade Fan of Knives cast flash
            ctx.save();
            ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = k;
            ctx.fillStyle = '#ab47bc';
            drawCrescent(ef.x, ef.y, 30 + 30 * p, ef.angle - 0.55, ef.angle + 0.55, 10 * k + 2); ctx.fill();
            ctx.strokeStyle = '#f3e5f5'; ctx.lineWidth = 1.5;
            ctx.beginPath();
            for (let i = 0; i < 5; i++) { const a = ef.angle - 0.4 + i * 0.2; ctx.moveTo(ef.x + Math.cos(a) * 20, ef.y + Math.sin(a) * 20); ctx.lineTo(ef.x + Math.cos(a) * (40 + 30 * p), ef.y + Math.sin(a) * (40 + 30 * p)); }
            ctx.stroke();
            ctx.restore();
            return true;
        }
        case 'laser_beam': { // Machinist turret Laser Optics
            ctx.save();
            ctx.globalCompositeOperation = 'lighter'; ctx.lineCap = 'round';
            ctx.globalAlpha = 0.45 * k; ctx.strokeStyle = '#ff6d00'; ctx.lineWidth = 9 * k + 2;
            ctx.beginPath(); ctx.moveTo(ef.x1, ef.y1); ctx.lineTo(ef.x2, ef.y2); ctx.stroke();
            ctx.globalAlpha = k; ctx.strokeStyle = '#ffe0b2'; ctx.lineWidth = 2.5 * k + 0.5;
            ctx.beginPath(); ctx.moveTo(ef.x1, ef.y1); ctx.lineTo(ef.x2, ef.y2); ctx.stroke();
            sprStar(ctx, ef.x2, ef.y2, 9 * k + 3, '#ffab40');
            ctx.restore();
            return true;
        }
        case 'precision_slash': { // Swordsaint sweep (basic combo and Q): a spectral crescent with speed lines
            const big = ef.radius >= 170, sweep = Math.PI / 3.5, R = ef.radius;
            if (big && !ef.burstDone) {
                ef.burstDone = true;
                for (let i = 0; i < 10; i++) {
                    const a = ef.angle - sweep + Math.random() * sweep * 2, r = R * (0.5 + Math.random() * 0.5);
                    spawnParticle({ kind: 'dot', color: '#e0f7fa', x: ef.x + Math.cos(a) * r, y: ef.y + Math.sin(a) * r, vx: Math.cos(a) * 60, vy: Math.sin(a) * 60, size: 1.6, life: 0.35, drag: 2, grow: 0, spin: 0, rot: 0 });
                }
            }
            ctx.save();
            ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = 1;
            const g = ctx.createRadialGradient(ef.x, ef.y, R * 0.45, ef.x, ef.y, R);
            g.addColorStop(0, 'rgba(0, 229, 255, 0)'); g.addColorStop(0.75, withAlpha('#00e5ff', 0.55 * k)); g.addColorStop(1, `rgba(255, 255, 255, ${0.9 * k})`);
            ctx.fillStyle = g;
            drawCrescent(ef.x, ef.y, R, ef.angle - sweep, ef.angle + sweep, (big ? 46 : 32) * k + 6); ctx.fill();
            if (big) { drawCrescent(ef.x, ef.y, R * 0.72, ef.angle - sweep * 0.8, ef.angle + sweep * 0.8, 18 * k + 3); ctx.fill(); }
            ctx.strokeStyle = `rgba(255, 255, 255, ${k})`; ctx.lineWidth = 2.5 * k + 0.5;
            ctx.beginPath(); ctx.arc(ef.x, ef.y, R, ef.angle - sweep * 0.9, ef.angle + sweep * 0.9); ctx.stroke();
            ctx.strokeStyle = `rgba(224, 247, 250, ${0.6 * k})`; ctx.lineWidth = 1;
            ctx.beginPath();
            for (let i = 0; i < 5; i++) { const a = ef.angle - sweep * 0.7 + i * sweep * 0.35; ctx.moveTo(ef.x + Math.cos(a) * R * 0.5, ef.y + Math.sin(a) * R * 0.5); ctx.lineTo(ef.x + Math.cos(a) * R * 0.85, ef.y + Math.sin(a) * R * 0.85); }
            ctx.stroke();
            ctx.restore();
            return true;
        }
        case 'storm_cyclone': { // Swordsaint Blade Surge: ghost katanas whirling around the airborne blade
            ctx.save();
            ctx.globalAlpha = 1;
            ctx.translate(ef.x, ef.y);
            ctx.globalCompositeOperation = 'lighter';
            ctx.rotate(fxTime * 14);
            ctx.fillStyle = withAlpha('#00e5ff', 0.25 * k);
            for (let i = 0; i < 3; i++) { ctx.rotate(Math.PI * 2 / 3); drawCrescent(0, 0, ef.radius, 0, 1.4, 14 * k + 3); ctx.fill(); }
            for (let i = 0; i < 5; i++) {
                ctx.save();
                ctx.rotate(i * Math.PI * 2 / 5);
                ctx.translate(ef.radius * 0.55, 0); ctx.rotate(Math.PI / 2); ctx.translate(-60, 0);
                drawKatanaGhost('#84ffff', 0.35 * k);
                ctx.restore();
            }
            ctx.restore();
            return true;
        }
        case 'surge_burst': { // Blade Surge finale: radial cuts and a shock ring
            if (!ef.burstDone) {
                ef.burstDone = true;
                burst(ef.x, ef.y, 0, Math.PI * 2, 16, { kind: 'spark', color: '#84ffff', size: 2.5, life: 0.35, speed: [250, 520], drag: 5 });
                addShake(3);
            }
            ctx.save();
            ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = 1;
            ctx.strokeStyle = `rgba(132, 255, 255, ${k})`; ctx.lineWidth = 5 * k + 1;
            ctx.beginPath(); ctx.arc(ef.x, ef.y, ef.radius * easeOut(p), 0, Math.PI * 2); ctx.stroke();
            ctx.strokeStyle = `rgba(255, 255, 255, ${k})`; ctx.lineWidth = 2;
            ctx.beginPath();
            for (let i = 0; i < 8; i++) {
                const a = i * Math.PI / 4 + 0.2, r0 = ef.radius * 0.2 * easeOut(p), r1 = ef.radius * easeOut(p);
                ctx.moveTo(ef.x + Math.cos(a) * r0, ef.y + Math.sin(a) * r0); ctx.lineTo(ef.x + Math.cos(a) * r1, ef.y + Math.sin(a) * r1);
            }
            ctx.stroke();
            ctx.restore();
            return true;
        }
        case 'parry_flash': { // Swordsaint successful parry
            ctx.save();
            ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = k;
            ctx.translate(ef.x, ef.y); ctx.rotate(ef.angle);
            sprStar(ctx, 0, 0, 34 * (0.5 + p), '#e0f7fa');
            ctx.fillStyle = '#ffffff';
            ctx.beginPath(); ctx.moveTo(-50 * (0.4 + p), 0); ctx.lineTo(0, -3); ctx.lineTo(50 * (0.4 + p), 0); ctx.lineTo(0, 3); ctx.closePath(); ctx.fill();
            ctx.strokeStyle = '#00e5ff'; ctx.lineWidth = 3 * k;
            ctx.beginPath(); ctx.arc(0, 0, 45 * easeOut(p), 0, Math.PI * 2); ctx.stroke();
            ctx.restore();
            return true;
        }
        case 'divine_ray_channel': { drawDivineRay(ef); return true; }
        case 'vine_whip': { drawVineWhip(ef, p, k); return true; }
        case 'holy_impact': { // Paladin hammer landing: flash, light rays and a shock ring
            if (!ef.burstDone) {
                ef.burstDone = true;
                burst(ef.x, ef.y, 0, Math.PI * 2, 10, { kind: 'debris', color: '#8d6e63', size: 3.5, life: 0.5, speed: [80, 220], drag: 5 });
                burst(ef.x, ef.y, 0, Math.PI * 2, 10, { kind: 'spark', color: '#ffe082', size: 2.2, life: 0.3, speed: [180, 400], drag: 5 });
                addShake(2.5);
            }
            ctx.save();
            ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = 1;
            const g = ctx.createRadialGradient(ef.x, ef.y, 0, ef.x, ef.y, ef.radius);
            g.addColorStop(0, `rgba(255, 255, 255, ${k})`); g.addColorStop(0.4, `rgba(255, 224, 130, ${0.6 * k})`); g.addColorStop(1, 'rgba(255, 213, 79, 0)');
            ctx.fillStyle = g; ctx.beginPath(); ctx.arc(ef.x, ef.y, ef.radius, 0, Math.PI * 2); ctx.fill();
            ctx.translate(ef.x, ef.y); ctx.rotate(p * 0.6);
            ctx.fillStyle = `rgba(255, 248, 225, ${0.8 * k})`;
            for (let i = 0; i < 8; i++) {
                const a = i * Math.PI / 4, len = ef.radius * (i % 2 ? 1.1 : 1.6) * (0.6 + 0.4 * k);
                ctx.beginPath(); ctx.moveTo(Math.cos(a - 0.08) * 8, Math.sin(a - 0.08) * 8); ctx.lineTo(Math.cos(a) * len, Math.sin(a) * len); ctx.lineTo(Math.cos(a + 0.08) * 8, Math.sin(a + 0.08) * 8); ctx.fill();
            }
            ctx.strokeStyle = `rgba(255, 213, 79, ${k})`; ctx.lineWidth = 3 * k;
            ctx.beginPath(); ctx.arc(0, 0, ef.radius * 1.3 * easeOut(p), 0, Math.PI * 2); ctx.stroke();
            ctx.restore();
            return true;
        }
        case 'lightning': { // jagged bolt with a glow and a white-hot core, re-forked a few times per second
            if (!ef.pts || fxTime - ef.ptsAt > 0.05) {
                ef.ptsAt = fxTime;
                const dx = ef.x2 - ef.x1, dy = ef.y2 - ef.y1, dist = Math.hypot(dx, dy) || 1, n = Math.max(4, Math.round(dist / 25));
                const px = -dy / dist, py = dx / dist;
                ef.pts = [[ef.x1, ef.y1]];
                for (let i = 1; i < n; i++) { const j = (Math.random() - 0.5) * 26; ef.pts.push([ef.x1 + dx * i / n + px * j, ef.y1 + dy * i / n + py * j]); }
                ef.pts.push([ef.x2, ef.y2]);
                const m = ef.pts[Math.floor(n / 2)], fa = Math.atan2(dy, dx) + (Math.random() < 0.5 ? 0.7 : -0.7);
                ef.fork = [m, [m[0] + Math.cos(fa) * dist * 0.25, m[1] + Math.sin(fa) * dist * 0.25]];
            }
            ctx.save();
            ctx.globalCompositeOperation = 'lighter'; ctx.lineJoin = 'round'; ctx.lineCap = 'round';
            const path = () => { ctx.beginPath(); ef.pts.forEach(([x, y], i) => i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)); ctx.moveTo(...ef.fork[0]); ctx.lineTo(...ef.fork[1]); };
            ctx.globalAlpha = 0.5 * k; ctx.strokeStyle = ef.color || '#fff59d'; ctx.lineWidth = 6; ctx.shadowBlur = 12; ctx.shadowColor = ef.color || '#fff59d';
            path(); ctx.stroke();
            ctx.shadowBlur = 0; ctx.globalAlpha = k; ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 1.5;
            path(); ctx.stroke();
            ctx.restore();
            return true;
        }
    }
    return false;
}

// Cleric Divine Ray: a soft-edged beam with energy flowing outward, a flare at the source,
// and dark tendrils instead of light for the Shadow evolution
function drawDivineRay(ef) {
    const shadow = ef.color === '#9c27b0';
    const fadeIn = clamp01((ef.maxLife - ef.life) / 0.12), fadeOut = clamp01(ef.life / 0.2), a = fadeIn * fadeOut;
    const w = ef.width * 0.7 * (1 + Math.sin(fxTime * 40) * 0.06) * (0.6 + 0.4 * fadeIn);
    const len = Math.min(ef.length, 3000);
    ctx.save();
    ctx.translate(ef.x, ef.y); ctx.rotate(ef.angle);
    ctx.globalAlpha = a;
    ctx.globalCompositeOperation = shadow ? 'source-over' : 'lighter';
    const body = ctx.createLinearGradient(0, -w, 0, w);
    body.addColorStop(0, withAlpha(ef.color, 0)); body.addColorStop(0.3, withAlpha(ef.color, 0.55));
    body.addColorStop(0.5, shadow ? '#e1bee7' : '#ffffff');
    body.addColorStop(0.7, withAlpha(ef.color, 0.55)); body.addColorStop(1, withAlpha(ef.color, 0));
    ctx.fillStyle = body; ctx.fillRect(0, -w, len, w * 2);
    // Energy streaming outward along the beam
    ctx.setLineDash([26, 44]); ctx.lineDashOffset = -fxTime * 900;
    ctx.strokeStyle = shadow ? 'rgba(206, 147, 216, 0.7)' : 'rgba(255, 255, 255, 0.6)'; ctx.lineWidth = Math.max(1, w * 0.12);
    ctx.beginPath(); for (const y of [-w * 0.3, w * 0.3]) { ctx.moveTo(0, y); ctx.lineTo(len, y); } ctx.stroke();
    ctx.setLineDash([]);
    if (shadow) { // writhing tendrils
        ctx.strokeStyle = 'rgba(49, 0, 74, 0.8)'; ctx.lineWidth = 2;
        for (let i = 0; i < 3; i++) {
            ctx.beginPath();
            for (let x = 0; x <= Math.min(len, 1200); x += 12) ctx.lineTo(x, Math.sin(x * 0.04 - fxTime * 12 + i * 2.1) * w * 0.7);
            ctx.stroke();
        }
    }
    // Source flare
    ctx.globalCompositeOperation = 'lighter';
    const flareR = Math.min(w * 1.3 + 10, 40); // capped so the max-Zeal beam doesn't bloom over the fight
    const flare = ctx.createRadialGradient(10, 0, 0, 10, 0, flareR);
    flare.addColorStop(0, shadow ? 'rgba(225, 190, 231, 0.9)' : 'rgba(255, 255, 255, 1)'); flare.addColorStop(1, withAlpha(ef.color, 0));
    ctx.fillStyle = flare; ctx.beginPath(); ctx.arc(10, 0, flareR, 0, Math.PI * 2); ctx.fill();
    if (!shadow) {
        ctx.save(); ctx.translate(10, 0); ctx.rotate(fxTime * 3);
        ctx.fillStyle = 'rgba(255, 249, 196, 0.7)';
        for (let i = 0; i < 6; i++) { const ra = i * Math.PI / 3; ctx.beginPath(); ctx.moveTo(Math.cos(ra - 0.1) * 6, Math.sin(ra - 0.1) * 6); ctx.lineTo(Math.cos(ra) * flareR * 1.3, Math.sin(ra) * flareR * 1.3); ctx.lineTo(Math.cos(ra + 0.1) * 6, Math.sin(ra + 0.1) * 6); ctx.fill(); }
        ctx.restore();
    }
    ctx.restore();
}

// Druid Vine Whip: a thorny vine lashes out, cracks at full reach, then recoils
function drawVineWhip(ef, p, k) {
    const extend = p < 0.45 ? easeOut(p / 0.45) : 1 - easeInOut((p - 0.45) / 0.55) * 0.9;
    const len = ef.radius * extend;
    const pts = [];
    for (let x = 0; x <= len; x += 8) {
        const t = x / Math.max(1, ef.radius);
        pts.push([x, Math.sin(x * 0.045 - p * 14) * 12 * t * (1 - t * 0.4)]);
    }
    if (pts.length < 2) return;
    ctx.save();
    ctx.globalAlpha = 1;
    ctx.translate(ef.x, ef.y); ctx.rotate(ef.angle);
    ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    for (let i = 1; i < pts.length; i++) { // tapering vine
        const wdt = 6.5 - 4.5 * (i / pts.length);
        ctx.strokeStyle = SPRITE_OUTLINE; ctx.lineWidth = wdt + 2;
        ctx.beginPath(); ctx.moveTo(...pts[i - 1]); ctx.lineTo(...pts[i]); ctx.stroke();
    }
    for (let i = 1; i < pts.length; i++) {
        ctx.strokeStyle = '#558b2f'; ctx.lineWidth = 6.5 - 4.5 * (i / pts.length);
        ctx.beginPath(); ctx.moveTo(...pts[i - 1]); ctx.lineTo(...pts[i]); ctx.stroke();
    }
    ctx.fillStyle = '#c5e1a5';
    for (let i = 2; i < pts.length - 1; i += 2) {
        const [x, y] = pts[i], s = i % 4 ? 1 : -1;
        ctx.beginPath(); ctx.moveTo(x - 2, y); ctx.lineTo(x, y + s * 6); ctx.lineTo(x + 2, y); ctx.fill();
    }
    [0.25, 0.5, 0.75].forEach((f, i) => { const pt = pts[Math.floor((pts.length - 1) * f)]; sprLeaf(ctx, pt[0], pt[1], (i % 2 ? 1 : -1) * 1.2, 7, '#7cb342'); });
    // Crack at full extension
    if (p > 0.3 && p < 0.6) {
        const [tx, ty] = pts[pts.length - 1], f = 1 - Math.abs(p - 0.45) / 0.15;
        ctx.globalCompositeOperation = 'lighter';
        sprStar(ctx, tx, ty, 12 * f, '#ccff90');
        ctx.fillStyle = `rgba(139, 195, 74, ${0.5 * f})`;
        drawCrescent(0, 0, ef.radius, -0.5, 0.5, 12 * f);
        ctx.fill();
    }
    ctx.restore();
}

// ==========================================
// Swordsaint parry
// ==========================================

// While the parry window is open, a glint of guard light sits in front of the Swordsaint
function drawParryGuard(aimAngle) {
    const k = clamp01(player.parryTimer / 0.3);
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    ctx.fillStyle = `rgba(132, 255, 255, ${0.6 * k})`;
    drawCrescent(player.x, player.y, player.radius + 22, aimAngle - 1.0, aimAngle + 1.0, 8 * k + 2); ctx.fill();
    ctx.strokeStyle = `rgba(255, 255, 255, ${k})`; ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.arc(player.x, player.y, player.radius + 22, aimAngle - 0.8, aimAngle + 0.8); ctx.stroke();
    ctx.restore();
}

// Called from takeDamage when a hit is parried
function onParry(sourceObj) {
    const from = sourceObj && sourceObj.proj ? Math.atan2(sourceObj.proj.y - player.y, sourceObj.proj.x - player.x) : Math.atan2(mouseY - player.y, mouseX - player.x);
    const x = player.x + Math.cos(from) * 24, y = player.y + Math.sin(from) * 24;
    effects.push({ type: 'parry_flash', x, y, angle: from + Math.PI / 2, life: 0.3, maxLife: 0.3 });
    burst(x, y, from, 2.2, 14, { kind: 'spark', color: '#e0f7fa', size: 2.5, life: 0.3, speed: [200, 480], drag: 6 });
    addShake(3);
    hitStopTimer = Math.max(hitStopTimer, 0.07);
}

// ==========================================
// Continuous emitters (game time)
// ==========================================

function updateSkillEmitters(dt) {
    updateESkillEmitters(dt);
    updateSpaceEmitters(dt);
    updateUltEmitters(dt);
    updateRmbEmitters(dt);
    for (const p of projectiles) {
        if (p.isEnemy) continue;
        const upg = p.sourceSkill && p.sourceSkill.selectedUpg;
        if (p.type === 'shield_throw') {
            const col = upg === 'A' ? '#ff9e40' : upg === 'B' ? '#81d4fa' : '#eeeeee';
            emit(upg ? 30 : 15, dt, () => spawnParticle({ kind: 'dot', color: col, x: p.x + jitter(16), y: p.y + jitter(16), vx: jitter(30), vy: jitter(30), size: 1.5, life: 0.35, drag: 2, grow: 0, spin: 0, rot: 0 }));
        } else if (p.type === 'fireball' && p.sourceSkill && selectedClassId === 'spellweaver') {
            emit(70, dt, () => spawnParticle({ kind: 'dot', color: Math.random() < 0.5 ? '#ff7043' : '#ffca28', x: p.x + jitter(10), y: p.y + jitter(10), vx: -p.vx * 0.15 + jitter(50), vy: -p.vy * 0.15 + jitter(50), size: 2, life: 0.4, drag: 3, grow: 0, spin: 0, rot: 0 }));
            emit(10, dt, () => spawnParticle({ kind: 'smoke', color: '#424242', x: p.x + jitter(6), y: p.y + jitter(6), vx: -p.vx * 0.05, vy: -p.vy * 0.05, size: 4, grow: 14, life: 0.6, drag: 2, spin: 0, rot: 0 }));
        } else if (p.type === 'bramble_core') {
            emit(18, dt, () => spawnParticle({ kind: 'dot', color: '#aed581', x: p.x + jitter(8), y: p.y + jitter(8), vx: jitter(30), vy: jitter(30), size: 1.4, life: 0.5, drag: 2, grow: 0, spin: 0, rot: 0 }));
        }
    }
    for (const ef of effects) {
        if (ef.type === 'fire_puddle') {
            emit(14, dt, () => { const a = Math.random() * Math.PI * 2, r = Math.random() * ef.radius * 0.8; spawnParticle({ kind: 'dot', color: '#ffab40', x: ef.x + Math.cos(a) * r, y: ef.y + Math.sin(a) * r, vx: jitter(20), vy: -30 - Math.random() * 40, size: 1.5, life: 0.5, drag: 1, grow: 0, spin: 0, rot: 0 }); });
        } else if (ef.type === 'thorn_patch') {
            emit(2, dt, () => { const a = Math.random() * Math.PI * 2, r = Math.random() * ef.radius; spawnParticle({ kind: 'leaf', color: '#7cb342', x: ef.x + Math.cos(a) * r, y: ef.y + Math.sin(a) * r, vx: jitter(20), vy: jitter(20), size: 5, life: 0.9, drag: 1, grow: 0, spin: jitter(4), rot: Math.random() * 6 }); });
        } else if (ef.type === 'divine_ray_channel') {
            const shadow = ef.color === '#9c27b0', reach = Math.min(ef.length, 900);
            emit(40, dt, () => {
                const d = Math.random() * reach, off = jitter(ef.width * 0.8), c = Math.cos(ef.angle), s = Math.sin(ef.angle);
                spawnParticle({ kind: 'dot', color: shadow ? '#ce93d8' : '#fff9c4', x: ef.x + c * d - s * off, y: ef.y + s * d + c * off, vx: c * 120 + jitter(30), vy: s * 120 + jitter(30), size: 1.6, life: 0.4, drag: 1, grow: 0, spin: 0, rot: 0 });
            });
        }
    }
    // Ranger Barbed Tips (and any other bleed): enemies drip blood
    for (const e of enemies) {
        if (e.dead || !(e.bleedTimer > 0)) continue;
        emit(6, dt, () => spawnParticle({ kind: 'dot', color: '#d50000', x: e.x + jitter(e.size * 0.6), y: e.y + jitter(e.size * 0.6), vx: jitter(10), vy: 25, size: 1.6, life: 0.5, drag: 1, grow: 0, spin: 0, rot: 0 }));
    }
    // Paladin: the thrown hammer sheds holy motes in flight
    if (isPaladin() && player.hammer && (player.hammer.state === 'outbound' || player.hammer.state === 'returning')) {
        const h = player.hammer;
        emit(30, dt, () => spawnParticle({ kind: 'dot', color: '#fff59d', x: h.x + jitter(18), y: h.y + jitter(18), vx: jitter(30), vy: jitter(30), size: 1.6, life: 0.4, drag: 2, grow: 0, spin: 0, rot: 0 }));
    }
}
