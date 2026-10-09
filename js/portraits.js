// ==========================================
// portraits.js - Class-select portraits
// ==========================================
// Unlike the in-game sprites these are front-facing, waist-up action poses: a deliberate exception to the top-down rule.
// Each portrait paints in a PT_W x PT_H frame: bg (behind, unlit), draw (the hero, lit from the top-left as one layer), fx (glows on top).

const PT_W = 300, PT_H = 230, PT_LINE = 'rgba(12, 10, 18, 0.92)', PT_SKIN = '#e2b48a';
const ptLayer = document.createElement('canvas'), ptLayerCtx = ptLayer.getContext('2d');
const ptRand = i => { const x = Math.sin(i * 127.1 + 311.7) * 43758.5453; return x - Math.floor(x); };
const ptRgba = (hex, a) => { const n = parseInt(hex.slice(1), 16); return `rgba(${n >> 16}, ${(n >> 8) & 255}, ${n & 255}, ${a})`; };

// ---------- drawing helpers ----------

function ptFill(c, fill, lw = 2.4) { c.fillStyle = fill; c.fill(); if (lw) { c.strokeStyle = PT_LINE; c.lineWidth = lw; c.stroke(); } }
function ptEll(c, x, y, rx, ry, fill, lw, rot = 0) { c.beginPath(); c.ellipse(x, y, rx, ry, rot, 0, Math.PI * 2); ptFill(c, fill, lw); }
function ptPoly(c, pts, fill, lw) { c.beginPath(); pts.forEach(([x, y], i) => i ? c.lineTo(x, y) : c.moveTo(x, y)); c.closePath(); ptFill(c, fill, lw); }
// Thick outlined polyline: shafts, straps, limbs
function ptLine(c, color, w, pts) {
    const path = () => { c.beginPath(); pts.forEach(([x, y], i) => i ? c.lineTo(x, y) : c.moveTo(x, y)); };
    c.lineCap = 'round'; c.lineJoin = 'round';
    path(); c.strokeStyle = PT_LINE; c.lineWidth = w + 4.5; c.stroke();
    path(); c.strokeStyle = color; c.lineWidth = w; c.stroke();
}
// Cloth strip along a cubic curve, narrowing toward the free end
function ptRibbon(c, color, w, p0, p1, p2, p3) {
    const pt = u => { const v = 1 - u; return [v * v * v * p0[0] + 3 * v * v * u * p1[0] + 3 * v * u * u * p2[0] + u * u * u * p3[0], v * v * v * p0[1] + 3 * v * v * u * p1[1] + 3 * v * u * u * p2[1] + u * u * u * p3[1]]; };
    const L = [], R = [];
    for (let i = 0; i <= 16; i++) {
        const u = i / 16, [x, y] = pt(u), [x2, y2] = pt(Math.min(1, u + 0.01)), [x0, y0] = pt(Math.max(0, u - 0.01));
        const dx = x2 - x0, dy = y2 - y0, d = Math.hypot(dx, dy) || 1, hw = w * (1 - 0.55 * u) / 2;
        L.push([x - dy / d * hw, y + dx / d * hw]); R.unshift([x + dy / d * hw, y - dx / d * hw]);
    }
    ptPoly(c, L.concat(R), color, 2.2);
}
// Upper arm and forearm; both outlines go down first so the elbow joint stays seamless
function ptArm(c, color, sh, el, hand, w1 = 18, w2 = 14) {
    const seg = (a, b) => { c.beginPath(); c.moveTo(a[0], a[1]); c.lineTo(b[0], b[1]); };
    c.lineCap = 'round'; c.strokeStyle = PT_LINE;
    c.lineWidth = w1 + 4.5; seg(sh, el); c.stroke(); c.lineWidth = w2 + 4.5; seg(el, hand); c.stroke();
    c.strokeStyle = color; c.lineWidth = w1; seg(sh, el); c.stroke(); c.lineWidth = w2; seg(el, hand); c.stroke();
    c.strokeStyle = 'rgba(0, 0, 0, 0.18)'; c.lineWidth = w2 * 0.35; seg([el[0] + 2, el[1] + 2], [hand[0] + 2, hand[1] + 2]); c.stroke(); // underside shade
}
// Shoulders-to-waist block, cut off by the bottom edge
function ptTorso(c, color, sw = 48, ww = 38, top = 114) {
    c.beginPath(); c.moveTo(150 - ww, PT_H + 6); c.lineTo(150 - sw + 6, 150); c.quadraticCurveTo(150 - sw - 2, top + 4, 150 - sw + 26, top);
    c.lineTo(150 + sw - 26, top); c.quadraticCurveTo(150 + sw + 2, top + 4, 150 + sw - 6, 150); c.lineTo(150 + ww, PT_H + 6); c.closePath();
    ptFill(c, color);
}
function ptBelt(c, color, y, buckle) {
    ptPoly(c, [[110, y], [190, y], [191, y + 11], [109, y + 11]], color);
    if (buckle) ptPoly(c, [[143, y - 2], [157, y - 2], [157, y + 13], [143, y + 13]], buckle);
}
// Cape hanging behind the shoulders, swaying
function ptCape(c, color, t, a, trim) {
    const s = Math.sin(t * 1.3) * (2 + 4 * a);
    c.beginPath(); c.moveTo(114, 116); c.quadraticCurveTo(72 - s, 168, 50 - s, PT_H + 6); c.lineTo(250 + s * 0.6, PT_H + 6); c.quadraticCurveTo(230 + s * 0.6, 168, 186, 116); c.closePath();
    ptFill(c, color);
    if (trim) { c.save(); c.clip(); c.strokeStyle = trim; c.lineWidth = 7; c.stroke(); c.restore(); c.strokeStyle = PT_LINE; c.lineWidth = 2.4; c.stroke(); }
    c.strokeStyle = sprShade(color, -0.3); c.lineWidth = 1.5; c.beginPath(); // folds
    c.moveTo(96, 170); c.quadraticCurveTo(80 - s, 200, 76 - s, PT_H); c.moveTo(206, 170); c.quadraticCurveTo(220 + s * 0.5, 200, 224 + s * 0.5, PT_H); c.stroke();
}
function ptPauldrons(c, color, rx = 22, ry = 15, rim) {
    for (const s of [-1, 1]) {
        ptEll(c, 150 + s * 42, 122, rx, ry, color, 2.4, s * 0.25);
        if (rim) { c.strokeStyle = rim; c.lineWidth = 2; c.beginPath(); c.ellipse(150 + s * 42, 122, rx - 6, ry - 5, s * 0.25, 0, Math.PI * 2); c.stroke(); }
        ptEll(c, 150 + s * 42 - 6, 116, rx * 0.35, ry * 0.25, 'rgba(255, 255, 255, 0.28)', 0, s * 0.25);
    }
}
// Hood framing a shadowed face; returns nothing, the face opening is drawn by the caller
function ptHood(c, color, top = 42) {
    c.beginPath(); c.moveTo(150, top); c.quadraticCurveTo(114, top + 4, 118, 96); c.quadraticCurveTo(124, 114, 150, 118); c.quadraticCurveTo(176, 114, 182, 96); c.quadraticCurveTo(186, top + 4, 150, top); c.closePath();
    ptFill(c, color);
    c.strokeStyle = sprShade(color, -0.35); c.lineWidth = 1.6; c.beginPath(); c.moveTo(150, top + 3); c.quadraticCurveTo(146, 56, 150, 64); c.stroke();
}
// Blade from base to tip with a fuller and an edge highlight
function ptBlade(c, b, tip, w, fill) {
    const dx = tip[0] - b[0], dy = tip[1] - b[1], L = Math.hypot(dx, dy), ux = dx / L, uy = dy / L, nx = -uy, ny = ux;
    const p = (s, o) => [b[0] + ux * s + nx * o, b[1] + uy * s + ny * o];
    ptPoly(c, [p(0, -w), p(L - w * 2.2, -w * 0.85), p(L, 0), p(L - w * 2.2, w * 0.85), p(0, w)], fill);
    c.lineCap = 'round';
    c.strokeStyle = 'rgba(0, 0, 0, 0.22)'; c.lineWidth = w * 0.35; c.beginPath(); c.moveTo(...p(4, 0)); c.lineTo(...p(L - w * 3, 0)); c.stroke();
    c.strokeStyle = 'rgba(255, 255, 255, 0.6)'; c.lineWidth = 1.2; c.beginPath(); c.moveTo(...p(3, -w * 0.6)); c.lineTo(...p(L - w * 2.4, -w * 0.5)); c.stroke();
    return p;
}
function ptGear(c, x, y, r, teeth, ang) {
    c.beginPath();
    for (let i = 0; i < teeth * 2; i++) {
        const a0 = ang + i * Math.PI / teeth, rr = i % 2 ? r * 0.82 : r;
        c.lineTo(x + Math.cos(a0 - 0.12) * rr, y + Math.sin(a0 - 0.12) * rr); c.lineTo(x + Math.cos(a0 + 0.12) * rr, y + Math.sin(a0 + 0.12) * rr);
    }
    c.closePath(); c.moveTo(x + r * 0.35, y); c.arc(x, y, r * 0.35, 0, Math.PI * 2, true);
}
function ptGlow(c, x, y, r, color, a) {
    const g = c.createRadialGradient(x, y, 0, x, y, r);
    g.addColorStop(0, ptRgba(color, a)); g.addColorStop(1, ptRgba(color, 0));
    c.fillStyle = g; c.beginPath(); c.arc(x, y, r, 0, Math.PI * 2); c.fill();
}
function ptFallingLeaves(c, t, n, colors, alpha) {
    c.save(); c.globalAlpha = alpha;
    for (let i = 0; i < n; i++) {
        const x = ptRand(i) * PT_W + Math.sin(t * 0.8 + i) * 14, y = (t * (10 + ptRand(i + 20) * 12) + ptRand(i + 40) * 260) % 260 - 15;
        c.save(); c.translate(x, y); c.scale(1.7, 1.7); sprLeaf(c, 0, 0, t * (0.4 + ptRand(i + 7)) + i, 7, colors[i % colors.length]); c.restore();
    }
    c.restore();
}
function ptEyes(c, y, color, glow, rx = 3, ry = 1.7, gap = 7) {
    c.save(); c.shadowBlur = 8; c.shadowColor = glow; c.fillStyle = color;
    for (const s of [-1, 1]) { c.beginPath(); c.ellipse(150 + s * gap, y, rx, ry, 0, 0, Math.PI * 2); c.fill(); }
    c.restore();
}

// ---------- the nine portraits ----------

const PORTRAITS = {
    dragonknight: {
        color: '#e53935',
        bg(c, t) { // embers rising from below
            for (let i = 0; i < 28; i++) {
                const sp = 16 + ptRand(i) * 30, y = PT_H + 10 - ((t * sp + ptRand(i + 50) * 300) % (PT_H + 30)), x = ptRand(i + 9) * PT_W + Math.sin(t * 1.5 + i) * 8;
                c.fillStyle = `rgba(255, ${110 + (i % 4) * 30}, 40, ${0.1 + 0.6 * y / PT_H})`; c.beginPath(); c.arc(x, y, 1 + ptRand(i + 3) * 2, 0, 7); c.fill();
            }
        },
        draw(c, t, a) {
            ptCape(c, '#b71c1c', t, a);
            // Greatsword raised over the shoulder, ready to cleave
            const p = ptBlade(c, [226, 120], [282, 8], 8.5, '#cfd8dc');
            const heat = 0.25 + 0.2 * Math.sin(t * 2.4);
            c.save(); c.shadowBlur = 10; c.shadowColor = '#ff6d00'; c.strokeStyle = `rgba(255, 120, 40, ${heat})`; c.lineWidth = 2;
            c.beginPath(); c.moveTo(...p(6, 8)); c.lineTo(...p(104, 7)); c.stroke(); c.restore();
            ptLine(c, '#3e2723', 8, [p(-4, 0), p(-40, 0)]);
            ptLine(c, '#757575', 7, [p(0, -20), p(0, 20)]);
            ptEll(c, ...p(-45, 0), 6, 6, '#ffb300');
            ptTorso(c, '#616161', 50, 40);
            ptPoly(c, [[132, 116], [168, 116], [180, PT_H + 6], [120, PT_H + 6]], '#c62828'); // surcoat
            c.strokeStyle = '#7f0000'; c.lineWidth = 3; c.beginPath(); c.moveTo(138, 150); c.lineTo(150, 162); c.lineTo(162, 150); c.moveTo(141, 162); c.lineTo(150, 171); c.lineTo(159, 162); c.stroke();
            ptBelt(c, '#3e2723', 196, '#ffb300');
            ptEll(c, 150, 108, 16, 8, '#757575');
            ptArm(c, '#757575', [190, 126], [232, 168], p(-12, 0), 19, 15);
            ptArm(c, '#757575', [110, 126], [140, 174], p(-30, 0), 19, 15);
            ptEll(c, ...p(-12, 0), 9, 8, '#616161'); ptEll(c, ...p(-30, 0), 9, 8, '#616161');
            for (const s of [-1, 1]) { // spiked pauldrons
                const x = (v) => 150 + s * v;
                ptPoly(c, [[x(56), 114], [x(70), 86], [x(46), 108]], '#e0e0e0');
                ptPoly(c, [[x(42), 108], [x(46), 80], [x(32), 106]], '#e0e0e0');
            }
            ptPauldrons(c, '#e53935', 25, 17);
            for (const s of [-1, 1]) { // horns sweeping up from the helm
                c.beginPath(); c.moveTo(150 + s * 16, 72); c.quadraticCurveTo(150 + s * 42, 66, 150 + s * 52, 34); c.quadraticCurveTo(150 + s * 34, 52, 150 + s * 12, 60); c.closePath(); ptFill(c, '#efebe9');
                c.strokeStyle = '#bcaaa4'; c.lineWidth = 1.2; c.beginPath(); c.moveTo(150 + s * 26, 66); c.lineTo(150 + s * 24, 62); c.moveTo(150 + s * 36, 60); c.lineTo(150 + s * 32, 56); c.stroke();
            }
            ptPoly(c, [[145, 58], [150, 44], [155, 58]], '#d32f2f');
            ptEll(c, 150, 80, 21, 24, '#9e9e9e');
            ptEll(c, 143, 68, 6, 4, 'rgba(255, 255, 255, 0.3)', 0);
            c.fillStyle = '#212121'; c.fillRect(133, 77, 34, 7); c.fillRect(147, 84, 6, 14); // T visor
            c.strokeStyle = PT_LINE; c.lineWidth = 1.2; c.beginPath(); c.moveTo(132, 92); c.quadraticCurveTo(138, 100, 144, 102); c.moveTo(168, 92); c.quadraticCurveTo(162, 100, 156, 102); c.stroke();
        },
        fx(c, t, a) { // visor burning with Frenzy
            const f = 0.55 + 0.45 * Math.sin(t * 3) * (0.4 + 0.6 * a);
            c.save(); c.shadowBlur = 12; c.shadowColor = '#ff1744'; c.fillStyle = `rgba(255, 82, 82, ${0.6 + 0.4 * f})`;
            c.fillRect(135, 79, 30, 3); c.fillRect(148.5, 84, 3, 11); c.restore();
        },
    },

    ranger: {
        color: '#81c784',
        bg(c, t) { ptFallingLeaves(c, t, 13, ['#7cb342', '#9ccc65', '#c0ca33'], 0.45); },
        draw(c, t, a) {
            ptCape(c, '#2e7d32', t, a);
            c.save(); c.translate(102, 96); c.rotate(-0.35); // quiver over the shoulder
            [['#f5f5f5', -7], ['#e53935', 0], ['#f5f5f5', 7]].forEach(([col, k]) => { ptLine(c, '#a1887f', 2, [[k, 0], [k, -26]]); ptPoly(c, [[k - 4, -20], [k, -36], [k + 4, -20], [k, -24]], col, 1.5); });
            ptPoly(c, [[-13, -4], [13, -4], [11, 56], [-11, 56]], '#6d4c41'); ptPoly(c, [[-13, 4], [13, 4], [13, 9], [-13, 9]], '#4e342e', 1.5);
            c.restore();
            const pull = Math.sin(t * 1.8) * 2.5 * a, H = [164 - pull, 98];
            c.beginPath(); c.moveTo(250, 22); c.quadraticCurveTo(294, 104, 250, 190); // bow
            c.lineCap = 'round'; c.strokeStyle = PT_LINE; c.lineWidth = 13; c.stroke(); c.strokeStyle = '#6d4c41'; c.lineWidth = 8.5; c.stroke();
            c.strokeStyle = '#a1887f'; c.lineWidth = 2.5; c.beginPath(); c.moveTo(252, 30); c.quadraticCurveTo(288, 104, 252, 182); c.stroke();
            ptEll(c, 248, 20, 4, 5, '#4e342e'); ptEll(c, 248, 192, 4, 5, '#4e342e');
            ptTorso(c, '#558b2f', 46, 36);
            ptPoly(c, [[132, 118], [168, 118], [174, PT_H + 6], [126, PT_H + 6]], '#4e7a2a', 1.6); // jerkin front
            ptLine(c, '#4e342e', 6, [[114, 124], [180, 206]]);
            ptBelt(c, '#4e342e', 194, '#a1887f');
            ptArm(c, '#558b2f', [190, 126], [224, 112], [262, 104], 17, 13);
            ptEll(c, 264, 104, 8, 9, '#4e342e');
            ptPauldrons(c, '#33691e', 20, 14);
            ptPoly(c, [[122, 102], [178, 102], [190, 124], [150, 136], [110, 124]], '#388e3c'); // mantle
            ptHood(c, '#388e3c');
            ptEll(c, 150, 86, 14, 18, '#1b2a1b', 0);
            ptPoly(c, [[139, 96], [161, 96], [157, 106], [143, 106]], '#c99a73', 0); // chin in the light
            c.strokeStyle = '#e0e0e0'; c.lineWidth = 1.4; c.beginPath(); c.moveTo(250, 22); c.lineTo(...H); c.lineTo(250, 190); c.stroke(); // string
            ptLine(c, '#a1887f', 2.5, [[H[0] + 4, H[1]], [284, 101]]);
            ptPoly(c, [[282, 96], [297, 101], [282, 106]], '#b0bec5', 1.6);
            ptPoly(c, [[H[0] + 6, H[1] - 1], [H[0] + 20, H[1] - 7], [H[0] + 22, H[1] - 1]], '#e53935', 1.4);
            ptPoly(c, [[H[0] + 6, H[1] + 1], [H[0] + 20, H[1] + 7], [H[0] + 22, H[1] + 1]], '#f5f5f5', 1.4);
            ptArm(c, '#4f7f2a', [110, 126], [92, 102], H, 17, 13);
            ptEll(c, ...H, 8, 8, '#4e342e');
        },
        fx(c, t) { // one eye narrowed, aiming
            ptEyes(c, 84, '#dcedc8', '#aed581', 2.6, 1.3, 6);
        },
    },

    paladin: {
        color: '#ffd54f',
        bg(c, t) { // holy rays fanning from the raised mace
            c.save(); c.translate(190, 22);
            for (let i = 0; i < 14; i++) {
                const ang = i * Math.PI / 7 + t * 0.12, w = 0.07 + 0.03 * Math.sin(t + i);
                c.fillStyle = `rgba(255, 224, 130, ${0.05 + 0.04 * Math.sin(t * 1.3 + i * 2)})`;
                c.beginPath(); c.moveTo(0, 0); c.arc(0, 0, 340, ang - w, ang + w); c.closePath(); c.fill();
            }
            c.restore();
            for (let i = 0; i < 14; i++) { const y = PT_H - ((t * (8 + ptRand(i) * 10) + ptRand(i + 3) * 240) % 240); c.fillStyle = `rgba(255, 236, 179, ${0.15 + 0.35 * ptRand(i + 8)})`; c.fillRect(ptRand(i + 1) * PT_W, y, 2, 2); }
        },
        draw(c, t, a) {
            ptCape(c, '#eceff1', t, a, '#ffca28');
            const S0 = [242, 152], M = [190, 24], at = s => [S0[0] + (M[0] - S0[0]) * s, S0[1] + (M[1] - S0[1]) * s];
            ptLine(c, '#8d6e63', 8, [S0, M]);
            for (const s of [0.05, 0.6, 0.82]) { const q = at(s); ptEll(c, q[0], q[1], 6, 3, '#ffca28', 1.5, Math.atan2(M[1] - S0[1], M[0] - S0[0]) + Math.PI / 2); }
            c.save(); c.translate(...M); c.rotate(Math.atan2(M[1] - S0[1], M[0] - S0[0]) + Math.PI / 2); // Grand Mace head
            for (const s of [-1, 1]) ptPoly(c, [[s * 11, -15], [s * 24, -7], [s * 24, 8], [s * 11, 15]], '#ffca28');
            c.beginPath(); c.roundRect(-12, -19, 24, 38, 5); ptFill(c, '#cfd8dc');
            ptPoly(c, [[-4, -20], [0, -33], [4, -20]], '#ffca28');
            c.strokeStyle = '#ffca28'; c.lineWidth = 2; c.beginPath(); c.moveTo(0, -12); c.lineTo(0, 12); c.moveTo(-6, -4); c.lineTo(6, -4); c.stroke();
            c.restore();
            ptTorso(c, '#b0bec5', 50, 40);
            ptPoly(c, [[130, 118], [170, 118], [178, PT_H + 6], [122, PT_H + 6]], '#eceff1'); // tabard
            c.strokeStyle = '#ffca28'; c.lineWidth = 6; c.lineCap = 'butt'; c.beginPath(); c.moveTo(150, 128); c.lineTo(150, 192); c.moveTo(132, 148); c.lineTo(168, 148); c.stroke();
            ptBelt(c, '#795548', 198, '#ffca28');
            ptEll(c, 150, 108, 16, 8, '#90a4ae');
            ptArm(c, '#b0bec5', [110, 126], [142, 170], at(0.2), 19, 15);
            ptArm(c, '#b0bec5', [190, 126], [240, 108], at(0.44), 19, 15);
            ptEll(c, ...at(0.2), 9, 8, '#90a4ae'); ptEll(c, ...at(0.44), 9, 8, '#90a4ae');
            ptPauldrons(c, '#cfd8dc', 24, 16, '#ffca28');
            const sw = Math.sin(t * 2) * 3 * (0.4 + a); // plume streaming off the helm
            c.beginPath(); c.moveTo(146, 52); c.quadraticCurveTo(120, 24 + sw, 90, 38 + sw); c.quadraticCurveTo(116, 38, 156, 56); c.closePath(); ptFill(c, '#c62828');
            c.beginPath(); c.moveTo(128, 62); c.quadraticCurveTo(128, 50, 150, 49); c.quadraticCurveTo(172, 50, 172, 62); c.lineTo(171, 96); c.quadraticCurveTo(150, 107, 129, 96); c.closePath(); ptFill(c, '#cfd8dc'); // great helm
            ptPoly(c, [[129, 61], [171, 61], [171, 66], [129, 66]], '#ffca28', 1.4);
            c.fillStyle = '#263238'; c.fillRect(134, 76, 32, 5); c.fillRect(147.5, 70, 5, 26);
            c.fillStyle = 'rgba(255, 255, 255, 0.3)'; c.fillRect(134, 68, 8, 26);
        },
        fx(c, t, a) {
            const g = 0.18 + 0.08 * Math.sin(t * 2.5) + 0.08 * a;
            c.save(); c.globalCompositeOperation = 'lighter'; ptGlow(c, 190, 24, 50, '#ffd54f', g); c.restore();
            for (let i = 0; i < 4; i++) { const ang = t * 1.5 + i * Math.PI / 2; sprStar(c, 190 + Math.cos(ang) * 30, 24 + Math.sin(ang) * 18, 3, `rgba(255, 245, 200, ${0.5 + 0.5 * Math.sin(t * 3 + i)})`); }
        },
    },

    machinist: {
        color: '#ff9800',
        bg(c, t) { // workshop gears turning
            c.save(); c.fillStyle = 'rgba(255, 152, 0, 0.07)'; c.strokeStyle = 'rgba(255, 152, 0, 0.2)'; c.lineWidth = 2;
            ptGear(c, 62, 64, 58, 12, t * 0.25); c.fill('evenodd'); c.stroke();
            ptGear(c, 246, 150, 40, 9, -t * 0.25 * 58 / 40 + 0.2); c.fill('evenodd'); c.stroke();
            ptGear(c, 262, 44, 22, 7, t * 0.6); c.fill('evenodd'); c.stroke();
            c.restore();
        },
        draw(c, t, a) {
            for (const s of [-1, 1]) { ptPoly(c, [[150 + s * 30, 70], [150 + s * 42, 70], [150 + s * 42, 112], [150 + s * 30, 112]], '#37474f'); ptEll(c, 150 + s * 36, 70, 6, 2.5, '#111'); } // exhaust pipes
            ptPoly(c, [[112, 100], [188, 100], [188, 150], [112, 150]], '#546e7a'); // backpack
            ptTorso(c, '#ef6c00', 47, 37);
            c.strokeStyle = '#bf360c'; c.lineWidth = 2; c.beginPath(); c.moveTo(150, 116); c.lineTo(150, PT_H); c.stroke(); // zipper
            ptPoly(c, [[124, 132], [142, 132], [142, 148], [124, 148]], '#e65100', 1.6);
            ptBelt(c, '#4e342e', 192, '#9e9e9e');
            for (const x of [118, 172]) ptPoly(c, [[x - 6, 202], [x + 8, 202], [x + 8, 216], [x - 6, 216]], '#6d4c41', 1.6);
            ptEll(c, 150, 108, 12, 7, '#d09a72');
            ptArm(c, '#e65100', [190, 126], [214, 172], [186, 151], 18, 14);
            ptArm(c, '#e65100', [110, 126], [90, 164], [112, 142], 18, 14);
            c.save(); c.translate(226, 156); c.rotate(Math.atan2(-24, -190)); c.scale(1, -1); // scattergun: +x toward the muzzle
            ptPoly(c, [[0, -6], [30, -8], [34, 5], [0, 11]], '#6d4c41');
            ptPoly(c, [[30, -10], [80, -10], [80, 7], [30, 7]], '#607d8b');
            ptLine(c, '#455a64', 6, [[78, -6], [186, -6]]); ptLine(c, '#455a64', 6, [[78, 2], [186, 2]]);
            ptPoly(c, [[100, 5], [132, 5], [132, 13], [100, 13]], '#8d6e63');
            ptEll(c, 188, -2, 4, 9, '#37474f');
            c.strokeStyle = PT_LINE; c.lineWidth = 2; c.beginPath(); c.arc(52, 10, 5, 0, Math.PI); c.stroke();
            c.restore();
            ptEll(c, 186, 151, 8, 8, '#424242'); ptEll(c, 112, 142, 8, 8, '#424242');
            ptPauldrons(c, '#455a64', 20, 14);
            ptEll(c, 150, 80, 20, 23, '#5d4037'); // hair
            for (const [x, h] of [[140, 52], [150, 48], [160, 53]]) ptPoly(c, [[x - 6, 62], [x, h], [x + 6, 62]], '#5d4037');
            ptEll(c, 150, 87, 15, 16, PT_SKIN);
            c.fillStyle = '#212121'; c.fillRect(130, 76, 40, 7); // goggle strap
            for (const s of [-1, 1]) { ptEll(c, 150 + s * 9, 80, 8.5, 8.5, '#8d6e63'); ptEll(c, 150 + s * 9, 80, 5.5, 5.5, '#4dd0e1', 0); }
            ptPoly(c, [[133, 90], [167, 90], [165, 101], [150, 109], [135, 101]], '#455a64'); // bandana
        },
        fx(c, t, a) {
            for (const s of [-1, 1]) { c.fillStyle = `rgba(255, 255, 255, ${0.7 + 0.3 * Math.sin(t * 2)})`; c.fillRect(150 + s * 9 - 3, 77, 2, 2); }
            c.save(); c.globalCompositeOperation = 'lighter'; for (const s of [-1, 1]) ptGlow(c, 150 + s * 9, 80, 12, '#4dd0e1', 0.25 + 0.15 * Math.sin(t * 2.2)); c.restore();
            for (let i = 0; i < 6; i++) { // exhaust and muzzle smoke
                const age = (t * 0.45 + i / 6) % 1, s = i % 2 ? 1 : -1;
                c.fillStyle = `rgba(160, 150, 140, ${0.28 * (1 - age)})`; c.beginPath(); c.arc(150 + s * 36 + Math.sin(age * 5 + i) * 5, 66 - age * 50, 3 + age * 9, 0, 7); c.fill();
                c.fillStyle = `rgba(160, 150, 140, ${0.22 * (1 - age)})`; c.beginPath(); c.arc(34 - age * 10, 130 - age * 34 + Math.sin(age * 6 + i) * 3, 2 + age * 7, 0, 7); c.fill();
            }
        },
    },

    spellweaver: {
        color: '#4fc3f7',
        bg(c, t) {
            for (let i = 0; i < 40; i++) { // twinkling stars
                const tw = 0.25 + 0.75 * Math.abs(Math.sin(t * (0.4 + ptRand(i + 5)) + i));
                sprStar(c, ptRand(i) * PT_W, ptRand(i + 70) * PT_H * 0.8, 1 + ptRand(i + 2) * 2, `rgba(225, 245, 254, ${tw * 0.6})`);
            }
            c.save(); c.translate(150, 112); c.rotate(t * 0.1); c.strokeStyle = 'rgba(79, 195, 247, 0.18)'; c.lineWidth = 1.5; // arcane circle
            c.beginPath(); c.arc(0, 0, 96, 0, 7); c.stroke(); c.beginPath(); c.arc(0, 0, 84, 0, 7); c.stroke();
            for (let i = 0; i < 16; i++) { c.rotate(Math.PI / 8); c.strokeRect(-3, -92, 6, 5); }
            c.restore();
        },
        draw(c, t, a) {
            ptCape(c, '#1565c0', t, a, '#ffca28');
            ptLine(c, '#5d4037', 7, [[78, PT_H + 6], [80, 140], [82, 48]]); // staff
            for (const y of [60, 120]) ptEll(c, 81, y, 6, 3, '#ffca28', 1.5);
            ptPoly(c, [[72, 50], [70, 28], [78, 42], [82, 22], [86, 42], [94, 28], [92, 50]], '#c9a227');
            ptPoly(c, [[82, 12], [91, 30], [82, 46], [73, 30]], '#81d4fa');
            ptTorso(c, '#1e88e5', 46, 40);
            ptPoly(c, [[136, 118], [164, 118], [176, PT_H + 6], [124, PT_H + 6]], '#1565c0');
            c.strokeStyle = '#ffca28'; c.lineWidth = 2; c.beginPath(); c.moveTo(136, 120); c.lineTo(124, PT_H); c.moveTo(164, 120); c.lineTo(176, PT_H); c.stroke();
            ptBelt(c, '#0d47a1', 192, '#ffca28');
            ptArm(c, '#1e88e5', [110, 126], [86, 162], [80, 138], 21, 18);
            ptEll(c, 80, 138, 8, 8, PT_SKIN);
            ptArm(c, '#1e88e5', [190, 126], [228, 128], [240, 92], 21, 18);
            ptEll(c, 240, 90, 8, 8, PT_SKIN);
            ptPauldrons(c, '#1565c0', 21, 14, '#ffca28');
            ptPoly(c, [[124, 104], [176, 104], [182, 124], [150, 132], [118, 124]], '#1565c0'); // high collar
            sprStar(c, 150, 126, 5, '#ffeb3b');
            ptEll(c, 150, 86, 16, 19, PT_SKIN);
            ptEll(c, 150, 74, 18, 12, 'rgba(10, 20, 50, 0.55)', 0); // shadow under the brim
            const bob = Math.sin(t * 1.6) * 2 * (0.4 + a);
            ptEll(c, 150, 68, 50, 11, '#0d47a1');
            c.beginPath(); c.moveTo(125, 66); c.quadraticCurveTo(130, 30, 108 + bob, 4); c.quadraticCurveTo(142, 22, 175, 66); c.closePath(); ptFill(c, '#1565c0');
            ptPoly(c, [[126, 59], [174, 59], [175, 66], [125, 66]], '#ffca28', 1.6);
            sprStar(c, 142, 40, 4.5, '#ffeb3b'); sprStar(c, 127, 24, 3, '#ffeb3b'); sprStar(c, 158, 50, 2.5, '#ffeb3b');
        },
        fx(c, t, a) {
            ptEyes(c, 86, '#e1f5fe', '#4fc3f7', 2.6, 1.6, 7);
            const O = [242, 60], pulse = 0.5 + 0.5 * Math.sin(t * 3);
            c.save(); c.globalCompositeOperation = 'lighter';
            ptGlow(c, ...O, 40, '#4fc3f7', 0.35 + 0.2 * pulse); ptGlow(c, 82, 30, 18, '#81d4fa', 0.4);
            c.restore();
            c.strokeStyle = 'rgba(179, 229, 252, 0.85)'; c.lineWidth = 1.5;
            for (const [sp, tilt] of [[1.2, 0.5], [-0.9, -0.6]]) { c.beginPath(); c.ellipse(...O, 21, 7, tilt + Math.sin(t * sp) * 0.4, 0, Math.PI * 2); c.stroke(); }
            ptEll(c, ...O, 9 + pulse * 1.5, 9 + pulse * 1.5, '#e1f5fe', 0);
            for (let i = 0; i < 5; i++) { const ang = t * 2 + i * 1.256; c.fillStyle = '#b3e5fc'; c.fillRect(O[0] + Math.cos(ang) * 26 - 1, O[1] + Math.sin(ang) * 12 - 1, 2.5, 2.5); }
        },
    },

    cleric: {
        color: '#fbc02d',
        bg(c, t) { // gold and violet light for the Holy/Shadow duality, with the halo behind the head
            let g = c.createRadialGradient(70, 60, 0, 70, 60, 170); g.addColorStop(0, 'rgba(255, 213, 79, 0.22)'); g.addColorStop(1, 'rgba(255, 213, 79, 0)'); c.fillStyle = g; c.fillRect(0, 0, PT_W, PT_H);
            g = c.createRadialGradient(240, 150, 0, 240, 150, 150); g.addColorStop(0, 'rgba(171, 71, 188, 0.2)'); g.addColorStop(1, 'rgba(171, 71, 188, 0)'); c.fillStyle = g; c.fillRect(0, 0, PT_W, PT_H);
            const r = 34 + Math.sin(t * 2) * 1.5;
            c.save(); c.shadowBlur = 16; c.shadowColor = '#ffeb3b'; c.strokeStyle = 'rgba(255, 235, 59, 0.9)'; c.lineWidth = 4;
            c.beginPath(); c.arc(150, 62, r, 0, 7); c.stroke(); c.restore();
            for (let i = 0; i < 12; i++) { const ang = i * Math.PI / 6 + t * 0.2; c.fillStyle = 'rgba(255, 241, 118, 0.6)'; c.fillRect(150 + Math.cos(ang) * (r + 8) - 1, 62 + Math.sin(ang) * (r + 8) - 1, 2, 2); }
        },
        draw(c, t, a) {
            ptCape(c, '#fff8e1', t, a, '#fbc02d');
            ptTorso(c, '#fffde7', 46, 40);
            for (const s of [-1, 1]) { // stole
                ptPoly(c, [[150 + s * 12, 112], [150 + s * 24, 112], [150 + s * 28, PT_H + 6], [150 + s * 14, PT_H + 6]], '#fbc02d', 1.8);
                c.strokeStyle = '#fffde7'; c.lineWidth = 2; c.beginPath(); c.moveTo(150 + s * 19, 160); c.lineTo(150 + s * 21, 176); c.moveTo(150 + s * 14, 168); c.lineTo(150 + s * 26, 168); c.stroke();
            }
            ptLine(c, '#c9a227', 4, [[112, 200], [150, 206], [188, 200]]);
            const sw = Math.sin(t * 1.7) * (0.18 + 0.25 * a), pv = [248, 108], C = [pv[0] + Math.sin(sw) * 62, pv[1] + Math.cos(sw) * 62];
            ptArm(c, '#fffde7', [190, 126], [226, 142], [246, 112], 21, 18);
            c.strokeStyle = '#c9a227'; c.lineWidth = 2; c.setLineDash([3, 2]); c.beginPath(); c.moveTo(...pv); c.lineTo(C[0], C[1] - 10); c.stroke(); c.setLineDash([]);
            ptEll(c, 247, 110, 8, 8, PT_SKIN);
            ptEll(c, C[0], C[1], 12, 11, '#ffb300'); // censer
            c.beginPath(); c.arc(C[0], C[1] - 4, 10, Math.PI, 0); ptFill(c, '#ffca28');
            ptEll(c, C[0], C[1] - 15, 3, 3, '#ffb300', 1.5);
            ptArm(c, '#fffde7', [110, 126], [82, 120], [78, 86], 21, 18);
            ptEll(c, 78, 82, 8, 9, PT_SKIN);
            ptPauldrons(c, '#ffe082', 20, 13);
            ptPoly(c, [[126, 104], [174, 104], [180, 120], [150, 128], [120, 120]], '#fbc02d');
            ptEll(c, 150, 88, 17, 20, PT_SKIN);
            c.strokeStyle = '#6d4c41'; c.lineWidth = 1.6; c.beginPath(); // serene closed eyes
            for (const s of [-1, 1]) { c.moveTo(150 + s * 11, 88); c.quadraticCurveTo(150 + s * 7, 91, 150 + s * 3, 88); }
            c.stroke();
            c.beginPath(); c.moveTo(132, 74); c.lineTo(134, 42); c.quadraticCurveTo(150, 14, 166, 42); c.lineTo(168, 74); c.closePath(); ptFill(c, '#fafafa'); // mitre
            ptPoly(c, [[132, 67], [168, 67], [168, 75], [132, 75]], '#fbc02d', 1.6);
            c.strokeStyle = '#fbc02d'; c.lineWidth = 3; c.beginPath(); c.moveTo(150, 30); c.lineTo(150, 64); c.moveTo(141, 44); c.lineTo(159, 44); c.stroke();
        },
        fx(c, t, a) {
            const sw = Math.sin(t * 1.7) * (0.18 + 0.25 * a), C = [248 + Math.sin(sw) * 62, 108 + Math.cos(sw) * 62];
            for (let i = 0; i < 8; i++) { // incense smoke, gold and violet
                const age = (t * 0.55 + i / 8) % 1;
                c.fillStyle = i % 2 ? `rgba(206, 147, 216, ${0.35 * (1 - age)})` : `rgba(255, 224, 130, ${0.35 * (1 - age)})`;
                c.beginPath(); c.arc(C[0] + Math.sin(age * 6 + i) * 7, C[1] - 12 - age * 60, 3 + age * 8, 0, 7); c.fill();
            }
            c.save(); c.globalCompositeOperation = 'lighter'; ptGlow(c, C[0], C[1], 18, '#ffb300', 0.35); ptGlow(c, 78, 76, 34, '#fff59d', 0.28 + 0.1 * Math.sin(t * 2.5)); c.restore();
            for (let i = 0; i < 3; i++) { const ang = t * 1.2 + i * 2.1; sprStar(c, 78 + Math.cos(ang) * 18, 70 + Math.sin(ang) * 12, 2.5, 'rgba(255, 253, 231, 0.9)'); }
        },
    },

    nightblade: {
        color: '#9c27b0',
        bg(c, t) {
            for (let i = 0; i < 7; i++) { // drifting smoke
                const x = ((t * (6 + i * 2) + ptRand(i) * 400) % 400) - 50, y = 40 + ptRand(i + 4) * 170;
                ptGlow(c, x, y, 40 + ptRand(i + 8) * 30, '#4a148c', 0.35);
            }
            c.save(); c.translate(248, 58); c.rotate(t * 0.6); // a weak point mark, waiting
            const p = 0.5 + 0.5 * Math.sin(t * 2.5);
            c.strokeStyle = `rgba(234, 128, 252, ${0.35 + 0.35 * p})`; c.lineWidth = 2;
            c.strokeRect(-9, -9, 18, 18); c.rotate(-t * 1.2); c.beginPath(); c.arc(0, 0, 17 + p * 3, 0, 7); c.stroke();
            for (let i = 0; i < 4; i++) { c.rotate(Math.PI / 2); c.beginPath(); c.moveTo(0, -24); c.lineTo(0, -30); c.stroke(); }
            c.restore();
        },
        draw(c, t, a) {
            const w = Math.sin(t * 2.2) * (3 + 4 * a);
            ptRibbon(c, '#7b1fa2', 17, [162, 104], [196, 88 + w], [232, 112 - w], [272, 86 + w * 1.5]);
            ptRibbon(c, '#9c27b0', 16, [160, 112], [200, 116 - w], [236, 136 + w], [266, 124 - w * 1.5]);
            ptTorso(c, '#263238', 44, 36);
            ptLine(c, '#4a148c', 4, [[118, 126], [184, 196]]); ptLine(c, '#4a148c', 4, [[182, 126], [116, 196]]);
            ptBelt(c, '#37474f', 194, '#7b1fa2');
            const A = [176, 150], B = [124, 150];
            ptBlade(c, [A[0] + 7, A[1] - 5], [248, 80], 6.5, '#cfd8dc'); ptBlade(c, [B[0] - 7, B[1] - 5], [52, 80], 6.5, '#cfd8dc');
            ptLine(c, '#212121', 4, [[A[0] + 2, A[1] - 12], [A[0] + 12, A[1] + 2]]); ptLine(c, '#212121', 4, [[B[0] - 2, B[1] - 12], [B[0] - 12, B[1] + 2]]);
            ptArm(c, '#37474f', [110, 126], [118, 178], A, 16, 13);
            ptEll(c, ...A, 7.5, 7.5, '#212121');
            ptArm(c, '#37474f', [190, 126], [182, 178], B, 16, 13);
            ptEll(c, ...B, 7.5, 7.5, '#212121');
            ptPauldrons(c, '#4a148c', 18, 12);
            ptHood(c, '#38006b', 38);
            ptEll(c, 150, 86, 14, 17, '#0a0a0a', 0);
            ptPoly(c, [[134, 93], [166, 93], [164, 104], [150, 112], [136, 104]], '#4a148c', 1.6); // mask
        },
        fx(c, t) {
            const blink = (t % 4.5) < 0.12 ? 0.25 : 1;
            ptEyes(c, 84, '#f3e5f5', '#e040fb', 3.4, 1.6 * blink, 7);
            const g = (t * 0.5) % 1; // a glint running along the blades
            if (g < 0.4) for (const [b, e] of [[[183, 145], [248, 80]], [[117, 145], [52, 80]]]) {
                const k = 0.45 + 0.55 * g / 0.4; // only along the part of the blade clear of the arms sprStar(c, b[0] + (e[0] - b[0]) * k, b[1] + (e[1] - b[1]) * k, 4, 'rgba(255, 255, 255, 0.9)');
            }
        },
    },

    druid: {
        color: '#4caf50',
        bg(c, t) { // the spirit of Wild Form watching from behind
            c.save(); c.fillStyle = 'rgba(139, 195, 74, 0.07)'; c.strokeStyle = 'rgba(156, 204, 101, 0.22)'; c.lineWidth = 2;
            c.beginPath(); c.moveTo(150, 176); c.lineTo(108, 146); c.lineTo(66, 104); c.lineTo(72, 58); c.lineTo(62, 2); c.lineTo(112, 36); c.quadraticCurveTo(150, 24, 188, 36);
            c.lineTo(238, 2); c.lineTo(228, 58); c.lineTo(234, 104); c.lineTo(192, 146); c.closePath(); c.fill(); c.stroke();
            const p = 0.3 + 0.25 * Math.sin(t * 1.4);
            c.shadowBlur = 10; c.shadowColor = '#aeea00'; c.fillStyle = `rgba(198, 255, 0, ${p})`;
            for (const s of [-1, 1]) { c.beginPath(); c.ellipse(150 + s * 44, 80, 9, 4, s * 0.35, 0, 7); c.fill(); }
            c.restore();
            ptFallingLeaves(c, t, 8, ['#7cb342', '#9ccc65'], 0.35);
        },
        draw(c, t, a) {
            ptCape(c, '#33691e', t, a);
            ptLine(c, '#5d4037', 8, [[70, PT_H + 6], [76, 180], [70, 130], [78, 80], [74, 46]]); // gnarled totem
            ptEll(c, 74, 40, 12, 12, '#6d4c41'); ptEll(c, 74, 40, 6, 6, '#aeea00', 0);
            for (const [ang, col] of [[-2.2, '#7cb342'], [-0.9, '#9ccc65'], [-1.6, '#8bc34a']]) { c.save(); c.translate(74, 32); c.scale(2, 2); sprLeaf(c, 0, 0, ang, 8, col); c.restore(); }
            ptLine(c, '#d7ccc8', 2, [[80, 56], [86, 74]]); ptEll(c, 86, 77, 3, 4, '#efebe9', 1.4);
            ptTorso(c, '#6d4c41', 48, 38);
            ptPoly(c, [[134, 116], [166, 116], [172, PT_H + 6], [128, PT_H + 6]], '#5d4037', 1.6);
            ptBelt(c, '#3e2723', 194, '#8bc34a');
            ptArm(c, '#6d4c41', [110, 126], [84, 160], [74, 134], 19, 15);
            ptEll(c, 74, 134, 8, 8, '#4e342e');
            ptArm(c, '#6d4c41', [190, 126], [228, 142], [240, 110], 19, 15);
            ptEll(c, 240, 108, 8, 8, '#4e342e');
            for (const s of [-1, 1]) for (const [dx, dy, ang, col] of [[-8, -4, -2.2, '#7cb342'], [4, -8, -1.4, '#8bc34a'], [10, 0, -0.6, '#689f38']]) { // leaf pauldrons
                c.save(); c.translate(150 + s * (42 + dx), 120 + dy); c.scale(s * 2.4, 2.4); sprLeaf(c, 0, 0, ang, 9, col); c.restore();
            }
            for (const s of [-1, 1]) { // antlers
                const x = v => 150 + s * v;
                ptLine(c, '#d7ccc8', 5, [[x(12), 64], [x(26), 44], [x(40), 26], [x(52), 8]]);
                ptLine(c, '#d7ccc8', 4, [[x(26), 44], [x(44), 46]]); ptLine(c, '#d7ccc8', 4, [[x(34), 34], [x(28), 14]]); ptLine(c, '#d7ccc8', 3.5, [[x(44), 20], [x(60), 24]]);
            }
            ptPoly(c, [[124, 104], [176, 104], [184, 122], [150, 130], [116, 122]], '#558b2f');
            ptEll(c, 150, 84, 17, 21, '#4e342e');
            for (const ang of [-2.6, -2.1, -1.57, -1.05, -0.55]) { c.save(); c.translate(150 + Math.cos(ang) * 16, 82 + Math.sin(ang) * 18); c.scale(1.6, 1.6); sprLeaf(c, 0, 0, ang, 6, '#9ccc65'); c.restore(); }
        },
        fx(c, t) {
            ptEyes(c, 86, '#f0f4c3', '#aeea00', 3, 1.7, 7);
            c.save(); c.globalCompositeOperation = 'lighter'; ptGlow(c, 74, 40, 18, '#aeea00', 0.4); ptGlow(c, 240, 100, 26, '#cddc39', 0.3); c.restore();
            for (let i = 0; i < 8; i++) { // spores drifting up from the palm
                const age = (t * 0.32 + i / 8) % 1, x = 240 + Math.sin(age * 5 + i * 2) * 16 * age, y = 100 - age * 96, r = 2.5 + ptRand(i) * 2.5;
                c.save(); c.shadowBlur = 8; c.shadowColor = '#cddc39'; c.fillStyle = `rgba(220, 231, 117, ${0.9 * (1 - age)})`;
                c.beginPath(); c.arc(x, y, r, 0, 7); c.fill(); c.restore();
            }
        },
    },

    swordsaint: {
        color: '#00bcd4',
        bg(c, t) {
            for (let i = 0; i < 4; i++) { // faint slash arcs drifting past
                const x = ((t * 14 + i * 110) % 420) - 60, y = 30 + i * 50;
                c.strokeStyle = `rgba(128, 222, 234, ${0.12 + 0.06 * Math.sin(t + i)})`; c.lineWidth = 2;
                c.beginPath(); c.arc(x, y + 60, 70, -1.9, -1.1); c.stroke();
            }
            for (let i = 0; i < 12; i++) { // drifting petals
                const x = ((t * (12 + ptRand(i) * 10) + ptRand(i + 3) * 340) % 340) - 20, y = ptRand(i + 6) * PT_H + Math.sin(t + i) * 10;
                c.fillStyle = 'rgba(224, 247, 250, 0.35)'; c.beginPath(); c.ellipse(x, y, 3, 1.6, t + i, 0, 7); c.fill();
            }
            const bob = Math.sin(t * 1.6) * 5, tilt = Math.sin(t * 0.9) * 0.08; // the Airborne Blade, hovering
            c.save(); c.translate(250, 96 + bob); c.rotate(0.12 + tilt);
            c.shadowBlur = 16; c.shadowColor = '#00e5ff';
            ptPoly(c, [[-4, -50], [4, -50], [3, 62], [0, 72], [-3, 62]], 'rgba(178, 235, 242, 0.92)', 1.8);
            c.shadowBlur = 0;
            ptEll(c, 0, -52, 11, 3.5, '#ffd54f', 1.6);
            ptLine(c, '#263238', 6, [[0, -56], [0, -84]]);
            c.strokeStyle = '#00acc1'; c.lineWidth = 1.5; c.beginPath(); for (let y = -80; y < -58; y += 6) { c.moveTo(-3, y); c.lineTo(3, y + 4); } c.stroke();
            c.restore();
        },
        draw(c, t, a) {
            const w = Math.sin(t * 2.4) * (3 + 4 * a);
            ptRibbon(c, '#e53935', 13, [142, 72], [114, 56 + w], [92, 84 - w], [58, 70 + w * 1.5]); ptRibbon(c, '#ff5252', 12, [142, 80], [116, 88 - w], [96, 100 + w], [66, 104 - w * 1.5]); // headband ribbons
            ptCape(c, '#00838f', t, a, '#e0f7fa');
            ptTorso(c, '#00acc1', 46, 38);
            for (const s of [-1, 1]) ptPoly(c, [[150 + s * 20, 112], [150 + s * 6, 112], [150 + s * 2, 160], [150 + s * 10, 164]], '#e0f7fa', 1.8); // collar
            ptPoly(c, [[110, 188], [190, 188], [191, 204], [109, 204]], '#eceff1');
            ptLine(c, '#263238', 9, [[220, 216], [128, 180]]); // saya
            c.strokeStyle = '#00e5ff'; c.lineWidth = 2; c.beginPath(); c.moveTo(136, 180); c.lineTo(134, 187); c.moveTo(210, 209); c.lineTo(208, 216); c.stroke();
            ptBlade(c, [100, 170], [130, 181], 3.5, '#e0f7fa'); // a hand's width of blade, half drawn
            ptEll(c, 100, 170, 3.5, 10, '#ffd54f', 1.8, -0.35);
            ptLine(c, '#37474f', 7, [[97, 169], [68, 158]]);
            ptArm(c, '#00acc1', [190, 126], [200, 174], [136, 184], 20, 16);
            ptEll(c, 136, 184, 8, 7.5, PT_SKIN);
            ptArm(c, '#00acc1', [110, 126], [78, 146], [80, 162], 20, 16);
            ptEll(c, 80, 162, 8, 8, PT_SKIN);
            ptEll(c, 192, 120, 18, 13, '#00838f', 2.4, 0.25); // single shoulder guard
            ptEll(c, 150, 90, 16, 19, PT_SKIN);
            ptEll(c, 150, 82, 18, 9, 'rgba(0, 30, 40, 0.5)', 0); // kasa shadow
            const g = c.createRadialGradient(150, 50, 4, 150, 64, 70); g.addColorStop(0, '#efebe9'); g.addColorStop(1, '#bcaaa4');
            c.beginPath(); c.moveTo(78, 76); c.quadraticCurveTo(150, 24, 222, 76); c.quadraticCurveTo(150, 86, 78, 76); c.closePath(); ptFill(c, g); // kasa
            c.strokeStyle = '#a1887f'; c.lineWidth = 1; c.beginPath();
            for (let i = 1; i < 12; i++) { const x = 78 + i * 12; c.moveTo(150, 48); c.lineTo(x, 76 + Math.sin(i / 12 * Math.PI) * 5); }
            c.stroke();
        },
        fx(c, t) {
            ptEyes(c, 92, '#e0f7fa', '#00e5ff', 3, 1.2, 7);
            const g = (t * 0.6) % 1;
            if (g < 0.35) sprStar(c, 102 + 26 * g / 0.35, 171 + 10 * g / 0.35, 4, 'rgba(255, 255, 255, 0.95)');
        },
    },
};

// ---------- rendering ----------

// Paint one portrait onto `cv`. t is the clock, a (0..1) how much life the highlighted card gets.
function drawPortrait(cv, id, t, a) {
    const P = PORTRAITS[id]; if (!P) return;
    const c = cv.getContext('2d'), k = cv.width / PT_W;
    c.setTransform(k, 0, 0, k, 0, 0); c.lineJoin = 'round';
    let g = c.createLinearGradient(0, 0, 0, PT_H); g.addColorStop(0, sprShade(P.color, -0.8)); g.addColorStop(1, '#201c18');
    c.fillStyle = g; c.fillRect(0, 0, PT_W, PT_H);
    ptGlow(c, 150, 110, 160, P.color, 0.28);
    P.bg(c, t, a);

    // The hero goes on its own layer so the top-left light tints it as one image
    if (ptLayer.width !== cv.width || ptLayer.height !== cv.height) { ptLayer.width = cv.width; ptLayer.height = cv.height; }
    const L = ptLayerCtx, breathe = 1 + Math.sin(t * 2.2) * 0.008;
    const body = ctx2 => { ctx2.setTransform(k, 0, 0, k, 0, 0); ctx2.translate(150, PT_H); ctx2.scale(1, breathe); ctx2.translate(-150, -PT_H); ctx2.lineJoin = 'round'; };
    L.setTransform(1, 0, 0, 1, 0, 0); L.clearRect(0, 0, ptLayer.width, ptLayer.height);
    body(L); P.draw(L, t, a);
    L.setTransform(1, 0, 0, 1, 0, 0); L.globalCompositeOperation = 'source-atop';
    g = L.createLinearGradient(0, 0, ptLayer.width, ptLayer.height);
    g.addColorStop(0, 'rgba(255, 244, 220, 0.2)'); g.addColorStop(0.45, 'rgba(255, 255, 255, 0)'); g.addColorStop(1, 'rgba(0, 0, 20, 0.38)');
    L.fillStyle = g; L.fillRect(0, 0, ptLayer.width, ptLayer.height);
    L.globalCompositeOperation = 'source-over';
    c.setTransform(1, 0, 0, 1, 0, 0); c.drawImage(ptLayer, 0, 0);

    c.save(); body(c); if (P.fx) P.fx(c, t, a); c.restore();
    c.setTransform(k, 0, 0, k, 0, 0); // melt the waist into the card
    g = c.createLinearGradient(0, PT_H - 70, 0, PT_H); g.addColorStop(0, 'rgba(32, 28, 24, 0)'); g.addColorStop(1, 'rgba(32, 28, 24, 1)');
    c.fillStyle = g; c.fillRect(0, PT_H - 70, PT_W, 70);
}

// Each carousel card has a <canvas class="class-portrait" data-class="...">.
// The highlighted one animates; side cards hold still on the frame they had.
function startPortraits() {
    const dpr = window.devicePixelRatio || 1;
    const list = [...document.querySelectorAll('canvas.class-portrait')].map((cv, i) => {
        cv.width = Math.round(306 * dpr); cv.height = Math.round(306 * PT_H / PT_W * dpr);
        return { cv, id: cv.dataset.class, card: cv.closest('.class-card'), t: i * 3.1, a: 0, painted: false };
    });
    let last = performance.now();
    function frame(now) {
        if (gameState !== STATE.MENU) return; // a run has started; stop animating the menu
        const dt = Math.min(0.1, (now - last) / 1000); last = now;
        if (!el('class-selection').classList.contains('hidden')) {
            for (const pv of list) {
                if (!pv.card.classList.contains('visible')) continue;
                const active = pv.card.classList.contains('active');
                if (!active && pv.painted && pv.a === 0) continue;
                pv.a = active ? Math.min(1, pv.a + dt * 2.5) : 0;
                if (active) pv.t += dt;
                drawPortrait(pv.cv, pv.id, pv.t, pv.a);
                pv.painted = true;
            }
        }
        requestAnimationFrame(frame);
    }
    requestAnimationFrame(frame);
}
startPortraits();
