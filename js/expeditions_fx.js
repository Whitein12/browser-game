// ==========================================
// expeditions_fx.js - The expeditions' art: the chiefs as themselves, their moves' wind-ups, the road home, a memory's warm edges
// ==========================================
// expeditions.js runs the trips and calls in here to draw them; the noticeboard, the memory card and the end panel are HTML
// (ui.css, "expeditions"). All on fxTime, so it pauses with the game; glows are bandits.js's cached sprites (glow).
//   harrowCloak / harrowChain      - bandits.js's halberdier, painted into Harrow's own sprite canvas: a torn crimson cloak, a stolen gold chain
//   SCAR_COAT / scarMarks / scarEye - bandits.js's hound as Old Scar: a grizzled coat (sprites.js sprWolf's coat), scars, a broken chain, a milky eye
//   drawPrism / drawPrismShard     - enemysprites.js: the crystal slime as the Prism (and its three splinters), its shards in flat fills
//   drawExpeditionGround           - main.js, with the ground things: the chief's sigil, the road home
//   drawExpeditionAbove            - main.js, above the canopies: the chief's name plate
//   drawExpEffect                  - skillfx.js drawSkillEffect: the rally / howl / shatter wind-ups, the entrance flare, the fall
//   drawExpeditionScreen           - main.js, screen space: an arrow to the chief while he's off the view, a memory's warm edges

// Per move (the chief's key): the sigil's colour, its glow, the light the plate and the arrow use
const CHIEF_FX = {
    rally: { sigil: '#c62828', glow: '#ff5a3c', light: '#ff8a65' },
    howl: { sigil: '#a1887f', glow: '#bcaaa4', light: '#e0d6cc' },
    shatter: { sigil: '#b388ff', glow: '#9c6bff', light: '#d9c6ff' },
};
const chiefFx = e => CHIEF_FX[e && e.chief ? e.chief.move : 'rally'] || CHIEF_FX.rally;

// ---------- Harrow the Deserter (bandits.js halberd, p.chief === 'rally') ----------
const HARROW_HEM = [4, 7, 2.5, 6]; // how far each tatter hangs past the hem
function harrowCloak(c, p) { // under the torso: shoulder to a ragged hem, dragged behind the way he moves
    const col = p.tint || '#8e1f1f', fl = Math.sin(p.t * 6 + p.walk) * (1 + 2 * p.move), w = 13.5;
    const tx = p.dead ? -30 : Math.min(-15, -27 + p.trail.x), ty = p.dead ? 0 : p.trail.y;
    c.beginPath(); c.moveTo(1, -w * 0.85);
    c.quadraticCurveTo(tx * 0.5, -w * 1.2 + ty * 0.3, tx + 1, -w * 1.05 + ty);
    for (let i = 1; i < 8; i++) { const v = -1.05 + 2.1 * i / 8, out = i % 2 ? HARROW_HEM[i >> 1] + fl * 0.5 * (i % 4 === 1 ? 1 : -0.6) : -2; c.lineTo(tx - out, v * w + ty * (1 - 0.25 * Math.abs(v))); }
    c.lineTo(tx + 1, w * 1.05 + ty);
    c.quadraticCurveTo(tx * 0.5, w * 1.2 + ty * 0.3, 1, w * 0.85); c.closePath();
    sprFill(c, col);
    c.strokeStyle = sprShade(col, -0.4); c.lineWidth = 1; c.beginPath(); // the folds
    for (const f of [-0.55, 0, 0.55]) { c.moveTo(-4, f * w * 0.8); c.quadraticCurveTo(tx * 0.5, f * w + ty * 0.3, tx + 2, f * w * 1.02 + ty); }
    c.stroke();
    c.fillStyle = sprShade(col, -0.6); c.beginPath(); // a rent torn clean through it
    c.moveTo(tx * 0.52, 3.5 + ty * 0.4); c.lineTo(tx * 0.8, 8 + ty * 0.65); c.lineTo(tx * 0.72, 4.6 + ty * 0.55); c.lineTo(tx * 0.62, 6.2 + ty * 0.5); c.closePath(); c.fill();
    c.strokeStyle = 'rgba(201, 162, 39, 0.55)'; c.lineWidth = 1.1; c.beginPath(); c.moveTo(tx * 0.4, -w * 1.1 + ty * 0.25); c.quadraticCurveTo(tx * 0.7, -w * 1.12 + ty * 0.6, tx + 1, -w * 1.05 + ty); c.stroke(); // what's left of the gold edging
}
function harrowChain(c, p) { // over the pauldrons: a looted gold chain round the neck, its medallion on his chest
    if (p.dead) return;
    c.save(); c.lineWidth = 1;
    for (let k = 0; k < 14; k++) {
        const a = Math.PI * (0.18 + 1.64 * k / 13), x = 2 + Math.cos(a) * 9.6, y = Math.sin(a) * 9.8;
        c.fillStyle = k % 2 ? '#f6d36b' : '#c99a2e'; c.strokeStyle = '#3a2500'; c.beginPath(); c.ellipse(x, y, 1.6, 1.25, a, 0, Math.PI * 2); c.fill(); c.stroke();
    }
    c.fillStyle = '#ffd54f'; c.strokeStyle = '#3a2500'; c.lineWidth = 1.2; c.beginPath(); c.arc(12.2, 0, 2.6, 0, Math.PI * 2); c.fill(); c.stroke(); // the medallion: Valerius's brass sigil
    c.fillStyle = '#8e1f1f'; c.beginPath(); c.arc(12.2, 0, 1.1, 0, Math.PI * 2); c.fill();
    for (const s of [-1, 1]) { c.fillStyle = '#ffd54f'; c.beginPath(); c.arc(0, s * 11.5, 1.6, 0, Math.PI * 2); c.fill(); c.stroke(); } // the cloak's clasps
    c.restore();
}

// ---------- Old Scar (bandits.js hound, p.chief === 'howl') ----------
const SCAR_COAT = { paw: '#2f2924', tail: '#5e554b', tip: '#d8d0c4', body: '#6d6256', spine: '#463e36', ruff: '#8b8073', head: '#7c7064', ear: '#43392f', jaw: '#5c5248', muzzle: '#a99d8f' };
function scarMarks(c, p) { // after the collar: grey in the coat, old scars, the chain he broke
    c.save(); c.lineCap = 'round';
    c.strokeStyle = 'rgba(232, 226, 216, 0.4)'; c.lineWidth = 1.1; c.beginPath(); // grizzle along the back
    for (const [x, y, l] of [[-18, -3, 5], [-12, 2.5, 6], [-6, -2, 5], [0, 3, 4], [-15, 6.5, 4], [-3, -6.5, 4]]) { c.moveTo(x, y); c.lineTo(x - l, y + y * 0.12); }
    c.stroke();
    c.strokeStyle = '#3a2c25'; c.lineWidth = 2.4; c.beginPath(); // three old scars, dark furrows...
    c.moveTo(-11, -10); c.lineTo(-4, -4); c.moveTo(-18, 5); c.lineTo(-10, 11); c.moveTo(-15, 8.5); c.lineTo(-8, 13.5);
    c.stroke();
    c.strokeStyle = '#e0b4a4'; c.lineWidth = 1; c.stroke(); // ...healed pink
    if (!p.dead) { // the broken chain, swinging from the collar
        const sw = Math.sin(p.t * 7) * 1.4 * (0.4 + p.move);
        for (let i = 0; i < 4; i++) {
            const x = 9 - i * 4.2 + p.trail.x * 0.05 * i, y = 13 + i * 1.3 + p.trail.y * 0.18 * i + sw * i * 0.4, a = -0.25 + i * 0.12;
            c.strokeStyle = '#1e1a17'; c.lineWidth = 2.6; c.beginPath(); c.ellipse(x, y, 2.3, 1.4, a, 0, i === 3 ? Math.PI * 1.5 : Math.PI * 2); c.stroke();
            c.strokeStyle = i === 3 ? '#cfd8dc' : '#90a4ae'; c.lineWidth = 1.2; c.stroke(); // the last link snapped open, its broken end bright
        }
    }
    c.restore();
}
function scarEye(c, x, y) { // the left eye, clouded over, a claw scar down through it
    c.fillStyle = '#e6eef0'; c.beginPath(); c.arc(x, y, 1.9, 0, Math.PI * 2); c.fill();
    c.fillStyle = 'rgba(150, 170, 180, 0.8)'; c.beginPath(); c.arc(x + 0.4, y + 0.3, 0.9, 0, Math.PI * 2); c.fill();
    c.strokeStyle = '#e0b4a4'; c.lineWidth = 1.1; c.lineCap = 'round'; c.beginPath(); c.moveTo(x - 4, y - 4.2); c.lineTo(x + 3.6, y + 3.4); c.stroke();
}

// ---------- the Prism (enemysprites.js crystal_slime with e.chief, or one of its three splinters) ----------
function drawPrism(e) {
    const kid = !e.chief, since = e.expTellAt === undefined ? 9 : fxTime - e.expTellAt; // expeditions.js marks the shatter's wind-up
    const charge = since < 0.8 ? since / 0.8 : 0, flash = since >= 0.8 && since < 1.1 ? 1 - (since - 0.8) / 0.3 : 0, pulse = 0.5 + 0.5 * Math.sin(fxTime * 2.2 + e.seed);
    drawSlime(e, {
        hopH: 0.18, color: e.reflective ? '#9c27b0' : kid ? '#cdb8f6' : e.tint || '#b388ff', inflate: charge * 0.07, // ai.js: a crystal slime's barrier still turns it deep purple
        inside: (c, x, y, r) => { // a heart of light pulsing slowly in the crystal, flaring as it gathers the shards
            c.save(); c.globalCompositeOperation = 'lighter';
            glow(c, x + r * 0.05, y + r * 0.1, r * (0.8 + 0.2 * pulse + 0.4 * charge), '#d1b3ff', (kid ? 0.14 : 0.24) + 0.16 * pulse + 0.4 * charge + 0.5 * flash);
            c.restore();
            c.fillStyle = 'rgba(255, 255, 255, 0.1)'; c.beginPath(); c.moveTo(x - r, y - r * 0.15); c.lineTo(x + r * 0.15, y - r); c.lineTo(x + r * 0.45, y + r * 0.05); c.closePath(); c.fill(); // cut faces catching the light
            c.fillStyle = 'rgba(36, 0, 74, 0.16)'; c.beginPath(); c.moveTo(x + r * 0.45, y + r * 0.05); c.lineTo(x + r, y + r * 0.4); c.lineTo(x - r * 0.2, y + r); c.closePath(); c.fill();
        },
        over: (c, x, y, r) => prismCrystals(c, e, x, y, r, kid, charge, flash),
    });
}
function prismCrystals(c, e, x, y, r, kid, charge, flash) { // a crown of crystals on its back, each two flat facets
    const refl = !!e.reflective, n = kid ? 5 : 7, back = Math.atan2(player.y - y, player.x - x) + Math.PI, spread = kid ? 0.55 : 0.4, grow = (1 + 0.35 * charge) * (refl ? 1.4 : 1);
    const tips = [];
    for (let k = 0; k < n; k++) {
        const m = k - (n - 1) / 2, a = back + m * spread, L = r * (kid ? 0.52 + (k % 2) * 0.18 + (m === 0 ? 0.2 : 0) : 0.4 + (k % 2) * 0.2 + (m === 0 ? 0.16 : 0)) * grow, w = r * (kid ? 0.14 : 0.13);
        const b0 = r * (kid ? 0.2 : 0.42), bx = x + Math.cos(a) * b0, by = y + Math.sin(a) * b0 * 0.85; // the Prism's spikes stand in a ring round its back, out past the body
        const tx = bx + Math.cos(a) * L, ty = by + Math.sin(a) * L, px = -Math.sin(a) * w, py = Math.cos(a) * w, rx = bx - Math.cos(a) * w, ry = by - Math.sin(a) * w;
        c.fillStyle = kid ? '#9e86d6' : '#6a3fd6'; c.beginPath(); c.moveTo(bx + px, by + py); c.lineTo(tx, ty); c.lineTo(rx, ry); c.closePath(); c.fill(); // the shaded face
        c.fillStyle = kid ? '#f1eaff' : '#e9ddff'; c.beginPath(); c.moveTo(bx - px, by - py); c.lineTo(tx, ty); c.lineTo(rx, ry); c.closePath(); c.fill(); // the lit face
        c.strokeStyle = '#24073f'; c.lineWidth = 1.5; c.beginPath(); c.moveTo(bx + px, by + py); c.lineTo(tx, ty); c.lineTo(bx - px, by - py); c.lineTo(rx, ry); c.closePath(); c.stroke();
        tips.push([tx, ty]);
    }
    if (charge > 0 || flash > 0) { c.save(); c.globalCompositeOperation = 'lighter'; for (const [tx, ty] of tips) glow(c, tx, ty, r * (0.3 + 0.3 * charge), '#b388ff', 0.5 * charge + 0.7 * flash); c.restore(); }
    if (refl) { // reflecting damage (combat.js): the crystal slime's own barrier, as enemysprites.js draws it
        c.save(); c.globalCompositeOperation = 'lighter'; glow(c, x, y, r * 1.7, '#ce93d8', 0.3);
        c.strokeStyle = `rgba(230, 200, 255, ${0.6 + 0.3 * Math.sin(fxTime * 8)})`; c.lineWidth = 2; c.beginPath();
        for (let k = 0; k <= 6; k++) { const a = k * Math.PI / 3 + fxTime * 1.5; c.lineTo(x + Math.cos(a) * r * 1.5, y + Math.sin(a) * r * 1.35); } c.stroke(); c.restore();
    }
    if (!kid) { // one facet at a time catches the light: a glint walking along the crown
        const q = fxTime * 1.1 + e.seed, i = Math.floor(q) % n, f = q % 1;
        if (f < 0.45) qsStar(c, tips[i][0], tips[i][1], 3 + r * 0.06, Math.sin(f / 0.45 * Math.PI), 0.3 + i); // sidequests_fx.js
    }
}
function drawPrismShard(c, p) { // a sliver of the Prism, two flat facets and an outline (a ring of 14 at once)
    const a = Math.atan2(p.vy, p.vx), r = p.radius;
    c.save(); c.translate(p.x, p.y); c.rotate(a);
    c.fillStyle = 'rgba(179, 136, 255, 0.28)'; c.beginPath(); c.moveTo(-r * 1.2, -r * 0.5); c.lineTo(-r * 4.2, 0); c.lineTo(-r * 1.2, r * 0.5); c.closePath(); c.fill(); // its wake
    c.fillStyle = '#7c4dff'; c.beginPath(); c.moveTo(r * 2.3, 0); c.lineTo(-r * 0.4, -r * 0.9); c.lineTo(-r * 1.5, 0); c.closePath(); c.fill();
    c.fillStyle = '#efe6ff'; c.beginPath(); c.moveTo(r * 2.3, 0); c.lineTo(-r * 1.5, 0); c.lineTo(-r * 0.4, r * 0.9); c.closePath(); c.fill();
    c.strokeStyle = '#24073f'; c.lineWidth = 1.3; c.beginPath(); c.moveTo(r * 2.3, 0); c.lineTo(-r * 0.4, -r * 0.9); c.lineTo(-r * 1.5, 0); c.lineTo(-r * 0.4, r * 0.9); c.closePath(); c.stroke();
    c.restore();
}

// ---------- one-shot moments (expeditions.js) ----------
function chiefEntranceFx(e) { // he steps into view: a jolt and a flare in his colours
    addShake(2);
    effects.push({ type: 'exp_enter', x: e.x, y: e.y, e, life: 0.8, maxLife: 0.8 });
    burst(e.x, e.y, 0, Math.PI * 2, 10, { kind: 'dot', color: chiefFx(e).light, size: 2.4, speed: [80, 220], life: 0.5, drag: 3 });
}
function chiefFellFx(e) { // the chief is down: a gold flash; the Prism bursts into a spray of crystal
    addShake(3);
    effects.push({ type: 'exp_fall', x: e.x, y: e.y, color: chiefFx(e).glow, life: 0.9, maxLife: 0.9 });
    if (e.chief.move !== 'shatter') return;
    burst(e.x, e.y, 0, Math.PI * 2, 22, { kind: 'debris', color: '#b388ff', size: 5, speed: [140, 420], life: 0.7, drag: 3 });
    burst(e.x, e.y, 0, Math.PI * 2, 14, { kind: 'debris', color: '#f3ecff', size: 3.5, speed: [100, 340], life: 0.6, drag: 3 });
    burst(e.x, e.y, 0, Math.PI * 2, 12, { kind: 'spark', color: '#e1bee7', size: 2, speed: [160, 380], life: 0.3, drag: 5 });
    spawnParticle({ kind: 'ring', color: '#d9c6ff', x: e.x, y: e.y, vx: 0, vy: 0, size: 10, grow: 300, life: 0.4, drag: 0, spin: 0, rot: 0 });
}

// ---------- the ground: the chief's sigil, the road home (main.js, with the ground things) ----------
function drawExpeditionGround() {
    if (!activeExpedition || !expd) return;
    if (expd.done && currentMap.caveOpen) drawRoadHome();
    const e = expd.chiefE; if (!e || e.dead || e.spawnT > 0) return;
    const F = chiefFx(e), mv = e.chief.move, R = e.size * (mv === 'shatter' ? 0.8 : 0.72) + 10, p = 0.5 + 0.5 * Math.sin(fxTime * 2.4), rot = fxTime * 0.35;
    const x = e.x, y = e.y + (mv === 'shatter' ? e.size * 0.12 : 4), c = ctx;
    c.save(); c.globalCompositeOperation = 'lighter'; glow(c, x, y, R * 2, F.glow, 0.16 + 0.07 * p); c.restore(); // lights the floor round him (the castle and the hive are dark)
    c.save(); c.translate(x, y); c.strokeStyle = F.sigil; c.fillStyle = F.sigil;
    c.globalAlpha = 0.5 + 0.15 * p; c.lineWidth = 2.5; c.beginPath();
    if (mv === 'shatter') for (let k = 0; k <= 6; k++) { const a = rot + k * Math.PI / 3; c.lineTo(Math.cos(a) * R, Math.sin(a) * R); } // a cut hexagon for the crystal
    else c.arc(0, 0, R, 0, Math.PI * 2);
    c.stroke();
    c.globalAlpha = 0.32; c.lineWidth = 1.2; c.beginPath(); c.arc(0, 0, R - 8, 0, Math.PI * 2); c.stroke();
    c.globalAlpha = 0.55 + 0.15 * p;
    for (let k = 0; k < 6; k++) { // his marks between the rings, turning slowly
        const a = -rot + k * Math.PI / 3; c.save(); c.rotate(a); c.translate(R - 4, 0);
        if (mv === 'rally') { c.beginPath(); c.moveTo(4, 0); c.lineTo(-3, -3); c.lineTo(-1.5, 0); c.lineTo(-3, 3); c.closePath(); c.fill(); } // spearheads
        else if (mv === 'howl') { c.lineWidth = 1.4; c.beginPath(); for (const o of [-3, 0, 3]) { c.moveTo(-3, o - 1.5); c.lineTo(3, o + 1.5); } c.stroke(); } // claw rakes
        else { c.beginPath(); c.moveTo(3.5, 0); c.lineTo(0, -2.2); c.lineTo(-3.5, 0); c.lineTo(0, 2.2); c.closePath(); c.fill(); } // facets
        c.restore();
    }
    c.restore();
}

// Which way is out from the map's start: toward its nearest edge (the castle's gate, the trail's west end, the hive's mouth)
function expHomeDir() {
    const d = mapDef(), s = d.start, cand = [[s.x, -1, 0], [d.w - s.x, 1, 0], [s.y, 0, -1], [d.h - s.y, 0, 1]].sort((a, b) => a[0] - b[0])[0];
    return [cand[1], cand[2]];
}
function drawRoadHome() { // the stage exits' ring and chevrons (map_trail.js), gold, the chevrons pointing back the way you came
    const E = expExit(), [dx, dy] = expHomeDir(), t = fxTime, p = 0.5 + 0.5 * Math.sin(t * 3), c = ctx, a = Math.atan2(dy, dx);
    c.save(); c.globalCompositeOperation = 'lighter'; glow(c, E.x, E.y, 170, '#ffb74d', 0.2 + 0.08 * p); c.restore();
    c.save(); c.fillStyle = 'rgba(255, 213, 79, 0.07)'; c.beginPath(); c.arc(E.x, E.y, 88, 0, Math.PI * 2); c.fill();
    c.strokeStyle = '#ffd180'; c.lineWidth = 4; c.lineCap = 'round'; c.lineJoin = 'round'; c.shadowBlur = 12; c.shadowColor = '#ff9100';
    c.globalAlpha = 0.4 + 0.3 * p; c.lineWidth = 2; c.beginPath(); c.arc(E.x, E.y, 88, 0, Math.PI * 2); c.stroke();
    c.translate(E.x, E.y); c.rotate(a); c.lineWidth = 4;
    for (let i = 0; i < 3; i++) { // marching outward, toward home
        const k = Math.sin(t * 4 - i * 0.9) * 0.5 + 0.5, x = -34 + i * 34 + Math.sin(t * 3) * 6;
        c.globalAlpha = 0.3 + 0.7 * k; c.beginPath(); c.moveTo(x - 10, -16); c.lineTo(x + 6, 0); c.lineTo(x - 10, 16); c.stroke();
    }
    c.restore();
    c.save(); c.fillStyle = '#ffe9a8';
    for (let i = 0; i < 9; i++) { // motes rising off the marker
        const q = (t * 0.45 + i * 0.137) % 1, ang = i * 2.4, rr = 22 + (i * 23) % 56;
        c.globalAlpha = Math.sin(q * Math.PI) * 0.7; c.beginPath(); c.arc(E.x + Math.cos(ang) * rr, E.y + Math.sin(ang) * rr * 0.8 - q * 34, 1.6, 0, Math.PI * 2); c.fill();
    }
    c.restore();
}

// ---------- above the canopies: the chief's name plate ----------
function drawExpeditionAbove() {
    if (!activeExpedition || !expd || !expd.entered) return;
    const e = expd.chiefE; if (!e || e.dead || e.spawnT > 0 || (sqs.bark && sqs.bark.e === e)) return; // his line over him says the name
    const F = chiefFx(e), c = ctx, pop = easeOutBack(clamp01((fxTime - expd.enterAt - 0.2) / 0.35));
    if (pop <= 0) return;
    c.save(); c.font = 'bold 12px Georgia, serif'; c.textAlign = 'center'; c.textBaseline = 'middle';
    const nm = e.chief.name, w = c.measureText(nm).width + 24, h = 18, x = e.x, y = e.y - e.size * (e.chief.move === 'shatter' ? 0.8 : 0.62) - 16;
    c.translate(x, y); c.scale(pop, pop);
    c.fillStyle = 'rgba(20, 11, 9, 0.86)'; c.strokeStyle = F.sigil; c.lineWidth = 1.4; c.beginPath(); c.roundRect(-w / 2, -h / 2, w, h, 9); c.fill(); c.stroke();
    c.fillStyle = '#c9a227'; for (const s of [-1, 1]) { c.save(); c.translate(s * (w / 2 - 7), 0); c.rotate(Math.PI / 4); c.fillRect(-2, -2, 4, 4); c.restore(); }
    c.fillStyle = '#ffe9a8'; c.fillText(nm, 0, 1);
    c.restore();
}

// ---------- effects (skillfx.js drawSkillEffect) ----------
function drawExpEffect(c, ef) {
    if (ef.type === 'exp_ring') { drawExpTell(c, ef); return true; }
    if (ef.type === 'exp_enter') {
        if (ef.e && !ef.e.dead) { ef.x = ef.e.x; ef.y = ef.e.y; }
        const k = 1 - ef.life / ef.maxLife, F = chiefFx(ef.e);
        c.save(); c.globalCompositeOperation = 'lighter'; glow(c, ef.x, ef.y, 60 + 140 * k, F.glow, 0.5 * (1 - k)); c.restore();
        c.save(); c.globalAlpha = 1 - k; c.strokeStyle = F.light; c.lineWidth = 4 * (1 - k) + 1; c.beginPath(); c.arc(ef.x, ef.y, 30 + 150 * easeOut(k), 0, Math.PI * 2); c.stroke(); c.restore();
        return true;
    }
    if (ef.type === 'exp_fall') {
        const k = 1 - ef.life / ef.maxLife;
        c.save(); c.globalCompositeOperation = 'lighter'; glow(c, ef.x, ef.y, 80 + 220 * k, '#ffd54f', 0.55 * (1 - k)); glow(c, ef.x, ef.y, 60 + 120 * k, ef.color, 0.4 * (1 - k)); c.restore();
        c.save(); c.globalAlpha = 0.9 * (1 - k); c.strokeStyle = '#ffe9a8'; c.lineWidth = 3; c.beginPath(); c.arc(ef.x, ef.y, 20 + 200 * easeOut(k), 0, Math.PI * 2); c.stroke(); c.restore();
        return true;
    }
    return false;
}
// A move's wind-up (expeditions.js expRing): the ring is the move's reach as the mechanics set it, filling in over its life
function drawExpTell(c, ef) {
    if (ef.e && !ef.e.dead) { ef.x = ef.e.x; ef.y = ef.e.y; } // it follows him
    const k = 1 - clamp01(ef.life / ef.maxLife), R = ef.radius, x = ef.x, y = ef.y, col = ef.color;
    c.save(); c.lineCap = 'round';
    c.globalAlpha = 0.1 + 0.08 * k; c.fillStyle = col; c.beginPath(); c.arc(x, y, R * easeOut(k), 0, Math.PI * 2); c.fill();
    c.globalAlpha = 0.3 + 0.5 * k; c.strokeStyle = col; c.lineWidth = 2.5 + 1.5 * k; c.beginPath(); c.arc(x, y, R, 0, Math.PI * 2); c.stroke();
    if (ef.kind === 'rally') { // the war cry: shout lines bursting out of him in two beats
        const r0 = ef.e ? ef.e.size * 0.6 : 24;
        c.strokeStyle = '#ffe0b2'; c.lineWidth = 3;
        for (const w of [0, 0.5]) {
            const q = (k * 1.6 + w) % 1, d = r0 + (R * 0.75 - r0) * q; c.globalAlpha = 0.85 * (1 - q); c.beginPath();
            for (let i = 0; i < 12; i++) { const a = i * Math.PI / 6 + w * 0.26; c.moveTo(x + Math.cos(a) * d, y + Math.sin(a) * d); c.lineTo(x + Math.cos(a) * (d + 16), y + Math.sin(a) * (d + 16)); }
            c.stroke();
        }
    } else if (ef.kind === 'howl') { // the howl: sound waves rolling out to the ring
        c.strokeStyle = '#efe7df';
        for (let i = 0; i < 3; i++) {
            const q = (k * 1.5 + i / 3) % 1; c.globalAlpha = 0.7 * (1 - q) * Math.min(1, k * 4); c.lineWidth = 5 * (1 - q) + 1;
            c.beginPath(); c.arc(x, y, 20 + (R - 20) * q, 0, Math.PI * 2); c.stroke();
        }
    } else if (ef.kind === 'shatter') { // the Prism draws light in: motes falling to its heart, then the shards
        c.fillStyle = '#efe6ff';
        for (let i = 0; i < 14; i++) { const a = i * Math.PI / 7 + 0.2, d = R * (1 - k) * (0.85 + 0.15 * Math.sin(i * 1.7)); c.globalAlpha = 0.9 * k; c.beginPath(); c.arc(x + Math.cos(a) * d, y + Math.sin(a) * d, 2.4, 0, Math.PI * 2); c.fill(); }
    }
    c.restore();
}

// ---------- screen space (main.js, after the world): an arrow to the chief, a memory's warm edges ----------
let memVignette = null;
function drawExpeditionScreen() {
    const c = ctx, W = canvas.width, H = canvas.height;
    if (activeMemory) { // the whole run in a faint sepia at the edges, painted once per window size
        if (!memVignette || memVignette.width !== W || memVignette.height !== H) {
            memVignette = cavCanvas(W, H); const v = memVignette.getContext('2d'), g = v.createRadialGradient(W / 2, H / 2, Math.min(W, H) * 0.42, W / 2, H / 2, Math.max(W, H) * 0.72);
            g.addColorStop(0, 'rgba(120, 78, 30, 0)'); g.addColorStop(0.6, 'rgba(112, 72, 28, 0.12)'); g.addColorStop(1, 'rgba(70, 42, 14, 0.34)'); v.fillStyle = g; v.fillRect(0, 0, W, H);
        }
        c.drawImage(memVignette, 0, 0);
    }
    if (!activeExpedition || !expd || gameState !== STATE.PLAYING || stageEvent) return;
    const e = expd.chiefE; if (!e || e.dead || expd.done) return;
    const z = camZoom(), sx = (e.x - camera.x) * z, sy = (e.y - camera.y) * z;
    if (sx > 30 && sx < W - 30 && sy > 30 && sy < H - 30) return;
    const F = chiefFx(e), a = Math.atan2(sy - H / 2, sx - W / 2), px = Math.max(56, Math.min(W - 56, sx)), py = Math.max(110, Math.min(H - 250, sy)), k = 0.5 + 0.5 * Math.sin(fxTime * 4);
    c.save(); c.translate(px, py);
    c.globalCompositeOperation = 'lighter'; glow(c, 0, 0, 40, F.glow, 0.25 + 0.12 * k); c.globalCompositeOperation = 'source-over';
    c.save(); c.rotate(a); c.translate(4 * k, 0); c.fillStyle = F.light; c.strokeStyle = '#0b0705'; c.lineWidth = 2;
    c.beginPath(); c.moveTo(18, 0); c.lineTo(-10, -13); c.lineTo(-4, 0); c.lineTo(-10, 13); c.closePath(); c.stroke(); c.fill(); c.restore();
    c.font = 'bold 11px Georgia, serif'; c.textAlign = 'center'; c.textBaseline = 'top'; c.lineWidth = 3; c.strokeStyle = 'rgba(0, 0, 0, 0.8)'; c.fillStyle = '#ffe9a8';
    const ty = py > H / 2 ? -34 : 20; c.strokeText(e.chief.name, 0, ty); c.fillText(e.chief.name, 0, ty);
    c.restore();
}
