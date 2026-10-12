// ==========================================
// map_village.js - Bandit Bastion stage 1: Cinderholt, the burned village
// ==========================================
// A village the bandits sacked on the road to their stockade, still burning at dusk. The terrain is a grid like the
// cavern's (stage.js): the houses, the forest and the palisade are walls, garden fences are low (T_FENCE: walkers go
// round, leaps and shots go over), and the burning cart barricade jamming the east gate is a seal that comes down once
// the Warchief falls. buildVillage() lays it all out once and paints one cached ground layer and one canopy layer;
// fires, smoke, the longhall doors, the barricade and the powder kegs (bandits.js) are live.
// Bandits step out of doorways, slip out of the trees or vault the barricade. The Warchief bursts out of the longhall.

const T_FENCE = T_RAVINE; // a low fence works like a ravine: it stops walkers, not leaps or shots

STAGE_MAPS.village = {
    w: 2800, h: 1800, cell: 25, zoom: 1.25, // drawn a bit closer in than the Slime Caves: the details are small (stage.js camZoom)
    bounds: { left: 30, top: 30, right: 2770, bottom: 1770 },
    start: { x: 300, y: 965 },
    exit: { x: 2700, y: 900 }, exitTo: { x: 2880, y: 900 }, exitR: 90, arrow: '#ffab40',
    prompt: 'The barricade has burned down &middot; take the road to the stockade',
    cleared: { title: 'Stage Cleared', sub: 'Cinderholt · Bandit Bastion', next: 'The trail to the bastion' },
    obstacles: [], grid: null,
};

const vil = { built: false, ground: null, canopy: null, view: null, houses: [], hall: null, kegs: [], forest: [], gate: null, bar: [], barCells: [],
    barBurnt: false, barAt: -9, barFlare: 0, hallOpen: false, hallAt: -9, emberT: 0, lastSpawn: null, smoke: null };

// Hand-placed layout (25 px grid). Houses: [x0, y0, x1, y1, state, door side]; the longhall is the Warchief's.
const VIL_FOREST_N = 190, VIL_FOREST_S = 1610, VIL_FOREST_WOB = 90; // the tree lines, roughened by noise
const PAL = { x0: 2550, x1: 2600, g0: 825, g1: 975, y: 900 }; // the palisade and its gate
const VIL_TOWERS = [[2525, 725, 2625, 825], [2525, 975, 2625, 1075]];
const VIL_ROAD = [[-40, 965], [420, 972], [900, 948], [1250, 905], [1480, 900], [1800, 896], [2250, 900], [2900, 900]];
const VIL_SQUARE = { x: 1480, y: 900, rx: 285, ry: 215 };
const VIL_HOUSES = [
    [450, 575, 650, 750, 'burnt', 's'], [800, 425, 975, 600, 'intact', 's'], [500, 1175, 700, 1350, 'burning', 'n'],
    [900, 1150, 1125, 1325, 'burnt', 'n'], [1050, 575, 1200, 725, 'burning', 's'], [1325, 425, 1650, 650, 'burning', 's', 'hall'],
    [1800, 525, 2000, 700, 'burnt', 's'], [2150, 450, 2350, 625, 'burning', 's'], [1775, 1125, 1975, 1300, 'burning', 'n'],
    [2150, 1100, 2350, 1275, 'intact', 'n'], [1300, 1175, 1500, 1350, 'burnt', 'n'], [275, 300, 425, 425, 'intact', 's'],
    [2375, 1325, 2500, 1450, 'burnt', 'w'],
];
// Low fences: axis-aligned runs [x0, y0, x1, y1]; the gaps between runs are the broken bits you can walk through
const VIL_FENCES = [
    [775, 250, 775, 425], [775, 250, 850, 250], [925, 250, 1000, 250], [1000, 250, 1000, 425],
    [475, 1350, 475, 1525], [475, 1525, 550, 1525], [625, 1525, 725, 1525], [725, 1350, 725, 1450],
    [2125, 1275, 2125, 1450], [2125, 1450, 2200, 1450], [2275, 1450, 2350, 1450], [2350, 1275, 2350, 1375],
    [225, 850, 400, 850], [475, 850, 650, 850], [225, 1075, 450, 1075], [550, 1075, 700, 1075],
];
const VIL_YARDS = [[775, 250, 1000, 425, 'garden'], [475, 1350, 725, 1525, 'garden'], [2125, 1275, 2350, 1450, 'pen']];
const VIL_PROPS = [ // solid things: [x, y, r, kind]
    [1480, 905, 32, 'well'], [1010, 795, 28, 'hay'], [2060, 1040, 28, 'hay'], [640, 1110, 24, 'hay'],
    [1235, 1075, 32, 'cart'], [2030, 770, 30, 'cart'], [880, 1065, 18, 'crate'], [1705, 770, 17, 'crate'],
    [2420, 770, 19, 'crate'], [1610, 1135, 18, 'crate'], [345, 1260, 24, 'stump'], [2470, 1180, 22, 'stump'],
];
const VIL_KEGS = [[720, 805], [1215, 800], [1655, 720], [1335, 1110], [2085, 705], [2410, 695], [2240, 1350], [2460, 1000]];

const vilRng = clrRng; // map_clearing.js: the same seeded random
function vilRoadDist(x, y) { let d = 1e9; for (let i = 1; i < VIL_ROAD.length; i++) d = Math.min(d, distToSegment(x, y, ...VIL_ROAD[i - 1], ...VIL_ROAD[i])); return d; }
function vilRoadY(x) { for (let i = 1; i < VIL_ROAD.length; i++) { const [ax, ay] = VIL_ROAD[i - 1], [bx, by] = VIL_ROAD[i]; if (x <= bx) return ay + (by - ay) * clamp01((x - ax) / (bx - ax)); } return 900; }

function buildVillage() {
    if (vil.built) return;
    const D = STAGE_MAPS.village;
    D.grid = vilGenerate(D);
    vilPaint(D, D.grid);
    vil.built = true;
}

// Start of every visit: the barricade stands, the longhall is shut, every keg is back
function resetVillage() {
    const D = STAGE_MAPS.village, G = D.grid;
    for (const i of vil.barCells) G.data[i] = T_SEAL;
    vil.barBurnt = false; vil.barFlare = 0; vil.hallOpen = false;
    vil.letter = null; vil.letterTaken = false; vil.bossFell = null;
    for (let i = D.obstacles.length - 1; i >= 0; i--) if (D.obstacles[i].kind === 'keg') D.obstacles.splice(i, 1);
    for (const k of vil.kegs) { if (k.ent) k.ent.dead = true; k.ent = null; makeKeg(k); } // bandits.js
}

// ---------- generation ----------

function vilGenerate(D) {
    const cs = D.cell, cols = D.w / cs, rows = D.h / cs, n = cols * rows, data = new Uint8Array(n), forest = new Uint8Array(n), N = cavNoise(4401), rnd = vilRng(812);
    const ctr = i => [(i % cols + 0.5) * cs, (Math.floor(i / cols) + 0.5) * cs];
    const inRect = (x, y, r) => x >= r[0] && x < r[2] && y >= r[1] && y < r[3];
    for (let i = 0; i < n; i++) {
        const [x, y] = ctr(i), z = N(x, y) - 0.5;
        let f = y < VIL_FOREST_N + z * VIL_FOREST_WOB || y > VIL_FOREST_S + z * VIL_FOREST_WOB || (x < 105 + z * 70 && Math.abs(y - vilRoadY(x)) > 90 + z * 20);
        if (x >= PAL.x1 && Math.abs(y - PAL.y) > 105 + z * 40) f = true; // beyond the gate only the road runs on, through the trees
        forest[i] = f ? 1 : 0;
        data[i] = f ? T_WALL : T_FLOOR;
        if (f) continue;
        for (const h of VIL_HOUSES) if (inRect(x, y, h)) data[i] = T_WALL;
        for (const t of VIL_TOWERS) if (inRect(x, y, t)) data[i] = T_WALL;
        if (x >= PAL.x0 && x < PAL.x1) data[i] = y >= PAL.g0 && y < PAL.g1 ? T_SEAL : T_WALL;
    }
    for (const [x0, y0, x1, y1] of VIL_FENCES) { // a run of fence cells along each segment
        const gx0 = Math.floor(Math.min(x0, x1) / cs), gx1 = Math.floor((Math.max(x0, x1) - 1) / cs), gy0 = Math.floor(Math.min(y0, y1) / cs), gy1 = Math.floor((Math.max(y0, y1) - 1) / cs);
        for (let gy = y0 === y1 ? Math.floor(y0 / cs) : gy0; gy <= (y0 === y1 ? Math.floor(y0 / cs) : gy1); gy++)
            for (let gx = x0 === x1 ? Math.floor(x0 / cs) : gx0; gx <= (x0 === x1 ? Math.floor(x0 / cs) : gx1); gx++) if (data[gy * cols + gx] === T_FLOOR) data[gy * cols + gx] = T_FENCE;
    }
    vil.barCells = []; for (let i = 0; i < n; i++) if (data[i] === T_SEAL) vil.barCells.push(i);
    // Floor the hero can't reach (pockets behind houses) becomes wall, so nothing spawns or gets stuck there
    const seen = new Uint8Array(n), q = [Math.floor(D.start.y / cs) * cols + Math.floor(D.start.x / cs)]; seen[q[0]] = 1;
    while (q.length) {
        const i = q.pop(), gx = i % cols;
        for (const j of [gx > 0 ? i - 1 : -1, gx < cols - 1 ? i + 1 : -1, i - cols, i + cols]) if (j >= 0 && j < n && !seen[j] && (data[j] === T_FLOOR || data[j] === T_SEAL)) { seen[j] = 1; q.push(j); }
    }
    for (let i = 0; i < n; i++) if (!seen[i] && data[i] === T_FLOOR) data[i] = T_WALL;
    const at = (x, y) => { const gx = Math.floor(x / cs), gy = Math.floor(y / cs); return gx < 0 || gy < 0 || gx >= cols || gy >= rows ? T_WALL : data[gy * cols + gx]; };
    const open = (x, y, r) => [[0, 0], [r, 0], [-r, 0], [0, r], [0, -r]].every(([ox, oy]) => at(x + ox, y + oy) === T_FLOOR);

    // Houses: door, spawn spot in front of it, roof holes (burning) and embers (burnt)
    vil.houses = VIL_HOUSES.map(([x0, y0, x1, y1, state, side, hall]) => {
        const out = { n: [0, -1], s: [0, 1], w: [-1, 0], e: [1, 0] }[side], cx = (x0 + x1) / 2, cy = (y0 + y1) / 2;
        const door = { x: side === 'w' ? x0 : side === 'e' ? x1 : cx, y: side === 'n' ? y0 : side === 's' ? y1 : cy };
        const h = { x0, y0, x1, y1, cx, cy, w: x1 - x0, h: y1 - y0, state, side, out, door, hall: !!hall, holes: [], embers: [], seed: rnd() * 10 };
        h.spawn = { x: door.x + out[0] * 34, y: door.y + out[1] * 34 };
        if (hall) vil.hall = h;
        return h;
    });
    // Spots along the tree line where bandits slip out of the forest
    vil.forest = [];
    const fAt = (x, y) => { const gx = Math.floor(x / cs), gy = Math.floor(y / cs); return gx < 0 || gy < 0 || gx >= cols || gy >= rows ? 1 : forest[gy * cols + gx]; };
    for (let x = 320; x < PAL.x0 - 80; x += 145) {
        let y = 0; while (y < D.h / 2 && fAt(x, y)) y += cs;
        if (open(x, y + 40, 30)) vil.forest.push({ x, y: y + 40, ox: x, oy: y - 30 });
        y = D.h - 1; while (y > D.h / 2 && fAt(x, y)) y -= cs;
        if (open(x, y - 40, 30)) vil.forest.push({ x, y: y - 40, ox: x, oy: y + 30 });
    }
    vil.gate = { x: PAL.x0 - 45, y: PAL.y, ox: PAL.x1 + 40, oy: PAL.y };
    // Solid props, the kegs' spots, and the barricade's pieces
    D.obstacles.length = 0;
    for (const [x, y, r, kind] of VIL_PROPS) D.obstacles.push({ x, y, r, kind, seed: rnd() * 10 });
    vil.kegs = VIL_KEGS.filter(([x, y]) => open(x, y, 24)).map(([x, y]) => ({ x, y, ent: null, goneAt: -99, obs: null }));
    vil.bar = [
        { kind: 'cart', x: 2563, y: 862, a: 1.25, w: 58, h: 34 }, { kind: 'cart', x: 2588, y: 940, a: -1.05, w: 54, h: 32 },
        { kind: 'crate', x: 2548, y: 915, a: 0.3, s: 15 }, { kind: 'crate', x: 2600, y: 885, a: -0.5, s: 13 }, { kind: 'plank', x: 2575, y: 903, a: 0.15, l: 60 },
        { kind: 'plank', x: 2572, y: 838, a: -0.4, l: 46 }, { kind: 'plank', x: 2560, y: 958, a: 0.6, l: 50 },
    ];
    vil.barFires = [[2560, 860, 30], [2590, 935, 28], [2575, 898, 24], [2548, 915, 18], [2598, 875, 16]];
    return { cols, rows, cell: cs, data, forest };
}

// ---------- the cached ground and canopy ----------

function vilPaint(D, G) {
    const W = D.w, H = D.h, rnd = vilRng(2716), cs = G.cell;
    const g = cavCanvas(W, H), c = g.getContext('2d'); c.lineCap = 'round'; c.lineJoin = 'round';
    const fAt = (x, y) => { const gx = Math.floor(x / cs), gy = Math.floor(y / cs); return gx < 0 || gy < 0 || gx >= G.cols || gy >= G.rows ? 1 : G.forest[gy * G.cols + gx]; };

    // --- dry, trampled grass under a smoky dusk ---
    c.fillStyle = '#4c5530'; c.fillRect(0, 0, W, H);
    for (let i = 0; i < 90; i++) {
        const x = rnd() * W, y = rnd() * H, r = 120 + rnd() * 280, k = rnd();
        const gr = c.createRadialGradient(x, y, 0, x, y, r);
        gr.addColorStop(0, k < 0.4 ? 'rgba(36, 44, 22, 0.5)' : k < 0.75 ? 'rgba(112, 112, 60, 0.32)' : 'rgba(70, 62, 48, 0.35)'); gr.addColorStop(1, 'rgba(0, 0, 0, 0)');
        c.fillStyle = gr; c.fillRect(x - r, y - r, r * 2, r * 2);
    }
    const blades = ['#5f6838', '#48512d', '#6f6e3e', '#3e4626', '#7a7341', '#55603a'];
    c.lineWidth = 1.4;
    for (let i = 0; i < 32000; i++) {
        const x = rnd() * W, y = rnd() * H, l = 4 + rnd() * 6, a = -Math.PI / 2 + (rnd() - 0.5) * 1.1;
        c.strokeStyle = blades[(rnd() * blades.length) | 0]; c.globalAlpha = 0.4 + rnd() * 0.35;
        c.beginPath(); c.moveTo(x, y); c.quadraticCurveTo(x + Math.cos(a) * l * 0.5 + 1.5, y + Math.sin(a) * l * 0.5, x + Math.cos(a) * l, y + Math.sin(a) * l); c.stroke();
    }
    c.globalAlpha = 1;
    // ash and scorched earth spreading from the fires
    for (const h of vil.houses) if (h.state !== 'intact') {
        const r = Math.max(h.w, h.h) * (h.state === 'burnt' ? 0.95 : 0.8), gr = c.createRadialGradient(h.cx + 10, h.cy + 10, r * 0.2, h.cx + 10, h.cy + 10, r);
        gr.addColorStop(0, 'rgba(22, 18, 15, 0.7)'); gr.addColorStop(0.6, 'rgba(48, 42, 36, 0.4)'); gr.addColorStop(1, 'rgba(48, 42, 36, 0)');
        c.fillStyle = gr; c.fillRect(h.cx - r, h.cy - r, r * 2 + 20, r * 2 + 20);
        for (let k = 0; k < 90; k++) { const a = rnd() * Math.PI * 2, d = r * (0.5 + rnd() * 0.6); c.fillStyle = rnd() < 0.5 ? 'rgba(160, 150, 140, 0.35)' : 'rgba(10, 8, 6, 0.4)'; c.fillRect(h.cx + Math.cos(a) * d, h.cy + Math.sin(a) * d, 1.5 + rnd() * 2, 1.5 + rnd() * 2); }
    }

    // --- the road from the west, through the square, out of the east gate ---
    const road = () => { c.beginPath(); c.moveTo(...VIL_ROAD[0]); for (let i = 1; i < VIL_ROAD.length - 1; i++) c.quadraticCurveTo(VIL_ROAD[i][0], VIL_ROAD[i][1], (VIL_ROAD[i][0] + VIL_ROAD[i + 1][0]) / 2, (VIL_ROAD[i][1] + VIL_ROAD[i + 1][1]) / 2); c.lineTo(...VIL_ROAD[VIL_ROAD.length - 1]); };
    for (const [w, col, a] of [[132, '#3d4628', 0.45], [106, '#4d3d2a', 0.8], [90, '#64503a', 0.92], [42, '#6c5840', 0.6], [30, '#64503a', 1], [52, '#76614a', 0.35]]) { c.globalAlpha = a; c.strokeStyle = col; c.lineWidth = w; road(); c.stroke(); } // the 42 / 30 pair leaves two cart ruts
    c.globalAlpha = 1;
    for (let i = 0; i < 900; i++) { // grit, stones and hoof prints along it
        const k = rnd() * (VIL_ROAD.length - 1), s = Math.floor(k), u = k - s, [ax, ay] = VIL_ROAD[s], [bx, by] = VIL_ROAD[s + 1];
        const x = ax + (bx - ax) * u + (rnd() - 0.5) * 90, y = ay + (by - ay) * u + (rnd() - 0.5) * 80;
        c.fillStyle = rnd() < 0.5 ? 'rgba(52, 40, 28, 0.55)' : 'rgba(150, 130, 100, 0.45)';
        c.beginPath(); c.ellipse(x, y, 1 + rnd() * 2.6, 1 + rnd() * 1.8, rnd() * 3, 0, Math.PI * 2); c.fill();
    }

    // --- the village square: cobbles worn into the dirt, thinning toward the edges ---
    const S = VIL_SQUARE;
    c.save(); c.translate(S.x, S.y); c.scale(1, S.ry / S.rx); // packed dirt under the stones, fading into the grass
    const sq = c.createRadialGradient(0, 0, S.rx * 0.6, 0, 0, S.rx * 1.1); sq.addColorStop(0, 'rgba(58, 52, 45, 0.92)'); sq.addColorStop(1, 'rgba(58, 52, 45, 0)');
    c.fillStyle = sq; c.beginPath(); c.arc(0, 0, S.rx * 1.1, 0, Math.PI * 2); c.fill(); c.restore();
    const cob = ['#5f5a52', '#66605a', '#57524b', '#6b655c', '#524d47'];
    for (let y = S.y - S.ry; y < S.y + S.ry; y += 10) for (let x = S.x - S.rx + ((y / 10) % 2) * 6; x < S.x + S.rx; x += 11 + rnd() * 3) {
        const q = Math.hypot((x - S.x) / S.rx, (y - S.y) / S.ry); if (q > 1 || (q > 0.72 && rnd() < (q - 0.72) * 3.5) || rnd() < 0.04) continue; // worn away toward the edge, a stone missing here and there
        const sx = x + (rnd() - 0.5) * 2.5, sy = y + (rnd() - 0.5) * 2.5, w = 4 + rnd() * 1.8, h = 3.3 + rnd() * 1.3;
        c.fillStyle = cob[(rnd() * cob.length) | 0]; c.beginPath(); c.ellipse(sx, sy, w, h, (rnd() - 0.5) * 0.6, 0, Math.PI * 2); c.fill();
        c.fillStyle = 'rgba(255, 245, 225, 0.08)'; c.fillRect(sx - w * 0.5, sy - h * 0.6, w * 0.7, 1.2);
    }
    for (let i = 0; i < 26; i++) { const a = rnd() * Math.PI * 2, d = rnd() * 0.8; vilSoot(c, S.x + Math.cos(a) * S.rx * d, S.y + Math.sin(a) * S.ry * d, 14 + rnd() * 30); } // soot blown across it

    // --- yards: vegetable rows trampled flat, and a muddy pen ---
    for (const [x0, y0, x1, y1, kind] of VIL_YARDS) {
        c.save(); c.beginPath(); c.rect(x0 + 6, y0 + 6, x1 - x0 - 12, y1 - y0 - 12); c.clip();
        c.fillStyle = kind === 'pen' ? '#4e4030' : '#4a3a28'; c.fillRect(x0, y0, x1 - x0, y1 - y0);
        if (kind === 'garden') for (let y = y0 + 16; y < y1 - 6; y += 15) {
            c.strokeStyle = 'rgba(28, 20, 12, 0.6)'; c.lineWidth = 5; c.beginPath(); c.moveTo(x0, y); c.lineTo(x1, y + (rnd() - 0.5) * 4); c.stroke();
            for (let x = x0 + 10; x < x1 - 6; x += 9 + rnd() * 6) if (rnd() < 0.75) { c.fillStyle = rnd() < 0.3 ? '#3a3326' : rnd() < 0.5 ? '#5b7a32' : '#6f8f3a'; c.beginPath(); c.arc(x, y - 5, 2 + rnd() * 2, 0, Math.PI * 2); c.fill(); }
        } else for (let i = 0; i < 160; i++) { c.strokeStyle = rnd() < 0.5 ? 'rgba(200, 170, 90, 0.5)' : 'rgba(40, 30, 20, 0.4)'; c.lineWidth = 1.3; const x = x0 + rnd() * (x1 - x0), y = y0 + rnd() * (y1 - y0), a = rnd() * 6; c.beginPath(); c.moveTo(x, y); c.lineTo(x + Math.cos(a) * 7, y + Math.sin(a) * 7); c.stroke(); }
        c.restore();
    }

    // --- forest floor under the trees, with undergrowth along its edge ---
    c.save(); c.filter = 'blur(10px)'; c.fillStyle = '#121a0d'; c.beginPath();
    for (let i = 0; i < G.cols * G.rows; i++) if (G.forest[i]) c.rect((i % G.cols) * cs - 4, Math.floor(i / G.cols) * cs - 4, cs + 8, cs + 8);
    c.fill(); c.restore();
    const bush = (x, y, s, burnt) => {
        c.fillStyle = 'rgba(0, 0, 0, 0.25)'; c.beginPath(); c.ellipse(x + 6, y + 8, s * 1.3, s * 0.8, 0, 0, Math.PI * 2); c.fill();
        const pal = burnt ? [['#1d1a16', 1.15], ['#2e2a24', 1], ['#3d3730', 0.7]] : [['#1c3214', 1.15], ['#2b4a1d', 1], ['#3a6026', 0.7]];
        for (const [col, k] of pal) { c.fillStyle = col; for (let p = 0; p < 5; p++) { const a = p * 1.2566 + x; c.beginPath(); c.arc(x + Math.cos(a) * s * 0.5 - (1 - k) * s * 0.4, y + Math.sin(a) * s * 0.4 - (1 - k) * s * 0.4, s * 0.55 * k, 0, Math.PI * 2); c.fill(); } }
    };
    for (let i = 0; i < G.cols * G.rows; i++) {
        if (!G.forest[i] || rnd() > 0.5) continue;
        const gx = i % G.cols, gy = Math.floor(i / G.cols), x = (gx + 0.5) * cs, y = (gy + 0.5) * cs;
        if (!fAt(x + cs, y) || !fAt(x - cs, y) || !fAt(x, y + cs) || !fAt(x, y - cs)) bush(x + (rnd() - 0.5) * 20, y + (rnd() - 0.5) * 20, 11 + rnd() * 8, rnd() < 0.15);
    }

    // --- loose debris from the raid ---
    for (let i = 0; i < 110; i++) {
        const x = 150 + rnd() * (PAL.x0 - 200), y = VIL_FOREST_N + 40 + rnd() * (VIL_FOREST_S - VIL_FOREST_N - 80); if (fAt(x, y) || G.data[Math.floor(y / cs) * G.cols + Math.floor(x / cs)] !== T_FLOOR) continue;
        const k = rnd(); c.save(); c.translate(x, y); c.rotate(rnd() * Math.PI);
        if (k < 0.45) { c.fillStyle = rnd() < 0.5 ? '#3b2a1e' : '#5a4130'; c.fillRect(-12 - rnd() * 8, -2.5, 24 + rnd() * 10, 5); c.fillStyle = 'rgba(0,0,0,0.4)'; c.fillRect(-8, 1, 16, 1.5); } // planks, some charred
        else if (k < 0.6) { c.strokeStyle = '#37474f'; c.lineWidth = 2; c.beginPath(); c.ellipse(0, 0, 9, 7, 0, 0, Math.PI * 2); c.stroke(); } // a barrel hoop
        else if (k < 0.75) { c.fillStyle = '#6e5538'; c.strokeStyle = '#2e2216'; c.lineWidth = 1.2; c.beginPath(); c.ellipse(0, 0, 9, 6.5, 0, 0, Math.PI * 2); c.fill(); c.stroke(); c.fillStyle = '#4a3825'; c.fillRect(-11, -1.5, 3, 3); c.fillStyle = 'rgba(200, 180, 130, 0.55)'; for (let j = 0; j < 9; j++) c.fillRect(8 + rnd() * 10, (rnd() - 0.5) * 9, 1.6, 1.2); } // a slit grain sack
        else if (k < 0.85) { c.fillStyle = '#8d5a3a'; for (let j = 0; j < 4; j++) { c.beginPath(); c.moveTo(rnd() * 10, rnd() * 10); c.lineTo(rnd() * 10 - 5, rnd() * 8); c.lineTo(rnd() * 6, -rnd() * 6); c.fill(); } } // pottery shards
        else { c.strokeStyle = '#4e3626'; c.lineWidth = 3; c.beginPath(); c.arc(0, 0, 10, 0, Math.PI * 2); c.stroke(); for (let j = 0; j < 6; j++) { c.beginPath(); c.moveTo(0, 0); c.lineTo(Math.cos(j) * 10, Math.sin(j) * 10); c.stroke(); } } // a cart wheel
        c.restore();
    }

    // --- fences, props, houses, the palisade ---
    for (const f of VIL_FENCES) vilFence(c, f, rnd);
    for (const h of vil.houses) vilHouseShadow(c, h);
    for (const o of D.obstacles) vilProp(c, o, rnd);
    for (const h of vil.houses) vilHouse(c, h, rnd);
    vilPalisade(c, rnd);

    // --- canopy: crowns along the tree line, overhanging the village edge; their shadows fall on the ground ---
    const cv = cavCanvas(W, H), k = cv.getContext('2d'), crowns = [];
    for (let x = -40; x < W + 60; x += 55 + rnd() * 45) {
        const depths = x > PAL.x0 - 30 ? [95, 175, 255, 335] : [30, 110, 200, 290]; // beyond the gate they stand back off the road out
        let y = 0; while (y < H / 2 && fAt(x, y)) y += cs;
        if (y > 0) for (const dpt of depths) if (y - dpt > -80) crowns.push({ x: x + (rnd() - 0.5) * 30, y: y - dpt + rnd() * 30, r: 50 + rnd() * 34 });
        y = H; while (y > H / 2 && fAt(x, y - 1)) y -= cs;
        if (y < H) for (const dpt of depths) if (y + dpt < H + 80) crowns.push({ x: x + (rnd() - 0.5) * 30, y: y + dpt - rnd() * 30, r: 50 + rnd() * 34 });
    }
    for (let y = VIL_FOREST_N - 60; y < VIL_FOREST_S + 60; y += 55 + rnd() * 45) {
        let x = 0; while (x < 400 && fAt(x, y)) x += cs;
        if (x > 0) for (const dpt of [30, 110]) crowns.push({ x: x - dpt + rnd() * 30, y: y + (rnd() - 0.5) * 30, r: 50 + rnd() * 30 });
    }
    for (const t of crowns) {
        const sg = c.createRadialGradient(t.x + 26, t.y + 32, t.r * 0.3, t.x + 26, t.y + 32, t.r * 1.15);
        sg.addColorStop(0, 'rgba(6, 10, 4, 0.5)'); sg.addColorStop(1, 'rgba(6, 10, 4, 0)');
        c.fillStyle = sg; c.beginPath(); c.arc(t.x + 26, t.y + 32, t.r * 1.15, 0, Math.PI * 2); c.fill();
    }
    for (const t of crowns) { if (rnd() < 0.12) vilBurntCrown(k, t, rnd); else clrCrown(k, t, rnd); }
    k.globalCompositeOperation = 'source-atop'; k.fillStyle = 'rgba(40, 18, 6, 0.25)'; k.fillRect(0, 0, W, H); // dusk light, warmed by the fires
    vil.ground = g; vil.canopy = cv;
}

function vilSoot(c, x, y, r) {
    const gr = c.createRadialGradient(x, y, 0, x, y, r); gr.addColorStop(0, 'rgba(15, 12, 10, 0.45)'); gr.addColorStop(1, 'rgba(15, 12, 10, 0)');
    c.fillStyle = gr; c.fillRect(x - r, y - r, r * 2, r * 2);
}

function vilBurntCrown(k, t, rnd) { // a tree the fire reached: bare charred branches with a few singed leaves
    const { x, y, r } = t;
    k.fillStyle = 'rgba(20, 16, 12, 0.85)'; k.beginPath(); k.arc(x, y, r * 0.7, 0, Math.PI * 2); k.fill();
    k.strokeStyle = '#1a1410'; k.lineCap = 'round';
    for (let i = 0; i < 9; i++) { const a = rnd() * Math.PI * 2, l = r * (0.6 + rnd() * 0.4); k.lineWidth = 4; k.beginPath(); k.moveTo(x, y); k.lineTo(x + Math.cos(a) * l, y + Math.sin(a) * l); k.stroke(); k.lineWidth = 2; k.beginPath(); k.moveTo(x + Math.cos(a) * l * 0.6, y + Math.sin(a) * l * 0.6); k.lineTo(x + Math.cos(a + 0.5) * l * 0.95, y + Math.sin(a + 0.5) * l * 0.95); k.stroke(); }
    for (let i = 0; i < 14; i++) { const a = rnd() * Math.PI * 2, d = rnd() * r * 0.8; k.fillStyle = rnd() < 0.5 ? '#5a4a2e' : '#6e3a1e'; k.beginPath(); k.arc(x + Math.cos(a) * d, y + Math.sin(a) * d, 2 + rnd() * 3, 0, Math.PI * 2); k.fill(); }
}

// A low wooden fence: posts with two rails, a leaning post where a run breaks off
function vilFence(c, [x0, y0, x1, y1], rnd) {
    const cs = 25, horiz = y0 === y1, ox = horiz ? 0 : cs / 2, oy = horiz ? cs / 2 : 0, ax = x0 + ox, ay = y0 + oy, bx = x1 + ox, by = y1 + oy; // drawn down the middle of its cells
    const len = Math.hypot(bx - ax, by - ay), ux = (bx - ax) / (len || 1), uy = (by - ay) / (len || 1);
    c.fillStyle = 'rgba(0, 0, 0, 0.3)'; c.save(); c.translate(5, 6); c.lineWidth = 6; c.strokeStyle = 'rgba(0, 0, 0, 0.25)'; c.beginPath(); c.moveTo(ax, ay); c.lineTo(bx, by); c.stroke(); c.restore();
    for (const off of [-3, 3]) { c.strokeStyle = '#2a1d13'; c.lineWidth = 4; c.beginPath(); c.moveTo(ax - uy * off, ay + ux * off); c.lineTo(bx - uy * off, by + ux * off); c.stroke(); c.strokeStyle = '#7a5a3c'; c.lineWidth = 2.2; c.stroke(); }
    for (let d = 0; d <= len + 0.1; d += 24) {
        const px = ax + ux * d, py = ay + uy * d, lean = (d === 0 || d + 24 > len) && rnd() < 0.5 ? (rnd() - 0.5) * 6 : 0;
        c.fillStyle = '#2a1d13'; c.fillRect(px - 4 + lean, py - 4, 8, 8); c.fillStyle = '#6b4d33'; c.fillRect(px - 3 + lean, py - 3, 6, 6);
        c.fillStyle = 'rgba(255, 230, 190, 0.18)'; c.fillRect(px - 3 + lean, py - 3, 6, 1.5);
    }
}

function vilHouseShadow(c, h) {
    c.save(); c.filter = 'blur(10px)'; c.fillStyle = 'rgba(8, 6, 4, 0.55)'; c.fillRect(h.x0 + 14, h.y0 + 18, h.w + 4, h.h + 4); c.restore();
}

// A house seen from straight above. Intact and burning ones show a gable roof (ridge along the long side, the north
// or west slope lit); burning roofs have holes the flames come out of (drawn live). Burnt ones have no roof left:
// the walls' stone footing, the doorway, fallen rafters on an ash floor with embers still glowing (live).
function vilHouse(c, h, rnd) {
    const horiz = h.w >= h.h, L = horiz ? h.w : h.h, Sd = horiz ? h.h : h.w;
    c.save(); c.translate(h.cx, h.cy); if (!horiz) c.rotate(Math.PI / 2);
    const lit = horiz ? -1 : 1; // which local side (y < 0 or y > 0) faces the light from the top-left
    const toWorld = (lx, ly) => horiz ? [h.cx + lx, h.cy + ly] : [h.cx - ly, h.cy + lx];
    if (h.state === 'burnt') vilBurnt(c, h, L, Sd, rnd, toWorld);
    else {
        const e = 7, thatch = !h.hall, pal = h.hall ? ['#6b3b2b', '#48251a', '#2e160f'] : thatch ? ['#937538', '#665025', '#3e2d12'] : ['#6a4a3a', '#4a3328', '#2e1e16'];
        for (const s of [-1, 1]) { // the two roof slopes
            c.save(); c.beginPath(); c.rect(-L / 2 - e, s < 0 ? -Sd / 2 - e : 0, L + e * 2, Sd / 2 + e); c.clip();
            c.fillStyle = s === lit ? pal[0] : pal[1]; c.fillRect(-L / 2 - e, -Sd / 2 - e, L + e * 2, Sd + e * 2);
            if (thatch) { // straw laid in courses
                for (let i = 0; i < L * Sd / 9; i++) { const x = -L / 2 - e + rnd() * (L + e * 2), y = (rnd() - (s < 0 ? 1 : 0)) * (Sd / 2 + e); c.strokeStyle = rnd() < 0.5 ? 'rgba(60, 40, 12, 0.45)' : 'rgba(225, 195, 120, 0.35)'; c.lineWidth = 1.2; c.beginPath(); c.moveTo(x, y); c.lineTo(x + (rnd() - 0.5) * 2, y + s * (5 + rnd() * 5)); c.stroke(); }
                c.strokeStyle = 'rgba(40, 26, 8, 0.35)'; c.lineWidth = 2; for (let y = 10; y < Sd / 2 + e; y += 11) { c.beginPath(); c.moveTo(-L / 2 - e, s * y); c.lineTo(L / 2 + e, s * y + (rnd() - 0.5) * 2); c.stroke(); }
            } else { // wooden shingles in rows
                for (let y = 2, row = 0; y < Sd / 2 + e; y += 9, row++) for (let x = -L / 2 - e + (row % 2) * 6; x < L / 2 + e; x += 12) {
                    c.fillStyle = sprShade(s === lit ? pal[0] : pal[1], (rnd() - 0.5) * 0.25); c.fillRect(x, s < 0 ? -y - 8 : y, 11, 8);
                    c.fillStyle = 'rgba(0, 0, 0, 0.35)'; c.fillRect(x, s < 0 ? -y - 1.5 : y + 6.5, 11, 1.5);
                }
            }
            c.restore();
        }
        c.strokeStyle = pal[2]; c.lineWidth = 2.5; c.strokeRect(-L / 2 - e, -Sd / 2 - e, L + e * 2, Sd + e * 2); // eaves
        c.fillStyle = pal[2]; c.fillRect(-L / 2 - e, -5, L + e * 2, 10); // ridge cap
        c.strokeStyle = 'rgba(255, 220, 160, 0.15)'; c.lineWidth = 1; c.beginPath(); c.moveTo(-L / 2 - e, -4); c.lineTo(L / 2 + e, -4); c.stroke();
        if (!h.hall && h.state === 'intact') { // a stone chimney
            const cx = L * 0.28, cy = -Sd * 0.22; c.fillStyle = '#6f6a62'; c.strokeStyle = '#1e1b18'; c.lineWidth = 2; c.fillRect(cx - 9, cy - 9, 18, 18); c.strokeRect(cx - 9, cy - 9, 18, 18);
            c.fillStyle = '#141210'; c.fillRect(cx - 4.5, cy - 4.5, 9, 9);
        }
        if (h.state === 'burning') { // the fire has eaten through in places
            const n = h.hall ? 4 : 2 + (rnd() < 0.5 ? 1 : 0);
            for (let i = 0; i < n; i++) {
                const lx = (-0.36 + 0.72 * (n === 1 ? 0.5 : i / (n - 1))) * L + (rnd() - 0.5) * 20, ly = (rnd() - 0.5) * Sd * 0.5, r = (h.hall ? 34 : 26) + rnd() * 12;
                const sg = c.createRadialGradient(lx, ly, r * 0.4, lx, ly, r * 1.9); sg.addColorStop(0, 'rgba(10, 6, 4, 0.85)'); sg.addColorStop(1, 'rgba(10, 6, 4, 0)');
                c.fillStyle = sg; c.fillRect(lx - r * 2, ly - r * 2, r * 4, r * 4);
                c.beginPath(); for (let k = 0; k < 9; k++) { const a = k / 9 * Math.PI * 2, rr = r * (0.7 + rnd() * 0.4); c.lineTo(lx + Math.cos(a) * rr, ly + Math.sin(a) * rr * 0.8); } c.closePath();
                c.fillStyle = '#100905'; c.fill(); c.strokeStyle = 'rgba(255, 112, 30, 0.55)'; c.lineWidth = 2.5; c.stroke();
                c.strokeStyle = '#2a1a10'; c.lineWidth = 4; for (const o of [-0.4, 0.3]) { c.beginPath(); c.moveTo(lx + o * r, ly - r * 0.8); c.lineTo(lx + o * r * 0.7, ly + r * 0.8); c.stroke(); } // rafters showing
                const [wx, wy] = toWorld(lx, ly); h.holes.push([wx, wy, r]);
            }
        }
    }
    c.restore();
    // the door: a step in front, the door shut on an intact house, kicked in on a burning one (the longhall's is live)
    const { door, out } = h, px = -out[1], py = out[0], ns = out[1] !== 0; // ns: the door is in a north or south wall
    const sw = ns ? 40 : 12, sh = ns ? 12 : 40;
    c.fillStyle = '#6f6a62'; c.strokeStyle = '#26221d'; c.lineWidth = 1.5;
    c.beginPath(); c.rect(door.x + out[0] * 10 - sw / 2, door.y + out[1] * 10 - sh / 2, sw, sh); c.fill(); c.stroke();
    if (h.state === 'intact') { const dw = ns ? 26 : 6, dh = ns ? 6 : 26; c.fillStyle = '#5d4037'; c.strokeStyle = '#1a110a'; c.fillRect(door.x - dw / 2, door.y - dh / 2, dw, dh); c.strokeRect(door.x - dw / 2, door.y - dh / 2, dw, dh); }
    else if (!h.hall) { // broken door planks thrown out onto the step
        for (let i = 0; i < 3; i++) { c.save(); c.translate(door.x + out[0] * (16 + i * 7) + px * (rnd() - 0.5) * 30, door.y + out[1] * (16 + i * 7) + py * (rnd() - 0.5) * 30); c.rotate(rnd() * 3); c.fillStyle = '#3e2a1d'; c.fillRect(-11, -2.5, 22, 5); c.restore(); }
    }
}

function vilBurnt(c, h, L, Sd, rnd, toWorld) {
    c.fillStyle = '#1c1714'; c.fillRect(-L / 2, -Sd / 2, L, Sd); // ash floor
    for (let i = 0; i < L * Sd / 40; i++) { c.fillStyle = rnd() < 0.5 ? 'rgba(150, 140, 130, 0.25)' : 'rgba(0, 0, 0, 0.4)'; c.fillRect(-L / 2 + rnd() * L, -Sd / 2 + rnd() * Sd, 1 + rnd() * 3, 1 + rnd() * 3); }
    for (let i = 0; i < 4; i++) { const x = (rnd() - 0.5) * L * 0.8, y = (rnd() - 0.5) * Sd * 0.7, r = 14 + rnd() * 18; const gr = c.createRadialGradient(x, y, 0, x, y, r); gr.addColorStop(0, 'rgba(120, 112, 104, 0.5)'); gr.addColorStop(1, 'rgba(120, 112, 104, 0)'); c.fillStyle = gr; c.fillRect(x - r, y - r, r * 2, r * 2); } // ash heaps
    const beam = (x0, y0, x1, y1, w) => { c.strokeStyle = '#0d0907'; c.lineWidth = w + 2; c.beginPath(); c.moveTo(x0, y0); c.lineTo(x1, y1); c.stroke(); c.strokeStyle = '#2e221a'; c.lineWidth = w; c.stroke(); c.strokeStyle = 'rgba(120, 90, 70, 0.35)'; c.lineWidth = 1.2; c.beginPath(); c.moveTo(x0, y0 - w * 0.25); c.lineTo(x1, y1 - w * 0.25); c.stroke(); };
    for (let x = -L / 2 + 22; x < L / 2 - 10; x += 26 + rnd() * 10) { // rafters fallen in, some broken short, some slipped askew
        const k = rnd(); if (k < 0.2) continue;
        if (k < 0.55) beam(x, -Sd / 2 + 4, x + (rnd() - 0.5) * 14, Sd / 2 - 4, 6);
        else if (k < 0.8) { const s = rnd() < 0.5 ? -1 : 1; beam(x, s * (Sd / 2 - 4), x + (rnd() - 0.5) * 20, s * (rnd() * 0.3) * Sd, 6); }
        else beam(x - 20, -Sd * 0.35, x + 22, Sd * 0.3, 6);
    }
    beam(-L / 2 + 8, -2, -L * 0.05, 6, 8); beam(L * 0.08, -4, L / 2 - 8, 3, 8); // the ridge beam, snapped in two
    for (let i = 0; i < 4 + L / 60; i++) { const x = (rnd() - 0.5) * L * 0.85, y = (rnd() - 0.5) * Sd * 0.8; h.embers.push([...toWorld(x, y), 6 + rnd() * 8, rnd() * 6]); c.fillStyle = 'rgba(120, 40, 10, 0.6)'; c.beginPath(); c.arc(x, y, 3 + rnd() * 3, 0, Math.PI * 2); c.fill(); }
    // the walls' footing, broken in a couple of places, with charred corner posts and a chimney still standing
    const sideDoor = h.side === 'n' || h.side === 's' ? (h.w >= h.h ? (h.side === 'n' ? 'top' : 'bottom') : (h.side === 'n' ? 'left' : 'right')) : (h.w >= h.h ? (h.side === 'w' ? 'left' : 'right') : (h.side === 'w' ? 'bottom' : 'top'));
    const walls = { top: [-L / 2, -Sd / 2, L / 2, -Sd / 2], bottom: [-L / 2, Sd / 2, L / 2, Sd / 2], left: [-L / 2, -Sd / 2, -L / 2, Sd / 2], right: [L / 2, -Sd / 2, L / 2, Sd / 2] };
    for (const [side, [ax, ay, bx, by]] of Object.entries(walls)) {
        const len = Math.hypot(bx - ax, by - ay), gaps = [];
        if (side === sideDoor) gaps.push([0.5 - 16 / len, 0.5 + 16 / len]);
        if (rnd() < 0.6) { const g0 = 0.15 + rnd() * 0.5; gaps.push([g0, g0 + 0.12 + rnd() * 0.1]); }
        let u = 0; gaps.sort((p, q) => p[0] - q[0]);
        for (const [g0, g1] of [...gaps, [1, 1]]) {
            if (g0 > u) { c.strokeStyle = '#1a1512'; c.lineWidth = 12; c.beginPath(); c.moveTo(ax + (bx - ax) * u, ay + (by - ay) * u); c.lineTo(ax + (bx - ax) * g0, ay + (by - ay) * g0); c.stroke(); c.strokeStyle = '#4f473f'; c.lineWidth = 8; c.stroke(); c.strokeStyle = 'rgba(160, 150, 135, 0.3)'; c.lineWidth = 2; c.stroke(); }
            if (g1 < 1 && side !== sideDoor) for (let k = 0; k < 4; k++) { const v = g0 + (g1 - g0) * rnd(); cavRock(c, ax + (bx - ax) * v + (rnd() - 0.5) * 16, ay + (by - ay) * v + (rnd() - 0.5) * 16, 4 + rnd() * 4, rnd, '#4f473f'); } // rubble
            u = Math.max(u, g1);
        }
    }
    for (const [x, y] of [[-L / 2, -Sd / 2], [L / 2, -Sd / 2], [-L / 2, Sd / 2], [L / 2, Sd / 2]]) { c.fillStyle = '#120d0a'; c.fillRect(x - 6, y - 6, 12, 12); c.fillStyle = '#2b1f17'; c.fillRect(x - 4, y - 4, 8, 8); }
    const cx = L * 0.3, cy = -Sd * 0.18; c.fillStyle = '#5c574f'; c.strokeStyle = '#141210'; c.lineWidth = 2; c.fillRect(cx - 11, cy - 11, 22, 22); c.strokeRect(cx - 11, cy - 11, 22, 22);
    c.fillStyle = '#0c0a09'; c.fillRect(cx - 5, cy - 5, 10, 10); c.fillStyle = 'rgba(0, 0, 0, 0.45)'; c.fillRect(cx - 11, cy - 11, 22, 6); // soot-blackened top
}

// Solid props: the well, haystacks, carts, crates, stumps
function vilProp(c, o, rnd) {
    const { x, y, r } = o;
    c.fillStyle = 'rgba(8, 6, 4, 0.4)'; c.beginPath(); c.ellipse(x + r * 0.35, y + r * 0.45, r * 1.05, r * 0.85, 0, 0, Math.PI * 2); c.fill();
    if (o.kind === 'well') {
        for (let i = 0; i < 14; i++) { const a = i / 14 * Math.PI * 2; cavRock(c, x + Math.cos(a) * r * 0.85, y + Math.sin(a) * r * 0.85, 8, rnd, '#7a746a'); }
        c.fillStyle = '#0b1416'; c.beginPath(); c.arc(x, y, r * 0.62, 0, Math.PI * 2); c.fill();
        c.fillStyle = 'rgba(160, 200, 210, 0.25)'; c.beginPath(); c.ellipse(x - 5, y - 5, 7, 3, -0.5, 0, Math.PI * 2); c.fill(); // water glinting far down
        c.strokeStyle = '#2a1d13'; c.lineWidth = 7; c.beginPath(); c.moveTo(x - r - 6, y); c.lineTo(x + r + 6, y); c.stroke(); c.strokeStyle = '#6b4d33'; c.lineWidth = 4.5; c.stroke(); // the winch beam
        c.fillStyle = '#4e3626'; c.fillRect(x - 6, y - 5, 12, 10); c.strokeStyle = '#1a120c'; c.lineWidth = 1.5; c.strokeRect(x - 6, y - 5, 12, 10); // the bucket
    } else if (o.kind === 'hay') {
        const burnt = o.seed > 6;
        const gr = c.createRadialGradient(x - r * 0.3, y - r * 0.35, r * 0.1, x, y, r); gr.addColorStop(0, burnt ? '#6e5a38' : '#e3c26a'); gr.addColorStop(1, burnt ? '#2a2016' : '#94702e');
        c.fillStyle = gr; c.beginPath(); c.arc(x, y, r, 0, Math.PI * 2); c.fill(); c.strokeStyle = '#2e2210'; c.lineWidth = 2; c.stroke();
        for (let i = 0; i < 40; i++) { const a = rnd() * Math.PI * 2, d = rnd() * r * 0.95; c.strokeStyle = rnd() < 0.5 ? 'rgba(250, 225, 140, 0.5)' : 'rgba(90, 64, 24, 0.5)'; c.lineWidth = 1; c.beginPath(); c.moveTo(x + Math.cos(a) * d, y + Math.sin(a) * d); c.lineTo(x + Math.cos(a + 0.3) * (d + 6), y + Math.sin(a + 0.3) * (d + 6)); c.stroke(); }
        if (burnt) { c.fillStyle = 'rgba(10, 8, 6, 0.6)'; c.beginPath(); c.arc(x + r * 0.2, y + r * 0.1, r * 0.55, 0, Math.PI * 2); c.fill(); }
    } else if (o.kind === 'cart') vilCart(c, x, y, o.seed, r * 1.8, r * 1.1, true);
    else if (o.kind === 'crate') vilCrate(c, x, y, o.seed, r);
    else clrStump(c, o, rnd); // map_clearing.js
}
function vilCart(c, x, y, a, w, h, upright, burnt) { // a hand cart: plank bed, wheels at the sides, shafts out front
    c.save(); c.translate(x, y); c.rotate(a);
    for (const s of [-1, 1]) { c.fillStyle = '#1e140d'; c.fillRect(-w * 0.12, s * (h / 2 + 2) - 4, w * 0.3, 8); }
    if (upright) for (const s of [-1, 1]) { c.strokeStyle = '#2a1d13'; c.lineWidth = 4; c.beginPath(); c.moveTo(w / 2, s * h * 0.3); c.lineTo(w / 2 + 22, s * h * 0.22); c.stroke(); }
    c.fillStyle = burnt ? '#2b1f17' : '#6b4d33'; c.strokeStyle = '#1a120c'; c.lineWidth = 2.5; c.fillRect(-w / 2, -h / 2, w, h); c.strokeRect(-w / 2, -h / 2, w, h);
    c.strokeStyle = burnt ? 'rgba(0, 0, 0, 0.6)' : 'rgba(40, 26, 16, 0.6)'; c.lineWidth = 1.2; for (let i = 1; i < 4; i++) { c.beginPath(); c.moveTo(-w / 2, -h / 2 + h * i / 4); c.lineTo(w / 2, -h / 2 + h * i / 4); c.stroke(); }
    if (!upright) for (const s of [-1, 1]) { c.fillStyle = '#1e140d'; c.beginPath(); c.arc(-w * 0.05, s * h * 0.28, 9, 0, Math.PI * 2); c.fill(); c.strokeStyle = '#4e3626'; c.lineWidth = 2; c.stroke(); } // overturned: the wheels stick up
    c.restore();
}
function vilCrate(c, x, y, a, s, burnt) {
    c.save(); c.translate(x, y); c.rotate(a);
    c.fillStyle = burnt ? '#2e2219' : '#8a6642'; c.strokeStyle = '#1a120c'; c.lineWidth = 2; c.fillRect(-s, -s, s * 2, s * 2); c.strokeRect(-s, -s, s * 2, s * 2);
    c.strokeStyle = burnt ? '#120d0a' : '#5d4330'; c.lineWidth = 2.5; c.beginPath(); c.moveTo(-s, -s); c.lineTo(s, s); c.moveTo(s, -s); c.lineTo(-s, s); c.stroke();
    c.restore();
}

// The east palisade: two rows of sharpened logs seen from above, two watchtowers flanking the gate
function vilPalisade(c, rnd) {
    const H = STAGE_MAPS.village.h, inTower = y => VIL_TOWERS.some(t => y > t[1] - 6 && y < t[3] + 6);
    c.save(); c.filter = 'blur(8px)'; c.fillStyle = 'rgba(8, 6, 4, 0.55)'; c.fillRect(PAL.x0 + 12, 0, PAL.x1 - PAL.x0, PAL.g0); c.fillRect(PAL.x0 + 12, PAL.g1 + 16, PAL.x1 - PAL.x0, H); c.restore();
    for (const [col, x] of [[0, PAL.x0 + 12.5], [1, PAL.x0 + 37.5]]) for (let y = col * 6.5; y < H; y += 13) {
        if ((y > PAL.g0 - 8 && y < PAL.g1 + 8) || inTower(y)) continue;
        const lx = x + (rnd() - 0.5) * 2, r = 7 + rnd() * 1.2, gr = c.createRadialGradient(lx - 2, y - 2, 0.5, lx, y, r);
        gr.addColorStop(0, '#b08a5e'); gr.addColorStop(0.6, '#6e4c30'); gr.addColorStop(1, '#3a2617');
        c.fillStyle = gr; c.beginPath(); c.arc(lx, y, r, 0, Math.PI * 2); c.fill(); c.strokeStyle = '#1a110a'; c.lineWidth = 1.5; c.stroke();
        c.strokeStyle = 'rgba(30, 18, 10, 0.6)'; c.lineWidth = 0.8; for (let k = 0; k < 4; k++) { const a = k * Math.PI / 2 + 0.6; c.beginPath(); c.moveTo(lx, y); c.lineTo(lx + Math.cos(a) * r * 0.8, y + Math.sin(a) * r * 0.8); c.stroke(); } // the cut point
    }
    for (const [x0, y0, x1, y1] of VIL_TOWERS) { // a pyramid roof of shingles, darker on the far slopes
        c.save(); c.filter = 'blur(8px)'; c.fillStyle = 'rgba(8, 6, 4, 0.55)'; c.fillRect(x0 + 14, y0 + 16, x1 - x0, y1 - y0); c.restore();
        const cx = (x0 + x1) / 2, cy = (y0 + y1) / 2, e = 6, P = [[x0 - e, y0 - e], [x1 + e, y0 - e], [x1 + e, y1 + e], [x0 - e, y1 + e]], shade = ['#7a5a42', '#5a4030', '#3e2b20', '#62463a'];
        for (let i = 0; i < 4; i++) { c.beginPath(); c.moveTo(cx, cy); c.lineTo(...P[i]); c.lineTo(...P[(i + 1) % 4]); c.closePath(); c.fillStyle = shade[i]; c.fill(); c.strokeStyle = '#1a110a'; c.lineWidth = 2; c.stroke();
            c.strokeStyle = 'rgba(20, 12, 8, 0.4)'; c.lineWidth = 1; for (let k = 0.25; k < 1; k += 0.18) { c.beginPath(); c.moveTo(lerp(cx, P[i][0], k), lerp(cy, P[i][1], k)); c.lineTo(lerp(cx, P[(i + 1) % 4][0], k), lerp(cy, P[(i + 1) % 4][1], k)); c.stroke(); } }
        c.fillStyle = '#2a1d13'; c.beginPath(); c.arc(cx, cy, 4, 0, Math.PI * 2); c.fill();
    }
    for (const gy of [PAL.g0 - 4, PAL.g1 + 4]) { const gr = c.createRadialGradient(PAL.x0 + 23, gy - 3, 1, PAL.x0 + 25, gy, 13); gr.addColorStop(0, '#9c7a52'); gr.addColorStop(1, '#3a2617'); c.fillStyle = gr; c.beginPath(); c.arc(PAL.x0 + 25, gy, 12, 0, Math.PI * 2); c.fill(); c.strokeStyle = '#1a110a'; c.lineWidth = 2; c.stroke(); } // gate posts
}

// ---------- spawns ----------

// Bandits come out of a doorway, out of the trees, or over the barricade, somewhere ahead of the hero, never right next to them
function villageSpawnPoint() {
    const G = currentMap.grid, reach = (x, y) => !nav.dist || nav.dist[Math.floor(y / G.cell) * G.cols + Math.floor(x / G.cell)] >= 0;
    const dist = (x, y) => Math.hypot(x - player.x, y - player.y), cand = [];
    const add = (p, from, ox, oy) => { const d = dist(p.x, p.y); if (d > 430 && d < 1300 && reach(p.x, p.y)) cand.push({ x: p.x, y: p.y, from, ox, oy, d }); };
    for (const h of vil.houses) add(h.spawn, 'door', h.door.x - h.out[0] * 8, h.door.y - h.out[1] * 8);
    for (const f of vil.forest) add(f, 'forest', f.ox, f.oy);
    if (!vil.barBurnt) { add(vil.gate, 'gate', vil.gate.ox, vil.gate.oy); add(vil.gate, 'gate', vil.gate.ox, vil.gate.oy); }
    if (!cand.length) { // nothing in range: the closest source that isn't on top of the hero
        const all = [...vil.houses.map(h => ({ x: h.spawn.x, y: h.spawn.y, from: 'door', ox: h.door.x, oy: h.door.y })), ...vil.forest.map(f => ({ x: f.x, y: f.y, from: 'forest', ox: f.ox, oy: f.oy }))]
            .filter(p => dist(p.x, p.y) > 300 && reach(p.x, p.y)).sort((a, b) => dist(a.x, a.y) - dist(b.x, b.y));
        cand.push(...all.slice(0, 3));
    }
    const c = cand[(Math.random() * cand.length) | 0] || { x: STAGE_MAPS.village.start.x + 600, y: STAGE_MAPS.village.start.y, from: 'forest' };
    vil.lastSpawn = c;
    return { x: c.x + (Math.random() - 0.5) * 16, y: c.y + (Math.random() - 0.5) * 16, from: c.from };
}

// stage.js onEnemySpawned: where it steps in from
function villageOnSpawn(e) {
    const s = vil.lastSpawn; if (!s) return;
    e.spawnT = e.spawnMax = s.from === 'gate' ? 0.7 : 0.5;
    e.spawnOX = s.ox; e.spawnOY = s.oy; e.facingAngle = Math.atan2(e.y - s.oy, e.x - s.ox);
    if (s.from === 'door') burst(s.ox, s.oy, Math.atan2(e.y - s.oy, e.x - s.ox), 1.2, 6, { kind: 'smoke', color: 'rgba(60, 54, 50, 0.6)', size: 10, speed: [30, 90], life: 0.8, drag: 2, grow: 18 });
    if (s.from === 'gate') burst(s.ox - 30, s.oy, Math.PI, 1.6, 8, { kind: 'spark', color: '#ffb74d', size: 2, speed: [80, 220], life: 0.35, drag: 4 });
    vil.lastSpawn = null;
}

// ---------- per-frame gameplay ----------

function updateVillage(dt) {
    updateWarchiefLetter(); // the Warchief's letter (its section below)
    if (!player.dash && !player.grappleTarget) clampToBounds(player, player.radius); // blinks and pulls can't leave the hero inside a house
    if (!vil.barBurnt && player.x > PAL.x0 - player.radius) player.x = PAL.x0 - player.radius; // no blinking past the barricade
    player.wallHit = null; for (const e of enemies) e.wallHit = null;
    for (const k of vil.kegs) if (!k.ent && fxTime - k.goneAt > KEG_RESPAWN && Math.hypot(k.x - player.x, k.y - player.y) > 520) makeKeg(k); // bandits.js: another keg rolled out of the stores
    if ((vil.emberT -= dt) <= 0) { // embers rising off the roofs near the hero
        vil.emberT = 0.07;
        const V = cavView(200), list = vil.houses.filter(h => h.state === 'burning' && cavIn(h.cx, h.cy, V));
        if (!vil.barBurnt && cavIn(PAL.x0, PAL.y, V)) list.push({ holes: vil.barFires.map(([x, y, r]) => [x, y, r]) });
        if (list.length) {
            const h = list[(Math.random() * list.length) | 0], [x, y, r] = h.holes[(Math.random() * h.holes.length) | 0];
            spawnParticle({ kind: 'dot', color: Math.random() < 0.5 ? '#ffb74d' : '#ff7043', x: x + jitter(r), y: y + jitter(r), vx: WIND_X * (40 + Math.random() * 60) + jitter(30), vy: WIND_Y * (40 + Math.random() * 60) + jitter(30), size: 1.6 + Math.random() * 1.4, life: 1.2 + Math.random(), drag: 0.3, grow: 0, spin: 0, rot: 0 });
        }
    }
}

// ---------- the Warchief bursts out of the longhall (wave 5) ----------

function startWarchiefIntro(b) {
    const d = vil.hall.door;
    b.x = d.x; b.y = d.y - 12; b.state = 'intro'; b.facingAngle = Math.PI / 2;
    vil.hallOpen = false;
    stageEvent = { type: 'warchief_intro', t: 0, boss: b, blocking: true, knock: 0 };
}

function updateWarchiefIntro(ev, dt) {
    const b = ev.boss, t = ev.t, d = vil.hall.door, ty = d.y + 150;
    camera.tx = d.x; camera.ty = d.y + 110;
    if (t < 1.05 && t - ev.knock > 0.34) { // something heavy hammering on the doors from inside
        ev.knock = t; addShake(1.5 + t * 2.5);
        burst(d.x + jitter(30), d.y + 6, Math.PI / 2, 1.2, 4, { kind: 'debris', color: '#3e2a1d', size: 3, speed: [40, 140], life: 0.5, drag: 3 });
        burst(d.x, d.y - 10, -Math.PI / 2, 1.4, 6, { kind: 'spark', color: '#ffb74d', size: 2, speed: [60, 200], life: 0.4, drag: 3 });
    }
    if (t > 1.05 && !vil.hallOpen) { // the doors fly off
        vil.hallOpen = true; vil.hallAt = fxTime; addShake(7);
        for (const s of [-1, 1]) effects.push({ type: 'hall_door', x0: d.x + s * 14, y0: d.y + 4, x: d.x + s * (70 + Math.random() * 40), y: d.y + 90 + Math.random() * 50, s, life: 30, maxLife: 30 });
        burst(d.x, d.y + 10, Math.PI / 2, 1.6, 16, { kind: 'debris', color: '#4e3626', size: 4, speed: [140, 380], life: 0.7, drag: 2.5 });
        burst(d.x, d.y + 4, Math.PI / 2, 1.8, 20, { kind: 'spark', color: '#ffcc80', size: 2.6, speed: [150, 420], life: 0.45, drag: 3 });
        for (let i = 0; i < 8; i++) spawnParticle({ kind: 'smoke', color: 'rgba(50, 44, 40, 0.7)', x: d.x + jitter(40), y: d.y + 10, vx: jitter(120), vy: 60 + Math.random() * 100, size: 20, grow: 40, life: 1.3, drag: 1.5, spin: 0, rot: 0 });
        effects.push({ type: 'slime_shock', x: d.x, y: d.y + 30, radius: 160, color: '#ff7043', life: 0.5, maxLife: 0.5 });
    }
    if (t > 1.05) { b.x = d.x; b.y = lerp(d.y - 12, ty, easeOut(clamp01((t - 1.1) / 1.3))); }
    const [px, py, pd] = getVector(b.x, b.y, player.x, player.y); // keep the hero out of his way
    if (t > 1.05 && pd < b.size / 2 + player.radius + 30) { player.x = b.x + px / pd * (b.size / 2 + player.radius + 30); player.y = b.y + py / pd * (b.size / 2 + player.radius + 30); clampToBounds(player, player.radius); }
    if (t > 1.8 && !ev.card) { ev.card = true; showBossCard(BOSS_NAMES[b.type] || 'The Bandit Warchief', 'Scourge of Cinderholt'); }
    if (t > 2.55 && !ev.roared) { // he plants his feet and roars, torch held high
        ev.roared = true; addShake(5);
        effects.push({ type: 'slime_shock', x: b.x, y: b.y, radius: 200, color: '#ff7043', life: 0.55, maxLife: 0.55 });
        burst(b.x, b.y, 0, Math.PI * 2, 14, { kind: 'spark', color: '#ffb74d', size: 2.4, speed: [120, 320], life: 0.45, drag: 4 });
    }
    if (t > 3.1) { camera.tx = camera.ty = null; }
    if (t > 3.5) { b.state = 'idle'; b.stateTimer = 1.0; stageEvent = null; }
}

// ---------- the barricade burns down once the Warchief is dead ----------

function startBarricadeBurn() { stageEvent = { type: 'barricade_burn', t: 0, blocking: true, crack: 0 }; }

function updateBarricadeBurn(ev, dt) {
    const t = ev.t, bx = (PAL.x0 + PAL.x1) / 2, by = PAL.y;
    camera.tx = bx - 220; camera.ty = by;
    if (!vil.barBurnt) {
        vil.barFlare = clamp01(t / 1.2); // the fire flares up as it eats through the carts
        if (t - ev.crack > 0.18) { ev.crack = t; addShake(1 + t * 1.5); burst(bx + jitter(40), by + jitter(130), -Math.PI / 2, 2.4, 5, { kind: 'spark', color: '#ffcc80', size: 2.2, speed: [80, 260], life: 0.5, drag: 3 }); }
    }
    if (t > 1.7 && !vil.barBurnt) { // it collapses into a heap of glowing ash
        vil.barBurnt = true; vil.barAt = fxTime;
        const G = currentMap.grid; for (const i of vil.barCells) G.data[i] = T_FLOOR;
        updateNav(true); addShake(9);
        burst(bx, by, Math.PI, 2.6, 22, { kind: 'debris', color: '#2b1d16', size: 5, speed: [120, 400], life: 0.8, drag: 2.5 });
        burst(bx, by, 0, Math.PI * 2, 30, { kind: 'spark', color: '#ffb74d', size: 2.6, speed: [150, 480], life: 0.6, drag: 3 });
        for (let i = 0; i < 14; i++) spawnParticle({ kind: 'smoke', color: 'rgba(55, 48, 44, 0.65)', x: bx + jitter(50), y: by + jitter(150), vx: -40 - Math.random() * 120 + WIND_X * 40, vy: jitter(80) + WIND_Y * 40, size: 26, grow: 40, life: 1.5, drag: 1.5, spin: 0, rot: 0 });
        effects.push({ type: 'slime_shock', x: bx, y: by, radius: 240, color: '#ffab40', life: 0.7, maxLife: 0.7 });
        openStageExit('#ffab40');
    }
    if (t > 3.2) { camera.tx = camera.ty = null; }
    if (t > 3.6) stageEvent = null;
}

// ---------- the Warchief's letter (his death drops it; taking it opens the parchment, then the barricade burns) ----------

function dropWarchiefLetter() {
    const x0 = vil.bossFell ? vil.bossFell.x : player.x, y0 = vil.bossFell ? vil.bossFell.y : player.y;
    let x = x0 + 40, y = y0 + 25;
    if (terrainAt(x, y) !== T_FLOOR) { x = x0; y = y0; } // no landing in a wall or a fence
    vil.letter = { type: 'warchief_letter', x0, y0, x, y, life: 9999, maxLife: 9999 };
    effects.push(vil.letter); vil.letterTaken = false;
    showStagePrompt(true, "Take the Warchief's letter");
}

// Walking over the landed letter takes it (the flutter is over after 0.9 s, so it can't be grabbed mid-air)
function updateWarchiefLetter() {
    const L = vil.letter;
    if (!L || vil.letterTaken || L.maxLife - L.life < 0.9) return;
    if (Math.hypot(L.x - player.x, L.y - player.y) > 34) return;
    vil.letterTaken = true;
    const i = effects.indexOf(L); if (i >= 0) effects.splice(i, 1);
    showStagePrompt(false); openLetter();
}

function openLetter() {
    gameState = STATE.LETTER;
    el('letter-screen').classList.remove('hidden');
    paintLetterMap();
}

function closeLetter() {
    if (gameState !== STATE.LETTER) return; // the button and the key both call it
    el('letter-screen').classList.add('hidden');
    gameState = STATE.PLAYING; lastTime = performance.now();
    startBarricadeBurn();
}
window.closeLetter = closeLetter;

window.addEventListener('keydown', e => {
    if (gameState !== STATE.LETTER || e.repeat) return;
    const k = e.key.toLowerCase();
    if (k === 'enter' || k === ' ') { e.preventDefault(); closeLetter(); }
});

// The map on the letter, in ink on parchment. A fixed seed, so it looks the same every time.
function paintLetterMap() {
    const cv = el('letter-map'), c = cv.getContext('2d'), INK = 'rgba(59, 42, 23, 0.85)';
    let s = 7; const rnd = () => (s = (s * 16807) % 2147483647) / 2147483647, wob = () => (rnd() - 0.5) * 2.2;
    c.clearRect(0, 0, cv.width, cv.height);
    c.lineCap = 'round'; c.lineJoin = 'round'; c.strokeStyle = INK; c.fillStyle = INK; c.lineWidth = 2;
    c.font = 'italic 13px Georgia, serif'; c.textAlign = 'center'; c.textBaseline = 'middle';
    // the river: a wash between two wavy banks, top to bottom
    const bank = (y, side) => 380 + side * 24 + Math.sin(y * 0.06 + side) * 6;
    c.fillStyle = 'rgba(90, 110, 120, 0.25)'; c.beginPath();
    for (let y = 0; y <= 300; y += 6) c.lineTo(bank(y, -1), y);
    for (let y = 300; y >= 0; y -= 6) c.lineTo(bank(y, 1), y);
    c.closePath(); c.fill(); c.fillStyle = INK;
    for (const side of [-1, 1]) { c.beginPath(); for (let y = 0; y <= 300; y += 6) { if (y) c.lineTo(bank(y, side), y); else c.moveTo(bank(y, side), y); } c.stroke(); }
    // the village: burnt houses, each crossed out
    for (const [x, y] of [[36, 118], [58, 106], [44, 162], [72, 150]]) {
        c.strokeRect(x + wob(), y + wob(), 14, 14);
        c.beginPath(); c.moveTo(x, y); c.lineTo(x + 14, y + 14); c.moveTo(x + 14, y); c.lineTo(x, y + 14); c.stroke();
    }
    c.fillText('Cinderholt', 62, 198);
    // the forest along the first half of the trail: round trees and spruces
    for (let i = 0; i < 16; i++) {
        const x = 128 + rnd() * 110, y = rnd() < 0.5 ? 104 + rnd() * 22 : 176 + rnd() * 22;
        if (i % 3) { c.beginPath(); c.arc(x, y, 5, 0, Math.PI * 2); c.stroke(); }
        else { c.beginPath(); c.moveTo(x, y - 7); c.lineTo(x + 4.5, y + 3); c.lineTo(x - 4.5, y + 3); c.closePath(); c.stroke(); }
        c.beginPath(); c.moveTo(x, y + 5); c.lineTo(x, y + 9); c.stroke();
    }
    // the trail: dashed, winding in from the village and settling straight onto the bridge
    c.setLineDash([6, 6]); c.beginPath();
    for (let x = 96; x <= 352; x += 4) { const t = (x - 96) / 256, y = 150 + Math.sin(x * 0.035) * 14 * (1 - t); if (x === 96) c.moveTo(x, y); else c.lineTo(x, y); }
    c.stroke();
    c.beginPath(); c.moveTo(410, 150); c.lineTo(440, 150); c.stroke(); c.setLineDash([]);
    // the stone bridge across the river, with its planks
    c.strokeRect(354, 140, 56, 20);
    for (let x = 361; x <= 403; x += 7) { c.beginPath(); c.moveTo(x, 140); c.lineTo(x, 160); c.stroke(); }
    // the Beastmaster's paw, off the river; his name runs in from the left, right-aligned to the bank
    c.beginPath(); c.arc(330, 190, 5, 0, Math.PI * 2); c.fill();
    for (const [x, y] of [[322, 182], [327, 178], [333, 178], [338, 182]]) { c.beginPath(); c.arc(x, y, 2, 0, Math.PI * 2); c.fill(); }
    c.textAlign = 'right'; c.fillText('the Beastmaster', 348, 214); c.textAlign = 'center';
    // the bastion: a walled keep with two towers, crossed out in red
    c.strokeRect(446, 128, 46, 50); c.strokeRect(462, 158, 14, 20);
    for (let i = 0; i < 5; i++) c.strokeRect(446 + i * 10, 120, 6, 8);
    c.strokeRect(438, 112, 14, 68); c.strokeRect(492, 112, 14, 68);
    c.strokeStyle = '#9b1b1b'; c.lineWidth = 3; c.beginPath(); c.moveTo(432, 104); c.lineTo(512, 186); c.moveTo(512, 104); c.lineTo(432, 186); c.stroke();
    c.strokeStyle = INK; c.lineWidth = 2; c.fillText('the Bastion', 469, 204);
    // a compass rose in the corner
    c.beginPath(); c.arc(480, 262, 14, 0, Math.PI * 2); c.stroke();
    c.beginPath(); c.moveTo(480, 240); c.lineTo(480, 284); c.moveTo(458, 262); c.lineTo(502, 262); c.stroke();
    c.fillText('N', 480, 232);
}

// The letter as it lies (or flutters down) on the ground: a folded parchment with a red seal
function drawWarchiefLetter(t) {
    const L = vil.letter, k = clamp01((L.maxLife - L.life) / 0.9), fly = k < 1;
    const gx = lerp(L.x0, L.x, k), gy = lerp(L.y0, L.y, k), z = fly ? Math.sin(Math.PI * k) * 50 : 0, a = fly ? (1 - k) * 3 : 0;
    ctx.save(); ctx.globalCompositeOperation = 'lighter';
    glow(ctx, L.x, L.y, 34, '#ffe0a0', 0.35 + 0.15 * Math.sin(t * 3));
    ctx.restore();
    ctx.save(); ctx.globalAlpha = 0.35 * (1 - Math.min(0.5, z / 120)); ctx.fillStyle = '#000';
    ctx.beginPath(); ctx.ellipse(gx + 2, gy + 3, 12, 8, 0, 0, Math.PI * 2); ctx.fill(); ctx.restore();
    ctx.save(); ctx.translate(gx, gy - z); ctx.rotate(a);
    ctx.fillStyle = '#e8d9b0'; ctx.strokeStyle = '#5d4a2a'; ctx.lineWidth = 1;
    ctx.fillRect(-11, -7.5, 22, 15); ctx.strokeRect(-11, -7.5, 22, 15);
    ctx.strokeStyle = 'rgba(93, 74, 42, 0.45)'; ctx.beginPath(); ctx.moveTo(-11, 0); ctx.lineTo(11, 0); ctx.stroke(); // the fold
    ctx.fillStyle = '#b71c1c'; ctx.strokeStyle = '#6d0e0e'; ctx.beginPath(); ctx.arc(0, 0, 4.5, 0, Math.PI * 2); ctx.fill(); ctx.stroke(); // the wax seal
    ctx.restore();
}

// ---------- drawing (world space; the camera transform is already applied) ----------

function drawVillageGround() {
    const W = vil.ground.width, H = vil.ground.height, sx = Math.max(0, Math.floor(camera.x) - 20), sy = Math.max(0, Math.floor(camera.y) - 20);
    const sw = Math.min(W - sx, Math.ceil(viewW()) + 42), sh = Math.min(H - sy, Math.ceil(viewH()) + 42);
    ctx.drawImage(vil.ground, sx, sy, sw, sh, sx, sy, sw, sh);
    const t = fxTime, V = cavView(300);
    drawHallDoors(t);
    if (cavIn(PAL.x0, PAL.y, V)) drawBarricade(t);
    drawVillageDark();
    ctx.save(); ctx.globalCompositeOperation = 'lighter'; // things that glow, on top of the dusk
    for (const h of vil.houses) {
        if (!cavIn(h.cx, h.cy, V)) continue;
        if (h.state === 'burning') { const f = 0.85 + 0.15 * Math.sin(t * 7 + h.seed) + 0.08 * Math.sin(t * 17 + h.seed * 3); glow(ctx, h.cx, h.cy, Math.max(h.w, h.h) * 0.85, '#ff6d00', 0.26 * f); }
        else if (h.state === 'burnt') for (const [x, y, r, ph] of h.embers) glow(ctx, x, y, r * 2.2, '#ff5722', 0.3 + 0.25 * Math.sin(t * 2.2 + ph)); // bandits.js: cached glows
    }
    if (!vil.barBurnt && cavIn(PAL.x0, PAL.y, V)) glow(ctx, PAL.x0 + 25, PAL.y, 220 + vil.barFlare * 120, '#ff6d00', 0.3 + 0.2 * vil.barFlare + 0.05 * Math.sin(t * 9));
    if (vil.barBurnt && cavIn(PAL.x0, PAL.y, V)) glow(ctx, PAL.x0 + 25, PAL.y, 120, '#ff3d00', 0.25 * Math.max(0.3, 1 - (fxTime - vil.barAt) / 12) * (0.8 + 0.2 * Math.sin(t * 3)));
    ctx.restore();
    if (vil.letter && !vil.letterTaken && cavIn(vil.letter.x, vil.letter.y, V)) drawWarchiefLetter(t);
    if (currentMap.caveOpen) { // chevrons and a ring marking the road out
        const E = STAGE_MAPS.village.exit, p = 0.5 + 0.5 * Math.sin(t * 3);
        ctx.save(); ctx.strokeStyle = '#ffd180'; ctx.lineWidth = 4; ctx.lineCap = 'round'; ctx.shadowBlur = 12; ctx.shadowColor = '#ff9100';
        for (let i = 0; i < 3; i++) {
            const a = Math.sin(t * 4 - i * 0.9) * 0.5 + 0.5, x = E.x - 190 + i * 34 + Math.sin(t * 3) * 6;
            ctx.globalAlpha = 0.3 + 0.7 * a; ctx.beginPath(); ctx.moveTo(x - 10, E.y - 16); ctx.lineTo(x + 6, E.y); ctx.lineTo(x - 10, E.y + 16); ctx.stroke();
        }
        ctx.globalAlpha = 0.4 + 0.3 * p; ctx.lineWidth = 2; ctx.beginPath(); ctx.ellipse(E.x, E.y, 88, 88, 0, 0, Math.PI * 2); ctx.stroke();
        ctx.restore();
    }
}

// The longhall's double door: shut and shuddering until the Warchief kicks it out (then the leaves lie on the ground)
function drawHallDoors(t) {
    const d = vil.hall.door;
    if (!vil.hallOpen) {
        const sh = stageEvent && stageEvent.type === 'warchief_intro' ? Math.sin(t * 60) * 1.5 : 0;
        for (const s of [-1, 1]) { ctx.fillStyle = '#4e3626'; ctx.strokeStyle = '#1a110a'; ctx.lineWidth = 2; ctx.fillRect(d.x + (s < 0 ? -26 : 0) + sh, d.y - 4, 26, 9); ctx.strokeRect(d.x + (s < 0 ? -26 : 0) + sh, d.y - 4, 26, 9); }
        ctx.fillStyle = '#263238'; ctx.fillRect(d.x - 20, d.y - 2, 40, 3); // the iron bar across
    } else { ctx.fillStyle = '#0c0805'; ctx.fillRect(d.x - 27, d.y - 5, 54, 10); }
    for (const ef of effects) if (ef.type === 'hall_door') { // a door leaf tumbling out and landing
        const k = clamp01((ef.maxLife - ef.life) / 0.45), x = lerp(ef.x0, ef.x, easeOut(k)), y = lerp(ef.y0, ef.y, easeOut(k)), z = Math.sin(Math.PI * k) * 40;
        ctx.save(); ctx.globalAlpha = Math.min(1, ef.life / 3);
        ctx.fillStyle = 'rgba(0, 0, 0, 0.3)'; ctx.fillRect(x - 13 + 4, y - 22 + 6, 26, 44);
        ctx.translate(x, y - z); ctx.rotate(ef.s * (0.4 + k * 1.2));
        ctx.fillStyle = '#4e3626'; ctx.strokeStyle = '#1a110a'; ctx.lineWidth = 2; ctx.fillRect(-13, -22, 26, 44); ctx.strokeRect(-13, -22, 26, 44);
        ctx.strokeStyle = 'rgba(20, 12, 8, 0.6)'; ctx.lineWidth = 1; for (const px of [-4, 5]) { ctx.beginPath(); ctx.moveTo(px, -22); ctx.lineTo(px, 22); ctx.stroke(); }
        ctx.fillStyle = '#263238'; ctx.fillRect(-13, -12, 26, 3); ctx.fillRect(-13, 9, 26, 3);
        ctx.restore();
    }
}

// The carts and crates the bandits jammed into the gate, burning; afterwards a smouldering heap
function drawBarricade(t) {
    if (vil.barBurnt) {
        const k = clamp01((fxTime - vil.barAt) / 0.6);
        ctx.fillStyle = `rgba(22, 16, 12, ${0.55 * k})`; ctx.beginPath(); ctx.ellipse(PAL.x0 + 25, PAL.y, 38, 80, 0, 0, Math.PI * 2); ctx.fill(); // ash heaped across the gateway
        vilCart(ctx, PAL.x0 + 30, PAL.y + 35, 2.2, 40, 24, false, true);
        for (const [x, y, s] of [[PAL.x0 + 10, PAL.y - 50, 9], [PAL.x0 + 40, PAL.y - 20, 7]]) vilCrate(ctx, x, y, s, s, true);
        return;
    }
    for (const b of vil.bar) {
        if (b.kind === 'cart') vilCart(ctx, b.x, b.y, b.a, b.w, b.h, false, true);
        else if (b.kind === 'crate') vilCrate(ctx, b.x, b.y, b.a, b.s, true);
        else { ctx.save(); ctx.translate(b.x, b.y); ctx.rotate(b.a); ctx.fillStyle = '#2b1f17'; ctx.strokeStyle = '#0d0907'; ctx.lineWidth = 2; ctx.fillRect(-b.l / 2, -4, b.l, 8); ctx.strokeRect(-b.l / 2, -4, b.l, 8); ctx.restore(); }
    }
}

function drawVillageDark() { drawDarkLayer('rgba(26, 12, 6, 0.42)', hole => { // map_cavern.js: dusk, lit by the fires
    const t = fxTime;
    const V = cavView(500);
    for (const h of vil.houses) if (h.state === 'burning' && cavIn(h.cx, h.cy, V)) hole(h.cx, h.cy, Math.max(h.w, h.h) * 1.25 + Math.sin(t * 8 + h.seed) * 12, 0.62); // one light per burning house
    if (!vil.barBurnt) hole(PAL.x0 + 25, PAL.y, 380 + vil.barFlare * 140, 0.7);
    for (const ef of effects) {
        if (ef.type === 'ground_fire') hole(ef.x, ef.y, ef.radius * 3.4, 0.65 * Math.min(1, ef.life / 0.8));
        else if (ef.type === 'keg_flash') hole(ef.x, ef.y, 420, 0.95 * (ef.life / ef.maxLife));
        else if (ef.type === 'torch_arc') hole(lerp(ef.x0, ef.x, 1 - ef.life / ef.maxLife), lerp(ef.y0, ef.y, 1 - ef.life / ef.maxLife), 200, 0.55);
    }
    for (const e of enemies) if (!e.dead && e.type === 'boss_warlord') hole(e.x, e.y, 260, 0.55);
}); }

// Above the fighters: roof fires, smoke drifting downwind, the tree canopy (see-through around the hero), falling ash
function drawVillageAbove() {
    const c = ctx, t = fxTime, V = cavView(260);
    for (const h of vil.houses) {
        if (h.state !== 'burning' || !cavIn(h.cx, h.cy, V)) continue;
        c.save(); c.globalCompositeOperation = 'lighter'; for (const [x, y, r] of h.holes) glow(c, x, y, r * 2.2, '#ff8f00', 0.35 + 0.1 * Math.sin(t * 9 + x)); c.restore();
        for (const [x, y, r] of h.holes) drawFlame(c, x, y, r * 1.05, t, h.seed + x * 0.01, 1);
    }
    if (!vil.barBurnt && cavIn(PAL.x0, PAL.y, V)) for (const [x, y, r] of vil.barFires) drawFlame(c, x, y, r * (1 + vil.barFlare * 0.9), t, x * 0.01, 1);
    for (const h of vil.houses) if (h.state === 'burning' && cavIn(h.cx + 200, h.cy - 150, cavView(500))) drawSmokeColumn(h.cx, h.cy, t, h.seed, Math.max(h.w, h.h) / 150, 0.42); // one column per house
    if (!vil.barBurnt && cavIn(PAL.x0 + 200, PAL.y - 150, cavView(500))) drawSmokeColumn(PAL.x0 + 25, PAL.y, t, 1.7, 1.3, 0.4);
    // the canopy, with a soft hole around the hero so they never vanish under a tree (skipped while they're clear of the trees)
    const cw = Math.ceil(viewW()), ch = Math.ceil(viewH()), cx = Math.floor(camera.x), cy = Math.floor(camera.y);
    if (player.y > 470 && player.y < 1330 && player.x > 400 && player.x < PAL.x0 - 100) { const sx = Math.max(0, cx), sy = Math.max(0, cy); c.drawImage(vil.canopy, sx, sy, cw, ch, sx, sy, cw, ch); }
    else {
    if (!vil.view || vil.view.width !== cw || vil.view.height !== ch) vil.view = cavCanvas(cw, ch);
    const v = vil.view.getContext('2d');
    v.globalCompositeOperation = 'source-over'; v.clearRect(0, 0, cw, ch);
    v.drawImage(vil.canopy, Math.max(0, cx), Math.max(0, cy), cw, ch, Math.max(0, -cx), Math.max(0, -cy), cw, ch);
    const px = player.x - cx, py = player.y - cy, hole = v.createRadialGradient(px, py, 30, px, py, 120);
    hole.addColorStop(0, 'rgba(0, 0, 0, 0.75)'); hole.addColorStop(1, 'rgba(0, 0, 0, 0)');
    v.globalCompositeOperation = 'destination-out'; v.fillStyle = hole; v.fillRect(px - 120, py - 120, 240, 240);
    c.drawImage(vil.view, cx, cy);
    }
    // ash flakes drifting through the air around the hero
    const tx0 = Math.floor(player.x / 200), ty0 = Math.floor(player.y / 200);
    c.fillStyle = '#d2c8be';
    for (let ty = ty0 - 2; ty <= ty0 + 2; ty++) for (let tx = tx0 - 3; tx <= tx0 + 3; tx++) for (let i = 0; i < 2; i++) {
        const hsh = tx * 73 + ty * 151 + i * 17, x = tx * 200 + ((cavHash(hsh) * 200 + t * 26 * WIND_X * (0.6 + cavHash(hsh + 2))) % 200 + 200) % 200, y = ty * 200 + ((cavHash(hsh + 5) * 200 + t * 18 + t * 26 * WIND_Y * 0.3) % 200 + 200) % 200;
        c.globalAlpha = 0.35 + 0.25 * Math.sin(t * 2 + hsh); c.fillRect(x, y, 2.2, 1.6);
    }
    c.globalAlpha = 1;
}

// A column of smoke: soft puffs that rise, swell and thin out as the wind carries them off
function drawSmokeColumn(x, y, t, seed, s, alpha) {
    if (!vil.smoke) { // one soft puff, painted once and stretched for every puff in every column
        vil.smoke = cavCanvas(128, 128); const k = vil.smoke.getContext('2d'), g = k.createRadialGradient(64, 64, 4, 64, 64, 64);
        g.addColorStop(0, 'rgba(128, 118, 112, 0.85)'); g.addColorStop(0.55, 'rgba(110, 100, 96, 0.45)'); g.addColorStop(1, 'rgba(100, 92, 88, 0)'); k.fillStyle = g; k.fillRect(0, 0, 128, 128);
    }
    for (let i = 0; i < 6; i++) {
        const k = (t * 0.11 + i / 6 + seed) % 1, d = k * 300 * s, r = (22 + k * 72) * s; // kept small: big alpha puffs are what a weak GPU feels most
        const px = x + WIND_X * d + Math.sin(t * 0.7 + i * 1.9 + seed) * 18 * k, py = y + WIND_Y * d + Math.cos(t * 0.6 + i * 2.3) * 12 * k;
        ctx.globalAlpha = alpha * Math.sin(Math.PI * Math.min(1, k * 1.15)); ctx.drawImage(vil.smoke, px - r, py - r, r * 2, r * 2);
    }
    ctx.globalAlpha = 1;
}
