// ==========================================
// sprites.js - Player Character Sprites
// ==========================================
// Characters are drawn top-down in a local frame: +x is the facing (aim) direction, +y is the character's right side.
// The live player is rendered to an offscreen canvas first, so lighting and the hit flash tint the sprite as one image.

const SPRITE_OUTLINE = 'rgba(12, 10, 18, 0.9)';
const SPRITE_SIZE = 160;
const spriteCanvas = document.createElement('canvas');
spriteCanvas.width = spriteCanvas.height = SPRITE_SIZE;
const spriteCtx = spriteCanvas.getContext('2d');

// Walk cycle and cloth drag for the live player, derived from how far the player actually moved each frame
const spriteAnim = { lastX: null, lastY: null, lastTime: 0, walk: 0, vx: 0, vy: 0 };

// ==========================================
// Drawing helpers
// ==========================================

// Mix a #rrggbb color toward white (amt > 0) or black (amt < 0)
function sprShade(hex, amt) {
    const n = parseInt(hex.slice(1), 16);
    const target = amt < 0 ? 0 : 255, p = Math.abs(amt);
    const mix = (v) => Math.round(v + (target - v) * p);
    return `rgb(${mix(n >> 16)}, ${mix((n >> 8) & 255)}, ${mix(n & 255)})`;
}

// Fill (and outline) the current path
function sprFill(c, fill, outline = true) {
    c.fillStyle = fill; c.fill();
    if (outline) { c.strokeStyle = SPRITE_OUTLINE; c.lineWidth = 1.5; c.stroke(); }
}

function sprEllipse(c, x, y, rx, ry, fill, outline = true) {
    c.beginPath(); c.ellipse(x, y, rx, ry, 0, 0, Math.PI * 2);
    sprFill(c, fill, outline);
}

// Outlined stroke: a dark pass underneath, then the colored line
function sprStroke(c, color, width, drawPath) {
    c.lineCap = 'round';
    c.strokeStyle = SPRITE_OUTLINE; c.lineWidth = width + 2; c.beginPath(); drawPath(); c.stroke();
    c.strokeStyle = color; c.lineWidth = width; c.beginPath(); drawPath(); c.stroke();
}

function sprLeaf(c, x, y, angle, len, color) {
    c.save();
    c.translate(x, y); c.rotate(angle);
    c.beginPath(); c.moveTo(0, 0);
    c.quadraticCurveTo(len / 2, -len * 0.4, len, 0);
    c.quadraticCurveTo(len / 2, len * 0.4, 0, 0);
    sprFill(c, color);
    c.strokeStyle = sprShade(color, -0.35); c.lineWidth = 0.8;
    c.beginPath(); c.moveTo(1, 0); c.lineTo(len - 1.5, 0); c.stroke();
    c.restore();
}

function sprStar(c, x, y, r, color) {
    c.beginPath();
    for (let i = 0; i < 10; i++) {
        const a = -Math.PI / 2 + i * Math.PI / 5, rr = i % 2 ? r * 0.45 : r;
        c.lineTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr);
    }
    c.closePath(); c.fillStyle = color; c.fill();
}

function sprFeet(c, pose, color) {
    const s = Math.sin(pose.walk) * 6 * pose.move;
    sprEllipse(c, 1 + s, -6.5, 5, 3.5, color);
    sprEllipse(c, 1 - s, 6.5, 5, 3.5, color);
}

function sprTorso(c, color, w = 14, d = 9.5) {
    sprEllipse(c, -1, 0, d, w, color);
}

function sprPauldrons(c, color, r = 5.5, y = 11.5) {
    for (const s of [-1, 1]) sprEllipse(c, -0.5, s * y, r, r * 0.9, color);
}

// A cape hanging from the shoulders, dragged behind the direction of movement. Returns the hem center.
function sprCape(c, pose, color, len, width, trim) {
    const flutter = Math.sin(pose.t * 6 + pose.walk) * (1 + 2 * pose.move);
    const tx = Math.min(-8, -len + pose.trail.x), ty = pose.trail.y;
    c.beginPath();
    c.moveTo(-1, -width * 0.8);
    c.quadraticCurveTo(tx * 0.5, -width * 1.1 + ty * 0.3, tx, -width + ty);
    c.quadraticCurveTo(tx - 5 - flutter, ty, tx, width + ty);
    c.quadraticCurveTo(tx * 0.5, width * 1.1 + ty * 0.3, -1, width * 0.8);
    c.closePath();
    sprFill(c, color);
    if (trim) { c.strokeStyle = trim; c.lineWidth = 1.5; c.stroke(); }
    // Fold lines
    c.strokeStyle = sprShade(color, -0.3); c.lineWidth = 1;
    c.beginPath();
    for (const f of [-0.45, 0.45]) {
        c.moveTo(-4, width * f * 0.8);
        c.quadraticCurveTo(tx * 0.5, width * f + ty * 0.3, tx - 1, width * f * 1.1 + ty);
    }
    c.stroke();
    return { x: tx, y: ty };
}

// Hood that comes to a point at the back, with a shadowed face opening
function sprHood(c, color, faceColor) {
    c.beginPath();
    c.moveTo(-12, 0);
    c.quadraticCurveTo(-6, -9, 3, -8);
    c.arc(3, 0, 8, -Math.PI / 2, Math.PI / 2);
    c.quadraticCurveTo(-6, 9, -12, 0);
    c.closePath();
    sprFill(c, color);
    c.strokeStyle = sprShade(color, -0.3); c.lineWidth = 1;
    c.beginPath(); c.moveTo(-10, 0); c.lineTo(-2, 0); c.stroke();
    sprEllipse(c, 7, 0, 3, 5, faceColor, false);
}

// Two cloth strips trailing from the back of the neck (scarves, headband ribbons)
function sprTails(c, pose, colors, width, len) {
    for (const s of [-1, 1]) {
        const w = Math.sin(pose.t * 10 + s) * (1.5 + 3 * pose.move);
        const ex = Math.min(-10, -len + pose.trail.x * 1.2), ey = s * 5 + pose.trail.y * 1.2;
        sprStroke(c, colors[s < 0 ? 0 : 1], width, () => {
            c.moveTo(-4, s * 2);
            c.bezierCurveTo(-4 + ex * 0.35, s * 3 + w, -4 + ex * 0.7, s * 4 - w, ex, ey + w * 0.5);
        });
    }
}

// The Monk's fists and legs for the strike in progress (monk.js mk.anim { kind, t0, dur, side }), in the sprite's frame.
// weapons.js WEAPON_DRAW.fists reads the same pose for its streaks and the chi glow. Off the field (the class select, a
// ghost) it's the guard. A basic that set no mk.anim falls back to weaponAnim, alternating sides.
function monkPose(p) {
    const live = p ? p.live : true, m = live && typeof mk !== 'undefined' ? mk : null;
    let kind = null, q = 1, side = 1;
    if (m && m.anim) { const A = m.anim; q = (fxTime - A.t0) / Math.max(0.01, A.dur || 0.2); if (q >= 0 && q < 1) { kind = A.kind; side = A.side || 1; } }
    if (!kind && live && typeof weaponAnim !== 'undefined' && activeClass && activeClass.weapon === 'fists' && !(m && m.anim && m.anim.t0 >= weaponAnim.attackAt - 0.001)) {
        q = (fxTime - weaponAnim.attackAt) / 0.2;
        if (q >= 0 && q < 1) { kind = 'jab'; side = weaponAnim.swing % 2 ? 1 : -1; } else q = 1;
    }
    const bob = p ? Math.sin(p.walk * 0.5) * 1.5 * p.move : 0;
    const fists = [-1, 1].map(s => ({ s, x: 13 + (s < 0 ? 3 + bob : -bob), y: s * 6, e: 0, ghosts: [], palm: false }));
    // A strike is already most of the way out on its first frame: damage lands at once and the hit-stop freezes that frame
    const env = (t, out = 0.25) => t < out ? lerp(0.75, 1, easeOut(t / out)) : 1 - easeInOut((t - out) / (1 - out));
    const reach = (f, e, len, inY = 1.5) => { f.e = e; f.x += len * e; f.y = lerp(f.y, f.s * inY, e); };
    let twist = 0, lean = 0, spin = 0, leg = null;
    if (kind === 'jab' || kind === 'rush') {
        const e = env(q), L = kind === 'rush' ? 21 : 17;
        for (const f of fists) if (f.s === side) reach(f, e, L); else f.x -= 3 * e;
        twist = side * 0.16 * e; if (kind === 'rush') lean = 2 * e;
    } else if (kind === 'flurry' || kind === 'hundred') { // the fists alternate, one punch per half-cycle
        const hund = kind === 'hundred', nb = hund ? 8 : 4, L = hund ? 20 : 17;
        const ext = (t, s) => t < 0 ? 0 : Math.max(0, Math.sin(Math.min(1, t) * Math.PI * nb + (s > 0 ? 0 : Math.PI)));
        for (const f of fists) {
            const bx = f.x, by = f.y;
            reach(f, ext(q, f.s), L);
            for (const [dt, a, off] of hund ? [[0.04, 0.5, 3.5], [0.08, 0.28, -3]] : [[0.06, 0.3, 0]]) {
                const e = ext(q - dt, f.s);
                if (e > 0.25) f.ghosts.push({ x: bx + L * e, y: lerp(by, f.s * 1.5, e) + off, a: a * e });
            }
        }
        twist = Math.sin(q * Math.PI * nb) * 0.1;
    } else if (kind === 'palm') { // both palms driven down together
        const e = env(q, 0.3);
        for (const f of fists) { reach(f, e, 12, 4); f.palm = e > 0.3; }
        lean = 1.5 * e;
    } else if (kind === 'crane') { // one full turn on the standing leg, the other leg swept out to the side
        const le = q < 0.1 ? lerp(0.7, 1, q / 0.1) : q > 0.85 ? easeOut((1 - q) / 0.15) : 1;
        spin = side * Math.PI * 2 * easeInOut(q);
        leg = { hy: 5, x: lerp(0, 3, le), y: lerp(6, 28, le), a: Math.PI / 2 };
        for (const f of fists) f.x -= 3 * le;
    } else if (kind === 'kick') { // the Dragon Kick: the right leg thrust straight out, leaning back into it
        const e = q < 0.15 ? lerp(0.75, 1, easeOut(q / 0.15)) : q < 0.6 ? 1 : 1 - easeInOut((q - 0.6) / 0.4);
        leg = { hy: 5, x: lerp(2, 31, e), y: lerp(7, 2, e), a: 0 };
        lean = -2.5 * e;
        for (const f of fists) if (f.s > 0) f.x -= 5 * e;
    }
    return { fists, twist, lean, spin, leg, kind, q, iron: !!(m && m.ironBody > 0) };
}

// ==========================================
// Class sprites
// ==========================================

const CLASS_SPRITES = {
    // ---- the new classes (designed 2026-10-14; kits still to come) ----
    witch(c, p) { // necromancer: violet-black gown, feather shawl, long black hair, an antler-bone crown, two soul wisps
        sprFeet(c, p, '#1a1020');
        sprEllipse(c, -2.5, 0, 12, 15.5, '#2a1636'); // the gown's skirt, wider than the body
        c.strokeStyle = 'rgba(105, 240, 174, 0.45)'; c.lineWidth = 1; c.beginPath(); c.ellipse(-2.5, 0, 10.5, 14, 0, 0, Math.PI * 2); c.stroke();
        for (const s of [-1, 1]) for (let i = 0; i < 3; i++) sprLeaf(c, -2 - i * 3, s * (9 + i * 1.5), s * (1.9 + i * 0.35), 10 - i, i % 2 ? '#24182e' : '#140c1c'); // feather shawl
        sprTorso(c, '#3d1f4f', 12.5, 8.5);
        sprTails(c, p, ['#100c16', '#16121c'], 5, 27); // the hair streams behind her
        sprEllipse(c, 1, 0, 7.5, 7.5, '#16121c');
        c.strokeStyle = '#d7ccc8'; c.lineWidth = 1.4; c.beginPath(); c.arc(1, 0, 6, 0, Math.PI * 2); c.stroke(); // bone circlet
        for (const s of [-1, 1]) sprStroke(c, '#e8e0cc', 2.2, () => { c.moveTo(3, s * 5); c.quadraticCurveTo(-1, s * 12.5, -9, s * 11); c.moveTo(-1, s * 9.8); c.lineTo(-3.5, s * 14); }); // antlers sweeping back
        for (let k = 0; k < 2; k++) { // the souls she keeps
            const a = p.t * 2.2 + k * Math.PI, r = 18 + Math.sin(p.t * 3 + k) * 2;
            c.shadowBlur = 10; c.shadowColor = '#69f0ae';
            sprEllipse(c, Math.cos(a) * r, Math.sin(a) * r, 2.4, 2.4, '#b9f6ca', false);
            c.shadowBlur = 0;
        }
    },

    monk(c, p) { // saffron robe over one shoulder, red sash, prayer beads, wrapped fists up in guard; monkPose moves the fists and legs
        const P = monkPose(p), iron = P.iron, skin = iron ? '#b87333' : '#d9a066';
        c.save(); c.rotate(P.spin); c.translate(P.lean, 0);
        sprFeet(c, p, '#5d4037');
        if (P.leg) { // a kick: the leg out from the hip, the foot wrapped like the fists
            const L = P.leg;
            sprStroke(c, '#e65100', 7, () => { c.moveTo(-1, L.hy); c.lineTo(lerp(-1, L.x, 0.45), lerp(L.hy, L.y, 0.45)); }); // the robe's hem over the thigh
            sprStroke(c, skin, 4.5, () => { c.moveTo(lerp(-1, L.x, 0.4), lerp(L.hy, L.y, 0.4)); c.lineTo(L.x, L.y); });
            sprEllipse(c, L.x + Math.cos(L.a) * 2, L.y + Math.sin(L.a) * 2, 4.6, 3.4, '#eceff1');
            c.strokeStyle = '#b0bec5'; c.lineWidth = 0.8; c.beginPath(); c.moveTo(L.x - Math.sin(L.a) * 3, L.y + Math.cos(L.a) * 3); c.lineTo(L.x + Math.sin(L.a) * 3, L.y - Math.cos(L.a) * 3); c.stroke();
        }
        sprTails(c, p, ['#c62828', '#b71c1c'], 3, 18); // the sash's ends
        c.save(); c.rotate(P.twist);
        sprTorso(c, skin, 13.5, 9.5);
        c.save(); c.beginPath(); c.ellipse(-1, 0, 9.5, 13.5, 0, 0, Math.PI * 2); c.clip(); // the robe, draped from the right shoulder
        c.fillStyle = '#ef6c00'; c.beginPath(); c.moveTo(10, 14); c.lineTo(-12, -2); c.lineTo(-12, 16); c.closePath(); c.fill();
        c.strokeStyle = '#e65100'; c.lineWidth = 1; c.beginPath(); c.moveTo(6, 13); c.lineTo(-10, 1); c.stroke(); c.restore();
        sprEllipse(c, -0.5, 11.5, 5.5, 5, '#ef6c00'); sprEllipse(c, -0.5, -11.5, 5, 4.5, skin); // robed shoulder, bare shoulder
        for (const f of P.fists) { // forearms forward, fists wrapped in white; the Hundred-Hand's afterimage fists behind them
            for (const g of f.ghosts) { c.globalAlpha = g.a; sprEllipse(c, g.x, g.y, 3.6, 3.4, '#fff3c4', false); }
            c.globalAlpha = 1;
            sprStroke(c, skin, 4, () => { c.moveTo(1, f.s * 12); c.lineTo(f.x - 2, f.y); });
            sprEllipse(c, f.x, f.y, f.palm ? 4.2 : 3.6, f.palm ? 3.8 : 3.4, '#eceff1');
            c.strokeStyle = '#b0bec5'; c.lineWidth = 0.8; c.beginPath(); c.moveTo(f.x - 1.5, f.y - 3); c.lineTo(f.x - 1.5, f.y + 3); c.stroke();
        }
        for (let i = 0; i < 12; i++) { const a = i * Math.PI / 6; sprEllipse(c, 1 + Math.cos(a) * 8.6, Math.sin(a) * 8.6, 1.3, 1.3, '#5d2a1a', false); } // prayer beads
        sprEllipse(c, 1, 0, 7, 7, skin); // bald head
        sprEllipse(c, 3, -2.5, 2.5, 1.6, iron ? 'rgba(255, 236, 200, 0.7)' : 'rgba(255, 255, 255, 0.35)', false);
        if (iron) { c.strokeStyle = 'rgba(255, 224, 178, 0.55)'; c.lineWidth = 1; c.beginPath(); c.arc(1, 0, 5, -2.4, -0.6); c.stroke(); } // Iron Body: bronze skin with a sheen
        c.restore();
        c.restore();
    },

    swordsaint(c, p) { // a blonde knight in royal blue and gold: braided bun, black-and-gold scarf, a silver shoulder guard
        sprFeet(c, p, '#1a1a22');
        // the skirt from above: a pleated bell round her waist with a scalloped hem and white frills, swinging with her stride
        const N = 16, cx = -3 + p.trail.x * 0.3, cy = p.trail.y * 0.3 + Math.sin(p.walk * 2) * 1.2 * p.move;
        const hem = (rx, ry, bump) => {
            c.beginPath();
            for (let i = 0; i <= N; i++) {
                const a = i / N * Math.PI * 2, m = a - Math.PI / N, x = cx + Math.cos(a) * rx, y = cy + Math.sin(a) * ry;
                if (!i) c.moveTo(x, y); else c.quadraticCurveTo(cx + Math.cos(m) * rx * bump, cy + Math.sin(m) * ry * bump, x, y);
            }
            c.closePath();
        };
        hem(14, 17, 1.14); sprFill(c, '#f2f2f5'); // the frills
        hem(12.4, 15.4, 1.08); sprFill(c, '#1f4aa8');
        c.strokeStyle = '#16357a'; c.lineWidth = 1; c.beginPath(); // pleats
        for (let i = 0; i < N; i++) { const a = i / N * Math.PI * 2; c.moveTo(cx * 0.4 + Math.cos(a) * 6, cy * 0.4 + Math.sin(a) * 8); c.lineTo(cx + Math.cos(a) * 12.2, cy + Math.sin(a) * 15.2); }
        c.stroke();
        c.strokeStyle = '#e8b931'; c.lineWidth = 1.2; c.beginPath(); c.ellipse(cx, cy, 10.6, 13.2, 0, 0, Math.PI * 2); c.stroke(); // gold band
        sprTails(c, p, ['#1a1a22', '#24242e'], 3.5, 24); // the scarf
        sprTorso(c, '#2552b8', 12.5, 8.5);
        sprEllipse(c, 4, 0, 3.5, 4.5, '#f2f2f5', false); // the white bodice
        c.strokeStyle = '#e8b931'; c.lineWidth = 1; c.beginPath(); c.moveTo(7, -5); c.lineTo(-6, -6); c.moveTo(7, 5); c.lineTo(-6, 6); c.stroke();
        sprEllipse(c, -0.5, 11.5, 4.5, 4, '#2552b8');
        sprEllipse(c, -0.5, -11.8, 6.5, 5.5, '#cfd8dc'); // the silver shoulder guard
        c.strokeStyle = '#e8b931'; c.lineWidth = 1; c.beginPath(); c.ellipse(-0.5, -11.8, 4.2, 3.4, 0, 0, Math.PI * 2); c.stroke();
        sprEllipse(c, -5.5, 0, 4.2, 4.2, '#d9b24e'); // the braided bun
        c.strokeStyle = '#b8902e'; c.lineWidth = 0.8; c.beginPath(); for (const o of [-2, 0, 2]) { c.moveTo(-8, o); c.lineTo(-3, o + 1); } c.stroke();
        sprEllipse(c, 1.5, 0, 7.2, 7.2, '#f0cf6a'); // blonde hair
        c.strokeStyle = '#c9a23e'; c.lineWidth = 0.9; c.beginPath(); c.moveTo(8, 0); c.quadraticCurveTo(2, -4, -4, -3); c.moveTo(8, 0); c.quadraticCurveTo(2, 4, -4, 3); c.stroke();
        sprEllipse(c, -2.5, 3.5, 1.6, 1.1, '#1f4aa8', false); // the ribbon
    },

    dragonknight(c, p) {
        sprFeet(c, p, '#3e2723');
        sprCape(c, p, '#b71c1c', 24, 14);
        sprTorso(c, '#616161', 15, 10);
        sprEllipse(c, 1, 0, 6, 9, '#c62828', false); // surcoat over the plate
        for (const s of [-1, 1]) {
            // Spiked pauldrons
            c.beginPath(); c.moveTo(-3.5, s * 16); c.lineTo(-1, s * 25); c.lineTo(3, s * 16); c.closePath(); sprFill(c, '#e0e0e0');
            sprEllipse(c, 0, s * 13, 7, 6.5, '#e53935');
            sprEllipse(c, 1.5, s * 11.5, 2.5, 2, 'rgba(255, 255, 255, 0.35)', false);
        }
        // Horns sweeping forward from the helm
        for (const s of [-1, 1]) {
            c.beginPath(); c.moveTo(-1, s * 4);
            c.quadraticCurveTo(0, s * 15, 11, s * 17);
            c.quadraticCurveTo(4, s * 11, 4, s * 4);
            c.closePath(); sprFill(c, '#efebe9');
        }
        sprEllipse(c, 2, 0, 8.5, 8, '#9e9e9e');
        sprStroke(c, '#d32f2f', 2.5, () => { c.moveTo(-5, 0); c.lineTo(4, 0); }); // crest
        // Visor slit, burning red while Frenzy is up
        const frenzy = p.live && player.frenzyStacks > 0;
        c.strokeStyle = frenzy ? '#ff5252' : '#212121'; c.lineWidth = 2;
        if (frenzy) { c.shadowBlur = 10; c.shadowColor = '#ff1744'; }
        c.beginPath(); c.arc(2, 0, 7, -0.6, 0.6); c.stroke();
        c.shadowBlur = 0;
    },

    ranger(c, p) {
        sprFeet(c, p, '#5d4037');
        sprCape(c, p, '#2e7d32', 22, 14);
        // Quiver slung across the back
        c.save(); c.translate(-9, 5); c.rotate(-0.5);
        for (const fy of [-2, 0, 2]) {
            c.beginPath(); c.moveTo(-9, fy); c.lineTo(-14, fy - 1.6); c.lineTo(-14, fy + 1.6); c.closePath();
            c.fillStyle = fy === 0 ? '#e53935' : '#f5f5f5'; c.fill();
        }
        c.beginPath(); c.rect(-9, -3.5, 16, 7); sprFill(c, '#6d4c41');
        c.restore();
        sprTorso(c, '#558b2f');
        c.strokeStyle = '#4e342e'; c.lineWidth = 2.5; c.lineCap = 'round';
        c.beginPath(); c.moveTo(6, -9); c.lineTo(-7, 10); c.stroke();
        sprPauldrons(c, '#33691e', 6);
        sprHood(c, '#388e3c', '#1b2a1b');
    },

    machinist(c, p) {
        sprFeet(c, p, '#424242');
        // Backpack with exhaust pipes and a power core that flares while Overclocked
        for (const s of [-1, 1]) { sprEllipse(c, -18, s * 6, 3.5, 3, '#37474f'); sprEllipse(c, -18.5, s * 6, 1.8, 1.5, '#111', false); }
        c.beginPath(); c.rect(-17, -9, 10, 18); sprFill(c, '#546e7a');
        c.fillStyle = '#b0bec5';
        for (const [rx, ry] of [[-15, -7], [-15, 7], [-11, -7], [-11, 7]]) c.fillRect(rx - 0.75, ry - 0.75, 1.5, 1.5);
        const oc = p.live && buffs.overclockTimer > 0;
        c.shadowBlur = oc ? 14 : 6; c.shadowColor = '#ffca28';
        sprEllipse(c, -13.5, 0, 2.5, 3.5, oc ? '#fff176' : '#ffca28', false);
        c.shadowBlur = 0;
        sprTorso(c, '#ef6c00');
        c.strokeStyle = '#4e342e'; c.lineWidth = 2.5; // tool belt
        c.beginPath(); c.ellipse(-1, 0, 6, 12, 0, -Math.PI / 2, Math.PI / 2); c.stroke();
        sprPauldrons(c, '#455a64', 5);
        // Head with goggles
        sprEllipse(c, 2, 0, 7.5, 7.5, '#5d4037');
        c.strokeStyle = '#212121'; c.lineWidth = 2;
        c.beginPath(); c.arc(2, 0, 6.5, 0.9, -0.9); c.stroke();
        for (const s of [-1, 1]) {
            sprEllipse(c, 7.5, s * 3.5, 3, 3, '#8d6e63');
            sprEllipse(c, 7.8, s * 3.5, 2, 2, '#4dd0e1', false);
            c.fillStyle = '#fff'; c.fillRect(8, s * 3.5 - 1.2, 1, 1);
        }
    },

    spellweaver(c, p) {
        sprFeet(c, p, '#283593');
        sprCape(c, p, '#1565c0', 19, 14, '#ffca28');
        sprTorso(c, '#1e88e5');
        sprPauldrons(c, '#1565c0', 5);
        // Wide-brimmed hat; the cone leans back and bobs with each step
        const bob = Math.sin(p.walk * 2) * p.move;
        const tipX = -9 + p.trail.x * 0.3, tipY = p.trail.y * 0.3 + bob;
        sprEllipse(c, 0, 0, 13, 13, '#0d47a1');
        c.strokeStyle = '#ffca28'; c.lineWidth = 2;
        c.beginPath(); c.arc(0, 0, 8.5, 0, Math.PI * 2); c.stroke();
        sprStar(c, 7, 8, 2.2, '#ffeb3b');
        sprStar(c, -6, -9, 1.6, '#ffeb3b');
        [[8, '#1565c0'], [5.5, '#1976d2'], [3.2, '#1e88e5']].forEach(([r, col], i) => {
            const f = (i + 1) / 4;
            sprEllipse(c, tipX * f, tipY * f, r, r, col);
        });
        const lx = tipX * 0.75, ly = tipY * 0.75;
        c.beginPath(); c.moveTo(lx, ly - 2.5); c.lineTo(tipX - 4, tipY + 3); c.lineTo(lx, ly + 2.5); c.closePath();
        sprFill(c, '#1e88e5');
        // Glowing tip, brighter while Arcane Resonance is charged
        const res = p.live && player.arcaneResonance;
        c.shadowBlur = res ? 14 : 6; c.shadowColor = '#4fc3f7';
        sprEllipse(c, tipX - 4, tipY + 3, res ? 2.6 : 1.8, res ? 2.6 : 1.8, res ? '#e1f5fe' : '#81d4fa', false);
        c.shadowBlur = 0;
    },

    nightblade(c, p) {
        sprFeet(c, p, '#212121');
        sprTails(c, p, ['#9c27b0', '#7b1fa2'], 3.5, 28);
        sprTorso(c, '#263238', 13, 9);
        c.strokeStyle = '#4a148c'; c.lineWidth = 2; // crossed knife belts
        c.beginPath(); c.moveTo(5, -8); c.lineTo(-6, 8); c.moveTo(5, 8); c.lineTo(-6, -8); c.stroke();
        sprPauldrons(c, '#4a148c', 5, 11);
        sprHood(c, '#38006b', '#0a0a0a');
        // Glowing eyes in the hood
        c.shadowBlur = 8; c.shadowColor = '#e040fb';
        for (const s of [-1, 1]) sprEllipse(c, 8, s * 2.2, 1.1, 1.1, '#f3e5f5', false);
        c.shadowBlur = 0;
    },

    kensei(c, p) {
        sprFeet(c, p, '#a1887f');
        sprCape(c, p, '#00838f', 16, 14, '#e0f7fa');
        sprTails(c, p, ['#ff5252', '#e53935'], 2, 20); // headband ribbons
        // Empty saya (scabbard) on the left hip
        sprStroke(c, '#263238', 3.5, () => { c.moveTo(7, -10); c.quadraticCurveTo(-6, -14.5, -23, -13); });
        c.strokeStyle = '#00e5ff'; c.lineWidth = 1.2;
        c.beginPath(); c.moveTo(5, -11.6); c.lineTo(3, -12.2); c.moveTo(-21, -13.4); c.lineTo(-23, -13.1); c.stroke();
        sprTorso(c, '#00acc1');
        c.strokeStyle = '#eceff1'; c.lineWidth = 3; // sash
        c.beginPath(); c.moveTo(6, -8); c.lineTo(-6, 9); c.stroke();
        sprPauldrons(c, '#00838f');
        // Straw kasa, rimmed with light when Flow is full
        const full = p.live && (player.flow >= player.maxFlow || player.empoweredAirborne);
        const grad = c.createRadialGradient(1, 0, 1, 1, 0, 14);
        grad.addColorStop(0, '#efebe9'); grad.addColorStop(1, '#bcaaa4');
        if (full) { c.shadowBlur = 14; c.shadowColor = '#00e5ff'; }
        sprEllipse(c, 1, 0, 13.5, 13.5, grad);
        c.shadowBlur = 0;
        c.strokeStyle = '#a1887f'; c.lineWidth = 0.8;
        c.beginPath();
        for (let i = 0; i < 12; i++) {
            const a = i * Math.PI / 6;
            c.moveTo(1 + Math.cos(a) * 3, Math.sin(a) * 3); c.lineTo(1 + Math.cos(a) * 12.5, Math.sin(a) * 12.5);
        }
        c.stroke();
        sprEllipse(c, 1, 0, 2.5, 2.5, '#d7ccc8');
    },

    cleric(c, p) {
        sprFeet(c, p, '#8d6e63');
        sprCape(c, p, '#fff8e1', 20, 14, '#fbc02d');
        sprTorso(c, '#fffde7');
        c.strokeStyle = '#fbc02d'; c.lineWidth = 3.5; // stole
        c.beginPath(); for (const s of [-1, 1]) { c.moveTo(7, s * 5.5); c.lineTo(-9, s * 6.5); } c.stroke();
        sprPauldrons(c, '#ffe082');
        // Mitre, pointed front and back
        sprEllipse(c, 2, 0, 7, 7, '#6d4c41');
        c.beginPath(); c.moveTo(10, 0); c.quadraticCurveTo(2, -10, -6, 0); c.quadraticCurveTo(2, 10, 10, 0);
        sprFill(c, '#fafafa');
        c.strokeStyle = '#fbc02d'; c.lineWidth = 1.5;
        c.beginPath(); c.moveTo(8.5, 0); c.lineTo(-4.5, 0); c.moveTo(4.5, -2.5); c.lineTo(4.5, 2.5); c.stroke();
        // Halo takes on the light of the last spell: gold for Holy, violet for Shadow
        const shadow = p.live && (buffs.aspectOfReaper > 0 || buffs.lastSpellClass === 'shadow');
        const col = shadow ? '#ce93d8' : '#ffeb3b';
        c.save();
        c.globalAlpha = 0.85; c.shadowBlur = 10; c.shadowColor = col;
        c.strokeStyle = col; c.lineWidth = 1.8;
        c.beginPath(); c.arc(1, 0, 11 + Math.sin(p.t * 3) * 0.6, 0, Math.PI * 2); c.stroke();
        c.restore();
    },

    druid(c, p) {
        sprFeet(c, p, '#6d4c41');
        const hem = sprCape(c, p, '#33691e', 22, 14);
        for (let i = -1.5; i <= 1.5; i++) sprLeaf(c, hem.x + 2, hem.y + i * 8, Math.PI + i * 0.35, 7, i % 2 ? '#689f38' : '#7cb342');
        sprTorso(c, '#6d4c41');
        for (const s of [-1, 1]) { // leaf pauldrons
            sprLeaf(c, -2, s * 8, s * 1.9, 10, '#7cb342');
            sprLeaf(c, 1, s * 8, s * 1.3, 9, '#8bc34a');
        }
        // Antlers
        for (const s of [-1, 1]) {
            sprStroke(c, '#d7ccc8', 2, () => {
                c.moveTo(0, s * 5); c.quadraticCurveTo(0, s * 12, -6, s * 18);
                c.moveTo(-0.5, s * 10); c.lineTo(5, s * 14);
                c.moveTo(-3, s * 14.5); c.lineTo(-1.5, s * 20);
                c.moveTo(-3.5, s * 15); c.lineTo(-10, s * 15.5);
            });
        }
        sprEllipse(c, 2, 0, 7.5, 7.5, '#4e342e');
        // Leaf circlet
        for (const a of [-1.1, -0.4, 0.4, 1.1]) sprLeaf(c, 2 + Math.cos(a) * 5, Math.sin(a) * 5, a, 5, '#9ccc65');
    },

    paladin(c, p) {
        sprFeet(c, p, '#78909c');
        const hem = sprCape(c, p, '#eceff1', 22, 14, '#ffca28');
        // Gold cross on the cape
        const cx = hem.x * 0.55, cy = hem.y * 0.5;
        c.strokeStyle = '#ffca28'; c.lineWidth = 2.5; c.lineCap = 'butt';
        c.beginPath(); c.moveTo(cx + 5, cy); c.lineTo(cx - 6, cy); c.moveTo(cx + 2, cy - 4); c.lineTo(cx + 2, cy + 4); c.stroke();
        sprTorso(c, '#b0bec5', 15, 10);
        sprEllipse(c, 1.5, -4, 4, 6, 'rgba(255, 255, 255, 0.25)', false); // plate sheen
        for (const s of [-1, 1]) {
            sprEllipse(c, 0, s * 13, 7.5, 6.5, '#cfd8dc');
            c.strokeStyle = '#ffca28'; c.lineWidth = 1.5;
            c.beginPath(); c.ellipse(0, s * 13, 5, 4, 0, 0, Math.PI * 2); c.stroke();
        }
        // Plume streaming back from the helm
        const px = -14 + p.trail.x * 0.6, py = p.trail.y * 0.6 + Math.sin(p.t * 7) * p.move;
        c.beginPath(); c.moveTo(4, -2); c.quadraticCurveTo(-4, -4, px, py); c.quadraticCurveTo(-4, 4, 4, 2); c.closePath();
        sprFill(c, '#c62828');
        // Great helm with a cross-shaped visor
        sprEllipse(c, 2, 0, 8, 8, '#cfd8dc');
        c.strokeStyle = '#ffca28'; c.lineWidth = 1.2;
        c.beginPath(); c.arc(2, 0, 6, 0, Math.PI * 2); c.stroke();
        c.strokeStyle = '#263238'; c.lineWidth = 1.8;
        c.beginPath(); c.moveTo(4, 0); c.lineTo(9.5, 0); c.moveTo(8, -3.5); c.lineTo(8, 3.5); c.stroke();
    },
};

// The Druid's wolf (druid.js stamps it for the companion and the spirit wolves; pose.bite opens the jaws).
// pose.coat swaps the fur (expeditions_fx.js: Old Scar's grizzled grey); pose.tornEar rips the left ear
const WOLF_COAT = { paw: '#3e2723', tail: '#4e342e', tip: '#a1887f', body: '#5d4037', spine: '#3e2723', ruff: '#6d4c41', head: '#6d4c41', ear: '#3e2723', jaw: '#5d4037', muzzle: '#8d6e63' };
function sprWolf(c, p) {
    const K = p.coat || WOLF_COAT;
    const rest = p.rest || 0, lean = p.lean || 0; // lying down (the Beastmaster's hounds, bandits.js): forepaws out in front, hind legs splayed; lean: into a stroking hand
    const g = Math.sin(p.walk * 1.4) * 7 * p.move * (1 - rest); // diagonal pairs step together
    for (const s of [-1, 1]) {
        // A claw attack rakes one front paw forward
        const reach = p.swipe && p.swipe.side === s ? Math.sin(p.swipe.q * Math.PI) : 0;
        const px = lerp(13 - s * g + reach * 13, 27, rest), py = lerp(s * (9 - reach * 4), s * 7.5, rest); // lying: either side of the muzzle
        if (reach > 0.2) sprStroke(c, '#eeeeee', 1, () => { for (const k of [-2, 0, 2]) { c.moveTo(px + 3, py + k); c.lineTo(px + 7, py + k * 1.4); } });
        sprEllipse(c, px, py, 4.5 + reach, 3.5, K.paw);
    }
    sprEllipse(c, lerp(-13 - g, -8, rest), lerp(-9, -14, rest), 4.5, 3.5, K.paw);
    sprEllipse(c, lerp(-13 + g, -8, rest), lerp(9, 14, rest), 4.5, 3.5, K.paw);
    // Tail: lying, it curls round the left haunch and thumps faster when it's being stroked
    const wag = Math.sin(p.t * (8 - 5 * rest + 6 * lean)) * (6 - 3 * rest) + p.trail.y;
    const tx = lerp(Math.min(-26, -36 + p.trail.x * 0.5), -10, rest), ty = lerp(wag, -17 + wag * 0.4, rest);
    sprStroke(c, K.tail, 7, () => { c.moveTo(-18, 0); c.quadraticCurveTo(lerp(-28, -30, rest), lerp(wag * 0.3, -14, rest), tx, ty); });
    sprEllipse(c, tx - 1, ty, 3, 3, K.tip, false);
    // Body
    sprEllipse(c, -2, 0, 21, 12.5, K.body);
    sprEllipse(c, -4, 0, 15, 4.5, K.spine, false);
    sprEllipse(c, 9, 0, 9, 11, K.ruff); // shoulder ruff
    // Head: thrusts forward on a Bite while the jaws gape and snap shut
    const b = p.bite;
    const open = b === undefined || b === null ? 0 : (b < 0.12 ? b / 0.12 : Math.max(0, 1 - (b - 0.12) / 0.1));
    c.save();
    if (b !== undefined && b !== null) c.translate(Math.sin(Math.min(1, b * 2) * Math.PI) * 6, 0);
    if (lean) { c.translate(10, 0); c.rotate(lean * 0.35); c.translate(-10, 0); } // the head turned up into the hand
    sprEllipse(c, 17, 0, 9, 8.5, K.head);
    for (const s of [-1, 1]) {
        c.beginPath(); c.moveTo(14, s * 3.5);
        if (s < 0 && p.tornEar) { c.lineTo(10.5, -9); c.lineTo(9.6, -11.6); c.lineTo(12.4, -10.4); c.lineTo(13, -12.2); } // bitten off: a ragged stub
        else c.lineTo(7, s * 13);
        c.lineTo(17, s * 8); c.closePath();
        sprFill(c, K.ear);
    }
    // Seen from above, the lower jaw stays put while the upper jaw lifts toward the camera:
    // the muzzle foreshortens and uncovers the open mouth and the lower fangs
    if (open > 0) {
        sprEllipse(c, 27, 0, 6.5, 3.8, K.jaw); // lower jaw
        sprEllipse(c, 28, 0, 4.8, 2.6, '#4a0e0e', false); // open mouth
        c.fillStyle = '#fafafa';
        for (const s of [-1, 1]) { c.beginPath(); c.moveTo(30.5, s * 2.6); c.lineTo(32, s * 2.2); c.lineTo(30.8, s * 0.9); c.closePath(); c.fill(); } // lower fangs
    }
    const mx = 26 - 4.5 * open, mrx = 7 - 2.5 * open, mry = 4.5 * (1 + 0.12 * open);
    sprEllipse(c, mx, 0, mrx, mry, K.muzzle); // upper muzzle
    if (open > 0.1) { // upper fangs hanging off the front of the muzzle
        c.fillStyle = '#fafafa';
        for (const s of [-1, 1]) { c.beginPath(); c.moveTo(mx + mrx - 1.5, s * 2.8); c.lineTo(mx + mrx + 1.2 * open + 0.5, s * 2); c.lineTo(mx + mrx - 1, s * 1.2); c.closePath(); c.fill(); }
    }
    sprEllipse(c, mx + mrx - 1, -0.3, 2.3, 2.3, '#111', false); // nose
    c.shadowBlur = 8; c.shadowColor = '#76ff03';
    for (const s of [-1, 1]) sprEllipse(c, 21, s * 4, 1.4, 1.4, '#ccff90', false);
    c.shadowBlur = 0;
    c.restore();
}

// The Druid's black jaguar (the other companion): long and low, a heavy tail, faint rosettes, gold eyes.
// pose.pounce (0..1) stretches it out mid-spring, forepaws reaching; pose.bite opens the jaws like the wolf's.
const JAG_FUR = '#211f29', JAG_DARK = '#141319', JAG_RIM = 'rgba(170, 170, 200, 0.55)';
const JAG_ROSETTES = [[-20, -5], [-13, 4], [-6, -6], [1, 5], [5, -3], [-24, 3], [-9, -1], [-17, 7], [-2, -8], [-27, -2]];
function sprJaguar(c, p) {
    const pz = p.pounce === null || p.pounce === undefined ? 0 : Math.sin(p.pounce * Math.PI);
    const g = Math.sin(p.walk * 1.2) * 6 * p.move * (1 - pz); // a smooth, rolling cat gait
    c.save();
    c.scale(1 + 0.14 * pz, 1 - 0.06 * pz); // stretched out in the air
    // Paws: hind legs kick back and forepaws reach forward mid-pounce, claws out
    for (const s of [-1, 1]) {
        const fx = 15 - s * g + pz * 10, fy = s * (8.5 - pz * 2.5);
        if (pz > 0.3) sprStroke(c, '#e0e0e0', 0.9, () => { for (const k of [-1.6, 0, 1.6]) { c.moveTo(fx + 3, fy + k); c.lineTo(fx + 6.5, fy + k * 1.5); } });
        sprEllipse(c, fx, fy, 4.2 + pz, 3.2, JAG_DARK);
        sprEllipse(c, -17 + s * g - pz * 9, s * (8.5 + pz), 4.2, 3.2, JAG_DARK);
    }
    // Tail: long, thick, swaying slowly with a curl at the tip
    const sway = Math.sin(p.t * 2.2) * 7 + p.trail.y * 1.2, tx = Math.min(-34, -48 + p.trail.x * 0.4) - pz * 6;
    sprStroke(c, JAG_FUR, 5.5, () => { c.moveTo(-22, 0); c.bezierCurveTo(-32, sway * 0.2, -40, sway * 0.9, tx, sway); c.quadraticCurveTo(tx - 5, sway + 4 * Math.sign(sway || 1), tx - 3, sway + 7 * Math.sign(sway || 1)); });
    // Body: haunches, a long barrel, heavy shoulders
    sprEllipse(c, -16, 0, 8.5, 10.5, JAG_FUR);
    sprEllipse(c, -4, 0, 22, 10.5, JAG_FUR);
    sprEllipse(c, 9, 0, 8.5, 11.5, '#201f27');
    c.strokeStyle = JAG_RIM; c.lineWidth = 1.2; // a rim of light along both flanks so it never reads as a hole in dark caves
    for (const s of [-1, 1]) { c.beginPath(); c.ellipse(-4, 0, 20.5, 9.4, 0, s > 0 ? 0.25 : Math.PI + 0.25, s > 0 ? Math.PI - 0.25 : Math.PI * 2 - 0.25); c.stroke(); }
    c.strokeStyle = 'rgba(70, 68, 84, 0.55)'; c.lineWidth = 1.1; // rosettes, barely there on the black coat
    for (const [x, y] of JAG_ROSETTES) { c.beginPath(); c.arc(x, y, 2.1, 0.4, Math.PI * 1.7); c.stroke(); }
    sprEllipse(c, -6, 0, 16, 2.6, '#26252e', false); // spine highlight
    // Head: round, small rounded ears, a short broad muzzle; the jaws work like the wolf's (top-down foreshortening)
    const b = p.bite;
    const open = b === undefined || b === null ? 0 : (b < 0.12 ? b / 0.12 : Math.max(0, 1 - (b - 0.12) / 0.1));
    c.save();
    if (b !== undefined && b !== null) c.translate(Math.sin(Math.min(1, b * 2) * Math.PI) * 6, 0);
    for (const s of [-1, 1]) { sprEllipse(c, 15, s * 7, 3.2, 3.2, JAG_FUR); sprEllipse(c, 15.3, s * 7, 1.5, 1.5, '#3b2f33', false); }
    sprEllipse(c, 19, 0, 8.5, 8.2, '#24222c');
    c.strokeStyle = JAG_RIM; c.lineWidth = 1.1; c.beginPath(); c.arc(19, 0, 7.4, -2.2, 2.2); c.stroke();
    if (open > 0) {
        sprEllipse(c, 26.5, 0, 5.5, 3.6, '#18171d'); // lower jaw
        sprEllipse(c, 27.3, 0, 4.2, 2.5, '#4a0e0e', false); // open mouth
        c.fillStyle = '#fafafa';
        for (const s of [-1, 1]) { c.beginPath(); c.moveTo(29.5, s * 2.5); c.lineTo(31, s * 2.1); c.lineTo(29.8, s * 0.9); c.closePath(); c.fill(); }
    }
    const mx = 25 - 3.5 * open, mrx = 4.8 - 1.8 * open, mry = 4.8 * (1 + 0.1 * open);
    sprEllipse(c, mx, 0, mrx, mry, '#25242c'); // upper muzzle
    if (open > 0.1) {
        c.fillStyle = '#fafafa';
        for (const s of [-1, 1]) { c.beginPath(); c.moveTo(mx + mrx - 1.2, s * 2.6); c.lineTo(mx + mrx + 1.2 * open + 0.5, s * 1.9); c.lineTo(mx + mrx - 0.8, s * 1.1); c.closePath(); c.fill(); }
    }
    sprEllipse(c, mx + mrx - 0.8, 0, 1.6, 1.9, '#3a2c30', false); // nose
    c.shadowBlur = 8; c.shadowColor = '#ffb300';
    for (const s of [-1, 1]) { c.beginPath(); c.ellipse(21.5, s * 3.6, 1.7, 1.1, s * 0.35, 0, Math.PI * 2); c.fillStyle = '#ffd54f'; c.fill(); }
    c.shadowBlur = 0;
    c.restore();
    c.restore();
}

function sprGeneric(c, p) {
    sprFeet(c, p, '#424242');
    sprTorso(c, p.color || '#9e9e9e');
    sprEllipse(c, 2, 0, 7.5, 7.5, '#d7ccc8');
}

// ==========================================
// Rendering entry points
// ==========================================

// Draw a character centered on the current origin, already rotated to its facing
function drawCharacter(c, classId, pose) {
    c.save();
    c.lineJoin = 'round';
    const breathe = 1 + Math.sin(pose.t * 2.5) * 0.015 * (1 - pose.move) + Math.abs(Math.sin(pose.walk)) * 0.03 * pose.move;
    c.scale(breathe, breathe);
    if (pose.broom) sprWitchBroom(c, pose); // witch_fx.js: a side view while she flies
    else if (pose.jaguar) sprJaguar(c, pose);
    else if (pose.wolf) sprWolf(c, pose);
    else (CLASS_SPRITES[classId] || NPC_SPRITES[classId] || sprGeneric)(c, pose); // npcs.js: Cinderholt's friends
    c.restore();
}

// World-space lighting (light from the top-left) and an optional red hit flash, applied over everything drawn on `c`
function sprFinish(c, cx, cy, r, flash) {
    c.save();
    c.setTransform(1, 0, 0, 1, 0, 0);
    c.globalCompositeOperation = 'source-atop';
    const grad = c.createLinearGradient(cx - r, cy - r, cx + r, cy + r);
    grad.addColorStop(0, 'rgba(255, 255, 255, 0.18)');
    grad.addColorStop(0.5, 'rgba(255, 255, 255, 0)');
    grad.addColorStop(1, 'rgba(0, 0, 0, 0.3)');
    c.fillStyle = grad; c.fillRect(0, 0, c.canvas.width, c.canvas.height);
    if (flash > 0) { c.fillStyle = `rgba(255, 70, 70, ${0.7 * flash})`; c.fillRect(0, 0, c.canvas.width, c.canvas.height); }
    c.restore();
}

// Render a character through the offscreen canvas and stamp it onto the game canvas
function stampSprite(x, y, facing, classId, pose, flash = 0, alpha = 1) {
    const c = spriteCtx, half = SPRITE_SIZE / 2;
    c.setTransform(1, 0, 0, 1, 0, 0); c.clearRect(0, 0, SPRITE_SIZE, SPRITE_SIZE);
    c.translate(half, half); c.rotate(pose.broom ? 0 : facing); // the Witch's broom is a side view: it turns itself (witch_fx.js)
    drawCharacter(c, classId, pose);
    sprFinish(c, half, half, 30, flash);
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.drawImage(spriteCanvas, x - half, y - half);
    ctx.restore();
}

// Call once per frame before drawing the player
function updatePlayerSpriteAnim() {
    const a = spriteAnim, now = performance.now();
    const dt = a.lastTime ? Math.min(0.1, (now - a.lastTime) / 1000) : 0;
    a.lastTime = now;
    if (a.lastX === null) { a.lastX = player.x; a.lastY = player.y; }
    let dx = player.x - a.lastX, dy = player.y - a.lastY;
    a.lastX = player.x; a.lastY = player.y;
    if (Math.hypot(dx, dy) > 60) dx = dy = 0; // blinks and teleports shouldn't whip the cape
    if (dt > 0) {
        const k = Math.min(1, dt * 10);
        a.vx += (dx / dt - a.vx) * k; a.vy += (dy / dt - a.vy) * k;
    }
    a.walk += Math.hypot(dx, dy) * 0.06;
    if (player.hurtFlash > 0) player.hurtFlash -= dt;
}

function playerPose(facing) {
    const a = spriteAnim;
    // Velocity in the character's local frame, reversed: the direction loose cloth gets dragged
    const cos = Math.cos(facing), sin = Math.sin(facing);
    let tx = -(a.vx * cos + a.vy * sin) * 0.03, ty = -(-a.vx * sin + a.vy * cos) * 0.03;
    const m = Math.hypot(tx, ty);
    if (m > 12) { tx *= 12 / m; ty *= 12 / m; }
    return {
        t: performance.now() / 1000, walk: a.walk, move: Math.min(1, Math.hypot(a.vx, a.vy) / 150),
        trail: { x: tx, y: ty }, live: true, wolf: false, color: player.color,
        broom: !!(player.broom || player.wtSwoop), heading: facing, bank: player.broom ? player.broom.bank : 0 // witch.js
    };
}

function drawPlayerShadow(facing) {
    const z = player.z || 0, s = 1 - Math.min(0.45, z / 160); // leaping: the shadow shrinks and fades below the hero
    ctx.save();
    ctx.fillStyle = `rgba(0, 0, 0, ${0.35 * (1 - Math.min(0.5, z / 200))})`;
    ctx.beginPath();
    if (player.broom || player.wtSwoop) ctx.ellipse(player.x, player.y + 8, 24 * s, 7 * s, 0, 0, Math.PI * 2); // witch.js: the broom's long side-on shadow
    else ctx.ellipse(player.x + 3, player.y + 6, 15 * s, 18 * s, facing, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
}

function drawPlayerSprite(facing) {
    const flash = player.hurtFlash > 0 ? Math.min(1, player.hurtFlash / 0.2) : 0;
    const pose = playerPose(facing);
    // Hidden in a Smoke Bomb, the player turns translucent
    stampSprite(player.x, player.y, facing, selectedClassId, pose, flash, player.inSmoke ? 0.55 : 1);
}

// A frozen, translucent copy of the player (e.g. the phantom decoy)
function drawPlayerGhost(x, y, facing, alpha) {
    const pose = { t: performance.now() / 1000, walk: 0, move: 0, trail: { x: 0, y: 0 }, live: false, wolf: false, color: player.color };
    stampSprite(x, y, facing, selectedClassId, pose, 0, alpha);
}
