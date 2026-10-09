// ==========================================
// fx.js - Particles, Hit Sparks & Screen Shake
// ==========================================
// Particles live in game time: they advance in update(), so they freeze with the game when paused.

const particles = [];
const MAX_PARTICLES = 500;
let fxTime = 0;                          // game-time clock shared with weapon animations
let shakeAmount = 0, shakeX = 0, shakeY = 0;

// kinds: spark (streak along its velocity), dot (glowing mote), smoke (growing puff), ring (expanding outline),
// shell (brass casing that bounces), leaf (tumbling leaf), debris (rubble chip)
function spawnParticle(p) {
    if (particles.length >= MAX_PARTICLES) particles.shift();
    p.maxLife = p.life;
    particles.push(p);
}

// Spray `count` particles from (x, y) in a cone around `angle`. `opts` sets kind, color, size and the speed range.
function burst(x, y, angle, spread, count, opts) {
    for (let i = 0; i < count; i++) {
        const a = angle + (Math.random() - 0.5) * spread;
        const sp = opts.speed[0] + Math.random() * (opts.speed[1] - opts.speed[0]);
        spawnParticle({
            kind: opts.kind, color: opts.color, x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp,
            size: opts.size * (0.7 + Math.random() * 0.6), life: opts.life * (0.7 + Math.random() * 0.6),
            drag: opts.drag !== undefined ? opts.drag : 4, grow: opts.grow || 0, spin: (Math.random() - 0.5) * 12, rot: Math.random() * 6
        });
    }
}

function addShake(amount) { shakeAmount = Math.min(8, Math.max(shakeAmount, amount)); }

const HIT_COLORS = {
    dragonknight: '#ff8a65', ranger: '#dcedc8', machinist: '#ffcc80', spellweaver: '#81d4fa', nightblade: '#ea80fc',
    swordsaint: '#84ffff', cleric: '#fff59d', druid: '#ccff90', paladin: '#fff59d'
};

// Called from applyDamage: sparks at the impact point, a white flash on the enemy, and shake on heavy hits
function spawnHitFx(enemy, source, projAngle) {
    if (source === 'dot') return;
    if (enemy.lastHitFx && fxTime - enemy.lastHitFx < 0.08) return; // beams and multi-hits: one burst per enemy at a time
    enemy.lastHitFx = fxTime;
    enemy.hitFlash = 0.08;

    const ang = projAngle !== null ? projAngle : Math.atan2(enemy.y - player.y, enemy.x - player.x);
    const r = enemy.size / 2;
    const ix = enemy.x - Math.cos(ang) * r * 0.7, iy = enemy.y - Math.sin(ang) * r * 0.7;
    let color = HIT_COLORS[selectedClassId] || '#ffffff';
    if (selectedClassId === 'cleric' && buffs.lastSpellClass === 'shadow') color = '#ce93d8';
    if (isWildForm()) color = '#ff7043';
    const melee = source === 'melee_basic' || source === 'melee' || source === 'slash';

    burst(ix, iy, ang, 1.6, melee ? 8 : 5, { kind: 'spark', color, size: 2.5, life: 0.22, speed: [180, 440], drag: 6 });
    burst(ix, iy, ang, 2.4, 3, { kind: 'dot', color: '#ffffff', size: 2.2, life: 0.18, speed: [40, 140] });
    spawnParticle({ kind: 'ring', color: '#ffffff', x: ix, y: iy, vx: 0, vy: 0, size: 3, grow: 150, life: 0.14 });

    // Heavy hits shake the camera a little
    if (source === 'melee_basic' && selectedClassId === 'paladin' && !hammerAway()) addShake(3);
    else if (source === 'melee_basic' && isWildForm() && player.lastWolfStep === 2) addShake(2.5);
    else if (source === 'slash' && selectedClassId === 'swordsaint' && player.stance === 'handheld' && player.lastAttackStep === 2) addShake(3);
    else if (selectedClassId === 'machinist' && source === 'ranged' && Math.hypot(enemy.x - player.x, enemy.y - player.y) < 140) addShake(2);
}

function updateFx(dt) {
    fxTime += dt;
    for (let i = particles.length - 1; i >= 0; i--) {
        const p = particles[i];
        p.life -= dt;
        if (p.life <= 0) { particles.splice(i, 1); continue; }
        const damp = Math.exp(-p.drag * dt);
        p.vx *= damp; p.vy *= damp;
        p.x += p.vx * dt; p.y += p.vy * dt;
        p.size += p.grow * dt;
        p.rot += p.spin * dt;
        if (p.kind === 'shell') { // casing arcs up, then bounces on the floor
            p.vz -= 900 * dt; p.z += p.vz * dt;
            if (p.z < 0) { p.z = 0; p.vz = -p.vz * 0.35; p.vx *= 0.6; p.vy *= 0.6; p.spin *= 0.6; }
        }
    }
    for (const e of enemies) if (e.hitFlash > 0) e.hitFlash -= dt;

    shakeAmount = Math.max(0, shakeAmount - dt * 30);
    shakeX = (Math.random() * 2 - 1) * shakeAmount;
    shakeY = (Math.random() * 2 - 1) * shakeAmount;

    updateWeaponEmitters(dt);
    updateSkillEmitters(dt);
}

function drawFx() {
    ctx.save();
    for (const p of particles) {
        const a = Math.max(0, p.life / p.maxLife);
        if (p.kind === 'smoke') {
            ctx.globalCompositeOperation = 'source-over';
            ctx.globalAlpha = a * 0.35; ctx.fillStyle = p.color;
            ctx.beginPath(); ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2); ctx.fill();
        } else if (p.kind === 'shell') {
            ctx.globalCompositeOperation = 'source-over';
            ctx.globalAlpha = Math.min(1, a * 3);
            ctx.save(); ctx.translate(p.x, p.y - p.z); ctx.rotate(p.rot);
            ctx.fillStyle = '#ffca28'; ctx.fillRect(-3, -1.5, 6, 3);
            ctx.fillStyle = '#b71c1c'; ctx.fillRect(-3, -1.5, 2, 3);
            ctx.restore();
        } else if (p.kind === 'leaf') {
            ctx.globalCompositeOperation = 'source-over';
            ctx.globalAlpha = Math.min(1, a * 2);
            sprLeaf(ctx, p.x, p.y, p.rot, p.size, p.color);
        } else if (p.kind === 'goo') { // slime droplets: glossy, not glowing
            ctx.globalCompositeOperation = 'source-over';
            ctx.globalAlpha = Math.min(1, a * 2.5); ctx.fillStyle = p.color;
            ctx.beginPath(); ctx.arc(p.x, p.y, p.size * (0.6 + a * 0.4), 0, Math.PI * 2); ctx.fill();
            ctx.fillStyle = 'rgba(255, 255, 255, 0.6)'; ctx.beginPath(); ctx.arc(p.x - p.size * 0.3, p.y - p.size * 0.3, p.size * 0.25, 0, Math.PI * 2); ctx.fill();
        } else if (p.kind === 'debris') {
            ctx.globalCompositeOperation = 'source-over';
            ctx.globalAlpha = Math.min(1, a * 2); ctx.fillStyle = p.color;
            ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(p.rot); ctx.fillRect(-p.size / 2, -p.size / 2, p.size, p.size * 0.7); ctx.restore();
        } else {
            // Light-emitting particles blend additively so overlapping sparks bloom
            ctx.globalCompositeOperation = 'lighter';
            ctx.globalAlpha = a;
            if (p.kind === 'spark') {
                ctx.strokeStyle = p.color; ctx.lineWidth = p.size * (0.4 + a * 0.6); ctx.lineCap = 'round';
                ctx.beginPath(); ctx.moveTo(p.x, p.y); ctx.lineTo(p.x - p.vx * 0.035, p.y - p.vy * 0.035); ctx.stroke();
            } else if (p.kind === 'ring') {
                ctx.strokeStyle = p.color; ctx.lineWidth = 2 * a + 0.5;
                ctx.beginPath(); ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2); ctx.stroke();
            } else { // dot
                ctx.fillStyle = p.color;
                ctx.beginPath(); ctx.arc(p.x, p.y, Math.max(0.5, p.size * (0.5 + a * 0.5)), 0, Math.PI * 2); ctx.fill();
            }
        }
    }
    ctx.restore();
}

// Druid wolf Bite: two rows of fangs slam shut across the enemy, leaving a red flash
function drawWolfBite(ef) {
    const p = 1 - ef.life / ef.maxLife, r = ef.radius;
    const gap = r * (1 - easeOut(Math.min(1, p * 3.5))) + 3;
    ctx.save();
    ctx.translate(ef.x, ef.y); ctx.rotate(ef.angle);
    if (p > 0.28) { // puncture flash once the jaws close
        ctx.globalCompositeOperation = 'lighter';
        ctx.fillStyle = `rgba(255, 82, 82, ${0.6 * (1 - p)})`;
        ctx.beginPath(); ctx.ellipse(0, 0, r * 0.9, r * 0.45, 0, 0, Math.PI * 2); ctx.fill();
        ctx.globalCompositeOperation = 'source-over';
    }
    for (const s of [-1, 1]) {
        const y0 = s * gap;
        for (let i = 0; i < 4; i++) {
            const x = -r * 0.6 + i * (r * 0.4), curve = Math.pow((x / r), 2) * 4 * s; // rows bow outward at the ends
            ctx.beginPath();
            ctx.moveTo(x - 3, y0 + s * 4 + curve); ctx.lineTo(x + 3, y0 + s * 4 + curve); ctx.lineTo(x, y0 - s * 4 + curve); ctx.closePath();
            sprFill(ctx, '#fafafa');
        }
    }
    ctx.restore();
}

// A crescent that is thick in the middle and tapers to points at both ends (used by slash effects)
function drawCrescent(x, y, radius, a0, a1, thickness) {
    const N = 16;
    ctx.beginPath();
    for (let i = 0; i <= N; i++) { const a = a0 + (a1 - a0) * i / N; ctx.lineTo(x + Math.cos(a) * radius, y + Math.sin(a) * radius); }
    for (let i = N; i >= 0; i--) {
        const a = a0 + (a1 - a0) * i / N, r = radius - thickness * Math.sin(Math.PI * i / N);
        ctx.lineTo(x + Math.cos(a) * r, y + Math.sin(a) * r);
    }
    ctx.closePath();
}
