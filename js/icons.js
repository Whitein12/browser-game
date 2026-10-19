// ==========================================
// icons.js - Skill and item icons, drawn in code
// ==========================================
// Every icon paints in a 64x64 box and is cached as a data URL, so HTML can use it as <img src>.
// skillIcon(classId, slot) covers slots 1-4 and 'rmb'; itemIcon(item) picks a glyph by item type (weapons by class weapon).

const IC = 64, IC_PX = 128, IC_LINE = 'rgba(10, 8, 14, 0.95)';
const iconCache = {};

function icFill(c, fill, lw = 2) { c.fillStyle = fill; c.fill(); if (lw) { c.strokeStyle = IC_LINE; c.lineWidth = lw; c.lineJoin = 'round'; c.stroke(); } }
function icPoly(c, pts, fill, lw) { c.beginPath(); pts.forEach(([x, y], i) => i ? c.lineTo(x, y) : c.moveTo(x, y)); c.closePath(); icFill(c, fill, lw); }
function icEll(c, x, y, rx, ry, fill, lw, rot = 0) { c.beginPath(); c.ellipse(x, y, rx, ry, rot, 0, Math.PI * 2); icFill(c, fill, lw); }
function icLine(c, color, w, pts, outline = true) {
    const path = () => { c.beginPath(); pts.forEach(([x, y], i) => i ? c.lineTo(x, y) : c.moveTo(x, y)); };
    c.lineCap = 'round'; c.lineJoin = 'round';
    if (outline) { path(); c.strokeStyle = IC_LINE; c.lineWidth = w + 3; c.stroke(); }
    path(); c.strokeStyle = color; c.lineWidth = w; c.stroke();
}
function icArc(c, color, w, x, y, r, a0, a1, outline = true) {
    c.lineCap = 'round';
    if (outline) { c.beginPath(); c.arc(x, y, r, a0, a1); c.strokeStyle = IC_LINE; c.lineWidth = w + 3; c.stroke(); }
    c.beginPath(); c.arc(x, y, r, a0, a1); c.strokeStyle = color; c.lineWidth = w; c.stroke();
}
function icGlow(c, x, y, r, color, a = 0.6) { ptGlow(c, x, y, r, color, a); }
function icStar(c, x, y, r, color) { sprStar(c, x, y, r, color); }
function icArrowHead(c, x, y, ang, s, fill) {
    c.save(); c.translate(x, y); c.rotate(ang); icPoly(c, [[s, 0], [-s * 0.7, -s * 0.7], [-s * 0.3, 0], [-s * 0.7, s * 0.7]], fill); c.restore();
}
// Straight blade (sword/dagger) from hilt end to tip
function icSword(c, x0, y0, x1, y1, w, blade = '#e0e6ea', hilt = '#5d4037', guard = '#ffca28') {
    const dx = x1 - x0, dy = y1 - y0, L = Math.hypot(dx, dy), ux = dx / L, uy = dy / L, nx = -uy, ny = ux;
    const p = (s, o) => [x0 + ux * s + nx * o, y0 + uy * s + ny * o], g = L * 0.28;
    icLine(c, hilt, w * 0.9, [p(0, 0), p(g, 0)]);
    icPoly(c, [p(g, -w), p(L - w * 1.8, -w * 0.8), p(L, 0), p(L - w * 1.8, w * 0.8), p(g, w)], blade);
    c.strokeStyle = 'rgba(255, 255, 255, 0.7)'; c.lineWidth = 1; c.beginPath(); c.moveTo(...p(g + 2, -w * 0.45)); c.lineTo(...p(L - w * 2, -w * 0.4)); c.stroke();
    icLine(c, guard, w * 0.7, [p(g, -w * 2.1), p(g, w * 2.1)]);
    icEll(c, ...p(-1, 0), w * 0.75, w * 0.75, guard, 1.5);
}
function icArrow(c, x0, y0, x1, y1, shaft = '#a1887f', head = '#cfd8dc', fletch = '#f5f5f5') {
    const ang = Math.atan2(y1 - y0, x1 - x0);
    icLine(c, shaft, 2.5, [[x0, y0], [x1, y1]]);
    icArrowHead(c, x1, y1, ang, 6, head);
    c.save(); c.translate(x0, y0); c.rotate(ang);
    icPoly(c, [[0, 0], [8, -1], [3, -5]], fletch, 1.2); icPoly(c, [[0, 0], [8, 1], [3, 5]], fletch, 1.2);
    c.restore();
}
function icFlame(c, x, y, w, h, outer = '#ff7043', inner = '#ffd54f') { // flame pointing up from (x, y)
    c.beginPath(); c.moveTo(x - w, y); c.quadraticCurveTo(x - w * 1.1, y - h * 0.5, x - w * 0.2, y - h * 0.65); c.quadraticCurveTo(x - w * 0.3, y - h * 0.9, x, y - h);
    c.quadraticCurveTo(x + w * 0.2, y - h * 0.7, x + w * 0.5, y - h * 0.8); c.quadraticCurveTo(x + w * 1.2, y - h * 0.45, x + w, y); c.closePath(); icFill(c, outer);
    c.beginPath(); c.moveTo(x - w * 0.5, y); c.quadraticCurveTo(x - w * 0.5, y - h * 0.4, x, y - h * 0.62); c.quadraticCurveTo(x + w * 0.6, y - h * 0.35, x + w * 0.5, y); c.closePath(); icFill(c, inner, 0);
}
function icShieldPath(c, x, y, w, h) { c.beginPath(); c.moveTo(x - w, y - h * 0.55); c.quadraticCurveTo(x, y - h * 0.75, x + w, y - h * 0.55); c.quadraticCurveTo(x + w, y + h * 0.15, x, y + h * 0.6); c.quadraticCurveTo(x - w, y + h * 0.15, x - w, y - h * 0.55); c.closePath(); }
function icBolt(c, x, y, s, fill = '#ffeb3b') { icPoly(c, [[x + 4 * s, y - 14 * s], [x - 6 * s, y + 1 * s], [x, y + 1 * s], [x - 4 * s, y + 14 * s], [x + 7 * s, y - 3 * s], [x + 1 * s, y - 3 * s]], fill, 1.8); }
// A front-facing wolf head centred on (x, y); `tint` paints a spirit wolf
function icWolfHead(c, x, y, s, tint) {
    c.save(); c.translate(x - 32 * s, y - 32 * s); c.scale(s, s);
    c.beginPath(); c.moveTo(32, 58); c.lineTo(18, 44); c.lineTo(8, 26); c.lineTo(10, 6); c.lineTo(22, 18); c.quadraticCurveTo(32, 14, 42, 18); c.lineTo(54, 6); c.lineTo(56, 26); c.lineTo(46, 44); c.closePath(); icFill(c, tint || '#5d6b4a', 2.2);
    icPoly(c, [[24, 40], [40, 40], [32, 58]], tint ? '#ccff90' : '#8d9c74', 1.6);
    icGlow(c, 22, 30, 7, '#aeea00', 0.9); icGlow(c, 42, 30, 7, '#aeea00', 0.9);
    icEll(c, 22, 30, 4, 2.2, '#f0f4c3', 0, 0.35); icEll(c, 42, 30, 4, 2.2, '#f0f4c3', 0, -0.35);
    icEll(c, 32, 52, 3.5, 2.5, '#212121', 0);
    c.restore();
}
// A front-facing black jaguar head centred on (x, y): round, small ears, broad muzzle, gold eyes
function icJaguarHead(c, x, y, s, tint) {
    c.save(); c.translate(x - 32 * s, y - 32 * s); c.scale(s, s);
    for (const ex of [14, 50]) { icEll(c, ex, 16, 7, 7, tint || '#1f1e26', 2); icEll(c, ex, 17, 3.2, 3.2, tint ? '#ccff90' : '#4a3a3e', 0); }
    icEll(c, 32, 33, 21, 19, tint || '#1f1e26', 2.2);
    if (!tint) { c.strokeStyle = 'rgba(90, 88, 108, 0.7)'; c.lineWidth = 1.3; for (const [rx, ry] of [[24, 20], [32, 17], [40, 20], [19, 28], [45, 28]]) { c.beginPath(); c.arc(rx, ry, 2.4, 0.4, Math.PI * 1.7); c.stroke(); } }
    icEll(c, 32, 45, 10, 7.5, tint ? '#ccff90' : '#2d2c36', 1.6);
    icPoly(c, [[28, 40], [36, 40], [32, 45]], '#3a2c30', 1.2);
    for (const s2 of [-1, 1]) { icGlow(c, 32 + s2 * 9, 31, 7, '#ffb300', 0.9); icEll(c, 32 + s2 * 9, 31, 4.2, 2.4, '#ffd54f', 0, -s2 * 0.3); icEll(c, 32 + s2 * 9, 31, 0.9, 2.1, '#111', 0); }
    c.restore();
}
function icBeastHead(c, x, y, s, tint) { (player.companion === 'jaguar' ? icJaguarHead : icWolfHead)(c, x, y, s, tint); } // druid.js companion
// A paw print (pad and four toes) centred on (x, y)
function icPaw(c, x, y, s, fill) {
    icEll(c, x, y + 3 * s, 7 * s, 6 * s, fill, 1.5);
    for (const [dx, dy] of [[-8, -5], [-3, -10], [3, -10], [8, -5]]) icEll(c, x + dx * s, y + dy * s, 2.8 * s, 3.4 * s, fill, 1.2);
}
// A white-wrapped fist from above, knuckles toward `rot`; `wrap` tints the cloth (gold studs on a rare)
function icFist(c, x, y, s, rot, wrap = '#eceff1', line = '#b0bec5') {
    c.save(); c.translate(x, y); c.rotate(rot);
    c.beginPath(); c.roundRect(-s, -s * 0.85, s * 2, s * 1.7, s * 0.6); icFill(c, wrap, 2);
    c.strokeStyle = line; c.lineWidth = Math.max(1, s * 0.12); c.beginPath();
    for (const o of [-0.42, 0, 0.42]) { c.moveTo(s * 0.45, o * s); c.lineTo(s * 0.95, o * s); } // the knuckles
    c.moveTo(-s * 0.35, -s * 0.8); c.lineTo(-s * 0.35, s * 0.8); c.stroke(); // a band of the wrap
    icEll(c, s * 0.05, -s * 0.88, s * 0.5, s * 0.28, wrap, 1.4); // the thumb over the fingers
    c.restore();
}
// A palm print: palm, four fingers and the thumb, fingers toward `rot`
function icPalm(c, x, y, s, rot, fill) {
    c.save(); c.translate(x, y); c.rotate(rot); c.beginPath();
    c.ellipse(-2 * s, 0, 9 * s, 8 * s, 0, 0, Math.PI * 2);
    for (const [fx, fy, l] of [[9, -5.4, 7], [11, -1.8, 8.5], [11, 1.8, 8.5], [9, 5.4, 6.5]]) { c.moveTo((fx + l) * s, fy * s); c.ellipse((fx + l / 2) * s, fy * s, l / 2 * s, 1.7 * s, 0, 0, Math.PI * 2); }
    c.moveTo(6 * s, -10 * s); c.ellipse(1 * s, -10 * s, 5 * s, 2 * s, -0.7, 0, Math.PI * 2);
    icFill(c, fill, 1.8); c.restore();
}
function icSpeed(c, pts, color = 'rgba(255, 255, 255, 0.6)') { c.strokeStyle = color; c.lineWidth = 2; c.lineCap = 'round'; c.beginPath(); for (const [x, y, l] of pts) { c.moveTo(x, y); c.lineTo(x + l, y); } c.stroke(); }

// ---------- skill glyphs: SKILL_GLYPHS[classId][slot](c) ----------

const SKILL_GLYPHS = {
    dragonknight: {
        1(c) { // Shield Throw
            icSpeed(c, [[6, 22, 12], [4, 32, 14], [8, 42, 10]]);
            c.save(); c.translate(38, 32); c.rotate(-0.35); icShieldPath(c, 0, 0, 16, 36); icFill(c, '#c62828', 2.2);
            c.strokeStyle = '#cfd8dc'; c.lineWidth = 3; icShieldPath(c, 0, 0, 13, 30); c.stroke();
            icPoly(c, [[0, -12], [5, -2], [0, 10], [-5, -2]], '#ffca28', 1.5); c.restore();
        },
        2(c) { // Dragonfire Blade: a greatsword wreathed in flame
            c.save(); c.translate(32, 34); c.rotate(Math.PI / 4); // the flame runs along the blade, up and to the right
            icFlame(c, 0, 18, 13, 44, '#ff5722', '#ffca28'); c.restore();
            icSword(c, 18, 50, 48, 12, 4.5, '#fff3e0', '#3e2723', '#ffb300');
            icGlow(c, 40, 22, 10, '#ffab40', 0.5);
        },
        3(c) { // Thunder Leap
            c.setLineDash([3, 4]); icArc(c, 'rgba(255, 255, 255, 0.7)', 2, 30, 48, 22, Math.PI * 1.05, Math.PI * 1.75, false); c.setLineDash([]);
            icEll(c, 42, 52, 16, 4, 'rgba(255, 235, 59, 0.35)', 0);
            icBolt(c, 40, 32, 1.4);
            icSpeed(c, [[20, 54, 8], [52, 54, 8]], 'rgba(255, 235, 59, 0.8)');
        },
        4(c) { // Dragon Breath
            c.save(); c.translate(30, 34); c.rotate(Math.PI / 2); icFlame(c, 0, 4, 15, 34); c.restore();
            icPoly(c, [[4, 22], [22, 26], [20, 32], [6, 30]], '#8e2a1e'); icPoly(c, [[4, 46], [22, 40], [20, 35], [6, 38]], '#8e2a1e'); // jaws
            icPoly(c, [[10, 26], [12, 31], [14, 27]], '#fff', 1); icPoly(c, [[10, 42], [12, 37], [14, 41]], '#fff', 1);
        },
        rmb(c) { // Wyrm Strike
            icFlame(c, 32, 58, 16, 34, '#ff5722', '#ffca28');
            icSword(c, 32, 6, 32, 56, 4.5, '#eceff1', '#3e2723', '#ffb300');
        },
    },
    spellweaver: {
        1(c) { // Fireball
            c.save(); c.translate(38, 26); c.rotate(Math.PI * 0.75 + Math.PI); icFlame(c, 0, 0, 12, 34, '#ff7043', '#ffca28'); c.restore();
            icGlow(c, 38, 26, 18, '#ffab40', 0.6); icEll(c, 38, 26, 10, 10, '#ffa726', 2); icEll(c, 36, 24, 5, 5, '#fff3e0', 0);
        },
        2(c) { // Frost Nova
            icArc(c, 'rgba(179, 229, 252, 0.6)', 2, 32, 32, 26, 0, Math.PI * 2, false);
            for (let i = 0; i < 6; i++) {
                const a = i * Math.PI / 3, ex = 32 + Math.cos(a) * 20, ey = 32 + Math.sin(a) * 20, mx = 32 + Math.cos(a) * 12, my = 32 + Math.sin(a) * 12;
                icLine(c, '#e1f5fe', 2.5, [[32, 32], [ex, ey]]);
                icLine(c, '#e1f5fe', 2, [[mx, my], [mx + Math.cos(a + 0.8) * 6, my + Math.sin(a + 0.8) * 6]]);
                icLine(c, '#e1f5fe', 2, [[mx, my], [mx + Math.cos(a - 0.8) * 6, my + Math.sin(a - 0.8) * 6]]);
            }
            icEll(c, 32, 32, 4, 4, '#81d4fa', 1.5);
        },
        3(c) { // Blink
            c.globalAlpha = 0.35; icEll(c, 16, 44, 8, 8, '#4fc3f7', 1.5); c.globalAlpha = 1;
            c.setLineDash([2, 4]); c.strokeStyle = '#b3e5fc'; c.lineWidth = 2; c.beginPath(); c.moveTo(18, 40); c.quadraticCurveTo(24, 18, 44, 20); c.stroke(); c.setLineDash([]);
            icGlow(c, 46, 20, 16, '#4fc3f7', 0.7); icStar(c, 46, 20, 9, '#e1f5fe'); icStar(c, 30, 46, 4, '#81d4fa'); icStar(c, 54, 38, 3, '#81d4fa');
        },
        4(c) { // Meteor
            c.save(); c.translate(38, 38); c.rotate(-Math.PI * 0.25 - Math.PI / 2 + Math.PI); icFlame(c, 0, 0, 13, 40, '#ff5722', '#ffca28'); c.restore();
            icEll(c, 38, 40, 13, 12, '#6d4c41', 2.2); icEll(c, 34, 37, 3.5, 3, '#4e342e', 1); icEll(c, 42, 44, 2.5, 2, '#4e342e', 1);
            icEll(c, 44, 34, 3, 2, 'rgba(255, 171, 64, 0.8)', 0);
        },
        rmb(c) { // Arcane Beam
            icGlow(c, 36, 32, 30, '#4fc3f7', 0.5);
            icLine(c, '#4fc3f7', 10, [[14, 32], [60, 32]]); icLine(c, '#e1f5fe', 4, [[14, 32], [60, 32]], false);
            icEll(c, 12, 32, 9, 9, '#b3e5fc', 2); icEll(c, 12, 32, 4, 4, '#fff', 0);
        },
    },
    ranger: {
        1(c) { // Storm Arrow: one charged arrow down a long line
            icLine(c, 'rgba(128, 216, 255, 0.55)', 7, [[6, 58], [56, 8]]);
            icArrow(c, 8, 56, 54, 10, '#a1887f', '#e1f5fe');
            icBolt(c, 18, 24, 0.75, '#80d8ff'); icBolt(c, 44, 46, 0.75, '#80d8ff');
        },
        2(c) { // Nature's Stride
            icSpeed(c, [[4, 30, 10], [6, 40, 12], [4, 50, 9]]);
            c.save(); c.translate(26, 20); c.scale(2.6, 2.6); sprLeaf(c, 0, 0, -0.5, 9, '#9ccc65'); c.restore();
            icPoly(c, [[24, 18], [38, 18], [38, 40], [54, 44], [56, 52], [24, 52]], '#795548', 2.2); // boot
            icPoly(c, [[24, 48], [56, 48], [56, 52], [24, 52]], '#4e342e', 1.5);
            c.save(); c.translate(36, 22); c.scale(2.4, 2.4); sprLeaf(c, 0, 0, -1.1, 9, '#7cb342'); sprLeaf(c, 0, 0, -0.4, 8, '#aed581'); c.restore();
        },
        3(c) { // Vault
            icLine(c, 'rgba(255, 255, 255, 0.4)', 2, [[6, 54], [58, 54]], false);
            icArc(c, '#aed581', 4, 32, 50, 22, Math.PI * 1.08, Math.PI * 1.9);
            icArrowHead(c, 51, 40, 1.15, 8, '#aed581');
            icEll(c, 12, 48, 4, 4, '#81c784', 1.5);
        },
        4(c) { // Volley
            icEll(c, 32, 52, 22, 7, 'rgba(129, 199, 132, 0.3)', 0); c.strokeStyle = '#81c784'; c.lineWidth = 1.5; c.beginPath(); c.ellipse(32, 52, 22, 7, 0, 0, Math.PI * 2); c.stroke();
            icArrow(c, 6, 6, 20, 46); icArrow(c, 22, 2, 34, 44); icArrow(c, 38, 6, 48, 48);
        },
        rmb(c) { // Chain Lightning: a bolt jumping from target to target
            icLine(c, '#80d8ff', 3, [[6, 52], [22, 14], [38, 48], [58, 12]]);
            for (const [x, y] of [[22, 14], [38, 48]]) icStar(c, x, y, 6, '#e1f5fe');
            icBolt(c, 50, 30, 0.9, '#fff59d');
        },
    },
    nightblade: {
        1(c) { // Fan of Knives
            for (let i = -2; i <= 2; i++) { const a = -Math.PI / 2 + i * 0.42; icSword(c, 32 + Math.cos(a) * 8, 52 + Math.sin(a) * 8, 32 + Math.cos(a) * 44, 52 + Math.sin(a) * 44, 3, '#cfd8dc', '#212121', '#7b1fa2'); }
        },
        2(c) { // Smoke Bomb
            for (const [x, y, r] of [[18, 22, 9], [46, 20, 10], [52, 36, 8], [12, 38, 7]]) icEll(c, x, y, r, r, 'rgba(171, 71, 188, 0.45)', 0);
            icEll(c, 32, 40, 15, 15, '#263238', 2.2); icEll(c, 27, 35, 4, 4, 'rgba(255, 255, 255, 0.35)', 0);
            icLine(c, '#8d6e63', 2.5, [[38, 27], [44, 16]]); icGlow(c, 45, 14, 8, '#ffca28', 0.9); icStar(c, 45, 14, 5, '#fff59d');
        },
        3(c) { // Phantom Dash
            [[14, 0.3], [28, 0.6], [42, 1]].forEach(([x, a]) => { c.globalAlpha = a; icPoly(c, [[x - 6, 14], [x + 12, 32], [x - 6, 50], [x, 32]], '#ba68c8', 2); });
            c.globalAlpha = 1;
        },
        4(c) { // Death Mark
            c.strokeStyle = '#e040fb'; c.lineWidth = 2; c.beginPath(); c.arc(32, 32, 24, 0, Math.PI * 2); c.stroke();
            for (let i = 0; i < 4; i++) { const a = i * Math.PI / 2; icLine(c, '#e040fb', 2, [[32 + Math.cos(a) * 20, 32 + Math.sin(a) * 20], [32 + Math.cos(a) * 29, 32 + Math.sin(a) * 29]], false); }
            icEll(c, 32, 29, 13, 12, '#eceff1', 2); icPoly(c, [[24, 36], [40, 36], [38, 45], [26, 45]], '#eceff1', 2);
            icEll(c, 27, 30, 3.5, 4, '#4a148c', 0); icEll(c, 37, 30, 3.5, 4, '#4a148c', 0);
            icGlow(c, 27, 30, 5, '#e040fb', 0.9); icGlow(c, 37, 30, 5, '#e040fb', 0.9);
            c.strokeStyle = IC_LINE; c.lineWidth = 1.2; c.beginPath(); for (const x of [29, 32, 35]) { c.moveTo(x, 40); c.lineTo(x, 45); } c.stroke();
        },
        rmb(c) { // Expose: an eye of shadow sight over the cone it reveals
            icPoly(c, [[32, 60], [4, 12], [60, 12]], 'rgba(171, 71, 188, 0.35)', 0);
            icEll(c, 32, 30, 19, 10, '#eceff1', 2); icEll(c, 32, 30, 7, 7, '#7b1fa2', 0); icEll(c, 32, 30, 3, 3, '#12001a', 0);
            icGlow(c, 32, 30, 9, '#e040fb', 0.8);
        },
    },
    machinist: {
        1(c) { // Sentry Turret
            icLine(c, '#455a64', 3, [[32, 40], [16, 56]]); icLine(c, '#455a64', 3, [[32, 40], [48, 56]]); icLine(c, '#455a64', 3, [[32, 40], [32, 57]]);
            c.beginPath(); c.roundRect(18, 20, 26, 20, 5); icFill(c, '#ff9800', 2.2);
            icLine(c, '#37474f', 6, [[42, 28], [58, 24]]); icEll(c, 59, 24, 2, 3, '#212121', 0);
            icEll(c, 28, 30, 4, 4, '#4dd0e1', 1.5);
        },
        2(c) { // Tesla Coil
            for (let i = 0; i < 4; i++) icEll(c, 32, 50 - i * 8, 11 - i, 4, '#b0bec5', 1.8);
            icLine(c, '#78909c', 4, [[32, 50], [32, 22]]);
            icGlow(c, 32, 16, 18, '#4dd0e1', 0.8); icEll(c, 32, 16, 7, 7, '#80deea', 2);
            c.strokeStyle = '#e0f7fa'; c.lineWidth = 1.5; c.beginPath(); c.moveTo(38, 14); c.lineTo(46, 10); c.lineTo(44, 16); c.lineTo(54, 12); c.moveTo(26, 16); c.lineTo(18, 12); c.lineTo(20, 18); c.lineTo(10, 16); c.stroke();
        },
        3(c) { // Magnetic Grapple
            c.setLineDash([3, 3]); icLine(c, '#b0bec5', 2, [[30, 34], [56, 10]], false); c.setLineDash([]);
            icPoly(c, [[50, 8], [58, 8], [58, 16]], '#cfd8dc', 1.6);
            c.beginPath(); c.arc(22, 40, 14, Math.PI * 0.75, Math.PI * 1.75, true); c.lineCap = 'butt';
            c.strokeStyle = IC_LINE; c.lineWidth = 13; c.stroke(); c.strokeStyle = '#e53935'; c.lineWidth = 9; c.stroke();
            icEll(c, 12.5, 30.5, 4.5, 4.5, '#cfd8dc', 1.5); icEll(c, 31.5, 49.5, 4.5, 4.5, '#cfd8dc', 1.5);
        },
        4(c) { // Overclock Protocol
            icGlow(c, 32, 32, 28, '#ff9800', 0.5);
            ptGear(c, 32, 32, 24, 10, 0.2); c.fillStyle = '#78909c'; c.fill('evenodd'); c.strokeStyle = IC_LINE; c.lineWidth = 2; c.stroke();
            icEll(c, 32, 32, 12, 12, '#263238', 1.5);
            icBolt(c, 33, 32, 0.85, '#ffca28');
        },
        rmb(c) { // Net Shot
            c.save(); c.beginPath(); c.arc(32, 32, 22, 0, Math.PI * 2); c.clip();
            c.strokeStyle = '#d7ccc8'; c.lineWidth = 2; c.beginPath();
            for (let i = -30; i <= 30; i += 8) { c.moveTo(32 + i - 30, 2); c.lineTo(32 + i + 30, 62); c.moveTo(32 + i + 30, 2); c.lineTo(32 + i - 30, 62); }
            c.stroke(); c.restore();
            c.strokeStyle = IC_LINE; c.lineWidth = 2; c.beginPath(); c.arc(32, 32, 22, 0, Math.PI * 2); c.stroke();
            for (let i = 0; i < 6; i++) { const a = i * Math.PI / 3; icEll(c, 32 + Math.cos(a) * 23, 32 + Math.sin(a) * 23, 3.5, 3.5, '#616161', 1.5); }
        },
    },
    kensei: {
        1(c) { // Parry Thrust / Blade Surge
            icSword(c, 8, 56, 50, 14, 3.5, '#e0f7fa', '#263238', '#ffd54f');
            icGlow(c, 52, 12, 14, '#00e5ff', 0.8); icStar(c, 52, 12, 9, '#ffffff');
        },
        2(c) { // Deploy / Recall
            icArc(c, '#00e5ff', 2.5, 32, 32, 24, -0.4, 1.8); icArc(c, '#00e5ff', 2.5, 32, 32, 24, 2.7, 4.9);
            icArrowHead(c, 32 + Math.cos(1.8) * 24, 32 + Math.sin(1.8) * 24, 1.8 + Math.PI / 2, 6, '#00e5ff');
            icArrowHead(c, 32 + Math.cos(4.9) * 24, 32 + Math.sin(4.9) * 24, 4.9 + Math.PI / 2, 6, '#00e5ff');
            icGlow(c, 32, 32, 16, '#00e5ff', 0.4); icSword(c, 32, 10, 32, 56, 3.5, '#b2ebf2', '#263238', '#ffd54f');
        },
        3(c) { // Shadow Step / Spatial Swap
            c.globalAlpha = 0.4; icEll(c, 14, 40, 8, 8, '#00acc1', 1.8); c.globalAlpha = 1; icEll(c, 50, 24, 8, 8, '#00e5ff', 1.8);
            icArc(c, '#80deea', 2.5, 32, 32, 18, Math.PI * 1.05, Math.PI * 1.7); icArrowHead(c, 32 + Math.cos(Math.PI * 1.7) * 18, 32 + Math.sin(Math.PI * 1.7) * 18, Math.PI * 1.7 + Math.PI / 2, 5, '#80deea');
            icArc(c, '#80deea', 2.5, 32, 32, 18, Math.PI * 0.05, Math.PI * 0.7); icArrowHead(c, 32 + Math.cos(Math.PI * 0.7) * 18, 32 + Math.sin(Math.PI * 0.7) * 18, Math.PI * 0.7 + Math.PI / 2, 5, '#80deea');
        },
        4(c) { // Blade Whirlwind / Shatter Storm
            icGlow(c, 32, 32, 24, '#00e5ff', 0.4);
            for (let i = 0; i < 3; i++) {
                c.save(); c.translate(32, 32); c.rotate(i * Math.PI * 2 / 3);
                c.beginPath(); c.arc(0, 0, 23, -0.3, 1.5); c.arc(7, 5, 13, 1.5, -0.3, true); c.closePath(); icFill(c, '#b2ebf2', 1.8);
                c.restore();
            }
            icEll(c, 32, 32, 5, 5, '#ffd54f', 1.5);
        },
        rmb(c) { // Phantom Wind
            c.strokeStyle = 'rgba(224, 247, 250, 0.8)'; c.lineWidth = 2.5; c.lineCap = 'round';
            for (const [y, r] of [[20, 14], [32, 20], [44, 12]]) { c.beginPath(); c.moveTo(6, y); c.lineTo(40, y); c.arc(40, y - r / 3, r / 3, Math.PI / 2, -Math.PI, true); c.stroke(); }
            icSword(c, 14, 56, 58, 38, 3, '#b2ebf2', '#263238', '#ffd54f');
        },
    },
    cleric: {
        1(c) { // Divine Ray
            const g = c.createLinearGradient(0, 0, 0, 52); g.addColorStop(0, 'rgba(255, 245, 157, 0)'); g.addColorStop(1, 'rgba(255, 245, 157, 0.95)');
            c.fillStyle = g; c.fillRect(24, 0, 16, 50); c.fillStyle = '#fffde7'; c.fillRect(29, 0, 6, 50);
            icEll(c, 32, 52, 20, 6, 'rgba(255, 235, 59, 0.5)', 0); icStar(c, 32, 50, 9, '#ffffff');
        },
        2(c) { // Hallowed Ground
            icGlow(c, 32, 42, 28, '#ffeb3b', 0.35);
            c.strokeStyle = '#ffeb3b'; c.lineWidth = 2; c.beginPath(); c.ellipse(32, 44, 26, 10, 0, 0, Math.PI * 2); c.stroke(); c.beginPath(); c.ellipse(32, 44, 18, 6.5, 0, 0, Math.PI * 2); c.stroke();
            icLine(c, '#fff59d', 4, [[32, 12], [32, 40]]); icLine(c, '#fff59d', 4, [[22, 22], [42, 22]]);
        },
        3(c) { // Phase Shift
            c.beginPath(); c.arc(32, 32, 20, Math.PI / 2, Math.PI * 1.5); c.closePath(); icFill(c, '#ffd54f', 0);
            c.beginPath(); c.arc(32, 32, 20, -Math.PI / 2, Math.PI / 2); c.closePath(); icFill(c, '#9c27b0', 0);
            c.strokeStyle = IC_LINE; c.lineWidth = 2; c.beginPath(); c.arc(32, 32, 20, 0, Math.PI * 2); c.stroke();
            icEll(c, 32, 22, 4, 4, '#9c27b0', 1.2); icEll(c, 32, 42, 4, 4, '#ffd54f', 1.2);
            icArc(c, 'rgba(255, 255, 255, 0.7)', 2, 32, 32, 27, -0.6, 0.6, false); icArc(c, 'rgba(255, 255, 255, 0.7)', 2, 32, 32, 27, Math.PI - 0.6, Math.PI + 0.6, false);
        },
        4(c) { // Ascension
            for (const s of [-1, 1]) {
                c.save(); c.translate(32, 36); c.scale(s, 1);
                c.beginPath(); c.moveTo(2, -2); c.quadraticCurveTo(18, -22, 30, -16); c.quadraticCurveTo(24, -10, 28, -6); c.quadraticCurveTo(20, -2, 24, 4); c.quadraticCurveTo(14, 6, 2, 6); c.closePath(); icFill(c, '#fffde7', 2);
                c.restore();
            }
            c.strokeStyle = '#ffeb3b'; c.lineWidth = 3; c.beginPath(); c.ellipse(32, 14, 10, 4, 0, 0, Math.PI * 2); c.stroke();
            icEll(c, 32, 38, 5, 9, '#ffd54f', 1.6);
        },
        rmb(c) { // Twilight Repulse
            for (const [r, col] of [[24, '#ce93d8'], [16, '#ffd54f'], [8, '#fff59d']]) icArc(c, col, 2.5, 32, 32, r, 0, Math.PI * 2, false);
            for (let i = 0; i < 4; i++) { const a = Math.PI / 4 + i * Math.PI / 2; icArrowHead(c, 32 + Math.cos(a) * 28, 32 + Math.sin(a) * 28, a, 5, '#fff'); }
        },
    },
    druid: {
        1(c) { // Bramble Snare
            icEll(c, 32, 32, 16, 16, '#558b2f', 2.2);
            c.strokeStyle = '#33691e'; c.lineWidth = 2.5;
            for (const a of [0.3, 1.4, 2.6]) { c.beginPath(); c.ellipse(32, 32, 16, 6, a, 0, Math.PI * 2); c.stroke(); }
            for (let i = 0; i < 10; i++) { const a = i * Math.PI / 5; icPoly(c, [[32 + Math.cos(a - 0.15) * 15, 32 + Math.sin(a - 0.15) * 15], [32 + Math.cos(a) * 25, 32 + Math.sin(a) * 25], [32 + Math.cos(a + 0.15) * 15, 32 + Math.sin(a + 0.15) * 15]], '#8d6e63', 1.4); }
        },
        2(c) { // Feral Surge: green light pouring into the wolf
            icGlow(c, 32, 34, 30, '#76ff03', 0.55);
            icBeastHead(c, 32, 34, 0.9);
            for (const [x, y, a] of [[10, 52, -0.6], [54, 52, -2.5], [8, 30, 0.2], [56, 30, 2.9]]) { c.save(); c.translate(x, y); c.scale(1.8, 1.8); sprLeaf(c, 0, 0, a, 7, '#9ccc65'); c.restore(); }
        },
        3(c) { // Spirit Leap: a leap arc ending in paw prints
            c.setLineDash([4, 5]); icArc(c, 'rgba(178, 255, 89, 0.85)', 2.5, 34, 52, 28, Math.PI * 1.05, Math.PI * 1.75, false); c.setLineDash([]);
            for (const [x, y, s] of [[14, 50, 0.7], [46, 22, 1]]) icPaw(c, x, y, s, '#d7ccc8');
            icGlow(c, 46, 22, 12, '#b2ff59', 0.5); icPaw(c, 46, 22, 1, '#eceff1');
        },
        4(c) { // Call of the Wild: the wolf howls under the moon, spirit wolves answer
            icEll(c, 46, 16, 12, 12, '#f0f4c3', 1.6); icEll(c, 51, 13, 9, 9, '#263238', 0); // crescent
            for (const r of [10, 17]) icArc(c, '#ccff90', 2.2, 24, 22, r, -2.6, -1.2, false);
            c.save(); c.globalAlpha = 0.55; icBeastHead(c, 14, 44, 0.55, '#76ff03'); icBeastHead(c, 50, 44, 0.55, '#76ff03'); c.restore();
            icBeastHead(c, 32, 40, 0.8);
        },
        rmb(c) { // Thistle-Grip Claws
            for (let i = 0; i < 3; i++) { c.beginPath(); c.moveTo(12 + i * 12, 54); c.quadraticCurveTo(10 + i * 12, 30, 24 + i * 12, 10); c.quadraticCurveTo(18 + i * 12, 32, 20 + i * 12, 54); c.closePath(); icFill(c, '#eceff1', 1.6); }
            icEll(c, 50, 46, 7, 7, '#7b1fa2', 1.6); for (let i = 0; i < 6; i++) { const a = -Math.PI / 2 + (i - 2.5) * 0.35; icLine(c, '#ba68c8', 1.5, [[50, 42], [50 + Math.cos(a) * 10, 42 + Math.sin(a) * 10]], false); }
        },
    },
    paladin: {
        1(c) { // Judgment Hammer
            c.setLineDash([3, 4]); icArc(c, 'rgba(255, 213, 79, 0.7)', 2, 32, 34, 24, Math.PI * 0.6, Math.PI * 1.3, false); c.setLineDash([]);
            c.save(); c.translate(36, 30); c.rotate(0.6);
            icLine(c, '#8d6e63', 5, [[0, 4], [0, 30]]);
            c.beginPath(); c.roundRect(-14, -12, 28, 18, 4); icFill(c, '#cfd8dc', 2.2);
            icPoly(c, [[-14, -10], [-20, -3], [-14, 4]], '#ffca28', 1.6); icPoly(c, [[14, -10], [20, -3], [14, 4]], '#ffca28', 1.6);
            c.restore();
            icGlow(c, 36, 28, 14, '#ffd54f', 0.5);
        },
        2(c) { // Divine Tether: a glowing chain of golden links running corner to corner
            icGlow(c, 32, 32, 26, '#ffd54f', 0.35);
            icLine(c, 'rgba(255, 213, 79, 0.45)', 9, [[10, 54], [54, 10]]);
            c.save(); c.translate(32, 32); c.rotate(-Math.PI / 4);
            c.strokeStyle = '#ffca28'; c.lineWidth = 3.5;
            for (let s = -24, i = 0; s <= 24; s += 12, i++) { c.beginPath(); if (i % 2) c.ellipse(s, 0, 7, 4.5, 0, 0, Math.PI * 2); else { c.moveTo(s - 7, 0); c.lineTo(s + 7, 0); } c.stroke(); }
            c.restore();
            icEll(c, 54, 10, 5, 5, '#fff8e1', 1.5);
        },
        3(c) { // Righteous Charge / Iron Pull
            icSpeed(c, [[4, 22, 12], [2, 32, 14], [4, 42, 12]], 'rgba(255, 213, 79, 0.75)');
            icShieldPath(c, 34, 32, 16, 40); icFill(c, '#cfd8dc', 2.2);
            icLine(c, '#ffca28', 4, [[34, 20], [34, 44]]); icLine(c, '#ffca28', 4, [[26, 28], [42, 28]]);
            icArrowHead(c, 56, 32, 0, 7, '#ffd54f');
        },
        4(c) { // Consecrated Wrath
            icGlow(c, 32, 32, 30, '#ffd54f', 0.6);
            for (let i = 0; i < 8; i++) { const a = i * Math.PI / 4 + Math.PI / 8; icLine(c, 'rgba(255, 245, 157, 0.85)', 2, [[32 + Math.cos(a) * 14, 32 + Math.sin(a) * 14], [32 + Math.cos(a) * 28, 32 + Math.sin(a) * 28]], false); }
            icPoly(c, [[28, 8], [36, 8], [36, 26], [54, 26], [54, 34], [36, 34], [36, 56], [28, 56], [28, 34], [10, 34], [10, 26], [28, 26]], '#ffca28', 2);
            icPoly(c, [[30.5, 11], [33.5, 11], [33.5, 28], [30.5, 28]], 'rgba(255, 255, 255, 0.6)', 0);
        },
    },
    monk: {
        1(c) { // Chi Wave / Rushing Fist: a crescent of chi flying with a fist at its heart
            icSpeed(c, [[4, 22, 14], [2, 32, 16], [6, 42, 12]], 'rgba(255, 224, 130, 0.75)');
            icGlow(c, 38, 32, 26, '#ffca28', 0.55);
            c.beginPath(); c.arc(28, 32, 26, -1.15, 1.15); c.arc(19, 32, 22, 1.0, -1.0, true); c.closePath(); icFill(c, '#ffca28', 2);
            c.beginPath(); c.arc(28, 32, 23, -0.9, 0.9); c.strokeStyle = '#fffde7'; c.lineWidth = 2; c.stroke();
            icFist(c, 33, 32, 9, 0);
        },
        2(c) { // Earth Palm / Crippling Tremor: a palm of chi struck into the ground, rings of earth rolling out
            for (const [rx, ry, a] of [[29, 10, 0.5], [21, 7, 0.75]]) { c.strokeStyle = `rgba(215, 168, 90, ${a})`; c.lineWidth = 2.5; c.beginPath(); c.ellipse(32, 44, rx, ry, 0, 0, Math.PI * 2); c.stroke(); }
            icGlow(c, 32, 40, 22, '#ff9800', 0.5);
            icPalm(c, 32, 34, 1.55, -Math.PI / 2, '#ffcc80');
            for (const [x, y] of [[6, 52], [58, 50], [12, 58], [52, 58]]) icEll(c, x, y, 2.5, 2.5, '#a08a6a', 0);
        },
        3(c) { // Swift Step / Iron Will: two light steps on the wind, a red-gold drop of life
            icSpeed(c, [[4, 30, 12], [8, 40, 10], [4, 50, 12]], 'rgba(255, 255, 255, 0.55)');
            for (const [x, y, r] of [[24, 44, -0.5], [42, 26, -0.5]]) {
                c.save(); c.translate(x, y); c.rotate(r);
                icEll(c, 0, 0, 10, 5.5, '#8d6e63', 2); icEll(c, 0, 0, 7.5, 3.5, '#d9a066', 0);
                icLine(c, '#c62828', 1.8, [[-2, -5], [-2, 5]], false); c.restore();
            }
            icGlow(c, 50, 48, 13, '#ff5252', 0.8);
            c.beginPath(); c.moveTo(50, 38); c.quadraticCurveTo(57, 48, 54, 52); c.arc(50, 51, 4.5, 0.2, Math.PI - 0.2); c.quadraticCurveTo(43, 48, 50, 38); c.closePath(); icFill(c, '#ff5252', 1.6);
            icEll(c, 48, 48, 1.4, 2, '#ffe082', 0);
        },
        4(c) { // Dragon Kick / Dragon's Descent: a kick out of a coiling dragon of fire
            icGlow(c, 44, 22, 22, '#ff7043', 0.6);
            const body = () => { c.moveTo(6, 58); c.bezierCurveTo(30, 60, 8, 34, 26, 30); c.quadraticCurveTo(36, 28, 42, 22); };
            c.lineCap = 'round'; c.lineJoin = 'round';
            c.beginPath(); body(); c.strokeStyle = IC_LINE; c.lineWidth = 13; c.stroke();
            c.beginPath(); body(); c.strokeStyle = '#d84315'; c.lineWidth = 10; c.stroke();
            c.beginPath(); body(); c.strokeStyle = '#ff9800'; c.lineWidth = 4.5; c.stroke();
            c.strokeStyle = '#ffd54f'; c.lineWidth = 1.5; c.beginPath(); for (const [x, y] of [[14, 56], [20, 46], [20, 36], [30, 29]]) { c.moveTo(x - 3, y - 2); c.lineTo(x + 1, y + 2); } c.stroke(); // scales
            icLine(c, '#ffb74d', 2, [[38, 18], [30, 8], [24, 10]]); icLine(c, '#ffb74d', 2, [[44, 26], [50, 34], [58, 32]]); // whiskers
            c.save(); c.translate(48, 18); c.rotate(-0.65); // the foot, wrapped in white, kicking up and out
            icEll(c, 0, 0, 10, 6, '#eceff1', 2); icLine(c, '#b0bec5', 1.2, [[-3, -5], [-3, 5]], false); c.restore();
        },
        rmb(c) { // Iron Body: a bronze bell closed round the monk (the golden bell), rivets and a rim of chi
            icGlow(c, 32, 36, 30, '#ffca28', 0.45);
            c.beginPath(); c.moveTo(20, 18); c.quadraticCurveTo(32, 4, 44, 18); c.lineTo(48, 44); c.quadraticCurveTo(56, 52, 56, 54); c.lineTo(8, 54); c.quadraticCurveTo(8, 52, 16, 44); c.closePath(); icFill(c, '#b87333', 2.2);
            icPoly(c, [[24, 14], [28, 10], [28, 44], [22, 46]], 'rgba(255, 224, 178, 0.45)', 0); // the sheen
            c.strokeStyle = '#6d3f1c'; c.lineWidth = 2; c.beginPath(); c.moveTo(18, 30); c.lineTo(46, 30); c.moveTo(13, 47); c.lineTo(51, 47); c.stroke();
            for (let i = 0; i < 5; i++) icEll(c, 20 + i * 6, 38, 1.8, 1.8, '#ffe0b2', 0);
            icEll(c, 32, 8, 4, 3, '#8d5a2b', 1.5); // the crown loop
            icLine(c, '#ffd54f', 2, [[6, 57], [58, 57]]);
        },
    },
    swordsaint: {
        1(c) { // Gale Step: three steps of wind toward the top right, a ring of sword-light where the last one lands
            icSpeed(c, [[4, 50, 12], [6, 58, 10]], 'rgba(227, 242, 253, 0.6)');
            for (const [x, y, a] of [[16, 46, 0.45], [28, 34, 0.7]]) { c.strokeStyle = `rgba(255, 248, 225, ${a})`; c.lineWidth = 3; c.lineCap = 'round'; c.beginPath(); c.arc(x, y, 8, 0, Math.PI * 1.6); c.stroke(); }
            icGlow(c, 44, 20, 20, '#ffd54f', 0.6);
            c.strokeStyle = IC_LINE; c.lineWidth = 7; c.beginPath(); c.arc(44, 20, 13, 0, Math.PI * 2); c.stroke();
            c.strokeStyle = '#ffd54f'; c.lineWidth = 4; c.beginPath(); c.arc(44, 20, 13, 0, Math.PI * 2); c.stroke();
            icSword(c, 34, 30, 56, 8, 3.2, '#fff8e1', '#1f4aa8', '#e8b931');
        },
        2(c) { // Strike Air: the wind seal bursting off the blade in curling gusts
            icGlow(c, 32, 32, 28, '#90caf9', 0.55);
            for (let i = 0; i < 6; i++) { const a = i * Math.PI / 3; c.strokeStyle = i % 2 ? '#ffffff' : '#90caf9'; c.lineWidth = 3; c.lineCap = 'round'; c.beginPath(); c.arc(32, 32, 20 + (i % 2) * 6, a, a + 0.9); c.stroke(); }
            icSword(c, 14, 50, 50, 14, 3.5, '#eceff1', '#1f4aa8', '#e8b931');
        },
        3(c) { // Mana Burst: a jet of blue prana streaking forward
            icGlow(c, 40, 28, 22, '#82b1ff', 0.7);
            icPoly(c, [[4, 40], [36, 22], [56, 18], [40, 32], [10, 50]], '#82b1ff', 2);
            icPoly(c, [[16, 40], [38, 26], [50, 22], [38, 30], [18, 44]], '#e3f2fd', 0);
            icSpeed(c, [[4, 24, 14], [6, 32, 10]], 'rgba(255, 255, 255, 0.6)');
            icEll(c, 52, 20, 4, 4, '#ffffff', 1.5);
        },
        4(c) { // Unsealed Blade / Excalibur: the sword raised, a column of golden light pouring from it
            icGlow(c, 32, 24, 30, '#ffd54f', 0.75);
            icPoly(c, [[26, 2], [38, 2], [44, 30], [20, 30]], 'rgba(255, 248, 225, 0.85)', 0);
            icSword(c, 32, 60, 32, 6, 4.2, '#fff3c4', '#1f4aa8', '#e8b931');
            for (const [x, y] of [[12, 16], [52, 14], [16, 36], [50, 38]]) icStar(c, x, y, 4, '#fff59d');
        },
        rmb(c) { // Hammer of the Wind King: a funnel of compressed wind fired forward
            icGlow(c, 34, 32, 28, '#e3f2fd', 0.55);
            for (let i = 0; i < 4; i++) { c.strokeStyle = i % 2 ? '#ffffff' : '#90caf9'; c.lineWidth = 3.5 - i * 0.5; c.lineCap = 'round'; c.beginPath(); c.ellipse(26 + i * 7, 32, 6 + i * 4, 14 - i * 2, 0, 0.6, Math.PI * 2 - 0.6); c.stroke(); }
            icSpeed(c, [[4, 22, 12], [2, 32, 14], [4, 42, 12]], 'rgba(227, 242, 253, 0.7)');
        },
    },
    witch: {
        1(c) { // Grave Hex: a violet circle on the ground, a skull at its heart, crescents riding the ring
            icGlow(c, 32, 34, 30, '#ab47bc', 0.6);
            c.strokeStyle = '#e1bee7'; c.lineWidth = 2.5; c.beginPath(); c.ellipse(32, 36, 26, 22, 0, 0, Math.PI * 2); c.stroke();
            c.lineWidth = 1.5; c.beginPath(); c.ellipse(32, 36, 19, 16, 0, 0, Math.PI * 2); c.stroke();
            for (let i = 0; i < 3; i++) { const a = -Math.PI / 2 + i * Math.PI * 2 / 3, x = 32 + Math.cos(a) * 22.5, y = 36 + Math.sin(a) * 19; c.beginPath(); c.arc(x, y, 4, 0, Math.PI * 2); c.arc(x + 1.8, y - 1, 3.3, 0, Math.PI * 2, true); c.fillStyle = '#ce93d8'; c.fill('evenodd'); }
            icEll(c, 32, 33, 10, 9.5, '#e8e0cc', 2); icPoly(c, [[26, 40], [38, 40], [36, 46], [28, 46]], '#e8e0cc', 2);
            icEll(c, 28, 34, 2.8, 3.2, '#4a148c', 0); icEll(c, 36, 34, 2.8, 3.2, '#4a148c', 0); icPoly(c, [[31, 38], [33, 38], [32, 40]], '#4a148c', 0);
        },
        2(c) { // Raise Dead: a rotting hand clawing out of a grave, a soul rising over it
            icGlow(c, 32, 22, 18, '#69f0ae', 0.7);
            c.beginPath(); c.moveTo(29, 14); c.quadraticCurveTo(27, 6, 33, 2); c.quadraticCurveTo(36, 8, 35, 14); c.arc(32, 15, 4, 0, Math.PI); c.closePath(); icFill(c, '#b9f6ca', 1.5);
            icEll(c, 32, 52, 24, 8, '#3e2723', 2); icEll(c, 32, 51, 18, 5, '#1a120e', 0);
            icLine(c, '#8a9a74', 6, [[30, 52], [32, 36]]);
            for (const [x0, y0, x1, y1] of [[28, 36, 22, 26], [31, 34, 29, 23], [34, 34, 36, 24], [36, 37, 42, 30]]) icLine(c, '#8a9a74', 3, [[x0, y0], [x1, y1]]);
            icEll(c, 32, 37, 6, 5, '#8a9a74', 1.8);
            for (const [x, y] of [[12, 50], [52, 48], [18, 57], [47, 57]]) icEll(c, x, y, 2.5, 2, '#5d4037', 0);
        },
        3(c) { // Broom Flight: the broom seen from the side, the bristles fanning out behind, wind lines
            icSpeed(c, [[4, 18, 12], [2, 30, 10], [6, 44, 14]], 'rgba(185, 246, 202, 0.7)');
            c.save(); c.translate(32, 34); c.rotate(-0.35);
            for (let i = -3; i <= 3; i++) icLine(c, i % 2 ? '#a1887f' : '#795548', 2.5, [[-12, 0], [-26, i * 3.2]], i === 0);
            icPoly(c, [[-14, -3], [-10, -3], [-10, 3], [-14, 3]], '#3e2723', 1.2);
            icLine(c, '#6d4c41', 4, [[-10, 0], [24, 0], [28, -4]]);
            c.restore();
            icGlow(c, 50, 16, 9, '#69f0ae', 0.8); icEll(c, 50, 16, 2.5, 2.5, '#b9f6ca', 0);
        },
        4(c) { // Hex of the Toad: a fat toad from above in a puff of violet hex smoke
            icGlow(c, 32, 34, 30, '#ab47bc', 0.55);
            for (const [x, y, r] of [[12, 16, 6], [52, 14, 5], [8, 46, 5], [56, 44, 6]]) icEll(c, x, y, r, r, 'rgba(206, 147, 216, 0.6)', 0);
            for (const s of [-1, 1]) { icEll(c, 32 + s * 14, 44, 7, 4.5, '#6b8e23', 1.8, s * 0.6); icEll(c, 32 + s * 16, 26, 3, 2.4, '#3e5a12', 1.2); }
            icEll(c, 32, 38, 15, 14, '#6b8e23', 2);
            icEll(c, 32, 40, 9, 5, '#9ccc65', 0);
            for (const [x, y] of [[26, 44], [37, 46], [30, 33], [38, 37]]) icEll(c, x, y, 1.6, 1.6, '#3e5a12', 0);
            for (const s of [-1, 1]) { icEll(c, 32 + s * 7, 26, 4.2, 4.2, '#9ccc65', 1.5); icEll(c, 32 + s * 7, 26, 2.8, 2.8, '#ffd54f', 0); c.fillStyle = '#111'; c.fillRect(32 + s * 7 - 2, 25.4, 4, 1.2); }
        },
        rmb(c) { // Dark Pact: a zombie's skull bursting in poison, a green drop of life flying out of it
            icGlow(c, 30, 36, 30, '#76ff03', 0.55);
            for (let i = 0; i < 8; i++) { const a = i * Math.PI / 4 + 0.2; icLine(c, 'rgba(178, 255, 89, 0.85)', 2.5, [[30 + Math.cos(a) * 16, 36 + Math.sin(a) * 16], [30 + Math.cos(a) * 27, 36 + Math.sin(a) * 27]], false); }
            icEll(c, 30, 34, 12, 11, '#8a9a74', 2); icPoly(c, [[23, 42], [37, 42], [35, 49], [25, 49]], '#8a9a74', 2);
            icEll(c, 25.5, 35, 3, 3.5, '#1b5e20', 0); icEll(c, 34.5, 35, 3, 3.5, '#1b5e20', 0);
            c.beginPath(); c.moveTo(52, 6); c.quadraticCurveTo(59, 16, 56, 20); c.arc(52, 19, 4.5, 0.2, Math.PI - 0.2); c.quadraticCurveTo(45, 16, 52, 6); c.closePath(); icFill(c, '#69f0ae', 1.6);
        },
    },
};

// ---------- item glyphs ----------

function itemPalette(rare) { return rare ? { metal: '#ffd54f', dark: '#b8860b', accent: '#b98cff', leather: '#5e35b1' } : { metal: '#b0bec5', dark: '#607d8b', accent: '#8d6e63', leather: '#6d4c41' }; }
const WEAPON_GLYPHS = {
    sword(c, p) { icSword(c, 12, 52, 54, 10, 4.5, p.metal === '#ffd54f' ? '#fff3c4' : '#e0e6ea', p.leather, p.metal); },
    dagger(c, p) { icSword(c, 10, 46, 40, 16, 3.5, '#e0e6ea', p.leather, p.metal); icSword(c, 54, 46, 24, 16, 3.5, '#e0e6ea', p.leather, p.metal); },
    phantom_blade(c, p) { icGlow(c, 34, 30, 22, '#00e5ff', 0.4); icSword(c, 12, 54, 56, 8, 3, '#b2ebf2', '#263238', p.metal); },
    staff(c, p) { icLine(c, p.leather, 4.5, [[16, 58], [42, 18]]); icPoly(c, [[46, 4], [54, 16], [44, 26], [36, 14]], '#81d4fa', 2); icGlow(c, 45, 15, 12, '#4fc3f7', 0.6); icEll(c, 38, 24, 5, 3, p.metal, 1.5, -1); },
    bow(c, p) {
        c.beginPath(); c.moveTo(18, 6); c.quadraticCurveTo(58, 32, 18, 58); c.lineCap = 'round'; c.strokeStyle = IC_LINE; c.lineWidth = 8; c.stroke(); c.strokeStyle = p.leather === '#5e35b1' ? '#8d6e63' : '#8d6e63'; c.lineWidth = 5; c.stroke();
        c.strokeStyle = '#eceff1'; c.lineWidth = 1.2; c.beginPath(); c.moveTo(18, 6); c.lineTo(18, 58); c.stroke();
        icEll(c, 38, 32, 3.5, 6, p.metal, 1.5);
    },
    scattergun(c, p) {
        c.save(); c.translate(32, 34); c.rotate(-0.5);
        icPoly(c, [[-28, -2], [-12, -6], [-10, 6], [-28, 8]], p.leather); icPoly(c, [[-12, -7], [6, -7], [6, 5], [-12, 5]], p.dark);
        icLine(c, '#455a64', 4, [[6, -4], [28, -4]]); icLine(c, '#455a64', 4, [[6, 2], [28, 2]]); icEll(c, 29, -1, 3, 6, '#263238', 1.5);
        c.restore();
    },
    censer(c, p) { c.setLineDash([3, 2]); icLine(c, p.metal, 2, [[32, 4], [32, 26]], false); c.setLineDash([]); icEll(c, 32, 40, 14, 13, p.metal, 2); c.beginPath(); c.arc(32, 36, 12, Math.PI, 0); icFill(c, p.dark, 2); icGlow(c, 32, 42, 10, '#ffeb3b', 0.6); icEll(c, 32, 22, 4, 4, p.metal, 1.5); },
    totem(c, p) { icLine(c, '#5d4037', 6, [[24, 60], [30, 40], [26, 24], [32, 12]]); icEll(c, 33, 12, 9, 9, '#6d4c41', 2); icEll(c, 33, 12, 4, 4, '#aeea00', 0); c.save(); c.translate(38, 8); c.scale(2, 2); sprLeaf(c, 0, 0, -0.6, 8, '#8bc34a'); c.restore(); },
    blightstaff(c, p) { // the Witch's grave-wood staff with its little skull; a rare one is bound in gold
        icLine(c, '#4e342e', 4.5, [[14, 60], [24, 42], [30, 30], [40, 20]]); icLine(c, p.metal, 2, [[36, 26], [40, 22]], false);
        icGlow(c, 46, 14, 14, '#76ff03', 0.6); icEll(c, 46, 14, 9, 8.5, '#e8e0cc', 2); icEll(c, 43, 13, 2.2, 2.6, '#1b5e20', 0); icEll(c, 49, 13, 2.2, 2.6, '#1b5e20', 0);
    },
    saint_sword(c, p) { icSword(c, 12, 52, 56, 8, 5.5, p.metal === '#ffd54f' ? '#fff8e1' : '#e0e6ea', '#1f4aa8', p.metal === '#ffd54f' ? '#ffd54f' : '#e8b931'); if (p.metal === '#ffd54f') icGlow(c, 40, 22, 14, '#82b1ff', 0.45); }, // the Swordsaint's longsword; Caliburn has a wind-blue light
    fists(c, p) { // two wrapped fists, the ends of the wraps trailing; a rare's wraps are bound with gold
        const rare = p.metal === '#ffd54f', wrap = rare ? '#fff8e1' : '#eceff1', band = rare ? '#ffca28' : '#b0bec5';
        icLine(c, wrap, 3, [[10, 50], [4, 60]]); icLine(c, wrap, 3, [[24, 58], [20, 63]]);
        if (rare) icGlow(c, 34, 30, 26, '#ffca28', 0.4);
        icFist(c, 24, 38, 12, -0.9, wrap, band); icFist(c, 42, 24, 12, -0.6, wrap, band);
    },
    mace(c, p) { icLine(c, '#8d6e63', 5, [[16, 58], [38, 24]]); c.save(); c.translate(42, 18); c.rotate(0.55); for (const s of [-1, 1]) icPoly(c, [[s * 9, -10], [s * 17, -4], [s * 17, 6], [s * 9, 10]], p.metal, 1.8); c.beginPath(); c.roundRect(-10, -13, 20, 26, 4); icFill(c, '#cfd8dc', 2); c.restore(); },
};
const ITEM_GLYPHS = {
    armor(c, p) {
        icPoly(c, [[20, 10], [26, 14], [38, 14], [44, 10], [56, 18], [50, 30], [46, 28], [46, 56], [18, 56], [18, 28], [14, 30], [8, 18]], p.dark, 2.2);
        icPoly(c, [[24, 16], [40, 16], [42, 44], [32, 50], [22, 44]], p.metal, 1.6);
        c.strokeStyle = IC_LINE; c.lineWidth = 1.2; c.beginPath(); c.moveTo(32, 18); c.lineTo(32, 48); c.moveTo(24, 30); c.lineTo(40, 30); c.stroke();
    },
    amulet(c, p) {
        c.strokeStyle = p.metal; c.lineWidth = 2; c.beginPath(); c.moveTo(14, 6); c.quadraticCurveTo(14, 30, 32, 34); c.quadraticCurveTo(50, 30, 50, 6); c.stroke();
        icPoly(c, [[32, 30], [44, 42], [32, 60], [20, 42]], p.metal, 2);
        icPoly(c, [[32, 36], [39, 43], [32, 54], [25, 43]], p.accent === '#8d6e63' ? '#4fc3f7' : p.accent, 1.2);
        icGlow(c, 32, 44, 12, p.accent === '#8d6e63' ? '#4fc3f7' : p.accent, 0.5);
    },
    boots(c, p) {
        icPoly(c, [[14, 8], [30, 8], [30, 38], [50, 42], [54, 54], [14, 54]], p.leather, 2.2);
        icPoly(c, [[14, 48], [54, 48], [54, 54], [14, 54]], '#3e2723', 1.5);
        icPoly(c, [[12, 8], [32, 8], [32, 16], [12, 16]], p.metal, 1.5);
        icSpeed(c, [[40, 22, 14], [44, 30, 12]], 'rgba(255, 255, 255, 0.5)');
    },
    gloves(c, p) {
        c.beginPath(); c.moveTo(18, 58); c.lineTo(18, 30); c.quadraticCurveTo(16, 14, 22, 12); c.lineTo(24, 26); c.lineTo(26, 8); c.lineTo(32, 8); c.lineTo(33, 24); c.lineTo(36, 9); c.lineTo(42, 10); c.lineTo(41, 26); c.lineTo(46, 16); c.lineTo(51, 19); c.lineTo(46, 36); c.lineTo(44, 58); c.closePath();
        icFill(c, p.leather, 2.2);
        icPoly(c, [[16, 48], [46, 48], [46, 58], [16, 58]], p.metal, 1.6);
    },
};

// ---------- rendering & cache ----------

function renderIcon(key, tint, glyph) {
    if (iconCache[key]) return iconCache[key];
    const cv = document.createElement('canvas'); cv.width = cv.height = IC_PX;
    const c = cv.getContext('2d'); c.scale(IC_PX / IC, IC_PX / IC); c.lineJoin = 'round';
    const g = c.createRadialGradient(32, 26, 4, 32, 32, 46); // dark tinted backdrop
    g.addColorStop(0, sprShade(tint, -0.45)); g.addColorStop(1, sprShade(tint, -0.88));
    c.fillStyle = g; c.fillRect(0, 0, IC, IC);
    glyph(c);
    const v = c.createRadialGradient(32, 32, 20, 32, 32, 46); v.addColorStop(0, 'rgba(0, 0, 0, 0)'); v.addColorStop(1, 'rgba(0, 0, 0, 0.45)'); // vignette
    c.fillStyle = v; c.fillRect(0, 0, IC, IC);
    return (iconCache[key] = cv.toDataURL());
}
function skillIcon(classId, slot) {
    if (classId === 'spellweaver' && isSpellbook() && activeClass.skills[slot] && activeClass.skills[slot].spell) return spellIcon(activeClass.skills[slot].spell); // spellweaver.js: the spell on that key
    const glyph = SKILL_GLYPHS[classId] && SKILL_GLYPHS[classId][slot];
    const tint = (classDataConfig[classId] && classDataConfig[classId].color) || '#888888';
    return renderIcon(`s:${classId}:${slot}${classId === 'druid' ? ':' + (player.companion || 'wolf') : ''}`, tint, glyph || (c => icStar(c, 32, 32, 16, '#fff')));
}
function itemIcon(item) {
    const rare = item.rarity === 'rare', p = itemPalette(rare);
    const wtype = (activeClass && activeClass.weapon) || 'sword';
    const glyph = item.type === 'weapon' ? (WEAPON_GLYPHS[wtype] || WEAPON_GLYPHS.sword) : ITEM_GLYPHS[item.type];
    return renderIcon(`i:${item.type}:${item.type === 'weapon' ? wtype : ''}:${rare}`, rare ? '#7e57c2' : '#8d7a5a', c => glyph(c, p));
}
// Materials (caches.js): small glyphs with no backdrop, for inline use in text (the rebuild screen, the plaque, the sheets)
// and stamped in the world by the pickup lines. matIconCanvas for canvas drawing, matIcon for <img src>.
const MAT_GLYPHS = {
    wood(c) { // three planks tied with a rope band
        c.save(); c.translate(32, 33); c.rotate(-0.55);
        [['#a8743f', -11, 2], ['#d4a467', 0, -3], ['#b98448', 11, 1]].forEach(([col, y, dx]) => {
            c.beginPath(); c.roundRect(-25 + dx, y - 5.5, 50, 11, 2); icFill(c, col, 2.4);
            c.strokeStyle = 'rgba(70, 40, 15, 0.55)'; c.lineWidth = 1.3; c.beginPath(); c.moveTo(-19 + dx, y - 1); c.quadraticCurveTo(0, y + 2, 19 + dx, y); c.stroke();
            c.fillStyle = 'rgba(255, 236, 190, 0.35)'; c.fillRect(-23 + dx, y - 4.5, 46, 2);
        });
        for (const x of [-11, 11]) { c.beginPath(); c.rect(x - 3.5, -19, 7, 38); icFill(c, '#e3cc94', 2); c.strokeStyle = 'rgba(90, 64, 30, 0.6)'; c.lineWidth = 1.2; c.beginPath(); for (let y = -16; y < 18; y += 5) { c.moveTo(x - 3.5, y); c.lineTo(x + 3.5, y + 3); } c.stroke(); }
        c.restore();
    },
    iron(c) { // two ingots, one stacked on the other
        const ingot = (x, y, s, top, side) => {
            icPoly(c, [[x - 16 * s, y - 4 * s], [x - 10 * s, y - 13 * s], [x + 14 * s, y - 13 * s], [x + 20 * s, y - 4 * s], [x + 20 * s, y + 5 * s], [x - 16 * s, y + 5 * s]], side, 2.4);
            icPoly(c, [[x - 16 * s, y - 4 * s], [x - 10 * s, y - 13 * s], [x + 14 * s, y - 13 * s], [x + 20 * s, y - 4 * s]], top, 0);
            c.strokeStyle = 'rgba(240, 248, 255, 0.7)'; c.lineWidth = 1.6; c.beginPath(); c.moveTo(x - 9 * s, y - 11 * s); c.lineTo(x + 12 * s, y - 11 * s); c.stroke();
        };
        ingot(36, 31, 1, '#8ea3b3', '#56687a');
        ingot(27, 47, 1, '#b4c6d4', '#6e8494');
    },
    stone(c) { // two cut blocks
        const block = (x, y, w, h, d) => {
            icPoly(c, [[x, y], [x + w, y], [x + w + d, y - d], [x + d, y - d]], '#e0dfd6', 2.2); // the top face
            icPoly(c, [[x + w, y], [x + w + d, y - d], [x + w + d, y + h - d], [x + w, y + h]], '#85847b', 2.2); // the side in shade
            c.beginPath(); c.rect(x, y, w, h); icFill(c, '#b3b2a8', 2.2); // the face
            c.strokeStyle = 'rgba(60, 58, 52, 0.45)'; c.lineWidth = 1.2; c.beginPath(); c.moveTo(x + 5, y + h * 0.4); c.lineTo(x + w * 0.45, y + h * 0.35); c.moveTo(x + w * 0.3, y + h * 0.75); c.lineTo(x + w - 5, y + h * 0.7); c.stroke(); // chisel marks
        };
        block(22, 18, 24, 15, 7);
        block(10, 37, 26, 17, 7);
    },
};
const matIconCanvases = {};
function matIconCanvas(k) {
    if (matIconCanvases[k]) return matIconCanvases[k];
    const cv = document.createElement('canvas'); cv.width = cv.height = IC_PX;
    const c = cv.getContext('2d'); c.scale(IC_PX / IC, IC_PX / IC); c.lineJoin = 'round';
    (MAT_GLYPHS[k] || MAT_GLYPHS.wood)(c);
    return (matIconCanvases[k] = cv);
}
function matIcon(k) { return iconCache['m:' + k] || (iconCache['m:' + k] = matIconCanvas(k).toDataURL()); }
const matImg = k => `<img class="mat-ic" src="${matIcon(k)}" alt="">`; // inline in a line of text (ui.css .mat-ic)

// The class id used by classes.json / SKILL_GLYPHS for the running class
function activeClassId() { return Object.keys(classDataConfig).find(k => classDataConfig[k].name === (activeClass && activeClass.name)) || selectedClassId; }
