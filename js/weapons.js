// ==========================================
// weapons.js - Held Weapons, Attack Animations & Projectile Visuals
// ==========================================
// Weapons are drawn over the character sprite, with hands on the grip. Damage still lands the instant an attack
// fires; the animation is the swing's follow-through and recovery, timed in game time (fxTime) so it pauses with the game.

const weaponAnim = {
    attackAt: -10, swing: 0, shellOut: true, bowDraw: 0.4, lastReal: 0,
    tip: null, censer: null, wandTip: null, bladeBase: null // world points the particle emitters attach to
};

const GLOVES = {
    dragonknight: '#616161', ranger: '#6d4c41', machinist: '#424242', spellweaver: '#0d47a1', nightblade: '#212121',
    swordsaint: '#e0e0e0', cleric: '#fff8e1', druid: '#5d4037', paladin: '#b0bec5'
};

const lerp = (a, b, t) => a + (b - a) * t;
const clamp01 = (x) => Math.max(0, Math.min(1, x));
const easeOut = (x) => 1 - Math.pow(1 - clamp01(x), 3);
const easeInOut = (x) => { x = clamp01(x); return x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2; };

// Point at `dist` along `angle` from the player, shifted `side` px to the player's right
function polar(angle, dist, side = 0) {
    return [player.x + Math.cos(angle) * dist + Math.cos(angle + Math.PI / 2) * side,
            player.y + Math.sin(angle) * dist + Math.sin(angle + Math.PI / 2) * side];
}

// Current-transform point in world space (minus camera shake), for emitters to attach particles to
function localToWorld(x, y) {
    const pt = ctx.getTransform().transformPoint(new DOMPoint(x, y));
    return { x: pt.x - shakeX, y: pt.y - shakeY };
}

function isRareWeapon() { return !!(equipment.weapon && equipment.weapon.rarity === 'rare'); }
function rarePulse() { return 0.6 + 0.4 * Math.sin(fxTime * 5); }

function drawHand(x, y) { sprEllipse(ctx, x, y, 3.6, 3.6, GLOVES[selectedClassId] || '#8d6e63'); }

// 0 → 1 over an attack animation of `base` seconds (shortened to fit faster attack speeds); 1 while idle
function attackProgress(base) {
    const dur = Math.min(base, Math.max(0.06, cooldownMax.basic * 0.85));
    return clamp01((fxTime - weaponAnim.attackAt) / dur);
}

// Called from castBasic once the attack has fired
function onBasicAttack() {
    const aim = Math.atan2(mouseY - player.y, mouseX - player.x);
    weaponAnim.attackAt = fxTime; weaponAnim.swing++; weaponAnim.shellOut = false;
    const fire = WEAPON_FIRE_FX[isWildForm() ? 'claws' : activeClass.weapon];
    if (fire) fire(aim);
}

// A row of small glowing glyphs along the local x axis (rare weapon inscriptions)
function drawRunes(x0, x1, y, color, size = 2) {
    ctx.save();
    ctx.strokeStyle = color; ctx.lineWidth = 1; ctx.lineCap = 'round';
    ctx.shadowBlur = 6; ctx.shadowColor = color; ctx.globalAlpha = rarePulse();
    ctx.beginPath();
    let i = 0;
    for (let x = x0; x <= x1; x += size * 2.6, i++) {
        const k = i % 4, h = size * 0.6;
        if (k === 0) { ctx.moveTo(x, y - size); ctx.lineTo(x, y + size); ctx.moveTo(x - h, y); ctx.lineTo(x + h, y - h); }
        else if (k === 1) { ctx.moveTo(x - h, y - size); ctx.lineTo(x + h, y); ctx.lineTo(x - h, y + size); }
        else if (k === 2) { ctx.moveTo(x, y - size); ctx.lineTo(x, y + size); ctx.moveTo(x, y - h * 0.5); ctx.lineTo(x + h, y - size); }
        else { ctx.moveTo(x - h, y + size); ctx.lineTo(x, y - size); ctx.lineTo(x + h, y + size); }
    }
    ctx.stroke();
    ctx.restore();
}

// Fading ribbon swept by a blade around the player. angleAt(q) is the blade angle at swing progress q (0..1);
// the ribbon covers [sq - span, sq], so it shrinks away once the swing has finished (sq > 1).
function drawSwingTrail(angleAt, sq, span, rIn, rOut, color, alpha = 0.5) {
    const q1 = Math.min(1, sq), q0 = clamp01(sq - span);
    const a0 = angleAt(q0), a1 = angleAt(q1), sweep = Math.abs(a1 - a0);
    if (sq <= 0 || sweep < 0.02) return;
    // One band, faded by a conic gradient from transparent (oldest) to `color` (where the blade is now)
    const N = 16;
    ctx.save();
    ctx.beginPath();
    for (let i = 0; i <= N; i++) ctx.lineTo(...polar(angleAt(q0 + (q1 - q0) * i / N), rOut));
    for (let i = N; i >= 0; i--) ctx.lineTo(...polar(angleAt(q0 + (q1 - q0) * i / N), rIn));
    ctx.closePath();
    const f = Math.min(1, sweep / (Math.PI * 2));
    const g = ctx.createConicGradient(Math.min(a0, a1), player.x, player.y);
    g.addColorStop(0, a1 > a0 ? 'rgba(0, 0, 0, 0)' : color);
    g.addColorStop(f, a1 > a0 ? color : 'rgba(0, 0, 0, 0)');
    g.addColorStop(Math.min(1, f + 0.001), 'rgba(0, 0, 0, 0)');
    ctx.globalCompositeOperation = 'lighter';
    ctx.globalAlpha = alpha;
    ctx.fillStyle = g; ctx.fill();
    ctx.restore();
}

// ==========================================
// Held weapons
// ==========================================

const WEAPON_DRAW = {
    // Dragonknight: greatsword swung in alternating arcs; the blade heats up with Frenzy
    sword(A) {
        const p = attackProgress(0.3), rare = isRareWeapon();
        const frenzy = Math.min(1, player.frenzyStacks / 10);
        const s = weaponAnim.swing % 2 ? 1 : -1;
        const swingAng = (q) => A + s * 1.2 - s * 2.5 * easeOut(q);
        const ang = p < 0.45 ? swingAng(p / 0.45) : lerp(A - s * 1.3, A - s * 0.8, easeInOut((p - 0.45) / 0.55));

        drawSwingTrail(swingAng, p / 0.45, 0.6, 26, 68, frenzy > 0.4 || rare ? '#ff7043' : '#ffffff', 0.45);

        ctx.save();
        ctx.translate(player.x, player.y); ctx.rotate(ang);
        // Blade
        const blade = () => { ctx.beginPath(); ctx.moveTo(22, -4.5); ctx.lineTo(56, -4); ctx.lineTo(67, 0); ctx.lineTo(56, 4); ctx.lineTo(22, 4.5); ctx.closePath(); };
        if (frenzy > 0.05 || rare) { ctx.shadowBlur = 6 + 12 * frenzy; ctx.shadowColor = rare ? '#ff9100' : '#ff3d00'; }
        const steel = ctx.createLinearGradient(0, -4.5, 0, 4.5);
        steel.addColorStop(0, '#ffffff'); steel.addColorStop(0.45, '#cfd8dc'); steel.addColorStop(1, '#78909c');
        blade(); sprFill(ctx, steel);
        ctx.shadowBlur = 0;
        if (frenzy > 0) {
            const heat = ctx.createLinearGradient(22, 0, 67, 0);
            heat.addColorStop(0, 'rgba(255, 87, 34, 0)'); heat.addColorStop(1, `rgba(255, 87, 34, ${0.7 * frenzy})`);
            blade(); ctx.fillStyle = heat; ctx.fill();
        }
        ctx.strokeStyle = '#90a4ae'; ctx.lineWidth = 1.2; // fuller
        ctx.beginPath(); ctx.moveTo(25, 0); ctx.lineTo(52, 0); ctx.stroke();
        if (rare) drawRunes(27, 50, 0, '#ffab40', 1.6);
        // Dragon-wing crossguard, wrapped grip, ruby pommel
        ctx.beginPath(); ctx.moveTo(18, -12); ctx.lineTo(23, -9); ctx.lineTo(24, -3); ctx.lineTo(24, 3); ctx.lineTo(23, 9); ctx.lineTo(18, 12); ctx.lineTo(20.5, 0); ctx.closePath();
        sprFill(ctx, '#ffb300');
        ctx.beginPath(); ctx.rect(6, -2.2, 13, 4.4); sprFill(ctx, '#4e342e');
        ctx.strokeStyle = '#8d6e63'; ctx.lineWidth = 1;
        ctx.beginPath(); for (let x = 8; x < 18; x += 3) { ctx.moveTo(x, -2.2); ctx.lineTo(x + 1.5, 2.2); } ctx.stroke();
        sprEllipse(ctx, 5, 0, 3, 3, '#d32f2f');
        drawHand(10, 0); drawHand(16, 0);
        weaponAnim.tip = localToWorld(64, 0); weaponAnim.bladeBase = localToWorld(24, 0);
        ctx.restore();
    },

    // Ranger: recurve bow. The string snaps forward on release, the next arrow is nocked, then drawn back.
    bow(A) {
        const rare = isRareWeapon();
        const now = performance.now(), dt = Math.min(0.1, (now - (weaponAnim.lastReal || now)) / 1000);
        weaponAnim.lastReal = now;
        const tSince = fxTime - weaponAnim.attackAt;
        const q = cooldownMax.basic > 0 ? 1 - Math.max(0, cooldowns.basic) / cooldownMax.basic : 1; // reload progress
        const target = (isMouseDown ? 1 : 0.45) * easeInOut((q - 0.55) / 0.45);
        weaponAnim.bowDraw = tSince < 0.05 ? 0 : lerp(weaponAnim.bowDraw, target, Math.min(1, dt * 18));
        const d = weaponAnim.bowDraw;
        const vib = tSince < 0.25 ? Math.sin(tSince * 90) * 3 * (1 - tSince / 0.25) : 0;
        const arrowIn = weaponAnim.swing === 0 ? 1 : clamp01((q - 0.35) / 0.25);

        ctx.save();
        ctx.translate(player.x, player.y); ctx.rotate(A);
        const tipX = 9 - 5 * d, tipY = 24 - 2 * d, nockX = tipX - 15 * d;
        // String
        ctx.strokeStyle = rare ? '#80d8ff' : '#eeeeee'; ctx.lineWidth = 1.2;
        if (rare) { ctx.shadowBlur = 6; ctx.shadowColor = '#40c4ff'; }
        ctx.beginPath(); ctx.moveTo(tipX, -tipY); ctx.lineTo(nockX, vib); ctx.lineTo(tipX, tipY); ctx.stroke();
        ctx.shadowBlur = 0;
        // Arrow on the string
        if (arrowIn > 0) {
            const ax = nockX - 10 * (1 - arrowIn);
            ctx.globalAlpha = arrowIn;
            ctx.strokeStyle = '#a1887f'; ctx.lineWidth = 1.8;
            ctx.beginPath(); ctx.moveTo(ax, 0); ctx.lineTo(ax + 32, 0); ctx.stroke();
            const glow = rare ? '#40c4ff' : (player.momentum > 0.15 ? '#b2ff59' : null);
            if (glow) { ctx.shadowBlur = 10; ctx.shadowColor = glow; }
            ctx.fillStyle = glow || '#eceff1';
            ctx.beginPath(); ctx.moveTo(ax + 38, 0); ctx.lineTo(ax + 31, -3); ctx.lineTo(ax + 31, 3); ctx.closePath(); ctx.fill();
            ctx.shadowBlur = 0;
            ctx.fillStyle = '#e53935';
            ctx.beginPath(); ctx.moveTo(ax + 6, 0); ctx.lineTo(ax + 1, -3); ctx.lineTo(ax - 1, -3); ctx.lineTo(ax + 2, 0); ctx.closePath(); ctx.fill();
            ctx.fillStyle = '#f5f5f5';
            ctx.beginPath(); ctx.moveTo(ax + 6, 0); ctx.lineTo(ax + 1, 3); ctx.lineTo(ax - 1, 3); ctx.lineTo(ax + 2, 0); ctx.closePath(); ctx.fill();
            ctx.globalAlpha = 1;
        }
        // Limbs flex as the string is drawn
        for (const s of [-1, 1]) {
            sprStroke(ctx, rare ? '#37474f' : '#8d6e63', 3.5, () => {
                ctx.moveTo(15, 0); ctx.quadraticCurveTo(17 - d * 2, s * 14, tipX, s * tipY);
                ctx.quadraticCurveTo(tipX - 1, s * (tipY + 3), tipX + 3, s * (tipY + 4));
            });
            if (rare) {
                ctx.save(); ctx.strokeStyle = '#40c4ff'; ctx.lineWidth = 1.2; ctx.shadowBlur = 8; ctx.shadowColor = '#40c4ff'; ctx.globalAlpha = rarePulse();
                ctx.beginPath(); ctx.moveTo(15, s * 3); ctx.quadraticCurveTo(17 - d * 2, s * 14, tipX, s * tipY); ctx.stroke();
                ctx.restore();
            }
        }
        ctx.beginPath(); ctx.rect(13, -3.5, 4, 7); sprFill(ctx, '#4e342e'); // leather grip
        drawHand(15, 0);
        if (arrowIn > 0.5 || d > 0.1) drawHand(nockX - 1, vib); else drawHand(3, 9);
        ctx.restore();
    },

    // Spellweaver: crystal-headed staff, thrust forward with a flare of the orb on each cast
    staff(A) {
        const p = attackProgress(0.25), rare = isRareWeapon(), res = player.arcaneResonance;
        const thrust = p < 1 ? Math.sin(easeOut(p) * Math.PI) * 8 : 0;
        ctx.save();
        ctx.translate(player.x, player.y); ctx.rotate(A);
        ctx.translate(thrust, 8); ctx.rotate(-0.16);
        sprStroke(ctx, '#6d4c41', 3.5, () => { ctx.moveTo(-14, 0); ctx.quadraticCurveTo(10, 1.8, 36, 0); });
        ctx.fillStyle = '#ffca28';
        ctx.fillRect(-12, -2.5, 2.5, 5); ctx.fillRect(29, -2.5, 2.5, 5);
        if (rare) drawRunes(-6, 26, 0, '#80d8ff', 1.4);
        // Prongs cradling the orb
        for (const s of [-1, 1]) sprStroke(ctx, '#ffca28', 1.8, () => { ctx.moveTo(33, 0); ctx.quadraticCurveTo(38, s * 9, 47, s * 4.5); });
        const orbColor = res ? '#2196f3' : '#4fc3f7';
        const r = 5 * (1 + (p < 1 ? 0.6 * (1 - p) : 0)) + (res ? 1 : 0) + (rare ? 0.5 : 0);
        const orb = ctx.createRadialGradient(42, -1.5, 0.5, 43, 0, r);
        orb.addColorStop(0, '#ffffff'); orb.addColorStop(rare ? 0.55 : 0.35, rare ? '#e1f5fe' : orbColor); orb.addColorStop(1, '#01579b');
        ctx.shadowBlur = 12 + (res ? 10 : 0) + (p < 1 ? 14 * (1 - p) : 0); ctx.shadowColor = orbColor;
        sprEllipse(ctx, 43, 0, r, r, orb, false);
        ctx.shadowBlur = 0;
        // Orbiting motes
        ctx.globalCompositeOperation = 'lighter';
        const n = res ? 4 : 2;
        for (let i = 0; i < n; i++) {
            const a = fxTime * 4 + i * Math.PI * 2 / n;
            sprEllipse(ctx, 43 + Math.cos(a) * 9, Math.sin(a) * 9, 1.4, 1.4, res ? '#bbdefb' : '#e1f5fe', false);
        }
        ctx.globalCompositeOperation = 'source-over';
        drawHand(2, 0);
        weaponAnim.tip = localToWorld(43, 0);
        ctx.restore();
    },

    // Nightblade: twin curved daggers, left then right stab (matching the two hits of the attack)
    dagger(A) {
        const rare = isRareWeapon();
        for (const [i, s] of [[0, -1], [1, 1]]) {
            const t = fxTime - weaponAnim.attackAt - i * 0.15;
            const q = t >= 0 ? Math.min(1, t / 0.16) : 1;
            const ext = q < 1 ? Math.sin(easeOut(q) * Math.PI) * 24 : 0;
            const ang = A + s * lerp(0.45, 0.08, ext / 24);
            const [bx, by] = polar(A, 8, s * 12);
            ctx.save();
            ctx.translate(bx + Math.cos(ang) * ext, by + Math.sin(ang) * ext); ctx.rotate(ang);
            if (q < 1) { // stab streak
                ctx.save();
                ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = 0.7 * (1 - q);
                const g = ctx.createLinearGradient(-ext, 0, 26, 0);
                g.addColorStop(0, 'rgba(234, 128, 252, 0)'); g.addColorStop(1, '#f3e5f5');
                ctx.fillStyle = g;
                ctx.beginPath(); ctx.moveTo(-ext, 0); ctx.lineTo(20, -3); ctx.lineTo(28, 0); ctx.lineTo(20, 3); ctx.closePath(); ctx.fill();
                ctx.restore();
            }
            // Curved blade
            if (rare) { ctx.shadowBlur = 8; ctx.shadowColor = '#e040fb'; }
            const steel = ctx.createLinearGradient(0, -2.5, 0, 2.5);
            steel.addColorStop(0, '#ffffff'); steel.addColorStop(1, '#78909c');
            ctx.beginPath(); ctx.moveTo(2, -2.3); ctx.quadraticCurveTo(14, -4.5, 22, s * 1.5); ctx.quadraticCurveTo(13, 1, 2, 2.3); ctx.closePath();
            sprFill(ctx, steel);
            ctx.shadowBlur = 0;
            if (rare) drawRunes(5, 13, -0.5, '#ea80fc', 1.1);
            ctx.beginPath(); ctx.rect(0, -4, 2.5, 8); sprFill(ctx, '#7b1fa2'); // guard
            ctx.beginPath(); ctx.rect(-7, -1.8, 7, 3.6); sprFill(ctx, '#311b92');
            drawHand(-3, 0);
            ctx.restore();
        }
    },

    // Machinist: break-action scattergun with recoil, muzzle flash, and a pump that ejects the spent shell
    scattergun(A) {
        const p = attackProgress(0.45), rare = isRareWeapon(), oc = buffs.overclockTimer > 0;
        const tSince = fxTime - weaponAnim.attackAt;
        const kq = clamp01(tSince / 0.18);
        const kick = kq < 1 ? -10 * (1 - easeOut(kq)) : 0;
        const twist = kq < 1 ? -0.16 * (1 - easeOut(kq)) : 0;
        const pq = (p - 0.35) / 0.45;
        const pump = pq > 0 && pq < 1 ? Math.sin(pq * Math.PI) * 7 : 0;

        ctx.save();
        ctx.translate(player.x, player.y); ctx.rotate(A + twist); ctx.translate(kick, 6);
        // Stock
        ctx.beginPath(); ctx.moveTo(-11, -3); ctx.lineTo(5, -3); ctx.lineTo(5, 3); ctx.lineTo(-11, 4.5); ctx.lineTo(-13, 1); ctx.closePath();
        sprFill(ctx, '#6d4c41');
        ctx.strokeStyle = '#4e342e'; ctx.lineWidth = 0.8; ctx.beginPath(); ctx.moveTo(-10, 0); ctx.lineTo(3, -1); ctx.stroke();
        // Barrels
        const metal = ctx.createLinearGradient(0, -4, 0, 4);
        metal.addColorStop(0, '#cfd8dc'); metal.addColorStop(1, '#546e7a');
        ctx.beginPath(); ctx.rect(17, -3.8, 31, 3.4); sprFill(ctx, metal);
        ctx.beginPath(); ctx.rect(17, 0.4, 31, 3.4); sprFill(ctx, metal);
        if (oc) {
            const heat = ctx.createLinearGradient(17, 0, 48, 0);
            heat.addColorStop(0, 'rgba(255, 109, 0, 0)'); heat.addColorStop(1, `rgba(255, 109, 0, ${0.5 + 0.25 * Math.sin(fxTime * 20)})`);
            ctx.fillStyle = heat; ctx.fillRect(17, -3.8, 31, 7.6);
        }
        ctx.fillStyle = '#263238'; ctx.fillRect(47, -3.8, 1.5, 7.6);
        ctx.beginPath(); ctx.rect(40, -4.3, 3, 8.6); sprFill(ctx, '#455a64');
        if (rare) drawRunes(20, 38, 0, '#ffab40', 1.3);
        // Brass receiver
        ctx.beginPath(); ctx.rect(4, -4.2, 13, 8.4); sprFill(ctx, rare ? '#ffd54f' : '#c8a046');
        sprEllipse(ctx, 10, 0, 1.5, 1.5, '#5d4037', false);
        // Pump
        ctx.beginPath(); ctx.rect(26 - pump, -5, 9, 10); sprFill(ctx, '#5d4037');
        ctx.strokeStyle = '#3e2723'; ctx.lineWidth = 1;
        ctx.beginPath(); for (let x = 28; x < 35; x += 2.5) { ctx.moveTo(x - pump, -5); ctx.lineTo(x - pump, 5); } ctx.stroke();
        drawHand(7, 1); drawHand(30.5 - pump, 0);
        if (pq >= 0.5 && !weaponAnim.shellOut) {
            weaponAnim.shellOut = true;
            const port = localToWorld(14, 4), a = A + Math.PI / 2 + (Math.random() - 0.5) * 0.6, sp = 110 + Math.random() * 70;
            spawnParticle({ kind: 'shell', x: port.x, y: port.y, z: 6, vz: 170, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, size: 1, life: 1.4, drag: 1.5, grow: 0, spin: 14, rot: Math.random() * 6 });
        }
        // Muzzle flash
        if (tSince < 0.07) {
            const f = 1 - tSince / 0.07;
            ctx.globalCompositeOperation = 'lighter';
            ctx.fillStyle = '#ff9800';
            ctx.beginPath(); ctx.moveTo(48, -4); ctx.lineTo(48 + 34 * f, 0); ctx.lineTo(48, 4); ctx.closePath(); ctx.fill();
            sprStar(ctx, 52, 0, 15 * f, '#ffca28');
            sprEllipse(ctx, 51, 0, 5 * f, 5 * f, '#ffffff', false);
            ctx.globalCompositeOperation = 'source-over';
        }
        weaponAnim.tip = localToWorld(49, 0);
        ctx.restore();
    },

    // Swordsaint: phantom blade (three-step combo in hand, autonomous in Airborne stance)
    phantom_blade(A) {
        const ab = player.airborneBlade, rare = isRareWeapon();
        let ang, bx, by, thrustExt = 0;

        if (player.stance === 'handheld') {
            const rest = A - Math.PI / 4;
            ang = rest;
            if (player.qAnimTimer > 0) {
                const e = Math.min(1, (1.0 - player.qAnimTimer / 0.25) * 2);
                const sweep = (x) => A - Math.PI / 1.2 + Math.PI * 1.6 * Math.min(1, x);
                ang = sweep(e);
                thrustExt = Math.sin(e * Math.PI) * 20;
                drawSwingTrail(sweep, e, 0.6, 38, 110, '#84ffff', 0.4);
            } else if (weaponAnim.swing > 0) {
                const p = attackProgress(0.22), step = player.lastAttackStep || 0;
                const sq = p / 0.5, tSince = fxTime - weaponAnim.attackAt;
                if (step === 2) {
                    ang = A;
                    thrustExt = sq < 1 ? Math.sin(easeOut(sq) * Math.PI) * 45 : 0;
                    if (tSince > 0.45) ang = lerp(A, rest, easeInOut((tSince - 0.45) / 0.2));
                } else {
                    // Alternate sweeps; the blade holds where a sweep ends so the next combo hit starts from there
                    const s = step === 0 ? 1 : -1;
                    const swingAng = (x) => A - s * 1.26 + s * 2.52 * easeOut(x);
                    ang = swingAng(Math.min(1, sq));
                    if (tSince > 0.45) ang = lerp(A + s * 1.26, rest, easeInOut((tSince - 0.45) / 0.2));
                    drawSwingTrail(swingAng, sq, 0.7, 38, 108, flowTrailColor(), 0.4);
                }
            }
            bx = player.x + Math.cos(A) * (15 + thrustExt);
            by = player.y + Math.sin(A) * (15 + thrustExt);
        } else {
            ang = ab.angle; bx = ab.x; by = ab.y;
        }

        const charged = player.flow >= player.maxFlow || player.empoweredAirborne;
        const isShattered = player.stance === 'airborne' && player.miniBlades && player.miniBlades.length > 0;

        // Afterimages: the blade's last few positions linger as fading ghosts while it moves
        let ghosts = weaponAnim.katanaGhosts || (weaponAnim.katanaGhosts = []);
        ghosts.push({ x: bx, y: by, ang });
        // A jump (blink, teleport) would smear one long ghost across the screen: forget the old positions
        if (ghosts.some(g => Math.hypot(g.x - bx, g.y - by) > 80)) ghosts = weaponAnim.katanaGhosts = [ghosts[ghosts.length - 1]];
        if (ghosts.length > 6) ghosts.shift();
        const oldest = ghosts[0];
        if (!isShattered && (Math.hypot(oldest.x - bx, oldest.y - by) > 4 || Math.abs(oldest.ang - ang) > 0.06)) {
            ghosts.slice(0, -1).forEach((g, i) => {
                ctx.save();
                ctx.translate(g.x, g.y); ctx.rotate(g.ang);
                drawKatanaGhost(player.empoweredAirborne ? '#84ffff' : '#00e5ff', 0.07 + 0.05 * i);
                ctx.restore();
            });
        }

        ctx.save();
        ctx.translate(bx, by);
        ctx.rotate(ang);
        // Once the blade shatters into Shatter Storm shards, only the glowing hilt remains
        drawKatana({ charged, empowered: player.empoweredAirborne, rare, blade: !isShattered });
        if (player.stance === 'handheld') drawHand(11, 0);
        ctx.restore();

        // Shatter Storm shards: small spectral blade fragments
        if (player.miniBlades && player.miniBlades.length > 0) {
            for (const mb of player.miniBlades) {
                ctx.save();
                ctx.translate(mb.x, mb.y); ctx.rotate(mb.angle);
                ctx.scale(0.3, 0.3); ctx.translate(-60, 0);
                drawKatana({ charged: true, empowered: player.empoweredAirborne, hilt: false });
                ctx.restore();
            }
        }
    },

    // Cleric: a thurible on a chain, swaying like a pendulum and whipped toward the aim on each attack
    censer(A) {
        const p = attackProgress(0.3), rare = isRareWeapon();
        const shadow = buffs.lastSpellClass === 'shadow' || buffs.aspectOfReaper > 0;
        const core = rare ? '#e040fb' : (shadow ? '#9c27b0' : '#fbc02d');
        const [hx, hy] = polar(A, 10, 11);
        const whip = p < 1 ? Math.sin(easeOut(p) * Math.PI) : 0;
        const ang = lerp(A + 0.5 + Math.sin(fxTime * 3.2) * 0.45, A, whip);
        const len = 24 + 16 * whip;
        const cx = hx + Math.cos(ang) * len, cy = hy + Math.sin(ang) * len;
        // Sagging chain
        const sag = 5 * (1 - whip), mx = (hx + cx) / 2 + Math.cos(ang + Math.PI / 2) * sag, my = (hy + cy) / 2 + Math.sin(ang + Math.PI / 2) * sag;
        ctx.save();
        ctx.lineCap = 'round';
        ctx.strokeStyle = SPRITE_OUTLINE; ctx.lineWidth = 3.5;
        ctx.beginPath(); ctx.moveTo(hx, hy); ctx.quadraticCurveTo(mx, my, cx, cy); ctx.stroke();
        ctx.strokeStyle = '#d4b44a'; ctx.lineWidth = 2; ctx.setLineDash([2.5, 1.5]);
        ctx.beginPath(); ctx.moveTo(hx, hy); ctx.quadraticCurveTo(mx, my, cx, cy); ctx.stroke();
        ctx.restore();
        // Thurible
        ctx.save();
        ctx.translate(cx, cy); ctx.rotate(ang);
        ctx.shadowBlur = 14 + 10 * whip; ctx.shadowColor = core;
        sprEllipse(ctx, 0, 0, 7.5, 7.5, rare ? '#ffd54f' : '#fbc02d');
        ctx.shadowBlur = 0;
        ctx.strokeStyle = '#e65100'; ctx.lineWidth = 1.2;
        ctx.beginPath(); ctx.arc(0, 0, 5, 0, Math.PI * 2); ctx.stroke();
        ctx.globalCompositeOperation = 'lighter';
        for (let i = 0; i < 6; i++) { const a = i * Math.PI / 3 + fxTime; sprEllipse(ctx, Math.cos(a) * 5, Math.sin(a) * 5, 1, 1, core, false); }
        sprEllipse(ctx, 0, 0, 2.6 + whip * 1.5, 2.6 + whip * 1.5, core, false);
        ctx.globalCompositeOperation = 'source-over';
        ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 1.2;
        ctx.beginPath(); ctx.moveTo(-3.5, 0); ctx.lineTo(3.5, 0); ctx.moveTo(1, -3); ctx.lineTo(1, 3); ctx.stroke();
        if (rare) {
            ctx.save(); ctx.rotate(fxTime * 2);
            ctx.strokeStyle = '#ea80fc'; ctx.lineWidth = 1; ctx.setLineDash([3, 4]);
            ctx.shadowBlur = 8; ctx.shadowColor = '#e040fb'; ctx.globalAlpha = rarePulse();
            ctx.beginPath(); ctx.arc(0, 0, 11, 0, Math.PI * 2); ctx.stroke();
            ctx.restore();
        }
        ctx.restore();
        drawHand(hx, hy);
        weaponAnim.censer = { x: cx, y: cy, color: shadow ? '#7b1fa2' : '#fff8e1' };
    },

    // Druid (caster form): antler wand wrapped in vines; it flicks forward and its leaves flutter on each cast
    totem(A) {
        const p = attackProgress(0.3), rare = isRareWeapon();
        const flick = p < 1 ? Math.sin(easeOut(p) * Math.PI) : 0;
        const [hx, hy] = polar(A, 9 + flick * 6, 10);
        ctx.save();
        ctx.translate(hx, hy); ctx.rotate(A + 0.12 - flick * 0.45);
        // Antler shaft and tines
        ctx.beginPath(); ctx.moveTo(-4, -2); ctx.lineTo(22, -0.9); ctx.lineTo(24, 0); ctx.lineTo(22, 0.9); ctx.lineTo(-4, 2); ctx.closePath();
        sprFill(ctx, '#d7ccc8');
        sprStroke(ctx, '#d7ccc8', 1.5, () => { ctx.moveTo(12, -0.5); ctx.lineTo(18, -5); ctx.moveTo(16, 0.5); ctx.lineTo(21, 4.5); });
        if (rare) drawRunes(0, 12, 0, '#b2ff59', 1);
        // Vine spiral
        ctx.strokeStyle = rare ? '#76ff03' : '#558b2f'; ctx.lineWidth = 1.2;
        if (rare) { ctx.shadowBlur = 6; ctx.shadowColor = '#76ff03'; }
        ctx.beginPath(); for (let x = -2; x <= 20; x += 1) ctx.lineTo(x, Math.sin(x * 0.8) * 2); ctx.stroke();
        ctx.shadowBlur = 0;
        [[3, -1], [9, 1], [15, -1]].forEach(([x, s], i) => {
            const flutter = Math.sin(fxTime * 8 + i * 2) * 0.25 + (p < 1 ? Math.sin(p * Math.PI * 3) * 0.9 * (1 - p) : 0);
            sprLeaf(ctx, x, s * 1.5, s * 1.2 + flutter, 6, i === 1 ? '#8bc34a' : '#7cb342');
        });
        // Glowing bud
        const br = 2.6 + flick * 2;
        ctx.shadowBlur = 10 + flick * 10; ctx.shadowColor = '#76ff03';
        sprEllipse(ctx, 25, 0, br, br, '#ccff90', false);
        ctx.shadowBlur = 0;
        drawHand(0, 0);
        weaponAnim.wandTip = localToWorld(25, 0);
        ctx.restore();
    },

    mace(A) { drawPaladinWeapon(A); }, // paladin.js
};

// ==========================================
// Swordsaint spectral katana
// ==========================================
// Drawn in the current local frame: pommel at x=0, tip at x=95, blade curving toward -y.

function katanaBladePath() {
    ctx.beginPath();
    ctx.moveTo(24, -2.4);
    ctx.quadraticCurveTo(62, -5.4, 90, -2.6);  // spine
    ctx.quadraticCurveTo(94, -2.4, 95, -1);    // kissaki
    ctx.quadraticCurveTo(62, 0.2, 24, 2.4);    // edge
    ctx.closePath();
}

function drawKatanaGhost(color, alpha) {
    ctx.save();
    ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = alpha;
    katanaBladePath(); ctx.fillStyle = color; ctx.fill();
    ctx.restore();
}

function drawKatana({ charged = false, empowered = false, rare = false, hilt = true, blade = true } = {}) {
    const glow = empowered ? '#84ffff' : '#00e5ff';
    ctx.save();
    if (blade) {
        // Translucent ghost-steel, glowing harder at full Flow
        ctx.shadowBlur = charged ? 18 : (rare ? 12 : 8); ctx.shadowColor = glow;
        const steel = ctx.createLinearGradient(0, -4.5, 0, 2.4);
        steel.addColorStop(0, charged ? 'rgba(0, 229, 255, 0.75)' : 'rgba(77, 208, 225, 0.55)');
        steel.addColorStop(0.55, charged ? 'rgba(224, 247, 250, 0.9)' : 'rgba(178, 235, 242, 0.7)');
        steel.addColorStop(1, '#ffffff');
        katanaBladePath(); ctx.fillStyle = steel; ctx.fill();
        ctx.shadowBlur = 0;
        ctx.strokeStyle = charged ? '#e0ffff' : 'rgba(0, 229, 255, 0.9)'; ctx.lineWidth = 0.8; ctx.stroke();
        // Shinogi ridge and the wavy hamon temper line
        ctx.strokeStyle = 'rgba(0, 188, 212, 0.8)'; ctx.lineWidth = 0.6;
        ctx.beginPath(); ctx.moveTo(26, -1.5); ctx.quadraticCurveTo(62, -3.4, 88, -1.8); ctx.stroke();
        ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 0.9;
        ctx.beginPath();
        for (let x = 26; x <= 88; x += 2) { const t = (x - 24) / 66; ctx.lineTo(x, -1.6 * Math.sin(t * Math.PI) + 0.6 + Math.sin(x * 0.55) * 0.55); }
        ctx.stroke();
        if (rare) drawRunes(32, 74, -1.9, '#e0f7fa', 1);
    }
    if (hilt) {
        if (!blade) { ctx.shadowBlur = 14; ctx.shadowColor = glow; }
        ctx.beginPath(); ctx.rect(22, -2.8, 3, 5.6); sprFill(ctx, '#ffca28');           // habaki collar
        ctx.beginPath(); ctx.ellipse(20.5, 0, 2, 7.5, 0, 0, Math.PI * 2); sprFill(ctx, '#263238'); // round tsuba, seen edge-on
        ctx.strokeStyle = '#ffca28'; ctx.lineWidth = 0.8; ctx.stroke();
        ctx.shadowBlur = 0;
        ctx.beginPath(); ctx.rect(2.5, -2.6, 16.5, 5.2); sprFill(ctx, '#1a237e');        // tsuka
        ctx.strokeStyle = '#e0f7fa'; ctx.lineWidth = 0.9;                               // diamond ito wrap
        ctx.beginPath();
        for (let x = 4; x < 18; x += 3.2) { ctx.moveTo(x, -2.6); ctx.lineTo(x + 1.6, 0); ctx.lineTo(x, 2.6); }
        ctx.stroke();
        ctx.beginPath(); ctx.rect(0.5, -2.8, 2.5, 5.6); sprFill(ctx, '#ffca28');        // kashira cap
    }
    ctx.restore();
}

// Trail color for the Swordsaint's combo: brighter as Flow builds
function flowTrailColor() { return player.flow >= player.maxFlow ? '#84ffff' : (isRareWeapon() ? '#80deea' : '#e0f7fa'); }

function drawPlayerWeapon(aimAngle) {
    weaponAnim.tip = weaponAnim.censer = weaponAnim.wandTip = weaponAnim.bladeBase = null;
    if (isWildForm()) return; // claws are part of the wolf sprite
    const draw = activeClass && WEAPON_DRAW[activeClass.weapon];
    if (draw) draw(aimAngle);
    if (player.parryTimer > 0) drawParryGuard(aimAngle); // skillfx.js
}

// ==========================================
// One-shot effects when a basic attack fires
// ==========================================

const WEAPON_FIRE_FX = {
    bow(A) {
        const [x, y] = polar(A, 14);
        burst(x, y, A, 1.4, 4, { kind: 'dot', color: '#ffffff', size: 1.5, life: 0.2, speed: [60, 160] });
    },
    staff(A) {
        const last = projectiles[projectiles.length - 1];
        const color = last && last.resonance ? '#2196f3' : '#ffca28';
        const [x, y] = polar(A, 45);
        spawnParticle({ kind: 'ring', color, x, y, vx: 0, vy: 0, size: 4, grow: 90, life: 0.18 });
        burst(x, y, A, 1.0, 6, { kind: 'spark', color, size: 2, life: 0.2, speed: [150, 320] });
    },
    scattergun(A) {
        const [x, y] = polar(A, 52, 6);
        burst(x, y, A, 0.7, 10, { kind: 'spark', color: '#ffca28', size: 2.2, life: 0.16, speed: [300, 620], drag: 8 });
        burst(x, y, A, 1.0, 5, { kind: 'smoke', color: '#9e9e9e', size: 4, grow: 26, life: 0.6, speed: [30, 120], drag: 3 });
        addShake(1.2);
    },
    censer(A) {
        const [x, y] = polar(A, 40, 11);
        const color = buffs.lastSpellClass === 'shadow' ? '#ce93d8' : '#fff59d';
        spawnParticle({ kind: 'ring', color, x, y, vx: 0, vy: 0, size: 6, grow: 110, life: 0.2 });
        burst(x, y, A, 1.4, 6, { kind: 'dot', color, size: 1.8, life: 0.35, speed: [60, 180] });
    },
    totem(A) {
        const [x, y] = polar(A, 40, 6);
        burst(x, y, A, 1.6, 7, { kind: 'dot', color: '#b2ff59', size: 1.8, life: 0.45, speed: [40, 170] });
        burst(x, y, A, 2.0, 2, { kind: 'leaf', color: '#8bc34a', size: 6, life: 0.7, speed: [50, 120], drag: 2.5 });
    },
    claws(A) { // Druid Wild Form rakes (the Bite's fang marks land on the enemies themselves)
        if (player.lastWolfStep === 2) return;
        const s = player.lastWolfStep === 0 ? -1 : 1;
        const [x, y] = polar(A, 30, s * 10);
        burst(x, y, A - s * 0.9, 0.8, 5, { kind: 'spark', color: '#ffccbc', size: 1.8, life: 0.18, speed: [200, 380], drag: 7 });
    },
    mace(A) {
        if (hammerAway()) return;
        const [x, y] = polar(A, 56); // where the mace head lands
        burst(x, y, A, 2.2, 9, { kind: 'debris', color: '#8d6e63', size: 3.5, life: 0.5, speed: [80, 240], drag: 5 });
        burst(x, y, A, 2.6, 5, { kind: 'smoke', color: '#a1887f', size: 6, grow: 30, life: 0.5, speed: [30, 110], drag: 3 });
        burst(x, y, A, 1.8, 6, { kind: 'spark', color: '#ffe082', size: 2, life: 0.22, speed: [160, 360] });
    },
};

// ==========================================
// Continuous emitters (called from updateFx in game time)
// ==========================================

function emit(rate, dt, fn) { let n = rate * dt; while (n > 0) { if (n >= 1 || Math.random() < n) fn(); n--; } }
const jitter = (v) => (Math.random() - 0.5) * v;

function updateWeaponEmitters(dt) {
    if (player.hp <= 0) return;
    const w = weaponAnim;
    // Dragonknight: embers stream off the blade as Frenzy builds
    if (selectedClassId === 'dragonknight' && w.tip && w.bladeBase && player.frenzyStacks >= 3) {
        emit(player.frenzyStacks * 3, dt, () => {
            const t = Math.random();
            spawnParticle({ kind: 'dot', color: Math.random() < 0.5 ? '#ff7043' : '#ffab40', x: lerp(w.bladeBase.x, w.tip.x, t), y: lerp(w.bladeBase.y, w.tip.y, t),
                vx: jitter(40), vy: jitter(40), size: 1.4, life: 0.5, drag: 2, grow: 0, spin: 0, rot: 0 });
        });
    }
    // Spellweaver: motes drifting off the orb
    if (selectedClassId === 'spellweaver' && w.tip) {
        emit(player.arcaneResonance ? 16 : 5, dt, () => spawnParticle({ kind: 'dot', color: player.arcaneResonance ? '#64b5f6' : '#b3e5fc',
            x: w.tip.x + jitter(6), y: w.tip.y + jitter(6), vx: jitter(30), vy: jitter(30), size: 1.3, life: 0.6, drag: 1, grow: 0, spin: 0, rot: 0 }));
    }
    // Machinist: heat sparks from Overclocked barrels
    if (selectedClassId === 'machinist' && w.tip && buffs.overclockTimer > 0) {
        emit(12, dt, () => spawnParticle({ kind: 'spark', color: '#ff9100', x: w.tip.x, y: w.tip.y, vx: jitter(160), vy: jitter(160), size: 1.5, life: 0.25, drag: 4, grow: 0, spin: 0, rot: 0 }));
    }
    // Cleric: incense smoke from the thurible
    if (w.censer) {
        emit(9, dt, () => spawnParticle({ kind: 'smoke', color: w.censer.color, x: w.censer.x + jitter(4), y: w.censer.y + jitter(4),
            vx: jitter(24), vy: jitter(24) - 8, size: 2, grow: 9, life: 0.9, drag: 1, spin: 0, rot: 0 }));
    }
    // Druid: spores drifting off the wand's bud
    if (w.wandTip) {
        emit(4, dt, () => spawnParticle({ kind: 'dot', color: '#b2ff59', x: w.wandTip.x, y: w.wandTip.y, vx: jitter(30), vy: jitter(30), size: 1.3, life: 0.7, drag: 1, grow: 0, spin: 0, rot: 0 }));
    }
    // Player projectile trails
    for (const p of projectiles) {
        if (p.isEnemy) continue;
        if (p.shape === 'fireball' || p.type === 'fireball') {
            emit(40, dt, () => spawnParticle({ kind: 'dot', color: Math.random() < 0.5 ? (p.color || '#ffca28') : '#fff59d', x: p.x + jitter(4), y: p.y + jitter(4),
                vx: -p.vx * 0.1 + jitter(40), vy: -p.vy * 0.1 + jitter(40), size: 1.6, life: 0.3, drag: 3, grow: 0, spin: 0, rot: 0 }));
        } else if (p.type === 'druid_spore') {
            emit(20, dt, () => spawnParticle({ kind: 'dot', color: '#b2ff59', x: p.x + jitter(5), y: p.y + jitter(5), vx: jitter(30), vy: jitter(30), size: 1.3, life: 0.5, drag: 2, grow: 0, spin: 0, rot: 0 }));
        } else if (p.type === 'censer_pulse') {
            emit(18, dt, () => spawnParticle({ kind: 'dot', color: p.color, x: p.x + jitter(p.radius * 2), y: p.y + jitter(p.radius * 2), vx: jitter(20), vy: jitter(20), size: 1.4, life: 0.45, drag: 2, grow: 0, spin: 0, rot: 0 }));
        }
    }
}

// ==========================================
// Player projectiles (returns true when it drew the projectile)
// ==========================================

function safeShade(color, amt) { return /^#[0-9a-f]{6}$/i.test(color) ? sprShade(color, amt) : '#ffffff'; }

function drawPlayerProjectile(p) {
    if (drawSkillProjectile(p)) return true; // skillfx.js
    const ang = Math.atan2(p.vy, p.vx);
    if (p.shape === 'arrow') {
        ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(ang);
        const streak = ctx.createLinearGradient(-38, 0, -10, 0);
        streak.addColorStop(0, 'rgba(255, 255, 255, 0)'); streak.addColorStop(1, 'rgba(255, 255, 255, 0.35)');
        ctx.strokeStyle = streak; ctx.lineWidth = 2;
        ctx.beginPath(); ctx.moveTo(-38, 0); ctx.lineTo(-10, 0); ctx.stroke();
        ctx.strokeStyle = '#a1887f'; ctx.lineWidth = 1.8;
        ctx.beginPath(); ctx.moveTo(-13, 0); ctx.lineTo(8, 0); ctx.stroke();
        const glow = selectedClassId === 'ranger' && isRareWeapon();
        if (glow) { ctx.shadowBlur = 10; ctx.shadowColor = '#40c4ff'; }
        ctx.fillStyle = glow ? '#b3e5fc' : '#eceff1';
        ctx.beginPath(); ctx.moveTo(14, 0); ctx.lineTo(6, -3.2); ctx.lineTo(6, 3.2); ctx.closePath(); ctx.fill();
        ctx.shadowBlur = 0;
        ctx.fillStyle = '#e53935';
        ctx.beginPath(); ctx.moveTo(-7, 0); ctx.lineTo(-12, -3.5); ctx.lineTo(-15, -3.5); ctx.lineTo(-11, 0); ctx.closePath(); ctx.fill();
        ctx.fillStyle = '#f5f5f5';
        ctx.beginPath(); ctx.moveTo(-7, 0); ctx.lineTo(-12, 3.5); ctx.lineTo(-15, 3.5); ctx.lineTo(-11, 0); ctx.closePath(); ctx.fill();
        ctx.restore();
        return true;
    }
    if (p.shape === 'bullet') { // tracer
        const len = Math.min(26, Math.hypot(p.vx, p.vy) * 0.025);
        ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(ang);
        ctx.globalCompositeOperation = 'lighter';
        const g = ctx.createLinearGradient(-len, 0, 0, 0);
        g.addColorStop(0, 'rgba(255, 183, 77, 0)'); g.addColorStop(1, p.color || '#ffb74d');
        ctx.strokeStyle = g; ctx.lineWidth = 3; ctx.lineCap = 'round';
        ctx.beginPath(); ctx.moveTo(-len, 0); ctx.lineTo(0, 0); ctx.stroke();
        ctx.fillStyle = '#fff8e1'; ctx.beginPath(); ctx.arc(0, 0, 1.8, 0, Math.PI * 2); ctx.fill();
        ctx.restore();
        return true;
    }
    if (p.shape === 'fireball' || p.type === 'fireball') { // flickering layered flame
        const r = p.radius, flick = Math.sin(fxTime * 40 + p.x * 0.1) * 0.25;
        ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(ang);
        ctx.shadowBlur = 18; ctx.shadowColor = p.color;
        ctx.fillStyle = p.color;
        ctx.beginPath(); ctx.arc(0, 0, r, -Math.PI / 2, Math.PI / 2); ctx.lineTo(-r * (2.6 + flick), 0); ctx.closePath(); ctx.fill();
        ctx.shadowBlur = 0;
        ctx.fillStyle = safeShade(p.color, 0.5);
        ctx.beginPath(); ctx.arc(0.5, 0, r * 0.65, -Math.PI / 2, Math.PI / 2); ctx.lineTo(-r * (1.6 - flick), 0); ctx.closePath(); ctx.fill();
        ctx.fillStyle = '#ffffff';
        ctx.beginPath(); ctx.arc(1.5, 0, r * 0.38, 0, Math.PI * 2); ctx.fill();
        ctx.restore();
        return true;
    }
    if (p.type === 'druid_spore') { // pulsing seed pod
        const r = p.radius * 1.25 * (1 + Math.sin(fxTime * 12 + p.x * 0.05) * 0.12);
        ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(fxTime * 3);
        ctx.shadowBlur = 10; ctx.shadowColor = '#76ff03';
        const g = ctx.createRadialGradient(-r * 0.3, -r * 0.3, 0.5, 0, 0, r);
        g.addColorStop(0, '#ccff90'); g.addColorStop(0.6, '#4caf50'); g.addColorStop(1, '#1b5e20');
        ctx.fillStyle = g; ctx.beginPath(); ctx.arc(0, 0, r, 0, Math.PI * 2); ctx.fill();
        ctx.shadowBlur = 0;
        ctx.fillStyle = '#1b5e20';
        for (let i = 0; i < 3; i++) { const a = i * 2.1; ctx.beginPath(); ctx.arc(Math.cos(a) * r * 0.5, Math.sin(a) * r * 0.5, r * 0.18, 0, Math.PI * 2); ctx.fill(); }
        ctx.restore();
        return true;
    }
    if (p.shape === 'phantom_blade_proj') { // Swordsaint dash: an oversized spectral katana with motion blur
        ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(ang); ctx.scale(1.15, 1.15);
        for (let i = 3; i >= 1; i--) { ctx.save(); ctx.translate(-60 - i * 16, 0); drawKatanaGhost('#00e5ff', 0.1 * (4 - i)); ctx.restore(); }
        ctx.translate(-60, 0);
        drawKatana({ charged: true, hilt: false });
        ctx.restore();
        return true;
    }
    if (p.type === 'censer_pulse') { // radiant orb with a turning cross
        const r = p.radius;
        ctx.save(); ctx.translate(p.x, p.y);
        ctx.globalCompositeOperation = 'lighter';
        const g = ctx.createRadialGradient(0, 0, 0, 0, 0, r * 1.7);
        g.addColorStop(0, '#ffffff'); g.addColorStop(0.35, p.color); g.addColorStop(1, 'rgba(0, 0, 0, 0)');
        ctx.fillStyle = g; ctx.beginPath(); ctx.arc(0, 0, r * 1.7, 0, Math.PI * 2); ctx.fill();
        ctx.strokeStyle = p.color; ctx.lineWidth = 1.5;
        ctx.beginPath(); ctx.arc(0, 0, r, 0, Math.PI * 2); ctx.stroke();
        ctx.rotate(fxTime * 4);
        ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 1.5;
        ctx.beginPath(); ctx.moveTo(-r * 1.4, 0); ctx.lineTo(r * 1.4, 0); ctx.moveTo(0, -r * 1.4); ctx.lineTo(0, r * 1.4); ctx.stroke();
        ctx.restore();
        return true;
    }
    return false;
}
