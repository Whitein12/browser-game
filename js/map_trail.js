// ==========================================
// map_trail.js - Bandit Bastion stage 2: The Raiders' Trail (waves 6-10)
// ==========================================
// The bandits' trail from the burned village to their bastion, west to east, in three sections that open one after
// another: a forest road (waves 6-7), the bandits' hunting camp in a clearing (waves 8-9) and a riverbank where the
// Beastmaster holds the near end of the stone bridge (wave 10). Logjams (T_SEAL) close the first two sections until
// their waves are cleared; the bridgehead gate (T_SEAL) holds the bridge until he falls. buildTrail() lays the terrain
// grid out and paints one ground layer and one canopy layer once. The logjams, the gate, the campfire and the river
// surface are live.

STAGE_MAPS.trail = {
    w: 5400, h: 1800, cell: 25, zoom: 1.25,
    bounds: { left: 30, top: 30, right: 5370, bottom: 1770 },
    start: { x: 260, y: 900 },
    exit: { x: 5150, y: 900 }, exitTo: { x: 5350, y: 900 }, exitR: 90, arrow: '#ffab40',
    prompt: 'The Beastmaster has fallen &middot; cross the bridge to the bastion',
    cleared: { title: 'Stage Cleared', sub: 'The River Crossing · Bandit Bastion', next: 'The bridge to the bastion' },
    obstacles: [], grid: null,
};

const trl = { built: false, ground: null, canopy: null, view: null, grid: null, riverL: null, riverR: null, jam: [], jamCells: [[], []],
    gateCells: [], spawns: [], lastSpawn: null, nearTrees: null, clumps: [], open: 0, gateOpen: false, gateK: 0, promptAt: 0 };

const TR_ROAD = [[-40, 900], [600, 960], [1200, 840], [1800, 920], [2400, 900], [3200, 880], [3900, 900], [4500, 900], [5440, 900]];
const TR_JAM = [{ x0: 1975, x1: 2025 }, { x0: 3875, x1: 3925 }]; // the logjams' columns (25 px cells)
const TR_RIVER = [4550, 5600]; // the river: west bank before the wobble; it runs off the east edge (no far bank)
const TR_GATE = { x0: 4475, x1: 4525, y: 900 }; // the bridgehead gate's columns, on the bridge
const TR_BRIDGE = { x0: 4450, x1: 5400, y: 900, hh: 70 }; // the stone bridge: |y - 900| < 70
const TR_CAMP = {
    fire: { x: 2960, y: 600, r: 26 },
    huts: [ // canvas tents and wooden kennels: wall blocks with a doorway notch on the side they face
        { kind: 'tent', x0: 2675, y0: 475, w: 125, h: 100, door: 'e' }, { kind: 'tent', x0: 3100, y0: 450, w: 125, h: 100, door: 'w' },
        { kind: 'tent', x0: 2900, y0: 350, w: 125, h: 100, door: 's' }, { kind: 'tent', x0: 3225, y0: 710, w: 125, h: 100, door: 'w' },
        { kind: 'tent', x0: 2560, y0: 330, w: 125, h: 100, door: 'e' },
        { kind: 'kennel', x0: 3450, y0: 640, w: 100, h: 75, door: 'w' }, { kind: 'kennel', x0: 2400, y0: 500, w: 100, h: 75, door: 's' },
    ],
    hide: { x: 2440, y: 1090 }, // the drying frame for the hides
    logs: [[2960, 668, 0], [2890, 612, Math.PI / 2], [3032, 598, Math.PI / 2], [2960, 540, 0]], // seats round the fire
};
const TR_PROPS = [ // solid things: [x, y, r, kind]
    [560, 1095, 34, 'boulder'], [780, 690, 26, 'stump'], [1010, 1070, 40, 'boulder'], [1100, 760, 30, 'cart'], [1290, 700, 24, 'stump'],
    [1530, 1085, 30, 'boulder'], [1720, 690, 32, 'boulder'],
    [2470, 1200, 34, 'boulder'], [2680, 790, 24, 'rack'], [2960, 600, 26, 'fire'], [3520, 1000, 22, 'rack'], [3640, 600, 34, 'boulder'], [3580, 1200, 28, 'stump'],
    [4110, 1240, 22, 'stump'], [4250, 640, 30, 'boulder'], [4330, 1190, 26, 'boulder'],
];

const trSmooth = t => t * t * (3 - 2 * t);
// The walkable half-height around the road at x: forest 300, clearing 650, riverbank 520; beyond the river only the road
function trailHalf(x) {
    return 300 + 350 * trSmooth(clamp01((x - 1925) / 150)) - 130 * trSmooth(clamp01((x - 3825) / 150));
}
function trailRoadY(x) { for (let i = 1; i < TR_ROAD.length; i++) { const [ax, ay] = TR_ROAD[i - 1], [bx, by] = TR_ROAD[i]; if (x <= bx) return ay + (by - ay) * clamp01((x - ax) / (bx - ax)); } return 900; }
function trailRoadDist(x, y) { let d = 1e9; for (let i = 1; i < TR_ROAD.length; i++) d = Math.min(d, distToSegment(x, y, ...TR_ROAD[i - 1], ...TR_ROAD[i])); return d; }
function trNearCamp(x, y) {
    if (Math.hypot(x - TR_CAMP.fire.x, y - TR_CAMP.fire.y) < 230) return true;
    return TR_CAMP.huts.some(b => Math.hypot(x - (b.x0 + b.w / 2), y - (b.y0 + b.h / 2)) < 150);
}

function buildTrail() {
    if (trl.built) return;
    const D = STAGE_MAPS.trail;
    D.grid = trGenerate(D);
    trl.grid = D.grid;
    trPaint(D, D.grid);
    trl.built = true;
}

// Start of every visit: both logjams and the gate are shut again, the hero is back at the forest road
function resetTrail() {
    for (const cells of trl.jamCells) for (const i of cells) trl.grid.data[i] = T_SEAL;
    for (const i of trl.gateCells) trl.grid.data[i] = T_SEAL;
    for (const J of trl.jam) J.k = 0;
    trl.open = 0; trl.gateOpen = false; trl.gateK = 0; trl.promptAt = 0; trl.lastSpawn = null;
}

// Calls fn(i) for every cell whose centre lies within r of (x, y)
function trBlob(G, x, y, r, fn) {
    const cs = G.cell;
    for (let gy = Math.max(0, Math.floor((y - r) / cs)); gy <= Math.min(G.rows - 1, Math.floor((y + r) / cs)); gy++)
        for (let gx = Math.max(0, Math.floor((x - r) / cs)); gx <= Math.min(G.cols - 1, Math.floor((x + r) / cs)); gx++)
            if (Math.hypot((gx + 0.5) * cs - x, (gy + 0.5) * cs - y) < r) fn(gy * G.cols + gx);
}

// The mix per section (enemies.json keeps its own weights for Endless): the forest road has no riders, the clearing has room for them
const TR_MIX = [{ slinger: 0.40, trapper: 0.25, hound: 0.20, bannerman: 0.15, horse: 0 }, { slinger: 0.30, horse: 0.22, trapper: 0.20, bannerman: 0.13, hound: 0.15 }];
const TR_CAP = { horse: 2, hound: 4 }; // most of each alive at once on the trail (the Beastmaster's hounds count)
const trailAlive = type => enemies.filter(e => !e.dead && !e.prop && e.type === type).length;
const trailRoom = type => Math.max(0, (TR_CAP[type] || 99) - trailAlive(type)); // how many more may spawn (a pack asks after its first hound is already in)
function trailMinions(list) {
    const mix = TR_MIX[trl.open > 0 ? 1 : 0];
    const out = list.map(m => ({ ...m, weight: m.type in mix ? mix[m.type] : m.weight })).filter(m => m.weight > 0 && trailRoom(m.type) > 0);
    return out.length ? out : list;
}

// Entering the trail at a wave: a jump straight to wave 8 / 10 (dev console) opens the logjams behind it and starts in the newest section.
// Normal play already has the right sections open, so nothing moves.
function trailEnter(w) {
    const need = w >= 10 ? 2 : w >= 8 ? 1 : 0;
    if (trl.open === need) return;
    if (trl.open > need) resetTrail(); // jumped back: everything shuts again
    stageEvent = null; showStagePrompt(false);
    for (let j = 0; j < need; j++) { for (const i of trl.jamCells[j]) trl.grid.data[i] = T_FLOOR; trl.jam[j].k = 1; }
    trl.open = need;
    const x = need === 2 ? 4000 : need === 1 ? 2150 : STAGE_MAPS.trail.start.x;
    player.x = x; player.y = need ? trailRoadY(x) : STAGE_MAPS.trail.start.y;
    updateNav(true); updateCamera(0, true);
}

// ---------- generation ----------

function trGenerate(D) {
    const cs = D.cell, cols = D.w / cs, rows = D.h / cs, n = cols * rows, data = new Uint8Array(n), forest = new Uint8Array(n), N = cavNoise(5513), rnd = clrRng(4417);
    const cxOf = i => (i % cols + 0.5) * cs, cyOf = i => (Math.floor(i / cols) + 0.5) * cs;
    const G = { cols, rows, cell: cs, data, forest, thicket: new Uint8Array(n) }; // thicket: the low bushes (T_FENCE == T_RAVINE, so not the data)
    const B = TR_BRIDGE, C = TR_CAMP;
    // the river: a wobbly band that runs the whole height of the map, one pair of banks per row
    trl.riverL = []; trl.riverR = [];
    for (let r = 0; r < rows; r++) { const y = (r + 0.5) * cs; trl.riverL.push(TR_RIVER[0] + (N(7000, y) - 0.5) * 70); trl.riverR.push(TR_RIVER[1]); }
    // the corridor is open ground, everything else forest; the river is water (no trees)
    for (let i = 0; i < n; i++) {
        const x = cxOf(i), y = cyOf(i), r = Math.floor(i / cols);
        if (x > trl.riverL[r] && x < trl.riverR[r]) { data[i] = T_RAVINE; continue; }
        const f = x < 25 || Math.abs(y - trailRoadY(x)) >= trailHalf(x) + (N(x, y) - 0.5) * 140;
        forest[i] = f ? 1 : 0; data[i] = f ? T_WALL : T_FLOOR;
    }
    // the camp: wall blocks with a doorway notch cut into the side they face
    for (const b of C.huts) {
        const gx0 = Math.floor(b.x0 / cs), gy0 = Math.floor(b.y0 / cs), gw = Math.ceil((b.x0 + b.w) / cs) - gx0, gh = Math.ceil((b.y0 + b.h) / cs) - gy0, mx = gx0 + Math.floor(gw / 2), my = gy0 + Math.floor(gh / 2);
        for (let gy = gy0; gy < gy0 + gh; gy++) for (let gx = gx0; gx < gx0 + gw; gx++) data[gy * cols + gx] = T_WALL;
        const door = b.door === 'e' ? [[gx0 + gw - 1, my - 1], [gx0 + gw - 1, my]] : b.door === 'w' ? [[gx0, my - 1], [gx0, my]]
            : b.door === 'n' ? [[mx - 1, gy0], [mx, gy0]] : [[mx - 1, gy0 + gh - 1], [mx, gy0 + gh - 1]];
        for (const [gx, gy] of door) data[gy * cols + gx] = T_FLOOR;
    }
    // clumps of trees inside the forest road, away from its middle
    const clumps = trl.clumps = [];
    for (let k = 0, tries = 0; k < 12 && tries < 300; tries++) {
        const x = 150 + rnd() * 1730, y = trailRoadY(x) + (rnd() < 0.5 ? -1 : 1) * (150 + rnd() * 70), r = 60 + rnd() * 50;
        if (trailRoadDist(x, y) < 140) continue;
        clumps.push({ x, y, r }); k++;
        trBlob(G, x, y, r, i => { data[i] = T_WALL; forest[i] = 1; });
    }
    // thickets of low bushes: walkers go round them, leaps and shots pass over
    for (let k = 0; k < 14; k++) {
        const clearing = k >= 6, x = clearing ? 2150 + rnd() * 1650 : 380 + rnd() * 1450, y = trailRoadY(x) + (rnd() < 0.5 ? -1 : 1) * (80 + rnd() * 170), r = 28 + rnd() * 20;
        if (clearing && trNearCamp(x, y)) continue;
        trBlob(G, x, y, r, i => {
            const ix = (i % cols + 0.5) * cs, iy = (Math.floor(i / cols) + 0.5) * cs;
            if (data[i] === T_FLOOR && trailRoadDist(ix, iy) > 60) { data[i] = T_FENCE; G.thicket[i] = 1; }
        });
    }
    // the stone bridge over the river, with blocks of bank either side of it so there's no way round the gate
    for (let i = 0; i < n; i++) {
        const x = cxOf(i), y = cyOf(i), dy = Math.abs(y - B.y);
        if (x >= B.x0 && x < B.x1 && dy < B.hh) { data[i] = T_FLOOR; forest[i] = 0; }
        else if (x >= B.x0 && x < 4600 && dy < B.hh + 25) data[i] = T_WALL; // abutments: the bank beside the bridge
    }
    // the bridgehead gate across the bridge's west end
    trl.gateCells = [];
    for (let i = 0; i < n; i++) {
        const x = cxOf(i), y = cyOf(i);
        if (x >= TR_GATE.x0 && x < TR_GATE.x1 && Math.abs(y - TR_GATE.y) < B.hh && data[i] === T_FLOOR) { data[i] = T_SEAL; trl.gateCells.push(i); }
    }
    // the two logjams: felled trunks across the whole road
    trl.jamCells = [[], []];
    for (let j = 0; j < 2; j++) for (let i = 0; i < n; i++) {
        const x = cxOf(i);
        if (x >= TR_JAM[j].x0 && x < TR_JAM[j].x1 && data[i] === T_FLOOR) { data[i] = T_SEAL; trl.jamCells[j].push(i); }
    }
    trl.jam = TR_JAM.map((J, j) => {
        const ys = trl.jamCells[j].map(i => cyOf(i)), y0 = Math.min(...ys) - cs / 2, y1 = Math.max(...ys) + cs / 2;
        return { x0: J.x0, x1: J.x1, y0, y1, k: 0, trunks: trJamPile({ x0: J.x0, x1: J.x1, y0, y1 }, rnd) };
    });
    // everything the hero can't reach from the start (pockets in the trees) becomes rock; logjams and the gate are passable for the search
    const seen = new Uint8Array(n), start = Math.floor(D.start.y / cs) * cols + Math.floor(D.start.x / cs), q = [start];
    seen[start] = 1;
    while (q.length) {
        const i = q.pop(), gx = i % cols;
        for (const j of [gx > 0 ? i - 1 : -1, gx < cols - 1 ? i + 1 : -1, i - cols, i + cols]) if (j >= 0 && j < n && !seen[j] && (data[j] === T_FLOOR || data[j] === T_SEAL)) { seen[j] = 1; q.push(j); }
    }
    for (let i = 0; i < n; i++) if (!seen[i] && data[i] === T_FLOOR) data[i] = T_WALL;
    // solid things: only on open floor
    D.obstacles.length = 0;
    const nearTrees = (x, y, d) => { for (let oy = -d; oy <= d; oy += cs) for (let ox = -d; ox <= d; ox += cs) { const gx = Math.floor((x + ox) / cs), gy = Math.floor((y + oy) / cs); if (gx >= 0 && gy >= 0 && gx < cols && gy < rows && forest[gy * cols + gx]) return true; } return false; };
    for (const [x, y, r, kind] of TR_PROPS) if (data[Math.floor(y / cs) * cols + Math.floor(x / cs)] === T_FLOOR && !nearTrees(x, y, r + 75)) D.obstacles.push({ x, y, r, kind, seed: rnd() * 10 }); // never half under the canopy
    trl.spawns = trSpawns(G);
    trl.nearTrees = trNearTreesGrid(G);
    return G;
}

// Where bandits can step out: the tree line of each section (just inside it, with a point in the trees to step out of)
// and the doorways of the camp
function trSpawns(G) {
    const cs = G.cell, out = [];
    const fAt = (x, y) => { const gx = Math.floor(x / cs), gy = Math.floor(y / cs); return gx < 0 || gy < 0 || gx >= G.cols || gy >= G.rows ? 1 : G.forest[gy * G.cols + gx]; };
    const floorAt = (x, y) => G.data[Math.floor(y / cs) * G.cols + Math.floor(x / cs)] === T_FLOOR;
    const edge = (x, sec) => {
        for (const dir of [-1, 1]) {
            let y = trailRoadY(x), g = 0;
            while (!fAt(x, y) && g++ < 80) y += dir * cs;
            if (g >= 80) continue;
            const sy = y - dir * 40;
            if (floorAt(x, sy)) out.push({ x, y: sy, ox: x, oy: y + dir * 30, from: 'forest', sec });
        }
    };
    for (let x = 150; x < 1900; x += 130) edge(x, 0);
    for (let x = 2050; x < 3850; x += 150) edge(x, 1);
    for (let x = 3990; x < 4500; x += 110) edge(x, 2);
    for (const b of TR_CAMP.huts) { const p = trDoor(b); if (floorAt(p.x, p.y)) out.push({ x: p.x, y: p.y, ox: p.ox, oy: p.oy, from: 'door', sec: 1 }); }
    return out;
}
// The spot just outside a hut's doorway, and a point inside it
function trDoor(b) {
    const mx = b.x0 + b.w / 2, my = b.y0 + b.h / 2;
    const p = { e: [b.x0 + b.w + 34, my, b.x0 + b.w - 8, my], w: [b.x0 - 34, my, b.x0 + 8, my], n: [mx, b.y0 - 34, mx, b.y0 + 8], s: [mx, b.y0 + b.h + 34, mx, b.y0 + b.h - 8] }[b.door];
    return { x: p[0], y: p[1], ox: p[2], oy: p[3] };
}

// Coarse 100 px grid: true where a forest cell lies within 220 px. Far from the trees the canopy is drawn in one go.
function trNearTreesGrid(G) {
    const cs = G.cell, gw = Math.ceil(G.cols * cs / 100), gh = Math.ceil(G.rows * cs / 100), out = new Uint8Array(gw * gh);
    for (let gy = 0; gy < gh; gy++) for (let gx = 0; gx < gw; gx++) {
        const px = gx * 100 + 50, py = gy * 100 + 50, ccx = Math.floor(px / cs), ccy = Math.floor(py / cs);
        let hit = 0;
        for (let oy = -9; oy <= 9 && !hit; oy++) for (let ox = -9; ox <= 9 && !hit; ox++) {
            const x = ccx + ox, y = ccy + oy;
            if (x < 0 || y < 0 || x >= G.cols || y >= G.rows || !G.forest[y * G.cols + x]) continue;
            if (Math.hypot((x + 0.5) * cs - px, (y + 0.5) * cs - py) <= 220) hit = 1;
        }
        out[gy * gw + gx] = hit;
    }
    return { gw, data: out };
}
function trNear(x, y) {
    const N = trl.nearTrees, gx = Math.floor(x / 100), gy = Math.floor(y / 100), v = N.data[gy * N.gw + gx];
    return v === undefined ? true : v === 1;
}

// ---------- the cached ground and canopy ----------

function trPaint(D, G) {
    const W = D.w, H = D.h, rnd = clrRng(3305), cs = G.cell, cols = G.cols, rows = G.rows;
    const g = cavCanvas(W, H), c = g.getContext('2d'); c.lineCap = 'round'; c.lineJoin = 'round';
    const fAt = (x, y) => { const gx = Math.floor(x / cs), gy = Math.floor(y / cs); return gx < 0 || gy < 0 || gx >= cols || gy >= rows ? 1 : G.forest[gy * cols + gx]; };
    const rl = trl.riverL, rr = trl.riverR, rowY = r => r * cs + cs / 2;

    // --- sunny meadow ---
    c.fillStyle = '#4f6b2e'; c.fillRect(0, 0, W, H);
    for (let i = 0; i < 80; i++) {
        const x = rnd() * W, y = rnd() * H, r = 120 + rnd() * 280, k = rnd();
        const gr = c.createRadialGradient(x, y, 0, x, y, r);
        gr.addColorStop(0, k < 0.45 ? 'rgba(96, 130, 52, 0.42)' : k < 0.75 ? 'rgba(170, 160, 80, 0.2)' : 'rgba(34, 52, 22, 0.35)'); gr.addColorStop(1, 'rgba(0, 0, 0, 0)');
        c.fillStyle = gr; c.fillRect(x - r, y - r, r * 2, r * 2);
    }
    const blades = ['#6b9440', '#557d32', '#7fa84c', '#46682a', '#93ad58', '#5f8a3a'];
    c.lineWidth = 1.4;
    for (let i = 0; i < 30000; i++) {
        const x = rnd() * W, y = rnd() * H, l = 4 + rnd() * 6, a = -Math.PI / 2 + (rnd() - 0.5) * 1.1;
        c.strokeStyle = blades[(rnd() * blades.length) | 0]; c.globalAlpha = 0.4 + rnd() * 0.35;
        c.beginPath(); c.moveTo(x, y); c.quadraticCurveTo(x + Math.cos(a) * l * 0.5 + 1.5, y + Math.sin(a) * l * 0.5, x + Math.cos(a) * l, y + Math.sin(a) * l); c.stroke();
    }
    c.globalAlpha = 1;

    // --- the road from the west, through the clearing, over the bridge ---
    const road = () => { c.beginPath(); c.moveTo(...TR_ROAD[0]); for (let i = 1; i < TR_ROAD.length - 1; i++) c.quadraticCurveTo(TR_ROAD[i][0], TR_ROAD[i][1], (TR_ROAD[i][0] + TR_ROAD[i + 1][0]) / 2, (TR_ROAD[i][1] + TR_ROAD[i + 1][1]) / 2); c.lineTo(...TR_ROAD[TR_ROAD.length - 1]); };
    for (const [w, col, a] of [[132, '#55612f', 0.4], [106, '#6f5a3a', 0.75], [90, '#86704a', 0.9], [42, '#8c7752', 0.6], [30, '#7b6844', 1], [52, '#9a8560', 0.3]]) { c.globalAlpha = a; c.strokeStyle = col; c.lineWidth = w; road(); c.stroke(); } // the 42 / 30 pair leaves two cart ruts
    c.globalAlpha = 1;
    for (let i = 0; i < 900; i++) { // grit, stones and hoof prints along it
        const k = rnd() * (TR_ROAD.length - 1), s = Math.floor(k), u = k - s, [ax, ay] = TR_ROAD[s], [bx, by] = TR_ROAD[s + 1];
        const x = ax + (bx - ax) * u + (rnd() - 0.5) * 90, y = ay + (by - ay) * u + (rnd() - 0.5) * 80;
        c.fillStyle = rnd() < 0.5 ? 'rgba(74, 58, 38, 0.5)' : 'rgba(176, 152, 112, 0.45)';
        c.beginPath(); c.ellipse(x, y, 1 + rnd() * 2.6, 1 + rnd() * 1.8, rnd() * 3, 0, Math.PI * 2); c.fill();
    }

    // --- the river: mud banks, then shallows, then deep water down the middle ---
    const band = (inset, col) => {
        c.fillStyle = col; c.beginPath(); c.moveTo(rl[0] + inset, 0);
        for (let r = 0; r < rows; r++) c.lineTo(rl[r] + inset, rowY(r));
        c.lineTo(rl[rows - 1] + inset, H); c.lineTo(rr[rows - 1] - inset, H);
        for (let r = rows - 1; r >= 0; r--) c.lineTo(rr[r] - inset, rowY(r));
        c.lineTo(rr[0] - inset, 0); c.closePath(); c.fill();
    };
    band(-14, '#4a3d2a'); band(-6, '#2e5a5c'); band(10, '#1d3a40');
    c.strokeStyle = 'rgba(190, 230, 220, 0.12)'; c.lineWidth = 2;
    for (let i = 0; i < 90; i++) { const y = rnd() * H, r = Math.min(rows - 1, Math.floor(y / cs)), x = rl[r] + 24 + rnd() * (W - rl[r] - 48); c.beginPath(); c.moveTo(x, y); c.lineTo(x + 26, y + 2); c.stroke(); }
    for (let r = 0; r < rows; r += 2) for (let k = 0; k < 2; k++) { // reeds along the west bank
        const x = rl[r] - 4 - rnd() * 14, y = rowY(r) + (rnd() - 0.5) * 20, h = 14 + rnd() * 12, lean = (rnd() - 0.5) * 6;
        c.strokeStyle = rnd() < 0.5 ? '#7d8c3a' : '#8f9a4a'; c.lineWidth = 2; c.beginPath(); c.moveTo(x, y); c.lineTo(x + lean, y - h); c.stroke();
        c.fillStyle = '#8f7a45'; c.beginPath(); c.ellipse(x + lean, y - h, 1.8, 3.6, lean * 0.1, 0, Math.PI * 2); c.fill();
    }
    for (let i = 0; i < 10; i++) { const r = Math.floor(rnd() * rows), x = rl[r] - 22 - rnd() * 30; clrRock(c, x, rowY(r), 8 + rnd() * 6, rnd, false); } // rocks on the banks

    // --- the stone bridge: slabs in rows, a parapet on each side, bridgehead pillars ---
    const BR = TR_BRIDGE;
    c.fillStyle = '#4e4a42'; c.fillRect(BR.x0, BR.y - BR.hh - 12, BR.x1 - BR.x0, BR.hh * 2 + 24);
    for (let row = 0, y = BR.y - BR.hh + 5; y < BR.y + BR.hh; y += 25, row++) for (let x = BR.x0 - ((row % 2) * 18); x < BR.x1; x += 36) {
        const x0 = Math.max(BR.x0, x), x1 = Math.min(BR.x1, x + 36); if (x1 <= x0) continue;
        c.fillStyle = rnd() < 0.5 ? '#8a857a' : '#6f6a60'; c.fillRect(x0, y, x1 - x0, 25);
        c.fillStyle = 'rgba(255, 250, 235, 0.09)'; c.fillRect(x0, y, x1 - x0, 3); // lit top edge
        c.strokeStyle = '#4e4a42'; c.lineWidth = 1.2; c.strokeRect(x0 + 0.5, y + 0.5, x1 - x0 - 1, 24);
    }
    for (const py of [BR.y - BR.hh - 12, BR.y + BR.hh + 3]) { // the parapets
        c.fillStyle = '#5b564e'; c.fillRect(BR.x0, py, BR.x1 - BR.x0, 9);
        c.strokeStyle = '#3e3a34'; c.lineWidth = 1.2; for (let x = BR.x0; x < BR.x1; x += 18) { c.beginPath(); c.moveTo(x, py); c.lineTo(x, py + 9); c.stroke(); }
    }
    for (const py of [850, 950]) { c.fillStyle = 'rgba(8, 6, 4, 0.4)'; c.beginPath(); c.ellipse(4442, py + 5, 20, 16, 0, 0, Math.PI * 2); c.fill(); cavRock(c, 4436, py, 15, rnd, '#8a857a'); } // bridgehead pillars

    // --- flowers in the clearing, and the camp's trampled ground ---
    for (const [x, y, r] of [[2800, 500, 330], [2960, 600, 180], [2440, 1090, 140]]) { const gr = c.createRadialGradient(x, y, 0, x, y, r); gr.addColorStop(0, 'rgba(92, 72, 46, 0.5)'); gr.addColorStop(1, 'rgba(92, 72, 46, 0)'); c.fillStyle = gr; c.fillRect(x - r, y - r, r * 2, r * 2); }
    for (let i = 0; i < 220; i++) {
        const x = 2050 + rnd() * 1800, y = trailRoadY(x) + (rnd() < 0.5 ? -1 : 1) * (80 + rnd() * 480);
        if (fAt(x, y) || trNearCamp(x, y)) continue;
        for (let j = 0; j < 4; j++) { c.strokeStyle = 'rgba(70, 110, 40, 0.8)'; c.lineWidth = 1.2; const a = rnd() * 6; c.beginPath(); c.moveTo(x, y); c.lineTo(x + Math.cos(a) * 6, y + Math.sin(a) * 6); c.stroke(); }
        for (let j = 0; j < 6; j++) { c.fillStyle = ['#f2e27a', '#fbf6e6', '#d98fd6', '#f4a261', '#ffffff'][(rnd() * 5) | 0]; c.beginPath(); c.arc(x + (rnd() - 0.5) * 12, y + (rnd() - 0.5) * 12, 1.6 + rnd() * 1.4, 0, Math.PI * 2); c.fill(); }
    }

    // --- tufts of taller grass, clover, pebbles and fallen twigs, so the open ground isn't a flat sheet ---
    for (let i = 0; i < 900; i++) {
        const x = 60 + rnd() * (W - 120), y = 60 + rnd() * (H - 120); if (fAt(x, y) || trailRoadDist(x, y) < 70 || (x > rl[0] - 40 && x < rr[0] + 40)) continue;
        const k = rnd();
        if (k < 0.5) { for (let j = 0; j < 7; j++) { const a = -Math.PI / 2 + (j - 3) * 0.28 + (rnd() - 0.5) * 0.2, l = 8 + rnd() * 7; c.strokeStyle = j % 2 ? '#3f5f24' : '#5d8236'; c.lineWidth = 1.4; c.beginPath(); c.moveTo(x, y); c.quadraticCurveTo(x + Math.cos(a) * l * 0.5, y + Math.sin(a) * l * 0.5 + 1, x + Math.cos(a) * l, y + Math.sin(a) * l); c.stroke(); } }
        else if (k < 0.7) { for (let j = 0; j < 5; j++) { const cx2 = x + (rnd() - 0.5) * 16, cy2 = y + (rnd() - 0.5) * 12; c.fillStyle = '#4f7a2c'; for (let q = 0; q < 3; q++) { c.beginPath(); c.arc(cx2 + Math.cos(q * 2.1) * 2, cy2 + Math.sin(q * 2.1) * 2, 2, 0, Math.PI * 2); c.fill(); } } } // clover
        else if (k < 0.85) { c.fillStyle = '#7d776c'; c.beginPath(); c.ellipse(x, y, 2 + rnd() * 3, 1.5 + rnd() * 2, rnd() * 3, 0, Math.PI * 2); c.fill(); c.fillStyle = 'rgba(255, 255, 255, 0.25)'; c.fillRect(x - 1, y - 1.5, 1.4, 1); } // a pebble
        else { c.save(); c.translate(x, y); c.rotate(rnd() * 3); c.strokeStyle = '#4a3420'; c.lineWidth = 1.6; c.beginPath(); c.moveTo(-9, 0); c.lineTo(9, 0); c.moveTo(2, 0); c.lineTo(6, -4); c.stroke(); c.restore(); } // a fallen twig
    }

    // --- the hunting camp ---
    for (const b of TR_CAMP.huts) {
        c.save(); c.beginPath(); c.rect(b.x0 - 10, b.y0 - 10, b.w + 20, b.h + 20); c.clip();
        c.fillStyle = 'rgba(96, 76, 50, 0.5)'; c.fillRect(b.x0 - 10, b.y0 - 10, b.w + 20, b.h + 20); c.restore(); // trodden earth round each hut
        if (b.kind === 'tent') trTent(c, b, rnd); else trKennel(c, b, rnd);
    }
    trHide(c, TR_CAMP.hide, rnd);
    for (const [x, y, a] of TR_CAMP.logs) trLog(c, x, y, a);
    const F = TR_CAMP.fire;
    c.fillStyle = '#2a2420'; c.beginPath(); c.arc(F.x, F.y, 24, 0, Math.PI * 2); c.fill(); // the ash bed
    c.strokeStyle = '#1a120c'; c.lineWidth = 5; c.beginPath(); c.moveTo(F.x - 12, F.y - 8); c.lineTo(F.x + 14, F.y + 10); c.moveTo(F.x + 12, F.y - 10); c.lineTo(F.x - 10, F.y + 12); c.stroke();
    for (let i = 0; i < 9; i++) { const a = i / 9 * Math.PI * 2; cavRock(c, F.x + Math.cos(a) * 30, F.y + Math.sin(a) * 30, 7, rnd, '#7a746a'); } // the stone ring

    // --- forest floor under the trees, with undergrowth along its edge and in the thickets ---
    // a soft, noise-roughened mask (map_cavern.js cavMask) instead of blurred cells: square cell corners used to show at the tree line
    const FM = cavMask({ cols, rows, cell: cs, data: G.forest }, v => v === 1, 0.55, cavNoiseArr(W / 2, H / 2, rnd));
    const ff = cavCanvas(W, H), fc = ff.getContext('2d');
    fc.fillStyle = '#16240f'; fc.fillRect(0, 0, W, H); fc.globalCompositeOperation = 'destination-in'; fc.drawImage(FM, 0, 0, W, H);
    c.drawImage(ff, 0, 0); ff.width = 1;
    for (let i = 0; i < cols * rows; i++) {
        if (!G.forest[i] || rnd() > 0.5) continue;
        const gx = i % cols, gy = Math.floor(i / cols), x = (gx + 0.5) * cs, y = (gy + 0.5) * cs;
        if (!fAt(x + cs, y) || !fAt(x - cs, y) || !fAt(x, y + cs) || !fAt(x, y - cs)) trBush(c, x + (rnd() - 0.5) * 20, y + (rnd() - 0.5) * 20, 11 + rnd() * 8, rnd);
    }
    for (let i = 0; i < cols * rows; i++) if (G.thicket[i]) { const x = (i % cols + 0.5) * cs, y = (Math.floor(i / cols) + 0.5) * cs; trBush(c, x, y, 15 + rnd() * 7, rnd); if (rnd() < 0.6) trBush(c, x + (rnd() - 0.5) * 20, y + (rnd() - 0.5) * 20, 12 + rnd() * 6, rnd); }

    // --- solid things ---
    for (const o of D.obstacles) trProp(c, o, rnd);

    // --- crowns: along the tree lines and over the clumps; their shadows fall on the ground ---
    const crowns = [];
    for (let x = -40; x < W + 60; x += 55 + rnd() * 45) {
        let y = 0; while (y < H / 2 && fAt(x, y)) y += cs;
        if (y > 0) for (const dpt of [30, 110, 200, 290]) if (y - dpt > -80) crowns.push({ x: x + (rnd() - 0.5) * 30, y: y - dpt + rnd() * 30, r: 50 + rnd() * 34 });
        y = H; while (y > H / 2 && fAt(x, y - 1)) y -= cs;
        if (y < H) for (const dpt of [30, 110, 200, 290]) if (y + dpt < H + 80) crowns.push({ x: x + (rnd() - 0.5) * 30, y: y + dpt - rnd() * 30, r: 50 + rnd() * 34 });
    }
    for (const C of trl.clumps) for (let k = 0; k < 4; k++) crowns.push({ x: C.x + (rnd() - 0.5) * C.r * 1.2, y: C.y + (rnd() - 0.5) * C.r * 1.2, r: 46 + rnd() * 30 });
    // every tree cell that borders open ground must sit well under a crown: where the leaves end is where you're stopped
    const edge = [];
    for (let i = 0; i < cols * rows; i++) {
        if (!G.forest[i]) continue;
        const gx = i % cols, gy = Math.floor(i / cols); let nx = 0, ny = 0;
        for (const [ox, oy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { const x = gx + ox, y = gy + oy; if (x >= 0 && y >= 0 && x < cols && y < rows && !G.forest[y * cols + x]) { nx += ox; ny += oy; } }
        if (nx || ny) edge.push([(gx + 0.5) * cs, (gy + 0.5) * cs, nx, ny]);
    }
    for (let i = edge.length - 1; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); [edge[i], edge[j]] = [edge[j], edge[i]]; }
    for (const [x, y, nx, ny] of edge) {
        if (crowns.some(t => Math.hypot(t.x - x, t.y - y) < t.r * 0.7)) continue;
        const l = Math.hypot(nx, ny) || 1, r = 50 + rnd() * 24; // centred a little inside the trees, so the crown overhangs the edge
        crowns.push({ x: x - nx / l * r * 0.35, y: y - ny / l * r * 0.35, r });
    }
    for (const t of crowns) {
        const sg = c.createRadialGradient(t.x + 26, t.y + 32, t.r * 0.3, t.x + 26, t.y + 32, t.r * 1.15);
        sg.addColorStop(0, 'rgba(6, 10, 4, 0.5)'); sg.addColorStop(1, 'rgba(6, 10, 4, 0)');
        c.fillStyle = sg; c.beginPath(); c.arc(t.x + 26, t.y + 32, t.r * 1.15, 0, Math.PI * 2); c.fill();
    }
    const cv = cavCanvas(W, H), k = cv.getContext('2d');
    for (const t of crowns) clrCrown(k, t, rnd);
    trl.ground = g; trl.canopy = cv;
}

// A bush: a shadow, a dark base of leaf clusters, lighter clusters toward the light (top-left), leaf flecks, now and then berries
function trBush(c, x, y, s, rnd) {
    c.fillStyle = 'rgba(8, 14, 4, 0.32)'; c.beginPath(); c.ellipse(x + s * 0.35, y + s * 0.5, s * 1.25, s * 0.85, 0, 0, Math.PI * 2); c.fill();
    const blobs = []; for (let k = 0; k < 7; k++) { const a = k / 7 * Math.PI * 2 + rnd(), d = s * (0.35 + rnd() * 0.3); blobs.push([x + Math.cos(a) * d, y + Math.sin(a) * d * 0.85, s * (0.42 + rnd() * 0.18)]); }
    for (const [col, g, ox, oy] of [['#17290f', 1.12, 0, 0], ['#26431a', 1, -0.06, -0.06], ['#3a6526', 0.72, -0.16, -0.18], ['#5a8a38', 0.38, -0.26, -0.28]]) {
        c.fillStyle = col; c.beginPath(); for (const [bx, by, br] of blobs) { c.moveTo(bx + ox * s + br * g, by + oy * s); c.arc(bx + ox * s, by + oy * s, br * g, 0, Math.PI * 2); } c.fill();
    }
    for (let k = 0; k < 9; k++) { const a = rnd() * Math.PI * 2, d = rnd() * s * 0.8; c.fillStyle = rnd() < 0.5 ? 'rgba(150, 200, 90, 0.5)' : 'rgba(10, 20, 6, 0.5)'; c.beginPath(); c.arc(x + Math.cos(a) * d, y + Math.sin(a) * d * 0.85, 1 + rnd() * 1.2, 0, Math.PI * 2); c.fill(); }
    if (rnd() < 0.3) { const col = rnd() < 0.6 ? '#b3261e' : '#e8e0f0'; for (let k = 0; k < 5; k++) { const a = rnd() * Math.PI * 2, d = rnd() * s * 0.6; c.fillStyle = col; c.beginPath(); c.arc(x + Math.cos(a) * d, y + Math.sin(a) * d, 1.6, 0, Math.PI * 2); c.fill(); } }
}

// A canvas A-frame tent from above: the ridge pole along the long side poking out at both ends, two slopes (the
// north / west one lit) with the cloth sagging between the poles at the eaves, panel seams, patches, guy ropes out
// to pegs, and the door flap tied back on the side it faces with the dark inside showing.
function trTent(c, b, rnd) {
    const { x0, y0, w, h, door } = b, long = w >= h, L = long ? w : h, S = long ? h : w;
    c.save(); c.filter = 'blur(7px)'; c.fillStyle = 'rgba(12, 10, 6, 0.45)'; c.fillRect(x0 + 14, y0 + 16, w, h); c.restore();
    c.save(); c.translate(x0 + w / 2, y0 + h / 2); if (!long) c.rotate(Math.PI / 2);
    const lit = long ? -1 : 1; // which local side (y < 0 or > 0) is the north or west slope
    const sideOf = { e: long ? 'endR' : 'side+', w: long ? 'endL' : 'side-', n: long ? 'side-' : 'endL', s: long ? 'side+' : 'endR' }[door];
    const cloth = '#cbb68a', hl = L / 2, hs = S / 2, sag = 4;
    for (const sgn of [-1, 1]) { // the two slopes, each from the ridge out to a sagging eave
        c.beginPath(); c.moveTo(-hl, 0); c.lineTo(-hl, sgn * hs); c.quadraticCurveTo(-hl / 2, sgn * (hs - sag), 0, sgn * hs); c.quadraticCurveTo(hl / 2, sgn * (hs - sag), hl, sgn * hs); c.lineTo(hl, 0); c.closePath();
        const g = c.createLinearGradient(0, 0, 0, sgn * hs), base = sgn === lit ? sprShade(cloth, 0.06) : sprShade(cloth, -0.38);
        g.addColorStop(0, sgn === lit ? sprShade(cloth, 0.22) : sprShade(cloth, -0.2)); g.addColorStop(1, base); c.fillStyle = g; c.fill(); // the slope away from the light is well in shadow
        c.strokeStyle = 'rgba(70, 54, 32, 0.4)'; c.lineWidth = 1; c.beginPath(); // panel seams running down to the eave
        for (let i = 1; i < 4; i++) { const x = -hl + L * i / 4; c.moveTo(x, 0); c.lineTo(x + (rnd() - 0.5) * 3, sgn * (hs - sag * 0.6)); }
        c.stroke();
    }
    for (let i = 0; i < 2; i++) { // patches, stitched on
        const sgn = rnd() < 0.5 ? -1 : 1, px = (rnd() - 0.5) * L * 0.6, py = sgn * (hs * 0.25 + rnd() * hs * 0.35), pw = 12 + rnd() * 8, ph = 8 + rnd() * 6;
        c.fillStyle = sgn === lit ? '#a8915f' : '#8a7448'; c.fillRect(px - pw / 2, py - ph / 2, pw, ph);
        c.strokeStyle = 'rgba(50, 36, 20, 0.7)'; c.lineWidth = 0.8; c.setLineDash([2, 2]); c.strokeRect(px - pw / 2 + 1, py - ph / 2 + 1, pw - 2, ph - 2); c.setLineDash([]);
    }
    c.fillStyle = 'rgba(60, 46, 26, 0.25)'; c.beginPath(); c.ellipse((rnd() - 0.5) * L * 0.4, lit * -hs * 0.5, 10, 5, 0, 0, Math.PI * 2); c.fill(); // a weather stain
    c.strokeStyle = '#3b2c1c'; c.lineWidth = 1.8; c.beginPath(); c.moveTo(-hl, -hs); c.quadraticCurveTo(-hl / 2, -hs + sag, 0, -hs); c.quadraticCurveTo(hl / 2, -hs + sag, hl, -hs); c.lineTo(hl, hs); c.quadraticCurveTo(hl / 2, hs - sag, 0, hs); c.quadraticCurveTo(-hl / 2, hs - sag, -hl, hs); c.closePath(); c.stroke(); // the outline
    sprStroke(c, '#4a3420', 3, () => { c.moveTo(-hl - 6, 0); c.lineTo(hl + 6, 0); }); // the ridge pole, poking out at both ends
    c.strokeStyle = 'rgba(30, 22, 12, 0.8)'; c.lineWidth = 1.1; c.fillStyle = '#2a1d13'; // guy ropes from the eaves to pegs in the grass
    for (const [px, py, qx, qy] of [[-hl - 6, 0, -hl - 20, 0], [hl + 6, 0, hl + 20, 0], [-hl * 0.5, -hs, -hl * 0.55, -hs - 16], [hl * 0.5, -hs, hl * 0.55, -hs - 16], [-hl * 0.5, hs, -hl * 0.55, hs + 16], [hl * 0.5, hs, hl * 0.55, hs + 16]]) {
        c.beginPath(); c.moveTo(px, py); c.lineTo(qx, qy); c.stroke(); c.beginPath(); c.arc(qx, qy, 1.8, 0, Math.PI * 2); c.fill();
    }
    // the door: on a gable end, a dark triangle with the flap folded back; on a long side, a dark slit with the flap pulled aside
    c.fillStyle = '#100b06';
    if (sideOf === 'endR' || sideOf === 'endL') {
        const e = sideOf === 'endR' ? 1 : -1;
        c.beginPath(); c.moveTo(e * hl, -hs * 0.55); c.lineTo(e * (hl - 16), 0); c.lineTo(e * hl, hs * 0.55); c.closePath(); c.fill();
        c.beginPath(); c.moveTo(e * hl, -hs * 0.55); c.lineTo(e * (hl + 6), -hs * 0.6); c.lineTo(e * hl, -hs * 0.05); c.closePath(); sprFill(c, sprShade(cloth, -0.05)); // the flap tied back
    } else {
        const e = sideOf === 'side+' ? 1 : -1;
        c.beginPath(); c.moveTo(-9, e * hs); c.lineTo(0, e * (hs - 14)); c.lineTo(9, e * hs); c.closePath(); c.fill();
        c.beginPath(); c.moveTo(9, e * hs); c.lineTo(15, e * (hs + 4)); c.lineTo(3, e * (hs - 6)); c.closePath(); sprFill(c, sprShade(cloth, -0.05));
    }
    c.restore();
}

// A kennel from above: a pitched plank roof, iron bars across the doorway, straw spilling out, gnawed bones, a water trough
function trKennel(c, b, rnd) {
    const { x0, y0, w, h, door } = b, x1 = x0 + w, y1 = y0 + h, cx = x0 + w / 2, cy = y0 + h / 2;
    c.save(); c.filter = 'blur(7px)'; c.fillStyle = 'rgba(12, 10, 6, 0.5)'; c.fillRect(x0 + 12, y0 + 14, w, h); c.restore();
    const out = { e: [1, 0], w: [-1, 0], n: [0, -1], s: [0, 1] }[door], dx = cx + out[0] * (w / 2 + 18), dy = cy + out[1] * (h / 2 + 18);
    c.fillStyle = 'rgba(190, 160, 80, 0.55)'; for (let k = 0; k < 40; k++) { const a = rnd() * Math.PI * 2, d = rnd() * 22; c.save(); c.translate(dx + Math.cos(a) * d, dy + Math.sin(a) * d); c.rotate(rnd() * 3); c.fillRect(-4, -0.6, 8, 1.2); c.restore(); } // straw kicked out
    for (let k = 0; k < 2; k++) { const bx = dx + (rnd() - 0.5) * 50, by = dy + (rnd() - 0.5) * 30, a = rnd() * 3; c.save(); c.translate(bx, by); c.rotate(a); c.fillStyle = '#e8e0cc'; c.fillRect(-6, -1.4, 12, 2.8); for (const s of [-1, 1]) { c.beginPath(); c.arc(s * 6, -1.5, 2, 0, Math.PI * 2); c.arc(s * 6, 1.5, 2, 0, Math.PI * 2); c.fill(); } c.restore(); } // gnawed bones
    // the pitched roof: planks running down each slope from a ridge along the long side
    const long = w >= h;
    for (const sgn of [-1, 1]) {
        c.save(); c.beginPath(); if (long) c.rect(x0, sgn < 0 ? y0 : cy, w, h / 2); else c.rect(sgn < 0 ? x0 : cx, y0, w / 2, h); c.clip();
        c.fillStyle = sgn < 0 ? '#7a5634' : '#5a3d24'; c.fillRect(x0, y0, w, h);
        for (let k = 0; long ? k < w : k < h; k += 11) { c.fillStyle = `rgba(0, 0, 0, ${0.15 + rnd() * 0.15})`; if (long) c.fillRect(x0 + k, y0, 1.4, h); else c.fillRect(x0, y0 + k, w, 1.4); } // plank joints
        c.restore();
    }
    sprStroke(c, '#3a2716', 3, () => { if (long) { c.moveTo(x0, cy); c.lineTo(x1, cy); } else { c.moveTo(cx, y0); c.lineTo(cx, y1); } }); // the ridge beam
    c.strokeStyle = '#21160d'; c.lineWidth = 2; c.strokeRect(x0, y0, w, h);
    // the doorway with its iron bars
    const ns = out[1] !== 0, ow = ns ? 30 : 10, oh = ns ? 10 : 30, ox = cx + out[0] * (w / 2 - 5) - ow / 2, oy = cy + out[1] * (h / 2 - 5) - oh / 2;
    c.fillStyle = '#0c0805'; c.fillRect(ox, oy, ow, oh);
    c.strokeStyle = '#78909c'; c.lineWidth = 1.6; c.beginPath(); for (let k = 1; k < 5; k++) { if (ns) { c.moveTo(ox + ow * k / 5, oy); c.lineTo(ox + ow * k / 5, oy + oh); } else { c.moveTo(ox, oy + oh * k / 5); c.lineTo(ox + ow, oy + oh * k / 5); } } c.stroke();
    const tx = x0 - out[0] * 0 + (out[0] === 0 ? w + 14 : 0) - 6, ty = cy + 4; // a water trough beside it
    c.fillStyle = '#5a3d24'; c.strokeStyle = '#21160d'; c.lineWidth = 1.5; c.fillRect(tx, ty - 8, 12, 16); c.strokeRect(tx, ty - 8, 12, 16); c.fillStyle = '#3d5a5c'; c.fillRect(tx + 2, ty - 6, 8, 12);
}

// The trap rack: two A-frame trestles and a crossbar hung with iron bear traps, chains coiled underneath
function trRack(c, o, rnd) {
    c.save(); c.translate(o.x, o.y); c.rotate(0.2);
    c.fillStyle = 'rgba(8, 6, 4, 0.38)'; c.beginPath(); c.ellipse(6, 8, 36, 14, 0, 0, Math.PI * 2); c.fill();
    for (const ex of [-30, 30]) { sprStroke(c, '#4a3420', 3, () => { c.moveTo(ex, -11); c.lineTo(ex, 11); }); sprEllipse(c, ex, -11, 2.6, 2.6, '#3a2716'); sprEllipse(c, ex, 11, 2.6, 2.6, '#3a2716'); } // the trestle legs
    sprStroke(c, '#6b4a2e', 3.6, () => { c.moveTo(-32, 0); c.lineTo(32, 0); }); // the crossbar
    c.strokeStyle = '#546e7a'; c.lineWidth = 1.4; c.setLineDash([2, 1.5]); c.beginPath(); c.arc(-4, 12, 7, 0, Math.PI * 2); c.arc(5, 14, 5, 0, Math.PI * 2); c.stroke(); c.setLineDash([]); // coiled chain
    for (const tx of [-20, 0, 20]) { c.strokeStyle = '#37474f'; c.lineWidth = 1; c.beginPath(); c.moveTo(tx, 0); c.lineTo(tx, 3); c.stroke(); drawBearTrap(c, tx, 6, 0, 7, false); } // bandits.js: the traps hung on hooks
    c.restore();
}

// The hides pegged out to dry between two posts
function trHide(c, h, rnd) {
    const { x, y } = h;
    c.fillStyle = 'rgba(8, 6, 4, 0.35)'; c.beginPath(); c.ellipse(x + 8, y + 10, 52, 22, 0, 0, Math.PI * 2); c.fill();
    c.strokeStyle = '#5a4030'; c.lineWidth = 4; c.beginPath(); c.moveTo(x - 46, y - 14); c.lineTo(x + 46, y - 14); c.stroke();
    for (const px of [-46, 46]) { c.fillStyle = '#3e2a1d'; c.fillRect(x + px - 4, y - 22, 8, 22); }
    for (let i = 0; i < 4; i++) { const hx = x - 36 + i * 22; c.fillStyle = i % 2 ? '#b8966a' : '#a6844f'; c.beginPath(); c.moveTo(hx, y - 14); c.lineTo(hx + 16, y - 14); c.lineTo(hx + 14, y + 16); c.lineTo(hx + 2, y + 18); c.closePath(); c.fill(); c.strokeStyle = '#6b4f2c'; c.lineWidth = 1; c.stroke(); }
}

// A log seat: a felled trunk, bark ridges lit from above, the cut ends showing their rings
function trLog(c, x, y, a) {
    c.save(); c.translate(x, y); c.rotate(a);
    c.fillStyle = 'rgba(8, 6, 4, 0.38)'; c.beginPath(); c.ellipse(4, 6, 25, 8, 0, 0, Math.PI * 2); c.fill();
    trTrunkBody(c, 44, 13, '#5e3f26', 0.4);
    c.restore();
}
// A trunk lying along x: a rounded body, bark ridges, a lit top, the cut ends with their growth rings (logs and the logjams share it)
function trTrunkBody(c, L, th, col, bark) {
    c.beginPath(); c.roundRect(-L / 2, -th / 2, L, th, th * 0.45); c.fillStyle = col; c.fill(); c.strokeStyle = '#21160d'; c.lineWidth = 1.5; c.stroke();
    c.save(); c.clip();
    c.fillStyle = 'rgba(255, 220, 170, 0.16)'; c.fillRect(-L / 2, -th / 2, L, th * 0.3); // the lit top
    c.fillStyle = 'rgba(0, 0, 0, 0.25)'; c.fillRect(-L / 2, th * 0.2, L, th * 0.3); // the shaded underside
    c.strokeStyle = 'rgba(20, 12, 6, 0.5)'; c.lineWidth = 1; c.beginPath(); // bark ridges
    for (let i = 0; i < L / 9; i++) { const x = -L / 2 + 6 + i * 9 + Math.sin(i * 7.3 + bark * 9) * 3, y = -th / 2 + ((i * 0.37 + bark) % 1) * th; c.moveTo(x, y); c.lineTo(x + 6, y + (bark - 0.5) * 2); }
    c.stroke(); c.restore();
    for (const s of [-1, 1]) { // the cut ends
        const ex = s * (L / 2 - th * 0.12);
        c.fillStyle = '#c99d6c'; c.strokeStyle = '#4a2e18'; c.lineWidth = 1.4; c.beginPath(); c.ellipse(ex, 0, th * 0.22, th * 0.48, 0, 0, Math.PI * 2); c.fill(); c.stroke();
        c.lineWidth = 0.8; c.beginPath(); c.ellipse(ex, 0, th * 0.12, th * 0.26, 0, 0, Math.PI * 2); c.stroke();
    }
}

// Solid props: boulders, stumps, the broken cart, the trap racks, the campfire's stones are in the ground pass
function trProp(c, o, rnd) {
    const { x, y, r } = o;
    if (o.kind === 'fire') return; // the stones and ash are painted with the camp; the flames are live
    if (o.kind === 'rack') { trRack(c, o, rnd); return; }
    if (o.kind === 'boulder') clrBoulder(c, o, rnd);
    else if (o.kind === 'stump') clrStump(c, o, rnd);
    else if (o.kind === 'cart') vilCart(c, x, y, o.seed, r * 2, r * 1.1, false, false); // map_village.js: overturned
}

// ---------- spawns ----------

// Bandits step out of the trees of the open section, or out of the camp's doorways, ahead of the hero
function trailSpawnPoint() {
    const G = currentMap.grid, reach = p => !nav.dist || nav.dist[Math.floor(p.y / G.cell) * G.cols + Math.floor(p.x / G.cell)] >= 0;
    const dist = p => Math.hypot(p.x - player.x, p.y - player.y), sec = trl.open;
    const pool = trl.spawns.filter(p => p.sec === sec && reach(p));
    let cand = pool.filter(p => { const d = dist(p); return d > 430 && d < 1300 && p.x > player.x - 150; });
    if (!cand.length) cand = pool.filter(p => dist(p) > 300).sort((a, b) => dist(a) - dist(b)).slice(0, 3);
    if (!cand.length) cand = trl.spawns.filter(reach).sort((a, b) => dist(a) - dist(b)).slice(0, 3);
    const c = cand[(Math.random() * cand.length) | 0] || { x: STAGE_MAPS.trail.start.x + 600, y: STAGE_MAPS.trail.start.y, from: 'forest', ox: STAGE_MAPS.trail.start.x + 570, oy: STAGE_MAPS.trail.start.y };
    trl.lastSpawn = c;
    return { x: c.x + (Math.random() - 0.5) * 16, y: c.y + (Math.random() - 0.5) * 16, from: c.from };
}

// stage.js onEnemySpawned: where it steps in from
function trailOnSpawn(e) {
    const s = trl.lastSpawn; if (!s) return;
    e.spawnT = e.spawnMax = 0.5;
    e.spawnOX = s.ox; e.spawnOY = s.oy; e.facingAngle = Math.atan2(e.y - s.oy, e.x - s.ox);
    if (s.from === 'door') burst(s.ox, s.oy, Math.atan2(e.y - s.oy, e.x - s.ox), 1.2, 6, { kind: 'smoke', color: 'rgba(90, 80, 66, 0.6)', size: 10, speed: [30, 90], life: 0.8, drag: 2, grow: 18 });
    trl.lastSpawn = null;
}

// ---------- per-frame gameplay ----------

function updateTrail(dt) {
    if (!player.dash && !player.grappleTarget) clampToBounds(player, player.radius);
    // the hero stays behind the next closed barrier: the first logjam, then the second, then the gate
    const barX = trl.open === 0 ? TR_JAM[0].x0 : trl.open === 1 ? TR_JAM[1].x0 : trl.gateOpen ? Infinity : TR_GATE.x0;
    if (player.x > barX - player.radius) player.x = barX - player.radius;
    player.wallHit = null; for (const e of enemies) e.wallHit = null;
    if (trl.promptAt && fxTime - trl.promptAt > 4) { trl.promptAt = 0; showStagePrompt(false); } // the 'way is clear' note fades
}

// Regular waves on this map: the logjam in front of the next section rolls aside once its wave is cleared
function trailWaveCleared() {
    if (wave === 7) startLogjamBreak(0);
    else if (wave === 9) startLogjamBreak(1);
}

function startLogjamBreak(i) { stageEvent = { type: 'logjam_break', i, t: 0, blocking: true, creak: 0, opened: false }; }

function updateLogjamBreak(ev, dt) {
    const t = ev.t, J = trl.jam[ev.i], jx = J.x0 + 25, cy = (J.y0 + J.y1) / 2;
    camera.tx = jx - 120; camera.ty = cy;
    if (t < 0.6 && t - ev.creak > 0.2) { // the trunks creak under the strain
        ev.creak = t; addShake(1.2 + t * 2);
        burst(jx + jitter(20), J.y0 + Math.random() * (J.y1 - J.y0), 0, Math.PI * 2, 3, { kind: 'debris', color: '#6b4a2e', size: 3, speed: [40, 140], life: 0.5, drag: 3 });
    }
    J.k = easeOut(clamp01((t - 0.6) / 1.0)); // the trunks roll aside to the corridor edges (drawLogjam)
    if (t > 1.6 && !ev.opened) {
        ev.opened = true; trl.open = ev.i + 1; J.k = 1;
        for (const i of trl.jamCells[ev.i]) trl.grid.data[i] = T_FLOOR;
        updateNav(true); addShake(6);
        burst(jx, cy, 0, Math.PI * 2, 14, { kind: 'debris', color: '#5d4330', size: 4, speed: [80, 260], life: 0.7, drag: 3 });
        for (let k = 0; k < 8; k++) spawnParticle({ kind: 'smoke', color: 'rgba(90, 80, 66, 0.6)', x: jx + jitter(40), y: cy + jitter(160), vx: WIND_X * 40 + jitter(40), vy: jitter(40) + WIND_Y * 30, size: 22, grow: 40, life: 1.4, drag: 1.5, spin: 0, rot: 0 });
        showStagePrompt(true, 'The way is clear &middot; press on'); trl.promptAt = fxTime;
    }
    if (t > 2.6) camera.tx = camera.ty = null;
    if (t > 3.0) stageEvent = null;
}

// The Beastmaster: waits on the bridge beyond the gate, sounds his horn, leaps over the gate onto the hero's bank
function startBeastmasterIntro(b) {
    b.x = 4620; b.y = 900; b.state = 'intro'; b.introZ = 0; b.airborne = false;
    stageEvent = { type: 'beast_intro', t: 0, boss: b, blocking: true, horn: false, landed: false, card: false };
}

function updateBeastmasterIntro(ev, dt) {
    const b = ev.boss, t = ev.t;
    camera.tx = TR_GATE.x0 + 30; camera.ty = TR_GATE.y;
    if (!ev.horn && t > 0.4) { ev.horn = true; addShake(4); effects.push({ type: 'slime_shock', x: b.x, y: b.y, radius: 170, color: '#c8a060', life: 0.6, maxLife: 0.6 }); }
    if (t > 1.0 && t < 1.8) { // the leap: an arc over the gate
        const k = clamp01((t - 1.0) / 0.8);
        b.airborne = true; b.x = lerp(4620, 4330, k); b.introZ = Math.sin(Math.PI * k) * 60;
    }
    if (t >= 1.8 && !ev.landed) {
        ev.landed = true; b.airborne = false; b.introZ = 0; b.x = 4330; addShake(6);
        burst(4330, 900, Math.PI, 2.2, 16, { kind: 'debris', color: '#8d8478', size: 4, speed: [80, 260], life: 0.6, drag: 3 });
        for (let i = 0; i < 6; i++) spawnParticle({ kind: 'smoke', color: 'rgba(120, 110, 96, 0.55)', x: 4330 + jitter(30), y: 900 + jitter(40), vx: jitter(60), vy: jitter(40), size: 18, grow: 30, life: 1.1, drag: 1.5, spin: 0, rot: 0 });
        effects.push({ type: 'slime_shock', x: 4330, y: 900, radius: 150, color: '#c8a060', life: 0.5, maxLife: 0.5 });
    }
    if (t > 2.0 && !ev.card) { ev.card = true; showBossCard(BOSS_NAMES[b.type] || 'The Beastmaster', 'Keeper of the Crossing'); }
    if (t > 3.0) camera.tx = camera.ty = null;
    if (t > 3.4) { b.state = 'idle'; b.stateTimer = 1.5; b.airborne = false; b.introZ = 0; stageEvent = null; }
}

// The Beastmaster is dead: the chain snaps, the barrier falls aside, the bridge is open and the exit appears
function startGateOpen() {
    if (trl.gateOpen || (stageEvent && stageEvent.type === 'gate_open')) return; // a second call (a level-up closing) mustn't restart it
    stageEvent = { type: 'gate_open', t: 0, blocking: true, snapped: false, done: false };
}

function updateGateOpen(ev, dt) {
    const t = ev.t, x = TR_GATE.x0 + 25, y = TR_GATE.y;
    camera.tx = x - 60; camera.ty = y;
    if (!ev.snapped && t > 0.3) {
        ev.snapped = true; trl.gateOpen = true; addShake(5);
        for (const i of trl.gateCells) trl.grid.data[i] = T_FLOOR;
        updateNav(true);
        for (const py of [y - 78, y + 78]) burst(x, py, 0, Math.PI * 2, 8, { kind: 'spark', color: '#ffb74d', size: 2.2, speed: [80, 260], life: 0.4, drag: 4 });
    }
    trl.gateK = easeOut(clamp01((t - 0.3) / 1.5)); // the barrier swings down (drawTrailGate)
    if (t > 1.8 && !ev.done) { ev.done = true; openStageExit('#ffab40'); }
    if (t > 2.4) camera.tx = camera.ty = null;
    if (t > 2.6) stageEvent = null;
}

// ---------- drawing (world space; the camera transform is already applied) ----------

function drawTrailGround() {
    const G = trl.ground, W = G.width, H = G.height, sx = Math.max(0, Math.floor(camera.x) - 20), sy = Math.max(0, Math.floor(camera.y) - 20);
    const sw = Math.min(W - sx, Math.ceil(viewW()) + 42), sh = Math.min(H - sy, Math.ceil(viewH()) + 42);
    ctx.drawImage(G, sx, sy, sw, sh, sx, sy, sw, sh);
    const t = fxTime, V = cavView(300), F = TR_CAMP.fire;
    drawTrailRiver(t, V);
    for (const J of trl.jam) if (cavIn(J.x0, (J.y0 + J.y1) / 2, V)) drawLogjam(J);
    drawTrailGate(t, V);
    if (cavIn(F.x, F.y, V)) {
        ctx.save(); ctx.globalCompositeOperation = 'lighter'; glow(ctx, F.x, F.y, 140, '#ff8f00', 0.32 + 0.08 * Math.sin(t * 9) + 0.04 * Math.sin(t * 23)); ctx.restore();
        drawFlame(ctx, F.x, F.y, 30, t, 4.2, 1); // bandits.js: the cached flame sprite
    }
    for (const e of enemies) if (e.airborne && e.type === 'boss_beastmaster' && !e.dead) { // his shadow while he leaps
        ctx.fillStyle = 'rgba(0, 0, 0, 0.35)'; ctx.beginPath(); ctx.ellipse(e.x + 10, e.y + 12, 50, 36, 0, 0, Math.PI * 2); ctx.fill();
    }
    if (currentMap.caveOpen) { // chevrons and a ring marking the way on
        const E = STAGE_MAPS.trail.exit, p = 0.5 + 0.5 * Math.sin(t * 3);
        ctx.save(); ctx.strokeStyle = '#ffd180'; ctx.lineWidth = 4; ctx.lineCap = 'round'; ctx.shadowBlur = 12; ctx.shadowColor = '#ff9100';
        for (let i = 0; i < 3; i++) {
            const a = Math.sin(t * 4 - i * 0.9) * 0.5 + 0.5, x = E.x - 190 + i * 34 + Math.sin(t * 3) * 6;
            ctx.globalAlpha = 0.3 + 0.7 * a; ctx.beginPath(); ctx.moveTo(x - 10, E.y - 16); ctx.lineTo(x + 6, E.y); ctx.lineTo(x - 10, E.y + 16); ctx.stroke();
        }
        ctx.globalAlpha = 0.4 + 0.3 * p; ctx.lineWidth = 2; ctx.beginPath(); ctx.ellipse(E.x, E.y, 88, 88, 0, 0, Math.PI * 2); ctx.stroke();
        ctx.restore();
    }
}

// Streaks of light running south down the river, a few per 40 px row, in view only
function drawTrailRiver(t, V) {
    if (V[2] < TR_RIVER[0]) return;
    const G = trl.grid, cs = G.cell, y0 = Math.max(0, Math.floor(V[1] / 40) * 40), y1 = Math.min(G.rows * cs, V[3]);
    ctx.save(); ctx.strokeStyle = 'rgba(200, 236, 228, 0.3)'; ctx.lineWidth = 1.6; ctx.lineCap = 'round'; ctx.beginPath();
    for (let y = y0; y < y1; y += 40) {
        const r = Math.min(G.rows - 1, Math.floor(y / cs)), L = trl.riverL[r] + 14, span = Math.min(trl.riverR[r], G.cols * cs) - 14 - L;
        for (const ph of [0, 0.5]) { const x = L + ((t * 0.09 + y * 0.013 + ph) % 1) * span, yy = y + ph * 20; ctx.moveTo(x, yy); ctx.lineTo(x + 18, yy + 1); }
    }
    ctx.stroke(); ctx.restore();
}

// A jumbled pile of felled trees across the corridor: 9-13 trunks within 35 degrees of across the road, staggered and
// overlapping, each with branch stubs and a root ball or a broken crown at one end. Trunks above the road centre roll
// north to their corridor edge when the logjam breaks, the rest south (drawLogjam); the cells don't change.
function trJamPile(J, rnd) {
    const cx = (J.x0 + J.x1) / 2, cy = (J.y0 + J.y1) / 2, N = 9 + Math.floor(rnd() * 5), trunks = [], rows = { n: 0, s: 0 };
    for (let i = 0; i < N; i++) {
        const yc = J.y0 + (i + 0.5) / N * (J.y1 - J.y0) + (rnd() - 0.5) * 50, north = yc < cy, row = north ? rows.n++ : rows.s++;
        const t = {
            x: cx + (rnd() - 0.5) * 60, yc, ang: Math.PI / 2 + (rnd() - 0.5) * 1.22, L: 90 + rnd() * 130, th: 20 + rnd() * 12,
            col: rnd() < 0.5 ? '#6b4a2e' : '#5a3d25', bark: rnd(), stubs: [],
            tx: cx + (rnd() - 0.5) * 120, ty: north ? J.y0 + 16 + row * 14 : J.y1 - 16 - row * 14, angT: (rnd() - 0.5) * 0.6, spin: (rnd() - 0.5) * 1.0, delay: rnd() * 0.3,
            end: rnd() < 0.5 ? -1 : 1, crown: rnd() < 0.5,
        };
        for (let s = 0, ns = 2 + Math.floor(rnd() * 2); s < ns; s++) t.stubs.push({ u: (rnd() - 0.5) * 0.8, side: rnd() < 0.5 ? -1 : 1, len: 6 + rnd() * 6 });
        trunks.push(t);
    }
    return trunks;
}

// A logjam: its trunks in pile order (later ones lie on top). k 0 = closed; as k rises each rolls to its corridor edge, turning a little
function drawLogjam(J) {
    for (const t of J.trunks) {
        const k = easeOut(clamp01((J.k - t.delay) / 0.7)), x = lerp(t.x, t.tx, k), y = lerp(t.yc, t.ty, k), a = lerp(t.ang, t.angT, k) + Math.sin(k * Math.PI) * t.spin;
        const L = t.L, th = t.th, c = ctx, ex = t.end * L / 2;
        c.save(); c.translate(x, y); c.rotate(a);
        c.fillStyle = 'rgba(0, 0, 0, 0.28)'; c.beginPath(); c.ellipse(5, 7, L / 2 + 4, th * 0.62, 0, 0, Math.PI * 2); c.fill(); // its shadow
        c.fillStyle = t.col; for (const st of t.stubs) { c.save(); c.translate(st.u * L, st.side * th / 2); c.rotate(st.side * 0.5); sprStroke(c, t.col, 4, () => { c.moveTo(0, 0); c.lineTo(0, st.side * st.len); }); c.restore(); } // snapped-off branches
        if (t.crown) { // the broken crown: leafy branches splayed out from the end
            for (let k = -2; k <= 2; k++) sprStroke(c, '#4a3420', 2.2, () => { c.moveTo(ex, 0); c.lineTo(ex + t.end * th * 1.1, k * th * 0.4); });
            for (const [dx, dy, r, col] of [[0.9, -0.5, 0.62, '#1f3d1c'], [1.2, 0.35, 0.58, '#24461f'], [0.5, 0.75, 0.5, '#1a3218'], [0.6, -0.95, 0.42, '#2e5726'], [1.35, -0.2, 0.4, '#3d6b2d']]) {
                c.fillStyle = col; c.beginPath(); c.arc(ex + t.end * dx * th, dy * th, r * th, 0, Math.PI * 2); c.fill();
                c.fillStyle = 'rgba(140, 190, 90, 0.35)'; c.beginPath(); c.arc(ex + t.end * dx * th - r * th * 0.3, dy * th - r * th * 0.3, r * th * 0.35, 0, Math.PI * 2); c.fill();
            }
        }
        trTrunkBody(c, L, th, t.col, t.bark);
        if (!t.crown) { // the root plate: a disc of torn-up earth with roots curling out of it
            const rx = ex + t.end * th * 0.15;
            c.fillStyle = '#4a3626'; c.strokeStyle = '#21160d'; c.lineWidth = 1.2; c.beginPath();
            for (let k = 0; k <= 10; k++) { const q = k / 10 * Math.PI * 2, rr = th * (0.85 + 0.25 * Math.sin(q * 3 + t.bark * 7)); c.lineTo(rx + Math.cos(q) * rr * 0.55, Math.sin(q) * rr); }
            c.closePath(); c.fill(); c.stroke();
            c.strokeStyle = '#7a5a3a'; c.lineWidth = 1.6; c.lineCap = 'round'; c.beginPath(); // roots
            for (let k = 0; k < 6; k++) { const q = (k / 6 - 0.5) * 2.6, sx = rx + t.end * Math.cos(q) * th * 0.4, sy = Math.sin(q) * th * 0.8; c.moveTo(sx, sy); c.quadraticCurveTo(sx + t.end * th * 0.5, sy * 1.3 + (k % 2 ? 4 : -4), sx + t.end * th * (0.7 + (k % 3) * 0.15), sy * 1.5); }
            c.stroke();
            c.fillStyle = '#5e4630'; for (let k = 0; k < 4; k++) { c.beginPath(); c.arc(rx + t.end * (2 + k * 3), (k - 1.5) * th * 0.35, 2 + (k % 2), 0, Math.PI * 2); c.fill(); } // clods of earth
        }
        ctx.restore();
    }
}

// The bridgehead gate: two oak posts on the parapets, a heavy barrier with a bandit banner, and the chains holding it
function drawTrailGate(t, V) {
    const x = TR_GATE.x0 + 25, y = TR_GATE.y, k = trl.gateK;
    if (!cavIn(x, y, V)) return;
    for (const py of [y - 78, y + 78]) {
        ctx.fillStyle = '#2a1d13'; ctx.fillRect(x - 10, py - 10, 20, 20); ctx.fillStyle = '#6b4d33'; ctx.fillRect(x - 7, py - 7, 14, 14);
        ctx.fillStyle = '#263238'; ctx.beginPath(); ctx.arc(x, py, 4, 0, Math.PI * 2); ctx.fill();
    }
    if (!trl.gateOpen) { // the chains: iron links from each post to the barrier's ends
        ctx.strokeStyle = '#37474f'; ctx.lineWidth = 2.5;
        for (const py of [y - 78, y + 78]) for (let i = 1; i <= 3; i++) { ctx.beginPath(); ctx.arc(x + 9, lerp(py, y + (py < y ? -72 : 72), i / 4), 2.4, 0, Math.PI * 2); ctx.stroke(); }
    }
    ctx.save(); ctx.translate(x, y - 72); ctx.rotate(k * Math.PI / 2); // the barrier swings down onto the west bank when it opens
    ctx.fillStyle = '#4e3626'; ctx.strokeStyle = '#1a110a'; ctx.lineWidth = 2; ctx.fillRect(-7, 0, 14, 144); ctx.strokeRect(-7, 0, 14, 144);
    ctx.fillStyle = '#263238'; ctx.fillRect(-7, 20, 14, 3); ctx.fillRect(-7, 118, 14, 3); // iron bands
    ctx.fillStyle = '#8e1b1b'; ctx.fillRect(7, 52, 16, 40); ctx.fillStyle = '#1a1210'; ctx.fillRect(7, 52, 16, 4); ctx.fillRect(13, 62, 4, 22); // the banner
    ctx.restore();
}

// Above the fighters: the campfire's smoke, the canopy (see-through around the hero), drifting pollen
function drawTrailAbove() {
    const c = ctx, t = fxTime, F = TR_CAMP.fire;
    if (cavIn(F.x, F.y, cavView(400))) drawSmokeColumn(F.x, F.y, t, 3.1, 0.6, 0.3); // map_village.js: a soft column
    const cw = Math.ceil(viewW()), ch = Math.ceil(viewH()), cx = Math.floor(camera.x), cy = Math.floor(camera.y), sx = Math.max(0, cx), sy = Math.max(0, cy);
    if (!trNear(player.x, player.y)) c.drawImage(trl.canopy, sx, sy, cw, ch, sx, sy, cw, ch); // no trees near the hero: no hole needed
    else {
        if (!trl.view || trl.view.width !== cw || trl.view.height !== ch) trl.view = cavCanvas(cw, ch);
        const v = trl.view.getContext('2d');
        v.globalCompositeOperation = 'source-over'; v.clearRect(0, 0, cw, ch);
        v.drawImage(trl.canopy, sx, sy, cw, ch, Math.max(0, -cx), Math.max(0, -cy), cw, ch);
        const px = player.x - cx, py = player.y - cy, hole = v.createRadialGradient(px, py, 30, px, py, 120);
        hole.addColorStop(0, 'rgba(0, 0, 0, 0.75)'); hole.addColorStop(1, 'rgba(0, 0, 0, 0)');
        v.globalCompositeOperation = 'destination-out'; v.fillStyle = hole; v.fillRect(px - 120, py - 120, 240, 240);
        c.drawImage(trl.view, cx, cy);
    }
    // pollen and leaves drifting through the air around the hero
    const tx0 = Math.floor(player.x / 200), ty0 = Math.floor(player.y / 200);
    c.fillStyle = '#e4dd8c';
    for (let ty = ty0 - 2; ty <= ty0 + 2; ty++) for (let tx = tx0 - 3; tx <= tx0 + 3; tx++) {
        const hsh = tx * 73 + ty * 151, x = tx * 200 + ((cavHash(hsh) * 200 + t * 14 * WIND_X * (0.6 + cavHash(hsh + 2))) % 200 + 200) % 200, y = ty * 200 + ((cavHash(hsh + 5) * 200 + t * 10 + t * 14 * WIND_Y * 0.3) % 200 + 200) % 200;
        c.globalAlpha = 0.3 + 0.25 * Math.sin(t * 2 + hsh); c.fillRect(x, y, 2, 2);
    }
    c.globalAlpha = 1;
}
