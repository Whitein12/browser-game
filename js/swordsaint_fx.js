// ==========================================
// swordsaint_fx.js - The Swordsaint's visuals: her longsword and its cuts, every ss_* effect, the tornado, the rank, bullet time
// ==========================================
// swordsaint.js owns the state (`ss`, the effects); this file only draws it.
// Hooks: drawSaintSword (weapons.js WEAPON_DRAW.saint_sword), drawSwordsaintGround (main.js, under enemies), drawSwordsaintWorld
// (main.js, above everything in the world), drawSwordsaintEffect / drawSwordsaintProjectile (skillfx.js chains; true when handled),
// drawSwordsaintScreen (main.js, screen space: bullet time).
// Her light is gold and white, her wind pale silver-blue, Mana Burst a blue prana jet. Flat fills and the cached `glow` sprite
// (bandits.js) wherever something is drawn many times a frame.

const SSFX = { gold: '#ffd54f', deep: '#ffb300', pale: '#fff8e1', white: '#ffffff', wind: '#e3f2fd', windD: '#90caf9', prana: '#82b1ff', steel: '#cfd8dc', blue: '#1f4aa8' };
const SSFX_TAU = Math.PI * 2, SSFX_TIP = 108, SSFX_HAND_SIDE = 9, SSFX_HAND_FWD = 4, SSFX_GRIP = 8; // the blade runs out nearly as far as her cuts reach (SS_CUT_RANGE): a longer blade, not a stretched sword
const SSFX_RANK_COL = ['#90a4ae', '#b3e5fc', '#80cbc4', '#ffe082', '#ffd54f'];
function ssfxTick(o) { if (o.ssFxAt === fxTime) return false; o.ssFxAt = fxTime; return true; } // particles from a draw: once per game frame
const ssfxQ = a => a ? clamp01((fxTime - a.t0) / a.dur) : 1;

// ---------- the longsword ----------

// The blade along +x in the hand's frame: a broad steel longsword with a gilded fuller and a raised ridge, a wide gold cross-guard
// with knobbed ends, a two-handed royal-blue grip bound in gold, a gold pommel with a sapphire
function ssfxBlade(c, lit, k) {
    const T = SSFX_TIP, B = 25; // the blade runs from B (the guard) to T (the tip)
    const blade = () => { c.beginPath(); c.moveTo(B, -6); c.lineTo(T - 22, -4.6); c.quadraticCurveTo(T - 8, -4, T, 0); c.quadraticCurveTo(T - 8, 4, T - 22, 4.6); c.lineTo(B, 6); c.closePath(); };
    if (lit > 0.05) { c.shadowBlur = 6 + 14 * lit; c.shadowColor = k ? '#ffe082' : '#fff8e1'; }
    blade();
    const g = c.createLinearGradient(0, -6, 0, 6);
    if (k) { g.addColorStop(0, '#ffffff'); g.addColorStop(0.5, '#fff3c4'); g.addColorStop(1, '#ffca28'); }
    else { g.addColorStop(0, '#ffffff'); g.addColorStop(0.45, '#dfe6ea'); g.addColorStop(0.55, '#b0bec5'); g.addColorStop(1, '#78909c'); }
    sprFill(c, g);
    c.shadowBlur = 0;
    c.fillStyle = k ? 'rgba(255, 248, 225, 0.9)' : 'rgba(232, 185, 49, 0.85)'; // the fuller, gilded
    c.beginPath(); c.moveTo(B + 3, -1.6); c.lineTo(T - 30, -1.1); c.lineTo(T - 26, 0); c.lineTo(T - 30, 1.1); c.lineTo(B + 3, 1.6); c.closePath(); c.fill();
    c.strokeStyle = 'rgba(255, 255, 255, 0.6)'; c.lineWidth = 0.8; c.beginPath(); c.moveTo(T - 26, 0); c.lineTo(T - 3, 0); c.stroke(); // the ridge to the point
    // the cross-guard: wide, swept a little toward the blade, knobbed ends
    c.beginPath(); c.moveTo(20, -3); c.quadraticCurveTo(22, -10, 26, -15); c.lineTo(23, -16); c.quadraticCurveTo(18, -11, 17, -3); c.lineTo(17, 3); c.quadraticCurveTo(18, 11, 23, 16); c.lineTo(26, 15); c.quadraticCurveTo(22, 10, 20, 3); c.closePath(); sprFill(c, '#e8b931');
    sprEllipse(c, 24.5, -15.8, 2.2, 2.2, '#e8b931'); sprEllipse(c, 24.5, 15.8, 2.2, 2.2, '#e8b931');
    sprEllipse(c, 20.5, 0, 2.6, 3.6, '#1f4aa8'); // a sapphire in the guard's heart
    c.beginPath(); c.rect(4, -2.7, 13, 5.4); sprFill(c, SSFX.blue); // the two-handed grip
    c.strokeStyle = '#e8b931'; c.lineWidth = 1; c.beginPath(); for (let x = 6; x < 16; x += 3) { c.moveTo(x, -2.7); c.lineTo(x + 1.6, 2.7); } c.stroke();
    sprEllipse(c, 2, 0, 3.8, 3.8, '#e8b931'); sprEllipse(c, 2, 0, 1.6, 1.6, '#82b1ff', false); // the pommel
}

// The original sword (ssBlade 'og'): a slimmer blade to 66 px, held from the sprite's centre
function ssfxBladeOg(c, lit, k) {
    const blade = () => { c.beginPath(); c.moveTo(20, -3.6); c.lineTo(58, -3); c.lineTo(66, 0); c.lineTo(58, 3); c.lineTo(20, 3.6); c.closePath(); };
    if (lit > 0.05) { c.shadowBlur = 6 + 14 * lit; c.shadowColor = k ? '#ffe082' : '#fff8e1'; }
    blade();
    if (k) { const g = c.createLinearGradient(0, -3.6, 0, 3.6); g.addColorStop(0, '#ffffff'); g.addColorStop(0.5, '#fff3c4'); g.addColorStop(1, '#ffca28'); sprFill(c, g); }
    else { const g = c.createLinearGradient(0, -3.6, 0, 3.6); g.addColorStop(0, '#ffffff'); g.addColorStop(0.5, '#cfd8dc'); g.addColorStop(1, '#78909c'); sprFill(c, g); }
    c.shadowBlur = 0;
    c.strokeStyle = k ? '#fff8e1' : '#e8b931'; c.lineWidth = 1.1; c.beginPath(); c.moveTo(23, 0); c.lineTo(54, 0); c.stroke(); // the fuller, gilded
    c.beginPath(); c.moveTo(16, -10); c.quadraticCurveTo(20, -6, 21, -2); c.lineTo(21, 2); c.quadraticCurveTo(20, 6, 16, 10); c.lineTo(18.5, 0); c.closePath(); sprFill(c, '#e8b931'); // the guard
    c.beginPath(); c.rect(6, -2, 11, 4); sprFill(c, SSFX.blue);
    c.strokeStyle = '#e8b931'; c.lineWidth = 0.8; c.beginPath(); for (let x = 8; x < 16; x += 3) { c.moveTo(x, -2); c.lineTo(x + 1.4, 2); } c.stroke();
    sprEllipse(c, 4.6, 0, 2.8, 2.8, '#e8b931');
}

function drawSaintSword(A) {
    const a = typeof ss !== 'undefined' ? ss.anim : null, live = a && fxTime - a.t0 < a.dur + 0.35, q = ssfxQ(a);
    const rank = typeof ss !== 'undefined' ? ssRank() : 0, unsealed = typeof ss !== 'undefined' && ss.unsealed > 0;
    const charging = player.charge && player.charge.slot === 4, ck = charging ? clamp01(player.charge.t / player.charge.max) : 0;
    const s = a ? a.side || 1 : 1, rest = A + 0.95; // at rest the point leads low on her right
    const OG = ssBlade === 'og', TIP = OG ? 66 : SSFX_TIP;
    let ang = rest, len = 1, fwd = 0, trail = null;
    if (charging) { ang = A + Math.PI + 0.2; len = 0.32; } // raised straight overhead: from above, nearly only the hilt shows
    else if (live) {
        const k = a.kind, back = clamp01((fxTime - a.t0 - a.dur) / 0.3);
        if (k === 'cut') {
            const at = x => A - s * 1.35 + s * 2.7 * easeOut(x);
            ang = q < 1 ? at(q) : lerp(at(1), rest, easeInOut(back));
            trail = [at, q, 0.65, 26, OG ? 70 : ssB().cut]; // the long sword's trail sweeps out as far as the cut reaches
        } else if (k === 'thrust') {
            ang = q < 1 ? A : lerp(A, rest, easeInOut(back)); fwd = q < 0.35 ? 16 * easeOut(q / 0.35) : 16 * (1 - easeInOut((q - 0.35) / 0.65)); len = 1.08;
        } else if (k === 'dash' || k === 'burst') {
            ang = q < 1 ? A + s * 2.5 : lerp(A + s * 2.5, rest, easeInOut(back)); // swept back along the dash
        } else if (k === 'spin') {
            const at = x => A + 0.6 + SSFX_TAU * easeOut(x);
            ang = q < 1 ? at(q) : lerp(at(1) - SSFX_TAU, rest, easeInOut(back)); len = 1.08;
            trail = [at, q, 0.55, 24, OG ? 74 : ssSpinR()];
        } else if (k === 'leap') { ang = A + Math.PI + 0.3; len = 0.4 + 0.2 * Math.sin(q * Math.PI); }
        else if (k === 'slam' || k === 'beam') {
            if (q < 0.3) { ang = A + Math.PI + 0.3; len = 0.4 * (1 - q / 0.3) + 0.02; } else { const r = (q - 0.3) / 0.7; ang = A; len = r < 0.4 ? 1.18 * easeOut(r / 0.4) : lerp(1.18, 1, (r - 0.4) / 0.6); }
            if (q >= 1) ang = lerp(A, rest, easeInOut(back));
        } else if (k === 'air') {
            const at = x => A + 1.2 - 2.4 * easeOut(x);
            ang = q < 1 ? at(q) : lerp(at(1), rest, easeInOut(back)); trail = [at, q, 0.7, 20, 60, true];
        } else if (k === 'cross') {
            const h = q < 0.5, x = h ? q / 0.5 : (q - 0.5) / 0.5, at = h ? (y => A - 1.25 + 2.5 * easeOut(y)) : (y => A + 1.25 - 2.5 * easeOut(y));
            ang = q < 1 ? at(x) : lerp(A - 1.25, rest, easeInOut(back)); trail = [at, x, 0.7, OG ? 28 : 44, ssB().cross + 4]; // the tip passes over the X's crossing point (ssB().cross)
            if (OG) fwd = q < 1 ? 18 * easeOut(Math.min(1, q * 4)) : 18 * (1 - easeInOut(back)); // the short blade lunges into it
        } else if (k === 'unseal') { ang = q < 1 ? A + Math.sin(q * Math.PI) * -0.4 : rest; len = 1 + 0.1 * Math.sin(q * Math.PI); }
    }
    const lit = Math.max(unsealed ? 1 : 0, ck, rank >= 3 ? (rank - 2) * 0.35 : 0);
    if (trail && trail[1] < 1.5) drawSwingTrail(trail[0], trail[1], trail[2], trail[3], trail[4], trail[5] ? '#e3f2fd' : unsealed || rank >= 3 ? '#ffd54f' : '#ffffff', 0.5);

    ctx.save();
    // the sword turns round her right hand, ahead of her and to her side, so the hilt sits in her grip and not over her head
    // (raised for Excalibur it stays centred: overhead is the pose)
    const hs = charging || OG ? 0 : SSFX_HAND_SIDE, hf = charging || OG ? 0 : SSFX_HAND_FWD;
    ctx.translate(player.x + Math.cos(A) * (fwd + hf) - Math.sin(A) * hs, player.y + Math.sin(A) * (fwd + hf) + Math.cos(A) * hs); ctx.rotate(ang); ctx.scale(Math.max(0.02, len), 1);
    if (!charging && !OG) ctx.translate(-SSFX_GRIP, 0); // the grip, not the pommel, in her hand
    (OG ? ssfxBladeOg : ssfxBlade)(ctx, lit, unsealed || ck > 0);
    if (isRareWeapon()) drawRunes(26, OG ? 50 : TIP * 0.7, 0, '#82b1ff', 1.4); // Caliburn: wind-blue runes
    if (OG) { drawHand(10, 0); drawHand(15, 0); } else { drawHand(8, 0); drawHand(14, 0); }
    weaponAnim.tip = localToWorld(TIP - 2, 0); weaponAnim.bladeBase = localToWorld(22, 0);
    ctx.restore();

    if (charging) { // the light gathers on the raised blade
        glow(ctx, player.x, player.y - 4, 30 + 40 * ck, '#ffd54f', 0.35 + 0.5 * ck);
        glow(ctx, player.x, player.y - 4, 12 + 10 * ck, '#ffffff', 0.5 + 0.5 * ck);
        if (ck >= 1) { ctx.save(); ctx.strokeStyle = `rgba(255, 255, 255, ${0.5 + 0.4 * Math.sin(fxTime * 30)})`; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(player.x, player.y, player.radius + 20, 0, SSFX_TAU); ctx.stroke(); ctx.restore(); }
        if (ssfxTick(player.charge)) for (let i = 0; i < 2; i++) { // motes drawn in
            const r = 70 + Math.random() * 50, t = Math.random() * SSFX_TAU, x = player.x + Math.cos(t) * r, y = player.y + Math.sin(t) * r;
            spawnParticle({ kind: 'dot', color: Math.random() < 0.5 ? '#ffe082' : '#ffffff', x, y, vx: (player.x - x) * 3, vy: (player.y - y) * 3, size: 2.2, life: 0.3, drag: 0, grow: -2, spin: 0, rot: 0 });
        }
    } else if ((unsealed || rank >= 4) && weaponAnim.tip && Math.random() < (unsealed ? 0.5 : 0.25)) { // gold sword-light off the blade
        const t = 0.3 + Math.random() * 0.7, b = weaponAnim.bladeBase, p = weaponAnim.tip;
        spawnParticle({ kind: 'dot', color: Math.random() < 0.5 ? '#ffe082' : '#fff8e1', x: lerp(b.x, p.x, t), y: lerp(b.y, p.y, t), vx: jitter(30), vy: jitter(30) - 15, size: 1.8, life: 0.35, drag: 2, grow: -1, spin: 0, rot: 0 });
    }
}

// ---------- the ground: the Style aura, the beam's lane, the tornado's shadow ----------

function drawSwordsaintGround(c) {
    if (typeof ss === 'undefined') return;
    const rank = ssRank();
    if (rank >= 2 && player.hp > 0) { // the higher her Style, the brighter the ground round her
        const pulse = 0.8 + 0.2 * Math.sin(fxTime * 4);
        glow(c, player.x, player.y, 40 + rank * 9, SSFX_RANK_COL[rank], (0.12 + 0.06 * rank) * pulse);
        if (rank >= 4) { c.save(); c.strokeStyle = 'rgba(255, 213, 79, 0.45)'; c.lineWidth = 1.5; c.beginPath(); c.arc(player.x, player.y, player.radius + 14, fxTime * 2, fxTime * 2 + Math.PI * 1.2); c.moveTo(player.x + Math.cos(fxTime * 2 + Math.PI) * (player.radius + 14), player.y + Math.sin(fxTime * 2 + Math.PI) * (player.radius + 14)); c.arc(player.x, player.y, player.radius + 14, fxTime * 2 + Math.PI, fxTime * 2 + Math.PI * 2.2); c.stroke(); c.restore(); }
    }
    if (player.charge && player.charge.slot === 4) { // Excalibur's lane, as wide as the beam, brightening as it fills
        const k = clamp01(player.charge.t / player.charge.max), A = Math.atan2(mouseY - player.y, mouseX - player.x);
        c.save(); c.translate(player.x, player.y); c.rotate(A);
        c.fillStyle = `rgba(255, 213, 79, ${0.08 + 0.14 * k})`; c.fillRect(20, -SS_BEAM_W, SS_BEAM_LEN - 20, SS_BEAM_W * 2);
        c.strokeStyle = `rgba(255, 236, 179, ${0.35 + 0.4 * k})`; c.lineWidth = 1.5;
        c.beginPath(); c.moveTo(20, -SS_BEAM_W); c.lineTo(SS_BEAM_LEN, -SS_BEAM_W); c.moveTo(20, SS_BEAM_W); c.lineTo(SS_BEAM_LEN, SS_BEAM_W); c.stroke();
        c.fillStyle = `rgba(255, 255, 255, ${0.25 + 0.35 * k})`; c.fillRect(20, -2, (SS_BEAM_LEN - 20) * k, 4); // the charge runs down the lane
        c.restore();
    }
    for (const w of ss.winds) { c.save(); c.fillStyle = 'rgba(0, 0, 0, 0.18)'; c.beginPath(); c.ellipse(w.x + 4, w.y + 8, SS_WIND_R, SS_WIND_R * 0.6, 0, 0, SSFX_TAU); c.fill(); c.restore(); }
    for (const cy of ss.cyclones) { c.save(); c.fillStyle = 'rgba(0, 0, 0, 0.16)'; c.beginPath(); c.ellipse(cy.x + 4, cy.y + 8, 70, 44, 0, 0, SSFX_TAU); c.fill();
        c.strokeStyle = `rgba(227, 242, 253, ${0.35 * Math.min(1, cy.t * 2)})`; c.lineWidth = 1.5; c.beginPath(); c.arc(cy.x, cy.y, SS_EYE_R, 0, SSFX_TAU); c.stroke(); c.restore(); } // its reach
    for (const l of ss.launched) if (!l.e.dead) { // Tempest Dance: the shadow stays on the ground, smaller the higher it is
        const k = 1 - Math.min(0.5, (l.e.mkLift || 0) / 100); c.save(); c.fillStyle = 'rgba(0, 0, 0, 0.3)'; c.beginPath(); c.ellipse(l.e.x, l.e.y + l.e.size * 0.3, l.e.size * 0.5 * k, l.e.size * 0.3 * k, 0, 0, SSFX_TAU); c.fill(); c.restore(); }
    for (const w of ss.wakes) { // Prana Wake: a strip of blue fire along the burst
        const k = Math.min(1, w.t / 0.4), a = Math.atan2(w.y1 - w.y0, w.x1 - w.x0), L = Math.hypot(w.x1 - w.x0, w.y1 - w.y0);
        c.save(); c.translate(w.x0, w.y0); c.rotate(a); // plain blending: additive washed out to white on bright floors
        c.fillStyle = `rgba(41, 98, 255, ${0.3 * k})`; c.fillRect(0, -SS_WAKE_W, L, SS_WAKE_W * 2);
        c.fillStyle = `rgba(68, 138, 255, ${0.45 * k})`; c.fillRect(0, -SS_WAKE_W * 0.45, L, SS_WAKE_W * 0.9);
        c.fillStyle = `rgba(227, 242, 253, ${0.6 * k})`; c.fillRect(0, -2, L, 4); c.restore();
        if (ssfxTick(w) && Math.random() < 0.8) { const t = Math.random(); spawnParticle({ kind: 'dot', color: Math.random() < 0.5 ? '#82b1ff' : '#e3f2fd', x: lerp(w.x0, w.x1, t) + jitter(SS_WAKE_W), y: lerp(w.y0, w.y1, t) + jitter(SS_WAKE_W), vx: jitter(20), vy: -40 - Math.random() * 40, size: 2.2, life: 0.4, drag: 1, grow: -1, spin: 0, rot: 0 }); }
    }
}

// ---------- above the world: the tornado, the rank letter ----------

function drawSwordsaintWorld(c) {
    if (typeof ss === 'undefined') return;
    for (const w of ss.winds) ssfxTornado(c, w, SS_WIND_R, w.t);
    for (const cy of ss.cyclones) ssfxTornado(c, cy, 62, SS_EYE_TIME - cy.t); // Eye of the Tempest
    const pop = ss.pop;
    if (pop && fxTime - pop.t0 < 0.9 && player.hp > 0) { // the new rank's letter, springing up beside her (a drop sinks, greyed)
        const t = (fxTime - pop.t0) / 0.9, sc = pop.up ? 1 + 0.6 * Math.max(0, 1 - t * 4) : 1, y = player.y - 48 - (pop.up ? 14 * easeOut(t) : -10 * t);
        c.save(); c.globalAlpha = 1 - Math.max(0, (t - 0.6) / 0.4);
        c.font = `bold ${Math.round(26 * sc)}px Georgia, serif`; c.textAlign = 'center'; c.textBaseline = 'middle';
        if (pop.up) glow(c, player.x + 26, y, 26 * sc, SSFX_RANK_COL[pop.rank], 0.6);
        c.lineWidth = 4; c.strokeStyle = 'rgba(10, 8, 20, 0.85)'; c.strokeText(SS_RANK_LETTER[pop.rank], player.x + 26, y);
        c.fillStyle = pop.up ? SSFX_RANK_COL[pop.rank] : '#b0bec5'; c.fillText(SS_RANK_LETTER[pop.rank], player.x + 26, y);
        c.font = 'italic 11px Georgia, serif'; c.lineWidth = 3; c.strokeText(SS_RANK_NAME[pop.rank], player.x + 26, y + 17); c.fillText(SS_RANK_NAME[pop.rank], player.x + 26, y + 17);
        c.restore();
    }
    if (ss.bullet > 0 && player.hp > 0) glow(c, player.x, player.y, 46, '#fff8e1', 0.25 * Math.min(1, ss.bullet * 3)); // she alone moves at full speed: lit
}

// A tornado seen from above: a funnel of spiral arcs turning round its eye, debris thrown round the rim
function ssfxTornado(c, w, R, t) {
    const spin = t * 14;
    glow(c, w.x, w.y, R * 1.3, '#e3f2fd', 0.35);
    c.save(); c.translate(w.x, w.y); c.lineCap = 'round';
    for (let i = 0; i < 5; i++) {
        const r = R * (0.35 + i * 0.16), a0 = spin * (1.4 - i * 0.15) + i * 1.3;
        c.strokeStyle = i % 2 ? 'rgba(227, 242, 253, 0.75)' : 'rgba(144, 202, 249, 0.6)'; c.lineWidth = 3.2 - i * 0.4;
        c.beginPath(); c.arc(0, 0, r, a0, a0 + Math.PI * 1.1); c.stroke();
        c.beginPath(); c.arc(0, 0, r, a0 + Math.PI, a0 + Math.PI * 1.9); c.stroke();
    }
    c.fillStyle = 'rgba(255, 255, 255, 0.55)'; c.beginPath(); c.arc(0, 0, R * 0.18, 0, SSFX_TAU); c.fill();
    c.restore();
    if (ssfxTick(w) && Math.random() < 0.7) { const t = Math.random() * SSFX_TAU; spawnParticle({ kind: 'debris', color: Math.random() < 0.5 ? '#bcaaa4' : '#eceff1', x: w.x + Math.cos(t) * R, y: w.y + Math.sin(t) * R, vx: -Math.sin(t) * 220, vy: Math.cos(t) * 220, size: 2.5, life: 0.4, drag: 2, grow: 0, spin: 10, rot: 0 }); }
}

// ---------- effects ----------

function drawSwordsaintEffect(c, ef) {
    if (!ef.type || ef.type.slice(0, 3) !== 'ss_') return false;
    const k = clamp01(ef.life / ef.maxLife), p = 1 - k;
    c.save(); c.lineCap = 'round';
    switch (ef.type) {
        case 'ss_spin': { // a ring of sword-light swept round her
            const R = ef.r * (0.75 + 0.3 * easeOut(p)), a0 = ef.angle + 0.6;
            glow(c, ef.x, ef.y, R * 1.1, '#fff8e1', 0.3 * k);
            c.strokeStyle = `rgba(255, 248, 225, ${0.85 * k})`; c.lineWidth = 7 * k + 1;
            c.beginPath(); c.arc(ef.x, ef.y, R * 0.85, a0, a0 + SSFX_TAU * Math.min(1, p * 2.5)); c.stroke();
            c.strokeStyle = `rgba(255, 213, 79, ${0.7 * k})`; c.lineWidth = 2;
            c.beginPath(); c.arc(ef.x, ef.y, R, 0, SSFX_TAU); c.stroke();
            if (!ef.burstDone) { ef.burstDone = true; burst(ef.x, ef.y, 0, SSFX_TAU, 10, { kind: 'spark', color: '#ffe082', size: 2, life: 0.25, speed: [150, 320], drag: 5 }); }
            break;
        }
        case 'ss_slam': { // the leap lands: a flash, a ring rolling out, rays of light (no cracks)
            const R = ef.r * easeOut(Math.min(1, p * 1.6));
            glow(c, ef.x, ef.y, ef.r * 1.2, '#ffd54f', 0.55 * k);
            c.strokeStyle = `rgba(255, 236, 179, ${k})`; c.lineWidth = 5 * k + 1; c.beginPath(); c.arc(ef.x, ef.y, R, 0, SSFX_TAU); c.stroke();
            c.strokeStyle = `rgba(255, 255, 255, ${0.8 * k})`; c.lineWidth = 2;
            c.beginPath(); for (let i = 0; i < 8; i++) { const a = ef.angle + i * Math.PI / 4, r0 = R * 0.3, r1 = R * 0.3 + ef.r * 0.5 * k; c.moveTo(ef.x + Math.cos(a) * r0, ef.y + Math.sin(a) * r0); c.lineTo(ef.x + Math.cos(a) * r1, ef.y + Math.sin(a) * r1); } c.stroke();
            if (!ef.burstDone) { ef.burstDone = true; burst(ef.x, ef.y, 0, SSFX_TAU, 16, { kind: 'debris', color: '#a1887f', size: 3, life: 0.45, speed: [100, 260], drag: 3 }); burst(ef.x, ef.y, 0, SSFX_TAU, 12, { kind: 'spark', color: '#fff59d', size: 2.2, life: 0.3, speed: [200, 420], drag: 5 }); }
            break;
        }
        case 'ss_air': { // the wind seal bursts: curved gusts racing outward, turning as they go
            const R = 20 + (ef.r - 20) * easeOut(p);
            c.fillStyle = `rgba(227, 242, 253, ${0.16 * k})`; c.beginPath(); c.arc(ef.x, ef.y, R, 0, SSFX_TAU); c.fill();
            for (let i = 0; i < 7; i++) {
                const a = i * SSFX_TAU / 7 + p * 2.2;
                c.strokeStyle = i % 2 ? `rgba(255, 255, 255, ${0.85 * k})` : `rgba(144, 202, 249, ${0.75 * k})`; c.lineWidth = 3 * k + 0.8;
                c.beginPath(); c.arc(ef.x, ef.y, R * (0.8 + 0.08 * (i % 3)), a, a + 0.7); c.stroke();
            }
            if (!ef.burstDone) { ef.burstDone = true; burst(ef.x, ef.y, 0, SSFX_TAU, 14, { kind: 'smoke', color: 'rgba(236, 239, 241, 0.5)', size: 7, life: 0.4, speed: [180, 320], drag: 4, grow: 14 }); }
            break;
        }
        case 'ss_thrust': { // a needle of light down the thrust
            c.translate(ef.x, ef.y); c.rotate(ef.angle);
            const L = ef.len * (0.6 + 0.4 * easeOut(Math.min(1, p * 3)));
            c.fillStyle = `rgba(255, 248, 225, ${0.75 * k})`; c.beginPath(); c.moveTo(24, -5 * k); c.lineTo(L, 0); c.lineTo(24, 5 * k); c.closePath(); c.fill();
            c.fillStyle = `rgba(255, 255, 255, ${k})`; c.fillRect(24, -1, L - 30, 2);
            break;
        }
        case 'ss_cross': { // two golden diagonals, the second a beat after the first
            for (const [s, t0] of [[1, 0], [-1, SS_CROSS_GAP / ef.maxLife]]) {
                const q = clamp01((p - t0) / 0.25), fade = clamp01(1 - (p - t0 - 0.2) / 0.5);
                if (q <= 0 || fade <= 0) continue;
                const a = ef.angle + s * Math.PI / 4, dx = Math.cos(a) * ef.half, dy = Math.sin(a) * ef.half;
                const x0 = ef.x - dx, y0 = ef.y - dy, x1 = lerp(x0, ef.x + dx, easeOut(q)), y1 = lerp(y0, ef.y + dy, easeOut(q));
                c.strokeStyle = `rgba(255, 213, 79, ${0.55 * fade})`; c.lineWidth = 12 * fade; c.beginPath(); c.moveTo(x0, y0); c.lineTo(x1, y1); c.stroke();
                c.strokeStyle = `rgba(255, 255, 255, ${fade})`; c.lineWidth = 3.5 * fade; c.beginPath(); c.moveTo(x0, y0); c.lineTo(x1, y1); c.stroke();
            }
            glow(c, ef.x, ef.y, 34, '#fff59d', 0.35 * k);
            break;
        }
        case 'ss_cross_burst': { // struck by both cuts: a four-point star of light (big: the plunge, the crossing moons)
            const B = ef.big ? 1.8 : 1;
            glow(c, ef.x, ef.y, 40 * B, '#ffd54f', 0.7 * k);
            const r = (10 + 26 * easeOut(p)) * B; c.fillStyle = `rgba(255, 255, 255, ${k})`;
            c.beginPath(); for (let i = 0; i < 8; i++) { const a = i * Math.PI / 4 + Math.PI / 8, rr = i % 2 ? r * 0.22 : r; c.lineTo(ef.x + Math.cos(a) * rr, ef.y + Math.sin(a) * rr); } c.closePath(); c.fill();
            break;
        }
        case 'ss_beam': { // Excalibur: a column of golden light down the lane, narrowing as it fades
            const k2 = ef.k || 0, w = ef.w * (1 + 0.25 * k2) * (p < 0.1 ? p / 0.1 : 1 - Math.pow((p - 0.1) / 0.9, 2)), L = ef.len * Math.min(1, p * 8);
            c.translate(ef.x, ef.y); c.rotate(ef.angle); c.globalCompositeOperation = 'lighter';
            const g = c.createLinearGradient(0, -w * 1.5, 0, w * 1.5);
            g.addColorStop(0, 'rgba(255, 179, 0, 0)'); g.addColorStop(0.3, `rgba(255, 193, 7, ${0.5 * k})`); g.addColorStop(0.5, `rgba(255, 255, 240, ${0.95 * k})`); g.addColorStop(0.7, `rgba(255, 193, 7, ${0.5 * k})`); g.addColorStop(1, 'rgba(255, 179, 0, 0)');
            c.fillStyle = g; c.fillRect(10, -w * 1.5, L, w * 3);
            c.fillStyle = `rgba(255, 255, 255, ${0.9 * k})`; c.fillRect(10, -w * 0.25, L, w * 0.5);
            c.restore(); c.save(); // back to the camera's transform for the glows
            glow(c, ef.x + Math.cos(ef.angle) * 20, ef.y + Math.sin(ef.angle) * 20, 60 + 40 * k2, '#fff8e1', 0.8 * k);
            if (ssfxTick(ef) && k > 0.3) for (let i = 0; i < 4; i++) { const t = Math.random() * L, sp = (Math.random() - 0.5) * ef.w * 2; spawnParticle({ kind: 'dot', color: Math.random() < 0.5 ? '#ffe082' : '#ffffff', x: ef.x + Math.cos(ef.angle) * t - Math.sin(ef.angle) * sp, y: ef.y + Math.sin(ef.angle) * t + Math.cos(ef.angle) * sp, vx: Math.cos(ef.angle) * 300, vy: Math.sin(ef.angle) * 300, size: 2.4, life: 0.35, drag: 2, grow: -1, spin: 0, rot: 0 }); }
            break;
        }
        case 'ss_unseal': { // the wind seal tears away in a spiral and the gold underneath flares
            glow(c, ef.x, ef.y, 90 * easeOut(p) + 20, '#ffd54f', 0.6 * k);
            for (let i = 0; i < 6; i++) {
                const a = i * SSFX_TAU / 6 + p * 5, r = 18 + 110 * easeOut(p);
                c.strokeStyle = `rgba(227, 242, 253, ${0.8 * k})`; c.lineWidth = 2.5 * k + 0.5;
                c.beginPath(); c.arc(ef.x, ef.y, r, a, a + 0.9); c.stroke();
            }
            c.strokeStyle = `rgba(255, 236, 179, ${k})`; c.lineWidth = 3; c.beginPath(); c.arc(ef.x, ef.y, 30 + 30 * easeOut(p), 0, SSFX_TAU); c.stroke();
            if (!ef.burstDone) { ef.burstDone = true; burst(ef.x, ef.y, 0, SSFX_TAU, 20, { kind: 'spark', color: '#ffe082', size: 2.4, life: 0.5, speed: [120, 360], drag: 3 }); }
            break;
        }
        case 'ss_burst': { // Mana Burst: a streak of blue prana where she shot across, jets flaring off her heels
            c.strokeStyle = `rgba(68, 138, 255, ${0.5 * k})`; c.lineWidth = 16 * k; c.beginPath(); c.moveTo(ef.x0, ef.y0); c.lineTo(ef.x1, ef.y1); c.stroke();
            c.strokeStyle = `rgba(255, 255, 255, ${0.8 * k})`; c.lineWidth = 3 * k; c.beginPath(); c.moveTo(ef.x0, ef.y0); c.lineTo(ef.x1, ef.y1); c.stroke();
            if (!ef.burstDone) { ef.burstDone = true; burst(ef.x0, ef.y0, ef.angle + Math.PI, 1.2, 12, { kind: 'spark', color: '#82b1ff', size: 2.4, life: 0.3, speed: [180, 380], drag: 4 }); }
            break;
        }
        case 'ss_perfect': { // the dodge: a white ring snapping in, then a slow golden ring for bullet time
            const r1 = 50 * (1 - easeOut(Math.min(1, p * 3))) + 14;
            c.strokeStyle = `rgba(255, 255, 255, ${k})`; c.lineWidth = 3; c.beginPath(); c.arc(ef.x, ef.y, r1, 0, SSFX_TAU); c.stroke();
            if (ef.bt) { c.strokeStyle = `rgba(255, 213, 79, ${0.8 * k})`; c.lineWidth = 2; c.beginPath(); c.arc(ef.x, ef.y, 30 + 90 * easeOut(p), 0, SSFX_TAU); c.stroke();
                c.beginPath(); for (let i = 0; i < 12; i++) { const a = i * Math.PI / 6, r = 30 + 90 * easeOut(p); c.moveTo(ef.x + Math.cos(a) * (r - 6), ef.y + Math.sin(a) * (r - 6)); c.lineTo(ef.x + Math.cos(a) * (r + 4), ef.y + Math.sin(a) * (r + 4)); } c.stroke(); } // a clock face
            glow(c, ef.x, ef.y, 40, '#fff8e1', 0.5 * k);
            break;
        }
        case 'ss_pull': { // Tempest Dance: wind curling inward to her
            for (let i = 0; i < 6; i++) { const a = i * SSFX_TAU / 6 - p * 3, r = ef.r * (1 - 0.7 * easeOut(p)); c.strokeStyle = `rgba(227, 242, 253, ${0.7 * k})`; c.lineWidth = 2.2; c.beginPath(); c.arc(ef.x, ef.y, r, a, a + 0.8); c.stroke(); }
            break;
        }
        case 'ss_eye': { // Eye of the Storm: a wide ring of wind collapsing on her, then the burst
            const r = ef.r * (1 - easeOut(Math.min(1, p * 1.6))) + 20;
            c.fillStyle = `rgba(144, 202, 249, ${0.12 * k})`; c.beginPath(); c.arc(ef.x, ef.y, r, 0, SSFX_TAU); c.fill();
            for (let i = 0; i < 9; i++) { const a = i * SSFX_TAU / 9 - p * 4; c.strokeStyle = i % 2 ? `rgba(255, 255, 255, ${0.8 * k})` : `rgba(144, 202, 249, ${0.8 * k})`; c.lineWidth = 2.6; c.beginPath(); c.arc(ef.x, ef.y, r, a, a + 0.55); c.stroke(); }
            if (p > 0.55 && !ef.burstDone) { ef.burstDone = true; burst(ef.x, ef.y, 0, SSFX_TAU, 14, { kind: 'smoke', color: 'rgba(236, 239, 241, 0.5)', size: 7, life: 0.4, speed: [160, 300], drag: 4, grow: 14 }); }
            break;
        }
        case 'ss_lunge': { // Duelist's Lunge: a needle of light through the duelled (blue: Counter Burst's flash)
            c.strokeStyle = ef.blue ? `rgba(68, 138, 255, ${0.55 * k})` : `rgba(255, 213, 79, ${0.5 * k})`; c.lineWidth = 12 * k; c.beginPath(); c.moveTo(ef.x0, ef.y0); c.lineTo(ef.x1, ef.y1); c.stroke();
            c.strokeStyle = `rgba(255, 255, 255, ${k})`; c.lineWidth = 2.5 * k + 0.5; c.beginPath(); c.moveTo(ef.x0, ef.y0); c.lineTo(ef.x1, ef.y1); c.stroke();
            break;
        }
        case 'ss_cannon': { // Wind Cannon: a blast down the line, streaks racing out
            const L = ef.len * easeOut(Math.min(1, p * 3)), w = ef.w;
            c.translate(ef.x, ef.y); c.rotate(ef.angle);
            c.fillStyle = `rgba(227, 242, 253, ${0.22 * k})`; c.beginPath(); c.moveTo(16, -w * 0.5); c.lineTo(L, -w); c.lineTo(L, w); c.lineTo(16, w * 0.5); c.closePath(); c.fill();
            c.strokeStyle = `rgba(255, 255, 255, ${0.85 * k})`; c.lineWidth = 2;
            c.beginPath(); for (let i = 0; i < 7; i++) { const y = (i - 3) / 3 * w * 0.8, x = (L * (0.3 + 0.7 * ((i * 0.37 + p * 2) % 1))); c.moveTo(Math.max(16, x - 60), y); c.lineTo(x, y); } c.stroke();
            break;
        }
        case 'ss_wall': { // slammed into rock or another body
            glow(c, ef.x, ef.y, 34, '#e3f2fd', 0.7 * k);
            if (!ef.burstDone) { ef.burstDone = true; burst(ef.x, ef.y, ef.angle + Math.PI, 2.4, 10, { kind: 'debris', color: '#bcaaa4', size: 3, life: 0.4, speed: [80, 220], drag: 3 }); burst(ef.x, ef.y, ef.angle + Math.PI, 2, 6, { kind: 'spark', color: '#ffffff', size: 2, life: 0.25, speed: [150, 300], drag: 5 }); }
            break;
        }
        case 'ss_counter': { // Counter Burst: a blue-gold cut across the attacker
            const a = ef.angle + Math.PI / 2, r = 40 * easeOut(Math.min(1, p * 3));
            glow(c, ef.x, ef.y, 46, '#82b1ff', 0.6 * k);
            c.strokeStyle = `rgba(130, 177, 255, ${0.7 * k})`; c.lineWidth = 10 * k; c.beginPath(); c.moveTo(ef.x - Math.cos(a) * r, ef.y - Math.sin(a) * r); c.lineTo(ef.x + Math.cos(a) * r, ef.y + Math.sin(a) * r); c.stroke();
            c.strokeStyle = `rgba(255, 248, 225, ${k})`; c.lineWidth = 3; c.beginPath(); c.moveTo(ef.x - Math.cos(a) * r, ef.y - Math.sin(a) * r); c.lineTo(ef.x + Math.cos(a) * r, ef.y + Math.sin(a) * r); c.stroke();
            break;
        }
        case 'ss_counter_mark': { // the attacker marked the instant the dodge lands: a blue ring snapping onto them
            const e = ef.e; if (!e || e.dead) break;
            const r = e.size / 2 + 8 + 30 * k;
            c.strokeStyle = `rgba(130, 177, 255, ${0.9 * (1 - k * 0.3)})`; c.lineWidth = 2.5; c.beginPath(); c.arc(e.x, e.y, r, 0, SSFX_TAU); c.stroke();
            break;
        }
        case 'ss_wind_end': { // the tornado unwinds
            for (let i = 0; i < 4; i++) { const a = i * Math.PI / 2 + p * 4; c.strokeStyle = `rgba(227, 242, 253, ${0.7 * k})`; c.lineWidth = 2; c.beginPath(); c.arc(ef.x, ef.y, SS_WIND_R * (0.6 + p), a, a + 0.8); c.stroke(); }
            break;
        }
        default: c.restore(); return false;
    }
    c.restore();
    return true;
}

// The Lionheart Gauntlets' wave off the thrust: a crescent of sword-light
function drawSwordsaintProjectile(c, p) {
    if (!p.ssWave) return false;
    c.save(); c.translate(p.x, p.y); c.rotate(p.angle);
    glow(c, 0, 0, 30, '#ffd54f', 0.5);
    c.beginPath(); c.arc(-10, 0, 24, -1.1, 1.1); c.arc(-18, 0, 20, 1.0, -1.0, true); c.closePath();
    c.fillStyle = 'rgba(255, 248, 225, 0.9)'; c.fill();
    c.restore();
    return true;
}

// ---------- screen space: bullet time ----------

function drawSwordsaintScreen(c) {
    if (typeof ss === 'undefined' || !(ss.bullet > 0)) return;
    const a = Math.min(1, ss.bullet * 4, (SS_BT_TIME - ss.bullet) * 8 + 0.3); // in fast, out over the last quarter second
    const W = canvas.width, H = canvas.height;
    c.save();
    c.fillStyle = `rgba(60, 48, 20, ${0.3 * a})`; c.fillRect(0, 0, W, H); // the world goes sepia-dull
    const g = c.createRadialGradient(W / 2, H / 2, Math.min(W, H) * 0.3, W / 2, H / 2, Math.max(W, H) * 0.7);
    g.addColorStop(0, 'rgba(0, 0, 0, 0)'); g.addColorStop(1, `rgba(255, 213, 79, ${0.35 * a})`);
    c.fillStyle = g; c.fillRect(0, 0, W, H);
    c.restore();
}
