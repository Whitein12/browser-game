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
        2(c) { // Iron Bulwark
            icArc(c, 'rgba(255, 183, 77, 0.8)', 2, 32, 32, 26, 0, Math.PI * 2, false);
            icEll(c, 32, 32, 19, 19, '#78909c', 2.2); icEll(c, 32, 32, 14, 14, '#90a4ae', 1.5);
            for (let i = 0; i < 8; i++) { const a = i * Math.PI / 4; icEll(c, 32 + Math.cos(a) * 16.5, 32 + Math.sin(a) * 16.5, 1.6, 1.6, '#eceff1', 0); }
            icEll(c, 32, 32, 6, 6, '#cfd8dc', 1.8); icEll(c, 30, 30, 2, 2, 'rgba(255, 255, 255, 0.8)', 0);
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
        1(c) { // Ricochet Shot
            c.setLineDash([3, 3]); c.strokeStyle = 'rgba(255, 255, 255, 0.6)'; c.lineWidth = 2; c.beginPath(); c.moveTo(6, 52); c.lineTo(22, 14); c.lineTo(38, 48); c.stroke(); c.setLineDash([]);
            for (const [x, y] of [[22, 14], [38, 48]]) icStar(c, x, y, 5, '#fff59d');
            icArrow(c, 38, 48, 58, 14);
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
        rmb(c) { // Lightning Volley
            icArrow(c, 8, 8, 28, 50, '#a1887f', '#fff59d'); icArrow(c, 30, 4, 46, 46, '#a1887f', '#fff59d');
            icBolt(c, 48, 30, 1.1);
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
        rmb(c) { // Execute
            icSword(c, 32, 4, 32, 46, 4.5, '#cfd8dc', '#212121', '#7b1fa2');
            icPoly(c, [[32, 48], [38, 56], [32, 61], [26, 56]], '#e53935', 1.6);
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
    swordsaint: {
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
        1(c) { // Bramble Core
            icEll(c, 32, 32, 16, 16, '#558b2f', 2.2);
            c.strokeStyle = '#33691e'; c.lineWidth = 2.5;
            for (const a of [0.3, 1.4, 2.6]) { c.beginPath(); c.ellipse(32, 32, 16, 6, a, 0, Math.PI * 2); c.stroke(); }
            for (let i = 0; i < 10; i++) { const a = i * Math.PI / 5; icPoly(c, [[32 + Math.cos(a - 0.15) * 15, 32 + Math.sin(a - 0.15) * 15], [32 + Math.cos(a) * 25, 32 + Math.sin(a) * 25], [32 + Math.cos(a + 0.15) * 15, 32 + Math.sin(a + 0.15) * 15]], '#8d6e63', 1.4); }
        },
        2(c) { // Barkskin Shift
            icShieldPath(c, 32, 34, 20, 44); icFill(c, '#795548', 2.2);
            c.save(); icShieldPath(c, 32, 34, 20, 44); c.clip();
            c.strokeStyle = '#4e342e'; c.lineWidth = 1.5; for (const r of [6, 12, 18]) { c.beginPath(); c.ellipse(32, 30, r, r * 1.2, 0, 0, Math.PI * 2); c.stroke(); }
            c.restore();
            c.save(); c.translate(32, 14); c.scale(2.2, 2.2); sprLeaf(c, 0, 0, -1.9, 8, '#9ccc65'); sprLeaf(c, 0, 0, -1.2, 8, '#7cb342'); c.restore();
        },
        3(c) { // Spore Burst / Feral Pounce
            for (const [x, y, r] of [[18, 20, 6], [28, 12, 4], [12, 34, 4], [26, 28, 5]]) { icGlow(c, x, y, r * 2, '#cddc39', 0.6); icEll(c, x, y, r, r, '#dce775', 1.5); }
            for (let i = 0; i < 3; i++) { c.beginPath(); c.moveTo(34 + i * 7, 24 + i * 2); c.quadraticCurveTo(44 + i * 7, 40, 40 + i * 6, 58); c.quadraticCurveTo(46 + i * 7, 40, 38 + i * 7, 22 + i * 2); c.closePath(); icFill(c, '#eceff1', 1.6); }
        },
        4(c) { // Aspect of the Wild
            c.beginPath(); c.moveTo(32, 58); c.lineTo(18, 44); c.lineTo(8, 26); c.lineTo(10, 6); c.lineTo(22, 18); c.quadraticCurveTo(32, 14, 42, 18); c.lineTo(54, 6); c.lineTo(56, 26); c.lineTo(46, 44); c.closePath(); icFill(c, '#5d6b4a', 2.2);
            icPoly(c, [[24, 40], [40, 40], [32, 58]], '#8d9c74', 1.6);
            icGlow(c, 22, 30, 7, '#aeea00', 0.9); icGlow(c, 42, 30, 7, '#aeea00', 0.9);
            icEll(c, 22, 30, 4, 2.2, '#f0f4c3', 0, 0.35); icEll(c, 42, 30, 4, 2.2, '#f0f4c3', 0, -0.35);
            icEll(c, 32, 52, 3.5, 2.5, '#212121', 0);
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
        2(c) { // Bastion Dome
            icGlow(c, 32, 44, 30, '#ffd54f', 0.35);
            c.beginPath(); c.moveTo(6, 48); c.arc(32, 48, 26, Math.PI, 0); c.closePath(); icFill(c, 'rgba(255, 236, 179, 0.35)', 0);
            icArc(c, '#ffd54f', 3, 32, 48, 26, Math.PI, 0); icArc(c, 'rgba(255, 245, 200, 0.6)', 1.5, 32, 48, 18, Math.PI * 1.15, Math.PI * 1.55, false);
            icLine(c, '#ffd54f', 3, [[4, 48], [60, 48]]);
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
    const glyph = SKILL_GLYPHS[classId] && SKILL_GLYPHS[classId][slot];
    const tint = (classDataConfig[classId] && classDataConfig[classId].color) || '#888888';
    return renderIcon(`s:${classId}:${slot}`, tint, glyph || (c => icStar(c, 32, 32, 16, '#fff')));
}
function itemIcon(item) {
    const rare = item.rarity === 'rare', p = itemPalette(rare);
    const wtype = (activeClass && activeClass.weapon) || 'sword';
    const glyph = item.type === 'weapon' ? (WEAPON_GLYPHS[wtype] || WEAPON_GLYPHS.sword) : ITEM_GLYPHS[item.type];
    return renderIcon(`i:${item.type}:${item.type === 'weapon' ? wtype : ''}:${rare}`, rare ? '#7e57c2' : '#8d7a5a', c => glyph(c, p));
}
// The class id used by classes.json / SKILL_GLYPHS for the running class
function activeClassId() { return Object.keys(classDataConfig).find(k => classDataConfig[k].name === (activeClass && activeClass.name)) || selectedClassId; }
