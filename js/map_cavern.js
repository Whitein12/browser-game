// ==========================================
// map_cavern.js - Slime Caves stage 2: the Sunken Grotto, one huge cavern
// ==========================================
// The terrain is a grid (STAGE_MAPS.cavern.grid, see stage.js): rock walls, wadeable slime lakes, ravines and, on the
// east side, a sealed wall that comes down once the Amalgam dies. buildCavern() generates it once from fixed shapes plus
// noise and paints one cached ground layer. Lakes, glows, the darkness and falling stalactites are drawn live.
// Gameplay here: wading slows and poisons, dashing (or being rammed) into rock brings stalactites down on everyone nearby.

const cav = { built: false, ground: null, dark: null, lakes: [], mush: [], burrows: [], sealRocks: [], sealGaps: [], sealCells: [], sealBroken: false, sealT: 0, streams: null, stalCd: 0, bumpCd: 0, dripT: 0, splashT: 0 };

// Hand-placed layout; noise roughens every edge. [x, y, r] islands, [x0, y0, x1, y1, width] ridges.
const CAV_ISLANDS = [[950, 760, 150], [1660, 560, 115], [2650, 640, 165], [1100, 2060, 150], [3120, 2080, 150], [2280, 1290, 165], [620, 1960, 105], [3330, 1750, 95]];
const CAV_RIDGES = [[1340, 1060, 1690, 1480, 105], [2720, 1560, 3160, 1360, 95], [1900, 120, 2060, 700, 130], [1480, 2780, 1600, 2180, 120]];
const CAV_LAKES = [[700, 1080, 185, 118, 0.3], [1180, 1480, 140, 95, -0.2], [1960, 1760, 215, 135, 0.1], [2460, 930, 165, 105, -0.4], [2950, 1050, 140, 95, 0.2], [2600, 2350, 195, 115, -0.1], [700, 2280, 150, 100, 0.2], [1260, 470, 160, 95, 0.15]];
const CAV_RAVINES = [
    { pts: [[2860, 180], [3010, 450], [2990, 700], [3190, 900], [3430, 980]], w: 118, bridge: [0.44, 0.56] },
    { pts: [[1760, 2720], [1950, 2390], [2250, 2300], [2500, 2060], [2600, 1830]], w: 128, bridge: [0.46, 0.58] },
];
const CAV_SEAL = { x0: 3655, x1: 3735, y: 1400 };
const CAV_MUSH = ['#4dd0e1', '#b388ff', '#69f0ae', '#80deea'];

const cavCanvas = (w, h) => { const c = document.createElement('canvas'); c.width = w; c.height = h; return c; };
const cavHash = n => { const s = Math.sin(n * 127.1 + 311.7) * 43758.5453; return s - Math.floor(s); };

// Smooth value noise in 0..1 (three octaves), for the generator
function cavNoise(seed) {
    const rnd = clrRng(seed), P = new Float32Array(65536); for (let i = 0; i < P.length; i++) P[i] = rnd();
    const v = (x, y) => {
        const xi = Math.floor(x), yi = Math.floor(y), xf = x - xi, yf = y - yi, u = xf * xf * (3 - 2 * xf), w = yf * yf * (3 - 2 * yf);
        const h = (a, b) => P[((b & 255) << 8) | (a & 255)];
        return (h(xi, yi) * (1 - u) + h(xi + 1, yi) * u) * (1 - w) + (h(xi, yi + 1) * (1 - u) + h(xi + 1, yi + 1) * u) * w;
    };
    return (x, y) => v(x / 380, y / 380) * 0.55 + v(x / 150 + 50, y / 150) * 0.3 + v(x / 60 + 90, y / 60) * 0.15;
}

// Lake outline: a wobbly ellipse in polar form, so cells and the drawn shape agree
const lakeR = (L, a) => 1 + 0.1 * Math.sin(3 * a + L.seed) + 0.07 * Math.sin(5 * a + L.seed * 2);
function inLake(L, x, y, s) {
    const dx = x - L.x, dy = y - L.y, c = Math.cos(-L.rot), sn = Math.sin(-L.rot);
    const u = (dx * c - dy * sn) / (L.rx * s), v = (dx * sn + dy * c) / (L.ry * s);
    return Math.hypot(u, v) < lakeR(L, Math.atan2(v, u));
}
function lakePath(c, L, s, wob) {
    c.beginPath();
    for (let i = 0; i <= 48; i++) {
        const a = i / 48 * Math.PI * 2, rr = lakeR(L, a) + (wob ? 0.012 * Math.sin(a * 4 + fxTime * 1.6 + L.seed) : 0);
        const u = Math.cos(a) * L.rx * s * rr, v = Math.sin(a) * L.ry * s * rr;
        const x = L.x + u * Math.cos(L.rot) - v * Math.sin(L.rot), y = L.y + u * Math.sin(L.rot) + v * Math.cos(L.rot);
        i ? c.lineTo(x, y) : c.moveTo(x, y);
    }
    c.closePath();
}

function buildCavern() {
    if (cav.built) return;
    const D = STAGE_MAPS.cavern;
    D.grid = cavGenerate(D);
    cavPaint(D, D.grid);
    cav.built = true;
}

// Start of every visit: the seal is whole again, the lakes full
function resetCavern() {
    const G = STAGE_MAPS.cavern.grid;
    for (const i of cav.sealCells) G.data[i] = T_SEAL;
    cav.sealBroken = false; cav.sealT = 0; cav.streams = null; cav.stalCd = cav.bumpCd = 0;
    for (const L of cav.lakes) { L.drain = 0; L.churn = 0; }
}

// ---------- generation ----------

function cavGenerate(D) {
    const cs = D.cell, cols = D.w / cs, rows = D.h / cs, n = cols * rows, data = new Uint8Array(n), N = cavNoise(911), rnd = clrRng(5150);
    const ctr = i => [(i % cols + 0.5) * cs, (Math.floor(i / cols) + 0.5) * cs];
    const at = (gx, gy) => (gx < 0 || gy < 0 || gx >= cols || gy >= rows ? T_WALL : data[gy * cols + gx]);
    // Rock everywhere except one big rounded cavern, the tunnel in and the passage out; islands and ridges break it up
    for (let i = 0; i < n; i++) {
        const [x, y] = ctr(i), z = N(x, y) - 0.5, nx = (x - 1960) / 1700, ny = (y - 1400) / 1160;
        let open = Math.pow(nx ** 4 + ny ** 4, 0.25) < 1 + z * 0.5;
        if (x < 330 || x > 3640) open = false;
        if (distToSegment(x, y, -60, 1450, 460, 1450) < 100 + z * 60) open = true;
        if (distToSegment(x, y, 3420, 1400, 4100, 1400) < 105 + z * 30) open = true;
        for (const [ix, iy, r] of CAV_ISLANDS) if (Math.hypot(x - ix, y - iy) < r * (1 + z)) open = false;
        for (const [x0, y0, x1, y1, w] of CAV_RIDGES) if (distToSegment(x, y, x0, y0, x1, y1) < w / 2 * (1 + z)) open = false;
        data[i] = open ? T_FLOOR : T_WALL;
    }
    for (let pass = 0; pass < 2; pass++) { // smooth away single-cell noise
        const prev = data.slice();
        for (let gy = 0; gy < rows; gy++) for (let gx = 0; gx < cols; gx++) {
            let k = 0; for (let oy = -1; oy <= 1; oy++) for (let ox = -1; ox <= 1; ox++) if ((ox || oy) && (gx + ox < 0 || gy + oy < 0 || gx + ox >= cols || gy + oy >= rows || prev[(gy + oy) * cols + gx + ox] === T_WALL)) k++;
            if (k >= 5) data[gy * cols + gx] = T_WALL; else if (k <= 3) data[gy * cols + gx] = T_FLOOR;
        }
    }
    // Ravines: noisy cracks along polylines, each with a natural rock bridge left standing
    for (const R of CAV_RAVINES) {
        const segs = []; let total = 0;
        for (let k = 1; k < R.pts.length; k++) { const l = Math.hypot(R.pts[k][0] - R.pts[k - 1][0], R.pts[k][1] - R.pts[k - 1][1]); segs.push([R.pts[k - 1], R.pts[k], total, l]); total += l; }
        for (let i = 0; i < n; i++) {
            if (data[i] !== T_FLOOR) continue;
            const [x, y] = ctr(i), z = N(x + 999, y) - 0.5;
            let best = 1e9, bt = 0;
            for (const [a, b, t0, l] of segs) {
                const px = b[0] - a[0], py = b[1] - a[1], q = Math.max(0, Math.min(1, ((x - a[0]) * px + (y - a[1]) * py) / (l * l)));
                const d = Math.hypot(x - a[0] - px * q, y - a[1] - py * q); if (d < best) { best = d; bt = (t0 + q * l) / total; }
            }
            const tt = bt + z * 0.05;
            if (best < R.w / 2 * (1 + z * 0.8) && !(tt > R.bridge[0] && tt < R.bridge[1])) data[i] = T_RAVINE;
        }
    }
    // Lakes: shrink each until it sits on open floor with a margin, then flood its cells
    cav.lakes = [];
    for (const [x, y, rx, ry, rot] of CAV_LAKES) {
        const L = { x, y, rx, ry, rot, seed: rnd() * 10, s: 0, drain: 0, churn: 0 };
        for (let s = 1; s >= 0.55; s -= 0.05) {
            let ok = true; const m = Math.max(rx, ry) * s * 1.25;
            for (let gy = Math.floor((y - m) / cs); gy <= (y + m) / cs && ok; gy++) for (let gx = Math.floor((x - m) / cs); gx <= (x + m) / cs; gx++) {
                if (inLake(L, (gx + 0.5) * cs, (gy + 0.5) * cs, s * 1.22) && at(gx, gy) !== T_FLOOR) { ok = false; break; }
            }
            if (ok) { L.s = s; break; }
        }
        if (!L.s) continue;
        for (let i = 0; i < n; i++) { const [cx, cy] = ctr(i); if (data[i] === T_FLOOR && Math.abs(cx - x) < rx && Math.abs(cy - y) < rx && inLake(L, cx, cy, L.s)) data[i] = T_LAKE; }
        cav.lakes.push(L);
    }
    // The sealed wall across the passage to the hive
    cav.sealCells = [];
    for (let i = 0; i < n; i++) { const [x] = ctr(i); if (data[i] === T_FLOOR && x > CAV_SEAL.x0 && x < CAV_SEAL.x1) { data[i] = T_SEAL; cav.sealCells.push(i); } }
    // Anything the hero can't reach becomes rock
    const seen = new Uint8Array(n), q = [Math.floor(D.start.y / cs) * cols + Math.floor(D.start.x / cs)]; seen[q[0]] = 1;
    while (q.length) {
        const i = q.pop(), gx = i % cols;
        for (const j of [gx > 0 ? i - 1 : -1, gx < cols - 1 ? i + 1 : -1, i - cols, i + cols]) if (j >= 0 && j < n && !seen[j] && (data[j] === T_FLOOR || data[j] === T_LAKE || data[j] === T_SEAL)) { seen[j] = 1; q.push(j); }
    }
    for (let i = 0; i < n; i++) if (!seen[i] && (data[i] === T_FLOOR || data[i] === T_LAKE)) data[i] = T_WALL;
    cav.lakes = cav.lakes.filter(L => data[Math.floor(L.y / cs) * cols + Math.floor(L.x / cs)] === T_LAKE);

    // Details that need the finished grid
    const near = (gx, gy, r, test) => { for (let oy = -r; oy <= r; oy++) for (let ox = -r; ox <= r; ox++) if (test(at(gx + ox, gy + oy))) return true; return false; };
    const order = []; for (let i = 0; i < n; i++) if (data[i] === T_FLOOR) order.push(i);
    for (let i = order.length - 1; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); [order[i], order[j]] = [order[j], order[i]]; }
    const far = (list, x, y, d) => list.every(o => Math.hypot(o.x - x, o.y - y) > d);
    const S = D.start, X = { x: CAV_SEAL.x0, y: CAV_SEAL.y };
    cav.burrows = []; D.obstacles.length = 0; cav.mush = [];
    for (const i of order) {
        const gx = i % cols, gy = Math.floor(i / cols), [x, y] = ctr(i);
        const dS = Math.hypot(x - S.x, y - S.y), dX = Math.hypot(x - X.x, y - X.y);
        // Burrows: holes in the rock face that slimes crawl out of
        if (cav.burrows.length < 16 && dS > 500 && dX > 320 && near(gx, gy, 1, v => v === T_WALL) && !near(gx, gy, 3, v => v === T_LAKE || v === T_RAVINE) && far(cav.burrows, x, y, 420)) {
            let vx = 0, vy = 0; for (let oy = -2; oy <= 2; oy++) for (let ox = -2; ox <= 2; ox++) if (at(gx + ox, gy + oy) === T_WALL) { vx -= ox; vy -= oy; }
            const l = Math.hypot(vx, vy); if (l < 2) continue;
            vx /= l; vy /= l;
            if (at(Math.round(gx + vx * 2), Math.round(gy + vy * 2)) !== T_FLOOR) continue;
            cav.burrows.push({ x: x - vx * 14, y: y - vy * 14, nx: vx, ny: vy, sx: x + vx * 34, sy: y + vy * 34 });
            continue;
        }
        // Stalagmites: solid little spires in the open
        if (D.obstacles.length < 22 && dS > 350 && dX > 450 && !near(gx, gy, 3, v => v !== T_FLOOR) && far(D.obstacles, x, y, 260) && far(cav.burrows, x, y, 150)) {
            D.obstacles.push({ x, y, r: 17 + rnd() * 12, kind: 'stalagmite' }); continue;
        }
        // Glowing mushrooms by the rock and the water
        if (cav.mush.length < 60 && near(gx, gy, 2, v => v === T_WALL || v === T_LAKE) && far(cav.mush, x, y, 150) && far(D.obstacles, x, y, 60)) {
            const col = CAV_MUSH[(rnd() * CAV_MUSH.length) | 0], items = [];
            for (let k = 0, m = 3 + (rnd() * 5 | 0); k < m; k++) items.push([(rnd() - 0.5) * 34, (rnd() - 0.5) * 26, 2.5 + rnd() * 4.5]);
            cav.mush.push({ x, y, col, items, ph: rnd() * 6 });
        }
    }
    // The rocks piled across the passage: where they sit, and where they land when the wall blows
    cav.sealRocks = []; cav.sealGaps = [];
    for (let k = 0; k < 12; k++) {
        const y = CAV_SEAL.y - 120 + k * 22 + (rnd() - 0.5) * 10, x = (CAV_SEAL.x0 + CAV_SEAL.x1) / 2 + (k % 2 ? 18 : -16) + (rnd() - 0.5) * 12, r = 26 + rnd() * 16;
        const a = Math.PI + (rnd() - 0.5) * 1.4, d = 140 + rnd() * 260;
        cav.sealRocks.push({ x, y, r, tx: x + Math.cos(a) * d, ty: y + Math.sin(a) * d, rot: rnd() * 6, vr: (rnd() - 0.5) * 9, pts: Array.from({ length: 9 }, () => 0.82 + rnd() * 0.3) });
    }
    cav.sealRocks.sort((a, b) => a.y - b.y);
    for (let k = 1; k < cav.sealRocks.length; k += 2) { const a = cav.sealRocks[k - 1], b = cav.sealRocks[k]; cav.sealGaps.push({ x: (a.x + b.x) / 2 - 18, y: (a.y + b.y) / 2, ph: rnd() * 6 }); }
    return { cols, rows, cell: cs, data };
}

// A half-resolution alpha mask of the cells that pass `test`, with soft, noise-roughened edges
function cavMask(G, test, k, noise) {
    const pw = G.cols + 4, ph = G.rows + 4, lo = cavCanvas(pw, ph), lc = lo.getContext('2d'), id = lc.createImageData(pw, ph);
    for (let py = 0; py < ph; py++) for (let px = 0; px < pw; px++) {
        const gx = Math.max(0, Math.min(G.cols - 1, px - 2)), gy = Math.max(0, Math.min(G.rows - 1, py - 2));
        if (test(G.data[gy * G.cols + gx])) id.data[(py * pw + px) * 4 + 3] = 255;
    }
    lc.putImageData(id, 0, 0);
    const sc = G.cell / 2, w = G.cols * sc, h = G.rows * sc, m = cavCanvas(w, h), mc = m.getContext('2d', { willReadFrequently: true });
    mc.imageSmoothingEnabled = true; mc.filter = 'blur(5px)'; mc.drawImage(lo, -2 * sc, -2 * sc, pw * sc, ph * sc); mc.filter = 'none';
    const d = mc.getImageData(0, 0, w, h), p = d.data;
    for (let i = 0, j = 3; j < p.length; i++, j += 4) { const a = p[j] / 255 + (noise[i] - 0.5) * k; p[j] = Math.max(0, Math.min(255, ((a - 0.5) * 5 + 0.5) * 255)); }
    mc.putImageData(d, 0, 0);
    return m;
}
function cavNoiseArr(w, h, rnd) {
    const m = cavCanvas(w, h), c = m.getContext('2d', { willReadFrequently: true }); c.imageSmoothingEnabled = true;
    for (const [s, a] of [[22, 1], [6, 0.45]]) {
        const lw = Math.ceil(w / s) + 2, lh = Math.ceil(h / s) + 2, lo = cavCanvas(lw, lh), lc = lo.getContext('2d'), id = lc.createImageData(lw, lh);
        for (let i = 0; i < lw * lh; i++) { const v = rnd() * 255; id.data[i * 4] = id.data[i * 4 + 1] = id.data[i * 4 + 2] = v; id.data[i * 4 + 3] = 255; }
        lc.putImageData(id, 0, 0); c.globalAlpha = a; c.drawImage(lo, 0, 0, lw * s, lh * s);
    }
    const p = c.getImageData(0, 0, w, h).data, out = new Float32Array(w * h);
    for (let i = 0; i < out.length; i++) out[i] = p[i * 4] / 255;
    return out;
}

// ---------- the cached ground layer ----------

function cavPaint(D, G) {
    const W = D.w, H = D.h, rnd = clrRng(4242), cs = G.cell;
    const cellAt = (x, y) => { const gx = Math.floor(x / cs), gy = Math.floor(y / cs); return gx < 0 || gy < 0 || gx >= G.cols || gy >= G.rows ? T_WALL : G.data[gy * G.cols + gx]; };
    const g = cavCanvas(W, H), c = g.getContext('2d'); c.lineCap = 'round'; c.lineJoin = 'round';
    const tmp = cavCanvas(W, H), t = tmp.getContext('2d');
    const noise = cavNoiseArr(W / 2, H / 2, rnd);
    const WM = cavMask(G, v => v === T_WALL, 0.9, noise), RM = cavMask(G, v => v === T_RAVINE, 0.7, noise);
    const layer = (fill, mask, cut, dx, dy) => { // a flat colour cut to `mask`, minus the same mask shifted by dx, dy (an edge band)
        t.globalCompositeOperation = 'source-over'; t.clearRect(0, 0, W, H); t.fillStyle = fill; t.fillRect(0, 0, W, H);
        t.globalCompositeOperation = 'destination-in'; t.drawImage(mask, 0, 0, W, H);
        if (cut) { t.globalCompositeOperation = 'destination-out'; t.drawImage(mask, dx, dy, W, H); }
        t.globalCompositeOperation = 'source-over'; return tmp;
    };
    const ring = (fill, mask, wdt) => { // a band just outside the mask's edge
        t.globalCompositeOperation = 'source-over'; t.clearRect(0, 0, W, H);
        for (let a = 0; a < 8; a++) t.drawImage(mask, Math.cos(a * Math.PI / 4) * wdt, Math.sin(a * Math.PI / 4) * wdt, W, H);
        t.globalCompositeOperation = 'source-in'; t.fillStyle = fill; t.fillRect(0, 0, W, H);
        t.globalCompositeOperation = 'destination-out'; t.drawImage(mask, 0, 0, W, H);
        t.globalCompositeOperation = 'source-over'; return tmp;
    };

    // --- stone floor: damp slate with grit, pebbles and flat stones ---
    c.fillStyle = '#30343a'; c.fillRect(0, 0, W, H);
    for (let i = 0; i < 160; i++) {
        const x = rnd() * W, y = rnd() * H, r = 140 + rnd() * 320, k = rnd();
        const gr = c.createRadialGradient(x, y, 0, x, y, r);
        gr.addColorStop(0, k < 0.45 ? 'rgba(14, 16, 20, 0.5)' : k < 0.8 ? 'rgba(84, 90, 98, 0.22)' : 'rgba(40, 74, 60, 0.28)'); gr.addColorStop(1, 'rgba(0, 0, 0, 0)');
        c.fillStyle = gr; c.fillRect(x - r, y - r, r * 2, r * 2);
    }
    const grit = ['rgba(0, 0, 0, 0.35)', 'rgba(130, 136, 145, 0.22)', 'rgba(60, 64, 70, 0.5)', 'rgba(20, 22, 26, 0.5)'];
    for (let i = 0; i < 60000; i++) { c.fillStyle = grit[i & 3]; c.fillRect(rnd() * W, rnd() * H, 1 + rnd() * 2, 1 + rnd() * 2); }
    for (let i = 0; i < 380; i++) { // flat stones set in the floor
        const x = rnd() * W, y = rnd() * H, r = 10 + rnd() * 22;
        c.beginPath(); for (let k = 0; k < 7; k++) { const a = k / 7 * Math.PI * 2, rr = r * (0.75 + rnd() * 0.35); c.lineTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr * 0.8); } c.closePath();
        c.fillStyle = rnd() < 0.5 ? '#383c43' : '#2b2e33'; c.fill(); c.strokeStyle = 'rgba(0, 0, 0, 0.35)'; c.lineWidth = 2; c.stroke();
        c.strokeStyle = 'rgba(150, 156, 165, 0.12)'; c.lineWidth = 1.5; c.beginPath(); c.moveTo(x - r * 0.7, y); c.lineTo(x - r * 0.2, y - r * 0.6); c.stroke();
    }
    for (let i = 0; i < 2200; i++) {
        const x = rnd() * W, y = rnd() * H, r = 1.5 + rnd() * 3.5;
        c.fillStyle = rnd() < 0.5 ? '#474b52' : '#1d1f23'; c.beginPath(); c.ellipse(x, y, r, r * 0.75, rnd() * 3, 0, Math.PI * 2); c.fill();
        c.fillStyle = 'rgba(200, 205, 215, 0.18)'; c.fillRect(x - r * 0.4, y - r * 0.5, 1.2, 1.2);
    }
    c.lineWidth = 7; // faint slime trails crossing the floor
    for (let i = 0; i < 55; i++) {
        let x = rnd() * W, y = rnd() * H; c.strokeStyle = `rgba(95, 211, 141, ${0.05 + rnd() * 0.07})`; c.lineWidth = 4 + rnd() * 9; c.beginPath(); c.moveTo(x, y);
        for (let s = 0; s < 4; s++) { const nx = x + (rnd() - 0.5) * 300, ny = y + (rnd() - 0.5) * 300; c.quadraticCurveTo((x + nx) / 2 + (rnd() - 0.5) * 120, (y + ny) / 2 + (rnd() - 0.5) * 120, nx, ny); x = nx; y = ny; }
        c.stroke();
    }

    // --- lake beds and their slimy banks (the surface itself is drawn live) ---
    for (const L of cav.lakes) {
        lakePath(c, L, L.s * 1.3); c.fillStyle = 'rgba(46, 84, 62, 0.35)'; c.fill();
        lakePath(c, L, L.s * 1.14); c.fillStyle = 'rgba(28, 52, 40, 0.85)'; c.fill();
        lakePath(c, L, L.s * 1.04); c.fillStyle = '#121c17'; c.fill();
        for (let k = 0; k < 14; k++) { const a = rnd() * Math.PI * 2, d = 0.3 + rnd() * 0.6; cavRock(c, L.x + Math.cos(a) * L.rx * L.s * d, L.y + Math.sin(a) * L.ry * L.s * d, 4 + rnd() * 7, rnd, '#2b3a32'); }
    }

    // --- the hive passage beyond the seal: pink membrane creeping over the stone ---
    c.save();
    for (let i = 0; i < 40; i++) { // soft blobs, so it fades out into the cave instead of ending in a straight line
        const x = CAV_SEAL.x1 + 30 + rnd() * 380, y = CAV_SEAL.y + (rnd() - 0.5) * 300, r = 30 + rnd() * 80, gr = c.createRadialGradient(x, y, 0, x, y, r);
        gr.addColorStop(0, 'rgba(240, 98, 146, 0.32)'); gr.addColorStop(1, 'rgba(240, 98, 146, 0)'); c.fillStyle = gr; c.fillRect(x - r, y - r, r * 2, r * 2);
    }
    c.strokeStyle = 'rgba(255, 128, 171, 0.35)'; c.lineWidth = 2.5;
    for (let i = 0; i < 26; i++) { let x = CAV_SEAL.x1 + 10 + rnd() * 370, y = CAV_SEAL.y + (rnd() - 0.5) * 260; c.beginPath(); c.moveTo(x, y); for (let s = 0; s < 3; s++) { x += 20 + rnd() * 50; y += (rnd() - 0.5) * 60; c.lineTo(x, y); } c.stroke(); }
    for (let i = 0; i < 50; i++) { const x = CAV_SEAL.x1 + 20 + rnd() * 380, y = CAV_SEAL.y + (rnd() - 0.5) * 240, r = 3 + rnd() * 7; c.fillStyle = '#ad1457'; c.beginPath(); c.arc(x, y, r, 0, Math.PI * 2); c.fill(); c.fillStyle = 'rgba(255, 200, 225, 0.6)'; c.beginPath(); c.arc(x - r * 0.3, y - r * 0.3, r * 0.35, 0, Math.PI * 2); c.fill(); }
    c.restore();

    // --- ravines: black depth that lightens toward the lip ---
    t.globalCompositeOperation = 'source-over'; t.clearRect(0, 0, W, H); t.fillStyle = '#3c4148'; t.fillRect(0, 0, W, H);
    t.globalCompositeOperation = 'destination-out'; t.drawImage(RM, 0, 0, W, H); t.globalCompositeOperation = 'source-over';
    const inv = cavCanvas(W, H), ic = inv.getContext('2d'); ic.drawImage(tmp, 0, 0); // the floor around the ravines
    layer('#020304', RM);
    t.globalCompositeOperation = 'source-atop'; t.filter = 'blur(18px)'; t.globalAlpha = 0.9; t.drawImage(inv, 9, 12); t.filter = 'none'; t.globalAlpha = 1;
    t.globalCompositeOperation = 'source-over';
    c.drawImage(tmp, 0, 0);
    c.globalAlpha = 0.85; c.drawImage(ring('#5a5f67', RM, 3), 0, 0); c.globalAlpha = 1;
    inv.width = 1;

    // --- rock walls: cast shadow, jumbled slabs, a lit north-west rim and a dark outline ---
    c.save(); c.globalAlpha = 0.65; c.filter = 'blur(12px)'; c.drawImage(WM, 16, 20, W, H); c.restore();
    t.clearRect(0, 0, W, H); t.fillStyle = '#15171b'; t.fillRect(0, 0, W, H);
    const slab = ['#1d2025', '#131519', '#22252b', '#191b20', '#262a30'];
    for (let i = 0; i < 9000; i++) {
        const x = rnd() * W, y = rnd() * H; if (cellAt(x, y) !== T_WALL && cellAt(x + 30, y + 30) !== T_WALL) continue;
        const r = 16 + rnd() * 40;
        t.beginPath(); for (let k = 0; k < 6; k++) { const a = k / 6 * Math.PI * 2 + rnd() * 0.5, rr = r * (0.7 + rnd() * 0.4); t.lineTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr * 0.85); } t.closePath();
        t.fillStyle = slab[(rnd() * slab.length) | 0]; t.fill(); t.strokeStyle = 'rgba(0, 0, 0, 0.4)'; t.lineWidth = 2; t.stroke();
        t.strokeStyle = 'rgba(140, 148, 160, 0.1)'; t.lineWidth = 2; t.beginPath(); t.moveTo(x - r * 0.6, y + r * 0.1); t.lineTo(x - r * 0.1, y - r * 0.6); t.stroke();
    }
    t.globalCompositeOperation = 'source-atop'; t.globalAlpha = 0.7; t.filter = 'blur(30px)'; t.drawImage(WM, 0, 0, W, H); t.filter = 'none'; t.globalAlpha = 1; // deeper rock is darker
    t.globalCompositeOperation = 'destination-in'; t.drawImage(WM, 0, 0, W, H); t.globalCompositeOperation = 'source-over';
    c.drawImage(tmp, 0, 0);
    c.globalAlpha = 0.5; c.drawImage(layer('#8a929d', WM, true, 9, 10), 0, 0);
    c.globalAlpha = 0.8; c.drawImage(layer('#c9d0d8', WM, true, 2.5, 3), 0, 0);
    c.globalAlpha = 0.5; c.drawImage(layer('#000', WM, true, -6, -7), 0, 0);
    c.globalAlpha = 0.9; c.drawImage(ring('#0b0c0f', WM, 2.5), 0, 0); c.globalAlpha = 1;

    // --- details on top: burrows, stalagmites, mushrooms, puddles of slime by the burrows ---
    for (const b of cav.burrows) cavBurrow(c, b, rnd);
    for (const o of D.obstacles) cavStalagmite(c, o, rnd);
    for (const m of cav.mush) for (const [dx, dy, s] of m.items) {
        const x = m.x + dx, y = m.y + dy;
        c.fillStyle = 'rgba(0, 0, 0, 0.35)'; c.beginPath(); c.ellipse(x + 2, y + 2.5, s * 1.1, s * 0.75, 0, 0, Math.PI * 2); c.fill();
        const gr = c.createRadialGradient(x - s * 0.3, y - s * 0.3, 0, x, y, s); gr.addColorStop(0, '#ffffff'); gr.addColorStop(0.35, m.col); gr.addColorStop(1, sprShade(m.col, -0.45));
        c.fillStyle = gr; c.beginPath(); c.arc(x, y, s, 0, Math.PI * 2); c.fill(); c.strokeStyle = 'rgba(0, 0, 0, 0.6)'; c.lineWidth = 1; c.stroke();
    }
    tmp.width = 1;
    cav.ground = g;
}

function cavRock(c, x, y, r, rnd, col) {
    c.fillStyle = 'rgba(0, 0, 0, 0.35)'; c.beginPath(); c.ellipse(x + r * 0.3, y + r * 0.35, r, r * 0.75, 0, 0, Math.PI * 2); c.fill();
    c.beginPath(); for (let i = 0; i < 8; i++) { const a = i / 8 * Math.PI * 2, rr = r * (0.8 + rnd() * 0.3); c.lineTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr * 0.85); } c.closePath();
    const gr = c.createLinearGradient(x - r, y - r, x + r, y + r); gr.addColorStop(0, sprShade(col || '#4a4e55', 0.35)); gr.addColorStop(1, sprShade(col || '#4a4e55', -0.4));
    c.fillStyle = gr; c.fill(); c.strokeStyle = '#111215'; c.lineWidth = 1.5; c.stroke();
}
function cavStalagmite(c, o, rnd) { // a spire seen from straight above: a wide base rising to a pale tip
    const { x, y, r } = o;
    c.fillStyle = 'rgba(0, 0, 0, 0.45)'; c.beginPath(); c.ellipse(x + r * 0.6, y + r * 0.7, r * 1.15, r * 0.85, 0.4, 0, Math.PI * 2); c.fill();
    c.beginPath(); for (let i = 0; i < 11; i++) { const a = i / 11 * Math.PI * 2, rr = r * (0.88 + rnd() * 0.24); c.lineTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr); } c.closePath();
    const gr = c.createRadialGradient(x - r * 0.3, y - r * 0.35, r * 0.05, x, y, r * 1.1); gr.addColorStop(0, '#8e939b'); gr.addColorStop(0.5, '#4d5158'); gr.addColorStop(1, '#25272c');
    c.fillStyle = gr; c.fill(); c.strokeStyle = '#101113'; c.lineWidth = 2.5; c.stroke();
    c.strokeStyle = 'rgba(160, 166, 176, 0.3)'; c.lineWidth = 1.5; // rings of old drip lines
    for (const k of [0.68, 0.42]) { c.beginPath(); c.ellipse(x - r * 0.12 * (1 - k) * 2, y - r * 0.14 * (1 - k) * 2, r * k, r * k * 0.95, 0, 0, Math.PI * 2); c.stroke(); }
    c.fillStyle = '#b3b8c0'; c.beginPath(); c.arc(x - r * 0.18, y - r * 0.22, r * 0.2, 0, Math.PI * 2); c.fill();
    c.fillStyle = 'rgba(255, 255, 255, 0.7)'; c.beginPath(); c.arc(x - r * 0.25, y - r * 0.3, r * 0.07, 0, Math.PI * 2); c.fill();
}
function cavBurrow(c, b, rnd) { // a dark hole in the rock face with slime drooling out of it
    c.save(); c.translate(b.x, b.y); c.rotate(Math.atan2(b.ny, b.nx));
    c.fillStyle = 'rgba(95, 211, 141, 0.16)'; c.beginPath(); c.ellipse(26, 0, 30, 15, 0, 0, Math.PI * 2); c.fill();
    const gr = c.createRadialGradient(-8, 0, 2, -2, 0, 32); gr.addColorStop(0, '#000'); gr.addColorStop(0.65, '#050607'); gr.addColorStop(1, 'rgba(5, 6, 7, 0)');
    c.fillStyle = gr; c.beginPath(); c.ellipse(-2, 0, 26, 32, 0, 0, Math.PI * 2); c.fill();
    for (let k = 0; k < 6; k++) { const a = Math.PI / 2 + (k / 5) * Math.PI; cavRock(c, -2 + Math.cos(a) * 28, Math.sin(a) * 33, 5 + rnd() * 5, rnd, '#4a4e55'); }
    c.fillStyle = 'rgba(150, 255, 190, 0.35)'; c.beginPath(); c.ellipse(10, -6, 7, 2.5, 0.2, 0, Math.PI * 2); c.fill();
    c.restore();
}

// ---------- spawns ----------

// Slimes bubble up out of a lake or crawl out of a burrow somewhere ahead of the hero, never right next to them
function cavernSpawnPoint() {
    const G = currentMap.grid, reach = (x, y) => !nav.dist || nav.dist[Math.floor(y / G.cell) * G.cols + Math.floor(x / G.cell)] >= 0;
    const dist = (x, y) => Math.hypot(x - player.x, y - player.y), cand = [];
    for (const L of cav.lakes) { const d = dist(L.x, L.y); if (d > 480 && d < 1300 && reach(L.x, L.y)) cand.push({ L, d }); }
    for (const b of cav.burrows) { const d = dist(b.sx, b.sy); if (d > 480 && d < 1300 && reach(b.sx, b.sy)) cand.push({ b, d }); }
    if (!cand.length) { // nothing in range: the closest source that isn't on top of the hero
        for (const L of cav.lakes) if (dist(L.x, L.y) > 320) cand.push({ L, d: dist(L.x, L.y) });
        for (const b of cav.burrows) if (dist(b.sx, b.sy) > 320) cand.push({ b, d: dist(b.sx, b.sy) });
        cand.sort((a, b) => a.d - b.d); cand.length = Math.min(cand.length, 3);
    }
    const c = cand[(Math.random() * cand.length) | 0];
    if (c.L) { const a = Math.random() * Math.PI * 2, k = Math.random() * 0.5; return { x: c.L.x + Math.cos(a) * c.L.rx * c.L.s * k, y: c.L.y + Math.sin(a) * c.L.ry * c.L.s * k, from: 'lake' }; }
    return { x: c.b.sx + (Math.random() - 0.5) * 20, y: c.b.sy + (Math.random() - 0.5) * 20, from: 'burrow' };
}

// ---------- per-frame gameplay ----------

function updateCavern(dt) {
    // Wading: the lakes slow you and slowly poison you (the Hazard Suit keeps you dry)
    const suit = equipment.armor && equipment.armor.name === 'Hazard Suit';
    player.wading = !suit && player.z <= 4 && terrainAt(player.x, player.y) === T_LAKE;
    if (player.wading) {
        takeDamage((player.maxHp * 0.025 + wave * 0.6) * dt, true);
        if ((cav.splashT -= dt) <= 0) { // splashes when moving, toxic bubbles rising off the hero either way
            cav.splashT = 0.14;
            if (keys.w || keys.a || keys.s || keys.d) burst(player.x, player.y + 8, 0, Math.PI * 2, 2, { kind: 'goo', color: '#5fd38d', size: 3, speed: [40, 110], life: 0.35, drag: 4 });
            spawnParticle({ kind: 'dot', color: '#76ff9a', x: player.x + (Math.random() - 0.5) * 22, y: player.y + 4, vx: (Math.random() - 0.5) * 12, vy: -40 - Math.random() * 30, size: 2.5, life: 0.6, drag: 1, grow: 0, spin: 0, rot: 0 });
        }
    }
    if (!player.dash && !player.grappleTarget) clampToBounds(player, player.radius); // blinks and pulls can't leave the hero inside rock
    if (!cav.sealBroken && player.x > CAV_SEAL.x0 - player.radius) player.x = CAV_SEAL.x0 - player.radius; // no blinking past the sealed wall
    // Hard knocks against the rock shake stalactites loose
    cav.stalCd -= dt; cav.bumpCd -= dt;
    const d = player.dash;
    if (d && d.intoWall && !d.bumped && dashProgress() > 0.85) { d.bumped = true; wallImpact(player.x + Math.cos(d.angle) * 20, player.y + Math.sin(d.angle) * 20); }
    if (player.wallHit) {
        const [hx, hy] = player.wallHit;
        if ((d && d.rammed && !d.bumped) || player.grappleRammed) { if (d) d.bumped = true; player.grappleRammed = false; wallImpact(hx, hy); }
        else if (cav.bumpCd <= 0 && (keys.w || keys.a || keys.s || keys.d)) { cav.bumpCd = 0.7; burst(hx, hy, Math.atan2(player.y - hy, player.x - hx), 1.6, 3, { kind: 'debris', color: '#5d6066', size: 2, speed: [30, 90], life: 0.4, drag: 4 }); }
        player.wallHit = null;
    }
    for (const e of enemies) if (e.wallHit) { // the Amalgam's stampede into a wall brings the ceiling down too
        if (e.type === 'boss_amalgam' && e.state === 'stampede' && !(e.ramAt > fxTime - 1.6)) { e.ramAt = fxTime; wallImpact(e.wallHit[0], e.wallHit[1]); }
        e.wallHit = null;
    }
    updateStalactites();
    // Water dripping from the ceiling somewhere near the hero
    if ((cav.dripT -= dt) <= 0) {
        cav.dripT = 0.2 + Math.random() * 0.35;
        const x = player.x + (Math.random() - 0.5) * 1000, y = player.y + (Math.random() - 0.5) * 640;
        if (terrainAt(x, y) !== T_WALL) effects.push({ type: 'cave_drip', x, y, life: 1.1, maxLife: 1.1 });
    }
}

// A shower of stalactites around a point where something hit the rock hard
function wallImpact(x, y) {
    addShake(4);
    burst(x, y, 0, Math.PI * 2, 10, { kind: 'debris', color: '#6b6e74', size: 3, speed: [60, 200], life: 0.6, drag: 3 });
    if (cav.stalCd > 0) return;
    cav.stalCd = 1.4;
    effects.push({ type: 'text', text: 'Stalactites!', x, y: y - 30, color: '#ffcc80', life: 1.0, maxLife: 1.0 });
    const n = 4 + (Math.random() * 3 | 0);
    for (let i = 0; i < n; i++) {
        let sx = x, sy = y;
        for (let k = 0; k < 8; k++) { const a = Math.random() * Math.PI * 2, r = i === 0 ? 20 + Math.random() * 30 : 70 + Math.random() * 170; sx = x + Math.cos(a) * r; sy = y + Math.sin(a) * r; if (!solidCell(terrainAt(sx, sy), false)) break; }
        dropStalactite(sx, sy, 0.15 + i * 0.13, false);
    }
}
function dropStalactite(x, y, delay, harmless) {
    const fall = 0.8 + delay, pts = Array.from({ length: 7 }, () => 0.75 + Math.random() * 0.4);
    effects.push({ type: 'stalactite', x, y, r: 44, fall, harmless, pts, rot: Math.random() * 6, life: fall + 5, maxLife: fall + 5 });
}
function updateStalactites() {
    for (const ef of effects) {
        if (ef.type !== 'stalactite' || ef.hit || ef.maxLife - ef.life < ef.fall) continue;
        ef.hit = true; addShake(3);
        burst(ef.x, ef.y, 0, Math.PI * 2, 14, { kind: 'debris', color: '#8a8e95', size: 4, speed: [80, 260], life: 0.6, drag: 3 });
        burst(ef.x, ef.y, 0, Math.PI * 2, 6, { kind: 'smoke', color: 'rgba(120, 124, 130, 0.5)', size: 16, speed: [20, 70], life: 0.8, drag: 2, grow: 30 });
        if (ef.harmless) continue;
        if (player.z <= 4 && Math.hypot(player.x - ef.x, player.y - ef.y) < ef.r + player.radius * 0.5) takeDamage(12 + wave * 2.5);
        for (const e of enemies) if (!e.dead && !(e.spawnT > 0) && Math.hypot(e.x - ef.x, e.y - ef.y) < ef.r + e.size / 2) applyDamage(e, 40 + wave * 10, 'env');
    }
}

// ---------- the Amalgam forms out of the nearest lakes ----------

function cavOpenSpot(x, y) { // nearest cell the enemies can walk on, with some room around it
    const G = currentMap.grid, cs = G.cell, cx = Math.floor(x / cs), cy = Math.floor(y / cs);
    for (let rad = 0; rad < 30; rad++) for (let oy = -rad; oy <= rad; oy++) for (let ox = -rad; ox <= rad; ox++) {
        if (Math.max(Math.abs(ox), Math.abs(oy)) !== rad) continue;
        const gx = cx + ox, gy = cy + oy; let ok = nav.dist && nav.dist[gy * G.cols + gx] >= 0;
        for (let k = -2; k <= 2 && ok; k++) for (let j = -2; j <= 2; j++) if (solidCell(cellV(gx + j, gy + k), false)) { ok = false; break; }
        if (ok) return [(gx + 0.5) * cs, (gy + 0.5) * cs];
    }
    return [player.x + 300, player.y];
}

function startAmalgamIntro(boss) {
    const near = cav.lakes.slice().sort((a, b) => Math.hypot(a.x - player.x, a.y - player.y) - Math.hypot(b.x - player.x, b.y - player.y)).slice(0, 3);
    let px = near.reduce((s, L) => s + L.x, 0) / near.length, py = near.reduce((s, L) => s + L.y, 0) / near.length;
    const [dx, dy, dd] = getVector(player.x, player.y, px, py);
    if (dd < 340) { const a = dd > 1 ? Math.atan2(dy, dx) : Math.random() * 6; px = player.x + Math.cos(a) * 340; py = player.y + Math.sin(a) * 340; }
    [px, py] = cavOpenSpot(px, py);
    boss.x = px; boss.y = py; boss.state = 'intro'; boss.introK = 0;
    const streams = near.map((L, i) => {
        const a = Math.atan2(py - L.y, px - L.x), x0 = L.x + Math.cos(a) * L.rx * L.s * 0.6, y0 = L.y + Math.sin(a) * L.ry * L.s * 0.6;
        const mx = (x0 + px) / 2, my = (y0 + py) / 2, len = Math.hypot(px - x0, py - y0), side = i % 2 ? 1 : -1;
        return { L, x0, y0, cx: mx - (py - y0) / len * 90 * side, cy: my + (px - x0) / len * 90 * side, x1: px, y1: py, seed: i * 2.3 };
    });
    cav.streams = { list: streams, head: 0, tail: 0 };
    stageEvent = { type: 'amalgam_form', t: 0, boss, blocking: true, shook: 0 };
}

function updateAmalgamForm(ev, dt) {
    const b = ev.boss, t = ev.t, S = cav.streams;
    camera.tx = b.x; camera.ty = b.y;
    for (const s of S.list) { s.L.churn = Math.min(1, t / 0.8) * (t < 3.6 ? 1 : Math.max(0, 1 - (t - 3.6))); s.L.drain = Math.min(0.45, Math.max(s.L.drain, (t - 0.8) / 2.4 * 0.45)); }
    S.head = clamp01((t - 0.7) / 1.0); S.tail = clamp01((t - 3.0) / 0.7);
    if (t < 3 && t - ev.shook > 0.3) { ev.shook = t; addShake(1.5); }
    b.introK = clamp01((t - 1.4) / 2.0); // a pool spreads (to 0.5), then the mass rises out of it
    if (b.introK > 0.02 && b.introK < 0.95 && Math.random() < 0.2) burst(b.x + (Math.random() - 0.5) * 50, b.y + (Math.random() - 0.5) * 30, 0, Math.PI * 2, 1, { kind: 'goo', color: '#4fd18b', size: 3.5, speed: [40, 120], life: 0.4, drag: 3 }); // it splashes as it fills
    if (b.introK >= 1 && !ev.roared) {
        ev.roared = true; addShake(7);
        burst(b.x, b.y, 0, Math.PI * 2, 16, { kind: 'goo', color: '#26a69a', size: 5, speed: [180, 400], life: 0.5, drag: 3 });
        effects.push({ type: 'slime_shock', x: b.x, y: b.y, radius: 240, color: '#1de9b6', life: 0.6, maxLife: 0.6 });
        showBossCard(BOSS_NAMES[b.type] || 'The Amalgam', 'Born of the Pools');
    }
    if (t > 4.6) { camera.tx = camera.ty = null; }
    if (t > 5.1) { b.state = 'idle'; b.stateTimer = 1.5; b.introK = undefined; stageEvent = null; cav.streams = null; for (const s of S.list) s.L.churn = 0; }
}

// ---------- the seal breaks once the Amalgam is dead ----------

function startSealBreak() { stageEvent = { type: 'seal_break', t: 0, blocking: true, shook: 0 }; }

function updateSealBreak(ev, dt) {
    const t = ev.t, sx = (CAV_SEAL.x0 + CAV_SEAL.x1) / 2, sy = CAV_SEAL.y;
    camera.tx = sx - 160; camera.ty = sy;
    if (!cav.sealBroken && t > 0.4 && t - ev.shook > 0.16) { // the wall groans; pebbles and dust rain off it, rocks fall around it
        ev.shook = t; addShake(1 + t * 1.6);
        burst(sx - 30, sy + (Math.random() - 0.5) * 240, Math.PI, 1.2, 3, { kind: 'debris', color: '#6b6e74', size: 3, speed: [40, 140], life: 0.6, drag: 3 });
        if (Math.random() < 0.35) dropStalactite(sx - 120 - Math.random() * 220, sy + (Math.random() - 0.5) * 360, 0, true);
    }
    if (t > 1.8 && !cav.sealBroken) {
        cav.sealBroken = true; cav.sealT = 0;
        const G = currentMap.grid; for (const i of cav.sealCells) G.data[i] = T_FLOOR;
        updateNav(true); addShake(10);
        for (const r of cav.sealRocks) burst(r.x, r.y, Math.PI, 2.2, 6, { kind: 'debris', color: '#7a7e85', size: 5, speed: [120, 420], life: 0.8, drag: 2.5 });
        for (let i = 0; i < 14; i++) spawnParticle({ kind: 'smoke', color: 'rgba(130, 120, 128, 0.55)', x: sx + (Math.random() - 0.5) * 60, y: sy + (Math.random() - 0.5) * 260, vx: -60 - Math.random() * 160, vy: (Math.random() - 0.5) * 80, size: 26, grow: 40, life: 1.4, drag: 1.5, spin: 0, rot: 0 });
        effects.push({ type: 'slime_shock', x: sx, y: sy, radius: 260, color: '#ff80ab', life: 0.7, maxLife: 0.7 });
        openStageExit('#ff4081');
    }
    if (cav.sealBroken) cav.sealT += dt;
    updateStalactites();
    if (t > 3.4) { camera.tx = camera.ty = null; }
    if (t > 3.8) stageEvent = null;
}

// ---------- drawing (world space; the camera transform is already applied) ----------

function cavView(m) { return [camera.x - m, camera.y - m, camera.x + canvas.width + m, camera.y + canvas.height + m]; }
const cavIn = (x, y, V) => x > V[0] && x < V[2] && y > V[1] && y < V[3];

function drawCavernGround() {
    const W = cav.ground.width, H = cav.ground.height, sx = Math.max(0, Math.floor(camera.x) - 20), sy = Math.max(0, Math.floor(camera.y) - 20);
    const sw = Math.min(W - sx, canvas.width + 42), sh = Math.min(H - sy, canvas.height + 42);
    ctx.drawImage(cav.ground, sx, sy, sw, sh, sx, sy, sw, sh);
    const t = fxTime, V = cavView(300);
    for (const L of cav.lakes) if (cavIn(L.x, L.y, V)) drawCavLake(L, t);
    drawCavSeal(t);
    drawCavernDark();
    // Things that glow, added on top of the darkness
    ctx.save(); ctx.globalCompositeOperation = 'lighter';
    for (const L of cav.lakes) if (cavIn(L.x, L.y, V)) ptGlow(ctx, L.x, L.y, Math.max(L.rx, L.ry) * L.s * 1.15, '#3ddc84', 0.09 + L.churn * 0.16);
    for (const m of cav.mush) if (cavIn(m.x, m.y, V)) ptGlow(ctx, m.x, m.y, 34, m.col, 0.26 * (0.75 + 0.25 * Math.sin(t * 1.3 + m.ph)));
    if (cavIn(60, 1450, V)) ptGlow(ctx, 40, 1450, 300, '#fff3c4', 0.13); // daylight from the way you came in
    if (cavIn(3880, 1400, V)) {
        const p = 0.5 + 0.5 * Math.sin(t * 2);
        ptGlow(ctx, 3900, 1400, cav.sealBroken ? 300 : 200, '#ff4081', (cav.sealBroken ? 0.28 : 0.12) + 0.06 * p);
        if (!cav.sealBroken) for (const g of cav.sealGaps) ptGlow(ctx, g.x, g.y, 22, '#ff4f9a', 0.35 + 0.25 * Math.sin(t * 3 + g.ph));
    }
    ctx.restore();
    if (cav.streams) drawCavStreams(t);
    // Ripples around anything standing in a lake
    for (const e of enemies) if (!e.dead && !(e.spawnT > 0) && !e.airborne && terrainAt(e.x, e.y) === T_LAKE) cavRipple(e.x, e.y + e.size * 0.2, e.size * 0.6, e.seed || 0);
    if (player.z <= 4 && terrainAt(player.x, player.y) === T_LAKE) cavRipple(player.x, player.y + 8, 16, 0);
}

function lakeSurface(L) { // painted once, at full size
    if (L.surf) return L.surf;
    const R = Math.ceil(Math.max(L.rx, L.ry) * L.s * 1.2 + 6), cv = cavCanvas(R * 2, R * 2), c = cv.getContext('2d'), s = L.s, Rs = Math.max(L.rx, L.ry) * s;
    c.translate(R - L.x, R - L.y); lakePath(c, L, s);
    const g = c.createRadialGradient(L.x - L.rx * s * 0.3, L.y - L.ry * s * 0.35, Rs * 0.05, L.x, L.y, Rs * 1.1);
    g.addColorStop(0, '#5fd99a'); g.addColorStop(0.45, '#2f9466'); g.addColorStop(1, '#134d36');
    c.fillStyle = g; c.globalAlpha = 0.93; c.fill(); c.globalAlpha = 1;
    c.strokeStyle = 'rgba(170, 255, 205, 0.45)'; c.lineWidth = 2; c.stroke();
    L.surf = cv; L.surfR = R;
    return cv;
}

function drawCavLake(L, t) {
    const c = ctx, d = 1 - 0.4 * L.drain, s = L.s * d, img = lakeSurface(L);
    c.drawImage(img, L.x - L.surfR * d, L.y - L.surfR * d, L.surfR * 2 * d, L.surfR * 2 * d); // shrinks toward the middle as it drains
    c.save();
    c.fillStyle = 'rgba(220, 255, 235, 0.1)'; // slow sheen drifting over the middle of the surface
    for (let i = 0; i < 3; i++) { const k = (t * 0.03 + i * 0.33 + L.seed) % 1; c.globalAlpha = Math.sin(k * Math.PI); c.beginPath(); c.ellipse(L.x + (k - 0.5) * L.rx * s * 1.1, L.y - L.ry * s * 0.35 + i * L.ry * s * 0.3, L.rx * s * 0.22, 4, -0.15, 0, Math.PI * 2); c.fill(); }
    c.globalAlpha = 1;
    const nb = 5 + Math.round(L.churn * 10), spd = 0.6 + L.churn * 1.8; // bubbles rising and popping; they boil while the Amalgam pulls the lake out
    for (let i = 0; i < nb; i++) {
        const k = (t * spd + cavHash(i + L.seed * 10)) % 1, cyc = Math.floor(t * spd + cavHash(i + L.seed * 10));
        const bx = L.x + (cavHash(cyc * 7 + i) - 0.5) * L.rx * s * 1.1, by = L.y + (cavHash(cyc * 13 + i) - 0.5) * L.ry * s * 1.0;
        if (k < 0.8) { const br = 2 + k * (4 + L.churn * 5); c.fillStyle = 'rgba(190, 255, 215, 0.35)'; c.beginPath(); c.arc(bx, by, br, 0, Math.PI * 2); c.fill(); c.fillStyle = 'rgba(255, 255, 255, 0.6)'; c.fillRect(bx - br * 0.4, by - br * 0.5, 1.5, 1.5); }
        else { const q = (k - 0.8) / 0.2; c.strokeStyle = `rgba(200, 255, 225, ${0.6 * (1 - q)})`; c.lineWidth = 1.2; c.beginPath(); c.ellipse(bx, by, 4 + q * 10, (4 + q * 10) * 0.6, 0, 0, Math.PI * 2); c.stroke(); }
    }
    c.restore();
}

function cavRipple(x, y, r, seed) {
    ctx.save(); ctx.lineWidth = 1.5;
    for (let i = 0; i < 2; i++) { const k = (fxTime * 1.2 + i * 0.5 + seed) % 1; ctx.strokeStyle = `rgba(170, 255, 210, ${0.5 * (1 - k)})`; ctx.beginPath(); ctx.ellipse(x, y, r + k * 22, (r + k * 22) * 0.55, 0, 0, Math.PI * 2); ctx.stroke(); }
    ctx.restore();
}

function drawCavSeal(t) {
    if (!cavIn(CAV_SEAL.x0, CAV_SEAL.y, cavView(500))) return;
    const k = cav.sealBroken ? easeOut(Math.min(1, cav.sealT / 0.75)) : 0, fly = cav.sealBroken ? Math.min(1, cav.sealT / 0.75) : 0;
    for (const r of cav.sealRocks) {
        const x = lerp(r.x, r.tx, k), y = lerp(r.y, r.ty, k), z = Math.sin(Math.PI * fly) * 90 * (40 / r.r), s = 1 - 0.4 * k, rr = r.r * s;
        ctx.fillStyle = 'rgba(0, 0, 0, 0.4)'; ctx.beginPath(); ctx.ellipse(x + 10, y + 12, rr * 1.05, rr * 0.8, 0, 0, Math.PI * 2); ctx.fill();
        ctx.save(); ctx.translate(x, y - z); ctx.rotate(r.rot + r.vr * fly);
        ctx.beginPath(); r.pts.forEach((p, i) => { const a = i / r.pts.length * Math.PI * 2; ctx.lineTo(Math.cos(a) * rr * p, Math.sin(a) * rr * p * 0.9); }); ctx.closePath();
        ctx.rotate(-(r.rot + r.vr * fly));
        const g = ctx.createRadialGradient(-rr * 0.35, -rr * 0.4, rr * 0.1, 0, 0, rr * 1.1); g.addColorStop(0, '#8f949c'); g.addColorStop(0.55, '#53575e'); g.addColorStop(1, '#2a2c31');
        ctx.fillStyle = g; ctx.fill(); ctx.strokeStyle = '#0f1013'; ctx.lineWidth = 2.5; ctx.stroke();
        ctx.restore();
    }
}

function drawCavStreams(t) { // ribbons of slime pouring from the lakes into the forming Amalgam
    const S = cav.streams, c = ctx;
    const pt = (s, u) => { const v = 1 - u, w = Math.sin(u * 9 + t * 6 + s.seed) * 6 * Math.sin(u * Math.PI); return [v * v * s.x0 + 2 * v * u * s.cx + u * u * s.x1 + w, v * v * s.y0 + 2 * v * u * s.cy + u * u * s.y1 + w * 0.6]; };
    c.save(); c.lineCap = 'round'; c.lineJoin = 'round';
    for (const s of S.list) {
        if (S.head <= S.tail) continue;
        for (const [w, col] of [[20, 'rgba(19, 77, 54, 0.9)'], [14, 'rgba(63, 191, 127, 0.95)'], [5, 'rgba(190, 255, 220, 0.6)']]) {
            c.strokeStyle = col; c.lineWidth = w; c.beginPath();
            for (let u = S.tail; u <= S.head + 0.001; u += 0.04) { const [x, y] = pt(s, Math.min(u, S.head)); u === S.tail ? c.moveTo(x, y) : c.lineTo(x, y); }
            c.stroke();
        }
        for (let i = 0; i < 5; i++) { // lumps travelling down the stream
            const u = (t * 0.8 + i * 0.2 + s.seed) % 1; if (u < S.tail || u > S.head) continue;
            const [x, y] = pt(s, u); c.fillStyle = '#4fd18b'; c.strokeStyle = '#0c3324'; c.lineWidth = 2; c.beginPath(); c.arc(x, y, 9, 0, Math.PI * 2); c.fill(); c.stroke();
            c.fillStyle = 'rgba(255, 255, 255, 0.6)'; c.beginPath(); c.arc(x - 3, y - 3, 2.5, 0, Math.PI * 2); c.fill();
        }
    }
    c.restore();
}

// Dim the cave, then cut soft holes for every light: the hero, lakes, mushrooms, glowing slimes and shots
// Dim the screen with `fill`, then cut soft holes wherever `lights(hole)` says there's light. Half resolution: it's all soft gradients.
function drawDarkLayer(fill, lights) {
    const cw = Math.ceil((canvas.width + 80) / 2), ch = Math.ceil((canvas.height + 80) / 2);
    if (!cav.dark || cav.dark.width !== cw || cav.dark.height !== ch) cav.dark = cavCanvas(cw, ch);
    const v = cav.dark.getContext('2d'), ox = Math.round(camera.x) - 40, oy = Math.round(camera.y) - 40;
    v.globalCompositeOperation = 'source-over'; v.clearRect(0, 0, cw, ch);
    v.fillStyle = fill; v.fillRect(0, 0, cw, ch);
    v.globalCompositeOperation = 'destination-out';
    const hole = (x, y, r, a) => {
        x = (x - ox) / 2; y = (y - oy) / 2; r /= 2; if (x < -r || y < -r || x > cw + r || y > ch + r) return;
        const g = v.createRadialGradient(x, y, 0, x, y, r); g.addColorStop(0, `rgba(0, 0, 0, ${a})`); g.addColorStop(0.45, `rgba(0, 0, 0, ${a * 0.8})`); g.addColorStop(1, 'rgba(0, 0, 0, 0)');
        v.fillStyle = g; v.fillRect(x - r, y - r, r * 2, r * 2);
    };
    hole(player.x, player.y, 470 + Math.sin(fxTime * 7) * 6 + Math.sin(fxTime * 13) * 4, 0.97); // the hero's light
    lights(hole);
    for (let i = 0; i < projectiles.length && i < 40; i++) { const p = projectiles[i]; hole(p.x, p.y, p.isEnemy ? 70 : 90, 0.45); } // a bullet hell would mean hundreds of gradients
    ctx.drawImage(cav.dark, ox, oy, cw * 2, ch * 2);
}

function drawCavernDark() { drawDarkLayer('rgba(3, 5, 10, 0.74)', hole => {
    const t = fxTime;
    hole(60, 1450, 520, 0.85);
    hole(3900, 1400, cav.sealBroken ? 440 : 230, cav.sealBroken ? 0.75 : 0.45);
    for (const L of cav.lakes) hole(L.x, L.y, Math.max(L.rx, L.ry) * L.s * 1.6, 0.55 + L.churn * 0.3);
    for (const m of cav.mush) hole(m.x, m.y, 120, 0.5);
    for (const e of enemies) {
        if (e.dead) continue;
        if (e.type === 'voltaic_ooze') hole(e.x, e.y, 150, 0.6 + 0.2 * Math.sin(t * 20 + e.x));
        else if (e.type === 'boss_amalgam') hole(e.x, e.y, 300, 0.5);
    }
}); }

// Above everything in the world: falling stalactites, ceiling drips, dust in the hero's light
function drawCavernAbove() {
    const c = ctx, t = fxTime;
    for (const ef of effects) {
        const el = ef.maxLife - ef.life;
        if (ef.type === 'stalactite' && el < ef.fall) {
            const k = el / ef.fall, z = (1 - k * k) * 560, s = 1 + z / 420, x = ef.x, y = ef.y - z;
            c.save(); c.translate(x, y); c.scale(s, s);
            const sg = c.createLinearGradient(0, -60, 0, 0); sg.addColorStop(0, 'rgba(200, 205, 215, 0)'); sg.addColorStop(1, 'rgba(200, 205, 215, 0.3)');
            c.fillStyle = sg; c.fillRect(-6, -60, 12, 60); // motion streak
            c.rotate(ef.rot + k * 2);
            c.beginPath(); ef.pts.forEach((p, i) => { const a = i / ef.pts.length * Math.PI * 2, rr = (i % 2 ? 11 : 19) * p; c.lineTo(Math.cos(a) * rr, Math.sin(a) * rr); }); c.closePath(); // a ragged chunk of rock
            const g = c.createRadialGradient(-5, -6, 1, 0, 0, 20); g.addColorStop(0, '#9da2a9'); g.addColorStop(0.5, '#5e6269'); g.addColorStop(1, '#2c2e33');
            c.fillStyle = g; c.fill(); c.strokeStyle = '#0e0f11'; c.lineWidth = 2; c.stroke();
            c.fillStyle = 'rgba(220, 224, 230, 0.8)'; c.beginPath(); c.arc(-3, -4, 2.5, 0, Math.PI * 2); c.fill(); // the snapped-off top, catching the light
            c.restore();
        } else if (ef.type === 'cave_drip') {
            if (el < 0.5) { const k = el / 0.5, z = (1 - k * k) * 260; c.fillStyle = 'rgba(200, 240, 255, 0.7)'; c.beginPath(); c.ellipse(ef.x, ef.y - z, 1.6, 3.5, 0, 0, Math.PI * 2); c.fill(); }
            else { const k = (el - 0.5) / 0.6; c.strokeStyle = `rgba(190, 230, 255, ${0.45 * (1 - k)})`; c.lineWidth = 1.2; c.beginPath(); c.ellipse(ef.x, ef.y, 2 + k * 12, (2 + k * 12) * 0.55, 0, 0, Math.PI * 2); c.stroke(); }
        }
    }
    c.save(); c.globalCompositeOperation = 'lighter'; // dust motes drifting through the hero's light
    const tx0 = Math.floor(player.x / 200), ty0 = Math.floor(player.y / 200);
    for (let ty = ty0 - 2; ty <= ty0 + 2; ty++) for (let tx = tx0 - 2; tx <= tx0 + 2; tx++) for (let i = 0; i < 2; i++) {
        const h = tx * 73 + ty * 151 + i * 17, x = tx * 200 + cavHash(h) * 200 + Math.sin(t * 0.3 + h) * 30, y = ty * 200 + cavHash(h + 5) * 200 + Math.cos(t * 0.25 + h) * 24;
        const a = Math.max(0, 1 - Math.hypot(x - player.x, y - player.y) / 380) * (0.35 + 0.3 * Math.sin(t * 2 + h));
        if (a > 0.02) { c.fillStyle = `rgba(255, 245, 220, ${a})`; c.fillRect(x, y, 2, 2); }
    }
    c.restore();
}
