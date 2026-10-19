// ==========================================
// charms_fx.js - The charms' art: their icons, the Warding Candle's flames, a save's flare, the Map Scrap's marker
// ==========================================
// charms.js runs the charms and calls in here. Nothing in this file changes the game: it only reads the global `charms`
// ({ worn, owned, pouch, active, hitAt, reviveAt, reviveKind }), which may not exist yet while the scripts load.
//   charmIcon(id)     - a data URL (icons.js renderIcon, cached): the shop, the inventory's slots and pouch, tooltips, the HUD chip
//   drawCharmWorld()  - main.js, world space right after the hero: the candle's flames, a ward snuffing one, a save's flare
//   drawCharmScreen() - main.js, screen space: the Map Scrap's red X, or a chip at the view's edge pointing to it
// hitAt / reviveAt are fxTime stamps, so everything here pauses with the game. Glows go through bandits.js glow (one
// cached sprite per colour); the rest is flat fills, a few paths a frame.

// ---------- icons ----------
// Charms sit on a teal-bronze backdrop, wave charms on a warm amber one, so neither reads as gear (brown / violet).
const CFX_TINT = { charm: '#2e9e8c', wave: '#c8913a' };
const CFX_FRAME = { charm: ['rgba(120, 214, 192, 0.7)', '#c9a35c'], wave: ['rgba(240, 196, 110, 0.75)', '#e6cf9a'] };
const CFX_WAVE = new Set(['whetstone', 'bounty_writ', 'warding_candle', 'hunters_lure', 'smelling_salts', 'map_scrap']);

function cfxFrame(c, kind) { // a thin inset border with four studs: a trinket's case
    const [line, stud] = CFX_FRAME[kind];
    c.strokeStyle = line; c.lineWidth = 1.4; c.beginPath(); c.roundRect(3.5, 3.5, 57, 57, 7); c.stroke();
    for (const [x, y] of [[7, 7], [57, 7], [7, 57], [57, 57]]) { c.fillStyle = 'rgba(10, 8, 14, 0.8)'; c.beginPath(); c.arc(x, y, 2.4, 0, Math.PI * 2); c.fill(); c.fillStyle = stud; c.beginPath(); c.arc(x, y, 1.5, 0, Math.PI * 2); c.fill(); }
}
// A feather along +x from (0, 0) to (len, 0): a shaft and a vane; `edge` makes the vane ragged (flame tongues)
function cfxFeather(c, len, w, fill, edge = 0) {
    c.beginPath(); c.moveTo(len * 0.18, 0);
    const n = 9;
    for (let i = 0; i <= n; i++) { const t = i / n, x = len * (0.18 + 0.82 * t), h = w * Math.sin(Math.PI * Math.pow(t, 0.8)) * (1 + (i % 2 ? edge : 0)); c.lineTo(x, -h); }
    for (let i = n; i >= 0; i--) { const t = i / n, x = len * (0.18 + 0.82 * t), h = w * 0.85 * Math.sin(Math.PI * Math.pow(t, 0.8)) * (1 + (i % 2 ? 0 : edge)); c.lineTo(x, h); }
    c.closePath(); icFill(c, fill, 2);
}

const CHARM_GLYPHS = {
    magnet_stone(c) { // a lodestone, a red horseshoe struck into it, iron filings standing on its poles
        icGlow(c, 32, 36, 26, '#80cbc4', 0.25);
        icPoly(c, [[14, 30], [22, 16], [38, 12], [52, 22], [54, 40], [44, 54], [24, 54], [12, 44]], '#3d4148', 2.4);
        icPoly(c, [[22, 16], [38, 12], [52, 22], [40, 26], [24, 24]], '#5d636d', 0); // its lit top facet
        icPoly(c, [[12, 44], [24, 54], [44, 54], [40, 48], [22, 46]], '#2a2d33', 0);
        const hs = () => { c.beginPath(); c.moveTo(24, 26); c.lineTo(24, 36); c.arc(32, 36, 8, Math.PI, 0, true); c.lineTo(40, 26); };
        c.lineCap = 'round'; hs(); c.strokeStyle = IC_LINE; c.lineWidth = 8; c.stroke(); hs(); c.strokeStyle = '#d32f2f'; c.lineWidth = 5; c.stroke();
        icLine(c, '#eceff1', 5, [[24, 25], [24, 29]], false); icLine(c, '#eceff1', 5, [[40, 25], [40, 29]], false); // the poles
        c.strokeStyle = 'rgba(255, 255, 255, 0.5)'; c.lineWidth = 1.2; c.beginPath(); c.arc(32, 36, 6, Math.PI * 0.75, Math.PI * 0.35, true); c.stroke();
        c.strokeStyle = '#b0bec5'; c.lineWidth = 1.2; c.beginPath(); // the filings, fanned round the two poles
        for (const [x, s] of [[24, -1], [40, 1]]) for (let i = 0; i < 5; i++) { const a = -Math.PI / 2 + s * (i - 1) * 0.42, r0 = 7 + (i % 2) * 2; c.moveTo(x + Math.cos(a) * r0, 25 + Math.sin(a) * r0); c.lineTo(x + Math.cos(a) * (r0 + 3.5), 25 + Math.sin(a) * (r0 + 3.5)); }
        c.stroke();
    },
    gamblers_die(c) { // a bone die, its one a red pip
        icGlow(c, 32, 32, 26, '#ffe0b2', 0.2);
        icPoly(c, [[32, 10], [53, 20], [53, 44], [32, 55], [11, 44], [11, 20]], '#a8987a', 2.4);
        icPoly(c, [[32, 10], [53, 20], [32, 30], [11, 20]], '#f1e8d0', 1.4);
        icPoly(c, [[11, 20], [32, 30], [32, 55], [11, 44]], '#d4c6a4', 1.4);
        icEll(c, 32, 20, 5, 2.9, '#c62828', 1.2); c.fillStyle = 'rgba(255, 205, 210, 0.8)'; c.beginPath(); c.ellipse(30.6, 19.2, 1.6, 0.9, 0, 0, Math.PI * 2); c.fill();
        c.fillStyle = '#3e2f22';
        for (const [x, y] of [[17.5, 29.5], [25.5, 44]]) { c.beginPath(); c.ellipse(x, y, 2.2, 2.7, 0.45, 0, Math.PI * 2); c.fill(); }
        for (const [x, y] of [[37, 33.5], [42.5, 38], [48, 42.5]]) { c.beginPath(); c.ellipse(x, y, 2.2, 2.7, -0.45, 0, Math.PI * 2); c.fill(); }
        c.strokeStyle = 'rgba(255, 255, 255, 0.55)'; c.lineWidth = 1; c.beginPath(); c.moveTo(14, 21); c.lineTo(31, 12.5); c.stroke();
    },
    bloodstone(c) { // a dark green stone flecked red in a bronze bezel, on a cord
        icLine(c, '#8d6e63', 2.4, [[12, 4], [20, 14], [30, 19]]); icLine(c, '#8d6e63', 2.4, [[52, 4], [44, 14], [34, 19]]);
        icEll(c, 32, 20, 3.5, 3.5, '#c9a35c', 1.6);
        icEll(c, 32, 39, 15, 18, '#a1793f', 2.2);
        icEll(c, 32, 39, 12, 15, '#1d4b35', 1.4);
        icEll(c, 30, 36, 8, 10, '#2c6a4b', 0);
        c.fillStyle = '#d32f2f'; for (const [x, y, r] of [[26, 33, 1.9], [36, 30, 1.3], [37, 43, 2.1], [28, 46, 1.4], [33, 39, 1.1], [24, 41, 1]]) { c.beginPath(); c.arc(x, y, r, 0, Math.PI * 2); c.fill(); }
        c.fillStyle = 'rgba(255, 255, 255, 0.55)'; c.beginPath(); c.ellipse(27, 30, 3.4, 1.8, -0.7, 0, Math.PI * 2); c.fill();
    },
    wardstone(c) { // a silver ring set with a pale blue stone, a faint ward light round it
        icGlow(c, 32, 24, 22, '#81d4fa', 0.5);
        const band = () => { c.beginPath(); c.ellipse(32, 40, 17, 11, 0, 0, Math.PI * 2); };
        band(); c.strokeStyle = IC_LINE; c.lineWidth = 9; c.stroke();
        band(); c.strokeStyle = '#b0bec5'; c.lineWidth = 5.5; c.stroke();
        c.strokeStyle = 'rgba(255, 255, 255, 0.75)'; c.lineWidth = 1.5; c.beginPath(); c.ellipse(32, 40, 17, 11, 0, Math.PI * 0.15, Math.PI * 0.85); c.stroke();
        icPoly(c, [[22, 30], [42, 30], [38, 20], [26, 20]], '#90a4ae', 1.8); // the setting
        for (const x of [24, 40, 28, 36]) icLine(c, '#eceff1', 2, [[x, 26], [x + (x < 32 ? 2 : -2), 16]], false); // prongs
        icPoly(c, [[32, 8], [42, 17], [32, 28], [22, 17]], '#b3e5fc', 1.6);
        icPoly(c, [[32, 8], [42, 17], [32, 17]], '#e1f5fe', 0); icPoly(c, [[22, 17], [32, 17], [32, 28]], '#81d4fa', 0);
        icStar(c, 28, 13, 3, '#ffffff');
    },
    vial_hook(c) { // a little brass hook cradling a flask vial by its neck
        icGlow(c, 32, 44, 18, '#ef5350', 0.4);
        icEll(c, 32, 44, 13, 13, 'rgba(200, 230, 240, 0.35)', 2.2);
        c.save(); c.beginPath(); c.arc(32, 44, 11.5, 0, Math.PI * 2); c.clip();
        c.fillStyle = '#c62828'; c.fillRect(18, 44, 28, 14); c.fillStyle = '#ef5350'; c.fillRect(18, 43, 28, 3);
        c.restore();
        c.strokeStyle = 'rgba(255, 255, 255, 0.7)'; c.lineWidth = 1.6; c.beginPath(); c.arc(32, 44, 9, Math.PI * 1.1, Math.PI * 1.45); c.stroke();
        c.beginPath(); c.rect(28, 23, 8, 10); icFill(c, 'rgba(200, 230, 240, 0.45)', 1.8);
        c.beginPath(); c.roundRect(26.5, 18, 11, 6, 1.5); icFill(c, '#a1887f', 1.8);
        const hook = () => { c.beginPath(); c.moveTo(42, 6); c.lineTo(42, 27); c.arc(35, 27, 7, 0, Math.PI * 0.85); };
        c.lineCap = 'round'; hook(); c.strokeStyle = IC_LINE; c.lineWidth = 6; c.stroke(); hook(); c.strokeStyle = '#d4a03a'; c.lineWidth = 3; c.stroke();
        icEll(c, 42, 6, 3.4, 3.4, 'rgba(0, 0, 0, 0)', 0); c.strokeStyle = IC_LINE; c.lineWidth = 5; c.stroke(); c.strokeStyle = '#ffd54f'; c.lineWidth = 2.2; c.stroke(); // the eye it hangs from
    },
    scholar_quill(c) { // a quill, a drop of ink falling from its nib
        c.save(); c.translate(34, 30); c.rotate(-Math.PI / 4);
        icLine(c, '#d7ccc8', 2.2, [[-20, 0], [-4, 0]]); // the bare quill below the vane
        c.translate(-10, 0); cfxFeather(c, 40, 12, '#f3ecdc'); c.translate(10, 0);
        c.strokeStyle = 'rgba(120, 100, 80, 0.55)'; c.lineWidth = 1; c.beginPath(); for (const x of [6, 12, 18, 24]) { c.moveTo(x, -1); c.lineTo(x + 5, -8); c.moveTo(x, 1); c.lineTo(x + 5, 7); } c.stroke();
        icLine(c, '#bcaaa4', 1.6, [[-4, 0], [29, 0]], false);
        icPoly(c, [[-26, 0], [-19, -2.8], [-15, 0], [-19, 2.8]], '#37474f', 1.5);
        c.fillStyle = '#1a237e'; c.beginPath(); c.moveTo(-26, 0); c.lineTo(-22, -1.5); c.lineTo(-22, 1.5); c.fill();
        c.restore();
        c.beginPath(); c.moveTo(13, 49); c.quadraticCurveTo(10, 55, 13, 57.5); c.quadraticCurveTo(16, 55, 13, 49); icFill(c, '#283593', 1.5);
        c.fillStyle = 'rgba(255, 255, 255, 0.6)'; c.beginPath(); c.arc(12.2, 55.2, 0.9, 0, Math.PI * 2); c.fill();
    },
    phoenix_feather(c) { // a flame-orange feather, its tip gold, burning softly
        icGlow(c, 34, 30, 28, '#ff7043', 0.5);
        c.save(); c.translate(18, 52); c.rotate(-1.05);
        const g = c.createLinearGradient(0, 0, 46, 0); g.addColorStop(0, '#bf360c'); g.addColorStop(0.45, '#ff7043'); g.addColorStop(0.8, '#ffb74d'); g.addColorStop(1, '#ffe082');
        cfxFeather(c, 46, 10, g, 0.35);
        c.strokeStyle = 'rgba(120, 30, 0, 0.45)'; c.lineWidth = 1; c.beginPath(); for (const x of [16, 22, 28, 34]) { c.moveTo(x, -1); c.lineTo(x + 5, -7); c.moveTo(x, 1); c.lineTo(x + 5, 6); } c.stroke();
        icLine(c, '#ffe0b2', 1.8, [[0, 0], [43, 0]], false);
        icEll(c, 42, 0, 5, 3.6, '#ffd54f', 1.4); // the gold tip
        c.restore();
        icGlow(c, 50, 16, 9, '#ffe082', 0.8);
        c.fillStyle = '#ffcc80'; for (const [x, y, r] of [[46, 8, 1.6], [55, 22, 1.3], [40, 14, 1.1]]) { c.beginPath(); c.arc(x, y, r, 0, Math.PI * 2); c.fill(); } // embers
    },

    // ---- wave charms ----
    whetstone(c) { // a grey whetstone, worn hollow in the middle, a spark off its edge
        c.save(); c.translate(30, 36); c.rotate(-0.5);
        c.beginPath(); c.roundRect(-22, -6, 44, 15, 5); icFill(c, '#6f747a', 2.2);
        c.beginPath(); c.moveTo(-22, -3); c.quadraticCurveTo(-22, -9, -16, -9); c.quadraticCurveTo(0, -5, 16, -9); c.quadraticCurveTo(22, -9, 22, -3); c.lineTo(22, 0); c.lineTo(-22, 0); c.closePath(); icFill(c, '#a4aab0', 1.6); // its top, dished by use
        c.fillStyle = 'rgba(40, 42, 46, 0.55)'; for (const [x, y] of [[-14, 4], [-6, 6], [5, 3], [13, 5], [-2, 2], [9, 7]]) c.fillRect(x, y, 1.6, 1.6);
        c.strokeStyle = 'rgba(255, 255, 255, 0.55)'; c.lineWidth = 1; c.beginPath(); c.moveTo(-15, -6.5); c.quadraticCurveTo(0, -3, 15, -6.5); c.stroke();
        c.restore();
        icGlow(c, 48, 18, 14, '#ffd54f', 0.8);
        icLine(c, '#fff59d', 1.6, [[48, 18], [58, 10]], false); icLine(c, '#ffe082', 1.4, [[48, 18], [57, 22]], false); icLine(c, '#fff59d', 1.2, [[48, 18], [52, 7]], false);
        icStar(c, 48, 18, 6, '#ffffff');
    },
    bounty_writ(c) { // a rolled writ tied with a red wax seal, a coin beside it
        c.save(); c.translate(29, 28); c.rotate(-0.45);
        c.beginPath(); c.rect(-21, -8, 42, 16); icFill(c, '#e9dcb8', 2);
        c.strokeStyle = 'rgba(120, 90, 50, 0.4)'; c.lineWidth = 1; c.beginPath(); c.moveTo(-17, -3); c.lineTo(17, -3); c.moveTo(-17, 3); c.lineTo(17, 3); c.stroke();
        icEll(c, -21, 0, 3.4, 8, '#d4c49a', 1.8);
        icEll(c, 21, 0, 3.4, 8, '#d4c49a', 1.8); c.strokeStyle = 'rgba(90, 68, 40, 0.7)'; c.lineWidth = 1; c.beginPath(); c.ellipse(21, 0, 1.6, 4, 0, 0, Math.PI * 2); c.stroke(); // the roll's end
        icLine(c, '#8d2a1e', 2.2, [[2, -8], [2, 8]], false);
        c.beginPath(); for (let i = 0; i < 12; i++) { const a = i / 12 * Math.PI * 2, r = i % 2 ? 7.4 : 6.6; c.lineTo(2 + Math.cos(a) * r, 2 + Math.sin(a) * r); } c.closePath(); icFill(c, '#b71c1c', 1.6);
        c.strokeStyle = '#7f1010'; c.lineWidth = 1.1; c.beginPath(); c.arc(2, 2, 4, 0, Math.PI * 2); c.stroke();
        c.fillStyle = 'rgba(255, 180, 170, 0.6)'; c.beginPath(); c.arc(0, 0, 1.4, 0, Math.PI * 2); c.fill();
        c.restore();
        icEll(c, 46, 47, 10, 10, '#f1c34a', 2); c.strokeStyle = 'rgba(122, 84, 16, 0.75)'; c.lineWidth = 1.2; c.beginPath(); c.arc(46, 47, 7, 0, Math.PI * 2); c.stroke();
        c.fillStyle = '#9a6c14'; c.beginPath(); [[41.5, 50], [41.5, 44.5], [43.8, 47], [46, 43.5], [48.2, 47], [50.5, 44.5], [50.5, 50]].forEach(([x, y], i) => i ? c.lineTo(x, y) : c.moveTo(x, y)); c.closePath(); c.fill(); // a crown struck on it
        c.fillStyle = 'rgba(255, 248, 210, 0.75)'; c.beginPath(); c.ellipse(42.5, 43, 2.6, 1.4, -0.6, 0, Math.PI * 2); c.fill();
    },
    warding_candle(c) { // a short white candle on a brass dish, three small flames circling over it as a halo
        icGlow(c, 32, 20, 26, '#ffcc80', 0.5);
        const ring = (a0, a1) => { c.beginPath(); c.ellipse(32, 15, 19, 6.5, 0, a0, a1); c.strokeStyle = 'rgba(255, 224, 130, 0.85)'; c.lineWidth = 1.6; c.stroke(); };
        ring(Math.PI, Math.PI * 2); // the halo's far half, behind the candle's flame
        icFlame(c, 32, 12, 2.4, 7, '#ffb74d', '#fff8e1');
        icEll(c, 32, 54, 17, 5.5, '#c9a35c', 2); icEll(c, 32, 53, 12, 3.5, '#a1793f', 0);
        c.beginPath(); c.moveTo(22, 32); c.lineTo(22, 52); c.ellipse(32, 52, 10, 3.5, 0, Math.PI, 0, true); c.lineTo(42, 32); c.closePath(); icFill(c, '#efe6d2', 2);
        c.fillStyle = 'rgba(160, 140, 110, 0.35)'; c.fillRect(37, 33, 4, 18); // its shaded side
        icEll(c, 32, 32, 10, 3.6, '#fffaf0', 1.6);
        c.beginPath(); c.moveTo(25, 33); c.quadraticCurveTo(24, 40, 26, 42); c.quadraticCurveTo(28, 40, 27.5, 34); icFill(c, '#fffaf0', 1.2); // a drip
        icLine(c, '#3e2723', 1.4, [[32, 32], [32, 28]], false);
        icFlame(c, 32, 30, 4, 12, '#ffa726', '#fff8e1');
        ring(0, Math.PI); // the near half, in front
        icFlame(c, 14.5, 19, 2.4, 7, '#ffb74d', '#fff8e1'); icFlame(c, 49.5, 19, 2.4, 7, '#ffb74d', '#fff8e1');
    },
    hunters_lure(c) { // a horn call, banded in brass, a red tassel hanging from its cord
        const P0 = [12, 18], P1 = [22, 50], P2 = [52, 34], q = t => { const u = 1 - t; return [u * u * P0[0] + 2 * u * t * P1[0] + t * t * P2[0], u * u * P0[1] + 2 * u * t * P1[1] + t * t * P2[1]]; };
        const nrm = t => { const u = 1 - t, dx = 2 * u * (P1[0] - P0[0]) + 2 * t * (P2[0] - P1[0]), dy = 2 * u * (P1[1] - P0[1]) + 2 * t * (P2[1] - P1[1]), L = Math.hypot(dx, dy); return [-dy / L, dx / L]; };
        const wid = t => 2 + 9 * t * t, side = [], other = [];
        for (let i = 0; i <= 16; i++) { const t = i / 16, [x, y] = q(t), [nx, ny] = nrm(t), w = wid(t); side.push([x + nx * w, y + ny * w]); other.unshift([x - nx * w, y - ny * w]); }
        // the cord and tassel first, hanging behind the horn
        const [bx, by] = q(0.42);
        icLine(c, '#8d6e63', 1.6, [[bx, by], [bx - 2, by + 10], [bx + 1, 52]]);
        icPoly(c, [[bx - 2, 51], [bx + 4, 51], [bx + 6, 61], [bx - 4, 61]], '#c62828', 1.6);
        c.strokeStyle = 'rgba(80, 10, 10, 0.6)'; c.lineWidth = 0.9; c.beginPath(); for (const dx of [-1.5, 1, 3.5]) { c.moveTo(bx + dx, 54); c.lineTo(bx + dx * 1.3, 60); } c.stroke();
        icEll(c, bx + 1, 51, 3.4, 2, '#d4a03a', 1.2);
        icPoly(c, side.concat(other), '#d7c4a0', 2.2);
        c.save(); c.beginPath(); side.concat(other).forEach(([x, y], i) => i ? c.lineTo(x, y) : c.moveTo(x, y)); c.closePath(); c.clip();
        c.fillStyle = 'rgba(120, 90, 50, 0.35)'; for (let i = 0; i < 16; i++) { const [x, y] = q(i / 16), [nx, ny] = nrm(i / 16), w = wid(i / 16); c.beginPath(); c.arc(x - nx * w * 0.6, y - ny * w * 0.6, w * 0.5, 0, Math.PI * 2); c.fill(); } // shade along its inner curve
        c.restore();
        for (const t of [0.42, 0.75]) { const [x, y] = q(t), [nx, ny] = nrm(t), w = wid(t) + 1; icLine(c, '#d4a03a', 2.6, [[x + nx * w, y + ny * w], [x - nx * w, y - ny * w]]); }
        const [ex, ey] = q(1), [nx, ny] = nrm(1); // the bell's mouth
        icEll(c, ex, ey, 11, 4, '#3e2723', 2, Math.atan2(ny, nx)); icEll(c, ex + 0.5, ey, 8, 2.6, '#1a120d', 0, Math.atan2(ny, nx));
        icEll(c, P0[0], P0[1], 2.6, 2.6, '#d4a03a', 1.4); // the mouthpiece
        c.strokeStyle = 'rgba(255, 236, 179, 0.7)'; c.lineWidth = 1.6; c.lineCap = 'round'; // its call
        for (const r of [6, 11]) { c.beginPath(); c.arc(ex + 2, ey - 6, r, -1.4, -0.3); c.stroke(); }
    },
    smelling_salts(c) { // a small stoppered bottle of white crystals, a whiff curling out of it
        icGlow(c, 30, 44, 20, '#b2dfdb', 0.35);
        c.strokeStyle = 'rgba(224, 247, 250, 0.85)'; c.lineWidth = 1.8; c.lineCap = 'round'; // the whiff, behind the cork
        c.beginPath(); c.moveTo(32, 20); c.bezierCurveTo(40, 16, 34, 10, 42, 7); c.bezierCurveTo(48, 5, 50, 10, 55, 6); c.stroke();
        c.lineWidth = 1.3; c.beginPath(); c.moveTo(35, 22); c.bezierCurveTo(44, 22, 42, 15, 50, 14); c.stroke();
        c.beginPath(); c.roundRect(17, 30, 30, 26, 8); icFill(c, 'rgba(178, 223, 219, 0.28)', 2.2);
        c.save(); c.beginPath(); c.roundRect(18.5, 31.5, 27, 23, 7); c.clip(); // the crystals heaped inside
        for (const [x, y, s, col] of [[23, 50, 5, '#ffffff'], [30, 52, 6, '#e0f2f1'], [38, 50, 5.5, '#ffffff'], [26, 44, 4.5, '#eceff1'], [34, 45, 5, '#ffffff'], [41, 44, 4, '#e0f2f1'], [30, 39, 3.5, '#ffffff']]) icPoly(c, [[x, y - s], [x + s * 0.8, y - s * 0.2], [x + s * 0.5, y + s * 0.7], [x - s * 0.6, y + s * 0.6], [x - s * 0.8, y - s * 0.3]], col, 0.8);
        c.restore();
        c.strokeStyle = 'rgba(255, 255, 255, 0.6)'; c.lineWidth = 1.6; c.beginPath(); c.moveTo(21, 36); c.lineTo(21, 48); c.stroke();
        c.beginPath(); c.rect(26, 23, 12, 8); icFill(c, 'rgba(178, 223, 219, 0.4)', 1.8);
        c.beginPath(); c.roundRect(24.5, 16, 15, 8, 2); icFill(c, '#8d6e63', 1.8); // the cork
        c.strokeStyle = 'rgba(62, 39, 35, 0.5)'; c.lineWidth = 1; c.beginPath(); c.moveTo(27, 20); c.lineTo(37, 20); c.stroke();
        icStar(c, 44, 38, 3, '#ffffff');
    },
    map_scrap(c) { // a torn scrap of map: a dotted trail to a red X
        icPoly(c, [[10, 14], [18, 10], [24, 13], [33, 8], [42, 12], [50, 9], [55, 18], [52, 26], [56, 34], [52, 44], [55, 52], [44, 55], [36, 52], [27, 56], [18, 53], [9, 55], [12, 45], [8, 36], [12, 27], [8, 20]], '#e2cd9a', 2.2);
        icPoly(c, [[14, 18], [24, 16], [36, 13], [50, 15], [51, 30], [50, 48], [36, 49], [20, 50], [13, 44], [12, 30]], '#ecdcb2', 0);
        c.strokeStyle = 'rgba(110, 80, 40, 0.55)'; c.lineWidth = 1.2; c.beginPath(); // a river and two little trees
        c.moveTo(14, 28); c.quadraticCurveTo(22, 24, 26, 32); c.quadraticCurveTo(30, 38, 24, 46); c.stroke();
        c.fillStyle = 'rgba(80, 100, 50, 0.6)'; for (const [x, y] of [[40, 20], [46, 24]]) { c.beginPath(); c.moveTo(x, y - 4); c.lineTo(x + 3, y + 2); c.lineTo(x - 3, y + 2); c.fill(); }
        c.strokeStyle = 'rgba(120, 50, 30, 0.75)'; c.lineWidth = 1.4; c.setLineDash([2, 2.5]); c.beginPath(); c.moveTo(16, 48); c.quadraticCurveTo(30, 46, 32, 36); c.quadraticCurveTo(34, 30, 40, 32); c.stroke(); c.setLineDash([]);
        icLine(c, '#c62828', 3.2, [[37, 30], [47, 40]]); icLine(c, '#c62828', 3.2, [[47, 30], [37, 40]]);
    },
};
function cfxGenericGlyph(c) { // an unknown id: a carved rune stone
    icEll(c, 32, 34, 16, 19, '#78909c', 2.2);
    c.strokeStyle = '#263238'; c.lineWidth = 2.4; c.lineCap = 'round'; c.beginPath(); c.moveTo(32, 22); c.lineTo(32, 46); c.moveTo(32, 30); c.lineTo(40, 24); c.moveTo(32, 36); c.lineTo(24, 30); c.stroke();
}
function charmIcon(id) {
    const kind = CFX_WAVE.has(id) ? 'wave' : 'charm', glyph = CHARM_GLYPHS[id] || cfxGenericGlyph;
    return renderIcon('ch:' + id, CFX_TINT[kind], c => { cfxFrame(c, kind); glyph(c); }); // icons.js: cached as a data URL
}

// ---------- in the world ----------
const cfx = { wardMax: 0, lastWards: 0, hitSeen: null, snuff: null, reviveSeen: null };
const CFX_SNUFF = 0.35, CFX_REVIVE = 0.8, CFX_ORBIT = 0.9; // seconds a snuff and a save's flare last; the flames' turn in rad/s

function cfxP(p) { spawnParticle(Object.assign({ vx: 0, vy: 0, drag: 3, grow: 0, spin: 0, rot: 0 }, p)); } // fx.js wants every field
function cfxOrbitR() { return (player.radius || 16) + 17; }
function cfxSlot(i, max) { const a = fxTime * CFX_ORBIT + i * Math.PI * 2 / Math.max(1, max); return a; }

// A candle flame from above: a warm halo, a tongue trailing behind it as it circles, a wax-white heart
function cfxFlame(c, x, y, trail, k, seed) {
    const fl = 1 + 0.14 * Math.sin(fxTime * 17 + seed * 2.3) + 0.08 * Math.sin(fxTime * 29 + seed);
    c.globalCompositeOperation = 'lighter';
    glow(c, x, y, 17 * k * fl, '#ffa040', 0.3); glow(c, x, y, 7 * k, '#fff3d6', 0.55);
    c.globalCompositeOperation = 'source-over';
    c.save(); c.translate(x, y); c.rotate(trail);
    const tongue = (r, L, col) => { c.fillStyle = col; c.beginPath(); c.moveTo(L, 0); c.quadraticCurveTo(r * 0.6, -r, 0, -r); c.arc(0, 0, r, -Math.PI / 2, Math.PI / 2, true); c.quadraticCurveTo(r * 0.6, r, L, 0); c.fill(); };
    tongue(3.4 * k, 9 * k * fl, 'rgba(255, 138, 30, 0.9)');
    tongue(2.3 * k, 5.5 * k * fl, 'rgba(255, 214, 110, 0.95)');
    c.fillStyle = '#fffaf0'; c.beginPath(); c.arc(0, 0, 1.4 * k, 0, Math.PI * 2); c.fill();
    c.restore();
}

function drawCharmWorld() {
    if (typeof charms === 'undefined' || !charms || typeof player === 'undefined' || !player) return;
    const c = ctx, ch = charms, act = ch.active, lift = player.z || 0, px = player.x, py = player.y - lift;
    const candle = !!(act && act.id === 'warding_candle'), n = candle ? Math.max(0, act.wardsLeft | 0) : 0;
    if (candle) cfx.wardMax = Math.max(cfx.wardMax, n);
    c.save();

    // A ward took a hit: the flame that held it goes out (the last one too, even if the charm is already spent)
    if (ch.hitAt != null && ch.hitAt !== cfx.hitSeen) {
        cfx.hitSeen = ch.hitAt;
        const age = fxTime - ch.hitAt;
        if (age >= 0 && age < CFX_SNUFF && (candle || cfx.lastWards > 0)) {
            const a = cfxSlot(n, cfx.wardMax || 1), R = cfxOrbitR(), x = px + Math.cos(a) * R, y = py + Math.sin(a) * R;
            cfx.snuff = { at: ch.hitAt, x: x - px, y: y - py };
            cfxP({ kind: 'ring', color: '#ffe0b2', x, y, size: 4, grow: 90, life: 0.28 });
            burst(x, y, 0, Math.PI * 2, 6, { kind: 'dot', color: '#ffcc80', size: 2, life: 0.3, speed: [40, 120], drag: 5 });
            for (let i = 0; i < 3; i++) cfxP({ kind: 'smoke', color: '#9e9a94', x: x + (Math.random() - 0.5) * 4, y, vx: (Math.random() - 0.5) * 18, vy: -22 - Math.random() * 18, size: 3 + Math.random() * 2, grow: 10, life: 0.8 + Math.random() * 0.4, drag: 1.5 });
        }
    }
    if (!candle) cfx.wardMax = 0;
    cfx.lastWards = n;

    if (n > 0 && player.hp > 0) { // the flames still standing keep their places, so the gap shows the one that went
        const R = cfxOrbitR();
        for (let i = 0; i < n; i++) {
            const a = cfxSlot(i, cfx.wardMax), bob = Math.sin(fxTime * 2.2 + i * 1.7) * 1.5;
            cfxFlame(c, px + Math.cos(a) * R, py + Math.sin(a) * (R + bob), a - Math.PI / 2, 1.15, i);
        }
    }
    if (cfx.snuff) { // the little flash where it went out
        const t = fxTime - cfx.snuff.at;
        if (t < 0 || t >= CFX_SNUFF) cfx.snuff = null;
        else { const k = 1 - t / CFX_SNUFF; c.globalCompositeOperation = 'lighter'; glow(c, px + cfx.snuff.x, py + cfx.snuff.y, 10 + 18 * (1 - k), '#fff3d6', 0.7 * k); c.globalCompositeOperation = 'source-over'; }
    }

    // A save: the Phoenix Feather's wings of flame, or the Smelling Salts' cold jolt
    if (ch.reviveAt != null) {
        const t = fxTime - ch.reviveAt;
        if (t >= 0 && t < CFX_REVIVE) {
            const salts = ch.reviveKind === 'salts';
            if (cfx.reviveSeen !== ch.reviveAt) { cfx.reviveSeen = ch.reviveAt; cfxReviveBurst(px, py, salts); }
            if (salts) cfxSaltsFlare(c, px, py, t / CFX_REVIVE); else cfxPhoenixFlare(c, px, py, t / CFX_REVIVE);
        }
    }
    c.restore();
}

function cfxReviveBurst(x, y, salts) {
    if (salts) {
        cfxP({ kind: 'ring', color: '#e0f7fa', x, y, size: 8, grow: 260, life: 0.3 });
        burst(x, y, 0, Math.PI * 2, 12, { kind: 'spark', color: '#e0f2f1', size: 2, life: 0.3, speed: [160, 320], drag: 6 });
        for (let i = 0; i < 6; i++) cfxP({ kind: 'smoke', color: '#d7efec', x: x + (Math.random() - 0.5) * 20, y: y + (Math.random() - 0.5) * 12, vx: (Math.random() - 0.5) * 30, vy: -30 - Math.random() * 30, size: 5 + Math.random() * 4, grow: 14, life: 0.9 + Math.random() * 0.4, drag: 1.2 });
        for (let i = 0; i < 8; i++) cfxP({ kind: 'dot', color: '#ffffff', x: x + (Math.random() - 0.5) * 26, y: y + (Math.random() - 0.5) * 20, vy: -20 - Math.random() * 40, size: 1.6 + Math.random(), life: 0.6 + Math.random() * 0.3, drag: 1 });
        return;
    }
    cfxP({ kind: 'ring', color: '#ffe082', x, y, size: 10, grow: 230, life: 0.4 });
    burst(x, y, 0, Math.PI * 2, 14, { kind: 'dot', color: '#ffb74d', size: 2.6, life: 0.55, speed: [80, 220], drag: 3 });
    for (let i = 0; i < 14; i++) cfxP({ kind: 'dot', color: i % 2 ? '#ffd54f' : '#ff7043', x: x + (Math.random() - 0.5) * 24, y: y + (Math.random() - 0.5) * 16, vx: (Math.random() - 0.5) * 40, vy: -60 - Math.random() * 90, size: 1.8 + Math.random() * 1.8, life: 0.8 + Math.random() * 0.5, drag: 1 });
}

// Wings of flame spread flat to the hero's sides (seen from above), swept back from where they face, then fade
function cfxPhoenixFlare(c, x, y, k) {
    const face = Math.atan2(mouseY - player.y, mouseX - player.x), fade = Math.pow(1 - k, 1.3), open = easeOut(Math.min(1, k / 0.3));
    c.globalCompositeOperation = 'lighter';
    glow(c, x, y, 40 + 60 * k, '#ff7043', 0.55 * fade);
    glow(c, x, y, 18 + 14 * k, '#fff3c4', 0.6 * fade);
    c.strokeStyle = `rgba(255, 204, 90, ${0.9 * fade})`; c.lineWidth = 3 * (1 - k) + 0.5; c.beginPath(); c.arc(x, y, 18 + 70 * easeOut(k), 0, Math.PI * 2); c.stroke();
    c.save(); c.translate(x, y); c.rotate(face); const s = 1 + 0.25 * k; c.scale(s, s);
    for (const side of [-1, 1]) for (let i = 0; i < 5; i++) {
        const a = side * (Math.PI / 2 + i * 0.22), L = (46 - i * 5) * open, r0 = 9;
        c.save(); c.rotate(a);
        c.fillStyle = i < 2 ? `rgba(255, 213, 79, ${0.75 * fade})` : `rgba(255, 112, 67, ${0.65 * fade})`;
        c.beginPath(); c.moveTo(r0, 0); c.quadraticCurveTo(r0 + L * 0.5, -6.5, r0 + L, 0); c.quadraticCurveTo(r0 + L * 0.5, 6.5, r0, 0); c.fill();
        c.restore();
    }
    c.restore();
    c.globalCompositeOperation = 'source-over';
}

// The salts: a sharp pale ring, a few crystal glints, wisps curling up off the hero
function cfxSaltsFlare(c, x, y, k) {
    const fade = Math.pow(1 - k, 1.2);
    c.globalCompositeOperation = 'lighter';
    glow(c, x, y, 30 + 30 * k, '#b2ebf2', 0.45 * fade);
    c.strokeStyle = `rgba(224, 247, 250, ${0.9 * fade})`; c.lineWidth = 2.2 * (1 - k) + 0.5; c.beginPath(); c.arc(x, y, 14 + 50 * easeOut(Math.min(1, k * 1.6)), 0, Math.PI * 2); c.stroke();
    c.globalCompositeOperation = 'source-over';
    c.strokeStyle = `rgba(232, 248, 245, ${0.6 * fade})`; c.lineWidth = 1.6; c.lineCap = 'round';
    for (let i = 0; i < 3; i++) {
        const ox = (i - 1) * 12, rise = 14 + 40 * k, sw = Math.sin(fxTime * 6 + i * 2) * 5;
        c.beginPath(); c.moveTo(x + ox, y - 4); c.bezierCurveTo(x + ox + 8 + sw, y - 4 - rise * 0.35, x + ox - 8 - sw, y - 4 - rise * 0.7, x + ox + sw * 0.5, y - 4 - rise); c.stroke();
    }
    if (typeof qsStar === 'function') for (let i = 0; i < 4; i++) { const a = i * 1.7 + 0.4, r = 16 + 18 * k; qsStar(c, x + Math.cos(a) * r, y + Math.sin(a) * r * 0.8, 3.5, fade * (0.5 + 0.5 * Math.sin(fxTime * 14 + i * 2))); } // sidequests_fx.js
}

// ---------- screen space: the Map Scrap's X ----------
function cfxXMark() { // a painted red X with a dark edge, baked once
    return qsBake('cfx_x', 26, 26, c => { // sidequests_fx.js
        for (const [w, col] of [[7.5, 'rgba(20, 8, 4, 0.9)'], [4.5, '#d32f2f']]) { c.strokeStyle = col; c.lineWidth = w; c.beginPath(); c.moveTo(-7, -7); c.lineTo(7, 7); c.moveTo(7, -7); c.lineTo(-7, 7); c.stroke(); }
        c.strokeStyle = 'rgba(255, 170, 160, 0.55)'; c.lineWidth = 1.2; c.beginPath(); c.moveTo(-6, -7); c.lineTo(5, 4); c.stroke();
    });
}
function cfxXChip() { // a round parchment plate with the X on it, for the view's edge
    return qsBake('cfx_chip', 34, 34, c => {
        c.beginPath(); c.arc(0, 0, 13.5, 0, Math.PI * 2); c.strokeStyle = 'rgba(8, 5, 3, 0.95)'; c.lineWidth = 5; c.stroke();
        const g = c.createRadialGradient(-4, -5, 1, 0, 1, 17); g.addColorStop(0, '#fbf1d6'); g.addColorStop(0.5, '#e6d3a3'); g.addColorStop(1, '#b8996a');
        c.fillStyle = g; c.beginPath(); c.arc(0, 0, 13.5, 0, Math.PI * 2); c.fill();
        c.strokeStyle = 'rgba(110, 80, 40, 0.5)'; c.lineWidth = 1; c.beginPath(); c.arc(0, 0, 10.5, 0, Math.PI * 2); c.stroke();
        for (const [w, col] of [[5.5, 'rgba(40, 14, 8, 0.85)'], [3.2, '#c62828']]) { c.strokeStyle = col; c.lineWidth = w; c.beginPath(); c.moveTo(-5, -5); c.lineTo(5, 5); c.moveTo(5, -5); c.lineTo(-5, 5); c.stroke(); }
    });
}

function drawCharmScreen() {
    if (typeof charms === 'undefined' || !charms) return;
    const act = charms.active, tg = act && act.id === 'map_scrap' && act.target;
    if (!tg || !isFinite(tg.x) || !isFinite(tg.y)) return;
    if (gameState !== STATE.PLAYING || (stageEvent && stageEvent.blocking)) return;
    const c = ctx, z = camZoom(), W = canvas.width, H = canvas.height, L = 44, R = W - 44, T = 76, B = H - 210; // clear of the plaque and the skill bar
    const sx = (tg.x - camera.x) * z, sy = (tg.y - camera.y) * z, k = 0.5 + 0.5 * Math.sin(fxTime * 3);
    c.save();
    if (sx > 12 && sx < W - 12 && sy > 12 && sy < H - 12) { // in view: the X hovers over the spot
        c.globalCompositeOperation = 'lighter'; glow(c, sx, sy, 22 + 4 * k, '#e53935', 0.18 + 0.1 * k); c.globalCompositeOperation = 'source-over';
        c.fillStyle = 'rgba(10, 4, 2, 0.35)'; c.beginPath(); c.ellipse(sx, sy, 8 - k, 3.2, 0, 0, Math.PI * 2); c.fill();
        qsStamp(c, cfxXMark(), sx, sy - 13 - 4 * k); // sidequests_fx.js
    } else { // off the view: a parchment chip on the edge, an arrow toward it
        const cx = W / 2, cy = H / 2, dx = sx - cx, dy = sy - cy;
        const s = Math.min(dx > 0 ? (R - cx) / dx : dx < 0 ? (L - cx) / dx : 1e9, dy > 0 ? (B - cy) / dy : dy < 0 ? (T - cy) / dy : 1e9);
        const x = cx + dx * s, y = cy + dy * s, a = Math.atan2(dy, dx);
        c.translate(x, y);
        c.globalCompositeOperation = 'lighter'; glow(c, 0, 0, 34, '#e53935', 0.16 + 0.1 * k); c.globalCompositeOperation = 'source-over';
        c.save(); c.rotate(a); c.translate(20 + 2.5 * k, 0); c.fillStyle = '#e6d3a3'; c.strokeStyle = '#0b0705'; c.lineWidth = 2; c.beginPath(); c.moveTo(7, 0); c.lineTo(-2, -6.5); c.lineTo(-2, 6.5); c.closePath(); c.stroke(); c.fill(); c.restore();
        qsStamp(c, cfxXChip(), 0, 0);
    }
    c.restore();
}
