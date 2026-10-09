// ==========================================
// menu.js - Start menu: parchment dungeon map, class carousel
// ==========================================

const GAME_TITLE = 'Endless Progression';
const MAP_W = 1000, MAP_H = 625; // logical map space; the canvas scales it to fit the window

// Unlocked ids must match a dungeon key in enemies.json; locked ones are placeholders for future dungeons.
const MAP_SITES = [
    { id: 'slime_caves', name: 'Slime Caves', levels: 'Lv. 1-10', color: '#558b2f', x: 250, y: 360, icon: 'cave', numeral: 'I',
      desc: 'A damp cave filled with highly regenerative oozes and toxic sludges.', bosses: 'The Slime King, The Hive Queen' },
    { id: 'bandit_bastion', name: 'Bandit Bastion', levels: 'Lv. 5-15', color: '#9c3d1e', x: 690, y: 378, icon: 'fort', numeral: 'II',
      desc: 'A fortified encampment. Enemies use shields, traps, and tactical formations.', bosses: 'The Beastmaster, Valerius the Vanguard' },
    { id: 'frostpeak', name: 'Frostpeak Hollow', x: 505, y: 172, icon: 'spire', locked: true },
    { id: 'ember_forge', name: 'Ember Forge', x: 822, y: 262, icon: 'volcano', locked: true },
    { id: 'sunken_crypt', name: 'Sunken Crypt', x: 420, y: 498, icon: 'crypt', locked: true },
];
const MAP_ROUTES = [['slime_caves', 'bandit_bastion', 1], ['slime_caves', 'frostpeak', -1], ['bandit_bastion', 'ember_forge', -1], ['bandit_bastion', 'sunken_crypt', 1]];

const INK = '#3b2814', PARCH = '#ead8ae', PARCH_LIGHT = '#f3e6c4';
const LAND = { cx: 500, cy: 338, rx: 425, ry: 240 };
const SERIF = "Georgia, 'Palatino Linotype', 'Book Antiqua', serif";

let mapScale = 1, mapCache = null, mapHover = null, mapPixel = 1;

function mapRng(seed) { // deterministic, so the map looks the same every visit
    return () => { seed = (seed + 0x6D2B79F5) | 0; let t = Math.imul(seed ^ seed >>> 15, 1 | seed); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };
}
const siteById = id => MAP_SITES.find(s => s.id === id);

// Coastline as a wobbly radius around an ellipse; `grow` pushes it outward for the ripple rings
const angDist = (a, b) => Math.atan2(Math.sin(a - b), Math.cos(a - b));
function landR(a) {
    return 1 + 0.05 * Math.sin(3 * a + 0.7) + 0.035 * Math.sin(5 * a + 2.1) + 0.03 * Math.sin(7 * a + 5.2) + 0.022 * Math.sin(9 * a + 4.0)
        + 0.016 * Math.sin(13 * a + 0.4) + 0.011 * Math.sin(17 * a + 1.3) + 0.007 * Math.sin(23 * a + 2.6) + 0.005 * Math.sin(31 * a)
        + 0.07 * Math.exp(-(angDist(a, -0.4) ** 2) / 0.04) + 0.11 * Math.exp(-(angDist(a, 2.55) ** 2) / 0.02) - 0.09 * Math.exp(-(angDist(a, -1.95) ** 2) / 0.008); // east bulge, SW headland, north bay
}
function landPath(c, grow, append) { // append: add to the current path instead of starting a new one
    if (!append) c.beginPath();
    for (let i = 0; i <= 400; i++) {
        const a = i / 400 * Math.PI * 2, r = landR(a);
        const x = LAND.cx + Math.cos(a) * (LAND.rx * r + grow), y = LAND.cy + Math.sin(a) * (LAND.ry * r + grow);
        i ? c.lineTo(x, y) : c.moveTo(x, y);
    }
    c.closePath();
}
function onLand(x, y, margin) {
    const dx = (x - LAND.cx) / LAND.rx, dy = (y - LAND.cy) / LAND.ry;
    return Math.hypot(dx, dy) < landR(Math.atan2(dy, dx)) - margin / LAND.ry;
}
function islandPath(c, x, y, r, seed) {
    c.beginPath();
    for (let i = 0; i <= 40; i++) { const a = i / 40 * Math.PI * 2, rr = r * (1 + 0.18 * Math.sin(3 * a + seed) + 0.08 * Math.sin(7 * a + seed * 2)); i ? c.lineTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr * 0.7) : c.moveTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr * 0.7); }
    c.closePath();
}
const ISLANDS = [[78, 470, 20, 1], [930, 120, 16, 4], [868, 560, 11, 2]];

// River from the mountains down to the south coast
const RIVER = [[560, 222], [640, 300], [470, 430], [590, 612]];
function riverPoint(t) {
    const [a, b, c2, d] = RIVER, u = 1 - t;
    return [u * u * u * a[0] + 3 * u * u * t * b[0] + 3 * u * t * t * c2[0] + t * t * t * d[0], u * u * u * a[1] + 3 * u * u * t * b[1] + 3 * u * t * t * c2[1] + t * t * t * d[1]];
}
function nearRiver(x, y, r) { for (let t = 0; t <= 1; t += 0.02) { const [px, py] = riverPoint(t); if (Math.hypot(px - x, py - y) < r) return true; } return false; }
function nearSite(x, y, r) { return MAP_SITES.some(s => Math.hypot(s.x - x, (s.y + 8) - y) < r); }
function nearRoute(x, y, r) {
    for (const [a, b, bend] of MAP_ROUTES) for (let t = 0; t <= 1; t += 0.04) { const [px, py] = routePoint(siteById(a), siteById(b), bend, t); if (Math.hypot(px - x, py - y) < r) return true; }
    return false;
}
function routeCtrl(a, b, bend) { const mx = (a.x + b.x) / 2, my = (a.y + b.y) / 2, dx = b.x - a.x, dy = b.y - a.y; return [mx - dy * 0.16 * bend, my + dx * 0.16 * bend]; }
function routePoint(a, b, bend, t) { const [cx, cy] = routeCtrl(a, b, bend), u = 1 - t; return [u * u * a.x + 2 * u * t * cx + t * t * b.x, u * u * a.y + 2 * u * t * cy + t * t * b.y]; }

// ---------- terrain icons (classic cartographer's ink style) ----------

function drawMountain(c, x, y, w, h, snow) {
    const px = x - w * 0.1, py = y - h;
    c.beginPath(); c.moveTo(x - w, y); c.lineTo(px, py); c.lineTo(x + w, y); c.closePath();
    c.fillStyle = PARCH_LIGHT; c.fill();
    c.save(); c.clip();
    c.beginPath(); c.moveTo(px, py); c.lineTo(x + w, y); c.lineTo(x + w * 0.12, y); c.closePath();
    c.fillStyle = 'rgba(110,75,40,0.2)'; c.fill();
    c.strokeStyle = 'rgba(59,40,20,0.5)'; c.lineWidth = 0.8; c.beginPath(); // hatching on the shadow face
    for (let i = -h; i < w * 2; i += 3.4) { c.moveTo(x - w * 0.1 + i, py - 2); c.lineTo(x - w * 0.1 + i - h * 0.55, y + 2); }
    c.stroke();
    if (snow) { c.beginPath(); c.moveTo(px - w * 0.4, py + h * 0.36); c.lineTo(px, py); c.lineTo(px + w * 0.42, py + h * 0.34); c.lineTo(px + w * 0.15, py + h * 0.28); c.lineTo(px - w * 0.1, py + h * 0.4); c.closePath(); c.fillStyle = 'rgba(250,250,255,0.85)'; c.fill(); }
    c.restore();
    c.strokeStyle = INK; c.lineWidth = 1.5; c.lineJoin = 'round';
    c.beginPath(); c.moveTo(x - w, y); c.lineTo(px, py); c.lineTo(x + w, y); c.stroke();
    c.lineWidth = 0.9; c.beginPath(); c.moveTo(px, py); c.quadraticCurveTo(px + w * 0.05, y - h * 0.4, x + w * 0.12, y); c.stroke();
}
function drawTree(c, x, y, s, pine) {
    c.strokeStyle = INK; c.lineWidth = 1;
    c.beginPath(); c.moveTo(x, y); c.lineTo(x, y - s * 0.6); c.stroke();
    if (pine) {
        c.beginPath(); c.moveTo(x - s * 0.45, y - s * 0.35); c.lineTo(x, y - s * 1.5); c.lineTo(x + s * 0.45, y - s * 0.35); c.closePath();
        c.fillStyle = 'rgba(70,92,52,0.55)'; c.fill(); c.stroke();
    } else {
        c.beginPath(); c.arc(x - s * 0.22, y - s * 0.8, s * 0.36, 0, Math.PI * 2); c.arc(x + s * 0.22, y - s * 0.82, s * 0.34, 0, Math.PI * 2); c.arc(x, y - s * 1.1, s * 0.38, 0, Math.PI * 2);
        c.fillStyle = 'rgba(88,110,58,0.5)'; c.fill();
        c.beginPath(); c.arc(x - s * 0.22, y - s * 0.8, s * 0.36, Math.PI * 0.5, Math.PI * 1.25); c.arc(x, y - s * 1.1, s * 0.38, Math.PI * 1.05, Math.PI * 1.95); c.arc(x + s * 0.22, y - s * 0.82, s * 0.34, Math.PI * 1.7, Math.PI * 2.5); c.stroke();
    }
}
function drawHill(c, x, y, w) {
    c.strokeStyle = INK; c.lineWidth = 1.2;
    c.beginPath(); c.moveTo(x - w, y); c.quadraticCurveTo(x, y - w * 0.9, x + w, y); c.stroke();
    c.lineWidth = 0.7; c.beginPath();
    for (let i = 0; i < 3; i++) { const hx = x + w * (0.15 + i * 0.22); c.moveTo(hx, y - w * 0.32 + i * 0.12 * w); c.lineTo(hx - 3, y - 1); }
    c.stroke();
}
function drawTuft(c, x, y) {
    c.strokeStyle = 'rgba(59,40,20,0.7)'; c.lineWidth = 0.9; c.beginPath();
    c.moveTo(x - 4, y - 5); c.lineTo(x - 1, y); c.moveTo(x, y - 7); c.lineTo(x, y); c.moveTo(x + 4, y - 5); c.lineTo(x + 1, y);
    c.moveTo(x - 7, y + 3); c.lineTo(x - 2, y + 3); c.moveTo(x + 3, y + 3); c.lineTo(x + 8, y + 3); c.stroke();
}
function drawWave(c, x, y) {
    c.beginPath(); c.arc(x - 4, y, 4, Math.PI * 1.1, Math.PI * 1.9); c.arc(x + 4, y, 4, Math.PI * 1.1, Math.PI * 1.9); c.stroke();
}
function drawCompass(c, x, y, r) {
    c.save(); c.translate(x, y);
    c.strokeStyle = INK; c.lineWidth = 1.2;
    c.beginPath(); c.arc(0, 0, r * 0.62, 0, Math.PI * 2); c.stroke();
    c.lineWidth = 0.6; c.beginPath(); c.arc(0, 0, r * 0.55, 0, Math.PI * 2); c.stroke();
    for (let i = 0; i < 8; i++) { // long cardinal points, short diagonals; each split light/dark
        const a = i * Math.PI / 4 - Math.PI / 2, L = i % 2 ? r * 0.55 : r, W = i % 2 ? r * 0.1 : r * 0.16;
        const tx = Math.cos(a) * L, ty = Math.sin(a) * L, nx = Math.cos(a + Math.PI / 2) * W, ny = Math.sin(a + Math.PI / 2) * W;
        c.beginPath(); c.moveTo(0, 0); c.lineTo(tx, ty); c.lineTo(nx, ny); c.closePath(); c.fillStyle = PARCH_LIGHT; c.fill(); c.stroke();
        c.beginPath(); c.moveTo(0, 0); c.lineTo(tx, ty); c.lineTo(-nx, -ny); c.closePath(); c.fillStyle = i === 0 ? '#8b2a17' : INK; c.fill(); c.stroke();
    }
    c.fillStyle = INK; c.font = `bold ${r * 0.34}px ${SERIF}`; c.textAlign = 'center'; c.textBaseline = 'bottom';
    c.fillText('N', 0, -r - 2);
    c.restore();
}
function mapLabel(c, text, x, y, size, opts = {}) {
    c.save();
    c.font = `${opts.italic ? 'italic ' : ''}${opts.bold ? 'bold ' : ''}${size}px ${SERIF}`;
    c.textAlign = 'center'; c.textBaseline = 'middle';
    if ('letterSpacing' in c) c.letterSpacing = (opts.spacing || 0) + 'px';
    c.globalAlpha = opts.alpha ?? 1;
    c.lineJoin = 'round'; c.lineWidth = opts.halo ?? 4; c.strokeStyle = 'rgba(240,226,192,0.9)'; c.strokeText(text, x, y);
    c.fillStyle = opts.color || INK; c.fillText(text, x, y);
    c.restore();
}

// ---------- static layer: everything that never moves, rendered once per resize ----------

function buildMapCache(pw, ph) {
    const cv = document.createElement('canvas'); cv.width = pw; cv.height = ph;
    const c = cv.getContext('2d'); c.scale(pw / MAP_W, ph / MAP_H);
    const rnd = mapRng(1337);

    // Torn sheet edge: everything is clipped inside it
    const edge = [];
    for (let i = 0; i < 160; i++) {
        const t = i / 160, side = Math.floor(t * 4), f = t * 4 - side, j = 3 + rnd() * 6;
        edge.push(side === 0 ? [f * MAP_W, j] : side === 1 ? [MAP_W - j, f * MAP_H] : side === 2 ? [MAP_W - f * MAP_W, MAP_H - j] : [j, MAP_H - f * MAP_H]);
    }
    const edgePath = () => { c.beginPath(); edge.forEach(([x, y], i) => i ? c.lineTo(x, y) : c.moveTo(x, y)); c.closePath(); };
    c.save(); edgePath(); c.clip();

    // Parchment: warm base, lighter middle, fibers and old stains
    c.fillStyle = PARCH; c.fillRect(0, 0, MAP_W, MAP_H);
    let g = c.createRadialGradient(MAP_W / 2, MAP_H / 2, 50, MAP_W / 2, MAP_H / 2, 560);
    g.addColorStop(0, 'rgba(250,240,212,0.7)'); g.addColorStop(1, 'rgba(250,240,212,0)');
    c.fillStyle = g; c.fillRect(0, 0, MAP_W, MAP_H);
    for (let i = 0; i < 14; i++) {
        const x = rnd() * MAP_W, y = rnd() * MAP_H, r = 30 + rnd() * 110;
        g = c.createRadialGradient(x, y, r * 0.2, x, y, r); g.addColorStop(0, 'rgba(150,105,50,0.07)'); g.addColorStop(0.85, 'rgba(150,105,50,0.04)'); g.addColorStop(1, 'rgba(150,105,50,0)');
        c.fillStyle = g; c.fillRect(x - r, y - r, r * 2, r * 2);
    }
    for (let i = 0; i < 2600; i++) { c.fillStyle = `rgba(100,70,35,${0.03 + rnd() * 0.08})`; c.fillRect(rnd() * MAP_W, rnd() * MAP_H, 1 + rnd() * 1.5, 0.6 + rnd()); }

    // Sea: a cool tint outside the coast, waves, and ripple rings hugging the shore
    c.save(); c.beginPath(); c.rect(0, 0, MAP_W, MAP_H); landPath(c, 0, true); c.fillStyle = 'rgba(80,120,135,0.26)'; c.fill('evenodd'); c.restore();
    c.strokeStyle = 'rgba(59,40,20,0.35)'; c.lineWidth = 1;
    for (const [d, a] of [[7, 0.4], [15, 0.26], [25, 0.14]]) { c.save(); c.setLineDash([5 + d * 0.3, 4]); c.globalAlpha = a; landPath(c, d); c.stroke(); c.restore(); }
    c.strokeStyle = 'rgba(59,40,20,0.4)'; c.lineWidth = 0.9;
    for (let i = 0, n = 0; i < 400 && n < 34; i++) {
        const x = 20 + rnd() * (MAP_W - 40), y = 20 + rnd() * (MAP_H - 40);
        if (onLand(x, y, -45) || (y < 95 && Math.abs(x - 500) < 250) || Math.hypot(x - 905, y - 525) < 75 || ISLANDS.some(([ix, iy, ir]) => Math.hypot(x - ix, y - iy) < ir + 22)) continue;
        drawWave(c, x, y); n++;
    }

    // Land: slightly lighter, darker toward the shore, inked coast
    c.save(); landPath(c, 0); c.clip();
    c.fillStyle = 'rgba(248,236,206,0.35)'; c.fillRect(0, 0, MAP_W, MAP_H);
    c.strokeStyle = 'rgba(120,85,40,0.16)'; c.lineWidth = 16; landPath(c, 0); c.stroke();
    c.restore();
    c.strokeStyle = INK; c.lineWidth = 2.2; c.lineJoin = 'round'; landPath(c, 0); c.stroke();
    ISLANDS.forEach(([x, y, r, s]) => {
        c.strokeStyle = 'rgba(59,40,20,0.3)'; c.lineWidth = 1; c.setLineDash([4, 3]); islandPath(c, x, y, r + 6, s); c.stroke(); c.setLineDash([]);
        islandPath(c, x, y, r, s); c.fillStyle = 'rgba(248,236,206,0.6)'; c.fill(); c.strokeStyle = INK; c.lineWidth = 1.6; c.stroke();
    });

    // River, tapering as it flows toward the sea
    const seg = 60;
    for (const pass of [0, 1]) {
        for (let i = 0; i < seg; i++) {
            const t0 = i / seg, t1 = (i + 1) / seg, [x0, y0] = riverPoint(t0), [x1, y1] = riverPoint(t1), w = 2.4 + 5.5 * t0;
            c.strokeStyle = pass ? '#93b1b0' : INK; c.lineWidth = pass ? Math.max(0.6, w - 2.4) : w; c.lineCap = 'round';
            c.beginPath(); c.moveTo(x0, y0); c.lineTo(x1, y1); c.stroke();
        }
    }

    // Terrain: scattered with a little rejection so icons don't pile on sites, routes or the river
    const labels = [[210, 252, 70, 12], [355, 128, 62, 12]], underLabel = (x, y) => labels.some(([lx, ly, hw, hh]) => Math.abs(x - lx) < hw && y > ly - hh && y < ly + hh + 22);
    const items = [], free = (x, y, r) => onLand(x, y, 22) && !underLabel(x, y) && !nearSite(x, y, 58) && !nearRiver(x, y, 13) && !nearRoute(x, y, 11) && !items.some(it => Math.hypot(it.x - x, it.y - y) < r);
    for (let i = 0; i < 260; i++) { // Greyspine mountains along the north
        const t = rnd(), x = 330 + t * 380, y = 150 + Math.sin(t * Math.PI * 2.3) * 18 + rnd() * 52;
        if (Math.hypot(x - 505, y - 172) < 70 && rnd() < 0.6) continue;
        if (free(x, y, 30)) items.push({ k: 'mtn', x, y, w: 14 + rnd() * 12, h: 22 + rnd() * 20, snow: y < 185 });
    }
    for (let i = 0; i < 900; i++) { // Mirewood: dense round trees in the west
        const x = 110 + rnd() * 270, y = 230 + rnd() * 250;
        if (Math.hypot((x - 245) / 135, (y - 355) / 125) > 1) continue;
        if (free(x, y, 13)) items.push({ k: 'tree', x, y, s: 9 + rnd() * 4 });
    }
    for (let i = 0; i < 300; i++) { // pines on the mountain foothills
        const x = 300 + rnd() * 460, y = 215 + rnd() * 70;
        if (free(x, y, 14) && rnd() < 0.5) items.push({ k: 'pine', x, y, s: 8 + rnd() * 3 });
    }
    for (let i = 0; i < 200; i++) { // rolling hills on the eastern plains around the bastion
        const x = 590 + rnd() * 250, y = 310 + rnd() * 200;
        if (free(x, y, 34) && rnd() < 0.5) items.push({ k: 'hill', x, y, w: 10 + rnd() * 8 });
    }
    for (let i = 0; i < 160; i++) { // Ashen Reach: jagged dark peaks near the volcano
        const x = 740 + rnd() * 160, y = 190 + rnd() * 130;
        if (free(x, y, 28)) items.push({ k: 'mtn', x, y, w: 9 + rnd() * 7, h: 14 + rnd() * 12 });
    }
    for (let i = 0; i < 300; i++) { // marsh around the sunken crypt
        const x = 320 + rnd() * 220, y = 450 + rnd() * 110;
        if (Math.hypot((x - 420) / 115, (y - 505) / 60) > 1) continue;
        if (onLand(x, y, 12) && !nearSite(x, y, 42) && !nearRiver(x, y, 10) && !nearRoute(x, y, 9) && !items.some(it => Math.hypot(it.x - x, it.y - y) < 16)) items.push({ k: 'tuft', x, y });
    }
    for (let i = 0; i < 500; i++) { // a few lone trees and knolls so the open middle isn't empty
        const x = 100 + rnd() * 800, y = 120 + rnd() * 440;
        if (rnd() < 0.85 || !free(x, y, 40)) continue;
        items.push(rnd() < 0.6 ? { k: 'tree', x, y, s: 8 + rnd() * 3 } : { k: 'hill', x, y, w: 9 + rnd() * 6 });
    }
    items.sort((a, b) => a.y - b.y);
    for (const it of items) {
        if (it.k === 'mtn') drawMountain(c, it.x, it.y, it.w, it.h, it.snow);
        else if (it.k === 'tree') drawTree(c, it.x, it.y, it.s, false);
        else if (it.k === 'pine') drawTree(c, it.x, it.y, it.s, true);
        else if (it.k === 'hill') drawHill(c, it.x, it.y, it.w);
        else drawTuft(c, it.x, it.y);
    }

    // Region names
    mapLabel(c, 'M I R E W O O D', 210, 252, 15, { italic: true, color: '#4d5a2e', alpha: 0.85 });
    mapLabel(c, 'The Greyspine', 355, 128, 15, { italic: true, alpha: 0.8 });
    mapLabel(c, 'The Endless Sea', 155, 585, 17, { italic: true, color: '#3e5a60', alpha: 0.7, spacing: 2 });
    drawCompass(c, 905, 525, 44);

    // Title ribbon across the top
    c.save(); c.translate(MAP_W / 2, 50);
    const bw = 230, bh = 26;
    for (const s of [-1, 1]) { // folded ribbon tails
        c.beginPath(); c.moveTo(s * (bw - 14), -bh * 0.3); c.lineTo(s * (bw + 34), -bh * 0.3); c.lineTo(s * (bw + 20), bh * 0.35); c.lineTo(s * (bw + 34), bh); c.lineTo(s * (bw - 14), bh); c.closePath();
        c.fillStyle = '#7a2414'; c.fill(); c.strokeStyle = INK; c.lineWidth = 1.4; c.stroke();
    }
    c.beginPath(); c.moveTo(-bw, -bh); c.quadraticCurveTo(0, -bh - 10, bw, -bh); c.lineTo(bw, bh * 0.7); c.quadraticCurveTo(0, bh * 0.7 - 10, -bw, bh * 0.7); c.closePath();
    g = c.createLinearGradient(0, -bh, 0, bh); g.addColorStop(0, '#b23a22'); g.addColorStop(1, '#8a2a17');
    c.fillStyle = g; c.fill(); c.strokeStyle = INK; c.lineWidth = 1.8; c.stroke();
    c.strokeStyle = 'rgba(255,215,160,0.35)'; c.lineWidth = 1; c.setLineDash([3, 3]);
    c.beginPath(); c.moveTo(-bw + 8, -bh + 2); c.quadraticCurveTo(0, -bh - 7, bw - 8, -bh + 2); c.moveTo(-bw + 8, bh * 0.7 - 4); c.quadraticCurveTo(0, bh * 0.7 - 13, bw - 8, bh * 0.7 - 4); c.stroke(); c.setLineDash([]);
    c.font = `bold 26px ${SERIF}`; c.textAlign = 'center'; c.textBaseline = 'middle';
    if ('letterSpacing' in c) c.letterSpacing = '4px';
    c.fillStyle = 'rgba(40,10,5,0.5)'; c.fillText(GAME_TITLE.toUpperCase(), 1, -6);
    c.fillStyle = '#f6e3b8'; c.fillText(GAME_TITLE.toUpperCase(), 0, -7);
    c.restore();
    mapLabel(c, 'Choose your destination', MAP_W / 2, 88, 15, { italic: true, color: '#5a3d1e' });

    // Age the edges: dark vignette, then a scorched rim along the torn edge
    g = c.createRadialGradient(MAP_W / 2, MAP_H / 2, MAP_H * 0.45, MAP_W / 2, MAP_H / 2, MAP_W * 0.62);
    g.addColorStop(0, 'rgba(110,70,25,0)'); g.addColorStop(1, 'rgba(95,55,18,0.55)');
    c.fillStyle = g; c.fillRect(0, 0, MAP_W, MAP_H);
    c.strokeStyle = 'rgba(70,35,10,0.35)'; c.lineWidth = 16; edgePath(); c.stroke();
    c.restore();
    c.strokeStyle = '#4a2a0e'; c.lineWidth = 2.5; edgePath(); c.stroke();
    return cv;
}

// ---------- dungeon sites (drawn every frame so they can animate) ----------

function drawSiteIcon(c, s, t) {
    c.strokeStyle = INK; c.lineWidth = 1.5; c.lineJoin = 'round';
    if (s.icon === 'cave') {
        c.beginPath(); c.moveTo(-38, 8); c.quadraticCurveTo(-41, -8, -28, -14); c.quadraticCurveTo(-26, -30, -10, -29); c.quadraticCurveTo(-2, -41, 10, -31);
        c.quadraticCurveTo(26, -34, 27, -19); c.quadraticCurveTo(41, -14, 38, 8); c.closePath();
        c.fillStyle = '#e4d3ac'; c.fill(); c.stroke();
        c.lineWidth = 0.9; c.beginPath(); // cracks between the boulders
        c.moveTo(-28, -14); c.lineTo(-22, -6); c.moveTo(-10, -29); c.lineTo(-12, -20); c.moveTo(10, -31); c.lineTo(12, -22); c.moveTo(27, -19); c.lineTo(20, -10); c.stroke(); c.lineWidth = 1.5;
        c.save(); c.clip(); c.strokeStyle = 'rgba(59,40,20,0.45)'; c.lineWidth = 0.8; c.beginPath();
        for (let i = 0; i < 40; i += 3.4) { c.moveTo(12 + i, -34); c.lineTo(i - 4, 10); } c.stroke(); c.restore();
        c.beginPath(); c.moveTo(-14, 8); c.bezierCurveTo(-14, -17, 14, -17, 14, 8); c.closePath(); c.fillStyle = '#24170c'; c.fill(); c.stroke();
        const blink = (t % 3.2) < 0.12 ? 0.2 : 1; // something is watching from inside
        c.fillStyle = '#b6e35a'; c.fillRect(-6, -3, 3, 2.2 * blink); c.fillRect(3, -3, 3, 2.2 * blink);
        c.fillStyle = '#7cb342'; c.strokeStyle = '#33521a'; c.lineWidth = 1; // slime oozing over the lip and pooling
        c.beginPath(); c.ellipse(1, 9, 21, 4.5, 0, 0, Math.PI * 2); c.fill(); c.stroke();
        for (let i = 0; i < 3; i++) {
            const dx = -8 + i * 8, len = 4 + 3 * (0.5 + 0.5 * Math.sin(t * 1.6 + i * 2.1));
            c.beginPath(); c.moveTo(dx - 2.5, -9 + Math.abs(dx) * 0.25); c.lineTo(dx - 1.5, -9 + len); c.arc(dx, -9 + len, 1.8, Math.PI, 0, true); c.lineTo(dx + 2.5, -9 + Math.abs(dx) * 0.25); c.fill();
        }
    } else if (s.icon === 'fort') {
        const flag = Math.sin(t * 3);
        c.beginPath(); c.moveTo(0, -12); c.lineTo(0, -44); c.stroke(); // banner pole above the gate
        c.beginPath(); c.moveTo(0, -44); c.quadraticCurveTo(9, -46 + flag * 2, 18, -42 + flag * 1.5); c.lineTo(17, -34 + flag); c.quadraticCurveTo(9, -37 - flag * 2, 0, -35); c.closePath();
        c.fillStyle = '#a3301c'; c.fill(); c.lineWidth = 1; c.stroke(); c.lineWidth = 1.5;
        for (let i = 0; i < 11; i++) { // palisade stakes
            const x = -32 + i * 6.4, h = 20 + ((i * 7) % 3) * 2;
            c.beginPath(); c.moveTo(x - 3, 10); c.lineTo(x - 3, 10 - h); c.lineTo(x, 10 - h - 5); c.lineTo(x + 3, 10 - h); c.lineTo(x + 3, 10); c.closePath();
            c.fillStyle = i % 2 ? '#c49a62' : '#b88c55'; c.fill(); c.lineWidth = 1; c.stroke();
        }
        c.beginPath(); c.moveTo(-7, 10); c.lineTo(-7, -2); c.quadraticCurveTo(0, -9, 7, -2); c.lineTo(7, 10); c.closePath(); c.fillStyle = '#24170c'; c.fill(); c.stroke();
        for (const tx of [-38, 38]) { // watchtowers
            c.fillStyle = '#d0a970'; c.fillRect(tx - 7, -24, 14, 34); c.strokeRect(tx - 7, -24, 14, 34);
            c.beginPath(); c.moveTo(tx - 10, -24); c.lineTo(tx, -36); c.lineTo(tx + 10, -24); c.closePath(); c.fillStyle = '#8a4a2a'; c.fill(); c.stroke();
            c.fillStyle = '#24170c'; c.fillRect(tx - 2, -18, 4, 6);
        }
    } else if (s.icon === 'spire') {
        drawMountain(c, -22, 6, 20, 30, true); drawMountain(c, 22, 6, 18, 26, true);
        drawMountain(c, 0, 10, 24, 52, true);
        c.fillStyle = '#24170c'; c.beginPath(); c.moveTo(-5, 10); c.lineTo(-5, 2); c.quadraticCurveTo(0, -4, 5, 2); c.lineTo(5, 10); c.fill();
    } else if (s.icon === 'volcano') {
        c.beginPath(); c.moveTo(-38, 10); c.lineTo(-11, -26); c.lineTo(11, -26); c.lineTo(38, 10); c.closePath(); c.fillStyle = '#d9c4a0'; c.fill(); c.stroke();
        c.save(); c.clip(); c.strokeStyle = 'rgba(59,40,20,0.5)'; c.lineWidth = 0.8; c.beginPath();
        for (let i = 0; i < 40; i += 3.4) { c.moveTo(4 + i, -28); c.lineTo(i - 16, 12); } c.stroke(); c.restore();
        c.strokeStyle = '#c0501e'; c.lineWidth = 2; c.beginPath(); c.moveTo(-2, -25); c.quadraticCurveTo(-6, -10, 2, 8); c.stroke();
        c.strokeStyle = INK; c.lineWidth = 1.5; c.beginPath(); c.ellipse(0, -26, 11, 3, 0, 0, Math.PI * 2); c.fillStyle = '#5a2a14'; c.fill(); c.stroke();
        for (let i = 0; i < 3; i++) { // smoke curls rising and fading
            const p = (t * 0.25 + i / 3) % 1;
            c.fillStyle = `rgba(90,80,70,${0.5 * (1 - p)})`; c.beginPath(); c.arc(Math.sin(p * 5 + i) * 6, -32 - p * 34, 4 + p * 7, 0, Math.PI * 2); c.fill();
        }
    } else if (s.icon === 'crypt') {
        c.fillStyle = '#d6c6a4';
        c.beginPath(); c.moveTo(-24, -14); c.lineTo(0, -32); c.lineTo(24, -14); c.closePath(); c.fill(); c.stroke();
        c.fillRect(-22, -14, 44, 24); c.strokeRect(-22, -14, 44, 24);
        for (const cx of [-16, 16]) { c.beginPath(); c.moveTo(cx, -12); c.lineTo(cx, 8); c.stroke(); }
        c.beginPath(); c.moveTo(-7, 10); c.lineTo(-7, -3); c.quadraticCurveTo(0, -10, 7, -3); c.lineTo(7, 10); c.closePath(); c.fillStyle = '#24170c'; c.fill();
        c.strokeStyle = 'rgba(70,100,110,0.8)'; c.lineWidth = 1.2; c.beginPath(); // flooded base
        for (let i = -1; i <= 1; i++) { c.moveTo(-30 + i * 4, 14 + Math.abs(i) * 4); c.lineTo(-14 + i * 4, 14 + Math.abs(i) * 4); c.moveTo(14 - i * 4, 14 + Math.abs(i) * 4); c.lineTo(30 - i * 4, 14 + Math.abs(i) * 4); }
        c.stroke();
    }
}
function drawSeal(c, x, y, r, col, s) {
    c.save(); c.translate(x, y);
    c.beginPath(); // blobby wax edge
    for (let i = 0; i <= 24; i++) { const a = i / 24 * Math.PI * 2, rr = r * (1 + 0.09 * Math.sin(a * 5 + s.x) + 0.05 * Math.sin(a * 9 + s.y)); i ? c.lineTo(Math.cos(a) * rr, Math.sin(a) * rr) : c.moveTo(Math.cos(a) * rr, Math.sin(a) * rr); }
    c.closePath();
    c.shadowColor = 'rgba(40,20,5,0.45)'; c.shadowBlur = 4; c.shadowOffsetY = 2;
    c.fillStyle = col; c.fill(); c.shadowColor = 'transparent';
    c.strokeStyle = 'rgba(0,0,0,0.3)'; c.lineWidth = 1.4; c.beginPath(); c.arc(0, 0, r * 0.7, 0, Math.PI * 2); c.stroke();
    c.strokeStyle = 'rgba(255,255,255,0.28)'; c.lineWidth = 1.2; c.beginPath(); c.arc(0, 0, r * 0.82, Math.PI * 1.05, Math.PI * 1.6); c.stroke();
    if (s.locked) { // padlock
        c.strokeStyle = 'rgba(245,235,215,0.85)'; c.lineWidth = 1.6; c.beginPath(); c.arc(0, -2, r * 0.26, Math.PI, 0); c.stroke();
        c.fillStyle = 'rgba(245,235,215,0.85)'; c.fillRect(-r * 0.36, -2, r * 0.72, r * 0.5);
    } else {
        c.font = `bold ${Math.round(r * 0.8)}px ${SERIF}`; c.textAlign = 'center'; c.textBaseline = 'middle';
        c.fillStyle = 'rgba(0,0,0,0.35)'; c.fillText(s.numeral, 0.8, 1.8);
        c.fillStyle = 'rgba(255,238,215,0.9)'; c.fillText(s.numeral, 0, 1);
    }
    c.restore();
}
function drawFog(c, s, t) { // drifting clouds hide uncharted places
    for (let i = 0; i < 6; i++) {
        const a = i * 1.7 + t * 0.12 * (i % 2 ? 1 : -1), r = 22 + (i % 3) * 7;
        const x = s.x + Math.cos(a) * (14 + i * 4), y = s.y - 8 + Math.sin(a * 1.3) * 12;
        const g = c.createRadialGradient(x, y, 0, x, y, r);
        g.addColorStop(0, 'rgba(244,236,214,0.55)'); g.addColorStop(1, 'rgba(244,236,214,0)');
        c.fillStyle = g; c.beginPath(); c.arc(x, y, r, 0, Math.PI * 2); c.fill();
    }
}

function drawMapFrame(t) {
    const cv = el('map-canvas'), c = cv.getContext('2d');
    if (!mapCache || mapCache.width !== cv.width) mapCache = buildMapCache(cv.width, cv.height);
    c.setTransform(1, 0, 0, 1, 0, 0); c.clearRect(0, 0, cv.width, cv.height);
    c.drawImage(mapCache, 0, 0);
    c.setTransform(mapPixel, 0, 0, mapPixel, 0, 0);

    // Travel routes: open roads in red ink, roads into uncharted land faint
    for (const [ia, ib, bend] of MAP_ROUTES) {
        const a = siteById(ia), b = siteById(ib), open = !a.locked && !b.locked, [cx, cy] = routeCtrl(a, b, bend);
        const lit = mapHover && !mapHover.locked && (mapHover === a || mapHover === b);
        c.save();
        c.strokeStyle = open ? '#8b2a17' : 'rgba(80,55,30,0.4)'; c.lineWidth = open ? 2.2 : 1.6;
        c.setLineDash(open ? [8, 6] : [3, 6]); if (lit) c.lineDashOffset = -t * 18;
        c.beginPath(); c.moveTo(a.x, a.y + 10); c.quadraticCurveTo(cx, cy, b.x, b.y + 10); c.stroke();
        c.restore();
    }

    for (const s of MAP_SITES) {
        const hov = mapHover === s, pulse = 0.5 + 0.5 * Math.sin(t * 2.4);
        c.save();
        if (!s.locked) {
            const gr = 58 + (hov ? 8 * pulse : 0), g = c.createRadialGradient(s.x, s.y - 4, 4, s.x, s.y - 4, gr);
            g.addColorStop(0, s.color + (hov ? '66' : '22')); g.addColorStop(1, s.color + '00');
            c.fillStyle = g; c.beginPath(); c.arc(s.x, s.y - 4, gr, 0, Math.PI * 2); c.fill();
            if (!hov) { // a slow beckoning ring around the seal
                const p = (t * 0.55 + s.x * 0.01) % 1;
                c.strokeStyle = s.color; c.globalAlpha = 0.5 * (1 - p); c.lineWidth = 2;
                c.beginPath(); c.arc(s.x, s.y + 24, 14 + p * 22, 0, Math.PI * 2); c.stroke(); c.globalAlpha = 1;
            }
        }
        c.translate(s.x, s.y - (hov ? 3 : 0)); const k = hov ? 1.1 : 1; c.scale(k, k);
        if (s.locked) c.globalAlpha = 0.6;
        drawSiteIcon(c, s, t);
        c.restore();
        if (s.locked) drawFog(c, s, t);
        drawSeal(c, s.x, s.y + 24, hov ? 15 : 13, s.locked ? '#7d7366' : s.color, s);
        mapLabel(c, s.name, s.x, s.y + 50, 17, { bold: true, alpha: s.locked ? 0.55 : 1, spacing: 0.5 });
        mapLabel(c, s.locked ? 'uncharted' : s.levels, s.x, s.y + 67, 13, { italic: true, color: s.locked ? '#6b5a48' : '#6b3a1a', alpha: s.locked ? 0.7 : 1 });
    }
}

// ---------- map interaction ----------

function sizeMap() {
    const cv = el('map-canvas'), dpr = window.devicePixelRatio || 1;
    const w = Math.floor(Math.min(window.innerWidth * 0.96, (window.innerHeight - 56) * MAP_W / MAP_H, 1600)), h = Math.floor(w * MAP_H / MAP_W);
    cv.style.width = w + 'px'; cv.style.height = h + 'px';
    mapScale = w / MAP_W;
    const pw = Math.round(w * dpr), ph = Math.round(h * dpr);
    if (cv.width !== pw || cv.height !== ph) { cv.width = pw; cv.height = ph; mapCache = null; }
    mapPixel = pw / MAP_W;
}
function siteAt(mx, my) { return MAP_SITES.find(s => Math.hypot(mx - s.x, my - (s.y + 10)) < 48) || null; }
function showMapInfo(s) {
    const box = el('map-info');
    if (!s) { box.classList.add('hidden'); return; }
    box.innerHTML = s.locked
        ? `<div class="mi-name">${s.name}</div><div class="mi-lv">Uncharted territory</div><p>The fog hasn't lifted from this region yet. Coming in a future update.</p>`
        : `<div class="mi-name" style="color:${s.color}">${s.name}</div><div class="mi-lv">${s.levels}</div><p>${s.desc}</p><div class="mi-boss">Bosses: ${s.bosses}</div><div class="mi-go">Click to travel &rsaquo;</div>`;
    box.classList.remove('hidden');
    const right = s.x < MAP_W * 0.55, bw = box.offsetWidth, bh = box.offsetHeight;
    let left = (right ? s.x + 62 : s.x - 62) * mapScale - (right ? 0 : bw), top = (s.y - 30) * mapScale - bh / 2;
    top = Math.max(8, Math.min(MAP_H * mapScale - bh - 8, top));
    box.style.left = left + 'px'; box.style.top = top + 'px';
}
function initDungeonMap() {
    const cv = el('map-canvas');
    cv.addEventListener('mousemove', e => {
        const r = cv.getBoundingClientRect(), s = siteAt((e.clientX - r.left) / mapScale, (e.clientY - r.top) / mapScale);
        if (s !== mapHover) { mapHover = s; showMapInfo(s); }
        cv.style.cursor = s && !s.locked ? 'pointer' : 'default';
    });
    cv.addEventListener('mouseleave', () => { mapHover = null; showMapInfo(null); });
    cv.addEventListener('click', () => { if (mapHover && !mapHover.locked) selectDungeon(mapHover.id); });
    window.addEventListener('resize', () => { if (!el('dungeon-selection').classList.contains('hidden')) sizeMap(); });
}

window.showDungeonMap = () => {
    el('class-selection').classList.add('hidden');
    el('dungeon-selection').classList.remove('hidden');
    sizeMap(); mapHover = null; showMapInfo(null);
};

// ---------- class carousel: three heroes in view, the middle one highlighted ----------

let carouselIdx = 0, carouselCards = [], lastWheelStep = 0;
const SKILL_KEYS = { 1: 'Q', 2: 'E', 3: 'Space', 4: 'R' };

function carouselOffset(i) { const n = carouselCards.length; let d = ((i - carouselIdx) % n + n) % n; if (d > n / 2) d -= n; return d; }
function layoutCarousel() {
    const gap = Math.min(330, window.innerWidth * 0.3), fit = Math.min(1, window.innerHeight / 880);
    el('class-selection').style.transform = fit < 1 ? `scale(${fit})` : ''; // short windows: shrink the whole screen instead of clipping cards
    carouselCards.forEach((card, i) => {
        const d = carouselOffset(i), ad = Math.abs(d);
        card.style.transform = `translateX(${d * gap}px) scale(${d === 0 ? 1 : 0.84})`;
        card.style.opacity = ad === 0 ? 1 : ad === 1 ? 0.8 : 0;
        card.style.zIndex = 10 - ad;
        card.style.pointerEvents = ad <= 1 ? 'auto' : 'none';
        card.classList.toggle('active', d === 0);
        card.classList.toggle('visible', ad <= 1);
    });
    [...el('carousel-dots').children].forEach((dot, i) => dot.classList.toggle('on', i === carouselIdx));
    const card = carouselCards[carouselIdx], cls = classDataConfig && classDataConfig[card.dataset.class];
    el('btn-begin').innerHTML = `Begin as <b style="color:${card.style.getPropertyValue('--cc')}">${cls ? cls.name : ''}</b>`;
}
function stepCarousel(dir) { const n = carouselCards.length; carouselIdx = ((carouselIdx + dir) % n + n) % n; layoutCarousel(); }
function chooseActiveClass() {
    const id = carouselCards[carouselIdx].dataset.class;
    try { localStorage.setItem('lastClass', id); } catch (e) {}
    chooseClass(id);
}
function fillClassDetails() { // skill names come from classes.json so the cards never drift out of date
    for (const card of carouselCards) {
        const cls = classDataConfig[card.dataset.class], box = card.querySelector('.card-details');
        if (!cls || !box) continue;
        const passive = (cls.passive || '').split(':');
        box.innerHTML = `<div class="card-passive" title="${(cls.passive || '').replace(/"/g, '&quot;')}"><span>Passive</span> ${passive[0]}</div>`
            + [1, 2, 3, 4].map(i => cls.skills[i] ? `<div class="card-skill"><span class="key">${SKILL_KEYS[i]}</span>${cls.skills[i].name}</div>` : '').join('');
    }
}
function initClassCarousel() {
    carouselCards = [...document.querySelectorAll('#class-carousel .class-card')];
    el('carousel-dots').innerHTML = carouselCards.map((c, i) => `<span data-i="${i}" style="--cc:${c.style.getPropertyValue('--cc')}"></span>`).join('');
    el('carousel-dots').addEventListener('click', e => { if (e.target.dataset.i) { carouselIdx = +e.target.dataset.i; layoutCarousel(); } });
    carouselCards.forEach((card, i) => card.addEventListener('click', () => { const d = carouselOffset(i); d === 0 ? chooseActiveClass() : stepCarousel(d); }));
    el('class-selection').addEventListener('wheel', e => {
        e.preventDefault();
        const delta = Math.abs(e.deltaY) >= Math.abs(e.deltaX) ? e.deltaY : e.deltaX;
        const now = performance.now();
        if (Math.abs(delta) < 4 || now - lastWheelStep < 170) return; // one step per notch; trackpads fire a stream of tiny deltas
        lastWheelStep = now; stepCarousel(Math.sign(delta));
    }, { passive: false });
    window.addEventListener('keydown', e => {
        if (gameState !== STATE.MENU || el('class-selection').classList.contains('hidden')) return;
        const k = e.key.toLowerCase();
        if (k === 'arrowleft' || k === 'a') stepCarousel(-1);
        else if (k === 'arrowright' || k === 'd') stepCarousel(1);
        else if (k === 'enter') { e.preventDefault(); chooseActiveClass(); }
        else if (k === 'escape' || k === 'backspace') showDungeonMap();
    });
    window.addEventListener('resize', () => { if (!el('class-selection').classList.contains('hidden')) layoutCarousel(); });
    try { const i = carouselCards.findIndex(c => c.dataset.class === localStorage.getItem('lastClass')); if (i >= 0) carouselIdx = i; } catch (e) {}
}

window.showClassSelection = () => {
    const s = siteById(activeDungeonId);
    el('class-dest').innerHTML = s ? `Destination: <b style="color:${s.color}">${s.name}</b> &middot; ${s.levels}` : '';
    el('dungeon-selection').classList.add('hidden');
    el('class-selection').classList.remove('hidden');
    layoutCarousel();
};

// Called once the JSON data is loaded
window.openMainMenu = () => { fillClassDetails(); showDungeonMap(); };

function menuFrame(now) {
    if (gameState !== STATE.MENU) return; // a run has started; stop animating the menu
    if (!el('dungeon-selection').classList.contains('hidden')) drawMapFrame(now / 1000);
    requestAnimationFrame(menuFrame);
}
initDungeonMap();
initClassCarousel();
requestAnimationFrame(menuFrame);
