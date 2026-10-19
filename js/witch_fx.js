// ==========================================
// witch_fx.js - The Witch's visuals: souls, zombies, toads, the toxic trail, every wt_* effect, the staff and the broom
// ==========================================
// witch.js (mechanics) owns the state (`wt`, `player.broom`, the enemy fields e.wtPoison / wtHex / toadT / wtHop / wtShrinkT,
// the effects); this file only draws them. Hooks: drawWitchGround (main.js, under enemies), drawWitchWorld (main.js, the zombies,
// above enemies and under the hero), drawWitchEffect (skillfx.js drawSkillEffect chain), drawWitchToad (enemysprites.js
// drawEnemySprite), sprWitchBroom (sprites.js drawCharacter, the side view while she flies), drawBlightstaff / blightstaffFire
// (weapons.js). Her poison is acid green, her hexes violet, her souls a pale ghost-green. Flat fills and the cached `glow` sprite.

const WFX = {
    acid: '#76ff03', venom: '#b2ff59', mist: '#69f0ae', deep: '#1b5e20', murk: '#2e7d32',
    soul: '#b9f6ca', soulCore: '#f1f8e9', hex: '#ab47bc', hexL: '#e1bee7', hexD: '#4a148c',
    bone: '#e8e0cc', boneD: '#a1887f', skin: '#8a9a74', skinD: '#5d6b4c', rag: '#4e4038', ragD: '#2e2620',
    toad: '#6b8e23', toadD: '#3e5a12', toadL: '#9ccc65', belly: '#c5d86d', eye: '#ffd54f',
    gown: '#2a1636', gownL: '#3d1f4f', hair: '#16121c', pale: '#e8dcd6', wood: '#4e342e', woodL: '#6d4c41', straw: '#a1887f', strawD: '#795548',
};
const WFX_TAU = Math.PI * 2;
// Particles spawned from a draw function: only once per game frame, so a paused game doesn't pile them up
function wfxTick(o) { if (o.wtFxAt === fxTime) return false; o.wtFxAt = fxTime; return true; }
function wfxRing(c, x, y, r, color, lw) { if (r <= 0.5 || lw <= 0.05) return; c.strokeStyle = color; c.lineWidth = lw; c.beginPath(); c.arc(x, y, r, 0, WFX_TAU); c.stroke(); }
// A hex circle: two rings, three crescent moons riding the band, a ring of tick runes. No cracks: sigils only.
function wfxSigil(c, x, y, r, rot, color, a, lw = 1.5) {
    if (a <= 0.01 || r <= 1) return;
    c.save(); c.translate(x, y); c.rotate(rot); c.globalAlpha *= Math.min(1, a);
    c.strokeStyle = color; c.lineWidth = lw; c.beginPath();
    c.moveTo(r, 0); c.arc(0, 0, r, 0, WFX_TAU);
    c.moveTo(r * 0.72, 0); c.arc(0, 0, r * 0.72, 0, WFX_TAU);
    for (let i = 0; i < 12; i++) { const an = i * Math.PI / 6, r0 = r * 0.76, r1 = r * (i % 3 ? 0.84 : 0.96); c.moveTo(Math.cos(an) * r0, Math.sin(an) * r0); c.lineTo(Math.cos(an) * r1, Math.sin(an) * r1); }
    c.stroke();
    c.fillStyle = color;
    for (let i = 0; i < 3; i++) { // crescents on the inner ring
        const an = i * WFX_TAU / 3, cx = Math.cos(an) * r * 0.42, cy = Math.sin(an) * r * 0.42, mr = Math.min(9, r * 0.12);
        const ix = cx + Math.cos(an) * mr * 0.6, iy = cy + Math.sin(an) * mr * 0.6;
        c.beginPath(); c.arc(cx, cy, mr, 0, WFX_TAU); c.moveTo(ix + mr * 0.8, iy); c.arc(ix, iy, mr * 0.8, 0, WFX_TAU); c.fill('evenodd');
    }
    c.restore();
}

// ==========================================
// Under the enemies: the trail, souls, hex circles, poison pools
// ==========================================

function drawWitchGround(c = ctx) {
    for (const ef of effects) { if (ef.type === 'wt_trail') wfxTrail(c, ef); else if (ef.type === 'wt_pool') wfxPool(c, ef); else if (ef.type === 'wt_grave') wfxGrave(c, ef); }
    for (const s of wt.souls) {
        const fadeIn = Math.min(1, s.t / 0.3), blink = s.life < 3 ? 0.55 + 0.45 * Math.sin(s.life * 14) : 1, a = fadeIn * blink;
        const near = Math.hypot(s.x - player.x, s.y - player.y) <= WT_SOUL_REACH, bob = Math.sin(fxTime * 3 + s.seed) * 3;
        c.fillStyle = `rgba(0, 0, 0, ${0.22 * a})`; c.beginPath(); c.ellipse(s.x, s.y + 6, 7, 3, 0, 0, WFX_TAU); c.fill(); // its shadow on the ground
        glow(c, s.x, s.y - 8 + bob, near ? 26 : 18, WFX.mist, (near ? 0.55 : 0.32) * a);
        wfxWisp(c, s.x, s.y - 8 + bob, 1, s.seed, a * (near ? 1 : 0.75));
        if (wfxTick(s) && Math.random() < 0.08) spawnParticle({ kind: 'dot', color: WFX.soul, x: s.x + jitter(8), y: s.y - 10 + bob, vx: jitter(10), vy: -18, size: 1.3, life: 0.8, drag: 1, grow: 0, spin: 0, rot: 0 });
    }
    for (const e of enemies) {
        if (e.dead) continue;
        const r = e.size / 2;
        if (e.wtHex > fxTime || e.toadT > 0) { // the Grave Hex: a violet circle under it, turning
            const left = e.toadT > 0 ? 1 : Math.min(1, (e.wtHex - fxTime) / 0.5);
            wfxSigil(c, e.x, e.y + r * 0.3, r + 9, fxTime * 0.8, WFX.hex, 0.6 * left, 1.4);
        }
        const p = e.wtPoison;
        if (p && p.n > 0) glow(c, e.x, e.y + r * 0.2, r + 8 + p.n * 2, WFX.acid, 0.1 + 0.04 * p.n); // a sickly halo, stronger with stacks
    }
}
// A poison pool (Toxic Crater, Plague Pond): a sickly green spread with bubbles, fading at the end
function wfxPool(c, ef) {
    const age = ef.maxLife - ef.life, a = Math.min(1, age / 0.25, ef.life / 0.5);
    glow(c, ef.x, ef.y, ef.r * 1.15, WFX.acid, 0.3 * a);
    glow(c, ef.x, ef.y, ef.r * 0.75, WFX.murk, 0.4 * a);
    c.save(); c.globalAlpha = 0.35 * a; c.strokeStyle = WFX.venom; c.lineWidth = 1.5; c.beginPath(); c.ellipse(ef.x, ef.y, ef.r, ef.r * 0.9, 0, 0, WFX_TAU); c.stroke(); // its sickly rim
    c.globalAlpha = 0.5 * a; c.strokeStyle = WFX.venom; c.lineWidth = 1;
    for (let i = 0; i < Math.round(ef.r / 12); i++) { // bubbles on loops of their own
        const ph = (age * 1.2 + i * 0.37) % 1, an = i * 2.39996, d = ef.r * 0.85 * Math.sqrt(((i * 0.618) % 1));
        c.globalAlpha = 0.6 * a * (1 - ph); c.beginPath(); c.arc(ef.x + Math.cos(an) * d, ef.y + Math.sin(an) * d * 0.9, 1.5 + ph * 4, 0, WFX_TAU); c.stroke();
    }
    c.restore();
}
// Open Grave: a dark pit with a violet rim, hands groping at its edge
function wfxGrave(c, ef) {
    const age = ef.maxLife - ef.life, a = Math.min(1, age / 0.3, ef.life / 0.4);
    glow(c, ef.x, ef.y, ef.r * 1.3, WFX.hex, 0.35 * a);
    c.save(); c.globalAlpha = 0.8 * a; c.fillStyle = '#120a0e'; c.beginPath(); c.ellipse(ef.x, ef.y, ef.r * 0.9, ef.r * 0.75, 0, 0, WFX_TAU); c.fill();
    c.strokeStyle = WFX.hexL; c.lineWidth = 2; c.stroke(); c.restore();
    for (let i = 0; i < 5; i++) { const an = i / 5 * WFX_TAU + Math.sin(age * 2 + i) * 0.2; wfxHand(c, ef.x + Math.cos(an) * ef.r * 0.8, ef.y + Math.sin(an) * ef.r * 0.66, an + Math.PI + Math.sin(age * 3 + i) * 0.4, 1, a); }
}
// A soul: a teardrop of pale green fire, its tail curling up and away
function wfxWisp(c, x, y, s, seed, a) {
    if (a <= 0.01) return;
    const sway = Math.sin(fxTime * 4 + seed) * 3 * s;
    c.save(); c.globalAlpha *= a;
    c.fillStyle = 'rgba(105, 240, 174, 0.55)'; c.beginPath();
    c.moveTo(x - 5 * s, y); c.quadraticCurveTo(x - 4 * s, y - 9 * s, x + sway, y - 17 * s); c.quadraticCurveTo(x + 4 * s, y - 8 * s, x + 5 * s, y); c.arc(x, y, 5 * s, 0, Math.PI); c.fill();
    c.fillStyle = WFX.soul; c.beginPath(); c.arc(x, y, 3.4 * s, 0, WFX_TAU); c.fill();
    c.fillStyle = WFX.soulCore; c.beginPath(); c.arc(x - 0.8 * s, y - 0.8 * s, 1.6 * s, 0, WFX_TAU); c.fill();
    c.restore();
}
// A bony hand clawing out of the ground, fingers toward `a`
function wfxHand(c, x, y, a, s, al) {
    if (al <= 0.02) return;
    c.save(); c.translate(x, y); c.rotate(a); c.scale(s, s); c.globalAlpha *= al;
    sprEllipse(c, 0, 0, 4, 3.4, WFX.bone);
    c.strokeStyle = WFX.bone; c.lineWidth = 1.5; c.lineCap = 'round'; c.beginPath();
    for (const f of [-2.4, -0.8, 0.8, 2.4]) { c.moveTo(3, f * 0.8); c.quadraticCurveTo(7, f, 9, f * 1.3 + 1); }
    c.moveTo(0, -3); c.lineTo(3, -6); c.stroke();
    c.restore();
}

// The toxic trail: one strip per flight, each piece fading as it ages, bubbles rising and popping along it
function wfxTrail(c, ef) {
    const P = ef.pts; if (P.length < 2) return;
    c.save(); c.lineCap = 'round'; c.lineJoin = 'round';
    for (const [w, col, al] of [[ef.w * 2.1, WFX.deep, 0.42], [ef.w * 1.35, WFX.murk, 0.5], [ef.w * 0.5, WFX.venom, 0.55]]) {
        c.lineWidth = w; c.strokeStyle = col;
        for (let i = 1; i < P.length; i++) {
            const age = (fxTime - P[i].t) / WT_TRAIL_LINGER, a = al * Math.max(0, 1 - age * age);
            if (a <= 0.01) continue;
            c.globalAlpha = a; c.beginPath(); c.moveTo(P[i - 1].x, P[i - 1].y); c.lineTo(P[i].x, P[i].y); c.stroke();
        }
    }
    c.globalAlpha = 1;
    for (let i = 0; i < P.length; i++) { // bubbles: each point has two on a loop of its own
        const q = P[i], age = fxTime - q.t; if (age > WT_TRAIL_LINGER) continue;
        for (let k = 0; k < 2; k++) {
            const ph = (age * 1.3 + k * 0.5 + (i * 0.37) % 1) % 1, bx = q.x + Math.sin(i * 7.1 + k * 3) * ef.w * 0.6, by = q.y + Math.cos(i * 5.3 + k * 2) * ef.w * 0.5;
            const br = 1.5 + ph * 3.5;
            c.globalAlpha = 0.7 * (1 - ph) * (1 - age / WT_TRAIL_LINGER);
            c.strokeStyle = WFX.venom; c.lineWidth = 1; c.beginPath(); c.arc(bx, by, br, 0, WFX_TAU); c.stroke();
        }
    }
    c.restore();
    if (wfxTick(ef) && Math.random() < 0.5) { const q = P[(Math.random() * P.length) | 0]; if (fxTime - q.t < WT_TRAIL_LINGER - 0.5) spawnParticle({ kind: 'smoke', color: WFX.mist, x: q.x + jitter(ef.w), y: q.y + jitter(ef.w), vx: jitter(10), vy: -14, size: 4, grow: 14, life: 0.9, drag: 1, spin: 0, rot: 0 }); }
}

// ==========================================
// The zombies (above the enemies, under the hero)
// ==========================================

function drawWitchWorld(c = ctx) {
    wfxArrows(c);
    for (const z of wt.zombies) wfxMinion(c, z);
    wfxStream(c);
    for (const e of enemies) { // poison bubbling off what she has poisoned
        const p = e.wtPoison; if (!p || !(p.n > 0) || e.dead || !wfxTick(e)) continue;
        if (wtUpg(1) === 'B' && wtHexed(e) && Math.random() < 0.12) { // Soul Leech: motes of life drifting from the hexed to her
            const [dx, dy, d] = getVector(e.x, e.y, player.x, player.y), sp = Math.min(260, d * 1.6);
            spawnParticle({ kind: 'dot', color: '#f48fb1', x: e.x + jitter(10), y: e.y + jitter(10), vx: dx / d * sp, vy: dy / d * sp, size: 1.6, life: Math.min(0.7, d / sp), drag: 0, grow: 0, spin: 0, rot: 0 });
        }
        if (Math.random() < 0.06 + 0.04 * p.n) spawnParticle({ kind: 'dot', color: Math.random() < 0.5 ? WFX.acid : WFX.venom, x: e.x + jitter(e.size * 0.6), y: e.y + jitter(e.size * 0.4), vx: jitter(12), vy: -26 - Math.random() * 20, size: 1.5 + Math.random(), life: 0.55, drag: 1, grow: 0, spin: 0, rot: 0 });
    }
}
// The Poison Spray while LMB is held: one steady stream from the skull, following the cursor. Mist puffs and droplets ride out
// along the cone on loops of their own (fxTime), so it flows without spawning anything per frame; it fades out on release.
const wfxSpraying = () => fxTime - wt.sprayAt < 0.15 && !player.broom;
function wfxStream(c) {
    const since = fxTime - wt.sprayAt; if (since > 0.2 || player.broom || player.hp <= 0) return;
    const k = clamp01(1 - (since - 0.1) / 0.1), a = wtAim(), [ox, oy] = polar(a, 42, 9), reach = WT_SPRAY_RANGE - 20, tn = Math.tan(WT_SPRAY_HALF);
    const ca = Math.cos(a), sa = Math.sin(a), at = (d, o) => [ox + ca * d - sa * o, oy + sa * d + ca * o];
    for (let i = 0; i < 11; i++) { // the mist, widening with the cone
        const q = (fxTime * 2.4 + i / 11) % 1, d = 6 + q * reach, o = (((i * 0.618) % 1) - 0.5) * 1.6 * tn * d, [x, y] = at(d, o);
        glow(c, x, y, 9 + d * 0.3, i % 2 ? WFX.mist : WFX.acid, 0.45 * k * Math.sin(Math.min(1, q * 1.6 + 0.15) * Math.PI));
    }
    glow(c, ox, oy, 18, WFX.acid, 0.6 * k); // where it leaves the skull
    c.save(); c.lineCap = 'round'; // the jet itself: a bright core thinning into the spray
    for (const [w, col, al] of [[9, WFX.acid, 0.3], [3.5, WFX.venom, 0.5]]) {
        const [ex, ey] = at(reach * 0.38, Math.sin(fxTime * 30) * 3);
        c.globalAlpha = al * k; c.strokeStyle = col; c.lineWidth = w; c.beginPath(); c.moveTo(ox, oy); c.lineTo(ex, ey); c.stroke();
    }
    c.restore();
    for (let i = 0; i < 26; i++) { // droplets, faster than the mist, thinning out toward the end
        const q = (fxTime * 3.3 + i / 26) % 1, d = 4 + q * reach, o = (((i * 0.381) % 1) - 0.5) * 2 * tn * d, [x, y] = at(d, o);
        c.globalAlpha = k * (1 - q * q); c.fillStyle = i % 3 ? WFX.venom : WFX.acid;
        c.beginPath(); c.arc(x, y, (1.5 + (i % 3) * 0.7) * (1 - q * 0.4), 0, WFX_TAU); c.fill();
    }
    c.globalAlpha = 1;
}

// Every minion: the grave it claws out of, its shadow, its body by kind (seen from above, +x its facing), a hit flash, its life bar
function wfxMinion(c, z) {
    const rising = z.rise > 0, k = rising ? 1 - z.rise / WT_ZOMBIE_RISE : 1, hp = Math.max(0, z.hp / z.max), bone = z.kind === 'archer';
    if (rising) { // the ground opens and it claws its way out
        c.fillStyle = 'rgba(30, 22, 16, 0.85)'; c.beginPath(); c.ellipse(z.x, z.y + 2, 15, 9, 0, 0, WFX_TAU); c.fill();
        glow(c, z.x, z.y, 22, WFX.mist, 0.45 * (1 - k));
        if (wfxTick(z) && Math.random() < 0.5) spawnParticle({ kind: 'debris', color: '#4e342e', x: z.x + jitter(16), y: z.y + jitter(10), vx: jitter(120), vy: jitter(120), size: 2.5, life: 0.4, drag: 5, grow: 0, spin: 4, rot: 0 });
    } else { c.fillStyle = 'rgba(0, 0, 0, 0.3)'; c.beginPath(); c.ellipse(z.x + 3, z.y + 5, bone ? 11 : 14, bone ? 9 : 11, 0, 0, WFX_TAU); c.fill(); }
    const swing = clamp01((fxTime - z.swingAt) / 0.28), lunge = swing < 1 ? Math.sin(swing * Math.PI) : 0;
    const step = Math.sin(z.walk) * (z.moving ? 1 : 0), sway = bone ? 0 : Math.sin(fxTime * 2.2 + z.seed) * 0.08;
    const skin = hp > 0.5 ? WFX.skin : hp > 0.25 ? '#8f8f72' : '#9e9a86'; // the dead grey as they rot away
    c.save(); c.translate(z.x, z.y); c.rotate(z.ang + sway); c.scale(0.55 + 0.45 * k, 0.55 + 0.45 * k);
    c.lineJoin = 'round';
    if (z.kind === 'knight') wfxKnightBody(c, z, skin, swing, lunge, step);
    else if (bone) wfxSkeletonBody(c, z, step);
    else wfxZombieBody(c, z, skin, lunge, step);
    if (fxTime - z.hitAt < 0.1) { c.fillStyle = 'rgba(255, 255, 255, 0.5)'; c.beginPath(); c.ellipse(-1, 0, 9, 12, 0, 0, WFX_TAU); c.ellipse(2.5, 0, 6.4, 6.2, 0, 0, WFX_TAU); c.fill(); } // a white wash over the body
    c.restore();
    if (rising) return;
    if (swing < 1 && z.target && z.kind === 'zombie') { // three claw marks across what it hits
        const t = z.target, a = z.ang, ox = t.x - Math.cos(a) * t.size * 0.25, oy = t.y - Math.sin(a) * t.size * 0.25;
        c.save(); c.globalAlpha = 1 - swing; c.strokeStyle = '#e6ee9c'; c.lineWidth = 1.6; c.lineCap = 'round'; c.beginPath();
        for (const f of [-5, 0, 5]) { const px = -Math.sin(a) * f, py = Math.cos(a) * f; c.moveTo(ox + px - Math.cos(a + 0.6) * 8, oy + py - Math.sin(a + 0.6) * 8); c.lineTo(ox + px + Math.cos(a + 0.6) * 8, oy + py + Math.sin(a + 0.6) * 8); }
        c.stroke(); c.restore();
    }
    if (swing < 1 && z.kind === 'knight') { // the sword's arc, rust-red and pale
        c.save(); c.globalAlpha = 0.55 * (1 - swing); c.strokeStyle = '#d7ccc8'; c.lineWidth = 3; c.lineCap = 'round';
        const R = 30, a0 = z.ang + 0.9, a1 = z.ang + 0.9 - 1.9 * easeOut(swing);
        c.beginPath(); c.arc(z.x, z.y, R, Math.min(a0, a1), Math.max(a0, a1)); c.stroke(); c.restore();
    }
    // its life, rotting away: a short bar under it
    c.fillStyle = 'rgba(0, 0, 0, 0.6)'; c.fillRect(z.x - 12, z.y + 17, 24, 3);
    c.fillStyle = hp > 0.35 ? '#9ccc65' : '#ffb74d'; c.fillRect(z.x - 12, z.y + 17, 24 * hp, 3);
    if (z.lives > 0) { c.fillStyle = '#ce93d8'; c.beginPath(); c.arc(z.x + 15, z.y + 18.5, 2, 0, WFX_TAU); c.fill(); } // Undying Legion: a life in hand
    if (wfxTick(z) && Math.random() < 0.07) spawnParticle({ kind: 'dot', color: WFX.mist, x: z.x + jitter(14), y: z.y + jitter(14), vx: jitter(8), vy: -20, size: 1.3, life: 0.7, drag: 1, grow: 0, spin: 0, rot: 0 });
}
function wfxRags(c, z) { // the torso in torn rags, a ragged hem behind
    c.beginPath();
    c.moveTo(6, -11); c.quadraticCurveTo(-4, -14, -9, -10);
    for (let i = 0; i <= 6; i++) { const t = i / 6, yy = -10 + 20 * t; c.lineTo(-9 - (i % 2 ? 4 : 0) - Math.sin(fxTime * 5 + i + z.seed) * 0.8, yy); }
    c.quadraticCurveTo(-4, 14, 6, 11); c.quadraticCurveTo(9, 0, 6, -11); c.closePath();
    sprFill(c, WFX.rag);
    c.strokeStyle = WFX.ragD; c.lineWidth = 1; c.beginPath(); c.moveTo(-6, -6); c.lineTo(2, -3); c.moveTo(-5, 5); c.lineTo(3, 7); c.stroke(); // tears
}
function wfxEyes(c, x, gap, r) { // green embers at the front of a dead skull
    c.shadowBlur = 6; c.shadowColor = WFX.acid; c.fillStyle = WFX.venom;
    for (const s of [-1, 1]) { c.beginPath(); c.arc(x, s * gap, r, 0, WFX_TAU); c.fill(); }
    c.shadowBlur = 0;
}
// A shambling corpse: rags, grey-green skin, both arms reaching out ahead
function wfxZombieBody(c, z, skin, lunge, step) {
    for (const s of [-1, 1]) sprEllipse(c, 1 + s * step * 4, s * 6, 4.5, 3.2, WFX.ragD); // feet, dragging
    for (const s of [-1, 1]) { // arms reaching forward, one a little ahead of the other; they lunge on a claw
        const reach = 15 + lunge * 7 + s * step * 2, hy = s * 6.5;
        sprStroke(c, skin, 3.6, () => { c.moveTo(-1, s * 10); c.quadraticCurveTo(6, s * 10, reach, hy); });
        c.strokeStyle = SPRITE_OUTLINE; c.lineWidth = 1.1; c.beginPath(); // clawed fingers
        for (const f of [-1.6, 0, 1.6]) { c.moveTo(reach, hy + f); c.lineTo(reach + 4 + lunge * 2, hy + f * 1.4); }
        c.stroke();
        sprEllipse(c, reach, hy, 2.6, 2.4, skin);
    }
    wfxRags(c, z);
    sprEllipse(c, -1, -10, 4.5, 3.6, skin); // a bare shoulder through the rags
    sprEllipse(c, 2.5, 0, 6.2, 6, skin); // the head, hunched forward
    c.strokeStyle = '#2f2a22'; c.lineWidth = 1.4; c.lineCap = 'round'; c.beginPath(); // lank strands of hair over the back of the skull
    for (const [hy, bend] of [[-4, -1], [-1.5, 0.5], [1.5, -0.5], [4, 1]]) { c.moveTo(3, hy * 0.6); c.quadraticCurveTo(-1, hy + bend, -5.5, hy * 1.25 + bend); }
    c.stroke();
    c.fillStyle = 'rgba(40, 30, 20, 0.5)'; c.beginPath(); c.ellipse(5.5, -1.5, 1.6, 2.4, 0.3, 0, WFX_TAU); c.fill(); // a rotten patch
    wfxEyes(c, 7.6, 2.6, 1.15);
}
// A Grave Knight: the same dead flesh in rusted mail and a dented kettle helm, a split round shield on the left arm and a notched
// sword in the right; the sword sweeps across on a swing
function wfxKnightBody(c, z, skin, swing, lunge, step) {
    for (const s of [-1, 1]) sprEllipse(c, 1 + s * step * 4, s * 7, 5, 3.5, '#3e3a36'); // iron-shod feet
    const sa = swing < 1 ? 0.9 - 1.9 * easeOut(swing) : 0.7; // the sword's angle from the right hand: raised, then across
    c.save(); c.translate(6, 10); c.rotate(sa); // the sword, under the arm
    sprStroke(c, '#8d8478', 3, () => { c.moveTo(0, 0); c.lineTo(22, 0); }); // a notched, rust-flecked blade
    c.strokeStyle = '#6d4c41'; c.lineWidth = 1; c.beginPath(); c.moveTo(8, -0.8); c.lineTo(10, 0.8); c.moveTo(15, -0.8); c.lineTo(17, 0.8); c.stroke();
    sprStroke(c, '#4e342e', 3.4, () => { c.moveTo(-1, -4); c.lineTo(-1, 4); }); // the crossguard
    c.restore();
    sprStroke(c, skin, 3.8, () => { c.moveTo(-1, 10); c.quadraticCurveTo(3, 12, 6 + lunge * 3, 10); }); // the sword arm
    sprEllipse(c, 6 + lunge * 3, 10, 2.6, 2.4, skin);
    wfxRags(c, z);
    c.beginPath(); c.ellipse(-1, 0, 7.5, 11.5, 0, 0, WFX_TAU); sprFill(c, '#7a7f87'); // a hauberk of old rings over the rags
    c.strokeStyle = 'rgba(40, 38, 44, 0.55)'; c.lineWidth = 0.8; c.beginPath();
    for (let i = -2; i <= 2; i++) { c.moveTo(-7, i * 4); c.quadraticCurveTo(-1, i * 4 + 1.5, 5, i * 4); }
    c.stroke();
    c.fillStyle = '#8e2424'; c.beginPath(); c.moveTo(5, -3.5); c.lineTo(-9, -3); c.lineTo(-12, 0); c.lineTo(-9, 3); c.lineTo(5, 3.5); c.closePath(); c.fill(); // a tattered red tabard down the middle
    c.strokeStyle = '#5c1515'; c.lineWidth = 1; c.stroke();
    sprStroke(c, skin, 3.6, () => { c.moveTo(-1, -10); c.quadraticCurveTo(4, -12, 9, -10); }); // the shield arm
    c.save(); c.translate(10, -11); // the shield: round, split, an iron boss, held out to the front-left
    c.beginPath(); c.ellipse(0, 0, 5.5, 11, 0, 0, WFX_TAU); sprFill(c, '#7b5236');
    c.fillStyle = 'rgba(225, 190, 231, 0.55)'; c.beginPath(); c.moveTo(1, -8); c.lineTo(3, 0); c.lineTo(1, 8); c.lineTo(-1, 0); c.closePath(); c.fill(); // a faded painted mark
    c.strokeStyle = '#3e2723'; c.lineWidth = 1; c.beginPath(); c.moveTo(-1, -10); c.lineTo(1.5, -2); c.lineTo(-0.5, 4); c.stroke(); // the split
    c.strokeStyle = '#a0a4a8'; c.lineWidth = 1.5; c.beginPath(); c.ellipse(0, 0, 5.5, 11, 0, 0, WFX_TAU); c.stroke(); // the iron rim
    sprEllipse(c, 1.2, 0, 2.2, 2.8, '#b0b4b8');
    c.restore();
    sprEllipse(c, 2.5, 0, 6.8, 6.6, '#8a9096'); // the kettle helm's brim, wider than the head
    sprEllipse(c, 2.5, 0, 5.2, 5, '#a3a9ae', false); // its dented crown
    sprEllipse(c, 1.2, -1.6, 2.2, 1.4, 'rgba(255, 255, 255, 0.35)', false); // a dull shine
    c.strokeStyle = '#8d6e63'; c.lineWidth = 0.9; c.beginPath(); c.arc(2.5, 0, 3.4, 2.2, 4.0); c.stroke(); // rust streaks
    c.strokeStyle = '#3e3a36'; c.lineWidth = 1.6; c.beginPath(); c.moveTo(5.5, 0); c.lineTo(9.2, 0); c.stroke(); // the nasal guard
    wfxEyes(c, 8.2, 2.8, 1.1); // eyes glowing under the brim
}
// A Skeleton Archer: a skull, a spine and a ribcage, the bow held out ahead, the string drawn back as the next shot comes
function wfxSkeletonBody(c, z, step) {
    const B = WFX.bone, BD = WFX.boneD, ready = clamp01(1 - z.swingT / WT_KINDS.archer.gap); // 0 just loosed, 1 about to loose
    const draw = ready < 0.45 ? 0 : easeOut((ready - 0.45) / 0.55);
    for (const s of [-1, 1]) sprEllipse(c, 1 + s * step * 4, s * 5.5, 3.6, 2.2, B); // bony feet
    c.strokeStyle = SPRITE_OUTLINE; c.lineWidth = 3.2; c.lineCap = 'round'; c.beginPath(); c.moveTo(-9, 0); c.lineTo(3, 0); c.stroke(); // the spine
    c.strokeStyle = B; c.lineWidth = 1.8; c.stroke();
    for (const [x, w] of [[0, 9], [-3, 8.5], [-6, 7]]) { // ribs arching out to both sides
        sprStroke(c, B, 1.4, () => { c.moveTo(x, 0); c.quadraticCurveTo(x - 1, -w, x - 4, -w + 1.5); c.moveTo(x, 0); c.quadraticCurveTo(x - 1, w, x - 4, w - 1.5); });
    }
    const bowX = 15, handX = 12 - draw * 9; // the bow arm out front (left), the draw hand pulling back (right)
    sprStroke(c, B, 1.8, () => { c.moveTo(1, -8); c.lineTo(bowX, -1.5); }); // the bow arm
    sprStroke(c, B, 1.8, () => { c.moveTo(1, 8); c.quadraticCurveTo(handX + 1, 6, handX, 0.5); }); // the draw arm
    c.strokeStyle = '#d7ccc8'; c.lineWidth = 0.8; c.beginPath(); c.moveTo(bowX - 1, -11); c.lineTo(handX, 0); c.lineTo(bowX - 1, 11); c.stroke(); // the string
    sprStroke(c, '#5d4037', 2.2, () => { c.moveTo(bowX - 1, -11); c.quadraticCurveTo(bowX + 6, 0, bowX - 1, 11); }); // the bow
    if (draw > 0.05) { // a bone arrow on the string, its tip glowing green
        sprStroke(c, '#e8e0cc', 1.2, () => { c.moveTo(handX, 0); c.lineTo(bowX + 6, 0); });
        c.fillStyle = WFX.venom; c.beginPath(); c.moveTo(bowX + 9, 0); c.lineTo(bowX + 5, -1.8); c.lineTo(bowX + 5, 1.8); c.closePath(); c.fill();
    }
    sprEllipse(c, 2, 0, 5.4, 5.2, B); // the skull
    c.fillStyle = BD; c.beginPath(); c.ellipse(-1, 0, 1.6, 2.4, 0, 0, WFX_TAU); c.fill(); // the hollow where the spine meets the skull
    sprEllipse(c, 5.4, -2.2, 1.6, 1.5, '#1a1410', false); sprEllipse(c, 5.4, 2.2, 1.6, 1.5, '#1a1410', false); // sockets
    wfxEyes(c, 5.6, 2.2, 0.8);
}
// Their arrows: bone shafts with a green-glowing tip
function wfxArrows(c) {
    c.save(); c.lineCap = 'round';
    for (const p of wt.arrows) {
        const a = Math.atan2(p.vy, p.vx), tx = p.x - Math.cos(a) * 14, ty = p.y - Math.sin(a) * 14;
        c.strokeStyle = 'rgba(105, 240, 174, 0.35)'; c.lineWidth = 4; c.beginPath(); c.moveTo(tx, ty); c.lineTo(p.x, p.y); c.stroke();
        c.strokeStyle = WFX.bone; c.lineWidth = 1.6; c.beginPath(); c.moveTo(tx, ty); c.lineTo(p.x, p.y); c.stroke();
        c.fillStyle = WFX.venom; c.beginPath(); c.arc(p.x, p.y, 2, 0, WFX_TAU); c.fill();
    }
    c.restore();
}

// ==========================================
// Toads (enemysprites.js drawEnemySprite, in place of the enemy's own sprite)
// ==========================================

function drawWitchToad(e) {
    const c = ctx, R = Math.max(9, Math.min(22, e.size * 0.42)), h = e.wtHop;
    const hopK = h && h.t > 0 ? 1 - h.t / 0.35 : 0, air = hopK > 0 ? Math.sin(hopK * Math.PI) : 0, ang = h ? h.ang : (e.facingAngle || 0);
    c.fillStyle = `rgba(0, 0, 0, ${0.3 - 0.12 * air})`; c.beginPath(); c.ellipse(e.x + 2, e.y + 4, R * (1 - 0.2 * air), R * 0.8 * (1 - 0.2 * air), 0, 0, WFX_TAU); c.fill();
    c.save(); c.translate(e.x, e.y - air * R * 0.7); c.rotate(ang); c.lineJoin = 'round';
    const s = R / 14, legOut = air; // the hind legs kick out straight behind on a hop, folded at its sides on a sit
    for (const sd of [-1, 1]) {
        if (legOut > 0.15) {
            sprStroke(c, WFX.toad, 3.4 * s, () => { c.moveTo(-6 * s, sd * 7 * s); c.lineTo(-14 * s - 8 * s * legOut, sd * (9 - 3 * legOut) * s); });
            sprEllipse(c, -15 * s - 9 * s * legOut, sd * (9 - 3 * legOut) * s, 4 * s, 2.4 * s, WFX.toadD);
        } else {
            c.beginPath(); c.ellipse(-5 * s, sd * 10 * s, 8 * s, 4.6 * s, sd * 0.5, 0, WFX_TAU); sprFill(c, WFX.toad); // the folded thigh
            sprEllipse(c, -1 * s, sd * 13.5 * s, 3.6 * s, 2.2 * s, WFX.toadD); // the foot poking forward
        }
        sprEllipse(c, 9 * s, sd * 8 * s, 2.6 * s, 2 * s, WFX.toadD); // the little front feet
    }
    const plague = e.wtToadKind === 'plague', fam = e.wtToadKind === 'fam', bloat = plague ? 1.1 + 0.04 * Math.sin(fxTime * 9 + e.x) : 1;
    c.beginPath(); c.ellipse(0, 0, 13 * s * bloat, 11 * s * bloat, 0, 0, WFX_TAU); sprFill(c, e.hitFlash > 0 ? '#ffffff' : plague ? '#7c8f2a' : WFX.toad); // the squat body
    if (plague) { c.fillStyle = '#cddc39'; for (const [wx, wy, wr] of [[-4, -6, 2], [2, 6, 1.8], [-8, 2, 1.6], [4, -3, 1.4]]) { c.beginPath(); c.arc(wx * s, wy * s, wr * s, 0, WFX_TAU); c.fill(); } } // pustules, ready to burst
    if (fam) { c.strokeStyle = WFX.hex; c.lineWidth = 2.2; c.beginPath(); c.arc(5 * s, 0, 8 * s, -1.2, 1.2); c.stroke(); } // the familiar's violet collar
    c.fillStyle = WFX.toadL; c.beginPath(); c.ellipse(-1 * s, 0, 8 * s, 4 * s, 0, 0, WFX_TAU); c.fill(); // a lighter stripe down the back
    c.fillStyle = WFX.toadD; for (const [wx, wy, wr] of [[-6, -5, 1.8], [-3, 6, 1.5], [3, -6, 1.3], [-8, 3, 1.2], [1, 5, 1.6], [5, 2, 1]]) { c.beginPath(); c.arc(wx * s, wy * s, wr * s, 0, WFX_TAU); c.fill(); } // warts
    c.beginPath(); c.ellipse(8 * s, 0, 6.5 * s, 8.5 * s, 0, 0, WFX_TAU); sprFill(c, WFX.toad, false); // the broad head
    c.strokeStyle = WFX.toadD; c.lineWidth = 1.1; c.beginPath(); c.arc(8.5 * s, 0, 6 * s, -1.0, 1.0); c.stroke(); // the wide mouth line round its snout
    for (const sd of [-1, 1]) { // eyes bulging on top, gold with a black slit
        sprEllipse(c, 6 * s, sd * 5 * s, 3 * s, 3 * s, WFX.toadL);
        c.fillStyle = WFX.eye; c.beginPath(); c.arc(6.6 * s, sd * 5 * s, 2 * s, 0, WFX_TAU); c.fill();
        c.fillStyle = '#111'; c.fillRect(5.4 * s, sd * 5 * s - 0.5 * s, 2.6 * s, 1 * s);
    }
    c.restore();
    if (e.toadT < 0.6) glow(c, e.x, e.y, R * 1.6, plague ? WFX.acid : WFX.hex, 0.4 * (1 - e.toadT / 0.6)); // the hex wearing off (a plague toad swelling to burst)
    const tb = e.wtBiteTo; if (fam && tb && fxTime - e.wtBiteAt < 0.15 && !tb.dead) { // a familiar's tongue lashing out at its prey
        c.save(); c.strokeStyle = '#e57373'; c.lineWidth = 2.4; c.lineCap = 'round'; c.beginPath(); c.moveTo(e.x, e.y); c.lineTo(lerp(e.x, tb.x, 0.9), lerp(e.y, tb.y, 0.9)); c.stroke(); c.restore();
    }
    return true;
}

// ==========================================
// Effects (skillfx.js drawSkillEffect)
// ==========================================

function drawWitchEffect(c, ef) {
    if (!ef.type || ef.type.charCodeAt(0) !== 119 || ef.type.slice(0, 3) !== 'wt_') return false; // 'w'
    const k = clamp01(ef.life / ef.maxLife), p = 1 - k;
    switch (ef.type) {
        case 'wt_trail': return true; // drawn on the ground (drawWitchGround)
        case 'wt_grave': case 'wt_pool': return true; // drawn on the ground (drawWitchGround)
        case 'wt_crush': { // Crushing Grip: the hands close, a ring snapping shut on the heap
            if (!ef.burstDone) { ef.burstDone = true; burst(ef.x, ef.y, 0, WFX_TAU, 10, { kind: 'debris', color: '#5d4037', size: 3, life: 0.4, speed: [80, 220], drag: 5 }); burst(ef.x, ef.y, 0, WFX_TAU, 8, { kind: 'spark', color: WFX.hexL, size: 2, life: 0.35, speed: [60, 180], drag: 4 }); }
            glow(c, ef.x, ef.y, ef.r * 1.3, WFX.hex, 0.45 * k);
            wfxRing(c, ef.x, ef.y, ef.r * (1.2 - 0.9 * easeOut(p)), `rgba(225, 190, 231, ${0.8 * k})`, 3);
            return true;
        }
        case 'wt_leech': // Soul Siphon: a burst of life off the dead
            if (!ef.burstDone) { ef.burstDone = true; burst(ef.x, ef.y, -Math.PI / 2, 2.4, 8, { kind: 'dot', color: '#f48fb1', size: 2, life: 0.6, speed: [40, 120], drag: 2 }); }
            glow(c, ef.x, ef.y, 28, '#f48fb1', 0.5 * k); glow(c, player.x, player.y, 34, WFX.mist, 0.45 * k);
            return true;
        case 'wt_charge_hit': // a knight's charge slamming home
            if (!ef.burstDone) { ef.burstDone = true; burst(ef.x, ef.y, ef.angle, 1.6, 10, { kind: 'spark', color: '#d7ccc8', size: 2.2, life: 0.3, speed: [150, 360], drag: 5 }); addShake(1.5); }
            wfxRing(c, ef.x, ef.y, 10 + 30 * easeOut(p), `rgba(215, 204, 200, ${0.7 * k})`, 2.5);
            return true;
        case 'wt_bone_rain': { // Bone Rain: the arrows fall out of the sky onto a circle, then strike all at once
            const land = WT_RAIN_DELAY / ef.maxLife, q = Math.min(1, p / land), n = ef.n * 4;
            wfxRing(c, ef.x, ef.y, ef.r, `rgba(232, 224, 204, ${0.35 + 0.35 * q})`, 1.5);
            glow(c, ef.x, ef.y, ef.r * 0.9, WFX.mist, 0.2 * q);
            c.save(); c.lineCap = 'round';
            for (let i = 0; i < n; i++) {
                const a = i * 2.39996, r = ef.r * Math.sqrt((i + 0.5) / n), x = ef.x + Math.cos(a) * r, y = ef.y + Math.sin(a) * r;
                if (q < 1) { const h = (1 - q) * 160 + (i % 3) * 12; c.strokeStyle = `rgba(232, 224, 204, ${0.4 + 0.6 * q})`; c.lineWidth = 1.6; c.beginPath(); c.moveTo(x + 4, y - h - 14); c.lineTo(x, y - h); c.stroke(); }
                else { c.globalAlpha = k; c.strokeStyle = WFX.bone; c.lineWidth = 1.4; c.beginPath(); c.moveTo(x, y); c.lineTo(x - 3, y - 7); c.stroke(); c.fillStyle = WFX.venom; c.beginPath(); c.arc(x, y, 1.6, 0, WFX_TAU); c.fill(); c.globalAlpha = 1; } // shafts standing in the ground
            }
            c.restore();
            if (q >= 1 && !ef.burstDone) { ef.burstDone = true; burst(ef.x, ef.y, 0, WFX_TAU, 14, { kind: 'debris', color: WFX.bone, size: 2.5, life: 0.4, speed: [60, 200], drag: 5 }); }
            return true;
        }
        case 'wt_swoop_crash': { // Swoop: she slams down, a green splash and a ring of dust rolling out
            if (!ef.burstDone) {
                ef.burstDone = true;
                burst(ef.x, ef.y, 0, WFX_TAU, 16, { kind: 'dot', color: WFX.venom, size: 2.4, life: 0.45, speed: [180, 420], drag: 4 });
                burst(ef.x, ef.y, 0, WFX_TAU, 10, { kind: 'smoke', color: '#a1887f', size: 6, grow: 26, life: 0.55, speed: [80, 220], drag: 4 });
            }
            glow(c, ef.x, ef.y, ef.r * 1.1, WFX.acid, 0.45 * k);
            wfxRing(c, ef.x, ef.y, ef.r * easeOut(Math.min(1, p * 2)), `rgba(178, 255, 89, ${0.8 * k})`, 3.5);
            wfxRing(c, ef.x, ef.y, ef.r * 0.6 * easeOut(Math.min(1, p * 2.6)), `rgba(215, 204, 200, ${0.6 * k})`, 2);
            return true;
        }
        case 'wt_soul_gather': { // Soul Sweep: a soul streaking up to the broom
            const q = easeOut(p), x = lerp(ef.x, player.x, q), y = lerp(ef.y, player.y - (player.z || 0), q);
            glow(c, x, y, 16, WFX.mist, 0.7 * k); wfxWisp(c, x, y, 0.8, 2, k);
            return true;
        }
        case 'wt_reap': { // Reaper's Ride: a pale scythe-crescent through the reaped
            if (!ef.burstDone) { ef.burstDone = true; burst(ef.x, ef.y, ef.angle, 2.4, 10, { kind: 'spark', color: WFX.soul, size: 2, life: 0.35, speed: [120, 300], drag: 5 }); }
            c.save(); c.globalAlpha = k; c.fillStyle = WFX.soulCore; c.beginPath();
            const a = ef.angle + Math.PI / 2, R = 26;
            c.arc(ef.x, ef.y, R, a - 1.3, a + 1.3); c.arc(ef.x - Math.cos(a) * 9, ef.y - Math.sin(a) * 9, R * 0.85, a + 1.2, a - 1.2, true); c.fill();
            c.restore();
            glow(c, ef.x, ef.y, 26, WFX.mist, 0.5 * k);
            return true;
        }
        case 'wt_toad_burst': { // Toad Plague: a toad pops in a cloud of poison
            if (!ef.burstDone) {
                ef.burstDone = true;
                for (let i = 0; i < 8; i++) { const a = i / 8 * WFX_TAU; spawnParticle({ kind: 'smoke', color: i % 2 ? WFX.murk : '#827717', x: ef.x, y: ef.y, vx: Math.cos(a) * ef.r * 1.6, vy: Math.sin(a) * ef.r * 1.6, size: 8, grow: 30, life: 0.6, drag: 3, spin: 0, rot: 0 }); }
                burst(ef.x, ef.y, 0, WFX_TAU, 10, { kind: 'dot', color: WFX.venom, size: 2.2, life: 0.45, speed: [100, 260], drag: 4 });
            }
            glow(c, ef.x, ef.y, ef.r * 1.1, WFX.acid, 0.5 * k);
            wfxRing(c, ef.x, ef.y, ef.r * easeOut(Math.min(1, p * 2)), `rgba(205, 220, 57, ${0.7 * k})`, 2.5);
            return true;
        }
        case 'wt_hex': { // the Grave Hex: a violet circle drawn in, flaring, then sinking into the ground
            const draw = Math.min(1, p / 0.25), r = ef.r * (0.8 + 0.2 * easeOut(draw));
            if (!ef.burstDone) { ef.burstDone = true; burst(ef.x, ef.y, 0, WFX_TAU, 14, { kind: 'spark', color: WFX.hexL, size: 2.2, life: 0.45, speed: [80, 240], drag: 4 }); burst(ef.x, ef.y, 0, WFX_TAU, 6, { kind: 'smoke', color: WFX.hexD, size: 8, grow: 30, life: 0.7, speed: [20, 70], drag: 2 }); }
            glow(c, ef.x, ef.y, r * 1.2, WFX.hex, 0.35 * k);
            glow(c, ef.x, ef.y, r * 0.8, WFX.hexD, 0.35 * k);
            wfxSigil(c, ef.x, ef.y, r, p * 1.5, ef.leech ? '#f48fb1' : WFX.hexL, k * draw, 2);
            wfxSigil(c, ef.x, ef.y, r * 0.55, -p * 2.5, WFX.venom, k * draw * 0.8, 1.2);
            if (ef.pull) for (let i = 0; i < 6; i++) { // bony hands out of the ground, clawing in to the centre
                const a = i / 6 * WFX_TAU + 0.3, d = r * (0.95 - 0.75 * easeOut(Math.min(1, p / 0.4)));
                wfxHand(c, ef.x + Math.cos(a) * d, ef.y + Math.sin(a) * d, a + Math.PI, 1.1, k);
            }
            return true;
        }
        case 'wt_call': // Raise Dead: a pale ring rolling out to the souls she calls
            wfxRing(c, ef.x, ef.y, ef.r * easeOut(p), `rgba(185, 246, 202, ${0.45 * k})`, 2.5);
            glow(c, ef.x, ef.y, 60, WFX.mist, 0.4 * k);
            return true;
        case 'wt_raise': { // a soul sinks into the earth, which bursts open in green fire
            if (!ef.burstDone) { ef.burstDone = true; burst(ef.x, ef.y, 0, WFX_TAU, 10, { kind: 'debris', color: '#5d4037', size: 3, life: 0.45, speed: [70, 200], drag: 5 }); burst(ef.x, ef.y, -Math.PI / 2, 1.2, 8, { kind: 'dot', color: WFX.mist, size: 2, life: 0.6, speed: [40, 120], drag: 2 }); }
            glow(c, ef.x, ef.y - 10 * k, 30, WFX.mist, 0.6 * k);
            c.save(); c.globalAlpha = k; c.fillStyle = 'rgba(105, 240, 174, 0.35)'; c.beginPath(); c.ellipse(ef.x, ef.y - 18 * p, 7 * k, 22 * k, 0, 0, WFX_TAU); c.fill(); c.restore();
            wfxWisp(c, ef.x, ef.y - 4 - 14 * k, 1, 0, k * k);
            return true;
        }
        case 'wt_zombie_fall': { // it slumps, then crumbles to dust; a Dark Pact sacrifice bursts instead (wt_pact draws the blast)
            if (!ef.burstDone) { ef.burstDone = true; burst(ef.x, ef.y, 0, WFX_TAU, ef.burst ? 4 : 8, { kind: 'smoke', color: '#6d6a58', size: 5, grow: 18, life: 0.6, speed: [20, 70], drag: 2 }); if (ef.kind === 'archer') burst(ef.x, ef.y, 0, WFX_TAU, 6, { kind: 'debris', color: WFX.bone, size: 2.5, life: 0.45, speed: [60, 160], drag: 5 }); }
            if (ef.burst) return true;
            if (ef.kind === 'archer') { // a skeleton clatters apart: a skull and a scatter of bones
                c.save(); c.globalAlpha = k; c.translate(ef.x, ef.y); c.rotate(ef.angle); c.lineCap = 'round';
                c.strokeStyle = WFX.bone; c.lineWidth = 2;
                for (const [x0, y0, x1, y1] of [[-8, -6, 0, -9], [-4, 7, 5, 4], [-12, 1, -5, 3], [2, -3, 9, -1]]) { c.beginPath(); c.moveTo(x0 * (1 + p * 0.3), y0 * (1 + p * 0.3)); c.lineTo(x1 * (1 + p * 0.3), y1 * (1 + p * 0.3)); c.stroke(); }
                c.fillStyle = WFX.bone; c.beginPath(); c.ellipse(8 + p * 6, 3, 5, 4.6, 0, 0, WFX_TAU); c.fill();
                c.restore(); return true;
            }
            c.save(); c.globalAlpha = k * 0.85; c.translate(ef.x, ef.y); c.rotate(ef.angle);
            c.fillStyle = WFX.rag; c.beginPath(); c.ellipse(-3, 0, 12 * (1 + 0.3 * p), 9 * (1 - 0.4 * p), 0, 0, WFX_TAU); c.fill();
            c.fillStyle = WFX.skinD; c.beginPath(); c.ellipse(8, 0, 5.5, 5, 0, 0, WFX_TAU); c.fill();
            c.restore();
            return true;
        }
        case 'wt_takeoff': // dust kicked up as the broom lifts away
            if (!ef.burstDone) { ef.burstDone = true; burst(ef.x, ef.y, 0, WFX_TAU, 8, { kind: 'smoke', color: '#a1887f', size: 5, grow: 20, life: 0.45, speed: [60, 160], drag: 4 }); burst(ef.x, ef.y, 0, WFX_TAU, 8, { kind: 'dot', color: WFX.mist, size: 1.6, life: 0.5, speed: [40, 140], drag: 3 }); }
            wfxRing(c, ef.x, ef.y, 12 + 40 * easeOut(p), `rgba(215, 204, 200, ${0.5 * k})`, 2);
            return true;
        case 'wt_land':
            if (!ef.burstDone) { ef.burstDone = true; burst(ef.x, ef.y, 0, WFX_TAU, 6, { kind: 'smoke', color: '#a1887f', size: 4, grow: 16, life: 0.35, speed: [50, 120], drag: 4 }); }
            wfxRing(c, ef.x, ef.y, 10 + 28 * easeOut(p), `rgba(215, 204, 200, ${0.45 * k})`, 1.6);
            return true;
        case 'wt_toad_hex': { // Hex of the Toad: a swirl of green-and-violet smoke closing on the circle, then a flash
            const r = ef.r;
            if (!ef.burstDone) {
                ef.burstDone = true;
                for (let i = 0; i < 16; i++) { const a = i / 16 * WFX_TAU; spawnParticle({ kind: 'smoke', color: i % 2 ? WFX.hex : WFX.murk, x: ef.x + Math.cos(a) * r, y: ef.y + Math.sin(a) * r, vx: -Math.sin(a) * 90 - Math.cos(a) * 60, vy: Math.cos(a) * 90 - Math.sin(a) * 60, size: 9, grow: 26, life: 0.7, drag: 2, spin: 0, rot: 0 }); }
                burst(ef.x, ef.y, 0, WFX_TAU, 18, { kind: 'spark', color: WFX.venom, size: 2.4, life: 0.5, speed: [100, 300], drag: 4 });
            }
            glow(c, ef.x, ef.y, r * 1.15, WFX.hex, 0.4 * k);
            glow(c, ef.x, ef.y, r * 0.8, WFX.murk, 0.35 * k);
            wfxSigil(c, ef.x, ef.y, r, -p * 2, WFX.hexL, k, 2.2);
            wfxRing(c, ef.x, ef.y, r * (1 - 0.85 * easeOut(p)), `rgba(178, 255, 89, ${0.7 * k})`, 3);
            return true;
        }
        case 'wt_poof': { // a puff of smoke: in goes the enemy, out hops a toad (and back again)
            if (!ef.burstDone) { ef.burstDone = true; burst(ef.x, ef.y, 0, WFX_TAU, 9, { kind: 'smoke', color: Math.random() < 0.5 ? '#9e9e9e' : WFX.hex, size: ef.r * 0.22, grow: ef.r * 0.6, life: 0.5, speed: [30, 110], drag: 3 }); }
            glow(c, ef.x, ef.y, ef.r * 1.1, WFX.hexL, 0.4 * k);
            for (let i = 0; i < 6; i++) { const a = i / 6 * WFX_TAU + p * 1.5, d = ef.r * (0.45 + 0.5 * easeOut(p)); c.fillStyle = `rgba(206, 147, 216, ${0.35 * k})`; c.beginPath(); c.arc(ef.x + Math.cos(a) * d, ef.y + Math.sin(a) * d, ef.r * 0.16 * (0.5 + 0.5 * k), 0, WFX_TAU); c.fill(); }
            return true;
        }
        case 'wt_pact': { // Dark Pact: the zombie bursts in a ring of poison, and a green streak of its life flies to her
            if (!ef.burstDone) { ef.burstDone = true; burst(ef.x, ef.y, 0, WFX_TAU, 18, { kind: 'dot', color: WFX.venom, size: 2.4, life: 0.5, speed: [150, 380], drag: 4 }); burst(ef.x, ef.y, 0, WFX_TAU, 8, { kind: 'smoke', color: WFX.murk, size: 9, grow: 34, life: 0.7, speed: [40, 140], drag: 3 }); burst(ef.x, ef.y, 0, WFX_TAU, 6, { kind: 'debris', color: WFX.bone, size: 3, life: 0.5, speed: [100, 240], drag: 5 }); }
            glow(c, ef.x, ef.y, ef.r * 1.1, WFX.acid, 0.5 * k);
            glow(c, ef.x, ef.y, ef.r * 0.9 * easeOut(Math.min(1, p * 2.5)), WFX.murk, 0.4 * k);
            wfxRing(c, ef.x, ef.y, ef.r * easeOut(Math.min(1, p * 2.5)), `rgba(178, 255, 89, ${0.8 * k})`, 3);
            const q = easeOut(Math.min(1, p * 1.8)), sx = lerp(ef.x, player.x, q), sy = lerp(ef.y, player.y, q) - Math.sin(q * Math.PI) * 30;
            if (q < 1) { glow(c, sx, sy, 16, WFX.mist, 0.7); wfxWisp(c, sx, sy, 0.8, 1, 1); }
            else glow(c, player.x, player.y, 36, WFX.mist, 0.6 * k);
            return true;
        }
        case 'wt_contagion': { // Contagion: a drip of poison arcing from the dead to the living
            const q = easeOut(Math.min(1, p * 1.6)), mx = (ef.x + ef.x2) / 2, my = (ef.y + ef.y2) / 2 - 26;
            c.save(); c.globalAlpha = 0.6 * k; c.strokeStyle = WFX.acid; c.lineWidth = 1.6; c.setLineDash([3, 4]);
            c.beginPath(); c.moveTo(ef.x, ef.y); c.quadraticCurveTo(mx, my, ef.x2, ef.y2); c.stroke(); c.setLineDash([]);
            const bx = (1 - q) * (1 - q) * ef.x + 2 * (1 - q) * q * mx + q * q * ef.x2, by = (1 - q) * (1 - q) * ef.y + 2 * (1 - q) * q * my + q * q * ef.y2;
            c.globalAlpha = 1; c.fillStyle = WFX.venom; c.beginPath(); c.arc(bx, by, 3, 0, WFX_TAU); c.fill();
            c.restore();
            return true;
        }
    }
    return false;
}

// ==========================================
// The broom (sprites.js drawCharacter while player.broom): a side view, her exception to the top-down rule
// ==========================================
// Drawn unrotated (stampSprite skips the facing turn): +x is the way she flies after a flip for a leftward heading, and the nose
// tips up when she flies up the screen. +y is down on screen here, not her right side.
function sprWitchBroom(c, p) {
    const h = p.heading || 0, flip = Math.cos(h) < 0, t = p.t, bob = Math.sin(t * 6) * 1.5, wave = (k) => Math.sin(t * 12 + k);
    c.save();
    if (flip) c.scale(-1, 1);
    c.rotate(Math.sin(h) * 0.4 - (p.bank || 0) * 0.08);
    c.translate(0, bob);
    for (let k = 0; k < 2; k++) { // the two souls she keeps, streaming behind
        const sx = -38 - k * 12 + Math.sin(t * 3 + k) * 3, sy = -14 + k * 10 + Math.cos(t * 4 + k * 2) * 3;
        c.shadowBlur = 10; c.shadowColor = WFX.mist; sprEllipse(c, sx, sy, 2.4, 2.4, WFX.soul, false); c.shadowBlur = 0;
    }
    // the bristles: a bundle of straw fanning back from the binding
    for (let i = -3; i <= 3; i++) sprStroke(c, i % 2 ? WFX.straw : WFX.strawD, 2.2, () => { c.moveTo(-24, 5); c.quadraticCurveTo(-32, 5 + i * 1.4, -42 - Math.abs(i) * 0.6, 5 + i * 2.6 + wave(i) * 0.6); });
    c.fillStyle = '#3e2723'; c.fillRect(-26, 2, 4, 6); // the cord binding it
    sprStroke(c, WFX.wood, 3, () => { c.moveTo(-26, 5); c.lineTo(20, 2); c.quadraticCurveTo(25, 1.5, 27, -1.5); }); // the handle, its tip curling up
    c.strokeStyle = WFX.woodL; c.lineWidth = 1; c.beginPath(); c.moveTo(-20, 4); c.lineTo(16, 2); c.stroke();
    // the gown draped over the broom, its hem streaming back
    c.beginPath(); c.moveTo(1, -6); c.quadraticCurveTo(6, 4, 4, 12);
    c.quadraticCurveTo(-4, 15 + wave(1) * 1.5, -12, 13 + wave(2) * 2); c.quadraticCurveTo(-20, 12 + wave(3) * 2, -24, 8 + wave(4) * 2);
    c.quadraticCurveTo(-14, 2, -8, -4); c.closePath(); sprFill(c, WFX.gown);
    c.strokeStyle = 'rgba(105, 240, 174, 0.45)'; c.lineWidth = 1; c.beginPath(); c.moveTo(4, 11.5); c.quadraticCurveTo(-4, 14.5, -12, 12.5); c.stroke(); // the hem's ghost-green trim
    sprEllipse(c, 4, 12.5, 3.2, 2, '#1a1020'); // a boot under the hem
    // the feather shawl streaming off her back
    for (let i = 0; i < 4; i++) sprLeaf(c, -3 - i * 2, -15 + i * 2.5, Math.PI + 0.25 + i * 0.12 + wave(i) * 0.05, 11 - i, i % 2 ? '#24182e' : '#140c1c');
    // her body, leaning into the flight
    c.beginPath(); c.moveTo(-6, -2); c.quadraticCurveTo(-5, -14, 2, -18); c.quadraticCurveTo(8, -16, 6, -4); c.closePath(); sprFill(c, WFX.gownL);
    c.strokeStyle = WFX.bone; c.lineWidth = 1; c.beginPath(); c.moveTo(4, -15); c.lineTo(1, -6); c.stroke(); // bone lacing
    // her long black hair, streaming back
    for (let i = 0; i < 3; i++) sprStroke(c, i % 2 ? '#16121c' : '#100c16', 3.2 - i * 0.6, () => { c.moveTo(4, -25 + i); c.bezierCurveTo(-6, -27 + i * 2 + wave(i) * 1.5, -16, -20 + i * 2 - wave(i + 1) * 2, -28 - i * 3, -18 + i * 3 + wave(i + 2) * 2.5); });
    // the head in profile: pale face to the front, hair over the back of the skull
    sprEllipse(c, 6, -24, 5.6, 5.8, WFX.pale);
    c.beginPath(); c.arc(5.5, -24.5, 6, Math.PI * 0.55, Math.PI * 1.85); c.closePath(); sprFill(c, WFX.hair, false);
    c.fillStyle = '#1a1020'; c.beginPath(); c.ellipse(9.2, -24.8, 0.9, 0.7, 0, 0, WFX_TAU); c.fill(); // her eye
    c.strokeStyle = '#6a1b3a'; c.lineWidth = 0.9; c.beginPath(); c.moveTo(10.3, -21.2); c.lineTo(8.6, -21); c.stroke(); // dark lips
    sprStroke(c, WFX.bone, 1.6, () => { c.moveTo(3, -29); c.quadraticCurveTo(-1, -36, -9, -34); c.moveTo(-1, -33); c.lineTo(-2, -38); }); // an antler sweeping back
    c.strokeStyle = '#d7ccc8'; c.lineWidth = 1.2; c.beginPath(); c.moveTo(1, -28.5); c.lineTo(10, -27.5); c.stroke(); // the bone circlet
    // her arm reaching down the handle, the pale hand gripping it
    sprStroke(c, WFX.gownL, 3, () => { c.moveTo(3, -15); c.quadraticCurveTo(10, -9, 14, 1); });
    sprEllipse(c, 14.5, 1.8, 2.4, 2.2, WFX.pale);
    c.restore();
}

// ==========================================
// The staff (weapons.js WEAPON_DRAW.blightstaff / WEAPON_FIRE_FX.blightstaff)
// ==========================================

// A crooked staff of grave-wood with a small skull on its head, green light in its sockets; it jerks forward on a spray
function drawBlightstaff(A) {
    if (player.broom || player.wtSwoop) return; // she holds the broom up there (and through the Swoop's dive)
    const p = attackProgress(0.25), rare = isRareWeapon(), spray = wfxSpraying();
    const jab = spray ? 4 + Math.sin(fxTime * 45) * 0.7 : p < 1 ? Math.sin(easeOut(p) * Math.PI) * 6 : 0; // held out and trembling while the stream flows
    const c = ctx;
    c.save(); c.translate(player.x, player.y); c.rotate(A); c.translate(jab, 9); c.rotate(-0.12);
    sprStroke(c, WFX.wood, 3.2, () => { c.moveTo(-14, 0); c.quadraticCurveTo(-2, 2.5, 8, -0.5); c.quadraticCurveTo(18, -2.5, 30, 0.5); });
    if (rare) drawRunes(-6, 22, 0, WFX.venom, 1.3);
    c.strokeStyle = WFX.boneD; c.lineWidth = 1; c.beginPath(); c.moveTo(24, -2.5); c.lineTo(27, 2.5); c.moveTo(26, -2.5); c.lineTo(29, 2.5); c.stroke(); // a binding below the skull
    const flare = spray ? 0.7 : p < 1 ? 1 - p : 0;
    glow(c, 37, 0, 14 + 10 * flare, WFX.acid, 0.35 + 0.4 * flare);
    sprEllipse(c, 37, 0, 6, 5.4, WFX.bone); // the skull from above: the dome, the brow toward the front
    sprEllipse(c, 41.5, 0, 2.6, 3.6, '#d7ccc8', false); // the face
    c.shadowBlur = 8; c.shadowColor = WFX.acid; c.fillStyle = flare > 0.2 ? '#f4ff81' : WFX.venom;
    for (const s of [-1, 1]) { c.beginPath(); c.arc(41, s * 1.9, 1.1, 0, WFX_TAU); c.fill(); }
    c.shadowBlur = 0;
    drawHand(2, 0);
    weaponAnim.tip = localToWorld(42, 0);
    c.restore();
}
function blightstaffFire(A) { // each tick of the stream throws a few loose drops past the cone's edge (the stream itself is wfxStream)
    const [x, y] = polar(A, 44, 9);
    burst(x, y, A, WT_SPRAY_HALF * 2.2, 2, { kind: 'dot', color: WFX.venom, size: 1.6, life: 0.3, speed: [280, 440], drag: 3 });
    if (Math.random() < 0.35) burst(x, y, A, WT_SPRAY_HALF * 1.2, 1, { kind: 'smoke', color: WFX.mist, size: 5, grow: 26, life: 0.5, speed: [160, 300], drag: 3 });
}
// weapons.js updateWeaponEmitters: a slow drip off the skull
function blightstaffDrip(dt) {
    const w = weaponAnim.tip; if (!w || player.broom) return;
    emit(3, dt, () => spawnParticle({ kind: 'dot', color: Math.random() < 0.5 ? WFX.acid : WFX.mist, x: w.x + jitter(4), y: w.y + jitter(4), vx: jitter(10), vy: 18 + Math.random() * 10, size: 1.4, life: 0.5, drag: 1, grow: 0, spin: 0, rot: 0 }));
}
